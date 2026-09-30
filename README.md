# RuangLatih

Ruang belajar pelatihan UMKM untuk **Pusat Pendampingan UMKM Sentra Cakung** — absensi, materi PDF, pre/post-test, tugas, evaluasi, dan laporan dalam satu aplikasi. Sertifikat diberikan fisik kepada peserta.

- **Frontend:** HTML/CSS/JavaScript murni (folder ini) → GitHub Pages
- **Backend:** Google Apps Script sebagai REST API (JSON) → data di Google Sheets, berkas di Google Drive
- **Desain:** "Serene Crimson" (maroon muda, Plus Jakarta Sans), mobile-first untuk peserta, dasbor desktop untuk admin & instruktur

## Peran

| Peran | Masuk dengan | Bisa |
|---|---|---|
| Peserta UMKM | Nama UMKM/Usaha + PIN 4 angka (wajib ganti saat pertama) | Absen, buka materi, pre/post-test, kumpul tugas, isi evaluasi, lihat nilai |
| Instruktur | Nama + kode akses | Kelola materi, soal, tugas & nilai untuk pelatihan miliknya |
| Super Admin | Username + kata sandi | Semua fitur, termasuk buka/tutup aktivitas, evaluasi, laporan |

## Fitur utama

- Dasbor admin per tahun (YTD) dengan panel live buka/tutup absensi, tes, tugas, evaluasi
- Pelatihan 1/2 hari, simpan draft, daftarkan UMKM (termasuk tambah UMKM baru dari form)
- **Absensi scan QR** tanpa login + tombol absen di aplikasi; ekspor daftar hadir PDF
- Bank materi PDF (unggah bertahap s.d. 50 MB), bank soal pre/post-test + rekap nilai per peserta
- Tugas (JPG/PNG/PDF) dengan penilaian instruktur, evaluasi kepuasan (CSI)
- Database Peserta UMKM & Instruktur, Manajemen Akses (PIN, kode akses, admin), log aktivitas dengan nama
- Laporan rekap per program + unduh Excel/PDF
- Antarmuka instan (cache lokal + cache server, pemanasan data, optimistic UI)

## Struktur

```
index.html
css/style.css
js/config.js      ← satu-satunya file yang perlu diubah (GAS_URL, WA admin)
js/api.js         ← komunikasi ke Apps Script (retry otomatis, unggah bertahap)
js/ui.js          ← ikon, modal, toast, grafik SVG
js/kelola.js      ← modul bersama admin & instruktur
js/peserta.js     ← tampilan peserta (HP)
js/instruktur.js  ← portal instruktur
js/admin.js       ← portal super admin
js/app.js         ← halaman masuk, kerangka, router
```

Cara pemasangan lengkap ada di **PANDUAN-INSTALASI.md**.
