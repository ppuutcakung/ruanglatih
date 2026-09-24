/* =============================================================
   RuangLatih — kelola.js
   Modul bersama Admin & Instruktur: pemilih pelatihan, bank
   materi (unggah PDF bertahap), bank soal, tugas & penilaian,
   rekap nilai. Hak akses tetap diperiksa di server.
   ============================================================= */
const Kelola = {
  peran() { const u = Sesi.user(); return u ? u.peran : ''; },

  /** Daftar pelatihan: langsung dari cache (instan), disegarkan diam-diam di latar. */
  async daftarPel(paksa) {
    const c = Simpan.get(Simpan.kunci('pelatihan_list', {}));
    if (c && !paksa) { if (Date.now() - c.t > 20000) API.call('pelatihan_list').catch(() => { }); return c.d; }
    return API.call('pelatihan_list');
  },
  segarkanPel() { /* cache dibasikan otomatis oleh aksi tulis */ },
  /** Pembaruan optimistis: ubah daftar pelatihan di cache lokal tanpa menunggu server. */
  ubahPelLokal(id, fn) {
    const k = Simpan.kunci('pelatihan_list', {}), c = Simpan.get(k);
    if (!c) return;
    const p = c.d.find(x => x.id_pelatihan === id);
    if (p) { fn(p); Simpan.set(k, c.d); }
  },

  pilihanAwal(list) {
    const simpan = sessionStorage.getItem('rl_pel');
    if (simpan && list.some(p => p.id_pelatihan === simpan)) return simpan;
    const b = list.find(p => p.status === 'berlangsung') || list.filter(p => p.status === 'akan datang').sort((a, c) => String(a.tanggal_mulai).localeCompare(String(c.tanggal_mulai)))[0] || list[0];
    return b ? b.id_pelatihan : '';
  },

  kepala(judul, sub, kanan) {
    return '<div class="page-h"><div><div class="crumb">' + esc(sub || '') + '</div><div class="h-lg">' + esc(judul) + '</div></div>' +
      '<div class="picker">' + (kanan || '') + '</div></div>';
  },

  /**
   * Pasang pemilih pelatihan di host lalu panggil onPilih(id, pelatihan).
   * opt.semua = tampilkan opsi "Semua pelatihan" (id kosong).
   */
  async pemilih(host, opt, onPilih) {
    opt = opt || {};
    const list = await this.daftarPel();
    let id = opt.id !== undefined ? opt.id : (opt.semua && !sessionStorage.getItem('rl_pel') ? '' : this.pilihanAwal(list));
    if (id && !list.some(p => p.id_pelatihan === id)) id = opt.semua ? '' : this.pilihanAwal(list);
    host.innerHTML = '<select class="select" aria-label="Pilih pelatihan">' + (opt.semua ? '<option value="">Semua pelatihan</option>' : '') +
      list.map(p => '<option value="' + esc(p.id_pelatihan) + '"' + (p.id_pelatihan === id ? ' selected' : '') + '>' + esc(p.judul) + ' · ' + esc(UI.rentang(p)) + '</option>').join('') + '</select>';
    const sel = $('select', host);
    const cari = v => list.find(p => p.id_pelatihan === v) || null;
    sel.onchange = () => { if (sel.value) sessionStorage.setItem('rl_pel', sel.value); onPilih(sel.value, cari(sel.value)); };
    if (!list.length && !opt.semua) { onPilih('', null); return list; }
    onPilih(id, cari(id));
    return list;
  },

  tanpaPelatihan() {
    return '<div class="card">' + UI.kosong(this.peran() === 'admin' ? 'Belum ada pelatihan. Buat pelatihan terlebih dahulu di menu Pelatihan.' : 'Belum ada pelatihan yang ditugaskan kepada Anda.', 'cap') + '</div>';
  },

  // ===========================================================
  // BANK MATERI
  // ===========================================================
  async halamanMateri(el) {
    el.innerHTML = this.kepala('Bank Materi', 'Modul PDF pelatihan · tersimpan di Google Drive', '<span data-picker></span><button class="btn primary sm" data-aksi="unggah">' + UI.ic('upload', 'sm') + 'Unggah PDF</button>') + '<div data-isi></div>';
    const isi = $('[data-isi]', el);
    let idPel = '', pel = null;
    let rows = [];
    const muat = async () => {
      const id = idPel;
      UI.loading(isi, 2);
      try { await API.ambil('materi_list', id ? { id_pelatihan: id } : {}, d => { if (id === idPel) { rows = d; gambar(); } }, { el: isi }); }
      catch (e) { UI.galat(isi, e, muat); }
    };
    const gambar = () => {
      {
        if (!rows.length) { isi.innerHTML = '<div class="card">' + UI.kosong(idPel ? 'Belum ada materi untuk pelatihan ini. Unggah PDF modul pertama.' : 'Belum ada materi.', 'book') + '</div>'; return; }
        const total = rows.reduce((s, m) => s + m.ukuran, 0);
        isi.innerHTML = '<div class="grid g3"><div class="card stat"><span class="l">Jumlah modul</span><span class="v">' + rows.length + '</span></div>' +
          '<div class="card stat"><span class="l">Total ukuran</span><span class="v">' + UI.ukuran(total) + '</span></div>' +
          '<div class="card stat"><span class="l">Cakupan umum</span><span class="v">' + rows.filter(m => m.cakupan === 'umum').length + '</span></div></div>' +
          '<div class="card mt20"><div class="list">' + rows.map(m =>
            '<div class="item"><div class="ic-tile">' + UI.ic('file') + '</div><div class="grow"><div class="semi clamp1">' + esc(m.judul) + '</div>' +
            '<div class="meta"><span>' + UI.ukuran(m.ukuran) + '</span><span>' + esc(m.cakupan === 'sektor' ? 'Sektor ' + m.sektor : 'Umum') + '</span>' + (idPel ? '' : '<span>' + esc(m.pelatihan) + '</span>') + '<span>' + UI.tglPendek(m.tgl) + '</span></div></div>' +
            '<div class="row g4"><a class="btn icon sm secondary" href="' + esc(m.url_lihat) + '" target="_blank" rel="noopener" title="Lihat">' + UI.ic('eye', 'sm') + '</a>' +
            '<button class="btn icon sm danger" data-aksi="hapus" data-id="' + esc(m.id_materi) + '" data-j="' + esc(m.judul) + '" title="Hapus">' + UI.ic('trash', 'sm') + '</button></div></div>').join('') + '</div></div>';
      }
    };
    UI.klik(el, {
      unggah: () => { if (!idPel) return UI.toast('Pilih satu pelatihan terlebih dahulu.', 'info'); this.modalUnggah(pel, muat); },
      hapus: async b => {
        if (!await UI.konfirmasi('Hapus materi <b>' + esc(b.dataset.j) + '</b>? File di Google Drive ikut dipindahkan ke sampah.', { ok: 'Hapus', bahaya: true })) return;
        // Optimistis: hilang dari daftar seketika, server menyusul di latar
        const lama = rows; rows = rows.filter(m => m.id_materi !== b.dataset.id); gambar(); UI.toast('Materi dihapus.');
        API.call('materi_hapus', { id_materi: b.dataset.id }).catch(e => { rows = lama; gambar(); UI.gagal(e); });
      }
    });
    try {
      await this.pemilih($('[data-picker]', el), { semua: true }, (id, p) => { idPel = id; pel = p; muat(); });
    } catch (e) { UI.galat(isi, e, () => this.halamanMateri(el)); }
  },

  modalUnggah(pel, selesai) {
    let files = [];
    const opts = {
      title: 'Unggah Materi PDF', wide: true,
      body: '<div class="col g20"><div class="t-sm muted">Pelatihan: <b>' + esc(pel.judul) + '</b></div>' +
        '<div class="dropzone" data-pilih>' + UI.ic('upload', 'lg') + '<div class="semi">Pilih file PDF</div><div class="hint">Boleh beberapa file sekaligus · maksimal 50 MB per file · diunggah bertahap</div></div>' +
        '<div class="list" data-daftar></div>' +
        '<div class="form-grid"><div class="field"><label>Cakupan materi</label><div class="seg" data-cak><button type="button" data-v="umum">Umum (semua sektor)</button><button type="button" data-v="sektor">Khusus sektor</button></div></div>' +
        '<div class="field" data-sek><label>Sektor</label><select class="select">' + SEKTOR.map(s => '<option' + (s === pel.sektor ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></div></div>' +
        '<div class="err" hidden data-err></div></div>',
      foot: '<button class="btn outline" data-tutup>Batal</button><button class="btn primary" data-kirim disabled>' + UI.ic('upload', 'sm') + 'Unggah</button>'
    };
    const m = UI.modal(opts);
    const daftar = $('[data-daftar]', m.el), kirim = $('[data-kirim]', m.el), err = $('[data-err]', m.el);
    let cakupan = pel.cakupan === 'sektor' ? 'sektor' : 'umum';
    const segCak = () => { $$('[data-cak] button', m.el).forEach(b => b.classList.toggle('on', b.dataset.v === cakupan)); $('[data-sek]', m.el).hidden = cakupan !== 'sektor'; };
    segCak();
    $('[data-cak]', m.el).onclick = e => { const b = e.target.closest('button'); if (b) { cakupan = b.dataset.v; segCak(); } };
    const gambar = () => {
      daftar.innerHTML = files.map((f, i) => '<div class="item" data-i="' + i + '"><div class="ic-tile sm">' + UI.ic('file', 'sm') + '</div><div class="grow col g4">' +
        '<input class="input" style="height:40px" value="' + esc(f.judul) + '" data-judul="' + i + '" aria-label="Judul materi">' +
        '<div class="row"><span class="t-xs muted">' + esc(f.file.name) + ' · ' + UI.ukuran(f.file.size) + '</span><div class="bar grow" hidden><i style="width:0"></i></div><span class="t-xs semi c-primary" data-pct></span></div></div>' +
        '<button class="btn icon sm ghost" data-buang="' + i + '" aria-label="Buang">' + UI.ic('x', 'sm') + '</button></div>').join('');
      kirim.disabled = !files.length;
    };
    $('[data-pilih]', m.el).onclick = async () => {
      const pilih = await UI.pilihFile('application/pdf,.pdf', true);
      const tolak = [];
      pilih.forEach(f => {
        if (!/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name)) tolak.push(f.name + ': bukan PDF');
        else if (f.size > 50 * 1048576) tolak.push(f.name + ': Ukuran file maksimal 50 MB');
        else files.push({ file: f, judul: f.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() });
      });
      err.hidden = !tolak.length; err.innerHTML = tolak.map(esc).join('<br>');
      gambar();
    };
    daftar.addEventListener('input', e => { const i = e.target.dataset.judul; if (i !== undefined) files[i].judul = e.target.value; });
    daftar.addEventListener('click', e => { const b = e.target.closest('[data-buang]'); if (b && !opts.kunci) { files.splice(+b.dataset.buang, 1); gambar(); } });
    kirim.onclick = async () => {
      if (!files.length) return;
      opts.kunci = true; kirim.disabled = true; err.hidden = true;
      $$('[data-tutup]', m.el).forEach(b => b.disabled = true);
      const sektor = $('[data-sek] select', m.el).value;
      let ok = 0; const gagal = [];
      for (let i = 0; i < files.length; i++) {
        const row = $('[data-i="' + i + '"]', daftar), bar = $('.bar', row), pct = $('[data-pct]', row);
        bar.hidden = false;
        try {
          await API.unggahBesar(files[i].file, { id_pelatihan: pel.id_pelatihan, judul: files[i].judul, cakupan: cakupan, sektor: sektor }, p => { $('i', bar).style.width = p + '%'; pct.textContent = p + '%'; });
          pct.innerHTML = UI.ic('check', 'sm'); ok++;
        } catch (e) { pct.textContent = 'Gagal'; gagal.push(files[i].file.name + ': ' + e.message); }
      }
      opts.kunci = false;
      $$('[data-tutup]', m.el).forEach(b => b.disabled = false);
      if (ok) UI.toast(ok + ' materi berhasil diunggah.');
      selesai && selesai();
      if (gagal.length) { err.innerHTML = gagal.map(esc).join('<br>'); err.hidden = false; files = files.filter(f => gagal.some(g => g.indexOf(f.file.name) === 0)); gambar(); }
      else m.close();
    };
  },

  // ===========================================================
  // BANK SOAL PRE/POST-TEST
  // ===========================================================
  async halamanSoal(el, opt) {
    opt = opt || {};
    const judul = opt.judul;
    el.innerHTML = this.kepala(judul || 'Bank Soal Pre/Post-Test', 'Soal pilihan ganda · skor dihitung otomatis di server', '<span data-picker></span><button class="btn primary sm" data-aksi="tambah">' + UI.ic('plus', 'sm') + 'Tambah Soal</button>') + '<div data-atas></div><div data-isi></div>';
    const isi = $('[data-isi]', el);
    let idPel = '', data = { soal: [] }, filter = 'semua';
    const gambar = () => {
      const s = data.soal;
      const nPre = s.filter(x => x.jenis !== 'post').length, nPost = s.filter(x => x.jenis !== 'pre').length;
      const tampil = s.filter(x => filter === 'semua' || x.jenis === filter || (filter !== 'pre+post' && x.jenis === 'pre+post'));
      isi.innerHTML = (data.sudah_dikerjakan ? '<div class="card well row">' + UI.ic('alert') + '<div class="t-sm">Sudah ada <b>' + data.sudah_dikerjakan + '</b> hasil tes masuk. Mengubah soal tidak mengubah skor yang sudah tersimpan.</div></div>' : '') +
        '<div class="grid g3 ' + (data.sudah_dikerjakan ? 'mt20' : '') + '"><div class="card stat"><span class="l">Total soal</span><span class="v">' + s.length + '</span></div><div class="card stat"><span class="l">Tampil di Pre-test</span><span class="v">' + nPre + '</span></div><div class="card stat"><span class="l">Tampil di Post-test</span><span class="v">' + nPost + '</span></div></div>' +
        '<div class="card mt20"><div class="card-h"><div class="h-sm">Daftar Soal</div><div class="seg pill" data-f>' + [['semua', 'Semua'], ['pre', 'Pre'], ['post', 'Post'], ['pre+post', 'Pre+Post']].map(x => '<button data-v="' + x[0] + '" class="' + (filter === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div></div>' +
        (tampil.length ? '<div class="list">' + tampil.map(x => {
          const no = s.indexOf(x) + 1;
          return '<div class="item top" style="align-items:flex-start"><div class="ic-tile sm semi">' + no + '</div><div class="grow col g8"><div class="semi">' + esc(x.pertanyaan) + '</div>' +
            '<div class="col g4 t-sm">' + ['a', 'b', 'c', 'd', 'e'].filter(k => x['opsi_' + k]).map(k => '<div class="' + (x.kunci === k ? 'c-ok semi' : 'muted') + '">' + k.toUpperCase() + '. ' + esc(x['opsi_' + k]) + (x.kunci === k ? ' ✓' : '') + '</div>').join('') + '</div></div>' +
            '<div class="col g8" style="align-items:flex-end"><span class="chip sm">' + esc(x.jenis.toUpperCase()) + '</span><div class="row g4"><button class="btn icon sm secondary" data-aksi="ubah" data-id="' + x.id_soal + '" title="Ubah">' + UI.ic('edit', 'sm') + '</button><button class="btn icon sm danger" data-aksi="hapus" data-id="' + x.id_soal + '" title="Hapus">' + UI.ic('trash', 'sm') + '</button></div></div></div>';
        }).join('') + '</div>' : UI.kosong('Belum ada soal. Tambahkan soal pilihan ganda A–E.', 'fileQ')) + '</div>';
    };
    const muat = async () => {
      if (!idPel) { isi.innerHTML = this.tanpaPelatihan(); return; }
      const id = idPel;
      UI.loading(isi, 2);
      try { await API.ambil('soal_list', { id_pelatihan: id }, d => { if (id === idPel) { data = d; gambar(); } }, { el: isi }); } catch (e) { UI.galat(isi, e, muat); }
    };
    const editor = x => {
      x = x || { jenis: 'pre+post', kunci: 'a' };
      UI.form({
        title: x.id_soal ? 'Ubah Soal' : 'Tambah Soal', wide: true, submit: 'Simpan Soal',
        fields: [
          { name: 'jenis', label: 'Dipakai untuk', type: 'seg', value: x.jenis, options: [['pre', 'Pre-test'], ['post', 'Post-test'], ['pre+post', 'Pre + Post']], full: true },
          { name: 'pertanyaan', label: 'Pertanyaan', type: 'textarea', value: x.pertanyaan },
          { name: 'opsi_a', label: 'Opsi A', value: x.opsi_a }, { name: 'opsi_b', label: 'Opsi B', value: x.opsi_b },
          { name: 'opsi_c', label: 'Opsi C', value: x.opsi_c }, { name: 'opsi_d', label: 'Opsi D', value: x.opsi_d },
          { name: 'opsi_e', label: 'Opsi E (opsional)', value: x.opsi_e },
          { name: 'kunci', label: 'Kunci jawaban', type: 'select', value: x.kunci, options: [['a', 'A'], ['b', 'B'], ['c', 'C'], ['d', 'D'], ['e', 'E']] }
        ],
        onSubmit: async v => {
          const r = await API.call('soal_simpan', { id_pelatihan: idPel, soal: Object.assign({ id_soal: x.id_soal }, v) });
          UI.toast(r.message); muat();
        }
      });
    };
    UI.klik(el, {
      tambah: () => idPel ? editor() : UI.toast('Pilih pelatihan terlebih dahulu.', 'info'),
      ubah: b => editor(data.soal.find(x => x.id_soal === b.dataset.id)),
      hapus: async b => {
        if (!await UI.konfirmasi('Hapus soal ini dari bank soal?', { ok: 'Hapus', bahaya: true })) return;
        const lama = data.soal; data.soal = data.soal.filter(x => x.id_soal !== b.dataset.id); gambar(); UI.toast('Soal dihapus.');
        API.call('soal_hapus', { id_soal: b.dataset.id }).catch(e => { data.soal = lama; gambar(); UI.gagal(e); });
      }
    });
    isi.addEventListener('click', e => { const b = e.target.closest('[data-f] button'); if (b) { filter = b.dataset.v; gambar(); } });
    try { await this.pemilih($('[data-picker]', el), {}, id => { idPel = id; muat(); if (opt.atas) opt.atas($('[data-atas]', el), id); }); } catch (e) { UI.galat(isi, e, () => this.halamanSoal(el, opt)); }
  },

  // ===========================================================
  // TUGAS & PENILAIAN
  // ===========================================================
  async halamanTugas(el, opt) {
    opt = opt || {};
    const judul = opt.judul;
    const bolehNilai = this.peran() === 'instruktur';
    el.innerHTML = this.kepala(judul || 'Tugas Peserta', bolehNilai ? 'Buat tugas, periksa berkas, beri nilai 0–100' : 'Pemantauan tugas · penilaian dilakukan instruktur', '<span data-picker></span><button class="btn primary sm" data-aksi="buat">' + UI.ic('plus', 'sm') + 'Buat Tugas</button>') + '<div data-atas></div><div data-isi></div>';
    const isi = $('[data-isi]', el);
    let idPel = '', data = { tugas: [], pengumpulan: [] }, tab = 'menunggu', cari = '';
    const gambar = () => {
      const kp = data.pengumpulan;
      const tunggu = kp.filter(k => !k.dinilai), sudah = kp.filter(k => k.dinilai);
      const q = cari.toLowerCase();
      const tampil = (tab === 'menunggu' ? tunggu : sudah).filter(k => !q || (k.nama_umkm + ' ' + k.nama_pemilik + ' ' + k.judul_tugas).toLowerCase().indexOf(q) >= 0);
      isi.innerHTML = '<div class="grid g2" style="align-items:start"><div class="card"><div class="card-h"><div class="ttl"><div class="h-sm">Pengumpulan</div><span class="chip sm">' + tunggu.length + ' antrean</span></div>' +
        '<div class="seg pill" data-tab><button data-v="menunggu" class="' + (tab === 'menunggu' ? 'on' : '') + '">Menunggu (' + tunggu.length + ')</button><button data-v="selesai" class="' + (tab === 'selesai' ? 'on' : '') + '">Dinilai (' + sudah.length + ')</button></div></div>' +
        '<div class="input-ic" style="margin-bottom:12px">' + UI.ic('search', 'sm') + '<input class="input" style="height:42px" placeholder="Cari UMKM atau tugas…" data-cari value="' + esc(cari) + '"></div>' +
        (tampil.length ? '<div class="list">' + tampil.map(k => this.itemKumpul(k, bolehNilai)).join('') + '</div>' : UI.kosong(tab === 'menunggu' ? 'Tidak ada tugas yang menunggu penilaian.' : 'Belum ada tugas yang dinilai.', 'checkSquare')) + '</div>' +
        '<div class="card"><div class="card-h"><div class="h-sm">Daftar Tugas</div></div>' +
        (data.tugas.length ? '<div class="list">' + data.tugas.map(t => '<div class="item" style="align-items:flex-start"><div class="ic-tile sm">' + UI.ic('clipboard', 'sm') + '</div><div class="grow"><div class="semi">' + esc(t.judul) + '</div>' +
          '<div class="t-sm muted clamp2">' + esc(t.instruksi) + '</div><div class="meta mt8">' + (idPel ? '' : '<span>' + esc(t.pelatihan) + '</span>') + '<span>' + UI.ic('clock', 'sm') + (t.batas_waktu ? 'Batas ' + UI.waktu(t.batas_waktu) : 'Tanpa batas waktu') + '</span><span>' + t.jumlah_kumpul + ' terkumpul</span></div></div>' +
          '<div class="row g4"><button class="btn icon sm secondary" data-aksi="ubahT" data-id="' + t.id_tugas + '" title="Ubah">' + UI.ic('edit', 'sm') + '</button><button class="btn icon sm danger" data-aksi="hapusT" data-id="' + t.id_tugas + '" title="Hapus">' + UI.ic('trash', 'sm') + '</button></div></div>').join('') + '</div>'
          : UI.kosong('Belum ada tugas.', 'clipboard')) + '</div></div>';
    };
    const muat = async () => {
      const id = idPel;
      UI.loading(isi, 2);
      try { await API.ambil('tugas_list', id ? { id_pelatihan: id } : {}, d => { if (id === idPel) { data = d; gambar(); } }, { el: isi }); } catch (e) { UI.galat(isi, e, muat); }
    };
    const editor = t => {
      t = t || {};
      UI.form({
        title: t.id_tugas ? 'Ubah Tugas' : 'Buat Tugas', submit: 'Simpan Tugas',
        fields: [
          { name: 'judul', label: 'Judul tugas', value: t.judul, full: true, placeholder: 'mis. Foto katalog 3 produk unggulan' },
          { name: 'instruksi', label: 'Instruksi', type: 'textarea', value: t.instruksi, placeholder: 'Jelaskan apa yang harus dikumpulkan peserta (JPG/PNG/PDF, maks 10 MB).' },
          { name: 'batas_waktu', label: 'Batas waktu (opsional)', type: 'datetime-local', value: String(t.batas_waktu || '').slice(0, 16).replace(' ', 'T'), full: true }
        ],
        onSubmit: async v => {
          const r = await API.call('tugas_simpan', Object.assign({ id_pelatihan: t.id_pelatihan || idPel, id_tugas: t.id_tugas }, v));
          UI.toast(r.message); muat();
        }
      });
    };
    const peta = {
      buat: () => idPel ? editor() : UI.toast('Pilih satu pelatihan terlebih dahulu.', 'info'),
      ubahT: b => editor(data.tugas.find(t => t.id_tugas === b.dataset.id)),
      hapusT: async b => {
        const t = data.tugas.find(x => x.id_tugas === b.dataset.id);
        if (t && t.jumlah_kumpul) return UI.toast('Tugas sudah punya kiriman peserta, tidak bisa dihapus.', 'bad');
        if (!await UI.konfirmasi('Hapus tugas ini?', { ok: 'Hapus', bahaya: true })) return;
        const lama = data.tugas; data.tugas = data.tugas.filter(x => x.id_tugas !== b.dataset.id); gambar(); UI.toast('Tugas dihapus.');
        API.call('tugas_hapus', { id_tugas: b.dataset.id }).catch(e => { data.tugas = lama; gambar(); UI.gagal(e); });
      }
    };
    this.pasangAksiKumpul(peta, () => data.pengumpulan, () => gambar());
    UI.klik(el, peta);
    isi.addEventListener('click', e => { const b = e.target.closest('[data-tab] button'); if (b) { tab = b.dataset.v; gambar(); } });
    isi.addEventListener('input', e => { if (e.target.matches('[data-cari]')) { cari = e.target.value; const pos = e.target.selectionStart; gambar(); const c = $('[data-cari]', isi); c.focus(); c.setSelectionRange(pos, pos); } });
    try { await this.pemilih($('[data-picker]', el), { semua: true }, id => { idPel = id; muat(); if (opt.atas) opt.atas($('[data-atas]', el), id); }); } catch (e) { UI.galat(isi, e, () => this.halamanTugas(el, opt)); }
  },

  itemKumpul(k, bolehNilai) {
    const ikon = /pdf/.test(k.tipe_file) ? 'file' : 'image';
    return '<div class="item" style="align-items:flex-start;flex-wrap:wrap"><div class="ic-tile">' + UI.ic(ikon) + '</div><div class="grow" style="min-width:180px">' +
      '<div class="row g8 wrap"><span class="semi">' + esc(k.nama_umkm) + '</span>' + (k.sektor ? '<span class="chip sm">' + esc(k.sektor.toUpperCase()) + '</span>' : '') + '</div>' +
      '<div class="t-sm c-primary clamp1">' + UI.ic('link', 'sm') + ' ' + esc(k.nama_file || 'Berkas tugas') + '</div>' +
      '<div class="meta"><span>' + esc(k.judul_tugas) + '</span><span>Oleh ' + esc(k.nama_pemilik) + ' · ' + UI.relatif(k.waktu_kumpul) + '</span></div>' +
      (k.dinilai ? '<div class="row g8 mt8"><span class="chip ok sm">Skor ' + UI.angka(k.skor) + '</span>' + (k.catatan ? '<span class="t-xs muted clamp1">“' + esc(k.catatan) + '”</span>' : '') + '</div>' : '') + '</div>' +
      '<div class="row g8"><button class="btn sm outline" data-aksi="lihatK" data-t="' + esc(k.id_tugas) + '" data-u="' + esc(k.id_umkm) + '">' + UI.ic('eye', 'sm') + 'Lihat</button>' +
      (bolehNilai ? '<button class="btn sm primary" data-aksi="nilaiK" data-t="' + esc(k.id_tugas) + '" data-u="' + esc(k.id_umkm) + '">' + UI.ic('edit', 'sm') + (k.dinilai ? 'Ubah Nilai' : 'Beri Nilai') + '</button>' : '') + '</div></div>';
  },

  /** Tambahkan aksi lihat berkas & beri nilai ke peta klik. */
  pasangAksiKumpul(peta, ambil, sesudah) {
    const cari = b => ambil().find(k => k.id_tugas === b.dataset.t && k.id_umkm === b.dataset.u);
    peta.lihatK = async b => {
      try { await UI.sibuk(b, async () => { const f = await API.call('tugas_file', { id_tugas: b.dataset.t, id_umkm: b.dataset.u }); const k = cari(b); UI.lihatBerkas(f, k ? k.nama_umkm + ' — ' + k.judul_tugas : f.nama); }); } catch (e) { UI.gagal(e); }
    };
    peta.nilaiK = b => {
      const k = cari(b);
      if (!k) return;
      UI.form({
        title: 'Beri Nilai Tugas', submit: 'Simpan Nilai',
        intro: '<div class="card well" style="margin-bottom:16px"><div class="semi">' + esc(k.nama_umkm) + '</div><div class="t-sm muted">' + esc(k.judul_tugas) + ' · ' + esc(k.nama_file) + '</div>' +
          '<button type="button" class="btn sm secondary mt12" data-lihat>' + UI.ic('eye', 'sm') + 'Lihat berkas</button></div>',
        fields: [
          { name: 'skor', label: 'Skor (0–100)', type: 'number', value: k.skor === null ? '' : k.skor, attrs: 'min="0" max="100" inputmode="numeric"', full: true },
          { name: 'catatan', label: 'Catatan untuk peserta', type: 'textarea', value: k.catatan, placeholder: 'mis. Pencahayaan sudah bagus, perbaiki latar belakang agar polos.' }
        ],
        onOpen: m => { const b = $('[data-lihat]', m.el); b.dataset.t = k.id_tugas; b.dataset.u = k.id_umkm; b.onclick = () => peta.lihatK(b); },
        onSubmit: async v => {
          if (v.skor === '' || isNaN(+v.skor) || +v.skor < 0 || +v.skor > 100) throw new Error('Skor harus angka 0–100.');
          // Optimistis: tampil "dinilai" seketika, simpan ke server di latar
          const lama = { skor: k.skor, catatan: k.catatan, dinilai: k.dinilai };
          Object.assign(k, { skor: +v.skor, catatan: v.catatan, dinilai: true });
          sesudah && sesudah(); UI.toast('Nilai ' + k.nama_umkm + ' tersimpan.');
          API.call('tugas_nilai', { id_tugas: k.id_tugas, id_umkm: k.id_umkm, skor: +v.skor, catatan: v.catatan })
            .catch(e => { Object.assign(k, lama); sesudah && sesudah(); UI.gagal(e); });
        }
      });
    };
  },

  // ===========================================================
  // REKAP NILAI
  // ===========================================================
  async halamanNilai(el) {
    el.innerHTML = this.kepala('Rekap Nilai', 'Pre-test, post-test, tugas & kehadiran per peserta', '<span data-picker></span><button class="btn outline sm" data-aksi="csv">' + UI.ic('download', 'sm') + 'Unduh CSV</button>') + '<div data-isi></div>';
    const isi = $('[data-isi]', el);
    let idPel = '', d = null;
    const muat = async () => {
      if (!idPel) { isi.innerHTML = this.tanpaPelatihan(); return; }
      const id = idPel;
      UI.loading(isi, 3);
      try { await API.ambil('nilai_rekap', { id_pelatihan: id }, x => { if (id === idPel) { d = x; gambar(); } }, { el: isi }); } catch (e) { UI.galat(isi, e, muat); }
    };
    const gambar = () => {
      {
        const r = d.rata, rows = d.rows;
        const naik = rows.filter(x => x.kenaikan !== null && x.kenaikan > 0).length;
        isi.innerHTML = '<div class="grid g4"><div class="card stat"><span class="l">Rata-rata Pre-test</span><span class="v">' + UI.angka(r.pre) + '</span></div>' +
          '<div class="card stat"><span class="l">Rata-rata Post-test</span><span class="v c-primary">' + UI.angka(r.post) + '</span></div>' +
          '<div class="card stat"><span class="l">Rata-rata Kenaikan</span><span class="v c-ok">' + (r.kenaikan === null ? '–' : (r.kenaikan > 0 ? '+' : '') + UI.angka(r.kenaikan)) + '</span><span class="t-xs muted">' + naik + '/' + rows.length + ' peserta naik</span></div>' +
          '<div class="card stat"><span class="l">Rata-rata Skor Tugas</span><span class="v">' + UI.angka(r.tugas) + '</span></div></div>' +
          (rows.length ? '<div class="card mt20"><div class="card-h"><div class="h-sm">Pre-test vs Post-test per Peserta</div></div><div style="overflow-x:auto"><div style="min-width:' + Math.max(560, rows.length * 56) + 'px">' +
            UI.grafikBatang({ w: Math.max(640, rows.length * 60), labels: rows.map(x => x.nama_umkm), maks: 100, series: [{ nama: 'Pre-test', warna: '#D8B8C0', nilai: rows.map(x => x.pre) }, { nama: 'Post-test', warna: '#9E3D52', nilai: rows.map(x => x.post) }] }) + '</div></div></div>' : '') +
          '<div class="card mt20"><div class="card-h"><div class="h-sm">Tabel Nilai</div><span class="chip sm">' + rows.length + ' peserta</span></div>' +
          (rows.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>UMKM</th><th>Sektor</th><th class="num">Hadir</th><th class="num">Pre</th><th class="num">Post</th><th class="num">Kenaikan</th><th class="num">Tugas</th><th>Status</th></tr></thead><tbody>' +
            rows.map(x => '<tr><td><div class="semi">' + esc(x.nama_umkm) + '</div><div class="t-xs muted">' + esc(x.nama_pemilik) + '</div></td><td>' + esc(x.sektor) + '</td><td class="num">' + x.hadir + '/' + x.jumlah_hari + '</td><td class="num">' + UI.angka(x.pre) + '</td><td class="num">' + UI.angka(x.post) + '</td>' +
              '<td class="num ' + (x.kenaikan > 0 ? 'c-ok' : (x.kenaikan !== null ? 'c-bad' : '')) + '">' + (x.kenaikan === null ? '–' : (x.kenaikan > 0 ? '+' : '') + UI.angka(x.kenaikan)) + '</td><td class="num">' + UI.angka(x.skor_tugas) + '</td><td>' + UI.chipLulus(x.lulus) + '</td></tr>').join('') +
            '</tbody></table></div>' : UI.kosong('Belum ada peserta terdaftar.', 'users')) + '</div>';
      }
    };
    UI.klik(el, {
      csv: () => {
        if (!d || !d.rows.length) return UI.toast('Belum ada data.', 'info');
        const h = ['Nama UMKM', 'Pemilik', 'Sektor', 'Hadir', 'Jumlah Hari', 'Pre-test', 'Post-test', 'Kenaikan', 'Skor Tugas', 'Status'];
        const q = v => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
        const csv = [h].concat(d.rows.map(x => [x.nama_umkm, x.nama_pemilik, x.sektor, x.hadir, x.jumlah_hari, x.pre, x.post, x.kenaikan, x.skor_tugas, x.lulus ? 'Lulus' : 'Belum lulus'])).map(r => r.map(q).join(';')).join('\r\n');
        const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a'); a.href = url; a.download = 'Rekap Nilai - ' + d.pelatihan.judul + '.csv'; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    });
    try { await this.pemilih($('[data-picker]', el), {}, id => { idPel = id; muat(); }); } catch (e) { UI.galat(isi, e, () => this.halamanNilai(el)); }
  }
};
