import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { tryGetJwtSecret } from "@/lib/env";
import { assertSameOrigin, isMutatingMethod } from "@/lib/csrf";

const SESSION_COOKIE_NAME = "absensi_session";

// Rute yang bebas diakses tanpa login
const PUBLIC_PATHS = ["/login", "/izin", "/cek-kehadiran"];

// Aset statis di root /public (logo, ikon, dsb.) bebas diakses tanpa login
const STATIC_ASSET_RE = /\.(?:png|jpe?g|gif|svg|webp|avif|ico|txt|xml|webmanifest|woff2?)$/i;

// Aturan rute khusus Superadmin
const SUPERADMIN_ONLY_PREFIXES = ["/pengguna", "/audit-log", "/backup"];

// Aturan rute khusus Admin & Superadmin (Guru dilarang)
const ADMIN_OR_SUPERADMIN_PREFIXES = [
  "/pengaturan",
  "/guru",
  "/kelas",
  "/impor",
  "/semester",
  "/kenaikan-kelas",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Proteksi CSRF: tolak mutasi /api/* yang datang dari origin asing.
  // Dijalankan SEBELUM bypass agar ikut melindungi endpoint publik & login.
  if (pathname.startsWith("/api/") && isMutatingMethod(req.method)) {
    if (!assertSameOrigin(req)) {
      return NextResponse.json(
        { success: false, message: "Permintaan ditolak: origin tidak valid." },
        { status: 403 }
      );
    }
  }

  // Lewati file statis, aset Next.js, dan API publik/auth
  if (
    STATIC_ASSET_RE.test(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/public") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/public")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  let user: { id: string; name: string; role: string; email: string } | null = null;

  // Fail-closed: bila AUTH_SECRET tidak valid, token TIDAK PERNAH diverifikasi.
  const secret = tryGetJwtSecret();

  if (token && secret) {
    try {
      const { payload } = await jwtVerify(token, secret);
      user = payload as unknown as { id: string; name: string; role: string; email: string };
    } catch {
      user = null;
    }
  }

  // Jika sedang membuka halaman publik
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"));

  // Jika sudah login dan mencoba mengakses /login -> redirect ke /dashboard
  if (pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Jika belum login dan mengakses rute terlindungi
  if (!user && !isPublicPath && pathname !== "/") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Jika mengakses root "/", redirect ke dashboard jika login, atau ke login jika belum
  if (pathname === "/") {
    return NextResponse.redirect(new URL(user ? "/dashboard" : "/login", req.url));
  }

  // Jika sudah login, lakukan pemeriksaan hak akses (RBAC)
  if (user) {
    const role = user.role;

    // 1. Cek rute khusus Superadmin
    if (SUPERADMIN_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      if (role !== "SUPERADMIN") {
        return NextResponse.redirect(new URL("/dashboard?forbidden=1", req.url));
      }
    }

    // 2. Cek rute Admin & Superadmin (Guru dilarang mengelola Guru & Kelas global)
    if (ADMIN_OR_SUPERADMIN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      if (role !== "SUPERADMIN" && role !== "ADMIN") {
        return NextResponse.redirect(new URL("/dashboard?forbidden=1", req.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
