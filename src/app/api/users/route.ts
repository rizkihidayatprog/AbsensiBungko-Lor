import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit";
import { Role } from "@prisma/client";
import { validatePasswordStrength } from "@/lib/password";
import { userCreateSchema, userPatchSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || sessionUser.role !== "SUPERADMIN") {
      return NextResponse.json(
        { success: false, message: "Akses ditolak. Hanya Superadmin yang dapat mengakses data akun." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") as Role | null;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(2000, Math.max(1, Number(searchParams.get("perPage")) || 100));

    const where = {
      AND: [
        role ? { role } : {},
        search
          ? {
              OR: [
                { name: { contains: search } },
                { email: { contains: search } },
                { username: { contains: search } },
              ],
            }
          : {},
      ],
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          role: true,
          avatarUrl: true,
          isActive: true,
          teacherId: true,
          teacher: {
            select: {
              id: true,
              nip: true,
              name: true,
              homeroomClass: {
                select: { id: true, name: true },
              },
            },
          },
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ role: "asc" }, { name: "asc" }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return NextResponse.json({
      success: true,
      users,
      total,
      pagination: {
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
        total,
      },
    });
  } catch (error: any) {
    console.error("GET Users Error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || sessionUser.role !== "SUPERADMIN") {
      return NextResponse.json(
        { success: false, message: "Hanya Superadmin yang dapat membuat akun pengguna." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = userCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
    const { name, email, username, password, role, teacherId, avatarUrl } = parsed.data;

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username ? username.trim().toLowerCase() : null;

    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      return NextResponse.json(
        { success: false, message: strength.message },
        { status: 400 }
      );
    }

    const existingEmail = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existingEmail) {
      return NextResponse.json({ success: false, message: `Email '${email}' sudah digunakan.` }, { status: 400 });
    }

    if (cleanUsername) {
      const existingUser = await prisma.user.findUnique({ where: { username: cleanUsername } });
      if (existingUser) {
        return NextResponse.json({ success: false, message: `Username '${username}' sudah digunakan.` }, { status: 400 });
      }
    }

    if (role === "GURU" && teacherId) {
      const existingTeacherLink = await prisma.user.findUnique({ where: { teacherId } });
      if (existingTeacherLink) {
        return NextResponse.json({ success: false, message: "Guru tersebut sudah memiliki akun login." }, { status: 400 });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        username: cleanUsername,
        passwordHash,
        role: role as Role,
        avatarUrl: avatarUrl || null,
        teacherId: role === "GURU" ? teacherId || null : null,
        isActive: true,
      },
    });

    await logAudit({
      actorId: sessionUser.id,
      action: "CREATE_USER",
      entityType: "User",
      entityId: user.id,
      newValues: { name: user.name, email: user.email, role: user.role },
    });

    return NextResponse.json({
      success: true,
      message: `Akun untuk ${user.name} (${user.role}) berhasil dibuat.`,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error: any) {
    console.error("POST User Error:", error);
    return NextResponse.json({ success: false, message: error.message || "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || sessionUser.role !== "SUPERADMIN") {
      return NextResponse.json(
        { success: false, message: "Hanya Superadmin yang dapat mengedit data akun." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = userPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
    const { id, name, email, username, password, role, isActive, teacherId, avatarUrl } = parsed.data;

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ success: false, message: "Akun pengguna tidak ditemukan." }, { status: 404 });
    }

    // Perlindungan: Dilarang menonaktifkan atau menurunkan role akun diri sendiri
    if (targetUser.id === sessionUser.id) {
      if (isActive === false) {
        return NextResponse.json(
          { success: false, message: "Anda tidak dapat menonaktifkan akun Anda sendiri." },
          { status: 400 }
        );
      }
      if (role && role !== "SUPERADMIN") {
        return NextResponse.json(
          { success: false, message: "Anda tidak dapat menurunkan peran (role) akun Anda sendiri." },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      if (cleanEmail !== targetUser.email) {
        const exist = await prisma.user.findUnique({ where: { email: cleanEmail } });
        if (exist) {
          return NextResponse.json({ success: false, message: `Email '${email}' sudah digunakan akun lain.` }, { status: 400 });
        }
        updateData.email = cleanEmail;
      }
    }
    if (username !== undefined) {
      const cleanUsername = username ? username.trim().toLowerCase() : null;
      if (cleanUsername && cleanUsername !== targetUser.username) {
        const exist = await prisma.user.findUnique({ where: { username: cleanUsername } });
        if (exist) {
          return NextResponse.json({ success: false, message: `Username '${username}' sudah digunakan akun lain.` }, { status: 400 });
        }
      }
      updateData.username = cleanUsername;
    }
    if (role) updateData.role = role as Role;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (teacherId !== undefined) updateData.teacherId = teacherId || null;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl || null;

    if (password && password.trim().length > 0) {
      const strength = validatePasswordStrength(password.trim());
      if (!strength.valid) {
        return NextResponse.json(
          { success: false, message: strength.message },
          { status: 400 }
        );
      }
      updateData.passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    await logAudit({
      actorId: sessionUser.id,
      action: "UPDATE_USER",
      entityType: "User",
      entityId: id,
      oldValues: { name: targetUser.name, email: targetUser.email, role: targetUser.role, isActive: targetUser.isActive },
      newValues: { name: updatedUser.name, email: updatedUser.email, role: updatedUser.role, isActive: updatedUser.isActive, passwordChanged: !!password },
    });

    return NextResponse.json({
      success: true,
      message: `Data akun ${updatedUser.name} berhasil diperbarui.`,
      user: updatedUser,
    });
  } catch (error: any) {
    console.error("PATCH User Error:", error);
    return NextResponse.json({ success: false, message: error.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || sessionUser.role !== "SUPERADMIN") {
      return NextResponse.json(
        { success: false, message: "Hanya Superadmin yang dapat menonaktifkan akun." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "ID akun wajib disertakan." }, { status: 400 });
    }

    if (id === sessionUser.id) {
      return NextResponse.json({ success: false, message: "Anda tidak dapat menonaktifkan akun sendiri." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ success: false, message: "Akun tidak ditemukan." }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
    });

    await logAudit({
      actorId: sessionUser.id,
      action: updated.isActive ? "ACTIVATE_USER" : "DEACTIVATE_USER",
      entityType: "User",
      entityId: id,
      newValues: { isActive: updated.isActive },
    });

    return NextResponse.json({
      success: true,
      message: `Akun "${user.name}" berhasil ${updated.isActive ? "diaktifkan" : "dinonaktifkan"}.`,
    });
  } catch (error: any) {
    console.error("DELETE User Error:", error);
    return NextResponse.json({ success: false, message: error.message || "Server error" }, { status: 500 });
  }
}
