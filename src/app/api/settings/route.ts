import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { settingsPatchSchema } from "@/lib/validation";

export async function GET() {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // Pastikan record setting dengan ID 1 selalu tersedia
    const setting = await prisma.schoolSetting.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        schoolName: "SMP Negeri 1 Cerdas Bangsa",
        npsn: "20102030",
        address: "Jl. Pendidikan No. 45, Jakarta Pusat",
        phone: "021-5551234",
        email: "info@smpn1cerdas.sch.id",
        principalName: "Dr. H. Bambang, M.Pd.",
        principalNip: "197001011995011001",
        checkInStart: "06:00",
        checkInEnd: "07:15",
        checkInTolerance: "07:30",
        checkOutStart: "14:30",
        checkOutEnd: "17:00",
        autoAlphaTime: "12:00",
        activeDays: "1,2,3,4,5",
      },
      update: {},
    });

    return NextResponse.json({ success: true, setting });
  } catch (error: any) {
    console.error("GET Settings Error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser || (sessionUser.role !== "SUPERADMIN" && sessionUser.role !== "ADMIN")) {
      return NextResponse.json(
        { success: false, message: "Hanya Superadmin dan Staf Tata Usaha yang memiliki izin mengubah pengaturan sekolah." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = settingsPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
    const {
      schoolName,
      npsn,
      address,
      phone,
      email,
      principalName,
      principalNip,
      checkInStart,
      checkInEnd,
      checkInTolerance,
      checkOutStart,
      checkOutEnd,
      checkOutEnabled,
      autoAlphaTime,
      activeDays,
      gradeExcellentMin,
      gradeGoodMin,
      gradeWarningMin,
      gradeCallParentMin,
      semesterEligibleMin,
      waEnabled,
      waNotifyHadir,
      waNotifyTerlambat,
      waNotifyIzin,
      waNotifyAlfa,
      waTemplateHadir,
      waTemplateTerlambat,
      waTemplateIzin,
      waTemplateAlfa,
      waGatewayType,
      waApiUrl,
      waApiKey,
    } = parsed.data;

    const oldSetting = await prisma.schoolSetting.findUnique({ where: { id: 1 } });

    // Normalisasi ambang nilai: bulat 0-100
    const clampPct = (v: any, fallback: number) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return fallback;
      return Math.min(100, Math.max(0, Math.round(n)));
    };
    const excellent = clampPct(gradeExcellentMin, oldSetting?.gradeExcellentMin ?? 95);
    const good = clampPct(gradeGoodMin, oldSetting?.gradeGoodMin ?? 90);
    const warning = clampPct(gradeWarningMin, oldSetting?.gradeWarningMin ?? 80);
    const callParent = clampPct(gradeCallParentMin, oldSetting?.gradeCallParentMin ?? 70);
    const eligible = clampPct(
      semesterEligibleMin,
      oldSetting?.semesterEligibleMin ?? 90
    );

    const updatedSetting = await prisma.schoolSetting.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        schoolName: schoolName?.trim() || "SMP Negeri 1 Cerdas Bangsa",
        npsn: npsn?.trim() || null,
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        principalName: principalName?.trim() || null,
        principalNip: principalNip?.trim() || null,
        checkInStart: checkInStart || "06:00",
        checkInEnd: checkInEnd || "07:15",
        checkInTolerance: checkInTolerance || "07:30",
        checkOutStart: checkOutStart || "14:30",
        checkOutEnd: checkOutEnd || "17:00",
        checkOutEnabled: checkOutEnabled ?? true,
        autoAlphaTime: autoAlphaTime || "12:00",
        activeDays: activeDays || "1,2,3,4,5",
        gradeExcellentMin: excellent,
        gradeGoodMin: good,
        gradeWarningMin: warning,
        gradeCallParentMin: callParent,
        semesterEligibleMin: eligible,
        waEnabled: waEnabled ?? true,
        waNotifyHadir: waNotifyHadir ?? true,
        waNotifyTerlambat: waNotifyTerlambat ?? true,
        waNotifyIzin: waNotifyIzin ?? true,
        waNotifyAlfa: waNotifyAlfa ?? true,
        waTemplateHadir: waTemplateHadir || null,
        waTemplateTerlambat: waTemplateTerlambat || null,
        waTemplateIzin: waTemplateIzin || null,
        waTemplateAlfa: waTemplateAlfa || null,
        waGatewayType: waGatewayType || "BAILEYS",
        waApiUrl: waApiUrl || null,
        waApiKey: waApiKey || null,
      },
      update: {
        schoolName: schoolName?.trim(),
        npsn: npsn !== undefined ? npsn?.trim() : undefined,
        address: address !== undefined ? address?.trim() : undefined,
        phone: phone !== undefined ? phone?.trim() : undefined,
        email: email !== undefined ? email?.trim() : undefined,
        principalName: principalName !== undefined ? principalName?.trim() : undefined,
        principalNip: principalNip !== undefined ? principalNip?.trim() : undefined,
        checkInStart,
        checkInEnd,
        checkInTolerance,
        checkOutStart,
        checkOutEnd,
        checkOutEnabled:
          checkOutEnabled === undefined ? undefined : Boolean(checkOutEnabled),
        autoAlphaTime,
        activeDays,
        gradeExcellentMin: excellent,
        gradeGoodMin: good,
        gradeWarningMin: warning,
        gradeCallParentMin: callParent,
        semesterEligibleMin: eligible,
        waEnabled: waEnabled === undefined ? undefined : Boolean(waEnabled),
        waNotifyHadir: waNotifyHadir === undefined ? undefined : Boolean(waNotifyHadir),
        waNotifyTerlambat: waNotifyTerlambat === undefined ? undefined : Boolean(waNotifyTerlambat),
        waNotifyIzin: waNotifyIzin === undefined ? undefined : Boolean(waNotifyIzin),
        waNotifyAlfa: waNotifyAlfa === undefined ? undefined : Boolean(waNotifyAlfa),
        waTemplateHadir: waTemplateHadir !== undefined ? waTemplateHadir : undefined,
        waTemplateTerlambat: waTemplateTerlambat !== undefined ? waTemplateTerlambat : undefined,
        waTemplateIzin: waTemplateIzin !== undefined ? waTemplateIzin : undefined,
        waTemplateAlfa: waTemplateAlfa !== undefined ? waTemplateAlfa : undefined,
        waGatewayType: waGatewayType !== undefined ? waGatewayType : undefined,
        waApiUrl: waApiUrl !== undefined ? waApiUrl : undefined,
        waApiKey: waApiKey !== undefined ? waApiKey : undefined,
      },
    });

    await logAudit({
      actorId: sessionUser.id,
      action: "UPDATE_SCHOOL_SETTINGS",
      entityType: "SchoolSetting",
      entityId: "1",
      oldValues: oldSetting,
      newValues: updatedSetting,
    });

    return NextResponse.json({
      success: true,
      message: "Pengaturan sekolah berhasil diperbarui.",
      setting: updatedSetting,
    });
  } catch (error: any) {
    console.error("PATCH Settings Error:", error);
    return NextResponse.json({ success: false, message: error.message || "Server error" }, { status: 500 });
  }
}
