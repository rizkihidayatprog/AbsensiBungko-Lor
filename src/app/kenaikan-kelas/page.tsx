"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  GraduationCap,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Info,
  Users,
  School,
  Calendar,
  Layers,
  ChevronRight,
} from "lucide-react";

interface StudentRow {
  studentId: string;
  nis: string;
  name: string;
  gender: string;
  currentClass: string;
  action: "NAIK_KELAS" | "TINGGAL_KELAS" | "LULUS" | "MUTASI";
  targetClassId: string;
}

export default function KenaikanKelasPage() {
  const [user, setUser] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);

  // Selection filters
  const [selectedSourceClass, setSelectedSourceClass] = useState("");
  const [selectedSourceTerm, setSelectedSourceTerm] = useState("");
  const [selectedTargetTerm, setSelectedTargetTerm] = useState("");

  // Student rows
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulkTargetClass, setBulkTargetClass] = useState("");

  // Modal preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setUser(data.user);
      });

    fetch("/api/classes")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setClasses(data.classes || []);
          if (data.classes?.length > 0) {
            setSelectedSourceClass(data.classes[0].id);
          }
        }
      });

    fetch("/api/academic-terms")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const allTerms: any[] = [];
          data.academicYears.forEach((ay: any) => {
            ay.terms.forEach((t: any) => allTerms.push(t));
          });
          setTerms(allTerms);
          if (data.activeTerm) {
            setSelectedSourceTerm(data.activeTerm.id);
            // Default target term to another term if available
            const otherTerm = allTerms.find((t) => t.id !== data.activeTerm.id);
            if (otherTerm) setSelectedTargetTerm(otherTerm.id);
            else setSelectedTargetTerm(data.activeTerm.id);
          }
        }
      });
  }, []);

  const handleFetchStudents = async () => {
    if (!selectedSourceClass) return;
    try {
      setLoading(true);
      setMsg(null);
      const params = new URLSearchParams({
        classId: selectedSourceClass,
        ...(selectedSourceTerm ? { termId: selectedSourceTerm } : {}),
      });

      const res = await fetch(`/api/promotions?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        // Cari rekomendasi kelas berikutnya (grade + 1)
        const currentClassObj = classes.find((c) => c.id === selectedSourceClass);
        const nextGrade = currentClassObj ? currentClassObj.grade + 1 : null;
        const recommendedNextClass = classes.find((c) => c.grade === nextGrade);

        const rows: StudentRow[] = (data.students || []).map((s: any) => ({
          studentId: s.id,
          nis: s.nis,
          name: s.name,
          gender: s.gender,
          currentClass: s.class?.name || "-",
          action: "NAIK_KELAS",
          targetClassId: recommendedNextClass ? recommendedNextClass.id : selectedSourceClass,
        }));

        setStudents(rows);
        if (recommendedNextClass) {
          setBulkTargetClass(recommendedNextClass.id);
        } else if (classes.length > 0) {
          setBulkTargetClass(classes[0].id);
        }
      } else {
        setMsg({ type: "error", text: data.message || "Gagal memuat siswa." });
      }
    } catch {
      setMsg({ type: "error", text: "Terjadi kesalahan jaringan." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSourceClass) {
      handleFetchStudents();
    }
  }, [selectedSourceClass, selectedSourceTerm]);

  const handleApplyBulkPromotion = () => {
    if (!bulkTargetClass) return;
    setStudents((prev) =>
      prev.map((s) => ({
        ...s,
        action: "NAIK_KELAS",
        targetClassId: bulkTargetClass,
      }))
    );
  };

  const handleRowChange = (
    index: number,
    field: "action" | "targetClassId",
    value: string
  ) => {
    setStudents((prev) => {
      const copy = [...prev];
      if (field === "action") {
        copy[index].action = value as any;
        if (value === "TINGGAL_KELAS") {
          copy[index].targetClassId = selectedSourceClass;
        }
      } else {
        copy[index].targetClassId = value;
      }
      return copy;
    });
  };

  const handleExecutePromotion = async () => {
    try {
      setSubmitting(true);
      const payload = {
        sourceClassId: selectedSourceClass,
        sourceTermId: selectedSourceTerm || null,
        targetTermId: selectedTargetTerm,
        promotions: students.map((s) => ({
          studentId: s.studentId,
          action: s.action,
          targetClassId: s.targetClassId,
        })),
      };

      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setMsg({ type: "success", text: data.message });
        setPreviewOpen(false);
        handleFetchStudents();
      } else {
        setMsg({ type: "error", text: data.message || "Gagal memproses kenaikan kelas." });
      }
    } catch {
      setMsg({ type: "error", text: "Terjadi kesalahan koneksi server." });
    } finally {
      setSubmitting(false);
    }
  };

  // Preview Counts
  const countNaik = students.filter((s) => s.action === "NAIK_KELAS").length;
  const countTinggal = students.filter((s) => s.action === "TINGGAL_KELAS").length;
  const countLulus = students.filter((s) => s.action === "LULUS").length;
  const countMutasi = students.filter((s) => s.action === "MUTASI").length;

  const currentClassData = classes.find((c) => c.id === selectedSourceClass);
  const targetTermData = terms.find((t) => t.id === selectedTargetTerm);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-xs text-slate-500">
        Memuat sesi...
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
              <GraduationCap className="w-5 h-5 text-indigo-600" />
              Proses Kenaikan Kelas & Transisi Siswa
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Perbarui penempatan kelas siswa untuk periode baru secara massal tanpa mengubah akun atau QR Code siswa.
            </p>
          </div>
        </div>

        {/* Notifikasi Alert */}
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

        {/* Card Edukasi Alur Kenaikan Kelas */}
        <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-5 rounded-xl shadow-sm border border-indigo-800">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-800/80 rounded-lg shrink-0 mt-0.5">
              <Info className="w-5 h-5 text-indigo-200" />
            </div>
            <div className="space-y-1.5 text-xs text-indigo-100 leading-relaxed">
              <h2 className="text-sm font-bold text-white">
                Prinsip Kenaikan Kelas: Identitas & QR Code Siswa Tetap Utuh
              </h2>
              <p>
                Ketika siswa naik kelas (misalnya dari <strong>Kelas 7A</strong> ke <strong>Kelas 8A</strong>), sistem <strong>TIDAK MEMBUAT AKUN BARU</strong> dan <strong>TIDAK MENGHAPUS RIWAYAT LAMA</strong>.
              </p>
              <p className="text-indigo-200">
                Kartu QR Code siswa tetap berlaku. Riwayat absensi di kelas 7A tersimpan permanen di database, sementara absensi berikutnya otomatis terikat pada kelas 8A dan periode semester baru.
              </p>
            </div>
          </div>
        </div>

        {/* Form Filter Pemilihan Kelas & Periode */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-slate-400" />
            Langkah 1: Tentukan Kelas Asal & Periode Tujuan
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Kelas Asal yang Diproses
              </label>
              <select
                value={selectedSourceClass}
                onChange={(e) => setSelectedSourceClass(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Tingkat {c.grade})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Semester Asal (Saat Ini)
              </label>
              <select
                value={selectedSourceTerm}
                onChange={(e) => setSelectedSourceTerm(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.isActive ? "• [Aktif]" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Semester Tujuan (Periode Baru)
              </label>
              <select
                value={selectedTargetTerm}
                onChange={(e) => setSelectedTargetTerm(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.isActive ? "• [Aktif]" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabel Siswa & Aksi Kenaikan Kelas */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Langkah 2: Tentukan Penempatan Siswa {currentClassData?.name || ""}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Total {students.length} siswa ditemukan pada kelas ini.
              </p>
            </div>

            {/* Bulk Action Bar */}
            {students.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs">
                <span className="text-slate-600 font-medium">Set massal naik ke:</span>
                <select
                  value={bulkTargetClass}
                  onChange={(e) => setBulkTargetClass(e.target.value)}
                  className="border border-slate-300 rounded-md px-2.5 py-1 text-xs bg-white"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleApplyBulkPromotion}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1 rounded-md transition shadow-xs"
                >
                  Terapkan ke Semua
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Memuat daftar siswa...</div>
          ) : students.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Tidak ada siswa terdaftar di kelas ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3.5 w-10 text-center">No</th>
                    <th className="py-3 px-3.5">NIS</th>
                    <th className="py-3 px-3.5">Nama Siswa</th>
                    <th className="py-3 px-3.5 text-center">L/P</th>
                    <th className="py-3 px-3.5">Kelas Saat Ini</th>
                    <th className="py-3 px-3.5">Keputusan Status</th>
                    <th className="py-3 px-3.5">Kelas Tujuan Baru</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s, idx) => (
                    <tr key={s.studentId} className="hover:bg-slate-50/50 transition">
                      <td className="py-2.5 px-3.5 text-center text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3.5 font-mono text-slate-600">{s.nis}</td>
                      <td className="py-2.5 px-3.5 font-semibold text-slate-900">{s.name}</td>
                      <td className="py-2.5 px-3.5 text-center text-slate-500">{s.gender}</td>
                      <td className="py-2.5 px-3.5 text-slate-600">{s.currentClass}</td>
                      <td className="py-2.5 px-3.5">
                        <select
                          value={s.action}
                          onChange={(e) => handleRowChange(idx, "action", e.target.value)}
                          className={`font-semibold border rounded-lg px-2.5 py-1 text-xs transition ${
                            s.action === "NAIK_KELAS"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : s.action === "TINGGAL_KELAS"
                              ? "bg-amber-50 text-amber-800 border-amber-300"
                              : s.action === "LULUS"
                              ? "bg-blue-50 text-blue-800 border-blue-300"
                              : "bg-rose-50 text-rose-800 border-rose-300"
                          }`}
                        >
                          <option value="NAIK_KELAS">Naik Kelas</option>
                          <option value="TINGGAL_KELAS">Tinggal Kelas</option>
                          <option value="LULUS">Lulus</option>
                          <option value="MUTASI">Pindah / Mutasi</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-3.5">
                        {s.action === "NAIK_KELAS" || s.action === "TINGGAL_KELAS" ? (
                          <select
                            value={s.targetClassId}
                            onChange={(e) => handleRowChange(idx, "targetClassId", e.target.value)}
                            className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs bg-white text-slate-800 focus:ring-1 focus:ring-indigo-500"
                          >
                            {classes.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} (Tingkat {c.grade})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">- Nonaktif / Selesai -</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Action Footer */}
          {students.length > 0 && (
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                  Naik: {countNaik}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                  Tinggal: {countTinggal}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 font-semibold text-blue-700">
                  Lulus: {countLulus}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                  Mutasi: {countMutasi}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow-sm transition flex items-center gap-2"
              >
                Pratinjau & Simpan Kenaikan Kelas <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Modal Pratinjau & Konfirmasi Eksekusi */}
        {previewOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-slate-200 space-y-4">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Konfirmasi Kenaikan Kelas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Periksa ringkasan sebelum perubahan penempatan siswa disimpan ke database.
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <div className="p-3 bg-slate-50 rounded-lg space-y-1.5 border border-slate-200">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Kelas Asal:</span>
                    <strong className="text-slate-900">{currentClassData?.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Semester Tujuan:</span>
                    <strong className="text-slate-900">{targetTermData?.name || "-"}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Siswa Diproses:</span>
                    <strong className="text-slate-900">{students.length} Siswa</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="text-[11px] text-emerald-700">Naik Kelas</div>
                    <div className="text-lg font-bold text-emerald-800">{countNaik} Siswa</div>
                  </div>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="text-[11px] text-amber-700">Tinggal Kelas</div>
                    <div className="text-lg font-bold text-amber-800">{countTinggal} Siswa</div>
                  </div>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-[11px] text-blue-700">Lulus</div>
                    <div className="text-lg font-bold text-blue-800">{countLulus} Siswa</div>
                  </div>
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                    <div className="text-[11px] text-rose-700">Pindah / Mutasi</div>
                    <div className="text-lg font-bold text-rose-800">{countMutasi} Siswa</div>
                  </div>
                </div>

                <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg flex items-start gap-2 text-[11px] text-blue-900">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    Seluruh riwayat absensi kelas {currentClassData?.name} tetap aman tersimpan. QR Code kartu siswa tetap sama dan tidak perlu dicetak ulang.
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-50 transition text-xs"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleExecutePromotion}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition text-xs disabled:opacity-50"
                >
                  {submitting ? "Memproses..." : "Konfirmasi & Terapkan"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
