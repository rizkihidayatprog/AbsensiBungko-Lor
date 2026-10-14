import QRCode from "qrcode";
import crypto from "crypto";

/**
 * Menghasilkan token unik acak ber-entropi tinggi untuk QR Code
 * Format: qr_<random_hex>
 */
export function generateQrToken(): string {
  return "qr_" + crypto.randomBytes(24).toString("hex");
}

/**
 * Menghasilkan hash SHA-256 dari token untuk penyimpanan/pencocokan aman
 */
export function hashQrToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Menghasilkan Base64 Data URL gambar QR Code
 */
export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 300,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
    errorCorrectionLevel: "M",
  });
}
