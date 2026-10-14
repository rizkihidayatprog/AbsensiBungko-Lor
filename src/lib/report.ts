export type ReportType = "HARIAN" | "MINGGUAN" | "BULANAN" | "SEMESTER";

export type AbsensiRecord = {
  id: string;
  studentId: string;
  attendanceDate: Date;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  status: "HADIR" | "TERLAMBAT" | "IZIN" | "SAKIT" | "ALFA";
  lateMinutes: number;
  notes: string | null;
};

export type HariEfektif = {
  date: Date;
  iso: string;
  isHoliday: boolean;
  holidayDescription?: string;
};

export const NAMA_HARI = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

export const NAMA_HARI_SINGKAT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

/**
 * Ubah tanggal UTC-midnight menjadi tanggal kalender lokal (Asia/Jakarta).
 * Data @db.Date dari Prisma disimpan sebagai UTC midnight, namun hari kneelnya
 * harus dibaca menurut kalender lokal sekolah.
 */
export function toLocalDate(d: Date): Date {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(d);
  return new Date(`${iso}T00:00:00.000Z`);
}

export function toIso(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

export function startOfWeek(d: Date): Date {
  const local = toLocalDate(d);
  const day = local.getUTCDay(); // 0=Minggu ... 6=Sabtu
  const diff = day === 0 ? -6 : 1 - day; // minggu dimulai Senin
  return addDays(local, diff);
}

export function startOfMonth(d: Date): Date {
  const local = toLocalDate(d);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1, 0, 0, 0, 0)
  );
}

export function endOfMonth(d: Date): Date {
  const local = toLocalDate(d);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0, 0, 0, 0, 0)
  );
}

/**
 * Daftar seluruh hari efektif (hari belajar) dalam rentang [start, end].
 * Sebuah hari dianggap efektif bila:
 *  - nomornya termasuk SchoolSetting.activeDays (1=Senin ... 7=Minggu), dan
 *  - tidak terdaftar pada tabel Holiday.
 */
export function hitungHariEfektif(
  start: Date,
  end: Date,
  activeDays: string,
  holidayDates: Set<string>
): HariEfektif[] {
  const aktif = new Set(
    (activeDays || "1,2,3,4,5")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const results: HariEfektif[] = [];

  let cursor = toLocalDate(start);
  const stop = toLocalDate(end);

  while (cursor.getTime() <= stop.getTime()) {
    const iso = toIso(cursor);
    const hariKe = String(cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay());
    if (aktif.has(hariKe)) {
      results.push({
        date: cursor,
        iso,
        isHoliday: holidayDates.has(iso),
      });
    }
    cursor = addDays(cursor, 1);
  }

  return results;
}

/**
 * Kolom matriks mingguan: hanya hari efektif milik pekan tersebut
 * (mengikuti pengaturan activeDays). Hari libur ditandai "L".
 */
export function kolomMatriksMingguan(
  hariEfektif: HariEfektif[]
): HariEfektif[] {
  return hariEfektif;
}

/** Pemetaan status presensi ke kode huruf pada laporan. TERLAMBAT dihitung sebagai Hadir. */
export function kodeStatus(status: AbsensiRecord["status"]): "H" | "S" | "I" | "A" {
  switch (status) {
    case "HADIR":
    case "TERLAMBAT":
      return "H";
    case "SAKIT":
      return "S";
    case "IZIN":
      return "I";
    case "ALFA":
    default:
      return "A";
  }
}

export function labelStatus(status: AbsensiRecord["status"]): string {
  switch (status) {
    case "HADIR":
      return "Hadir";
    case "TERLAMBAT":
      return "Hadir";
    case "SAKIT":
      return "Sakit";
    case "IZIN":
      return "Izin";
    case "ALFA":
    default:
      return "Alpa";
  }
}

export type Hitungan = {
  H: number;
  S: number;
  I: number;
  A: number;
  total: number;
};

export function hitungKosong(): Hitungan {
  return { H: 0, S: 0, I: 0, A: 0, total: 0 };
}

export function tambahHitungan(h: Hitungan, kode: "H" | "S" | "I" | "A") {
  h[kode] += 1;
  h.total += 1;
}

/** Persentase kehadiran = jumlah Hadir / jumlah hari efektif × 100. */
export function persentaseKehadiran(hadir: number, hariEfektif: number): number {
  if (hariEfektif <= 0) return 0;
  return (hadir / hariEfektif) * 100;
}

export function formatPersen(n: number): string {
  return `${n.toFixed(1).replace(".", ",")}%`;
}

export type AmbangNilai = {
  gradeExcellentMin: number;
  gradeGoodMin: number;
  gradeWarningMin: number;
  gradeCallParentMin: number;
  semesterEligibleMin: number;
};

/** Label rekomendasi untuk laporan bulanan berdasarkan ambang di pengaturan. */
export function labelRekomendasi(persen: number, ambang: AmbangNilai): string {
  if (persen >= ambang.gradeExcellentMin) return "Sangat Baik";
  if (persen >= ambang.gradeGoodMin) return "Baik";
  if (persen >= ambang.gradeWarningMin) return "Teguran Lisan Wali Kelas";
  if (persen >= ambang.gradeCallParentMin) return "Peringatan / Panggil Orang Tua";
  return "Tindakan Khusus (Konfirmasi Wali Kelas)";
}

/** Status kelayakan mengikuti ujian akhir semester. */
export function labelKelayakan(persen: number, ambang: AmbangNilai): string {
  return persen >= ambang.semesterEligibleMin
    ? "Layak"
    : "Tidak Layak (Butuh Tugas Sanksi)";
}

/** Keterangan otomatis pada laporan harian. */
export function keteranganHarian(
  record: AbsensiRecord | undefined,
  lockTime: string,
  isPast: boolean
): string {
  if (!record) {
    return isPast
      ? "Tidak ada konfirmasi kehadiran"
      : "Belum ada data (hari ini belum selesai)";
  }
  if (record.status === "TERLAMBAT") {
    return `Terlambat ${record.lateMinutes} menit (batas ${lockTime})`;
  }
  if (record.status === "HADIR") {
    return "Datang tepat waktu";
  }
  return record.notes || "-";
}
