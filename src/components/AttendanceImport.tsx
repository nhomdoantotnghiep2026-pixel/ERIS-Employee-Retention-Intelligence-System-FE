import { SelectControl } from "./ui/select-control"
import { useMemo, useRef, useState, type FormEvent } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  CircleX,
  Clock3,
  Download,
  FileSpreadsheet,
  Footprints,
  Replace,
  Zap,
} from "lucide-react"
import { Popover } from "radix-ui"
import { Button } from "./ui"
import AttendanceFileDropzone from "./AttendanceFileDropzone"
import { useLanguage } from "../context/LanguageContext"
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
  onImported: (result: ConfirmResult, dates: { from: string; to: string } | null) => void
  onBusyChange?: (busy: boolean) => void
  onStageChange?: (stage: AttendanceImportStage, detail?: string) => void
  onCancel?: () => void
  activeShiftTypes?: string[]
}

const previewTabs = [
  { id: "ALL", vi: "Tất cả", en: "All", icon: null, idle: "text-slate-700 hover:bg-slate-100", active: "border-slate-900 bg-slate-900 text-white" },
  { id: "LATE", vi: "Đi trễ", en: "Late", icon: Clock3, idle: "text-amber-900 hover:bg-amber-50", active: "border-amber-300 bg-amber-100 text-amber-950" },
  { id: "EARLY", vi: "Về sớm", en: "Early departure", icon: Footprints, idle: "text-orange-900 hover:bg-orange-50", active: "border-orange-300 bg-orange-100 text-orange-950" },
  { id: "OT", vi: "Tăng ca / OT", en: "Overtime", icon: Zap, idle: "text-purple-900 hover:bg-purple-50", active: "border-purple-300 bg-purple-100 text-purple-950" },
  { id: "ON_TIME", vi: "Đúng giờ", en: "On time", icon: CheckCircle2, idle: "text-emerald-900 hover:bg-emerald-50", active: "border-emerald-300 bg-emerald-100 text-emerald-950" },
  { id: "ERROR", vi: "Lỗi dữ liệu", en: "Data errors", icon: AlertTriangle, idle: "text-slate-600 hover:bg-slate-100", active: "border-slate-300 bg-slate-100 text-slate-800" },
] as const
type PreviewFilter = typeof previewTabs[number]["id"]
type ErrorField = "employee" | "work_date" | "shift" | "check_in" | "check_out" | "duration"

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

const minutesLabel = (minutes: number) => {
  const absolute = Math.abs(minutes)
  if (absolute >= 60 && absolute % 60 === 0) return `${absolute / 60}h`
  if (absolute >= 60) return `${Math.floor(absolute / 60)}h ${absolute % 60}p`
  return `${absolute}p`
}

const fileSize = (size: number) => size >= 1024 * 1024
  ? `${(size / 1024 / 1024).toFixed(1)} MB`
  : `${Math.max(1, Math.round(size / 1024))} KB`

const blockingIssues = (row: PreviewRow) => row.issues.filter(issue =>
  issue.severity === "ERROR" || Boolean(issue.requires_resolution),
)
const isRowError = (row: PreviewRow) => blockingIssues(row).length > 0
  || row.validation_status === "ERROR"

const isExcluded = (row: PreviewRow, choices: Record<number, AttendanceChoice>) =>
  choices[row.excel_row]?.exclude ?? (Boolean(row.excluded) || isRowError(row))

function previewEvents(row: PreviewRow) {
  const late = (row.late_mins ?? 0) > 0
  const early = (row.early_mins ?? 0) > 0
  const overtime = Math.max(0, row.overtime_minutes ?? 0)
  const hasTimes = Boolean(row.check_in && row.check_out && row.working_minutes != null)
  return { late, early, overtime, hasTimes, onTime: hasTimes && !late && !early && overtime === 0 }
}

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
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const pending = useRef(false)
  const tableViewport = useRef<HTMLDivElement>(null)
  const warningCheckbox = useRef<HTMLInputElement>(null)

  const choiceList = useMemo(
    () => Object.values(choices).sort((a, b) => a.excel_row - b.excel_row),
    [choices],
  )
  const includedRows = useMemo(() => preview?.rows.filter(row => !isExcluded(row, choices)) ?? [], [preview, choices])
  const saveableRows = useMemo(() => saveableAttendanceRows(includedRows), [includedRows])
  const hasWarnings = useMemo(() => includedRows.some(row =>
    (row.action === "INSERT" || row.action === "SKIP") && !isRowError(row)
    && row.issues.some(issue => issue.severity === "WARNING"),
  ), [includedRows])
  const rowsByFilter = useMemo(() => {
    const groups: Record<PreviewFilter, PreviewRow[]> = {
      ALL: preview?.rows ?? [], LATE: [], EARLY: [], OT: [], ON_TIME: [], ERROR: [],
    }
    for (const row of groups.ALL) {
      if (isRowError(row)) {
        groups.ERROR.push(row)
        continue
      }
      const { late, early, overtime, onTime } = previewEvents(row)
      if (late) groups.LATE.push(row)
      if (early) groups.EARLY.push(row)
      if (overtime > 0) groups.OT.push(row)
      if (onTime) groups.ON_TIME.push(row)
    }
    return groups
  }, [preview])
  const errorCount = rowsByFilter.ERROR.length
  const filteredRows = rowsByFilter[previewFilter]
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageStart = (currentPage - 1) * pageSize
  const visibleRows = useMemo(() => filteredRows.slice(pageStart, pageStart + pageSize), [filteredRows, pageStart, pageSize])
  const uniqueEmployees = useMemo(() => new Set(saveableRows.map(row => row.employee_code).filter(Boolean)).size, [saveableRows])
  const previewDates = useMemo(() => saveableRows.flatMap(row => row.work_date ? [row.work_date] : []).sort(), [saveableRows])
  const canConfirm = !busy && !choicesDirty && saveableRows.length > 0 && (!hasWarnings || ack)
  const [formatCount, formatWeekday, formatDate] = useMemo(() => {
    const locale = language === "vi" ? "vi-VN" : "en-US"
    return [
      new Intl.NumberFormat(locale),
      new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }),
      new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }),
    ] as const
  }, [language])

  function goToPage(next: number) {
    setPage(next)
    if (tableViewport.current) tableViewport.current.scrollTop = 0
  }

  function switchFilter(filter: PreviewFilter) {
    setPreviewFilter(filter)
    goToPage(1)
  }

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
    if (pending.current) return
    pending.current = true
    setBusy(true)
    onBusyChange?.(true)
    setError("")
    try {
      await task()
    } catch (cause) {
      setError(attendanceMessage(cause, tr("Không xử lý được tệp chấm công.", "Could not process the attendance file.")))
    } finally {
      pending.current = false
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
      switchFilter("ALL")
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
    if (!file || !preview || !canConfirm || pending.current) return
    onStageChange?.("saving")
    await run(async () => {
      const saved = await confirmAttendance(file, preview.preview_token, choiceList, ack, errorCount > 0)
      setResult(saved)
      setPreview(null)
      const inserted = new Set(saved.rows.filter(row => row.action === "INSERT").map(row => row.excel_row))
      const dates = saveableRows.flatMap(row => inserted.has(row.excel_row) && row.work_date ? [row.work_date] : []).sort()
      onImported(saved, dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null)
    })
  }

  function confirmValidRows() {
    if (hasWarnings && !ack) {
      warningCheckbox.current?.focus()
      return
    }
    void confirm()
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
    ? "inline-flex max-w-full items-center gap-1.5 rounded-md border border-rose-400 bg-rose-50 px-2 py-1 font-semibold text-rose-700"
    : ""
  const errorIcon = (issues: ImportIssue[]) => issues.length > 0
    ? <AlertTriangle size={14} className="shrink-0 text-rose-700" aria-hidden="true" />
    : null
  const workDateLabel = (value?: string) => {
    if (!value) return "—"
    const date = new Date(`${value}T00:00:00Z`)
    if (Number.isNaN(date.getTime())) return value
    return `${formatWeekday.format(date)}, ${formatDate.format(date)}`
  }
  const dateRangeLabel = () => {
    if (!previewDates.length) return "—"
    const display = (value: string, withYear = false) => {
      const [year, month, day] = value.split("-")
      return withYear ? `${day}/${month}/${year}` : `${day}/${month}`
    }
    const last = previewDates[previewDates.length - 1]
    const first = previewDates[0]
    return first === last ? display(first, true) : `${display(first, first.slice(0, 4) !== last.slice(0, 4))} – ${display(last, true)}`
  }
  const technicalStatus = (row: PreviewRow) => {
    const issue = blockingIssues(row)[0]
    if (!issue) return tr("Dữ liệu chưa hợp lệ", "Invalid data")
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

  return <div className="flex h-[min(850px,calc(100dvh-2rem))] flex-col bg-white">
    <header className="flex min-h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><FileSpreadsheet size={19} /></span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900" title={file?.name}>{file?.name}</p>
          <p className="text-xs text-slate-500">{file ? fileSize(file.size) : "—"} · {tr(`${formatCount.format(preview.rows.length)} dòng đã kiểm tra`, `${formatCount.format(preview.rows.length)} checked rows`)}</p>
        </div>
      </div>
      <button type="button" disabled={busy} onClick={() => selectFile(null)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-50"><Replace size={15} />{tr("Đổi tệp khác", "Choose another file")}</button>
    </header>

    <div className="shrink-0 border-b border-slate-200 bg-slate-50/70 px-3 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label={tr("Lọc dòng xem trước", "Filter preview rows")} className="flex max-w-full gap-1 overflow-x-auto p-1">
          {previewTabs.map(({ id, vi, en, icon: Icon, idle, active }) => {
            const selected = previewFilter === id
            const count = rowsByFilter[id].length
            const tone = id === "ERROR" && count
              ? `border-rose-700 bg-rose-700 font-bold text-white hover:bg-rose-800 ${selected ? "ring-2 ring-rose-500 ring-offset-1" : "motion-safe:animate-pulse"}`
              : selected ? active : `border-transparent ${idle}`
            return <button key={id} type="button" aria-pressed={selected} onClick={() => switchFilter(id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 motion-safe:transition-colors motion-safe:duration-150 ${tone}`}>
              {Icon && <Icon size={14} aria-hidden="true" />}
              {tr(vi, en)} <span className="tabular-nums">({formatCount.format(count)})</span>
            </button>
          })}
        </div>
        <Popover.Root>
          <Popover.Trigger asChild>
            <Button type="button" size="sm" variant="secondary">{tr("Xem danh sách mã ca hợp lệ", "View valid shift codes")}</Button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="end" sideOffset={8} className="z-[90] w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-xl motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150" aria-label={tr("Mã ca đang hoạt động", "Active shift codes")}>
              <p className="font-semibold text-slate-900">{tr("Mã ca đang hoạt động", "Active shift codes")}</p>
              <p className="mt-2 break-words text-slate-600">{activeShiftTypes.length ? activeShiftTypes.join(" · ") : tr("Chưa tải được danh mục mã ca.", "Shift codes are unavailable.")}</p>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>

      {errorCount > 0 && <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        <div className="flex min-w-0 items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p><strong>{tr(`Phát hiện ${formatCount.format(errorCount)} dòng có lỗi dữ liệu trên tổng số ${formatCount.format(preview.rows.length)} bản ghi.`, `${formatCount.format(errorCount)} of ${formatCount.format(preview.rows.length)} rows have data errors.`)}</strong>{" "}
            {tr("Vui lòng kiểm tra lại trước khi xác nhận.", "Review the errors before confirming.")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" className="h-auto min-h-8 whitespace-normal text-left" disabled={busy || choicesDirty || !saveableRows.length} onClick={confirmValidRows}>
            {tr(`Bỏ qua dòng lỗi & Chỉ nhập ${formatCount.format(saveableRows.length)} dòng hợp lệ`, `Skip errors and import ${formatCount.format(saveableRows.length)} valid rows`)}
          </Button>
          <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void downloadErrors()}>
            <Download size={15} aria-hidden="true" />{tr("Xuất báo cáo lỗi (Excel)", "Export error report (Excel)")}
          </Button>
        </div>
      </div>}
    </div>

    <div ref={tableViewport} className="min-h-0 flex-1 overflow-auto px-3 sm:px-5">
      <table className="w-full min-w-[1020px] table-fixed text-left text-sm">
        <colgroup><col className="w-[50px]" /><col className="w-[180px]" /><col className="w-[140px]" /><col className="w-[110px]" /><col className="w-[100px]" /><col className="w-[100px]" /><col className="w-[90px]" /><col className="w-[250px]" /></colgroup>
        <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_#e2e8f0]">
          <tr>{[tr("STT", "No."), tr("Nhân viên", "Employee"), tr("Ngày làm việc", "Work date"), tr("Ca làm việc", "Shift"), tr("Giờ vào", "Check-in"), tr("Giờ ra", "Check-out"), tr("Tổng giờ", "Hours"), tr("Trạng thái ghi nhận", "Record status")].map(label => <th scope="col" key={label} className="px-3 py-3 font-semibold">{label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {visibleRows.map(row => {
            const employeeIssues = cellIssues(row, "employee")
            const dateIssues = cellIssues(row, "work_date")
            const shiftIssues = cellIssues(row, "shift")
            const inIssues = cellIssues(row, "check_in")
            const outIssues = cellIssues(row, "check_out")
            const durationIssues = cellIssues(row, "duration")
            const worked = Math.max(0, row.working_minutes || 0)
            const { late, early, overtime, hasTimes, onTime } = previewEvents(row)
            const hasError = isRowError(row)
            const excluded = isExcluded(row, choices)
            return <tr key={row.excel_row} className={`${hasError ? "bg-rose-50/20" : excluded ? "bg-slate-100/70" : "hover:bg-slate-50/60"}`}>
              <td className="px-3 py-3 font-mono text-xs text-slate-500">{row.excel_row - 1}</td>
              <td className="px-3 py-3">
                <div title={issueTitle(employeeIssues, row)} className={fieldClass(employeeIssues)}>
                  {errorIcon(employeeIssues)}
                  <div className="min-w-0">
                    <strong className={`block break-all font-mono text-xs ${employeeIssues.length ? "text-rose-700" : "text-slate-900"}`}>{row.employee_code || "—"}</strong>
                    <span className="mt-0.5 block truncate text-xs font-normal text-slate-600" title={row.full_name}>{row.full_name || tr("Không tìm thấy hồ sơ", "Profile not found")}</span>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3">
                <div title={issueTitle(dateIssues, row)} className={fieldClass(dateIssues)}>
                  {errorIcon(dateIssues)}
                  {row.candidates && row.candidates.length > 1
                    ? <SelectControl disabled={busy} className="min-w-0 w-full rounded-md border border-slate-300 bg-white p-1.5 text-xs" value={choices[row.excel_row]?.work_date || row.work_date || ""} onChange={event => updateChoice(row.excel_row, { work_date: event.target.value || undefined })}>
                        <option value="">{tr("Chọn ngày", "Choose date")}</option>
                        {row.candidates.map(date => <option key={date} value={date}>{workDateLabel(date)}</option>)}
                      </SelectControl>
                    : <span className="text-xs font-medium">{workDateLabel(row.work_date)}</span>}
                </div>
              </td>
              <td className="px-3 py-3">
                <div title={issueTitle(shiftIssues, row)} className={fieldClass(shiftIssues)}>
                  {errorIcon(shiftIssues)}
                  <span className={`min-w-0 break-all font-mono text-xs font-semibold ${shiftIssues.length ? "" : "rounded-md bg-slate-100 px-2 py-1 text-slate-700"}`}>{row.shift_type || "—"}</span>
                </div>
              </td>
              <td className="px-3 py-3">
                <div title={issueTitle(inIssues, row)} className={fieldClass(inIssues)}>
                  {errorIcon(inIssues)}
                  <span className={`break-all font-mono ${inIssues.length ? "text-rose-700" : late ? "font-semibold text-amber-900" : "text-slate-700"}`}>{timePart(row.check_in)}</span>
                </div>
              </td>
              <td className="px-3 py-3">
                <div title={issueTitle(outIssues, row)} className={fieldClass(outIssues)}>
                  {errorIcon(outIssues)}
                  <span className={`break-all font-mono ${outIssues.length ? "text-rose-700" : overtime > 0 ? "font-bold text-purple-700" : early ? "font-semibold text-orange-900" : "text-slate-700"}`}>{timePart(row.check_out)}</span>
                </div>
                {!outIssues.length && overtime > 0 && <span className="block text-[10px] font-semibold text-purple-700">+{minutesLabel(overtime)} OT</span>}
              </td>
              <td className="px-3 py-3">
                <div title={issueTitle(durationIssues, row)} className={fieldClass(durationIssues)}>
                  {errorIcon(durationIssues)}
                  <span className="font-mono font-semibold">{row.working_minutes == null ? "—" : `${(worked / 60).toFixed(1)}h`}</span>
                </div>
              </td>
              <td className="px-3 py-3">
                {hasError ? <>
                  <span title={issueTitle(blockingIssues(row), row)} className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">
                    <CircleX size={13} aria-hidden="true" />{tr("Lỗi", "Error")}: {technicalStatus(row)}
                  </span>
                  {blockingIssues(row).length > 0 && <details className="mt-1 text-xs text-slate-600">
                    <summary className="cursor-pointer font-semibold text-rose-700">{tr("Chi tiết", "Details")}</summary>
                    <ul className="mt-1 space-y-1">{blockingIssues(row).map((issue, issueIndex) => <li key={`${issue.code}-${issueIndex}`}>{issueLabel(issue, row)}</li>)}</ul>
                  </details>}
                </> : <div className="flex flex-wrap gap-1.5">
                  {late && <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
                    <Clock3 size={13} aria-hidden="true" />{tr("Trễ", "Late")} {minutesLabel(row.late_mins ?? 0)}
                  </span>}
                  {early && <span className="inline-flex items-center gap-1 rounded-full border border-orange-300 bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-900">
                    <Footprints size={13} aria-hidden="true" />{tr("Về sớm", "Early")} {minutesLabel(row.early_mins ?? 0)}
                  </span>}
                  {overtime > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-1 text-xs font-semibold text-purple-700">
                    <Zap size={13} aria-hidden="true" />+{minutesLabel(overtime)} OT
                  </span>}
                  {onTime && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 size={14} aria-hidden="true" />{tr("Đúng giờ", "On time")}
                  </span>}
                  {!hasTimes && <span className="text-xs text-slate-600">{tr("Thiếu giờ vào/ra", "Missing check-in/check-out")}</span>}
                </div>}
                <label className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
                  <input type="checkbox" checked={excluded} disabled={busy} onChange={event => updateChoice(row.excel_row, { exclude: event.target.checked })} />
                  {tr("Bỏ qua dòng này", "Exclude this row")}
                </label>
              </td>
            </tr>
          })}
        </tbody>
      </table>
      {!filteredRows.length && <div className="flex min-h-52 flex-col items-center justify-center text-center text-sm text-slate-500"><CheckCircle2 className="mb-2 text-emerald-500" />{previewFilter === "ERROR" ? tr("Không có dòng lỗi kỹ thuật.", "No technical errors found.") : tr("Không có dòng phù hợp bộ lọc.", "No rows match this filter.")}</div>}
    </div>

    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-2 text-xs text-slate-600">
      <label className="flex items-center gap-2">{tr("Số dòng / trang", "Rows / page")}
        <SelectControl value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); goToPage(1) }}>
          {[25, 50, 100].map(size => <option key={size}>{size}</option>)}
        </SelectControl>
      </label>
      <div className="flex flex-wrap items-center gap-1">
        <Button type="button" size="sm" variant="secondary" disabled={currentPage === 1} onClick={() => goToPage(1)}>{tr("Đầu", "First")}</Button>
        <Button type="button" size="sm" variant="secondary" disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}>{tr("Trước", "Previous")}</Button>
        <span>{tr("Trang", "Page")}</span><input key={currentPage} aria-label={tr("Nhảy tới trang", "Jump to page")} type="number" min={1} max={pageCount} defaultValue={currentPage} onBlur={event => {
          const next = Math.max(1, Math.min(pageCount, Math.trunc(event.currentTarget.valueAsNumber || currentPage)))
          event.currentTarget.value = String(next)
          goToPage(next)
        }} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur() }} className="w-16 rounded-md border border-slate-300 px-2 py-1 text-center" /> / {formatCount.format(pageCount)} <span aria-live="polite">· {formatCount.format(filteredRows.length)} {tr("bản ghi", "records")}</span>
        <Button type="button" size="sm" variant="secondary" disabled={currentPage === pageCount} onClick={() => goToPage(currentPage + 1)}>{tr("Sau", "Next")}</Button>
        <Button type="button" size="sm" variant="secondary" disabled={currentPage === pageCount} onClick={() => goToPage(pageCount)}>{tr("Cuối", "Last")}</Button>
      </div>
    </div>
    {choicesDirty && <p className="mx-5 mb-3 rounded-lg bg-blue-50 p-3 text-sm font-medium text-blue-900">{tr("Lựa chọn vừa thay đổi. Hãy kiểm tra lại để backend xác nhận dữ liệu trước khi lưu.", "Choices changed. Revalidate before saving.")}</p>}
    {!choicesDirty && hasWarnings && <label className="mx-5 mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-900"><input ref={warningCheckbox} className="mt-1" type="checkbox" checked={ack} disabled={busy} onChange={event => setAck(event.target.checked)} />{tr("Tôi đã xem và xác nhận các cảnh báo trong tệp, gồm đi trễ, về sớm hoặc các sai lệch khác.", "I reviewed and accept the business warnings before saving.")}</label>}
    {error && <div role="alert" className="mx-5 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800"><span>{error}</span><Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => previewFile()}>{tr("Kiểm tra lại tệp", "Validate file again")}</Button></div>}

    <footer className="sticky bottom-0 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3 shadow-[0_-8px_20px_-18px_rgba(15,23,42,0.5)]">
      <div aria-live="polite">
        <p className="text-sm font-semibold text-slate-900">
          {tr(`Sẵn sàng lưu ${formatCount.format(saveableRows.length)}/${formatCount.format(preview.rows.length)} bản ghi`, `Ready to save ${formatCount.format(saveableRows.length)}/${formatCount.format(preview.rows.length)} records`)}
        </p>
        <p className="mt-0.5 text-xs text-slate-600">
          {tr(`${formatCount.format(uniqueEmployees)} nhân sự · ${dateRangeLabel()}`, `${formatCount.format(uniqueEmployees)} employees · ${dateRangeLabel()}`)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {onCancel && <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>{tr("Hủy / Đóng", "Cancel / Close")}</Button>}
        {choicesDirty ? (
          <Button type="button" disabled={busy} onClick={() => previewFile()}>{tr("Kiểm tra lại thay đổi", "Revalidate changes")}</Button>
        ) : (
          <Button type="button" disabled={!canConfirm} className="bg-orange-600 text-white hover:bg-orange-700" onClick={() => void confirm()}>
            {busy ? tr("Đang xử lý…", "Processing…") : tr(`Xác nhận nhập ${formatCount.format(saveableRows.length)} dòng hợp lệ`, `Confirm ${formatCount.format(saveableRows.length)} valid rows`)}
          </Button>
        )}
      </div>
    </footer>
  </div>
}
