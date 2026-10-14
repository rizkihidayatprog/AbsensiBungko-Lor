import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
        <p className="text-sm font-medium">Memuat halaman...</p>
      </div>
    </div>
  );
}
