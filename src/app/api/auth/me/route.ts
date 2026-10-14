import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, user: null }, { status: 401 });
  }

  // Ambil data fresh dari database termasuk relasi kelas wali jika guru
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
      isActive: true,
      teacher: {
        include: {
          homeroomClass: {
            select: {
              id: true,
              name: true,
              grade: true,
            },
          },
        },
      },
    },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ success: false, user: null }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      avatarUrl: user.avatarUrl ?? null,
      teacherId: user.teacherId,
      homeroomClass: user.teacher?.homeroomClass ?? null,
    },
  });
}
