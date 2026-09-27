/* =============================================================
   RuangLatih — fb.js  (Migrasi Firebase · Fase 2)
   Memuat Firebase SDK (compat) dari gstatic, masuk dengan custom token
   dari GAS, dan halaman uji "#/uji-firebase" untuk memeriksa login
   serta aturan keamanan per peran. Belum mengubah sumber data aplikasi.
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
  async masuk(fbToken) {
    await this.muat();
    await this.auth.signInWithCustomToken(fbToken);
    return this.auth.currentUser;
  },

  /** Pastikan sudah masuk Firebase sesuai sesi RuangLatih (pulihkan / minta token baru bila perlu). */
  async pastikanMasuk() {
    await this.muat();
    let u = this.auth.currentUser || await new Promise(res => { const off = this.auth.onAuthStateChanged(x => { off(); res(x); }); });
    const s = Sesi.user();
    if (u && s && u.uid !== String(s.id)) { await this.auth.signOut(); u = null; }
    if (!u && s) { const r = await API.call('fb_token', {}, { retry: 2 }); u = await this.masuk(r.fb_token); }
    return u;
  },

  async keluar() { try { if (this.auth) await this.auth.signOut(); } catch (e) { } },

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
      await uji('Masuk Firebase (custom token dari GAS)', 'berhasil', async () => {
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
        await uji('Tulis & hapus log uji', 'berhasil', async () => {
          const ref = db().collection('log').doc('uji_' + Date.now());
          await ref.set({ waktu: UI.hariIni(), peran: 'admin', id_pengguna: String(s.id), nama: s.nama || '', aksi: 'Uji Firebase' });
          await ref.delete(); return 'ok';
        });
      } else if (s.peran === 'instruktur') {
        await uji('Pelatihan yang diampu', 'berhasil', async () => (await db().collection('pelatihan').where('id_instruktur', '==', String(s.id)).get()).size + ' dokumen');
        await uji('Peserta pelatihan yang diampu', 'berhasil', async () => (await db().collection('pendaftaran').where('id_instruktur', '==', String(s.id)).limit(50).get()).size + ' dokumen');
        await uji('Semua pelatihan (termasuk milik instruktur lain)', 'ditolak', async () => { await db().collection('pelatihan').limit(50).get(); });
        await uji('Baca PIN peserta', 'ditolak', async () => { await db().collection('akun_umkm').limit(1).get(); });
        await uji('Baca hasil evaluasi', 'ditolak', async () => { await db().collection('evaluasi_jawaban').limit(1).get(); });
      } else {
        let reg = null;
        await uji('Pendaftaran milik sendiri', 'berhasil', async () => { const q = await db().collection('pendaftaran').where('id_umkm', '==', String(s.id)).get(); reg = q.docs[0] ? q.docs[0].data() : null; return q.size + ' pelatihan'; });
        await uji('Profil UMKM sendiri', 'berhasil', async () => { const d = await db().doc('umkm/' + s.id).get(); return d.exists ? d.data().nama_umkm : 'belum ada'; });
        await uji('Profil UMKM lain', 'ditolak', async () => { await db().collection('umkm').limit(5).get(); });
        await uji('Pendaftaran peserta lain', 'ditolak', async () => { await db().collection('pendaftaran').limit(5).get(); });
        await uji('Baca PIN sendiri (akun_umkm)', 'ditolak', async () => { await db().doc('akun_umkm/' + s.id).get(); });
        if (reg) {
          await uji('Detail pelatihan yang diikuti', 'berhasil', async () => (await db().doc('pelatihan/' + reg.id_pelatihan).get()).data().judul);
          await uji('Soal pelatihan yang diikuti (tanpa kunci)', 'berhasil', async () => (await db().collection('soal').where('id_pelatihan', '==', reg.id_pelatihan).get()).size + ' soal');
          await uji('Kunci jawaban', 'ditolak', async () => { await db().doc('kunci_soal/' + reg.id_pelatihan).get(); });
        }
      }
      $('[data-ringkas]', el).innerHTML = '<div class="card well tight row between"><span class="semi">' + lulus + ' dari ' + total + ' uji berhasil</span>' + (lulus === total ? '<span class="chip ok">Siap lanjut</span>' : '<span class="chip bad">Perlu diperiksa</span>') + '</div>';
    };
    $('[data-ulang]', el).onclick = e => UI.sibuk(e.currentTarget, jalan);
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
