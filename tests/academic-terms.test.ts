import { describe, it, expect } from "vitest";

describe("Logika Penghapusan Tahun Ajaran & Semester (Academic Terms & Years)", () => {
  interface Term {
    id: string;
    name: string;
    isActive: boolean;
    _count: {
      attendances: number;
      enrollments: number;
    };
  }

  interface AcademicYear {
    id: string;
    name: string;
    isActive: boolean;
    terms: Term[];
  }

  function validateDeleteAcademicYear(
    role: string,
    ay: AcademicYear | null
  ): { canDelete: boolean; error?: string } {
    if (role !== "SUPERADMIN" && role !== "ADMIN") {
      return { canDelete: false, error: "Akses ditolak. Hanya Staf TU (Admin) & Super Admin." };
    }
    if (!ay) {
      return { canDelete: false, error: "Tahun ajaran tidak ditemukan." };
    }
    if (ay.isActive) {
      return {
        canDelete: false,
        error: `Tahun ajaran ${ay.name} sedang aktif dan tidak dapat dihapus. Silakan aktifkan tahun ajaran lain terlebih dahulu jika ingin menghapusnya.`,
      };
    }
    const totalAttendances = ay.terms.reduce(
      (sum, t) => sum + (t._count?.attendances || 0),
      0
    );
    if (totalAttendances > 0) {
      return {
        canDelete: false,
        error: `Tahun ajaran ${ay.name} tidak dapat dihapus karena masih memiliki ${totalAttendances} catatan presensi siswa.`,
      };
    }
    return { canDelete: true };
  }

  function validateDeleteTerm(
    role: string,
    term: Term | null
  ): { canDelete: boolean; error?: string } {
    if (role !== "SUPERADMIN" && role !== "ADMIN") {
      return { canDelete: false, error: "Akses ditolak. Hanya Staf TU (Admin) & Super Admin." };
    }
    if (!term) {
      return { canDelete: false, error: "Semester tidak ditemukan." };
    }
    if (term.isActive) {
      return { canDelete: false, error: `Semester ${term.name} sedang aktif dan tidak dapat dihapus.` };
    }
    if (term._count.attendances > 0) {
      return {
        canDelete: false,
        error: `Semester ${term.name} tidak dapat dihapus karena masih memiliki ${term._count.attendances} catatan presensi siswa.`,
      };
    }
    return { canDelete: true };
  }

  describe("Hak Akses (Role-Based Access Control)", () => {
    const dummyYear: AcademicYear = {
      id: "ay-1",
      name: "2027/2026",
      isActive: false,
      terms: [
        {
          id: "t-1",
          name: "Semester Ganjil 2027/2026",
          isActive: false,
          _count: { attendances: 0, enrollments: 0 },
        },
      ],
    };

    it("mengizinkan Super Admin menghapus tahun ajaran non-aktif tanpa presensi", () => {
      const res = validateDeleteAcademicYear("SUPERADMIN", dummyYear);
      expect(res.canDelete).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it("mengizinkan Staf TU (ADMIN) menghapus tahun ajaran non-aktif tanpa presensi", () => {
      const res = validateDeleteAcademicYear("ADMIN", dummyYear);
      expect(res.canDelete).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it("menolak peran Guru (GURU) saat mencoba menghapus tahun ajaran", () => {
      const res = validateDeleteAcademicYear("GURU", dummyYear);
      expect(res.canDelete).toBe(false);
      expect(res.error).toContain("Akses ditolak");
    });
  });

  describe("Aturan Validasi & Integritas Data", () => {
    it("menolak penghapusan tahun ajaran yang sedang aktif", () => {
      const activeYear: AcademicYear = {
        id: "ay-active",
        name: "2026/2027",
        isActive: true,
        terms: [],
      };
      const res = validateDeleteAcademicYear("SUPERADMIN", activeYear);
      expect(res.canDelete).toBe(false);
      expect(res.error).toContain("sedang aktif dan tidak dapat dihapus");
    });

    it("menolak penghapusan tahun ajaran yang memiliki catatan presensi siswa", () => {
      const yearWithAttendances: AcademicYear = {
        id: "ay-used",
        name: "2025/2026",
        isActive: false,
        terms: [
          {
            id: "t-used",
            name: "Semester Genap 2025/2026",
            isActive: false,
            _count: { attendances: 25, enrollments: 100 },
          },
        ],
      };
      const res = validateDeleteAcademicYear("ADMIN", yearWithAttendances);
      expect(res.canDelete).toBe(false);
      expect(res.error).toContain("masih memiliki 25 catatan presensi siswa");
    });

    it("mengizinkan penghapusan tahun ajaran salah input (misal: 2027/2026 dengan 0 presensi)", () => {
      const mistypedYear: AcademicYear = {
        id: "ay-mistype",
        name: "2027/2026",
        isActive: false,
        terms: [
          {
            id: "t-mistype",
            name: "Semester Ganjil 2027/2026",
            isActive: false,
            _count: { attendances: 0, enrollments: 0 },
          },
        ],
      };
      const res = validateDeleteAcademicYear("ADMIN", mistypedYear);
      expect(res.canDelete).toBe(true);
    });

    it("menolak penghapusan semester yang aktif", () => {
      const activeTerm: Term = {
        id: "t-active",
        name: "Semester Ganjil 2026/2027",
        isActive: true,
        _count: { attendances: 0, enrollments: 0 },
      };
      const res = validateDeleteTerm("SUPERADMIN", activeTerm);
      expect(res.canDelete).toBe(false);
      expect(res.error).toContain("sedang aktif dan tidak dapat dihapus");
    });

    it("menolak penghapusan semester yang memiliki catatan presensi", () => {
      const termWithAttendances: Term = {
        id: "t-att",
        name: "Semester Genap 2024/2025",
        isActive: false,
        _count: { attendances: 120, enrollments: 300 },
      };
      const res = validateDeleteTerm("ADMIN", termWithAttendances);
      expect(res.canDelete).toBe(false);
      expect(res.error).toContain("masih memiliki 120 catatan presensi siswa");
    });

    it("mengizinkan penghapusan semester non-aktif dengan 0 catatan presensi", () => {
      const emptyTerm: Term = {
        id: "t-empty",
        name: "Semester Ganjil 2027/2026",
        isActive: false,
        _count: { attendances: 0, enrollments: 0 },
      };
      const res = validateDeleteTerm("ADMIN", emptyTerm);
      expect(res.canDelete).toBe(true);
    });
  });
});
