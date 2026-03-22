const SHEETS_BASE = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}`;

let _sheetIdMap = {};
let _columnIndexMap = {};

// ── Request 1: metadata ────────────────────────────────────────────────────

async function sheetsInit() {
  const response = await sheetsRequest(`${SHEETS_BASE}?fields=sheets.properties`);
  response.sheets.forEach((sheetEntry) => {
    _sheetIdMap[sheetEntry.properties.title] = sheetEntry.properties.sheetId;
  });
}

// ── Validation (pure, no API call) ─────────────────────────────────────────

function validateAndMapHeaders(schemaList, valueRanges) {
  const issues = [];
  const newMap = {};

  // Check all schema sheets exist in spreadsheet metadata
  schemaList.forEach(({ sheet }) => {
    if (!(_sheetIdMap[sheet] !== undefined)) {
      issues.push({ issue: "Sheet missing from spreadsheet", sheet, column: "—" });
    }
  });

  // Check headers match schema for each sheet
  schemaList.forEach(({ sheet, columns }, i) => {
    const headers = valueRanges[i].values?.[0] || [];
    newMap[sheet] = {};

    columns.forEach((col) => {
      const idx = headers.indexOf(col);
      if (idx === -1) {
        issues.push({ issue: "Column missing from sheet", sheet, column: col });
      } else {
        newMap[sheet][col] = idx;
      }
    });

    headers.forEach((header) => {
      if (!columns.includes(header)) {
        issues.push({ issue: "Column missing from schema", sheet, column: header });
      }
    });
  });

  if (issues.length > 0) {
    console.table(issues);
    sessionStorage.setItem("schemaIssues", JSON.stringify(issues));
    window.location.href = "500.html";
    throw new Error("Schema validation failed — redirecting.");
  }

  return newMap;
}

// ── Request 2: headers + data ──────────────────────────────────────────────

async function sheetsBatchGetAll(schemaList) {
  const ranges = schemaList.map(({ sheet }) => `${sheet}!A1:Z1001`);
  const query = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const response = await sheetsRequest(`${SHEETS_BASE}/values:batchGet?valueRenderOption=UNFORMATTED_VALUE&${query}`);

  _columnIndexMap = validateAndMapHeaders(schemaList, response.valueRanges);

  return response.valueRanges.map((valueRange, i) => {
    const { sheet, columns } = schemaList[i];
    const allRows = valueRange.values || [];
    const rows = [];
    for (let r = 1; r < allRows.length; r++) {
      const row = allRows[r];
      if (!row[0]) { continue; }
      const rowData = {};
      columns.forEach((col) => {
        const idx = _columnIndexMap[sheet][col];
        rowData[col] = row[idx] !== undefined ? row[idx] : "";
      });
      rows.push(rowData);
    }
    return rows;
  });
}

// ── Write operations (use _columnIndexMap for correct column positions) ────

async function sheetsAppend(sheetName, columns, rowData) {
  const colMap = _columnIndexMap[sheetName];
  const maxIdx = Math.max(...columns.map((c) => colMap[c]));
  const values = new Array(maxIdx + 1).fill("");
  columns.forEach((col) => { values[colMap[col]] = rowData[col] !== undefined ? rowData[col] : ""; });
  await sheetsRequest(
    `${SHEETS_BASE}/values/${encodeURIComponent(sheetName)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values: [values] }) },
  );
}

async function sheetsUpdateRow(sheetName, columns, rowIndex, partialRowData) {
  const colMap = _columnIndexMap[sheetName];
  const data = Object.entries(partialRowData)
    .filter(([key]) => columns.includes(key))
    .map(([key, value]) => ({
      range: `${sheetName}!${String.fromCharCode(65 + colMap[key])}${rowIndex}`,
      values: [[value !== undefined && value !== null ? value : ""]],
    }));
  if (!data.length) { return; }
  await sheetsRequest(`${SHEETS_BASE}/values:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ valueInputOption: "RAW", data }),
  });
}

async function sheetsDeleteRow(sheetName, rowIndex) {
  const sheetId = _sheetIdMap[sheetName];
  await sheetsRequest(`${SHEETS_BASE}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        },
      ],
    }),
  });
}

function sheetsNewId() {
  return crypto.randomUUID();
}

async function sheetsGetRowIndexById(sheetName, idValue) {
  const response = await sheetsRequest(
    `${SHEETS_BASE}/values/${encodeURIComponent(`${sheetName}!A:A`)}`,
  );
  const rows = response.values || [];
  const dataIndex = rows.slice(1).findIndex((row) => row[0] === idValue);
  if (dataIndex < 0) {
    throw new Error(`Id "${idValue}" not found in ${sheetName}`);
  }

  return dataIndex + 2;
}

async function sheetsRequest(url, options = {}) {
  const token = window.auth.getToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData.error && errorData.error.message) || `HTTP ${response.status}`,
    );
  }

  return response.json();
}

window.sheets = {
  init: sheetsInit,
  append: sheetsAppend,
  updateRow: sheetsUpdateRow,
  deleteRow: sheetsDeleteRow,
  newId: sheetsNewId,
  batchGetAll: sheetsBatchGetAll,
  getRowIndexById: sheetsGetRowIndexById,
};
