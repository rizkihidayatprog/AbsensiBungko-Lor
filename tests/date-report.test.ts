import { describe, it, expect } from "vitest";
import {
  getTodayDate,
  parseLocalDate,
  formatIsoDateJakarta,
} from "@/lib/date";
import {
  toLocalDate,
  toIso,
  addDays,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  hitungHariEfektif,
  hitungKosong,
  tambahHitungan,
  persentaseKehadiran,
  formatPersen,
  kodeStatus,
  labelKelayakan,
} from "@/lib/report";

describe("formatIsoDateJakarta", () => {
  it("menggunakan tanggal WIB, bukan UTC", () => {
    // 2026-10-12T17:30Z = 2026-10-13 00:30 WIB
    const d = new Date("2026-10-12T17:30:00.000Z");
    expect(formatIsoDateJakarta(d)).toBe("2026-10-13");
  });

  it("tidak bergeser pada jam-jam kritis awal hari", () => {
    // Batas tengah malam WIB
    expect(formatIsoDateJakarta(new Date("2026-10-12T17:00:00.000Z"))).toBe("2026-10-13");
    // 23:59 WIB masih tanggal sebelumnya
    expect(formatIsoDateJakarta(new Date("2026-10-12T16:59:00.000Z"))).toBe("2026-10-12");
    // Siang WIB
    expect(formatIsoDateJakarta(new Date("2026-10-12T10:00:00.000Z"))).toBe("2026-10-12");
  });

  it("default-nya memakai waktu sekarang", () => {
    expect(formatIsoDateJakarta()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("getTodayDate / parseLocalDate", () => {
  it("menghasilkan UTC midnight agar cocok dengan kolom @db.Date", () => {
    const d = getTodayDate();
    expect(d.toISOString()).toMatch(/T00:00:00\.000Z$/);
  });

  it("parseLocalDate membalik ke UTC midnight", () => {
    const d = parseLocalDate("2026-03-15");
    expect(d.toISOString()).toBe("2026-03-15T00:00:00.000Z");
  });
});

describe("helper tanggal laporan", () => {
  it("toLocalDate mengunci ke UTC midnight WIB", () => {
    expect(toLocalDate(new Date("2026-10-12T17:30:00.000Z")).toISOString()).toBe(
      "2026-10-13T00:00:00.000Z"
    );
  });

  it("toIso mengembalikan kunci tanggal UTC-midnight apa adanya", () => {
    expect(toIso(parseLocalDate("2026-03-15"))).toBe("2026-03-15");
  });

  it("addDays menjaga hari sambil melompat bulan/tahun", () => {
    expect(toIso(addDays(parseLocalDate("2026-01-31"), 1))).toBe("2026-02-01");
    expect(toIso(addDays(parseLocalDate("2026-12-31"), 1))).toBe("2027-01-01");
    expect(toIso(addDays(parseLocalDate("2026-03-15"), -15))).toBe("2026-02-28");
  });

  it("startOfWeek mengembalikan Senin", () => {
    // 2026-10-15 adalah Kamis
    expect(toIso(startOfWeek(parseLocalDate("2026-10-15")))).toBe("2026-10-12");
  });

  it("startOfMonth & endOfMonth benar", () => {
    expect(toIso(startOfMonth(parseLocalDate("2026-10-15")))).toBe("2026-10-01");
    expect(toIso(endOfMonth(parseLocalDate("2026-10-15")))).toBe("2026-10-31");
    // Februari tahun loncat
    expect(toIso(endOfMonth(parseLocalDate("2028-02-10")))).toBe("2028-02-29");
  });
});

describe("hitungHariEfektif", () => {
  it("hanya menyertakan hari sesuai activeDays", () => {
    // 2026-10-05 (Sen) .. 2026-10-11 (Min). Active = 1..5 => 5 hari kerja.
    const hasil = hitungHariEfektif(
      parseLocalDate("2026-10-05"),
      parseLocalDate("2026-10-11"),
      "1,2,3,4,5",
      new Set()
    );
    expect(hasil).toHaveLength(5);
    expect(hasil.map((h) => h.iso)).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
    ]);
  });

  it("menandai hari libur", () => {
    const hasil = hitungHariEfektif(
      parseLocalDate("2026-10-05"),
      parseLocalDate("2026-10-07"),
      "1,2,3,4,5",
      new Set(["2026-10-06"])
    );
    const hariLibur = hasil.find((h) => h.iso === "2026-10-06");
    expect(hariLibur?.isHoliday).toBe(true);
    expect(hasil.find((h) => h.iso === "2026-10-05")?.isHoliday).toBe(false);
  });

  it("menghormati konfigurasi 6 hari kerja", () => {
    const hasil = hitungHariEfektif(
      parseLocalDate("2026-10-05"),
      parseLocalDate("2026-10-11"),
      "1,2,3,4,5,6",
      new Set()
    );
    expect(hasil).toHaveLength(6);
  });
});

describe("rekap kehadiran", () => {
  it("kodeStatus memetakan status ke kode", () => {
    expect(kodeStatus("HADIR")).toBe("H");
    expect(kodeStatus("TERLAMBAT")).toBe("H");
    expect(kodeStatus("SAKIT")).toBe("S");
    expect(kodeStatus("IZIN")).toBe("I");
    expect(kodeStatus("ALFA")).toBe("A");
  });

  it("tambahHitungan & hitungKosong menjaga total konsisten", () => {
    const h = hitungKosong();
    expect(h).toEqual({ H: 0, S: 0, I: 0, A: 0, total: 0 });
    tambahHitungan(h, "H");
    tambahHitungan(h, "H");
    tambahHitungan(h, "A");
    expect(h).toEqual({ H: 2, S: 0, I: 0, A: 1, total: 3 });
  });

  it("persentaseKehadiran aman dari pembagian nol", () => {
    expect(persentaseKehadiran(0, 0)).toBe(0);
    expect(persentaseKehadiran(9, 10)).toBe(90);
  });

  it("formatPersen memakai koma desimal gaya Indonesia", () => {
    expect(formatPersen(90)).toBe("90,0%");
    expect(formatPersen(33.33)).toBe("33,3%");
  });

  it("labelKelayakan mengikuti ambang kelayakan", () => {
    const ambang = {
      gradeExcellentMin: 95,
      gradeGoodMin: 90,
      gradeWarningMin: 80,
      gradeCallParentMin: 70,
      semesterEligibleMin: 90,
    };
    expect(labelKelayakan(92, ambang)).toBe("Layak");
    expect(labelKelayakan(89.9, ambang)).toBe("Tidak Layak (Butuh Tugas Sanksi)");
  });
});
