import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getWhatsAppStatus } from "@/lib/whatsapp";

export async function GET() {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const status = getWhatsAppStatus();

    // Ambil 20 riwayat notifikasi terakhir
    const logs = await prisma.whatsAppLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      ...status,
      logs,
    });
  } catch (error: any) {
    console.error("GET /api/whatsapp/status error:", error);
    return NextResponse.json({ success: false, message: error.message || "Server error" }, { status: 500 });
  }
}
