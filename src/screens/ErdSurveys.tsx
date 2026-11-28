import { SelectControl } from "../components/ui/select-control"
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"

import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ClipboardList,
  Eye,
  FilePlus2,
  Gauge,
  ListChecks,
  MessageSquareText,
  Pencil,
  PlayCircle,
  Plus,
  Radio,
  Search,
  Send,
  Sparkles,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react"

import { AppShell } from "../components/AppShell"

import {
  Button,
  Card,
  ConfirmationDialog,
  EmptyState,
  SectionHeader,
} from "../components/ui"

import { SurveyResultDetails } from "../components/SurveyResultDetails"

import EmployeeSurveyHistory from "../components/EmployeeSurveyHistory"

import { useLanguage } from "../context/LanguageContext"

import { useRole } from "../context/RoleContext"

import { useAutoDismissFeedback } from "../hooks/useAutoDismissState"

import { SurveyKpiCard } from "../features/surveys/SurveyKpiCard"

import { SurveyDraftEditor } from "../features/surveys/SurveyDraftEditor"

import { SurveyPreviewModal } from "../features/surveys/SurveyPreviewModal"

import { SurveyQuestionWizard } from "../features/surveys/SurveyQuestionWizards"

import {
  surveyAreaClass as area,
  surveyControlClass as control,
  surveyStudioBody, surveyStudioFooter, surveyStudioQuestions, surveyStudioSettings, surveyStudioShell,
} from "../features/surveys/surveyStyles"

import {
  createEmptySurveyDraft as emptyDraft,
  createEmptySurveyQuestion as emptyQuestion,
  type SurveyAnswerDraft as AnswerDraft,
  type SurveyDraft as Draft,
  type SurveyQuestionDraft as QuestionDraft,
} from "../features/surveys/surveyTypes"

import {
  dateWithZone,
  isChoiceConfig,
  isRatingConfig,
  progressTone,
  questionTypeLabels,
  ratingLabels,
  remainingLabel,
  statusLabel,
  surveyAverageScore,
  surveyResponseCount,
  surveyResponseRate,
  topicIcon,
  topicLabel,
} from "../features/surveys/surveyUtils"

import { useDialogBehavior } from "../features/surveys/useDialogBehavior"

import { rememberCompletedSurvey } from "../utils/completedSurveys"

import { employeeDate } from "../utils/employeeDates"

import {
  ApiError,
  addSurveyQuestion,
  closeSurvey,
  createSurvey,
  deleteSurveyQuestion,
  getApiErrorMessage,
  getSurveyForEmployee,
  getSurveyParticipants,
  getSurveyResults,
  listAvailableSurveys,
  listDepartments,
  listEmployeeProfiles,
  listSurveyCategories,
  listSurveys,
  publishSurvey,
  submitSurveyResponse,
  updateSurvey,
  updateSurveyQuestion,
  type SurveyAnswerConfig,
  type SurveyAnswerValue,
  type SurveyCategory,
  type SurveyParticipant,
  type SurveyQuestion,
  type SurveyQuestionInput,
  type SurveyQuestionType,
  type SurveyResults,
  type SurveySummary,
  type EmployeeProfile,
  type ApiDepartment,
} from "../services/api"

const control =
  "mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"

const area =
  "mt-2 min-h-24 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"

const dateWithZone = (date: string, endOfDay = false) =>
  `${date}T${endOfDay ? "23:59:59" : "00:00:00"}+07:00`

const ratingLabels = [
  "Rất không hài lòng",
  "Không hài lòng",
  "Bình thường",
  "Hài lòng",
  "Rất hài lòng",
]

const questionTypeLabels: Record<SurveyQuestionType, string> = {
  RATING: "Thang điểm 1–5",
  TEXT: "Câu trả lời văn bản",
  SINGLE_CHOICE: "Chọn một",
  MULTIPLE_CHOICE: "Chọn nhiều",
}

const topicLabelsVi: Record<string, string> = {
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

const normalizedTopicName = (name: string) =>
  name.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ").toLocaleLowerCase()

const topicLabel = (name: string, language = "vi") => {
  const normalized = normalizedTopicName(name)
  if (language === "vi" && topicLabelsVi[normalized]) return topicLabelsVi[normalized]
  return normalized
    .split(" ")
    .map((word) => word.charAt(0).toLocaleUpperCase() + word.slice(1))
    .join(" ")
}

const isChoiceConfig = (config: SurveyAnswerConfig): config is {
  options: Array<{ code: string; label: string }>
} => Boolean(config && "options" in config)

const isRatingConfig = (config: SurveyAnswerConfig): config is {
  min: 1
  max: 5
  labels: string[]
  templateCode?: string
} => Boolean(config && "labels" in config)

type Draft = {
  title: string
  description: string
  startDate: string
  endDate: string
  categoryIds: number[]
}

type AnswerDraft = { value?: SurveyAnswerValue; comment: string }

type QuestionDraft = {
  questionId?: number
  questionText: string
  categoryId: number
  questionType: SurveyQuestionType
  options: string
  displayOrder: number
}

const emptyDraft = (): Draft => ({
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  categoryIds: [],
})

const emptyQuestion = (): QuestionDraft => ({
  questionText: "",
  categoryId: 0,
  questionType: "RATING",
  options: "",
  displayOrder: 100,
})

function useDialogBehavior(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [onClose, open])
}

const surveyResponseCount = (survey: SurveySummary, result?: SurveyResults) =>
  result?.responseCount ?? survey.responseCount ?? 0

const surveyInvitedCount = (
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

const surveyResponseRate = (
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

const progressTone = (rate: number) =>
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

const topicIcon = (name: string) => {
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

const surveyAverageScore = (result?: SurveyResults) => {
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

function remainingLabel(survey: SurveySummary, language: string) {
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

const statusLabel: Record<SurveySummary["status"], { vi: string; en: string }> = {
  ACTIVE: { vi: "Đang mở", en: "Active" },
  DRAFT: { vi: "Bản nháp", en: "Draft" },
  CLOSED: { vi: "Đã đóng", en: "Closed" },
}

export default function ErdSurveys() {
  const { t, language } = useLanguage()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)

  const { user } = useRole()

  const isHr = user.role === "HR"

  const [surveys, setSurveys] = useState<SurveySummary[]>([])

  const [categories, setCategories] = useState<SurveyCategory[]>([])
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "unavailable" | "inconsistent">("loading")
  const [catalogRetry, setCatalogRetry] = useState(0)
  const [previewMode, setPreviewMode] = useState<"create" | "edit" | "saved">("saved")
  const [authoringError, setAuthoringError] = useState("")
  const [editingCustomIndex, setEditingCustomIndex] = useState<number | null>(null)
  const savedDraftQuestionIds = useRef(new Map<number, number>())

  const [employeeDirectory, setEmployeeDirectory] = useState<EmployeeProfile[]>([])

  const [departments, setDepartments] = useState<ApiDepartment[]>([])

  const [directoryLoading, setDirectoryLoading] = useState(false)

  const [draft, setDraft] = useState<Draft>(emptyDraft)

  const [stagedQuestions, setStagedQuestions] = useState<SurveyQuestionInput[]>(
    [],
  )

  const [customQuestions, setCustomQuestions] = useState<SurveyQuestionInput[]>([])

  const [customDraft, setCustomDraft] = useState<QuestionDraft>(emptyQuestion)

  const [surveyFormOpen, setSurveyFormOpen] = useState(false)

  const [editSurvey, setEditSurvey] = useState<SurveySummary | null>(null)

  const [managedSurvey, setManagedSurvey] = useState<SurveySummary & {
    questions: SurveyQuestion[]
  } | null>(null)

  const [questionDraft, setQuestionDraft] =
    useState<QuestionDraft>(emptyQuestion)

  const [activeSurvey, setActiveSurvey] = useState<SurveySummary & {
    questions: SurveyQuestion[]
  } | null>(null)

  const [answers, setAnswers] = useState<Record<number, AnswerDraft>>({})

  const [results, setResults] = useState<Record<number, SurveyResults>>({})

  const [openResults, setOpenResults] = useState<number | null>(null)

  const [detailResult, setDetailResult] = useState<{
    result: SurveyResults
    participants: SurveyParticipant[]
  } | null>(null)

  const [participantsBySurvey, setParticipantsBySurvey] = useState<
    Record<number, SurveyParticipant[]>
  >({})

  const [publishTarget, setPublishTarget] = useState<SurveySummary | null>(null)

  const [previewSurvey, setPreviewSurvey] = useState<
    (SurveySummary & { questions: SurveyQuestion[] }) | null
  >(null)

  const [searchQuery, setSearchQuery] = useState("")

  const [statusFilter, setStatusFilter] =
    useState<"ALL" | SurveySummary["status"]>("ALL")

  const [openGroups, setOpenGroups] = useState<Record<SurveySummary["status"], boolean>>({
    DRAFT: true,
    ACTIVE: true,
    CLOSED: false,
  })

  const [sortBy, setSortBy] =
    useState<"NEWEST" | "END_SOON" | "RESPONSE_DESC">(
      "NEWEST",
    )

  const [loading, setLoading] = useState(true)

  const [loadFailed, setLoadFailed] = useState(false)

  const [eligibilityBlocked, setEligibilityBlocked] = useState(false)

  const [pending, setPending] = useState(false)

  const [loadingResults, setLoadingResults] = useState(false)

  const [reload, setReload] = useState(0)

  const { error, message, setError, setMessage } = useAutoDismissFeedback()

  useDialogBehavior(surveyFormOpen && !previewSurvey, () => { if (!pending && !publishTarget) setSurveyFormOpen(false) })

  useEffect(() => {
    const controller = new AbortController()

    setLoading(true)
    setLoadFailed(false)
    setEligibilityBlocked(false)
    setError("")

    const load = isHr
      ? listSurveys(controller.signal)
      : listAvailableSurveys(controller.signal)

    void load
      .then((result) => {
        if (!controller.signal.aborted) setSurveys(result.data)
      })
      .catch((cause) => {
        if (controller.signal.aborted) return

        if (!isHr && cause instanceof ApiError && cause.status === 403) {
          setSurveys([])
          setEligibilityBlocked(true)
        } else {
          setLoadFailed(true)
          setError(
            getApiErrorMessage(cause, "Không thể tải danh sách khảo sát."),
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [isHr, reload, setError, user.email])

  useEffect(() => {
    if (!isHr) return
    const controller = new AbortController()
    setCatalogState("loading")
    void listSurveyCategories(controller.signal)
      .then(({ data }) => {
        if (controller.signal.aborted) return
        setCategories(data)
        setCatalogState(data.length ? "ready" : "unavailable")
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setCatalogState(cause instanceof ApiError && cause.status === 409 ? "inconsistent" : "unavailable")
      })
    return () => controller.abort()
  }, [isHr, catalogRetry])

  useEffect(() => {
    if (!isHr) return
    const controller = new AbortController()
    setDirectoryLoading(true)

    void Promise.allSettled([
      listEmployeeProfiles({ page: 1, limit: 10_000, employmentStatus: "ACTIVE" }, controller.signal),
      listDepartments(controller.signal, { page: 1, limit: 1_000 }),
    ])
      .then(([employeesResult, departmentsResult]) => {
        if (controller.signal.aborted) return
        if (employeesResult.status === "fulfilled") setEmployeeDirectory(
          employeesResult.value.data.filter(
            (employee) => employee.employmentStatus === "ACTIVE",
          ),
        )
        if (departmentsResult.status === "fulfilled") setDepartments(departmentsResult.value.data)
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          console.warn(
            "[ERIS Surveys] Không thể tải phạm vi nhân sự động.",
            cause,
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setDirectoryLoading(false)
      })

    return () => controller.abort()
  }, [isHr])

  useEffect(() => {
    if (!isHr || surveys.length === 0) return
    const controller = new AbortController()
    const missing = surveys.filter((survey) => !results[survey.id])
    if (missing.length === 0) return () => controller.abort()

    void Promise.allSettled(
      missing.map((survey) => getSurveyResults(survey.id, controller.signal)),
    ).then((settled) => {
      if (controller.signal.aborted) return
      setResults((current) => {
        const next = { ...current }
        settled.forEach((entry, index) => {
          if (entry.status === "fulfilled")
            next[missing[index].id] = entry.value.data
        })
        return next
      })
    })

    return () => controller.abort()
  }, [isHr, surveys])

  const dateLabel = (value: string | null | undefined) => {
    const date = employeeDate(value)

    return date
      ? new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(`${date}T00:00:00Z`))
      : "—"
  }

  const selectedCategories = categories.filter((category) =>
    draft.categoryIds.includes(category.id),
  )

  const defaultCount = selectedCategories.reduce(
    (sum, category) => sum + category.defaultQuestions.length,
    0,
  )

  const surveyDuration = useMemo(() => {
    if (!draft.startDate || !draft.endDate) return null
    const start = new Date(`${draft.startDate}T00:00:00`)
    const end = new Date(`${draft.endDate}T00:00:00`)
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
    return days > 0 ? days : null
  }, [draft.endDate, draft.startDate])

  const totalEmployees = employeeDirectory.length
  const totalQuestionCount =
    defaultCount + stagedQuestions.length + customQuestions.length + Number(editingCustomIndex === null && Boolean(customDraft.questionText.trim()))

  const questionKey = (question: SurveyQuestionInput) =>
    `${question.categoryId}|${question.questionText}`

  function toggleCategory(categoryId: number) {
    const removing = draft.categoryIds.includes(categoryId)

    setDraft((value) => ({
      ...value,
      categoryIds: removing
        ? value.categoryIds.filter((id) => id !== categoryId)
        : [...value.categoryIds, categoryId],
    }))

    if (removing)
      setStagedQuestions((current) =>
        current.filter((question) => question.categoryId !== categoryId),
      )
  }

  function toggleBankQuestion(question: SurveyQuestionInput) {
    setStagedQuestions((current) =>
      current.some((item) => questionKey(item) === questionKey(question))
        ? current.filter((item) => questionKey(item) !== questionKey(question))
        : [
            ...current,
            {
              questionText: question.questionText,
              categoryId: question.categoryId,
              questionType: question.questionType,
              answerConfig: question.answerConfig,
              displayOrder: question.displayOrder,
            },
          ],
    )
  }

  function collectCustomQuestions(): SurveyQuestionInput[] | null {
    const merged = [...customQuestions]
    if (!customDraft.questionText.trim()) return merged
    if (editingCustomIndex === null && merged.length > 0) {
      setAuthoringError(tr("Chỉ được thêm một câu hỏi tự tạo. Hãy sửa hoặc xóa câu hiện có.", "You can add one custom question. Edit or remove the existing question first."))
      return null
    }
    const input = questionInput(customDraft)
    if (isChoiceConfig(input.answerConfig) && input.answerConfig.options.length < 2) {
      setAuthoringError(tr("Câu hỏi lựa chọn cần ít nhất 2 phương án.", "Choice questions require at least two options."))
      return null
    }
    if (editingCustomIndex === null) merged.push(input)
    else merged[editingCustomIndex] = input
    return merged
  }

  function commitCustomQuestions(questions: SurveyQuestionInput[]) {
    setCustomQuestions(questions)
    setCustomDraft(emptyQuestion())
    setEditingCustomIndex(null)
  }

  function addCustomQuestion() {
    if (!customDraft.questionText.trim()) return
    const questions = collectCustomQuestions()
    if (questions) {
      commitCustomQuestions(questions)
      setAuthoringError("")
    }
  }

  function surveyMetadata() {
    return {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      startDate: dateWithZone(draft.startDate),
      endDate: dateWithZone(draft.endDate, true),
    }
  }

  async function openPreview(survey: SurveySummary) {
    setError("")
    setAuthoringError("")
    try {
      const detail = await getSurveyForEmployee(survey.id)
      setPreviewMode("saved")
      setPreviewSurvey(detail.data)
    } catch (cause) {
      setError(getApiErrorMessage(cause, tr("Không thể mở bản xem trước.", "Could not open preview.")))
    }
  }

  async function persistNewSurvey(questions: SurveyQuestionInput[], publishNow: boolean) {
    if (pending) return
    setPending(true)
    setAuthoringError("")
    try {
      const created = await createSurvey({
        ...surveyMetadata(),
        categoryIds: draft.categoryIds,
        questions: [...stagedQuestions, ...questions.map(question => ({ ...question, categoryId: draft.categoryIds[0] }))],
      })
      setSurveyFormOpen(false)
      setDraft(emptyDraft())
      setStagedQuestions([])
      commitCustomQuestions([])
      setReload(value => value + 1)
      if (publishNow) {
        setPreviewMode("saved")
        setPreviewSurvey(current => current ? { ...current, ...created.data, questions: current.questions } : null)
        await publishSurvey(created.data.id)
        setPreviewSurvey(null)
        setReload(value => value + 1)
        setMessage(tr("Đã xuất bản khảo sát.", "Survey published."))
      } else {
        setMessage(tr("Đã tạo bản nháp khảo sát.", "Survey draft created."))
      }
    } catch (cause) {
      setAuthoringError(getApiErrorMessage(cause, tr("Không thể hoàn tất thao tác khảo sát.", "Could not complete the survey action.")))
    } finally {
      setPending(false)
    }
  }

  function create(event: FormEvent) {
    event.preventDefault()
    if (pending || catalogState !== "ready" || !selectedCategories.length) return
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    setAuthoringError("")
    const custom = collectCustomQuestions()
    if (!custom) return
    const standard = selectedCategories.flatMap(category => category.defaultQuestions)
    if (standard.length + stagedQuestions.length + custom.length > 200) {
      setAuthoringError(tr("Khảo sát được phép có tối đa 200 câu hỏi.", "A survey can have at most 200 questions."))
      return
    }
    commitCustomQuestions(custom)
    if (submitter?.value !== "publish") {
      void persistNewSurvey(custom, false)
      return
    }
    const questions: SurveyQuestion[] = [...standard, ...stagedQuestions, ...custom].map((question, index) => ({
      ...question,
      id: -(index + 1),
      categoryId: index >= standard.length + stagedQuestions.length ? 0 : question.categoryId,
      displayOrder: index + 1,
      isRequired: true,
      isSatisfactionCore: index < standard.length,
    }))
    setPreviewMode("create")
    setPreviewSurvey({ ...surveyMetadata(), id: 0, status: "DRAFT", questions })
  }

  async function saveSurvey(event: FormEvent) {
    event.preventDefault()
    if (!editSurvey || pending) return

    setPending(true)
    setError("")

    try {
      await updateSurvey(editSurvey.id, {
        title: draft.title.trim(),
        description: draft.description.trim() || null,

        startDate: dateWithZone(draft.startDate),
        endDate: dateWithZone(draft.endDate, true),
      })

      setEditSurvey(null)
      setDraft(emptyDraft())
      setSurveyFormOpen(false)
      setMessage("Đã cập nhật thông tin khảo sát.")
      setReload((value) => value + 1)
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Không thể cập nhật khảo sát."))
    } finally {
      setPending(false)
    }
  }

  async function loadSurveyContent(survey: SurveySummary) {
    setError("")
    setAuthoringError("")

    try {
      const [detail, topicResult] = await Promise.all([
        getSurveyForEmployee(survey.id),
        listSurveyCategories(),
      ])
      if (!topicResult.data.length) throw new Error(tr("Danh mục chủ đề khảo sát đang trống.", "The survey topic catalog is empty."))
      setCategories(topicResult.data)
      setCatalogState("ready")
      setDraft({
        title: detail.data.title,
        description: detail.data.description || "",
        startDate: employeeDate(detail.data.startDate),
        endDate: employeeDate(detail.data.endDate),
        categoryIds: [...new Set(detail.data.questions.map((question) => question.categoryId))],
      })
      savedDraftQuestionIds.current.clear()
      setManagedSurvey(detail.data)
      setPreviewSurvey(null)
    } catch (cause) {
      const message = cause instanceof ApiError && cause.status === 409
        ? tr("Danh mục câu hỏi không nhất quán. Cần kiểm tra danh mục trước khi chỉnh sửa bản nháp.", "The question catalog is inconsistent. Check it before editing drafts.")
        : getApiErrorMessage(cause, tr("Không thể tải nội dung khảo sát.", "Could not load the survey."))
      if (previewSurvey) setAuthoringError(message)
      else setError(message)
    }
  }

  async function saveStudio(
    questions: SurveyQuestion[],
    publishAfterSave: boolean,
  ) {
    if (!managedSurvey || pending) return
    setPending(true)
    setAuthoringError("")
    try {
      await updateSurvey(managedSurvey.id, {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        startDate: dateWithZone(draft.startDate),
        endDate: dateWithZone(draft.endDate, true),
      })

      const { data: latest } = await getSurveyForEmployee(managedSurvey.id)
      const currentIds = new Set(questions.map(question => savedDraftQuestionIds.current.get(question.id) ?? question.id))
      const knownIds = new Set([...managedSurvey.questions.map(question => question.id), ...savedDraftQuestionIds.current.values()])
      for (const question of latest.questions)
        if (!question.isSatisfactionCore && knownIds.has(question.id) && !currentIds.has(question.id))
          await deleteSurveyQuestion(managedSurvey.id, question.id)

      for (const question of questions.filter((item) => !item.isSatisfactionCore)) {
        const input: SurveyQuestionInput = {
          questionText: question.questionText.trim(),
          categoryId: question.categoryId,
          questionType: question.questionType,
          answerConfig: question.answerConfig,
          displayOrder: question.displayOrder,
        }
        const persistedId = savedDraftQuestionIds.current.get(question.id) ?? question.id
        if (persistedId > 0) {
          const original = latest.questions.find(item => item.id === persistedId)
          if (original && Object.entries(input).every(([key, value]) => JSON.stringify(value) === JSON.stringify(original[key as keyof SurveyQuestion]))) continue
          await updateSurveyQuestion(managedSurvey.id, persistedId, input)
        } else {
          const saved = await addSurveyQuestion(managedSurvey.id, input)
          savedDraftQuestionIds.current.set(question.id, saved.data.id)
        }
      }

      const refreshed = await getSurveyForEmployee(managedSurvey.id)
      setManagedSurvey(null)
      setDraft(emptyDraft())
      setReload((value) => value + 1)
      if (publishAfterSave) {
        setPreviewMode("saved")
        setPreviewSurvey(refreshed.data)
        await publishSurvey(refreshed.data.id)
        setPreviewSurvey(null)
        setReload(value => value + 1)
      }
      setMessage(
        publishAfterSave
          ? "Đã xuất bản khảo sát."
          : "Đã lưu thay đổi bản nháp.",
      )
    } catch (cause) {
      setAuthoringError(getApiErrorMessage(cause, "Không thể hoàn tất lưu hoặc xuất bản bản nháp."))
    } finally {
      setPending(false)
    }
  }

  function questionInput(value: QuestionDraft): SurveyQuestionInput {
    let answerConfig: SurveyAnswerConfig = null

    if (value.questionType === "RATING")
      answerConfig = { min: 1, max: 5, labels: ratingLabels }

    if (
      value.questionType === "SINGLE_CHOICE" ||
      value.questionType === "MULTIPLE_CHOICE"
    ) {
      const labels = value.options
        .split("\n")
        .map((option) => option.trim())
        .filter(Boolean)

      answerConfig = {
        options: labels.map((label, index) => ({
          code: `OPTION_${index + 1}`,
          label,
        })),
      }
    }

    return {
      questionText: value.questionText.trim(),
      categoryId: value.categoryId,
      questionType: value.questionType,
      answerConfig,
      displayOrder: value.displayOrder,
    }
  }

  async function saveQuestion(event: FormEvent) {
    event.preventDefault()
    if (!managedSurvey || pending) return

    setPending(true)
    setError("")

    try {
      const input = questionInput(questionDraft)

      if (questionDraft.questionId)
        await updateSurveyQuestion(
          managedSurvey.id,
          questionDraft.questionId,
          input,
        )
      else await addSurveyQuestion(managedSurvey.id, input)

      const detail = await getSurveyForEmployee(managedSurvey.id)

      setManagedSurvey(detail.data)
      setQuestionDraft({
        ...emptyQuestion(),
        categoryId: categories[0]?.id || 0,
      })

      setMessage(
        questionDraft.questionId
          ? "Đã cập nhật câu hỏi."
          : "Đã thêm câu hỏi tùy chỉnh.",
      )
      setReload((value) => value + 1)
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Không thể lưu câu hỏi."))
    } finally {
      setPending(false)
    }
  }

  async function removeQuestion(question: SurveyQuestion) {
    if (
      !managedSurvey ||
      question.isSatisfactionCore ||
      pending ||
      !window.confirm("Xóa câu hỏi tùy chỉnh này?")
    )
      return

    setPending(true)
    setError("")

    try {
      await deleteSurveyQuestion(managedSurvey.id, question.id)

      setManagedSurvey((current) =>
        current
          ? {
              ...current,
              questions: current.questions.filter(
                (item) => item.id !== question.id,
              ),
            }
          : current,
      )

      setMessage("Đã xóa câu hỏi.")
      setReload((value) => value + 1)
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Không thể xóa câu hỏi."))
    } finally {
      setPending(false)
    }
  }

  async function publish(id: number) {
    if (pending) return
    setPending(true)
    setError("")

    try {
      await publishSurvey(id)
      setPreviewSurvey(null)
      setManagedSurvey(null)
      setMessage("Đã xuất bản khảo sát.")
      setReload((value) => value + 1)
    } catch (cause) {
      setAuthoringError(getApiErrorMessage(cause, "Không thể xuất bản khảo sát."))
    } finally {
      setPending(false)
    }
  }

  async function finishSurvey(id: number) {
    if (
      pending ||
      !window.confirm(
        "Đóng khảo sát? Nhân viên sẽ không thể gửi câu trả lời mới.",
      )
    )
      return

    setPending(true)
    setError("")

    try {
      await closeSurvey(id)
      setMessage("Đã đóng khảo sát.")
      setReload((value) => value + 1)
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Không thể đóng khảo sát."))
    } finally {
      setPending(false)
    }
  }

  async function showResults(id: number, details = false) {
    if (loadingResults) return

    if (!details && openResults === id) {
      setOpenResults(null)
      return
    }

    setLoadingResults(true)
    setError("")

    try {
      const result = await getSurveyResults(id)
      setResults((current) => ({ ...current, [id]: result.data }))

      const participantResponse = await getSurveyParticipants(id)
      const employeeById = new Map(employeeDirectory.map((employee) => [employee.id, employee]))
      const departmentById = new Map(departments.map((department) => [department.id, department.name]))
      const participants = participantResponse.data.map((participant) => {
        const employee = employeeById.get(participant.employeeId)
        return {
          ...participant,
          departmentName: employee
            ? departmentById.get(employee.departmentId) || null
            : null,
        }
      })
      setParticipantsBySurvey((current) => ({ ...current, [id]: participants }))

      if (details) {
        setDetailResult({
          result: result.data,
          participants,
        })
      } else setOpenResults(id)
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Không thể tải kết quả khảo sát."))
    } finally {
      setLoadingResults(false)
    }
  }

  async function openEmployeeSurvey(id: number) {
    setError("")
    setAnswers({})

    try {
      const detail = await getSurveyForEmployee(id)
      setActiveSurvey(detail.data)
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Không thể mở khảo sát."))
    }
  }

  const answered = (question: SurveyQuestion) => {
    const value = answers[question.id]?.value

    if (question.questionType === "TEXT")
      return typeof value === "string" && Boolean(value.trim())

    if (question.questionType === "RATING") return Number.isInteger(value)

    return (
      typeof value === "object" &&
      value !== null &&
      "selectedCodes" in value &&
      value.selectedCodes.length > 0
    )
  }

  const allAnswered =
    Boolean(activeSurvey?.questions.length) &&
    activeSurvey!.questions.every(answered)

  async function submit(id: number) {
    if (!activeSurvey || pending || !allAnswered) return

    setPending(true)
    setError("")

    try {
      const response = await submitSurveyResponse(
        id,
        activeSurvey.questions.map((question) => ({
          questionId: question.id,

          answerValue: answers[question.id].value!,
          comment: answers[question.id].comment.trim() || null,
        })),
      )

      rememberCompletedSurvey(user.email, id)
      setActiveSurvey(null)

      setMessage(
        response.data.satisfactionScore == null
          ? "Đã gửi câu trả lời khảo sát."
          : `Đã gửi khảo sát. Điểm hài lòng tổng hợp: ${response.data.satisfactionScore.toFixed(2)}/5.`,
      )

      setReload((value) => value + 1)
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Không thể gửi khảo sát."))
    } finally {
      setPending(false)
    }
  }

  const statusStyle = (status: SurveySummary["status"]) =>
    status === "ACTIVE"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "DRAFT"
        ? "border-slate-200 bg-slate-100 text-slate-600"
        : "border-slate-200 bg-slate-100 text-slate-600"

  const normalizedQuery = searchQuery
    .trim()
    .toLocaleLowerCase(language === "vi" ? "vi-VN" : "en-US")

  const visibleSurveys = surveys
    .filter(
      (survey) =>
        (statusFilter === "ALL" || survey.status === statusFilter) &&
        (!normalizedQuery ||
          `${survey.title} ${survey.description || ""}`
            .toLocaleLowerCase(language === "vi" ? "vi-VN" : "en-US")
            .includes(normalizedQuery)),
    )

    .sort((left, right) => {
      if (sortBy === "END_SOON")
        return (
          new Date(left.endDate || "9999-12-31").getTime() -
          new Date(right.endDate || "9999-12-31").getTime()
        )

      if (sortBy === "RESPONSE_DESC")
        return (
          surveyResponseRate(right, results[right.id], totalEmployees) -
          surveyResponseRate(left, results[left.id], totalEmployees)
        )

      const leftTime = left.createdAt
        ? new Date(left.createdAt).getTime()
        : left.id

      const rightTime = right.createdAt
        ? new Date(right.createdAt).getTime()
        : right.id

      return rightTime - leftTime
    })

  const statusCounts = useMemo(
    () => ({
      ALL: surveys.length,
      ACTIVE: surveys.filter((survey) => survey.status === "ACTIVE").length,
      DRAFT: surveys.filter((survey) => survey.status === "DRAFT").length,
      CLOSED: surveys.filter((survey) => survey.status === "CLOSED").length,
    }),
    [surveys],
  )

  const kpis = useMemo(() => {
    const totalResponses = surveys.reduce(
      (sum, survey) => sum + surveyResponseCount(survey, results[survey.id]),
      0,
    )
    const totalInvited = surveys.filter(survey => survey.status !== "DRAFT").length * totalEmployees
    const scores = surveys.flatMap((survey) => {
      const score = surveyAverageScore(results[survey.id])
      return score == null
        ? []
        : [{ score, weight: Math.max(1, surveyResponseCount(survey, results[survey.id])) }]
    })
    const scoreWeight = scores.reduce((sum, item) => sum + item.weight, 0)
    return {
      active: statusCounts.ACTIVE,
      responses: totalResponses,
      rate: totalInvited > 0 ? (totalResponses / totalInvited) * 100 : 0,
      score:
        scoreWeight > 0
          ? scores.reduce((sum, item) => sum + item.score * item.weight, 0) /
            scoreWeight
          : null,
    }
  }, [results, statusCounts.ACTIVE, surveys, totalEmployees])

  const exportSurveyCsv = (survey: SurveySummary, result?: SurveyResults) => {
    if (!result) return
    const rows = [
      ["survey_id", "title", "active_employees", "submitted", "completion_rate"],
      [survey.id, survey.title, totalEmployees, result.responseCount, surveyResponseRate(survey, result, totalEmployees)],
      [],
      ["category", "valid_responses", "engagement_score"],
      ...result.categoryScores.map((category) => [
        topicLabel(category.name, language),
        category.responseCount,
        category.satisfactionScore ?? "",
      ]),
    ]
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\r\n")
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `survey-${survey.id}-results.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const renderSurveyCard = (survey: SurveySummary) => {
    const result = results[survey.id]
    const invited = totalEmployees
    const responses = surveyResponseCount(survey, result)
    const responseRate = surveyResponseRate(survey, result, totalEmployees)
    const responseTone = progressTone(responseRate)
    const deadline = remainingLabel(survey, language)
    const questionCount = survey.questionCount || result?.questions.length || 0
    const minutes = Math.max(1, Math.ceil(questionCount * 0.5))
    const averageScore = surveyAverageScore(result)
    const isDraft = survey.status === "DRAFT"
    const isClosed = survey.status === "CLOSED"

    return (
      <Card
        key={survey.id}
        className={`overflow-hidden transition-all duration-200 hover:shadow-md ${
          isDraft
            ? "border-2 border-dashed border-amber-300/80 bg-amber-50/30"
            : isClosed
              ? "border-slate-200 bg-slate-50/70"
              : "border-slate-200 bg-white hover:border-orange-300/70"
        }`}
      >
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(240px,.65fr)_200px] lg:items-center">
          <div className="min-w-0">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${isDraft ? "border-amber-200 bg-amber-100 text-amber-800" : statusStyle(survey.status)}`}>
              <span className={`size-1.5 rounded-full ${survey.status === "ACTIVE" ? "animate-pulse bg-emerald-500" : "bg-slate-400"}`} />
              {isDraft ? tr("📝 Bản nháp chưa phát hành", "📝 Unpublished draft") : statusLabel[survey.status][language === "vi" ? "vi" : "en"]}
            </span>
            <button
              type="button"
              onClick={() => isHr ? void openPreview(survey) : void openEmployeeSurvey(survey.id)}
              className="mt-2 block max-w-full text-left text-base font-semibold text-slate-950 transition hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
            >
              {survey.title}
            </button>
            <p className="mt-1 line-clamp-1 text-sm text-slate-500">
              {survey.description || tr("Chưa có mô tả cho khảo sát này.", "No survey description.")}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-white/80 px-2 py-1.5 ring-1 ring-slate-100">
                <CalendarDays size={14} />
                {isDraft && tr("Lịch dự kiến: ", "Planned: ")}{dateLabel(survey.startDate)} – {dateLabel(survey.endDate)}
              </span>
              {deadline && <span className={`rounded-full border px-2 py-1 ${deadline.className}`}>{deadline.label}</span>}
            </div>
          </div>

          {isDraft ? (
            <div className="rounded-xl border border-amber-200 bg-white/80 p-4">
              <p className="text-sm font-semibold text-slate-900">
                {questionCount} {tr("câu hỏi đã cấu hình", "questions configured")} · ~{minutes} {tr("phút", "min")}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {tr(`Toàn bộ công ty (${totalEmployees} nhân sự)`, `Entire company (${totalEmployees} employees)`)}
              </p>
              <span className="mt-3 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                {tr("Sẵn sàng phát hành bất kỳ lúc nào", "Ready to publish")}
              </span>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-100 bg-white p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{responses} / {invited} {tr("nhân sự", "employees")}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{isClosed ? tr("Kết quả chốt sổ", "Final participation") : tr("Lượt phản hồi đã ghi nhận", "Responses received")}</p>
                </div>
                <strong className={`text-sm font-bold tabular-nums ${responseTone.text}`}>{responseRate.toFixed(1)}%</strong>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`Tiến độ phản hồi ${survey.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(responseRate))}>
                <span className={`block h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out ${responseTone.fill}`} style={{ width: `${Math.min(100, Math.max(0, responseRate))}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className={`rounded-full px-2 py-1 font-semibold ${responseRate >= 60 ? "bg-emerald-50" : "bg-amber-50"} ${responseTone.text}`}>{language === "vi" ? responseTone.hintVi : responseTone.hintEn}</span>
                {isClosed && <span className="font-semibold text-slate-600">{tr("Điểm gắn kết", "Engagement")}: {averageScore?.toFixed(2) ?? "—"} / 5</span>}
              </div>
            </div>
          )}

          {isHr ? (
            <div className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch">
              {isDraft ? (
                <>
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => void loadSurveyContent(survey)}><Pencil size={15} />{tr("Chỉnh sửa", "Edit")}</Button>
                  <Button size="sm" disabled={pending} onClick={() => void openPreview(survey)}><PlayCircle size={15} />{tr("Xem trước & xuất bản", "Preview & publish")}</Button>
                </>
              ) : isClosed ? (
                <>
                  <Button size="sm" variant="secondary" disabled={loadingResults} onClick={() => void showResults(survey.id, true)}><BarChart3 size={15} />{tr("Báo cáo kết quả", "Results report")}</Button>
                  <Button size="sm" variant="secondary" disabled={!result} onClick={() => exportSurveyCsv(survey, result)}><Send size={15} />{tr("Xuất CSV", "Export CSV")}</Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="success" disabled={loadingResults} onClick={() => void showResults(survey.id, true)}><Eye size={15} />{tr("Xem phản hồi", "View responses")}</Button>
                  <Button size="sm" variant="secondary" disabled={loadingResults} onClick={() => void showResults(survey.id)}><BarChart3 size={15} />{openResults === survey.id ? tr("Ẩn tổng quan", "Hide overview") : tr("Tổng quan", "Overview")}</Button>
                  <Button size="sm" variant="secondary" onClick={() => void finishSurvey(survey.id)}>{tr("Đóng khảo sát", "Close survey")}</Button>
                </>
              )}
            </div>
          ) : (
            <Button size="sm" onClick={() => void openEmployeeSurvey(survey.id)}><PlayCircle size={15} />{tr("Bắt đầu", "Start")}</Button>
          )}
        </div>
        {isHr && openResults === survey.id && result && (
          <ResultOverview
            result={result}
            totalEmployees={totalEmployees}
            employeeDirectory={employeeDirectory}
            departments={departments}
            participants={participantsBySurvey[survey.id] || []}
          />
        )}
      </Card>
    )
  }

  const groupedSurveys = (
    statusFilter === "ALL"
      ? (["DRAFT", "ACTIVE", "CLOSED"] as const)
      : [statusFilter]
  ).map((status) => ({
    status,
    items: visibleSurveys.filter((survey) => survey.status === status),
  }))

  return (
    <AppShell
      breadcrumb={[
        "Engagement",
        isHr ? "Quản lý khảo sát" : "Khảo sát của tôi",
      ]}
    >
      <SectionHeader
        title={t(isHr ? "Employee engagement surveys" : "My surveys")}
        description={t(
          isHr
            ? "Design survey topics and questions, publish and review results."
            : "Complete open surveys and send confidential feedback to HR.",
        )}
      >
        {isHr && !surveyFormOpen && (
          <Button
            onClick={() => {
              setEditSurvey(null)
              setDraft(emptyDraft())
              setStagedQuestions([])
              setCustomQuestions([])
              setCustomDraft(emptyQuestion())
              setEditingCustomIndex(null)
              setAuthoringError("")
              setSurveyFormOpen(true)
            }}
          >
            <Plus size={16} />
            {language === "vi" ? "Tạo khảo sát" : "Create survey"}
          </Button>
        )}
      </SectionHeader>
      {isHr && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SurveyKpiCard
            label={tr("Đang mở", "Active surveys")}
            value={`${kpis.active} ${tr("đợt", "surveys")}`}
            note={tr("Đang nhận phản hồi", "Currently accepting responses")}
            icon={<Radio size={19} />}
            tone="emerald"
            pulse={kpis.active > 0}
          />
          <SurveyKpiCard
            label={tr("Lượt phản hồi", "Total responses")}
            value={`${kpis.responses.toLocaleString(language === "vi" ? "vi-VN" : "en-US")} ${tr("phiếu", "responses")}`}
            note={tr("Tổng số phiếu đã thu về", "All responses received")}
            icon={<MessageSquareText size={19} />}
            tone="blue"
          />
          <SurveyKpiCard
            label={tr("Tỷ lệ tham gia trung bình", "Average response rate")}
            value={`${kpis.rate.toFixed(1)}%`}
            note={tr("Trên toàn bộ lượt mời", "Across all invitations")}
            icon={<Gauge size={19} />}
            tone="orange"
            progress={kpis.rate}
          />
          <SurveyKpiCard
            label={tr("Điểm gắn kết trung bình", "Average engagement score")}
            value={kpis.score == null ? tr("Chưa có", "Not available") : `${kpis.score.toFixed(1)} / 5.0`}
            note={tr("Từ câu hỏi hài lòng", "From satisfaction questions")}
            icon={<Star size={19} />}
            tone="violet"
          />
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {t(error)}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="mb-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          <CheckCircle2 size={18} />
          {t(message)}
        </p>
      )}

      {!isHr && eligibilityBlocked && (
        <Card className="mb-5 p-6">
          <h2 className="font-semibold text-slate-900">
            Không thể tải khảo sát
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Tài khoản cần liên kết với hồ sơ nhân viên đang hoạt động và nằm
            trong danh sách được mời khi khảo sát được xuất bản.
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => setReload((value) => value + 1)}
          >
            Thử lại
          </Button>
        </Card>
      )}

      {isHr && (
        <>
          {surveyFormOpen && (
            <div
              className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-[1px] sm:p-5"
              role="dialog"
              aria-modal={!previewSurvey}
              hidden={Boolean(previewSurvey)}
              style={previewSurvey ? { display: "none" } : undefined}
              aria-labelledby="create-survey-title"
            >
            <section className={surveyStudioShell}>
              <header className="flex min-h-16 shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-6">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                    <FilePlus2 size={18} />
                  </span>
                  <div className="min-w-0">
                    <h2 id="create-survey-title" className="text-lg font-semibold text-slate-950">
                      {t("Create a new survey")}
                      <span className="ml-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 align-middle text-xs font-semibold text-amber-800">{tr("Bản nháp", "Draft")}</span>
                    </h2>
                    <p className="mt-0.5 text-sm font-medium text-slate-600">
                      {t(
                        "Choose topics so the system can add standard satisfaction questions and optional bank questions.",
                      )}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  disabled={pending}
                  onClick={() => {
                    setSurveyFormOpen(false)
                    setDraft(emptyDraft())
                    setStagedQuestions([])
                    setCustomQuestions([])
                    setCustomDraft(emptyQuestion())
                  }}
                >
                  {t("Close")}
                </Button>
              </header>
              <form
                onSubmit={(event) => void create(event)}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className={surveyStudioBody}>
                  <div className={surveyStudioSettings} aria-label={tr("Thiết lập & chủ đề", "Settings and topics")}>
                {authoringError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800 sm:col-span-2">{authoringError}</p>}
                <label className="block min-w-0 text-sm font-semibold text-slate-700">
                  {t("Title")}
                  <input
                    required
                    maxLength={255}
                    className={control}
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        title: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="block min-w-0 text-sm font-semibold text-slate-700">
                  {t("Survey purpose")}
                  <textarea
                    rows={2}
                    maxLength={4000}
                    className={`${area} min-h-16 resize-y`}
                    value={draft.description}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                <label className="block min-w-0 text-sm font-semibold text-slate-700">
                  {t("Start date")}
                  <input
                    required
                    type="date"
                    className={control}
                    value={draft.startDate}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        startDate: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="block min-w-0 text-sm font-semibold text-slate-700">
                  {t("End date")}
                  <input
                    required
                    type="date"
                    min={draft.startDate || undefined}
                    className={control}
                    value={draft.endDate}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        endDate: event.target.value,
                      }))
                    }
                  />
                  {surveyDuration != null && (
                    <span className="mt-2 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      {tr(`Thời lượng: ${surveyDuration} ngày`, `Duration: ${surveyDuration} days`)}
                    </span>
                  )}
                </label>
                </div>
                    <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-sm font-medium text-blue-800 sm:col-span-2">
                      <Users size={17} className="shrink-0" />
                      {directoryLoading
                        ? tr("Phạm vi: Đang tải quy mô nhân sự…", "Audience: Loading workforce size…")
                        : tr(
                            `Phạm vi: Toàn bộ công ty (${totalEmployees} nhân sự) · Áp dụng tính điểm đồng bộ`,
                            `Audience: Entire company (${totalEmployees} employees) · Consistent scoring applied`,
                          )}
                    </div>
                    <fieldset className="sm:col-span-2">
                      <legend className="text-base font-semibold text-slate-900">
                        {t("Survey topics")}
                      </legend>
                      <p className="mt-1 text-sm font-medium text-slate-600">
                        {tr("Mỗi chủ đề tự động thêm các câu chuẩn từ danh mục. Các câu này được khóa để tính điểm.", "Each selected topic adds its standard questions from the catalog. Those questions are locked for scoring.")}
                      </p>
                      {catalogState !== "ready" && <div role={catalogState === "loading" ? "status" : "alert"} className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        {catalogState === "loading"
                          ? tr("Đang tải danh mục chủ đề…", "Loading the topic catalog…")
                          : catalogState === "inconsistent"
                            ? tr("Danh mục câu hỏi không nhất quán. Cần kiểm tra danh mục trên máy chủ để tiếp tục tạo khảo sát.", "The question catalog is inconsistent. It needs to be checked on the server before you can create a survey.")
                            : tr("Danh mục chủ đề chưa khả dụng. Hãy tải lại để tiếp tục tạo khảo sát.", "The topic catalog is unavailable. Retry to continue creating the survey.")}
                        {catalogState !== "loading" && <Button type="button" variant="secondary" onClick={() => setCatalogRetry(value => value + 1)}>{tr("Tải lại chủ đề", "Retry topics")}</Button>}
                      </div>}
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                        {categories.map((category) => {
                          const selected = draft.categoryIds.includes(
                            category.id,
                          )
                          return (
                            <label
                              key={category.id}
                              className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 transition-all ${
                                selected
                                  ? "border-orange-500 bg-orange-50/50 font-semibold text-orange-950 shadow-sm"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                              }`}
                            >
                              <span className="shrink-0 text-base" aria-hidden="true">
                                {topicIcon(category.name)}
                              </span>
                              <span className="min-w-0 flex-1 text-xs font-medium leading-tight">
                                {topicLabel(category.name, language)}
                              </span>
                              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${selected ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-500"}`}>
                                {category.defaultQuestions.length} {tr("câu chuẩn", "standard")}
                              </span>
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleCategory(category.id)}
                                className="size-3.5 shrink-0 rounded-full accent-orange-500"
                              />
                            </label>
                          )
                        })}
                      </div>
                    </fieldset>
                  </div>
                  <div className={surveyStudioQuestions} aria-label={tr("Quản lý câu hỏi", "Question management")}>
                    {selectedCategories.length > 0 ? (
                      <SurveyQuestionWizard
                        categories={selectedCategories}
                        stagedQuestions={stagedQuestions}
                        customQuestions={customQuestions}
                        customDraft={customDraft}
                        editingCustom={editingCustomIndex !== null}
                        onToggleBank={toggleBankQuestion}
                        onSetBank={(category, selected) => setStagedQuestions(current => [
                          ...current.filter(question => question.categoryId !== category.id),
                          ...(selected ? category.questionBank.map(({ questionText, categoryId, questionType, answerConfig, displayOrder }) => ({ questionText, categoryId, questionType, answerConfig, displayOrder })) : []),
                        ])}
                        onCustomDraft={setCustomDraft}
                        onAddCustom={addCustomQuestion}
                        onRemoveCustom={(index) =>
                          {
                            setCustomQuestions(current => current.filter((_, itemIndex) => itemIndex !== index))
                            if (editingCustomIndex === index) {
                              setCustomDraft(emptyQuestion())
                              setEditingCustomIndex(null)
                            } else if (editingCustomIndex !== null && editingCustomIndex > index) {
                              setEditingCustomIndex(editingCustomIndex - 1)
                            }
                          }
                        }
                        onEditCustom={(index) => {
                          const question = customQuestions[index]
                          setCustomDraft({
                            questionText: question.questionText,
                            categoryId: question.categoryId,
                            questionType: question.questionType,
                            options: isChoiceConfig(question.answerConfig)
                              ? question.answerConfig.options.map((option) => option.label).join("\n")
                              : "",
                            displayOrder: question.displayOrder,
                          })
                          setEditingCustomIndex(index)
                        }}
                      />
                    ) : (
                      <div className="grid min-h-40 flex-1 place-items-center px-6 py-10 text-center text-sm text-slate-600">
                        {tr("Chọn chủ đề để xem câu hỏi chuẩn và ngân hàng bổ sung.", "Select a topic to view its standard questions and question bank.")}
                      </div>
                    )}
                  </div>
                </div>
                <div className={surveyStudioFooter}>
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Sparkles size={17} className="shrink-0 text-orange-500" />
                    {tr(
                      `Đã chọn: ${draft.categoryIds.length} chủ đề · ${totalQuestionCount} câu hỏi (${defaultCount} câu chuẩn · ${stagedQuestions.length} bổ sung · ${totalQuestionCount - defaultCount - stagedQuestions.length} tự tạo) · Gửi tới ${totalEmployees} nhân sự`,
                      `Selected: ${draft.categoryIds.length} topics · ${totalQuestionCount} questions (${defaultCount} standard · ${stagedQuestions.length} bank · ${totalQuestionCount - defaultCount - stagedQuestions.length} custom) · ${totalEmployees} recipients`,
                    )}
                  </p>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setSurveyFormOpen(false)
                        setDraft(emptyDraft())
                        setStagedQuestions([])
                        setCustomQuestions([])
                        setCustomDraft(emptyQuestion())
                      }}
                    >
                      {tr("Hủy", "Cancel")}
                    </Button>
                    <Button
                      type="submit"
                      name="createAction"
                      value="draft"
                      variant="secondary"
                      disabled={pending || catalogState !== "ready" || selectedCategories.length === 0}
                    >
                      {t(pending ? "Saving..." : "Create draft")}
                    </Button>
                    <Button
                      type="submit"
                      name="createAction"
                      value="publish"
                      className="bg-gradient-to-r from-orange-600 to-red-600 text-white hover:from-orange-700 hover:to-red-700"
                      disabled={pending || catalogState !== "ready" || selectedCategories.length === 0}
                    >
                      <Send size={15} />
                      {tr("Xem trước & phát hành", "Preview & publish")}
                    </Button>
                  </div>
                </div>
              </form>
            </section>
            </div>
          )}
        </>
      )}

      {managedSurvey && (
        <SurveyDraftEditor
          survey={managedSurvey}
          categories={categories}
          metadata={draft}
          totalEmployees={totalEmployees}
          pending={pending}
          onMetadata={setDraft}
          hidden={Boolean(previewSurvey || publishTarget)}
          error={authoringError}
          onSave={(questions, publishAfterSave) => {
            if (!publishAfterSave) {
              void saveStudio(questions, false)
              return
            }
            setPreviewMode("edit")
            setAuthoringError("")
            setPreviewSurvey({ ...managedSurvey, ...surveyMetadata(), questions })
          }}
          onPreview={(questions) => {
            setPreviewMode("edit")
            setAuthoringError("")
            setPreviewSurvey({ ...managedSurvey, ...surveyMetadata(), questions })
          }}
          onClose={() => {
            setManagedSurvey(null)
            setQuestionDraft(emptyQuestion())
            setDraft(emptyDraft())
          }}
        />
      )}
      {activeSurvey && !isHr && (
        <EmployeeSurveyForm
          survey={activeSurvey}
          answers={answers}
          pending={pending}
          allAnswered={allAnswered}
          error={error}
          onAnswers={setAnswers}
          onClose={() => setActiveSurvey(null)}
          onSubmit={() => void submit(activeSurvey.id)}
        />
      )}
      {previewSurvey && !publishTarget && (
        <SurveyPreviewModal
          survey={previewSurvey}
          categories={categories}
          totalEmployees={totalEmployees}
          pending={pending}
          error={authoringError}
          onClose={() => { if (!pending) setPreviewSurvey(null) }}
          onBack={previewSurvey.status === "DRAFT" ? () => {
            if (previewMode === "saved") void loadSurveyContent(previewSurvey)
            else setPreviewSurvey(null)
          } : undefined}
          onPublish={previewSurvey.status === "DRAFT" ? () => setPublishTarget(previewSurvey) : undefined}
        />
      )}

      {!eligibilityBlocked && !activeSurvey && (
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                {t(isHr ? "Survey list" : "Surveys awaiting your response")}
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-600">
                {t(
                  isHr
                    ? "Manage status, question content, completion and results."
                    : "Select a survey to start your response.",
                )}
              </p>
            </div>
            <span className="text-sm font-semibold text-slate-600">
              {isHr && visibleSurveys.length !== surveys.length
                ? `${visibleSurveys.length}/${surveys.length}`
                : surveys.length}{" "}
              {t("Total surveys").toLocaleLowerCase(
                language === "vi" ? "vi-VN" : "en-US",
              )}
            </span>
          </div>
          {isHr && (
            <Card className="mb-5 overflow-hidden p-3 sm:p-4">
              <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-3">
                {([
                  ["ALL", tr("Tất cả", "All"), surveys.length],
                  ["ACTIVE", tr("🟢 Đang diễn ra", "🟢 Active"), statusCounts.ACTIVE],
                  ["DRAFT", tr("📝 Bản nháp", "📝 Draft"), statusCounts.DRAFT],
                  ["CLOSED", tr("📁 Đã đóng", "📁 Closed"), statusCounts.CLOSED],
                ] as const).map(([value, label, count]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={statusFilter === value}
                    onClick={() => {
                      setStatusFilter(value)
                      if (value !== "ALL")
                        setOpenGroups((current) => ({ ...current, [value]: true }))
                    }}
                    className={`rounded-full px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 ${
                      statusFilter === value
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {label} <span className={statusFilter === value ? "text-slate-300" : "text-slate-400"}>({count})</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(280px,1fr)_230px]">
                <label className="relative block">
                  <span className="sr-only">{tr("Tìm kiếm khảo sát", "Search surveys")}</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={tr("Tìm khảo sát theo tên, mục tiêu...", "Search surveys by title or purpose...")}
                  />
                </label>
                <label>
                  <span className="sr-only">{tr("Sắp xếp khảo sát", "Sort surveys")}</span>
                  <SelectControl
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                  >
                    <option value="NEWEST">{tr("Mới nhất", "Newest")}</option>
                    <option value="END_SOON">{tr("Hạn chót gần nhất", "Nearest deadline")}</option>
                    <option value="RESPONSE_DESC">{tr("Tỷ lệ tham gia cao nhất", "Highest response rate")}</option>
                  </SelectControl>
                </label>
              </div>
            </Card>
          )}
          {loading ? (
            <Card className="p-8 text-center text-sm text-slate-500">
              {t("Loading surveys...")}
            </Card>
          ) : loadFailed ? (
            <Card className="p-6">
              <p className="text-sm text-slate-500">
                {t("Could not load surveys.")}
              </p>
              <Button
                className="mt-3"
                variant="secondary"
                onClick={() => setReload((value) => value + 1)}
              >
                {t("Retry")}
              </Button>
            </Card>
          ) : surveys.length === 0 ? (
            <Card className="p-6">
              <EmptyState
                icon={<ClipboardList size={42} />}
                title={
                  isHr
                    ? "No surveys have been created."
                    : "No surveys are currently available."
                }
                description={
                  isHr
                    ? "Create the first survey draft using the form above."
                    : "New surveys will appear when HR publishes them and invites you."
                }
              />
            </Card>
          ) : visibleSurveys.length === 0 ? (
            <Card className="p-8 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-400"><Search size={22} /></span>
              <h3 className="mt-4 font-semibold text-slate-900">{tr("Không tìm thấy khảo sát phù hợp", "No matching surveys found")}</h3>
              <p className="mt-1 text-sm text-slate-500">{tr("Thử thay đổi từ khóa hoặc trạng thái đang lọc.", "Try a different keyword or status filter.")}</p>
              <Button
                className="mt-4"
                variant="secondary"
                onClick={() => {
                  setSearchQuery("")
                  setStatusFilter("ALL")
                  setSortBy("NEWEST")
                }}
              >
                {tr("Xóa bộ lọc", "Clear filters")}
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {isHr ? groupedSurveys.map((group) => {
                const title = group.status === "DRAFT"
                  ? tr("Bản nháp", "Drafts")
                  : group.status === "ACTIVE"
                    ? tr("Đang diễn ra", "Active surveys")
                    : tr("Đã kết thúc & Lưu trữ", "Closed & archived")
                const icon = group.status === "DRAFT" ? "📝" : group.status === "ACTIVE" ? "🟢" : "📁"
                const badge = group.status === "DRAFT"
                  ? "bg-amber-100 text-amber-800"
                  : group.status === "ACTIVE"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-200 text-slate-700"
                const opened = openGroups[group.status] && (group.status !== "DRAFT" || group.items.length > 0)
                return (
                  <section key={group.status} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50">
                    <button
                      type="button"
                      aria-expanded={opened}
                      onClick={() => setOpenGroups((current) => ({ ...current, [group.status]: !current[group.status] }))}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-orange-500"
                    >
                      <span aria-hidden="true">{icon}</span>
                      <span className="flex-1 text-sm font-semibold text-slate-800">{title}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${badge}`}>{group.items.length}</span>
                      <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${opened ? "rotate-180" : ""}`} />
                    </button>
                    {opened && <div className="space-y-3 border-t border-slate-200 p-3">{group.items.length > 0 ? group.items.map(renderSurveyCard) : <p className="rounded-lg bg-white px-4 py-5 text-center text-sm text-slate-500">{tr("Chưa có khảo sát trong nhóm này.", "No surveys in this section.")}</p>}</div>}
                  </section>
                )
              }) : visibleSurveys.map((survey) => {
                const result = results[survey.id]
                const invited = totalEmployees
                const responses = surveyResponseCount(survey, result)
                const responseRate = surveyResponseRate(
                  survey,
                  result,
                  totalEmployees,
                )
                const responseTone = progressTone(responseRate)
                const deadline = remainingLabel(survey, language)
                const questionCount = survey.questionCount || result?.questions.length || 0
                const minutes = Math.max(1, Math.ceil(questionCount * 0.5))

                return (
                  <Card key={survey.id} className="overflow-hidden border-slate-200 transition-all duration-200 hover:border-orange-300/70 hover:shadow-md">
                    <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(240px,.65fr)_190px] lg:items-center">
                      <div className="min-w-0">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle(survey.status)}`}>
                          <span className={`size-1.5 rounded-full ${survey.status === "ACTIVE" ? "bg-emerald-500" : survey.status === "DRAFT" ? "bg-slate-400" : "bg-slate-300"}`} />
                          {statusLabel[survey.status][language === "vi" ? "vi" : "en"]}
                        </span>
                        <button
                          type="button"
                          onClick={() => isHr ? void showResults(survey.id, true) : void openEmployeeSurvey(survey.id)}
                          className="mt-2 block max-w-full text-left text-base font-semibold text-slate-950 transition hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
                        >
                          {survey.title}
                        </button>
                        <p className="mt-1 line-clamp-1 text-sm text-slate-500">
                          {survey.description || "Chưa có mô tả cho khảo sát này."}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1.5">
                            <CalendarDays size={14} />
                            {dateLabel(survey.startDate)} – {dateLabel(survey.endDate)}
                          </span>
                          {deadline && <span className={`rounded-full border px-2 py-1 ${deadline.className}`}>{deadline.label}</span>}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{responses} / {invited || 0} {tr("nhân viên", "employees")}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{tr("Lượt phản hồi đã ghi nhận", "Responses received")}</p>
                          </div>
                          <strong className={`text-sm font-bold tabular-nums ${responseTone.text}`}>{responseRate.toFixed(1)}%</strong>
                        </div>
                        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`Tiến độ phản hồi ${survey.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(responseRate))}>
                          <span className={`block h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out ${responseTone.fill}`} style={{ width: `${Math.min(100, Math.max(0, responseRate))}%` }} />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-500">
                            <Clock3 size={13} /> {questionCount} {tr("câu hỏi", "questions")} · ~{minutes} {tr("phút hoàn thành", "min to complete")}
                          </p>
                          <span className={`text-xs font-semibold ${responseTone.text}`}>
                            {language === "vi" ? responseTone.hintVi : responseTone.hintEn}
                          </span>
                        </div>
                      </div>
                        {isHr ? (
                          <div className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch">
                            <Button
                              size="sm"
                              variant="success"
                              disabled={loadingResults}
                              onClick={() => void showResults(survey.id, true)}
                            >
                              <Eye size={15} />
                              {tr("Xem phản hồi", "View responses")}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={loadingResults}
                              onClick={() => void showResults(survey.id)}
                            >
                              <BarChart3 size={15} />
                              {openResults === survey.id ? tr("Ẩn tổng quan", "Hide overview") : tr("Tổng quan", "Overview")}
                            </Button>
                            {survey.status === "DRAFT" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    setSurveyFormOpen(false)
                                    setEditSurvey(survey)
                                    setDraft({
                                      title: survey.title,
                                      description: survey.description || "",
                                      startDate: employeeDate(survey.startDate),
                                      endDate: employeeDate(survey.endDate),
                                      categoryIds: [],
                                    })
                                    setStagedQuestions([])
                                    setCustomQuestions([])
                                    setCustomDraft(emptyQuestion())
                                  }}
                                >
                                  <Pencil size={15} />
                                  {tr("Sửa", "Edit")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => void loadSurveyContent(survey)}
                                >
                                  <ListChecks size={15} />
                                  {tr("Câu hỏi", "Questions")}
                                </Button>
                                <Button
                                  size="sm"
                                  disabled={pending}
                                  onClick={() => setPublishTarget(survey)}
                                >
                                  <PlayCircle size={15} />
                                  {tr("Xuất bản", "Publish")}
                                </Button>
                              </>
                            )}
                            {survey.status === "ACTIVE" && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => void finishSurvey(survey.id)}
                              >
                                {tr("Đóng khảo sát", "Close survey")}
                              </Button>
                            )}
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => void openEmployeeSurvey(survey.id)}
                          >
                            <PlayCircle size={15} />
                            Bắt đầu
                          </Button>
                        )}
                    </div>
                    {isHr && openResults === survey.id && result && (
                      <ResultOverview
                        result={result}
                        totalEmployees={totalEmployees}
                        employeeDirectory={employeeDirectory}
                        departments={departments}
                        participants={participantsBySurvey[survey.id] || []}
                      />
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </section>
      )}

      {!isHr && !activeSurvey && (
        <EmployeeSurveyHistory account={user.email} revision={reload} />
      )}
      {detailResult && (
        <SurveyResultDetails
          result={detailResult.result}
          totalEmployees={totalEmployees}
          participants={detailResult.participants}
          onClose={() => setDetailResult(null)}
        />
      )}
      <ConfirmationDialog
        open={Boolean(publishTarget)}
        title={tr("Xác nhận xuất bản khảo sát?", "Confirm survey publishing?")}
        description={tr(
          `“${publishTarget?.title || "Khảo sát"}” sẽ được khóa nội dung và gửi tới toàn bộ ${totalEmployees} nhân sự đang hoạt động. Hành động này không thể hoàn tác.`,
          `“${publishTarget?.title || "Survey"}” will be locked and sent to all ${totalEmployees} active employees. This action cannot be undone.`,
        )}
        confirmLabel={tr("Xác nhận xuất bản", "Confirm publishing")}
        onCancel={() => setPublishTarget(null)}
        onConfirm={() => {
          const target = publishTarget
          setPublishTarget(null)
          if (!target) return
          if (previewMode === "create") void persistNewSurvey(customQuestions, true)
          else if (previewMode === "edit" && previewSurvey) void saveStudio(previewSurvey.questions, true)
          else void publish(target.id)
        }}
      />
    </AppShell>
  )
}

function SurveyEditDialog({
  survey,
  draft,
  pending,
  onDraft,
  onSave,
  onClose,
}: {
  survey: SurveySummary
  draft: Draft
  pending: boolean
  onDraft: (value: Draft) => void
  onSave: (event: FormEvent) => void
  onClose: () => void
}) {
  const { t, language } = useLanguage()

  useDialogBehavior(true, onClose)

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-survey-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <form
        onSubmit={onSave}
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2
              id="edit-survey-title"
              className="truncate text-lg font-semibold text-slate-950"
            >
              {t("Edit")}: {survey.title}
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-600">
              {language === "vi"
                ? "Cập nhật thông tin và thời gian của khảo sát."
                : "Update the survey details and schedule."}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("Close")}
            className="flex size-10 shrink-0 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>

        <div className="grid gap-4 overflow-y-auto p-5 sm:grid-cols-2 sm:p-6">
          <label className="text-sm font-semibold text-slate-700">
            {t("Title")}
            <input
              required
              autoFocus
              maxLength={255}
              className={control}
              value={draft.title}
              onChange={(event) =>
                onDraft({ ...draft, title: event.target.value })
              }
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            {t("Survey purpose")}
            <input
              maxLength={4000}
              className={control}
              value={draft.description}
              onChange={(event) =>
                onDraft({ ...draft, description: event.target.value })
              }
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            {t("Start date")}
            <input
              required
              type="date"
              className={control}
              value={draft.startDate}
              onChange={(event) =>
                onDraft({ ...draft, startDate: event.target.value })
              }
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            {t("End date")}
            <input
              required
              type="date"
              min={draft.startDate || undefined}
              className={control}
              value={draft.endDate}
              onChange={(event) =>
                onDraft({ ...draft, endDate: event.target.value })
              }
            />
          </label>
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button disabled={pending}>
            {pending ? "Đang lưu..." : "Lưu thay đổi bản nháp"}
          </Button>
        </footer>
      </form>
    </div>
  )
}

function SurveyContentEditor({
  survey,
  categories,
  draft,
  pending,
  onDraft,
  onSave,
  onDelete,
  onClose,
}: {
  survey: SurveySummary & { questions: SurveyQuestion[] }
  categories: SurveyCategory[]
  draft: QuestionDraft
  pending: boolean
  onDraft: (value: QuestionDraft) => void
  onSave: (event: FormEvent) => void
  onDelete: (question: SurveyQuestion) => void
  onClose: () => void
}) {
  useDialogBehavior(true, onClose)

  const needsOptions =
    draft.questionType === "SINGLE_CHOICE" ||
    draft.questionType === "MULTIPLE_CHOICE"

  const custom = survey.questions.filter(
    (question) => !question.isSatisfactionCore,
  )

  const questionFormRef = useRef<HTMLFormElement>(null)
  const questionTextRef = useRef<HTMLTextAreaElement>(null)

  const startEdit = (question: SurveyQuestion) => {
    onDraft({
      questionId: question.id,
      questionText: question.questionText,
      categoryId: question.categoryId,
      questionType: question.questionType,
      options: isChoiceConfig(question.answerConfig)
        ? question.answerConfig.options.map((option) => option.label).join("\n")
        : "",
      displayOrder: question.displayOrder,
    })
    questionTextRef.current?.focus({ preventScroll: true })
    questionFormRef.current?.scrollIntoView({ block: "start" })
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="survey-questions-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
        <header className="flex flex-col gap-3 border-b border-slate-200 bg-orange-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              id="survey-questions-title"
              className="font-semibold text-slate-950"
            >
              Nội dung khảo sát: {survey.title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Câu hỏi mặc định được khóa; câu hỏi bổ sung có thể sửa hoặc xóa
              khi còn là bản nháp.
            </p>
          </div>
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
        </header>
        <div className="grid gap-6 overflow-y-auto p-5 xl:grid-cols-[1.25fr_.75fr]">
          <section>
            <h3 className="mb-3 font-semibold text-slate-900">
              Danh sách câu hỏi ({survey.questions.length})
            </h3>
            <div className="space-y-3">
              {survey.questions.map((question, index) => (
                <article
                  key={question.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-bold text-orange-700">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-blue-700">
                          {questionTypeLabels[question.questionType]}
                        </span>
                        {question.isSatisfactionCore && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            Câu hỏi chuẩn
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-medium leading-6 text-slate-900">
                        {question.questionText}
                      </p>
                      {isChoiceConfig(question.answerConfig) && (
                        <p className="mt-2 text-xs text-slate-500">
                          {question.answerConfig.options
                            .map((option) => option.label)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                    {!question.isSatisfactionCore && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          aria-label="Sửa câu hỏi"
                          className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                          onClick={() => startEdit(question)}
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          type="button"
                          aria-label="Xóa câu hỏi"
                          className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                          onClick={() => onDelete(question)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {custom.length === 0 && (
              <p className="mt-3 text-sm italic text-slate-500">
                Chưa có câu hỏi tùy chỉnh.
              </p>
            )}
          </section>
          <form
            ref={questionFormRef}
            onSubmit={onSave}
            className="h-fit rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <h3 className="font-semibold text-slate-900">
              {draft.questionId
                ? "Sửa câu hỏi tùy chỉnh"
                : "Thêm câu hỏi tùy chỉnh"}
            </h3>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Chủ đề
              <SelectControl
                required
                className={control}
                value={draft.categoryId}
                onChange={(event) =>
                  onDraft({ ...draft, categoryId: Number(event.target.value) })
                }
              >
                <option value="">Chọn chủ đề</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {topicLabel(category.name)}
                  </option>
                ))}
              </SelectControl>
            </label>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Loại câu hỏi
              <SelectControl
                className={control}
                value={draft.questionType}
                onChange={(event) =>
                  onDraft({
                    ...draft,
                    questionType: event.target.value as SurveyQuestionType,
                  })
                }
              >
                {Object.entries(questionTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectControl>
            </label>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Nội dung
              <textarea
                ref={questionTextRef}
                required
                maxLength={4000}
                className={area}
                value={draft.questionText}
                onChange={(event) =>
                  onDraft({ ...draft, questionText: event.target.value })
                }
              />
            </label>
            {needsOptions && (
              <label className="mt-4 block text-sm font-semibold text-slate-700">
                Các lựa chọn{" "}
                <span className="font-normal text-slate-500">
                  (mỗi dòng một lựa chọn)
                </span>
                <textarea
                  required
                  className={area}
                  value={draft.options}
                  onChange={(event) =>
                    onDraft({ ...draft, options: event.target.value })
                  }
                />
              </label>
            )}
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Thứ tự hiển thị
              <input
                required
                type="number"
                min={0}
                max={10000}
                className={control}
                value={draft.displayOrder}
                onChange={(event) =>
                  onDraft({
                    ...draft,
                    displayOrder: Number(event.target.value),
                  })
                }
              />
            </label>
            <div className="mt-5 flex gap-2">
              {draft.questionId && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    onDraft({
                      ...emptyQuestion(),
                      categoryId: categories[0]?.id || 0,
                    })
                  }
                >
                  Hủy sửa
                </Button>
              )}
              <Button
                disabled={
                  pending ||
                  !draft.categoryId ||
                  !draft.questionText.trim() ||
                  (needsOptions &&
                    draft.options.split("\n").filter(Boolean).length < 2)
                }
              >
                <Plus size={16} />
                {draft.questionId ? "Lưu câu hỏi" : "Thêm câu hỏi"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function EmployeeSurveyForm({
  survey,
  answers,
  pending,
  allAnswered,
  error,
  onAnswers,
  onClose,
  onSubmit,
}: {
  survey: SurveySummary & { questions: SurveyQuestion[] }
  answers: Record<number, AnswerDraft>
  pending: boolean
  allAnswered: boolean
  error: string
  onAnswers: React.Dispatch<React.SetStateAction<Record<number, AnswerDraft>>>
  onClose: () => void
  onSubmit: () => void
}) {
  const setValue = (id: number, value: SurveyAnswerValue) =>
    onAnswers((current) => ({
      ...current,
      [id]: { value, comment: current[id]?.comment || "" },
    }))

  const selectedCodes = (id: number) => {
    const value = answers[id]?.value
    return typeof value === "object" && value && "selectedCodes" in value
      ? value.selectedCodes
      : []
  }

  return (
    <Card className="mb-6 overflow-hidden">
      <header className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-orange-50 to-white px-5 py-5 sm:flex-row sm:justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-orange-600">
            Khảo sát nhân viên
          </span>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            {survey.title}
          </h2>
          {survey.description && (
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {survey.description}
            </p>
          )}
        </div>
        <Button variant="secondary" onClick={onClose}>
          Hủy
        </Button>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
        className="p-5 sm:p-6"
      >
        <div className="mb-5 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span>
            {
              survey.questions.filter((question) => {
                const value = answers[question.id]?.value
                return question.questionType === "TEXT"
                  ? typeof value === "string" && Boolean(value.trim())
                  : question.questionType === "RATING"
                    ? Number.isInteger(value)
                    : typeof value === "object" &&
                      value !== null &&
                      "selectedCodes" in value &&
                      value.selectedCodes.length > 0
              }).length
            }
            /{survey.questions.length} câu đã trả lời
          </span>
          <span>Mọi câu hỏi đều bắt buộc</span>
        </div>
        <div className="space-y-4">
          {survey.questions.map((question, index) => (
            <fieldset
              key={question.id}
              className="rounded-2xl border border-slate-200 p-4 sm:p-5"
            >
              <legend className="sr-only">{question.questionText}</legend>
              <div className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-bold text-orange-700">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold leading-6 text-slate-900">
                    {question.questionText}
                    <span className="ml-1 text-red-500">*</span>
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase text-slate-400">
                    {questionTypeLabels[question.questionType]}
                  </p>
                </div>
              </div>
              {question.questionType === "RATING" && (
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-5">
                  {(isRatingConfig(question.answerConfig)
                    ? question.answerConfig.labels
                    : ratingLabels
                  ).map((label, scoreIndex) => {
                    const score = scoreIndex + 1
                    return (
                      <button
                        key={score}
                        type="button"
                        aria-pressed={answers[question.id]?.value === score}
                        onClick={() => setValue(question.id, score)}
                        className={`min-h-14 rounded-xl border px-2 py-2 text-sm font-semibold transition ${
                          answers[question.id]?.value === score
                            ? "border-orange-500 bg-orange-500 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-orange-50"
                        }`}
                      >
                        <span className="block text-sm font-semibold">
                          {label === "Không hài lòng cũng không bất mãn" ? "Bình thường" : label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
              {question.questionType === "TEXT" && (
                <textarea
                  required
                  maxLength={4000}
                  rows={4}
                  className={area}
                  placeholder="Nhập câu trả lời của bạn"
                  value={
                    typeof answers[question.id]?.value === "string"
                      ? answers[question.id].value as string
                      : ""
                  }
                  onChange={(event) =>
                    setValue(question.id, event.target.value)
                  }
                />
              )}
              {(question.questionType === "SINGLE_CHOICE" ||
                question.questionType === "MULTIPLE_CHOICE") &&
                isChoiceConfig(question.answerConfig) && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {question.answerConfig.options.map((option) => {
                      const checked = selectedCodes(question.id).includes(
                        option.code,
                      )
                      return (
                        <label
                          key={option.code}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${
                            checked
                              ? "border-orange-300 bg-orange-50 text-orange-900"
                              : "border-slate-200 text-slate-700"
                          }`}
                        >
                          <input
                            type={
                              question.questionType === "SINGLE_CHOICE"
                                ? "radio"
                                : "checkbox"
                            }
                            name={`question-${question.id}`}
                            checked={checked}
                            onChange={() => {
                              const current = selectedCodes(question.id)
                              const next =
                                question.questionType === "SINGLE_CHOICE"
                                  ? [option.code]
                                  : checked
                                    ? current.filter(
                                        (code) => code !== option.code,
                                      )
                                    : [...current, option.code]
                              setValue(question.id, { selectedCodes: next })
                            }}
                            className="size-4 accent-orange-500"
                          />
                          {option.label}
                        </label>
                      )
                    })}
                  </div>
                )}
              {question.questionType !== "TEXT" && (
                <label className="mt-4 block text-sm font-medium text-slate-600">
                  Ghi chú{" "}
                  <span className="font-normal text-slate-400">
                    (không bắt buộc)
                  </span>
                  <textarea
                    maxLength={1000}
                    rows={2}
                    className={area}
                    value={answers[question.id]?.comment || ""}
                    onChange={(event) =>
                      onAnswers((current) => ({
                        ...current,
                        [question.id]: {
                          value: current[question.id]?.value,
                          comment: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
              )}
            </fieldset>
          ))}
        </div>
        {error && <p className="mt-5 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex justify-end">
          <Button disabled={pending || !allAnswered}>
            <Send size={16} />
            {pending ? "Đang gửi..." : "Gửi câu trả lời"}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function ResultOverview({
  result,
  totalEmployees,
  employeeDirectory,
  departments,
  participants,
}: {
  result: SurveyResults
  totalEmployees: number
  employeeDirectory: EmployeeProfile[]
  departments: ApiDepartment[]
  participants: SurveyParticipant[]
}) {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const invitedCount = totalEmployees
  const submittedCount = result.responseCount
  const completionRate = surveyResponseRate(result.survey, result, totalEmployees)
  const tone = progressTone(completionRate)
  const departmentProgress = useMemo(() => {
    const groups = new Map<string, { invited: number; submitted: number }>()
    const departmentNames = new Map(departments.map(department => [department.id, department.name]))
    const submittedIds = new Set(participants.filter(participant => participant.status === "SUBMITTED").map(participant => participant.employeeId))
    employeeDirectory.forEach(employee => {
      const name = departmentNames.get(employee.departmentId) ?? tr("Chưa xác định", "Unassigned")
      const current = groups.get(name) || { invited: 0, submitted: 0 }
      current.invited += 1
      if (submittedIds.has(employee.id)) current.submitted += 1
      groups.set(name, current)
    })
    return [...groups.entries()]
      .map(([name, counts]) => ({
        name,
        ...counts,
        rate: counts.invited > 0 ? (counts.submitted / counts.invited) * 100 : 0,
      }))
      .sort((left, right) => left.rate - right.rate)
  }, [participants, employeeDirectory, departments, language])

  return (
    <div className="border-t border-slate-200 bg-slate-50/70 p-5 sm:p-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {tr("Tiến độ tham gia", "Participation progress")}
          </p>
          <strong className={`mt-1 block text-3xl font-bold tracking-tight ${tone.text}`}>{completionRate.toFixed(1)}%</strong>
          <p className="mt-1 text-sm font-semibold text-slate-700">{submittedCount} / {invitedCount} {tr("nhân sự", "employees")}</p>
        </div>
        <div className="min-w-0 flex-1 lg:max-w-xl">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className={`rounded-full px-2 py-1 font-semibold ${completionRate >= 60 ? "bg-emerald-50" : "bg-amber-50"} ${tone.text}`}>{language === "vi" ? tone.hintVi : tone.hintEn}</span>
          </div>
          <div
            className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.round(completionRate))}
          >
            <span
              className={`block h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out ${tone.fill}`}
              style={{ width: `${Math.min(100, Math.max(0, completionRate))}%` }}
            />
          </div>
        </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-100 pt-4 text-sm">
          <span className="text-slate-500">{tr("Nhân sự đang làm việc", "Active employees")}: <strong className="text-slate-900">{invitedCount}</strong></span>
          <span className="text-slate-500">{tr("Đã nộp", "Submitted")}: <strong className="text-emerald-700">{submittedCount}</strong></span>
        </div>
      </div>
      {departmentProgress.length > 0 && (
        <section className="mt-5">
          <h4 className="font-semibold text-slate-950">{tr("Tiến độ theo phòng ban", "Department progress")}</h4>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {departmentProgress.map((department) => {
              const departmentTone = progressTone(department.rate)
              return <div key={department.name} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"><div className="flex items-center justify-between gap-3 text-xs"><span className="truncate font-semibold text-slate-700">{department.name}</span><span className={`font-bold tabular-nums ${departmentTone.text}`}>{department.submitted}/{department.invited} · {department.rate.toFixed(0)}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full bg-gradient-to-r ${departmentTone.fill}`} style={{ width: `${department.rate}%` }} /></div></div>
            })}
          </div>
        </section>
      )}
      <h4 className="mt-5 font-semibold text-slate-950">
        {tr("Điểm gắn kết theo chủ đề", "Engagement score by topic")}
      </h4>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {result.categoryScores.map((category) => (
          <div
            key={category.categoryId}
            className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {topicLabel(category.name, language)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {category.responseCount} {tr("phản hồi hợp lệ", "valid responses")}
                </p>
              </div>
              <strong className="text-xl text-orange-600">
                {category.satisfactionScore?.toFixed(2) ?? "—"}
              </strong>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-teal-400"
                style={{
                  width: `${
                    category.satisfactionScore == null
                      ? 0
                      : (category.satisfactionScore / 5) * 100
                  }%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
