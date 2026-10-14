import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const nis = searchParams.get("nis");

    if (!nis) {
      return NextResponse.json({ success: false, message: "NIS wajib diisi." }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { nis: nis.trim() },
      include: {
        class: true,
        attendances: {
          orderBy: { attendanceDate: "desc" },
          take: 30, // Ambil 30 hari terakhir
        },
      },
    });

    if (!student) {
      return NextResponse.json({ success: false, message: "Siswa dengan NIS tersebut tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      student: {
        nis: student.nis,
        name: student.name,
        gender: student.gender,
        class: student.class.name,
        attendances: student.attendances.map((a) => ({
          id: a.id,
          date: a.attendanceDate,
          checkInAt: a.checkInAt,
          checkOutAt: a.checkOutAt,
          status: a.status,
          lateMinutes: a.lateMinutes,
          notes: a.notes,
        })),
      },
    });
  } catch (error) {
    console.error("Public Attendance Check Error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
