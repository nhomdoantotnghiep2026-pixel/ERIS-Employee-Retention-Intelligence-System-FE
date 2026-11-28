import test from "node:test"
import assert from "node:assert/strict"

import {
  dateWithZone,
  normalizedTopicName,
  progressTone,
  surveyAverageScore,
  surveyResponseCount,
  surveyResponseRate,
  topicIcon,
  topicLabel,
} from "../src/features/surveys/surveyUtils.ts"

import type {
  SurveyResults,
  SurveySummary,
} from "../src/services/api.ts"

const survey = (overrides: Partial<SurveySummary> = {}): SurveySummary => ({
  id: 1,
  title: "Khảo sát gắn kết",
  description: null,
  startDate: "2026-11-01T00:00:00+07:00",
  endDate: "2026-11-30T23:59:59+07:00",
  status: "ACTIVE",
  ...overrides,
})

const results = (overrides: Partial<SurveyResults> = {}): SurveyResults => ({
  survey: survey(),
  invitedCount: 20,
  responseCount: 10,
  completionRate: 50,
  categoryScores: [],
  questions: [],
  ...overrides,
})

test("survey dates use a fixed Vietnam offset and inclusive end of day", () => {
  assert.equal(dateWithZone("2026-11-23"), "2026-11-23T00:00:00+07:00")
  assert.equal(
    dateWithZone("2026-11-23", true),
    "2026-11-23T23:59:59+07:00",
  )
})

test("survey topic labels normalize API names without leaking technical separators", () => {
  assert.equal(normalizedTopicName("  WORK_LIFE-BALANCE  "), "work life balance")
  assert.equal(topicLabel("work_life_balance", "vi"), "Cân bằng công việc & Cuộc sống")
  assert.equal(topicLabel("employee_engagement", "vi"), "Mức độ gắn kết")
  assert.equal(topicLabel("custom_topic", "en"), "Custom Topic")
})

test("survey topic icons stay stable for common HR categories", () => {
  assert.equal(topicIcon("Compensation & Benefits"), "💰")
  assert.equal(topicIcon("Working Time"), "⏰")
  assert.equal(topicIcon("Career Development"), "🚀")
  assert.equal(topicIcon("Communication Culture"), "💬")
  assert.equal(topicIcon("Unknown"), "📝")
})

test("response rate uses active employees, ignoring invited counts and API completion rate", () => {
  const item = survey({ responseCount: 4, invitedCount: 8 })
  assert.equal(surveyResponseCount(item), 4)
  assert.equal(surveyResponseRate(item, undefined, 25), 16)

  const withoutAudience = survey({ responseCount: 5 })
  assert.equal(surveyResponseRate(withoutAudience, undefined, 25), 20)

  const apiResult = results({ responseCount: 7, invitedCount: 10, completionRate: 73 })
  assert.equal(surveyResponseCount(item, apiResult), 7)
  assert.equal(surveyResponseRate(survey({ responseCount: 1, invitedCount: 1 }), undefined, 25).toFixed(1), "4.0")
  assert.equal(surveyResponseRate(item, apiResult, 0), 0)
  assert.equal(surveyResponseRate(item, apiResult, 25).toFixed(1), "28.0")
})

test("average satisfaction score is weighted by category response count", () => {
  const value = surveyAverageScore(results({
    categoryScores: [
      {
        categoryId: 1,
        name: "Job Fit",
        description: null,
        responseCount: 10,
        satisfactionScore: 4,
      },
      {
        categoryId: 2,
        name: "Management",
        description: null,
        responseCount: 5,
        satisfactionScore: 2,
      },
      {
        categoryId: 3,
        name: "Other",
        description: null,
        responseCount: 4,
        satisfactionScore: null,
      },
    ],
  }))

  assert.equal(value, 10 / 3)
  assert.equal(surveyAverageScore(results()), null)
  assert.equal(surveyAverageScore(), null)
})

test("progress tones cover all response-rate thresholds", () => {
  assert.match(progressTone(4).hintVi, /60%/)
  assert.equal(progressTone(59.9).text, "text-amber-800")
  assert.equal(progressTone(60).hintEn, "Statistically reliable")
  assert.equal(progressTone(70).fill, "from-teal-400 to-emerald-500")
})

