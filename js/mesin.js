/* =============================================================
   RuangLatih — mesin.js  (DIBANGUN OTOMATIS — jangan diedit manual)
   Logika backend yang sama dengan GAS, dijalankan di browser di atas
   salinan data Firestore (mode Firebase). Sumber: Kode/Pelatihan/Admin/
   Peserta/Laporan/Cermin.gs · dibangun 2026-09-27
   ============================================================= */
var MESIN = (function () {

  // ---------- Pengganti layanan GAS di browser (tidak dipakai oleh aksi yang berjalan di sini) ----------
  var _tz = 'Asia/Jakarta';
  function _fmt(d, tz, pola) {
    var p = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: tz || _tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
      .formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
    if (p.hour === '24') p.hour = '00';
    return String(pola).replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute).replace('ss', p.second);
  }
  function _tolak() { throw new Error('Fitur ini dijalankan di server.'); }
  var PropertiesService = { getScriptProperties: function () { return { getProperties: function () { return {}; }, getProperty: function () { return null; }, setProperty: function () { }, setProperties: function () { } }; } };
  var CacheService = { getScriptCache: function () { return { get: function () { return null; }, put: function () { }, remove: function () { }, removeAll: function () { }, getAll: function () { return {}; }, putAll: function () { } }; } };
  var LockService = { getScriptLock: function () { return { tryLock: function () { return true; }, waitLock: function () { }, releaseLock: function () { } }; } };
  var SpreadsheetApp = { flush: function () { }, openById: _tolak, create: _tolak };
  var Utilities = { formatDate: _fmt, getUuid: function () { return (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); }, sleep: function () { },
    computeHmacSha256Signature: _tolak, computeDigest: _tolak, newBlob: _tolak, base64Encode: _tolak, base64Decode: _tolak, base64EncodeWebSafe: _tolak, Charset: {}, DigestAlgorithm: {} };
  var DriveApp = { getFileById: _tolak, getFolderById: _tolak }, UrlFetchApp = { fetch: _tolak }, ScriptApp = { getOAuthToken: _tolak, getProjectTriggers: _tolak, newTrigger: _tolak };
  function aksiQrKode() { _tolak(); } // didefinisikan di Firebase.gs (khusus server)
  var SlidesApp = { openById: _tolak }, ContentService = { createTextOutput: _tolak, MimeType: {} }, MimeType = {}, Logger = { log: function () { } }, Session = {};

// ==================== Kode.gs ====================
/**
 * ============================================================
 *  RuangLatih — Backend REST API (Google Apps Script)
 *  File 1/5 : Kode.gs
 *  Isi      : konfigurasi, router doGet/doPost, akses data Sheets,
 *             sesi (token), login, dan setupAppEnvironment()
 * ============================================================
 *  Semua komunikasi memakai POST dengan body JSON bertipe
 *  text/plain: { action, token, data } → balasan JSON
 *  { success, data | message, code?, busy? }
 * ============================================================
 */

const APP_NAME = 'RuangLatih';
const VERSI = '1.0.0';
const TZ = 'Asia/Jakarta';
const SESI_JAM = 6;
const SEKTOR = ['Kuliner', 'Kerajinan', 'Pertanian', 'Manufaktur'];
const MB = 1024 * 1024;
const MAX_MATERI = 50 * MB;
const MAX_TUGAS = 10 * MB;
const MAX_GAMBAR = 5 * MB;
const MAX_TEMPLATE = 20 * MB;
const CHUNK = 4 * MB; // kelipatan 256 KB (syarat unggah bertahap Drive)

// ============================================
// KONFIGURASI — semua ID dibaca dari Script Properties
// (terisi otomatis oleh setupAppEnvironment)
// ============================================
const CONFIG = {
  // ⚡ Semua properti dibaca SEKALI per permintaan (dibaca ulang bila ada kunci yang belum ada, mis. saat setup)
  prop(k) {
    if (!this._p || this._p[k] === undefined || this._p[k] === null) this._p = PropertiesService.getScriptProperties().getProperties();
    return this._p[k] || null;
  },
  get SPREADSHEET_ID() { return this.prop('SPREADSHEET_ID'); },
  get ROOT_FOLDER_ID() { return this.prop('ROOT_FOLDER_ID'); },
  get FOLDER_MATERI() { return this.prop('FOLDER_MATERI'); },
  get FOLDER_FLYER() { return this.prop('FOLDER_FLYER'); },
  get FOLDER_TUGAS() { return this.prop('FOLDER_TUGAS'); },
  get FOLDER_SERTIFIKAT() { return this.prop('FOLDER_SERTIFIKAT'); },
  get FOLDER_TEMPLATE() { return this.prop('FOLDER_TEMPLATE'); },
  get FOLDER_EXPORTS() { return this.prop('FOLDER_EXPORTS'); }
};

// Struktur sheet (kolom tambahan di luar PRD ditandai di PANDUAN).
// Sheet/kolom baru ditambahkan otomatis pada instalasi lama saat pertama dipakai.
const SKEMA = {
  UMKM: ['id_umkm', 'nama_umkm', 'nama_pemilik', 'sektor', 'spesialisasi', 'no_hp', 'alamat', 'pin', 'wajib_ganti_pin', 'status_akun', 'tgl_dibuat', 'gender'],
  Instruktur: ['id_instruktur', 'nama', 'kode_akses', 'tema_diajar', 'status', 'institusi', 'no_hp'],
  Admin: ['username', 'password_hash', 'nama'],
  Pelatihan: ['id_pelatihan', 'judul', 'tema', 'cakupan', 'sektor', 'id_instruktur', 'jumlah_hari', 'tanggal_mulai', 'tanggal_selesai', 'jam', 'format', 'lokasi_atau_link', 'kuota', 'status', 'id_flyer', 'status_aktivitas', 'syarat_lulus', 'id_template_sertifikat', 'tgl_dibuat', 'link_dokumentasi'],
  Peserta_Pelatihan: ['id_pelatihan', 'id_umkm', 'status_lulus', 'no_sertifikat', 'id_file_sertifikat', 'tgl_daftar', 'nama_peserta', 'gender_peserta', 'hp_peserta'],
  Materi: ['id_materi', 'id_pelatihan', 'judul', 'cakupan', 'sektor', 'id_file', 'ukuran_file', 'urutan', 'diunggah_oleh', 'tgl'],
  Bank_Soal: ['id_soal', 'id_pelatihan', 'jenis', 'pertanyaan', 'opsi_a', 'opsi_b', 'opsi_c', 'opsi_d', 'opsi_e', 'kunci', 'urutan'],
  Hasil_Tes: ['id_pelatihan', 'id_umkm', 'jenis', 'jawaban', 'jumlah_benar', 'skor', 'waktu_selesai'],
  Absensi: ['id_pelatihan', 'id_umkm', 'hari_ke', 'tanggal', 'waktu_absen', 'metode'],
  Tugas: ['id_tugas', 'id_pelatihan', 'judul', 'instruksi', 'batas_waktu', 'dibuat_oleh'],
  Pengumpulan_Tugas: ['id_tugas', 'id_umkm', 'id_file', 'nama_file', 'tipe_file', 'waktu_kumpul', 'skor', 'catatan_instruktur', 'dinilai_oleh', 'waktu_dinilai'],
  Evaluasi_Pertanyaan: ['id_pelatihan', 'bagian', 'nomor', 'pertanyaan', 'tipe'],
  Evaluasi_Jawaban: ['id_pelatihan', 'id_umkm', 'jawaban', 'waktu_isi'],
  Pengaturan: ['kunci', 'nilai', 'keterangan'],
  Log_Aktivitas: ['waktu', 'peran', 'id_pengguna', 'aksi'],
  Draft_Pelatihan: ['id_draft', 'judul', 'data', 'dibuat_oleh', 'tgl_diubah']
};

// ============================================
// ENTRY POINTS
// ============================================
function doGet(e) {
  // Cek kesehatan API: buka URL /exec di browser
  return json({ success: true, app: APP_NAME, versi: VERSI, waktu: now(), siap: !!CONFIG.SPREADSHEET_ID });
}

function doPost(e) {
  try {
    const p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const r = rute()[p.action];
    if (!r) return json({ success: false, message: 'Aksi tidak dikenal: ' + p.action });

    let sesi = null;
    if (r.peran) {
      sesi = verifikasiToken(p.token);
      if (!sesi) return json({ success: false, code: 'SESI', message: 'Sesi berakhir, silakan masuk kembali.' });
      if (r.peran.indexOf(sesi.r) < 0) return json({ success: false, code: 'AKSES', message: 'Anda tidak memiliki akses ke fitur ini.' });
      if (sesi.gp && !r.gp) return json({ success: false, code: 'GANTI_PIN', message: 'Ganti PIN terlebih dahulu.' });
    }
    // ⚡ Idempoten: permintaan tulis yang dikirim ulang (sinyal putus/timeout) tidak dijalankan dua kali
    const rid = /^[A-Za-z0-9_-]{8,40}$/.test(String(p.rid || '')) ? 'rid_' + p.rid : '';
    const cc = rid ? CacheService.getScriptCache() : null;
    if (rid) {
      for (let i = 0; i < 25; i++) {
        const lama = cc.get(rid);
        if (!lama) break;
        if (lama !== 'RUN') return ContentService.createTextOutput(lama).setMimeType(ContentService.MimeType.JSON);
        Utilities.sleep(1000); // permintaan pertama masih diproses → tunggu hasilnya
      }
      cc.put(rid, 'RUN', 600);
    }
    let data;
    const fbMode = p.mode === 'firebase' && typeof FB !== 'undefined' && FB.siap();
    try { data = fbMode ? denganCermin(p.action, p.data || {}, sesi, () => r.fn(p.data || {}, sesi)) : r.fn(p.data || {}, sesi); }
    catch (e) { if (rid) cc.remove(rid); throw e; }
    SCACHE.terapkan();
    const keluar = JSON.stringify({ success: true, data: data === undefined ? null : data });
    if (rid) { if (keluar.length < 95000) cc.put(rid, keluar, 600); else cc.remove(rid); }
    return ContentService.createTextOutput(keluar).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    try { SCACHE.terapkan(); } catch (e) { }
    return json({ success: false, busy: !!err.busy, message: (err && err.message) || String(err) });
  }
}

/**
 * ⚡ Prinsip 4 (batch): beberapa aksi BACA sekaligus dalam 1 permintaan.
 * Dipakai frontend untuk memanaskan data semua menu di latar belakang,
 * sehingga perpindahan menu terasa instan. Hanya aksi baca yang diizinkan.
 */
const AKSI_BACA = ['pelatihan_list', 'pelatihan_detail', 'materi_list', 'soal_list', 'tugas_list', 'nilai_rekap', 'dasbor_instruktur',
  'dasbor_admin', 'draft_list', 'umkm_list', 'umkm_riwayat', 'instruktur_list', 'eval_form', 'eval_hasil', 'pengaturan_get', 'admin_list', 'log_list', 'sert_status', 'laporan_data',
  'p_beranda', 'p_pelatihan', 'p_ruang', 'p_materi', 'p_riwayat', 'p_sertifikat'];
function aksiMulti(d, sesi) {
  const calls = (d.calls || []).slice(0, 20), R = rute();
  return calls.map(c => {
    try {
      if (AKSI_BACA.indexOf(c.action) < 0) throw new Error('Aksi tidak boleh digabung: ' + c.action);
      const r = R[c.action];
      if (r.peran.indexOf(sesi.r) < 0) throw new Error('Tidak ada akses.');
      if (sesi.gp && !r.gp) throw new Error('Ganti PIN terlebih dahulu.');
      return { success: true, data: r.fn(c.data || {}, sesi) };
    } catch (e) { return { success: false, message: e.message }; }
  });
}

// Peta aksi → fungsi. Dibuat di dalam fungsi agar fungsi di file lain sudah terdefinisi.
function rute() {
  const A = ['admin'], I = ['instruktur'], P = ['peserta'], AI = ['admin', 'instruktur'], SEMUA = ['admin', 'instruktur', 'peserta'];
  return {
    // --- Sesi & akun
    login: { fn: aksiLogin },
    sesi: { peran: SEMUA, fn: aksiSesi, gp: true },
    multi: { peran: SEMUA, fn: aksiMulti },
    fb_token: { peran: SEMUA, fn: aksiFbToken, gp: true },
    qr_kode: { peran: A, fn: aksiQrKode },
    branding: { fn: aksiBranding },  // publik: identitas aplikasi untuk halaman masuk
    qr_info: { fn: aksiQrInfo },     // publik: halaman scan QR absensi (tanpa login)
    qr_absen: { fn: aksiQrAbsen },
    ganti_pin: { peran: P, fn: aksiGantiPin, gp: true },
    ganti_password: { peran: A, fn: aksiGantiPassword },

    // --- Bersama Admin & Instruktur (Pelatihan.gs)
    pelatihan_list: { peran: AI, fn: aksiPelatihanList },
    pelatihan_detail: { peran: AI, fn: aksiPelatihanDetail },
    materi_list: { peran: AI, fn: aksiMateriList },
    materi_hapus: { peran: AI, fn: aksiMateriHapus },
    upload_init: { peran: AI, fn: aksiUploadInit },
    upload_chunk: { peran: AI, fn: aksiUploadChunk },
    soal_list: { peran: AI, fn: aksiSoalList },
    soal_simpan: { peran: AI, fn: aksiSoalSimpan },
    soal_simpan_banyak: { peran: AI, fn: aksiSoalSimpanBanyak },
    soal_hapus: { peran: AI, fn: aksiSoalHapus },
    tugas_list: { peran: AI, fn: aksiTugasList },
    tugas_simpan: { peran: AI, fn: aksiTugasSimpan },
    tugas_hapus: { peran: AI, fn: aksiTugasHapus },
    tugas_nilai: { peran: I, fn: aksiTugasNilai },
    tugas_file: { peran: SEMUA, fn: aksiTugasFile },
    nilai_rekap: { peran: AI, fn: aksiNilaiRekap },
    dasbor_instruktur: { peran: I, fn: aksiDasborInstruktur },

    // --- Admin (Admin.gs)
    dasbor_admin: { peran: A, fn: aksiDasborAdmin },
    umkm_list: { peran: A, fn: aksiUmkmList },
    umkm_simpan: { peran: A, fn: aksiUmkmSimpan },
    umkm_reset_pin: { peran: A, fn: aksiUmkmResetPin },
    umkm_status: { peran: A, fn: aksiUmkmStatus },
    umkm_import: { peran: A, fn: aksiUmkmImport },
    umkm_riwayat: { peran: A, fn: aksiUmkmRiwayat },
    instruktur_list: { peran: A, fn: aksiInstrukturList },
    instruktur_simpan: { peran: A, fn: aksiInstrukturSimpan },
    pelatihan_simpan: { peran: A, fn: aksiPelatihanSimpan },
    pelatihan_hapus: { peran: A, fn: aksiPelatihanHapus },
    draft_list: { peran: A, fn: aksiDraftList },
    draft_simpan: { peran: A, fn: aksiDraftSimpan },
    draft_hapus: { peran: A, fn: aksiDraftHapus },
    pelatihan_flyer: { peran: A, fn: aksiPelatihanFlyer },
    peserta_daftarkan: { peran: A, fn: aksiPesertaDaftarkan },
    peserta_ubah: { peran: A, fn: aksiPesertaUbah },
    peserta_hapus: { peran: A, fn: aksiPesertaHapus },
    aktivitas_set: { peran: A, fn: aksiAktivitasSet },
    syarat_set: { peran: A, fn: aksiSyaratSet },
    eval_form: { peran: A, fn: aksiEvalForm },
    eval_simpan_form: { peran: A, fn: aksiEvalSimpanForm },
    eval_salin: { peran: A, fn: aksiEvalSalin },
    eval_hasil: { peran: A, fn: aksiEvalHasil },
    pengaturan_get: { peran: A, fn: aksiPengaturanGet },
    pengaturan_simpan: { peran: A, fn: aksiPengaturanSimpan },
    admin_list: { peran: A, fn: aksiAdminList },
    admin_simpan: { peran: A, fn: aksiAdminSimpan },
    admin_hapus: { peran: A, fn: aksiAdminHapus },
    log_list: { peran: A, fn: aksiLogList },

    // --- Sertifikat & Laporan (Laporan.gs)
    sert_status: { peran: A, fn: aksiSertStatus },
    sert_template: { peran: A, fn: aksiSertTemplate },
    sert_preview: { peran: A, fn: aksiSertPreview },
    sert_terbitkan: { peran: A, fn: aksiSertTerbitkan },
    laporan_data: { peran: A, fn: aksiLaporanData },
    absensi_export: { peran: A, fn: aksiAbsensiExport },
    laporan_export: { peran: A, fn: aksiLaporanExport },

    // --- Peserta (Peserta.gs)
    p_beranda: { peran: P, fn: aksiPBeranda },
    p_pelatihan: { peran: P, fn: aksiPPelatihan },
    p_ruang: { peran: P, fn: aksiPRuang },
    p_absen: { peran: P, fn: aksiPAbsen },
    p_soal: { peran: P, fn: aksiPSoal },
    p_kirim_tes: { peran: P, fn: aksiPKirimTes },
    p_kumpul_tugas: { peran: P, fn: aksiPKumpulTugas },
    p_eval_form: { peran: P, fn: aksiPEvalForm },
    p_kirim_eval: { peran: P, fn: aksiPKirimEval },
    p_materi: { peran: P, fn: aksiPMateri },
    p_riwayat: { peran: P, fn: aksiPRiwayat },
    p_sertifikat: { peran: P, fn: aksiPSertifikat },
    p_unduh_sertifikat: { peran: P, fn: aksiPUnduhSertifikat }
  };
}

// ============================================
// AKSES DATA (Google Sheets)
// Semua sel disimpan sebagai teks polos agar nomor HP/PIN
// tidak kehilangan angka 0 dan tanggal tidak berubah format.
// ============================================
const DB = {
  _ss: null,
  _m: {},
  ss() {
    if (!this._ss) {
      const id = CONFIG.SPREADSHEET_ID;
      if (!id) throw new Error('Aplikasi belum di-setup. Jalankan setupAppEnvironment() di editor Apps Script.');
      this._ss = SpreadsheetApp.openById(id);
    }
    return this._ss;
  },
  sh(n) {
    let s = this.ss().getSheetByName(n);
    if (!s && SKEMA[n]) { // sheet baru (pembaruan versi) dibuat otomatis
      s = this.ss().insertSheet(n);
      s.getRange(1, 1, s.getMaxRows(), SKEMA[n].length).setNumberFormat('@');
      s.getRange(1, 1, 1, SKEMA[n].length).setValues([SKEMA[n]]).setFontWeight('bold').setBackground('#9E3D52').setFontColor('#ffffff');
      s.setFrozenRows(1);
    }
    if (!s) throw new Error('Sheet "' + n + '" tidak ditemukan.');
    return s;
  },
  /** Tambahkan kolom baru dari SKEMA yang belum ada di sheet lama (di ujung kanan). */
  pastikanKolom(n, s, v) {
    const skema = SKEMA[n] || [], h = v[0].map(String);
    const kurang = skema.filter(k => h.indexOf(k) < 0);
    if (!kurang.length) return v;
    const c0 = h.filter(x => x !== '').length + 1, akhir = c0 + kurang.length - 1;
    if (akhir > s.getMaxColumns()) s.insertColumnsAfter(s.getMaxColumns(), akhir - s.getMaxColumns());
    s.getRange(2, c0, Math.max(1, s.getMaxRows() - 1), kurang.length).setNumberFormat('@');
    s.getRange(1, c0, 1, kurang.length).setValues([kurang]).setFontWeight('bold').setBackground('#9E3D52').setFontColor('#ffffff');
    return v.map((row, i) => {
      const r = row.slice(0, c0 - 1);
      while (r.length < c0 - 1) r.push('');
      return r.concat(i === 0 ? kurang : kurang.map(() => ''));
    });
  },
  reset() { this._m = {}; SCACHE._v = null; },
  load(n) {
    if (this._m[n]) return this._m[n];
    const kotor = SCACHE.kotor[n];
    let v = kotor ? null : SCACHE.baca(n); // ⚡ Prinsip 3: coba cache server dulu (milidetik)
    if (!v) {
      const s = this.sh(n);
      const lr = s.getLastRow(), lc = Math.max(s.getLastColumn(), SKEMA[n] ? SKEMA[n].length : 1);
      v = lr > 0 ? s.getRange(1, 1, lr, lc).getDisplayValues() : [SKEMA[n] || []]; // Prinsip 4: 1 kali baca
      if (lr > 0) v = this.pastikanKolom(n, s, v);
      if (!kotor) SCACHE.simpan(n, v);
    }
    const h = v[0].map(String);
    const rows = [];
    for (let i = 1; i < v.length; i++) {
      const o = { _row: i + 1 };
      for (let j = 0; j < h.length; j++) if (h[j]) o[h[j]] = v[i][j];
      rows.push(o);
    }
    return (this._m[n] = { h: h, rows: rows });
  },
  rows(n) { return this.load(n).rows; },
  find(n, fn) { return this.rows(n).find(fn) || null; },
  filter(n, fn) { return this.rows(n).filter(fn); },
  str(v) {
    if (v === undefined || v === null) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  },
  toArr(n, o) { return this.load(n).h.map(k => (k ? this.str(o[k]) : '')); },
  insert(n, objs) {
    if (!Array.isArray(objs)) objs = [objs];
    if (!objs.length) return;
    const s = this.sh(n), t = this.load(n);
    const vals = objs.map(o => this.toArr(n, o));
    const start = Math.max(s.getLastRow(), 1) + 1;
    const need = start + vals.length - 1;
    if (need > s.getMaxRows()) s.insertRowsAfter(s.getMaxRows(), need - s.getMaxRows() + 100);
    s.getRange(start, 1, vals.length, t.h.length).setNumberFormat('@').setValues(vals);
    delete this._m[n];
    SCACHE.basi(n);
  },
  update(n, row, patch) {
    const t = this.load(n);
    Object.keys(patch).forEach(k => { row[k] = this.str(patch[k]); });
    this.sh(n).getRange(row._row, 1, 1, t.h.length).setNumberFormat('@').setValues([this.toArr(n, row)]);
    SCACHE.basi(n);
    return row;
  },
  remove(n, rows) {
    if (!rows || !rows.length) return;
    const s = this.sh(n);
    rows.map(r => r._row).sort((a, b) => b - a).forEach(r => s.deleteRow(r));
    delete this._m[n];
    SCACHE.basi(n);
  }
};

/**
 * ⚡ CACHE SHEET DI SERVER (Prinsip 3 gas-instant-ux)
 * Isi tiap sheet disimpan di CacheService dengan "versi". Setiap tulis
 * (insert/update/remove/log) mengganti versi → data lama otomatis tidak
 * terpakai lagi, jadi cache selalu segar tanpa perlu menghapus satu-satu.
 * Data dipecah per ±32 ribu karakter (batas 100 KB per kunci).
 * Bila Anda mengedit spreadsheet langsung, perubahan terbaca paling lambat
 * 10 menit — atau jalankan bersihkanCache() di editor agar langsung terbaca.
 */
const SCACHE = {
  TTL: 600, POTONG: 32000, MAKS: 60,
  _v: null,
  c() { return CacheService.getScriptCache(); },
  versi(n) {
    if (!this._v) {
      try { this._v = this.c().getAll(Object.keys(SKEMA).map(k => 'v_' + k)); } catch (e) { this._v = {}; }
    }
    let v = this._v['v_' + n];
    if (!v) {
      v = Utilities.getUuid().slice(0, 8);
      this._v['v_' + n] = v;
      try { this.c().put('v_' + n, v, 21600); } catch (e) { }
    }
    return v;
  },
  baca(n) {
    try {
      const k = 'd_' + n + '_' + this.versi(n);
      const a = this.c().get(k);
      if (!a) return null;
      const i = a.indexOf('|'), jml = parseInt(a.slice(0, i), 10);
      let txt = a.slice(i + 1);
      if (jml > 1) {
        const keys = [];
        for (let j = 1; j < jml; j++) keys.push(k + '_' + j);
        const m = this.c().getAll(keys);
        for (let j = 0; j < keys.length; j++) { if (m[keys[j]] === undefined || m[keys[j]] === null) return null; txt += m[keys[j]]; }
      }
      return JSON.parse(txt);
    } catch (e) { return null; }
  },
  simpan(n, v) {
    try {
      const txt = JSON.stringify(v), k = 'd_' + n + '_' + this.versi(n);
      const jml = Math.ceil(txt.length / this.POTONG) || 1;
      if (jml > this.MAKS) return; // terlalu besar, baca langsung dari sheet
      const o = {};
      for (let j = 0; j < jml; j++) {
        const part = txt.slice(j * this.POTONG, (j + 1) * this.POTONG);
        o[j ? k + '_' + j : k] = j ? part : jml + '|' + part;
      }
      this.c().putAll(o, this.TTL);
    } catch (e) { }
  },
  kotor: {},
  // Tandai sheet berubah; versi baru dipasang SETELAH data tersimpan (flush)
  basi(n) { this.kotor[n] = true; },
  terapkan() {
    const ks = Object.keys(this.kotor);
    if (!ks.length) return;
    SpreadsheetApp.flush();
    const o = {};
    ks.forEach(n => { const v = Utilities.getUuid().slice(0, 8); o['v_' + n] = v; if (this._v) this._v['v_' + n] = v; });
    this.kotor = {};
    try { this.c().putAll(o, 21600); } catch (e) { }
  }
};

/** Jalankan manual di editor bila Anda mengubah isi spreadsheet secara langsung. */
function bersihkanCache() {
  Object.keys(SKEMA).forEach(n => SCACHE.basi(n));
  SCACHE.terapkan();
  Logger.log('✅ Cache dibersihkan. Data spreadsheet terbaru akan langsung terbaca aplikasi.');
}

// Kunci tulis — mencegah baris saling menimpa saat 50 peserta mengirim bersamaan
function denganKunci(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) {
    const e = new Error('Server sedang sibuk, mencoba mengirim ulang...');
    e.busy = true;
    throw e;
  }
  try {
    DB.reset(); // baca ulang data segar di dalam kunci
    return fn();
  } finally {
    SpreadsheetApp.flush();
    SCACHE.terapkan();
    lock.releaseLock();
  }
}

// ============================================
// UTILITAS
// ============================================
function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function now() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
function hariIni() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
let _genSeq = 0;
function genId(prefix) {
  // waktu + nomor urut + acak → tetap unik walau puluhan ID dibuat dalam milidetik yang sama
  return prefix + '-' + (Date.now().toString(36) + (++_genSeq).toString(36) + Math.floor(Math.random() * 1296).toString(36)).toUpperCase();
}
function num(v) { const x = parseFloat(v); return isNaN(x) ? null : x; }
function bulat(v, d) { const f = Math.pow(10, d || 1); return Math.round(v * f) / f; }
function rata(arr) { const a = arr.filter(x => x !== null && x !== undefined && !isNaN(x)); return a.length ? bulat(a.reduce((s, x) => s + x, 0) / a.length) : null; }
function pj(s, def) { try { return s ? JSON.parse(s) : def; } catch (e) { return def; } }
function wajib(v, pesan) { if (v === undefined || v === null || String(v).trim() === '') throw new Error(pesan); return String(v).trim(); }
function normHP(hp) {
  let s = String(hp || '').replace(/\D/g, '');
  if (s.indexOf('62') === 0) s = '0' + s.slice(2);
  if (s && s[0] !== '0') s = '0' + s;
  return s;
}
function sha256(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}
function hashPassword(pw) { return sha256(CONFIG.prop('PASSWORD_SALT') + ':' + pw); }
function pinAcak() { return String(Math.floor(1000 + Math.random() * 9000)); }

function cacheGet(k) { if (DB._cermin) return null; try { const v = CacheService.getScriptCache().get(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function cachePut(k, v, detik) { try { CacheService.getScriptCache().put(k, JSON.stringify(v), detik || 1800); } catch (e) { /* data terlalu besar untuk cache */ } }
function cacheDel(keys) { try { CacheService.getScriptCache().removeAll([].concat(keys)); } catch (e) { } }

function setting(k, def) {
  const r = DB.find('Pengaturan', x => x.kunci === k);
  return r && r.nilai !== '' ? r.nilai : def;
}
function setSetting(k, v, ket) {
  const r = DB.find('Pengaturan', x => x.kunci === k);
  if (r) DB.update('Pengaturan', r, { nilai: v });
  else DB.insert('Pengaturan', { kunci: k, nilai: v, keterangan: ket || '' });
}

function catatLog(sesi, aksi) {
  if (DB._cermin) { DB.insert('Log_Aktivitas', { waktu: now(), peran: sesi ? sesi.r : 'sistem', id_pengguna: sesi ? sesi.id : '-', aksi: aksi }, { nama: sesi ? (sesi.n || sesi.id) : 'Sistem' }); return; }
  try {
    DB.sh('Log_Aktivitas').appendRow([now(), sesi ? sesi.r : 'sistem', sesi ? sesi.id : '-', aksi]);
    delete DB._m.Log_Aktivitas;
    SCACHE.basi('Log_Aktivitas');
  } catch (e) { }
}

function folder(id) { return DriveApp.getFolderById(id); }
function subFolder(parentId, nama) {
  const p = folder(parentId);
  const it = p.getFoldersByName(nama);
  return it.hasNext() ? it.next() : p.createFolder(nama);
}
function bagikanPublik(file) {
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); return true; }
  catch (e) { return false; } // kebijakan domain Workspace bisa melarang
}
function urlLihat(id) { return id ? 'https://drive.google.com/file/d/' + id + '/view' : ''; }
function urlUnduh(id) { return id ? 'https://drive.google.com/uc?export=download&id=' + id : ''; }
function urlGambar(id) { return id ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1200' : ''; }
function fileKeBase64(fileId) {
  const f = DriveApp.getFileById(fileId);
  const b = f.getBlob();
  return { nama: f.getName(), tipe: b.getContentType(), data: Utilities.base64Encode(b.getBytes()) };
}

// ============================================
// SESI — token bertanda tangan HMAC, berlaku 6 jam
// ============================================
function rahasia() {
  let s = CONFIG.prop('TOKEN_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); PropertiesService.getScriptProperties().setProperty('TOKEN_SECRET', s); CONFIG._p = null; }
  return s;
}
function buatToken(user) {
  const payload = Object.assign({}, user, { exp: Date.now() + SESI_JAM * 3600 * 1000 });
  const body = Utilities.base64EncodeWebSafe(JSON.stringify(payload), Utilities.Charset.UTF_8);
  const sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body, rahasia()));
  return body + '.' + sig;
}
function verifikasiToken(t) {
  if (!t || String(t).indexOf('.') < 0) return null;
  const parts = String(t).split('.');
  const sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0], rahasia()));
  if (sig !== parts[1]) return null;
  const p = pj(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString('UTF-8'), null);
  if (!p || p.exp < Date.now()) return null;
  return p;
}
function infoUser(s) { return { peran: s.r, id: s.id, nama: s.n, umkm: s.u || '', sektor: s.s || '', wajib_ganti_pin: !!s.gp }; }

// ============================================
// LOGIN & AKUN
// ============================================
function cekPercobaan(kunci) {
  const c = CacheService.getScriptCache();
  if (c.get('kunci_' + kunci)) throw new Error('Terlalu banyak percobaan salah. Akun dikunci sementara 15 menit.');
}
function gagalPercobaan(kunci) {
  const c = CacheService.getScriptCache();
  const n = parseInt(c.get('gagal_' + kunci) || '0', 10) + 1;
  if (n >= 5) {
    c.put('kunci_' + kunci, '1', 900);
    c.remove('gagal_' + kunci);
    throw new Error('PIN salah 5 kali. Akun dikunci sementara 15 menit.');
  }
  c.put('gagal_' + kunci, String(n), 900);
  return 5 - n;
}
function resetPercobaan(kunci) { cacheDel(['gagal_' + kunci]); }

/** Nama orang yang benar-benar ikut pelatihan: perwakilan/karyawan bila diisi, selain itu pemilik UMKM. */
function namaPeserta(reg, u) { return (reg && reg.nama_peserta) || (u && u.nama_pemilik) || ''; }
/** Kunci pembanding Nama UMKM: huruf kecil, tanpa tanda baca, spasi tunggal. */
function kunciNama(n) { return String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function aksiLogin(d) {
  const peran = d.peran;
  let user;
  if (peran === 'peserta') {
    const pin = wajib(d.pin, 'PIN wajib diisi.');
    let kandidat, kunci;
    if (d.nama_umkm !== undefined) {
      // Masuk dengan Nama UMKM/Usaha (tidak peka huruf besar/kecil, spasi & tanda baca)
      kunci = kunciNama(wajib(d.nama_umkm, 'Nama UMKM / usaha wajib diisi.'));
      kandidat = DB.filter('UMKM', x => kunciNama(x.nama_umkm) === kunci);
    } else {
      // Kompatibel dengan aplikasi versi lama (nomor HP)
      kunci = normHP(wajib(d.no_hp, 'Nama UMKM / usaha wajib diisi.'));
      kandidat = DB.filter('UMKM', x => x.no_hp === kunci);
    }
    cekPercobaan('p' + kunci);
    const u = kandidat.find(x => x.pin === pin);
    if (!u) {
      const sisa = gagalPercobaan('p' + kunci);
      throw new Error('Nama UMKM atau PIN salah. Sisa ' + sisa + ' percobaan.');
    }
    if (u.status_akun !== 'aktif') throw new Error('Akun dinonaktifkan. Hubungi admin PPU.');
    resetPercobaan('p' + kunci);
    user = { r: 'peserta', id: u.id_umkm, n: u.nama_pemilik, u: u.nama_umkm, s: u.sektor, gp: u.wajib_ganti_pin === 'ya' };
  } else if (peran === 'instruktur') {
    const nama = wajib(d.nama, 'Nama instruktur wajib diisi.').toLowerCase();
    const kode = wajib(d.kode, 'Kode akses wajib diisi.').toUpperCase();
    cekPercobaan('i' + nama);
    const u = DB.find('Instruktur', x => x.nama.trim().toLowerCase() === nama && x.kode_akses.toUpperCase() === kode);
    if (!u) {
      const sisa = gagalPercobaan('i' + nama);
      throw new Error('Nama atau kode akses salah. Sisa ' + sisa + ' percobaan.');
    }
    if (u.status !== 'aktif') throw new Error('Akun instruktur tidak aktif. Hubungi admin PPU.');
    resetPercobaan('i' + nama);
    user = { r: 'instruktur', id: u.id_instruktur, n: u.nama };
  } else if (peran === 'admin') {
    const un = wajib(d.username, 'Username wajib diisi.').toLowerCase();
    const pw = wajib(d.password, 'Kata sandi wajib diisi.');
    cekPercobaan('a' + un);
    const u = DB.find('Admin', x => x.username.toLowerCase() === un);
    if (!u || u.password_hash !== hashPassword(pw)) {
      const sisa = gagalPercobaan('a' + un);
      throw new Error('Username atau kata sandi salah. Sisa ' + sisa + ' percobaan.');
    }
    resetPercobaan('a' + un);
    user = { r: 'admin', id: u.username, n: u.nama };
  } else {
    throw new Error('Pilih peran terlebih dahulu.');
  }
  return Object.assign({ token: buatToken(user), user: infoUser(user) }, tokenFirebase(user));
}
/** Token masuk Firebase (custom token) — hanya bila Firebase sudah disiapkan (Firebase.gs + kunci). */
function tokenFirebase(user) {
  try {
    if (typeof FB === 'undefined' || !FB.siap()) return {};
    return { fb_token: FB.tokenKustom(user.id, { peran: user.r, gp: !!user.gp, nama: user.n || '' }) };
  } catch (e) { return {}; }
}
function aksiFbToken(d, s) {
  const t = tokenFirebase(s);
  if (!t.fb_token) throw new Error('Firebase belum disiapkan di server.');
  return t;
}

function aksiSesi(d, s) {
  if (s.r === 'peserta') {
    const u = DB.find('UMKM', x => x.id_umkm === s.id);
    if (!u || u.status_akun !== 'aktif') throw new Error('Akun tidak aktif.');
  }
  return { user: infoUser(s) };
}

function aksiGantiPin(d, s) {
  const lama = wajib(d.pin_lama, 'PIN lama wajib diisi.');
  const baru = wajib(d.pin_baru, 'PIN baru wajib diisi.');
  if (!/^\d{4}$/.test(baru)) throw new Error('PIN baru harus 4 angka.');
  if (baru === lama) throw new Error('PIN baru harus berbeda dari PIN lama.');
  return denganKunci(() => {
    const u = DB.find('UMKM', x => x.id_umkm === s.id);
    if (!u) throw new Error('Akun tidak ditemukan.');
    if (u.pin !== lama) throw new Error('PIN lama salah.');
    DB.update('UMKM', u, { pin: baru, wajib_ganti_pin: 'tidak' });
    catatLog(s, 'Mengganti PIN');
    const user = { r: 'peserta', id: u.id_umkm, n: u.nama_pemilik, u: u.nama_umkm, s: u.sektor, gp: false };
    return Object.assign({ token: buatToken(user), user: infoUser(user), message: 'PIN berhasil diganti.' }, tokenFirebase(user));
  });
}

function aksiGantiPassword(d, s) {
  const lama = wajib(d.lama, 'Kata sandi lama wajib diisi.');
  const baru = wajib(d.baru, 'Kata sandi baru wajib diisi.');
  if (baru.length < 8) throw new Error('Kata sandi baru minimal 8 karakter.');
  return denganKunci(() => {
    const u = DB.find('Admin', x => x.username === s.id);
    if (!u || u.password_hash !== hashPassword(lama)) throw new Error('Kata sandi lama salah.');
    DB.update('Admin', u, { password_hash: hashPassword(baru) });
    catatLog(s, 'Mengganti kata sandi admin');
    return { message: 'Kata sandi berhasil diganti.' };
  });
}

// ============================================
// HELPER PELATIHAN (dipakai semua file)
// ============================================
function parsePel(p) {
  if (!p) return null;
  const n = parseInt(p.jumlah_hari, 10) === 2 ? 2 : 1;
  const tgl = n === 2 ? [p.tanggal_mulai, p.tanggal_selesai] : [p.tanggal_mulai];
  return Object.assign({}, p, {
    jumlah_hari: n,
    kuota: parseInt(p.kuota, 10) || 0,
    tanggal_hari: tgl,
    aktivitas: pj(p.status_aktivitas, {}),
    syarat: Object.assign(syaratDefault(), pj(p.syarat_lulus, {}))
  });
}
function syaratDefault() {
  return Object.assign({ hadir: true, post: true, naik: true, tugas: true }, pj(setting('SYARAT_LULUS_DEFAULT', ''), {}));
}
function ambilPel(id) {
  const p = DB.find('Pelatihan', x => x.id_pelatihan === id);
  if (!p) throw new Error('Pelatihan tidak ditemukan.');
  return parsePel(p);
}
function terdaftar(idPel, idUmkm) {
  return DB.find('Peserta_Pelatihan', x => x.id_pelatihan === idPel && x.id_umkm === idUmkm);
}
// Pemeriksaan hak akses di server (bukan hanya disembunyikan di tampilan)
function cekAkses(s, idPel) {
  const p = ambilPel(wajib(idPel, 'Pelatihan belum dipilih.'));
  if (s.r === 'admin') return p;
  if (s.r === 'instruktur') {
    if (p.id_instruktur !== s.id) throw new Error('Pelatihan ini bukan milik Anda.');
    return p;
  }
  if (!terdaftar(p.id_pelatihan, s.id)) throw new Error('Anda tidak terdaftar di pelatihan ini.');
  return p;
}
function aktivitasBuka(p, kunci) { return !!(p.aktivitas && p.aktivitas[kunci]); }
function namaInstruktur(id) {
  const i = DB.find('Instruktur', x => x.id_instruktur === id);
  return i ? i.nama : '-';
}
function rentangTanggal(p) {
  return p.jumlah_hari === 2 && p.tanggal_selesai && p.tanggal_selesai !== p.tanggal_mulai
    ? p.tanggal_mulai + ' s.d. ' + p.tanggal_selesai : p.tanggal_mulai;
}
function ringkasPel(p) {
  return {
    id_pelatihan: p.id_pelatihan, judul: p.judul, tema: p.tema, cakupan: p.cakupan, sektor: p.sektor,
    id_instruktur: p.id_instruktur, instruktur: namaInstruktur(p.id_instruktur),
    jumlah_hari: p.jumlah_hari, tanggal_mulai: p.tanggal_mulai, tanggal_selesai: p.tanggal_selesai,
    tanggal_hari: p.tanggal_hari, jam: p.jam, format: p.format, lokasi_atau_link: p.lokasi_atau_link, link_dokumentasi: p.link_dokumentasi || '',
    kuota: p.kuota, status: p.status, aktivitas: p.aktivitas, syarat: p.syarat,
    flyer: urlGambar(p.id_flyer), id_template_sertifikat: p.id_template_sertifikat
  };
}

/**
 * Indeks data satu pelatihan untuk menghitung kehadiran, nilai,
 * tugas, evaluasi, dan kelulusan secara sekaligus (hemat baca).
 */
function indeksPelatihan(idPel) {
  const absen = {}, tes = {}, kumpul = {}, evalSet = {};
  DB.filter('Absensi', x => x.id_pelatihan === idPel).forEach(a => {
    (absen[a.id_umkm] = absen[a.id_umkm] || {})[a.hari_ke] = a.waktu_absen;
  });
  DB.filter('Hasil_Tes', x => x.id_pelatihan === idPel).forEach(t => {
    (tes[t.id_umkm] = tes[t.id_umkm] || {})[t.jenis] = num(t.skor);
  });
  const tugas = DB.filter('Tugas', x => x.id_pelatihan === idPel);
  const idT = {};
  tugas.forEach(t => idT[t.id_tugas] = true);
  DB.filter('Pengumpulan_Tugas', x => idT[x.id_tugas]).forEach(k => {
    (kumpul[k.id_umkm] = kumpul[k.id_umkm] || {})[k.id_tugas] = k;
  });
  DB.filter('Evaluasi_Jawaban', x => x.id_pelatihan === idPel).forEach(e => evalSet[e.id_umkm] = true);
  return { absen: absen, tes: tes, tugas: tugas, kumpul: kumpul, eval: evalSet };
}

function statusPeserta(p, idUmkm, idx) {
  const ab = idx.absen[idUmkm] || {};
  let hadir = 0;
  for (let h = 1; h <= p.jumlah_hari; h++) if (ab[h]) hadir++;
  const ts = idx.tes[idUmkm] || {};
  const pre = ts.pre !== undefined ? ts.pre : null;
  const post = ts.post !== undefined ? ts.post : null;
  const kp = idx.kumpul[idUmkm] || {};
  const tugasKumpul = idx.tugas.filter(t => kp[t.id_tugas]).length;
  const skorTugas = rata(idx.tugas.map(t => kp[t.id_tugas] ? num(kp[t.id_tugas].skor) : null));
  const sy = p.syarat, kurang = [];
  if (sy.hadir && hadir < p.jumlah_hari) kurang.push('Kehadiran ' + hadir + '/' + p.jumlah_hari + ' hari');
  if (sy.post && post === null) kurang.push('Belum post-test');
  if (sy.naik && post !== null && !(post > (pre === null ? 0 : pre))) kurang.push('Nilai post-test belum lebih tinggi dari pre-test');
  if (sy.tugas && tugasKumpul < idx.tugas.length) kurang.push('Tugas belum lengkap');
  return {
    hadir: hadir, jumlah_hari: p.jumlah_hari, absen: ab, pre: pre, post: post,
    kenaikan: pre !== null && post !== null ? bulat(post - pre) : null,
    tugas_kumpul: tugasKumpul, tugas_total: idx.tugas.length, skor_tugas: skorTugas,
    evaluasi: !!idx.eval[idUmkm], lulus: kurang.length === 0, kurang: kurang
  };
}

// ============================================
// SETUP — Jalankan SEKALI saat pertama install
// ============================================
function setupAppEnvironment() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('SPREADSHEET_ID')) {
    Logger.log('⚠️ Setup sudah pernah dijalankan. Spreadsheet: https://docs.google.com/spreadsheets/d/' + props.getProperty('SPREADSHEET_ID'));
    Logger.log('   Jika ingin mengulang dari nol, hapus semua Script Properties terlebih dahulu.');
    return;
  }
  Logger.log('🚀 Memulai setup ' + APP_NAME + '...');

  // 1. Folder Drive
  const root = DriveApp.createFolder(APP_NAME);
  const f = {
    FOLDER_MATERI: root.createFolder('Materi'),
    FOLDER_FLYER: root.createFolder('Flyer'),
    FOLDER_TUGAS: root.createFolder('Tugas'),
    FOLDER_SERTIFIKAT: root.createFolder('Sertifikat'),
    FOLDER_TEMPLATE: root.createFolder('Template'),
    FOLDER_EXPORTS: root.createFolder('Exports')
  };
  Logger.log('✅ Folder root: ' + root.getUrl());

  // 2. Spreadsheet database
  const ss = SpreadsheetApp.create('Database — ' + APP_NAME);
  DriveApp.getFileById(ss.getId()).moveTo(root);

  // 3. Simpan ID ke Script Properties (dibutuhkan sebelum hash password)
  const p = {
    SPREADSHEET_ID: ss.getId(), ROOT_FOLDER_ID: root.getId(),
    TOKEN_SECRET: Utilities.getUuid() + Utilities.getUuid(),
    PASSWORD_SALT: Utilities.getUuid()
  };
  Object.keys(f).forEach(k => p[k] = f[k].getId());
  props.setProperties(p);

  // 4. Sheet sesuai skema
  const nama = Object.keys(SKEMA);
  const first = ss.getSheets()[0];
  nama.forEach((n, i) => {
    const sh = i === 0 ? first.setName(n) : ss.insertSheet(n);
    const h = SKEMA[n];
    sh.getRange(1, 1, sh.getMaxRows(), Math.max(h.length, 1)).setNumberFormat('@');
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#9E3D52').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  });
  Logger.log('✅ ' + nama.length + ' sheet dibuat.');

  // 5. Data awal
  DB.reset();
  DB.insert('Admin', { username: 'admin', password_hash: hashPassword('admin12345'), nama: 'Super Admin' });

  const peng = [
    ['NAMA_LEMBAGA', 'Pusat Pendampingan UMKM Sentra Cakung', 'Tampil di laporan & sertifikat'],
    ['SYARAT_LULUS_DEFAULT', JSON.stringify({ hadir: true, post: true, naik: true, tugas: true }), 'Syarat kelulusan bawaan'],
    ['FORMAT_NO_SERTIFIKAT', '{urut}/RL-PPU/{kode}/{bulan}/{tahun}', 'Penanda: {urut} {kode} {bulan} {tahun}'],
    ['TEMPLATE_SERTIFIKAT_ID', '', 'ID Google Slides template sertifikat bawaan'],
    ['TEMPLATE_LAPORAN_ID', '', 'ID Google Sheets template laporan (opsional)']
  ];
  Object.keys(p).filter(k => k.indexOf('FOLDER') === 0 || k === 'SPREADSHEET_ID' || k === 'ROOT_FOLDER_ID')
    .forEach(k => peng.push([k, p[k], 'ID lingkungan (jangan diubah)']));
  peng.push(['CREATED_AT', now(), 'Tanggal setup']);
  DB.insert('Pengaturan', peng.map(r => ({ kunci: r[0], nilai: r[1], keterangan: r[2] })));

  DB.insert('Evaluasi_Pertanyaan', pertanyaanEvaluasiBawaan('DEFAULT'));

  const cfg = ss.getSheetByName('Pengaturan');
  cfg.autoResizeColumns(1, 3);

  SCACHE.terapkan();
  Logger.log('');
  Logger.log('✅ Setup selesai!');
  Logger.log('   Spreadsheet : ' + ss.getUrl());
  Logger.log('   Folder Drive: ' + root.getUrl());
  Logger.log('   Login Admin : username "admin", kata sandi "admin12345" → segera ganti di menu Manajemen Akses');
  Logger.log('   Opsional    : jalankan isiDataContoh() untuk data uji coba.');
}

function pertanyaanEvaluasiBawaan(idPel) {
  const A = ['Tujuan dan manfaat pelatihan dijelaskan dengan jelas.',
    'Materi pelatihan sesuai dengan kebutuhan usaha saya.',
    'Durasi pelatihan cukup untuk memahami materi.',
    'Materi pelatihan bisa langsung saya terapkan di usaha saya.'];
  const B = ['Instruktur menguasai materi yang disampaikan.',
    'Instruktur menjelaskan materi dengan jelas dan mudah dipahami.',
    'Instruktur memberi kesempatan bertanya dan menjawab dengan baik.',
    'Instruktur mengatur waktu pelatihan dengan baik.'];
  const C = ['Informasi jadwal dan lokasi pelatihan disampaikan dengan jelas.',
    'Ruang pelatihan nyaman dan mendukung kegiatan belajar.',
    'Peralatan (proyektor, pengeras suara, internet) berfungsi dengan baik.',
    'Materi dan modul mudah diakses melalui RuangLatih.',
    'Konsumsi yang disediakan memadai.',
    'Panitia sigap membantu selama pelatihan.'];
  const out = [];
  [['A', A], ['B', B], ['C', C]].forEach(g => g[1].forEach((q, i) =>
    out.push({ id_pelatihan: idPel, bagian: g[0], nomor: i + 1, pertanyaan: q, tipe: 'skala' })));
  out.push({ id_pelatihan: idPel, bagian: 'D', nomor: 1, pertanyaan: 'Saran dan masukan terkait pelatihan', tipe: 'teks' });
  out.push({ id_pelatihan: idPel, bagian: 'E', nomor: 1, pertanyaan: 'Usulan program pelatihan lanjutan', tipe: 'teks' });
  return out;
}

/**
 * OPSIONAL — isi data contoh untuk uji coba (jalankan sekali setelah setup).
 * Login uji: Instruktur "Bagas Wicaksono" kode INS-2026
 *            Peserta 081234560001 s.d. 081234560004, PIN 1234 (wajib ganti saat masuk)
 */
function isiDataContoh() {
  DB.reset();
  const t = hariIni();
  const besok = Utilities.formatDate(new Date(Date.now() + 86400000), TZ, 'yyyy-MM-dd');
  DB.insert('Instruktur', { id_instruktur: 'INS-001', nama: 'Bagas Wicaksono', kode_akses: 'INS-2026', tema_diajar: '', institusi: 'Politeknik Kreatif Jakarta', no_hp: '081298765432', status: 'aktif' });
  const umkm = [
    ['Dapur Berkah Bu Ani', 'Ani Suryani', 'Kuliner', 'Kue basah'],
    ['Batik Sekar Jagad', 'Rahmanto', 'Kerajinan', 'Batik tulis'],
    ['Sambal Mak Nyus', 'Sri Mulyati', 'Kuliner', 'Sambal kemasan'],
    ['Tani Hijau Cakung', 'Joko Susilo', 'Pertanian', 'Sayur hidroponik']
  ];
  DB.insert('UMKM', umkm.map((u, i) => ({
    id_umkm: 'UMKM-00' + (i + 1), nama_umkm: u[0], nama_pemilik: u[1], sektor: u[2], spesialisasi: u[3],
    no_hp: '08123456000' + (i + 1), alamat: 'Cakung, Jakarta Timur', pin: '1234', wajib_ganti_pin: 'ya', status_akun: 'aktif', tgl_dibuat: now()
  })));
  DB.insert('Pelatihan', {
    id_pelatihan: 'PL-001', judul: 'Foto Produk & Marketplace UMKM', tema: 'Digital Marketing', cakupan: 'umum', sektor: '',
    id_instruktur: 'INS-001', jumlah_hari: 2, tanggal_mulai: t, tanggal_selesai: besok, jam: '09:00 - 15:00',
    format: 'tatap muka', lokasi_atau_link: 'Lab Komputer Sentra UMKM Cakung', kuota: 40, status: 'berlangsung',
    status_aktivitas: JSON.stringify({ absen_1: true, dibuka_absen_1: true, pre: true }), syarat_lulus: '', tgl_dibuat: now()
  });
  DB.insert('Peserta_Pelatihan', [1, 2, 3].map(i => ({ id_pelatihan: 'PL-001', id_umkm: 'UMKM-00' + i, status_lulus: '', tgl_daftar: now() })));
  const soal = [
    ['Aturan komposisi yang membagi bidang foto menjadi 9 kotak disebut...', 'Rule of Thirds', 'Golden Hour', 'Bokeh', 'Flat Lay', 'a'],
    ['Rasio gambar yang paling umum dipakai untuk foto produk marketplace adalah...', '16:9', '1:1', '4:3', '21:9', 'b'],
    ['Cahaya terbaik untuk foto produk di rumah tanpa lampu studio adalah...', 'Lampu neon di atas kepala', 'Cahaya jendela yang lembut', 'Flash langsung', 'Cahaya matahari siang terik', 'b'],
    ['Judul produk di marketplace sebaiknya memuat...', 'Nama toko saja', 'Kata kunci yang dicari pembeli', 'Emoji sebanyak-banyaknya', 'Harga coret', 'b'],
    ['Latar foto produk yang paling aman untuk katalog adalah...', 'Polos dan terang', 'Ramai bermotif', 'Gelap total', 'Bergambar merek lain', 'a']
  ];
  DB.insert('Bank_Soal', soal.map((s, i) => ({
    id_soal: 'SOAL-00' + (i + 1), id_pelatihan: 'PL-001', jenis: 'pre+post', pertanyaan: s[0],
    opsi_a: s[1], opsi_b: s[2], opsi_c: s[3], opsi_d: s[4], opsi_e: '', kunci: s[5], urutan: i + 1
  })));
  DB.insert('Tugas', { id_tugas: 'TGS-001', id_pelatihan: 'PL-001', judul: 'Foto katalog 3 produk', instruksi: 'Unggah 1 foto kolase berisi 3 produk dengan latar polos dan rasio 1:1.', batas_waktu: besok + ' 15:00', dibuat_oleh: 'INS-001' });
  DB.insert('Evaluasi_Pertanyaan', pertanyaanEvaluasiBawaan('PL-001'));
  SCACHE.terapkan();
  Logger.log('✅ Data contoh dibuat. Instruktur: Bagas Wicaksono / INS-2026 · Peserta: "Dapur Berkah Bu Ani" PIN 1234');
}

// ============================================
// PEMBERSIHAN LOG AKTIVITAS BULANAN (hemat penyimpanan)
// ============================================
/**
 * Jalankan SEKALI dari editor: memasang jadwal harian (±23.00 WIB).
 * Setiap hari terakhir bulan, seluruh log dihapus; di hari lain hanya log
 * dari bulan sebelumnya yang tersisa (bila jadwal sempat terlewat) yang dihapus.
 */
function pasangJadwalLog() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'bersihkanLogBulanan').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('bersihkanLogBulanan').timeBased().everyDays(1).atHour(23).inTimezone(TZ).create();
  Logger.log('✅ Jadwal aktif: log aktivitas dihapus otomatis setiap akhir bulan (dicek setiap hari ±23.00 WIB).');
  bersihkanLogBulanan();
}
function hentikanJadwalLog() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'bersihkanLogBulanan').forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log('⏹️ Jadwal pembersihan log dihentikan.');
}
function bersihkanLogBulanan() {
  const hi = hariIni(), bulanIni = hi.slice(0, 7);
  const t = hi.split('-').map(Number);
  const akhirBulan = new Date(t[0], t[1], 0).getDate() === t[2];
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(60000)) return;
  try {
    const sh = DB.sh('Log_Aktivitas');
    const lr = sh.getLastRow();
    if (lr < 2) return;
    const lc = sh.getLastColumn(), v = sh.getRange(2, 1, lr - 1, lc).getDisplayValues();
    const tetap = akhirBulan ? [] : v.filter(r => String(r[0]).slice(0, 7) === bulanIni);
    const hapus = v.length - tetap.length;
    if (!hapus) return;
    sh.getRange(2, 1, v.length, lc).clearContent();
    if (tetap.length) sh.getRange(2, 1, tetap.length, lc).setNumberFormat('@').setValues(tetap);
    DB.reset();
    SCACHE.basi('Log_Aktivitas');
    SCACHE.terapkan();
    catatLog(null, akhirBulan ? 'Log aktivitas bulan ' + bulanIni + ' dihapus otomatis (akhir bulan, ' + hapus + ' baris)' : 'Log bulan lalu dibersihkan otomatis (' + hapus + ' baris)');
    SCACHE.terapkan();
    Logger.log('🧹 ' + hapus + ' baris log dihapus.');
  } finally { lock.releaseLock(); }
}

// ==================== Pelatihan.gs ====================
/**
 * ============================================================
 *  RuangLatih — File 2/5 : Pelatihan.gs
 *  Fitur bersama Admin & Instruktur: daftar pelatihan, materi
 *  (unggah bertahap hingga 50 MB), bank soal, tugas, rekap nilai,
 *  dan dasbor instruktur.
 * ============================================================
 */

// ---------- PELATIHAN ----------
function aksiPelatihanList(d, s) {
  const semua = DB.rows('Pelatihan').map(parsePel)
    .filter(p => s.r === 'admin' || p.id_instruktur === s.id);
  const jml = {};
  DB.rows('Peserta_Pelatihan').forEach(r => jml[r.id_pelatihan] = (jml[r.id_pelatihan] || 0) + 1);
  return semua.map(p => Object.assign(ringkasPel(p), { jumlah_peserta: jml[p.id_pelatihan] || 0 }))
    .sort((a, b) => String(b.tanggal_mulai).localeCompare(String(a.tanggal_mulai)));
}

function aksiPelatihanDetail(d, s) {
  const p = cekAkses(s, d.id_pelatihan);
  const idx = indeksPelatihan(p.id_pelatihan);
  const umkm = {};
  DB.rows('UMKM').forEach(u => umkm[u.id_umkm] = u);
  const peserta = DB.filter('Peserta_Pelatihan', x => x.id_pelatihan === p.id_pelatihan).map(r => {
    const u = umkm[r.id_umkm] || {};
    const st = statusPeserta(p, r.id_umkm, idx);
    if (s.r !== 'admin') delete st.evaluasi; // instruktur tidak boleh melihat data evaluasi
    return Object.assign({
      id_umkm: r.id_umkm, nama_umkm: u.nama_umkm || '(terhapus)', nama_pemilik: namaPeserta(r, u), pemilik: u.nama_pemilik || '',
      perwakilan: !!r.nama_peserta && kunciNama(r.nama_peserta) !== kunciNama(u.nama_pemilik), gender_peserta: r.gender_peserta || u.gender || '',
      sektor: u.sektor || '', no_hp: s.r === 'admin' ? (r.hp_peserta || u.no_hp) : '', hp_peserta: s.r === 'admin' ? r.hp_peserta || '' : '',
      no_sertifikat: r.no_sertifikat, sertifikat_terbit: !!r.id_file_sertifikat
    }, st);
  }).sort((a, b) => a.nama_umkm.localeCompare(b.nama_umkm));
  const metode = {};
  if (s.r === 'admin') DB.filter('Absensi', x => x.id_pelatihan === p.id_pelatihan).forEach(x => metode[x.id_umkm + '|' + x.hari_ke] = x.metode || 'aplikasi');
  peserta.forEach(x => { x.metode_absen = {}; Object.keys(x.absen || {}).forEach(h => x.metode_absen[h] = metode[x.id_umkm + '|' + h] || 'aplikasi'); });
  return { pelatihan: ringkasPel(p), peserta: peserta, jumlah_tugas: idx.tugas.length, qr_kode: s.r === 'admin' ? kodeQR(p.id_pelatihan) : '' };
}

// ---------- MATERI ----------
function formatMateri(m, judulPel) {
  return {
    id_materi: m.id_materi, id_pelatihan: m.id_pelatihan, pelatihan: judulPel || '', judul: m.judul,
    cakupan: m.cakupan, sektor: m.sektor, ukuran: parseInt(m.ukuran_file, 10) || 0,
    urutan: parseInt(m.urutan, 10) || 0, tgl: m.tgl, url_lihat: urlLihat(m.id_file), url_unduh: urlUnduh(m.id_file)
  };
}
function aksiMateriList(d, s) {
  const judul = {};
  DB.rows('Pelatihan').forEach(p => judul[p.id_pelatihan] = p.judul);
  let rows = DB.rows('Materi');
  if (d.id_pelatihan) { cekAkses(s, d.id_pelatihan); rows = rows.filter(m => m.id_pelatihan === d.id_pelatihan); }
  else if (s.r === 'instruktur') {
    const milik = {};
    DB.filter('Pelatihan', p => p.id_instruktur === s.id).forEach(p => milik[p.id_pelatihan] = true);
    rows = rows.filter(m => milik[m.id_pelatihan]);
  }
  return rows.map(m => formatMateri(m, judul[m.id_pelatihan]))
    .sort((a, b) => a.id_pelatihan === b.id_pelatihan ? a.urutan - b.urutan : String(b.tgl).localeCompare(String(a.tgl)));
}
function aksiMateriHapus(d, s) {
  return denganKunci(() => {
    const m = DB.find('Materi', x => x.id_materi === d.id_materi);
    if (!m) throw new Error('Materi tidak ditemukan.');
    cekAkses(s, m.id_pelatihan);
    try { DriveApp.getFileById(m.id_file).setTrashed(true); } catch (e) { }
    DB.remove('Materi', [m]);
    cacheDel(['materi_semua']);
    catatLog(s, 'Menghapus materi "' + m.judul + '"');
    return { message: 'Materi dihapus.' };
  });
}

/**
 * Unggah bertahap (resumable upload Google Drive).
 * 1) upload_init  → server membuka sesi unggah di Drive
 * 2) upload_chunk → HP/laptop mengirim potongan ±4 MB berurutan
 * Berkas 50 MB tidak pernah dimuat utuh di memori server.
 */
function aksiUploadInit(d, s) {
  const tujuan = d.tujuan || 'materi';
  if (tujuan !== 'materi') throw new Error('Tujuan unggah tidak dikenal.');
  const p = cekAkses(s, d.id_pelatihan);
  const ukuran = parseInt(d.ukuran, 10) || 0;
  if (!/pdf/i.test(d.tipe || '') && !/\.pdf$/i.test(d.nama || '')) throw new Error('Materi harus berupa file PDF.');
  if (ukuran <= 0) throw new Error('File kosong.');
  if (ukuran > MAX_MATERI) throw new Error('Ukuran file maksimal 50 MB.');
  const judul = wajib(d.judul || String(d.nama).replace(/\.pdf$/i, ''), 'Judul materi wajib diisi.');
  const cakupan = d.cakupan === 'sektor' ? 'sektor' : (d.cakupan === 'umum' ? 'umum' : (p.cakupan === 'sektor' ? 'sektor' : 'umum'));
  const sektor = cakupan === 'sektor' ? (d.sektor || p.sektor) : '';
  if (cakupan === 'sektor' && SEKTOR.indexOf(sektor) < 0) throw new Error('Pilih sektor materi.');

  const res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method: 'post', contentType: 'application/json; charset=UTF-8', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': 'application/pdf', 'X-Upload-Content-Length': String(ukuran) },
    payload: JSON.stringify({ name: p.id_pelatihan + ' - ' + judul + '.pdf', parents: [CONFIG.FOLDER_MATERI] })
  });
  if (res.getResponseCode() !== 200) throw new Error('Gagal membuka sesi unggah Drive (' + res.getResponseCode() + ').');
  const h = res.getAllHeaders();
  const loc = h.Location || h.location || Object.keys(h).filter(k => k.toLowerCase() === 'location').map(k => h[k])[0];
  if (!loc) throw new Error('Drive tidak mengembalikan alamat unggah.');
  const id = genId('UP');
  cachePut('up_' + id, { loc: loc, ukuran: ukuran, id_pelatihan: p.id_pelatihan, judul: judul, cakupan: cakupan, sektor: sektor, uid: s.id }, 21600);
  return { upload_id: id, chunk: CHUNK };
}

function aksiUploadChunk(d, s) {
  const info = cacheGet('up_' + d.upload_id);
  if (!info || info.uid !== s.id) throw new Error('Sesi unggah tidak ditemukan atau kedaluwarsa. Ulangi unggah.');
  const bytes = Utilities.base64Decode(d.data);
  const offset = parseInt(d.offset, 10) || 0;
  const akhir = offset + bytes.length - 1;
  const res = UrlFetchApp.fetch(info.loc, {
    method: 'put', contentType: 'application/pdf', payload: bytes, muteHttpExceptions: true, followRedirects: false,
    headers: { 'Content-Range': 'bytes ' + offset + '-' + akhir + '/' + info.ukuran }
  });
  const code = res.getResponseCode();
  if (code === 308) {
    const h = res.getAllHeaders();
    const range = h.Range || h.range || '';
    const m = String(range).match(/-(\d+)$/);
    return { selesai: false, diterima: m ? parseInt(m[1], 10) + 1 : 0 };
  }
  if (code !== 200 && code !== 201) throw new Error('Potongan file gagal diterima Drive (' + code + ').');
  const fileId = JSON.parse(res.getContentText()).id;
  const file = DriveApp.getFileById(fileId);
  bagikanPublik(file); // peserta membuka materi lewat tautan; daftar tautan hanya dikirim ke yang berhak
  cacheDel(['up_' + d.upload_id]);
  return denganKunci(() => {
    const urut = DB.filter('Materi', x => x.id_pelatihan === info.id_pelatihan).length + 1;
    const m = {
      id_materi: genId('MAT'), id_pelatihan: info.id_pelatihan, judul: info.judul, cakupan: info.cakupan,
      sektor: info.sektor, id_file: fileId, ukuran_file: info.ukuran, urutan: urut, diunggah_oleh: s.n, tgl: now()
    };
    DB.insert('Materi', m);
    cacheDel(['materi_semua']);
    catatLog(s, 'Mengunggah materi "' + info.judul + '"');
    return { selesai: true, materi: formatMateri(m), message: 'Materi berhasil diunggah.' };
  });
}

// ---------- BANK SOAL ----------
function aksiSoalList(d, s) {
  cekAkses(s, d.id_pelatihan);
  const jumlahHasil = DB.filter('Hasil_Tes', x => x.id_pelatihan === d.id_pelatihan).length;
  const soal = DB.filter('Bank_Soal', x => x.id_pelatihan === d.id_pelatihan)
    .map(x => ({
      id_soal: x.id_soal, jenis: x.jenis, pertanyaan: x.pertanyaan, opsi_a: x.opsi_a, opsi_b: x.opsi_b,
      opsi_c: x.opsi_c, opsi_d: x.opsi_d, opsi_e: x.opsi_e, kunci: x.kunci, urutan: parseInt(x.urutan, 10) || 0
    })).sort((a, b) => a.urutan - b.urutan);
  return { soal: soal, sudah_dikerjakan: jumlahHasil };
}
function aksiSoalSimpan(d, s) {
  const x = d.soal || {};
  const jenis = x.jenis;
  if (['pre', 'post', 'pre+post'].indexOf(jenis) < 0) throw new Error('Pilih jenis soal: pre, post, atau pre+post.');
  const q = wajib(x.pertanyaan, 'Pertanyaan wajib diisi.');
  const opsi = {};
  ['a', 'b', 'c', 'd', 'e'].forEach(k => opsi['opsi_' + k] = String(x['opsi_' + k] || '').trim());
  if (['a', 'b', 'c', 'd'].some(k => !opsi['opsi_' + k])) throw new Error('Opsi A sampai D wajib diisi (opsi E boleh kosong).');
  const kunci = String(x.kunci || '').toLowerCase();
  if (!opsi['opsi_' + kunci]) throw new Error('Pilih kunci jawaban dari opsi yang terisi.');
  return denganKunci(() => {
    cekAkses(s, d.id_pelatihan);
    const data = Object.assign({ jenis: jenis, pertanyaan: q, kunci: kunci }, opsi);
    let pesan;
    if (x.id_soal) {
      const r = DB.find('Bank_Soal', y => y.id_soal === x.id_soal && y.id_pelatihan === d.id_pelatihan);
      if (!r) throw new Error('Soal tidak ditemukan.');
      DB.update('Bank_Soal', r, data);
      pesan = 'Soal diperbarui.';
    } else {
      const urut = DB.filter('Bank_Soal', y => y.id_pelatihan === d.id_pelatihan).length + 1;
      DB.insert('Bank_Soal', Object.assign({ id_soal: genId('SOAL'), id_pelatihan: d.id_pelatihan, urutan: urut }, data));
      pesan = 'Soal ditambahkan.';
    }
    cacheDel(['soalk_' + d.id_pelatihan + '_pre', 'soalk_' + d.id_pelatihan + '_post']);
    return { message: pesan };
  });
}
/**
 * Simpan banyak soal sekaligus (1 permintaan, 1 kunci). Semua divalidasi dulu;
 * bila ada yang salah, tidak ada yang disimpan dan nomor soalnya disebutkan.
 */
function aksiSoalSimpanBanyak(d, s) {
  const daftar = [].concat(d.soal || []);
  if (!daftar.length) throw new Error('Belum ada soal yang diisi.');
  if (daftar.length > 100) throw new Error('Maksimal 100 soal sekali simpan.');
  const siap = daftar.map((x, i) => {
    const no = 'Soal ' + (i + 1) + ': ';
    const jenis = x.jenis;
    if (['pre', 'post', 'pre+post'].indexOf(jenis) < 0) throw new Error(no + 'pilih jenis pre, post, atau pre+post.');
    const q = String(x.pertanyaan || '').trim();
    if (!q) throw new Error(no + 'pertanyaan belum diisi.');
    const opsi = {};
    ['a', 'b', 'c', 'd', 'e'].forEach(k => opsi['opsi_' + k] = String(x['opsi_' + k] || '').trim());
    if (['a', 'b', 'c', 'd'].some(k => !opsi['opsi_' + k])) throw new Error(no + 'opsi A sampai D wajib diisi.');
    const kunci = String(x.kunci || '').toLowerCase();
    if (!opsi['opsi_' + kunci]) throw new Error(no + 'pilih kunci jawaban dari opsi yang terisi.');
    return Object.assign({ jenis: jenis, pertanyaan: q, kunci: kunci }, opsi);
  });
  return denganKunci(() => {
    cekAkses(s, d.id_pelatihan);
    let urut = DB.filter('Bank_Soal', y => y.id_pelatihan === d.id_pelatihan).length;
    DB.insert('Bank_Soal', siap.map(x => Object.assign({ id_soal: genId('SOAL'), id_pelatihan: d.id_pelatihan, urutan: ++urut }, x)));
    cacheDel(['soalk_' + d.id_pelatihan + '_pre', 'soalk_' + d.id_pelatihan + '_post']);
    catatLog(s, 'Menambah ' + siap.length + ' soal ke ' + d.id_pelatihan);
    return { message: siap.length + ' soal tersimpan.', jumlah: siap.length };
  });
}
function aksiSoalHapus(d, s) {
  return denganKunci(() => {
    const r = DB.find('Bank_Soal', y => y.id_soal === d.id_soal);
    if (!r) throw new Error('Soal tidak ditemukan.');
    cekAkses(s, r.id_pelatihan);
    DB.remove('Bank_Soal', [r]);
    cacheDel(['soalk_' + r.id_pelatihan + '_pre', 'soalk_' + r.id_pelatihan + '_post']);
    return { message: 'Soal dihapus.' };
  });
}

// ---------- TUGAS ----------
function aksiTugasList(d, s) {
  const umkm = {};
  DB.rows('UMKM').forEach(u => umkm[u.id_umkm] = u);
  let pelIds;
  if (d.id_pelatihan) { cekAkses(s, d.id_pelatihan); pelIds = [d.id_pelatihan]; }
  else pelIds = DB.rows('Pelatihan').filter(p => s.r === 'admin' || p.id_instruktur === s.id).map(p => p.id_pelatihan);
  const pelMap = {};
  DB.rows('Pelatihan').forEach(p => pelMap[p.id_pelatihan] = p.judul);
  const tugas = DB.filter('Tugas', t => pelIds.indexOf(t.id_pelatihan) >= 0);
  const ids = {};
  tugas.forEach(t => ids[t.id_tugas] = t);
  const regM = {};
  DB.rows('Peserta_Pelatihan').forEach(r => regM[r.id_pelatihan + '|' + r.id_umkm] = r);
  const kumpul = DB.filter('Pengumpulan_Tugas', k => ids[k.id_tugas]).map(k => {
    const u = umkm[k.id_umkm] || {};
    const reg = regM[ids[k.id_tugas].id_pelatihan + '|' + k.id_umkm];
    return {
      id_tugas: k.id_tugas, judul_tugas: ids[k.id_tugas].judul, id_pelatihan: ids[k.id_tugas].id_pelatihan,
      id_umkm: k.id_umkm, nama_umkm: u.nama_umkm || '-', nama_pemilik: namaPeserta(reg, u), sektor: u.sektor || '',
      nama_file: k.nama_file, tipe_file: k.tipe_file, waktu_kumpul: k.waktu_kumpul,
      skor: num(k.skor), catatan: k.catatan_instruktur, dinilai: k.skor !== '', waktu_dinilai: k.waktu_dinilai
    };
  }).sort((a, b) => String(b.waktu_kumpul).localeCompare(String(a.waktu_kumpul)));
  return {
    tugas: tugas.map(t => ({
      id_tugas: t.id_tugas, id_pelatihan: t.id_pelatihan, pelatihan: pelMap[t.id_pelatihan], judul: t.judul,
      instruksi: t.instruksi, batas_waktu: t.batas_waktu, jumlah_kumpul: kumpul.filter(k => k.id_tugas === t.id_tugas).length
    })),
    pengumpulan: kumpul
  };
}
function aksiTugasSimpan(d, s) {
  const judul = wajib(d.judul, 'Judul tugas wajib diisi.');
  const instruksi = wajib(d.instruksi, 'Instruksi tugas wajib diisi.');
  const batas = String(d.batas_waktu || '').replace('T', ' ');
  return denganKunci(() => {
    cekAkses(s, d.id_pelatihan);
    if (d.id_tugas) {
      const r = DB.find('Tugas', t => t.id_tugas === d.id_tugas && t.id_pelatihan === d.id_pelatihan);
      if (!r) throw new Error('Tugas tidak ditemukan.');
      DB.update('Tugas', r, { judul: judul, instruksi: instruksi, batas_waktu: batas });
      return { message: 'Tugas diperbarui.' };
    }
    DB.insert('Tugas', { id_tugas: genId('TGS'), id_pelatihan: d.id_pelatihan, judul: judul, instruksi: instruksi, batas_waktu: batas, dibuat_oleh: s.id });
    catatLog(s, 'Membuat tugas "' + judul + '"');
    return { message: 'Tugas dibuat.' };
  });
}
function aksiTugasHapus(d, s) {
  return denganKunci(() => {
    const r = DB.find('Tugas', t => t.id_tugas === d.id_tugas);
    if (!r) throw new Error('Tugas tidak ditemukan.');
    cekAkses(s, r.id_pelatihan);
    if (DB.find('Pengumpulan_Tugas', k => k.id_tugas === r.id_tugas)) throw new Error('Tugas sudah punya kiriman peserta, tidak bisa dihapus.');
    DB.remove('Tugas', [r]);
    return { message: 'Tugas dihapus.' };
  });
}
function aksiTugasNilai(d, s) {
  const skor = num(d.skor);
  if (skor === null || skor < 0 || skor > 100) throw new Error('Skor harus angka 0–100.');
  return denganKunci(() => {
    const t = DB.find('Tugas', x => x.id_tugas === d.id_tugas);
    if (!t) throw new Error('Tugas tidak ditemukan.');
    cekAkses(s, t.id_pelatihan);
    const k = DB.find('Pengumpulan_Tugas', x => x.id_tugas === d.id_tugas && x.id_umkm === d.id_umkm);
    if (!k) throw new Error('Kiriman tugas tidak ditemukan.');
    DB.update('Pengumpulan_Tugas', k, { skor: skor, catatan_instruktur: String(d.catatan || '').trim(), dinilai_oleh: s.id, waktu_dinilai: now() });
    catatLog(s, 'Menilai tugas "' + t.judul + '" ' + d.id_umkm + ' skor ' + skor);
    return { message: 'Nilai tersimpan.' };
  });
}
function aksiTugasFile(d, s) {
  const t = DB.find('Tugas', x => x.id_tugas === d.id_tugas);
  if (!t) throw new Error('Tugas tidak ditemukan.');
  const idUmkm = s.r === 'peserta' ? s.id : d.id_umkm;
  cekAkses(s, t.id_pelatihan);
  const k = DB.find('Pengumpulan_Tugas', x => x.id_tugas === d.id_tugas && x.id_umkm === idUmkm);
  if (!k) throw new Error('Kiriman tidak ditemukan.');
  return fileKeBase64(k.id_file);
}

// ---------- REKAP NILAI ----------
function aksiNilaiRekap(d, s) {
  const det = aksiPelatihanDetail(d, s);
  const hasil = {};
  DB.filter('Hasil_Tes', x => x.id_pelatihan === det.pelatihan.id_pelatihan).forEach(x => hasil[x.id_umkm + '|' + x.jenis] = x);
  const info = (id, j) => { const h = hasil[id + '|' + j]; return h ? { waktu: h.waktu_selesai, benar: parseInt(h.jumlah_benar, 10) || 0 } : null; };
  const rows = det.peserta.map(x => ({
    id_umkm: x.id_umkm, nama_umkm: x.nama_umkm, nama_pemilik: x.nama_pemilik, sektor: x.sektor, no_hp: x.no_hp || '',
    pre: x.pre, post: x.post, kenaikan: x.kenaikan, skor_tugas: x.skor_tugas,
    pre_info: info(x.id_umkm, 'pre'), post_info: info(x.id_umkm, 'post'),
    hadir: x.hadir, jumlah_hari: x.jumlah_hari, lulus: x.lulus
  }));
  return {
    pelatihan: det.pelatihan, rows: rows,
    rata: { pre: rata(rows.map(r => r.pre)), post: rata(rows.map(r => r.post)), kenaikan: rata(rows.map(r => r.kenaikan)), tugas: rata(rows.map(r => r.skor_tugas)) }
  };
}

// ---------- DASBOR INSTRUKTUR ----------
function aksiDasborInstruktur(d, s) {
  const pels = DB.rows('Pelatihan').map(parsePel).filter(p => p.id_instruktur === s.id);
  const urut = { berlangsung: 0, 'akan datang': 1, selesai: 2 };
  pels.sort((a, b) => (urut[a.status] - urut[b.status]) || String(a.tanggal_mulai).localeCompare(String(b.tanggal_mulai)));
  const ids = pels.map(p => p.id_pelatihan);
  const tl = aksiTugasList({}, s);
  const menunggu = tl.pengumpulan.filter(k => !k.dinilai);
  const soal = DB.filter('Bank_Soal', x => ids.indexOf(x.id_pelatihan) >= 0);
  const materi = DB.filter('Materi', x => ids.indexOf(x.id_pelatihan) >= 0).length;

  const aktif = pels[0] || null;
  let live = null;
  if (aktif) {
    const det = aksiPelatihanDetail({ id_pelatihan: aktif.id_pelatihan }, s);
    const ps = det.peserta;
    const hariKe = aktif.tanggal_hari.indexOf(hariIni()) + 1 || 1;
    live = {
      pelatihan: det.pelatihan, jumlah_peserta: ps.length, hari_ke: hariKe,
      hadir_hari_ini: ps.filter(x => x.absen[hariKe]).length,
      pre: rata(ps.map(x => x.pre)), post: rata(ps.map(x => x.post)),
      di_atas_target: ps.filter(x => x.kenaikan !== null && x.kenaikan > 0).length,
      soal: soal.filter(x => x.id_pelatihan === aktif.id_pelatihan).slice(0, 3).map(x => ({ pertanyaan: x.pertanyaan, jenis: x.jenis }))
    };
  }
  return {
    ringkas: {
      tugas_menunggu: menunggu.length, soal: soal.length, materi: materi,
      kenaikan: live && live.pre !== null && live.post !== null ? bulat(live.post - live.pre) : null
    },
    live: live,
    antrean: menunggu.slice(0, 5),
    pelatihan: pels.map(ringkasPel)
  };
}

// ==================== Admin.gs ====================
/**
 * ============================================================
 *  RuangLatih — File 3/5 : Admin.gs
 *  Khusus Super Admin: data UMKM & PIN, instruktur, pelatihan
 *  (termasuk sinkronisasi jumlah hari), pendaftaran peserta,
 *  buka/tutup aktivitas, form evaluasi, pengaturan, akun admin.
 * ============================================================
 */

// ---------- UMKM ----------
function aksiUmkmList(d, s) {
  const jml = {};
  DB.rows('Peserta_Pelatihan').forEach(r => jml[r.id_umkm] = (jml[r.id_umkm] || 0) + 1);
  return DB.rows('UMKM').map(u => {
    const o = {};
    SKEMA.UMKM.forEach(k => o[k] = u[k]);
    o.jumlah_pelatihan = jml[u.id_umkm] || 0;
    return o;
  }).sort((a, b) => String(a.nama_umkm).localeCompare(String(b.nama_umkm)));
}

function validasiUmkm(d) {
  const o = {
    nama_umkm: wajib(d.nama_umkm, 'Nama UMKM wajib diisi.'),
    nama_pemilik: wajib(d.nama_pemilik, 'Nama pemilik wajib diisi.'),
    sektor: wajib(d.sektor, 'Sektor wajib dipilih.'),
    spesialisasi: String(d.spesialisasi || '').trim(),
    no_hp: normHP(wajib(d.no_hp, 'Nomor HP wajib diisi.')),
    alamat: String(d.alamat || '').trim()
  };
  if (d.gender !== undefined) {
    const g = String(d.gender || '').trim().toLowerCase();
    o.gender = /^(l|laki|pria|laki-laki)/.test(g) ? 'Laki-laki' : (/^(p|perempuan|wanita)/.test(g) ? 'Perempuan' : '');
    if (d.gender_wajib && !o.gender) throw new Error('Pilih gender peserta.');
  }
  if (SEKTOR.indexOf(o.sektor) < 0) throw new Error('Sektor harus salah satu: ' + SEKTOR.join(', ') + '.');
  if (o.no_hp.length < 10 || o.no_hp.length > 14) throw new Error('Nomor HP ' + o.no_hp + ' tidak valid.');
  return o;
}

function aksiUmkmSimpan(d, s) {
  const o = validasiUmkm(d);
  return denganKunci(() => {
    const k = kunciNama(o.nama_umkm);
    const dupNama = DB.find('UMKM', x => kunciNama(x.nama_umkm) === k && x.id_umkm !== d.id_umkm);
    if (dupNama) throw new Error('Nama UMKM "' + o.nama_umkm + '" sudah dipakai (' + dupNama.nama_pemilik + '). Nama UMKM dipakai untuk masuk, jadi harus berbeda — mis. tambahkan nama pemilik atau lokasi.');
    const dup = DB.find('UMKM', x => x.no_hp === o.no_hp && x.id_umkm !== d.id_umkm);
    if (dup) throw new Error('Nomor HP sudah dipakai oleh ' + dup.nama_umkm + '.');
    if (d.id_umkm) {
      const u = DB.find('UMKM', x => x.id_umkm === d.id_umkm);
      if (!u) throw new Error('UMKM tidak ditemukan.');
      DB.update('UMKM', u, o);
      catatLog(s, 'Mengubah data UMKM ' + o.nama_umkm);
      return { message: 'Data UMKM diperbarui.' };
    }
    const pin = /^\d{4}$/.test(String(d.pin || '')) ? String(d.pin) : pinAcak();
    const baru = Object.assign({ id_umkm: genId('UMKM'), pin: pin, wajib_ganti_pin: 'ya', status_akun: 'aktif', tgl_dibuat: now() }, o);
    DB.insert('UMKM', baru);
    catatLog(s, 'Menambah UMKM ' + o.nama_umkm);
    return { message: 'UMKM ditambahkan. PIN awal: ' + pin, pin: pin, id_umkm: baru.id_umkm };
  });
}

function aksiUmkmResetPin(d, s) {
  return denganKunci(() => {
    const u = DB.find('UMKM', x => x.id_umkm === d.id_umkm);
    if (!u) throw new Error('UMKM tidak ditemukan.');
    let pin = /^\d{4}$/.test(String(d.pin || '')) ? String(d.pin) : pinAcak();
    if (pin === u.pin) pin = pinAcak();
    DB.update('UMKM', u, { pin: pin, wajib_ganti_pin: 'ya' });
    cacheDel(['kunci_p' + u.no_hp, 'gagal_p' + u.no_hp]);
    catatLog(s, 'Reset PIN ' + u.nama_umkm);
    return { pin: pin, message: 'PIN baru ' + u.nama_umkm + ': ' + pin };
  });
}

function aksiUmkmStatus(d, s) {
  return denganKunci(() => {
    const u = DB.find('UMKM', x => x.id_umkm === d.id_umkm);
    if (!u) throw new Error('UMKM tidak ditemukan.');
    const st = u.status_akun === 'aktif' ? 'nonaktif' : 'aktif';
    DB.update('UMKM', u, { status_akun: st });
    catatLog(s, (st === 'aktif' ? 'Mengaktifkan' : 'Menonaktifkan') + ' akun ' + u.nama_umkm);
    return { status_akun: st, message: 'Akun ' + u.nama_umkm + ' sekarang ' + st + '.' };
  });
}

// Impor massal dari tempelan Excel/Google Form
function aksiUmkmImport(d, s) {
  const baris = d.rows || [];
  if (!baris.length) throw new Error('Tidak ada data untuk diimpor.');
  if (baris.length > 500) throw new Error('Maksimal 500 baris sekali impor.');
  return denganKunci(() => {
    const hpAda = {}, namaAda = {};
    DB.rows('UMKM').forEach(u => { hpAda[u.no_hp] = true; namaAda[kunciNama(u.nama_umkm)] = true; });
    const masuk = [], gagal = [];
    baris.forEach((r, i) => {
      try {
        const o = validasiUmkm(r);
        if (namaAda[kunciNama(o.nama_umkm)]) throw new Error('nama UMKM "' + o.nama_umkm + '" sudah terdaftar');
        if (hpAda[o.no_hp]) throw new Error('nomor HP sudah terdaftar');
        hpAda[o.no_hp] = true; namaAda[kunciNama(o.nama_umkm)] = true;
        const pin = /^\d{4}$/.test(String(r.pin || '')) ? String(r.pin) : pinAcak();
        masuk.push(Object.assign({ id_umkm: genId('UMKM') + i, pin: pin, wajib_ganti_pin: 'ya', status_akun: 'aktif', tgl_dibuat: now() }, o));
      } catch (e) { gagal.push('Baris ' + (i + 1) + ': ' + e.message); }
    });
    DB.insert('UMKM', masuk);
    catatLog(s, 'Impor ' + masuk.length + ' UMKM');
    return { berhasil: masuk.length, gagal: gagal, message: masuk.length + ' UMKM diimpor' + (gagal.length ? ', ' + gagal.length + ' baris dilewati.' : '.') };
  });
}

/** Rincian pelatihan yang pernah diikuti satu UMKM (untuk tab Peserta admin). */
function aksiUmkmRiwayat(d, s) {
  const u = DB.find('UMKM', x => x.id_umkm === d.id_umkm);
  if (!u) throw new Error('UMKM tidak ditemukan.');
  const reg = {};
  DB.filter('Peserta_Pelatihan', x => x.id_umkm === u.id_umkm).forEach(x => reg[x.id_pelatihan] = x);
  return aksiPRiwayat({}, { id: u.id_umkm }).map(r => Object.assign(r, { no_sertifikat: (reg[r.id_pelatihan] || {}).no_sertifikat || '' }));
}

// ---------- INSTRUKTUR ----------
function aksiInstrukturList(d, s) {
  const jml = {};
  DB.rows('Pelatihan').forEach(p => jml[p.id_instruktur] = (jml[p.id_instruktur] || 0) + 1);
  return DB.rows('Instruktur').map(i => ({
    id_instruktur: i.id_instruktur, nama: i.nama, kode_akses: i.kode_akses, institusi: i.institusi || '', no_hp: i.no_hp || '',
    status: i.status, jumlah_pelatihan: jml[i.id_instruktur] || 0
  })).sort((a, b) => a.nama.localeCompare(b.nama));
}
function kodeInstrukturAcak() {
  let k;
  do { k = 'INS-' + Math.floor(1000 + Math.random() * 9000); } while (DB.find('Instruktur', x => x.kode_akses.toUpperCase() === k));
  return k;
}
/**
 * Simpan instruktur. Saat mengubah, hanya kolom yang dikirim yang diganti
 * (form data tidak mengubah kode akses/status; menu Manajemen Akses tidak mengubah biodata).
 */
function aksiInstrukturSimpan(d, s) {
  return denganKunci(() => {
    const r = d.id_instruktur ? DB.find('Instruktur', x => x.id_instruktur === d.id_instruktur) : null;
    if (d.id_instruktur && !r) throw new Error('Instruktur tidak ditemukan.');
    const o = {};
    if (d.nama !== undefined || !r) o.nama = wajib(d.nama, 'Nama instruktur wajib diisi.');
    if (d.institusi !== undefined) o.institusi = String(d.institusi || '').trim();
    if (d.no_hp !== undefined) {
      o.no_hp = d.no_hp ? normHP(d.no_hp) : '';
      if (o.no_hp && (o.no_hp.length < 10 || o.no_hp.length > 14)) throw new Error('Nomor HP ' + o.no_hp + ' tidak valid.');
    }
    if (d.status !== undefined || !r) o.status = d.status === 'nonaktif' ? 'nonaktif' : 'aktif';
    let kode = String(d.kode_akses || '').trim().toUpperCase();
    if (d.kode_baru || (!r && !kode)) kode = kodeInstrukturAcak();
    if (kode) {
      if (DB.find('Instruktur', x => x.kode_akses.toUpperCase() === kode && x.id_instruktur !== d.id_instruktur)) throw new Error('Kode akses sudah dipakai instruktur lain.');
      o.kode_akses = kode;
    }
    if (r) {
      DB.update('Instruktur', r, o);
      catatLog(s, (o.kode_akses && d.kode_baru ? 'Membuat kode akses baru instruktur ' : 'Mengubah instruktur ') + r.nama);
      return { message: o.kode_akses && d.kode_baru ? 'Kode akses baru: ' + o.kode_akses : 'Data instruktur diperbarui.', kode_akses: r.kode_akses };
    }
    const id = genId('INS');
    DB.insert('Instruktur', Object.assign({ id_instruktur: id, tema_diajar: '' }, o));
    catatLog(s, 'Menambah instruktur ' + o.nama);
    return { message: 'Instruktur ditambahkan. Kode akses: ' + o.kode_akses, kode_akses: o.kode_akses, id_instruktur: id };
  });
}

// ---------- PELATIHAN (buat/ubah + sinkronisasi jumlah hari, PRD 5.5) ----------
function aksiPelatihanSimpan(d, s) {
  const o = {
    judul: wajib(d.judul, 'Judul pelatihan wajib diisi.'),
    tema: String(d.tema || '').trim(),
    cakupan: d.cakupan === 'sektor' ? 'sektor' : 'umum',
    sektor: d.cakupan === 'sektor' ? String(d.sektor || '') : '',
    id_instruktur: wajib(d.id_instruktur, 'Instruktur wajib dipilih.'),
    jam: wajib(d.jam, 'Jam pelatihan wajib diisi.'),
    format: d.format === 'online' ? 'online' : 'tatap muka',
    lokasi_atau_link: wajib(d.lokasi_atau_link, 'Lokasi atau link wajib diisi.'),
    link_dokumentasi: (() => {
      const l = String(d.link_dokumentasi || '').trim();
      if (l && !/^https?:\/\/\S+$/i.test(l)) throw new Error('Link dokumentasi harus diawali https:// (salin dari OneDrive/Google Drive).');
      return l;
    })(),
    kuota: parseInt(d.kuota, 10),
    status: ['akan datang', 'berlangsung', 'selesai'].indexOf(d.status) >= 0 ? d.status : 'akan datang'
  };
  const n = parseInt(d.jumlah_hari, 10);
  if (n !== 1 && n !== 2) throw new Error('Jumlah hari wajib diisi (1 hari atau 2 hari).');
  o.jumlah_hari = n;
  o.tanggal_mulai = wajib(d.tanggal_mulai, 'Tanggal Hari 1 wajib diisi.');
  o.tanggal_selesai = n === 2 ? wajib(d.tanggal_selesai, 'Tanggal Hari 2 wajib diisi.') : o.tanggal_mulai;
  if (n === 2 && o.tanggal_selesai <= o.tanggal_mulai) throw new Error('Tanggal Hari 2 harus setelah Hari 1.');
  if (o.cakupan === 'sektor' && SEKTOR.indexOf(o.sektor) < 0) throw new Error('Pilih sektor pelatihan.');
  if (!o.kuota || o.kuota < 1) throw new Error('Kuota harus angka lebih dari 0.');

  return denganKunci(() => {
    if (!DB.find('Instruktur', x => x.id_instruktur === o.id_instruktur)) throw new Error('Instruktur tidak ditemukan.');
    if (!d.id_pelatihan) {
      const id = genId('PL');
      DB.insert('Pelatihan', Object.assign({ id_pelatihan: id, status_aktivitas: '{}', syarat_lulus: '', id_flyer: '', id_template_sertifikat: '', tgl_dibuat: now() }, o));
      DB.insert('Evaluasi_Pertanyaan', salinPertanyaan('DEFAULT', id));
      if (d.id_draft) DB.remove('Draft_Pelatihan', DB.filter('Draft_Pelatihan', x => x.id_draft === d.id_draft));
      catatLog(s, 'Membuat pelatihan "' + o.judul + '" (' + n + ' hari)');
      return { id_pelatihan: id, message: 'Pelatihan dibuat. Slot absensi Hari 1' + (n === 2 ? ' dan Hari 2' : '') + ' siap.' };
    }
    const r = DB.find('Pelatihan', x => x.id_pelatihan === d.id_pelatihan);
    if (!r) throw new Error('Pelatihan tidak ditemukan.');
    const lama = parsePel(r);
    const jumlahPeserta = DB.filter('Peserta_Pelatihan', x => x.id_pelatihan === r.id_pelatihan).length;
    if (o.kuota < jumlahPeserta) throw new Error('Kuota tidak boleh lebih kecil dari jumlah peserta terdaftar (' + jumlahPeserta + ').');
    const catatan = [];
    const akt = lama.aktivitas;
    if (lama.jumlah_hari === 2 && n === 1) {
      if (DB.find('Absensi', x => x.id_pelatihan === r.id_pelatihan && String(x.hari_ke) === '2'))
        throw new Error('Tidak bisa diubah menjadi 1 hari: Hari 2 sudah memiliki data absensi.');
      delete akt.absen_2; delete akt.dibuka_absen_2;
      catatan.push('jumlah hari 2 → 1 (slot Hari 2 dihapus)');
    }
    if (lama.jumlah_hari === 1 && n === 2) catatan.push('jumlah hari 1 → 2 (slot Hari 2 dibuat)');
    if (o.tanggal_mulai !== lama.tanggal_mulai) {
      if (akt.dibuka_absen_1) throw new Error('Tanggal Hari 1 tidak bisa diubah karena absensinya sudah pernah dibuka.');
      catatan.push('tanggal Hari 1 ' + lama.tanggal_mulai + ' → ' + o.tanggal_mulai);
    }
    if (n === 2 && lama.jumlah_hari === 2 && o.tanggal_selesai !== lama.tanggal_selesai) {
      if (akt.dibuka_absen_2) throw new Error('Tanggal Hari 2 tidak bisa diubah karena absensinya sudah pernah dibuka.');
      catatan.push('tanggal Hari 2 ' + lama.tanggal_selesai + ' → ' + o.tanggal_selesai);
    }
    o.status_aktivitas = akt;
    DB.update('Pelatihan', r, o);
    catatLog(s, 'Mengubah pelatihan "' + o.judul + '"' + (catatan.length ? ': ' + catatan.join('; ') : ''));
    return { id_pelatihan: r.id_pelatihan, message: 'Pelatihan diperbarui.' + (catatan.length ? ' Status kelulusan dihitung ulang otomatis.' : '') };
  });
}

function aksiPelatihanHapus(d, s) {
  return denganKunci(() => {
    const r = DB.find('Pelatihan', x => x.id_pelatihan === d.id_pelatihan);
    if (!r) throw new Error('Pelatihan tidak ditemukan.');
    const id = r.id_pelatihan;
    if (DB.find('Peserta_Pelatihan', x => x.id_pelatihan === id) || DB.find('Materi', x => x.id_pelatihan === id))
      throw new Error('Pelatihan sudah memiliki peserta atau materi, tidak bisa dihapus. Ubah statusnya menjadi selesai.');
    DB.remove('Evaluasi_Pertanyaan', DB.filter('Evaluasi_Pertanyaan', x => x.id_pelatihan === id));
    DB.remove('Bank_Soal', DB.filter('Bank_Soal', x => x.id_pelatihan === id));
    DB.remove('Tugas', DB.filter('Tugas', x => x.id_pelatihan === id));
    DB.remove('Pelatihan', [DB.find('Pelatihan', x => x.id_pelatihan === id)]);
    catatLog(s, 'Menghapus pelatihan "' + r.judul + '"');
    return { message: 'Pelatihan dihapus.' };
  });
}

function aksiPelatihanFlyer(d, s) {
  const f = d.file || {};
  if (!/^image\//.test(f.tipe || '')) throw new Error('Flyer harus berupa gambar (JPG/PNG).');
  const bytes = Utilities.base64Decode(f.data || '');
  if (bytes.length > MAX_GAMBAR) throw new Error('Ukuran flyer maksimal 5 MB.');
  const p = ambilPel(d.id_pelatihan);
  const file = folder(CONFIG.FOLDER_FLYER).createFile(Utilities.newBlob(bytes, f.tipe, 'Flyer - ' + p.judul + (/png/.test(f.tipe) ? '.png' : '.jpg')));
  bagikanPublik(file);
  return denganKunci(() => {
    const r = DB.find('Pelatihan', x => x.id_pelatihan === d.id_pelatihan);
    if (r.id_flyer) { try { DriveApp.getFileById(r.id_flyer).setTrashed(true); } catch (e) { } }
    DB.update('Pelatihan', r, { id_flyer: file.getId() });
    cacheDel(['flyer_semua']);
    catatLog(s, 'Mengunggah flyer "' + p.judul + '"');
    return { flyer: urlGambar(file.getId()), message: 'Flyer tersimpan dan tampil di beranda peserta.' };
  });
}

// ---------- IDENTITAS APLIKASI (nama, tagline, logo, footer, warna, WA) ----------
const KUNCI_IDENTITAS = ['NAMA_APLIKASI', 'TAGLINE', 'LOGO_DATA', 'TEKS_FOOTER', 'WARNA_UTAMA', 'WA_ADMIN'];
const IDENTITAS_BAWAAN = {
  NAMA_APLIKASI: 'RuangLatih', TAGLINE: 'Pusat Pendampingan UMKM Cakung', LOGO_DATA: '',
  TEKS_FOOTER: '© ' + new Date().getFullYear() + ' PPU UT Cakung · Pusat Pendampingan UMKM Cakung', WARNA_UTAMA: '#9E3D52', WA_ADMIN: ''
};
/** Publik (tanpa login): dipakai halaman masuk & semua tampilan untuk menerapkan identitas aplikasi. */
function aksiBranding() {
  const o = {};
  KUNCI_IDENTITAS.forEach(k => { const v = setting(k, ''); o[k] = v || IDENTITAS_BAWAAN[k]; });
  return { nama: o.NAMA_APLIKASI, tagline: o.TAGLINE, logo: o.LOGO_DATA, footer: o.TEKS_FOOTER, warna: o.WARNA_UTAMA, wa: o.WA_ADMIN };
}
function simpanIdentitas(d) {
  const ubah = [];
  const teks = (k, label, maks, wajibIsi) => {
    if (d[k] === undefined) return;
    const v = String(d[k] || '').trim().replace(/\s+/g, ' ');
    if (wajibIsi && !v) throw new Error(label + ' wajib diisi.');
    if (v.length > maks) throw new Error(label + ' maksimal ' + maks + ' karakter.');
    setSetting(k, v); ubah.push(label.toLowerCase());
  };
  teks('NAMA_APLIKASI', 'Nama aplikasi', 40, true);
  teks('TAGLINE', 'Tagline', 100, false);
  teks('TEKS_FOOTER', 'Teks footer', 160, false);
  if (d.WARNA_UTAMA !== undefined) {
    const w = String(d.WARNA_UTAMA || '').trim();
    if (!/^#[0-9a-f]{6}$/i.test(w)) throw new Error('Warna utama harus kode heksa, mis. #9E3D52.');
    setSetting('WARNA_UTAMA', w.toUpperCase()); ubah.push('warna');
  }
  if (d.WA_ADMIN !== undefined) {
    let w = String(d.WA_ADMIN || '').replace(/\D/g, '');
    if (w.indexOf('0') === 0) w = '62' + w.slice(1);
    if (w && !/^628\d{7,12}$/.test(w)) throw new Error('Nomor WhatsApp admin tidak valid (contoh 081234567890).');
    setSetting('WA_ADMIN', w); ubah.push('nomor WA');
  }
  if (d.LOGO_DATA !== undefined) {
    const l = String(d.LOGO_DATA || '');
    if (l && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(l)) throw new Error('Format logo tidak dikenali. Gunakan PNG, JPG, atau WebP.');
    if (l.length > 45000) throw new Error('Logo terlalu besar setelah diperkecil. Coba gambar yang lebih sederhana.');
    setSetting('LOGO_DATA', l); ubah.push(l ? 'logo' : 'hapus logo');
  }
  return ubah;
}

// ---------- DRAFT PELATIHAN (belum final, tidak terlihat peserta/instruktur) ----------
function aksiDraftList(d, s) {
  return DB.rows('Draft_Pelatihan').map(r => ({ id_draft: r.id_draft, judul: r.judul, data: pj(r.data, {}), dibuat_oleh: r.dibuat_oleh, tgl_diubah: r.tgl_diubah }))
    .sort((a, b) => String(b.tgl_diubah).localeCompare(String(a.tgl_diubah)));
}
function aksiDraftSimpan(d, s) {
  const data = d.data || {};
  const judul = String(data.judul || '').trim() || '(Tanpa judul)';
  const id = /^DRF-[A-Z0-9]{4,20}$/.test(String(d.id_draft || '')) ? d.id_draft : genId('DRF');
  const txt = JSON.stringify(data);
  if (txt.length > 40000) throw new Error('Isi draft terlalu panjang.');
  return denganKunci(() => {
    const r = DB.find('Draft_Pelatihan', x => x.id_draft === id);
    const o = { judul: judul, data: txt, dibuat_oleh: s.n, tgl_diubah: now() };
    if (r) DB.update('Draft_Pelatihan', r, o);
    else DB.insert('Draft_Pelatihan', Object.assign({ id_draft: id }, o));
    return { id_draft: id, message: 'Draft tersimpan.' };
  });
}
function aksiDraftHapus(d, s) {
  return denganKunci(() => {
    DB.remove('Draft_Pelatihan', DB.filter('Draft_Pelatihan', x => x.id_draft === d.id_draft));
    return { message: 'Draft dihapus.' };
  });
}

// ---------- PESERTA PELATIHAN ----------
/**
 * Daftarkan UMKM ke pelatihan. d.peserta = [{id_umkm, nama_peserta, gender, no_hp}]
 * — nama_peserta boleh karyawan/perwakilan (kosong = pemilik UMKM). d.ids tetap didukung.
 */
function dataPerwakilan(x, u) {
  const nm = String(x.nama_peserta || '').trim().replace(/\s+/g, ' ');
  const o = { nama_peserta: nm && kunciNama(nm) !== kunciNama(u.nama_pemilik) ? nm : '' };
  const g = String(x.gender || '').toLowerCase();
  o.gender_peserta = o.nama_peserta ? (/^(l|laki|pria)/.test(g) ? 'Laki-laki' : (/^(p|perempuan|wanita)/.test(g) ? 'Perempuan' : '')) : '';
  o.hp_peserta = o.nama_peserta && x.no_hp ? normHP(x.no_hp) : '';
  if (o.hp_peserta && (o.hp_peserta.length < 10 || o.hp_peserta.length > 14)) throw new Error('Nomor HP peserta ' + nm + ' tidak valid.');
  return o;
}
function aksiPesertaDaftarkan(d, s) {
  const daftar = (d.peserta && d.peserta.length ? d.peserta : [].concat(d.ids || []).map(id => ({ id_umkm: id })));
  if (!daftar.length) throw new Error('Pilih minimal satu UMKM.');
  return denganKunci(() => {
    const p = ambilPel(d.id_pelatihan);
    const ada = {};
    DB.filter('Peserta_Pelatihan', x => x.id_pelatihan === p.id_pelatihan).forEach(x => ada[x.id_umkm] = true);
    const umkm = {};
    DB.rows('UMKM').forEach(u => { if (u.status_akun === 'aktif') umkm[u.id_umkm] = u; });
    const sudah = {};
    const baru = daftar.filter(x => { const ok = x.id_umkm && !sudah[x.id_umkm] && !ada[x.id_umkm] && umkm[x.id_umkm]; sudah[x.id_umkm] = true; return ok; });
    const total = Object.keys(ada).length + baru.length;
    if (total > p.kuota) throw new Error('Kuota terlampaui: sisa kuota ' + (p.kuota - Object.keys(ada).length) + ', dipilih ' + baru.length + '.');
    DB.insert('Peserta_Pelatihan', baru.map(x => Object.assign({ id_pelatihan: p.id_pelatihan, id_umkm: x.id_umkm, status_lulus: 'belum', no_sertifikat: '', id_file_sertifikat: '', tgl_daftar: now() }, dataPerwakilan(x, umkm[x.id_umkm]))));
    const wakil = baru.filter(x => String(x.nama_peserta || '').trim() && kunciNama(x.nama_peserta) !== kunciNama(umkm[x.id_umkm].nama_pemilik)).length;
    catatLog(s, 'Mendaftarkan ' + baru.length + ' peserta ke "' + p.judul + '"' + (wakil ? ' (' + wakil + ' perwakilan/karyawan)' : ''));
    return { message: baru.length + ' peserta didaftarkan (' + total + '/' + p.kuota + ').' };
  });
}
/** Ganti nama peserta yang mewakili UMKM di satu pelatihan (mis. owner mengutus karyawan lain). */
function aksiPesertaUbah(d, s) {
  return denganKunci(() => {
    const r = terdaftar(d.id_pelatihan, d.id_umkm);
    if (!r) throw new Error('Peserta tidak terdaftar.');
    const u = DB.find('UMKM', x => x.id_umkm === d.id_umkm) || {};
    const o = dataPerwakilan(d, u);
    DB.update('Peserta_Pelatihan', r, o);
    catatLog(s, 'Mengubah peserta ' + (u.nama_umkm || d.id_umkm) + ' menjadi ' + (o.nama_peserta || u.nama_pemilik + ' (pemilik)') + ' di ' + d.id_pelatihan);
    return { message: 'Peserta ' + (u.nama_umkm || '') + ': ' + (o.nama_peserta || u.nama_pemilik) + '.', nama_peserta: o.nama_peserta };
  });
}
function aksiPesertaHapus(d, s) {
  return denganKunci(() => {
    const r = terdaftar(d.id_pelatihan, d.id_umkm);
    if (!r) throw new Error('Peserta tidak terdaftar.');
    const punyaData = DB.find('Absensi', x => x.id_pelatihan === d.id_pelatihan && x.id_umkm === d.id_umkm)
      || DB.find('Hasil_Tes', x => x.id_pelatihan === d.id_pelatihan && x.id_umkm === d.id_umkm);
    if (punyaData) throw new Error('Peserta sudah memiliki absensi/nilai, tidak bisa dikeluarkan.');
    DB.remove('Peserta_Pelatihan', [r]);
    catatLog(s, 'Mengeluarkan ' + d.id_umkm + ' dari ' + d.id_pelatihan);
    return { message: 'Peserta dikeluarkan dari pelatihan.' };
  });
}

// ---------- BUKA/TUTUP AKTIVITAS ----------
function aksiAktivitasSet(d, s) {
  const kunci = d.kunci;
  const valid = ['absen_1', 'absen_2', 'pre', 'post', 'tugas', 'evaluasi'];
  if (valid.indexOf(kunci) < 0) throw new Error('Aktivitas tidak dikenal.');
  return denganKunci(() => {
    const r = DB.find('Pelatihan', x => x.id_pelatihan === d.id_pelatihan);
    if (!r) throw new Error('Pelatihan tidak ditemukan.');
    const p = parsePel(r);
    if (kunci === 'absen_2' && p.jumlah_hari < 2) throw new Error('Pelatihan ini hanya 1 hari.');
    const akt = p.aktivitas;
    akt[kunci] = !!d.buka;
    if (kunci.indexOf('absen_') === 0 && d.buka) akt['dibuka_' + kunci] = true;
    DB.update('Pelatihan', r, { status_aktivitas: akt });
    const label = { absen_1: 'Absensi Hari 1', absen_2: 'Absensi Hari 2', pre: 'Pre-test', post: 'Post-test', tugas: 'Tugas', evaluasi: 'Evaluasi' }[kunci];
    catatLog(s, (d.buka ? 'Membuka ' : 'Menutup ') + label + ' — ' + p.judul);
    return { aktivitas: akt, message: label + (d.buka ? ' dibuka.' : ' ditutup.') };
  });
}
function aksiSyaratSet(d, s) {
  return denganKunci(() => {
    const r = DB.find('Pelatihan', x => x.id_pelatihan === d.id_pelatihan);
    if (!r) throw new Error('Pelatihan tidak ditemukan.');
    const sy = d.syarat || {};
    const o = { hadir: !!sy.hadir, post: !!sy.post, naik: !!sy.naik, tugas: !!sy.tugas };
    DB.update('Pelatihan', r, { syarat_lulus: o });
    catatLog(s, 'Mengubah syarat lulus ' + r.judul);
    return { message: 'Syarat kelulusan disimpan.' };
  });
}

// ---------- FORM EVALUASI ----------
function salinPertanyaan(dari, ke) {
  let src = DB.filter('Evaluasi_Pertanyaan', x => x.id_pelatihan === dari);
  if (!src.length) src = pertanyaanEvaluasiBawaan(ke);
  return src.map(x => ({ id_pelatihan: ke, bagian: x.bagian, nomor: x.nomor, pertanyaan: x.pertanyaan, tipe: x.tipe }));
}
function pertanyaanPelatihan(id) {
  let q = DB.filter('Evaluasi_Pertanyaan', x => x.id_pelatihan === id);
  if (!q.length) q = DB.filter('Evaluasi_Pertanyaan', x => x.id_pelatihan === 'DEFAULT');
  if (!q.length) q = pertanyaanEvaluasiBawaan(id);
  return q.map(x => ({ bagian: x.bagian, nomor: parseInt(x.nomor, 10), pertanyaan: x.pertanyaan, tipe: x.tipe }))
    .sort((a, b) => a.bagian.localeCompare(b.bagian) || a.nomor - b.nomor);
}
function aksiEvalForm(d, s) {
  if (d.id_pelatihan !== 'DEFAULT') ambilPel(d.id_pelatihan);
  const terisi = DB.filter('Evaluasi_Jawaban', x => x.id_pelatihan === d.id_pelatihan).length;
  return { pertanyaan: pertanyaanPelatihan(d.id_pelatihan), jumlah_jawaban: terisi };
}
function aksiEvalSimpanForm(d, s) {
  const q = (d.pertanyaan || []).filter(x => String(x.pertanyaan || '').trim());
  if (!q.length) throw new Error('Form evaluasi minimal berisi satu pertanyaan.');
  return denganKunci(() => {
    if (d.id_pelatihan !== 'DEFAULT') ambilPel(d.id_pelatihan);
    const nomor = {};
    const rows = q.map(x => {
      const b = String(x.bagian || 'A').toUpperCase();
      nomor[b] = (nomor[b] || 0) + 1;
      return { id_pelatihan: d.id_pelatihan, bagian: b, nomor: nomor[b], pertanyaan: String(x.pertanyaan).trim(), tipe: x.tipe === 'teks' ? 'teks' : 'skala' };
    });
    DB.remove('Evaluasi_Pertanyaan', DB.filter('Evaluasi_Pertanyaan', x => x.id_pelatihan === d.id_pelatihan));
    DB.insert('Evaluasi_Pertanyaan', rows);
    cacheDel(['eval_' + d.id_pelatihan]);
    catatLog(s, 'Menyimpan form evaluasi ' + d.id_pelatihan);
    return { message: 'Form evaluasi disimpan.' };
  });
}
function aksiEvalSalin(d, s) {
  return denganKunci(() => {
    ambilPel(d.ke);
    const rows = salinPertanyaan(d.dari, d.ke);
    DB.remove('Evaluasi_Pertanyaan', DB.filter('Evaluasi_Pertanyaan', x => x.id_pelatihan === d.ke));
    DB.insert('Evaluasi_Pertanyaan', rows);
    cacheDel(['eval_' + d.ke]);
    return { message: 'Form evaluasi disalin (' + rows.length + ' pertanyaan).' };
  });
}
function aksiEvalHasil(d, s) {
  const p = ambilPel(d.id_pelatihan);
  const q = pertanyaanPelatihan(p.id_pelatihan);
  const jwb = DB.filter('Evaluasi_Jawaban', x => x.id_pelatihan === p.id_pelatihan);
  const umkm = {};
  DB.rows('UMKM').forEach(u => umkm[u.id_umkm] = u.nama_umkm);
  const parsed = jwb.map(j => ({ id_umkm: j.id_umkm, j: pj(j.jawaban, {}) }));
  const hasil = q.map(x => {
    const key = x.bagian + x.nomor;
    if (x.tipe === 'teks') {
      return Object.assign({}, x, { teks: parsed.filter(a => String(a.j[key] || '').trim()).map(a => ({ umkm: umkm[a.id_umkm] || a.id_umkm, isi: a.j[key] })) });
    }
    const dist = [0, 0, 0, 0];
    const nilai = parsed.map(a => parseInt(a.j[key], 10)).filter(v => v >= 1 && v <= 4);
    nilai.forEach(v => dist[v - 1]++);
    return Object.assign({}, x, { rata: rata(nilai), distribusi: dist });
  });
  const perBagian = {};
  ['A', 'B', 'C'].forEach(b => perBagian[b] = rata(hasil.filter(h => h.bagian === b && h.rata !== null).map(h => h.rata)));
  const peserta = DB.filter('Peserta_Pelatihan', x => x.id_pelatihan === p.id_pelatihan).length;
  return { pelatihan: ringkasPel(p), jumlah_jawaban: jwb.length, jumlah_peserta: peserta, per_bagian: perBagian, hasil: hasil };
}

// ---------- PENGATURAN & AKUN ADMIN ----------
const KUNCI_PENGATURAN = ['NAMA_LEMBAGA', 'SYARAT_LULUS_DEFAULT', 'FORMAT_NO_SERTIFIKAT', 'TEMPLATE_SERTIFIKAT_ID', 'TEMPLATE_LAPORAN_ID'].concat(KUNCI_IDENTITAS);
function aksiPengaturanGet(d, s) {
  const o = {};
  KUNCI_PENGATURAN.forEach(k => o[k] = setting(k, ''));
  o.SYARAT_LULUS_DEFAULT = syaratDefault();
  o.folder = 'https://drive.google.com/drive/folders/' + CONFIG.ROOT_FOLDER_ID;
  o.folder_template = 'https://drive.google.com/drive/folders/' + CONFIG.FOLDER_TEMPLATE;
  o.spreadsheet = 'https://docs.google.com/spreadsheets/d/' + CONFIG.SPREADSHEET_ID;
  try { o.log_otomatis = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'bersihkanLogBulanan'); } catch (e) { o.log_otomatis = null; }
  return o;
}
function idDariLink(v) {
  const m = String(v || '').match(/[-\w]{25,}/);
  return m ? m[0] : '';
}
function aksiPengaturanSimpan(d, s) {
  return denganKunci(() => {
    if (d.NAMA_LEMBAGA !== undefined) setSetting('NAMA_LEMBAGA', String(d.NAMA_LEMBAGA).trim());
    if (d.FORMAT_NO_SERTIFIKAT !== undefined) {
      if (String(d.FORMAT_NO_SERTIFIKAT).indexOf('{urut}') < 0) throw new Error('Format nomor sertifikat wajib memuat {urut}.');
      setSetting('FORMAT_NO_SERTIFIKAT', String(d.FORMAT_NO_SERTIFIKAT).trim());
    }
    if (d.SYARAT_LULUS_DEFAULT) {
      const sy = d.SYARAT_LULUS_DEFAULT;
      setSetting('SYARAT_LULUS_DEFAULT', JSON.stringify({ hadir: !!sy.hadir, post: !!sy.post, naik: !!sy.naik, tugas: !!sy.tugas }));
    }
    if (d.TEMPLATE_LAPORAN_ID !== undefined) {
      const id = idDariLink(d.TEMPLATE_LAPORAN_ID);
      if (d.TEMPLATE_LAPORAN_ID && !id) throw new Error('Link template laporan tidak valid.');
      if (id) SpreadsheetApp.openById(id); // memastikan bisa dibuka
      setSetting('TEMPLATE_LAPORAN_ID', id);
    }
    const idt = simpanIdentitas(d);
    catatLog(s, idt.length ? 'Mengubah identitas aplikasi (' + idt.join(', ') + ')' : 'Mengubah pengaturan');
    return { message: 'Pengaturan disimpan.', identitas: aksiBranding() };
  });
}
function aksiAdminList(d, s) {
  return DB.rows('Admin').map(a => ({ username: a.username, nama: a.nama, saya: a.username === s.id }));
}
function aksiAdminSimpan(d, s) {
  const un = wajib(d.username, 'Username wajib diisi.').toLowerCase();
  const nama = wajib(d.nama, 'Nama wajib diisi.');
  const pw = wajib(d.password, 'Kata sandi wajib diisi.');
  if (!/^[a-z0-9._]{3,}$/.test(un)) throw new Error('Username minimal 3 karakter: huruf kecil, angka, titik, garis bawah.');
  if (pw.length < 8) throw new Error('Kata sandi minimal 8 karakter.');
  return denganKunci(() => {
    if (DB.find('Admin', a => a.username === un)) throw new Error('Username sudah ada.');
    DB.insert('Admin', { username: un, password_hash: hashPassword(pw), nama: nama });
    catatLog(s, 'Menambah admin ' + un);
    return { message: 'Admin ' + un + ' ditambahkan.' };
  });
}
function aksiAdminHapus(d, s) {
  return denganKunci(() => {
    if (d.username === s.id) throw new Error('Tidak bisa menghapus akun yang sedang dipakai.');
    const a = DB.find('Admin', x => x.username === d.username);
    if (!a) throw new Error('Admin tidak ditemukan.');
    DB.remove('Admin', [a]);
    catatLog(s, 'Menghapus admin ' + d.username);
    return { message: 'Admin dihapus.' };
  });
}
function aksiLogList(d, s) {
  const rows = DB.rows('Log_Aktivitas');
  const lim = Math.min(parseInt(d.limit, 10) || 200, 1000);
  const nm = petaNamaPengguna();
  return rows.slice(-lim).reverse().map(r => ({ waktu: r.waktu, peran: r.peran, id_pengguna: r.id_pengguna, nama: nm[r.peran + '|' + r.id_pengguna] || r.id_pengguna, aksi: r.aksi }));
}
/** Peta "peran|id" → nama tampilan, agar log menampilkan nama, bukan kode. */
function petaNamaPengguna() {
  const m = {};
  DB.rows('UMKM').forEach(u => m['peserta|' + u.id_umkm] = u.nama_pemilik + (u.nama_umkm ? ' (' + u.nama_umkm + ')' : ''));
  DB.rows('Instruktur').forEach(i => m['instruktur|' + i.id_instruktur] = i.nama);
  DB.rows('Admin').forEach(a => m['admin|' + a.username] = a.nama);
  m['sistem|-'] = 'Sistem';
  return m;
}

// ==================== Peserta.gs ====================
/**
 * ============================================================
 *  RuangLatih — File 4/5 : Peserta.gs
 *  Khusus Peserta UMKM: beranda, ruang pelatihan, absensi,
 *  pre/post-test (skor dihitung di server), tugas, evaluasi,
 *  materi sesuai sektor, riwayat, dan sertifikat.
 *  Pola tulis: cek hak akses di luar kunci → tulis singkat di
 *  dalam kunci, agar 50 peserta bisa mengirim di menit yang sama.
 * ============================================================
 */

function pelatihanSaya(idUmkm) {
  const ids = {};
  DB.filter('Peserta_Pelatihan', x => x.id_umkm === idUmkm).forEach(x => ids[x.id_pelatihan] = x);
  return DB.rows('Pelatihan').filter(p => ids[p.id_pelatihan]).map(parsePel)
    .map(p => Object.assign(p, { _reg: ids[p.id_pelatihan] }));
}
function labelHari(tgl) {
  const t = hariIni();
  return tgl === t ? 'Berlangsung' : (tgl > t ? 'Akan Datang' : 'Selesai');
}

function aksiPBeranda(d, s) {
  const u = DB.find('UMKM', x => x.id_umkm === s.id) || {};
  const pels = pelatihanSaya(s.id);
  const agenda = [];
  pels.filter(p => p.status !== 'selesai').forEach(p => p.tanggal_hari.forEach((tgl, i) => agenda.push({
    id_pelatihan: p.id_pelatihan, judul: p.judul, hari_ke: i + 1, jumlah_hari: p.jumlah_hari,
    tanggal: tgl, jam: p.jam, lokasi: p.lokasi_atau_link, format: p.format, label: labelHari(tgl)
  })));
  agenda.sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)));

  let flyer = cacheGet('flyer_semua');
  if (!flyer) {
    flyer = DB.rows('Pelatihan').map(parsePel).filter(p => p.id_flyer && p.status !== 'selesai')
      .sort((a, b) => String(b.tanggal_mulai).localeCompare(String(a.tanggal_mulai)))
      .map(p => ({ id_pelatihan: p.id_pelatihan, judul: p.judul, tanggal: rentangTanggal(p), lokasi: p.lokasi_atau_link, gambar: urlGambar(p.id_flyer), url: urlLihat(p.id_flyer) }));
    cachePut('flyer_semua', flyer, 1800);
  }
  const aktif = pels.filter(p => p.status === 'berlangsung').map(p => ({ id_pelatihan: p.id_pelatihan, judul: p.judul }));
  return {
    profil: { nama_umkm: u.nama_umkm, nama_pemilik: u.nama_pemilik, sektor: u.sektor },
    aktif: aktif, agenda: agenda.slice(0, 6), flyer: flyer.slice(0, 5)
  };
}

function aksiPPelatihan(d, s) {
  return pelatihanSaya(s.id).map(p => {
    const idx = indeksPelatihan(p.id_pelatihan);
    const st = statusPeserta(p, s.id, idx);
    return Object.assign(ringkasPel(p), { hadir: st.hadir, lulus: st.lulus });
  }).sort((a, b) => {
    const o = { berlangsung: 0, 'akan datang': 1, selesai: 2 };
    return (o[a.status] - o[b.status]) || String(b.tanggal_mulai).localeCompare(String(a.tanggal_mulai));
  });
}

function aksiPRuang(d, s) {
  const p = cekAkses(s, d.id_pelatihan);
  const idx = indeksPelatihan(p.id_pelatihan);
  const st = statusPeserta(p, s.id, idx);
  const slot = p.tanggal_hari.map((tgl, i) => ({
    hari_ke: i + 1, tanggal: tgl, hadir: !!st.absen[i + 1], waktu: st.absen[i + 1] || '',
    buka: aktivitasBuka(p, 'absen_' + (i + 1)), hari_ini: tgl === hariIni()
  }));
  const kp = idx.kumpul[s.id] || {};
  const tugas = idx.tugas.map(t => {
    const k = kp[t.id_tugas];
    return {
      id_tugas: t.id_tugas, judul: t.judul, instruksi: t.instruksi, batas_waktu: t.batas_waktu,
      lewat: !!(t.batas_waktu && now() > t.batas_waktu),
      kumpul: k ? { nama_file: k.nama_file, tipe_file: k.tipe_file, waktu: k.waktu_kumpul, skor: num(k.skor), catatan: k.catatan_instruktur, dinilai: k.skor !== '' } : null
    };
  });
  const jmlSoal = { pre: 0, post: 0 };
  DB.filter('Bank_Soal', x => x.id_pelatihan === p.id_pelatihan).forEach(x => {
    if (x.jenis === 'pre' || x.jenis === 'pre+post') jmlSoal.pre++;
    if (x.jenis === 'post' || x.jenis === 'pre+post') jmlSoal.post++;
  });
  const materi = DB.filter('Materi', m => m.id_pelatihan === p.id_pelatihan).map(m => formatMateri(m, p.judul)).sort((a, b) => a.urutan - b.urutan);
  const info = ringkasPel(p);
  delete info.id_template_sertifikat;
  return {
    pelatihan: info,
    absensi: slot,
    tes: {
      pre: { buka: aktivitasBuka(p, 'pre'), selesai: st.pre !== null, skor: st.pre, jumlah_soal: jmlSoal.pre },
      post: { buka: aktivitasBuka(p, 'post'), selesai: st.post !== null, skor: st.post, jumlah_soal: jmlSoal.post }
    },
    tugas: { buka: aktivitasBuka(p, 'tugas'), daftar: tugas },
    evaluasi: { buka: aktivitasBuka(p, 'evaluasi'), selesai: st.evaluasi },
    materi: materi,
    status: { lulus: st.lulus, kurang: st.kurang, hadir: st.hadir, jumlah_hari: st.jumlah_hari }
  };
}

// ---------- ABSENSI ----------
function aksiPAbsen(d, s) {
  const p = cekAkses(s, d.id_pelatihan);
  const hari = parseInt(d.hari_ke, 10);
  if (!(hari >= 1 && hari <= p.jumlah_hari)) throw new Error('Slot absensi tidak tersedia.');
  if (!aktivitasBuka(p, 'absen_' + hari)) throw new Error('Absensi Hari ' + hari + ' belum dibuka atau sudah ditutup.');
  return denganKunci(() => {
    if (DB.find('Absensi', x => x.id_pelatihan === p.id_pelatihan && x.id_umkm === s.id && String(x.hari_ke) === String(hari)))
      throw new Error('Anda sudah absen untuk Hari ' + hari + '.');
    const w = now();
    DB.insert('Absensi', { id_pelatihan: p.id_pelatihan, id_umkm: s.id, hari_ke: hari, tanggal: p.tanggal_hari[hari - 1], waktu_absen: w, metode: 'aplikasi' });
    return { hari_ke: hari, waktu: w, message: 'Absensi Hari ' + hari + ' tercatat.' };
  });
}

// ---------- PRE-TEST / POST-TEST ----------
function soalServer(idPel, jenis) {
  // Soal lengkap dengan kunci — hanya dipakai di server, tidak pernah dikirim ke HP
  const key = 'soalk_' + idPel + '_' + jenis;
  let s = cacheGet(key);
  if (!s) {
    s = DB.filter('Bank_Soal', x => x.id_pelatihan === idPel && (x.jenis === jenis || x.jenis === 'pre+post'))
      .sort((a, b) => (parseInt(a.urutan, 10) || 0) - (parseInt(b.urutan, 10) || 0))
      .map(x => ({ id: x.id_soal, q: x.pertanyaan, o: ['a', 'b', 'c', 'd', 'e'].filter(k => x['opsi_' + k]).map(k => [k, x['opsi_' + k]]), k: x.kunci }));
    cachePut(key, s, 600);
  }
  return s;
}
function sudahTes(idPel, idUmkm, jenis) {
  return DB.find('Hasil_Tes', x => x.id_pelatihan === idPel && x.id_umkm === idUmkm && x.jenis === jenis);
}
function aksiPSoal(d, s) {
  const jenis = d.jenis === 'post' ? 'post' : 'pre';
  const p = cekAkses(s, d.id_pelatihan);
  if (!aktivitasBuka(p, jenis)) throw new Error((jenis === 'pre' ? 'Pre-test' : 'Post-test') + ' belum dibuka.');
  if (sudahTes(p.id_pelatihan, s.id, jenis)) throw new Error('Anda sudah mengerjakan ' + (jenis === 'pre' ? 'pre-test' : 'post-test') + ' ini.');
  const soal = soalServer(p.id_pelatihan, jenis);
  if (!soal.length) throw new Error('Soal belum disiapkan instruktur.');
  return {
    judul: p.judul, jenis: jenis,
    soal: soal.map(x => ({ id_soal: x.id, pertanyaan: x.q, opsi: x.o.map(o => ({ kode: o[0], teks: o[1] })) }))
  };
}
function aksiPKirimTes(d, s) {
  const jenis = d.jenis === 'post' ? 'post' : 'pre';
  const p = cekAkses(s, d.id_pelatihan);
  if (!aktivitasBuka(p, jenis)) throw new Error('Tes sudah ditutup.');
  const soal = soalServer(p.id_pelatihan, jenis);
  const jwb = d.jawaban || {};
  let benar = 0;
  soal.forEach(x => { if (String(jwb[x.id] || '').toLowerCase() === x.k) benar++; });
  const skor = soal.length ? bulat(benar / soal.length * 100) : 0;
  return denganKunci(() => {
    if (sudahTes(p.id_pelatihan, s.id, jenis)) throw new Error('Tes ini sudah pernah dikirim. Hanya boleh 1 kali.');
    DB.insert('Hasil_Tes', { id_pelatihan: p.id_pelatihan, id_umkm: s.id, jenis: jenis, jawaban: jwb, jumlah_benar: benar, skor: skor, waktu_selesai: now() });
    return { jumlah_benar: benar, jumlah_soal: soal.length, skor: skor, message: 'Jawaban tersimpan.' };
  });
}

// ---------- TUGAS ----------
function aksiPKumpulTugas(d, s) {
  const t = DB.find('Tugas', x => x.id_tugas === d.id_tugas);
  if (!t) throw new Error('Tugas tidak ditemukan.');
  const p = cekAkses(s, t.id_pelatihan);
  if (!aktivitasBuka(p, 'tugas')) throw new Error('Pengumpulan tugas belum dibuka atau sudah ditutup.');
  if (t.batas_waktu && now() > t.batas_waktu) throw new Error('Batas waktu pengumpulan sudah lewat.');
  const lama = DB.find('Pengumpulan_Tugas', x => x.id_tugas === t.id_tugas && x.id_umkm === s.id);
  if (lama && lama.skor !== '') throw new Error('Tugas sudah dinilai, tidak bisa diganti.');
  const f = d.file || {};
  const tipe = String(f.tipe || '');
  if (!/^(image\/(jpeg|png)|application\/pdf)$/.test(tipe)) throw new Error('File harus JPG, PNG, atau PDF.');
  const bytes = Utilities.base64Decode(f.data || '');
  if (!bytes.length) throw new Error('File kosong.');
  if (bytes.length > MAX_TUGAS) throw new Error('Ukuran file maksimal 10 MB.');

  const ext = tipe === 'application/pdf' ? '.pdf' : (tipe === 'image/png' ? '.png' : '.jpg');
  const namaFile = (s.u || s.id) + ' - ' + t.judul + ext;
  const dir = subFolder(CONFIG.FOLDER_TUGAS, p.id_pelatihan);
  const file = dir.createFile(Utilities.newBlob(bytes, tipe, namaFile));

  return denganKunci(() => {
    const cek = DB.find('Pengumpulan_Tugas', x => x.id_tugas === t.id_tugas && x.id_umkm === s.id);
    const data = { id_file: file.getId(), nama_file: f.nama || namaFile, tipe_file: tipe, waktu_kumpul: now(), skor: '', catatan_instruktur: '', dinilai_oleh: '', waktu_dinilai: '' };
    if (cek) {
      if (cek.skor !== '') { file.setTrashed(true); throw new Error('Tugas sudah dinilai, tidak bisa diganti.'); }
      try { DriveApp.getFileById(cek.id_file).setTrashed(true); } catch (e) { }
      DB.update('Pengumpulan_Tugas', cek, data);
    } else {
      DB.insert('Pengumpulan_Tugas', Object.assign({ id_tugas: t.id_tugas, id_umkm: s.id }, data));
    }
    catatLog(s, (s.u || s.id) + ' mengunggah berkas tugas "' + t.judul + '"');
    return { message: cek ? 'Berkas tugas diganti.' : 'Tugas terkirim.' };
  });
}

// ---------- EVALUASI ----------
function aksiPEvalForm(d, s) {
  const p = cekAkses(s, d.id_pelatihan);
  if (!aktivitasBuka(p, 'evaluasi')) throw new Error('Evaluasi belum dibuka.');
  const sudah = !!DB.find('Evaluasi_Jawaban', x => x.id_pelatihan === p.id_pelatihan && x.id_umkm === s.id);
  return {
    kepala: { judul: p.judul, instruktur: namaInstruktur(p.id_instruktur), tanggal: rentangTanggal(p) },
    pertanyaan: pertanyaanPelatihan(p.id_pelatihan), sudah: sudah
  };
}
function aksiPKirimEval(d, s) {
  const p = cekAkses(s, d.id_pelatihan);
  if (!aktivitasBuka(p, 'evaluasi')) throw new Error('Evaluasi sudah ditutup.');
  const q = pertanyaanPelatihan(p.id_pelatihan);
  const jwb = d.jawaban || {}, bersih = {};
  q.forEach(x => {
    const k = x.bagian + x.nomor;
    if (x.tipe === 'skala') {
      const v = parseInt(jwb[k], 10);
      if (!(v >= 1 && v <= 4)) throw new Error('Pertanyaan ' + x.bagian + '.' + x.nomor + ' belum dijawab.');
      bersih[k] = v;
    } else bersih[k] = String(jwb[k] || '').trim().slice(0, 2000);
  });
  return denganKunci(() => {
    if (DB.find('Evaluasi_Jawaban', x => x.id_pelatihan === p.id_pelatihan && x.id_umkm === s.id))
      throw new Error('Evaluasi hanya bisa diisi 1 kali.');
    DB.insert('Evaluasi_Jawaban', { id_pelatihan: p.id_pelatihan, id_umkm: s.id, jawaban: bersih, waktu_isi: now() });
    return { message: 'Terima kasih, evaluasi Anda tersimpan.' };
  });
}

// ---------- MATERI (sektor sendiri + umum + pelatihan yang diikuti) ----------
function aksiPMateri(d, s) {
  let semua = cacheGet('materi_semua');
  if (!semua) {
    const judul = {};
    DB.rows('Pelatihan').forEach(p => judul[p.id_pelatihan] = p.judul);
    semua = DB.rows('Materi').map(m => formatMateri(m, judul[m.id_pelatihan]));
    cachePut('materi_semua', semua, 1800);
  }
  const ikut = {};
  DB.filter('Peserta_Pelatihan', x => x.id_umkm === s.id).forEach(x => ikut[x.id_pelatihan] = true);
  return semua.filter(m => m.cakupan === 'umum' || m.sektor === s.s || ikut[m.id_pelatihan])
    .sort((a, b) => String(b.tgl).localeCompare(String(a.tgl)));
}

// ---------- RIWAYAT & SERTIFIKAT ----------
function aksiPRiwayat(d, s) {
  return pelatihanSaya(s.id).map(p => {
    const st = statusPeserta(p, s.id, indeksPelatihan(p.id_pelatihan));
    return {
      id_pelatihan: p.id_pelatihan, judul: p.judul, tanggal: rentangTanggal(p), status: p.status,
      instruktur: namaInstruktur(p.id_instruktur), hadir: st.hadir, jumlah_hari: st.jumlah_hari,
      pre: st.pre, post: st.post, kenaikan: st.kenaikan, skor_tugas: st.skor_tugas,
      tugas_kumpul: st.tugas_kumpul, tugas_total: st.tugas_total, lulus: st.lulus, kurang: st.kurang,
      sertifikat: !!p._reg.id_file_sertifikat, nama_peserta: p._reg.nama_peserta || ''
    };
  }).sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));
}
function aksiPSertifikat(d, s) {
  return aksiPRiwayat(d, s).map(r => ({
    id_pelatihan: r.id_pelatihan, judul: r.judul, tanggal: r.tanggal, instruktur: r.instruktur,
    lulus: r.lulus, kurang: r.kurang, tersedia: r.lulus && r.sertifikat,
    no_sertifikat: (terdaftar(r.id_pelatihan, s.id) || {}).no_sertifikat || ''
  }));
}
function aksiPUnduhSertifikat(d, s) {
  const p = cekAkses(s, d.id_pelatihan);
  const reg = terdaftar(p.id_pelatihan, s.id);
  const st = statusPeserta(p, s.id, indeksPelatihan(p.id_pelatihan));
  if (!st.lulus) throw new Error('Sertifikat hanya untuk peserta yang lulus.');
  if (!reg.id_file_sertifikat) throw new Error('Sertifikat belum diterbitkan admin.');
  return fileKeBase64(reg.id_file_sertifikat);
}

// ============================================
// ABSENSI VIA SCAN QR (tanpa login)
// ============================================
/** Kode rahasia QR per pelatihan (tetap, dari HMAC) — tanpanya halaman absen tidak bisa dipakai. */
function kodeQR(idPel) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature('qr|' + idPel, rahasia())).replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
}
function pelDariQR(d) {
  const p = DB.find('Pelatihan', x => x.id_pelatihan === d.id_pelatihan);
  if (!p || String(d.kode || '') !== kodeQR(p.id_pelatihan)) throw new Error('QR absensi tidak valid. Minta panitia menampilkan QR yang benar.');
  return parsePel(p);
}
/** Hari yang boleh diisi lewat QR: slot dibuka admin ATAU tanggalnya hari ini. */
function hariQR(p) {
  const hi = hariIni();
  return p.tanggal_hari.map((t, i) => ({ hari_ke: i + 1, tanggal: t, hari_ini: t === hi, buka: aktivitasBuka(p, 'absen_' + (i + 1)) || t === hi }));
}
function aksiQrInfo(d) {
  const p = pelDariQR(d);
  return {
    id_pelatihan: p.id_pelatihan, judul: p.judul, tema: p.tema, instruktur: namaInstruktur(p.id_instruktur), jam: p.jam,
    format: p.format, lokasi: p.lokasi_atau_link, jumlah_hari: p.jumlah_hari, status: p.status, hari: hariQR(p)
  };
}
/** Nama peserta dianggap cocok bila sama, saling memuat, atau ada kata (≥3 huruf) yang sama. */
function namaCocok(a, b) {
  const A = kunciNama(a), B = kunciNama(b);
  if (!A || !B) return false;
  if (A === B || A.indexOf(B) >= 0 || B.indexOf(A) >= 0) return true;
  const wb = B.split(' ');
  return A.split(' ').filter(w => w.length >= 3).some(w => wb.indexOf(w) >= 0);
}
function aksiQrAbsen(d) {
  const p = pelDariQR(d);
  const hari = parseInt(d.hari_ke, 10);
  const slot = hariQR(p).find(h => h.hari_ke === hari);
  if (!slot) throw new Error('Pilih hari sesi 1 atau 2.');
  if (!slot.buka) throw new Error('Absensi Hari ' + hari + ' (' + slot.tanggal + ') belum dibuka.');
  const nama = String(d.nama_umkm || '').trim(), peserta = String(d.nama_peserta || '').trim();
  if (!nama) throw new Error('Isi nama UMKM / usaha.');
  if (!peserta) throw new Error('Isi nama peserta.');
  const kunci = 'q' + p.id_pelatihan + kunciNama(nama);
  const c = CacheService.getScriptCache();
  if (c.get('qrkunci_' + kunci)) throw new Error('Terlalu banyak percobaan. Coba lagi 10 menit lagi atau hubungi panitia.');
  const gagal = pesan => {
    const n = parseInt(c.get('qrgagal_' + kunci) || '0', 10) + 1;
    if (n >= 6) { c.put('qrkunci_' + kunci, '1', 600); c.remove('qrgagal_' + kunci); } else c.put('qrgagal_' + kunci, String(n), 600);
    throw new Error(pesan);
  };
  const terdaftar = {};
  DB.filter('Peserta_Pelatihan', x => x.id_pelatihan === p.id_pelatihan).forEach(x => terdaftar[x.id_umkm] = x);
  const k = kunciNama(nama);
  const kandidat = DB.filter('UMKM', x => kunciNama(x.nama_umkm) === k && terdaftar[x.id_umkm]);
  if (!kandidat.length) gagal('"' + nama + '" tidak terdaftar sebagai peserta pelatihan ini. Periksa ejaan nama usaha atau hubungi panitia.');
  // Cocok dengan nama perwakilan yang didaftarkan admin, atau nama pemilik UMKM
  const u = kandidat.find(x => namaCocok(peserta, terdaftar[x.id_umkm].nama_peserta || x.nama_pemilik) || namaCocok(peserta, x.nama_pemilik));
  if (!u) gagal('Nama peserta tidak sesuai dengan data pendaftaran ' + kandidat[0].nama_umkm + '. Tulis nama peserta yang didaftarkan.');
  c.remove('qrgagal_' + kunci);
  return denganKunci(() => {
    const ada = DB.find('Absensi', x => x.id_pelatihan === p.id_pelatihan && x.id_umkm === u.id_umkm && String(x.hari_ke) === String(hari));
    const info = { judul: p.judul, hari_ke: hari, tanggal: slot.tanggal, nama_umkm: u.nama_umkm, nama_peserta: namaPeserta(terdaftar[u.id_umkm], u) };
    if (ada) return Object.assign(info, { sudah: true, waktu: ada.waktu_absen, message: 'Anda sudah tercatat hadir Hari ' + hari + '.' });
    const w = now();
    DB.insert('Absensi', { id_pelatihan: p.id_pelatihan, id_umkm: u.id_umkm, hari_ke: hari, tanggal: slot.tanggal, waktu_absen: w, metode: 'qr' });
    catatLog({ r: 'peserta', id: u.id_umkm }, 'Absen Hari ' + hari + ' via scan QR — "' + p.judul + '"');
    return Object.assign(info, { sudah: false, waktu: w, message: 'Absensi Hari ' + hari + ' berhasil tercatat.' });
  });
}

// ==================== Laporan.gs ====================
/**
 * ============================================================
 *  RuangLatih — File 5/5 : Laporan.gs
 *  Dasbor Admin, laporan & grafik, unduh Excel/PDF mengikuti
 *  template, dan sertifikat otomatis (Google Slides → PDF)
 *  yang diproses bertahap agar tidak terputus batas 6 menit.
 * ============================================================
 */

const BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

function tglIndo(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? parseInt(m[3], 10) + ' ' + BULAN_ID[parseInt(m[2], 10) - 1] + ' ' + m[1] : String(s || '');
}
function tanggalPelatihanIndo(p) {
  if (p.jumlah_hari !== 2 || !p.tanggal_selesai || p.tanggal_selesai === p.tanggal_mulai) return tglIndo(p.tanggal_mulai);
  const a = p.tanggal_mulai.split('-'), b = p.tanggal_selesai.split('-');
  if (a[0] === b[0] && a[1] === b[1]) return parseInt(a[2], 10) + '–' + tglIndo(p.tanggal_selesai);
  return tglIndo(p.tanggal_mulai) + ' – ' + tglIndo(p.tanggal_selesai);
}

// Indeks semua pelatihan sekaligus (sekali baca tiap sheet)
function indeksSemua() {
  const out = {};
  const get = id => out[id] || (out[id] = { absen: {}, tes: {}, tugas: [], kumpul: {}, eval: {}, evalJ: [] });
  DB.rows('Absensi').forEach(a => { const x = get(a.id_pelatihan); (x.absen[a.id_umkm] = x.absen[a.id_umkm] || {})[a.hari_ke] = a.waktu_absen; });
  DB.rows('Hasil_Tes').forEach(t => { const x = get(t.id_pelatihan); (x.tes[t.id_umkm] = x.tes[t.id_umkm] || {})[t.jenis] = num(t.skor); });
  const tPel = {};
  DB.rows('Tugas').forEach(t => { get(t.id_pelatihan).tugas.push(t); tPel[t.id_tugas] = t.id_pelatihan; });
  DB.rows('Pengumpulan_Tugas').forEach(k => {
    const idp = tPel[k.id_tugas];
    if (!idp) return;
    const x = get(idp);
    (x.kumpul[k.id_umkm] = x.kumpul[k.id_umkm] || {})[k.id_tugas] = k;
  });
  DB.rows('Evaluasi_Jawaban').forEach(e => { const x = get(e.id_pelatihan); x.eval[e.id_umkm] = true; x.evalJ.push(pj(e.jawaban, {})); });
  return { get: get };
}
function rataBagian(evalJ, b) {
  const v = [];
  evalJ.forEach(j => Object.keys(j).forEach(k => { if (k[0] === b) { const n = parseInt(j[k], 10); if (n >= 1 && n <= 4) v.push(n); } }));
  return rata(v);
}

// ---------- DASBOR ADMIN ----------
/**
 * Dasbor admin per TAHUN (Year-to-Date untuk tahun berjalan, Jan–Des untuk tahun lalu).
 * d.tahun opsional; bawaan = tahun berjalan. Panel "live" hanya untuk tahun berjalan.
 */
function aksiDasborAdmin(d, s) {
  const I = indeksSemua();
  const hi = hariIni(), thIni = hi.slice(0, 4);
  const semuaPel = DB.rows('Pelatihan').map(parsePel);
  const daftarTahun = Array.from(new Set(semuaPel.map(p => String(p.tanggal_mulai).slice(0, 4)).filter(t => /^\d{4}$/.test(t)).concat([thIni]))).sort().reverse();
  const tahun = /^\d{4}$/.test(String(d.tahun || '')) ? String(d.tahun) : thIni;
  const ytd = tahun === thIni;
  const pels = semuaPel.filter(p => String(p.tanggal_mulai).slice(0, 4) === tahun);
  const idPel = {};
  pels.forEach(p => idPel[p.id_pelatihan] = p);

  const umkm = {};
  DB.rows('UMKM').forEach(u => umkm[u.id_umkm] = u);
  const reg = DB.rows('Peserta_Pelatihan').filter(r => idPel[r.id_pelatihan]);
  const bulanIni = hi.slice(0, 7);
  const perSektor = {};
  SEKTOR.forEach(x => perSektor[x] = 0);
  reg.forEach(r => { const u = umkm[r.id_umkm]; if (u && perSektor[u.sektor] !== undefined) perSektor[u.sektor]++; });
  const materi = DB.rows('Materi').filter(m => m.id_pelatihan ? idPel[m.id_pelatihan] : String(m.tgl).slice(0, 4) === tahun);
  const jmlPeserta = {};
  reg.forEach(r => (jmlPeserta[r.id_pelatihan] = jmlPeserta[r.id_pelatihan] || []).push(r.id_umkm));

  // Kehadiran kumulatif: hari yang sudah lewat/berjalan saja
  let hadirTotal = 0, hariTotal = 0, lulus = 0;
  const rekap = pels.map(p => {
    const ids = jmlPeserta[p.id_pelatihan] || [];
    const idx = I.get(p.id_pelatihan);
    const hadirPenuh = ids.filter(id => Object.keys(idx.absen[id] || {}).length >= p.jumlah_hari).length;
    const hariJalan = p.tanggal_hari.filter(t => t <= hi).length;
    ids.forEach(id => { hadirTotal += Math.min(hariJalan, Object.keys(idx.absen[id] || {}).length); hariTotal += hariJalan; if (statusPeserta(p, id, idx).lulus) lulus++; });
    return Object.assign(ringkasPel(p), { jumlah_peserta: ids.length, hadir_penuh: hadirPenuh });
  }).sort((a, b) => String(b.tanggal_mulai).localeCompare(String(a.tanggal_mulai)));

  // Pelatihan yang sedang berjalan (atau terdekat) — hanya untuk tahun berjalan
  let live = null;
  if (ytd) {
    const urut = { berlangsung: 0, 'akan datang': 1, selesai: 2 };
    const kandidat = semuaPel.slice().sort((a, b) => (urut[a.status] - urut[b.status]) || String(a.tanggal_mulai).localeCompare(String(b.tanggal_mulai)));
    if (kandidat.length && kandidat[0].status !== 'selesai') {
      const p = kandidat[0];
      const ids = DB.filter('Peserta_Pelatihan', r => r.id_pelatihan === p.id_pelatihan).map(r => r.id_umkm);
      const idx = I.get(p.id_pelatihan);
      const hariKe = p.tanggal_hari.indexOf(hi) + 1 || 1;
      const kumpul = ids.filter(id => idx.tugas.length && idx.tugas.every(t => (idx.kumpul[id] || {})[t.id_tugas])).length;
      live = {
        pelatihan: ringkasPel(p), jumlah_peserta: ids.length, hari_ke: hariKe,
        absen: { hadir: ids.filter(id => (idx.absen[id] || {})[hariKe]).length, buka: aktivitasBuka(p, 'absen_' + hariKe) },
        pre: { selesai: ids.filter(id => (idx.tes[id] || {}).pre !== undefined).length, rata: rata(ids.map(id => (idx.tes[id] || {}).pre)), buka: aktivitasBuka(p, 'pre') },
        post: { selesai: ids.filter(id => (idx.tes[id] || {}).post !== undefined).length, rata: rata(ids.map(id => (idx.tes[id] || {}).post)), buka: aktivitasBuka(p, 'post') },
        tugas: { kumpul: kumpul, jumlah: idx.tugas.length, buka: aktivitasBuka(p, 'tugas') },
        evaluasi: { terisi: Object.keys(idx.eval).length, buka: aktivitasBuka(p, 'evaluasi') }
      };
    }
  }

  // Rerata nilai & evaluasi tahun terpilih
  const semuaPre = [], semuaPost = [], evalAll = [];
  pels.forEach(p => {
    const idx = I.get(p.id_pelatihan);
    Object.keys(idx.tes).forEach(id => { if (idx.tes[id].pre !== undefined) semuaPre.push(idx.tes[id].pre); if (idx.tes[id].post !== undefined) semuaPost.push(idx.tes[id].post); });
    idx.evalJ.forEach(j => evalAll.push(j));
  });
  const A = rataBagian(evalAll, 'A'), B = rataBagian(evalAll, 'B'), C = rataBagian(evalAll, 'C');
  const csiPel = rata([A, C].filter(x => x !== null));
  const tugasPel = {};
  DB.rows('Tugas').forEach(t => { if (idPel[t.id_pelatihan]) tugasPel[t.id_tugas] = true; });
  let tugasMenunggu = 0, tugasMasuk = 0;
  DB.rows('Pengumpulan_Tugas').forEach(k => { if (!tugasPel[k.id_tugas]) return; tugasMasuk++; if (k.skor === '') tugasMenunggu++; });
  const log = DB.rows('Log_Aktivitas').slice(-5).reverse();

  return {
    tahun: tahun, daftar_tahun: daftarTahun, ytd: ytd,
    periode: { dari: tahun + '-01-01', sampai: ytd ? hi : tahun + '-12-31' },
    ringkas: {
      peserta: reg.length, umkm_unik: new Set(reg.map(r => r.id_umkm)).size, lulus: lulus,
      peserta_baru: ytd ? reg.filter(r => String(r.tgl_daftar).slice(0, 7) === bulanIni).length : 0, per_sektor: perSektor,
      umkm: Object.keys(umkm).length, pelatihan: pels.length,
      materi: materi.length, materi_umum: materi.filter(m => m.cakupan === 'umum').length,
      kehadiran: hariTotal ? bulat(hadirTotal / hariTotal * 100) : null, hadir_total: hadirTotal, hari_total: hariTotal,
      kehadiran_live: live && live.jumlah_peserta ? bulat(live.absen.hadir / live.jumlah_peserta * 100) : null,
      tugas_menunggu: tugasMenunggu, tugas_masuk: tugasMasuk
    },
    live: live,
    rekap: rekap,
    evaluasi: {
      pre: rata(semuaPre), post: rata(semuaPost), responden: evalAll.length,
      csi_pelatihan: csiPel !== null ? bulat(csiPel / 4 * 100) : null, skor_pelatihan: csiPel,
      csi_instruktur: B !== null ? bulat(B / 4 * 100) : null, skor_instruktur: B
    },
    log: (() => { const nm = petaNamaPengguna(); return log.map(r => ({ waktu: r.waktu, peran: r.peran, nama: nm[r.peran + '|' + r.id_pengguna] || r.id_pengguna, aksi: r.aksi })); })()
  };
}

// ---------- LAPORAN ----------
function susunRekap() {
  const I = indeksSemua();
  const umkm = {};
  DB.rows('UMKM').forEach(u => umkm[u.id_umkm] = u);
  const pel = {};
  DB.rows('Pelatihan').forEach(p => pel[p.id_pelatihan] = parsePel(p));
  const ins = {};
  DB.rows('Instruktur').forEach(i => ins[i.id_instruktur] = i.nama);
  return DB.rows('Peserta_Pelatihan').filter(r => pel[r.id_pelatihan]).map(r => {
    const p = pel[r.id_pelatihan], u = umkm[r.id_umkm] || {};
    const st = statusPeserta(p, r.id_umkm, I.get(p.id_pelatihan));
    return {
      id_pelatihan: p.id_pelatihan, pelatihan: p.judul, tema: p.tema || '', tgl_mulai: p.tanggal_mulai, bulan: String(p.tanggal_mulai).slice(0, 7), tanggal: rentangTanggal(p),
      instruktur: ins[p.id_instruktur] || '-', id_umkm: r.id_umkm, nama_umkm: u.nama_umkm || '-', nama_pemilik: namaPeserta(r, u),
      sektor: u.sektor || '', no_hp: r.hp_peserta || u.no_hp || '', hadir: st.hadir, jumlah_hari: st.jumlah_hari,
      pre: st.pre, post: st.post, kenaikan: st.kenaikan, skor_tugas: st.skor_tugas,
      tugas: st.tugas_kumpul + '/' + st.tugas_total, evaluasi: st.evaluasi, lulus: st.lulus, no_sertifikat: r.no_sertifikat
    };
  }).sort((a, b) => String(b.bulan).localeCompare(String(a.bulan)) || a.nama_umkm.localeCompare(b.nama_umkm));
}
function filterRekap(rows, f) {
  f = f || {};
  const q = String(f.nama || '').toLowerCase();
  return rows.filter(r => (!f.id_pelatihan || r.id_pelatihan === f.id_pelatihan) && (!f.sektor || r.sektor === f.sektor)
    && (!f.bulan || r.bulan === f.bulan) && (!q || (r.nama_umkm + ' ' + r.nama_pemilik).toLowerCase().indexOf(q) >= 0));
}
function aksiLaporanData(d, s) {
  const I = indeksSemua();
  const evaluasi = DB.rows('Pelatihan').map(parsePel).map(p => {
    const e = I.get(p.id_pelatihan).evalJ;
    return { id_pelatihan: p.id_pelatihan, judul: p.judul, bulan: String(p.tanggal_mulai).slice(0, 7), n: e.length, A: rataBagian(e, 'A'), B: rataBagian(e, 'B'), C: rataBagian(e, 'C') };
  });
  return { rekap: susunRekap(), evaluasi: evaluasi };
}

function aksiLaporanExport(d, s) {
  const format = d.format === 'pdf' ? 'pdf' : 'xlsx';
  const rows = filterRekap(susunRekap(), d.filter);
  if (!rows.length) throw new Error('Tidak ada data untuk filter ini.');
  const f = d.filter || {};
  const judulPel = f.id_pelatihan ? (DB.find('Pelatihan', x => x.id_pelatihan === f.id_pelatihan) || {}).judul : 'Semua pelatihan';
  const lembaga = setting('NAMA_LEMBAGA', 'Pusat Pendampingan UMKM');
  const judul = 'Rekap Pelatihan UMKM — ' + judulPel;
  const periode = f.bulan ? BULAN_ID[parseInt(f.bulan.slice(5), 10) - 1] + ' ' + f.bulan.slice(0, 4) : 'Semua periode';
  const header = ['No', 'Nama UMKM', 'Pemilik', 'Sektor', 'No. HP', 'Pelatihan', 'Tanggal', 'Kehadiran', 'Pre-test', 'Post-test', 'Kenaikan', 'Skor Tugas', 'Tugas', 'Evaluasi', 'Status', 'No. Sertifikat'];
  const data = rows.map((r, i) => [i + 1, r.nama_umkm, r.nama_pemilik, r.sektor, r.no_hp, r.pelatihan, r.tanggal,
    r.hadir + ' dari ' + r.jumlah_hari + ' hari', r.pre === null ? '-' : r.pre, r.post === null ? '-' : r.post,
    r.kenaikan === null ? '-' : r.kenaikan, r.skor_tugas === null ? '-' : r.skor_tugas, r.tugas,
    r.evaluasi ? 'Sudah' : 'Belum', r.lulus ? 'Lulus' : 'Belum lulus', r.no_sertifikat || '-']);

  const namaFile = 'Rekap RuangLatih ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HHmm');
  const exportsDir = folder(CONFIG.FOLDER_EXPORTS);
  const tplId = setting('TEMPLATE_LAPORAN_ID', '');
  let ss = null, sh = null, blob = null;
  const buat = () => {
    if (tplId) {
      const copy = DriveApp.getFileById(tplId).makeCopy(namaFile, exportsDir);
      ss = SpreadsheetApp.openById(copy.getId());
      sh = ss.getSheets()[0];
      const ganti = { '{{nama_lembaga}}': lembaga, '{{judul_laporan}}': judul, '{{periode}}': periode, '{{judul_pelatihan}}': judulPel, '{{sektor}}': f.sektor || 'Semua sektor', '{{tanggal_cetak}}': tglIndo(hariIni()), '{{jumlah_peserta}}': String(rows.length), '{{jumlah_lulus}}': String(rows.filter(r => r.lulus).length) };
      ss.getSheets().forEach(x => Object.keys(ganti).forEach(k => x.createTextFinder(k).replaceAllWith(ganti[k])));
      const pos = sh.createTextFinder('{{tabel}}').findNext();
      if (!pos) throw new Error('Template laporan tidak memiliki penanda {{tabel}}.');
      const r0 = pos.getRow(), c0 = pos.getColumn();
      pos.setValue('');
      const need = r0 + data.length - 1;
      if (need > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows());
      if (c0 + header.length - 1 > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), c0 + header.length - 1 - sh.getMaxColumns());
      sh.getRange(r0, c0, data.length, header.length).setValues(data);
    } else {
      ss = SpreadsheetApp.create(namaFile);
      DriveApp.getFileById(ss.getId()).moveTo(exportsDir);
      sh = ss.getSheets()[0].setName('Rekap');
      sh.getRange(1, 1).setValue(lembaga).setFontWeight('bold').setFontSize(13);
      sh.getRange(2, 1).setValue(judul).setFontSize(11);
      sh.getRange(3, 1).setValue('Periode: ' + periode + ' · Dicetak: ' + tglIndo(hariIni())).setFontColor('#665559');
      sh.getRange(5, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#9E3D52').setFontColor('#ffffff');
      sh.getRange(6, 1, data.length, header.length).setValues(data);
      sh.setFrozenRows(5);
      sh.autoResizeColumns(1, header.length);
    }
    SpreadsheetApp.flush();
  };
  try {
    if (format === 'pdf') {
      try { buat(); blob = pdfDariSheet(ss.getId(), sh.getSheetId(), false); } catch (e) { blob = null; }
      if (!blob) { // cadangan: susun PDF dari HTML bila ekspor Google Sheets gagal/ditolak
        const html = kopHtml(judul, lembaga, 'Periode: ' + periode + ' · Sektor: ' + (f.sektor || 'Semua sektor') + ' · Dicetak: ' + tglIndo(hariIni())) +
          tabelHtml(header, data.map(r => r.map(String)), 7.5);
        blob = pdfDariHtml(html);
      }
    } else {
      buat();
      blob = ambilEkspor('https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx');
      if (!blob) throw new Error('Gagal membuat file Excel. Coba beberapa saat lagi.');
    }
    blob.setName(namaFile + '.' + format);
    try { exportsDir.createFile(blob); } catch (e) { }
  } finally {
    if (ss) try { DriveApp.getFileById(ss.getId()).setTrashed(true); } catch (e) { }
  }
  catatLog(s, 'Mengunduh rekap ' + format.toUpperCase() + ' (' + rows.length + ' baris)');
  return { nama: namaFile + '.' + format, tipe: format === 'pdf' ? 'application/pdf' : blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) };
}

// ---------- ALAT BANTU EKSPOR PDF ----------
/** Unduh hasil ekspor Google (dengan coba ulang saat dibatasi 429/5xx). */
function ambilEkspor(url, harusPdf) {
  for (let i = 0; i < 3; i++) {
    const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    const code = res.getResponseCode();
    if (code === 200) {
      const b = res.getBlob();
      if (!harusPdf || /pdf/i.test(b.getContentType())) return b;
      return null;
    }
    if (code !== 429 && code < 500) return null;
    Utilities.sleep(1500 * (i + 1));
  }
  return null;
}
/** PDF dari satu sheet: A4, lebar pas halaman, tanpa garis bantu. */
function pdfDariSheet(ssId, gid, tegak) {
  SpreadsheetApp.flush();
  return ambilEkspor('https://docs.google.com/spreadsheets/d/' + ssId + '/export?format=pdf&size=A4&portrait=' + (tegak ? 'true' : 'false') +
    '&fitw=true&top_margin=0.5&bottom_margin=0.5&left_margin=0.5&right_margin=0.5&sheetnames=false&printtitle=false&pagenumbers=true&gridlines=false&fzr=false&gid=' + gid, true);
}
function pdfDariHtml(html) {
  return Utilities.newBlob('<html><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;color:#231B1E">' + html + '</body></html>', MimeType.HTML, 'dok.html').getAs(MimeType.PDF);
}
function escH(v) { return String(v === null || v === undefined ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function kopHtml(judul, sub, info) {
  return '<div style="text-align:center"><p style="font-size:15pt;font-weight:bold;color:#6E2D3B;margin:0">' + escH(judul) + '</p>' +
    '<p style="font-size:11pt;font-weight:bold;margin:4px 0 0">' + escH(sub) + '</p><p style="font-size:9.5pt;color:#665559;margin:4px 0 0">' + escH(info) + '</p></div>' +
    '<hr style="border:0;border-top:2px solid #9E3D52;margin:10px 0 12px">';
}
function tabelHtml(header, data, pt) {
  const th = 'style="background:#9E3D52;color:#ffffff;border:1px solid #9E3D52;padding:5px;font-size:' + pt + 'pt;text-align:center"';
  return '<table style="width:100%;border-collapse:collapse" cellpadding="4"><tr>' + header.map(h => '<th ' + th + '>' + escH(h) + '</th>').join('') + '</tr>' +
    data.map((r, i) => '<tr>' + r.map(c => '<td style="border:1px solid #D8B8C0;padding:4px;font-size:' + pt + 'pt;vertical-align:top;background:' + (i % 2 ? '#FDF6F7' : '#ffffff') + '">' + escH(c) + '</td>').join('') + '</tr>').join('') + '</table>';
}

// ---------- EKSPOR ABSENSI (PDF) ----------
const HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
function hariTglIndo(t) {
  const m = String(t || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(t || '');
  return HARI_ID[new Date(+m[1], +m[2] - 1, +m[3]).getDay()] + ', ' + tglIndo(t);
}
function aksiAbsensiExport(d, s) {
  const det = aksiPelatihanDetail({ id_pelatihan: d.id_pelatihan }, s);
  const p = det.pelatihan;
  const umkm = {};
  DB.rows('UMKM').forEach(u => umkm[u.id_umkm] = u);
  const hari = p.tanggal_hari || [p.tanggal_mulai];
  const judul = /^pelatihan\b/i.test(p.judul) ? p.judul : 'Pelatihan ' + p.judul;
  const lembaga = 'Pusat Pendampingan UMKM Cakung';
  const info = 'Tanggal pelaksanaan: ' + hari.map(hariTglIndo).join(' dan ') + '   ·   Instruktur: ' + (p.instruktur || '-');
  const hi = hariIni();
  const ket = (w, t) => w ? 'Hadir (' + String(w).slice(11, 16).replace(':', '.') + ')' : (t < hi ? 'Tidak hadir' : 'Belum absen');
  const header = ['No', 'Nama UMKM / Usaha', 'Peserta', 'Sektor', 'Nomor HP Peserta', 'Alamat'].concat(hari.length > 1 ? hari.map((t, i) => 'Konfirmasi Kehadiran Hari ' + (i + 1) + ' (' + tglIndo(t) + ')') : ['Konfirmasi Kehadiran']);
  const data = det.peserta.map((x, i) => [i + 1, x.nama_umkm, x.nama_pemilik, x.sektor, x.no_hp, (umkm[x.id_umkm] || {}).alamat || '-'].concat(hari.map((t, j) => ket(x.absen[j + 1], t))));
  const rekap = hari.map((t, j) => 'Hari ' + (j + 1) + ': ' + det.peserta.filter(x => x.absen[j + 1]).length + ' dari ' + det.peserta.length + ' hadir').join('   ·   ');
  const namaFile = 'Absensi - ' + p.judul.replace(/[\\/:*?"<>|]/g, '') + ' - ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');

  // Utama: Google Sheets → PDF (A4 mendatar), kop di tengah
  let blob = null;
  const exportsDir = folder(CONFIG.FOLDER_EXPORTS);
  let ss = null;
  try {
    ss = SpreadsheetApp.create(namaFile);
    DriveApp.getFileById(ss.getId()).moveTo(exportsDir);
    const sh = ss.getSheets()[0].setName('Absensi');
    const nk = header.length, dua = hari.length > 1;
    sh.setHiddenGridlines(true);
    const kop = [[judul, 14, true, '#6E2D3B'], [lembaga, 11, true, '#231B1E'], [info, 10, false, '#665559']];
    kop.forEach((k, i) => sh.getRange(i + 1, 1, 1, nk).merge().setValue(k[0]).setHorizontalAlignment('center').setFontSize(k[1]).setFontWeight(k[2] ? 'bold' : 'normal').setFontColor(k[3]).setWrap(true));
    sh.getRange(4, 1, 1, nk).merge().setBorder(null, null, true, null, null, null, '#9E3D52', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    let r0 = 6;
    if (dua) {
      // Header dua tingkat: "Konfirmasi Kehadiran" membawahi Hari 1 & Hari 2
      ['No', 'Nama UMKM / Usaha', 'Peserta', 'Sektor', 'Nomor HP Peserta', 'Alamat'].forEach((h, c) => sh.getRange(r0, c + 1, 2, 1).merge().setValue(h));
      sh.getRange(r0, 7, 1, hari.length).merge().setValue('Konfirmasi Kehadiran');
      sh.getRange(r0 + 1, 7, 1, hari.length).setValues([hari.map((t, i) => 'Hari ' + (i + 1) + '\n' + tglIndo(t))]);
      sh.getRange(r0, 1, 2, nk).setBackground('#9E3D52').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
      r0 += 2;
    } else {
      sh.getRange(r0, 1, 1, nk).setValues([header]).setBackground('#9E3D52').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
      r0 += 1;
    }
    if (data.length) {
      const rg = sh.getRange(r0, 1, data.length, nk);
      rg.setNumberFormat('@').setValues(data.map(r => r.map(String))).setVerticalAlignment('top').setWrap(true).setFontSize(10);
      sh.getRange(r0, 1, data.length, 1).setHorizontalAlignment('center');
      sh.getRange(r0, 7, data.length, hari.length).setHorizontalAlignment('center');
      for (let i = 0; i < data.length; i += 2) sh.getRange(r0 + i, 1, 1, nk).setBackground('#FDF6F7');
      data.forEach((r, i) => hari.forEach((t, j) => { const c = sh.getRange(r0 + i, 7 + j); if (/^Hadir/.test(r[6 + j])) c.setFontColor('#2E7D5E').setFontWeight('bold'); else if (/^Tidak/.test(r[6 + j])) c.setFontColor('#B83232'); }));
    } else sh.getRange(r0, 1, 1, nk).merge().setValue('Belum ada peserta terdaftar.').setHorizontalAlignment('center');
    const akhir = r0 + Math.max(1, data.length) - 1;
    sh.getRange(dua ? 6 : 6, 1, akhir - 5, nk).setBorder(true, true, true, true, true, true, '#D8B8C0', SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(akhir + 2, 1, 1, nk).merge().setValue('Rekap kehadiran — ' + rekap).setFontWeight('bold').setFontSize(10);
    sh.getRange(akhir + 3, 1, 1, nk).merge().setValue('Dicetak dari ' + (setting('NAMA_APLIKASI', '') || 'RuangLatih') + ' pada ' + hariTglIndo(hi)).setFontSize(9).setFontColor('#665559');
    const lebar = [36, 190, 160, 90, 125, 220].concat(hari.map(() => dua ? 115 : 170));
    lebar.forEach((w, i) => sh.setColumnWidth(i + 1, w));
    blob = pdfDariSheet(ss.getId(), sh.getSheetId(), false);
  } catch (e) { blob = null; }
  finally { if (ss) try { DriveApp.getFileById(ss.getId()).setTrashed(true); } catch (e) { } }

  // Cadangan: HTML → PDF
  if (!blob) blob = pdfDariHtml(kopHtml(judul, lembaga, info) + tabelHtml(header, data.map(r => r.map(String)), 9) + '<p style="font-size:9.5pt;font-weight:bold;margin-top:10px">Rekap kehadiran — ' + escH(rekap) + '</p>');
  catatLog(s, 'Mengunduh absensi PDF "' + p.judul + '"');
  return { nama: namaFile + '.pdf', tipe: 'application/pdf', data: Utilities.base64Encode(blob.getBytes()) };
}

// ---------- SERTIFIKAT ----------
function idTemplate(p) { return p.id_template_sertifikat || setting('TEMPLATE_SERTIFIKAT_ID', ''); }
function teksSlide(pres) {
  const out = [];
  pres.getSlides().forEach(sl => sl.getPageElements().forEach(el => {
    try {
      const t = el.getPageElementType();
      if (t === SlidesApp.PageElementType.SHAPE) out.push(el.asShape().getText().asString());
      if (t === SlidesApp.PageElementType.TABLE) {
        const tb = el.asTable();
        for (let r = 0; r < tb.getNumRows(); r++) for (let c = 0; c < tb.getNumColumns(); c++) out.push(tb.getCell(r, c).getText().asString());
      }
    } catch (e) { }
  }));
  return out.join('\n');
}
const PENANDA = ['{{nama_umkm}}', '{{nama_pemilik}}', '{{nama_peserta}}', '{{judul_pelatihan}}', '{{tanggal_pelatihan}}', '{{no_sertifikat}}'];

function aksiSertStatus(d, s) {
  const p = ambilPel(d.id_pelatihan);
  const idx = indeksPelatihan(p.id_pelatihan);
  const umkm = {};
  DB.rows('UMKM').forEach(u => umkm[u.id_umkm] = u);
  const tpl = idTemplate(p);
  let template = null;
  if (tpl) {
    try { const f = DriveApp.getFileById(tpl); template = { id: tpl, nama: f.getName(), url: 'https://docs.google.com/presentation/d/' + tpl + '/edit', sumber: p.id_template_sertifikat ? 'khusus' : 'bawaan' }; }
    catch (e) { template = { id: tpl, nama: '(tidak dapat dibuka)', url: '', sumber: p.id_template_sertifikat ? 'khusus' : 'bawaan', rusak: true }; }
  }
  const reg = DB.filter('Peserta_Pelatihan', x => x.id_pelatihan === p.id_pelatihan);
  const peserta = reg.map(r => {
    const st = statusPeserta(p, r.id_umkm, idx);
    return { id_umkm: r.id_umkm, nama_umkm: (umkm[r.id_umkm] || {}).nama_umkm || '-', nama_pemilik: namaPeserta(r, umkm[r.id_umkm]), lulus: st.lulus, kurang: st.kurang, no_sertifikat: r.no_sertifikat, terbit: !!r.id_file_sertifikat };
  }).sort((a, b) => (b.lulus - a.lulus) || a.nama_umkm.localeCompare(b.nama_umkm));
  sinkronStatusLulus(p.id_pelatihan, peserta);
  return {
    pelatihan: ringkasPel(p), template: template,
    template_bawaan: setting('TEMPLATE_SERTIFIKAT_ID', ''),
    ringkas: { total: peserta.length, lulus: peserta.filter(x => x.lulus).length, terbit: peserta.filter(x => x.terbit).length },
    peserta: peserta
  };
}
function sinkronStatusLulus(idPel, peserta) {
  const beda = peserta.filter(x => { const r = terdaftar(idPel, x.id_umkm); return r && r.status_lulus !== (x.lulus ? 'lulus' : 'belum'); });
  if (!beda.length) return;
  denganKunci(() => beda.forEach(x => { const r = terdaftar(idPel, x.id_umkm); if (r) DB.update('Peserta_Pelatihan', r, { status_lulus: x.lulus ? 'lulus' : 'belum' }); }));
}

function aksiSertTemplate(d, s) {
  let id = '';
  if (d.file && d.file.data) {
    const f = d.file;
    if (!/\.pptx$/i.test(f.nama || '')) throw new Error('Unggah file PowerPoint (.pptx), atau tempel link Google Slides.');
    const bytes = Utilities.base64Decode(f.data);
    if (bytes.length > MAX_TEMPLATE) throw new Error('Ukuran template maksimal 20 MB.');
    const tplDir = folder(CONFIG.FOLDER_TEMPLATE);
    const pptx = tplDir.createFile(Utilities.newBlob(bytes, 'application/vnd.openxmlformats-officedocument.presentationml.presentation', f.nama));
    const res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + pptx.getId() + '/copy', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify({ name: 'Template Sertifikat - ' + String(f.nama).replace(/\.pptx$/i, ''), mimeType: 'application/vnd.google-apps.presentation', parents: [CONFIG.FOLDER_TEMPLATE] })
    });
    if (res.getResponseCode() !== 200) throw new Error('Gagal mengubah PPTX menjadi Google Slides (' + res.getResponseCode() + ').');
    id = JSON.parse(res.getContentText()).id;
    pptx.setTrashed(true);
  } else if (d.link) {
    id = idDariLink(d.link);
    if (!id) throw new Error('Link Google Slides tidak valid.');
  } else if (d.hapus_khusus) {
    return denganKunci(() => {
      const r = DB.find('Pelatihan', x => x.id_pelatihan === d.id_pelatihan);
      DB.update('Pelatihan', r, { id_template_sertifikat: '' });
      return { message: 'Pelatihan ini kembali memakai template bawaan.' };
    });
  } else throw new Error('Pilih file PPTX atau tempel link Google Slides.');

  const pres = SlidesApp.openById(id);
  if (pres.getSlides().length !== 1) throw new Error('Template sertifikat harus tepat 1 halaman (saat ini ' + pres.getSlides().length + ').');
  const teks = teksSlide(pres);
  const ada = PENANDA.filter(k => teks.indexOf(k) >= 0);
  if (ada.indexOf('{{nama_umkm}}') < 0 && ada.indexOf('{{nama_pemilik}}') < 0)
    throw new Error('Template belum memuat penanda {{nama_umkm}} atau {{nama_pemilik}}.');

  return denganKunci(() => {
    if (d.id_pelatihan) {
      const r = DB.find('Pelatihan', x => x.id_pelatihan === d.id_pelatihan);
      if (!r) throw new Error('Pelatihan tidak ditemukan.');
      DB.update('Pelatihan', r, { id_template_sertifikat: id });
    } else setSetting('TEMPLATE_SERTIFIKAT_ID', id);
    catatLog(s, 'Mengatur template sertifikat ' + (d.id_pelatihan ? 'khusus ' + d.id_pelatihan : 'bawaan'));
    return { id: id, penanda: ada, message: 'Template tersimpan. Penanda ditemukan: ' + ada.join(', ') };
  });
}

/** {{nama_pemilik}} & {{nama_peserta}} = nama orang yang mengikuti pelatihan (perwakilan/karyawan bila diisi). */
function dataSertifikat(p, u, noSert, reg) {
  const nm = namaPeserta(reg, u);
  return {
    nama_umkm: u.nama_umkm || '', nama_pemilik: nm, nama_peserta: nm, judul_pelatihan: p.judul,
    tanggal_pelatihan: tanggalPelatihanIndo(p), no_sertifikat: noSert || ''
  };
}
function buatPdfSertifikat(tplId, data, namaFile) {
  const copy = DriveApp.getFileById(tplId).makeCopy('tmp-' + namaFile, folder(CONFIG.FOLDER_EXPORTS));
  try {
    const pres = SlidesApp.openById(copy.getId());
    Object.keys(data).forEach(k => pres.replaceAllText('{{' + k + '}}', String(data[k])));
    pres.saveAndClose();
    return copy.getAs('application/pdf').setName(namaFile + '.pdf');
  } finally {
    copy.setTrashed(true);
  }
}
function nomorSertifikat(p, urut) {
  const fmt = setting('FORMAT_NO_SERTIFIKAT', '{urut}/RL-PPU/{kode}/{bulan}/{tahun}');
  const t = String(p.tanggal_mulai).split('-');
  return fmt.replace('{urut}', ('00' + urut).slice(-3)).replace('{kode}', p.id_pelatihan.replace(/^PL-/, ''))
    .replace('{bulan}', ROMAWI[(parseInt(t[1], 10) || 1) - 1]).replace('{tahun}', t[0] || '');
}

function aksiSertPreview(d, s) {
  const p = ambilPel(d.id_pelatihan);
  const tpl = idTemplate(p);
  if (!tpl) throw new Error('Template sertifikat belum diatur.');
  const idx = indeksPelatihan(p.id_pelatihan);
  const reg = DB.filter('Peserta_Pelatihan', x => x.id_pelatihan === p.id_pelatihan);
  const pilih = reg.find(r => statusPeserta(p, r.id_umkm, idx).lulus) || reg[0];
  const u = pilih ? (DB.find('UMKM', x => x.id_umkm === pilih.id_umkm) || {}) : { nama_umkm: 'Contoh UMKM Sejahtera', nama_pemilik: 'Nama Pemilik Contoh' };
  const blob = buatPdfSertifikat(tpl, dataSertifikat(p, u, (pilih && pilih.no_sertifikat) || nomorSertifikat(p, 1), pilih), 'Pratinjau Sertifikat');
  return { nama: 'Pratinjau Sertifikat.pdf', tipe: 'application/pdf', data: Utilities.base64Encode(blob.getBytes()), contoh: u.nama_umkm };
}

/**
 * Terbitkan bertahap: tiap panggilan memproses sebanyak mungkin
 * dalam ±4 menit, lalu mengembalikan sisa. Frontend memanggil ulang
 * otomatis sampai sisa = 0. Aman dilanjutkan bila sempat terhenti.
 */
function aksiSertTerbitkan(d, s) {
  const mulai = Date.now();
  const p = ambilPel(d.id_pelatihan);
  const tpl = idTemplate(p);
  if (!tpl) throw new Error('Template sertifikat belum diatur.');
  const idx = indeksPelatihan(p.id_pelatihan);
  const umkm = {};
  DB.rows('UMKM').forEach(u => umkm[u.id_umkm] = u);

  if (d.ulang) {
    denganKunci(() => DB.filter('Peserta_Pelatihan', x => x.id_pelatihan === p.id_pelatihan && x.id_file_sertifikat).forEach(r => {
      try { DriveApp.getFileById(r.id_file_sertifikat).setTrashed(true); } catch (e) { }
      DB.update('Peserta_Pelatihan', r, { id_file_sertifikat: '' });
    }));
  }
  const reg = DB.filter('Peserta_Pelatihan', x => x.id_pelatihan === p.id_pelatihan);
  const lulus = reg.filter(r => statusPeserta(p, r.id_umkm, idx).lulus)
    .sort((a, b) => String((umkm[a.id_umkm] || {}).nama_umkm).localeCompare(String((umkm[b.id_umkm] || {}).nama_umkm)));
  if (!lulus.length) throw new Error('Belum ada peserta yang memenuhi syarat lulus.');
  const dir = subFolder(CONFIG.FOLDER_SERTIFIKAT, p.id_pelatihan);
  let maxUrut = 0;
  reg.forEach(r => { const m = String(r.no_sertifikat || '').match(/^(\d+)/); if (m) maxUrut = Math.max(maxUrut, parseInt(m[1], 10)); });

  let dibuat = 0;
  const antre = lulus.filter(r => !r.id_file_sertifikat);
  for (let i = 0; i < antre.length; i++) {
    if (Date.now() - mulai > 240000) break;
    const r = antre[i], u = umkm[r.id_umkm] || {};
    const no = r.no_sertifikat || nomorSertifikat(p, ++maxUrut);
    const blob = buatPdfSertifikat(tpl, dataSertifikat(p, u, no, r), 'Sertifikat - ' + (u.nama_umkm || r.id_umkm) + ' - ' + p.judul);
    const f = dir.createFile(blob);
    denganKunci(() => {
      const row = terdaftar(p.id_pelatihan, r.id_umkm);
      if (row) DB.update('Peserta_Pelatihan', row, { no_sertifikat: no, id_file_sertifikat: f.getId(), status_lulus: 'lulus' });
    });
    dibuat++;
  }
  const sisa = antre.length - dibuat;
  if (!sisa) catatLog(s, 'Menerbitkan sertifikat "' + p.judul + '" (' + lulus.length + ' peserta)');
  return { dibuat: dibuat, sisa: sisa, total: lulus.length, message: sisa ? dibuat + ' sertifikat dibuat, melanjutkan ' + sisa + ' lagi...' : 'Semua ' + lulus.length + ' sertifikat sudah terbit.' };
}

// ==================== Cermin.gs ====================
/**
 * =============================================================
 * RuangLatih — Cermin.gs  (Migrasi Firebase · Fase 3)
 * Penerjemah dua arah: TABEL gaya Spreadsheet  ⇄  KOLEKSI Firestore.
 *
 * Seluruh logika aplikasi (Pelatihan.gs, Admin.gs, Peserta.gs, Laporan.gs)
 * tetap bekerja dengan tabel seperti biasa (DB.rows/find/insert/update/remove).
 * Dalam mode Firebase, DB diganti "DB cermin" yang:
 *   • membangun baris tabel dari dokumen Firestore (keBaris), dan
 *   • mencatat setiap perubahan lalu menerjemahkannya menjadi tulisan Firestore (keTulis).
 * File yang SAMA dipakai di GAS dan di browser (js/mesin.js) → hasil identik.
 * Tidak memakai layanan GAS apa pun.
 * =============================================================
 */
var CERMIN = {
  HAPUS: { __hapus: true },

  s(v) { return v === undefined || v === null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)); },
  j(v, def) { if (v && typeof v === 'object') return v; try { return v ? JSON.parse(v) : def; } catch (e) { return def; } },
  n(v) { if (v === '' || v === null || v === undefined) return null; const x = parseFloat(v); return isNaN(x) ? null : x; },
  kn(n) { return String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); },
  gambar(id) { return id ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1200' : ''; },
  /** Baris tabel: semua kolom SKEMA sebagai teks (seperti getDisplayValues). */
  baris(t, o) {
    const r = {};
    (SKEMA[t] || []).forEach(k => r[k] = CERMIN.s(o[k]));
    return r;
  },
  peta(arr, k) { const m = {}; (arr || []).forEach(x => m[x[k] || x._id] = x); return m; },

  /** Koleksi yang dibutuhkan untuk membangun tiap tabel. */
  SUMBER: {
    UMKM: ['umkm', 'akun_umkm'], Instruktur: ['instruktur', 'akun_instruktur', 'pelatihan'], Admin: ['admin'],
    Pelatihan: ['pelatihan'], Peserta_Pelatihan: ['pendaftaran'], Absensi: ['pendaftaran', 'pelatihan'],
    Hasil_Tes: ['pendaftaran', 'hasil_tes'], Materi: ['materi'], Bank_Soal: ['soal', 'kunci_soal'], Tugas: ['tugas'],
    Pengumpulan_Tugas: ['pengumpulan'], Evaluasi_Pertanyaan: ['evaluasi_form'], Evaluasi_Jawaban: ['evaluasi_jawaban', 'pendaftaran'],
    Pengaturan: ['pengaturan'], Log_Aktivitas: ['log'], Draft_Pelatihan: ['draft_pelatihan']
  },

  // ===========================================================
  // FIRESTORE → TABEL
  // S.kol(nama) mengembalikan array dokumen { _id, ...isi }
  // ===========================================================
  keBaris(t, S) {
    const B = o => CERMIN.baris(t, o), s = CERMIN.s;
    switch (t) {
      case 'UMKM': {
        const akun = CERMIN.peta(S.kol('akun_umkm'), '_id'), ada = {};
        const rows = S.kol('umkm').map(u => { ada[u._id] = 1; const a = akun[u._id] || {}; return B(Object.assign({}, u, { id_umkm: u.id_umkm || u._id, pin: a.pin || '', wajib_ganti_pin: a.wajib_ganti_pin ? 'ya' : 'tidak' })); });
        // peran tanpa akses koleksi umkm (instruktur): nama/sektor dari salinan di dokumen pendaftaran
        S.kol('pendaftaran').forEach(r => { if (r.id_umkm && !ada[r.id_umkm]) { ada[r.id_umkm] = 1; rows.push(B({ id_umkm: r.id_umkm, nama_umkm: r.nama_umkm, nama_pemilik: r.nama_pemilik, sektor: r.sektor, no_hp: r.no_hp, status_akun: 'aktif', wajib_ganti_pin: 'tidak' })); } });
        return rows;
      }
      case 'Instruktur': {
        const akun = CERMIN.peta(S.kol('akun_instruktur'), '_id'), ada = {};
        const rows = S.kol('instruktur').map(i => { ada[i._id] = 1; return B(Object.assign({}, i, { id_instruktur: i.id_instruktur || i._id, kode_akses: (akun[i._id] || {}).kode_akses || '', tema_diajar: '' })); });
        // peran tanpa akses koleksi instruktur: nama diambil dari salinan di dokumen pelatihan
        S.kol('pelatihan').forEach(p => { if (p.id_instruktur && !ada[p.id_instruktur]) { ada[p.id_instruktur] = 1; rows.push(B({ id_instruktur: p.id_instruktur, nama: p.nama_instruktur || '-', status: 'aktif' })); } });
        return rows;
      }
      case 'Admin': return S.kol('admin').map(a => B(Object.assign({ username: a._id }, a)));
      case 'Pelatihan': return S.kol('pelatihan').map(p => B(Object.assign({}, p, { id_pelatihan: p.id_pelatihan || p._id, status_aktivitas: p.aktivitas || {}, syarat_lulus: p.syarat || {} })));
      case 'Peserta_Pelatihan': return S.kol('pendaftaran').map(r => B(r));
      case 'Absensi': {
        const pel = CERMIN.peta(S.kol('pelatihan'), '_id'), out = [];
        S.kol('pendaftaran').forEach(r => {
          const tg = (pel[r.id_pelatihan] || {}).tanggal_hari || [], m = r.metode_absen || {};
          Object.keys(r.absen || {}).forEach(h => { if (r.absen[h]) out.push(B({ id_pelatihan: r.id_pelatihan, id_umkm: r.id_umkm, hari_ke: h, tanggal: tg[h - 1] || '', waktu_absen: r.absen[h], metode: m[h] || 'aplikasi' })); });
        });
        return out;
      }
      case 'Hasil_Tes': {
        const det = CERMIN.peta(S.kol('hasil_tes'), '_id'), out = [];
        S.kol('pendaftaran').forEach(r => ['pre', 'post'].forEach(j => {
          const x = r[j];
          if (!x || x.skor === null || x.skor === undefined) return;
          const d = det[r.id_pelatihan + '_' + r.id_umkm + '_' + j] || {};
          out.push(B({ id_pelatihan: r.id_pelatihan, id_umkm: r.id_umkm, jenis: j, jawaban: d.jawaban || {}, jumlah_benar: x.benar, skor: x.skor, waktu_selesai: x.waktu }));
        }));
        return out;
      }
      case 'Materi': return S.kol('materi').map(m => B(Object.assign({}, m, { id_materi: m.id_materi || m._id, ukuran_file: m.ukuran })));
      case 'Bank_Soal': {
        const kunci = CERMIN.peta(S.kol('kunci_soal'), '_id');
        return S.kol('soal').map(q => B(Object.assign({}, q, { id_soal: q.id_soal || q._id, kunci: ((kunci[q.id_pelatihan] || {}).kunci || {})[q.id_soal || q._id] || '' })))
          .sort((a, b) => (parseFloat(a.urutan) || 0) - (parseFloat(b.urutan) || 0));
      }
      case 'Tugas': return S.kol('tugas').map(x => B(Object.assign({}, x, { id_tugas: x.id_tugas || x._id })));
      case 'Pengumpulan_Tugas': return S.kol('pengumpulan').map(k => B(Object.assign({}, k, { catatan_instruktur: k.catatan })));
      case 'Evaluasi_Pertanyaan': {
        const out = [];
        S.kol('evaluasi_form').forEach(f => (f.pertanyaan || []).forEach(q => out.push(B(Object.assign({ id_pelatihan: f.id_pelatihan || f._id }, q)))));
        return out;
      }
      case 'Evaluasi_Jawaban': {
        const ada = {}, out = S.kol('evaluasi_jawaban').map(e => { ada[e._id] = 1; return B(e); });
        // peran tanpa akses jawaban: cukup tanda "sudah mengisi" dari pendaftaran
        S.kol('pendaftaran').forEach(r => { const k = r.id_pelatihan + '_' + r.id_umkm; if (r.evaluasi && !ada[k]) out.push(B({ id_pelatihan: r.id_pelatihan, id_umkm: r.id_umkm, jawaban: {}, waktu_isi: r.evaluasi })); });
        return out;
      }
      case 'Pengaturan': {
        const u = S.kol('pengaturan').find(x => x._id === 'umum') || {};
        return Object.keys(u).filter(k => k !== '_id').map(k => B({ kunci: k, nilai: u[k], keterangan: '' }));
      }
      case 'Log_Aktivitas': return S.kol('log').map(l => B(l)).sort((a, b) => a.waktu.localeCompare(b.waktu));
      case 'Draft_Pelatihan': return S.kol('draft_pelatihan').map(d => B(Object.assign({}, d, { id_draft: d.id_draft || d._id })));
    }
    return [];
  },

  // ===========================================================
  // PERUBAHAN TABEL → TULISAN FIRESTORE
  // ops: [{ jenis: 'insert'|'update'|'remove', t, row, patch }]
  // hasil: [{ col, id, set: {...} } | { col, id, ubah: [[jalur[], nilai|HAPUS]] } | { col, id, hapus: true }]
  // saatIni(t) → baris tabel terkini (setelah perubahan)
  // ===========================================================
  keTulis(ops, S, saatIni) {
    const W = [], n = CERMIN.n, j = CERMIN.j, s = CERMIN.s, HAPUS = CERMIN.HAPUS;
    const pel = () => CERMIN.peta(S.kol('pelatihan'), '_id');
    const set = (col, id, data) => W.push({ col: col, id: String(id), set: data });
    const ubah = (col, id, pasangan) => { if (pasangan.length) W.push({ col: col, id: String(id), ubah: pasangan }); };
    const hapus = (col, id) => W.push({ col: col, id: String(id), hapus: true });
    const evalForm = {};
    const PROFIL_UMKM = ['nama_umkm', 'nama_pemilik', 'gender', 'sektor', 'spesialisasi', 'no_hp', 'alamat', 'status_akun', 'tgl_dibuat'];
    const PROFIL_INS = ['nama', 'institusi', 'no_hp', 'status'];

    const docPelatihan = r => {
      const jh = parseInt(r.jumlah_hari, 10) === 2 ? 2 : 1;
      const ins = (saatIni('Instruktur') || []).find(i => i.id_instruktur === r.id_instruktur);
      return {
        id_pelatihan: r.id_pelatihan, judul: r.judul, tema: r.tema, cakupan: r.cakupan, sektor: r.sektor, id_instruktur: r.id_instruktur,
        nama_instruktur: ins ? ins.nama : ((pel()[r.id_pelatihan] || {}).nama_instruktur || ''),
        jumlah_hari: jh, tanggal_mulai: r.tanggal_mulai, tanggal_selesai: r.tanggal_selesai,
        tanggal_hari: jh === 2 ? [r.tanggal_mulai, r.tanggal_selesai] : [r.tanggal_mulai], tahun: String(r.tanggal_mulai).slice(0, 4),
        jam: r.jam, format: r.format, lokasi_atau_link: r.lokasi_atau_link, kuota: parseInt(r.kuota, 10) || 0, status: r.status,
        id_flyer: r.id_flyer, flyer_url: CERMIN.gambar(r.id_flyer), aktivitas: j(r.status_aktivitas, {}), syarat: j(r.syarat_lulus, {}),
        id_template_sertifikat: r.id_template_sertifikat, tgl_dibuat: r.tgl_dibuat, link_dokumentasi: r.link_dokumentasi || ''
      };
    };
    const regPel = idPel => S.kol('pendaftaran').filter(x => x.id_pelatihan === idPel);
    const regUmkm = idU => S.kol('pendaftaran').filter(x => x.id_umkm === idU);
    const idTugasPel = idTugas => { const t = (saatIni('Tugas') || []).find(x => x.id_tugas === idTugas); return t ? t.id_pelatihan : ''; };

    ops.forEach(op => {
      const r = op.row, P = op.patch || {}, kunci = Object.keys(P);
      switch (op.t) {
        case 'UMKM': {
          if (op.jenis === 'remove') { hapus('umkm', r.id_umkm); hapus('akun_umkm', r.id_umkm); break; }
          const prof = {};
          PROFIL_UMKM.forEach(k => prof[k] = r[k] || '');
          if (op.jenis === 'insert') {
            set('umkm', r.id_umkm, Object.assign({ id_umkm: r.id_umkm, kunci_nama: CERMIN.kn(r.nama_umkm) }, prof, { status_akun: r.status_akun || 'aktif' }));
            set('akun_umkm', r.id_umkm, { pin: r.pin, wajib_ganti_pin: r.wajib_ganti_pin === 'ya' });
            break;
          }
          const pu = kunci.filter(k => PROFIL_UMKM.indexOf(k) >= 0).map(k => [[k], r[k]]);
          if (kunci.indexOf('nama_umkm') >= 0) pu.push([['kunci_nama'], CERMIN.kn(r.nama_umkm)]);
          ubah('umkm', r.id_umkm, pu);
          const pa = [];
          if (kunci.indexOf('pin') >= 0) pa.push([['pin'], r.pin]);
          if (kunci.indexOf('wajib_ganti_pin') >= 0) pa.push([['wajib_ganti_pin'], r.wajib_ganti_pin === 'ya']);
          ubah('akun_umkm', r.id_umkm, pa);
          const salin = ['nama_umkm', 'nama_pemilik', 'sektor', 'no_hp'].filter(k => kunci.indexOf(k) >= 0);
          if (salin.length) regUmkm(r.id_umkm).forEach(x => ubah('pendaftaran', x._id, salin.map(k => [[k], r[k]])));
          break;
        }
        case 'Instruktur': {
          if (op.jenis === 'remove') { hapus('instruktur', r.id_instruktur); hapus('akun_instruktur', r.id_instruktur); break; }
          if (op.jenis === 'insert') {
            const d = { id_instruktur: r.id_instruktur, kunci_nama: CERMIN.kn(r.nama) };
            PROFIL_INS.forEach(k => d[k] = r[k] || '');
            set('instruktur', r.id_instruktur, d);
            set('akun_instruktur', r.id_instruktur, { kode_akses: r.kode_akses });
            break;
          }
          const pi = kunci.filter(k => PROFIL_INS.indexOf(k) >= 0).map(k => [[k], r[k]]);
          if (kunci.indexOf('nama') >= 0) pi.push([['kunci_nama'], CERMIN.kn(r.nama)]);
          ubah('instruktur', r.id_instruktur, pi);
          if (kunci.indexOf('kode_akses') >= 0) ubah('akun_instruktur', r.id_instruktur, [[['kode_akses'], r.kode_akses]]);
          if (kunci.indexOf('nama') >= 0) S.kol('pelatihan').filter(p => p.id_instruktur === r.id_instruktur).forEach(p => ubah('pelatihan', p._id, [[['nama_instruktur'], r.nama]]));
          break;
        }
        case 'Admin':
          if (op.jenis === 'remove') hapus('admin', r.username);
          else set('admin', r.username, { username: r.username, nama: r.nama, password_hash: r.password_hash });
          break;
        case 'Pelatihan': {
          if (op.jenis === 'remove') { hapus('pelatihan', r.id_pelatihan); break; }
          set('pelatihan', r.id_pelatihan, docPelatihan(r));
          if (op.jenis === 'update' && (kunci.indexOf('id_instruktur') >= 0 || kunci.indexOf('tanggal_mulai') >= 0))
            regPel(r.id_pelatihan).forEach(x => ubah('pendaftaran', x._id, [[['id_instruktur'], r.id_instruktur], [['tahun'], String(r.tanggal_mulai).slice(0, 4)]]));
          break;
        }
        case 'Peserta_Pelatihan': {
          const id = r.id_pelatihan + '_' + r.id_umkm;
          if (op.jenis === 'remove') { hapus('pendaftaran', id); break; }
          if (op.jenis === 'insert') {
            const u = (saatIni('UMKM') || []).find(x => x.id_umkm === r.id_umkm) || {}, p = pel()[r.id_pelatihan] || (saatIni('Pelatihan') || []).find(x => x.id_pelatihan === r.id_pelatihan) || {};
            set('pendaftaran', id, {
              id_pelatihan: r.id_pelatihan, id_umkm: r.id_umkm, tahun: String(p.tanggal_mulai || '').slice(0, 4), id_instruktur: p.id_instruktur || '',
              nama_umkm: u.nama_umkm || '', nama_pemilik: u.nama_pemilik || '', sektor: u.sektor || '', no_hp: u.no_hp || '',
              nama_peserta: r.nama_peserta || '', gender_peserta: r.gender_peserta || '', hp_peserta: r.hp_peserta || '', tgl_daftar: r.tgl_daftar || '',
              absen: {}, metode_absen: {}, pre: null, post: null, tugas: {}, evaluasi: '',
              status_lulus: r.status_lulus || 'belum', no_sertifikat: r.no_sertifikat || '', id_file_sertifikat: r.id_file_sertifikat || ''
            });
            break;
          }
          ubah('pendaftaran', id, kunci.filter(k => ['status_lulus', 'no_sertifikat', 'id_file_sertifikat', 'nama_peserta', 'gender_peserta', 'hp_peserta', 'tgl_daftar'].indexOf(k) >= 0).map(k => [[k], r[k]]));
          break;
        }
        case 'Absensi': {
          const id = r.id_pelatihan + '_' + r.id_umkm, h = String(r.hari_ke);
          if (op.jenis === 'remove') ubah('pendaftaran', id, [[['absen', h], HAPUS], [['metode_absen', h], HAPUS]]);
          else ubah('pendaftaran', id, [[['absen', h], r.waktu_absen], [['metode_absen', h], r.metode || 'aplikasi']]);
          break;
        }
        case 'Hasil_Tes': {
          const id = r.id_pelatihan + '_' + r.id_umkm;
          if (op.jenis === 'remove') { hapus('hasil_tes', id + '_' + r.jenis); ubah('pendaftaran', id, [[[r.jenis], null]]); break; }
          set('hasil_tes', id + '_' + r.jenis, { id_pelatihan: r.id_pelatihan, id_umkm: r.id_umkm, jenis: r.jenis, jawaban: j(r.jawaban, {}), jumlah_benar: n(r.jumlah_benar), skor: n(r.skor), waktu_selesai: r.waktu_selesai });
          ubah('pendaftaran', id, [[[r.jenis], { skor: n(r.skor), benar: n(r.jumlah_benar), waktu: r.waktu_selesai }]]);
          break;
        }
        case 'Materi':
          if (op.jenis === 'remove') hapus('materi', r.id_materi);
          else set('materi', r.id_materi, { id_materi: r.id_materi, id_pelatihan: r.id_pelatihan, judul: r.judul, cakupan: r.cakupan, sektor: r.sektor, id_file: r.id_file, ukuran: n(r.ukuran_file) || 0, urutan: n(r.urutan) || 0, diunggah_oleh: r.diunggah_oleh, tgl: r.tgl });
          break;
        case 'Bank_Soal':
          if (op.jenis === 'remove') { hapus('soal', r.id_soal); ubah('kunci_soal', r.id_pelatihan, [[['kunci', r.id_soal], HAPUS]]); break; }
          set('soal', r.id_soal, { id_soal: r.id_soal, id_pelatihan: r.id_pelatihan, jenis: r.jenis, pertanyaan: r.pertanyaan, opsi_a: r.opsi_a, opsi_b: r.opsi_b, opsi_c: r.opsi_c, opsi_d: r.opsi_d, opsi_e: r.opsi_e, urutan: n(r.urutan) || 0 });
          ubah('kunci_soal', r.id_pelatihan, [[['id_pelatihan'], r.id_pelatihan], [['kunci', r.id_soal], r.kunci]]);
          break;
        case 'Tugas':
          if (op.jenis === 'remove') hapus('tugas', r.id_tugas);
          else set('tugas', r.id_tugas, { id_tugas: r.id_tugas, id_pelatihan: r.id_pelatihan, judul: r.judul, instruksi: r.instruksi, batas_waktu: r.batas_waktu, dibuat_oleh: r.dibuat_oleh });
          break;
        case 'Pengumpulan_Tugas': {
          const idPel = r.id_pelatihan || idTugasPel(r.id_tugas), reg = idPel + '_' + r.id_umkm;
          if (op.jenis === 'remove') { hapus('pengumpulan', r.id_tugas + '_' + r.id_umkm); ubah('pendaftaran', reg, [[['tugas', r.id_tugas], HAPUS]]); break; }
          const d = { id_tugas: r.id_tugas, id_pelatihan: idPel, id_umkm: r.id_umkm, id_file: r.id_file, nama_file: r.nama_file, tipe_file: r.tipe_file, waktu_kumpul: r.waktu_kumpul, skor: n(r.skor), catatan: r.catatan_instruktur, dinilai_oleh: r.dinilai_oleh, waktu_dinilai: r.waktu_dinilai };
          if (op.jenis === 'insert') set('pengumpulan', r.id_tugas + '_' + r.id_umkm, d);
          else {
            const peta = { skor: 'skor', catatan_instruktur: 'catatan', dinilai_oleh: 'dinilai_oleh', waktu_dinilai: 'waktu_dinilai', id_file: 'id_file', nama_file: 'nama_file', tipe_file: 'tipe_file', waktu_kumpul: 'waktu_kumpul' };
            ubah('pengumpulan', r.id_tugas + '_' + r.id_umkm, kunci.filter(k => peta[k]).map(k => [[peta[k]], d[peta[k]]]));
          }
          ubah('pendaftaran', reg, [[['tugas', r.id_tugas], { skor: n(r.skor), waktu: r.waktu_kumpul }]]);
          break;
        }
        case 'Evaluasi_Pertanyaan': evalForm[r.id_pelatihan] = 1; break;
        case 'Evaluasi_Jawaban': {
          const id = r.id_pelatihan + '_' + r.id_umkm;
          if (op.jenis === 'remove') { hapus('evaluasi_jawaban', id); ubah('pendaftaran', id, [[['evaluasi'], '']]); break; }
          set('evaluasi_jawaban', id, { id_pelatihan: r.id_pelatihan, id_umkm: r.id_umkm, jawaban: j(r.jawaban, {}), waktu_isi: r.waktu_isi });
          ubah('pendaftaran', id, [[['evaluasi'], r.waktu_isi || 'ya']]);
          break;
        }
        case 'Pengaturan':
          if (op.jenis === 'remove') ubah('pengaturan', 'umum', [[[r.kunci], HAPUS]]);
          else ubah('pengaturan', 'umum', [[[r.kunci], r.kunci === 'SYARAT_LULUS_DEFAULT' ? j(r.nilai, {}) : r.nilai]]);
          break;
        case 'Log_Aktivitas':
          if (op.jenis === 'insert') set('log', String(r.waktu).replace(/\D/g, '') + '_' + Math.random().toString(36).slice(2, 8), { waktu: r.waktu, peran: r.peran, id_pengguna: r.id_pengguna, nama: op.nama || r.id_pengguna, aksi: r.aksi });
          break;
        case 'Draft_Pelatihan':
          if (op.jenis === 'remove') hapus('draft_pelatihan', r.id_draft);
          else set('draft_pelatihan', r.id_draft, { id_draft: r.id_draft, judul: r.judul, data: j(r.data, {}), dibuat_oleh: r.dibuat_oleh, tgl_diubah: r.tgl_diubah });
          break;
      }
    });
    // Form evaluasi disimpan utuh per pelatihan (1 dokumen berisi daftar pertanyaan)
    Object.keys(evalForm).forEach(id => set('evaluasi_form', id, {
      id_pelatihan: id, pertanyaan: (saatIni('Evaluasi_Pertanyaan') || []).filter(q => q.id_pelatihan === id).map(q => ({ bagian: q.bagian, nomor: n(q.nomor), pertanyaan: q.pertanyaan, tipe: q.tipe }))
    }));
    return W;
  },

  /**
   * DB cermin: antarmuka sama dengan DB (Spreadsheet), tetapi membaca dari sumber
   * Firestore (S) dan mencatat perubahan di `ops`. Semua metode berupa closure
   * sehingga aman dipasang ke objek DB milik GAS maupun browser.
   */
  buatDB(S) {
    const memo = {}, ops = [];
    const load = n => {
      if (!memo[n]) {
        const rows = CERMIN.keBaris(n, S);
        rows.forEach((r, i) => r._row = i + 2);
        memo[n] = { h: (SKEMA[n] || []).slice(), rows: rows };
      }
      return memo[n];
    };
    const db = {
      _cermin: true, ops: ops, _m: memo,
      reset: () => { Object.keys(memo).forEach(k => delete memo[k]); },
      load: load,
      rows: n => load(n).rows,
      find: (n, fn) => load(n).rows.find(fn) || null,
      filter: (n, fn) => load(n).rows.filter(fn),
      str: v => CERMIN.s(v),
      toArr: (n, o) => (SKEMA[n] || []).map(k => CERMIN.s(o[k])),
      insert: (n, objs, ekstra) => {
        [].concat(objs || []).forEach(o => {
          const r = {};
          (SKEMA[n] || []).forEach(k => r[k] = CERMIN.s(o[k]));
          Object.keys(o).forEach(k => { if (!(k in r)) r[k] = CERMIN.s(o[k]); });
          r._row = load(n).rows.length + 2;
          load(n).rows.push(r);
          ops.push(Object.assign({ jenis: 'insert', t: n, row: r }, ekstra || {}));
        });
      },
      update: (n, row, patch) => {
        Object.keys(patch).forEach(k => { row[k] = CERMIN.s(patch[k]); });
        ops.push({ jenis: 'update', t: n, row: row, patch: patch });
        return row;
      },
      remove: (n, rows) => {
        const t = load(n);
        (rows || []).forEach(r => { const i = t.rows.indexOf(r); if (i >= 0) t.rows.splice(i, 1); ops.push({ jenis: 'remove', t: n, row: r }); });
      },
      sh: () => { throw new Error('Fitur ini belum tersedia pada mode Firebase.'); },
      ss: () => { throw new Error('Fitur ini belum tersedia pada mode Firebase.'); },
      /** Terjemahkan semua perubahan menjadi daftar tulisan Firestore. */
      tulisan: () => CERMIN.keTulis(ops, S, n => (memo[n] ? memo[n].rows : load(n).rows))
    };
    return db;
  }
};


  // ---------- Penyesuaian khusus browser ----------
  var _S = null;
  // Kode QR rahasia hanya bisa dibuat server; admin membaca salinannya dari pelatihan_rahasia
  kodeQR = function (id) { var d = _S ? _S.kol('pelatihan_rahasia').find(function (x) { return x._id === id; }) : null; return d && d.qr_kode ? d.qr_kode : ''; };
  var _K = ['_cermin', 'reset', 'load', 'rows', 'find', 'filter', 'str', 'toArr', 'insert', 'update', 'remove', 'sh', 'ss', '_m'];
  return {
    versi: VERSI,
    CERMIN: CERMIN,
    /** Jalankan satu aksi di atas sumber data S. Hasil: { hasil, tulisan[] } (belum dikirim). */
    jalankan: function (S, action, data, sesi) {
      var r = rute()[action];
      if (!r) throw new Error('Aksi tidak dikenal: ' + action);
      if (r.peran && r.peran.indexOf(sesi.r) < 0) { var e = new Error('Anda tidak memiliki akses ke fitur ini.'); e.code = 'AKSES'; throw e; }
      if (sesi.gp && !r.gp) { var g = new Error('Ganti PIN terlebih dahulu.'); g.code = 'GANTI_PIN'; throw g; }
      _S = S;
      var db = CERMIN.buatDB(S), asli = {};
      _K.forEach(function (k) { asli[k] = DB[k]; DB[k] = db[k]; });
      try {
        var hasil = r.fn(data || {}, sesi);
        return { hasil: hasil === undefined ? null : hasil, tulisan: db.tulisan() };
      } finally { _K.forEach(function (k) { DB[k] = asli[k]; }); }
    }
  };
})();
