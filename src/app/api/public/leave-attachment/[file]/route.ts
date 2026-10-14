import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

/**
 * Menyajikan bukti pendukung yang telah diunggah (foto / PDF).
 *
 * Berkas disimpan di `storage/leave-attachments`, di luar folder `public`,
 * karena Next.js pada mode production hanya menyajikan aset statis yang
 * tercatat saat build. Route ini membacanya langsung dari disk sehingga bukti
 * tetap dapat dibuka meski diunggah setelah server berjalan.
 */

const UPLOAD_DIR = path.join(process.cwd(), "storage", "leave-attachments");

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ file: string }> }
) {
  try {
    const { file } = await params;

    // Cegah path traversal: hanya nama berkas sederhana yang diizinkan
    if (!/^[A-Za-z0-9._-]+$/.test(file)) {
      return NextResponse.json(
        { success: false, message: "Nama berkas tidak valid." },
        { status: 400 }
      );
    }

    const ext = path.extname(file).toLowerCase();
    const contentType = CONTENT_TYPES[ext];
    if (!contentType) {
      return NextResponse.json(
        { success: false, message: "Jenis berkas tidak didukung." },
        { status: 400 }
      );
    }

    const filePath = path.join(UPLOAD_DIR, file);

    // Pastikan berkas benar-benar berada di dalam direktori unggahan
    if (path.dirname(path.resolve(filePath)) !== path.resolve(UPLOAD_DIR)) {
      return NextResponse.json(
        { success: false, message: "Akses ditolak." },
        { status: 403 }
      );
    }

    const buffer = await fs.readFile(filePath);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return NextResponse.json(
        { success: false, message: "Bukti tidak ditemukan." },
        { status: 404 }
      );
    }
    console.error("Serve Leave Attachment Error:", error);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
