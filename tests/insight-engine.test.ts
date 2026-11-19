import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('all feature branches render supplied insight and policy without fallback or evidence gates', async () => {
  const server = await createServer({configFile: false, server: {middlewareMode: true, ws: false}})
  try {
    const {buildInsights, THRESHOLDS, fillTemplate, referenceVariables} = await server.ssrLoadModule('/src/components/ai-workspace/insight-engine.ts')
    assert.equal(referenceVariables('Hire_Date', {Hire_Date: '2024-02-28', __snapshotDate: '2024-03-01', __capturedAt: '2026-01-01'}).x, '2')
    assert.equal(referenceVariables('Hire_Date', {Hire_Date: '2026-11-18', __capturedAt: '2026-11-18T18:00:00Z'}).x, '1')
    assert.equal(referenceVariables('Work_Hours_Per_Week', {Work_Hours_Per_Week: 40}).x, '40')
    assert.equal(referenceVariables('Sick_Days', {Sick_Days: 2}).x, '2')
    assert.equal(referenceVariables('Sick_Days', {Sick_Days: 2, __snapshotDate: '2026-11-11'})['kỳ'], 'từ đầu năm đến 11/11/2026')
    assert.equal(referenceVariables('Hire_Date', {Hire_Date: '2025-10-30', __snapshotDate: '2026-11-11'}).x, '377')
    assert.equal(referenceVariables('Overtime_Hours', {Overtime_Hours: 0}).x, '0')
    assert.equal(referenceVariables('Employee_Satisfaction_Score', {Employee_Satisfaction_Score: 2.58}).x, '2,58')
    const {InsightPlaybook} = await server.ssrLoadModule('/src/components/ai-workspace/InsightPlaybook.tsx')
    const copy = JSON.parse(readFileSync('src/components/ai-workspace/insight-copy.json', 'utf8'))
    for (const [feature, branches] of Object.entries(copy)) {
      for (const [branch, text] of Object.entries(branches as Record<string, {insight: string; policy: string}>)) {
        const negative = branch.startsWith('negative')
        const magnitude = THRESHOLDS[feature][branch.endsWith('Strong') ? 1 : 0]
        const engine = buildInsights({[feature]: negative ? -magnitude : magnitude}, {}, {[feature]: {verified: false}})
        const row = engine.selected[0]
        assert.equal(row.insight, text.insight, feature + branch)
        assert.equal(row.policy, text.policy, feature + branch)
        assert.equal(row.needsEvidence, false)
        for (const tab of ['insights', 'policies']) {
          const html = renderToStaticMarkup(React.createElement(InsightPlaybook, {engine, tab, focusFeature: null, onPolicy: () => {}}))
          assert.ok(html.includes(tab === 'insights' ? text.insight : text.policy), feature + branch + tab)
          assert.ok(!html.includes('Đề xuất cần HR xác minh'))
          assert.ok(!html.includes('Explainable SHAP'))
          assert.ok(!html.includes('Hạng #'))
          if (tab === 'policies') {
            assert.ok(html.includes('type="checkbox"'))
            assert.ok(!html.includes('Tạo lịch hẹn 1-on-1'))
            assert.ok(!html.includes('Đánh dấu đã hoàn thành'))
            assert.ok(!html.includes('<blockquote'))
          } else {
            assert.ok(!html.includes('<blockquote'))
            assert.ok(html.includes('Xem giải pháp tương ứng [Tab 3]'))
          }
        }
      }
    }
    assert.equal(fillTemplate('{x} {ngày}', {x: 0}, 'Monthly_Salary').text, '0 {ngày}')
    const salary = buildInsights({Monthly_Salary: -.01}, {Monthly_Salary: 4425}).negative[0]
    assert.equal(salary.insight, copy.Monthly_Salary.negativeStrong.insight)
    assert.equal(salary.policy, copy.Monthly_Salary.negativeStrong.policy)
    assert.equal(buildInsights({Hire_Date: .003}, {Hire_Date: '2014-09-07'}).positive[0].insight, copy.Hire_Date.positiveModerate.insight)
  } finally { await server.close() }
})
