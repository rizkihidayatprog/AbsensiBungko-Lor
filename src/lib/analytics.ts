import prisma from "./prisma";
import { addDays, hitungHariEfektif, toIso, toLocalDate } from "./report";
import { getTodayDate } from "./date";

/**
 * Analitik dashboard:
 *  1. Alfa beruntun  — siswa tanpa presensi pada N hari efektif berturut-turut
 *  2. Rekap keterlambatan — akumulasi menit keterlambatan per siswa pada periode
 */

export const ALFA_BERUNTUN_MIN_HARI = 3;
export const REKAP_TELAMBAT_MIN_MENIT = 30;

export type AlfaBeruntun = {
  studentId: string;
  classId: string | null;
  nis: string;
  name: string;
  className: string;
  /** Jumlah hari efektif berturut-turut tanpa keterangan. */
  hari: number;
  /** Tanggal awal rentang alfa (YYYY-MM-DD). */
  sejak: string;
};

export type RekapKeterlambatan = {
  studentId: string;
  nis: string;
  name: string;
  className: string;
  totalMenit: number;
  jumlahTerlambat: number;
};

/** Status yang dianggap "ada keterangan", sehingga tidak dihitung sebagai alfa. */
const ADA_KETERANGAN = new Set(["HADIR", "TERLAMBAT", "IZIN", "SAKIT"]);

function parseActiveDays(activeDays?: string | null): Set<string> {
  return new Set(
    (activeDays || "1,2,3,4,5")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/**
 * Cari siswa yang tidak memiliki catatan kehadiran (dan tidak ada izin/sakit
 * disetujui) selama >= minHari hari efektif berturut-turut, dihitung mundur dari
 * hari efektif terakhir yang sudah selesai.
 *
 * `sampaiTanggal` dibiarkan opsional agar mudah diuji.
 */
export async function getAlfaBeruntun(
  minHari: number = ALFA_BERUNTUN_MIN_HARI,
  sampaiTanggal: Date = getTodayDate(),
  classId?: string | null
): Promise<AlfaBeruntun[]> {
  const settings = await prisma.schoolSetting.findFirst({ where: { id: 1 } });
  const holidays = await prisma.holiday.findMany({ select: { date: true } });
  const holidayDates = new Set(holidays.map((h) => toIso(toLocalDate(h.date))));

  // Jendela pemeriksaan: 30 hari ke belakang, dilewati hari libur & hari non-aktif.
  const mulai = addDays(sampaiTanggal, -30);
  const hariEfektif = hitungHariEfektif(
    mulai,
    sampaiTanggal,
    settings?.activeDays || "1,2,3,4,5",
    holidayDates
  ).filter((h) => !h.isHoliday);

  if (hariEfektif.length === 0) return [];

  // Hanya hari efektif yang SUDAH lewat (terlalu dini untuk-alpha hari ini).
  const sampaiIso = toIso(sampaiTanggal);
  const hariDipakai = hariEfektif.filter((h) => h.iso < sampaiIso);
  if (hariDipakai.length < minHari) return [];

  const tanggalDipakai = hariDipakai.map((h) => h.date);

  const [students, attendances, disetujui] = await Promise.all([
    prisma.student.findMany({
      where: { isActive: true, ...(classId ? { classId } : {}) },
      include: { class: true },
      orderBy: { name: "asc" },
    }),
    prisma.studentAttendance.findMany({
      where: { attendanceDate: { in: tanggalDipakai } },
      select: { studentId: true, attendanceDate: true, status: true },
    }),
    prisma.leaveRequest.findMany({
      where: { status: "DISETUJUI" },
      select: { studentId: true, startDate: true, endDate: true },
    }),
  ]);

  // Keterangan per siswa per tanggal
  const sudahAda = new Set<string>();
  for (const a of attendances) {
    if (ADA_KETERANGAN.has(a.status)) {
      sudahAda.add(`${a.studentId}|${toIso(toLocalDate(a.attendanceDate))}`);
    }
  }
  for (const l of disetujui) {
    const s = toLocalDate(l.startDate);
    const e = toLocalDate(l.endDate);
    for (let d = s; d.getTime() <= e.getTime(); d = addDays(d, 1)) {
      sudahAda.add(`${l.studentId}|${toIso(d)}`);
    }
  }

  // Jalan mundur dari hari efektif terakhir; hentikan saat ada keterangan.
  const results: AlfaBeruntun[] = [];
  for (const student of students) {
    let beruntun = 0;
    let sejak = "";
    for (let i = hariDipakai.length - 1; i >= 0; i--) {
      const iso = hariDipakai[i].iso;
      if (sudahAda.has(`${student.id}|${iso}`)) break;
      beruntun += 1;
      sejak = iso;
    }
    if (beruntun >= minHari) {
      results.push({
        studentId: student.id,
        classId: student.classId,
        nis: student.nis,
        name: student.name,
        className: student.class?.name || "-",
        hari: beruntun,
        sejak,
      });
    }
  }

  return results.sort((a, b) => b.hari - a.hari || a.name.localeCompare(b.name));
}

/**
 * Rekap keterlambatan: total menit keterlambatan per siswa pada periode,
 * termasukAkumulasi terlambat di luar ambang agar terlihat sebagai "{{n}} menit".
 */
export async function getRekapKeterlambatan(
  dari: Date,
  sampai: Date,
  minMenit: number = REKAP_TELAMBAT_MIN_MENIT,
  classId?: string | null
): Promise<RekapKeterlambatan[]> {
  const rows = await prisma.studentAttendance.findMany({
    where: {
      attendanceDate: { gte: dari, lte: sampai },
      status: "TERLAMBAT",
      ...(classId ? { student: { classId } } : {}),
    },
    select: {
      lateMinutes: true,
      student: { select: { id: true, nis: true, name: true, class: { select: { name: true } } } },
    },
  });

  const map = new Map<string, RekapKeterlambatan>();
  for (const r of rows) {
    const entry = map.get(r.student.id) ?? {
      studentId: r.student.id,
      nis: r.student.nis,
      name: r.student.name,
      className: r.student.class?.name || "-",
      totalMenit: 0,
      jumlahTerlambat: 0,
    };
    entry.totalMenit += r.lateMinutes || 0;
    entry.jumlahTerlambat += 1;
    map.set(r.student.id, entry);
  }

  return Array.from(map.values())
    .filter((e) => e.totalMenit >= minMenit)
    .sort((a, b) => b.totalMenit - a.totalMenit);
}

/** Helper test: menentukan daftar hari efektif yang dipakai. */
export function hariEfektifDinas(
  activeDays: string,
  holidayDates: Set<string>,
  mulai: Date,
  sampai: Date
): string[] {
  return hitungHariEfektif(mulai, sampai, activeDays, holidayDates)
    .filter((h) => !h.isHoliday)
    .map((h) => h.iso);
}

export { parseActiveDays };
