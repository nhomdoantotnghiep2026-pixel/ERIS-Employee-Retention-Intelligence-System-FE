import { useMemo, useState } from "react"
import { CheckCircle2, Eye, Users, X } from "lucide-react"

import { Button } from "../../components/ui"
import { useLanguage } from "../../context/LanguageContext"
import type {
  SurveyAnswerConfig,
  SurveyCategory,
  SurveyQuestion,
  SurveyQuestionType,
  SurveySummary,
} from "../../services/api"

import { SurveyDraftQuestionWizard } from "./SurveyQuestionWizards"
import { surveyControlClass } from "./surveyStyles"
import {
  createEmptySurveyQuestion,
  type SurveyDraft,
  type SurveyQuestionDraft,
} from "./surveyTypes"
import {
  isChoiceConfig,
  ratingLabels,
  topicIcon,
  topicLabel,
} from "./surveyUtils"
import { useDialogBehavior } from "./useDialogBehavior"

type SurveyDraftEditorProps = {
  survey: SurveySummary & { questions: SurveyQuestion[] }
  categories: SurveyCategory[]
  metadata: SurveyDraft
  totalEmployees: number
  pending: boolean
  onMetadata: (value: SurveyDraft) => void
  onSave: (
    questions: SurveyQuestion[],
    publishAfterSave: boolean,
  ) => void
  onPreview: (questions: SurveyQuestion[]) => void
  onClose: () => void
}

function createChoiceConfig(text: string): SurveyAnswerConfig {
  return {
    options: text
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((label, index) => ({
        code: `OPTION_${index + 1}`,
        label,
      })),
  }
}

export function SurveyDraftEditor({
  survey,
  categories,
  metadata,
  totalEmployees,
  pending,
  onMetadata,
  onSave,
  onPreview,
  onClose,
}: SurveyDraftEditorProps) {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const [questions, setQuestions] = useState<SurveyQuestion[]>(survey.questions)
  const [newQuestion, setNewQuestion] = useState<SurveyQuestionDraft>({
    ...createEmptySurveyQuestion(),
    categoryId: metadata.categoryIds[0] || 0,
  })
  const [studioError, setStudioError] = useState("")

  useDialogBehavior(true, onClose)

  const duration = useMemo(() => {
    if (!metadata.startDate || !metadata.endDate) return null

    const start = new Date(`${metadata.startDate}T00:00:00`)
    const end = new Date(`${metadata.endDate}T00:00:00`)
    const value =
      Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1

    return value > 0 ? value : null
  }, [metadata.endDate, metadata.startDate])

  const selectedIds = new Set(metadata.categoryIds)

  const updateQuestion = (
    id: number,
    changes: Partial<SurveyQuestion>,
  ) => {
    setQuestions((current) =>
      current.map((question) =>
        question.id === id ? { ...question, ...changes } : question,
      ),
    )
  }

  const changeType = (
    question: SurveyQuestion,
    questionType: SurveyQuestionType,
  ) => {
    updateQuestion(question.id, {
      questionType,
      answerConfig:
        questionType === "RATING"
          ? { min: 1, max: 5, labels: ratingLabels }
          : questionType === "TEXT"
            ? null
            : {
                options: [
                  {
                    code: "OPTION_1",
                    label: tr("Phương án 1", "Option 1"),
                  },
                  {
                    code: "OPTION_2",
                    label: tr("Phương án 2", "Option 2"),
                  },
                ],
              },
    })
  }

  const buildQuestion = (
    draft: SurveyQuestionDraft,
    order: number,
  ): SurveyQuestion | null => {
    const needsOptions =
      draft.questionType === "SINGLE_CHOICE" ||
      draft.questionType === "MULTIPLE_CHOICE"
    const answerConfig =
      draft.questionType === "RATING"
        ? ({ min: 1, max: 5, labels: ratingLabels } as const)
        : draft.questionType === "TEXT"
          ? null
          : createChoiceConfig(draft.options)

    if (
      !draft.questionText.trim() ||
      !draft.categoryId ||
      (needsOptions &&
        (!isChoiceConfig(answerConfig) || answerConfig.options.length < 2))
    ) {
      return null
    }

    return {
      id: -(Date.now() + order),
      surveyId: survey.id,
      questionText: draft.questionText.trim(),
      categoryId: draft.categoryId,
      questionType: draft.questionType,
      answerConfig,
      displayOrder: order + 1,
      isRequired: true,
      isSatisfactionCore: false,
    }
  }

  const resetNewQuestion = () => {
    setNewQuestion({
      ...createEmptySurveyQuestion(),
      categoryId: metadata.categoryIds[0] || 0,
    })
  }

  const addQuestion = () => {
    if (!newQuestion.questionText.trim()) return

    const question = buildQuestion(newQuestion, questions.length)
    if (!question) {
      setStudioError(
        tr(
          "Câu hỏi đang nhập cần chủ đề và ít nhất 2 phương án.",
          "The pending question needs a topic and at least two options.",
        ),
      )
      return
    }

    setQuestions((current) => [...current, question])
    resetNewQuestion()
    setStudioError("")
  }

  const submitStudio = (publishAfterSave: boolean) => {
    let merged = questions

    if (newQuestion.questionText.trim()) {
      const question = buildQuestion(newQuestion, questions.length)
      if (!question) {
        setStudioError(
          tr(
            "Câu hỏi đang nhập cần chủ đề và ít nhất 2 phương án.",
            "The pending question needs a topic and at least two options.",
          ),
        )
        return
      }

      merged = [...questions, question]
      setQuestions(merged)
      resetNewQuestion()
    }

    setStudioError("")
    onSave(merged, publishAfterSave)
  }

  return (
    <div
      className="fixed inset-0 z-[85] flex animate-in items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm fade-in duration-200 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="survey-studio-title"
    >
      <section className="flex max-h-[90vh] w-full max-w-5xl animate-in flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl slide-in-from-bottom-2 zoom-in-95 duration-200">
        <header className="border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="survey-studio-title"
                  className="text-xl font-semibold text-slate-950"
                >
                  {tr("Chỉnh sửa bản nháp", "Edit draft")}: {" "}
                  {metadata.title ||
                    tr("Khảo sát chưa đặt tên", "Untitled survey")}
                </h2>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                  📝 {tr("Bản nháp", "Draft")}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {tr(
                  "Tùy chỉnh thông tin, thời hạn và các câu hỏi trước khi xuất bản.",
                  "Customize details, schedule and questions before publishing.",
                )}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onPreview(questions)}
              >
                <Eye size={16} />
                {tr(
                  "Xem trước trải nghiệm nhân viên",
                  "Preview employee experience",
                )}
              </Button>
              <button
                type="button"
                aria-label={tr("Đóng", "Close")}
                className="grid size-10 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
                onClick={onClose}
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </header>

        <div className="space-y-6 overflow-y-auto bg-slate-50/60 p-5 sm:p-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-slate-950">
                1. {tr("Thông tin cơ bản & Thời hạn", "Details & schedule")}
              </h3>
              {duration != null && (
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  ⏳ {tr(
                    `Thời gian triển khai: ${duration} ngày`,
                    `Duration: ${duration} days`,
                  )}
                </span>
              )}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                {tr("Tiêu đề", "Title")}
                <input
                  required
                  autoFocus
                  className={surveyControlClass}
                  value={metadata.title}
                  placeholder={tr(
                    "Ví dụ: Khảo sát gắn kết quý IV",
                    "e.g. Q4 engagement survey",
                  )}
                  onChange={(event) =>
                    onMetadata({ ...metadata, title: event.target.value })
                  }
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                {tr("Mục đích khảo sát", "Survey purpose")}
                <input
                  className={surveyControlClass}
                  value={metadata.description}
                  placeholder={tr(
                    "Mô tả ngắn mục tiêu khảo sát",
                    "Briefly describe the survey goal",
                  )}
                  onChange={(event) =>
                    onMetadata({
                      ...metadata,
                      description: event.target.value,
                    })
                  }
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                {tr("Ngày bắt đầu", "Start date")}
                <input
                  required
                  type="date"
                  className={surveyControlClass}
                  value={metadata.startDate}
                  onChange={(event) =>
                    onMetadata({ ...metadata, startDate: event.target.value })
                  }
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                {tr("Ngày kết thúc", "End date")}
                <input
                  required
                  type="date"
                  min={metadata.startDate || undefined}
                  className={surveyControlClass}
                  value={metadata.endDate}
                  onChange={(event) =>
                    onMetadata({ ...metadata, endDate: event.target.value })
                  }
                />
              </label>
            </div>

            <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">
              <Users size={16} />
              {tr(
                `Phạm vi: Toàn bộ công ty (${totalEmployees} nhân sự)`,
                `Audience: Entire company (${totalEmployees} employees)`,
              )}
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-950">
              2. {tr("Chủ đề khảo sát", "Survey topics")}
            </h3>
            <p className="mt-1 text-xs font-medium text-amber-700">
              {tr(
                "Chủ đề đã được khóa theo công thức chấm điểm của bản nháp. Backend hiện chưa hỗ trợ đổi chủ đề sau khi tạo.",
                "Topics are locked by the draft scoring setup. The backend does not support changing topics after creation.",
              )}
            </p>

            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {categories.map((category) => {
                const selected = selectedIds.has(category.id)
                const count = questions.filter(
                  (question) => question.categoryId === category.id,
                ).length

                return (
                  <div
                    key={category.id}
                    className={`flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 ${
                      selected
                        ? "border-orange-500 bg-orange-50/50 text-orange-950 shadow-sm"
                        : "border-slate-200 bg-white text-slate-500 opacity-60"
                    }`}
                  >
                    <span className="shrink-0 text-base">
                      {topicIcon(category.name)}
                    </span>
                    <strong className="min-w-0 flex-1 text-xs font-medium leading-tight">
                      {topicLabel(category.name, language)}
                    </strong>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        selected
                          ? "bg-orange-100 text-orange-800"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {selected ? `${count} ${tr("câu", "items")}` : "—"}
                    </span>
                    {selected && (
                      <CheckCircle2
                        size={14}
                        className="shrink-0 text-orange-600"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-950">
              3. {tr("Quản lý câu hỏi", "Question management")}
            </h3>
            <SurveyDraftQuestionWizard
              questions={questions}
              categories={categories.filter((category) =>
                selectedIds.has(category.id),
              )}
              newQuestion={newQuestion}
              onNewQuestion={setNewQuestion}
              onAdd={addQuestion}
              onUpdate={updateQuestion}
              onChangeType={changeType}
              onDelete={(id) =>
                setQuestions((current) =>
                  current.filter((question) => question.id !== id),
                )
              }
              onOptionsChange={(id, options) =>
                updateQuestion(id, {
                  answerConfig: createChoiceConfig(options),
                })
              }
              onQuestionsChange={setQuestions}
            />
          </section>
        </div>

        <footer className="flex flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-sm font-medium text-slate-600">
              {tr(
                `Đang có: ${metadata.categoryIds.length} chủ đề · ${questions.length} câu hỏi · Tiếp cận ${totalEmployees} nhân sự`,
                `${metadata.categoryIds.length} topics · ${questions.length} questions · ${totalEmployees} recipients`,
              )}
            </p>
            {studioError && (
              <p className="mt-1 text-xs font-medium text-rose-600" role="alert">
                {studioError}
              </p>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {tr("Hủy / Đóng", "Cancel / Close")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending || !metadata.title.trim() || !duration}
              onClick={() => submitStudio(false)}
            >
              💾 {tr("Lưu thay đổi bản nháp", "Save draft changes")}
            </Button>
            <Button
              type="button"
              disabled={pending || !metadata.title.trim() || !duration}
              onClick={() => submitStudio(true)}
            >
              🚀 {tr("Lưu & Xuất bản ngay", "Save & publish")}
            </Button>
          </div>
        </footer>
      </section>
    </div>
  )
}
