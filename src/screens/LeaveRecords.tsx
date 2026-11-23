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
  BarChart3,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  FileSpreadsheet,
  HelpCircle,
  Inbox,
  MoreHorizontal,
  RotateCcw,
  Search,
  Upload,
  X,
} from "lucide-react"

import { AppShell } from "../components/AppShell"

import { Button, Card, SectionHeader } from "../components/ui"

import { useLanguage } from "../context/LanguageContext"

import { useAutoDismissFeedback } from "../hooks/useAutoDismissState"

import {
  fetchLeaveTypes,
  fetchLeaveRecords,
  fetchLeaveSummary,
  cancelLeaveRecord,
  previewLeaveFile,
  confirmLeaveFile,
  attendanceMessage,
  type LeaveType,
  type LeaveRecord,
  type LeavePreview,
  type LeaveImportResult,
  type RecordFilters,
} from "../services/attendance"

const control =
  "mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"

function RowActionsMenu({
  disabled,

  detailLabel,

  toggleLabel,

  moreLabel,

  destructive = false,

  onDetail,

  onToggle,
}: {
  disabled: boolean

  detailLabel: string

  toggleLabel?: string

  moreLabel: string

  destructive?: boolean

  onDetail: () => void

  onToggle?: () => void
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
      )
        setOpen(false)
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
        className="flex size-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 disabled:opacity-50"
      >
        <MoreHorizontal size={18} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: position.top, left: position.left }}
            className="fixed z-[120] w-52 rounded-md border border-slate-200 bg-white p-1.5 text-left shadow-xl"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onDetail()
              }}
              className="flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Eye size={16} /> {detailLabel}
            </button>
            {toggleLabel && onToggle && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onToggle()
                }}
                className={`flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm font-semibold ${
                  destructive
                    ? "text-red-700 hover:bg-red-50"
                    : "text-emerald-700 hover:bg-emerald-50"
                }`}
              >
                <AlertTriangle size={16} /> {toggleLabel}
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

  const [types, setTypes] = useState<LeaveType[]>([]),
    [rows, setRows] = useState<LeaveRecord[]>([])

  const [filters, setFilters] = useState<RecordFilters>({
      record_status: "ACTIVE",
    }),
    [draft, setDraft] = useState<RecordFilters>({ record_status: "ACTIVE" })

  const [file, setFile] = useState<File | null>(null)

  const [preview, setPreview] = useState<LeavePreview | null>(null),
    [result, setResult] = useState<LeaveImportResult | null>(null)

  const [importModalOpen, setImportModalOpen] = useState(false),
    [dragging, setDragging] = useState(false)

  const [detailRecord, setDetailRecord] = useState<LeaveRecord | null>(null)

  const [confirmRecord, setConfirmRecord] = useState<LeaveRecord | null>(null)

  const [cancellationReason, setCancellationReason] = useState("")

  const [sort, setSort] = useState<{
    key: "employee" | "dates"
    direction: "asc" | "desc"
  }>({
    key: "dates",

    direction: "desc",
  })

  const [offset, setOffset] = useState(0),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false)

  const {
    error,
    message: notice,
    setError,
    setMessage: setNotice,
  } = useAutoDismissFeedback()

  const [summary, setSummary] = useState<Array<{
    employee_id: number

    leave_type_id: number

    records: number

    total_days: number | null

    total_hours: null
  }>>([])

  const [hasAnyRecords, setHasAnyRecords] = useState<boolean | null>(null)

  useEffect(() => {
    let live = true

    void fetchLeaveTypes()

      .then((r) => {
        if (live) setTypes(r.data)
      })

      .catch((e) => {
        if (live)
          setError(
            attendanceMessage(
              e,

              tr("Không tải được loại nghỉ.", "Could not load leave types."),
            ),
          )
      })

    return () => {
      live = false
    }
  }, [own])

  useEffect(() => {
    const c = new AbortController()

    setLoading(true)

    setRows([])

    setSummary([])

    setError("")

    void fetchLeaveRecords({ ...filters, limit: 20, offset }, own, c.signal)

      .then((response) => {
        if (!c.signal.aborted) setRows(response.data)
      })

      .catch((e) => {
        if (!c.signal.aborted)
          setError(
            attendanceMessage(
              e,

              tr("Không tải được hồ sơ nghỉ.", "Could not load leave records."),
            ),
          )
      })

      .finally(() => {
        if (!c.signal.aborted) setLoading(false)
      })

    if (!own) {
      void fetchLeaveSummary(filters, c.signal)

        .then((response) => {
          if (!c.signal.aborted) setSummary(response.data)
        })

        .catch(() => {
          if (!c.signal.aborted) setSummary([])
        })
    }

    void fetchLeaveRecords(
      { record_status: "ALL", limit: 1, offset: 0 },
      own,
      c.signal,
    )

      .then((response) => {
        if (!c.signal.aborted) setHasAnyRecords(response.data.length > 0)
      })

      .catch(() => undefined)

    return () => c.abort()
  }, [filters, offset, revision, own])

  useEffect(() => {
    if (
      !importModalOpen &&
      !detailRecord &&
      !confirmRecord
    )
      return

    const previousOverflow = document.body.style.overflow

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busy) return

      if (confirmRecord) {
        closeCancellationDialog()

        return
      }

      setImportModalOpen(false)

      setDetailRecord(null)

      setConfirmRecord(null)
    }

    document.body.style.overflow = "hidden"

    document.addEventListener("keydown", closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow

      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [importModalOpen, detailRecord, confirmRecord, cancellationReason, busy])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draft.from && draft.to && draft.from > draft.to) return

      setFilters({ ...draft })

      setOffset(0)
    }, 350)

    return () => window.clearTimeout(timer)
  }, [draft])

  async function work(action: () => Promise<void>) {
    if (busy) return

    setBusy(true)

    setError("")

    setNotice("")

    try {
      await action()
    } catch (e) {
      setError(
        attendanceMessage(
          e,

          tr("Không thực hiện được thao tác.", "Could not complete action."),
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  function closeCancellationDialog() {
    if (busy) return

    if (
      cancellationReason.trim() &&
      !window.confirm(
        tr(
          "Bỏ nội dung lý do hủy đang nhập?",
          "Discard the cancellation reason you entered?",
        ),
      )
    )
      return

    setConfirmRecord(null)

    setCancellationReason("")
  }

  function cancelRecord(record: LeaveRecord) {
    if (!cancellationReason.trim()) {
      setError(tr("Vui lòng nhập lý do hủy hồ sơ nghỉ.", "Enter a cancellation reason."))
      return
    }
    void work(async () => {
      await cancelLeaveRecord(record.id, cancellationReason)

      setDetailRecord(null)

      setConfirmRecord(null)

      setCancellationReason("")

      setRevision((value) => value + 1)

      setNotice(tr("Đã hủy hồ sơ nghỉ.", "Leave record cancelled."))
    })
  }

  function upload(e: FormEvent) {
    e.preventDefault()

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

  const importStatusLabel = (status: string) =>
    (({
      VALID: tr("Hợp lệ", "Valid"),

      DUPLICATE: tr("Trùng, sẽ bỏ qua", "Duplicate, will skip"),

      CONFLICT: tr("Xung đột", "Conflict"),

      ERROR: tr("Lỗi", "Error"),

      INSERTED: tr("Đã lưu", "Inserted"),

      SKIPPED: tr("Đã bỏ qua", "Skipped"),
    }) as Record<string, string>)[status] || status

  const importMessage = (code?: string, fallback?: string) => {
    const messages: Record<string, string> = {
      EMPLOYEE_NOT_FOUND: tr(
        "Không tìm thấy mã nhân viên.",
        "Employee code was not found.",
      ),

      LEAVE_TYPE_NOT_FOUND: tr(
        "Không tìm thấy mã loại nghỉ.",
        "Leave type code was not found.",
      ),

      LEAVE_CONFLICT: tr(
        "Khoảng nghỉ bị chồng với hồ sơ nghỉ khác.",
        "The leave period overlaps another leave record.",
      ),

      ATTENDANCE_CONFLICT: tr(
        "Khoảng nghỉ bị chồng với dữ liệu chấm công.",
        "The leave period overlaps attendance data.",
      ),

      VALIDATION_ERROR: tr(
        "Dữ liệu dòng không hợp lệ. Kiểm tra mã và định dạng ngày.",
        "The row is invalid. Check codes and date formats.",
      ),
    }

    return messages[code || ""] || fallback || ""
  }

  const invalid = !!(draft.from && draft.to && draft.from > draft.to)

  const activeRecordCount = summary.reduce(
    (total, item) => total + Number(item.records || 0),
    0,
  )

  const summaryHasDayCount = summary.some((item) => item.total_days !== null)

  const summaryDayCount = summary.reduce(
    (total, item) => total + Number(item.total_days ?? 0),
    0,
  )

  const calendarDaysInFilter = (record: LeaveRecord) => {
    const start = new Date(`${record.start_date}T00:00:00Z`)

    const end = new Date(`${record.end_date}T00:00:00Z`)

    const filterStart = filters.from
      ? new Date(`${filters.from}T00:00:00Z`)
      : start

    const filterEnd = filters.to ? new Date(`${filters.to}T00:00:00Z`) : end

    const overlapStart = Math.max(start.getTime(), filterStart.getTime())

    const overlapEnd = Math.min(end.getTime(), filterEnd.getTime())

    return overlapEnd < overlapStart
      ? 0
      : Math.floor((overlapEnd - overlapStart) / 86_400_000) + 1
  }

  const activeDayCount = summaryHasDayCount
    ? summaryDayCount
    : activeRecordCount === rows.length
      ? rows.reduce((total, record) => total + calendarDaysInFilter(record), 0)
      : null

  const activeEmployeeCount = new Set(summary.map((item) => item.employee_id))
    .size

  const pageStart = rows.length ? offset + 1 : 0

  const pageEnd = offset + rows.length

  const knownTotal =
    filters.record_status === "ACTIVE" ? activeRecordCount : null

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

  const sortedRows = [...rows].sort((left, right) => {
    const leftValue =
      sort.key === "employee"
        ? left.employee_code || String(left.employee_id)
        : `${left.start_date}-${left.end_date}`

    const rightValue =
      sort.key === "employee"
        ? right.employee_code || String(right.employee_id)
        : `${right.start_date}-${right.end_date}`

    return (
      leftValue.localeCompare(rightValue, language === "vi" ? "vi" : "en", {
        numeric: true,
      }) * (sort.direction === "asc" ? 1 : -1)
    )
  })

  const toggleSort = (key: "employee" | "dates") => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
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
          own ? "Xem dữ liệu ngày nghỉ do HR đã thu thập từ tệp nguồn." : "HR nhập tệp ngày nghỉ từ nguồn bên ngoài; hệ thống kiểm tra và lưu dữ liệu, không tự tạo ngày nghỉ.",

          own ? "View leave data collected by HR from source files." : "HR imports leave files from an external source; the system validates and stores data but does not create leave automatically.",
        )}
      >
        {!own && (
          <>
            <Button variant="secondary" onClick={() => navigate("/employee-requests/dashboard")}>
              <BarChart3 size={16} />
              {tr("Xem tổng quan", "View dashboard")}
            </Button>
            <Button
              disabled={!types.length}
              onClick={() => setImportModalOpen(true)}
            >
              <Upload size={16} />
              {tr("Nhập tệp ngày nghỉ", "Import leave file")}
            </Button>
          </>
        )}
      </SectionHeader>
      {!own && <ol aria-label={tr("Quy trình nhập dữ liệu ngày nghỉ", "Leave import workflow")} className="mb-4 grid overflow-hidden rounded-md border border-slate-200 bg-white sm:grid-cols-4">
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
      {!own && (
        <>
          {detailRecord && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="leave-detail-title"
              className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !busy)
                  setDetailRecord(null)
              }}
            >
              <Card className="relative w-full max-w-md p-5 shadow-2xl sm:p-6">
                <button
                  type="button"
                  aria-label={tr("Đóng", "Close")}
                  disabled={busy}
                  onClick={() => setDetailRecord(null)}
                  className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                >
                  <X size={20} />
                </button>
                <div className="pr-12">
                  <h2
                    id="leave-detail-title"
                    className="text-lg font-bold text-slate-950"
                  >
                    {tr("Chi tiết hồ sơ nghỉ", "Leave record details")}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {detailRecord.employee_code ||
                      tr("Chưa có mã nhân viên", "No employee code")}{" "}
                    · ID {detailRecord.employee_id}
                  </p>
                </div>

                <dl className="mt-5 grid gap-3 rounded-md bg-slate-50 p-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-slate-600">
                      {tr("Người ghi nhận", "Recorded by")}
                    </dt>
                    <dd className="mt-1 break-words font-semibold text-slate-900">
                      {detailRecord.recorded_by ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-600">
                      {tr("Trạng thái", "Status")}
                    </dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {detailRecord.record_status === "ACTIVE"
                        ? tr("Đang sử dụng", "Active")
                        : tr("Đã hủy", "Cancelled")}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-600">
                      {tr("Ngày tạo", "Created")}
                    </dt>
                    <dd className="mt-1 text-slate-900">
                      {formatDateTime(detailRecord.created_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-600">
                      {tr("Cập nhật gần nhất", "Last updated")}
                    </dt>
                    <dd className="mt-1 text-slate-900">
                      {formatDateTime(detailRecord.updated_at)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setDetailRecord(null)}
                  >
                    {tr("Đóng", "Close")}
                  </Button>
                </div>
              </Card>
            </div>
          )}
          {confirmRecord && (
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="leave-confirm-title"
              className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) closeCancellationDialog()
              }}
            >
              <Card className="w-full max-w-md animate-in fade-in zoom-in-95 p-5 shadow-2xl duration-200 sm:p-6">
                <div className="flex size-11 items-center justify-center rounded-md bg-red-50 text-red-700">
                  <AlertTriangle size={22} />
                </div>
                <h2
                  id="leave-confirm-title"
                  className="mt-4 text-lg font-bold text-slate-950"
                >
                  {tr("Xác nhận hủy hồ sơ nghỉ?", "Cancel this leave record?")}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {tr(
                    `Hồ sơ của ${confirmRecord.employee_code || `ID ${confirmRecord.employee_id}`} (${confirmRecord.start_date} - ${confirmRecord.end_date}) sẽ chuyển sang trạng thái Đã hủy. Nếu cần sửa, hãy tạo hồ sơ mới sau khi hủy.`,
                    `The record for ${confirmRecord.employee_code || `ID ${confirmRecord.employee_id}`} (${confirmRecord.start_date} - ${confirmRecord.end_date}) will be cancelled. Create a new record after cancellation when a correction is needed.`,
                  )}
                </p>
                <label className="mt-4 block text-sm font-semibold text-slate-800">
                  {tr("Lý do hủy", "Cancellation reason")}
                  <textarea
                    autoFocus
                    required
                    rows={3}
                    maxLength={500}
                    value={cancellationReason}
                    onChange={(event) => setCancellationReason(event.target.value)}
                    placeholder={tr("Ví dụ: Sai khoảng ngày nghỉ", "Example: Incorrect leave dates")}
                    className="mt-2 min-h-24 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                  />
                  <span className="mt-1 block text-xs font-medium text-slate-600">
                    {tr("BE yêu cầu lý do để lưu dấu vết thay đổi.", "A reason is required for the audit trail.")}
                  </span>
                </label>
                <div className="mt-6 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={closeCancellationDialog}
                  >
                    {tr("Giữ lại", "Keep record")}
                  </Button>
                  <button
                    type="button"
                    disabled={busy || !cancellationReason.trim()}
                    onClick={() => cancelRecord(confirmRecord)}
                    className="h-10 rounded-md bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy
                      ? tr("Đang xử lý...", "Processing...")
                      : tr("Xác nhận hủy", "Confirm cancellation")}
                  </button>
                </div>
              </Card>
            </div>
          )}
          {importModalOpen && (
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !busy)
                  setImportModalOpen(false)
              }}
            >
              <Card className="relative max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto p-5 shadow-2xl sm:p-6">
                <button
                  type="button"
                  aria-label={tr("Đóng", "Close")}
                  disabled={busy}
                  onClick={() => setImportModalOpen(false)}
                  className="absolute right-5 top-5 flex size-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  <X size={20} />
                </button>
                <h2 className="pr-12 text-base font-semibold text-slate-950">
                  {tr(
                    "Nhập hồ sơ nghỉ Excel / CSV",

                    "Import leave records from Excel / CSV",
                  )}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {tr(
                    "Tối đa 10 MiB, 10.000 dòng. leave_type phải là mã LTxxx trong danh mục dưới đây, không phải tên hay ID. Xác nhận sẽ kiểm tra lại tệp và lưu dòng hợp lệ; dòng trùng bỏ qua, lỗi/xung đột không được lưu.",

                    "Up to 10 MiB and 10,000 rows. leave_type must use the actual LTxxx catalogue code, not a name or ID. Confirm revalidates the same file and saves valid rows; duplicates skip, errors and conflicts are not saved.",
                  )}
                </p>
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer font-semibold">
                    {tr("Danh mục mã loại nghỉ", "Leave type code catalogue")}
                  </summary>
                  <ul>
                    {types.map((t) => (
                      <li key={t.id}>
                        {t.code} · {t.name}
                      </li>
                    ))}
                  </ul>
                </details>
                <form onSubmit={upload} className="mt-4">
                  <label
                    className={`flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-5 py-6 text-center transition ${
                      dragging
                        ? "border-orange-400 bg-orange-50"
                        : "border-slate-300 bg-slate-50 hover:border-orange-300 hover:bg-orange-50/40"
                    } ${busy ? "cursor-not-allowed opacity-60" : ""}`}
                    onDragOver={(event) => {
                      event.preventDefault()

                      if (!busy) setDragging(true)
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault()

                      setDragging(false)

                      if (!busy)
                        chooseImportFile(event.dataTransfer.files?.[0] || null)
                    }}
                  >
                    <input
                      type="file"
                      accept=".xlsx,.csv"
                      disabled={busy}
                      className="sr-only"
                      onChange={(event) =>
                        chooseImportFile(event.target.files?.[0] || null)
                      }
                    />
                    <Upload size={28} className="text-orange-500" />
                    <span className="mt-2 text-sm font-semibold text-slate-800">
                      {tr(
                        "Kéo thả tệp vào đây hoặc bấm để chọn",

                        "Drop a file here or click to browse",
                      )}
                    </span>
                    <span className="mt-1 text-xs font-medium text-slate-600">
                      {tr(
                        "Tệp XLSX hoặc CSV · tối đa 10 MiB",

                        "XLSX or CSV file · up to 10 MiB",
                      )}
                    </span>
                    {file && (
                      <span className="mt-3 inline-flex max-w-full items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                        <FileSpreadsheet
                          size={16}
                          className="shrink-0 text-emerald-600"
                        />
                        <span className="truncate">{file.name}</span>
                      </span>
                    )}
                    <a
                      href="/templates/ERIS_Leave_Records_Template.csv"
                      download
                      onClick={(event) => event.stopPropagation()}
                      className="mt-3 text-sm font-semibold text-blue-700 hover:underline"
                    >
                      {tr("Tải mẫu CSV", "Download CSV template")}
                    </a>
                  </label>
                  <div className="mt-4 flex justify-end">
                    <Button
                      type="submit"
                      disabled={busy || !file}
                      className="disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
                    >
                      {tr("Xem trước tệp nghỉ", "Preview leave file")}
                    </Button>
                  </div>
                </form>
                {(preview || result) && (
                  <div className="mt-4">
                    <p
                      role="status"
                      className={`rounded-md p-3 text-sm ${
                        result && (result.conflicted || result.failed)
                          ? "bg-amber-50 text-amber-950"
                          : "bg-blue-50 text-blue-900"
                      }`}
                    >
                      {result
                        ? tr("Đã nhập. Mới: ", "Imported. Inserted: ") +
                          result.inserted +
                          " · " +
                          tr("Bỏ qua: ", "Skipped: ") +
                          result.skipped +
                          " · " +
                          tr("Xung đột: ", "Conflicts: ") +
                          result.conflicted +
                          " · " +
                          tr("Lỗi: ", "Errors: ") +
                          result.failed
                        : tr(
                            "Xem trước, chưa lưu. Hợp lệ: ",

                            "Preview, not saved. Valid: ",
                          ) +
                          preview!.summary.valid +
                          " · " +
                          tr("Trùng: ", "Duplicates: ") +
                          preview!.summary.duplicate +
                          " · " +
                          tr("Xung đột: ", "Conflicts: ") +
                          preview!.summary.conflict +
                          " · " +
                          tr("Lỗi: ", "Errors: ") +
                          preview!.summary.error}
                    </p>
                    <div className="mt-3 max-h-80 overflow-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr>
                            {[
                              tr("Dòng", "Row"),

                              tr("Nhân viên / loại", "Employee / type"),

                              tr("Khoảng nghỉ", "Leave dates"),

                              tr("Kết quả", "Outcome"),
                            ].map((h) => (
                              <th key={h} className="p-2">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(result?.rows || preview!.rows).map((r) => (
                            <tr key={r.row} className="border-b">
                              <td className="p-2">{r.row}</td>
                              <td className="p-2">
                                {r.employee_code} · {r.leave_type}
                              </td>
                              <td className="p-2">
                                {r.start_date} → {r.end_date}
                              </td>
                              <td className="p-2">
                                <span className="font-semibold">
                                  {importStatusLabel(r.status)}
                                </span>
                                {importMessage(r.code, r.message) && (
                                  <span className="mt-1 block text-slate-600">
                                    {importMessage(r.code, r.message)}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {result && (result.conflicted > 0 || result.failed > 0) && (
                      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                        <p className="font-semibold">
                          {tr(
                            `Đã lưu ${result.inserted} hồ sơ; còn ${result.conflicted + result.failed} dòng cần xử lý.`,

                            `Saved ${result.inserted} records; ${result.conflicted + result.failed} rows still need attention.`,
                          )}
                        </p>
                        <p className="mt-1">
                          {tr(
                            "Sửa dữ liệu nguồn rồi chọn lại tệp, hoặc đóng để xem các hồ sơ đã lưu.",
                            "Correct the source data and choose the file again, or close to view saved records.",
                          )}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => chooseImportFile(null)}
                          >
                            {tr("Chọn tệp khác", "Choose another file")}
                          </Button>
                          <Button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              const imported = result

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
                            }}
                          >
                            {tr(
                              "Đóng và xem danh sách",
                              "Close and view records",
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {preview && !result && (
                  <Button
                    className="mt-3"
                    disabled={busy || !file || preview.summary.valid === 0}
                    onClick={() => {
                      if (
                        file &&
                        window.confirm(
                          tr(
                            "Lưu các dòng nghỉ hợp lệ sau khi kiểm tra lại?",

                            "Revalidate and save valid leave rows?",
                          ),
                        )
                      )
                        void work(async () => {
                          const imported = await confirmLeaveFile(
                            file,

                            preview.fingerprint,
                          )

                          setRevision((v) => v + 1)

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
                    }}
                  >
                    {tr("Xác nhận nhập hồ sơ nghỉ", "Confirm leave import")}
                  </Button>
                )}
              </Card>
            </div>
          )}
        </>
      )}
      <Card className="overflow-hidden p-0">
        {!own && hasAnyRecords && (
          <section className="border-b border-slate-200 px-5 py-4">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-950">
                {tr("Tổng hợp nghỉ đang có hiệu lực", "Active leave summary")}
              </h2>
              <span
                title={tr(
                  "Chỉ tính các ngày giao với bộ lọc hiện tại.",

                  "Counts only dates overlapping the current filters.",
                )}
                className="inline-flex cursor-help text-slate-500"
              >
                <HelpCircle size={16} />
              </span>
            </div>
            <div className="grid divide-y divide-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {[
                [tr("Hồ sơ hợp lệ", "Valid records"), activeRecordCount],

                [
                  tr("Nhân viên có nghỉ", "Employees on leave"),
                  activeEmployeeCount,
                ],

                [tr("Tổng ngày nghỉ", "Total leave days"), activeDayCount],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="px-1 py-3 sm:px-5 sm:py-1 first:pl-1"
                >
                  <p className="text-sm font-semibold text-slate-600">
                    {label}
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">
                    {value ?? "—"}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
        <div
          className={hasAnyRecords ? "border-b border-slate-200 p-5" : "hidden"}
        >
          <form
            onSubmit={(event) => event.preventDefault()}
            className={`grid gap-3 md:grid-cols-2 xl:items-end ${
              own
                ? "xl:grid-cols-[minmax(170px,1fr)_minmax(170px,1fr)_minmax(190px,1fr)_auto]"
                : "xl:grid-cols-[minmax(220px,1.1fr)_minmax(170px,0.8fr)_minmax(170px,0.8fr)_minmax(190px,0.9fr)_auto]"
            }`}
          >
            {!own && (
              <label className="min-w-0 text-sm font-medium text-slate-700">
                {tr("Tìm nhân viên", "Find employee")}
                <span className="relative mt-1 block">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="number"
                    min="1"
                    className="h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                    placeholder={tr("Nhập ID nhân viên", "Enter employee ID")}
                    value={draft.employee_id || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, employee_id: e.target.value })
                    }
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
                onChange={(e) => setDraft({ ...draft, from: e.target.value })}
              />
            </label>
            <label className="min-w-0 text-sm font-medium text-slate-700">
              {tr("Đến ngày nghỉ", "To date")}
              <input
                type="date"
                className={control}
                value={draft.to || ""}
                onChange={(e) => setDraft({ ...draft, to: e.target.value })}
              />
            </label>
            <label className="min-w-0 text-sm font-medium text-slate-700">
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
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setNotice("")

                const initial = { record_status: "ACTIVE" } as RecordFilters

                setDraft(initial)

                setFilters(initial)

                setOffset(0)
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
            >
              <RotateCcw size={16} />
              {tr("Đặt lại", "Reset")}
            </button>
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
              {rows.length} {tr("hồ sơ trên trang", "records on this page")}
            </span>
          </div>
          {loading ? (
            <p role="status">{tr("Đang tải…", "Loading…")}</p>
          ) : (
            <>
              <div
                className={
                  hasAnyRecords
                    ? "overflow-x-auto lg:overflow-visible"
                    : "hidden"
                }
              >
                <table className="w-full whitespace-nowrap text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                        <button
                          type="button"
                          title={tr(
                            "Sắp xếp dữ liệu trên trang",
                            "Sort records on this page",
                          )}
                          onClick={() => toggleSort("employee")}
                          className="inline-flex items-center gap-1.5 hover:text-slate-950"
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
                          title={tr(
                            "Sắp xếp dữ liệu trên trang",
                            "Sort records on this page",
                          )}
                          onClick={() => toggleSort("dates")}
                          className="inline-flex items-center gap-1.5 hover:text-slate-950"
                        >
                          {tr("Ngày nghỉ", "Leave dates")} {sortIcon("dates")}
                        </button>
                      </th>
                      <th className="p-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                        {tr("Lý do", "Reason")}
                      </th>
                      <th className="p-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                        <span className="inline-block lg:translate-x-8 xl:translate-x-12">
                          {tr("Trạng thái", "Status")}
                        </span>
                      </th>
                      <th className="w-44 p-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
                        {tr("Thao tác", "Actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-slate-200 align-middle transition-colors hover:bg-orange-50/40"
                      >
                        <td className="p-3 font-bold text-slate-950">
                          {r.employee_code || r.employee_id}
                        </td>
                        <td className="p-3">
                          {r.leave_type} · {r.leave_type_name}
                        </td>
                        <td className="p-3">
                          <span className="font-medium text-slate-900">
                            {r.start_date} → {r.end_date}
                          </span>
                          <span className="ml-2 text-xs font-semibold text-slate-500">
                            ({calendarDaysInFilter(r)} {tr("ngày", "days")})
                          </span>
                        </td>
                        <td className="max-w-xs whitespace-normal break-words p-3">
                          {r.reason || "—"}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex h-6 items-center rounded-md border px-2 text-xs font-semibold lg:translate-x-8 xl:translate-x-12 ${
                              r.record_status === "ACTIVE"
                                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                : "border-slate-300 bg-slate-100 text-slate-700"
                            }`}
                          >
                            {r.record_status === "ACTIVE"
                              ? tr("Đang sử dụng", "Active")
                              : tr("Đã hủy", "Cancelled")}
                          </span>
                        </td>
                        <td className="w-44 p-3 text-right">
                          {!own && (
                            <div className="inline-flex min-w-36 items-center justify-end gap-2">
                              <RowActionsMenu
                                disabled={busy}
                                moreLabel={tr(
                                  "Mở thao tác khác",
                                  "Open more actions",
                                )}
                                detailLabel={tr("Xem chi tiết", "View details")}
                                toggleLabel={
                                  r.record_status === "ACTIVE"
                                    ? tr("Hủy hồ sơ", "Cancel record")
                                    : undefined
                                }
                                destructive={r.record_status === "ACTIVE"}
                                onDetail={() => setDetailRecord(r)}
                                onToggle={
                                  r.record_status === "ACTIVE"
                                    ? () => {
                                        setCancellationReason("")
                                        setConfirmRecord(r)
                                      }
                                    : undefined
                                }
                              />
                            </div>
                          )}
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
                          "Chưa có hồ sơ trong bộ lọc này.",

                          "No records match these filters.",
                        )
                      : tr(
                          "Chưa có hồ sơ nghỉ nào.",

                          "No leave records yet.",
                        )}
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
            </>
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
                  disabled={loading || !offset}
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
            </div>
          )}
        </section>
      </Card>
    </AppShell>
  )
}
