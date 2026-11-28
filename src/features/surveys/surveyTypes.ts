import type {
  SurveyAnswerValue,
  SurveyQuestionType,
} from "../../services/api"

export type SurveyDraft = {
  title: string
  description: string
  startDate: string
  endDate: string
  categoryIds: number[]
}

export type SurveyAnswerDraft = {
  value?: SurveyAnswerValue
  comment: string
}

export type SurveyQuestionDraft = {
  questionId?: number
  questionText: string
  categoryId: number
  questionType: SurveyQuestionType
  options: string
  displayOrder: number
}

export const createEmptySurveyDraft = (): SurveyDraft => ({
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  categoryIds: [],
})

export const createEmptySurveyQuestion = (): SurveyQuestionDraft => ({
  questionText: "",
  categoryId: 0,
  questionType: "RATING",
  options: "",
  displayOrder: 100,
})

