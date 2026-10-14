import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword, createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { checkRateLimit, getClientIp, formatRetryAfter } from "@/lib/rate-limit";

const LOGIN_RATE_LIMIT = {
  bucket: "login",
  limit: 10,
  windowMs: 15 * 60 * 1000,
};

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    const rate = await checkRateLimit(ip, LOGIN_RATE_LIMIT);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: `Terlalu banyak percobaan login. Silakan coba lagi dalam ${formatRetryAfter(rate.retryAfterMs)}.`,
        },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) } }
      );
    }

    const body = await req.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, message: "Email/username dan password wajib diisi." },
        { status: 400 }
      );
    }

    // Cari berdasarkan email atau username
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
      include: {
        teacher: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Email/username atau password salah." },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, message: "Akun Anda telah dinonaktifkan. Hubungi administrator." },
        { status: 403 }
      );
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, message: "Email/username atau password salah." },
        { status: 401 }
      );
    }

    // Generate JWT Session Token
    const sessionToken = await createSessionToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      teacherId: user.teacherId,
    });

    // Catat log audit login
    const ipAddress = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "";
    await logAudit({
      actorId: user.id,
      action: "LOGIN",
      entityType: "User",
      entityId: user.id,
      newValues: { name: user.name, role: user.role, email: user.email },
      ipAddress,
      userAgent,
    });

    const response = NextResponse.json({
      success: true,
      message: "Login berhasil.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        teacherId: user.teacherId,
      },
    });

    // Deteksi apakah koneksi benar-benar menggunakan HTTPS
    const isHttps =
      req.headers.get("x-forwarded-proto") === "https" ||
      req.nextUrl.protocol === "https:";
    const isSecure = process.env.NODE_ENV === "production" && isHttps;

    // Set HTTP-Only Session Cookie (kompatibel penuh dengan Safari di localhost/HTTP & produksi/HTTPS)
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 jam
    });

    return response;
  } catch (error) {
    console.error("Login API Error:", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan internal pada server." },
      { status: 500 }
    );
  }
}
