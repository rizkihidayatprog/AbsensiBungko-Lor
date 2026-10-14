"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  DatabaseBackup,
  ShieldAlert,
  Download,
  Upload,
  RefreshCw,
  FileJson,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  Loader2,
  Database,
} from "lucide-react";

const MODEL_LABELS: Record<string, string> = {
  academicYear: "Tahun Ajaran",
  academicTerm: "Semester / Periode",
  studentEnrollment: "Penempatan Siswa",
  user: "Akun Pengguna",
  class: "Kelas",
  student: "Siswa",
  teacher: "Guru",
  studentAttendance: "Presensi Siswa",
  teacherAttendance: "Presensi Guru",
  leaveRequest: "Pengajuan Izin",
  schoolSetting: "Pengaturan Sekolah",
  holiday: "Hari Libur",
  auditLog: "Log Audit",
  rateLimitHit: "Batas Kecepatan",
  whatsappLog: "Log WhatsApp",
};

interface SnapshotInfo {
  fileName: string;
  size: number;
  exportedAt: string;
}

interface Stats {
  totalRows: number;
  tables: number;
  counts: Record<string, number>;
  exportedAt: string;
}

interface MeUser {
  id: string;
  name: string;
  email: string;
  role: "SUPERADMIN" | "ADMIN" | "GURU";
  avatarUrl?: string | null;
  teacherId?: string | null;
}

interface PreviewPayload {
  meta: { version: string; exportedAt: string; counts?: Record<string, number> };
  data: Record<string, unknown[]>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }) + " • " + d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BackupPage() {
  const [currentUser, setCurrentUser] = useState<MeUser | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const fetchInfo = useCallback(async () => {
    try {
      setLoading(true);
      const [resMe, resInfo] = await Promise.all([fetch("/api/auth/me"), fetch("/api/backup")]);
      const [dataMe, dataInfo] = await Promise.all([resMe.json(), resInfo.json()]);
      if (dataMe.success) setCurrentUser(dataMe.user);
      if (dataInfo.success) {
        setStats(dataInfo.stats);
        setSnapshots(dataInfo.snapshots || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  const handleFile = (file: File) => {
    setFileName(file.name);
    setPreviewError("");
    setResult(null);
    setConfirmText("");
    setPreview(null);

    if (!file.name.toLowerCase().endsWith(".json")) {
      setPreviewError("Pilih berkas backup berformat .json.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed?.meta || !parsed?.data) throw new Error("struktur tidak dikenal");
        setPreview(parsed as PreviewPayload);
      } catch {
        setPreviewError("Berkas tidak dapat dibaca sebagai backup JSON yang valid.");
        if (fileRef.current) fileRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!preview) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preview),
      });
      const data = await res.json().catch(() => ({ success: false, message: "Respons tidak terbaca." }));
      setResult({ ok: data.success, message: data.message || (data.success ? "Restore berhasil." : "Restore gagal.") });
      if (data.success) {
        setFileName("");
        setPreview(null);
        setConfirmText("");
        if (fileRef.current) fileRef.current.value = "";
        fetchInfo();
      }
    } catch (e) {
      setResult({ ok: false, message: "Gagal terhubung ke server: " + (e instanceof Error ? e.message : String(e)) });
    } finally {
      setBusy(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-xs text-slate-500">
        Memuat modul backup...
      </div>
    );
  }

  if (currentUser.role !== "SUPERADMIN") {
    return (
      <AppShell user={currentUser}>
        <div className="max-w-2xl mx-auto p-8 bg-white rounded-2xl border border-rose-200 shadow-xs text-center">
          <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h1 className="font-bold text-slate-900">Akses Ditolak</h1>
          <p className="text-xs text-slate-500 mt-1.5">
            Halaman ini khusus untuk Superadmin. Hubungi administrator sistem.
          </p>
        </div>
      </AppShell>
    );
  }

  const totalCounts = stats?.counts || {};
  const importReady = preview !== null && confirmText.trim().toUpperCase() === "PULIHKAN";

  return (
    <AppShell user={currentUser}>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <DatabaseBackup className="w-5 h-5" />
              </div>
              Backup &amp; Restore Database
            </h1>
            <p className="text-xs text-slate-500 mt-1.5">
              Ekspor seluruh data sekolah ke berkas JSON, atau pulihkan dari berkas backup.
              Seluruh data saat ini otomatis disimpan sebagai snapshot sebelum pemulihan.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/api/backup/export"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
            >
              <Download className="w-3.5 h-3.5" /> Ekspor Backup Sekarang
            </a>
            <button
              onClick={fetchInfo}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Muat Ulang
            </button>
          </div>
        </div>

        {result && (
          <div
            className={`p-4 rounded-xl border shadow-xs flex items-start gap-3 ${
              result.ok ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"
            }`}
          >
            {result.ok ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <p className={`text-xs font-semibold ${result.ok ? "text-emerald-800" : "text-rose-800"}`}>
              {result.message}
            </p>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-10 text-center text-xs text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
            Memuat statistik database...
          </div>
        ) : (
          <>
            {/* Ringkasan kondisi database saat ini */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <Database className="w-4 h-4 text-indigo-600" />
                <h2 className="font-bold text-sm text-slate-900">Kondisi Database Saat Ini</h2>
                {stats?.exportedAt && (
                  <span className="text-[10px] text-slate-400 font-mono ml-auto">
                    dihitung {formatDateTime(stats.exportedAt)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {Object.entries(totalCounts).map(([key, count]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200"
                  >
                    <span className="text-xs font-semibold text-slate-600">
                      {MODEL_LABELS[key] || key}
                    </span>
                    <span className="text-xs font-bold text-slate-900 font-mono bg-white px-2 py-0.5 rounded-md border border-slate-200">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-4 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-slate-400" />
                Total{" "}
                <strong className="text-slate-800">{stats?.totalRows ?? 0}</strong> baris data pada{" "}
                <strong className="text-slate-800">{stats?.tables ?? 0}</strong> tabel.
              </p>
            </div>

            {/* Impor / Restore */}
            <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-xs">
              <div className="flex items-center gap-2 mb-1">
                <Upload className="w-4 h-4 text-rose-600" />
                <h2 className="font-bold text-sm text-slate-900">Pulihkan (Restore)</h2>
              </div>
              <p className="text-xs text-slate-500 flex items-start gap-1.5 mb-4">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                Mengganti seluruh data saat ini dengan isi berkas backup. Server otomatis menyimpan
                snapshot data lama sebelum dipulihkan.
              </p>

              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />

              {previewError && (
                <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {previewError}
                </div>
              )}

              {!preview ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/40 rounded-2xl py-8 text-center transition"
                >
                  <FileJson className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <span className="text-xs font-semibold text-slate-600">Pilih berkas backup (.json)</span>
                  <span className="block text-[11px] text-slate-400 mt-1">
                    Hasil ekspor sebelumnya disimpan di sisi Anda
                  </span>
                </button>
              ) : (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <FileJson className="w-3.5 h-3.5 text-slate-500" />
                        {fileName}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setPreview(null);
                          setFileName("");
                          if (fileRef.current) fileRef.current.value = "";
                        }}
                        className="text-[11px] text-slate-500 hover:text-rose-600 font-semibold"
                      >
                        Batal
                      </button>
                    </div>
                    <div className="text-slate-600">
                      Ekspor{" "}
                      <strong className="font-mono">{formatDateTime(preview.meta.exportedAt)}</strong> •
                      versi <strong className="font-mono">{preview.meta.version}</strong> •{" "}
                      <strong className="font-mono">
                        {Object.values(preview.meta.counts || {}).reduce((a: number, b: number) => a + b, 0)}
                      </strong>{" "}
                      baris data
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirm-restore" className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                      Ketik <span className="font-mono text-rose-700">PULIHKAN</span> untuk mengonfirmasi
                    </label>
                    <input
                      id="confirm-restore"
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="PULIHKAN"
                      autoComplete="off"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white font-mono"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={!importReady || busy}
                    onClick={handleImport}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {busy ? "Memulihkan Data..." : "Jalankan Restore Sekarang"}
                  </button>
                </div>
              )}
            </div>

            {/* Snapshot tersimpan di server */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-slate-500" />
                <h2 className="font-bold text-sm text-slate-900">Snapshot Otomatis di Server</h2>
                <span className="text-[10px] text-slate-400 ml-auto">
                  disimpan di <code className="bg-slate-100 px-1.5 py-0.5 rounded">storage/backups</code>
                </span>
              </div>

              {snapshots.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                  Belum ada snapshot. Setiap kali restore dijalankan, kondisi data lama otomatis disimpan di sini
                  sebagai jalan balik.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {snapshots.map((snap) => (
                    <div
                      key={snap.fileName}
                      className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 transition"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate font-mono">
                          {snap.fileName}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {formatDateTime(snap.exportedAt)} • {formatBytes(snap.size)}
                        </p>
                      </div>
                      <a
                        href={`/api/backup/snapshot?file=${encodeURIComponent(snap.fileName)}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition shrink-0"
                        title="Unduh berkas snapshot ini"
                      >
                        <Download className="w-3 h-3" /> Unduh
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}