import { SelectControl } from "../../components/ui/select-control"
import { Fragment, useId, useState } from "react"
import { ChevronDown, Plus, Trash2 } from "lucide-react"

import { Button } from "../../components/ui"
import { useLanguage } from "../../context/LanguageContext"
import type {
  SurveyCategory,
  SurveyCatalogQuestion,
  SurveyQuestion,
  SurveyQuestionInput,
  SurveyQuestionType,
} from "../../services/api"

import { CompactOptionInputs } from "./CompactOptionInputs"
import { surveyAreaClass, surveyControlClass } from "./surveyStyles"
import type { SurveyQuestionDraft } from "./surveyTypes"
import {
  isChoiceConfig,
  questionTypeLabels,
  topicIcon,
  topicLabel,
} from "./surveyUtils"

type WizardStep = 0 | 1 | 2

function QuestionSample({ question }: { question: SurveyQuestionInput }) {
  const { language } = useLanguage()
  const id = useId()
  const [rating, setRating] = useState<number | null>(null)
  const vi = language === "vi"
  if (question.questionType === "RATING") {
    const labels = question.answerConfig && "labels" in question.answerConfig ? question.answerConfig.labels : []
    return <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={vi ? "Thử thang điểm" : "Try the rating scale"}>
      {[1, 2, 3, 4, 5].map(value => <button key={value} type="button" aria-pressed={rating === value} title={labels[value - 1]}
        onClick={() => setRating(value)} className={`size-7 rounded-md border text-xs font-semibold focus-visible:outline-2 focus-visible:outline-orange-500 ${rating === value ? "border-orange-500 bg-orange-50 text-orange-800" : "border-slate-200 bg-white text-slate-700 hover:border-orange-300"}`}>{value}</button>)}
    </div>
  }
  if (isChoiceConfig(question.answerConfig)) return <div className="mt-2 flex flex-wrap gap-2">
    {question.answerConfig.options.map(option => <label key={option.code} className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
      <input name={id} className="accent-orange-600" type={question.questionType === "MULTIPLE_CHOICE" ? "checkbox" : "radio"} />{option.label}
    </label>)}
  </div>
  return <input className="mt-2 w-full max-w-sm rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs" onKeyDown={event => { if (event.key === "Enter") event.preventDefault() }} aria-label={vi ? "Thử câu trả lời" : "Try a response"} placeholder={vi ? "Ý kiến của nhân sự..." : "Employee feedback..."} />
}

const isChoiceType = (type: SurveyQuestionType) =>
  type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE"

const bankTypes = {
  SINGLE_CHOICE: ["Chọn 1 đáp án", "Single choice", "bg-blue-50 text-blue-700"],
  MULTIPLE_CHOICE: ["Chọn nhiều đáp án", "Multiple choice", "bg-indigo-50 text-indigo-700"],
  TEXT: ["Câu hỏi mở / Ý kiến", "Open response", "bg-emerald-50 text-emerald-700"],
  RATING: ["Thang điểm 1–5", "Rating 1–5", "bg-amber-50 text-amber-800"],
} as const

function BankGroup({ category, isSelected, onToggle, onSelectAll, onClear }: {
  category: SurveyCategory
  isSelected: (question: SurveyCatalogQuestion) => boolean
  onToggle: (question: SurveyCatalogQuestion) => void
  onSelectAll: () => void
  onClear: () => void
}) {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => language === "vi" ? vi : en
  const [open, setOpen] = useState(true)
  const panelId = useId()
  const count = category.questionBank.filter(isSelected).length
  return <section className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-100 to-slate-50 p-3">
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)} className="flex min-w-0 flex-wrap items-center gap-2 rounded-md text-left text-sm font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-orange-500">
        <ChevronDown size={16} aria-hidden="true" className={open ? "rotate-180 transition-transform" : "transition-transform"} />
        <span aria-hidden="true">{topicIcon(category.name)}</span>
        {topicLabel(category.name, language)}
        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">{tr("Đã chọn", "Selected")} {count}/{category.questionBank.length}</span>
      </button>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={count === category.questionBank.length} onClick={onSelectAll}>{tr("Chọn tất cả", "Select all")}</Button>
        <Button type="button" size="sm" variant="secondary" disabled={count === 0} onClick={onClear}>{tr("Bỏ chọn", "Clear selection")}</Button>
      </div>
    </div>
    <div id={panelId} hidden={!open} className="space-y-2" style={open ? undefined : { display: "none" }}>
      {category.questionBank.map(question => {
        const selected = isSelected(question)
        const [vi, en, tone] = bankTypes[question.questionType]
        return <article key={question.bankCode || question.catalogQuestionId} className={`rounded-lg border p-3 transition-colors ${selected ? "border-orange-300 bg-orange-50/50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 pl-6">
            <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${tone}`}>{tr(vi, en)}</span>
            {selected && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">{tr("✓ Đã thêm vào khảo sát", "✓ Added to survey")}</span>}
          </div>
          <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm font-medium leading-relaxed text-slate-900">
            <input type="checkbox" className="mt-1 size-4 shrink-0 accent-orange-600" checked={selected} onChange={() => onToggle(question)} />
            <span>{question.questionText}</span>
          </label>
          <div className="mt-2 pl-6">
            {question.questionType === "RATING" ? <div className="flex gap-1.5" aria-label={tr("Thang điểm từ 1 đến 5", "Scale from 1 to 5")}>
              {[1, 2, 3, 4, 5].map(value => <span key={value} className="grid size-7 place-items-center rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-600">{value}</span>)}
            </div> : isChoiceConfig(question.answerConfig) ? <div className="flex flex-wrap gap-1.5">
              {question.answerConfig.options.map(option => <span key={option.code} className="rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{option.label}</span>)}
            </div> : <p className="max-w-sm rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs italic text-slate-600">{tr("Ý kiến của nhân sự…", "Employee feedback…")}</p>}
          </div>
        </article>
      })}
      {!category.questionBank.length && <p className="px-3 py-2 text-sm text-slate-600">{tr("Chưa có câu hỏi bổ sung.", "No bank questions.")}</p>}
    </div>
  </section>
}

type SurveyQuestionWizardProps = {
  categories: SurveyCategory[]
  stagedQuestions: SurveyQuestionInput[]
  customQuestions: SurveyQuestionInput[]
  customDraft: SurveyQuestionDraft
  editingCustom: boolean
  onToggleBank: (question: SurveyQuestionInput) => void
  onSetBank: (category: SurveyCategory, selected: boolean) => void
  onCustomDraft: (value: SurveyQuestionDraft) => void
  onAddCustom: () => void
  onRemoveCustom: (index: number) => void
  onEditCustom: (index: number) => void
}

export function SurveyQuestionWizard({
  categories,
  stagedQuestions,
  customQuestions,
  customDraft,
  editingCustom,
  onToggleBank,
  onSetBank,
  onCustomDraft,
  onAddCustom,
  onRemoveCustom,
  onEditCustom,
}: SurveyQuestionWizardProps) {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const [step, setStep] = useState<WizardStep>(0)
  const [customFormOpen, setCustomFormOpen] = useState(false)
  const defaultQuestions = categories.flatMap((category) =>
    category.defaultQuestions.map((question) => ({ category, question })),
  )
  const steps = [
    tr(
      `1. Câu hỏi mặc định (${defaultQuestions.length})`,
      `1. Standard questions (${defaultQuestions.length})`,
    ),
    tr(
      `2. Ngân hàng bổ sung (${stagedQuestions.length}/${categories.reduce((sum, category) => sum + category.questionBank.length, 0)})`,
      `2. Question bank (${stagedQuestions.length}/${categories.reduce((sum, category) => sum + category.questionBank.length, 0)})`,
    ),
    tr(
      `3. Câu hỏi tự tạo (${customQuestions.length})`,
      `3. Custom questions (${customQuestions.length})`,
    ),
  ]
  const choice = isChoiceType(customDraft.questionType)

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white">
      <div
        className="sticky top-0 z-10 grid shrink-0 border-b border-slate-200 bg-white sm:grid-cols-3 lg:static"
        role="tablist"
        aria-label={tr("Các bước chọn câu hỏi", "Question selection steps")}
      >
        {steps.map((label, index) => {
          const selected = step === index
          return (
            <button
              key={label}
              id={`survey-create-step-${index}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`survey-create-panel-${index}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setStep(index as WizardStep)}
              className={`min-h-12 border-b-2 px-3 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-orange-500 ${
                selected
                  ? "border-orange-500 bg-orange-50 text-orange-800"
                  : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div
        id={`survey-create-panel-${step}`}
        role="tabpanel"
        aria-labelledby={`survey-create-step-${step}`}
        className="min-h-0 flex-1 bg-slate-50/50 p-4 lg:overflow-y-auto"
      >
        {step === 0 && (
          <div className="space-y-2">
            {defaultQuestions.map(({ category, question }, index) => (
              <Fragment key={`${category.id}-${question.templateCode || question.catalogQuestionId}`}>
              {defaultQuestions[index - 1]?.category.id !== category.id && (
                <h3 className="pt-2 text-sm font-semibold text-slate-800">{topicIcon(category.name)} {topicLabel(category.name, language)}</h3>
              )}
              <article
                className="flex gap-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-emerald-700">
                  {index + 1}
                </span>
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                      {topicLabel(category.name, language)}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {tr("Thang điểm 1–5", "Rating 1–5")}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-700">
                    {question.questionText}
                  </p>
                  <QuestionSample question={question} />
                </div>
              </article>
              </Fragment>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            {categories.map(category =>
              <BankGroup key={category.id} category={category}
                isSelected={question => stagedQuestions.some(item => item.categoryId === question.categoryId && item.questionText === question.questionText)}
                onToggle={onToggleBank}
                onSelectAll={() => onSetBank(category, true)}
                onClear={() => onSetBank(category, false)}
              />
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {!customFormOpen && !editingCustom && customQuestions.length === 0 && <Button type="button" onClick={() => setCustomFormOpen(true)}><Plus size={15} />{tr("Thêm câu hỏi mới", "New question")}</Button>}
            {(editingCustom || (customFormOpen && customQuestions.length === 0)) && <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">

              <label className="block text-xs font-semibold text-slate-600">
                {tr("Nội dung câu hỏi", "Question text")}
                <textarea
                  rows={2}
                  className={`${surveyAreaClass} mt-1 min-h-16`}
                  value={customDraft.questionText}
                  onChange={(event) =>
                    onCustomDraft({
                      ...customDraft,
                      questionText: event.target.value,
                    })
                  }
                />
              </label>

              <label className="block text-xs font-semibold text-slate-600">
                {tr("Loại trả lời", "Answer type")}
                <SelectControl
                  className={`${surveyControlClass} mt-1`}
                  value={customDraft.questionType}
                  onChange={(event) =>
                    onCustomDraft({
                      ...customDraft,
                      questionType: event.target.value as SurveyQuestionType,
                    })
                  }
                >
                  <option value="SINGLE_CHOICE">🔘 {tr("Một lựa chọn", "Single choice")}</option>
                  <option value="MULTIPLE_CHOICE">☑️ {tr("Nhiều lựa chọn", "Multiple choice")}</option>
                  <option value="RATING">⭐ {tr("Thang điểm 1–5", "Rating 1–5")}</option>
                  <option value="TEXT">✍️ {tr("Tự luận", "Free text")}</option>
                </SelectControl>
              </label>

              {choice && (
                <CompactOptionInputs
                  value={customDraft.options}
                  onChange={(options) => onCustomDraft({ ...customDraft, options })}
                />
              )}

              <Button type="button" size="sm" disabled={customQuestions.length > 0 && !editingCustom} onClick={onAddCustom}>
                <Plus size={14} />
                {editingCustom ? tr("Cập nhật câu hỏi", "Update question") : tr("Thêm vào khảo sát", "Add to survey")}
              </Button>
            </div>}

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-800">
                {tr("Câu hỏi đã thêm", "Added questions")}
              </h4>
              {customQuestions.map((question, index) => (
                <article
                  key={`${question.questionText}-${index}`}
                  className="rounded-lg bg-slate-50 p-3"
                >
                  <p className="text-xs font-semibold text-blue-700">
                    {questionTypeLabels[question.questionType]}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {question.questionText}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onEditCustom(index)}
                      className="text-xs font-semibold text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-500"
                    >
                      {tr("Sửa", "Edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveCustom(index)}
                      className="text-xs font-semibold text-rose-600 hover:underline focus-visible:outline-2 focus-visible:outline-rose-500"
                    >
                      {tr("Xóa", "Delete")}
                    </button>
                  </div>
                </article>
              ))}
              {customQuestions.length === 0 && (
                <p className="text-xs text-slate-600">
                  {tr("Chưa có câu hỏi tự tạo.", "No custom questions yet.")}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={step === 0}
          onClick={() => setStep((step - 1) as WizardStep)}
        >
          ← {tr("Quay lại", "Back")}
        </Button>
        <span className="text-xs font-medium text-slate-500">{step + 1}/3</span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={step === 2}
          onClick={() => setStep((step + 1) as WizardStep)}
        >
          {tr("Tiếp tục", "Continue")} →
        </Button>
      </footer>
    </section>
  )
}

type SurveyDraftQuestionWizardProps = {
  questions: SurveyQuestion[]
  categories: SurveyCategory[]
  newQuestion: SurveyQuestionDraft
  onNewQuestion: (value: SurveyQuestionDraft) => void
  onAdd: () => void
  onUpdate: (id: number, changes: Partial<SurveyQuestion>) => void
  onChangeType: (question: SurveyQuestion, type: SurveyQuestionType) => void
  onDelete: (id: number) => void
  onOptionsChange: (id: number, options: string) => void
  onQuestionsChange: (questions: SurveyQuestion[]) => void
}

export function SurveyDraftQuestionWizard({
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
}: SurveyDraftQuestionWizardProps) {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const [step, setStep] = useState<WizardStep>(0)
  const [customFormOpen, setCustomFormOpen] = useState(false)
  const bankKey = (categoryId: number, questionText: string) =>
    `${categoryId}|${questionText.trim().toLocaleLowerCase()}`
  const bankKeys = new Set(
    categories.flatMap((category) =>
      category.questionBank.map((question) =>
        bankKey(category.id, question.questionText),
      ),
    ),
  )
  const standard = questions.filter((question) => question.isSatisfactionCore)
  const selectedBankQuestions = questions.filter(
    (question) =>
      !question.isSatisfactionCore &&
      bankKeys.has(bankKey(question.categoryId, question.questionText)),
  )
  const customQuestions = questions.filter(
    (question) =>
      !question.isSatisfactionCore &&
      !bankKeys.has(bankKey(question.categoryId, question.questionText)),
  )
  const choiceDraft = isChoiceType(newQuestion.questionType)
  const optionsFor = (question: SurveyQuestion) =>
    isChoiceConfig(question.answerConfig)
      ? question.answerConfig.options.map((option) => option.label).join("\n")
      : ""
  const tabs = [
    tr(`1. Câu hỏi mặc định (${standard.length})`, `1. Standard (${standard.length})`),
    tr(`2. Ngân hàng bổ sung (${selectedBankQuestions.length})`, `2. Question bank (${selectedBankQuestions.length})`),
    tr(`3. Câu hỏi tự tạo (${customQuestions.length})`, `3. Custom (${customQuestions.length})`),
  ]

  const isBankSelected = (categoryId: number, questionText: string) =>
    selectedBankQuestions.some(
      (question) =>
        bankKey(question.categoryId, question.questionText) ===
        bankKey(categoryId, questionText),
    )

  const addBankQuestion = (
    categoryId: number,
    question: SurveyQuestionInput,
  ) => {
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

  const toggleBankQuestion = (
    categoryId: number,
    question: SurveyQuestionInput,
  ) => {
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
      category.questionBank.map((question) =>
        bankKey(category.id, question.questionText),
      ),
    )
    onQuestionsChange(
      questions.filter(
        (question) =>
          !categoryBankKeys.has(
            bankKey(question.categoryId, question.questionText),
          ),
      ),
    )
  }

  const editableCard = (question: SurveyQuestion, index: number) => {
    const choice = isChoiceType(question.questionType)
    return (
      <article key={question.id} className="rounded-lg border border-slate-200 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-500">
            {tr("Câu", "Question")} {index + 1} · {tr("Tự tạo", "Custom")}
          </span>
          <button
            type="button"
            aria-label={tr(
              `Xóa câu hỏi ${question.questionText}`,
              `Delete question ${question.questionText}`,
            )}
            onClick={() => onDelete(question.id)}
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-2 focus-visible:outline-rose-500"
          >
            <Trash2 size={15} />
          </button>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_170px]">
          <input
            aria-label={tr("Nội dung câu hỏi", "Question text")}
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            value={question.questionText}
            onChange={(event) =>
              onUpdate(question.id, { questionText: event.target.value })
            }
          />
          <SelectControl
            aria-label={tr("Loại trả lời", "Answer type")}
            className="h-10 rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            value={question.questionType}
            onChange={(event) =>
              onChangeType(
                question,
                event.target.value as SurveyQuestionType,
              )
            }
          >
            <option value="SINGLE_CHOICE">{tr("Một lựa chọn", "Single choice")}</option>
            <option value="MULTIPLE_CHOICE">{tr("Nhiều lựa chọn", "Multiple choice")}</option>
            <option value="RATING">{tr("Điểm 1–5", "Rating 1–5")}</option>
            <option value="TEXT">{tr("Tự luận", "Free text")}</option>
          </SelectControl>
        </div>
        {choice && (
          <div className="mt-3">
            <CompactOptionInputs
              value={optionsFor(question)}
              onChange={(options) => onOptionsChange(question.id, options)}
            />
          </div>
        )}
      </article>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div
        className="sticky top-0 z-10 grid shrink-0 border-b border-slate-200 bg-white sm:grid-cols-3 lg:static"
        role="tablist"
        aria-label={tr("Các bước chỉnh sửa câu hỏi", "Question editing steps")}
      >
        {tabs.map((tab, index) => {
          const selected = step === index
          return (
            <button
              key={tab}
              id={`survey-edit-step-${index}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`survey-edit-panel-${index}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setStep(index as WizardStep)}
              className={`min-h-12 border-b-2 px-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-orange-500 ${
                selected
                  ? "border-orange-500 bg-orange-50 text-orange-800"
                  : "border-transparent text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab}
            </button>
          )
        })}
      </div>

      <div
        id={`survey-edit-panel-${step}`}
        role="tabpanel"
        aria-labelledby={`survey-edit-step-${step}`}
        className="min-h-0 flex-1 bg-slate-50/50 p-4 lg:overflow-y-auto"
      >
        {step === 0 && (
          <div className="space-y-3">
            {categories.map((category, categoryIndex) => {
              const categoryQuestions = standard.filter(
                (question) => question.categoryId === category.id,
              )
              if (categoryQuestions.length === 0) return null
              return (
                <details
                  key={category.id}
                  open={categoryIndex === 0}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-900">
                    <span>{topicIcon(category.name)} {topicLabel(category.name, language)}</span>
                    <span className="text-xs font-medium text-slate-600">
                      {categoryQuestions.length} {tr("câu chuẩn", "core")}
                    </span>
                  </summary>
                  <div className="space-y-2 border-t border-slate-100 p-3">
                    {categoryQuestions.map((question, index) => (
                      <article
                        key={question.id}
                        className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 shadow-sm"
                      >
                        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-white text-xs font-bold text-slate-600">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1"><p className="text-sm leading-relaxed text-slate-800">{question.questionText}</p><QuestionSample question={question} /></div>
                        <span
                          title={tr("Câu hỏi chuẩn tính điểm", "Core scoring question")}
                          className="shrink-0 text-slate-500"
                        >
                          🔒
                        </span>
                        <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          1–5
                        </span>
                      </article>
                    ))}
                  </div>
                </details>
              )
            })}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            {categories.map(category =>
              <BankGroup key={category.id} category={category}
                isSelected={question => isBankSelected(category.id, question.questionText)}
                onToggle={question => toggleBankQuestion(category.id, question)}
                onSelectAll={() => selectAllBankQuestions(category)}
                onClear={() => clearBankQuestions(category)}
              />
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {!customFormOpen && customQuestions.length === 0 && <Button type="button" onClick={() => setCustomFormOpen(true)}><Plus size={15} />{tr("Thêm câu hỏi mới", "New question")}</Button>}
            {customFormOpen && customQuestions.length === 0 && <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
              <label className="block text-xs font-semibold text-slate-600">
                {tr("Nội dung câu hỏi", "Question text")}
                <textarea
                  rows={2}
                  className={`${surveyAreaClass} mt-1 min-h-[70px]`}
                  value={newQuestion.questionText}
                  onChange={(event) =>
                    onNewQuestion({
                      ...newQuestion,
                      questionText: event.target.value,
                    })
                  }
                />
              </label>
              <label className="block text-xs font-semibold text-slate-600">
                {tr("Dạng trả lời", "Answer type")}
                <SelectControl
                  className={`${surveyControlClass} mt-1`}
                  value={newQuestion.questionType}
                  onChange={(event) =>
                    onNewQuestion({
                      ...newQuestion,
                      questionType: event.target.value as SurveyQuestionType,
                    })
                  }
                >
                  <option value="RATING">⭐ {tr("Thang điểm 1–5 (Đánh giá mức độ hài lòng)", "Rating 1–5")}</option>
                  <option value="SINGLE_CHOICE">🔘 {tr("Chọn một đáp án (Single Choice)", "Single choice")}</option>
                  <option value="MULTIPLE_CHOICE">☑️ {tr("Chọn nhiều đáp án (Multiple Choice)", "Multiple choice")}</option>
                  <option value="TEXT">📝 {tr("Điền văn bản (Text/Tự luận)", "Text response")}</option>
                </SelectControl>
              </label>
              {choiceDraft && (
                <CompactOptionInputs
                  value={newQuestion.options}
                  onChange={(options) =>
                    onNewQuestion({ ...newQuestion, options })
                  }
                />
              )}
              <Button type="button" size="sm" disabled={customQuestions.length > 0} onClick={onAdd}>
                <Plus size={14} />
                {tr("Thêm vào danh sách câu hỏi", "Add question")}
              </Button>
            </div>}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-800">
                {tr(
                  `Câu hỏi tự tạo (${customQuestions.length})`,
                  `Custom questions (${customQuestions.length})`,
                )}
              </h4>
              {customQuestions.map(editableCard)}
              {customQuestions.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-xs text-slate-600">
                  {tr("Chưa có câu hỏi tự tạo.", "No custom questions.")}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={step === 0}
          onClick={() => setStep((step - 1) as WizardStep)}
        >
          ← {tr("Quay lại", "Back")}
        </Button>
        <span className="text-xs text-slate-500">{step + 1}/3</span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={step === 2}
          onClick={() => setStep((step + 1) as WizardStep)}
        >
          {tr("Tiếp tục", "Continue")} →
        </Button>
      </footer>
    </div>
  )
}

