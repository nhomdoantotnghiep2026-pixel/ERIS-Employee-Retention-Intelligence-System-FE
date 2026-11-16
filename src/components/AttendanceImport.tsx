import { ApiError } from "../services/api"

import { useEffect, useState, type FormEvent } from "react"
import { Button, Card } from "./ui"
import { useLanguage } from "../context/LanguageContext"
import {
  previewAttendance,
  fetchAttendanceBatch,
  resolveAttendanceRow,
  confirmAttendance,
  attendanceBatches,
  attendanceErrors,
  batchBlocked,
  attendanceMessage,
  saveDownload,
  type AttendanceBatch,
  type BatchHistory,
  type ConfirmResult,
} from "../services/attendance"

export default function AttendanceImport({
  onImported,
}: {
  onImported: () => void
}) {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const [file, setFile] = useState<File | null>(null),
    [batch, setBatch] = useState<AttendanceBatch | null>(null)
  const [history, setHistory] = useState<BatchHistory[]>([]),
    [offset, setOffset] = useState(0),
    [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ack, setAck] = useState(false)
  const [reasons, setReasons] = useState<Record<number, string>>({}),
    [result, setResult] = useState<ConfirmResult | null>(null)
  const [stale, setStale] = useState(false)

  const [updates, setUpdates] = useState<Record<number, boolean>>({}),
    [historyError, setHistoryError] = useState("")
  useEffect(() => {
    let live = true
    setHistoryError("")
    void attendanceBatches(offset)
      .then((r) => {
        if (live) setHistory(r.data)
      })
      .catch((e) => {
        if (live)
          setHistoryError(
            attendanceMessage(
              e,
              tr(
                "Không tải được lịch sử nhập.",
                "Could not load import history.",
              ),
            ),
          )
      })
    return () => {
      live = false
    }
  }, [offset, revision])
  function accept(b: AttendanceBatch, recalculated = false) {
    if (recalculated || b.batch_id !== batch?.batch_id) setStale(false)
    setBatch(b)
    setAck(false)
    setReasons({})
    setUpdates({})
    setResult(b.result || null)
  }
  async function work(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError("")
    try {
      await action()
    } catch (e) {
      if (e instanceof ApiError && e.code === "STALE_PREVIEW") setStale(true)
      setError(
        attendanceMessage(
          e,
          tr(
            "Không thực hiện được thao tác nhập.",
            "Could not complete import action.",
          ),
        ),
      )
    } finally {
      setBusy(false)
    }
  }
  function upload(e: FormEvent) {
    e.preventDefault()
    if (!file) return
    if (
      !/\.xlsx$/i.test(file.name) ||
      !file.size ||
      file.size > 10 * 1024 * 1024
    ) {
      setError(
        tr(
          "Chọn tệp XLSX không rỗng, tối đa 10 MiB.",
          "Choose a nonempty XLSX file, maximum 10 MiB.",
        ),
      )
      return
    }
    void work(async () => {
      accept(await previewAttendance(file), true)
      setRevision((v) => v + 1)
    })
  }
  const included =
    batch?.rows.filter(
      (r) =>
        !r.excluded && !["NO_DATA", "INCOMPLETE"].includes(r.validation_status),
    ) || []
  const warnings = included.some((r) =>
    r.issues.some((i) => i.severity === "WARNING"),
  )
  const missingReason = included.some(
    (r) => updates[r.excel_row] && !reasons[r.excel_row]?.trim(),
  )
  const locked = !batch || batch.expired || batch.status === "CONFIRMED"
  async function confirm() {
    if (!batch) return
    const b = batch
    await work(async () => {
      const r = await confirmAttendance(b.batch_id, {
        duplicate_strategy: "SKIP",
        confirm_warnings: ack,
        updates: included
          .filter((r) => r.action === "CHANGED" && updates[r.excel_row])
          .map((r) => ({
            excel_row: r.excel_row,
            action: "UPDATE",
            reason: reasons[r.excel_row].trim(),
          })),
      })
      setResult(r)
      setBatch({ ...b, status: "CONFIRMED", result: r })
      setRevision((v) => v + 1)
      onImported()
    })
  }
  const status = (s: string) =>
    ({
      VALID: tr("Hợp lệ", "Valid"),
      WARNING: tr("Cảnh báo", "Warning"),
      ERROR: tr("Lỗi", "Error"),
      NO_DATA: tr("Không có dữ liệu", "No data"),
      INCOMPLETE: tr("Thiếu giờ", "Incomplete"),
      DUPLICATE: tr("Trùng", "Duplicate"),
      CONFIRMED: tr("Đã lưu", "Confirmed"),
      READY: tr("Sẵn sàng", "Ready"),
      PREVIEWED: tr("Cần xử lý", "Needs review"),
    })[s] || s
  return (
    <Card className="mb-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">
          {tr(
            "Nhập chấm công · Xem trước và xác nhận",
            "Import attendance · Preview and confirm",
          )}
        </h2>
        <a
          href="/templates/ERIS_Attendance_Import_Template.xlsx"
          download
          className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800"
        >
          {tr("Tải tệp mẫu", "Download template")}
        </a>
      </div>
      <p className="mt-3 text-sm text-slate-600">
        {tr(
          "Tệp XLSX tối đa 10 MiB, 10.000 dòng. Cột: employee_code, employee_name (không bắt buộc), shift_type, check_in, check_out. Giờ theo Việt Nam: YYYY-MM-DD HH:mm:ss. Chọn mã ca đang hoạt động; không cần gán ca đó cho nhân viên trước khi nhập.",
          "XLSX up to 10 MiB and 10,000 rows. Columns: employee_code, optional employee_name, shift_type, check_in, check_out. Vietnam local times: YYYY-MM-DD HH:mm:ss. Use an active shift code; employee assignment is not required for import.",
        )}
      </p>
      <p className="mt-2 text-sm text-amber-900">
        {tr(
          "Xem trước chưa lưu chấm công. Thiếu giờ không được coi là vắng mặt. Thời gian ngoài ca được tính riêng, không tự chuyển thành tăng ca. Ca qua đêm dùng ngày bắt đầu ca.",
          "Preview does not save attendance. Missing times do not imply absence. Outside-shift time is separate and is not automatically overtime. Overnight records use the shift start date.",
        )}
      </p>
      <form onSubmit={upload} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-sm">
          {tr("Tệp chấm công (.xlsx)", "Attendance file (.xlsx)")}
          <input
            type="file"
            accept=".xlsx"
            required
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] || null)
              setError("")
            }}
            className="mt-1 block w-full rounded-xl border border-slate-300 p-3"
          />
        </label>
        <Button disabled={busy || !file} type="submit">
          {tr(
            busy ? "Đang xử lý…" : "Tạo bản xem trước",
            busy ? "Processing…" : "Preview file",
          )}
        </Button>
      </form>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {batch && (
        <section className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold">
              {tr("Đợt nhập", "Batch")} · {status(batch.status)}
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="info"
                disabled={busy}
                onClick={() =>
                  void work(async () =>
                    accept(await fetchAttendanceBatch(batch.batch_id)),
                  )
                }
              >
                {tr("Tải lại bản xem trước", "Reload preview")}
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  void work(async () =>
                    saveDownload(
                      await attendanceErrors(batch.batch_id),
                      "attendance-errors.xlsx",
                    ),
                  )
                }
              >
                {tr("Tải lỗi Excel", "Download issues")}
              </Button>
            </div>
          </div>
          <p className="mt-2 break-all text-xs text-slate-500">
            {batch.batch_id} · {tr("Hết hạn", "Expires")}:{" "}
            {new Date(batch.expires_at).toLocaleString(
              language === "vi" ? "vi-VN" : "en-US",
              { timeZone: "Asia/Ho_Chi_Minh" },
            )}
          </p>
          {stale && (
            <p className="mt-2 text-red-800">
              {tr(
                "Bản xem trước không còn khớp dữ liệu. Tải tệp lên lại trước khi xác nhận.",
                "Preview is stale. Upload the file again before confirming.",
              )}
            </p>
          )}
          {batch.expired && (
            <p className="mt-2 text-red-800">
              {tr(
                "Bản xem trước đã hết hạn. Tải tệp lên lại.",
                "Preview expired. Upload again.",
              )}
            </p>
          )}
          <div className="mt-3 max-h-[36rem] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    tr("Dòng / nhân viên", "Row / employee"),
                    tr("Ca và ngày công", "Shift and work date"),
                    tr("Giờ vào / ra", "Check in / out"),
                    tr("Kết quả / xử lý", "Result / decision"),
                  ].map((h) => (
                    <th key={h} className="p-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batch.rows.map((r) => (
                  <tr key={r.excel_row} className="border-b border-slate-100">
                    <td className="p-3 align-top">
                      #{r.excel_row} · {r.employee_code}
                      <p>{r.full_name}</p>
                      <strong
                        className={
                          r.validation_status === "ERROR"
                            ? "text-red-700"
                            : "text-blue-800"
                        }
                      >
                        {status(r.validation_status)}
                      </strong>
                    </td>
                    <td className="p-3 align-top">
                      {r.shift_type}
                      <p>{r.work_date || "—"}</p>
                      {(r.candidates?.length || 0) > 1 && (
                        <label className="mt-2 block">
                          {tr(
                            "Chọn ngày bắt đầu ca",
                            "Choose shift start date",
                          )}
                          <select
                            aria-label={
                              tr("Ngày ca dòng ", "Shift date row ") +
                              r.excel_row
                            }
                            disabled={busy || locked}
                            className="mt-1 rounded-lg border p-2"
                            value={r.work_date || ""}
                            onChange={(e) =>
                              void work(async () =>
                                accept(
                                  await resolveAttendanceRow(
                                    batch.batch_id,
                                    r.excel_row,
                                    { work_date: e.target.value },
                                  ),
                                  true,
                                ),
                              )
                            }
                          >
                            <option value="">
                              {tr("Chọn ngày", "Select date")}
                            </option>
                            {r.candidates!.map((d) => (
                              <option key={d}>{d}</option>
                            ))}
                          </select>
                        </label>
                      )}
                    </td>
                    <td className="p-3 align-top">
                      <p className="whitespace-nowrap">{r.check_in || "—"}</p>
                      <p className="whitespace-nowrap">{r.check_out || "—"}</p>
                      <p>
                        {tr("Phút công", "Work minutes")}:{" "}
                        {r.working_minutes ?? "—"} · {tr("Muộn", "Late")}:{" "}
                        {r.late_mins ?? "—"} · {tr("Sớm", "Early")}:{" "}
                        {r.early_mins ?? "—"}
                      </p>
                      <p>
                        {tr("Ngoài ca", "Outside shift")}:{" "}
                        {r.outside_shift_minutes ?? "—"}
                      </p>
                    </td>
                    <td className="min-w-64 p-3 align-top">
                      {r.issues.map((i, k) => (
                        <p
                          key={k}
                          className={
                            i.severity === "ERROR"
                              ? "text-red-700"
                              : i.severity === "WARNING"
                                ? "text-amber-900"
                                : "text-slate-600"
                          }
                        >
                          {i.code}: {i.message}
                        </p>
                      ))}
                      <label className="mt-2 flex gap-2">
                        <input
                          type="checkbox"
                          disabled={busy || locked}
                          checked={!!r.excluded}
                          onChange={(e) =>
                            void work(async () =>
                              accept(
                                await resolveAttendanceRow(
                                  batch.batch_id,
                                  r.excel_row,
                                  { exclude: e.target.checked },
                                ),
                                true,
                              ),
                            )
                          }
                        />
                        {tr("Loại dòng này", "Exclude row")}
                      </label>
                      {r.previous && (
                        <details className="mt-2">
                          <summary className="cursor-pointer font-semibold text-blue-800">
                            {tr("So sánh bản cũ", "Compare existing record")}
                          </summary>
                          <p>
                            {tr("Giờ cũ", "Previous times")}:{" "}
                            {r.previous.check_in} → {r.previous.check_out}
                          </p>
                          <p>
                            {tr("Phút công cũ", "Previous work minutes")}:{" "}
                            {r.previous.working_minutes} ·{" "}
                            {tr("Phiên bản", "Version")}: {r.previous.version}
                          </p>
                        </details>
                      )}
                      {r.action === "CHANGED" && !r.excluded && (
                        <div className="mt-2">
                          <label className="flex gap-2">
                            <input
                              type="checkbox"
                              disabled={busy || locked}
                              checked={!!updates[r.excel_row]}
                              onChange={(e) =>
                                setUpdates({
                                  ...updates,
                                  [r.excel_row]: e.target.checked,
                                })
                              }
                            />
                            {tr(
                              "Cập nhật bản cũ thay vì bỏ qua",
                              "Update existing instead of skipping",
                            )}
                          </label>
                          {updates[r.excel_row] && (
                            <label className="mt-2 block">
                              {tr("Lý do cập nhật", "Update reason")}
                              <input
                                aria-label={
                                  tr("Lý do dòng ", "Reason row ") + r.excel_row
                                }
                                disabled={busy || locked}
                                maxLength={1000}
                                className="mt-1 w-full rounded-lg border p-2"
                                value={reasons[r.excel_row] || ""}
                                onChange={(e) =>
                                  setReasons({
                                    ...reasons,
                                    [r.excel_row]: e.target.value,
                                  })
                                }
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {warnings && (
            <label className="mt-4 flex gap-2 text-sm">
              <input
                type="checkbox"
                disabled={busy || locked}
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />
              {tr(
                "Tôi đã đọc và chấp nhận các cảnh báo của bản xem trước này.",
                "I have reviewed and acknowledged the warnings in this preview.",
              )}
            </label>
          )}
          <p className="mt-3 text-sm text-slate-600">
            {tr(
              "Dòng lỗi phải được xử lý hoặc loại. Dòng thiếu giờ bị loại; bản trùng giống hệt bị bỏ qua. Dòng thay đổi chỉ được cập nhật khi chọn và nhập lý do.",
              "Resolve or exclude errors. Incomplete rows are excluded; identical duplicates are skipped. Changed duplicates update only when selected with a reason.",
            )}
          </p>
          <Button
            className="mt-3"
            disabled={
              busy ||
              stale ||
              !batch ||
              batchBlocked(batch) ||
              missingReason ||
              (warnings && !ack)
            }
            onClick={() => {
              if (
                window.confirm(
                  tr(
                    "Xác nhận lưu các quyết định trong bản xem trước này?",
                    "Confirm and save these preview decisions?",
                  ),
                )
              )
                void confirm()
            }}
          >
            {tr("Xác nhận lưu chấm công", "Confirm attendance import")}
          </Button>
          {result && (
            <p
              role="status"
              className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"
            >
              {tr("Đã lưu đợt nhập. Mới", "Batch confirmed. Inserted")}:{" "}
              {result.inserted} · {tr("Cập nhật", "Updated")}: {result.updated}{" "}
              · {tr("Bỏ qua", "Skipped")}: {result.skipped} ·{" "}
              {tr("Loại", "Excluded")}: {result.excluded}
            </p>
          )}
        </section>
      )}
      <details className="mt-5 border-t border-slate-100 pt-4">
        <summary className="cursor-pointer font-semibold">
          {tr("Lịch sử đợt nhập", "Import batch history")}
        </summary>
        {historyError && (
          <p role="alert" className="mt-2 text-red-700">
            {historyError}
          </p>
        )}
        <Button
          className="mt-2"
          variant="secondary"
          disabled={busy}
          onClick={() => setRevision((v) => v + 1)}
        >
          {tr("Tải lại lịch sử", "Refresh history")}
        </Button>
        <ul className="mt-3 space-y-2">
          {history.map((h) => (
            <li
              key={h.batch_id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm"
            >
              <span className="break-all">
                {h.filename} · {status(h.status)} ·{" "}
                {new Date(h.created_at).toLocaleString(
                  language === "vi" ? "vi-VN" : "en-US",
                  { timeZone: "Asia/Ho_Chi_Minh" },
                )}
              </span>
              <Button
                variant="info"
                disabled={busy}
                onClick={() =>
                  void work(async () =>
                    accept(await fetchAttendanceBatch(h.batch_id)),
                  )
                }
              >
                {tr("Xem đợt nhập", "Open batch")}
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <Button
            variant="secondary"
            disabled={busy || offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 10))}
          >
            {tr("Trước", "Previous")}
          </Button>
          <Button
            variant="secondary"
            disabled={busy || history.length < 10}
            onClick={() => setOffset(offset + 10)}
          >
            {tr("Trang sau", "Next page")}
          </Button>
        </div>
      </details>
    </Card>
  )
}
