import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { parseCsv } from "@/lib/csv";
import { generateQrToken } from "@/lib/qr";
import { logAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";

interface ValidatedTeacherRow {
  rowNumber: number;
  nip: string | null;
  name: string;
  gender: string;
  phone: string | null;
  email: string | null;
  createAccount: boolean;
  isValid: boolean;
  errors: string[];
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || (sessionUser.role !== "SUPERADMIN" && sessionUser.role !== "ADMIN")) {
      return NextResponse.json(
        { success: false, message: "Akses ditolak. Hanya Admin dan Superadmin yang dapat mengimpor data guru." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { csvContent, mode = "validate", defaultPassword = "guru123" } = body;

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

    // Ambil data guru & user untuk pencegahan duplikasi
    const existingTeachers = await prisma.teacher.findMany({
      select: { nip: true },
    });
    const existingNipSet = new Set(
      existingTeachers.filter((t) => t.nip).map((t) => t.nip!.toLowerCase().trim())
    );

    const existingUsers = await prisma.user.findMany({
      select: { email: true },
    });
    const existingEmailSet = new Set(existingUsers.map((u) => u.email.toLowerCase().trim()));

    const fileNipSet = new Set<string>();
    const fileEmailSet = new Set<string>();

    const validatedRows: ValidatedTeacherRow[] = [];
    let validCount = 0;
    let errorCount = 0;

    for (let i = 0; i < parsed.rows.length; i++) {
      const raw = parsed.rows[i];
      const rowNumber = i + 2;
      const errors: string[] = [];

      // Validasi NIP (opsional)
      const nipRaw = (raw.nip || "").trim();
      const nip = nipRaw.length > 0 ? nipRaw : null;
      if (nip) {
        const nipLower = nip.toLowerCase();
        if (existingNipSet.has(nipLower)) {
          errors.push(`NIP '${nip}' sudah terdaftar di database`);
        } else if (fileNipSet.has(nipLower)) {
          errors.push(`NIP '${nip}' terduplikasi di dalam file CSV`);
        } else {
          fileNipSet.add(nipLower);
        }
      }

      // Validasi Nama
      const name = (raw.nama || raw.name || raw.nama_guru || "").trim();
      if (!name) {
        errors.push("Nama guru wajib diisi");
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

      // Telepon (opsional)
      const phoneRaw = (raw.telepon || raw.phone || raw.no_hp || raw.kontak || "").trim();
      const phone = phoneRaw.length > 0 ? phoneRaw : null;

      // Akun & Email
      const createAccountStr = (raw.buat_akun || raw.create_account || raw.akun || "").toLowerCase().trim();
      const createAccount = ["ya", "y", "true", "1", "yes"].includes(createAccountStr);

      const emailRaw = (raw.email || "").trim();
      const email = emailRaw.length > 0 ? emailRaw : null;

      if (createAccount) {
        if (!email) {
          errors.push("Email wajib diisi jika opsi 'buat_akun' diaktifkan (ya)");
        } else {
          const emailLower = email.toLowerCase();
          if (existingEmailSet.has(emailLower)) {
            errors.push(`Email '${email}' sudah digunakan oleh pengguna lain`);
          } else if (fileEmailSet.has(emailLower)) {
            errors.push(`Email '${email}' terduplikasi di dalam file CSV`);
          } else {
            fileEmailSet.add(emailLower);
          }
        }
      }

      const isValid = errors.length === 0;
      if (isValid) {
        validCount++;
      } else {
        errorCount++;
      }

      validatedRows.push({
        rowNumber,
        nip,
        name,
        gender,
        phone,
        email,
        createAccount,
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

    // JIKA MODE EKSEKUSI
    if (mode === "execute") {
      const validRowsToInsert = validatedRows.filter((r) => r.isValid);

      if (validRowsToInsert.length === 0) {
        return NextResponse.json(
          { success: false, message: "Tidak ada baris data guru yang valid untuk diimpor." },
          { status: 400 }
        );
      }

      const passwordHash = await bcrypt.hash(defaultPassword || "guru123", 10);

      const result = await prisma.$transaction(async (tx) => {
        let insertedTeachers = 0;
        let createdAccounts = 0;

        for (const r of validRowsToInsert) {
          const qrToken = generateQrToken();

          const teacher = await tx.teacher.create({
            data: {
              nip: r.nip,
              name: r.name,
              gender: r.gender,
              phone: r.phone,
              qrTokenHash: qrToken,
              isActive: true,
            },
          });
          insertedTeachers++;

          if (r.createAccount && r.email) {
            await tx.user.create({
              data: {
                name: r.name,
                email: r.email,
                passwordHash,
                role: "GURU",
                teacherId: teacher.id,
                isActive: true,
              },
            });
            createdAccounts++;
          }
        }

        await logAudit({
          actorId: sessionUser.id,
          action: "IMPORT_TEACHERS",
          entityType: "Teacher",
          entityId: "BULK",
          newValues: {
            totalImported: insertedTeachers,
            accountsCreated: createdAccounts,
          },
        });

        return { insertedTeachers, createdAccounts };
      });

      return NextResponse.json({
        success: true,
        message: `Berhasil mengimpor ${result.insertedTeachers} data guru (${result.createdAccounts} akun login dibuat).`,
        insertedCount: result.insertedTeachers,
        accountsCreated: result.createdAccounts,
      });
    }

    return NextResponse.json(
      { success: false, message: "Mode tidak dikenali. Gunakan 'validate' atau 'execute'." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("POST Teacher Import Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Gagal memproses impor data guru." },
      { status: 500 }
    );
  }
}
