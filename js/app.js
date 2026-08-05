// ============================================================
// CORE APP — Fungsi utama yang dipakai di semua halaman
// ============================================================

// ============================================================
// 1. API CALLER
// ============================================================
async function callAPI(action, data = {}) {
  try {
    const user = getStoredUser();
    const idToken = user ? user.idToken : null;

    const response = await fetch(CONFIG.GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action,
        email: user ? user.email : null,
        idToken,
        ...data
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return await response.json();

  } catch (err) {
    console.error("API Error:", err);
    return { success: false, error: "NETWORK_ERROR", message: err.message };
  }
}

// ============================================================
// 2. USER SESSION MANAGEMENT
// ============================================================
function storeUser(userData) {
  sessionStorage.setItem("current_user", JSON.stringify(userData));
}

function getStoredUser() {
  const data = sessionStorage.getItem("current_user");
  return data ? JSON.parse(data) : null;
}

function clearUser() {
  sessionStorage.removeItem("current_user");
}

function isLoggedIn() {
  return getStoredUser() !== null;
}

// ============================================================
// 3. ROUTE GUARD
// Panggil di awal setiap halaman untuk cek autentikasi
// ============================================================
async function requireAuth(options = {}) {
  const {
    requireProfile = true,
    requireAdmin = false
  } = options;

  // Cek session
  if (!checkSession()) {
    window.location.href = "login.html";
    return null;
  }

  const user = getStoredUser();

  // Cek admin
  if (requireAdmin && !isAdmin()) {
    showToast("Akses ditolak. Halaman ini khusus Admin.", "error");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 2000);
    return null;
  }

  // Cek profil lengkap
  if (requireProfile && !user.isProfileComplete) {
    if (!window.location.href.includes("profile.html")) {
      showToast("Lengkapi profil Anda terlebih dahulu.", "warning");
      setTimeout(() => {
        window.location.href = "profile.html";
      }, 1500);
      return null;
    }
  }

  // Refresh data user dari server
  // (opsional, hanya jika data mungkin berubah)
  try {
    const freshData = await callAPI("getCurrentUser");
    if (freshData && !freshData.error) {
      updateSessionUser({
        role            : freshData.role,
        isProfileComplete: freshData.isProfileComplete,
        badge_number    : freshData.badge_number,
        full_name       : freshData.full_name,
        department      : freshData.department,
        phone           : freshData.phone
      });
      return getStoredUser();
    }
  } catch(e) {
    // Jika gagal refresh, tetap pakai data session
    console.warn("Gagal refresh user data:", e);
  }

  return user;
}


// ============================================================
// 4. TOAST NOTIFICATION
// ============================================================
function showToast(message, type = "info", duration = 3000) {
  // Hapus toast lama jika ada
  const existing = document.getElementById("toast");
  if (existing) existing.remove();

  const colors = {
    info    : "bg-indigo-600",
    success : "bg-emerald-600",
    error   : "bg-rose-600",
    warning : "bg-amber-500"
  };

  const icons = {
    info    : "ℹ️",
    success : "✅",
    error   : "❌",
    warning : "⚠️"
  };

  const toast = document.createElement("div");
  toast.id = "toast";
  toast.className = `
    fixed bottom-6 left-1/2 -translate-x-1/2
    ${colors[type]} text-white text-sm font-medium
    px-5 py-3 rounded-2xl shadow-xl z-50
    flex items-center gap-2
    opacity-0 transition-opacity duration-300
  `;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, duration);
  });
}

// ============================================================
// 5. LOADING OVERLAY
// ============================================================
function showLoading(message = "Memuat...") {
  const existing = document.getElementById("loading-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "loading-overlay";
  overlay.className = `
    fixed inset-0 bg-black/60 backdrop-blur-sm
    flex flex-col items-center justify-center z-50 gap-4
  `;
  overlay.innerHTML = `
    <div class="animate-spin rounded-full h-10 w-10 
      border-t-2 border-b-2 border-indigo-400"></div>
    <p class="text-white text-sm">${message}</p>
  `;
  document.body.appendChild(overlay);
}

function hideLoading() {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) overlay.remove();
}

// ============================================================
// 6. FORMAT UTILITIES
// ============================================================
function formatDateTime(isoString) {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatDate(isoString) {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleDateString("id-ID", {
    dateStyle: "long"
  });
}

// ============================================================
// 7. LOGOUT
// ============================================================
function logout() {
  clearUser();
  // Revoke Google token
  if (typeof google !== "undefined" && google.accounts) {
    google.accounts.id.disableAutoSelect();
  }
  window.location.href = "login.html";
}
// ============================================================
// GOOGLE OAUTH — Tambahan fungsi autentikasi
// ============================================================

// ===== REFRESH TOKEN =====
// Google ID token expired setelah 1 jam
// Fungsi ini memperbarui token secara otomatis
async function refreshTokenIfNeeded() {
  const user = getStoredUser();
  if (!user) return null;

  const tokenAge = Date.now() - (user.tokenIssuedAt || 0);
  const ONE_HOUR = 60 * 60 * 1000;

  // Jika token masih fresh (< 55 menit), tidak perlu refresh
  if (tokenAge < ONE_HOUR - (5 * 60 * 1000)) {
    return user;
  }

  // Token mendekati expired, arahkan ke login ulang
  showToast("Sesi Anda telah berakhir. Silakan login kembali.", "warning", 4000);
  setTimeout(() => {
    clearUser();
    window.location.href = "login.html";
  }, 3000);

  return null;
}

// ===== PROTECTED API CALL =====
// Wrapper callAPI yang otomatis cek token
async function protectedCallAPI(action, data = {}) {
  const user = await refreshTokenIfNeeded();
  if (!user) return { success: false, error: "SESSION_EXPIRED" };
  return await callAPI(action, data);
}

// ===== INISIALISASI GOOGLE =====
function initGoogle(callback) {
  const checkGoogle = setInterval(() => {
    if (typeof google !== "undefined" && google.accounts) {
      clearInterval(checkGoogle);
      if (callback) callback();
    }
  }, 100);

  // Timeout 10 detik
  setTimeout(() => clearInterval(checkGoogle), 10000);
}

// ===== CEK SESSION AKTIF =====
function checkSession() {
  const user = getStoredUser();
  if (!user) return false;

  // Cek apakah token ada
  if (!user.idToken) {
    clearUser();
    return false;
  }

  return true;
}

// ===== UPDATE SESSION USER =====
function updateSessionUser(updates) {
  const user = getStoredUser();
  if (!user) return;
  storeUser({ ...user, ...updates });
}

// ===== GET USER ROLE =====
function getUserRole() {
  const user = getStoredUser();
  return user ? user.role : null;
}

function isAdmin() {
  const role = getUserRole();
  return role === CONFIG.ROLES.ADMIN || role === CONFIG.ROLES.SUPERADMIN;
}

function isSuperAdmin() {
  return getUserRole() === CONFIG.ROLES.SUPERADMIN;
}
