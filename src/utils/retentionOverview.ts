import type { EmployeeProfile, PolicyRecommendation } from "../services/api"

export type OverviewRecommendation = PolicyRecommendation & {
  createdAt?: string
  attritionProbability?: number
  modelVersion?: string
  riskLevel?: string | null
}
export function overviewPriorities(
  employees: EmployeeProfile[],
  recommendations: OverviewRecommendation[],
) {
  const active = new Map(
    employees
      .filter((e) => e.employmentStatus === "ACTIVE")
      .map((e) => [Number(e.id), e]),
  )
  const latest = new Map<number, OverviewRecommendation>()
  for (const item of recommendations) {
    if (
      !active.has(Number(item.employee.id)) ||
      item.dataSource !== "STORED" ||
      !item.modelVersion?.startsWith("mexwell-") ||
      typeof item.attritionProbability !== "number" ||
      !Number.isFinite(item.attritionProbability) ||
      item.attritionProbability < 0 ||
      item.attritionProbability > 1
    )
      continue
    const old = latest.get(Number(item.employee.id))
    if (!old || item.predictionResultId > old.predictionResultId)
      latest.set(Number(item.employee.id), item)
  }
  return [...latest.values()]
    .map((item) => ({
      ...item,
      profile: active.get(Number(item.employee.id))!,
      count: recommendations.filter(
        (r) =>
          r.predictionResultId === item.predictionResultId &&
          r.dataSource === "STORED",
      ).length,
    }))
    .sort(
      (a, b) =>
        b.attritionProbability! - a.attritionProbability! ||
        a.employee.id - b.employee.id,
    )
}
export function overviewScoreBins(scores: number[]) {
  const counts = [0, 0, 0, 0, 0];
  for (const score of scores) if (Number.isFinite(score) && score >= 0 && score <= 1) counts[Math.min(4, Math.floor(score * 100 / 20))]++;
  return counts;
}

export function normalizeOverviewGender(value: string | null | undefined): 'male' | 'female' | 'other' | 'unknown' {
  const key = value?.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (['male', 'nam', 'm'].includes(key ?? '')) return 'male';
  if (['female', 'nu', 'f'].includes(key ?? '')) return 'female';
  if (['other', 'khac', 'o'].includes(key ?? '')) return 'other';
  return 'unknown';
}
