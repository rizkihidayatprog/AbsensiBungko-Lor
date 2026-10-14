import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || sessionUser.role !== "SUPERADMIN") {
      return NextResponse.json(
        { success: false, message: "Akses ditolak. Hanya Superadmin yang dapat melihat log audit." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const entityType = searchParams.get("entityType");
    const search = searchParams.get("search") || "";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    const where: any = {
      AND: [],
    };

    if (action) {
      where.AND.push({ action });
    }

    if (entityType) {
      where.AND.push({ entityType });
    }

    if (startDate) {
      where.AND.push({
        createdAt: { gte: new Date(`${startDate}T00:00:00.000Z`) },
      });
    }

    if (endDate) {
      where.AND.push({
        createdAt: { lte: new Date(`${endDate}T23:59:59.999Z`) },
      });
    }

    if (search) {
      where.AND.push({
        OR: [
          { action: { contains: search } },
          { entityType: { contains: search } },
          { entityId: { contains: search } },
          { actor: { name: { contains: search } } },
          { actor: { email: { contains: search } } },
        ],
      });
    }

    const [total, auditLogs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      auditLogs,
    });
  } catch (error: any) {
    console.error("GET Audit Logs Error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
