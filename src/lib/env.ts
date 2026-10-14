/**
 * Pembacaan environment variable yang wajib gagal-keras (fail-closed).
 *
 * Tujuannya: mencegah aplikasi berjalan dengan secret default yang diketahui publik.
 * Tanpa ini, siapa pun yang mengetahui kode sumber dapat memalsukan token sesi
 * (termasuk role SUPERADMIN) hanya dengan menebak AUTH_SECRET.
 */

const MIN_SECRET_LENGTH = 32;

// Nilai fallback HANYA untuk pengembangan lokal. Tidak boleh dipakai di produksi.
const DEV_FALLBACK_AUTH_SECRET =
  "dev-only-secret-absensi-sekolah-min-32-chars-long-1234567890";

let cachedSecret: Uint8Array | null = null;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Mengembalikan AUTH_SECRET sebagai Uint8Array untuk jwt (jose).
 * Melempar error bila secret kosong/terlalu pendek di produksi,
 * atau kosong total di lingkungan mana pun.
 */
export function getJwtSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;

  const configured = process.env.AUTH_SECRET?.trim();

  if (!configured && isProduction()) {
    throw new Error(
      "AUTH_SECRET wajib diisi pada lingkungan produksi. Aplikasi sengaja berhenti demi keamanan. " +
        'Contoh: openssl rand -base64 48'
    );
  }

  const secret = configured || DEV_FALLBACK_AUTH_SECRET;

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `AUTH_SECRET terlalu pendek (minimal ${MIN_SECRET_LENGTH} karakter). ` +
        "Gunakan nilai acak yang panjang, contoh: openssl rand -base64 48"
    );
  }

  cachedSecret = new TextEncoder().encode(secret);
  return cachedSecret;
}

/**
 * Untuk jalur yang harus gagal-keras secara diam-diam (mis. middleware/edge):
 * kembalikan null bila secret tidak valid sehingga token tidak pernah diverifikasi.
 */
export function tryGetJwtSecret(): Uint8Array | null {
  try {
    return getJwtSecret();
  } catch {
    return null;
  }
}
