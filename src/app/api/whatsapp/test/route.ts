import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || (sessionUser.role !== "SUPERADMIN" && sessionUser.role !== "ADMIN")) {
      return NextResponse.json(
        { success: false, message: "Hanya Superadmin dan Staf Tata Usaha yang dapat mengirim pesan uji coba WhatsApp." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { phone, message } = body;

    if (!phone || !message) {
      return NextResponse.json(
        { success: false, message: "Nomor WhatsApp dan pesan uji coba wajib diisi." },
        { status: 400 }
      );
    }

    const result = await sendWhatsAppMessage(phone, message, {
      recipientName: "Uji Coba Staf TU",
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        message: result.error || "Gagal mengirim pesan uji coba WhatsApp.",
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Pesan uji coba WhatsApp berhasil dikirim!",
      messageId: result.messageId,
    });
  } catch (error: any) {
    console.error("POST /api/whatsapp/test error:", error);
    return NextResponse.json({ success: false, message: error.message || "Server error" }, { status: 500 });
  }
}
