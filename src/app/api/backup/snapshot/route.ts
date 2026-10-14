import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { promises as fs } from "fs";
import path from "path";
import { SNAPSHOT_DIR } from "@/lib/backup";

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || sessionUser.role !== "SUPERADMIN") {
      return NextResponse.json(
        { success: false, message: "Akses ditolak. Hanya Superadmin yang dapat mengunduh snapshot." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const file = searchParams.get("file") || "";

    // Cegah path traversal: hanya nama berkas polos dari direktori snapshot.
    const safeName = path.basename(file);
    if (!safeName.startsWith("absensi-backup-") || !safeName.endsWith(".json")) {
      return NextResponse.json({ success: false, message: "Nama berkas snapshot tidak valid." }, { status: 400 });
    }

    const fullPath = path.join(SNAPSHOT_DIR, safeName);
    const body = await fs.readFile(fullPath, "utf8");

    await logAudit({
      actorId: sessionUser.id,
      action: "BACKUP_EXPORT",
      entityType: "System",
      entityId: null,
      newValues: { source: "snapshot", fileName: safeName },
    });

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Content-Length": String(Buffer.byteLength(body)),
      },
    });
  } catch (error) {
    console.error("GET Snapshot Error:", error);
    return NextResponse.json({ success: false, message: "Snapshot tidak ditemukan." }, { status: 404 });
  }
}