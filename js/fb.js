/* =============================================================
   RuangLatih — fb.js  (Firebase · Login Langsung)
   • Memuat Firebase SDK (compat) dari gstatic.
   • LOGIN LANGSUNG ke Firebase Authentication (tanpa antre di GAS):
     email internal + sandi dari PIN/kode — rumus SAMA dengan
     emailMasuk()/sandiMasuk() di LoginFirebase.gs.
   • Bila login langsung belum bisa (akun belum disiapkan, nama ganda,
     dsb.), aplikasi otomatis memakai jalur lama lewat GAS.
   • Halaman uji "#/uji-firebase" (koneksi, aturan keamanan, uji login serentak).
   ============================================================= */
var FBC = {
  VER: '10.12.2', _siap: null, db: null, auth: null,

  aktif() { return typeof FIREBASE_CONFIG !== 'undefined' && !!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey); },

  muat() {
    if (!this.aktif()) return Promise.reject(new Error('FIREBASE_CONFIG belum diisi di js/config.js'));
    if (this._siap) return this._siap;
    this._siap = (async () => {
      const b = 'https://www.gstatic.com/firebasejs/' + this.VER + '/';
      await UI.muatSkrip(b + 'firebase-app-compat.js');
      await Promise.all([UI.muatSkrip(b + 'firebase-auth-compat.js'), UI.muatSkrip(b + 'firebase-firestore-compat.js')]);
      try { firebase.firestore.setLogLevel('error'); } catch (e) { } // sembunyikan peringatan informasi SDK (bukan error)
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      this.auth = firebase.auth();
      this.db = firebase.firestore();
      try { await this.db.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* mode privat / tab lain: tetap jalan tanpa cache offline */ }
      return true;
    })();
    this._siap.catch(() => { this._siap = null; });
    return this._siap;
  },

  /** Masuk Firebase dengan custom token dari GAS. */
  masuk(fbToken) {
    // disimpan agar pastikanMasuk() menunggu proses ini (tidak meminta token baru ke server = hemat antrean)
    this._masukP = (async () => { await this.muat(); await this.auth.signInWithCustomToken(fbToken); return this.auth.currentUser; })();
    const p = this._masukP;
    p.catch(() => { }).then(() => { if (this._masukP === p) this._masukP = null; });
    return p;
  },

  /** Pastikan sudah masuk Firebase sesuai sesi RuangLatih (pulihkan / minta token baru bila perlu). */
  async pastikanMasuk() {
    await this.muat();
    if (this._masukP) { try { await this._masukP; } catch (e) { } }
    let u = this.auth.currentUser || await new Promise(res => { const off = this.auth.onAuthStateChanged(x => { off(); res(x); }); });
    const s = Sesi.user();
    if (u && s && u.uid !== String(s.id)) { await this.auth.signOut(); u = null; }
    if (!u && s) {
      if (Sesi.token()) { const r = await API._kirim('fb_token', {}, { retry: 2 }); u = await this.masuk(r.fb_token); }
      else {
        // login langsung: identitas Firebase sudah tidak ada (keluar di tab lain / akun dinonaktifkan) → masuk ulang
        const e = new Error('Sesi berakhir, silakan masuk kembali.'); e.code = 'SESI';
        if (window.App && !this._keluarP) { this._keluarP = 1; setTimeout(() => { this._keluarP = 0; App.keMasuk(e.message); }, 0); }
        throw e;
      }
    }
    return u;
  },

  // ===========================================================
  // LOGIN LANGSUNG KE FIREBASE (tanpa GAS)
  // ===========================================================
  /** Sama persis dengan kunciNama() & emailMasuk() di server. */
  kunci(n) { return String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); },
  email(peran, teks) {
    const k = this.kunci(teks).replace(/ /g, '.').slice(0, 56).replace(/\.+$/, '');
    const p = { peserta: 'p', instruktur: 'i', admin: 'a' }[peran];
    const pid = this.aktif() ? FIREBASE_CONFIG.projectId : '';
    return k && p && pid ? p + '.' + k + '@' + pid + '.firebaseapp.com' : '';
  },
  sandi(x) { return 'rl#' + String(x); },
  /** Kredensial login dari isian form masuk. */
  kredensial(d) {
    if (d.peran === 'peserta') return { email: this.email('peserta', d.nama_umkm), sandi: this.sandi(d.pin), rahasia: String(d.pin) };
    if (d.peran === 'instruktur') { const k = String(d.kode || '').trim().toUpperCase(); return { email: this.email('instruktur', d.nama), sandi: this.sandi(k), rahasia: k }; }
    const pw = String(d.password || '').trim();
    return { email: this.email('admin', d.username), sandi: this.sandi(pw), rahasia: pw };
  },
  waktu() {
    const p = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
      .formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day + ' ' + (p.hour === '24' ? '00' : p.hour) + ':' + p.minute + ':' + p.second;
  },
  catat(user, aksi) {
    const w = this.waktu();
    return this.db.collection('log').doc(w.replace(/\D/g, '') + '_' + Math.random().toString(36).slice(2, 8))
      .set({ waktu: w, peran: user.peran, id_pengguna: String(user.id), nama: user.nama || String(user.id), aksi: aksi }).catch(() => { });
  },

  /**
   * Masuk langsung ke Firebase. Hasil: data pengguna (berhasil) atau null (pakai jalur GAS).
   * Melempar galat hanya untuk pesan yang pasti (akun nonaktif, terlalu banyak percobaan).
   */
  async masukLangsung(d) {
    if (!this.aktif() || !API.modeFB()) return null;
    if (typeof LOGIN_LANGSUNG !== 'undefined' && LOGIN_LANGSUNG === false) return null; // sakelar darurat di config.js
    const k = this.kredensial(d);
    if (!k.email || k.sandi.length < 6) return null;
    try { await this.muat(); } catch (e) { return null; } // SDK gagal dimuat (sinyal) → jalur server
    let cred;
    try { cred = await this.auth.signInWithEmailAndPassword(k.email, k.sandi); }
    catch (e) {
      const c = (e && e.code) || '';
      if (c === 'auth/user-disabled') { const x = new Error(d.peran === 'peserta' ? 'Akun dinonaktifkan. Hubungi admin PPU.' : 'Akun tidak aktif. Hubungi admin PPU.'); x.pasti = 1; throw x; }
      console.info('[RuangLatih] login langsung belum bisa (' + c + ') → lewat server');
      return null; // PIN salah, akun belum disiapkan, jaringan, dsb. → server yang memutuskan
    }
    const u = cred.user, uid = String(u.uid), db = this.db;
    const tolak = pesan => { const x = new Error(pesan); x.pasti = 1; return x; };
    try {
      const kl = (await u.getIdTokenResult()).claims;
      if (kl.peran !== d.peran) return await this._batal();
      let user;
      // Periksa data terkini (PIN/kode/status) — mencegah PIN lama dipakai bila akun login belum sempat disamakan
      if (d.peran === 'peserta') {
        const x = await Promise.all([db.doc('akun_umkm/' + uid).get(), db.doc('umkm/' + uid).get()]);
        const a = x[0].data() || {}, m = x[1].data() || {};
        if (String(a.pin || '') !== k.rahasia) return await this._batal();
        if (m.status_akun && m.status_akun !== 'aktif') { await this._batal(); throw tolak('Akun dinonaktifkan. Hubungi admin PPU.'); }
        user = { peran: 'peserta', id: uid, nama: m.nama_pemilik || kl.nama || '', umkm: m.nama_umkm || kl.umkm || '', sektor: m.sektor || kl.sektor || '', wajib_ganti_pin: !!a.wajib_ganti_pin };
      } else if (d.peran === 'instruktur') {
        const x = await Promise.all([db.doc('akun_instruktur/' + uid).get(), db.doc('instruktur/' + uid).get()]);
        const a = x[0].data() || {}, m = x[1].data() || {};
        if (String(a.kode_akses || '').trim().toUpperCase() !== k.rahasia) return await this._batal();
        if (m.status && m.status !== 'aktif') { await this._batal(); throw tolak('Akun instruktur tidak aktif. Hubungi admin PPU.'); }
        user = { peran: 'instruktur', id: uid, nama: m.nama || kl.nama || '', umkm: '', sektor: '', wajib_ganti_pin: false };
      } else {
        const a = await db.doc('admin/' + uid).get();
        if (!a.exists) return await this._batal();
        user = { peran: 'admin', id: uid, nama: (a.data() || {}).nama || kl.nama || uid, umkm: '', sektor: '', wajib_ganti_pin: false };
      }
      return user;
    } catch (e) {
      if (e && e.pasti) throw e;
      console.info('[RuangLatih] pemeriksaan login langsung gagal (' + ((e && (e.code || e.message)) || e) + ') → lewat server');
      return await this._batal();
    }
  },
  async _batal() { try { await this.auth.signOut(); } catch (e) { } return null; },

  /** ID token Firebase untuk permintaan ke GAS (diperbarui otomatis oleh SDK tiap ±1 jam). */
  async idToken(paksa) {
    const u = await this.pastikanMasuk();
    return u ? u.getIdToken(!!paksa) : '';
  },
  /** Login langsung aktif untuk sesi ini (bukan jalur lama lewat GAS). */
  langsung() { return API.modeFB() && !Sesi.token() && !!Sesi.user(); },

  /**
   * Ganti PIN peserta langsung di Firebase (tanpa GAS). Hasil: data pengguna baru,
   * atau null bila harus lewat server (sesi lama / aturan keamanan belum diperbarui).
   */
  async gantiPin(lama, baru) {
    const s = Sesi.user();
    if (!this.langsung() || !s || s.peran !== 'peserta') return null;
    const u = await this.pastikanMasuk();
    if (!u || !u.email) return null;
    try { await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, this.sandi(lama))); }
    catch (e) {
      const c = (e && e.code) || '';
      if (c === 'auth/too-many-requests') throw new Error('Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.');
      if (/wrong-password|invalid-credential|invalid-login-credentials/.test(c)) throw new Error('PIN lama salah.');
      if (c === 'auth/network-request-failed') throw new Error('Koneksi terputus. Periksa sinyal lalu coba lagi.');
      return null;
    }
    // Simpan PIN baru dulu (dibaca admin & dipakai pemeriksaan login), baru sandi Firebase.
    try { await this.db.doc('akun_umkm/' + u.uid).update({ pin: baru, wajib_ganti_pin: false }); }
    catch (e) { if ((e && e.code) === 'permission-denied') return null; throw new Error('Gagal menyimpan PIN: ' + ((e && e.message) || e)); }
    try { await u.updatePassword(this.sandi(baru)); }
    catch (e) { console.warn('[RuangLatih] sandi Firebase belum diperbarui — otomatis diperbaiki saat login berikutnya', e && e.code); }
    const user = Object.assign({}, s, { wajib_ganti_pin: false });
    this.catat(user, 'Mengganti PIN');
    return { user: user, message: 'PIN berhasil diganti.' };
  },

  /** Admin mengganti kata sandi (lewat server) → masuk ulang ke Firebase dengan sandi baru. */
  async masukUlang(peran, nama, rahasia) {
    try { await this.muat(); const k = this.kredensial({ peran: peran, username: nama, password: rahasia }); await this.auth.signInWithEmailAndPassword(k.email, k.sandi); } catch (e) { }
  },

  /** Periksa ulang sesi (status akun & wajib ganti PIN) langsung dari Firestore. Hasil: user terbaru / null. */
  async periksaSesi() {
    const s = Sesi.user();
    if (!s) return null;
    await this.pastikanMasuk();
    const db = this.db, uid = String(s.id);
    try {
      if (s.peran === 'peserta') {
        const x = await Promise.all([db.doc('umkm/' + uid).get(), db.doc('akun_umkm/' + uid).get()]);
        const m = x[0].data() || {}, a = x[1].data() || {};
        if (m.status_akun && m.status_akun !== 'aktif') return { nonaktif: true };
        return Object.assign({}, s, { nama: m.nama_pemilik || s.nama, umkm: m.nama_umkm || s.umkm, sektor: m.sektor || s.sektor, wajib_ganti_pin: !!a.wajib_ganti_pin });
      }
      if (s.peran === 'instruktur') {
        const m = (await db.doc('instruktur/' + uid).get()).data() || {};
        if (m.status && m.status !== 'aktif') return { nonaktif: true };
        return Object.assign({}, s, { nama: m.nama || s.nama });
      }
    } catch (e) { /* aturan lama / offline → abaikan */ }
    return null;
  },

  /**
   * Kartu scan absensi QR langsung dari Firestore (publik, tanpa login) — tampil ±0,5 detik.
   * Hasil pertama dikembalikan (null bila kartu belum ada → aplikasi memakai server); perubahan
   * berikutnya (mis. admin membuka absensi) dikirim ke onUbah secara realtime.
   */
  async kartuQR(id, kode, onUbah, simpanHenti) {
    if (!this.aktif() || !API.modeFB() || !kode) return null;
    try { await this.muat(); } catch (e) { return null; }
    const bentuk = x => {
      const hi = this.waktu().slice(0, 10), akt = x.aktivitas || {};
      return { id_pelatihan: x.id_pelatihan, judul: x.judul, tema: x.tema, instruktur: x.instruktur, jam: x.jam, format: x.format, lokasi: x.lokasi,
        jumlah_hari: x.jumlah_hari, status: x.status,
        hari: (x.tanggal_hari || []).map((t, i) => ({ hari_ke: i + 1, tanggal: t, hari_ini: t === hi, buka: !!akt['absen_' + (i + 1)] || t === hi })) };
    };
    return new Promise(res => {
      let awal = true, off = () => { };
      const t = setTimeout(() => { if (awal) { awal = false; res(null); } }, 6000);
      off = this.db.doc('qr/' + kode).onSnapshot(snap => {
        const x = snap.exists ? snap.data() : null, ok = !!(x && x.id_pelatihan === id);
        if (awal) { awal = false; clearTimeout(t); res(ok ? bentuk(x) : null); if (!ok) off(); return; }
        if (ok && onUbah) onUbah(bentuk(x));
      }, () => { if (awal) { awal = false; clearTimeout(t); res(null); } });
      if (simpanHenti) simpanHenti(() => off());
    });
  },

  /** Identitas aplikasi (nama, logo, warna) langsung dari Firestore — tanpa GAS. */
  async brand() {
    await this.muat();
    const x = (await this.db.doc('pengaturan/umum').get()).data() || {};
    return { nama: x.NAMA_APLIKASI || 'RuangLatih', tagline: x.TAGLINE || 'Pusat Pendampingan UMKM Cakung', logo: x.LOGO_DATA || '',
      footer: x.TEKS_FOOTER || ('© ' + new Date().getFullYear() + ' PPU UT Cakung · Pusat Pendampingan UMKM Cakung'), warna: x.WARNA_UTAMA || '#9E3D52', wa: x.WA_ADMIN || '' };
  },

  async keluar() { try { if (this.auth) await this.auth.signOut(); } catch (e) { } },

  // ---------- Uji login serentak (admin): meniru 25–30 peserta menekan "Masuk" bersamaan ----------
  kartuSerentak() {
    return '<div class="card" style="margin-bottom:20px"><div class="h-sm">Uji Login Serentak</div>' +
      '<div class="t-sm muted mt8">Meniru banyak peserta menekan <b>Masuk</b> di detik yang sama, langsung ke Firebase (tanpa server GAS). Pakai satu akun UMKM uji; sesi Anda tidak berubah.</div>' +
      '<div class="grid2 mt12" style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="field"><label>Nama UMKM uji</label><input class="input" data-s-nama placeholder="mis. UMKM Uji"></div>' +
      '<div class="field"><label>PIN akun uji</label><input class="input" data-s-pin inputmode="numeric" maxlength="4" autocomplete="off"></div></div>' +
      '<div class="row g8 mt12 wrap"><div class="field" style="width:120px"><label>Jumlah</label><input class="input" data-s-n type="number" min="1" max="60" value="30"></div>' +
      '<button class="btn primary sm" style="align-self:flex-end" data-s-mulai>' + UI.ic('send', 'sm') + 'Mulai uji</button></div><div class="mt12" data-s-hasil></div></div>';
  },
  pasangSerentak(el) {
    const b = $('[data-s-mulai]', el);
    if (!b) return;
    b.onclick = () => UI.sibuk(b, async () => {
      const out = $('[data-s-hasil]', el), nama = $('[data-s-nama]', el).value, pin = $('[data-s-pin]', el).value.trim();
      const n = Math.max(1, Math.min(60, parseInt($('[data-s-n]', el).value, 10) || 30));
      const k = this.kredensial({ peran: 'peserta', nama_umkm: nama, pin: pin });
      if (!k.email || !/^\d{4}$/.test(pin)) { out.innerHTML = '<div class="err">Isi nama UMKM dan PIN 4 angka.</div>'; return; }
      out.innerHTML = '<div class="t-sm muted">Mengirim ' + n + ' login bersamaan…</div>';
      const url = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + FIREBASE_CONFIG.apiKey;
      const satu = async () => {
        const t0 = performance.now();
        try {
          const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: k.email, password: k.sandi, returnSecureToken: true }) });
          const j = await r.json();
          return { ok: !!j.idToken, ms: performance.now() - t0, pesan: j.error ? j.error.message : '' };
        } catch (e) { return { ok: false, ms: performance.now() - t0, pesan: 'jaringan' }; }
      };
      const t0 = performance.now();
      const H = await Promise.all(Array.from({ length: n }, satu));
      const total = performance.now() - t0, ok = H.filter(h => h.ok), ms = ok.map(h => h.ms).sort((a, b) => a - b);
      const rata = ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : 0, maks = ms.length ? ms[ms.length - 1] : 0;
      const galat = {}; H.filter(h => !h.ok).forEach(h => galat[h.pesan] = (galat[h.pesan] || 0) + 1);
      const lulus = ok.length === n && maks < 5000;
      out.innerHTML = '<div class="card well tight"><dl class="kv"><dt>Berhasil</dt><dd><b>' + ok.length + ' dari ' + n + '</b></dd>' +
        '<dt>Rata-rata</dt><dd>' + (rata / 1000).toFixed(2) + ' detik</dd><dt>Paling lama</dt><dd>' + (maks / 1000).toFixed(2) + ' detik</dd>' +
        '<dt>Semua selesai</dt><dd>' + (total / 1000).toFixed(2) + ' detik</dd></dl>' +
        (Object.keys(galat).length ? '<div class="t-xs muted mt8">Gagal: ' + Object.keys(galat).map(g => esc(g) + ' ×' + galat[g]).join(', ') +
          (galat.INVALID_LOGIN_CREDENTIALS || galat.EMAIL_NOT_FOUND || galat.INVALID_PASSWORD ? ' — periksa nama/PIN, atau jalankan siapkanLoginFirebase()' : '') + '</div>' : '') +
        '<div class="mt8"><span class="chip ' + (lulus ? 'ok' : 'warn') + '">' + (lulus ? 'Siap untuk ' + n + ' peserta serentak' : 'Perlu diperiksa') + '</span></div></div>';
    }, 'Menguji…');
  },

  // ===========================================================
  // HALAMAN UJI: #/uji-firebase (semua peran)
  // ===========================================================
  async halamanUji(el) {
    const s = Sesi.user() || {};
    el.innerHTML = '<div class="page-h"><div><div class="crumb">Migrasi Firebase · Fase 2</div><div class="h-lg">Uji Koneksi & Keamanan Firebase</div></div>' +
      '<button class="btn primary sm" data-ulang>' + UI.ic('refresh', 'sm') + 'Uji ulang</button></div>' +
      '<div class="card row between wrap" style="margin-bottom:20px"><div><div class="h-sm">Sumber data perangkat ini</div><div class="t-sm muted">' +
      (API.modeFB() ? '<b class="c-ok">Firebase</b> — aplikasi membaca & menulis ke Firestore.' : '<b>Spreadsheet</b> (normal). Aktifkan mode uji untuk mencoba aplikasi di atas Firebase <b>hanya di perangkat ini</b>.') + '</div>' +
      (API.modeFB() && typeof MODE_DATA !== 'undefined' && MODE_DATA === 'firebase' ? '' : '<div class="hint mt8">Mode uji memakai salinan data di Firestore. Data yang diubah saat uji <b>tidak</b> masuk ke Spreadsheet.</div>') + '</div>' +
      (typeof MODE_DATA !== 'undefined' && MODE_DATA === 'firebase' ? '<span class="chip ok">Firebase aktif untuk semua</span>' :
        '<button class="btn ' + (API.modeFB() ? 'outline' : 'primary') + ' sm" data-mode>' + (API.modeFB() ? 'Kembali ke Spreadsheet' : 'Aktifkan Mode Firebase (uji)') + '</button>') + '</div>' +
      (s.peran === 'admin' ? this.kartuSerentak() : '') +
      '<div class="card"><div class="t-sm muted" style="margin-bottom:12px">Masuk sebagai <b>' + esc(s.nama || '-') + '</b> (' + esc(s.peran || '-') + '). Setiap baris harus ✅ — termasuk yang <i>seharusnya ditolak</i>.</div><div class="list" data-hasil></div><div class="mt12" data-ringkas></div></div>';
    const box = $('[data-hasil]', el);
    const tampil = (nama, harap, ok, ket) => {
      box.insertAdjacentHTML('beforeend', '<div class="item"><span style="font-size:18px">' + (ok ? '✅' : '❌') + '</span><div class="grow"><div class="semi t-sm">' + esc(nama) + '</div><div class="t-xs muted">Harapan: ' + esc(harap) + (ket ? ' · ' + esc(ket) : '') + '</div></div></div>');
      return ok;
    };
    const jalan = async () => {
      box.innerHTML = ''; $('[data-ringkas]', el).innerHTML = '';
      let lulus = 0, total = 0;
      const uji = async (nama, harap, fn) => {
        total++;
        try { const ket = await fn(); if (harap === 'ditolak') { tampil(nama, harap, false, 'ternyata diizinkan'); return; } if (tampil(nama, harap, true, ket || '')) lulus++; }
        catch (e) {
          const tolak = e && (e.code === 'permission-denied' || /permission|insufficient/i.test(e.message || ''));
          if (harap === 'ditolak' && tolak) { tampil(nama, harap, true, 'ditolak aturan keamanan'); lulus++; }
          else tampil(nama, harap, false, (e && (e.code || e.message)) || String(e));
        }
      };
      const db = () => this.db;
      await uji('Memuat Firebase SDK', 'berhasil', async () => { await this.muat(); return 'versi ' + this.VER; });
      let klaim = {};
      await uji('Masuk Firebase (' + (Sesi.token() ? 'jalur server' : 'login langsung') + ')', 'berhasil', async () => {
        const u = await this.pastikanMasuk();
        klaim = (await u.getIdTokenResult(true)).claims;
        if (klaim.peran !== s.peran) throw new Error('peran token "' + klaim.peran + '" ≠ sesi "' + s.peran + '"');
        return 'uid ' + u.uid + ' · peran ' + klaim.peran;
      });
      await uji('Baca pengaturan/umum (identitas aplikasi)', 'berhasil', async () => { const d = await db().doc('pengaturan/umum').get(); return d.exists ? 'ada' : 'dokumen belum ada'; });
      await uji('Baca data admin (sandi)', 'ditolak', async () => { await db().collection('admin').limit(1).get(); });
      if (s.peran === 'admin') {
        await uji('Daftar pelatihan', 'berhasil', async () => (await db().collection('pelatihan').limit(20).get()).size + ' dokumen');
        await uji('Daftar pendaftaran', 'berhasil', async () => (await db().collection('pendaftaran').limit(50).get()).size + ' dokumen');
        await uji('Baca PIN peserta (akun_umkm)', 'berhasil', async () => (await db().collection('akun_umkm').limit(5).get()).size + ' dokumen');
        await uji('Baca hasil evaluasi', 'berhasil', async () => (await db().collection('evaluasi_jawaban').limit(5).get()).size + ' dokumen');
        await uji('Tulis & hapus tugas uji (aturan tugas)', 'berhasil', async () => {
          const p = (await db().collection('pelatihan').limit(1).get()).docs[0];
          if (!p) return 'lewati — belum ada pelatihan';
          const ref = db().collection('tugas').doc('uji_' + Date.now());
          await ref.set({ id_tugas: ref.id, id_pelatihan: p.id, judul: 'Uji', instruksi: 'uji', batas_waktu: '', dibuat_oleh: String(s.id), id_lampiran: '', nama_lampiran: '', tipe_lampiran: '' });
          await ref.delete(); return 'ok';
        });
        await uji('Tulis & hapus log uji', 'berhasil', async () => {
          const ref = db().collection('log').doc('uji_' + Date.now());
          await ref.set({ waktu: UI.hariIni(), peran: 'admin', id_pengguna: String(s.id), nama: s.nama || '', aksi: 'Uji Firebase' });
          await ref.delete(); return 'ok';
        });
      } else if (s.peran === 'instruktur') {
        await uji('Pelatihan yang diampu', 'berhasil', async () => (await db().collection('pelatihan').where('id_instruktur', '==', String(s.id)).get()).size + ' dokumen');
        await uji('Peserta pelatihan yang diampu', 'berhasil', async () => (await db().collection('pendaftaran').where('id_instruktur', '==', String(s.id)).limit(50).get()).size + ' dokumen');
        await uji('Semua pelatihan (termasuk milik instruktur lain)', 'ditolak', async () => { await db().collection('pelatihan').limit(50).get(); });
        await uji('Tulis & hapus tugas uji di pelatihan yang diampu', 'berhasil', async () => {
          const p = (await db().collection('pelatihan').where('id_instruktur', '==', String(s.id)).limit(1).get()).docs[0];
          if (!p) return 'lewati — belum mengampu pelatihan';
          const ref = db().collection('tugas').doc('uji_' + Date.now());
          await ref.set({ id_tugas: ref.id, id_pelatihan: p.id, judul: 'Uji', instruksi: 'uji', batas_waktu: '', dibuat_oleh: String(s.id), id_lampiran: '', nama_lampiran: '', tipe_lampiran: '' });
          await ref.delete(); return 'ok';
        });
        await uji('Baca PIN peserta', 'ditolak', async () => { await db().collection('akun_umkm').limit(1).get(); });
        await uji('Baca hasil evaluasi', 'ditolak', async () => { await db().collection('evaluasi_jawaban').limit(1).get(); });
      } else {
        let reg = null;
        await uji('Pendaftaran milik sendiri', 'berhasil', async () => { const q = await db().collection('pendaftaran').where('id_umkm', '==', String(s.id)).get(); reg = q.docs[0] ? q.docs[0].data() : null; return q.size + ' pelatihan'; });
        await uji('Profil UMKM sendiri', 'berhasil', async () => { const d = await db().doc('umkm/' + s.id).get(); return d.exists ? d.data().nama_umkm : 'belum ada'; });
        await uji('Profil UMKM lain', 'ditolak', async () => { await db().collection('umkm').limit(5).get(); });
        await uji('Pendaftaran peserta lain', 'ditolak', async () => { await db().collection('pendaftaran').limit(5).get(); });
        await uji('Baca PIN sendiri (pemeriksaan login langsung)', 'berhasil', async () => { const d = await db().doc('akun_umkm/' + s.id).get(); return d.exists ? 'ada' : 'belum ada'; });
        await uji('Baca PIN peserta lain', 'ditolak', async () => { await db().collection('akun_umkm').limit(3).get(); });
        if (reg) {
          await uji('Detail pelatihan yang diikuti', 'berhasil', async () => (await db().doc('pelatihan/' + reg.id_pelatihan).get()).data().judul);
          await uji('Soal pelatihan yang diikuti (tanpa kunci)', 'berhasil', async () => (await db().collection('soal').where('id_pelatihan', '==', reg.id_pelatihan).get()).size + ' soal');
          await uji('Kunci jawaban', 'ditolak', async () => { await db().doc('kunci_soal/' + reg.id_pelatihan).get(); });
        }
      }
      const tolak = (window.FSD && FSD.izinDitolak) || [];
      $('[data-ringkas]', el).innerHTML = '<div class="card well tight row between"><span class="semi">' + lulus + ' dari ' + total + ' uji berhasil</span>' + (lulus === total ? '<span class="chip ok">Siap lanjut</span>' : '<span class="chip bad">Perlu diperiksa</span>') + '</div>' +
        (tolak.length ? '<div class="card well tight mt12"><div class="semi t-sm">Penyimpanan yang dialihkan ke server (sesi ini)</div>' + tolak.slice(0, 10).map(x => '<div class="t-xs muted mt8">' + esc(x.waktu) + ' · ' + esc(x.action) + ' — ' + esc(x.pesan) + '</div>').join('') + '</div>' : '');
    };
    $('[data-ulang]', el).onclick = e => UI.sibuk(e.currentTarget, jalan);
    if (s.peran === 'admin') this.pasangSerentak(el);
    const bm = $('[data-mode]', el);
    if (bm) bm.onclick = () => {
      const ke = API.modeFB() ? '' : 'firebase';
      try { if (ke) localStorage.setItem('rl_mode', ke); else localStorage.removeItem('rl_mode'); } catch (e) { }
      Simpan.hapusSemua();
      location.hash = '#/'; location.reload();
    };
    jalan();
  }
};
