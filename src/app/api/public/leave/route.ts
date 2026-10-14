import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { LeaveType } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nis, type, startDate, endDate, reason, attachmentUrl, attachmentName } = body;

    if (!nis || !type || !startDate || !endDate || !reason) {
      return NextResponse.json(
        { success: false, message: "Semua data formulir permohonan izin wajib diisi." },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { nis: nis.trim() },
      include: { class: true },
    });

    if (!student) {
      return NextResponse.json(
        { success: false, message: "Siswa dengan NIS tersebut tidak ditemukan." },
        { status: 404 }
      );
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        studentId: student.id,
        type: type as LeaveType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason: reason.trim(),
        attachmentUrl: attachmentUrl || null,
        attachmentName: attachmentName || null,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      message: `Permohonan ${type} untuk siswa ${student.name} (Kelas ${student.class.name}) berhasil dikirimkan dan menunggu peninjauan wali kelas.`,
      leave,
    });
  } catch (error) {
    console.error("Public Leave Request Error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
