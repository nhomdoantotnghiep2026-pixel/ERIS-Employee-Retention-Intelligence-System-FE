import { useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  BarChart3,
  CalendarCheck2,
  CalendarRange,
  Check,
  Clock3,
  Download,
  FileSpreadsheet,
  HelpCircle,
  Inbox,
  RotateCcw,
  Search,
  Upload,
  Users,
  X,
} from "lucide-react"
import { AppShell } from "../components/AppShell"
import { Button, Card, SectionHeader } from "../components/ui"
import { downloadAttendanceTemplate } from "../utils/attendanceTemplate"
import AttendanceImport, { type AttendanceImportStage } from "../components/AttendanceImport"
import AttendanceReconcile from "../components/AttendanceReconcile"
import { useLanguage } from "../context/LanguageContext"
import { useAutoDismissFeedback } from "../hooks/useAutoDismissState"
import { listDepartments, listEmployeeProfiles, listWorkSchedules, type EmployeeProfile } from "../services/api"
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
const displayTime = (value: string | null) => value?.slice(11, 16) || "—"
const durationLabel = (value: number) => {
  const minutes = Math.max(0, Number(value) || 0)
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h ${remainder}m` : `${hours.toFixed(1)}h`
}
const isoDate = (date: Date) => date.toISOString().slice(0, 10)
const getWeekRange = (anchor = new Date()) => {
  const date = new Date(anchor)
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  const from = new Date(date)
  const to = new Date(date)
  to.setDate(to.getDate() + 6)
  return { from: isoDate(from), to: isoDate(to) }
}
const defaultPeriod = getWeekRange()
const formatShortDate = (value: string) => {
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}
export default function AttendanceWorkspace({
  own = false,
}: {
  own?: boolean
}) {
  const { language } = useLanguage()
  const navigate = useNavigate()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const [filters, setFilters] = useState<RecordFilters>({
      ...defaultPeriod,
      record_status: "ACTIVE",
    }),
    [draft, setDraft] = useState<RecordFilters>({ ...defaultPeriod, record_status: "ACTIVE" })
  const [rows, setRows] = useState<ImportedAttendance[]>([]),
    [summary, setSummary] = useState<AttendanceSummary | null>(null)
  const [hasAnyRecords, setHasAnyRecords] = useState<boolean | null>(null)
  const [selected, setSelected] = useState<ImportedAttendance | null>(null),
    [logs, setLogs] = useState<AttendanceAudit[]>([]),
    [logOffset, setLogOffset] = useState(0)
  const [offset, setOffset] = useState(0),
    [pageSize, setPageSize] = useState(20),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false)
  const { error, message: notice, setError, setMessage: setNotice } = useAutoDismissFeedback()
  const [logError, setLogError] = useState("")
  const [reason, setReason] = useState("")
  const [importOpen, setImportOpen] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [importStage, setImportStage] = useState<AttendanceImportStage | "complete">("idle")
  const [reconcileOpen, setReconcileOpen] = useState(false)
  const [reconcileBusy, setReconcileBusy] = useState(false)
  const [activeShiftTypes, setActiveShiftTypes] = useState<string[]>([])
  const [scheduleCheck, setScheduleCheck] = useState<"loading" | "ready" | "missing" | "error">("loading")
  const [employees, setEmployees] = useState<EmployeeProfile[]>([])
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([])
  const [departmentId, setDepartmentId] = useState("")
  const [tableSearch, setTableSearch] = useState("")
  const [periodRows, setPeriodRows] = useState<ImportedAttendance[]>([])
  const [previousPeriodRows, setPreviousPeriodRows] = useState<ImportedAttendance[]>([])
  const [monthOvertime, setMonthOvertime] = useState(0)
  useEffect(() => {
    const c = new AbortController()
    setLoading(true)
    setError("")
    setRows([])
    void fetchAttendance({ ...filters, limit: pageSize, offset }, own, c.signal)
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
  }, [filters, offset, pageSize, revision, own])
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
    if (own) return
    const controller = new AbortController()
    const from = filters.from || defaultPeriod.from
    const to = filters.to || defaultPeriod.to
    const start = new Date(`${from}T00:00:00`)
    const end = new Date(`${to}T00:00:00`)
    const span = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
    const previousEnd = new Date(start)
    previousEnd.setDate(previousEnd.getDate() - 1)
    const previousStart = new Date(previousEnd)
    previousStart.setDate(previousStart.getDate() - span + 1)
    const monthStart = `${from.slice(0, 7)}-01`
    const monthEndDate = new Date(Number(from.slice(0, 4)), Number(from.slice(5, 7)), 0)
    const monthEnd = isoDate(monthEndDate)
    void Promise.allSettled([
      listEmployeeProfiles({ page: 1, limit: 1000, employmentStatus: "ACTIVE" }, controller.signal),
      listDepartments(controller.signal, { limit: 1000 }),
      fetchAttendance({ from, to, record_status: "ACTIVE", limit: 1000, offset: 0 }, false, controller.signal),
      fetchAttendance({ from: isoDate(previousStart), to: isoDate(previousEnd), record_status: "ACTIVE", limit: 1000, offset: 0 }, false, controller.signal),
      fetchAttendanceSummary({ from: monthStart, to: monthEnd, record_status: "ACTIVE" }, controller.signal),
    ]).then(results => {
      if (controller.signal.aborted) return
      const [employeeResult, departmentResult, currentResult, previousResult, overtimeResult] = results
      if (employeeResult.status === "fulfilled") setEmployees(employeeResult.value.data)
      if (departmentResult.status === "fulfilled") setDepartments(departmentResult.value.data)
      if (currentResult.status === "fulfilled") setPeriodRows(currentResult.value.data)
      if (previousResult.status === "fulfilled") setPreviousPeriodRows(previousResult.value.data)
      if (overtimeResult.status === "fulfilled") setMonthOvertime(Number(overtimeResult.value.data.overtime_minutes) || 0)
    })
    return () => controller.abort()
  }, [own, filters.from, filters.to, revision])
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
  const employeeDepartment = new Map(employees.map(employee => [employee.employeeCode, employee.departmentId]))
  const normalizedSearch = tableSearch.trim().toLocaleLowerCase(language === "vi" ? "vi-VN" : "en-US")
  const useClientDirectory = !own && Boolean(departmentId || normalizedSearch)
  const tablePool = useClientDirectory ? periodRows : rows
  const departmentRows = departmentId ? tablePool.filter(row => String(employeeDepartment.get(row.employee_code) || "") === departmentId) : tablePool
  const searchedRows = normalizedSearch
    ? departmentRows.filter(row => `${row.employee_code} ${row.full_name}`.toLocaleLowerCase(language === "vi" ? "vi-VN" : "en-US").includes(normalizedSearch))
    : departmentRows
  const visibleRows = useClientDirectory ? searchedRows.slice(offset, offset + pageSize) : searchedRows
  const filteredRowCount = useClientDirectory ? searchedRows.length : null
  const hasNextPage = useClientDirectory ? offset + pageSize < searchedRows.length : rows.length >= pageSize
  const filteredPeriodRows = departmentId ? periodRows.filter(row => String(employeeDepartment.get(row.employee_code) || "") === departmentId) : periodRows
  const filteredPreviousRows = departmentId ? previousPeriodRows.filter(row => String(employeeDepartment.get(row.employee_code) || "") === departmentId) : previousPeriodRows
  const scopedEmployeeTotal = departmentId ? employees.filter(employee => String(employee.departmentId) === departmentId).length : employees.length
  const recordedEmployees = new Set(filteredPeriodRows.map(row => row.employee_code)).size
  const previousOnTimeRate = filteredPreviousRows.length
    ? filteredPreviousRows.filter(row => !row.late_mins && !row.early_mins).length / filteredPreviousRows.length * 100
    : null
  const pageStart = visibleRows.length ? offset + 1 : 0
  const pageEnd = offset + visibleRows.length
  const attendanceState = (row: ImportedAttendance) => {
    if (row.record_status === "CANCEL") return { label: tr("Đã hủy", "Cancelled"), tone: "border-slate-300 bg-slate-100 text-slate-700" }
    if (row.attendance_status === "ABSENT") return { label: tr("Vắng mặt", "Absent"), tone: "border-rose-200 bg-rose-50 text-rose-700" }
    if (row.late_mins || row.early_mins) return { label: tr("Chờ giải trình / bù công", "Awaiting explanation / adjustment"), tone: "border-amber-200 bg-amber-50 text-amber-800" }
    return { label: tr("Đã chốt công", "Attendance finalized"), tone: "border-emerald-200 bg-emerald-50 text-emerald-700" }
  }
  const periodLabel = filters.from && filters.to ? `${formatShortDate(filters.from)} – ${formatShortDate(filters.to)}` : "—"
  const startImport = () => { setImportStage("idle"); setImportOpen(true) }
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
                {tr("Bù công nghỉ/lễ", "Leave and holiday adjustment")}
              </Button>
            </span>
            <Button type="button" variant="secondary" onClick={downloadAttendanceTemplate} className="hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900">
              <Download size={16} aria-hidden="true" />
              {tr("Tải tệp mẫu", "Download template")}
            </Button>
            <span
              className="inline-flex"
              title={scheduleCheck === "missing" ? tr("Cần tạo ít nhất một ca đang hoạt động trước khi nhập.", "Create at least one active schedule before importing.") : undefined}
            >
            <Button
              type="button"

              disabled={scheduleCheck === "loading" || scheduleCheck === "missing"}
              onClick={startImport}
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
      {!own && <>
        <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tr("Kỳ làm việc", "Work period")}<select value={`${filters.from}|${filters.to}`} onChange={event => { const [from, to] = event.target.value.split("|"); setFilters(current => ({ ...current, from, to })); setDraft(current => ({ ...current, from, to })); setOffset(0) }} className="mt-1 block h-10 min-w-72 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-800"><option value={`${defaultPeriod.from}|${defaultPeriod.to}`}>{tr(`Tuần hiện tại (${formatShortDate(defaultPeriod.from)} – ${formatShortDate(defaultPeriod.to)})`, `Current week (${formatShortDate(defaultPeriod.from)} – ${formatShortDate(defaultPeriod.to)})`)}</option>{(() => { const previous = new Date(`${defaultPeriod.from}T00:00:00`); previous.setDate(previous.getDate() - 7); const range = getWeekRange(previous); return <option value={`${range.from}|${range.to}`}>{tr(`Tuần trước (${formatShortDate(range.from)} – ${formatShortDate(range.to)})`, `Previous week (${formatShortDate(range.from)} – ${formatShortDate(range.to)})`)}</option> })()}</select></label>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tr("Phòng ban", "Department")}<select value={departmentId} onChange={event => { setDepartmentId(event.target.value); setOffset(0) }} className="mt-1 block h-10 min-w-52 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-slate-800"><option value="">{tr("Tất cả phòng ban", "All departments")}</option>{departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: tr("Tổng nhân sự kỳ này", "Employees this period"), value: scopedEmployeeTotal || "—", note: tr("Nhân sự đang hoạt động", "Active employees"), icon: Users, tone: "bg-blue-50 text-blue-700" },
              { label: tr("Tiến độ nạp công", "Attendance coverage"), value: `${recordedEmployees} / ${scopedEmployeeTotal || "—"}`, note: recordedEmployees ? tr("Đã có dữ liệu trong kỳ", "Records available") : tr("Chờ nạp tệp tuần này", "Awaiting this week's file"), icon: CalendarCheck2, tone: recordedEmployees ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700" },
              { label: tr("Tỷ lệ đúng giờ kỳ trước", "Previous on-time rate"), value: previousOnTimeRate === null ? "—" : `${previousOnTimeRate.toFixed(1)}%`, note: tr("Theo bản ghi hợp lệ", "From valid records"), icon: Clock3, tone: "bg-teal-50 text-teal-700" },
              { label: tr("Tổng giờ OT tháng", "Monthly overtime"), value: `${(monthOvertime / 60).toFixed(1)} giờ`, note: tr("Tháng hiện tại", "Current month"), icon: BarChart3, tone: "bg-purple-50 text-purple-700" },
            ].map(item => <article key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{item.value}</p><p className="mt-1 text-xs text-slate-500">{item.note}</p></div><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${item.tone}`}><item.icon size={19} /></span></div></article>)}
          </div>
        </section>
        <ol aria-label={tr("Quy trình nhập dữ liệu chấm công", "Attendance import workflow")} className="mb-4 grid overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:grid-cols-4">
          {[
            { title: importStage === "idle" ? tr("Chọn tệp nguồn", "Select source file") : tr("Đã chọn tệp", "File selected"), note: importStage === "idle" ? tr("Chuẩn bị tệp Excel", "Prepare Excel file") : tr("Tệp đã sẵn sàng", "File ready") },
            { title: tr("Xem trước và kiểm tra", "Preview and validate"), note: importStage === "preview" ? tr("Đang đối soát dữ liệu", "Reviewing records") : tr("Kiểm tra mã và ca", "Validate codes and shifts") },
            { title: tr("Xác nhận lưu", "Confirm and save"), note: importStage === "saving" ? tr("Đang lưu dữ liệu…", "Saving data…") : tr("Chỉ lưu dòng hợp lệ", "Save valid rows only") },
            { title: importStage === "complete" ? tr("Hoàn tất", "Completed") : tr("Theo dõi dữ liệu", "Review records"), note: importStage === "complete" ? tr("Dữ liệu đã cập nhật", "Data updated") : tr("Kiểm tra sau nhập", "Review after import") },
          ].map((step, index) => {
            const active = (index === 0 && ["idle", "selected"].includes(importStage)) || (index === 1 && importStage === "preview") || (index === 2 && importStage === "saving") || (index === 3 && importStage === "complete")
            const done = (index === 0 && ["preview", "saving", "complete"].includes(importStage)) || (index === 1 && ["saving", "complete"].includes(importStage)) || (index === 2 && importStage === "complete")
            return <li key={step.title} className={`flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${active ? "bg-orange-50" : "bg-white"}`}><span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-emerald-100 text-emerald-700" : active ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-500"}`}>{done ? <Check size={15} /> : index + 1}</span><span><strong className={`block text-sm ${active ? "text-orange-800" : "text-slate-800"}`}>{step.title}</strong><small className="mt-0.5 block text-xs font-medium text-slate-500">{step.note}</small></span></li>
          })}
        </ol>
      </>}
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
            if (event.target === event.currentTarget && !importBusy) { setImportOpen(false); setImportStage("idle") }
          }}
        >
          <Card className={`relative max-h-[calc(100vh-2rem)] w-full shadow-2xl ${["preview", "saving"].includes(importStage) ? "max-w-[96vw] overflow-hidden p-0" : "max-w-4xl overflow-y-auto p-5 sm:p-6"}`}>
            {!["preview", "saving"].includes(importStage) && <button
              type="button"
              aria-label={tr("Đóng", "Close")}
              disabled={importBusy}
              className="absolute right-5 top-5 z-10 flex size-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              onClick={() => { setImportOpen(false); setImportStage("idle") }}
            >
              <X size={20} />
            </button>}
            <AttendanceImport
              activeShiftTypes={activeShiftTypes}
              onBusyChange={setImportBusy}
              onStageChange={setImportStage}
              onCancel={() => { setImportOpen(false); setImportStage("idle") }}
              onImported={(result) => {
                setImportOpen(false)
                setImportStage("complete")
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
          aria-label={tr("Bù công ngày lễ và khớp đơn nghỉ phép", "Holiday adjustment and leave matching")}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !reconcileBusy) setReconcileOpen(false)
          }}
        >
          <Card className="relative max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-y-auto p-5 shadow-2xl animate-in slide-in-from-bottom-2 zoom-in-95 duration-200 sm:p-6">
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
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-64"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input value={tableSearch} onChange={event => { setTableSearch(event.target.value); setOffset(0) }} placeholder={tr("Tìm tên hoặc mã nhân viên", "Search name or employee code")} className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100" /></label>
            <span className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
              {filteredRowCount === null ? visibleRows.length : `${visibleRows.length}/${filteredRowCount}`} {tr("bản ghi trên trang", "records on this page")}
            </span>
          </div>
        </div>
        {loading ? (
          <p role="status">{tr("Đang tải…", "Loading…")}</p>
        ) : (
          <>
            <div className={hasAnyRecords ? "overflow-x-auto" : "hidden"}>
              <table className="w-full whitespace-nowrap text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_0_#e2e8f0]">
                  <tr>
                    {[
                      tr("Ngày công", "Work date"),
                      tr("Nhân viên", "Employee"),
                      tr("Vào / ra", "Check in / out"),
                      tr("Thời lượng công", "Work duration"),
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
                  {visibleRows.map((r) => {
                    const state = attendanceState(r)
                    return <tr key={String(r.id)} className="border-b border-slate-100 hover:bg-slate-50/60">
                      <td className="p-3">{r.work_date}</td>
                      <td className="p-3">
                        <strong className="block font-mono text-xs text-slate-700">{r.employee_code}</strong>
                        <p className="mt-0.5 font-semibold text-slate-950">{r.full_name}</p>
                      </td>
                      <td className="p-3 font-mono text-sm font-semibold text-slate-700">{displayTime(r.check_in)} <span className="text-slate-400">→</span> {displayTime(r.check_out)}</td>
                      <td className="p-3 font-semibold tabular-nums text-slate-800">{durationLabel(r.working_minutes)}</td>
                      <td className="p-3"><div className="flex flex-col items-start gap-1">{r.late_mins ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">{tr("Trễ", "Late")}: {r.late_mins}p</span> : null}{r.early_mins ? <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-800">{tr("Sớm", "Early")}: {r.early_mins}p</span> : null}{!r.late_mins && !r.early_mins && <span className="text-slate-400">—</span>}</div></td>
                      <td className="p-3 font-semibold tabular-nums text-violet-700">{r.overtime_minutes ? durationLabel(r.overtime_minutes) : "—"}</td>
                      <td className="p-3">
                        <span className={`inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${state.tone}`}>
                          {state.label}
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
                  })}
                </tbody>
              </table>
            </div>
            {!visibleRows.length && (
              hasAnyRecords ? <div className="flex flex-col items-center justify-center py-12 text-center"><span className="flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Inbox size={23} /></span><p className="mt-3 text-sm font-semibold text-slate-800">{tr("Không có bản ghi trong bộ lọc này.", "No records match these filters.")}</p><p className="mt-1 text-sm text-slate-600">{tr("Hãy thay đổi kỳ làm việc hoặc phòng ban để tìm lại.", "Change the period or department filter.")}</p></div>
              : !own ? <div className="overflow-hidden rounded-2xl border border-dashed border-orange-200 bg-gradient-to-br from-orange-50/70 via-white to-amber-50/50 px-6 py-8 text-center">
                <div className="mx-auto flex w-fit items-end gap-2 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm"><span className="flex size-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600"><FileSpreadsheet size={25} /></span><div className="grid grid-cols-5 gap-1">{Array.from({ length: 15 }).map((_, index) => <span key={index} className={`size-2 rounded-full ${index % 4 === 0 ? "bg-orange-400" : index % 3 === 0 ? "bg-emerald-400" : "bg-slate-200"}`} />)}</div></div>
                <h3 className="mt-5 text-lg font-semibold text-slate-950">{tr(`Chưa có bản ghi chấm công cho kỳ ${periodLabel}`, `No attendance records for ${periodLabel}`)}</h3>
                <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">{tr("Kéo thả tệp Excel chấm công từ máy chấm công hoặc hệ thống nguồn để đối soát mã nhân viên, ca làm việc, đi trễ, về sớm và tăng ca.", "Import the Excel attendance file to validate employees, shifts, late arrivals, early leaves and overtime.")}</p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3"><Button type="button" disabled={scheduleCheck === "loading" || scheduleCheck === "missing"} onClick={startImport}><Upload size={16} />{tr("Nhập tệp chấm công ngay", "Import attendance now")}</Button><Button type="button" variant="secondary" onClick={downloadAttendanceTemplate}><Download size={16} />{tr("Tải file mẫu Excel chuẩn", "Download Excel template")}</Button></div>
                <div className="mx-auto mt-7 grid max-w-4xl gap-3 text-left sm:grid-cols-3">{[
                  tr("Dùng tệp mẫu có cột Mã NV, Ngày, Ca, Giờ vào và Giờ ra.", "Use the template columns: employee, date, shift, check-in and check-out."),
                  tr("Hệ thống kiểm tra mã nhân sự và phân loại trễ, sớm, OT.", "ERIS validates employee codes and classifies attendance events."),
                  tr("HR xem lại kết quả và chỉ xác nhận lưu các dòng hợp lệ.", "HR reviews and confirms only valid rows."),
                ].map((text, index) => <div key={text} className="rounded-xl border border-slate-200 bg-white/90 p-3 text-sm text-slate-600 shadow-sm"><span className="mb-2 flex size-6 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">{index + 1}</span>{text}</div>)}</div>
              </div>
              : <div className="flex flex-col items-center justify-center py-12 text-center"><Inbox className="text-slate-400" /><p className="mt-3 text-sm font-semibold text-slate-800">{tr("Chưa có dữ liệu chấm công.", "No attendance data yet.")}</p></div>
            )}
          </>
        )}
        {hasAnyRecords && <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-600"><p>{tr("Hiển thị", "Showing")} {pageStart} - {pageEnd} {tr("bản ghi", "records")}</p><label className="flex items-center gap-2">{tr("Số dòng", "Rows")}<select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setOffset(0) }} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-700">{[20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}</select></label></div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={loading || offset === 0}
              onClick={() => setOffset(Math.max(0, offset - pageSize))}
            >
              {tr("Trước", "Previous")}
            </Button>
            <span className="flex min-w-10 items-center justify-center rounded-md bg-slate-100 px-3 text-sm font-semibold text-slate-700">
              {offset / pageSize + 1}
            </span>
            <Button
              variant="secondary"
              disabled={loading || !hasNextPage}
              onClick={() => setOffset(offset + pageSize)}
            >
              {tr("Trang sau", "Next page")}
            </Button>
          </div>
        </div>}
      </Card>
    </AppShell>
  )
}
