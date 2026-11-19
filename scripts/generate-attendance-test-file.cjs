const path = require("node:path")

const ExcelJS = require(
  path.resolve(
    __dirname,
    "../../ERIS-Employee-Retention-Intelligence-System-BE/node_modules/exceljs",
  ),
)

const outputPath = path.resolve(
  __dirname,
  "../test-data/ERIS_Attendance_Import_Test.xlsx",
)

async function generate() {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet("Attendance")

  worksheet.columns = [
    { header: "employee_code", key: "employee_code", width: 24 },
    { header: "employee_name", key: "employee_name", width: 28 },
    { header: "shift_type", key: "shift_type", width: 20 },
    { header: "check_in", key: "check_in", width: 24 },
    { header: "check_out", key: "check_out", width: 24 },
  ]

  worksheet.addRows([
    {
      employee_code: "EMP001",
      employee_name: "",
      shift_type: "DAY",
      check_in: "2026-11-17 08:00:00",
      check_out: "2026-11-17 17:00:00",
    },
    {
      employee_code: "EMP002",
      employee_name: "",
      shift_type: "DAY",
      check_in: "2026-11-17 08:05:00",
      check_out: "2026-11-17 17:10:00",
    },
    {
      employee_code: "EMP003",
      employee_name: "",
      shift_type: "DAY",
      check_in: "2026-11-18 07:55:00",
      check_out: "2026-11-18 17:00:00",
    },
  ])

  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF334155" },
  }
  worksheet.views = [{ state: "frozen", ySplit: 1 }]
  worksheet.autoFilter = "A1:E4"

  await workbook.xlsx.writeFile(outputPath)
  console.log(outputPath)
}

generate().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
