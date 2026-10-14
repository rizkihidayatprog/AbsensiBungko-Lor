"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  PartyPopper,
  Info,
  CalendarDays,
  Sparkles,
  ArrowRight,
  X,
} from "lucide-react";

interface HolidayItem {
  id: string;
  date: string | Date;
  description: string;
}

interface DashboardCalendarProps {
  holidays: HolidayItem[];
  activeDays?: string; // "1,2,3,4,5"
  checkInEnd?: string;
  userRole?: string;
}

export default function DashboardCalendar({
  holidays = [],
  activeDays = "1,2,3,4,5",
  checkInEnd = "07:15",
  userRole,
}: DashboardCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedHoliday, setSelectedHoliday] = useState<HolidayItem | null>(null);

  const activeDayNums = activeDays.split(",").map((d) => parseInt(d, 10));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Bulan dan Tahun teks
  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const currentMonthName = monthNames[month];

  // Navigasi bulan
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedHoliday(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedHoliday(null);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
    setSelectedHoliday(null);
  };

  // Kalkulasi hari dalam bulan
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Minggu, 1 = Senin, ...
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Helper normalisasi tanggal format YYYY-MM-DD
  const formatDateKey = (d: Date | string) => {
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const holidayMap = new Map<string, HolidayItem>();
  holidays.forEach((h) => {
    const key = formatDateKey(h.date);
    holidayMap.set(key, h);
  });

  const today = new Date();
  const todayKey = formatDateKey(today);
  const todayHoliday = holidayMap.get(todayKey);

  // Cek apakah hari ini hari aktif sekolah
  // Hari JS: 0=Minggu, 1=Senin..6=Sabtu.
  // DB format: 1=Senin..7=Minggu.
  const todayJsDay = today.getDay();
  const todayDbDay = todayJsDay === 0 ? 7 : todayJsDay;
  const isTodaySchoolDay = activeDayNums.includes(todayDbDay);

  // Libur mendatang terdekat (dari hari ini ke depan)
  const nowTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const upcomingHolidays = holidays
    .map((h) => {
      const hDate = new Date(h.date);
      const hTime = new Date(hDate.getFullYear(), hDate.getMonth(), hDate.getDate()).getTime();
      const diffDays = Math.round((hTime - nowTime) / (1000 * 60 * 60 * 24));
      return { ...h, dateObj: hDate, diffDays };
    })
    .filter((h) => h.diffDays >= 0)
    .sort((a, b) => a.diffDays - b.diffDays)
    .slice(0, 4);

  // Array kalender
  // Kita mulai dari hari Minggu (0) s/d Sabtu (6)
  const calendarDays: Array<{
    dayNumber: number | null;
    dateKey: string | null;
    isCurrentMonth: boolean;
    isToday: boolean;
    isWeekend: boolean;
    holiday?: HolidayItem;
  }> = [];

  // Padding hari sebelum tanggal 1
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push({
      dayNumber: null,
      dateKey: null,
      isCurrentMonth: false,
      isToday: false,
      isWeekend: false,
    });
  }

  // Hari-hari aktif bulan ini
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dateKey = formatDateKey(dateObj);
    const jsDay = dateObj.getDay();
    const dbDay = jsDay === 0 ? 7 : jsDay;
    const isWeekend = !activeDayNums.includes(dbDay);
    const holiday = holidayMap.get(dateKey);
    const isToday = dateKey === todayKey;

    calendarDays.push({
      dayNumber: d,
      dateKey,
      isCurrentMonth: true,
      isToday,
      isWeekend,
      holiday,
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Banner Notifikasi Status Hari Ini */}
      {todayHoliday ? (
        <div className="bg-gradient-to-r from-rose-500 to-red-600 text-white p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <PartyPopper className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-rose-100">
                Pemberitahuan Hari Libur Nasional / Sekolah
              </p>
              <h4 className="text-sm font-bold">
                Hari ini libur: {todayHoliday.description}
              </h4>
            </div>
          </div>
          <span className="text-[11px] font-semibold bg-white/20 px-3 py-1 rounded-full shrink-0">
            Scanner Presensi Nonaktif
          </span>
        </div>
      ) : !isTodaySchoolDay ? (
        <div className="bg-amber-500 text-white px-4 py-3 flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-amber-100" />
            <span>
              <strong>Hari ini akhir pekan:</strong> Bukan hari aktif pembelajaran sekolah.
            </span>
          </div>
          <span className="text-[11px] bg-white/20 px-2.5 py-0.5 rounded-full">Libur Rutin</span>
        </div>
      ) : null}

      <div className="p-5 space-y-5">
        {/* Header Kalender */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Kalender Akademik & Hari Libur Nasional
              </h3>
              <p className="text-[11px] text-slate-500">
                Tanggal merah dan hari libur sekolah resmi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
            >
              Hari Ini
            </button>
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-white text-slate-600 hover:text-slate-900 transition"
                title="Bulan Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 text-xs font-bold text-slate-800 min-w-[120px] text-center">
                {currentMonthName} {year}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-white text-slate-600 hover:text-slate-900 transition"
                title="Bulan Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Grid Kalender & Daftar Libur Terdekat (2 Kolom) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kolom 1: Tabel Kalender (2 Kolom di Desktop) */}
          <div className="lg:col-span-2 space-y-3">
            {/* Nama Hari */}
            <div className="grid grid-cols-7 text-center text-[11px] font-bold text-slate-500 py-1 border-b border-slate-100">
              <span className="text-rose-600">Min</span>
              <span>Sen</span>
              <span>Sel</span>
              <span>Rab</span>
              <span>Kam</span>
              <span>Jum</span>
              <span className="text-amber-600">Sab</span>
            </div>

            {/* Grid Angka Tanggal */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((item, idx) => {
                if (!item.isCurrentMonth || item.dayNumber === null) {
                  return <div key={`empty-${idx}`} className="h-10" />;
                }

                const isHoliday = Boolean(item.holiday);
                const isSun = idx % 7 === 0;

                return (
                  <div
                    key={item.dateKey}
                    onClick={() => {
                      if (item.holiday) setSelectedHoliday(item.holiday);
                    }}
                    className={`h-11 rounded-xl p-1 flex flex-col items-center justify-between text-xs transition-all cursor-pointer relative ${
                      item.isToday
                        ? "ring-2 ring-blue-600 bg-blue-50/70 font-bold text-blue-900"
                        : isHoliday
                        ? "bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold"
                        : item.isWeekend
                        ? "bg-slate-50/70 text-slate-400"
                        : "hover:bg-slate-100 text-slate-700"
                    }`}
                    title={item.holiday ? item.holiday.description : undefined}
                  >
                    <span
                      className={`text-[12px] leading-tight ${
                        isSun || isHoliday ? "text-rose-600 font-bold" : ""
                      }`}
                    >
                      {item.dayNumber}
                    </span>

                    {/* Indicator Dot */}
                    {isHoliday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mb-0.5" />
                    )}
                    {item.isToday && !isHoliday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mb-0.5" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Keterangan Tanggal Merah Terpilih */}
            {selectedHoliday && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between animate-in fade-in">
                <div>
                  <span className="font-bold block">
                    Tanggal Merah:{" "}
                    {new Date(selectedHoliday.date).toLocaleDateString("id-ID", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  <p className="text-[11px] text-rose-700 mt-0.5">{selectedHoliday.description}</p>
                </div>
                <button
                  onClick={() => setSelectedHoliday(null)}
                  className="text-rose-400 hover:text-rose-700 p-1 rounded-md"
                  title="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Legenda Indikator */}
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
                <span>Libur Nasional / Sekolah</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <span>Hari Ini</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-200"></span>
                <span>Akhir Pekan</span>
              </div>
            </div>
          </div>

          {/* Kolom 2: Agenda Libur Mendatang Terdekat */}
          <div className="border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" /> Libur Mendatang Terdekat
              </h4>
              {userRole === "SUPERADMIN" && (
                <Link
                  href="/pengaturan"
                  className="text-[11px] font-semibold text-blue-600 hover:underline"
                >
                  Kelola
                </Link>
              )}
            </div>

            {upcomingHolidays.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 italic">
                Tidak ada hari libur khusus dalam waktu dekat.
              </p>
            ) : (
              <div className="space-y-2.5">
                {upcomingHolidays.map((h) => (
                  <div
                    key={h.id}
                    className="p-3 rounded-xl bg-slate-50 hover:bg-rose-50/50 border border-slate-200 hover:border-rose-200 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-slate-800">
                        {h.dateObj.toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className="text-[10px] font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                        {h.diffDays === 0
                          ? "Hari ini"
                          : h.diffDays === 1
                          ? "Besok"
                          : `${h.diffDays} hari lagi`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-snug">
                      {h.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
