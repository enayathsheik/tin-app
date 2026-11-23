import * as XLSX from "xlsx";

function flattenValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value?.toDate === "function") {
    try { return value.toDate().toISOString(); } catch { return String(value); }
  }
  if (Array.isArray(value)) {
    return value.map(v => (v && typeof v === "object") ? (v.category || JSON.stringify(v)) : v).join("; ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

export function exportToExcel(rows, filenamePrefix) {
  if (!rows || !rows.length) return;
  const flatRows = rows.map(row => {
    const flat = {};
    Object.keys(row).forEach(key => { flat[key] = flattenValue(row[key]); });
    return flat;
  });
  const worksheet = XLSX.utils.json_to_sheet(flatRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filenamePrefix}-${dateStr}.xlsx`);
}

// Several sheets in one file: [{ name, rows }]. Rows are plain objects of text
// and numbers; text stays text (a name like "=1+1" is never a formula) and
// https links become clickable.
export function exportSheets(sheets, filenamePrefix) {
  const withRows = sheets.filter(x => x.rows.length);
  if (!withRows.length) return;
  const workbook = XLSX.utils.book_new();
  for (const { name, rows } of withRows) {
    const ws = XLSX.utils.json_to_sheet(rows.map(r => Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k, typeof v === "string" ? v.slice(0, 5000) : v ?? ""]),
    )));
    for (const cell of Object.values(ws)) {
      if (cell?.t === "s" && cell.v.startsWith("https://") && cell.v.length < 2000) cell.l = { Target: cell.v };
    }
    XLSX.utils.book_append_sheet(workbook, ws, name.slice(0, 31));
  }
  XLSX.writeFile(workbook, `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
