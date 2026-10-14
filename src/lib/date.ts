/**
 * Mengembalikan Date object UTC midnight untuk tanggal hari ini (Zona Waktu: Asia/Jakarta).
 * Memastikan kompatibilitas 100% dengan tipe Prisma @db.Date pada database MySQL.
 */
export function getTodayDate(d: Date = new Date()): Date {
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(d);
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/**
 * Mengembalikan string "YYYY-MM-DD" untuk tanggal hari ini berdasarkan
 * Zona Waktu Asia/Jakarta (WIB).
 *
 * PENTING: jangan gunakan `new Date().toISOString().split("T")[0]` di sisi klien.
 * toISOString() menghasilkan waktu UTC, sehingga antara pukul 00:00-06:59 WIB
 * tanggalnya meleset satu hari ke belakang.
 */
export function formatIsoDateJakarta(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(d);
}

/**
 * Konversi string "YYYY-MM-DD" menjadi Date UTC midnight untuk query Prisma @db.Date
 */
export function parseLocalDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}
