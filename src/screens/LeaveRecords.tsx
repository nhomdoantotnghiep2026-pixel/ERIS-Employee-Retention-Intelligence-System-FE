import { useEffect, useState, type FormEvent } from "react"
import {
  CalendarRange,
  FileSpreadsheet,
  HelpCircle,
  Inbox,
  Plus,
  RefreshCw,
  Search,
  Upload,
  X,
} from "lucide-react"
import { AppShell } from "../components/AppShell"
import { Button, Card, SectionHeader } from "../components/ui"
import { useLanguage } from "../context/LanguageContext"
import { listEmployeeProfiles, type EmployeeProfile } from "../services/api"
import {
  fetchLeaveTypes,
  fetchLeaveRecords,
  fetchLeaveSummary,
  createLeaveRecord,
  updateLeaveRecord,
  transitionLeaveRecord,
  previewLeaveFile,
  confirmLeaveFile,
  attendanceMessage,
  type LeaveType,
  type LeaveRecord,
  type LeaveInput,
  type LeavePreview,
  type LeaveImportResult,
  type RecordFilters,
} from "../services/attendance"
const control =
  "mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
const blank: LeaveInput = {
  employee_id: 0,
  leave_type_id: 0,
  start_date: "",
  end_date: "",
  reason: "",
}
export default function LeaveRecords({ own = false }: { own?: boolean }) {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const [types, setTypes] = useState<LeaveType[]>([]),
    [employees, setEmployees] = useState<EmployeeProfile[]>([]),
    [rows, setRows] = useState<LeaveRecord[]>([])
  const [filters, setFilters] = useState<RecordFilters>({
      record_status: "ACTIVE",
    }),
    [draft, setDraft] = useState<RecordFilters>({ record_status: "ACTIVE" })
  const [form, setForm] = useState(blank),
    [editing, setEditing] = useState<LeaveRecord | null>(null),
    [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<LeavePreview | null>(null),
    [result, setResult] = useState<LeaveImportResult | null>(null)
  const [recordDrawerOpen, setRecordDrawerOpen] = useState(false),
    [importModalOpen, setImportModalOpen] = useState(false),
    [dragging, setDragging] = useState(false)
  const [offset, setOffset] = useState(0),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false)
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [summary, setSummary] = useState<Array<{
      employee_id: number
      leave_type_id: number
      records: number
      total_days: number
      total_hours: null
    }>>([])
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
    if (!own)
      void listEmployeeProfiles({ limit: 100 })
        .then(async (first) => {
          const rest = await Promise.all(Array.from({ length: Math.max(0, first.pagination.totalPages - 1) }, (_, index) => listEmployeeProfiles({ page: index + 2, limit: 100 })))
          if (live) setEmployees([first, ...rest].flatMap(result => result.data))
        })
        .catch((e) => {
          if (live)
            setError(
              attendanceMessage(
                e,
                tr("Không tải được nhân viên.", "Could not load employees."),
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
    void Promise.all([
      fetchLeaveRecords({ ...filters, limit: 20, offset }, own, c.signal),
      own ? Promise.resolve(null) : fetchLeaveSummary(filters, c.signal),
    ])
      .then(([r, s]) => {
        if (!c.signal.aborted) {
          setRows(r.data)
          setSummary(s?.data || [])
        }
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
    return () => c.abort()
  }, [filters, offset, revision, own])
  useEffect(() => {
    if (!recordDrawerOpen && !importModalOpen) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busy) return
      setRecordDrawerOpen(false)
      setImportModalOpen(false)
    }
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [recordDrawerOpen, importModalOpen, busy])
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
  function save(e: FormEvent) {
    e.preventDefault()
    if (form.end_date < form.start_date) {
      setError(
        tr(
          "Ngày kết thúc không được trước ngày bắt đầu.",
          "End date must be on or after start date.",
        ),
      )
      return
    }
    void work(async () => {
      if (editing) await updateLeaveRecord(editing.id, form)
      else await createLeaveRecord(form)
      setForm(blank)
      setEditing(null)
      setRecordDrawerOpen(false)
      setRevision((v) => v + 1)
      setNotice(tr("Đã lưu hồ sơ nghỉ.", "Leave record saved."))
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
  const invalid = !!(draft.from && draft.to && draft.from > draft.to)
  const activeRecordCount = summary.reduce((total, item) => total + item.records, 0)
  const activeDayCount = summary.reduce((total, item) => total + item.total_days, 0)
  const activeEmployeeCount = new Set(summary.map((item) => item.employee_id)).size
  const pageStart = rows.length ? offset + 1 : 0
  const pageEnd = offset + rows.length
  const knownTotal = filters.record_status === "ACTIVE" ? activeRecordCount : null
  return (
    <AppShell
      breadcrumb={["Workforce", own ? "My requests" : "Employee requests"]}
    >
      <SectionHeader
        title={tr(
          own ? "Hồ sơ nghỉ của tôi" : "Hồ sơ nghỉ nhân viên",
          own ? "My leave records" : "Employee leave records",
        )}
        description={tr(
          "Quản lý ngày nghỉ từ dữ liệu nguồn; tách biệt với đơn xin nghỉ và chấm công.",
          "Manage source leave dates separately from legacy requests and attendance.",
        )}
      >
        {!own && (
          <>
            <Button
              variant="secondary"
              onClick={() => setImportModalOpen(true)}
            >
              <Upload size={16} />
              {tr("Nhập Excel / CSV", "Import Excel / CSV")}
            </Button>
            <Button
              onClick={() => {
                setEditing(null)
                setForm(blank)
                setRecordDrawerOpen(true)
              }}
            >
              <Plus size={16} />
              {tr("Ghi nhận nghỉ", "Record leave")}
            </Button>
          </>
        )}
      </SectionHeader>
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mb-4 rounded-xl bg-emerald-50 p-4 text-emerald-800"
        >
          {notice}
        </p>
      )}
      {!own && (
        <>
          {recordDrawerOpen && (
            <div
              className="fixed inset-0 z-[80] bg-slate-950/40 backdrop-blur-[1px]"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !busy)
                  setRecordDrawerOpen(false)
              }}
            >
              <Card className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col overflow-y-auto rounded-none border-0 p-5 shadow-2xl sm:p-6">
            <button
              type="button"
              aria-label={tr("Đóng", "Close")}
              disabled={busy}
              onClick={() => setRecordDrawerOpen(false)}
              className="absolute right-5 top-5 flex size-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <X size={20} />
            </button>
            <h2 className="font-bold">
              {tr(
                editing ? "Sửa hồ sơ nghỉ" : "Ghi nhận nghỉ",
                editing ? "Edit leave record" : "Record leave",
              )}
            </h2>
            <form onSubmit={save}>
              <fieldset
                disabled={busy}
                className="mt-3 grid gap-3 sm:grid-cols-2"
              >
                <label className="text-sm">
                  {tr("Nhân viên", "Employee")}
                  <select
                    required
                    disabled={!!editing}
                    className={control}
                    value={form.employee_id || ""}
                    onChange={(e) =>
                      setForm({ ...form, employee_id: Number(e.target.value) })
                    }
                  >
                    <option value="">
                      {tr("Chọn nhân viên", "Select employee")}
                    </option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.employeeCode} · {e.fullName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  {tr("Loại nghỉ", "Leave type")}
                  <select
                    required
                    className={control}
                    value={form.leave_type_id || ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        leave_type_id: Number(e.target.value),
                      })
                    }
                  >
                    <option value="">
                      {tr("Chọn loại nghỉ", "Select leave type")}
                    </option>
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} · {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset className="sm:col-span-2">
                  <legend className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <CalendarRange size={16} className="text-orange-500" />
                    {tr("Khoảng ngày nghỉ", "Leave date range")}
                    <span
                      title={tr(
                        "Ghi nhận theo trọn ngày công; không tự quy đổi thành giờ nghỉ hoặc ghi sang chấm công.",
                        "Recorded as whole work dates; hours and attendance rows are not inferred.",
                      )}
                      className="inline-flex cursor-help text-slate-500"
                    >
                      <HelpCircle size={15} />
                    </span>
                  </legend>
                  <div className="mt-1 grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-medium text-slate-600">
                      {tr("Từ ngày", "From")}
                      <input
                        type="date"
                        required
                        className={control}
                        value={form.start_date}
                        onChange={(event) =>
                          setForm({ ...form, start_date: event.target.value })
                        }
                      />
                    </label>
                    <label className="text-sm font-medium text-slate-600">
                      {tr("Đến ngày", "To")}
                      <input
                        type="date"
                        required
                        min={form.start_date}
                        className={control}
                        value={form.end_date}
                        onChange={(event) =>
                          setForm({ ...form, end_date: event.target.value })
                        }
                      />
                    </label>
                  </div>
                </fieldset>
                <label className="text-sm sm:col-span-2">
                  {tr("Lý do (không bắt buộc)", "Reason (optional)")}
                  <textarea
                    rows={2}
                    className={`${control} h-auto min-h-20 py-3`}
                    value={form.reason || ""}
                    onChange={(e) =>
                      setForm({ ...form, reason: e.target.value })
                    }
                  />
                </label>
                <div className="flex gap-2">
                  <Button
                    disabled={!form.employee_id || !form.leave_type_id}
                    type="submit"
                  >
                    {tr("Lưu hồ sơ", "Save record")}
                  </Button>
                  {editing && (
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => {
                        setEditing(null)
                        setForm(blank)
                      }}
                    >
                      {tr("Hủy chỉnh sửa", "Cancel editing")}
                    </Button>
                  )}
                </div>
              </fieldset>
            </form>
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
                    <FileSpreadsheet size={16} className="shrink-0 text-emerald-600" />
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
                  className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900"
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
                            {r.status} {r.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                      setResult(
                        await confirmLeaveFile(file, preview.fingerprint),
                      )
                      setRevision((v) => v + 1)
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
      {!own && (
        <section className="mb-4">
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
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              [tr("Hồ sơ hợp lệ", "Valid records"), activeRecordCount],
              [tr("Nhân viên có nghỉ", "Employees on leave"), activeEmployeeCount],
              [tr("Tổng ngày nghỉ", "Total leave days"), activeDayCount],
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
      <Card className="mb-0 rounded-b-none border-b-0 p-5 shadow-none">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!invalid) {
              setFilters({ ...draft })
              setOffset(0)
            }
          }}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] xl:items-end"
        >
          <label className="text-sm">
            {tr("Từ ngày", "From date")}
            <input
              type="date"
              className={control}
              value={draft.from || ""}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
          </label>
          <label className="text-sm">
            {tr("Đến ngày", "To date")}
            <input
              type="date"
              className={control}
              value={draft.to || ""}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
          </label>
          {!own && (
            <label className="text-sm">
              {tr("ID nhân viên (trống: tất cả)", "Employee ID (blank: all)")}
              <input
                type="number"
                min="1"
                className={control}
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
              <option value="ACTIVE">{tr("Đang dùng", "Active")}</option>
              <option value="CANCEL">{tr("Đã hủy", "Cancelled")}</option>
              <option value="ALL">{tr("Tất cả", "All")}</option>
            </select>
          </label>
          <Button type="submit" disabled={invalid || loading}>
            <Search size={16} />
            {tr("Lọc", "Filter")}
          </Button>
          {invalid && (
            <p role="alert" className="text-red-700 xl:col-span-6">
              {tr("Khoảng ngày không hợp lệ.", "Invalid date range.")}
            </p>
          )}
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={() => setRevision((v) => v + 1)}
          >
            <RefreshCw size={16} />
            {tr("Tải lại", "Refresh")}
          </Button>
        </form>
      </Card>
      <Card className="rounded-t-none p-5">
        {loading ? (
          <p role="status">{tr("Đang tải…", "Loading…")}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-left text-sm">
                <thead>
                  <tr>
                    {[
                      tr("Nhân viên", "Employee"),
                      tr("Loại nghỉ", "Leave type"),
                      tr("Ngày nghỉ", "Leave dates"),
                      tr("Lý do", "Reason"),
                      tr("Trạng thái", "Status"),
                      tr("Thao tác", "Actions"),
                    ].map((h) => (
                      <th key={h} className="p-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="p-3">
                        {r.employee_code || r.employee_id}
                      </td>
                      <td className="p-3">
                        {r.leave_type} · {r.leave_type_name}
                      </td>
                      <td className="p-3">
                        {r.start_date} → {r.end_date}
                      </td>
                      <td className="max-w-xs whitespace-normal break-words p-3">
                        {r.reason || "—"}
                      </td>
                      <td className="p-3">
                        {r.record_status === "ACTIVE"
                          ? tr("Đang dùng", "Active")
                          : tr("Đã hủy", "Cancelled")}
                      </td>
                      <td className="p-3">
                        {!own && (
                          <div className="flex gap-2">
                            {r.record_status === "ACTIVE" && (
                              <Button
                                variant="warning"
                                disabled={busy}
                                onClick={() => {
                                  setEditing(r)
                                  setForm({
                                    employee_id: r.employee_id,
                                    leave_type_id: r.leave_type_id,
                                    start_date: r.start_date,
                                    end_date: r.end_date,
                                    reason: r.reason,
                                  })
                                  setRecordDrawerOpen(true)
                                }}
                              >
                                {tr("Chỉnh sửa", "Edit")}
                              </Button>
                            )}
                            <Button
                              variant={
                                r.record_status === "ACTIVE"
                                  ? "danger"
                                  : "success"
                              }
                              disabled={busy}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    tr(
                                      "Xác nhận hủy/khôi phục hồ sơ nghỉ này?",
                                      "Confirm cancellation/restoration of this leave record?",
                                    ),
                                  )
                                )
                                  void work(async () => {
                                    await transitionLeaveRecord(
                                      r.id,
                                      r.record_status === "ACTIVE"
                                        ? "cancel"
                                        : "restore",
                                    )
                                    setEditing(null)
                                    setForm(blank)
                                    setRevision((v) => v + 1)
                                    setNotice(
                                      tr(
                                        "Đã cập nhật trạng thái nghỉ.",
                                        "Leave status updated.",
                                      ),
                                    )
                                  })
                              }}
                            >
                              {r.record_status === "ACTIVE"
                                ? tr("Hủy", "Cancel")
                                : tr("Khôi phục", "Restore")}
                            </Button>
                          </div>
                        )}
                        <details className="mt-2 text-xs text-slate-500">
                          <summary>
                            {tr("Thông tin ghi nhận", "Recording metadata")}
                          </summary>
                          <p>
                            {tr("Người ghi nhận", "Recorded by")}:{" "}
                            {r.recorded_by ?? "—"}
                          </p>
                          <p>
                            {r.created_at} · {r.updated_at}
                          </p>
                          <p>
                            {tr(
                              "API không cung cấp lịch sử sửa chi tiết cho hồ sơ nghỉ.",
                              "This API does not provide detailed leave edit history.",
                            )}
                          </p>
                        </details>
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
                  {tr(
                    "Chưa có hồ sơ trong bộ lọc này.",
                    "No records match these filters.",
                  )}
                </p>
                {!own && (
                  <Button
                    className="mt-4"
                    onClick={() => {
                      setEditing(null)
                      setForm(blank)
                      setRecordDrawerOpen(true)
                    }}
                  >
                    <Plus size={16} />
                    {tr(
                      "Tạo hồ sơ nghỉ đầu tiên",
                      "Create the first leave record",
                    )}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-slate-600">
            {tr("Hiển thị", "Showing")} {pageStart} - {pageEnd}
            {knownTotal !== null && (
              <> {tr("trên tổng", "of")} {knownTotal}</>
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
      </Card>
    </AppShell>
  )
}
