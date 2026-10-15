/**
 * CetakID Pegawai - Kanwil Kemenag Prov. Kalimantan Selatan
 * Application Logic: Half-body Photo Integration,
 * Smart Client-Side Background Removal, Admin Dashboard,
 * Real-time Validations, Dynamic Units & Template Settings.
 */

// Storage Keys
const STORAGE_KEY = 'kemenag_idcard_records_v6';
const UNITS_STORAGE_KEY = 'kemenag_idcard_units_v1';
const BACK_SETTINGS_KEY = 'kemenag_idcard_back_settings_v1';
const ADMIN_AUTH_KEY = 'kemenag_admin_logged_in';

let idCardRecords = [];
let currentFilter = 'all';
let currentAdminFilter = 'all';
let currentAdminSubTab = 'requests';
let currentPrintingRecord = null;
let rawUploadedPhotoData = 'assets/sample_pegawai_setengah_badan.png';
let processedPhotoData = 'assets/sample_pegawai_setengah_badan.png';
let userHasUploadedPhoto = false;
let photoScale = 100;
let photoOffset = 0;
let lastSubmittedId = null;

// Default Kemenag Kalsel Official Units
const DEFAULT_KEMENAG_UNITS = [
  "Kanwil Kemenag Kalsel",
  "Bidang Pendidikan Madrasah",
  "Bidang Pendidikan Agama dan Keagamaan Islam",
  "Bidang Pelayanan Haji & Umrah",
  "Bidang Urusan Agama Islam",
  "Bidang Penerangan Agama Islam",
  "Bimbingan Masyarakat Kristen",
  "Bimbingan Masyarakat Katolik",
  "Bimbingan Masyarakat Hindu",
  "Bimbingan Masyarakat Buddha",
  "Sub Bagian Perencanaan, Data & Informasi",
  "Sub Bagian Keuangan dan Barang Milik Negara",
  "Sub Bagian Kepegawaian & Hukum",
  "Sub Bagian Organisasi, Tata Laksana & KUB",
  "Sub Bagian Umum & Humas"
];

let kemenagUnits = [];

// Default Card Back Typography & Officials
const DEFAULT_BACK_SETTINGS = {
  kepalaName: 'Dr. H. MUHAMMAD TAMBRIN, M.M.Pd',
  kepalaNip: '196912181996031003',
  kepalaTitle: 'KEPALA',
  alamat1: 'Jl. D.I. Panjaitan',
  alamat2: 'No. 19 Banjarmasin'
};

let cardBackSettings = { ...DEFAULT_BACK_SETTINGS };

// Initial Demo Seed Records matching official Kemenag Kalsel Half-Body template
const DEFAULT_DEMO_RECORDS = [
  {
    id: 'KMN-2026-1001',
    name: 'Rahmat Hidayat, S.Kom, M.M.',
    nip: '198804122014021003',
    bidang: 'Sub Bagian Perencanaan, Data & Informasi',
    jabatan: 'Pranata Komputer Ahli Muda',
    date: '2026-10-14',
    photoReady: 'ready',
    photo: 'assets/sample_pegawai_setengah_badan.png',
    status: 'Selesai',
    createdAt: '2026-10-14 08:30'
  },
  {
    id: 'KMN-2026-1002',
    name: 'Siti Nur Azizah, S.Pd.I',
    nip: '198505122010012015',
    bidang: 'Bidang Pendidikan Madrasah',
    jabatan: 'Penyusun Bahan Pembinaan Kesiswaan',
    date: '2026-10-13',
    photoReady: 'ready',
    photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
    status: 'Sedang Dicetak',
    createdAt: '2026-10-13 10:15'
  },
  {
    id: 'KMN-2026-1003',
    name: 'Ahmad Fauzan, M.Pd',
    nip: '199203152019031004',
    bidang: 'Bidang Urusan Agama Islam',
    jabatan: 'Analis Kebijakan Ahli Pertama',
    date: '2026-10-14',
    photoReady: 'not_ready',
    photo: null, // No photo uploaded - will show silhouette placeholder
    status: 'Menunggu Verifikasi',
    createdAt: '2026-10-14 09:00'
  }
];

// -------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadDataFromStorage();
  loadUnits();
  loadBackSettings();
  setupDragAndDrop();
  setDefaultDate();
  populateUnitDropdowns();
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
});

// -------------------------------------------------------------
// STORAGE HELPERS
// -------------------------------------------------------------
function loadDataFromStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      idCardRecords = JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing stored records:', e);
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

// -------------------------------------------------------------
// TAB NAVIGATION
// -------------------------------------------------------------
function switchTab(tabId) {
  if (tabId === 'admin' && !isAdminLoggedIn()) {
    openAdminLoginModal();
    return;
  }

  // Toggle Header visibility: Show #header-admin only if tabId === 'admin'
  const headerPublic = document.getElementById('header-public');
  const headerAdmin = document.getElementById('header-admin');

  if (tabId === 'admin') {
    if (headerPublic) headerPublic.classList.add('hidden');
    if (headerAdmin) headerAdmin.classList.remove('hidden');
  } else {
    if (headerAdmin) headerAdmin.classList.add('hidden');
    if (headerPublic) headerPublic.classList.remove('hidden');
  }

  document.querySelectorAll('.tab-pane').forEach(el => {
    el.classList.remove('active');
  });

  const activePane = document.getElementById(`tab-${tabId}`);
  if (activePane) {
    activePane.classList.add('active');
  }

  const navTabs = ['tata-cara', 'formulir', 'dashboard', 'admin'];
  navTabs.forEach(t => {
    const btn = document.getElementById(`nav-btn-${t}`);
    if (btn) {
      if (t === tabId) {
        btn.className = 'nav-item flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all duration-200 text-white bg-emerald-700 shadow-xs';
      } else {
        btn.className = 'nav-item flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl font-semibold text-xs transition-all duration-200 text-slate-600 hover:text-emerald-800 hover:bg-white/60';
      }
    }
  });

  window.location.hash = tabId;

  if (tabId === 'dashboard') {
    renderDashboardTable();
  } else if (tabId === 'admin') {
    switchAdminSubTab(currentAdminSubTab || 'requests');
    renderAdminTable();
    renderAdminUnitsList();
    applyBackSettings();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  if (menu.classList.contains('hidden')) {
    menu.classList.remove('hidden');
  } else {
    menu.classList.add('hidden');
  }
}

// -------------------------------------------------------------
// FORM DATE & PHOTO TOGGLE
// -------------------------------------------------------------
function setDefaultDate() {
  const dateInput = document.getElementById('form-date');
  if (dateInput && !dateInput.value) {
    dateInput.value = '2023-08-01';
  }
}

function togglePhotoUploadSection(isReady) {
  const photoSection = document.getElementById('section-photo-upload');
  if (photoSection) {
    if (isReady) {
      photoSection.classList.remove('opacity-40', 'pointer-events-none');
    } else {
      photoSection.classList.add('opacity-40', 'pointer-events-none');
    }
  }
}

// -------------------------------------------------------------
// LIVE PREVIEW SYNCHRONIZATION (EXACT TEMPLATE TYPOGRAPHY)
// -------------------------------------------------------------
function updateLivePreview() {
  const fullName = document.getElementById('form-name').value.trim() || 'Rahmat Hidayat, S.Kom, M.M.';
  const nip = document.getElementById('form-nip').value.trim() || '198804122014021003';
  const jabatan = document.getElementById('form-jabatan').value.trim() || 'Pranata Komputer Ahli Muda';
  const bidang = document.getElementById('form-bidang').value || 'Sub Bagian Perencanaan, Data & Informasi';
  const rawDate = document.getElementById('form-date').value || '2026-10-14';
  const photoReady = document.querySelector('input[name="photo_ready"]:checked')?.value || 'ready';

  // Front Card
  const frontName = fullName.toUpperCase();
  document.getElementById('preview-name').textContent = frontName;
  document.getElementById('preview-nip').textContent = `NIP. ${nip}`;

  const photoLayer = document.getElementById('preview-photo-layer');
  const placeholderLayer = document.getElementById('preview-photo-placeholder');
  const previewPhoto = document.getElementById('preview-photo');

  if (photoReady === 'not_ready') {
    if (photoLayer) photoLayer.classList.add('hidden');
    if (placeholderLayer) placeholderLayer.classList.remove('hidden');
  } else {
    if (photoLayer) photoLayer.classList.remove('hidden');
    if (placeholderLayer) placeholderLayer.classList.add('hidden');
    if (previewPhoto) {
      previewPhoto.src = processedPhotoData;
      previewPhoto.style.transform = `scale(${photoScale / 100}) translateY(${photoOffset}px)`;
    }
  }

  // Hero Card on Landing Page
  const heroName = document.getElementById('hero-preview-name');
  if (heroName) heroName.textContent = frontName;
  const heroNip = document.getElementById('hero-preview-nip');
  if (heroNip) heroNip.textContent = `NIP. ${nip}`;
  const heroPhoto = document.getElementById('hero-preview-photo');
  if (heroPhoto) heroPhoto.src = processedPhotoData;

  // Back Card (100% Roboto-Bold 12.5px #1a2c44)
  document.getElementById('back-preview-name').textContent = fullName;
  document.getElementById('back-preview-nip').textContent = nip;
  document.getElementById('back-preview-jabatan').textContent = jabatan;
  document.getElementById('back-preview-bidang').textContent = bidang;
  document.getElementById('back-preview-date').textContent = `Banjarmasin, ${formatIndonesianDate(rawDate)}`;

  // Dynamic back settings (Officials & Address)
  const bAlamat1 = document.getElementById('back-preview-alamat1');
  const bAlamat2 = document.getElementById('back-preview-alamat2');
  const bKepalaTitle = document.getElementById('back-preview-kepala-title');
  const bKepalaName = document.getElementById('back-preview-kepala-name');
  const bKepalaNip = document.getElementById('back-preview-kepala-nip');

  if (bAlamat1) bAlamat1.textContent = cardBackSettings.alamat1;
  if (bAlamat2) bAlamat2.textContent = cardBackSettings.alamat2;
  if (bKepalaTitle) bKepalaTitle.textContent = cardBackSettings.kepalaTitle;
  if (bKepalaName) bKepalaName.textContent = cardBackSettings.kepalaName;
  if (bKepalaNip) bKepalaNip.textContent = `NIP. ${cardBackSettings.kepalaNip}`;
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
  if (!dateStr) return '14 Oktober 2026';
  const parts = dateStr.split('-');
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

// -------------------------------------------------------------
// SMART BACKGROUND REMOVER (CANVAS BFS FLOOD-FILL)
// -------------------------------------------------------------
function setupDragAndDrop() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('form-photo-input');

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
    if (dt.files.length > 0) {
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
  if (!file.type.startsWith('image/')) {
    alert('Harap pilih file gambar (JPG, PNG, atau WEBP).');
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert('Ukuran gambar terlalu besar. Maksimum 5MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    rawUploadedPhotoData = e.target.result;
    userHasUploadedPhoto = true;
    runSmartBackgroundRemoval();
  };
  reader.readAsDataURL(file);
}

function toggleBackgroundRemoval() {
  const isEnabled = document.getElementById('toggle-bg-removal').checked;
  if (!isEnabled) {
    processedPhotoData = rawUploadedPhotoData;
    updateLivePreview();
  } else {
    runSmartBackgroundRemoval();
  }
}

function updateTolerance(val) {
  document.getElementById('tolerance-val').textContent = val;
  runSmartBackgroundRemoval();
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
  const isEnabled = document.getElementById('toggle-bg-removal').checked;
  if (!isEnabled) {
    processedPhotoData = rawUploadedPhotoData;
    updateLivePreview();
    return;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const canvas = document.getElementById('bg-processor-canvas');
    const ctx = canvas.getContext('2d');

    const maxDim = 800;
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
    ctx.drawImage(img, 0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // Preserve image if already transparent
    let hasTransparency = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 200) {
        hasTransparency = true;
        break;
      }
    }

    if (hasTransparency) {
      processedPhotoData = canvas.toDataURL('image/png');
      updateLivePreview();
      return;
    }

    const mode = document.getElementById('bg-color-mode').value;
    const tolerance = parseInt(document.getElementById('bg-tolerance').value, 10);
    const customContainer = document.getElementById('custom-color-container');

    if (mode === 'custom') {
      customContainer.classList.remove('hidden');
    } else {
      customContainer.classList.add('hidden');
    }

    let targetR = 0, targetG = 0, targetB = 0;

    if (mode === 'auto') {
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      const samplePoints = [
        [0, 0], [1, 0], [2, 0], [w - 1, 0], [w - 2, 0],
        [0, 1], [w - 1, 1], [0, h - 1], [w - 1, h - 1],
        [Math.floor(w / 4), 0], [Math.floor(w / 2), 0], [Math.floor(3 * w / 4), 0]
      ];

      samplePoints.forEach(([x, y]) => {
        const idx = (y * w + x) * 4;
        rSum += data[idx];
        gSum += data[idx + 1];
        bSum += data[idx + 2];
        count++;
      });

      targetR = rSum / count;
      targetG = gSum / count;
      targetB = bSum / count;
    } else if (mode === 'blue') {
      targetR = 30; targetG = 90; targetB = 180;
    } else if (mode === 'red') {
      targetR = 190; targetG = 30; targetB = 30;
    } else if (mode === 'white') {
      targetR = 240; targetG = 240; targetB = 240;
    } else if (mode === 'custom') {
      const hex = document.getElementById('bg-custom-color').value;
      document.getElementById('custom-color-hex').textContent = hex;
      const rgb = hexToRgb(hex);
      targetR = rgb.r; targetG = rgb.g; targetB = rgb.b;
    }

    const visited = new Uint8Array(w * h);
    const queue = [];

    for (let x = 0; x < w; x++) {
      queue.push(x, 0);
      queue.push(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      queue.push(0, y);
      queue.push(w - 1, y);
    }

    const featherDist = 12;

    let qHead = 0;
    while (qHead < queue.length) {
      const cx = queue[qHead++];
      const cy = queue[qHead++];
      const cIdx = cy * w + cx;

      if (visited[cIdx]) continue;
      visited[cIdx] = 1;

      const pIdx = cIdx * 4;
      const pr = data[pIdx];
      const pg = data[pIdx + 1];
      const pb = data[pIdx + 2];

      const dr = pr - targetR;
      const dg = pg - targetG;
      const db = pb - targetB;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);

      if (dist <= tolerance) {
        data[pIdx + 3] = 0;

        if (cx + 1 < w && !visited[cy * w + (cx + 1)]) queue.push(cx + 1, cy);
        if (cx - 1 >= 0 && !visited[cy * w + (cx - 1)]) queue.push(cx - 1, cy);
        if (cy + 1 < h && !visited[(cy + 1) * w + cx]) queue.push(cx, cy + 1);
        if (cy - 1 >= 0 && !visited[(cy - 1) * w + cx]) queue.push(cx, cy - 1);
      } else if (dist <= tolerance + featherDist) {
        const alphaRatio = (dist - tolerance) / featherDist;
        data[pIdx + 3] = Math.round(255 * alphaRatio);
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

// Preset Photo Loaders for Quick Demo
function loadPresetHalfBody() {
  rawUploadedPhotoData = 'assets/sample_pegawai_setengah_badan.png';
  processedPhotoData = 'assets/sample_pegawai_setengah_badan.png';
  userHasUploadedPhoto = true;
  document.getElementById('toggle-bg-removal').checked = true;
  updateLivePreview();
  showToast('Foto setengah badan resmi berhasil dimuat!');
}

function loadPresetBlueBg() {
  rawUploadedPhotoData = 'assets/test_sample_with_bg.png';
  userHasUploadedPhoto = true;
  document.getElementById('bg-color-mode').value = 'blue';
  document.getElementById('bg-tolerance').value = 40;
  document.getElementById('tolerance-val').textContent = '40';
  document.getElementById('toggle-bg-removal').checked = true;
  runSmartBackgroundRemoval();
  showToast('Foto latar biru dimuat & background langsung dihapus!');
}

// -------------------------------------------------------------
// FORM SUBMISSION & SUCCESS FLOW
// -------------------------------------------------------------
function handleFormSubmit(event) {
  event.preventDefault();

  const name = document.getElementById('form-name').value.trim();
  const nip = document.getElementById('form-nip').value.trim();
  const bidang = document.getElementById('form-bidang').value;
  const jabatan = document.getElementById('form-jabatan').value.trim();
  const date = document.getElementById('form-date').value;
  const photoReady = document.querySelector('input[name="photo_ready"]:checked')?.value || 'ready';

  if (!name || !nip || !bidang || !jabatan || !date) {
    alert('Harap lengkapi semua kolom bertanda bintang (*).');
    return;
  }

  // Attach photo only if employee chose 'ready' AND actually uploaded/provided a photo
  let finalPhoto = null;
  let finalPhotoReady = 'not_ready';

  if (photoReady === 'ready' && userHasUploadedPhoto && processedPhotoData) {
    finalPhoto = processedPhotoData;
    finalPhotoReady = 'ready';
  }

  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const newRegId = `KMN-2026-${randomSuffix}`;

  const now = new Date();
  const formattedTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const newRecord = {
    id: newRegId,
    name,
    nip,
    bidang,
    jabatan,
    date,
    photoReady: finalPhotoReady,
    photo: finalPhoto, // null if person did not upload photo
    status: 'Menunggu Verifikasi',
    createdAt: formattedTime
  };

  idCardRecords.unshift(newRecord);
  saveDataToStorage();

  lastSubmittedId = newRegId;
  document.getElementById('success-reg-id').textContent = newRegId;
  document.getElementById('modal-success').classList.remove('hidden');

  resetIdCardForm();
}

function closeSuccessModal() {
  document.getElementById('modal-success').classList.add('hidden');
}

function goToDashboardWithFilter() {
  closeSuccessModal();
  switchTab('dashboard');

  if (lastSubmittedId) {
    document.getElementById('dashboard-search-input').value = lastSubmittedId;
    renderDashboardTable();
  }
}

function resetIdCardForm() {
  document.getElementById('id-card-form').reset();
  userHasUploadedPhoto = false;
  processedPhotoData = 'assets/sample_pegawai_setengah_badan.png';
  rawUploadedPhotoData = 'assets/sample_pegawai_setengah_badan.png';
  photoScale = 100;
  photoOffset = 0;
  const scaleInput = document.getElementById('photo-scale');
  if (scaleInput) scaleInput.value = 100;
  const scaleVal = document.getElementById('scale-val');
  if (scaleVal) scaleVal.textContent = '100%';
  const offsetInput = document.getElementById('photo-offset');
  if (offsetInput) offsetInput.value = 0;
  const offsetVal = document.getElementById('offset-val');
  if (offsetVal) offsetVal.textContent = '0px';

  setDefaultDate();
  togglePhotoUploadSection(true);
  updateLivePreview();
}

// -------------------------------------------------------------
// DASHBOARD (AUDIENCE VIEW: READ-ONLY STATUS, NO DROPDOWN, NO ACTION COLUMN)
// -------------------------------------------------------------
function setDashboardFilter(filter) {
  currentFilter = filter;

  document.querySelectorAll('.dashboard-filter-btn').forEach(btn => {
    if (btn.dataset.filter === filter) {
      btn.className = 'dashboard-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap bg-emerald-700 text-white shadow-xs';
    } else {
      btn.className = 'dashboard-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition whitespace-nowrap';
    }
  });

  renderDashboardTable();
}

function updateStats() {
  const total = idCardRecords.length;
  const pending = idCardRecords.filter(r => r.status === 'Menunggu Verifikasi').length;
  const printing = idCardRecords.filter(r => r.status === 'Sedang Dicetak').length;
  const completed = idCardRecords.filter(r => r.status === 'Selesai').length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-pending').textContent = pending;
  document.getElementById('stat-printing').textContent = printing;
  document.getElementById('stat-completed').textContent = completed;

  document.getElementById('filter-all-count').textContent = total;
  document.getElementById('filter-pending-count').textContent = pending;
  document.getElementById('filter-printing-count').textContent = printing;
  document.getElementById('filter-completed-count').textContent = completed;

  const navBadge = document.getElementById('nav-badge-count');
  if (navBadge) navBadge.textContent = total;
  const navBadgeMobile = document.getElementById('nav-badge-count-mobile');
  if (navBadgeMobile) navBadgeMobile.textContent = total;
}

function renderDashboardTable() {
  const tbody = document.getElementById('dashboard-table-body');
  const emptyState = document.getElementById('table-empty-state');
  const searchTerm = (document.getElementById('dashboard-search-input')?.value || '').toLowerCase().trim();

  let filtered = idCardRecords.filter(item => {
    const matchesFilter = (currentFilter === 'all') || (item.status === currentFilter);
    const matchesSearch = !searchTerm ||
      item.id.toLowerCase().includes(searchTerm) ||
      item.name.toLowerCase().includes(searchTerm) ||
      item.nip.toLowerCase().includes(searchTerm) ||
      item.bidang.toLowerCase().includes(searchTerm) ||
      item.jabatan.toLowerCase().includes(searchTerm);
    return matchesFilter && matchesSearch;
  });

  tbody.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  } else {
    emptyState.classList.add('hidden');
  }

  filtered.forEach(record => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition';

    let statusBadgeClass = '';
    let statusIcon = '';
    if (record.status === 'Selesai') {
      statusBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
      statusIcon = '<i class="fa-solid fa-circle-check text-emerald-600 mr-1.5"></i>';
    } else if (record.status === 'Sedang Dicetak') {
      statusBadgeClass = 'bg-sky-100 text-sky-800 border-sky-200';
      statusIcon = '<i class="fa-solid fa-spinner fa-spin text-sky-600 mr-1.5"></i>';
    } else {
      statusBadgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
      statusIcon = '<i class="fa-solid fa-clock text-amber-600 mr-1.5"></i>';
    }

    const hasPhoto = Boolean(record.photo && record.photoReady === 'ready');
    const photoMarkup = hasPhoto
      ? `<img src="${record.photo}" alt="${record.name}" class="w-10 h-10 rounded-xl object-contain bg-slate-100 border border-slate-200 shadow-xs flex-shrink-0">`
      : `<div class="w-10 h-10 rounded-xl bg-slate-100 border border-dashed border-slate-300 flex-shrink-0 flex flex-col items-center justify-center text-slate-400 shadow-2xs" title="Foto belum diunggah (pengambilan di Bagian Umum)">
           <i class="fa-solid fa-user text-xs text-slate-400"></i>
           <span class="text-[7.5px] font-bold text-slate-500 leading-none mt-0.5">No Foto</span>
         </div>`;

    tr.innerHTML = `
      <td class="py-4 px-4 sm:px-6 align-middle font-mono font-bold text-xs text-emerald-800 whitespace-nowrap">
        <div class="flex items-center space-x-1.5">
          <i class="fa-solid fa-ticket text-emerald-600"></i>
          <span>${record.id}</span>
        </div>
      </td>

      <td class="py-4 px-4 sm:px-6 align-middle">
        <div class="flex items-center space-x-3">
          ${photoMarkup}
          <div>
            <h4 class="font-bold text-slate-900 leading-tight">${record.name}</h4>
            <div class="flex items-center space-x-2 mt-0.5">
              <span class="text-xs text-slate-500 font-mono">NIP. ${record.nip}</span>
              ${!hasPhoto ? '<span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 flex items-center space-x-1"><i class="fa-solid fa-camera text-[8px]"></i><span>Foto Bag. Umum</span></span>' : ''}
            </div>
          </div>
        </div>
      </td>

      <td class="py-4 px-4 sm:px-6 align-middle">
        <p class="font-bold text-emerald-900 text-xs">${record.bidang}</p>
        <p class="text-xs text-slate-500 font-medium">${record.jabatan}</p>
      </td>

      <td class="py-4 px-4 sm:px-6 align-middle text-xs text-slate-500 whitespace-nowrap">
        ${record.createdAt}
      </td>

      <td class="py-4 px-4 sm:px-6 align-middle text-center whitespace-nowrap">
        <span class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold border shadow-xs ${statusBadgeClass}">
          ${statusIcon}
          <span>${record.status}</span>
        </span>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// -------------------------------------------------------------
// QUICK TRACK MODAL (AUDIENCE TRACKING)
// -------------------------------------------------------------
function openQuickTrackModal() {
  document.getElementById('modal-quick-track').classList.remove('hidden');
  document.getElementById('quick-track-result').classList.add('hidden');
  document.getElementById('quick-track-input').value = '';
  document.getElementById('quick-track-input').focus();
}

function closeQuickTrackModal() {
  document.getElementById('modal-quick-track').classList.add('hidden');
}

function handleQuickTrackSubmit(e) {
  e.preventDefault();
  const search = document.getElementById('quick-track-input').value.trim().toUpperCase();
  const resultContainer = document.getElementById('quick-track-result');

  const match = idCardRecords.find(r => 
    r.id.toUpperCase() === search || r.nip.replace(/\s+/g, '') === search.replace(/\s+/g, '')
  );

  resultContainer.classList.remove('hidden');

  if (match) {
    let statusColor = 'amber';
    let progressStep = 1;
    if (match.status === 'Sedang Dicetak') {
      statusColor = 'sky';
      progressStep = 2;
    } else if (match.status === 'Selesai') {
      statusColor = 'emerald';
      progressStep = 3;
    }

    const hasPhoto = Boolean(match.photo && match.photoReady === 'ready');
    const quickPhotoMarkup = hasPhoto
      ? `<img src="${match.photo}" class="w-10 h-10 rounded-xl object-contain bg-white border border-slate-200">`
      : `<div class="w-10 h-10 rounded-xl bg-slate-100 border border-dashed border-slate-300 flex-shrink-0 flex flex-col items-center justify-center text-slate-400" title="Foto belum diunggah">
           <i class="fa-solid fa-user text-xs text-slate-400"></i>
           <span class="text-[7.5px] font-bold text-slate-500 leading-none mt-0.5">No Foto</span>
         </div>`;

    resultContainer.innerHTML = `
      <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-3">
        <div class="flex items-center justify-between">
          <span class="font-mono font-bold text-xs text-emerald-800">${match.id}</span>
          <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-${statusColor}-100 text-${statusColor}-800">
            ${match.status}
          </span>
        </div>

        <div class="flex items-center space-x-3 pt-1">
          ${quickPhotoMarkup}
          <div>
            <h5 class="text-sm font-bold text-slate-900">${match.name}</h5>
            <div class="flex items-center space-x-2 mt-0.5">
              <span class="text-xs text-slate-500 font-mono">NIP. ${match.nip}</span>
              ${!hasPhoto ? '<span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">Foto Bag. Umum</span>' : ''}
            </div>
          </div>
        </div>

        ${!hasPhoto ? `
          <div class="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center space-x-2">
            <i class="fa-solid fa-camera text-amber-600 flex-shrink-0 text-sm"></i>
            <span>Pegawai belum mengunggah foto. Pengambilan foto dijadwalkan di Bagian Umum Kanwil Kemenag.</span>
          </div>
        ` : ''}

        <div class="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
          <p><span class="font-bold">Unit Kerja:</span> ${match.bidang}</p>
          <p><span class="font-bold">Jabatan:</span> ${match.jabatan}</p>
        </div>

        <!-- Progress Steps -->
        <div class="pt-2 border-t border-slate-200">
          <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Status Pengerjaan:</p>
          <div class="grid grid-cols-3 gap-1.5 text-center text-[10px]">
            <div class="p-1.5 rounded-lg ${progressStep >= 1 ? 'bg-emerald-700 text-white font-bold' : 'bg-slate-200 text-slate-500'}">
              1. Verifikasi
            </div>
            <div class="p-1.5 rounded-lg ${progressStep >= 2 ? 'bg-sky-600 text-white font-bold' : 'bg-slate-200 text-slate-500'}">
              2. Dicetak
            </div>
            <div class="p-1.5 rounded-lg ${progressStep >= 3 ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-200 text-slate-500'}">
              3. Selesai
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    resultContainer.innerHTML = `
      <div class="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs text-center">
        <i class="fa-solid fa-circle-exclamation text-rose-600 text-xl mb-1"></i>
        <p class="font-bold">NIP atau Nomor Registrasi Tidak Ditemukan</p>
        <p class="mt-1">Pastikan NIP atau kode tiket tepat (contoh: KMN-2026-1001 atau 198804122014021003).</p>
      </div>
    `;
  }
}

// -------------------------------------------------------------
// TOAST NOTIFICATION
// -------------------------------------------------------------
function showToast(message) {
  const existing = document.getElementById('app-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'app-toast';
  toast.className = 'fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 text-xs sm:text-sm font-semibold border border-slate-700';
  toast.innerHTML = `
    <i class="fa-solid fa-circle-check text-emerald-400 text-base"></i>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.5s ease';
    setTimeout(() => toast.remove(), 500);
  }, 3500);
}

// =============================================================
// INPUT VALIDATIONS (REAL-TIME FEEDBACK)
// =============================================================

/**
 * Enforce strictly numeric keystrokes for NIP input
 */
function isNumberKey(event) {
  const charCode = (event.which) ? event.which : event.keyCode;
  // Allow navigation keys: backspace (8), tab (9), enter (13), etc.
  if (charCode > 31 && (charCode < 48 || charCode > 57)) {
    event.preventDefault();
    return false;
  }
  return true;
}

/**
 * Validate NIP input in real-time, enforce 18-digit constraint and update badge
 */
function validateNipInput(input) {
  // Strip any accidental non-digit characters (e.g. from copy-paste)
  const original = input.value;
  const digits = original.replace(/\D/g, '');
  if (original !== digits) {
    input.value = digits;
  }

  const badge = document.getElementById('nip-validation-badge');
  const feedback = document.getElementById('nip-validation-feedback');
  const iconStatus = document.getElementById('nip-icon-status');

  if (badge) {
    badge.textContent = `${digits.length}/18 Digit`;
    if (digits.length === 18) {
      badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono';
    } else {
      badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono';
    }
  }

  if (feedback && iconStatus) {
    if (digits.length === 18) {
      feedback.textContent = 'Format NIP valid dan lengkap (18 digit angka).';
      feedback.className = 'text-[11px] font-semibold mt-1 text-emerald-600';
      iconStatus.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-600"></i>';
    } else if (digits.length > 0) {
      feedback.textContent = `NIP PNS terdiri dari 18 digit angka (${18 - digits.length} digit lagi).`;
      feedback.className = 'text-[11px] font-semibold mt-1 text-amber-600';
      iconStatus.innerHTML = '<i class="fa-solid fa-circle-info text-amber-500"></i>';
    } else {
      feedback.textContent = 'Format resmi NIP PNS 18 digit angka tanpa huruf atau spasi.';
      feedback.className = 'text-[11px] font-semibold mt-1 text-slate-400';
      iconStatus.innerHTML = '<i class="fa-solid fa-hashtag text-slate-400"></i>';
    }
  }

  updateLivePreview();
}

/**
 * Validate employee name in real-time
 */
function validateNameInput(input) {
  const badge = document.getElementById('name-validation-badge');
  const val = input.value.trim();
  if (badge) {
    if (val.length >= 3) {
      badge.textContent = 'Nama valid';
      badge.className = 'text-[10px] font-bold text-emerald-600';
    } else {
      badge.textContent = 'Gelar depan/belakang diperbolehkan';
      badge.className = 'text-[10px] font-bold text-slate-400';
    }
  }
  updateLivePreview();
}


// =============================================================
// DYNAMIC UNIT KERJA / BIDANG MANAGEMENT
// =============================================================

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
  // Update #form-bidang (Registration form)
  const formBidang = document.getElementById('form-bidang');
  if (formBidang) {
    const currentVal = formBidang.value;
    formBidang.innerHTML = kemenagUnits.map(unit => `<option value="${unit}">${unit}</option>`).join('');
    if (kemenagUnits.includes(currentVal)) {
      formBidang.value = currentVal;
    }
  }

  // Update #admin-filter-unit (Admin table filter)
  const adminFilterUnit = document.getElementById('admin-filter-unit');
  if (adminFilterUnit) {
    const currentVal = adminFilterUnit.value;
    adminFilterUnit.innerHTML = '<option value="all">Semua Unit Kerja</option>' +
      kemenagUnits.map(unit => `<option value="${unit}">${unit}</option>`).join('');
    if (currentVal && (currentVal === 'all' || kemenagUnits.includes(currentVal))) {
      adminFilterUnit.value = currentVal;
    }
  }

  // Update #admin-edit-bidang (Admin edit modal)
  const adminEditBidang = document.getElementById('admin-edit-bidang');
  if (adminEditBidang) {
    adminEditBidang.innerHTML = kemenagUnits.map(unit => `<option value="${unit}">${unit}</option>`).join('');
  }

  // Update #admin-add-bidang (Admin add modal)
  const adminAddBidang = document.getElementById('admin-add-bidang');
  if (adminAddBidang) {
    adminAddBidang.innerHTML = kemenagUnits.map(unit => `<option value="${unit}">${unit}</option>`).join('');
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
    item.className = 'py-3 px-3 flex items-center justify-between hover:bg-slate-50 rounded-xl transition border-b border-slate-100 last:border-b-0';
    item.innerHTML = `
      <div class="flex items-center space-x-3">
        <span class="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-bold font-mono flex items-center justify-center border border-emerald-200">
          ${index + 1}
        </span>
        <span class="text-xs sm:text-sm font-bold text-slate-800">${unit}</span>
      </div>
      <div class="flex items-center space-x-1">
        <button type="button" onclick="openEditUnitModal(${index})" class="p-2 rounded-lg text-slate-400 hover:text-amber-700 hover:bg-amber-50 text-xs transition" title="Ubah Nama Unit">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button type="button" onclick="deleteUnit(${index})" class="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs transition" title="Hapus Unit">
          <i class="fa-solid fa-trash-can"></i>
        </button>
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
    alert('Unit kerja ini sudah ada di daftar.');
    return;
  }

  kemenagUnits.push(newName);
  saveUnits();
  if (input) input.value = '';
  showToast(`Unit kerja "${newName}" berhasil ditambahkan ke dropdown!`);
}

function openEditUnitModal(index) {
  const modal = document.getElementById('modal-unit-edit');
  const input = document.getElementById('unit-edit-name-input');
  const indexField = document.getElementById('unit-edit-index');

  if (kemenagUnits[index]) {
    indexField.value = index;
    input.value = kemenagUnits[index];
    modal.classList.remove('hidden');
    input.focus();
  }
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

  // Also update all existing records that were using the old name
  idCardRecords.forEach(r => {
    if (r.bidang === oldName) {
      r.bidang = newName;
    }
  });
  saveDataToStorage();
  saveUnits();
  renderAdminTable();
  renderDashboardTable();

  closeEditUnitModal();
  showToast(`Unit kerja "${oldName}" diperbarui menjadi "${newName}"!`);
}

function deleteUnit(index) {
  if (kemenagUnits.length <= 1) {
    alert('Minimal harus ada 1 unit kerja tersisa.');
    return;
  }

  const targetName = kemenagUnits[index];
  if (!confirm(`Hapus unit kerja "${targetName}" dari pilihan dropdown?`)) return;

  kemenagUnits.splice(index, 1);
  saveUnits();
  showToast(`Unit kerja "${targetName}" berhasil dihapus.`);
}

function handleResetUnitsToDefault() {
  if (!confirm('Apakah Anda yakin ingin mereset daftar unit kerja kembali ke 14 unit standar Kanwil Kemenag Kalsel?')) return;
  kemenagUnits = [...DEFAULT_KEMENAG_UNITS];
  saveUnits();
  showToast('Daftar unit kerja berhasil direset ke standar Kemenag!');
}


// =============================================================
// CARD BACK TEMPLATE SETTINGS (KEPALA KANWIL, NIP, & ALAMAT)
// =============================================================

function loadBackSettings() {
  const saved = localStorage.getItem(BACK_SETTINGS_KEY);
  if (saved) {
    try {
      cardBackSettings = Object.assign({}, DEFAULT_BACK_SETTINGS, JSON.parse(saved));
    } catch (e) {
      cardBackSettings = { ...DEFAULT_BACK_SETTINGS };
    }
  } else {
    cardBackSettings = { ...DEFAULT_BACK_SETTINGS };
    saveBackSettings();
  }
  applyBackSettings();
}

function saveBackSettings() {
  localStorage.setItem(BACK_SETTINGS_KEY, JSON.stringify(cardBackSettings));
  applyBackSettings();
}

function applyBackSettings() {
  // Update inputs in Sub-Tab 3 settings form
  const nameInput = document.getElementById('setting-kepala-name');
  const nipInput = document.getElementById('setting-kepala-nip');
  const titleInput = document.getElementById('setting-kepala-title');
  const alamat1Input = document.getElementById('setting-alamat-1');
  const alamat2Input = document.getElementById('setting-alamat-2');

  if (nameInput) nameInput.value = cardBackSettings.kepalaName;
  if (nipInput) nipInput.value = cardBackSettings.kepalaNip;
  if (titleInput) titleInput.value = cardBackSettings.kepalaTitle;
  if (alamat1Input) alamat1Input.value = cardBackSettings.alamat1;
  if (alamat2Input) alamat2Input.value = cardBackSettings.alamat2;

  // Update live preview card back (tab-formulir)
  const backAlamat1 = document.getElementById('back-preview-alamat1');
  const backAlamat2 = document.getElementById('back-preview-alamat2');
  const backKepalaTitle = document.getElementById('back-preview-kepala-title');
  const backKepalaName = document.getElementById('back-preview-kepala-name');
  const backKepalaNip = document.getElementById('back-preview-kepala-nip');

  if (backAlamat1) backAlamat1.textContent = cardBackSettings.alamat1;
  if (backAlamat2) backAlamat2.textContent = cardBackSettings.alamat2;
  if (backKepalaTitle) backKepalaTitle.textContent = cardBackSettings.kepalaTitle;
  if (backKepalaName) backKepalaName.textContent = cardBackSettings.kepalaName;
  if (backKepalaNip) backKepalaNip.textContent = `NIP. ${cardBackSettings.kepalaNip}`;

  // Update admin template mini preview (sub-tab 3)
  const adminAlamat1 = document.getElementById('admin-preview-alamat1');
  const adminAlamat2 = document.getElementById('admin-preview-alamat2');
  const adminKepalaTitle = document.getElementById('admin-preview-kepala-title');
  const adminKepalaName = document.getElementById('admin-preview-kepala-name');
  const adminKepalaNip = document.getElementById('admin-preview-kepala-nip');

  if (adminAlamat1) adminAlamat1.textContent = cardBackSettings.alamat1;
  if (adminAlamat2) adminAlamat2.textContent = cardBackSettings.alamat2;
  if (adminKepalaTitle) adminKepalaTitle.textContent = cardBackSettings.kepalaTitle;
  if (adminKepalaName) adminKepalaName.textContent = cardBackSettings.kepalaName;
  if (adminKepalaNip) adminKepalaNip.textContent = `NIP. ${cardBackSettings.kepalaNip}`;
}

function previewBackSettingsLive() {
  const name = document.getElementById('setting-kepala-name')?.value.trim() || cardBackSettings.kepalaName;
  const nip = document.getElementById('setting-kepala-nip')?.value.trim() || cardBackSettings.kepalaNip;
  const title = document.getElementById('setting-kepala-title')?.value.trim() || cardBackSettings.kepalaTitle;
  const alamat1 = document.getElementById('setting-alamat-1')?.value.trim() || cardBackSettings.alamat1;
  const alamat2 = document.getElementById('setting-alamat-2')?.value.trim() || cardBackSettings.alamat2;

  const adminAlamat1 = document.getElementById('admin-preview-alamat1');
  const adminAlamat2 = document.getElementById('admin-preview-alamat2');
  const adminKepalaTitle = document.getElementById('admin-preview-kepala-title');
  const adminKepalaName = document.getElementById('admin-preview-kepala-name');
  const adminKepalaNip = document.getElementById('admin-preview-kepala-nip');

  if (adminAlamat1) adminAlamat1.textContent = alamat1;
  if (adminAlamat2) adminAlamat2.textContent = alamat2;
  if (adminKepalaTitle) adminKepalaTitle.textContent = title;
  if (adminKepalaName) adminKepalaName.textContent = name;
  if (adminKepalaNip) adminKepalaNip.textContent = `NIP. ${nip}`;
}

function handleSaveBackSettings(e) {
  e.preventDefault();
  cardBackSettings.kepalaName = document.getElementById('setting-kepala-name').value.trim();
  cardBackSettings.kepalaNip = document.getElementById('setting-kepala-nip').value.trim();
  cardBackSettings.kepalaTitle = document.getElementById('setting-kepala-title').value.trim();
  cardBackSettings.alamat1 = document.getElementById('setting-alamat-1').value.trim();
  cardBackSettings.alamat2 = document.getElementById('setting-alamat-2').value.trim();

  saveBackSettings();
  showToast('Pengaturan informasi tampak belakang kartu berhasil disimpan!');
}

function handleResetBackSettingsToDefault() {
  if (!confirm('Kembalikan data Kepala Kanwil, NIP, dan alamat kantor ke standar resmi?')) return;
  cardBackSettings = { ...DEFAULT_BACK_SETTINGS };
  saveBackSettings();
  showToast('Data tampak belakang direset ke standar resmi Kemenag!');
}


// =============================================================
// ADMIN AUTHENTICATION & UI
// =============================================================

function isAdminLoggedIn() {
  return sessionStorage.getItem(ADMIN_AUTH_KEY) === 'true';
}

function updateAdminUI() {
  const loggedIn = isAdminLoggedIn();
  const navBtnAdmin = document.getElementById('nav-btn-admin');
  const btnLogout = document.getElementById('btn-admin-logout');
  const navAdminText = document.getElementById('btn-admin-nav-text');
  const mobileNavBtnAdmin = document.getElementById('mobile-nav-btn-admin');
  const mobileBtnAdminText = document.getElementById('mobile-btn-admin-text');

  if (loggedIn) {
    if (navBtnAdmin) navBtnAdmin.classList.remove('hidden');
    if (btnLogout) btnLogout.classList.remove('hidden');
    if (mobileNavBtnAdmin) mobileNavBtnAdmin.classList.remove('hidden');
    if (navAdminText) navAdminText.textContent = 'Masuk Panel Admin';
    if (mobileBtnAdminText) mobileBtnAdminText.textContent = 'Masuk Panel Admin';
  } else {
    if (navBtnAdmin) navBtnAdmin.classList.add('hidden');
    if (btnLogout) btnLogout.classList.add('hidden');
    if (mobileNavBtnAdmin) mobileNavBtnAdmin.classList.add('hidden');
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
  if (passwordInput) passwordInput.value = '';
  if (usernameInput) usernameInput.value = 'admin';
  modal.classList.remove('hidden');
  if (passwordInput) passwordInput.focus();
}

function closeAdminLoginModal() {
  document.getElementById('modal-admin-login').classList.add('hidden');
}

function handleAdminLoginSubmit(e) {
  e.preventDefault();
  const u = document.getElementById('admin-login-username').value.trim();
  const p = document.getElementById('admin-login-password').value.trim();
  const errorBox = document.getElementById('admin-login-error');
  const errorText = document.getElementById('admin-login-error-text');

  if (u === 'admin' && p === 'admin') {
    sessionStorage.setItem(ADMIN_AUTH_KEY, 'true');
    closeAdminLoginModal();
    updateAdminUI();
    switchTab('admin');
    showToast('Berhasil login sebagai Administrator!');
  } else {
    if (errorBox) {
      errorText.textContent = 'Username atau password salah! Gunakan default: admin / admin';
      errorBox.classList.remove('hidden');
    }
  }
}

function handleAdminLogout() {
  if (!confirm('Apakah Anda ingin keluar dari Panel Admin?')) return;
  sessionStorage.removeItem(ADMIN_AUTH_KEY);
  updateAdminUI();
  switchTab('dashboard');
  showToast('Anda telah logout dari Panel Admin.');
}

function switchAdminSubTab(subTab) {
  currentAdminSubTab = subTab;

  ['requests', 'units', 'template'].forEach(key => {
    const btn = document.getElementById(`admin-tab-btn-${key}`);
    const topBtn = document.getElementById(`admin-top-tab-${key}`);
    const view = document.getElementById(`admin-view-${key}`);

    if (view) {
      if (key === subTab) {
        view.classList.remove('hidden');
      } else {
        view.classList.add('hidden');
      }
    }

    if (btn) {
      if (key === subTab) {
        btn.className = 'admin-subtab-btn px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-700 text-white shadow-xs transition flex items-center space-x-1.5 whitespace-nowrap';
      } else {
        btn.className = 'admin-subtab-btn px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-emerald-800 hover:bg-slate-100 transition flex items-center space-x-1.5 whitespace-nowrap';
      }
    }

    if (topBtn) {
      if (key === subTab) {
        topBtn.className = 'px-3 py-1 rounded-lg font-bold text-xs transition flex items-center space-x-1.5 bg-emerald-700 text-white shadow-xs';
      } else {
        topBtn.className = 'px-3 py-1 rounded-lg font-semibold text-xs text-slate-300 hover:text-white hover:bg-slate-700/60 transition flex items-center space-x-1.5';
      }
    }
  });

  if (subTab === 'requests') {
    renderAdminTable();
  } else if (subTab === 'units') {
    renderAdminUnitsList();
  } else if (subTab === 'template') {
    applyBackSettings();
  }
}

function toggleAdminMobileMenu() {
  const menu = document.getElementById('admin-mobile-menu');
  if (menu) {
    menu.classList.toggle('hidden');
  }
}


// =============================================================
// ADMIN REQUESTS TABLE & STATUS MANIPULATION
// =============================================================

function setAdminFilter(status) {
  currentAdminFilter = status;
  document.querySelectorAll('.admin-filter-btn').forEach(btn => {
    if (btn.dataset.adminFilter === status) {
      btn.className = 'admin-filter-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-700 text-white shadow-xs';
    } else {
      btn.className = 'admin-filter-btn px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100';
    }
  });
  renderAdminTable();
}

function renderAdminTable() {
  const tbody = document.getElementById('admin-table-body');
  const emptyState = document.getElementById('admin-table-empty-state');
  const search = (document.getElementById('admin-search-input')?.value || '').toLowerCase().trim();
  const selectedUnit = document.getElementById('admin-filter-unit')?.value || 'all';

  if (!tbody) return;

  // Update Admin Statistics
  const total = idCardRecords.length;
  const pending = idCardRecords.filter(r => r.status === 'Menunggu Verifikasi').length;
  const printing = idCardRecords.filter(r => r.status === 'Sedang Dicetak').length;
  const completed = idCardRecords.filter(r => r.status === 'Selesai').length;

  const statTotal = document.getElementById('admin-stat-total');
  const statPending = document.getElementById('admin-stat-pending');
  const statPrinting = document.getElementById('admin-stat-printing');
  const statCompleted = document.getElementById('admin-stat-completed');

  if (statTotal) statTotal.textContent = total;
  if (statPending) statPending.textContent = pending;
  if (statPrinting) statPrinting.textContent = printing;
  if (statCompleted) statCompleted.textContent = completed;

  const badgeCount = document.getElementById('admin-badge-req-count');
  if (badgeCount) badgeCount.textContent = total;

  const topBadge = document.getElementById('admin-top-badge-req-count');
  if (topBadge) topBadge.textContent = total;

  let filtered = idCardRecords.filter(item => {
    const matchesFilter = (currentAdminFilter === 'all') || (item.status === currentAdminFilter);
    const matchesUnit = (selectedUnit === 'all') || (item.bidang === selectedUnit);
    const matchesSearch = !search ||
      item.id.toLowerCase().includes(search) ||
      item.name.toLowerCase().includes(search) ||
      item.nip.toLowerCase().includes(search) ||
      item.bidang.toLowerCase().includes(search) ||
      item.jabatan.toLowerCase().includes(search);

    return matchesFilter && matchesUnit && matchesSearch;
  });

  tbody.innerHTML = '';

  if (filtered.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  } else {
    if (emptyState) emptyState.classList.add('hidden');
  }

  filtered.forEach(record => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';

    const hasPhoto = Boolean(record.photo && record.photoReady === 'ready');
    const photoMarkup = hasPhoto
      ? `<img src="${record.photo}" alt="${record.name}" class="w-10 h-10 rounded-xl object-contain bg-slate-100 border border-slate-200 shadow-xs flex-shrink-0">`
      : `<div class="w-10 h-10 rounded-xl bg-slate-100 border border-dashed border-slate-300 flex-shrink-0 flex flex-col items-center justify-center text-slate-400" title="Foto belum diunggah">
           <i class="fa-solid fa-user text-xs text-slate-400"></i>
           <span class="text-[7.5px] font-bold text-slate-500 leading-none mt-0.5">No Foto</span>
         </div>`;

    tr.innerHTML = `
      <td class="py-3.5 px-4 sm:px-6 align-middle font-mono font-bold text-xs text-emerald-800 whitespace-nowrap">
        <div class="flex items-center space-x-1.5">
          <i class="fa-solid fa-ticket text-emerald-600"></i>
          <span>${record.id}</span>
        </div>
      </td>

      <td class="py-3.5 px-4 sm:px-6 align-middle">
        <div class="flex items-center space-x-3">
          ${photoMarkup}
          <div>
            <h4 class="font-bold text-slate-900 leading-tight">${record.name}</h4>
            <div class="flex items-center space-x-2 mt-0.5">
              <span class="text-xs text-slate-500 font-mono">NIP. ${record.nip}</span>
              ${!hasPhoto ? '<span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 flex items-center space-x-1"><i class="fa-solid fa-camera text-[8px]"></i><span>Foto Bag. Umum</span></span>' : ''}
            </div>
          </div>
        </div>
      </td>

      <td class="py-3.5 px-4 sm:px-6 align-middle">
        <p class="font-bold text-emerald-900 text-xs">${record.bidang}</p>
        <p class="text-xs text-slate-500 font-medium">${record.jabatan}</p>
      </td>

      <td class="py-3.5 px-4 sm:px-6 align-middle text-xs text-slate-500 whitespace-nowrap">
        ${record.createdAt}
      </td>

      <td class="py-3.5 px-4 sm:px-6 align-middle text-center whitespace-nowrap">
        <select onchange="handleAdminStatusChange('${record.id}', this.value)" class="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-600 shadow-xs cursor-pointer ${
          record.status === 'Selesai' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
          record.status === 'Sedang Dicetak' ? 'bg-sky-50 text-sky-800 border-sky-300' :
          'bg-amber-50 text-amber-800 border-amber-300'
        }">
          <option value="Menunggu Verifikasi" ${record.status === 'Menunggu Verifikasi' ? 'selected' : ''}>⏳ Belum Dikerjakan</option>
          <option value="Sedang Dicetak" ${record.status === 'Sedang Dicetak' ? 'selected' : ''}>🖨️ Sedang Dikerjakan</option>
          <option value="Selesai" ${record.status === 'Selesai' ? 'selected' : ''}>✅ Sudah Selesai</option>
        </select>
      </td>

      <td class="py-3.5 px-4 sm:px-6 align-middle text-center whitespace-nowrap">
        <div class="flex items-center justify-center space-x-1">
          <button type="button" onclick="openAdminEditModal('${record.id}')" class="p-2 rounded-xl text-slate-500 hover:text-amber-700 hover:bg-amber-50 text-xs transition" title="Edit Data Pegawai">
            <i class="fa-solid fa-user-pen"></i>
          </button>
          <button type="button" onclick="openAdminPrintModal('${record.id}')" class="p-2 rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 text-xs transition" title="Pratinjau & Cetak ID Card">
            <i class="fa-solid fa-print"></i>
          </button>
          <button type="button" onclick="handleAdminDeleteRecord('${record.id}')" class="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs transition" title="Hapus Permintaan">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function handleAdminStatusChange(id, newStatus) {
  const record = idCardRecords.find(r => r.id === id);
  if (!record) return;

  record.status = newStatus;
  saveDataToStorage();
  renderAdminTable();
  renderDashboardTable();
  showToast(`Status kartu ${id} diubah menjadi "${newStatus}"!`);
}

function handleAdminDeleteRecord(id) {
  const record = idCardRecords.find(r => r.id === id);
  if (!record) return;

  if (!confirm(`Hapus permohonan ID Card untuk ${record.name} (${record.id})?`)) return;

  idCardRecords = idCardRecords.filter(r => r.id !== id);
  saveDataToStorage();
  renderAdminTable();
  renderDashboardTable();
  showToast(`Permohonan ${id} berhasil dihapus.`);
}


// =============================================================
// ADMIN EDIT & ADD EMPLOYEE MODALS
// =============================================================

let adminEditPhotoData = null;

function openAdminEditModal(id) {
  const record = idCardRecords.find(r => r.id === id);
  if (!record) return;

  document.getElementById('admin-edit-id').value = record.id;
  document.getElementById('admin-edit-badge-id').textContent = record.id;
  document.getElementById('admin-edit-name').value = record.name;
  document.getElementById('admin-edit-nip').value = record.nip;
  document.getElementById('admin-edit-status').value = record.status;
  document.getElementById('admin-edit-jabatan').value = record.jabatan;
  document.getElementById('admin-edit-date').value = record.date || '2026-10-14';

  populateUnitDropdowns();
  document.getElementById('admin-edit-bidang').value = record.bidang;

  const photoPreview = document.getElementById('admin-edit-photo-preview');
  adminEditPhotoData = record.photo || null;
  if (record.photo) {
    photoPreview.src = record.photo;
  } else {
    photoPreview.src = 'assets/sample_pegawai_setengah_badan.png';
  }

  const fileInput = document.getElementById('admin-edit-photo-file');
  if (fileInput) {
    fileInput.value = '';
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (re) => {
          adminEditPhotoData = re.target.result;
          photoPreview.src = adminEditPhotoData;
        };
        reader.readAsDataURL(file);
      }
    };
  }

  document.getElementById('modal-admin-edit').classList.remove('hidden');
}

function closeAdminEditModal() {
  document.getElementById('modal-admin-edit').classList.add('hidden');
}

function handleAdminSaveEdit(e) {
  e.preventDefault();
  const id = document.getElementById('admin-edit-id').value;
  const record = idCardRecords.find(r => r.id === id);
  if (!record) return;

  record.name = document.getElementById('admin-edit-name').value.trim();
  record.nip = document.getElementById('admin-edit-nip').value.trim();
  record.status = document.getElementById('admin-edit-status').value;
  record.bidang = document.getElementById('admin-edit-bidang').value;
  record.jabatan = document.getElementById('admin-edit-jabatan').value.trim();
  record.date = document.getElementById('admin-edit-date').value || record.date;

  if (adminEditPhotoData) {
    record.photo = adminEditPhotoData;
    record.photoReady = 'ready';
  }

  saveDataToStorage();
  renderAdminTable();
  renderDashboardTable();
  closeAdminEditModal();
  showToast(`Data pegawai ${record.name} berhasil diperbarui!`);
}

let adminAddPhotoData = null;

function openAdminAddEmployeeModal() {
  populateUnitDropdowns();
  document.getElementById('admin-add-name').value = '';
  document.getElementById('admin-add-nip').value = '';
  document.getElementById('admin-add-jabatan').value = '';
  document.getElementById('admin-add-status').value = 'Sedang Dicetak';
  const fileInput = document.getElementById('admin-add-photo-file');
  if (fileInput) {
    fileInput.value = '';
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (re) => {
          adminAddPhotoData = re.target.result;
        };
        reader.readAsDataURL(file);
      }
    };
  }
  adminAddPhotoData = null;
  document.getElementById('modal-admin-add').classList.remove('hidden');
}

function closeAdminAddEmployeeModal() {
  document.getElementById('modal-admin-add').classList.add('hidden');
}

function handleAdminSubmitNewEmployee(e) {
  e.preventDefault();
  const name = document.getElementById('admin-add-name').value.trim();
  const nip = document.getElementById('admin-add-nip').value.trim();
  const jabatan = document.getElementById('admin-add-jabatan').value.trim();
  const bidang = document.getElementById('admin-add-bidang').value;
  const status = document.getElementById('admin-add-status').value;

  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const newRegId = `KMN-2026-${randomSuffix}`;

  const now = new Date();
  const formattedTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const newRecord = {
    id: newRegId,
    name,
    nip,
    bidang,
    jabatan,
    date: dateStr,
    photoReady: adminAddPhotoData ? 'ready' : 'not_ready',
    photo: adminAddPhotoData || null,
    status,
    createdAt: formattedTime
  };

  idCardRecords.unshift(newRecord);
  saveDataToStorage();
  renderAdminTable();
  renderDashboardTable();
  closeAdminAddEmployeeModal();
  showToast(`Permohonan ${newRegId} (${name}) berhasil ditambahkan!`);
}


// =============================================================
// PRINTING INTEGRATION (CR-80 DUAL-CARD BROWSER PRINT)
// =============================================================

function openAdminPrintModal(id) {
  const record = idCardRecords.find(r => r.id === id);
  if (!record) return;

  currentPrintingRecord = record;

  // Front Preview
  document.getElementById('print-modal-front-name').textContent = record.name.toUpperCase();
  document.getElementById('print-modal-front-nip').textContent = `NIP. ${record.nip}`;

  const frontPhoto = document.getElementById('print-modal-front-photo');
  if (record.photo) {
    frontPhoto.src = record.photo;
    frontPhoto.classList.remove('hidden');
  } else {
    frontPhoto.src = 'assets/sample_pegawai_setengah_badan.png';
  }

  // Back Preview
  document.getElementById('print-modal-back-name').textContent = record.name;
  document.getElementById('print-modal-back-nip').textContent = record.nip;
  document.getElementById('print-modal-back-jabatan').textContent = record.jabatan;
  document.getElementById('print-modal-back-bidang').textContent = record.bidang;
  document.getElementById('print-modal-back-date').textContent = `Banjarmasin, ${formatIndonesianDate(record.date || '2026-10-14')}`;

  // Dynamic Kepala on Back
  document.getElementById('print-modal-back-alamat1').textContent = cardBackSettings.alamat1;
  document.getElementById('print-modal-back-alamat2').textContent = cardBackSettings.alamat2;
  document.getElementById('print-modal-back-kepala-title').textContent = cardBackSettings.kepalaTitle;
  document.getElementById('print-modal-back-kepala-name').textContent = cardBackSettings.kepalaName;
  document.getElementById('print-modal-back-kepala-nip').textContent = `NIP. ${cardBackSettings.kepalaNip}`;

  document.getElementById('modal-admin-print').classList.remove('hidden');
}

function closeAdminPrintModal() {
  document.getElementById('modal-admin-print').classList.add('hidden');
}

function triggerCardPrint() {
  if (!currentPrintingRecord) return;
  const record = currentPrintingRecord;

  const printContainer = document.getElementById('print-container');
  if (!printContainer) return;

  const photoSrc = record.photo || 'assets/sample_pegawai_setengah_badan.png';

  printContainer.innerHTML = `
    <!-- FRONT CARD -->
    <div class="kemenag-card kemenag-card-front">
      <div class="kemenag-photo-layer">
        <img src="${photoSrc}" alt="${record.name}" class="kemenag-photo-img">
      </div>
      <div class="kemenag-wave-overlay"></div>
      <div class="kemenag-front-text">
        <h3 class="kemenag-front-name">${record.name.toUpperCase()}</h3>
        <p class="kemenag-front-nip">NIP. ${record.nip}</p>
      </div>
    </div>

    <!-- BACK CARD -->
    <div class="kemenag-card kemenag-card-back">
      <div class="kemenag-back-content">
        <p class="back-text-item back-label-gap uppercase">NAMA</p>
        <p class="back-text-item back-section-gap font-bold">${record.name}</p>

        <p class="back-text-item back-label-gap uppercase">NIP</p>
        <p class="back-text-item back-section-gap font-mono">${record.nip}</p>

        <p class="back-text-item back-label-gap uppercase">JABATAN</p>
        <p class="back-text-item">${record.jabatan}</p>
        <p class="back-text-item back-section-gap">${record.bidang}</p>

        <p class="back-text-item back-label-gap uppercase">ALAMAT KANTOR</p>
        <p class="back-text-item">${cardBackSettings.alamat1}</p>
        <p class="back-text-item back-section-gap">${cardBackSettings.alamat2}</p>

        <p class="back-text-item back-section-gap">Banjarmasin, ${formatIndonesianDate(record.date || '2026-10-14')}</p>

        <p class="back-kepala-title">${cardBackSettings.kepalaTitle}</p>
        <p class="back-kepala-name">${cardBackSettings.kepalaName}</p>
        <p class="back-kepala-nip">NIP. ${cardBackSettings.kepalaNip}</p>
      </div>
    </div>
  `;

  window.print();
}

