/* =============================================================
   RuangLatih — api.js
   Semua komunikasi ke Google Apps Script lewat fetch POST
   (Content-Type text/plain agar tidak memicu CORS preflight).

   ⚡ gas-instant-ux:
   - Cache lokal (memori + localStorage) per pengguna: halaman tampil
     INSTAN dari data tersimpan, lalu disegarkan diam-diam di latar.
   - Permintaan yang sama tidak dikirim dua kali (dedupe).
   - Setiap aksi tulis menghapus cache yang terkait, lalu data menu
     dipanaskan ulang di latar (1 permintaan gabungan / "multi").
   ============================================================= */
const Sesi = {
  KEY: 'rl_sesi_v1',
  get() { try { return JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { return null; } },
  set(s) { try { localStorage.setItem(this.KEY, JSON.stringify(s)); } catch (e) { } },
  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { } Simpan.hapusSemua(); },
  token() { const s = this.get(); return s ? s.token : ''; },
  user() { const s = this.get(); return s ? s.user : null; }
};

// Domain data tiap aksi baca / tulis → menentukan cache mana yang basi setelah menulis
const BACA = {
  pelatihan_list: 'pel reg', pelatihan_detail: 'pel reg absen tes tugas eval umkm sert', materi_list: 'materi', soal_list: 'soal tes',
  tugas_list: 'tugas umkm', nilai_rekap: 'pel reg absen tes tugas umkm', dasbor_instruktur: 'pel reg absen tes tugas soal materi',
  dasbor_admin: '*', draft_list: 'draft', umkm_list: 'umkm reg', umkm_riwayat: '*', instruktur_list: 'ins pel', eval_form: 'eval', eval_hasil: 'eval reg pel', pengaturan_get: 'set',
  admin_list: 'admin', log_list: '*', sert_status: 'sert reg absen tes tugas pel umkm', laporan_data: '*',
  p_beranda: 'pel reg', p_pelatihan: 'pel reg absen tes', p_ruang: 'pel absen tes tugas eval materi soal', p_materi: 'materi reg',
  p_riwayat: '*', p_sertifikat: '*'
};
const TULIS = {
  materi_hapus: 'materi', upload_chunk: 'materi', soal_simpan: 'soal', soal_hapus: 'soal', tugas_simpan: 'tugas', tugas_hapus: 'tugas', tugas_nilai: 'tugas',
  umkm_simpan: 'umkm', umkm_reset_pin: 'umkm', umkm_status: 'umkm', umkm_import: 'umkm', instruktur_simpan: 'ins',
  pelatihan_simpan: 'pel draft', draft_simpan: 'draft', draft_hapus: 'draft', pelatihan_hapus: 'pel', pelatihan_flyer: 'pel', peserta_daftarkan: 'reg', peserta_hapus: 'reg',
  aktivitas_set: 'pel', syarat_set: 'pel', eval_simpan_form: 'eval', eval_salin: 'eval', pengaturan_simpan: 'set',
  admin_simpan: 'admin', admin_hapus: 'admin', sert_template: 'sert', sert_terbitkan: 'sert',
  p_absen: 'absen', p_kirim_tes: 'tes', p_kumpul_tugas: 'tugas', p_kirim_eval: 'eval', ganti_password: 'admin'
};

/** Penyimpanan cache: memori (instan) + localStorage (bertahan saat aplikasi dibuka ulang). */
const Simpan = {
  mem: {}, VER: 'rl_c2_',
  pfx() { const u = Sesi.user(); return this.VER + (u ? u.peran + '_' + u.id : 'x') + '|'; },
  kunci(action, data) { return action + ':' + JSON.stringify(data || {}); },
  get(k) {
    const pk = this.pfx() + k;
    if (this.mem[pk]) return this.mem[pk];
    try { const x = JSON.parse(localStorage.getItem(pk) || 'null'); if (x) this.mem[pk] = x; return x; } catch (e) { return null; }
  },
  set(k, d) {
    const pk = this.pfx() + k, s = JSON.stringify(d);
    const x = { d: d, s: s, t: Date.now() };
    this.mem[pk] = x;
    if (s.length > 400000) return x; // data sangat besar cukup di memori
    try { localStorage.setItem(pk, JSON.stringify(x)); }
    catch (e) { this.rampingkan(); try { localStorage.setItem(pk, JSON.stringify(x)); } catch (e2) { } }
    return x;
  },
  /** Hapus cache yang domain datanya tersentuh aksi tulis. */
  basikan(domain) {
    const dom = String(domain || '').split(' ');
    const cocok = k => { const a = k.slice(k.indexOf('|') + 1).split(':')[0]; const tag = (BACA[a] || '').split(' '); return tag.indexOf('*') >= 0 || tag.some(t => dom.indexOf(t) >= 0); };
    Object.keys(this.mem).forEach(k => { if (k.indexOf(this.VER) === 0 && cocok(k)) delete this.mem[k]; });
    this.kunciLS().forEach(k => { if (cocok(k)) try { localStorage.removeItem(k); } catch (e) { } });
  },
  kunciLS() { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf(this.VER) === 0) out.push(k); } } catch (e) { } return out; },
  rampingkan() {
    const ks = this.kunciLS().map(k => { let t = 0; try { t = JSON.parse(localStorage.getItem(k)).t; } catch (e) { } return [k, t]; }).sort((a, b) => a[1] - b[1]);
    ks.slice(0, Math.ceil(ks.length / 2)).forEach(x => localStorage.removeItem(x[0]));
  },
  hapusSemua() {
    this.mem = {};
    this.kunciLS().forEach(k => { try { localStorage.removeItem(k); } catch (e) { } });
    try { Object.keys(localStorage).filter(k => k.indexOf('rl_c1_') === 0).forEach(k => localStorage.removeItem(k)); } catch (e) { }
  }
};

const API = {
  tidur: ms => new Promise(r => setTimeout(r, ms)),
  _jalan: {},
  _mulai: Date.now(), // data dari sebelum halaman dibuka selalu disegarkan

  /**
   * Panggil aksi backend. Otomatis mencoba ulang dengan jeda acak
   * saat server sibuk / jaringan putus (lonjakan 50 peserta).
   * opt.onRetry(n) dipanggil tiap kali mencoba ulang.
   */
  async call(action, data = {}, opt = {}) {
    if (!GAS_URL || GAS_URL.indexOf('TEMPEL_') >= 0) throw new Error('GAS_URL belum diisi di js/config.js');
    const k = BACA[action] ? Simpan.kunci(action, data) : null;
    if (k && this._jalan[k] && !opt.onRetry) return this._jalan[k]; // dedupe permintaan baca yang sama
    const p = this._kirim(action, data, opt).then(d => {
      if (k) Simpan.set(k, d);
      if (TULIS[action]) { Simpan.basikan(TULIS[action]); this.panaskanNanti(); }
      return d;
    });
    if (k) { this._jalan[k] = p; p.then(() => delete this._jalan[k], () => delete this._jalan[k]); }
    return p;
  },

  async _kirim(action, data, opt) {
    const maks = opt.retry === undefined ? 4 : opt.retry;
    const body = JSON.stringify({ action, token: Sesi.token(), data });
    for (let n = 0; ; n++) {
      let j;
      try {
        const res = await fetch(GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body, redirect: 'follow' });
        j = await res.json();
      } catch (e) {
        if (n < maks) { opt.onRetry && opt.onRetry(n + 1); await this.tidur(900 + Math.random() * 2200 * (n + 1)); continue; }
        throw new Error('Koneksi terputus. Periksa sinyal internet lalu coba lagi.');
      }
      if (j.busy && n < maks) { opt.onRetry && opt.onRetry(n + 1); await this.tidur(700 + Math.random() * 2500 * (n + 1)); continue; }
      if (!j.success) {
        if (j.code === 'SESI') { Sesi.clear(); if (window.App) App.keMasuk('Sesi berakhir, silakan masuk kembali.'); }
        if (j.code === 'GANTI_PIN' && window.App) App.render();
        const err = new Error(j.message || 'Terjadi kesalahan.');
        err.code = j.code;
        throw err;
      }
      return j.data;
    }
  },

  /**
   * ⚡ Tampil instan: bila ada data tersimpan, render() langsung dipanggil
   * (tanpa loading), lalu data disegarkan di latar dan render() dipanggil
   * lagi HANYA jika isinya berubah. Tanpa cache → tunggu server seperti biasa.
   * render(data, dariCache)
   */
  async ambil(action, data, render, opt) {
    opt = opt || {};
    const k = Simpan.kunci(action, data);
    const c = Simpan.get(k);
    if (c) render(c.d, true);
    if (c && c.t > this._mulai && Date.now() - c.t < (opt.segar || 8000)) return c.d; // baru saja diambil di sesi ini (mis. dipanaskan)
    try {
      const d = await this.call(action, data, opt);
      const baru = Simpan.get(k);
      if ((!c || !baru || c.s !== baru.s) && (!opt.el || opt.el.isConnected)) render(d, false);
      return d;
    } catch (e) {
      if (!c || e.code === 'SESI') throw e;
      return c.d; // tetap tampilkan data tersimpan saat sinyal lemah
    }
  },

  /** Ambil satu kali: pakai cache bila ada (segarkan diam-diam), atau tunggu server. */
  async cepat(action, data) {
    const c = Simpan.get(Simpan.kunci(action, data));
    if (c) { if (Date.now() - c.t > 15000) this.call(action, data).catch(() => { }); return c.d; }
    return this.call(action, data);
  },

  /** Beberapa aksi baca dalam 1 permintaan (Prinsip 4). Hasil langsung masuk cache. */
  async multi(calls) {
    calls = calls.filter(c => { const x = Simpan.get(Simpan.kunci(c.action, c.data)); return !x || x.t < this._mulai || Date.now() - x.t > 20000; });
    if (!calls.length) return [];
    const hasil = await this._kirim('multi', { calls: calls.map(c => ({ action: c.action, data: c.data || {} })) }, { retry: 1 });
    hasil.forEach((h, i) => { if (h.success) Simpan.set(Simpan.kunci(calls[i].action, calls[i].data), h.data); });
    return hasil;
  },

  /** Panaskan data semua menu peran ini di latar belakang → perpindahan menu instan. */
  async panaskan() {
    const u = Sesi.user();
    if (!u || (u.peran === 'peserta' && u.wajib_ganti_pin) || this._panas) return;
    this._panas = true;
    try {
      if (u.peran === 'peserta') {
        await this.multi([{ action: 'p_beranda' }, { action: 'p_pelatihan' }, { action: 'p_materi' }, { action: 'p_sertifikat' }, { action: 'p_riwayat' }]);
        const b = Simpan.get(Simpan.kunci('p_beranda', {}));
        const ids = b ? b.d.aktif.map(x => x.id_pelatihan) : [];
        const pl = Simpan.get(Simpan.kunci('p_pelatihan', {}));
        if (pl) pl.d.filter(p => p.status !== 'selesai').forEach(p => { if (ids.indexOf(p.id_pelatihan) < 0) ids.push(p.id_pelatihan); });
        if (ids.length) await this.multi(ids.slice(0, 4).map(id => ({ action: 'p_ruang', data: { id_pelatihan: id } })));
      } else if (u.peran === 'instruktur') {
        await this.multi([{ action: 'dasbor_instruktur' }, { action: 'pelatihan_list' }, { action: 'materi_list' }, { action: 'tugas_list' }]);
        const id = this.pelUtama();
        if (id) await this.multi([{ action: 'soal_list', data: { id_pelatihan: id } }, { action: 'nilai_rekap', data: { id_pelatihan: id } }, { action: 'materi_list', data: { id_pelatihan: id } }, { action: 'tugas_list', data: { id_pelatihan: id } }]);
      } else {
        await this.multi([{ action: 'dasbor_admin' }, { action: 'pelatihan_list' }, { action: 'draft_list' }, { action: 'instruktur_list' }, { action: 'umkm_list' }, { action: 'materi_list' }, { action: 'tugas_list' }]);
        const id = this.pelUtama();
        const l = [{ action: 'log_list', data: { limit: 1000 } }, { action: 'admin_list' }, { action: 'pengaturan_get' }, { action: 'laporan_data' }];
        if (id) l.unshift({ action: 'pelatihan_detail', data: { id_pelatihan: id } }, { action: 'soal_list', data: { id_pelatihan: id } }, { action: 'eval_hasil', data: { id_pelatihan: id } }, { action: 'sert_status', data: { id_pelatihan: id } });
        await this.multi(l);
      }
    } catch (e) { /* pemanasan gagal tidak mengganggu pengguna */ }
    finally { this._panas = false; }
  },
  pelUtama() {
    const c = Simpan.get(Simpan.kunci('pelatihan_list', {}));
    if (!c || !c.d.length) return '';
    const simpan = sessionStorage.getItem('rl_pel');
    if (simpan && c.d.some(p => p.id_pelatihan === simpan)) return simpan;
    const b = c.d.find(p => p.status === 'berlangsung') || c.d.find(p => p.status === 'akan datang') || c.d[0];
    return b.id_pelatihan;
  },
  panaskanNanti() { clearTimeout(this._tp); this._tp = setTimeout(() => this.panaskan(), 1500); },

  /** Unggah PDF besar (maks 50 MB) bertahap per potongan ±4 MB, lengkap dengan persentase. */
  async unggahBesar(file, meta, onProgress) {
    const init = await this.call('upload_init', Object.assign({ tujuan: 'materi', nama: file.name, tipe: file.type || 'application/pdf', ukuran: file.size }, meta));
    const chunk = init.chunk;
    let offset = 0, hasil = null;
    while (offset < file.size) {
      const potong = file.slice(offset, Math.min(offset + chunk, file.size));
      const data = await UI.blobKeBase64(potong);
      const r = await this.call('upload_chunk', { upload_id: init.upload_id, offset, data }, { retry: 5 });
      if (r.selesai) { hasil = r; offset = file.size; }
      else offset = r.diterima || (offset + potong.size);
      onProgress && onProgress(Math.min(99, Math.round(offset / file.size * 100)));
    }
    onProgress && onProgress(100);
    return hasil;
  }
};
