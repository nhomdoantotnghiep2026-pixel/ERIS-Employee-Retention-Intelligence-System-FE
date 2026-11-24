import { AlertTriangle, CalendarDays, Clock3, UserRound, X } from "lucide-react"
import { Button, Card } from "../ui"
import { useLanguage } from "../../context/LanguageContext"
import type { LeaveRecord } from "../../services/attendance"

interface LeaveRecordDrawerProps {
  record: LeaveRecord | null
  employeeName: string
  leaveTypeLabel: string
  leaveTypeTone: string
  dayCount: number
  busy: boolean
  cancellationReason: string
  onReasonChange: (value: string) => void
  onClose: () => void
  onCancel: () => void
  formatDateTime: (value?: string | null) => string
}

export default function LeaveRecordDrawer({
  record,
  employeeName,
  leaveTypeLabel,
  leaveTypeTone,
  dayCount,
  busy,
  cancellationReason,
  onReasonChange,
  onClose,
  onCancel,
  formatDateTime,
}: LeaveRecordDrawerProps) {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)

  if (!record) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-detail-title"
      className="fixed inset-0 z-[90] bg-slate-950/40 backdrop-blur-[1px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy && !cancellationReason.trim()) onClose()
      }}
    >
      <Card className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col overflow-y-auto rounded-none border-0 p-0 shadow-2xl animate-in slide-in-from-right duration-200">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-600">{record.employee_code || `ID ${record.employee_id}`}</p>
            <h2 id="leave-detail-title" className="mt-1 truncate text-xl font-bold text-slate-950">{employeeName || tr("Không có tên nhân viên", "Employee name unavailable")}</h2>
          </div>
          <button type="button" aria-label={tr("Đóng chi tiết", "Close details")} disabled={busy} onClick={onClose} className="flex size-10 shrink-0 items-center justify-center rounded-md text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-50"><X size={19} /></button>
        </header>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          <section aria-label={tr("Thông tin ngày nghỉ", "Leave information")} className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
            <div><p className="text-xs font-semibold text-slate-600">{tr("Loại nghỉ", "Leave type")}</p><span className={`mt-1 inline-flex rounded-full border px-2 py-1 text-xs font-bold ${leaveTypeTone}`}>{leaveTypeLabel}</span></div>
            <div><p className="text-xs font-semibold text-slate-600">{tr("Trạng thái", "Status")}</p><span className={`mt-1 inline-flex rounded-full border px-2 py-1 text-xs font-bold ${record.record_status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-700"}`}>{record.record_status === "ACTIVE" ? tr("Đang sử dụng", "Active") : tr("Đã hủy", "Cancelled")}</span></div>
            <div className="sm:col-span-2"><p className="text-xs font-semibold text-slate-600">{tr("Khoảng nghỉ", "Leave period")}</p><p className="mt-1 flex items-center gap-2 font-semibold text-slate-950"><CalendarDays size={16} className="text-orange-600" />{record.start_date} → {record.end_date} · {dayCount} {tr("ngày", "days")}</p></div>
            <div className="sm:col-span-2"><p className="text-xs font-semibold text-slate-600">{tr("Lý do", "Reason")}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">{record.reason || "—"}</p></div>
          </section>

          <section aria-labelledby="leave-audit-title" className="rounded-md border border-slate-200 p-4">
            <div className="flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-md bg-slate-100 text-slate-700"><Clock3 size={17} /></span><div><h3 id="leave-audit-title" className="font-bold text-slate-950">{tr("Thông tin kiểm tra", "Audit information")}</h3><p className="text-xs text-slate-600">{tr("Dấu vết ghi nhận và cập nhật hồ sơ.", "Record creation and update trail.")}</p></div></div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md bg-slate-50 p-3"><dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-600"><UserRound size={14} />{tr("Người ghi nhận", "Recorded by")}</dt><dd className="mt-1 font-semibold text-slate-900">{record.recorded_by ?? "—"}</dd></div>
              <div className="rounded-md bg-slate-50 p-3"><dt className="text-xs font-semibold text-slate-600">{tr("Mã hồ sơ", "Record ID")}</dt><dd className="mt-1 font-semibold text-slate-900">#{record.id}</dd></div>
              <div className="rounded-md bg-slate-50 p-3"><dt className="text-xs font-semibold text-slate-600">{tr("Ngày tạo", "Created")}</dt><dd className="mt-1 text-sm text-slate-900">{formatDateTime(record.created_at)}</dd></div>
              <div className="rounded-md bg-slate-50 p-3"><dt className="text-xs font-semibold text-slate-600">{tr("Cập nhật gần nhất", "Last updated")}</dt><dd className="mt-1 text-sm text-slate-900">{formatDateTime(record.updated_at)}</dd></div>
            </dl>
          </section>

          {record.record_status === "ACTIVE" && (
            <section aria-labelledby="leave-cancel-title" className="rounded-md border border-rose-200 bg-rose-50/40 p-4">
              <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-700" /><div><h3 id="leave-cancel-title" className="font-bold text-rose-950">{tr("Hủy hồ sơ ngày nghỉ", "Cancel leave record")}</h3><p className="mt-1 text-sm leading-6 text-rose-900">{tr("Hồ sơ sẽ chuyển sang trạng thái Đã hủy. Nếu cần sửa, hãy tạo hồ sơ mới sau khi hủy.", "The record will be marked Cancelled. Create a new record afterward if a correction is needed.")}</p></div></div>
              <label className="mt-4 block text-sm font-semibold text-slate-800">{tr("Lý do hủy", "Cancellation reason")} <span className="text-rose-600">*</span><textarea required rows={3} maxLength={500} value={cancellationReason} onChange={event => onReasonChange(event.target.value)} placeholder={tr("Ví dụ: Sai khoảng ngày nghỉ", "Example: Incorrect leave dates")} className="mt-2 min-h-24 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none transition-colors duration-200 focus:border-orange-400 focus:ring-4 focus:ring-orange-100" /></label>
              <div className="mt-4 flex justify-end"><Button type="button" variant="danger" disabled={busy || !cancellationReason.trim()} onClick={onCancel}>{busy ? tr("Đang xử lý...", "Processing...") : tr("Hủy hồ sơ", "Cancel record")}</Button></div>
            </section>
          )}
        </div>
      </Card>
    </div>
  )
}
