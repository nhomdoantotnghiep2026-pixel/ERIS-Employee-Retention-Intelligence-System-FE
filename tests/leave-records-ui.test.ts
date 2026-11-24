import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const screenPath = new URL("../src/screens/LeaveRecords.tsx", import.meta.url)
const drawerPath = new URL(
  "../src/components/leave/LeaveRecordDrawer.tsx",
  import.meta.url,
)
const importDialogPath = new URL(
  "../src/components/leave/LeaveImportDialog.tsx",
  import.meta.url,
)

test("leave records provides humanized identity, unified filters and operational KPIs", async () => {
  const source = await readFile(screenPath, "utf8")

  assert.match(source, /listEmployeeProfiles/)
  assert.match(source, /profile\?\.fullName/)
  assert.match(source, /Tìm theo tên hoặc mã EMP/)
  assert.match(source, /Tất cả loại nghỉ/)
  assert.match(source, /Hồ sơ hợp lệ/)
  assert.match(source, /Nhân viên có nghỉ/)
  assert.match(source, /Tổng ngày nghỉ/)
  assert.match(source, /max-w-xs truncate/)
  assert.match(source, /recordDayCount\(record\)/)
  assert.doesNotMatch(source, /Quy trình nhập dữ liệu ngày nghỉ/)
  assert.doesNotMatch(source, /type="number"/)
})

test("leave record details and cancellation share one accessible drawer", async () => {
  const source = await readFile(drawerPath, "utf8")

  assert.match(source, /role="dialog"/)
  assert.match(source, /slide-in-from-right/)
  assert.match(source, /Thông tin kiểm tra/)
  assert.match(source, /Lý do hủy/)
  assert.match(source, /disabled=\{busy \|\| !cancellationReason\.trim\(\)\}/)
})

test("leave import workflow lives only inside the import dialog", async () => {
  const [source, screen] = await Promise.all([
    readFile(importDialogPath, "utf8"),
    readFile(screenPath, "utf8"),
  ])

  assert.match(source, /Tiến trình nhập dữ liệu/)
  assert.match(source, /Kéo thả tệp vào đây/)
  assert.match(source, /Xác nhận nhập hồ sơ nghỉ/)
  assert.match(source, /onMouseDown/)
  assert.match(source, /role="alert"/)
  assert.match(source, /Không thể nhập tệp/)
  assert.match(source, /unable to read file/i)
  assert.match(screen, /error && !importModalOpen/)
  assert.match(screen, /error=\{error\}/)
})
