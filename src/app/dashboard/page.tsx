import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getTodayDate } from "@/lib/date";
import prisma from "@/lib/prisma";
import AppShell from "@/components/layout/AppShell";
import Link from "next/link";
import {
  Users,
  GraduationCap,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserX,
  Camera,
  Calendar,
  ArrowRight,
  TrendingUp,
  FileText,
  Activity,
  Sparkles,
} from "lucide-react";
import DashboardCalendar from "@/components/DashboardCalendar";
import {
  getAlfaBeruntun,
  getRekapKeterlambatan,
  ALFA_BERUNTUN_MIN_HARI,
  REKAP_TELAMBAT_MIN_MENIT,
} from "@/lib/analytics";
import { startOfMonth } from "@/lib/report";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default async function DashboardPage() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) {
    redirect("/login");
  }

  // Ambil detail data user dari DB
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    include: {
      teacher: {
        include: {
          homeroomClass: {
            include: {
              students: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  // Tanggal hari ini (zona waktu Asia/Jakarta)
  const today = getTodayDate();

  // Eksekusi seluruh kueri dashboard secara paralel dengan Promise.all untuk loading instan
  const [
    settings,
    holidays,
    totalStudents,
    totalTeachers,
    activeTerm,
    todayAttendances,
    classes,
  ] = await Promise.all([
    prisma.schoolSetting.findFirst({ where: { id: 1 } }),
    prisma.holiday.findMany({ orderBy: { date: "asc" } }),
    prisma.student.count({ where: { isActive: true } }),
    prisma.teacher.count({ where: { isActive: true } }),
    prisma.academicTerm.findFirst({
      where: { isActive: true },
      include: { academicYear: true },
    }),
    prisma.studentAttendance.findMany({
      where: { attendanceDate: today },
      include: {
        student: { include: { class: true } },
        createdBy: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.class.findMany({
      include: {
        students: {
          where: { isActive: true },
          include: {
            attendances: { where: { attendanceDate: today } },
          },
        },
        homeroom: true,
      },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    }),
  ]);

  const countHadir = todayAttendances.filter((a) => a.status === "HADIR").length;
  const countTerlambat = todayAttendances.filter((a) => a.status === "TERLAMBAT").length;
  const countIzin = todayAttendances.filter((a) => a.status === "IZIN").length;
  const countSakit = todayAttendances.filter((a) => a.status === "SAKIT").length;
  const countAlfa = todayAttendances.filter((a) => a.status === "ALFA").length;
  const totalRecorded = todayAttendances.length;
  const countBelumScan = Math.max(0, totalStudents - totalRecorded);

  // Persentase kehadiran hari ini (Hadir + Terlambat)
  const percentAttendance =
    totalStudents > 0
      ? Math.round(((countHadir + countTerlambat) / totalStudents) * 100)
      : 0;

  // Daftar Scan Terkini (8 scan terakhir)
  const recentScans = todayAttendances.slice(0, 8);

  // Data Khusus Guru / Wali Kelas
  const homeroomClass = user.teacher?.homeroomClass;
  const homeroomStudents = homeroomClass
    ? await prisma.student.findMany({
        where: { classId: homeroomClass.id, isActive: true },
        include: {
          attendances: {
            where: {
              attendanceDate: today,
            },
          },
        },
        orderBy: { name: "asc" },
      })
    : [];

  // Analitik peringatan: alfa beruntun + rekap keterlambatan
  const scopeClassId =
    user.role === "GURU" ? homeroomClass?.id ?? "__tanpa_kelas__" : null;
  const bulanMulai = startOfMonth(today);
  const [alfaBeruntun, rekapKeterlambatan] = await Promise.all([
    getAlfaBeruntun(ALFA_BERUNTUN_MIN_HARI, today, scopeClassId),
    getRekapKeterlambatan(
      bulanMulai,
      today,
      REKAP_TELAMBAT_MIN_MENIT,
      scopeClassId
    ),
  ]);

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        {/* Banner Selamat Datang & Status Utama */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Selamat Datang, {user.name}
              </h1>
              {activeTerm && (
                <Link
                  href="/semester"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true"></span>
                  <span>{activeTerm.name}</span>
                </Link>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <Calendar className="w-4 h-4 text-slate-500" aria-hidden="true" />
                {new Date().toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1 font-medium">
                <Clock className="w-4 h-4 text-slate-500" aria-hidden="true" />
                Batas Jam Masuk:{" "}
                <strong className="text-slate-900 font-bold ml-1">
                  Maks. {settings?.checkInEnd || "07:15"} WIB
                </strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/scanner"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <Camera className="w-4 h-4" aria-hidden="true" />
              <span>Buka Scanner QR</span>
            </Link>
          </div>
        </div>

        {/* KALENDER AKADEMIK & TANGGAL MERAH HARI LIBUR */}
        <DashboardCalendar
          holidays={holidays}
          activeDays={settings?.activeDays || "1,2,3,4,5"}
          checkInEnd={settings?.checkInEnd || "07:15"}
          userRole={user.role}
        />

        {/* ROLE GURU: WALI KELAS VIEW */}
        {user.role === "GURU" && homeroomClass && (
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-blue-200/90 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  Dashboard Wali Kelas
                </span>
                <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                  Kelas {homeroomClass.name}
                </h2>
                <p className="text-xs text-slate-500">
                  Ringkasan dan data presensi siswa perwalian Anda hari ini
                </p>
              </div>
              <Link
                href="/presensi/siswa"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition"
              >
                <span>Lihat Semua Presensi Siswa</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>

            {/* Rekap Kehadiran Kelas Perwalian */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/90">
                <div className="text-xs text-slate-600 font-medium">Total Siswa</div>
                <div className="text-2xl font-bold text-slate-900 mt-0.5">{homeroomStudents.length}</div>
              </div>
              <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
                <div className="text-xs text-emerald-800 font-semibold">Hadir Tepat</div>
                <div className="text-2xl font-bold text-emerald-900 mt-0.5">
                  {
                    homeroomStudents.filter(
                      (s) => s.attendances[0]?.status === "HADIR"
                    ).length
                  }
                </div>
              </div>
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200">
                <div className="text-xs text-amber-800 font-semibold">Terlambat</div>
                <div className="text-2xl font-bold text-amber-900 mt-0.5">
                  {
                    homeroomStudents.filter(
                      (s) => s.attendances[0]?.status === "TERLAMBAT"
                    ).length
                  }
                </div>
              </div>
              <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-200">
                <div className="text-xs text-blue-800 font-semibold">Izin</div>
                <div className="text-2xl font-bold text-blue-900 mt-0.5">
                  {
                    homeroomStudents.filter(
                      (s) => s.attendances[0]?.status === "IZIN"
                    ).length
                  }
                </div>
              </div>
              <div className="p-3.5 bg-purple-50 rounded-xl border border-purple-200">
                <div className="text-xs text-purple-800 font-semibold">Sakit</div>
                <div className="text-2xl font-bold text-purple-900 mt-0.5">
                  {
                    homeroomStudents.filter(
                      (s) => s.attendances[0]?.status === "SAKIT"
                    ).length
                  }
                </div>
              </div>
              <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200">
                <div className="text-xs text-rose-800 font-semibold">Belum / Alfa</div>
                <div className="text-2xl font-bold text-rose-900 mt-0.5">
                  {
                    homeroomStudents.filter(
                      (s) => !s.attendances[0] || s.attendances[0]?.status === "ALFA"
                    ).length
                  }
                </div>
              </div>
            </div>

            {/* Tabel Siswa Kelas */}
            <div className="hidden xl:block overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3.5">NIS</th>
                    <th className="py-3 px-3.5">Nama Siswa</th>
                    <th className="py-3 px-3.5">Waktu Masuk</th>
                    <th className="py-3 px-3.5">Status</th>
                    <th className="py-3 px-3.5">Keterangan / Menit Telat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {homeroomStudents.map((s) => {
                    const att = s.attendances[0];
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3.5 font-mono text-slate-700 font-medium">{s.nis}</td>
                        <td className="py-3 px-3.5 font-semibold text-slate-900">{s.name}</td>
                        <td className="py-3 px-3.5 text-slate-600 font-mono">
                          {att?.checkInAt
                            ? new Date(att.checkInAt).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                        </td>
                        <td className="py-3 px-3.5">
                          <StatusBadge status={att?.status || "BELUM_SCAN"} size="sm" />
                        </td>
                        <td className="py-3 px-3.5 text-slate-700">
                          {att?.lateMinutes ? `${att.lateMinutes} menit terlambat` : att?.notes || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Kartu mobile siswa wali kelas */}
            <div className="xl:hidden divide-y divide-slate-200 rounded-xl border border-slate-200 overflow-hidden">
              {homeroomStudents.map((s) => {
                const att = s.attendances[0];
                return (
                  <div key={s.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">{s.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">NIS: {s.nis}</div>
                      </div>
                      <StatusBadge status={att?.status || "BELUM_SCAN"} size="sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Waktu Masuk</div>
                        <div className="text-slate-600 font-mono">
                          {att?.checkInAt
                            ? new Date(att.checkInAt).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Keterangan</div>
                        <div className="text-slate-700">
                          {att?.lateMinutes ? `${att.lateMinutes} menit terlambat` : att?.notes || "-"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* RINGKASAN KEHADIRAN HARI INI (ADMIN & SUPERADMIN) */}
        {(user.role === "SUPERADMIN" || user.role === "ADMIN") && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              {/* Total Siswa */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
                <div className="flex items-center justify-between text-slate-600 mb-1">
                  <span className="text-xs font-semibold">Total Siswa</span>
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Users className="w-4 h-4 text-slate-600" aria-hidden="true" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{totalStudents}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Siswa aktif terdaftar</div>
              </div>

              {/* Hadir Tepat */}
              <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-2xs">
                <div className="flex items-center justify-between text-emerald-800 mb-1">
                  <span className="text-xs font-semibold">Hadir Tepat</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-emerald-800 mt-1">{countHadir}</div>
                <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                  {totalStudents > 0 ? `${Math.round((countHadir / totalStudents) * 100)}% dari total` : "0%"}
                </div>
              </div>

              {/* Terlambat */}
              <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs">
                <div className="flex items-center justify-between text-amber-800 mb-1">
                  <span className="text-xs font-semibold">Terlambat</span>
                  <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-amber-700" aria-hidden="true" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-amber-800 mt-1">{countTerlambat}</div>
                <div className="text-[11px] text-amber-700 font-medium mt-0.5">Lewat batas jam masuk</div>
              </div>

              {/* Izin & Sakit */}
              <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-2xs">
                <div className="flex items-center justify-between text-blue-800 mb-1">
                  <span className="text-xs font-semibold">Izin & Sakit</span>
                  <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-700" aria-hidden="true" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-blue-800 mt-1">{countIzin + countSakit}</div>
                <div className="text-[11px] text-blue-700 font-medium mt-0.5">
                  Izin: {countIzin} • Sakit: {countSakit}
                </div>
              </div>

              {/* Belum Scan */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
                <div className="flex items-center justify-between text-slate-600 mb-1">
                  <span className="text-xs font-semibold">Belum Scan</span>
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                    <UserX className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-slate-800 mt-1">{countBelumScan}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Belum ada catatan hari ini</div>
              </div>

              {/* Alfa */}
              <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-2xs">
                <div className="flex items-center justify-between text-rose-800 mb-1">
                  <span className="text-xs font-semibold">Alfa</span>
                  <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-rose-700" aria-hidden="true" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-rose-800 mt-1">{countAlfa}</div>
                <div className="text-[11px] text-rose-700 font-medium mt-0.5">Tanpa keterangan</div>
              </div>
            </div>

            {/* GRID DUA KOLOM: FEED SCAN TERBARU & TINGKAT KEHADIRAN KELAS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Scan Terkini */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Aktivitas Scan Terkini</h3>
                    <p className="text-xs text-slate-500">Daftar presensi terbaru yang terekam masuk hari ini</p>
                  </div>
                  <Link
                    href="/presensi"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline transition"
                  >
                    <span>Lihat Semua</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                </div>

                {recentScans.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Belum ada presensi yang terekam hari ini. Buka Scanner QR untuk memulai pemindaian.
                  </div>
                ) : (
                  <>
                  <div className="hidden xl:block overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">Siswa</th>
                          <th className="py-2.5 px-3">Kelas</th>
                          <th className="py-2.5 px-3">Waktu</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Petugas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {recentScans.map((scan) => (
                          <tr key={scan.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {scan.student.name}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 font-medium">
                              {scan.student.class.name}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 font-mono">
                              {scan.checkInAt
                                ? new Date(scan.checkInAt).toLocaleTimeString("id-ID", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "-"}
                            </td>
                            <td className="py-2.5 px-3">
                              <StatusBadge status={scan.status} size="sm" />
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 truncate max-w-[100px]">
                              {scan.createdBy?.name || "Scanner"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Kartu mobile scan terbaru */}
                  <div className="xl:hidden divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                    {recentScans.map((scan) => (
                      <div key={scan.id} className="p-3.5 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">{scan.student.name}</div>
                            <div className="text-[11px] text-slate-500">Kelas {scan.student.class.name}</div>
                          </div>
                          <StatusBadge status={scan.status} size="sm" />
                        </div>
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span className="font-mono">
                            {scan.checkInAt
                              ? new Date(scan.checkInAt).toLocaleTimeString("id-ID", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "-"}
                          </span>
                          <span className="truncate max-w-[55%]">Petugas: {scan.createdBy?.name || "Scanner"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  </>
                )}
              </div>

              {/* Rekap per Kelas */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Kehadiran per Kelas</h3>
                    <p className="text-xs text-slate-500">Tingkat kehadiran siswa per kelas hari ini</p>
                  </div>
                  <Link
                    href="/kelas"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline transition"
                  >
                    <span>Kelola Kelas</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                </div>

                <div className="hidden xl:block overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Kelas</th>
                        <th className="py-2.5 px-3">Wali Kelas</th>
                        <th className="py-2.5 px-3 text-center">Total</th>
                        <th className="py-2.5 px-3 text-center">Hadir</th>
                        <th className="py-2.5 px-3 text-right">Persentase</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {classes.map((cls) => {
                        const total = cls.students.length;
                        const present = cls.students.filter(
                          (s) =>
                            s.attendances[0]?.status === "HADIR" ||
                            s.attendances[0]?.status === "TERLAMBAT"
                        ).length;
                        const percent = total > 0 ? Math.round((present / total) * 100) : 0;

                        return (
                          <tr key={cls.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {cls.name}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 truncate max-w-[130px]">
                              {cls.homeroom?.name || "-"}
                            </td>
                            <td className="py-2.5 px-3 text-center font-medium text-slate-700">
                              {total}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-emerald-800">
                              {present}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                                percent >= 90
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                  : percent >= 75
                                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                                  : "bg-rose-50 text-rose-800 border border-rose-200"
                              }`}>
                                {percent}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Kartu mobile kehadiran per kelas */}
                <div className="xl:hidden divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                  {classes.map((cls) => {
                    const total = cls.students.length;
                    const present = cls.students.filter(
                      (s) =>
                        s.attendances[0]?.status === "HADIR" ||
                        s.attendances[0]?.status === "TERLAMBAT"
                    ).length;
                    const percent = total > 0 ? Math.round((present / total) * 100) : 0;
                    return (
                      <div key={cls.id} className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900">{cls.name}</div>
                            <div className="text-[11px] text-slate-500 truncate">
                              Wali: {cls.homeroom?.name || "-"}
                            </div>
                          </div>
                          <span className={`shrink-0 inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            percent >= 90
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : percent >= 75
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-rose-50 text-rose-800 border border-rose-200"
                          }`}>
                            {percent}%
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total Siswa</div>
                            <div className="font-medium text-slate-700">{total}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Hadir</div>
                            <div className="font-bold text-emerald-800">{present}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* PERINGATAN: ALFA BERUNTUN & REKAP KETERLAMBATAN */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Alfa Beruntun */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                  Perhatian Khusus
                </span>
                <h2 className="text-base font-bold text-slate-900 mt-0.5">
                  Siswa Alfa Beruntun
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Tidak hadir {ALFA_BERUNTUN_MIN_HARI}+ hari efektif berturut-turut tanpa keterangan resmi.
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <UserX className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>

            {alfaBeruntun.length === 0 ? (
              <div className="mt-4 p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>Tidak ada siswa dengan alfa beruntun. Seluruh siswa terpantau hadir atau berizin.</span>
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100 max-h-64 overflow-y-auto custom-scrollbar">
                {alfaBeruntun.map((s) => (
                  <li key={s.studentId} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{s.name}</p>
                      <p className="text-[11px] text-slate-500">
                        Kelas {s.className} • NIS {s.nis} • Sejak {s.sejak}
                      </p>
                    </div>
                    <span className="shrink-0 px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-300 text-xs font-bold">
                      {s.hari} Hari Alfa
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Rekap Keterlambatan */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                  Bulan {new Intl.DateTimeFormat("id-ID", { month: "long", timeZone: "Asia/Jakarta" }).format(today)}
                </span>
                <h2 className="text-base font-bold text-slate-900 mt-0.5">
                  Akumulasi Keterlambatan
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Siswa dengan total keterlambatan {REKAP_TELAMBAT_MIN_MENIT}+ menit selama bulan berjalan.
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>

            {rekapKeterlambatan.length === 0 ? (
              <div className="mt-4 p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>Belum ada akumulasi keterlambatan yang melewati ambang batas.</span>
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100 max-h-64 overflow-y-auto custom-scrollbar">
                {rekapKeterlambatan.map((s) => (
                  <li key={s.studentId} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{s.name}</p>
                      <p className="text-[11px] text-slate-500">
                        Kelas {s.className} • {s.jumlahTerlambat}x terlambat
                      </p>
                    </div>
                    <span className="shrink-0 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold">
                      {s.totalMenit} Menit
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
