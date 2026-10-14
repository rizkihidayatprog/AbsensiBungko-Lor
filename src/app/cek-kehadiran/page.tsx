"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  QrCode,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  Calendar,
  User,
  GraduationCap,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";

export default function CekKehadiranPage() {
  const [nis, setNis] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  // Nama sekolah mengikuti Pengaturan Sekolah
  const [schoolName, setSchoolName] = useState("");
  // Ikuti pengaturan: fitur presensi pulang aktif atau tidak
  const [checkOutEnabled, setCheckOutEnabled] = useState(true);

  useEffect(() => {
    fetch("/api/public/school")
      .then((res) => res.json())
      .then((d) => {
        if (d.success && d.schoolName) setSchoolName(d.schoolName);
        if (d.success) setCheckOutEnabled(d.checkOutEnabled !== false);
      })
      .catch(() => {});
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nis.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/public/attendance-check?nis=${encodeURIComponent(nis.trim())}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Data siswa dengan NIS tersebut tidak ditemukan.");
        return;
      }

      setResult(data.student);
    } catch {
      setError("Gagal terhubung ke server. Silakan periksa koneksi internet Anda.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 flex flex-col justify-between">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        {/* Top Back Link & School Identity */}
        <div className="flex items-center justify-between">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700 transition"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Kembali ke Login Petugas</span>
          </Link>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
            <QrCode className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
            <span>{schoolName || "SMP / SD Harapan Bangsa"}</span>
          </div>
        </div>

        {/* Search Card */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/90 shadow-2xs text-center space-y-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-2xl mx-auto flex items-center justify-center shadow-xs">
            <Search className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Portal Cek Kehadiran Siswa
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-md mx-auto">
              Periksa catatan presensi siswa harian secara mandiri tanpa perlu akun login petugas.
            </p>
          </div>

          <form onSubmit={handleSearch} className="max-w-md mx-auto flex flex-col sm:flex-row gap-2.5 pt-2">
            <div className="relative flex-1">
              <input
                type="text"
                required
                value={nis}
                onChange={(e) => setNis(e.target.value)}
                placeholder="Masukkan NIS (contoh: 20261001)"
                aria-label="Nomor Induk Siswa"
                className="w-full px-4 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white shadow-2xs min-h-[44px]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition shadow-xs disabled:opacity-50 min-h-[44px]"
            >
              {loading ? "Memeriksa..." : "Periksa Presensi"}
            </button>
          </form>

          {/* Quick Sample NIS */}
          <div className="text-xs text-slate-500">
            Coba NIS contoh:{" "}
            <button
              type="button"
              onClick={() => setNis("20261001")}
              className="underline text-blue-600 hover:text-blue-800 font-mono font-semibold"
            >
              20261001
            </button>
            ,{" "}
            <button
              type="button"
              onClick={() => setNis("20261002")}
              className="underline text-blue-600 hover:text-blue-800 font-mono font-semibold"
            >
              20261002
            </button>
          </div>

          {error && (
            <div role="alert" className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
              <span className="font-medium">{error}</span>
            </div>
          )}
        </div>

        {/* Student Result Card */}
        {result && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden space-y-4 animate-in fade-in duration-200">
            {/* Student Bio Banner */}
            <div className="p-5 sm:p-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider block">
                  Identitas Siswa Terverifikasi
                </span>
                <h2 className="text-xl font-bold text-white">{result.name}</h2>
                <p className="text-xs text-slate-300 font-mono">
                  NIS: <strong className="text-white font-semibold">{result.nis}</strong>
                </p>
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-xs">
                  <GraduationCap className="w-4 h-4" aria-hidden="true" />
                  Kelas {result.class}
                </span>
              </div>
            </div>

            {/* Attendance History */}
            <div className="p-5 sm:p-6 pt-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" aria-hidden="true" />
                Riwayat Presensi ({result.attendances.length} Hari Terakhir)
              </h3>

              {result.attendances.length === 0 ? (
                <EmptyState
                  title="Belum Ada Catatan Presensi"
                  description="Siswa ini belum memiliki rekaman presensi masuk atau pulang pada periode aktif."
                />
              ) : (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                  {result.attendances.map((att: any) => (
                    <div
                      key={att.id}
                      className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="text-xs sm:text-sm font-bold text-slate-900">
                          {new Date(att.date).toLocaleDateString("id-ID", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </div>
                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>
                            Masuk:{" "}
                            <strong className="font-mono text-slate-900 font-bold">
                              {att.checkInAt
                                ? new Date(att.checkInAt).toLocaleTimeString("id-ID", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "-"}
                            </strong>
                          </span>
                          {checkOutEnabled && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span>
                                Pulang:{" "}
                                <strong className="font-mono text-slate-900 font-bold">
                                  {att.checkOutAt
                                    ? new Date(att.checkOutAt).toLocaleTimeString("id-ID", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : "-"}
                                </strong>
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <StatusBadge status={att.status} size="sm" />
                        {att.lateMinutes > 0 && (
                          <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            +{att.lateMinutes}m
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="text-center text-xs text-slate-600 mt-10">
        &copy; {new Date().getFullYear()} {schoolName || "Sistem Presensi Sekolah"} • Portal Mandiri Siswa
      </div>
    </div>
  );
}
