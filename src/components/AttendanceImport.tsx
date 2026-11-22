import { useMemo, useState, type FormEvent } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  CircleX,
  Download,
  FileSpreadsheet,
  Replace,
} from "lucide-react"
import { Button } from "./ui"
import AttendanceFileDropzone from "./AttendanceFileDropzone"
import { useLanguage } from "../context/LanguageContext"
import { useAutoDismissState } from "../hooks/useAutoDismissState"
import {
  attendanceErrors,
  attendanceMessage,
  confirmAttendance,
  previewAttendance,
  saveableAttendanceRows,
  saveDownload,
  type AttendanceBatch,
  type AttendanceChoice,
  type ConfirmResult,
  type ImportIssue,
  type PreviewRow,
} from "../services/attendance"

export type AttendanceImportStage = "idle" | "selected" | "preview" | "saving"

interface AttendanceImportProps {
  onImported: (result: ConfirmResult) => void
  onBusyChange?: (busy: boolean) => void
  onStageChange?: (stage: AttendanceImportStage, detail?: string) => void
  onCancel?: () => void
  activeShiftTypes?: string[]
}

type PreviewFilter = "ALL" | "VALID" | "ERROR"
type ErrorField = "employee" | "work_date" | "shift" | "check_in" | "check_out" | "duration"

const attendanceEventCodes = new Set(["ATT-020", "ATT-023", "ATT-024"])
const errorFields = (code: string): ErrorField[] => ({
  "ATT-003": ["employee"],
  "ATT-004": ["shift"],
  "ATT-005": ["work_date", "check_in", "check_out"],
  "ATT-006": ["check_out"],
  "ATT-007": ["work_date"],
  "ATT-008": ["work_date"],
  "ATT-009": ["employee"],
  "ATT-010": ["duration"],
  "ATT-011": ["work_date"],
  "ATT-012": ["employee", "work_date"],
  "ATT-013": ["employee", "work_date"],
  "ATT-014": ["check_in", "check_out"],
  "ATT-015": ["check_in", "check_out"],
  "ATT-016": ["shift"],
  "ATT-017": ["shift"],
  "ATT-018": ["work_date", "check_in", "check_out"],
  "ATT-019": ["work_date"],
  "ATT-021": ["check_in", "check_out"],
  "ATT-022": ["duration"],
} as Record<string, ErrorField[]>)[code] || []

const timePart = (value: string | null) => {
  if (!value) return "—"
  const match = value.match(/(?:T|\s|^)(\d{2}):(\d{2})/)
  return match ? `${match[1]}:${match[2]}` : value
}

const clockMinutes = (value: string | null) => {
  const match = timePart(value).match(/^(\d{2}):(\d{2})$/)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

const minutesLabel = (minutes: number) => {
  const absolute = Math.abs(minutes)
  if (absolute >= 60 && absolute % 60 === 0) return `${absolute / 60}h`
  if (absolute >= 60) return `${Math.floor(absolute / 60)}h ${absolute % 60}p`
  return `${absolute}p`
}

const fileSize = (size: number) => size >= 1024 * 1024
  ? `${(size / 1024 / 1024).toFixed(1)} MB`
  : `${Math.max(1, Math.round(size / 1024))} KB`

export default function AttendanceImport({
  onImported,
  onBusyChange,
  onStageChange,
  onCancel,
  activeShiftTypes = [],
}: AttendanceImportProps) {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => language === "vi" ? vi : en
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<AttendanceBatch | null>(null)
  const [choices, setChoices] = useState<Record<number, AttendanceChoice>>({})
  const [result, setResult] = useState<ConfirmResult | null>(null)
  const [ack, setAck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [choicesDirty, setChoicesDirty] = useState(false)
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>("ALL")
  const [showShiftCodes, setShowShiftCodes] = useState(false)
  const [error, setError] = useAutoDismissState()

  const choiceList = useMemo(
    () => Object.values(choices).sort((a, b) => a.excel_row - b.excel_row),
    [choices],
  )
  const blockingIssues = (row: PreviewRow) => row.issues.filter(issue =>
    !attendanceEventCodes.has(issue.code)
    && (issue.severity === "ERROR" || Boolean(issue.requires_resolution)),
  )
  const isRowError = (row: PreviewRow) => blockingIssues(row).length > 0
    || (row.validation_status === "ERROR" && !row.issues.length)
  const isExcluded = (row: PreviewRow) => choices[row.excel_row]?.exclude
    ?? (Boolean(row.excluded) || isRowError(row))
  const includedRows = preview?.rows.filter(row => !isExcluded(row)) || []
  const saveableRows = saveableAttendanceRows(includedRows)
  const hasWarnings = saveableRows.some(row => row.issues.some(issue => issue.severity === "WARNING" && !attendanceEventCodes.has(issue.code)))
  const errorCount = preview?.rows.filter(isRowError).length || 0
  const validCount = (preview?.rows.length || 0) - errorCount
  const filteredRows = preview?.rows.filter(row =>
    previewFilter === "ALL" || (previewFilter === "ERROR" ? isRowError(row) : !isRowError(row)),
  ) || []
  const uniqueEmployees = new Set(preview?.rows.map(row => row.employee_code).filter(Boolean)).size
  const previewDates = (preview?.rows.map(row => row.work_date).filter((value): value is string => Boolean(value)) || []).sort()

  function selectFile(next: File | null) {
    setFile(next)
    setPreview(null)
    setChoices({})
    setResult(null)
    setAck(false)
    setChoicesDirty(false)
    setPreviewFilter("ALL")
    setError("")
    onStageChange?.(next ? "selected" : "idle", next?.name)
  }

  function validate() {
    if (!file || !/\.xlsx?$/i.test(file.name) || !file.size || file.size > 10 * 1024 * 1024) {
      setError(tr("Chọn tệp .xlsx hoặc .xls không rỗng, tối đa 10 MB.", "Choose a nonempty .xlsx or .xls file up to 10 MB."))
      return false
    }
    return true
  }

  async function run(task: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    onBusyChange?.(true)
    setError("")
    try {
      await task()
    } catch (cause) {
      setError(attendanceMessage(cause, tr("Không xử lý được tệp chấm công.", "Could not process the attendance file.")))
    } finally {
      setBusy(false)
      onBusyChange?.(false)
    }
  }

  function previewFile(event?: FormEvent) {
    event?.preventDefault()
    if (!validate() || !file) return
    void run(async () => {
      const batch = await previewAttendance(file, choiceList)
      setPreview(batch)
      setResult(null)
      setAck(false)
      setChoicesDirty(false)
      setPreviewFilter("ALL")
      onStageChange?.("preview", String(batch.rows.length))
    })
  }

  function updateChoice(excelRow: number, patch: Partial<AttendanceChoice>) {
    setChoices(current => ({
      ...current,
      [excelRow]: { ...current[excelRow], ...patch, excel_row: excelRow },
    }))
    setResult(null)
    setAck(false)
    setChoicesDirty(true)
  }

  async function confirm() {
    if (!file || !preview || choicesDirty) return
    onStageChange?.("saving")
    await run(async () => {
      const saved = await confirmAttendance(file, preview.preview_token, choiceList, ack, errorCount > 0)
      setResult(saved)
      setPreview(null)
      onImported(saved)
    })
  }

  async function downloadErrors() {
    if (!validate() || !file) return
    await run(async () => saveDownload(await attendanceErrors(file, choiceList), "attendance-errors.xlsx"))
  }

  const issueLabel = (issue: ImportIssue, row?: PreviewRow) => {
    const labels: Record<string, string> = {
      "ATT-002": tr("Cấu trúc hoặc dữ liệu trong tệp không hợp lệ.", "The file structure or data is invalid."),
      "ATT-003": tr(`Mã nhân viên '${row?.employee_code || "—"}' không tồn tại trong danh sách nhân sự.`, "Employee code does not exist."),
      "ATT-004": tr("Ca trong hồ sơ nhân sự hiện không hoạt động.", "The employee profile shift is not active."),
      "ATT-005": tr("Ngày hoặc giờ không đúng định dạng yêu cầu.", "The date or time format is invalid."),
      "ATT-006": tr("Giờ ra phải sau giờ vào.", "Check-out must be after check-in."),
      "ATT-007": tr("Không xác định được ngày công phù hợp với ca.", "No work date matches the configured shift."),
      "ATT-008": tr("Hãy chọn một ngày công trước khi xác nhận.", "Choose a work date before confirming."),
      "ATT-009": tr("Tên nhân viên trong tệp khác hồ sơ hiện tại.", "The employee name differs from the current profile."),
      "ATT-010": tr("Thời lượng làm việc vượt ngưỡng cấu hình.", "The attendance duration exceeds the configured threshold."),
      "ATT-011": tr("Ngày này nằm ngoài lịch làm việc.", "This date is outside the employee schedule."),
      "ATT-012": tr("Đã có bản ghi đang sử dụng cho ngày này.", "An active record already exists for this date."),
      "ATT-013": tr("Tệp có nhiều dòng trùng nhân viên và ngày công.", "The file contains repeated employee/work-date rows."),
      "ATT-014": tr("Cần có đủ giờ vào và giờ ra.", "Both check-in and check-out are required."),
      "ATT-015": tr("Dòng không có giờ vào và giờ ra.", "The row has no check-in or check-out."),
      "ATT-016": tr("Hồ sơ nhân sự chưa có mã ca hợp lệ.", "The employee profile has no valid shift."),
      "ATT-017": tr(`Mã ca '${row?.shift_type || "—"}' không tồn tại hoặc không khớp ca được gán.`, "The file shift code is unknown or does not match the assigned shift."),
      "ATT-018": tr("Ngày hoặc giờ chấm công chưa xảy ra.", "The attendance date or time has not occurred yet."),
      "ATT-019": tr("Ngày công phải từ ngày nhân viên bắt đầu làm việc.", "Attendance must be on or after the hire date."),
      "ATT-020": tr("Thời gian đến sớm không được tính là tăng ca.", "Early arrival is not counted as overtime."),
      "ATT-021": tr("Khoảng thời gian bị trùng với bản ghi chấm công khác.", "The time interval overlaps another attendance record."),
      "ATT-022": tr("Không có thời gian làm việc sau khi trừ giờ nghỉ.", "No working time remains after excluding the break."),
      "ATT-023": tr("Nhân viên đi muộn so với giờ bắt đầu ca.", "Check-in is later than the shift start."),
      "ATT-024": tr("Nhân viên về sớm so với giờ kết thúc ca.", "Check-out is earlier than the shift end."),
    }
    return labels[issue.code] || issue.message
  }

  const cellIssues = (row: PreviewRow, field: ErrorField) => blockingIssues(row).filter(issue => errorFields(issue.code).includes(field))
  const issueTitle = (issues: ImportIssue[], row: PreviewRow) => issues.map(issue => issueLabel(issue, row)).join("\n")
  const fieldClass = (issues: ImportIssue[]) => issues.length
    ? "rounded-lg border border-rose-300 bg-rose-50 px-2 py-1.5 font-semibold text-rose-700"
    : ""
  const workDateLabel = (value?: string) => {
    if (!value) return "—"
    const date = new Date(`${value}T00:00:00Z`)
    if (Number.isNaN(date.getTime())) return value
    const weekday = new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", { weekday: "short", timeZone: "UTC" }).format(date)
    const datePart = new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date)
    return `${weekday}, ${datePart}`
  }
  const dateRangeLabel = () => {
    if (!previewDates.length) return "—"
    const display = (value: string, withYear = false) => {
      const [year, month, day] = value.split("-")
      return withYear ? `${day}/${month}/${year}` : `${day}/${month}`
    }
    const last = previewDates[previewDates.length - 1]
    return previewDates.length === 1 ? display(previewDates[0], true) : `${display(previewDates[0])} – ${display(last, true)}`
  }
  const technicalStatus = (row: PreviewRow) => {
    const issue = blockingIssues(row)[0]
    if (!issue) return tr("Hợp lệ", "Valid")
    if (issue.code === "ATT-003") return tr("Lỗi mã nhân viên", "Employee error")
    if (["ATT-004", "ATT-016", "ATT-017"].includes(issue.code)) return tr("Lỗi mã ca", "Shift error")
    if (["ATT-005", "ATT-006", "ATT-014", "ATT-015"].includes(issue.code)) return tr("Lỗi ngày/giờ", "Date/time error")
    return tr("Dữ liệu chưa hợp lệ", "Invalid data")
  }

  if (!preview) return <div>
    <div className="pr-12">
      <h2 className="text-lg font-semibold text-slate-950">{tr("Nhập dữ liệu chấm công", "Import attendance")}</h2>
      <p className="mt-1 text-sm text-slate-600">{tr("Chọn tệp nguồn để hệ thống kiểm tra trước khi lưu.", "Choose a source file for validation before saving.")}</p>
    </div>
    <form onSubmit={previewFile} className="mt-5">
      <AttendanceFileDropzone file={file} busy={busy} onSelect={selectFile} />
      <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600 sm:grid-cols-3">
        <p><strong className="text-slate-800">1.</strong> {tr("Dùng đúng cột Mã NV, Ngày, Ca, Giờ vào và Giờ ra.", "Use employee code, date, shift, check-in and check-out columns.")}</p>
        <p><strong className="text-slate-800">2.</strong> {tr("Mã nhân viên và mã ca phải tồn tại trong ERIS.", "Employee and shift codes must exist in ERIS.")}</p>
        <p><strong className="text-slate-800">3.</strong> {tr("Xem lại dòng lỗi trước khi xác nhận nhập.", "Review invalid rows before confirming the import.")}</p>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-800">{error}</p>}
      {result && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{tr(`Đã lưu ${result.inserted} bản ghi.`, `Saved ${result.inserted} records.`)}</p>}
      <div className="mt-5 flex justify-end gap-2">
        {onCancel && <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>{tr("Hủy / Đóng", "Cancel / Close")}</Button>}
        <Button type="submit" disabled={!file || busy}>{busy ? tr("Đang kiểm tra…", "Validating…") : tr("Xem trước và kiểm tra", "Preview and validate")}</Button>
      </div>
    </form>
  </div>

  return <div className="flex min-h-[min(760px,calc(100vh-3rem))] flex-col bg-white">
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><FileSpreadsheet size={19} /></span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900" title={file?.name}>{file?.name}</p>
          <p className="text-xs text-slate-500">{file ? fileSize(file.size) : "—"} · {tr(`${preview.rows.length} dòng đã kiểm tra`, `${preview.rows.length} checked rows`)}</p>
        </div>
      </div>
      <button type="button" disabled={busy} onClick={() => selectFile(null)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-50"><Replace size={15} />{tr("Đổi tệp khác", "Choose another file")}</button>
    </header>

    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3">
      <div className="flex rounded-lg border border-slate-200 bg-white p-1">
        {(["ALL", "VALID", "ERROR"] as PreviewFilter[]).map(filter => {
          const count = filter === "ALL" ? preview.rows.length : filter === "VALID" ? validCount : errorCount
          const label = filter === "ALL" ? tr("Tất cả", "All") : filter === "VALID" ? tr("✓ Hợp lệ", "✓ Valid") : tr("⚠ Lỗi dữ liệu", "⚠ Data errors")
          return <button key={filter} type="button" onClick={() => setPreviewFilter(filter)} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${previewFilter === filter ? filter === "ERROR" ? "bg-rose-50 text-rose-700 shadow-sm" : filter === "VALID" ? "bg-emerald-50 text-emerald-700 shadow-sm" : "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{label} ({count})</button>
        })}
      </div>
      <div className="relative flex flex-wrap gap-2">
        {errorCount > 0 && <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void downloadErrors()}><Download size={15} />{tr("Xuất báo cáo lỗi (Excel)", "Export error report")}</Button>}
        <Button type="button" size="sm" variant="secondary" onClick={() => setShowShiftCodes(value => !value)}>{tr("Xem danh sách mã ca hợp lệ", "View valid shift codes")}</Button>
        {showShiftCodes && <div className="absolute right-0 top-11 z-30 w-80 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-xl"><p className="font-semibold text-slate-900">{tr("Mã ca đang hoạt động", "Active shift codes")}</p><p className="mt-2 text-slate-600">{activeShiftTypes.length ? activeShiftTypes.join(" · ") : tr("Chưa tải được danh mục mã ca.", "Shift codes are unavailable.")}</p></div>}
      </div>
    </div>

    {errorCount > 0 && <div className="mx-5 mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p><strong>{tr(`Phát hiện ${errorCount} dòng có lỗi kỹ thuật.`, `${errorCount} rows contain technical errors.`)}</strong> {tr("Các dòng trễ, về sớm hoặc tăng ca vẫn được xem là hợp lệ.", "Late, early-leave and overtime events remain valid.")}</p></div>}

    <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
      <table className="w-full min-w-[1100px] table-fixed text-left text-sm">
        <colgroup><col className="w-[50px]" /><col className="w-[180px]" /><col className="w-[140px]" /><col className="w-[110px]" /><col className="w-[100px]" /><col className="w-[100px]" /><col className="w-[140px]" /><col className="w-[280px]" /></colgroup>
        <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_#e2e8f0]">
          <tr>{[tr("STT", "No."), tr("Nhân viên", "Employee"), tr("Ngày làm việc", "Work date"), tr("Ca làm việc", "Shift"), tr("Giờ vào", "Check-in"), tr("Giờ ra", "Check-out"), tr("Tổng giờ", "Hours"), tr("Trạng thái ghi nhận", "Record status")].map(label => <th key={label} className="px-3 py-3 font-semibold">{label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filteredRows.map((row, index) => {
            const employeeIssues = cellIssues(row, "employee")
            const dateIssues = cellIssues(row, "work_date")
            const shiftIssues = cellIssues(row, "shift")
            const inIssues = cellIssues(row, "check_in")
            const outIssues = cellIssues(row, "check_out")
            const durationIssues = cellIssues(row, "duration")
            const worked = Math.max(0, row.working_minutes || 0)
            const overtime = Math.max(0, (clockMinutes(row.check_out) || 0) - 17 * 60)
            const hasError = isRowError(row)
            const excluded = isExcluded(row)
            return <tr key={row.excel_row} className={`${excluded ? "bg-slate-50 opacity-55" : hasError ? "bg-rose-50/20" : "hover:bg-slate-50/60"}`}>
              <td className="px-3 py-3 font-mono text-xs text-slate-500">{index + 1}</td>
              <td className="px-3 py-3"><div title={issueTitle(employeeIssues, row)} className={fieldClass(employeeIssues)}>{employeeIssues.length > 0 && <span className="mr-1">⚠</span>}<strong className="block font-mono text-xs text-slate-900">{row.employee_code || "—"}</strong><span className="mt-0.5 block truncate text-xs font-normal text-slate-600" title={row.full_name}>{row.full_name || tr("Không tìm thấy hồ sơ", "Profile not found")}</span></div></td>
              <td className="px-3 py-3"><div title={issueTitle(dateIssues, row)} className={fieldClass(dateIssues)}>{dateIssues.length > 0 && <span className="mr-1">⚠</span>}{row.candidates && row.candidates.length > 1 ? <select className="w-full rounded-md border border-slate-300 bg-white p-1.5 text-xs" value={choices[row.excel_row]?.work_date || row.work_date || ""} onChange={event => updateChoice(row.excel_row, { work_date: event.target.value || undefined })}><option value="">{tr("Chọn ngày", "Choose date")}</option>{row.candidates.map(date => <option key={date} value={date}>{workDateLabel(date)}</option>)}</select> : <span className="whitespace-nowrap text-xs font-medium text-slate-700">{workDateLabel(row.work_date)}</span>}</div></td>
              <td className="px-3 py-3"><div title={issueTitle(shiftIssues, row)} className={fieldClass(shiftIssues)}>{shiftIssues.length > 0 && <span className="mr-1">⚠</span>}<span className="inline-flex rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">{row.shift_type || "—"}</span></div></td>
              <td className="px-3 py-3"><div title={issueTitle(inIssues, row)} className={fieldClass(inIssues)}><span className="font-mono font-semibold text-slate-800">{timePart(row.check_in)}</span></div></td>
              <td className="px-3 py-3"><div title={issueTitle(outIssues, row)} className={fieldClass(outIssues)}><span className="font-mono font-semibold text-slate-800">{timePart(row.check_out)}</span></div></td>
              <td className="px-3 py-3"><div title={issueTitle(durationIssues, row)} className={fieldClass(durationIssues)}><span className="font-mono font-semibold text-slate-900">{(worked / 60).toFixed(1)}h</span></div></td>
              <td className="px-3 py-3">{hasError ? <><span title={issueTitle(blockingIssues(row), row)} className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700"><CircleX size={13} />{tr("Lỗi", "Error")}: {technicalStatus(row)}</span><details className="mt-1 text-xs text-slate-600"><summary className="cursor-pointer font-semibold text-rose-700">{tr("Chi tiết", "Details")}</summary><ul className="mt-1 space-y-1">{blockingIssues(row).map((issue, issueIndex) => <li key={`${issue.code}-${issueIndex}`}>{issueLabel(issue, row)}</li>)}</ul></details></> : <div className="flex flex-wrap gap-1.5">{row.late_mins ? <span className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">⏱ {tr("Trễ", "Late")} {minutesLabel(row.late_mins)} ({tr("Hợp lệ", "Valid")})</span> : null}{row.early_mins ? <span className="inline-flex rounded-full border border-orange-300 bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-900">🏃 {tr("Về sớm", "Early")} {minutesLabel(row.early_mins)} ({tr("Hợp lệ", "Valid")})</span> : null}{overtime > 0 ? <span className="inline-flex rounded-full border border-purple-200 bg-purple-50 px-2 py-1 text-xs font-semibold text-purple-700">⚡ +{minutesLabel(overtime)} OT ({tr("Hợp lệ", "Valid")})</span> : null}{!row.late_mins && !row.early_mins && overtime <= 0 && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"><CheckCircle2 size={14} />{tr("Đúng giờ", "On time")}</span>}</div>}<label className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500"><input type="checkbox" checked={excluded} onChange={event => updateChoice(row.excel_row, { exclude: event.target.checked })} />{tr("Bỏ qua dòng này", "Exclude this row")}</label></td>
            </tr>
          })}
        </tbody>
      </table>
      {!filteredRows.length && <div className="flex min-h-52 flex-col items-center justify-center text-center text-sm text-slate-500"><CheckCircle2 className="mb-2 text-emerald-500" />{previewFilter === "ERROR" ? tr("Không có dòng lỗi kỹ thuật.", "No technical errors found.") : tr("Không có dòng phù hợp bộ lọc.", "No rows match this filter.")}</div>}
    </div>

    {choicesDirty && <p className="mx-5 mb-3 rounded-lg bg-blue-50 p-3 text-sm font-medium text-blue-900">{tr("Lựa chọn vừa thay đổi. Hãy kiểm tra lại để backend xác nhận dữ liệu trước khi lưu.", "Choices changed. Revalidate before saving.")}</p>}
    {!choicesDirty && hasWarnings && <label className="mx-5 mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-900"><input className="mt-1" type="checkbox" checked={ack} onChange={event => setAck(event.target.checked)} />{tr("Tôi đã kiểm tra và chấp nhận các cảnh báo nghiệp vụ trước khi lưu.", "I reviewed and accept the business warnings before saving.")}</label>}
    {error && <p role="alert" className="mx-5 mb-3 rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-800">{error}</p>}

    <footer className="sticky bottom-0 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3 shadow-[0_-8px_20px_-18px_rgba(15,23,42,0.5)]">
      <div><p className="text-sm font-semibold text-slate-900">{tr(`Sẵn sàng lưu ${saveableRows.length}/${preview.rows.length} bản ghi`, `Ready to save ${saveableRows.length}/${preview.rows.length} records`)}</p><p className="mt-0.5 text-xs text-slate-500">{errorCount ? tr(`${errorCount} dòng lỗi kỹ thuật sẽ tự động bị bỏ qua`, `${errorCount} technical-error rows will be skipped`) : tr(`${uniqueEmployees} nhân sự · ${dateRangeLabel()}`, `${uniqueEmployees} employees · ${dateRangeLabel()}`)}</p></div>
      <div className="flex flex-wrap gap-2">{onCancel && <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>{tr("Hủy / Đóng", "Cancel / Close")}</Button>}{choicesDirty ? <Button type="button" disabled={busy} onClick={() => previewFile()}>{tr("Kiểm tra lại thay đổi", "Revalidate changes")}</Button> : <Button type="button" disabled={busy || !saveableRows.length || (hasWarnings && !ack)} onClick={() => void confirm()}>{busy ? tr("Đang lưu dữ liệu…", "Saving…") : tr(`Xác nhận nhập ${saveableRows.length} dòng hợp lệ`, `Confirm ${saveableRows.length} valid rows`)}</Button>}</div>
    </footer>
  </div>
}
