"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Catat detail error agar mudah ditelusuri di log server.
    console.error("Terjadi kesalahan pada halaman:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <h1 className="mt-5 text-xl font-bold text-slate-900">
          Terjadi Kesalahan
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Halaman gagal dimuat karena kesalahan pada server. Silakan coba lagi,
          atau hubungi admin sekolah bila masalah berlanjut.
        </p>

        {error.digest && (
          <p className="mt-3 text-[11px] text-slate-400 font-mono">
            Kode kesalahan: {error.digest}
          </p>
        )}

        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <RefreshCw className="w-4 h-4" /> Coba Lagi
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition"
          >
            <Home className="w-4 h-4" /> Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
