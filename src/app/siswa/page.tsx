"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  Users,
  Search,
  Plus,
  QrCode,
  CheckCircle,
  XCircle,
  Download,
  X,
  AlertCircle,
  FileSpreadsheet,
  Filter,
  RotateCcw,
  Printer,
  Camera,
  Edit3,
  User,
  Phone,
  Sparkles,
} from "lucide-react";
import CsvImportModal from "@/components/CsvImportModal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useModalA11y } from "@/lib/useModalA11y";
import { compressAvatar, formatFileSize } from "@/lib/image-compress";
import Pagination from "@/components/Pagination";

export default function SiswaPage() {
  const [user, setUser] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(100);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modal Impor CSV
  const [modalImportOpen, setModalImportOpen] = useState(false);

  // Modal Tambah
  const [modalAddOpen, setModalAddOpen] = useState(false);
  const [formNis, setFormNis] = useState("");
  const [formNisn, setFormNisn] = useState("");
  const [formName, setFormName] = useState("");
  const [formGender, setFormGender] = useState("L");
  const [formClassId, setFormClassId] = useState("");
  const [formParentName, setFormParentName] = useState("");
  const [formParentPhone, setFormParentPhone] = useState("");
  const [formPhotoUrl, setFormPhotoUrl] = useState<string | null>(null);
  const [compressingAddPhoto, setCompressingAddPhoto] = useState(false);
  const [addPhotoStats, setAddPhotoStats] = useState<{ original: number; compressed: number } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Modal Edit Siswa
  const [modalEditOpen, setModalEditOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [editNis, setEditNis] = useState("");
  const [editNisn, setEditNisn] = useState("");
  const [editName, setEditName] = useState("");
  const [editGender, setEditGender] = useState("L");
  const [editClassId, setEditClassId] = useState("");
  const [editParentName, setEditParentName] = useState("");
  const [editParentPhone, setEditParentPhone] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState<string | null>(null);
  const [editIsActive, setEditIsActive] = useState(true);
  const [compressingEditPhoto, setCompressingEditPhoto] = useState(false);
  const [editPhotoStats, setEditPhotoStats] = useState<{ original: number; compressed: number } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Modal QR Code Preview
  const [qrModalStudent, setQrModalStudent] = useState<any | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Aksesibilitas modal
  const handleCloseAddModal = useCallback(() => setModalAddOpen(false), []);
  const handleCloseEditModal = useCallback(() => setModalEditOpen(false), []);
  const handleCloseQrModal = useCallback(() => setQrModalStudent(null), []);

  const addModal = useModalA11y<HTMLDivElement>(modalAddOpen, handleCloseAddModal);
  const editModal = useModalA11y<HTMLDivElement>(modalEditOpen, handleCloseEditModal);
  const qrModal = useModalA11y<HTMLDivElement>(Boolean(qrModalStudent), handleCloseQrModal);

  // Nama sekolah untuk kartu QR (diambil dari Pengaturan Sekolah)
  const [schoolName, setSchoolName] = useState("");

  const fetchSessionAndData = async () => {
    try {
      setLoading(true);
      const resMe = await fetch("/api/auth/me");
      const dataMe = await resMe.json();
      if (dataMe.success) {
        setUser(dataMe.user);
      }

      // Ambil data siswa
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (selectedClass) params.append("classId", selectedClass);
      params.append("page", String(page));
      params.append("perPage", String(perPage));

      const resStudents = await fetch(`/api/students?${params.toString()}`);
      const dataStudents = await resStudents.json();
      if (dataStudents.success) {
        setStudents(dataStudents.students);
        setTotal(dataStudents.total ?? 0);
        setTotalPages(dataStudents.pagination?.totalPages ?? 1);
      }

      // Ambil daftar kelas untuk filter / dropdown
      const resClasses = await fetch("/api/classes");
      const dataClasses = await resClasses.json();
      if (dataClasses.success) {
        setClasses(dataClasses.classes);
      }

      // Ambil nama sekolah untuk kartu QR
      const resSettings = await fetch("/api/settings");
      const dataSettings = await resSettings.json();
      if (dataSettings.success && dataSettings.setting?.schoolName) {
        setSchoolName(dataSettings.setting.schoolName);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionAndData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, selectedClass, page, perPage]);

  const handleOpenAddModal = () => {
    setFormNis("");
    setFormNisn("");
    setFormName("");
    setFormGender("L");
    setFormClassId(classes[0]?.id || "");
    setFormPhotoUrl(null);
    setAddPhotoStats(null);
    setFormError(null);
    setModalAddOpen(true);
  };

  const handleUploadPhoto = async (
    file: File,
    onSuccess: (url: string, stats: { original: number; compressed: number }) => void,
    onSetCompressing: (c: boolean) => void,
    onError: (err: string) => void
  ) => {
    onSetCompressing(true);
    try {
      const compressed = await compressAvatar(file, 320, 0.75);
      const formData = new FormData();
      formData.append("file", compressed.blob, compressed.fileName);
      formData.append("type", "student");

      const res = await fetch("/api/upload/avatar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        onError(data.message || "Gagal mengunggah foto siswa.");
        return;
      }

      onSuccess(data.url, {
        original: compressed.originalSize,
        compressed: compressed.compressedSize,
      });
    } catch (e: any) {
      onError(e?.message || "Gagal memproses foto.");
    } finally {
      onSetCompressing(false);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nis: formNis.trim(),
          nisn: formNisn.trim() || undefined,
          name: formName.trim(),
          gender: formGender,
          classId: formClassId,
          parentName: formParentName.trim() || undefined,
          parentPhone: formParentPhone.trim() || undefined,
          photoUrl: formPhotoUrl || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setFormError(data.message || "Gagal menambahkan data siswa.");
        setSaving(false);
        return;
      }

      setModalAddOpen(false);
      fetchSessionAndData();
    } catch {
      setFormError("Terjadi kesalahan jaringan.");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditModal = (student: any) => {
    setEditingStudent(student);
    setEditNis(student.nis || "");
    setEditNisn(student.nisn || "");
    setEditName(student.name || "");
    setEditGender(student.gender || "L");
    setEditClassId(student.classId || "");
    setEditParentName(student.parentName || "");
    setEditParentPhone(student.parentPhone || "");
    setEditPhotoUrl(student.photoUrl || null);
    setEditIsActive(student.isActive);
    setEditPhotoStats(null);
    setEditError(null);
    setModalEditOpen(true);
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setEditError(null);
    setEditSaving(true);

    try {
      const res = await fetch("/api/students", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingStudent.id,
          nis: editNis.trim(),
          nisn: editNisn.trim() || undefined,
          name: editName.trim(),
          gender: editGender,
          classId: editClassId,
          parentName: editParentName.trim() || null,
          parentPhone: editParentPhone.trim() || null,
          photoUrl: editPhotoUrl,
          isActive: editIsActive,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setEditError(data.message || "Gagal memperbarui data siswa.");
        setEditSaving(false);
        return;
      }

      setModalEditOpen(false);
      fetchSessionAndData();
    } catch {
      setEditError("Terjadi kesalahan jaringan.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleShowQr = async (student: any) => {
    setQrModalStudent(student);
    try {
      const { toDataURL } = await import("qrcode");
      const url = await toDataURL(student.qrTokenHash, {
        width: 320,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      setQrDataUrl(url);
    } catch {
      // fallback
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-500">
        Memuat data siswa...
      </div>
    );
  }

  const canEdit = user.role === "SUPERADMIN" || user.role === "ADMIN";
  const canEditStudent = (s: any) =>
    user.role === "SUPERADMIN" ||
    user.role === "ADMIN" ||
    (user.role === "GURU" && user.homeroomClass?.id === s.classId);
  const hasFilter = Boolean(search || selectedClass);

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <Users className="w-5 h-5" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Master Data Siswa
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              {user.role === "GURU"
                ? `Menampilkan data siswa kelas perwalian ${user.homeroomClass?.name || ""}`
                : "Pengelolaan identitas siswa aktif, penempatan kelas, dan token QR Code presensi"}
            </p>
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setModalImportOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl shadow-2xs transition min-h-[42px] focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                <span>Impor Data CSV</span>
              </button>
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition min-h-[42px] focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Tambah Siswa Baru</span>
              </button>
            </div>
          )}
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex-1 w-full flex flex-col sm:flex-row gap-3">
            {/* Input Pencarian */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" aria-hidden="true" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                placeholder="Cari berdasarkan nama atau NIS siswa..."
                className="w-full pl-10 pr-9 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white shadow-2xs min-h-[42px]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                  setPage(1);
                  setSearch("");
                }}
                  aria-label="Hapus teks pencarian"
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Kelas */}
            {user.role !== "GURU" && (
              <div className="w-full sm:w-56">
                <select
                  value={selectedClass}
                  onChange={(e) => {
                  setPage(1);
                  setSelectedClass(e.target.value);
                }}
                  className="w-full py-2.5 px-3 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white shadow-2xs min-h-[42px]"
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
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end text-xs text-slate-600">
            {hasFilter && (
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setSearch("");
                  setSelectedClass("");
                }}
                className="inline-flex items-center gap-1 font-semibold text-rose-600 hover:text-rose-800 transition"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            )}
            <span className="font-medium bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              Total: <strong className="text-slate-900">{total}</strong> Siswa
            </span>
          </div>
        </div>

        {/* Tabel Data Siswa */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-500 space-y-2">
              <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p>Memuat daftar siswa...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="Tidak Ada Data Siswa Ditemukan"
                description={
                  hasFilter
                    ? "Tidak ada siswa yang sesuai dengan kata kunci pencarian atau filter kelas yang dipilih."
                    : "Belum ada siswa yang terdaftar di sistem. Silakan tambah data siswa atau impor melalui file CSV."
                }
                action={
                  hasFilter
                    ? {
                        label: "Reset Filter",
                        onClick: () => {
                          setPage(1);
                          setSearch("");
                          setSelectedClass("");
                        },
                      }
                    : canEdit
                    ? {
                        label: "Tambah Siswa Baru",
                        onClick: handleOpenAddModal,
                      }
                    : undefined
                }
              />
            </div>
          ) : (
            <>
            <div className="hidden xl:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">NIS</th>
                    <th className="py-3.5 px-4">Siswa</th>
                    <th className="py-3.5 px-4">Gender</th>
                    <th className="py-3.5 px-4">Kelas</th>
                    <th className="py-3.5 px-4">Orang Tua / Kontak WA</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {students.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-800">{s.nis}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {s.photoUrl ? (
                            <img
                              src={s.photoUrl}
                              alt={s.name}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-2xs shrink-0"
                            />
                          ) : (
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                s.gender === "L"
                                  ? "bg-blue-100 text-blue-700 border border-blue-200"
                                  : "bg-pink-100 text-pink-700 border border-pink-200"
                              }`}
                            >
                              {s.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-slate-900">{s.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              NISN: {s.nisn || "-"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            s.gender === "L"
                              ? "bg-blue-50 text-blue-800 border-blue-200"
                              : "bg-pink-50 text-pink-800 border-pink-200"
                          }`}
                        >
                          {s.gender === "L" ? "Laki-laki" : "Perempuan"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        Kelas {s.class?.name}
                      </td>
                      <td className="py-3 px-4">
                        {s.parentName || s.parentPhone ? (
                          <div>
                            <div className="font-medium text-slate-800">{s.parentName || "-"}</div>
                            {s.parentPhone ? (
                              <div className="text-[11px] text-emerald-700 font-mono flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>{s.parentPhone}</span>
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-400">Belum ada no. WA</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={s.isActive ? "AKTIF" : "NONAKTIF"} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {canEditStudent(s) && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(s)}
                              aria-label={`Ubah data dan foto ${s.name}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition min-h-[34px] focus-visible:ring-2 focus-visible:ring-blue-600 shadow-2xs"
                            >
                              <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleShowQr(s)}
                            aria-label={`Lihat dan unduh kartu QR ${s.name}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition min-h-[34px] focus-visible:ring-2 focus-visible:ring-blue-600 shadow-2xs"
                          >
                            <QrCode className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Kartu QR</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Kartu mobile: semua informasi tampil tanpa geser horizontal */}
            <div className="xl:hidden divide-y divide-slate-200 bg-white">
              {students.map((s) => (
                <div key={s.id} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    {s.photoUrl ? (
                      <img
                        src={s.photoUrl}
                        alt={s.name}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-2xs shrink-0"
                      />
                    ) : (
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                          s.gender === "L"
                            ? "bg-blue-100 text-blue-700 border border-blue-200"
                            : "bg-pink-100 text-pink-700 border border-pink-200"
                        }`}
                      >
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900">{s.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        NIS: {s.nis} · NISN: {s.nisn || "-"}
                      </div>
                    </div>
                    <StatusBadge status={s.isActive ? "AKTIF" : "NONAKTIF"} size="sm" />
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Gender</div>
                      <div className="text-slate-700">{s.gender === "L" ? "Laki-laki" : "Perempuan"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Kelas</div>
                      <div className="font-semibold text-slate-800">Kelas {s.class?.name}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Orang Tua / Kontak WA</div>
                      {s.parentName || s.parentPhone ? (
                        <div>
                          <div className="font-medium text-slate-800">{s.parentName || "-"}</div>
                          {s.parentPhone ? (
                            <div className="text-[11px] text-emerald-700 font-mono flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>{s.parentPhone}</span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400">Belum ada no. WA</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">-</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {canEditStudent(s) && (
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(s)}
                        aria-label={`Ubah data dan foto ${s.name}`}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition min-h-[40px]"
                      >
                        <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Edit</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleShowQr(s)}
                      aria-label={`Lihat dan unduh kartu QR ${s.name}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition min-h-[40px]"
                    >
                      <QrCode className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Kartu QR</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            </>
          )}

          {!loading && students.length > 0 && (
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

        {/* MODAL TAMBAH SISWA (AKSESIBEL & LENGKAP) */}
        {modalAddOpen && (
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
            onMouseDown={addModal.handleBackdropMouseDown}
          >
            <div
              ref={addModal.panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-add-title"
              className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <h3 id="modal-add-title" className="text-base font-bold text-slate-900">
                  Tambah Siswa Baru
                </h3>
                <button
                  type="button"
                  onClick={() => setModalAddOpen(false)}
                  aria-label="Tutup form tambah siswa"
                  className="p-1.5 -mr-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {formError && (
                <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
                  <span className="font-medium">{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateStudent} className="space-y-4">
                {/* Unggah Foto Profil Siswa */}
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Foto Profil Siswa (Opsional)
                  </label>
                  <div className="flex items-center gap-3.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="relative w-14 h-14 rounded-full overflow-hidden bg-slate-200 border-2 border-white shadow-2xs shrink-0 flex items-center justify-center">
                      {formPhotoUrl ? (
                        <img src={formPhotoUrl} alt="Preview Foto Siswa" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-7 h-7 text-slate-400" />
                      )}
                      {compressingAddPhoto && (
                        <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center text-white">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-semibold text-xs cursor-pointer transition min-h-[34px]">
                          <Camera className="w-3.5 h-3.5" />
                          <span>{formPhotoUrl ? "Ganti Foto" : "Unggah Foto"}</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              handleUploadPhoto(
                                file,
                                (url, stats) => {
                                  setFormPhotoUrl(url);
                                  setAddPhotoStats(stats);
                                },
                                setCompressingAddPhoto,
                                (err) => setFormError(err)
                              );
                            }}
                          />
                        </label>
                        {formPhotoUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormPhotoUrl(null);
                              setAddPhotoStats(null);
                            }}
                            className="text-xs text-rose-600 hover:text-rose-800 font-semibold p-1"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                      {addPhotoStats && (
                        <div className="text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
                          <Sparkles className="w-3 h-3 shrink-0" />
                          <span>
                            Hemat memori: {formatFileSize(addPhotoStats.original)} → {formatFileSize(addPhotoStats.compressed)}
                          </span>
                        </div>
                      )}
                      {!addPhotoStats && (
                        <p className="text-[11px] text-slate-500">
                          Format JPG/PNG, ukuran maks. 2MB.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="student-nis" className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Nomor Induk Siswa (NIS) <span className="text-rose-600 font-bold">*</span>
                  </label>
                  <input
                    id="student-nis"
                    type="text"
                    required
                    value={formNis}
                    onChange={(e) => setFormNis(e.target.value)}
                    placeholder="Contoh: 20261010"
                    className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white min-h-[44px] shadow-2xs"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">NIS wajib unik di seluruh sekolah.</p>
                </div>

                <div>
                  <label htmlFor="student-nisn" className="block text-xs font-semibold text-slate-800 mb-1.5">
                    NISN (Opsional)
                  </label>
                  <input
                    id="student-nisn"
                    type="text"
                    value={formNisn}
                    onChange={(e) => setFormNisn(e.target.value)}
                    placeholder="Contoh: 0061234567"
                    className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white min-h-[44px] shadow-2xs"
                  />
                </div>

                <div>
                  <label htmlFor="student-name" className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Nama Lengkap Siswa <span className="text-rose-600 font-bold">*</span>
                  </label>
                  <input
                    id="student-name"
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Contoh: Muhammad Rizki"
                    className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white min-h-[44px] shadow-2xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="student-gender" className="block text-xs font-semibold text-slate-800 mb-1.5">
                      Jenis Kelamin <span className="text-rose-600 font-bold">*</span>
                    </label>
                    <select
                      id="student-gender"
                      value={formGender}
                      onChange={(e) => setFormGender(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white min-h-[44px] shadow-2xs"
                    >
                      <option value="L">Laki-laki (L)</option>
                      <option value="P">Perempuan (P)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="student-class" className="block text-xs font-semibold text-slate-800 mb-1.5">
                      Penempatan Kelas <span className="text-rose-600 font-bold">*</span>
                    </label>
                    <select
                      id="student-class"
                      value={formClassId}
                      onChange={(e) => setFormClassId(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white min-h-[44px] shadow-2xs"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          Kelas {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Data Orang Tua / Wali (Notifikasi WhatsApp) */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    <span>Data Orang Tua / Wali (Notifikasi WhatsApp)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="student-parent-name" className="block text-xs font-semibold text-slate-800 mb-1.5">
                        Nama Orang Tua / Wali
                      </label>
                      <input
                        id="student-parent-name"
                        type="text"
                        value={formParentName}
                        onChange={(e) => setFormParentName(e.target.value)}
                        placeholder="Contoh: Bapak H. Ridwan"
                        className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white min-h-[44px] shadow-2xs"
                      />
                    </div>
                    <div>
                      <label htmlFor="student-parent-phone" className="block text-xs font-semibold text-slate-800 mb-1.5">
                        Nomor WhatsApp Orang Tua
                      </label>
                      <input
                        id="student-parent-phone"
                        type="tel"
                        value={formParentPhone}
                        onChange={(e) => setFormParentPhone(e.target.value)}
                        placeholder="Contoh: 081234567890"
                        className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white min-h-[44px] shadow-2xs font-mono"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">Menerima notifikasi otomatis saat ananda presensi.</p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setModalAddOpen(false)}
                    className="px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 transition min-h-[42px]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition shadow-xs disabled:opacity-50 min-h-[42px]"
                  >
                    {saving ? "Menyimpan Data..." : "Simpan Siswa"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL EDIT SISWA & FOTO (AKSESIBEL & LENGKAP) */}
        {modalEditOpen && editingStudent && (
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
            onMouseDown={editModal.handleBackdropMouseDown}
          >
            <div
              ref={editModal.panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-edit-title"
              className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <h3 id="modal-edit-title" className="text-base font-bold text-slate-900">
                  Ubah Data & Foto Siswa
                </h3>
                <button
                  type="button"
                  onClick={() => setModalEditOpen(false)}
                  aria-label="Tutup form ubah siswa"
                  className="p-1.5 -mr-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {editError && (
                <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
                  <span className="font-medium">{editError}</span>
                </div>
              )}

              <form onSubmit={handleUpdateStudent} className="space-y-4">
                {/* Foto Profil Siswa */}
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Foto Profil Siswa
                  </label>
                  <div className="flex items-center gap-3.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="relative w-14 h-14 rounded-full overflow-hidden bg-slate-200 border-2 border-white shadow-2xs shrink-0 flex items-center justify-center">
                      {editPhotoUrl ? (
                        <img src={editPhotoUrl} alt="Foto Siswa" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-7 h-7 text-slate-400" />
                      )}
                      {compressingEditPhoto && (
                        <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center text-white">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-semibold text-xs cursor-pointer transition min-h-[34px]">
                          <Camera className="w-3.5 h-3.5" />
                          <span>{editPhotoUrl ? "Ganti Foto" : "Unggah Foto"}</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              handleUploadPhoto(
                                file,
                                (url, stats) => {
                                  setEditPhotoUrl(url);
                                  setEditPhotoStats(stats);
                                },
                                setCompressingEditPhoto,
                                (err) => setEditError(err)
                              );
                            }}
                          />
                        </label>
                        {editPhotoUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditPhotoUrl(null);
                              setEditPhotoStats(null);
                            }}
                            className="text-xs text-rose-600 hover:text-rose-800 font-semibold p-1"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                      {editPhotoStats && (
                        <div className="text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
                          <Sparkles className="w-3 h-3 shrink-0" />
                          <span>
                            Hemat memori: {formatFileSize(editPhotoStats.original)} → {formatFileSize(editPhotoStats.compressed)}
                          </span>
                        </div>
                      )}
                      {!editPhotoStats && (
                        <p className="text-[11px] text-slate-500">
                          Format JPG/PNG, ukuran maks. 2MB.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="edit-student-nis" className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Nomor Induk Siswa (NIS) <span className="text-rose-600 font-bold">*</span>
                  </label>
                  <input
                    id="edit-student-nis"
                    type="text"
                    required
                    value={editNis}
                    onChange={(e) => setEditNis(e.target.value)}
                    disabled={user.role === "GURU"}
                    className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white min-h-[44px] shadow-2xs disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                <div>
                  <label htmlFor="edit-student-nisn" className="block text-xs font-semibold text-slate-800 mb-1.5">
                    NISN (Opsional)
                  </label>
                  <input
                    id="edit-student-nisn"
                    type="text"
                    value={editNisn}
                    onChange={(e) => setEditNisn(e.target.value)}
                    disabled={user.role === "GURU"}
                    className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white min-h-[44px] shadow-2xs disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                <div>
                  <label htmlFor="edit-student-name" className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Nama Lengkap Siswa <span className="text-rose-600 font-bold">*</span>
                  </label>
                  <input
                    id="edit-student-name"
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white min-h-[44px] shadow-2xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="edit-student-gender" className="block text-xs font-semibold text-slate-800 mb-1.5">
                      Jenis Kelamin <span className="text-rose-600 font-bold">*</span>
                    </label>
                    <select
                      id="edit-student-gender"
                      value={editGender}
                      onChange={(e) => setEditGender(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white min-h-[44px] shadow-2xs"
                    >
                      <option value="L">Laki-laki (L)</option>
                      <option value="P">Perempuan (P)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="edit-student-class" className="block text-xs font-semibold text-slate-800 mb-1.5">
                      Penempatan Kelas <span className="text-rose-600 font-bold">*</span>
                    </label>
                    <select
                      id="edit-student-class"
                      value={editClassId}
                      onChange={(e) => setEditClassId(e.target.value)}
                      disabled={user.role === "GURU"}
                      className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white min-h-[44px] shadow-2xs disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          Kelas {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Data Orang Tua / Wali (Notifikasi WhatsApp) */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    <span>Data Orang Tua / Wali (Notifikasi WhatsApp)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="edit-student-parent-name" className="block text-xs font-semibold text-slate-800 mb-1.5">
                        Nama Orang Tua / Wali
                      </label>
                      <input
                        id="edit-student-parent-name"
                        type="text"
                        value={editParentName}
                        onChange={(e) => setEditParentName(e.target.value)}
                        placeholder="Contoh: Bapak H. Ridwan"
                        className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white min-h-[44px] shadow-2xs"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-student-parent-phone" className="block text-xs font-semibold text-slate-800 mb-1.5">
                        Nomor WhatsApp Orang Tua
                      </label>
                      <input
                        id="edit-student-parent-phone"
                        type="tel"
                        value={editParentPhone}
                        onChange={(e) => setEditParentPhone(e.target.value)}
                        placeholder="Contoh: 081234567890"
                        className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white min-h-[44px] shadow-2xs font-mono"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">Menerima notifikasi otomatis saat ananda presensi.</p>
                    </div>
                  </div>
                </div>

                {user.role !== "GURU" && (
                  <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editIsActive}
                        onChange={(e) => setEditIsActive(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                      />
                      <span className="text-xs font-semibold text-slate-800">
                        Siswa Aktif (Dapat Melakukan Presensi)
                      </span>
                    </label>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setModalEditOpen(false)}
                    className="px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 transition min-h-[42px]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={editSaving}
                    className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition shadow-xs disabled:opacity-50 min-h-[42px]"
                  >
                    {editSaving ? "Menyimpan Perubahan..." : "Simpan Perubahan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL PREVIEW KARTU QR CODE (AKSESIBEL) */}
        {qrModalStudent && qrDataUrl && (
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
            onMouseDown={qrModal.handleBackdropMouseDown}
          >
            <div
              ref={qrModal.panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-qr-title"
              className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full p-6 text-center space-y-4"
            >
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                <span id="modal-qr-title" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Kartu QR Siswa
                </span>
                <button
                  type="button"
                  onClick={() => setQrModalStudent(null)}
                  aria-label="Tutup pratinjau kartu QR"
                  className="p-1.5 -mr-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tampilan Kartu Fisik Identitas Siswa */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                  {schoolName || "SMP / SD Harapan Bangsa"}
                </div>
                {qrModalStudent.photoUrl && (
                  <div className="flex justify-center">
                    <img
                      src={qrModalStudent.photoUrl}
                      alt={qrModalStudent.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-xs mx-auto"
                    />
                  </div>
                )}
                <div className="bg-white p-3 rounded-xl border border-slate-200 inline-block shadow-xs">
                  <img
                    src={qrDataUrl}
                    alt={`Kode QR untuk ${qrModalStudent.name}`}
                    className="w-48 h-48 mx-auto"
                  />
                </div>
                <div className="space-y-0.5">
                  <div className="text-base font-bold text-slate-900">
                    {qrModalStudent.name}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    NIS: {qrModalStudent.nis}
                  </div>
                  <div className="text-xs font-bold text-blue-700 pt-1">
                    Kelas {qrModalStudent.class?.name}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <a
                  href={qrDataUrl}
                  download={`QR_${qrModalStudent.nis}_${qrModalStudent.name.replace(/\s+/g, "_")}.png`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition shadow-xs min-h-[42px]"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Unduh Gambar</span>
                </a>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 transition min-h-[42px] inline-flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Cetak</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <CsvImportModal
          isOpen={modalImportOpen}
          onClose={() => setModalImportOpen(false)}
          type="students"
          onSuccess={fetchSessionAndData}
        />
      </div>
    </AppShell>
  );
}
