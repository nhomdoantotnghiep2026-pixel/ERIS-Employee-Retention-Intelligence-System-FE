import test from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

test("AI assessment directory and action dossier switch their own UI copy without translating employee data", async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } })
  try {
    const { LanguageProvider } = await server.ssrLoadModule("/src/context/LanguageContext.tsx")
    const { IndividualAnalysis } = await server.ssrLoadModule("/src/components/ai-workspace/IndividualAnalysis.tsx")
    const { ActionDossier } = await server.ssrLoadModule("/src/components/ai-workspace/ActionDossier.tsx")
    const employee = { id: 1, employeeCode: "EMP001", fullName: "Nguyễn Minh Khang", departmentName: "Customer Support", positionName: "Support Specialist", employmentStatus: "ACTIVE", hireDate: "2024-02-01" }
    const analysis = { provider: "fixture", requiresHrReview: true, autoApplied: false, recommendations: [{ policy: { id: 1, code: "RET-1", name: "Flexible schedule" }, reason: "Manager supplied reason", hrVerification: "Manager supplied verification", evidence: [] }] }
    const render = (Component: React.ComponentType<Record<string, unknown>>, props: Record<string, unknown>, language: "vi" | "en") => renderToStaticMarkup(React.createElement(LanguageProvider, { initialLanguage: language }, React.createElement(Component, props)))
    const directoryProps = { employees: [employee], initial: {}, onSelectionChange: () => {} }
    const viDirectory = render(IndividualAnalysis, directoryProps, "vi")
    const enDirectory = render(IndividualAnalysis, directoryProps, "en")
    assert.match(viDirectory, /Bắt đầu đánh giá gắn kết nhân sự/)
    assert.match(enDirectory, /Start an employee engagement assessment/)
    assert.match(enDirectory, /Employee directory/)
    assert.match(enDirectory, /Select for analysis/)
    assert.doesNotMatch(enDirectory, /Chọn phân tích|Thâm niên|Đang làm việc|Lọc nhanh theo phòng ban/)
    assert.match(enDirectory, /Nguyễn Minh Khang/)
    assert.deepEqual([...viDirectory.matchAll(/<option[^>]*value="([^"]*)"/g)].map(match => match[1]), [...enDirectory.matchAll(/<option[^>]*value="([^"]*)"/g)].map(match => match[1]))
    const workspaceProps = { ...directoryProps, initial: { employeeId: 1 } }
    const viWorkspace = render(IndividualAnalysis, workspaceProps, "vi")
    const enWorkspace = render(IndividualAnalysis, workspaceProps, "en")
    assert.match(viWorkspace, /Đổi nhân sự/)
    assert.match(enWorkspace, /Change employee/)
    assert.match(enWorkspace, /Deep analysis review period/)
    assert.match(enWorkspace, /Predict risk %/)
    assert.doesNotMatch(enWorkspace, /Đổi nhân sự|Khoảng thời gian đối soát chuyên sâu|Dự báo % rủi ro/)
    const viDossier = render(ActionDossier, { analysis }, "vi")
    const enDossier = render(ActionDossier, { analysis }, "en")
    assert.match(viDossier, /Hồ sơ hành động điều hành/)
    assert.match(enDossier, /Action dossier/)
    assert.match(enDossier, /HR verification required/)
    assert.doesNotMatch(enDossier, /Hồ sơ hành động điều hành|Nhân sự cần xác minh|Hành động đề xuất/)
    assert.match(enDossier, /Manager supplied reason/)
  } finally {
    await server.close()
  }
})
