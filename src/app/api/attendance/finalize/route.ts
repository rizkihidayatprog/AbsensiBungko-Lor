import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyParentAttendance } from "@/lib/whatsapp";
import { parseLocalDate, formatIsoDateJakarta } from "@/lib/date";

const DAY_MAP: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    if (sessionUser.role !== "SUPERADMIN" && sessionUser.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Akses ditolak. Hanya Superadmin/Admin yang dapat melakukan finalisasi alfa." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const dateParam = typeof body.date === "string" ? body.date : formatIsoDateJakarta();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json(
        { success: false, message: "Format tanggal harus YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const targetDate = parseLocalDate(dateParam);
    const todayIso = formatIsoDateJakarta();

    const settings = await prisma.schoolSetting.findFirst({ where: { id: 1 } });
    const activeDays = (settings?.activeDays || "1,2,3,4,5")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n));

    // 1. Hari aktif sekolah / hari libur
    const weekdayWib = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jakarta",
      weekday: "short",
    }).format(targetDate);
    const dayNum = DAY_MAP[weekdayWib];
    if (!activeDays.includes(dayNum)) {
      return NextResponse.json(
        { success: false, message: "Tanggal tersebut bukan hari aktif sekolah, finalisasi alfa dibatalkan." },
        { status: 400 }
      );
    }

    const isHoliday = await prisma.holiday.findFirst({
      where: { date: { equals: targetDate } },
      select: { id: true },
    });
    if (isHoliday) {
      return NextResponse.json(
        { success: false, message: "Tanggal tersebut adalah hari libur sekolah, finalisasi alfa dibatalkan." },
        { status: 400 }
      );
    }

    // 2. Jendela waktu berdasarkan autoAlphaTime (khusus finalisasi hari ini)
    const alphaTime = settings?.autoAlphaTime || "12:00";
    if (dateParam === todayIso) {
      const nowTime = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date());
      if (nowTime < alphaTime) {
        return NextResponse.json(
          { success: false, message: `Finalisasi alfa dapat dilakukan mulai pukul ${alphaTime} WIB.` },
          { status: 400 }
        );
      }
    }

    // 3. Siswa aktif, pengecualian yang sudah berizin (disetujui), sudah presensi
    const [students, approvedLeaves, existingRecords] = await Promise.all([
      prisma.student.findMany({
        where: { isActive: true },
        include: { class: { select: { id: true, name: true } } },
      }),
      prisma.leaveRequest.findMany({
        where: {
          status: "DISETUJUI",
          startDate: { lte: targetDate },
          endDate: { gte: targetDate },
        },
        select: { studentId: true },
      }),
      prisma.studentAttendance.findMany({
        where: { attendanceDate: { equals: targetDate } },
        select: { studentId: true },
      }),
    ]);

    const coveredByLeave = new Set(approvedLeaves.map((l) => l.studentId));
    const hasRecord = new Set(existingRecords.map((a) => a.studentId));

    const targets = students.filter(
      (s) => !coveredByLeave.has(s.id) && !hasRecord.has(s.id)
    );

    const activeTerm = await prisma.academicTerm.findFirst({
      where: { isActive: true },
    });

    let created = 0;
    if (targets.length > 0) {
      const result = await prisma.studentAttendance.createMany({
        data: targets.map((s) => ({
          studentId: s.id,
          classId: s.classId,
          academicTermId: activeTerm?.id || null,
          attendanceDate: targetDate,
          status: "ALFA",
          notes: "Finalisasi alfa otomatis",
          createdById: sessionUser.id,
        })),
        skipDuplicates: true,
      });
      created = result.count;
    }

    await logAudit({
      actorId: sessionUser.id,
      action: "FINALIZE_ALFA",
      entityType: "StudentAttendance",
      entityId: dateParam,
      newValues: { date: dateParam, alphaCount: created },
    });

    // 4. Notifikasi WhatsApp ke orang tua (tidak memblokir respons)
    if (created > 0) {
      const dateStr = new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      }).format(targetDate);

      targets.forEach((s) => {
        void notifyParentAttendance({
          studentId: s.id,
          studentName: s.name,
          className: s.class?.name || "-",
          parentName: s.parentName,
          parentPhone: s.parentPhone,
          status: "ALFA",
          dateStr,
          reason: "Tidak hadir pada hari efektif sekolah",
        });
      });
    }

    return NextResponse.json({
      success: true,
      message:
        created > 0
          ? `Finalisasi alfa selesai: ${created} siswa ditandai alfa pada ${dateParam}.`
          : "Tidak ada siswa yang perlu difinalisasi alfa pada tanggal tersebut.",
      count: created,
      date: dateParam,
    });
  } catch (error: any) {
    console.error("Finalize Alpha Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Terjadi kesalahan saat finalisasi alfa." },
      { status: 500 }
    );
  }
}