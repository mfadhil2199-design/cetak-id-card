/**
 * ===================================================================
 * BACKEND GOOGLE APPS SCRIPT - PORTAL CETAK ID CARD KEMENAG KALSEL
 * ===================================================================
 * 
 * CARA MENGGUNAKAN / DEPLOYMENT:
 * 1. Buka spreadsheet Google Anda (atau buat baru di https://sheets.new).
 * 2. Klik menu "Ekstensi" (Extensions) > "Apps Script".
 * 3. Hapus semua kode default (myFunction) dan PASTE seluruh isi file ini ke dalam Code.gs.
 * 4. Klik ikon Save (Disket / Ctrl+S).
 * 5. Klik tombol biru "Terapkan" (Deploy) di kanan atas > pilih "Kelola penerapan" (Manage deployments).
 * 6. Klik ikon pensil Edit > pilih versi: "Versi baru" (New version).
 *    - Akses (Who has access): Pilih "Siapa saja" (Anyone).
 * 7. Klik "Terapkan" (Deploy).
 * ===================================================================
 */

// Nama Sheet untuk menyimpan data pendaftaran ID Card
const SHEET_NAME = "Data ID Card";
// Nama Folder di Google Drive untuk menyimpan foto pegawai
const DRIVE_FOLDER_NAME = "Foto ID Card Pegawai Kemenag";

/**
 * Handle HTTP GET Requests
 * Mengambil seluruh data permohonan ID Card dari Google Sheets
 */
function doGet(e) {
  try {
    const sheet = getOrCreateSheet();
    const rows = sheet.getDataRange().getValues();
    
    // Jika hanya ada header atau kosong
    if (rows.length <= 1) {
      return createJsonResponse({
        status: "success",
        data: []
      });
    }

    const headers = rows[0];
    const records = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[0]) continue; // Lewati baris kosong

      records.push({
        id: String(row[0] || ""),
        name: String(row[1] || ""),
        nip: String(row[2] || "").replace(/^'/, ""), // Bersihkan tanda kutip petik NIP
        bidang: String(row[3] || ""),
        jabatan: String(row[4] || ""),
        date: formatDate(row[5]),
        status: String(row[6] || "Menunggu Verifikasi"),
        photo: String(row[7] || ""),
        photoReady: row[7] ? "ready" : "not_ready",
        createdAt: String(row[8] || "")
      });
    }

    return createJsonResponse({
      status: "success",
      total: records.length,
      data: records
    });
  } catch (error) {
    return createJsonResponse({
      status: "error",
      message: error.toString()
    });
  }
}

/**
 * Handle HTTP POST Requests
 * Menerima permohonan baru, update status, update data pegawai, atau hapus
 */
function doPost(e) {
  try {
    let payload = {};

    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action || "create";
    const sheet = getOrCreateSheet();

    // 1. ACTION: CREATE / SUBMIT (Permohonan Baru)
    if (action === "create" || action === "submit") {
      let photoUrl = "";
      
      // Jika ada data foto base64, simpan ke Google Drive
      if (payload.photo && payload.photo.startsWith("data:image")) {
        photoUrl = savePhotoToDrive(payload.photo, payload.name, payload.nip);
      } else if (payload.photo) {
        photoUrl = payload.photo;
      }

      // Format NIP dengan tanda petik agar tidak diubah Google Sheets jadi format ilmiah / hilang 0
      const nipText = "'" + String(payload.nip || "");

      sheet.appendRow([
        payload.id || ("KMN-2026-" + Math.floor(1000 + Math.random() * 9000)),
        payload.name || "",
        nipText,
        payload.bidang || "",
        payload.jabatan || "",
        payload.date || "",
        payload.status || "Menunggu Verifikasi",
        photoUrl,
        payload.createdAt || new Date().toISOString()
      ]);

      return createJsonResponse({
        status: "success",
        message: "Permohonan ID Card berhasil dicatat ke Google Sheets",
        id: payload.id,
        photoUrl: photoUrl
      });
    }

    // 2. ACTION: UPDATE_STATUS (Ubah Status dari Admin)
    else if (action === "update_status") {
      const targetId = payload.id;
      const newStatus = payload.status;
      const data = sheet.getDataRange().getValues();
      let found = false;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(targetId)) {
          // Kolom 7 adalah Status Pengerjaan (index 6, kolom G)
          sheet.getRange(i + 1, 7).setValue(newStatus);
          found = true;
          break;
        }
      }

      return createJsonResponse({
        status: found ? "success" : "not_found",
        message: found ? "Status berhasil diperbarui di Google Sheets" : "No. Tiket tidak ditemukan",
        id: targetId,
        newStatus: newStatus
      });
    }

    // 3. ACTION: UPDATE (Edit Lengkap Pegawai dari Admin)
    else if (action === "update") {
      const targetId = payload.id;
      const data = sheet.getDataRange().getValues();
      let found = false;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(targetId)) {
          let photoUrl = data[i][7]; // Pertahankan foto lama jika tidak diganti
          if (payload.photo && payload.photo.startsWith("data:image")) {
            photoUrl = savePhotoToDrive(payload.photo, payload.name, payload.nip);
          } else if (payload.photo) {
            photoUrl = payload.photo;
          }

          sheet.getRange(i + 1, 2).setValue(payload.name || data[i][1]);
          sheet.getRange(i + 1, 3).setValue("'" + (payload.nip || data[i][2]));
          sheet.getRange(i + 1, 4).setValue(payload.bidang || data[i][3]);
          sheet.getRange(i + 1, 5).setValue(payload.jabatan || data[i][4]);
          sheet.getRange(i + 1, 6).setValue(payload.date || data[i][5]);
          sheet.getRange(i + 1, 7).setValue(payload.status || data[i][6]);
          sheet.getRange(i + 1, 8).setValue(photoUrl);

          found = true;
          break;
        }
      }

      return createJsonResponse({
        status: found ? "success" : "not_found",
        message: found ? "Data pegawai berhasil diperbarui" : "No. Tiket tidak ditemukan"
      });
    }

    // 4. ACTION: DELETE (Hapus dari Admin)
    else if (action === "delete") {
      const targetId = payload.id;
      const data = sheet.getDataRange().getValues();
      let found = false;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(targetId)) {
          sheet.deleteRow(i + 1);
          found = true;
          break;
        }
      }

      return createJsonResponse({
        status: found ? "success" : "not_found",
        message: found ? "Baris berhasil dihapus dari Google Sheets" : "No. Tiket tidak ditemukan"
      });
    }

    // Default fallback
    return createJsonResponse({
      status: "error",
      message: "Aksi tidak dikenali: " + action
    });

  } catch (error) {
    return createJsonResponse({
      status: "error",
      message: error.toString()
    });
  }
}

/**
 * Simpan foto base64 ke Google Drive dan return URL file publik
 */
function savePhotoToDrive(base64Data, name, nip) {
  try {
    let folder;
    const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(DRIVE_FOLDER_NAME);
    }

    const matches = base64Data.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (!matches || matches.length < 3) return "";

    const contentType = matches[1];
    const base64Content = matches[2];
    const bytes = Utilities.base64Decode(base64Content);
    const ext = contentType.includes("png") ? ".png" : ".jpg";
    const cleanName = (name || "pegawai").replace(/[^a-zA-Z0-9]/g, "_");
    const filename = (nip || "NIP") + "_" + cleanName + ext;

    const blob = Utilities.newBlob(bytes, contentType, filename);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Return direct web content link atau file URL
    return file.getUrl();
  } catch (e) {
    Logger.log("Gagal menyimpan foto ke Drive: " + e.toString());
    return "";
  }
}

/**
 * Buat atau ambil Sheet dengan header rapi
 */
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    
    // Tulis header resmi
    const headers = [
      "No. Tiket",
      "Nama Lengkap",
      "NIP",
      "Unit Kerja / Bidang",
      "Jabatan",
      "Tanggal Pengajuan",
      "Status Pengerjaan",
      "Foto Pegawai (Google Drive Link)",
      "Waktu Dibuat"
    ];

    sheet.appendRow(headers);

    // Styling Header
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#0b5742"); // Hijau resmi Kemenag
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    headerRange.setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    
    // Auto resize column width
    for (let c = 1; c <= headers.length; c++) {
      sheet.autoResizeColumn(c);
    }
  }

  return sheet;
}

/**
 * Helper untuk format tanggal
 */
function formatDate(val) {
  if (!val) return "";
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val);
}

/**
 * Helper JSON Response dengan Header CORS
 */
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
