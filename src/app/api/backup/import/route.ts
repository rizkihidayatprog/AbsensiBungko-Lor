import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  exportDatabase,
  importDatabase,
  validateBackup,
  writeSnapshot,
} from "@/lib/backup";

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || sessionUser.role !== "SUPERADMIN") {
      return NextResponse.json(
        { success: false, message: "Akses ditolak. Hanya Superadmin yang dapat memulihkan backup." },
        { status: 403 }
      );
    }

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Berkas backup tidak valid (bukan JSON)." },
        { status: 400 }
      );
    }

    const validation = validateBackup(payload);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, message: validation.errors.join(" ") },
        { status: 400 }
      );
    }

    // Jalan balik: snapshot database SAAT INI ke disk sebelum menimpanya,
    // sehingga kesalahan restore bisa dibatalkan.
    const currentState = await exportDatabase();
    const snapshotFileName = await writeSnapshot(currentState);

    const importedMeta = await importDatabase(payload as Parameters<typeof importDatabase>[0]);

    await logAudit({
      actorId: sessionUser.id,
      action: "BACKUP_RESTORE",
      entityType: "System",
      entityId: null,
      oldValues: { previousSnapshot: snapshotFileName, previousCounts: currentState.meta.counts },
      newValues: { importedCounts: importedMeta.counts, importedAt: importedMeta.exportedAt },
    });

    const totalRestored = Object.values(importedMeta.counts).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      success: true,
      message: `Restore berhasil. ${totalRestored} baris data dipulihkan dari backup (${snapshotFileName} disimpan sebagai cadangan sebelumnya).`,
      restoredAt: importedMeta.exportedAt,
      counts: importedMeta.counts,
      previousSnapshot: snapshotFileName,
    });
  } catch (error: any) {
    console.error("Import Backup Error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Server error saat memulihkan backup." },
      { status: 500 }
    );
  }
}