// ============================================================
// ADMIN EVENTS — Logic management event
// ============================================================

let allEvents = [];

// ===== LOAD EVENTS =====
async function loadEventsTab() {
  const result = await callAPI("getAllEvents");

  if (!result.success) {
    document.getElementById("events-list").innerHTML = `
      <p class="text-rose-400 text-xs text-center py-3">
        Gagal memuat event: ${result.message}
      </p>`;
    return;
  }

  allEvents = result.events || [];
  renderEventsList(allEvents);
  updateEventStats();
}

// ===== RENDER EVENTS LIST =====
function renderEventsList(events) {
  const container = document.getElementById("events-list");

  if (!events || events.length === 0) {
    container.innerHTML = `
      <p class="text-gray-500 text-xs text-center py-4">
        Belum ada event. Buat event baru di atas.
      </p>`;
    return;
  }

  const now = new Date().getTime();

  container.innerHTML = events.map(event => {
    const start = new Date(event.startTime).getTime();
    const end = new Date(event.endTime).getTime();

    let statusLabel, statusStyle;
    if (now < start) {
      statusLabel = "AKAN DATANG";
      statusStyle = "bg-amber-500/20 text-amber-400 border-amber-500/30";
    } else if (now >= start && now <= end) {
      statusLabel = "AKTIF";
      statusStyle = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    } else {
      statusLabel = "SELESAI";
      statusStyle = "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }

    return `
      <div class="p-4 bg-white/5 rounded-xl space-y-3
        border border-white/5 hover:border-white/10 transition">

        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <p class="text-white text-sm font-semibold truncate">
              ${event.title}
            </p>
            <p class="text-gray-500 text-[10px] mt-0.5">
              ID: ${event.id}
            </p>
          </div>
          <span class="px-2 py-1 text-[10px] font-bold rounded-full
            border flex-shrink-0 ${statusStyle}">
            ${statusLabel}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 text-[11px] text-gray-400">
          <div class="bg-white/5 rounded-lg p-2">
            <p class="text-gray-500 text-[10px] mb-0.5">Mulai</p>
            <p>${formatDateTime(event.startTime)}</p>
          </div>
          <div class="bg-white/5 rounded-lg p-2">
            <p class="text-gray-500 text-[10px] mb-0.5">Selesai</p>
            <p>${formatDateTime(event.endTime)}</p>
          </div>
        </div>

        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1 text-[11px] text-gray-400">
            <span>👥</span>
            <span id="attendance-count-${event.id}">
              Memuat...
            </span>
          </div>
          <div class="flex gap-2">
            <button onclick="viewAttendance('${event.id}', '${event.title}')"
  class="px-3 py-1.5 bg-indigo-500/20 text-indigo-400
    border border-indigo-500/30 rounded-lg text-[11px]
    font-semibold hover:bg-indigo-500/30 transition">
  👥 Peserta
</button>
<button onclick="openDocumentationModal('${event.id}', '${event.title}')"
  class="px-3 py-1.5 bg-purple-500/20 text-purple-400
    border border-purple-500/30 rounded-lg text-[11px]
    font-semibold hover:bg-purple-500/30 transition">
  📸 Foto
</button>
            <button onclick="confirmDeleteEvent('${event.id}', '${event.title}')"
              class="btn-danger">
              🗑 Hapus
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Load jumlah presensi per event
  events.forEach(event => loadAttendanceCount(event.id));
}

// ===== LOAD ATTENDANCE COUNT PER EVENT =====
async function loadAttendanceCount(eventId) {
  const result = await callAPI("getAttendanceLogs", { eventId });
  const el = document.getElementById(`attendance-count-${eventId}`);
  if (!el) return;

  if (result.success) {
    const count = result.logs ? result.logs.length : 0;
    el.textContent = `${count} peserta hadir`;
  } else {
    el.textContent = "- peserta";
  }
}

// ===== CREATE EVENT =====
async function submitCreateEvent() {
  const title = document.getElementById("evt-title").value.trim();
  const start = document.getElementById("evt-start").value;
  const end = document.getElementById("evt-end").value;

  if (!title) {
    showToast("Nama event wajib diisi", "error"); return;
  }
  if (!start || !end) {
    showToast("Waktu mulai dan selesai wajib diisi", "error"); return;
  }
  if (new Date(end) <= new Date(start)) {
    showToast("Waktu selesai harus setelah waktu mulai", "error"); return;
  }

  // Siapkan data geofencing
  let geofencing = { enabled: false };

  if (geofencingEnabled) {
    const radius = parseInt(document.getElementById("evt-radius").value);

    if (!selectedLat || !selectedLng) {
      showToast("Pilih titik lokasi di peta terlebih dahulu", "error");
      return;
    }
    if (!radius || radius < 10) {
      showToast("Radius minimal 10 meter", "error");
      return;
    }

    geofencing = {
      enabled : true,
      lat     : selectedLat,
      lng     : selectedLng,
      radius  : radius
    };
  }

  showLoading("Membuat event...");
  const result = await callAPI("createEvent", {
    title,
    start,
    end,
    geofencing
  });
  hideLoading();

  if (result.success) {
    showToast("Event berhasil dibuat!", "success");

    // Reset form
    document.getElementById("evt-title").value = "";
    document.getElementById("evt-start").value = "";
    document.getElementById("evt-end").value = "";

    // Reset geofencing toggle jika aktif
    if (geofencingEnabled) {
      toggleGeofencing();
      mapInitialized = false;
      selectedLat = null;
      selectedLng = null;
    }

    await loadEventsTab();
    await loadExportEvents();
  } else {
    showToast("Gagal: " + result.message, "error");
  }
}

// ===== DELETE EVENT =====
function confirmDeleteEvent(eventId, eventTitle) {
  showDeleteModal(
    `Hapus event "${eventTitle}"? Semua log presensi event ini juga akan dihapus.`,
    () => submitDeleteEvent(eventId)
  );
}

async function submitDeleteEvent(eventId) {
  showLoading("Menghapus event...");
  const result = await callAPI("deleteEvent", { eventId });
  hideLoading();

  if (result.success) {
    showToast("Event berhasil dihapus!", "success");
    await loadEventsTab();
    await loadStats();
  } else {
    showToast("Gagal: " + result.message, "error");
  }
}

// ===== VIEW ATTENDANCE DETAIL =====
async function viewAttendance(eventId, eventTitle) {
  showLoading("Memuat data presensi...");
  const result = await callAPI("getAttendanceLogs", { eventId });
  hideLoading();

  if (!result.success) {
    showToast("Gagal memuat data: " + result.message, "error");
    return;
  }

  const logs = result.logs || [];

  // Buat modal detail
  const existing = document.getElementById("modal-attendance");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "modal-attendance";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="glass rounded-2xl w-full max-w-lg
      max-h-[80vh] flex flex-col overflow-hidden">

      <!-- Modal Header -->
      <div class="p-4 border-b border-white/10 flex
        items-center justify-between flex-shrink-0">
        <div>
          <h3 class="text-white font-bold text-sm">${eventTitle}</h3>
          <p class="text-gray-400 text-xs">${logs.length} peserta hadir</p>
        </div>
        <button onclick="document.getElementById('modal-attendance').remove()"
          class="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10
            flex items-center justify-center text-gray-400
            hover:text-white transition">
          ✕
        </button>
      </div>

      <!-- Modal Body -->
      <div class="overflow-y-auto flex-1 p-4 space-y-2">
        ${logs.length === 0
          ? `<p class="text-gray-500 text-xs text-center py-8">
              Belum ada peserta yang hadir.
            </p>`
          : logs.map((log, i) => `
            <div class="flex items-center gap-3 p-3
              bg-white/5 rounded-xl">
              <span class="text-gray-500 text-xs w-6
                text-center flex-shrink-0">
                ${i + 1}
              </span>
              <div class="flex-1 min-w-0">
                <p class="text-white text-xs font-medium truncate">
  ${log.full_name || log.badge_number || "-"}
</p>
<p class="text-gray-400 text-[10px] truncate">
  Badge: ${log.badge_number || "-"}
</p>

              </div>
              <div class="text-right flex-shrink-0">
                <p class="text-gray-400 text-[10px]">
                  ${formatDateTime(log.timestamp)}
                </p>
                <span class="px-2 py-0.5 bg-emerald-500/20
                  text-emerald-400 text-[10px] font-bold
                  rounded-full border border-emerald-500/30">
                  HADIR
                </span>
              </div>
            </div>
          `).join("")
        }
      </div>

    </div>
  `;

  document.body.appendChild(modal);
}

// ===== UPDATE STAT EVENT =====
function updateEventStats() {
  const now = new Date().getTime();
  const activeCount = allEvents.filter(e =>
    new Date(e.startTime).getTime() <= now &&
    new Date(e.endTime).getTime() >= now
  ).length;
  document.getElementById("stat-events").textContent = activeCount;
}

// ============================================================
// DOKUMENTASI FOTO EVENT
// ============================================================

// ===== BUKA MODAL DOKUMENTASI =====
async function openDocumentationModal(eventId, eventTitle) {
  showLoading("Memuat dokumentasi...");
  const result = await callAPI("getEventPhotos", { eventId });
  hideLoading();

  const photos = result.success ? (result.photos || []) : [];

  // Hapus modal lama jika ada
  const existing = document.getElementById("modal-docs");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "modal-docs";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="glass rounded-2xl w-full max-w-lg
      max-h-[90vh] flex flex-col overflow-hidden">

      <!-- Header -->
      <div class="p-4 border-b border-white/10 flex
        items-center justify-between flex-shrink-0">
        <div>
          <h3 class="text-white font-bold text-sm">
            📸 Dokumentasi Event
          </h3>
          <p class="text-gray-400 text-xs mt-0.5">${eventTitle}</p>
        </div>
        <button onclick="document.getElementById('modal-docs').remove()"
          class="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10
            flex items-center justify-center text-gray-400
            hover:text-white transition text-sm">
          ✕
        </button>
      </div>

      <!-- Body -->
      <div class="overflow-y-auto flex-1 p-4 space-y-4">

        <!-- Upload Section -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-gray-300 text-xs font-semibold">
              Foto (${photos.length}/5)
            </p>
            ${photos.length < 5 ? `
              <label for="doc-upload-${eventId}"
                class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700
                  text-white text-xs font-bold rounded-xl
                  cursor-pointer transition flex items-center gap-1">
                📷 Tambah Foto
              </label>
              <input type="file" id="doc-upload-${eventId}"
                accept="image/*" class="hidden"
                onchange="handleDocUpload(event, '${eventId}')">
            ` : `
              <span class="text-amber-400 text-xs">
                ⚠️ Maksimal 5 foto
              </span>
            `}
          </div>

          <!-- Caption Input -->
          ${photos.length < 5 ? `
            <input type="text" id="doc-caption-${eventId}"
              placeholder="Caption foto (opsional)"
              class="input-field text-xs">
          ` : ""}

          <!-- Upload Progress -->
          <div id="upload-progress-${eventId}" class="hidden">
            <div class="flex items-center gap-2 p-3
              bg-indigo-500/10 border border-indigo-500/30
              rounded-xl text-indigo-400 text-xs">
              <div class="animate-spin rounded-full h-3 w-3
                border-t border-indigo-400"></div>
              <span>Mengupload foto...</span>
            </div>
          </div>
        </div>

        <!-- Photos Grid -->
        <div id="photos-grid-${eventId}">
          ${renderPhotosGrid(photos, eventId)}
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

// ===== RENDER GRID FOTO =====
function renderPhotosGrid(photos, eventId) {
  if (!photos || photos.length === 0) {
    return `
      <div class="flex flex-col items-center gap-3 py-8">
        <span class="text-4xl">📷</span>
        <p class="text-gray-500 text-xs text-center">
          Belum ada foto dokumentasi.<br>
          Tambahkan foto di atas.
        </p>
      </div>
    `;
  }

  return `
    <div class="grid grid-cols-2 gap-3">
      ${photos.map((photo, index) => `
        <div class="relative group rounded-xl overflow-hidden
          border border-white/10 bg-white/5">

          <!-- Foto -->
          <img src="${photo.url}" alt="Dokumentasi ${index + 1}"
            class="w-full aspect-square object-cover cursor-pointer
              hover:opacity-90 transition"
            onclick="openPhotoViewer('${photo.url}', '${photo.caption || ""}')">

          <!-- Overlay info -->
          <div class="absolute bottom-0 left-0 right-0
            bg-gradient-to-t from-black/80 to-transparent
            p-2 translate-y-full group-hover:translate-y-0
            transition-transform duration-200">
            ${photo.caption ? `
              <p class="text-white text-[10px] font-medium truncate">
                ${photo.caption}
              </p>
            ` : ""}
            <p class="text-gray-400 text-[9px]">
              ${formatDateTime(photo.uploadedAt)}
            </p>
          </div>

          <!-- Tombol Hapus -->
          <button onclick="confirmDeletePhoto(
              '${eventId}',
              '${photo.fileId}',
              ${index + 1}
            )"
            class="absolute top-2 right-2 w-7 h-7
              bg-rose-600/90 hover:bg-rose-600
              rounded-lg flex items-center justify-center
              text-white text-xs opacity-0 group-hover:opacity-100
              transition-opacity">
            🗑
          </button>

          <!-- Nomor foto -->
          <span class="absolute top-2 left-2 w-5 h-5
            bg-black/60 rounded-full flex items-center
            justify-center text-white text-[9px] font-bold">
            ${index + 1}
          </span>

        </div>
      `).join("")}
    </div>
  `;
}

// ===== HANDLE UPLOAD FOTO =====
async function handleDocUpload(event, eventId) {
  const file = event.target.files[0];
  if (!file) return;

  // Validasi tipe
  if (!file.type.startsWith("image/")) {
    showToast("File harus berupa gambar", "error");
    return;
  }

  // Validasi ukuran 2MB
  if (file.size > 2 * 1024 * 1024) {
    showToast("Ukuran foto maksimal 2MB", "error");
    return;
  }

  // Ambil caption
  const captionEl = document.getElementById(`doc-caption-${eventId}`);
  const caption = captionEl ? captionEl.value.trim() : "";

  // Tampilkan progress
  const progress = document.getElementById(`upload-progress-${eventId}`);
  if (progress) progress.classList.remove("hidden");

  // Convert ke Base64
  const base64 = await fileToBase64(file);

  // Upload ke GAS
  const result = await callAPI("uploadEventPhoto", {
    eventId,
    base64Data: base64,
    caption
  });

  // Sembunyikan progress
  if (progress) progress.classList.add("hidden");

  if (result.success) {
    showToast("Foto berhasil diupload!", "success");

    // Reset input
    event.target.value = "";
    if (captionEl) captionEl.value = "";

    // Update grid
    const grid = document.getElementById(`photos-grid-${eventId}`);
    if (grid) {
      grid.innerHTML = renderPhotosGrid(result.photos, eventId);
    }

    // Update counter di header modal
    const counter = document.querySelector(
      "#modal-docs .text-gray-300"
    );
    if (counter) {
      counter.textContent = `Foto (${result.photos.length}/5)`;
    }

    // Sembunyikan tombol upload jika sudah 5
    if (result.photos.length >= 5) {
      const uploadLabel = document.querySelector(
        `label[for="doc-upload-${eventId}"]`
      );
      if (uploadLabel) uploadLabel.classList.add("hidden");
    }

  } else {
    showToast("Gagal upload: " + result.message, "error");
  }
}

// ===== KONFIRMASI HAPUS FOTO =====
function confirmDeletePhoto(eventId, fileId, photoNum) {
  showDeleteModal(
    `Hapus foto dokumentasi #${photoNum}? File akan dihapus permanen.`,
    () => deletePhoto(eventId, fileId)
  );
}

// ===== HAPUS FOTO =====
async function deletePhoto(eventId, fileId) {
  showLoading("Menghapus foto...");
  const result = await callAPI("deleteEventPhoto", { eventId, fileId });
  hideLoading();

  if (result.success) {
    showToast("Foto berhasil dihapus!", "success");

    // Update grid
    const grid = document.getElementById(`photos-grid-${eventId}`);
    if (grid) {
      grid.innerHTML = renderPhotosGrid(result.photos, eventId);
    }

    // Update counter
    const counter = document.querySelector(
      "#modal-docs .text-gray-300"
    );
    if (counter) {
      counter.textContent = `Foto (${result.photos.length}/5)`;
    }

  } else {
    showToast("Gagal hapus: " + result.message, "error");
  }
}

// ===== PHOTO VIEWER (fullscreen) =====
function openPhotoViewer(url, caption) {
  const existing = document.getElementById("photo-viewer");
  if (existing) existing.remove();

  const viewer = document.createElement("div");
  viewer.id = "photo-viewer";
  viewer.className = "modal-overlay";
  viewer.style.zIndex = "60";
  viewer.innerHTML = `
    <div class="flex flex-col items-center gap-4
      w-full max-w-lg px-4">

      <!-- Foto -->
      <div class="relative w-full">
        <img src="${url}" alt="Dokumentasi"
          class="w-full rounded-2xl object-contain
            max-h-[70vh] border border-white/10">
      </div>

      <!-- Caption -->
      ${caption ? `
        <p class="text-gray-300 text-sm text-center">
          ${caption}
        </p>
      ` : ""}

      <!-- Tutup -->
      <button onclick="document.getElementById('photo-viewer').remove()"
        class="px-8 py-3 bg-white/10 hover:bg-white/20
          text-white font-semibold rounded-2xl text-sm
          border border-white/10 transition">
        ✕ Tutup
      </button>

    </div>
  `;

  // Klik background untuk tutup
  viewer.addEventListener("click", (e) => {
    if (e.target === viewer) viewer.remove();
  });

  document.body.appendChild(viewer);
}

// ===== HELPER: FILE TO BASE64 =====
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
