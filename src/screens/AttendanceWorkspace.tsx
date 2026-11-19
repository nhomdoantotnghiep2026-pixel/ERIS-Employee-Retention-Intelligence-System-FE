import { useEffect, useState, type FormEvent } from "react"
import { Inbox, RotateCcw, Search } from "lucide-react"
import { AppShell } from "../components/AppShell"
import { Button, Card, SectionHeader } from "../components/ui"
import AttendanceImport from "../components/AttendanceImport"
import AttendanceReconcile from "../components/AttendanceReconcile"
import { useLanguage } from "../context/LanguageContext"
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
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const [filters, setFilters] = useState<RecordFilters>({
      record_status: "ACTIVE",
    }),
    [draft, setDraft] = useState<RecordFilters>({ record_status: "ACTIVE" })
  const [rows, setRows] = useState<ImportedAttendance[]>([]),
    [summary, setSummary] = useState<AttendanceSummary | null>(null)
  const [selected, setSelected] = useState<ImportedAttendance | null>(null),
    [logs, setLogs] = useState<AttendanceAudit[]>([]),
    [logOffset, setLogOffset] = useState(0)
  const [offset, setOffset] = useState(0),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false)
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [logError, setLogError] = useState("")
  const [reason, setReason] = useState("")
  useEffect(() => {
    const c = new AbortController()
    setLoading(true)
    setError("")
    setRows([])
    setSummary(null)
    void Promise.all([
      fetchAttendance({ ...filters, limit: 20, offset }, own, c.signal),
      own ? Promise.resolve(null) : fetchAttendanceSummary(filters, c.signal),
    ])
      .then(([r, s]) => {
        if (!c.signal.aborted) {
          setRows(r.data)
          setSummary(s?.data || null)
        }
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
    return () => c.abort()
  }, [filters, offset, revision, own])
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
  return (
    <AppShell
      breadcrumb={["Workforce", own ? "My Attendance" : "Attendance history"]}
    >
      <SectionHeader
        title={tr(
          own ? "Chấm công của tôi" : "Quản lý chấm công",
          own ? "My attendance" : "Attendance management",
        )}
        description={tr(
          "Dữ liệu nguồn được kiểm tra trước khi lưu. Không suy ra ngày vắng từ dữ liệu bị thiếu.",
          "Source data is reviewed before saving. Missing data does not imply absence.",
        )}
      >
        <Button
          variant="secondary"
          disabled={loading || busy}
          onClick={() => {
            setSelected(null)
            setRevision((v) => v + 1)
          }}
        >
          {tr("Tải lại", "Refresh")}
        </Button>
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
        <><AttendanceImport onImported={() => { setOffset(0); setRevision((v) => v + 1) }}/><AttendanceReconcile onSaved={() => { setOffset(0); setRevision((v) => v + 1) }}/></>
      )}
      <Card className="mb-4 p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!invalid) {
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
      {summary && (
        <Card className="mb-4 p-5">
          <h2 className="font-bold">
            {tr(
              "Tổng hợp bản ghi đang sử dụng trong bộ lọc",
              "Summary of active records within filters",
            )}
          </h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [tr("Ngày có bản ghi", "Recorded days"), summary.recorded_days],
              [
                tr("Phút công thực tế", "Work minutes"),
                summary.working_minutes,
              ],
              [tr("Phút đi muộn", "Late minutes"), summary.late_mins],
              [tr("Phút về sớm", "Early minutes"), summary.early_mins],
              [
                tr("Phút tăng ca được ghi nhận", "Recorded overtime minutes"),
                summary.overtime_minutes,
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-50 p-3">
                <dt className="text-sm text-slate-600">{label}</dt>
                <dd className="mt-1 text-xl font-bold">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-slate-500">
            {tr(
              "Tổng hợp chỉ tính bản ghi đang sử dụng, không phải số ngày phải đi làm.",
              "Summary includes active records only, not expected work days.",
            )}
          </p>
        </Card>
      )}
      {selected && (
        <Card className="mb-4 p-5">
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
      )}
      <Card className="p-5">
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
            {rows.length} {tr("bản ghi", "records")}
          </span>
        </div>
        {loading ? (
          <p role="status">{tr("Đang tải…", "Loading…")}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
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
                        {r.record_status === "CANCEL"
                          ? tr("Đã hủy", "Cancelled")
                          : tr("Đang dùng", "Active")}
                      </td>
                      <td className="p-3">
                        <Button
                          variant="info"
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
                  {tr(
                    "Không có bản ghi trong bộ lọc này.",
                    "No records match these filters.",
                  )}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-600">
                  {tr(
                    "Hãy tải tệp chấm công lên hoặc thay đổi điều kiện lọc.",
                    "Upload an attendance file or change the filters.",
                  )}
                </p>
              </div>
            )}
          </>
        )}
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm">
            {tr("Trang chấm công", "Attendance page")} {offset / 20 + 1}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={loading || offset === 0}
              onClick={() => setOffset(Math.max(0, offset - 20))}
            >
              {tr("Trước", "Previous")}
            </Button>
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
