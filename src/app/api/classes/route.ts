import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

/**
 * Normalisasi nama kelas menjadi format ringkas tanpa awalan "Kelas".
 * Contoh: "Kelas 7A" -> "7A", "kelas 7a " -> "7A".
 */
function normalizeClassName(raw: string): string {
  return raw
    .trim()
    .replace(/^kelas\s+/i, "")
    .trim();
}

export async function GET() {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const classes = await prisma.class.findMany({
      include: {
        homeroom: {
          select: { id: true, name: true, nip: true },
        },
        _count: {
          select: { students: true },
        },
      },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ success: true, classes });
  } catch (error) {
    console.error("GET Classes Error:", error);
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
    const { name, grade, homeroomId } = body;

    if (!name || grade === undefined) {
      return NextResponse.json({ success: false, message: "Nama kelas dan tingkat grade wajib diisi." }, { status: 400 });
    }

    const gradeNum = Number(grade);
    if (isNaN(gradeNum) || gradeNum < 1 || gradeNum > 9) {
      return NextResponse.json({ success: false, message: "Tingkat grade harus berada di antara 1-6 (SD) atau 7-9 (SMP)." }, { status: 400 });
    }

    const newClass = await prisma.class.create({
      data: {
        name: normalizeClassName(name),
        grade: gradeNum,
        homeroomId: homeroomId || null,
      },
      include: {
        homeroom: true,
      },
    });

    await logAudit({
      actorId: sessionUser.id,
      action: "CREATE_CLASS",
      entityType: "Class",
      entityId: newClass.id,
      newValues: { name: newClass.name, grade: newClass.grade, homeroomId: newClass.homeroomId },
    });

    return NextResponse.json({
      success: true,
      message: `Kelas ${newClass.name} berhasil dibuat.`,
      class: newClass,
    });
  } catch (error: any) {
    console.error("POST Class Error:", error);
    return NextResponse.json({ success: false, message: error.message || "Gagal membuat kelas." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || (sessionUser.role !== "SUPERADMIN" && sessionUser.role !== "ADMIN")) {
      return NextResponse.json({ success: false, message: "Akses ditolak. Khusus Admin & Superadmin." }, { status: 403 });
    }

    const body = await req.json();
    const { id, name, grade, homeroomId } = body;

    if (!id || !name || grade === undefined) {
      return NextResponse.json({ success: false, message: "ID kelas, nama kelas, dan tingkat grade wajib diisi." }, { status: 400 });
    }

    const gradeNum = Number(grade);
    if (isNaN(gradeNum) || gradeNum < 1 || gradeNum > 9) {
      return NextResponse.json({ success: false, message: "Tingkat grade harus berada di antara 1-6 (SD) atau 7-9 (SMP)." }, { status: 400 });
    }

    const updatedClass = await prisma.class.update({
      where: { id },
      data: {
        name: normalizeClassName(name),
        grade: gradeNum,
        homeroomId: homeroomId || null,
      },
      include: {
        homeroom: true,
      },
    });

    await logAudit({
      actorId: sessionUser.id,
      action: "UPDATE_CLASS",
      entityType: "Class",
      entityId: id,
      newValues: { name: updatedClass.name, grade: updatedClass.grade, homeroomId: updatedClass.homeroomId },
    });

    return NextResponse.json({
      success: true,
      message: `Data kelas ${updatedClass.name} berhasil diperbarui.`,
      class: updatedClass,
    });
  } catch (error: any) {
    console.error("PATCH Class Error:", error);
    return NextResponse.json({ success: false, message: error.message || "Gagal memperbarui kelas." }, { status: 500 });
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
      return NextResponse.json({ success: false, message: "ID kelas wajib disertakan." }, { status: 400 });
    }

    const classData = await prisma.class.findUnique({
      where: { id },
      include: {
        _count: {
          select: { students: true },
        },
      },
    });

    if (!classData) {
      return NextResponse.json({ success: false, message: "Kelas tidak ditemukan." }, { status: 404 });
    }

    if (classData._count.students > 0) {
      return NextResponse.json({
        success: false,
        message: `Kelas ${classData.name} tidak dapat dihapus karena masih memiliki ${classData._count.students} siswa aktif. Pindahkan siswa terlebih dahulu.`,
      }, { status: 400 });
    }

    await prisma.class.delete({
      where: { id },
    });

    await logAudit({
      actorId: sessionUser.id,
      action: "DELETE_CLASS",
      entityType: "Class",
      entityId: id,
      oldValues: { name: classData.name, grade: classData.grade },
    });

    return NextResponse.json({
      success: true,
      message: `Kelas ${classData.name} berhasil dihapus.`,
    });
  } catch (error: any) {
    console.error("DELETE Class Error:", error);
    return NextResponse.json({ success: false, message: error.message || "Gagal menghapus kelas." }, { status: 500 });
  }
}
