# 📋 Panduan Instalasi — RuangLatih

RuangLatih terdiri dari dua bagian yang dipasang terpisah:

| Bagian | Isi | Dipasang di |
|---|---|---|
| **Backend** | 5 file `.gs` utama (Kode, Pelatihan, Admin, Peserta, Laporan) + 1 file alat (Bersihkan) | Google Apps Script (akun Google PPU) |
| **Frontend** | Folder `ruanglatih/` hasil ekstrak ZIP: `index.html`, `css/`, `js/` | GitHub Pages (gratis) |

Urutan wajib: **Backend dulu → salin URL `/exec` → isi `js/config.js` → baru Frontend.**

---

## BAGIAN A — Backend (Google Apps Script)

> Gunakan **akun Google milik PPU** (bukan akun pribadi), karena semua data, materi, dan sertifikat akan tersimpan di Google Drive akun ini.

### A1. Buat proyek
1. Buka **https://script.google.com** → **Proyek baru**.
2. Klik judul "Proyek tanpa judul" → ganti menjadi **RuangLatih API**.
3. Klik ⚙️ **Setelan Proyek** (ikon roda gigi di kiri) → **Zona waktu** → pilih **(GMT+07:00) Jakarta**.

### A2. Tempel 5 file kode
1. Kembali ke ikon **< > Editor**.
2. File `Code.gs` yang sudah ada → klik ⋮ → **Ganti nama** → `Kode` → hapus isinya → tempel seluruh isi **Kode.gs**.
3. Klik **+** (Tambahkan file) → **Skrip** → beri nama `Pelatihan` → tempel isi **Pelatihan.gs**.
4. Ulangi untuk `Admin`, `Peserta`, dan `Laporan`.
5. *(Opsional)* Tambahkan juga `Bersihkan` bila nanti perlu membersihkan data uji (lihat Bagian G).
6. Tekan **Ctrl+S** (Simpan). Pastikan ada 5 file utama di panel kiri.

### A3. Jalankan setup — HANYA SEKALI
1. Buka file **Kode**, di bilah atas pilih fungsi **setupAppEnvironment** → klik **▶ Jalankan**.
2. Muncul "Otorisasi diperlukan" → **Tinjau izin** → pilih akun PPU → **Lanjutan** → **Buka RuangLatih API (tidak aman)** → **Izinkan**.
   *(Peringatan "tidak aman" muncul karena skrip buatan sendiri belum diverifikasi Google — ini normal.)*
3. Lihat **Log eksekusi** di bawah. Harus muncul:
   - `✅ Folder root: …`
   - `✅ 16 sheet dibuat.`
   - `✅ Setup selesai!`
4. Cek Google Drive: ada folder **📁 RuangLatih** berisi `Materi`, `Flyer`, `Tugas`, `Sertifikat`, `Template`, `Exports`, dan spreadsheet **Database — RuangLatih**.

5. **Pembersihan log otomatis:** pilih fungsi **`pasangJadwalLog`** → ▶ Jalankan (sekali saja). Log aktivitas akan dihapus otomatis setiap **hari terakhir bulan** (±23.00 WIB) agar penyimpanan hemat. Statusnya terlihat di menu **Pengaturan**. Untuk menghentikan: jalankan `hentikanJadwalLog`.

> ⚠️ Jangan jalankan `setupAppEnvironment` dua kali. Kalau terlanjur, skrip akan menolak dan menampilkan alamat spreadsheet yang sudah ada.

**Opsional — data uji coba:** pilih fungsi **isiDataContoh** → ▶ Jalankan. Akan dibuat:
- Instruktur: nama **Bagas Wicaksono**, kode **INS-2026**
- 4 peserta, mis. Nama UMKM **Dapur Berkah Bu Ani**, PIN **1234** (wajib ganti saat masuk)
- 1 pelatihan 2 hari dengan 5 soal dan 1 tugas

Sebelum dipakai sungguhan, bersihkan data contoh dengan file `Bersihkan` (Bagian G) — jangan hapus manual di spreadsheet.

### A4. Deploy sebagai Web App
1. Kanan atas: **Terapkan** → **Deployment baru**.
2. Ikon ⚙️ di samping "Pilih jenis" → **Aplikasi web**.
3. Isi:
   - Deskripsi: `RuangLatih v1`
   - **Jalankan sebagai: Saya** (akun PPU)
   - **Yang memiliki akses: Siapa saja**
4. **Terapkan** → salin **URL aplikasi web** (berakhiran `/exec`).
5. Uji: tempel URL itu di tab browser baru. Harus tampil teks seperti
   `{"success":true,"app":"RuangLatih","versi":"1.0.0",…,"siap":true}`

> "Siapa saja" **bukan berarti data terbuka**. Setiap permintaan tetap wajib membawa token login, dan hak akses Admin/Instruktur/Peserta diperiksa di server.

### A5. Kalau nanti kode backend diubah
**Terapkan → Kelola deployment → ✏️ Edit → Versi: Versi baru → Terapkan.**
Dengan cara ini URL `/exec` **tetap sama**, jadi frontend tidak perlu diubah. (Jangan membuat "Deployment baru" lagi — URL-nya akan berganti.)

---

## BAGIAN B — Isi konfigurasi frontend

1. Ekstrak **ruanglatih.zip**. Hasilnya folder **`ruanglatih`** yang langsung berisi `index.html`, `css`, `js`, `README.md`, dan panduan ini.
2. Buka **`ruanglatih/js/config.js`** dengan Notepad / VS Code, lalu ubah:

```js
const GAS_URL = 'https://script.google.com/macros/s/TEMPEL_ID_DEPLOYMENT_DI_SINI/exec';
```
menjadi URL `/exec` dari langkah A4. Isi juga nomor WhatsApp admin (format `62…`, tanpa `+` dan tanpa spasi):

```js
waAdmin: '6281234567890'
```

3. Simpan. Hanya file ini yang perlu diubah.

---

## BAGIAN C — Frontend ke GitHub Pages (lewat terminal)

> ❗ **Jangan** memakai tombol "Add file → Upload files" di situs GitHub. Cara itu meratakan semua file di root sehingga `css/` dan `js/` hilang dan tampilan rusak. Selalu lewat terminal.

### C1. Pasang Git (sekali per komputer)
- **Windows:** unduh https://git-scm.com/download/win → install dengan pilihan bawaan → buka **PowerShell**.
- **Mac:** buka Terminal, ketik `git --version` → ikuti tawaran instalasi.

Cek:
```bash
git --version
```

### C2. Akun GitHub & identitas Git
Daftar di https://github.com bila belum punya. Username akan menjadi bagian alamat situs (`username.github.io`). Lalu sekali saja:
```bash
git config --global user.name "Nama Anda"
git config --global user.email "email-akun-github@contoh.com"
```

### C3. Buat repository
github.com → **+** → **New repository** → nama misalnya `ruanglatih` → pilih **Public** → **jangan** centang README/.gitignore/license → **Create repository**. Biarkan halaman itu terbuka.

### C4. Masuk ke folder yang BENAR — `ruanglatih`
Folder kerjanya adalah **folder `ruanglatih` hasil ekstrak ZIP** — folder yang di dalamnya langsung terlihat `index.html`. Di folder inilah `git init` dijalankan.

Cara cepat (Windows): buka folder `ruanglatih` di File Explorer → klik address bar → ketik `powershell` → Enter.

Cek isinya:
```powershell
dir
```
Wajib terlihat:
```
css
js
index.html
PANDUAN-INSTALASI.md
README.md
```
Kalau yang terlihat justru satu folder `ruanglatih` lagi, masuk dulu: `cd ruanglatih`, lalu `dir` ulang. **Jangan lanjut sebelum `index.html` terlihat.**

### C5. Kirim ke GitHub — satu perintah per langkah
```bash
git init
git add .
git commit -m "Upload pertama RuangLatih"
git branch -M main
git remote add origin https://github.com/USERNAME/ruanglatih.git
git push -u origin main
```
(ganti `USERNAME` dengan username GitHub Anda; perhatikan **titik** pada `git add .`)

Saat `git push` meminta login:
- **Username:** username GitHub
- **Password:** **Personal Access Token**, bukan kata sandi akun. Saat ditempel, layar memang tampak kosong — itu normal, tekan Enter.

**Membuat token:** buka https://github.com/settings/tokens → **Generate new token (classic)** → Note `ruanglatih` → Expiration 90 hari → centang **repo** → **Generate token** → salin `ghp_…` (hanya tampil sekali).

Berhasil bila muncul `Writing objects: 100%` dan `* [new branch] main -> main`.

### C6. Aktifkan Pages
Di repository: **Settings → Pages** →
- Source: **Deploy from a branch**
- Branch: **main** / **(root)** → **Save**
- Centang **Enforce HTTPS**

Tunggu 1–2 menit, muat ulang halaman Settings. Alamat aplikasi muncul:
**`https://USERNAME.github.io/ruanglatih/`**

### C7. Uji
1. Buka alamat di atas. Pojok kanan atas halaman masuk menampilkan **"Server Aktif"**.
2. Tab **Super Admin** → username `admin`, kata sandi `admin12345`.
3. **Segera ganti kata sandi**: menu **Manajemen Akses → Ganti kata sandi**.
4. Buka juga di HP dengan tab **Peserta UMKM**.

### C8. Memperbarui frontend nanti
Dari folder `ruanglatih`:
```bash
git add .
git commit -m "Perbarui tampilan"
git push
```
Bila masih tampil versi lama: **Ctrl+Shift+R** atau buka mode Incognito.

---

## BAGIAN D — Langkah pertama memakai aplikasi (Admin)

1. **Pengaturan** → **Identitas Aplikasi** (nama, tagline, logo, teks footer, warna utama, nomor WA admin) lalu cek nama lembaga dan format nomor sertifikat. Nomor WA di sini menggantikan `waAdmin` di `config.js`.
2. **Instruktur** → Tambah Instruktur → bagikan **nama + kode akses** kepada instruktur.
3. **Peserta** → Tambah UMKM satu per satu, atau **Impor** (salin kolom dari Excel/Google Form: nama_umkm, nama_pemilik, sektor, spesialisasi, no_hp, alamat, pin, gender). **Nama UMKM harus unik** karena dipakai peserta untuk masuk (Nama UMKM + PIN 4 angka).
4. **Manajemen Akses** → kirim info akses (Nama UMKM + PIN) ke peserta lewat tombol WhatsApp; kirim kode akses ke instruktur.
5. **Pelatihan** → Buat Pelatihan (pilih **1 Hari** atau **2 Hari**; bisa **Simpan Draft** dulu) → form **Daftarkan UMKM** terbuka otomatis (bisa langsung **Tambah UMKM Baru**).
6. Instruktur mengunggah **materi PDF**, menyusun **soal pre/post-test**, dan membuat **tugas**.
7. Hari-H: tab **Absensi** → **QR Absensi** → tampilkan layar penuh / cetak. Peserta scan QR, pilih hari, isi Nama UMKM & Nama Peserta — tercatat otomatis. Nyalakan **Pre-test**, lalu setelah materi **Post-test**, **Tugas**, dan **Evaluasi**. Pantau di **Pre-Pos Test → Rekap Nilai Peserta**.
8. **Sertifikat** → unggah template (lihat bagian E) → **Pratinjau** → **Terbitkan**.
9. **Laporan Rekap** → saring pelatihan/sektor/bulan → unduh **Excel** atau **PDF**. **Absensi** → **Ekspor PDF** untuk daftar hadir per pelatihan.

---

## BAGIAN E — Template sertifikat & laporan

**Sertifikat** — buat di PowerPoint atau Google Slides, **tepat 1 halaman**, lalu tulis penanda persis seperti ini di kotak teks:

| Penanda | Diganti dengan |
|---|---|
| `{{nama_umkm}}` | Nama UMKM |
| `{{nama_pemilik}}` | Nama pemilik |
| `{{judul_pelatihan}}` | Judul pelatihan |
| `{{tanggal_pelatihan}}` | mis. 24–25 September 2026 |
| `{{no_sertifikat}}` | mis. 001/RL-PPU/001/IX/2026 |

Unggah sebagai **template bawaan** (berlaku untuk semua pelatihan) atau **khusus** satu pelatihan. File PPTX dikonversi otomatis menjadi Google Slides di folder `Template`.

**Laporan (opsional)** — buat Google Sheets dengan kop/logo sesuai format PPU. Tulis `{{tabel}}` di sel tempat tabel mulai. Penanda lain yang boleh dipakai: `{{nama_lembaga}}` `{{judul_laporan}}` `{{periode}}` `{{judul_pelatihan}}` `{{sektor}}` `{{tanggal_cetak}}` `{{jumlah_peserta}}` `{{jumlah_lulus}}`. Tempel link-nya di **Pengaturan → Template laporan**. Tanpa template, laporan memakai format standar.

---

## BAGIAN F — Catatan teknis

- **Kolom tambahan di luar PRD** (dipakai sistem, jangan dihapus): `Pelatihan.status_aktivitas`, `Pelatihan.syarat_lulus`, `Pelatihan.id_template_sertifikat`, `Pelatihan.tgl_dibuat`, `Peserta_Pelatihan.tgl_daftar`, `Pengumpulan_Tugas.nama_file`, `Pengumpulan_Tugas.tipe_file`, `Pengaturan.keterangan`.
- Semua sel di spreadsheet disimpan sebagai **teks** agar nomor HP diawali 0 dan PIN tidak berubah. Bila mengedit langsung di Sheets, jangan ubah format sel.
- **Materi dan flyer** dibagikan "siapa saja yang memiliki link" agar bisa dibuka peserta di HP; tautannya hanya dikirim ke pengguna yang berhak. **Berkas tugas dan sertifikat tidak dibagikan publik.** Jika akun PPU adalah Google Workspace yang melarang berbagi ke luar domain, minta admin Workspace mengizinkan berbagi tautan untuk folder `Materi` dan `Flyer`.
- Kuota Apps Script akun Gmail gratis: ±20.000 panggilan URL per hari dan waktu eksekusi 6 menit per panggilan — cukup untuk 50 peserta serentak. Penerbitan sertifikat otomatis dipecah per ±4 menit.
- Batas ukuran: materi PDF 50 MB (diunggah bertahap), tugas 10 MB (foto diperkecil otomatis), flyer 5 MB, template PPTX 20 MB.

## BAGIAN G — Membersihkan data uji (sebelum dipakai riil)

1. Tambahkan file `Bersihkan` (isi **Bersihkan.gs**) di proyek Apps Script → Ctrl+S.
2. Jalankan **`lihatIsiData`** → cek jumlah data (tidak menghapus apa pun).
3. Pilih salah satu dan jalankan **dua kali dalam 5 menit** (jalankan pertama = pratinjau, kedua = menghapus):
   - **`kosongkanSemuaData`** → semua data uji dihapus (ubah `PERTAHANKAN.UMKM`/`INSTRUKTUR` ke `true` bila datanya sudah riil).
   - **`hapusDataContoh`** → hanya data contoh bawaan (Bagas, 4 UMKM contoh, pelatihan PL-001).
4. Selalu dipertahankan: Admin, Pengaturan, form evaluasi bawaan, folder Template. Cadangan spreadsheet dibuat otomatis; file Drive masuk Sampah (30 hari).
5. Semua pengguna otomatis keluar → masuk lagi. QR absensi yang pernah dicetak perlu dicetak ulang.
6. Setelah selesai, file `Bersihkan` boleh dihapus dari proyek. Jangan jalankan `isiDataContoh` lagi.

Bila mengedit isi spreadsheet secara langsung, jalankan **`bersihkanCache`** agar perubahan langsung terbaca aplikasi (tanpa itu, paling lambat 10 menit).

## Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| Halaman "GAS_URL belum diisi" | `js/config.js` belum diubah | Isi URL `/exec`, lalu `git add .` → `commit` → `push` |
| "Server belum terhubung" di halaman masuk | URL salah atau akses bukan "Siapa saja" | Cek A4; buka URL `/exec` langsung di browser |
| "Aplikasi belum di-setup" | `setupAppEnvironment` belum dijalankan | Jalankan A3 |
| GitHub Pages 404 | `git init` di folder yang salah | Pastikan `index.html` terlihat di root repository; ulangi C4–C5 dari folder `ruanglatih` |
| Tampilan tanpa warna (CSS 404) | Diunggah lewat web GitHub | Push ulang lewat terminal (C5) |
| Perubahan backend tidak berlaku | Deployment belum diperbarui | Lakukan A5 (Versi baru) |
| Materi/flyer tidak tampil untuk peserta | Kebijakan berbagi Workspace | Lihat catatan berbagi di Bagian F |
| Peserta "Akun dikunci 15 menit" | 5 kali salah PIN | Tunggu 15 menit, atau Admin → Manajemen Akses → Akun Peserta → Reset PIN |
| Peserta tidak bisa masuk padahal PIN benar | Nama UMKM ganda / salah ketik | Cek tanda "nama ganda" di Manajemen Akses, ubah nama di menu Peserta |
| Menu Pengaturan: "Pembersihan log belum aktif" | Jadwal belum dipasang | Jalankan `pasangJadwalLog` sekali di editor Apps Script |
| Scan QR "tidak terdaftar" | UMKM belum didaftarkan ke pelatihan itu | Detail pelatihan → Daftarkan UMKM |
