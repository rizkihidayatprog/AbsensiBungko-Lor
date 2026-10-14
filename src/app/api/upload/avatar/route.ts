import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "storage", "avatars");

// Maksimal 500 KB setelah kompresi klien (foto avatar 320x320 biasanya hanya 15-30 KB)
const MAX_FILE_SIZE = 500 * 1024;

const ALLOWED_MIME = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const entityType = formData.get("type")?.toString() || "avatar"; // "user" atau "student"

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { success: false, message: "Tidak ada berkas gambar yang dipilih." },
        { status: 400 }
      );
    }

    const uploaded = file as File;

    if (!ALLOWED_MIME.includes(uploaded.type) && !uploaded.name.match(/\.(jpg|jpeg|png|webp)$/i)) {
      return NextResponse.json(
        { success: false, message: "Format foto tidak didukung. Gunakan JPG, PNG, atau WebP." },
        { status: 400 }
      );
    }

    if (uploaded.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: "Ukuran foto terlalu besar (maksimal 500 KB). Pastikan foto telah dikompresi di aplikasi.",
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await uploaded.arrayBuffer());

    // Beri nama aman: prefix-timestamp-random.jpg
    const safePrefix = entityType === "student" ? "student" : "user";
    const fileName = `${safePrefix}-${Date.now()}-${randomUUID().slice(0, 8)}.jpg`;

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, fileName), buffer);

    const publicUrl = `/api/public/avatar/${fileName}`;

    return NextResponse.json({
      success: true,
      message: "Foto profil berhasil diunggah dan dioptimalkan.",
      url: publicUrl,
      fileName,
      size: buffer.length,
    });
  } catch (error) {
    console.error("Upload Avatar Error:", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server saat menyimpan foto profil." },
      { status: 500 }
    );
  }
}
