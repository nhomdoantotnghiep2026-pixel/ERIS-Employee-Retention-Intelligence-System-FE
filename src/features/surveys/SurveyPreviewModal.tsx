import { useMemo } from "react"
import { Send, Users, X } from "lucide-react"

import { Button } from "../../components/ui"
import { useLanguage } from "../../context/LanguageContext"
import type {
  SurveyCategory,
  SurveyQuestion,
  SurveySummary,
} from "../../services/api"

import { useDialogBehavior } from "./useDialogBehavior"
import { isChoiceConfig, topicIcon, topicLabel } from "./surveyUtils"

type SurveyPreviewModalProps = {
  survey: SurveySummary & { questions: SurveyQuestion[] }
  categories: SurveyCategory[]
  totalEmployees: number
  onClose: () => void
  onBack?: () => void
  pending?: boolean
  error?: string
  onPublish?: () => void
}

export function SurveyPreviewModal({
  survey,
  categories,
  totalEmployees,
  onClose,
  onBack,
  pending = false,
  error,
  onPublish,
}: SurveyPreviewModalProps) {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const groupedQuestions = useMemo(() => {
    const groups = new Map<number, SurveyQuestion[]>()
    const bankKeys = new Set(categories.flatMap(category => category.questionBank.map(question =>
      `${category.id}|${question.questionText.trim().toLocaleLowerCase()}`,
    )))
    for (const question of survey.questions) {
      const key = `${question.categoryId}|${question.questionText.trim().toLocaleLowerCase()}`
      const categoryId = categories.length === 0 || question.isSatisfactionCore || bankKeys.has(key) ? question.categoryId : 0
      const group = groups.get(categoryId) ?? []
      group.push(question)
      groups.set(categoryId, group)
    }
    return [...groups.entries()].sort(([a], [b]) => Number(a === 0) - Number(b === 0)).map(([categoryId, questions]) => {
      const rawName =
        categories.find((category) => category.id === categoryId)?.name ||
        `Chủ đề #${categoryId}`
      return {
        categoryId,
        rawName,
        name: categoryId === 0
          ? tr("Câu hỏi bổ sung tự tạo", "Custom questions")
          : topicLabel(rawName, language),
        questions,
      }
    })
  }, [categories, language, survey.questions])
  const estimatedMinutesMin = Math.max(
    1,
    Math.ceil(survey.questions.length * 0.35),
  )
  const estimatedMinutesMax = Math.max(
    estimatedMinutesMin,
    Math.ceil(survey.questions.length * 0.5),
  )
  const renderQuestionText = (text: string, required: boolean) => {
    const words = text.trim().split(/\s+/)
    const lastWord = words.pop() || ""
    return (
      <>
        {words.length > 0 ? `${words.join(" ")} ` : ""}
        <span className="whitespace-nowrap">
          {lastWord}
          {required && <span className="font-bold text-rose-500"> *</span>}
        </span>
      </>
    )
  }

  useDialogBehavior(true, () => { if (!pending) onClose() })

  return (
    <div
      className="fixed inset-0 z-[90] flex animate-in items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm fade-in duration-200 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="survey-preview-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose()
      }}
    >
      <section
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl animate-in flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl slide-in-from-bottom-2 zoom-in-95 duration-200"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">
              {tr("Góc nhìn nhân viên", "Employee preview")}
            </p>
            <h2
              id="survey-preview-title"
              className="mt-1 text-xl font-semibold text-slate-950"
            >
              {survey.title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {survey.description || tr("Không có mô tả.", "No description.")}
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
              <Users size={14} />
              {tr(
                `Toàn bộ công ty · ${totalEmployees} nhân sự`,
                `Entire company · ${totalEmployees} employees`,
              )}
            </p>
          </div>
          <button
            autoFocus
            type="button"
            aria-label={tr("Đóng", "Close")}
            className="grid size-9 shrink-0 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-orange-500"
            disabled={pending}
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>

        {survey.questions.length > 16 && (
          <nav
            className="flex shrink-0 gap-2 overflow-x-auto border-b border-slate-200 bg-white px-5 py-3 sm:px-6"
            aria-label={tr("Mục lục chủ đề", "Topic navigation")}
          >
            {groupedQuestions.map((group) => (
              <button
                key={group.categoryId}
                type="button"
                onClick={() =>
                  document
                    .getElementById(`preview-topic-${group.categoryId}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors duration-150 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-800 focus-visible:outline-2 focus-visible:outline-orange-500"
              >
                {group.name} ({group.questions.length})
              </button>
            ))}
          </nav>
        )}

        <div className="min-h-0 overflow-y-auto scroll-smooth bg-slate-50/70 p-5 sm:p-6">
          {error && <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/60 bg-slate-100/80 px-4 py-2.5 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-orange-100/80 px-2 py-0.5 font-semibold text-orange-700">
                👁 {tr("CHẾ ĐỘ XEM TRƯỚC", "PREVIEW MODE")}
              </span>
              <span>
                {tr(
                  "Mô phỏng giao diện khảo sát thực tế của nhân viên",
                  "Simulation of the employee survey experience",
                )}
              </span>
            </div>
            <div className="font-medium text-slate-700">
              {survey.questions.length} {tr("câu hỏi", "questions")} · {tr("Ước tính", "Estimated")} ~{estimatedMinutesMin}
              {estimatedMinutesMax > estimatedMinutesMin
                ? `–${estimatedMinutesMax}`
                : ""}{" "}
              {tr("phút hoàn thành", "min to complete")}
            </div>
          </div>

          <div className="space-y-6">
            {groupedQuestions.map((group) => (
              <section
                key={group.categoryId}
                id={`preview-topic-${group.categoryId}`}
                className="scroll-mt-4"
              >
                <h3 className="mb-3 flex items-center gap-2 pb-2 pt-4 text-xs font-bold uppercase tracking-wider text-slate-600">
                  <span aria-hidden="true">{group.categoryId === 0 ? "⭐" : topicIcon(group.rawName)}</span>
                  <span>{group.name}</span>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {group.questions.length} {tr("câu", "items")}
                  </span>
                  <span className="ml-2 h-px flex-1 bg-slate-200" />
                </h3>

                <div className="space-y-3">
                  {group.questions.map((question, index) => (
                    <article
                      key={question.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex gap-3">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-orange-50 text-xs font-bold text-orange-700">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium leading-6 text-slate-900">
                            {renderQuestionText(
                              question.questionText,
                              question.isRequired,
                            )}
                          </p>

                          {question.questionType === "RATING" && (
                            <div className="mt-4 max-w-sm">
                              <div className="flex items-center gap-2">
                                {[1, 2, 3, 4, 5].map((value) => (
                                  <button
                                    key={value}
                                    type="button"
                                    aria-label={tr(
                                      `Xem trước mức ${value}`,
                                      `Preview rating ${value}`,
                                    )}
                                    className="flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 shadow-sm transition-all duration-150 hover:border-orange-400 hover:bg-orange-50/40 hover:text-orange-600 focus-visible:outline-2 focus-visible:outline-orange-500 sm:size-12"
                                  >
                                    {value}
                                  </button>
                                ))}
                              </div>
                              <div className="mt-1.5 flex justify-between gap-4 text-[11px] leading-tight text-slate-500">
                                <span className="max-w-24">
                                  {tr("Hoàn toàn không đồng ý", "Strongly disagree")}
                                </span>
                                <span className="max-w-24 text-right">
                                  {tr("Hoàn toàn đồng ý", "Strongly agree")}
                                </span>
                              </div>
                            </div>
                          )}

                          {isChoiceConfig(question.answerConfig) && (
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {question.answerConfig.options.map((option) => (
                                <span
                                  key={option.code}
                                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"
                                >
                                  <span
                                    className={`size-3 border border-slate-300 ${
                                      question.questionType === "SINGLE_CHOICE"
                                        ? "rounded-full"
                                        : "rounded"
                                    }`}
                                  />
                                  {option.label}
                                </span>
                              ))}
                            </div>
                          )}

                          {question.questionType === "TEXT" && (
                            <div className="mt-3 h-20 rounded-lg border border-dashed border-slate-300 bg-slate-50" />
                          )}
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
          <p className="text-xs font-medium text-slate-600">
            {survey.questions.length}{" "}
            {tr(
              "câu hỏi · Đây là bản xem trước, không ghi nhận câu trả lời.",
              "questions · Preview only; responses are not recorded.",
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={pending} onClick={onBack ?? onClose}>
              {onBack ? tr("Quay lại chỉnh sửa", "Back to editing") : tr("Đóng", "Close")}
            </Button>
            {onPublish && (
              <Button type="button" disabled={pending} onClick={onPublish}>
                <Send size={15} />
                {pending ? tr("Đang xuất bản…", "Publishing…") : tr("Xác nhận xuất bản khảo sát", "Confirm survey publishing")}
              </Button>
            )}
          </div>
        </footer>
      </section>
    </div>
  )
}

