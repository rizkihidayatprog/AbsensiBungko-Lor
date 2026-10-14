import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <SearchX className="w-7 h-7" />
        </div>

        <h1 className="mt-5 text-xl font-bold text-slate-900">Halaman Tidak Ditemukan</h1>
        <p className="mt-2 text-sm text-slate-500">
          Alamat yang Anda buka tidak tersedia atau sudah dipindahkan. Periksa kembali
          tautan atau kembali ke halaman utama.
        </p>

        <div className="mt-6 flex items-center justify-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            Kembali ke Dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition"
          >
            Halaman Utama
          </Link>
        </div>
      </div>
    </div>
  );
}
