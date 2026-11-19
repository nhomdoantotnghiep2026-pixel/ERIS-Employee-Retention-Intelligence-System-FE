import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck2,
  Clock3,
  RefreshCw,
  Timer,
  Users,
} from "lucide-react"
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AppShell } from "../components/AppShell"
import { Button, Card, SectionHeader } from "../components/ui"
import { useLanguage } from "../context/LanguageContext"
import {
  attendanceMessage,
  fetchAttendance,
  type ImportedAttendance,
} from "../services/attendance"

const localDate = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)

const startOfMonth = (date: string) => date.slice(0, 8) + "01"
const control =
  "mt-1.5 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"

async function loadAttendance(from: string, to: string, signal: AbortSignal) {
  const records: ImportedAttendance[] = []
  const limit = 200
  for (let offset = 0; offset <= 10_000; offset += limit) {
    const response = await fetchAttendance(
      { from, to, record_status: "ACTIVE", limit, offset },
      false,
      signal,
    )
    records.push(...response.data)
    if (response.data.length < limit) break
  }
  return records
}

export default function AttendanceDashboard() {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const today = localDate()
  const [draftFrom, setDraftFrom] = useState(startOfMonth(today))
  const [draftTo, setDraftTo] = useState(today)
  const [range, setRange] = useState({ from: startOfMonth(today), to: today })
  const [records, setRecords] = useState<ImportedAttendance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError("")
    void loadAttendance(range.from, range.to, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setRecords(data)
      })
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setRecords([])
          setError(
            attendanceMessage(
              caught,
              tr("Không tải được tổng quan chấm công.", "Could not load the attendance dashboard."),
            ),
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [range, revision, language])

  const overview = useMemo(() => {
    const employees = new Set(records.map((record) => String(record.employee_id)))
    const status = new Map<string, number>()
    const days = new Map<string, { work: number; overtime: number; records: number }>()
    const attention = new Map<
      string,
      { employeeCode: string; fullName: string; late: number; early: number; occurrences: number }
    >()
    let workMinutes = 0
    let overtimeMinutes = 0
    let lateMinutes = 0
    let earlyMinutes = 0

    for (const record of records) {
      const work = Number(record.working_minutes) || 0
      const overtime = Number(record.overtime_minutes) || 0
      const late = Number(record.late_mins) || 0
      const early = Number(record.early_mins) || 0
      workMinutes += work
      overtimeMinutes += overtime
      lateMinutes += late
      earlyMinutes += early
      const statusKey = record.attendance_status || "UNCLASSIFIED"
      status.set(statusKey, (status.get(statusKey) || 0) + 1)
      const day = days.get(record.work_date) || { work: 0, overtime: 0, records: 0 }
      day.work += work
      day.overtime += overtime
      day.records++
      days.set(record.work_date, day)
      if (late || early) {
        const key = String(record.employee_id)
        const current = attention.get(key) || {
          employeeCode: record.employee_code,
          fullName: record.full_name,
          late: 0,
          early: 0,
          occurrences: 0,
        }
        current.late += late
        current.early += early
        current.occurrences++
        attention.set(key, current)
      }
    }
    return {
      employees: employees.size,
      workMinutes,
      overtimeMinutes,
      lateMinutes,
      earlyMinutes,
      status: [...status].sort((a, b) => b[1] - a[1]),
      trend: [...days]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({
          date,
          workHours: Number((value.work / 60).toFixed(1)),
          overtimeHours: Number((value.overtime / 60).toFixed(1)),
          records: value.records,
        })),
      attention: [...attention.values()]
        .sort((a, b) => b.late + b.early - (a.late + a.early))
        .slice(0, 6),
    }
  }, [records])

  const number = new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US", {
    maximumFractionDigits: 1,
  })
  const dateLabel = (value: string) =>
    new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(value + "T00:00:00Z"))
  const statusLabel = (status: string) => {
    const labels: Record<string, [string, string]> = {
      PRESENT: ["Đúng giờ", "Present"],
      LATE: ["Đi muộn", "Late"],
      EARLY_LEAVE: ["Về sớm", "Early leave"],
      LATE_EARLY_LEAVE: ["Muộn và về sớm", "Late and early leave"],
      ON_LEAVE: ["Nghỉ phép", "On leave"],
      ABSENT: ["Vắng mặt", "Absent"],
      HOLIDAY: ["Ngày lễ", "Holiday"],
      DAY_OFF: ["Ngày nghỉ lịch", "Scheduled day off"],
      UNCLASSIFIED: ["Chưa phân loại", "Unclassified"],
    }
    const label = labels[status]
    return label ? tr(label[0], label[1]) : status
  }
  const maxStatus = Math.max(1, ...overview.status.map(([, count]) => count))

  const metrics = [
    {
      label: tr("Bản ghi ngày công", "Attendance records"),
      value: number.format(records.length),
      detail: tr(`${overview.employees} nhân viên có dữ liệu`, `${overview.employees} employees with data`),
      icon: CalendarCheck2,
      tone: "bg-orange-50 text-orange-700",
    },
    {
      label: tr("Tổng giờ làm", "Total work hours"),
      value: number.format(overview.workMinutes / 60),
      detail: tr("Tính từ dữ liệu đang sử dụng", "From active records"),
      icon: Clock3,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      label: tr("Giờ tăng ca", "Overtime hours"),
      value: number.format(overview.overtimeMinutes / 60),
      detail: tr("Tổng OT trong khoảng lọc", "Total OT in the selected range"),
      icon: Timer,
      tone: "bg-violet-50 text-violet-700",
    },
    {
      label: tr("Phút lệch giờ", "Schedule variance minutes"),
      value: number.format(overview.lateMinutes + overview.earlyMinutes),
      detail: tr(
        `${overview.lateMinutes} phút muộn · ${overview.earlyMinutes} phút về sớm`,
        `${overview.lateMinutes} late · ${overview.earlyMinutes} early`,
      ),
      icon: AlertTriangle,
      tone: "bg-amber-50 text-amber-800",
    },
  ]

  return (
    <AppShell quiet breadcrumb={[tr("Nhân sự", "Workforce"), tr("Tổng quan chấm công", "Attendance dashboard")]}> 
      <SectionHeader
        title={tr("Tổng quan dữ liệu chấm công", "Attendance data dashboard")}
        description={tr(
          "Tổng hợp dữ liệu HR đã nhập để theo dõi giờ làm, tăng ca và các trường hợp cần kiểm tra.",
          "Summarize HR-imported data to review work hours, overtime and records that need attention.",
        )}
      >
        <Link to="/attendance" className="inline-flex">
          <Button variant="secondary"><ArrowLeft size={16} />{tr("Về danh sách", "Back to records")}</Button>
        </Link>
        <Button variant="secondary" disabled={loading} onClick={() => setRevision((value) => value + 1)}>
          <RefreshCw size={16} />{tr("Tải lại", "Refresh")}
        </Button>
      </SectionHeader>

      <Card className="mb-5 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-bold text-slate-950">{tr("Phạm vi báo cáo", "Report range")}</h2>
            <p className="mt-1 text-sm text-slate-600">{tr("Áp dụng cho toàn bộ chỉ số và biểu đồ phía dưới.", "Applies to all metrics and charts below.")}</p>
          </div>
          <form
            className="grid gap-3 sm:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault()
              if (draftFrom && draftTo && draftFrom <= draftTo) setRange({ from: draftFrom, to: draftTo })
            }}
          >
            <label className="text-sm font-semibold text-slate-700">{tr("Từ ngày", "From")}
              <input type="date" max={draftTo || today} value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} className={control} />
            </label>
            <label className="text-sm font-semibold text-slate-700">{tr("Đến ngày", "To")}
              <input type="date" min={draftFrom} max={today} value={draftTo} onChange={(event) => setDraftTo(event.target.value)} className={control} />
            </label>
            <Button className="self-end" disabled={!draftFrom || !draftTo || draftFrom > draftTo}>{tr("Áp dụng", "Apply")}</Button>
          </form>
        </div>
      </Card>

      {error && <p role="alert" className="mb-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</p>}
      {loading ? (
        <Card className="p-10 text-center text-sm font-medium text-slate-600">{tr("Đang tải tổng quan…", "Loading dashboard…")}</Card>
      ) : records.length === 0 ? (
        <Card className="p-10 text-center"><CalendarCheck2 className="mx-auto text-slate-300" size={36} /><p className="mt-3 font-semibold text-slate-800">{tr("Chưa có dữ liệu chấm công trong khoảng này.", "No attendance data in this range.")}</p></Card>
      ) : (
        <div className="space-y-5">
          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
              <Card key={label} className="p-5">
                <div className={`flex size-10 items-center justify-center rounded-md ${tone}`}><Icon size={20} aria-hidden="true" /></div>
                <dt className="mt-4 text-sm font-semibold text-slate-600">{label}</dt>
                <dd className="mt-1 text-3xl font-bold tabular-nums text-slate-950">{value}</dd>
                <p className="mt-2 text-xs font-medium leading-5 text-slate-600">{detail}</p>
              </Card>
            ))}
          </dl>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
            <Card className="min-w-0 p-5">
              <h2 className="font-bold text-slate-950">{tr("Xu hướng giờ làm theo ngày", "Daily work-hour trend")}</h2>
              <p className="mt-1 text-sm text-slate-600">{tr("So sánh tổng giờ làm và giờ tăng ca của các bản ghi đang sử dụng.", "Compare total work and overtime hours from active records.")}</p>
              <div className="mt-5 h-80 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={overview.trend} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="4 4" />
                    <XAxis dataKey="date" tickFormatter={dateLabel} axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 11 }} minTickGap={18} />
                    <YAxis axisLine={false} tickLine={false} width={36} tick={{ fill: "#475569", fontSize: 11 }} />
                    <Tooltip labelFormatter={(value) => dateLabel(String(value))} formatter={(value, name) => [number.format(Number(value)), name === "workHours" ? tr("Giờ làm", "Work hours") : tr("Tăng ca", "Overtime")]} />
                    <Bar dataKey="workHours" fill="#FDBA74" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Line type="monotone" dataKey="overtimeHours" stroke="#7C3AED" strokeWidth={2.5} dot={{ r: 3, fill: "#FFFFFF", strokeWidth: 2 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold text-slate-600"><span><i className="mr-1.5 inline-block size-2 rounded-sm bg-orange-300" />{tr("Giờ làm", "Work hours")}</span><span><i className="mr-1.5 inline-block size-2 rounded-full bg-violet-600" />{tr("Tăng ca", "Overtime")}</span></div>
            </Card>

            <Card className="p-5">
              <h2 className="font-bold text-slate-950">{tr("Cơ cấu trạng thái", "Status distribution")}</h2>
              <p className="mt-1 text-sm text-slate-600">{tr("Số bản ghi theo kết quả ngày công.", "Records grouped by attendance outcome.")}</p>
              <ul className="mt-5 space-y-4">
                {overview.status.map(([status, count]) => (
                  <li key={status}>
                    <div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-slate-700">{statusLabel(status)}</span><span className="font-bold tabular-nums text-slate-950">{number.format(count)}</span></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${(count / maxStatus) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div><h2 className="font-bold text-slate-950">{tr("Nhân viên cần kiểm tra", "Employees to review")}</h2><p className="mt-1 text-sm text-slate-600">{tr("Xếp theo tổng phút đi muộn và về sớm trong khoảng lọc.", "Ranked by total late and early-leave minutes in the selected range.")}</p></div>
              <Users size={20} className="text-orange-600" aria-hidden="true" />
            </div>
            {overview.attention.length ? (
              <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600"><tr><th className="px-5 py-3">{tr("Nhân viên", "Employee")}</th><th className="px-5 py-3">{tr("Số ngày phát sinh", "Affected days")}</th><th className="px-5 py-3">{tr("Đi muộn", "Late")}</th><th className="px-5 py-3">{tr("Về sớm", "Early leave")}</th><th className="px-5 py-3">{tr("Tổng lệch", "Total variance")}</th></tr></thead><tbody>{overview.attention.map((item) => <tr key={item.employeeCode} className="border-t border-slate-100"><td className="px-5 py-3"><strong className="block text-slate-950">{item.fullName}</strong><span className="text-xs font-medium text-slate-600">{item.employeeCode}</span></td><td className="px-5 py-3 font-semibold tabular-nums text-slate-700">{item.occurrences}</td><td className="px-5 py-3 tabular-nums text-amber-800">{item.late} {tr("phút", "min")}</td><td className="px-5 py-3 tabular-nums text-amber-800">{item.early} {tr("phút", "min")}</td><td className="px-5 py-3 font-bold tabular-nums text-slate-950">{item.late + item.early} {tr("phút", "min")}</td></tr>)}</tbody></table></div>
            ) : <p className="p-6 text-sm text-slate-600">{tr("Không có trường hợp đi muộn hoặc về sớm trong khoảng lọc.", "No late or early-leave cases in this range.")}</p>}
          </Card>
        </div>
      )}
    </AppShell>
  )
}
