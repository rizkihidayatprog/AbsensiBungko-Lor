"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  History,
  Search,
  Filter,
  Eye,
  Calendar,
  User,
  Shield,
  ArrowRight,
  Clock,
  X,
  FileCode,
  RefreshCw,
  CheckCircle2,
  XCircle,
  HeartPulse,
  FileText,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
  AlertCircle,
  Info,
  Tag,
} from "lucide-react";
import { useModalA11y } from "@/lib/useModalA11y";

const ACTION_MAP: Record<string, { label: string; desc: string }> = {
  UPDATE_ATTENDANCE: {
    label: "Koreksi Presensi",
    desc: "Perubahan status atau catatan kehadiran oleh petugas/guru",
  },
  SCAN_CHECK_IN: {
    label: "Presensi Masuk (Scan QR)",
    desc: "Pencatatan kehadiran masuk siswa/guru via pemindai kamera",
  },
  SCAN_CHECK_OUT: {
    label: "Presensi Pulang (Scan QR)",
    desc: "Pencatatan kehadiran pulang siswa/guru via pemindai kamera",
  },
  CREATE_STUDENT: {
    label: "Pendaftaran Siswa Baru",
    desc: "Penambahan data siswa ke dalam database sekolah",
  },
  UPDATE_STUDENT: {
    label: "Pembaruan Data Siswa",
    desc: "Perubahan informasi data pribadi atau kelas siswa",
  },
  DELETE_STUDENT: {
    label: "Penghapusan Data Siswa",
    desc: "Penghapusan siswa dari sistem",
  },
  IMPORT_STUDENTS: {
    label: "Impor Data Siswa (CSV)",
    desc: "Unggah massal data siswa dari berkas CSV/Excel",
  },
  CREATE_TEACHER: {
    label: "Pendaftaran Guru Baru",
    desc: "Penambahan identitas dan akun guru baru",
  },
  UPDATE_TEACHER: {
    label: "Pembaruan Data Guru",
    desc: "Perubahan data profil atau penugasan guru",
  },
  DELETE_TEACHER: {
    label: "Penghapusan Data Guru",
    desc: "Penghapusan data guru dari sistem",
  },
  IMPORT_TEACHERS: {
    label: "Impor Data Guru (CSV)",
    desc: "Unggah massal data guru dari berkas CSV/Excel",
  },
  CREATE_USER: {
    label: "Pembuatan Akun Pengguna",
    desc: "Pembuatan akun login baru untuk staf TU atau pimpinan",
  },
  UPDATE_USER: {
    label: "Pembaruan Akun Pengguna",
    desc: "Perubahan hak akses, password, atau keaktifan akun",
  },
  UPDATE_SCHOOL_SETTINGS: {
    label: "Pembaruan Pengaturan Sekolah",
    desc: "Perubahan jam masuk, toleransi keterlambatan, atau notifikasi WA",
  },
  PROMOTE_STUDENTS: {
    label: "Kenaikan / Kelulusan Kelas",
    desc: "Pemindahan kelas massal atau penetapan kelulusan",
  },
  LOGIN: {
    label: "Login Akun",
    desc: "Pengguna berhasil masuk ke dalam sistem",
  },
  LOGOUT: {
    label: "Logout Akun",
    desc: "Pengguna keluar dari sesi aplikasi",
  },
  CREATE_LEAVE_REQUEST: {
    label: "Pengajuan Izin Siswa",
    desc: "Permohonan surat izin atau sakit oleh siswa/wali",
  },
  APPROVE_LEAVE: {
    label: "Persetujuan Izin",
    desc: "Permohonan izin disetujui oleh wali kelas/staf",
  },
  REJECT_LEAVE: {
    label: "Penolakan Izin",
    desc: "Permohonan izin ditolak oleh wali kelas/staf",
  },
  CREATE_OR_UPDATE_ACADEMIC_TERM: {
    label: "Buka / Update Semester",
    desc: "Pembuatan atau pembaruan periode semester dan tahun ajaran",
  },
  ACTIVATE_ACADEMIC_TERM: {
    label: "Aktivasi Semester",
    desc: "Penetapan semester sebagai periode aktif presensi sekolah",
  },
  DELETE_ACADEMIC_YEAR: {
    label: "Penghapusan Tahun Ajaran",
    desc: "Penghapusan periode tahun ajaran dari sistem",
  },
  DELETE_ACADEMIC_TERM: {
    label: "Penghapusan Semester",
    desc: "Penghapusan periode semester dari sistem",
  },
};

const ENTITY_MAP: Record<string, string> = {
  StudentAttendance: "Presensi Siswa",
  TeacherAttendance: "Presensi Guru",
  Student: "Data Siswa",
  Teacher: "Data Guru",
  Class: "Data Kelas",
  User: "Akun Pengguna",
  SchoolSetting: "Pengaturan Sekolah",
  Holiday: "Kalender Libur",
  AcademicYear: "Tahun Ajaran",
  AcademicTerm: "Semester / Periode",
  LeaveRequest: "Pengajuan Izin",
};

const FIELD_LABELS: Record<string, string> = {
  status: "Status Presensi",
  notes: "Catatan Presensi",
  correctedBy: "Petugas yang Mengoreksi",
  correctionReason: "Alasan Koreksi",
  checkInTime: "Waktu Presensi Masuk",
  checkOutTime: "Waktu Presensi Pulang",
  lateMinutes: "Keterlambatan (Menit)",
  method: "Metode Presensi",
  name: "Nama Lengkap",
  nis: "Nomor Induk Siswa (NIS)",
  nisn: "NISN",
  gender: "Jenis Kelamin",
  classId: "Penempatan Kelas",
  className: "Nama Kelas",
  parentName: "Nama Orang Tua / Wali",
  parentPhone: "Nomor WhatsApp Orang Tua",
  photoUrl: "Tautan Foto Profil",
  isActive: "Status Keaktifan",
  nip: "Nomor Induk Pegawai (NIP)",
  phone: "Nomor Telepon",
  email: "Alamat Email",
  username: "Nama Pengguna (Username)",
  role: "Hak Akses / Peran",
  schoolName: "Nama Sekolah",
  schoolAddress: "Alamat Sekolah",
  schoolPhone: "Telepon Sekolah",
  schoolEmail: "Email Sekolah",
  checkInStart: "Jam Buka Presensi Masuk",
  checkInEnd: "Batas Jam Masuk",
  checkOutStart: "Jam Buka Presensi Pulang",
  checkOutEnd: "Batas Jam Pulang",
  lateToleranceMinutes: "Toleransi Terlambat (Menit)",
  checkOutEnabled: "Fitur Presensi Pulang",
  activeDays: "Hari Belajar Aktif",
  waEnabled: "Notifikasi WhatsApp Aktif",
  waNotifyHadir: "Kirim Notif WA Hadir",
  waNotifyTerlambat: "Kirim Notif WA Terlambat",
  waNotifyIzin: "Kirim Notif WA Izin/Sakit",
  waNotifyAlfa: "Kirim Notif WA Alfa",
  waTemplateHadir: "Format Pesan WA Hadir",
  waTemplateTerlambat: "Format Pesan WA Terlambat",
  waTemplateIzin: "Format Pesan WA Izin",
  waTemplateAlfa: "Format Pesan WA Alfa",
  date: "Tanggal",
  description: "Keterangan",
  academicYear: "Tahun Ajaran",
  semester: "Semester",
  startDate: "Tanggal Mulai",
  endDate: "Tanggal Berakhir",
};

function parseJsonSafe(val: string | null | undefined): Record<string, any> | null {
  if (!val) return null;
  try {
    const parsed = JSON.parse(val);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

interface DiffRow {
  key: string;
  label: string;
  oldVal: any;
  newVal: any;
  type: "MODIFIED" | "ADDED" | "REMOVED" | "UNCHANGED";
}

function computeDiff(oldObj: Record<string, any> | null, newObj: Record<string, any> | null): DiffRow[] {
  const oldK = oldObj ? Object.keys(oldObj) : [];
  const newK = newObj ? Object.keys(newObj) : [];
  const allKeys = Array.from(new Set([...oldK, ...newK]));

  return allKeys.map((key) => {
    const hasOld = oldObj !== null && key in oldObj && oldObj[key] !== null && oldObj[key] !== undefined && oldObj[key] !== "";
    const hasNew = newObj !== null && key in newObj && newObj[key] !== null && newObj[key] !== undefined && newObj[key] !== "";
    const oldVal = oldObj ? oldObj[key] : undefined;
    const newVal = newObj ? newObj[key] : undefined;

    let type: DiffRow["type"] = "UNCHANGED";
    if (hasOld && !hasNew) {
      type = "REMOVED";
    } else if (!hasOld && hasNew) {
      type = "ADDED";
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      type = "MODIFIED";
    }

    const label = FIELD_LABELS[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();

    return {
      key,
      label,
      oldVal,
      newVal,
      type,
    };
  });
}

function renderFriendlyValue(key: string, val: any) {
  if (val === null || val === undefined || val === "") {
    return <span className="text-slate-400 italic text-xs font-normal">(Kosong / Tidak Ada)</span>;
  }

  if (typeof val === "boolean") {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
          val ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600 border border-slate-200"
        }`}
      >
        {val ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-slate-400" />}
        {val ? "Aktif / Ya" : "Nonaktif / Tidak"}
      </span>
    );
  }

  if (key === "status" || key.toLowerCase().includes("status")) {
    const s = String(val).toUpperCase();
    if (s === "HADIR") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          HADIR
        </span>
      );
    }
    if (s === "TERLAMBAT") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs">
          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          TERLAMBAT
        </span>
      );
    }
    if (s === "IZIN") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200 shadow-2xs">
          <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          IZIN
        </span>
      );
    }
    if (s === "SAKIT") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 shadow-2xs">
          <HeartPulse className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          SAKIT
        </span>
      );
    }
    if (s === "ALFA") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
          <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          ALFA
        </span>
      );
    }
  }

  if (key === "gender") {
    if (val === "L") return <span className="font-semibold text-slate-800">Laki-laki (L)</span>;
    if (val === "P") return <span className="font-semibold text-slate-800">Perempuan (P)</span>;
  }

  if (key === "role") {
    if (val === "SUPERADMIN") return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">Super Admin</span>;
    if (val === "ADMIN") return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">Staf Tata Usaha</span>;
    if (val === "GURU") return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Guru / Wali Kelas</span>;
  }

  if (typeof val === "object") {
    return <code className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-700">{JSON.stringify(val)}</code>;
  }

  return <span className="font-semibold text-slate-900 break-words">{String(val)}</span>;
}

export default function AuditLogPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [selectedEntity, setSelectedEntity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modal Detail Nilai
  const [detailLog, setDetailLog] = useState<any | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const handleCloseDetail = useCallback(() => {
    setDetailLog(null);
    setShowRawJson(false);
  }, []);

  const detailModal = useModalA11y<HTMLDivElement>(Boolean(detailLog), handleCloseDetail);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (selectedAction) params.append("action", selectedAction);
      if (selectedEntity) params.append("entityType", selectedEntity);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("page", page.toString());
      params.append("limit", "25");

      const [resMe, resLogs] = await Promise.all([
        fetch("/api/auth/me"),
        fetch(`/api/audit-logs?${params.toString()}`),
      ]);

      const [dataMe, dataLogs] = await Promise.all([
        resMe.json(),
        resLogs.json(),
      ]);

      if (dataMe.success) setCurrentUser(dataMe.user);
      if (dataLogs.success) {
        setLogs(dataLogs.auditLogs || []);
        setTotal(dataLogs.total || 0);
        setTotalPages(dataLogs.totalPages || 1);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, selectedAction, selectedEntity, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const getActionBadge = (action: string) => {
    if (action.includes("CREATE") || action.includes("IMPORT") || action.includes("PROMOTE")) {
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    }
    if (action.includes("UPDATE") || action.includes("CORRECTION") || action.includes("ACTIVATE")) {
      return "bg-blue-100 text-blue-800 border-blue-200";
    }
    if (action.includes("DELETE") || action.includes("DEACTIVATE") || action.includes("REJECT")) {
      return "bg-rose-100 text-rose-800 border-rose-200";
    }
    if (action.includes("LOGIN") || action.includes("LOGOUT")) {
      return "bg-purple-100 text-purple-800 border-purple-200";
    }
    return "bg-slate-100 text-slate-800 border-slate-200";
  };

  const formatJson = (val: string | null) => {
    if (!val) return "Tidak ada data";
    try {
      const parsed = JSON.parse(val);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return val;
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-xs text-slate-500">
        Memuat log audit...
      </div>
    );
  }

  return (
    <AppShell user={currentUser}>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <History className="w-5 h-5" />
              </div>
              Audit Trail & Log Aktivitas Sistem
            </h1>
            <p className="text-xs text-slate-500 mt-1.5">
              Pencatatan riwayat setiap aksi administratif, koreksi presensi, perubahan master data, dan otentikasi demi transparansi dan integritas data.
            </p>
          </div>

          <button
            onClick={fetchLogs}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Segarkan Log
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari aksi, nama petugas, atau entitas..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
            >
              Cari
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none bg-white"
            >
              <option value="">Semua Jenis Aksi</option>
              <option value="LOGIN">LOGIN</option>
              <option value="LOGOUT">LOGOUT</option>
              <option value="SCAN_CHECK_IN">SCAN_CHECK_IN</option>
              <option value="SCAN_CHECK_OUT">SCAN_CHECK_OUT</option>
              <option value="UPDATE_ATTENDANCE">UPDATE_ATTENDANCE (Koreksi)</option>
              <option value="CREATE_STUDENT">CREATE_STUDENT</option>
              <option value="IMPORT_STUDENTS">IMPORT_STUDENTS</option>
              <option value="CREATE_TEACHER">CREATE_TEACHER</option>
              <option value="IMPORT_TEACHERS">IMPORT_TEACHERS</option>
              <option value="PROMOTE_STUDENTS">PROMOTE_STUDENTS (Kenaikan)</option>
              <option value="CREATE_USER">CREATE_USER</option>
              <option value="UPDATE_USER">UPDATE_USER</option>
              <option value="UPDATE_SCHOOL_SETTINGS">UPDATE_SCHOOL_SETTINGS</option>
            </select>

            <select
              value={selectedEntity}
              onChange={(e) => {
                setSelectedEntity(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none bg-white"
            >
              <option value="">Semua Entitas</option>
              <option value="Student">Student</option>
              <option value="Teacher">Teacher</option>
              <option value="Class">Class</option>
              <option value="StudentAttendance">StudentAttendance</option>
              <option value="User">User</option>
              <option value="AcademicTerm">AcademicTerm</option>
              <option value="SchoolSetting">SchoolSetting</option>
              <option value="Holiday">Holiday</option>
            </select>

            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              placeholder="Dari Tanggal"
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none bg-white"
            />

            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              placeholder="Sampai Tanggal"
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none bg-white"
            />
          </div>
        </div>

        {/* Tabel Log Audit */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="hidden xl:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 w-40">Waktu</th>
                  <th className="px-4 py-3 w-48">Pelaku (Petugas)</th>
                  <th className="px-4 py-3 w-44">Jenis Aksi</th>
                  <th className="px-4 py-3">Entitas Terkait</th>
                  <th className="px-4 py-3 text-center w-28">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      Tidak ada catatan aktivitas yang cocok dengan kriteria pencarian.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                        {new Date(log.createdAt).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        {new Date(log.createdAt).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        {log.actor ? (
                          <div>
                            <p className="font-semibold text-slate-900">{log.actor.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{log.actor.role}</p>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Sistem / Anonim</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 text-[11px] font-bold rounded-md border ${getActionBadge(
                            log.action
                          )}`}
                        >
                          {ACTION_MAP[log.action]?.label || log.action}
                        </span>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{log.action}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <span className="font-semibold text-slate-900">
                          {ENTITY_MAP[log.entityType] || log.entityType}
                        </span>
                        {log.entityId && (
                          <span className="text-slate-400 font-mono text-[10px] ml-1.5 bg-slate-100 px-1.5 py-0.5 rounded">
                            #{log.entityId.slice(0, 10)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setDetailLog(log)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" /> Lihat Rincian
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Kartu mobile: semua informasi tampil tanpa geser horizontal */}
          <div className="xl:hidden divide-y divide-slate-100">
            {logs.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-400 text-xs">
                Tidak ada catatan aktivitas yang cocok dengan kriteria pencarian.
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {log.actor ? (
                        <div>
                          <div className="font-semibold text-slate-900">{log.actor.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{log.actor.role}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-xs">Sistem / Anonim</span>
                      )}
                    </div>
                    <span
                      className={`inline-block px-2.5 py-0.5 text-[11px] font-bold rounded-md border shrink-0 ${getActionBadge(
                        log.action
                      )}`}
                    >
                      {ACTION_MAP[log.action]?.label || log.action}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Waktu</div>
                      <div className="text-slate-600 font-mono text-[11px]">
                        {new Date(log.createdAt).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        {new Date(log.createdAt).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Jenis Aksi</div>
                      <div className="text-slate-700">
                        <span className="font-medium">{ACTION_MAP[log.action]?.label || log.action}</span>
                        <span className="text-[10px] text-slate-400 font-mono ml-1.5">{log.action}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Entitas Terkait</div>
                      <div className="text-slate-700">
                        <span className="font-semibold text-slate-900">
                          {ENTITY_MAP[log.entityType] || log.entityType}
                        </span>
                        {log.entityId && (
                          <span className="text-slate-400 font-mono text-[10px] ml-1.5 bg-slate-100 px-1.5 py-0.5 rounded inline-block">
                            #{log.entityId.slice(0, 10)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setDetailLog(log)}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition shadow-2xs min-h-[40px]"
                  >
                    <Eye className="w-3.5 h-3.5" /> Lihat Rincian
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
            <span>
              Menampilkan {logs.length} dari total <strong>{total}</strong> log aktivitas
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 border border-slate-300 bg-white rounded-lg disabled:opacity-50 hover:bg-slate-100 transition"
              >
                Sebelumnya
              </button>
              <span className="font-semibold text-slate-800">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 border border-slate-300 bg-white rounded-lg disabled:opacity-50 hover:bg-slate-100 transition"
              >
                Berikutnya
              </button>
            </div>
          </div>
        </div>

        {/* Modal Detail Nilai Lama & Baru (Format Ramah & Mudah Dibaca) */}
        {detailLog && (() => {
          const oldObj = parseJsonSafe(detailLog.oldValues);
          const newObj = parseJsonSafe(detailLog.newValues);
          const diffRows = computeDiff(oldObj, newObj);
          const actionMeta = ACTION_MAP[detailLog.action];
          const entityLabel = ENTITY_MAP[detailLog.entityType] || detailLog.entityType;
          const isAttendanceCorrection =
            detailLog.action === "UPDATE_ATTENDANCE" && detailLog.entityType.includes("Attendance");
          const changedCount = diffRows.filter((r) => r.type !== "UNCHANGED").length;

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
              onMouseDown={detailModal.handleBackdropMouseDown}
            >
              <div
                ref={detailModal.panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="audit-detail-title"
                className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 border border-slate-200"
              >
                {/* Header Modal */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/80">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${getActionBadge(
                          detailLog.action
                        )}`}
                      >
                        {actionMeta?.label || detailLog.action}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">({detailLog.action})</span>
                    </div>
                    <h3 id="audit-detail-title" className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <span>Rincian Aktivitas: {entityLabel}</span>
                      {detailLog.entityId && (
                        <span className="text-xs text-slate-400 font-mono font-normal">
                          #{detailLog.entityId}
                        </span>
                      )}
                    </h3>
                  </div>
                  <button
                    onClick={handleCloseDetail}
                    aria-label="Tutup detail audit"
                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition -mr-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Konten Utama */}
                <div className="p-6 flex-1 overflow-y-auto space-y-5 text-xs">
                  {/* Metadata Petugas & Waktu */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          Petugas / Pelaku
                        </div>
                        <div className="font-bold text-slate-900 mt-0.5">
                          {detailLog.actor?.name || "Sistem / Otomatis"}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {detailLog.actor?.role || "SYSTEM"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          Waktu Eksekusi
                        </div>
                        <div className="font-bold text-slate-900 mt-0.5">
                          {new Date(detailLog.createdAt).toLocaleDateString("id-ID", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {new Date(detailLog.createdAt).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}{" "}
                          WIB
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg shrink-0">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          Alamat Jaringan
                        </div>
                        <div className="font-bold text-slate-900 font-mono text-[11px] mt-0.5">
                          {detailLog.ipAddress || "127.0.0.1 (Local)"}
                        </div>
                        <div
                          className="text-[10px] text-slate-400 truncate max-w-[150px]"
                          title={detailLog.userAgent || "-"}
                        >
                          {detailLog.userAgent ? detailLog.userAgent.split(" ")[0] : "Browser"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Banner Khusus Koreksi Presensi (Sangat Mudah Dibaca) */}
                  {isAttendanceCorrection && (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/90 flex items-start gap-3 shadow-2xs">
                      <div className="p-2 bg-blue-600 text-white rounded-xl shrink-0 shadow-xs">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="space-y-1.5 flex-1 text-xs">
                        <div className="font-bold text-blue-950 flex items-center gap-1.5">
                          <span>Ringkasan Koreksi Kehadiran Siswa</span>
                        </div>
                        <div className="text-slate-800 flex flex-wrap items-center gap-2 pt-0.5">
                          <span className="text-slate-600">Status Kehadiran diubah dari:</span>
                          <span className="font-bold">{renderFriendlyValue("status", oldObj?.status)}</span>
                          <ArrowRight className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="text-slate-600">Menjadi:</span>
                          <span className="font-bold">{renderFriendlyValue("status", newObj?.status)}</span>
                        </div>
                        {(newObj?.correctionReason || newObj?.correctedBy || newObj?.notes) && (
                          <div className="text-[11px] text-slate-600 pt-1.5 border-t border-blue-200/60 flex flex-wrap gap-x-4 gap-y-1 mt-1">
                            {newObj?.correctionReason && (
                              <span>
                                Alasan Koreksi:{" "}
                                <strong className="text-blue-900 font-semibold">
                                  "{newObj.correctionReason}"
                                </strong>
                              </span>
                            )}
                            {newObj?.correctedBy && (
                              <span>
                                Petugas:{" "}
                                <strong className="text-blue-900 font-semibold">{newObj.correctedBy}</strong>
                              </span>
                            )}
                            {newObj?.notes && (
                              <span>
                                Catatan:{" "}
                                <strong className="text-blue-900 font-semibold">{newObj.notes}</strong>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tabel Perbandingan Lengkap Nilai Sebelum vs Sesudah */}
                  {diffRows.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-blue-600" />
                          Tabel Perbandingan Nilai Sebelum vs Sesudah Perubahan
                        </span>
                        <span className="text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                          {changedCount} informasi diperbarui
                        </span>
                      </div>
                      <div className="hidden xl:block overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100/75 text-slate-600 border-b border-slate-200 font-semibold">
                            <tr>
                              <th className="px-4 py-2.5 w-1/4">Nama Informasi / Kolom</th>
                              <th className="px-4 py-2.5 w-1/3">Nilai Sebelumnya (Sebelum Perubahan)</th>
                              <th className="px-4 py-2.5 w-1/3 text-emerald-800">
                                Nilai Baru (Setelah Perubahan)
                              </th>
                              <th className="px-3 py-2.5 w-24 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {diffRows.map((row) => (
                              <tr
                                key={row.key}
                                className={
                                  row.type !== "UNCHANGED"
                                    ? "bg-amber-50/40 hover:bg-amber-50/70 transition-colors"
                                    : "hover:bg-slate-50/50 transition-colors"
                                }
                              >
                                <td className="px-4 py-3 align-top">
                                  <div className="font-bold text-slate-900">{row.label}</div>
                                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{row.key}</div>
                                </td>
                                <td className="px-4 py-3 align-top bg-slate-50/40">
                                  {renderFriendlyValue(row.key, row.oldVal)}
                                </td>
                                <td className="px-4 py-3 align-top bg-emerald-50/20">
                                  {renderFriendlyValue(row.key, row.newVal)}
                                </td>
                                <td className="px-3 py-3 align-top text-center">
                                  {row.type === "MODIFIED" && (
                                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                      Diubah
                                    </span>
                                  )}
                                  {row.type === "ADDED" && (
                                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      Ditambah
                                    </span>
                                  )}
                                  {row.type === "REMOVED" && (
                                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                      Dihapus
                                    </span>
                                  )}
                                  {row.type === "UNCHANGED" && (
                                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                                      Tetap
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Kartu mobile: perbandingan nilai tanpa geser */}
                      <div className="xl:hidden divide-y divide-slate-100">
                        {diffRows.map((row) => (
                          <div
                            key={row.key}
                            className={`p-4 space-y-2 ${
                              row.type !== "UNCHANGED" ? "bg-amber-50/40" : ""
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 text-xs">{row.label}</div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{row.key}</div>
                              </div>
                              {row.type === "MODIFIED" && (
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                                  Diubah
                                </span>
                              )}
                              {row.type === "ADDED" && (
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                                  Ditambah
                                </span>
                              )}
                              {row.type === "REMOVED" && (
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                                  Dihapus
                                </span>
                              )}
                              {row.type === "UNCHANGED" && (
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 shrink-0">
                                  Tetap
                                </span>
                              )}
                            </div>
                            <div className="space-y-1.5 text-xs">
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Sebelum</div>
                                <div className="bg-slate-50/60 rounded-lg px-2.5 py-1.5">
                                  {renderFriendlyValue(row.key, row.oldVal)}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Sesudah</div>
                                <div className="bg-emerald-50/40 rounded-lg px-2.5 py-1.5">
                                  {renderFriendlyValue(row.key, row.newVal)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500">
                      <Info className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                      <p className="font-semibold text-xs text-slate-700">
                        Aktivitas Sesi / Tanpa Perubahan Kolom
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Aksi ini dicatat sebagai aktivitas autentikasi atau pencatatan tanpa modifikasi data
                        kolom entitas.
                      </p>
                    </div>
                  )}

                  {/* Accordion Format JSON Teknis (Bagi Developer / Audit Teknis) */}
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowRawJson(!showRawJson)}
                      className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 p-2 rounded-xl hover:bg-slate-100 transition w-full justify-between"
                    >
                      <span className="flex items-center gap-1.5">
                        <FileCode className="w-4 h-4 text-slate-400" />
                        <span>Tampilkan Format Mentah (JSON Teknis)</span>
                      </span>
                      {showRawJson ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {showRawJson && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 animate-in fade-in duration-150">
                        <div>
                          <span className="block font-semibold text-slate-700 mb-1.5 text-[11px]">
                            Nilai Sebelumnya (Sebelum Perubahan):
                          </span>
                          <pre className="p-3.5 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48 border border-slate-800">
                            {formatJson(detailLog.oldValues)}
                          </pre>
                        </div>
                        <div>
                          <span className="block font-semibold text-slate-700 mb-1.5 text-[11px]">
                            Nilai Baru (Setelah Perubahan):
                          </span>
                          <pre className="p-3.5 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48 border border-slate-800">
                            {formatJson(detailLog.newValues)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Modal */}
                <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 flex justify-end">
                  <button
                    onClick={handleCloseDetail}
                    className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition shadow-2xs"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </AppShell>
  );
}
