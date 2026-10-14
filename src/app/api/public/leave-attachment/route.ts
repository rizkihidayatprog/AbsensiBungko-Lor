import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

/**
 * Unggah bukti pendukung (foto surat dokter / dokumen PDF) untuk pengajuan izin.
 *
 * - Foto (JPEG/PNG/WebP): dikompres di sisi klien sebelum dikirim sehingga
 *   ukuran file mengecil namun tetap tajam untuk pratinjau.
 * - PDF: dikirim apa adanya (PDF sudah format ringkas; dikompres ulang justru
 *   dapat merusak tata letak dan membuat teks kurang tajam).
 *
 * Penyimpanan memakai direktori `storage/leave-attachments` di luar folder
 * `public` (berkas unggahan bukan aset statis build), lalu disajikan kembali
 * lewat route `GET /api/public/leave-attachment/[file]`.
 */

const UPLOAD_DIR = path.join(process.cwd(), "storage", "leave-attachments");

const MAX_SIZE_PDF = 8 * 1024 * 1024; // 8 MB
const MAX_SIZE_IMAGE = 5 * 1024 * 1024; // 5 MB (hasil kompresi klien)

const ALLOWED = [
  { ext: "jpg", mime: "image/jpeg" },
  { ext: "jpeg", mime: "image/jpeg" },
  { ext: "png", mime: "image/png" },
  { ext: "webp", mime: "image/webp" },
  { ext: "pdf", mime: "application/pdf" },
];

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { success: false, message: "Tidak ada berkas yang diunggah." },
        { status: 400 }
      );
    }

    const uploaded = file as File;
    const lowerName = uploaded.name.toLowerCase();

    const isPdf =
      uploaded.type === "application/pdf" || lowerName.endsWith(".pdf");
    const isImage = uploaded.type.startsWith("image/");

    if (!isPdf && !isImage) {
      return NextResponse.json(
        {
          success: false,
          message: "Format tidak didukung. Gunakan foto (JPG/PNG/WebP) atau PDF.",
        },
        { status: 400 }
      );
    }

    if (isPdf && uploaded.size > MAX_SIZE_PDF) {
      return NextResponse.json(
        {
          success: false,
          message: "Ukuran PDF maksimal 8 MB. Mohon kompres berkas terlebih dahulu.",
        },
        { status: 400 }
      );
    }

    if (isImage && uploaded.size > MAX_SIZE_IMAGE) {
      return NextResponse.json(
        {
          success: false,
          message: "Ukuran foto maksimal 5 MB setelah kompresi.",
        },
        { status: 400 }
      );
    }

    const ext = isPdf
      ? "pdf"
      : ALLOWED.find((a) => uploaded.type === a.mime)?.ext || "jpg";

    const buffer = Buffer.from(await uploaded.arrayBuffer());

    // Nama berkas diacak agar tidak menebak atau menimpa berkas lain
    const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, fileName), buffer);

    return NextResponse.json({
      success: true,
      message: "Bukti pendukung berhasil diunggah.",
      url: `/api/public/leave-attachment/${fileName}`,
      fileName: uploaded.name,
      kind: isPdf ? "PDF" : "IMAGE",
      size: buffer.length,
    });
  } catch (error) {
    console.error("Upload Leave Attachment Error:", error);
    return NextResponse.json(
      { success: false, message: "Server error saat mengunggah berkas." },
      { status: 500 }
    );
  }
}
