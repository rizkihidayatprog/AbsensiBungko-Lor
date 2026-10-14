import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getTodayDate } from "@/lib/date";
import { checkRateLimit, getClientIp, formatRetryAfter } from "@/lib/rate-limit";
import { notifyParentAttendance } from "@/lib/whatsapp";

const SCAN_RATE_LIMIT = {
  bucket: "scan",
  limit: 300,
  windowMs: 60 * 1000,
};

// In-Memory cache (TTL 60 detik) untuk memangkas latency kueri berulang pada pemindaian massal
let cachedSettings: any = null;
let cachedSettingsTime = 0;
let cachedActiveTerm: any = null;
let cachedActiveTermTime = 0;
const cachedHolidays = new Map<string, { holiday: any; cachedAt: number }>();

async function getCachedSchoolSettings() {
  const now = Date.now();
  if (cachedSettings && now - cachedSettingsTime < 60000) {
    return cachedSettings;
  }
  cachedSettings = await prisma.schoolSetting.findFirst({ where: { id: 1 } });
  cachedSettingsTime = now;
  return cachedSettings;
}

async function getCachedActiveTerm() {
  const now = Date.now();
  if (cachedActiveTerm && now - cachedActiveTermTime < 60000) {
    return cachedActiveTerm;
  }
  cachedActiveTerm = await prisma.academicTerm.findFirst({ where: { isActive: true } });
  cachedActiveTermTime = now;
  return cachedActiveTerm;
}

async function getCachedHoliday(date: Date) {
  const now = Date.now();
  const dateKey = date.toISOString().split("T")[0];
  const cached = cachedHolidays.get(dateKey);
  if (cached && now - cached.cachedAt < 60000) {
    return cached.holiday;
  }
  const holiday = await prisma.holiday.findUnique({ where: { date } });
  cachedHolidays.set(dateKey, { holiday, cachedAt: now });
  return holiday;
}

function extractTokenCandidates(input: string): string[] {
  const candidates = new Set<string>();
  const cleanInput = input.replace(/[\r\n\t]/g, "").trim();
  if (!cleanInput) return [];

  candidates.add(cleanInput);

  // 1. Jika Code 39 berawalan dan berakhiran tanda bintang: *20261001* -> 20261001
  if (cleanInput.startsWith("*") && cleanInput.endsWith("*") && cleanInput.length > 2) {
    candidates.add(cleanInput.slice(1, -1).trim());
  }

  // 2. Jika payload berupa format JSON (misal: {"nis":"20261001"} atau {"token":"..."})
  if (cleanInput.startsWith("{") && cleanInput.endsWith("}")) {
    try {
      const parsed = JSON.parse(cleanInput);
      if (parsed && typeof parsed === "object") {
        for (const key of ["qrToken", "token", "nis", "nisn", "nip", "id", "code"]) {
          if (parsed[key] !== undefined && parsed[key] !== null) {
            candidates.add(String(parsed[key]).trim());
          }
        }
      }
    } catch {}
  }

  // 3. Jika payload berupa URL (misal: https://absensi.../scan?nis=20261001)
  if (cleanInput.startsWith("http://") || cleanInput.startsWith("https://")) {
    try {
      const url = new URL(cleanInput);
      for (const param of ["token", "qrToken", "nis", "nisn", "nip", "id", "code"]) {
        const val = url.searchParams.get(param);
        if (val) candidates.add(val.trim());
      }
      const pathParts = url.pathname.split("/").filter(Boolean);
      if (pathParts.length > 0) {
        candidates.add(pathParts[pathParts.length - 1].trim());
      }
    } catch {}
  }

  return Array.from(candidates).filter((c) => c.length > 0);
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json(
        { success: false, condition: "DITOLAK", message: "Sesi tidak valid. Silakan login kembali." },
        { status: 401 }
      );
    }

    const rate = await checkRateLimit(getClientIp(req), SCAN_RATE_LIMIT);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          condition: "DITOLAK",
          message: `Terlalu banyak permintaan pemindaian. Coba lagi dalam ${formatRetryAfter(rate.retryAfterMs)}.`,
        },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) } }
      );
    }

    const body = await req.json();
    const { qrToken, mode = "IN" } = body; // mode: "IN" (Masuk) atau "OUT" (Pulang)

    if (!qrToken || typeof qrToken !== "string") {
      return NextResponse.json(
        { success: false, condition: "DITOLAK", message: "Token QR / Barcode tidak valid." },
        { status: 400 }
      );
    }

    const candidates = extractTokenCandidates(qrToken);
    if (candidates.length === 0) {
      return NextResponse.json(
        { success: false, condition: "DITOLAK", message: "Token QR / Barcode kosong atau tidak terbaca." },
        { status: 400 }
      );
    }

    const now = new Date();
    const today = getTodayDate(now);

    // Ambil Pengaturan Sekolah, Hari Libur & Semester Aktif serentak dari cache super cepat
    const [holiday, settings, activeTerm] = await Promise.all([
      getCachedHoliday(today),
      getCachedSchoolSettings(),
      getCachedActiveTerm(),
    ]);

    // 1. Cek Hari Libur
    if (holiday) {
      return NextResponse.json({
        success: false,
        condition: "DITOLAK",
        message: `Hari ini libur: ${holiday.description}. Presensi tidak dapat diproses.`,
      });
    }

    const checkInEnd = settings?.checkInEnd || "07:15"; // HH:mm batas tepat waktu
    const checkOutEnabled = settings?.checkOutEnabled !== false;

    // 1b. Jika sesi pulang dinonaktifkan di pengaturan sekolah, tolak mode Pulang
    if (mode === "OUT" && !checkOutEnabled) {
      return NextResponse.json({
        success: false,
        condition: "DITOLAK",
        message:
          "Sesi presensi pulang dinonaktifkan pada pengaturan sekolah. Silakan hubungi admin sekolah.",
      });
    }

    // 2. Cari Siswa berdasarkan token QR, NIS, NISN, atau ID
    const student = await prisma.student.findFirst({
      where: {
        OR: [
          { qrTokenHash: { in: candidates } },
          { nis: { in: candidates } },
          { nisn: { in: candidates } },
          { id: { in: candidates } },
        ],
      },
      include: {
        class: { select: { id: true, name: true } },
      },
    });

    if (student) {
      if (!student.isActive) {
        return NextResponse.json({
          success: false,
          condition: "DITOLAK",
          message: `Siswa ${student.name} berstatus nonaktif.`,
        });
      }

      // Cek presensi siswa hari ini
      const existing = await prisma.studentAttendance.findUnique({
        where: {
          studentId_attendanceDate: {
            studentId: student.id,
            attendanceDate: today,
          },
        },
      });

      if (mode === "IN") {
        if (existing && existing.checkInAt) {
          const jamMasuk = new Date(existing.checkInAt).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          return NextResponse.json({
            success: false,
            condition: "SUDAH_TERCATAT",
            message: `Presensi masuk untuk ${student.name} sudah tercatat pukul ${jamMasuk} WIB.`,
            data: {
              name: student.name,
              nis: student.nis,
              nisn: student.nisn || undefined,
              gender: student.gender,
              class: student.class.name,
              status: existing.status,
              time: jamMasuk,
              semester: activeTerm?.name,
              photoUrl: student.photoUrl || undefined,
              type: "SISWA",
            },
          });
        }

        // Hitung Keterlambatan
        const [endHour, endMinute] = checkInEnd.split(":").map(Number);
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        const currentTotalMinutes = currentHour * 60 + currentMinute;
        const limitTotalMinutes = endHour * 60 + endMinute;

        const isLate = currentTotalMinutes > limitTotalMinutes;
        const lateMinutes = isLate ? currentTotalMinutes - limitTotalMinutes : 0;
        const status = isLate ? "TERLAMBAT" : "HADIR";

        const attendance = await prisma.studentAttendance.upsert({
          where: {
            studentId_attendanceDate: {
              studentId: student.id,
              attendanceDate: today,
            },
          },
          update: {
            checkInAt: now,
            status,
            lateMinutes,
            createdById: sessionUser.id,
            ...(activeTerm ? { academicTermId: activeTerm.id } : {}),
            ...(student.classId ? { classId: student.classId } : {}),
          },
          create: {
            studentId: student.id,
            classId: student.classId,
            attendanceDate: today,
            academicTermId: activeTerm?.id || null,
            checkInAt: now,
            status,
            lateMinutes,
            createdById: sessionUser.id,
          },
        });

        // Audit Log dicatat di latar belakang (tidak menahan respons scanner)
        void logAudit({
          actorId: sessionUser.id,
          action: "SCAN_CHECK_IN_STUDENT",
          entityType: "StudentAttendance",
          entityId: attendance.id,
          newValues: { studentName: student.name, nis: student.nis, status, lateMinutes },
        });

        // Kirim Notifikasi WhatsApp ke Orang Tua di latar belakang
        void notifyParentAttendance({
          studentId: student.id,
          studentName: student.name,
          className: student.class.name,
          parentName: student.parentName,
          parentPhone: student.parentPhone,
          status: status as "HADIR" | "TERLAMBAT",
          checkInTime: `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`,
          lateMinutes,
        });

        return NextResponse.json({
          success: true,
          condition: "BERHASIL",
          message: `Presensi masuk berhasil dicatat. Status: ${status === "HADIR" ? "Tepat Waktu" : `Terlambat ${lateMinutes} menit`}`,
          data: {
            name: student.name,
            nis: student.nis,
            nisn: student.nisn || undefined,
            gender: student.gender,
            class: student.class.name,
            status,
            lateMinutes,
            time: now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            type: "SISWA",
            semester: activeTerm?.name,
            photoUrl: student.photoUrl || undefined,
          },
        });
      } else {
        // Mode Pulang ("OUT")
        if (existing && existing.checkOutAt) {
          const jamPulang = new Date(existing.checkOutAt).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          return NextResponse.json({
            success: false,
            condition: "SUDAH_TERCATAT",
            message: `Presensi pulang untuk ${student.name} sudah tercatat pukul ${jamPulang} WIB.`,
            data: {
              name: student.name,
              nis: student.nis,
              nisn: student.nisn || undefined,
              gender: student.gender,
              class: student.class.name,
              status: existing.status,
              time: jamPulang,
              semester: activeTerm?.name,
              photoUrl: student.photoUrl || undefined,
              type: "SISWA",
            },
          });
        }

        const attendance = await prisma.studentAttendance.upsert({
          where: {
            studentId_attendanceDate: {
              studentId: student.id,
              attendanceDate: today,
            },
          },
          update: {
            checkOutAt: now,
            ...(activeTerm ? { academicTermId: activeTerm.id } : {}),
            ...(student.classId ? { classId: student.classId } : {}),
          },
          create: {
            studentId: student.id,
            classId: student.classId,
            attendanceDate: today,
            academicTermId: activeTerm?.id || null,
            checkOutAt: now,
            status: "HADIR",
            createdById: sessionUser.id,
          },
        });

        await logAudit({
          actorId: sessionUser.id,
          action: "SCAN_CHECK_OUT_STUDENT",
          entityType: "StudentAttendance",
          entityId: attendance.id,
          newValues: { studentName: student.name, nis: student.nis, checkOutAt: now },
        });

        return NextResponse.json({
          success: true,
          condition: "BERHASIL",
          message: `Presensi pulang untuk ${student.name} berhasil dicatat.`,
          data: {
            name: student.name,
            nis: student.nis,
            nisn: student.nisn || undefined,
            gender: student.gender,
            class: student.class.name,
            status: attendance.status,
            time: now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            type: "SISWA",
            semester: activeTerm?.name,
            photoUrl: student.photoUrl || undefined,
          },
        });
      }
    }

    // 3. Jika bukan siswa, Cari Guru berdasarkan token QR, NIP, atau ID
    const teacher = await prisma.teacher.findFirst({
      where: {
        OR: [
          { qrTokenHash: { in: candidates } },
          { nip: { in: candidates } },
          { id: { in: candidates } },
        ],
      },
    });

    if (teacher) {
      if (!teacher.isActive) {
        return NextResponse.json({
          success: false,
          condition: "DITOLAK",
          message: `Guru ${teacher.name} berstatus nonaktif.`,
        });
      }

      const existingTeacherAtt = await prisma.teacherAttendance.findUnique({
        where: {
          teacherId_attendanceDate: {
            teacherId: teacher.id,
            attendanceDate: today,
          },
        },
      });

      if (mode === "IN") {
        if (existingTeacherAtt && existingTeacherAtt.checkInAt) {
          const jamMasuk = new Date(existingTeacherAtt.checkInAt).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          });
          return NextResponse.json({
            success: false,
            condition: "SUDAH_TERCATAT",
            message: `Presensi masuk guru ${teacher.name} sudah tercatat pukul ${jamMasuk} WIB.`,
          });
        }

        await prisma.teacherAttendance.upsert({
          where: {
            teacherId_attendanceDate: {
              teacherId: teacher.id,
              attendanceDate: today,
            },
          },
          update: { checkInAt: now, status: "HADIR", createdById: sessionUser.id },
          create: {
            teacherId: teacher.id,
            attendanceDate: today,
            checkInAt: now,
            status: "HADIR",
            createdById: sessionUser.id,
          },
        });

        return NextResponse.json({
          success: true,
          condition: "BERHASIL",
          message: `Presensi kehadiran guru ${teacher.name} berhasil dicatat.`,
          data: {
            name: teacher.name,
            nip: teacher.nip || "-",
            class: "Tenaga Pendidik (Guru)",
            status: "HADIR",
            time: now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
            type: "GURU",
          },
        });
      } else {
        // Mode Pulang Guru
        await prisma.teacherAttendance.upsert({
          where: {
            teacherId_attendanceDate: {
              teacherId: teacher.id,
              attendanceDate: today,
            },
          },
          update: { checkOutAt: now },
          create: {
            teacherId: teacher.id,
            attendanceDate: today,
            checkOutAt: now,
            status: "HADIR",
            createdById: sessionUser.id,
          },
        });

        return NextResponse.json({
          success: true,
          condition: "BERHASIL",
          message: `Presensi kepulangan guru ${teacher.name} berhasil dicatat.`,
          data: {
            name: teacher.name,
            nip: teacher.nip || "-",
            class: "Tenaga Pendidik (Guru)",
            status: "HADIR",
            time: now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
            type: "GURU",
          },
        });
      }
    }

    // 4. Token tidak cocok dengan Siswa maupun Guru
    return NextResponse.json({
      success: false,
      condition: "DITOLAK",
      message: "Barcode / QR Code tidak dikenali atau tidak terdaftar dalam database sekolah.",
    });
  } catch (error) {
    console.error("Attendance Scan Error:", error);
    return NextResponse.json(
      { success: false, condition: "DITOLAK", message: "Terjadi kesalahan sistem saat memproses presensi." },
      { status: 500 }
    );
  }
}
