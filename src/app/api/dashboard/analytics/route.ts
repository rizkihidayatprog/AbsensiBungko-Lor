import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  getAlfaBeruntun,
  getRekapKeterlambatan,
  ALFA_BERUNTUN_MIN_HARI,
  REKAP_TELAMBAT_MIN_MENIT,
} from "@/lib/analytics";
import { addDays, endOfMonth, startOfMonth, toLocalDate } from "@/lib/report";
import { getTodayDate } from "@/lib/date";

/**
 * Data analitik untuk kartu peringatan di dashboard:
 *  - alfa beruntun (tidak hadir beruntun tanpa keterangan)
 *  - rekap keterlambatan (akumulasi menit keterlambatan)
 */
export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope") === "all" ? "all" : "month";
    const minHari = Number(searchParams.get("minHari")) || ALFA_BERUNTUN_MIN_HARI;

    // Guru hanya boleh melihat data kelas yang diampu (wali kelas).
    let classId: string | null = null;
    if (sessionUser.role === "GURU") {
      const homeroom = await prisma.class.findFirst({
        where: { homeroomId: sessionUser.teacherId || "" },
        select: { id: true },
      });
      classId = homeroom?.id ?? "__tanpa_kelas__";
    }

    const today = getTodayDate();
    const mulai = scope === "all" ? addDays(today, -365) : startOfMonth(today);
    const akhirBulan = toLocalDate(endOfMonth(today));
    const sampai = akhirBulan.getTime() < today.getTime() ? today : akhirBulan;

    const [alfaBeruntun, rekapTerlambat] = await Promise.all([
      getAlfaBeruntun(minHari, today, classId),
      getRekapKeterlambatan(mulai, sampai, REKAP_TELAMBAT_MIN_MENIT, classId),
    ]);

    return NextResponse.json({
      success: true,
      minHari,
      alfaBeruntun: alfaBeruntun.map(({ nis, name, className, hari, sejak }) => ({
        nis,
        name,
        className,
        hari,
        sejak,
      })),
      rekapTerlambat: rekapTerlambat.map(
        ({ nis, name, className, totalMenit, jumlahTerlambat }) => ({
          nis,
          name,
          className,
          totalMenit,
          jumlahTerlambat,
        })
      ),
    });
  } catch (error) {
    console.error("Dashboard Analytics API Error:", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan internal pada server." },
      { status: 500 }
    );
  }
}
