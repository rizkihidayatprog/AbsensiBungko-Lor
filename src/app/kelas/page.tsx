"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  School,
  Plus,
  Users,
  GraduationCap,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { useConfirm } from "@/components/ui/DialogProvider";

export default function KelasPage() {
  const [user, setUser] = useState<any>(null);
  const confirmDialog = useConfirm();
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState(7);
  const [homeroomId, setHomeroomId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resClasses, resTeachers] = await Promise.all([
        fetch("/api/classes"),
        fetch("/api/teachers?perPage=2000"),
      ]);
      const dataClasses = await resClasses.json();
      const dataTeachers = await resTeachers.json();

      if (dataClasses.success) setClasses(dataClasses.classes || []);
      if (dataTeachers.success) setTeachers(dataTeachers.teachers || []);
    } catch (e) {
      console.error(e);
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

  const openCreateModal = () => {
    setEditingClass(null);
    setName("");
    setGrade(7);
    setHomeroomId("");
    setModalOpen(true);
    setMsg(null);
  };

  const openEditModal = (c: any) => {
    setEditingClass(c);
    setName(c.name);
    setGrade(c.grade);
    setHomeroomId(c.homeroomId || "");
    setModalOpen(true);
    setMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);

    try {
      const url = "/api/classes";
      const method = editingClass ? "PATCH" : "POST";
      const payload = {
        ...(editingClass ? { id: editingClass.id } : {}),
        name,
        grade: Number(grade),
        homeroomId: homeroomId || null,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        setMsg({ type: "success", text: data.message });
        setModalOpen(false);
        fetchData();
      } else {
        setMsg({ type: "error", text: data.message || "Gagal menyimpan kelas." });
      }
    } catch {
      setMsg({ type: "error", text: "Terjadi kesalahan jaringan." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (c: any) => {
    const ok = await confirmDialog({
      title: "Hapus Kelas",
      description: `Hapus kelas "${c.name}"? Pastikan tidak ada siswa yang masih terdaftar.`,
      variant: "danger",
      confirmLabel: "Ya, Hapus",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/classes?id=${c.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: "success", text: data.message });
        fetchData();
      } else {
        setMsg({ type: "error", text: data.message || "Gagal menghapus kelas." });
      }
    } catch {
      setMsg({ type: "error", text: "Terjadi kesalahan jaringan." });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-xs text-slate-500">
        Memuat data kelas...
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
              <School className="w-5 h-5 text-indigo-600" />
              Data Kelas
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Data kelas.
            </p>
          </div>

          {(user.role === "SUPERADMIN" || user.role === "ADMIN") && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Tambah Kelas
            </button>
          )}
        </div>

        {/* Notifikasi */}
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

        {/* Tabel Data Kelas */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">Daftar Rombongan Belajar</h2>
            <span className="text-xs text-slate-400">Total {classes.length} Kelas</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Memuat data...</div>
          ) : classes.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">Belum ada data kelas.</div>
          ) : (
            <>
            <div className="hidden xl:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Nama Kelas</th>
                    <th className="py-3 px-4">Jenjang / Tingkat</th>
                    <th className="py-3 px-4">Wali Kelas</th>
                    <th className="py-3 px-4 text-center">Total Siswa</th>
                    {(user.role === "SUPERADMIN" || user.role === "ADMIN") && (
                      <th className="py-3 px-4 text-right">Aksi</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classes.map((c, i) => (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-4 text-center text-slate-400">{i + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{c.name}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            c.grade <= 6
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {c.grade <= 6 ? `SD • Tingkat ${c.grade}` : `SMP • Tingkat ${c.grade}`}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {c.homeroom ? (
                          <div className="flex items-center gap-1.5 text-slate-800">
                            <GraduationCap className="w-4 h-4 text-slate-400" />
                            <span className="font-medium">{c.homeroom.name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Belum ditugaskan</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-slate-700 font-semibold">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          {c._count?.students || 0}
                        </span>
                      </td>
                      {(user.role === "SUPERADMIN" || user.role === "ADMIN") && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(c)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition"
                              title="Edit Kelas"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(c)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                              title="Hapus Kelas"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Kartu mobile: semua informasi tampil tanpa geser horizontal */}
            <div className="xl:hidden divide-y divide-slate-100">
              {classes.map((c, i) => (
                <div key={c.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] text-slate-400 font-bold">{i + 1}.</div>
                      <div className="font-bold text-slate-900">{c.name}</div>
                    </div>
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${
                        c.grade <= 6
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {c.grade <= 6 ? `SD • Tingkat ${c.grade}` : `SMP • Tingkat ${c.grade}`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Wali Kelas</div>
                      {c.homeroom ? (
                        <div className="flex items-center gap-1.5 text-slate-800">
                          <GraduationCap className="w-4 h-4 text-slate-400" />
                          <span className="font-medium">{c.homeroom.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Belum ditugaskan</span>
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total Siswa</div>
                      <span className="inline-flex items-center gap-1 text-slate-700 font-semibold">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {c._count?.students || 0}
                      </span>
                    </div>
                  </div>

                  {(user.role === "SUPERADMIN" || user.role === "ADMIN") && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(c)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition min-h-[40px]"
                      >
                        <Edit2 className="w-4 h-4" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition min-h-[40px]"
                      >
                        <Trash2 className="w-4 h-4" /> Hapus
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            </>
          )}
        </div>

        {/* Modal Tambah / Edit Kelas */}
        {modalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">
                  {editingClass ? "Edit Data Kelas" : "Tambah Kelas Baru"}
                </h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Kelas (contoh: 7A, 1B)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Contoh: 7A"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tingkat Kelas (Grade)
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <optgroup label="Sekolah Dasar (SD)">
                      <option value={1}>Tingkat 1 (SD)</option>
                      <option value={2}>Tingkat 2 (SD)</option>
                      <option value={3}>Tingkat 3 (SD)</option>
                      <option value={4}>Tingkat 4 (SD)</option>
                      <option value={5}>Tingkat 5 (SD)</option>
                      <option value={6}>Tingkat 6 (SD)</option>
                    </optgroup>
                    <optgroup label="Sekolah Menengah Pertama (SMP)">
                      <option value={7}>Tingkat 7 (SMP)</option>
                      <option value={8}>Tingkat 8 (SMP)</option>
                      <option value={9}>Tingkat 9 (SMP)</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Wali Kelas (Opsional)
                  </label>
                  <select
                    value={homeroomId}
                    onChange={(e) => setHomeroomId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">-- Pilih Guru Wali Kelas --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.nip ? `(NIP: ${t.nip})` : ""}
                      </option>
                    ))}
                  </select>
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
                    {submitting ? "Menyimpan..." : "Simpan Kelas"}
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
