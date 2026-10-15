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
