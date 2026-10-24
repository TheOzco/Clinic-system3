export type ExcelRow = Record<string, string | number | boolean | null | undefined>;

export async function exportExcel(
  fileName: string,
  sheets: Array<{ name: string; rows: ExcelRow[] }>,
) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const safeName = sheet.name.replace(/[\\/?*\[\]:]/g, "-").slice(0, 31) || "گزارش";
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows.length > 0 ? sheet.rows : [{ وضعیت: "بدون اطلاعات" }]);
    worksheet["!dir"] = "rtl";
    worksheet["!cols"] = Object.keys(sheet.rows[0] ?? { وضعیت: "" }).map((key) => ({
      wch: Math.min(42, Math.max(14, key.length + 8)),
    }));
    XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
  }

  XLSX.writeFile(workbook, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`, {
    compression: true,
  });
}
