/* =============================================================
   RuangLatih — pdfkecil.js
   Memperkecil PDF DI PERANGKAT sebelum diunggah (materi, lampiran tugas, kiriman tugas).
   1) Optimasi tanpa mengurangi kualitas (struktur berkas dirapikan)         → semua PDF
   2) Kompres ulang halaman ke 150 dpi (JPEG) — hanya bila:
        • PDF hasil scan/foto (hampir tanpa teks), atau
        • PDF > 5 MB dan hasilnya ≥ 40% lebih kecil (teks tetap terbaca jelas)
   Selalu dipilih hasil TERKECIL; bila tidak ada yang lebih kecil → berkas asli.
   Pustaka (pdf-lib, pdf.js) dimuat hanya saat ada PDF yang diunggah.
   ============================================================= */
var PDFKECIL = (function () {
  const URL_PDFLIB = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
  const URL_PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/legacy/build/pdf.min.mjs';
  const URL_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/legacy/build/pdf.worker.min.mjs';
  const DPI = 150, SISI_MAKS = 1800, MUTU = 0.72, HALAMAN_MAKS = 120;
  let _pdfjs = null;

  async function muatPdfLib() { if (!window.PDFLib) await UI.muatSkrip(URL_PDFLIB); return window.PDFLib; }
  async function muatPdfJs() {
    if (_pdfjs) return _pdfjs;
    const m = await import(URL_PDFJS);
    // worker lintas-domain dibungkus Blob agar diizinkan browser
    try {
      const txt = await (await fetch(URL_WORKER)).text();
      m.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([txt], { type: 'text/javascript' }));
    } catch (e) { m.GlobalWorkerOptions.workerSrc = URL_WORKER; }
    return (_pdfjs = m);
  }
  const ukuran = n => n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1048576).toFixed(1).replace('.', ',') + ' MB';

  /**
   * @returns {Promise<{file: File, asli: number, hasil: number, metode: 'asli'|'optimasi'|'pindaian'|'kompres'}>}
   * opt.progres(teks) dipanggil untuk menampilkan kemajuan.
   */
  async function kecilkan(file, opt) {
    opt = opt || {};
    const lapor = t => { try { opt.progres && opt.progres(t); } catch (e) { } };
    const asli = new Uint8Array(await file.arrayBuffer());
    let terbaik = { bytes: asli, metode: 'asli' };
    let PDFLib = null;
    // 1) optimasi tanpa kehilangan kualitas
    try {
      lapor('Memperkecil PDF…');
      PDFLib = await muatPdfLib();
      const doc = await PDFLib.PDFDocument.load(asli, { ignoreEncryption: true, updateMetadata: false });
      const b = await doc.save({ useObjectStreams: true, addDefaultPage: false });
      if (b.length < terbaik.bytes.length) terbaik = { bytes: b, metode: 'optimasi' };
    } catch (e) { /* PDF terkunci/rusak → lanjut */ }
    // 2) kompres ulang halaman bila bermanfaat
    let pdf = null;
    try {
      if (!PDFLib) throw new Error('pdf-lib tidak tersedia');
      const pdfjs = await muatPdfJs();
      pdf = await pdfjs.getDocument({ data: asli.slice(), isEvalSupported: false }).promise;
      const n = pdf.numPages, sampel = Math.min(n, 5);
      let huruf = 0;
      for (let i = 1; i <= sampel; i++) {
        const tc = await (await pdf.getPage(i)).getTextContent();
        huruf += tc.items.reduce((s, x) => s + String(x.str || '').trim().length, 0);
      }
      const pindaian = huruf / sampel < 200;
      const besar = asli.length > 5 * 1048576;
      if ((pindaian || besar) && n <= HALAMAN_MAKS) {
        const out = await PDFLib.PDFDocument.create();
        const c = document.createElement('canvas'), g = c.getContext('2d');
        for (let i = 1; i <= n; i++) {
          lapor('Memperkecil PDF… halaman ' + i + '/' + n);
          const page = await pdf.getPage(i);
          const v1 = page.getViewport({ scale: 1 });
          const skala = Math.min(DPI / 72, SISI_MAKS / Math.max(v1.width, v1.height));
          const vp = page.getViewport({ scale: skala });
          c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
          g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
          await page.render({ canvasContext: g, canvas: c, viewport: vp }).promise;
          const jpg = await new Promise(r => c.toBlob(r, 'image/jpeg', MUTU));
          const img = await out.embedJpg(new Uint8Array(await jpg.arrayBuffer()));
          out.addPage([v1.width, v1.height]).drawImage(img, { x: 0, y: 0, width: v1.width, height: v1.height });
          page.cleanup();
        }
        const b = await out.save({ useObjectStreams: true });
        if (b.length < terbaik.bytes.length * (pindaian ? 0.95 : 0.6)) terbaik = { bytes: b, metode: pindaian ? 'pindaian' : 'kompres' };
      }
    } catch (e) { /* pdf.js gagal/terkunci → pakai hasil terbaik sejauh ini */ }
    finally { try { pdf && pdf.destroy(); } catch (e) { } }
    if (terbaik.metode === 'asli') return { file: file, asli: file.size, hasil: file.size, metode: 'asli' };
    return { file: new File([terbaik.bytes], file.name.replace(/\.pdf$/i, '') + '.pdf', { type: 'application/pdf' }), asli: file.size, hasil: terbaik.bytes.length, metode: terbaik.metode };
  }
  /** Teks ringkas hasil, mis. "PDF diperkecil 4,2 MB → 1,1 MB (−74%)". */
  function ringkas(r) {
    if (!r || r.metode === 'asli') return '';
    return 'PDF diperkecil ' + ukuran(r.asli) + ' → ' + ukuran(r.hasil) + ' (−' + Math.round((1 - r.hasil / r.asli) * 100) + '%)';
  }
  return { kecilkan: kecilkan, ringkas: ringkas, ukuran: ukuran };
})();
