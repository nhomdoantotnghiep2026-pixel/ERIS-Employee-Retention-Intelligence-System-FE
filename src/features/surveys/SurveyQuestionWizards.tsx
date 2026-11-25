import { SelectControl } from "../../components/ui/select-control"
import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "../../components/ui"
import { useLanguage } from "../../context/LanguageContext"
import type {
  SurveyCategory,
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

const isChoiceType = (type: SurveyQuestionType) =>
  type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE"

type SurveyQuestionWizardProps = {
  categories: SurveyCategory[]
  stagedQuestions: SurveyQuestionInput[]
  customQuestions: SurveyQuestionInput[]
  customDraft: SurveyQuestionDraft
  onToggleBank: (question: SurveyQuestionInput) => void
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
  onToggleBank,
  onCustomDraft,
  onAddCustom,
  onRemoveCustom,
  onEditCustom,
}: SurveyQuestionWizardProps) {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const [step, setStep] = useState<WizardStep>(0)
  const defaultQuestions = categories.flatMap((category) =>
    category.defaultQuestions.map((question) => ({ category, question })),
  )
  const steps = [
    tr(
      `1. Câu hỏi mặc định (${defaultQuestions.length})`,
      `1. Standard questions (${defaultQuestions.length})`,
    ),
    tr(
      `2. Ngân hàng bổ sung (${stagedQuestions.length})`,
      `2. Question bank (${stagedQuestions.length})`,
    ),
    tr(
      `3. Câu hỏi tự tạo (${customQuestions.length})`,
      `3. Custom questions (${customQuestions.length})`,
    ),
  ]
  const choice = isChoiceType(customDraft.questionType)

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white sm:col-span-2">
      <div
        className="grid border-b border-slate-200 sm:grid-cols-3"
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
        className="min-h-[380px] max-h-[50vh] overflow-y-auto rounded-b-xl bg-slate-50/50 p-4"
      >
        {step === 0 && (
          <div className="space-y-2">
            {defaultQuestions.map(({ category, question }, index) => (
              <article
                key={question.templateCode || question.catalogQuestionId}
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
                </div>
              </article>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            {categories.map((category) => (
              <details
                key={category.id}
                className="rounded-lg border border-slate-200 bg-white"
                open
              >
                <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-slate-800">
                  {topicIcon(category.name)} {topicLabel(category.name, language)} · {category.questionBank.length}
                </summary>
                <div className="space-y-2 border-t border-slate-100 p-3">
                  {category.questionBank.map((question) => {
                    const selected = stagedQuestions.some(
                      (item) =>
                        item.categoryId === question.categoryId &&
                        item.questionText === question.questionText,
                    )
                    return (
                      <button
                        key={question.bankCode || question.catalogQuestionId}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onToggleBank(question)}
                        className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-orange-500 ${
                          selected
                            ? "border-blue-400 bg-blue-50 text-blue-900"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span className="font-bold">{selected ? "✓" : "+"}</span>
                        <span>{question.questionText}</span>
                      </button>
                    )
                  })}
                  {category.questionBank.length === 0 && (
                    <p className="text-xs text-slate-600">
                      {tr("Chưa có câu hỏi bổ sung.", "No optional questions.")}
                    </p>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4 lg:grid-cols-[1fr_.9fr]">
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-600">
                {tr("Chủ đề", "Topic")}
                <SelectControl
                  className={`${surveyControlClass} mt-1`}
                  value={customDraft.categoryId}
                  onChange={(event) =>
                    onCustomDraft({
                      ...customDraft,
                      categoryId: Number(event.target.value),
                    })
                  }
                >
                  <option value={0}>{tr("Chọn chủ đề", "Choose topic")}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {topicLabel(category.name, language)}
                    </option>
                  ))}
                </SelectControl>
              </label>

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

              <Button type="button" size="sm" onClick={onAddCustom}>
                <Plus size={14} />
                {tr("Thêm vào khảo sát", "Add to survey")}
              </Button>
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
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

      <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
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
  const labelFor = (categoryId: number) =>
    topicLabel(
      categories.find((category) => category.id === categoryId)?.name ||
        `#${categoryId}`,
      language,
    )
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
            {tr("Câu", "Question")} {index + 1} · {labelFor(question.categoryId)}
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
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
      <div
        className="grid border-b border-slate-200 sm:grid-cols-3"
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
        className="min-h-[380px] max-h-[50vh] overflow-y-auto rounded-b-xl bg-slate-50/50 p-4"
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
                        <p className="min-w-0 flex-1 text-sm leading-relaxed text-slate-800">
                          {question.questionText}
                        </p>
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
            {categories.map((category, categoryIndex) => {
              const selectedCount = category.questionBank.filter((question) =>
                isBankSelected(category.id, question.questionText),
              ).length
              return (
                <details
                  key={category.id}
                  open={categoryIndex === 0}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-900">
                    <span>{topicIcon(category.name)} {topicLabel(category.name, language)}</span>
                    <span className="text-xs font-medium text-slate-600">
                      {selectedCount}/{category.questionBank.length} {tr("đã chọn", "selected")}
                    </span>
                  </summary>
                  <div className="border-t border-slate-100 p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-600">
                        + {tr("Thêm/bớt câu hỏi bổ sung từ ngân hàng", "Add/remove bank questions")}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => selectAllBankQuestions(category)}
                          className="text-xs font-semibold text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-blue-500"
                        >
                          {tr("Chọn tất cả", "Select all")}
                        </button>
                        <span className="text-slate-300">/</span>
                        <button
                          type="button"
                          onClick={() => clearBankQuestions(category)}
                          className="text-xs font-semibold text-slate-600 hover:underline focus-visible:outline-2 focus-visible:outline-orange-500"
                        >
                          {tr("Bỏ chọn", "Clear")}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {category.questionBank.map((question) => {
                        const selected = isBankSelected(
                          category.id,
                          question.questionText,
                        )
                        return (
                          <label
                            key={question.bankCode || question.catalogQuestionId}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm leading-relaxed transition-colors duration-150 ${
                              selected
                                ? "border-orange-300 bg-orange-50/70 text-slate-900"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() =>
                                toggleBankQuestion(category.id, question)
                              }
                              className="mt-0.5 size-4 accent-orange-600"
                            />
                            <span>{question.questionText}</span>
                          </label>
                        )
                      })}
                      {category.questionBank.length === 0 && (
                        <p className="py-4 text-center text-xs text-slate-600">
                          {tr("Chưa có câu hỏi bổ sung trong chủ đề này.", "No bank questions in this topic.")}
                        </p>
                      )}
                    </div>
                  </div>
                </details>
              )
            })}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-600">
                {tr("Chủ đề", "Topic")}
                <SelectControl
                  className={`${surveyControlClass} mt-1`}
                  value={newQuestion.categoryId}
                  onChange={(event) =>
                    onNewQuestion({
                      ...newQuestion,
                      categoryId: Number(event.target.value),
                    })
                  }
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {topicLabel(category.name, language)}
                    </option>
                  ))}
                </SelectControl>
              </label>
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
              <Button type="button" size="sm" onClick={onAdd}>
                <Plus size={14} />
                {tr("Thêm vào danh sách câu hỏi", "Add question")}
              </Button>
            </div>
            <div className="space-y-2 border-t border-slate-100 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
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

      <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
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

