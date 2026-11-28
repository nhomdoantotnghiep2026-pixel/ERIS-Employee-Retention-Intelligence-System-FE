import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
const componentPath = new URL(
  "../src/components/AttendanceImport.tsx",
  import.meta.url,
)
const workspacePath = new URL(
  "../src/screens/AttendanceWorkspace.tsx",
  import.meta.url,
)
const reconcilePath = new URL(
  "../src/components/AttendanceReconcile.tsx",
  import.meta.url,
)
const dashboardPath = new URL(
  "../src/screens/AttendanceDashboard.tsx",
  import.meta.url,
)
test("attendance preview exposes validation filters and safe partial-import actions", async () => {
  const source = await readFile(componentPath, "utf8")
  const tabs = ["Tất cả", "Đi trễ", "Về sớm", "Tăng ca / OT", "Đúng giờ", "Lỗi dữ liệu"]
  for (const tab of tabs) assert.ok(source.includes(`vi: "${tab}"`), tab)
  assert.match(source, /Phát hiện .*dòng có lỗi dữ liệu/)
  assert.match(source, /const rowsByFilter = useMemo/)
  assert.match(source, /errorCount > 0/)
  assert.match(source, /Bỏ qua dòng lỗi & Chỉ nhập/)
  assert.match(source, /confirmAttendance\(file, preview.preview_token, choiceList, ack, errorCount > 0\)/)
  assert.match(source, /Xuất báo cáo lỗi \(Excel\)/)
})
test("attendance rows use readable dates, semantic time pills and cell errors", async () => {
  const source = await readFile(componentPath, "utf8")
  assert.match(source, /const workDateLabel/)
  assert.match(source, /weekday: "short"/)
  assert.match(source, /const timePart/)
  assert.match(source, /tr\("Trễ", "Late"\)/)
  assert.match(source, /tr\("Về sớm", "Early"\)/)
  assert.match(source, /minutesLabel\(overtime\).*OT/)
  assert.match(source, /row\.overtime_minutes/)
  assert.match(source, /border-rose-400 bg-rose-50/)
  assert.match(source, /Tổng giờ/)
  assert.doesNotMatch(source, /Tiến độ ca|Shift progress/)
  assert.match(source, /issueTitle\(.*Issues, row\)/)
  assert.match(source, /Trạng thái ghi nhận/)
  assert.doesNotMatch(source, /Kiểm tra tệp/)
  assert.match(source, /isRowError\(row\)/)
  assert.match(source, /Bỏ qua dòng này/)
})
test("attendance footer reports the reviewed scope and confirms only saveable rows", async () => {
  const source = await readFile(componentPath, "utf8")
  assert.match(
    source,
    /Sẵn sàng lưu \$\{formatCount\.format\(saveableRows\.length\)\}\/\$\{formatCount\.format\(preview\.rows\.length\)\} bản ghi/,
  )
  assert.match(
    source,
    /\$\{formatCount\.format\(uniqueEmployees\)\} nhân sự · \$\{dateRangeLabel\(\)\}/,
  )
  assert.match(source, /Đổi tệp khác/)
  assert.match(source, /visibleRows\.map/)
  assert.doesNotMatch(source, /filteredRows\.map/)
  assert.match(source, /row\.issues\.some\(issue => issue\.severity === "WARNING"\)/)
  assert.match(source, /saved\.rows\.filter\(row => row\.action === "INSERT"\)/)
  assert.match(source, /Xác nhận nhập \$\{formatCount\.format\(saveableRows\.length\)\} dòng hợp lệ/)
})
test("attendance workspace exposes unified filters, operational KPIs and import empty state", async () => {
  const source = await readFile(workspacePath, "utf8")
  assert.match(source, /Quỹ giờ tăng ca/)
  assert.match(source, /Trường hợp cần rà soát/)
  assert.match(source, /Tỷ lệ đúng giờ/)
  assert.match(source, /Tổng giờ làm việc/)
  assert.match(source, /Khoảng tùy chỉnh/)
  assert.match(source, /Tên hoặc mã nhân viên \(EMP\.\.\.\)/)
  assert.doesNotMatch(source, /Quy trình nhập dữ liệu chấm công/)
  assert.doesNotMatch(source, /ID nhân viên \(để trống: tất cả\)/)
  assert.doesNotMatch(source, /<pre/)
  assert.match(source, /Chưa có bản ghi chấm công cho kỳ/)
  assert.match(source, /Nhập tệp chấm công ngay/)
  assert.match(source, /\[10, 25, 50, 100\]/)
  assert.match(source, /useState\(25\)/)
  assert.match(source, /<AttendanceDetail/)
  assert.doesNotMatch(source, /auditFieldKeys/)
  assert.match(source, /setFilters\(importedScope\)/)
  assert.match(source, /filteredRows\.slice\(pageOffset, pageOffset \+ pageSize\)/)
})
test("attendance reconciliation supports department filtering and bulk selection", async () => {
  const source = await readFile(reconcilePath, "utf8")
  assert.match(source, /Bù công ngày lễ & Khớp đơn nghỉ phép/)
  assert.match(source, /Tất cả phòng ban/)
  assert.match(source, /Chọn tất cả/)
  assert.match(source, /Bỏ chọn/)
  assert.match(source, /Bù công ngày lễ\/nghỉ phép/)
  assert.match(source, /Vắng không phép \/ Chưa rõ lý do/)
})
test("attendance dashboard uses operational KPIs, area trend and review actions", async () => {
  const source = await readFile(dashboardPath, "utf8")
  assert.match(source, /Tỷ lệ chấm công đúng giờ/)
  assert.match(source, /workHoursArea/)
  assert.match(source, /<Area type="monotone"/)
  assert.match(source, /initials\(item\.fullName\)/)
  assert.match(source, /Gửi nhắc nhở/)
})
