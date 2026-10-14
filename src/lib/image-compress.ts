/**
 * Helper kompresi dan resize foto profil di sisi klien.
 *
 * Mengubah foto resolusi tinggi (misal: 3–10 MB dari kamera HP) menjadi
 * avatar persegi berdimensi maks 320x320 px terkompresi JPEG berkualitas tinggi.
 * Menghasilkan ukuran file sangat ringan (~15–30 KB) sehingga:
 * - Tidak memakan ruang database (database hanya menyimpan string URL ringan).
 * - Menghemat ruang disk server secara signifikan.
 * - Mempercepat waktu loading tabel dan kartu identitas siswa/pengguna.
 */

export interface CompressedImageResult {
  blob: Blob;
  dataUrl: string;
  fileName: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
}

export async function compressAvatar(
  file: File,
  maxDimension: number = 320,
  quality: number = 0.75
): Promise<CompressedImageResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Berkas harus berupa gambar (JPG, PNG, atau WebP).");
  }

  // Muat gambar ke objek Image/Bitmap
  const dataUrlOriginal = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrlOriginal;
  });

  // Hitung dimensi crop persegi (center-crop avatar)
  const sourceWidth = img.naturalWidth || img.width;
  const sourceHeight = img.naturalHeight || img.height;
  const cropSize = Math.min(sourceWidth, sourceHeight);
  const cropX = Math.round((sourceWidth - cropSize) / 2);
  const cropY = Math.round((sourceHeight - cropSize) / 2);

  const targetSize = Math.min(maxDimension, cropSize);

  const canvas = document.createElement("canvas");
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Browser tidak mendukung manipulasi grafis Canvas.");
  }

  // Latar belakang putih halus jika ada transparansi PNG
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetSize, targetSize);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Gambar center crop ke canvas persegi targetSize x targetSize
  ctx.drawImage(
    img,
    cropX,
    cropY,
    cropSize,
    cropSize,
    0,
    0,
    targetSize,
    targetSize
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );

  if (!blob) {
    throw new Error("Gagal mengompres gambar.");
  }

  const baseName = file.name.replace(/\.[^.]+$/, "");
  const outName = `${baseName}.jpg`;

  const dataUrl = canvas.toDataURL("image/jpeg", quality);

  return {
    blob,
    dataUrl,
    fileName: outName,
    originalSize: file.size,
    compressedSize: blob.size,
    width: targetSize,
    height: targetSize,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
