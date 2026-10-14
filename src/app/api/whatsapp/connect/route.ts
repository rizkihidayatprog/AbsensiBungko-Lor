import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { initWhatsAppSocket, getWhatsAppStatus } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || (sessionUser.role !== "SUPERADMIN" && sessionUser.role !== "ADMIN")) {
      return NextResponse.json(
        { success: false, message: "Hanya Superadmin dan Staf Tata Usaha yang dapat menghubungkan WhatsApp." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const forceNew = Boolean(body?.forceNew);

    const status = await initWhatsAppSocket(forceNew);

    return NextResponse.json({
      success: true,
      message: status.status === "connected" ? "WhatsApp sudah terhubung." : "Silakan scan QR code dengan WhatsApp di HP Anda.",
      ...status,
    });
  } catch (error: any) {
    console.error("POST /api/whatsapp/connect error:", error);
    return NextResponse.json({ success: false, message: error.message || "Server error" }, { status: 500 });
  }
}
