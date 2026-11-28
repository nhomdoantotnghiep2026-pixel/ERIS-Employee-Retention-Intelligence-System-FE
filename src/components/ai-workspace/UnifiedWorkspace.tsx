import { useAiTr } from "./aiWorkspaceLanguage"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { AlertTriangle, ArrowLeft, Check, ChevronRight, Eye, History, Loader2, Minus, Sparkles, TrendingDown, TrendingUp, UserRound, X } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Button } from "../ui/button"
import { SelectControl } from "../ui/select-control"
import { ApiError, analyzeAiEmployee, getAiResult, listAiEmployeeResults, listAiSnapshots, previewAiEmployee, type AiEmployee, type AiPolicyEvidence, type AiPrediction, type AiResultHistoryItem, type AiSnapshot } from "../../services/api"
import { featureLabel } from "./analysis"
import { ActionDossier, EvidenceCard } from "./ActionDossier"
import { validEvidencePeriod, type UnifiedAnalyzeRequest, type UnifiedAnalyzeResponse } from "./unifiedContract"

type AnalysisResult = Omit<AiPrediction, "model" | "warning"> & { warning?: string; model: { score: number; base_value?: number; contributions: Record<string, number>; riskLevel?: string | null; predictionLabel?: boolean; assessment?: UnifiedAnalyzeResponse["model"]["assessment"] } }
const card = "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,.03),0_12px_32px_rgba(15,23,42,.045)]"
const errors: Record<number, string> = { 400: "Dữ liệu hoặc khoảng thời gian đối soát không hợp lệ. Chọn tối đa 366 ngày và không chọn ngày tương lai.", 401: "Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại.", 403: "Chỉ tài khoản Nhân sự đang hoạt động mới có quyền thực hiện đánh giá.", 404: "Không tìm thấy dữ liệu nhân viên hợp lệ để đánh giá.", 409: "Dữ liệu hồ sơ vừa được cập nhật — vui lòng đánh giá lại.", 422: "Hồ sơ nhân viên chưa đủ thông tin cơ bản — vui lòng bổ sung tại mục Hồ sơ nhân sự.", 429: "Hệ thống đang xử lý một phiên đánh giá khác của bạn. Vui lòng đợi trong giây lát.", 502: "Dịch vụ phân tích tạm thời gián đoạn — vui lòng thử lại sau ít phút.", 503: "Dịch vụ phân tích tạm thời gián đoạn — vui lòng thử lại sau ít phút.", 504: "Quá thời gian chờ phản hồi — vui lòng thử lại." }
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
const yearAgo = () => { const d = new Date(`${today()}T00:00:00+07:00`); d.setFullYear(d.getFullYear() - 1); return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(d) }
const dateTime = (value?: string) => value ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—"
const sortHistory = (items: AiResultHistoryItem[]) => [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.predictionId - a.predictionId)
const scoreOf = (result: AnalysisResult) => result.model.assessment?.scorePoints ?? result.model.score * 100
const initials = (name: string) => name.trim().split(/\s+/).slice(-2).map(part => part[0]).join("").toUpperCase()

export function UnifiedWorkspace({ employee, employees, onChoose, onBack, onResult }: { employee: AiEmployee; employees: AiEmployee[]; onChoose: (id: number) => void; onBack: () => void; onResult?: (value: boolean) => void }) {
  const tr = useAiTr()
  const [profile, setProfile] = useState<AiSnapshot | null>(null)
  const [history, setHistory] = useState<AiResultHistoryItem[]>([])
  const [trend, setTrend] = useState<AnalysisResult[]>([])
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [previous, setPrevious] = useState<AnalysisResult | null>(null)
  const [reviewing, setReviewing] = useState<AnalysisResult | null>(null)
  const [from, setFrom] = useState(yearAgo()), [to, setTo] = useState(today())
  const [save, setSave] = useState(false)
  const [busy, setBusy] = useState(true), [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState(""), [notice, setNotice] = useState("")
  const [tab, setTab] = useState(0)
  const lock = useRef(false)
  const gradient = useId().replace(/:/g, "")
  const reduceMotion = useReducedMotion()

  const fail = (cause: unknown) => { const status = cause instanceof ApiError ? cause.status : null; setError(status ? errors[status] ?? "Không thể hoàn thành yêu cầu. Vui lòng thử lại." : "Không thể tải dữ liệu hồ sơ. Vui lòng thử lại.") }
  const hydrateTrend = async (items: AiResultHistoryItem[]) => { const settled = await Promise.allSettled(items.slice(0, 5).map(item => getAiResult(item.predictionId))); setTrend(settled.filter((item): item is PromiseFulfilledResult<{ data: AiPrediction }> => item.status === "fulfilled").map(item => item.value.data as AnalysisResult).filter(item => item.preview.employee.id === employee.id)) }
  const getHistory = async () => { const items = sortHistory((await listAiEmployeeResults(employee.id)).data); setHistory(items); void hydrateTrend(items); return items }

  useEffect(() => {
    let active = true
    setBusy(true); setProfile(null); setResult(null); setPrevious(null); setReviewing(null); setError(""); setNotice("")
    Promise.all([listAiSnapshots(employee.id), listAiEmployeeResults(employee.id)]).then(async ([snapshots, results]) => {
      if (!active) return
      const ready = [...snapshots.data].sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt)).find(item => item.ready && item.snapshotId)
      const items = sortHistory(results.data); setHistory(items); void hydrateTrend(items)
      if (ready) return setProfile(ready)
      const created = (await previewAiEmployee(employee.id, { periodStart: from, periodEnd: to })).data
      if (active) setProfile(created)
    }).catch(cause => { if (active) fail(cause) }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [employee.id])
  useEffect(() => { onResult?.(Boolean(result)) }, [result, onResult])

  async function findPrevious(current: AnalysisResult, items: AiResultHistoryItem[]) {
    const index = current.saved && current.predictionId ? items.findIndex(item => item.predictionId === current.predictionId) : -1
    const candidate = index >= 0 ? items[index + 1] : items[0]
    if (!candidate || candidate.predictionId === current.predictionId) return setPrevious(null)
    try { setPrevious((await getAiResult(candidate.predictionId)).data as AnalysisResult) } catch { setPrevious(null) }
  }
  async function openHistory(id: number) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(""); setNotice("")
    try {
      const current = (await getAiResult(id)).data as AnalysisResult
      if (current.preview.employee.id !== employee.id) throw new Error("Employee mismatch")
      setResult(current); setTab(0)
      const period = current.policyAnalysis?.selection
      if (period) { setFrom(period.from.slice(0, 10)); setTo(period.to.slice(0, 10)) }
      await findPrevious(current, history)
    } catch (cause) { fail(cause) } finally { lock.current = false; setBusy(false) }
  }
  async function handleRunFullAnalysis() {
    if (lock.current || busy) return
    if (!profile?.ready || !profile.snapshotId) { setError(errors[422]); return }
    if (!validEvidencePeriod(from, to, today())) { setError(errors[400]); return }
    lock.current = true; setBusy(true); setAnalyzing(true); setError(""); setNotice("")
    try {
      const body: UnifiedAnalyzeRequest = { snapshotId: profile.snapshotId, confirmExternalData: true, save, evidencePeriod: { from, to } }
      const { data } = await analyzeAiEmployee(employee.id, body)
      const current: AnalysisResult = {
        ...data,
        preview: { ...profile, ...data.preview, employee: { ...employee, ...data.preview.employee } },
      }
      setResult(current); setPrevious(null); setTab(0)
      let items = history
      if (data.saved && data.predictionId) {
        const [detail, refreshed] = await Promise.allSettled([getAiResult(data.predictionId), getHistory()])
        if (detail.status === "fulfilled" && detail.value.data.preview.employee.id === employee.id) {
          const saved = detail.value.data as AnalysisResult
          setResult({ ...current, createdAt: saved.createdAt ?? current.createdAt, policyAnalysis: saved.policyAnalysis ?? current.policyAnalysis })
        }
        const savedItem = { predictionId: data.predictionId, snapshotId: data.snapshotId ?? data.preview.snapshotId, createdAt: (detail.status === "fulfilled" ? detail.value.data.createdAt : undefined) ?? current.createdAt ?? "" }
        items = refreshed.status === "fulfilled" ? refreshed.value : history
        if (!items.some(item => item.predictionId === savedItem.predictionId)) {
          items = [savedItem, ...items]; setHistory(items)
        }
        if (detail.status === "rejected" || refreshed.status === "rejected") setNotice("Đã lưu kết quả. Một phần thông tin lịch sử chưa tải lại được.")
      }
      await findPrevious(current, items)
    } catch (cause) { fail(cause) } finally { lock.current = false; setBusy(false); setAnalyzing(false) }
  }

  return <div className="space-y-5 text-slate-900">
    <section className={`${card} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-3 p-5">
        <Button variant="outline" disabled={busy} onClick={onBack}><ArrowLeft />{tr("Đổi nhân sự")}</Button>
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full border border-indigo-200/80 bg-indigo-50 text-sm font-bold text-indigo-700 shadow-xs">{initials(employee.fullName)}</span>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 className="text-base font-bold tracking-tight text-slate-900 [overflow-wrap:anywhere]">{employee.fullName}</h2>
            <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-600">{employee.employeeCode}</span>
            <span className="rounded-full border border-indigo-200/60 bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">{employee.departmentName || tr("Chưa cập nhật phòng ban")}</span>
            <span className="text-xs font-medium text-slate-600">{employee.positionName || tr("Chưa cập nhật chức danh")}</span>
          </div>
        </div>
      </div>
      <div className="@container border-t border-slate-100 bg-slate-50/60 p-4">
        <div className="grid min-w-0 items-center gap-2 @min-[540px]:grid-cols-2 @min-[920px]:grid-cols-[minmax(150px,1fr)_auto_auto_auto]">
          <SelectControl aria-label={tr("Chuyển nhanh nhân viên")} className="field h-10 min-w-0" disabled={busy} value={employee.id} onChange={event => onChoose(Number(event.target.value))}>
            {employees.map(item => <option key={item.id} value={item.id}>{item.employeeCode} · {item.fullName}</option>)}
          </SelectControl>
          <div role="group" aria-label={tr("Khoảng thời gian đối soát")} className="flex min-w-0 items-center gap-1.5">
            <input aria-label={tr("Từ ngày")} type="date" max={today()} className="field h-10 min-w-0 flex-1 px-2 @min-[920px]:w-32" disabled={busy} value={from} onChange={event => setFrom(event.target.value)} />
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
            <input aria-label={tr("Đến ngày")} type="date" max={today()} className="field h-10 min-w-0 flex-1 px-2 @min-[920px]:w-32" disabled={busy} value={to} onChange={event => setTo(event.target.value)} />
          </div>
          <button type="button" role="switch" aria-checked={save} disabled={busy} onClick={() => setSave(value => !value)} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium">
            <span aria-hidden="true" className={`relative h-5 w-9 shrink-0 rounded-full transition ${save ? "bg-orange-500" : "bg-slate-300"}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white transition ${save ? "left-[18px]" : "left-0.5"}`} /></span>
            {save ? tr("Sẽ lưu kết quả đầy đủ") : tr("Chỉ xem kết quả")}
          </button>
          <Button type="button" disabled={busy || !profile?.ready} onClick={handleRunFullAnalysis}
            title={tr("Sử dụng dữ liệu chấm công và khảo sát trong kỳ để đề xuất hỗ trợ.")}
            className="h-10 whitespace-normal bg-gradient-to-r from-orange-700 to-amber-700 px-3 text-xs text-white shadow-sm">
            {analyzing ? <Loader2 className="motion-safe:animate-spin" /> : <Sparkles />}
            {analyzing ? tr("Đang phân tích dữ liệu…") : tr("Phân tích toàn diện & Đề xuất hành động")}
          </Button>
        </div>
      </div>
      {!busy && profile && !profile.ready && <div className="border-t border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900"><strong>{tr("Hồ sơ chưa đủ điều kiện đánh giá.")}</strong> {tr("Cần bổ sung:")} {[...(profile.missingFeatures ?? []), ...(profile.invalidFeatures ?? [])].map(key => tr(featureLabel(key))).join(", ") || tr("thông tin hồ sơ bắt buộc")}.</div>}
    </section>
    {error && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{tr(error)}</p>}
    {busy && !analyzing && <p role="status" className="text-sm text-slate-600">{tr("Đang tải hồ sơ nhân sự…")}</p>}
    {notice && <p role="status" className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{tr(notice)}</p>}
    <div className="grid grid-cols-12 items-start gap-6"><section className={`${card} col-span-12 min-w-0 p-5 xl:col-span-8`}>
      {result && <div className="mb-4 flex flex-wrap items-center gap-2 text-sm"><span className={`rounded-full px-3 py-1 font-medium ${result.saved ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>{result.saved ? tr("Đã lưu hồ sơ · Phiên #{id}", { id: result.predictionId ?? "—" }) : tr("Kết quả phân tích · Chưa lưu")}</span>{result.saved && <span className="text-slate-500">{tr(dateTime(result.createdAt))}</span>}<span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{tr("Cần Nhân sự xác minh")}</span></div>}
      <div role="tablist" aria-label={tr("Các phần đánh giá gắn kết")} className="mb-5 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1" onKeyDown={event => { if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return; event.preventDefault(); const next = (tab + (event.key === "ArrowRight" ? 1 : 2)) % 3; setTab(next); (event.currentTarget.querySelectorAll('[role="tab"]')[next] as HTMLButtonElement)?.focus() }}>{[tr("Tình trạng gắn kết"), tr("Nguyên nhân & Tín hiệu"), tr("Kế hoạch hành động")].map((label, index) => <button type="button" role="tab" aria-controls="engagement-tab-panel" aria-selected={tab === index} tabIndex={tab === index ? 0 : -1} key={label} onClick={() => setTab(index)} className={`relative min-h-10 rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 ${tab === index ? "text-slate-900" : "text-slate-600 hover:text-orange-700"}`}>{tab === index && <motion.span layoutId="activeTabBadge" className="absolute inset-0 rounded-lg border border-slate-200 bg-white shadow-sm" transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }} />}<span className="relative z-10">{index + 1}. {label}</span></button>)}</div>
      <AnimatePresence mode="wait" initial={false}><motion.div id="engagement-tab-panel" role="tabpanel" key={`${tab}-${result?.predictionId ?? "empty"}`} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -8 }} transition={{ duration: reduceMotion ? 0 : .2 }}>{!result ? <EmptyResult employee={employee} ready={Boolean(profile?.ready)} /> : tab === 0 ? <EngagementStatus result={result} previous={previous} trend={trend} gradient={gradient} onReview={() => setReviewing(previous)} /> : tab === 1 ? <BusinessSignals result={result} /> : result.policyAnalysis ? <ActionDossier analysis={result.policyAnalysis} /> : <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-600">{tr("Phiên này chưa có kế hoạch hành động được lưu.")}</div>}</motion.div></AnimatePresence>
      {tab === 0 && <AssessmentHistory key={employee.id} employeeId={employee.id} history={history} trend={trend} current={result} previous={previous} busy={busy} onOpen={openHistory} />}
    </section><aside className="col-span-12 min-w-0 xl:sticky xl:top-4 xl:col-span-4"><ProfileContext snapshot={result?.preview ?? profile} /></aside></div>
    <AnimatePresence>{reviewing && <PreviousSessionModal result={reviewing} onClose={() => setReviewing(null)} />}</AnimatePresence>
  </div>
}

function EmptyResult({ employee, ready }: { employee: AiEmployee; ready: boolean }) {
  const tr = useAiTr(); return <div className="grid min-h-[430px] place-items-center text-center"><div className="max-w-md"><span className="mx-auto grid size-14 place-items-center rounded-full bg-slate-100"><UserRound className="size-6 text-slate-500" /></span><h3 className="mt-4 font-semibold">{tr("Chưa có kết quả đánh giá")}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{ready ? tr("Hồ sơ của {name} đã sẵn sàng. Chọn “Phân tích toàn diện & Đề xuất hành động” để xem kết quả.", { name: employee.fullName }) : tr("Hồ sơ cần được bổ sung trước khi thực hiện đánh giá.")}</p></div></div> }
function useAnimatedScore(score: number, reduceMotion: boolean) {
  const [shown, setShown] = useState(reduceMotion ? score : 0)
  useEffect(() => {
    if (reduceMotion) { setShown(score); return }
    let frame = 0
    const start = performance.now()
    const from = shown
    const animate = (now: number) => { const progress = Math.min(1, (now - start) / 800); setShown(from + (score - from) * (1 - Math.pow(1 - progress, 3))); if (progress < 1) frame = requestAnimationFrame(animate) }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [score, reduceMotion])
  return shown
}

function EngagementStatus({ result, previous, trend, gradient, onReview }: { result: AnalysisResult; previous: AnalysisResult | null; trend: AnalysisResult[]; gradient: string; onReview: () => void }) {
  const tr = useAiTr()
  const score = scoreOf(result), risk = riskPresentation(score), before = previous ? scoreOf(previous) : null, delta = before == null ? null : score - before
  const reduceMotion = useReducedMotion()
  const animatedScore = useAnimatedScore(score, Boolean(reduceMotion))
  const series = useMemo(() => mergeTrend(previous ? [...trend, previous] : trend, result), [trend, result, previous])
  return <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
    <section className="flex min-h-[280px] min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{tr("Điểm nguy cơ gắn kết")}</h3>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${risk.className}`}>{risk.icon}{tr(risk.label)}</span>
      </div>
      <div className="flex flex-1 items-center justify-center pt-4">
        <div className="@container relative w-full max-w-[310px] text-center">
          <svg viewBox="0 0 260 156" className="w-full" role="img" aria-label={tr("Điểm nguy cơ gắn kết {score} phần trăm", { score: score.toFixed(2) })}>
            <defs><linearGradient id={gradient} x1="0" x2="1"><stop stopColor="#F59E0B" /><stop offset=".58" stopColor="#F97316" /><stop offset="1" stopColor="#EA580C" /></linearGradient><filter id={`${gradient}-shadow`}><feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#f97316" floodOpacity=".25" /></filter></defs>
            <path d="M20 132 A110 110 0 0 1 240 132" fill="none" stroke="#f1f5f9" strokeWidth="20" />
            <motion.path key={result.predictionId ?? result.createdAt} d="M20 132 A110 110 0 0 1 240 132" fill="none" stroke={`url(#${gradient})`} strokeWidth="20" strokeLinecap="round" pathLength={1} initial={{ pathLength: reduceMotion ? Math.max(0, Math.min(1, score / 100)) : 0 }} animate={{ pathLength: Math.max(0, Math.min(1, score / 100)) }} transition={{ duration: reduceMotion ? 0 : .8, ease: "easeOut" }} filter={`url(#${gradient}-shadow)`} />
          </svg>
          <strong aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[12%] block text-[clamp(1.75rem,19cqw,3.5rem)] font-black tabular-nums tracking-tight text-slate-900">{animatedScore.toFixed(2)}%</strong>
        </div>
      </div>
    </section>
    <Trajectory result={result} previous={previous} delta={delta} series={series} onReview={onReview} />
  </div>
}
function AssessmentHistory({ employeeId, history, trend, current, previous, busy, onOpen }: {
  employeeId: number; history: AiResultHistoryItem[]; trend: AnalysisResult[]
  current: AnalysisResult | null; previous: AnalysisResult | null; busy: boolean; onOpen: (id: number) => void
}) {
  const tr = useAiTr()
  const scores = new Map<number, number>()
  for (const item of [...trend, previous, current]) {
    if (item?.predictionId != null && item.preview.employee.id === employeeId) scores.set(item.predictionId, scoreOf(item))
  }
  return <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h3 className="font-semibold text-slate-900">{tr("Lịch sử đánh giá")}</h3>
    <p className="mt-1 text-xs text-slate-600">{tr("Chọn một phiên để xem lại đúng dữ liệu đã lưu.")}</p>
    {history.length ? <ul className="mt-3 max-h-[220px] space-y-2 overflow-y-auto overscroll-contain pr-1 motion-safe:scroll-smooth">
      {history.map((item, index) => <AssessmentHistoryRow key={item.predictionId} item={item} employeeId={employeeId}
        knownScore={scores.get(item.predictionId)} loadOnView={index >= 5}
        selected={Boolean(current?.saved && current.predictionId === item.predictionId)}
        busy={busy} onOpen={onOpen} />)}
    </ul> : <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{tr("Chưa có lịch sử đánh giá.")}</p>}
  </section>
}
function AssessmentHistoryRow({ item, employeeId, knownScore, loadOnView, selected, busy, onOpen }: {
  item: AiResultHistoryItem; employeeId: number; knownScore?: number; loadOnView: boolean
  selected: boolean; busy: boolean; onOpen: (id: number) => void
}) {
  const tr = useAiTr()
  const row = useRef<HTMLLIElement>(null)
  const [loadedScore, setLoadedScore] = useState<number>()
  useEffect(() => {
    if (!loadOnView || knownScore !== undefined || loadedScore !== undefined || !row.current || typeof IntersectionObserver === "undefined") return
    const controller = new AbortController()
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return
      observer.disconnect()
      void getAiResult(item.predictionId, controller.signal).then(({ data }) => {
        if (!controller.signal.aborted && data.preview.employee.id === employeeId) setLoadedScore(scoreOf(data as AnalysisResult))
      }).catch(() => {}) // The result can still be opened if inline hydration fails.
    })
    observer.observe(row.current)
    return () => { observer.disconnect(); controller.abort() }
  }, [employeeId, item.predictionId, knownScore, loadedScore, loadOnView])
  const score = knownScore ?? loadedScore
  return <li ref={row}>
    <button type="button" disabled={busy} aria-current={selected || undefined} onClick={() => onOpen(item.predictionId)}
      className={`grid w-full grid-cols-2 items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors hover:border-amber-300 hover:bg-amber-50/50 focus-visible:outline-2 focus-visible:outline-amber-700 sm:grid-cols-[auto_1fr_auto_auto] ${selected ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <strong className="text-slate-900">{tr("Phiên #")}{item.predictionId}</strong>
      <span className="text-xs text-slate-600">{dateTime(item.createdAt)}</span>
      <span className="font-semibold tabular-nums text-slate-800" aria-label={tr("Điểm nguy cơ gắn kết")}>{score !== undefined && Number.isFinite(score) ? `${score.toFixed(2)}%` : "—"}</span>
      <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${selected ? "bg-amber-100 text-amber-900" : "bg-emerald-50 text-emerald-800"}`}>
        {selected ? tr("Phiên hiện tại") : tr("Đã lưu hồ sơ")}
      </span>
    </button>
  </li>
}
function Trajectory({ result, previous, delta, series, onReview }: { result: AnalysisResult; previous: AnalysisResult | null; delta: number | null; series: AnalysisResult[]; onReview: () => void }) {
  const tr = useAiTr()
  return <section className="flex min-h-[280px] min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-orange-50 text-orange-600"><History className="size-4" /></span><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-600">{tr("So với lần đánh giá trước")}</p><h3 className="font-semibold">{tr("Xu hướng rủi ro gắn kết")}</h3></div></div>
    <div className="mt-4 flex flex-1 flex-col justify-center gap-3">
      <div>{delta == null ? <><span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{tr("Phiên đánh giá đầu tiên")}</span><p className="mt-2 text-sm text-slate-600">{tr("Cần thêm một phiên để hình thành xu hướng.")}</p></> : <><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${Math.abs(delta) < .005 ? "bg-slate-100 text-slate-700" : delta > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>{Math.abs(delta) < .005 ? <><Minus className="size-4" />{tr("Giữ mức ổn định")}</> : delta > 0 ? <><TrendingUp className="size-4" />+{Math.abs(delta).toFixed(2)}{tr("% Tăng")}</> : <><TrendingDown className="size-4" />-{Math.abs(delta).toFixed(2)}{tr("% Giảm")}</>}</span><p className="mt-2 text-sm leading-6 text-slate-600">{tr("Mức nguy cơ")} {delta > .005 ? tr("tăng") : delta < -.005 ? tr("giảm") : tr("giữ ổn định")} {tr("so với phiên #")}{previous?.predictionId}.</p></>}</div>
      <TrendSparkline points={series} current={result} />
      {previous ? <Button variant="outline" onClick={onReview} className="h-auto min-h-10 flex-wrap whitespace-normal px-3 py-2 text-xs shadow-sm hover:border-orange-300 hover:text-orange-600"><Eye />{tr("Xem chi tiết phiên #")}{previous.predictionId}<span className="block text-[11px] font-normal text-slate-600">{dateTime(previous.createdAt)}</span></Button> : <span className="text-xs text-slate-600">{tr("Chưa có phiên trước")}</span>}
    </div>
  </section>
}
function TrendSparkline({ points, current }: { points: AnalysisResult[]; current: AnalysisResult }) {
  const tr = useAiTr()
  const values = points.length ? points : [current], scores = values.map(scoreOf), width = 300, height = 92, pad = 12
  const min = Math.min(...scores), max = Math.max(...scores), range = Math.max(max - min, 1)
  const coords = scores.map((score, index) => ({ x: scores.length === 1 ? width / 2 : pad + index * (width - pad * 2) / (scores.length - 1), y: height - pad - (score - (min + max - range) / 2) / range * (height - pad * 2) }))
  const line = coords.map(p => `${p.x},${p.y}`).join(" "), area = `${coords[0].x},${height - pad} ${line} ${coords.at(-1)?.x ?? width - pad},${height - pad}`
  const id = useId().replace(/:/g, "")
  return <div><svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full overflow-visible" role="img" aria-label={tr("Xu hướng các kỳ đánh giá gần nhất")}>
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f97316" stopOpacity=".25" /><stop offset="1" stopColor="#f97316" stopOpacity=".02" /></linearGradient></defs>
    <polygon points={area} fill={`url(#${id})`} /><polyline points={line} fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    {coords.map((p, i) => <circle key={`${values[i].predictionId ?? i}-${p.x}`} cx={p.x} cy={p.y} r={i === coords.length - 1 ? 6 : 5} fill="white" stroke="#f97316" strokeWidth={i === coords.length - 1 ? 3 : 2} tabIndex={0} className="cursor-help focus:outline-none focus:stroke-slate-900"><title>{scores[i].toFixed(2)}% · {dateTime(values[i].createdAt)}</title></circle>)}
  </svg><div className="flex justify-between gap-3 text-xs text-slate-600"><span>{values.length} {tr("kỳ gần nhất")}</span><span className="font-semibold text-orange-700">{tr("Hiện tại")} {scoreOf(current).toFixed(2)}%</span></div></div>
}

function BusinessSignals({ result }: { result: AnalysisResult }) {
  const tr = useAiTr()
  const analysis = result.policyAnalysis
  if (!analysis) return <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">{tr("Chưa có tín hiệu được Agent đối chiếu từ dẫn chứng.")}</p>

  const seenReasons = new Set<string>()
  const findings = analysis.recommendations.filter(item => {
    const reason = item.reason.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi")
    if (seenReasons.has(reason)) return false
    seenReasons.add(reason)
    return true
  })

  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="font-semibold">{tr("Những gì Agent ghi nhận")}</h3>
      {findings.length > 0 ? <div className={`mt-3 grid gap-3 ${findings.length > 1 ? "lg:grid-cols-2" : ""}`}>
        {findings.map(item => <article key={item.policy.id} className="min-w-0 rounded-xl border border-slate-200 p-4">
          <p className="break-words text-sm leading-6 text-slate-800">{item.reason}</p>
          {item.evidence.length > 0 && <div className="mt-4">
            <h4 className="text-sm font-semibold">{tr("Dẫn chứng để đối chiếu")}</h4>
            <div className="mt-2 grid gap-2">{item.evidence.map((evidence, index) =>
              evidence.source?.toUpperCase() === "SURVEY"
                ? <SurveyQuote key={evidence.id ?? index} evidence={evidence} />
                : <EvidenceCard key={evidence.id ?? index} evidence={evidence} />
            )}</div>
          </div>}
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
            <h4 className="font-semibold">{tr("HR cần xác minh")}</h4>
            <p className="break-words">{item.hrVerification}</p>
          </div>
        </article>)}
      </div> : <p className="mt-2 text-sm text-slate-600">{analysis.noRecommendationReason || tr("Chưa có tín hiệu được Agent đối chiếu từ dẫn chứng.")}</p>}
    </section>
  </div>
}
function SurveyQuote({ evidence }: { evidence: AiPolicyEvidence }) {
  const tr = useAiTr()
  const config = evidence.answer_config as { min?: unknown; max?: unknown } | undefined
  const answer = typeof evidence.answer_value === "number" && typeof config?.min === "number" && typeof config.max === "number"
    ? tr("{score}/{max} (thang {min}–{max})", { score: evidence.answer_value, min: config.min, max: config.max })
    : formatValue(evidence.answer_value)
  return <blockquote className="break-words rounded-lg border border-slate-200 border-l-2 border-l-orange-500 p-3 text-sm leading-6 text-slate-700">
    <footer className="text-xs font-medium text-slate-600">{tr("Khảo sát")}{evidence.submitted_at ? ` · ${dateTime(evidence.submitted_at)}` : ""}</footer>
    {evidence.question_text && <p className="mt-1 font-semibold">{evidence.question_text}</p>}
    {answer && <p>{answer}</p>}
    {evidence.comment?.trim() && evidence.comment.trim() !== answer && <p className="mt-1 italic">“{evidence.comment.trim()}”</p>}
  </blockquote>
}
function PreviousSessionModal({ result, onClose }: { result: AnalysisResult; onClose: () => void }) {
  const tr = useAiTr()
  const risk = riskPresentation(scoreOf(result))
  const reduceMotion = useReducedMotion()
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; closeRef.current?.focus(); const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); if (event.key === "Tab") { const dialog = closeRef.current?.closest('[role="dialog"]'); const focusable = dialog?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'); if (!focusable?.length) return; const first = focusable[0], last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() } } }; document.addEventListener("keydown", onKey); return () => { document.removeEventListener("keydown", onKey); previous?.focus() } }, [onClose])
  return <motion.div role="dialog" aria-modal="true" aria-label={tr("Phiên đánh giá #{id}", { id: result.predictionId ?? "—" })} className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : .18 }} onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <motion.section initial={reduceMotion ? false : { opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={reduceMotion ? undefined : { opacity: 0, scale: .96 }} transition={{ duration: reduceMotion ? 0 : .2 }} className="max-h-[88vh] w-full max-w-3xl overflow-auto rounded-2xl border border-white/60 bg-white shadow-2xl">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-600">{tr("Phiên đánh giá trước")}</p><h2 className="mt-1 text-xl font-semibold">{tr("Phiên #")}{result.predictionId} · {dateTime(result.createdAt)}</h2></div><Button ref={closeRef} variant="ghost" size="icon" onClick={onClose} aria-label={tr("Đóng")}><X /></Button></header>
      <div className="space-y-5 p-6"><div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center"><div className="rounded-2xl bg-slate-950 p-5 text-center text-white"><strong className="block text-4xl font-black tabular-nums">{scoreOf(result).toFixed(2)}%</strong><span className="mt-1 block text-xs text-slate-300">{tr("Nguy cơ thôi việc")}</span></div><div><span className={`inline-flex rounded-full border px-3 py-1 text-sm font-bold ${risk.className}`}>{tr(risk.label)}</span><p className="mt-3 text-sm leading-7 text-slate-600">{tr("Phiên đánh giá này cần được đối chiếu cùng bối cảnh nhân sự tại thời điểm thực hiện.")}</p></div></div><div className="grid gap-3 sm:grid-cols-2">{Object.entries(result.preview.features).map(([key, value]) => <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><span className="text-xs text-slate-600">{tr(featureLabel(key))}</span><strong className="mt-1 block text-sm">{displayFeature(key, value, tr)}</strong></div>)}</div></div>
    </motion.section>
  </motion.div>
}

function SatisfactionReading({ value }: { value: unknown }) {
  const tr = useAiTr()
  const satisfaction = typeof value === "number" || (typeof value === "string" && value.trim())
    ? Number(value)
    : NaN
  const hasSatisfaction = Number.isFinite(satisfaction) && satisfaction >= 0 && satisfaction <= 5
  const scoreLabel = hasSatisfaction ? String(satisfaction) : "—"
  const satisfactionLabel = !hasSatisfaction ? "—" : satisfaction >= 4.5 ? tr("Rất tích cực") : satisfaction >= 3 ? tr("Trung bình khá") : satisfaction >= 2 ? tr("Cần lưu ý") : tr("Cần quan tâm")
  return <>
    <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2"><span className="text-2xl font-bold tabular-nums">{hasSatisfaction ? scoreLabel : "—"} <small className="text-sm font-medium text-slate-600">/ 5</small></span><span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{satisfactionLabel}</span></div><div className="mt-3 grid grid-cols-5 gap-1.5"
      role={hasSatisfaction ? "meter" : undefined}
      aria-label={tr("Mức độ hài lòng công việc")}
      aria-valuemin={hasSatisfaction ? 0 : undefined}
      aria-valuemax={hasSatisfaction ? 5 : undefined}
      aria-valuenow={hasSatisfaction ? satisfaction : undefined}
      aria-valuetext={hasSatisfaction ? tr("Mức hài lòng {score} trên 5", { score: scoreLabel }) : undefined}
      aria-hidden={!hasSatisfaction || undefined}>
      {[0, 1, 2, 3, 4].map(segment => {
        const fill = hasSatisfaction ? Math.max(0, Math.min(1, satisfaction - segment)) * 100 : 0
        return <span key={segment} className="h-2 overflow-hidden rounded-full bg-slate-200">
          <span className="block h-full w-full bg-linear-to-r from-amber-400 via-amber-500 to-orange-600"
            style={{ backgroundSize: "500% 100%", backgroundPosition: `${segment * 25}% center`, clipPath: `inset(0 ${100 - fill}% 0 0)` }} />
        </span>
      })}
    </div>
  </>
}


function ProfileContext({ snapshot }: { snapshot: AiSnapshot | AnalysisResult["preview"] | null }) {
  const tr = useAiTr()
  const f = snapshot?.features ?? {}, overtime = Number(f.Overtime_Hours)
  const groups = [{ title: tr("Thời gian làm việc & Tăng ca"), keys: ["Work_Hours_Per_Week", "Overtime_Hours", "Sick_Days"] }, { title: tr("Hồ sơ & Hợp đồng"), keys: ["Monthly_Salary", "Department", "Years_At_Company", "Hire_Date", "Education_Level", "Age", "Gender", "Promotions"] }]
  return <section className={`${card} p-5`}><h3 className="font-semibold">{tr("Dữ liệu hồ sơ đang dùng")}</h3>{snapshot ? <div className="mt-4 space-y-4">
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">{tr("Sức khỏe & Gắn kết")}</h4><p className="mt-2 text-sm font-medium text-slate-700">{tr("Mức độ hài lòng công việc")}</p><SatisfactionReading value={f.Employee_Satisfaction_Score} /></section>
    {groups.map(group => <section key={group.title} className="rounded-xl border border-slate-200 bg-white p-4"><h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">{group.title}</h4><div className="mt-2 grid grid-cols-2 gap-x-4">{group.keys.map(key => <div key={key} className="min-w-0 border-b border-slate-100 py-2.5"><p className="text-xs text-slate-600">{tr(featureLabel(key))}</p><p className="mt-1 break-words text-sm font-semibold text-slate-900">{f[key] === undefined || f[key] === null || f[key] === "" ? "—" : displayFeature(key, f[key], tr)}</p>{key === "Overtime_Hours" && Number.isFinite(overtime) && overtime > 30 && <span className="mt-1 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">{tr("Cần đối soát")}</span>}</div>)}</div></section>)}
  </div> : <p className="mt-4 text-sm text-slate-600">{tr("Đang nạp hồ sơ nhân viên…")}</p>}</section>
}

function mergeTrend(history: AnalysisResult[], current: AnalysisResult) {
  const timeOf = (item: AnalysisResult) => Date.parse(item.createdAt ?? item.preview.capturedAt)
  const currentTime = timeOf(current)
  const earlier = new Map<number, AnalysisResult>()
  for (const item of history) {
    if (item.predictionId == null || item.predictionId === current.predictionId) continue
    const time = timeOf(item)
    if (current.saved && (time > currentTime || (time === currentTime && item.predictionId > (current.predictionId ?? Infinity)))) continue
    earlier.set(item.predictionId, item)
  }
  return [...[...earlier.values()].sort((a, b) => timeOf(a) - timeOf(b)).slice(-4), current]
}
function riskPresentation(score: number) {
  if (score > 20) return { label: "Nguy cơ cao", className: "border-rose-200 bg-rose-50 text-rose-700", icon: <AlertTriangle className="size-3.5" aria-hidden="true" /> }
  if (score >= 10) return { label: "Cần lưu ý", className: "border-amber-200 bg-amber-50 text-amber-800", icon: <AlertTriangle className="size-3.5" aria-hidden="true" /> }
  return { label: "Ổn định", className: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: <Check className="size-3.5" aria-hidden="true" /> }
}
type AiTr = ReturnType<typeof useAiTr>
function displayFeature(key: string, value: unknown, tr: AiTr) {
  if (value === undefined || value === null || value === "") return tr("Chưa cập nhật")
  if (key === "Gender") return ({ Male: tr("Nam"), Female: tr("Nữ"), Other: tr("Khác") } as Record<string, string>)[String(value)] ?? String(value)
  if (key === "Education_Level") return ({ Bachelor: tr("Đại học"), Master: tr("Thạc sĩ"), PhD: tr("Tiến sĩ"), "High School": tr("Trung học phổ thông") } as Record<string, string>)[String(value)] ?? String(value)
  if (key === "Hire_Date") return String(value).split("-").reverse().join("/")
  const units: Record<string, string> = { Monthly_Salary: ` ${tr("USD/tháng")}`, Age: ` ${tr("tuổi")}`, Years_At_Company: ` ${tr("năm")}`, Overtime_Hours: ` ${tr("giờ")}`, Work_Hours_Per_Week: ` ${tr("giờ/tuần")}`, Sick_Days: ` ${tr("ngày")}`, Promotions: ` ${tr("lần")}`, Employee_Satisfaction_Score: " / 5" }
  const shown = typeof value === "number" ? value.toLocaleString("vi-VN", { maximumFractionDigits: 2 }) : String(value)
  return `${shown}${units[key] ?? ""}`
}
function formatValue(value: unknown): string { if (value === undefined || value === null || value === "") return ""; if (Array.isArray(value)) return value.map(formatValue).join(", "); if (typeof value === "object") return Object.values(value as Record<string,unknown>).map(formatValue).filter(Boolean).join(" · "); return String(value) }
