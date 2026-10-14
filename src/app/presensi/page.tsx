"use client";

import { useEffect, useState } from "react";
import { useModalA11y } from "@/lib/useModalA11y";
import AppShell from "@/components/layout/AppShell";
import {
  ClipboardList,
  Calendar,
  Edit3,
  X,
  AlertCircle,
  Filter,
  RotateCcw,
  Clock,
  ShieldAlert,
  UserPlus,
  CheckCircle2,
  Search,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useConfirm } from "@/components/ui/DialogProvider";
import { formatIsoDateJakarta } from "@/lib/date";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import ManualAttendanceModal from "@/components/ManualAttendanceModal";

export default function PresensiPage() {
  const [user, setUser] = useState<any>(null);
  const confirmDialog = useConfirm();
  const [attendances, setAttendances] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDate, setSelectedDate] = useState(() => formatIsoDateJakarta());
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  // Modal Koreksi
  const [correctingItem, setCorrectingItem] = useState<any | null>(null);
  const [newStatus, setNewStatus] = useState("HADIR");
  const [correctionReason, setCorrectionReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const correctModal = useModalA11y<HTMLDivElement>(
    Boolean(correctingItem),
    () => setCorrectingItem(null)
  );

  // Modal Absen Manual
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // Finalisasi alfa otomatis
  const [finalizing, setFinalizing] = useState(false);
  const [alphaMsg, setAlphaMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [autoAlphaTime, setAutoAlphaTime] = useState("12:00");
  // Ikuti Pengaturan Sekolah: fitur presensi pulang aktif atau tidak
  const [checkOutEnabled, setCheckOutEnabled] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const resMe = await fetch("/api/auth/me");
      const dataMe = await resMe.json();
      if (dataMe.success) {
        setUser(dataMe.user);
      }

      const params = new URLSearchParams();
      if (selectedDate) params.append("date", selectedDate);
      if (selectedClass) params.append("classId", selectedClass);
      if (selectedStatus) params.append("status", selectedStatus);

      const resAtt = await fetch(`/api/attendance?${params.toString()}`);
      const dataAtt = await resAtt.json();
      if (dataAtt.success) {
        setAttendances(dataAtt.attendances);
      }

      const resCls = await fetch("/api/classes");
      const dataCls = await resCls.json();
      if (dataCls.success) {
        setClasses(dataCls.classes);
      }

      const resSet = await fetch("/api/settings");
      const dataSet = await resSet.json();
      if (dataSet.success) {
        if (dataSet.setting?.autoAlphaTime) {
          setAutoAlphaTime(dataSet.setting.autoAlphaTime);
        }
        setCheckOutEnabled(dataSet.setting?.checkOutEnabled !== false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate, selectedClass, selectedStatus]);

  const handleResetFilter = () => {
    setSelectedDate(formatIsoDateJakarta());
    setSelectedClass("");
    setSelectedStatus("");
  };

  const handleOpenCorrection = (att: any) => {
    setCorrectingItem(att);
    setNewStatus(att.status);
    setCorrectionReason("");
    setModalError(null);
  };

  const handleFinalizeAlpha = async () => {
    const ok = await confirmDialog({
      title: "Finalisasi ALFA",
      description: `Tandai siswa tanpa presensi pada tanggal ${selectedDate} sebagai ALFA? Siswa yang sudah presensi atau berizin (disetujui) tidak akan terpengaruh.`,
      variant: "warning",
      confirmLabel: "Ya, Tandai ALFA",
    });
    if (!ok) return;
    setFinalizing(true);
    setAlphaMsg(null);
    try {
      const res = await fetch("/api/attendance/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate }),
      });
      const data = await res.json();
      if (data.success) {
        setAlphaMsg({ type: "success", text: data.message });
        fetchData();
      } else {
        setAlphaMsg({
          type: "error",
          text: data.message || "Gagal melakukan finalisasi alfa.",
        });
      }
    } catch {
      setAlphaMsg({ type: "error", text: "Terjadi kesalahan jaringan." });
    } finally {
      setFinalizing(false);
    }
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionReason.trim()) {
      setModalError("Alasan koreksi wajib diisi untuk kebutuhan audit.");
      return;
    }

    setSaving(true);
    setModalError(null);

    try {
      const res = await fetch("/api/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: correctingItem.id,
          status: newStatus,
          correctionReason: correctionReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setModalError(data.message || "Gagal menyimpan koreksi.");
        setSaving(false);
        return;
      }

      setCorrectingItem(null);
      fetchData();
    } catch {
      setModalError("Terjadi kesalahan jaringan.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenManualModal = () => {
    setIsManualModalOpen(true);
  };

  // Otomatis buka form jika URL mengandung ?openManual=1 atau ?manual=1
  useEffect(() => {
    if (typeof window !== "undefined" && user) {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("openManual") === "1" || sp.get("manual") === "1") {
        setIsManualModalOpen(true);
      }
    }
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-500">
        Memuat data presensi...
      </div>
    );
  }

  const hasActiveFilter = Boolean(
    selectedClass ||
      selectedStatus ||
      selectedDate !== formatIsoDateJakarta()
  );

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        {/* Header Halaman */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <ClipboardList className="w-5 h-5" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Rekap Data Presensi
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              {user.role === "GURU"
                ? `Monitoring dan koreksi kehadiran siswa kelas perwalian ${user.homeroomClass?.name || ""}`
                : "Monitoring data presensi harian seluruh siswa dan guru beserta riwayat audit koreksi"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
              <span>Total Terekam:</span>
              <strong className="text-slate-900 font-bold">{attendances.length} Siswa</strong>
            </div>

            {(user.role === "SUPERADMIN" || user.role === "ADMIN") && (
              <button
                type="button"
                onClick={handleFinalizeAlpha}
                disabled={finalizing}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition min-h-[42px] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {finalizing ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                )}
                <span>Finalisasi Alfa ({selectedDate})</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenManualModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition min-h-[42px] focus-visible:ring-2 focus-visible:ring-blue-600 active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              <span>Input Presensi Manual</span>
            </button>
          </div>
        </div>

        {/* Feedback Finalisasi Alfa */}
        {alphaMsg && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center justify-between border ${
              alphaMsg.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            <span>{alphaMsg.text}</span>
            <button onClick={() => setAlphaMsg(null)} className="font-bold underline ml-2">
              Tutup
            </button>
          </div>
        )}

        {/* Filter Card */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
              Saring Data Presensi
            </span>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={handleResetFilter}
                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-800 transition"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                Reset Filter
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Filter Tanggal */}
            <div>
              <label htmlFor="filter-date" className="block text-[11px] font-semibold text-slate-700 mb-1">
                Tanggal Presensi
              </label>
              <div className="relative">
                <input
                  id="filter-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full py-2 px-3 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white shadow-2xs min-h-[42px]"
                />
              </div>
              {(user.role === "SUPERADMIN" || user.role === "ADMIN") && (
                <p className="mt-1 text-[10px] text-slate-400">
                  Finalisasi alfa hari ini tersedia mulai pukul {autoAlphaTime} WIB.
                </p>
              )}
            </div>

            {/* Filter Kelas */}
            {user.role !== "GURU" && (
              <div>
                <label htmlFor="filter-class" className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Kelas
                </label>
                <select
                  id="filter-class"
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full py-2 px-3 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white shadow-2xs min-h-[42px]"
                >
                  <option value="">Semua Kelas</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      Kelas {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Filter Status */}
            <div>
              <label htmlFor="filter-status" className="block text-[11px] font-semibold text-slate-700 mb-1">
                Status Kehadiran
              </label>
              <select
                id="filter-status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full py-2 px-3 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white shadow-2xs min-h-[42px]"
              >
                <option value="">Semua Status</option>
                <option value="HADIR">Hadir Tepat Waktu</option>
                <option value="TERLAMBAT">Terlambat</option>
                <option value="IZIN">Izin</option>
                <option value="SAKIT">Sakit</option>
                <option value="ALFA">Alfa (Tanpa Keterangan)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabel Data Presensi */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-500 space-y-2">
              <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p>Memuat rekaman data presensi...</p>
            </div>
          ) : attendances.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="Tidak Ada Catatan Presensi Ditemukan"
                description={`Tidak ada data kehadiran siswa untuk tanggal ${selectedDate} dengan kriteria filter yang sedang diterapkan.`}
                action={{
                  label: "Reset Filter ke Hari Ini",
                  onClick: handleResetFilter,
                }}
              />
            </div>
          ) : (
            <>
            <div className="hidden xl:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">NIS</th>
                    <th className="py-3.5 px-4">Nama Siswa</th>
                    <th className="py-3.5 px-4">Kelas</th>
                    <th className="py-3.5 px-4">Jam Masuk</th>
                    {checkOutEnabled && <th className="py-3.5 px-4">Jam Pulang</th>}
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4">Keterangan / Terlambat</th>
                    <th className="py-3.5 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {attendances.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">{att.student?.nis}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          {att.student?.photoUrl ? (
                            <img
                              src={att.student.photoUrl}
                              alt={att.student.name}
                              className="w-7 h-7 rounded-full object-cover border border-slate-200 shadow-2xs shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-[11px] shrink-0">
                              {att.student?.name?.charAt(0)?.toUpperCase() || "S"}
                            </div>
                          )}
                          <span>{att.student?.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {att.student?.class?.name}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {att.checkInAt
                          ? new Date(att.checkInAt).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </td>
                      {checkOutEnabled && (
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {att.checkOutAt
                            ? new Date(att.checkOutAt).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                        </td>
                      )}
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={att.status} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-slate-700 max-w-xs">
                        {att.lateMinutes > 0 ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                              {att.lateMinutes} menit terlambat
                            </span>
                            {att.notes && (
                              <div className="text-[11px] text-slate-600">
                                {att.notes.includes("[Absen Manual]") && (
                                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 mr-1.5">
                                    Manual
                                  </span>
                                )}
                                <span className="truncate block" title={att.notes}>
                                  {att.notes}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : att.notes ? (
                          <div className="space-y-1">
                            {att.notes.includes("[Absen Manual]") && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 mr-1.5">
                                Manual
                              </span>
                            )}
                            <span className="text-[11px] text-slate-700 block truncate" title={att.notes}>
                              {att.notes}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenCorrection(att)}
                          aria-label={`Koreksi presensi ${att.student?.name}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-800 transition min-h-[34px] focus-visible:ring-2 focus-visible:ring-blue-600"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                          <span>Koreksi</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tampilan Kartu untuk layar kecil (semua kolom tampil tanpa geser horizontal) */}
            <div className="xl:hidden divide-y divide-slate-200 bg-white">
              {attendances.map((att) => (
                <div key={att.id} className="p-4 space-y-3">
                  {/* Baris atas: identitas + status */}
                  <div className="flex items-start gap-3">
                    {att.student?.photoUrl ? (
                      <img
                        src={att.student.photoUrl}
                        alt={att.student.name}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-2xs shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0">
                        {att.student?.name?.charAt(0)?.toUpperCase() || "S"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm text-slate-900 leading-snug">
                        {att.student?.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        NIS: {att.student?.nis || "-"}
                      </div>
                    </div>
                    <StatusBadge status={att.status} size="sm" />
                  </div>

                  {/* Detail */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Kelas
                      </div>
                      <div className="font-medium text-slate-700">
                        {att.student?.class?.name || "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Jam Masuk
                      </div>
                      <div className="font-mono text-slate-600">
                        {att.checkInAt
                          ? new Date(att.checkInAt).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </div>
                    </div>
                    {checkOutEnabled && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Jam Pulang
                        </div>
                        <div className="font-mono text-slate-600">
                          {att.checkOutAt
                            ? new Date(att.checkOutAt).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Keterangan / Terlambat (teks penuh, tidak dipotong) */}
                  <div className="text-xs">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">
                      Keterangan / Terlambat
                    </div>
                    {att.lateMinutes > 0 ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                          {att.lateMinutes} menit terlambat
                        </span>
                        {att.notes && (
                          <div className="text-[11px] text-slate-600">
                            {att.notes.includes("[Absen Manual]") && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 mr-1.5">
                                Manual
                              </span>
                            )}
                            <span className="block break-words">{att.notes}</span>
                          </div>
                        )}
                      </div>
                    ) : att.notes ? (
                      <div className="space-y-1">
                        {att.notes.includes("[Absen Manual]") && (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 mr-1.5">
                            Manual
                          </span>
                        )}
                        <span className="text-[11px] text-slate-700 block break-words">
                          {att.notes}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px]">-</span>
                    )}
                  </div>

                  {/* Aksi */}
                  <button
                    type="button"
                    onClick={() => handleOpenCorrection(att)}
                    aria-label={`Koreksi presensi ${att.student?.name}`}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-800 transition min-h-[40px] focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                    <span>Koreksi</span>
                  </button>
                </div>
              ))}
            </div>
            </>
          )}
        </div>

        {/* MODAL KOREKSI PRESENSI (AKSESIBEL & BER-AUDIT) */}
        {correctingItem && (
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
            onMouseDown={correctModal.handleBackdropMouseDown}
          >
            <div
              ref={correctModal.panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-koreksi-title"
              className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4"
            >
              <div className="flex items-start justify-between border-b border-slate-100 pb-3.5">
                <div>
                  <h3 id="modal-koreksi-title" className="text-base font-bold text-slate-900">
                    Koreksi Status Presensi
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5 font-medium">
                    {correctingItem.student?.name} (NIS: {correctingItem.student?.nis})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCorrectingItem(null)}
                  aria-label="Tutup modal koreksi"
                  className="p-1.5 -mr-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Peringatan Audit Trail */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="leading-relaxed">
                  <span className="font-bold block">Tindakan Ber-Audit:</span>
                  Setiap koreksi dicatat permanen ke Audit Log dengan identitas akun Anda sebagai penanggung jawab.
                </div>
              </div>

              {modalError && (
                <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
                  <span className="font-medium">{modalError}</span>
                </div>
              )}

              <form onSubmit={handleSaveCorrection} className="space-y-4">
                <div>
                  <label htmlFor="correction-status" className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Status Presensi Pengganti <span className="text-rose-600 font-bold">*</span>
                  </label>
                  <select
                    id="correction-status"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white font-medium shadow-2xs min-h-[44px]"
                  >
                    <option value="HADIR">HADIR (Hadir Tepat Waktu)</option>
                    <option value="TERLAMBAT">TERLAMBAT (Lewat Jam Masuk)</option>
                    <option value="IZIN">IZIN (Ada Surat Permohonan)</option>
                    <option value="SAKIT">SAKIT (Ada Surat Keterangan Sakit)</option>
                    <option value="ALFA">ALFA (Tanpa Keterangan Resmi)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="correction-reason" className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Alasan Koreksi <span className="text-rose-600 font-bold">*</span>
                  </label>
                  <textarea
                    id="correction-reason"
                    required
                    rows={3}
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    placeholder="Contoh: Siswa hadir fisik di kelas namun kartu QR tertinggal di rumah."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white shadow-2xs"
                  />
                  <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1">
                    <span>Wajib diisi secara jelas dan jujur.</span>
                    <span>{correctionReason.length} karakter</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setCorrectingItem(null)}
                    className="px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 transition min-h-[42px]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition shadow-xs disabled:opacity-50 min-h-[42px]"
                  >
                    {saving ? "Menyimpan..." : "Simpan Koreksi"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* MODAL INPUT PRESENSI MANUAL (AKSESIBEL & BER-ALASAN WAJIB) */}
        <ManualAttendanceModal
          isOpen={isManualModalOpen}
          onClose={() => setIsManualModalOpen(false)}
          onSuccess={() => fetchData()}
          currentUser={user}
          classes={classes}
          defaultDate={selectedDate}
        />
      </div>
    </AppShell>
  );
}
