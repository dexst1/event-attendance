// ============================================================
// KONFIGURASI APLIKASI
// Jika ingin update URL API atau Client ID, ubah di sini saja
// ============================================================

const CONFIG = {
  // URL API Google Apps Script
  // Ganti dengan URL deployment GAS Anda
  GAS_API_URL: "https://script.google.com/macros/s/AKfycbw-Ug1BcVzPhH13vL_Olu2FnR_Cw7vNEtvAzl1oqJJJwTS9eFy4eaABFFsP5U0qI6eykQ/exec",

  // Google OAuth Client ID
  // Ganti dengan Client ID dari Google Cloud Console
  GOOGLE_CLIENT_ID: "283057269195-75dn6jeqbap0feoes12fr1fmir6ikkkv.apps.googleusercontent.com",

  // Nama Aplikasi
  APP_NAME: "Event Attendance System",

  // Nama Perusahaan/Organisasi
  ORG_NAME: "Laboratorium PKC",

  // Durasi QR Code (detik)
  QR_REFRESH_INTERVAL: 15,

  // Role yang tersedia
  ROLES: {
    USER: "USER",
    ADMIN: "ADMIN",
    SUPERADMIN: "SUPERADMIN"
  }
};
