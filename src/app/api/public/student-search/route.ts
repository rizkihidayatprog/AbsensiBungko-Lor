import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * Pencarian siswa untuk form publik pengajuan izin.
 *
 * Dikembalikan HANYA nama, NIS, dan kelas — sengaja tidak menyertakan
 * riwayat absensi, jenis kelamin, atau data pribadi lain milik siswa.
 * Hasil dibatasi (maks 8) dan hanya siswa aktif agar halaman publik ini
 * tidak bisa dipakai untuk forceful daftar seluruh siswa.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    // Minimal 2 karakter: dengan 1 karakter daftar siswa jadi terlalu mudah
    // dijebol sehingga form publik bisa dipakai menyisir seluruh roster.
    if (q.length < 2) {
      return NextResponse.json({ success: true, students: [] });
    }
    if (q.length > 50) {
      return NextResponse.json(
        { success: false, message: "Kata kunci terlalu panjang." },
        { status: 400 }
      );
    }

    const students = await prisma.student.findMany({
      where: {
        isActive: true,
        OR: [{ name: { contains: q } }, { nis: { contains: q } }],
      },
      select: {
        nis: true,
        name: true,
        class: { select: { name: true } },
      },
      orderBy: { name: "asc" },
      take: 8,
    });

    return NextResponse.json({
      success: true,
      students: students.map((s) => ({
        nis: s.nis,
        name: s.name,
        className: s.class?.name ?? "-",
      })),
    });
  } catch (error) {
    console.error("Public Student Search Error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
