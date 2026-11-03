import * as XLSX from "xlsx";

/** Export rows (already labeled with Arabic column headers) to an .xlsx file. */
export function exportToExcel(rows: Record<string, unknown>[], fileName: string, sheetName = "البيانات") {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0] ?? {}).map((k) => ({
    wch: Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length)) + 2,
  }));
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
