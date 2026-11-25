import { request, ApiError, getApiErrorMessage } from "./api"
export type Id = string | number
export type RecordStatus = "ACTIVE" | "CANCEL" | "ALL"
export const toLocalApiTime = (value: string) =>
  value.replace("T", " ") + (value.length === 16 ? ":00" : "")
export interface RecordFilters {
  from?: string
  to?: string
  employee_id?: string
  record_status?: RecordStatus
  limit?: number
  offset?: number
}
const query = (filters: RecordFilters = {}) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(filters))
    if (v !== undefined && v !== "") p.set(k, String(v))
  return p.size ? "?" + p : ""
}
export interface ImportedAttendance {
  id: Id
  employee_id: Id
  employee_code: string
  full_name: string
  work_date: string
  check_in: string | null
  check_out: string | null
  working_minutes: number
  late_mins: number
  early_mins: number
  overtime_minutes: number
  record_status: "ACTIVE" | "CANCEL"
  attendance_status?: string
  work_schedule_id?: Id
  record_fingerprint?: string
  cancellation_reason?: string | null
  cancelled_at?: string | null
  cancelled_by?: Id | null
}
export interface AttendanceSummary {
  recorded_days: number
  working_minutes: string | number
  late_mins: string | number
  early_mins: string | number
  overtime_minutes: string | number
}
export interface ImportIssue {
  code: string
  message: string
  severity: "ERROR" | "WARNING" | "INFO"
  requires_resolution?: boolean
}
export interface PreviewRow {
  excel_row: number
  employee_code: string
  full_name?: string
  shift_type: string
  check_in: string | null
  check_out: string | null
  work_date?: string
  candidates?: string[]
  working_minutes?: number
  late_mins?: number
  early_mins?: number
  overtime_minutes?: number
  outside_shift_minutes?: number
  issues: ImportIssue[]
  validation_status: string
  action: "INSERT" | "SKIP" | "CHANGED" | "BLOCKED"
  excluded?: boolean
  previous?: ImportedAttendance | null
}
export interface AttendanceChoice { excel_row: number; work_date?: string; exclude?: boolean }
export interface ConfirmResult {
  status: string
  inserted: number
  updated: number
  skipped: number
  excluded: number
  skipped_invalid?: number
  rows: Array<{ excel_row: number; action: "INSERT" | "SKIP"; attendance_id?: Id }>
}
export interface AttendanceBatch {
  status: string
  rows: PreviewRow[]
  preview_token: string
  expires_in_seconds: number
}
export interface AttendanceAudit {
  id: Id
  action: string
  reason?: string
  occurred_at?: string
  old_values?: unknown
  new_values?: unknown
  actor_id?: Id
  [key: string]: unknown
}
const root = "/v1/attendance"
export const fetchAttendance = (
  filters: RecordFilters,
  own = false,
  signal?: AbortSignal,
) =>
  request<{ data: ImportedAttendance[]; limit: number; offset: number }>(
    root + (own ? "/me" : "") + query(filters),
    { signal, cache: "no-store" },
  )
export const fetchAttendanceSummary = (
  filters: RecordFilters,
  signal?: AbortSignal,
) =>
  request<{ data: AttendanceSummary }>(root + "/summary" + query(filters), {
    signal,
    cache: "no-store",
  })
export const fetchAttendanceDetail = (id: Id) =>
  request<{ data: ImportedAttendance }>(root + "/" + id, { cache: "no-store" })
export const fetchAttendanceAudit = (id: Id, offset = 0) =>
  request<{ data: AttendanceAudit[] }>(
    root + "/" + id + "/audit-logs?limit=20&offset=" + offset,
    { cache: "no-store" },
  )
export const cancelAttendance = (row: ImportedAttendance, reason: string) =>
  request<{ data: ImportedAttendance }>(
    root + "/" + row.id + "/cancel",
    {
      method: "PATCH",
      body: JSON.stringify({
        expected_fingerprint: row.record_fingerprint,
        reason: reason.trim(),
      }),
    },
  )
const importBody = (file: File, options: object) => {
  const body = new FormData()
  body.append("file", file)
  body.append("options", JSON.stringify(options))
  return body
}
export const previewAttendance = (file: File, choices: AttendanceChoice[] = []) =>
  request<AttendanceBatch>(root + "/import/preview", {
    method: "POST",
    body: importBody(file, { choices }),
  })
export const confirmAttendance = (file: File, previewToken: string, choices: AttendanceChoice[], confirmWarnings: boolean, skipInvalid = false) =>
  request<ConfirmResult>(root + "/import/confirm", {
    method: "POST",
    body: importBody(file, { preview_token: previewToken, choices, confirm_warnings: confirmWarnings, duplicate_strategy: "SKIP", ...(skipInvalid ? { skip_invalid: true } : {}) }),
  })
export const attendanceErrors = (file: File, choices: AttendanceChoice[] = []) =>
  request<Blob>(root + "/import/errors", { method: "POST", body: importBody(file, { choices }) }, undefined, "blob")
export const batchBlocked = (b: AttendanceBatch) =>
  b.rows.some(
    (r) =>
      !r.excluded &&
      !["NO_DATA", "INCOMPLETE"].includes(r.validation_status) &&
      (r.validation_status === "ERROR" ||
        r.issues.some((i) => i.requires_resolution)),
  )

export interface ReconcileScope { from: string; to: string; employee_ids: number[] }
export interface ReconcileRow {
  employee_id: number; employee_code: string; full_name?: string; work_date?: string
  attendance_status?: "HOLIDAY" | "ON_LEAVE"; action: "INSERT" | "KEEP" | "ERROR"; warning?: string | null; message?: string
}
export interface ReconcilePreview {
  scope: ReconcileScope; rows: ReconcileRow[]; summary: { prepared: number; kept: number; errors: number }
  status: string; preview_token: string
}
export const previewAttendanceReconcile = (scope: ReconcileScope) =>
  request<ReconcilePreview>(root + "/reconcile/preview", { method: "POST", body: JSON.stringify({ scope }) })
export const confirmAttendanceReconcile = (scope: ReconcileScope, previewToken: string, confirmWarnings: boolean) =>
  request<{ status: string; scope: ReconcileScope; inserted: number; kept: number }>(root + "/reconcile/confirm", {
    method: "POST", body: JSON.stringify({ scope, preview_token: previewToken, confirm_warnings: confirmWarnings }),
  })
export function attendanceMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const messages: Record<string, string> = {
      STALE_PREVIEW:
        "Dữ liệu đã thay đổi. Tải tệp lên lại để tạo bản xem trước mới, kiểm tra và xác nhận lại.",
      ATTENDANCE_CONFLICT:
        "Bản ghi đã thay đổi hoặc trùng dữ liệu chấm công. Tải lại để kiểm tra.",
      LEAVE_CONFLICT:
        "Khoảng ngày này trùng dữ liệu nghỉ đang có hiệu lực. Kiểm tra hồ sơ nghỉ trước khi tiếp tục.",
      BATCH_EXPIRED: "Bản xem trước đã hết hạn. Vui lòng tải tệp lên lại.",
      BATCH_CONFIRMED:
        "Đợt nhập đã được xác nhận. Tải lại để xem kết quả đã lưu.",
      UNRESOLVED_ROWS:
        "Cần xử lý hoặc loại các dòng lỗi và chọn ngày ca còn mơ hồ.",
      INVALID_PREVIEW: "Bản xem trước đã hết hạn hoặc không còn hợp lệ. Hãy kiểm tra lại tệp trước khi lưu.",
      NO_VALID_ROWS: "Không còn dòng hợp lệ để thêm mới. Hãy kiểm tra lại tệp và lựa chọn bỏ qua.",
      WARNINGS_UNCONFIRMED: "Cần đọc và xác nhận cảnh báo trước khi lưu.",
      FILE_CHANGED: "Tệp đã thay đổi. Hãy tạo bản xem trước mới.",
      LEGACY_RECORD:
        "Bản ghi cũ chưa có bản chụp ca. Cần đối soát qua nhập Excel trước khi sửa hoặc khôi phục.",
      LEAVE_TYPE_SCHEMA_MISMATCH:
        "Cơ sở dữ liệu chưa có danh mục mã loại nghỉ theo hợp đồng. Liên hệ người phụ trách BE.",
    }
    if (messages[error.code || ""]) return messages[error.code!]
  }
  return getApiErrorMessage(error, fallback)
}
export function saveDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export interface LeaveType {
  id: number
  code: string
  name: string
  description?: string
}
export interface LeaveRecord {
  id: number
  employee_id: number
  employee_code?: string
  leave_type_id: number
  leave_type?: string
  leave_type_name?: string
  start_date: string
  end_date: string
  reason: string | null
  record_status: "ACTIVE" | "CANCEL"
  recorded_by?: number
  created_at?: string
  updated_at?: string
}
export interface LeaveInput {
  employee_id: number
  leave_type_id: number
  start_date: string
  end_date: string
  reason: string | null
}
export interface LeaveImportRow {
  row: number
  employee_code: string
  leave_type: string
  start_date: string
  end_date: string
  reason: string
  status: "VALID" | "DUPLICATE" | "CONFLICT" | "ERROR"
  message?: string
  code?: string
  id?: number
}
export interface LeavePreview {
  fingerprint: string
  summary: {
    total_rows: number
    valid: number
    duplicate: number
    conflict: number
    error: number
  }
  rows: LeaveImportRow[]
}
export interface LeaveImportResult {
  total_rows: number
  inserted: number
  skipped: number
  conflicted: number
  failed: number
  rows: LeaveImportRow[]
}
export const fetchLeaveTypes = () =>
  request<{ data: LeaveType[] }>("/leave-types", { cache: "no-store" })
export const fetchLeaveRecords = (
  filters: RecordFilters,
  own = false,
  signal?: AbortSignal,
) =>
  request<{ data: LeaveRecord[]; limit: number; offset: number }>(
    "/leave-records" + (own ? "/me" : "") + query(filters),
    { signal, cache: "no-store" },
  )
export const fetchLeaveSummary = (
  filters: RecordFilters,
  signal?: AbortSignal,
) =>
  request<{
    data: Array<{
      employee_id: number
      leave_type_id: number
      records: number
      total_days: number
      total_hours: null
    }>
    hours_note: string
  }>("/leave-records/summary" + query(filters), { signal, cache: "no-store" })
export const createLeaveRecord = (input: LeaveInput) =>
  request<LeaveRecord>("/leave-records", {
    method: "POST",
    body: JSON.stringify(input),
  })
export const cancelLeaveRecord = (id: number, reason: string) =>
  request<LeaveRecord>("/leave-records/" + id + "/cancel", {
    method: "PATCH",
    body: JSON.stringify({ reason: reason.trim() }),
  })
export const previewLeaveFile = (file: File) => {
  const body = new FormData()
  body.append("file", file)
  return request<LeavePreview>("/leave-records/import/preview", {
    method: "POST",
    body,
  })
}
export const confirmLeaveFile = (file: File, fingerprint: string) => {
  const body = new FormData()
  body.append("file", file)
  body.append("fingerprint", fingerprint)
  return request<LeaveImportResult>("/leave-records/import/confirm", {
    method: "POST",
    body,
  })
}

export const saveableAttendanceRows = (rows: PreviewRow[]) => rows.filter(row =>
  !row.excluded && row.action === "INSERT" && ["VALID", "WARNING"].includes(row.validation_status)
  && !row.issues.some(issue => issue.severity === "ERROR" || issue.requires_resolution))
