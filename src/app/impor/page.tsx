"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  FileSpreadsheet,
  Users,
  GraduationCap,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  School,
} from "lucide-react";
import CsvImportModal from "@/components/CsvImportModal";

export default function ImporPage() {
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<{
    studentsCount: number;
    teachersCount: number;
    classesCount: number;
    activeTermName: string;
  }>({
    studentsCount: 0,
    teachersCount: 0,
    classesCount: 0,
    activeTermName: "Memuat...",
  });
  const [loading, setLoading] = useState(true);

  // Modal State
  const [importType, setImportType] = useState<"students" | "teachers" | null>(null);

  const fetchOverviewData = async () => {
    try {
      setLoading(true);
      const [resMe, resStudents, resTeachers, resClasses, resTerms] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/students?perPage=2000"),
        fetch("/api/teachers?perPage=2000"),
        fetch("/api/classes"),
        fetch("/api/academic-terms"),
      ]);

      const [dataMe, dataStudents, dataTeachers, dataClasses, dataTerms] = await Promise.all([
        resMe.json(),
        resStudents.json(),
        resTeachers.json(),
        resClasses.json(),
        resTerms.json(),
      ]);

      if (dataMe.success) setUser(dataMe.user);

      const activeTerm = dataTerms.academicTerms?.find((t: any) => t.isActive);

      setStats({
        studentsCount: dataStudents.students?.length || 0,
        teachersCount: dataTeachers.teachers?.length || 0,
        classesCount: dataClasses.classes?.length || 0,
        activeTermName: activeTerm ? activeTerm.name : "Tidak ada semester aktif",
      });
    } catch (e) {
      console.error("Fetch Overview Error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-xs text-slate-500">
        Memuat pusat impor data...
      </div>
    );
  }

  return (
    <AppShell user={user}>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              Pusat Impor Data CSV
            </h1>
            <p className="text-xs text-slate-500 mt-1.5">
              Unggah data siswa dan tenaga pendidik secara massal menggunakan file spreadsheet (CSV) tanpa input manual satu per satu.
            </p>
          </div>
        </div>

        {/* Ringkasan Master Data */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Total Siswa Terdaftar</p>
              <p className="text-lg font-bold text-slate-900">{stats.studentsCount}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Total Guru Terdaftar</p>
              <p className="text-lg font-bold text-slate-900">{stats.teachersCount}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <School className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Total Kelas Aktif</p>
              <p className="text-lg font-bold text-slate-900">{stats.classesCount}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Semester Aktif</p>
              <p className="text-xs font-bold text-emerald-700 truncate max-w-[130px]">
                {stats.activeTermName}
              </p>
            </div>
          </div>
        </div>

        {/* 2 Kartu Aksi Impor Utama */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Kartu Impor Siswa */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between hover:border-blue-400 transition-colors">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                  Data Siswa
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">Impor Massal Siswa</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Unggah file CSV berisi daftar siswa baru atau pindahan. Sistem akan otomatis memvalidasi NIS, memetakan kelas, membuatkan token QR Code unik, dan mendaftarkannya pada semester aktif.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
                <p className="font-semibold text-slate-800">Struktur Kolom CSV:</p>
                <p className="font-mono text-[11px] text-slate-600">
                  nis, nisn, nama, jenis_kelamin, kelas
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-3">
              <a
                href="/api/templates/csv?type=students"
                download
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs transition"
              >
                <Download className="w-3.5 h-3.5" /> Template CSV
              </a>

              <button
                onClick={() => setImportType("students")}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition"
              >
                <UploadCloud className="w-4 h-4" /> Mulai Impor Siswa
              </button>
            </div>
          </div>

          {/* Kartu Impor Guru */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between hover:border-indigo-400 transition-colors">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                  Data Guru
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">Impor Massal Guru</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Unggah daftar dewan guru dan tenaga kependidikan. Anda dapat memilih untuk membuat akun login guru secara otomatis menggunakan email dan password default.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
                <p className="font-semibold text-slate-800">Struktur Kolom CSV:</p>
                <p className="font-mono text-[11px] text-slate-600">
                  nip, nama, jenis_kelamin, telepon, email, buat_akun
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-3">
              <a
                href="/api/templates/csv?type=teachers"
                download
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs transition"
              >
                <Download className="w-3.5 h-3.5" /> Template CSV
              </a>

              <button
                onClick={() => setImportType("teachers")}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition"
              >
                <UploadCloud className="w-4 h-4" /> Mulai Impor Guru
              </button>
            </div>
          </div>
        </div>

        {/* Panduan Format & FAQ */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600" /> Panduan & Ketentuan Impor CSV
          </h2>

          <div className="grid md:grid-cols-2 gap-4 text-xs text-slate-600">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Ketentuan Data Siswa
              </h3>
              <ul className="list-disc list-inside space-y-1 pl-1">
                <li><strong>NIS:</strong> Wajib diisi dan harus unik. Tidak boleh ada siswa dengan NIS sama.</li>
                <li><strong>Nama:</strong> Wajib diisi dengan nama lengkap siswa.</li>
                <li><strong>Jenis Kelamin:</strong> Gunakan simbol <code>L</code> (Laki-laki) atau <code>P</code> (Perempuan).</li>
                <li><strong>Kelas:</strong> Harus sesuai dengan nama kelas yang sudah terdaftar di menu Master Data Kelas (contoh: <code>Kelas 7A</code> atau <code>7A</code>).</li>
                <li><strong>QR Code:</strong> Dibuat otomatis saat impor selesai tanpa perlu diisi.</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Ketentuan Data Guru
              </h3>
              <ul className="list-disc list-inside space-y-1 pl-1">
                <li><strong>NIP:</strong> Boleh dikosongkan jika guru non-PNS/honorer. Jika diisi, harus unik.</li>
                <li><strong>Nama & Jenis Kelamin:</strong> Wajib diisi sesuai identitas guru.</li>
                <li><strong>Buat Akun:</strong> Isi dengan <code>ya</code> jika ingin langsung dibuatkan akun login aplikasi.</li>
                <li><strong>Email:</strong> Wajib diisi jika <code>buat_akun</code> diset ke <code>ya</code>, karena email digunakan untuk username login.</li>
                <li><strong>Password Default:</strong> Secara default diset ke <code>guru123</code> dan dapat diubah nanti.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Modal Impor */}
        {importType && (
          <CsvImportModal
            isOpen={true}
            onClose={() => setImportType(null)}
            type={importType}
            onSuccess={fetchOverviewData}
          />
        )}
      </div>
    </AppShell>
  );
}
