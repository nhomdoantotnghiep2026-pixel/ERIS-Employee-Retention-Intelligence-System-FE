import { useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  BarChart3,
  CalendarRange,
  HelpCircle,
  Inbox,
  RotateCcw,
  Search,
  Upload,
  X,
} from "lucide-react"
import { AppShell } from "../components/AppShell"
import { Button, Card, SectionHeader } from "../components/ui"
import AttendanceImport from "../components/AttendanceImport"
import AttendanceReconcile from "../components/AttendanceReconcile"
import { useLanguage } from "../context/LanguageContext"
import { useAutoDismissFeedback } from "../hooks/useAutoDismissState"
import { listWorkSchedules } from "../services/api"
import {
  fetchAttendance,
  fetchAttendanceSummary,
  fetchAttendanceDetail,
  fetchAttendanceAudit,
  cancelAttendance,
  attendanceMessage,
  type ImportedAttendance,
  type AttendanceSummary,
  type AttendanceAudit,
  type RecordFilters,
} from "../services/attendance"
const control =
  "mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
const localTime = (value: string | null) => value?.slice(0, 19) || ""
export default function AttendanceWorkspace({
  own = false,
}: {
  own?: boolean
}) {
  const { language } = useLanguage()
  const navigate = useNavigate()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const [filters, setFilters] = useState<RecordFilters>({
      record_status: "ACTIVE",
    }),
    [draft, setDraft] = useState<RecordFilters>({ record_status: "ACTIVE" })
  const [rows, setRows] = useState<ImportedAttendance[]>([]),
    [summary, setSummary] = useState<AttendanceSummary | null>(null)
  const [hasAnyRecords, setHasAnyRecords] = useState<boolean | null>(null)
  const [selected, setSelected] = useState<ImportedAttendance | null>(null),
    [logs, setLogs] = useState<AttendanceAudit[]>([]),
    [logOffset, setLogOffset] = useState(0)
  const [offset, setOffset] = useState(0),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false)
  const { error, message: notice, setError, setMessage: setNotice } = useAutoDismissFeedback()
  const [logError, setLogError] = useState("")
  const [reason, setReason] = useState("")
  const [importOpen, setImportOpen] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [reconcileOpen, setReconcileOpen] = useState(false)
  const [reconcileBusy, setReconcileBusy] = useState(false)
  const [activeShiftTypes, setActiveShiftTypes] = useState<string[]>([])
  const [scheduleCheck, setScheduleCheck] = useState<"loading" | "ready" | "missing" | "error">("loading")
  useEffect(() => {
    const c = new AbortController()
    setLoading(true)
    setError("")
    setRows([])
    void fetchAttendance({ ...filters, limit: 20, offset }, own, c.signal)
      .then((response) => {
        if (!c.signal.aborted) setRows(response.data)
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setError(
            attendanceMessage(
              e,
              tr("Không tải được chấm công.", "Could not load attendance."),
            ),
          )
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false)
      })
    if (!own) {
      setSummary(null)
      void fetchAttendanceSummary(filters, c.signal)
        .then((response) => { if (!c.signal.aborted) setSummary(response.data) })
        .catch(() => { if (!c.signal.aborted) setSummary(null) })
    }
    void fetchAttendance({ record_status: "ALL", limit: 1, offset: 0 }, own, c.signal)
      .then((response) => { if (!c.signal.aborted) setHasAnyRecords(response.data.length > 0) })
      .catch(() => undefined)
    return () => c.abort()
  }, [filters, offset, revision, own])
  useEffect(() => {
    if (own) return
    let live = true
    setScheduleCheck("loading")
    void listWorkSchedules()
      .then((response) => {
        if (!live) return
        const shiftTypes = Array.from(new Set(response.data.filter((schedule) => schedule.status === "ACTIVE" && schedule.shift_type?.trim()).map((schedule) => schedule.shift_type!.trim())))
        setActiveShiftTypes(shiftTypes)
        setScheduleCheck(shiftTypes.length ? "ready" : "missing")
      })
      .catch(() => { if (live) setScheduleCheck("error") })
    return () => { live = false }
  }, [own, revision])
  useEffect(() => {
    let live = true
    setLogs([])
    setLogError("")
    if (selected && !own)
      void fetchAttendanceAudit(selected.id, logOffset)
        .then((r) => {
          if (live) setLogs(r.data)
        })
        .catch((e) => {
          if (live)
            setLogError(
              attendanceMessage(
                e,
                tr(
                  "Không tải được lịch sử thay đổi.",
                  "Could not load audit history.",
                ),
              ),
            )
        })
    return () => {
      live = false
    }
  }, [selected, logOffset, own])
  useEffect(() => {
    if (!importOpen && !reconcileOpen && !selected) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busy || importBusy || reconcileBusy) return
      setImportOpen(false)
      setReconcileOpen(false)
      setSelected(null)
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", closeOnEscape)
    }
  }, [importOpen, reconcileOpen, selected, busy, importBusy, reconcileBusy])
  async function open(row: ImportedAttendance) {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      const r = await fetchAttendanceDetail(row.id)
      setSelected(r.data)
      setLogOffset(0)
      setReason("")
    } catch (e) {
      setError(
        attendanceMessage(
          e,
          tr("Không tải được bản ghi.", "Could not load record."),
        ),
      )
    } finally {
      setBusy(false)
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault()
    if (!selected || busy || !reason.trim()) return
    if (
      !window.confirm(
        tr("Xác nhận hủy bản ghi này? Sau đó cần nhập lại nếu muốn thay thế.", "Cancel this record? Import a replacement afterward if needed."),
      )
    )
      return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await cancelAttendance(selected, reason)
      setSelected(null)
      setNotice(tr("Đã hủy bản ghi. Hãy nhập lại tệp nếu cần bản ghi thay thế.", "Record cancelled. Import a replacement if needed."))
      setRevision((v) => v + 1)
    } catch (e) {
      setError(
        attendanceMessage(
          e,
          tr(
            "Không lưu được. Tải lại bản ghi để kiểm tra.",
            "Could not save. Reload the record to review.",
          ),
        ),
      )
    } finally {
      setBusy(false)
    }
  }
  const invalid = !!(draft.from && draft.to && draft.from > draft.to)
  const pageStart = rows.length ? offset + 1 : 0
  const pageEnd = offset + rows.length
  return (
    <AppShell
      breadcrumb={[
        tr("Nhân sự", "Workforce"),
        tr(
          own ? "Chấm công của tôi" : "Quản lý chấm công",
          own ? "My attendance" : "Attendance data",
        ),
      ]}
    >
      <SectionHeader
        title={tr(
          own ? "Chấm công của tôi" : "Dữ liệu chấm công",
          own ? "My attendance" : "Attendance data",
        )}
        description={tr(
          own ? "Xem dữ liệu chấm công do HR đã thu thập từ tệp nguồn." : "HR nhập tệp chấm công từ nguồn bên ngoài; hệ thống kiểm tra và lưu dữ liệu, không tự động chấm công.",
          own ? "View attendance data collected by HR from source files." : "HR imports attendance files from an external source; the system validates and stores data but does not record attendance automatically.",
        )}
      >
        {!own ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate("/attendance/dashboard")}>
              <BarChart3 size={16} />
              {tr("Xem tổng quan", "View dashboard")}
            </Button>
            <span
              className="inline-flex"
              title={scheduleCheck === "missing" ? tr("Cần có lịch làm việc đang hoạt động trước khi đối soát.", "An active work schedule is required before reconciliation.") : undefined}
            >
              <Button
                type="button"
                variant="secondary"
                disabled={scheduleCheck === "loading" || scheduleCheck === "missing"}
                onClick={() => setReconcileOpen(true)}
              >
                <CalendarRange size={16} />
                {tr("Đối soát nghỉ và ngày lễ", "Reconcile leave and holidays")}
              </Button>
            </span>
            <span
              className="inline-flex"
              title={scheduleCheck === "missing" ? tr("Cần tạo ít nhất một ca đang hoạt động trước khi nhập.", "Create at least one active schedule before importing.") : undefined}
            >
            <Button
              type="button"
              disabled={scheduleCheck === "loading" || scheduleCheck === "missing"}
              onClick={() => setImportOpen(true)}
            >
              <Upload size={16} />
              {tr("Nhập tệp chấm công", "Import attendance file")}
            </Button>
            </span>
          </div>
        ) : (
          <Button
            variant="secondary"
            disabled={loading || busy}
            onClick={() => setRevision((v) => v + 1)}
          >
            {tr("Tải lại", "Refresh")}
          </Button>
        )}
      </SectionHeader>
      {!own && <ol aria-label={tr("Quy trình nhập dữ liệu chấm công", "Attendance import workflow")} className="mb-4 grid overflow-hidden rounded-md border border-slate-200 bg-white sm:grid-cols-4">
        {[
          tr("Chọn tệp nguồn", "Select source file"),
          tr("Xem trước và kiểm tra", "Preview and validate"),
          tr("Xác nhận lưu", "Confirm and save"),
          tr("Theo dõi dữ liệu", "Review collected data"),
        ].map((step, index) => <li key={step} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">{index + 1}</span>{step}</li>)}
      </ol>}
      {error && (
        <p role="alert" className="mb-4 rounded-md bg-red-50 p-4 text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mb-4 rounded-md bg-emerald-50 p-4 text-emerald-800"
        >
          {notice}
        </p>
      )}
      {!own && scheduleCheck === "missing" && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <div>
            <p className="font-semibold">{tr("Chưa thể nhập dữ liệu chấm công", "Attendance import is not ready")}</p>
            <p className="mt-1">{tr("Hệ thống chưa có mã ca đang hoạt động. Hãy tạo ca và gán ca cho nhân viên trước.", "There is no active shift code. Create a schedule and assign it to employees first.")}</p>
          </div>
          <Link to="/work-schedules" className="inline-flex h-10 items-center rounded-md border border-amber-300 bg-white px-4 font-semibold text-amber-900 hover:bg-amber-100">
            {tr("Tạo ca làm việc", "Create schedule")}
          </Link>
        </div>
      )}
      {!own && scheduleCheck === "error" && (
        <p className="mb-4 rounded-md bg-blue-50 p-3 text-sm text-blue-900">
          {tr("Không kiểm tra được danh mục ca. Bạn vẫn có thể nhập tệp; hệ thống sẽ kiểm tra lại khi xem trước.", "The schedule catalogue could not be checked. You can still upload; preview will validate it.")}
        </p>
      )}
      {importOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-label={tr("Nhập dữ liệu chấm công", "Import attendance data")}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !importBusy) setImportOpen(false)
          }}
        >
          <Card className="relative max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto p-5 shadow-2xl sm:p-6">
            <button
              type="button"
              aria-label={tr("Đóng", "Close")}
              disabled={importBusy}
              className="absolute right-5 top-5 z-10 flex size-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              onClick={() => setImportOpen(false)}
            >
              <X size={20} />
            </button>
            <AttendanceImport
              activeShiftTypes={activeShiftTypes}
              onBusyChange={setImportBusy}
              onImported={(result) => {
                setImportOpen(false)
                setOffset(0)
                setRevision((v) => v + 1)
                setNotice(
                  tr(
                    `Nhập chấm công thành công: đã lưu ${result.inserted} bản ghi, bỏ qua ${result.skipped}, loại ${result.excluded}.`,
                    `Attendance imported successfully: saved ${result.inserted}, skipped ${result.skipped}, excluded ${result.excluded}.`,
                  ),
                )
              }}
            />
          </Card>
        </div>
      )}
      {reconcileOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px] animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label={tr("Đối soát ngày nghỉ và ngày lễ", "Reconcile leave and holidays")}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !reconcileBusy) setReconcileOpen(false)
          }}
        >
          <Card className="relative max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto p-5 shadow-2xl animate-in slide-in-from-bottom-2 zoom-in-95 duration-200 sm:p-6">
            <button
              type="button"
              aria-label={tr("Đóng", "Close")}
              disabled={reconcileBusy}
              className="absolute right-5 top-5 z-10 flex size-10 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
              onClick={() => setReconcileOpen(false)}
            >
              <X size={20} />
            </button>
            <AttendanceReconcile
              onBusyChange={setReconcileBusy}
              onSaved={(result) => {
                setReconcileOpen(false)
                setOffset(0)
                setRevision((v) => v + 1)
                setNotice(
                  tr(
                    `Đối soát thành công: đã tạo ${result.inserted} bản ghi, giữ nguyên ${result.kept}.`,
                    `Reconciliation completed: created ${result.inserted}, kept ${result.kept}.`,
                  ),
                )
              }}
            />
          </Card>
        </div>
      )}
      {hasAnyRecords && summary && (
        <section className="mb-4">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-950">
              {tr("Tổng hợp chấm công đang sử dụng", "Active attendance summary")}
            </h2>
            <span
              title={tr(
                "Chỉ tính các bản ghi đang sử dụng trong bộ lọc hiện tại.",
                "Counts active records within the current filters only.",
              )}
              className="inline-flex cursor-help text-slate-500"
            >
              <HelpCircle size={16} />
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [tr("Ngày có bản ghi", "Recorded days"), summary.recorded_days],
              [tr("Phút công thực tế", "Work minutes"), summary.working_minutes],
              [
                tr("Đi muộn / về sớm", "Late / early minutes"),
                `${summary.late_mins} / ${summary.early_mins}`,
              ],
              [
                tr("Phút tăng ca", "Overtime minutes"),
                summary.overtime_minutes,
              ],
            ].map(([label, value]) => (
              <Card key={String(label)} className="p-4">
                <p className="text-sm font-semibold text-slate-600">{label}</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">
                  {value}
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}
      <Card className={hasAnyRecords ? "mb-0 rounded-b-none border-b-0 p-5 shadow-none" : "hidden"}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!invalid) {
              setNotice("")
              setFilters({ ...draft })
              setOffset(0)
              setSelected(null)
            }
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
            <label className="text-sm">
              {tr("Từ ngày công", "From work date")}
              <input
                className={control}
                type="date"
                value={draft.from || ""}
                onChange={(e) => setDraft({ ...draft, from: e.target.value })}
              />
            </label>
            <label className="text-sm">
              {tr("Đến ngày công", "To work date")}
              <input
                className={control}
                type="date"
                value={draft.to || ""}
                onChange={(e) => setDraft({ ...draft, to: e.target.value })}
              />
            </label>
            {!own && (
              <label className="text-sm">
                {tr(
                  "ID nhân viên (để trống: tất cả)",
                  "Employee ID (blank: all)",
                )}
                <input
                  className={control}
                  type="number"
                  min="1"
                  step="1"
                  value={draft.employee_id || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, employee_id: e.target.value })
                  }
                />
              </label>
            )}
            <label className="text-sm">
              {tr("Trạng thái", "Status")}
              <select
                className={control}
                value={draft.record_status}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    record_status: e.target
                      .value as RecordFilters["record_status"],
                  })
                }
              >
                <option value="ACTIVE">{tr("Đang sử dụng", "Active")}</option>
                <option value="CANCEL">{tr("Đã hủy", "Cancelled")}</option>
                <option value="ALL">{tr("Tất cả", "All")}</option>
              </select>
            </label>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-1 xl:col-span-1">
              <Button
                className="flex-1 xl:flex-none"
                type="submit"
                disabled={loading || invalid}
              >
                <Search size={16} />
                {tr("Lọc", "Filter")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={loading}
                onClick={() => {
                  setNotice("")
                  const initial = { record_status: "ACTIVE" } as RecordFilters
                  setDraft(initial)
                  setFilters(initial)
                  setOffset(0)
                  setSelected(null)
                }}
              >
                <RotateCcw size={16} />
                {tr("Đặt lại", "Reset")}
              </Button>
            </div>
          </div>
          {invalid && (
            <p role="alert" className="mt-2 text-red-700">
              {tr(
                "Ngày kết thúc phải từ ngày bắt đầu trở đi.",
                "End date must be on or after start date.",
              )}
            </p>
          )}
        </form>
      </Card>
      {selected && (
        <div
          className="fixed inset-0 z-[80] bg-slate-950/40 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-label={tr("Chi tiết chấm công", "Attendance details")}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setSelected(null)
          }}
        >
          <Card className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-y-auto rounded-none border-0 p-5 shadow-2xl sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">
              {selected.employee_code} · {selected.full_name} ·{" "}
              {selected.work_date}
            </h2>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setSelected(null)}
            >
              {tr("Đóng", "Close")}
            </Button>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {tr("Trạng thái ngày công", "Attendance status")}: {selected.attendance_status || "—"}
            {selected.cancellation_reason ? ` · ${tr("Lý do hủy", "Cancellation reason")}: ${selected.cancellation_reason}` : ""}
          </p>
          {selected.record_status === "CANCEL" && <p className="mt-2 text-sm text-slate-600">{tr("Người hủy", "Cancelled by")}: {String(selected.cancelled_by ?? "—")} · {tr("Thời điểm", "Time")}: {selected.cancelled_at ? new Date(selected.cancelled_at).toLocaleString(language === "vi" ? "vi-VN" : "en-US", { timeZone: "Asia/Ho_Chi_Minh" }) : "—"}</p>}
          {!own && selected.record_status === "ACTIVE" && (
            <form onSubmit={save} className="mt-4">
              <fieldset disabled={busy} className="space-y-3">
                <p className="rounded-md bg-amber-50 p-3 text-sm font-medium text-amber-900">{tr("BE chỉ hỗ trợ hủy bản ghi. Nếu giờ vào/ra sai, hãy hủy rồi nhập lại bản ghi đúng.", "Only cancellation is supported. Cancel and import a corrected replacement if timestamps are wrong.")}</p>
                <label className="block text-sm">
                  {tr("Lý do bắt buộc", "Required reason")}
                  <textarea
                    className={control}
                    required
                    maxLength={1000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <Button
                  variant="danger"
                  type="submit"
                  disabled={!reason.trim() || !selected.record_fingerprint}
                >
                  {tr("Hủy bản ghi", "Cancel record")}
                </Button>
              </fieldset>
            </form>
          )}
          {!own && (
            <details className="mt-4 border-t pt-3">
              <summary className="cursor-pointer font-semibold">
                {tr("Lịch sử thay đổi", "Audit history")}
              </summary>
              {logError && (
                <p role="alert" className="text-red-700">
                  {logError}
                </p>
              )}
              <ul className="mt-2 space-y-2">
                {logs.map((l) => (
                  <li
                    key={String(l.id)}
                    className="rounded-xl bg-slate-50 p-3 text-sm"
                  >
                    <strong>{l.action}</strong> ·{" "}
                    {tr("Người thực hiện", "Actor")}:{" "}
                    {String(l.actor_id ?? "—")} · {l.reason || "—"} · {l.occurred_at || "—"}
                    <details>
                      <summary>
                        {tr("Giá trị trước / sau", "Before / after")}
                      </summary>
                      <pre className="max-w-full overflow-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(
                          { before: l.old_values, after: l.new_values },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <Button
                  variant="secondary"
                  disabled={!logOffset}
                  onClick={() => setLogOffset(Math.max(0, logOffset - 20))}
                >
                  {tr("Trước", "Previous")}
                </Button>
                <Button
                  variant="secondary"
                  disabled={logs.length < 20}
                  onClick={() => setLogOffset(logOffset + 20)}
                >
                  {tr("Trang sau", "Next page")}
                </Button>
              </div>
            </details>
          )}
          </Card>
        </div>
      )}
      <Card className={hasAnyRecords ? "rounded-t-none p-5" : "p-5"}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              {tr("Dữ liệu chấm công", "Attendance records")}
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-600">
              {tr(
                "Danh sách bản ghi theo điều kiện lọc hiện tại.",
                "Records matching the current filters.",
              )}
            </p>
          </div>
          <span className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
            {rows.length} {tr("bản ghi trên trang", "records on this page")}
          </span>
        </div>
        {loading ? (
          <p role="status">{tr("Đang tải…", "Loading…")}</p>
        ) : (
          <>
            <div className={hasAnyRecords ? "overflow-x-auto" : "hidden"}>
              <table className="w-full whitespace-nowrap text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      tr("Ngày công", "Work date"),
                      tr("Nhân viên", "Employee"),
                      tr("Vào / ra", "Check in / out"),
                      tr("Phút công", "Work minutes"),
                      tr("Muộn / sớm", "Late / early"),
                      tr("Tăng ca", "Overtime"),
                      tr("Trạng thái", "Status"),
                      tr("Thao tác", "Actions"),
                    ].map((h) => (
                      <th
                        className="p-3 text-xs font-bold uppercase tracking-wide text-slate-600"
                        key={h}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={String(r.id)}
                      className="border-b border-slate-100"
                    >
                      <td className="p-3">{r.work_date}</td>
                      <td className="p-3">
                        {r.employee_code}
                        <p>{r.full_name}</p>
                      </td>
                      <td className="p-3">
                        <p>{localTime(r.check_in).replace("T", " ") || "—"}</p>
                        <p>{localTime(r.check_out).replace("T", " ") || "—"}</p>
                      </td>
                      <td className="p-3">{r.working_minutes}</td>
                      <td className="p-3">
                        {r.late_mins} / {r.early_mins}
                      </td>
                      <td className="p-3">{r.overtime_minutes}</td>
                      <td className="p-3">
                        <span className={`inline-flex h-6 items-center rounded-md border px-2 text-xs font-semibold ${r.record_status === "CANCEL" ? "border-slate-300 bg-slate-100 text-slate-700" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>
                          {r.record_status === "CANCEL"
                            ? tr("Đã hủy", "Cancelled")
                            : tr("Đang sử dụng", "Active")}
                        </span>
                      </td>
                      <td className="p-3">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => void open(r)}
                        >
                          {tr("Xem chi tiết", "View details")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <span className="flex size-12 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                  <Inbox size={23} />
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-800">
                  {hasAnyRecords
                    ? tr(
                        "Không có bản ghi trong bộ lọc này.",
                        "No records match these filters.",
                      )
                    : tr(
                        "Chưa có dữ liệu chấm công.",
                        "No attendance data yet.",
                      )}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-600">
                  {hasAnyRecords
                    ? tr(
                        "Hãy thay đổi điều kiện lọc để tìm lại.",
                        "Change the filters to search again.",
                      )
                    : tr(
                        "Sử dụng nút Nhập tệp chấm công để bắt đầu thu thập dữ liệu.",
                        "Use Import attendance file to start collecting data.",
                      )}
                </p>
              </div>
            )}
          </>
        )}
        {hasAnyRecords && <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-slate-600">
            {tr("Hiển thị", "Showing")} {pageStart} - {pageEnd}{" "}
            {tr("bản ghi", "records")}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={loading || offset === 0}
              onClick={() => setOffset(Math.max(0, offset - 20))}
            >
              {tr("Trước", "Previous")}
            </Button>
            <span className="flex min-w-10 items-center justify-center rounded-md bg-slate-100 px-3 text-sm font-semibold text-slate-700">
              {offset / 20 + 1}
            </span>
            <Button
              variant="secondary"
              disabled={loading || rows.length < 20}
              onClick={() => setOffset(offset + 20)}
            >
              {tr("Trang sau", "Next page")}
            </Button>
          </div>
        </div>}
      </Card>
    </AppShell>
  )
}
