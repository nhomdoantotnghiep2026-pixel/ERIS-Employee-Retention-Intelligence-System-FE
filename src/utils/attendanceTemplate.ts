const ATTENDANCE_TEMPLATE_URL = "/templates/ERIS_Attendance_Import_Template.xlsx"

/** Shared download action for the header, empty state and import dialog. */
export function downloadAttendanceTemplate(): void {
  const link = document.createElement("a")
  link.href = ATTENDANCE_TEMPLATE_URL
  link.download = "ERIS_Attendance_Import_Template.xlsx"
  document.body.appendChild(link)
  link.click()
  link.remove()
}
