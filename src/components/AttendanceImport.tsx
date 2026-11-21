import { useAutoDismissState } from '../hooks/useAutoDismissState';
import { useMemo, useState, type FormEvent } from "react"
import { AlertTriangle, CheckCircle2, CircleX, Download, Info } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "./ui"
import AttendanceFileDropzone from "./AttendanceFileDropzone"
import { useLanguage } from "../context/LanguageContext"
import {
  attendanceErrors,
  attendanceMessage,
  batchBlocked,
  saveableAttendanceRows,
  confirmAttendance,
  previewAttendance,
  saveDownload,
  type AttendanceBatch,
  type AttendanceChoice,
  type ConfirmResult,
  type ImportIssue,
  type PreviewRow,
} from "../services/attendance"

interface AttendanceImportProps {
  onImported: (result: ConfirmResult) => void
  onBusyChange?: (busy: boolean) => void
  activeShiftTypes?: string[]
}

type PreviewFilter = "ALL" | "VALID" | "ERROR"
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
  "ATT-020": ["check_in"],
  "ATT-021": ["check_in", "check_out"],
  "ATT-022": ["duration"],
  "ATT-023": ["check_in"],
  "ATT-024": ["check_out"],
} as Record<string, ErrorField[]>)[code] || []

const timePart = (value: string | null) => {
  if (!value) return "—"
  const match = value.match(/(?:T|\s|^)(\d{2}):(\d{2})/)
  return match ? `${match[1]}:${match[2]}` : value
}
const clockMinutes = (value: string | null) => {
  const formatted = timePart(value)
  const match = formatted.match(/^(\d{2}):(\d{2})$/)
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

const minutesLabel = (minutes: number, suffix: string) => {
  const absolute = Math.abs(minutes)
  if (absolute >= 60 && absolute % 60 === 0) return `${absolute / 60}h ${suffix}`
  return `${absolute}p ${suffix}`
}

export default function AttendanceImport({ onImported, onBusyChange, activeShiftTypes = [] }: AttendanceImportProps) {
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
  const [error, setError] = useAutoDismissState()
  const choiceList = useMemo(() => Object.values(choices).sort((a, b) => a.excel_row - b.excel_row), [choices])
  const isExcluded = (row: PreviewRow) => choices[row.excel_row]?.exclude ?? Boolean(row.excluded)
  const includedRows = preview?.rows.filter(row => !isExcluded(row)) || []
  const saveableRows = saveableAttendanceRows(includedRows)
  const hasWarnings = saveableRows.some(row => row.issues.some(issue => issue.severity === "WARNING"))
  const hasIssues = includedRows.some(row => row.issues.length > 0)
  const hasScheduleIssues = includedRows.some(row => row.issues.some(issue => ["ATT-004", "ATT-016", "ATT-017"].includes(issue.code)))
  const isRowError = (row: PreviewRow) => row.validation_status === "ERROR" || row.issues.some(issue => issue.severity === "ERROR" || issue.requires_resolution)
  const errorCount = preview?.rows.filter(isRowError).length || 0
  const validCount = (preview?.rows.length || 0) - errorCount
  const filteredRows = preview?.rows.filter(row => previewFilter === "ALL" || (previewFilter === "ERROR" ? isRowError(row) : !isRowError(row))) || []
  const uniqueEmployees = new Set(preview?.rows.map(row => row.employee_code).filter(Boolean)).size
  const previewDates = (preview?.rows.map(row => row.work_date).filter((value): value is string => Boolean(value)) || []).sort()

  function selectFile(next: File | null) {
    setFile(next); setPreview(null); setChoices({}); setResult(null); setAck(false); setChoicesDirty(false); setPreviewFilter("ALL"); setError("")
  }
  function validate() {
    if (!file || !/\.xlsx$/i.test(file.name) || !file.size || file.size > 10 * 1024 * 1024) {
      setError(tr("Chọn tệp XLSX không rỗng, tối đa 10 MiB.", "Choose a nonempty XLSX file up to 10 MiB."))
      return false
    }
    return true
  }
  async function run(task: () => Promise<void>) {
    if (busy) return
    setBusy(true); onBusyChange?.(true); setError("")
    try { await task() }
    catch (cause) { setError(attendanceMessage(cause, tr("Không xử lý được tệp chấm công.", "Could not process the attendance file."))) }
    finally { setBusy(false); onBusyChange?.(false) }
  }
  function previewFile(event?: FormEvent) {
    event?.preventDefault()
    if (!validate() || !file) return
    void run(async () => {
      setPreview(await previewAttendance(file, choiceList)); setResult(null); setAck(false); setChoicesDirty(false); setPreviewFilter("ALL")
    })
  }
  function updateChoice(excelRow: number, patch: Partial<AttendanceChoice>) {
    setChoices(current => ({ ...current, [excelRow]: { ...current[excelRow], ...patch, excel_row: excelRow } }))
    setResult(null); setAck(false); setChoicesDirty(true)
  }
  async function confirm(skipInvalid = false) {
    if (!file || !preview || choicesDirty) return
    await run(async () => {
      const saved = await confirmAttendance(file, preview.preview_token, choiceList, ack, skipInvalid)
      setResult(saved); setPreview(null); onImported(saved)
    })
  }
  async function downloadErrors() {
    if (!validate() || !file) return
    await run(async () => saveDownload(await attendanceErrors(file, choiceList), "attendance-errors.xlsx"))
  }

  const issueLabel = (issue: ImportIssue, row?: PreviewRow) => {
    const labels: Record<string, string> = {
      "ATT-002": tr("Cấu trúc hoặc dữ liệu trong tệp không hợp lệ.", "The file structure or data is invalid."),
      "ATT-003": tr("Mã nhân viên không tồn tại.", "Employee code does not exist."),
      "ATT-004": tr("Ca trong hồ sơ nhân sự hiện không ACTIVE.", "The employee profile shift is not ACTIVE."),
      "ATT-005": tr("Ngày giờ không đúng định dạng yêu cầu.", "The date and time format is invalid."),
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
      "ATT-016": tr("Hồ sơ nhân sự chưa có mã ca hợp lệ; kiểm tra file import hồ sơ.", "The employee profile has no valid shift; check its import data."),
      "ATT-017": tr("Mã ca trong tệp không khớp ca được gán cho nhân viên.", "The file shift code does not match the employee schedule."),
      "ATT-018": tr(`Ngày/giờ chấm công${row?.work_date ? ` (${row.work_date.split("-").reverse().join("/")})` : ""} chưa xảy ra. Vui lòng chỉ nhập dữ liệu đã phát sinh.`, "The attendance date or time has not occurred yet. Import only attendance that has already occurred."),
      "ATT-019": tr("Ngày công phải từ ngày nhân viên bắt đầu làm việc.", "Attendance must be on or after the hire date."),
      "ATT-020": tr("Thời gian đến sớm không được tính là tăng ca.", "Early arrival is not counted as overtime."),
      "ATT-021": tr("Khoảng thời gian bị trùng với bản ghi chấm công khác.", "The time interval overlaps another attendance record."),
      "ATT-022": tr("Không có thời gian làm việc sau khi trừ giờ nghỉ.", "No working time remains after excluding the break."),
      "ATT-023": tr("Nhân viên đi muộn so với giờ bắt đầu ca.", "Check-in is later than the shift start."),
      "ATT-024": tr("Nhân viên về sớm so với giờ kết thúc ca.", "Check-out is earlier than the shift end."),
    }
    return labels[issue.code] || issue.message
  }

  const cellIssues = (row: PreviewRow, field: ErrorField) => row.issues.filter(issue => errorFields(issue.code).includes(field))
  const workDateLabel = (value?: string) => {
    if (!value) return "—"
    const date = new Date(`${value}T00:00:00Z`)
    if (Number.isNaN(date.getTime())) return value
    const weekday = new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", { weekday: "short", timeZone: "UTC" }).format(date)
    const datePart = new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date)
    return `${weekday}, ${datePart}`
  }
  const isWeekend = (value?: string) => {
    if (!value) return false
    const day = new Date(`${value}T00:00:00Z`).getUTCDay()
    return day === 0 || day === 6
  }
  const dateRangeLabel = () => {
    if (!previewDates.length) return "—"
    const short = (value: string, includeYear = false) => {
      const [year, month, day] = value.split("-")
      return includeYear ? `${day}/${month}/${year}` : `${day}/${month}`
    }
    return previewDates.length === 1 ? short(previewDates[0], true) : `${short(previewDates[0])} – ${short(previewDates.at(-1)!, true)}`
  }
  const fieldClass = (issues: ImportIssue[]) => issues.length ? "rounded-md border border-rose-400 bg-rose-50/80 px-2 py-1.5 font-semibold text-rose-900" : ""
  const issueTitle = (issues: ImportIssue[], row: PreviewRow) => issues.map(issue => issueLabel(issue, row)).join("\n")

  return <div>
    <div className="pr-12"><h2 className="text-base font-semibold text-slate-950">{tr("Nhập dữ liệu chấm công", "Import attendance")}</h2><p className="mt-2 text-sm font-medium text-slate-600">{tr("Tệp XLSX tối đa 10 MiB. Dữ liệu chỉ được lưu sau khi xem trước và xác nhận.", "XLSX files up to 10 MiB. Data is saved only after preview and confirmation.")}</p></div>
    <details className="mt-3 text-sm text-slate-600"><summary className="inline-flex cursor-pointer items-center gap-2 font-semibold text-slate-700"><Info size={16}/>{tr("Yêu cầu tệp", "File requirements")}</summary><div className="mt-2 rounded-md bg-slate-50 p-3 font-medium"><p>{tr("Dùng tệp XLSX đúng mẫu và xem trước lại sau khi thay đổi lựa chọn dòng.", "Use the XLSX template and preview again after changing row choices.")}</p>{!!activeShiftTypes.length && <p className="mt-1">{tr("Mã ca đang hoạt động: ", "Active shift codes: ")}{activeShiftTypes.join(", ")}</p>}</div></details>
    <form onSubmit={previewFile} className="mt-4"><AttendanceFileDropzone file={file} busy={busy} onSelect={selectFile} /><div className="mt-4 flex justify-end"><Button type="submit" disabled={!file || busy}>{tr("Xem trước", "Preview")}</Button></div></form>
    {error && <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 font-medium text-red-800">{error}</p>}
    {result && <p role="status" className="mt-4 rounded-md bg-emerald-50 p-3 font-semibold text-emerald-800">{tr(`Đã lưu ${result.inserted} bản ghi, bỏ qua ${result.skipped} bản ghi trùng, không lưu ${result.excluded} dòng (gồm ${result.skipped_invalid ?? 0} dòng lỗi).`, `Saved ${result.inserted}, skipped ${result.skipped}, excluded ${result.excluded}.`)}</p>}
    {preview && <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={`flex items-start gap-3 border-b px-4 py-3 ${errorCount ? "border-amber-200 bg-amber-50/70" : "border-emerald-200 bg-emerald-50/70"}`}>
        {errorCount ? <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />}
        <div><p className="font-semibold text-slate-900">{errorCount ? tr(`Phát hiện ${errorCount} dòng có lỗi dữ liệu trên tổng số ${preview.rows.length} bản ghi.`, `${errorCount} of ${preview.rows.length} rows contain errors.`) : tr(`Toàn bộ ${preview.rows.length} bản ghi đã qua kiểm tra.`, `All ${preview.rows.length} rows passed validation.`)}</p>{errorCount > 0 && <p className="mt-0.5 text-sm text-slate-600">{tr("Vui lòng kiểm tra lại trước khi xác nhận.", "Review the highlighted cells before confirming.")}</p>}</div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex rounded-lg bg-slate-100 p-1">{(["ALL", "VALID", "ERROR"] as PreviewFilter[]).map(filter => { const count = filter === "ALL" ? preview.rows.length : filter === "VALID" ? validCount : errorCount; const label = filter === "ALL" ? tr("Tất cả", "All") : filter === "VALID" ? tr("✓ Hợp lệ", "✓ Valid") : tr("⚠ Có lỗi", "⚠ Errors"); return <button key={filter} type="button" onClick={() => setPreviewFilter(filter)} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${previewFilter === filter ? filter === "ERROR" ? "bg-white text-rose-700 shadow-sm" : filter === "VALID" ? "bg-white text-emerald-700 shadow-sm" : "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{label} ({count})</button> })}</div>
        <div className="flex flex-wrap gap-2">{errorCount > 0 && <Button type="button" variant="secondary" disabled={busy || choicesDirty || !saveableRows.length || (hasWarnings && !ack)} onClick={() => void confirm(true)}>{tr(`Bỏ qua dòng lỗi & Chỉ nhập ${saveableRows.length} dòng hợp lệ`, `Skip errors & import ${saveableRows.length} valid rows`)}</Button>}{hasIssues && <Button type="button" variant="secondary" disabled={busy} onClick={() => void downloadErrors()}><Download size={16}/>{tr("Xuất báo cáo lỗi (Excel)", "Export error report (Excel)")}</Button>}</div>
      </div>
      {hasScheduleIssues && <div className="m-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><div><p className="font-semibold">{tr("Có lỗi dữ liệu ca làm việc", "Shift data needs attention")}</p><p className="mt-1">{tr("Kiểm tra mã ca trong hồ sơ nhân sự và tệp chấm công.", "Check the employee profile and attendance shift codes.")}</p></div><Link to="/employees/import" className="font-semibold underline">{tr("Kiểm tra hồ sơ nhân sự", "Review employee profiles")}</Link></div>}
      <div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-left text-sm"><thead className="border-y border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500"><tr>{[tr("Dòng", "Row"), tr("Nhân viên", "Employee"), tr("Ngày làm việc", "Work date"), tr("Ca", "Shift"), tr("Giờ vào", "Check-in"), tr("Giờ ra", "Check-out"), tr("Thời lượng", "Duration"), tr("Tình trạng kiểm tra", "Validation"), tr("Bỏ qua", "Exclude")].map(heading => <th key={heading} className="px-3 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filteredRows.map(row => {
        const excluded = isExcluded(row)
        const employeeIssues = cellIssues(row, "employee"), dateIssues = cellIssues(row, "work_date"), shiftIssues = cellIssues(row, "shift"), inIssues = cellIssues(row, "check_in"), outIssues = cellIssues(row, "check_out"), durationIssues = cellIssues(row, "duration")
        const worked = Math.max(0, row.working_minutes || 0), percentage = Math.min(100, worked / 480 * 100), overtime = Math.max(0, (clockMinutes(row.check_out) || 0) - 17 * 60)
        return <tr key={row.excel_row} className={`align-top ${excluded ? "bg-slate-50 opacity-55" : isRowError(row) ? "bg-rose-50/20" : "hover:bg-slate-50/50"}`}>
          <td className="px-3 py-3 font-mono text-xs text-slate-500">{row.excel_row}</td>
          <td className="px-3 py-3"><div title={issueTitle(employeeIssues, row)} className={fieldClass(employeeIssues)}>{employeeIssues.length > 0 && <span className="mr-1 text-rose-600">⚠</span>}<strong className="font-mono text-xs">{row.employee_code || "—"}</strong><span className="block text-xs font-normal text-slate-500">{row.full_name || "—"}</span></div></td>
          <td className={`px-3 py-3 ${isWeekend(row.work_date) ? "text-slate-400" : "text-slate-700"}`}><div title={issueTitle(dateIssues, row)} className={fieldClass(dateIssues)}>{dateIssues.length > 0 && <span className="mr-1 text-rose-600">⚠</span>}{row.candidates && row.candidates.length > 1 ? <select className="max-w-40 rounded border border-slate-300 bg-white p-1.5 text-xs" value={choices[row.excel_row]?.work_date || row.work_date || ""} onChange={event => updateChoice(row.excel_row, { work_date: event.target.value || undefined })}><option value="">{tr("Chọn ngày", "Choose date")}</option>{row.candidates.map(date => <option key={date} value={date}>{workDateLabel(date)}</option>)}</select> : <span className="whitespace-nowrap text-xs font-medium">{workDateLabel(row.work_date)}</span>}</div></td>
          <td className="px-3 py-3"><div title={issueTitle(shiftIssues, row)} className={fieldClass(shiftIssues)}>{shiftIssues.length > 0 && <span className="mr-1 text-rose-600">⚠</span>}<span className="font-mono text-xs">{row.shift_type || "—"}</span></div></td>
          <td className="px-3 py-3"><div title={issueTitle(inIssues, row)} className={fieldClass(inIssues)}>{inIssues.length > 0 && <span className="mr-1 text-rose-600">⚠</span>}<span className={`font-mono font-medium ${row.late_mins ? "text-amber-700" : "text-slate-700"}`}>{timePart(row.check_in)}</span>{Boolean(row.late_mins) && <span className="mt-1 block w-fit rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">+{minutesLabel(row.late_mins || 0, tr("muộn", "late"))}</span>}</div></td>
          <td className="px-3 py-3"><div title={issueTitle(outIssues, row)} className={fieldClass(outIssues)}>{outIssues.length > 0 && <span className="mr-1 text-rose-600">⚠</span>}<span className={`font-mono font-medium ${row.early_mins ? "text-rose-700" : overtime ? "text-violet-700" : "text-slate-700"}`}>{timePart(row.check_out)}</span>{Boolean(row.early_mins) ? <span className="mt-1 block w-fit rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-800">-{minutesLabel(row.early_mins || 0, tr("sớm", "early"))}</span> : overtime > 0 ? <span className="mt-1 block w-fit rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-800">+{minutesLabel(overtime, "OT")}</span> : null}</div></td>
          <td className="px-3 py-3"><div title={issueTitle(durationIssues, row)} className={fieldClass(durationIssues)}><div className="flex items-center gap-2"><div className="h-1.5 w-24 overflow-hidden rounded-full bg-rose-100"><span className={`block h-full rounded-full ${percentage >= 100 ? "bg-emerald-500" : percentage >= 75 ? "bg-amber-400" : "bg-rose-500"}`} style={{ width: `${percentage}%` }} /></div><span className="font-mono text-xs font-semibold text-slate-700">{(worked / 60).toFixed(1)}h</span></div></div></td>
          <td className="max-w-60 px-3 py-3">{isRowError(row) ? <><span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700"><CircleX size={13}/>{row.issues.some(issue => ["ATT-004", "ATT-016", "ATT-017"].includes(issue.code)) ? tr("Lỗi ca làm việc", "Shift error") : row.issues.some(issue => issue.code === "ATT-003") ? tr("Sai mã nhân viên", "Employee error") : tr("Dữ liệu chưa hợp lệ", "Invalid data")}</span><details className="mt-1 text-xs text-slate-600"><summary className="cursor-pointer font-semibold text-rose-700">{tr("Chi tiết", "Details")}</summary><ul className="mt-1 space-y-1">{row.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issueLabel(issue, row)}</li>)}</ul></details></> : <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={13}/>{tr("Hợp lệ", "Valid")}</span>}</td>
          <td className="px-3 py-3 text-center"><input aria-label={tr(`Bỏ qua dòng ${row.excel_row}`, `Exclude row ${row.excel_row}`)} type="checkbox" checked={excluded} onChange={event => updateChoice(row.excel_row, { exclude: event.target.checked })}/></td>
        </tr> })}</tbody></table></div>
      {choicesDirty && <p className="m-4 rounded-md bg-blue-50 p-3 text-sm font-medium text-blue-900">{tr("Các lựa chọn chưa được backend kiểm tra. Hãy kiểm tra lại trước khi lưu.", "The backend has not checked these choices yet. Recheck before saving.")}</p>}
      {!choicesDirty && hasWarnings && <label className="m-4 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm font-medium text-amber-900"><input className="mt-1" type="checkbox" checked={ack} onChange={event => setAck(event.target.checked)}/>{tr("Tôi đã kiểm tra và chấp nhận các cảnh báo trước khi lưu.", "I reviewed and accept the warnings before saving.")}</label>}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3"><p className="text-sm text-slate-600">{tr(`Tổng cộng: ${validCount}/${preview.rows.length} bản ghi hợp lệ · ${uniqueEmployees} nhân sự · Thời gian: ${dateRangeLabel()}`, `Total: ${validCount}/${preview.rows.length} valid · ${uniqueEmployees} employees · Period: ${dateRangeLabel()}`)}</p><div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => selectFile(null)}>← {tr("Quay lại chọn tệp khác", "Choose another file")}</Button>{choicesDirty ? <Button type="button" disabled={busy} onClick={() => previewFile()}>{tr("Kiểm tra lại thay đổi", "Recheck changes")}</Button> : <Button type="button" disabled={busy || !saveableRows.length || (hasWarnings && !ack)} onClick={() => void confirm(batchBlocked(preview))}>{tr(`Xác nhận & Lưu dữ liệu (${saveableRows.length} bản ghi)`, `Confirm & Save (${saveableRows.length} records)`)}</Button>}</div></footer>
    </div>}
  </div>
}
