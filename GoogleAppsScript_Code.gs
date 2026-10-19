/**
 * ============================================================================
 * BACKEND GOOGLE APPS SCRIPT (Code.gs)
 * Aplikasi : CetakID Kemenag – Sistem Layanan Mandiri & Pengelolaan ID Card
 * Instansi : Kanwil Kementerian Agama Provinsi Kalimantan Selatan
 * ============================================================================
 *
 * PANDUAN DEPLOYMENT:
 * 1. Buka Google Spreadsheet Anda (https://sheets.new).
 * 2. Klik menu "Ekstensi" (Extensions) > "Apps Script".
 * 3. Hapus seluruh kode yang ada, lalu tempelkan (Paste) kode ini ke `Code.gs`.
 * 4. Tekan Ctrl+S (Simpan). Opsional: Jalankan fungsi `setupDatabase()` sekali
 *    dari toolbar atas untuk langsung membuat ke-3 Tab beserta data awalnya,
 *    atau biarkan skrip membuatnya otomatis saat pertama kali diakses.
 * 5. Klik tombol "Terapkan" (Deploy) > "Deployment baru" (New deployment) atau
 *    "Kelola deployment" (Manage deployments) > Edit > "Versi baru" (New version).
 * 6. Pastikan "Jalankan sebagai" (Execute as) = "Saya" (Me) dan
 *    "Siapa yang memiliki akses" (Who has access) = "Siapa saja" (Anyone).
 * 7. Salin URL Web App (`https://script.google.com/macros/s/.../exec`) ke
 *    konstanta `WEB_APP_URL` di file `app.js`.
 * ============================================================================
 */

// Opsional: Isi dengan ID Folder Google Drive jika ingin menyimpan foto ke folder tertentu.
// Jika dikosongkan (""), sistem tetap dapat menyimpan Base64 Data URL secara langsung
// atau membuat folder otomatis jika ukuran Base64 melebihi batas sel Google Sheets.
const FOLDER_ID = "";
const DRIVE_FOLDER_NAME = "Foto_CetakID_Kemenag_Kalsel";

// Nama ke-3 Tab (Sheet) sesuai spesifikasi PRD
const TAB_ANTREAN = "Sheet1";
const TAB_PENGATURAN = "Pengaturan";
const TAB_ADMIN = "Admin";

// Pola validasi NIP 18 digit numerik
const NIP_REGEX = /^[0-9]{18}$/;

/**
 * Fungsi inisialisasi manual maupun otomatis untuk memastikan ke-3 tab
 * (Sheet1, Pengaturan, Admin) tersedia beserta nilai default-nya.
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  getOrCreateAntreanSheet(ss);
  getOrCreatePengaturanSheet(ss);
  getOrCreateAdminSheet(ss);
  return "Basis data 3 Tab (Sheet1, Pengaturan, Admin) berhasil disiapkan.";
}

/**
 * ============================================================================
 * 5.1 ENDPOINT doGet(e)
 * Mengambil seluruh daftar antrean dari `Sheet1` serta data konfigurasi publik
 * dari tab `Pengaturan` (tanpa membocorkan tab `Admin`).
 * Mengembalikan respons JSON: { status: "success", data: [...], config: {...} }
 * ============================================================================
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetAntrean = getOrCreateAntreanSheet(ss);
    const sheetPengaturan = getOrCreatePengaturanSheet(ss);
    // Pastikan tab Admin juga terinisialisasi di spreadsheet namun TIDAK dikirim di doGet
    getOrCreateAdminSheet(ss);

    const data = readAntreanData(sheetAntrean);
    const config = readPengaturanData(sheetPengaturan);

    return createJsonResponse({
      status: "success",
      data: data,
      config: config
    });
  } catch (error) {
    return createJsonResponse({
      status: "error",
      message: "Gagal memuat data: " + error.toString()
    });
  }
}

/**
 * ============================================================================
 * 5.2 ENDPOINT doPost(e) Berdasarkan Parameter `action`
 * Mendukung header "Content-Type": "text/plain;charset=utf-8" (Anti-CORS GAS)
 * Actions:
 *   1. "create"       - Pengajuan baru dari pegawai / admin
 *   2. "update"       - Edit biodata pegawai, foto, atau status cetak
 *   3. "delete"       - Hapus baris pengajuan berdasarkan nomor tiket
 *   4. "login"        - Autentikasi akun petugas pada tab Admin
 *   5. "save_config"  - Simpan konfigurasi pimpinan & template ke tab Pengaturan
 *   6. "manage_admin" - Tambah admin, ganti password, aktif/nonaktifkan, hapus admin
 * ============================================================================
 */
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = sanitizeText(payload.action || "create");
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ------------------------------------------------------------------------
    // 1. ACTION: "create" (Menerima pengajuan baru dari pegawai)
    // ------------------------------------------------------------------------
    if (action === "create") {
      const sheet = getOrCreateAntreanSheet(ss);

      const tiket = sanitizeText(payload.tiket || payload.id) || generateTicketCode();
      const tanggal = sanitizeText(payload.tanggal || payload.date) || getTodayDateString();
      const nama = sanitizeText(payload.nama || payload.name);
      const nip = sanitizeText(payload.nip).replace(/^'/, "");
      const no_hp = sanitizeText(payload.no_hp || payload.whatsapp || payload.noHp).replace(/^'/, "");
      const unitKerja = sanitizeText(payload.unitKerja || payload.bidang);
      const jabatan = sanitizeText(payload.jabatan);
      const rawFoto = payload.foto || payload.photo || "assets/default-avatar.png";
      const status = sanitizeText(payload.status) || "Menunggu Verifikasi";

      // Validasi kelengkapan kolom wajib
      if (!nama || !nip || !unitKerja || !jabatan) {
        return createJsonResponse({
          status: "error",
          message: "Seluruh kolom wajib (Nama Lengkap, NIP, Unit Kerja, dan Jabatan) harus diisi."
        });
      }

      // Validasi NIP wajib 18 digit angka
      if (!NIP_REGEX.test(nip)) {
        return createJsonResponse({
          status: "error",
          message: "Format NIP tidak valid! NIP wajib berupa angka numerik tepat 18 digit."
        });
      }

      // Proses foto (unggah ke Google Drive jika FOLDER_ID diatur atau jika ukuran > 45KB)
      const finalFoto = processPhotoStorage(rawFoto, nama, nip);

      // Simpan ke Sheet1 tanpa menggeser struktur Kolom A - H yang sudah ada,
      // serta mencatat kolom kontak (no_hp) pada Kolom I:
      // A: tiket | B: tanggal | C: nama | D: nip | E: unitKerja | F: jabatan | G: foto | H: status | I: no_hp
      sheet.appendRow([
        tiket,
        tanggal,
        nama,
        "'" + nip,
        unitKerja,
        jabatan,
        finalFoto,
        status,
        no_hp ? "'" + no_hp : ""
      ]);

      return createJsonResponse({
        status: "success",
        message: "Pengajuan ID Card berhasil disimpan.",
        data: {
          tiket: tiket,
          tanggal: tanggal,
          nama: nama,
          nip: nip,
          no_hp: no_hp,
          whatsapp: no_hp,
          unitKerja: unitKerja,
          jabatan: jabatan,
          foto: finalFoto,
          status: status
        }
      });
    }

    // ------------------------------------------------------------------------
    // 2. ACTION: "update" / "update_status" (Memperbarui biodata / status)
    // ------------------------------------------------------------------------
    if (action === "update" || action === "update_status") {
      const sheet = getOrCreateAntreanSheet(ss);
      const targetTiket = sanitizeText(payload.tiket || payload.id);

      if (!targetTiket) {
        return createJsonResponse({
          status: "error",
          message: "Nomor tiket wajib disertakan untuk pembaruan data."
        });
      }

      const rows = sheet.getDataRange().getValues();
      let foundRowIndex = -1;
      let existingRow = null;

      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === targetTiket) {
          foundRowIndex = i + 1; // 1-indexed di Google Sheets
          existingRow = rows[i];
          break;
        }
      }

      if (foundRowIndex === -1) {
        return createJsonResponse({
          status: "error",
          message: "Data dengan Nomor Tiket " + targetTiket + " tidak ditemukan."
        });
      }

      // Jika hanya mengubah status cetak
      if (action === "update_status" || (payload.status && !payload.nama && !payload.name && !payload.nip)) {
        const newStatus = sanitizeText(payload.status) || String(existingRow[7] || "Menunggu Verifikasi");
        sheet.getRange(foundRowIndex, 8).setValue(newStatus);
        return createJsonResponse({
          status: "success",
          message: "Status cetak berhasil diperbarui menjadi: " + newStatus,
          tiket: targetTiket,
          newStatus: newStatus
        });
      }

      // Pembaruan biodata lengkap dari Modal Edit Admin
      const tanggal = sanitizeText(payload.tanggal || payload.date) || formatDateValue(existingRow[1]);
      const nama = sanitizeText(payload.nama || payload.name) || String(existingRow[2] || "");
      const nip = sanitizeText(payload.nip || String(existingRow[3] || "")).replace(/^'/, "");
      const unitKerja = sanitizeText(payload.unitKerja || payload.bidang) || String(existingRow[4] || "");
      const jabatan = sanitizeText(payload.jabatan) || String(existingRow[5] || "");
      const status = sanitizeText(payload.status) || String(existingRow[7] || "Menunggu Verifikasi");
      const no_hp = sanitizeText(
        payload.no_hp !== undefined ? payload.no_hp :
        payload.whatsapp !== undefined ? payload.whatsapp :
        String(existingRow[8] || "")
      ).replace(/^'/, "");

      if (!NIP_REGEX.test(nip)) {
        return createJsonResponse({
          status: "error",
          message: "Format NIP tidak valid! NIP wajib berupa 18 digit angka."
        });
      }

      let finalFoto = String(existingRow[6] || "assets/default-avatar.png");
      const incomingFoto = payload.foto || payload.photo;
      if (incomingFoto && incomingFoto !== finalFoto) {
        finalFoto = processPhotoStorage(incomingFoto, nama, nip);
      }

      // Update kolom B sampai I (Kolom 2 s.d. 9) tanpa menggeser Kolom A - H
      sheet.getRange(foundRowIndex, 2, 1, 8).setValues([[
        tanggal,
        nama,
        "'" + nip,
        unitKerja,
        jabatan,
        finalFoto,
        status,
        no_hp ? "'" + no_hp : ""
      ]]);

      return createJsonResponse({
        status: "success",
        message: "Biodata dan status pegawai berhasil diperbarui.",
        data: {
          tiket: targetTiket,
          tanggal: tanggal,
          nama: nama,
          nip: nip,
          no_hp: no_hp,
          whatsapp: no_hp,
          unitKerja: unitKerja,
          jabatan: jabatan,
          foto: finalFoto,
          status: status
        }
      });
    }

    // ------------------------------------------------------------------------
    // 3. ACTION: "delete" (Menghapus baris pengajuan berdasarkan nomor tiket)
    // ------------------------------------------------------------------------
    if (action === "delete") {
      const sheet = getOrCreateAntreanSheet(ss);
      const targetTiket = sanitizeText(payload.tiket || payload.id);

      if (!targetTiket) {
        return createJsonResponse({
          status: "error",
          message: "Nomor tiket wajib disertakan untuk menghapus data."
        });
      }

      const rows = sheet.getDataRange().getValues();
      let deleted = false;

      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === targetTiket) {
          sheet.deleteRow(i + 1);
          deleted = true;
          break;
        }
      }

      return createJsonResponse({
        status: deleted ? "success" : "error",
        message: deleted
          ? "Data pengajuan " + targetTiket + " berhasil dihapus."
          : "Nomor tiket " + targetTiket + " tidak ditemukan di basis data."
      });
    }

    // ------------------------------------------------------------------------
    // 4. ACTION: "login" (Verifikasi kredensial pada tab Admin)
    // ------------------------------------------------------------------------
    if (action === "login") {
      const sheetAdmin = getOrCreateAdminSheet(ss);
      const username = sanitizeText(payload.username);
      const password = String(payload.password || "").trim();

      if (!username || !password) {
        return createJsonResponse({
          status: "error",
          message: "Username dan password wajib diisi."
        });
      }

      const rows = sheetAdmin.getDataRange().getValues();
      let matchedAdmin = null;

      for (let i = 1; i < rows.length; i++) {
        const rowId = String(rows[i][0] || "").trim();
        const rowUser = String(rows[i][1] || "").trim();
        const rowPass = String(rows[i][2] || "").trim();
        const rowNama = String(rows[i][3] || "").trim();
        const rowRole = String(rows[i][4] || "Operator").trim();
        const rowStatus = String(rows[i][5] || "Aktif").trim();

        if (rowUser.toLowerCase() === username.toLowerCase() && rowPass === password) {
          if (rowStatus.toLowerCase() !== "aktif") {
            return createJsonResponse({
              status: "error",
              message: "Akun petugas ini telah dinonaktifkan. Hubungi Superadmin."
            });
          }
          matchedAdmin = {
            id_admin: rowId,
            username: rowUser,
            nama_petugas: rowNama,
            role: rowRole,
            status_aktif: rowStatus
          };
          break;
        }
      }

      if (!matchedAdmin) {
        return createJsonResponse({
          status: "error",
          message: "Username atau kata sandi tidak valid!"
        });
      }

      return createJsonResponse({
        status: "success",
        message: "Login berhasil. Selamat datang, " + matchedAdmin.nama_petugas + "!",
        user: matchedAdmin,
        admins: getSanitizedAdminList(sheetAdmin)
      });
    }

    // ------------------------------------------------------------------------
    // 5. ACTION: "save_config" (Simpan pengaturan pimpinan & template kartu)
    // ------------------------------------------------------------------------
    if (action === "save_config") {
      const sheetPengaturan = getOrCreatePengaturanSheet(ss);
      const configUpdates = payload.config || payload;

      const allowedKeys = [
        "nama_pimpinan",
        "nip_pimpinan",
        "jabatan_pimpinan",
        "ttd_pimpinan_url",
        "masa_berlaku",
        "template_aktif",
        "opsi_cetak",
        "rasio_foto",
        "bg_depan_url",
        "bg_belakang_url",
        "aturan_kartu",
        "alamat_kantor_1",
        "alamat_kantor_2",
        "unit_kerja_list"
      ];

      // Validasi NIP Pimpinan jika disertakan
      if (configUpdates.nip_pimpinan !== undefined) {
        const cleanNipPimpinan = sanitizeText(configUpdates.nip_pimpinan).replace(/^'/, "");
        if (cleanNipPimpinan && !NIP_REGEX.test(cleanNipPimpinan)) {
          return createJsonResponse({
            status: "error",
            message: "NIP Pimpinan harus terdiri dari tepat 18 digit angka."
          });
        }
      }

      const dataRange = sheetPengaturan.getDataRange().getValues();
      const keyRowMap = {};
      for (let i = 1; i < dataRange.length; i++) {
        const k = String(dataRange[i][0] || "").trim();
        if (k) keyRowMap[k] = i + 1;
      }

      allowedKeys.forEach(function(key) {
        if (configUpdates[key] !== undefined) {
          let val = String(configUpdates[key]);
          if (key !== "ttd_pimpinan_url" && key !== "bg_depan_url" && key !== "bg_belakang_url") {
            val = val.trim();
          }
          if (key === "nip_pimpinan" && val && !val.startsWith("'")) {
            val = "'" + val;
          }

          if (keyRowMap[key]) {
            sheetPengaturan.getRange(keyRowMap[key], 2).setValue(val);
          } else {
            sheetPengaturan.appendRow([key, val, "Konfigurasi dinamis sistem"]);
          }
        }
      });

      const updatedConfig = readPengaturanData(sheetPengaturan);
      return createJsonResponse({
        status: "success",
        message: "Pengaturan Pimpinan & Template Kartu berhasil disimpan ke Google Sheets.",
        config: updatedConfig
      });
    }

    // ------------------------------------------------------------------------
    // 6. ACTION: "manage_admin" (Kelola akun petugas di tab Admin)
    // ------------------------------------------------------------------------
    if (action === "manage_admin") {
      const sheetAdmin = getOrCreateAdminSheet(ss);
      const subAction = sanitizeText(payload.sub_action || "list");
      const rows = sheetAdmin.getDataRange().getValues();

      // 6a. Ambil daftar admin (tanpa password)
      if (subAction === "list") {
        return createJsonResponse({
          status: "success",
          admins: getSanitizedAdminList(sheetAdmin)
        });
      }

      // 6b. Ganti Password Admin Aktif
      if (subAction === "change_password") {
        const username = sanitizeText(payload.username);
        const oldPassword = String(payload.old_password || "").trim();
        const newPassword = String(payload.new_password || "").trim();

        if (!username || !newPassword || newPassword.length < 6) {
          return createJsonResponse({
            status: "error",
            message: "Kata sandi baru minimal harus 6 karakter."
          });
        }

        for (let i = 1; i < rows.length; i++) {
          const rowUser = String(rows[i][1] || "").trim();
          const rowPass = String(rows[i][2] || "").trim();
          if (rowUser.toLowerCase() === username.toLowerCase()) {
            if (oldPassword && rowPass !== oldPassword) {
              return createJsonResponse({
                status: "error",
                message: "Kata sandi lama yang Anda masukkan tidak sesuai."
              });
            }
            sheetAdmin.getRange(i + 1, 3).setValue(newPassword);
            return createJsonResponse({
              status: "success",
              message: "Kata sandi untuk akun @" + rowUser + " berhasil diperbarui."
            });
          }
        }

        return createJsonResponse({
          status: "error",
          message: "Akun petugas tidak ditemukan."
        });
      }

      // 6c. Tambah Admin Baru (Khusus Superadmin)
      if (subAction === "add") {
        const newUsername = sanitizeText(payload.username).toLowerCase();
        const newPassword = String(payload.password || "").trim();
        const namaPetugas = sanitizeText(payload.nama_petugas);
        const role = sanitizeText(payload.role) === "Superadmin" ? "Superadmin" : "Operator";

        if (!newUsername || !newPassword || !namaPetugas) {
          return createJsonResponse({
            status: "error",
            message: "Nama Petugas, Username, dan Password wajib diisi."
          });
        }

        // Cek duplikasi username
        for (let i = 1; i < rows.length; i++) {
          if (String(rows[i][1] || "").trim().toLowerCase() === newUsername) {
            return createJsonResponse({
              status: "error",
              message: "Username '" + newUsername + "' sudah digunakan. Pilih username lain."
            });
          }
        }

        const nextNum = rows.length;
        const newId = "ADM-" + String(nextNum < 10 ? "0" + nextNum : nextNum) + "-" + Math.floor(10 + Math.random() * 89);

        sheetAdmin.appendRow([
          newId,
          newUsername,
          newPassword,
          namaPetugas,
          role,
          "Aktif"
        ]);

        return createJsonResponse({
          status: "success",
          message: "Akun petugas " + namaPetugas + " (" + role + ") berhasil ditambahkan.",
          admins: getSanitizedAdminList(sheetAdmin)
        });
      }

      // 6d. Nonaktifkan / Aktifkan Admin
      if (subAction === "toggle_status") {
        const targetId = sanitizeText(payload.id_admin);
        const targetUsername = sanitizeText(payload.username);

        for (let i = 1; i < rows.length; i++) {
          const rowId = String(rows[i][0] || "").trim();
          const rowUser = String(rows[i][1] || "").trim();
          if ((targetId && rowId === targetId) || (targetUsername && rowUser === targetUsername)) {
            const currentStatus = String(rows[i][5] || "Aktif").trim();
            const nextStatus = currentStatus === "Aktif" ? "Nonaktif" : "Aktif";
            sheetAdmin.getRange(i + 1, 6).setValue(nextStatus);
            return createJsonResponse({
              status: "success",
              message: "Status akun @" + rowUser + " diubah menjadi " + nextStatus + ".",
              admins: getSanitizedAdminList(sheetAdmin)
            });
          }
        }

        return createJsonResponse({
          status: "error",
          message: "Akun petugas tidak ditemukan."
        });
      }

      // 6e. Hapus Akun Admin
      if (subAction === "delete") {
        const targetId = sanitizeText(payload.id_admin);
        const targetUsername = sanitizeText(payload.username);

        if (rows.length <= 2) {
          return createJsonResponse({
            status: "error",
            message: "Tidak dapat menghapus satu-satunya akun Admin utama."
          });
        }

        for (let i = 1; i < rows.length; i++) {
          const rowId = String(rows[i][0] || "").trim();
          const rowUser = String(rows[i][1] || "").trim();
          if ((targetId && rowId === targetId) || (targetUsername && rowUser === targetUsername)) {
            sheetAdmin.deleteRow(i + 1);
            return createJsonResponse({
              status: "success",
              message: "Akun petugas @" + rowUser + " berhasil dihapus.",
              admins: getSanitizedAdminList(sheetAdmin)
            });
          }
        }

        return createJsonResponse({
          status: "error",
          message: "Akun petugas tidak ditemukan."
        });
      }
    }

    return createJsonResponse({
      status: "error",
      message: "Action tidak dikenali: " + action
    });

  } catch (error) {
    return createJsonResponse({
      status: "error",
      message: "Kesalahan server: " + error.toString()
    });
  }
}

/**
 * ============================================================================
 * HELPER INISIALISASI & PEMBACAAN KE-3 TAB GOOGLE SHEETS
 * ============================================================================
 */

function getOrCreateAntreanSheet(ss) {
  let sheet = ss.getSheetByName(TAB_ANTREAN);
  if (!sheet) {
    sheet = ss.insertSheet(TAB_ANTREAN);
  }

  if (sheet.getLastRow() === 0) {
    const headers = [
      "tiket",
      "tanggal",
      "nama",
      "nip",
      "unitKerja",
      "jabatan",
      "foto",
      "status",
      "no_hp"
    ];
    sheet.appendRow(headers);
    styleSheetHeader(sheet, headers.length);

    sheet.appendRow([
      "KMN-2026-7846",
      "2026-10-15",
      "Rahmat Hidayat, S.Kom, M.M.",
      "'198804122014021003",
      "Sub Bagian Perencanaan, Data & Informasi",
      "Pranata Komputer Ahli Muda",
      "assets/sample_pegawai_setengah_badan.png",
      "Selesai",
      "'081251123456"
    ]);
  } else {
    // Pastikan Kolom I (no_hp) memiliki header jika sheet dibuat pada versi sebelumnya tanpa menggeser Kolom A - H
    const col9Header = String(sheet.getRange(1, 9).getValue() || "").trim();
    if (!col9Header) {
      sheet.getRange(1, 9).setValue("no_hp");
      styleSheetHeader(sheet, 9);
    }
  }

  return sheet;
}

function getOrCreatePengaturanSheet(ss) {
  let sheet = ss.getSheetByName(TAB_PENGATURAN);
  if (!sheet) {
    sheet = ss.insertSheet(TAB_PENGATURAN);
  }

  if (sheet.getLastRow() === 0) {
    const headers = ["key", "value", "keterangan"];
    sheet.appendRow(headers);
    styleSheetHeader(sheet, headers.length);

    const defaultConfigs = [
      ["nama_pimpinan", "Dr. H. Muhammad Tambrin, M.M.Pd.", "Nama pejabat penandatangan kartu"],
      ["nip_pimpinan", "'196705121994031002", "NIP pejabat penandatangan"],
      ["jabatan_pimpinan", "Kepala Kantor Wilayah", "Jabatan pejabat penandatangan"],
      ["ttd_pimpinan_url", "", "Gambar tanda tangan & stempel transparan (Base64/URL)"],
      ["masa_berlaku", "Selama Menjadi Pegawai", "Masa berlaku kartu identitas"],
      ["template_aktif", "template_1", "Kode tema desain kartu yang aktif (template_1, template_2, template_3)"],
      ["opsi_cetak", "2_sisi", "Mode pencetakan kartu (1_sisi atau 2_sisi)"],
      ["rasio_foto", "3:4", "Rasio proporsional pasfoto (3:4 atau 1:1)"],
      ["bg_depan_url", "", "Gambar latar depan kustom (opsional)"],
      ["bg_belakang_url", "", "Gambar latar belakang kustom (opsional)"],
      ["aturan_kartu", "", "Teks ketentuan di sisi belakang kartu"],
      ["alamat_kantor_1", "Jl. D.I. Panjaitan", "Alamat kantor baris 1"],
      ["alamat_kantor_2", "No. 19 Banjarmasin", "Alamat kantor baris 2"]
    ];

    sheet.getRange(2, 1, defaultConfigs.length, 3).setValues(defaultConfigs);
    sheet.autoResizeColumns(1, 3);
  }

  return sheet;
}

function getOrCreateAdminSheet(ss) {
  let sheet = ss.getSheetByName(TAB_ADMIN);
  if (!sheet) {
    sheet = ss.insertSheet(TAB_ADMIN);
  }

  if (sheet.getLastRow() === 0) {
    const headers = [
      "id_admin",
      "username",
      "password",
      "nama_petugas",
      "role",
      "status_aktif"
    ];
    sheet.appendRow(headers);
    styleSheetHeader(sheet, headers.length);

    sheet.appendRow([
      "ADM-01",
      "admin",
      "kemenag2026",
      "Administrator Utama",
      "Superadmin",
      "Aktif"
    ]);
    sheet.autoResizeColumns(1, headers.length);
  }

  return sheet;
}

function readAntreanData(sheet) {
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;

    const tiket = String(row[0] || "").trim();
    const tanggal = formatDateValue(row[1]);
    const nama = String(row[2] || "").trim();
    const nip = String(row[3] || "").replace(/^'/, "").trim();
    const unitKerja = String(row[4] || "").trim();
    const jabatan = String(row[5] || "").trim();
    const foto = String(row[6] || "assets/default-avatar.png").trim();
    const status = String(row[7] || "Menunggu Verifikasi").trim();
    const no_hp = String(row[8] || "").replace(/^'/, "").trim();

    records.push({
      tiket: tiket,
      tanggal: tanggal,
      nama: nama,
      nip: nip,
      no_hp: no_hp,
      whatsapp: no_hp,
      unitKerja: unitKerja,
      jabatan: jabatan,
      foto: foto,
      status: status,
      id: tiket,
      date: tanggal,
      name: nama,
      bidang: unitKerja,
      photo: foto,
      photoReady: (foto && foto !== "assets/default-avatar.png") ? "ready" : "not_ready",
      createdAt: tanggal
    });
  }

  return records;
}

function readPengaturanData(sheet) {
  const rows = sheet.getDataRange().getValues();
  const config = {
    nama_pimpinan: "Dr. H. Muhammad Tambrin, M.M.Pd.",
    nip_pimpinan: "196705121994031002",
    jabatan_pimpinan: "Kepala Kantor Wilayah",
    ttd_pimpinan_url: "",
    masa_berlaku: "Selama Menjadi Pegawai",
    template_aktif: "template_1",
    opsi_cetak: "2_sisi",
    rasio_foto: "3:4",
    bg_depan_url: "",
    bg_belakang_url: "",
    aturan_kartu: "Kartu ini adalah identitas resmi pegawai Kanwil Kementerian Agama Provinsi Kalimantan Selatan.",
    alamat_kantor_1: "Jl. D.I. Panjaitan",
    alamat_kantor_2: "No. 19 Banjarmasin"
  };

  for (let i = 1; i < rows.length; i++) {
    const key = String(rows[i][0] || "").trim();
    let val = String(rows[i][1] !== undefined ? rows[i][1] : "").trim();
    if (key === "nip_pimpinan") {
      val = val.replace(/^'/, "");
    }
    if (key) {
      config[key] = val;
    }
  }

  return config;
}

function getSanitizedAdminList(sheetAdmin) {
  const rows = sheetAdmin.getDataRange().getValues();
  const list = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0] && !rows[i][1]) continue;
    list.push({
      id_admin: String(rows[i][0] || "").trim(),
      username: String(rows[i][1] || "").trim(),
      nama_petugas: String(rows[i][3] || "").trim(),
      role: String(rows[i][4] || "Operator").trim(),
      status_aktif: String(rows[i][5] || "Aktif").trim()
    });
  }
  return list;
}

function processPhotoStorage(photoData, nama, nip) {
  if (!photoData) return "assets/default-avatar.png";
  const strPhoto = String(photoData).trim();

  if (!strPhoto.startsWith("data:image")) {
    return strPhoto;
  }

  if (FOLDER_ID || strPhoto.length > 45000) {
    const driveUrl = saveBase64ToDrive(strPhoto, nama, nip);
    if (driveUrl) return driveUrl;
  }

  return strPhoto;
}

function saveBase64ToDrive(base64Data, nama, nip) {
  try {
    let folder;
    if (FOLDER_ID) {
      folder = DriveApp.getFolderById(FOLDER_ID);
    } else {
      const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
      folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(DRIVE_FOLDER_NAME);
    }

    const matches = base64Data.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!matches || matches.length < 3) return "";

    const contentType = matches[1];
    const bytes = Utilities.base64Decode(matches[2]);
    const ext = contentType.indexOf("png") !== -1 ? ".png" : ".jpg";
    const safeName = String(nama || "pegawai").replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = String(nip || "NIP") + "_" + safeName + ext;

    const blob = Utilities.newBlob(bytes, contentType, fileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return "https://drive.google.com/uc?export=view&id=" + file.getId();
  } catch (err) {
    Logger.log("Gagal unggah ke Drive: " + err.toString());
    return base64Data.length < 49000 ? base64Data : "assets/default-avatar.png";
  }
}

function sanitizeText(val) {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

function generateTicketCode() {
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return "KMN-2026-" + randomDigits;
}

function getTodayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

function formatDateValue(val) {
  if (!val) return getTodayDateString();
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }
  return String(val).trim();
}

function styleSheetHeader(sheet, numCols) {
  const headerRange = sheet.getRange(1, 1, 1, numCols);
  headerRange.setBackground("#0b5742");
  headerRange.setFontColor("#ffffff");
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
}

function createJsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
