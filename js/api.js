/* =============================================================
   RuangLatih — api.js
   Semua komunikasi ke Google Apps Script lewat fetch POST
   (Content-Type text/plain agar tidak memicu CORS preflight).
   ============================================================= */
const Sesi = {
  KEY: 'rl_sesi_v1',
  get() { try { return JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { return null; } },
  set(s) { try { localStorage.setItem(this.KEY, JSON.stringify(s)); } catch (e) { } },
  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { } },
  token() { const s = this.get(); return s ? s.token : ''; },
  user() { const s = this.get(); return s ? s.user : null; }
};

const API = {
  tidur: ms => new Promise(r => setTimeout(r, ms)),

  /**
   * Panggil aksi backend. Otomatis mencoba ulang dengan jeda acak
   * saat server sibuk / jaringan putus (lonjakan 50 peserta).
   * opt.onRetry(n) dipanggil tiap kali mencoba ulang.
   */
  async call(action, data = {}, opt = {}) {
    if (!GAS_URL || GAS_URL.indexOf('TEMPEL_') >= 0) throw new Error('GAS_URL belum diisi di js/config.js');
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
