"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import ReportDocument from "./ReportDocument";
import {
  FileText,
  FileDown,
  ChevronDown,
  Printer,
  Calendar,
  X,
  Eye,
  ZoomIn,
  ZoomOut,
  Loader2,
  Users,
  FileSpreadsheet,
} from "lucide-react";

type ReportType = "HARIAN" | "MINGGUAN" | "BULANAN" | "SEMESTER";

const TAB_METADATA: { key: ReportType; label: string; sub: string }[] = [
  { key: "HARIAN", label: "Harian", sub: "Detail kehadiran per hari" },
  { key: "MINGGUAN", label: "Mingguan", sub: "Matrix checklist per pekan" },
  { key: "BULANAN", label: "Bulanan", sub: "Evaluasi & persentase" },
  { key: "SEMESTER", label: "Semester", sub: "Rekap akhir & kelayakan" },
];

export default function LaporanPage() {
  const [user, setUser] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [setting, setSetting] = useState<any>(null);

  const [reportType, setReportType] = useState<ReportType>("HARIAN");
  const [selectedDate, setSelectedDate] = useState(() =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date())
  );
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedTermId, setSelectedTermId] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [allClasses, setAllClasses] = useState(false);

  // Pagination baris siswa (agregasi tetap dihitung atas seluruh siswa)
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [showPreview, setShowPreview] = useState(false);
  const [zoom, setZoom] = useState(0.75);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setUser(d.user);
      });

    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.setting) setSetting(d.setting);
      });

    fetch("/api/classes")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setClasses(d.classes);
      });

    fetch("/api/academic-terms")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const allTerms: any[] = [];
          d.academicYears.forEach((ay: any) => {
            ay.terms.forEach((t: any) => allTerms.push(t));
          });
          setTerms(allTerms);
          if (d.activeTerm) setSelectedTermId(d.activeTerm.id);
        }
      });
  }, []);

  const fetchReport = async () => {
    if (!user) return;
    if (reportType === "SEMESTER" && !selectedTermId) {
      setData(null);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("type", reportType);

      if (reportType === "SEMESTER") {
        params.append("termId", selectedTermId);
      } else if (reportType === "BULANAN") {
        params.append("month", selectedMonth);
      } else {
        params.append("date", selectedDate);
      }

      if (allClasses) {
        params.append("all", "1");
      } else if (selectedClass) {
        params.append("classId", selectedClass);
      }

      params.append("page", String(page));
      params.append("perPage", String(perPage));

      const res = await fetch(`/api/attendance/report?${params.toString()}`);
      const d = await res.json();
      if (d.success) setData(d);
      else setData(null);
    } catch (e) {
      console.error(e);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExportXlsx = () => {
    if (!user || loading) return;
    const params = new URLSearchParams();
    params.append("type", reportType);
    if (reportType === "SEMESTER") {
      if (!selectedTermId) return;
      params.append("termId", selectedTermId);
    } else if (reportType === "BULANAN") {
      params.append("month", selectedMonth);
    } else {
      params.append("date", selectedDate);
    }
    if (allClasses) params.append("all", "1");
    else if (selectedClass) params.append("classId", selectedClass);
    params.append("export", "xlsx");
    window.open(`/api/attendance/report?${params.toString()}`, "_blank");
  };

  // Kembalikan ke halaman pertama setiap kali filter berubah
  useEffect(() => {
    setPage(1);
  }, [reportType, selectedDate, selectedMonth, selectedTermId, selectedClass, allClasses, perPage]);

  useEffect(() => {
    fetchReport();
  }, [
    user,
    reportType,
    selectedDate,
    selectedMonth,
    selectedTermId,
    selectedClass,
    allClasses,
    page,
    perPage,
  ]);

  // Baris yang benar-benar dirender pada halaman ini (setelah dipaginasi)
  const rowsOnPage = useMemo(() => {
    if (!data?.classSections) return 0;
    return data.classSections.reduce((acc: number, s: any) => acc + s.rows.length, 0);
  }, [data]);

  // Total keseluruhan laporan (tidak terpengaruh paginasi)
  const totalRows = data?.totalRows ?? rowsOnPage;

  const scopeLabel = useMemo(() => {
    if (allClasses) return "Seluruh Kelas (per seksi)";
    if (selectedClass) {
      const c = classes.find((x) => x.id === selectedClass);
      return `Kelas ${c?.name || "-"}`;
    }
    return user?.role === "GURU"
      ? `Kelas ${user?.homeroomClassName || "Perwalian"}`
      : "Seluruh Kelas";
  }, [allClasses, selectedClass, classes, user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-xs text-slate-500">
        Memuat laporan...
      </div>
    );
  }

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <style jsx global>{`
          @media print {
            body {
              background: white !important;
            }
            aside, header, .no-print {
              display: none !important;
            }
            /* Dokumen yang tampil langsung di halaman ikut tercetak */
            .inline-paper {
              border: none !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              overflow: visible !important;
            }
            .preview-paper {
              width: 100% !important;
              min-height: 0 !important;
              padding: 0 !important;
            }
            /* Bila modal pratinjau sedang terbuka, cetak isinya saja */
            .preview-overlay {
              position: static !important;
              padding: 0 !important;
              background: none !important;
            }
            .preview-scroll {
              overflow: visible !important;
              max-height: none !important;
              padding: 0 !important;
              background: none !important;
              display: block !important;
            }
            .preview-overlay .preview-paper {
              box-shadow: none !important;
              zoom: 1 !important;
            }
          }
        `}</style>

        {/* Header */}
        <div className="no-print bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" /> Laporan Absensi Siswa
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Rekap harian, mingguan, bulanan, hingga semester — siap cetak & ekspor PDF.
            </p>
          </div>

          <div className="relative">
            <button
              onClick={() => setExportMenuOpen((o) => !o)}
              disabled={totalRows === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition disabled:opacity-50"
            >
              <FileDown className="w-4 h-4" /> Ekspor
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  exportMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {exportMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setExportMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 z-20 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5">
                  <button
                    onClick={() => {
                      setExportMenuOpen(false);
                      handleExportXlsx();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-blue-50 transition"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => {
                      setExportMenuOpen(false);
                      setZoom(0.75);
                      setShowPreview(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-blue-50 transition"
                  >
                    <Printer className="w-4 h-4 text-blue-600" /> PDF / Cetak
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tab Jenis Laporan */}
        <div className="no-print grid grid-cols-2 lg:grid-cols-4 gap-2">
          {TAB_METADATA.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setReportType(t.key)}
              className={`text-left px-4 py-3 rounded-xl border transition ${
                reportType === t.key
                  ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                  : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
              }`}
            >
              <div className="text-xs font-bold">Laporan {t.label}</div>
              <div
                className={`text-[10px] mt-0.5 ${
                  reportType === t.key ? "text-blue-100" : "text-slate-500"
                }`}
              >
                {t.sub}
              </div>
            </button>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="no-print bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-center">
          {reportType === "SEMESTER" ? (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <select
                value={selectedTermId}
                onChange={(e) => setSelectedTermId(e.target.value)}
                className="py-1.5 px-3 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Pilih Semester...</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.isActive ? "• [Aktif]" : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : reportType === "BULANAN" ? (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="py-1.5 px-3 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="py-1.5 px-3 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <span className="text-xs text-slate-400">
                {reportType === "MINGGUAN" ? "(per pekan Senin–Minggu)" : ""}
              </span>
            </div>
          )}

          {user.role !== "GURU" && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <select
                value={allClasses ? "__ALL__" : selectedClass}
                onChange={(e) => {
                  if (e.target.value === "__ALL__") {
                    setAllClasses(true);
                    setSelectedClass("");
                  } else {
                    setAllClasses(false);
                    setSelectedClass(e.target.value);
                  }
                }}
                className="py-1.5 px-3 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Semua Kelas (gabung)</option>
                <option value="__ALL__">Semua Kelas (per seksi)</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {data?.period && (
            <span className="text-[11px] text-slate-500">
              Periode: <strong>{data.period.label}</strong> · Hari efektif:{" "}
              <strong>{data.period.totalHariEfektif}</strong> hari
            </span>
          )}

          {totalRows > perPage && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Baris per halaman:</span>
              <select
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value))}
                className="py-1.5 px-2 text-xs border border-slate-300 rounded-lg bg-white"
              >
                {[25, 50, 100, 200].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Ringkasan cepat */}
        {data && totalRows > 0 && (
          <div className="no-print grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Siswa", value: totalRows, color: "text-slate-900" },
              {
                label: `Hadir (hal. ${page})`,
                value: data.classSections.reduce(
                  (a: number, s: any) =>
                    a + s.rows.reduce((b: number, r: any) => b + r.counts.H, 0),
                  0
                ),
                color: "text-emerald-700",
              },
              {
                label: `Alfa (hal. ${page})`,
                value: data.classSections.reduce(
                  (a: number, s: any) =>
                    a + s.rows.reduce((b: number, r: any) => b + r.counts.A, 0),
                  0
                ),
                color: "text-rose-700",
              },
              {
                label: "Jumlah Kelas",
                value: data.totalClasses ?? data.classSections.length,
                color: "text-blue-700",
              },
            ].map((c) => (
              <div
                key={c.label}
                className="bg-white p-3 rounded-xl border border-slate-200 text-center"
              >
                <div className="text-[10px] text-slate-500">{c.label}</div>
                <div className={`text-lg font-bold ${c.color}`}>{c.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Dokumen laporan ditampilkan langsung (inline) */}
        {loading ? (
          <div className="no-print bg-white p-14 rounded-xl border border-slate-200 flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin" />
            <p className="text-xs">Menyusun laporan...</p>
          </div>
        ) : data && totalRows > 0 ? (
          <>
            <div className="no-print flex items-center justify-between gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200">
              <p className="text-[11px] text-slate-500">
                Menampilkan{" "}
                <strong>
                  {data.pagination && data.pagination.totalPages > 1
                    ? `halaman ${data.pagination.page} dari ${data.pagination.totalPages}`
                    : "seluruh data"}
                </strong>{" "}
                ({rowsOnPage} dari {totalRows} siswa).
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || data.pagination?.totalPages <= 1}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Sebelumnya
                </button>
                <span className="text-[11px] text-slate-600 px-1">
                  {page} / {Math.max(1, data.pagination?.totalPages ?? 1)}
                </span>
                <button
                  onClick={() =>
                    setPage((p) => Math.min(data.pagination?.totalPages ?? 1, p + 1))
                  }
                  disabled={
                    data.pagination?.totalPages <= 1 ||
                    page >= (data.pagination?.totalPages ?? 1)
                  }
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Berikutnya
                </button>
              </div>
            </div>

            <div className="inline-paper mx-auto bg-white text-slate-900 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
              <div
                className="preview-paper mx-auto text-slate-900"
                style={{
                  width: "210mm",
                  minHeight: "297mm",
                  padding: "16mm",
                }}
              >
                <ReportDocument
                  setting={setting}
                  user={user}
                  reportType={reportType}
                  period={data.period}
                  matrixDays={data.matrixDays}
                  classSections={data.classSections}
                  scopeLabel={scopeLabel}
                  ambang={data.ambang}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="no-print bg-white p-12 rounded-xl border border-dashed border-slate-300 text-center space-y-2">
            <FileText className="w-9 h-9 mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-700">Data Laporan Kosong</p>
            <p className="text-xs text-slate-500">
              {reportType === "SEMESTER" && !selectedTermId
                ? "Silakan pilih periode semester terlebih dahulu."
                : "Tidak ada siswa yang sesuai pada periode dan kelas terpilih."}
            </p>
          </div>
        )}

        {/* Modal Pratinjau Cetak */}
        {showPreview && data && (
          <div className="preview-overlay fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex flex-col">
            <div className="no-print shrink-0 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-white">
                <Eye className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-bold">
                  Pratinjau Laporan {TAB_METADATA.find((t) => t.key === reportType)?.label}
                </span>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  {data.period.label} · {scopeLabel}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5">
                  <button
                    onClick={() =>
                      setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))
                    }
                    className="p-1.5 rounded-md text-slate-300 hover:bg-slate-700 transition"
                    title="Perkecil"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-[11px] font-mono text-slate-300 w-11 text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={() =>
                      setZoom((z) => Math.min(1.5, Number((z + 0.1).toFixed(2))))
                    }
                    className="p-1.5 rounded-md text-slate-300 hover:bg-slate-700 transition"
                    title="Perbesar"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
                >
                  <Printer className="w-3.5 h-3.5" /> Cetak / PDF
                </button>

                <button
                  onClick={() => setShowPreview(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Tutup pratinjau"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="preview-scroll flex-1 overflow-auto p-4 sm:p-6">
              <div
                className="preview-paper mx-auto bg-white text-slate-900 shadow-2xl"
                style={{
                  zoom,
                  width: "210mm",
                  minHeight: "297mm",
                  padding: "16mm",
                }}
              >
                <ReportDocument
                  setting={setting}
                  user={user}
                  reportType={reportType}
                  period={data.period}
                  matrixDays={data.matrixDays}
                  classSections={data.classSections}
                  scopeLabel={scopeLabel}
                  ambang={data.ambang}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
