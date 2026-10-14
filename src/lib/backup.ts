import prisma from "@/lib/prisma";
import type { PrismaClient, Prisma } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Backup & Restore aplikatif (tanpa mysqldump).
//
// Strategi: ekspor seluruh 15 tabel via Prisma menjadi satu berkas JSON, lalu
// impor kembali secara transaksional. Urutan HAPUS harus POST-order dependency
// (anak dulu), urutan TAMBAH harus PRE-order (induk dulu) agar tidak melanggar
// foreign key MySQL.
//
// Penting: akses model dilakukan lewat tabel aksesor STATIS (bukan `client[key]`
// dinamis) karena delegate Prisma adalah Proxy dan akses properti dinamis
// dengan string komputasi tidak andal di bundel Next.js (mengembalikan undefined
// untuk `client[k]`), sementara akses statis `prisma.user` berfungsi normal.
// ---------------------------------------------------------------------------

export const BACKUP_VERSION = "1";
export const APP_NAME = "absensi-sekolah";

// Seluruh model yang ikut di-backup (nama akses Prisma, camelCase = nama tabel)
export const BACKUP_MODEL_KEYS = [
  "academicYear",
  "academicTerm",
  "studentEnrollment",
  "user",
  "class",
  "student",
  "teacher",
  "studentAttendance",
  "teacherAttendance",
  "leaveRequest",
  "schoolSetting",
  "holiday",
  "auditLog",
  "rateLimitHit",
  "whatsAppLog",
] as const;

// Urutan hapus: anak/tergantung dihapus lebih dulu, induk menyusul.
// (berdasarkan FK schema.prisma; mis. class.homeroomId -> teacher,
//  user.teacherId -> teacher, student.classId -> class)
export const DELETE_ORDER: readonly string[] = [
  "studentAttendance",
  "teacherAttendance",
  "leaveRequest",
  "studentEnrollment",
  "auditLog",
  "whatsAppLog",
  "rateLimitHit",
  "holiday",
  "schoolSetting",
  "student",
  "user",
  "class",
  "teacher",
  "academicTerm",
  "academicYear",
];

// Urutan tambah: induk dimasukkan lebih dulu, anak menyusul.
export const INSERT_ORDER: readonly string[] = [
  "academicYear",
  "academicTerm",
  "teacher",
  "class",
  "user",
  "student",
  "studentEnrollment",
  "studentAttendance",
  "teacherAttendance",
  "leaveRequest",
  "schoolSetting",
  "holiday",
  "auditLog",
  "whatsAppLog",
  "rateLimitHit",
];

export interface BackupMeta {
  version: string;
  app: string;
  exportedAt: string; // ISO (UTC)
  counts: Record<string, number>;
}

export interface BackupPayload {
  meta: BackupMeta;
  data: Record<string, unknown[]>;
}

export class BackupValidationError extends Error {
  code = "BACKUP_INVALID";
}

type Db = PrismaClient | Prisma.TransactionClient;
type ListFn = (db: Db) => Promise<unknown[]>;
type DeleteFn = (db: Db) => Promise<unknown>;
type CreateFn = (db: Db, rows: unknown[]) => Promise<unknown>;

// Aksesor statis per model (nama accessor Prisma).
const ACCESSORS = {
  academicYear: {
    list: (db) => db.academicYear.findMany(),
    del: (db) => db.academicYear.deleteMany(),
    create: (db, rows) => db.academicYear.createMany({ data: rows as never }),
  },
  academicTerm: {
    list: (db) => db.academicTerm.findMany(),
    del: (db) => db.academicTerm.deleteMany(),
    create: (db, rows) => db.academicTerm.createMany({ data: rows as never }),
  },
  class: {
    list: (db) => db.class.findMany(),
    del: (db) => db.class.deleteMany(),
    create: (db, rows) => db.class.createMany({ data: rows as never }),
  },
  teacher: {
    list: (db) => db.teacher.findMany(),
    del: (db) => db.teacher.deleteMany(),
    create: (db, rows) => db.teacher.createMany({ data: rows as never }),
  },
  user: {
    list: (db) => db.user.findMany(),
    del: (db) => db.user.deleteMany(),
    create: (db, rows) => db.user.createMany({ data: rows as never }),
  },
  student: {
    list: (db) => db.student.findMany(),
    del: (db) => db.student.deleteMany(),
    create: (db, rows) => db.student.createMany({ data: rows as never }),
  },
  studentEnrollment: {
    list: (db) => db.studentEnrollment.findMany(),
    del: (db) => db.studentEnrollment.deleteMany(),
    create: (db, rows) => db.studentEnrollment.createMany({ data: rows as never }),
  },
  studentAttendance: {
    list: (db) => db.studentAttendance.findMany(),
    del: (db) => db.studentAttendance.deleteMany(),
    create: (db, rows) => db.studentAttendance.createMany({ data: rows as never }),
  },
  teacherAttendance: {
    list: (db) => db.teacherAttendance.findMany(),
    del: (db) => db.teacherAttendance.deleteMany(),
    create: (db, rows) => db.teacherAttendance.createMany({ data: rows as never }),
  },
  leaveRequest: {
    list: (db) => db.leaveRequest.findMany(),
    del: (db) => db.leaveRequest.deleteMany(),
    create: (db, rows) => db.leaveRequest.createMany({ data: rows as never }),
  },
  schoolSetting: {
    list: (db) => db.schoolSetting.findMany(),
    del: (db) => db.schoolSetting.deleteMany(),
    create: (db, rows) => db.schoolSetting.createMany({ data: rows as never }),
  },
  holiday: {
    list: (db) => db.holiday.findMany(),
    del: (db) => db.holiday.deleteMany(),
    create: (db, rows) => db.holiday.createMany({ data: rows as never }),
  },
  auditLog: {
    list: (db) => db.auditLog.findMany(),
    del: (db) => db.auditLog.deleteMany(),
    create: (db, rows) => db.auditLog.createMany({ data: rows as never }),
  },
  rateLimitHit: {
    list: (db) => db.rateLimitHit.findMany(),
    del: (db) => db.rateLimitHit.deleteMany(),
    create: (db, rows) => db.rateLimitHit.createMany({ data: rows as never }),
  },
  whatsAppLog: {
    list: (db) => db.whatsAppLog.findMany(),
    del: (db) => db.whatsAppLog.deleteMany(),
    create: (db, rows) => db.whatsAppLog.createMany({ data: rows as never }),
  },
} satisfies Record<string, { list: ListFn; del: DeleteFn; create: CreateFn }>;

export function buildBackupMeta(counts: Record<string, number>): BackupMeta {
  return {
    version: BACKUP_VERSION,
    app: APP_NAME,
    exportedAt: new Date().toISOString(),
    counts,
  };
}

// Ekspor seluruh tabel database menjadi satu payload JSON siap-unduh.
export async function exportDatabase(): Promise<BackupPayload> {
  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  for (const key of BACKUP_MODEL_KEYS) {
    const rows = await ACCESSORS[key].list(prisma);
    data[key] = rows;
    counts[key] = rows.length;
  }

  return { meta: buildBackupMeta(counts), data };
}

// Validasi struktur payload backup. Murni — dipakai di API, UI, dan unit test.
export function validateBackup(value: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!value || typeof value !== "object") {
    return { valid: false, errors: ["Berkas bukan objek JSON valid."] };
  }

  const payload = value as Partial<BackupPayload>;
  const meta = payload.meta;

  if (!meta || typeof meta !== "object") {
    errors.push("Metadata (meta) tidak ditemukan.");
  } else {
    if (meta.version !== BACKUP_VERSION) {
      errors.push(
        `Versi backup tidak didukung (ditemukan "${meta.version}", sistem membutuhkan "${BACKUP_VERSION}").`
      );
    }
    if (!meta.exportedAt) {
      errors.push("Waktu ekspor (exportedAt) tidak ditemukan.");
    }
    if (meta.app && meta.app !== APP_NAME) {
      errors.push(`Berkas bukan backup aplikasi ini (app = "${meta.app}").`);
    }
  }

  if (!payload.data || typeof payload.data !== "object") {
    errors.push("Blok data tidak ditemukan.");
    return { valid: errors.length === 0, errors };
  }

  for (const key of BACKUP_MODEL_KEYS) {
    if (!Array.isArray(payload.data[key])) {
      errors.push(`Bagian "${key}" hilang atau bukan larik (array).`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export const SNAPSHOT_DIR = path.join(process.cwd(), "storage", "backups");

export function snapshotFileName(epochMs: number): string {
  return `absensi-backup-${epochMs}.json`;
}

// Simpan snapshot backup ke disk (dipakai sebagai jalan balik sebelum restore).
export async function writeSnapshot(payload: BackupPayload): Promise<string> {
  await fs.mkdir(SNAPSHOT_DIR, { recursive: true });
  const fileName = snapshotFileName(Date.now());
  await fs.writeFile(path.join(SNAPSHOT_DIR, fileName), JSON.stringify(payload, null, 2), "utf8");
  return fileName;
}

export interface SnapshotInfo {
  fileName: string;
  size: number;
  exportedAt: Date;
}

// Daftar snapshot yang tersimpan di disk (terbaru dulu).
export async function listSnapshots(): Promise<SnapshotInfo[]> {
  await fs.mkdir(SNAPSHOT_DIR, { recursive: true });
  const entries = await fs.readdir(SNAPSHOT_DIR, { withFileTypes: true });
  const snapshots: SnapshotInfo[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith("absensi-backup-") || !entry.name.endsWith(".json")) {
      continue;
    }
    const epochStr = entry.name.replace("absensi-backup-", "").replace(".json", "");
    const epoch = Number(epochStr);
    if (!Number.isFinite(epoch) || epoch <= 0) continue;

    const stat = await fs.stat(path.join(SNAPSHOT_DIR, entry.name));
    snapshots.push({ fileName: entry.name, size: stat.size, exportedAt: new Date(epoch) });
  }

  return snapshots.sort((a, b) => b.exportedAt.getTime() - a.exportedAt.getTime());
}

// Baca payload backup dari sebuah snapshot di disk.
export async function readSnapshot(fileName: string): Promise<BackupPayload> {
  const fullPath = path.join(SNAPSHOT_DIR, fileName);
  const raw = await fs.readFile(fullPath, "utf8");
  return JSON.parse(raw) as BackupPayload;
}

// Pulihkan database dari payload backup (DESTRUKTIF: menghapus seluruh data
// saat ini lalu menggantinya). DIJALANKAN DALAM SATU TRANSAKSI.
export async function importDatabase(payload: BackupPayload): Promise<BackupPayload["meta"]> {
  const validation = validateBackup(payload);
  if (!validation.valid) {
    throw new BackupValidationError(validation.errors.join(" "));
  }

  await prisma.$transaction(async (tx) => {
    for (const key of DELETE_ORDER) {
      await ACCESSORS[key as keyof typeof ACCESSORS].del(tx);
    }

    for (const key of INSERT_ORDER) {
      const rows = payload.data[key];
      if (rows && rows.length > 0) {
        await ACCESSORS[key as keyof typeof ACCESSORS].create(tx, rows);
      }
    }
  });

  return payload.meta;
}