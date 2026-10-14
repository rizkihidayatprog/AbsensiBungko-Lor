import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { validatePasswordStrength } from "@/lib/password";

export async function GET() {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        avatarUrl: true,
        teacherId: true,
        createdAt: true,
        teacher: {
          select: {
            nip: true,
            phone: true,
            homeroomClass: {
              select: { id: true, name: true, grade: true },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("GET Profile Error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, username, email, avatarUrl, currentPassword, newPassword } = body;

    const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
    if (!user) {
      return NextResponse.json({ success: false, message: "Pengguna tidak ditemukan." }, { status: 404 });
    }

    // Validasi email jika diubah
    if (email && email.trim() !== user.email) {
      const emailExist = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
      if (emailExist) {
        return NextResponse.json({ success: false, message: "Email sudah digunakan oleh akun lain." }, { status: 400 });
      }
    }

    // Validasi username jika diubah
    if (username && username.trim() !== user.username) {
      const usernameExist = await prisma.user.findUnique({ where: { username: username.trim().toLowerCase() } });
      if (usernameExist) {
        return NextResponse.json({ success: false, message: "Username sudah digunakan oleh akun lain." }, { status: 400 });
      }
    }

    let updatedPasswordHash: string | undefined = undefined;

    // Jika ingin ganti password
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { success: false, message: "Password lama wajib diisi untuk verifikasi penggantian password." },
          { status: 400 }
        );
      }

      const isMatch = await verifyPassword(currentPassword, user.passwordHash);
      if (!isMatch) {
        return NextResponse.json(
          { success: false, message: "Password lama tidak sesuai." },
          { status: 400 }
        );
      }

      const pwCheck = validatePasswordStrength(newPassword);

      if (!pwCheck.valid) {
        return NextResponse.json({ success: false, message: pwCheck.message || "Password tidak valid." }, { status: 400 });
      }

      updatedPasswordHash = await hashPassword(newPassword);
    }

    const oldValues = {
      name: user.name,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
    };

    const newValues: any = {
      name: name ? name.trim() : user.name,
      email: email ? email.trim().toLowerCase() : user.email,
      username: username ? username.trim().toLowerCase() : user.username,
      avatarUrl: avatarUrl !== undefined ? avatarUrl : user.avatarUrl,
    };

    if (updatedPasswordHash) {
      newValues.passwordHash = updatedPasswordHash;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: newValues,
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        avatarUrl: true,
        teacherId: true,
        createdAt: true,
      },
    });

    // Catat Audit Log
    await logAudit({
      actorId: user.id,
      action: "UPDATE_PROFILE",
      entityType: "User",
      entityId: user.id,
      oldValues,
      newValues: {
        name: updated.name,
        email: updated.email,
        username: updated.username,
        avatarUrl: updated.avatarUrl,
        passwordChanged: Boolean(updatedPasswordHash),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Profil pengguna berhasil diperbarui.",
      user: updated,
    });
  } catch (error) {
    console.error("PATCH Profile Error:", error);
    return NextResponse.json({ success: false, message: "Server error saat memperbarui profil." }, { status: 500 });
  }
}
