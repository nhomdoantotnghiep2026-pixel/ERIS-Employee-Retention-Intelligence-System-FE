import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const componentPath = new URL("../src/components/AttendanceImport.tsx", import.meta.url)

test("attendance preview exposes validation filters and safe partial-import actions", async () => {
  const source = await readFile(componentPath, "utf8")

  assert.match(source, /type PreviewFilter = "ALL" \| "VALID" \| "ERROR"/)
  assert.match(source, /Phát hiện \$\{errorCount\} dòng có lỗi dữ liệu/)
  assert.match(source, /tr\("Tất cả", "All"\)/)
  assert.match(source, /tr\("✓ Hợp lệ", "✓ Valid"\)/)
  assert.match(source, /tr\("⚠ Có lỗi", "⚠ Errors"\)/)
  assert.match(source, /confirm\(true\)/)
  assert.match(source, /Bỏ qua dòng lỗi & Chỉ nhập/)
  assert.match(source, /Xuất báo cáo lỗi \(Excel\)/)
})

test("attendance rows use readable dates, semantic time pills, timelines and cell errors", async () => {
  const source = await readFile(componentPath, "utf8")

  assert.match(source, /const workDateLabel/)
  assert.match(source, /weekday: "short"/)
  assert.match(source, /const timePart/)
  assert.match(source, /tr\("muộn", "late"\)/)
  assert.match(source, /tr\("sớm", "early"\)/)
  assert.match(source, /minutesLabel\(overtime, "OT"\)/)
  assert.match(source, /worked \/ 480 \* 100/)
  assert.match(source, /border-rose-400 bg-rose-50\/80/)
  assert.match(source, /issueTitle\(.*Issues, row\)/)
  assert.match(source, /Tình trạng kiểm tra/)
})

test("attendance footer reports the reviewed scope and confirms only saveable rows", async () => {
  const source = await readFile(componentPath, "utf8")

  assert.match(source, /Tổng cộng: \$\{validCount\}\/\$\{preview\.rows\.length\} bản ghi hợp lệ/)
  assert.match(source, /\$\{uniqueEmployees\} nhân sự/)
  assert.match(source, /Thời gian: \$\{dateRangeLabel\(\)\}/)
  assert.match(source, /Quay lại chọn tệp khác/)
  assert.match(source, /Xác nhận & Lưu dữ liệu \(\$\{saveableRows\.length\} bản ghi\)/)
})
