"use client";

import { useEffect, useState } from "react";
import { useModalA11y } from "@/lib/useModalA11y";
import AppShell from "@/components/layout/AppShell";
import Pagination from "@/components/Pagination";
import {
  ShieldCheck,
  Plus,
  Search,
  Edit2,
  Lock,
  Power,
  Users,
  GraduationCap,
  Shield,
  Key,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAlert, useConfirm } from "@/components/ui/DialogProvider";

export default function PenggunaPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const confirmDialog = useConfirm();
  const alertDialog = useAlert();
  const [users, setUsers] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(100);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal State Form
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const userModal = useModalA11y<HTMLDivElement>(modalOpen, () => setModalOpen(false));
  const [formRole, setFormRole] = useState<"SUPERADMIN" | "ADMIN" | "GURU">("ADMIN");
  const [formTeacherId, setFormTeacherId] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (selectedRole) params.append("role", selectedRole);
      params.append("page", String(page));
      params.append("perPage", String(perPage));

      const [resMe, resUsers, resTeachers] = await Promise.all([
        fetch("/api/auth/me"),
        fetch(`/api/users?${params.toString()}`),
        fetch("/api/teachers?perPage=2000"),
      ]);

      const [dataMe, dataUsers, dataTeachers] = await Promise.all([
        resMe.json(),
        resUsers.json(),
        resTeachers.json(),
      ]);

      if (dataMe.success) setCurrentUser(dataMe.user);
      if (dataUsers.success) {
        setUsers(dataUsers.users || []);
        setTotal(dataUsers.total ?? 0);
        setTotalPages(dataUsers.pagination?.totalPages ?? 1);
      }
      if (dataTeachers.success) setTeachers(dataTeachers.teachers || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, selectedRole, page, perPage]);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormUsername("");
    setFormPassword("");
    setShowPassword(false);
    setFormRole("ADMIN");
    setFormTeacherId("");
    setFormIsActive(true);
    setModalOpen(true);
  };

  const openEditModal = (u: any) => {
    setEditingUser(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormUsername(u.username || "");
    setFormPassword(""); // kosongkan kecuali ingin ganti
    setShowPassword(false);
    setFormRole(u.role);
    setFormTeacherId(u.teacherId || "");
    setFormIsActive(u.isActive);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);

    try {
      const isEdit = Boolean(editingUser);
      const url = "/api/users";
      const method = isEdit ? "PATCH" : "POST";

      const payload: any = {
        name: formName.trim(),
        email: formEmail.trim(),
        username: formUsername ? formUsername.trim() : null,
        role: formRole,
        teacherId: formRole === "GURU" ? formTeacherId || null : null,
      };

      if (isEdit) {
        payload.id = editingUser.id;
        payload.isActive = formIsActive;
        if (formPassword.trim()) payload.password = formPassword.trim();
      } else {
        if (!formPassword.trim()) {
          setMsg({ type: "error", text: "Password wajib diisi untuk pengguna baru." });
          return;
        }
        payload.password = formPassword.trim();
      }

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
        setMsg({ type: "error", text: data.message || "Gagal menyimpan akun." });
      }
    } catch {
      setMsg({ type: "error", text: "Terjadi kesalahan jaringan." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (u: any) => {
    if (u.id === currentUser?.id) {
      await alertDialog({
        title: "Tidak Bisa Dilakukan",
        description: "Anda tidak dapat menonaktifkan akun Anda sendiri!",
        variant: "warning",
      });
      return;
    }

    const actionText = u.isActive ? "nonaktifkan" : "aktifkan";
    const ok = await confirmDialog({
      title: u.isActive ? "Nonaktifkan Akun" : "Aktifkan Akun",
      description: `Apakah Anda yakin ingin me-${actionText} akun "${u.name}"?`,
      variant: u.isActive ? "danger" : "success",
      confirmLabel: u.isActive ? "Ya, Nonaktifkan" : "Ya, Aktifkan",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/users?id=${u.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: "success", text: data.message });
        fetchData();
      } else {
        setMsg({ type: "error", text: data.message || "Gagal memperbarui status akun." });
      }
    } catch {
      setMsg({ type: "error", text: "Terjadi kesalahan jaringan." });
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-xs text-slate-500">
        Memuat manajemen akun...
      </div>
    );
  }

  const superadmins = users.filter((u) => u.role === "SUPERADMIN").length;
  const admins = users.filter((u) => u.role === "ADMIN").length;
  const teachersCount = users.filter((u) => u.role === "GURU").length;

  return (
    <AppShell user={currentUser}>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              Manajemen Akun & Hak Akses
            </h1>
            <p className="text-xs text-slate-500 mt-1.5">
              Kelola akun login sistem, penugasan peran (Role-Based Access Control), reset password, dan status aktif.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" /> Tambah Akun Baru
          </button>
        </div>

        {/* Statistik Akun */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Total Akun</p>
              <p className="text-lg font-bold text-slate-900">{total}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Superadmin</p>
              <p className="text-lg font-bold text-purple-700">{superadmins}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Staf Admin</p>
              <p className="text-lg font-bold text-blue-700">{admins}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Guru Terdaftar</p>
              <p className="text-lg font-bold text-emerald-700">{teachersCount}</p>
            </div>
          </div>
        </div>

        {/* Notifikasi Message */}
        {msg && (
          <div
            className={`p-4 rounded-xl text-xs flex items-center justify-between border ${
              msg.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {msg.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{msg.text}</span>
            </div>
            <button
              onClick={() => setMsg(null)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Cari nama, email, atau username..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>

          <select
            value={selectedRole}
            onChange={(e) => {
              setPage(1);
              setSelectedRole(e.target.value);
            }}
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="">Semua Peran (Role)</option>
            <option value="SUPERADMIN">Superadmin</option>
            <option value="ADMIN">Admin TU</option>
            <option value="GURU">Guru</option>
          </select>
        </div>

        {/* Tabel Pengguna */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="hidden xl:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Nama Pengguna</th>
                  <th className="px-4 py-3">Email / Username</th>
                  <th className="px-4 py-3 text-center">Peran (Role)</th>
                  <th className="px-4 py-3">Relasi Guru / Kelas</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Tidak ada akun pengguna yang sesuai dengan filter.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {u.name}
                          {isSelf && (
                            <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-md">
                              Anda
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-slate-800">{u.email}</p>
                          {u.username && (
                            <p className="text-[11px] text-slate-400 font-mono">@{u.username}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {u.role === "SUPERADMIN" && (
                            <span className="px-2.5 py-1 text-[11px] font-bold bg-purple-100 text-purple-700 rounded-full">
                              SUPERADMIN
                            </span>
                          )}
                          {u.role === "ADMIN" && (
                            <span className="px-2.5 py-1 text-[11px] font-bold bg-blue-100 text-blue-700 rounded-full">
                              ADMIN
                            </span>
                          )}
                          {u.role === "GURU" && (
                            <span className="px-2.5 py-1 text-[11px] font-bold bg-emerald-100 text-emerald-700 rounded-full">
                              GURU
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {u.teacher ? (
                            <div>
                              <p className="font-medium text-slate-800">{u.teacher.name}</p>
                              {u.teacher.homeroomClass ? (
                                <p className="text-[11px] text-indigo-600 font-medium">
                                  Wali {u.teacher.homeroomClass.name}
                                </p>
                              ) : (
                                <p className="text-[11px] text-slate-400">Bukan Wali Kelas</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {u.isActive ? (
                            <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                              Aktif
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600 rounded-full">
                              Nonaktif
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openEditModal(u)}
                              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
                              title="Edit / Reset Password"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {!isSelf && (
                              <button
                                onClick={() => handleToggleActive(u)}
                                className={`p-1.5 rounded-lg transition ${
                                  u.isActive
                                    ? "text-red-500 hover:bg-red-50 hover:text-red-700"
                                    : "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-800"
                                }`}
                                title={u.isActive ? "Nonaktifkan Akun" : "Aktifkan Akun"}
                              >
                                <Power className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Kartu mobile: semua informasi tampil tanpa geser horizontal */}
          <div className="xl:hidden divide-y divide-slate-100">
            {users.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-400 text-xs">
                Tidak ada akun pengguna yang sesuai dengan filter.
              </div>
            ) : (
              users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <div key={u.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">
                          {u.name}
                          {isSelf && (
                            <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-md">
                              Anda
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 break-words">
                          <span className="text-slate-800">{u.email}</span>
                          {u.username && <span className="font-mono"> · @{u.username}</span>}
                        </div>
                      </div>
                      {u.role === "SUPERADMIN" && (
                        <span className="px-2.5 py-1 text-[11px] font-bold bg-purple-100 text-purple-700 rounded-full shrink-0">
                          SUPERADMIN
                        </span>
                      )}
                      {u.role === "ADMIN" && (
                        <span className="px-2.5 py-1 text-[11px] font-bold bg-blue-100 text-blue-700 rounded-full shrink-0">
                          ADMIN
                        </span>
                      )}
                      {u.role === "GURU" && (
                        <span className="px-2.5 py-1 text-[11px] font-bold bg-emerald-100 text-emerald-700 rounded-full shrink-0">
                          GURU
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Status</div>
                        {u.isActive ? (
                          <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                            Aktif
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600 rounded-full">
                            Nonaktif
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Relasi Guru / Kelas</div>
                        {u.teacher ? (
                          <div>
                            <div className="font-medium text-slate-800">{u.teacher.name}</div>
                            {u.teacher.homeroomClass ? (
                              <div className="text-[11px] text-indigo-600 font-medium">
                                Wali {u.teacher.homeroomClass.name}
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-400">Bukan Wali Kelas</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(u)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 transition min-h-[40px]"
                      >
                        <Edit2 className="w-4 h-4" /> Edit / Reset
                      </button>
                      {!isSelf && (
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition min-h-[40px] ${
                            u.isActive
                              ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                        >
                          <Power className="w-4 h-4" />
                          {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {!loading && users.length > 0 && (
            <div className="p-4">
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

        {/* Modal Tambah / Edit Pengguna */}
        {modalOpen && (
          <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
              onMouseDown={userModal.handleBackdropMouseDown}
            >
            <div
              ref={userModal.panelRef}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  {editingUser ? "Edit Akun & Reset Password" : "Buat Akun Pengguna Baru"}
                </h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap:</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    placeholder="Contoh: Siti Aisyah, S.Pd."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 placeholder:text-slate-500 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Email Resmi (Login):</label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      required
                      placeholder="email@sekolah.sch.id"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 placeholder:text-slate-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Username (Opsional):</label>
                    <input
                      type="text"
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      placeholder="username"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 placeholder:text-slate-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {editingUser ? "Reset Password Baru (Kosongkan jika tidak diganti):" : "Password Akun:"}
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder={editingUser ? "Biarkan kosong jika tidak diganti" : "Contoh: Rahasia2026"}
                      required={!editingUser}
                      autoComplete="new-password"
                      className="w-full pl-9 pr-10 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900 placeholder:text-slate-500 font-medium"
                    />
                    {formPassword.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                        className="absolute right-2 top-2 p-1 text-slate-500 hover:text-slate-800 rounded"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                  {formPassword.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Minimal 8 karakter, memuat huruf dan angka. Hindari password umum seperti &quot;admin123&quot;.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Peran (Role):</label>
                    <select
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="SUPERADMIN">SUPERADMIN</option>
                      <option value="ADMIN">ADMIN (Staf TU)</option>
                      <option value="GURU">GURU (Wali / Piket)</option>
                    </select>
                  </div>

                  {formRole === "GURU" && (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Tautkan ke Data Guru:</label>
                      <select
                        value={formTeacherId}
                        onChange={(e) => setFormTeacherId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        <option value="">Pilih Guru</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} {t.nip ? `(${t.nip})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {editingUser && editingUser.id !== currentUser.id && (
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="isActiveToggle"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="isActiveToggle" className="font-semibold text-slate-700 cursor-pointer">
                      Akun Aktif (Dapat Login ke Aplikasi)
                    </label>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs transition"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...
                      </>
                    ) : (
                      "Simpan Akun"
                    )}
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
