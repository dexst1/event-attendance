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
  "No", "Event", "Nama Lengkap",
  "Badge/NIK", "Bagian", "Waktu Presensi", "Status"
];
const rows = logs.map((log, i) => [
  i + 1,
  log.eventTitle || "-",
  log.full_name || "-",
  log.badge_number || "-",
  log.bagian || "-",
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
  "No", "Nama Lengkap", "Email", "Badge/NIK",
  "Bagian", "No. HP", "Role", "Profil Lengkap", "Tanggal Bergabung"
];
const rows = users.map((user, i) => [
  i + 1,
  user.full_name || "-",
  user.email || "-",
  user.badge_number || "-",
  user.bagian || "-",
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

// ============================================================
// EXPORT WORD — Daftar Hadir Event
// ============================================================

async function exportAttendanceWord(eventId) {
  showLoading("Menyiapkan data daftar hadir...");

  const eventsResult = await callAPI("getAllEvents");
  const logsResult = await callAPI("getAttendanceLogs", {
    eventId : eventId,
    limit   : 9999
  });
  const usersResult = await callAPI("getAllUsers");

  if (!eventsResult.success || !logsResult.success) {
    hideLoading();
    showToast("Gagal mengambil data", "error");
    return;
  }

  const event = eventsResult.events.find(e => e.id === eventId);
  if (!event) {
    hideLoading();
    showToast("Event tidak ditemukan", "error");
    return;
  }

  const logs = logsResult.logs || [];
  const users = usersResult.success ? usersResult.users : [];

  // Map email → user data
  const userMap = {};
  users.forEach(u => { userMap[u.email] = u; });

  // Pre-fetch semua gambar tanda tangan
  showLoading("Mengambil tanda tangan...");
    const signatureBuffers = {};

    await Promise.all(logs.map(async (log) => {
      const userData = userMap[log.email];
      if (userData && userData.signature_url) {
        const imgData = await fetchImageAsBuffer(userData.signature_url);
        if (imgData) {
          signatureBuffers[log.email] = imgData;
        }
      }
    }));

  hideLoading();
  generateWordDocument(event, logs, userMap, signatureBuffers);
}


    // ===== HELPER: NO BORDER =====
    function noBorder() {
      return {
        top    : { style: docx.BorderStyle.NONE, size: 0, color: "FFFFFF" },
        bottom : { style: docx.BorderStyle.NONE, size: 0, color: "FFFFFF" },
        left   : { style: docx.BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right  : { style: docx.BorderStyle.NONE, size: 0, color: "FFFFFF" }
      };
    }


// ===== HELPER: BUAT BARIS HEADER =====
function makeHeaderRow(label, value) {
  const TableRow  = docx.TableRow;
  const TableCell = docx.TableCell;
  const Paragraph = docx.Paragraph;
  const TextRun   = docx.TextRun;

  const cellStyle = {
    borders : noBorder(),
    children: []
  };

  return new TableRow({
    children: [
      // Kolom label (lebar tetap)
      new TableCell({
        width  : { size: 2400, type: docx.WidthType.DXA },
        borders: noBorder(),
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text : label,
                size : 22,
                font : "Arial"
              })
            ],
            spacing: { after: 80 }
          })
        ]
      }),

      // Kolom titik dua (lebar kecil)
      new TableCell({
        width  : { size: 300, type: docx.WidthType.DXA },
        borders: noBorder(),
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text : ":",
                size : 22,
                font : "Arial"
              })
            ],
            spacing: { after: 80 }
          })
        ]
      }),

      // Kolom nilai
      new TableCell({
        width  : { size: 7300, type: docx.WidthType.DXA },
        borders: noBorder(),
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text : value,
                size : 22,
                font : "Arial"
              })
            ],
            spacing: { after: 80 }
          })
        ]
      })
    ]
  });
}

function generateWordDocument(event, logs, userMap, signatureBuffers = {}) {
  // Load docx.js jika belum ada
  if (typeof docx === "undefined") {
    loadDocxJs(() => generateWordDocument(event, logs, userMap, signatureBuffers));
    return;
  }

  showLoading("Membuat dokumen Word...");

  try {
    const Document      = docx.Document;
    const Packer        = docx.Packer;
    const Paragraph     = docx.Paragraph;
    const Table         = docx.Table;
    const TableRow      = docx.TableRow;
    const TableCell     = docx.TableCell;
    const TextRun       = docx.TextRun;
    const AlignmentType = docx.AlignmentType;
    const WidthType     = docx.WidthType;
    const BorderStyle   = docx.BorderStyle;
    const ShadingType   = docx.ShadingType;
    const VerticalAlign = docx.VerticalAlign;

       // ===== HEADER MENGGUNAKAN TABEL TANPA BORDER =====
    const headerTable = new Table({
      width: { size: 10000, type: WidthType.DXA },
          borders: {
            top    : { style: docx.BorderStyle.NONE, size: 0, color: "FFFFFF" },
            bottom : { style: docx.BorderStyle.NONE, size: 0, color: "FFFFFF" },
            left   : { style: docx.BorderStyle.NONE, size: 0, color: "FFFFFF" },
            right  : { style: docx.BorderStyle.NONE, size: 0, color: "FFFFFF" },
            insideH: { style: docx.BorderStyle.NONE, size: 0, color: "FFFFFF" },
            insideV: { style: docx.BorderStyle.NONE, size: 0, color: "FFFFFF" }
          },
      rows: [
        // Judul
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 3,
              borders: noBorder(),
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text : "COMMUNITY OF PRACTICE (COP)",
                      bold : true,
                      size : 28,
                      font : "Arial"
                    })
                  ],
                  spacing: { after: 160 }
                })
              ]
            })
          ]
        }),

        // Keterangan Kegiatan
        makeHeaderRow(
          "Keterangan Kegiatan",
          event.keterangan || "-"
        ),

        // Tema/Topik
        makeHeaderRow(
          "Tema/Topik",
          event.title || "-"
        ),

        // Hari/Tanggal
        makeHeaderRow(
          "Hari/Tanggal",
          formatDateWord(event.startTime)
        ),

        // Waktu
        makeHeaderRow(
          "Waktu",
          formatTimeWord(event.startTime) +
          " - " +
          formatTimeWord(event.endTime) +
          " WIB"
        ),

        // Tempat
        makeHeaderRow(
          "Tempat",
          event.tempat || "-"
        ),

        // Pembicara
        makeHeaderRow(
          "Pembicara",
          event.pembicara && event.pembicara.length > 0
            ? event.pembicara.map(p =>
                p.nama + (p.asal ? ` (${p.asal})` : "")
              ).join(", ")
            : "-"
        ),

        // Baris kosong sebelum tabel
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 3,
              borders: noBorder(),
              children: [
                new Paragraph({
                  children: [new TextRun({ text: " ", size: 20 })],
                  spacing: { after: 160 }
                })
              ]
            })
          ]
        })
      ]
    });

    // ===== TABEL DATA ROWS =====
    const dataRows = logs.map((log, index) => {
    const userData = userMap[log.email] || {};
    const nama     = userData.full_name || log.full_name || "-";
    const jabatan  = userData.jabatan || "-";
    const unitKerja = userData.bagian || "-";
    const phone    = userData.phone ? String(userData.phone) : "-";

    // Signature cell
    let signatureCell;
    const imgData = signatureBuffers[log.email];

    if (imgData && imgData.buffer) {
      signatureCell = new TableCell({
        width        : { size: 2300, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        children     : [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing  : { before: 80, after: 80 },
            children : [
              new docx.ImageRun({
                data            : imgData.buffer,
                type            : imgData.mimeType === "image/png"
                                  ? "png" : "jpg",
                transformation  : {
                  width  : 120,
                  height : 55
                }
              })
            ]
          })
        ]
      });
    } else {
      signatureCell = createDataCell("", 2300, 800);
    }

    return new TableRow({
      children: [
        createDataCell(String(index + 1), 500, 800),
        createDataCell(nama, 2200, 800),
        createDataCell(jabatan, 1800, 800),
        createDataCell(unitKerja, 1800, 800),
        createDataCell(phone, 1400, 800),
        signatureCell
      ]
    });
  });


    // Tambah baris kosong jika kurang dari 10
    const minRows = Math.max(10, logs.length);
    const emptyRowsNeeded = minRows - logs.length;
    const emptyRows = Array.from(
      { length: emptyRowsNeeded }, (_, i) =>
      new TableRow({
        children: [
          createDataCell(
            String(logs.length + i + 1), 500, 800
          ),
          createDataCell("", 2200, 800),
          createDataCell("", 1800, 800),
          createDataCell("", 1800, 800),
          createDataCell("", 1400, 800),
          createDataCell("", 2300, 800)
        ]
      })
    );

    // ===== BUAT TABEL =====
    const tableHeaderRow = new TableRow({
      tableHeader: true,
      children: [
        createHeaderCell("No.", 500),
        createHeaderCell("Nama Lengkap", 2200),
        createHeaderCell("Jabatan", 1800),
        createHeaderCell("Unit Kerja", 1800),
        createHeaderCell("No. HP", 1400),
        createHeaderCell("Tanda Tangan", 2300)
      ]
    });
    const table = new Table({
      width: { size: 10000, type: WidthType.DXA },
      rows: [tableHeaderRow, ...dataRows, ...emptyRows]
    });

    // ===== BUAT DOKUMEN =====
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top    : 1000,
              right  : 1000,
              bottom : 1000,
              left   : 1000
            }
          }
        },
        children: [
          headerTable,
          table,
          // Footer
          new Paragraph({
            children: [
              new TextRun({
                text : " ",
                size : 20
              })
            ],
            spacing: { before: 200 }
          })
        ]
      }]
    });

    // ===== DOWNLOAD =====
    Packer.toBlob(doc).then(blob => {
      hideLoading();
      const safeName = event.title
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .replace(/\s+/g, "_");
      downloadFile(blob,
        `DaftarHadir_${safeName}_${getDateStamp()}.docx`
      );
      showToast("✅ Daftar hadir berhasil diexport!", "success");
    });

  } catch(err) {
    hideLoading();
    showToast("Gagal buat dokumen: " + err.message, "error");
    console.error(err);
  }
}

// ===== HELPER: BUAT CELL HEADER =====
function createHeaderCell(text, width) {
  const TableCell   = docx.TableCell;
  const Paragraph   = docx.Paragraph;
  const TextRun     = docx.TextRun;
  const AlignmentType = docx.AlignmentType;
  const WidthType   = docx.WidthType;
  const ShadingType = docx.ShadingType;
  const VerticalAlign = docx.VerticalAlign;

  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: {
      type : ShadingType.CLEAR,
      fill : "E8E8E8"
    },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children : [
          new TextRun({
            text : text,
            bold : true,
            size : 20,
            font : "Arial"
          })
        ]
      })
    ]
  });
}


// ===== HELPER: BUAT CELL DATA =====
function createDataCell(text, width, minHeight = 600) {
  const TableCell   = docx.TableCell;
  const Paragraph   = docx.Paragraph;
  const TextRun     = docx.TextRun;
  const AlignmentType = docx.AlignmentType;
  const WidthType   = docx.WidthType;
  const VerticalAlign = docx.VerticalAlign;

  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing  : {
          before: minHeight / 4,
          after  : minHeight / 4
        },
        children: [
          new TextRun({
            text : text,
            size : 20,
            font : "Arial"
          })
        ]
      })
    ]
  });
}

// ===== HELPER: FORMAT TANGGAL WORD =====
function formatDateWord(isoString) {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleDateString("id-ID", {
    weekday : "long",
    day     : "numeric",
    month   : "long",
    year    : "numeric"
  });
}

// ===== HELPER: FORMAT WAKTU WORD =====
function formatTimeWord(isoString) {
  if (!isoString) return "-";
  return new Date(isoString).toLocaleTimeString("id-ID", {
    hour   : "2-digit",
    minute : "2-digit"
  });
}

// ===== LOAD DOCX.JS =====
function loadDocxJs(callback) {
  // Cek apakah sudah loaded dari <head>
  if (typeof docx !== "undefined") {
    callback();
    return;
  }

  // Tunggu maksimal 10 detik
  let attempts = 0;
  const check = setInterval(() => {
    attempts++;
    if (typeof docx !== "undefined") {
      clearInterval(check);
      callback();
      return;
    }
    if (attempts > 20) {
      clearInterval(check);
      hideLoading();
      showToast(
        "Library Word gagal dimuat. Refresh halaman.",
        "error"
      );
    }
  }, 500);
}


// Export semua event sekaligus ke Word
async function exportAllAttendanceWord() {
  const eventId = document.getElementById("export-event").value;

  if (!eventId || eventId === "all") {
    showToast(
      "Pilih satu event spesifik untuk export Word",
      "warning"
    );
    return;
  }

  await exportAttendanceWord(eventId);
}

  // ===== FETCH GAMBAR SEBAGAI ARRAYBUFFER =====
  async function fetchImageAsBuffer(signatureUrl) {
    try {
      if (!signatureUrl || !signatureUrl.startsWith("http")) {
        return null;
      }

      // Extract fileId dari URL Google Drive
      // Format: https://lh3.googleusercontent.com/d/FILE_ID=w400
      let fileId = null;

      if (signatureUrl.includes("lh3.googleusercontent.com/d/")) {
        fileId = signatureUrl
          .split("/d/")[1]
          .split("=")[0];
      } else if (signatureUrl.includes("id=")) {
        fileId = signatureUrl
          .split("id=")[1]
          .split("&")[0];
      }

      if (!fileId) {
        console.warn("Tidak bisa extract fileId dari URL:", signatureUrl);
        return null;
      }

      // Fetch via GAS proxy
      const result = await callAPI("getImageAsBase64", { fileId });

      if (!result.success || !result.base64) {
        console.warn("Gagal fetch gambar via proxy:", result.message);
        return null;
      }

      // Convert Base64 ke ArrayBuffer
      const binary = atob(result.base64);
      const buffer = new ArrayBuffer(binary.length);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < binary.length; i++) {
        view[i] = binary.charCodeAt(i);
      }

      return { buffer, mimeType: result.mimeType || "image/png" };

    } catch(err) {
      console.warn("Error fetch gambar:", err.message);
      return null;
    }
  }



