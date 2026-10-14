const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

type Row = {
  studentId: string;
  nis: string;
  nisn: string;
  name: string;
  className: string;
  codes: Record<string, string>;
  counts: { H: number; S: number; I: number; A: number; total: number };
  persen: number;
  waktu: string | null;
  statusLabel: string;
  statusRaw: string | null;
  catatan: string | null;
  lateMinutes: number;
  rekomendasi: string | null;
  kelayakan: string | null;
};

type MatrixDay = {
  iso: string;
  label: string;
  short: string;
  tanggal: number;
  isHoliday: boolean;
  holidayDescription?: string;
};

type Period = {
  label: string;
  termName: string;
  start: string;
  end: string;
  startPanjang: string;
  endPanjang: string;
  totalHariEfektif: number;
  lockTime: string;
};

interface ReportDocProps {
  setting: any;
  user: any;
  reportType: "HARIAN" | "MINGGUAN" | "BULANAN" | "SEMESTER";
  period: Period;
  matrixDays: MatrixDay[];
  classSections: { classId: string | null; className: string; rows: Row[] }[];
  scopeLabel: string;
  ambang: {
    gradeExcellentMin: number;
    gradeGoodMin: number;
    gradeWarningMin: number;
    gradeCallParentMin: number;
    semesterEligibleMin: number;
  };
}

const thBase =
  "py-2 px-2 border-r border-slate-300 text-center font-bold";
const tdBase = "py-1.5 px-2 border-r border-slate-300";

function formatPersen(n: number) {
  return `${n.toFixed(1).replace(".", ",")}%`;
}

function warnaKode(kode: string) {
  switch (kode) {
    case "H":
      return "text-emerald-700 font-bold";
    case "S":
      return "text-purple-700 font-bold";
    case "I":
      return "text-blue-700 font-bold";
    case "A":
      return "text-rose-700 font-bold";
    case "L":
      return "text-slate-400 font-medium";
    default:
      return "text-slate-300";
  }
}

function warnaPersen(p: number, ambang: any, type: "BULANAN" | "SEMESTER") {
  if (type === "SEMESTER") {
    return p >= ambang.semesterEligibleMin
      ? "text-emerald-700 font-bold"
      : "text-rose-700 font-bold";
  }
  if (p >= ambang.gradeExcellentMin) return "text-emerald-700 font-bold";
  if (p >= ambang.gradeGoodMin) return "text-blue-700 font-semibold";
  if (p >= ambang.gradeWarningMin) return "text-amber-700 font-semibold";
  return "text-rose-700 font-bold";
}

/* ------------------------------------------------------------------ */
/* Kop laporan                                                        */
/* ------------------------------------------------------------------ */
function Kop({ setting, reportType, period, scopeLabel }: any) {
  const judulMap: Record<string, string> = {
    HARIAN: "LAPORAN PRESENSI HARIAN (REAL-TIME)",
    MINGGUAN: "LAPORAN PRESENSI MINGGUAN",
    BULANAN: "LAPORAN EVALUASI KEHADIRAN BULANAN",
    SEMESTER: "LAPORAN REKAPITULASI KEHADIRAN SEMESTER",
  };
  const judul = judulMap[reportType] || judulMap.SEMESTER;

  return (
    <div className="text-center border-b-2 border-slate-900 pb-3">
      <h2 className="text-base font-bold uppercase tracking-wider text-slate-900">
        {setting?.schoolName || "SMP NEGERI 1 CERDAS BANGSA"}
      </h2>
      <p className="text-[10px] text-slate-500">
        {setting?.address || "Jl. Pendidikan No. 45, Jakarta Pusat"}{" "}
        {setting?.phone ? `• Telp: ${setting.phone}` : ""}{" "}
        {setting?.npsn ? `• NPSN: ${setting.npsn}` : ""}
      </p>
      <h3 className="text-xs font-bold text-slate-900 mt-2 underline">{judul}</h3>
      <p className="text-[11px] text-slate-700 mt-1 font-semibold">{scopeLabel}</p>
      <p className="text-[11px] text-slate-600 mt-0.5">Periode: {period.label}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tanda tangan                                                       */
/* ------------------------------------------------------------------ */
function TandaTangan({ setting, user }: any) {
  return (
    <div className="pt-8 flex justify-between text-[11px] text-slate-700 break-inside-avoid">
      <div className="text-center w-48">
        <p>Mengetahui,</p>
        <p className="font-semibold">Kepala Sekolah</p>
        <div className="h-14" />
        <p className="font-bold underline">
          {setting?.principalName || "Dr. H. Bambang, M.Pd."}
        </p>
        <p className="text-[10px] text-slate-500">
          NIP. {setting?.principalNip || "197001011995011001"}
        </p>
      </div>
      <div className="text-center w-48">
        <p>{user?.role === "GURU" ? "Wali Kelas," : "Petugas Rekapitulasi,"}</p>
        <p className="font-semibold">{user?.name}</p>
        <div className="h-14" />
        <p className="font-bold underline">{user?.name}</p>
        <p className="text-[10px] text-slate-500">
          {user?.role === "GURU" ? "Wali Kelas" : "Staf Tata Usaha"}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Laporan Harian                                                     */
/* ------------------------------------------------------------------ */
function LaporanHarian({ section, period, idx }: any) {
  const { rows } = section;
  return (
    <div className="mb-6 break-inside-avoid">
      {section.className !== "Semua Kelas" && (
        <h4 className="text-[11px] font-bold text-slate-800 mb-1">
          Kelas {section.className}
        </h4>
      )}
      {rows.length === 0 ? (
        <p className="text-[11px] text-slate-400 py-4">Tidak ada siswa pada kelas ini.</p>
      ) : (
        <table className="w-full text-[11px] border border-slate-300">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className={`${thBase} w-8`}>No</th>
              <th className={`${thBase} w-24`}>NISN</th>
              <th className={`${thBase} text-left`}>Nama Siswa</th>
              <th className={`${thBase} w-24`}>Status Kehadiran</th>
              <th className={`${thBase} w-24`}>Waktu Absen</th>
              <th className="py-2 px-2 text-left font-bold">Keterangan / Catatan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: Row, i: number) => {
              const kode = r.codes[period.start];
              const tanpaRecord = r.statusRaw === "TIDAK_ADA_RECORD";
              return (
                <tr key={r.studentId}>
                  <td className={`${tdBase} text-center`}>{i + 1}</td>
                  <td className={`${tdBase} text-center font-mono`}>{r.nisn}</td>
                  <td className={`${tdBase} text-left font-medium`}>{r.name}</td>
                  <td className={`${tdBase} text-center font-semibold ${warnaKode(kode)}`}>
                    {r.statusLabel}
                  </td>
                  <td className={`${tdBase} text-center font-mono`}>
                    {r.waktu || "-"}
                  </td>
                  <td className="py-1.5 px-2 text-slate-600">
                    {r.catatan ||
                      (r.lateMinutes > 0
                        ? `Terlambat ${r.lateMinutes} menit (batas ${period.lockTime})`
                        : tanpaRecord
                          ? "Tidak ada konfirmasi kehadiran"
                          : kode === "H"
                            ? "Datang tepat waktu"
                            : "-")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Laporan Mingguan (Matrix Checklist)                                */
/* ------------------------------------------------------------------ */
function LaporanMingguan({ section, matrixDays, period }: any) {
  const { rows } = section;
  const hariEfektif = matrixDays.filter((d: MatrixDay) => !d.isHoliday);

  return (
    <div className="mb-6">
      <h4 className="text-[11px] font-bold text-slate-800 mb-1">
        {section.className !== "Semua Kelas" ? `Kelas ${section.className}` : "Rekap mingguan"} —{" "}
        {periodeRingkas(period)}
      </h4>
      {rows.length === 0 ? (
        <p className="text-[11px] text-slate-400 py-3">Tidak ada siswa pada kelas ini.</p>
      ) : (
        <table className="w-full text-[11px] border border-slate-300">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className={`${thBase} w-8`}>No</th>
              <th className="py-2 px-2 border-r border-slate-300 text-left font-bold">
                Nama Siswa
              </th>
              {matrixDays.map((d: MatrixDay) => (
                <th key={d.iso} className={`${thBase} w-12`} title={d.iso}>
                  {d.short}
                  <span className="block text-[9px] font-normal text-slate-500">
                    {d.tanggal}
                    {d.isHoliday ? " • L" : ""}
                  </span>
                </th>
              ))}
              <th className={`${thBase} w-8 bg-slate-200`}>H</th>
              <th className={`${thBase} w-8 bg-slate-200`}>S</th>
              <th className={`${thBase} w-8 bg-slate-200`}>I</th>
              <th className="py-2 px-2 text-center font-bold bg-slate-200">A</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: Row, i: number) => (
              <tr key={r.studentId}>
                <td className={`${tdBase} text-center`}>{i + 1}</td>
                <td className={`${tdBase} text-left font-medium`}>{r.name}</td>
                {matrixDays.map((d: MatrixDay) => (
                  <td
                    key={d.iso}
                    className={`${tdBase} text-center ${warnaKode(r.codes[d.iso] || "-")}`}
                  >
                    {r.codes[d.iso] || "-"}
                  </td>
                ))}
                <td className="py-1.5 px-2 border-r border-slate-300 text-center font-bold text-emerald-700">
                  {r.counts.H}
                </td>
                <td className="py-1.5 px-2 border-r border-slate-300 text-center text-purple-700">
                  {r.counts.S}
                </td>
                <td className="py-1.5 px-2 border-r border-slate-300 text-center text-blue-700">
                  {r.counts.I}
                </td>
                <td className="py-1.5 px-2 text-center font-bold text-rose-700">
                  {r.counts.A}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-[10px] text-slate-500 mt-1">
        Keterangan: H = Hadir · S = Sakit · I = Izin · A = Alfa · L = Libur. Total hari
        efektif pekan ini: <strong>{hariEfektif.length} hari</strong>.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Laporan Bulanan                                                    */
/* ------------------------------------------------------------------ */
function LaporanBulanan({ section, period, idx, ambang }: any) {
  const { rows } = section;
  return (
    <div className="mb-6">
      {section.className !== "Semua Kelas" && (
        <h4 className="text-[11px] font-bold text-slate-800 mb-1">
          Kelas {section.className}
        </h4>
      )}
      {rows.length === 0 ? (
        <p className="text-[11px] text-slate-400 py-3">Tidak ada siswa pada kelas ini.</p>
      ) : (
        <table className="w-full text-[11px] border border-slate-300">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className={`${thBase} w-8`}>No</th>
              <th className="py-2 px-2 border-r border-slate-300 text-left font-bold">
                Nama Siswa
              </th>
              <th className={`${thBase} w-14`}>Hadir (H)</th>
              <th className={`${thBase} w-14`}>Sakit (S)</th>
              <th className={`${thBase} w-14`}>Izin (I)</th>
              <th className={`${thBase} w-14`}>Alpa (A)</th>
              <th className={`${thBase} w-20`}>% Kehadiran</th>
              <th className="py-2 px-2 text-left font-bold">Status / Rekomendasi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: Row, i: number) => (
              <tr key={r.studentId}>
                <td className={`${tdBase} text-center`}>{i + 1}</td>
                <td className={`${tdBase} text-left font-medium`}>{r.name}</td>
                <td className={`${tdBase} text-center font-bold text-emerald-700`}>
                  {r.counts.H}
                </td>
                <td className={`${tdBase} text-center text-purple-700`}>{r.counts.S}</td>
                <td className={`${tdBase} text-center text-blue-700`}>{r.counts.I}</td>
                <td className={`${tdBase} text-center font-bold text-rose-700`}>
                  {r.counts.A}
                </td>
                <td
                  className={`${tdBase} text-center ${warnaPersen(
                    r.persen,
                    ambang,
                    "BULANAN"
                  )}`}
                >
                  {formatPersen(r.persen)}
                </td>
                <td className="py-1.5 px-2 text-slate-700">{r.rekomendasi}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {idx === 0 && (
        <p className="text-[10px] text-slate-500 mt-1.5">
          Total Hari Efektif: <strong>{period.totalHariEfektif} hari</strong>.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Laporan Semester                                                   */
/* ------------------------------------------------------------------ */
function LaporanSemester({ section, period, idx, ambang }: any) {
  const { rows } = section;
  return (
    <div className="mb-6">
      {section.className !== "Semua Kelas" && (
        <h4 className="text-[11px] font-bold text-slate-800 mb-1">
          Kelas {section.className}
        </h4>
      )}
      {rows.length === 0 ? (
        <p className="text-[11px] text-slate-400 py-3">Tidak ada siswa pada kelas ini.</p>
      ) : (
        <table className="w-full text-[11px] border border-slate-300">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className={`${thBase} w-8`}>No</th>
              <th className="py-2 px-2 border-r border-slate-300 text-left font-bold">
                Nama Siswa
              </th>
              <th className={`${thBase} w-14`}>Total H</th>
              <th className={`${thBase} w-14`}>Total S</th>
              <th className={`${thBase} w-14`}>Total I</th>
              <th className={`${thBase} w-14`}>Total A</th>
              <th className={`${thBase} w-20`}>% Akumulasi</th>
              <th className="py-2 px-2 text-left font-bold">Status Kelayakan Ujian</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: Row, i: number) => (
              <tr key={r.studentId}>
                <td className={`${tdBase} text-center`}>{i + 1}</td>
                <td className={`${tdBase} text-left font-medium`}>{r.name}</td>
                <td className={`${tdBase} text-center font-bold text-emerald-700`}>
                  {r.counts.H}
                </td>
                <td className={`${tdBase} text-center text-purple-700`}>{r.counts.S}</td>
                <td className={`${tdBase} text-center text-blue-700`}>{r.counts.I}</td>
                <td className={`${tdBase} text-center font-bold text-rose-700`}>
                  {r.counts.A}
                </td>
                <td
                  className={`${tdBase} text-center ${warnaPersen(
                    r.persen,
                    ambang,
                    "SEMESTER"
                  )}`}
                >
                  {formatPersen(r.persen)}
                </td>
                <td className="py-1.5 px-2 font-semibold text-slate-700">
                  {r.kelayakan}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {idx === 0 && (
        <p className="text-[10px] text-slate-500 mt-1.5">
          Total Hari Efektif: <strong>{period.totalHariEfektif} hari</strong>.
        </p>
      )}
    </div>
  );
}

function periodeRingkas(period: Period) {
  return `${period.startPanjang} s/d ${period.endPanjang}`;
}

export default function ReportDocument({
  setting,
  user,
  reportType,
  period,
  matrixDays,
  classSections,
  scopeLabel,
  ambang,
}: ReportDocProps) {
  const totalRows = classSections.reduce((acc, s) => acc + s.rows.length, 0);

  return (
    <div className="space-y-1">
      <Kop setting={setting} reportType={reportType} period={period} scopeLabel={scopeLabel} />

      {totalRows === 0 ? (
        <p className="text-[11px] text-slate-400 py-8 text-center">
          Tidak ada data siswa yang sesuai pada periode ini.
        </p>
      ) : (
        classSections.map((section, i) => {
          if (reportType === "HARIAN") {
            return (
              <LaporanHarian
                key={section.classId || i}
                section={section}
                period={period}
                idx={i}
              />
            );
          }
          if (reportType === "MINGGUAN") {
            return (
              <LaporanMingguan
                key={section.classId || i}
                section={section}
                matrixDays={matrixDays}
                period={period}
              />
            );
          }
          if (reportType === "BULANAN") {
            return (
              <LaporanBulanan
                key={section.classId || i}
                section={section}
                period={period}
                idx={i}
                ambang={ambang}
              />
            );
          }
          return (
            <LaporanSemester
              key={section.classId || i}
              section={section}
              period={period}
              idx={i}
              ambang={ambang}
            />
          );
        })
      )}

      {reportType === "HARIAN" && (
        <p className="text-[10px] text-slate-500 pt-1">
          Waktu Kunci Sistem: <strong>{period.lockTime} WIB</strong>. Scan setelah waktu
          tersebut tercatat sebagai terlambat dan tetap dihitung sebagai hadir.
        </p>
      )}

      <TandaTangan setting={setting} user={user} />
    </div>
  );
}
