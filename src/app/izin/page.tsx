"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Upload,
  FileText,
  ImageIcon,
  Search,
  X,
  Loader2,
} from "lucide-react";
import { formatIsoDateJakarta } from "@/lib/date";
import { useModalA11y } from "@/lib/useModalA11y";

type Attachment = {
  url: string;
  fileName: string;
  kind: "IMAGE" | "PDF";
  size: number;
};

const MAX_IMAGE_DIMENSION = 2000; // px terpanjang; cukup tajam untuk baca surat
const JPEG_QUALITY = 0.85;

/**
 * Kompres foto di sisi klien: resize bila melebihi dimensi maks & kompres ulang
 * sebagai JPEG. Kualitas tetap terjaga karena teks surat tetap terbaca pada
 * pratinjau, sementara ukuran file turun drastis (foto HP bisa 3–5 MB → <500 KB).
 * PNG transparan (stempel/logo) dikonversi ke JPEG dengan latar putih.
 */
async function compressImage(file: File): Promise<{ blob: Blob; name: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Browser tidak mendukung kompresi gambar.");
  }
  // Latar putih agar hasil JPEG tidak memiliki area transparan hitam
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );
  if (!blob) throw new Error("Gagal memproses foto.");

  const baseName = file.name.replace(/\.[^.]+$/, "");
  return { blob, name: `${baseName}.jpg` };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function PengajuanIzinPublikPage() {
  const [nis, setNis] = useState("");
  // Siswa yang dipilih dari hasil pencarian (nama diambil dari database)
  const [selectedStudent, setSelectedStudent] = useState<{
    nis: string;
    name: string;
    className: string;
  } | null>(null);
  const [searchResults, setSearchResults] = useState<
    { nis: string; name: string; className: string }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [type, setType] = useState<"IZIN" | "SAKIT">("IZIN");
  const [startDate, setStartDate] = useState(() => formatIsoDateJakarta());
  const [endDate, setEndDate] = useState(() => formatIsoDateJakarta());
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // Nama sekolah mengikuti Pengaturan Sekolah
  const [schoolName, setSchoolName] = useState("");

  // Ref kotak pencarian (untuk menutup dropdown saat klik di luar)
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (
        searchBoxRef.current &&
        !searchBoxRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Pencarian siswa dari database (dengan jeda agar tidak request tiap ketikan)
  useEffect(() => {
    const q = nis.trim();
    // Setelah siswa dipilih, kolom berisi NIS siswa itu. Tanpa penjaga ini
    // efek akan mencari lagi memakai NIS tersebut dan dropdown muncul kembali
    // tepat setelah pengguna memilih.
    if (selectedStudent && q === selectedStudent.nis) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/public/student-search?q=${encodeURIComponent(q)}`
        );
        const data = await res.json();
        if (data.success) {
          setSearchResults(data.students || []);
          setDropdownOpen(true);
          setActiveIndex(-1);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [nis, selectedStudent]);

  const selectStudent = (s: { nis: string; name: string; className: string }) => {
    setNis(s.nis);
    setSelectedStudent(s);
    setSearchResults([]);
    setDropdownOpen(false);
    setActiveIndex(-1);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownOpen || searchResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % searchResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) =>
        i <= 0 ? searchResults.length - 1 : i - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = searchResults[activeIndex >= 0 ? activeIndex : 0];
      if (pick) selectStudent(pick);
    } else if (e.key === "Escape") {
      setDropdownOpen(false);
    }
  };

  // Bukti pendukung (foto / PDF)
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [originalSize, setOriginalSize] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewModal = useModalA11y<HTMLDivElement>(previewOpen, () => setPreviewOpen(false));
  // Pop-up konfirmasi saat pengajuan berhasil terkirim
  const successModal = useModalA11y<HTMLDivElement>(!!successMessage, () =>
    setSuccessMessage(null)
  );

  useEffect(() => {
    fetch("/api/public/school")
      .then((res) => res.json())
      .then((d) => {
        if (d.success && d.schoolName) setSchoolName(d.schoolName);
      })
      .catch(() => {});
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // izinkan memilih berkas yang sama lagi
    if (!file) return;

    setError(null);
    setUploading(true);
    setCompressing(false);

    try {
      let payload = file;
      let displayName = file.name;

      if (file.type.startsWith("image/")) {
        setCompressing(true);
        const { blob, name } = await compressImage(file);
        payload = new File([blob], name, { type: "image/jpeg" });
        displayName = name;
      }

      setCompressing(false);

      const formData = new FormData();
      formData.append("file", payload);

      const res = await fetch("/api/public/leave-attachment", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Gagal mengunggah bukti pendukung.");
        return;
      }

      setAttachment({
        url: data.url,
        fileName: data.fileName || displayName,
        kind: data.kind,
        size: data.size,
      });
      setAttachmentUrl(data.url);
      setAttachmentName(displayName);
      setOriginalSize(file.size);
    } catch (e) {
      setCompressing(false);
      setError(
        e instanceof Error
          ? e.message
          : "Gagal memproses berkas. Pastikan berupa foto atau PDF yang valid."
      );
    } finally {
      setCompressing(false);
      setUploading(false);
    }
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
    setAttachmentUrl("");
    setAttachmentName("");
    setOriginalSize(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Siswa harus benar-benar dipilih dari daftar hasil pencarian, atau diisi
    // dengan NIS langsung (agar orang tua tetap bisa menulis NIS bila ingat).
    const nisDipakai = (selectedStudent?.nis || nis).trim();
    if (!nisDipakai) {
      setError("Nama siswa atau NIS wajib diisi.");
      return;
    }
    if (!selectedStudent && !/^\d+$/.test(nisDipakai)) {
      setError(
        "Pilih nama siswa dari daftar yang muncul, atau tuliskan NIS secara langsung."
      );
      return;
    }

    // Bukti pendukung wajib dilampirkan
    if (!attachmentUrl) {
      setError("Bukti pendukung (foto surat atau PDF) wajib dilampirkan.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/public/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nis: nisDipakai,
          type,
          startDate,
          endDate,
          reason,
          attachmentUrl,
          attachmentName,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "Gagal mengirimkan permohonan izin.");
        return;
      }

      setSuccessMessage(data.message);
      setReason("");
      handleRemoveAttachment();
    } catch {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Top Back Link */}
        <div className="flex items-center justify-between">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke Halaman Login Petugas
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <QrCode className="w-4 h-4 text-blue-600" /> {schoolName || "Sekolah"}
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl mx-auto flex items-center justify-center mb-2">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              Formulir Pengajuan Izin / Sakit Mandiri
            </h1>
            <p className="text-xs text-slate-500">
              Siswa atau orang tua/wali murid dapat mengajukan permohonan izin ketidakhadiran
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nama Siswa / NIS *
              </label>
              <div className="relative" ref={searchBoxRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={nis}
                    autoComplete="off"
                    onChange={(e) => {
                      setNis(e.target.value);
                      // Mengetik ulang = pilihan lama tidak berlaku lagi
                      setSelectedStudent(null);
                    }}
                    onFocus={() => {
                      if (searchResults.length > 0) setDropdownOpen(true);
                    }}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Ketik nama siswa, contoh: ahmad"
                    className="w-full pl-9 pr-9 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  {searching ? (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                  ) : nis ? (
                    <button
                      type="button"
                      onClick={() => {
                        setNis("");
                        setSelectedStudent(null);
                        setSearchResults([]);
                        setDropdownOpen(false);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label="Hapus pencarian"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>

                {/* Dropdown hasil pencarian */}
                {dropdownOpen && searchResults.length > 0 && (
                  <ul className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-60 overflow-auto">
                    {searchResults.map((s, i) => (
                      <li key={s.nis}>
                        <button
                          type="button"
                          onClick={() => selectStudent(s)}
                          onMouseEnter={() => setActiveIndex(i)}
                          className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 transition ${
                            i === activeIndex
                              ? "bg-blue-50"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-800 truncate">
                              {s.name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Kelas {s.className}
                            </div>
                          </div>
                          <span className="text-[11px] font-mono font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded shrink-0">
                            {s.nis}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Tidak ada hasil */}
                {dropdownOpen && !searching && searchResults.length === 0 && nis.trim().length >= 2 && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2.5">
                    <p className="text-[11px] text-slate-500">
                      Siswa dengan nama/NIS tersebut tidak ditemukan.
                    </p>
                  </div>
                )}
              </div>

              {/* Konfirmasi siswa yang dipilih */}
              {selectedStudent && (
                <div className="mt-2 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div className="text-[11px] text-emerald-800 min-w-0">
                    <span className="font-semibold">{selectedStudent.name}</span>{" "}
                    <span className="font-mono">({selectedStudent.nis})</span>{" "}
                    · Kelas {selectedStudent.className}
                  </div>
                </div>
              )}
              {!selectedStudent && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Ketik nama siswa lalu pilih dari daftar yang muncul. Bisa
                  juga mengetik NIS secara langsung, contoh: 20261001.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Jenis Permohonan *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType("IZIN")}
                  className={`py-2 text-xs font-semibold rounded-lg border transition ${
                    type === "IZIN"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  Izin (Keperluan Keluarga/Acara)
                </button>
                <button
                  type="button"
                  onClick={() => setType("SAKIT")}
                  className={`py-2 text-xs font-semibold rounded-lg border transition ${
                    type === "SAKIT"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  Sakit (Surat Dokter/Istirahat)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tanggal Mulai *
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tanggal Selesai *
                </label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Alasan Lengkap *
              </label>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Tuliskan keterangan izin atau sakit secara jelas..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Bukti Pendukung: Foto (Surat Dokter / Surat Izin) atau PDF */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Bukti Pendukung (Foto / PDF) <span className="text-rose-500">*</span>
              </label>

              {!attachment ? (
                <label className="flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50 transition cursor-pointer">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {uploading || compressing ? (
                    <>
                      <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
                      <span className="text-xs font-semibold text-slate-600">
                        {compressing ? "Mengompres foto..." : "Mengunggah berkas..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-7 h-7 text-slate-400" />
                      <span className="text-xs font-semibold text-slate-600">
                        Klik untuk pilih foto atau PDF
                      </span>
                      <span className="text-[11px] text-slate-400 text-center">
                        Wajib melampirkan foto surat dokter / surat izin, atau dokumen PDF.
                        Foto otomatis dikompres (maks. 5 MB) namun tetap tajam untuk
                        dibaca. PDF maks. 8 MB.
                      </span>
                    </>
                  )}
                </label>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <div className="flex items-center gap-3 p-3">
                    {/* Pratinjau thumbnail */}
                    <button
                      type="button"
                      onClick={() => setPreviewOpen(true)}
                      className="w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center hover:ring-2 hover:ring-blue-400 transition"
                      title="Perbesar pratinjau"
                    >
                      {attachment.kind === "IMAGE" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={attachment.url}
                          alt="Pratinjau bukti"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileText className="w-7 h-7 text-rose-500" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {attachment.fileName}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {attachment.kind === "PDF" ? "Dokumen PDF" : "Foto"} •{" "}
                        {formatSize(attachment.size)}
                        {originalSize > attachment.size && (
                          <span className="text-emerald-600 font-medium">
                            {" "}
                            (dari {formatSize(originalSize)}, hemat{" "}
                            {Math.round((1 - attachment.size / originalSize) * 100)}%)
                          </span>
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() => setPreviewOpen(true)}
                        className="mt-1 text-[11px] font-semibold text-blue-600 hover:underline"
                      >
                        Lihat pratinjau
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleRemoveAttachment}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
                      title="Hapus bukti"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || uploading || compressing || !attachmentUrl}
              className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading
                ? "Mengirimkan Permohonan..."
                : uploading || compressing
                ? "Menyiapkan Bukti..."
                : "Kirimkan Permohonan Izin"}
            </button>
          </form>
        </div>
      </div>

      {/* Modal Pratinjau Bukti (Aksesibel) */}
      {previewOpen && attachment && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onMouseDown={previewModal.handleBackdropMouseDown}
        >
          <div
            ref={previewModal.panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-modal-title"
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
              <div className="flex items-center gap-2 min-w-0">
                {attachment.kind === "IMAGE" ? (
                  <ImageIcon className="w-4.5 h-4.5 text-blue-600 shrink-0" aria-hidden="true" />
                ) : (
                  <FileText className="w-4.5 h-4.5 text-rose-500 shrink-0" aria-hidden="true" />
                )}
                <span id="preview-modal-title" className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                  {attachment.fileName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                aria-label="Tutup pratinjau bukti"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-slate-100 p-3">
              {attachment.kind === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={attachment.url}
                  alt="Bukti pendukung"
                  className="mx-auto max-w-full rounded-lg shadow-sm"
                />
              ) : (
                <iframe
                  src={attachment.url}
                  title="Pratinjau PDF"
                  className="w-full h-[70vh] rounded-lg bg-white border border-slate-200"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Pop-up: pengajuan berhasil terkirim */}
      {successMessage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onMouseDown={successModal.handleBackdropMouseDown}
        >
          <div
            ref={successModal.panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="success-modal-title"
            aria-describedby="success-modal-desc"
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 text-center"
          >
            <div className="px-6 pt-8 pb-5 space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9" aria-hidden="true" />
              </div>
              <h2 id="success-modal-title" className="text-lg font-bold text-slate-900">
                Pengajuan Izin Terkirim
              </h2>
              <p id="success-modal-desc" className="text-xs text-slate-600 leading-relaxed">
                Pengajuan izin siswa sudah dikirim. Guru akan mengecek terlebih dahulu
                sebelum disetujui.
              </p>
              {successMessage && (
                <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  {successMessage}
                </p>
              )}
            </div>
            <div className="px-6 pb-6">
              <button
                type="button"
                onClick={() => setSuccessMessage(null)}
                className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
