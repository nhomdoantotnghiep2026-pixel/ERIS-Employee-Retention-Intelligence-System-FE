import { useRef, useState, type FormEvent } from "react"
import { AlertTriangle, Check, FileSpreadsheet, Upload, X } from "lucide-react"
import { Button, Card } from "../ui"
import { leaveTypeDisplay } from "../../utils/leaveRecordDisplay"
import { useLanguage } from "../../context/LanguageContext"
import type {
  LeaveImportResult,
  LeavePreview,
  LeaveType,
} from "../../services/attendance"

interface LeaveImportDialogProps {
  open: boolean
  busy: boolean
  file: File | null
  preview: LeavePreview | null
  result: LeaveImportResult | null
  types: LeaveType[]
  error: string
  onClose: () => void
  onDismissError: () => void
  onFileChange: (file: File | null) => void
  onPreview: (event: FormEvent) => void
  onConfirm: () => void
  onFinishPartial: (result: LeaveImportResult) => void
}

const statusTone: Record<string, string> = {
  VALID: "border-emerald-200 bg-emerald-50 text-emerald-700",
  INSERTED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DUPLICATE: "border-slate-200 bg-slate-100 text-slate-700",
  SKIPPED: "border-slate-200 bg-slate-100 text-slate-700",
  CONFLICT: "border-amber-200 bg-amber-50 text-amber-800",
  ERROR: "border-rose-200 bg-rose-50 text-rose-700",
}

export default function LeaveImportDialog({
  open,
  busy,
  file,
  preview,
  result,
  types,
  error,
  onClose,
  onDismissError,
  onFileChange,
  onPreview,
  onConfirm,
  onFinishPartial,
}: LeaveImportDialogProps) {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const rows = result?.rows || preview?.rows || []
  const typeByCode = new Map(types.map(type => [type.code, type.name]))
  const activeStep = result ? 3 : preview ? 2 : file ? 1 : 0
  const visibleError = /unable to read file/i.test(error)
    ? tr(
        "Không thể đọc tệp. Hãy kiểm tra đúng định dạng XLSX/CSV và thử tải lại.",
        "Unable to read the file. Check that it is a valid XLSX/CSV file and try again.",
      )
    : error
  const statusLabel = (status: string) =>
    ({
      VALID: tr("Hợp lệ", "Valid"),
      DUPLICATE: tr("Trùng, sẽ bỏ qua", "Duplicate, will skip"),
      CONFLICT: tr("Xung đột", "Conflict"),
      ERROR: tr("Lỗi", "Error"),
      INSERTED: tr("Đã lưu", "Inserted"),
      SKIPPED: tr("Đã bỏ qua", "Skipped"),
    })[status] || status
  const importMessage = (code?: string, fallback?: string) => {
    const messages: Record<string, string> = {
      EMPLOYEE_NOT_FOUND: tr("Không tìm thấy mã nhân viên.", "Employee code was not found."),
      LEAVE_TYPE_NOT_FOUND: tr("Không tìm thấy mã loại nghỉ.", "Leave type code was not found."),
      LEAVE_CONFLICT: tr("Khoảng nghỉ bị chồng với hồ sơ nghỉ khác.", "The leave period overlaps another leave record."),
      ATTENDANCE_CONFLICT: tr("Khoảng nghỉ bị chồng với dữ liệu chấm công.", "The leave period overlaps attendance data."),
      VALIDATION_ERROR: tr("Dữ liệu dòng không hợp lệ. Kiểm tra mã và định dạng ngày.", "The row is invalid. Check codes and date formats."),
    }
    return messages[code || ""] || fallback || ""
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px] animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-import-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy && !file) onClose()
      }}
    >
      <Card className="relative max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-y-auto p-5 shadow-2xl animate-in slide-in-from-bottom-2 zoom-in-95 duration-200 sm:p-6">
        <button
          type="button"
          aria-label={tr("Đóng", "Close")}
          disabled={busy}
          onClick={onClose}
          className="absolute right-5 top-5 flex size-10 items-center justify-center rounded-md text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-50"
        >
          <X size={20} />
        </button>

        <div className="pr-12">
          <h2 id="leave-import-title" className="text-lg font-bold text-slate-950">
            {tr("Nhập dữ liệu ngày nghỉ", "Import leave records")}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            {tr("Tải tệp XLSX hoặc CSV, xem trước lỗi và chỉ xác nhận lưu những dòng hợp lệ.", "Upload an XLSX or CSV file, review issues and confirm only valid rows.")}
          </p>
        </div>

        {visibleError && (
          <div
            role="alert"
            aria-live="assertive"
            className="mt-4 flex items-start gap-3 rounded-md border border-rose-200 bg-rose-50 p-3.5 text-rose-950"
          >
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-700" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">
                {tr("Không thể nhập tệp", "File import failed")}
              </p>
              <p className="mt-1 text-sm leading-6 text-rose-900">
                {visibleError}
              </p>
            </div>
            <button
              type="button"
              aria-label={tr("Ẩn thông báo lỗi", "Dismiss error")}
              onClick={onDismissError}
              className="flex size-9 shrink-0 items-center justify-center rounded-md text-rose-700 transition-colors duration-200 hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
            >
              <X size={17} />
            </button>
          </div>
        )}

        <ol aria-label={tr("Tiến trình nhập dữ liệu", "Import progress")} className="mt-5 grid overflow-hidden rounded-md border border-slate-200 sm:grid-cols-4">
          {[
            tr("Chọn tệp", "Select file"),
            tr("Xem trước", "Preview"),
            tr("Xác nhận", "Confirm"),
            tr("Hoàn tất", "Complete"),
          ].map((label, index) => (
            <li key={label} className={`flex items-center gap-2 border-b border-slate-200 px-3 py-2.5 text-sm font-semibold last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${index === activeStep ? "bg-orange-50 text-orange-800" : index < activeStep ? "bg-emerald-50 text-emerald-800" : "bg-white text-slate-600"}`}>
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${index < activeStep ? "bg-emerald-600 text-white" : index === activeStep ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                {index < activeStep ? <Check size={14} /> : index + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>

        <form onSubmit={onPreview} className="mt-5">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv"
            disabled={busy}
            className="sr-only"
            onChange={(event) => onFileChange(event.target.files?.[0] || null)}
          />
          <div
            className={`flex min-h-40 flex-col items-center justify-center rounded-md border-2 border-dashed px-5 py-6 text-center transition-colors duration-200 ${dragging ? "border-orange-400 bg-orange-50" : "border-slate-300 bg-slate-50"}`}
            onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              if (!busy) onFileChange(event.dataTransfer.files?.[0] || null)
            }}
          >
            <span className="flex size-12 items-center justify-center rounded-md bg-orange-50 text-orange-600"><Upload size={24} /></span>
            <p className="mt-3 text-sm font-semibold text-slate-900">{tr("Kéo thả tệp vào đây", "Drop your file here")}</p>
            <p className="mt-1 text-xs text-slate-600">{tr("XLSX hoặc CSV · tối đa 10 MiB · 10.000 dòng", "XLSX or CSV · up to 10 MiB · 10,000 rows")}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button type="button" variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>{tr("Chọn tệp", "Browse file")}</Button>
              <a href="/templates/ERIS_Leave_Records_Template.csv" download className="inline-flex h-10 items-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700">{tr("Tải mẫu CSV", "Download CSV template")}</a>
            </div>
            {file && <span className="mt-4 inline-flex max-w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm"><FileSpreadsheet size={16} className="shrink-0 text-emerald-600" /><span className="truncate">{file.name}</span></span>}
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={busy || !file}>{tr("Xem trước dữ liệu", "Preview data")}</Button>
          </div>
        </form>

        {(preview || result) && (
          <section className="mt-5 border-t border-slate-200 pt-5">
            <div role="status" className={`rounded-md p-3 text-sm ${result && (result.conflicted || result.failed) ? "bg-amber-50 text-amber-950" : "bg-blue-50 text-blue-900"}`}>
              {result
                ? `${tr("Đã lưu", "Inserted")}: ${result.inserted} · ${tr("Bỏ qua", "Skipped")}: ${result.skipped} · ${tr("Xung đột", "Conflicts")}: ${result.conflicted} · ${tr("Lỗi", "Errors")}: ${result.failed}`
                : `${tr("Hợp lệ", "Valid")}: ${preview!.summary.valid} · ${tr("Trùng", "Duplicates")}: ${preview!.summary.duplicate} · ${tr("Xung đột", "Conflicts")}: ${preview!.summary.conflict} · ${tr("Lỗi", "Errors")}: ${preview!.summary.error}`}
            </div>
            <div className="mt-3 max-h-80 overflow-auto rounded-md border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50"><tr>{[tr("Dòng", "Row"), tr("Nhân viên / loại", "Employee / type"), tr("Khoảng nghỉ", "Leave dates"), tr("Kết quả", "Outcome")].map(label => <th key={label} className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-600">{label}</th>)}</tr></thead>
                <tbody>{rows.map(row => {
                  const message = importMessage(row.code, row.message)
                  return <tr key={row.row} className="border-t border-slate-100"><td className="px-3 py-2">{row.row}</td><td className="px-3 py-2 font-medium text-slate-900">{row.employee_code} · {leaveTypeDisplay(row.leave_type, typeByCode.get(row.leave_type), tr).label}</td><td className="px-3 py-2">{row.start_date} → {row.end_date}</td><td className="px-3 py-2"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusTone[row.status] || statusTone.ERROR}`}>{statusLabel(row.status)}</span>{message && <p className="mt-1 max-w-sm text-xs text-slate-600">{message}</p>}</td></tr>
                })}</tbody>
              </table>
            </div>
          </section>
        )}

        {preview && !result && <div className="mt-4 flex justify-end"><Button disabled={busy || !file || preview.summary.valid === 0} onClick={onConfirm}>{tr("Xác nhận nhập hồ sơ nghỉ", "Confirm leave import")}</Button></div>}
        {result && (result.conflicted > 0 || result.failed > 0) && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p>{tr(`Đã lưu ${result.inserted} hồ sơ; còn ${result.conflicted + result.failed} dòng cần xử lý.`, `Saved ${result.inserted} records; ${result.conflicted + result.failed} rows still need attention.`)}</p><div className="flex gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => onFileChange(null)}>{tr("Chọn tệp khác", "Choose another file")}</Button><Button type="button" disabled={busy} onClick={() => onFinishPartial(result)}>{tr("Đóng và xem danh sách", "Close and view records")}</Button></div></div>}
      </Card>
    </div>
  )
}
