"use client";

import { useEffect, useState } from "react";
import { useModalA11y } from "@/lib/useModalA11y";
import AppShell from "@/components/layout/AppShell";
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  FileText,
  User,
  Calendar,
  AlertCircle,
  X,
  ExternalLink,
} from "lucide-react";
import { useConfirm } from "@/components/ui/DialogProvider";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import Pagination from "@/components/Pagination";

export default function PengajuanIzinAdminPage() {
  const [user, setUser] = useState<any>(null);
  const confirmDialog = useConfirm();
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(100);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [statusTab, setStatusTab] = useState<"PENDING" | "DISETUJUI" | "DITOLAK" | "ALL">("PENDING");
  const [selectedClass, setSelectedClass] = useState("");

  // Reject modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal pratinjau lampiran surat (tidak lagi membuka tab baru)
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewName, setPreviewName] = useState("");
  const [previewIsPdf, setPreviewIsPdf] = useState(false);

  const rejectModal = useModalA11y<HTMLDivElement>(
    rejectModalOpen,
    () => setRejectModalOpen(false)
  );
  const previewModal = useModalA11y<HTMLDivElement>(
    previewOpen,
    () => setPreviewOpen(false)
  );

  // Tentukan apakah lampiran berupa PDF (berdasarkan ekstensi nama/url berkas)
  const isPdfAttachment = (req: any): boolean => {
    const name = (req.attachmentName || req.attachmentUrl || "").toLowerCase();
    return name.endsWith(".pdf");
  };

  const openPreview = (req: any) => {
    setPreviewUrl(req.attachmentUrl);
    setPreviewName(req.attachmentName || "Lampiran Surat");
    setPreviewIsPdf(isPdfAttachment(req));
    setPreviewOpen(true);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusTab !== "ALL") params.append("status", statusTab);
      if (selectedClass) params.append("classId", selectedClass);
      params.append("page", String(page));
      params.append("perPage", String(perPage));

      const res = await fetch(`/api/leave-requests?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setLeaveRequests(data.leaveRequests || []);
        setTotal(data.total ?? 0);
        setTotalPages(data.pagination?.totalPages ?? 1);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setUser(data.user);
      });

    fetch("/api/classes")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setClasses(data.classes || []);
      });
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, statusTab, selectedClass, page, perPage]);

  const handleApprove = async (req: any) => {
    const ok = await confirmDialog({
      title: "Setujui Pengajuan",
      description: `Setujui pengajuan ${req.type} untuk ${req.student?.name}? Presensi siswa pada rentang tanggal terkait akan otomatis tercatat sebagai ${req.type}.`,
      variant: "success",
      confirmLabel: "Ya, Setujui",
    });
    if (!ok) return;

    try {
      setSubmitting(true);
      const res = await fetch("/api/leave-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: req.id, status: "DISETUJUI" }),
      });
      const data = await res.json();

      if (data.success) {
        setMsg({ type: "success", text: data.message });
        fetchData();
      } else {
        setMsg({ type: "error", text: data.message || "Gagal menyetujui pengajuan." });
      }
    } catch {
      setMsg({ type: "error", text: "Terjadi kesalahan jaringan." });
    } finally {
      setSubmitting(false);
    }
  };

  const openRejectModal = (req: any) => {
    setSelectedRequest(req);
    setRejectionNote("");
    setRejectModalOpen(true);
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    try {
      setSubmitting(true);
      const res = await fetch("/api/leave-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedRequest.id,
          status: "DITOLAK",
          rejectionNote: rejectionNote || "Pengajuan izin tidak memenuhi kriteria.",
        }),
      });
      const data = await res.json();

      if (data.success) {
        setMsg({ type: "success", text: data.message });
        setRejectModalOpen(false);
        fetchData();
      } else {
        setMsg({ type: "error", text: data.message || "Gagal menolak pengajuan." });
      }
    } catch {
      setMsg({ type: "error", text: "Terjadi kesalahan jaringan." });
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-xs text-slate-500">
        Memuat verifikasi pengajuan izin...
      </div>
    );
  }

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-indigo-600" />
              Verifikasi & Persetujuan Pengajuan Izin
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Tinjau, setujui, atau tolak permohonan izin dan sakit siswa. Pengajuan yang disetujui akan otomatis dicatat ke riwayat presensi harian.
            </p>
          </div>
        </div>

        {/* Notifikasi Alert */}
        {msg && (
          <div
            className={`p-3.5 rounded-lg text-xs flex items-center justify-between border ${
              msg.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            <span>{msg.text}</span>
            <button onClick={() => setMsg(null)} className="font-bold underline ml-2">
              Tutup
            </button>
          </div>
        )}

        {/* Filter & Tab Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => {
                setPage(1);
                setStatusTab("PENDING");
              }}
              className={`px-3 py-1.5 rounded-md font-semibold transition ${
                statusTab === "PENDING"
                  ? "bg-white text-amber-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Menunggu Persetujuan
            </button>
            <button
              onClick={() => {
                setPage(1);
                setStatusTab("DISETUJUI");
              }}
              className={`px-3 py-1.5 rounded-md font-semibold transition ${
                statusTab === "DISETUJUI"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Disetujui
            </button>
            <button
              onClick={() => {
                setPage(1);
                setStatusTab("DITOLAK");
              }}
              className={`px-3 py-1.5 rounded-md font-semibold transition ${
                statusTab === "DITOLAK"
                  ? "bg-white text-rose-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Ditolak
            </button>
            <button
              onClick={() => {
                setPage(1);
                setStatusTab("ALL");
              }}
              className={`px-3 py-1.5 rounded-md font-semibold transition ${
                statusTab === "ALL"
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Semua
            </button>
          </div>

          {/* Filter Kelas (Khusus Admin/Superadmin) */}
          {user.role !== "GURU" && (
            <div className="flex items-center gap-2 text-xs">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedClass}
                onChange={(e) => {
                  setPage(1);
                  setSelectedClass(e.target.value);
                }}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Semua Kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Tabel Pengajuan Izin */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">
              Daftar Permohonan Izin / Sakit
            </h2>
            <span className="text-xs text-slate-400">Total {total} Pengajuan</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Memuat data pengajuan...</div>
          ) : leaveRequests.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="Tidak Ada Permohonan Izin Ditemukan"
                description="Tidak ada data pengajuan izin atau sakit siswa yang sesuai dengan status atau filter kelas yang dipilih."
              />
            </div>
          ) : (
            <>
            <div className="hidden xl:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Siswa & Kelas</th>
                    <th className="py-3 px-4 text-center">Tipe</th>
                    <th className="py-3 px-4">Rentang Tanggal</th>
                    <th className="py-3 px-4">Alasan & Keterangan</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Pemeriksa</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaveRequests.map((req, i) => (
                    <tr key={req.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-4 text-center text-slate-400">{(page - 1) * perPage + i + 1}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{req.student?.name}</div>
                        <div className="text-[11px] text-slate-500">
                          NIS: {req.student?.nis} • {req.student?.class?.name}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            req.type === "SAKIT"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {req.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {new Date(req.startDate).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        s/d{" "}
                        {new Date(req.endDate).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-slate-800 line-clamp-2">{req.reason}</p>
                        {req.rejectionNote && (
                          <p className="text-rose-600 text-[11px] mt-0.5">
                            Catatan: {req.rejectionNote}
                          </p>
                        )}
                        {req.attachmentUrl && (
                          <button
                            type="button"
                            onClick={() => openPreview(req)}
                            className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:underline mt-1 font-semibold"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Lihat Lampiran Surat
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={req.status} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {req.reviewer ? (
                          <div>
                            <div className="font-medium text-slate-800">{req.reviewer.name}</div>
                            <div>{req.reviewer.role}</div>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {req.status === "PENDING" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleApprove(req)}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-semibold text-[11px] transition shadow-xs"
                            >
                              Setujui
                            </button>
                            <button
                              onClick={() => openRejectModal(req)}
                              className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md font-semibold text-[11px] transition shadow-xs"
                            >
                              Tolak
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Selesai</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Kartu mobile: semua data tampil tanpa geser horizontal */}
            <div className="xl:hidden divide-y divide-slate-100">
              {leaveRequests.map((req, i) => (
                <div key={req.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] text-slate-400 font-bold">
                        No. {(page - 1) * perPage + i + 1}
                      </div>
                      <div className="font-bold text-slate-900">{req.student?.name}</div>
                      <div className="text-[11px] text-slate-500">
                        NIS: {req.student?.nis} • {req.student?.class?.name}
                      </div>
                    </div>
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                        req.type === "SAKIT"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {req.type}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Rentang Tanggal
                      </div>
                      <div className="text-slate-700 font-medium">
                        {new Date(req.startDate).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        s/d{" "}
                        {new Date(req.endDate).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Status
                      </div>
                      <StatusBadge status={req.status} size="sm" />
                    </div>
                  </div>

                  <div className="text-xs">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Alasan & Keterangan
                    </div>
                    <p className="text-slate-800">{req.reason}</p>
                    {req.rejectionNote && (
                      <p className="text-rose-600 text-[11px] mt-0.5">
                        Catatan: {req.rejectionNote}
                      </p>
                    )}
                    {req.attachmentUrl && (
                      <button
                        type="button"
                        onClick={() => openPreview(req)}
                        className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:underline mt-1 font-semibold"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Lihat Lampiran Surat
                      </button>
                    )}
                  </div>

                  <div className="text-xs">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Pemeriksa
                    </div>
                    {req.reviewer ? (
                      <div className="text-slate-500 text-[11px]">
                        <span className="font-medium text-slate-800">{req.reviewer.name}</span> •{" "}
                        {req.reviewer.role}
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </div>

                  {req.status === "PENDING" && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleApprove(req)}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs transition shadow-xs"
                      >
                        Setujui
                      </button>
                      <button
                        onClick={() => openRejectModal(req)}
                        className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-xs transition shadow-xs"
                      >
                        Tolak
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            </>
          )}

          {!loading && leaveRequests.length > 0 && (
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

        {/* Modal Penolakan Izin */}
        {rejectModalOpen && selectedRequest && (
          <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50"
              onMouseDown={rejectModal.handleBackdropMouseDown}
            >
            <div
              ref={rejectModal.panelRef}
              aria-labelledby="reject-modal-title"
              className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200"
            >
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <h3 id="reject-modal-title" className="text-base font-bold text-slate-900">
                  Tolak Pengajuan {selectedRequest.type}
                </h3>
                <button
                  onClick={() => setRejectModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleReject} className="space-y-3.5 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <div className="font-semibold text-slate-800">{selectedRequest.student?.name}</div>
                  <div className="text-slate-500">Kelas: {selectedRequest.student?.class?.name}</div>
                  <div className="text-slate-500">Alasan diajukan: {selectedRequest.reason}</div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Catatan Alasan Penolakan
                  </label>
                  <textarea
                    rows={3}
                    value={rejectionNote}
                    onChange={(e) => setRejectionNote(e.target.value)}
                    required
                    placeholder="Contoh: Surat keterangan dokter tidak terlampir atau tanggal tidak sesuai."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setRejectModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-50 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold transition disabled:opacity-50"
                  >
                    {submitting ? "Memproses..." : "Konfirmasi Tolak"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Pratinjau Lampiran Surat */}
        {previewOpen && previewUrl && (
          <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
              onMouseDown={previewModal.handleBackdropMouseDown}
            >
            <div
              ref={previewModal.panelRef}
              className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
                  <h3 className="text-sm font-bold text-slate-900 truncate">
                    {previewName}
                  </h3>
                </div>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md shrink-0"
                  aria-label="Tutup pratinjau"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto bg-slate-100 p-3">
                {previewIsPdf ? (
                  <iframe
                    src={previewUrl}
                    title={previewName}
                    className="w-full h-[70vh] rounded-lg bg-white"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt={previewName}
                    className="max-w-full mx-auto rounded-lg bg-white"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
