import { useEffect, useMemo, useRef, useState } from "react"
import {
  ApiError, getAiResult, getSurveyParticipants, listAiEmployeeResults, listDepartments,
  listEmployeeProfiles, listPositions, listSurveys, listWorkSchedules,
  type ApiDepartment, type ApiPosition, type AiResultHistoryItem, type WorkSchedule,
} from "../../services/api"
import { fetchAttendance, fetchLeaveRecords, type RecordFilters } from "../../services/attendance"
import { normalizeShift } from "./shifts"
import { leaveTypeDisplay } from "../../utils/leaveRecordDisplay"
import {
  endOfDay, latestAtCutoff, riskFromScore, toBusinessDate, type AttendanceRecord, type DateRange,
  type EmployeeProfile, type LeaveRequestRecord, type RiskAssessmentRecord,
} from "./metrics"

type Staff = Awaited<ReturnType<typeof listEmployeeProfiles>>["data"][number]
type Directory = {
  staff: Staff[] | null
  departments: ApiDepartment[]
  positions: ApiPosition[]
  schedules: WorkSchedule[]
  errors: Array<"staff" | "departments" | "positions" | "schedules">
}

const emptyDirectory: Directory = { staff: null, departments: [], positions: [], schedules: [], errors: [] }
const bulkSize = 200

async function readAttendancePage(filters: RecordFilters, own: boolean, signal: AbortSignal) {
  // Retry the affected page only, preserving pages already fetched and stopping on a period change.
  const fetchPage = () => fetchAttendance(filters, own, AbortSignal.any([signal, AbortSignal.timeout(30_000)]))
  try {
    return await fetchPage()
  } catch (error) {
    if (signal.aborted) throw error
    const transient = error instanceof ApiError && [0, 502, 503, 504].includes(error.status)
    if (!transient && !(error instanceof Error && error.name === "TimeoutError")) throw error
    return fetchPage()
  }
}
async function readPages<T>(
  read: (filters: RecordFilters, own: boolean, signal: AbortSignal) => Promise<{ data: T[]; limit: number }>,
  range: DateRange,
  signal: AbortSignal,
) {
  const rows: T[] = []
  for (;;) {
    const page = await read({ ...range, record_status: "ACTIVE", limit: bulkSize, offset: rows.length }, false, signal)
    rows.push(...page.data)
    if (page.data.length < (page.limit || bulkSize)) return rows
  }
}

async function mapLimited<T, U>(items: T[], task: (item: T) => Promise<U>, signal: AbortSignal) {
  const results: PromiseSettledResult<U>[] = []
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(items.length, 6) }, async () => {
    while (!signal.aborted && cursor < items.length) {
      const index = cursor++
      try {
        results[index] = { status: "fulfilled", value: await task(items[index]) }
      } catch (reason) {
        results[index] = { status: "rejected", reason }
      }
    }
  }))
  return results
}

function normalizeDirectory(directory: Directory): EmployeeProfile[] {
  const departments = new Map(directory.departments.map(row => [row.id, row.name]))
  const positions = new Map(directory.positions.map(row => [row.id, row]))
  const schedules = new Map(directory.schedules.map(row => [row.id, row]))
  return (directory.staff ?? []).map(row => {
    const position = positions.get(row.positionId)
    const schedule = schedules.get(row.workScheduleId ?? 0)
    return {
      id: row.id, code: row.employeeCode, fullName: row.fullName,
      department: departments.get(row.departmentId) || "",
      position: position?.name || "",
      level: position?.jobLevel ? String(position.jobLevel) : "",
      contractType: row.employmentType || "",
      workShift: normalizeShift(schedule?.shift_type, schedule?.name),
      joinDate: row.hireDate?.slice(0, 10) || "",
    }
  })
}

async function getEngagement(range: DateRange, signal: AbortSignal) {
  const cutoff = endOfDay(range.to)
  const surveys = (await listSurveys(signal)).data
    .filter(survey => survey.status !== "DRAFT" && survey.startDate && Date.parse(survey.startDate) <= cutoff && survey.responseCount !== 0)
    .sort((a, b) => Date.parse(b.startDate!) - Date.parse(a.startDate!) || b.id - a.id)
  for (const survey of surveys) {
    const { data } = await getSurveyParticipants(survey.id, signal)
    const scores = new Map<number, number>()
    for (const answer of data) {
      const time = Date.parse(answer.submittedAt || "")
      const score = Number(answer.satisfactionScore)
      if (answer.status === "SUBMITTED" && time <= cutoff && score >= 1 && score <= 5) scores.set(answer.employeeId, score)
    }
    if (scores.size) return { name: survey.title, scores }
  }
  return { name: "", scores: new Map<number, number>() }
}

type Histories = Array<{ employeeId: number; rows: AiResultHistoryItem[] | null }>
type Assessments = { periodKey: string; history: Histories; data: RiskAssessmentRecord[]; unavailable: Set<number> }
type Source<T> = { key: string; status: "loading" | "ready" | "error"; data: T | null; updated?: string }

function usePeriodSource<T>(
  range: DateRange,
  revision: number,
  load: (range: DateRange, signal: AbortSignal) => Promise<T>,
): Source<T> {
  const { from, to } = range
  const key = from + "/" + to
  const [source, setSource] = useState<Source<T>>({ key, status: "loading", data: null })
  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    setSource(previous => previous.key === key
      ? { ...previous, status: "loading" }
      : { key, status: "loading", data: null })
    void load({ from, to }, signal).then(data => {
      if (!signal.aborted) setSource({ key, status: "ready", data, updated: toBusinessDate(new Date()) })
    }).catch(() => {
      if (!signal.aborted) setSource(previous => ({ ...previous, status: "error" }))
    })
    return () => controller.abort()
  }, [from, to, key, revision, load])
  return source.key === key ? source : { key, status: "loading", data: null }
}

async function getAttendance(range: DateRange, signal: AbortSignal): Promise<AttendanceRecord[]> {
  return (await readPages(readAttendancePage, range, signal)).filter(row => row.record_status === "ACTIVE").map(row => ({
    employeeId: Number(row.employee_id), workDate: row.work_date,
    isValidWorkDay: Boolean(row.check_in && row.check_out && !["ABSENT", "HOLIDAY", "ON_LEAVE"].includes(row.attendance_status ?? "")),
    isTardy: Number(row.late_mins) > 0, isEarlyLeave: Number(row.early_mins) > 0,
    overtimeHours: Math.max(0, Number(row.overtime_minutes) || 0) / 60,
  }))
}

async function getLeaves(range: DateRange, signal: AbortSignal): Promise<LeaveRequestRecord[]> {
  return (await readPages(fetchLeaveRecords, range, signal)).filter(row => row.record_status === "ACTIVE").map(row => {
    const kind = leaveTypeDisplay(row.leave_type, row.leave_type_name, vi => vi).kind
    return {
      employeeId: Number(row.employee_id), startDate: row.start_date, endDate: row.end_date,
      leaveCategory: kind === "ANNUAL" ? "ANNUAL" : kind === "SICK" || kind === "UNPAID" ? "SICK_UNPAID" : "OTHER",
    }
  })
}

export function useDashboardData(range: DateRange, revision: number, attendanceRevision: number) {
  const [directory, setDirectory] = useState<Directory>(emptyDirectory)
  const [histories, setHistories] = useState<Histories | null>(null)
  const [assessments, setAssessments] = useState<Assessments | null>(null)
  const attendance = usePeriodSource(range, revision + attendanceRevision, getAttendance)
  const leaves = usePeriodSource(range, revision, getLeaves)
  const engagement = usePeriodSource(range, revision, getEngagement)
  const cachedDetails = useRef(new Map<number, RiskAssessmentRecord>())
  const { from, to } = range
  const periodKey = from + "/" + to
  const people = useMemo(() => normalizeDirectory(directory), [directory])

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    setDirectory(current => ({ ...current, errors: [] }))
    setHistories(null)
    cachedDetails.current.clear()

    const load = async <T extends keyof Omit<Directory, "errors">>(
      key: T, promise: Promise<{ data: NonNullable<Directory[T]> }>,
    ) => {
      try {
        const { data } = await promise
        if (!signal.aborted) setDirectory(previous => ({ ...previous, [key]: data }))
        return signal.aborted ? undefined : data
      } catch {
        if (!signal.aborted) setDirectory(previous => ({ ...previous, errors: [...previous.errors, key] }))
      }
    }

    void load("departments", listDepartments(signal, { limit: Number.MAX_SAFE_INTEGER }))
    void load("positions", listPositions(signal, { limit: Number.MAX_SAFE_INTEGER }))
    void load("schedules", listWorkSchedules(signal))
    void load("staff", listEmployeeProfiles({ limit: Number.MAX_SAFE_INTEGER, employmentStatus: "ACTIVE" }, signal)
      .then(({ data }) => ({ data: data.filter(row => row.employmentStatus === "ACTIVE") })))
      .then(async active => {
        if (!active || signal.aborted) return
        const result = await mapLimited(active, async employee => (await listAiEmployeeResults(employee.id, signal)).data, signal)
        if (!signal.aborted) setHistories(result.map((row, index) => ({ employeeId: active[index].id, rows: row.status === "fulfilled" ? row.value : null })))
      })
    return () => controller.abort()
  }, [revision])

  useEffect(() => {
    if (!histories) return
    const controller = new AbortController()
    const { signal } = controller
    const unavailable = new Set(histories.filter(row => !row.rows).map(row => row.employeeId))
    const candidates = histories.flatMap(({ employeeId, rows }) => {
      const chosen = rows && latestAtCutoff(rows.map(row => ({ id: row.predictionId, assessedAt: row.createdAt })), to)
      return chosen ? [{ employeeId, ...chosen }] : []
    })
    const cache = cachedDetails.current
    void mapLimited(candidates, async candidate => {
      const existing = cache.get(candidate.id)
      if (existing) return existing
      const { data } = await getAiResult(candidate.id, signal)
      const score = data.model?.score
      if (!Number.isFinite(score) || score < 0 || score > 1 || Number(data.preview?.employee?.id) !== candidate.employeeId) throw new Error()
      const result: RiskAssessmentRecord = {
        ...candidate, riskScore: score,
        riskLevel: riskFromScore(score),
      }
      if (!signal.aborted) cache.set(candidate.id, result)
      return result
    }, signal).then(results => {
      if (signal.aborted) return
      const data: RiskAssessmentRecord[] = []
      results.forEach((result, index) => {
        if (result.status === "fulfilled") data.push(result.value)
        else unavailable.add(candidates[index].employeeId)
      })
      setAssessments({ periodKey, history: histories, data, unavailable })
    })
    return () => controller.abort()
  }, [histories, to, periodKey])

  return {
    directory, employees: people,
    assessments: assessments?.periodKey === periodKey && assessments.history === histories ? assessments : null,
    attendance, leaves, engagement,
  }
}
