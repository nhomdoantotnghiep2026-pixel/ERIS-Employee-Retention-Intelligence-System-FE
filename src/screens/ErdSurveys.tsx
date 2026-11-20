import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react"

import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
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
  "Không hài lòng cũng không bất mãn",
  "Hài lòng",
  "Rất hài lòng",
]

const questionTypeLabels: Record<SurveyQuestionType, string> = {
  RATING: "Thang điểm 1–5",
  TEXT: "Câu trả lời văn bản",
  SINGLE_CHOICE: "Chọn một",
  MULTIPLE_CHOICE: "Chọn nhiều",
}

const topicLabel = (name: string) =>
  name
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLocaleLowerCase())
    .join(" ")

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

  const [employeeDirectory, setEmployeeDirectory] = useState<EmployeeProfile[]>([])

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

  const [publishTarget, setPublishTarget] = useState<SurveySummary | null>(null)

  const [previewSurvey, setPreviewSurvey] = useState<
    (SurveySummary & { questions: SurveyQuestion[] }) | null
  >(null)

  const [searchQuery, setSearchQuery] = useState("")

  const [statusFilter, setStatusFilter] =
    useState<"ALL" | SurveySummary["status"]>("ALL")

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

  useDialogBehavior(surveyFormOpen, () => setSurveyFormOpen(false))

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
    if (!isHr || editSurvey) return

    const controller = new AbortController()

    void listSurveyCategories(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setCategories(result.data)
          setDraft((current) => ({ ...current, categoryIds: [] }))
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(getApiErrorMessage(cause, "Không thể tải chủ đề khảo sát."))
      })

    return () => controller.abort()
  }, [editSurvey, isHr, setError])

  useEffect(() => {
    if (!isHr) return
    const controller = new AbortController()
    setDirectoryLoading(true)

    void listEmployeeProfiles({ page: 1, limit: 10_000 }, controller.signal)
      .then((employeesResult) => {
        if (controller.signal.aborted) return
        setEmployeeDirectory(
          employeesResult.data.filter(
            (employee) => employee.employmentStatus !== "INACTIVE",
          ),
        )
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
    defaultCount + stagedQuestions.length + customQuestions.length

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

  function addCustomQuestion() {
    if (!customDraft.questionText.trim() || !customDraft.categoryId) {
      setError(tr("Chọn chủ đề và nhập nội dung câu hỏi tự tạo.", "Choose a topic and enter the custom question."))
      return
    }
    if (!draft.categoryIds.includes(customDraft.categoryId)) {
      setError(tr("Câu hỏi tự tạo phải thuộc một chủ đề đã chọn.", "A custom question must belong to a selected topic."))
      return
    }
    const needsOptions =
      customDraft.questionType === "SINGLE_CHOICE" ||
      customDraft.questionType === "MULTIPLE_CHOICE"
    const options = customDraft.options
      .split("\n")
      .map((option) => option.trim())
      .filter(Boolean)
    if (needsOptions && options.length < 2) {
      setError(tr("Câu hỏi lựa chọn cần ít nhất 2 phương án.", "Choice questions require at least two options."))
      return
    }

    setCustomQuestions((current) => [
      ...current,
      questionInput({
        ...customDraft,
        displayOrder: 100 + current.length,
      }),
    ])
    setCustomDraft({
      ...emptyQuestion(),
      categoryId: draft.categoryIds[0] || 0,
    })
    setError("")
  }

  async function openPreview(survey: SurveySummary) {
    setError("")
    try {
      const detail = await getSurveyForEmployee(survey.id)
      setPreviewSurvey(detail.data)
    } catch (cause) {
      setError(getApiErrorMessage(cause, tr("Không thể mở bản xem trước.", "Could not open preview.")))
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault()
    if (pending || draft.categoryIds.length === 0) return
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null
    const publishNow = submitter?.value === "publish"

    setPending(true)
    setError("")
    setMessage("")

    try {
      const created = await createSurvey({
        title: draft.title.trim(),
        description: draft.description.trim() || null,

        categoryIds: draft.categoryIds,
        questions: [...stagedQuestions, ...customQuestions],
        startDate: dateWithZone(draft.startDate),
        endDate: dateWithZone(draft.endDate, true),
      })

      if (publishNow) {
        const preview = await getSurveyForEmployee(created.data.id)
        setPreviewSurvey(preview.data)
      }

      setDraft(emptyDraft())
      setStagedQuestions([])
      setCustomQuestions([])
      setCustomDraft(emptyQuestion())
      setSurveyFormOpen(false)
      setMessage(
        publishNow
          ? "Đã tạo bản nháp. Hãy kiểm tra bản xem trước trước khi xác nhận xuất bản."
          : "Đã tạo bản nháp khảo sát cùng bộ câu hỏi hài lòng mặc định.",
      )
      setReload((value) => value + 1)
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Không thể tạo khảo sát."))
    } finally {
      setPending(false)
    }
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

    try {
      const detail = await getSurveyForEmployee(survey.id)

      setManagedSurvey(detail.data)
      setDraft({
        title: survey.title,
        description: survey.description || "",
        startDate: employeeDate(survey.startDate),
        endDate: employeeDate(survey.endDate),
        categoryIds: [],
      })

      const topicResult = await listSurveyCategories()

      const selectedIds = new Set(
        detail.data.questions.map((question) => question.categoryId),
      )

      const allowedTopics = topicResult.data.filter((category) =>
        selectedIds.has(category.id),
      )

      setCategories(topicResult.data)
      setDraft((current) => ({
        ...current,
        categoryIds: [...selectedIds],
      }))

      setQuestionDraft((current) => ({
        ...current,
        categoryId: allowedTopics[0]?.id || 0,
      }))
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Không thể tải nội dung khảo sát."))
    }
  }

  async function saveStudio(
    questions: SurveyQuestion[],
    publishAfterSave: boolean,
  ) {
    if (!managedSurvey || pending) return
    setPending(true)
    setError("")
    try {
      await updateSurvey(managedSurvey.id, {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        startDate: dateWithZone(draft.startDate),
        endDate: dateWithZone(draft.endDate, true),
      })

      const originalCustom = managedSurvey.questions.filter(
        (question) => !question.isSatisfactionCore,
      )
      const currentIds = new Set(
        questions.filter((question) => question.id > 0).map((question) => question.id),
      )
      for (const question of originalCustom)
        if (!currentIds.has(question.id))
          await deleteSurveyQuestion(managedSurvey.id, question.id)

      for (const question of questions.filter((item) => !item.isSatisfactionCore)) {
        const input: SurveyQuestionInput = {
          questionText: question.questionText.trim(),
          categoryId: question.categoryId,
          questionType: question.questionType,
          answerConfig: question.answerConfig,
          displayOrder: question.displayOrder,
        }
        if (question.id > 0)
          await updateSurveyQuestion(managedSurvey.id, question.id, input)
        else await addSurveyQuestion(managedSurvey.id, input)
      }

      const refreshed = await getSurveyForEmployee(managedSurvey.id)
      setManagedSurvey(null)
      setDraft(emptyDraft())
      setReload((value) => value + 1)
      if (publishAfterSave) setPreviewSurvey(refreshed.data)
      setMessage(
        publishAfterSave
          ? "Đã lưu bản nháp. Hãy kiểm tra bản xem trước trước khi xuất bản."
          : "Đã lưu thay đổi bản nháp.",
      )
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Không thể lưu thay đổi bản nháp."))
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
      setManagedSurvey(null)
      setMessage("Đã xuất bản khảo sát.")
      setReload((value) => value + 1)
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Không thể xuất bản khảo sát."))
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

      if (details) {
        const participants = await getSurveyParticipants(id)
        setDetailResult({
          result: result.data,
          participants: participants.data,
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
    const totalInvited = surveys.reduce(
      (sum, survey) =>
        sum + surveyInvitedCount(survey, results[survey.id], totalEmployees),
      0,
    )
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
      ["survey_id", "title", "invited", "submitted", "completion_rate"],
      [survey.id, survey.title, result.invitedCount, result.responseCount, result.completionRate ?? 0],
      [],
      ["category", "valid_responses", "engagement_score"],
      ...result.categoryScores.map((category) => [
        topicLabel(category.name),
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
    const invited = surveyInvitedCount(survey, result, totalEmployees)
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
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`Tiến độ phản hồi ${survey.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(responseRate)}>
                <span className={`block h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out ${responseTone.fill}`} style={{ width: `${Math.min(100, Math.max(0, responseRate))}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className={`font-semibold ${responseTone.text}`}>{language === "vi" ? responseTone.hintVi : responseTone.hintEn}</span>
                {isClosed && <span className="font-semibold text-slate-600">{tr("Điểm gắn kết", "Engagement")}: {averageScore?.toFixed(2) ?? "—"} / 5</span>}
              </div>
            </div>
          )}

          {isHr ? (
            <div className="flex flex-wrap gap-2 lg:flex-col lg:items-stretch">
              {isDraft ? (
                <>
                  <Button size="sm" variant="secondary" onClick={() => void loadSurveyContent(survey)}><Pencil size={15} />{tr("Sửa câu hỏi", "Edit questions")}</Button>
                  <Button size="sm" variant="secondary" onClick={() => void openPreview(survey)}><Eye size={15} />{tr("Xem trước", "Preview")}</Button>
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
        {isHr && openResults === survey.id && result && <ResultOverview result={result} />}
      </Card>
    )
  }

  const groupedSurveys = (["DRAFT", "ACTIVE", "CLOSED"] as const)
    .map((status) => ({ status, items: visibleSurveys.filter((survey) => survey.status === status) }))
    .filter((group) => group.items.length > 0)

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
              aria-modal="true"
              aria-labelledby="create-survey-title"
            >
            <section className="flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
              <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                    <FilePlus2 size={18} />
                  </span>
                  <div>
                    <h2 id="create-survey-title" className="text-lg font-semibold text-slate-950">
                      {t("Create a new survey")}
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
                className="grid min-h-0 gap-5 overflow-y-auto p-5 sm:grid-cols-2 sm:p-6"
              >
                <label className="text-sm font-semibold text-slate-700">
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
                <label className="text-sm font-semibold text-slate-700">
                  {t("Survey purpose")}
                  <input
                    maxLength={4000}
                    className={control}
                    value={draft.description}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        description: event.target.value,
                      }))
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
                      setDraft((value) => ({
                        ...value,
                        startDate: event.target.value,
                      }))
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
                {!editSurvey && (
                  <>
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
                        {tr("Chọn chủ đề cần đo lường; câu hỏi chuẩn sẽ được thêm tự động.", "Select topics to measure; standard questions are added automatically.")}
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {categories.map((category) => {
                          const selected = draft.categoryIds.includes(
                            category.id,
                          )
                          return (
                            <label
                              key={category.id}
                              className={`relative flex min-h-24 cursor-pointer flex-col justify-between gap-3 rounded-xl border p-3 transition-all ${
                                selected
                                  ? "border-orange-400 bg-orange-50 shadow-sm ring-1 ring-orange-100"
                                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleCategory(category.id)}
                                className="absolute right-3 top-3 size-4 accent-orange-500"
                              />
                              <span className="text-2xl" aria-hidden="true">
                                {topicIcon(category.name)}
                              </span>
                              <span className="pr-5">
                                <strong className="block text-sm font-semibold leading-5 text-slate-900">
                                  {topicLabel(category.name)}
                                </strong>
                                <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                  {category.defaultQuestions.length} {tr("câu chuẩn", "standard questions")}
                                </span>
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </fieldset>
                    {draft.categoryIds.length > 0 && (
                      <div className="grid gap-3 sm:col-span-2 xl:grid-cols-3">
                        <details className="h-fit rounded-xl border border-slate-200 bg-white p-4">
                          <summary className="cursor-pointer text-[15px] font-semibold text-slate-900 marker:text-orange-500">
                            {defaultCount} câu hỏi hài lòng mặc định
                          </summary>
                          <ol className="mt-3 space-y-2 text-sm font-medium leading-5 text-slate-700">
                            {selectedCategories.flatMap((category) =>
                              category.defaultQuestions.map((question) => (
                                <li
                                  key={
                                    question.templateCode ||
                                    question.catalogQuestionId
                                  }
                                  className="rounded-lg bg-slate-50 px-3 py-2"
                                >
                                  <span className="font-semibold text-orange-700">
                                    {topicLabel(category.name)}:
                                  </span>{" "}
                                  {question.questionText}
                                </li>
                              )),
                            )}
                          </ol>
                        </details>
                        <details className="h-fit rounded-xl border border-slate-200 bg-white p-4">
                          <summary className="cursor-pointer text-[15px] font-semibold text-slate-900 marker:text-blue-600">
                            Câu hỏi bổ sung{" "}
                            <span className="ml-1 text-sm font-semibold text-blue-700">
                              ({stagedQuestions.length} đã chọn)
                            </span>
                          </summary>
                          <div className="mt-4 space-y-4">
                            {selectedCategories.map((category) => (
                              <section key={category.id}>
                                <h4 className="text-sm font-semibold text-slate-800">
                                  {topicLabel(category.name)}
                                </h4>
                                <div className="mt-2 grid gap-2">
                                  {category.questionBank.map((question) => {
                                    const selected = stagedQuestions.some(
                                      (item) =>
                                        questionKey(item) ===
                                        questionKey(question),
                                    )
                                    return (
                                      <button
                                        key={
                                          question.bankCode ||
                                          question.catalogQuestionId
                                        }
                                        type="button"
                                        aria-pressed={selected}
                                        onClick={() =>
                                          toggleBankQuestion(question)
                                        }
                                        className={`rounded-lg border px-3 py-2.5 text-left text-sm font-medium leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                                          selected
                                            ? "border-blue-500 bg-blue-50 text-blue-950"
                                            : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/40"
                                        }`}
                                      >
                                        <span className="mr-2 font-bold text-blue-700">
                                          {selected ? "✓" : "+"}
                                        </span>
                                        {question.questionText}
                                      </button>
                                    )
                                  })}
                                </div>
                              </section>
                            ))}
                          </div>
                        </details>
                        <details className="h-fit rounded-xl border border-slate-200 bg-white p-4">
                          <summary className="cursor-pointer text-[15px] font-semibold text-slate-900 marker:text-emerald-600">
                            + {tr("Câu hỏi tự tạo", "Custom questions")} ({customQuestions.length})
                          </summary>
                          <div className="mt-4 space-y-3">
                            <label className="block text-xs font-semibold text-slate-600">
                              {tr("Chủ đề", "Topic")}
                              <select
                                className={`${control} mt-1`}
                                value={customDraft.categoryId}
                                onChange={(event) => setCustomDraft((current) => ({ ...current, categoryId: Number(event.target.value) }))}
                              >
                                <option value={0}>{tr("Chọn chủ đề", "Choose a topic")}</option>
                                {selectedCategories.map((category) => (
                                  <option key={category.id} value={category.id}>{topicLabel(category.name)}</option>
                                ))}
                              </select>
                            </label>
                            <label className="block text-xs font-semibold text-slate-600">
                              {tr("Dạng trả lời", "Answer type")}
                              <select
                                className={`${control} mt-1`}
                                value={customDraft.questionType}
                                onChange={(event) => setCustomDraft((current) => ({ ...current, questionType: event.target.value as SurveyQuestionType }))}
                              >
                                <option value="SINGLE_CHOICE">{tr("Chọn một", "Single choice")}</option>
                                <option value="MULTIPLE_CHOICE">{tr("Chọn nhiều", "Multiple choice")}</option>
                                <option value="RATING">{tr("Thang điểm 1–5", "Rating 1–5")}</option>
                                <option value="TEXT">{tr("Văn bản", "Free text")}</option>
                              </select>
                            </label>
                            <label className="block text-xs font-semibold text-slate-600">
                              {tr("Nội dung câu hỏi", "Question text")}
                              <textarea
                                rows={3}
                                maxLength={1000}
                                className={`${area} mt-1 min-h-20`}
                                value={customDraft.questionText}
                                onChange={(event) => setCustomDraft((current) => ({ ...current, questionText: event.target.value }))}
                              />
                            </label>
                            {(customDraft.questionType === "SINGLE_CHOICE" || customDraft.questionType === "MULTIPLE_CHOICE") && (
                              <label className="block text-xs font-semibold text-slate-600">
                                {tr("Phương án trả lời · mỗi dòng một phương án", "Answer options · one per line")}
                                <textarea
                                  rows={3}
                                  className={`${area} mt-1 min-h-20`}
                                  value={customDraft.options}
                                  onChange={(event) => setCustomDraft((current) => ({ ...current, options: event.target.value }))}
                                />
                              </label>
                            )}
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-slate-500">✓ {tr("Bắt buộc trả lời", "Required")}</span>
                              <Button type="button" size="sm" variant="secondary" onClick={addCustomQuestion}>
                                <Plus size={14} /> {tr("Thêm câu hỏi", "Add question")}
                              </Button>
                            </div>
                            {customQuestions.length > 0 && (
                              <div className="space-y-2 border-t border-slate-100 pt-3">
                                {customQuestions.map((question, index) => (
                                  <div key={`${question.questionText}-${index}`} className="flex gap-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">
                                    <span className="min-w-0 flex-1"><strong>{questionTypeLabels[question.questionType]}</strong><br />{question.questionText}</span>
                                    <button type="button" aria-label={tr("Xóa câu hỏi", "Remove question")} className="text-slate-400 hover:text-rose-600" onClick={() => setCustomQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                                      <X size={15} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </details>
                      </div>
                    )}
                  </>
                )}
                <div className="sticky -bottom-5 z-10 -mx-5 -mb-5 flex flex-col gap-3 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:col-span-2 sm:-mx-6 sm:-mb-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Sparkles size={17} className="shrink-0 text-orange-500" />
                    {tr(
                      `Đã chọn: ${draft.categoryIds.length} chủ đề · ${totalQuestionCount} câu hỏi · Gửi tới ${totalEmployees} nhân sự`,
                      `Selected: ${draft.categoryIds.length} topics · ${totalQuestionCount} questions · ${totalEmployees} recipients`,
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
                      disabled={pending || draft.categoryIds.length === 0}
                    >
                      {t(pending ? "Saving..." : "Create draft")}
                    </Button>
                    <Button
                      type="submit"
                      name="createAction"
                      value="publish"
                      disabled={pending || draft.categoryIds.length === 0}
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
        <SurveyEditorStudio
          survey={managedSurvey}
          categories={categories}
          metadata={draft}
          totalEmployees={totalEmployees}
          pending={pending}
          onMetadata={setDraft}
          onSave={(questions, publishAfterSave) => void saveStudio(questions, publishAfterSave)}
          onPreview={(questions) => setPreviewSurvey({ ...managedSurvey, ...draft, questions })}
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
      {previewSurvey && (
        <SurveyPreviewModal
          survey={previewSurvey}
          totalEmployees={totalEmployees}
          onClose={() => setPreviewSurvey(null)}
          onPublish={previewSurvey.status === "DRAFT" ? () => {
            setPublishTarget(previewSurvey)
            setPreviewSurvey(null)
          } : undefined}
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
                    onClick={() => setStatusFilter(value)}
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
                  <select
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                  >
                    <option value="NEWEST">{tr("Mới nhất", "Newest")}</option>
                    <option value="END_SOON">{tr("Hạn chót gần nhất", "Nearest deadline")}</option>
                    <option value="RESPONSE_DESC">{tr("Tỷ lệ tham gia cao nhất", "Highest response rate")}</option>
                  </select>
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
                  ? tr(`📝 Bản nháp đang soạn (${group.items.length})`, `📝 Draft staging (${group.items.length})`)
                  : group.status === "ACTIVE"
                    ? tr(`🟢 Đang diễn ra (${group.items.length} đợt khảo sát)`, `🟢 Active surveys (${group.items.length})`)
                    : tr(`📁 Đã kết thúc & Lưu trữ (${group.items.length})`, `📁 Closed & archived (${group.items.length})`)
                if (group.status === "CLOSED")
                  return (
                    <details key={`${group.status}-${statusFilter}`} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3" open={statusFilter === "CLOSED" ? true : undefined}>
                      <summary className="cursor-pointer px-1 py-1 text-sm font-semibold text-slate-700">{title}</summary>
                      <div className="mt-3 space-y-3">{group.items.map(renderSurveyCard)}</div>
                    </details>
                  )
                return (
                  <section key={group.status} className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h3>
                    {group.items.map(renderSurveyCard)}
                  </section>
                )
              }) : visibleSurveys.map((survey) => {
                const result = results[survey.id]
                const invited = surveyInvitedCount(survey, result, totalEmployees)
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
                        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`Tiến độ phản hồi ${survey.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(responseRate)}>
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
                      <ResultOverview result={result} />
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
          if (target) void publish(target.id)
        }}
      />
    </AppShell>
  )
}

function SurveyKpiCard({
  label,
  value,
  note,
  icon,
  tone,
  pulse = false,
  progress,
}: {
  label: string
  value: string
  note: string
  icon: ReactNode
  tone: "emerald" | "blue" | "orange" | "violet"
  pulse?: boolean
  progress?: number
}) {
  const progressStyle = progress == null ? null : progressTone(progress)
  const styles = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    blue: "bg-sky-50 text-sky-700 ring-sky-100",
    orange: "bg-orange-50 text-orange-700 ring-orange-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
  }
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
        </div>
        <span className={`relative grid size-10 shrink-0 place-items-center rounded-xl ring-4 ${styles[tone]}`}>
          {icon}
          {pulse && <span className="absolute right-0 top-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white before:absolute before:inset-0 before:animate-ping before:rounded-full before:bg-emerald-400" />}
        </span>
      </div>
      {progress != null && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <span className={`block h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out ${progressStyle?.fill || ""}`} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
      <p className="mt-2 text-xs font-medium text-slate-500">{note}</p>
    </article>
  )
}

function SurveyEditorStudio({
  survey,
  categories,
  metadata,
  totalEmployees,
  pending,
  onMetadata,
  onSave,
  onPreview,
  onClose,
}: {
  survey: SurveySummary & { questions: SurveyQuestion[] }
  categories: SurveyCategory[]
  metadata: Draft
  totalEmployees: number
  pending: boolean
  onMetadata: (value: Draft) => void
  onSave: (questions: SurveyQuestion[], publishAfterSave: boolean) => void
  onPreview: (questions: SurveyQuestion[]) => void
  onClose: () => void
}) {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const [questions, setQuestions] = useState<SurveyQuestion[]>(survey.questions)
  const [newQuestion, setNewQuestion] = useState<QuestionDraft>({
    ...emptyQuestion(),
    categoryId: metadata.categoryIds[0] || 0,
  })
  useDialogBehavior(true, onClose)

  const duration = useMemo(() => {
    if (!metadata.startDate || !metadata.endDate) return null
    const start = new Date(`${metadata.startDate}T00:00:00`)
    const end = new Date(`${metadata.endDate}T00:00:00`)
    const value = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
    return value > 0 ? value : null
  }, [metadata.endDate, metadata.startDate])

  const selectedIds = new Set(metadata.categoryIds)
  const updateQuestion = (id: number, changes: Partial<SurveyQuestion>) =>
    setQuestions((current) => current.map((question) => question.id === id ? { ...question, ...changes } : question))

  const optionsText = (question: SurveyQuestion) =>
    isChoiceConfig(question.answerConfig)
      ? question.answerConfig.options.map((option) => option.label).join("\n")
      : ""

  const optionConfig = (text: string): SurveyAnswerConfig => ({
    options: text.split("\n").map((value) => value.trim()).filter(Boolean).map((label, index) => ({ code: `OPTION_${index + 1}`, label })),
  })

  const changeType = (question: SurveyQuestion, questionType: SurveyQuestionType) =>
    updateQuestion(question.id, {
      questionType,
      answerConfig: questionType === "RATING"
        ? { min: 1, max: 5, labels: ratingLabels }
        : questionType === "TEXT"
          ? null
          : { options: [{ code: "OPTION_1", label: tr("Phương án 1", "Option 1") }, { code: "OPTION_2", label: tr("Phương án 2", "Option 2") }] },
    })

  const addQuestion = () => {
    if (!newQuestion.questionText.trim() || !newQuestion.categoryId) return
    const needsOptions = newQuestion.questionType === "SINGLE_CHOICE" || newQuestion.questionType === "MULTIPLE_CHOICE"
    const answerConfig = newQuestion.questionType === "RATING"
      ? { min: 1 as const, max: 5 as const, labels: ratingLabels }
      : newQuestion.questionType === "TEXT"
        ? null
        : optionConfig(newQuestion.options)
    if (needsOptions && (!isChoiceConfig(answerConfig) || answerConfig.options.length < 2)) return
    setQuestions((current) => [...current, {
      id: -(Date.now() + current.length),
      surveyId: survey.id,
      questionText: newQuestion.questionText.trim(),
      categoryId: newQuestion.categoryId,
      questionType: newQuestion.questionType,
      answerConfig,
      displayOrder: current.length + 1,
      isRequired: true,
      isSatisfactionCore: false,
    }])
    setNewQuestion({ ...emptyQuestion(), categoryId: metadata.categoryIds[0] || 0 })
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-labelledby="survey-studio-title">
      <section className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="survey-studio-title" className="text-xl font-semibold text-slate-950">{tr("Chỉnh sửa bản nháp", "Edit draft")}: {metadata.title || tr("Khảo sát chưa đặt tên", "Untitled survey")}</h2>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">📝 {tr("Bản nháp", "Draft")}</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{tr("Tùy chỉnh thông tin, thời hạn và các câu hỏi trước khi xuất bản.", "Customize details, schedule and questions before publishing.")}</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => onPreview(questions)}><Eye size={16} />{tr("Xem trước trải nghiệm nhân viên", "Preview employee experience")}</Button>
              <button type="button" aria-label={tr("Đóng", "Close")} className="grid size-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" onClick={onClose}><X size={20} /></button>
            </div>
          </div>
        </header>

        <div className="space-y-6 overflow-y-auto bg-slate-50/60 p-5 sm:p-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-950">1. {tr("Thông tin cơ bản & Thời hạn", "Details & schedule")}</h3>{duration != null && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">⏳ {tr(`Thời gian triển khai: ${duration} ngày`, `Duration: ${duration} days`)}</span>}</div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">{tr("Tiêu đề", "Title")}<input required className={control} value={metadata.title} placeholder={tr("Ví dụ: Khảo sát gắn kết quý IV", "e.g. Q4 engagement survey")} onChange={(event) => onMetadata({ ...metadata, title: event.target.value })} /></label>
              <label className="text-sm font-semibold text-slate-700">{tr("Mục đích khảo sát", "Survey purpose")}<input className={control} value={metadata.description} placeholder={tr("Mô tả ngắn mục tiêu khảo sát", "Briefly describe the survey goal")} onChange={(event) => onMetadata({ ...metadata, description: event.target.value })} /></label>
              <label className="text-sm font-semibold text-slate-700">{tr("Ngày bắt đầu", "Start date")}<input required type="date" className={control} value={metadata.startDate} onChange={(event) => onMetadata({ ...metadata, startDate: event.target.value })} /></label>
              <label className="text-sm font-semibold text-slate-700">{tr("Ngày kết thúc", "End date")}<input required type="date" min={metadata.startDate || undefined} className={control} value={metadata.endDate} onChange={(event) => onMetadata({ ...metadata, endDate: event.target.value })} /></label>
            </div>
            <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800"><Users size={16} />{tr(`Phạm vi: Toàn bộ công ty (${totalEmployees} nhân sự)`, `Audience: Entire company (${totalEmployees} employees)`)}</p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-950">2. {tr("Chủ đề khảo sát", "Survey topics")}</h3>
            <p className="mt-1 text-xs text-amber-700">{tr("Chủ đề đã được khóa theo công thức chấm điểm của bản nháp. Backend hiện chưa hỗ trợ đổi chủ đề sau khi tạo.", "Topics are locked by the draft scoring setup. The backend does not support changing topics after creation.")}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => {
                const selected = selectedIds.has(category.id)
                const count = questions.filter((question) => question.categoryId === category.id).length
                return <div key={category.id} className={`flex items-center gap-3 rounded-xl border p-3 ${selected ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-slate-50 opacity-55"}`}><span className="text-xl">{topicIcon(category.name)}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-900">{topicLabel(category.name)}</strong><span className="text-xs text-slate-500">{selected ? tr(`${count} câu hỏi`, `${count} questions`) : tr("Chưa chọn", "Not selected")}</span></span>{selected && <CheckCircle2 size={17} className="text-orange-600" />}</div>
              })}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-950">3. {tr("Quản lý câu hỏi", "Question management")}</h3>
            <div className="mt-4 space-y-3">
              {questions.map((question, index) => {
                const locked = question.isSatisfactionCore
                const choice = question.questionType === "SINGLE_CHOICE" || question.questionType === "MULTIPLE_CHOICE"
                return <article key={question.id} className={`rounded-xl border p-4 ${locked ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 bg-white"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="text-xs font-bold uppercase tracking-wide text-slate-400">{tr("Câu", "Question")} {String(index + 1).padStart(2, "0")}</span><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${locked ? "bg-emerald-100 text-emerald-800" : "bg-blue-50 text-blue-700"}`}>{locked ? tr("Câu hỏi chuẩn · Điểm 1–5", "Standard · Rating 1–5") : tr("Câu hỏi tùy chỉnh", "Custom question")}</span></div>{!locked && <button type="button" aria-label={tr("Xóa câu hỏi", "Delete question")} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => setQuestions((current) => current.filter((item) => item.id !== question.id))}><Trash2 size={17} /></button>}</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_180px]">
                    <textarea rows={2} disabled={locked} className={`${area} mt-0 min-h-16 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-600`} value={question.questionText} onChange={(event) => updateQuestion(question.id, { questionText: event.target.value })} />
                    <select disabled={locked} className={`${control} mt-0 disabled:cursor-not-allowed disabled:bg-slate-50`} value={question.questionType} onChange={(event) => changeType(question, event.target.value as SurveyQuestionType)}><option value="SINGLE_CHOICE">{tr("Một lựa chọn", "Single choice")}</option><option value="MULTIPLE_CHOICE">{tr("Nhiều lựa chọn", "Multiple choice")}</option><option value="RATING">{tr("Thang điểm 1–5", "Rating 1–5")}</option><option value="TEXT">{tr("Tự luận", "Free text")}</option></select>
                  </div>
                  {choice && !locked && <label className="mt-3 block text-xs font-semibold text-slate-600">{tr("Đáp án · mỗi dòng một lựa chọn", "Options · one per line")}<textarea rows={3} className={`${area} mt-1 min-h-20`} value={optionsText(question)} onChange={(event) => updateQuestion(question.id, { answerConfig: optionConfig(event.target.value) })} /></label>}
                  {locked && <p className="mt-2 text-xs text-emerald-700">🔒 {tr("Câu hỏi chuẩn được backend bảo vệ để giữ công thức tính điểm nhất quán.", "Standard questions are backend-protected to preserve consistent scoring.")}</p>}
                </article>
              })}
            </div>

            <div className="mt-5 rounded-xl border border-dashed border-orange-300 bg-orange-50/30 p-4">
              <h4 className="font-semibold text-slate-900">+ {tr("Thêm câu hỏi tùy chỉnh", "Add custom question")}</h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-600 sm:col-span-2">{tr("Nội dung câu hỏi", "Question text")}<textarea rows={2} className={`${area} mt-1 min-h-16`} value={newQuestion.questionText} onChange={(event) => setNewQuestion((current) => ({ ...current, questionText: event.target.value }))} /></label>
                <label className="text-xs font-semibold text-slate-600">{tr("Chủ đề", "Topic")}<select className={`${control} mt-1`} value={newQuestion.categoryId} onChange={(event) => setNewQuestion((current) => ({ ...current, categoryId: Number(event.target.value) }))}>{categories.filter((category) => selectedIds.has(category.id)).map((category) => <option key={category.id} value={category.id}>{topicLabel(category.name)}</option>)}</select></label>
                <label className="text-xs font-semibold text-slate-600">{tr("Loại trả lời", "Answer type")}<select className={`${control} mt-1`} value={newQuestion.questionType} onChange={(event) => setNewQuestion((current) => ({ ...current, questionType: event.target.value as SurveyQuestionType }))}><option value="SINGLE_CHOICE">🔘 {tr("Một lựa chọn", "Single choice")}</option><option value="MULTIPLE_CHOICE">☑️ {tr("Nhiều lựa chọn", "Multiple choice")}</option><option value="RATING">⭐ {tr("Thang điểm 1–5", "Rating 1–5")}</option><option value="TEXT">✍️ {tr("Tự luận", "Free text")}</option></select></label>
                {(newQuestion.questionType === "SINGLE_CHOICE" || newQuestion.questionType === "MULTIPLE_CHOICE") && <label className="text-xs font-semibold text-slate-600 sm:col-span-2">{tr("Các lựa chọn · mỗi dòng một đáp án", "Options · one per line")}<textarea rows={3} className={`${area} mt-1 min-h-20`} value={newQuestion.options} onChange={(event) => setNewQuestion((current) => ({ ...current, options: event.target.value }))} /></label>}
              </div>
              <Button type="button" className="mt-3" variant="secondary" onClick={addQuestion}><Plus size={15} />{tr("Thêm vào danh sách câu hỏi", "Add to question list")}</Button>
            </div>
          </section>
        </div>

        <footer className="flex flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm font-medium text-slate-600">{tr(`Đang có: ${metadata.categoryIds.length} chủ đề · ${questions.length} câu hỏi · Tiếp cận ${totalEmployees} nhân sự`, `${metadata.categoryIds.length} topics · ${questions.length} questions · ${totalEmployees} recipients`)}</p>
          <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>{tr("Hủy / Đóng", "Cancel / Close")}</Button><Button type="button" variant="secondary" disabled={pending || !metadata.title.trim() || !duration} onClick={() => onSave(questions, false)}>💾 {tr("Lưu thay đổi bản nháp", "Save draft changes")}</Button><Button type="button" disabled={pending || !metadata.title.trim() || !duration} onClick={() => onSave(questions, true)}>🚀 {tr("Lưu & Xuất bản ngay", "Save & publish")}</Button></div>
        </footer>
      </section>
    </div>
  )
}

function SurveyPreviewModal({
  survey,
  totalEmployees,
  onClose,
  onPublish,
}: {
  survey: SurveySummary & { questions: SurveyQuestion[] }
  totalEmployees: number
  onClose: () => void
  onPublish?: () => void
}) {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  useDialogBehavior(true, onClose)

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-labelledby="survey-preview-title">
      <section className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">{tr("Góc nhìn nhân viên", "Employee preview")}</p>
            <h2 id="survey-preview-title" className="mt-1 text-xl font-semibold text-slate-950">{survey.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{survey.description || tr("Không có mô tả.", "No description.")}</p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"><Users size={14} />{tr(`Toàn bộ công ty · ${totalEmployees} nhân sự`, `Entire company · ${totalEmployees} employees`)}</p>
          </div>
          <button type="button" aria-label={tr("Đóng", "Close")} className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" onClick={onClose}><X size={19} /></button>
        </header>
        <div className="space-y-4 overflow-y-auto bg-slate-50/70 p-5 sm:p-6">
          {survey.questions.map((question, index) => (
            <article key={question.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-orange-50 text-xs font-bold text-orange-700">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium leading-6 text-slate-900">{question.questionText}</p>
                    {question.isRequired && <span className="text-rose-500">*</span>}
                  </div>
                  {question.questionType === "RATING" && (
                    <div className="mt-3 grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map((value) => <span key={value} className="grid h-9 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">{value}</span>)}</div>
                  )}
                  {isChoiceConfig(question.answerConfig) && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">{question.answerConfig.options.map((option) => <span key={option.code} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"><span className={`size-3 border border-slate-300 ${question.questionType === "SINGLE_CHOICE" ? "rounded-full" : "rounded"}`} />{option.label}</span>)}</div>
                  )}
                  {question.questionType === "TEXT" && <div className="mt-3 h-20 rounded-lg border border-dashed border-slate-300 bg-slate-50" />}
                </div>
              </div>
            </article>
          ))}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
          <p className="text-xs font-medium text-slate-500">{survey.questions.length} {tr("câu hỏi · Đây là bản xem trước, không ghi nhận câu trả lời.", "questions · Preview only; responses are not recorded.")}</p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>{tr("Quay lại chỉnh sửa", "Back to editing")}</Button>
            {onPublish && <Button type="button" onClick={onPublish}><Send size={15} />{tr("Tiếp tục xuất bản", "Continue to publish")}</Button>}
          </div>
        </footer>
      </section>
    </div>
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
              <select
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
              </select>
            </label>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Loại câu hỏi
              <select
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
              </select>
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
                        <span className="block text-base">{score}</span>
                        <span className="mt-1 block text-xs font-medium">
                          {label}
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

function ResultOverview({ result }: { result: SurveyResults }) {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const invitedCount = result.invitedCount
  const submittedCount = result.responseCount
  const pendingCount = Math.max(0, invitedCount - submittedCount)
  const completionRate =
    result.completionRate ??
    (invitedCount > 0
      ? Math.round((submittedCount / invitedCount) * 1_000) / 10
      : 0)
  const tone = progressTone(completionRate)

  return (
    <div className="border-t border-slate-200 bg-slate-50/70 p-5 sm:p-6">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {tr("Tiến độ tham gia", "Participation progress")}
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <strong className="text-3xl font-bold tracking-tight text-slate-950">
              {submittedCount} / {invitedCount}
            </strong>
            <span className="text-sm font-medium text-slate-500">
              {tr("nhân sự đã phản hồi", "employees responded")}
            </span>
          </div>
          <p className={`mt-2 text-sm font-semibold ${tone.text}`}>
            {language === "vi" ? tone.hintVi : tone.hintEn}
          </p>
        </div>
        <div className="min-w-0 flex-1 lg:max-w-xl">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-slate-500">
              {pendingCount} {tr("nhân sự chưa phản hồi", "responses pending")}
            </span>
            <strong className={`text-lg tabular-nums ${tone.text}`}>
              {completionRate.toFixed(1)}%
            </strong>
          </div>
          <div
            className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(completionRate)}
          >
            <span
              className={`block h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out ${tone.fill}`}
              style={{ width: `${Math.min(100, Math.max(0, completionRate))}%` }}
            />
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          [tr("Được mời", "Invited"), invitedCount, "text-slate-950"],
          [tr("Đã phản hồi", "Submitted"), submittedCount, "text-emerald-600"],
          [tr("Đang chờ", "Pending"), pendingCount, "text-amber-600"],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
            <strong className={`mt-1 block text-2xl ${color}`}>{value}</strong>
          </div>
        ))}
      </div>
      <h4 className="mt-5 font-semibold text-slate-950">
        {tr("Điểm gắn kết theo chủ đề", "Engagement score by topic")}
      </h4>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {result.categoryScores.map((category) => (
          <div
            key={category.categoryId}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {topicLabel(category.name)}
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
