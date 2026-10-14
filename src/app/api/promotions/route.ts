import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { EnrollmentStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || (sessionUser.role !== "SUPERADMIN" && sessionUser.role !== "ADMIN")) {
      return NextResponse.json({ success: false, message: "Akses ditolak. Khusus Admin & Superadmin." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const termId = searchParams.get("termId");

    if (!classId) {
      return NextResponse.json({ success: false, message: "classId wajib disertakan." }, { status: 400 });
    }

    // Ambil siswa yang saat ini di kelas tersebut (atau berdasarkan term enrollment)
    const students = await prisma.student.findMany({
      where: {
        classId,
        isActive: true,
      },
      include: {
        class: true,
        enrollments: {
          where: termId ? { academicTermId: termId } : undefined,
          include: {
            academicTerm: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Ambil semua data kelas yang tersedia untuk tujuan kenaikan
    const allClasses = await prisma.class.findMany({
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    });

    // Ambil semua semester / tahun ajaran
    const academicTerms = await prisma.academicTerm.findMany({
      include: { academicYear: true },
      orderBy: [{ academicYear: { name: "desc" } }, { semester: "asc" }],
    });

    return NextResponse.json({
      success: true,
      students,
      classes: allClasses,
      academicTerms,
    });
  } catch (error) {
    console.error("GET Promotions Error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || (sessionUser.role !== "SUPERADMIN" && sessionUser.role !== "ADMIN")) {
      return NextResponse.json({ success: false, message: "Akses ditolak. Khusus Admin & Superadmin." }, { status: 403 });
    }

    const body = await req.json();
    const { sourceClassId, sourceTermId, targetTermId, promotions } = body;

    if (!sourceClassId || !targetTermId || !Array.isArray(promotions) || promotions.length === 0) {
      return NextResponse.json(
        { success: false, message: "Kelas asal, semester tujuan, dan daftar siswa wajib diisi." },
        { status: 400 }
      );
    }

    // Validasi target term
    const targetTerm = await prisma.academicTerm.findUnique({
      where: { id: targetTermId },
      include: { academicYear: true },
    });
    if (!targetTerm) {
      return NextResponse.json({ success: false, message: "Semester tujuan tidak valid." }, { status: 404 });
    }

    let countNaik = 0;
    let countTinggal = 0;
    let countLulus = 0;
    let countMutasi = 0;

    await prisma.$transaction(async (tx) => {
      for (const item of promotions) {
        const { studentId, action, targetClassId } = item;

        if (action === "NAIK_KELAS" || action === "TINGGAL_KELAS") {
          if (!targetClassId) {
            throw new Error(`Siswa ID ${studentId} memerlukan kelas tujuan.`);
          }

          // 1. Catat / upsert enrollment di semester tujuan
          await tx.studentEnrollment.upsert({
            where: {
              studentId_academicTermId: {
                studentId,
                academicTermId: targetTermId,
              },
            },
            update: {
              classId: targetClassId,
              status: EnrollmentStatus.AKTIF,
              isActive: true,
            },
            create: {
              studentId,
              classId: targetClassId,
              academicTermId: targetTermId,
              status: EnrollmentStatus.AKTIF,
              isActive: true,
            },
          });

          // 2. Perbarui penempatan kelas aktif siswa (QR code tetap sama)
          await tx.student.update({
            where: { id: studentId },
            data: {
              classId: targetClassId,
              isActive: true,
            },
          });

          // 3. Update status enrollment di semester asal jika ada
          if (sourceTermId) {
            await tx.studentEnrollment.updateMany({
              where: {
                studentId,
                academicTermId: sourceTermId,
              },
              data: {
                status: action === "NAIK_KELAS" ? EnrollmentStatus.NAIK_KELAS : EnrollmentStatus.TINGGAL_KELAS,
              },
            });
          }

          if (action === "NAIK_KELAS") countNaik++;
          else countTinggal++;
        } else if (action === "LULUS") {
          // Nonaktifkan siswa karena telah menyelesaikan jenjang
          await tx.student.update({
            where: { id: studentId },
            data: { isActive: false },
          });

          if (sourceTermId) {
            await tx.studentEnrollment.updateMany({
              where: {
                studentId,
                academicTermId: sourceTermId,
              },
              data: { status: EnrollmentStatus.LULUS },
            });
          }
          countLulus++;
        } else if (action === "MUTASI") {
          // Nonaktifkan siswa karena pindah sekolah
          await tx.student.update({
            where: { id: studentId },
            data: { isActive: false },
          });

          if (sourceTermId) {
            await tx.studentEnrollment.updateMany({
              where: {
                studentId,
                academicTermId: sourceTermId,
              },
              data: { status: EnrollmentStatus.MUTASI },
            });
          }
          countMutasi++;
        }
      }
    });

    // Catat Audit Log
    await logAudit({
      actorId: sessionUser.id,
      action: "EXECUTE_CLASS_PROMOTION",
      entityType: "StudentEnrollment",
      newValues: {
        sourceClassId,
        sourceTermId,
        targetTermId,
        countNaik,
        countTinggal,
        countLulus,
        countMutasi,
        total: promotions.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Proses penempatan berhasil: ${countNaik} Naik Kelas, ${countTinggal} Tinggal Kelas, ${countLulus} Lulus, ${countMutasi} Mutasi.`,
      summary: {
        countNaik,
        countTinggal,
        countLulus,
        countMutasi,
        total: promotions.length,
      },
    });
  } catch (error: any) {
    console.error("POST Promotions Error:", error);
    return NextResponse.json({ success: false, message: error.message || "Gagal memproses kenaikan kelas." }, { status: 500 });
  }
}
