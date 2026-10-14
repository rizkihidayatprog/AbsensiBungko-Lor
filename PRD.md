# PRD — Sistem Absensi Sekolah Berbasis QR Code

**Versi:** 1.0  
**Tanggal:** Oktober 2026  
**Platform:** Next.js + MySQL  
**Metode presensi:** QR Code  
**Status:** Draft kebutuhan produk

---

## 1. Ringkasan Produk

Sistem absensi sekolah berbasis web untuk mengelola kehadiran siswa dan guru menggunakan QR Code unik. Petugas dapat melakukan pemindaian melalui kamera laptop, webcam, atau kamera perangkat yang kompatibel. Data presensi disimpan ke database MySQL dan dapat dipantau melalui dashboard sesuai hak akses pengguna.

Aplikasi mencakup pengelolaan data siswa, guru, kelas, jadwal kerja sekolah, presensi masuk dan pulang, izin/sakit, laporan PDF, serta pembuatan dan pencetakan kartu QR Code.

**Keputusan ruang lingkup:** Sistem dirancang khusus untuk jenjang **SD dan SMP**, sehingga modul/entitas **Jurusan ditiadakan sepenuhnya**. Struktur sekolah langsung mengacu pada tingkatan dan nama kelas (misal Kelas 1A-1B atau Kelas 7A-7B). Selain itu, RFID dan Barcode satu dimensi dihilangkan sepenuhnya dari sistem karena metode identifikasi terstandarisasi menggunakan QR Code unik.

## 2. Tujuan dan Indikator Keberhasilan

- Mempercepat pencatatan kehadiran tanpa input manual satu per satu.
- Mengurangi kesalahan pencatatan identitas dan duplikasi presensi.
- Memudahkan petugas serta wali kelas memantau kehadiran.
- Mempermudah pengelolaan data dan pembuatan laporan kehadiran.
- Menyediakan riwayat perubahan data untuk audit.

Indikator keberhasilan awal yang diusulkan:

| Indikator | Target awal |
|---|---:|
| Waktu pemrosesan satu scan | Maks. 2 detik pada kondisi normal |
| Duplikasi presensi pada sesi yang sama | 0 |
| Ketersediaan data laporan | 100% sesuai data tersimpan |
| Keberhasilan impor CSV valid | ≥ 95% |
| Tampilan utama | Responsif di desktop dan tablet |

Target ini merupakan sasaran pengembangan yang perlu diuji, bukan hasil yang sudah terukur.

## 3. Pengguna dan Hak Akses

Sistem menggunakan kontrol akses berbasis peran (*Role-Based Access Control* / RBAC) yang disederhanakan menjadi **3 Role Akun Sistem** dan **2 Subjek Presensi**:

### 3.1 Role Akun Sistem (Memerlukan Login)

#### 1. Superadmin (Kepala Sekolah / Tim IT Administrator)
- **Cakupan Akses:** Seluruh modul dan data sekolah tanpa batasan (*Full Access*).
- **Tanggung Jawab & Fitur Utama:**
  - Mengelola akun pengguna (tambah, ubah password, nonaktifkan, atur role: `SUPERADMIN`, `ADMIN`, `GURU`).
  - Mengonfigurasi parameter sekolah: jam masuk, batas toleransi keterlambatan, jam pulang, kalender hari kerja, dan hari libur.
  - Mengelola master data lengkap (Siswa, Guru, Kelas).
  - Melakukan pemindaian presensi melalui halaman Scanner QR.
  - Akses penuh terhadap seluruh rekap presensi dan ekspor laporan PDF.
  - Memantau dan menganalisis **Audit Log** (jejak aktivitas sistem, login, perubahan data, dan riwayat koreksi).
  - Melakukan proses backup dan restore database.

#### 2. Admin (Staf Tata Usaha / Petugas Operasional)
- **Cakupan Akses:** Operasional administrasi harian sekolah.
- **Tanggung Jawab & Fitur Utama:**
  - Mengelola master data siswa, guru, dan kelas (CRUD data dan impor massal CSV).
  - Men-generate token QR dan mencetak kartu QR (secara perorangan maupun massal per kelas).
  - Melakukan pemindaian presensi QR saat bertugas di gerbang/meja presensi.
  - Melihat, memfilter, dan memonitor data presensi seluruh kelas dan guru.
  - Melakukan koreksi data presensi manual disertai alasan koreksi (tercatat di audit log).
  - Meninjau pengajuan izin/sakit siswa dan guru.
  - Menghasilkan dan mengunduh laporan kehadiran berkala (harian/bulanan) dalam format PDF.
  - *Batasan:* Tidak dapat mengubah konfigurasi global sekolah, tidak dapat mengelola akun Superadmin, dan tidak dapat mengubah/menghapus audit log.

#### 3. Guru / Wali Kelas (Termasuk Guru Piket)
- **Cakupan Akses:** Kelas yang diampu (sebagai Wali Kelas) serta akses Scanner saat bertugas (sebagai Guru Piket).
- **Tanggung Jawab & Fitur Utama:**
  - **Fungsi Guru Piket / Scanner:** Akses ke halaman `/scanner` untuk memindai kartu QR siswa atau guru saat kedatangan dan kepulangan. Setiap scan otomatis mencatat identitas guru yang sedang bertugas (`created_by: user_id`).
  - **Dashboard Wali Kelas:** Melihat statistik kehadiran real-time kelas yang diampunya (hadir, terlambat, sakit, izin, belum scan, alfa).
  - **Monitoring Siswa Perwalian:** Melihat detail riwayat kehadiran seluruh siswa di kelasnya.
  - **Koreksi Presensi Kelas:** Melakukan koreksi status presensi siswa di kelas perwaliannya (misal siswa hadir tapi kartu QR tertinggal) dengan alasan tertulis (tercatat di audit log).
  - **Verifikasi Izin & Sakit:** Meninjau dan menyetujui/menolak surat keterangan izin atau sakit dari siswa kelasnya.
  - **Cetak Laporan & QR Kelas:** Mengunduh kartu QR dan laporan presensi khusus untuk kelas perwaliannya.
  - *Batasan:* Tidak memiliki akses ke data kelas lain, tidak dapat mengelola akun pengguna, dan tidak dapat mengubah konfigurasi sistem.

---

### 3.2 Subjek Presensi & Pengguna Portal Publik

#### Siswa (Pemegang Kartu QR)
- Membawa kartu QR (cetak fisik atau digital di smartphone) untuk dipindai saat jam masuk dan pulang sekolah.
- Mengakses portal publik mandiri:
  - `/cek-kehadiran`: Memeriksa riwayat kehadiran pribadi menggunakan NIS tanpa perlu akun login.
  - `/izin`: Mengajukan permohonan izin/sakit secara mandiri dengan mengunggah bukti/surat keterangan dokter.

#### Guru sebagai Subjek Presensi
- Memiliki kartu QR identitas guru untuk dipindai pada scanner saat tiba di sekolah dan saat pulang untuk mencatat kehadiran guru.

---

### 3.3 Matriks Hak Akses (Role-Permission Matrix)

| Modul / Tindakan | Superadmin | Admin | Guru / Wali Kelas | Siswa (Publik) |
|---|:---:|:---:|:---:|:---:|
| **Dashboard Ringkasan** | Seluruh Sekolah | Seluruh Sekolah | Kelas Sendiri | - |
| **Scanner QR (`/scanner`)** | ✅ Ya | ✅ Ya | ✅ Ya (Piket/Kelas) | ❌ Tidak |
| **Manajemen Pengguna (`/pengguna`)** | ✅ Ya (Full) | ❌ Tidak | ❌ Tidak | ❌ Tidak |
| **Manajemen Semester (`/semester`)** | ✅ Ya (Full) | ✅ Ya (Full) | ❌ Tidak | ❌ Tidak |
| **Kenaikan Kelas (`/kenaikan-kelas`)** | ✅ Ya (Full) | ✅ Ya (Full) | ❌ Tidak | ❌ Tidak |
| **Konfigurasi Sekolah & Hari Libur** | ✅ Ya (Full) | ❌ Tidak | ❌ Tidak | ❌ Tidak |
| **Audit Log (`/audit-log`)** | ✅ Ya (Lihat) | ❌ Tidak | ❌ Tidak | ❌ Tidak |
| **Kelola Data Siswa & Guru** | ✅ CRUD | ✅ CRUD | 👁️ Lihat Kelasnya | ❌ Tidak |
| **Generate & Cetak Kartu QR** | Semua Kelas | Semua Kelas | Kelas Sendiri | - |
| **Koreksi Presensi** | Semua Siswa/Guru | Semua Siswa/Guru | Siswa Kelas Sendiri | ❌ Tidak |
| **Verifikasi Pengajuan Izin/Sakit** | ✅ Ya | ✅ Ya | Siswa Kelas Sendiri | ❌ Tidak |
| **Ekspor Laporan PDF** | Semua Kelas | Semua Kelas | Kelas Sendiri | - |
| **Impor CSV** | ✅ Ya | ✅ Ya | ❌ Tidak | ❌ Tidak |
| **Portal Cek Kehadiran Mandiri** | - | - | - | ✅ Ya (Input NIS) |
| **Pengajuan Izin Publik** | - | - | - | ✅ Ya (Upload Bukti) |

## 4. Ruang Lingkup Fitur

Fitur dibagi menjadi dua tahap agar pengembangan tidak terlalu besar sejak awal.

### MVP — Wajib Tersedia

- Login dan role
- Dashboard
- CRUD siswa, guru, dan kelas
- QR Code
- Scanner
- Presensi masuk/pulang
- Koreksi presensi
- Laporan PDF
- Pengaturan hari kerja
- Impor CSV

### Tahap Berikutnya

- Pengajuan izin digital
- Portal cek kehadiran
- Poin keterlambatan
- Peringatan ketidakhadiran beruntun
- Notifikasi WhatsApp
- Backup/restore
- Monitoring real-time

### Daftar Modul dan Prioritas

| Modul | Kebutuhan utama | Prioritas |
|---|---|---|
| Autentikasi | Login, logout, kontrol akses berdasarkan role | P0 |
| Dashboard | Ringkasan kehadiran hari ini | P0 |
| Data siswa | Tambah, lihat, edit, nonaktifkan | P0 |
| Data guru | Tambah, lihat, edit, nonaktifkan | P0 |
| Data Kelas | CRUD kelas, penugasan wali kelas | P0 |
| QR Code | Generate, download, cetak per siswa/kelas | P0 |
| Scanner | Validasi QR, presensi masuk/pulang | P0 |
| Data presensi | Filter, koreksi, riwayat perubahan | P0 |
| Laporan | Filter periode dan ekspor PDF | P0 |
| Impor CSV | Impor siswa, guru, kelas | P1 |
| Kalender sekolah | Hari kerja dan hari libur | P1 |
| Izin/sakit | Pengajuan dan persetujuan | P1 |
| Keterlambatan | Perhitungan menit dan rekap pelanggaran | P1 |
| Portal publik | Cek kehadiran secara mandiri | P2 |
| Notifikasi WhatsApp | Informasi setelah presensi | P2 |
| Backup & restore | Pencadangan dan pemulihan data | P2 |

P0 merupakan kebutuhan MVP. P1 dan P2 dapat dikerjakan setelah alur utama stabil. Pembagian ini adalah rekomendasi prioritas pengembangan.

## 5. Alur Utama Aplikasi

### A. Alur Presensi Menggunakan QR Code

1. Guru piket atau Admin login ke sistem.
2. Petugas membuka halaman scanner.
3. Petugas memilih mode masuk atau pulang, lalu mengaktifkan kamera.
4. Sistem membaca token QR dan memvalidasi identitas.
5. Sistem memeriksa status pengguna, jadwal, hari libur, dan duplikasi scan.
6. Sistem menyimpan presensi ke MySQL dan menampilkan nama, kelas, waktu, serta status presensi.

Hasil scan harus memiliki tiga kondisi yang jelas:

- **Berhasil:** identitas dan waktu presensi ditampilkan.
- **Ditolak:** QR tidak dikenal, pengguna nonaktif, atau presensi tidak diizinkan.
- **Sudah tercatat:** scan duplikat tidak membuat catatan baru.

### B. Alur Pengelolaan QR Code

1. Admin menambahkan data siswa atau guru.
2. Sistem menghasilkan token QR unik yang terhubung ke identitas.
3. Admin membuka halaman kartu QR.
4. QR dapat diunduh sebagai gambar atau dicetak.
5. Admin dapat mencetak kartu secara massal, per kelas, atau per individu.

QR sebaiknya berisi token acak yang tidak mudah ditebak, bukan NIS, NIP, atau data pribadi secara langsung. Validasi tetap dilakukan di server.

### C. Alur Koreksi Presensi

1. Admin membuka menu Presensi.
2. Memilih tanggal, kelas, dan siswa/guru.
3. Mengubah status atau waktu dengan alasan koreksi.
4. Sistem menyimpan perubahan dan identitas petugas yang melakukan koreksi.
5. Riwayat perubahan tetap tersedia untuk audit.

## 6. Detail Kebutuhan Fungsional

### 6.1 Autentikasi dan Otorisasi

- Login menggunakan username atau email dan password.
- Password disimpan dalam bentuk hash yang aman (misalnya bcrypt atau argon2).
- Sistem hanya mengenal 3 role resmi pada level database dan sesi: `SUPERADMIN`, `ADMIN`, dan `GURU`.
- Hak akses diterapkan ketat di sisi server (Server Components, API routes, dan Middleware), bukan hanya menyembunyikan elemen menu di frontend.
- Superadmin mengelola pembuatan, pembaruan role, reset password, dan status aktif/nonaktif akun Admin dan Guru.
- Akun `GURU` wajib berelasi dengan tabel `teachers` dan opsional ke tabel `classes` (sebagai wali kelas).
- Akun berstatus nonaktif (`is_active = false`) dilarang melakukan login dan sesi aktifnya langsung dibatalkan.
- Sediakan fitur logout, proteksi terhadap brute-force, dan penanganan sesi yang aman.

### 6.2 Dashboard Admin & Superadmin

Informasi utama yang ditampilkan:

- Total siswa aktif dan total guru aktif.
- Statistik agregat kehadiran hari ini (hadir tepat waktu, terlambat, izin, sakit, belum scan, alfa).
- Feed aktivitas scan terbaru (real-time stream / tabel scan terkini beserta petugas scanner).
- Ringkasan tingkat kehadiran per kelas.
- Peringatan siswa dengan ketidakhadiran beruntun (misal 3 hari berturut-turut tanpa keterangan).
- Tidak semua statistik berupa kartu; prioritaskan angka ringkas di baris atas dan tabel interaktif sebagai komponen utama.

### 6.3 Dashboard Guru / Wali Kelas

- **Tampilan Khusus Wali Kelas:** Menampilkan data khusus untuk kelas yang diampu oleh guru tersebut (tidak melihat rekap kelas lain).
- **Statistik Kelas Hari Ini:** Total siswa di kelas, hadir, terlambat, izin, sakit, dan belum scan.
- **Daftar Presensi Siswa:** Filter status kehadiran siswa perwalian, pencarian nama/NIS.
- **Aksi Cepat Scanner:** Tombol pintas langsung menuju halaman `/scanner` untuk mode piket gerbang atau absensi kelas.
- **Koreksi Presensi:** Formulir koreksi presensi siswa kelasnya jika terjadi kendala (misal kartu tertinggal) dengan kewajiban mengisi alasan koreksi.
- **Persetujuan Izin/Sakit:** Meninjau berkas/alasan izin siswa kelasnya dan melakukan verifikasi terima/tolak.
- **Unduh Dokumen:** Mengunduh kartu QR siswa sekelas dan laporan kehadiran kelas dalam format PDF.

### 6.4 Scanner QR Code

- Meminta izin akses kamera ketika scanner dibuka.
- Mendukung kamera depan/belakang jika tersedia.
- Menampilkan status kamera dan pesan ketika izin ditolak.
- Mencegah pemrosesan berulang terhadap QR yang sama dalam satu proses scan.
- Menolak token tidak valid atau pengguna nonaktif.
- Memastikan presensi tidak tercatat dua kali untuk tanggal dan jenis presensi yang sama.
- Menampilkan waktu server sebagai waktu resmi presensi.
- Menyediakan alternatif input pencarian manual untuk kondisi kamera bermasalah, jika diizinkan role.

### 6.5 Aturan Status Kehadiran

| Status | Definisi |
|---|---|
| Hadir | Presensi masuk berhasil dicatat |
| Terlambat | Hadir setelah batas jam masuk |
| Izin | Pengajuan izin telah disetujui |
| Sakit | Pengajuan sakit telah disetujui |
| Belum Scan | Belum ada catatan masuk, status belum final |
| Alfa | Tidak hadir tanpa keterangan setelah batas finalisasi kehadiran |

**Penting:** Belum Scan dan Alfa bukan status yang sama. Alfa baru ditetapkan setelah aturan finalisasi kehadiran sekolah terpenuhi.

Sistem perlu menyimpan jam masuk, batas keterlambatan, dan batas finalisasi secara terkonfigurasi. Status tidak boleh ditentukan hanya dari apakah QR pernah dipindai.

### 6.6 Laporan

Laporan yang dibutuhkan:

- Rekap harian siswa.
- Rekap bulanan siswa.
- Rekap per kelas.
- Rekap kehadiran guru.
- Detail riwayat presensi individu.
- Rekap keterlambatan.
- Rekap izin, sakit, dan alfa.

Filter minimal: tanggal mulai, tanggal selesai, kelas, dan status, serta opsi pengelompokan per periode semester. Ekspor PDF harus mengikuti filter yang sedang aktif.

### 6.7 Manajemen Semester, Siklus Akademik & Keberlanjutan QR Code

Sistem menerapkan arsitektur pemisahan antara **absensi harian** dan **pergantian periode semester** dengan aturan sebagai berikut:

#### 1. Alur Kerja Selama Satu Semester
1. **Admin/Superadmin mengaktifkan semester:** Contoh: *Semester Ganjil 2026/2027* dengan tanggal mulai dan tanggal selesai.
2. **Kesiapan data:** Siswa terdaftar pada kelas dan terdaftar pada semester yang berlaku melalui riwayat penempatan (`student_enrollments`).
3. **Pencatatan Presensi Real-Time:** Setiap pemindaian QR saat masuk/pulang otomatis diasosiasikan oleh server ke `academic_term_id` yang sedang aktif saat itu.
4. **Rekapitulasi Semester:** Admin dan Wali Kelas dapat mencetak rekap hadir, terlambat, izin, sakit, dan alpa spesifik untuk satu semester penuh maupun rentang tanggal tertentu.

#### 2. Mekanisme Pergantian Semester (Transisi Periode)
Misalnya Semester Ganjil selesai pada bulan Desember dan Semester Genap dimulai pada bulan Januari:
1. **Penutupan Semester:** Admin menutup / menonaktifkan Semester Ganjil.
2. **Preservasi Data Riwayat:** Sistem mempertahankan seluruh data presensi Semester Ganjil secara utuh tanpa ada data yang dihapus.
3. **Pembukaan Semester Baru:** Admin membuat dan mengaktifkan Semester Genap (misal Semester Genap 2026/2027).
4. **Pembaruan Penempatan Kelas:** Dilakukan pembaruan penempatan kelas siswa (kenaikan kelas, siswa baru, mutasi) melalui tabel `student_enrollments`.
5. **Pencatatan Baru:** Pemindaian absensi berikutnya otomatis terikat pada Semester Genap.
6. **Identitas Siswa Tetap:** Data siswa tidak perlu dibuat ulang sebagai entitas baru; identitas siswa tetap utuh dan berkelanjutan.

#### 3. Kebijakan Keberlanjutan & Keabadian QR Code Siswa
- **QR Code Siswa Permanen:** Kartu QR Code siswa **TIDAK PERLU DIGANTI** atau dicetak ulang setiap pergantian semester.
- **Asosiasi Dinamis oleh Server:** QR Code memuat token acak ber-entropi tinggi yang terikat pada identitas permanen siswa. Penentuan semester mana yang dicatat dilakukan 100% oleh sistem di backend berdasarkan periode yang sedang aktif saat pemindaian:
  - *Scan pada bulan November* ➔ otomatis dicatat pada Semester Ganjil.
  - *Scan pada bulan Februari* ➔ otomatis dicatat pada Semester Genap.
- Keamanan: QR tidak memuat data pribadi telanjang (bukan teks mentah NIS/kelas) sehingga kartu fisik tetap aman dan tahan pakai selama siswa bersekolah di SD/SMP terkait.

### 6.8 Proses Kenaikan Kelas, Mutasi, dan Kelulusan Siswa

Sistem menyediakan modul khusus **Kenaikan Kelas (`/kenaikan-kelas`)** yang dirancang untuk memperbarui penempatan kelas siswa secara massal tanpa mengubah identitas unik atau kartu QR Code siswa.

#### 1. Alur & Contoh Kenaikan Kelas
Misalnya siswa bernama **Ahmad Fauzi** saat ini berada di **Kelas 7A**:
- **Tahun Ajaran 2026/2027 (Semester Ganjil):** Ahmad Fauzi — Kelas 7A (QR Code: aktif).
- **Proses Kenaikan Kelas:** Admin menjalankan modul kenaikan kelas menuju periode baru.
- **Tahun Ajaran Berikutnya (atau Semester Baru):** Ahmad Fauzi — Kelas 8A (QR Code: **tetap sama**, status: Naik Kelas).
- **Integritas Riwayat:** Catatan absensi saat Ahmad berada di Kelas 7A tetap tersimpan permanen dan terkait ke Kelas 7A. Pemindaian baru otomatis tercatat pada Kelas 8A.

#### 2. Alur Penggunaan di Aplikasi (`/kenaikan-kelas`)
1. **Pemilihan Konteks:** Admin memilih **Kelas Asal**, **Semester Asal**, dan **Semester Tujuan**.
2. **Daftar Siswa & Keputusan Status:** Sistem menampilkan daftar siswa di kelas asal. Admin dapat menentukan status untuk masing-masing siswa:
   - 🟢 **Naik Kelas (`NAIK_KELAS`):** Menentukan kelas tujuan baru (misal Kelas 8A).
   - 🟡 **Tinggal Kelas (`TINGGAL_KELAS`):** Siswa tetap terdaftar di kelas yang sama pada periode baru.
   - 🎓 **Lulus (`LULUS`):** Siswa telah menamatkan jenjang sekolah (misal kelas 6 SD atau kelas 9 SMP); akun siswa dinonaktifkan (`is_active = false`), riwayat absensi tetap utuh.
   - 🔴 **Pindah / Mutasi (`MUTASI`):** Siswa pindah sekolah; akun siswa dinonaktifkan (`is_active = false`), riwayat absensi tetap utuh.
3. **Otomasi Tindakan Massal (Bulk Action):** Admin dapat menggunakan tombol pintas *"Set Massal Naik ke [Kelas Tujuan]"* untuk memproses seluruh siswa dalam 1 klik.
4. **Pratinjau (Preview Modal):** Sebelum eksekusi, sistem menampilkan modal ringkasan (jumlah siswa naik, tinggal, lulus, mutasi).
5. **Konfirmasi & Eksekusi Transaksional:** Admin mengonfirmasi proses. Server memperbarui tabel `student_enrollments` dan `students.class_id` secara transaksional (`prisma.$transaction`) dengan pencatatan audit log lengkap.

#### 3. Penataan Database Penempatan Siswa
- **Tabel `students`:** Menyimpan identitas permanen siswa, NIS, nama, dan `qr_token_hash`.
- **Tabel `student_enrollments`:** Menyimpan riwayat penempatan siswa per kelas dan per semester (`student_id`, `class_id`, `academic_term_id`, `status`). Dengan tabel ini, histori perjalanan kelas siswa (7A ➔ 8A ➔ 9A) tersimpan rapi dan laporan masa lampau tidak akan terdistorsi.
- **Tabel `student_attendances`:** Menyimpan snapshot `class_id` dan `academic_term_id` pada setiap transaksi scan harian.

### 6.9 Modul Impor Data Massal via CSV (`/impor`)

Untuk mempercepat onboarding sekolah dengan ratusan siswa dan guru, sistem menyediakan fitur impor massal berbasis file spreadsheet (CSV).

#### 1. Kemampuan & Karakteristik
- **Template Download Dinamis:** Sistem menyediakan template resmi yang mengadopsi nama kelas riil dari database (`/api/templates/csv?type=students` dan `/api/templates/csv?type=teachers`).
- **Validasi Dua Tahap (Validate & Execute):**
  - Memeriksa kelengkapan kolom wajib (NIS, Nama, Jenis Kelamin, Kelas untuk siswa; Nama, Gender untuk guru).
  - Mendeteksi duplikasi NIS/NIP/Email di internal file CSV maupun terhadap database.
  - Memetakan nama kelas secara fleksibel (contoh: "Kelas 7A" atau "7A").
- **Otomasi QR Code & Semester:** Setiap baris data siswa baru otomatis dibuatkan `qr_token_hash` unik permanen dan langsung didaftarkan ke semester aktif (`student_enrollments`).
- **Opsi Akun Guru Otomatis:** Opsi pembuatan akun login role `GURU` (email & password default) secara massal.
- **Pencatatan Audit Trail:** Seluruh aksi impor massal terekam di tabel `audit_logs` dengan identitas user dan ringkasan jumlah baris yang berhasil diimpor.

## 7. Rancangan UI/UX

Arah visual yang direkomendasikan adalah **administrative tool yang sederhana, padat informasi, dan konsisten**.

### A. Dashboard Admin

- Sidebar kiri sederhana.
- Header berisi judul halaman dan profil akun.
- Ringkasan statistik seperlunya.
- Tabel aktivitas terbaru sebagai fokus utama.
- Tanpa hero banner atau grafik dekoratif.

### B. Halaman Scanner

- Area kamera menjadi elemen utama.
- Instruksi singkat: arahkan QR ke kamera.
- Indikator mode Masuk/Pulang selalu terlihat.
- Hasil scan muncul langsung tanpa dialog berlapis.
- Bunyi atau indikator visual opsional untuk keberhasilan dan kegagalan.

### C. Data Siswa dan Guru

- Tabel sebagai tampilan default.
- Search dan filter di atas tabel.
- Tombol Tambah Data berada di kanan atas.
- Form tambah/edit menggunakan halaman atau drawer sederhana.
- Aksi Edit, Detail, dan Nonaktifkan tersedia per baris.

### Design System Awal

| Elemen | Rekomendasi |
|---|---|
| Background | Abu-abu sangat muda atau putih |
| Surface | Putih |
| Teks utama | Abu-abu gelap |
| Warna aksen | Biru tua atau biru netral |
| Status berhasil | Hijau yang tidak terlalu terang |
| Status peringatan | Amber |
| Status gagal | Merah |
| Font | Inter atau font sans-serif sistem |
| Border radius | 6–10 px |
| Shadow | Minimal, hanya jika diperlukan |
| Ikon | Lucide dengan ukuran konsisten |
| Tabel | Baris ringkas, garis pembatas tipis |
| Tombol | Solid untuk aksi utama, outline untuk aksi sekunder |

### Prinsip UX

1. Jangan menjadikan semua informasi sebagai kartu.
2. Hindari gradient, efek glassmorphism, ilustrasi AI, dan animasi dekoratif.
3. Gunakan label status berbasis teks, bukan warna saja.
4. Sediakan loading, empty state, error state, dan konfirmasi aksi berisiko.
5. Tampilkan filter yang aktif dengan jelas.
6. Buat halaman scanner tetap mudah digunakan saat antrean presensi ramai.
7. Pastikan form memiliki validasi dan pesan kesalahan yang spesifik.
8. Utamakan penggunaan desktop untuk petugas, dengan layout responsif untuk tablet dan ponsel.
9. jika ada logo gunkana logo vektor 

## 8. Struktur Halaman dan Routing Next.js

Disarankan menggunakan Next.js App Router dengan TypeScript.

| Route | Fungsi | Hak Akses (Role) |
|---|---|---|
| `/login` | Halaman autentikasi login | Publik (Belum Login) |
| `/dashboard` | Dashboard ringkasan dinamis sesuai role | `SUPERADMIN`, `ADMIN`, `GURU` |
| `/scanner` | Pemindai QR kamera (Mode Masuk & Pulang) | `SUPERADMIN`, `ADMIN`, `GURU` |
| `/siswa` | Pengelolaan master data siswa & status | `SUPERADMIN`, `ADMIN`, `GURU` (hanya lihat kelasnya) |
| `/guru` | Pengelolaan master data guru & kontak | `SUPERADMIN`, `ADMIN` |
| `/kelas` | Manajemen data kelas & penugasan wali | `SUPERADMIN`, `ADMIN` |
| `/presensi/siswa` | Data monitoring kehadiran siswa | `SUPERADMIN`, `ADMIN`, `GURU` (hanya kelasnya) |
| `/presensi/guru` | Data monitoring kehadiran guru | `SUPERADMIN`, `ADMIN` |
| `/presensi/[id]` | Detail riwayat presensi & form koreksi | `SUPERADMIN`, `ADMIN`, `GURU` (hanya kelasnya) |
| `/qr-code` | Generate & cetak kartu QR individu/massal | `SUPERADMIN`, `ADMIN`, `GURU` (hanya kelasnya) |
| `/laporan` | Filter periode & ekspor rekap PDF | `SUPERADMIN`, `ADMIN`, `GURU` (hanya kelasnya) |
| `/pengajuan-izin` | Verifikasi persetujuan surat izin/sakit | `SUPERADMIN`, `ADMIN`, `GURU` (hanya kelasnya) |
| `/pengaturan/hari-kerja` | Konfigurasi jam & hari operasional | `SUPERADMIN` |
| `/pengaturan/hari-libur` | Konfigurasi tanggal libur kalender sekolah | `SUPERADMIN` |
| `/pengaturan` | Profil sekolah & parameter sistem | `SUPERADMIN` |
| `/pengguna` | Manajemen akun petugas & hak akses | `SUPERADMIN` |
| `/audit-log` | Log aktivitas sistem & jejak koreksi | `SUPERADMIN` |
| `/izin` | Portal mandiri pengajuan izin/sakit | Publik (Input NIS & Bukti) |
| `/cek-kehadiran` | Portal mandiri cek riwayat kehadiran | Publik (Input NIS) |

Route tahap lanjutan boleh disembunyikan sampai fiturnya tersedia. Setiap route terlindungi harus memeriksa sesi dan hak akses di server.

## 9. Teknologi yang Digunakan

| Bagian | Teknologi |
|---|---|
| Framework | Next.js App Router |
| Bahasa | TypeScript |
| UI | React dengan CSS biasa atau Tailwind CSS secara minimal |
| Komponen | Komponen internal sederhana, tanpa UI kit yang berlebihan |
| Database | MySQL |
| ORM | Prisma ORM |
| Scanner | ZXing untuk browser atau pustaka QR scanner setara |
| Generator QR | Pustaka generator QR berbasis JavaScript |
| Validasi | Zod |
| Autentikasi | Auth.js atau autentikasi berbasis sesi yang aman |
| PDF | Pustaka PDF yang kompatibel dengan lingkungan server |
| Import CSV | Parser CSV dengan validasi server |
| Deployment | Node.js hosting atau container, MySQL terkelola/self-hosted |

Rekomendasi ini merupakan rancangan stack. Integrasi WhatsApp, jika nantinya diperlukan, dibuat sebagai modul terpisah.

**Catatan teknis:** QR scanner membutuhkan akses kamera melalui browser. Pada lingkungan produksi, gunakan HTTPS. Pengujian lokal biasanya dapat dilakukan di `localhost`.

## 10. Rancangan Database MySQL

Struktur berikut adalah rancangan awal yang dapat diterapkan melalui Prisma migration.

### `academic_years`

`id`, `name` (contoh: "2026/2027"), `is_active`, `created_at`, `updated_at`.

### `academic_terms`

Periode semester dalam tahun ajaran. `id`, `academic_year_id`, `name` (contoh: "Semester Ganjil 2026/2027"), `semester` (enum: `'GANJIL'`, `'GENAP'`), `start_date`, `end_date`, `is_active`, `created_at`, `updated_at`.

### `student_enrollments`

Riwayat hubungan siswa, kelas, dan semester (penempatan kelas per periode). `id`, `student_id`, `class_id`, `academic_term_id`, `is_active`, `created_at`, `updated_at`.

### `users`

`id`, `name`, `email`, `password_hash`, `role` (enum: `'SUPERADMIN'`, `'ADMIN'`, `'GURU'`), `teacher_id` (opsional FK ke `teachers` jika role GURU), `is_active`, `created_at`, `updated_at`

### `students`

Identitas permanen siswa. `id`, `nis`, `nisn`, `name`, `gender`, `class_id` (kelas aktif), `qr_token_hash` (token QR permanen), `is_active`, `created_at`, `updated_at`.

### `teachers`

`id`, `nip`, `name`, `gender`, `phone`, `qr_token_hash`, `is_active`, `created_at`, `updated_at`

### `classes`

Data kelas. Kelas menyimpan nama kelas (contoh: "Kelas 7A", "Kelas 1B"), tingkat kelas (`grade`: 1..6 SD / 7..9 SMP), dan `teacher_id` untuk penugasan wali kelas. Entitas `majors` (jurusan) ditiadakan untuk penyesuaian jenjang SD dan SMP.

### `student_attendances` dan `teacher_attendances`

`id`, `student_id`/`teacher_id`, `academic_term_id` (relasi ke `academic_terms` untuk pengelompokan semester), `attendance_date`, `check_in_at`, `check_out_at`, `status`, `late_minutes`, `notes`, `created_by`, `updated_at`.

### `leave_requests`

Pengaju, tipe izin/sakit, tanggal mulai, tanggal selesai, alasan, bukti opsional, status persetujuan, `reviewer_id`, `reviewed_at`.

### `school_settings` dan `holidays`

Pengaturan jam masuk/pulang, toleransi terlambat, hari kerja, tanggal libur, dan konfigurasi finalisasi status alfa.

### `audit_logs`

`actor_id`, `action`, `entity_type`, `entity_id`, `old_values`, `new_values`, `created_at`.

### Aturan Database Penting

- Gunakan primary key dan foreign key yang sesuai.
- Terapkan unique constraint untuk NIS, NIP, dan email jika diwajibkan.
- Terapkan unique constraint pada kombinasi pengguna dan tanggal presensi.
- Gunakan transaksi database untuk operasi yang berkaitan.
- Simpan waktu presensi dalam standar yang konsisten dan tetapkan zona waktu sekolah.
- Token QR harus memiliki entropi yang cukup dan tidak bisa ditebak.
- Simpan hash token QR jika token dapat diverifikasi menggunakan mekanisme yang sesuai.
- Untuk laporan skala besar, tambahkan indeks pada tanggal presensi, kelas, status, dan identitas siswa/guru.
- Jangan menghapus catatan presensi hanya karena data siswa dinonaktifkan.

Satu keputusan penting: presensi masuk dan pulang sebaiknya menjadi satu catatan harian per pengguna, dengan kolom waktu masuk dan pulang. Ini mempermudah pencegahan duplikasi. Jika sekolah memiliki beberapa sesi per hari, struktur unik perlu disesuaikan dengan sesi tersebut.

## 11. Keamanan dan Integritas Data

- Validasi token QR dan hak akses dilakukan di server.
- Scanner tidak boleh menentukan sendiri status kehadiran tanpa validasi backend.
- Hindari menaruh informasi pribadi di dalam QR Code.
- Gunakan rate limiting pada endpoint scanner dan autentikasi.
- Terapkan proteksi CSRF jika menggunakan autentikasi berbasis cookie sesuai arsitektur.
- Lindungi endpoint laporan, impor, ekspor, dan koreksi presensi.
- Semua perubahan manual terhadap presensi dicatat dalam audit log.
- File CSV harus divalidasi sebelum disimpan ke database.
- Backup database harus disertai prosedur pemulihan yang diuji.
- Password default tidak boleh digunakan di lingkungan produksi.

QR Code statis dapat difoto atau disalin. Sistem ini membuktikan bahwa token QR valid, tetapi tidak otomatis membuktikan bahwa pemilik kartu hadir secara fisik. Pengawasan petugas tetap diperlukan untuk mengurangi penyalahgunaan.

## 12. Acceptance Criteria

Fitur dinyatakan memenuhi kebutuhan jika skenario berikut lolos pengujian:

- [ ] **Autentikasi:** Pengguna hanya dapat membuka halaman yang sesuai dengan role-nya.
- [ ] **QR valid:** Scan QR terdaftar menghasilkan presensi dengan waktu server.
- [ ] **QR tidak valid:** Scan QR tidak dikenal ditolak tanpa membuat catatan presensi.
- [ ] **Duplikasi:** Scan berulang tidak membuat presensi harian ganda.
- [ ] **Masuk dan pulang:** Sistem mencatat waktu masuk dan pulang sesuai mode yang dipilih.
- [ ] **Hari libur:** Scanner menolak presensi pada tanggal yang dikonfigurasi sebagai libur.
- [ ] **Keterlambatan:** Menit keterlambatan dihitung berdasarkan jam masuk yang dikonfigurasi.
- [ ] **Koreksi:** Perubahan manual menyimpan petugas, waktu, dan riwayat perubahan.
- [ ] **Laporan:** Hasil PDF sesuai dengan filter dan data pada database.
- [ ] **Impor CSV:** Baris valid diproses dan kesalahan baris ditampilkan secara jelas.
- [x] **CSRF (keamanan §11):** permintaan mutasi ber-`Origin` asing ditolak (HTTP 403), tanpa `Origin` (curl/internal) diizinkan, asal yang sama diizinkan — terverifikasi via smoke test produksi.
- [x] **Proteksi peran:** endpoint & halaman backup hanya dapat diakses Superadmin; role lain ditolak (HTTP 403) — terverifikasi.
- [x] **Backup & restore (§11):** ekspor seluruh tabel → impor kembali menghasilkan data identik (round-trip 277 baris, data riil utuh), snapshot cadangan tersimpan otomatis sebelum restorasi, dan unduhan snapshot menolak path traversal — terverifikasi.

## 13. Tahapan Pengembangan

1. **Tahap 1 — Fondasi aplikasi:** Setup Next.js, TypeScript, Prisma, MySQL, autentikasi, role, layout, dan komponen dasar.
2. **Tahap 2 — Master data:** CRUD siswa, guru, kelas, penugasan wali kelas, dan impor CSV.
3. **Tahap 3 — QR dan scanner:** Generate token, cetak kartu, integrasi kamera, validasi server, dan transaksi presensi masuk/pulang.
4. **Tahap 4 — Dashboard dan laporan:** Filter data, rekap harian, dashboard wali kelas, koreksi presensi, dan ekspor PDF.
5. **Tahap 5 — Aturan sekolah dan pengujian:** Hari kerja/libur, keterlambatan, finalisasi alfa, audit log, pengujian keamanan, dan backup.
6. **Tahap 6 — Pengembangan lanjutan:** Pengajuan izin publik, portal cek kehadiran, notifikasi WhatsApp, monitoring berkala, dan fitur lanjutan lainnya.

## 14. Di Luar Ruang Lingkup Versi Awal

- RFID card dan RFID reader.
- Integrasi perangkat keras RFID.
- Aplikasi native Android/iOS.
- Pengenalan wajah.
- Pelacakan lokasi GPS.
- Sistem penggajian.
- Integrasi sistem akademik eksternal.

## 15. Definition of Done

MVP dianggap siap digunakan ketika:

- Semua modul P0 tersedia dan lolos acceptance criteria.
- Database migration dapat dijalankan dari lingkungan kosong.
- Role dan otorisasi diuji di sisi server.
- Scanner bekerja pada perangkat dan browser target.
- Data presensi dapat ditelusuri serta dikoreksi secara auditabel.
- Laporan PDF konsisten dengan data tersimpan.
- Tidak ada menu atau alur RFID di UI maupun backend MVP.
- Dokumentasi instalasi, konfigurasi `.env`, backup, dan deployment tersedia.

---

## Rekomendasi Implementasi

Mulai dari **dashboard, master data, autentikasi, dan scanner QR** sebelum menambahkan fitur lanjutan. Bagian yang paling krusial bukan banyaknya komponen UI, tetapi ketepatan aturan presensi, pencegahan duplikasi, keamanan token QR, dan konsistensi data.

Untuk UI/UX, gunakan sidebar sederhana, tabel yang nyaman dibaca, form yang ringkas, dan halaman scanner yang bisa digunakan dengan cepat. Itu sudah cukup untuk menghasilkan aplikasi administrasi sekolah yang terasa profesional tanpa desain berlebihan.
