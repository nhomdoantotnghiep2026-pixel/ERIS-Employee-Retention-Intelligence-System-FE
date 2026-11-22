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

import { CompactOptionInputs } from "../features/surveys/CompactOptionInputs"

import { SurveyKpiCard } from "../features/surveys/SurveyKpiCard"

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
  surveyInvitedCount,
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

export default function ErdSurveys() {
  const { t, language } = useLanguage()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)

  const { user } = useRole()

  const isHr = user.role === "HR"

  const [surveys, setSurveys] = useState<SurveySummary[]>([])

  const [categories, setCategories] = useState<SurveyCategory[]>([])

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

    void Promise.all([
      listEmployeeProfiles({ page: 1, limit: 10_000 }, controller.signal),
      listDepartments(controller.signal, { page: 1, limit: 1_000 }),
    ])
      .then(([employeesResult, departmentsResult]) => {
        if (controller.signal.aborted) return
        setEmployeeDirectory(
          employeesResult.data.filter(
            (employee) => employee.employmentStatus !== "INACTIVE",
          ),
        )
        setDepartments(departmentsResult.data)
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
      if (isHr && survey.status === "DRAFT" && !managedSurvey) {
        setManagedSurvey(detail.data)
        setDraft({
          title: survey.title,
          description: survey.description || "",
          startDate: employeeDate(survey.startDate),
          endDate: employeeDate(survey.endDate),
          categoryIds: [...new Set(detail.data.questions.map((question) => question.categoryId))],
        })
      }
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
    const mergedCustomQuestions = [...customQuestions]
    if (customDraft.questionText.trim()) {
      const needsOptions =
        customDraft.questionType === "SINGLE_CHOICE" ||
        customDraft.questionType === "MULTIPLE_CHOICE"
      const optionCount = customDraft.options
        .split("\n")
        .map((option) => option.trim())
        .filter(Boolean).length
      if (!customDraft.categoryId || (needsOptions && optionCount < 2)) {
        setError(
          tr(
            "Câu hỏi đang nhập chưa đủ chủ đề hoặc ít nhất 2 phương án trả lời.",
            "The pending question needs a topic and at least two answer options.",
          ),
        )
        return
      }
      mergedCustomQuestions.push(questionInput(customDraft))
    }

    setPending(true)
    setError("")
    setMessage("")

    try {
      const created = await createSurvey({
        title: draft.title.trim(),
        description: draft.description.trim() || null,

        categoryIds: draft.categoryIds,
        questions: [...stagedQuestions, ...mergedCustomQuestions],
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
                  <Button size="sm" variant="secondary" onClick={() => void loadSurveyContent(survey)}><Pencil size={15} />{tr("Chỉnh sửa", "Edit")}</Button>
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
                      <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
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
                                {category.defaultQuestions.length} {tr("câu", "items")}
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
                    {draft.categoryIds.length > 0 && (
                      <SurveyQuestionWizard
                        categories={selectedCategories}
                        stagedQuestions={stagedQuestions}
                        customQuestions={customQuestions}
                        customDraft={customDraft}
                        onToggleBank={toggleBankQuestion}
                        onCustomDraft={setCustomDraft}
                        onAddCustom={addCustomQuestion}
                        onRemoveCustom={(index) =>
                          setCustomQuestions((current) =>
                            current.filter((_, itemIndex) => itemIndex !== index),
                          )
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
                          setCustomQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))
                        }}
                      />
                    )}
                    {false && draft.categoryIds.length > 0 && (
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
                                    {topicLabel(category.name, language)}:
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
                                  {topicLabel(category.name, language)}
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
                                  <option key={category.id} value={category.id}>{topicLabel(category.name, language)}</option>
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

      {managedSurvey && !previewSurvey && !publishTarget && (
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
          categories={categories}
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
                const opened = openGroups[group.status]
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
                      <ResultOverview
                        result={result}
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

function SurveyQuestionWizard({
  categories,
  stagedQuestions,
  customQuestions,
  customDraft,
  onToggleBank,
  onCustomDraft,
  onAddCustom,
  onRemoveCustom,
  onEditCustom,
}: {
  categories: SurveyCategory[]
  stagedQuestions: SurveyQuestionInput[]
  customQuestions: SurveyQuestionInput[]
  customDraft: QuestionDraft
  onToggleBank: (question: SurveyQuestionInput) => void
  onCustomDraft: (value: QuestionDraft) => void
  onAddCustom: () => void
  onRemoveCustom: (index: number) => void
  onEditCustom: (index: number) => void
}) {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const defaultQuestions = categories.flatMap((category) =>
    category.defaultQuestions.map((question) => ({ category, question })),
  )
  const steps = [
    tr(`1. Câu hỏi mặc định (${defaultQuestions.length})`, `1. Standard questions (${defaultQuestions.length})`),
    tr(`2. Ngân hàng bổ sung (${stagedQuestions.length})`, `2. Question bank (${stagedQuestions.length})`),
    tr(`3. Câu hỏi tự tạo (${customQuestions.length})`, `3. Custom questions (${customQuestions.length})`),
  ]
  const choice = customDraft.questionType === "SINGLE_CHOICE" || customDraft.questionType === "MULTIPLE_CHOICE"

  return (
    <section className="sm:col-span-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="grid border-b border-slate-200 sm:grid-cols-3">
        {steps.map((label, index) => (
          <button key={label} type="button" onClick={() => setStep(index as 0 | 1 | 2)} className={`min-h-12 border-b-2 px-3 py-2 text-sm font-semibold transition ${step === index ? "border-orange-500 bg-orange-50 text-orange-800" : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}>{label}</button>
        ))}
      </div>
      <div className="min-h-[380px] max-h-[50vh] overflow-y-auto rounded-b-xl border border-t-0 border-slate-200 bg-slate-50/50 p-4">
        {step === 0 && (
          <div className="space-y-2">
            {defaultQuestions.map(({ category, question }, index) => <article key={question.templateCode || question.catalogQuestionId} className="flex gap-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-emerald-700">{index + 1}</span><div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">{topicLabel(category.name, language)}</span><span className="text-[11px] font-semibold text-slate-400">{tr("Thang điểm 1–5", "Rating 1–5")}</span></div><p className="mt-1.5 text-sm text-slate-700">{question.questionText}</p></div></article>)}
          </div>
        )}
        {step === 1 && (
          <div className="space-y-3">
            {categories.map((category) => <details key={category.id} className="rounded-lg border border-slate-200" open><summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-slate-800">{topicIcon(category.name)} {topicLabel(category.name, language)} · {category.questionBank.length}</summary><div className="space-y-2 border-t border-slate-100 p-3">{category.questionBank.map((question) => { const selected = stagedQuestions.some((item) => item.categoryId === question.categoryId && item.questionText === question.questionText); return <button key={question.bankCode || question.catalogQuestionId} type="button" aria-pressed={selected} onClick={() => onToggleBank(question)} className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2.5 text-left text-sm ${selected ? "border-blue-400 bg-blue-50 text-blue-900" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}><span className="font-bold">{selected ? "✓" : "+"}</span><span>{question.questionText}</span></button> })}{category.questionBank.length === 0 && <p className="text-xs text-slate-500">{tr("Chưa có câu hỏi bổ sung.", "No optional questions.")}</p>}</div></details>)}
          </div>
        )}
        {step === 2 && (
          <div className="grid gap-4 lg:grid-cols-[1fr_.9fr]">
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-600">{tr("Chủ đề", "Topic")}<select className={`${control} mt-1`} value={customDraft.categoryId} onChange={(event) => onCustomDraft({ ...customDraft, categoryId: Number(event.target.value) })}><option value={0}>{tr("Chọn chủ đề", "Choose topic")}</option>{categories.map((category) => <option key={category.id} value={category.id}>{topicLabel(category.name, language)}</option>)}</select></label>
              <label className="block text-xs font-semibold text-slate-600">{tr("Nội dung câu hỏi", "Question text")}<textarea rows={2} className={`${area} mt-1 min-h-16`} value={customDraft.questionText} onChange={(event) => onCustomDraft({ ...customDraft, questionText: event.target.value })} /></label>
              <label className="block text-xs font-semibold text-slate-600">{tr("Loại trả lời", "Answer type")}<select className={`${control} mt-1`} value={customDraft.questionType} onChange={(event) => onCustomDraft({ ...customDraft, questionType: event.target.value as SurveyQuestionType })}><option value="SINGLE_CHOICE">🔘 {tr("Một lựa chọn", "Single choice")}</option><option value="MULTIPLE_CHOICE">☑️ {tr("Nhiều lựa chọn", "Multiple choice")}</option><option value="RATING">⭐ {tr("Thang điểm 1–5", "Rating 1–5")}</option><option value="TEXT">✍️ {tr("Tự luận", "Free text")}</option></select></label>
              {choice && <CompactOptionInputs value={customDraft.options} onChange={(options) => onCustomDraft({ ...customDraft, options })} />}
              <Button type="button" size="sm" onClick={onAddCustom}><Plus size={14} />{tr("Thêm vào khảo sát", "Add to survey")}</Button>
            </div>
            <div className="space-y-2 border-t border-slate-100 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
              <h4 className="text-sm font-semibold text-slate-800">{tr("Câu hỏi đã thêm", "Added questions")}</h4>
              {customQuestions.map((question, index) => <article key={`${question.questionText}-${index}`} className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold text-blue-700">{questionTypeLabels[question.questionType]}</p><p className="mt-1 text-sm text-slate-700">{question.questionText}</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => onEditCustom(index)} className="text-xs font-semibold text-blue-700 hover:underline">{tr("Sửa", "Edit")}</button><button type="button" onClick={() => onRemoveCustom(index)} className="text-xs font-semibold text-rose-600 hover:underline">{tr("Xóa", "Delete")}</button></div></article>)}
              {customQuestions.length === 0 && <p className="text-xs text-slate-500">{tr("Chưa có câu hỏi tự tạo.", "No custom questions yet.")}</p>}
            </div>
          </div>
        )}
      </div>
      <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3"><Button type="button" size="sm" variant="secondary" disabled={step === 0} onClick={() => setStep((step - 1) as 0 | 1 | 2)}>← {tr("Quay lại", "Back")}</Button><span className="text-xs font-medium text-slate-400">{step + 1}/3</span><Button type="button" size="sm" variant="secondary" disabled={step === 2} onClick={() => setStep((step + 1) as 0 | 1 | 2)}>{tr("Tiếp tục", "Continue")} →</Button></footer>
    </section>
  )
}

function SurveyDraftQuestionWizard({
  questions,
  categories,
  newQuestion,
  onNewQuestion,
  onAdd,
  onUpdate,
  onChangeType,
  onDelete,
  onOptionsChange,
  onQuestionsChange,
}: {
  questions: SurveyQuestion[]
  categories: SurveyCategory[]
  newQuestion: QuestionDraft
  onNewQuestion: (value: QuestionDraft) => void
  onAdd: () => void
  onUpdate: (id: number, changes: Partial<SurveyQuestion>) => void
  onChangeType: (question: SurveyQuestion, type: SurveyQuestionType) => void
  onDelete: (id: number) => void
  onOptionsChange: (id: number, options: string) => void
  onQuestionsChange: (questions: SurveyQuestion[]) => void
}) {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const bankKey = (categoryId: number, questionText: string) =>
    `${categoryId}|${questionText.trim().toLocaleLowerCase()}`
  const bankKeys = new Set(
    categories.flatMap((category) =>
      category.questionBank.map((question) => bankKey(category.id, question.questionText)),
    ),
  )
  const standard = questions.filter((question) => question.isSatisfactionCore)
  const selectedBankQuestions = questions.filter(
    (question) => !question.isSatisfactionCore && bankKeys.has(bankKey(question.categoryId, question.questionText)),
  )
  const customQuestions = questions.filter(
    (question) => !question.isSatisfactionCore && !bankKeys.has(bankKey(question.categoryId, question.questionText)),
  )
  const choiceDraft = newQuestion.questionType === "SINGLE_CHOICE" || newQuestion.questionType === "MULTIPLE_CHOICE"
  const labelFor = (categoryId: number) => topicLabel(categories.find((category) => category.id === categoryId)?.name || `#${categoryId}`, language)
  const optionsFor = (question: SurveyQuestion) => isChoiceConfig(question.answerConfig) ? question.answerConfig.options.map((option) => option.label).join("\n") : ""
  const tabs = [
    tr(`1. Câu hỏi mặc định (${standard.length})`, `1. Standard (${standard.length})`),
    tr(`2. Ngân hàng bổ sung (${selectedBankQuestions.length})`, `2. Question bank (${selectedBankQuestions.length})`),
    tr(`3. Câu hỏi tự tạo (${customQuestions.length})`, `3. Custom (${customQuestions.length})`),
  ]

  const isBankSelected = (categoryId: number, questionText: string) =>
    selectedBankQuestions.some(
      (question) => bankKey(question.categoryId, question.questionText) === bankKey(categoryId, questionText),
    )

  const addBankQuestion = (categoryId: number, question: SurveyQuestionInput) => {
    const id = -Date.now()
    onQuestionsChange([
      ...questions,
      {
        id,
        categoryId,
        questionText: question.questionText,
        questionType: question.questionType,
        answerConfig: question.answerConfig,
        displayOrder: questions.length + 1,
        isRequired: true,
        isSatisfactionCore: false,
      },
    ])
  }

  const toggleBankQuestion = (categoryId: number, question: SurveyQuestionInput) => {
    const key = bankKey(categoryId, question.questionText)
    const selected = selectedBankQuestions.find(
      (item) => bankKey(item.categoryId, item.questionText) === key,
    )
    if (selected) {
      onQuestionsChange(questions.filter((item) => item.id !== selected.id))
      return
    }
    addBankQuestion(categoryId, question)
  }

  const selectAllBankQuestions = (category: SurveyCategory) => {
    const missing = category.questionBank.filter(
      (question) => !isBankSelected(category.id, question.questionText),
    )
    if (missing.length === 0) return
    const base = Date.now()
    onQuestionsChange([
      ...questions,
      ...missing.map((question, index) => ({
        id: -(base + question.catalogQuestionId + index),
        categoryId: category.id,
        questionText: question.questionText,
        questionType: question.questionType,
        answerConfig: question.answerConfig,
        displayOrder: questions.length + index + 1,
        isRequired: true,
        isSatisfactionCore: false,
      })),
    ])
  }

  const clearBankQuestions = (category: SurveyCategory) => {
    const categoryBankKeys = new Set(
      category.questionBank.map((question) => bankKey(category.id, question.questionText)),
    )
    onQuestionsChange(
      questions.filter(
        (question) => !categoryBankKeys.has(bankKey(question.categoryId, question.questionText)),
      ),
    )
  }

  const editableCard = (question: SurveyQuestion, index: number) => {
    const choice = question.questionType === "SINGLE_CHOICE" || question.questionType === "MULTIPLE_CHOICE"
    return <article key={question.id} className="rounded-lg border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-400">{tr("Câu", "Question")} {index + 1} · {labelFor(question.categoryId)}</span><button type="button" onClick={() => onDelete(question.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button></div><div className="mt-2 grid gap-2 sm:grid-cols-[1fr_170px]"><input className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-orange-400" value={question.questionText} onChange={(event) => onUpdate(question.id, { questionText: event.target.value })} /><select className="h-10 rounded-lg border border-slate-300 px-2 text-sm" value={question.questionType} onChange={(event) => onChangeType(question, event.target.value as SurveyQuestionType)}><option value="SINGLE_CHOICE">{tr("Một lựa chọn", "Single choice")}</option><option value="MULTIPLE_CHOICE">{tr("Nhiều lựa chọn", "Multiple choice")}</option><option value="RATING">{tr("Điểm 1–5", "Rating 1–5")}</option><option value="TEXT">{tr("Tự luận", "Free text")}</option></select></div>{choice && <div className="mt-3"><CompactOptionInputs value={optionsFor(question)} onChange={(options) => onOptionsChange(question.id, options)} /></div>}</article>
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
      <div className="grid border-b border-slate-200 sm:grid-cols-3">{tabs.map((tab, index) => <button key={tab} type="button" onClick={() => setStep(index as 0 | 1 | 2)} className={`min-h-12 border-b-2 px-3 text-sm font-semibold ${step === index ? "border-orange-500 bg-orange-50 text-orange-800" : "border-transparent text-slate-500 hover:bg-slate-50"}`}>{tab}</button>)}</div>
      <div className="min-h-[380px] max-h-[50vh] overflow-y-auto rounded-b-xl border border-t-0 border-slate-200 bg-slate-50/50 p-4">
        {step === 0 && <div className="space-y-3">{categories.map((category, categoryIndex) => { const categoryQuestions = standard.filter((question) => question.categoryId === category.id); if (categoryQuestions.length === 0) return null; return <details key={category.id} open={categoryIndex === 0} className="overflow-hidden rounded-xl border border-slate-200 bg-white"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-900"><span>{topicIcon(category.name)} {topicLabel(category.name, language)}</span><span className="text-xs font-medium text-slate-500">{categoryQuestions.length} {tr("câu chuẩn", "core")}</span></summary><div className="space-y-2 border-t border-slate-100 p-3">{categoryQuestions.map((question, index) => <article key={question.id} className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 shadow-sm"><span className="grid size-7 shrink-0 place-items-center rounded-md bg-white text-xs font-bold text-slate-500">{String(index + 1).padStart(2, "0")}</span><p className="min-w-0 flex-1 text-sm leading-relaxed text-slate-800">{question.questionText}</p><span title={tr("Câu hỏi chuẩn tính điểm", "Core scoring question")} className="shrink-0 text-slate-400">🔒</span><span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">1–5</span></article>)}</div></details> })}</div>}
        {step === 1 && <div className="space-y-3">{categories.map((category, categoryIndex) => { const selectedCount = category.questionBank.filter((question) => isBankSelected(category.id, question.questionText)).length; return <details key={category.id} open={categoryIndex === 0} className="overflow-hidden rounded-xl border border-slate-200 bg-white"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-900"><span>{topicIcon(category.name)} {topicLabel(category.name, language)}</span><span className="text-xs font-medium text-slate-500">{selectedCount}/{category.questionBank.length} {tr("đã chọn", "selected")}</span></summary><div className="border-t border-slate-100 p-3"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-slate-600">+ {tr("Thêm/bớt câu hỏi bổ sung từ ngân hàng", "Add/remove bank questions")}</p><div className="flex gap-2"><button type="button" onClick={() => selectAllBankQuestions(category)} className="text-xs font-semibold text-blue-700 hover:underline">{tr("Chọn tất cả", "Select all")}</button><span className="text-slate-300">/</span><button type="button" onClick={() => clearBankQuestions(category)} className="text-xs font-semibold text-slate-600 hover:underline">{tr("Bỏ chọn", "Clear")}</button></div></div><div className="space-y-2">{category.questionBank.map((question) => { const selected = isBankSelected(category.id, question.questionText); return <label key={question.bankCode || question.catalogQuestionId} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm leading-relaxed transition ${selected ? "border-orange-300 bg-orange-50/70 text-slate-900" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}><input type="checkbox" checked={selected} onChange={() => toggleBankQuestion(category.id, question)} className="mt-0.5 size-4 accent-orange-600" /><span>{question.questionText}</span></label>})}{category.questionBank.length === 0 && <p className="py-4 text-center text-xs text-slate-500">{tr("Chưa có câu hỏi bổ sung trong chủ đề này.", "No bank questions in this topic.")}</p>}</div></div></details> })}</div>}
        {step === 2 && <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]"><div className="space-y-3"><label className="block text-xs font-semibold text-slate-600">{tr("Chủ đề", "Topic")}<select className={`${control} mt-1`} value={newQuestion.categoryId} onChange={(event) => onNewQuestion({ ...newQuestion, categoryId: Number(event.target.value) })}>{categories.map((category) => <option key={category.id} value={category.id}>{topicLabel(category.name, language)}</option>)}</select></label><label className="block text-xs font-semibold text-slate-600">{tr("Nội dung câu hỏi", "Question text")}<textarea rows={2} className={`${area} mt-1 min-h-[70px]`} value={newQuestion.questionText} onChange={(event) => onNewQuestion({ ...newQuestion, questionText: event.target.value })} /></label><label className="block text-xs font-semibold text-slate-600">{tr("Dạng trả lời", "Answer type")}<select className={`${control} mt-1`} value={newQuestion.questionType} onChange={(event) => onNewQuestion({ ...newQuestion, questionType: event.target.value as SurveyQuestionType })}><option value="RATING">⭐ {tr("Thang điểm 1–5 (Đánh giá mức độ hài lòng)", "Rating 1–5")}</option><option value="SINGLE_CHOICE">🔘 {tr("Chọn một đáp án (Single Choice)", "Single choice")}</option><option value="MULTIPLE_CHOICE">☑️ {tr("Chọn nhiều đáp án (Multiple Choice)", "Multiple choice")}</option><option value="TEXT">📝 {tr("Điền văn bản (Text/Tự luận)", "Text response")}</option></select></label>{choiceDraft && <CompactOptionInputs value={newQuestion.options} onChange={(options) => onNewQuestion({ ...newQuestion, options })} />}<Button type="button" size="sm" onClick={onAdd}><Plus size={14} />{tr("Thêm vào danh sách câu hỏi", "Add question")}</Button></div><div className="space-y-2 border-t border-slate-100 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0"><h4 className="text-sm font-semibold text-slate-800">{tr(`Câu hỏi tự tạo (${customQuestions.length})`, `Custom questions (${customQuestions.length})`)}</h4>{customQuestions.map(editableCard)}{customQuestions.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500">{tr("Chưa có câu hỏi tự tạo.", "No custom questions.")}</p>}</div></div>}
      </div>
      <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3"><Button type="button" size="sm" variant="secondary" disabled={step === 0} onClick={() => setStep((step - 1) as 0 | 1 | 2)}>← {tr("Quay lại", "Back")}</Button><span className="text-xs text-slate-400">{step + 1}/3</span><Button type="button" size="sm" variant="secondary" disabled={step === 2} onClick={() => setStep((step + 1) as 0 | 1 | 2)}>{tr("Tiếp tục", "Continue")} →</Button></footer>
    </div>
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
  const [studioError, setStudioError] = useState("")
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
    setStudioError("")
  }

  const submitStudio = (publishAfterSave: boolean) => {
    let merged = questions
    if (newQuestion.questionText.trim()) {
      const needsOptions = newQuestion.questionType === "SINGLE_CHOICE" || newQuestion.questionType === "MULTIPLE_CHOICE"
      const answerConfig = newQuestion.questionType === "RATING"
        ? { min: 1 as const, max: 5 as const, labels: ratingLabels }
        : newQuestion.questionType === "TEXT"
          ? null
          : optionConfig(newQuestion.options)
      if (!newQuestion.categoryId || (needsOptions && (!isChoiceConfig(answerConfig) || answerConfig.options.length < 2))) {
        setStudioError(tr("Câu hỏi đang nhập cần chủ đề và ít nhất 2 phương án.", "The pending question needs a topic and at least two options."))
        return
      }
      merged = [...questions, {
        id: -(Date.now() + questions.length),
        surveyId: survey.id,
        questionText: newQuestion.questionText.trim(),
        categoryId: newQuestion.categoryId,
        questionType: newQuestion.questionType,
        answerConfig,
        displayOrder: questions.length + 1,
        isRequired: true,
        isSatisfactionCore: false,
      }]
      setQuestions(merged)
      setNewQuestion({ ...emptyQuestion(), categoryId: metadata.categoryIds[0] || 0 })
    }
    setStudioError("")
    onSave(merged, publishAfterSave)
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
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {categories.map((category) => {
                const selected = selectedIds.has(category.id)
                const count = questions.filter((question) => question.categoryId === category.id).length
                return <div key={category.id} className={`flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 ${selected ? "border-orange-500 bg-orange-50/50 text-orange-950 shadow-sm" : "border-slate-200 bg-white text-slate-500 opacity-60"}`}><span className="shrink-0 text-base">{topicIcon(category.name)}</span><strong className="min-w-0 flex-1 text-xs font-medium leading-tight">{topicLabel(category.name, language)}</strong><span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${selected ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-500"}`}>{selected ? `${count} ${tr("câu", "items")}` : "—"}</span>{selected && <CheckCircle2 size={14} className="shrink-0 text-orange-600" />}</div>
              })}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-950">3. {tr("Quản lý câu hỏi", "Question management")}</h3>
            <SurveyDraftQuestionWizard
              questions={questions}
              categories={categories.filter((category) => selectedIds.has(category.id))}
              newQuestion={newQuestion}
              onNewQuestion={setNewQuestion}
              onAdd={addQuestion}
              onUpdate={updateQuestion}
              onChangeType={changeType}
              onDelete={(id) => setQuestions((current) => current.filter((question) => question.id !== id))}
              onOptionsChange={(id, options) => updateQuestion(id, { answerConfig: optionConfig(options) })}
              onQuestionsChange={setQuestions}
            />
            <div className="hidden mt-4 space-y-3">
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

            <div className="hidden mt-5 rounded-xl border border-dashed border-orange-300 bg-orange-50/30 p-4">
              <h4 className="font-semibold text-slate-900">+ {tr("Thêm câu hỏi tùy chỉnh", "Add custom question")}</h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-600 sm:col-span-2">{tr("Nội dung câu hỏi", "Question text")}<textarea rows={2} className={`${area} mt-1 min-h-16`} value={newQuestion.questionText} onChange={(event) => setNewQuestion((current) => ({ ...current, questionText: event.target.value }))} /></label>
                <label className="text-xs font-semibold text-slate-600">{tr("Chủ đề", "Topic")}<select className={`${control} mt-1`} value={newQuestion.categoryId} onChange={(event) => setNewQuestion((current) => ({ ...current, categoryId: Number(event.target.value) }))}>{categories.filter((category) => selectedIds.has(category.id)).map((category) => <option key={category.id} value={category.id}>{topicLabel(category.name, language)}</option>)}</select></label>
                <label className="text-xs font-semibold text-slate-600">{tr("Loại trả lời", "Answer type")}<select className={`${control} mt-1`} value={newQuestion.questionType} onChange={(event) => setNewQuestion((current) => ({ ...current, questionType: event.target.value as SurveyQuestionType }))}><option value="SINGLE_CHOICE">🔘 {tr("Một lựa chọn", "Single choice")}</option><option value="MULTIPLE_CHOICE">☑️ {tr("Nhiều lựa chọn", "Multiple choice")}</option><option value="RATING">⭐ {tr("Thang điểm 1–5", "Rating 1–5")}</option><option value="TEXT">✍️ {tr("Tự luận", "Free text")}</option></select></label>
                {(newQuestion.questionType === "SINGLE_CHOICE" || newQuestion.questionType === "MULTIPLE_CHOICE") && <label className="text-xs font-semibold text-slate-600 sm:col-span-2">{tr("Các lựa chọn · mỗi dòng một đáp án", "Options · one per line")}<textarea rows={3} className={`${area} mt-1 min-h-20`} value={newQuestion.options} onChange={(event) => setNewQuestion((current) => ({ ...current, options: event.target.value }))} /></label>}
              </div>
              <Button type="button" className="mt-3" variant="secondary" onClick={addQuestion}><Plus size={15} />{tr("Thêm vào danh sách câu hỏi", "Add to question list")}</Button>
            </div>
          </section>
        </div>

        <footer className="flex flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div><p className="text-sm font-medium text-slate-600">{tr(`Đang có: ${metadata.categoryIds.length} chủ đề · ${questions.length} câu hỏi · Tiếp cận ${totalEmployees} nhân sự`, `${metadata.categoryIds.length} topics · ${questions.length} questions · ${totalEmployees} recipients`)}</p>{studioError && <p className="mt-1 text-xs font-medium text-rose-600">{studioError}</p>}</div>
          <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>{tr("Hủy / Đóng", "Cancel / Close")}</Button><Button type="button" variant="secondary" disabled={pending || !metadata.title.trim() || !duration} onClick={() => submitStudio(false)}>💾 {tr("Lưu thay đổi bản nháp", "Save draft changes")}</Button><Button type="button" disabled={pending || !metadata.title.trim() || !duration} onClick={() => submitStudio(true)}>🚀 {tr("Lưu & Xuất bản ngay", "Save & publish")}</Button></div>
        </footer>
      </section>
    </div>
  )
}

function SurveyPreviewModal({
  survey,
  categories,
  totalEmployees,
  onClose,
  onPublish,
}: {
  survey: SurveySummary & { questions: SurveyQuestion[] }
  categories: SurveyCategory[]
  totalEmployees: number
  onClose: () => void
  onPublish?: () => void
}) {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const groupedQuestions = useMemo(() => {
    const groups = new Map<number, SurveyQuestion[]>()
    survey.questions.forEach((question) =>
      groups.set(question.categoryId, [...(groups.get(question.categoryId) || []), question]),
    )
    return [...groups.entries()].map(([categoryId, questions]) => ({
      categoryId,
      rawName: categories.find((category) => category.id === categoryId)?.name || `Chủ đề #${categoryId}`,
      name: topicLabel(categories.find((category) => category.id === categoryId)?.name || `Chủ đề #${categoryId}`, language),
      questions,
    }))
  }, [categories, language, survey.questions])
  const estimatedMinutesMin = Math.max(1, Math.ceil(survey.questions.length * 0.35))
  const estimatedMinutesMax = Math.max(estimatedMinutesMin, Math.ceil(survey.questions.length * 0.5))
  const renderQuestionText = (text: string, required: boolean) => {
    const words = text.trim().split(/\s+/)
    const lastWord = words.pop() || ""
    return <>{words.length > 0 ? `${words.join(" ")} ` : ""}<span className="whitespace-nowrap">{lastWord}{required && <span className="font-bold text-rose-500"> *</span>}</span></>
  }
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
        {survey.questions.length > 16 && (
          <nav className="flex shrink-0 gap-2 overflow-x-auto border-b border-slate-200 bg-white px-5 py-3 sm:px-6" aria-label={tr("Mục lục chủ đề", "Topic navigation")}>
            {groupedQuestions.map((group) => (
              <button key={group.categoryId} type="button" onClick={() => document.getElementById(`preview-topic-${group.categoryId}`)?.scrollIntoView({ behavior: "smooth", block: "start" })} className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-800">
                {group.name} ({group.questions.length})
              </button>
            ))}
          </nav>
        )}
        <div className="overflow-y-auto scroll-smooth bg-slate-50/70 p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/60 bg-slate-100/80 px-4 py-2.5 text-xs text-slate-600"><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1 rounded-md bg-orange-100/80 px-2 py-0.5 font-semibold text-orange-600">👁 {tr("CHẾ ĐỘ XEM TRƯỚC", "PREVIEW MODE")}</span><span>{tr("Mô phỏng giao diện khảo sát thực tế của nhân viên", "Simulation of the employee survey experience")}</span></div><div className="font-medium text-slate-700">{survey.questions.length} {tr("câu hỏi", "questions")} · {tr("Ước tính", "Estimated")} ~{estimatedMinutesMin}{estimatedMinutesMax > estimatedMinutesMin ? `–${estimatedMinutesMax}` : ""} {tr("phút hoàn thành", "min to complete")}</div></div>
          <div className="space-y-6">
          {groupedQuestions.map((group) => (
            <section key={group.categoryId} id={`preview-topic-${group.categoryId}`} className="scroll-mt-4">
              <h3 className="mb-3 flex items-center gap-2 pb-2 pt-4 text-xs font-bold uppercase tracking-wider text-slate-500"><span>{topicIcon(group.rawName)}</span><span>{group.name}</span><span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{group.questions.length} {tr("câu", "items")}</span><span className="ml-2 h-px flex-1 bg-slate-200" /></h3>
              <div className="space-y-3">
              {group.questions.map((question, index) => (
            <article key={question.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-orange-50 text-xs font-bold text-orange-700">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-6 text-slate-900">{renderQuestionText(question.questionText, question.isRequired)}</p>
                  {question.questionType === "RATING" && (
                    <div className="mt-4 max-w-sm"><div className="flex items-center gap-2">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" className="flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 shadow-sm transition-all hover:border-orange-400 hover:bg-orange-50/40 hover:text-orange-600 sm:size-12">{value}</button>)}</div><div className="mt-1.5 flex justify-between gap-4 text-[11px] leading-tight text-slate-400"><span className="max-w-24">{tr("Hoàn toàn không đồng ý", "Strongly disagree")}</span><span className="max-w-24 text-right">{tr("Hoàn toàn đồng ý", "Strongly agree")}</span></div></div>
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
            </section>
          ))}
          </div>
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

function ResultOverview({
  result,
  participants,
}: {
  result: SurveyResults
  participants: SurveyParticipant[]
}) {
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
  const departmentProgress = useMemo(() => {
    const groups = new Map<string, { invited: number; submitted: number }>()
    participants.forEach((participant) => {
      const name = participant.departmentName || tr("Chưa xác định", "Unassigned")
      const current = groups.get(name) || { invited: 0, submitted: 0 }
      current.invited += 1
      if (participant.status === "SUBMITTED") current.submitted += 1
      groups.set(name, current)
    })
    return [...groups.entries()]
      .map(([name, counts]) => ({
        name,
        ...counts,
        rate: counts.invited > 0 ? (counts.submitted / counts.invited) * 100 : 0,
      }))
      .sort((left, right) => left.rate - right.rate)
  }, [participants, language])

  return (
    <div className="border-t border-slate-200 bg-slate-50/70 p-5 sm:p-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {tr("Tiến độ tham gia", "Participation progress")}
          </p>
          <strong className={`mt-1 block text-3xl font-bold tracking-tight ${tone.text}`}>{completionRate.toFixed(1)}%</strong>
        </div>
        <div className="min-w-0 flex-1 lg:max-w-xl">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className={`font-semibold ${tone.text}`}>{language === "vi" ? tone.hintVi : tone.hintEn}</span>
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
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-100 pt-4 text-sm">
          <span className="text-slate-500">{tr("Tổng mời", "Invited")}: <strong className="text-slate-900">{invitedCount}</strong></span>
          <span className="text-slate-500">{tr("Đã nộp", "Submitted")}: <strong className="text-emerald-700">{submittedCount}</strong></span>
          <span className="text-slate-500">{tr("Chưa nộp", "Pending")}: <strong className="text-amber-700">{pendingCount}</strong></span>
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
