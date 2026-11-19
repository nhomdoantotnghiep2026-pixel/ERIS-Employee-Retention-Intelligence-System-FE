import { useMemo, useState, type FormEvent } from "react"
import { Download, FileSpreadsheet, Info, UploadCloud } from "lucide-react"
import { Button, Card } from "./ui"
import { useLanguage } from "../context/LanguageContext"
import { attendanceErrors, attendanceMessage, batchBlocked, confirmAttendance, previewAttendance, saveDownload, type AttendanceBatch, type AttendanceChoice, type ConfirmResult } from "../services/attendance"

export default function AttendanceImport({ onImported }: { onImported: () => void }) {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => language === "vi" ? vi : en
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<AttendanceBatch | null>(null)
  const [choices, setChoices] = useState<Record<number, AttendanceChoice>>({})
  const [result, setResult] = useState<ConfirmResult | null>(null)
  const [ack, setAck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const choiceList = useMemo(() => Object.values(choices).sort((a, b) => a.excel_row - b.excel_row), [choices])
  const hasWarnings = !!preview?.rows.some(row => !row.excluded && row.issues.some(issue => issue.severity === "WARNING"))

  function selectFile(next: File | null) { setFile(next); setPreview(null); setChoices({}); setResult(null); setAck(false); setError("") }
  function validate() {
    if (!file || !/\.xlsx$/i.test(file.name) || !file.size || file.size > 10 * 1024 * 1024) {
      setError(tr("Chọn tệp XLSX không rỗng, tối đa 10 MiB.", "Choose a nonempty XLSX file up to 10 MiB.")); return false
    }
    return true
  }
  async function run(task: () => Promise<void>) {
    if (busy) return; setBusy(true); setError("")
    try { await task() } catch (e) { setError(attendanceMessage(e, tr("Không xử lý được tệp chấm công.", "Could not process the attendance file."))) } finally { setBusy(false) }
  }
  function previewFile(event?: FormEvent) {
    event?.preventDefault(); if (!validate() || !file) return
    void run(async () => { setPreview(await previewAttendance(file, choiceList)); setResult(null); setAck(false) })
  }
  function updateChoice(excelRow: number, patch: Partial<AttendanceChoice>) {
    setChoices(current => ({ ...current, [excelRow]: { ...current[excelRow], ...patch, excel_row: excelRow } })); setPreview(null); setResult(null)
  }
  async function confirm() {
    if (!file || !preview) return
    await run(async () => { const saved = await confirmAttendance(file, preview.preview_token, choiceList, ack); setResult(saved); setPreview(null); onImported() })
  }
  async function downloadErrors() {
    if (!validate() || !file) return
    await run(async () => saveDownload(await attendanceErrors(file, choiceList), "attendance-errors.xlsx"))
  }
  const label = (value: string) => ({ VALID: tr("Hợp lệ", "Valid"), WARNING: tr("Cảnh báo", "Warning"), ERROR: tr("Lỗi", "Error"), DUPLICATE: tr("Trùng", "Duplicate"), NO_DATA: tr("Không có dữ liệu", "No data"), INCOMPLETE: tr("Thiếu giờ", "Incomplete") } as Record<string, string>)[value] || value

  return <Card className="mb-5 p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-slate-950">{tr("Nhập dữ liệu chấm công", "Import attendance")}</h2><p className="mt-1 text-sm font-medium text-slate-600">{tr("Tệp chỉ được lưu sau khi bạn xem trước và xác nhận.", "The file is saved only after preview and confirmation.")}</p></div><a href="/templates/ERIS_Attendance_Import_Template.xlsx" download className="inline-flex h-10 items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-800 hover:bg-blue-100"><FileSpreadsheet size={16}/>{tr("Tải tệp mẫu", "Download template")}</a></div>
    <details className="mt-3 text-sm text-slate-600"><summary className="inline-flex cursor-pointer items-center gap-2 font-semibold text-slate-700"><Info size={16}/>{tr("Yêu cầu tệp", "File requirements")}</summary><p className="mt-2 rounded-md bg-slate-50 p-3 font-medium">{tr("Dùng tệp XLSX đúng mẫu, tối đa 10 MiB. Sau khi đổi lựa chọn dòng, hãy xem trước lại.", "Use the XLSX template, up to 10 MiB. Preview again after changing a row choice.")}</p></details>
    <form onSubmit={previewFile} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex min-h-24 flex-1 cursor-pointer items-center justify-center gap-3 rounded-md border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-4 hover:border-orange-300"><UploadCloud className="text-orange-500"/><span className="text-sm font-semibold text-slate-700">{file?.name || tr("Chọn tệp XLSX", "Choose an XLSX file")}</span><input className="sr-only" type="file" accept=".xlsx" disabled={busy} onChange={e => selectFile(e.target.files?.[0] || null)}/></label><Button type="submit" disabled={!file || busy}>{tr("Xem trước", "Preview")}</Button><Button type="button" variant="secondary" disabled={!file || busy} onClick={() => void downloadErrors()}><Download size={16}/>{tr("Tải danh sách lỗi", "Download issues")}</Button></form>
    {error && <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 font-medium text-red-800">{error}</p>}
    {result && <p role="status" className="mt-4 rounded-md bg-emerald-50 p-3 font-semibold text-emerald-800">{tr(`Đã lưu ${result.inserted} bản ghi, bỏ qua ${result.skipped}, loại ${result.excluded}.`, `Saved ${result.inserted}, skipped ${result.skipped}, excluded ${result.excluded}.`)}</p>}
    {!preview && choiceList.length > 0 && !result && <p className="mt-4 rounded-md bg-amber-50 p-3 font-medium text-amber-900">{tr("Lựa chọn dòng đã thay đổi. Bấm “Xem trước” để kiểm tra lại.", "Row choices changed. Preview again to validate them.")}</p>}
    {preview && <div className="mt-5"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold text-slate-900">{tr(`Kết quả xem trước: ${preview.rows.length} dòng`, `Preview: ${preview.rows.length} rows`)}</p><span className={`rounded-md px-3 py-1 text-sm font-semibold ${preview.status === "READY" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{preview.status === "READY" ? tr("Sẵn sàng lưu", "Ready") : tr("Cần xử lý", "Needs review")}</span></div>
      <div className="mt-3 overflow-x-auto rounded-md border border-slate-200"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50"><tr>{[tr("Dòng", "Row"), tr("Nhân viên", "Employee"), tr("Ngày công", "Work date"), tr("Trạng thái", "Status"), tr("Thông báo", "Issues"), tr("Loại dòng", "Exclude")].map(h => <th key={h} className="p-3 font-bold text-slate-700">{h}</th>)}</tr></thead><tbody>{preview.rows.map(row => <tr key={row.excel_row} className="border-t border-slate-100 align-top"><td className="p-3">{row.excel_row}</td><td className="p-3 font-semibold">{row.employee_code}<span className="block font-normal text-slate-600">{row.full_name}</span></td><td className="p-3">{row.candidates && row.candidates.length > 1 ? <select className="rounded-md border border-slate-300 p-2" value={choices[row.excel_row]?.work_date || row.work_date || ""} onChange={e => updateChoice(row.excel_row, { work_date: e.target.value || undefined })}><option value="">{tr("Chọn ngày", "Choose date")}</option>{row.candidates.map(d => <option key={d} value={d}>{d}</option>)}</select> : row.work_date || "—"}</td><td className="p-3"><span className="font-semibold">{label(row.validation_status)}</span><span className="block text-slate-600">{row.action}</span></td><td className="max-w-md p-3"><ul className="space-y-1">{row.issues.map((issue, index) => <li key={`${issue.code}-${index}`} className={issue.severity === "ERROR" ? "text-red-700" : issue.severity === "WARNING" ? "text-amber-800" : "text-slate-600"}>{issue.message}</li>)}</ul></td><td className="p-3"><input aria-label={tr(`Loại dòng ${row.excel_row}`, `Exclude row ${row.excel_row}`)} type="checkbox" checked={!!choices[row.excel_row]?.exclude} onChange={e => updateChoice(row.excel_row, { exclude: e.target.checked })}/></td></tr>)}</tbody></table></div>
      {hasWarnings && <label className="mt-4 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm font-medium text-amber-900"><input className="mt-1" type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)}/>{tr("Tôi đã kiểm tra và chấp nhận các cảnh báo trước khi lưu.", "I reviewed and accept the warnings before saving.")}</label>}
      <div className="mt-4 flex flex-wrap gap-2"><Button type="button" disabled={busy || batchBlocked(preview) || (hasWarnings && !ack)} onClick={() => void confirm()}>{tr("Xác nhận và lưu", "Confirm and save")}</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => previewFile()}>{tr("Xem trước lại", "Preview again")}</Button></div></div>}
  </Card>
}
