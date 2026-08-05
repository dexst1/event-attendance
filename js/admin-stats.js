// ============================================================
// ADMIN STATS — Logic grafik & statistik
// ============================================================

let attendanceChart = null;

// ===== LOAD STATS CARDS =====
async function loadStats() {
  const result = await callAPI("getDashboardStats");

  if (!result.success) {
    console.error("Gagal memuat stats:", result.message);
    return;
  }

  const stats = result.stats;

  // Update stat cards
  document.getElementById("stat-users").textContent =
    stats.totalUsers ?? "-";
  document.getElementById("stat-events").textContent =
    stats.activeEvents ?? "-";
  document.getElementById("stat-attendance").textContent =
    stats.totalAttendance ?? "-";
  document.getElementById("stat-today").textContent =
    stats.todayAttendance ?? "-";
}

// ===== LOAD RECENT ATTENDANCE =====
async function loadRecentAttendance() {
  const result = await callAPI("getAttendanceLogs", {
    eventId: "all",
    limit: 10
  });

  const container = document.getElementById("recent-attendance");

  if (!result.success || !result.logs || result.logs.length === 0) {
    container.innerHTML = `
      <p class="text-gray-500 text-xs text-center py-4">
        Belum ada data presensi.
      </p>`;
    renderChart([]);
    return;
  }

  // Render list terkini
  container.innerHTML = result.logs.map(log => `
    <div class="flex items-center gap-3 p-3
      bg-white/5 rounded-xl">

      <!-- Icon -->
      <div class="w-8 h-8 rounded-lg bg-emerald-600/20
        border border-emerald-500/30 flex items-center
        justify-center text-sm flex-shrink-0">
        ✅
      </div>

      <!-- Info -->
      <div class="flex-1 min-w-0">
        <p class="text-white text-xs font-medium truncate">
          ${log.badge_number || "-"} · ${log.email || "-"}
        </p>
        <p class="text-gray-500 text-[10px]">
          ${log.eventTitle || "Event"} ·
          ${formatDateTime(log.timestamp)}
        </p>
      </div>

      <!-- Status -->
      <span class="px-2 py-0.5 bg-emerald-500/20
        text-emerald-400 text-[10px] font-bold
        rounded-full border border-emerald-500/30
        flex-shrink-0">
        HADIR
      </span>

    </div>
  `).join("");

  // Render chart
  await renderChartFromLogs(result.logs);
}

// ===== RENDER CHART =====
async function renderChartFromLogs(logs) {
  // Hitung presensi per event
  const eventMap = {};
  logs.forEach(log => {
    const key = log.eventTitle || log.event_id || "Unknown";
    eventMap[key] = (eventMap[key] || 0) + 1;
  });

  const labels = Object.keys(eventMap);
  const data = Object.values(eventMap);

  renderChart(labels, data);
}

function renderChart(labels = [], data = []) {
  const ctx = document.getElementById("chart-attendance").getContext("2d");

  // Destroy chart lama jika ada
  if (attendanceChart) {
    attendanceChart.destroy();
    attendanceChart = null;
  }

  if (labels.length === 0) {
    // Tampilkan chart kosong
    ctx.canvas.parentElement.innerHTML = `
      <p class="text-gray-500 text-xs text-center py-8">
        Belum ada data untuk ditampilkan.
      </p>`;
    return;
  }

  attendanceChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Jumlah Hadir",
        data: data,
        backgroundColor: labels.map((_, i) => {
          const colors = [
            "rgba(99,102,241,0.7)",
            "rgba(139,92,246,0.7)",
            "rgba(167,139,250,0.7)",
            "rgba(79,70,229,0.7)",
            "rgba(109,40,217,0.7)"
          ];
          return colors[i % colors.length];
        }),
        borderColor: labels.map((_, i) => {
          const colors = [
            "rgba(99,102,241,1)",
            "rgba(139,92,246,1)",
            "rgba(167,139,250,1)",
            "rgba(79,70,229,1)",
            "rgba(109,40,217,1)"
          ];
          return colors[i % colors.length];
        }),
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: "rgba(15,15,26,0.9)",
          titleColor: "#e0e0e0",
          bodyColor: "#9ca3af",
          borderColor: "rgba(255,255,255,0.1)",
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (context) => {
              return ` ${context.parsed.y} peserta hadir`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: "rgba(255,255,255,0.05)"
          },
          ticks: {
            color: "#6b7280",
            font: { size: 10 },
            maxRotation: 30
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(255,255,255,0.05)"
          },
          ticks: {
            color: "#6b7280",
            font: { size: 10 },
            stepSize: 1,
            precision: 0
          }
        }
      }
    }
  });
}

// ===== RENDER CHART PER TANGGAL =====
async function renderChartByDate() {
  const result = await callAPI("getAttendanceLogs", {
    eventId: "all",
    limit: 100
  });

  if (!result.success || !result.logs) return;

  // Kelompokkan per tanggal
  const dateMap = {};
  result.logs.forEach(log => {
    const date = new Date(log.timestamp)
      .toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short"
      });
    dateMap[date] = (dateMap[date] || 0) + 1;
  });

  // Ambil 7 hari terakhir
  const entries = Object.entries(dateMap).slice(-7);
  const labels = entries.map(e => e[0]);
  const data = entries.map(e => e[1]);

  renderChart(labels, data);
}
