import prisma from "./prisma";

/**
 * Rate limiting berbasis database (MySQL).
 *
 * Dipakai untuk:
//  - login  : mencegah brute force kredensial
 *  - scan   : mencegah penyalahgunaan endpoint absensi
 *
 * Algoritma: fixed window per (bucket, windowFrom).
 * Keunggulan dibanding in-memory: konsisten di banyak instance/server,
 * tidak hilang saat restart, dan tidak butuh infrastruktur tambahan (Redis).
 */

export interface RateLimitConfig {
  /** Nama bucket, mis. "login" atau "scan". */
  bucket: string;
  /** Maksimal permintaan dalam satu jendela waktu. */
  limit: number;
  /** Panjang jendela waktu dalam milidetik. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Sisa milidetik sebelum jendela berikutnya berganti. */
  retryAfterMs: number;
}

/** Ambang jumlah request setelah mana pembersihan baris lama dijalankan. */
const CLEANUP_THRESHOLD = 50;

/** Jaga-jaga bila DB bermasalah: izinkan request, jangan kunci outpost sekolah. */
const FAIL_OPEN = true;

function currentWindow(now: number, windowMs: number): number {
  return Math.floor(now / windowMs) * windowMs;
}

/**
 * Catat satu percobaan dan periksa apakah masih di bawah batas.
 * Mengembalikan status allowance beserta sisa kuota.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { bucket, limit, windowMs } = config;
  const now = Date.now();
  const windowFrom = new Date(currentWindow(now, windowMs));
  const expiresAt = new Date(windowFrom.getTime() + windowMs);
  const compositeKey = `${bucket}:${key}`;

  try {
    const row = await prisma.rateLimitHit.upsert({
      where: { bucket_windowFrom: { bucket: compositeKey, windowFrom } },
      create: { bucket: compositeKey, windowFrom, count: 1, expiresAt },
      update: { count: { increment: 1 }, expiresAt },
      select: { count: true },
    });

    const count = row.count;
    const retryAfterMs = Math.max(0, windowFrom.getTime() + windowMs - now);

    if (count % CLEANUP_THRESHOLD === 0) {
      void pruneExpiredRateLimits();
    }

    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      retryAfterMs,
    };
  } catch (error) {
    console.error("Rate limit check gagal:", error);
    return {
      allowed: FAIL_OPEN,
      limit,
      remaining: limit,
      retryAfterMs: 0,
    };
  }
}

/** Ambil IP klien dari header proxy (x-forwarded-for) atau fallback. */
export function getClientIp(req: Request & { headers: Headers }): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "127.0.0.1"
  );
}

/** Format detik untuk pesan bloqueio. */
export function formatRetryAfter(retryAfterMs: number): string {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  if (seconds < 60) return `${seconds} detik`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} menit`;
}

/** Bersihkan baris rate limit yang sudah kedaluwarsa. */
export async function pruneExpiredRateLimits(): Promise<void> {
  try {
    await prisma.rateLimitHit.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  } catch (error) {
    console.error("Pembersihan rate limit gagal:", error);
  }
}
