"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
  School,
  Mail,
  Phone,
  ShieldCheck,
  CheckCircle2,
  X,
  Search,
  FileSpreadsheet,
} from "lucide-react";
import { useConfirm } from "@/components/ui/DialogProvider";
import CsvImportModal from "@/components/CsvImportModal";
import Pagination from "@/components/Pagination";

export default function GuruPage() {
  const [user, setUser] = useState<any>(null);
  const confirmDialog = useConfirm();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(100);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modal Impor CSV
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Modal State Form
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [nip, setNip] = useState("");
  const [gender, setGender] = useState("L");
  const [phone, setPhone] = useState("");
  const [createAccount, setCreateAccount] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("guru123");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      params.append("page", String(page));
      params.append("perPage", String(perPage));
      const res = await fetch(`/api/teachers?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setTeachers(data.teachers || []);
        setTotal(data.total ?? 0);
        setTotalPages(data.pagination?.totalPages ?? 1);
      }
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
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page, perPage]);

  const openCreateModal = () => {
    setEditingTeacher(null);
    setName("");
    setNip("");
    setGender("L");
    setPhone("");
    setCreateAccount(false);
    setEmail("");
    setPassword("guru123");
    setModalOpen(true);
    setMsg(null);
  };

  const openEditModal = (t: any) => {
    setEditingTeacher(t);
    setName(t.name);
    setNip(t.nip || "");
    setGender(t.gender);
    setPhone(t.phone || "");
    setCreateAccount(false);
    setModalOpen(true);
    setMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);

    try {
      const url = "/api/teachers";
      const method = editingTeacher ? "PATCH" : "POST";
      const payload = {
        ...(editingTeacher ? { id: editingTeacher.id } : {}),
        name,
        nip: nip || null,
        gender,
        phone: phone || null,
        createAccount,
        email: email || null,
        password: password || undefined,
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
        setMsg({ type: "error", text: data.message || "Gagal menyimpan guru." });
      }
    } catch {
      setMsg({ type: "error", text: "Terjadi kesalahan jaringan." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (t: any) => {
    const ok = await confirmDialog({
      title: "Nonaktifkan Guru",
      description: `Nonaktifkan data guru "${t.name}"?`,
      variant: "danger",
      confirmLabel: "Ya, Nonaktifkan",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/teachers?id=${t.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: "success", text: data.message });
        fetchData();
      } else {
        setMsg({ type: "error", text: data.message || "Gagal menonaktifkan guru." });
      }
    } catch {
      setMsg({ type: "error", text: "Terjadi kesalahan jaringan." });
    }
  };

  const filteredTeachers = teachers;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-xs text-slate-500">
        Memuat data guru...
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
              Data Guru & Tenaga Pendidik
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Kelola data guru, perwalian kelas, serta akun aplikasi guru.
            </p>
          </div>

          {(user.role === "SUPERADMIN" || user.role === "ADMIN") && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setImportModalOpen(true)}
                className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold px-3.5 py-2.5 rounded-lg shadow-xs transition"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Impor CSV
              </button>
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                Tambah Guru
              </button>
            </div>
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

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari nama guru, NIP, atau no telepon..."
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>
        </div>

        {/* Tabel Data Guru */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">Daftar Guru</h2>
            <span className="text-xs text-slate-400">Total {total} Guru</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Memuat data...</div>
          ) : filteredTeachers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">Tidak ada data guru ditemukan.</div>
          ) : (
            <>
            <div className="hidden xl:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Nama Lengkap</th>
                    <th className="py-3 px-4">NIP</th>
                    <th className="py-3 px-4 text-center">L/P</th>
                    <th className="py-3 px-4">Wali Kelas</th>
                    <th className="py-3 px-4">Kontak / HP</th>
                    <th className="py-3 px-4 text-center">Akun Login</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTeachers.map((t, i) => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-4 text-center text-slate-400">{(page - 1) * perPage + i + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{t.name}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{t.nip || "-"}</td>
                      <td className="py-3 px-4 text-center text-slate-500">{t.gender}</td>
                      <td className="py-3 px-4">
                        {t.homeroomClass ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                            <School className="w-3 h-3" />
                            {t.homeroomClass.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">- Bukan Wali Kelas -</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{t.phone || "-"}</td>
                      <td className="py-3 px-4 text-center">
                        {t.user ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <ShieldCheck className="w-3 h-3" />
                            Aktif
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Tidak Ada</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {(user.role === "SUPERADMIN" || user.role === "ADMIN") && (
                            <>
                              <button
                                onClick={() => openEditModal(t)}
                                className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                                title="Edit Guru"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(t)}
                                className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                                title="Nonaktifkan Guru"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Kartu mobile: semua informasi tampil tanpa geser horizontal */}
            <div className="xl:hidden divide-y divide-slate-100">
              {filteredTeachers.map((t, i) => (
                <div key={t.id} className="p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="text-[11px] font-bold text-slate-400 mt-0.5 w-6 shrink-0">
                      {(page - 1) * perPage + i + 1}.
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900">{t.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        NIP: {t.nip || "-"}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">L/P</div>
                      <div className="text-slate-600">{t.gender || "-"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Akun Login</div>
                      {t.user ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <ShieldCheck className="w-3 h-3" /> Aktif
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Tidak Ada</span>
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Wali Kelas</div>
                      {t.homeroomClass ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700">
                          <School className="w-3 h-3" /> {t.homeroomClass.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">- Bukan Wali -</span>
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Kontak / HP</div>
                      <div className="text-slate-600">{t.phone || "-"}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {(user.role === "SUPERADMIN" || user.role === "ADMIN") && (
                      <>
                        <button
                          onClick={() => openEditModal(t)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition min-h-[40px]"
                        >
                          <Edit2 className="w-4 h-4" /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(t)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition min-h-[40px]"
                        >
                          <Trash2 className="w-4 h-4" /> Nonaktif
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            </>
          )}

          {!loading && filteredTeachers.length > 0 && (
            <div className="px-4 pb-4">
              <Pagination
                page={page}
                perPage={perPage}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
                onPerPageChange={(n) => {
                  setPerPage(n);
                  setPage(1);
                }}
              />
            </div>
          )}
        </div>

        {/* Modal Tambah / Edit Guru */}
        {modalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">
                  {editingTeacher ? "Edit Data Guru" : "Tambah Guru Baru"}
                </h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Lengkap & Gelar
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Contoh: Dra. Hj. Siti Rahmawati, M.Pd"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">NIP (Opsional)</label>
                    <input
                      type="text"
                      value={nip}
                      onChange={(e) => setNip(e.target.value)}
                      placeholder="19800101..."
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="L">Laki-laki (L)</option>
                      <option value="P">Perempuan (P)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nomor Telepon / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="081234567890"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>

                {!editingTeacher && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createAccount}
                        onChange={(e) => setCreateAccount(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-semibold text-slate-800">
                        Buatkan akun login aplikasi untuk guru ini
                      </span>
                    </label>

                    {createAccount && (
                      <div className="space-y-2 pt-2 border-t border-slate-200">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Email Akun Guru
                          </label>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required={createAccount}
                            placeholder="guru@sekolah.sch.id"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Password Sementara
                          </label>
                          <input
                            type="text"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="guru123"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

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
                    {submitting ? "Menyimpan..." : "Simpan Guru"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <CsvImportModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          type="teachers"
          onSuccess={fetchData}
        />
      </div>
    </AppShell>
  );
}
