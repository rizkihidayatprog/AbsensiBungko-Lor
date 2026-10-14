"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  QrCode,
  Printer,
  Search,
  Filter,
} from "lucide-react";

export default function QrCodePage() {
  const [user, setUser] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState("");
  const [search, setSearch] = useState("");
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  // Nama sekolah pada kartu QR (dari Pengaturan Sekolah)
  const [schoolName, setSchoolName] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const resMe = await fetch("/api/auth/me");
        const dataMe = await resMe.json();
        if (dataMe.success) {
          setUser(dataMe.user);
        }

        const resCls = await fetch("/api/classes");
        const dataCls = await resCls.json();
        if (dataCls.success) {
          setClasses(dataCls.classes);
          if (dataCls.classes.length > 0 && !selectedClass) {
            setSelectedClass(dataCls.classes[0].id);
          }
        }

        const resSettings = await fetch("/api/settings");
        const dataSettings = await resSettings.json();
        if (dataSettings.success && dataSettings.setting?.schoolName) {
          setSchoolName(dataSettings.setting.schoolName);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedClass) params.append("classId", selectedClass);
        if (search) params.append("search", search);
        params.append("perPage", "2000");

        const res = await fetch(`/api/students?${params.toString()}`);
        const data = await res.json();
        if (data.success) {
          setStudents(data.students);

          // Generate QR data URLs
          const { toDataURL } = await import("qrcode");
          const map: Record<string, string> = {};
          for (const s of data.students) {
            map[s.id] = await toDataURL(s.qrTokenHash, {
              width: 250,
              margin: 1,
              color: { dark: "#0f172a", light: "#ffffff" },
            });
          }
          setQrImages(map);
        }
      } catch (e) {
        console.error(e);
      }
    };

    if (user) {
      fetchStudents();
    }
  }, [selectedClass, search, user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-xs text-slate-500">
        Memuat data kartu QR...
      </div>
    );
  }

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        {/* Printable Card Style Injection */}
        <style jsx global>{`
          @media print {
            body {
              background: white !important;
            }
            aside, header, .no-print {
              display: none !important;
            }
            .print-grid {
              display: grid !important;
              grid-template-columns: repeat(2, 1fr) !important;
              gap: 16px !important;
              padding: 0 !important;
            }
            .qr-card {
              page-break-inside: avoid !important;
              border: 1px solid #cbd5e1 !important;
              box-shadow: none !important;
            }
          }
        `}</style>

        {/* Header (No print) */}
        <div className="no-print bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-blue-600" /> Cetak Kartu QR Presensi
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Generate dan cetak kartu QR Code presensi siswa per kelas secara massal
            </p>
          </div>

          <button
            onClick={() => window.print()}
            disabled={students.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-black rounded-lg shadow-sm transition disabled:opacity-50"
          >
            <Printer className="w-4 h-4" /> Cetak Semua Kartu (Print)
          </button>
        </div>

        {/* Filter Bar (No print) */}
        <div className="no-print bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari siswa dalam kelas..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          {user.role !== "GURU" && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="py-2 px-3 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Grid Kartu QR Siswa */}
        {loading ? (
          <div className="bg-white p-12 text-center text-xs text-slate-400 rounded-xl border border-slate-200">
            Mempersiapkan kartu QR...
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white p-12 text-center text-xs text-slate-400 rounded-xl border border-slate-200">
            Tidak ada siswa ditemukan di kelas ini.
          </div>
        ) : (
          <div className="print-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {students.map((student) => {
              const qrImg = qrImages[student.id];

              return (
                <div
                  key={student.id}
                  className="qr-card bg-white border border-slate-200 rounded-2xl p-4 shadow-xs text-center flex flex-col justify-between"
                >
                  {/* Card Header */}
                  <div className="border-b border-slate-100 pb-2">
                    <div className="text-[10px] font-bold tracking-wider uppercase text-blue-900">
                      {schoolName || "-"}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      KARTU PRESENSI RESMI
                    </div>
                  </div>

                  {/* QR Image */}
                  <div className="py-3 flex justify-center">
                    {qrImg ? (
                      <div className="p-2 border border-slate-200 rounded-xl bg-white shadow-xs">
                        <img
                          src={qrImg}
                          alt={`QR ${student.name}`}
                          className="w-36 h-36 mx-auto object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-36 h-36 bg-slate-100 rounded-xl animate-pulse" />
                    )}
                  </div>

                  {/* Student Info */}
                  <div className="border-t border-slate-100 pt-2 space-y-0.5">
                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      {student.name}
                    </h3>
                    <p className="text-xs font-mono font-medium text-slate-600">
                      NIS: {student.nis}
                    </p>
                    <p className="text-[11px] font-semibold text-blue-700">
                      Kelas: {student.class?.name}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
