export type RiskLevel = "HIGH" | "MEDIUM" | "LOW" | "UNASSESSED"
export type Period = "THIS_MONTH" | "LAST_MONTH" | "THIS_QUARTER" | "LAST_12_MONTHS"
export type DateRange = { from: string; to: string }
export type ProfileField = "department" | "level" | "contractType" | "workShift"
export type DashboardFilterState = Record<ProfileField, string> & { period: Period }

export interface EmployeeProfile {
  id: number
  code: string
  fullName: string
  department: string
  position: string
  level: string
  contractType: string
  workShift: string
  joinDate: string
}

export interface RiskAssessmentRecord {
  id: number
  employeeId: number
  assessedAt: string
  riskScore: number
  riskLevel: Exclude<RiskLevel, "UNASSESSED">
}

export interface AttendanceRecord {
  employeeId: number
  workDate: string
  isValidWorkDay: boolean
  isTardy: boolean
  isEarlyLeave: boolean
  overtimeHours: number
}

export interface LeaveRequestRecord {
  employeeId: number
  startDate: string
  endDate: string
  leaveCategory: "ANNUAL" | "SICK_UNPAID" | "OTHER"
}

export const riskFromScore = (score: number): RiskAssessmentRecord["riskLevel"] =>
  score > 0.20 ? "HIGH" : score >= 0.10 ? "MEDIUM" : "LOW"

export const riskLevels = ["LOW", "MEDIUM", "HIGH", "UNASSESSED"] as const
export const initialFilters: DashboardFilterState = {
  department: "ALL", level: "ALL", contractType: "ALL", workShift: "ALL", period: "THIS_MONTH",
}
export const toBusinessDate = (date: Date) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(date)

const dateKey = (date: Date) => date.toISOString().slice(0, 10)
const dayMs = 86_400_000
const dayTime = (date: string) => Date.parse(date + "T00:00:00Z")
export const endOfDay = (date: string) => Date.parse(date + "T23:59:59.999+07:00")
const scopeFields = ["department", "level", "contractType", "workShift"] as const
export const percent = (part: number, total: number) => total > 0 ? part / total * 100 : null

export function dashboardPeriod(period: Period, today: string): DateRange {
  const [year, month] = today.split("-").map(Number)
  const fromMonth = period === "LAST_MONTH" ? month - 2
    : period === "THIS_QUARTER" ? Math.floor((month - 1) / 3) * 3
    : period === "LAST_12_MONTHS" ? month - 12 : month - 1
  return {
    from: dateKey(new Date(Date.UTC(year, fromMonth, 1))),
    to: period === "LAST_MONTH" ? dateKey(new Date(Date.UTC(year, month - 1, 0))) : today,
  }
}

export function latestAtCutoff<T extends { id: number; assessedAt: string }>(history: T[], cutoff: string): T | undefined {
  let latest: T | undefined
  let latestTime = -Infinity
  const end = endOfDay(cutoff)
  for (const row of history) {
    const time = Date.parse(row.assessedAt)
    if (time <= end && (time > latestTime || (time === latestTime && row.id > (latest?.id ?? 0)))) {
      latest = row
      latestTime = time
    }
  }
  return latest
}

export function groupPeople(people: EmployeeProfile[], field: ProfileField) {
  const groups = new Map<string, EmployeeProfile[]>()
  for (const person of people) {
    const group = groups.get(person[field]) ?? []
    group.push(person)
    groups.set(person[field], group)
  }
  return [...groups]
}

export function summarizeAttendance(rows: AttendanceRecord[]) {
  let valid = 0, late = 0, early = 0, onTime = 0, overtime = 0
  for (const row of rows) {
    overtime += row.overtimeHours
    if (!row.isValidWorkDay) continue
    valid++
    late += Number(row.isTardy)
    early += Number(row.isEarlyLeave)
    onTime += Number(!row.isTardy && !row.isEarlyLeave)
  }
  const overtimePeople = new Set(rows.filter(row => row.overtimeHours > 0).map(row => row.employeeId)).size
  return { valid, late, early, onTime, overtime, overtimePeople, lateRate: percent(late, valid), earlyRate: percent(early, valid), onTimeRate: percent(onTime, valid) }
}

export function computeDashboardMetrics(
  employees: EmployeeProfile[],
  assessments: RiskAssessmentRecord[],
  unavailable: Set<number>,
  attendance: AttendanceRecord[],
  leaves: LeaveRequestRecord[],
  engagement: Map<number, number>,
  filters: DashboardFilterState,
  range: DateRange,
) {
  const people = employees.filter(person => scopeFields.every(field => filters[field] === "ALL" || filters[field] === person[field]))
  const peopleIds = new Set(people.map(person => person.id))
  const latest = new Map<number, RiskAssessmentRecord>()
  const cutoff = endOfDay(range.to)
  for (const row of assessments) {
    const time = Date.parse(row.assessedAt)
    if (!peopleIds.has(row.employeeId) || !Number.isFinite(time) || !Number.isFinite(row.riskScore) || row.riskScore < 0 || row.riskScore > 1 || time > cutoff || unavailable.has(row.employeeId)) continue
    const previous = latest.get(row.employeeId)
    const previousTime = previous ? Date.parse(previous.assessedAt) : -Infinity
    if (time > previousTime || (time === previousTime && row.id > (previous?.id ?? 0))) latest.set(row.employeeId, { ...row, riskLevel: riskFromScore(row.riskScore) })
  }
  const assessed = [...latest.values()]
  const high = assessed.filter(row => row.riskLevel === "HIGH").length
  const workload = attendance.filter(row => peopleIds.has(row.employeeId) && row.workDate >= range.from && row.workDate <= range.to)
  const attendanceByPerson = new Map<number, AttendanceRecord[]>()
  for (const row of workload) {
    const group = attendanceByPerson.get(row.employeeId) ?? []
    group.push(row)
    attendanceByPerson.set(row.employeeId, group)
  }
  const leaveDays = { ANNUAL: 0, SICK_UNPAID: 0, OTHER: 0 }
  for (const row of leaves) {
    if (!peopleIds.has(row.employeeId)) continue
    const first = row.startDate > range.from ? row.startDate : range.from
    const last = row.endDate < range.to ? row.endDate : range.to
    const days = (dayTime(last) - dayTime(first)) / dayMs + 1
    if (days > 0) leaveDays[row.leaveCategory] += days
  }
  const scores = people.flatMap(person => {
    const value = engagement.get(person.id)
    return value === undefined || value < 1 || value > 5 || !Number.isFinite(value) ? [] : [value]
  })
  const tenure = [0, 0, 0, 0]
  let tenureUnknown = 0
  for (const person of people) {
    const joined = new Date(dayTime(person.joinDate))
    if (!Number.isFinite(joined.getTime()) || person.joinDate > range.to) {
      tenureUnknown++
      continue
    }
    const anniversary = (years: number) => {
      const year = joined.getUTCFullYear() + years
      const month = joined.getUTCMonth()
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
      return dateKey(new Date(Date.UTC(year, month, Math.min(joined.getUTCDate(), lastDay))))
    }
    tenure[range.to < anniversary(1) ? 0 : range.to < anniversary(3) ? 1 : range.to <= anniversary(5) ? 2 : 3]++
  }

  return {
    people, latest, workload, attendanceByPerson, leaveDays, tenure, tenureUnknown,
    attendance: summarizeAttendance(workload),
    engagement: scores.length ? scores.reduce((total, value) => total + value, 0) / scores.length : null,
    assessed: assessed.length, high, unknown: people.filter(person => unavailable.has(person.id)).length,
    coverage: percent(assessed.length, people.length), highRate: percent(high, assessed.length),
    leaveTotal: Object.values(leaveDays).reduce((total, value) => total + value, 0),
  }
}

export type OvertimeUnit = "total" | "worked"

export function overtimeMeasure<T extends { overtime: number; overtimePeople: number }>(totals: T, unit: OvertimeUnit) {
  const denominator = unit === "worked" ? totals.overtimePeople : null
  return { ...totals, denominator, hours: denominator === null ? totals.overtime : denominator > 0 ? totals.overtime / denominator : 0 }
}

export function overtimeAxisTicks(max: number, unit: OvertimeUnit) {
  if (max <= 0) return unit === "total" ? [0, 1] : [0, 0.25, 0.5, 0.75, 1]
  const target = max / 4
  const magnitude = 10 ** Math.floor(Math.log10(target))
  const rounded = [1, 2, 2.5, 5, 10].map(factor => factor * magnitude).find(value => value >= target) ?? 10 * magnitude
  const step = unit === "total" && max >= 1 ? Math.max(1, Math.ceil(rounded)) : rounded
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, index) => Number((index * step).toPrecision(12)))
}

export function workloadBuckets(rows: AttendanceRecord[], range: DateRange) {
  const days = (dayTime(range.to) - dayTime(range.from)) / dayMs + 1
  const byMonth = days > 100
  const buckets: Array<{ from: string; to: string; rows: AttendanceRecord[] }> = []
  for (let from = range.from; from <= range.to;) {
    const date = new Date(dayTime(from))
    const next = byMonth ? dateKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)))
      : dateKey(new Date(date.getTime() + dayMs * 7))
    const end = dateKey(new Date(dayTime(next) - dayMs))
    buckets.push({ from, to: end < range.to ? end : range.to, rows: [] })
    from = next
  }
  for (const row of rows) buckets.find(bucket => row.workDate >= bucket.from && row.workDate <= bucket.to)?.rows.push(row)
  return buckets.flatMap(({ rows, ...bucket }, index) => rows.length ? [{ ...bucket, index, byMonth, ...summarizeAttendance(rows) }] : [])
}
