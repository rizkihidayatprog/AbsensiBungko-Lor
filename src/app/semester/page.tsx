"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  ArrowRight,
  ShieldAlert,
  Info,
  CalendarDays,
  FileSpreadsheet,
  Trash2,
} from "lucide-react";
import { useConfirm } from "@/components/ui/DialogProvider";

export default function SemesterPage() {
  const [user, setUser] = useState<any>(null);
  const confirmDialog = useConfirm();
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [activeTerm, setActiveTerm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form states
  const [yearName, setYearName] = useState("2026/2027");
  const [semester, setSemester] = useState<"GANJIL" | "GENAP">("GANJIL");
  const [startDate, setStartDate] = useState("2026-07-15");
  const [endDate, setEndDate] = useState("2026-12-20");
  const [makeActive, setMakeActive] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/academic-terms");
      const data = await res.json();
      if (data.success) {
        setAcademicYears(data.academicYears || []);
        setActiveTerm(data.activeTerm || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setUser(data.user);
      });
    fetchData();
  }, []);

  const handleCreateTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/academic-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearName,
          semester,
          startDate,
          endDate,
          makeActive,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: "success", text: data.message });
        setModalOpen(false);
        fetchData();
      } else {
        setMsg({ type: "error", text: data.message || "Gagal menyimpan semester" });
      }
    } catch {
      setMsg({ type: "error", text: "Terjadi kesalahan jaringan" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivateTerm = async (termId: string, termName: string) => {
    const ok = await confirmDialog({
      title: "Aktifkan Periode",
      description: `Aktifkan "${termName}" sebagai periode absensi sekolah yang aktif?`,
      variant: "info",
      confirmLabel: "Ya, Aktifkan",
    });
    if (!ok) return;
    try {
      const res = await fetch("/api/academic-terms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termId, action: "ACTIVATE" }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: "success", text: data.message });
        fetchData();
      } else {
        setMsg({ type: "error", text: data.message || "Gagal mengaktifkan semester" });
      }
    } catch {
      setMsg({ type: "error", text: "Terjadi kesalahan jaringan" });
    }
  };

  const handleDeleteAcademicYear = async (ayId: string, ayName: string) => {
    const ok = await confirmDialog({
      title: "Hapus Tahun Ajaran",
      description: `Yakin ingin menghapus Tahun Ajaran "${ayName}" beserta semester di dalamnya?\n\nTindakan ini permanen dan tidak dapat dibatalkan.`,
      variant: "danger",
      confirmLabel: "Ya, Hapus",
    });
    if (!ok) return;
    try {
      setDeletingId(ayId);
      setMsg(null);
      const res = await fetch(`/api/academic-terms?academicYearId=${encodeURIComponent(ayId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: "success", text: data.message });
        fetchData();
      } else {
        setMsg({ type: "error", text: data.message || "Gagal menghapus tahun ajaran" });
      }
    } catch {
      setMsg({ type: "error", text: "Terjadi kesalahan jaringan" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteTerm = async (termId: string, termName: string) => {
    const ok = await confirmDialog({
      title: "Hapus Semester",
      description: `Yakin ingin menghapus "${termName}"?\n\nTindakan ini permanen dan tidak dapat dibatalkan.`,
      variant: "danger",
      confirmLabel: "Ya, Hapus",
    });
    if (!ok) return;
    try {
      setDeletingId(termId);
      setMsg(null);
      const res = await fetch(`/api/academic-terms?termId=${encodeURIComponent(termId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: "success", text: data.message });
        fetchData();
      } else {
        setMsg({ type: "error", text: data.message || "Gagal menghapus semester" });
      }
    } catch {
      setMsg({ type: "error", text: "Terjadi kesalahan jaringan" });
    } finally {
      setDeletingId(null);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-xs text-slate-500">
        Memuat data sesi...
      </div>
    );
  }

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              Periode Semester & Tahun Ajaran
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Kelola periode akademik aktif dan riwayat semester untuk pengelompokan presensi sekolah.
            </p>
          </div>
          {(user.role === "SUPERADMIN" || user.role === "ADMIN") && (
            <button
              onClick={() => {
                setMsg(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Buka Semester Baru
            </button>
          )}
        </div>

        {/* Alert Pesan */}
        {msg && (
          <div
            className={`p-3.5 rounded-lg text-xs flex items-center justify-between border ${
              msg.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            <span>{msg.text}</span>
            <button onClick={() => setMsg(null)} className="font-bold underline ml-2">
              Tutup
            </button>
          </div>
        )}

        {/* Banner Keabadian QR Code (Aturan Inti) */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-4 sm:p-5 rounded-xl shadow-sm border border-blue-800">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-800/80 rounded-lg shrink-0 mt-0.5">
              <Info className="w-5 h-5 text-blue-200" />
            </div>
            <div className="space-y-1.5 text-xs text-blue-100 leading-relaxed">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Prinsip Keberlanjutan QR Code Siswa Antar-Semester
              </h2>
              <p>
                <strong>QR Code Siswa Permanen:</strong> Siswa <strong>TIDAK PERLU</strong> mengganti atau mencetak ulang kartu QR Code saat semester berganti.
              </p>
              <p className="text-blue-200">
                Sistem secara otomatis mengasosiasikan setiap scan presensi ke semester yang <strong>sedang aktif</strong>. Saat semester berganti (misal dari Ganjil ke Genap), riwayat lama tetap tersimpan utuh dan absensi baru otomatis masuk ke semester baru.
              </p>
            </div>
          </div>
        </div>

        {/* Status Semester Aktif Saat Ini */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Periode Akademik Aktif
              </span>
              {activeTerm ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Aktif Berjalan
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                  <Clock className="w-3.5 h-3.5" />
                  Belum Ada Semester Aktif
                </span>
              )}
            </div>

            {activeTerm ? (
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-slate-900">{activeTerm.name}</h2>
                <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-slate-600">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="w-4 h-4 text-slate-400" />
                    Mulai:{" "}
                    <strong>
                      {new Date(activeTerm.startDate).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </strong>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>
                    Selesai:{" "}
                    <strong>
                      {new Date(activeTerm.endDate).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </strong>
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Silakan buka semester baru atau aktifkan salah satu semester pada tabel di bawah agar pemindaian presensi terikat dengan semester yang benar.
              </p>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Alur Pergantian Semester
            </span>
            <ul className="text-xs text-slate-600 space-y-2 mt-1">
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-indigo-600">1.</span>
                <span>Tutup semester lama & buka semester genap/baru.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-indigo-600">2.</span>
                <span>Data siswa & riwayat presensi lama tetap aman.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-indigo-600">3.</span>
                <span>Update penempatan kelas siswa (kenaikan kelas).</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Daftar Tahun Ajaran & Semester */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">Daftar Tahun Ajaran & Riwayat Semester</h2>
            <span className="text-xs text-slate-400">Total {academicYears.length} Tahun Ajaran</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Memuat daftar semester...</div>
          ) : academicYears.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">Belum ada data tahun ajaran.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {academicYears.map((ay) => (
                <div key={ay.id} className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        Tahun Ajaran {ay.name}
                      </span>
                      {ay.isActive && (
                        <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                          T.A. Aktif
                        </span>
                      )}
                    </div>

                    {(user.role === "SUPERADMIN" || user.role === "ADMIN") && !ay.isActive && (
                      <button
                        onClick={() => handleDeleteAcademicYear(ay.id, ay.name)}
                        disabled={deletingId === ay.id}
                        className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-lg font-medium transition disabled:opacity-50"
                        title={`Hapus Tahun Ajaran ${ay.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Tahun Ajaran</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {ay.terms.map((t: any) => {
                      const isCurrent = t.isActive;
                      return (
                        <div
                          key={t.id}
                          className={`p-3.5 rounded-lg border transition ${
                            isCurrent
                              ? "bg-emerald-50/40 border-emerald-300"
                              : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-800">{t.name}</span>
                                {isCurrent && (
                                  <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">
                                    Aktif
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-1">
                                {new Date(t.startDate).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}{" "}
                                —{" "}
                                {new Date(t.endDate).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </p>
                              <div className="flex items-center gap-3 text-[11px] text-slate-600 mt-2">
                                <span className="inline-flex items-center gap-1 font-medium">
                                  <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                                  {t._count?.attendances || 0} Catatan Presensi
                                </span>
                              </div>
                            </div>

                            {!isCurrent && (user.role === "SUPERADMIN" || user.role === "ADMIN") && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleActivateTerm(t.id, t.name)}
                                  className="text-xs bg-white border border-slate-300 hover:border-indigo-500 hover:text-indigo-600 text-slate-700 px-3 py-1.5 rounded-md shadow-xs font-semibold transition"
                                >
                                  Aktifkan
                                </button>
                                <button
                                  onClick={() => handleDeleteTerm(t.id, t.name)}
                                  disabled={deletingId === t.id}
                                  className="text-xs bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 p-1.5 rounded-md shadow-xs font-semibold transition disabled:opacity-50"
                                  title={`Hapus ${t.name}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Buka Semester Baru */}
        {modalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
              <h3 className="text-base font-bold text-slate-900 mb-1">Buka / Buat Semester Baru</h3>
              <p className="text-xs text-slate-500 mb-4">
                Siswa tidak perlu dibuat ulang. QR Code siswa tetap sama; sistem hanya akan mengelompokkan absensi ke periode ini.
              </p>

              <form onSubmit={handleCreateTerm} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tahun Ajaran (contoh: 2026/2027)
                  </label>
                  <input
                    type="text"
                    value={yearName}
                    onChange={(e) => setYearName(e.target.value)}
                    required
                    placeholder="2026/2027"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pilihan Semester</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSemester("GANJIL")}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold text-center transition ${
                        semester === "GANJIL"
                          ? "bg-indigo-50 border-indigo-600 text-indigo-700"
                          : "border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      Semester Ganjil
                    </button>
                    <button
                      type="button"
                      onClick={() => setSemester("GENAP")}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold text-center transition ${
                        semester === "GENAP"
                          ? "bg-indigo-50 border-indigo-600 text-indigo-700"
                          : "border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      Semester Genap
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tanggal Mulai</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tanggal Selesai</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={makeActive}
                      onChange={(e) => setMakeActive(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-semibold text-slate-700">
                      Jadikan periode semester ini langsung aktif
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-400 ml-5 mt-0.5">
                    Semester lain yang sedang aktif akan otomatis dinonaktifkan.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-50 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition disabled:opacity-50"
                  >
                    {submitting ? "Menyimpan..." : "Simpan Periode Semester"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
