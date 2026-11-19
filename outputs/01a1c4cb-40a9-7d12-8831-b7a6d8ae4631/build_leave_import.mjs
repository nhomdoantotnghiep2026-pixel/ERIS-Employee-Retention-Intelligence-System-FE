import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(outputDir, "ERIS_EMP013_Leave_Import_2_Days.xlsx");
const previewPath = path.join(outputDir, "ERIS_EMP013_Leave_Import_2_Days_preview.png");

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Leave records");
sheet.showGridLines = false;
sheet.freezePanes.freezeRows(1);

sheet.getRange("A1:E2").values = [
  ["employee_code", "leave_type", "start_date", "end_date", "reason"],
  ["EMP013", "LT001", "2026-10-05", "2026-10-06", "Nghỉ phép năm để kiểm thử dữ liệu AI"],
];

sheet.getRange("A1:E2").format.font = { name: "Arial", size: 10, color: "#0F172A" };
sheet.getRange("A1:E2").format.verticalAlignment = "center";
sheet.getRange("A1:E1").format = {
  fill: "#1E293B",
  font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  borders: {
    insideVertical: { style: "thin", color: "#FFFFFF" },
    bottom: { style: "medium", color: "#F97316" },
  },
};
sheet.getRange("A2:E2").format = {
  fill: "#FFF7ED",
  font: { name: "Arial", size: 10, color: "#0F172A" },
  verticalAlignment: "center",
  borders: { bottom: { style: "thin", color: "#CBD5E1" } },
};
sheet.getRange("A2:B2").format.horizontalAlignment = "center";
sheet.getRange("C2:D2").format.horizontalAlignment = "center";
sheet.getRange("A1:A2").format.columnWidth = 18;
sheet.getRange("B1:B2").format.columnWidth = 14;
sheet.getRange("C1:D2").format.columnWidth = 16;
sheet.getRange("E1:E2").format.columnWidth = 42;
sheet.getRange("1:1").format.rowHeight = 24;
sheet.getRange("2:2").format.rowHeight = 24;

workbook.recalculate();

const inspection = await workbook.inspect({
  kind: "table",
  range: "'Leave records'!A1:E2",
  include: "values,formulas",
  tableMaxRows: 5,
  tableMaxCols: 8,
  maxChars: 5000,
});
console.log(inspection.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 50 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const preview = await workbook.render({
  sheetName: "Leave records",
  range: "A1:E2",
  scale: 2,
  format: "png",
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);

const saved = await FileBlob.load(outputPath);
const reopened = await SpreadsheetFile.importXlsx(saved);
const savedInspection = await reopened.inspect({
  kind: "table",
  range: "'Leave records'!A1:E2",
  include: "values,formulas",
  tableMaxRows: 5,
  tableMaxCols: 8,
  maxChars: 5000,
});
console.log(savedInspection.ndjson);
console.log(`OUTPUT=${outputPath}`);
console.log(`PREVIEW=${previewPath}`);
