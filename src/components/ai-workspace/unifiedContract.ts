export interface UnifiedAnalyzeRequest {
  snapshotId: number
  confirmExternalData: true
  save: boolean
  evidencePeriod?: {
    from: string
    to: string
  }
}

export interface UnifiedAnalyzeResponse {
  saved: boolean
  predictionId?: number
  snapshotId?: number
  createdAt?: string
  preview: {
    employee: {
      id: number
      employeeCode?: string
      fullName?: string
      [key: string]: unknown
    }
    snapshotId: number
    capturedAt: string
    period?: {
      start: string
      end: string
    }
    features: Record<string, string | number>
  }
  model: {
    score: number
    base_value: number
    contributions: Record<string, number>
    riskLevel: string
    predictionLabel: boolean
    assessment: {
      status: "REVIEW_REQUIRED" | "NO_ALERT"
      label: string
      threshold: number
      scorePoints: number
      thresholdPoints: number
      explanation: string
    }
  }
  policyAnalysis: {
    provider: "E5+OLLAMA"
    model: string
    generatedAt: string
    requiresHrReview: true
    autoApplied: false
    selection: {
      employeeId: number
      from: string
      to: string
      surveyIds: number[]
      includeAttendance: true
    }
    recommendations: Array<{
      policy: {
        id: string
        code: string
        name: string
        description: string | null
      }
      reason: string
      evidence: Array<Record<string, unknown>>
      hrVerification: string
    }>
    noRecommendationReason: string | null
  }
}

export function validEvidencePeriod(
  from: string,
  to: string,
  today: string,
): boolean {
  const validDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  return (
    validDate(from) &&
    validDate(to) &&
    from <= to &&
    to <= today &&
    (Date.parse(to) - Date.parse(from)) / 86400000 <= 365
  )
}
