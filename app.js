/**
 * ============================================================================
 * CetakID Kemenag – Sistem Layanan Mandiri & Pengelolaan ID Card Pegawai
 * Instansi: Kanwil Kementerian Agama Provinsi Kalimantan Selatan
 * Frontend Logic (app.js) - Sesuai Spesifikasi PRD Lengkap
 * ============================================================================
 */

// Kunci Penyimpanan Lokal (Cache & Session)
const STORAGE_KEY = 'kemenag_idcard_records_v9';
const UNITS_STORAGE_KEY = 'kemenag_idcard_units_v2';
const CONFIG_STORAGE_KEY = 'kemenag_idcard_config_v3';
const ADMIN_SESSION_KEY = 'kemenag_admin_session_v2';
const ADMIN_ACCOUNTS_CACHE_KEY = 'kemenag_admin_accounts_cache_v1';

// Endpoint Web App Google Apps Script (Integrasi Serverless)
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyPNEKuUv3hIn6LJKjCX_F7EzCpWPRMcIMt85qkA2r4aenQ8ApKi7RbFs9nOHFCtKa3ug/exec';
const GOOGLE_SCRIPT_URL = WEB_APP_URL;

// Konstanta Validasi sesuai PRD Bagian 3.1
const NIP_REGEX = /^[0-9]{18}$/;
const PHONE_REGEX = /^[0-9]{9,16}$/;
const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024; // Maksimal 2 MB (2.097.152 bytes)
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];

// Pemisahan Konstanta Visual:
// 1. DEFAULT_CARD_SAMPLE_PHOTO: Foto sampel pegawai setengah badan PNG transparan untuk Live Preview & Kartu ID
// 2. DEFAULT_TABLE_AVATAR: Avatar/siluet kosong default netral pada tabel antrean untuk pegawai dengan opsi "Foto di Kantor"
const DEFAULT_CARD_SAMPLE_PHOTO = 'assets/sample_pegawai_setengah_badan.png';
const DEFAULT_TABLE_AVATAR = 'assets/default-avatar.png';
const DEFAULT_AVATAR_PATH = DEFAULT_CARD_SAMPLE_PHOTO;

// State Aplikasi
let isSyncingWithBackend = false;
let backendSyncState = 'idle';
let idCardRecords = [];
let currentFilter = 'all';
let currentAdminFilter = 'all';
let currentAdminSubTab = 'requests';
let currentPrintingRecord = null;
let currentPrintModeOverride = null;

// State Foto Formulir Pegawai
let rawUploadedPhotoData = DEFAULT_CARD_SAMPLE_PHOTO;
let processedPhotoData = DEFAULT_CARD_SAMPLE_PHOTO;
let userHasUploadedPhoto = false;
let currentFormPhotoRatio = 'cutout';
let photoScale = 100;
let photoOffset = 0;
let lastSubmittedId = null;

// Daftar Unit Kerja Default Kanwil Kemenag Kalsel
const DEFAULT_KEMENAG_UNITS = [
  "Sub Bagian Perencanaan, Data & Informasi",
  "Sub Bagian Keuangan dan Barang Milik Negara",
  "Sub Bagian Kepegawaian & Hukum",
  "Sub Bagian Organisasi, Tata Laksana & KUB",
  "Sub Bagian Umum & Humas",
  "Bidang Pendidikan Madrasah",
  "Bidang Pendidikan Agama dan Keagamaan Islam",
  "Bidang Penyelenggaraan Haji dan Umrah",
  "Bidang Urusan Agama Islam",
  "Bidang Penerangan Agama Islam, Zakat & Wakaf",
  "Pembimas Kristen",
  "Pembimas Katolik",
  "Pembimas Hindu",
  "Pembimas Buddha",
  "Kanwil Kemenag Prov. Kalimantan Selatan"
];

let kemenagUnits = [];

// Konfigurasi Default Pimpinan & Template (Sesuai Tab 2: `Pengaturan` di PRD)
const DEFAULT_CONFIG = {
  nama_pimpinan: 'Dr. H. MUHAMMAD TAMBRIN, M.M.Pd',
  nip_pimpinan: '196705121994031002',
  jabatan_pimpinan: 'KEPALA',
  ttd_pimpinan_url: '',
  masa_berlaku: 'Selama Menjadi Pegawai',
  template_aktif: 'template_1',
  opsi_cetak: '2_sisi',
  rasio_foto: 'cutout',
  bg_depan_url: '',
  bg_belakang_url: '',
  aturan_kartu: '',
  alamat_kantor_1: 'Jl. D.I. Panjaitan',
  alamat_kantor_2: 'No. 19 Banjarmasin'
};

let appConfig = { ...DEFAULT_CONFIG };

// Daftar Akun Petugas Admin (Tanpa menyimpan plaintext password di kode sumber)
let adminAccountsList = [
  {
    id_admin: 'ADM-01',
    username: 'admin',
    nama_petugas: 'Administrator Utama',
    role: 'Superadmin',
    status_aktif: 'Aktif',
    // SHA-256 digest untuk verifikasi cadangan saat mode offline lokal
    pwd_FrontDigest: '427af9d96536a81deb1f4c57ecec912ed77842d0f087f2ddef8f0baa41d487c6'
  }
];

// Data Sampel Awal Antrean (Sesuai Tab 1: `Sheet1` di PRD)
const DEFAULT_DEMO_RECORDS = [
  {
    tiket: 'KMN-2026-7846',
    id: 'KMN-2026-7846',
    tanggal: '2026-10-15',
    date: '2026-10-15',
    nama: 'Rahmat Hidayat, S.Kom, M.M.',
    name: 'Rahmat Hidayat, S.Kom, M.M.',
    nip: '198804122014021003',
    no_hp: '081251123456',
    whatsapp: '081251123456',
    unitKerja: 'Sub Bagian Perencanaan, Data & Informasi',
    bidang: 'Sub Bagian Perencanaan, Data & Informasi',
    jabatan: 'Pranata Komputer Ahli Muda',
    foto: 'assets/sample_pegawai_setengah_badan.png',
    photo: 'assets/sample_pegawai_setengah_badan.png',
    photoReady: 'ready',
    status: 'Selesai',
    createdAt: '2026-10-15'
  },
  {
    tiket: 'KMN-2026-4921',
    id: 'KMN-2026-4921',
    tanggal: '2026-10-17',
    date: '2026-10-17',
    nama: 'Siti Nur Azizah, S.Pd.I',
    name: 'Siti Nur Azizah, S.Pd.I',
    nip: '198505122010012015',
    no_hp: '081349876543',
    whatsapp: '081349876543',
    unitKerja: 'Bidang Pendidikan Madrasah',
    bidang: 'Bidang Pendidikan Madrasah',
    jabatan: 'Analis Pengembang Peserta Didik',
    foto: 'assets/sample_pegawai_random_halfbody.png',
    photo: 'assets/sample_pegawai_random_halfbody.png',
    photoReady: 'ready',
    status: 'Sedang Dicetak',
    createdAt: '2026-10-17'
  },
  {
    tiket: 'KMN-2026-3108',
    id: 'KMN-2026-3108',
    tanggal: '2026-10-19',
    date: '2026-10-19',
    nama: 'Ahmad Fauzan, M.Pd.',
    name: 'Ahmad Fauzan, M.Pd.',
    nip: '199203152019031004',
    no_hp: '085248112233',
    whatsapp: '085248112233',
    unitKerja: 'Bidang Urusan Agama Islam',
    bidang: 'Bidang Urusan Agama Islam',
    jabatan: 'Analis Kebijakan Ahli Pertama',
    foto: DEFAULT_TABLE_AVATAR,
    photo: DEFAULT_TABLE_AVATAR,
    photoReady: 'not_ready',
    status: 'Menunggu Verifikasi',
    createdAt: '2026-10-19'
  }
];

// ============================================================================
// INISIALISASI APLIKASI SAAT HALAMAN DIMUAT
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  loadDataFromStorage();
  loadUnits();
  loadConfigFromStorage();
  loadAdminAccountsCache();
  setupDragAndDrop();
  setDefaultDate();
  populateUnitDropdowns();
  applyConfigToUI();
  updateLivePreview();
  renderDashboardTable();
  updateStats();
  updateAdminUI();

  const hash = window.location.hash.replace('#', '');
  if (['tata-cara', 'formulir', 'dashboard', 'admin'].includes(hash)) {
    switchTab(hash);
  } else {
    switchTab('tata-cara');
  }

  // Sinkronisasi otomatis dengan Google Apps Script (doGet)
  syncWithBackend(true);
});

// ============================================================================
// KOMUNIKASI API GOOGLE APPS SCRIPT (BAGIAN 5 PRD)
// Seluruh permintaan POST wajib menggunakan:
// headers: { "Content-Type": "text/plain;charset=utf-8" }
// ============================================================================

async function postToAppsScript(payloadObj) {
  const response = await fetch(WEB_APP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(payloadObj)
  });
  return await response.json();
}

function updateSyncStatusUI(status, label) {
  backendSyncState = status;

  const pubIndicator = document.getElementById('gas-sync-indicator');
  const pubLabel = document.getElementById('gas-sync-label');
  if (pubIndicator && pubLabel) {
    pubLabel.textContent = label || (status === 'connected' ? 'Terhubung' : 'Lokal');
    const dot = pubIndicator.querySelector('span');
    if (dot) {
      if (status === 'connected') {
        dot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
      } else if (status === 'syncing') {
        dot.className = 'w-2 h-2 rounded-full bg-amber-500 animate-ping';
      } else {
        dot.className = 'w-2 h-2 rounded-full bg-slate-400';
      }
    }
  }

  const adminIndicator = document.getElementById('gas-admin-sync-indicator');
  const adminLabel = document.getElementById('gas-admin-sync-label');
  if (adminIndicator && adminLabel) {
    adminLabel.textContent = label || (status === 'connected' ? 'Sheets Aktif' : 'Mode Lokal');
    const adminDot = adminIndicator.querySelector('span');
    if (adminDot) {
      adminDot.className = status === 'connected'
        ? 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse'
        : status === 'syncing'
          ? 'w-2 h-2 rounded-full bg-amber-400 animate-ping'
          : 'w-2 h-2 rounded-full bg-slate-400';
    }
  }
}

/**
 * 5.1 Endpoint doGet(e)
 * Mengambil seluruh daftar antrean dari `Sheet1` serta data konfigurasi publik dari tab `Pengaturan`
 */
async function syncWithBackend(silent = false) {
  if (isSyncingWithBackend) return;
  isSyncingWithBackend = true;

  updateSyncStatusUI('syncing', 'Sinkron...');
  const syncBtnText = document.getElementById('sync-text-dashboard');
  const syncIcon = document.getElementById('sync-icon-dashboard');
  if (syncIcon) syncIcon.classList.add('fa-spin');
  if (syncBtnText) syncBtnText.textContent = 'Menyinkronkan...';

  try {
    const response = await fetch(WEB_APP_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    const result = await response.json();
    if (result && result.status === 'success') {
      // 1. Sinkronisasi Data Antrean (`Sheet1`)
      if (Array.isArray(result.data) && result.data.length > 0) {
        const localMap = new Map();
        idCardRecords.forEach(r => localMap.set(r.tiket || r.id, normalizeRecord(r)));

        result.data.forEach(rem => {
          const normRem = normalizeRecord(rem);
          if (localMap.has(normRem.tiket)) {
            const loc = localMap.get(normRem.tiket);
            loc.status = normRem.status || loc.status;
            loc.nama = normRem.nama || loc.nama;
            loc.name = loc.nama;
            loc.nip = normRem.nip || loc.nip;
            loc.no_hp = normRem.no_hp || loc.no_hp || '';
            loc.whatsapp = loc.no_hp;
            loc.unitKerja = normRem.unitKerja || loc.unitKerja;
            loc.bidang = loc.unitKerja;
            loc.jabatan = normRem.jabatan || loc.jabatan;
            loc.tanggal = normRem.tanggal || loc.tanggal;
            loc.date = loc.tanggal;
            if (normRem.foto && normRem.foto !== DEFAULT_TABLE_AVATAR) {
              loc.foto = normRem.foto;
              loc.photo = normRem.foto;
              loc.photoReady = 'ready';
            }
          } else {
            idCardRecords.push(normRem);
            localMap.set(normRem.tiket, normRem);
          }
        });

        saveDataToStorage();
        renderDashboardTable();
        renderAdminTable();
        updateStats();
      }

      // 2. Sinkronisasi Konfigurasi Pimpinan & Template (`Pengaturan`)
      if (result.config && typeof result.config === 'object') {
        appConfig = Object.assign({}, DEFAULT_CONFIG, appConfig, result.config);
        if (result.config.unit_kerja_list) {
          try {
            const parsedUnits = JSON.parse(result.config.unit_kerja_list);
            if (Array.isArray(parsedUnits) && parsedUnits.length > 0) {
              kemenagUnits = parsedUnits;
              saveUnits();
            }
          } catch (e) {}
        }
        saveConfigToStorage();
        applyConfigToUI();
        updateLivePreview();
      }

      updateSyncStatusUI('connected', 'Terhubung');
      if (!silent) {
        showToast('Data antrean & konfigurasi berhasil disinkronkan dengan Google Sheets!');
      }
    } else {
      updateSyncStatusUI('offline', 'Lokal');
    }
  } catch (err) {
    console.warn('Sinkronisasi cloud menggunakan fallback penyimpanan lokal:', err);
    updateSyncStatusUI('offline', 'Lokal');
    if (!silent) {
      showToast('Menggunakan penyimpanan lokal peramban (pastikan Web App Google Apps Script telah di-deploy).');
    }
  } finally {
    isSyncingWithBackend = false;
    if (syncIcon) syncIcon.classList.remove('fa-spin');
    if (syncBtnText) syncBtnText.textContent = 'Muat Ulang Data';
  }
}

/**
 * 5.2.1 Action: "create"
 * Menyertakan nilai no_hp / whatsapp dalam payload JSON action: "create"
 */
async function sendRecordToBackend(record) {
  try {
    let uploadPhoto = record.foto || record.photo || DEFAULT_TABLE_AVATAR;
    if (uploadPhoto && uploadPhoto.startsWith('data:image')) {
      uploadPhoto = await optimizePhotoForUpload(uploadPhoto, 600);
    }

    const contactPhone = String(record.no_hp || record.whatsapp || '').trim();

    const payload = {
      action: 'create',
      tiket: record.tiket,
      tanggal: record.tanggal,
      nama: record.nama,
      nip: record.nip,
      no_hp: contactPhone,
      whatsapp: contactPhone,
      unitKerja: record.unitKerja,
      jabatan: record.jabatan,
      foto: uploadPhoto,
      status: record.status || 'Menunggu Verifikasi',
      // Alias kompatibilitas
      id: record.tiket,
      name: record.nama,
      bidang: record.unitKerja,
      date: record.tanggal,
      photo: uploadPhoto
    };

    await postToAppsScript(payload);
  } catch (err) {
    console.warn('Pengajuan disimpan di lokal, gagal kirim ke backend:', err);
  }
}

/**
 * 5.2.2 Action: "update"
 * Menyertakan nilai no_hp / whatsapp dalam payload JSON action: "update"
 */
async function updateRecordOnBackend(record) {
  try {
    let uploadPhoto = record.foto || record.photo || DEFAULT_TABLE_AVATAR;
    if (uploadPhoto && uploadPhoto.startsWith('data:image')) {
      uploadPhoto = await optimizePhotoForUpload(uploadPhoto, 600);
    }

    const contactPhone = String(record.no_hp || record.whatsapp || '').trim();

    const payload = {
      action: 'update',
      tiket: record.tiket,
      tanggal: record.tanggal,
      nama: record.nama,
      nip: record.nip,
      no_hp: contactPhone,
      whatsapp: contactPhone,
      unitKerja: record.unitKerja,
      jabatan: record.jabatan,
      foto: uploadPhoto,
      status: record.status,
      // Alias kompatibilitas
      id: record.tiket,
      name: record.nama,
      bidang: record.unitKerja,
      date: record.tanggal,
      photo: uploadPhoto
    };

    await postToAppsScript(payload);
  } catch (err) {
    console.warn('Pembaruan disimpan di lokal, gagal kirim ke backend:', err);
  }
}

/**
 * 5.2.3 Action: "delete"
 */
async function deleteRecordOnBackend(tiket) {
  try {
    await postToAppsScript({
      action: 'delete',
      tiket: tiket,
      id: tiket
    });
  } catch (err) {
    console.warn('Penghapusan dilakukan di lokal, gagal hapus di backend:', err);
  }
}

function optimizePhotoForUpload(dataUrl, maxDim = 600) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/png', 0.88));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ============================================================================
// PENYIMPANAN LOKAL & NORMALISASI DATA
// ============================================================================

function normalizeRecord(raw) {
  const tiket = String(raw.tiket || raw.id || generateTicketCode()).trim();
  const tanggal = String(raw.tanggal || raw.date || getTodayDateString()).split(' ')[0].trim();
  const nama = String(raw.nama || raw.name || '').trim();
  const nip = String(raw.nip || '').replace(/^'/, '').trim();
  const no_hp = String(raw.no_hp || raw.whatsapp || raw.noHp || '').replace(/^'/, '').trim();
  const unitKerja = String(raw.unitKerja || raw.bidang || '').trim();
  const jabatan = String(raw.jabatan || '').trim();
  const rawFoto = raw.foto || raw.photo || '';

  const isOfficeOption = (
    raw.photoReady === 'not_ready' ||
    !rawFoto ||
    rawFoto === 'null' ||
    rawFoto === DEFAULT_TABLE_AVATAR
  );

  const foto = isOfficeOption ? DEFAULT_TABLE_AVATAR : String(rawFoto);
  const status = String(raw.status || 'Menunggu Verifikasi').trim();

  return {
    tiket,
    id: tiket,
    tanggal,
    date: tanggal,
    nama,
    name: nama,
    nip,
    no_hp,
    whatsapp: no_hp,
    unitKerja,
    bidang: unitKerja,
    jabatan,
    foto,
    photo: foto,
    photoReady: isOfficeOption ? 'not_ready' : 'ready',
    status,
    createdAt: raw.createdAt || tanggal
  };
}

/**
 * Helper: Mendapatkan URL foto untuk ditampilkan pada Tabel Dashboard Status
 * - Pegawai dengan Opsi "Foto di Kantor": tampilkan avatar/siluet kosong default netral (`assets/default-avatar.png`)
 * - Pegawai dengan Opsi "Unggah Foto Mandiri": tampilkan thumbnail foto asli pegawai yang diunggah dan diproses
 */
function getTableAvatarSrc(record) {
  if (!record || record.photoReady === 'not_ready' || !record.foto || record.foto === 'null' || record.foto === DEFAULT_TABLE_AVATAR) {
    return DEFAULT_TABLE_AVATAR;
  }
  return record.foto;
}

/**
 * Helper: Mendapatkan URL foto untuk ditampilkan pada Kartu ID (Live Preview & Cetak)
 * - Jika belum ada foto unggahan mandiri (atau memilih "Opsi Foto di Kantor"), tampilkan sampel foto setengah badan PNG transparan (`assets/sample_pegawai_setengah_badan.png`)
 */
function getCardPhotoSrc(record) {
  if (!record || record.photoReady === 'not_ready' || !record.foto || record.foto === 'null' || record.foto === DEFAULT_TABLE_AVATAR) {
    return DEFAULT_CARD_SAMPLE_PHOTO;
  }
  return record.foto;
}

function loadDataFromStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      idCardRecords = Array.isArray(parsed) ? parsed.map(normalizeRecord) : [...DEFAULT_DEMO_RECORDS];
    } catch (e) {
      idCardRecords = [...DEFAULT_DEMO_RECORDS];
    }
  } else {
    idCardRecords = [...DEFAULT_DEMO_RECORDS];
    saveDataToStorage();
  }
}

function saveDataToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(idCardRecords));
  updateStats();
}

function generateTicketCode() {
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `KMN-2026-${randomDigits}`;
}

function getTodayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ============================================================================
// NAVIGASI TAB & PEMBAGIAN MODE AKSES (BAGIAN 2 PRD)
// ============================================================================

function switchTab(tabId) {
  if (tabId === 'admin' && !isAdminLoggedIn()) {
    openAdminLoginModal();
    return;
  }

  const headerPublic = document.getElementById('header-public');
  const headerAdmin = document.getElementById('header-admin');

  if (tabId === 'admin') {
    if (headerPublic) headerPublic.classList.add('hidden');
    if (headerAdmin) headerAdmin.classList.remove('hidden');
  } else {
    if (headerAdmin) headerAdmin.classList.add('hidden');
    if (headerPublic) headerPublic.classList.remove('hidden');
  }

  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  const activePane = document.getElementById(`tab-${tabId}`);
  if (activePane) activePane.classList.add('active');

  ['tata-cara', 'formulir', 'dashboard'].forEach(t => {
    const btn = document.getElementById(`nav-btn-${t}`);
    if (btn) {
      btn.className = (t === tabId)
        ? 'nav-item flex items-center space-x-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all duration-200 text-white bg-emerald-700 shadow-xs'
        : 'nav-item flex items-center space-x-1.5 px-4 py-2 rounded-xl font-semibold text-xs transition-all duration-200 text-slate-600 hover:text-emerald-800 hover:bg-white/60';
    }
  });

  window.location.hash = tabId;

  if (tabId === 'dashboard') {
    renderDashboardTable();
  } else if (tabId === 'formulir') {
    updateLivePreview();
  } else if (tabId === 'admin') {
    switchAdminSubTab(currentAdminSubTab || 'requests');
    renderAdminTable();
    renderAdminUnitsList();
    applyConfigToUI();
    renderAdminAccountsTable();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  if (menu) menu.classList.toggle('hidden');
}

function toggleAdminMobileMenu() {
  const menu = document.getElementById('admin-mobile-menu');
  if (menu) menu.classList.toggle('hidden');
}

// ============================================================================
// 3.1 MODUL FORMULIR PENGAJUAN, VALIDASI INPUT, PASFOTO & LIVE PREVIEW
// ============================================================================

function setDefaultDate() {
  const dateInput = document.getElementById('form-date');
  if (dateInput) {
    dateInput.value = getTodayDateString();
  }
}

function togglePhotoUploadSection(isUploadMode) {
  const photoSection = document.getElementById('section-photo-upload');
  const labelReady = document.getElementById('label-photo-ready');
  const labelOffice = document.getElementById('label-photo-office');
  const statusBadge = document.getElementById('photo-upload-status-badge');

  if (photoSection) {
    if (isUploadMode) {
      // Ketika memilih "Unggah Foto Mandiri": tampilkan kembali seluruh area unggah foto & panel pengaturannya
      photoSection.style.display = 'block';
      photoSection.classList.remove('hidden');
    } else {
      // Ketika memilih "Opsi Foto di Kantor": sembunyikan (CSS display: none;) seluruh area kontainer langkah ke-2
      photoSection.style.display = 'none';
      photoSection.classList.add('hidden');
      hidePhotoValidationError();
    }
  }

  if (labelReady && labelOffice) {
    if (isUploadMode) {
      labelReady.className = 'flex items-start space-x-3 p-3.5 rounded-2xl border-2 border-emerald-600 bg-emerald-50/40 cursor-pointer transition';
      labelOffice.className = 'flex items-start space-x-3 p-3.5 rounded-2xl border-2 border-slate-200 hover:border-emerald-300 bg-white cursor-pointer transition';
    } else {
      labelReady.className = 'flex items-start space-x-3 p-3.5 rounded-2xl border-2 border-slate-200 hover:border-emerald-300 bg-white cursor-pointer transition';
      labelOffice.className = 'flex items-start space-x-3 p-3.5 rounded-2xl border-2 border-emerald-600 bg-emerald-50/40 cursor-pointer transition';
    }
  }

  if (statusBadge && isUploadMode) {
    if (userHasUploadedPhoto) {
      statusBadge.textContent = 'Foto Siap';
      statusBadge.className = 'text-[10px] px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold';
    } else {
      statusBadge.textContent = 'Foto Sampel Default';
      statusBadge.className = 'text-[10px] px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold';
    }
  }
}

function handlePhotoRatioChange(ratio) {
  currentFormPhotoRatio = ratio;
  updateLivePreview();
}

function applyPhotoRatioClass(layerEl) {
  if (!layerEl) return;
  layerEl.classList.remove('ratio-3-4', 'ratio-1-1', 'ratio-cutout');
}

function applyCardTemplateVisuals(frontCardEl, backCardEl) {
  const tpl = appConfig.template_aktif || 'template_1';

  if (frontCardEl) {
    frontCardEl.classList.remove('theme-template_1', 'theme-template_2', 'theme-template_3');
    frontCardEl.classList.add(`theme-${tpl}`);
    if (appConfig.bg_depan_url) {
      frontCardEl.style.backgroundImage = `url('${appConfig.bg_depan_url}')`;
    } else {
      frontCardEl.style.backgroundImage = '';
    }
  }

  if (backCardEl) {
    backCardEl.classList.remove('theme-template_1', 'theme-template_2', 'theme-template_3');
    backCardEl.classList.add(`theme-${tpl}`);
    if (appConfig.bg_belakang_url) {
      backCardEl.style.backgroundImage = `url('${appConfig.bg_belakang_url}')`;
    } else {
      backCardEl.style.backgroundImage = '';
    }
  }
}

/**
 * Menggabungkan Biodata Pegawai + Konfigurasi Pimpinan & Template pada Live Preview
 */
function updateLivePreview() {
  const rawName = (document.getElementById('form-name')?.value || '').trim();
  const rawNip = (document.getElementById('form-nip')?.value || '').trim();
  const rawJabatan = (document.getElementById('form-jabatan')?.value || '').trim();
  const rawBidang = document.getElementById('form-bidang')?.value || kemenagUnits[0] || 'Sub Bagian Perencanaan, Data & Informasi';
  const rawDate = document.getElementById('form-date')?.value || getTodayDateString();
  const photoOption = document.querySelector('input[name="photo_ready"]:checked')?.value || 'ready';

  const displayName = rawName || 'NAMA LENGKAP PEGAWAI';
  const displayNip = rawNip || '198804122014021003';
  const displayJabatan = rawJabatan || 'Jabatan Pegawai';

  const frontCard = document.getElementById('card-preview-front');
  const backCard = document.getElementById('card-preview-back');
  applyCardTemplateVisuals(frontCard, backCard);

  // Label Template Aktif
  const tplLabel = document.getElementById('live-preview-template-label');
  if (tplLabel) {
    const names = {
      template_1: 'Template Standar Kemenag',
      template_2: 'Template Modern Hijau',
      template_3: 'Template Kustom'
    };
    tplLabel.textContent = names[appConfig.template_aktif] || 'Template Standar Kemenag';
  }

  // Sisi Depan
  const prevName = document.getElementById('preview-name');
  const prevNip = document.getElementById('preview-nip');
  if (prevName) prevName.textContent = displayName.toUpperCase();
  if (prevNip) prevNip.textContent = `NIP. ${displayNip}`;

  // Penanganan Pasfoto pada Live Preview (Menyatu Natural Tanpa Kotak Putih Kaku)
  const photoLayer = document.getElementById('preview-photo-layer');
  const previewPhoto = document.getElementById('preview-photo');
  applyPhotoRatioClass(photoLayer);

  if (previewPhoto) {
    if (photoOption === 'not_ready') {
      // Opsi Foto di Kantor -> Tampilkan sampel foto pegawai setengah badan PNG transparan yang menyatu rapi dengan latar kartu
      previewPhoto.src = DEFAULT_CARD_SAMPLE_PHOTO;
      previewPhoto.style.transform = 'none';
    } else if (!userHasUploadedPhoto || !processedPhotoData) {
      // Unggah Foto Mandiri (belum memilih berkas) -> Tampilkan sampel setengah badan PNG transparan & dukung slider
      previewPhoto.src = DEFAULT_CARD_SAMPLE_PHOTO;
      previewPhoto.style.transform = `scale(${photoScale / 100}) translateY(${photoOffset}px)`;
    } else {
      // Unggah Foto Mandiri -> Tampilkan foto asli hasil pemotongan latar belakang transparan secara proporsional
      previewPhoto.src = processedPhotoData;
      previewPhoto.style.transform = `scale(${photoScale / 100}) translateY(${photoOffset}px)`;
    }
    previewPhoto.style.objectFit = 'contain';
    previewPhoto.style.objectPosition = 'bottom left';
  }

  // Sisi Belakang (Biodata + Konfigurasi Pimpinan Dinamis, tanpa teks aturan & masa berlaku)
  const bName = document.getElementById('back-preview-name');
  const bNip = document.getElementById('back-preview-nip');
  const bJabatan = document.getElementById('back-preview-jabatan');
  const bBidang = document.getElementById('back-preview-bidang');
  const bDate = document.getElementById('back-preview-date');
  const bAlamat1 = document.getElementById('back-preview-alamat1');
  const bAlamat2 = document.getElementById('back-preview-alamat2');
  const bKepalaTitle = document.getElementById('back-preview-kepala-title');
  const bKepalaName = document.getElementById('back-preview-kepala-name');
  const bKepalaNip = document.getElementById('back-preview-kepala-nip');
  const bTtdImg = document.getElementById('back-preview-ttd-img');

  if (bName) bName.textContent = displayName;
  if (bNip) bNip.textContent = displayNip;
  if (bJabatan) bJabatan.textContent = displayJabatan;
  if (bBidang) bBidang.textContent = rawBidang;
  if (bDate) bDate.textContent = `Banjarmasin, ${formatIndonesianDate(rawDate)}`;
  if (bAlamat1) bAlamat1.textContent = appConfig.alamat_kantor_1;
  if (bAlamat2) bAlamat2.textContent = appConfig.alamat_kantor_2;
  if (bKepalaTitle) bKepalaTitle.textContent = appConfig.jabatan_pimpinan;
  if (bKepalaName) bKepalaName.textContent = appConfig.nama_pimpinan;
  if (bKepalaNip) bKepalaNip.textContent = `NIP. ${appConfig.nip_pimpinan}`;

  if (bTtdImg) {
    if (appConfig.ttd_pimpinan_url) {
      bTtdImg.src = appConfig.ttd_pimpinan_url;
      bTtdImg.classList.remove('hidden');
    } else {
      bTtdImg.classList.add('hidden');
    }
  }
}

function switchPreviewSide(side) {
  const front = document.getElementById('card-preview-front');
  const back = document.getElementById('card-preview-back');
  const btnFront = document.getElementById('btn-view-front');
  const btnBack = document.getElementById('btn-view-back');

  if (side === 'front') {
    front.classList.remove('hidden');
    back.classList.add('hidden');
    btnFront.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 text-white shadow transition';
    btnBack.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition';
  } else {
    front.classList.add('hidden');
    back.classList.remove('hidden');
    btnBack.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 text-white shadow transition';
    btnFront.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition';
  }
}

function formatIndonesianDate(dateStr) {
  if (!dateStr) return '19 Oktober 2026';
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${day} ${months[monthIdx] || ''} ${year}`;
}

// ============================================================================
// VALIDASI BERKAS FOTO (.JPG, .JPEG, .PNG MAKS 2 MB) & PEMBACAAN FILEREADER
// ============================================================================

function validatePhotoFileObject(file) {
  if (!file) {
    return { valid: false, message: 'Berkas foto tidak ditemukan.' };
  }

  const fileName = (file.name || '').toLowerCase();
  const hasValidExt = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));
  const hasValidMime = ALLOWED_MIME_TYPES.includes(file.type);

  if (!hasValidExt || !hasValidMime) {
    return {
      valid: false,
      message: 'Format berkas ditolak! Hanya diizinkan format .jpg, .jpeg, atau .png.'
    };
  }

  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      message: `Ukuran berkas (${sizeMB} MB) melebihi batas maksimal 2 MB!`
    };
  }

  return { valid: true };
}

function showPhotoValidationError(msg) {
  const errBox = document.getElementById('photo-validation-error');
  const errText = document.getElementById('photo-validation-error-text');
  if (errBox && errText) {
    errText.textContent = msg;
    errBox.classList.remove('hidden');
  }
}

function hidePhotoValidationError() {
  const errBox = document.getElementById('photo-validation-error');
  if (errBox) errBox.classList.add('hidden');
}

function setupDragAndDrop() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('form-photo-input');
  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('border-emerald-600', 'bg-emerald-50/60');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-emerald-600', 'bg-emerald-50/60');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      processPhotoFile(dt.files[0]);
    }
  });
}

function handlePhotoUpload(event) {
  const file = event.target.files[0];
  if (file) {
    processPhotoFile(file);
  }
}

function processPhotoFile(file) {
  hidePhotoValidationError();
  const check = validatePhotoFileObject(file);

  if (!check.valid) {
    showPhotoValidationError(check.message);
    showToast(check.message);
    const fileInput = document.getElementById('form-photo-input');
    if (fileInput) fileInput.value = '';
    return;
  }

  // Baca berkas gambar menggunakan FileReader menjadi Base64 Data URL (PRD 3.1.2)
  const reader = new FileReader();
  reader.onload = (e) => {
    rawUploadedPhotoData = e.target.result;
    processedPhotoData = e.target.result;
    userHasUploadedPhoto = true;

    const statusBadge = document.getElementById('photo-upload-status-badge');
    if (statusBadge) {
      statusBadge.textContent = 'Foto Siap';
      statusBadge.className = 'text-[10px] px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold';
    }

    const dropFilename = document.getElementById('drop-zone-filename');
    if (dropFilename) {
      dropFilename.textContent = `Berkas terpilih: ${file.name} (${Math.round(file.size / 1024)} KB)`;
    }

    const bgRemovalToggle = document.getElementById('toggle-bg-removal');
    if (bgRemovalToggle && bgRemovalToggle.checked) {
      runSmartBackgroundRemoval();
    } else {
      updateLivePreview();
    }
  };
  reader.readAsDataURL(file);
}

function toggleBackgroundRemoval() {
  const isEnabled = document.getElementById('toggle-bg-removal')?.checked;
  const controls = document.getElementById('bg-remover-controls');
  if (controls) {
    if (isEnabled) controls.classList.remove('hidden');
    else controls.classList.add('hidden');
  }

  if (!userHasUploadedPhoto || !rawUploadedPhotoData) return;

  if (!isEnabled) {
    processedPhotoData = rawUploadedPhotoData;
    updateLivePreview();
  } else {
    runSmartBackgroundRemoval();
  }
}

function updateTolerance(val) {
  document.getElementById('tolerance-val').textContent = val;
  if (userHasUploadedPhoto) runSmartBackgroundRemoval();
}

function updatePhotoScale(val) {
  photoScale = val;
  document.getElementById('scale-val').textContent = `${val}%`;
  updateLivePreview();
}

function updatePhotoOffset(val) {
  photoOffset = val;
  document.getElementById('offset-val').textContent = `${val}px`;
  updateLivePreview();
}

function runSmartBackgroundRemoval() {
  const isEnabled = document.getElementById('toggle-bg-removal')?.checked;
  if (!isEnabled || !rawUploadedPhotoData) {
    processedPhotoData = rawUploadedPhotoData;
    updateLivePreview();
    return;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const canvas = document.getElementById('bg-processor-canvas');
    const ctx = canvas.getContext('2d');

    const maxDim = 750;
    let w = img.width;
    let h = img.height;
    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }

    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const mode = document.getElementById('bg-color-mode')?.value || 'auto';
    const tolerance = parseInt(document.getElementById('bg-tolerance')?.value || '35', 10);
    const customContainer = document.getElementById('custom-color-container');
    if (customContainer) {
      if (mode === 'custom') customContainer.classList.remove('hidden');
      else customContainer.classList.add('hidden');
    }

    // Jika gambar unggahan sudah berlatar transparan (PNG transparan) pada mode auto, pertahankan transparansinya
    const topLeftAlpha = data[3];
    const topRightAlpha = data[(w - 1) * 4 + 3];
    if (mode === 'auto' && topLeftAlpha < 50 && topRightAlpha < 50) {
      processedPhotoData = canvas.toDataURL('image/png');
      updateLivePreview();
      return;
    }

    let targetR = 255, targetG = 255, targetB = 255;
    if (mode === 'auto') {
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      const samplePoints = [
        [0, 0], [2, 2], [w - 1, 0], [w - 3, 2],
        [0, Math.floor(h * 0.15)], [w - 1, Math.floor(h * 0.15)],
        [Math.floor(w * 0.2), 0], [Math.floor(w * 0.8), 0]
      ];
      samplePoints.forEach(([sx, sy]) => {
        const x = Math.max(0, Math.min(w - 1, sx));
        const y = Math.max(0, Math.min(h - 1, sy));
        const idx = (y * w + x) * 4;
        if (data[idx + 3] > 128) {
          rSum += data[idx];
          gSum += data[idx + 1];
          bSum += data[idx + 2];
          count++;
        }
      });
      if (count > 0) {
        targetR = rSum / count;
        targetG = gSum / count;
        targetB = bSum / count;
      }
    } else if (mode === 'blue') {
      targetR = 30; targetG = 90; targetB = 180;
    } else if (mode === 'red') {
      targetR = 190; targetG = 30; targetB = 30;
    } else if (mode === 'white') {
      targetR = 248; targetG = 248; targetB = 248;
    } else if (mode === 'custom') {
      const hex = document.getElementById('bg-custom-color')?.value || '#ffffff';
      const hexLabel = document.getElementById('custom-color-hex');
      if (hexLabel) hexLabel.textContent = hex;
      const rgb = hexToRgb(hex);
      targetR = rgb.r; targetG = rgb.g; targetB = rgb.b;
    }

    // Flood-fill dari tepi atas, tepi kiri atas, dan tepi kanan atas
    // Jangan memulai flood-fill dari tepi bawah (y = h - 1) agar baju putih pegawai tidak ikut terhapus
    const visited = new Uint8Array(w * h);
    const queue = [];
    for (let x = 0; x < w; x++) {
      queue.push(x, 0);
    }
    const sideMaxY = Math.floor(h * 0.88);
    for (let y = 0; y < sideMaxY; y++) {
      queue.push(0, y);
      queue.push(w - 1, y);
    }

    const effectiveTolerance = (mode === 'white' || (mode === 'auto' && targetR > 225 && targetG > 225 && targetB > 225))
      ? Math.max(tolerance, 38)
      : tolerance;
    const featherDist = 14;

    let qHead = 0;
    while (qHead < queue.length) {
      const cx = queue[qHead++];
      const cy = queue[qHead++];
      const cIdx = cy * w + cx;
      if (visited[cIdx]) continue;
      visited[cIdx] = 1;

      const pIdx = cIdx * 4;
      const dr = data[pIdx] - targetR;
      const dg = data[pIdx + 1] - targetG;
      const db = data[pIdx + 2] - targetB;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);

      if (dist <= effectiveTolerance) {
        data[pIdx + 3] = 0;
        if (cx + 1 < w && !visited[cy * w + (cx + 1)]) queue.push(cx + 1, cy);
        if (cx - 1 >= 0 && !visited[cy * w + (cx - 1)]) queue.push(cx - 1, cy);
        if (cy + 1 < h && !visited[(cy + 1) * w + cx]) queue.push(cx, cy + 1);
        if (cy - 1 >= 0 && !visited[(cy - 1) * w + cx]) queue.push(cx, cy - 1);
      } else if (dist <= effectiveTolerance + featherDist) {
        const alphaRatio = (dist - effectiveTolerance) / featherDist;
        data[pIdx + 3] = Math.min(data[pIdx + 3], Math.round(255 * alphaRatio));
      }
    }

    ctx.putImageData(imgData, 0, 0);
    processedPhotoData = canvas.toDataURL('image/png');
    updateLivePreview();
  };
  img.src = rawUploadedPhotoData;
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 30, g: 90, b: 180 };
}

// ============================================================================
// VALIDASI INPUT FORMULIR & PENGIRIMAN PENGAJUAN (PRD 3.1.1 - 3.1.3)
// ============================================================================

function showFormValidationAlert(msg) {
  const box = document.getElementById('form-validation-alert');
  const text = document.getElementById('form-validation-alert-text');
  if (box && text) {
    text.textContent = msg;
    box.classList.remove('hidden');
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } else {
    alert(msg);
  }
}

function hideFormValidationAlert() {
  const box = document.getElementById('form-validation-alert');
  if (box) box.classList.add('hidden');
}

function validateNipInput(input) {
  const rawVal = input.value;
  const hasNonDigits = /[^0-9]/.test(rawVal);
  const digitsOnly = rawVal.replace(/\D/g, '');

  const badge = document.getElementById('nip-validation-badge');
  const feedback = document.getElementById('nip-validation-feedback');
  const iconStatus = document.getElementById('nip-icon-status');

  if (badge) {
    badge.textContent = `${digitsOnly.length}/18 Digit`;
    badge.className = NIP_REGEX.test(rawVal.trim())
      ? 'text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono'
      : 'text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-mono';
  }

  if (feedback && iconStatus) {
    if (hasNonDigits) {
      feedback.textContent = 'Peringatan: NIP hanya boleh berisi angka numerik (0-9) tanpa spasi atau huruf!';
      feedback.className = 'text-[11px] font-bold mt-1 text-rose-600';
      iconStatus.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-rose-600"></i>';
    } else if (NIP_REGEX.test(rawVal.trim())) {
      feedback.textContent = 'Format NIP valid: tepat 18 digit angka numerik.';
      feedback.className = 'text-[11px] font-semibold mt-1 text-emerald-600';
      iconStatus.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-600"></i>';
    } else if (rawVal.length > 0) {
      feedback.textContent = `Peringatan: NIP harus tepat 18 digit angka (saat ini ${rawVal.length} digit).`;
      feedback.className = 'text-[11px] font-semibold mt-1 text-amber-600';
      iconStatus.innerHTML = '<i class="fa-solid fa-circle-exclamation text-amber-500"></i>';
    } else {
      feedback.textContent = 'Wajib berupa angka numerik tepat 18 digit tanpa spasi atau karakter selain angka.';
      feedback.className = 'text-[11px] font-semibold mt-1 text-slate-500';
      iconStatus.innerHTML = '<i class="fa-solid fa-hashtag text-slate-400"></i>';
    }
  }

  updateLivePreview();
}

function validateNameInput(input) {
  const badge = document.getElementById('name-validation-badge');
  const val = input.value.trim();
  if (badge) {
    if (val.length >= 3) {
      badge.textContent = 'Nama Valid';
      badge.className = 'text-[10px] font-bold text-emerald-600';
    } else {
      badge.textContent = 'Wajib diisi';
      badge.className = 'text-[10px] font-bold text-slate-400';
    }
  }
  updateLivePreview();
}

function validatePhoneInput(input) {
  if (!input) return;
  const cleaned = (input.value || '').replace(/\D/g, '');
  if (input.value !== cleaned) {
    input.value = cleaned;
  }
  const badge = document.getElementById('phone-validation-badge');
  if (badge) {
    if (PHONE_REGEX.test(cleaned)) {
      badge.textContent = 'Nomor Valid';
      badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800';
    } else if (cleaned.length > 0) {
      badge.textContent = `${cleaned.length} Digit`;
      badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800';
    } else {
      badge.textContent = 'Wajib diisi';
      badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600';
    }
  }
}

function handleFormSubmit(event) {
  event.preventDefault();
  hideFormValidationAlert();

  // 1. Pembersihan Teks (Sanitization) dengan .trim() (PRD 3.1.1)
  const nama = (document.getElementById('form-name')?.value || '').trim();
  const nip = (document.getElementById('form-nip')?.value || '').trim();
  const no_hp = (document.getElementById('form-phone')?.value || '').replace(/\D/g, '').trim();
  const unitKerja = (document.getElementById('form-bidang')?.value || '').trim();
  const jabatan = (document.getElementById('form-jabatan')?.value || '').trim();
  const tanggal = (document.getElementById('form-date')?.value || '').trim() || getTodayDateString();
  const photoOption = document.querySelector('input[name="photo_ready"]:checked')?.value || '';

  // 2. Validasi Kelengkapan Kolom Wajib (termasuk Nomor HP / WhatsApp Pegawai)
  if (!nama || !nip || !no_hp || !unitKerja || !jabatan || !photoOption) {
    showFormValidationAlert('Seluruh kolom wajib (Nama Lengkap, NIP, Nomor HP / WhatsApp, Unit Kerja/Bidang, Jabatan, dan Opsi Foto) harus diisi sebelum formulir dikirim.');
    return;
  }

  // 3. Validasi Format NIP 18 Digit Numerik (/^[0-9]{18}$/)
  if (!NIP_REGEX.test(nip)) {
    showFormValidationAlert('Format NIP tidak valid! NIP wajib berupa angka numerik tepat 18 digit (tanpa spasi, huruf, atau tanda baca).');
    document.getElementById('form-nip')?.focus();
    return;
  }

  // Validasi Format Nomor HP / WhatsApp Pegawai
  if (!PHONE_REGEX.test(no_hp)) {
    showFormValidationAlert('Nomor HP / WhatsApp tidak valid! Masukkan nomor aktif berupa angka (9 s.d. 16 digit, contoh: 081234567890).');
    document.getElementById('form-phone')?.focus();
    return;
  }

  // 4. Penanganan Pasfoto (Unggah Foto Mandiri vs Opsi Foto di Kantor)
  let finalFoto = DEFAULT_TABLE_AVATAR;
  let finalPhotoReady = 'not_ready';

  if (photoOption === 'ready') {
    if (!userHasUploadedPhoto || !processedPhotoData) {
      showFormValidationAlert('Anda memilih opsi "Unggah Foto Mandiri", namun belum memilih berkas foto (.jpg, .jpeg, atau .png maks 2 MB). Silakan unggah foto Anda terlebih dahulu atau pilih "Opsi Foto di Kantor".');
      return;
    }
    finalFoto = processedPhotoData; // Base64 Data URL asli hasil pemotongan background
    finalPhotoReady = 'ready';
  } else {
    // Opsi Foto di Kantor -> tetapkan avatar/siluet kosong default netral untuk tabel status antrean
    finalFoto = DEFAULT_TABLE_AVATAR;
    finalPhotoReady = 'not_ready';
  }

  // 5. Pembuatan Nomor Tiket Otomatis (KMN-2026-XXXX) & Tanggal (YYYY-MM-DD)
  const tiket = generateTicketCode();
  const newRecord = normalizeRecord({
    tiket,
    tanggal,
    nama,
    nip,
    no_hp,
    whatsapp: no_hp,
    unitKerja,
    jabatan,
    foto: finalFoto,
    photoReady: finalPhotoReady,
    status: 'Menunggu Verifikasi'
  });

  idCardRecords.unshift(newRecord);
  saveDataToStorage();
  renderDashboardTable();
  renderAdminTable();

  // Kirim ke Backend Google Apps Script (action: "create", menyertakan no_hp / whatsapp)
  sendRecordToBackend(newRecord);

  lastSubmittedId = tiket;
  document.getElementById('success-reg-id').textContent = tiket;
  document.getElementById('modal-success').classList.remove('hidden');

  resetIdCardForm();
}

function resetIdCardForm() {
  const form = document.getElementById('id-card-form');
  if (form) form.reset();

  userHasUploadedPhoto = false;
  rawUploadedPhotoData = DEFAULT_CARD_SAMPLE_PHOTO;
  processedPhotoData = DEFAULT_CARD_SAMPLE_PHOTO;
  photoScale = 100;
  photoOffset = 0;

  const scaleSlider = document.getElementById('photo-scale');
  const offsetSlider = document.getElementById('photo-offset');
  const scaleVal = document.getElementById('scale-val');
  const offsetVal = document.getElementById('offset-val');
  const bgRemovalToggle = document.getElementById('toggle-bg-removal');
  const bgControls = document.getElementById('bg-remover-controls');

  if (scaleSlider) scaleSlider.value = '100';
  if (offsetSlider) offsetSlider.value = '0';
  if (scaleVal) scaleVal.textContent = '100%';
  if (offsetVal) offsetVal.textContent = '0px';
  if (bgRemovalToggle) bgRemovalToggle.checked = true;
  if (bgControls) bgControls.classList.remove('hidden');

  const statusBadge = document.getElementById('photo-upload-status-badge');
  if (statusBadge) {
    statusBadge.textContent = 'Foto Sampel Default';
    statusBadge.className = 'text-[10px] px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold';
  }

  const dropFilename = document.getElementById('drop-zone-filename');
  if (dropFilename) {
    dropFilename.textContent = 'Klik atau Tarik Berkas Pasfoto ke Sini';
  }

  hideFormValidationAlert();
  hidePhotoValidationError();
  setDefaultDate();
  togglePhotoUploadSection(true);
  validateNipInput(document.getElementById('form-nip') || { value: '' });
  validatePhoneInput(document.getElementById('form-phone') || { value: '' });
  updateLivePreview();
}

function closeSuccessModal() {
  document.getElementById('modal-success').classList.add('hidden');
}

function goToDashboardWithFilter() {
  closeSuccessModal();
  switchTab('dashboard');
  if (lastSubmittedId) {
    const searchInput = document.getElementById('dashboard-search-input');
    if (searchInput) {
      searchInput.value = lastSubmittedId;
      renderDashboardTable();
    }
  }
}

// ============================================================================
// 3.2 MODUL DASHBOARD STATUS & PELACAKAN (MODE PEGAWAI - READ ONLY)
// PROTEKSI PRIVASI: Nomor HP / WhatsApp TIDAK DITAMPILKAN pada tabel publik ini
// LOGIKA FOTO:
// - Pegawai "Foto di Kantor": tampilkan avatar/siluet kosong default netral (assets/default-avatar.png)
// - Pegawai "Unggah Foto Mandiri": tampilkan thumbnail foto asli yang diunggah & diproses
// ============================================================================

function setDashboardFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.dashboard-filter-btn').forEach(btn => {
    btn.className = (btn.dataset.filter === filter)
      ? 'dashboard-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap bg-emerald-700 text-white shadow-xs'
      : 'dashboard-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition whitespace-nowrap';
  });
  renderDashboardTable();
}

function updateStats() {
  const total = idCardRecords.length;
  const pending = idCardRecords.filter(r => r.status === 'Menunggu Verifikasi').length;
  const printing = idCardRecords.filter(r => r.status === 'Sedang Dicetak').length;
  const completed = idCardRecords.filter(r => r.status === 'Selesai').length;

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setTxt('stat-total', total);
  setTxt('stat-pending', pending);
  setTxt('stat-printing', printing);
  setTxt('stat-completed', completed);

  setTxt('filter-all-count', total);
  setTxt('filter-pending-count', pending);
  setTxt('filter-printing-count', printing);
  setTxt('filter-completed-count', completed);

  setTxt('nav-badge-count', total);
  setTxt('nav-badge-count-mobile', total);
}

function renderDashboardTable() {
  const tbody = document.getElementById('dashboard-table-body');
  const emptyState = document.getElementById('table-empty-state');
  const searchTerm = (document.getElementById('dashboard-search-input')?.value || '').toLowerCase().trim();

  if (!tbody) return;

  const filtered = idCardRecords.filter(item => {
    const matchesFilter = (currentFilter === 'all') || (item.status === currentFilter);
    const matchesSearch = !searchTerm ||
      (item.tiket || '').toLowerCase().includes(searchTerm) ||
      (item.nip || '').toLowerCase().includes(searchTerm) ||
      (item.nama || '').toLowerCase().includes(searchTerm) ||
      (item.unitKerja || '').toLowerCase().includes(searchTerm) ||
      (item.jabatan || '').toLowerCase().includes(searchTerm);
    return matchesFilter && matchesSearch;
  });

  tbody.innerHTML = '';

  if (filtered.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }
  if (emptyState) emptyState.classList.add('hidden');

  filtered.forEach(record => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition';

    let badgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
    let badgeIcon = '<i class="fa-solid fa-clock text-amber-600 mr-1.5"></i>';
    if (record.status === 'Selesai') {
      badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
      badgeIcon = '<i class="fa-solid fa-circle-check text-emerald-600 mr-1.5"></i>';
    } else if (record.status === 'Sedang Dicetak') {
      badgeClass = 'bg-sky-100 text-sky-800 border-sky-200';
      badgeIcon = '<i class="fa-solid fa-spinner fa-spin text-sky-600 mr-1.5"></i>';
    }

    const avatarSrc = getTableAvatarSrc(record);

    // PRD 3.2: Nomor Tiket, Foto Profil kecil (40px x 40px, border-radius: 4px, object-fit: cover), Nama Pegawai, NIP, Unit Kerja, Jabatan, Lencana Status
    // (Tanpa menampilkan Nomor HP/WhatsApp demi privasi pegawai)
    tr.innerHTML = `
      <td class="py-3.5 px-4 sm:px-5 align-middle font-mono font-bold text-xs text-emerald-800 whitespace-nowrap">
        ${escapeHtml(record.tiket)}
      </td>
      <td class="py-3.5 px-4 sm:px-5 align-middle">
        <div class="flex items-center space-x-3">
          <img src="${avatarSrc}" alt="${escapeHtml(record.nama)}" onerror="this.src='${DEFAULT_TABLE_AVATAR}'" class="avatar-table-thumb" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;">
          <div>
            <h4 class="font-bold text-slate-900 leading-tight">${escapeHtml(record.nama)}</h4>
            <span class="text-[11px] text-slate-400">${escapeHtml(record.tanggal)}</span>
          </div>
        </div>
      </td>
      <td class="py-3.5 px-4 sm:px-5 align-middle font-mono text-xs font-bold text-slate-700 whitespace-nowrap">
        ${escapeHtml(record.nip)}
      </td>
      <td class="py-3.5 px-4 sm:px-5 align-middle text-xs font-semibold text-emerald-950">
        ${escapeHtml(record.unitKerja)}
      </td>
      <td class="py-3.5 px-4 sm:px-5 align-middle text-xs text-slate-600">
        ${escapeHtml(record.jabatan)}
      </td>
      <td class="py-3.5 px-4 sm:px-5 align-middle text-center whitespace-nowrap">
        <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${badgeClass}">
          ${badgeIcon}
          <span>${escapeHtml(record.status)}</span>
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Pelacakan Cepat (Cek Status NIP / Tiket)
function openQuickTrackModal() {
  document.getElementById('modal-quick-track').classList.remove('hidden');
  document.getElementById('quick-track-result').classList.add('hidden');
  const inp = document.getElementById('quick-track-input');
  if (inp) {
    inp.value = '';
    inp.focus();
  }
}

function closeQuickTrackModal() {
  document.getElementById('modal-quick-track').classList.add('hidden');
}

function handleQuickTrackSubmit(e) {
  e.preventDefault();
  const query = (document.getElementById('quick-track-input')?.value || '').trim().toUpperCase();
  const resultContainer = document.getElementById('quick-track-result');
  if (!resultContainer) return;

  const match = idCardRecords.find(r =>
    (r.tiket || '').toUpperCase() === query ||
    (r.nip || '').replace(/\s+/g, '') === query.replace(/\s+/g, '')
  );

  resultContainer.classList.remove('hidden');

  if (match) {
    const avatarSrc = getTableAvatarSrc(match);
    resultContainer.innerHTML = `
      <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-3">
        <div class="flex items-center justify-between">
          <span class="font-mono font-bold text-xs text-emerald-800">${escapeHtml(match.tiket)}</span>
          <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">${escapeHtml(match.status)}</span>
        </div>
        <div class="flex items-center space-x-3">
          <img src="${avatarSrc}" onerror="this.src='${DEFAULT_TABLE_AVATAR}'" class="avatar-table-thumb" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;">
          <div>
            <h5 class="text-sm font-bold text-slate-900">${escapeHtml(match.nama)}</h5>
            <p class="text-xs text-slate-500 font-mono">NIP. ${escapeHtml(match.nip)}</p>
          </div>
        </div>
        <div class="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
          <p><span class="font-bold">Unit Kerja:</span> ${escapeHtml(match.unitKerja)}</p>
          <p><span class="font-bold">Jabatan:</span> ${escapeHtml(match.jabatan)}</p>
        </div>
      </div>
    `;
  } else {
    resultContainer.innerHTML = `
      <div class="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs text-center">
        <i class="fa-solid fa-circle-exclamation text-rose-600 text-lg mb-1"></i>
        <p class="font-bold">Data Tidak Ditemukan</p>
        <p class="mt-0.5">Periksa kembali 18 digit NIP atau Nomor Tiket Anda.</p>
      </div>
    `;
  }
}

// ============================================================================
// 3.5 MODUL AUTENTIKASI & MANAJEMEN AKUN ADMIN (TANPA HARDCODE PASSWORD)
// ============================================================================

function getAdminSession() {
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function isAdminLoggedIn() {
  const sess = getAdminSession();
  return Boolean(sess && sess.loggedIn && sess.username);
}

function isSuperadmin() {
  const sess = getAdminSession();
  return Boolean(sess && sess.role === 'Superadmin');
}

async function computeSha256Hex(text) {
  if (!window.crypto || !window.crypto.subtle) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function updateAdminUI() {
  const sess = getAdminSession();
  const loggedIn = Boolean(sess && sess.loggedIn);

  const btnLogout = document.getElementById('btn-admin-logout');
  const navAdminText = document.getElementById('btn-admin-nav-text');
  const mobileBtnAdminText = document.getElementById('mobile-btn-admin-text');

  if (loggedIn) {
    if (btnLogout) btnLogout.classList.remove('hidden');
    if (navAdminText) navAdminText.textContent = 'Panel Admin';
    if (mobileBtnAdminText) mobileBtnAdminText.textContent = 'Panel Admin';

    const roleBadge = document.getElementById('admin-header-role-badge');
    const officerName = document.getElementById('admin-header-officer-name');
    const bannerRole = document.getElementById('admin-banner-role');
    const bannerUser = document.getElementById('admin-banner-username');

    if (roleBadge) roleBadge.textContent = (sess.role || 'Operator').toUpperCase();
    if (officerName) officerName.textContent = sess.nama_petugas || sess.username;
    if (bannerRole) bannerRole.textContent = sess.role || 'Operator';
    if (bannerUser) bannerUser.textContent = `@${sess.username}`;

    // Batasi form Tambah Admin hanya untuk Superadmin
    const addBox = document.getElementById('superadmin-add-account-box');
    if (addBox) {
      if (sess.role === 'Superadmin') {
        addBox.classList.remove('opacity-50', 'pointer-events-none');
      } else {
        addBox.classList.add('opacity-50', 'pointer-events-none');
      }
    }
  } else {
    if (btnLogout) btnLogout.classList.add('hidden');
    if (navAdminText) navAdminText.textContent = 'Login Admin';
    if (mobileBtnAdminText) mobileBtnAdminText.textContent = 'Login Admin';

    const headerAdmin = document.getElementById('header-admin');
    const headerPublic = document.getElementById('header-public');
    if (headerAdmin) headerAdmin.classList.add('hidden');
    if (headerPublic) headerPublic.classList.remove('hidden');

    if (window.location.hash === '#admin') {
      switchTab('dashboard');
    }
  }
}

function handleAdminNavClick() {
  if (isAdminLoggedIn()) {
    switchTab('admin');
  } else {
    openAdminLoginModal();
  }
}

function openAdminLoginModal() {
  const modal = document.getElementById('modal-admin-login');
  const errorBox = document.getElementById('admin-login-error');
  const usernameInput = document.getElementById('admin-login-username');
  const passwordInput = document.getElementById('admin-login-password');

  if (errorBox) errorBox.classList.add('hidden');
  if (usernameInput) usernameInput.value = '';
  if (passwordInput) passwordInput.value = '';
  if (modal) modal.classList.remove('hidden');
  if (usernameInput) usernameInput.focus();
}

function closeAdminLoginModal() {
  document.getElementById('modal-admin-login')?.classList.add('hidden');
}

/**
 * 3.5.1 Keamanan Login:
 * Mengirim permintaan verifikasi ke backend Google Apps Script (`action: "login"`).
 * Jika valid, simpan status sesi beserta informasi `role` di `sessionStorage`.
 */
async function handleAdminLoginSubmit(e) {
  e.preventDefault();
  const username = (document.getElementById('admin-login-username')?.value || '').trim();
  const password = (document.getElementById('admin-login-password')?.value || '').trim();
  const errorBox = document.getElementById('admin-login-error');
  const errorText = document.getElementById('admin-login-error-text');
  const submitBtn = document.getElementById('btn-submit-admin-login');
  const submitBtnText = document.getElementById('btn-submit-admin-login-text');

  if (!username || !password) return;
  if (errorBox) errorBox.classList.add('hidden');
  if (submitBtn) submitBtn.disabled = true;
  if (submitBtnText) submitBtnText.textContent = 'Memverifikasi...';

  try {
    // 1. Kirim permintaan verifikasi ke backend Google Apps Script (action: "login")
    const res = await postToAppsScript({
      action: 'login',
      username: username,
      password: password
    });

    if (res && res.status === 'success' && res.user) {
      const sessionData = {
        loggedIn: true,
        id_admin: res.user.id_admin || 'ADM-01',
        username: res.user.username,
        nama_petugas: res.user.nama_petugas || res.user.username,
        role: res.user.role || 'Superadmin',
        loginTime: new Date().toISOString()
      };
      sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(sessionData));

      if (Array.isArray(res.admins)) {
        adminAccountsList = res.admins;
        saveAdminAccountsCache();
      }

      closeAdminLoginModal();
      updateAdminUI();
      switchTab('admin');
      showToast(`Selamat datang, ${sessionData.nama_petugas} (${sessionData.role})!`);
      return;
    }

    // Jika backend lama belum memiliki action "login", lakukan verifikasi digest SHA-256 lokal
    if (res && res.message && res.message.includes('tidak dikenali')) {
      const verifiedLocal = await verifyOfflineDigestLogin(username, password);
      if (verifiedLocal) {
        sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(verifiedLocal));
        closeAdminLoginModal();
        updateAdminUI();
        switchTab('admin');
        showToast(`Login berhasil sebagai ${verifiedLocal.nama_petugas} (${verifiedLocal.role}).`);
        return;
      }
    }

    if (errorBox && errorText) {
      errorText.textContent = (res && res.message) ? res.message : 'Username atau kata sandi tidak valid!';
      errorBox.classList.remove('hidden');
    }
  } catch (err) {
    // Fallback verifikasi digest jika tidak ada koneksi internet saat pengujian lokal
    const verifiedLocal = await verifyOfflineDigestLogin(username, password);
    if (verifiedLocal) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(verifiedLocal));
      closeAdminLoginModal();
      updateAdminUI();
      switchTab('admin');
      showToast(`Login berhasil (Mode Lokal) sebagai ${verifiedLocal.nama_petugas}.`);
      return;
    }

    if (errorBox && errorText) {
      errorText.textContent = 'Username atau kata sandi salah!';
      errorBox.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (submitBtnText) submitBtnText.textContent = 'Masuk Admin';
  }
}

async function verifyOfflineDigestLogin(username, password) {
  const inputDigest = await computeSha256Hex(`${username.toLowerCase()}:${password}`);
  const match = adminAccountsList.find(a =>
    a.username.toLowerCase() === username.toLowerCase() &&
    a.status_aktif === 'Aktif' &&
    a.pwd_FrontDigest === inputDigest
  );
  if (!match) return null;
  return {
    loggedIn: true,
    id_admin: match.id_admin,
    username: match.username,
    nama_petugas: match.nama_petugas,
    role: match.role,
    loginTime: new Date().toISOString()
  };
}

function handleAdminLogout() {
  if (!confirm('Apakah Anda yakin ingin keluar dari Mode Admin?')) return;
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  updateAdminUI();
  switchTab('dashboard');
  showToast('Sesi Admin telah berakhir.');
}

function loadAdminAccountsCache() {
  const saved = localStorage.getItem(ADMIN_ACCOUNTS_CACHE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        adminAccountsList = parsed;
      }
    } catch (e) {}
  }
}

function saveAdminAccountsCache() {
  localStorage.setItem(ADMIN_ACCOUNTS_CACHE_KEY, JSON.stringify(adminAccountsList));
}

async function fetchAdminAccountsFromBackend() {
  try {
    const res = await postToAppsScript({
      action: 'manage_admin',
      sub_action: 'list'
    });
    if (res && res.status === 'success' && Array.isArray(res.admins)) {
      adminAccountsList = res.admins;
      saveAdminAccountsCache();
      renderAdminAccountsTable();
      showToast('Daftar petugas admin berhasil diperbarui dari Google Sheets.');
    } else {
      renderAdminAccountsTable();
    }
  } catch (e) {
    renderAdminAccountsTable();
  }
}

function renderAdminAccountsTable() {
  const tbody = document.getElementById('admin-accounts-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const superadminActive = isSuperadmin();

  adminAccountsList.forEach(acc => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition';

    const isAktif = (acc.status_aktif || 'Aktif') === 'Aktif';
    const statusPill = isAktif
      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Aktif</span>'
      : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">Nonaktif</span>';

    const rolePill = acc.role === 'Superadmin'
      ? '<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800">Superadmin</span>'
      : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">Operator</span>';

    tr.innerHTML = `
      <td class="py-3 px-3 font-mono font-bold text-slate-700">${escapeHtml(acc.id_admin)}</td>
      <td class="py-3 px-3">
        <p class="font-bold text-slate-900">${escapeHtml(acc.nama_petugas)}</p>
        <p class="font-mono text-[11px] text-slate-500">@${escapeHtml(acc.username)}</p>
      </td>
      <td class="py-3 px-3">${rolePill}</td>
      <td class="py-3 px-3 text-center">${statusPill}</td>
      <td class="py-3 px-3 text-center">
        ${superadminActive ? `
          <div class="flex items-center justify-center space-x-1">
            <button type="button" onclick="handleToggleAdminAccountStatus('${escapeHtml(acc.id_admin)}', '${escapeHtml(acc.username)}')" class="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-[10px] font-bold text-slate-700" title="Aktifkan / Nonaktifkan">
              ${isAktif ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
            <button type="button" onclick="handleDeleteAdminAccount('${escapeHtml(acc.id_admin)}', '${escapeHtml(acc.username)}')" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Hapus Akun">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        ` : '<span class="text-[10px] text-slate-400 italic">Khusus Superadmin</span>'}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function handleAdminChangePassword(e) {
  e.preventDefault();
  const sess = getAdminSession();
  if (!sess) return;

  const oldPassword = (document.getElementById('admin-change-old-pass')?.value || '').trim();
  const newPassword = (document.getElementById('admin-change-new-pass')?.value || '').trim();

  if (newPassword.length < 6) {
    alert('Password baru minimal harus terdiri dari 6 karakter.');
    return;
  }

  try {
    const res = await postToAppsScript({
      action: 'manage_admin',
      sub_action: 'change_password',
      username: sess.username,
      old_password: oldPassword,
      new_password: newPassword
    });

    if (res && res.status === 'error' && !res.message?.includes('tidak dikenali')) {
      alert(res.message);
      return;
    }
  } catch (err) {}

  // Perbarui digest lokal juga
  const target = adminAccountsList.find(a => a.username.toLowerCase() === sess.username.toLowerCase());
  if (target) {
    target.pwd_FrontDigest = await computeSha256Hex(`${sess.username.toLowerCase()}:${newPassword}`);
    saveAdminAccountsCache();
  }

  document.getElementById('admin-change-old-pass').value = '';
  document.getElementById('admin-change-new-pass').value = '';
  showToast('Password akun Anda berhasil diperbarui!');
}

async function handleSuperadminAddAccount(e) {
  e.preventDefault();
  if (!isSuperadmin()) {
    alert('Hanya Superadmin yang dapat menambahkan akun petugas baru.');
    return;
  }

  const nama_petugas = (document.getElementById('new-admin-fullname')?.value || '').trim();
  const username = (document.getElementById('new-admin-username')?.value || '').trim().toLowerCase();
  const role = document.getElementById('new-admin-role')?.value || 'Operator';
  const password = (document.getElementById('new-admin-password')?.value || '').trim();

  if (!nama_petugas || !username || !password) return;

  if (adminAccountsList.some(a => a.username.toLowerCase() === username)) {
    alert(`Username "${username}" sudah terdaftar.`);
    return;
  }

  const newId = `ADM-0${adminAccountsList.length + 1}`;
  const digest = await computeSha256Hex(`${username}:${password}`);

  const newAcc = {
    id_admin: newId,
    username,
    nama_petugas,
    role,
    status_aktif: 'Aktif',
    pwd_FrontDigest: digest
  };

  adminAccountsList.push(newAcc);
  saveAdminAccountsCache();
  renderAdminAccountsTable();

  try {
    const res = await postToAppsScript({
      action: 'manage_admin',
      sub_action: 'add',
      nama_petugas,
      username,
      password,
      role
    });
    if (res && Array.isArray(res.admins)) {
      adminAccountsList = res.admins;
      saveAdminAccountsCache();
      renderAdminAccountsTable();
    }
  } catch (err) {}

  document.getElementById('new-admin-fullname').value = '';
  document.getElementById('new-admin-username').value = '';
  document.getElementById('new-admin-password').value = '';
  showToast(`Akun petugas ${nama_petugas} (@${username}) berhasil ditambahkan!`);
}

async function handleToggleAdminAccountStatus(id_admin, username) {
  if (!isSuperadmin()) return;
  const target = adminAccountsList.find(a => a.id_admin === id_admin || a.username === username);
  if (!target) return;

  target.status_aktif = target.status_aktif === 'Aktif' ? 'Nonaktif' : 'Aktif';
  saveAdminAccountsCache();
  renderAdminAccountsTable();

  try {
    await postToAppsScript({
      action: 'manage_admin',
      sub_action: 'toggle_status',
      id_admin,
      username
    });
  } catch (err) {}

  showToast(`Status akun @${username} diubah menjadi ${target.status_aktif}.`);
}

async function handleDeleteAdminAccount(id_admin, username) {
  if (!isSuperadmin()) return;
  if (adminAccountsList.length <= 1) {
    alert('Tidak dapat menghapus satu-satunya akun Admin yang tersisa.');
    return;
  }
  if (!confirm(`Hapus akses petugas @${username} (${id_admin}) secara permanen?`)) return;

  adminAccountsList = adminAccountsList.filter(a => a.id_admin !== id_admin && a.username !== username);
  saveAdminAccountsCache();
  renderAdminAccountsTable();

  try {
    await postToAppsScript({
      action: 'manage_admin',
      sub_action: 'delete',
      id_admin,
      username
    });
  } catch (err) {}

  showToast(`Akun petugas @${username} telah dihapus.`);
}

// ============================================================================
// 3.3 MODUL MANAJEMEN ANTREAN & CETAK (MODE ADMIN)
// ============================================================================

function switchAdminSubTab(subTab) {
  currentAdminSubTab = subTab;
  ['requests', 'template', 'admins', 'units'].forEach(key => {
    const btn = document.getElementById(`admin-tab-btn-${key}`);
    const topBtn = document.getElementById(`admin-top-tab-${key}`);
    const view = document.getElementById(`admin-view-${key}`);

    if (view) {
      if (key === subTab) view.classList.remove('hidden');
      else view.classList.add('hidden');
    }

    if (btn) {
      btn.className = (key === subTab)
        ? 'admin-subtab-btn px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 text-white shadow-xs transition flex items-center space-x-1.5 whitespace-nowrap'
        : 'admin-subtab-btn px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-emerald-800 hover:bg-slate-100 transition flex items-center space-x-1.5 whitespace-nowrap';
    }

    if (topBtn) {
      topBtn.className = (key === subTab)
        ? 'px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center space-x-1.5 bg-emerald-700 text-white shadow-xs'
        : 'px-3 py-1.5 rounded-lg font-semibold text-xs text-slate-300 hover:text-white hover:bg-slate-700/60 transition flex items-center space-x-1.5';
    }
  });

  if (subTab === 'requests') renderAdminTable();
  else if (subTab === 'template') applyConfigToUI();
  else if (subTab === 'admins') renderAdminAccountsTable();
  else if (subTab === 'units') renderAdminUnitsList();
}

function setAdminFilter(status) {
  currentAdminFilter = status;
  document.querySelectorAll('.admin-filter-btn').forEach(btn => {
    btn.className = (btn.dataset.adminFilter === status)
      ? 'admin-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-700 text-white shadow-xs'
      : 'admin-filter-btn px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100';
  });
  renderAdminTable();
}

function formatWhatsAppUrl(phoneStr) {
  const digits = String(phoneStr || '').replace(/\D/g, '');
  if (!digits) return '';
  const intl = digits.startsWith('0') ? '62' + digits.slice(1) : digits;
  return `https://wa.me/${intl}`;
}

function renderAdminTable() {
  const tbody = document.getElementById('admin-table-body');
  const emptyState = document.getElementById('admin-table-empty-state');
  const search = (document.getElementById('admin-search-input')?.value || '').toLowerCase().trim();
  const selectedUnit = document.getElementById('admin-filter-unit')?.value || 'all';

  if (!tbody) return;

  const total = idCardRecords.length;
  const pending = idCardRecords.filter(r => r.status === 'Menunggu Verifikasi').length;
  const printing = idCardRecords.filter(r => r.status === 'Sedang Dicetak').length;
  const completed = idCardRecords.filter(r => r.status === 'Selesai').length;

  const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setTxt('admin-stat-total', total);
  setTxt('admin-stat-pending', pending);
  setTxt('admin-stat-printing', printing);
  setTxt('admin-stat-completed', completed);
  setTxt('admin-badge-req-count', total);
  setTxt('admin-top-badge-req-count', total);

  const filtered = idCardRecords.filter(item => {
    const matchesFilter = (currentAdminFilter === 'all') || (item.status === currentAdminFilter);
    const matchesUnit = (selectedUnit === 'all') || (item.unitKerja === selectedUnit);
    const matchesSearch = !search ||
      (item.tiket || '').toLowerCase().includes(search) ||
      (item.nama || '').toLowerCase().includes(search) ||
      (item.nip || '').toLowerCase().includes(search) ||
      (item.no_hp || '').toLowerCase().includes(search) ||
      (item.unitKerja || '').toLowerCase().includes(search) ||
      (item.jabatan || '').toLowerCase().includes(search);
    return matchesFilter && matchesUnit && matchesSearch;
  });

  tbody.innerHTML = '';

  if (filtered.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }
  if (emptyState) emptyState.classList.add('hidden');

  filtered.forEach(record => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';

    const avatarSrc = getTableAvatarSrc(record);
    const phoneVal = (record.no_hp || record.whatsapp || '').trim();
    const waUrl = formatWhatsAppUrl(phoneVal);
    const contactHtml = phoneVal
      ? `<a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono font-bold text-xs transition" title="Hubungi Pegawai via WhatsApp">
           <i class="fa-brands fa-whatsapp text-emerald-600 text-sm"></i>
           <span>${escapeHtml(phoneVal)}</span>
         </a>`
      : `<span class="text-xs text-slate-400 italic">Belum diisi</span>`;

    tr.innerHTML = `
      <td class="py-3.5 px-4 sm:px-5 align-middle font-mono font-bold text-xs text-emerald-800 whitespace-nowrap">
        ${escapeHtml(record.tiket)}
      </td>
      <td class="py-3.5 px-4 sm:px-5 align-middle">
        <div class="flex items-center space-x-3">
          <img src="${avatarSrc}" alt="${escapeHtml(record.nama)}" onerror="this.src='${DEFAULT_TABLE_AVATAR}'" class="avatar-table-thumb" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;">
          <div>
            <h4 class="font-bold text-slate-900 leading-tight">${escapeHtml(record.nama)}</h4>
            <span class="text-xs text-slate-500 font-mono">NIP. ${escapeHtml(record.nip)}</span>
          </div>
        </div>
      </td>
      <td class="py-3.5 px-4 sm:px-5 align-middle whitespace-nowrap">
        ${contactHtml}
      </td>
      <td class="py-3.5 px-4 sm:px-5 align-middle">
        <p class="font-bold text-emerald-950 text-xs">${escapeHtml(record.unitKerja)}</p>
        <p class="text-xs text-slate-500">${escapeHtml(record.jabatan)}</p>
      </td>
      <td class="py-3.5 px-4 sm:px-5 align-middle text-xs text-slate-500 whitespace-nowrap">
        ${escapeHtml(record.tanggal)}
      </td>
      <td class="py-3.5 px-4 sm:px-5 align-middle text-center whitespace-nowrap">
        <select onchange="handleAdminStatusChange('${escapeHtml(record.tiket)}', this.value)" class="text-xs font-bold px-3 py-1.5 rounded-xl border cursor-pointer ${
          record.status === 'Selesai' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
          record.status === 'Sedang Dicetak' ? 'bg-sky-50 text-sky-800 border-sky-300' :
          'bg-amber-50 text-amber-800 border-amber-300'
        }">
          <option value="Menunggu Verifikasi" ${record.status === 'Menunggu Verifikasi' ? 'selected' : ''}>Menunggu Verifikasi</option>
          <option value="Sedang Dicetak" ${record.status === 'Sedang Dicetak' ? 'selected' : ''}>Sedang Dicetak</option>
          <option value="Selesai" ${record.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
        </select>
      </td>
      <td class="py-3.5 px-4 sm:px-5 align-middle text-center whitespace-nowrap">
        <div class="flex items-center justify-center space-x-1.5">
          <button type="button" onclick="openAdminEditModal('${escapeHtml(record.tiket)}')" class="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs transition flex items-center space-x-1" title="Edit Biodata Pegawai">
            <i class="fa-solid fa-pen-to-square"></i>
            <span>Edit</span>
          </button>
          <button type="button" onclick="openAdminPrintModal('${escapeHtml(record.tiket)}')" class="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs transition flex items-center space-x-1" title="Cetak Kartu">
            <i class="fa-solid fa-print"></i>
            <span>Cetak</span>
          </button>
          <button type="button" onclick="handleAdminDeleteRecord('${escapeHtml(record.tiket)}')" class="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition flex items-center space-x-1" title="Hapus Data">
            <i class="fa-solid fa-trash-can"></i>
            <span>Hapus</span>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function handleAdminStatusChange(tiket, newStatus) {
  const record = idCardRecords.find(r => r.tiket === tiket || r.id === tiket);
  if (!record) return;

  record.status = newStatus;
  saveDataToStorage();
  renderAdminTable();
  renderDashboardTable();

  updateRecordOnBackend(record);
  showToast(`Status tiket ${tiket} diperbarui menjadi "${newStatus}".`);
}

function handleAdminDeleteRecord(tiket) {
  const record = idCardRecords.find(r => r.tiket === tiket || r.id === tiket);
  if (!record) return;

  if (!confirm(`Apakah Anda yakin ingin menghapus data pengajuan ${record.nama} (${record.tiket})?`)) return;

  idCardRecords = idCardRecords.filter(r => r.tiket !== tiket && r.id !== tiket);
  saveDataToStorage();
  renderAdminTable();
  renderDashboardTable();

  deleteRecordOnBackend(tiket);
  showToast(`Data pengajuan ${tiket} telah dihapus.`);
}

// Modal Edit Biodata Pegawai (PRD 3.3.1 - termasuk Nomor HP/WhatsApp eksklusif Admin)
let adminEditPhotoData = null;

function openAdminEditModal(tiket) {
  const record = idCardRecords.find(r => r.tiket === tiket || r.id === tiket);
  if (!record) return;

  populateUnitDropdowns();
  document.getElementById('admin-edit-id').value = record.tiket;
  document.getElementById('admin-edit-badge-id').textContent = record.tiket;
  document.getElementById('admin-edit-name').value = record.nama;
  document.getElementById('admin-edit-nip').value = record.nip;
  const phoneInput = document.getElementById('admin-edit-phone');
  if (phoneInput) phoneInput.value = record.no_hp || record.whatsapp || '';
  document.getElementById('admin-edit-status').value = record.status;
  document.getElementById('admin-edit-bidang').value = record.unitKerja;
  document.getElementById('admin-edit-jabatan').value = record.jabatan;
  document.getElementById('admin-edit-date').value = record.tanggal || getTodayDateString();

  const photoPreview = document.getElementById('admin-edit-photo-preview');
  adminEditPhotoData = record.foto || DEFAULT_TABLE_AVATAR;
  if (photoPreview) {
    photoPreview.src = getTableAvatarSrc(record);
  }

  const fileInput = document.getElementById('admin-edit-photo-file');
  if (fileInput) {
    fileInput.value = '';
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const check = validatePhotoFileObject(file);
      if (!check.valid) {
        alert(check.message);
        fileInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (re) => {
        adminEditPhotoData = re.target.result;
        if (photoPreview) photoPreview.src = adminEditPhotoData;
      };
      reader.readAsDataURL(file);
    };
  }

  document.getElementById('modal-admin-edit').classList.remove('hidden');
}

function closeAdminEditModal() {
  document.getElementById('modal-admin-edit').classList.add('hidden');
}

function handleAdminSaveEdit(e) {
  e.preventDefault();
  const tiket = document.getElementById('admin-edit-id').value;
  const record = idCardRecords.find(r => r.tiket === tiket || r.id === tiket);
  if (!record) return;

  const nama = document.getElementById('admin-edit-name').value.trim();
  const nip = document.getElementById('admin-edit-nip').value.trim();
  const no_hp = (document.getElementById('admin-edit-phone')?.value || '').replace(/\D/g, '').trim();
  const status = document.getElementById('admin-edit-status').value;
  const unitKerja = document.getElementById('admin-edit-bidang').value.trim();
  const jabatan = document.getElementById('admin-edit-jabatan').value.trim();
  const tanggal = document.getElementById('admin-edit-date').value || record.tanggal;

  if (!NIP_REGEX.test(nip)) {
    alert('Format NIP tidak valid! NIP wajib berupa tepat 18 digit angka.');
    return;
  }

  if (!PHONE_REGEX.test(no_hp)) {
    alert('Nomor HP / WhatsApp tidak valid! Masukkan 9 s.d. 16 digit angka.');
    return;
  }

  record.nama = nama;
  record.name = nama;
  record.nip = nip;
  record.no_hp = no_hp;
  record.whatsapp = no_hp;
  record.status = status;
  record.unitKerja = unitKerja;
  record.bidang = unitKerja;
  record.jabatan = jabatan;
  record.tanggal = tanggal;
  record.date = tanggal;

  if (adminEditPhotoData) {
    record.foto = adminEditPhotoData;
    record.photo = adminEditPhotoData;
    record.photoReady = (adminEditPhotoData !== DEFAULT_TABLE_AVATAR) ? 'ready' : 'not_ready';
  }

  saveDataToStorage();
  renderAdminTable();
  renderDashboardTable();
  closeAdminEditModal();

  updateRecordOnBackend(record);
  showToast(`Biodata pegawai ${nama} (${tiket}) berhasil diperbarui!`);
}

// Modal Tambah Pengajuan dari Panel Admin
let adminAddPhotoData = null;

function openAdminAddEmployeeModal() {
  populateUnitDropdowns();
  document.getElementById('admin-add-name').value = '';
  document.getElementById('admin-add-nip').value = '';
  const phoneInput = document.getElementById('admin-add-phone');
  if (phoneInput) phoneInput.value = '';
  document.getElementById('admin-add-jabatan').value = '';
  document.getElementById('admin-add-status').value = 'Sedang Dicetak';
  adminAddPhotoData = null;

  const fileInput = document.getElementById('admin-add-photo-file');
  if (fileInput) {
    fileInput.value = '';
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const check = validatePhotoFileObject(file);
      if (!check.valid) {
        alert(check.message);
        fileInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (re) => {
        adminAddPhotoData = re.target.result;
      };
      reader.readAsDataURL(file);
    };
  }

  document.getElementById('modal-admin-add').classList.remove('hidden');
}

function closeAdminAddEmployeeModal() {
  document.getElementById('modal-admin-add').classList.add('hidden');
}

function handleAdminSubmitNewEmployee(e) {
  e.preventDefault();
  const nama = document.getElementById('admin-add-name').value.trim();
  const nip = document.getElementById('admin-add-nip').value.trim();
  const no_hp = (document.getElementById('admin-add-phone')?.value || '').replace(/\D/g, '').trim();
  const jabatan = document.getElementById('admin-add-jabatan').value.trim();
  const unitKerja = document.getElementById('admin-add-bidang').value.trim();
  const status = document.getElementById('admin-add-status').value;

  if (!NIP_REGEX.test(nip)) {
    alert('Format NIP tidak valid! NIP wajib berupa tepat 18 digit angka numerik.');
    return;
  }

  if (!PHONE_REGEX.test(no_hp)) {
    alert('Nomor HP / WhatsApp tidak valid! Masukkan 9 s.d. 16 digit angka.');
    return;
  }

  const tiket = generateTicketCode();
  const tanggal = getTodayDateString();
  const foto = adminAddPhotoData || DEFAULT_TABLE_AVATAR;

  const newRecord = normalizeRecord({
    tiket,
    tanggal,
    nama,
    nip,
    no_hp,
    whatsapp: no_hp,
    unitKerja,
    jabatan,
    foto,
    photoReady: adminAddPhotoData ? 'ready' : 'not_ready',
    status
  });

  idCardRecords.unshift(newRecord);
  saveDataToStorage();
  renderAdminTable();
  renderDashboardTable();
  closeAdminAddEmployeeModal();

  sendRecordToBackend(newRecord);
  showToast(`Pengajuan ${tiket} (${nama}) berhasil ditambahkan!`);
}

// ============================================================================
// 3.4 MODUL KONFIGURASI DINAMIS: PERGANTIAN PIMPINAN & TEMPLATE KARTU
// ============================================================================

function loadConfigFromStorage() {
  const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
  if (saved) {
    try {
      appConfig = Object.assign({}, DEFAULT_CONFIG, JSON.parse(saved));
    } catch (e) {
      appConfig = { ...DEFAULT_CONFIG };
    }
  } else {
    appConfig = { ...DEFAULT_CONFIG };
    saveConfigToStorage();
  }
}

function saveConfigToStorage() {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(appConfig));
}

function applyConfigToUI() {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val !== undefined ? val : '';
  };

  setVal('setting-kepala-name', appConfig.nama_pimpinan);
  setVal('setting-kepala-nip', appConfig.nip_pimpinan);
  setVal('setting-kepala-title', appConfig.jabatan_pimpinan);
  setVal('setting-ttd-url', appConfig.ttd_pimpinan_url);
  setVal('setting-alamat-1', appConfig.alamat_kantor_1);
  setVal('setting-alamat-2', appConfig.alamat_kantor_2);
  setVal('setting-template-aktif', appConfig.template_aktif);
  setVal('setting-opsi-cetak', appConfig.opsi_cetak);
  setVal('setting-bg-depan-url', appConfig.bg_depan_url);
  setVal('setting-bg-belakang-url', appConfig.bg_belakang_url);

  currentFormPhotoRatio = 'cutout';

  previewBackSettingsLive();
  updateLivePreview();
}

function handleConfigImageUpload(event, targetType) {
  const file = event.target.files[0];
  if (!file) return;

  const check = validatePhotoFileObject(file);
  if (!check.valid) {
    alert(check.message);
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    if (targetType === 'ttd') {
      document.getElementById('setting-ttd-url').value = dataUrl;
    } else if (targetType === 'bg_depan') {
      document.getElementById('setting-bg-depan-url').value = dataUrl;
    } else if (targetType === 'bg_belakang') {
      document.getElementById('setting-bg-belakang-url').value = dataUrl;
    }
    previewBackSettingsLive();
  };
  reader.readAsDataURL(file);
}

function clearConfigImage(targetType) {
  if (targetType === 'ttd') {
    document.getElementById('setting-ttd-url').value = '';
    const f = document.getElementById('setting-ttd-file');
    if (f) f.value = '';
  } else if (targetType === 'bg_depan') {
    document.getElementById('setting-bg-depan-url').value = '';
    const f = document.getElementById('setting-bg-depan-file');
    if (f) f.value = '';
  } else if (targetType === 'bg_belakang') {
    document.getElementById('setting-bg-belakang-url').value = '';
    const f = document.getElementById('setting-bg-belakang-file');
    if (f) f.value = '';
  }
  previewBackSettingsLive();
}

function switchAdminConfigPreview(side) {
  const front = document.getElementById('admin-cfg-card-front');
  const back = document.getElementById('admin-cfg-card-back');
  const btnFront = document.getElementById('admin-cfg-btn-front');
  const btnBack = document.getElementById('admin-cfg-btn-back');

  if (side === 'front') {
    front?.classList.remove('hidden');
    back?.classList.add('hidden');
    if (btnFront) btnFront.className = 'px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-700 text-white';
    if (btnBack) btnBack.className = 'px-2.5 py-1 rounded text-[11px] font-bold text-slate-400 hover:text-white';
  } else {
    front?.classList.add('hidden');
    back?.classList.remove('hidden');
    if (btnBack) btnBack.className = 'px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-700 text-white';
    if (btnFront) btnFront.className = 'px-2.5 py-1 rounded text-[11px] font-bold text-slate-400 hover:text-white';
  }
}

function previewBackSettingsLive() {
  const nama_pimpinan = (document.getElementById('setting-kepala-name')?.value || '').trim() || DEFAULT_CONFIG.nama_pimpinan;
  const nip_pimpinan = (document.getElementById('setting-kepala-nip')?.value || '').trim() || DEFAULT_CONFIG.nip_pimpinan;
  const jabatan_pimpinan = (document.getElementById('setting-kepala-title')?.value || '').trim() || DEFAULT_CONFIG.jabatan_pimpinan;
  const ttd_pimpinan_url = (document.getElementById('setting-ttd-url')?.value || '').trim();
  const alamat1 = (document.getElementById('setting-alamat-1')?.value || '').trim() || DEFAULT_CONFIG.alamat_kantor_1;
  const alamat2 = (document.getElementById('setting-alamat-2')?.value || '').trim() || DEFAULT_CONFIG.alamat_kantor_2;
  const template_aktif = document.getElementById('setting-template-aktif')?.value || 'template_1';
  const bg_depan_url = (document.getElementById('setting-bg-depan-url')?.value || '').trim();
  const bg_belakang_url = (document.getElementById('setting-bg-belakang-url')?.value || '').trim();

  const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setTxt('admin-preview-alamat1', alamat1);
  setTxt('admin-preview-alamat2', alamat2);
  setTxt('admin-preview-kepala-title', jabatan_pimpinan);
  setTxt('admin-preview-kepala-name', nama_pimpinan);
  setTxt('admin-preview-kepala-nip', `NIP. ${nip_pimpinan}`);

  const ttdImg = document.getElementById('admin-preview-ttd-img');
  if (ttdImg) {
    if (ttd_pimpinan_url) {
      ttdImg.src = ttd_pimpinan_url;
      ttdImg.classList.remove('hidden');
    } else {
      ttdImg.classList.add('hidden');
    }
  }

  const cfgFront = document.getElementById('admin-cfg-card-front');
  const cfgBack = document.getElementById('admin-cfg-card-back');
  const cfgPhotoLayer = document.getElementById('admin-cfg-photo-layer');

  if (cfgFront) {
    cfgFront.classList.remove('theme-template_1', 'theme-template_2', 'theme-template_3');
    cfgFront.classList.add(`theme-${template_aktif}`);
    cfgFront.style.backgroundImage = bg_depan_url ? `url('${bg_depan_url}')` : '';
  }
  if (cfgBack) {
    cfgBack.classList.remove('theme-template_1', 'theme-template_2', 'theme-template_3');
    cfgBack.classList.add(`theme-${template_aktif}`);
    cfgBack.style.backgroundImage = bg_belakang_url ? `url('${bg_belakang_url}')` : '';
  }
  applyPhotoRatioClass(cfgPhotoLayer);
}

async function handleSaveBackSettings(e) {
  e.preventDefault();
  const nip_pimpinan = (document.getElementById('setting-kepala-nip')?.value || '').trim();
  if (!NIP_REGEX.test(nip_pimpinan)) {
    alert('NIP Pimpinan wajib terdiri dari tepat 18 digit angka numerik!');
    return;
  }

  appConfig = {
    nama_pimpinan: (document.getElementById('setting-kepala-name')?.value || '').trim(),
    nip_pimpinan: nip_pimpinan,
    jabatan_pimpinan: (document.getElementById('setting-kepala-title')?.value || '').trim(),
    masa_berlaku: appConfig.masa_berlaku || 'Selama Menjadi Pegawai',
    ttd_pimpinan_url: (document.getElementById('setting-ttd-url')?.value || '').trim(),
    aturan_kartu: '',
    alamat_kantor_1: (document.getElementById('setting-alamat-1')?.value || '').trim(),
    alamat_kantor_2: (document.getElementById('setting-alamat-2')?.value || '').trim(),
    template_aktif: document.getElementById('setting-template-aktif')?.value || 'template_1',
    opsi_cetak: document.getElementById('setting-opsi-cetak')?.value || '2_sisi',
    rasio_foto: 'cutout',
    bg_depan_url: (document.getElementById('setting-bg-depan-url')?.value || '').trim(),
    bg_belakang_url: (document.getElementById('setting-bg-belakang-url')?.value || '').trim()
  };

  saveConfigToStorage();
  applyConfigToUI();

  // Kirim ke Backend Google Apps Script (action: "save_config")
  try {
    await postToAppsScript({
      action: 'save_config',
      config: appConfig
    });
  } catch (err) {
    console.warn('Konfigurasi disimpan di lokal, gagal sinkron ke Sheets:', err);
  }

  showToast('Pengaturan Pejabat Pengesah & Template Kartu berhasil disimpan!');
}

function handleResetBackSettingsToDefault() {
  if (!confirm('Kembalikan seluruh pengaturan pimpinan dan template kartu ke standar bawaan Kemenag?')) return;
  appConfig = { ...DEFAULT_CONFIG };
  saveConfigToStorage();
  applyConfigToUI();
  showToast('Pengaturan kartu telah dikembalikan ke default.');
}

// ============================================================================
// CETAK KARTU (PRINT LAYOUT CR80 - 1 SISI ATAU 2 SISI) (PRD 3.3.3 & 3.4.2)
// ============================================================================

function openAdminPrintModal(tiket) {
  const record = idCardRecords.find(r => r.tiket === tiket || r.id === tiket);
  if (!record) return;

  currentPrintingRecord = record;
  currentPrintModeOverride = appConfig.opsi_cetak || '2_sisi';

  const sideSelector = document.getElementById('print-modal-side-selector');
  if (sideSelector) sideSelector.value = currentPrintModeOverride;

  renderPrintModalCards();
  document.getElementById('modal-admin-print').classList.remove('hidden');
}

function handlePrintModalSideChange(mode) {
  currentPrintModeOverride = mode;
  renderPrintModalCards();
}

function renderPrintModalCards() {
  if (!currentPrintingRecord) return;
  const record = currentPrintingRecord;
  const mode = currentPrintModeOverride || appConfig.opsi_cetak || '2_sisi';

  const frontCard = document.getElementById('print-modal-card-front');
  const backCard = document.getElementById('print-modal-card-back');
  const backWrapper = document.getElementById('print-modal-back-wrapper');
  const photoLayer = document.getElementById('print-modal-photo-layer');

  applyCardTemplateVisuals(frontCard, backCard);
  applyPhotoRatioClass(photoLayer);

  if (backWrapper) {
    if (mode === '1_sisi') backWrapper.classList.add('hidden');
    else backWrapper.classList.remove('hidden');
  }

  // Isi Data Sisi Depan
  document.getElementById('print-modal-front-name').textContent = record.nama.toUpperCase();
  document.getElementById('print-modal-front-nip').textContent = `NIP. ${record.nip}`;

  const frontPhoto = document.getElementById('print-modal-front-photo');
  if (frontPhoto) {
    frontPhoto.src = getCardPhotoSrc(record);
    frontPhoto.style.objectFit = 'contain';
    frontPhoto.style.objectPosition = 'bottom left';
  }

  // Isi Data Sisi Belakang (Biodata + Konfigurasi Pimpinan Aktif, tanpa teks aturan & masa berlaku)
  document.getElementById('print-modal-back-name').textContent = record.nama;
  document.getElementById('print-modal-back-nip').textContent = record.nip;
  document.getElementById('print-modal-back-jabatan').textContent = record.jabatan;
  document.getElementById('print-modal-back-bidang').textContent = record.unitKerja;
  document.getElementById('print-modal-back-alamat1').textContent = appConfig.alamat_kantor_1;
  document.getElementById('print-modal-back-alamat2').textContent = appConfig.alamat_kantor_2;
  document.getElementById('print-modal-back-date').textContent = `Banjarmasin, ${formatIndonesianDate(record.tanggal)}`;
  document.getElementById('print-modal-back-kepala-title').textContent = appConfig.jabatan_pimpinan;
  document.getElementById('print-modal-back-kepala-name').textContent = appConfig.nama_pimpinan;
  document.getElementById('print-modal-back-kepala-nip').textContent = `NIP. ${appConfig.nip_pimpinan}`;

  const printTtd = document.getElementById('print-modal-back-ttd-img');
  if (printTtd) {
    if (appConfig.ttd_pimpinan_url) {
      printTtd.src = appConfig.ttd_pimpinan_url;
      printTtd.classList.remove('hidden');
    } else {
      printTtd.classList.add('hidden');
    }
  }
}

function closeAdminPrintModal() {
  document.getElementById('modal-admin-print').classList.add('hidden');
}

function triggerCardPrint() {
  if (!currentPrintingRecord) return;
  const record = currentPrintingRecord;
  const mode = currentPrintModeOverride || appConfig.opsi_cetak || '2_sisi';
  const tplClass = `theme-${appConfig.template_aktif || 'template_1'}`;

  const printContainer = document.getElementById('print-container');
  if (!printContainer) return;

  const photoSrc = getCardPhotoSrc(record);
  const frontBgStyle = appConfig.bg_depan_url ? `style="background-image: url('${appConfig.bg_depan_url}');"` : '';
  const backBgStyle = appConfig.bg_belakang_url ? `style="background-image: url('${appConfig.bg_belakang_url}');"` : '';

  const ttdHtml = appConfig.ttd_pimpinan_url
    ? `<img src="${appConfig.ttd_pimpinan_url}" alt="TTD" class="back-ttd-img">`
    : '';

  const frontHtml = `
    <div class="kemenag-card kemenag-card-front ${tplClass}" ${frontBgStyle}>
      <div class="kemenag-photo-layer">
        <img src="${photoSrc}" alt="${escapeHtml(record.nama)}" class="kemenag-photo-img">
      </div>
      <div class="kemenag-wave-overlay"></div>
      <div class="kemenag-front-text">
        <h3 class="kemenag-front-name">${escapeHtml(record.nama.toUpperCase())}</h3>
        <p class="kemenag-front-nip">NIP. ${escapeHtml(record.nip)}</p>
      </div>
    </div>
  `;

  const backHtml = mode === '2_sisi' ? `
    <div class="kemenag-card kemenag-card-back ${tplClass}" ${backBgStyle}>
      <div class="kemenag-back-content">
        <p class="back-text-item back-label-gap uppercase">NAMA</p>
        <p class="back-text-item back-section-gap">${escapeHtml(record.nama)}</p>

        <p class="back-text-item back-label-gap uppercase">NIP</p>
        <p class="back-text-item back-section-gap">${escapeHtml(record.nip)}</p>

        <p class="back-text-item back-label-gap uppercase">JABATAN / UNIT KERJA</p>
        <p class="back-text-item">${escapeHtml(record.jabatan)}</p>
        <p class="back-text-item back-section-gap">${escapeHtml(record.unitKerja)}</p>

        <p class="back-text-item back-label-gap uppercase">ALAMAT KANTOR</p>
        <p class="back-text-item">${escapeHtml(appConfig.alamat_kantor_1)}</p>
        <p class="back-text-item back-section-gap">${escapeHtml(appConfig.alamat_kantor_2)}</p>

        <p class="back-text-item back-section-gap">Banjarmasin, ${formatIndonesianDate(record.tanggal)}</p>

        <div class="back-signature-block">
          <p class="back-kepala-title">${escapeHtml(appConfig.jabatan_pimpinan)}</p>
          ${ttdHtml}
          <p class="back-kepala-name">${escapeHtml(appConfig.nama_pimpinan)}</p>
          <p class="back-kepala-nip">NIP. ${escapeHtml(appConfig.nip_pimpinan)}</p>
        </div>
      </div>
    </div>
  ` : '';

  printContainer.innerHTML = frontHtml + backHtml;
  window.print();
}

// ============================================================================
// KELOLA UNIT KERJA / BIDANG
// ============================================================================

function loadUnits() {
  const saved = localStorage.getItem(UNITS_STORAGE_KEY);
  if (saved) {
    try {
      kemenagUnits = JSON.parse(saved);
      if (!Array.isArray(kemenagUnits) || kemenagUnits.length === 0) {
        kemenagUnits = [...DEFAULT_KEMENAG_UNITS];
      }
    } catch (e) {
      kemenagUnits = [...DEFAULT_KEMENAG_UNITS];
    }
  } else {
    kemenagUnits = [...DEFAULT_KEMENAG_UNITS];
    saveUnits();
  }
}

function saveUnits() {
  localStorage.setItem(UNITS_STORAGE_KEY, JSON.stringify(kemenagUnits));
  populateUnitDropdowns();
  renderAdminUnitsList();
}

function populateUnitDropdowns() {
  const optionsHtml = kemenagUnits.map(unit => `<option value="${escapeHtml(unit)}">${escapeHtml(unit)}</option>`).join('');

  ['form-bidang', 'admin-edit-bidang', 'admin-add-bidang'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const currentVal = el.value;
      el.innerHTML = optionsHtml;
      if (kemenagUnits.includes(currentVal)) el.value = currentVal;
    }
  });

  const adminFilterUnit = document.getElementById('admin-filter-unit');
  if (adminFilterUnit) {
    const currentVal = adminFilterUnit.value;
    adminFilterUnit.innerHTML = '<option value="all">Semua Unit Kerja</option>' + optionsHtml;
    if (currentVal && (currentVal === 'all' || kemenagUnits.includes(currentVal))) {
      adminFilterUnit.value = currentVal;
    }
  }
}

function renderAdminUnitsList() {
  const listContainer = document.getElementById('admin-units-list');
  const countPill = document.getElementById('admin-total-units-pill');
  const badgeCount = document.getElementById('admin-badge-units-count');

  if (countPill) countPill.textContent = `${kemenagUnits.length} Unit`;
  if (badgeCount) badgeCount.textContent = kemenagUnits.length;
  if (!listContainer) return;

  listContainer.innerHTML = '';
  kemenagUnits.forEach((unit, index) => {
    const item = document.createElement('div');
    item.className = 'py-2.5 px-3 flex items-center justify-between hover:bg-slate-50 rounded-xl transition border-b border-slate-100 last:border-b-0';
    item.innerHTML = `
      <div class="flex items-center space-x-3">
        <span class="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-bold font-mono flex items-center justify-center border border-emerald-200">${index + 1}</span>
        <span class="text-xs sm:text-sm font-bold text-slate-800">${escapeHtml(unit)}</span>
      </div>
      <div class="flex items-center space-x-1">
        <button type="button" onclick="openEditUnitModal(${index})" class="p-1.5 rounded-lg text-slate-400 hover:text-amber-700 hover:bg-amber-50 text-xs"><i class="fa-solid fa-pen-to-square"></i></button>
        <button type="button" onclick="deleteUnit(${index})" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    `;
    listContainer.appendChild(item);
  });
}

function handleAdminAddUnit(e) {
  e.preventDefault();
  const input = document.getElementById('admin-new-unit-input');
  const newName = (input?.value || '').trim();
  if (!newName) return;
  if (kemenagUnits.includes(newName)) {
    alert('Unit kerja tersebut sudah ada di dalam daftar.');
    return;
  }
  kemenagUnits.push(newName);
  saveUnits();
  if (input) input.value = '';
  showToast(`Unit kerja "${newName}" berhasil ditambahkan!`);
}

function openEditUnitModal(index) {
  if (!kemenagUnits[index]) return;
  document.getElementById('unit-edit-index').value = index;
  document.getElementById('unit-edit-name-input').value = kemenagUnits[index];
  document.getElementById('modal-unit-edit').classList.remove('hidden');
}

function closeEditUnitModal() {
  document.getElementById('modal-unit-edit').classList.add('hidden');
}

function handleSaveEditedUnit(e) {
  e.preventDefault();
  const index = parseInt(document.getElementById('unit-edit-index').value, 10);
  const newName = document.getElementById('unit-edit-name-input').value.trim();
  if (!newName || isNaN(index) || !kemenagUnits[index]) return;

  const oldName = kemenagUnits[index];
  kemenagUnits[index] = newName;
  idCardRecords.forEach(r => {
    if (r.unitKerja === oldName) {
      r.unitKerja = newName;
      r.bidang = newName;
    }
  });
  saveDataToStorage();
  saveUnits();
  renderAdminTable();
  renderDashboardTable();
  closeEditUnitModal();
  showToast(`Unit kerja diperbarui menjadi "${newName}".`);
}

function deleteUnit(index) {
  if (kemenagUnits.length <= 1) return;
  const target = kemenagUnits[index];
  if (!confirm(`Hapus unit kerja "${target}"?`)) return;
  kemenagUnits.splice(index, 1);
  saveUnits();
  showToast(`Unit kerja "${target}" dihapus.`);
}

function handleResetUnitsToDefault() {
  if (!confirm('Reset daftar unit kerja ke standar Kanwil Kemenag Kalsel?')) return;
  kemenagUnits = [...DEFAULT_KEMENAG_UNITS];
  saveUnits();
  showToast('Daftar unit kerja direset ke standar default.');
}

// ============================================================================
// UTILITAS UI & KEAMANAN TEKS
// ============================================================================

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message) {
  const existing = document.getElementById('app-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'app-toast';
  toast.className = 'fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 text-xs sm:text-sm font-semibold border border-slate-700';
  toast.innerHTML = `
    <i class="fa-solid fa-circle-check text-emerald-400 text-base"></i>
    <span>${escapeHtml(message)}</span>
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.5s ease';
    setTimeout(() => toast.remove(), 500);
  }, 3500);
}
