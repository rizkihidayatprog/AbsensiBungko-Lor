"use client";

import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "students" | "teachers";
  onSuccess: () => void;
}

interface ValidationSummary {
  totalRows: number;
  validCount: number;
  errorCount: number;
}

interface PreviewRow {
  rowNumber: number;
  isValid: boolean;
  errors: string[];
  [key: string]: any;
}

export default function CsvImportModal({
  isOpen,
  onClose,
  type,
  onSuccess,
}: CsvImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [validating, setValidating] = useState<boolean>(false);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [defaultPassword, setDefaultPassword] = useState<string>("guru123");
  const [importSuccessMessage, setImportSuccessMessage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const isStudent = type === "students";
  const title = isStudent ? "Impor Data Siswa via CSV" : "Impor Data Guru via CSV";
  const templateUrl = `/api/templates/csv?type=${type}`;
  const importEndpoint = isStudent ? "/api/students/import" : "/api/teachers/import";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      setErrorMessage("File harus berformat .csv");
      return;
    }

    setFile(selectedFile);
    setErrorMessage("");
    setImportSuccessMessage("");

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
      await validateCsv(content);
    };
    reader.readAsText(selectedFile);
  };

  const validateCsv = async (content: string) => {
    setValidating(true);
    setErrorMessage("");
    setSummary(null);
    setRows([]);

    try {
      const res = await fetch(importEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvContent: content,
          mode: "validate",
          defaultPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal memvalidasi file CSV.");
      }

      setSummary(data.summary);
      setRows(data.rows || []);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan saat memvalidasi CSV.");
    } finally {
      setValidating(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!csvContent || !summary || summary.validCount === 0) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch(importEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvContent,
          mode: "execute",
          defaultPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Gagal mengeksekusi impor data.");
      }

      setImportSuccessMessage(data.message);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal memproses impor data.");
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setCsvContent("");
    setSummary(null);
    setRows([]);
    setErrorMessage("");
    setImportSuccessMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{title}</h2>
              <p className="text-xs text-gray-500">
                Unggah file CSV sesuai format template untuk menambahkan data secara massal.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Modal */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {importSuccessMessage ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Impor Data Berhasil!</h3>
              <p className="text-sm text-gray-600 max-w-md mx-auto">{importSuccessMessage}</p>
              <div className="pt-4 flex justify-center gap-3">
                <button
                  onClick={resetState}
                  className="px-4 py-2 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 text-sm transition-colors"
                >
                  Impor File Lain
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 text-sm transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Petunjuk & Download Template */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-blue-50 border border-blue-100">
                <div className="text-xs text-blue-800 space-y-1">
                  <p className="font-semibold">Format Kolom yang Dibutuhkan:</p>
                  <p className="font-mono text-[11px] text-blue-900">
                    {isStudent
                      ? "nis, nisn, nama, jenis_kelamin (L/P), kelas"
                      : "nip, nama, jenis_kelamin (L/P), telepon, email, buat_akun (ya/tidak)"}
                  </p>
                </div>
                <a
                  href={templateUrl}
                  download
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-white text-blue-700 border border-blue-200 text-xs font-semibold rounded-lg hover:bg-blue-100/50 shadow-xs transition-colors shrink-0"
                >
                  <Download className="w-4 h-4" />
                  Unduh Template CSV
                </a>
              </div>

              {/* Area Upload File */}
              {!file ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-gray-50/50 hover:bg-blue-50/20 group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-12 h-12 bg-white rounded-full shadow-sm text-gray-400 group-hover:text-blue-600 flex items-center justify-center mx-auto mb-3 transition-colors">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-gray-800">
                    Klik untuk memilih file CSV atau seret ke sini
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Maksimal 1.000 baris per file</p>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={resetState}
                      className="text-xs text-red-600 hover:text-red-700 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Ganti File
                    </button>
                  </div>
                </div>
              )}

              {/* Setting Password untuk Guru */}
              {!isStudent && file && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Password Default Akun Guru (jika opsi buat akun aktif):
                  </label>
                  <input
                    type="text"
                    value={defaultPassword}
                    onChange={(e) => setDefaultPassword(e.target.value)}
                    placeholder="Contoh: guru123"
                    className="w-full sm:w-64 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Status Validasi */}
              {validating && (
                <div className="py-8 text-center text-gray-500 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                  <p className="text-xs font-semibold">Memeriksa kelayakan dan duplikasi data...</p>
                </div>
              )}

              {/* Hasil Pratinjau & Tabel */}
              {summary && !validating && (
                <div className="space-y-4">
                  {/* Badge Ringkasan */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-center">
                      <span className="block text-xs text-gray-500">Total Baris</span>
                      <span className="text-lg font-bold text-gray-800">{summary.totalRows}</span>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                      <span className="block text-xs text-emerald-600">Siap Diimpor</span>
                      <span className="text-lg font-bold text-emerald-700">{summary.validCount}</span>
                    </div>
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-center">
                      <span className="block text-xs text-red-600">Bermasalah / Error</span>
                      <span className="text-lg font-bold text-red-700">{summary.errorCount}</span>
                    </div>
                  </div>

                  {/* Tabel Pratinjau */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 text-gray-600 sticky top-0 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2 w-12 text-center">Baris</th>
                            <th className="px-3 py-2">Status</th>
                            {isStudent ? (
                              <>
                                <th className="px-3 py-2">NIS</th>
                                <th className="px-3 py-2">Nama Siswa</th>
                                <th className="px-3 py-2">Kelas</th>
                              </>
                            ) : (
                              <>
                                <th className="px-3 py-2">NIP</th>
                                <th className="px-3 py-2">Nama Guru</th>
                                <th className="px-3 py-2">Email</th>
                              </>
                            )}
                            <th className="px-3 py-2">Catatan / Validasi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {rows.map((row) => (
                            <tr
                              key={row.rowNumber}
                              className={row.isValid ? "bg-white" : "bg-red-50/40"}
                            >
                              <td className="px-3 py-2 text-center text-gray-400 font-mono">
                                {row.rowNumber}
                              </td>
                              <td className="px-3 py-2">
                                {row.isValid ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                    <CheckCircle className="w-3 h-3" /> Valid
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                                    <AlertCircle className="w-3 h-3" /> Error
                                  </span>
                                )}
                              </td>
                              {isStudent ? (
                                <>
                                  <td className="px-3 py-2 font-mono text-gray-800">{row.nis}</td>
                                  <td className="px-3 py-2 font-semibold text-gray-900">{row.name}</td>
                                  <td className="px-3 py-2 text-gray-700">{row.className}</td>
                                </>
                              ) : (
                                <>
                                  <td className="px-3 py-2 font-mono text-gray-800">{row.nip || "-"}</td>
                                  <td className="px-3 py-2 font-semibold text-gray-900">{row.name}</td>
                                  <td className="px-3 py-2 text-gray-700">{row.email || "-"}</td>
                                </>
                              )}
                              <td className="px-3 py-2 text-gray-600">
                                {row.isValid ? (
                                  <span className="text-gray-400">Siap disimpan</span>
                                ) : (
                                  <span className="text-red-600 font-medium">
                                    {row.errors.join(", ")}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Modal */}
        {!importSuccessMessage && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 transition-colors"
            >
              Batal
            </button>
            <div className="flex items-center gap-3">
              {summary && summary.validCount > 0 && (
                <button
                  onClick={handleExecuteImport}
                  disabled={loading || validating}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Memproses Impor...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      Impor {summary.validCount} Data Valid
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
