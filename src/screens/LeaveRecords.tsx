import { SelectControl } from "../components/ui/select-control"
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  CalendarCheck2,
  CalendarDays,
  Clock3,
  Inbox,
  RotateCcw,
  Search,
  Upload,
  Users,
} from "lucide-react"
import { AppShell } from "../components/AppShell"
import LeaveImportDialog from "../components/leave/LeaveImportDialog"
import LeaveRecordDrawer from "../components/leave/LeaveRecordDrawer"
import { Button, Card, SectionHeader } from "../components/ui"
import { useRole } from "../context/RoleContext"
import { useLanguage } from "../context/LanguageContext"
import { useAutoDismissFeedback } from "../hooks/useAutoDismissState"
import { listDepartments, listEmployeeProfiles, type EmployeeProfile } from "../services/api"
import {
  attendanceMessage,
  cancelLeaveRecord,
  confirmLeaveFile,
  fetchLeaveRecords,
  fetchLeaveTypes,
  previewLeaveFile,
  type LeaveImportResult,
  type LeavePreview,
  type LeaveRecord,
  type LeaveType,
  type RecordFilters,
} from "../services/attendance"

import { displayLeaveReason, leaveCalendarDays, leaveTypeDisplay } from "../utils/leaveRecordDisplay"

const PAGE_SIZE = 25
const control =
  "mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition-colors duration-200 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"

async function loadLeaveRows(filters: RecordFilters, own: boolean, signal: AbortSignal) {
  // The API returns offsets without a total. Gather the selected date range for filtering and exact page counts.
  const records: LeaveRecord[] = []
  let limit = PAGE_SIZE
  for (;;) {
    const page = await fetchLeaveRecords({ ...filters, limit, offset: records.length }, own, signal)
    records.push(...page.data)
    if (page.data.length < (page.limit || limit)) return records
    limit = 200
  }
}

export default function LeaveRecords({ own = false }: { own?: boolean }) {
  const { language } = useLanguage()
  const { user } = useRole()
  const navigate = useNavigate()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const initialFilters: RecordFilters = { record_status: "ACTIVE" }

  const [types, setTypes] = useState<LeaveType[]>([])
  const [rows, setRows] = useState<LeaveRecord[]>([])
  const [employees, setEmployees] = useState<EmployeeProfile[] | null>(null)
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([])
  const [filters, setFilters] = useState<RecordFilters>(initialFilters)
  const [draft, setDraft] = useState<RecordFilters>(initialFilters)
  const [employeeSearch, setEmployeeSearch] = useState("")
  const [leaveTypeId, setLeaveTypeId] = useState("")
  const [unpaidOnly, setUnpaidOnly] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<LeavePreview | null>(null)
  const [result, setResult] = useState<LeaveImportResult | null>(null)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [detailRecord, setDetailRecord] = useState<LeaveRecord | null>(null)
  const [cancellationReason, setCancellationReason] = useState("")
  const [sort, setSort] = useState<{
    key: "employee" | "dates"
    direction: "asc" | "desc"
  }>({ key: "dates", direction: "desc" })
  const [offset, setOffset] = useState(0)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [hasAnyRecords, setHasAnyRecords] = useState<boolean | null>(null)
  const {
    error,
    message: notice,
    setError,
    setMessage: setNotice,
  } = useAutoDismissFeedback()

  useEffect(() => {
    let live = true
    void fetchLeaveTypes()
      .then((response) => {
        if (live) setTypes(response.data)
      })
      .catch((reason) => {
        if (live) {
          setError(
            attendanceMessage(
              reason,
              tr("Không tải được loại nghỉ.", "Could not load leave types."),
            ),
          )
        }
      })
    return () => {
      live = false
    }
  }, [own])

  useEffect(() => {
    if (own) return
    const controller = new AbortController()
    void Promise.allSettled([
      listEmployeeProfiles({ limit: Number.MAX_SAFE_INTEGER }, controller.signal),
      listDepartments(controller.signal, { limit: Number.MAX_SAFE_INTEGER }),
    ]).then(([staff, teams]) => {
      if (controller.signal.aborted) return
      if (staff.status === "fulfilled") setEmployees(staff.value.data)
      if (teams.status === "fulfilled") setDepartments(teams.value.data)
    })
    return () => controller.abort()
  }, [own, revision])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setRows([])
    setError("")
    void loadLeaveRows(filters, own, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setRows(data) })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(attendanceMessage(reason, tr("Không tải được hồ sơ nghỉ.", "Could not load leave records.")))
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [filters, revision, own])

  useEffect(() => {
    const controller = new AbortController()
    void fetchLeaveRecords({ record_status: "ALL", limit: 1, offset: 0 }, own, controller.signal)
      .then(({ data }) => { if (!controller.signal.aborted) setHasAnyRecords(data.length > 0) })
      .catch(() => undefined)
    return () => controller.abort()
  }, [revision, own])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draft.from && draft.to && draft.from > draft.to) return
      setFilters(current => current.from === draft.from && current.to === draft.to && current.record_status === draft.record_status ? current : draft)
      setOffset(0)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [draft])

  useEffect(() => {
    if (!importModalOpen) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busy) return
      closeImportDialog()
    }
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [importModalOpen, file, preview, busy])

  async function work(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      await action()
    } catch (reason) {
      setError(
        attendanceMessage(
          reason,
          tr("Không thực hiện được thao tác.", "Could not complete action."),
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  function closeDetailDrawer() {
    if (busy) return
    if (
      cancellationReason.trim() &&
      !window.confirm(
        tr(
          "Bỏ nội dung lý do hủy đang nhập?",
          "Discard the cancellation reason you entered?",
        ),
      )
    ) {
      return
    }
    setDetailRecord(null)
    setCancellationReason("")
  }

  function closeImportDialog() {
    if (busy) return
    if (
      (file || preview) &&
      !window.confirm(
        tr(
          "Đóng và bỏ dữ liệu nhập đang xem?",
          "Close and discard the current import preview?",
        ),
      )
    ) {
      return
    }
    setImportModalOpen(false)
    setFile(null)
    setPreview(null)
    setResult(null)
    setError("")
  }

  function cancelRecord(record: LeaveRecord) {
    if (!cancellationReason.trim()) {
      setError(
        tr(
          "Vui lòng nhập lý do hủy hồ sơ nghỉ.",
          "Enter a cancellation reason.",
        ),
      )
      return
    }
    void work(async () => {
      await cancelLeaveRecord(record.id, cancellationReason)
      setDetailRecord(null)
      setCancellationReason("")
      setRevision((value) => value + 1)
      setNotice(tr("Đã hủy hồ sơ nghỉ.", "Leave record cancelled."))
    })
  }

  function upload(event: FormEvent) {
    event.preventDefault()
    if (!file) return
    if (
      !/\.(xlsx|csv)$/i.test(file.name) ||
      !file.size ||
      file.size > 10 * 1024 * 1024
    ) {
      setError(
        tr(
          "Tệp XLSX hoặc CSV, tối đa 10 MiB.",
          "Choose XLSX or CSV, maximum 10 MiB.",
        ),
      )
      return
    }
    void work(async () => {
      setPreview(await previewLeaveFile(file))
      setResult(null)
    })
  }

  function chooseImportFile(nextFile: File | null) {
    setFile(nextFile)
    setPreview(null)
    setResult(null)
    setError("")
  }

  function confirmImport() {
    if (!file || !preview) return
    if (
      !window.confirm(
        tr(
          "Lưu các dòng nghỉ hợp lệ sau khi kiểm tra lại?",
          "Revalidate and save valid leave rows?",
        ),
      )
    ) {
      return
    }
    void work(async () => {
      const imported = await confirmLeaveFile(file, preview.fingerprint)
      setRevision((value) => value + 1)
      if (imported.conflicted || imported.failed) {
        setResult(imported)
        return
      }
      setFile(null)
      setPreview(null)
      setResult(null)
      setImportModalOpen(false)
      setNotice(
        tr(
          `Nhập hồ sơ nghỉ thành công: đã lưu ${imported.inserted} hồ sơ, bỏ qua ${imported.skipped}.`,
          `Leave records imported successfully: saved ${imported.inserted}, skipped ${imported.skipped}.`,
        ),
      )
    })
  }

  function finishPartialImport(imported: LeaveImportResult) {
    setFile(null)
    setPreview(null)
    setResult(null)
    setImportModalOpen(false)
    setNotice(
      tr(
        `Đã lưu ${imported.inserted} hồ sơ; ${imported.conflicted + imported.failed} dòng chưa được lưu.`,
        `Saved ${imported.inserted} records; ${imported.conflicted + imported.failed} rows were not saved.`,
      ),
    )
  }

  const invalid = Boolean(draft.from && draft.to && draft.from > draft.to)
  const employeeById = useMemo(() => new Map(employees?.map(employee => [employee.id, employee])), [employees])
  const departmentsById = useMemo(() => new Map(departments.map(team => [team.id, team.name])), [departments])
  const typeById = useMemo(() => new Map(types.map(type => [type.id, type])), [types])
  const metaFor = (record: LeaveRecord) => {
    const type = typeById.get(record.leave_type_id)
    return leaveTypeDisplay(record.leave_type || type?.code, record.leave_type_name || type?.name, tr)
  }
  const employeeForRecord = (record: LeaveRecord) => employeeById.get(record.employee_id)
  const employeeName = (record: LeaveRecord) => employeeForRecord(record)?.fullName || (own ? user.name : "")
  const departmentName = (record: LeaveRecord) => departmentsById.get(employeeForRecord(record)?.departmentId ?? -1)
  const reasonFor = (record: LeaveRecord) => displayLeaveReason(record.reason, metaFor(record).kind === "ANNUAL", tr)
  const searchable = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/đ/g, "d")
  const query = searchable(employeeSearch.trim())
  const filteredRows = rows.filter(record => {
    if (leaveTypeId && String(record.leave_type_id) !== leaveTypeId) return false
    if (unpaidOnly && metaFor(record).kind !== "UNPAID") return false
    if (!query) return true
    return searchable(`${employeeName(record)} ${record.employee_code || employeeForRecord(record)?.employeeCode || ""} ${reasonFor(record)}`).includes(query)
  })
  const activeRows = filteredRows.filter(record => record.record_status === "ACTIVE")
  const peopleOnLeave = new Set(activeRows.map(record => record.employee_id))
  const employeeCount = employees?.filter(employee => employee.employmentStatus === "ACTIVE").length
  const activePeopleOnLeave = [...peopleOnLeave].filter(id => employeeById.get(id)?.employmentStatus === "ACTIVE").length
  const activeDayCount = activeRows.reduce((days, record) => days + leaveCalendarDays(record, filters.from, filters.to), 0)
  const average = (value: number) => value.toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const recordDayCount = leaveCalendarDays
  const [year, month] = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()).split("-").map(Number)
  const setPeriod = (period: "month" | "quarter" | "year") => {
    const startMonth = period === "year" ? 0 : period === "quarter" ? Math.floor((month - 1) / 3) * 3 : month - 1
    const months = period === "year" ? 12 : period === "quarter" ? 3 : 1
    const from = new Date(Date.UTC(year, startMonth, 1)).toISOString().slice(0, 10)
    const to = new Date(Date.UTC(year, startMonth + months, 0)).toISOString().slice(0, 10)
    setDraft(previous => ({ ...previous, from, to }))
  }
  const formatDate = (value: string) => {
    const date = new Date(`${value}T00:00:00Z`)
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "UTC",
        }).format(date)
  }
  const formatDateTime = (value?: string | null) => {
    if (!value) return "—"
    const date = new Date(value)
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Ho_Chi_Minh",
        }).format(date)
  }
  const employeeInitials = (record: LeaveRecord) => {
    const name = employeeName(record)
    if (!name) return (record.employee_code || "NV").slice(0, 2).toUpperCase()
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(-2)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
  }
  const sortedRows = [...filteredRows].sort((left, right) => {
    const leftValue =
      sort.key === "employee"
        ? `${employeeName(left)} ${left.employee_code || left.employee_id}`
        : `${left.start_date}-${left.end_date}`
    const rightValue =
      sort.key === "employee"
        ? `${employeeName(right)} ${right.employee_code || right.employee_id}`
        : `${right.start_date}-${right.end_date}`
    return (
      leftValue.localeCompare(rightValue, language === "vi" ? "vi" : "en", {
        numeric: true,
      }) * (sort.direction === "asc" ? 1 : -1)
    )
  })
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
  const currentPage = Math.min(Math.floor(offset / PAGE_SIZE) + 1, pageCount)
  const pageOffset = (currentPage - 1) * PAGE_SIZE
  const visibleRows = sortedRows.slice(pageOffset, pageOffset + PAGE_SIZE)
  const pageStart = visibleRows.length ? pageOffset + 1 : 0
  const pageEnd = pageOffset + visibleRows.length
  const detailMeta = detailRecord ? metaFor(detailRecord) : { label: "", tone: "" }
  const annualTypeIds = types.filter(type => leaveTypeDisplay(type.code, type.name, tr).kind === "ANNUAL").map(type => type.id).join(",")

  const toggleSort = (key: "employee" | "dates") => {
    setOffset(0)
    setSort((current) =>
      current.key === key
        ? {
            key,
            direction: current.direction === "asc" ? "desc" : "asc",
          }
        : { key, direction: "asc" },
    )
  }
  const sortIcon = (key: "employee" | "dates") => {
    if (sort.key !== key) return <ArrowUpDown size={14} />
    return sort.direction === "asc" ? (
      <ArrowUp size={14} />
    ) : (
      <ArrowDown size={14} />
    )
  }
  const resetFilters = () => {
    setNotice("")
    setDraft(initialFilters)
    setFilters(initialFilters)
    setEmployeeSearch("")
    setLeaveTypeId("")
    setUnpaidOnly(false)
    setOffset(0)
  }

  const kpis = [
    {
      label: tr("Hồ sơ hợp lệ", "Valid records"),
      value: activeRows.length,
      detail: tr("Hồ sơ đang có hiệu lực", "Effective records"),
      icon: CalendarCheck2,
      tone: "border-emerald-200/60 from-emerald-50/70",
      badge: "bg-emerald-100 text-emerald-800",
    },
    {
      label: tr("Nhân viên nghỉ", "Employees on leave"),
      value: `${peopleOnLeave.size} ${tr("nhân sự", "employees")}`,
      detail: employeeCount
        ? tr(`${average(activePeopleOnLeave / employeeCount * 100)}% trong ${employeeCount} nhân sự đang làm việc`, `${average(activePeopleOnLeave / employeeCount * 100)}% of ${employeeCount} active employees`)
        : tr("Trong phạm vi đang lọc", "Within current filters"),
      icon: Users,
      tone: "border-blue-200/60 from-blue-50/70",
      badge: "bg-blue-100 text-blue-800",
    },
    {
      label: tr("Tổng ngày nghỉ", "Total leave days"),
      value: `${activeDayCount} ${tr("ngày lịch", "calendar days")}`,
      detail: tr(`Trung bình ${average(peopleOnLeave.size ? activeDayCount / peopleOnLeave.size : 0)} ngày lịch/người có nghỉ`, `Average ${average(peopleOnLeave.size ? activeDayCount / peopleOnLeave.size : 0)} calendar days per employee on leave`),
      icon: Clock3,
      tone: "border-amber-200/60 from-amber-50/70",
      badge: "bg-amber-100 text-amber-800",
    },
  ]

  return (
    <AppShell
      breadcrumb={[
        tr("Nhân sự", "Workforce"),
        tr(
          own ? "Ngày nghỉ của tôi" : "Dữ liệu ngày nghỉ nhân viên",
          own ? "My Leave Records" : "Employee leave records",
        ),
      ]}
    >
      <SectionHeader
        title={tr(
          own ? "Ngày nghỉ của tôi" : "Dữ liệu ngày nghỉ nhân viên",
          own ? "My Leave Data" : "Employee leave data",
        )}
        description={tr(
          own
            ? "Xem dữ liệu ngày nghỉ do HR đã thu thập từ tệp nguồn."
            : "Theo dõi, lọc và kiểm tra dữ liệu ngày nghỉ đã được ghi nhận.",
          own
            ? "View leave data collected by HR from source files."
            : "Review, filter and audit imported employee leave records.",
        )}
      >
        {!own && (
          <>
            <Button
              variant="secondary"
              onClick={() => navigate("/employee-requests/dashboard")}
            >
              <BarChart3 size={16} />
              {tr("Xem tổng quan", "View dashboard")}
            </Button>
            <Button
              disabled={!types.length}
              onClick={() => {
                setError("")
                setImportModalOpen(true)
              }}
            >
              <Upload size={16} />
              {tr("Nhập tệp ngày nghỉ", "Import leave file")}
            </Button>
          </>
        )}
      </SectionHeader>

      {error && !importModalOpen && !detailRecord && (
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
      {!own && !types.length && !loading && (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <span className="font-semibold">
            {tr(
              "Chưa thể nhập dữ liệu ngày nghỉ.",
              "Leave records are not ready.",
            )}
          </span>{" "}
          {tr(
            "Hệ thống chưa có danh mục loại nghỉ. Hãy cấu hình loại nghỉ trước khi tiếp tục.",
            "No leave type catalogue is available. Configure leave types before continuing.",
          )}
        </p>
      )}

      <LeaveRecordDrawer
        record={detailRecord}
        employeeName={detailRecord ? employeeName(detailRecord) : ""}
        employeeCode={detailRecord ? detailRecord.employee_code || employeeForRecord(detailRecord)?.employeeCode : undefined}
        reason={detailRecord ? reasonFor(detailRecord) : ""}
        department={detailRecord ? departmentName(detailRecord) : undefined}
        annualTypeIds={annualTypeIds}
        own={own}
        error={error}
        formatDate={formatDate}
        leaveTypeLabel={detailMeta.label}
        leaveTypeTone={detailMeta.tone}
        dayCount={detailRecord ? recordDayCount(detailRecord) : 0}
        busy={busy}
        cancellationReason={cancellationReason}
        onReasonChange={setCancellationReason}
        onClose={closeDetailDrawer}
        onCancel={() => {
          if (detailRecord) cancelRecord(detailRecord)
        }}
        formatDateTime={formatDateTime}
      />
      <LeaveImportDialog
        open={!own && importModalOpen}
        busy={busy}
        file={file}
        preview={preview}
        result={result}
        types={types}
        error={error}
        onClose={closeImportDialog}
        onDismissError={() => setError("")}
        onFileChange={chooseImportFile}
        onPreview={upload}
        onConfirm={confirmImport}
        onFinishPartial={finishPartialImport}
      />

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {kpis.map(({ label, value, detail, icon: Icon, tone, badge }) => (
          <Card key={label} className={`bg-gradient-to-br ${tone} to-white p-4 shadow-sm sm:p-5`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-600">{label}</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">
                  {loading ? "—" : value}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-600">{detail}</p>
              </div>
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-md ${badge}`}
              >
                <Icon size={20} />
              </span>
            </div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200 p-5">
          <form
            onSubmit={(event) => event.preventDefault()}
            className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-[minmax(200px,1.5fr)_repeat(4,minmax(130px,1fr))_auto] 2xl:items-end"
          >
            {!own && (
              <label className="min-w-0 text-sm font-medium text-slate-700">
                {tr("Tìm nhân viên", "Find employee")}
                <span className="relative mt-1 block">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    type="search"
                    className="h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition-colors duration-200 placeholder:text-slate-500 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                    placeholder={tr(
                      "Tìm theo tên, mã NV hoặc lý do...",
                      "Search by name, employee code or reason...",
                    )}
                    value={employeeSearch}
                    onChange={(event) => {
                      setEmployeeSearch(event.target.value)
                      setOffset(0)
                    }}
                  />
                </span>
              </label>
            )}
            <label className="min-w-0 text-sm font-medium text-slate-700">
              {tr("Từ ngày nghỉ", "From date")}
              <input
                type="date"
                className={control}
                value={draft.from || ""}
                onChange={(event) =>
                  setDraft({ ...draft, from: event.target.value })
                }
              />
            </label>
            <label className="min-w-0 text-sm font-medium text-slate-700">
              {tr("Đến ngày nghỉ", "To date")}
              <input
                type="date"
                className={control}
                value={draft.to || ""}
                onChange={(event) =>
                  setDraft({ ...draft, to: event.target.value })
                }
              />
            </label>
            <label className="min-w-0 text-sm font-medium text-slate-700">
              {tr("Trạng thái", "Status")}
              <SelectControl
                className={control}
                value={unpaidOnly ? "UNPAID" : draft.record_status}
                onChange={(event) => {
                  const status = event.target.value
                  setUnpaidOnly(status === "UNPAID")
                  setDraft(previous => ({ ...previous, record_status: status === "UNPAID" ? "ACTIVE" : status as RecordFilters["record_status"] }))
                  setOffset(0)
                }}
              >
                <option value="ALL">{tr("Tất cả", "All")}</option>
                <option value="ACTIVE">{tr("Có hiệu lực", "Effective")}</option>
                <option value="UNPAID">{tr("Nghỉ không lương", "Unpaid leave")}</option>
                <option value="CANCEL">{tr("Đã hủy", "Cancelled")}</option>
              </SelectControl>
            </label>
            <label className="min-w-0 text-sm font-medium text-slate-700">
              {tr("Loại nghỉ", "Leave type")}
              <SelectControl
                className={control}
                value={leaveTypeId}
                onChange={(event) => {
                  setLeaveTypeId(event.target.value)
                  setOffset(0)
                }}
              >
                <option value="">{tr("Tất cả loại nghỉ", "All leave types")}</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {leaveTypeDisplay(type.code, type.name, tr).label}
                  </option>
                ))}
              </SelectControl>
            </label>
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={resetFilters}
            >
              <RotateCcw size={16} />
              {tr("Đặt lại", "Reset")}
            </Button>
            {invalid && (
              <p
                role="alert"
                className="text-sm font-medium text-red-700 md:col-span-2 xl:col-span-full"
              >
                {tr("Khoảng ngày không hợp lệ.", "Invalid date range.")}
              </p>
            )}
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {([
              ["month", tr("Tháng này", "This month")],
              ["quarter", tr("Quý này", "This quarter")],
              ["year", tr(`Năm ${year}`, `Year ${year}`)],
            ] as const).map(([period, label]) => (
              <Button key={period} type="button" variant="secondary" size="sm" onClick={() => setPeriod(period)}>{label}</Button>
            ))}
          </div>
        </div>

        <section className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                {tr("Dữ liệu ngày nghỉ", "Leave data")}
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-600">
                {tr(
                  "Danh sách hồ sơ theo điều kiện lọc hiện tại.",
                  "Records matching the current filters.",
                )}
              </p>
            </div>
            <span className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
              {visibleRows.length} {tr("hồ sơ trên trang", "records on this page")}
            </span>
          </div>

          {loading ? (
            <p role="status" className="py-10 text-center text-slate-600">
              {tr("Đang tải…", "Loading…")}
            </p>
          ) : visibleRows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] table-fixed text-left text-sm">
                <colgroup><col className="w-[220px]" /><col className="w-40" /><col className="w-[264px]" /><col /><col className="w-[140px]" /><col className="w-[106px]" /></colgroup>
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                      <button
                        type="button"
                        onClick={() => toggleSort("employee")}
                        className="inline-flex items-center gap-1.5 transition-colors hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-orange-500"
                      >
                        {tr("Nhân viên", "Employee")} {sortIcon("employee")}
                      </button>
                    </th>
                    <th className="p-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                      {tr("Loại nghỉ", "Leave type")}
                    </th>
                    <th className="p-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                      <button
                        type="button"
                        onClick={() => toggleSort("dates")}
                        className="inline-flex items-center gap-1.5 transition-colors hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-orange-500"
                      >
                        {tr("Ngày nghỉ", "Leave dates")} {sortIcon("dates")}
                      </button>
                    </th>
                    <th className="p-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                      {tr("Lý do", "Reason")}
                    </th>
                    <th className="p-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                      {tr("Trạng thái", "Status")}
                    </th>
                    <th className="p-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
                      {tr("Thao tác", "Actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map(record => {
                    const profile = employeeForRecord(record)
                    const meta = metaFor(record)
                    const name = employeeName(record)
                    const reason = reasonFor(record)
                    const department = departmentName(record)
                    const avatarTone = ["bg-slate-100 text-slate-700", "bg-indigo-100 text-indigo-800", "bg-teal-100 text-teal-800", "bg-sky-100 text-sky-800", "bg-purple-100 text-purple-800"][(profile?.departmentId || 0) % 5]
                    return (
                      <tr key={record.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                        <td className="p-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold ${avatarTone}`}>{employeeInitials(record)}</span>
                            <div className="min-w-0">
                              <p className="wrap-break-word font-semibold leading-5 text-slate-950">{name || tr("Chưa có tên nhân viên", "Employee name unavailable")}</p>
                              <p className="mt-0.5 wrap-break-word text-xs text-slate-600">{[record.employee_code || profile?.employeeCode, department].filter(Boolean).join(" · ")}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${meta.tone}`}>{meta.label}</span></td>
                        <td className="p-3">
                          <p className="flex items-start gap-1.5 font-medium tabular-nums text-slate-900"><CalendarDays size={14} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" /><span>{formatDate(record.start_date)} → {formatDate(record.end_date)}</span></p>
                          <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{recordDayCount(record)} {tr("ngày lịch", "calendar days")}</span>
                        </td>
                        <td className="p-3"><p title={reason} className="line-clamp-2 wrap-break-word leading-5 text-slate-700">{reason}</p></td>
                        <td className="p-3">
                          <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${record.record_status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-100 text-slate-700"}`}>
                            {record.record_status === "ACTIVE" ? tr("Có hiệu lực", "Effective") : tr("Đã hủy", "Cancelled")}
                          </span>
                          {meta.kind === "UNPAID" && <p className="mt-1 text-xs text-slate-600">{tr("Không hưởng lương", "Unpaid")}</p>}
                        </td>
                        <td className="p-3 text-right">
                          <Button type="button" size="sm" variant="secondary" className="h-8 min-h-8 whitespace-nowrap px-2 text-xs hover:border-orange-300 hover:bg-orange-50"
                            disabled={busy} onClick={() => { setError(""); setCancellationReason(""); setDetailRecord(record) }}>
                            {tr("Xem chi tiết", "View details")}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                <Inbox size={23} />
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-800">
                {hasAnyRecords
                  ? tr(
                      "Chưa có hồ sơ trong bộ lọc này.",
                      "No records match these filters.",
                    )
                  : tr("Chưa có hồ sơ nghỉ nào.", "No leave records yet.")}
              </p>
              <p className="mt-1 text-sm font-medium text-slate-600">
                {hasAnyRecords
                  ? tr(
                      "Hãy thay đổi điều kiện lọc để tìm lại.",
                      "Change the filters to search again.",
                    )
                  : own
                    ? tr(
                        "Hồ sơ nghỉ sẽ xuất hiện tại đây khi được ghi nhận.",
                        "Leave records will appear here once recorded.",
                      )
                    : tr(
                        "Sử dụng nút Nhập tệp ngày nghỉ để bắt đầu thu thập dữ liệu.",
                        "Use Import leave file to start collecting data.",
                      )}
              </p>
            </div>
          )}

          {!loading && (hasAnyRecords || rows.length > 0) && (
            <nav aria-label={tr("Phân trang hồ sơ", "Leave record pagination")} className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <p className="text-sm text-slate-700">{tr("Hiển thị", "Showing")} {pageStart} – {pageEnd} {tr("trong tổng số", "of")} {sortedRows.length} {tr("hồ sơ", "records")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" disabled={currentPage === 1} onClick={() => setOffset(0)}>{tr("Đầu", "First")}</Button>
                <Button variant="secondary" size="sm" disabled={currentPage === 1} onClick={() => setOffset(pageOffset - PAGE_SIZE)}>{tr("Trước", "Previous")}</Button>
                <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold tabular-nums text-slate-700">{tr("Trang", "Page")} {currentPage} / {pageCount}</span>
                <Button variant="secondary" size="sm" disabled={currentPage === pageCount} onClick={() => setOffset(pageOffset + PAGE_SIZE)}>{tr("Sau", "Next")}</Button>
                <Button variant="secondary" size="sm" disabled={currentPage === pageCount} onClick={() => setOffset((pageCount - 1) * PAGE_SIZE)}>{tr("Cuối", "Last")}</Button>
              </div>
            </nav>
          )}
        </section>
      </Card>
    </AppShell>
  )
}
