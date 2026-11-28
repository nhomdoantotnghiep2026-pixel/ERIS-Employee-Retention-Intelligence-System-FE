import { useEffect, useRef, useState } from "react"
import { CalendarDays, CheckCircle2, ChevronDown, ClipboardList, FileText, History, X } from "lucide-react"
import { Button } from "../ui"
import { useLanguage } from "../../context/LanguageContext"
import { fetchLeaveSummary, type LeaveRecord } from "../../services/attendance"

interface LeaveRecordDrawerProps {
  record: LeaveRecord | null
  employeeName: string
  employeeCode?: string
  department?: string
  reason: string
  leaveTypeLabel: string
  leaveTypeTone: string
  dayCount: number
  annualTypeIds: string
  own: boolean
  busy: boolean
  error: string
  cancellationReason: string
  onReasonChange: (value: string) => void
  onClose: () => void
  onCancel: () => void
  formatDate: (value: string) => string
  formatDateTime: (value?: string | null) => string
}

export default function LeaveRecordDrawer(props: LeaveRecordDrawerProps) {
  return props.record ? <LeaveRecordDetail key={props.record.id} {...props} record={props.record} /> : null
}

function LeaveRecordDetail({
  record, employeeName, employeeCode, department, reason, leaveTypeLabel, leaveTypeTone,
  dayCount, annualTypeIds, own, busy, error, cancellationReason,
  onReasonChange, onClose, onCancel, formatDate, formatDateTime,
}: LeaveRecordDrawerProps & { record: LeaveRecord }) {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => language === "vi" ? vi : en
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [annualUsed, setAnnualUsed] = useState<number | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const year = record.start_date.slice(0, 4)

  useEffect(() => {
    const dialog = dialogRef.current
    const previousOverflow = document.body.style.overflow
    dialog?.showModal()
    document.body.style.overflow = "hidden"
    return () => {
      dialog?.close()
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    if (own || !annualTypeIds || !/^\d{4}$/.test(year)) return
    const controller = new AbortController()
    const typeIds = new Set(annualTypeIds.split(",").map(Number))
    setBalanceLoading(true)
    setAnnualUsed(null)
    void fetchLeaveSummary({ employee_id: String(record.employee_id), from: year + "-01-01", to: year + "-12-31" }, controller.signal)
      .then(({ data }) => {
        if (controller.signal.aborted) return
        const types = data.filter(item => typeIds.has(item.leave_type_id))
        if (types.every(item => item.total_days !== null && Number.isFinite(Number(item.total_days)))) {
          setAnnualUsed(types.reduce((days, item) => days + Number(item.total_days), 0))
        }
      })
      .catch(() => undefined)
      .finally(() => { if (!controller.signal.aborted) setBalanceLoading(false) })
    return () => controller.abort()
  }, [annualTypeIds, own, record.employee_id, year])

  const effective = record.record_status === "ACTIVE"
  const activity = [
    record.created_at && { date: record.created_at, label: tr("Ghi nhận hồ sơ nghỉ", "Leave record created") },
    record.updated_at && (record.updated_at !== record.created_at || !effective) && {
      date: record.updated_at,
      label: effective ? tr("Cập nhật hồ sơ", "Leave record updated") : tr("Hủy hồ sơ nghỉ", "Leave record cancelled"),
    },
  ]

  return (
    <dialog ref={dialogRef} aria-labelledby="leave-detail-title"
      onCancel={event => { event.preventDefault(); onClose() }}
      onClick={event => { if (event.target === event.currentTarget && !cancellationReason.trim()) onClose() }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent text-slate-950 backdrop:bg-slate-950/45">
      <div className="ml-auto flex h-full w-[520px] max-w-full flex-col overflow-y-auto bg-white shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-right motion-safe:duration-200">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="leave-detail-title" className="text-xs font-semibold uppercase tracking-wide text-slate-600">{tr("Hồ sơ chi tiết nghỉ phép", "Leave record details")}</h2>
              <p className="mt-1 wrap-break-word text-xl font-semibold">{employeeName || employeeCode || tr("Hồ sơ nhân viên", "Employee record")}</p>
            </div>
            <Button type="button" size="sm" variant="ghost" autoFocus disabled={busy} onClick={onClose} aria-label={tr("Đóng chi tiết", "Close details")}><X size={18} /></Button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {employeeCode && employeeName && <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">{employeeCode}</span>}
            {department && <span className="text-xs text-slate-600">{department}</span>}
            <span className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${effective ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-100 text-slate-700"}`}>
              {effective && <CheckCircle2 size={13} aria-hidden="true" />}
              {effective ? tr("Có hiệu lực", "Effective") : tr("Đã hủy", "Cancelled")}
            </span>
          </div>
        </header>

        <div className="space-y-5 p-5 sm:p-6">
          <section aria-labelledby="leave-balance" className="rounded-xl border border-sky-200/70 bg-gradient-to-br from-sky-50/70 to-white p-4">
            <h3 id="leave-balance" className="flex items-center gap-2 font-semibold"><ClipboardList size={16} className="text-sky-700" aria-hidden="true" />{tr(`Quỹ phép năm ${year}`, `Annual leave balance · ${year}`)}</h3>
            <dl className="mt-3 grid gap-2 min-[430px]:grid-cols-3">
              <Metric label={tr("Tiêu chuẩn năm", "Annual entitlement")} value="—" />
              <Metric label={tr("Đã ghi nhận", "Recorded")} value={balanceLoading ? "…" : annualUsed === null ? "—" : `${annualUsed} ${tr("ngày công", "working days")}`} />
              <Metric label={tr("Còn lại", "Remaining")} value="—" />
            </dl>
            <p className="mt-3 text-xs leading-5 text-slate-600">{tr("Chưa có hạn mức phép năm để tính số ngày còn lại.", "Annual entitlement is unavailable, so the remaining balance cannot be calculated.")}</p>
            {annualUsed === null && !balanceLoading && <p className="text-xs leading-5 text-slate-600">{tr("Chưa có số ngày công phép năm được xác nhận.", "Verified annual leave working days are unavailable.")}</p>}
          </section>
          <section aria-labelledby="leave-period-title" className="rounded-xl border border-slate-200 p-4">
            <h3 id="leave-period-title" className="flex items-center gap-2 font-semibold"><CalendarDays size={16} className="text-orange-600" aria-hidden="true" />{tr("Chi tiết đợt nghỉ", "Leave period details")}</h3>
            <dl className="mt-3 space-y-3 text-sm">
              <div><dt className="text-xs font-medium text-slate-600">{tr("Loại nghỉ", "Leave type")}</dt><dd><span className={`mt-1 inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${leaveTypeTone}`}>{leaveTypeLabel}</span></dd></div>
              <div><dt className="text-xs font-medium text-slate-600">{tr("Thời gian", "Date range")}</dt><dd className="mt-1 flex flex-wrap items-center gap-2 tabular-nums"><span>{formatDate(record.start_date)} → {formatDate(record.end_date)}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{dayCount} {tr("ngày lịch", "calendar days")}</span></dd></div>
              <div><dt className="text-xs font-medium text-slate-600">{tr("Lý do", "Reason")}</dt><dd className="mt-1 whitespace-pre-wrap wrap-break-word leading-relaxed text-slate-800">{reason}</dd></div>
              <div className="flex items-start gap-2 border-t border-slate-100 pt-3 text-slate-600"><FileText size={15} className="mt-0.5 shrink-0" aria-hidden="true" /><div><dt className="text-xs font-medium">{tr("Giấy tờ minh chứng", "Supporting documents")}</dt><dd className="mt-1">{tr("Chưa có dữ liệu đính kèm.", "Attachment data is unavailable.")}</dd></div></div>
            </dl>
          </section>
          <section aria-labelledby="leave-audit-title" className="rounded-xl border border-slate-200 p-4">
            <h3 id="leave-audit-title" className="flex items-center gap-2 font-semibold"><History size={16} className="text-slate-600" aria-hidden="true" />{tr("Lịch sử ghi nhận & phê duyệt", "Record and approval history")}</h3>
            <p className="mt-2 text-sm text-slate-600">{tr("Chưa có lịch sử phê duyệt liên kết với hồ sơ này.", "No approval history is linked to this record.")}</p>
            {activity.some(Boolean) && <ol className="ml-2 mt-4 space-y-3 border-l border-slate-200">
              {activity.map((item, index) => item && <li key={index} className="relative pl-4">
                <span aria-hidden="true" className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-sky-500 ring-4 ring-white" />
                <p className="text-xs tabular-nums text-slate-600">{formatDateTime(item.date)}</p><p className="mt-1 text-sm font-semibold">{item.label}</p>
              </li>)}
            </ol>}
          </section>
          {!own && effective && <section className="rounded-xl border border-slate-200">
            <button type="button" aria-expanded={cancelOpen} aria-controls="leave-cancel-form" onClick={() => setCancelOpen(value => !value)} className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-orange-500">{tr("Hủy hồ sơ ngày nghỉ", "Cancel leave record")}<ChevronDown size={16} className={cancelOpen ? "rotate-180" : ""} /></button>
            {cancelOpen && <form id="leave-cancel-form" onSubmit={event => { event.preventDefault(); onCancel() }} className="space-y-3 border-t border-slate-200 p-4">
              <label className="block text-sm font-semibold">{tr("Lý do hủy (bắt buộc)", "Cancellation reason (required)")}
                <textarea required rows={3} maxLength={500} disabled={busy} value={cancellationReason} onChange={event => onReasonChange(event.target.value)} className="mt-2 w-full resize-y rounded-md border border-slate-300 p-2 text-sm font-normal focus-visible:outline-2 focus-visible:outline-orange-500" />
              </label>
              {error && <p role="alert" className="rounded-md bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
              <Button type="submit" variant="danger" disabled={busy || !cancellationReason.trim()}>{busy ? tr("Đang hủy…", "Cancelling…") : tr("Xác nhận hủy", "Confirm cancellation")}</Button>
            </form>}
          </section>}
        </div>
      </div>
    </dialog>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-slate-200 bg-white p-2.5"><dt className="text-xs text-slate-600">{label}</dt><dd className="mt-1 text-sm font-semibold tabular-nums">{value}</dd></div>
}
