import { useEffect, useState, type FormEvent } from "react"
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
  "mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
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
  const [offset, setOffset] = useState(0),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false)
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [summary, setSummary] = useState<Array<{
      employee_id: number
      leave_type_id: number
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
      void listEmployeeProfiles({ limit: 100000 })
        .then((r) => {
          if (live) setEmployees(r.data)
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
  const invalid = !!(draft.from && draft.to && draft.from > draft.to)
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
      />
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
          <Card className="mb-4 p-5">
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
                <label className="text-sm">
                  {tr("Ngày bắt đầu", "Start date")}
                  <input
                    type="date"
                    required
                    className={control}
                    value={form.start_date}
                    onChange={(e) =>
                      setForm({ ...form, start_date: e.target.value })
                    }
                  />
                </label>
                <label className="text-sm">
                  {tr("Ngày kết thúc", "End date")}
                  <input
                    type="date"
                    required
                    min={form.start_date}
                    className={control}
                    value={form.end_date}
                    onChange={(e) =>
                      setForm({ ...form, end_date: e.target.value })
                    }
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  {tr("Lý do (không bắt buộc)", "Reason (optional)")}
                  <textarea
                    className={control}
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
            <p className="mt-3 text-sm text-slate-500">
              {tr(
                "Ghi nhận theo trọn ngày công, có thể là dữ liệu quá khứ. Ca đêm dùng ngày bắt đầu ca. Không tự quy đổi thành giờ nghỉ hoặc ghi sang chấm công.",
                "Whole work dates, including historical records. Overnight leave uses the shift start date. No hours or attendance rows are inferred.",
              )}
            </p>
          </Card>
          <Card className="mb-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold">
                {tr(
                  "Nhập hồ sơ nghỉ Excel / CSV",
                  "Import leave records from Excel / CSV",
                )}
              </h2>
              <a
                href="/templates/ERIS_Leave_Records_Template.csv"
                download
                className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800"
              >
                {tr("Tải mẫu CSV", "Download CSV template")}
              </a>
            </div>
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
            <form
              onSubmit={upload}
              className="mt-3 flex flex-wrap items-end gap-3"
            >
              <label className="min-w-0 flex-1 text-sm">
                {tr("Tệp hồ sơ nghỉ", "Leave file")}
                <input
                  type="file"
                  required
                  accept=".xlsx,.csv"
                  disabled={busy}
                  className={control}
                  onChange={(e) => {
                    setFile(e.target.files?.[0] || null)
                    setPreview(null)
                    setResult(null)
                  }}
                />
              </label>
              <Button type="submit" disabled={busy || !file}>
                {tr("Xem trước tệp nghỉ", "Preview leave file")}
              </Button>
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
        </>
      )}
      <Card className="mb-4 p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!invalid) {
              setFilters({ ...draft })
              setOffset(0)
            }
          }}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
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
            {tr("Lọc hồ sơ", "Apply filters")}
          </Button>
          {invalid && (
            <p role="alert" className="text-red-700">
              {tr("Khoảng ngày không hợp lệ.", "Invalid date range.")}
            </p>
          )}
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={() => setRevision((v) => v + 1)}
          >
            {tr("Tải lại", "Refresh")}
          </Button>
        </form>
      </Card>
      {!own && (
        <Card className="mb-4 p-5">
          <h2 className="font-bold">
            {tr("Tổng hợp nghỉ đang có hiệu lực", "Active leave summary")}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {tr(
              "Chỉ tính các ngày giao với bộ lọc. Chưa có dữ liệu ca/ngày đáng tin cậy nên tổng giờ để trống.",
              "Counts only dates overlapping the filters. Total hours are unavailable without reliable employee/day schedules.",
            )}
          </p>
          <ul className="mt-3 space-y-2">
            {summary.map((s) => (
              <li
                key={s.employee_id + ":" + s.leave_type_id}
                className="text-sm"
              >
                {employees.find((e) => e.id === s.employee_id)?.employeeCode ||
                  s.employee_id}{" "}
                ·{" "}
                {types.find((t) => t.id === s.leave_type_id)?.code ||
                  s.leave_type_id}
                : {s.total_days} {tr("ngày", "days")} · {tr("Giờ", "Hours")}: —
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card className="p-5">
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
                                  window.scrollTo({
                                    top: 0,
                                    behavior: "smooth",
                                  })
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
              <p className="py-4 text-slate-500">
                {tr(
                  "Chưa có hồ sơ trong bộ lọc này.",
                  "No records match these filters.",
                )}
              </p>
            )}
          </>
        )}
        <div className="mt-4 flex gap-2">
          <Button
            variant="secondary"
            disabled={loading || !offset}
            onClick={() => setOffset(Math.max(0, offset - 20))}
          >
            {tr("Trước", "Previous")}
          </Button>
          <span className="p-2">{offset / 20 + 1}</span>
          <Button
            variant="secondary"
            disabled={loading || rows.length < 20}
            onClick={() => setOffset(offset + 20)}
          >
            {tr("Trang sau", "Next page")}
          </Button>
        </div>
      </Card>
    </AppShell>
  )
}
