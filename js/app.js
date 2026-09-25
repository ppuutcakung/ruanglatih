/* =============================================================
   RuangLatih — app.js
   Pintu masuk aplikasi: halaman masuk 3 peran, ganti PIN wajib,
   kerangka tampilan per peran, dan router berbasis hash (#/...).
   ============================================================= */
var App = {
  _shell: '', _server: null, _nav: 0,

  modul() { const u = Sesi.user(); return u ? { peserta: Peserta, instruktur: Instruktur, admin: Admin }[u.peran] : null; },
  awal() { const u = Sesi.user(); return u && u.peran === 'peserta' ? 'beranda' : 'dasbor'; },
  linkWA(teks) { return 'https://wa.me/' + APP_CONFIG.waAdmin + '?text=' + encodeURIComponent(teks || 'Halo Admin PPU, saya butuh bantuan akun RuangLatih.'); },

  async cekServer() {
    if (this._server) return this._server;
    try {
      const r = await fetch(GAS_URL, { method: 'GET', redirect: 'follow' });
      this._server = await r.json();
    } catch (e) { this._server = null; }
    return this._server;
  },

  /** Tautan dari scan QR absensi: #/absen/<id_pelatihan>/<kode> */
  ruteQR() { const m = location.hash.match(/^#\/absen\/([^/?]+)\/([^/?]+)/); return m ? { id: decodeURIComponent(m[1]), kode: decodeURIComponent(m[2]) } : null; },

  render() {
    const qr = this.ruteQR();
    if (qr) return this.halamanAbsenQR(qr.id, qr.kode);
    const u = Sesi.user();
    if (!u) return this.halamanMasuk();
    if (u.peran === 'peserta' && u.wajib_ganti_pin) return this.halamanGantiPin();
    this.tampil();
  },

  keMasuk(pesan) {
    Sesi.clear();
    this._shell = '';
    $$('.overlay').forEach(o => o.remove());
    document.body.style.overflow = '';
    history.replaceState(null, '', location.pathname + location.search);
    this.halamanMasuk(pesan);
  },

  async keluar() {
    if (!await UI.konfirmasi('Keluar dari RuangLatih di perangkat ini?', { ok: 'Keluar' })) return;
    sessionStorage.clear();
    this.keMasuk();
    UI.toast('Anda sudah keluar.', 'info');
  },

  setBadge(kunci, n) {
    const a = $('.nav a[data-nav="' + kunci + '"]');
    if (!a) return;
    let b = $('.badge-count', a);
    if (!n) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('span'); b.className = 'badge-count'; a.appendChild(b); }
    b.textContent = n > 99 ? '99+' : n;
  },

  // ===========================================================
  // KOTAK PIN 4 ANGKA
  // ===========================================================
  kotakPin(nama) {
    return '<div class="pin-boxes" data-pin="' + nama + '">' + [0, 1, 2, 3].map(i => '<input type="tel" inputmode="numeric" maxlength="1" autocomplete="off" aria-label="Angka PIN ke-' + (i + 1) + '">').join('') + '</div>';
  },
  pasangPin(host) {
    const ins = $$('input', host);
    ins.forEach((x, i) => {
      x.addEventListener('input', () => {
        const v = x.value.replace(/\D/g, '');
        if (v.length > 1) { v.split('').slice(0, 4 - i).forEach((c, j) => ins[i + j].value = c); (ins[Math.min(3, i + v.length)]).focus(); return; }
        x.value = v;
        if (v && i < 3) ins[i + 1].focus();
      });
      x.addEventListener('keydown', e => { if (e.key === 'Backspace' && !x.value && i) { ins[i - 1].focus(); ins[i - 1].value = ''; } });
      x.addEventListener('paste', e => {
        const t = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 4);
        if (!t) return;
        e.preventDefault();
        t.split('').forEach((c, j) => ins[j] && (ins[j].value = c));
        ins[Math.min(3, t.length)].focus();
      });
    });
    return { nilai: () => ins.map(x => x.value).join(''), kosongkan: () => { ins.forEach(x => x.value = ''); ins[0].focus(); }, fokus: () => ins[0].focus() };
  },

  kerangkaAuth(judul, sub, isi) {
    return '<div class="auth"><div class="auth-hero"><div class="top"><div class="logo-tile">' + UI.ic('cap', 'lg') + '</div><span class="pill-glass" data-srv>' + esc(APP_CONFIG.singkat) + '</span></div>' +
      '<h1>' + esc(judul) + '</h1><p>' + esc(sub) + '</p></div><div class="auth-card"><div class="card" style="padding:24px">' + isi + '</div></div>' +
      '<div class="auth-foot"><div class="row g8">' + UI.ic('shield', 'sm') + 'Data tersimpan aman di Google Workspace</div>' + esc(APP_CONFIG.lembaga) + '</div></div>';
  },

  // ===========================================================
  // HALAMAN MASUK
  // ===========================================================
  halamanMasuk(pesan) {
    this._shell = '';
    const app = $('#app');
    let peran = localStorage.getItem('rl_peran') || 'peserta';
    app.innerHTML = this.kerangkaAuth(APP_CONFIG.nama, 'Pusat Pendampingan UMKM Cakung',
      '<div class="seg" data-peran>' + [['peserta', 'Peserta UMKM'], ['instruktur', 'Instruktur'], ['admin', 'Super Admin']].map(x => '<button type="button" data-v="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>' +
      '<form class="col g20 mt20" data-form novalidate></form>');
    const form = $('[data-form]', app);
    let pin = null;
    const gambar = () => {
      $$('[data-peran] button', app).forEach(b => b.classList.toggle('on', b.dataset.v === peran));
      let f;
      if (peran === 'peserta') f =
        '<div class="field"><label for="m_umkm">Nama UMKM / Usaha</label><div class="input-ic">' + UI.ic('store') + '<input class="input" id="m_umkm" autocomplete="username" autocapitalize="words" spellcheck="false" placeholder="mis. Dapur Berkah Bu Ani" value="' + esc(localStorage.getItem('rl_umkm') || '') + '"></div><div class="hint">Tulis sesuai nama usaha yang didaftarkan di PPU. Huruf besar/kecil tidak berpengaruh.</div></div>' +
        '<div class="field"><div class="row between"><span class="lbl">PIN 4 angka</span><button type="button" class="link" data-lihat>' + UI.ic('eye', 'sm') + '<span>Lihat PIN</span></button></div>' + this.kotakPin('pin') + '</div>';
      else if (peran === 'instruktur') f =
        '<div class="field"><label for="m_nama">Nama instruktur</label><div class="input-ic">' + UI.ic('user') + '<input class="input" id="m_nama" autocomplete="name" placeholder="Nama lengkap sesuai data PPU" value="' + esc(localStorage.getItem('rl_nama') || '') + '"></div></div>' +
        '<div class="field"><label for="m_kode">Kode akses</label><div class="input-ic">' + UI.ic('key') + '<input class="input" id="m_kode" autocapitalize="characters" autocomplete="off" placeholder="mis. INS-2026"></div></div>';
      else f =
        '<div class="field"><label for="m_user">Username</label><div class="input-ic">' + UI.ic('user') + '<input class="input" id="m_user" autocapitalize="none" autocomplete="username" placeholder="admin"></div></div>' +
        '<div class="field"><label for="m_pw">Kata sandi</label><div class="input-ic">' + UI.ic('lock') + '<input class="input" id="m_pw" type="password" autocomplete="current-password"></div></div>';
      form.innerHTML = f + '<div class="err" data-err' + (pesan ? '' : ' hidden') + '>' + esc(pesan || '') + '</div>' +
        '<button class="btn primary block" type="submit" data-masuk style="height:50px">Masuk' + UI.ic('chevR', 'sm') + '</button>' +
        (peran === 'peserta' ? '<a class="btn ghost block" href="' + this.linkWA('Halo Admin PPU, saya lupa PIN / nama login RuangLatih. Nama UMKM: ') + '" target="_blank" rel="noopener">' + UI.ic('message', 'sm') + 'Lupa PIN? Hubungi Admin</a>' : '');
      pesan = '';
      if (peran === 'peserta') {
        pin = this.pasangPin($('[data-pin]', form));
        $('[data-lihat]', form).onclick = e => {
          const box = $('[data-pin]', form), on = box.classList.toggle('show');
          e.currentTarget.innerHTML = UI.ic(on ? 'eyeOff' : 'eye', 'sm') + '<span>' + (on ? 'Sembunyikan' : 'Lihat PIN') + '</span>';
        };
      }
    };
    $('[data-peran]', app).onclick = e => { const b = e.target.closest('button'); if (!b) return; peran = b.dataset.v; localStorage.setItem('rl_peran', peran); gambar(); };
    form.onsubmit = async e => {
      e.preventDefault();
      const err = $('[data-err]', form), btn = $('[data-masuk]', form);
      err.hidden = true;
      let data;
      if (peran === 'peserta') {
        const nm = $('#m_umkm').value.trim().replace(/\s+/g, ' '), p = pin.nilai();
        if (!nm) { err.textContent = 'Isi nama UMKM / usaha Anda.'; err.hidden = false; return; }
        if (!/^\d{4}$/.test(p)) { err.textContent = 'Isi PIN 4 angka.'; err.hidden = false; return; }
        data = { peran: 'peserta', nama_umkm: nm, pin: p };
        localStorage.setItem('rl_umkm', nm);
      } else if (peran === 'instruktur') {
        data = { peran: 'instruktur', nama: $('#m_nama').value.trim(), kode: $('#m_kode').value.trim() };
        localStorage.setItem('rl_nama', data.nama);
      } else data = { peran: 'admin', username: $('#m_user').value.trim(), password: $('#m_pw').value };
      try {
        await UI.sibuk(btn, async ubah => {
          const r = await API.call('login', data, { onRetry: n => ubah('Server sibuk, mencoba lagi (' + n + ')…') });
          Sesi.set({ token: r.token, user: r.user });
        }, 'Memeriksa…');
        location.hash = '#/' + this.awal();
        this.render();
        UI.toast('Selamat datang, ' + UI.sapaan(Sesi.user().nama) + '!');
        setTimeout(() => API.panaskan(), 400); // ⚡ siapkan data semua menu di latar
      } catch (ex) {
        err.textContent = ex.message; err.hidden = false;
        if (pin) pin.kosongkan();
      }
    };
    gambar();
    this.cekServer().then(h => {
      const s = $('[data-srv]', app);
      if (!s) return;
      if (!h) { s.textContent = 'Server belum terhubung'; }
      else if (!h.siap) s.textContent = 'Server belum di-setup';
      else s.textContent = 'Server Aktif';
    });
  },

  // ===========================================================
  // GANTI PIN (wajib saat pertama masuk)
  // ===========================================================
  halamanGantiPin() {
    this._shell = '';
    const u = Sesi.user();
    const app = $('#app');
    app.innerHTML = this.kerangkaAuth('Buat PIN Baru', 'Halo ' + UI.sapaan(u.nama) + ', demi keamanan ganti PIN awal dari admin.',
      '<form class="col g20" data-form novalidate><div class="field"><label>PIN awal dari admin</label>' + this.kotakPin('lama') + '</div>' +
      '<div class="field"><label>PIN baru (4 angka)</label>' + this.kotakPin('baru') + '</div>' +
      '<div class="field"><label>Ulangi PIN baru</label>' + this.kotakPin('ulang') + '</div>' +
      '<div class="hint">Hindari PIN mudah ditebak seperti 1234 atau tanggal lahir.</div>' +
      '<div class="err" hidden data-err></div><button class="btn primary block" type="submit" data-kirim style="height:50px">Simpan PIN & Masuk</button>' +
      '<button class="btn ghost block" type="button" data-keluar>Keluar</button></form>');
    const f = $('[data-form]', app);
    const P = { lama: this.pasangPin($('[data-pin="lama"]', f)), baru: this.pasangPin($('[data-pin="baru"]', f)), ulang: this.pasangPin($('[data-pin="ulang"]', f)) };
    P.lama.fokus();
    $('[data-keluar]', f).onclick = () => this.keMasuk();
    f.onsubmit = async e => {
      e.preventDefault();
      const err = $('[data-err]', f);
      err.hidden = true;
      const lama = P.lama.nilai(), baru = P.baru.nilai(), ulang = P.ulang.nilai();
      const salah = !/^\d{4}$/.test(lama) ? 'Isi PIN awal 4 angka.' : !/^\d{4}$/.test(baru) ? 'Isi PIN baru 4 angka.' : baru !== ulang ? 'Ulangan PIN baru tidak sama.' : baru === lama ? 'PIN baru harus berbeda dari PIN awal.' : '';
      if (salah) { err.textContent = salah; err.hidden = false; return; }
      try {
        await UI.sibuk($('[data-kirim]', f), async () => {
          const r = await API.call('ganti_pin', { pin_lama: lama, pin_baru: baru });
          Sesi.set({ token: r.token, user: r.user });
          UI.toast(r.message);
        }, 'Menyimpan…');
        location.hash = '#/beranda';
        this.render();
        setTimeout(() => API.panaskan(), 400);
      } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    };
  },

  /** Ganti PIN sukarela dari halaman Profil. */
  modalGantiPin() {
    const a = 'inputmode="numeric" maxlength="4" autocomplete="off"';
    UI.form({
      title: 'Ganti PIN', submit: 'Simpan PIN',
      fields: [{ name: 'lama', label: 'PIN lama', type: 'password', attrs: a, full: true }, { name: 'baru', label: 'PIN baru (4 angka)', type: 'password', attrs: a }, { name: 'ulang', label: 'Ulangi PIN baru', type: 'password', attrs: a }],
      onSubmit: async v => {
        if (!/^\d{4}$/.test(v.baru)) throw new Error('PIN baru harus 4 angka.');
        if (v.baru !== v.ulang) throw new Error('Ulangan PIN baru tidak sama.');
        const r = await API.call('ganti_pin', { pin_lama: v.lama, pin_baru: v.baru });
        Sesi.set({ token: r.token, user: r.user });
        UI.toast(r.message);
      }
    });
  },

  // ===========================================================
  // ABSENSI VIA SCAN QR (tanpa login)
  // ===========================================================
  async halamanAbsenQR(id, kode) {
    this._shell = ''; this._qr = true;
    $$('.overlay').forEach(o => o.remove());
    const app = $('#app');
    app.innerHTML = this.kerangkaAuth('Absensi Pelatihan', 'Pusat Pendampingan UMKM Cakung', '<div data-qr></div>');
    const box = $('[data-qr]', app);
    UI.loading(box, 2);
    let d;
    try { d = await API.call('qr_info', { id_pelatihan: id, kode: kode }, { retry: 5 }); }
    catch (e) {
      box.innerHTML = '<div class="empty"><div class="ic-tile" style="background:var(--bad-bg);color:var(--bad)">' + UI.ic('alert', 'lg') + '</div><div class="semi">QR tidak dapat dipakai</div><div class="t-sm">' + esc(e.message) + '</div></div>' +
        '<a class="btn outline block mt12" href="#/">Buka RuangLatih</a>';
      return;
    }
    const bisa = d.hari.filter(h => h.buka);
    let hari = (d.hari.find(h => h.hari_ini && h.buka) || bisa[0] || {}).hari_ke || 0;
    const nmU = localStorage.getItem('rl_qr_umkm') || localStorage.getItem('rl_umkm') || '';
    const nmP = localStorage.getItem('rl_qr_peserta') || '';
    box.innerHTML = '<div class="center" style="margin-bottom:16px"><div class="chip solid sm" style="margin-bottom:8px">' + UI.ic('checkSquare', 'sm') + 'Scan Absensi</div>' +
      '<div class="h-md">' + esc(d.judul) + '</div><div class="col g4 t-sm muted mt8" style="align-items:center"><span class="row g4">' + UI.ic('clock', 'sm') + esc(d.jam || '-') + '</span>' +
      '<span class="row g4">' + UI.ic(d.format === 'online' ? 'link' : 'pin', 'sm') + '<span class="clamp1">' + esc(d.format === 'online' ? 'Online' : d.lokasi) + '</span></span><span class="row g4">' + UI.ic('user', 'sm') + esc(d.instruktur) + '</span></div></div>' +
      (bisa.length ? '<form class="col g20" data-form novalidate>' +
        '<div class="field"><span class="lbl">Pilih hari sesi</span><div class="seg" data-hari>' + d.hari.map(h => '<button type="button" data-v="' + h.hari_ke + '" class="' + (h.hari_ke === hari ? 'on' : '') + '"' + (h.buka ? '' : ' disabled style="opacity:.45"') + '>Hari ' + h.hari_ke + '<br><small style="font-weight:500">' + esc(UI.tglPendek(h.tanggal)) + (h.buka ? '' : ' · belum dibuka') + '</small></button>').join('') + '</div></div>' +
        '<div class="field"><label for="q_umkm">Nama UMKM / Usaha</label><div class="input-ic">' + UI.ic('store') + '<input class="input" id="q_umkm" autocomplete="organization" autocapitalize="words" spellcheck="false" placeholder="mis. Dapur Berkah Bu Ani" value="' + esc(nmU) + '"></div></div>' +
        '<div class="field"><label for="q_peserta">Nama Peserta</label><div class="input-ic">' + UI.ic('user') + '<input class="input" id="q_peserta" autocomplete="name" autocapitalize="words" placeholder="Nama Anda yang didaftarkan" value="' + esc(nmP) + '"></div></div>' +
        '<div class="err" hidden data-err></div><button class="btn primary block" type="submit" data-kirim style="height:52px">' + UI.ic('hand') + 'Kirim Absensi</button></form>'
        : '<div class="card well center t-sm">' + UI.ic('lock', 'sm') + ' Absensi untuk pelatihan ini belum dibuka. Silakan hubungi panitia.</div>');
    const seg = $('[data-hari]', box);
    if (seg) seg.style.cssText += ';height:auto';
    $$('[data-hari] button', box).forEach(b => { b.style.height = 'auto'; b.style.padding = '8px 6px'; b.style.lineHeight = '1.3'; });
    if (seg) seg.onclick = e => { const b = e.target.closest('button'); if (!b || b.disabled) return; hari = +b.dataset.v; $$('button', seg).forEach(x => x.classList.toggle('on', x === b)); };
    const f = $('[data-form]', box);
    if (!f) return;
    f.onsubmit = async e => {
      e.preventDefault();
      const err = $('[data-err]', f), btn = $('[data-kirim]', f);
      const nu = $('#q_umkm').value.trim().replace(/\s+/g, ' '), np = $('#q_peserta').value.trim().replace(/\s+/g, ' ');
      err.hidden = true;
      const salah = !hari ? 'Pilih hari sesi.' : !nu ? 'Isi nama UMKM / usaha.' : !np ? 'Isi nama peserta.' : '';
      if (salah) { err.textContent = salah; err.hidden = false; return; }
      try {
        let r;
        await UI.sibuk(btn, async ubah => {
          r = await API.call('qr_absen', { id_pelatihan: id, kode: kode, hari_ke: hari, nama_umkm: nu, nama_peserta: np }, { retry: 8, onRetry: n => ubah('Antrean ramai, mencoba lagi (' + n + ')…') });
        }, 'Mengirim…');
        localStorage.setItem('rl_qr_umkm', nu); localStorage.setItem('rl_qr_peserta', np);
        box.innerHTML = '<div class="center col g8" style="padding:8px 0"><div class="ic-tile" style="width:72px;height:72px;border-radius:50%;background:var(--ok-bg);color:var(--ok);margin:0 auto">' + UI.ic('checkCircle', 'lg') + '</div>' +
          '<div class="h-md mt8">' + (r.sudah ? 'Sudah Tercatat Hadir' : 'Absensi Berhasil!') + '</div><div class="t-sm muted">' + esc(r.judul) + '</div>' +
          '<div class="card well tight mt12" style="text-align:left"><dl class="kv"><dt>Hari</dt><dd>Hari ' + r.hari_ke + ' · ' + esc(UI.tglHari(r.tanggal)) + '</dd><dt>UMKM</dt><dd>' + esc(r.nama_umkm) + '</dd><dt>Peserta</dt><dd>' + esc(r.nama_peserta) + '</dd><dt>Jam</dt><dd>' + esc(UI.jam(r.waktu)) + ' WIB</dd></dl></div>' +
          '<div class="t-sm muted mt8">' + (r.sudah ? 'Absensi Anda sudah tercatat sebelumnya.' : 'Terima kasih, selamat mengikuti pelatihan. Anda tidak perlu absen lagi di aplikasi.') + '</div>' +
          '<a class="btn primary block mt12" href="#/">' + UI.ic('home', 'sm') + 'Buka Aplikasi RuangLatih</a></div>';
      } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    };
  },

  // ===========================================================
  // KERANGKA TAMPILAN PER PERAN
  // ===========================================================
  kerangka() {
    const u = Sesi.user(), M = this.modul(), app = $('#app');
    if (this._shell === u.peran + u.id) return;
    this._shell = u.peran + u.id;
    if (u.peran === 'peserta') {
      app.innerHTML = '<div class="m-app"><main data-hal></main><nav class="bnav" aria-label="Menu utama">' +
        M.nav.map(n => '<a href="#/' + n[0] + '" data-nav="' + n[0] + '"><span class="pill">' + UI.ic(n[1]) + '</span>' + n[2] + '</a>').join('') + '</nav></div>';
      app.onclick = e => { if (e.target.closest('[data-menu]')) Peserta.menu(); };
      return;
    }
    const admin = u.peran === 'admin';
    app.innerHTML = '<div class="d-app"><div class="side-overlay" data-tutupnav></div><aside class="side">' +
      '<div class="brand"><div class="logo">' + UI.ic('cap', 'lg') + '</div><div><b>' + esc(APP_CONFIG.nama) + '</b><small>' + esc(admin ? M.subjudul : 'Portal Instruktur') + '</small></div></div>' +
      '<nav class="nav col g4">' + M.nav.map(n => '<a href="#/' + n[0] + '" data-nav="' + n[0] + '">' + UI.ic(n[1]) + '<span>' + n[2] + '</span></a>').join('') +
      '<a href="#" data-bantuan>' + UI.ic('help') + '<span>Bantuan & Dokumentasi</span></a></nav>' +
      '<div class="me"><div class="av">' + esc(UI.inisial(u.nama)) + '</div><div class="grow"><div class="semi t-sm clamp1">' + esc(u.nama) + '</div><div class="t-xs muted">' + (admin ? 'Super Admin' : 'Instruktur') + '</div></div>' +
      '<button class="btn icon sm ghost" data-keluar title="Keluar" aria-label="Keluar">' + UI.ic('logout', 'sm') + '</button></div></aside>' +
      '<div class="main"><header class="topbar"><button class="btn icon ghost only-m" data-bukanav aria-label="Menu">' + UI.ic('menu') + '</button>' +
      (admin ? '<form class="search input-ic" data-cari>' + UI.ic('search', 'sm') + '<input class="input" type="search" placeholder="Cari data peserta, materi, pelatihan…"></form>' : '<div class="grow"></div>') +
      '<span class="chip line hide-m" data-srv>' + UI.ic('refresh', 'sm') + 'Memeriksa server…</span>' +
      '<span class="chip hide-m">' + UI.ic('calendar', 'sm') + esc(UI.tglPendek(UI.hariIni())) + '</span></header><main class="content" data-hal></main></div></div>';
    const d = $('.d-app', app);
    app.onclick = e => {
      if (e.target.closest('[data-bukanav]')) d.classList.add('nav-open');
      else if (e.target.closest('[data-tutupnav]')) d.classList.remove('nav-open');
      else if (e.target.closest('[data-keluar]')) this.keluar();
      else if (e.target.closest('[data-bantuan]')) { e.preventDefault(); this.bantuan(); }
    };
    const cari = $('[data-cari]', app);
    if (cari) cari.onsubmit = e => { e.preventDefault(); const q = $('input', cari).value.trim(); location.hash = '#/cari/' + encodeURIComponent(q); };
    this.cekServer().then(h => {
      const s = $('[data-srv]', app);
      if (!s) return;
      s.className = 'chip hide-m ' + (h && h.siap ? 'ok dot' : 'bad');
      s.textContent = h && h.siap ? (admin ? 'Sistem Siaga (Server Aktif)' : 'Google Drive & Sheets Terhubung') : 'Server tidak terhubung';
    });
  },

  bantuan() {
    const admin = (Sesi.user() || {}).peran === 'admin';
    UI.modal({
      title: 'Bantuan & Dokumentasi', wide: true,
      body: '<div class="col g20 t-sm" style="font-size:14px;line-height:1.7">' + (admin
        ? '<div><b>Alur satu pelatihan</b><br>1) Pelatihan → Buat Pelatihan (pilih 1 atau 2 hari). 2) Daftarkan UMKM ke pelatihan. 3) Instruktur mengunggah materi, soal, dan tugas. 4) Saat hari-H buka Absensi dan Pre-test dari Dashboard atau detail pelatihan. 5) Tutup dengan Post-test, Tugas, lalu Evaluasi. 6) Sertifikat → Terbitkan untuk peserta yang lulus. 7) Laporan Rekap → unduh Excel/PDF.</div>' +
          '<div><b>Akun peserta</b><br>Peserta masuk memakai <b>Nama UMKM/Usaha</b> + PIN 4 angka dan wajib mengganti PIN awal. Nama UMKM harus unik. Bila lupa PIN atau terkunci (5 kali salah), buka Peserta → tombol kunci untuk reset PIN, lalu kirim lewat WhatsApp.</div>' +
          '<div><b>Template</b><br>Sertifikat: Google Slides/PPTX 1 halaman dengan penanda {{nama_umkm}} {{nama_pemilik}} {{judul_pelatihan}} {{tanggal_pelatihan}} {{no_sertifikat}}. Laporan: Google Sheets dengan penanda {{tabel}} (atur di Pengaturan).</div>'
        : '<div><b>Tugas instruktur</b><br>1) Pilih pelatihan di pojok kanan atas setiap halaman. 2) Bank Materi → unggah PDF (maks 50 MB, bisa beberapa sekaligus). 3) Pre/Post Test → susun soal pilihan ganda A–E dan kunci jawaban. 4) Periksa Tugas → lihat berkas peserta, beri skor 0–100 dan catatan. 5) Rekap Nilai → pantau kenaikan pre ke post.</div>' +
          '<div><b>Catatan</b><br>Pembukaan absensi, tes, tugas, dan evaluasi diatur oleh admin PPU. Hasil evaluasi kepuasan hanya dapat dilihat admin.</div>') +
        '<div><b>Butuh bantuan?</b><br><a href="' + this.linkWA() + '" target="_blank" rel="noopener">Hubungi admin PPU via WhatsApp</a></div></div>'
    });
  },

  // ===========================================================
  // ROUTER
  // ===========================================================
  async tampil() {
    const u = Sesi.user();
    if (!u) return this.halamanMasuk();
    this.kerangka();
    const M = this.modul();
    const bagian = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    let r = bagian[0] || this.awal();
    if (!M.rute[r]) r = this.awal();
    const args = bagian.slice(1).map(x => { try { return decodeURIComponent(x); } catch (e) { return x; } });
    const aktif = M.navAktif ? M.navAktif(r) : r;
    $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === aktif));
    const d = $('.d-app');
    if (d) d.classList.remove('nav-open');
    $$('.overlay').forEach(o => o.remove());
    document.body.style.overflow = '';
    const hal = $('[data-hal]');
    const wadah = document.createElement('div');
    wadah.className = u.peran === 'peserta' ? '' : 'col g28';
    hal.innerHTML = '';
    hal.appendChild(wadah);
    window.scrollTo(0, 0);
    const judul = (M.nav.find(n => n[0] === aktif) || [, , ''])[2];
    document.title = (judul ? judul + ' · ' : '') + APP_CONFIG.nama;
    try { await M.rute[r](wadah, args); }
    catch (e) { if (wadah.isConnected) UI.galat(wadah, e, () => this.tampil()); }
  },

  mulai() {
    window.addEventListener('hashchange', () => {
      if (this.ruteQR()) return this.render();
      if (this._qr) { this._qr = false; return this.render(); }
      if (Sesi.user() && !(Sesi.user().peran === 'peserta' && Sesi.user().wajib_ganti_pin)) this.tampil();
    });
    if (!GAS_URL || GAS_URL.indexOf('TEMPEL_') >= 0) {
      $('#app').innerHTML = this.kerangkaAuth(APP_CONFIG.nama, 'Konfigurasi belum lengkap',
        '<div class="col"><div class="h-sm">GAS_URL belum diisi</div><div class="t-sm muted">Buka file <b>js/config.js</b>, tempel URL Web App Apps Script (berakhiran <b>/exec</b>), simpan, lalu unggah ulang ke GitHub. Lihat PANDUAN-INSTALASI.md.</div></div>');
      return;
    }
    this.render();
    if (Sesi.user() && !this.ruteQR()) setTimeout(() => API.panaskan(), 600); // ⚡ panaskan data menu di latar
    // Segarkan lagi saat aplikasi dibuka kembali dari latar belakang (HP)
    document.addEventListener('visibilitychange', () => { if (!document.hidden && Sesi.user()) API.panaskanNanti(); });
    // Periksa ulang sesi di latar belakang (akun dinonaktifkan / token kedaluwarsa)
    if (Sesi.user()) API.call('sesi', {}, { retry: 1 }).then(r => {
      const s = Sesi.get();
      if (s && r && r.user) {
        const berubah = s.user.wajib_ganti_pin !== r.user.wajib_ganti_pin;
        Sesi.set({ token: s.token, user: r.user });
        if (berubah) this.render();
      }
    }).catch(() => { });
  }
};

App.mulai();
