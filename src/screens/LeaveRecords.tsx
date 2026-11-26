import { SelectControl } from "../components/ui/select-control"
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  CalendarCheck2,
  CalendarDays,
  Clock3,
  Eye,
  Inbox,
  MoreHorizontal,
  RotateCcw,
  Search,
  Upload,
  Users,
} from "lucide-react"
import { AppShell } from "../components/AppShell"
import LeaveImportDialog from "../components/leave/LeaveImportDialog"
import LeaveRecordDrawer from "../components/leave/LeaveRecordDrawer"
import { Button, Card, SectionHeader } from "../components/ui"
import { useLanguage } from "../context/LanguageContext"
import { useAutoDismissFeedback } from "../hooks/useAutoDismissState"
import { listEmployeeProfiles, type EmployeeProfile } from "../services/api"
import {
  attendanceMessage,
  cancelLeaveRecord,
  confirmLeaveFile,
  fetchLeaveRecords,
  fetchLeaveSummary,
  fetchLeaveTypes,
  previewLeaveFile,
  type LeaveImportResult,
  type LeavePreview,
  type LeaveRecord,
  type LeaveType,
  type RecordFilters,
} from "../services/attendance"

const PAGE_SIZE = 20
const control =
  "mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition-colors duration-200 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"

interface LeaveSummaryItem {
  employee_id: number
  leave_type_id: number
  records: number
  total_days: number | null
  total_hours: null
}

function RowActionsMenu({
  disabled,
  detailLabel,
  cancelLabel,
  moreLabel,
  onDetail,
  onCancel,
}: {
  disabled: boolean
  detailLabel: string
  cancelLabel?: string
  moreLabel: string
  onDetail: () => void
  onCancel?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const menuHeight = 104
    const openAbove = window.innerHeight - rect.bottom < menuHeight + 16
    setPosition({
      top: openAbove ? Math.max(8, rect.top - menuHeight - 6) : rect.bottom + 6,
      left: Math.max(8, Math.min(window.innerWidth - 216, rect.right - 208)),
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        !buttonRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("resize", close)
    window.addEventListener("scroll", close, true)
    document.addEventListener("mousedown", closeOutside)
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      window.removeEventListener("resize", close)
      window.removeEventListener("scroll", close, true)
      document.removeEventListener("mousedown", closeOutside)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-label={moreLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex size-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition-colors duration-200 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-50"
      >
        <MoreHorizontal size={18} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: position.top, left: position.left }}
            className="fixed z-[120] w-52 animate-in fade-in zoom-in-95 rounded-md border border-slate-200 bg-white p-1.5 text-left shadow-xl duration-150"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onDetail()
              }}
              className="flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-orange-500"
            >
              <Eye size={16} /> {detailLabel}
            </button>
            {cancelLabel && onCancel && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onCancel()
                }}
                className="flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-500"
              >
                <AlertTriangle size={16} /> {cancelLabel}
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}

export default function LeaveRecords({ own = false }: { own?: boolean }) {
  const { language } = useLanguage()
  const navigate = useNavigate()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const initialFilters: RecordFilters = { record_status: "ACTIVE" }

  const [types, setTypes] = useState<LeaveType[]>([])
  const [rows, setRows] = useState<LeaveRecord[]>([])
  const [filterRows, setFilterRows] = useState<LeaveRecord[]>([])
  const [employees, setEmployees] = useState<EmployeeProfile[]>([])
  const [summary, setSummary] = useState<LeaveSummaryItem[]>([])
  const [filters, setFilters] = useState<RecordFilters>(initialFilters)
  const [draft, setDraft] = useState<RecordFilters>(initialFilters)
  const [employeeSearch, setEmployeeSearch] = useState("")
  const [leaveTypeId, setLeaveTypeId] = useState("")
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
  const [clientRowsLoading, setClientRowsLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hasAnyRecords, setHasAnyRecords] = useState<boolean | null>(null)
  const {
    error,
    message: notice,
    setError,
    setMessage: setNotice,
  } = useAutoDismissFeedback()

  const needsClientFiltering = Boolean(employeeSearch.trim() || leaveTypeId)

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
    void listEmployeeProfiles(
      { page: 1, limit: 1000, employmentStatus: "ACTIVE" },
      controller.signal,
    )
      .then((response) => {
        if (!controller.signal.aborted) setEmployees(response.data)
      })
      .catch(() => {
        if (!controller.signal.aborted) setEmployees([])
      })
    return () => controller.abort()
  }, [own, revision])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setRows([])
    setSummary([])
    setError("")
    void fetchLeaveRecords(
      { ...filters, limit: PAGE_SIZE, offset },
      own,
      controller.signal,
    )
      .then((response) => {
        if (!controller.signal.aborted) setRows(response.data)
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(
            attendanceMessage(
              reason,
              tr("Không tải được hồ sơ nghỉ.", "Could not load leave records."),
            ),
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    if (!own) {
      void fetchLeaveSummary(filters, controller.signal)
        .then((response) => {
          if (!controller.signal.aborted) setSummary(response.data)
        })
        .catch(() => {
          if (!controller.signal.aborted) setSummary([])
        })
    }

    void fetchLeaveRecords(
      { record_status: "ALL", limit: 1, offset: 0 },
      own,
      controller.signal,
    )
      .then((response) => {
        if (!controller.signal.aborted) setHasAnyRecords(response.data.length > 0)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [filters, offset, revision, own])

  useEffect(() => {
    if (!needsClientFiltering) {
      setFilterRows([])
      setClientRowsLoading(false)
      return
    }
    const controller = new AbortController()
    setClientRowsLoading(true)
    void fetchLeaveRecords(
      { ...filters, limit: 1000, offset: 0 },
      own,
      controller.signal,
    )
      .then((response) => {
        if (!controller.signal.aborted) setFilterRows(response.data)
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(
            attendanceMessage(
              reason,
              tr(
                "Không tải được dữ liệu để lọc.",
                "Could not load records for filtering.",
              ),
            ),
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setClientRowsLoading(false)
      })
    return () => controller.abort()
  }, [filters, needsClientFiltering, own, revision])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draft.from && draft.to && draft.from > draft.to) return
      setFilters({ ...draft })
      setOffset(0)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [draft])

  useEffect(() => {
    if (!importModalOpen && !detailRecord) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busy) return
      if (detailRecord) closeDetailDrawer()
      else closeImportDialog()
    }
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [importModalOpen, detailRecord, cancellationReason, file, preview, busy])

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
  const employeeById = new Map(
    employees.map((employee) => [employee.id, employee]),
  )
  const normalizedSearch = employeeSearch
    .trim()
    .toLocaleLowerCase(language === "vi" ? "vi-VN" : "en-US")
  const employeeForRecord = (record: LeaveRecord) =>
    employeeById.get(record.employee_id)
  const employeeName = (record: LeaveRecord) =>
    employeeForRecord(record)?.fullName || ""
  const recordMatchesSearch = (record: LeaveRecord) => {
    if (!normalizedSearch) return true
    const profile = employeeForRecord(record)
    const searchable = `${record.employee_code || ""} ${profile?.employeeCode || ""} ${profile?.fullName || ""}`
      .toLocaleLowerCase(language === "vi" ? "vi-VN" : "en-US")
    return searchable.includes(normalizedSearch)
  }
  const sourceRows = needsClientFiltering ? filterRows : rows
  const filteredRows = sourceRows.filter(
    (record) =>
      (!leaveTypeId || String(record.leave_type_id) === leaveTypeId) &&
      recordMatchesSearch(record),
  )
  const matchingEmployeeIds = new Set(
    filteredRows.map((record) => record.employee_id),
  )
  const scopedSummary = summary.filter(
    (item) =>
      (!leaveTypeId || String(item.leave_type_id) === leaveTypeId) &&
      (!normalizedSearch || matchingEmployeeIds.has(item.employee_id)),
  )
  const summaryRecordCount = scopedSummary.reduce(
    (total, item) => total + Number(item.records || 0),
    0,
  )
  const summaryHasDayCount = scopedSummary.some(
    (item) => item.total_days !== null,
  )
  const summaryDayCount = scopedSummary.reduce(
    (total, item) => total + Number(item.total_days ?? 0),
    0,
  )

  const recordDayCount = (record: LeaveRecord) => {
    const start = new Date(`${record.start_date}T00:00:00Z`).getTime()
    const end = new Date(`${record.end_date}T00:00:00Z`).getTime()
    return Math.max(1, Math.floor((end - start) / 86_400_000) + 1)
  }
  const activeRows = filteredRows.filter(
    (record) => record.record_status === "ACTIVE",
  )
  const activeRecordCount = own
    ? activeRows.length
    : needsClientFiltering
      ? activeRows.length
      : summaryRecordCount
  const activeEmployeeCount = own
    ? new Set(activeRows.map((record) => record.employee_id)).size
    : scopedSummary.length
      ? new Set(scopedSummary.map((item) => item.employee_id)).size
      : new Set(activeRows.map((record) => record.employee_id)).size
  const activeDayCount =
    !own && !needsClientFiltering && summaryHasDayCount
      ? summaryDayCount
      : activeRows.reduce(
          (total, record) => total + recordDayCount(record),
          0,
        )

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
  const leaveTypeMeta = (record: LeaveRecord) => {
    const type = types.find((item) => item.id === record.leave_type_id)
    const code = (record.leave_type || type?.code || "LEAVE").toUpperCase()
    const label = record.leave_type_name || type?.name || code
    const tone = code.includes("SICK")
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : code.includes("ANNUAL")
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : code.includes("PERSONAL")
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : code.includes("MATERNITY") || code.includes("PATERNITY")
            ? "border-violet-200 bg-violet-50 text-violet-700"
            : "border-slate-200 bg-slate-100 text-slate-700"
    return { code, label: `${code} · ${label}`, tone }
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
  const visibleRows = needsClientFiltering
    ? sortedRows.slice(offset, offset + PAGE_SIZE)
    : sortedRows
  const pageStart = visibleRows.length ? offset + 1 : 0
  const pageEnd = offset + visibleRows.length
  const knownTotal = needsClientFiltering
    ? filteredRows.length
    : filters.record_status === "ACTIVE"
      ? activeRecordCount
      : null
  const hasNextPage = needsClientFiltering
    ? offset + PAGE_SIZE < filteredRows.length
    : rows.length >= PAGE_SIZE
  const detailMeta = detailRecord
    ? leaveTypeMeta(detailRecord)
    : { label: "", tone: "" }

  const toggleSort = (key: "employee" | "dates") => {
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
    setOffset(0)
  }

  const kpis = [
    {
      label: tr("Hồ sơ hợp lệ", "Valid records"),
      value: activeRecordCount,
      detail: tr("Đang có hiệu lực", "Currently active"),
      icon: CalendarCheck2,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: tr("Nhân viên có nghỉ", "Employees on leave"),
      value: activeEmployeeCount,
      detail: tr("Trong phạm vi đang lọc", "Within current filters"),
      icon: Users,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      label: tr("Tổng ngày nghỉ", "Total leave days"),
      value: activeDayCount,
      detail: tr("Cộng dồn theo khoảng ngày", "Cumulative leave duration"),
      icon: Clock3,
      tone: "bg-orange-50 text-orange-700",
    },
  ]

  return (
    <AppShell
      breadcrumb={[
        tr("Nhân sự", "Workforce"),
        tr(
          own ? "Ngày nghỉ của tôi" : "Dữ liệu ngày nghỉ nhân viên",
          own ? "My leave records" : "Employee leave records",
        ),
      ]}
    >
      <SectionHeader
        title={tr(
          own ? "Ngày nghỉ của tôi" : "Dữ liệu ngày nghỉ nhân viên",
          own ? "My leave data" : "Employee leave data",
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

      {error && !importModalOpen && (
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
        record={!own ? detailRecord : null}
        employeeName={detailRecord ? employeeName(detailRecord) : ""}
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
        {kpis.map(({ label, value, detail, icon: Icon, tone }) => (
          <Card key={label} className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-600">{label}</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">
                  {loading || clientRowsLoading ? "—" : value}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-600">{detail}</p>
              </div>
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-md ${tone}`}
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
            className={`grid gap-3 md:grid-cols-2 xl:items-end ${
              own
                ? "xl:grid-cols-[minmax(160px,1fr)_minmax(160px,1fr)_minmax(180px,1fr)_minmax(190px,1fr)_auto]"
                : "xl:grid-cols-[minmax(230px,1.25fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)_minmax(170px,0.85fr)_minmax(190px,0.95fr)_auto]"
            }`}
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
                      "Tìm theo tên hoặc mã EMP...",
                      "Search by name or employee code...",
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
                value={draft.record_status}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    record_status: event.target
                      .value as RecordFilters["record_status"],
                  })
                }
              >
                <option value="ACTIVE">{tr("Đang sử dụng", "Active")}</option>
                <option value="CANCEL">{tr("Đã hủy", "Cancelled")}</option>
                <option value="ALL">{tr("Tất cả", "All")}</option>
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
                    {type.code} · {type.name}
                  </option>
                ))}
              </SelectControl>
            </label>
            <Button
              type="button"
              variant="secondary"
              disabled={loading || clientRowsLoading}
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

          {loading || clientRowsLoading ? (
            <p role="status" className="py-10 text-center text-slate-600">
              {tr("Đang tải…", "Loading…")}
            </p>
          ) : visibleRows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
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
                    {!own && (
                      <th className="w-24 p-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
                        {tr("Thao tác", "Actions")}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((record) => {
                    const profile = employeeForRecord(record)
                    const meta = leaveTypeMeta(record)
                    return (
                      <tr
                        key={record.id}
                        className="border-b border-slate-200 align-middle transition-colors duration-150 hover:bg-orange-50/40"
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-800">
                              {employeeInitials(record)}
                            </span>
                            <div className="min-w-0">
                              <p className="max-w-52 truncate font-semibold text-slate-950">
                                {profile?.fullName ||
                                  tr("Chưa có tên nhân viên", "Employee name unavailable")}
                              </p>
                              <p className="text-xs font-medium text-slate-600">
                                {record.employee_code || profile?.employeeCode || `ID ${record.employee_id}`}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${meta.tone}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-slate-900">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays size={15} className="text-slate-500" />
                            {formatDate(record.start_date)} → {formatDate(record.end_date)}
                          </span>
                          <span className="ml-2 text-xs font-semibold text-slate-600">
                            · {recordDayCount(record)} {tr("ngày", "days")}
                          </span>
                        </td>
                        <td className="max-w-xs p-3">
                          <p
                            title={record.reason || undefined}
                            className="max-w-xs truncate text-slate-700"
                          >
                            {record.reason || "—"}
                          </p>
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${
                              record.record_status === "ACTIVE"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-slate-100 text-slate-700"
                            }`}
                          >
                            {record.record_status === "ACTIVE"
                              ? tr("Đang sử dụng", "Active")
                              : tr("Đã hủy", "Cancelled")}
                          </span>
                        </td>
                        {!own && (
                          <td className="w-24 p-3 text-right">
                            <RowActionsMenu
                              disabled={busy}
                              moreLabel={tr(
                                "Mở thao tác khác",
                                "Open more actions",
                              )}
                              detailLabel={tr("Xem chi tiết", "View details")}
                              cancelLabel={
                                record.record_status === "ACTIVE"
                                  ? tr("Hủy hồ sơ", "Cancel record")
                                  : undefined
                              }
                              onDetail={() => {
                                setCancellationReason("")
                                setDetailRecord(record)
                              }}
                              onCancel={
                                record.record_status === "ACTIVE"
                                  ? () => {
                                      setCancellationReason("")
                                      setDetailRecord(record)
                                    }
                                  : undefined
                              }
                            />
                          </td>
                        )}
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

          {hasAnyRecords && (
            <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-slate-600">
                {tr("Hiển thị", "Showing")} {pageStart} - {pageEnd}
                {knownTotal !== null && (
                  <>
                    {" "}
                    {tr("trên tổng", "of")} {knownTotal}
                  </>
                )}{" "}
                {tr("hồ sơ", "records")}
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  disabled={loading || clientRowsLoading || !offset}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  {tr("Trước", "Previous")}
                </Button>
                <span className="flex min-w-10 items-center justify-center rounded-md bg-slate-100 px-3 text-sm font-semibold text-slate-700">
                  {offset / PAGE_SIZE + 1}
                </span>
                <Button
                  variant="secondary"
                  disabled={loading || clientRowsLoading || !hasNextPage}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  {tr("Trang sau", "Next page")}
                </Button>
              </div>
            </div>
          )}
        </section>
      </Card>
    </AppShell>
  )
}
