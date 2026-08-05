// ============================================================
// ADMIN USERS — Logic management user
// ============================================================

let allUsers = [];

// ===== LOAD USERS =====
async function loadUsersTab() {
  const result = await callAPI("getAllUsers");

  if (!result.success) {
    document.getElementById("users-list").innerHTML = `
      <p class="text-rose-400 text-xs text-center py-3">
        Gagal memuat user: ${result.message}
      </p>`;
    return;
  }

  allUsers = result.users || [];
  renderUsersList(allUsers);
  document.getElementById("stat-users").textContent = allUsers.length;
}

// ===== RENDER USERS LIST =====
function renderUsersList(users) {
  const container = document.getElementById("users-list");
  document.getElementById("user-count").textContent = `${users.length} user`;

  if (!users || users.length === 0) {
    container.innerHTML = `
      <p class="text-gray-500 text-xs text-center py-4">
        Tidak ada user ditemukan.
      </p>`;
    return;
  }

  container.innerHTML = users.map(user => {
    const roleStyles = {
      SUPERADMIN : "bg-rose-500/20 text-rose-400 border-rose-500/30",
      ADMIN      : "bg-amber-500/20 text-amber-400 border-amber-500/30",
      USER       : "bg-indigo-500/20 text-indigo-400 border-indigo-500/30"
    };
    const roleStyle = roleStyles[user.role] || roleStyles.USER;

    const profileComplete = user.badge_number && user.has_signature;

    return `
      <div class="p-4 bg-white/5 rounded-xl space-y-3
        border border-white/5 hover:border-white/10 transition">

        <!-- User Info -->
        <div class="flex items-center gap-3">
          <!-- Avatar -->
          <div class="w-10 h-10 rounded-full bg-indigo-600/20
            border border-indigo-500/30 flex items-center
            justify-center text-lg flex-shrink-0 overflow-hidden">
            ${user.photo_url
              ? `<img src="${user.photo_url}"
                  class="w-full h-full object-cover">`
              : "👤"
            }
          </div>

          <!-- Detail -->
          <div class="flex-1 min-w-0">
            <p class="text-white text-sm font-medium truncate">
              ${user.full_name || "(Belum diisi)"}
            </p>
            <p class="text-gray-400 text-xs truncate">
              ${user.email}
            </p>
            <p class="text-gray-500 text-[10px]">
              Badge: ${user.badge_number || "-"}
              ${user.department ? `· ${user.department}` : ""}
            </p>
          </div>

          <!-- Role Badge -->
          <span class="px-2 py-1 text-[10px] font-bold
            rounded-full border flex-shrink-0 ${roleStyle}">
            ${user.role}
          </span>
        </div>

        <!-- Status Profil -->
        <div class="flex items-center gap-2">
          <span class="flex items-center gap-1 text-[10px]
            ${profileComplete ? "text-emerald-400" : "text-amber-400"}">
            ${profileComplete ? "✅" : "⚠️"}
            ${profileComplete ? "Profil Lengkap" : "Profil Belum Lengkap"}
          </span>
          <span class="text-gray-600 text-[10px]">·</span>
          <span class="text-gray-500 text-[10px]">
            Bergabung: ${formatDate(user.created_at)}
          </span>
        </div>

        <!-- Actions -->
        <div class="flex gap-2 flex-wrap">
          <button onclick="showRoleModal('${user.email}', '${user.role}')"
            class="px-3 py-1.5 bg-amber-500/20 text-amber-400
              border border-amber-500/30 rounded-lg text-[11px]
              font-semibold hover:bg-amber-500/30 transition">
            ✏️ Ubah Role
          </button>
          <button onclick="viewUserDetail('${user.email}')"
            class="px-3 py-1.5 bg-indigo-500/20 text-indigo-400
              border border-indigo-500/30 rounded-lg text-[11px]
              font-semibold hover:bg-indigo-500/30 transition">
            👁 Detail
          </button>
          <button onclick="confirmDeleteUser('${user.email}', '${user.full_name || user.email}')"
            class="btn-danger ml-auto">
            🗑 Hapus
          </button>
        </div>

      </div>
    `;
  }).join("");
}

// ===== FILTER / SEARCH USERS =====
function filterUsers() {
  const query = document.getElementById("user-search")
    .value.toLowerCase().trim();

  if (!query) {
    renderUsersList(allUsers);
    return;
  }

  const filtered = allUsers.filter(user =>
    (user.full_name && user.full_name.toLowerCase().includes(query)) ||
    (user.email && user.email.toLowerCase().includes(query)) ||
    (user.badge_number && user.badge_number.toLowerCase().includes(query)) ||
    (user.department && user.department.toLowerCase().includes(query))
  );

  renderUsersList(filtered);
}

// ===== VIEW USER DETAIL =====
async function viewUserDetail(email) {
  const user = allUsers.find(u => u.email === email);
  if (!user) return;

  showLoading("Memuat riwayat presensi...");
  const result = await callAPI("getUserAttendanceHistory", {
    targetEmail: email
  });
  hideLoading();

  const logs = result.success ? (result.logs || []) : [];

  // Buat modal
  const existing = document.getElementById("modal-user-detail");
  if (existing) existing.remove();

  const roleStyles = {
    SUPERADMIN : "bg-rose-500/20 text-rose-400 border-rose-500/30",
    ADMIN      : "bg-amber-500/20 text-amber-400 border-amber-500/30",
    USER       : "bg-indigo-500/20 text-indigo-400 border-indigo-500/30"
  };

  const modal = document.createElement("div");
  modal.id = "modal-user-detail";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="glass rounded-2xl w-full max-w-lg
      max-h-[85vh] flex flex-col overflow-hidden">

      <!-- Header -->
      <div class="p-4 border-b border-white/10 flex
        items-center justify-between flex-shrink-0">
        <h3 class="text-white font-bold text-sm">Detail User</h3>
        <button onclick="document.getElementById('modal-user-detail').remove()"
          class="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10
            flex items-center justify-center text-gray-400
            hover:text-white transition">
          ✕
        </button>
      </div>

      <!-- Body -->
      <div class="overflow-y-auto flex-1 p-4 space-y-4">

        <!-- Profile Card -->
        <div class="flex items-center gap-4 p-4
          bg-white/5 rounded-xl">
          <div class="w-16 h-16 rounded-2xl bg-indigo-600/20
            border border-indigo-500/30 flex items-center
            justify-center text-3xl flex-shrink-0 overflow-hidden">
            ${user.photo_url
              ? `<img src="${user.photo_url}"
                  class="w-full h-full object-cover">`
              : "👤"
            }
          </div>
          <div class="flex-1">
            <p class="text-white font-bold text-sm">
              ${user.full_name || "(Belum diisi)"}
            </p>
            <p class="text-gray-400 text-xs">${user.email}</p>
            <span class="inline-block mt-1 px-2 py-0.5 text-[10px]
              font-bold rounded-full border
              ${roleStyles[user.role] || roleStyles.USER}">
              ${user.role}
            </span>
          </div>
        </div>

        <!-- Detail Info -->
        <div class="grid grid-cols-2 gap-2">
          ${[
            { label: "Badge/NIK", value: user.badge_number || "-" },
            { label: "Departemen", value: user.department || "-" },
            { label: "No. HP", value: user.phone || "-" },
            { label: "Bergabung", value: formatDate(user.created_at) }
          ].map(item => `
            <div class="bg-white/5 rounded-xl p-3">
              <p class="text-gray-500 text-[10px] mb-1">${item.label}</p>
              <p class="text-white text-xs font-medium">${item.value}</p>
            </div>
          `).join("")}
        </div>

        <!-- Status Profil -->
        <div class="flex items-center gap-2 p-3
          bg-white/5 rounded-xl">
          <span class="text-lg">
            ${user.badge_number && user.has_signature ? "✅" : "⚠️"}
          </span>
          <div>
            <p class="text-white text-xs font-medium">
              ${user.badge_number && user.has_signature
                ? "Profil Lengkap"
                : "Profil Belum Lengkap"}
            </p>
            <p class="text-gray-500 text-[10px]">
              Badge: ${user.badge_number ? "✓" : "✗"} ·
              Tanda Tangan: ${user.has_signature ? "✓" : "✗"}
            </p>
          </div>
        </div>

        <!-- Riwayat Presensi -->
        <div class="space-y-2">
          <p class="text-gray-400 text-xs font-semibold">
            Riwayat Presensi (${logs.length} event)
          </p>
          ${logs.length === 0
            ? `<p class="text-gray-500 text-xs text-center py-4">
                Belum pernah hadir di event manapun.
              </p>`
            : logs.map(log => `
              <div class="flex items-center gap-3
                p-3 bg-white/5 rounded-xl">
                <span class="text-emerald-400 text-sm">✅</span>
                <div class="flex-1 min-w-0">
                  <p class="text-white text-xs truncate">
                    ${log.eventTitle || "Event"}
                  </p>
                  <p class="text-gray-500 text-[10px]">
                    ${formatDateTime(log.timestamp)}
                  </p>
                </div>
              </div>
            `).join("")
          }
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

// ===== DELETE USER =====
function confirmDeleteUser(email, name) {
  showDeleteModal(
    `Hapus user "${name}"? Semua data presensi user ini juga akan dihapus.`,
    () => deleteUser(email)
  );
}

async function deleteUser(email) {
  showLoading("Menghapus user...");
  const result = await callAPI("deleteUser", { targetEmail: email });
  hideLoading();

  if (result.success) {
    showToast("User berhasil dihapus!", "success");
    await loadUsersTab();
    await loadStats();
  } else {
    showToast("Gagal: " + result.message, "error");
  }
}
