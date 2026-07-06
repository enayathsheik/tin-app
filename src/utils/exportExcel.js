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
