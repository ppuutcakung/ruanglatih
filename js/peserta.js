/* =============================================================
   RuangLatih — peserta.js
   Tampilan Peserta UMKM (mobile-first): beranda, pelatihan saya,
   ruang pelatihan (absensi, materi, tugas, pre/post-test,
   evaluasi), bank materi, sertifikat, nilai, profil.
   ============================================================= */
const Peserta = {
  cache: {},
  nav: [['beranda', 'home', 'Beranda'], ['pelatihan', 'cap', 'Pelatihan'], ['materi', 'book', 'Materi'], ['sertifikat', 'award', 'Sertifikat'], ['profil', 'user', 'Profil']],
  navAktif(r) { return { ruang: 'pelatihan', tes: 'pelatihan', evaluasi: 'pelatihan', nilai: 'profil' }[r] || r; },

  rute: {
    beranda: (v, a) => Peserta.beranda(v, a),
    pelatihan: (v, a) => Peserta.pelatihan(v, a),
    ruang: (v, a) => Peserta.ruang(v, a),
    tes: (v, a) => Peserta.tes(v, a),
    evaluasi: (v, a) => Peserta.evaluasi(v, a),
    materi: (v, a) => Peserta.materi(v, a),
    sertifikat: (v, a) => Peserta.sertifikat(v, a),
    nilai: (v, a) => Peserta.nilai(v, a),
    profil: (v, a) => Peserta.profil(v, a)
  },

  user() { return Sesi.user() || {}; },
  panggil(u) { return 'Halo, ' + UI.sapaan(u.nama) + ' 👋'; },

  /** ⚡ Tampil instan dari cache lokal, lalu disegarkan diam-diam (API.ambil). */
  ambil(v, action, data, gambar) { return API.ambil(action, data || {}, d => gambar(d), { el: v }); },
  lupakan() { /* cache dibasikan otomatis setiap aksi tulis */ },

  hero(o) {
    const u = this.user();
    const kiri = o.back ? '<a class="hero-btn" href="' + o.back + '" aria-label="Kembali">' + UI.ic('back') + '</a>' : '<button class="hero-btn" data-menu aria-label="Menu">' + UI.ic('menu') + '</button>';
    return '<header class="hero ' + (o.slim ? 'slim' : '') + '"><div class="hero-top">' + kiri + '<a class="avatar" href="#/profil" aria-label="Profil">' + esc(UI.inisial(u.nama)) + '</a></div>' +
      (o.tag ? '<div class="tag">' + UI.ic('store', 'sm') + esc(o.tag) + '</div>' : '') +
      '<h1>' + esc(o.judul) + '</h1>' + (o.sub ? '<div class="sub">' + o.sub + '</div>' : '') + (o.desc ? '<div class="desc">' + esc(o.desc) + '</div>' : '') + '</header>';
  },
  cari(ph, nilai) {
    return '<div class="float-search"><form class="input-ic" data-cari>' + UI.ic('search') + '<input class="input" type="search" enterkeyhint="search" placeholder="' + esc(ph) + '" value="' + esc(nilai || '') + '"></form></div>';
  },
  pasangCari(v) {
    const f = $('[data-cari]', v);
    if (f) f.onsubmit = e => { e.preventDefault(); const q = $('input', f).value.trim(); location.hash = '#/materi/' + encodeURIComponent(q); };
  },

  menu() {
    const u = this.user();
    const it = (h, ic, t) => '<a class="item" href="' + h + '" data-tutup><div class="ic-tile sm">' + UI.ic(ic, 'sm') + '</div><div class="grow semi">' + t + '</div>' + UI.ic('chevR', 'sm') + '</a>';
    const m = UI.modal({
      title: 'Menu',
      body: '<div class="row" style="margin-bottom:16px"><div class="avatar" style="border-color:var(--blush-3)">' + esc(UI.inisial(u.nama)) + '</div><div><div class="semi">' + esc(u.nama) + '</div><div class="t-sm muted">' + esc(u.umkm) + ' · ' + esc(u.sektor) + '</div></div></div>' +
        '<div class="list">' + it('#/beranda', 'home', 'Beranda') + it('#/pelatihan', 'cap', 'Pelatihan Saya') + it('#/materi', 'book', 'Bank Materi') + it('#/nilai', 'chart', 'Riwayat & Skor Nilai') + it('#/sertifikat', 'award', 'Sertifikat') + it('#/profil', 'user', 'Profil & Ganti PIN') +
        '<a class="item" href="' + App.linkWA('Halo Admin PPU, saya ' + (u.nama || '') + ' (' + (u.umkm || '') + ') butuh bantuan akun RuangLatih.') + '" target="_blank" rel="noopener"><div class="ic-tile sm ok">' + UI.ic('message', 'sm') + '</div><div class="grow semi">Hubungi Admin</div>' + UI.ic('chevR', 'sm') + '</a>' +
        '<button class="item" data-keluar><div class="ic-tile sm" style="background:var(--bad-bg);color:var(--bad)">' + UI.ic('logout', 'sm') + '</div><div class="grow semi c-bad">Keluar</div></button></div>'
    });
    $('[data-keluar]', m.el).onclick = () => { m.close(); App.keluar(); };
  },


  // ===========================================================
  // BERANDA
  // ===========================================================
  async beranda(v) {
    const u = this.user();
    v.innerHTML = this.hero({ judul: 'RuangLatih', sub: esc(this.panggil(u)), desc: 'Semangat kembangkan usahamu hari ini!' }) +
      this.cari('Cari materi, jadwal, atau sertifikat…') + '<div class="m-body" style="margin-top:24px" data-isi></div>';
    this.pasangCari(v);
    const isi = $('[data-isi]', v);
    UI.loading(isi, 3);
    const gambar = d => {
      const akt = d.aktif[0] ? d.aktif[0].id_pelatihan : '';
      const r = t => akt ? '#/ruang/' + akt + '/' + t : '#/pelatihan';
      const q = [['#/pelatihan', 'calendar', 'Jadwal'], [r('absensi'), 'checkSquare', 'Presensi'], ['#/materi', 'book', 'Modul'], [r('tugas'), 'clipboard', 'Tugas'],
        [r('tes'), 'fileQ', 'Pre-Post Test'], ['#/nilai', 'chart', 'Skor Nilai'], [r('evaluasi'), 'edit', 'Evaluasi'], ['#/sertifikat', 'award', 'Sertifikat']];
      isi.innerHTML = '<section><div class="sec-h"><h2>Akses Cepat</h2><a class="link" href="#/pelatihan">Lihat Semua</a></div><div class="quick">' +
        q.map((x, i) => '<a class="q' + (i + 1) + '" href="' + x[0] + '"><span class="qi">' + UI.ic(x[1], 'sm') + '</span>' + x[2] + '</a>').join('') + '</div></section>' +
        '<section><div class="sec-h"><h2>Agenda Pelatihan</h2>' + (d.agenda.length ? '<a class="link" href="#/pelatihan">Semua</a>' : '') + '</div>' +
        (d.agenda.length ? '<div class="card agenda" style="padding:0">' + d.agenda.map(a => {
          const t = UI.tgl(a.tanggal) || new Date();
          const kls = a.label === 'Akan Datang' ? 'warn' : (a.label === 'Selesai' ? 'done' : '');
          return '<a class="agenda-it" href="#/ruang/' + esc(a.id_pelatihan) + '/absensi" style="color:inherit"><div class="date-tile ' + kls + '"><small>' + BLN[t.getMonth()].toUpperCase() + '</small><b>' + t.getDate() + '</b><small style="font-weight:500">' + HARI[t.getDay()].slice(0, 3) + '</small></div>' +
            '<div class="grow"><div class="row between top"><div class="semi clamp2">' + esc(a.judul) + (a.jumlah_hari === 2 ? ' <span class="faint t-xs">· Hari ' + a.hari_ke + '</span>' : '') + '</div>' + UI.chipLabel(a.label) + '</div>' +
            '<div class="meta t-sm mt8" style="font-size:12.5px;color:var(--ink-2);display:flex;flex-direction:column;gap:2px"><span class="row g4">' + UI.ic('clock', 'sm') + esc(a.jam || '-') + '</span><span class="row g4">' + UI.ic(a.format === 'online' ? 'link' : 'pin', 'sm') + '<span class="clamp1">' + esc(a.format === 'online' ? 'Online' : a.lokasi) + '</span></span></div></div></a>';
        }).join('') + '</div>' : '<div class="card">' + UI.kosong('Belum ada agenda pelatihan. Admin PPU akan mendaftarkan Anda ke pelatihan berikutnya.', 'calendar') + '</div>') + '</section>' +
        (d.flyer.length ? '<section><div class="sec-h"><h2>Info Pelatihan</h2></div><div class="flyer-strip">' + d.flyer.map((f, i) =>
          '<button class="flyer" data-flyer="' + i + '" style="text-align:left"><img src="' + esc(f.gambar) + '" alt="Flyer ' + esc(f.judul) + '" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">' +
          '<div class="cap"><span class="chip solid sm" style="margin-bottom:6px">' + UI.ic('megaphone', 'sm') + 'Info Pelatihan</span><div class="semi">' + esc(f.judul) + '</div><div class="t-xs" style="opacity:.85">' + esc(UI.tglPendek(String(f.tanggal).split(' ')[0])) + ' · Ketuk untuk detail</div></div></button>').join('') + '</div></section>' : '');
      $$('[data-flyer]', isi).forEach(b => b.onclick = () => {
        const f = d.flyer[+b.dataset.flyer];
        UI.modal({
          title: 'Info Pelatihan',
          body: '<img src="' + esc(f.gambar) + '" alt="" referrerpolicy="no-referrer" style="width:100%;border-radius:14px;background:var(--blush-2)"><div class="h-sm mt12">' + esc(f.judul) + '</div>' +
            '<div class="col g4 t-sm muted mt8"><span class="row g8">' + UI.ic('calendar', 'sm') + esc(f.tanggal) + '</span><span class="row g8">' + UI.ic('pin', 'sm') + esc(f.lokasi) + '</span></div>',
          foot: '<a class="btn outline" href="' + esc(f.url) + '" target="_blank" rel="noopener">' + UI.ic('eye', 'sm') + 'Gambar penuh</a><a class="btn primary" target="_blank" rel="noopener" href="' + App.linkWA('Halo Admin PPU, saya ' + (u.nama || '') + ' (' + (u.umkm || '') + ') ingin mendaftar pelatihan "' + f.judul + '".') + '">' + UI.ic('message', 'sm') + 'Daftar via Admin</a>'
        });
      });
    };
    try { await this.ambil(v, 'p_beranda', {}, gambar); } catch (e) { UI.galat(isi, e, () => this.beranda(v)); }
  },

  // ===========================================================
  // PELATIHAN SAYA
  // ===========================================================
  async pelatihan(v) {
    v.innerHTML = this.hero({ judul: 'Pelatihan Saya', desc: 'Jadwal, ruang kelas, dan status kelulusan.', slim: true }) + '<div class="m-body" style="margin-top:20px" data-isi></div>';
    const isi = $('[data-isi]', v);
    let filter = sessionStorage.getItem('rl_pfil') || 'aktif';
    UI.loading(isi, 3);
    const gambar = rows => {
      const f = { aktif: r => r.status !== 'selesai', selesai: r => r.status === 'selesai', semua: () => true }[filter];
      const t = rows.filter(f);
      isi.innerHTML = '<div class="seg pill" data-f>' + [['aktif', 'Berjalan & Akan Datang'], ['selesai', 'Selesai'], ['semua', 'Semua']].map(x => '<button data-v="' + x[0] + '" class="' + (filter === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>' +
        (t.length ? '<div class="col">' + t.map(p =>
          '<a class="card" href="#/ruang/' + esc(p.id_pelatihan) + '/absensi" style="color:inherit;display:block"><div class="row between top"><div class="h-sm">' + esc(p.judul) + '</div>' + UI.chipStatus(p.status) + '</div>' +
          '<div class="col g4 t-sm muted mt12"><span class="row g8">' + UI.ic('calendar', 'sm') + esc(UI.rentang(p)) + ' · ' + p.jumlah_hari + ' hari</span><span class="row g8">' + UI.ic('clock', 'sm') + esc(p.jam) + '</span>' +
          '<span class="row g8">' + UI.ic(p.format === 'online' ? 'link' : 'pin', 'sm') + '<span class="clamp1">' + esc(p.format === 'online' ? 'Online' : p.lokasi_atau_link) + '</span></span><span class="row g8">' + UI.ic('user', 'sm') + esc(p.instruktur) + '</span></div>' +
          '<div class="row between mt12" style="border-top:1px solid var(--blush-2);padding-top:12px"><span class="t-sm">Hadir <b>' + p.hadir + '/' + p.jumlah_hari + '</b> hari</span>' +
          (p.status === 'selesai' ? UI.chipLulus(p.lulus) : '<span class="link">Masuk ruang ' + UI.ic('chevR', 'sm') + '</span>') + '</div></a>').join('') + '</div>'
          : '<div class="card">' + UI.kosong(filter === 'selesai' ? 'Belum ada pelatihan yang selesai.' : 'Belum ada pelatihan. Hubungi admin PPU untuk mendaftar.', 'cap') + '</div>');
      $('[data-f]', isi).onclick = e => { const b = e.target.closest('button'); if (b) { filter = b.dataset.v; sessionStorage.setItem('rl_pfil', filter); gambar(rows); } };
    };
    try { await this.ambil(v, 'p_pelatihan', {}, gambar); } catch (e) { UI.galat(isi, e, () => this.pelatihan(v)); }
  },

  // ===========================================================
  // RUANG PELATIHAN
  // ===========================================================
  async ruang(v, a) {
    const id = a[0];
    let tab = a[1] || 'absensi';
    v.innerHTML = this.hero({ judul: 'Ruang Pelatihan', tag: APP_CONFIG.singkat, back: '#/pelatihan', slim: true, desc: ' ' }) + '<div class="m-body" style="margin-top:-14px;position:relative;z-index:2" data-isi></div>';
    const isi = $('[data-isi]', v);
    const tabs = [['absensi', 'checkSquare', 'Absensi'], ['materi', 'book', 'Materi'], ['tugas', 'clipboard', 'Tugas'], ['tes', 'fileQ', 'Pre-Pos Test'], ['evaluasi', 'edit', 'Evaluasi']];
    let d = null;
    UI.loading(isi, 3);
    const gambar = data => {
      d = data;
      $('.hero .desc', v).textContent = d.pelatihan.judul;
      isi.innerHTML = '<nav class="rtabs" data-tabs>' + tabs.map(t => '<button data-v="' + t[0] + '" class="' + (tab === t[0] ? 'on' : '') + '">' + UI.ic(t[1]) + '<span>' + t[2] + '</span></button>').join('') + '</nav><div class="col" data-tab></div>';
      $('[data-tabs]', isi).onclick = e => { const b = e.target.closest('button'); if (!b) return; tab = b.dataset.v; history.replaceState(null, '', '#/ruang/' + id + '/' + tab); $$('[data-tabs] button', isi).forEach(x => x.classList.toggle('on', x === b)); isiTab(); };
      UI.klik($('[data-tab]', isi), aksiTab); // dipasang sekali per render
      isiTab();
    };
    const muatUlang = async () => { try { const x = await API.call('p_ruang', { id_pelatihan: id }); if (v.isConnected) gambar(x); } catch (e) { UI.gagal(e); } };
    const isiTab = () => {
      const t = $('[data-tab]', isi);
      if (t) t.innerHTML = this['tab_' + tab](d);
    };
    const aksiTab = {
        absen: async b => {
          // ⚡ Optimistis: langsung tercatat di layar, dikirim ke server di latar (dengan coba ulang)
          const s = d.absensi.find(x => x.hari_ke === +b.dataset.h);
          if (!s || s._kirim) return;
          const jam = new Date(), w = UI.hariIni() + ' ' + ('0' + jam.getHours()).slice(-2) + ':' + ('0' + jam.getMinutes()).slice(-2) + ':00';
          Object.assign(s, { hadir: true, waktu: w, _kirim: true });
          d.status.hadir++;
          if (tab === 'absensi' && v.isConnected) isiTab();
          UI.toast('Absensi Hari ' + s.hari_ke + ' tercatat.');
          try {
            const r = await API.call('p_absen', { id_pelatihan: id, hari_ke: s.hari_ke }, { retry: 8 });
            Object.assign(s, { waktu: r.waktu, _kirim: false });
            if (tab === 'absensi' && v.isConnected) isiTab();
            muatUlang();
          } catch (e) {
            if (/sudah absen/i.test(e.message)) { s._kirim = false; muatUlang(); return; }
            Object.assign(s, { hadir: false, waktu: '', _kirim: false });
            d.status.hadir--;
            if (v.isConnected) isiTab();
            UI.gagal('Absensi belum terkirim: ' + e.message);
          }
        }
,
        kumpul: b => this.kumpulTugas(d.tugas.daftar.find(x => x.id_tugas === b.dataset.id), muatUlang),
        lihat: async b => { try { await UI.sibuk(b, async () => UI.lihatBerkas(await API.call('tugas_file', { id_tugas: b.dataset.id }), 'Kiriman tugas Anda')); } catch (e) { UI.gagal(e); } }
    };
    try { await this.ambil(v, 'p_ruang', { id_pelatihan: id }, gambar); } catch (e) { UI.galat(isi, e, () => this.ruang(v, a)); }
  },

  tab_absensi(d) {
    const p = d.pelatihan, st = d.status;
    const slot = d.absensi.map(s => {
      const lewat = s.tanggal < UI.hariIni();
      let kanan, kls = '', aksi = '';
      if (s.hadir) kanan = s._kirim ? '<span class="chip warn">' + '<span class="spin" style="width:12px;height:12px"></span>Menyimpan…</span>' : '<span class="chip ok">' + UI.ic('checkCircle', 'sm') + 'Hadir</span>';
      else if (s.buka) { kls = 'aktif'; aksi = '<button class="btn primary block mt12" data-aksi="absen" data-h="' + s.hari_ke + '">' + UI.ic('hand') + 'Kirim Absensi Sekarang</button>'; kanan = ''; }
      else if (lewat) kanan = '<span class="chip bad sm">Tidak hadir</span>';
      else kanan = '<span class="chip line sm">' + UI.ic('lock', 'sm') + 'Belum dibuka</span>';
      return '<div class="card slot-card ' + kls + '"><div class="slot"><div class="ic-tile ' + (s.hadir ? 'ok' : (s.buka ? 'solid' : '')) + '">' + UI.ic(s.hadir ? 'calendar' : 'clock') + '</div>' +
        '<div class="grow"><div class="row g8"><span class="h-sm">Hari ke-' + s.hari_ke + '</span>' + (s.hari_ini ? '<span class="chip solid sm">AKTIF</span>' : '') + '</div><div class="t-sm muted">' + (s.hari_ini ? 'Hari ini · ' : '') + esc(UI.tglHari(s.tanggal)) + (s.hadir ? ' · ' + UI.jam(s.waktu) : '') + '</div></div>' + kanan + '</div>' + aksi + '</div>';
    }).join('');
    return '<div class="card"><div class="card-h"><div class="ttl">' + UI.ic('info', 'sm') + '<span class="semi">Informasi Pelatihan</span></div>' + UI.chipStatus(p.status) + '</div>' +
      '<div class="info-tiles"><div class="info-tile">' + UI.ic('calendar', 'sm') + '<div><div class="t-xs muted">Jadwal & Durasi</div><div class="semi t-sm">' + esc(UI.rentang(p)) + '</div><div class="t-xs muted">' + p.jumlah_hari + ' Hari (' + esc(p.jam) + ')</div></div></div>' +
      '<div class="info-tile">' + UI.ic('user', 'sm') + '<div><div class="t-xs muted">Instruktur</div><div class="semi t-sm">' + esc(p.instruktur) + '</div><div class="t-xs muted clamp1">' + esc(p.tema || 'Instruktur pelatihan') + '</div></div></div></div>' +
      '<div class="col g4 t-sm mt12"><span class="row g8">' + UI.ic(p.format === 'online' ? 'link' : 'pin', 'sm') + '<span><b>' + (p.format === 'online' ? 'Link' : 'Lokasi') + ':</b> ' +
      (p.format === 'online' && /^https?:/i.test(p.lokasi_atau_link) ? '<a href="' + esc(p.lokasi_atau_link) + '" target="_blank" rel="noopener">' + esc(p.lokasi_atau_link) + '</a>' : esc(p.lokasi_atau_link)) + '</span></span>' +
      '<span class="row g8">' + UI.ic('layers', 'sm') + '<span><b>Sektor:</b> ' + esc(p.cakupan === 'sektor' ? p.sektor : 'Umum (semua sektor)') + '</span></span></div>' +
      (p.link_dokumentasi ? '<a class="btn secondary block mt12" href="' + esc(p.link_dokumentasi) + '" target="_blank" rel="noopener">' + UI.ic('image', 'sm') + 'Lihat Dokumentasi Pelatihan</a>' : '') + '</div>' + slot +
      '<div class="card well"><div class="row between"><span class="semi t-sm">Status kelulusan</span>' + UI.chipLulus(st.lulus) + '</div>' +
      (st.kurang.length ? '<div class="t-sm muted mt8">Yang masih kurang: ' + st.kurang.map(esc).join(' · ') + '</div>' : '<div class="t-sm muted mt8">Semua syarat terpenuhi. Sertifikat diterbitkan admin setelah pelatihan selesai.</div>') + '</div>';
  },

  ikonMateri(j) {
    j = String(j || '').toLowerCase();
    if (/halal|sertifika|legal|nib|izin|p-?irt/.test(j)) return 'shield';
    if (/kemas|packag|label/.test(j)) return 'package';
    if (/kas|uang|keuangan|pembukuan|harga|hpp/.test(j)) return 'calc';
    if (/foto|kamera|visual|desain/.test(j)) return 'image';
    if (/pasar|market|jual|promosi|digital/.test(j)) return 'megaphone';
    if (/sni|mutu|standar|higien|sanitasi/.test(j)) return 'scale';
    return 'file';
  },
  kartuMateri(m, i) {
    return '<div class="mat"><div class="cover tone-' + (i % 4) + '">' + UI.ic(this.ikonMateri(m.judul)) + '<span class="ext">PDF</span></div>' +
      '<div class="semi t-sm clamp2" style="min-height:36px">' + esc(m.judul) + '</div><div class="t-xs muted row g4">' + UI.ic('file', 'sm') + UI.ukuran(m.ukuran) + '</div>' +
      '<div class="acts"><a class="btn xs secondary" href="' + esc(m.url_lihat) + '" target="_blank" rel="noopener">' + UI.ic('eye', 'sm') + 'Lihat</a><a class="btn xs primary" href="' + esc(m.url_unduh) + '" target="_blank" rel="noopener">' + UI.ic('download', 'sm') + 'Unduh</a></div></div>';
  },
  kartuDokumentasi(p) {
    return p.link_dokumentasi ? '<a class="card row" href="' + esc(p.link_dokumentasi) + '" target="_blank" rel="noopener" style="color:inherit"><div class="ic-tile">' + UI.ic('image') + '</div><div class="grow"><div class="semi">Dokumentasi Pelatihan</div><div class="t-xs muted">Foto & video kegiatan (OneDrive)</div></div>' + UI.ic('chevR', 'sm') + '</a>' : '';
  },
  tab_materi(d) {
    return this.kartuDokumentasi(d.pelatihan) + (d.materi.length ? '<div class="mat-grid">' + d.materi.map((m, i) => this.kartuMateri(m, i)).join('') + '</div>'
      : '<div class="card">' + UI.kosong('Materi belum diunggah instruktur.', 'book') + '</div>');
  },

  tab_tugas(d) {
    const t = d.tugas;
    const kepala = t.buka ? '' : '<div class="card well row">' + UI.ic('lock') + '<div class="t-sm">Pengumpulan tugas <b>belum dibuka</b> atau sudah ditutup admin.</div></div>';
    if (!t.daftar.length) return kepala + '<div class="card">' + UI.kosong('Belum ada tugas untuk pelatihan ini.', 'clipboard') + '</div>';
    return kepala + t.daftar.map(x => {
      const k = x.kumpul;
      const boleh = t.buka && !x.lewat && !(k && k.dinilai);
      return '<div class="card"><div class="row between top"><div class="h-sm">' + esc(x.judul) + '</div>' +
        (k ? (k.dinilai ? '<span class="chip ok">Skor ' + UI.angka(k.skor) + '</span>' : '<span class="chip warn dot sm">Menunggu nilai</span>') : (x.lewat ? '<span class="chip bad sm">Terlewat</span>' : '<span class="chip line sm">Belum kumpul</span>')) + '</div>' +
        '<div class="t-sm muted mt8" style="white-space:pre-line">' + esc(x.instruksi) + '</div>' +
        (x.batas_waktu ? '<div class="t-xs mt8 row g4 ' + (x.lewat ? 'c-bad' : 'c-warn') + '">' + UI.ic('clock', 'sm') + 'Batas: ' + UI.waktu(x.batas_waktu) + '</div>' : '') +
        (k ? '<div class="card well tight mt12"><div class="row"><div class="ic-tile sm">' + UI.ic(/pdf/.test(k.tipe_file) ? 'file' : 'image', 'sm') + '</div><div class="grow"><div class="semi t-sm clamp1">' + esc(k.nama_file) + '</div><div class="t-xs muted">Dikirim ' + UI.waktu(k.waktu) + '</div></div>' +
          '<button class="btn xs outline" data-aksi="lihat" data-id="' + esc(x.id_tugas) + '">Lihat</button></div>' + (k.catatan ? '<div class="t-sm mt8"><b>Catatan instruktur:</b> ' + esc(k.catatan) + '</div>' : '') + '</div>' : '') +
        (boleh ? '<button class="btn ' + (k ? 'secondary' : 'primary') + ' block mt12" data-aksi="kumpul" data-id="' + esc(x.id_tugas) + '">' + UI.ic('upload', 'sm') + (k ? 'Ganti Berkas' : 'Unggah Tugas') + '</button><div class="hint center mt8">JPG, PNG, atau PDF · maksimal 10 MB</div>' : '') + '</div>';
    }).join('');
  },

  async kumpulTugas(t, sesudah) {
    const f = (await UI.pilihFile('image/jpeg,image/png,application/pdf', false))[0];
    if (!f) return;
    if (!/^(image\/(jpeg|png)|application\/pdf)$/.test(f.type)) return UI.toast('File harus JPG, PNG, atau PDF.', 'bad');
    const file = await UI.kompres(f);
    if (file.size > 10 * 1048576) return UI.toast('Ukuran file maksimal 10 MB.', 'bad');
    const pratinjau = /^image/.test(file.type) ? '<img src="' + URL.createObjectURL(file) + '" alt="" style="width:100%;max-height:44vh;object-fit:contain;border-radius:12px;background:var(--blush-1)">' : '<div class="empty"><div class="ic-tile">' + UI.ic('file', 'lg') + '</div></div>';
    const opts = {
      title: 'Kirim Tugas',
      body: '<div class="col"><div class="semi">' + esc(t.judul) + '</div>' + pratinjau + '<div class="t-sm muted center">' + esc(file.name) + ' · ' + UI.ukuran(file.size) + (file !== f ? ' (sudah diperkecil)' : '') + '</div><div class="err" hidden data-err></div></div>',
      foot: '<button class="btn outline" data-tutup>Batal</button><button class="btn primary" data-kirim>' + UI.ic('send', 'sm') + 'Kirim</button>'
    };
    const m = UI.modal(opts);
    $('[data-kirim]', m.el).onclick = async e => {
      const err = $('[data-err]', m.el);
      opts.kunci = true; err.hidden = true;
      try {
        await UI.sibuk(e.currentTarget, async ubah => {
          const obj = await UI.fileKeObj(file);
          const r = await API.call('p_kumpul_tugas', { id_tugas: t.id_tugas, file: { nama: obj.nama, tipe: obj.tipe, data: obj.data } }, { retry: 5, onRetry: n => ubah('Mencoba lagi (' + n + ')…') });
          UI.toast(r.message);
        }, 'Mengunggah…');
        opts.kunci = false; m.close(); sesudah && sesudah();
      } catch (ex) { opts.kunci = false; err.textContent = ex.message; err.hidden = false; }
    };
  },

  tab_tes(d) {
    const kartu = (jenis, x, nama) => {
      let isi;
      if (x.selesai) isi = '<div class="row"><div class="score-ring" style="--p:' + (x.skor || 0) + ';width:84px;height:84px"><div style="width:66px;height:66px"><b class="h-md">' + UI.angka(x.skor) + '</b></div></div><div class="grow"><div class="chip ok sm">Selesai</div><div class="t-sm muted mt8">Tes hanya bisa dikerjakan satu kali.</div></div></div>';
      else if (x.buka && x.jumlah_soal) isi = '<div class="t-sm muted">' + x.jumlah_soal + ' soal pilihan ganda · satu soal per layar · jawaban tersimpan otomatis di HP.</div><a class="btn primary block mt12" href="#/tes/' + esc(d.pelatihan.id_pelatihan) + '/' + jenis + '">' + UI.ic('fileQ', 'sm') + 'Mulai ' + nama + '</a>';
      else if (x.buka) isi = '<div class="t-sm muted">Soal belum disiapkan instruktur.</div>';
      else isi = '<div class="row g8 t-sm muted">' + UI.ic('lock', 'sm') + nama + ' belum dibuka admin.</div>';
      return '<div class="card"><div class="card-h"><div class="ttl"><div class="ic-tile sm">' + UI.ic('fileQ', 'sm') + '</div><span class="h-sm">' + nama + '</span></div>' + (x.buka && !x.selesai ? '<span class="chip warn dot sm">Dibuka</span>' : '') + '</div>' + isi + '</div>';
    };
    const t = d.tes;
    const naik = t.pre.selesai && t.post.selesai ? Math.round((t.post.skor - t.pre.skor) * 10) / 10 : null;
    return kartu('pre', t.pre, 'Pre-test') + kartu('post', t.post, 'Post-test') +
      (naik !== null ? '<div class="card well row between"><span class="semi">Kenaikan nilai</span><span class="h-md ' + (naik > 0 ? 'c-ok' : 'c-bad') + '">' + (naik > 0 ? '+' : '') + UI.angka(naik) + '</span></div>' : '');
  },

  tab_evaluasi(d) {
    const e = d.evaluasi;
    if (e.selesai) return '<div class="card">' + UI.kosong('Terima kasih! Evaluasi Anda sudah tersimpan.', 'checkCircle') + '</div>';
    if (!e.buka) return '<div class="card">' + UI.kosong('Form evaluasi belum dibuka admin. Biasanya dibuka setelah post-test.', 'lock') + '</div>';
    return '<div class="card"><div class="row"><div class="ic-tile">' + UI.ic('edit') + '</div><div class="grow"><div class="h-sm">Evaluasi Pelatihan</div><div class="t-sm muted">Nilai materi, instruktur, dan penyelenggaraan. ±3 menit, hanya diisi 1 kali.</div></div></div>' +
      '<a class="btn primary block mt12" href="#/evaluasi/' + esc(d.pelatihan.id_pelatihan) + '">Isi Evaluasi</a></div>';
  },

  // ===========================================================
  // PRE/POST-TEST — satu soal per layar
  // ===========================================================
  async tes(v, a) {
    const id = a[0], jenis = a[1] === 'post' ? 'post' : 'pre', nama = jenis === 'pre' ? 'Pre-test' : 'Post-test';
    const kunciSimpan = 'rl_tes_' + id + '_' + jenis;
    v.innerHTML = this.hero({ judul: nama, back: '#/ruang/' + id + '/tes', slim: true, desc: 'Memuat soal…' }) + '<div class="m-body" style="margin-top:20px" data-isi></div>';
    const isi = $('[data-isi]', v);
    UI.loading(isi, 2);
    let d;
    try { d = await API.call('p_soal', { id_pelatihan: id, jenis: jenis }, { retry: 5 }); }
    catch (e) { return UI.galat(isi, e, () => this.tes(v, a)); }
    $('.hero .desc', v).textContent = d.judul;
    let st;
    try { st = JSON.parse(sessionStorage.getItem(kunciSimpan) || 'null'); } catch (e) { st = null; }
    st = st || { j: {}, i: 0 };
    const simpan = () => { try { sessionStorage.setItem(kunciSimpan, JSON.stringify(st)); } catch (e) { } };
    const n = d.soal.length;
    const gambar = () => {
      const s = d.soal[st.i], dijawab = Object.keys(st.j).filter(k => d.soal.some(x => x.id_soal === k)).length;
      isi.innerHTML = '<div class="card"><div class="row between"><span class="chip">Soal ' + (st.i + 1) + ' dari ' + n + '</span><span class="t-sm muted">' + dijawab + '/' + n + ' dijawab</span></div>' +
        '<div class="bar mt12"><i style="width:' + Math.round(dijawab / n * 100) + '%"></i></div>' +
        '<div class="h-sm mt20" style="font-weight:600;line-height:1.5">' + esc(s.pertanyaan) + '</div>' +
        '<div class="col g8 mt20">' + s.opsi.map(o => '<button class="opt ' + (st.j[s.id_soal] === o.kode ? 'on' : '') + '" data-o="' + o.kode + '"><span class="k">' + o.kode.toUpperCase() + '</span><span class="grow">' + esc(o.teks) + '</span></button>').join('') + '</div>' +
        '<div class="row mt20"><button class="btn outline" data-prev ' + (st.i ? '' : 'disabled') + '>' + UI.ic('chevL', 'sm') + 'Sebelumnya</button><span class="grow"></span>' +
        (st.i < n - 1 ? '<button class="btn primary" data-next>Berikutnya' + UI.ic('chevR', 'sm') + '</button>' : '<button class="btn primary" data-kirim>' + UI.ic('send', 'sm') + 'Kirim Jawaban</button>') + '</div></div>' +
        '<div class="card"><div class="lbl" style="margin-bottom:10px">Navigasi soal</div><div class="qnav">' + d.soal.map((x, i) => '<button data-q="' + i + '" class="' + (i === st.i ? 'cur' : (st.j[x.id_soal] ? 'done' : '')) + '">' + (i + 1) + '</button>').join('') + '</div></div>';
    };
    isi.onclick = async e => {
      const o = e.target.closest('[data-o]'), q = e.target.closest('[data-q]');
      if (o) { st.j[d.soal[st.i].id_soal] = o.dataset.o; simpan(); if (st.i < n - 1) setTimeout(() => { st.i++; simpan(); gambar(); }, 220); gambar(); return; }
      if (q) { st.i = +q.dataset.q; simpan(); gambar(); return; }
      if (e.target.closest('[data-prev]')) { st.i = Math.max(0, st.i - 1); simpan(); gambar(); return; }
      if (e.target.closest('[data-next]')) { st.i = Math.min(n - 1, st.i + 1); simpan(); gambar(); return; }
      const b = e.target.closest('[data-kirim]');
      if (!b) return;
      const kosong = d.soal.filter(x => !st.j[x.id_soal]).length;
      if (!await UI.konfirmasi(kosong ? '<b>' + kosong + ' soal belum dijawab</b> dan akan dihitung salah. Tetap kirim?' : 'Kirim semua jawaban sekarang? Tes hanya bisa dikirim <b>1 kali</b>.', { ok: 'Kirim Jawaban' })) return;
      try {
        let r;
        await UI.sibuk(b, async ubah => { r = await API.call('p_kirim_tes', { id_pelatihan: id, jenis: jenis, jawaban: st.j }, { retry: 6, onRetry: k => ubah('Mencoba lagi (' + k + ')…') }); }, 'Mengirim…');
        sessionStorage.removeItem(kunciSimpan);
        this.lupakan('p_ruang');
        isi.onclick = null;
        isi.innerHTML = '<div class="card center col g20" style="padding:32px 20px"><div class="h-md">' + nama + ' selesai 🎉</div>' +
          '<div class="score-ring" style="--p:' + r.skor + '"><div><div><div class="h-xl c-primary">' + UI.angka(r.skor) + '</div><div class="t-xs muted">SKOR</div></div></div></div>' +
          '<div class="muted">' + r.jumlah_benar + ' benar dari ' + r.jumlah_soal + ' soal</div><a class="btn primary block" href="#/ruang/' + esc(id) + '/tes">Kembali ke Ruang Pelatihan</a></div>';
      } catch (ex) {
        UI.gagal(ex);
        if (/sudah pernah|sudah mengerjakan/i.test(ex.message)) { sessionStorage.removeItem(kunciSimpan); location.hash = '#/ruang/' + id + '/tes'; }
      }
    };
    gambar();
  },

  // ===========================================================
  // EVALUASI
  // ===========================================================
  async evaluasi(v, a) {
    const id = a[0];
    const kunciSimpan = 'rl_eval_' + id;
    v.innerHTML = this.hero({ judul: 'Evaluasi Pelatihan', back: '#/ruang/' + id + '/evaluasi', slim: true, desc: 'Masukan Anda membantu PPU memperbaiki pelatihan.' }) + '<div class="m-body" style="margin-top:20px" data-isi></div>';
    const isi = $('[data-isi]', v);
    UI.loading(isi, 3);
    let d;
    try { d = await API.call('p_eval_form', { id_pelatihan: id }); } catch (e) { return UI.galat(isi, e, () => this.evaluasi(v, a)); }
    if (d.sudah) { isi.innerHTML = '<div class="card">' + UI.kosong('Anda sudah mengisi evaluasi pelatihan ini. Terima kasih!', 'checkCircle') + '</div>'; return; }
    let j;
    try { j = JSON.parse(sessionStorage.getItem(kunciSimpan) || '{}'); } catch (e) { j = {}; }
    const simpan = () => { try { sessionStorage.setItem(kunciSimpan, JSON.stringify(j)); } catch (e) { } };
    const JUDUL = { A: 'A. Materi & Manfaat Pelatihan', B: 'B. Instruktur', C: 'C. Penyelenggaraan', D: 'D. Saran & Masukan', E: 'E. Usulan Pelatihan Lanjutan' };
    const SKALA = ['Sangat tidak setuju', 'Tidak setuju', 'Setuju', 'Sangat setuju'];
    const bagian = [];
    d.pertanyaan.forEach(q => { let b = bagian.find(x => x.k === q.bagian); if (!b) bagian.push(b = { k: q.bagian, q: [] }); b.q.push(q); });
    const k = d.kepala;
    isi.innerHTML = '<div class="card well"><div class="lbl">Pelatihan</div><div class="h-sm">' + esc(k.judul) + '</div><div class="t-sm muted mt8">' + esc(k.instruktur) + ' · ' + esc(k.tanggal) + '</div></div>' +
      bagian.map(b => '<div class="card"><div class="h-sm" style="margin-bottom:14px">' + esc(JUDUL[b.k] || 'Bagian ' + b.k) + '</div><div class="col g20">' + b.q.map(q => {
        const key = q.bagian + q.nomor;
        return '<div data-key="' + key + '"><div class="t-sm semi" style="margin-bottom:10px;font-size:14px">' + q.nomor + '. ' + esc(q.pertanyaan) + '</div>' +
          (q.tipe === 'teks' ? '<textarea class="textarea" data-teks="' + key + '" placeholder="Tulis jawaban Anda (opsional)">' + esc(j[key] || '') + '</textarea>'
            : '<div class="scale">' + SKALA.map((s, i) => '<button type="button" data-s="' + key + '" data-v="' + (i + 1) + '" class="' + (+j[key] === i + 1 ? 'on' : '') + '"><b>' + (i + 1) + '</b>' + s + '</button>').join('') + '</div>') + '</div>';
      }).join('') + '</div></div>').join('') +
      '<button class="btn primary block" data-kirim>' + UI.ic('send', 'sm') + 'Kirim Evaluasi</button>';
    isi.addEventListener('input', e => { const t = e.target.dataset.teks; if (t) { j[t] = e.target.value; simpan(); } });
    isi.addEventListener('click', async e => {
      const s = e.target.closest('[data-s]');
      if (s) { j[s.dataset.s] = +s.dataset.v; simpan(); $$('[data-s="' + s.dataset.s + '"]', isi).forEach(x => x.classList.toggle('on', x === s)); $('[data-key="' + s.dataset.s + '"]', isi).style.outline = ''; return; }
      const b = e.target.closest('[data-kirim]');
      if (!b) return;
      const kurang = d.pertanyaan.filter(q => q.tipe === 'skala' && !j[q.bagian + q.nomor]);
      if (kurang.length) {
        const el = $('[data-key="' + kurang[0].bagian + kurang[0].nomor + '"]', isi);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.outline = '2px solid var(--warn)'; el.style.outlineOffset = '6px'; el.style.borderRadius = '8px';
        return UI.toast(kurang.length + ' pertanyaan belum dijawab.', 'bad');
      }
      if (!await UI.konfirmasi('Kirim evaluasi sekarang? Evaluasi hanya bisa diisi <b>1 kali</b>.', { ok: 'Kirim' })) return;
      // ⚡ Optimistis: langsung kembali ke ruang pelatihan, pengiriman berjalan di latar.
      // Draf jawaban tetap tersimpan di HP sampai server mengonfirmasi.
      const kr = Simpan.kunci('p_ruang', { id_pelatihan: id }), cr = Simpan.get(kr);
      if (cr) { cr.d.evaluasi.selesai = true; Simpan.set(kr, cr.d); }
      UI.toast('Terima kasih, evaluasi Anda sedang dikirim…', 'info');
      location.hash = '#/ruang/' + id + '/evaluasi';
      API.call('p_kirim_eval', { id_pelatihan: id, jawaban: j }, { retry: 8 })
        .then(r => { sessionStorage.removeItem(kunciSimpan); UI.toast(r.message); })
        .catch(ex => {
          if (/1 kali/.test(ex.message)) { sessionStorage.removeItem(kunciSimpan); return; }
          if (cr) { cr.d.evaluasi.selesai = false; Simpan.set(kr, cr.d); }
          UI.gagal('Evaluasi belum terkirim: ' + ex.message + ' — jawaban Anda masih tersimpan, buka Evaluasi lagi untuk mengirim ulang.');
          if (location.hash.indexOf('#/ruang/' + id) === 0) App.tampil();
        });
    });
  },

  // ===========================================================
  // BANK MATERI
  // ===========================================================
  async materi(v, a) {
    const u = this.user();
    let q = decodeURIComponent(a[0] || ''), kat = 'semua';
    v.innerHTML = this.hero({ judul: 'Bank Materi', sub: esc(this.panggil(u)) + ' <span style="font-weight:400;font-size:13px;opacity:.85">(' + esc(u.umkm) + ')</span>', desc: 'Modul pelatihan, panduan, dan legalitas usaha.' }) +
      this.cari('Cari modul PDF, panduan SNI, legalitas…', q) + '<div class="m-body" style="margin-top:24px" data-isi></div>';
    const isi = $('[data-isi]', v);
    const f = $('[data-cari]', v);
    f.onsubmit = e => { e.preventDefault(); $('input', f).blur(); };
    UI.loading(isi, 2);
    let rows = [];
    const gambar = () => {
      const kategori = [['semua', 'Semua Materi'], ['umum', 'Umum'], ['sektor', 'Sektor ' + (u.sektor || '')]];
      const pel = {};
      rows.forEach(m => { if (m.id_pelatihan && m.pelatihan) pel[m.id_pelatihan] = m.pelatihan; });
      Object.keys(pel).forEach(k => kategori.push(['p:' + k, pel[k]]));
      const cocok = m => (kat === 'semua' || (kat === 'umum' && m.cakupan === 'umum') || (kat === 'sektor' && m.cakupan === 'sektor') || kat === 'p:' + m.id_pelatihan) &&
        (!q || (m.judul + ' ' + m.pelatihan).toLowerCase().indexOf(q.toLowerCase()) >= 0);
      const t = rows.filter(cocok);
      $('[data-grid]', isi).innerHTML = t.length ? t.map((m, i) => this.kartuMateri(m, i)).join('') : '<div style="grid-column:1/-1" class="card">' + UI.kosong(q ? 'Tidak ada materi yang cocok dengan "' + q + '".' : 'Belum ada materi di kategori ini.', 'book') + '</div>';
      $('[data-kat]', isi).innerHTML = kategori.map(k => '<option value="' + esc(k[0]) + '"' + (k[0] === kat ? ' selected' : '') + '>' + esc(k[1]) + (k[0] === 'semua' ? ' (' + rows.length + ')' : '') + '</option>').join('');
    };
    const pasang = d => {
      rows = d;
      if (!$('[data-grid]', isi)) {
        isi.innerHTML = '<div class="row">' + UI.ic('filter', 'sm') + '<span class="semi t-sm">Kategori:</span><select class="select grow" style="height:42px;background-color:#fff" data-kat></select></div><div class="mat-grid" data-grid></div>';
        $('[data-kat]', isi).onchange = e => { kat = e.target.value; gambar(); };
      }
      gambar();
    };
    $('input', f).addEventListener('input', e => { q = e.target.value.trim(); if (rows.length) gambar(); });
    try { await this.ambil(v, 'p_materi', {}, pasang); } catch (e) { UI.galat(isi, e, () => this.materi(v, a)); }
  },

  // ===========================================================
  // SERTIFIKAT
  // ===========================================================
  async sertifikat(v) {
    v.innerHTML = this.hero({ judul: 'Sertifikat', desc: 'Unduh sertifikat pelatihan yang sudah Anda selesaikan.', slim: true }) + '<div class="m-body" style="margin-top:20px" data-isi></div>';
    const isi = $('[data-isi]', v);
    UI.loading(isi, 2);
    const gambar = rows => {
      const ada = rows.filter(r => r.tersedia).length;
      isi.innerHTML = '<div class="grid g2" style="grid-template-columns:1fr 1fr"><div class="card stat"><span class="l">Sertifikat siap</span><span class="v c-primary">' + ada + '</span></div><div class="card stat"><span class="l">Pelatihan diikuti</span><span class="v">' + rows.length + '</span></div></div>' +
        (rows.length ? rows.map(r => '<div class="card"><div class="row top"><div class="ic-tile ' + (r.tersedia ? 'solid' : '') + '">' + UI.ic('award') + '</div><div class="grow"><div class="h-sm">' + esc(r.judul) + '</div><div class="t-sm muted">' + esc(r.tanggal) + ' · ' + esc(r.instruktur) + '</div>' +
          (r.no_sertifikat ? '<div class="t-xs muted mt8">No. ' + esc(r.no_sertifikat) + '</div>' : '') + '</div></div>' +
          (r.tersedia ? '<button class="btn primary block mt12" data-aksi="unduh" data-id="' + esc(r.id_pelatihan) + '">' + UI.ic('download', 'sm') + 'Unduh Sertifikat (PDF)</button>'
            : (r.lulus ? '<div class="card well tight mt12 row">' + UI.ic('clock', 'sm') + '<span class="t-sm">Anda lulus. Sertifikat sedang disiapkan admin.</span></div>'
              : '<div class="card well tight mt12"><div class="row g8">' + UI.chipLulus(false) + '</div><div class="t-sm muted mt8">' + r.kurang.map(esc).join(' · ') + '</div></div>')) + '</div>').join('')
          : '<div class="card">' + UI.kosong('Belum ada pelatihan yang diikuti.', 'award') + '</div>');
    };
    UI.klik(isi, {
      unduh: async b => { try { await UI.sibuk(b, async () => UI.lihatBerkas(await API.call('p_unduh_sertifikat', { id_pelatihan: b.dataset.id }), 'Sertifikat')); } catch (e) { UI.gagal(e); } }
    });
    try { await this.ambil(v, 'p_sertifikat', {}, gambar); } catch (e) { UI.galat(isi, e, () => this.sertifikat(v)); }
  },

  // ===========================================================
  // RIWAYAT & SKOR NILAI
  // ===========================================================
  async nilai(v) {
    v.innerHTML = this.hero({ judul: 'Riwayat & Nilai', back: '#/profil', slim: true, desc: 'Kehadiran, pre/post-test, dan tugas setiap pelatihan.' }) + '<div class="m-body" style="margin-top:20px" data-isi></div>';
    const isi = $('[data-isi]', v);
    UI.loading(isi, 2);
    const angka = (l, x, kls) => '<div class="info-tile" style="flex-direction:column;gap:2px"><span class="t-xs muted">' + l + '</span><b class="h-sm ' + (kls || '') + '">' + x + '</b></div>';
    const gambar = rows => {
      isi.innerHTML = rows.length ? rows.map(r => '<div class="card"><div class="row between top"><div><div class="h-sm">' + esc(r.judul) + '</div><div class="t-sm muted">' + esc(r.tanggal) + ' · ' + esc(r.instruktur) + '</div></div>' + UI.chipStatus(r.status) + '</div>' +
        '<div class="grid mt12" style="grid-template-columns:repeat(3,1fr);gap:8px">' + angka('Hadir', r.hadir + '/' + r.jumlah_hari) + angka('Pre-test', UI.angka(r.pre)) + angka('Post-test', UI.angka(r.post), 'c-primary') +
        angka('Kenaikan', r.kenaikan === null ? '–' : (r.kenaikan > 0 ? '+' : '') + UI.angka(r.kenaikan), r.kenaikan > 0 ? 'c-ok' : '') + angka('Tugas', r.tugas_kumpul + '/' + r.tugas_total) + angka('Skor tugas', UI.angka(r.skor_tugas)) + '</div>' +
        '<div class="row between mt12"><span class="t-sm muted clamp1">' + (r.kurang.length ? esc(r.kurang[0]) + (r.kurang.length > 1 ? ' +' + (r.kurang.length - 1) : '') : 'Semua syarat terpenuhi') + '</span>' + UI.chipLulus(r.lulus) + '</div></div>').join('')
        : '<div class="card">' + UI.kosong('Belum ada riwayat pelatihan.', 'history') + '</div>';
    };
    try { await this.ambil(v, 'p_riwayat', {}, gambar); } catch (e) { UI.galat(isi, e, () => this.nilai(v)); }
  },

  // ===========================================================
  // PROFIL
  // ===========================================================
  profil(v) {
    const u = this.user();
    v.innerHTML = this.hero({ judul: u.nama || 'Profil', sub: esc(u.umkm || ''), desc: 'Sektor ' + (u.sektor || '-'), slim: true }) +
      '<div class="m-body" style="margin-top:20px"><div class="list">' +
      '<a class="item" href="#/nilai"><div class="ic-tile sm">' + UI.ic('chart', 'sm') + '</div><div class="grow"><div class="semi">Riwayat & Skor Nilai</div><div class="t-xs muted">Kehadiran, pre/post-test, tugas</div></div>' + UI.ic('chevR', 'sm') + '</a>' +
      '<a class="item" href="#/sertifikat"><div class="ic-tile sm">' + UI.ic('award', 'sm') + '</div><div class="grow"><div class="semi">Sertifikat Saya</div><div class="t-xs muted">Unduh sertifikat PDF</div></div>' + UI.ic('chevR', 'sm') + '</a>' +
      '<button class="item" data-pin><div class="ic-tile sm">' + UI.ic('key', 'sm') + '</div><div class="grow"><div class="semi">Ganti PIN</div><div class="t-xs muted">PIN 4 angka untuk masuk</div></div>' + UI.ic('chevR', 'sm') + '</button>' +
      '<a class="item" target="_blank" rel="noopener" href="' + App.linkWA('Halo Admin PPU, saya ' + (u.nama || '') + ' (' + (u.umkm || '') + ') ingin memperbarui data profil UMKM.') + '"><div class="ic-tile sm ok">' + UI.ic('message', 'sm') + '</div><div class="grow"><div class="semi">Hubungi Admin PPU</div><div class="t-xs muted">Ubah data profil, lupa PIN, pendaftaran</div></div>' + UI.ic('chevR', 'sm') + '</a>' +
      '<button class="item" data-keluar><div class="ic-tile sm" style="background:var(--bad-bg);color:var(--bad)">' + UI.ic('logout', 'sm') + '</div><div class="grow semi c-bad">Keluar</div></button></div>' +
      '<div class="center t-xs faint">' + esc(APP_CONFIG.nama) + ' · ' + esc(APP_CONFIG.lembaga) + '</div></div>';
    $('[data-pin]', v).onclick = () => App.modalGantiPin();
    $('[data-keluar]', v).onclick = () => App.keluar();
  }
};
