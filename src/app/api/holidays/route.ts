import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const holidays = await prisma.holiday.findMany({
      orderBy: { date: "asc" },
    });

    return NextResponse.json({ success: true, holidays });
  } catch (error: any) {
    console.error("GET Holidays Error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || sessionUser.role !== "SUPERADMIN") {
      return NextResponse.json(
        { success: false, message: "Hanya Superadmin yang dapat menambahkan hari libur sekolah." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { date, description } = body;

    if (!date || !description) {
      return NextResponse.json(
        { success: false, message: "Tanggal dan keterangan libur wajib diisi." },
        { status: 400 }
      );
    }

    const holidayDate = new Date(date);
    if (isNaN(holidayDate.getTime())) {
      return NextResponse.json({ success: false, message: "Format tanggal tidak valid." }, { status: 400 });
    }

    const existing = await prisma.holiday.findUnique({
      where: { date: holidayDate },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: `Tanggal ${date} sudah tercatat sebagai hari libur (${existing.description}).` },
        { status: 400 }
      );
    }

    const holiday = await prisma.holiday.create({
      data: {
        date: holidayDate,
        description: description.trim(),
      },
    });

    await logAudit({
      actorId: sessionUser.id,
      action: "CREATE_HOLIDAY",
      entityType: "Holiday",
      entityId: holiday.id,
      newValues: { date: holiday.date, description: holiday.description },
    });

    return NextResponse.json({
      success: true,
      message: "Hari libur berhasil ditambahkan.",
      holiday,
    });
  } catch (error: any) {
    console.error("POST Holiday Error:", error);
    return NextResponse.json({ success: false, message: error.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || sessionUser.role !== "SUPERADMIN") {
      return NextResponse.json(
        { success: false, message: "Hanya Superadmin yang dapat menghapus hari libur." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "ID hari libur wajib disertakan." }, { status: 400 });
    }

    const holiday = await prisma.holiday.findUnique({ where: { id } });
    if (!holiday) {
      return NextResponse.json({ success: false, message: "Data hari libur tidak ditemukan." }, { status: 404 });
    }

    await prisma.holiday.delete({ where: { id } });

    await logAudit({
      actorId: sessionUser.id,
      action: "DELETE_HOLIDAY",
      entityType: "Holiday",
      entityId: id,
      oldValues: holiday,
    });

    return NextResponse.json({
      success: true,
      message: `Hari libur "${holiday.description}" berhasil dihapus.`,
    });
  } catch (error: any) {
    console.error("DELETE Holiday Error:", error);
    return NextResponse.json({ success: false, message: error.message || "Server error" }, { status: 500 });
  }
}
