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
              👁 Detail
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

  showLoading("Membuat event...");
  const result = await callAPI("submitCreateEvent", {
    title, start, end
  });
  hideLoading();

  if (result.success) {
    showToast("Event berhasil dibuat!", "success");
    // Reset form
    document.getElementById("evt-title").value = "";
    document.getElementById("evt-start").value = "";
    document.getElementById("evt-end").value = "";
    // Reload list
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
                  ${log.badge_number || "-"}
                </p>
                <p class="text-gray-400 text-[10px] truncate">
                  ${log.email || "-"}
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
