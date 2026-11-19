import { useMemo, useState, type FormEvent } from "react"
import { Download, FileSpreadsheet, Info, UploadCloud } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "./ui"
import { useLanguage } from "../context/LanguageContext"
import {
  attendanceErrors,
  attendanceMessage,
  batchBlocked,
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

export default function AttendanceImport({ onImported, onBusyChange, activeShiftTypes = [] }: AttendanceImportProps) {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => language === "vi" ? vi : en
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<AttendanceBatch | null>(null)
  const [choices, setChoices] = useState<Record<number, AttendanceChoice>>({})
  const [result, setResult] = useState<ConfirmResult | null>(null)
  const [ack, setAck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [choicesDirty, setChoicesDirty] = useState(false)
  const [error, setError] = useState("")
  const choiceList = useMemo(() => Object.values(choices).sort((a, b) => a.excel_row - b.excel_row), [choices])
  const isExcluded = (row: PreviewRow) => choices[row.excel_row]?.exclude ?? Boolean(row.excluded)
  const includedRows = preview?.rows.filter(row => !isExcluded(row)) || []
  const hasWarnings = includedRows.some(row => row.issues.some(issue => issue.severity === "WARNING"))
  const hasIssues = includedRows.some(row => row.issues.length > 0)
  const hasScheduleIssues = includedRows.some(row => row.issues.some(issue => ["ATT-004", "ATT-016", "ATT-017"].includes(issue.code)))

  function selectFile(next: File | null) {
    setFile(next); setPreview(null); setChoices({}); setResult(null); setAck(false); setChoicesDirty(false); setError("")
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
      setPreview(await previewAttendance(file, choiceList)); setResult(null); setAck(false); setChoicesDirty(false)
    })
  }
  function updateChoice(excelRow: number, patch: Partial<AttendanceChoice>) {
    setChoices(current => ({ ...current, [excelRow]: { ...current[excelRow], ...patch, excel_row: excelRow } }))
    setResult(null); setAck(false); setChoicesDirty(true)
  }
  async function confirm() {
    if (!file || !preview || choicesDirty) return
    await run(async () => {
      const saved = await confirmAttendance(file, preview.preview_token, choiceList, ack)
      setResult(saved); setPreview(null); onImported(saved)
    })
  }
  async function downloadErrors() {
    if (!validate() || !file) return
    await run(async () => saveDownload(await attendanceErrors(file, choiceList), "attendance-errors.xlsx"))
  }

  const statusLabel = (value: string) => ({
    VALID: tr("Hợp lệ", "Valid"), WARNING: tr("Cảnh báo", "Warning"), ERROR: tr("Lỗi", "Error"),
    DUPLICATE: tr("Trùng", "Duplicate"), NO_DATA: tr("Không có dữ liệu", "No data"), INCOMPLETE: tr("Thiếu giờ", "Incomplete"),
  } as Record<string, string>)[value] || value
  const actionLabel = (value: PreviewRow["action"]) => ({
    INSERT: tr("Thêm mới", "Insert"), SKIP: tr("Bỏ qua", "Skip"), CHANGED: tr("Cần kiểm tra", "Changed"), BLOCKED: tr("Không thể lưu", "Blocked"),
  })[value]
  const issueLabel = (issue: ImportIssue) => {
    const labels: Record<string, string> = {
      "ATT-002": tr("Cấu trúc hoặc dữ liệu trong tệp không hợp lệ.", "The file structure or data is invalid."),
      "ATT-003": tr("Mã nhân viên không tồn tại.", "Employee code does not exist."),
      "ATT-004": tr("Mã ca trong tệp không khớp ca đang hoạt động.", "The file shift code does not match an active schedule."),
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
      "ATT-016": tr("Nhân viên chưa được gán ca làm việc.", "The employee has no assigned work schedule."),
      "ATT-017": tr("Mã ca trong tệp không khớp ca được gán cho nhân viên.", "The file shift code does not match the employee schedule."),
      "ATT-018": tr("Không được nhập giờ chấm công trong tương lai.", "Future attendance timestamps are not allowed."),
      "ATT-019": tr("Ngày công phải từ ngày nhân viên bắt đầu làm việc.", "Attendance must be on or after the hire date."),
      "ATT-020": tr("Thời gian đến sớm không được tính là tăng ca.", "Early arrival is not counted as overtime."),
      "ATT-021": tr("Khoảng thời gian bị trùng với bản ghi chấm công khác.", "The time interval overlaps another attendance record."),
      "ATT-022": tr("Không có thời gian làm việc sau khi trừ giờ nghỉ.", "No working time remains after excluding the break."),
      "ATT-023": tr("Nhân viên đi muộn so với giờ bắt đầu ca.", "Check-in is later than the shift start."),
      "ATT-024": tr("Nhân viên về sớm so với giờ kết thúc ca.", "Check-out is earlier than the shift end."),
    }
    return labels[issue.code] || issue.message
  }

  return <div>
    <div className="pr-12"><h2 className="text-base font-semibold text-slate-950">{tr("Nhập dữ liệu chấm công", "Import attendance")}</h2><p className="mt-2 text-sm font-medium text-slate-600">{tr("Tệp XLSX tối đa 10 MiB. Dữ liệu chỉ được lưu sau khi xem trước và xác nhận.", "XLSX files up to 10 MiB. Data is saved only after preview and confirmation.")}</p></div>
    <details className="mt-3 text-sm text-slate-600"><summary className="inline-flex cursor-pointer items-center gap-2 font-semibold text-slate-700"><Info size={16}/>{tr("Yêu cầu tệp", "File requirements")}</summary><div className="mt-2 rounded-md bg-slate-50 p-3 font-medium"><p>{tr("Dùng tệp XLSX đúng mẫu và xem trước lại sau khi thay đổi lựa chọn dòng.", "Use the XLSX template and preview again after changing row choices.")}</p>{!!activeShiftTypes.length && <p className="mt-1">{tr("Mã ca đang hoạt động: ", "Active shift codes: ")}{activeShiftTypes.join(", ")}</p>}</div></details>
    <form onSubmit={previewFile} className="mt-4"><label className={`flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-5 py-6 text-center transition ${dragging ? "border-orange-400 bg-orange-50" : "border-slate-300 bg-slate-50 hover:border-orange-300"} ${busy ? "cursor-not-allowed opacity-60" : ""}`} onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); if (!busy) selectFile(event.dataTransfer.files?.[0] || null) }}><UploadCloud className="text-orange-500"/><span className="mt-3 text-sm font-semibold text-slate-800">{file?.name || tr("Kéo thả tệp vào đây hoặc bấm để chọn", "Drop a file here or click to choose")}</span><span className="mt-1 text-sm font-medium text-slate-600">{tr("Tệp XLSX · tối đa 10 MiB", "XLSX file · up to 10 MiB")}</span><a href="/templates/ERIS_Attendance_Import_Template.xlsx" download onClick={event => event.stopPropagation()} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800"><FileSpreadsheet size={16}/>{tr("Tải tệp mẫu", "Download template")}</a><input className="sr-only" type="file" accept=".xlsx" disabled={busy} onChange={event => selectFile(event.target.files?.[0] || null)}/></label><div className="mt-4 flex justify-end"><Button type="submit" disabled={!file || busy}>{tr("Xem trước", "Preview")}</Button></div></form>
    {error && <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 font-medium text-red-800">{error}</p>}
    {result && <p role="status" className="mt-4 rounded-md bg-emerald-50 p-3 font-semibold text-emerald-800">{tr(`Đã lưu ${result.inserted} bản ghi, bỏ qua ${result.skipped}, loại ${result.excluded}.`, `Saved ${result.inserted}, skipped ${result.skipped}, excluded ${result.excluded}.`)}</p>}
    {preview && <div className="mt-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-slate-900">{tr(`Kết quả xem trước: ${preview.rows.length} dòng`, `Preview: ${preview.rows.length} rows`)}</p>{hasIssues && <p className="mt-1 text-sm font-medium text-slate-600">{tr("Có dòng cần kiểm tra. Bạn có thể bỏ qua nhiều dòng rồi kiểm tra lại một lần.", "Some rows need review. You can exclude multiple rows and recheck once.")}</p>}</div><div className="flex flex-wrap items-center gap-2">{hasIssues && <Button type="button" variant="secondary" disabled={busy} onClick={() => void downloadErrors()}><Download size={16}/>{tr("Tải file dòng cần xử lý", "Download rows to fix")}</Button>}<span className={`rounded-md px-3 py-1 text-sm font-semibold ${choicesDirty ? "bg-blue-100 text-blue-800" : preview.status === "READY" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{choicesDirty ? tr("Chưa kiểm tra thay đổi", "Changes not checked") : preview.status === "READY" ? tr("Sẵn sàng lưu", "Ready") : tr("Cần xử lý", "Needs review")}</span></div></div>
      {hasScheduleIssues && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><div><p className="font-semibold">{tr("Chưa thể lưu dữ liệu chấm công", "Attendance cannot be saved yet")}</p><p className="mt-1">{tr("Hãy tạo ca đang hoạt động, gán ca cho nhân viên và dùng đúng mã ca trong tệp.", "Create an active schedule, assign it to employees and use the matching shift code in the file.")}</p></div><Link to="/work-schedules/assign" className="inline-flex h-10 items-center rounded-md border border-amber-300 bg-white px-4 font-semibold text-amber-900 hover:bg-amber-100">{tr("Thiết lập ca làm việc", "Configure schedules")}</Link></div>}
      <div className="mt-3 overflow-x-auto rounded-md border border-slate-200"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50"><tr>{[tr("Dòng", "Row"), tr("Nhân viên", "Employee"), tr("Ngày công", "Work date"), tr("Trạng thái", "Status"), tr("Thông báo", "Issues"), tr("Bỏ qua dòng", "Exclude row")].map(heading => <th key={heading} className="p-3 font-bold text-slate-700">{heading}</th>)}</tr></thead><tbody>{preview.rows.map(row => { const excluded = isExcluded(row); return <tr key={row.excel_row} className={`border-t border-slate-100 align-top ${excluded ? "bg-slate-50 opacity-60" : ""}`}><td className="p-3">{row.excel_row}</td><td className="p-3 font-semibold">{row.employee_code}<span className="block font-normal text-slate-600">{row.full_name}</span></td><td className="p-3">{row.candidates && row.candidates.length > 1 ? <select className="rounded-md border border-slate-300 p-2" value={choices[row.excel_row]?.work_date || row.work_date || ""} onChange={event => updateChoice(row.excel_row, { work_date: event.target.value || undefined })}><option value="">{tr("Chọn ngày", "Choose date")}</option>{row.candidates.map(date => <option key={date} value={date}>{date}</option>)}</select> : row.work_date || "—"}</td><td className="p-3"><span className="font-semibold">{statusLabel(row.validation_status)}</span><span className="block text-slate-600">{actionLabel(row.action)}</span></td><td className="max-w-md p-3"><ul className="space-y-1">{row.issues.map((issue, index) => <li key={`${issue.code}-${index}`} className={issue.severity === "ERROR" ? "text-red-700" : issue.severity === "WARNING" ? "text-amber-800" : "text-slate-600"}>{issueLabel(issue)}</li>)}</ul></td><td className="p-3 text-center"><input aria-label={tr(`Bỏ qua dòng ${row.excel_row}`, `Exclude row ${row.excel_row}`)} type="checkbox" checked={excluded} onChange={event => updateChoice(row.excel_row, { exclude: event.target.checked })}/></td></tr> })}</tbody></table></div>
      {choicesDirty && <p className="mt-4 rounded-md bg-blue-50 p-3 text-sm font-medium text-blue-900">{tr("Các lựa chọn chưa được backend kiểm tra. Hãy kiểm tra lại trước khi lưu.", "The backend has not checked these choices yet. Recheck before saving.")}</p>}
      {!choicesDirty && hasWarnings && <label className="mt-4 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm font-medium text-amber-900"><input className="mt-1" type="checkbox" checked={ack} onChange={event => setAck(event.target.checked)}/>{tr("Tôi đã kiểm tra và chấp nhận các cảnh báo trước khi lưu.", "I reviewed and accept the warnings before saving.")}</label>}
      <div className="mt-4 flex flex-wrap gap-2">{choicesDirty ? <Button type="button" disabled={busy} onClick={() => previewFile()}>{tr("Kiểm tra lại thay đổi", "Recheck changes")}</Button> : <Button type="button" disabled={busy || batchBlocked(preview) || (hasWarnings && !ack)} onClick={() => void confirm()}>{tr("Xác nhận và lưu", "Confirm and save")}</Button>}{!choicesDirty && <Button type="button" variant="secondary" disabled={busy} onClick={() => previewFile()}>{tr("Xem trước lại", "Preview again")}</Button>}</div>
    </div>}
  </div>
}
