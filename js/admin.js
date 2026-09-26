/* =============================================================
   RuangLatih — admin.js
   Portal Super Admin: dasbor monitoring, pelatihan (+ peserta,
   aktivitas, syarat, flyer), instruktur, bank materi, data UMKM,
   absensi, tugas, pre/post-test, evaluasi, sertifikat, laporan,
   log, manajemen akses, pengaturan, pencarian.
   ============================================================= */
const AKTIVITAS = [
  ['absen_1', 'Absensi Hari 1', 'checkSquare', 'Peserta bisa mengirim absensi hari pertama.'],
  ['absen_2', 'Absensi Hari 2', 'checkSquare', 'Hanya untuk pelatihan 2 hari.'],
  ['pre', 'Pre-test', 'fileQ', 'Dibuka di awal sebelum materi.'],
  ['post', 'Post-test', 'fileQ', 'Dibuka di akhir setelah materi.'],
  ['tugas', 'Pengumpulan Tugas', 'clipboard', 'Peserta bisa mengunggah JPG/PNG/PDF.'],
  ['evaluasi', 'Evaluasi Pelatihan', 'edit', 'Form kepuasan diisi 1 kali per peserta.']
];
const SYARAT = [['hadir', 'Hadir penuh sesuai jumlah hari'], ['post', 'Sudah mengerjakan post-test'], ['naik', 'Nilai post-test lebih tinggi dari pre-test'], ['tugas', 'Semua tugas terkumpul']];

const Admin = {
  nav: [['dasbor', 'dashboard', 'Dashboard'], ['pelatihan', 'cap', 'Pelatihan'], ['instruktur', 'user', 'Instruktur'], ['materi', 'book', 'Bank Materi'],
    ['peserta', 'users', 'Peserta'], ['absensi', 'checkSquare', 'Absensi'], ['tugas', 'clipboard', 'Tugas Peserta'], ['tes', 'fileQ', 'Pre-Pos Test'],
    ['evaluasi', 'edit', 'Evaluasi Pelatihan'], ['sertifikat', 'award', 'Sertifikat'], ['laporan', 'chart', 'Laporan Rekap'], ['log', 'history', 'Log Aktivitas'],
    ['akses', 'lock', 'Manajemen Akses'], ['pengaturan', 'settings', 'Pengaturan']],
  subjudul: 'by PPU UT Cakung',

  rute: {
    dasbor: el => Admin.dasbor(el),
    pelatihan: (el, a) => a[0] ? Admin.detailPelatihan(el, a[0]) : Admin.pelatihan(el),
    instruktur: el => Admin.instruktur(el),
    materi: el => Kelola.halamanMateri(el),
    peserta: el => Admin.peserta(el),
    absensi: el => Admin.absensi(el),
    tugas: el => Kelola.halamanTugas(el, { judul: 'Tugas Peserta', atas: (h, id) => Admin.panelAktivitas(h, id, ['tugas']) }),
    tes: el => Kelola.halamanSoal(el, { judul: 'Pre-Pos Test', rekap: true, atas: (h, id) => Admin.panelAktivitas(h, id, ['pre', 'post']) }),
    evaluasi: el => Admin.evaluasi(el),
    sertifikat: el => Admin.sertifikat(el),
    laporan: el => Admin.laporan(el),
    log: el => Admin.log(el),
    akses: (el, a) => Admin.akses(el, a[0]),
    pengaturan: el => Admin.pengaturan(el),
    cari: (el, a) => Admin.cari(el, decodeURIComponent(a[0] || ''))
  },

  // ---------- Buka/tutup aktivitas ----------
  togel(kunci, buka, idPel) {
    return '<button class="toggle ' + (buka ? 'on' : '') + '" role="switch" aria-checked="' + !!buka + '" data-aksi="togel" data-k="' + kunci + '" data-p="' + esc(idPel) + '" aria-label="Buka/tutup"></button>';
  },
  /** ⚡ Optimistis: sakelar berubah seketika, server menyusul di latar; kembali semula bila gagal. */
  aksiTogel(b, sesudah) {
    if (b._kirim) return;
    const buka = !b.classList.contains('on'), idp = b.dataset.p, k = b.dataset.k;
    const pasang = v => { b.classList.toggle('on', v); b.setAttribute('aria-checked', v); Kelola.ubahPelLokal(idp, x => { x.aktivitas[k] = v; }); sesudah && sesudah(v); };
    pasang(buka);
    b._kirim = true;
    UI.toast((AKTIVITAS.find(a => a[0] === k) || [, k])[1] + (buka ? ' dibuka.' : ' ditutup.'));
    API.call('aktivitas_set', { id_pelatihan: idp, kunci: k, buka: buka })
      .catch(e => { pasang(!buka); UI.gagal(e); })
      .finally(() => { b._kirim = false; });
  },
  /** Kartu kecil buka/tutup untuk halaman tugas & pre-pos test. */
  async panelAktivitas(host, idPel, kunci) {
    if (!idPel) { host.innerHTML = ''; return; }
    const list = await Kelola.daftarPel();
    const p = list.find(x => x.id_pelatihan === idPel);
    if (!p) { host.innerHTML = ''; return; }
    host.innerHTML = '<div class="card tight" style="margin-bottom:20px"><div class="row wrap g16">' + kunci.map(k => {
      const a = AKTIVITAS.find(x => x[0] === k);
      return '<div class="row g8" style="min-width:220px"><div class="ic-tile sm">' + UI.ic(a[2], 'sm') + '</div><div class="grow"><div class="semi t-sm">' + a[1] + '</div><div class="t-xs muted">' + (p.aktivitas[k] ? 'Sedang dibuka' : 'Ditutup') + '</div></div>' + this.togel(k, p.aktivitas[k], idPel) + '</div>';
    }).join('') + '</div></div>';
    if (!host._pasang) { host._pasang = 1; UI.klik(host, { togel: b => this.aksiTogel(b, v => { const t = b.parentNode.querySelector('.t-xs'); if (t) t.textContent = v ? 'Sedang dibuka' : 'Ditutup'; }) }); }
  },

  // ===========================================================
  // DASBOR MONITORING
  // ===========================================================
  async dasbor(el) {
    const thIni = UI.hariIni().slice(0, 4);
    let tahun = sessionStorage.getItem('rl_tahun') || thIni;
    el.innerHTML = '<div class="card row between wrap" style="padding:22px 24px"><div class="row"><div class="ic-tile">' + UI.ic('dashboard') + '</div><div><div class="h-lg">Dasbor Monitoring</div><div class="t-sm muted" data-periode>' + esc(APP_CONFIG.lembaga) + '</div></div></div>' +
      '<div class="row g8 wrap"><div class="row g8"><span class="t-sm semi muted">Tahun</span><select class="select" style="height:40px;width:auto;min-width:110px" data-tahun aria-label="Pilih tahun"><option>' + esc(tahun) + '</option></select></div>' +
      '<button class="btn outline sm" data-aksi="segar">' + UI.ic('refresh', 'sm') + 'Segarkan</button></div></div><div class="col g20" data-isi></div>';
    const isi = $('[data-isi]', el), pilihTh = $('[data-tahun]', el);
    let d, tab = 'semua', hal = 1, gambarRekap = () => { };
    const param = () => tahun === thIni ? {} : { tahun: tahun }; // tahun berjalan memakai data yang sudah dipanaskan
    const muat = () => {
      UI.loading(isi, 3);
      const t = tahun;
      return API.ambil('dasbor_admin', param(), x => { if (t === tahun) { d = x; gambar(); } }, { el: isi }).catch(e => UI.galat(isi, e, muat));
    };
    pilihTh.onchange = () => { tahun = pilihTh.value; sessionStorage.setItem('rl_tahun', tahun); hal = 1; muat(); };
    isi.addEventListener('click', e => { const b = e.target.closest('[data-tab] button'); if (b) { tab = b.dataset.v; hal = 1; gambarRekap(); } });
    UI.klik(el, {
      segar: b => UI.sibuk(b, async () => { d = await API.call('dasbor_admin', param()); gambar(); }).catch(UI.gagal),
      hal: b => { hal = +b.dataset.h; gambarRekap(); },
      togel: b => this.aksiTogel(b, v => { const s = b.closest('.stage'); if (s) s.classList.toggle('on', v); })
    });
    const gambar = () => {
    if (d.ytd) App.setBadge('tugas', d.ringkas.tugas_menunggu);
    const R = d.ringkas, L = d.live, E = d.evaluasi, th = d.tahun;
    pilihTh.innerHTML = (d.daftar_tahun || [th]).map(t => '<option value="' + esc(t) + '"' + (t === th ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
    $('[data-periode]', el).innerHTML = esc(APP_CONFIG.lembaga) + ' · <span class="chip ' + (d.ytd ? 'ok' : 'info') + ' sm">' + (d.ytd ? 'YTD' : 'Setahun penuh') + '</span> ' + esc(UI.tglPendek(d.periode.dari)) + ' – ' + esc(UI.tglPendek(d.periode.sampai));
    const sk = { Kuliner: 'KUL', Kerajinan: 'KRJ', Pertanian: 'PTN', Manufaktur: 'MFG' };
    const kartu = (l, chip, v, ket, kls) => '<div class="card col" style="gap:8px"><div class="row between top"><span class="l semi t-sm muted" style="max-width:150px">' + l + '</span>' + chip + '</div><div class="stat"><span class="v big ' + (kls || '') + '">' + v + '</span></div><div class="t-xs muted">' + ket + '</div></div>';
    const stats = '<div class="grid g4">' +
      kartu('Akumulasi Peserta ' + th, R.peserta_baru ? '<span class="chip sm">+' + R.peserta_baru + ' bulan ini</span>' : '<span class="chip line sm">' + R.umkm_unik + ' UMKM</span>', R.peserta, '<div class="row g4 wrap">' + SEKTOR.map(s => '<span class="chip line sm">' + sk[s] + ' ' + (R.per_sektor[s] || 0) + '</span>').join('') + '</div>') +
      kartu('Pelatihan & Kelulusan ' + th, '<span class="chip ok sm">' + R.lulus + ' lulus</span>', R.pelatihan, 'program · ' + R.lulus + ' dari ' + R.peserta + ' peserta lulus (' + (R.peserta ? Math.round(R.lulus / R.peserta * 100) : 0) + '%)') +
      kartu('Rata-rata Kehadiran ' + th, L && d.ytd && R.kehadiran_live !== null ? '<span class="chip ok sm">Live ' + UI.angka(R.kehadiran_live) + '%</span>' : '', R.kehadiran === null ? '–' : UI.angka(R.kehadiran) + '%', R.hadir_total + ' dari ' + R.hari_total + ' hari-peserta hadir', 'c-primary') +
      kartu('Tugas & Materi ' + th, R.tugas_menunggu ? '<span class="chip warn sm">' + R.tugas_menunggu + ' perlu cek</span>' : '<span class="chip ok sm">Beres</span>', R.tugas_masuk, 'berkas tugas masuk · ' + R.materi + ' modul PDF') + '</div>';

    let live = '';
    if (L) {
      const p = L.pelatihan, n = L.jumlah_peserta;
      const st = (judul, kunci, buka, nilai, ket, kunciTogel) => '<div class="stage ' + (buka ? 'on' : '') + '"><div class="row between"><span class="semi t-sm c-primary">' + judul + '</span>' + this.togel(kunciTogel || kunci, buka, p.id_pelatihan) + '</div>' +
        '<div class="h-md">' + nilai + '</div><div class="t-xs ' + (buka ? 'c-ok semi' : 'muted') + '">' + ket + '</div></div>';
      live = '<div class="card" style="padding:0"><div class="row between wrap" style="padding:18px 20px;border-bottom:1px solid var(--blush-2)"><div class="row wrap g8">' +
        (p.status === 'berlangsung' ? '<span class="live-dot">LIVE</span>' : UI.chipStatus(p.status)) + '<a class="h-md" style="color:inherit" href="#/pelatihan/' + esc(p.id_pelatihan) + '">' + esc(p.judul) + '</a>' +
        '<span class="t-sm muted">· ' + esc(p.instruktur) + ' · ' + esc(p.format === 'online' ? 'Online' : p.lokasi_atau_link) + ' (' + n + ' Peserta)</span></div><span class="chip line">Hari ' + L.hari_ke + ' dari ' + p.jumlah_hari + '</span></div>' +
        '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));padding:20px" data-stage>' +
        st('Absensi Hari ' + L.hari_ke, 'absen', L.absen.buka, L.absen.hadir + ' / ' + n, n ? Math.round(L.absen.hadir / n * 100) + '% hadir' : '-', 'absen_' + L.hari_ke) +
        st('Pre-Test', 'pre', L.pre.buka, L.pre.selesai + ' / ' + n, 'Rata-rata ' + UI.angka(L.pre.rata)) +
        st('Post-Test', 'post', L.post.buka, L.post.selesai + ' / ' + n, 'Rata-rata ' + UI.angka(L.post.rata)) +
        st('Tugas', 'tugas', L.tugas.buka, L.tugas.jumlah ? L.tugas.kumpul + ' / ' + n : 'Belum ada', L.tugas.jumlah + ' tugas · lengkap') +
        st('Evaluasi', 'evaluasi', L.evaluasi.buka, L.evaluasi.terisi + ' / ' + n, 'Form terisi') + '</div></div>';
    }

    gambarRekap = () => {
      const f = { semua: () => true, berlangsung: p => p.status === 'berlangsung', selesai: p => p.status === 'selesai', datang: p => p.status === 'akan datang' }[tab];
      const rows = d.rekap.filter(f), per = 5;
      const box = $('[data-rekap]', isi);
      const n = k => d.rekap.filter({ berlangsung: p => p.status === 'berlangsung', selesai: p => p.status === 'selesai', datang: p => p.status === 'akan datang' }[k]).length;
      box.innerHTML = '<div class="card-h wrap"><div class="ttl"><div class="ic-tile sm">' + UI.ic('clipboard', 'sm') + '</div><span class="h-md">Rekap Program ' + d.tahun + '</span></div>' +
        '<div class="seg pill" data-tab>' + [['semua', 'Semua (' + d.rekap.length + ')'], ['berlangsung', 'Berjalan (' + n('berlangsung') + ')'], ['selesai', 'Selesai (' + n('selesai') + ')'], ['datang', 'Akan Datang (' + n('datang') + ')']].map(x => '<button data-v="' + x[0] + '" class="' + (tab === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div></div>' +
        (rows.length ? '<div class="list">' + rows.slice((hal - 1) * per, hal * per).map(p => '<a class="item" href="#/pelatihan/' + esc(p.id_pelatihan) + '" style="color:inherit"><div class="ic-tile">' + UI.ic('cap') + '</div><div class="grow"><div class="row g8 wrap"><span class="semi clamp1" style="max-width:340px">' + esc(p.judul) + '</span>' + UI.chipSektor(p) + '</div>' +
          '<div class="meta"><span>' + esc(p.instruktur) + '</span><span>' + esc(UI.rentang(p)) + ' (' + p.jumlah_hari + ' Hari)</span></div></div>' +
          '<div class="right" style="min-width:90px"><div class="semi num">' + (p.status === 'akan datang' ? p.jumlah_peserta + ' / ' + p.kuota : p.hadir_penuh + ' / ' + p.jumlah_peserta) + '</div><div class="t-xs muted">' + (p.status === 'akan datang' ? 'Pendaftar / kuota' : 'Hadir penuh') + '</div></div>' + UI.chipStatus(p.status) + '</a>').join('') + '</div>' + UI.halaman(rows.length, hal, per)
          : UI.kosong('Belum ada pelatihan di kategori ini.', 'cap'));
    };
    const evalBox = '<div class="card"><div class="card-h"><div class="ttl"><div class="ic-tile sm">' + UI.ic('trend', 'sm') + '</div><span class="h-md">Rerata Evaluasi ' + th + '</span></div></div>' +
      '<div class="grid g2" style="grid-template-columns:1fr 1fr;gap:10px">' +
      [['Pre-Test', UI.angka(E.pre), 'rata-rata', ''], ['Post-Test', UI.angka(E.post), 'rata-rata', ''], ['CSI Pelatihan', E.csi_pelatihan === null ? '–' : UI.angka(E.csi_pelatihan) + '%', 'Skor ' + UI.angka(E.skor_pelatihan, 2) + ' / 4', 'ok'], ['CSI Instruktur', E.csi_instruktur === null ? '–' : UI.angka(E.csi_instruktur) + '%', 'Skor ' + UI.angka(E.skor_instruktur, 2) + ' / 4', '']]
        .map(x => '<div class="card ' + (x[3] === 'ok' ? '' : 'well') + ' tight center" style="' + (x[3] === 'ok' ? 'background:var(--ok-bg);border-color:#CDEBDC' : '') + '"><div class="t-xs muted">' + x[0] + '</div><div class="h-lg ' + (x[3] === 'ok' ? 'c-ok' : 'c-primary') + '">' + x[1] + '</div><div class="t-xs muted">' + x[2] + '</div></div>').join('') +
      '</div><div class="t-xs muted mt12">' + E.responden + ' responden evaluasi · CSI = rerata skala 1–4 ÷ 4 × 100%</div></div>';
    const logBox = '<div class="card"><div class="card-h"><div class="ttl"><div class="ic-tile sm">' + UI.ic('history', 'sm') + '</div><span class="h-md">Log Terkini</span></div><a class="link" href="#/log">Lihat Semua</a></div>' +
      (d.log.length ? '<div class="list">' + d.log.map(l => '<div class="item" style="align-items:flex-start;padding:12px 14px"><span style="width:8px;height:8px;border-radius:50%;background:var(--primary);margin-top:7px;flex-shrink:0"></span><div class="grow"><div class="t-sm">' + esc(l.aksi) + '</div><div class="t-xs muted">' + UI.relatif(l.waktu) + ' · ' + esc(l.nama || l.peran) + (l.nama ? ' (' + esc(l.peran) + ')' : '') + '</div></div></div>').join('') + '</div>' : UI.kosong('Belum ada aktivitas.', 'history')) + '</div>';

    isi.innerHTML = stats + live + '<div class="grid" style="grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);align-items:start" data-dua><div class="card" data-rekap></div><div class="col g20">' + evalBox + logBox + '</div></div>';
    if (window.innerWidth < 1000) $('[data-dua]', isi).style.gridTemplateColumns = '1fr';
    gambarRekap();
    };
    await muat();
  },

  // ===========================================================
  // PELATIHAN
  // ===========================================================
  async pelatihan(el) {
    el.innerHTML = Kelola.kepala('Pelatihan', 'Jadwal, instruktur, kuota, dan peserta', '<button class="btn primary sm" data-aksi="baru">' + UI.ic('plus', 'sm') + 'Buat Pelatihan</button>') + '<div data-draft></div><div data-isi></div>';
    const isi = $('[data-isi]', el), boxDraft = $('[data-draft]', el);
    let rows = [], f = 'semua', q = '', draft = [];
    const gambarDraft = () => {
      boxDraft.innerHTML = draft.length ? '<div class="card" style="margin-bottom:20px"><div class="card-h"><div class="ttl"><div class="ic-tile sm" style="background:var(--warn-bg);color:var(--warn)">' + UI.ic('edit', 'sm') + '</div><span class="h-sm">Draft Pelatihan</span><span class="chip warn sm">' + draft.length + ' belum final</span></div></div>' +
        '<div class="list">' + draft.map(x => { const v = x.data || {};
          return '<div class="item"><div class="grow"><div class="semi">' + esc(x.judul) + '</div><div class="meta">' + (v.tanggal_mulai ? '<span>' + UI.ic('calendar', 'sm') + esc(UI.tglPendek(v.tanggal_mulai)) + (v.jumlah_hari ? ' · ' + v.jumlah_hari + ' hari' : '') + '</span>' : '<span>Tanggal belum diisi</span>') +
            '<span>Diubah ' + esc(UI.relatif(x.tgl_diubah)) + (x.dibuat_oleh ? ' oleh ' + esc(x.dibuat_oleh) : '') + '</span>' + (x._kirim ? '<span class="c-warn">Menyimpan…</span>' : '') + '</div></div>' +
            '<div class="row g4"><button class="btn sm primary" data-aksi="lanjutDraft" data-id="' + esc(x.id_draft) + '">' + UI.ic('edit', 'sm') + 'Lanjutkan</button><button class="btn icon sm danger" data-aksi="hapusDraft" data-id="' + esc(x.id_draft) + '" title="Hapus draft">' + UI.ic('trash', 'sm') + '</button></div></div>'; }).join('') + '</div></div>' : '';
    };
    const muatDraft = () => API.ambil('draft_list', {}, x => { draft = x; gambarDraft(); }, { el: boxDraft }).catch(() => { });
    this._segarDraft = () => { const c = Simpan.get(Simpan.kunci('draft_list', {})); if (c && boxDraft.isConnected) { draft = c.d; gambarDraft(); } };
    const gambar = () => {
      const t = rows.filter(p => (f === 'semua' || p.status === f) && (!q || (p.judul + ' ' + p.instruktur + ' ' + p.tema).toLowerCase().indexOf(q) >= 0));
      $('[data-list]', isi).innerHTML = t.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pelatihan</th><th>Jadwal</th><th>Instruktur</th><th class="num">Peserta</th><th>Status</th><th></th></tr></thead><tbody>' +
        t.map(p => '<tr style="cursor:pointer" data-buka="' + esc(p.id_pelatihan) + '"><td><div class="semi">' + esc(p.judul) + '</div><div class="row g4 mt8">' + UI.chipSektor(p) + '<span class="chip line sm">' + esc(p.format) + '</span></div></td>' +
          '<td><div>' + esc(UI.rentang(p)) + '</div><div class="t-xs muted">' + p.jumlah_hari + ' hari · ' + esc(p.jam) + '</div></td><td>' + esc(p.instruktur) + '</td><td class="num">' + p.jumlah_peserta + ' / ' + p.kuota + '</td><td>' + UI.chipStatus(p.status) + '</td><td>' + UI.ic('chevR', 'sm') + '</td></tr>').join('') + '</tbody></table></div>'
        : UI.kosong(rows.length ? 'Tidak ada pelatihan yang cocok.' : 'Belum ada pelatihan. Klik "Buat Pelatihan".', 'cap');
    };
    const muat = async () => {
      UI.loading(isi, 2);
      try { await API.ambil('pelatihan_list', {}, x => { rows = x; if (!$('[data-list]', isi)) kerangka(); gambar(); }, { el: isi }); }
      catch (e) { UI.galat(isi, e, muat); }
    };
    const kerangka = () => {
      {
        isi.innerHTML = '<div class="card"><div class="row between wrap" style="margin-bottom:14px"><div class="seg pill" data-f>' + [['semua', 'Semua'], ['berlangsung', 'Berlangsung'], ['akan datang', 'Akan Datang'], ['selesai', 'Selesai']].map(x => '<button data-v="' + x[0] + '" class="' + (f === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>' +
          '<div class="input-ic" style="min-width:240px">' + UI.ic('search', 'sm') + '<input class="input" style="height:42px" placeholder="Cari judul atau instruktur…" data-q></div></div><div data-list></div></div>';
        $('[data-f]', isi).onclick = e => { const b = e.target.closest('button'); if (!b) return; f = b.dataset.v; $$('[data-f] button', isi).forEach(x => x.classList.toggle('on', x === b)); gambar(); };
        $('[data-q]', isi).oninput = e => { q = e.target.value.toLowerCase(); gambar(); };
        $('[data-list]', isi).onclick = e => { const r = e.target.closest('[data-buka]'); if (r) location.hash = '#/pelatihan/' + r.dataset.buka; };
      }
    };
    const keDetail = id => { sessionStorage.setItem('rl_buka_daftar', id); sessionStorage.setItem('rl_ptab', 'peserta'); location.hash = '#/pelatihan/' + id; };
    UI.klik(el, {
      baru: () => this.formPelatihan(null, keDetail),
      lanjutDraft: b => { const x = draft.find(y => y.id_draft === b.dataset.id); if (x) this.formPelatihan(null, keDetail, x); },
      hapusDraft: async b => {
        const x = draft.find(y => y.id_draft === b.dataset.id);
        if (!x || !await UI.konfirmasi('Hapus draft <b>' + esc(x.judul) + '</b>?', { ok: 'Hapus', bahaya: true })) return;
        const lama = draft; draft = draft.filter(y => y !== x); gambarDraft(); UI.toast('Draft dihapus.');
        API.call('draft_hapus', { id_draft: x.id_draft }).catch(e => { draft = lama; gambarDraft(); UI.gagal(e); });
      }
    });
    muatDraft();
    muat();
  },

  /** Simpan draft pelatihan — optimistis: tampil seketika, disimpan ke server di latar. */
  simpanDraft(v, idDraft) {
    if (!Object.keys(v).some(k => v[k] && !['cakupan', 'format', 'status', 'jam', 'kuota', 'id_instruktur', 'sektor'].includes(k)))
      throw new Error('Isi minimal judul atau tanggal pelatihan sebelum menyimpan draft.');
    const id = idDraft || 'DRF-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase();
    const k = Simpan.kunci('draft_list', {}), c = Simpan.get(k);
    const lama = c ? c.d : [];
    const x = { id_draft: id, judul: v.judul || '(Tanpa judul)', data: v, dibuat_oleh: (Sesi.user() || {}).nama, tgl_diubah: UI.hariIni() + ' ' + new Date().toTimeString().slice(0, 8), _kirim: true };
    Simpan.set(k, [x].concat(lama.filter(y => y.id_draft !== id)));
    this._segarDraft && this._segarDraft();
    UI.toast('Draft "' + x.judul + '" disimpan. Lanjutkan kapan saja dari menu Pelatihan.');
    API.call('draft_simpan', { id_draft: id, data: v })
      .then(() => { API.call('draft_list').then(() => this._segarDraft && this._segarDraft()).catch(() => { }); })
      .catch(e => { Simpan.set(k, lama); this._segarDraft && this._segarDraft(); UI.gagal('Draft gagal disimpan: ' + e.message); });
  },

  async formPelatihan(p, sesudah, draft) {
    let ins;
    try { ins = await API.cepat('instruktur_list'); } catch (e) { return UI.gagal(e); }
    if (!ins.length) return UI.toast('Tambahkan instruktur terlebih dahulu di menu Instruktur.', 'info');
    p = p || Object.assign({ cakupan: 'umum', format: 'tatap muka', status: 'akan datang', jumlah_hari: '' }, draft ? draft.data : {});
    const baru = !p.id_pelatihan;
    UI.form({
      tombol: baru ? [{ teks: 'Simpan Draft', ikon: 'edit', kelas: 'secondary', fn: v => this.simpanDraft(v, draft && draft.id_draft) }] : [],
      title: p.id_pelatihan ? 'Ubah Pelatihan' : 'Buat Pelatihan', wide: true, submit: p.id_pelatihan ? 'Simpan Perubahan' : 'Buat Pelatihan',
      intro: draft ? '<div class="card well tight t-sm row" style="margin-bottom:16px">' + UI.ic('edit', 'sm') + '<span>Melanjutkan draft. Klik <b>Buat Pelatihan</b> bila data sudah final, atau <b>Simpan Draft</b> untuk menyimpan perubahan.</span></div>' : p.id_pelatihan ? '<div class="card well tight t-sm" style="margin-bottom:16px">Mengubah jumlah hari/tanggal diperiksa otomatis: 2→1 hari ditolak bila Hari 2 sudah ada absensi, tanggal hanya bisa diubah bila absensi hari itu belum pernah dibuka. Semua perubahan tercatat di log.</div>' : '',
      fields: [
        { name: 'judul', label: 'Judul pelatihan', value: p.judul, full: true },
        { name: 'tema', label: 'Tema / topik', value: p.tema, placeholder: 'mis. Pemasaran digital' },
        { name: 'id_instruktur', label: 'Instruktur', type: 'select', value: p.id_instruktur, options: ins.filter(i => i.status === 'aktif' || i.id_instruktur === p.id_instruktur).map(i => [i.id_instruktur, i.nama]) },
        { name: 'cakupan', label: 'Cakupan', type: 'seg', value: p.cakupan, options: [['umum', 'Umum (semua sektor)'], ['sektor', 'Khusus sektor']] },
        { name: 'sektor', label: 'Sektor', type: 'select', value: p.sektor || SEKTOR[0], options: SEKTOR, hidden: p.cakupan !== 'sektor' },
        { name: 'jumlah_hari', label: 'Jumlah hari (wajib)', type: 'seg', value: p.jumlah_hari, options: [['1', '1 Hari'], ['2', '2 Hari']] },
        { name: 'status', label: 'Status', type: 'select', value: p.status, options: [['akan datang', 'Akan Datang'], ['berlangsung', 'Berlangsung'], ['selesai', 'Selesai']] },
        { name: 'tanggal_mulai', label: 'Tanggal Hari 1', type: 'date', value: p.tanggal_mulai },
        { name: 'tanggal_selesai', label: 'Tanggal Hari 2', type: 'date', value: +p.jumlah_hari === 2 ? p.tanggal_selesai : '', hidden: +p.jumlah_hari !== 2 },
        { name: 'jam', label: 'Jam', value: p.jam || '09.00–15.00 WIB' },
        { name: 'kuota', label: 'Kuota peserta', type: 'number', value: p.kuota || 40, attrs: 'min="1"' },
        { name: 'format', label: 'Format', type: 'seg', value: p.format, options: [['tatap muka', 'Tatap muka'], ['online', 'Online']] },
        { name: 'lokasi_atau_link', label: p.format === 'online' ? 'Link meeting' : 'Lokasi', value: p.lokasi_atau_link, full: true, placeholder: 'mis. Aula Sentra Cakung Lt. 2 atau https://meet.google.com/…' },
        { name: 'link_dokumentasi', label: 'Link dokumentasi pelatihan (opsional)', type: 'url', value: p.link_dokumentasi, full: true, placeholder: 'Tempel link folder OneDrive, mis. https://…sharepoint.com/…', hint: 'Bisa dibuka peserta & instruktur. Pastikan pengaturan berbagi OneDrive mengizinkan orang yang punya link untuk melihat.' }
      ],
      onOpen: (m, form) => {
        const atur = () => {
          $('[data-f="sektor"]', form).hidden = form.elements.cakupan.value !== 'sektor';
          $('[data-f="tanggal_selesai"]', form).hidden = form.elements.jumlah_hari.value !== '2';
          $('[data-f="lokasi_atau_link"] label', form).textContent = form.elements.format.value === 'online' ? 'Link meeting' : 'Lokasi';
        };
        form.addEventListener('change', atur);
      },
      latar: !baru, pesanSimpan: 'Menyimpan perubahan pelatihan…',
      cek: v => {
        if (!v.jumlah_hari) throw new Error('Pilih jumlah hari: 1 hari atau 2 hari.');
        if (!v.judul) throw new Error('Judul pelatihan wajib diisi.');
        if (v.link_dokumentasi && !/^https?:\/\/\S+$/i.test(v.link_dokumentasi)) throw new Error('Link dokumentasi harus diawali https:// (salin dari OneDrive).');
      },
      onSubmit: async v => {
        if (!v.jumlah_hari) throw new Error('Pilih jumlah hari: 1 hari atau 2 hari.');
        const r = await API.call('pelatihan_simpan', Object.assign({ id_pelatihan: p.id_pelatihan, id_draft: draft ? draft.id_draft : '' }, v));
        UI.toast(r.message); Kelola.segarkanPel();
        sesudah && sesudah(r.id_pelatihan);
      }
    });
  },

  async detailPelatihan(el, id) {
    el.innerHTML = '<div data-isi></div>';
    const isi = $('[data-isi]', el);
    UI.loading(isi, 3);
    let d, tab = sessionStorage.getItem('rl_ptab') || 'peserta';
    const muat = async () => {
      try { await API.ambil('pelatihan_detail', { id_pelatihan: id }, x => { d = x; gambar(); }, { el: isi }); } catch (e) { UI.galat(isi, e, muat); }
    };
    const gambar = () => {
      const p = d.pelatihan;
      const lulus = d.peserta.filter(x => x.lulus).length;
      isi.innerHTML = '<div class="page-h"><div><div class="crumb"><a href="#/pelatihan">Pelatihan</a> › ' + esc(p.id_pelatihan) + '</div><div class="h-lg">' + esc(p.judul) + '</div>' +
        '<div class="row wrap g8 mt8">' + UI.chipStatus(p.status) + UI.chipSektor(p) + '<span class="chip line">' + UI.ic('calendar', 'sm') + esc(UI.rentang(p)) + ' · ' + p.jumlah_hari + ' hari</span><span class="chip line">' + UI.ic('user', 'sm') + esc(p.instruktur) + '</span></div></div>' +
        '<div class="row wrap g8"><button class="btn outline sm" data-aksi="flyer">' + UI.ic('image', 'sm') + 'Flyer</button><button class="btn secondary sm" data-aksi="ubah">' + UI.ic('edit', 'sm') + 'Ubah</button><button class="btn danger sm" data-aksi="hapusP">' + UI.ic('trash', 'sm') + '</button></div></div>' +
        '<div class="grid g4 mt20"><div class="card stat"><span class="l">Peserta</span><span class="v">' + d.peserta.length + ' <span class="t-sm muted">/ ' + p.kuota + '</span></span></div>' +
        '<div class="card stat"><span class="l">Hadir penuh</span><span class="v">' + d.peserta.filter(x => x.hadir >= x.jumlah_hari).length + '</span></div>' +
        '<div class="card stat"><span class="l">Memenuhi syarat lulus</span><span class="v c-ok">' + lulus + '</span></div>' +
        '<div class="card stat"><span class="l">Evaluasi terisi</span><span class="v">' + d.peserta.filter(x => x.evaluasi).length + '</span></div></div>' +
        '<div class="seg mt20" data-tab style="max-width:520px">' + [['peserta', 'Peserta'], ['aktivitas', 'Aktivitas & Syarat'], ['info', 'Info & Flyer']].map(x => '<button data-v="' + x[0] + '" class="' + (tab === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>' +
        '<div class="mt20" data-tabisi>' + this['pTab_' + tab](d) + '</div>';
      $('[data-tab]', isi).onclick = e => { const b = e.target.closest('button'); if (!b) return; tab = b.dataset.v; sessionStorage.setItem('rl_ptab', tab); gambar(); };
      // Baru dibuat → langsung tawarkan form daftarkan UMKM
      if (sessionStorage.getItem('rl_buka_daftar') === id) { sessionStorage.removeItem('rl_buka_daftar'); this.modalDaftarkan(d, muat); }
    };
    UI.klik(isi, {
      ubah: () => this.formPelatihan(d.pelatihan, () => muat()),
      hapusP: async () => {
        if (!await UI.konfirmasi('Hapus pelatihan <b>' + esc(d.pelatihan.judul) + '</b>? Hanya bisa bila belum ada peserta & materi.', { ok: 'Hapus', bahaya: true })) return;
        try { const r = await API.call('pelatihan_hapus', { id_pelatihan: id }); UI.toast(r.message); Kelola.segarkanPel(); location.hash = '#/pelatihan'; } catch (e) { UI.gagal(e); }
      },
      flyer: b => this.unggahFlyer(b, id, muat),
      daftar: () => this.modalDaftarkan(d, muat),
      keluar: async b => {
        const x = d.peserta.find(y => y.id_umkm === b.dataset.id);
        if (x && (x.hadir || x.pre !== null || x.post !== null)) return UI.toast('Peserta sudah memiliki absensi/nilai, tidak bisa dikeluarkan.', 'bad');
        if (!await UI.konfirmasi('Keluarkan <b>' + esc(b.dataset.n) + '</b> dari pelatihan ini?', { ok: 'Keluarkan', bahaya: true })) return;
        const lama = d.peserta; d.peserta = d.peserta.filter(y => y.id_umkm !== b.dataset.id); gambar(); UI.toast('Peserta dikeluarkan.');
        API.call('peserta_hapus', { id_pelatihan: id, id_umkm: b.dataset.id }).catch(e => { d.peserta = lama; gambar(); UI.gagal(e); });
      },
      togel: b => this.aksiTogel(b, v => { d.pelatihan.aktivitas[b.dataset.k] = v; }),
      syarat: async b => {
        const sy = {};
        SYARAT.forEach(s => sy[s[0]] = $('[name="sy_' + s[0] + '"]', isi).checked);
        try { await UI.sibuk(b, async () => { const r = await API.call('syarat_set', { id_pelatihan: id, syarat: sy }); UI.toast(r.message); }); muat(); } catch (e) { UI.gagal(e); }
      },
      salinHp: b => UI.salin(b.dataset.hp),
      gantiPeserta: b => {
        const x = d.peserta.find(y => y.id_umkm === b.dataset.id);
        if (!x) return;
        const lama = { nama_pemilik: x.nama_pemilik, perwakilan: x.perwakilan, no_hp: x.no_hp, gender_peserta: x.gender_peserta };
        UI.form({
          title: 'Ubah Peserta — ' + x.nama_umkm, submit: 'Simpan', latar: true, pesanSimpan: 'Menyimpan peserta…',
          intro: '<div class="card well tight t-sm" style="margin-bottom:14px">Pemilik UMKM: <b>' + esc(x.pemilik) + '</b>. Isi nama karyawan/perwakilan bila yang ikut bukan pemilik; kosongkan untuk kembali ke pemilik.</div>',
          fields: [
            { name: 'nama_peserta', label: 'Nama peserta yang ikut', full: true, value: x.perwakilan ? x.nama_pemilik : '', placeholder: x.pemilik },
            { name: 'gender', label: 'Gender', type: 'seg', value: x.perwakilan ? x.gender_peserta : '', options: [['Laki-laki', 'Laki-laki'], ['Perempuan', 'Perempuan']] },
            { name: 'no_hp', label: 'No. WhatsApp peserta (opsional)', type: 'tel', value: x.hp_peserta || '', attrs: 'inputmode="tel"' }
          ],
          cek: v => { if (v.no_hp && !/^(\+?62|0)8\d{7,12}$/.test(v.no_hp.replace(/[\s-]/g, ''))) throw new Error('Nomor WhatsApp tidak valid.'); },
          segera: v => {
            const kn = t => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
            const wakil = !!v.nama_peserta && kn(v.nama_peserta) !== kn(x.pemilik);
            Object.assign(x, { nama_pemilik: wakil ? v.nama_peserta : x.pemilik, perwakilan: wakil, gender_peserta: wakil ? v.gender : '', hp_peserta: wakil ? v.no_hp : '' });
            gambar();
            return () => { Object.assign(x, lama); gambar(); };
          },
          onSubmit: async v => { const r = await API.call('peserta_ubah', { id_pelatihan: id, id_umkm: x.id_umkm, nama_peserta: v.nama_peserta, gender: v.gender, no_hp: v.no_hp }); UI.toast(r.message); }
        });
      }
    });
    muat();
  },

  pTab_peserta(d) {
    const p = d.pelatihan;
    return '<div class="card"><div class="card-h"><div class="h-sm">Daftar Peserta</div><button class="btn primary sm" data-aksi="daftar">' + UI.ic('plus', 'sm') + 'Daftarkan Peserta</button></div>' +
      (d.peserta.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>UMKM</th><th>No. HP</th>' + p.tanggal_hari.map((t, i) => '<th class="center">H' + (i + 1) + '</th>').join('') +
        '<th class="num">Pre</th><th class="num">Post</th><th class="num">Tugas</th><th class="center">Eval</th><th>Status</th><th></th></tr></thead><tbody>' +
        d.peserta.map(x => '<tr><td><div class="semi">' + esc(x.nama_umkm) + '</div><div class="t-xs muted row g4 wrap">' + UI.ic('user', 'sm') + '<span>' + esc(x.nama_pemilik) + '</span>' + (x.perwakilan ? '<span class="chip info sm" title="Pemilik: ' + esc(x.pemilik) + '">perwakilan</span>' : '') + '<span>· ' + esc(x.sektor) + '</span>' +
          '<button class="link t-xs" data-aksi="gantiPeserta" data-id="' + esc(x.id_umkm) + '">' + UI.ic('edit', 'sm') + 'ubah peserta</button></div></td>' +
          '<td><button class="link" data-aksi="salinHp" data-hp="' + esc(x.no_hp) + '">' + esc(x.no_hp) + '</button></td>' +
          p.tanggal_hari.map((t, i) => '<td class="center">' + (x.absen[i + 1] ? '<span class="c-ok" title="' + esc(x.absen[i + 1]) + '">' + UI.ic('checkCircle', 'sm') + '</span>' : '<span class="faint">–</span>') + '</td>').join('') +
          '<td class="num">' + UI.angka(x.pre) + '</td><td class="num">' + UI.angka(x.post) + '</td><td class="num">' + x.tugas_kumpul + '/' + x.tugas_total + (x.skor_tugas !== null ? ' <span class="t-xs muted">(' + UI.angka(x.skor_tugas) + ')</span>' : '') + '</td>' +
          '<td class="center">' + (x.evaluasi ? '<span class="c-ok">' + UI.ic('check', 'sm') + '</span>' : '<span class="faint">–</span>') + '</td>' +
          '<td><span title="' + esc(x.kurang.join(' · ')) + '">' + UI.chipLulus(x.lulus) + '</span>' + (x.sertifikat_terbit ? ' <span class="chip info sm">' + UI.ic('award', 'sm') + '</span>' : '') + '</td>' +
          '<td><button class="btn icon sm ghost" data-aksi="keluar" data-id="' + esc(x.id_umkm) + '" data-n="' + esc(x.nama_umkm) + '" title="Keluarkan">' + UI.ic('x', 'sm') + '</button></td></tr>').join('') +
        '</tbody></table></div><div class="hint mt8">Arahkan kursor ke status untuk melihat syarat yang belum terpenuhi.</div>'
        : UI.kosong('Belum ada peserta. Daftarkan UMKM binaan (pemilik atau karyawannya) ke pelatihan ini.', 'users')) + '</div>';
  },
  pTab_aktivitas(d) {
    const p = d.pelatihan;
    return '<div class="grid g2" style="align-items:start"><div class="card"><div class="card-h"><div><div class="h-sm">Buka / Tutup Aktivitas</div><div class="t-sm muted">Peserta hanya bisa mengakses saat dibuka</div></div></div><div class="list">' +
      AKTIVITAS.filter(a => a[0] !== 'absen_2' || p.jumlah_hari === 2).map(a => '<div class="item"><div class="ic-tile sm">' + UI.ic(a[2], 'sm') + '</div><div class="grow"><div class="semi">' + a[1] + '</div><div class="t-xs muted">' + a[3] +
        (a[0].indexOf('absen_') === 0 ? ' · ' + esc(UI.tglHari(p.tanggal_hari[+a[0].slice(-1) - 1])) : '') + '</div></div>' + this.togel(a[0], p.aktivitas[a[0]], p.id_pelatihan) + '</div>').join('') + '</div></div>' +
      '<div class="card"><div class="card-h"><div><div class="h-sm">Syarat Kelulusan</div><div class="t-sm muted">Status lulus dihitung ulang otomatis</div></div></div>' +
      SYARAT.map(s => '<label class="check"><input type="checkbox" name="sy_' + s[0] + '"' + (p.syarat[s[0]] ? ' checked' : '') + '>' + s[1] + (s[0] === 'hadir' ? ' (' + p.jumlah_hari + ' hari)' : '') + '</label>').join('') +
      '<button class="btn primary sm mt12" data-aksi="syarat">Simpan Syarat</button></div></div>';
  },
  pTab_info(d) {
    const p = d.pelatihan;
    return '<div class="grid g2" style="align-items:start"><div class="card"><dl class="kv">' +
      [['ID', p.id_pelatihan], ['Tema', p.tema || '-'], ['Cakupan', p.cakupan === 'sektor' ? 'Sektor ' + p.sektor : 'Umum'], ['Instruktur', p.instruktur], ['Jumlah hari', p.jumlah_hari + ' hari'],
        ['Tanggal', p.tanggal_hari.map((t, i) => 'Hari ' + (i + 1) + ': ' + UI.tglHari(t)).join('<br>')], ['Jam', p.jam], ['Format', p.format], ['Lokasi/Link', p.lokasi_atau_link], ['Kuota', p.kuota], ['Jumlah tugas', d.jumlah_tugas],
        ['Dokumentasi', p.link_dokumentasi ? '<a href="' + esc(p.link_dokumentasi) + '" target="_blank" rel="noopener">' + UI.ic('link', 'sm') + ' Buka dokumentasi</a>' : '<span class="faint">Belum ada — isi lewat tombol Ubah</span>']]
        .map(x => '<dt>' + x[0] + '</dt><dd>' + (x[0] === 'Tanggal' || x[0] === 'Dokumentasi' ? x[1] : esc(x[1])) + '</dd>').join('') + '</dl></div>' +
      '<div class="card"><div class="card-h"><div class="h-sm">Flyer Pelatihan</div><button class="btn secondary sm" data-aksi="flyer">' + UI.ic('upload', 'sm') + (p.flyer ? 'Ganti' : 'Unggah') + '</button></div>' +
      (p.flyer ? '<img src="' + esc(p.flyer) + '" alt="Flyer" referrerpolicy="no-referrer" style="width:100%;border-radius:12px;background:var(--blush-2)">' : UI.kosong('Belum ada flyer. Flyer tampil di beranda peserta selama pelatihan belum selesai.', 'image')) + '</div></div>';
  },

  async unggahFlyer(b, id, sesudah) {
    const f = (await UI.pilihFile('image/jpeg,image/png', false))[0];
    if (!f) return;
    try {
      await UI.sibuk(b, async () => {
        const x = await UI.kompres(f, 1600);
        if (x.size > 5 * 1048576) throw new Error('Ukuran flyer maksimal 5 MB.');
        const o = await UI.fileKeObj(x);
        const r = await API.call('pelatihan_flyer', { id_pelatihan: id, file: { nama: o.nama, tipe: o.tipe, data: o.data } });
        UI.toast(r.message);
      }, 'Mengunggah…');
      sesudah && sesudah();
    } catch (e) { UI.gagal(e); }
  },

  async modalDaftarkan(d, sesudah) {
    const p = d.pelatihan;
    const ada = {};
    d.peserta.forEach(x => ada[x.id_umkm] = true);
    const sisa = p.kuota - d.peserta.length;
    const m = UI.modal({ title: 'Daftarkan Peserta', wide: true, body: '<div data-b></div>', foot: '<span class="t-sm muted grow" data-info></span><button class="btn outline" data-tutup>Batal</button><button class="btn primary" data-kirim disabled>Daftarkan</button>' });
    const box = $('[data-b]', m.el);
    UI.loading(box, 2);
    let umkm;
    try { umkm = (await API.cepat('umkm_list')).filter(u => u.status_akun === 'aktif' && !ada[u.id_umkm]).map(u => Object.assign({}, u)); } catch (e) { return UI.galat(box, e); }
    const pilih = {}, wakil = {}; // wakil[id] = { nama_peserta, gender, no_hp } — boleh karyawan/perwakilan
    let q = '', sek = p.cakupan === 'sektor' ? p.sektor : '';
    const info = $('[data-info]', m.el), kirim = $('[data-kirim]', m.el);
    const cocok = u => pilih[u.id_umkm] || ((!sek || u.sektor === sek) && (!q || (u.nama_umkm + ' ' + u.nama_pemilik + ' ' + u.no_hp).toLowerCase().indexOf(q) >= 0));
    const hitung = () => {
      const n = Object.keys(pilih).length, tunggu = umkm.some(u => u._kirim && pilih[u.id_umkm]);
      info.textContent = tunggu ? 'Menunggu data UMKM baru tersimpan…' : n + ' dipilih · sisa kuota ' + sisa;
      kirim.disabled = !n || n > sisa || tunggu; info.style.color = n > sisa ? 'var(--bad)' : '';
    };
    const gambar = () => {
      const t = umkm.filter(cocok).sort((a, b) => (!!pilih[b.id_umkm] - !!pilih[a.id_umkm]) || (!!b._baru - !!a._baru) || a.nama_umkm.localeCompare(b.nama_umkm));
      $('[data-l]', box).innerHTML = t.length ? t.map(u => {
        const on = !!pilih[u.id_umkm], w = wakil[u.id_umkm] || {};
        return '<div class="item" style="flex-direction:column;align-items:stretch;padding:10px 14px' + (u._baru ? ';border-color:var(--ok);background:var(--ok-bg)' : (on ? ';border-color:var(--primary)' : '')) + '">' +
          '<label class="row" style="cursor:pointer"><input type="checkbox" data-id="' + esc(u.id_umkm) + '"' + (on ? ' checked' : '') + ' style="width:20px;height:20px;accent-color:var(--primary)"><div class="grow"><div class="semi t-sm">' + esc(u.nama_umkm) + (u._baru ? ' <span class="chip ok sm">Baru</span>' : '') + (u._kirim ? ' <span class="chip warn sm">Menyimpan…</span>' : '') + '</div>' +
          '<div class="t-xs muted">Pemilik: ' + esc(u.nama_pemilik) + ' · ' + esc(u.sektor) + ' · ' + esc(u.no_hp) + '</div></div><span class="t-xs muted">' + (u._baru ? 'PIN awal ' + esc(u.pin) : u.jumlah_pelatihan + ' pelatihan') + '</span></label>' +
          (on ? '<div class="row wrap g8 mt8" style="padding-left:30px"><div class="field grow" style="min-width:180px;gap:4px"><span class="t-xs semi muted">Nama peserta yang ikut</span><input class="input" style="height:38px" data-w="nama_peserta" data-u="' + esc(u.id_umkm) + '" value="' + esc(w.nama_peserta !== undefined ? w.nama_peserta : u.nama_pemilik) + '" placeholder="' + esc(u.nama_pemilik) + '"></div>' +
            '<div class="field" style="gap:4px"><span class="t-xs semi muted">Gender</span><select class="select" style="height:38px;width:auto" data-w="gender" data-u="' + esc(u.id_umkm) + '"><option value="">–</option>' + ['Laki-laki', 'Perempuan'].map(g => '<option' + ((w.gender || (w.nama_peserta === undefined ? u.gender : '')) === g ? ' selected' : '') + '>' + g + '</option>').join('') + '</select></div>' +
            '<div class="field" style="min-width:150px;gap:4px"><span class="t-xs semi muted">No. WA peserta (opsional)</span><input class="input" style="height:38px" type="tel" inputmode="tel" data-w="no_hp" data-u="' + esc(u.id_umkm) + '" value="' + esc(w.no_hp || '') + '" placeholder="bila karyawan"></div></div>' : '') + '</div>';
      }).join('') : UI.kosong('Tidak ada UMKM aktif yang cocok (atau semua sudah terdaftar).', 'users', '<button class="btn secondary sm" data-baruumkm>' + UI.ic('plus', 'sm') + 'Tambah UMKM Baru</button>');
      hitung();
    };
    box.innerHTML = '<div class="card well tight" style="margin-bottom:14px"><div class="t-sm"><b>Peserta boleh karyawan/perwakilan UMKM.</b> Centang UMKM-nya, lalu ubah <i>Nama peserta yang ikut</i> bila bukan pemilik. Peserta tetap tercatat atas nama UMKM tersebut.</div>' +
      '<div class="row wrap g8 mt12"><button class="btn primary sm" data-wakil>' + UI.ic('users', 'sm') + 'Tambah Peserta dari UMKM Terdaftar</button><button class="btn secondary sm" data-baruumkm>' + UI.ic('plus', 'sm') + 'UMKM Baru</button></div></div>' +
      '<div class="row wrap"><div class="input-ic grow" style="min-width:220px">' + UI.ic('search', 'sm') + '<input class="input" style="height:42px" placeholder="Cari nama UMKM, pemilik, atau HP…" data-q></div>' +
      '<select class="select" style="height:42px;width:auto" data-s><option value="">Semua sektor</option>' + SEKTOR.map(s => '<option' + (s === sek ? ' selected' : '') + '>' + s + '</option>').join('') + '</select>' +
      '<button class="btn outline sm" data-semua>Pilih semua yang tampil</button></div><div class="list mt12" data-l style="max-height:52vh;overflow:auto"></div>';
    $('[data-q]', box).oninput = e => { q = e.target.value.toLowerCase(); gambar(); };
    $('[data-s]', box).onchange = e => { sek = e.target.value; gambar(); };
    $('[data-semua]', box).onclick = () => { umkm.filter(cocok).forEach(u => { if (!u._kirim) pilih[u.id_umkm] = true; }); gambar(); };
    // Tambah peserta (perwakilan/karyawan) dari UMKM yang sudah terdaftar
    $('[data-wakil]', box).onclick = () => {
      const opsi = umkm.filter(u => !u._kirim).sort((a, b) => a.nama_umkm.localeCompare(b.nama_umkm));
      if (!opsi.length) return UI.toast('Semua UMKM aktif sudah terdaftar di pelatihan ini.', 'info');
      UI.form({
        title: 'Tambah Peserta dari UMKM Terdaftar', submit: 'Tambahkan',
        intro: '<div class="card well tight t-sm" style="margin-bottom:14px">Pilih UMKM/usaha yang sudah ada, lalu isi nama orang yang diutus mengikuti pelatihan ini (boleh karyawan).</div>',
        fields: [
          { name: 'id_umkm', label: 'UMKM / Usaha', type: 'select', full: true, value: '', options: [['', '— Pilih UMKM —']].concat(opsi.map(u => [u.id_umkm, u.nama_umkm + ' · ' + u.sektor + ' (pemilik: ' + u.nama_pemilik + ')'])) },
          { name: 'nama_peserta', label: 'Nama Peserta', full: true, placeholder: 'Nama karyawan / perwakilan yang ikut' },
          { name: 'gender', label: 'Gender', type: 'seg', value: '', options: [['Laki-laki', 'Laki-laki'], ['Perempuan', 'Perempuan']] },
          { name: 'no_hp', label: 'No. WhatsApp peserta (opsional)', type: 'tel', placeholder: '08xxxxxxxxxx', attrs: 'inputmode="tel"' }
        ],
        onSubmit: async v => {
          if (!v.id_umkm) throw new Error('Pilih UMKM / usaha.');
          if (!v.nama_peserta) throw new Error('Isi nama peserta.');
          if (v.no_hp && !/^(\+?62|0)8\d{7,12}$/.test(v.no_hp.replace(/[\s-]/g, ''))) throw new Error('Nomor WhatsApp tidak valid.');
          pilih[v.id_umkm] = true;
          wakil[v.id_umkm] = { nama_peserta: v.nama_peserta, gender: v.gender, no_hp: v.no_hp };
          q = ''; $('[data-q]', box).value = '';
          gambar();
          UI.toast(v.nama_peserta + ' ditambahkan sebagai peserta ' + opsi.find(u => u.id_umkm === v.id_umkm).nama_umkm + '. Klik Daftarkan untuk menyimpan.', 'info');
        }
      });
    };
    box.addEventListener('click', e => {
      if (!e.target.closest('[data-baruumkm]')) return;
      this.formUmkm(null, { sektorAwal: p.cakupan === 'sektor' ? p.sektor : '', submit: 'Simpan & Pilih' }, {
        segera: obj => { obj._baru = true; umkm.unshift(obj); pilih[obj.id_umkm] = true; q = ''; sek = ''; $('[data-q]', box).value = ''; $('[data-s]', box).value = ''; gambar(); return () => { umkm = umkm.filter(x => x !== obj); delete pilih[obj.id_umkm]; gambar(); }; },
        selesai: obj => { if (obj.id_lama && pilih[obj.id_lama]) { delete pilih[obj.id_lama]; pilih[obj.id_umkm] = true; if (wakil[obj.id_lama]) { wakil[obj.id_umkm] = wakil[obj.id_lama]; delete wakil[obj.id_lama]; } } if (m.el.isConnected) gambar(); }
      });
    });
    $('[data-l]', box).addEventListener('change', e => {
      const id = e.target.dataset.id;
      if (id) { if (e.target.checked) pilih[id] = true; else delete pilih[id]; gambar(); return; }
      const u = e.target.dataset.u, k = e.target.dataset.w;
      if (u && k) { wakil[u] = wakil[u] || {}; wakil[u][k] = e.target.value.trim(); }
    });
    $('[data-l]', box).addEventListener('input', e => { const u = e.target.dataset.u, k = e.target.dataset.w; if (u && k) { wakil[u] = wakil[u] || {}; wakil[u][k] = e.target.value; } });
    kirim.onclick = async () => {
      const peserta = Object.keys(pilih).map(id => { const w = wakil[id] || {}, u = umkm.find(x => x.id_umkm === id) || {};
        return { id_umkm: id, nama_peserta: (w.nama_peserta !== undefined ? w.nama_peserta : u.nama_pemilik || '').trim(), gender: w.gender || (w.nama_peserta === undefined ? u.gender : '') || '', no_hp: (w.no_hp || '').trim() }; });
      const salahHp = peserta.find(x => x.no_hp && !/^(\+?62|0)8\d{7,12}$/.test(x.no_hp.replace(/[\s-]/g, '')));
      if (salahHp) return UI.toast('Nomor WA peserta ' + (salahHp.nama_peserta || '') + ' tidak valid.', 'bad');
      try { await UI.sibuk(kirim, async () => { const r = await API.call('peserta_daftarkan', { id_pelatihan: p.id_pelatihan, peserta: peserta }); UI.toast(r.message); }, 'Menyimpan…'); m.close(); sesudah(); } catch (e) { UI.gagal(e); }
    };
    gambar();
  },


  /** Form UMKM (tambah/ubah). Dipakai di tab Peserta dan di "Daftarkan UMKM". */
  formUmkm(u, opt, aksi) {
    opt = opt || {};
    if (typeof aksi === 'function') aksi = { selesai: aksi };
    aksi = aksi || {};
    const ubah = !!(u && u.id_umkm);
    u = u || {};
    let obj = null, cadangan = null;
    const hpNorm = v => v.no_hp.replace(/\D/g, '').replace(/^62/, '0');
    UI.form({
      title: ubah ? 'Ubah Data UMKM' : 'Tambah UMKM Baru', wide: true, submit: opt.submit || (ubah ? 'Simpan Perubahan' : 'Simpan'),
      latar: true, pesanSimpan: 'Menyimpan data UMKM…',
      fields: [
        { name: 'nama_umkm', label: 'Nama UMKM / Usaha', value: u.nama_umkm, full: true, placeholder: 'mis. Dapur Bunda Lia', hint: 'Dipakai untuk masuk aplikasi, jadi harus berbeda dari UMKM lain.' },
        { name: 'nama_pemilik', label: 'Nama Pemilik / Peserta Utama', value: u.nama_pemilik, placeholder: 'Nama pemilik usaha' },
        { name: 'gender', label: 'Gender', type: 'seg', value: u.gender || '', options: [['Laki-laki', 'Laki-laki'], ['Perempuan', 'Perempuan']] },
        { name: 'no_hp', label: 'Nomor WhatsApp', type: 'tel', value: u.no_hp, placeholder: '08xxxxxxxxxx', attrs: 'inputmode="tel" autocomplete="off"' },
        { name: 'spesialisasi', label: 'Produk / spesialisasi (opsional)', value: u.spesialisasi, placeholder: 'mis. Keripik singkong' },
        { name: 'sektor', label: 'Sektor Usaha', type: 'seg', value: u.sektor || opt.sektorAwal || '', options: SEKTOR.map(x => [x, x]), full: true },
        { name: 'alamat', label: 'Alamat Singkat', value: u.alamat, full: true, placeholder: 'mis. Jl. Cakung Raya No. 12, Cakung Barat' }
      ],
      cek: v => {
        if (!v.nama_umkm) throw new Error('Nama UMKM / usaha wajib diisi.');
        if (!v.nama_pemilik) throw new Error('Nama pemilik wajib diisi.');
        if (!v.gender) throw new Error('Pilih gender.');
        if (!/^(\+?62|0)8\d{7,12}$/.test(v.no_hp.replace(/[\s-]/g, ''))) throw new Error('Nomor WhatsApp tidak valid (contoh 081234567890).');
        if (!v.sektor) throw new Error('Pilih sektor usaha.');
        const kn = n => String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const c = Simpan.get(Simpan.kunci('umkm_list', {}));
        const dup = c && c.d.find(x => kn(x.nama_umkm) === kn(v.nama_umkm) && x.id_umkm !== u.id_umkm);
        if (dup) throw new Error('Nama UMKM "' + v.nama_umkm + '" sudah dipakai (' + dup.nama_pemilik + '). Tambahkan nama pemilik atau lokasi agar berbeda.');
      },
      segera: v => {
        if (ubah) { cadangan = Object.assign({}, u); Object.assign(u, v, { no_hp: hpNorm(v), _kirim: true }); obj = u; }
        else obj = Object.assign({ id_umkm: 'tmp-' + Date.now().toString(36), pin: '····', status_akun: 'aktif', wajib_ganti_pin: 'ya', jumlah_pelatihan: 0 }, v, { no_hp: hpNorm(v), _kirim: true });
        const batalLuar = aksi.segera ? aksi.segera(obj) : null;
        return () => { if (ubah) { Object.keys(u).forEach(k => delete u[k]); Object.assign(u, cadangan); } if (batalLuar) batalLuar(); };
      },
      onSubmit: async v => {
        const r = await API.call('umkm_simpan', Object.assign({ id_umkm: ubah ? u.id_umkm : undefined, gender_wajib: true }, v));
        delete obj._kirim;
        if (!ubah) { obj.id_lama = obj.id_umkm; obj.id_umkm = r.id_umkm; obj.pin = r.pin; }
        UI.toast(ubah ? 'Data ' + v.nama_umkm + ' tersimpan.' : v.nama_umkm + ' tersimpan · PIN awal ' + r.pin + '. Kirim info akses dari Manajemen Akses.');
        aksi.selesai && aksi.selesai(obj, r);
      }
    });
  },


  waNomor(hp) { hp = String(hp || '').replace(/\D/g, ''); return hp.indexOf('0') === 0 ? '62' + hp.slice(1) : hp; },
  linkWaKe(hp, teks) { return 'https://wa.me/' + this.waNomor(hp) + (teks ? '?text=' + encodeURIComponent(teks) : ''); },

  /** Tampilkan PIN peserta + tombol kirim via WhatsApp. */
  tampilPin(u, pin, judul) {
    const pesan = 'Halo ' + u.nama_pemilik + ', akun ' + APP_CONFIG.nama + ' ' + u.nama_umkm + ' siap dipakai.\nMasuk: ' + location.origin + location.pathname + '\nPilih tab Peserta UMKM\nNama UMKM: ' + u.nama_umkm + '\nPIN: ' + pin + '\nAnda akan diminta mengganti PIN saat pertama masuk.';
    UI.modal({
      title: judul || 'PIN Peserta',
      body: '<div class="center col g8"><div class="t-sm muted">' + esc(u.nama_umkm) + ' · ' + esc(u.no_hp) + '</div><div style="font-size:44px;font-weight:700;letter-spacing:.3em;color:var(--primary)">' + esc(pin) + '</div>' +
        '<div class="hint">' + (u.wajib_ganti_pin === 'ya' ? 'Peserta wajib mengganti PIN ini saat pertama masuk.' : 'PIN yang sedang dipakai peserta.') + '</div></div>',
      foot: '<button class="btn outline" data-salin>' + UI.ic('copy', 'sm') + 'Salin</button><a class="btn primary" target="_blank" rel="noopener" href="' + this.linkWaKe(u.no_hp, pesan) + '">' + UI.ic('message', 'sm') + 'Kirim via WhatsApp</a>',
      onOpen: m => { $('[data-salin]', m.el).onclick = () => UI.salin(pin); }
    });
  },
  /** Tampilkan kode akses instruktur + tombol kirim via WhatsApp. */
  tampilKode(i, kode, judul) {
    const pesan = 'Halo ' + i.nama + ', berikut akses Portal Instruktur ' + APP_CONFIG.nama + '.\nMasuk: ' + location.origin + location.pathname + '\nPilih tab Instruktur\nNama: ' + i.nama + '\nKode akses: ' + kode;
    UI.modal({
      title: judul || 'Kode Akses Instruktur',
      body: '<div class="center col g8"><div class="t-sm muted">' + esc(i.nama) + (i.institusi ? ' · ' + esc(i.institusi) : '') + '</div><div style="font-size:36px;font-weight:700;letter-spacing:.12em;color:var(--primary)">' + esc(kode) + '</div>' +
        '<div class="hint">Instruktur masuk dengan nama lengkap persis seperti di atas + kode ini.</div></div>',
      foot: '<button class="btn outline" data-salin>' + UI.ic('copy', 'sm') + 'Salin</button>' + (i.no_hp ? '<a class="btn primary" target="_blank" rel="noopener" href="' + this.linkWaKe(i.no_hp, pesan) + '">' + UI.ic('message', 'sm') + 'Kirim via WhatsApp</a>' : ''),
      onOpen: m => { $('[data-salin]', m.el).onclick = () => UI.salin(kode); }
    });
  },

  // ===========================================================
  // INSTRUKTUR — database pengajar / narasumber
  // ===========================================================
  async instruktur(el) {
    el.innerHTML = Kelola.kepala('Instruktur', 'Database pengajar & narasumber pelatihan', '<button class="btn primary sm" data-aksi="baru">' + UI.ic('plus', 'sm') + 'Tambah Instruktur</button>') + '<div data-isi></div>';
    const isi = $('[data-isi]', el);
    let rows = [], q = '';
    const gambar = () => {
      if (!$('[data-list]', isi)) {
        isi.innerHTML = '<div class="grid g4" data-stat></div><div class="card mt20"><div class="row between wrap" style="margin-bottom:14px"><div class="h-sm">Daftar Instruktur</div>' +
          '<div class="input-ic" style="min-width:260px">' + UI.ic('search', 'sm') + '<input class="input" style="height:42px" placeholder="Cari nama, institusi, atau nomor HP…" data-q></div></div><div data-list></div></div>';
        $('[data-q]', isi).oninput = e => { q = e.target.value.toLowerCase(); gambar(); };
      }
      const inst = new Set(rows.map(i => i.institusi).filter(Boolean)).size;
      $('[data-stat]', isi).innerHTML = [['Total instruktur', rows.length, ''], ['Aktif', rows.filter(i => i.status === 'aktif').length, 'c-ok'], ['Institusi', inst, ''], ['Pelatihan diampu', rows.reduce((s, i) => s + i.jumlah_pelatihan, 0), 'c-primary']]
        .map(x => '<div class="card stat"><span class="l">' + x[0] + '</span><span class="v ' + x[2] + '">' + x[1] + '</span></div>').join('');
      const t = rows.filter(i => !q || (i.nama + ' ' + i.institusi + ' ' + i.no_hp).toLowerCase().indexOf(q) >= 0);
      $('[data-list]', isi).innerHTML = t.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nama</th><th>Institusi</th><th>Nomor HP</th><th class="num">Pelatihan</th><th>Status</th><th></th></tr></thead><tbody>' +
        t.map(i => '<tr style="cursor:pointer' + (i._kirim ? ';opacity:.7' : '') + '" data-buka="' + esc(i.id_instruktur) + '"><td><div class="row g8"><div class="ic-tile sm solid" style="width:34px;height:34px;font-size:12px;font-weight:700">' + esc(UI.inisial(i.nama)) + '</div><span class="semi">' + esc(i.nama) + '</span>' + (i._kirim ? '<span class="chip warn sm">Menyimpan…</span>' : '') + '</div></td>' +
          '<td>' + (i.institusi ? esc(i.institusi) : '<span class="faint">–</span>') + '</td><td>' + (i.no_hp ? '<a href="' + this.linkWaKe(i.no_hp) + '" target="_blank" rel="noopener" data-stop>' + esc(i.no_hp) + '</a>' : '<span class="faint">–</span>') + '</td>' +
          '<td class="num">' + i.jumlah_pelatihan + '</td><td>' + (i.status === 'aktif' ? '<span class="chip ok dot sm">Aktif</span>' : '<span class="chip info sm">Nonaktif</span>') + '</td>' +
          '<td><button class="btn icon sm secondary" data-aksi="ubah" data-id="' + esc(i.id_instruktur) + '" title="Ubah data">' + UI.ic('edit', 'sm') + '</button></td></tr>').join('') + '</tbody></table></div><div class="hint mt8">Klik baris untuk melihat rincian & riwayat mengajar. Kode akses dan status akun diatur di menu Manajemen Akses.</div>'
        : UI.kosong(rows.length ? 'Tidak ada instruktur yang cocok.' : 'Belum ada instruktur. Klik "Tambah Instruktur".', 'user');
    };
    const muat = async () => {
      if (!$('[data-list]', isi)) UI.loading(isi, 2);
      try { await API.ambil('instruktur_list', {}, x => { rows = x; gambar(); }, { el: isi }); } catch (e) { UI.galat(isi, e, muat); }
    };
    const form = i => {
      const ubah = !!(i && i.id_instruktur);
      i = i || {};
      let obj = null, cadangan = null;
      UI.form({
        title: ubah ? 'Ubah Data Instruktur' : 'Tambah Instruktur', submit: 'Simpan', latar: true, pesanSimpan: 'Menyimpan data instruktur…',
        intro: ubah ? '' : '<div class="card well tight t-sm" style="margin-bottom:16px">Kode akses dibuat otomatis. Kirim ke instruktur secara manual dari <b>Manajemen Akses → Akun Instruktur</b> (tombol WhatsApp).</div>',
        fields: [
          { name: 'nama', label: 'Nama lengkap (dipakai saat masuk)', value: i.nama, full: true },
          { name: 'institusi', label: 'Institusi', value: i.institusi, full: true, placeholder: 'mis. Politeknik Kreatif Jakarta, Dinas KUKM, praktisi mandiri' },
          { name: 'no_hp', label: 'Nomor HP / WhatsApp', type: 'tel', value: i.no_hp, full: true, placeholder: '08xxxxxxxxxx', attrs: 'inputmode="tel"' }
        ],
        cek: v => {
          if (!v.nama) throw new Error('Nama instruktur wajib diisi.');
          if (v.no_hp && !/^(\+?62|0)8\d{7,12}$/.test(v.no_hp.replace(/[\s-]/g, ''))) throw new Error('Nomor HP tidak valid (contoh 081234567890).');
        },
        segera: v => {
          if (ubah) { cadangan = Object.assign({}, i); Object.assign(i, v, { _kirim: true }); obj = i; }
          else { obj = Object.assign({ id_instruktur: 'tmp-' + Date.now().toString(36), kode_akses: '…', status: 'aktif', jumlah_pelatihan: 0, _kirim: true }, v); rows.push(obj); }
          gambar();
          return () => { if (ubah) { Object.keys(i).forEach(k => delete i[k]); Object.assign(i, cadangan); } else rows = rows.filter(x => x !== obj); gambar(); };
        },
        onSubmit: async v => {
          const r = await API.call('instruktur_simpan', Object.assign({ id_instruktur: ubah ? i.id_instruktur : undefined }, v));
          delete obj._kirim;
          if (!ubah) { obj.id_instruktur = r.id_instruktur; obj.kode_akses = r.kode_akses; }
          if (isi.isConnected) gambar();
          UI.toast(ubah ? 'Data ' + v.nama + ' tersimpan.' : v.nama + ' tersimpan. Kode akses dibuat — kirim dari Manajemen Akses → Akun Instruktur.');
        }
      });
    };

    UI.klik(el, { baru: () => form(), ubah: b => { const ins = rows.find(i => i.id_instruktur === b.dataset.id); if (ins && !ins._kirim) form(ins); } });
    isi.addEventListener('click', e => {
      if (e.target.closest('[data-aksi],[data-stop]')) return;
      const r = e.target.closest('[data-buka]');
      const ins = r && rows.find(i => i.id_instruktur === r.dataset.buka);
      if (ins && !ins._kirim) this.detailInstruktur(ins, () => form(ins));
    });
    muat();
  },

  async detailInstruktur(i, ubah) {
    if (!i) return;
    const m = UI.modal({
      title: 'Rincian Instruktur', wide: true,
      body: '<div class="row" style="margin-bottom:16px"><div class="ic-tile solid" style="width:52px;height:52px;font-weight:700">' + esc(UI.inisial(i.nama)) + '</div><div class="grow"><div class="h-md">' + esc(i.nama) + '</div><div class="t-sm muted">' + esc(i.institusi || 'Institusi belum diisi') + '</div></div>' +
        (i.status === 'aktif' ? '<span class="chip ok dot sm">Aktif</span>' : '<span class="chip info sm">Nonaktif</span>') + '</div>' +
        '<dl class="kv"><dt>Nomor HP</dt><dd>' + (i.no_hp ? '<a href="' + this.linkWaKe(i.no_hp) + '" target="_blank" rel="noopener">' + esc(i.no_hp) + ' (WhatsApp)</a>' : '–') + '</dd><dt>Pelatihan diampu</dt><dd>' + i.jumlah_pelatihan + '</dd><dt>Akses masuk</dt><dd><a href="#/akses/instruktur" data-tutup>Kelola di Manajemen Akses</a></dd></dl>' +
        '<div class="h-sm mt20" style="margin-bottom:10px">Riwayat Mengajar</div><div data-pel></div>',
      foot: '<button class="btn outline" data-tutup>Tutup</button><button class="btn primary" data-ubah>' + UI.ic('edit', 'sm') + 'Ubah Data</button>'
    });
    $('[data-ubah]', m.el).onclick = () => { m.close(); ubah(); };
    const box = $('[data-pel]', m.el);
    UI.loading(box, 1);
    try {
      const pel = (await Kelola.daftarPel()).filter(p => p.id_instruktur === i.id_instruktur);
      box.innerHTML = pel.length ? '<div class="list">' + pel.map(p => '<a class="item" href="#/pelatihan/' + esc(p.id_pelatihan) + '" data-tutup style="color:inherit"><div class="ic-tile sm">' + UI.ic('cap', 'sm') + '</div><div class="grow"><div class="semi">' + esc(p.judul) + '</div><div class="meta"><span>' + esc(UI.rentang(p)) + ' (' + p.jumlah_hari + ' hari)</span><span>' + p.jumlah_peserta + ' peserta</span></div></div>' + UI.chipStatus(p.status) + '</a>').join('') + '</div>'
        : UI.kosong('Belum pernah mengampu pelatihan.', 'cap');
    } catch (e) { UI.galat(box, e); }
  },

  // ===========================================================
  // PESERTA — database & rekap UMKM binaan
  // ===========================================================
  async peserta(el) {
    el.innerHTML = Kelola.kepala('Peserta UMKM', 'Database UMKM binaan & rekap pelatihan yang diikuti', '<button class="btn outline sm" data-aksi="impor">' + UI.ic('upload', 'sm') + 'Impor</button><button class="btn primary sm" data-aksi="baru">' + UI.ic('plus', 'sm') + 'Tambah UMKM</button>') + '<div data-isi></div>';
    const isi = $('[data-isi]', el);
    let rows = [], q = '', sek = '', urut = 'nama', hal = 1;
    const per = 20;
    const gambar = () => {
      const t = rows.filter(u => (!sek || u.sektor === sek) && (!q || (u.nama_umkm + ' ' + u.nama_pemilik + ' ' + u.no_hp + ' ' + u.spesialisasi + ' ' + u.alamat).toLowerCase().indexOf(q) >= 0))
        .sort(urut === 'pelatihan' ? (a, b) => b.jumlah_pelatihan - a.jumlah_pelatihan || a.nama_umkm.localeCompare(b.nama_umkm) : (a, b) => a.nama_umkm.localeCompare(b.nama_umkm));
      $('[data-list]', isi).innerHTML = t.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>UMKM</th><th>Sektor</th><th>No. WhatsApp</th><th>Alamat</th><th class="num">Pelatihan diikuti</th><th></th></tr></thead><tbody>' +
        t.slice((hal - 1) * per, hal * per).map(u => '<tr style="cursor:pointer' + (u._kirim ? ';opacity:.7' : '') + '" data-buka="' + esc(u.id_umkm) + '"><td><div class="semi">' + esc(u.nama_umkm) + (u._kirim ? ' <span class="chip warn sm">Menyimpan…</span>' : '') + (u.status_akun !== 'aktif' ? ' <span class="chip bad sm">Nonaktif</span>' : '') + '</div><div class="t-xs muted">' + esc(u.nama_pemilik) + (u.gender ? ' (' + (u.gender === 'Perempuan' ? 'P' : 'L') + ')' : '') + (u.spesialisasi ? ' · ' + esc(u.spesialisasi) : '') + '</div></td>' +
          '<td>' + esc(u.sektor) + '</td><td>' + esc(u.no_hp) + '</td><td><div class="t-sm clamp1" style="max-width:220px">' + (u.alamat ? esc(u.alamat) : '<span class="faint">–</span>') + '</div></td>' +
          '<td class="num"><span class="chip ' + (u.jumlah_pelatihan ? 'solid' : 'line') + ' sm">' + u.jumlah_pelatihan + ' pelatihan</span></td>' +
          '<td><div class="row g4"><button class="btn icon sm secondary" data-aksi="ubah" data-id="' + esc(u.id_umkm) + '" title="Ubah data"' + (u._kirim ? ' disabled' : '') + '>' + UI.ic('edit', 'sm') + '</button>' + UI.ic('chevR', 'sm') + '</div></td></tr>').join('') +
        '</tbody></table></div>' + UI.halaman(t.length, hal, per) + '<div class="hint mt8">Klik baris untuk melihat rincian pelatihan yang pernah diikuti. PIN & status akun diatur di menu Manajemen Akses.</div>'
        : UI.kosong(rows.length ? 'Tidak ada UMKM yang cocok.' : 'Belum ada data UMKM. Tambah satu per satu atau impor dari Excel.', 'users');
    };
    const pasang = () => {
      if (!$('[data-list]', isi)) {
        isi.innerHTML = '<div class="grid g4" data-stat></div>' +
          '<div class="card mt20"><div class="row between wrap" style="margin-bottom:14px"><div class="seg pill" data-s><button data-v="" class="on">Semua</button>' + SEKTOR.map(s => '<button data-v="' + s + '">' + s + '</button>').join('') + '</div>' +
          '<div class="row g8 wrap"><select class="select" style="height:42px;width:auto" data-urut><option value="nama">Urut: Nama A–Z</option><option value="pelatihan">Urut: Paling sering ikut</option></select>' +
          '<div class="input-ic" style="min-width:240px">' + UI.ic('search', 'sm') + '<input class="input" style="height:42px" placeholder="Cari UMKM, peserta, HP, alamat…" data-q></div></div></div><div data-list></div></div>';
        $('[data-s]', isi).onclick = e => { const b = e.target.closest('button'); if (!b) return; sek = b.dataset.v; hal = 1; $$('[data-s] button', isi).forEach(x => x.classList.toggle('on', x === b)); gambar(); };
        $('[data-urut]', isi).onchange = e => { urut = e.target.value; hal = 1; gambar(); };
        let tunda;
        $('[data-q]', isi).oninput = e => { clearTimeout(tunda); tunda = setTimeout(() => { q = e.target.value.toLowerCase(); hal = 1; gambar(); }, 150); };
      }
      const n = s => rows.filter(u => u.sektor === s).length;
      $('[data-stat]', isi).innerHTML = SEKTOR.map(s => '<div class="card stat"><span class="l">' + s + '</span><span class="v">' + n(s) + '</span></div>').join('');
      $('[data-s] button[data-v=""]', isi).textContent = 'Semua (' + rows.length + ')';
      gambar();
    };
    const muat = async () => {
      if (!$('[data-list]', isi)) UI.loading(isi, 2);
      try { await API.ambil('umkm_list', {}, x => { rows = x; pasang(); }, { el: isi }); } catch (e) { UI.galat(isi, e, muat); }
    };
    UI.klik(el, {
      baru: () => this.formUmkm(null, {}, { segera: o => { rows.push(o); pasang(); return () => { rows = rows.filter(x => x !== o); pasang(); }; }, selesai: () => { if (isi.isConnected) pasang(); } }),
      ubah: b => { const u = rows.find(x => x.id_umkm === b.dataset.id); this.formUmkm(u, {}, { segera: () => { pasang(); return () => pasang(); }, selesai: () => { if (isi.isConnected) pasang(); } }); },
      hal: b => { hal = +b.dataset.h; gambar(); },
      impor: () => this.modalImpor(muat)
    });
    isi.addEventListener('click', e => {
      if (e.target.closest('[data-aksi]')) return;
      const r = e.target.closest('[data-buka]');
      if (r) { const u = rows.find(x => x.id_umkm === r.dataset.buka); if (u && !u._kirim) this.detailUmkm(u, () => this.formUmkm(u, {}, { segera: () => { pasang(); return () => pasang(); }, selesai: () => { if (isi.isConnected) pasang(); } })); }
    });
    muat();
  },

  detailUmkm(u, ubah) {
    if (!u) return;
    const m = UI.modal({
      title: 'Rincian UMKM', wide: true,
      body: '<div class="row" style="margin-bottom:16px"><div class="ic-tile">' + UI.ic('store') + '</div><div class="grow"><div class="h-md">' + esc(u.nama_umkm) + '</div><div class="t-sm muted">' + esc(u.nama_pemilik) + (u.gender ? ' · ' + esc(u.gender) : '') + '</div></div><span class="chip">' + esc(u.sektor) + '</span></div>' +
        '<dl class="kv"><dt>No. WhatsApp</dt><dd><a href="' + this.linkWaKe(u.no_hp) + '" target="_blank" rel="noopener">' + esc(u.no_hp) + '</a></dd><dt>Produk / spesialisasi</dt><dd>' + esc(u.spesialisasi || '–') + '</dd>' +
        '<dt>Alamat</dt><dd>' + esc(u.alamat || '–') + '</dd><dt>Terdaftar sejak</dt><dd>' + esc(UI.tglPendek(String(u.tgl_dibuat || '').split(' ')[0])) + '</dd><dt>Status akun</dt><dd>' + (u.status_akun === 'aktif' ? 'Aktif' : 'Nonaktif') + ' · <a href="#/akses/peserta" data-tutup>kelola akses</a></dd></dl>' +
        '<div class="h-sm mt20" style="margin-bottom:10px">Pelatihan yang Pernah Diikuti</div><div data-pel></div>',
      foot: '<button class="btn outline" data-tutup>Tutup</button><button class="btn primary" data-ubah>' + UI.ic('edit', 'sm') + 'Ubah Data</button>'
    });
    $('[data-ubah]', m.el).onclick = () => { m.close(); ubah(); };
    const box = $('[data-pel]', m.el);
    UI.loading(box, 2);
    API.ambil('umkm_riwayat', { id_umkm: u.id_umkm }, rows => {
      const lulus = rows.filter(r => r.lulus).length, hadir = rows.reduce((s, r) => s + r.hadir, 0), hari = rows.reduce((s, r) => s + r.jumlah_hari, 0);
      box.innerHTML = rows.length ? '<div class="grid g3" style="margin-bottom:14px"><div class="card well tight center"><div class="t-xs muted">Pelatihan diikuti</div><div class="h-lg c-primary">' + rows.length + '</div></div>' +
        '<div class="card well tight center"><div class="t-xs muted">Lulus</div><div class="h-lg c-ok">' + lulus + '</div></div><div class="card well tight center"><div class="t-xs muted">Kehadiran</div><div class="h-lg">' + (hari ? Math.round(hadir / hari * 100) : 0) + '%</div></div></div>' +
        '<div class="list">' + rows.map(r => '<a class="item" href="#/pelatihan/' + esc(r.id_pelatihan) + '" data-tutup style="color:inherit;align-items:flex-start;flex-wrap:wrap"><div class="ic-tile sm">' + UI.ic('cap', 'sm') + '</div><div class="grow" style="min-width:200px"><div class="row g8 wrap"><span class="semi">' + esc(r.judul) + '</span>' + UI.chipStatus(r.status) + '</div>' +
          '<div class="meta"><span>' + esc(String(r.tanggal).replace(/\d{4}-\d{2}-\d{2}/g, x => UI.tglPendek(x))) + '</span><span>' + esc(r.instruktur) + '</span>' + (r.nama_peserta ? '<span>Peserta: ' + esc(r.nama_peserta) + ' (perwakilan)</span>' : '') + '</div>' +
          '<div class="meta mt8"><span>Hadir ' + r.hadir + '/' + r.jumlah_hari + '</span><span>Pre ' + UI.angka(r.pre) + ' → Post ' + UI.angka(r.post) + (r.kenaikan !== null ? ' (' + (r.kenaikan > 0 ? '+' : '') + UI.angka(r.kenaikan) + ')' : '') + '</span><span>Tugas ' + r.tugas_kumpul + '/' + r.tugas_total + '</span>' + (r.no_sertifikat ? '<span>No. ' + esc(r.no_sertifikat) + '</span>' : '') + '</div></div>' +
          '<div class="col g4" style="align-items:flex-end">' + UI.chipLulus(r.lulus) + (r.sertifikat ? '<span class="chip info sm">' + UI.ic('award', 'sm') + 'Sertifikat</span>' : '') + '</div></a>').join('') + '</div>'
        : UI.kosong('Belum pernah mengikuti pelatihan. Daftarkan dari halaman detail pelatihan.', 'cap');
    }, { el: box }).catch(e => UI.galat(box, e));
  },

  modalImpor(sesudah) {
    const KOLOM = ['nama_umkm', 'nama_pemilik', 'sektor', 'spesialisasi', 'no_hp', 'alamat', 'pin', 'gender'];
    let rows = [];
    const m = UI.modal({
      title: 'Impor Data UMKM', wide: true,
      body: '<div class="col"><div class="t-sm">Salin dari Excel / Google Sheets (hasil Google Form) lalu tempel di bawah. Urutan kolom:</div>' +
        '<div class="row wrap g4">' + KOLOM.map((k, i) => '<span class="chip line sm">' + (i + 1) + '. ' + k + '</span>').join('') + '</div>' +
        '<div class="hint">Baris judul boleh ikut ditempel (akan dilewati). Sektor: ' + SEKTOR.join(', ') + '. PIN kosong = dibuat acak. Gender: L/P (boleh kosong). Maks 500 baris.</div>' +
        '<textarea class="textarea" style="min-height:180px;font-family:ui-monospace,monospace;font-size:12.5px" data-t placeholder="Dapur Bunda Lia\tLia Amalia\tKuliner\tKue kering\t081234567890\tJl. Cakung Raya 12\t"></textarea>' +
        '<div data-prev></div><div class="err" hidden data-err></div></div>',
      foot: '<button class="btn outline" data-tutup>Batal</button><button class="btn primary" data-kirim disabled>Impor</button>'
    });
    const t = $('[data-t]', m.el), prev = $('[data-prev]', m.el), kirim = $('[data-kirim]', m.el), err = $('[data-err]', m.el);
    t.oninput = () => {
      rows = t.value.split(/\r?\n/).map(l => l.split('\t')).filter(c => c.join('').trim())
        .filter(c => !/nama.?umkm/i.test(c[0]))
        .map(c => { const o = {}; KOLOM.forEach((k, i) => o[k] = String(c[i] || '').trim()); o.sektor = SEKTOR.find(s => s.toLowerCase() === o.sektor.toLowerCase()) || o.sektor; return o; });
      prev.innerHTML = rows.length ? '<div class="tbl-wrap" style="max-height:220px"><table class="tbl"><thead><tr>' + KOLOM.slice(0, 5).map(k => '<th>' + k + '</th>').join('') + '</tr></thead><tbody>' +
        rows.slice(0, 50).map(r => '<tr>' + KOLOM.slice(0, 5).map(k => '<td>' + esc(r[k]) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div><div class="hint mt8">' + rows.length + ' baris siap diimpor' + (rows.length > 50 ? ' (pratinjau 50 baris pertama)' : '') + '.</div>' : '';
      kirim.disabled = !rows.length;
    };
    kirim.onclick = async () => {
      err.hidden = true;
      try {
        let r;
        await UI.sibuk(kirim, async () => { r = await API.call('umkm_import', { rows: rows }); });
        UI.toast(r.message); sesudah();
        if (r.gagal.length) { err.innerHTML = '<b>Baris dilewati:</b><br>' + r.gagal.map(esc).join('<br>'); err.hidden = false; } else m.close();
      } catch (e) { err.textContent = e.message; err.hidden = false; }
    };
  },

  // ===========================================================
  // ABSENSI
  // ===========================================================
  async absensi(el) {
    el.innerHTML = Kelola.kepala('Absensi', 'Peserta absen lewat scan QR di ruang pelatihan atau tombol absen di aplikasi', '<span data-picker></span><button class="btn outline sm" data-aksi="segar">' + UI.ic('refresh', 'sm') + 'Segarkan</button><button class="btn outline sm" data-aksi="pdf">' + UI.ic('download', 'sm') + 'Ekspor PDF</button><button class="btn primary sm" data-aksi="qr">' + UI.ic('checkSquare', 'sm') + 'QR Absensi</button>') + '<div data-isi></div>';
    const isi = $('[data-isi]', el);
    let idPel = '', detAbs = null;
    const muat = async () => {
      if (!idPel) { isi.innerHTML = Kelola.tanpaPelatihan(); return; }
      UI.loading(isi, 2);
      try {
        const idA = idPel;
        await API.ambil('pelatihan_detail', { id_pelatihan: idA }, d => { if (idA !== idPel) return;
        detAbs = d;
        const p = d.pelatihan, n = d.peserta.length;
        isi.innerHTML = '<div class="grid ' + (p.jumlah_hari === 2 ? 'g2' : '') + '">' + p.tanggal_hari.map((t, i) => {
          const h = i + 1, hadir = d.peserta.filter(x => x.absen[h]).length, k = 'absen_' + h;
          return '<div class="card"><div class="row between"><div><div class="h-sm">Hari ' + h + '</div><div class="t-sm muted">' + esc(UI.tglHari(t)) + (t === UI.hariIni() ? ' · <b class="c-primary">Hari ini</b>' : '') + '</div></div><div class="row g8"><span class="t-sm semi">' + (p.aktivitas[k] ? 'Dibuka' : 'Ditutup') + '</span>' + this.togel(k, p.aktivitas[k], p.id_pelatihan) + '</div></div>' +
            '<div class="row between mt20"><span class="h-lg">' + hadir + ' <span class="t-sm muted">/ ' + n + ' hadir</span></span><span class="chip ' + (n && hadir === n ? 'ok' : 'warn') + ' sm">' + (n ? Math.round(hadir / n * 100) : 0) + '%</span></div><div class="bar ok mt8"><i style="width:' + (n ? hadir / n * 100 : 0) + '%"></i></div></div>';
        }).join('') + '</div>' +
          '<div class="card mt20"><div class="card-h"><div class="h-sm">Rekap Kehadiran</div><span class="chip sm">' + n + ' peserta</span></div>' +
          (n ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>UMKM</th>' + p.tanggal_hari.map((t, i) => '<th>Hari ' + (i + 1) + '</th>').join('') + '<th>Total</th></tr></thead><tbody>' +
            d.peserta.map(x => '<tr><td><div class="semi">' + esc(x.nama_umkm) + '</div><div class="t-xs muted">' + esc(x.nama_pemilik) + '</div></td>' + p.tanggal_hari.map((t, i) => '<td>' + (x.absen[i + 1] ? '<span class="chip ok sm">' + UI.ic('check', 'sm') + UI.jam(x.absen[i + 1]) + '</span>' + ((x.metode_absen || {})[i + 1] === 'qr' ? ' <span class="chip info sm" title="Absen lewat scan QR">QR</span>' : '') : '<span class="chip line sm">Belum</span>') + '</td>').join('') +
              '<td class="semi">' + x.hadir + '/' + x.jumlah_hari + '</td></tr>').join('') + '</tbody></table></div>' : UI.kosong('Belum ada peserta terdaftar.', 'users')) + '</div>';
        }, { el: isi, segar: 3000 });
      } catch (e) { UI.galat(isi, e, muat); }
    };
    UI.klik(el, {
      segar: b => UI.sibuk(b, async () => { await API.call('pelatihan_detail', { id_pelatihan: idPel }); muat(); }).catch(UI.gagal),
      qr: () => {
        if (!idPel || !detAbs || !detAbs.qr_kode) return UI.toast('Pilih pelatihan terlebih dahulu.', 'info');
        this.modalQR(detAbs.pelatihan, detAbs.qr_kode);
      },
      pdf: b => {
        if (!idPel) return UI.toast('Pilih pelatihan terlebih dahulu.', 'info');
        UI.sibuk(b, async () => { const r = await API.call('absensi_export', { id_pelatihan: idPel }, { retry: 2 }); UI.unduhBase64(r); UI.toast('PDF absensi diunduh: ' + r.nama); }, 'Menyusun PDF…').catch(UI.gagal);
      },
      togel: b => this.aksiTogel(b, v => { const t = b.parentNode.querySelector('.t-sm.semi'); if (t) t.textContent = v ? 'Dibuka' : 'Ditutup'; })
    });
    try { await Kelola.pemilih($('[data-picker]', el), {}, id => { idPel = id; muat(); }); } catch (e) { UI.galat(isi, e, () => this.absensi(el)); }
  },

  /** QR absensi per pelatihan: tampil di layar/proyektor, unduh PNG, salin tautan. */
  modalQR(p, kode) {
    const url = location.origin + location.pathname + '#/absen/' + encodeURIComponent(p.id_pelatihan) + '/' + kode;
    const judul = /^pelatihan\b/i.test(p.judul) ? p.judul : 'Pelatihan ' + p.judul;
    const m = UI.modal({
      title: 'QR Absensi', wide: true,
      body: '<div class="grid g2" style="align-items:center"><div class="card tight" style="max-width:320px;margin:0 auto;width:100%"><div data-qr style="aspect-ratio:1"></div></div>' +
        '<div class="col g8"><div class="h-sm">' + esc(judul) + '</div><div class="t-sm muted">' + esc(UI.rentang(p)) + ' · ' + esc(p.jam) + '</div>' +
        '<div class="card well tight t-sm mt8"><b>Cara pakai</b><br>1. Tampilkan QR di layar/proyektor atau cetak di pintu masuk.<br>2. Peserta scan dengan kamera HP (tanpa login).<br>3. Pilih Hari 1/2, isi Nama UMKM & Nama Peserta.<br>4. Hanya UMKM yang terdaftar di pelatihan ini yang diterima — langsung tercatat di sini & di akun peserta.</div>' +
        '<div class="hint">Hari yang bisa diisi: tanggal pelaksanaan hari itu, atau hari yang sakelar absensinya sedang dibuka.</div>' +
        '<div class="row g8 mt8"><input class="input" style="height:40px;font-size:12px" readonly value="' + esc(url) + '" data-url><button class="btn icon sm secondary" data-salin title="Salin tautan">' + UI.ic('copy', 'sm') + '</button></div></div></div>',
      foot: '<button class="btn outline" data-unduh>' + UI.ic('download', 'sm') + 'Unduh PNG</button><button class="btn primary" data-layar>' + UI.ic('eye', 'sm') + 'Tampilkan Layar Penuh</button>'
    });
    UI.qr($('[data-qr]', m.el), url, 600);
    $('[data-salin]', m.el).onclick = () => UI.salin(url);
    $('[data-layar]', m.el).onclick = () => this.layarQR(judul, p, url);
    $('[data-unduh]', m.el).onclick = async e => {
      const b = e.currentTarget;
      try {
        await UI.sibuk(b, async () => {
          const src = $('[data-qr] canvas', m.el) || $('[data-qr] img', m.el);
          if (!src) throw new Error('QR belum siap.');
          if (src.tagName === 'IMG' && !src.complete) await new Promise(r => { src.onload = r; src.onerror = r; });
          const W = 1240, H = 1600, c = document.createElement('canvas'); c.width = W; c.height = H;
          const g = c.getContext('2d');
          g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
          g.fillStyle = UI.warna('primary'); g.fillRect(0, 0, W, 190);
          g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.font = 'bold 64px Arial'; g.fillText('SCAN ABSENSI', W / 2, 120);
          g.fillStyle = UI.warna('primary-press'); g.font = 'bold 52px Arial';
          const baris = []; let l = '';
          judul.split(' ').forEach(w => { if (g.measureText(l + ' ' + w).width > W - 140) { baris.push(l); l = w; } else l = (l ? l + ' ' : '') + w; });
          baris.push(l);
          baris.slice(0, 3).forEach((t, i) => g.fillText(t, W / 2, 290 + i * 66));
          const y0 = 290 + Math.min(3, baris.length) * 66 + 10;
          g.fillStyle = '#665559'; g.font = '34px Arial'; g.fillText(UI.rentang(p) + ' · ' + (p.jam || ''), W / 2, y0);
          g.drawImage(src, (W - 860) / 2, y0 + 40, 860, 860);
          g.fillStyle = '#231B1E'; g.font = 'bold 38px Arial'; g.fillText('Pusat Pendampingan UMKM Cakung', W / 2, H - 150);
          g.fillStyle = '#665559'; g.font = '30px Arial'; g.fillText('Buka kamera HP → scan → pilih hari → isi nama UMKM & peserta', W / 2, H - 95);
          const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = 'QR Absensi - ' + p.judul.replace(/[\\/:*?"<>|]/g, '') + '.png'; a.click();
        }, 'Menyiapkan…');
      } catch (ex) { UI.gagal('Gagal membuat PNG: ' + ex.message + '. Gunakan screenshot sebagai alternatif.'); }
    };
  },
  layarQR(judul, p, url) {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:200;background:linear-gradient(160deg,' + UI.warna('primary') + ',' + UI.warna('primary-press') + ');display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:24px;color:#fff;text-align:center';
    ov.innerHTML = '<button aria-label="Tutup" style="position:absolute;top:18px;right:18px;width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.18);color:#fff" data-x>' + UI.ic('x') + '</button>' +
      '<div style="font-size:clamp(14px,2vw,20px);letter-spacing:.2em;font-weight:700;opacity:.85">SCAN ABSENSI</div><div style="font-size:clamp(22px,3.4vw,42px);font-weight:800;max-width:1000px;line-height:1.2">' + esc(judul) + '</div>' +
      '<div style="font-size:clamp(13px,1.6vw,18px);opacity:.85">' + esc(UI.rentang(p)) + ' · ' + esc(p.jam) + '</div>' +
      '<div style="background:#fff;padding:18px;border-radius:24px;width:min(62vh,80vw)"><div data-qr2 style="aspect-ratio:1"></div></div>' +
      '<div style="font-size:clamp(13px,1.6vw,18px);opacity:.9">Buka kamera HP → scan → pilih hari → isi nama UMKM & nama peserta</div><div style="font-weight:700">Pusat Pendampingan UMKM Cakung</div>';
    document.body.appendChild(ov);
    UI.qr($('[data-qr2]', ov), url, 800);
    const tutup = () => { ov.remove(); document.removeEventListener('keydown', esc_); if (document.fullscreenElement) document.exitFullscreen().catch(() => { }); };
    const esc_ = e => { if (e.key === 'Escape') tutup(); };
    document.addEventListener('keydown', esc_);
    $('[data-x]', ov).onclick = tutup;
    if (ov.requestFullscreen) ov.requestFullscreen().catch(() => { });
  },

  // ===========================================================
  // EVALUASI PELATIHAN
  // ===========================================================
  async evaluasi(el) {
    el.innerHTML = Kelola.kepala('Evaluasi Pelatihan', 'Hasil kepuasan peserta (tidak terlihat oleh instruktur)', '<span data-picker></span>') +
      '<div class="seg" data-mode style="max-width:360px"><button data-v="hasil" class="on">Hasil Evaluasi</button><button data-v="form">Susun Form</button></div><div class="mt20" data-isi></div>';
    const isi = $('[data-isi]', el);
    let idPel = '', mode = 'hasil';
    const JUDUL = { A: 'A. Materi & Manfaat', B: 'B. Instruktur', C: 'C. Penyelenggaraan', D: 'D. Saran & Masukan', E: 'E. Usulan Pelatihan Lanjutan' };
    const hasil = async () => {
      if (!idPel) { isi.innerHTML = Kelola.tanpaPelatihan(); return; }
      UI.loading(isi, 3);
      try {
        const idA = idPel;
        const pel = await Kelola.daftarPel();
        await API.ambil('eval_hasil', { id_pelatihan: idA }, d => { if (idA !== idPel || mode !== 'hasil') return;
        const pb = d.per_bagian, csi = v => v === null ? '–' : UI.angka(v / 4 * 100) + '%';
        const p = pel.find(x => x.id_pelatihan === idPel) || d.pelatihan;
        isi.innerHTML = '<div class="card tight row wrap between" style="margin-bottom:20px"><div class="row g8"><div class="ic-tile sm">' + UI.ic('edit', 'sm') + '</div><div><div class="semi t-sm">Form evaluasi untuk peserta</div><div class="t-xs muted">' + (p.aktivitas.evaluasi ? 'Sedang dibuka' : 'Ditutup') + '</div></div></div>' + this.togel('evaluasi', p.aktivitas.evaluasi, idPel) + '</div>' +
          '<div class="grid g4"><div class="card stat"><span class="l">Responden</span><span class="v">' + d.jumlah_jawaban + ' <span class="t-sm muted">/ ' + d.jumlah_peserta + '</span></span></div>' +
          ['A', 'B', 'C'].map(b => '<div class="card stat"><span class="l">' + JUDUL[b] + '</span><span class="v ' + (b === 'B' ? 'c-primary' : '') + '">' + csi(pb[b]) + '</span><span class="t-xs muted">Skor ' + UI.angka(pb[b], 2) + ' / 4</span></div>').join('') + '</div>' +
          ['A', 'B', 'C', 'D', 'E'].map(b => {
            const q = d.hasil.filter(h => h.bagian === b);
            if (!q.length) return '';
            return '<div class="card mt20"><div class="h-sm" style="margin-bottom:14px">' + JUDUL[b] + '</div><div class="col g20">' + q.map(h => h.tipe === 'teks'
              ? '<div><div class="semi t-sm">' + h.nomor + '. ' + esc(h.pertanyaan) + ' <span class="chip sm">' + h.teks.length + ' jawaban</span></div>' + (h.teks.length ? '<div class="list mt8" style="max-height:280px;overflow:auto">' + h.teks.map(t => '<div class="item" style="padding:10px 14px;align-items:flex-start"><div class="grow"><div class="t-sm">' + esc(t.isi) + '</div><div class="t-xs muted">' + esc(t.umkm) + '</div></div></div>').join('') + '</div>' : '<div class="t-sm muted mt8">Belum ada jawaban.</div>') + '</div>'
              : (() => { const tot = h.distribusi.reduce((s, x) => s + x, 0) || 1; return '<div><div class="row between top"><span class="t-sm semi">' + h.nomor + '. ' + esc(h.pertanyaan) + '</span><span class="chip ' + (h.rata >= 3 ? 'ok' : 'warn') + ' sm">' + UI.angka(h.rata, 2) + '</span></div>' +
                '<div class="row g4 mt8" style="height:10px;border-radius:5px;overflow:hidden;gap:2px">' + h.distribusi.map((x, i) => x ? '<span title="Skala ' + (i + 1) + ': ' + x + '" style="height:100%;flex:' + x + ';background:' + [UI.warna('blush-4'), UI.warna('mid'), UI.warna('secondary'), UI.warna('primary-press')][i] + '"></span>' : '').join('') + (h.distribusi.every(x => !x) ? '<span style="flex:1;height:100%;background:var(--blush-2)"></span>' : '') + '</div>' +
                '<div class="t-xs muted mt8">' + h.distribusi.map((x, i) => (i + 1) + ': ' + x + ' (' + Math.round(x / tot * 100) + '%)').join(' · ') + '</div></div>'; })()).join('') + '</div></div>';
          }).join('') + '<div class="legend mt12">' + ['Sangat tidak setuju', 'Tidak setuju', 'Setuju', 'Sangat setuju'].map((s, i) => '<span><i style="background:' + [UI.warna('blush-4'), UI.warna('mid'), UI.warna('secondary'), UI.warna('primary-press')][i] + '"></i>' + (i + 1) + ' ' + s + '</span>').join('') + '</div>';
        }, { el: isi });
      } catch (e) { UI.galat(isi, e, hasil); }
    };
    const form = async () => {
      const target = idPel || 'DEFAULT';
      UI.loading(isi, 2);
      let d;
      try { d = await API.call('eval_form', { id_pelatihan: target }); } catch (e) { return UI.galat(isi, e, form); }
      let q = d.pertanyaan.map(x => Object.assign({}, x));
      const pel = await Kelola.daftarPel();
      const gambar = () => {
        isi.innerHTML = '<div class="card"><div class="card-h wrap"><div><div class="h-sm">' + (target === 'DEFAULT' ? 'Form bawaan (dipakai pelatihan baru)' : 'Form untuk pelatihan ini') + '</div><div class="t-sm muted">Bagian A, B, C skala 1–4 · D & E jawaban teks</div></div>' +
          '<div class="row wrap g8"><select class="select" style="height:40px;width:auto" data-dari><option value="">Salin dari…</option><option value="DEFAULT">Form bawaan</option>' + pel.filter(p => p.id_pelatihan !== target).map(p => '<option value="' + esc(p.id_pelatihan) + '">' + esc(p.judul) + '</option>').join('') + '</select>' +
          '<button class="btn outline sm" data-aksi="salinF">' + UI.ic('copy', 'sm') + 'Salin</button></div></div>' +
          (d.jumlah_jawaban ? '<div class="card well tight row" style="margin-bottom:14px">' + UI.ic('alert', 'sm') + '<span class="t-sm">Sudah ada ' + d.jumlah_jawaban + ' jawaban. Mengubah urutan/bagian dapat membuat hasil lama tidak cocok.</span></div>' : '') +
          '<div class="list">' + q.map((x, i) => '<div class="item" style="flex-wrap:wrap"><select class="select" style="height:40px;width:74px;padding-right:28px" data-i="' + i + '" data-k="bagian">' + ['A', 'B', 'C', 'D', 'E'].map(b => '<option' + (b === x.bagian ? ' selected' : '') + '>' + b + '</option>').join('') + '</select>' +
            '<input class="input grow" style="height:40px;min-width:220px" value="' + esc(x.pertanyaan) + '" data-i="' + i + '" data-k="pertanyaan">' +
            '<select class="select" style="height:40px;width:110px;padding-right:28px" data-i="' + i + '" data-k="tipe"><option value="skala"' + (x.tipe === 'skala' ? ' selected' : '') + '>Skala 1–4</option><option value="teks"' + (x.tipe === 'teks' ? ' selected' : '') + '>Teks</option></select>' +
            '<button class="btn icon sm ghost" data-aksi="hapusQ" data-i="' + i + '">' + UI.ic('trash', 'sm') + '</button></div>').join('') + '</div>' +
          '<div class="row between wrap mt12"><button class="btn secondary sm" data-aksi="tambahQ">' + UI.ic('plus', 'sm') + 'Tambah pertanyaan</button><button class="btn primary sm" data-aksi="simpanF">Simpan Form</button></div></div>';
      };
      isi.oninput = isi.onchange = e => { const i = e.target.dataset.i, k = e.target.dataset.k; if (i !== undefined && k) q[+i][k] = e.target.value; };
      isi._peta = {
        tambahQ: () => { q.push({ bagian: 'A', pertanyaan: '', tipe: 'skala' }); gambar(); const x = $$('[data-k="pertanyaan"]', isi).pop(); x && x.focus(); },
        hapusQ: b => { q.splice(+b.dataset.i, 1); gambar(); },
        simpanF: async b => {
          const urut = q.slice().sort((a, c) => a.bagian.localeCompare(c.bagian));
          try { await UI.sibuk(b, async () => { const r = await API.call('eval_simpan_form', { id_pelatihan: target, pertanyaan: urut }); UI.toast(r.message); }); form(); } catch (e) { UI.gagal(e); }
        },
        salinF: async () => {
          const dari = $('[data-dari]', isi).value;
          if (!dari) return UI.toast('Pilih sumber form terlebih dahulu.', 'info');
          if (target === 'DEFAULT') { try { const s = await API.call('eval_form', { id_pelatihan: dari }); q = s.pertanyaan; gambar(); UI.toast('Form disalin — klik Simpan Form untuk menyimpan.', 'info'); } catch (e) { UI.gagal(e); } return; }
          if (!await UI.konfirmasi('Timpa form pelatihan ini dengan salinan form terpilih?', { ok: 'Salin' })) return;
          try { const r = await API.call('eval_salin', { dari: dari, ke: target }); UI.toast(r.message); form(); } catch (e) { UI.gagal(e); }
        }
      };
      gambar();
    };
    UI.klik(isi, new Proxy({}, { get: (_, k) => (isi._peta && isi._peta[k]) || (k === 'togel' ? b => this.aksiTogel(b, () => Kelola.segarkanPel()) : undefined) }));
    const jalan = () => { isi.oninput = isi.onchange = null; isi._peta = null; mode === 'hasil' ? hasil() : form(); };
    $('[data-mode]', el).onclick = e => { const b = e.target.closest('button'); if (!b) return; mode = b.dataset.v; $$('[data-mode] button', el).forEach(x => x.classList.toggle('on', x === b)); rebuildPicker(); };
    const rebuildPicker = async () => {
      try { await Kelola.pemilih($('[data-picker]', el), mode === 'form' ? { semua: true, id: idPel } : {}, id => { idPel = id; jalan(); }); } catch (e) { UI.galat(isi, e, rebuildPicker); }
      if (mode === 'form') { const o = $('[data-picker] option[value=""]', el); if (o) o.textContent = 'Form bawaan (template)'; }
    };
    rebuildPicker();
  },

  // ===========================================================
  // SERTIFIKAT
  // ===========================================================
  async sertifikat(el) {
    el.innerHTML = Kelola.kepala('Sertifikat', 'Template Slides/PPTX → PDF otomatis untuk peserta lulus', '<span data-picker></span>') + '<div data-isi></div>';
    const isi = $('[data-isi]', el);
    let idPel = '', d = null;
    const muat = async () => {
      if (!idPel) { isi.innerHTML = Kelola.tanpaPelatihan(); return; }
      UI.loading(isi, 3);
      const idA = idPel;
      try { await API.ambil('sert_status', { id_pelatihan: idA }, x => { if (idA === idPel && !isi._terbit) { d = x; gambar(); } }, { el: isi }); } catch (e) { UI.galat(isi, e, muat); }
    };
    const gambar = () => {
      const t = d.template, r = d.ringkas;
      isi.innerHTML = '<div class="grid g3"><div class="card stat"><span class="l">Peserta</span><span class="v">' + r.total + '</span></div><div class="card stat"><span class="l">Memenuhi syarat lulus</span><span class="v c-ok">' + r.lulus + '</span></div><div class="card stat"><span class="l">Sertifikat terbit</span><span class="v c-primary">' + r.terbit + ' <span class="t-sm muted">/ ' + r.lulus + '</span></span></div></div>' +
        '<div class="grid g2 mt20" style="align-items:start"><div class="card"><div class="card-h"><div class="h-sm">Template Sertifikat</div>' + (t ? '<span class="chip ' + (t.sumber === 'khusus' ? 'solid' : 'info') + ' sm">' + (t.sumber === 'khusus' ? 'Khusus pelatihan ini' : 'Template bawaan') + '</span>' : '') + '</div>' +
        (t ? '<div class="item"><div class="ic-tile">' + UI.ic('award') + '</div><div class="grow"><div class="semi clamp1">' + esc(t.nama) + '</div><div class="t-xs muted">Google Slides · 1 halaman</div></div>' + (t.url ? '<a class="btn sm outline" href="' + esc(t.url) + '" target="_blank" rel="noopener">Buka</a>' : '') + '</div>' + (t.rusak ? '<div class="err mt8">Template tidak dapat dibuka. Unggah ulang.</div>' : '')
          : '<div class="card well tight t-sm">Belum ada template. Unggah PPTX atau tempel link Google Slides (1 halaman).</div>') +
        '<div class="t-xs muted mt12">Penanda yang diganti otomatis: {{nama_umkm}} {{nama_pemilik}} {{judul_pelatihan}} {{tanggal_pelatihan}} {{no_sertifikat}}</div>' +
        '<div class="row wrap g8 mt12"><button class="btn secondary sm" data-aksi="pptx" data-khusus="1">' + UI.ic('upload', 'sm') + 'Unggah PPTX (khusus)</button><button class="btn outline sm" data-aksi="link" data-khusus="1">' + UI.ic('link', 'sm') + 'Link Slides (khusus)</button>' +
        (t && t.sumber === 'khusus' ? '<button class="btn ghost sm" data-aksi="hapusKhusus">Pakai template bawaan</button>' : '') + '</div>' +
        '<div class="row wrap g8 mt8"><button class="btn outline sm" data-aksi="pptx">' + UI.ic('upload', 'sm') + 'Ganti template bawaan (PPTX)</button><button class="btn outline sm" data-aksi="link">' + UI.ic('link', 'sm') + 'Link bawaan</button></div></div>' +
        '<div class="card"><div class="h-sm">Terbitkan</div><div class="t-sm muted mt8">Sertifikat PDF dibuat untuk peserta yang memenuhi syarat lulus dan disimpan di folder Drive Sertifikat/' + esc(idPel) + '. Proses berjalan bertahap otomatis.</div>' +
        '<div class="bar mt20" data-pbar hidden><i style="width:0"></i></div><div class="t-sm semi mt8" data-pteks></div>' +
        '<div class="row wrap g8 mt12"><button class="btn outline sm" data-aksi="pratinjau"' + (t ? '' : ' disabled') + '>' + UI.ic('eye', 'sm') + 'Pratinjau</button>' +
        '<button class="btn primary sm" data-aksi="terbit"' + (t && r.lulus ? '' : ' disabled') + '>' + UI.ic('award', 'sm') + 'Terbitkan (' + (r.lulus - r.terbit) + ' baru)</button>' +
        (r.terbit ? '<button class="btn danger sm" data-aksi="ulang">' + UI.ic('refresh', 'sm') + 'Terbitkan ulang semua</button>' : '') + '</div></div></div>' +
        '<div class="card mt20"><div class="card-h"><div class="h-sm">Status Peserta</div></div>' + (d.peserta.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>UMKM</th><th>Kelulusan</th><th>No. Sertifikat</th><th>Status</th></tr></thead><tbody>' +
          d.peserta.map(x => '<tr><td><div class="semi">' + esc(x.nama_umkm) + '</div><div class="t-xs muted">' + esc(x.nama_pemilik) + '</div></td><td>' + UI.chipLulus(x.lulus) + (x.kurang.length ? '<div class="t-xs muted mt8">' + x.kurang.map(esc).join(' · ') + '</div>' : '') + '</td>' +
            '<td class="num">' + esc(x.no_sertifikat || '–') + '</td><td>' + (x.terbit ? '<span class="chip ok sm">' + UI.ic('check', 'sm') + 'Terbit</span>' : (x.lulus ? '<span class="chip warn sm">Menunggu</span>' : '<span class="faint">–</span>')) + '</td></tr>').join('') + '</tbody></table></div>' : UI.kosong('Belum ada peserta.', 'users')) + '</div>';
    };
    const terbitkan = async (b, ulang) => {
      const bar = $('[data-pbar]', isi), teks = $('[data-pteks]', isi);
      isi._terbit = true;
      bar.hidden = false;
      $$('button', isi).forEach(x => x.disabled = true);
      try {
        let r, pertama = true;
        do {
          teks.textContent = 'Memproses sertifikat… jangan tutup halaman ini.';
          r = await API.call('sert_terbitkan', { id_pelatihan: idPel, ulang: ulang && pertama }, { retry: 3 });
          pertama = false;
          $('i', bar).style.width = Math.round((r.total - r.sisa) / r.total * 100) + '%';
          teks.textContent = r.message;
        } while (r.sisa > 0);
        UI.toast(r.message);
      } catch (e) { UI.gagal(e); teks.textContent = e.message + ' — klik Terbitkan lagi untuk melanjutkan.'; }
      isi._terbit = false;
      muat();
    };
    UI.klik(isi, {
      pptx: async b => {
        const f = (await UI.pilihFile('.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation', false))[0];
        if (!f) return;
        if (!/\.pptx$/i.test(f.name)) return UI.toast('Pilih file PowerPoint (.pptx).', 'bad');
        if (f.size > 20 * 1048576) return UI.toast('Ukuran template maksimal 20 MB.', 'bad');
        try { await UI.sibuk(b, async () => { const o = await UI.fileKeObj(f); const r = await API.call('sert_template', { id_pelatihan: b.dataset.khusus ? idPel : '', file: { nama: o.nama, data: o.data } }); UI.toast(r.message); }, 'Mengonversi…'); muat(); } catch (e) { UI.gagal(e); }
      },
      link: b => UI.form({
        title: b.dataset.khusus ? 'Template khusus pelatihan ini' : 'Template bawaan', submit: 'Simpan',
        fields: [{ name: 'link', label: 'Link Google Slides', full: true, placeholder: 'https://docs.google.com/presentation/d/…', hint: 'Pastikan akun pemilik Apps Script bisa membuka file ini. Template harus 1 halaman.' }],
        onSubmit: async v => { const r = await API.call('sert_template', { id_pelatihan: b.dataset.khusus ? idPel : '', link: v.link }); UI.toast(r.message); muat(); }
      }),
      hapusKhusus: async () => { try { const r = await API.call('sert_template', { id_pelatihan: idPel, hapus_khusus: true }); UI.toast(r.message); muat(); } catch (e) { UI.gagal(e); } },
      pratinjau: async b => { try { await UI.sibuk(b, async () => { const f = await API.call('sert_preview', { id_pelatihan: idPel }); UI.lihatBerkas(f, 'Pratinjau · ' + (f.contoh || '')); }, 'Membuat…'); } catch (e) { UI.gagal(e); } },
      terbit: b => terbitkan(b, false),
      ulang: async b => { if (await UI.konfirmasi('Hapus semua PDF sertifikat pelatihan ini lalu buat ulang? Nomor sertifikat tetap sama.', { ok: 'Terbitkan ulang', bahaya: true })) terbitkan(b, true); }
    });
    try { await Kelola.pemilih($('[data-picker]', el), {}, id => { idPel = id; muat(); }); } catch (e) { UI.galat(isi, e, () => this.sertifikat(el)); }
  },

  // ===========================================================
  // LAPORAN REKAP
  // ===========================================================
  async laporan(el) {
    el.innerHTML = Kelola.kepala('Laporan Rekap', 'Grafik & tabel peserta · unduh Excel/PDF sesuai template', '<button class="btn outline sm" data-aksi="unduh" data-f="xlsx">' + UI.ic('download', 'sm') + 'Excel</button><button class="btn primary sm" data-aksi="unduh" data-f="pdf">' + UI.ic('download', 'sm') + 'PDF</button>') + '<div data-isi></div>';
    const isi = $('[data-isi]', el);
    UI.loading(isi, 3);
    let d, f = { id_pelatihan: '', sektor: '', bulan: '', nama: '' }, hal = 1;
    try { d = await API.cepat('laporan_data'); } catch (e) { return UI.galat(isi, e, () => this.laporan(el)); }
    const pel = {};
    d.rekap.forEach(r => pel[r.id_pelatihan] = r.pelatihan);
    d.evaluasi.forEach(e => pel[e.id_pelatihan] = pel[e.id_pelatihan] || e.judul);
    const bulan = Array.from(new Set(d.rekap.map(r => r.bulan).concat(d.evaluasi.map(e => e.bulan)))).filter(Boolean).sort().reverse();
    const rata = a => { a = a.filter(x => x !== null && x !== undefined); return a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length * 10) / 10 : null; };
    isi.innerHTML = '<div class="card"><div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">' +
      '<div class="field"><label>Pelatihan</label><select class="select" data-k="id_pelatihan"><option value="">Semua pelatihan</option>' + Object.keys(pel).map(k => '<option value="' + esc(k) + '">' + esc(pel[k]) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Sektor</label><select class="select" data-k="sektor"><option value="">Semua sektor</option>' + SEKTOR.map(s => '<option>' + s + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Bulan</label><select class="select" data-k="bulan"><option value="">Semua periode</option>' + bulan.map(b => '<option value="' + b + '">' + UI.bulanLabel(b) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>Nama UMKM</label><input class="input" data-k="nama" placeholder="Cari…"></div></div></div><div class="col g20 mt20" data-hasil></div>';
    const gambar = () => {
      const q = f.nama.toLowerCase();
      const rows = d.rekap.filter(r => (!f.id_pelatihan || r.id_pelatihan === f.id_pelatihan) && (!f.sektor || r.sektor === f.sektor) && (!f.bulan || r.bulan === f.bulan) && (!q || (r.nama_umkm + ' ' + r.nama_pemilik).toLowerCase().indexOf(q) >= 0));
      const ev = d.evaluasi.filter(e => e.n && (!f.id_pelatihan || e.id_pelatihan === f.id_pelatihan) && (!f.bulan || e.bulan === f.bulan));
      const lulus = rows.filter(r => r.lulus).length, penuh = rows.filter(r => r.hadir >= r.jumlah_hari).length;
      // Kelompokkan per program (pelatihan), urut tanggal pelaksanaan
      const pm = {};
      rows.forEach(r => { (pm[r.id_pelatihan] = pm[r.id_pelatihan] || { judul: r.pelatihan, tema: r.tema, tgl: r.tgl_mulai || r.bulan, rows: [] }).rows.push(r); });
      const prog = Object.keys(pm).map(k => pm[k]).sort((a, b) => String(a.tgl).localeCompare(String(b.tgl)));
      const gulir = (n, svg) => n > 5 ? '<div style="overflow-x:auto"><div style="min-width:' + (n * 110) + 'px">' + svg + '</div></div>' : svg;
      const per = 20;
      const box = $('[data-hasil]', isi);
      box.innerHTML = '<div class="grid g4"><div class="card stat"><span class="l">Peserta (baris)</span><span class="v">' + rows.length + '</span><span class="t-xs muted">' + new Set(rows.map(r => r.id_umkm)).size + ' UMKM unik</span></div>' +
        '<div class="card stat"><span class="l">Kelulusan</span><span class="v c-ok">' + (rows.length ? Math.round(lulus / rows.length * 100) : 0) + '%</span><span class="t-xs muted">' + lulus + ' lulus</span></div>' +
        '<div class="card stat"><span class="l">Hadir penuh</span><span class="v">' + (rows.length ? Math.round(penuh / rows.length * 100) : 0) + '%</span></div>' +
        '<div class="card stat"><span class="l">Rata-rata Pre → Post</span><span class="v c-primary">' + UI.angka(rata(rows.map(r => r.pre))) + ' → ' + UI.angka(rata(rows.map(r => r.post))) + '</span></div></div>' +
        (prog.length ? '<div class="grid g2" style="align-items:start"><div class="card"><div class="card-h"><div class="h-sm">Rata-rata Nilai per Program</div><span class="chip sm">' + prog.length + ' program</span></div>' + gulir(prog.length,
          UI.grafikBatang({ w: Math.max(560, prog.length * 110), labels: prog.map(x => x.judul), maks: 100, series: [{ nama: 'Pre-test', warna: UI.warna('blush-4'), nilai: prog.map(x => rata(x.rows.map(r => r.pre))) }, { nama: 'Post-test', warna: UI.warna('primary'), nilai: prog.map(x => rata(x.rows.map(r => r.post))) }] })) + '</div>' +
          '<div class="card"><div class="card-h"><div class="h-sm">Peserta & Kelulusan per Program</div><span class="chip ok sm">' + lulus + ' lulus</span></div>' + gulir(prog.length,
          UI.grafikBatang({ w: Math.max(560, prog.length * 110), labels: prog.map(x => x.judul), series: [{ nama: 'Peserta', warna: UI.warna('secondary'), nilai: prog.map(x => x.rows.length) }, { nama: 'Lulus', warna: '#2E7D5E', nilai: prog.map(x => x.rows.filter(r => r.lulus).length) }] })) + '</div></div>' +
          '<div class="card tight"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Program</th><th>Tanggal</th><th class="num">Peserta</th><th class="num">Lulus</th><th class="num">Pre</th><th class="num">Post</th><th class="num">Kenaikan</th></tr></thead><tbody>' +
          prog.map(x => { const a = rata(x.rows.map(r => r.pre)), b = rata(x.rows.map(r => r.post)); return '<tr><td><div class="semi">' + esc(x.judul) + '</div>' + (x.tema ? '<div class="t-xs muted">' + esc(x.tema) + '</div>' : '') + '</td><td class="t-sm">' + esc(UI.tglPendek(x.tgl)) + '</td><td class="num">' + x.rows.length + '</td><td class="num c-ok">' + x.rows.filter(r => r.lulus).length + '</td><td class="num">' + UI.angka(a) + '</td><td class="num">' + UI.angka(b) + '</td><td class="num ' + (a !== null && b !== null && b > a ? 'c-ok' : '') + '">' + (a !== null && b !== null ? (b > a ? '+' : '') + UI.angka(Math.round((b - a) * 10) / 10) : '–') + '</td></tr>'; }).join('') +
          '</tbody></table></div></div>' : '') +
        (ev.length ? '<div class="card"><div class="h-sm" style="margin-bottom:12px">Skor Evaluasi per Pelatihan (skala 1–4)</div><div style="overflow-x:auto"><div style="min-width:' + Math.max(560, ev.length * 110) + 'px">' +
          UI.grafikBatang({ w: Math.max(640, ev.length * 120), labels: ev.map(e => e.judul), maks: 4, series: [{ nama: 'A. Materi', warna: UI.warna('blush-4'), nilai: ev.map(e => e.A) }, { nama: 'B. Instruktur', warna: UI.warna('primary'), nilai: ev.map(e => e.B) }, { nama: 'C. Penyelenggaraan', warna: UI.warna('primary-press'), nilai: ev.map(e => e.C) }] }) + '</div></div></div>' : '') +
        '<div class="card"><div class="card-h"><div class="h-sm">Tabel Rekap</div><span class="chip sm">' + rows.length + ' baris</span></div>' +
        (rows.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>UMKM</th><th>Sektor</th><th>Pelatihan</th><th class="num">Hadir</th><th class="num">Pre</th><th class="num">Post</th><th class="num">Naik</th><th class="num">Tugas</th><th>Eval</th><th>Status</th><th>No. Sertifikat</th></tr></thead><tbody>' +
          rows.slice((hal - 1) * per, hal * per).map(r => '<tr><td><div class="semi">' + esc(r.nama_umkm) + '</div><div class="t-xs muted">' + esc(r.nama_pemilik) + '</div></td><td>' + esc(r.sektor) + '</td><td><div class="clamp1" style="max-width:220px">' + esc(r.pelatihan) + '</div><div class="t-xs muted">' + esc(String(r.tanggal).replace(/\d{4}-\d{2}-\d{2}/g, x => UI.tglPendek(x))) + '</div></td>' +
            '<td class="num">' + r.hadir + '/' + r.jumlah_hari + '</td><td class="num">' + UI.angka(r.pre) + '</td><td class="num">' + UI.angka(r.post) + '</td><td class="num">' + (r.kenaikan === null ? '–' : (r.kenaikan > 0 ? '+' : '') + UI.angka(r.kenaikan)) + '</td><td class="num">' + esc(r.tugas) + '</td>' +
            '<td>' + (r.evaluasi ? UI.ic('check', 'sm') : '–') + '</td><td>' + UI.chipLulus(r.lulus) + '</td><td class="t-xs">' + esc(r.no_sertifikat || '–') + '</td></tr>').join('') + '</tbody></table></div>' + UI.halaman(rows.length, hal, per)
          : UI.kosong('Tidak ada data untuk filter ini.', 'chart')) + '</div>';
    };
    $$('[data-k]', isi).forEach(x => x.addEventListener(x.tagName === 'INPUT' ? 'input' : 'change', () => { f[x.dataset.k] = x.value.trim(); hal = 1; gambar(); }));
    UI.klik(el, {
      hal: b => { hal = +b.dataset.h; gambar(); },
      unduh: async b => {
        try { await UI.sibuk(b, async () => { const r = await API.call('laporan_export', { format: b.dataset.f, filter: f }); UI.unduhBase64(r); UI.toast('Laporan diunduh: ' + r.nama); }, 'Menyusun…'); } catch (e) { UI.gagal(e); }
      }
    });
    gambar();
  },

  // ===========================================================
  // LOG AKTIVITAS
  // ===========================================================
  async log(el) {
    el.innerHTML = Kelola.kepala('Log Aktivitas', 'Jejak aktivitas bulan berjalan · dihapus otomatis setiap akhir bulan', '<button class="btn outline sm" data-aksi="csv">' + UI.ic('download', 'sm') + 'Unduh CSV</button><button class="btn outline sm" data-aksi="segar">' + UI.ic('refresh', 'sm') + 'Segarkan</button>') +
      '<div class="card well tight row" style="margin-bottom:20px">' + UI.ic('info', 'sm') + '<span class="t-sm">Untuk menghemat penyimpanan, log dihapus otomatis pada <b>hari terakhir setiap bulan</b>. Unduh CSV sebelum akhir bulan bila perlu arsip.</span></div><div data-isi></div>';
    const isi = $('[data-isi]', el);
    let rows = [], q = '', peran = '', hal = 1;
    const per = 30;
    const gambar = () => {
      const t = rows.filter(r => (!peran || r.peran === peran) && (!q || (r.aksi + ' ' + r.id_pengguna + ' ' + (r.nama || '')).toLowerCase().indexOf(q) >= 0));
      $('[data-list]', isi).innerHTML = t.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Waktu</th><th>Peran</th><th>Nama Pengguna</th><th>Aktivitas</th></tr></thead><tbody>' +
        t.slice((hal - 1) * per, hal * per).map(r => '<tr><td class="t-sm" style="white-space:nowrap">' + esc(UI.waktu(r.waktu)) + '</td><td><span class="chip sm ' + (r.peran === 'admin' ? 'solid' : (r.peran === 'instruktur' ? 'info' : '')) + '">' + esc(r.peran) + '</span></td><td class="t-sm"><div class="semi">' + esc(r.nama || r.id_pengguna) + '</div></td><td>' + esc(r.aksi) + '</td></tr>').join('') +
        '</tbody></table></div>' + UI.halaman(t.length, hal, per) : UI.kosong('Tidak ada log.', 'history');
    };
    const muat = async () => {
      if (!$('[data-list]', isi)) UI.loading(isi, 2);
      try {
        await API.ambil('log_list', { limit: 1000 }, x => { rows = x; if (!$('[data-list]', isi)) {
        isi.innerHTML = '<div class="card"><div class="row between wrap" style="margin-bottom:14px"><div class="seg pill" data-p>' + [['', 'Semua'], ['admin', 'Admin'], ['instruktur', 'Instruktur'], ['peserta', 'Peserta']].map(x => '<button data-v="' + x[0] + '" class="' + (peran === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>' +
          '<div class="input-ic" style="min-width:240px">' + UI.ic('search', 'sm') + '<input class="input" style="height:42px" placeholder="Cari aktivitas…" data-q></div></div><div data-list></div></div>';
        $('[data-p]', isi).onclick = e => { const b = e.target.closest('button'); if (!b) return; peran = b.dataset.v; hal = 1; $$('[data-p] button', isi).forEach(x => x.classList.toggle('on', x === b)); gambar(); };
        $('[data-q]', isi).oninput = e => { q = e.target.value.toLowerCase(); hal = 1; gambar(); };
        }
        gambar();
        }, { el: isi });
      } catch (e) { UI.galat(isi, e, muat); }
    };
    UI.klik(el, {
      segar: b => UI.sibuk(b, async () => { rows = await API.call('log_list', { limit: 1000 }); gambar(); }).catch(UI.gagal),
      hal: b => { hal = +b.dataset.h; gambar(); },
      csv: () => {
        if (!rows.length) return UI.toast('Belum ada log.', 'info');
        const qq = v => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
        const csv = [['Waktu', 'Peran', 'Nama Pengguna', 'ID', 'Aktivitas']].concat(rows.map(r => [r.waktu, r.peran, r.nama || '', r.id_pengguna, r.aksi])).map(r => r.map(qq).join(';')).join('\r\n');
        const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a'); a.href = url; a.download = 'Log Aktivitas ' + APP_CONFIG.nama + ' ' + UI.hariIni().slice(0, 7) + '.csv'; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    });
    muat();
  },

  // ===========================================================
  // MANAJEMEN AKSES — akun peserta, instruktur, admin
  // ===========================================================
  async akses(el, sub) {
    sub = ['peserta', 'instruktur', 'admin'].indexOf(sub) >= 0 ? sub : (sessionStorage.getItem('rl_akses') || 'peserta');
    sessionStorage.setItem('rl_akses', sub);
    const kanan = sub === 'admin' ? '<button class="btn primary sm" data-aksi="baruAdmin">' + UI.ic('plus', 'sm') + 'Tambah Admin</button>' : '';
    el.innerHTML = Kelola.kepala('Manajemen Akses', 'Akun masuk & hak akses: peserta, instruktur, dan admin', kanan) +
      '<div class="seg" style="max-width:560px">' + [['peserta', 'Akun Peserta UMKM'], ['instruktur', 'Akun Instruktur'], ['admin', 'Akun Admin']].map(x => '<button data-ke="' + x[0] + '" class="' + (sub === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>' +
      '<div class="mt20" data-isi></div>';
    const isi = $('[data-isi]', el);
    $$('[data-ke]', el).forEach(x => x.onclick = () => { location.hash = '#/akses/' + x.dataset.ke; });
    if (sub === 'peserta') return this.aksesPeserta(el, isi);
    if (sub === 'instruktur') return this.aksesInstruktur(el, isi);
    return this.aksesAdmin(el, isi);
  },

  aksesPeserta(el, isi) {
    let rows = [], q = '', f = '', hal = 1, lihat = {};
    const per = 20;
    const kunci = n => String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const gambar = () => {
      const jml = {};
      rows.forEach(u => { const k = kunci(u.nama_umkm); jml[k] = (jml[k] || 0) + 1; });
      const t = rows.filter(u => (!f || (f === 'awal' ? u.wajib_ganti_pin === 'ya' : u.status_akun === f)) && (!q || (u.nama_umkm + ' ' + u.nama_pemilik + ' ' + u.no_hp).toLowerCase().indexOf(q) >= 0));
      $('[data-list]', isi).innerHTML = t.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nama UMKM (untuk masuk)</th><th>Sektor</th><th>No. WhatsApp</th><th>PIN</th><th>Status akun</th><th>Aksi</th></tr></thead><tbody>' +
        t.slice((hal - 1) * per, hal * per).map(u => '<tr><td><div class="semi">' + esc(u.nama_umkm) + (jml[kunci(u.nama_umkm)] > 1 ? ' <span class="chip bad sm" title="Nama sama dengan UMKM lain. Ubah di menu Peserta agar login tidak tertukar.">nama ganda</span>' : '') + '</div><div class="t-xs muted">' + esc(u.nama_pemilik) + '</div></td><td>' + esc(u.sektor) + '</td><td>' + esc(u.no_hp) + '</td>' +
          '<td><button class="chip line num" data-aksi="lihatPin" data-id="' + esc(u.id_umkm) + '" title="Tampilkan/sembunyikan">' + UI.ic(lihat[u.id_umkm] ? 'eyeOff' : 'eye', 'sm') + (lihat[u.id_umkm] ? esc(u.pin) : '••••') + '</button>' + (u.wajib_ganti_pin === 'ya' ? ' <span class="chip warn sm" title="Belum mengganti PIN awal">awal</span>' : '') + '</td>' +
          '<td>' + (u.status_akun === 'aktif' ? '<span class="chip ok dot sm">Aktif</span>' : '<span class="chip bad sm">Nonaktif</span>') + '</td>' +
          '<td><div class="row g4"><button class="btn icon sm secondary" data-aksi="kirim" data-id="' + esc(u.id_umkm) + '" title="Kirim info akses via WhatsApp">' + UI.ic('message', 'sm') + '</button>' +
          '<button class="btn icon sm secondary" data-aksi="reset" data-id="' + esc(u.id_umkm) + '" title="Reset PIN">' + UI.ic('key', 'sm') + '</button>' +
          '<button class="btn icon sm ' + (u.status_akun === 'aktif' ? 'danger' : 'ok') + '" data-aksi="status" data-id="' + esc(u.id_umkm) + '" title="' + (u.status_akun === 'aktif' ? 'Nonaktifkan' : 'Aktifkan') + '">' + UI.ic(u.status_akun === 'aktif' ? 'lock' : 'check', 'sm') + '</button></div></td></tr>').join('') +
        '</tbody></table></div>' + UI.halaman(t.length, hal, per) : UI.kosong(rows.length ? 'Tidak ada akun yang cocok.' : 'Belum ada akun peserta. Tambahkan UMKM di menu Peserta.', 'users');
    };
    const pasang = () => {
      if (!$('[data-list]', isi)) {
        isi.innerHTML = '<div class="grid g4" data-stat></div><div class="card mt20"><div class="row between wrap" style="margin-bottom:14px"><div class="seg pill" data-f>' +
          [['', 'Semua'], ['aktif', 'Aktif'], ['nonaktif', 'Nonaktif'], ['awal', 'Belum ganti PIN']].map(x => '<button data-v="' + x[0] + '" class="' + (f === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>' +
          '<div class="input-ic" style="min-width:240px">' + UI.ic('search', 'sm') + '<input class="input" style="height:42px" placeholder="Cari UMKM, peserta, HP…" data-q></div></div><div data-list></div>' +
          '<div class="hint mt8">Peserta masuk dengan <b>Nama UMKM/Usaha</b> + PIN 4 angka. Reset PIN juga membuka kunci akun yang terkunci karena 5 kali salah PIN.</div></div>';
        $('[data-f]', isi).onclick = e => { const b = e.target.closest('button'); if (!b) return; f = b.dataset.v; hal = 1; $$('[data-f] button', isi).forEach(x => x.classList.toggle('on', x === b)); gambar(); };
        let tunda;
        $('[data-q]', isi).oninput = e => { clearTimeout(tunda); tunda = setTimeout(() => { q = e.target.value.toLowerCase(); hal = 1; gambar(); }, 150); };
      }
      $('[data-stat]', isi).innerHTML = [['Total akun', rows.length, ''], ['Aktif', rows.filter(u => u.status_akun === 'aktif').length, 'c-ok'], ['Nonaktif', rows.filter(u => u.status_akun !== 'aktif').length, 'c-bad'], ['Belum ganti PIN awal', rows.filter(u => u.wajib_ganti_pin === 'ya').length, 'c-warn']]
        .map(x => '<div class="card stat"><span class="l">' + x[0] + '</span><span class="v ' + x[2] + '">' + x[1] + '</span></div>').join('');
      gambar();
    };
    const muat = async () => {
      if (!$('[data-list]', isi)) UI.loading(isi, 2);
      try { await API.ambil('umkm_list', {}, x => { rows = x; pasang(); }, { el: isi }); } catch (e) { UI.galat(isi, e, muat); }
    };
    const cari = b => rows.find(x => x.id_umkm === b.dataset.id);
    UI.klik(isi, {
      lihatPin: b => { lihat[b.dataset.id] = !lihat[b.dataset.id]; gambar(); },
      hal: b => { hal = +b.dataset.h; gambar(); },
      kirim: b => { const u = cari(b); this.tampilPin(u, u.pin, 'Info Akses Peserta'); },
      reset: async b => {
        const u = cari(b);
        if (!await UI.konfirmasi('Buat PIN baru untuk <b>' + esc(u.nama_umkm) + '</b>? Kunci akun (bila terkunci) juga dibuka.', { ok: 'Reset PIN' })) return;
        try { await UI.sibuk(b, async () => { const r = await API.call('umkm_reset_pin', { id_umkm: u.id_umkm }); u.pin = r.pin; u.wajib_ganti_pin = 'ya'; pasang(); this.tampilPin(u, r.pin, 'PIN baru'); }); } catch (e) { UI.gagal(e); }
      },
      status: async b => {
        const u = cari(b);
        if (u.status_akun === 'aktif' && !await UI.konfirmasi('Nonaktifkan akun <b>' + esc(u.nama_umkm) + '</b>? Peserta tidak bisa masuk sampai diaktifkan kembali.', { ok: 'Nonaktifkan', bahaya: true })) return;
        const lama = u.status_akun; u.status_akun = lama === 'aktif' ? 'nonaktif' : 'aktif'; pasang();
        UI.toast('Akun ' + u.nama_umkm + ' sekarang ' + u.status_akun + '.');
        API.call('umkm_status', { id_umkm: u.id_umkm }).catch(e => { u.status_akun = lama; pasang(); UI.gagal(e); });
      }
    });
    muat();
  },

  aksesInstruktur(el, isi) {
    let rows = [];
    const gambar = () => {
      isi.innerHTML = '<div class="card">' + (rows.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Instruktur</th><th>Kode akses (login)</th><th>Status akun</th><th>Aksi</th></tr></thead><tbody>' +
        rows.map(i => '<tr><td><div class="semi">' + esc(i.nama) + '</div><div class="t-xs muted">' + esc(i.institusi || '–') + '</div></td>' +
          '<td><button class="chip line" data-aksi="salin" data-k="' + esc(i.kode_akses) + '" title="Salin">' + UI.ic('key', 'sm') + esc(i.kode_akses) + '</button></td>' +
          '<td><div class="row g8">' + this.togelAkun(i.status === 'aktif', i.id_instruktur) + '<span class="t-sm">' + (i.status === 'aktif' ? 'Aktif' : 'Nonaktif') + '</span></div></td>' +
          '<td><div class="row g4"><button class="btn icon sm secondary" data-aksi="kirim" data-id="' + esc(i.id_instruktur) + '" title="Kirim kode via WhatsApp">' + UI.ic('message', 'sm') + '</button>' +
          '<button class="btn sm outline" data-aksi="kodeBaru" data-id="' + esc(i.id_instruktur) + '">' + UI.ic('refresh', 'sm') + 'Kode baru</button></div></td></tr>').join('') + '</tbody></table></div>'
        : UI.kosong('Belum ada instruktur. Tambahkan di menu Instruktur.', 'user')) +
        '<div class="hint mt8">Instruktur masuk dengan nama lengkap + kode akses. Membuat kode baru membuat kode lama tidak berlaku. Akun nonaktif tidak bisa masuk.</div></div>';
    };
    const muat = async () => {
      UI.loading(isi, 2);
      try { await API.ambil('instruktur_list', {}, x => { rows = x; gambar(); }, { el: isi }); } catch (e) { UI.galat(isi, e, muat); }
    };
    const cari = b => rows.find(x => x.id_instruktur === b.dataset.id);
    UI.klik(isi, {
      salin: b => UI.salin(b.dataset.k),
      kirim: b => { const i = cari(b); this.tampilKode(i, i.kode_akses, 'Info Akses Instruktur'); },
      kodeBaru: async b => {
        const i = cari(b);
        if (!await UI.konfirmasi('Buat kode akses baru untuk <b>' + esc(i.nama) + '</b>? Kode lama <b>' + esc(i.kode_akses) + '</b> tidak bisa dipakai lagi.', { ok: 'Buat kode baru' })) return;
        try { await UI.sibuk(b, async () => { const r = await API.call('instruktur_simpan', { id_instruktur: i.id_instruktur, kode_baru: true }); i.kode_akses = r.kode_akses; gambar(); this.tampilKode(i, r.kode_akses, 'Kode akses baru'); }); } catch (e) { UI.gagal(e); }
      },
      akun: async b => {
        const i = rows.find(x => x.id_instruktur === b.dataset.id);
        if (i.status === 'aktif' && !await UI.konfirmasi('Nonaktifkan akun <b>' + esc(i.nama) + '</b>? Instruktur tidak bisa masuk sampai diaktifkan kembali.', { ok: 'Nonaktifkan', bahaya: true })) return;
        const lama = i.status; i.status = lama === 'aktif' ? 'nonaktif' : 'aktif'; gambar();
        UI.toast('Akun ' + i.nama + ' sekarang ' + i.status + '.');
        API.call('instruktur_simpan', { id_instruktur: i.id_instruktur, status: i.status }).catch(e => { i.status = lama; gambar(); UI.gagal(e); });
      }
    });
    muat();
  },
  togelAkun(on, id) { return '<button class="toggle ' + (on ? 'on' : '') + '" role="switch" aria-checked="' + !!on + '" data-aksi="akun" data-id="' + esc(id) + '" aria-label="Aktif/nonaktif"></button>'; },

  aksesAdmin(el, isi) {
    const muat = async () => {
      UI.loading(isi, 2);
      try {
        await API.ambil('admin_list', {}, rows => {
          isi.innerHTML = '<div class="grid g2" style="align-items:start"><div class="card"><div class="card-h"><div class="h-sm">Akun Super Admin</div><span class="chip sm">' + rows.length + '</span></div><div class="list">' +
            rows.map(a => '<div class="item"><div class="ic-tile sm solid">' + esc(UI.inisial(a.nama)) + '</div><div class="grow"><div class="semi">' + esc(a.nama) + (a.saya ? ' <span class="chip sm">Anda</span>' : '') + '</div><div class="t-xs muted">@' + esc(a.username) + '</div></div>' +
              (a.saya ? '' : '<button class="btn icon sm danger" data-aksi="hapus" data-u="' + esc(a.username) + '">' + UI.ic('trash', 'sm') + '</button>') + '</div>').join('') + '</div></div>' +
            '<div class="card"><div class="h-sm">Ganti Kata Sandi Saya</div><div class="t-sm muted">Minimal 8 karakter. Segera ganti kata sandi bawaan setelah instalasi.</div><button class="btn secondary sm mt12" data-aksi="sandi">' + UI.ic('key', 'sm') + 'Ganti kata sandi</button>' +
            '<div class="card well tight mt20"><div class="semi t-sm">Hak akses per peran</div><div class="t-sm muted mt8">Super Admin: semua menu. Instruktur: hanya pelatihan miliknya (materi, soal, tugas & nilai) — tidak dapat melihat evaluasi. Peserta: hanya pelatihan yang diikuti. Diperiksa di server pada setiap permintaan.</div></div></div></div>';
        }, { el: isi });
      } catch (e) { UI.galat(isi, e, muat); }
    };
    UI.klik(el, {
      baruAdmin: () => UI.form({
        title: 'Tambah Admin', submit: 'Tambah',
        fields: [{ name: 'nama', label: 'Nama', full: true }, { name: 'username', label: 'Username', placeholder: 'huruf kecil, angka, titik' }, { name: 'password', label: 'Kata sandi awal', type: 'password', hint: 'Minimal 8 karakter' }],
        onSubmit: async v => { const r = await API.call('admin_simpan', v); UI.toast(r.message); muat(); }
      }),
      hapus: async b => {
        if (!await UI.konfirmasi('Hapus admin <b>@' + esc(b.dataset.u) + '</b>?', { ok: 'Hapus', bahaya: true })) return;
        try { const r = await API.call('admin_hapus', { username: b.dataset.u }); UI.toast(r.message); muat(); } catch (e) { UI.gagal(e); }
      },
      sandi: () => UI.form({
        title: 'Ganti Kata Sandi', submit: 'Simpan',
        fields: [{ name: 'lama', label: 'Kata sandi lama', type: 'password', full: true }, { name: 'baru', label: 'Kata sandi baru', type: 'password' }, { name: 'ulang', label: 'Ulangi kata sandi baru', type: 'password' }],
        onSubmit: async v => { if (v.baru !== v.ulang) throw new Error('Kata sandi baru tidak sama.'); const r = await API.call('ganti_password', { lama: v.lama, baru: v.baru }); UI.toast(r.message); }
      })
    });
    muat();
  },

  // ===========================================================
  // PENGATURAN
  // ===========================================================
  async pengaturan(el) {
    el.innerHTML = Kelola.kepala('Pengaturan', 'Identitas aplikasi, laporan & sertifikat, dan sistem') + '<div data-isi></div>';
    const isi = $('[data-isi]', el);
    UI.loading(isi, 2);
    let s;
    try { s = await API.cepat('pengaturan_get'); } catch (e) { return UI.galat(isi, e, () => this.pengaturan(el)); }
    const B = { nama: s.NAMA_APLIKASI || 'RuangLatih', tagline: s.TAGLINE || 'Pusat Pendampingan UMKM Cakung', footer: s.TEKS_FOOTER || APP_CONFIG.footer || '',
      logo: s.LOGO_DATA || '', warna: s.WARNA_UTAMA || '#9E3D52', wa: s.WA_ADMIN || APP_CONFIG.waAdmin || '' };
    const waLokal = w => { w = String(w || '').replace(/\D/g, ''); return w.indexOf('62') === 0 ? '0' + w.slice(2) : w; };
    let logo = B.logo;
    const hitung = (id, maks) => '<span class="t-xs faint" data-hit="' + id + '">0/' + maks + '</span>';
    const sy = s.SYARAT_LULUS_DEFAULT || {};
    const PRESET = ['#9E3D52', '#0EA5E9', '#2563EB', '#0F766E', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#334155'];
    isi.innerHTML = '<div class="grid" style="grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);align-items:start" data-dua>' +
      '<div class="card col g20"><div><div class="h-md">Identitas Aplikasi</div><div class="t-sm muted">Perubahan langsung berlaku di semua akun (admin, instruktur, peserta) setelah disimpan.</div></div>' +
      '<div class="field"><div class="row between"><label for="p_nama">Nama / judul aplikasi</label>' + hitung('p_nama', 40) + '</div><input class="input" id="p_nama" maxlength="40" value="' + esc(B.nama) + '"></div>' +
      '<div class="field"><div class="row between"><label for="p_tag">Tagline</label>' + hitung('p_tag', 100) + '</div><input class="input" id="p_tag" maxlength="100" value="' + esc(B.tagline) + '" placeholder="mis. Pusat Pendampingan UMKM Cakung"></div>' +
      '<div class="field"><span class="lbl">Logo aplikasi</span><div class="row wrap g16"><div class="logo-tile" data-logo style="width:64px;height:64px;border-radius:16px;background:var(--blush-2);color:var(--primary);display:grid;place-items:center;overflow:hidden;padding:6px"></div>' +
      '<div class="col g8"><div class="row g8"><button class="btn secondary sm" data-aksi="pilihLogo">' + UI.ic('image', 'sm') + 'Pilih logo</button><button class="btn outline sm" data-aksi="hapusLogo">Hapus logo</button></div>' +
      '<div class="hint">PNG / JPG / WebP, sebaiknya persegi. Dikecilkan otomatis ke 256 px.</div></div></div></div>' +
      '<div class="field"><div class="row between"><label for="p_foot">Teks footer</label>' + hitung('p_foot', 160) + '</div><input class="input" id="p_foot" maxlength="160" value="' + esc(B.footer) + '" placeholder="mis. © 2026 PPU UT Cakung"></div>' +
      '<div class="form-grid"><div class="field"><label for="p_hex">Warna utama</label><div class="row g8"><input type="color" id="p_warna" value="' + esc(B.warna.toLowerCase()) + '" style="width:52px;height:48px;border:1px solid var(--blush-3);border-radius:12px;padding:4px;background:#fff;cursor:pointer">' +
      '<input class="input grow" id="p_hex" maxlength="7" value="' + esc(B.warna.toUpperCase()) + '"></div><div class="row wrap g4 mt8" data-preset>' + PRESET.map(c => '<button type="button" data-c="' + c + '" title="' + c + '" style="width:24px;height:24px;border-radius:50%;background:' + c + ';border:2px solid #fff;box-shadow:0 0 0 1px var(--blush-4)"></button>').join('') + '</div><div class="hint" data-kontras></div></div>' +
      '<div class="field"><label for="p_wa">Nomor WhatsApp admin</label><input class="input" id="p_wa" type="tel" inputmode="tel" value="' + esc(waLokal(B.wa)) + '" placeholder="08xxxxxxxxxx"><div class="hint">Dipakai tombol "Hubungi Admin" & "Lupa PIN".</div></div></div>' +
      '<div class="err" hidden data-err></div>' +
      '<div class="row between wrap"><button class="btn ghost sm" data-aksi="bawaan">' + UI.ic('refresh', 'sm') + 'Kembalikan bawaan</button><button class="btn primary" data-aksi="simpanIdentitas">' + UI.ic('check', 'sm') + 'Simpan Identitas</button></div></div>' +
      '<div class="card"><div class="h-md">Pratinjau</div><div class="t-sm muted" style="margin-bottom:14px">Halaman masuk di layar HP</div><div class="hp-mock" data-mock><div class="hp-in" data-mockisi></div></div></div></div>' +

      '<div class="grid g2 mt20" style="align-items:start"><div class="card col g20"><div class="h-sm">Laporan & Sertifikat</div>' +
      '<div class="field"><label>Nama lembaga (kop laporan)</label><input class="input" name="NAMA_LEMBAGA" value="' + esc(s.NAMA_LEMBAGA) + '"></div>' +
      '<div class="field"><label>Format nomor sertifikat</label><input class="input" name="FORMAT_NO_SERTIFIKAT" value="' + esc(s.FORMAT_NO_SERTIFIKAT || '{urut}/RL-PPU/{kode}/{bulan}/{tahun}') + '"><div class="hint">Penanda: {urut} (wajib, 001…), {kode} (kode pelatihan), {bulan} (romawi), {tahun}</div></div>' +
      '<div class="field"><label>Template laporan (link Google Sheets, opsional)</label><input class="input" name="TEMPLATE_LAPORAN_ID" value="' + esc(s.TEMPLATE_LAPORAN_ID ? 'https://docs.google.com/spreadsheets/d/' + s.TEMPLATE_LAPORAN_ID : '') + '" placeholder="Kosongkan untuk format standar"><div class="hint">Tulis {{tabel}} di sel awal tabel. Penanda lain: {{nama_lembaga}} {{judul_laporan}} {{periode}} {{judul_pelatihan}} {{sektor}} {{tanggal_cetak}} {{jumlah_peserta}} {{jumlah_lulus}}</div></div>' +
      '<div><div class="lbl" style="margin-bottom:6px">Syarat lulus bawaan (untuk pelatihan baru)</div>' + SYARAT.map(x => '<label class="check"><input type="checkbox" name="sy_' + x[0] + '"' + (sy[x[0]] ? ' checked' : '') + '>' + x[1] + '</label>').join('') + '</div>' +
      '<div><button class="btn primary" data-aksi="simpan">Simpan Pengaturan</button></div></div>' +
      '<div class="col g20"><div class="card"><div class="h-sm">Penyimpanan Google</div><div class="list mt12">' +
      [['Folder utama Drive', s.folder, 'layers'], ['Folder template sertifikat', s.folder_template, 'award'], ['Spreadsheet database', s.spreadsheet, 'chart']].map(x => '<a class="item" href="' + esc(x[1]) + '" target="_blank" rel="noopener"><div class="ic-tile sm">' + UI.ic(x[2], 'sm') + '</div><div class="grow semi">' + x[0] + '</div>' + UI.ic('chevR', 'sm') + '</a>').join('') + '</div></div>' +
      '<div class="card"><div class="h-sm">Pembersihan Log Otomatis</div><div class="mt8">' + (s.log_otomatis ? '<span class="chip ok dot sm">Aktif — setiap akhir bulan</span>' : '<span class="chip warn sm">Belum aktif</span><div class="t-sm muted mt8">Jalankan fungsi <b>pasangJadwalLog</b> sekali dari editor Apps Script.</div>') + '</div></div>' +
      '<div class="card"><div class="h-sm">Koneksi API</div><div class="t-sm muted mt8" style="word-break:break-all">' + esc(GAS_URL) + '</div><div class="mt12" data-sehat><span class="chip line sm">Memeriksa…</span></div></div></div></div>';
    if (window.innerWidth < 1000) $('[data-dua]', isi).style.gridTemplateColumns = '1fr';

    const nilai = () => ({ nama: $('#p_nama').value.trim(), tagline: $('#p_tag').value.trim(), footer: $('#p_foot').value.trim(), warna: $('#p_hex').value.trim(), wa: $('#p_wa').value.trim(), logo: logo });
    const pratinjau = () => {
      const v = nilai(), w = /^#[0-9a-f]{6}$/i.test(v.warna) ? v.warna : B.warna;
      [['p_nama', 40], ['p_tag', 100], ['p_foot', 160]].forEach(x => { const h = $('[data-hit="' + x[0] + '"]', isi); if (h) h.textContent = $('#' + x[0]).value.length + '/' + x[1]; });
      $('[data-logo]', isi).innerHTML = logo ? '<img src="' + esc(logo) + '" alt="" style="width:100%;height:100%;object-fit:contain">' : UI.ic('cap', 'lg');
      const mock = $('[data-mock]', isi);
      UI.tema(w, mock);
      const lg = logo ? '<img src="' + esc(logo) + '" alt="" style="width:100%;height:100%;object-fit:contain">' : UI.ic('cap');
      $('[data-mockisi]', isi).innerHTML = '<div style="background:var(--hero);color:#fff;padding:22px 16px 46px;border-radius:0 0 26px 26px;text-align:center">' +
        '<div style="width:44px;height:44px;border-radius:12px;margin:0 auto 10px;display:grid;place-items:center;overflow:hidden;' + (logo ? 'background:#fff;padding:4px' : 'background:rgba(255,255,255,.18)') + '">' + lg + '</div>' +
        '<div style="font-weight:800;font-size:20px;line-height:1.2">' + esc(v.nama || 'Nama aplikasi') + '</div><div style="font-size:11.5px;opacity:.9;margin-top:4px">' + esc(v.tagline) + '</div></div>' +
        '<div style="margin:-30px 14px 0;background:#fff;border-radius:16px;box-shadow:var(--shadow-up);padding:14px">' +
        '<div class="seg" style="padding:3px"><button style="height:28px;font-size:10px;padding:0 4px" class="on">Peserta UMKM</button><button style="height:28px;font-size:10px;padding:0 4px">Instruktur</button><button style="height:28px;font-size:10px;padding:0 4px">Admin</button></div>' +
        '<div style="height:34px;border-radius:10px;background:var(--blush-1);border:1px solid var(--blush-3);margin-top:12px;font-size:11px;color:var(--ink-3);display:flex;align-items:center;padding:0 10px">Nama UMKM / Usaha</div>' +
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px">' + [1, 2, 3, 4].map(() => '<div style="height:36px;border-radius:10px;background:var(--blush-1);border:1px solid var(--blush-3)"></div>').join('') + '</div>' +
        '<div style="height:36px;border-radius:99px;background:var(--primary);color:#fff;font-weight:700;font-size:12px;display:grid;place-items:center;margin-top:12px">Masuk</div>' +
        '<div style="text-align:center;font-size:11px;color:var(--primary);font-weight:700;margin-top:10px">Lupa PIN? Hubungi Admin' + (v.wa ? ' (' + esc(v.wa) + ')' : '') + '</div></div>' +
        '<div style="text-align:center;font-size:10.5px;color:var(--ink-3);padding:16px 14px">' + esc(v.footer) + '</div>';
      const k = $('[data-kontras]', isi);
      k.innerHTML = /^#[0-9a-f]{6}$/i.test(v.warna) ? (UI.kecerahan(v.warna) > 0.45 ? '<span class="c-warn">⚠ Warna terlalu terang — tulisan putih di tombol sulit dibaca.</span>' : '') : '<span class="c-bad">Kode warna harus format #RRGGBB.</span>';
    };
    ['#p_nama', '#p_tag', '#p_foot', '#p_wa'].forEach(id => $(id, isi).addEventListener('input', pratinjau));
    $('#p_warna', isi).addEventListener('input', e => { $('#p_hex').value = e.target.value.toUpperCase(); pratinjau(); });
    $('#p_hex', isi).addEventListener('input', e => { let v = e.target.value.trim(); if (v && v[0] !== '#') v = '#' + v; if (/^#[0-9a-f]{6}$/i.test(v)) $('#p_warna').value = v.toLowerCase(); pratinjau(); });
    $('[data-preset]', isi).onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; $('#p_hex').value = b.dataset.c; $('#p_warna').value = b.dataset.c.toLowerCase(); pratinjau(); };
    pratinjau();

    /** Logo → persegi 256 px (WebP/PNG) agar ringan disimpan & cepat tampil. */
    const olahLogo = async file => {
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Gambar tidak bisa dibaca.')); i.src = url; });
        for (const uk of [256, 192, 160, 128]) {
          const c = document.createElement('canvas'); c.width = c.height = uk;
          const g = c.getContext('2d'), sk = Math.min(uk / img.width, uk / img.height), w = img.width * sk, h = img.height * sk;
          g.drawImage(img, (uk - w) / 2, (uk - h) / 2, w, h);
          let d = c.toDataURL('image/webp', 0.9);
          if (d.indexOf('data:image/webp') !== 0) d = c.toDataURL('image/png');
          if (d.length <= 45000) return d;
        }
        throw new Error('Logo terlalu rumit untuk diperkecil. Coba file yang lebih sederhana.');
      } finally { URL.revokeObjectURL(url); }
    };
    UI.klik(isi, {
      pilihLogo: async () => {
        const f = (await UI.pilihFile('image/png,image/jpeg,image/webp', false))[0];
        if (!f) return;
        if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return UI.toast('Gunakan file PNG, JPG, atau WebP.', 'bad');
        try { logo = await olahLogo(f); pratinjau(); UI.toast('Logo siap — klik Simpan Identitas untuk menerapkan.', 'info'); } catch (e) { UI.gagal(e); }
      },
      hapusLogo: () => { logo = ''; pratinjau(); },
      bawaan: () => {
        $('#p_nama').value = 'RuangLatih'; $('#p_tag').value = 'Pusat Pendampingan UMKM Cakung'; $('#p_foot').value = '© ' + new Date().getFullYear() + ' PPU UT Cakung · Pusat Pendampingan UMKM Cakung';
        $('#p_hex').value = '#9E3D52'; $('#p_warna').value = '#9e3d52'; logo = ''; pratinjau();
        UI.toast('Isian dikembalikan ke bawaan — klik Simpan Identitas untuk menerapkan.', 'info');
      },
      simpanIdentitas: async b => {
        const v = nilai(), err = $('[data-err]', isi);
        err.hidden = true;
        const salah = !v.nama ? 'Nama aplikasi wajib diisi.' : !/^#[0-9a-f]{6}$/i.test(v.warna) ? 'Kode warna harus format #RRGGBB, mis. #9E3D52.' : (v.wa && !/^(\+?62|0)8\d{7,12}$/.test(v.wa.replace(/[\s-]/g, ''))) ? 'Nomor WhatsApp admin tidak valid.' : '';
        if (salah) { err.textContent = salah; err.hidden = false; return; }
        try {
          await UI.sibuk(b, async () => {
            const r = await API.call('pengaturan_simpan', { NAMA_APLIKASI: v.nama, TAGLINE: v.tagline, TEKS_FOOTER: v.footer, WARNA_UTAMA: v.warna.toUpperCase(), WA_ADMIN: v.wa, LOGO_DATA: logo });
            UI.toast('Identitas aplikasi diperbarui.');
            App.simpanBrand(r.identitas, JSON.stringify({}));
          }, 'Menyimpan…');
        } catch (e) { err.textContent = e.message; err.hidden = false; }
      },
      simpan: async b => {
        const v = n => $('[name="' + n + '"]', isi);
        const data = { NAMA_LEMBAGA: v('NAMA_LEMBAGA').value, FORMAT_NO_SERTIFIKAT: v('FORMAT_NO_SERTIFIKAT').value, TEMPLATE_LAPORAN_ID: v('TEMPLATE_LAPORAN_ID').value.trim(), SYARAT_LULUS_DEFAULT: {} };
        SYARAT.forEach(x => data.SYARAT_LULUS_DEFAULT[x[0]] = v('sy_' + x[0]).checked);
        try { await UI.sibuk(b, async () => { const r = await API.call('pengaturan_simpan', data); UI.toast(r.message); }); } catch (e) { UI.gagal(e); }
      }
    });
    App.cekServer().then(h => { const x = $('[data-sehat]', isi); if (x) x.innerHTML = h && h.siap ? '<span class="chip ok dot sm">Terhubung · versi ' + esc(h.versi) + '</span>' : '<span class="chip bad sm">Tidak terhubung / belum setup</span>'; });
  },


  // ===========================================================
  // PENCARIAN GLOBAL
  // ===========================================================
  async cari(el, q) {
    el.innerHTML = Kelola.kepala('Hasil Pencarian', q ? 'Kata kunci: “' + q + '”' : 'Ketik kata kunci di kolom pencarian') + '<div data-isi></div>';
    const isi = $('[data-isi]', el);
    if (!q) { isi.innerHTML = '<div class="card">' + UI.kosong('Cari peserta UMKM, pelatihan, materi, atau instruktur.', 'search') + '</div>'; return; }
    UI.loading(isi, 3);
    try {
      const [pel, umkm, mat, ins] = await Promise.all([Kelola.daftarPel(), API.cepat('umkm_list'), API.cepat('materi_list'), API.cepat('instruktur_list')]);
      const k = q.toLowerCase(), cocok = s => String(s).toLowerCase().indexOf(k) >= 0;
      const P = pel.filter(p => cocok(p.judul + ' ' + p.tema + ' ' + p.instruktur)), U = umkm.filter(u => cocok(u.nama_umkm + ' ' + u.nama_pemilik + ' ' + u.no_hp + ' ' + u.spesialisasi)),
        M = mat.filter(m => cocok(m.judul + ' ' + m.pelatihan)), I = ins.filter(i => cocok(i.nama + ' ' + i.institusi + ' ' + i.no_hp));
      const blok = (judul, n, isiHtml) => '<div class="card"><div class="card-h"><div class="h-sm">' + judul + '</div><span class="chip sm">' + n + '</span></div>' + (n ? '<div class="list">' + isiHtml + '</div>' : '<div class="t-sm muted">Tidak ada hasil.</div>') + '</div>';
      isi.innerHTML = '<div class="col g20">' +
        blok('Pelatihan', P.length, P.slice(0, 10).map(p => '<a class="item" href="#/pelatihan/' + esc(p.id_pelatihan) + '" style="color:inherit"><div class="ic-tile sm">' + UI.ic('cap', 'sm') + '</div><div class="grow"><div class="semi">' + esc(p.judul) + '</div><div class="t-xs muted">' + esc(UI.rentang(p)) + ' · ' + esc(p.instruktur) + '</div></div>' + UI.chipStatus(p.status) + '</a>').join('')) +
        blok('Peserta UMKM', U.length, U.slice(0, 10).map(u => '<a class="item" href="#/peserta" style="color:inherit"><div class="ic-tile sm">' + UI.ic('store', 'sm') + '</div><div class="grow"><div class="semi">' + esc(u.nama_umkm) + '</div><div class="t-xs muted">' + esc(u.nama_pemilik) + ' · ' + esc(u.sektor) + ' · ' + esc(u.no_hp) + '</div></div><span class="t-xs muted">' + u.jumlah_pelatihan + ' pelatihan</span></a>').join('')) +
        blok('Materi', M.length, M.slice(0, 10).map(m => '<a class="item" href="' + esc(m.url_lihat) + '" target="_blank" rel="noopener" style="color:inherit"><div class="ic-tile sm">' + UI.ic('file', 'sm') + '</div><div class="grow"><div class="semi">' + esc(m.judul) + '</div><div class="t-xs muted">' + esc(m.pelatihan) + ' · ' + UI.ukuran(m.ukuran) + '</div></div></a>').join('')) +
        blok('Instruktur', I.length, I.slice(0, 10).map(i => '<a class="item" href="#/instruktur" style="color:inherit"><div class="ic-tile sm">' + UI.ic('user', 'sm') + '</div><div class="grow"><div class="semi">' + esc(i.nama) + '</div><div class="t-xs muted">' + esc(i.institusi || '-') + '</div></div></a>').join('')) + '</div>';
    } catch (e) { UI.galat(isi, e, () => this.cari(el, q)); }
  }
};
