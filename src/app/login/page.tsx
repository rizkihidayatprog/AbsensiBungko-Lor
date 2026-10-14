"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  UserCheck,
  Search,
  FileText,
  Eye,
  EyeOff,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Gagal masuk. Periksa kembali email dan password.");
        setLoading(false);
        return;
      }

      // Navigasi langsung penuh agar Safari & semua browser mengcommit cookie sesi seketika
      window.location.href = callbackUrl;
    } catch {
      setError("Terjadi kesalahan jaringan. Silakan periksa koneksi internet Anda.");
      setLoading(false);
    }
  };

  const handleQuickLogin = (email: string, pass: string) => {
    setIdentifier(email);
    setPassword(pass);
    setError(null);
  };

  return (
    <div className="bg-white py-8 px-6 sm:px-10 shadow-sm border border-slate-200/90 rounded-2xl">
      {/* Banner Pesan Galat */}
      {error && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-900"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs sm:text-sm font-medium leading-relaxed">
            <span className="font-semibold block text-rose-950">Gagal Masuk</span>
            {error}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate={false}>
        {/* Input Identifier */}
        <div>
          <label
            htmlFor="identifier"
            className="block text-xs sm:text-sm font-semibold text-slate-800 mb-1.5"
          >
            Email atau Username <span className="text-rose-600 font-bold">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
            <input
              id="identifier"
              type="text"
              required
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="nama@sekolah.sch.id atau username"
              className="block w-full pl-10 pr-3.5 py-2.5 min-h-[44px] border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white transition shadow-2xs"
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-600">
            Gunakan alamat email atau username akun yang terdaftar.
          </p>
        </div>

        {/* Input Password dengan toggle show/hide */}
        <div>
          <label
            htmlFor="password"
            className="block text-xs sm:text-sm font-semibold text-slate-800 mb-1.5"
          >
            Password <span className="text-rose-600 font-bold">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="block w-full pl-10 pr-11 py-2.5 min-h-[44px] border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white transition shadow-2xs"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-800 focus:outline-none"
            >
              {showPassword ? (
                <EyeOff className="h-4.5 w-4.5" aria-hidden="true" />
              ) : (
                <Eye className="h-4.5 w-4.5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Tombol Masuk */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center gap-2 py-2.5 px-4 min-h-[46px] border border-transparent rounded-xl shadow-xs text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600 disabled:opacity-50 transition"
        >
          {loading ? "Sedang Memverifikasi..." : "Masuk ke Sistem"}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </form>

      {/* Akun Demo Pengujian Cepat */}
      <div className="mt-6 pt-5 border-t border-slate-200">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
          Pilih Akun Demo Cepat:
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleQuickLogin("superadmin@sekolah.sch.id", "admin123")}
            className="px-2 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 transition text-center focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            Superadmin
          </button>
          <button
            type="button"
            onClick={() => handleQuickLogin("admin@sekolah.sch.id", "admin123")}
            className="px-2 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 transition text-center focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            Admin TU
          </button>
          <button
            type="button"
            onClick={() => handleQuickLogin("budi@sekolah.sch.id", "guru123")}
            className="px-2 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 transition text-center focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            Guru Piket
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-md mb-3.5 ring-1 ring-slate-200">
          <img
            src="/logo-tut-wuri-handayani.png"
            alt="Logo Tut Wuri Handayani"
            className="w-12 h-12 object-contain"
          />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Sistem Absensi Sekolah
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-600">
          Masuk ke portal administrasi presensi digital berbasis QR Code
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Suspense
          fallback={
            <div className="bg-white py-12 px-6 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
              Memuat form login...
            </div>
          }
        >
          <LoginForm />
        </Suspense>

        {/* Portal Mandiri Siswa & Orang Tua */}
        <div className="mt-6 p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs text-center space-y-2">
          <p className="text-xs font-semibold text-slate-700">
            Siswa atau Orang Tua / Wali Murid?
          </p>
          <div className="flex flex-wrap justify-center items-center gap-3 text-xs text-slate-600">
            <Link
              href="/cek-kehadiran"
              className="inline-flex items-center gap-1.5 font-semibold text-blue-600 hover:text-blue-800 hover:underline transition"
            >
              <Search className="w-3.5 h-3.5" aria-hidden="true" />
              Cek Kehadiran Mandiri
            </Link>
            <span className="text-slate-300">•</span>
            <Link
              href="/izin"
              className="inline-flex items-center gap-1.5 font-semibold text-blue-600 hover:text-blue-800 hover:underline transition"
            >
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              Pengajuan Izin / Sakit
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
