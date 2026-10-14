import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getTodayDate, parseLocalDate, formatIsoDateJakarta } from "@/lib/date";
import { AttendanceStatus } from "@prisma/client";
import { notifyParentAttendance } from "@/lib/whatsapp";

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const termIdParam = searchParams.get("termId");
    const classId = searchParams.get("classId");
    const statusParam = searchParams.get("status") as AttendanceStatus | null;

    // Filter tanggal & semester
    let dateFilter: any = undefined;
    if (startDateParam && endDateParam) {
      dateFilter = {
        gte: parseLocalDate(startDateParam),
        lte: parseLocalDate(endDateParam),
      };
    } else if (startDateParam) {
      dateFilter = parseLocalDate(startDateParam);
    } else if (dateParam) {
      dateFilter = parseLocalDate(dateParam);
    } else if (!termIdParam) {
      // Default ke hari ini jika tidak ada filter semester khusus
      dateFilter = getTodayDate();
    }

    // Otorisasi role Guru: dibatasi ke kelas perwalian
    let filterClassId: string | undefined = classId || undefined;
    if (sessionUser.role === "GURU") {
      const teacher = await prisma.teacher.findUnique({
        where: { id: sessionUser.teacherId || "" },
        include: { homeroomClass: true },
      });
      if (!teacher?.homeroomClass) {
        return NextResponse.json({ success: true, attendances: [] });
      }
      filterClassId = teacher.homeroomClass.id;
    }

    const attendances = await prisma.studentAttendance.findMany({
      where: {
        ...(dateFilter ? { attendanceDate: dateFilter } : {}),
        ...(termIdParam ? { academicTermId: termIdParam } : {}),
        student: {
          classId: filterClassId,
        },
        status: statusParam || undefined,
      },
      include: {
        student: {
          include: {
            class: true,
          },
        },
        academicTerm: {
          select: { id: true, name: true, semester: true },
        },
        createdBy: {
          select: { name: true, role: true },
        },
      },
      orderBy: [{ attendanceDate: "desc" }, { student: { class: { name: "asc" } } }, { student: { name: "asc" } }],
    });

    return NextResponse.json({ success: true, attendances });
  } catch (error) {
    console.error("GET Attendance Error:", error);
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
    const { id, status, notes, correctionReason } = body;

    if (!id || !status || !correctionReason) {
      return NextResponse.json(
        { success: false, message: "ID presensi, status baru, dan alasan koreksi wajib diisi." },
        { status: 400 }
      );
    }

    const currentAttendance = await prisma.studentAttendance.findUnique({
      where: { id },
      include: {
        student: {
          include: { class: true },
        },
      },
    });

    if (!currentAttendance) {
      return NextResponse.json({ success: false, message: "Data presensi tidak ditemukan." }, { status: 404 });
    }

    // Otorisasi: Guru hanya boleh koreksi kelasnya sendiri
    if (sessionUser.role === "GURU") {
      const teacher = await prisma.teacher.findUnique({
        where: { id: sessionUser.teacherId || "" },
        include: { homeroomClass: true },
      });
      if (currentAttendance.student.classId !== teacher?.homeroomClass?.id) {
        return NextResponse.json(
          { success: false, message: "Anda hanya memiliki izin koreksi untuk siswa kelas perwalian Anda." },
          { status: 403 }
        );
      }
    }

    const oldValues = {
      status: currentAttendance.status,
      notes: currentAttendance.notes,
    };

    const newValues = {
      status,
      notes: notes || `Koreksi: ${correctionReason}`,
      correctedBy: sessionUser.name,
      correctionReason,
    };

    const updated = await prisma.studentAttendance.update({
      where: { id },
      data: {
        status: status as AttendanceStatus,
        notes: newValues.notes,
      },
    });

    // Catat Audit Log
    await logAudit({
      actorId: sessionUser.id,
      action: "CORRECT_ATTENDANCE",
      entityType: "StudentAttendance",
      entityId: id,
      oldValues,
      newValues,
    });

    return NextResponse.json({
      success: true,
      message: "Koreksi presensi berhasil disimpan.",
      attendance: updated,
    });
  } catch (error) {
    console.error("PATCH Attendance Error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // Role check: GURU, ADMIN, SUPERADMIN
    if (sessionUser.role !== "SUPERADMIN" && sessionUser.role !== "ADMIN" && sessionUser.role !== "GURU") {
      return NextResponse.json(
        { success: false, message: "Akses ditolak. Anda tidak memiliki izin mencatat presensi." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { studentId, attendanceDate, status, checkInTime, manualReason, notes } = body;

    // 1. Validasi input wajib
    if (!studentId) {
      return NextResponse.json({ success: false, message: "Siswa wajib dipilih." }, { status: 400 });
    }

    if (!status || !["HADIR", "TERLAMBAT", "IZIN", "SAKIT", "ALFA"].includes(status)) {
      return NextResponse.json({ success: false, message: "Status presensi tidak valid." }, { status: 400 });
    }

    if (!manualReason || typeof manualReason !== "string" || !manualReason.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Keterangan/alasan presensi manual wajib diisi untuk keperluan transparansi dan audit.",
        },
        { status: 400 }
      );
    }

    // 2. Ambil data siswa
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { class: true },
    });

    if (!student) {
      return NextResponse.json({ success: false, message: "Data siswa tidak ditemukan." }, { status: 404 });
    }

    if (!student.isActive) {
      return NextResponse.json(
        { success: false, message: `Siswa ${student.name} berstatus nonaktif.` },
        { status: 400 }
      );
    }

    // 3. Otorisasi role GURU (hanya kelas perwaliannya)
    if (sessionUser.role === "GURU") {
      const teacher = await prisma.teacher.findUnique({
        where: { id: sessionUser.teacherId || "" },
        include: { homeroomClass: true },
      });
      if (!teacher?.homeroomClass) {
        return NextResponse.json({ success: false, message: "Anda belum ditugaskan sebagai wali kelas." }, { status: 403 });
      }
      if (student.classId !== teacher.homeroomClass.id) {
        return NextResponse.json(
          {
            success: false,
            message: `Anda hanya memiliki izin menginput presensi siswa kelas perwalian Anda (${teacher.homeroomClass.name}). Siswa ini berada di kelas ${student.class?.name || "-"}.`,
          },
          { status: 403 }
        );
      }
    }

    // 4. Tanggal Presensi (default ke hari ini Asia/Jakarta)
    const targetDateStr = attendanceDate && typeof attendanceDate === "string" ? attendanceDate : formatIsoDateJakarta();
    const targetDate = parseLocalDate(targetDateStr);

    // 5. Cek duplikasi presensi pada tanggal tersebut
    const existing = await prisma.studentAttendance.findUnique({
      where: {
        studentId_attendanceDate: {
          studentId: student.id,
          attendanceDate: targetDate,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: `Presensi siswa ${student.name} pada tanggal ${targetDateStr} sudah tercatat (Status: ${existing.status}). Silakan gunakan tombol Koreksi jika ingin mengubah statusnya.`,
        },
        { status: 409 }
      );
    }

    // 6. Ambil Pengaturan Sekolah & Semester Aktif
    const [settings, activeTerm] = await Promise.all([
      prisma.schoolSetting.findFirst({ where: { id: 1 } }),
      prisma.academicTerm.findFirst({ where: { isActive: true } }),
    ]);

    const checkInEnd = settings?.checkInEnd || "07:15";

    // 7. Hitung jam masuk & keterlambatan
    let checkInAt: Date | null = null;
    let lateMinutes = 0;
    let finalStatus: AttendanceStatus = status as AttendanceStatus;

    if (status === "HADIR" || status === "TERLAMBAT") {
      if (checkInTime && typeof checkInTime === "string" && /^\d{1,2}:\d{2}$/.test(checkInTime)) {
        const [hStr, mStr] = checkInTime.split(":");
        const h = String(parseInt(hStr, 10)).padStart(2, "0");
        const m = String(parseInt(mStr, 10)).padStart(2, "0");
        checkInAt = new Date(`${targetDateStr}T${h}:${m}:00+07:00`);

        const [limitH, limitM] = checkInEnd.split(":").map(Number);
        const timeTotal = parseInt(h, 10) * 60 + parseInt(m, 10);
        const limitTotal = limitH * 60 + limitM;

        if (timeTotal > limitTotal) {
          lateMinutes = timeTotal - limitTotal;
          finalStatus = "TERLAMBAT";
        } else {
          lateMinutes = 0;
          finalStatus = status === "TERLAMBAT" ? "TERLAMBAT" : "HADIR";
        }
      } else {
        // Jika tidak diisi jam spesifik
        const now = new Date();
        const todayStr = formatIsoDateJakarta();
        if (targetDateStr === todayStr) {
          checkInAt = now;
          const [limitH, limitM] = checkInEnd.split(":").map(Number);
          const nowTotal = now.getHours() * 60 + now.getMinutes();
          const limitTotal = limitH * 60 + limitM;
          if (nowTotal > limitTotal) {
            lateMinutes = nowTotal - limitTotal;
            finalStatus = "TERLAMBAT";
          } else {
            lateMinutes = 0;
            finalStatus = status === "TERLAMBAT" ? "TERLAMBAT" : "HADIR";
          }
        } else {
          // Tanggal lampau: set jam default 07:00
          checkInAt = new Date(`${targetDateStr}T07:00:00+07:00`);
          lateMinutes = 0;
        }
      }
    } else {
      // IZIN, SAKIT, ALFA
      checkInAt = null;
      lateMinutes = 0;
    }

    const trimmedReason = manualReason.trim();
    const formattedNotes = `[Absen Manual] ${trimmedReason}${notes && notes.trim() ? ` — ${notes.trim()}` : ""}`;

    // 8. Simpan ke database
    const created = await prisma.studentAttendance.create({
      data: {
        studentId: student.id,
        classId: student.classId,
        academicTermId: activeTerm?.id || null,
        attendanceDate: targetDate,
        checkInAt,
        status: finalStatus,
        lateMinutes,
        notes: formattedNotes,
        createdById: sessionUser.id,
      },
      include: {
        student: {
          include: { class: true },
        },
        academicTerm: {
          select: { id: true, name: true, semester: true },
        },
        createdBy: {
          select: { name: true, role: true },
        },
      },
    });

    // 9. Catat Audit Log
    await logAudit({
      actorId: sessionUser.id,
      action: "MANUAL_ATTENDANCE",
      entityType: "StudentAttendance",
      entityId: created.id,
      newValues: {
        studentId: student.id,
        studentName: student.name,
        nis: student.nis,
        class: student.class?.name,
        attendanceDate: targetDateStr,
        status: finalStatus,
        lateMinutes,
        manualReason: trimmedReason,
        notes: formattedNotes,
        recordedBy: sessionUser.name,
      },
    });

    // 10. Kirim Notifikasi WhatsApp ke Orang Tua di latar belakang
    void notifyParentAttendance({
      studentId: student.id,
      studentName: student.name,
      className: student.class?.name || "",
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      status: finalStatus as any,
      checkInTime: checkInTime || (checkInAt ? new Date(checkInAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"),
      dateStr: targetDateStr,
      lateMinutes,
      reason: trimmedReason,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Presensi manual ${student.name} berhasil disimpan.`,
        attendance: created,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST Attendance Manual Error:", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server saat menyimpan presensi manual." },
      { status: 500 }
    );
  }
}
