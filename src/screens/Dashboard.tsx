import { useMemo, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowUpRight, CalendarDays, ChevronDown, Clock3, Filter, RefreshCw, AlertTriangle, ShieldPlus, Users, Layers3, Gauge, HeartHandshake, PieChart as PieIcon, X } from "lucide-react"
import { Select } from "radix-ui"
import { AppShell } from "../components/AppShell"
import { useLanguage } from "../context/LanguageContext"
import { bentoSurface, Empty, Panel, RiskChart, riskLabel, Segments, TeamDonut, Timeline, type Tr } from "../features/executive-dashboard/DashboardCharts"
import { PressureList, PriorityTable, type PressureRow } from "../features/executive-dashboard/DashboardLists"
import {
  computeDashboardMetrics, dashboardPeriod, groupPeople, initialFilters, overtimeMeasure, percent, summarizeAttendance,
  toBusinessDate, workloadBuckets, type OvertimeUnit, type Period, type ProfileField, type RiskLevel,
} from "../features/executive-dashboard/metrics"
import { shiftLabel } from "../features/executive-dashboard/shifts"
import { useDashboardData } from "../features/executive-dashboard/useDashboardData"

const secondary = "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-amber-400"
const rosterFields = ["department", "level", "contractType", "workShift"] as const

function categoryLabel(field: ProfileField, value: string, tr: Tr) {
  if (field === "workShift") return shiftLabel(value, tr("vi", "en") === "vi", true)
  if (!value) return tr("Chưa xác định", "Unspecified")
  if (field === "department") return value
  const map: Record<string, [string, string]> = {
    "1": ["Mới vào nghề", "Entry"], "2": ["Sơ cấp", "Junior"], "3": ["Trung cấp", "Intermediate"],
    "4": ["Cao cấp", "Senior"], "5": ["Chuyên gia / Quản lý", "Expert / Leadership"],
    FULL_TIME: ["Toàn thời gian", "Full time"], PART_TIME: ["Bán thời gian", "Part time"],
    SEASONAL: ["Thời vụ", "Seasonal"], CONTRACT: ["Hợp đồng", "Contract"], INTERNSHIP: ["Thực tập", "Internship"],
  }
  const known = map[value]
  return known ? tr(...known) : tr("Khác", "Other")
}

function DashboardSelect({ label, value, options, onChange }: {
  label: string; value: string; options: Array<[string, string]>; onChange: (key: string) => void
}) {
  return <label className="block min-w-0">
    <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger aria-label={label} className="flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-left text-xs text-slate-800 transition hover:bg-white focus-visible:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-500/20">
        <span className="min-w-0 truncate"><Select.Value>{options.find(option => option[0] === value)?.[1]}</Select.Value></span>
        <Select.Icon asChild><ChevronDown size={14} className="shrink-0 text-slate-500" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={4} className="z-[100] max-h-72 min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-900 shadow-xl motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
          <Select.Viewport className="p-1">
            {options.map(([key, name]) => <Select.Item key={key} value={key} className="cursor-pointer rounded-md px-3 py-2 text-sm text-slate-700 outline-none data-[highlighted]:bg-orange-50 data-[state=checked]:text-orange-800">
              <Select.ItemText>{name}</Select.ItemText>
            </Select.Item>)}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  </label>
}

function Metric({ label, value, children, icon, accent, surface = "" }: { label: string; value: ReactNode; children: ReactNode; icon: ReactNode; accent: string; surface?: string }) {
  return <section className={`${bentoSurface} ${surface || "border-slate-200/80"} p-4`}>
    <div className="flex items-start justify-between gap-2">
      <h2 className="pt-1 text-sm font-medium text-slate-600">{label}</h2>
      <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${accent}`} aria-hidden="true">{icon}</span>
    </div>
    <div className="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-slate-950">{value}</div>
    <div className="mt-2 space-y-1 text-xs leading-relaxed text-slate-600">{children}</div>
  </section>
}

export default function Dashboard() {
  const { language } = useLanguage()
  const tr: Tr = (vi, en) => language === "vi" ? vi : en
  const [filters, setFilters] = useState(initialFilters)
  const [revision, setRevision] = useState(0)
  const [attendanceRevision, setAttendanceRevision] = useState(0)
  const [riskField, setRiskField] = useState<Exclude<ProfileField, "contractType">>("department")
  const [riskUnit, setRiskUnit] = useState<"count" | "percent">("count")
  const [riskDrilldown, setRiskDrilldown] = useState<RiskLevel | null>(null)
  const [groupDrilldown, setGroupDrilldown] = useState<{ field: ProfileField; value: string } | null>(null)
  const [timelineUnit, setTimelineUnit] = useState<OvertimeUnit>("total")
  const [teamField, setTeamField] = useState<ProfileField>("contractType")
  const [mix, setMix] = useState<"tenure" | "leave">("tenure")
  const [ranking, setRanking] = useState<"department" | "employee">("department")
  const today = toBusinessDate(new Date())
  const range = dashboardPeriod(filters.period, today)
  const { employees, directory, assessments, attendance, leaves, engagement } = useDashboardData(range, revision, attendanceRevision)
  const updated = [attendance.updated, leaves.updated, engagement.updated].filter(Boolean).sort().at(-1)
  const stats = useMemo(() => computeDashboardMetrics(
    employees, assessments?.data ?? [], assessments?.unavailable ?? new Set(),
    attendance.data ?? [], leaves.data ?? [], engagement.data?.scores ?? new Map(),
    filters, { from: range.from, to: range.to },
  ), [employees, assessments, attendance.data, leaves.data, engagement.data, filters, range.from, range.to])
  const number = new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const fmt = (value: number) => number.format(value)
  const pct = (value: number | null) => value === null ? "—" : fmt(value) + "%"
  const date = (value: string) => {
    const key = value.length > 10 ? toBusinessDate(new Date(value)) : value
    return key.split("-").reverse().join("/")
  }
  const dateSpan = date(range.from) + " – " + date(range.to)
  const fieldTitle = (field: ProfileField) => ({
    department: tr("Phòng ban", "Department"), level: tr("Cấp bậc", "Level"),
    contractType: tr("Loại hợp đồng", "Contract type"), workShift: tr("Ca làm việc", "Shift"),
  })[field]
  const periodOptions: Array<[Period, string]> = [
    ["THIS_MONTH", tr("Tháng này", "This month")], ["LAST_MONTH", tr("Tháng trước", "Last month")],
    ["THIS_QUARTER", tr("Quý này", "This quarter")], ["LAST_12_MONTHS", tr("12 tháng gần nhất", "Last 12 months")],
  ]
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(initialFilters) || Boolean(riskDrilldown || groupDrilldown)
  const clearFilters = () => { setFilters(initialFilters); setRiskDrilldown(null); setGroupDrilldown(null) }
  const directoryReady = directory.staff !== null
  const riskReady = directoryReady && !!assessments
  const riskComplete = riskReady && stats.unknown === 0
  const attendanceReady = directoryReady && attendance.data !== null
  const attendanceLoading = attendance.status === "loading" || (!directoryReady && !directory.errors.includes("staff"))
  const attendanceError = attendance.status === "error" || (!directoryReady && directory.errors.includes("staff"))
  const leaveReady = directoryReady && leaves.data !== null
  const emptyRisk = !riskReady ? tr("Chưa có kết quả đánh giá để hiển thị.", "Assessment results are unavailable.") : tr("Không có nhóm phù hợp.", "No groups match the filters.")
  const errorLabels = {
    staff: tr("Hồ sơ nhân sự", "Employee profiles"), departments: tr("Phòng ban", "Departments"),
    positions: tr("Cấp bậc", "Position levels"), schedules: tr("Ca làm việc", "Work shifts"),
  }
  const errors = [
    ...(directory?.errors.map(key => errorLabels[key]) ?? []),
    ...(leaves.status === "error" ? [tr("Ngày nghỉ", "Leave")] : []),
    ...(engagement.status === "error" ? [tr("Khảo sát gắn kết", "Engagement surveys")] : []),
  ]

  const riskRows = groupPeople(stats.people, riskField).map(([key, group]) => {
    const counts = { LOW: 0, MEDIUM: 0, HIGH: 0, UNASSESSED: 0 }
    for (const person of group) {
      if (!assessments?.unavailable.has(person.id)) counts[stats.latest.get(person.id)?.riskLevel ?? "UNASSESSED"]++
    }
    return { key, name: riskField === "workShift" ? shiftLabel(key, language === "vi") : categoryLabel(riskField, key, tr), fullName: categoryLabel(riskField, key, tr), ...counts, total: counts.LOW + counts.MEDIUM + counts.HIGH + counts.UNASSESSED }
  }).filter(row => row.total > 0)
  const crossPeople = groupDrilldown ? stats.people.filter(person => person[groupDrilldown.field] === groupDrilldown.value) : stats.people
  const crossIds = new Set(crossPeople.map(person => person.id))
  const timelineAttendance = groupDrilldown ? stats.workload.filter(row => crossIds.has(row.employeeId)) : stats.workload
  const timelineTotal = overtimeMeasure(summarizeAttendance(timelineAttendance), timelineUnit)
  const formatChartHours = (hours: number) => hours.toLocaleString(language === "vi" ? "vi-VN" : "en-GB", { maximumFractionDigits: timelineUnit === "total" ? 1 : 2 })
  const timelineRows = workloadBuckets(timelineAttendance, range).map(bucket => ({
    label: bucket.byMonth ? date(bucket.from).slice(3, 5) + "/" + bucket.from.slice(0, 4) : tr(`Tuần ${bucket.index + 1}`, `Week ${bucket.index + 1}`),
    span: bucket.from === bucket.to ? date(bucket.from) : date(bucket.from) + " – " + date(bucket.to),
    ...overtimeMeasure(bucket, timelineUnit),
  }))

  const priorities = stats.people.filter(person => {
    if (assessments?.unavailable.has(person.id)) return false
    const level = stats.latest.get(person.id)?.riskLevel
    return riskDrilldown ? (level ?? "UNASSESSED") === riskDrilldown : !!level
  }).map(person => {
    const totals = summarizeAttendance(stats.attendanceByPerson.get(person.id) ?? [])
    const engagementScore = engagement.data?.scores.get(person.id)
    const signals = [
      ...(totals.overtime > 0 ? [tr(`Tăng ca ${fmt(totals.overtime)} giờ`, `${fmt(totals.overtime)} h overtime`)] : []),
      ...(totals.late > 0 ? [tr(`Trễ ${totals.late} lượt`, `${totals.late} late arrivals`)] : []),
      ...(engagementScore && engagementScore >= 1 && engagementScore <= 5 ? [tr(`Gắn kết ${fmt(engagementScore)}/5`, `Engagement ${fmt(engagementScore)}/5`)] : []),
    ]
    return { person, assessment: stats.latest.get(person.id), signals: signals.slice(0, 2) }
  }).sort((a, b) => (b.assessment?.riskScore ?? -1) - (a.assessment?.riskScore ?? -1) || a.person.code.localeCompare(b.person.code, undefined, { numeric: true }))

  const pressureGroups = ranking === "department" ? groupPeople(stats.people, "department")
    : stats.people.map(person => [String(person.id), [person]] as const)
  const pressure = pressureGroups.flatMap<PressureRow>(([key, people]) => {
    const rows = people.flatMap(person => stats.attendanceByPerson.get(person.id) ?? [])
    if (!rows.length) return []
    const totals = summarizeAttendance(rows)
    return [{
      id: key, name: ranking === "department" ? categoryLabel("department", key, tr) : people[0].fullName,
      caption: ranking === "employee" ? people[0].department : "",
      hours: ranking === "department" ? totals.overtime / people.length : totals.overtime,
      detail: ranking === "department" ? tr(`Đi trễ ${pct(totals.lateRate)}`, `Late ${pct(totals.lateRate)}`) : tr(`${totals.late} lượt đi trễ`, `${totals.late} late arrivals`),
    }]
  }).sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name, language)).slice(0, 5)

  const tenureLabels = [tr("Dưới 1 năm", "Under 1 year"), tr("1–dưới 3 năm", "1–under 3 years"), tr("3–5 năm", "3–5 years"), tr("Trên 5 năm", "Over 5 years")]
  const leaveMix = [
    { name: tr("Phép năm", "Annual leave"), value: stats.leaveDays.ANNUAL, icon: CalendarDays, gradient: "from-emerald-500 to-teal-400", tone: "border-emerald-200/70 bg-emerald-50/70", iconTone: "bg-emerald-100 text-emerald-700" },
    { name: tr("Nghỉ ốm / Không lương", "Sick / unpaid leave"), value: stats.leaveDays.SICK_UNPAID, icon: ShieldPlus, gradient: "from-rose-500 to-pink-500", tone: "border-rose-200/70 bg-rose-50/70", iconTone: "bg-rose-100 text-rose-700" },
    { name: tr("Nghỉ khác", "Other leave"), value: stats.leaveDays.OTHER, icon: Clock3, gradient: "from-blue-400 to-slate-400", tone: "border-slate-200 bg-slate-50", iconTone: "bg-slate-200/80 text-slate-700" },
  ]
  const selectGroup = (value: string) => setGroupDrilldown(previous => previous?.value === value && previous.field === riskField ? null : { field: riskField, value })
  const selectRisk = (level: RiskLevel) => setRiskDrilldown(previous => previous === level ? null : level)
  const emptyCohort = tr("Không có nhân sự phù hợp với bộ lọc.", "No employees match the filters.")

  return <AppShell breadcrumb={[tr("Tổng quan điều hành", "Executive overview")]} mainStyle={{ background: "#F8FAFC" }}>
    <div className="min-w-0 rounded-2xl border border-slate-200/80 text-slate-900 shadow-sm">
      <div className="relative isolate overflow-hidden rounded-t-2xl border-t-[3px] border-orange-500 bg-gradient-to-br from-orange-50/65 via-white to-white px-4 py-6 after:pointer-events-none after:absolute after:-right-10 after:-top-24 after:-z-10 after:size-64 after:rounded-full after:border-[26px] after:border-white/55 sm:px-6 sm:py-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{tr("Tổng quan giữ chân & chấm công", "Retention and attendance overview")}</h1>
            <p className="mt-1.5 text-sm text-slate-600">{tr("Theo dõi rủi ro giữ chân, giờ làm và biến động đội ngũ theo kỳ.", "Review retention risk, working hours, and workforce trends by period.")}</p>
          </div>
          <Link to="/ai-analysis" className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-orange-500/25 transition hover:shadow-lg hover:shadow-orange-500/35 motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300">
            {tr("Đánh giá giữ chân", "Review retention")}<ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <div className="sticky top-0 z-20 space-y-2 border-y border-slate-200/80 bg-white/90 px-4 py-3.5 shadow-sm backdrop-blur-md sm:px-6">
        <div className="grid grid-cols-2 items-end gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
          {rosterFields.map(field => <DashboardSelect key={field} label={fieldTitle(field)} value={filters[field] || "__unknown__"}
            options={[
              ["ALL", tr("Tất cả", "All")],
              ...[...new Set(employees.map(person => person[field]))].sort((a,b) => a.localeCompare(b, language, { numeric: true }))
                .map((key): [string, string] => [key || "__unknown__", categoryLabel(field, key, tr)]),
            ]}
            onChange={value => { setFilters(current => ({ ...current, [field]: value === "__unknown__" ? "" : value })); setGroupDrilldown(null) }} />)}
          <DashboardSelect label={tr("Kỳ xem", "Reporting period")} options={periodOptions} value={filters.period}
            onChange={key => setFilters(current => ({ ...current, period: key as Period }))} />
          <button type="button" onClick={clearFilters} disabled={!hasFilters} className={secondary + " disabled:opacity-40"}>
            <Filter size={14} aria-hidden="true" /> {tr("Đặt lại bộ lọc", "Reset filters")}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5 tabular-nums"><CalendarDays size={13} aria-hidden="true" />{dateSpan}</span>
          <span>{updated ? tr(`Dữ liệu cập nhật ${date(updated)}`, `Data refreshed ${date(updated)}`) : attendance.status !== "loading" && leaves.status !== "loading" && engagement.status !== "loading" ? tr("Chưa có dữ liệu cập nhật", "No data refreshed") : tr("Đang tải dữ liệu…", "Loading data…")}</span>
          <button type="button" onClick={() => setRevision(value => value + 1)} className="inline-flex items-center gap-1 rounded-sm text-orange-700 hover:text-orange-900 focus-visible:outline-2 focus-visible:outline-amber-400">
            <RefreshCw size={12} aria-hidden="true" />{tr("Tải lại", "Refresh")}
          </button>
        </div>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        {!!errors.length && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{tr("Chưa tải được các nhóm dữ liệu sau", "Some data could not be loaded")} · {errors.join(" · ")}</p>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label={tr("Nhân sự đang làm việc", "Active workforce")} value={directoryReady ? stats.people.length : "—"} icon={<Users size={17} />} accent="bg-gradient-to-br from-indigo-100 to-sky-200 text-indigo-800" surface="border-indigo-200/90 bg-white">
            <p>{tr("Toàn thời gian", "Full time")} {directoryReady ? stats.people.filter(person => person.contractType === "FULL_TIME").length : "—"} · {tr("Bán thời gian", "Part time")} {directoryReady ? stats.people.filter(person => person.contractType === "PART_TIME").length : "—"}</p>
          </Metric>
          <Metric label={tr("Nguy cơ nghỉ việc cao", "High attrition risk")}
            value={riskComplete ? <>{stats.high} <span className="text-sm font-medium text-rose-700">{tr("người", "people")} · {pct(stats.highRate)}</span></> : "—"}
            icon={<>{riskComplete && stats.high > 0 && <span className="absolute inset-0 rounded-xl bg-rose-400/30 motion-safe:animate-ping" />}<AlertTriangle size={17} className="relative z-10" /></>} accent="relative rounded-xl bg-rose-100 text-rose-600" surface="border-rose-200/90 bg-gradient-to-br from-rose-50/70 via-white to-white shadow-[0_4px_20px_-4px_rgba(244,63,94,0.1)]">
            <p>{riskComplete ? tr(`Đã đánh giá ${stats.assessed}/${stats.people.length} nhân sự tính đến cuối kỳ (${pct(stats.coverage)})`, `${stats.assessed}/${stats.people.length} employees assessed by period end (${pct(stats.coverage)})`) : tr("Đang chờ đủ kết quả đánh giá", "Waiting for assessment data")}</p>
          </Metric>
          <Metric label={tr("Giờ tăng ca & đúng giờ", "Overtime and punctuality")}
            value={attendanceReady && stats.workload.length ? <>{fmt(stats.attendance.overtime)} <span className="text-sm font-medium text-slate-600">{tr("giờ", "h")}</span></> : "—"}
            icon={<Clock3 size={17} />} accent="bg-blue-400/15 text-blue-700" surface="border-blue-200/80 bg-white">
            <p>{tr("Bình quân người tăng ca", "Average for overtime workers")} {attendanceReady && stats.attendance.overtimePeople ? fmt(stats.attendance.overtime / stats.attendance.overtimePeople) : "—"} {tr("giờ/người", "h/person")}</p>
            <p><span className="text-emerald-700">{tr("Đúng giờ", "On time")} {attendanceReady ? pct(stats.attendance.onTimeRate) : "—"}</span> <span className="ml-1 inline-flex rounded bg-rose-400/10 px-1.5 text-rose-800">{attendanceReady && stats.attendance.valid ? stats.attendance.late : "—"} {tr("lượt trễ", "late arrivals")}{attendanceReady && stats.attendance.lateRate !== null ? " · " + pct(stats.attendance.lateRate) : ""}</span></p>
          </Metric>
          <Metric label={tr("Nghỉ phép & gắn kết", "Leave and engagement")}
            value={leaveReady ? <>{stats.leaveTotal} <span className="text-sm font-medium text-slate-600">{tr("ngày lịch", "calendar days")}</span></> : "—"}
            icon={<CalendarDays size={17} />} accent="bg-emerald-400/15 text-emerald-700" surface="border-emerald-200/80 bg-white">
            <p>{tr("Điểm gắn kết", "Engagement score")} {stats.engagement === null ? "—" : fmt(stats.engagement) + " / 5.0"}</p>
            {engagement.data?.name && <p className="line-clamp-1" title={engagement.data.name}>{engagement.data.name}</p>}
          </Metric>
        </div>
        <div className="grid gap-4 xl:grid-cols-12">
          <Panel className="xl:col-span-7 border-t-rose-300 bg-white" title={tr("Phân bổ rủi ro nghỉ việc", "Attrition risk distribution")} subtitle={tr("Đánh giá đã lưu gần nhất tính đến cuối kỳ. Chọn cột để lọc biểu đồ giờ làm.", "Latest saved assessment by period end. Select a column to filter working hours.")}>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Segments name={tr("Nhóm rủi ro", "Risk grouping")} value={riskField} options={[["department", fieldTitle("department")], ["level", fieldTitle("level")], ["workShift", fieldTitle("workShift")]]} onChange={field => { setRiskField(field); setGroupDrilldown(null) }} />
              <Segments name={tr("Đơn vị rủi ro", "Risk units")} value={riskUnit} options={[["count", tr("Số người", "Headcount")], ["percent", tr("Tỷ lệ %", "Percentage")]]} onChange={setRiskUnit} />
            </div>
            {stats.unknown > 0 && <p className="mt-3 text-xs text-amber-800">{tr(`Thiếu kết quả của ${stats.unknown} nhân sự.`, `Results unavailable for ${stats.unknown} employees.`)}</p>}
            {riskReady && riskRows.length ? <RiskChart rows={riskRows} axis={riskField} asPercent={riskUnit === "percent"} selected={riskDrilldown} onLevel={selectRisk} onGroup={selectGroup} tr={tr} />
              : <div className="mt-4"><Empty>{emptyRisk}</Empty></div>}
          </Panel>
          <Panel className="xl:col-span-5 border-t-blue-400 bg-white" title={tr("Diễn biến tăng ca & giờ giấc", "Overtime and punctuality trend")} subtitle={dateSpan}>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <Segments name={tr("Đơn vị giờ làm", "Workload units")} value={timelineUnit} options={[["total", tr("Tổng giờ tăng ca", "Total overtime")], ["worked", tr("Bình quân người tăng ca", "Average for overtime workers")]]} onChange={setTimelineUnit} />
              {groupDrilldown && <button type="button" onClick={() => setGroupDrilldown(null)} className={secondary + " max-w-full text-sky-800"}>
                {categoryLabel(groupDrilldown.field, groupDrilldown.value, tr)} <X size={13} className="shrink-0" />
              </button>}
            </div>
            {attendanceReady && timelineAttendance.length ? <>
              <div className="mt-3 flex items-baseline justify-between gap-2 text-xs font-medium text-blue-900">
                <span>{tr("Tăng ca cả kỳ đang xem", "Overtime for the selected period")}</span>
                <span className="whitespace-nowrap rounded-lg border border-blue-200 bg-gradient-to-br from-white to-blue-100 px-2.5 py-1 text-sm font-semibold tabular-nums text-blue-900 shadow-sm">{timelineTotal.denominator === 0 ? "—" : formatChartHours(timelineTotal.hours)} {timelineUnit !== "total" ? tr("giờ/người", "h/person") : tr("giờ", "h")}</span>
              </div>
              {timelineUnit !== "total" && <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                {tr(`Chỉ tính người có tăng ca. Cả kỳ có ${timelineTotal.overtimePeople} người khác nhau, từng cột tính theo người tăng ca của tuần hoặc tháng đó.`, `Only employees with overtime. ${timelineTotal.overtimePeople} unique workers in the period, with each bar using its own week or month.`)}
              </p>}
              <Timeline rows={timelineRows} unit={timelineUnit} fmt={fmt} formatHours={formatChartHours} tr={tr} />
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                <span className="text-blue-700">{tr("● Giờ tăng ca", "● Overtime hours")}</span><span className="text-rose-700">{tr("● Tỷ lệ đi trễ", "● Late arrival rate")}</span><span className="text-amber-700">{tr("● Tỷ lệ về sớm", "● Early departure rate")}</span>
              </div>
              <p className="mt-2 border-t border-blue-100 pt-2 text-xs leading-relaxed text-slate-600">{tr("Trục phải (%) lấy số lượt đi trễ hoặc về sớm chia cho số lượt chấm công hợp lệ của từng mốc.", "Right axis (%): late arrivals or early departures divided by valid attendance records in each interval.")}</p>
            </> : attendanceLoading && !attendanceReady ? (
              <div role="status" className="mt-4 min-h-56 rounded-xl border border-blue-200/70 bg-gradient-to-br from-white to-blue-100/70 p-4">
                <div className="flex h-36 items-end justify-around gap-4 border-b border-blue-200 pb-2 motion-safe:animate-pulse" aria-hidden="true">
                  {[52, 74, 58, 85].map(height => <div key={height} className="w-8 rounded-t-lg bg-gradient-to-t from-blue-100 to-blue-300" style={{ height: height + "%" }} />)}
                </div>
                <p className="mt-3 text-sm font-medium text-blue-950">{tr("Đang tải dữ liệu chấm công…", "Loading attendance…")}</p>
              </div>
            ) : !attendanceError && <div className="mt-4"><Empty>{tr("Chưa có dữ liệu chấm công trong phạm vi này.", "No attendance data in this selection.")}</Empty></div>}
            {attendanceReady && attendanceLoading && <p role="status" className="mt-3 text-xs text-blue-800">{tr("Đang cập nhật số liệu chấm công…", "Refreshing attendance data…")}</p>}
            {attendanceError && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950" role="status">
              <p>{attendanceReady
                ? tr("Chưa cập nhật được. Đang hiển thị số liệu lần tải trước.", "Refresh unavailable. Showing the previous result.")
                : tr("Chưa tải được dữ liệu để hiển thị biểu đồ.", "Chart data is unavailable.")}</p>
              <button type="button" className={secondary} onClick={() => directoryReady ? setAttendanceRevision(value => value + 1) : setRevision(value => value + 1)}>
                <RefreshCw size={13} aria-hidden="true" />{tr("Thử lại", "Retry")}
              </button>
            </div>}
          </Panel>
        </div>
        <div className="grid gap-4 xl:grid-cols-12">
          <Panel className="xl:col-span-5 border-indigo-200 bg-white" headingIcon={<PieIcon size={17} />} headingTone="from-indigo-600 to-blue-500" title={tr("Cơ cấu đội ngũ", "Workforce composition")} subtitle={tr("Tỷ trọng trên tổng nhân sự đang xem.", "Share of employees in the current selection.")}>
            <div className="mt-3"><Segments name={tr("Nhóm cơ cấu", "Composition grouping")} value={teamField} options={[["contractType", tr("Hợp đồng", "Contract")], ["level", fieldTitle("level")], ["workShift", fieldTitle("workShift")]]} onChange={setTeamField} /></div>
            {stats.people.length ? <TeamDonut groups={groupPeople(stats.people, teamField).map(([key, rows]) => ({ key, name: categoryLabel(teamField, key, tr), value: rows.length }))} total={stats.people.length} fmt={fmt} tr={tr} />
              : <div className="mt-4"><Empty>{emptyCohort}</Empty></div>}
          </Panel>
          <Panel className="xl:col-span-7 border-emerald-200 bg-white" headingIcon={<Layers3 size={17} />} headingTone="from-emerald-700 to-teal-500" title={tr("Thâm niên & ngày nghỉ", "Tenure and leave")} subtitle={mix === "tenure" ? tr("Tỷ trọng nhân sự theo nhóm thâm niên.", "Employee share by tenure group.") : tr("Tỷ trọng trên tổng ngày lịch nghỉ trong kỳ.", "Share of calendar days on leave in the selected period.")}>
            <div className="mt-3"><Segments name={tr("Chế độ thâm niên và nghỉ phép", "Tenure and leave view")} value={mix} options={[["tenure", tr("Thâm niên công tác", "Tenure")], ["leave", tr("Tỷ trọng nghỉ phép", "Leave distribution")]]} onChange={setMix} /></div>
            {mix === "tenure" ? stats.people.length ? <div className="mt-4">
              <ul className="grid grid-cols-2 gap-2.5">
                {stats.tenure.map((count, index) => {
                  const share = percent(count, stats.people.length) ?? 0
                  return <li key={index} className="flex min-w-0 flex-col rounded-xl border border-emerald-100 bg-gradient-to-br from-white via-white to-emerald-50/65 px-3 py-3 shadow-[0_5px_16px_-12px_rgba(6,95,70,.6)] transition hover:border-emerald-300">
                    <h3 className="text-xs font-semibold text-slate-700">{tenureLabels[index]}</h3>
                    <p className="mb-2.5 mt-1 flex flex-wrap items-baseline gap-x-1.5">
                      <strong className="text-2xl font-bold tabular-nums text-slate-900">{count}</strong>
                      <span className="text-xs text-slate-600">{tr("nhân sự", "employees")}</span>
                      <span className="ml-auto rounded-md bg-emerald-100/90 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-emerald-800">{pct(share)}</span>
                    </p>
                    <div aria-hidden="true" className="mt-auto h-2 overflow-hidden rounded-full bg-emerald-900/10 shadow-inner">
                      <div className="h-full origin-left rounded-full bg-gradient-to-r from-teal-700 via-emerald-500 to-teal-300 motion-safe:starting:scale-x-0 motion-safe:transition-[width,scale] motion-safe:duration-700" style={{ width: share + "%" }} />
                    </div>
                  </li>
                })}
              </ul>
              {stats.tenureUnknown > 0 && <p className="mt-3 text-xs text-slate-500">{tr(`Chưa tính được thâm niên: ${stats.tenureUnknown} người`, `Tenure unavailable: ${stats.tenureUnknown} employees`)}</p>}
            </div> : <div className="mt-4"><Empty>{emptyCohort}</Empty></div>
            : leaveReady ? <div className="mt-5">
              <div className="relative flex h-5 overflow-hidden rounded-full bg-slate-100 shadow-inner ring-2 ring-slate-100 after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:h-2 after:bg-gradient-to-b after:from-white/40 after:to-transparent" aria-hidden="true">
                {leaveMix.map(item => <div key={item.name} className={`bg-gradient-to-r ${item.gradient}`} style={{ width: (percent(item.value, stats.leaveTotal) ?? 0) + "%" }} />)}
              </div>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-3">{leaveMix.map(({ name, value, tone, iconTone, icon: Icon }) => (
                <li key={name} className={`min-w-0 rounded-xl border p-3 shadow-sm ${tone}`}>
                  <div className="flex items-center gap-2">
                    <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${iconTone}`}><Icon size={15} aria-hidden="true" /></span>
                    <span className="text-xs font-semibold text-slate-700">{name}</span>
                  </div>
                  <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5 text-xs tabular-nums text-slate-600">
                    <strong className="text-lg text-slate-900">{value}</strong> {tr("ngày lịch", "calendar days")} · {pct(percent(value, stats.leaveTotal) ?? 0)}
                  </p>
                </li>
              ))}</ul>
            </div> : <div className="mt-4"><Empty>{tr("Chưa có ngày nghỉ trong phạm vi này.", "No leave days in this selection.")}</Empty></div>}
          </Panel>
        </div>
        <div className="grid gap-4 xl:grid-cols-12">
          <Panel className="self-start xl:col-span-8 border-orange-200 bg-white" headingIcon={<HeartHandshake size={17} />} headingTone="from-orange-700 to-amber-500" title={tr("Ưu tiên giữ chân", "Retention priorities")} subtitle={tr("Sắp theo mức rủi ro từ cao đến thấp.", "Sorted by risk from highest to lowest.")}>
            {riskDrilldown && <button type="button" className={secondary + " mt-3"} onClick={() => setRiskDrilldown(null)} aria-label={tr("Xóa lọc mức rủi ro", "Clear risk filter")}>
              {tr("Đang lọc", "Filtered by")} · {riskLabel(riskDrilldown, tr)} <X size={13} aria-hidden="true" />
            </button>}
            {riskReady ? <PriorityTable key={JSON.stringify([filters, riskDrilldown])} rows={priorities} levelName={key => categoryLabel("level", key, tr)} fmt={fmt} date={date} tr={tr} />
              : <div className="mt-4"><Empty>{emptyRisk}</Empty></div>}
          </Panel>
          <Panel className="self-start xl:col-span-4 border-amber-200 bg-white" headingIcon={<Gauge size={17} />} headingTone="from-amber-700 to-orange-500" title={tr("Áp lực giờ làm", "Workload pressure")} subtitle={ranking === "department" ? tr("Tăng ca bình quân trên toàn bộ nhân sự của từng phòng.", "Overtime averaged across all employees in each department.") : tr("Xếp theo tổng giờ tăng ca của từng nhân viên.", "Ranked by total overtime per employee.")}>
            <div className="mt-3"><Segments name={tr("Nhóm xếp hạng", "Ranking group")} value={ranking} options={[["department", fieldTitle("department")], ["employee", tr("Nhân sự", "Employee")]]} onChange={setRanking} /></div>
            <PressureList rows={attendanceReady ? pressure : []} unit={ranking === "department" ? tr("giờ/người", "h/person") : tr("giờ", "h")} fmt={fmt} tr={tr} />
          </Panel>
        </div>
      </div>
    </div>
  </AppShell>
}
