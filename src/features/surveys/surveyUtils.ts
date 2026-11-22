import type {
  SurveyAnswerConfig,
  SurveyQuestionType,
  SurveyResults,
  SurveySummary,
} from "../../services/api"

export const ratingLabels = [
  "Rất không hài lòng",
  "Không hài lòng",
  "Không hài lòng cũng không bất mãn",
  "Hài lòng",
  "Rất hài lòng",
]

export const questionTypeLabels: Record<SurveyQuestionType, string> = {
  RATING: "Thang điểm 1–5",
  TEXT: "Câu trả lời văn bản",
  SINGLE_CHOICE: "Chọn một",
  MULTIPLE_CHOICE: "Chọn nhiều",
}

export const topicLabelsVi: Record<string, string> = {
  "compensation benefits": "Thu nhập & Phúc lợi",
  "working time": "Thời gian làm việc",
  "work environment": "Môi trường làm việc",
  "career development": "Phát triển sự nghiệp",
  management: "Năng lực quản lý",
  "employee engagement": "Mức độ gắn kết",
  "work life balance": "Cân bằng công việc & Cuộc sống",
  "communication culture": "Văn hóa giao tiếp",
  "job fit": "Mức độ phù hợp công việc",
  other: "Chủ đề khác",
}

export const dateWithZone = (date: string, endOfDay = false) =>
  `${date}T${endOfDay ? "23:59:59" : "00:00:00"}+07:00`

export const normalizedTopicName = (name: string) =>
  name.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ").toLocaleLowerCase()

export const topicLabel = (name: string, language = "vi") => {
  const normalized = normalizedTopicName(name)
  if (language === "vi" && topicLabelsVi[normalized]) return topicLabelsVi[normalized]
  return normalized
    .split(" ")
    .map((word) => word.charAt(0).toLocaleUpperCase() + word.slice(1))
    .join(" ")
}

export const isChoiceConfig = (config: SurveyAnswerConfig): config is {
  options: Array<{ code: string; label: string }>
} => Boolean(config && "options" in config)

export const isRatingConfig = (config: SurveyAnswerConfig): config is {
  min: 1
  max: 5
  labels: string[]
  templateCode?: string
} => Boolean(config && "labels" in config)

export const surveyResponseCount = (
  survey: SurveySummary,
  result?: SurveyResults,
) => result?.responseCount ?? survey.responseCount ?? 0

export const surveyInvitedCount = (
  survey: SurveySummary,
  result?: SurveyResults,
  totalEmployees = 0,
) => {
  const explicitCount =
    survey.targetAudienceCount ??
    result?.invitedCount ??
    survey.invitedCount ??
    survey.participantCount
  return explicitCount != null && explicitCount > 0
    ? explicitCount
    : totalEmployees
}

export const surveyResponseRate = (
  survey: SurveySummary,
  result?: SurveyResults,
  totalEmployees = 0,
) => {
  if (result?.completionRate != null) return result.completionRate
  const invited = surveyInvitedCount(survey, result, totalEmployees)
  return invited > 0
    ? Math.round((surveyResponseCount(survey, result) / invited) * 100)
    : 0
}

export const progressTone = (rate: number) =>
  rate < 25
    ? {
        fill: "from-rose-500 to-amber-500",
        text: "text-rose-600",
        hintVi: "Cần gửi nhắc nhở",
        hintEn: "Reminder recommended",
      }
    : rate < 60
      ? {
          fill: "from-amber-400 to-amber-500",
          text: "text-amber-600",
          hintVi: "Đang thu thập phản hồi",
          hintEn: "Collecting responses",
        }
      : rate < 85
        ? {
            fill: "from-blue-500 to-teal-400",
            text: "text-teal-600",
            hintVi: "Tiến độ tốt",
            hintEn: "Good progress",
          }
        : {
            fill: "from-teal-400 to-emerald-500",
            text: "text-emerald-600",
            hintVi: "Đủ tin cậy thống kê",
            hintEn: "Statistically reliable",
          }

export const topicIcon = (name: string) => {
  const value = name.toLocaleLowerCase()
  if (/salary|compensation|lương|benefit/.test(value)) return "💰"
  if (/hour|time|giờ|balance/.test(value)) return "⏰"
  if (/environment|workplace|môi trường/.test(value)) return "🏢"
  if (/career|promotion|growth|thăng|phát triển/.test(value)) return "🚀"
  if (/manager|leadership|quản lý/.test(value)) return "👥"
  if (/engagement|gắn kết/.test(value)) return "🤝"
  if (/communication|giao tiếp/.test(value)) return "💬"
  if (/job|fit|công việc/.test(value)) return "🎯"
  return "📝"
}

export const surveyAverageScore = (result?: SurveyResults) => {
  if (!result) return null
  const scored = result.categoryScores.filter(
    (item) => item.satisfactionScore != null,
  )
  if (!scored.length) return null
  const weight = scored.reduce(
    (sum, item) => sum + Math.max(1, item.responseCount),
    0,
  )
  return scored.reduce(
    (sum, item) =>
      sum + Number(item.satisfactionScore) * Math.max(1, item.responseCount),
    0,
  ) / weight
}

export function remainingLabel(survey: SurveySummary, language: string) {
  if (survey.status !== "ACTIVE" || !survey.endDate) return null
  const end = new Date(survey.endDate)
  if (Number.isNaN(end.getTime())) return null
  const days = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000))
  if (days <= 2)
    return {
      label:
        language === "vi"
          ? days === 0
            ? "Kết thúc hôm nay"
            : `Sắp kết thúc · còn ${days} ngày`
          : days === 0
            ? "Ends today"
            : `Ending soon · ${days} days left`,
      className: "border-amber-200 bg-amber-50 text-amber-800",
    }
  return {
    label: language === "vi" ? `Còn ${days} ngày` : `${days} days left`,
    className: "border-sky-200 bg-sky-50 text-sky-700",
  }
}

export const statusLabel: Record<
  SurveySummary["status"],
  { vi: string; en: string }
> = {
  ACTIVE: { vi: "Đang mở", en: "Active" },
  DRAFT: { vi: "Bản nháp", en: "Draft" },
  CLOSED: { vi: "Đã đóng", en: "Closed" },
}

