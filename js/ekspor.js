/* =============================================================
   RuangLatih — ekspor.js
   Ekspor Excel (.xlsx) & PDF langsung di browser dengan FORMAT BAKU
   (lebar kolom, lipat teks, header berwarna, judul di tengah).
   Tidak memanggil server → selesai < 1 detik.
   • Excel : berkas .xlsx asli (Office Open XML) langsung terunduh.
   • PDF   : jendela cetak browser → pilih "Simpan sebagai PDF".
   ============================================================= */
var EKSPOR = (function () {
  // ---------- ZIP (metode STORE, tanpa kompresi) ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(berkas) { // berkas: [{ nama, isi (string) }]
    const enc = new TextEncoder(), bag = [], pusat = [];
    let posisi = 0;
    const d = new Date(), waktu = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), tgl = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    berkas.forEach(f => {
      const nama = enc.encode(f.nama), data = enc.encode(f.isi), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, waktu, true); h.setUint16(12, tgl, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
      h.setUint16(26, nama.length, true); h.setUint16(28, 0, true);
      bag.push(new Uint8Array(h.buffer), nama, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, waktu, true); c.setUint16(14, tgl, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, nama.length, true); c.setUint32(42, posisi, true);
      pusat.push(new Uint8Array(c.buffer), nama);
      posisi += 30 + nama.length + data.length;
    });
    const ukPusat = pusat.reduce((s, x) => s + x.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, berkas.length, true); e.setUint16(10, berkas.length, true); e.setUint32(12, ukPusat, true); e.setUint32(16, posisi, true);
    return new Blob(bag.concat(pusat, [new Uint8Array(e.buffer)]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  const xml = v => String(v === null || v === undefined ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const kol = i => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const warna = () => { const w = (window.UI && UI.warna ? UI.warna('primary') : '#9E3D52').replace('#', '').toUpperCase(); return /^[0-9A-F]{6}$/.test(w) ? w : '9E3D52'; };

  /**
   * Buat & unduh .xlsx.
   * o = { nama, lembar, kop: [judul, sub, info], header: [], baris: [[]], lebar: [], rata: ['c'|'l'|'r'], catatan: [teks] }
   */
  function xlsx(o) {
    const nK = o.header.length, akhir = kol(nK - 1), kop = (o.kop || []).filter(Boolean);
    const rowsXml = [], merge = [];
    let r = 0;
    const sel = (c, v, s) => {
      const ref = kol(c) + r;
      if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '" s="' + s + '"><v>' + v + '</v></c>';
      return '<c r="' + ref + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' + xml(v) + '</t></is></c>';
    };
    kop.forEach((t, i) => { r++; rowsXml.push('<row r="' + r + '"' + (i === 0 ? ' ht="24" customHeight="1"' : '') + '>' + sel(0, t, i === 0 ? 1 : i === 1 ? 2 : 3) + '</row>'); merge.push('A' + r + ':' + akhir + r); });
    if (kop.length) { r++; rowsXml.push('<row r="' + r + '"/>'); }
    r++; const rHeader = r;
    const tH = Math.max(32, Math.max.apply(null, o.header.map((h, c) => Math.ceil(String(h).length * 1.15 / Math.max(4, ((o.lebar || [])[c] || 14) - 1.5)))) * 13.5 + 6);
    rowsXml.push('<row r="' + r + '" ht="' + tH + '" customHeight="1">' + o.header.map((h, c) => sel(c, h, 4)).join('') + '</row>');
    // Tinggi baris diperkirakan dari panjang teks & lebar kolom → teks terlipat tidak terpotong (Excel tidak menyesuaikan sendiri)
    const tinggi = b => {
      let n = 1;
      b.forEach((v, c) => { const w = Math.max(4, ((o.lebar || [])[c] || 14) - 1.5); String(v === null || v === undefined ? '' : v).split('\n').forEach((t, i, arr) => { n = Math.max(n, arr.length, Math.ceil(t.length * 1.08 / w)); }); });
      return Math.min(409, Math.max(18, n * 13.5 + 4));
    };
    o.baris.forEach(b => { r++; rowsXml.push('<row r="' + r + '" ht="' + tinggi(b) + '" customHeight="1">' + b.map((v, c) => sel(c, v, (o.rata || [])[c] === 'c' ? 6 : (o.rata || [])[c] === 'r' ? 7 : 5)).join('') + '</row>'); });
    const rAkhirData = r;
    (o.catatan || []).forEach((t, i) => { r++; if (i === 0) { rowsXml.push('<row r="' + r + '"/>'); r++; } rowsXml.push('<row r="' + r + '">' + sel(0, t, 8) + '</row>'); merge.push('A' + r + ':' + akhir + r); });
    const cols = '<cols>' + o.header.map((h, c) => '<col min="' + (c + 1) + '" max="' + (c + 1) + '" width="' + ((o.lebar || [])[c] || 14) + '" customWidth="1"/>').join('') + '</cols>';
    const lembar = xml(o.lembar || 'Data').slice(0, 31);
    const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:' + akhir + Math.max(r, 1) + '"/>' +
      '<sheetViews><sheetView workbookViewId="0" zoomScale="100"><pane ySplit="' + rHeader + '" topLeftCell="A' + (rHeader + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="18"/>' + cols + '<sheetData>' + rowsXml.join('') + '</sheetData>' +
      (o.baris.length ? '<autoFilter ref="A' + rHeader + ':' + akhir + rAkhirData + '"/>' : '') +
      (merge.length ? '<mergeCells count="' + merge.length + '">' + merge.map(m => '<mergeCell ref="' + m + '"/>').join('') + '</mergeCells>' : '') +
      '<printOptions horizontalCentered="1"/><pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
      '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>';
    const W = warna();
    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="6"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF' + W + '"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
      '<font><i/><sz val="9"/><color rgb="FF665559"/><name val="Calibri"/></font><font><b/><sz val="10"/><name val="Calibri"/></font></fonts>' +
      '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF' + W + '"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFC9B3B9"/></left><right style="thin"><color rgb="FFC9B3B9"/></right><top style="thin"><color rgb="FFC9B3B9"/></top><bottom style="thin"><color rgb="FFC9B3B9"/></bottom><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
      '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
      '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf>' +
      '<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    const berkas = [
      { nama: '[Content_Types].xml', isi: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { nama: '_rels/.rels', isi: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { nama: 'xl/workbook.xml', isi: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + lembar + '" sheetId="1" r:id="rId1"/></sheets>' +
        '<definedNames>' + (o.baris.length ? '<definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">\'' + lembar + '\'!$A$' + rHeader + ':$' + akhir + '$' + rAkhirData + '</definedName>' : '') +
        '<definedName name="_xlnm.Print_Titles" localSheetId="0">\'' + lembar + '\'!$' + rHeader + ':$' + rHeader + '</definedName></definedNames></workbook>' },
      { nama: 'xl/_rels/workbook.xml.rels', isi: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { nama: 'xl/styles.xml', isi: styles },
      { nama: 'xl/worksheets/sheet1.xml', isi: sheet }
    ];
    unduh(zip(berkas), bersihNama(o.nama) + '.xlsx');
  }

  /**
   * PDF lewat jendela cetak browser (A4 mendatar) — pilih "Simpan sebagai PDF".
   * o = { nama, kop: [judul, sub, info], header: [], baris: [[]], lebar: [% per kolom], rata: [], catatan: [], tegak: false }
   */
  function pdf(o) {
    const W = '#' + warna(), kop = o.kop || [];
    const lebar = o.lebar || [], total = lebar.reduce((s, x) => s + x, 0) || 1;
    const html = '<!doctype html><html lang="id"><head><meta charset="utf-8"><title>' + xml(bersihNama(o.nama)) + '</title><style>' +
      '@page{size:A4 ' + (o.tegak ? 'portrait' : 'landscape') + ';margin:10mm 9mm 12mm}' +
      '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      'body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#231B1E;font-size:9pt}' +
      '.kop{text-align:center;margin-bottom:8px}.kop h1{margin:0;font-size:15pt;color:' + W + '}.kop .s{font-weight:bold;font-size:11pt;margin-top:3px}.kop .i{color:#665559;font-size:9pt;margin-top:3px}' +
      'hr{border:0;border-top:2px solid ' + W + ';margin:8px 0 10px}' +
      'table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}tr{page-break-inside:avoid}' +
      'th{background:' + W + ';color:#fff;font-size:7.5pt;line-height:1.2;padding:5px 4px;border:1px solid ' + W + ';text-align:center;vertical-align:middle}' +
      'td{border:1px solid #D8C3C8;padding:3px 4px;vertical-align:top;font-size:8pt;line-height:1.3;word-wrap:break-word;overflow-wrap:break-word;hyphens:auto}' +
      'tbody tr:nth-child(even) td{background:#FBF6F7}.c{text-align:center}.r{text-align:right}' +
      '.cat{margin-top:8px;font-size:9pt}.cat b{font-weight:bold}.kaki{margin-top:6px;color:#665559;font-size:8pt}' +
      '</style></head><body>' +
      '<div class="kop">' + (kop[0] ? '<h1>' + xml(kop[0]) + '</h1>' : '') + (kop[1] ? '<div class="s">' + xml(kop[1]) + '</div>' : '') + (kop[2] ? '<div class="i">' + xml(kop[2]) + '</div>' : '') + '</div><hr>' +
      '<table><colgroup>' + o.header.map((h, i) => '<col style="width:' + ((lebar[i] || 1) / total * 100).toFixed(2) + '%">').join('') + '</colgroup>' +
      '<thead><tr>' + o.header.map(h => '<th>' + xml(h) + '</th>').join('') + '</tr></thead><tbody>' +
      (o.baris.length ? o.baris.map(b => '<tr>' + b.map((v, i) => '<td class="' + ({ c: 'c', r: 'r' }[(o.rata || [])[i]] || '') + '">' + xml(v) + '</td>').join('') + '</tr>').join('') : '<tr><td colspan="' + o.header.length + '" class="c">Tidak ada data.</td></tr>') +
      '</tbody></table>' + (o.catatan || []).map((t, i) => '<div class="' + (i === 0 ? 'cat' : 'kaki') + '">' + (i === 0 ? '<b>' + xml(t) + '</b>' : xml(t)) + '</div>').join('') +
      '</body></html>';
    const lama = document.getElementById('rl-cetak');
    if (lama) lama.remove();
    const f = document.createElement('iframe');
    f.id = 'rl-cetak';
    f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
    document.body.appendChild(f);
    const doc = f.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    const judulAsli = document.title;
    document.title = bersihNama(o.nama); // nama berkas bawaan saat "Simpan sebagai PDF"
    setTimeout(() => {
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); w.print(); } }
      setTimeout(() => { document.title = judulAsli; }, 1500);
    }, 60);
    return html;
  }

  function bersihNama(n) { return String(n || 'Ekspor').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120); }
  function unduh(blob, nama) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = nama; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  return { xlsx: xlsx, pdf: pdf, unduh: unduh, zip: zip, bersihNama: bersihNama };
})();
