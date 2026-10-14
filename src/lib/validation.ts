import { z } from "zod";

// ---------------------------------------------------------------------------
// Skema validasi Zod (v4) untuk input dari klien.
// Dipakai di route API agar validasi terpusat & konsisten (bukan jika-satu-satu
// menyebar). Normalisasi trim/lowercase dilakukan route seperti sebelumnya.
// ---------------------------------------------------------------------------

const TIME_24H = /^([01]?\d|2[0-3]):[0-5]\d$/;
const ACTIVE_DAYS = /^[1-7](,\s*[1-7])*$/;
const PHONE_FIELD = z.string().trim().max(30).nullable().optional();

const optionalString = (max: number) => z.string().trim().max(max).nullable().optional();

const pct = (field: string) =>
  z.coerce
    .number()
    .int()
    .min(0)
    .max(100, `${field} harus berisi 0–100.`)
    .optional()
    .describe(field);

export const settingsPatchSchema = z.object({
  schoolName: z.string().trim().min(1, "Nama sekolah wajib diisi.").max(120).optional(),
  npsn: optionalString(20),
  address: optionalString(200),
  phone: PHONE_FIELD,
  email: z.union([z.email("Format email tidak valid."), z.literal("")]).nullable().optional(),
  principalName: optionalString(120),
  principalNip: optionalString(30),
  checkInStart: z.string().regex(TIME_24H, "Jam masuk harus format HH:mm.").optional(),
  checkInEnd: z.string().regex(TIME_24H, "Batas jam masuk harus format HH:mm.").optional(),
  checkInTolerance: z.string().regex(TIME_24H, "Batas toleransi harus format HH:mm.").optional(),
  checkOutStart: z.string().regex(TIME_24H, "Jam pulang mulai harus format HH:mm.").optional(),
  checkOutEnd: z.string().regex(TIME_24H, "Jam pulang selesai harus format HH:mm.").optional(),
  checkOutEnabled: z.boolean().optional(),
  autoAlphaTime: z.string().regex(TIME_24H, "Waktu finalisasi alfa harus format HH:mm.").optional(),
  activeDays: z.string().regex(ACTIVE_DAYS, "Hari kerja harus daftar angka 1–7 dipisah koma (contoh: 1,2,3,4,5).").optional(),
  gradeExcellentMin: pct("Ambang Sangat Baik"),
  gradeGoodMin: pct("Ambang Baik"),
  gradeWarningMin: pct("Ambang Teguran Lisan"),
  gradeCallParentMin: pct("Ambang Peringatan / Panggil Orang Tua"),
  semesterEligibleMin: pct("Ambang Kelayakan Ujian"),
  waEnabled: z.boolean().optional(),
  waNotifyHadir: z.boolean().optional(),
  waNotifyTerlambat: z.boolean().optional(),
  waNotifyIzin: z.boolean().optional(),
  waNotifyAlfa: z.boolean().optional(),
  waTemplateHadir: optionalString(4000),
  waTemplateTerlambat: optionalString(4000),
  waTemplateIzin: optionalString(4000),
  waTemplateAlfa: optionalString(4000),
  waGatewayType: z.enum(["BAILEYS", "GENERIC_API"]).optional(),
  waApiUrl: optionalString(500),
  waApiKey: optionalString(500),
});

export const GENDER_ENUM = z.enum(["L", "P"]);

export const studentCreateSchema = z.object({
  nis: z.string().trim().min(1, "NIS wajib diisi.").max(30),
  nisn: z.string().trim().max(30).nullable().optional(),
  name: z.string().trim().min(1, "Nama siswa wajib diisi.").max(120),
  gender: GENDER_ENUM,
  classId: z.string().min(1, "Kelas wajib dipilih."),
  photoUrl: optionalString(500),
  parentName: optionalString(120),
  parentPhone: PHONE_FIELD,
});

export const studentPatchSchema = z.object({
  id: z.string().min(1, "ID siswa wajib disertakan."),
  nis: z.string().trim().min(1).max(30).optional(),
  nisn: z.string().trim().max(30).nullable().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  gender: GENDER_ENUM.optional(),
  classId: z.string().min(1).optional(),
  photoUrl: optionalString(500),
  parentName: optionalString(120),
  parentPhone: PHONE_FIELD,
  isActive: z.boolean().optional(),
});

export const teacherCreateSchema = z.object({
  name: z.string().trim().min(1, "Nama guru wajib diisi.").max(120),
  nip: z.string().trim().max(30).nullable().optional(),
  gender: GENDER_ENUM,
  phone: PHONE_FIELD,
  createAccount: z.boolean().optional(),
  email: z.union([z.email("Format email tidak valid."), z.literal("")]).nullable().optional(),
  password: z.string().min(8, "Password minimal 8 karakter.").optional(),
});

export const teacherPatchSchema = z.object({
  id: z.string().min(1, "ID guru wajib disertakan."),
  name: z.string().trim().min(1, "Nama guru wajib diisi.").max(120),
  nip: z.string().trim().max(30).nullable().optional(),
  gender: GENDER_ENUM,
  phone: PHONE_FIELD,
  isActive: z.boolean().optional(),
});

export const USER_ROLE_ENUM = z.enum(["SUPERADMIN", "ADMIN", "GURU"]);

export const userCreateSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi.").max(120),
  email: z.email("Format email tidak valid."),
  username: z.string().trim().max(50).nullable().optional(),
  password: z.string().min(8, "Password minimal 8 karakter."),
  role: USER_ROLE_ENUM,
  teacherId: z.string().max(50).nullable().optional(),
  avatarUrl: optionalString(500),
});

export const userPatchSchema = z.object({
  id: z.string().min(1, "ID akun wajib disertakan."),
  name: z.string().trim().min(1).max(120).optional(),
  email: z.email("Format email tidak valid.").nullable().optional(),
  username: z.string().trim().max(50).nullable().optional(),
  password: z.string().min(8, "Password minimal 8 karakter.").nullable().optional(),
  role: USER_ROLE_ENUM.optional(),
  isActive: z.boolean().optional(),
  teacherId: z.string().max(50).nullable().optional(),
  avatarUrl: optionalString(500),
});