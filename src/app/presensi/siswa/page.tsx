// Alias route: /presensi/siswa
// Halaman monitoring kehadiran siswa. PRD & dashboard wali kelas memakai path ini,
// sedangkan implementasi halaman berada di /presensi. Modul ini meneruskan ke
// komponen yang sama agar tidak ada duplikasi logika.
export { default } from "../page";
