import { PrismaClient, Role, SemesterType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Menjalankan Seeder Database Absensi Sekolah...");

  // 1. Tahun Ajaran & Semester
  const academicYear = await prisma.academicYear.upsert({
    where: { name: "2026/2027" },
    update: { isActive: true },
    create: {
      name: "2026/2027",
      isActive: true,
    },
  });

  const termGanjil = await prisma.academicTerm.upsert({
    where: {
      academicYearId_semester: {
        academicYearId: academicYear.id,
        semester: SemesterType.GANJIL,
      },
    },
    update: { isActive: true },
    create: {
      academicYearId: academicYear.id,
      name: "Semester Ganjil 2026/2027",
      semester: SemesterType.GANJIL,
      startDate: new Date("2026-07-15T00:00:00.000Z"),
      endDate: new Date("2026-12-20T00:00:00.000Z"),
      isActive: true,
    },
  });

  const termGenap = await prisma.academicTerm.upsert({
    where: {
      academicYearId_semester: {
        academicYearId: academicYear.id,
        semester: SemesterType.GENAP,
      },
    },
    update: { isActive: false },
    create: {
      academicYearId: academicYear.id,
      name: "Semester Genap 2026/2027",
      semester: SemesterType.GENAP,
      startDate: new Date("2027-01-05T00:00:00.000Z"),
      endDate: new Date("2027-06-25T00:00:00.000Z"),
      isActive: false,
    },
  });
  console.log("✅ Periode Akademik disiapkan:", termGanjil.name, "(Aktif)");

  // 1. Pengaturan Sekolah Default (SD & SMP)
  const schoolSetting = await prisma.schoolSetting.upsert({
    where: { id: 1 },
    update: {
      schoolName: "SMP / SD Harapan Bangsa",
    },
    create: {
      id: 1,
      schoolName: "SMP / SD Harapan Bangsa",
      address: "Jl. Pendidikan No. 45, Jakarta",
      checkInStart: "06:00",
      checkInEnd: "07:15",
      checkInTolerance: "07:30",
      checkOutStart: "14:00",
      checkOutEnd: "16:00",
      autoAlphaTime: "12:00",
      activeDays: "1,2,3,4,5",
    },
  });
  console.log("✅ Pengaturan Sekolah disiapkan:", schoolSetting.schoolName);

  // Hash password akun seed.
  // Prioritas: SEED_ADMIN_PASSWORD / SEED_GURU_PASSWORD.
  // Bila tidak diisi, buat acak dan CETAK SEKALI di konsol — tidak ada lagi
  // password default yang diketahui publik (mis. "admin123").
  const adminPassword = process.env.SEED_ADMIN_PASSWORD?.trim() || crypto.randomUUID().slice(0, 12);
  const guruPassword = process.env.SEED_GURU_PASSWORD?.trim() || crypto.randomUUID().slice(0, 12);
  const passwordAdmin = await bcrypt.hash(adminPassword, 10);
  const passwordGuru = await bcrypt.hash(guruPassword, 10);

  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.warn("\n==============================================");
    console.warn(" PASSWORD ADMIN (acak, simpan sekarang):");
    console.warn(`   ${adminPassword}`);
    console.warn("==============================================\n");
  }
  if (!process.env.SEED_GURU_PASSWORD) {
    console.warn("==============================================");
    console.warn(" PASSWORD GURU (acak, simpan sekarang):");
    console.warn(`   ${guruPassword}`);
    console.warn("==============================================\n");
  }

  // 2. Akun Superadmin
  const superadmin = await prisma.user.upsert({
    where: { email: "superadmin@sekolah.sch.id" },
    update: {},
    create: {
      name: "Kepala Sekolah / Superadmin",
      email: "superadmin@sekolah.sch.id",
      username: "superadmin",
      passwordHash: passwordAdmin,
      role: Role.SUPERADMIN,
      isActive: true,
    },
  });
  console.log("✅ Superadmin dibuat:", superadmin.email);

  // 3. Akun Admin / Tata Usaha
  const admin = await prisma.user.upsert({
    where: { email: "admin@sekolah.sch.id" },
    update: {},
    create: {
      name: "Staf Tata Usaha",
      email: "admin@sekolah.sch.id",
      username: "admin",
      passwordHash: passwordAdmin,
      role: Role.ADMIN,
      isActive: true,
    },
  });
  console.log("✅ Admin TU dibuat:", admin.email);

  // 4. Data Guru
  const teacher1 = await prisma.teacher.upsert({
    where: { nip: "198501152010011002" },
    update: {},
    create: {
      nip: "198501152010011002",
      name: "Budi Santoso, S.Pd.",
      gender: "L",
      phone: "081234567890",
      qrTokenHash: "qr_token_teacher_budi_001",
      isActive: true,
    },
  });

  const teacher2 = await prisma.teacher.upsert({
    where: { nip: "198904202015022003" },
    update: {},
    create: {
      nip: "198904202015022003",
      name: "Siti Rahmawati, M.Kom.",
      gender: "P",
      phone: "081234567891",
      qrTokenHash: "qr_token_teacher_siti_002",
      isActive: true,
    },
  });

  // Akun User untuk Guru 1 (Wali Kelas)
  await prisma.user.upsert({
    where: { email: "budi@sekolah.sch.id" },
    update: {},
    create: {
      name: teacher1.name,
      email: "budi@sekolah.sch.id",
      username: "budi",
      passwordHash: passwordGuru,
      role: Role.GURU,
      teacherId: teacher1.id,
      isActive: true,
    },
  });

  // Akun User untuk Guru 2 (Guru Piket / Pengajar)
  await prisma.user.upsert({
    where: { email: "siti@sekolah.sch.id" },
    update: {},
    create: {
      name: teacher2.name,
      email: "siti@sekolah.sch.id",
      username: "siti",
      passwordHash: passwordGuru,
      role: Role.GURU,
      teacherId: teacher2.id,
      isActive: true,
    },
  });
  console.log("✅ Data Guru & Akun Guru dibuat");

  // 5. Data Kelas (SD & SMP - Tanpa Jurusan)
  const class7A = await prisma.class.upsert({
    where: { id: "class-7a" },
    update: { name: "7A", grade: 7 },
    create: {
      id: "class-7a",
      name: "7A",
      grade: 7,
      homeroomId: teacher1.id, // Budi Santoso sebagai wali kelas
    },
  });

  const class7B = await prisma.class.upsert({
    where: { id: "class-7b" },
    update: { name: "7B", grade: 7 },
    create: {
      id: "class-7b",
      name: "7B",
      grade: 7,
      homeroomId: teacher2.id, // Siti Rahmawati sebagai wali kelas
    },
  });

  const class8A = await prisma.class.upsert({
    where: { id: "class-8a" },
    update: { name: "8A", grade: 8 },
    create: {
      id: "class-8a",
      name: "8A",
      grade: 8,
    },
  });

  const class1A = await prisma.class.upsert({
    where: { id: "class-1a" },
    update: { name: "1A", grade: 1 },
    create: {
      id: "class-1a",
      name: "1A",
      grade: 1,
    },
  });
  console.log("✅ Kelas SD & SMP dibuat:", class7A.name, class7B.name, class8A.name, class1A.name);

  // 6. Data Siswa
  const sampleStudents = [
    {
      nis: "20261001",
      nisn: "0061234567",
      name: "Ahmad Fauzi",
      gender: "L",
      classId: class7A.id,
      qrTokenHash: "qr_student_ahmadfauzi_20261001",
    },
    {
      nis: "20261002",
      nisn: "0061234568",
      name: "Dewi Sartika",
      gender: "P",
      classId: class7A.id,
      qrTokenHash: "qr_student_dewisartika_20261002",
    },
    {
      nis: "20261003",
      nisn: "0061234569",
      name: "Bagas Pratama",
      gender: "L",
      classId: class7A.id,
      qrTokenHash: "qr_student_bagaspratama_20261003",
    },
    {
      nis: "20261004",
      nisn: "0061234570",
      name: "Citra Lestari",
      gender: "P",
      classId: class7B.id,
      qrTokenHash: "qr_student_citralestari_20261004",
    },
    {
      nis: "20261005",
      nisn: "0061234571",
      name: "Doni Kurniawan",
      gender: "L",
      classId: class7B.id,
      qrTokenHash: "qr_student_donikurniawan_20261005",
    },
  ];

  for (const s of sampleStudents) {
    const student = await prisma.student.upsert({
      where: { nis: s.nis },
      update: { classId: s.classId },
      create: s,
    });

    // Pendaftaran Siswa ke Semester Ganjil Aktif
    await prisma.studentEnrollment.upsert({
      where: {
        studentId_academicTermId: {
          studentId: student.id,
          academicTermId: termGanjil.id,
        },
      },
      update: { classId: s.classId, isActive: true },
      create: {
        studentId: student.id,
        classId: s.classId,
        academicTermId: termGanjil.id,
        isActive: true,
      },
    });
  }
  console.log(`✅ ${sampleStudents.length} Data Siswa dan Pendaftaran Semester Ganjil dibuat`);

  // 7. Contoh Presensi Terkait Semester Ganjil
  const student1 = await prisma.student.findUnique({ where: { nis: "20261001" } });
  const student2 = await prisma.student.findUnique({ where: { nis: "20261002" } });
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  if (student1) {
    await prisma.studentAttendance.upsert({
      where: {
        studentId_attendanceDate: {
          studentId: student1.id,
          attendanceDate: todayUtc,
        },
      },
      update: { academicTermId: termGanjil.id },
      create: {
        studentId: student1.id,
        attendanceDate: todayUtc,
        academicTermId: termGanjil.id,
        checkInAt: new Date(new Date().setHours(6, 45, 0, 0)),
        checkOutAt: new Date(new Date().setHours(14, 15, 0, 0)),
        status: "HADIR",
        lateMinutes: 0,
        notes: "Tepat waktu",
      },
    });
  }

  if (student2) {
    await prisma.studentAttendance.upsert({
      where: {
        studentId_attendanceDate: {
          studentId: student2.id,
          attendanceDate: todayUtc,
        },
      },
      update: { academicTermId: termGanjil.id },
      create: {
        studentId: student2.id,
        attendanceDate: todayUtc,
        academicTermId: termGanjil.id,
        checkInAt: new Date(new Date().setHours(7, 22, 0, 0)),
        status: "TERLAMBAT",
        lateMinutes: 7,
        notes: "Keterlambatan 7 menit",
      },
    });
  }
  console.log("✅ Data presensi contoh berhasil dikaitkan ke Semester Ganjil");

  // 9. Hari Libur Nasional & Kalender Sekolah
  const sampleHolidays = [
    { date: new Date("2026-10-28"), description: "Hari Sumpah Pemuda (Agenda Sekolah)" },
    { date: new Date("2026-11-10"), description: "Hari Pahlawan Nasional" },
    { date: new Date("2026-12-25"), description: "Hari Raya Natal (Libur Nasional)" },
    { date: new Date("2026-12-26"), description: "Cuti Bersama Natal" },
    { date: new Date("2026-12-28"), description: "Libur Akhir Semester Ganjil" },
    { date: new Date("2026-12-29"), description: "Libur Akhir Semester Ganjil" },
    { date: new Date("2026-12-30"), description: "Libur Akhir Semester Ganjil" },
    { date: new Date("2026-12-31"), description: "Libur Akhir Semester Ganjil" },
    { date: new Date("2027-01-01"), description: "Tahun Baru 2027 Masehi (Libur Nasional)" },
    { date: new Date("2027-01-28"), description: "Isra Mi'raj Nabi Muhammad SAW" },
    { date: new Date("2027-02-17"), description: "Tahun Baru Imlek 2578 Kongzili" },
    { date: new Date("2027-03-21"), description: "Hari Raya Idul Fitri 1448 H (Libur Nasional)" },
    { date: new Date("2027-03-22"), description: "Hari Raya Idul Fitri 1448 H (Libur Nasional)" },
    { date: new Date("2027-05-01"), description: "Hari Buruh Internasional" },
    { date: new Date("2027-08-17"), description: "Hari Kemerdekaan RI ke-82" },
  ];

  for (const h of sampleHolidays) {
    await prisma.holiday.upsert({
      where: { date: h.date },
      create: h,
      update: { description: h.description },
    });
  }
  console.log("✅ Data hari libur & tanggal merah nasional berhasil disiapkan");

  console.log("🎉 Seeding selesai dengan sukses!");
}

main()
  .catch((e) => {
    console.error("❌ Terjadi kesalahan saat seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
