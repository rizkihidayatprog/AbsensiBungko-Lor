export const DEFAULT_WA_TEMPLATES = {
  hadir: `Assalamu'alaikum Wr. Wb. / Salam Sejahtera,

Yth. Bapak/Ibu {nama_ortu},
Memberitahukan bahwa putra/putri Anda:

👤 Nama: {nama_siswa}
🏫 Kelas: {kelas}
⏰ Waktu Hadir: {jam} WIB
📅 Tanggal: {tanggal}

Telah *HADIR TEPAT WAKTU* di {sekolah}.

Terima kasih atas kerja samanya.
_Pesan otomatis dari Sistem Presensi {sekolah}_`,

  terlambat: `Assalamu'alaikum Wr. Wb. / Salam Sejahtera,

Yth. Bapak/Ibu {nama_ortu},
Memberitahukan bahwa putra/putri Anda:

👤 Nama: {nama_siswa}
🏫 Kelas: {kelas}
⏰ Waktu Hadir: {jam} WIB
⏱️ Keterlambatan: {menit_terlambat} menit
📅 Tanggal: {tanggal}

Tercatat *TERLAMBAT* di {sekolah}. Mohon perhatian dan kerja sama Bapak/Ibu agar ananda dapat hadir tepat waktu.

Terima kasih.
_Pesan otomatis dari Sistem Presensi {sekolah}_`,

  izin: `Assalamu'alaikum Wr. Wb. / Salam Sejahtera,

Yth. Bapak/Ibu {nama_ortu},
Permohonan keterangan *{status}* untuk putra/putri Anda:

👤 Nama: {nama_siswa}
🏫 Kelas: {kelas}
📅 Tanggal: {tanggal}
📝 Keterangan: {alasan}

Telah berhasil dicatat oleh pihak sekolah ({sekolah}).

Terima kasih.
_Pesan otomatis dari Sistem Presensi {sekolah}_`,

  alfa: `⚠️ *PEMBERITAHUAN KETIDAKHADIRAN (ALFA)* ⚠️

Assalamu'alaikum Wr. Wb. / Salam Sejahtera,

Yth. Bapak/Ibu {nama_ortu},
Putra/putri Anda:

👤 Nama: {nama_siswa}
🏫 Kelas: {kelas}
📅 Tanggal: {tanggal}

Hingga saat ini belum hadir di {sekolah} tanpa keterangan (*ALFA*). Mohon segera menghubungi pihak sekolah atau wali kelas untuk konfirmasi keberadaan ananda.

Terima kasih atas perhatiannya.
_Pesan otomatis dari Sistem Presensi {sekolah}_`,
};
