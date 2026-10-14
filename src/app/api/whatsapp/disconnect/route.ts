import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { disconnectWhatsApp } from "@/lib/whatsapp";

export async function POST() {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || (sessionUser.role !== "SUPERADMIN" && sessionUser.role !== "ADMIN")) {
      return NextResponse.json(
        { success: false, message: "Hanya Superadmin dan Staf Tata Usaha yang dapat memutuskan WhatsApp." },
        { status: 403 }
      );
    }

    const result = await disconnectWhatsApp();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("POST /api/whatsapp/disconnect error:", error);
    return NextResponse.json({ success: false, message: error.message || "Server error" }, { status: 500 });
  }
}
