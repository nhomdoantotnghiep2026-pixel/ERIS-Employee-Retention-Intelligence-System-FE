import test from "node:test"
import assert from "node:assert/strict"
import {
  computeDashboardMetrics, dashboardPeriod, initialFilters, latestAtCutoff, riskFromScore, overtimeAxisTicks, overtimeMeasure, workloadBuckets,
  type EmployeeProfile, type RiskAssessmentRecord,
} from "../src/features/executive-dashboard/metrics.ts"

import { normalizeShift, shiftLabel } from "../src/features/executive-dashboard/shifts.ts"

const range = { from: "2026-11-01", to: "2026-11-26" }
const employees: EmployeeProfile[] = [1, 2, 3, 4].map(id => ({
  id, code: "EMP" + id, fullName: "Fixture " + id, department: id === 4 ? "B" : "A",
  position: "", level: "3", contractType: "FULL_TIME", workShift: "OFFICE", joinDate: "2024-11-01",
}))
const history: RiskAssessmentRecord[] = [
  { id: 1, employeeId: 1, assessedAt: "2026-11-05T10:00:00+07:00", riskLevel: "LOW", riskScore: 0.08 },
  { id: 2, employeeId: 1, assessedAt: "2026-11-26T23:59:59+07:00", riskLevel: "HIGH", riskScore: 0.8 },
  { id: 3, employeeId: 1, assessedAt: "2026-11-27T00:00:00+07:00", riskLevel: "LOW", riskScore: 0.08 },
  { id: 4, employeeId: 2, assessedAt: "2026-11-09T10:00:00+07:00", riskLevel: "MEDIUM", riskScore: 0.20 },
  { id: 5, employeeId: 3, assessedAt: "2026-10-01T10:00:00+07:00", riskLevel: "HIGH", riskScore: 0.9 },
]
const attendance = [
  { employeeId: 1, workDate: "2026-11-02", isValidWorkDay: true, isTardy: false, isEarlyLeave: false, overtimeHours: 1.5 },
  { employeeId: 2, workDate: "2026-11-02", isValidWorkDay: true, isTardy: true, isEarlyLeave: true, overtimeHours: 2 },
  { employeeId: 3, workDate: "2026-11-02", isValidWorkDay: false, isTardy: true, isEarlyLeave: true, overtimeHours: 0 },
]

test("cutoffs use Vietnam wall time and stable IDs for identical timestamps", () => {
  assert.deepEqual(dashboardPeriod("LAST_MONTH", "2026-01-12"), { from: "2025-12-01", to: "2025-12-31" })
  assert.deepEqual(dashboardPeriod("THIS_QUARTER", range.to), { from: "2026-10-01", to: range.to })
  assert.deepEqual(dashboardPeriod("LAST_12_MONTHS", range.to), { from: "2025-12-01", to: range.to })
  assert.equal(latestAtCutoff([...history.slice(0, 3), { ...history[1], id: 10 }], range.to)?.id, 10)
})

test("classifies the most recent valid result at period end", () => {
  const stats = computeDashboardMetrics(employees, history, new Set(), [], [], new Map(), initialFilters, range)
  assert.equal(stats.latest.get(1)?.id, 2)
  assert.equal(stats.latest.get(3)?.id, 5)
  assert.equal(stats.latest.has(4), false)
  assert.equal(stats.assessed, 3)
  assert.equal(stats.high, 2)
  assert.equal(stats.highRate, 2 / 3 * 100)
  assert.equal(stats.coverage, 75)
  const partial = computeDashboardMetrics(employees, history, new Set([1]), [], [], new Map(), initialFilters, range)
  assert.equal(partial.latest.has(1), false)
  assert.equal(partial.unknown, 1)
})

test("risk bands respect exact 10% and 20% boundaries", () => {
  assert.deepEqual([0, .099, .10, .20, .200001, 1].map(riskFromScore), ["LOW", "LOW", "MEDIUM", "MEDIUM", "HIGH", "HIGH"])
})

test("shift aliases produce one group and distinct short and full labels", () => {
  assert.equal(normalizeShift("SHIFT_2"), normalizeShift("CUSTOM_2", "Ca chiều"))
  assert.equal(normalizeShift(null, "Bán thời gian buổi chiều"), "PART_AFTERNOON")
  assert.equal(shiftLabel("PART_AFTERNOON", true), "BT chiều")
  assert.match(shiftLabel("PART_AFTERNOON", true, true), /13:00/)
})

test("overtime averages use their stated population and decimal axes cover sub-hour values", () => {
  assert.equal(overtimeMeasure({ overtime: 20, overtimePeople: 5 }, "worked").hours, 4)
  assert.equal(overtimeMeasure({ overtime: 0, overtimePeople: 0 }, "worked").denominator, 0)
  assert.deepEqual(overtimeAxisTicks(0.8, "worked"), [0, 0.2, 0.4, 0.6, 0.8])
  assert.deepEqual(overtimeAxisTicks(23, "total"), [0, 10, 20, 30])
})

test("attendance ratios use complete workdays and leave dates are clipped to the cohort and period", () => {
  const stats = computeDashboardMetrics(employees, [], new Set(), attendance, [
    { employeeId: 1, startDate: "2026-10-30", endDate: "2026-11-02", leaveCategory: "ANNUAL" },
    { employeeId: 4, startDate: "2026-11-03", endDate: "2026-11-04", leaveCategory: "OTHER" },
  ], new Map([[1, 3], [2, 4], [4, 5]]), { ...initialFilters, department: "A" }, range)
  assert.deepEqual(stats.attendance, { valid: 2, late: 1, early: 1, onTime: 1, overtime: 3.5, overtimePeople: 2, lateRate: 50, earlyRate: 50, onTimeRate: 50 })
  assert.equal(stats.leaveTotal, 2)
  assert.equal(stats.engagement, 3.5)
  const buckets = workloadBuckets(attendance, range)
  assert.equal(buckets.length, 1)
  assert.equal(buckets[0].late, 1)
  assert.equal(buckets[0].overtime, 3.5)
})
