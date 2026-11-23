import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createServer } from "vite"

test("individual prediction sends an explicit save choice in one request; history reads do not predict", async () => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, ws: false },
  })
  const originalFetch = globalThis.fetch
  const storage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage")
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: { getItem: () => null } })
  const calls: Array<{ url: string; init?: RequestInit }> = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return Response.json({ data: { saved: false } })
  }
  try {
    const api = await server.ssrLoadModule("/src/services/api.ts")
    for (const save of [false, true]) {
      calls.length = 0
      await api.predictAiEmployee(4, 9, save)
      assert.equal(calls.length, 1)
      assert.equal(calls[0].url, "/api/ai/employees/4/predict")
      assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
        snapshotId: 9,
        save,
      })
    }
    calls.length = 0
    await api.getAiResult(12)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, "/api/ai/results/12")
    assert.notEqual(calls[0].init?.method, "POST")
    calls.length = 0
    await api.listAiEmployeeResults(4)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, "/api/ai/employees/4/results")
    assert.notEqual(calls[0].init?.method, "POST")
    assert.equal(calls[0].init?.cache, "no-store")
    calls.length = 0
    await api.analyzeAiEmployee(4, {
      snapshotId: 9,
      save: true,
      confirmExternalData: true,
      evidencePeriod: { from: "2026-01-01", to: "2026-11-22" },
    })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, "/api/ai/employees/4/analyze")
    assert.equal(calls[0].init?.method, "POST")
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      snapshotId: 9,
      save: true,
      confirmExternalData: true,
      evidencePeriod: { from: "2026-01-01", to: "2026-11-22" },
    })
  } finally {
    globalThis.fetch = originalFetch
    if (storage) Object.defineProperty(globalThis, "sessionStorage", storage)
    else Reflect.deleteProperty(globalThis, "sessionStorage")
    await server.close()
  }
})

test("unified request validates evidence dates before analysis", async () => {
  const {validEvidencePeriod} = await import("../src/components/ai-workspace/unifiedContract.ts")
  assert.equal(validEvidencePeriod("2024-01-01","2024-12-31","2026-11-22"),true)
  assert.equal(validEvidencePeriod("2024-01-01","2025-01-01","2026-11-22"),false)
  assert.equal(validEvidencePeriod("2026-11-23","2026-11-23","2026-11-22"),false)
  assert.equal(validEvidencePeriod("2026-11-22","2026-11-21","2026-11-22"),false)
  assert.equal(validEvidencePeriod("2026-02-30","2026-03-01","2026-11-22"),false)
})

test("assessment separates the fast prediction endpoint from unified deep analysis", async () => {
 const source=await readFile(new URL("../src/components/ai-workspace/IndividualAnalysis.tsx",import.meta.url),"utf8")
 const workspace=await readFile(new URL("../src/components/ai-workspace/UnifiedWorkspace.tsx",import.meta.url),"utf8")
 assert.doesNotMatch(source+workspace,/policy-recommendations|policy-agent\//)
 assert.match(workspace,/async function runPrediction/)
 assert.match(workspace,/predictAiEmployee\(employee\.id, profile\.snapshotId, false\)/)
 assert.match(workspace,/async function openDetails/)
 assert.match(workspace,/analyzeAiEmployee/)
})

test("employee assessment resolves a ready profile in the background without exposing data-version controls", async () => {
  const workspace = await readFile(new URL("../src/components/ai-workspace/UnifiedWorkspace.tsx", import.meta.url), "utf8")
  assert.match(workspace, /listAiSnapshots\(employee\.id\)/)
  assert.match(workspace, /find\(item => item\.ready && item\.snapshotId\)/)
  assert.match(workspace, /previewAiEmployee\(employee\.id/)
  assert.doesNotMatch(workspace, />Snapshot</)
  assert.doesNotMatch(workspace, /Tạo snapshot/)
  assert.doesNotMatch(workspace, /TreeSHAP|E5 & Qwen|Ollama|Điểm nền|Ngưỡng:/)
})

test("saved and preview assessments compare with the immediately previous saved session", async () => {
  const workspace = await readFile(new URL("../src/components/ai-workspace/UnifiedWorkspace.tsx", import.meta.url), "utf8")
  assert.match(workspace, /items\[index \+ 1\] : items\[0\]/)
  assert.match(workspace, /getAiResult\(candidate\.predictionId\)/)
  assert.match(workspace, /So với lần đánh giá trước/)
  assert.match(workspace, /Phiên đánh giá đầu tiên/)
})

test("assessment UI gates the detailed signals and action dossier behind stage two", async () => {
  const workspace = await readFile(new URL("../src/components/ai-workspace/UnifiedWorkspace.tsx", import.meta.url), "utf8")
  const dossier = await readFile(new URL("../src/components/ai-workspace/ActionDossier.tsx", import.meta.url), "utf8")
  assert.match(workspace, /Dự báo % rủi ro/)
  assert.match(workspace, /detailsUnlocked/)
  assert.match(workspace, /Khởi chạy phân tích chuyên sâu \(~12s\)/)
  assert.match(workspace, /Quá trình mất khoảng 10 – 15 giây/)
  assert.match(workspace, /eris-progress-shimmer/)
  assert.match(workspace, /Trích xuất lịch sử chấm công & phản hồi khảo sát/)
  assert.doesNotMatch(workspace, /RiskSpectrum|An toàn \(0 - 10%\)/)
  assert.match(workspace, /Ngưỡng cảnh báo:/)
  assert.match(workspace, /Điểm số đã vượt ngưỡng cảnh báo của mô hình/)
  assert.match(workspace, /Mức độ hài lòng công việc/)
  assert.match(workspace, /TrendSparkline/)
  assert.match(workspace, /Xem chi tiết phiên/)
  assert.match(dossier, /Nhân sự cần xác minh/)
  assert.doesNotMatch(workspace + dossier, />TreeSHAP<|>Ollama<|>Base value<|>Điểm nền</)
})
