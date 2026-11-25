import { SelectControl } from "../components/ui/select-control"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  RefreshCw,
  Tags,
  Users,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
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
  fetchLeaveRecords,
  fetchLeaveTypes,
  type LeaveRecord,
  type LeaveType,
} from "../services/attendance"

const localDate = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)

const control =
  "mt-1.5 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"

async function loadLeaveRecords(from: string, to: string, signal: AbortSignal) {
  const records: LeaveRecord[] = []
  const limit = 200
  for (let offset = 0; offset <= 10_000; offset += limit) {
    const response = await fetchLeaveRecords(
      { from, to, record_status: "ACTIVE", limit, offset },
      false,
      signal,
    )
    records.push(...response.data)
    if (response.data.length < limit) break
  }
  return records
}

const inclusiveDays = (start: string, end: string) =>
  Math.max(0, Math.round((Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / 86_400_000) + 1)

export default function LeaveDataDashboard() {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const today = localDate()
  const year = today.slice(0, 4)
  const initialRange = { from: `${year}-01-01`, to: `${year}-12-31` }
  const [draftFrom, setDraftFrom] = useState(initialRange.from)
  const [draftTo, setDraftTo] = useState(initialRange.to)
  const [range, setRange] = useState(initialRange)
  const [typeFilter, setTypeFilter] = useState("")
  const [records, setRecords] = useState<LeaveRecord[]>([])
  const [types, setTypes] = useState<LeaveType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError("")
    void Promise.all([
      loadLeaveRecords(range.from, range.to, controller.signal),
      fetchLeaveTypes(),
    ])
      .then(([leaveRecords, leaveTypes]) => {
        if (!controller.signal.aborted) {
          setRecords(leaveRecords)
          setTypes(leaveTypes.data)
        }
      })
      .catch((caught) => {
        if (!controller.signal.aborted) {
          setRecords([])
          setError(
            attendanceMessage(
              caught,
              tr("Không tải được tổng quan ngày nghỉ.", "Could not load the leave dashboard."),
            ),
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [range, revision, language])

  const filtered = useMemo(
    () => records.filter((record) => !typeFilter || String(record.leave_type_id) === typeFilter),
    [records, typeFilter],
  )

  const overview = useMemo(() => {
    const employees = new Set(filtered.map((record) => String(record.employee_id)))
    const typeGroups = new Map<number, { name: string; records: number; days: number }>()
    const months = new Map<string, { records: number; days: number }>()
    let totalDays = 0
    let current = 0
    let upcoming = 0

    for (const record of filtered) {
      const clippedStart = record.start_date < range.from ? range.from : record.start_date
      const clippedEnd = record.end_date > range.to ? range.to : record.end_date
      const days = inclusiveDays(clippedStart, clippedEnd)
      totalDays += days
      if (record.start_date <= today && record.end_date >= today) current++
      else if (record.start_date > today) upcoming++
      const type = typeGroups.get(record.leave_type_id) || {
        name: record.leave_type_name || record.leave_type || `#${record.leave_type_id}`,
        records: 0,
        days: 0,
      }
      type.records++
      type.days += days
      typeGroups.set(record.leave_type_id, type)
      const month = clippedStart.slice(0, 7)
      const monthly = months.get(month) || { records: 0, days: 0 }
      monthly.records++
      monthly.days += days
      months.set(month, monthly)
    }

    return {
      employees: employees.size,
      totalDays,
      current,
      upcoming,
      types: [...typeGroups].sort((a, b) => b[1].days - a[1].days),
      trend: [...months]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, value]) => ({ month, ...value })),
      timeline: filtered
        .filter((record) => record.end_date >= today)
        .sort((a, b) => a.start_date.localeCompare(b.start_date))
        .slice(0, 8),
    }
  }, [filtered, range, today])

  const number = new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US")
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(value + "T00:00:00Z"))
  const monthLabel = (value: string) => {
    const [valueYear, month] = value.split("-")
    return `${month}/${valueYear.slice(2)}`
  }
  const maxTypeDays = Math.max(1, ...overview.types.map(([, value]) => value.days))
  const mostUsedType = overview.types[0]?.[1]

  const metrics = [
    {
      label: tr("Hồ sơ nghỉ", "Leave records"),
      value: number.format(filtered.length),
      detail: tr(`${overview.employees} nhân viên có dữ liệu`, `${overview.employees} employees with data`),
      icon: ClipboardList,
      tone: "bg-orange-50 text-orange-700",
    },
    {
      label: tr("Tổng ngày nghỉ", "Total leave days"),
      value: number.format(overview.totalDays),
      detail: tr("Tính theo ngày lịch trong hồ sơ", "Calendar days recorded in leave data"),
      icon: CalendarDays,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      label: tr("Đang nghỉ hôm nay", "On leave today"),
      value: number.format(overview.current),
      detail: tr(`${overview.upcoming} hồ sơ sắp diễn ra`, `${overview.upcoming} upcoming records`),
      icon: CalendarClock,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: tr("Loại nghỉ phổ biến", "Most used leave type"),
      value: mostUsedType?.name || "—",
      detail: mostUsedType ? tr(`${mostUsedType.days} ngày đã ghi nhận`, `${mostUsedType.days} recorded days`) : tr("Chưa có dữ liệu", "No data"),
      icon: Tags,
      tone: "bg-violet-50 text-violet-700",
    },
  ]

  return (
    <AppShell quiet breadcrumb={[tr("Nhân sự", "Workforce"), tr("Tổng quan ngày nghỉ", "Leave dashboard")]}> 
      <SectionHeader
        title={tr("Tổng quan dữ liệu ngày nghỉ", "Leave data dashboard")}
        description={tr(
          "Theo dõi quy mô ngày nghỉ, cơ cấu loại nghỉ và các hồ sơ đang hoặc sắp có hiệu lực.",
          "Review leave volume, leave-type composition and records that are active or upcoming.",
        )}
      >
        <Link to="/employee-requests" className="inline-flex">
          <Button variant="secondary"><ArrowLeft size={16} />{tr("Về danh sách", "Back to records")}</Button>
        </Link>
        <Button variant="secondary" disabled={loading} onClick={() => setRevision((value) => value + 1)}>
          <RefreshCw size={16} />{tr("Tải lại", "Refresh")}
        </Button>
      </SectionHeader>

      <Card className="mb-5 p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="font-bold text-slate-950">{tr("Phạm vi báo cáo", "Report scope")}</h2>
            <p className="mt-1 text-sm text-slate-600">{tr("Mặc định tổng hợp toàn bộ năm hiện tại.", "Defaults to the entire current year.")}</p>
          </div>
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_minmax(180px,1fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault()
              if (draftFrom && draftTo && draftFrom <= draftTo) setRange({ from: draftFrom, to: draftTo })
            }}
          >
            <label className="text-sm font-semibold text-slate-700">{tr("Từ ngày", "From")}
              <input type="date" max={draftTo} value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} className={control} />
            </label>
            <label className="text-sm font-semibold text-slate-700">{tr("Đến ngày", "To")}
              <input type="date" min={draftFrom} value={draftTo} onChange={(event) => setDraftTo(event.target.value)} className={control} />
            </label>
            <label className="text-sm font-semibold text-slate-700">{tr("Loại nghỉ", "Leave type")}
              <SelectControl value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className={control}>
                <option value="">{tr("Tất cả loại nghỉ", "All leave types")}</option>
                {types.map((type) => <option key={type.id} value={type.id}>{type.code} · {type.name}</option>)}
              </SelectControl>
            </label>
            <Button className="self-end" disabled={!draftFrom || !draftTo || draftFrom > draftTo}>{tr("Áp dụng", "Apply")}</Button>
          </form>
        </div>
      </Card>

      {error && <p role="alert" className="mb-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</p>}
      {loading ? (
        <Card className="p-10 text-center text-sm font-medium text-slate-600">{tr("Đang tải tổng quan…", "Loading dashboard…")}</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center"><CalendarDays className="mx-auto text-slate-300" size={36} /><p className="mt-3 font-semibold text-slate-800">{tr("Chưa có dữ liệu ngày nghỉ trong phạm vi này.", "No leave data in this scope.")}</p></Card>
      ) : (
        <div className="space-y-5">
          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
              <Card key={label} className="p-5">
                <div className={`flex size-10 items-center justify-center rounded-md ${tone}`}><Icon size={20} aria-hidden="true" /></div>
                <dt className="mt-4 text-sm font-semibold text-slate-600">{label}</dt>
                <dd className={`mt-1 font-bold text-slate-950 ${label === tr("Loại nghỉ phổ biến", "Most used leave type") ? "line-clamp-2 text-xl" : "text-3xl tabular-nums"}`}>{value}</dd>
                <p className="mt-2 text-xs font-medium leading-5 text-slate-600">{detail}</p>
              </Card>
            ))}
          </dl>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)]">
            <Card className="min-w-0 p-5">
              <h2 className="font-bold text-slate-950">{tr("Xu hướng nghỉ theo tháng", "Monthly leave trend")}</h2>
              <p className="mt-1 text-sm text-slate-600">{tr("Tháng được xác định theo ngày bắt đầu của hồ sơ nghỉ.", "Months are based on each record's start date.")}</p>
              <div className="mt-5 h-80 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview.trend} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="4 4" />
                    <XAxis dataKey="month" tickFormatter={monthLabel} axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 11 }} />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={34} tick={{ fill: "#475569", fontSize: 11 }} />
                    <Tooltip labelFormatter={(value) => monthLabel(String(value))} formatter={(value, name) => [number.format(Number(value)), name === "days" ? tr("Ngày nghỉ", "Leave days") : tr("Hồ sơ", "Records")]} />
                    <Bar dataKey="days" fill="#F97316" radius={[5, 5, 0, 0]} maxBarSize={34} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="font-bold text-slate-950">{tr("Cơ cấu theo loại nghỉ", "Leave-type composition")}</h2>
              <p className="mt-1 text-sm text-slate-600">{tr("So sánh theo tổng số ngày đã ghi nhận.", "Compared by total recorded days.")}</p>
              <ul className="mt-5 space-y-4">
                {overview.types.map(([id, value]) => (
                  <li key={id}>
                    <div className="flex items-start justify-between gap-3 text-sm"><span className="font-semibold text-slate-700">{value.name}</span><span className="shrink-0 font-bold tabular-nums text-slate-950">{number.format(value.days)} {tr("ngày", "days")}</span></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${(value.days / maxTypeDays) * 100}%` }} /></div>
                    <p className="mt-1 text-xs font-medium text-slate-600">{value.records} {tr("hồ sơ", "records")}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div><h2 className="font-bold text-slate-950">{tr("Đang nghỉ và sắp nghỉ", "Current and upcoming leave")}</h2><p className="mt-1 text-sm text-slate-600">{tr("Các hồ sơ còn hiệu lực từ hôm nay trở đi.", "Records that remain effective from today onward.")}</p></div>
              <Users size={20} className="text-orange-600" aria-hidden="true" />
            </div>
            {overview.timeline.length ? (
              <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600"><tr><th className="px-5 py-3">{tr("Nhân viên", "Employee")}</th><th className="px-5 py-3">{tr("Loại nghỉ", "Leave type")}</th><th className="px-5 py-3">{tr("Khoảng ngày", "Date range")}</th><th className="px-5 py-3">{tr("Số ngày", "Days")}</th><th className="px-5 py-3">{tr("Tình trạng", "Timing")}</th></tr></thead><tbody>{overview.timeline.map((record) => { const current = record.start_date <= today && record.end_date >= today; return <tr key={record.id} className="border-t border-slate-100"><td className="px-5 py-3 font-bold text-slate-950">{record.employee_code || `#${record.employee_id}`}</td><td className="px-5 py-3 text-slate-700">{record.leave_type_name || record.leave_type || `#${record.leave_type_id}`}</td><td className="px-5 py-3 font-medium text-slate-700">{formatDate(record.start_date)} → {formatDate(record.end_date)}</td><td className="px-5 py-3 font-semibold tabular-nums text-slate-700">{inclusiveDays(record.start_date, record.end_date)}</td><td className="px-5 py-3"><span className={`inline-flex rounded-md border px-2 py-1 text-xs font-bold ${current ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-blue-200 bg-blue-50 text-blue-800"}`}>{current ? tr("Đang nghỉ", "Current") : tr("Sắp diễn ra", "Upcoming")}</span></td></tr> })}</tbody></table></div>
            ) : <p className="p-6 text-sm text-slate-600">{tr("Không có hồ sơ đang hoặc sắp diễn ra.", "No current or upcoming leave records.")}</p>}
          </Card>
        </div>
      )}
    </AppShell>
  )
}
