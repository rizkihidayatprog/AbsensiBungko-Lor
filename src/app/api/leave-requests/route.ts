import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { notifyParentAttendance } from "@/lib/whatsapp";
import { LeaveStatus, AttendanceStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") as LeaveStatus | null;
    const classIdParam = searchParams.get("classId");
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(2000, Math.max(1, Number(searchParams.get("perPage")) || 100));

    // Otorisasi Guru: terbatas pada kelas perwaliannya
    let filterClassId: string | undefined = classIdParam || undefined;
    if (sessionUser.role === "GURU") {
      const teacher = await prisma.teacher.findUnique({
        where: { id: sessionUser.teacherId || "" },
        include: { homeroomClass: true },
      });
      if (!teacher?.homeroomClass) {
        return NextResponse.json({
          success: true,
          leaveRequests: [],
          total: 0,
          pagination: { page: 1, perPage, totalPages: 0, total: 0 },
        });
      }
      filterClassId = teacher.homeroomClass.id;
    }

    const where = {
      ...(statusParam ? { status: statusParam } : {}),
      student: {
        classId: filterClassId,
      },
    };

    const [total, leaveRequests] = await Promise.all([
      prisma.leaveRequest.count({ where }),
      prisma.leaveRequest.findMany({
        where,
        include: {
          student: {
            include: { class: true },
          },
          reviewer: {
            select: { name: true, role: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return NextResponse.json({
      success: true,
      leaveRequests,
      total,
      pagination: {
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
        total,
      },
    });
  } catch (error) {
    console.error("GET Leave Requests Error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, status, rejectionNote } = body;

    if (!id || !status) {
      return NextResponse.json({ success: false, message: "ID pengajuan dan status wajib disertakan." }, { status: 400 });
    }

    if (status !== "DISETUJUI" && status !== "DITOLAK") {
      return NextResponse.json({ success: false, message: "Status harus DISETUJUI atau DITOLAK." }, { status: 400 });
    }

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        student: { include: { class: true } },
      },
    });

    if (!leave) {
      return NextResponse.json({ success: false, message: "Pengajuan izin tidak ditemukan." }, { status: 404 });
    }

    // Otorisasi Guru: hanya untuk siswa perwalian
    if (sessionUser.role === "GURU") {
      const teacher = await prisma.teacher.findUnique({
        where: { id: sessionUser.teacherId || "" },
        include: { homeroomClass: true },
      });
      if (leave.student.classId !== teacher?.homeroomClass?.id) {
        return NextResponse.json({ success: false, message: "Akses ditolak. Anda hanya dapat memverifikasi siswa kelas Anda." }, { status: 403 });
      }
    }

    const activeTerm = await prisma.academicTerm.findFirst({
      where: { isActive: true },
    });

    // Jalankan pembaruan & pembuatan presensi
    await prisma.$transaction(async (tx) => {
      // 1. Update status permohonan izin
      await tx.leaveRequest.update({
        where: { id },
        data: {
          status: status as LeaveStatus,
          reviewerId: sessionUser.id,
          reviewedAt: new Date(),
          rejectionNote: status === "DITOLAK" ? rejectionNote : null,
        },
      });

      // 2. Jika disetujui, otomatis sinkronkan catatan presensi siswa
      if (status === "DISETUJUI") {
        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate);

        const current = new Date(start);
        while (current <= end) {
          const dateStr = current.toISOString().split("T")[0];
          const utcDate = new Date(`${dateStr}T00:00:00.000Z`);

          await tx.studentAttendance.upsert({
            where: {
              studentId_attendanceDate: {
                studentId: leave.studentId,
                attendanceDate: utcDate,
              },
            },
            update: {
              status: leave.type as unknown as AttendanceStatus,
              notes: `Pengajuan ${leave.type}: ${leave.reason}`,
              classId: leave.student.classId,
              createdById: sessionUser.id,
              ...(activeTerm ? { academicTermId: activeTerm.id } : {}),
            },
            create: {
              studentId: leave.studentId,
              classId: leave.student.classId,
              attendanceDate: utcDate,
              academicTermId: activeTerm?.id || null,
              status: leave.type as unknown as AttendanceStatus,
              notes: `Pengajuan ${leave.type}: ${leave.reason}`,
              createdById: sessionUser.id,
            },
          });

          // Maju 1 hari
          current.setDate(current.getDate() + 1);
        }
      }
    });

    await logAudit({
      actorId: sessionUser.id,
      action: status === "DISETUJUI" ? "APPROVE_LEAVE_REQUEST" : "REJECT_LEAVE_REQUEST",
      entityType: "LeaveRequest",
      entityId: id,
      newValues: { studentName: leave.student.name, status, rejectionNote },
    });

    // Notifikasi WhatsApp ke orang tua saat pengajuan disetujui
    if (status === "DISETUJUI") {
      const fmtDay = (d: Date) =>
        new Intl.DateTimeFormat("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "Asia/Jakarta",
        }).format(d);
      const startD = new Date(leave.startDate);
      const endD = new Date(leave.endDate);
      const dateStr =
        startD.toISOString().slice(0, 10) === endD.toISOString().slice(0, 10)
          ? fmtDay(startD)
          : `${fmtDay(startD)} s/d ${fmtDay(endD)}`;

      await notifyParentAttendance({
        studentId: leave.student.id,
        studentName: leave.student.name,
        className: leave.student.class?.name || "-",
        parentName: leave.student.parentName,
        parentPhone: leave.student.parentPhone,
        status: leave.type as "IZIN" | "SAKIT",
        dateStr,
        reason: leave.reason,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Pengajuan ${leave.type} untuk ${leave.student.name} telah ${status === "DISETUJUI" ? "disetujui dan dicatat ke presensi" : "ditolak"}.`,
    });
  } catch (error: any) {
    console.error("PATCH Leave Request Error:", error);
    return NextResponse.json({ success: false, message: error.message || "Gagal memproses permohonan." }, { status: 500 });
  }
}
