import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

const AVATAR_DIR = path.join(process.cwd(), "storage", "avatars");

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ file: string }> }
) {
  try {
    const { file } = await params;

    // Cegah path traversal
    if (!/^[A-Za-z0-9._-]+$/.test(file)) {
      return NextResponse.json({ success: false, message: "Nama berkas tidak valid." }, { status: 400 });
    }

    const ext = path.extname(file).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || "image/jpeg";
    const filePath = path.join(AVATAR_DIR, file);

    // Pastikan berada di dalam direktori penyimpanan yang sah
    if (path.dirname(path.resolve(filePath)) !== path.resolve(AVATAR_DIR)) {
      return NextResponse.json({ success: false, message: "Akses ditolak." }, { status: 403 });
    }

    const buffer = await fs.readFile(filePath);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return NextResponse.json({ success: false, message: "Foto tidak ditemukan." }, { status: 404 });
    }
    console.error("GET Avatar Error:", error);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
