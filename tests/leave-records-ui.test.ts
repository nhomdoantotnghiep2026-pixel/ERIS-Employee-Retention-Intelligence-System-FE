import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { displayLeaveReason, leaveCalendarDays, leaveTypeDisplay } from "../src/utils/leaveRecordDisplay.ts"

const vi = (label: string) => label

test("leave display localizes catalogue codes and hides synthetic reasons", () => {
  assert.equal(leaveTypeDisplay("LT008", "PATERNITY", vi).label, "Nghỉ thai sản (Nam)")
  assert.equal(leaveTypeDisplay("LT002", "Sick", vi).kind, "SICK")
  assert.equal(leaveTypeDisplay("LT012", "Nghỉ không hưởng lương", vi).kind, "UNPAID")
  assert.equal(leaveTypeDisplay("lt999", "lt999", vi).label, "Loại nghỉ khác")
  assert.equal(displayLeaveReason("SYNTHETIC_EMP040", true, vi), "Nghỉ phép thường niên theo kế hoạch cá nhân")
  assert.equal(displayLeaveReason("SYNTHETIC_EMP040", false, vi), "Chưa có lý do đã xác minh")
  assert.equal(displayLeaveReason("Khám sức khỏe", false, vi), "Khám sức khỏe")
  assert.equal(leaveCalendarDays({ start_date: "2026-10-31", end_date: "2026-11-02" }, "2026-11-01"), 2)
})

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
  assert.match(source, /employeeForRecord\(record\)\?\.fullName/)
  assert.match(source, /Tìm theo tên, mã NV hoặc lý do/)
  assert.match(source, /Tất cả loại nghỉ/)
  assert.match(source, /Hồ sơ hợp lệ/)
  assert.match(source, /Nhân viên nghỉ/)
  assert.match(source, /Tổng ngày nghỉ/)
  assert.match(source, /line-clamp-2/)
  assert.match(source, /recordDayCount\(record\)/)
  assert.match(source, /PAGE_SIZE = 25/)
  assert.match(source, /sortedRows\.slice\(pageOffset/)
  assert.doesNotMatch(source, /RowActionsMenu/)
  assert.doesNotMatch(source, /Quy trình nhập dữ liệu ngày nghỉ/)
  assert.doesNotMatch(source, /type="number"/)
})

test("leave record details and cancellation share one accessible drawer", async () => {
  const source = await readFile(drawerPath, "utf8")

  assert.match(source, /<dialog ref=\{dialogRef\}/)
  assert.match(source, /slide-in-from-right/)
  assert.match(source, /Lịch sử ghi nhận & phê duyệt/)
  assert.match(source, /Lý do hủy/)
  assert.match(source, /fetchLeaveSummary/)
  assert.match(source, /Chưa có dữ liệu đính kèm/)
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
