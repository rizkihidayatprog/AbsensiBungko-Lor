import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { teacherCreateSchema, teacherPatchSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(2000, Math.max(1, Number(searchParams.get("perPage")) || 100));

    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { nip: { contains: search } },
          ],
        }
      : {};

    const [total, teachers] = await Promise.all([
      prisma.teacher.count({ where }),
      prisma.teacher.findMany({
        where,
        include: {
          homeroomClass: true,
          user: {
            select: { id: true, email: true, username: true, role: true, isActive: true },
          },
        },
        orderBy: { name: "asc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return NextResponse.json({
      success: true,
      teachers,
      total,
      pagination: {
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
        total,
      },
    });
  } catch (error) {
    console.error("GET Teachers Error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || (sessionUser.role !== "SUPERADMIN" && sessionUser.role !== "ADMIN")) {
      return NextResponse.json({ success: false, message: "Akses ditolak. Khusus Admin & Superadmin." }, { status: 403 });
    }

    const body = await req.json();
    const parsed = teacherCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
    const { name, nip, gender, phone, createAccount = false, email, password } = parsed.data;

    if (nip) {
      const existingNip = await prisma.teacher.findUnique({ where: { nip } });
      if (existingNip) {
        return NextResponse.json({ success: false, message: `NIP ${nip} sudah terdaftar.` }, { status: 400 });
      }
    }

    // Generate token QR unik
    const qrToken = `qr_teacher_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    const teacher = await prisma.teacher.create({
      data: {
        name: name.trim(),
        nip: nip ? nip.trim() : null,
        gender,
        phone: phone ? phone.trim() : null,
        qrTokenHash: qrToken,
        isActive: true,
      },
    });

    let createdUser = null;
    if (createAccount && email) {
      const existingUser = await prisma.user.findUnique({ where: { email: email.trim() } });
      if (existingUser) {
        return NextResponse.json({ success: false, message: `Email ${email} sudah digunakan untuk akun lain.` }, { status: 400 });
      }

      const passwordHash = await bcrypt.hash(password || "guru123", 10);
      createdUser = await prisma.user.create({
        data: {
          name: teacher.name,
          email: email.trim(),
          passwordHash,
          role: "GURU",
          teacherId: teacher.id,
          isActive: true,
        },
      });
    }

    await logAudit({
      actorId: sessionUser.id,
      action: "CREATE_TEACHER",
      entityType: "Teacher",
      entityId: teacher.id,
      newValues: { name: teacher.name, nip: teacher.nip, hasAccount: !!createdUser },
    });

    return NextResponse.json({
      success: true,
      message: `Guru ${teacher.name} berhasil ditambahkan.${createdUser ? " Akun login guru dibuat." : ""}`,
      teacher,
    });
  } catch (error: any) {
    console.error("POST Teacher Error:", error);
    return NextResponse.json({ success: false, message: error.message || "Gagal menambahkan guru." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || (sessionUser.role !== "SUPERADMIN" && sessionUser.role !== "ADMIN")) {
      return NextResponse.json({ success: false, message: "Akses ditolak. Khusus Admin & Superadmin." }, { status: 403 });
    }

    const body = await req.json();
    const parsed = teacherPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
    const { id, name, nip, gender, phone, isActive } = parsed.data;

    const updated = await prisma.teacher.update({
      where: { id },
      data: {
        name: name.trim(),
        nip: nip ? nip.trim() : null,
        gender,
        phone: phone ? phone.trim() : null,
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
      include: {
        homeroomClass: true,
      },
    });

    await logAudit({
      actorId: sessionUser.id,
      action: "UPDATE_TEACHER",
      entityType: "Teacher",
      entityId: id,
      newValues: { name: updated.name, nip: updated.nip, isActive: updated.isActive },
    });

    return NextResponse.json({
      success: true,
      message: `Data guru ${updated.name} berhasil diperbarui.`,
      teacher: updated,
    });
  } catch (error: any) {
    console.error("PATCH Teacher Error:", error);
    return NextResponse.json({ success: false, message: error.message || "Gagal memperbarui guru." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || (sessionUser.role !== "SUPERADMIN" && sessionUser.role !== "ADMIN")) {
      return NextResponse.json({ success: false, message: "Akses ditolak. Khusus Admin & Superadmin." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "ID guru wajib disertakan." }, { status: 400 });
    }

    // Soft delete / nonaktifkan
    const teacher = await prisma.teacher.update({
      where: { id },
      data: { isActive: false },
    });

    // Jika punya akun user, nonaktifkan juga
    await prisma.user.updateMany({
      where: { teacherId: id },
      data: { isActive: false },
    });

    await logAudit({
      actorId: sessionUser.id,
      action: "DEACTIVATE_TEACHER",
      entityType: "Teacher",
      entityId: id,
      newValues: { name: teacher.name, isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: `Guru ${teacher.name} berhasil dinonaktifkan.`,
    });
  } catch (error: any) {
    console.error("DELETE Teacher Error:", error);
    return NextResponse.json({ success: false, message: error.message || "Gagal menonaktifkan guru." }, { status: 500 });
  }
}
