import { SelectControl } from "./ui/select-control"
import { useAutoDismissState } from '../hooks/useAutoDismissState';
import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Button } from "./ui"
import { useLanguage } from "../context/LanguageContext"
import { listDepartments, listEmployeeProfiles, type EmployeeProfile } from "../services/api"
import {
  attendanceMessage,
  confirmAttendanceReconcile,
  previewAttendanceReconcile,
  type ReconcilePreview,
  type ReconcileScope,
} from "../services/attendance"

const control =
  "mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100"

interface AttendanceReconcileProps {
  onSaved: (result: { inserted: number; kept: number }) => void
  onBusyChange?: (busy: boolean) => void
}

export default function AttendanceReconcile({ onSaved, onBusyChange }: AttendanceReconcileProps) {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [employees, setEmployees] = useState<EmployeeProfile[]>([])
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([])
  const [employeeSearch, setEmployeeSearch] = useState("")
  const [departmentId, setDepartmentId] = useState("")
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([])
  const [employeesLoading, setEmployeesLoading] = useState(true)
  const [preview, setPreview] = useState<ReconcilePreview | null>(null)
  const [ack, setAck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useAutoDismissState()

  useEffect(() => {
    const controller = new AbortController()
    setEmployeesLoading(true)
    void listEmployeeProfiles({ limit: 100 }, controller.signal)
      .then(async (first) => {
        const rest = await Promise.all(
          Array.from({ length: Math.max(0, first.pagination.totalPages - 1) }, (_, index) =>
            listEmployeeProfiles({ page: index + 2, limit: 100 }, controller.signal),
          ),
        )
        if (!controller.signal.aborted) {
          setEmployees(
            [first, ...rest]
              .flatMap((result) => result.data)
              .filter((employee) => employee.employmentStatus === "ACTIVE"),
          )
        }
      })
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setError(attendanceMessage(caught, tr("Không tải được danh sách nhân viên.", "Could not load employees.")))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setEmployeesLoading(false)
      })
    void listDepartments(controller.signal, { limit: 1000 })
      .then((response) => { if (!controller.signal.aborted) setDepartments(response.data) })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  const filteredEmployees = useMemo(() => {
    const term = employeeSearch.trim().toLocaleLowerCase(language === "vi" ? "vi" : "en")
    return employees.filter((employee) => {
      const matchesDepartment = !departmentId || String(employee.departmentId) === departmentId
      const matchesSearch = !term || `${employee.employeeCode} ${employee.fullName}`.toLocaleLowerCase(language === "vi" ? "vi" : "en").includes(term)
      return matchesDepartment && matchesSearch
    })
  }, [departmentId, employeeSearch, employees, language])

  const scope = (): ReconcileScope => ({
    from,
    to,
    employee_ids: selectedEmployeeIds,
  })

  async function run(task: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    onBusyChange?.(true)
    setError("")
    try {
      await task()
    } catch (caught) {
      setError(attendanceMessage(caught, tr("Không thể đối soát dữ liệu.", "Could not reconcile attendance.")))
    } finally {
      setBusy(false)
      onBusyChange?.(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const value = scope()
    if (!from || !to || from > to || !value.employee_ids.length) {
      setError(
        tr(
          "Chọn khoảng ngày hợp lệ và ít nhất một nhân viên.",
          "Choose valid dates and at least one employee.",
        ),
      )
      return
    }
    void run(async () => {
      setPreview(await previewAttendanceReconcile(value))
      setAck(false)
    })
  }

  const warnings = !!preview?.rows.some((row) => row.warning)
  const actionLabel = (action: string) => {
    const labels: Record<string, string> = {
      INSERT: tr("Thêm mới", "Insert"),
      KEEP: tr("Giữ nguyên", "Keep"),
      ERROR: tr("Không thể xử lý", "Error"),
    }
    return labels[action] ?? action
  }
  const statusLabel = (status?: string) => {
    if (status === "HOLIDAY") return tr("Ngày lễ", "Holiday")
    if (status === "ON_LEAVE") return tr("Nghỉ phép", "On leave")
    return "—"
  }

  return (
    <div>
      <div className="pr-12">
        <h2 className="text-lg font-semibold text-slate-950">
          {tr("Bù công ngày lễ & Khớp đơn nghỉ phép", "Holiday adjustment & leave matching")}
        </h2>
        <p className="mt-1 text-sm font-medium text-slate-600">
          {tr(
            "Hệ thống tự động kiểm tra những ngày nhân viên không phát sinh quẹt thẻ. Tự động bù ngày công chuẩn nếu trùng ngày Lễ Quốc Gia hoặc nhân viên đã có Đơn nghỉ phép được duyệt.",
            "The system checks days without attendance punches and prepares standard work credit for public holidays or approved leave.",
          )}
        </p>
      </div>

      <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-800">
          {tr("Từ ngày", "From")}
          <input type="date" className={control} value={from} onChange={(event) => { setFrom(event.target.value); setPreview(null) }} />
        </label>
        <label className="text-sm font-medium text-slate-800">
          {tr("Đến ngày", "To")}
          <input type="date" className={control} value={to} onChange={(event) => { setTo(event.target.value); setPreview(null) }} />
        </label>
        <fieldset className="md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <legend className="text-sm font-semibold text-slate-800">{tr("Nhân viên cần đối soát", "Employees to reconcile")}</legend>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">
              {tr(`Đã chọn: ${selectedEmployeeIds.length} / ${employees.length} nhân sự`, `Selected: ${selectedEmployeeIds.length} / ${employees.length} employees`)}
            </span>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)_auto_auto]">
            <input className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100" placeholder={tr("Tìm theo tên hoặc mã nhân viên", "Search by name or employee code")} value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} />
            <SelectControl className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}><option value="">{tr("Tất cả phòng ban", "All departments")}</option>{departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}</SelectControl>
            <Button type="button" variant="secondary" onClick={() => { setSelectedEmployeeIds(current => Array.from(new Set([...current, ...filteredEmployees.map(employee => employee.id)]))); setPreview(null) }}>{tr("Chọn tất cả", "Select all")}</Button>
            <Button type="button" variant="secondary" disabled={!selectedEmployeeIds.length} onClick={() => { setSelectedEmployeeIds([]); setPreview(null) }}>{tr("Bỏ chọn", "Clear")}</Button>
          </div>
          <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-slate-50/60 p-2">
            {employeesLoading ? (
              <p className="p-3 text-sm font-medium text-slate-600">{tr("Đang tải nhân viên...", "Loading employees...")}</p>
            ) : filteredEmployees.length ? (
              <div className="grid gap-1 sm:grid-cols-2">
                {filteredEmployees.map((employee) => {
                  const checked = selectedEmployeeIds.includes(employee.id)
                  return (
                    <label key={employee.id} className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors ${checked ? "border-orange-300 bg-orange-50 text-orange-950" : "border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50"}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setSelectedEmployeeIds((current) => event.target.checked ? [...current, employee.id] : current.filter((id) => id !== employee.id))
                          setPreview(null)
                        }}
                        className="size-4 accent-orange-500"
                      />
                      <span className="min-w-0"><strong className="block truncate font-semibold">{employee.employeeCode} · {employee.fullName}</strong></span>
                    </label>
                  )
                })}
              </div>
            ) : (
              <p className="p-3 text-sm font-medium text-slate-600">{tr("Không tìm thấy nhân viên đang hoạt động.", "No active employees found.")}</p>
            )}
          </div>
        </fieldset>
        <div className="md:col-span-2">
          <Button disabled={busy} type="submit">
            {busy ? tr("Đang kiểm tra...", "Checking...") : tr("Xem trước đối soát", "Preview reconciliation")}
          </Button>
        </div>
      </form>

      {error && <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 font-medium text-red-800">{error}</p>}

      {preview && (
        <div className="mt-5">
          <div className="grid gap-2 sm:grid-cols-3">
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 font-semibold text-emerald-800">{tr("Bù công ngày lễ/nghỉ phép", "Holiday/leave credit")}: {preview.summary.prepared} {tr("ngày", "days")}</p>
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 font-semibold text-slate-700">{tr("Đã có dữ liệu chấm công", "Attendance already exists")}: {preview.summary.kept} {tr("ngày", "days")}</p>
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 font-semibold text-amber-800">{tr("Vắng không phép / Chưa rõ lý do", "Unexcused / unknown absence")}: {preview.summary.errors} {tr("ngày", "days")}</p>
          </div>

          <div className="mt-3 max-h-72 overflow-auto rounded-md border border-slate-200">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-slate-700">
                <tr><th className="p-3">{tr("Nhân viên", "Employee")}</th><th className="p-3">{tr("Ngày", "Date")}</th><th className="p-3">{tr("Loại", "Type")}</th><th className="p-3">{tr("Kết quả", "Result")}</th></tr>
              </thead>
              <tbody>
                {preview.rows.map((row, index) => (
                  <tr className="border-t border-slate-200 align-top" key={`${row.employee_id}-${row.work_date}-${index}`}>
                    <td className="p-3 font-medium text-slate-900">{row.employee_code} · {row.full_name}</td>
                    <td className="p-3 text-slate-700">{row.work_date || "—"}</td>
                    <td className="p-3 text-slate-700">{statusLabel(row.attendance_status)}</td>
                    <td className="p-3 font-medium text-slate-900">
                      {actionLabel(row.action)}
                      {row.warning || row.message ? <span className="mt-1 block font-normal text-amber-800">{row.warning || row.message}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {warnings && (
            <label className="mt-3 flex gap-2 rounded-md bg-amber-50 p-3 text-sm font-medium text-amber-900">
              <input type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)} />
              {tr("Tôi đã kiểm tra các cảnh báo đối soát.", "I reviewed the reconciliation warnings.")}
            </label>
          )}

          <Button
            className="mt-3"
            disabled={busy || preview.summary.errors > 0 || (warnings && !ack)}
            onClick={() => void run(async () => {
              const result = await confirmAttendanceReconcile(preview.scope, preview.preview_token, ack)
              setPreview(null)
              onSaved(result)
            })}
          >
            {busy ? tr("Đang lưu...", "Saving...") : tr("Xác nhận đối soát", "Confirm reconciliation")}
          </Button>
        </div>
      )}
    </div>
  )
}
