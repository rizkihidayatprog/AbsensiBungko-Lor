import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { parseCsv } from "@/lib/csv";
import { generateQrToken } from "@/lib/qr";
import { logAudit } from "@/lib/audit";

interface ValidatedStudentRow {
  rowNumber: number;
  nis: string;
  nisn: string | null;
  name: string;
  gender: string;
  className: string;
  classId: string | null;
  parentName: string | null;
  parentPhone: string | null;
  isValid: boolean;
  errors: string[];
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || (sessionUser.role !== "SUPERADMIN" && sessionUser.role !== "ADMIN")) {
      return NextResponse.json(
        { success: false, message: "Akses ditolak. Hanya Admin dan Superadmin yang dapat mengimpor siswa." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { csvContent, mode = "validate" } = body;

    if (!csvContent || typeof csvContent !== "string") {
      return NextResponse.json(
        { success: false, message: "Konten CSV wajib dikirimkan." },
        { status: 400 }
      );
    }

    const parsed = parseCsv(csvContent);
    if (parsed.errors.length > 0 || parsed.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: parsed.errors[0] || "File CSV tidak memiliki data yang dapat diolah." },
        { status: 400 }
      );
    }

    // 1. Ambil data master untuk validasi
    const existingClasses = await prisma.class.findMany({
      select: { id: true, name: true, grade: true },
    });

    const classMap = new Map<string, string>();
    existingClasses.forEach((cls) => {
      // Map format standar e.g. "kelas 7a" -> id
      const norm1 = cls.name.toLowerCase().trim();
      classMap.set(norm1, cls.id);
      // Map format singkat e.g. "7a" -> id jika nama diawali "kelas "
      if (norm1.startsWith("kelas ")) {
        classMap.set(norm1.replace("kelas ", "").trim(), cls.id);
      }
    });

    const existingStudents = await prisma.student.findMany({
      select: { nis: true, nisn: true },
    });

    const existingNisSet = new Set(existingStudents.map((s) => s.nis.toLowerCase().trim()));
    const existingNisnSet = new Set(
      existingStudents.filter((s) => s.nisn).map((s) => s.nisn!.toLowerCase().trim())
    );

    const fileNisSet = new Set<string>();
    const fileNisnSet = new Set<string>();

    const validatedRows: ValidatedStudentRow[] = [];
    let validCount = 0;
    let errorCount = 0;

    for (let i = 0; i < parsed.rows.length; i++) {
      const raw = parsed.rows[i];
      const rowNumber = i + 2; // +1 untuk 1-based, +1 untuk baris header
      const errors: string[] = [];

      // Validasi NIS
      const nis = (raw.nis || raw.nomor_induk || "").trim();
      if (!nis) {
        errors.push("NIS wajib diisi");
      } else {
        const nisLower = nis.toLowerCase();
        if (existingNisSet.has(nisLower)) {
          errors.push(`NIS '${nis}' sudah terdaftar di database`);
        } else if (fileNisSet.has(nisLower)) {
          errors.push(`NIS '${nis}' terduplikasi di dalam file CSV`);
        } else {
          fileNisSet.add(nisLower);
        }
      }

      // Validasi NISN (opsional)
      const nisnRaw = (raw.nisn || "").trim();
      const nisn = nisnRaw.length > 0 ? nisnRaw : null;
      if (nisn) {
        const nisnLower = nisn.toLowerCase();
        if (existingNisnSet.has(nisnLower)) {
          errors.push(`NISN '${nisn}' sudah terdaftar di database`);
        } else if (fileNisnSet.has(nisnLower)) {
          errors.push(`NISN '${nisn}' terduplikasi di dalam file CSV`);
        } else {
          fileNisnSet.add(nisnLower);
        }
      }

      // Validasi Nama
      const name = (raw.nama || raw.name || raw.nama_lengkap || "").trim();
      if (!name) {
        errors.push("Nama siswa wajib diisi");
      }

      // Validasi Jenis Kelamin
      let gender = (raw.jenis_kelamin || raw.gender || raw.jk || "").toUpperCase().trim();
      if (gender.startsWith("L") || gender === "LAKI-LAKI" || gender === "PRIA") {
        gender = "L";
      } else if (gender.startsWith("P") || gender === "PEREMPUAN" || gender === "WANITA") {
        gender = "P";
      } else {
        errors.push("Jenis kelamin harus 'L' atau 'P'");
      }

      // Validasi Kelas
      const className = (raw.kelas || raw.nama_kelas || "").trim();
      let classId: string | null = null;
      if (!className) {
        errors.push("Kelas wajib diisi");
      } else {
        const normClassName = className.toLowerCase().trim();
        classId = classMap.get(normClassName) || null;
        if (!classId) {
          errors.push(`Kelas '${className}' tidak ditemukan di sistem master kelas`);
        }
      }

      // Orang tua (opsional)
      const parentName = (raw.nama_orang_tua || raw.nama_ortu || raw.orang_tua || raw.parent_name || "").trim() || null;
      const parentPhone = (raw.nomor_wa_orang_tua || raw.nomor_hp_orang_tua || raw.no_hp_ortu || raw.no_wa || raw.parent_phone || "").trim() || null;

      const isValid = errors.length === 0;
      if (isValid) {
        validCount++;
      } else {
        errorCount++;
      }

      validatedRows.push({
        rowNumber,
        nis,
        nisn,
        name,
        gender,
        className,
        classId,
        parentName,
        parentPhone,
        isValid,
        errors,
      });
    }

    // JIKA MODE HANYA VALIDASI
    if (mode === "validate") {
      return NextResponse.json({
        success: true,
        summary: {
          totalRows: parsed.rows.length,
          validCount,
          errorCount,
        },
        rows: validatedRows,
      });
    }

    // JIKA MODE EKSEKUSI (COMMIT KE DATABASE)
    if (mode === "execute") {
      const validRowsToInsert = validatedRows.filter((r) => r.isValid && r.classId);

      if (validRowsToInsert.length === 0) {
        return NextResponse.json(
          { success: false, message: "Tidak ada baris data valid yang dapat diimpor." },
          { status: 400 }
        );
      }

      // Ambil semester aktif (jika ada) untuk mendaftarkan enrollment
      const activeTerm = await prisma.academicTerm.findFirst({
        where: { isActive: true },
      });

      // Jalankan transaksi penyimpanan
      const result = await prisma.$transaction(async (tx) => {
        let insertedCount = 0;

        for (const r of validRowsToInsert) {
          const qrToken = generateQrToken();

          const student = await tx.student.create({
            data: {
              nis: r.nis,
              nisn: r.nisn,
              name: r.name,
              gender: r.gender,
              classId: r.classId!,
              parentName: r.parentName,
              parentPhone: r.parentPhone,
              qrTokenHash: qrToken,
              isActive: true,
            },
          });

          // Otomatis daftarkan ke semester aktif jika ada
          if (activeTerm) {
            await tx.studentEnrollment.create({
              data: {
                studentId: student.id,
                classId: r.classId!,
                academicTermId: activeTerm.id,
                status: "AKTIF",
                isActive: true,
              },
            });
          }

          insertedCount++;
        }

        // Catat Audit Log
        await logAudit({
          actorId: sessionUser.id,
          action: "IMPORT_STUDENTS",
          entityType: "Student",
          entityId: "BULK",
          newValues: {
            totalImported: insertedCount,
            activeTermId: activeTerm?.id || null,
          },
        });

        return { insertedCount };
      });

      return NextResponse.json({
        success: true,
        message: `Berhasil mengimpor ${result.insertedCount} data siswa.`,
        insertedCount: result.insertedCount,
      });
    }

    return NextResponse.json(
      { success: false, message: "Mode tidak dikenali. Gunakan 'validate' atau 'execute'." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("POST Student Import Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Gagal memproses impor siswa." },
      { status: 500 }
    );
  }
}
