/* =============================================================
   RuangLatih — fsdata.js  (Migrasi Firebase · Fase 3)
   Mode Firebase di browser:
   • Salinan data realtime dari Firestore (onSnapshot) sesuai hak peran.
   • Aksi rutin dijalankan LANGSUNG di perangkat oleh mesin.js (logika
     yang sama dengan server) → hasil instan, tanpa menunggu GAS.
   • Perubahan ditulis ke Firestore (batch); aturan keamanan tetap berlaku.
   • Aksi yang butuh rahasia/Google Drive tetap dikirim ke GAS (mode Firebase).
   ============================================================= */
var FSD = {
  VERSI: '3.7', // naikkan setiap mesin.js dibangun ulang (agar browser tidak memakai versi lama)
  data: {}, _src: {}, _off: [], _siap: null, _pel: {}, _uid: '', _versi: 0, _t: null,

  // ---------- Aksi yang dijalankan di perangkat ----------
  BACA: ['pelatihan_list', 'pelatihan_detail', 'materi_list', 'soal_list', 'tugas_list', 'nilai_rekap', 'dasbor_instruktur', 'dasbor_admin',
    'draft_list', 'umkm_list', 'umkm_riwayat', 'instruktur_list', 'eval_form', 'eval_hasil', 'log_list', 'laporan_data',
    'p_beranda', 'p_pelatihan', 'p_ruang', 'p_soal', 'p_eval_form', 'p_materi', 'p_riwayat', 'multi'],
  // tugas_nilai sengaja lewat server (GAS): nilai adalah data penting → tidak bergantung aturan di browser
  // pelatihan_hapus & tugas_hapus lewat server: berkas Google Drive (flyer, lampiran) ikut dihapus
  TULIS: ['pelatihan_simpan', 'draft_simpan', 'draft_hapus', 'aktivitas_set', 'syarat_set', 'peserta_daftarkan', 'peserta_ubah',
    'peserta_hapus', 'umkm_status', 'soal_simpan', 'soal_simpan_banyak', 'soal_hapus', 'tugas_simpan',
    'eval_simpan_form', 'eval_salin', 'p_absen', 'p_kirim_eval'],
  /** true bila aksi ini dijalankan di perangkat (bukan di GAS). */
  lokal(action, d) {
    d = d || {};
    if (action === 'umkm_simpan') return !!d.id_umkm; // UMKM baru butuh PIN dari server
    if (action === 'instruktur_simpan') return !!d.id_instruktur && !d.kode_baru && d.kode_akses === undefined;
    return this.BACA.indexOf(action) >= 0 || this.TULIS.indexOf(action) >= 0;
  },

  // ---------- Sumber data untuk mesin.js ----------
  kol(c) { const m = this.data[c]; return m ? Array.from(m.values()) : []; },

  /** Muat mesin + masuk Firebase + pasang pendengar realtime (sekali per sesi). */
  mulai() {
    const u = Sesi.user();
    if (!u) return Promise.reject(new Error('Belum masuk.'));
    if (this._siap && this._uid === u.peran + ':' + u.id) return this._siap;
    this.berhenti();
    this._uid = u.peran + ':' + u.id;
    this._siap = (async () => {
      await Promise.all([FBC.pastikanMasuk(), window.MESIN ? null : UI.muatSkrip('js/mesin.js?v=' + this.VERSI)]);
      const db = FBC.db, uid = String(u.id), tunggu = [];
      const kol = (key, q, col) => tunggu.push(this.dengar(key, q, col));
      const dok = (key, ref, col) => tunggu.push(this.dengarDok(key, ref, col));
      dok('pengaturan', db.doc('pengaturan/umum'), 'pengaturan');
      // ⚡ HEMAT KUOTA: yang dimuat hanya data inti; data besar (soal, kiriman tugas, jawaban evaluasi, log lengkap)
      //    dimuat per pelatihan / saat halamannya dibuka. Firestore menagih baca hanya untuk dokumen yang dimuat/berubah.
      if (u.peran === 'admin') {
        ['pelatihan', 'pendaftaran', 'umkm', 'akun_umkm', 'instruktur', 'akun_instruktur', 'pelatihan_rahasia', 'tugas', 'materi',
          'evaluasi_form', 'draft_pelatihan'].forEach(c => kol(c, db.collection(c), c));
        kol('log', db.collection('log').orderBy('waktu', 'desc').limit(5), 'log'); // dasbor cukup 5 terbaru
      } else if (u.peran === 'instruktur') {
        kol('pelatihan', db.collection('pelatihan').where('id_instruktur', '==', uid), 'pelatihan');
        kol('pendaftaran', db.collection('pendaftaran').where('id_instruktur', '==', uid), 'pendaftaran');
        dok('instruktur', db.doc('instruktur/' + uid), 'instruktur');
        kol('materi', db.collection('materi'), 'materi');
      } else {
        kol('pendaftaran', db.collection('pendaftaran').where('id_umkm', '==', uid), 'pendaftaran');
        // pelatihan: yang akan datang/berlangsung (info & flyer) + yang diikuti (dimuat per pelatihan)
        kol('pelatihan', db.collection('pelatihan').where('status', 'in', ['akan datang', 'berlangsung']), 'pelatihan');
        dok('umkm', db.doc('umkm/' + uid), 'umkm');
        kol('pengumpulan', db.collection('pengumpulan').where('id_umkm', '==', uid), 'pengumpulan');
        dok('evalDEFAULT', db.doc('evaluasi_form/DEFAULT'), 'evaluasi_form');
        // materi: umum + sektor usahanya (+ materi pelatihan yang diikuti, per pelatihan)
        kol('materiUmum', db.collection('materi').where('cakupan', '==', 'umum'), 'materi');
        if (u.sektor) kol('materiSektor', db.collection('materi').where('sektor', '==', u.sektor), 'materi');
      }
      await Promise.all(tunggu);
      await this.perPelatihan();
      this._aktif = true;
      // Identitas Firebase berubah (mis. akun lain masuk di tab lain) → sambung ulang dengan akun yang benar
      if (!this._awasi) this._awasi = FBC.auth.onAuthStateChanged(a => { const s = Sesi.user(); if (this._aktif && s && (!a || a.uid !== String(s.id))) this.pulihkan(); });
      return true;
    })();
    this._siap.catch(() => { this._siap = null; });
    return this._siap;
  },

  /** Data per pelatihan (soal, tugas, dst.) untuk pelatihan milik instruktur / yang diikuti peserta. */
  /**
   * Data per pelatihan: instruktur → semua pelatihannya; peserta → yang diikuti;
   * admin → pelatihan tahun berjalan & yang belum selesai (pelatihan lain dimuat saat dibuka).
   */
  perPelatihan() {
    const u = Sesi.user();
    if (!u || !FBC.db) return Promise.resolve();
    const th = UI.hariIni().slice(0, 4);
    const ids = u.peran === 'instruktur' ? this.kol('pelatihan').map(p => p._id)
      : u.peran === 'peserta' ? this.kol('pendaftaran').map(r => r.id_pelatihan)
        : this.kol('pelatihan').filter(p => p.tahun === th || p.status !== 'selesai').map(p => p._id);
    return Promise.all(ids.map(id => this.muatPelatihan(id)));
  },
  /** Pasang pendengar data satu pelatihan (sekali per sesi). */
  muatPelatihan(id) {
    const u = Sesi.user();
    if (!id || !u || !FBC.db) return Promise.resolve();
    if (this._pel[id]) return this._pel[id];
    const db = FBC.db, t = [];
    if (u.peran === 'admin') {
      t.push(this.dengar('soal:' + id, db.collection('soal').where('id_pelatihan', '==', id), 'soal'));
      t.push(this.dengarDok('kunci:' + id, db.doc('kunci_soal/' + id), 'kunci_soal'));
      t.push(this.dengar('kumpul:' + id, db.collection('pengumpulan').where('id_pelatihan', '==', id), 'pengumpulan'));
      t.push(this.dengar('evalj:' + id, db.collection('evaluasi_jawaban').where('id_pelatihan', '==', id), 'evaluasi_jawaban'));
    } else {
      t.push(this.dengar('soal:' + id, db.collection('soal').where('id_pelatihan', '==', id), 'soal'));
      t.push(this.dengar('tugas:' + id, db.collection('tugas').where('id_pelatihan', '==', id), 'tugas'));
      if (u.peran === 'instruktur') {
        t.push(this.dengarDok('kunci:' + id, db.doc('kunci_soal/' + id), 'kunci_soal'));
        t.push(this.dengar('kumpul:' + id, db.collection('pengumpulan').where('id_pelatihan', '==', id), 'pengumpulan'));
      } else {
        t.push(this.dengarDok('eval:' + id, db.doc('evaluasi_form/' + id), 'evaluasi_form'));
        t.push(this.dengarDok('pel:' + id, db.doc('pelatihan/' + id), 'pelatihan'));
        t.push(this.dengar('materiPel:' + id, db.collection('materi').where('id_pelatihan', '==', id), 'materi'));
      }
    }
    return (this._pel[id] = Promise.all(t));
  },
  /** Admin: data lengkap satu tahun (mis. dasbor tahun lalu). */
  muatTahun(th) { return Promise.all(this.kol('pelatihan').filter(p => p.tahun === String(th)).map(p => this.muatPelatihan(p._id))); },
  /** Admin: log aktivitas lengkap (hanya saat halaman Log dibuka; log dibersihkan tiap akhir bulan). */
  muatLogPenuh() {
    if (this._logPenuh) return this._logPenuh;
    return (this._logPenuh = this.dengar('logPenuh', FBC.db.collection('log').orderBy('waktu', 'desc').limit(500), 'log'));
  },

  _simpanDok(col, id, isi, key) {
    const m = this.data[col] || (this.data[col] = new Map());
    if (isi) m.set(id, Object.assign(isi, { _id: id }));
    else {
      // hapus hanya bila tidak ada pendengar lain yang memuat dokumen ini
      const lain = Object.keys(this._src).some(k => k !== key && this._src[k].col === col && this._src[k].ids.has(id));
      if (!lain) m.delete(id);
    }
  },
  dengar(key, q, col) {
    return new Promise(res => {
      let awal = true;
      this._src[key] = { col: col, ids: new Set() };
      const off = q.onSnapshot(snap => {
        const lama = this._src[key].ids, baru = new Set();
        snap.docs.forEach(d => { baru.add(d.id); this._simpanDok(col, d.id, d.data(), key); });
        this._src[key].ids = baru;
        lama.forEach(id => { if (!baru.has(id)) this._simpanDok(col, id, null, key); });
        if (awal) { awal = false; res(); } else this.berubah(col);
      }, err => { this._galat(key, err); if (awal) { awal = false; res(); } });
      this._off.push(off);
    });
  },
  dengarDok(key, ref, col) {
    return new Promise(res => {
      let awal = true;
      this._src[key] = { col: col, ids: new Set([ref.id]) };
      const off = ref.onSnapshot(d => {
        this._simpanDok(col, ref.id, d.exists ? d.data() : null, key);
        if (awal) { awal = false; res(); } else this.berubah(col);
      }, err => { this._galat(key, err); if (awal) { awal = false; res(); } });
      this._off.push(off);
    });
  },

  /** Pendengar ditolak (biasanya identitas tertukar) → pulihkan otomatis tanpa perlu reload. */
  _galat(key, err) {
    if (err && err.code === 'permission-denied') this.pulihkan();
    else console.warn('Firestore', key, err && err.code);
  },
  pulihkan() {
    if (this._pulih || Date.now() - (this._pulihT || 0) < 15000) return;
    this._pulih = true; this._pulihT = Date.now();
    setTimeout(async () => {
      try {
        if (!Sesi.user()) return;
        await this.cocokkanAuth();
        this.berhenti();
        await this.mulai();
        Simpan.hapusSemua();
        if (window.App && App.segarkanDiam) App.segarkanDiam();
      } catch (e) { console.warn('Pemulihan sinkron gagal', e && e.message); }
      finally { this._pulih = false; }
    }, 400);
  },

  /** Data berubah (oleh pengguna lain / perangkat lain / diri sendiri) → segarkan tampilan hidup. */
  berubah(col) {
    this._versi++;
    if (col === 'pelatihan' || col === 'pendaftaran') this.perPelatihan();
    clearTimeout(this._t);
    this._t = setTimeout(() => { Simpan.hapusSemua(); if (window.App && App.segarkanDiam) App.segarkanDiam(); }, 300);
  },

  berhenti() {
    this._off.forEach(f => { try { f(); } catch (e) { } });
    this._off = []; this.data = {}; this._src = {}; this._pel = {}; this._siap = null; this._uid = ''; this._aktif = false; this._logPenuh = null;
  },

  // ---------- Jalankan aksi di perangkat ----------
  async jalankan(action, data) {
    await this.mulai();
    const u = Sesi.user();
    const sesi = { r: u.peran, id: u.id, n: u.nama, u: u.umkm, s: u.sektor, gp: !!u.wajib_ganti_pin };
    // muat data tambahan yang dibutuhkan aksi ini saja (hemat kuota)
    const d = data || {};
    if (d.id_pelatihan) await this.muatPelatihan(d.id_pelatihan);
    if (action === 'dasbor_admin' && d.tahun) await this.muatTahun(d.tahun);
    if (action === 'log_list' && u.peran === 'admin') await this.muatLogPenuh();
    const r = MESIN.jalankan(this, action, data || {}, sesi);
    if (r.tulisan.length) {
      // log aktivitas dikirim terpisah: bila log gagal, penyimpanan utama tetap berhasil
      const utama = r.tulisan.filter(w => w.col !== 'log'), log = r.tulisan.filter(w => w.col === 'log');
      await this.cocokkanAuth();
      this.terapkanLokal(r.tulisan);
      try { if (utama.length) await this.tulis(utama); }
      catch (e) { this.bersihkanHantu(utama); throw e; }
      if (log.length) this.tulis(log).catch(() => { });
    }
    return JSON.parse(JSON.stringify(r.hasil));
  },

  /**
   * Pastikan identitas Firebase di browser = akun yang sedang dipakai di aplikasi.
   * (Login Firebase berlaku untuk semua tab; bila akun lain masuk di tab lain, identitas bisa tertukar.)
   */
  async cocokkanAuth() {
    const s = Sesi.user();
    if (!s || !FBC.auth) return;
    let u = FBC.auth.currentUser;
    let ok = u && u.uid === String(s.id);
    if (ok) { try { ok = (await u.getIdTokenResult()).claims.peran === s.peran; } catch (e) { ok = false; } }
    if (!ok) {
      try { await FBC.auth.signOut(); } catch (e) { }
      const r = await API._kirim('fb_token', {}, { retry: 2 });
      await FBC.masuk(r.fb_token);
    }
  },
  /** Setelah tulisan ditolak: buang dokumen "bayangan" yang sempat ditampilkan lokal. */
  bersihkanHantu(W) {
    W.forEach(w => {
      const ada = Object.keys(this._src).some(k => this._src[k].col === w.col && this._src[k].ids.has(w.id));
      if (!ada && this.data[w.col]) this.data[w.col].delete(w.id);
    });
    this._versi++;
  },
  izinDitolak: [],

  /** Terapkan perubahan ke salinan lokal SEKETIKA (halaman berikutnya langsung melihat data baru). */
  terapkanLokal(W) {
    const salin = v => JSON.parse(JSON.stringify(v, (k, x) => (x && x.__hapus ? undefined : x)));
    W.forEach(w => {
      const m = this.data[w.col] || (this.data[w.col] = new Map());
      if (w.hapus) { m.delete(w.id); return; }
      if (w.set) { m.set(w.id, Object.assign(salin(w.set), { _id: w.id })); return; }
      const d = m.get(w.id) || { _id: w.id };
      w.ubah.forEach(p => {
        let o = d;
        p[0].forEach((k, i) => {
          if (i === p[0].length - 1) { if (p[1] && p[1].__hapus) delete o[k]; else o[k] = p[1] && typeof p[1] === 'object' ? salin(p[1]) : p[1]; }
          else o = (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {});
        });
      });
      m.set(w.id, d);
    });
    this._versi++;
  },

  /** Kirim tulisan hasil terjemahan ke Firestore (batch ≤ 450). */
  async tulis(W) {
    const db = FBC.db, FV = firebase.firestore.FieldValue;
    const bersih = v => {
      if (v === undefined) return null;
      if (v && v.__hapus) return FV.delete();
      if (Array.isArray(v)) return v.map(bersih);
      if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach(k => o[k] = bersih(v[k])); return o; }
      return v;
    };
    const kirim = [];
    for (let i = 0; i < W.length; i += 450) {
      const b = db.batch();
      W.slice(i, i + 450).forEach(w => {
        const ref = db.collection(w.col).doc(String(w.id));
        if (w.hapus) b.delete(ref);
        else if (w.set) b.set(ref, bersih(w.set));
        else {
          const isi = {};
          w.ubah.forEach(p => { let o = isi; p[0].forEach((k, j) => { if (j === p[0].length - 1) o[k] = bersih(p[1]); else o = (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }); });
          b.set(ref, isi, { merge: true });
        }
      });
      kirim.push(b.commit());
    }
    // Offline: perubahan sudah tersimpan di perangkat & terkirim otomatis saat sinyal kembali
    const semua = Promise.all(kirim).catch(e => {
      const izin = (e && e.code) === 'permission-denied';
      const err = new Error(izin ? 'Perubahan ditolak aturan keamanan (' + W.map(w => w.col).filter((c, i, a) => a.indexOf(c) === i).join(', ') + ').' : 'Gagal menyimpan ke Firebase: ' + ((e && e.message) || e));
      if (izin) err.code = 'FB_IZIN';
      throw err;
    });
    const hasil = await Promise.race([semua.then(() => 'ok'), new Promise(r => setTimeout(() => r('lambat'), 6000))]);
    if (hasil === 'lambat') {
      if (navigator.onLine === false) { semua.catch(e => UI.toast(e.message, 'bad')); return; } // tersimpan di perangkat, dikirim saat online
      await semua;
    }
  }
};
