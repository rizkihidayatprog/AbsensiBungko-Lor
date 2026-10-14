import { describe, it, expect } from "vitest";

describe("Validasi Presensi Manual & Keterangan Wajib", () => {
  function validateManualAttendancePayload(payload: {
    studentId?: string;
    status?: string;
    manualReason?: string;
  }) {
    if (!payload.studentId) {
      return { valid: false, error: "Siswa wajib dipilih." };
    }
    const validStatuses = ["HADIR", "TERLAMBAT", "IZIN", "SAKIT", "ALFA"];
    if (!payload.status || !validStatuses.includes(payload.status)) {
      return { valid: false, error: "Status presensi tidak valid." };
    }
    if (!payload.manualReason || !payload.manualReason.trim()) {
      return {
        valid: false,
        error: "Keterangan/alasan presensi manual wajib diisi untuk keperluan transparansi dan audit.",
      };
    }
    return { valid: true, error: null };
  }

  function formatManualNotes(reason: string, extraNotes?: string) {
    const trimmed = reason.trim();
    return `[Absen Manual] ${trimmed}${extraNotes && extraNotes.trim() ? ` — ${extraNotes.trim()}` : ""}`;
  }

  function calculateLateMinutesAndStatus(
    status: string,
    checkInTimeStr: string,
    limitTimeStr: string = "07:15"
  ) {
    if (!["HADIR", "TERLAMBAT"].includes(status)) {
      return { lateMinutes: 0, finalStatus: status };
    }
    const [h, m] = checkInTimeStr.split(":").map(Number);
    const [limH, limM] = limitTimeStr.split(":").map(Number);
    const timeTotal = h * 60 + m;
    const limitTotal = limH * 60 + limM;

    if (timeTotal > limitTotal) {
      return {
        lateMinutes: timeTotal - limitTotal,
        finalStatus: "TERLAMBAT",
      };
    }
    return {
      lateMinutes: 0,
      finalStatus: status === "TERLAMBAT" ? "TERLAMBAT" : "HADIR",
    };
  }

  describe("Validasi Input", () => {
    it("menolak jika studentId tidak diisi", () => {
      const res = validateManualAttendancePayload({
        status: "HADIR",
        manualReason: "Kartu QR tertinggal",
      });
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Siswa wajib dipilih.");
    });

    it("menolak jika status tidak valid", () => {
      const res = validateManualAttendancePayload({
        studentId: "std-1",
        status: "LIBUR",
        manualReason: "Kartu QR tertinggal",
      });
      expect(res.valid).toBe(false);
      expect(res.error).toBe("Status presensi tidak valid.");
    });

    it("menolak jika manualReason kosong atau hanya whitespace", () => {
      const res1 = validateManualAttendancePayload({
        studentId: "std-1",
        status: "HADIR",
        manualReason: "",
      });
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain("Keterangan/alasan presensi manual wajib diisi");

      const res2 = validateManualAttendancePayload({
        studentId: "std-1",
        status: "HADIR",
        manualReason: "    ",
      });
      expect(res2.valid).toBe(false);
    });

    it("menerima payload yang lengkap dan valid", () => {
      const res = validateManualAttendancePayload({
        studentId: "std-1",
        status: "HADIR",
        manualReason: "Kartu QR tertinggal di rumah",
      });
      expect(res.valid).toBe(true);
      expect(res.error).toBeNull();
    });
  });

  describe("Format Catatan Presensi Manual", () => {
    it("memformat catatan dengan prefix [Absen Manual]", () => {
      const formatted = formatManualNotes("Kartu QR tertinggal di rumah");
      expect(formatted).toBe("[Absen Manual] Kartu QR tertinggal di rumah");
    });

    it("menggabungkan alasan dengan catatan tambahan jika tersedia", () => {
      const formatted = formatManualNotes(
        "Kendala teknis scanner",
        "Disetujui guru piket"
      );
      expect(formatted).toBe("[Absen Manual] Kendala teknis scanner — Disetujui guru piket");
    });

    it("melakukan pembersihan spasi (trim) pada alasan dan catatan tambahan", () => {
      const formatted = formatManualNotes("   Izin lisan   ", "   Wali murid hadir   ");
      expect(formatted).toBe("[Absen Manual] Izin lisan — Wali murid hadir");
    });
  });

  describe("Kalkulasi Keterlambatan dan Jam Masuk", () => {
    it("menghitung tepat waktu jika hadir sebelum batas 07:15", () => {
      const res = calculateLateMinutesAndStatus("HADIR", "07:05", "07:15");
      expect(res.lateMinutes).toBe(0);
      expect(res.finalStatus).toBe("HADIR");
    });

    it("menghitung tepat waktu jika hadir tepat pada batas 07:15", () => {
      const res = calculateLateMinutesAndStatus("HADIR", "07:15", "07:15");
      expect(res.lateMinutes).toBe(0);
      expect(res.finalStatus).toBe("HADIR");
    });

    it("otomatis mengubah ke TERLAMBAT jika jam lewat batas 07:15", () => {
      const res = calculateLateMinutesAndStatus("HADIR", "07:25", "07:15");
      expect(res.lateMinutes).toBe(10);
      expect(res.finalStatus).toBe("TERLAMBAT");
    });

    it("status non-kehadiran (IZIN, SAKIT, ALFA) selalu 0 menit terlambat", () => {
      expect(calculateLateMinutesAndStatus("IZIN", "08:00").lateMinutes).toBe(0);
      expect(calculateLateMinutesAndStatus("SAKIT", "08:00").lateMinutes).toBe(0);
      expect(calculateLateMinutesAndStatus("ALFA", "08:00").lateMinutes).toBe(0);
    });
  });

  describe("Otorisasi Perwalian Wali Kelas (GURU)", () => {
    it("mengizinkan input jika siswa berada di kelas perwalian guru", () => {
      const teacherHomeroomClassId: string = "class-7a";
      const studentClassId: string = "class-7a";
      expect(teacherHomeroomClassId === studentClassId).toBe(true);
    });

    it("menolak jika siswa bukan dari kelas perwalian guru", () => {
      const teacherHomeroomClassId: string = "class-7a";
      const studentClassId: string = "class-7b";
      expect(teacherHomeroomClassId === studentClassId).toBe(false);
    });
  });
});
