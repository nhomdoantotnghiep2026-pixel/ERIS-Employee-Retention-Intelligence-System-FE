import copy from './insight-copy.json'

// Raw contribution scale, never percentage points. Explicit upper boundaries avoid multiplication drift.
export const THRESHOLDS = {
  Department: [0.002875, 0.008625], Hire_Date: [0.002570, 0.007710],
  Work_Hours_Per_Week: [0.002478, 0.007434], Employee_Satisfaction_Score: [0.002450, 0.007350],
  Overtime_Hours: [0.001893, 0.005679], Age: [0.001814, 0.005442],
  Sick_Days: [0.001792, 0.005376], Monthly_Salary: [0.001645, 0.004935],
  Years_At_Company: [0.001243, 0.003729], Gender: [0.001089, 0.003267],
  Promotions: [0.000920, 0.002760], Education_Level: [0.000901, 0.002703],
} as const
export type Feature = keyof typeof THRESHOLDS
export type Evidence = Partial<Record<Feature, {
  // Only source-backed context: assessment runs are NOT survey/work reporting periods.
  variables?: Record<string, string | number | null | undefined>
  verified?: boolean
  hasPeriodHistory?: boolean
}>>
export type Signal = {
  feature: Feature; value: number; direction: 'positive' | 'negative'; strength: 'Moderate' | 'Strong'
  insight: string | null; policy: string | null; missing: string[]; needsEvidence: boolean
  source: 'explainable_shap'; internalReview: boolean; rank: number
  availableSummary: string | null; missingLabels: string[]
}
const templates = copy as Record<string, Record<string, {insight: string; policy: string}>>
const available = (v: unknown): v is string | number =>
  typeof v === 'number' ? Number.isFinite(v) : typeof v === 'string' && v.trim().length > 0
const displayValue = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
  ? value.toLocaleString('vi-VN', {maximumFractionDigits: 2})
  : value

function snapshotDate(features: Record<string, unknown>) {
  const raw = features.__snapshotDate ?? features.__capturedAt
  const date = new Date(String(raw ?? ''))
  return Number.isFinite(date.getTime()) ? date : null
}
function formatSnapshotDate(features: Record<string, unknown>) {
  return snapshotDate(features)?.toLocaleDateString('vi-VN', {timeZone: 'Asia/Bangkok'}) ?? null
}
// Use the fixed profile features requested for these templates.
// Work_Hours_Per_Week is scheduled hours; Sick_Days is recorded leave/absence.
// The copy remains unchanged; comparison/history variables need separate data.
export function referenceVariables(feature: Feature, features: Record<string, unknown>) {
  const variables: Record<string, unknown> = {}
  const overtimeHours = features.Overtime_Hours
  const satisfactionScore = features.Employee_Satisfaction_Score
  const tenureYears = features.Years_At_Company
  const ageYears = features.Age
  const weeklyHours = features.Work_Hours_Per_Week
  const recordedLeaveDays = features.Sick_Days
  if (feature === 'Work_Hours_Per_Week') variables.x = displayValue(weeklyHours)
  if (feature === 'Sick_Days') {
    variables.x = displayValue(recordedLeaveDays)
    const date = formatSnapshotDate(features)
    if (date) variables['kỳ'] = `từ đầu năm đến ${date}`
  }
  if (feature === 'Overtime_Hours') {
    variables.x = displayValue(overtimeHours)
    const date = formatSnapshotDate(features)
    if (date) variables['kỳ'] = `từ đầu năm đến ${date}`
  }
  if (feature === 'Employee_Satisfaction_Score') variables.x = displayValue(satisfactionScore)
  if (feature === 'Years_At_Company') variables.x = displayValue(tenureYears)
  if (feature === 'Age') variables.x = displayValue(ageYears)
  if (feature === 'Hire_Date') {
    const captured = snapshotDate(features)
    const hired = String(features.Hire_Date ?? '')
    if (captured && /^\d{4}-\d{2}-\d{2}$/.test(hired)) {
      const parts = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(captured)
      const part = (type: string) => parts.find(p => p.type === type)?.value
      const snapshotDay = Date.parse(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`)
      const hireDay = Date.parse(`${hired}T00:00:00Z`)
      const calendarDaysSinceHire = (snapshotDay - hireDay) / 86_400_000
      if (Number.isFinite(calendarDaysSinceHire) && calendarDaysSinceHire >= 0) variables.x = displayValue(calendarDaysSinceHire)
    }
  }
  return variables
}
export function fillTemplate(template: string, variables: Record<string, unknown>, feature: string, warn = console.warn) {
  const missing = [...new Set([...template.matchAll(/\{([^}]+)\}/g)].map(m => m[1]).filter(k => !available(variables[k])))]
  void feature; void warn
  return { text: template.replace(/\{([^}]+)\}/g, (token, k) => available(variables[k]) ? String(variables[k]) : token), missing }
}

export function buildInsights(contributions: Record<string, number> | undefined, features: Record<string, unknown>, evidence: Evidence = {}, warn = console.warn) {
  const eligible = Object.entries(THRESHOLDS).flatMap(([key, limits]) => {
    const feature = key as Feature, value = contributions?.[key]
    if (typeof value !== 'number' || !Number.isFinite(value) || value === 0 || Math.abs(value) < limits[0]) return []
    return [{feature, value, direction: value > 0 ? 'positive' as const : 'negative' as const,
      strength: Math.abs(value) >= limits[1] ? 'Strong' as const : 'Moderate' as const}]
  }).sort((a,b) => Math.abs(b.value) - Math.abs(a.value) || a.feature.localeCompare(b.feature))
  // Age and Gender remain profile data and must not consume the 3 risk / 3
  // retention explanation slots shown to HR.
  const explainable = eligible.filter(candidate => candidate.feature !== 'Age' && candidate.feature !== 'Gender')
  const positiveCandidates = explainable.filter(candidate => candidate.direction === 'positive').slice(0, 3)
  const negativeCandidates = explainable.filter(candidate => candidate.direction === 'negative').slice(0, 3)
  const candidates = [...positiveCandidates, ...negativeCandidates]
  const render = (candidate: typeof candidates[number]): Omit<Signal, 'rank'> => {
    const { feature, direction, strength } = candidate
    const context = evidence[feature]
    const variables: Record<string, unknown> = {...referenceVariables(feature, features), ...context?.variables}
    let template = templates[feature]?.[direction + strength]
    if (feature === 'Age') template = {
      insight: 'Nhân viên {x} tuổi. Mục tiêu nghề nghiệp hiện được ghi nhận là {mục tiêu}.',
      policy: 'Trao đổi về định hướng, kỹ năng muốn phát triển và cơ hội phù hợp. Lập kế hoạch theo nhu cầu nhân viên chia sẻ, theo dõi tiến độ như các nhân viên khác.',
    }
    if (feature === 'Gender') template = {
      insight: 'Nhân viên phản ánh khó tiếp cận {cơ hội/hỗ trợ}',
      policy: 'HR tiếp nhận phản hồi, đối chiếu tiêu chí và cách thực hiện, xử lý rào cản đã xác nhận. Thống nhất đầu mối phản hồi và theo dõi việc giải quyết.',
    }
    const insight = fillTemplate(template.insight, variables, feature, warn)
    const policy = fillTemplate(template.policy, variables, feature, warn)
    const missing = [...new Set([...insight.missing, ...policy.missing])]
    return {...candidate, insight: insight.text, policy: policy.text,
      missing, missingLabels: [], needsEvidence: false,
      source: 'explainable_shap' as const, internalReview: feature === 'Age' || feature === 'Gender',
      availableSummary: null}
  }
  const positive = positiveCandidates.map((candidate, index) => ({...render(candidate), rank: index + 1}))
  const negative = negativeCandidates.map((candidate, index) => ({...render(candidate), rank: index + 1}))
  const selected = [...positive, ...negative]
  return {
    missingContributions: !contributions || !Object.values(contributions).some(v => typeof v === 'number' && Number.isFinite(v)),
    source: 'result.model.contributions (Explainable SHAP)' as const,
    selected,
    positive: positive.filter(c => !c.internalReview),
    negative: negative.filter(c => !c.internalReview),
    internalReview: selected.filter(c => c.internalReview),
  }
}
