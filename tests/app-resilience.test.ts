import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
const source = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8")
test("application routes load screens on demand behind accessible fallbacks", async () => {
  const [app, lazyScreens, loadingFallback] = await Promise.all([
    source("src/App.tsx"),
    source("src/routes/lazyScreens.ts"),
    source("src/components/RouteLoadingFallback.tsx"),
  ])
  assert.match(app, /Suspense/)
  assert.match(app, /fallback=\{<RouteLoadingFallback \/>\}/)
  assert.match(app, /<RouteErrorBoundary>/)
  assert.doesNotMatch(app, /from ['"]\.\/screens\//)
  const dynamicImports = [
    ...lazyScreens.matchAll(/import\("\.\.\/screens\/([^"']+)"\)/g),
  ].map((match) => match[1])
  assert.ok(dynamicImports.length >= 40)
  assert.ok(new Set(dynamicImports).size >= 40)
  assert.ok(dynamicImports.includes("ErdSurveys"))
  assert.ok(dynamicImports.includes("AttendanceHistory"))
  assert.ok(dynamicImports.includes("LeaveRecords"))
  assert.ok(dynamicImports.includes("Dashboard"))
  assert.match(lazyScreens, /default: module\.PositionDetail/)
  assert.match(lazyScreens, /default: module\.PositionEdit/)
  assert.match(loadingFallback, /<LoadingState/)
  assert.match(loadingFallback, /Opening workspace/)
  assert.match(loadingFallback, /Đang mở chức năng/)
})
test("route failures provide recovery without exposing technical details", async () => {
  const [boundary, pageState] = await Promise.all([
    source("src/components/ApplicationErrorBoundary.tsx"),
    source("src/components/ui/page-state.tsx"),
  ])
  assert.match(boundary, /getDerivedStateFromError/)
  assert.match(boundary, /componentDidCatch/)
  assert.match(boundary, /previousProps\.resetKey !== this\.props\.resetKey/)
  assert.match(boundary, /<ErrorStatePanel/)
  assert.match(boundary, /Dữ liệu của bạn chưa bị thay đổi/)
  assert.match(boundary, /Your data has not been changed/)
  assert.doesNotMatch(boundary, /this\.state\.error\.message/)
  assert.match(pageState, /role="status"/)
  assert.match(pageState, /aria-live="polite"/)
  assert.match(pageState, /role="alert"/)
  assert.match(pageState, /aria-live="assertive"/)
  assert.match(pageState, /focus|Button/)
})
test("known language leaks are translated at their source", async () => {
  const [shell, attendance, insight] = await Promise.all([
    source("src/components/AppShell.tsx"),
    source("src/screens/AttendanceWorkspace.tsx"),
    source("src/components/ai-workspace/InsightPlaybook.tsx"),
  ])
  assert.match(shell, /label: 'Engagement assessment'/)
  assert.doesNotMatch(shell, /label: 'Đánh giá gắn kết'/)
  assert.match(attendance, /tr\("Quỹ giờ tăng ca", "Overtime"\)/)
  assert.match(attendance, /tr\("Tổng giờ làm việc", "Total working hours"\)/)
  assert.doesNotMatch(
    insight,
    />Top 3 tín hiệu theo mức tác động Explainable SHAP</,
  )
})
