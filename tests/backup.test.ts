import { describe, it, expect } from "vitest";
import {
  BACKUP_MODEL_KEYS,
  BACKUP_VERSION,
  DELETE_ORDER,
  INSERT_ORDER,
  buildBackupMeta,
  snapshotFileName,
  validateBackup,
  type BackupPayload,
} from "@/lib/backup";

function makePayload(): BackupPayload {
  const data: Record<string, unknown[]> = {};
  for (const key of BACKUP_MODEL_KEYS) {
    data[key] = [];
  }
  return { meta: buildBackupMeta(Object.fromEntries(BACKUP_MODEL_KEYS.map((k) => [k, 0]))), data };
}

describe("urutan model backup", () => {
  it("MENDELETE dan INSERT mencakup seluruh model tanpa ganda", () => {
    expect(new Set(DELETE_ORDER).size).toBe(DELETE_ORDER.length);
    expect(new Set(INSERT_ORDER).size).toBe(INSERT_ORDER.length);
    expect(DELETE_ORDER.length).toBe(15);
    expect(INSERT_ORDER.length).toBe(15);
    for (const key of BACKUP_MODEL_KEYS) {
      expect(DELETE_ORDER).toContain(key);
      expect(INSERT_ORDER).toContain(key);
    }
  });

  it("HAPUS menghapus anak sebelum induk (sanity dependency FK)", () => {
    // attendances/enrollments/leave sebelum student
    expect(DELETE_ORDER.indexOf("studentAttendance")).toBeLessThan(DELETE_ORDER.indexOf("student"));
    expect(DELETE_ORDER.indexOf("studentEnrollment")).toBeLessThan(DELETE_ORDER.indexOf("student"));
    expect(DELETE_ORDER.indexOf("leaveRequest")).toBeLessThan(DELETE_ORDER.indexOf("student"));
    // student sebelum class (FK Restrict)
    expect(DELETE_ORDER.indexOf("student")).toBeLessThan(DELETE_ORDER.indexOf("class"));
    // academicTerm sebelum academicYear (FK Cascade)
    expect(DELETE_ORDER.indexOf("academicTerm")).toBeLessThan(DELETE_ORDER.indexOf("academicYear"));
  });

  it("TAMBAH memasukkan induk sebelum anak (sanity dependency FK)", () => {
    expect(INSERT_ORDER.indexOf("academicYear")).toBeLessThan(INSERT_ORDER.indexOf("academicTerm"));
    expect(INSERT_ORDER.indexOf("class")).toBeLessThan(INSERT_ORDER.indexOf("student"));
    expect(INSERT_ORDER.indexOf("student")).toBeLessThan(INSERT_ORDER.indexOf("studentEnrollment"));
    expect(INSERT_ORDER.indexOf("student")).toBeLessThan(INSERT_ORDER.indexOf("studentAttendance"));
  });
});

describe("snapshotFileName", () => {
  it("menghasilkan nama berkas konsisten", () => {
    expect(snapshotFileName(1730000000000)).toBe("absensi-backup-1730000000000.json");
  });
});

describe("validateBackup", () => {
  it("menerima payload backup yang benar", () => {
    const res = validateBackup(makePayload());
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it("menolak nilai non-objek", () => {
    expect(validateBackup(null).valid).toBe(false);
    expect(validateBackup("abc").valid).toBe(false);
    expect(validateBackup(42).valid).toBe(false);
    expect(validateBackup(undefined).valid).toBe(false);
  });

  it("menolak bila meta hilang", () => {
    const payload = makePayload();
    const partial: Partial<BackupPayload> = { data: payload.data };
    const res = validateBackup(partial);
    expect(res.valid).toBe(false);
    expect(res.errors.join(" ")).toContain("Metadata");
  });

  it("menolak versi backup tidak didukung", () => {
    const payload = makePayload();
    payload.meta.version = "999";
    const res = validateBackup(payload);
    expect(res.valid).toBe(false);
    expect(res.errors.join(" ")).toContain("Versi backup");
  });

  it("menolak berkas dari aplikasi lain", () => {
    const payload = makePayload();
    payload.meta.app = "aplikasi-lain";
    const res = validateBackup(payload);
    expect(res.valid).toBe(false);
    expect(res.errors.join(" ")).toContain("bukan backup aplikasi ini");
  });

  it("menolak bila blok data hilang", () => {
    const payload = makePayload();
    const partial: Partial<BackupPayload> = { meta: payload.meta };
    const res = validateBackup(partial);
    expect(res.valid).toBe(false);
  });

  it("menolak bila salah satu tabel bukan array", () => {
    const payload = makePayload();
    payload.data.student = "bukan-array" as unknown as unknown[];
    const res = validateBackup(payload);
    expect(res.valid).toBe(false);
    expect(res.errors.join(" ")).toContain("student");
  });
});

describe("buildBackupMeta", () => {
  it("mengisi metadata versi/aplikasi/waktu", () => {
    const meta = buildBackupMeta({ student: 3 });
    expect(meta.version).toBe(BACKUP_VERSION);
    expect(meta.app).toBe("absensi-sekolah");
    expect(meta.counts.student).toBe(3);
    expect(new Date(meta.exportedAt).getTime()).not.toBeNaN();
  });
});