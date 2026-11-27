import { useAiTr } from "./aiWorkspaceLanguage"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { AlertTriangle, ArrowLeft, Building2, CalendarDays, Check, ChevronRight, Clock3, Eye, HeartHandshake, History, Loader2, Minus, ShieldCheck, Sparkles, TrendingDown, TrendingUp, UserRound, X } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Button } from "../ui/button"
import { SelectControl } from "../ui/select-control"
import { ApiError, analyzeAiEmployee, getAiResult, listAiEmployeeResults, listAiSnapshots, previewAiEmployee, type AiEmployee, type AiPolicyEvidence, type AiPrediction, type AiResultHistoryItem, type AiSnapshot } from "../../services/api"
import { featureLabel } from "./analysis"
import { ActionDossier } from "./ActionDossier"
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
<div className="flex flex-wrap items-center gap-3 p-5"><Button variant="outline" disabled={busy} onClick={onBack}><ArrowLeft />{tr("Đổi nhân sự")}</Button><span className="grid size-11 place-items-center rounded-full bg-indigo-50 font-bold text-indigo-700">{initials(employee.fullName)}</span><div className="min-w-0"><h2 className="text-lg font-semibold tracking-tight">{employee.fullName}</h2><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className="font-mono">{employee.employeeCode}</span><span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-indigo-700">{employee.departmentName || tr("Chưa cập nhật phòng ban")}</span><span>{employee.positionName || tr("Chưa cập nhật chức danh")}</span></div></div><label className="ml-auto min-w-[250px] text-xs font-medium text-slate-500">{tr("Chuyển nhanh nhân viên")}<SelectControl aria-label={tr("Chuyển nhanh nhân viên")} className="field mt-1 h-10" disabled={busy} value={employee.id} onChange={event => onChoose(Number(event.target.value))}>{employees.map(item => <option key={item.id} value={item.id}>{item.employeeCode} · {item.fullName}</option>)}</SelectControl></label></div>
      <div className="grid gap-3 border-t border-slate-100 bg-slate-50/60 p-4 xl:grid-cols-[minmax(260px,1fr)_auto_auto] xl:items-end"><div><p className="text-xs font-semibold text-slate-500">{tr("Khoảng thời gian đối soát")}</p><div className="mt-1 flex items-center gap-2"><input aria-label={tr("Từ ngày")} type="date" max={today()} className="field h-10 px-3" disabled={busy} value={from} onChange={event => setFrom(event.target.value)} /><ChevronRight className="size-4 shrink-0 text-slate-400" /><input aria-label={tr("Đến ngày")} type="date" max={today()} className="field h-10 px-3" disabled={busy} value={to} onChange={event => setTo(event.target.value)} /></div></div><button type="button" role="switch" aria-checked={save} disabled={busy} onClick={() => setSave(value => !value)} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium"><span className={`relative h-5 w-9 rounded-full transition ${save ? "bg-orange-500" : "bg-slate-300"}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white transition ${save ? "left-[18px]" : "left-0.5"}`} /></span>{save ? tr("Sẽ lưu kết quả đầy đủ") : tr("Chỉ xem kết quả")}</button><div className="space-y-2"><Button type="button" disabled={busy || !profile?.ready} onClick={handleRunFullAnalysis} aria-describedby="assessment-data-notice" className="h-auto min-h-10 whitespace-normal bg-gradient-to-r from-orange-600 to-amber-600 px-4 py-2 text-white shadow-md shadow-orange-500/25">{analyzing ? <Loader2 className="motion-safe:animate-spin" /> : <Sparkles />}{analyzing ? tr("Đang phân tích dữ liệu…") : tr("Phân tích toàn diện & Đề xuất hành động")}</Button><p id="assessment-data-notice" className="max-w-sm text-xs leading-5 text-slate-600">{tr("Khi bấm nút, bạn đồng ý gửi dữ liệu chấm công và khảo sát trong kỳ đã chọn tới dịch vụ phân tích để tạo đề xuất.")}</p></div></div>
      {!busy && profile && !profile.ready && <div className="border-t border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900"><strong>{tr("Hồ sơ chưa đủ điều kiện đánh giá.")}</strong> {tr("Cần bổ sung:")} {[...(profile.missingFeatures ?? []), ...(profile.invalidFeatures ?? [])].map(key => tr(featureLabel(key))).join(", ") || tr("thông tin hồ sơ bắt buộc")}.</div>}
    </section>
    {error && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{tr(error)}</p>}
    {busy && !analyzing && <p role="status" className="text-sm text-slate-600">{tr("Đang tải hồ sơ nhân sự…")}</p>}
    {notice && <p role="status" className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{tr(notice)}</p>}
    <div className="grid grid-cols-12 items-start gap-6"><section className={`${card} col-span-12 min-w-0 p-5 xl:col-span-8`}>
      {result && <div className="mb-4 flex flex-wrap items-center gap-2 text-sm"><span className={`rounded-full px-3 py-1 font-medium ${result.saved ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>{result.saved ? tr("Đã lưu hồ sơ · Phiên #{id}", { id: result.predictionId ?? "—" }) : tr("Kết quả phân tích · Chưa lưu")}</span>{result.saved && <span className="text-slate-500">{tr(dateTime(result.createdAt))}</span>}<span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{tr("Cần Nhân sự xác minh")}</span></div>}
      <div role="tablist" aria-label={tr("Các phần đánh giá gắn kết")} className="mb-5 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1" onKeyDown={event => { if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return; event.preventDefault(); const next = (tab + (event.key === "ArrowRight" ? 1 : 2)) % 3; setTab(next); (event.currentTarget.querySelectorAll('[role="tab"]')[next] as HTMLButtonElement)?.focus() }}>{[tr("Tình trạng gắn kết"), tr("Nguyên nhân & Tín hiệu"), tr("Kế hoạch hành động")].map((label, index) => <button type="button" role="tab" aria-controls="engagement-tab-panel" aria-selected={tab === index} tabIndex={tab === index ? 0 : -1} key={label} onClick={() => setTab(index)} className={`relative min-h-10 rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 ${tab === index ? "text-slate-900" : "text-slate-600 hover:text-orange-700"}`}>{tab === index && <motion.span layoutId="activeTabBadge" className="absolute inset-0 rounded-lg border border-slate-200 bg-white shadow-sm" transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }} />}<span className="relative z-10">{index + 1}. {label}</span></button>)}</div>
      <AnimatePresence mode="wait" initial={false}><motion.div id="engagement-tab-panel" role="tabpanel" key={`${tab}-${result?.predictionId ?? "empty"}`} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -8 }} transition={{ duration: reduceMotion ? 0 : .2 }}>{!result ? <EmptyResult employee={employee} ready={Boolean(profile?.ready)} /> : tab === 0 ? <EngagementStatus result={result} previous={previous} trend={trend} gradient={gradient} onReview={() => setReviewing(previous)} /> : tab === 1 ? <BusinessSignals result={result} /> : result.policyAnalysis ? <ActionDossier analysis={result.policyAnalysis} /> : <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-600">{tr("Phiên này chưa có kế hoạch hành động được lưu.")}</div>}</motion.div></AnimatePresence>
    </section><aside className="col-span-12 min-w-0 space-y-5 xl:sticky xl:top-4 xl:col-span-4"><ProfileContext snapshot={result?.preview ?? profile} /><section className={`${card} p-5`}><h3 className="font-semibold">{tr("Lịch sử đánh giá")}</h3><p className="mt-1 text-xs text-slate-500">{tr("Chọn một phiên để xem lại đúng dữ liệu đã lưu.")}</p><div className="mt-3 max-h-72 space-y-2 overflow-auto">{history.map(item => <button type="button" disabled={busy} onClick={() => openHistory(item.predictionId)} key={item.predictionId} className={`block w-full rounded-xl border p-3 text-left text-sm transition hover:border-orange-200 hover:bg-orange-50/50 ${result?.predictionId === item.predictionId ? "border-orange-300 bg-orange-50" : "border-slate-200"}`}><strong>{tr("Phiên #")}{item.predictionId}</strong><span className="mt-0.5 block text-xs text-slate-500">{dateTime(item.createdAt)}</span></button>)}{!history.length && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">{tr("Chưa có lịch sử đánh giá.")}</p>}</div></section></aside></div>
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
  const score = scoreOf(result), risk = riskPresentation(result.model.riskLevel, result.model.assessment?.status), before = previous ? scoreOf(previous) : null, delta = before == null ? null : score - before
  const reduceMotion = useReducedMotion()
  const animatedScore = useAnimatedScore(score, Boolean(reduceMotion))
  const rawThreshold = result.model.assessment?.thresholdPoints ?? result.model.assessment?.threshold ?? 9.9
  const threshold = rawThreshold <= 1 ? rawThreshold * 100 : rawThreshold
  const thresholdDelta = score - threshold
  const thresholdAngle = Math.PI * (1 - Math.max(0, Math.min(100, threshold)) / 100)
  const tick = { x: 120 + 96 * Math.cos(thresholdAngle), y: 124 - 96 * Math.sin(thresholdAngle) }
  const series = useMemo(() => mergeTrend(trend, result), [trend, result])
  return <div className="space-y-4">
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-6 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,.11),transparent_44%)] p-6 md:grid-cols-[minmax(260px,340px)_1fr] md:items-center lg:gap-8">
        <div className="relative mx-auto w-full max-w-[330px] pb-3">
          <svg viewBox="0 0 240 150" className="w-full" aria-label={tr("Điểm nguy cơ gắn kết {score} phần trăm", { score: score.toFixed(2) })}>
            <defs><linearGradient id={gradient} x1="0" x2="1"><stop stopColor="#F59E0B" /><stop offset=".58" stopColor="#F97316" /><stop offset="1" stopColor="#EA580C" /></linearGradient><filter id={`${gradient}-shadow`}><feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#f97316" floodOpacity=".25" /></filter></defs>
            <path d="M24 124 A96 96 0 0 1 216 124" fill="none" stroke="#f1f5f9" strokeWidth="16" />
            <motion.path key={result.predictionId ?? result.createdAt} d="M24 124 A96 96 0 0 1 216 124" fill="none" stroke={`url(#${gradient})`} strokeWidth="16" strokeLinecap="round" pathLength={1} initial={{ pathLength: reduceMotion ? Math.max(0, Math.min(1, score / 100)) : 0 }} animate={{ pathLength: Math.max(0, Math.min(1, score / 100)) }} transition={{ duration: reduceMotion ? 0 : .8, ease: "easeOut" }} filter={`url(#${gradient}-shadow)`} />
            <circle cx={tick.x} cy={tick.y} r="5" fill="white" stroke="#92400e" strokeWidth="2" strokeDasharray="2 1" />
          </svg>
          <div className="pointer-events-none absolute inset-x-0 bottom-5 text-center"><strong className="block text-5xl font-black tracking-tight tabular-nums text-slate-900 lg:text-6xl">{animatedScore.toFixed(2)}%</strong><span className="mt-1 block text-xs font-semibold uppercase tracking-wider text-slate-600">{tr("Điểm nguy cơ gắn kết")}</span><span className="mt-1 block text-xs font-medium text-amber-800">{tr("Ngưỡng")} {threshold.toFixed(2)}%</span></div>
        </div>
        <div className="space-y-3 rounded-2xl border border-slate-200/60 bg-slate-50/70 p-5">
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-400">{tr("Nhận định & đối chiếu ngưỡng")}</p><span className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${risk.className}`}>{risk.icon}{tr(risk.label)}</span></div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200/50 bg-white/80 p-2.5 text-xs text-slate-600"><div><span className="text-slate-400">{tr("Ngưỡng cảnh báo:")}</span>{" "}<strong className="font-mono text-slate-800">{threshold.toFixed(2)}%</strong></div><div className="hidden h-3 w-px bg-slate-200 sm:block" /><div className={`font-medium ${thresholdDelta > 0 ? "text-amber-800" : "text-emerald-700"}`}>{thresholdDelta > 0 ? tr("Vượt ngưỡng") : tr("Dưới ngưỡng")}: <strong className={`font-mono ${thresholdDelta > 0 ? "text-amber-900" : "text-emerald-800"}`}>{thresholdDelta > 0 ? "+" : ""}{thresholdDelta.toFixed(2)}%</strong></div></div>
          <p className="text-sm leading-7 text-slate-700">{thresholdDelta > 0 ? tr("Điểm rủi ro đã vượt ngưỡng cảnh báo. Khuyến nghị HR rà soát dữ liệu làm thêm giờ và các phản hồi khảo sát gần nhất.") : tr("Điểm số hiện nằm dưới ngưỡng cảnh báo. HR nên tiếp tục theo dõi định kỳ và đối chiếu khi dữ liệu nhân sự thay đổi.")}</p>
          <p className="text-xs text-slate-500">{tr("Kết quả hỗ trợ tham khảo · Quyết định cuối cùng thuộc về Nhân sự.")}</p>
        </div>
      </div>
    </section>
    <Trajectory result={result} previous={previous} delta={delta} series={series} threshold={threshold} onReview={onReview} />
  </div>
}
function Trajectory({ result, previous, delta, series, threshold, onReview }: { result: AnalysisResult; previous: AnalysisResult | null; delta: number | null; series: AnalysisResult[]; threshold: number; onReview: () => void }) {
  const tr = useAiTr()
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-orange-50 text-orange-600"><History className="size-4" /></span><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-600">{tr("So với lần đánh giá trước")}</p><h3 className="font-semibold">{tr("Xu hướng rủi ro gắn kết")}</h3></div></div>
    <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(180px,.8fr)_minmax(230px,1fr)_auto] lg:items-center">
      <div>{delta == null ? <><span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{tr("Phiên đánh giá đầu tiên")}</span><p className="mt-2 text-sm text-slate-600">{tr("Cần thêm một phiên để hình thành xu hướng.")}</p></> : <><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${Math.abs(delta) < .005 ? "bg-slate-100 text-slate-700" : delta > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>{Math.abs(delta) < .005 ? <><Minus className="size-4" />{tr("Giữ mức ổn định")}</> : delta > 0 ? <><TrendingUp className="size-4" />+{Math.abs(delta).toFixed(2)}{tr("% Tăng")}</> : <><TrendingDown className="size-4" />-{Math.abs(delta).toFixed(2)}{tr("% Giảm")}</>}</span><p className="mt-2 text-sm leading-6 text-slate-600">{tr("Mức nguy cơ")} {delta > .005 ? tr("tăng") : delta < -.005 ? tr("giảm") : tr("giữ ổn định")} {tr("so với phiên #")}{previous?.predictionId}.</p></>}</div>
      <TrendSparkline points={series} current={result} threshold={threshold} />
      {previous ? <Button variant="outline" onClick={onReview} className="h-auto min-h-10 whitespace-normal px-3 py-2 text-xs shadow-sm hover:border-orange-300 hover:text-orange-600"><Eye />{tr("Xem chi tiết phiên #")}{previous.predictionId}<span className="block text-[11px] font-normal text-slate-600">{dateTime(previous.createdAt)}</span></Button> : <span className="text-xs text-slate-600">{tr("Chưa có phiên trước")}</span>}
    </div>
  </section>
}
function TrendSparkline({ points, current, threshold }: { points: AnalysisResult[]; current: AnalysisResult; threshold: number }) {
  const tr = useAiTr()
  const values = points.length ? points : [current], scores = values.map(scoreOf), width = 300, height = 92, pad = 12
  const min = Math.min(...scores, threshold), max = Math.max(...scores, threshold), range = Math.max(max - min, 1)
  const coords = scores.map((score, index) => ({ x: scores.length === 1 ? width / 2 : pad + index * (width - pad * 2) / (scores.length - 1), y: height - pad - (score - min) / range * (height - pad * 2) }))
  const line = coords.map(p => `${p.x},${p.y}`).join(" "), area = `${coords[0].x},${height - pad} ${line} ${coords.at(-1)?.x ?? width - pad},${height - pad}`
  const thresholdY = height - pad - (threshold - min) / range * (height - pad * 2)
  const id = useId().replace(/:/g, "")
  return <div><svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full overflow-visible" role="img" aria-label={tr("Xu hướng các kỳ đánh giá gần nhất, ngưỡng cảnh báo {threshold} phần trăm", { threshold: threshold.toFixed(2) })}>
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f97316" stopOpacity=".25" /><stop offset="1" stopColor="#f97316" stopOpacity=".02" /></linearGradient></defs>
    <line x1={pad} y1={thresholdY} x2={width - pad} y2={thresholdY} stroke="#b45309" strokeWidth="1" strokeDasharray="4 4" />
    <polygon points={area} fill={`url(#${id})`} /><polyline points={line} fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    {coords.map((p, i) => <circle key={`${values[i].predictionId ?? i}-${p.x}`} cx={p.x} cy={p.y} r={i === coords.length - 1 ? 6 : 5} fill="white" stroke="#f97316" strokeWidth={i === coords.length - 1 ? 3 : 2} tabIndex={0} className="cursor-help focus:outline-none focus:stroke-slate-900"><title>{scores[i].toFixed(2)}% · {dateTime(values[i].createdAt)}</title></circle>)}
  </svg><div className="flex justify-between gap-3 text-xs text-slate-600"><span>{values.length} {tr("kỳ gần nhất · Ngưỡng")} {threshold.toFixed(2)}%</span><span className="font-semibold text-orange-700">{tr("Hiện tại")} {scoreOf(current).toFixed(2)}%</span></div></div>
}

function BusinessSignals({ result }: { result: AnalysisResult }) {
  const tr = useAiTr()
  const ordered = Object.entries(result.model.contributions ?? {}).filter(([key, value]) => !["Age", "Gender"].includes(key) && Number.isFinite(value) && result.preview.features[key] != null && result.preview.features[key] !== "").sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  const risks = ordered.filter(([, value]) => value > 0).slice(0, 3), anchors = ordered.filter(([, value]) => value < 0).slice(0, 3)
  const survey = result.policyAnalysis?.recommendations.flatMap(item => item.evidence).filter(item => String(item.source).toUpperCase() === "SURVEY").slice(0, 2) ?? []
  return <div className="space-y-5">
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-slate-600" />{tr("Các tín hiệu được diễn giải từ hồ sơ, dữ liệu làm việc và phản hồi khảo sát đang có. Nhân sự cần trao đổi trực tiếp trước khi đưa ra quyết định.")}</div>
    <div className="grid gap-4 md:grid-cols-2">
      <SignalGroup title={tr("Tín hiệu rủi ro cần lưu ý")} description={tr("Những thông tin nên được đối soát trong buổi trao đổi tiếp theo")} tone="risk" items={risks} features={result.preview.features} />
      <SignalGroup title={tr("Điểm tựa giữ chân")} description={tr("Những yếu tố tích cực nên tiếp tục duy trì")} tone="anchor" items={anchors} features={result.preview.features} />
    </div>
    {survey.length > 0 && <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5"><h3 className="font-semibold">{tr("Phản hồi gần đây của nhân viên")}</h3><div className="mt-3 grid gap-3">{survey.map((item, index) => <SurveyQuote key={String(item.id ?? index)} evidence={item} />)}</div></section>}
  </div>
}
function SignalGroup({ title, description, tone, items, features }: { title: string; description: string; tone: "risk" | "anchor"; items: Array<[string, number]>; features: Record<string, string | number> }) {
  const tr = useAiTr()
  const reduceMotion = useReducedMotion()
  return <section className={`rounded-2xl border p-5 ${tone === "risk" ? "border-amber-200/80 bg-amber-50/20" : "border-emerald-200/80 bg-emerald-50/25"}`}>
    <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className={`grid size-10 place-items-center rounded-xl ${tone === "risk" ? "bg-orange-100 text-orange-600" : "bg-emerald-100 text-emerald-700"}`}>{tone === "risk" ? <AlertTriangle className="size-5" /> : <ShieldCheck className="size-5" />}</span><div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-slate-600">{description}</p></div></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone === "risk" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{items.length} {tr("tín hiệu")}</span></div>
    {items.length ? <motion.div className="mt-4 grid gap-3" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: reduceMotion ? 0 : .06 } } }}>{items.map(([key]) => <motion.article key={key} variants={{ hidden: { opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 12 }, show: { opacity: 1, y: 0 } }} transition={{ duration: reduceMotion ? 0 : .22 }} className={`rounded-xl border p-4 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0 ${tone === "risk" ? "border-rose-200/70 border-l-4 border-l-rose-500 bg-rose-50/40" : "border-emerald-200/70 border-l-4 border-l-emerald-500 bg-emerald-50/40"}`}><div className="flex items-center gap-3"><span className={`grid size-10 place-items-center rounded-xl ${tone === "risk" ? "bg-orange-100 text-orange-600" : "bg-emerald-100 text-emerald-700"}`}><SignalIcon feature={key} /></span><div><p className="font-semibold">{tr(featureLabel(key))}</p><p className="text-xs font-medium text-slate-600">{displayFeature(key, features[key], tr)}</p></div></div><p className="mt-3 text-sm leading-6 text-slate-600">{signalText(key, features[key], tone, tr)}</p></motion.article>)}</motion.div> : <p className="mt-4 rounded-xl bg-white p-4 text-sm text-slate-600">{tr("Chưa ghi nhận tín hiệu phù hợp trong nhóm này.")}</p>}
  </section>
}
function SignalIcon({ feature }: { feature: string }) { if (/Overtime|Work_Hours/.test(feature)) return <Clock3 className="size-5" />; if (/Hire_Date|Years/.test(feature)) return <CalendarDays className="size-5" />; if (/Department/.test(feature)) return <Building2 className="size-5" />; if (/Satisfaction/.test(feature)) return <HeartHandshake className="size-5" />; return <Sparkles className="size-5" /> }
function SurveyQuote({ evidence }: { evidence: AiPolicyEvidence }) {
  const tr = useAiTr(); const answer = evidence.answer_value ?? evidence.comment; return <blockquote className="relative overflow-hidden rounded-xl border border-slate-200 border-l-4 border-l-orange-500 bg-white p-5 shadow-sm"><span className="absolute right-4 top-1 text-5xl font-black leading-none text-orange-100">“</span>{evidence.question_text && <span className="relative block pr-8 text-sm font-semibold leading-6 text-slate-700">{evidence.question_text}</span>}<p className="relative mt-2 text-sm italic leading-7 text-slate-700">“{formatValue(answer) || tr("Chưa có nội dung phản hồi dạng văn bản.")}”</p><footer className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs not-italic text-slate-500">{tr("Khảo sát")}{evidence.survey_id ? ` #${evidence.survey_id}` : ""}{evidence.submitted_at ? ` · ${dateTime(evidence.submitted_at)}` : ""}</footer></blockquote> }

function PreviousSessionModal({ result, onClose }: { result: AnalysisResult; onClose: () => void }) {
  const tr = useAiTr()
  const risk = riskPresentation(result.model.riskLevel, result.model.assessment?.status)
  const reduceMotion = useReducedMotion()
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; closeRef.current?.focus(); const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); if (event.key === "Tab") { const dialog = closeRef.current?.closest('[role="dialog"]'); const focusable = dialog?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'); if (!focusable?.length) return; const first = focusable[0], last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() } } }; document.addEventListener("keydown", onKey); return () => { document.removeEventListener("keydown", onKey); previous?.focus() } }, [onClose])
  return <motion.div role="dialog" aria-modal="true" aria-label={tr("Phiên đánh giá #{id}", { id: result.predictionId ?? "—" })} className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : .18 }} onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <motion.section initial={reduceMotion ? false : { opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={reduceMotion ? undefined : { opacity: 0, scale: .96 }} transition={{ duration: reduceMotion ? 0 : .2 }} className="max-h-[88vh] w-full max-w-3xl overflow-auto rounded-2xl border border-white/60 bg-white shadow-2xl">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-600">{tr("Phiên đánh giá trước")}</p><h2 className="mt-1 text-xl font-semibold">{tr("Phiên #")}{result.predictionId} · {dateTime(result.createdAt)}</h2></div><Button ref={closeRef} variant="ghost" size="icon" onClick={onClose} aria-label={tr("Đóng")}><X /></Button></header>
      <div className="space-y-5 p-6"><div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center"><div className="rounded-2xl bg-slate-950 p-5 text-center text-white"><strong className="block text-4xl font-black tabular-nums">{scoreOf(result).toFixed(2)}%</strong><span className="mt-1 block text-xs text-slate-300">{tr("Nguy cơ thôi việc")}</span></div><div><span className={`inline-flex rounded-full border px-3 py-1 text-sm font-bold ${risk.className}`}>{tr(risk.label)}</span><p className="mt-3 text-sm leading-7 text-slate-600">{result.model.assessment?.explanation || tr("Phiên đánh giá này cần được đối chiếu cùng bối cảnh nhân sự tại thời điểm thực hiện.")}</p></div></div><div className="grid gap-3 sm:grid-cols-2">{Object.entries(result.preview.features).map(([key, value]) => <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><span className="text-xs text-slate-600">{tr(featureLabel(key))}</span><strong className="mt-1 block text-sm">{displayFeature(key, value, tr)}</strong></div>)}</div></div>
    </motion.section>
  </motion.div>
}
function ProfileContext({ snapshot }: { snapshot: AiSnapshot | AnalysisResult["preview"] | null }) {
  const tr = useAiTr()
  const f = snapshot?.features ?? {}, satisfaction = Number(f.Employee_Satisfaction_Score), overtime = Number(f.Overtime_Hours)
  const activeSegments = Number.isFinite(satisfaction) ? Math.max(0, Math.min(5, Math.round(satisfaction))) : 0
  const satisfactionLabel = !Number.isFinite(satisfaction) ? "—" : satisfaction >= 4.5 ? tr("Rất tích cực") : satisfaction >= 3 ? tr("Trung bình khá") : satisfaction >= 2 ? tr("Cần lưu ý") : tr("Cần quan tâm")
  const groups = [{ title: tr("Thời gian làm việc & Tăng ca"), keys: ["Work_Hours_Per_Week", "Overtime_Hours", "Sick_Days"] }, { title: tr("Hồ sơ & Hợp đồng"), keys: ["Monthly_Salary", "Department", "Years_At_Company", "Hire_Date", "Education_Level", "Age", "Gender", "Promotions"] }]
  return <section className={`${card} p-5`}><h3 className="font-semibold">{tr("Dữ liệu hồ sơ đang dùng")}</h3>{snapshot ? <div className="mt-4 space-y-4">
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">{tr("Sức khỏe & Gắn kết")}</h4><p className="mt-2 text-sm font-medium text-slate-700">{tr("Mức độ hài lòng công việc")}</p><div className="mt-1 flex items-baseline justify-between gap-2"><span className="text-2xl font-bold tabular-nums">{Number.isFinite(satisfaction) ? satisfaction.toFixed(1) : "—"} <small className="text-sm font-medium text-slate-600">/ 5</small></span><span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{satisfactionLabel}</span></div><div className="mt-3 grid grid-cols-5 gap-1.5" aria-label={tr("Mức hài lòng {score} trên 5", { score: Number.isFinite(satisfaction) ? satisfaction.toFixed(1) : tr("chưa có") })}>{[1, 2, 3, 4, 5].map(segment => <span key={segment} className={`h-2 rounded-full transition-colors duration-300 ${segment <= activeSegments ? segment < 3 ? "bg-amber-400" : "bg-orange-500" : "bg-slate-200"}`} />)}</div></section>
    {groups.map(group => <section key={group.title} className="rounded-xl border border-slate-200 bg-white p-4"><h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">{group.title}</h4><div className="mt-2 grid grid-cols-2 gap-x-4">{group.keys.map(key => <div key={key} className="min-w-0 border-b border-slate-100 py-2.5"><p className="text-xs text-slate-600">{tr(featureLabel(key))}</p><p className="mt-1 break-words text-sm font-semibold text-slate-900">{f[key] === undefined || f[key] === null || f[key] === "" ? "—" : displayFeature(key, f[key], tr)}</p>{key === "Overtime_Hours" && Number.isFinite(overtime) && overtime > 30 && <span className="mt-1 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">{tr("Cần đối soát")}</span>}</div>)}</div></section>)}
  </div> : <p className="mt-4 text-sm text-slate-600">{tr("Đang nạp hồ sơ nhân viên…")}</p>}</section>
}

function mergeTrend(history: AnalysisResult[], current: AnalysisResult) { const values = [...history]; if (!values.some(item => item.predictionId && item.predictionId === current.predictionId)) values.push(current); return values.sort((a, b) => Date.parse(a.createdAt ?? a.preview.capturedAt) - Date.parse(b.createdAt ?? b.preview.capturedAt)).slice(-5) }
function riskPresentation(level?: string | null, status?: string) { const value = (level ?? "").toLowerCase(); if (/high|cao/.test(value)) return { label: "Nguy cơ cao · Cần can thiệp", className: "border-rose-200 bg-rose-50 text-rose-700", icon: <AlertTriangle className="size-4" /> }; if (/medium|trung/.test(value) || status === "REVIEW_REQUIRED") return { label: "Cần lưu ý", className: "border-amber-300 bg-amber-50 text-amber-900", icon: <AlertTriangle className="size-4" /> }; return { label: "Nguy cơ thấp", className: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: <Check className="size-4" /> } }
type AiTr = ReturnType<typeof useAiTr>
function signalText(key: string, value: unknown, tone: "risk" | "anchor", tr: AiTr) {
  const shown = displayFeature(key, value, tr)
  const risk: Record<string, string> = {
    Overtime_Hours: tr("Hồ sơ ghi nhận {value}. Nhân sự nên làm rõ thời điểm phát sinh, tải công việc và khả năng bố trí nghỉ bù.", { value: shown }),
    Work_Hours_Per_Week: tr("Thời lượng làm việc hiện được ghi nhận là {value}. Cần đối chiếu với lịch làm việc đã thống nhất.", { value: shown }),
    Employee_Satisfaction_Score: tr("Mức hài lòng gần nhất là {value}. Nên trao đổi riêng để xác định trải nghiệm cần cải thiện.", { value: shown }),
    Sick_Days: tr("Hồ sơ ghi nhận {value}. Cần xác minh loại nghỉ và nhu cầu hỗ trợ khi trở lại công việc.", { value: shown }),
    Monthly_Salary: tr("Thu nhập hiện được ghi nhận ở mức {value}. Cần đối chiếu với cấp bậc và phạm vi trách nhiệm.", { value: shown }),
    Promotions: tr("Hồ sơ ghi nhận {value}. Cần kết hợp nguyện vọng phát triển và các cam kết nghề nghiệp đang có.", { value: shown }),
  }
  const anchor: Record<string, string> = {
    Years_At_Company: tr("Thâm niên hiện tại là {value}, cho thấy mức độ ổn định cần tiếp tục được phát huy.", { value: shown }),
    Department: tr("Nhân viên hiện làm việc tại {value}. Tiếp tục duy trì đầu mối phối hợp và hỗ trợ trong phòng ban.", { value: shown }),
    Work_Hours_Per_Week: tr("Lịch làm việc {value} đang là một điểm ổn định cần tiếp tục duy trì.", { value: shown }),
    Education_Level: tr("Nền tảng học vấn {value} đang hỗ trợ vai trò hiện tại.", { value: shown }),
    Monthly_Salary: tr("Mức thu nhập {value} đang đóng vai trò là một điểm tựa cần tiếp tục rà soát theo chu kỳ.", { value: shown }),
  }
  return (tone === "risk" ? risk[key] : anchor[key]) ?? tr("{feature} hiện được ghi nhận là {value}. {guidance}", {
    feature: tr(featureLabel(key)), value: shown, guidance: tr(tone === "risk" ? "Nhân sự nên trao đổi để xác minh bối cảnh thực tế." : "Đây là điểm tích cực nên tiếp tục theo dõi và duy trì."),
  })
}
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
