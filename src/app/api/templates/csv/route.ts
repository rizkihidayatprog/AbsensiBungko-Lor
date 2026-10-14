import { NextRequest, NextResponse } from "next/server";
import { generateCsv } from "@/lib/csv";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (type === "students") {
    // Ambil contoh nama kelas yang ada di database agar template relevan
    const sampleClasses = await prisma.class.findMany({
      take: 3,
      orderBy: { name: "asc" },
      select: { name: true },
    });

    const sampleClassName = sampleClasses[0]?.name || "7A";
    const sampleClassName2 = sampleClasses[1]?.name || "7B";

    const headers = ["nis", "nisn", "nama", "jenis_kelamin", "kelas", "nama_orang_tua", "nomor_wa_orang_tua"];
    const rows = [
      ["1001", "0012345671", "Ahmad Fauzi", "L", sampleClassName, "H. Ridwan", "081234567890"],
      ["1002", "0012345672", "Siti Nurhaliza", "P", sampleClassName, "Ibu Fatimah", "081298765432"],
      ["1003", "0012345673", "Budi Santoso", "L", sampleClassName2, "Bapak Joko", "085712345678"],
    ];

    const csvContent = generateCsv(headers, rows);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="template_impor_siswa.csv"',
      },
    });
  }

  if (type === "teachers") {
    const headers = ["nip", "nama", "jenis_kelamin", "telepon", "email", "buat_akun"];
    const rows = [
      ["198001012005011001", "Drs. Ahmad Dahlan, M.Pd.", "L", "081234567890", "ahmad.dahlan@sekolah.sch.id", "ya"],
      ["198502022010012002", "Siti Aminah, S.Pd.", "P", "081234567891", "siti.aminah@sekolah.sch.id", "ya"],
      ["", "Budi Pratama, S.Kom.", "L", "081234567892", "", "tidak"],
    ];

    const csvContent = generateCsv(headers, rows);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="template_impor_guru.csv"',
      },
    });
  }

  return NextResponse.json(
    { success: false, message: "Tipe template tidak valid. Gunakan 'students' atau 'teachers'." },
    { status: 400 }
  );
}
