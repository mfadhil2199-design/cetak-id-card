# Portal Cetak ID Card Pegawai - Kanwil Kemenag Prov. Kalimantan Selatan

Aplikasi web modern untuk permohonan, pengelolaan, dan pencetakan ID Card Pegawai **Kantor Wilayah Kementerian Agama Provinsi Kalimantan Selatan**, dilengkapi **Fitur Hapus Background Foto Otomatis (Smart Background Removal)**, **Panel Khusus Administrator**, pelacakan status audiens, dan kartu presisi standar internasional (**CR-80: 54 mm x 85.6 mm**).

---

## 🌟 Fitur Baru & Pembaruan Sistem

### 1. 🔐 Panel Admin & Autentikasi (Default: `admin` / `admin`)
- **Tombol Admin di Navbar**: Terdapat tombol login admin di pojok kanan atas navbar.
- **Autentikasi Aman**: Masuk menggunakan kredensial bawaan:
  - **Username**: `admin`
  - **Password**: `admin`
- **Tampilan Khusus Administrator**: Setelah login, pengguna diarahkan ke antarmuka **Panel Admin** lengkap dengan tab navigasi khusus:
  - **Daftar Permintaan ID Card & Status Pengerjaan**
  - **Kelola Pilihan Dropdown Unit Kerja / Bidang**
  - **Pengaturan Tampak Belakang Kartu (Nama Kepala, NIP & Alamat)**
- **Tombol Logout**: Petugas dapat keluar dari sesi admin kapan saja dengan tombol "Keluar".

### 2. ⚡ Pengaturan Status Permintaan Kartu Langsung
- Petugas dapat mengubah status kartu secara langsung melalui dropdown pada tabel admin:
  - **⏳ Belum Dikerjakan** (`Menunggu Verifikasi`)
  - **🖨️ Sedang Dikerjakan** (`Sedang Dicetak`)
  - **✅ Sudah Selesai** (`Selesai`)
- Perubahan status **otomatis tersimpan secara instan** di `localStorage` dan langsung diperbarui pada Dashboard Publik audiens secara real-time.
- Tersedia fitur **Filter Cepat Status**, **Pencarian**, dan **Filter per Unit Kerja**.

### 3. ✍️ Edit & Tambah Pegawai Manual
- **Edit Data Pegawai**: Petugas admin dapat memperbaiki data permohonan pegawai (Nama, NIP, Jabatan, Unit Kerja, status, hingga ganti file foto).
- **Tambah Pegawai Manual**: Petugas dapat menginput langsung pemohon baru tanpa harus melalui formulir publik.

### 4. 🏢 Kelola Dropdown Unit Kerja / Bidang
- Petugas admin dapat **menambahkan unit kerja baru**, **mengubah nama unit kerja**, atau **menghapus unit kerja**.
- Pilihan unit kerja yang ditambahkan langsung aktif dan otomatis muncul pada dropdown formulir pendaftaran pemohon serta filter data.
- Dilengkapi tombol **"Reset ke 14 Unit Kerja Standar"** untuk mengembalikan daftar unit resmi bawaan Kanwil Kemenag Kalsel.

### 5. 🔏 Pengaturan Informasi Tampak Belakang Kartu (Dinamis & Presisi)
- Petugas admin dapat menyesuaikan:
  - **Nama Kepala Kantor Wilayah** (beserta gelar akademik/keagamaan resmi)
  - **NIP Kepala Kanwil**
  - **Jabatan Penandatangan** (default: `KEPALA`)
  - **Alamat Kantor Wilayah** (Baris 1 & Baris 2)
- Dilengkapi **Live Mini Preview Tampak Belakang** yang memperlihatkan hasil layout secara langsung saat petugas mengetik.
- Template latar belakang telah disesuaikan secara presisi sehingga **tanda tangan dan cap stempel ungu resmi tetap utuh**, sementara teks nama dan NIP Kepala Kanwil ter-render dinamis dengan font resmi Roboto.

### 6. 🛡️ Validasi Data Input Real-time
- **NIP Wajib Angka (Numeric-Only)**:
  - Kolom NIP hanya mengizinkan input angka (karakter huruf dan simbol ditolak otomatis).
  - Terdapat indikator real-time counter digit (`[X]/18 Digit`).
  - Memberikan feedback visual jika belum mencapai 18 digit atau sudah lengkap.
- **Validasi Nama Pegawai**: Memastikan format nama dan gelar terisi dengan benar.

### 7. 🖨️ Pratinjau & Cetak ID Card (CR-80 Dual-Card)
- Petugas admin dapat mengklik tombol **Cetak Kartu** untuk melihat pratinjau dua sisi (Tampak Depan & Tampak Belakang) berskala standar CR-80.
- Tombol **"Cetak Kartu Sekarang"** langsung mengaktifkan dialog print browser dengan pengaturan khusus cetak PVC/kertas A4 tanpa margin berlebih (`@media print`).

### 8. ☁️ Integrasi Backend Google Apps Script & Google Sheets
- **URL Web App**: Terhubung langsung ke endpoint Google Apps Script:
  `https://script.google.com/macros/s/AKfycbyPNEKuUv3hIn6LJKjCX_F7EzCpWPRMcIMt85qkA2r4aenQ8ApKi7RbFs9nOHFCtKa3ug/exec`
- **Penyimpanan Dua Arah (Two-Way Sync)**:
  - Setiap kali ada pegawai mengisi formulir atau admin menambah pegawai, data **otomatis dikirim ke Google Sheets**.
  - Foto pegawai disimpan langsung ke **Google Drive** dan tautan filenya dicatat rapi di Google Sheets.
  - Perubahan status dari admin langsung memperbarui baris status di Google Sheets.
- **Dukungan Offline / Resilient**:
  - Jika internet lambat atau backend Google Apps Script sedang tidak dapat dijangkau, website tetap berfungsi 100% menggunakan cache browser `localStorage`.
- **Kode Skrip Siap Pakai**: Seluruh logika Google Apps Script telah disediakan di file [`GoogleAppsScript_Code.gs`](file:///c:/Users/Muhammad%20Fadhil/Downloads/cetak-id-card/GoogleAppsScript_Code.gs).

---

## 🚀 Cara Menjalankan Website

1. Buka folder: `c:\Users\Muhammad Fadhil\Downloads\cetak-id-card`
2. Klik ganda file **`BUKA_WEBSITE.bat`** atau klik ganda langsung file **`index.html`**.
3. Website akan langsung terbuka di browser Anda (100% offline, tanpa instalasi server tambahan).

---

## 🔑 Kredensial Login Administrator
- **URL / Navigasi**: Klik tombol **Admin** di pojok kanan atas Navbar
- **Username**: `admin`
- **Password**: `admin`

---

## 📋 Panduan Penerapan Google Apps Script (`GoogleAppsScript_Code.gs`)

1. Buka Google Spreadsheet tujuan Anda (atau buat baru di https://sheets.new).
2. Klik menu **Ekstensi (Extensions)** > **Apps Script**.
3. Buka file **[`GoogleAppsScript_Code.gs`](file:///c:/Users/Muhammad%20Fadhil/Downloads/cetak-id-card/GoogleAppsScript_Code.gs)** di folder proyek ini, salin seluruh kodenya, dan gantikan isi `Code.gs` di editor Google Apps Script.
4. Klik tombol **Simpan** (ikon disket / `Ctrl + S`).
5. Klik tombol biru **Terapkan (Deploy)** di pojok kanan atas > pilih **Kelola penerapan (Manage deployments)**.
6. Klik ikon **Pensil (Edit)** pada penerapan Web App Anda:
   - Pada kolom **Versi**, pilih **"Versi Baru" (New Version)**.
   - Pada kolom **Akses (Who has access)**, pastikan dipilih **"Siapa saja" (Anyone)**.
7. Klik **Terapkan (Deploy)**. Selesai! Endpoint Anda kini aktif melayani `doGet` dan `doPost`.
