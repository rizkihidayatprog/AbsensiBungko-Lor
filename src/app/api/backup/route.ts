import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { exportDatabase, listSnapshots, BACKUP_MODEL_KEYS } from "@/lib/backup";

export async function GET() {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || sessionUser.role !== "SUPERADMIN") {
      return NextResponse.json(
        { success: false, message: "Akses ditolak. Hanya Superadmin yang dapat mengelola backup." },
        { status: 403 }
      );
    }

    const current = await exportDatabase();
    const snapshots = await listSnapshots();

    return NextResponse.json({
      success: true,
      stats: {
        totalRows: Object.values(current.meta.counts).reduce((a, b) => a + b, 0),
        tables: Object.keys(current.meta.counts).length,
        counts: current.meta.counts,
        exportedAt: current.meta.exportedAt,
        modelKeys: BACKUP_MODEL_KEYS,
      },
      snapshots,
    });
  } catch (error) {
    console.error("GET Backup Info Error:", error);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}