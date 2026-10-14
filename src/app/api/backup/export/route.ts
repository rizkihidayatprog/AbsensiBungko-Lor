import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { exportDatabase } from "@/lib/backup";

export async function GET() {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || sessionUser.role !== "SUPERADMIN") {
      return NextResponse.json(
        { success: false, message: "Akses ditolak. Hanya Superadmin yang dapat mengekspor backup." },
        { status: 403 }
      );
    }

    const payload = await exportDatabase();
    const body = JSON.stringify(payload, null, 2);

    await logAudit({
      actorId: sessionUser.id,
      action: "BACKUP_EXPORT",
      entityType: "System",
      entityId: null,
      newValues: {
        totalRows: Object.values(payload.meta.counts).reduce((a, b) => a + b, 0),
        counts: payload.meta.counts,
        exportedAt: payload.meta.exportedAt,
      },
    });

    const fileName = `absensi-sekolah-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(Buffer.byteLength(body)),
      },
    });
  } catch (error) {
    console.error("Export Backup Error:", error);
    return NextResponse.json({ success: false, message: "Server error saat mengekspor backup." }, { status: 500 });
  }
}