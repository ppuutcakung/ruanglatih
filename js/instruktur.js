/* =============================================================
   RuangLatih — instruktur.js
   Portal Instruktur: dasbor, bank materi, pre/post-test,
   periksa tugas, rekap nilai, riwayat mengajar.
   (Instruktur tidak dapat melihat hasil evaluasi — dijaga server.)
   ============================================================= */
const Instruktur = {
  nav: [['dasbor', 'dashboard', 'Dasbor Instruktur'], ['materi', 'book', 'Bank Materi'], ['soal', 'fileQ', 'Pre/Post Test'], ['tugas', 'checkSquare', 'Periksa Tugas'], ['nilai', 'star', 'Rekap Nilai'], ['riwayat', 'history', 'Riwayat Mengajar']],
  subjudul: 'PORTAL INSTRUKTUR',

  rute: {
    dasbor: el => Instruktur.dasbor(el),
    materi: el => Kelola.halamanMateri(el),
    soal: el => Kelola.halamanSoal(el, { judul: 'Pre/Post Test' }),
    tugas: el => Kelola.halamanTugas(el, { judul: 'Periksa Tugas' }),
    nilai: el => Kelola.halamanNilai(el),
    riwayat: el => Instruktur.riwayat(el)
  },

  async dasbor(el) {
    const u = Sesi.user() || {};
    el.innerHTML = '<div class="page-h"><div><div class="crumb">Portal Instruktur › <span class="c-primary">Pelatihan Aktif</span></div><div class="h-lg">Halo, ' + esc(u.nama) + '</div></div>' +
      '<span class="chip line">' + UI.ic('calendar', 'sm') + esc(UI.tglHari(UI.hariIni())) + '</span></div><div class="col g20" data-isi></div>';
    const isi = $('[data-isi]', el);
    UI.loading(isi, 3);
    let d;
    try { d = await API.call('dasbor_instruktur'); } catch (e) { return UI.galat(isi, e, () => this.dasbor(el)); }
    App.setBadge('tugas', d.ringkas.tugas_menunggu);
    const L = d.live, r = d.ringkas;
    let hero;
    if (L) {
      const p = L.pelatihan, pct = L.jumlah_peserta ? Math.round(L.hadir_hari_ini / L.jumlah_peserta * 100) : 0;
      hero = '<div class="card" style="padding:24px"><div class="row wrap g8">' +
        (p.status === 'berlangsung' ? '<span class="live-dot">LIVE Hari ' + L.hari_ke + ' dari ' + p.jumlah_hari + '</span>' : UI.chipStatus(p.status)) +
        '<span class="chip line">' + UI.ic('pin', 'sm') + '<span class="clamp1" style="max-width:260px">' + esc(p.format === 'online' ? 'Online' : p.lokasi_atau_link) + '</span></span>' +
        '<span class="chip line">' + UI.ic('users', 'sm') + L.jumlah_peserta + ' Peserta Terdaftar</span></div>' +
        '<div class="h-xl mt12">' + esc(p.judul) + '</div><div class="t-sm muted">' + esc(UI.rentang(p)) + ' · ' + esc(p.jam) + '</div>' +
        '<div class="row between mt20" style="max-width:560px"><span class="row g8 t-sm">' + UI.ic('checkCircle', 'sm') + 'Kehadiran Hari ' + L.hari_ke + '</span><span class="chip sm">' + L.hadir_hari_ini + ' / ' + L.jumlah_peserta + ' Hadir (' + pct + '%)</span></div>' +
        '<div class="bar ok mt8" style="max-width:560px"><i style="width:' + pct + '%"></i></div></div>';
    } else hero = '<div class="card">' + UI.kosong('Belum ada pelatihan yang ditugaskan kepada Anda. Admin PPU akan menambahkan jadwal mengajar.', 'cap') + '</div>';

    const stat = (judul, ikon, v, ket, link, lbl, warna) => '<div class="card col" style="gap:4px"><div class="row between"><span class="lbl" style="letter-spacing:.06em">' + judul + '</span><span class="ic-tile sm ' + (warna || '') + '">' + UI.ic(ikon, 'sm') + '</span></div>' +
      '<div class="stat center" style="padding:14px 0 6px">' + v + '<span class="t-sm muted">' + ket + '</span></div>' +
      '<div class="row between" style="border-top:1px solid var(--blush-2);padding-top:12px;margin-top:auto"><span class="t-xs muted"></span><a class="link" href="' + link + '">' + lbl + UI.ic('chevR', 'sm') + '</a></div></div>';
    const naik = r.kenaikan;
    const stats = '<div class="grid g4">' +
      stat('TUGAS PERLU DINILAI', 'alert', '<span class="v big">' + r.tugas_menunggu + '</span>', 'Menunggu penilaian', '#/tugas', 'Periksa') +
      stat('BANK SOAL AKTIF', 'fileQ', '<span class="v big">' + r.soal + '</span>', 'Soal Pre & Post', '#/soal', 'Lihat Soal') +
      stat('MODUL PDF', 'file', '<span class="v big">' + r.materi + '</span>', 'Tersinkron Drive', '#/materi', 'Akses Modul') +
      stat('RATA-RATA KENAIKAN', 'trend', '<span class="v big ' + (naik > 0 ? 'c-ok' : '') + '">' + (naik === null ? '–' : (naik > 0 ? '+' : '') + UI.angka(naik)) + '</span>',
        L && L.pre !== null ? UI.angka(L.pre) + ' → ' + UI.angka(L.post) : 'Belum ada post-test', '#/nilai', 'Rekap Nilai', 'ok') + '</div>';

    const antre = '<div class="card"><div class="card-h"><div class="ttl"><span class="h-md">Tugas Peserta</span><span class="chip sm">' + r.tugas_menunggu + ' Antrean</span></div></div>' +
      (d.antrean.length ? '<div class="list">' + d.antrean.map(k => Kelola.itemKumpul(k, true)).join('') + '</div>' : UI.kosong('Tidak ada tugas yang menunggu penilaian.', 'checkSquare')) +
      '<div class="center mt12"><a class="link" href="#/tugas">Buka Semua Antrean Tugas' + UI.ic('chevR', 'sm') + '</a></div></div>';

    let efek = '';
    if (L) {
      const pre = L.pre || 0, post = L.post || 0;
      efek = '<div class="card"><div class="card-h"><div><div class="h-sm">Efektivitas Pre vs Post Test</div><div class="t-sm muted">Evaluasi pemahaman materi</div></div><span class="chip ok sm">' + L.di_atas_target + '/' + L.jumlah_peserta + ' Nilai Naik</span></div>' +
        '<div class="row between t-sm"><span>Pre-Test Awal</span><b>' + UI.angka(L.pre) + ' / 100</b></div><div class="bar muted mt8"><i style="width:' + pre + '%"></i></div>' +
        '<div class="row between t-sm mt12"><span class="c-primary semi">Post-Test Akhir</span><b class="c-primary">' + UI.angka(L.post) + ' / 100' + (naik !== null ? ' (' + (naik > 0 ? '+' : '') + UI.angka(naik) + ' Poin)' : '') + '</b></div><div class="bar mt8"><i style="width:' + post + '%;background:var(--primary-press)"></i></div>' +
        '<div class="card well tight row between mt20"><span class="t-sm">Syarat lulus: post-test lebih tinggi dari pre-test</span>' + (naik > 0 ? '<span class="chip ok sm">' + UI.ic('checkCircle', 'sm') + 'Tercapai</span>' : '<span class="chip warn sm">Dipantau</span>') + '</div></div>' +
        '<div class="card"><div class="card-h"><div><div class="h-sm">Ringkasan Bank Soal</div><div class="t-sm muted">Soal pelatihan aktif</div></div><a class="link" href="#/soal">Kelola' + UI.ic('chevR', 'sm') + '</a></div>' +
        (L.soal.length ? '<div class="list">' + L.soal.map((s, i) => '<div class="row between" style="padding:8px 0;border-bottom:1px solid var(--blush-2)"><span class="t-sm semi clamp2">' + (i + 1) + '. ' + esc(s.pertanyaan) + '</span><span class="chip sm">' + esc(s.jenis.toUpperCase()) + '</span></div>').join('') + '</div>'
          : UI.kosong('Belum ada soal.', 'fileQ')) +
        '<div class="row between mt12 t-xs muted"><span>Total ' + r.soal + ' soal</span><span class="row g4 c-ok">' + UI.ic('lock', 'sm') + 'Kunci jawaban aman di server</span></div></div>';
    }
    isi.innerHTML = hero + stats + '<div class="grid" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);align-items:start" data-dua>' + antre + '<div class="col g20">' + efek + '</div></div>';
    if (window.innerWidth < 1000) $('[data-dua]', isi).style.gridTemplateColumns = '1fr';
    const peta = {};
    Kelola.pasangAksiKumpul(peta, () => d.antrean, () => this.dasbor(el));
    UI.klik(isi, peta);
  },

  async riwayat(el) {
    el.innerHTML = Kelola.kepala('Riwayat Mengajar', 'Semua pelatihan yang Anda ampu') + '<div data-isi></div>';
    const isi = $('[data-isi]', el);
    UI.loading(isi, 3);
    let rows;
    try { rows = await Kelola.daftarPel(true); } catch (e) { return UI.galat(isi, e, () => this.riwayat(el)); }
    if (!rows.length) { isi.innerHTML = Kelola.tanpaPelatihan(); return; }
    isi.innerHTML = '<div class="grid g3"><div class="card stat"><span class="l">Total pelatihan</span><span class="v">' + rows.length + '</span></div>' +
      '<div class="card stat"><span class="l">Selesai</span><span class="v">' + rows.filter(p => p.status === 'selesai').length + '</span></div>' +
      '<div class="card stat"><span class="l">Total peserta</span><span class="v">' + rows.reduce((s, p) => s + p.jumlah_peserta, 0) + '</span></div></div>' +
      '<div class="card mt20"><div class="list">' + rows.map(p => '<button class="item" data-aksi="buka" data-id="' + esc(p.id_pelatihan) + '"><div class="ic-tile">' + UI.ic('cap') + '</div><div class="grow"><div class="row g8 wrap"><span class="semi">' + esc(p.judul) + '</span>' + UI.chipSektor(p) + '</div>' +
        '<div class="meta"><span>' + esc(UI.rentang(p)) + ' (' + p.jumlah_hari + ' hari)</span><span>' + p.jumlah_peserta + '/' + p.kuota + ' peserta</span><span>' + esc(p.format) + '</span></div></div>' + UI.chipStatus(p.status) + UI.ic('chevR', 'sm') + '</button>').join('') + '</div></div>';
    UI.klik(isi, { buka: b => this.detail(b.dataset.id) });
  },

  async detail(id) {
    const m = UI.modal({ title: 'Detail Pelatihan', wide: true, body: '<div data-d></div>' });
    const box = $('[data-d]', m.el);
    UI.loading(box, 2);
    try {
      const d = await API.call('pelatihan_detail', { id_pelatihan: id });
      const p = d.pelatihan;
      box.innerHTML = '<div class="h-md">' + esc(p.judul) + '</div><div class="t-sm muted">' + esc(UI.rentang(p)) + ' · ' + esc(p.jam) + ' · ' + esc(p.lokasi_atau_link) + '</div>' +
        '<div class="tbl-wrap mt20"><table class="tbl"><thead><tr><th>UMKM</th><th class="num">Hadir</th><th class="num">Pre</th><th class="num">Post</th><th class="num">Tugas</th><th>Status</th></tr></thead><tbody>' +
        (d.peserta.length ? d.peserta.map(x => '<tr><td><div class="semi">' + esc(x.nama_umkm) + '</div><div class="t-xs muted">' + esc(x.nama_pemilik) + ' · ' + esc(x.sektor) + '</div></td><td class="num">' + x.hadir + '/' + x.jumlah_hari + '</td><td class="num">' + UI.angka(x.pre) + '</td><td class="num">' + UI.angka(x.post) + '</td><td class="num">' + x.tugas_kumpul + '/' + x.tugas_total + '</td><td>' + UI.chipLulus(x.lulus) + '</td></tr>').join('')
          : '<tr><td colspan="6">' + UI.kosong('Belum ada peserta.', 'users') + '</td></tr>') + '</tbody></table></div>';
    } catch (e) { UI.galat(box, e); }
  }
};
