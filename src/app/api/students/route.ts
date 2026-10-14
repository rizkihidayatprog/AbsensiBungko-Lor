import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateQrToken } from "@/lib/qr";
import { logAudit } from "@/lib/audit";
import { studentCreateSchema, studentPatchSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const classId = searchParams.get("classId");
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const perPage = Math.min(2000, Math.max(1, Number(searchParams.get("perPage")) || 100));

    // Jika user adalah GURU, hanya boleh melihat kelas yang diampunya
    let filterClassId: string | undefined = classId || undefined;
    if (sessionUser.role === "GURU") {
      const teacher = await prisma.teacher.findUnique({
        where: { id: sessionUser.teacherId || "" },
        include: { homeroomClass: true },
      });
      if (!teacher?.homeroomClass) {
        return NextResponse.json({
          success: true,
          students: [],
          total: 0,
          pagination: { page: 1, perPage, totalPages: 0, total: 0 },
        });
      }
      filterClassId = teacher.homeroomClass.id;
    }

    const where = {
      AND: [
        filterClassId ? { classId: filterClassId } : {},
        search
          ? {
              OR: [
                { name: { contains: search } },
                { nis: { contains: search } },
              ],
            }
          : {},
      ],
    };

    const [total, students] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        include: {
          class: true,
        },
        orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);

    return NextResponse.json({
      success: true,
      students,
      total,
      pagination: {
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
        total,
      },
    });
  } catch (error) {
    console.error("GET Students Error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || (sessionUser.role !== "SUPERADMIN" && sessionUser.role !== "ADMIN")) {
      return NextResponse.json({ success: false, message: "Hanya Admin dan Superadmin yang dapat menambah siswa." }, { status: 403 });
    }

    const body = await req.json();
    const parsed = studentCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
    const { nis, nisn, name, gender, classId, photoUrl, parentName, parentPhone } = parsed.data;

    // Cek duplikasi NIS
    const existing = await prisma.student.findUnique({ where: { nis } });
    if (existing) {
      return NextResponse.json({ success: false, message: `NIS ${nis} sudah terdaftar.` }, { status: 400 });
    }

    // Generate QR Token unik
    const qrToken = generateQrToken();

    const student = await prisma.student.create({
      data: {
        nis,
        nisn: nisn || null,
        name,
        gender,
        classId,
        photoUrl: photoUrl || null,
        parentName: parentName ? parentName.trim() : null,
        parentPhone: parentPhone ? parentPhone.trim() : null,
        qrTokenHash: qrToken,
        isActive: true,
      },
      include: {
        class: true,
      },
    });

    // Catat Audit Log
    await logAudit({
      actorId: sessionUser.id,
      action: "CREATE_STUDENT",
      entityType: "Student",
      entityId: student.id,
      newValues: { nis: student.nis, name: student.name, classId: student.classId, photoUrl: student.photoUrl },
    });

    return NextResponse.json({ success: true, message: "Siswa berhasil ditambahkan.", student });
  } catch (error) {
    console.error("POST Student Error:", error);
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
    const parsed = studentPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
    const { id, nis, nisn, name, gender, classId, photoUrl, parentName, parentPhone, isActive } = parsed.data;

    const currentStudent = await prisma.student.findUnique({
      where: { id },
      include: { class: true },
    });

    if (!currentStudent) {
      return NextResponse.json({ success: false, message: "Data siswa tidak ditemukan." }, { status: 404 });
    }

    // Role Guru hanya boleh edit siswa di kelas perwaliannya
    if (sessionUser.role === "GURU") {
      const teacher = await prisma.teacher.findUnique({
        where: { id: sessionUser.teacherId || "" },
        include: { homeroomClass: true },
      });
      if (currentStudent.classId !== teacher?.homeroomClass?.id) {
        return NextResponse.json(
          { success: false, message: "Anda hanya memiliki izin mengubah data siswa kelas perwalian Anda." },
          { status: 403 }
        );
      }
    }

    // Jika NIS diubah, cek duplikasi
    if (nis && nis !== currentStudent.nis) {
      const existing = await prisma.student.findUnique({ where: { nis } });
      if (existing) {
        return NextResponse.json({ success: false, message: `NIS ${nis} sudah terdaftar pada siswa lain.` }, { status: 400 });
      }
    }

    const oldValues = {
      nis: currentStudent.nis,
      name: currentStudent.name,
      classId: currentStudent.classId,
      photoUrl: currentStudent.photoUrl,
      parentName: currentStudent.parentName,
      parentPhone: currentStudent.parentPhone,
    };

    const updated = await prisma.student.update({
      where: { id },
      data: {
        ...(nis ? { nis: nis.trim() } : {}),
        ...(nisn !== undefined ? { nisn: nisn ? nisn.trim() : null } : {}),
        ...(name ? { name: name.trim() } : {}),
        ...(gender ? { gender } : {}),
        ...(classId ? { classId } : {}),
        ...(photoUrl !== undefined ? { photoUrl: photoUrl || null } : {}),
        ...(parentName !== undefined ? { parentName: parentName ? parentName.trim() : null } : {}),
        ...(parentPhone !== undefined ? { parentPhone: parentPhone ? parentPhone.trim() : null } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
      include: {
        class: true,
      },
    });

    await logAudit({
      actorId: sessionUser.id,
      action: "UPDATE_STUDENT",
      entityType: "Student",
      entityId: id,
      oldValues,
      newValues: {
        nis: updated.nis,
        name: updated.name,
        classId: updated.classId,
        photoUrl: updated.photoUrl,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Data siswa dan foto profil berhasil diperbarui.",
      student: updated,
    });
  } catch (error) {
    console.error("PATCH Student Error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
