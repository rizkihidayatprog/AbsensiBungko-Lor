import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { parseLocalDate } from "@/lib/date";
import {
  ReportType,
  AbsensiRecord,
  HariEfektif,
  hitungHariEfektif,
  toLocalDate,
  toIso,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  kodeStatus,
  labelStatus,
  hitungKosong,
  tambahHitungan,
  persentaseKehadiran,
  labelRekomendasi,
  labelKelayakan,
  NAMA_HARI,
  NAMA_HARI_SINGKAT,
  AmbangNilai,
} from "@/lib/report";

function formatTanggalPanjang(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(d);
}

function formatTanggalPendek(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(d);
}

function escapeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function buildXlsx(p: {
  reportType: string;
  periodLabel: string;
  lockTime: string;
  matrixDays: { iso: string; short: string; tanggal: number; isHoliday: boolean }[];
  classSections: any[];
  totalHariEfektif: number;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Laporan Presensi");

  const isHarian = p.reportType === "HARIAN";

  const headers: string[] = isHarian
    ? ["NIS", "NISN", "Nama Siswa", "Kelas", "Waktu", "Status", "Catatan"]
    : [
        "NIS",
        "NISN",
        "Nama Siswa",
        "Kelas",
        ...p.matrixDays.map((d) => `${d.short} ${d.tanggal}`),
        "H",
        "S",
        "I",
        "A",
        "Hadir (%)",
      ];

  if (p.reportType === "BULANAN") headers.push("Rekomendasi");
  if (p.reportType === "SEMESTER") headers.push("Kelayakan");

  const baseWidths: Record<string, number> = {
    NIS: 12,
    NISN: 12,
    "Nama Siswa": 28,
    Kelas: 16,
    Waktu: 10,
    Status: 14,
    Catatan: 30,
    "Hadir (%)": 12,
    Rekomendasi: 22,
    Kelayakan: 22,
  };
  ws.columns = headers.map((h) => ({
    key: h,
    width: baseWidths[h] ?? 6.5,
  }));

  const title = `Laporan Presensi ${p.reportType === "SEMESTER" ? "Semester" : p.reportType === "BULANAN" ? "Bulanan" : p.reportType === "MINGGUAN" ? "Mingguan" : "Harian"}`;
  ws.mergeCells(1, 1, 1, headers.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `${title} - ${p.periodLabel}`;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF1E293B" } };
  titleCell.alignment = { vertical: "middle" };
  ws.getRow(1).height = 26;

  const headerRow = ws.getRow(2);
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
  });
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
  });
  headerRow.height = 22;
  ws.views = [{ state: "frozen", ySplit: 2 }];

  const thin = { style: "thin" } as const;
  const border = { top: thin, left: thin, bottom: thin, right: thin };

  const centerCell = (cell: ExcelJS.Cell) => {
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = border;
  };
  const leftCell = (cell: ExcelJS.Cell) => {
    cell.alignment = { horizontal: "left", vertical: "middle" };
    cell.border = border;
  };

  let rowIdx = 3;
  p.classSections.forEach((section: any) => {
    const sectionRow = ws.getRow(rowIdx);
    ws.mergeCells(rowIdx, 1, rowIdx, headers.length);
    const sc = ws.getCell(rowIdx, 1);
    sc.value = `Kelas ${section.className}`;
    sc.font = { bold: true, color: { argb: "FF3730A3" } };
    sc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" } };
    sc.alignment = { vertical: "middle" };
    sectionRow.height = 20;
    rowIdx += 1;

    section.rows.forEach((r: any) => {
      const base = [r.nis ?? "", r.nisn ?? "", r.name ?? "", r.className ?? ""];
      let cells: (string | number)[];
      if (isHarian) {
        cells = [r.waktu || "-", r.statusLabel || "-", r.catatan || "-"];
      } else {
        cells = p.matrixDays.map((d) => {
          const v = r.codes ? r.codes[d.iso] : undefined;
          if (v) return v;
          return d.isHoliday ? "L" : "-";
        });
        cells = [...cells, r.counts?.H ?? 0, r.counts?.S ?? 0, r.counts?.I ?? 0, r.counts?.A ?? 0, r.persen ?? 0];
        if (p.reportType === "BULANAN") cells.push(r.rekomendasi ? r.rekomendasi.label : "-");
        if (p.reportType === "SEMESTER") cells.push(r.kelayakan ? r.kelayakan.label : "-");
      }
      const values = [...base, ...cells];
      const row = ws.getRow(rowIdx);
      values.forEach((v, i) => row.getCell(i + 1).value = v);

      leftCell(row.getCell(1));
      leftCell(row.getCell(2));
      leftCell(row.getCell(3));
      leftCell(row.getCell(4));
      for (let i = 5; i <= headers.length; i++) centerCell(row.getCell(i));
      rowIdx += 1;
    });
  });

  const lastRow = rowIdx - 1;
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: lastRow, column: headers.length } };

  const summaryStart = lastRow + 1;
  const summaryLabel = ws.getCell(summaryStart, 1);
  summaryLabel.value = "Keterangan:";
  summaryLabel.font = { bold: true, color: { argb: "FF1E293B" } };
  const legend = p.reportType === "HARIAN"
    ? "H = Hadir, T = Terlambat, I = Izin, S = Sakit, A = Alfa, L = Libur, - = Belum berjalan"
    : `H = Hadir, S = Sakit, I = Izin, A = Alfa, L = Libur, - = Belum berjalan (total hari efektif periode: ${p.totalHariEfektif} hari, batas presensi: ${p.lockTime})`;
  const legendCell = ws.getCell(summaryStart, 2);
  legendCell.value = legend;
  legendCell.font = { color: { argb: "FF64748B" }, italic: true };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const reportType = (searchParams.get("type") || "HARIAN").toUpperCase() as ReportType;
    const dateParam = searchParams.get("date");
    const monthParam = searchParams.get("month");
    const termIdParam = searchParams.get("termId");
    const classIdParam = searchParams.get("classId");
    const allClasses = searchParams.get("all") === "1";

    if (!["HARIAN", "MINGGUAN", "BULANAN", "SEMESTER"].includes(reportType)) {
      return NextResponse.json({ success: false, message: "Jenis laporan tidak dikenal." }, { status: 400 });
    }

    // ------------------------------------------------------------------
    // 1. Tentukan rentang periode
    // ------------------------------------------------------------------
    let periodStart: Date;
    let periodEnd: Date;
    let periodLabel = "";
    let termName = "";

    if (reportType === "SEMESTER") {
      if (!termIdParam) {
        return NextResponse.json(
          { success: false, message: "Pilih semester terlebih dahulu." },
          { status: 400 }
        );
      }
      const term = await prisma.academicTerm.findUnique({
        where: { id: termIdParam },
      });
      if (!term) {
        return NextResponse.json(
          { success: false, message: "Semester tidak ditemukan." },
          { status: 404 }
        );
      }
      periodStart = toLocalDate(term.startDate);
      periodEnd = toLocalDate(term.endDate);
      termName = term.name;
      periodLabel = term.name;
    } else {
      const base = dateParam ? parseLocalDate(dateParam) : new Date();

      if (reportType === "HARIAN") {
        periodStart = toLocalDate(base);
        periodEnd = periodStart;
        periodLabel = formatTanggalPanjang(periodStart);
      } else if (reportType === "MINGGUAN") {
        periodStart = startOfWeek(base);
        periodEnd = addDays(periodStart, 6);
        periodLabel = `${formatTanggalPendek(periodStart)} s/d ${formatTanggalPendek(periodEnd)}`;
      } else {
        // BULANAN
        let base2 = base;
        if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
          const [y, m] = monthParam.split("-").map(Number);
          base2 = new Date(Date.UTC(y, m - 1, 1));
        }
        periodStart = startOfMonth(base2);
        periodEnd = endOfMonth(base2);
        periodLabel = new Intl.DateTimeFormat("id-ID", {
          month: "long",
          year: "numeric",
          timeZone: "Asia/Jakarta",
        }).format(periodStart);
      }
    }

    // ------------------------------------------------------------------
    // 2. Pengaturan sekolah, hari libur & hari efektif
    // ------------------------------------------------------------------
    const [settings, holidayList] = await Promise.all([
      prisma.schoolSetting.findFirst({ where: { id: 1 } }),
      prisma.holiday.findMany({
        where: { date: { gte: periodStart, lte: periodEnd } },
      }),
    ]);

    const holidayDates = new Set(holidayList.map((h) => toIso(toLocalDate(h.date))));
    const holidayDesc = new Map(
      holidayList.map((h) => [toIso(toLocalDate(h.date)), h.description])
    );

    const hariEfektifAll = hitungHariEfektif(
      periodStart,
      periodEnd,
      settings?.activeDays || "1,2,3,4,5",
      holidayDates
    );
    const hariEfektif = hariEfektifAll;
    const ambang: AmbangNilai = {
      gradeExcellentMin: settings?.gradeExcellentMin ?? 95,
      gradeGoodMin: settings?.gradeGoodMin ?? 90,
      gradeWarningMin: settings?.gradeWarningMin ?? 80,
      gradeCallParentMin: settings?.gradeCallParentMin ?? 70,
      semesterEligibleMin: settings?.semesterEligibleMin ?? 90,
    };

    // ------------------------------------------------------------------
    // 3. Scope kelas sesuai role (GURU = kelas perwaliannya)
    // ------------------------------------------------------------------
    let filterClassId: string | undefined = undefined;

    if (sessionUser.role === "GURU") {
      const teacher = await prisma.teacher.findUnique({
        where: { id: sessionUser.teacherId || "" },
        include: { homeroomClass: true },
      });
      if (!teacher?.homeroomClass) {
        return NextResponse.json({ success: true, classSections: [] });
      }
      filterClassId = teacher.homeroomClass.id;
    } else if (!allClasses && classIdParam) {
      filterClassId = classIdParam;
    }

    // ------------------------------------------------------------------
    // 4. Ambil roster siswa & data presensi pada periode
    // ------------------------------------------------------------------
    const students = await prisma.student.findMany({
      where: {
        ...(filterClassId ? { classId: filterClassId } : {}),
        isActive: true,
      },
      include: { class: { select: { id: true, name: true } } },
      orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
    });

    const attendances = await prisma.studentAttendance.findMany({
      where: {
        attendanceDate: { gte: periodStart, lte: periodEnd },
      },
      include: {
        student: { include: { class: { select: { id: true, name: true } } } },
      },
    });

    // Batas mulai perhitungan: hari efektif sebelum sistem mulai dipakai tidak
    // boleh dihitung sebagai Alfa, jika akan menghasilkan persentase yang tidak
    // masuk akal (mis. 0,9%) pada instalasi baru.
    const firstRecord = await prisma.studentAttendance.findFirst({
      where: {},
      orderBy: { attendanceDate: "asc" },
      select: { attendanceDate: true },
    });
    const firstIso = firstRecord ? toIso(toLocalDate(firstRecord.attendanceDate)) : null;
    const hitungDari = firstIso && firstIso > toIso(periodStart) ? firstIso : toIso(periodStart);

    // ------------------------------------------------------------
    // Total hari efektif periode ini (untuk judul laporan) dan total hari
    // efektif yang sudah berjalan (sebagai pembagi persentase). Membagi dengan
    // hari yang belum terjadi akan membuat persentase selalu terlihat kecil
    // di tengah periode.
    // ------------------------------------------------------------
    const hariIni = toIso(toLocalDate(new Date()));
    const totalHariEfektif = hariEfektif.filter(
      (h) => !h.isHoliday && h.iso >= hitungDari
    ).length;
    const hariBerjalan = hariEfektif.filter(
      (h) => !h.isHoliday && h.iso >= hitungDari && h.iso <= hariIni
    ).length;
    const pembagiPersen = hariBerjalan > 0 ? hariBerjalan : totalHariEfektif;

    // Index cepat: studentId -> (isoTanggal -> record)
    const recordMap = new Map<string, Map<string, AbsensiRecord>>();
    attendances.forEach((a) => {
      const iso = toIso(toLocalDate(a.attendanceDate));
      let inner = recordMap.get(a.studentId);
      if (!inner) {
        inner = new Map();
        recordMap.set(a.studentId, inner);
      }
      inner.set(iso, {
        id: a.id,
        studentId: a.studentId,
        attendanceDate: a.attendanceDate,
        checkInAt: a.checkInAt,
        checkOutAt: a.checkOutAt,
        status: a.status,
        lateMinutes: a.lateMinutes,
        notes: a.notes,
      });
    });

    const lockTime = settings?.checkInEnd || "07:15";

    // ------------------------------------------------------------------
    // 5. Susun seksi per kelas
    // ------------------------------------------------------------------
    const sections = new Map<string, any>();
    students.forEach((s) => {
      const key = s.class?.id || "tanpa-kelas";
      if (!sections.has(key)) {
        sections.set(key, {
          classId: s.class?.id || null,
          className: s.class?.name || "Tanpa Kelas",
          rows: [],
        });
      }
    });

    students.forEach((s) => {
      const perDate = recordMap.get(s.id);
      const codes: Record<string, string> = {};
      const counts = hitungKosong();
      let timeText: string | null = null;
      let rawStatus: string | null = null;
      let notes: string | null = null;
      let lateMinutes = 0;

      if (reportType === "HARIAN") {
        const iso = periodStart ? toIso(periodStart) : "";
        const rec = perDate?.get(iso);
        if (rec) {
          const kode = kodeStatus(rec.status);
          codes[iso] = kode;
          tambahHitungan(counts, kode);
          rawStatus = rec.status;
          notes = rec.notes;
          lateMinutes = rec.lateMinutes;
          if (rec.checkInAt) {
            timeText = `${new Intl.DateTimeFormat("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Jakarta",
            }).format(rec.checkInAt)} WIB`;
          }
        } else {
          // Tidak ada record sama sekali.
          const isPast = iso < hariIni && iso >= hitungDari;
          if (isPast) {
            codes[iso] = "A";
            tambahHitungan(counts, "A");
            rawStatus = "TIDAK_ADA_RECORD";
          } else {
            codes[iso] = "-";
            rawStatus = null;
          }
        }
      } else {
        // Harian/mingguan/bulanan/semester: hitung per hari efektif.
        hariEfektif.forEach((h) => {
          if (h.isHoliday) {
            codes[h.iso] = "L";
            return;
          }
          const rec = perDate?.get(h.iso);
          if (rec) {
            const kode = kodeStatus(rec.status);
            codes[h.iso] = kode;
            tambahHitungan(counts, kode);
          } else {
            const isPast = h.iso < hariIni;
            const dihitungAlfa = isPast && h.iso >= hitungDari;
            codes[h.iso] = dihitungAlfa ? "A" : "-";
            if (dihitungAlfa) tambahHitungan(counts, "A");
          }
        });
      }

      const persen = persentaseKehadiran(counts.H, pembagiPersen);

      sections.get(s.class?.id || "tanpa-kelas").rows.push({
        studentId: s.id,
        nis: s.nis,
        nisn: s.nisn || s.nis,
        name: s.name,
        className: s.class?.name || "-",
        codes,
        counts,
        persen,
        waktu: timeText,
        statusLabel: rawStatus ? labelStatus(rawStatus as any) : "-",
        statusRaw: rawStatus,
        catatan: notes,
        lateMinutes,
        rekomendasi:
          reportType === "BULANAN" ? labelRekomendasi(persen, ambang) : null,
        kelayakan:
          reportType === "SEMESTER" ? labelKelayakan(persen, ambang) : null,
      });
    });

    const classSections = Array.from(sections.values()).sort((a, b) =>
      a.className.localeCompare(b.className, "id")
    );

    // ------------------------------------------------------------------
    // 6. Pagination baris siswa.
    // Agregasi tetap dihitung terhadap SELURUH siswa (agar persentase & status
    // rekomendasi tidak berubah antar halaman), namun baris yang dikirim ke
    // klien dipaginasi agar halaman tetap ringan pada kelas besar / semua kelas.
    // ------------------------------------------------------------------
    const totalRows = classSections.reduce((acc, s) => acc + s.rows.length, 0);
    const perPage = Number(searchParams.get("perPage")) || 0;
    const pageParam = Math.max(1, Number(searchParams.get("page")) || 1);

    let paginatedSections = classSections;
    let totalPages = 1;
    let currentPage = 1;
    let pageInfo: any = { totalRows, totalPages: 1, page: 1, perPage: 0 };

    if (perPage > 0 && totalRows > perPage) {
      totalPages = Math.ceil(totalRows / perPage);
      currentPage = Math.min(pageParam, totalPages);

      // Ratakan baris (lurus dengan urutan kelas & nama), potong, lalu
      // kelompokkan kembali menjadi seksi per kelas.
      const flat: any[] = [];
      classSections.forEach((s) => {
        s.rows.forEach((r: any) => flat.push({ classId: s.classId, className: s.className, row: r }));
      });
      const slice = flat.slice((currentPage - 1) * perPage, currentPage * perPage);

      const grouped = new Map<string, any>();
      slice.forEach((item) => {
        const key = item.classId || "tanpa-kelas";
        if (!grouped.has(key)) {
          grouped.set(key, { classId: item.classId, className: item.className, rows: [] });
        }
        grouped.get(key).rows.push(item.row);
      });
      paginatedSections = Array.from(grouped.values());
      pageInfo = { totalRows, totalPages, page: currentPage, perPage };
    }

    // Kolom matriks mingguan (hanya hari efektif, mengikuti pengaturan activeDays)
    const matrixDays = hariEfektif.map((h) => ({
      iso: h.iso,
      label: NAMA_HARI[h.date.getUTCDay()],
      short: NAMA_HARI_SINGKAT[h.date.getUTCDay()],
      tanggal: h.date.getUTCDate(),
      isHoliday: h.isHoliday,
      holidayDescription: holidayDates.has(h.iso)
        ? holidayDesc.get(h.iso)
        : undefined,
    }));

    // ------------------------------------------------------------------
    // 6b. Ekspor Excel (.xlsx)
    // ------------------------------------------------------------------
    if (searchParams.get("export") === "xlsx") {
      const buf = await buildXlsx({
        reportType,
        periodLabel,
        lockTime,
        matrixDays,
        classSections,
        totalHariEfektif,
      });
      const filename = escapeFilename(
        `laporan-presensi-${reportType.toLowerCase()}-${toIso(periodStart)}.xlsx`
      );
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": String(buf.byteLength),
        },
      });
    }

    return NextResponse.json({
      success: true,
      reportType,
      period: {
        label: periodLabel,
        termName,
        start: toIso(periodStart),
        end: toIso(periodEnd),
        startPanjang: formatTanggalPanjang(periodStart),
        endPanjang: formatTanggalPanjang(periodEnd),
        totalHariEfektif,
        lockTime,
      },
      matrixDays,
      classSections: paginatedSections,
      totalRows,
      totalClasses: classSections.length,
      pagination: pageInfo,
      ambang,
    });
  } catch (error) {
    console.error("GET Attendance Report Error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
