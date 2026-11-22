import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const componentPath = new URL("../src/components/AttendanceImport.tsx", import.meta.url)
const workspacePath = new URL("../src/screens/AttendanceWorkspace.tsx", import.meta.url)
const reconcilePath = new URL("../src/components/AttendanceReconcile.tsx", import.meta.url)
const dashboardPath = new URL("../src/screens/AttendanceDashboard.tsx", import.meta.url)

test("attendance preview exposes validation filters and safe partial-import actions", async () => {
  const source = await readFile(componentPath, "utf8")

  assert.match(source, /type PreviewFilter = "ALL" \| "VALID" \| "ERROR"/)
  assert.match(source, /Phát hiện \$\{errorCount\} dòng có lỗi kỹ thuật/)
  assert.match(source, /tr\("Tất cả", "All"\)/)
  assert.match(source, /tr\("✓ Hợp lệ", "✓ Valid"\)/)
  assert.match(source, /tr\("⚠ Lỗi dữ liệu", "⚠ Data errors"\)/)
  assert.match(source, /errorCount > 0/)
  assert.match(source, /dòng lỗi kỹ thuật sẽ tự động bị bỏ qua/)
  assert.match(source, /Xuất báo cáo lỗi \(Excel\)/)
})

test("attendance rows use readable dates, semantic time pills, timelines and cell errors", async () => {
  const source = await readFile(componentPath, "utf8")

  assert.match(source, /const workDateLabel/)
  assert.match(source, /weekday: "short"/)
  assert.match(source, /const timePart/)
  assert.match(source, /tr\("Trễ", "Late"\)/)
  assert.match(source, /tr\("Về sớm", "Early"\)/)
  assert.match(source, /minutesLabel\(overtime\).*OT/)
  assert.match(source, /attendanceEventCodes/)
  assert.match(source, /border-rose-300 bg-rose-50/)
  assert.match(source, /issueTitle\(.*Issues, row\)/)
  assert.match(source, /Trạng thái ghi nhận/)
  assert.doesNotMatch(source, /Kiểm tra tệp/)
  assert.match(source, /isRowError\(row\)/)
  assert.match(source, /Bỏ qua dòng này/)
})

test("attendance footer reports the reviewed scope and confirms only saveable rows", async () => {
  const source = await readFile(componentPath, "utf8")

  assert.match(source, /Sẵn sàng lưu \$\{saveableRows\.length\}\/\$\{preview\.rows\.length\} bản ghi/)
  assert.match(source, /\$\{uniqueEmployees\} nhân sự · \$\{dateRangeLabel\(\)\}/)
  assert.match(source, /Đổi tệp khác/)
  assert.match(source, /Xác nhận nhập \$\{saveableRows\.length\} dòng hợp lệ/)
})

test("attendance workspace exposes dynamic period KPIs, stepper and import empty state", async () => {
  const source = await readFile(workspacePath, "utf8")

  assert.match(source, /Tổng nhân sự kỳ này/)
  assert.match(source, /Tiến độ nạp công/)
  assert.match(source, /Tỷ lệ đúng giờ kỳ trước/)
  assert.match(source, /Tổng giờ OT tháng/)
  assert.match(source, /importStage === "preview"/)
  assert.match(source, /Chưa có bản ghi chấm công cho kỳ/)
  assert.match(source, /Nhập tệp chấm công ngay/)
  assert.match(source, /Tìm tên hoặc mã nhân viên/)
  assert.match(source, /\[20, 50, 100\]/)
  assert.match(source, /Chờ giải trình \/ bù công/)
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
