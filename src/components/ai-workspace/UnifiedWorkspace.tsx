import { useAiTr } from "./aiWorkspaceLanguage"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { AlertTriangle, ArrowLeft, Building2, CalendarDays, Check, ChevronRight, Clock3, Eye, HeartHandshake, History, Loader2, Minus, ShieldCheck, Sparkles, TrendingDown, TrendingUp, UserRound, X } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Button } from "../ui/button"
import { SelectControl } from "../ui/select-control"
import { ApiError, analyzeAiEmployee, getAiResult, listAiEmployeeResults, listAiSnapshots, predictAiEmployee, previewAiEmployee, type AiEmployee, type AiPolicyEvidence, type AiPrediction, type AiResultHistoryItem, type AiSnapshot } from "../../services/api"
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
  const [consent, setConsent] = useState(false), [save, setSave] = useState(false)
  const [busy, setBusy] = useState(true), [analyzing, setAnalyzing] = useState(false)
  const [detailsUnlocked, setDetailsUnlocked] = useState(false), [openingDetails, setOpeningDetails] = useState(false)
  const [error, setError] = useState(""), [errorStatus, setErrorStatus] = useState<number | null>(null)
  const [tab, setTab] = useState(0)
  const lock = useRef(false)
  const gradient = useId().replace(/:/g, "")
  const reduceMotion = useReducedMotion()

  const fail = (cause: unknown) => { const status = cause instanceof ApiError ? cause.status : null; setErrorStatus(status); setError(status ? errors[status] ?? "Không thể hoàn thành yêu cầu. Vui lòng thử lại." : "Không thể tải dữ liệu hồ sơ. Vui lòng thử lại.") }
  const hydrateTrend = async (items: AiResultHistoryItem[]) => { const settled = await Promise.allSettled(items.slice(0, 5).map(item => getAiResult(item.predictionId))); setTrend(settled.filter((item): item is PromiseFulfilledResult<{ data: AiPrediction }> => item.status === "fulfilled").map(item => item.value.data as AnalysisResult).filter(item => item.preview.employee.id === employee.id)) }
  const getHistory = async () => { const items = sortHistory((await listAiEmployeeResults(employee.id)).data); setHistory(items); await hydrateTrend(items); return items }

  useEffect(() => {
    let active = true
    setBusy(true); setProfile(null); setResult(null); setPrevious(null); setReviewing(null); setDetailsUnlocked(false); setConsent(false); setError(""); setErrorStatus(null)
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
  async function runPrediction() {
    if (lock.current) return
    if (!profile?.ready || !profile.snapshotId) { setError(errors[422]); setErrorStatus(422); return }
    lock.current = true; setBusy(true); setAnalyzing(true); setDetailsUnlocked(false); setError(""); setErrorStatus(null)
    try {
      const current = (await predictAiEmployee(employee.id, profile.snapshotId, false)).data as AnalysisResult
      setResult(current); setTab(0); await findPrevious(current, history)
    } catch (cause) { fail(cause) } finally { lock.current = false; setBusy(false); setAnalyzing(false) }
  }
  async function openHistory(id: number) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(""); setErrorStatus(null)
    try {
      const current = (await getAiResult(id)).data as AnalysisResult
      if (current.preview.employee.id !== employee.id) throw new Error("Employee mismatch")
      setResult(current); setProfile(current.preview); setConsent(false); setDetailsUnlocked(true); setTab(0)
      const period = current.policyAnalysis?.selection
      if (period) { setFrom(period.from.slice(0, 10)); setTo(period.to.slice(0, 10)) }
      await findPrevious(current, history)
    } catch (cause) { fail(cause) } finally { lock.current = false; setBusy(false) }
  }
  async function openDetails() {
    if (!result || openingDetails || lock.current || !profile?.snapshotId) return
    if (!consent) { setError("Vui lòng xác nhận cho phép phân tích chuyên sâu dữ liệu nhân sự."); return }
    if (!validEvidencePeriod(from, to, today())) { setError(errors[400]); setErrorStatus(400); return }
    lock.current = true; setBusy(true); setOpeningDetails(true); setError(""); setErrorStatus(null)
    try {
      const body: UnifiedAnalyzeRequest = { snapshotId: profile.snapshotId, confirmExternalData: true, save, evidencePeriod: { from, to } }
      const response = await analyzeAiEmployee(employee.id, body)
      let current: AnalysisResult = { ...response.data, warning: "", preview: { ...response.data.preview, employee: { ...employee, ...response.data.preview.employee }, provenance: {}, missingFeatures: [], issues: [], ready: true }, policyAnalysis: response.data.policyAnalysis as AnalysisResult["policyAnalysis"] }
      let items = history
      if (response.data.saved && response.data.predictionId) { current = (await getAiResult(response.data.predictionId)).data as AnalysisResult; items = await getHistory() }
      setResult(current); setDetailsUnlocked(true); setTab(1); await findPrevious(current, items)
    } catch (cause) { fail(cause) } finally { lock.current = false; setBusy(false); setOpeningDetails(false) }
  }

  return <div className="space-y-5 text-slate-900">
    <section className={`${card} overflow-hidden`}>
<div className="flex flex-wrap items-center gap-3 p-5"><Button variant="outline" disabled={busy} onClick={onBack}><ArrowLeft />{tr("Đổi nhân sự")}</Button><span className="grid size-11 place-items-center rounded-full bg-indigo-50 font-bold text-indigo-700">{initials(employee.fullName)}</span><div className="min-w-0"><h2 className="text-lg font-semibold tracking-tight">{employee.fullName}</h2><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className="font-mono">{employee.employeeCode}</span><span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-indigo-700">{employee.departmentName || tr("Chưa cập nhật phòng ban")}</span><span>{employee.positionName || tr("Chưa cập nhật chức danh")}</span></div></div><label className="ml-auto min-w-[250px] text-xs font-medium text-slate-500">{tr("Chuyển nhanh nhân viên")}<SelectControl aria-label={tr("Chuyển nhanh nhân viên")} className="field mt-1 h-10" disabled={busy} value={employee.id} onChange={event => onChoose(Number(event.target.value))}>{employees.map(item => <option key={item.id} value={item.id}>{item.employeeCode} · {item.fullName}</option>)}</SelectControl></label></div>
      <div className="grid gap-3 border-t border-slate-100 bg-slate-50/60 p-4 xl:grid-cols-[minmax(330px,1fr)_auto_auto_auto] xl:items-end"><div><p className="text-xs font-semibold text-slate-500">{tr("Khoảng thời gian đối soát chuyên sâu")}</p><div className="mt-1 flex items-center gap-2"><input aria-label={tr("Từ ngày")} type="date" max={today()} className="field h-10 px-3" disabled={busy} value={from} onChange={event => setFrom(event.target.value)} /><ChevronRight className="size-4 shrink-0 text-slate-400" /><input aria-label={tr("Đến ngày")} type="date" max={today()} className="field h-10 px-3" disabled={busy} value={to} onChange={event => setTo(event.target.value)} /></div></div><button type="button" role="switch" aria-checked={save} disabled={busy} onClick={() => setSave(value => !value)} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium"><span className={`relative h-5 w-9 rounded-full transition ${save ? "bg-orange-500" : "bg-slate-300"}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white transition ${save ? "left-[18px]" : "left-0.5"}`} /></span>{save ? tr("Sẽ lưu kết quả đầy đủ") : tr("Chỉ xem kết quả")}</button><label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} />{tr("Cho phép phân tích chuyên sâu")}</label><Button disabled={busy || !profile?.ready} onClick={runPrediction} className="h-10 bg-gradient-to-r from-orange-500 to-amber-500 px-5 text-white shadow-sm shadow-orange-500/20"><Sparkles />{tr("Dự báo % rủi ro")}</Button></div>
      {!busy && profile && !profile.ready && <div className="border-t border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900"><strong>{tr("Hồ sơ chưa đủ điều kiện đánh giá.")}</strong> {tr("Cần bổ sung:")} {[...(profile.missingFeatures ?? []), ...(profile.invalidFeatures ?? [])].map(key => tr(featureLabel(key))).join(", ") || tr("thông tin hồ sơ bắt buộc")}.</div>}
    </section>
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><span>{tr(error)}</span>{(errorStatus === 409 || errorStatus === 504) && <Button variant="outline" disabled={busy || !profile?.ready} onClick={detailsUnlocked ? openDetails : runPrediction}>{tr("Thử lại")}</Button>}</div>}
    {busy && <LoadingOverlay analyzing={analyzing} deep={openingDetails} />}
    <div className="grid items-start gap-5 lg:grid-cols-12"><section className={`${card} min-w-0 p-5 lg:col-span-8`}>
      {result && <div className="mb-4 flex flex-wrap items-center gap-2 text-sm"><span className={`rounded-full px-3 py-1 font-medium ${result.saved ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>{result.saved ? tr("Đã lưu hồ sơ · Phiên #{id}", { id: result.predictionId ?? "—" }) : detailsUnlocked ? tr("Phân tích chuyên sâu · Chưa lưu") : tr("Kết quả dự báo nhanh · Chưa lưu")}</span>{result.saved && <span className="text-slate-500">{tr(dateTime(result.createdAt))}</span>}<span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{tr("Cần Nhân sự xác minh")}</span></div>}
      <div role="tablist" aria-label={tr("Các phần đánh giá gắn kết")} className="mb-5 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1" onKeyDown={event => { if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return; event.preventDefault(); const next = (tab + (event.key === "ArrowRight" ? 1 : 2)) % 3; setTab(next); (event.currentTarget.querySelectorAll('[role="tab"]')[next] as HTMLButtonElement)?.focus() }}>{[tr("Tình trạng gắn kết"), tr("Nguyên nhân & Tín hiệu"), tr("Kế hoạch hành động")].map((label, index) => <button type="button" role="tab" aria-controls="engagement-tab-panel" aria-selected={tab === index} tabIndex={tab === index ? 0 : -1} key={label} onClick={() => setTab(index)} className={`relative min-h-10 rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 ${tab === index ? "text-slate-900" : "text-slate-600 hover:text-orange-700"}`}>{tab === index && <motion.span layoutId="activeTabBadge" className="absolute inset-0 rounded-lg border border-slate-200 bg-white shadow-sm" transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }} />}<span className="relative z-10">{index + 1}. {label}</span></button>)}</div>
      <AnimatePresence mode="wait" initial={false}><motion.div id="engagement-tab-panel" role="tabpanel" key={`${tab}-${result?.predictionId ?? "empty"}-${detailsUnlocked}`} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -8 }} transition={{ duration: reduceMotion ? 0 : .2 }}>{!result ? <EmptyResult employee={employee} ready={Boolean(profile?.ready)} /> : tab === 0 ? <EngagementStatus result={result} previous={previous} trend={trend} gradient={gradient} opening={openingDetails} onOpen={openDetails} onReview={() => setReviewing(previous)} /> : !detailsUnlocked ? <DeepDiveTeaser score={scoreOf(result)} loading={openingDetails} onOpen={openDetails} /> : tab === 1 ? <BusinessSignals result={result} /> : result.policyAnalysis ? <ActionDossier analysis={result.policyAnalysis} /> : <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-600">{tr("Phiên này chưa có kế hoạch hành động được lưu.")}</div>}</motion.div></AnimatePresence>
    </section><aside className="space-y-5 lg:col-span-4"><ProfileContext snapshot={result?.preview ?? profile} /><section className={`${card} p-5`}><h3 className="font-semibold">{tr("Lịch sử đánh giá")}</h3><p className="mt-1 text-xs text-slate-500">{tr("Chọn một phiên để xem lại đúng dữ liệu đã lưu.")}</p><div className="mt-3 max-h-72 space-y-2 overflow-auto">{history.map(item => <button type="button" disabled={busy} onClick={() => openHistory(item.predictionId)} key={item.predictionId} className={`block w-full rounded-xl border p-3 text-left text-sm transition hover:border-orange-200 hover:bg-orange-50/50 ${result?.predictionId === item.predictionId ? "border-orange-300 bg-orange-50" : "border-slate-200"}`}><strong>{tr("Phiên #")}{item.predictionId}</strong><span className="mt-0.5 block text-xs text-slate-500">{dateTime(item.createdAt)}</span></button>)}{!history.length && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">{tr("Chưa có lịch sử đánh giá.")}</p>}</div></section></aside></div>
    <AnimatePresence>{reviewing && <PreviousSessionModal result={reviewing} onClose={() => setReviewing(null)} />}</AnimatePresence>
  </div>
}

function LoadingOverlay({ analyzing, deep }: { analyzing: boolean; deep: boolean }) {
  const tr = useAiTr()
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!deep) return
    const startedAt = Date.now()
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 250)
    return () => window.clearInterval(timer)
  }, [deep])
  if (deep) {
    const progress = Math.min(94, 6 + elapsed / 15000 * 88)
    const activeStep = elapsed < 2500 ? 0 : elapsed < 7000 ? 1 : elapsed < 10500 ? 2 : 3
    const remaining = Math.max(1, Math.ceil((12000 - elapsed) / 1000))
    const steps = [
      tr("Trích xuất lịch sử chấm công & phản hồi khảo sát"),
      tr("Mô hình AI đang bóc tách nguyên nhân & dẫn chứng"),
      tr("Đối chiếu danh mục chính sách giữ chân phù hợp"),
      tr("Hoàn tất hồ sơ hành động cho Nhân sự"),
    ]
    return <aside role="status" aria-live="polite" className="fixed bottom-5 right-5 z-50 w-[min(460px,calc(100vw-2rem))] rounded-2xl border border-orange-200/80 bg-white/95 p-5 shadow-[0_24px_64px_rgba(15,23,42,.18)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-orange-600">{tr("Phân tích chuyên sâu đang chạy")}</p><h3 className="mt-1 text-base font-semibold text-slate-950">{tr("Đang chuẩn bị đề xuất cho Nhân sự")}</h3></div><span className="shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold tabular-nums text-orange-700">~{remaining}{tr("s còn lại")}</span></div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100"><span className="eris-progress-shimmer block h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} /></div>
      <ol className="mt-4 space-y-3">{steps.map((label, index) => { const complete = index < activeStep, active = index === activeStep; return <li key={label} className={`flex items-start gap-3 text-sm ${complete ? "text-emerald-700" : active ? "font-medium text-slate-900" : "text-slate-400"}`}><span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${complete ? "border-emerald-200 bg-emerald-50" : active ? "border-orange-300 bg-orange-50 text-orange-600" : "border-slate-200 bg-white"}`}>{complete ? <Check className="size-3.5" /> : active ? <Clock3 className="size-3.5 animate-pulse" /> : <span className="size-1.5 rounded-full bg-slate-300" />}</span><span><span className="font-semibold">{tr("Bước")} {index + 1}:</span> {label}{active && index === 1 ? `... (~${remaining}${tr("s còn lại")})` : complete ? tr(" (Đã xong)") : ""}</span></li> })}</ol>
      <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">{tr("Hệ thống đang phân tích chuyên sâu hàng chục bản ghi dữ liệu. Bạn có thể đợi trong giây lát hoặc tiếp tục xem các thông tin khác.")}</p>
    </aside>
  }
  return <div role="status" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/25 p-4 backdrop-blur-[2px]"><div className="w-full max-w-md rounded-2xl border border-white/70 bg-white p-6 text-center shadow-2xl"><span className="mx-auto grid size-14 place-items-center rounded-full bg-orange-50"><Loader2 className="size-7 animate-spin text-orange-500" /></span><h3 className="mt-4 text-lg font-semibold">{analyzing ? tr("Đang dự báo phần trăm rủi ro") : tr("Đang tải hồ sơ nhân sự")}</h3><p className="mt-2 text-sm text-slate-500">{analyzing ? tr("Model dự báo đang xử lý hồ sơ hiện tại.") : tr("Vui lòng chờ trong giây lát.")}</p></div></div>
}
function EmptyResult({ employee, ready }: { employee: AiEmployee; ready: boolean }) {
  const tr = useAiTr(); return <div className="grid min-h-[430px] place-items-center text-center"><div className="max-w-md"><span className="mx-auto grid size-14 place-items-center rounded-full bg-slate-100"><UserRound className="size-6 text-slate-500" /></span><h3 className="mt-4 font-semibold">{tr("Chưa có kết quả dự báo")}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{ready ? tr("Hồ sơ của {name} đã được nạp. Bấm “Dự báo % rủi ro” để chạy model dự báo nhanh.", { name: employee.fullName }) : tr("Hồ sơ cần được bổ sung trước khi có thể thực hiện dự báo.")}</p></div></div> }
function DeepDiveTeaser({ score, loading, onOpen }: { score: number; loading: boolean; onOpen: () => void }) {
  const tr = useAiTr(); return <div className="grid min-h-[430px] place-items-center overflow-hidden rounded-2xl border border-orange-100 bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,.16),transparent_42%),linear-gradient(to_bottom_right,#fff,#fff7ed)] p-8 text-center"><div className="max-w-xl"><span className="mx-auto grid size-16 place-items-center rounded-2xl border border-orange-200 bg-white text-orange-600 shadow-lg shadow-orange-500/10"><Sparkles className="size-7" /></span><p className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-orange-600">{tr("Sẵn sàng phân tích chuyên sâu")}</p><h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{tr("Đã xác định mức độ rủi ro")} {score.toFixed(2)}%</h3><p className="mt-3 text-sm leading-7 text-slate-600">{tr("Mở phần chuyên sâu để bóc tách nguyên nhân, phản hồi nhân viên và kế hoạch can thiệp phù hợp. Nội dung luôn cần Nhân sự xác minh trước khi áp dụng.")}</p><Button disabled={loading} onClick={onOpen} className="mt-6 h-11 bg-gradient-to-r from-orange-500 to-amber-500 px-5 font-medium text-white shadow-sm shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600">{loading ? <Clock3 className="animate-pulse" /> : <Sparkles />}{tr("Khởi chạy phân tích chuyên sâu (~12s)")}</Button><p className="mx-auto mt-3 max-w-lg text-xs leading-5 text-slate-500">{tr("Mô hình AI sẽ đối chiếu dữ liệu khảo sát và lịch sử chấm công để đề xuất chính sách. Quá trình mất khoảng 10 – 15 giây.")}</p></div></div> }

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

function EngagementStatus({ result, previous, trend, gradient, opening, onOpen, onReview }: { result: AnalysisResult; previous: AnalysisResult | null; trend: AnalysisResult[]; gradient: string; opening: boolean; onOpen: () => void; onReview: () => void }) {
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
          <p className="text-sm leading-7 text-slate-700">{thresholdDelta > 0 ? tr("Điểm số đã vượt ngưỡng cảnh báo của mô hình. Khuyến nghị HR rà soát dữ liệu làm thêm giờ và các phản hồi khảo sát gần nhất.") : tr("Điểm số hiện nằm dưới ngưỡng cảnh báo. HR nên tiếp tục theo dõi định kỳ và đối chiếu khi dữ liệu nhân sự thay đổi.")}</p>
          <p className="text-xs text-slate-500">{tr("Kết quả hỗ trợ tham khảo · Quyết định cuối cùng thuộc về Nhân sự.")}</p>
        </div>
      </div>
    </section>
    <Trajectory result={result} previous={previous} delta={delta} series={series} threshold={threshold} onReview={onReview} />
    <section className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 text-white shadow-lg shadow-slate-900/10 sm:flex-row sm:items-center sm:justify-between"><span aria-hidden="true" className="pointer-events-none absolute -right-14 -top-16 size-48 rounded-full bg-amber-500/10 blur-3xl" /><div className="relative"><p className="text-xs font-bold uppercase tracking-[.16em] text-orange-300">{tr("Bước tiếp theo")}</p><h3 className="mt-1 font-semibold">{tr("Bóc tách nguyên nhân và xây dựng kế hoạch hành động")}</h3><p className="mt-1 text-sm text-slate-200">{tr("Mô hình AI sẽ đối chiếu dữ liệu khảo sát và lịch sử chấm công để đề xuất chính sách.")}</p><p className="mt-1 text-xs text-slate-300">{tr("Quá trình mất khoảng 10 – 15 giây.")}</p></div><motion.div className="relative shrink-0" whileHover={reduceMotion ? undefined : { scale: 1.02 }} whileTap={reduceMotion ? undefined : { scale: .98 }}><Button disabled={opening} onClick={onOpen} className="h-11 bg-gradient-to-r from-orange-500 to-amber-500 px-5 font-medium text-white shadow-sm shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600">{opening ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Sparkles />}{opening ? tr("Đang phân tích…") : tr("Khởi chạy phân tích chuyên sâu (~12s)")}</Button></motion.div></section>
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
  const analysis = result.policyAnalysis
  if (!analysis) return <ProfileSignals result={result} />

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
    <details className="rounded-2xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer rounded-md text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500">{tr("Xem thêm thông tin từ hồ sơ")}</summary>
      <div className="mt-4"><ProfileSignals result={result} /></div>
    </details>
  </div>
}
function ProfileSignals({ result }: { result: AnalysisResult }) {
  const tr = useAiTr()
  const ordered = Object.entries(result.model.contributions).filter(([key, value]) => !["Age", "Gender"].includes(key) && Number.isFinite(value)).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  const risks = ordered.filter(([, value]) => value > 0).slice(0, 3), anchors = ordered.filter(([, value]) => value < 0).slice(0, 2)
  return <div className="space-y-5">
    <SignalGroup title={tr("Nên hỏi thêm")} tone="risk" items={risks.map(([key]) => key)} result={result} />
    <SignalGroup title={tr("Nên tìm hiểu điều gì đang hỗ trợ nhân viên")} tone="anchor" items={anchors.map(([key]) => key)} result={result} />
  </div>
}
function SignalGroup({ title, tone, items, result }: { title: string; tone: "risk" | "anchor"; items: string[]; result: AnalysisResult }) {
  const tr = useAiTr()
  const reduceMotion = useReducedMotion()
  return <section className={`rounded-2xl border p-5 ${tone === "risk" ? "border-amber-200/80 bg-amber-50/20" : "border-emerald-200/80 bg-emerald-50/25"}`}>
    <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className={`grid size-10 place-items-center rounded-xl ${tone === "risk" ? "bg-orange-100 text-orange-600" : "bg-emerald-100 text-emerald-700"}`}>{tone === "risk" ? <AlertTriangle className="size-5" /> : <ShieldCheck className="size-5" />}</span><div><h3 className="font-semibold">{title}</h3></div></div></div>
    {items.length ? <motion.div className="mt-4 grid gap-3 sm:grid-cols-2" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: reduceMotion ? 0 : .06 } } }}>
      {items.map(key => {
        const period = result.preview.period
        const hireDate = result.preview.features.Hire_Date
        const hasHireDate = (key === "Years_At_Company" || key === "Hire_Date") &&
          typeof hireDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(hireDate)
        return <motion.article key={key}
          variants={{ hidden: { opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 12 }, show: { opacity: 1, y: 0 } }}
          transition={{ duration: reduceMotion ? 0 : .22 }}
          className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone === "risk" ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700"}`}><SignalIcon feature={key} /></span>
            <h4 className="min-w-0 break-words font-semibold">{tr(featureLabel(key))}</h4>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-700">{signalObservation(key, result.preview.features[key], tr)}</p>
          {period && <p className="mt-1 text-xs text-slate-600">{tr("Kỳ hồ sơ")} · {`${period.start.split("-").reverse().join("/")} – ${period.end.split("-").reverse().join("/")}`}</p>}
          {hasHireDate && <div className="mt-4 rounded-lg border border-slate-200 p-3 text-sm leading-6 text-slate-700">
              <p className="text-xs font-medium text-slate-600">{tr("Hồ sơ nhân sự")}</p>
              <p className="mt-1">{tr("Ngày vào làm ghi trong hồ sơ là {date}.", { date: displayFeature("Hire_Date", hireDate, tr) })}</p>
          </div>}
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
            <h5 className="font-semibold">{tr("HR cần xác minh")}</h5>
            <p>{signalVerification(key, result.preview.features[key], tr)}</p>
          </div>
        </motion.article>
      })}
    </motion.div> : <p className="mt-4 rounded-xl bg-white p-4 text-sm text-slate-600">{tr("Chưa ghi nhận tín hiệu phù hợp trong nhóm này.")}</p>}
  </section>
}
function SignalIcon({ feature }: { feature: string }) { if (/Overtime|Work_Hours/.test(feature)) return <Clock3 className="size-5" />; if (/Hire_Date|Years/.test(feature)) return <CalendarDays className="size-5" />; if (/Department/.test(feature)) return <Building2 className="size-5" />; if (/Satisfaction/.test(feature)) return <HeartHandshake className="size-5" />; return <Sparkles className="size-5" /> }
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
function signalObservation(feature: string, value: unknown, tr: AiTr) {
  if (value === undefined || value === null || value === "") return tr("Hồ sơ chưa có giá trị cho mục này.")
  // Vietnam Labour Force Survey 2024, table 3.7. This is a population average.
  const nationalWeeklyAverage = 42.5
  if (feature === "Work_Hours_Per_Week" && Number(value) > nationalWeeklyAverage && Number.isFinite(Number(value))) {
    return tr("Hồ sơ ghi nhận {value}, cao hơn {difference} giờ so với mức làm việc thực tế bình quân cả nước năm 2024 (42,5 giờ/tuần). Nếu lịch này lặp lại, hãy hỏi xem nhân viên có còn đủ thời gian nghỉ và lo việc riêng sau giờ làm không.", {
      value: displayFeature(feature, value, tr),
      difference: (Number(value) - nationalWeeklyAverage).toLocaleString("vi-VN", { maximumFractionDigits: 2 })
    })
  }
  const observations: Record<string, string> = {
    Overtime_Hours: "Hồ sơ ghi nhận {value} tăng ca. Nếu công việc thường dồn vào vài ca, đây là chuyện nên hỏi trước khi bàn cách chia lại việc.",
    Work_Hours_Per_Week: "Hồ sơ ghi nhận {value}. Hỏi xem đây là lịch làm việc thường ngày hay chỉ có vài tuần bận hơn.",
    Employee_Satisfaction_Score: "Điểm hài lòng trong hồ sơ là {value}. Một ví dụ từ nhân viên sẽ giúp hiểu phần nào trong công việc đang thuận lợi hoặc gây khó khăn.",
    Sick_Days: "Hồ sơ ghi nhận {value} nghỉ. Có thể hỏi xem nhân viên cần hỗ trợ gì để sắp xếp công việc sau khi quay lại.",
    Monthly_Salary: "Mức lương trong hồ sơ là {value}. Hãy hỏi nhân viên xem phạm vi trách nhiệm có thay đổi từ lần gần nhất trao đổi về lương không.",
    Promotions: "Hồ sơ ghi nhận {value} thăng chức. Có thể hỏi nhân viên muốn phát triển theo hướng nào và đã được trao đổi về bước tiếp theo chưa.",
    Years_At_Company: "Nhân viên đã làm việc {value}. Đây là dịp hỏi điều gì giúp họ gắn bó và điều gì họ muốn thay đổi trong công việc.",
    Hire_Date: "Hồ sơ ghi ngày vào làm là {value}. Có thể hỏi điều gì giúp họ bắt nhịp và khâu nào còn cần hỗ trợ.",
    Department: "Nhân viên đang làm ở {value}. Hãy hỏi việc phối hợp hằng ngày đang thuận lợi ở đâu và có vướng mắc gì.",
    Education_Level: "Hồ sơ ghi bậc học {value}. Có thể hỏi nhân viên muốn dùng hoặc phát triển kỹ năng nào trong công việc hiện tại.",
  }
  return tr(observations[feature] ?? "Hồ sơ ghi nhận {feature} ở mức {value}. Hỏi nhân viên thông tin này có phản ánh công việc hiện tại không.", {
    feature: tr(featureLabel(feature)), value: displayFeature(feature, value, tr)
  })
}
function signalVerification(feature: string, value: unknown, tr: AiTr) {
  const weeklyHours = Number(value)
  // The Labour Code encourages a 40-hour week. Confirm the actual schedule before classifying overtime.
  if (feature === "Work_Hours_Per_Week" && Number.isFinite(weeklyHours) && weeklyHours > 40) {
    return tr("Nếu lịch chuẩn của nhân viên là 40 giờ/tuần, phần chênh là {difference} giờ. Đối chiếu lịch ca và chấm công từng ngày để xác định giờ làm thêm và xem giờ phát sinh có thường rơi vào buổi tối hoặc ngày nghỉ không.", {
      difference: (weeklyHours - 40).toLocaleString("vi-VN", { maximumFractionDigits: 2 })
    })
  }
  const prompts: Record<string, string> = {
    Overtime_Hours: "Đối chiếu ngày tăng ca với lịch phân ca và lịch giao việc. Hỏi quản lý ca nào phát sinh ngoài kế hoạch.",
    Work_Hours_Per_Week: "Đối chiếu giờ thực tế với lịch làm việc bình thường của nhân viên theo từng ngày. Hỏi xem tuần bận có làm họ phải thay đổi thời gian nghỉ hoặc việc riêng không.",
    Employee_Satisfaction_Score: "Hỏi nhân viên câu trả lời nào phản ánh vấn đề đang gặp và đề nghị một ví dụ gần đây.",
    Sick_Days: "Đối chiếu mã loại nghỉ và ngày nghỉ đã duyệt với hồ sơ chấm công.",
    Monthly_Salary: "Đối chiếu mức lương trong hồ sơ với hợp đồng và kỳ lương tương ứng.",
    Promotions: "Kiểm tra lịch sử thay đổi cấp bậc và hỏi về mục tiêu phát triển trong kỳ đánh giá tới.",
    Years_At_Company: "Đối chiếu ngày bắt đầu làm việc và các giai đoạn gián đoạn trong hồ sơ.",
    Hire_Date: "Đối chiếu ngày bắt đầu chính thức với hợp đồng và lịch sử công tác.",
    Department: "Xác nhận phòng ban và các lần điều chuyển trong kỳ hồ sơ.",
    Education_Level: "Xác nhận bậc học ghi trong hồ sơ nhân sự."
  }
  return tr(prompts[feature] ?? "Đối chiếu giá trị với nguồn hồ sơ trong kỳ và ghi lại điểm cần làm rõ.")
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
