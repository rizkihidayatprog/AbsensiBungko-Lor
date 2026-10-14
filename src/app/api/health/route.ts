import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Health check ringan untuk monitoring / load balancer / uptime checker.
// Publik (tanpa login) dan hanya GET; TIDAK membocorkan data sensitif.
export async function GET() {
  const startedAt = Date.now();
  let db: "ok" | "down" = "down";

  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "ok";
  } catch {
    db = "down";
  }

  const status = db === "ok" ? "ok" : "degraded";

  return NextResponse.json(
    {
      success: status === "ok",
      status,
      db,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      responseMs: Date.now() - startedAt,
    },
    { status: status === "ok" ? 200 : 503 }
  );
}