import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Database,
  FileWarning,
  MessageSquare,
  RefreshCw,
  UsersRound,
} from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { Popover } from "radix-ui"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AppShell } from "../components/AppShell"
import { Button } from "../components/ui/button"
import { Card } from "../components/ui/card"
import { useLanguage } from "../context/LanguageContext"
import { useRole } from "../context/RoleContext"
import {
  getApiErrorMessage,
  listAiEmployees,
  listDepartments,
  listEmployeeProfiles,
  listPolicyRecommendations,
  listSurveys,
  type AiEmployee,
  type ApiDepartment,
  type EmployeeProfile,
  type SurveySummary,
} from "../services/api"
import {
  fetchAttendance,
  fetchLeaveRecords,
  type ImportedAttendance,
  type LeaveRecord,
} from "../services/attendance"
import {
  overviewPriorities,
  type OverviewRecommendation,
} from "../utils/retentionOverview"

type RiskBand = "high" | "medium" | "safe"

interface DashboardData {
  employees: EmployeeProfile[]
  eligible: AiEmployee[]
  departments: ApiDepartment[]
  surveys: SurveySummary[]
  recommendations: OverviewRecommendation[]
  currentAttendance: ImportedAttendance[]
  previousAttendance: ImportedAttendance[]
  currentLeave: LeaveRecord[]
  previousLeave: LeaveRecord[]
}

interface BehaviorTotals {
  lateEarly: number
  overtime: number
  shortLeaves: number
}

const emptyData: DashboardData = {
  employees: [],
  eligible: [],
  departments: [],
  surveys: [],
  recommendations: [],
  currentAttendance: [],
  previousAttendance: [],
  currentLeave: [],
  previousLeave: [],
}

const riskBand = (score: number): RiskBand =>
  score >= 0.7 ? "high" : score >= 0.4 ? "medium" : "safe"

const calendarDays = (record: LeaveRecord) => {
  const start = new Date(`${record.start_date}T00:00:00Z`).getTime()
  const end = new Date(`${record.end_date}T00:00:00Z`).getTime()
  return Number.isFinite(start) && Number.isFinite(end)
    ? Math.max(0, Math.floor((end - start) / 86_400_000) + 1)
    : 0
}

const dateBounds = () => {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
  const currentStart = `${today.slice(0, 7)}-01`
  const startDate = new Date(`${currentStart}T00:00:00Z`)
  const previousStart = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() - 1, 1),
  )
  const previousEnd = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 0),
  )
  const iso = (date: Date) => date.toISOString().slice(0, 10)
  return {
    today,
    currentStart,
    previousStart: iso(previousStart),
    previousEnd: iso(previousEnd),
  }
}

function aggregateBehavior(
  attendance: ImportedAttendance[],
  leave: LeaveRecord[],
) {
  const totals = new Map<number, BehaviorTotals>()
  const get = (id: number) => {
    const current = totals.get(id) ?? {
      lateEarly: 0,
      overtime: 0,
      shortLeaves: 0,
    }
    totals.set(id, current)
    return current
  }
  attendance
    .filter((row) => row.record_status === "ACTIVE")
    .forEach((row) => {
      const item = get(Number(row.employee_id))
      item.lateEarly += Number(row.late_mins || 0) + Number(row.early_mins || 0)
      item.overtime += Number(row.overtime_minutes || 0)
    })
  leave
    .filter((row) => row.record_status === "ACTIVE")
    .forEach((row) => {
      if (calendarDays(row) <= 2) get(Number(row.employee_id)).shortLeaves += 1
    })
  return totals
}

function KpiCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode
  label: string
  value: string | number
  detail: string
  tone: "red" | "amber" | "blue" | "emerald"
}) {
  const colors = {
    red: "border-red-100 bg-red-50 text-red-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
  }
  return (
    <Card className="group min-h-32 justify-between overflow-hidden p-4 transition duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold leading-5 text-slate-600">
          {label}
        </p>
        <span
          aria-hidden="true"
          className={`flex size-9 shrink-0 items-center justify-center rounded-md border transition-transform duration-200 group-hover:scale-105 ${colors[tone]}`}
        >
          {icon}
        </span>
      </div>
      <div>
        <p className="text-[1.65rem] font-bold leading-none tracking-tight tabular-nums text-slate-950">
          {value}
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-600">{detail}</p>
      </div>
    </Card>
  )
}

function PriorityPanel({
  loading,
  priorities,
  departments,
  behaviorTags,
  tr,
}: {
  loading: boolean
  priorities: ReturnType<typeof overviewPriorities>
  departments: ApiDepartment[]
  behaviorTags: (employeeId: number) => string[]
  tr: (vi: string, en: string) => string
}) {
  return (
    <Card className="h-full overflow-hidden p-0 transition-shadow duration-200 hover:shadow-[0_10px_28px_rgba(15,23,42,0.07)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-slate-950">
            {tr("Danh sách ưu tiên xử lý", "Priority review list")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {tr(
              "Điểm AI đã lưu và tín hiệu import trong tháng.",
              "Saved AI scores and current-month import signals.",
            )}
          </p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link to="/ai-analysis">
            <BrainCircuit size={15} />
            {tr("Phân tích AI", "AI analysis")}
          </Link>
        </Button>
      </div>
      {loading ? (
        <p className="p-5 text-sm text-slate-600">
          {tr("Đang tổng hợp dữ liệu...", "Compiling data...")}
        </p>
      ) : priorities.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-2.5 font-bold">
                  {tr("Nhân viên", "Employee")}
                </th>
                <th className="px-4 py-2.5 font-bold">
                  {tr("Rủi ro AI", "AI risk")}
                </th>
                <th className="px-4 py-2.5 font-bold">
                  {tr("Dấu hiệu dữ liệu", "Data signals")}
                </th>
                <th className="px-4 py-2.5 text-right font-bold">
                  {tr("Thao tác", "Action")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {priorities.slice(0, 5).map((item) => {
                const band = riskBand(item.attritionProbability!)
                const tags = behaviorTags(Number(item.employee.id))
                const departmentName = departments.find(
                  (department) =>
                    Number(department.id) === Number(item.profile.departmentId),
                )?.name
                const badge =
                  band === "high"
                    ? "bg-red-50 text-red-700"
                    : band === "medium"
                      ? "bg-amber-50 text-amber-800"
                      : "bg-emerald-50 text-emerald-700"
                return (
                  <tr
                    key={item.employee.id}
                    className="align-middle transition-colors hover:bg-orange-50/40"
                  >
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-950">
                        {item.employee.fullName}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {item.employee.employeeCode} ·{" "}
                        {departmentName || tr("Chưa xác định", "Unspecified")}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md px-2 py-1 text-xs font-bold tabular-nums ${badge}`}
                      >
                        {(item.attritionProbability! * 100).toFixed(1)}% ·{" "}
                        {band === "high"
                          ? tr("Cao", "High")
                          : band === "medium"
                            ? tr("Trung bình", "Medium")
                            : tr("An toàn", "Safe")}
                      </span>
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {tags.length ? (
                          tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-md bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-800"
                            >
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500">
                            {tr(
                              "Chưa có tín hiệu bất thường",
                              "No unusual signal",
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-blue-700 hover:underline"
                        to="/ai-analysis"
                      >
                        {tr("Chi tiết & đề xuất", "Details & suggestions")}
                        <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <CheckCircle2 size={28} className="text-slate-400" />
          <h3 className="mt-2 font-semibold text-slate-900">
            {tr("Chưa có kết quả AI đã lưu", "No saved AI results")}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {tr(
              "Chạy và lưu phân tích AI để tạo danh sách ưu tiên.",
              "Run and save AI analysis to create a priority list.",
            )}
          </p>
        </div>
      )}
    </Card>
  )
}

export default function Dashboard() {
  const { language } = useLanguage()
  const { user } = useRole()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const [data, setData] = useState<DashboardData>(emptyData)
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<string[]>([])
  const [errorPopoverOpen, setErrorPopoverOpen] = useState(false)
  const [revision, setRevision] = useState(0)
  const [now, setNow] = useState(() => new Date())
  const bounds = useMemo(dateBounds, [])
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let live = true
    setLoading(true)
    setErrors([])
    const requests = [
      listEmployeeProfiles({ limit: Number.MAX_SAFE_INTEGER }),
      listAiEmployees(),
      listDepartments(undefined, { limit: Number.MAX_SAFE_INTEGER }),
      listSurveys(),
      listPolicyRecommendations(),
      fetchAttendance({
        from: bounds.currentStart,
        to: bounds.today,
        record_status: "ACTIVE",
        limit: 10_000,
        offset: 0,
      }),
      fetchAttendance({
        from: bounds.previousStart,
        to: bounds.previousEnd,
        record_status: "ACTIVE",
        limit: 10_000,
        offset: 0,
      }),
      fetchLeaveRecords({
        from: bounds.currentStart,
        to: bounds.today,
        record_status: "ACTIVE",
        limit: 10_000,
        offset: 0,
      }),
      fetchLeaveRecords({
        from: bounds.previousStart,
        to: bounds.previousEnd,
        record_status: "ACTIVE",
        limit: 10_000,
        offset: 0,
      }),
    ] as const
    void Promise.allSettled(requests).then((results) => {
      if (!live) return
      const next = { ...emptyData }
      const names = [
        tr("hồ sơ nhân viên", "employee profiles"),
        tr("đầu vào AI", "AI inputs"),
        tr("phòng ban", "departments"),
        tr("khảo sát", "surveys"),
        tr("kết quả AI", "AI results"),
        tr("chấm công tháng này", "current attendance"),
        tr("chấm công tháng trước", "previous attendance"),
        tr("hồ sơ nghỉ tháng này", "current leave"),
        tr("hồ sơ nghỉ tháng trước", "previous leave"),
      ]
      if (results[0].status === "fulfilled")
        next.employees = results[0].value.data
      if (results[1].status === "fulfilled")
        next.eligible = results[1].value.data
      if (results[2].status === "fulfilled")
        next.departments = results[2].value.data
      if (results[3].status === "fulfilled")
        next.surveys = results[3].value.data
      if (results[4].status === "fulfilled")
        next.recommendations = results[4].value.data
      if (results[5].status === "fulfilled")
        next.currentAttendance = results[5].value.data
      if (results[6].status === "fulfilled")
        next.previousAttendance = results[6].value.data
      if (results[7].status === "fulfilled")
        next.currentLeave = results[7].value.data
      if (results[8].status === "fulfilled")
        next.previousLeave = results[8].value.data
      setErrors(
        results.flatMap((result, index) =>
          result.status === "rejected"
            ? [
                `${names[index]}: ${getApiErrorMessage(result.reason, tr("Không tải được dữ liệu.", "Could not load data."))}`,
              ]
            : [],
        ),
      )
      setData(next)
      setLoading(false)
    })
    return () => {
      live = false
    }
  }, [bounds, revision])

  const activeEmployees = useMemo(
    () =>
      data.employees.filter(
        (employee) => employee.employmentStatus === "ACTIVE",
      ),
    [data.employees],
  )
  const priorities = useMemo(
    () => overviewPriorities(activeEmployees, data.recommendations),
    [activeEmployees, data.recommendations],
  )
  const currentBehavior = useMemo(
    () => aggregateBehavior(data.currentAttendance, data.currentLeave),
    [data.currentAttendance, data.currentLeave],
  )
  const previousBehavior = useMemo(
    () => aggregateBehavior(data.previousAttendance, data.previousLeave),
    [data.previousAttendance, data.previousLeave],
  )
  const activeIds = useMemo(
    () => new Set(activeEmployees.map((employee) => Number(employee.id))),
    [activeEmployees],
  )

  const anomalyIds = useMemo(() => {
    const ids = new Set<number>()
    currentBehavior.forEach((current, id) => {
      if (!activeIds.has(id)) return
      const previous = previousBehavior.get(id) ?? {
        lateEarly: 0,
        overtime: 0,
        shortLeaves: 0,
      }
      if (
        current.overtime >= 2_400 ||
        (current.lateEarly >= 120 &&
          current.lateEarly > Math.max(60, previous.lateEarly * 1.5)) ||
        (current.shortLeaves >= 2 &&
          current.shortLeaves > previous.shortLeaves * 1.5)
      )
        ids.add(id)
    })
    return ids
  }, [activeIds, currentBehavior, previousBehavior])

  const attendanceIds = new Set(
    data.currentAttendance.map((row) => Number(row.employee_id)),
  )
  const eligibleIds = new Set(
    data.eligible.map((employee) => Number(employee.id)),
  )
  const missingInputIds = new Set(
    activeEmployees
      .filter(
        (employee) =>
          !attendanceIds.has(Number(employee.id)) ||
          !eligibleIds.has(Number(employee.id)),
      )
      .map((employee) => Number(employee.id)),
  )
  const highRiskCount = priorities.filter(
    (item) => riskBand(item.attritionProbability!) === "high",
  ).length
  const mediumRiskCount = priorities.filter(
    (item) => riskBand(item.attritionProbability!) === "medium",
  ).length
  const safeRiskCount = priorities.filter(
    (item) => riskBand(item.attritionProbability!) === "safe",
  ).length
  const unscoredCount = Math.max(0, activeEmployees.length - priorities.length)
  const riskDistribution = [
    { name: tr("Cao", "High"), value: highRiskCount, color: "#ef4444" },
    {
      name: tr("Trung bình", "Medium"),
      value: mediumRiskCount,
      color: "#f59e0b",
    },
    { name: tr("An toàn", "Safe"), value: safeRiskCount, color: "#10b981" },
    {
      name: tr("Chưa đánh giá", "Not evaluated"),
      value: unscoredCount,
      color: "#cbd5e1",
    },
  ]
  const highRiskRate = activeEmployees.length
    ? Math.round((highRiskCount / activeEmployees.length) * 100)
    : 0
  const activeSurveys = data.surveys.filter(
    (survey) => survey.status === "ACTIVE",
  )
  const surveyResponses = activeSurveys.reduce(
    (total, survey) => total + Number(survey.responseCount || 0),
    0,
  )
  const surveyInvited = activeSurveys.reduce(
    (total, survey) =>
      total + Number(survey.invitedCount || survey.participantCount || 0),
    0,
  )
  const surveyRate = surveyInvited
    ? Math.min(100, Math.round((surveyResponses / surveyInvited) * 100))
    : null

  const departmentRows = data.departments
    .map((department) => {
      const employees = activeEmployees.filter(
        (employee) => Number(employee.departmentId) === Number(department.id),
      )
      const ids = new Set(employees.map((employee) => Number(employee.id)))
      const results = priorities.filter((item) =>
        ids.has(Number(item.employee.id)),
      )
      return {
        ...department,
        total: employees.length,
        evaluated: results.length,
        high: results.filter(
          (item) => riskBand(item.attritionProbability!) === "high",
        ).length,
        medium: results.filter(
          (item) => riskBand(item.attritionProbability!) === "medium",
        ).length,
        safe: results.filter(
          (item) => riskBand(item.attritionProbability!) === "safe",
        ).length,
      }
    })
    .filter((row) => row.total > 0)
    .sort(
      (left, right) =>
        right.high - left.high ||
        right.medium - left.medium ||
        right.total - left.total,
    )

  const overtimeEmployees = [...currentBehavior.entries()].filter(
    ([id, item]) => activeIds.has(id) && item.overtime >= 2_400,
  ).length
  const attendanceSpikeEmployees = [...currentBehavior.entries()].filter(
    ([id, current]) => {
      if (!activeIds.has(id)) return false
      const previous = previousBehavior.get(id)?.lateEarly ?? 0
      return (
        current.lateEarly >= 120 &&
        current.lateEarly > Math.max(60, previous * 1.5)
      )
    },
  ).length
  const shortLeaveEmployees = [...currentBehavior.entries()].filter(
    ([id, current]) => {
      if (!activeIds.has(id)) return false
      const previous = previousBehavior.get(id)?.shortLeaves ?? 0
      return current.shortLeaves >= 2 && current.shortLeaves > previous * 1.5
    },
  ).length
  const pendingSurveyResponses = Math.max(0, surveyInvited - surveyResponses)

  const behaviorTags = (employeeId: number) => {
    const current = currentBehavior.get(employeeId)
    const previous = previousBehavior.get(employeeId) ?? {
      lateEarly: 0,
      overtime: 0,
      shortLeaves: 0,
    }
    if (!current) return []
    const tags: string[] = []
    if (current.overtime >= 2_400)
      tags.push(
        tr(
          `Tăng ca ${(current.overtime / 60).toFixed(1)} giờ`,
          `${(current.overtime / 60).toFixed(1)} overtime hours`,
        ),
      )
    if (
      current.lateEarly >= 120 &&
      current.lateEarly > Math.max(60, previous.lateEarly * 1.5)
    )
      tags.push(
        tr(
          `Đi muộn/về sớm ${current.lateEarly} phút`,
          `${current.lateEarly} late/early minutes`,
        ),
      )
    if (
      current.shortLeaves >= 2 &&
      current.shortLeaves > previous.shortLeaves * 1.5
    )
      tags.push(
        tr(
          `Nghỉ ngắn ${current.shortLeaves} lần`,
          `${current.shortLeaves} short leaves`,
        ),
      )
    return tags
  }

  const latestDate = (values: Array<string | undefined>) =>
    values
      .filter((value): value is string => !!value)
      .sort()
      .at(-1)
  const latestAttendance = latestDate(
    data.currentAttendance.map((row) => row.work_date),
  )
  const latestLeave = latestDate(data.currentLeave.map((row) => row.start_date))
  const formatDate = (value?: string) =>
    value
      ? new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
          dateStyle: "short",
          timeZone: "Asia/Ho_Chi_Minh",
        }).format(new Date(`${value}T00:00:00Z`))
      : tr("Chưa có dữ liệu", "No data")
  const vietnamHour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(now),
  )
  const greeting =
    vietnamHour < 12
      ? tr("Chào buổi sáng", "Good morning")
      : vietnamHour < 18
        ? tr("Chào buổi chiều", "Good afternoon")
        : tr("Chào buổi tối", "Good evening")
  const liveTime = new Intl.DateTimeFormat(
    language === "vi" ? "vi-VN" : "en-US",
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
    },
  ).format(now)
  const liveDate = new Intl.DateTimeFormat(
    language === "vi" ? "vi-VN" : "en-US",
    {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Ho_Chi_Minh",
    },
  ).format(now)
  const kpis: Array<{
    label: string
    value: string | number
    detail: string
    tone: "red" | "amber" | "blue" | "emerald"
    icon: ReactNode
  }> = [
    {
      label: tr("Tổng nhân sự", "Total employees"),
      value: loading ? "-" : activeEmployees.length,
      detail: tr("Hồ sơ đang hoạt động", "Active employee profiles"),
      tone: "blue",
      icon: <UsersRound size={18} />,
    },
    {
      label: tr("Rủi ro nghỉ việc cao", "High attrition risk"),
      value: loading ? "-" : highRiskCount,
      detail: tr(
        `${highRiskRate}% tổng nhân sự`,
        `${highRiskRate}% of workforce`,
      ),
      tone: "red",
      icon: <BrainCircuit size={18} />,
    },
    {
      label: tr("Cảnh báo công & nghỉ", "Attendance & leave alerts"),
      value: loading ? "-" : anomalyIds.size,
      detail: tr("Biến động so với tháng trước", "Changes from last month"),
      tone: "amber",
      icon: <Activity size={18} />,
    },
    {
      label: tr("Thiếu dữ liệu đầu vào", "Missing input data"),
      value: loading ? "-" : missingInputIds.size,
      detail: tr("Cần bổ sung trước phân tích", "Complete before analysis"),
      tone: "blue",
      icon: <FileWarning size={18} />,
    },
    {
      label: tr("Tỷ lệ phản hồi khảo sát", "Survey response rate"),
      value: loading || surveyRate === null ? "-" : `${surveyRate}%`,
      detail: surveyInvited
        ? tr(
            `${surveyResponses}/${surveyInvited} lượt phản hồi`,
            `${surveyResponses}/${surveyInvited} responses`,
          )
        : tr("Chưa có người tham gia", "No participant data"),
      tone: "emerald",
      icon: <MessageSquare size={18} />,
    },
  ]

  return (
    <AppShell breadcrumb={[tr("Tổng quan", "Overview")]}>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="-m-4 min-h-full bg-[#f6f8fb] p-4 sm:-m-5 sm:p-5 lg:-m-6 lg:p-6"
      >
        <header className="overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-orange-50/50 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between lg:p-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-orange-700">
                <span className="size-2 rounded-full bg-orange-500 shadow-[0_0_0_4px_rgba(249,115,22,0.12)]" />
                {tr("ERIS · TỔNG QUAN NHÂN SỰ", "ERIS · WORKFORCE OVERVIEW")}
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-[-0.025em] text-slate-950 sm:text-3xl">
                {tr("Tổng quan cần xử lý", "HR action overview")}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                {greeting},{" "}
                <strong className="font-semibold text-slate-900">
                  {user.name}
                </strong>
                .{" "}
                {tr(
                  "Theo dõi rủi ro, dữ liệu vận hành và những vấn đề cần HR ưu tiên.",
                  "Track risk, operational data, and the issues HR should prioritize.",
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm">
                <CalendarDays
                  size={15}
                  className="text-orange-600"
                  aria-hidden="true"
                />
                <span>{liveDate}</span>
                <span className="h-4 w-px bg-slate-200" aria-hidden="true" />
                <time className="tabular-nums text-slate-950">{liveTime}</time>
              </div>
              <Button
                variant="outline"
                size="lg"
                disabled={loading}
                onClick={() => setRevision((value) => value + 1)}
              >
                <RefreshCw
                  size={15}
                  className={loading && !reduceMotion ? "animate-spin" : ""}
                  aria-hidden="true"
                />
                {tr("Làm mới", "Refresh")}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 bg-white/70 px-5 py-3 text-xs text-slate-600 lg:px-6">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-1.5 rounded-full bg-blue-500"
                aria-hidden="true"
              />
              {tr("Chấm công đến", "Attendance through")}{" "}
              <strong className="text-slate-900">
                {formatDate(latestAttendance)}
              </strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-1.5 rounded-full bg-amber-500"
                aria-hidden="true"
              />
              {tr("Nghỉ phép đến", "Leave through")}{" "}
              <strong className="text-slate-900">
                {formatDate(latestLeave)}
              </strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-1.5 rounded-full bg-emerald-500"
                aria-hidden="true"
              />
              <strong className="text-slate-900">{activeSurveys.length}</strong>{" "}
              {tr("khảo sát đang mở", "open surveys")}
            </span>
          </div>
        </header>

        {errors.length > 0 && (
          <div
            role="alert"
            className="mt-3 flex min-h-10 flex-col items-stretch gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 shadow-sm sm:flex-row sm:items-center"
          >
            <AlertTriangle
              size={16}
              className="mt-0.5 hidden shrink-0 sm:block"
              aria-hidden="true"
            />
            <p className="min-w-0 flex-1 font-medium leading-5">
              {tr(
                "Thiếu một số nguồn dữ liệu; chỉ số liên quan có thể chưa đầy đủ.",
                "Some data sources are unavailable; affected metrics may be incomplete.",
              )}
            </p>
            <Popover.Root
              open={errorPopoverOpen}
              onOpenChange={setErrorPopoverOpen}
            >
              <Popover.Trigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start sm:justify-center"
                >
                  {tr("Xem chi tiết lỗi", "View error details")}
                </Button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  align="end"
                  sideOffset={8}
                  className="z-[80] w-[min(380px,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 text-slate-700 shadow-xl outline-none"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                      <AlertTriangle size={16} />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-950">
                        {tr(
                          "Nguồn dữ liệu chưa tải được",
                          "Data sources unavailable",
                        )}
                      </p>
                      <p className="text-xs text-slate-600">
                        {tr(
                          `${errors.length} lỗi cần kiểm tra`,
                          `${errors.length} errors to review`,
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="max-h-56 space-y-2 overflow-y-auto">
                    {errors.map((error) => (
                      <p
                        key={error}
                        className="rounded-lg bg-slate-50 p-3 text-xs leading-5"
                      >
                        {error}
                      </p>
                    ))}
                  </div>
                  <Popover.Arrow className="fill-white" />
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
            <Button
              asChild
              size="sm"
              className="bg-amber-900 text-white hover:bg-amber-950"
            >
              <Link to="/attendance">{tr("Nhập ngay", "Import now")}</Link>
            </Button>
          </div>
        )}

        <section
          className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
          aria-label={tr("Chỉ số cần chú ý", "Attention metrics")}
        >
          {kpis.map((item, index) => (
            <motion.div
              key={item.label}
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.28,
                delay: reduceMotion ? 0 : 0.04 + index * 0.04,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <KpiCard {...item} />
            </motion.div>
          ))}
        </section>

        <section className="mt-4 grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.75fr)]">
          <PriorityPanel
            loading={loading}
            priorities={priorities}
            departments={data.departments}
            behaviorTags={behaviorTags}
            tr={tr}
          />

          <Card className="p-5 transition-shadow duration-200 hover:shadow-[0_10px_28px_rgba(15,23,42,0.07)]">
            <div>
              <h2 className="text-base font-bold text-slate-950">
                {tr("Phân bổ mức độ rủi ro", "Risk distribution")}
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                {tr(
                  "Theo kết quả AI gần nhất đã lưu.",
                  "Based on the latest saved AI results.",
                )}
              </p>
            </div>
            <div
              className="relative mt-2 h-48"
              role="img"
              aria-label={tr(
                "Biểu đồ phân bổ mức độ rủi ro nghỉ việc",
                "Attrition risk distribution chart",
              )}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={
                      activeEmployees.length
                        ? riskDistribution
                        : [
                            {
                              name: tr("Chưa có dữ liệu", "No data"),
                              value: 1,
                              color: "#e2e8f0",
                            },
                          ]
                    }
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={82}
                    paddingAngle={activeEmployees.length ? 2 : 0}
                    strokeWidth={0}
                    isAnimationActive={!reduceMotion}
                  >
                    {(activeEmployees.length
                      ? riskDistribution
                      : [{ color: "#e2e8f0" }]
                    ).map((entry, index) => (
                      <Cell
                        key={`${entry.color}-${index}`}
                        fill={entry.color}
                      />
                    ))}
                  </Pie>
                  {activeEmployees.length > 0 && (
                    <ChartTooltip
                      contentStyle={{
                        borderRadius: 12,
                        borderColor: "#e2e8f0",
                        boxShadow: "0 8px 24px rgba(15,23,42,.08)",
                      }}
                    />
                  )}
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <strong className="text-3xl tabular-nums text-slate-950">
                  {loading ? "-" : activeEmployees.length}
                </strong>
                <span className="text-xs font-medium text-slate-600">
                  {tr("nhân sự", "employees")}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {riskDistribution.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center gap-2 text-xs text-slate-600"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <strong className="tabular-nums text-slate-900">
                    {loading ? "-" : item.value}
                  </strong>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="mt-4 grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.75fr)]">
          <Card className="p-5 transition-shadow duration-200 hover:shadow-[0_10px_28px_rgba(15,23,42,0.07)]">
            <h2 className="text-base font-bold text-slate-950">
              {tr(
                "Rủi ro nghỉ việc theo phòng ban",
                "Attrition risk by department",
              )}
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              {tr(
                "So sánh số nhân viên đã được AI đánh giá.",
                "Comparison of employees evaluated by AI.",
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] font-medium text-slate-600">
              {[
                ["bg-red-500", tr("Cao", "High")],
                ["bg-amber-400", tr("Trung bình", "Medium")],
                ["bg-emerald-500", tr("An toàn", "Safe")],
              ].map(([color, label]) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <span className={`size-2.5 shrink-0 rounded-full ${color}`} />
                  {label}
                </span>
              ))}
            </div>
            <div className="hidden">
              {departmentRows.map((row) => {
                const unscored = row.total - row.evaluated
                return (
                  <div
                    key={row.id}
                    className="grid grid-cols-[90px_minmax(0,1fr)_36px] items-center gap-2"
                  >
                    <span
                      className="truncate text-xs font-semibold text-slate-800"
                      title={row.name}
                    >
                      {row.name}
                    </span>
                    <div
                      className="flex h-3.5 overflow-hidden rounded-md bg-slate-100"
                      title={`${row.evaluated}/${row.total} ${tr("đã đánh giá", "evaluated")}`}
                    >
                      {row.high > 0 && (
                        <span
                          className="bg-red-500"
                          style={{ width: `${(row.high / row.total) * 100}%` }}
                        />
                      )}
                      {row.medium > 0 && (
                        <span
                          className="bg-amber-400"
                          style={{
                            width: `${(row.medium / row.total) * 100}%`,
                          }}
                        />
                      )}
                      {row.safe > 0 && (
                        <span
                          className="bg-emerald-500"
                          style={{ width: `${(row.safe / row.total) * 100}%` }}
                        />
                      )}
                      {unscored > 0 && (
                        <span
                          className="bg-slate-300"
                          style={{ width: `${(unscored / row.total) * 100}%` }}
                        />
                      )}
                    </div>
                    <span
                      className="text-right text-xs font-bold tabular-nums text-slate-700"
                      aria-label={`${row.evaluated}/${row.total} ${tr("đã đánh giá", "evaluated")}`}
                    >
                      {row.evaluated}/{row.total}
                    </span>
                  </div>
                )
              })}
              {!loading && departmentRows.length === 0 && (
                <p className="rounded-md bg-slate-50 p-5 text-center text-sm text-slate-600">
                  {tr("Chưa có dữ liệu phòng ban.", "No department data.")}
                </p>
              )}
            </div>
            <div
              className="mt-4 h-64"
              role="img"
              aria-label={tr(
                "Biểu đồ rủi ro nghỉ việc theo phòng ban",
                "Attrition risk by department chart",
              )}
            >
              {departmentRows.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={departmentRows}
                    margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                    barGap={3}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke="#e2e8f0"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      tickFormatter={(value: string) =>
                        value.length > 12 ? `${value.slice(0, 11)}…` : value
                      }
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ChartTooltip
                      cursor={{ fill: "#f8fafc" }}
                      contentStyle={{
                        borderRadius: 12,
                        borderColor: "#e2e8f0",
                        boxShadow: "0 8px 24px rgba(15,23,42,.08)",
                      }}
                    />
                    <Bar
                      dataKey="high"
                      name={tr("Cao", "High")}
                      fill="#ef4444"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={18}
                      isAnimationActive={!reduceMotion}
                    />
                    <Bar
                      dataKey="medium"
                      name={tr("Trung bình", "Medium")}
                      fill="#f59e0b"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={18}
                      isAnimationActive={!reduceMotion}
                    />
                    <Bar
                      dataKey="safe"
                      name={tr("An toàn", "Safe")}
                      fill="#10b981"
                      radius={[5, 5, 0, 0]}
                      maxBarSize={18}
                      isAnimationActive={!reduceMotion}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-600">
                  {tr("Chưa có dữ liệu phòng ban.", "No department data.")}
                </div>
              )}
            </div>
            <p className="hidden">
              {tr(
                "Ngưỡng hiển thị: Cao ≥70%, Trung bình 40–69,9%, An toàn <40%. Chỉ dùng để ưu tiên rà soát.",
                "Display bands: High ≥70%, Medium 40–69.9%, Safe <40%. For review prioritization only.",
              )}
            </p>
          </Card>

          <Card className="p-5 transition-shadow duration-200 hover:shadow-[0_10px_28px_rgba(15,23,42,0.07)]">
            <h2 className="text-base font-bold text-slate-950">
              {tr("Tín hiệu cảnh báo phổ biến", "Top risk signals")}
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              {tr("Từ dữ liệu tháng hiện tại.", "From current-month data.")}
            </p>
            <div className="mt-3 divide-y divide-slate-100">
              {[
                {
                  icon: <Clock3 size={15} />,
                  label: tr(
                    "Tăng ca từ 40 giờ/tháng",
                    "At least 40 overtime hours",
                  ),
                  value: overtimeEmployees,
                  color: "text-red-700 bg-red-50",
                },
                {
                  icon: <CalendarClock size={15} />,
                  label: tr("Đi muộn/về sớm tăng", "Late/early time increased"),
                  value: attendanceSpikeEmployees,
                  color: "text-amber-700 bg-amber-50",
                },
                {
                  icon: <ClipboardList size={15} />,
                  label: tr("Nghỉ ngắn ngày tăng", "Short leave increased"),
                  value: shortLeaveEmployees,
                  color: "text-orange-700 bg-orange-50",
                },
                {
                  icon: <MessageSquare size={15} />,
                  label: tr(
                    "Khảo sát chưa phản hồi",
                    "Outstanding survey responses",
                  ),
                  value: pendingSurveyResponses,
                  color: "text-blue-700 bg-blue-50",
                },
              ].map((signal) => (
                <div
                  key={signal.label}
                  className="flex min-h-10 items-center gap-2 py-2"
                >
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-md ${signal.color}`}
                  >
                    {signal.icon}
                  </span>
                  <p className="min-w-0 flex-1 text-xs font-medium text-slate-700">
                    {signal.label}
                  </p>
                  <strong className="tabular-nums text-slate-950">
                    {loading ? "-" : signal.value}
                  </strong>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <div className="mt-4 flex items-start gap-2 rounded-md border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <Database
            size={16}
            className="mt-0.5 shrink-0 text-orange-600"
            aria-hidden="true"
          />
          <p>
            {tr(
              "Dashboard chỉ tổng hợp dữ liệu đã lưu trong ERIS. Các tín hiệu là chỉ báo hỗ trợ HR kiểm tra, không phải kết luận tự động hay quyết định nhân sự.",
              "The dashboard only summarizes data saved in ERIS. Signals support HR review and are not automated conclusions or employment decisions.",
            )}
          </p>
        </div>
      </motion.div>
    </AppShell>
  )
}
