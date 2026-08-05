// ============================================================
// ADMIN EXPORT — Logic export data ke CSV & Excel
// ============================================================

// ===== LOAD EVENTS KE DROPDOWN EXPORT =====
async function loadExportEvents() {
  const result = await callAPI("getAllEvents");
  const sel = document.getElementById("export-event");

  if (!result.success || !result.events) return;

  const options = result.events.map(e => `
    <option value="${e.id}" class="bg-gray-900">
      ${e.title}
    </option>
  `).join("");

  sel.innerHTML = `
    <option value="all" class="bg-gray-900">Semua Event</option>
    ${options}
  `;
}

// ===== EXPORT DATA PRESENSI =====
async function exportData(format) {
  const eventId = document.getElementById("export-event").value;
  const fromDate = document.getElementById("export-from").value;
  const toDate = document.getElementById("export-to").value;

  showLoading("Mengambil data...");

  const result = await callAPI("getAttendanceLogs", {
    eventId: eventId,
    fromDate: fromDate || null,
    toDate: toDate || null,
    limit: 9999
  });

  hideLoading();

  if (!result.success) {
    showToast("Gagal mengambil data: " + result.message, "error");
    return;
  }

  const logs = result.logs || [];

  if (logs.length === 0) {
    showToast("Tidak ada data untuk diexport", "warning");
    return;
  }

  // Siapkan data
  const headers = [
    "No",
    "Event",
    "Nama Lengkap",
    "Email",
    "Badge/NIK",
    "Departemen",
    "Waktu Presensi",
    "Status"
  ];

  const rows = logs.map((log, i) => [
    i + 1,
    log.eventTitle || "-",
    log.full_name || "-",
    log.email || "-",
    log.badge_number || "-",
    log.department || "-",
    formatDateTime(log.timestamp),
    log.status || "VALID"
  ]);

  if (format === "csv") {
    exportCSV(headers, rows, "presensi");
  } else if (format === "excel") {
    exportExcel(headers, rows, "presensi", "Data Presensi");
  }
}

// ===== EXPORT DATA USER =====
async function exportUsers() {
  showLoading("Mengambil data user...");
  const result = await callAPI("getAllUsers");
  hideLoading();

  if (!result.success) {
    showToast("Gagal mengambil data: " + result.message, "error");
    return;
  }

  const users = result.users || [];

  if (users.length === 0) {
    showToast("Tidak ada data user untuk diexport", "warning");
    return;
  }

  const headers = [
    "No",
    "Nama Lengkap",
    "Email",
    "Badge/NIK",
    "Departemen",
    "No. HP",
    "Role",
    "Profil Lengkap",
    "Tanggal Bergabung"
  ];

  const rows = users.map((user, i) => [
    i + 1,
    user.full_name || "-",
    user.email || "-",
    user.badge_number || "-",
    user.department || "-",
    user.phone || "-",
    user.role || "USER",
    user.badge_number && user.has_signature ? "Ya" : "Belum",
    formatDate(user.created_at)
  ]);

  // Tampilkan pilihan format
  showExportFormatModal(headers, rows, "users", "Data User");
}

// ===== MODAL PILIH FORMAT EXPORT =====
function showExportFormatModal(headers, rows, filename, sheetName) {
  const existing = document.getElementById("modal-export-format");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "modal-export-format";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="glass rounded-2xl w-full max-w-sm p-6 space-y-4">
      <h3 class="text-white font-bold text-base">📤 Pilih Format Export</h3>
      <p class="text-gray-400 text-sm">
        ${rows.length} baris data siap diexport.
      </p>
      <div class="grid grid-cols-2 gap-3">
        <button onclick="
            exportCSV(
              ${JSON.stringify(headers)},
              ${JSON.stringify(rows)},
              '${filename}'
            );
            document.getElementById('modal-export-format').remove();"
          class="btn-primary flex flex-col items-center gap-2 py-4">
          <span class="text-2xl">📄</span>
          <span>CSV</span>
        </button>
        <button onclick="
            exportExcel(
              ${JSON.stringify(headers)},
              ${JSON.stringify(rows)},
              '${filename}',
              '${sheetName}'
            );
            document.getElementById('modal-export-format').remove();"
          class="flex flex-col items-center gap-2 py-4
            bg-emerald-600 hover:bg-emerald-700 text-white
            font-bold rounded-xl transition cursor-pointer">
          <span class="text-2xl">📊</span>
          <span>Excel</span>
        </button>
      </div>
      <button onclick="document.getElementById('modal-export-format').remove()"
        class="w-full py-3 bg-white/5 hover:bg-white/10
          text-gray-400 rounded-xl text-sm transition">
        Batal
      </button>
    </div>
  `;

  document.body.appendChild(modal);
}

// ===== EXPORT CSV =====
function exportCSV(headers, rows, filename) {
  const escape = (val) => {
    const str = String(val ?? "");
    // Escape jika mengandung koma, kutip, atau newline
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent = [
    headers.map(escape).join(","),
    ...rows.map(row => row.map(escape).join(","))
  ].join("\n");

  // Tambah BOM untuk Excel agar bisa baca karakter Indonesia
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], {
    type: "text/csv;charset=utf-8;"
  });

  downloadFile(blob, `${filename}_${getDateStamp()}.csv`);
  showToast(`✅ CSV berhasil diexport (${rows.length} baris)`, "success");
}

// ===== EXPORT EXCEL =====
function exportExcel(headers, rows, filename, sheetName = "Sheet1") {
  // Gunakan library SheetJS jika tersedia
  // Jika tidak, fallback ke format HTML table yang bisa dibuka Excel
  if (typeof XLSX !== "undefined") {
    exportWithSheetJS(headers, rows, filename, sheetName);
  } else {
    loadSheetJS(() => exportWithSheetJS(headers, rows, filename, sheetName));
  }
}

function loadSheetJS(callback) {
  showLoading("Memuat library Excel...");
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
  script.onload = () => {
    hideLoading();
    callback();
  };
  script.onerror = () => {
    hideLoading();
    showToast("Gagal memuat library Excel. Coba export CSV.", "error");
  };
  document.head.appendChild(script);
}

function exportWithSheetJS(headers, rows, filename, sheetName) {
  try {
    // Buat workbook
    const wb = XLSX.utils.book_new();

    // Buat data dengan header
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Style header (bold)
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!ws[cellRef]) continue;
      ws[cellRef].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: "4F46E5" } },
        alignment: { horizontal: "center" }
      };
    }

    // Auto column width
    const colWidths = headers.map((h, i) => {
      const maxLen = Math.max(
        h.length,
        ...rows.map(row => String(row[i] ?? "").length)
      );
      return { wch: Math.min(maxLen + 4, 40) };
    });
    ws["!cols"] = colWidths;

    // Append sheet
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Download
    XLSX.writeFile(wb, `${filename}_${getDateStamp()}.xlsx`);
    showToast(`✅ Excel berhasil diexport (${rows.length} baris)`, "success");

  } catch(err) {
    showToast("Gagal export Excel: " + err.message, "error");
  }
}

// ===== HELPER: DOWNLOAD FILE =====
function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ===== HELPER: DATE STAMP =====
function getDateStamp() {
  return new Date().toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
}
