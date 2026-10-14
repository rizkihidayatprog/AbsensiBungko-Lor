"use client";

import { useEffect, useState, useMemo } from "react";
import {
  UserPlus,
  X,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  Search,
  Clock,
  Sparkles,
  User,
} from "lucide-react";
import { useModalA11y } from "@/lib/useModalA11y";

export const MANUAL_REASON_PRESETS = [
  "Kartu QR tertinggal di rumah",
  "Kartu QR rusak / barcode tidak terbaca",
  "Siswa diantar orang tua terlambat",
  "Kamera / scanner kendala teknis",
  "Izin / dispensasi kegiatan sekolah",
  "Sakit dengan konfirmasi orang tua",
];

interface ManualAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
  currentUser: any;
  classes?: any[];
  defaultDate?: string;
}

export default function ManualAttendanceModal({
  isOpen,
  onClose,
  onSuccess,
  currentUser,
  classes: initialClasses,
  defaultDate,
}: ManualAttendanceModalProps) {
  const modalA11y = useModalA11y<HTMLDivElement>(isOpen, onClose);

  const [classes, setClasses] = useState<any[]>(initialClasses || []);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Form states
  const [studentId, setStudentId] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(
    defaultDate || new Date().toISOString().split("T")[0]
  );
  const [status, setStatus] = useState("HADIR");
  const [checkInTime, setCheckInTime] = useState("07:00");
  const [manualReason, setManualReason] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Muat data kelas dan siswa saat modal dibuka
  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    // Default jam saat ini jika status HADIR/TERLAMBAT
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    setCheckInTime(`${hh}:${mm}`);

    const loadInitialData = async () => {
      try {
        setLoadingData(true);
        const [resClasses, resStudents] = await Promise.all([
          classes.length > 0 ? Promise.resolve(null) : fetch("/api/classes"),
          fetch("/api/students?perPage=2000"),
        ]);

        if (resClasses) {
          const dClasses = await resClasses.json();
          if (dClasses.success) setClasses(dClasses.classes || []);
        }

        const dStudents = await resStudents.json();
        if (dStudents.success) {
          setAllStudents(dStudents.students || []);
        }
      } catch (err) {
        console.error("Gagal memuat data siswa untuk modal presensi manual:", err);
      } finally {
        setLoadingData(false);
      }
    };

    loadInitialData();

    // Jika Guru, otomatis set filter kelas ke kelas perwaliannya
    if (currentUser?.role === "GURU" && currentUser?.homeroomClass?.id) {
      setClassFilter(currentUser.homeroomClass.id);
    }
  }, [isOpen, currentUser]);

  // Daftar siswa yang disaring
  const filteredStudents = useMemo(() => {
    return allStudents.filter((s) => {
      if (classFilter && s.classId !== classFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        s.name.toLowerCase().includes(q) ||
        s.nis.toLowerCase().includes(q) ||
        (s.nisn && s.nisn.toLowerCase().includes(q))
      );
    });
  }, [allStudents, classFilter, searchQuery]);

  // Siswa yang sedang dipilih
  const selectedStudent = useMemo(() => {
    if (!studentId) return null;
    return allStudents.find((s) => s.id === studentId) || null;
  }, [allStudents, studentId]);

  const handleSetCurrentTime = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    setCheckInTime(`${hh}:${mm}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) {
      setErrorMessage("Silakan pilih siswa yang akan diabsenkan.");
      return;
    }
    if (!manualReason.trim()) {
      setErrorMessage("Keterangan/alasan presensi manual wajib diisi untuk keperluan transparansi dan audit.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          attendanceDate,
          status,
          checkInTime: ["HADIR", "TERLAMBAT"].includes(status) ? checkInTime : undefined,
          manualReason: manualReason.trim(),
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.message || "Gagal mencatat presensi manual.");
        setSaving(false);
        return;
      }

      setSuccessMessage(data.message || "Presensi manual berhasil disimpan!");
      setTimeout(() => {
        onSuccess?.(data.message || "Presensi manual berhasil disimpan!");
        onClose();
        setSuccessMessage(null);
        setStudentId("");
        setManualReason("");
        setNotes("");
      }, 900);
    } catch {
      setErrorMessage("Terjadi gangguan jaringan saat menyimpan presensi manual.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 overflow-y-auto"
      onMouseDown={modalA11y.handleBackdropMouseDown}
    >
      <div
        ref={modalA11y.panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-manual-title"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 my-8 max-h-[92vh] overflow-y-auto"
      >
        {/* Header Modal */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 shadow-2xs">
              <UserPlus className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 id="modal-manual-title" className="text-base font-bold text-slate-900 tracking-tight">
                Input Presensi Manual Siswa
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pencatatan langsung identitas siswa dengan alasan terverifikasi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal presensi manual"
            className="p-1.5 -mr-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Peringatan Transparansi Audit */}
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="leading-relaxed">
            <span className="font-bold block">Pencatatan Ber-Audit Resmi:</span>
            Presensi manual mewajibkan alasan valid (misal: kartu tertinggal, kendala scanner). Identitas akun pencatat dicatat secara permanen di Audit Log.
          </div>
        </div>

        {/* Notifikasi Error / Sukses */}
        {errorMessage && (
          <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div role="alert" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
            <span className="font-semibold">{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Pemilihan Siswa & Filter Cepat */}
          <div className="space-y-2">
            <label htmlFor="manual-student-select" className="block text-xs font-semibold text-slate-800">
              Pilih Siswa <span className="text-rose-600 font-bold">*</span>
            </label>

            {currentUser?.role !== "GURU" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <select
                    id="manual-class-filter"
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white min-h-[40px] shadow-2xs"
                  >
                    <option value="">Semua Kelas</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        Kelas {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" aria-hidden="true" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari NIS, NISN, atau Nama..."
                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white min-h-[40px] shadow-2xs"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                <span>Kelas Perwalian:</span>
                <strong className="text-slate-900 font-semibold">
                  {currentUser.homeroomClass?.name || "Kelas Guru"}
                </strong>
              </div>
            )}

            <select
              id="manual-student-select"
              required
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              disabled={loadingData}
              className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white font-medium shadow-2xs min-h-[44px]"
            >
              <option value="">
                {loadingData
                  ? "Memuat daftar siswa..."
                  : filteredStudents.length === 0
                  ? "Tidak ada siswa yang sesuai"
                  : `-- Pilih Siswa (${filteredStudents.length} siswa ditemukan) --`}
              </option>
              {filteredStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (NIS: {s.nis}{s.nisn ? ` | NISN: ${s.nisn}` : ""}) — Kelas {s.class?.name || "-"}
                </option>
              ))}
            </select>

            {/* PREVIEW KARTU SISWA TERPILIH (PENCEGAHAN SALAH PILIH) */}
            {selectedStudent && (
              <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200/90 flex items-center gap-3.5 animate-in fade-in duration-150">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white border border-blue-200 shadow-2xs shrink-0 flex items-center justify-center">
                  {selectedStudent.photoUrl ? (
                    <img
                      src={selectedStudent.photoUrl}
                      alt={selectedStudent.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className={`w-full h-full flex items-center justify-center font-bold text-sm ${
                        selectedStudent.gender === "L"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-pink-100 text-pink-700"
                      }`}
                    >
                      {selectedStudent.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-xs truncate">
                      {selectedStudent.name}
                    </h4>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                        selectedStudent.gender === "L"
                          ? "bg-blue-100 text-blue-800 border-blue-200"
                          : "bg-pink-100 text-pink-800 border-pink-200"
                      }`}
                    >
                      {selectedStudent.gender === "L" ? "Laki-laki (L)" : "Perempuan (P)"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-600 mt-0.5 font-mono">
                    <span>NIS: <strong className="text-slate-800">{selectedStudent.nis}</strong></span>
                    <span>NISN: <strong className="text-slate-800">{selectedStudent.nisn || "-"}</strong></span>
                    <span className="font-sans font-semibold text-blue-700">Kelas {selectedStudent.class?.name || "-"}</span>
                  </div>
                  {selectedStudent.parentPhone && (
                    <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-sans font-medium mt-1">
                      <span>WhatsApp Ortu:</span>
                      <strong>{selectedStudent.parentName ? `${selectedStudent.parentName} (${selectedStudent.parentPhone})` : selectedStudent.parentPhone}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. Tanggal & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="manual-attendance-date" className="block text-xs font-semibold text-slate-800 mb-1.5">
                Tanggal Presensi <span className="text-rose-600 font-bold">*</span>
              </label>
              <input
                id="manual-attendance-date"
                type="date"
                required
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white shadow-2xs min-h-[42px]"
              />
            </div>

            <div>
              <label htmlFor="manual-attendance-status" className="block text-xs font-semibold text-slate-800 mb-1.5">
                Status Kehadiran <span className="text-rose-600 font-bold">*</span>
              </label>
              <select
                id="manual-attendance-status"
                required
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white font-medium shadow-2xs min-h-[42px]"
              >
                <option value="HADIR">HADIR (Hadir Tepat Waktu)</option>
                <option value="TERLAMBAT">TERLAMBAT (Lewat Jam Masuk)</option>
                <option value="IZIN">IZIN (Ada Permohonan Resmi)</option>
                <option value="SAKIT">SAKIT (Keterangan Sakit)</option>
                <option value="ALFA">ALFA (Tanpa Keterangan)</option>
              </select>
            </div>
          </div>

          {/* 3. Jam Masuk (Hanya untuk HADIR & TERLAMBAT) */}
          {["HADIR", "TERLAMBAT"].includes(status) ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="manual-check-in-time" className="text-xs font-semibold text-slate-800">
                  Jam Masuk (WIB)
                </label>
                <button
                  type="button"
                  onClick={handleSetCurrentTime}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 underline transition cursor-pointer"
                >
                  Gunakan Jam Sekarang
                </button>
              </div>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" aria-hidden="true" />
                <input
                  id="manual-check-in-time"
                  type="time"
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white font-mono shadow-2xs min-h-[42px]"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Batas tepat waktu sekolah: 07:15 WIB. Jam setelah batas ini otomatis terhitung terlambat.
              </p>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
              ℹ️ Jam masuk tidak dicatat untuk status {status}.
            </div>
          )}

          {/* 4. Alasan / Keterangan Absen Manual (WAJIB) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="manual-reason-field" className="text-xs font-semibold text-slate-800">
                Keterangan / Alasan Absen Manual <span className="text-rose-600 font-bold">*</span>
              </label>
              <span className="text-[11px] font-semibold text-slate-500">
                {manualReason.length} karakter
              </span>
            </div>

            {/* Preset Cepat Alasan */}
            <div className="space-y-1 mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                Pilih Cepat Alasan:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {MANUAL_REASON_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setManualReason(preset)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition border text-left cursor-pointer ${
                      manualReason === preset
                        ? "bg-blue-50 text-blue-700 border-blue-400 font-semibold"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              id="manual-reason-field"
              required
              rows={3}
              value={manualReason}
              onChange={(e) => setManualReason(e.target.value)}
              placeholder="Wajib menuliskan alasan, misal: Kartu QR tertinggal di rumah, hadir di kelas pukul 07.05..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white shadow-2xs"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Alasan ini disimpan permanen untuk keperluan pelaporan dan validitas presensi.
            </p>
          </div>

          {/* 5. Catatan Tambahan (Opsional) */}
          <div>
            <label htmlFor="manual-extra-notes" className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan Tambahan (Opsional)
            </label>
            <input
              id="manual-extra-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan opsional lain (misal: diantar Ibu Sri)"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white shadow-2xs min-h-[40px]"
            />
          </div>

          {/* Tombol Aksi */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 transition min-h-[42px] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition shadow-xs disabled:opacity-50 min-h-[42px] cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{saving ? "Menyimpan Data..." : "Simpan Presensi Manual"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
