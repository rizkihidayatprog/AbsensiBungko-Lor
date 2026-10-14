import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Endpoint publik untuk menampilkan identitas sekolah pada halaman yang dapat
// diakses tanpa login (mis. portal cek kehadiran & pengajuan izin).
// Hanya mengembalikan data yang memang tercetak pada kop resmi sekolah.
export async function GET() {
  try {
    const setting = await prisma.schoolSetting.findFirst({
      where: { id: 1 },
      select: { schoolName: true, checkOutEnabled: true },
    });

    return NextResponse.json({
      success: true,
      schoolName: setting?.schoolName || "Sekolah",
      checkOutEnabled: setting?.checkOutEnabled !== false,
    });
  } catch (error) {
    console.error("GET Public School Error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
