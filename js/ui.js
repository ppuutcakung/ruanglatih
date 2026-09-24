/* =============================================================
   RuangLatih — ui.js
   Pustaka kecil tampilan: ikon, format tanggal, toast, modal,
   form, berkas (base64/kompres), unduh, grafik SVG.
   ============================================================= */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const IKON = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  cap: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.5 13 17 22l-5-3-5 3 1.5-9"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  fileQ: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2.2-2.4 3.2M12 17h.01"/>',
  star: '<path d="m12 3 2.9 5.9 6.1.9-4.5 4.3 1.1 6.1L12 17.3l-5.6 2.9 1.1-6.1L3 9.8l6.1-.9z"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 16v-5M12 16V8M17 16v-8"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l3 3M14 9l2 2"/>',
  refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevD: '<path d="m6 9 6 6 6-6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  store: '<path d="M3 9 4.5 4h15L21 9"/><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13v8h14v-8M10 21v-5h4v5"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  checkSquare: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m8 12 3 3 5-6"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  package: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  scale: '<path d="M12 3v18M5 21h14M3 7h18M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z"/>',
  calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15v3M8 18h4"/>'
};

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const SEKTOR = ['Kuliner', 'Kerajinan', 'Pertanian', 'Manufaktur'];

const UI = {
  ic(n, cls) { return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (IKON[n] || IKON.info) + '</svg>'; },

  // ---------- Tanggal ----------
  tgl(s) {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) : null;
  },
  hariIni() { const d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); },
  tglIndo(s) { const d = UI.tgl(s); return d ? d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear() : (s || '-'); },
  tglPendek(s) { const d = UI.tgl(s); return d ? d.getDate() + ' ' + BLN[d.getMonth()] + ' ' + d.getFullYear() : (s || '-'); },
  tglHari(s) { const d = UI.tgl(s); return d ? HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BLN[d.getMonth()] + ' ' + d.getFullYear() : (s || '-'); },
  jam(s) { const m = String(s || '').match(/(\d{2}):(\d{2})/); return m ? m[1] + '.' + m[2] : ''; },
  waktu(s) { return s ? UI.tglPendek(s) + (UI.jam(s) ? ' · ' + UI.jam(s) : '') : '-'; },
  rentang(p) {
    const a = UI.tgl(p.tanggal_mulai), b = UI.tgl(p.tanggal_selesai);
    if (!a) return '-';
    if (+p.jumlah_hari !== 2 || !b || +a === +b) return UI.tglPendek(p.tanggal_mulai);
    if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return a.getDate() + '–' + UI.tglPendek(p.tanggal_selesai);
    return UI.tglPendek(p.tanggal_mulai) + ' – ' + UI.tglPendek(p.tanggal_selesai);
  },
  relatif(s) {
    const d = UI.tgl(s);
    if (!d) return '';
    const dt = (Date.now() - d.getTime()) / 1000;
    if (dt < 60) return 'baru saja';
    if (dt < 3600) return Math.floor(dt / 60) + ' mnt lalu';
    if (dt < 86400) return Math.floor(dt / 3600) + ' jam lalu';
    if (dt < 86400 * 7) return Math.floor(dt / 86400) + ' hari lalu';
    return UI.tglPendek(s);
  },
  bulanLabel(ym) { const m = String(ym || '').match(/^(\d{4})-(\d{2})/); return m ? BULAN[+m[2] - 1] + ' ' + m[1] : ym; },
  ukuran(b) { b = +b || 0; return b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; },
  angka(v, d) { return v === null || v === undefined || v === '' ? '–' : (typeof v === 'number' ? (Math.round(v * 10) / 10).toLocaleString('id-ID', { maximumFractionDigits: d === undefined ? 1 : d }) : v); },
  inisial(n) { return String(n || '?').replace(/^(bu|pak|ibu|bpk\.?)\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?'; },
  sapaan(n) { return String(n || '').split(/\s+/)[0] || ''; },

  // ---------- Chip ----------
  chipStatus(st) {
    if (st === 'berlangsung') return '<span class="chip ok dot">Berlangsung</span>';
    if (st === 'akan datang') return '<span class="chip warn dot">Akan Datang</span>';
    return '<span class="chip info dot">Selesai</span>';
  },
  chipLabel(lbl) {
    const c = lbl === 'Berlangsung' ? 'ok' : (lbl === 'Akan Datang' ? 'warn' : 'info');
    return '<span class="chip ' + c + ' sm">' + esc(lbl) + '</span>';
  },
  chipSektor(p) { return '<span class="chip sm">' + esc(p.cakupan === 'sektor' ? p.sektor : 'Umum') + '</span>'; },
  chipLulus(l) { return l ? '<span class="chip ok dot sm">Lulus</span>' : '<span class="chip warn dot sm">Belum lulus</span>'; },

  // ---------- Toast ----------
  toast(msg, jenis) {
    const w = $('#toast-wrap');
    if (!w) return;
    const t = document.createElement('div');
    t.className = 'toast ' + (jenis || 'ok');
    t.innerHTML = UI.ic(jenis === 'bad' ? 'alert' : (jenis === 'info' ? 'info' : 'checkCircle')) + '<span>' + esc(msg) + '</span>';
    w.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, jenis === 'bad' ? 5200 : 3200);
  },
  gagal(e) { UI.toast((e && e.message) || String(e), 'bad'); },

  // ---------- Muat & kosong ----------
  loading(el, n) {
    el.innerHTML = '<div class="col">' + Array.from({ length: n || 3 }, (_, i) => '<div class="sk" style="height:' + (i ? 84 : 120) + 'px"></div>').join('') + '</div>';
  },
  kosong(teks, ikon, aksi) {
    return '<div class="empty"><div class="ic-tile">' + UI.ic(ikon || 'info', 'lg') + '</div><div class="t-sm">' + esc(teks) + '</div>' + (aksi || '') + '</div>';
  },
  galat(el, e, ulang) {
    el.innerHTML = '<div class="card"><div class="empty"><div class="ic-tile" style="background:var(--bad-bg);color:var(--bad)">' + UI.ic('alert', 'lg') +
      '</div><div class="semi">Gagal memuat data</div><div class="t-sm">' + esc(e && e.message || e) + '</div>' +
      (ulang ? '<button class="btn secondary sm" data-ulang>' + UI.ic('refresh', 'sm') + 'Coba lagi</button>' : '') + '</div></div>';
    if (ulang) $('[data-ulang]', el).onclick = ulang;
  },

  /** Tombol sibuk: tampilkan putaran & kunci tombol selama proses berjalan. */
  async sibuk(btn, fn, teks) {
    if (!btn || btn.disabled) return;
    const asli = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span>' + (teks ? '<span>' + esc(teks) + '</span>' : '');
    try { return await fn(n => { btn.innerHTML = '<span class="spin"></span><span>' + esc(n) + '</span>'; }); }
    finally { if (btn.isConnected) { btn.disabled = false; btn.innerHTML = asli; } }
  },

  /** Delegasi klik: UI.klik(el, { hapus: (btn, ev) => ... }) untuk tombol [data-aksi="hapus"]. */
  klik(el, peta) {
    el.addEventListener('click', ev => {
      const b = ev.target.closest('[data-aksi]');
      if (!b || !el.contains(b)) return;
      const f = peta[b.dataset.aksi];
      if (f) { ev.preventDefault(); f(b, ev); }
    });
  },

  // ---------- Modal ----------
  modal(o) {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = '<div class="modal ' + (o.wide ? 'wide' : '') + '" role="dialog" aria-modal="true">' +
      '<div class="modal-h"><div class="h-sm">' + esc(o.title || '') + '</div><button class="btn icon sm ghost" data-tutup aria-label="Tutup">' + UI.ic('x') + '</button></div>' +
      '<div class="modal-b">' + (o.body || '') + '</div>' + (o.foot ? '<div class="modal-f">' + o.foot + '</div>' : '') + '</div>';
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    const tutup = () => { if (!ov.isConnected) return; ov.remove(); if (!$('.overlay')) document.body.style.overflow = ''; document.removeEventListener('keydown', esc_); o.onClose && o.onClose(); };
    const esc_ = e => { if (e.key === 'Escape' && !o.kunci) tutup(); };
    document.addEventListener('keydown', esc_);
    ov.addEventListener('click', e => { if ((e.target === ov && !o.kunci) || e.target.closest('[data-tutup]')) tutup(); });
    const m = { el: ov, body: $('.modal-b', ov), foot: $('.modal-f', ov), close: tutup };
    o.onOpen && o.onOpen(m);
    return m;
  },

  konfirmasi(pesan, o) {
    o = o || {};
    return new Promise(res => {
      let jawab = false;
      const m = UI.modal({
        title: o.judul || 'Konfirmasi',
        body: '<div class="t-sm" style="font-size:14px;line-height:1.6">' + pesan + '</div>',
        foot: '<button class="btn outline" data-tutup>Batal</button><button class="btn ' + (o.bahaya ? 'danger' : 'primary') + '" data-ya>' + esc(o.ok || 'Ya, lanjutkan') + '</button>',
        onClose: () => res(jawab)
      });
      $('[data-ya]', m.el).onclick = () => { jawab = true; m.close(); };
    });
  },

  /**
   * Form dalam modal.
   * fields: [{name,label,type,options:[[v,l]],value,full,hint,placeholder,attrs}]
   * onSubmit(values, modal) → return true/objek untuk menutup; lempar Error untuk menampilkan pesan.
   */
  form(o) {
    const inputHtml = f => {
      const v = f.value === undefined || f.value === null ? '' : f.value;
      const a = 'name="' + f.name + '" id="f_' + f.name + '" ' + (f.attrs || '') + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '');
      if (f.type === 'html') return f.html;
      if (f.type === 'select') return '<select class="select" ' + a + '>' + (f.options || []).map(x => { const val = Array.isArray(x) ? x[0] : x, lab = Array.isArray(x) ? x[1] : x; return '<option value="' + esc(val) + '"' + (String(val) === String(v) ? ' selected' : '') + '>' + esc(lab) + '</option>'; }).join('') + '</select>';
      if (f.type === 'textarea') return '<textarea class="textarea" ' + a + '>' + esc(v) + '</textarea>';
      if (f.type === 'checkbox') return '<label class="check"><input type="checkbox" ' + a + (v ? ' checked' : '') + '>' + esc(f.text || '') + '</label>';
      if (f.type === 'seg') return '<div class="seg" data-seg="' + f.name + '">' + f.options.map(x => '<button type="button" data-v="' + esc(x[0]) + '" class="' + (String(x[0]) === String(v) ? 'on' : '') + '">' + esc(x[1]) + '</button>').join('') + '</div><input type="hidden" ' + a + ' value="' + esc(v) + '">';
      return '<input class="input" type="' + (f.type || 'text') + '" ' + a + ' value="' + esc(v) + '">';
    };
    const body = (o.intro || '') + '<form class="form-grid" novalidate>' + o.fields.map(f =>
      '<div class="field ' + (f.full || f.type === 'textarea' ? 'full' : '') + '" data-f="' + f.name + '"' + (f.hidden ? ' hidden' : '') + '>' +
      (f.label ? '<label for="f_' + f.name + '">' + esc(f.label) + '</label>' : '') + inputHtml(f) + (f.hint ? '<div class="hint">' + f.hint + '</div>' : '') + '</div>').join('') +
      '<div class="full err" hidden data-err></div><button type="submit" hidden></button></form>';
    const m = UI.modal({
      title: o.title, wide: o.wide, body: body,
      foot: '<button class="btn outline" data-tutup>Batal</button>' + (o.tombol || []).map((t, i) => '<button class="btn ' + (t.kelas || 'secondary') + '" data-lain="' + i + '">' + (t.ikon ? UI.ic(t.ikon, 'sm') : '') + esc(t.teks) + '</button>').join('') +
        '<button class="btn primary" data-kirim>' + esc(o.submit || 'Simpan') + '</button>'
    });
    const form = $('form', m.el), err = $('[data-err]', m.el), btn = $('[data-kirim]', m.el);
    // Tombol tambahan (mis. "Simpan Draft"): fn(values, modal) → return false agar modal tetap terbuka
    $$('[data-lain]', m.el).forEach(tb => tb.onclick = async () => {
      err.hidden = true;
      try { await UI.sibuk(tb, async () => { const r = await o.tombol[+tb.dataset.lain].fn(nilai(), m); if (r !== false) m.close(); }); }
      catch (ex) { err.textContent = ex.message; err.hidden = false; }
    });
    $$('[data-seg]', form).forEach(sg => sg.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      $$('button', sg).forEach(x => x.classList.toggle('on', x === b));
      form.elements[sg.dataset.seg].value = b.dataset.v;
      form.elements[sg.dataset.seg].dispatchEvent(new Event('change', { bubbles: true }));
    }));
    const nilai = () => {
      const v = {};
      o.fields.forEach(f => { const el = form.elements[f.name]; if (!el) return; v[f.name] = f.type === 'checkbox' ? el.checked : String(el.value).trim(); });
      return v;
    };
    m.nilai = nilai;
    m.form = form;
    const kirim = async e => {
      e && e.preventDefault();
      err.hidden = true;
      try {
        await UI.sibuk(btn, async () => { const r = await o.onSubmit(nilai(), m); if (r !== false) m.close(); });
      } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    };
    form.addEventListener('submit', kirim);
    btn.onclick = kirim;
    o.onOpen && o.onOpen(m, form);
    setTimeout(() => { const f = form.querySelector('.input,.textarea'); if (f && window.innerWidth > 720) f.focus(); }, 60);
    return m;
  },

  // ---------- Berkas ----------
  pilihFile(accept, multiple) {
    return new Promise(res => {
      const i = document.createElement('input');
      i.type = 'file'; i.accept = accept || ''; i.multiple = !!multiple;
      i.style.display = 'none';
      i.onchange = () => { res(Array.from(i.files || [])); i.remove(); };
      document.body.appendChild(i);
      i.click();
    });
  },
  blobKeBase64(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1] || '');
      r.onerror = () => rej(new Error('Gagal membaca file.'));
      r.readAsDataURL(blob);
    });
  },
  async fileKeObj(file) { return { nama: file.name, tipe: file.type || '', ukuran: file.size, data: await UI.blobKeBase64(file) }; },

  /** Perkecil foto (maks 1600 px, JPEG) agar unggahan hemat kuota — hanya bila ukurannya > 1 MB. */
  async kompres(file, maks) {
    maks = maks || 1600;
    if (!/^image\/(jpeg|png)$/.test(file.type) || file.size < 1024 * 1024) return file;
    try {
      const url = URL.createObjectURL(file);
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const s = Math.min(1, maks / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.84));
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch (e) { return file; }
  },
  base64KeBlob(o) {
    const bin = atob(o.data), n = bin.length, u = new Uint8Array(n);
    for (let i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return new Blob([u], { type: o.tipe || 'application/octet-stream' });
  },
  unduhBase64(o) {
    const url = URL.createObjectURL(UI.base64KeBlob(o));
    const a = document.createElement('a');
    a.href = url; a.download = o.nama || 'berkas';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },
  /** Tampilkan berkas (gambar/PDF) di modal dengan tombol Buka & Unduh. */
  lihatBerkas(o, judul) {
    const blob = UI.base64KeBlob(o);
    const url = URL.createObjectURL(blob);
    const gambar = /^image\//.test(o.tipe);
    const pdf = /pdf/.test(o.tipe);
    const isi = gambar ? '<img src="' + url + '" alt="" style="width:100%;border-radius:12px;background:var(--blush-1)">'
      : (pdf && window.innerWidth > 720 ? '<iframe src="' + url + '" style="width:100%;height:65vh;border:0;border-radius:12px;background:var(--blush-1)"></iframe>'
        : '<div class="empty"><div class="ic-tile">' + UI.ic('file', 'lg') + '</div><div class="semi">' + esc(o.nama) + '</div><div class="t-sm">' + UI.ukuran(blob.size) + '</div></div>');
    UI.modal({
      title: judul || o.nama, wide: true, body: isi,
      foot: '<a class="btn outline" href="' + url + '" target="_blank" rel="noopener">' + UI.ic('eye', 'sm') + 'Buka</a><a class="btn primary" href="' + url + '" download="' + esc(o.nama) + '">' + UI.ic('download', 'sm') + 'Unduh</a>',
      onClose: () => setTimeout(() => URL.revokeObjectURL(url), 30000)
    });
  },

  // ---------- Grafik SVG ----------
  /** Grafik batang berkelompok. series: [{nama, warna, nilai:[..]}] */
  grafikBatang(o) {
    const W = o.w || 640, H = o.h || 240, L = 34, B = 42, T = 12, R = 8;
    const labels = o.labels || [];
    const maks = o.maks || Math.max(10, ...o.series.flatMap(s => s.nilai.map(v => +v || 0)));
    const lw = (W - L - R) / Math.max(1, labels.length);
    const bw = Math.min(26, (lw - 10) / o.series.length);
    const y = v => T + (H - T - B) * (1 - (Math.min(v, maks) / maks));
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const v = maks * i / 4, yy = y(v);
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="#F3DEE3" stroke-dasharray="' + (i ? '3 4' : '') + '"/><text x="' + (L - 6) + '" y="' + (yy + 4) + '" text-anchor="end">' + Math.round(v) + '</text>';
    }
    labels.forEach((lb, i) => {
      const x0 = L + i * lw + (lw - bw * o.series.length) / 2;
      o.series.forEach((s, j) => {
        const v = s.nilai[i];
        if (v === null || v === undefined) return;
        const yy = y(+v), h = H - B - yy;
        g += '<rect x="' + (x0 + j * bw + 1) + '" y="' + yy + '" width="' + (bw - 2) + '" height="' + Math.max(1, h) + '" rx="4" fill="' + s.warna + '"><title>' + esc(s.nama + ' · ' + lb + ': ' + UI.angka(+v)) + '</title></rect>';
      });
      const t = String(lb).length > 14 ? String(lb).slice(0, 13) + '…' : lb;
      g += '<text x="' + (L + i * lw + lw / 2) + '" y="' + (H - B + 16) + '" text-anchor="middle">' + esc(t) + '</text>';
    });
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img">' + g + '</svg>' +
      '<div class="legend mt8">' + o.series.map(s => '<span><i style="background:' + s.warna + '"></i>' + esc(s.nama) + '</span>').join('') + '</div>';
  },
  /** Grafik garis. series: [{nama, warna, nilai:[..]}] */
  grafikGaris(o) {
    const W = o.w || 640, H = o.h || 220, L = 34, B = 36, T = 12, R = 14;
    const labels = o.labels || [];
    const maks = o.maks || Math.max(10, ...o.series.flatMap(s => s.nilai.map(v => +v || 0)));
    const sx = i => L + (labels.length < 2 ? (W - L - R) / 2 : i * (W - L - R) / (labels.length - 1));
    const y = v => T + (H - T - B) * (1 - Math.min(v, maks) / maks);
    let g = '';
    for (let i = 0; i <= 4; i++) { const v = maks * i / 4, yy = y(v); g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="#F3DEE3" stroke-dasharray="' + (i ? '3 4' : '') + '"/><text x="' + (L - 6) + '" y="' + (yy + 4) + '" text-anchor="end">' + Math.round(v) + '</text>'; }
    labels.forEach((lb, i) => { g += '<text x="' + sx(i) + '" y="' + (H - B + 18) + '" text-anchor="middle">' + esc(lb) + '</text>'; });
    o.series.forEach(s => {
      const pts = s.nilai.map((v, i) => v === null || v === undefined ? null : [sx(i), y(+v), v]).filter(Boolean);
      if (pts.length > 1) g += '<polyline fill="none" stroke="' + s.warna + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="' + pts.map(p => p[0] + ',' + p[1]).join(' ') + '"/>';
      pts.forEach(p => { g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4" fill="#fff" stroke="' + s.warna + '" stroke-width="2.5"><title>' + esc(s.nama + ': ' + UI.angka(+p[2])) + '</title></circle>'; });
    });
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img">' + g + '</svg>' +
      '<div class="legend mt8">' + o.series.map(s => '<span><i style="background:' + s.warna + '"></i>' + esc(s.nama) + '</span>').join('') + '</div>';
  },

  // ---------- Paginasi sederhana ----------
  halaman(total, hal, per) {
    const n = Math.max(1, Math.ceil(total / per));
    if (n <= 1) return '';
    let b = '';
    for (let i = 1; i <= n; i++) if (n <= 7 || i === 1 || i === n || Math.abs(i - hal) <= 1) b += '<button class="btn xs ' + (i === hal ? 'primary' : 'outline') + '" data-aksi="hal" data-h="' + i + '">' + i + '</button>';
      else if (Math.abs(i - hal) === 2) b += '<span class="faint">…</span>';
    return '<div class="row between wrap mt12"><span class="t-sm muted">' + ((hal - 1) * per + 1) + '–' + Math.min(total, hal * per) + ' dari ' + total + '</span><div class="row g4 wrap">' +
      '<button class="btn xs outline" data-aksi="hal" data-h="' + Math.max(1, hal - 1) + '"' + (hal <= 1 ? ' disabled' : '') + '>Sebelumnya</button>' + b +
      '<button class="btn xs outline" data-aksi="hal" data-h="' + Math.min(n, hal + 1) + '"' + (hal >= n ? ' disabled' : '') + '>Berikutnya</button></div></div>';
  },

  salin(teks) {
    const ok = () => UI.toast('Disalin: ' + teks);
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(teks).then(ok, () => UI.toast(teks, 'info'));
    else UI.toast(teks, 'info');
  }
};
