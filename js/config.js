/* =============================================================
   RuangLatih — config.js
   ⚠️ SATU-SATUNYA file yang WAJIB Anda ubah sebelum upload.
   Tempel URL Web App dari Apps Script (berakhiran /exec).
   ============================================================= */
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzUMk7lBkVZDrvUzwr-K3pb4lObaEQjSyj7IKV70_l5nxJVK85eKi-UMh31Fq6H13yZiQ/exec';

const APP_CONFIG = {
  nama: 'RuangLatih',
  lembaga: 'Pusat Pendampingan UMKM Cakung',
  singkat: 'Sentra Cakung',
  // Nomor WhatsApp admin PPU untuk tombol "Hubungi Admin" (format 62…)
  waAdmin: '6285738340977'
};
// Firebase (migrasi database) — konfigurasi aplikasi web, aman dibagikan.
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCKdxo3Y7QEcGKnkELe6OCrbB3nVWasRao',
  authDomain: 'ruanglatih-ppu-cakung.firebaseapp.com',
  projectId: 'ruanglatih-ppu-cakung',
  storageBucket: 'ruanglatih-ppu-cakung.firebasestorage.app',
  messagingSenderId: '645604301604',
  appId: '1:645604301604:web:99edcbec545e49cbeff1b1'
};
   const MODE_DATA = 'firebase';