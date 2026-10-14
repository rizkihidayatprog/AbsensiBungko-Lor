import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { SemesterType } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const academicYears = await prisma.academicYear.findMany({
      include: {
        terms: {
          orderBy: { semester: "asc" },
          include: {
            _count: {
              select: {
                attendances: true,
                enrollments: true,
              },
            },
          },
        },
      },
      orderBy: { name: "desc" },
    });

    const activeTerm = await prisma.academicTerm.findFirst({
      where: { isActive: true },
      include: { academicYear: true },
    });

    return NextResponse.json({
      success: true,
      academicYears,
      activeTerm,
    });
  } catch (error) {
    console.error("GET Academic Terms Error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || (sessionUser.role !== "SUPERADMIN" && sessionUser.role !== "ADMIN")) {
      return NextResponse.json({ success: false, message: "Akses ditolak. Hanya Admin/Superadmin." }, { status: 403 });
    }

    const body = await req.json();
    const { yearName, semester, startDate, endDate, makeActive = false } = body;

    if (!yearName || !semester || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, message: "Tahun ajaran, semester, tanggal mulai, dan tanggal selesai wajib diisi." },
        { status: 400 }
      );
    }

    if (semester !== "GANJIL" && semester !== "GENAP") {
      return NextResponse.json({ success: false, message: "Semester harus GANJIL atau GENAP." }, { status: 400 });
    }

    // 1. Cari atau buat AcademicYear
    const academicYear = await prisma.academicYear.upsert({
      where: { name: yearName.trim() },
      update: {
        ...(makeActive ? { isActive: true } : {}),
      },
      create: {
        name: yearName.trim(),
        isActive: makeActive,
      },
    });

    if (makeActive) {
      // Nonaktifkan semester lain
      await prisma.academicTerm.updateMany({
        data: { isActive: false },
      });
      // Nonaktifkan tahun ajaran lain
      await prisma.academicYear.updateMany({
        where: { id: { not: academicYear.id } },
        data: { isActive: false },
      });
    }

    const termName = `Semester ${semester === "GANJIL" ? "Ganjil" : "Genap"} ${academicYear.name}`;

    const term = await prisma.academicTerm.upsert({
      where: {
        academicYearId_semester: {
          academicYearId: academicYear.id,
          semester: semester as SemesterType,
        },
      },
      update: {
        name: termName,
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        endDate: new Date(`${endDate}T00:00:00.000Z`),
        isActive: makeActive,
      },
      create: {
        academicYearId: academicYear.id,
        name: termName,
        semester: semester as SemesterType,
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        endDate: new Date(`${endDate}T00:00:00.000Z`),
        isActive: makeActive,
      },
    });

    await logAudit({
      actorId: sessionUser.id,
      action: "CREATE_OR_UPDATE_ACADEMIC_TERM",
      entityType: "AcademicTerm",
      entityId: term.id,
      newValues: { name: termName, year: academicYear.name, semester, makeActive },
    });

    return NextResponse.json({
      success: true,
      message: `Periode ${termName} berhasil disimpan.`,
      term,
    });
  } catch (error) {
    console.error("POST Academic Term Error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || (sessionUser.role !== "SUPERADMIN" && sessionUser.role !== "ADMIN")) {
      return NextResponse.json({ success: false, message: "Akses ditolak. Hanya Admin/Superadmin." }, { status: 403 });
    }

    const body = await req.json();
    const { termId, action = "ACTIVATE" } = body;

    if (!termId) {
      return NextResponse.json({ success: false, message: "ID Semester wajib disertakan." }, { status: 400 });
    }

    const targetTerm = await prisma.academicTerm.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });

    if (!targetTerm) {
      return NextResponse.json({ success: false, message: "Periode semester tidak ditemukan." }, { status: 404 });
    }

    if (action === "ACTIVATE") {
      // 1. Nonaktifkan semua semester dan tahun ajaran lain
      await prisma.academicTerm.updateMany({
        data: { isActive: false },
      });
      await prisma.academicYear.updateMany({
        where: { id: { not: targetTerm.academicYearId } },
        data: { isActive: false },
      });

      // 2. Aktifkan semester terpilih dan tahun ajarannya
      await prisma.academicYear.update({
        where: { id: targetTerm.academicYearId },
        data: { isActive: true },
      });

      const updated = await prisma.academicTerm.update({
        where: { id: termId },
        data: { isActive: true },
      });

      await logAudit({
        actorId: sessionUser.id,
        action: "ACTIVATE_ACADEMIC_TERM",
        entityType: "AcademicTerm",
        entityId: termId,
        newValues: { name: targetTerm.name, semester: targetTerm.semester },
      });

      return NextResponse.json({
        success: true,
        message: `${targetTerm.name} sekarang aktif sebagai periode absensi sekolah.`,
        term: updated,
      });
    } else if (action === "CLOSE") {
      const updated = await prisma.academicTerm.update({
        where: { id: termId },
        data: { isActive: false },
      });

      await logAudit({
        actorId: sessionUser.id,
        action: "CLOSE_ACADEMIC_TERM",
        entityType: "AcademicTerm",
        entityId: termId,
        newValues: { name: targetTerm.name },
      });

      return NextResponse.json({
        success: true,
        message: `${targetTerm.name} telah ditutup.`,
        term: updated,
      });
    }

    return NextResponse.json({ success: false, message: "Action tidak dikenal." }, { status: 400 });
  } catch (error) {
    console.error("PATCH Academic Term Error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || (sessionUser.role !== "SUPERADMIN" && sessionUser.role !== "ADMIN")) {
      return NextResponse.json(
        { success: false, message: "Akses ditolak. Hanya Staf TU (Admin) & Super Admin." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const academicYearId = searchParams.get("academicYearId");
    const termId = searchParams.get("termId") || searchParams.get("id");

    if (!academicYearId && !termId) {
      return NextResponse.json(
        { success: false, message: "Parameter academicYearId atau termId wajib disertakan." },
        { status: 400 }
      );
    }

    // 1. HAPUS TAHUN AJARAN LENGKAP
    if (academicYearId) {
      const academicYear = await prisma.academicYear.findUnique({
        where: { id: academicYearId },
        include: {
          terms: {
            include: {
              _count: {
                select: {
                  attendances: true,
                  enrollments: true,
                },
              },
            },
          },
        },
      });

      if (!academicYear) {
        return NextResponse.json({ success: false, message: "Tahun ajaran tidak ditemukan." }, { status: 404 });
      }

      if (academicYear.isActive) {
        return NextResponse.json(
          {
            success: false,
            message: `Tahun ajaran ${academicYear.name} sedang aktif dan tidak dapat dihapus. Silakan aktifkan tahun ajaran lain terlebih dahulu jika ingin menghapusnya.`,
          },
          { status: 400 }
        );
      }

      const totalAttendances = academicYear.terms.reduce(
        (sum, t) => sum + (t._count?.attendances || 0),
        0
      );

      if (totalAttendances > 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Tahun ajaran ${academicYear.name} tidak dapat dihapus karena masih memiliki ${totalAttendances} catatan presensi siswa.`,
          },
          { status: 400 }
        );
      }

      await prisma.academicYear.delete({
        where: { id: academicYearId },
      });

      await logAudit({
        actorId: sessionUser.id,
        action: "DELETE_ACADEMIC_YEAR",
        entityType: "AcademicYear",
        entityId: academicYearId,
        oldValues: { name: academicYear.name, termsCount: academicYear.terms.length },
      });

      return NextResponse.json({
        success: true,
        message: `Tahun Ajaran ${academicYear.name} berhasil dihapus.`,
      });
    }

    // 2. HAPUS SATU SEMESTER
    if (termId) {
      const term = await prisma.academicTerm.findUnique({
        where: { id: termId },
        include: {
          academicYear: true,
          _count: {
            select: {
              attendances: true,
              enrollments: true,
            },
          },
        },
      });

      if (!term) {
        return NextResponse.json({ success: false, message: "Semester tidak ditemukan." }, { status: 404 });
      }

      if (term.isActive) {
        return NextResponse.json(
          { success: false, message: `Semester ${term.name} sedang aktif dan tidak dapat dihapus.` },
          { status: 400 }
        );
      }

      if (term._count.attendances > 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Semester ${term.name} tidak dapat dihapus karena masih memiliki ${term._count.attendances} catatan presensi siswa.`,
          },
          { status: 400 }
        );
      }

      await prisma.academicTerm.delete({
        where: { id: termId },
      });

      await logAudit({
        actorId: sessionUser.id,
        action: "DELETE_ACADEMIC_TERM",
        entityType: "AcademicTerm",
        entityId: termId,
        oldValues: { name: term.name, academicYear: term.academicYear.name },
      });

      return NextResponse.json({
        success: true,
        message: `Semester ${term.name} berhasil dihapus.`,
      });
    }

    return NextResponse.json({ success: false, message: "Permintaan tidak valid." }, { status: 400 });
  } catch (error: any) {
    console.error("DELETE Academic Term/Year Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Gagal menghapus data periode akademik." },
      { status: 500 }
    );
  }
}
