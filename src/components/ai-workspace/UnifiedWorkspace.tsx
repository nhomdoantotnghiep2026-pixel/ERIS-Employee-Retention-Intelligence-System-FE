import { useEffect, useId, useMemo, useRef, useState } from "react"
import { AlertTriangle, ArrowLeft, Building2, CalendarDays, Check, ChevronRight, Clock3, Eye, HeartHandshake, History, Loader2, ShieldCheck, Sparkles, TrendingDown, TrendingUp, UserRound, X } from "lucide-react"
import { Button } from "../ui/button"
import { ApiError, analyzeAiEmployee, getAiResult, listAiEmployeeResults, listAiSnapshots, predictAiEmployee, previewAiEmployee, type AiEmployee, type AiPrediction, type AiResultHistoryItem, type AiSnapshot } from "../../services/api"
import { featureLabel } from "./analysis"
import { ActionDossier, EvidenceCard } from "./ActionDossier"
import { validEvidencePeriod, type UnifiedAnalyzeRequest, type UnifiedAnalyzeResponse } from "./unifiedContract"

type AnalysisResult = Omit<AiPrediction, "model" | "warning"> & { warning?: string; model: { score: number; base_value?: number; contributions: Record<string, number>; riskLevel?: string | null; predictionLabel?: boolean; assessment?: UnifiedAnalyzeResponse["model"]["assessment"] } }
const card = "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,.03),0_12px_32px_rgba(15,23,42,.045)]"
const errors: Record<number, string> = { 400: "Dữ liệu hoặc khoảng thời gian đối soát không hợp lệ. Chọn tối đa 366 ngày và không chọn ngày tương lai.", 401: "Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại.", 403: "Chỉ tài khoản Nhân sự đang hoạt động mới có quyền thực hiện đánh giá.", 404: "Không tìm thấy dữ liệu nhân viên hợp lệ để đánh giá.", 409: "Dữ liệu hồ sơ vừa được cập nhật — vui lòng đánh giá lại.", 422: "Hồ sơ nhân viên chưa đủ thông tin cơ bản — vui lòng bổ sung tại mục Hồ sơ nhân sự.", 429: "Hệ thống đang xử lý một phiên đánh giá khác của bạn. Vui lòng đợi trong giây lát.", 502: "Dịch vụ phân tích tạm thời gián đoạn — vui lòng thử lại sau ít phút.", 503: "Dịch vụ phân tích tạm thời gián đoạn — vui lòng thử lại sau ít phút.", 504: "Quá thời gian chờ phản hồi — vui lòng thử lại." }
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
const yearAgo = () => { const d = new Date(`${today()}T00:00:00+07:00`); d.setFullYear(d.getFullYear() - 1); return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(d) }
const dateTime = (value?: string) => value ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Chưa có thời gian"
const sortHistory = (items: AiResultHistoryItem[]) => [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.predictionId - a.predictionId)
const scoreOf = (result: AnalysisResult) => result.model.assessment?.scorePoints ?? result.model.score * 100
const initials = (name: string) => name.trim().split(/\s+/).slice(-2).map(part => part[0]).join("").toUpperCase()

export function UnifiedWorkspace({ employee, employees, onChoose, onBack, onResult }: { employee: AiEmployee; employees: AiEmployee[]; onChoose: (id: number) => void; onBack: () => void; onResult?: (value: boolean) => void }) {
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
      <div className="flex flex-wrap items-center gap-3 p-5"><Button variant="outline" disabled={busy} onClick={onBack}><ArrowLeft />Đổi nhân sự</Button><span className="grid size-11 place-items-center rounded-full bg-indigo-50 font-bold text-indigo-700">{initials(employee.fullName)}</span><div className="min-w-0"><h2 className="text-lg font-semibold tracking-tight">{employee.fullName}</h2><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className="font-mono">{employee.employeeCode}</span><span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-indigo-700">{employee.departmentName || "Chưa cập nhật phòng ban"}</span><span>{employee.positionName || "Chưa cập nhật chức danh"}</span></div></div><label className="ml-auto min-w-[250px] text-xs font-medium text-slate-500">Chuyển nhanh nhân viên<select aria-label="Chuyển nhanh nhân viên" className="field mt-1 h-10" disabled={busy} value={employee.id} onChange={event => onChoose(Number(event.target.value))}>{employees.map(item => <option key={item.id} value={item.id}>{item.employeeCode} · {item.fullName}</option>)}</select></label></div>
      <div className="grid gap-3 border-t border-slate-100 bg-slate-50/60 p-4 xl:grid-cols-[minmax(330px,1fr)_auto_auto_auto] xl:items-end"><div><p className="text-xs font-semibold text-slate-500">Khoảng thời gian đối soát chuyên sâu</p><div className="mt-1 flex items-center gap-2"><input aria-label="Từ ngày" type="date" max={today()} className="field h-10" disabled={busy} value={from} onChange={event => setFrom(event.target.value)} /><ChevronRight className="size-4 shrink-0 text-slate-400" /><input aria-label="Đến ngày" type="date" max={today()} className="field h-10" disabled={busy} value={to} onChange={event => setTo(event.target.value)} /></div></div><button type="button" role="switch" aria-checked={save} disabled={busy} onClick={() => setSave(value => !value)} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium"><span className={`relative h-5 w-9 rounded-full transition ${save ? "bg-orange-500" : "bg-slate-300"}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white transition ${save ? "left-[18px]" : "left-0.5"}`} /></span>{save ? "Sẽ lưu kết quả đầy đủ" : "Chỉ xem kết quả"}</button><label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} />Cho phép phân tích chuyên sâu</label><Button disabled={busy || !profile?.ready} onClick={runPrediction} className="h-10 bg-gradient-to-r from-orange-500 to-amber-500 px-5 text-white shadow-sm shadow-orange-500/20"><Sparkles />Dự báo % rủi ro</Button></div>
      {!busy && profile && !profile.ready && <div className="border-t border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900"><strong>Hồ sơ chưa đủ điều kiện đánh giá.</strong> Cần bổ sung: {[...(profile.missingFeatures ?? []), ...(profile.invalidFeatures ?? [])].map(featureLabel).join(", ") || "thông tin hồ sơ bắt buộc"}.</div>}
    </section>
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><span>{error}</span>{(errorStatus === 409 || errorStatus === 504) && <Button variant="outline" disabled={busy || !profile?.ready} onClick={detailsUnlocked ? openDetails : runPrediction}>Thử lại</Button>}</div>}
    {busy && <LoadingOverlay analyzing={analyzing} deep={openingDetails} />}
    <div className="grid items-start gap-5 lg:grid-cols-12"><section className={`${card} min-w-0 p-5 lg:col-span-8`}>
      {result && <div className="mb-4 flex flex-wrap items-center gap-2 text-sm"><span className={`rounded-full px-3 py-1 font-medium ${result.saved ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>{result.saved ? `Đã lưu hồ sơ · Phiên #${result.predictionId}` : detailsUnlocked ? "Phân tích chuyên sâu · Chưa lưu" : "Kết quả dự báo nhanh · Chưa lưu"}</span>{result.saved && <span className="text-slate-500">{dateTime(result.createdAt)}</span>}<span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Cần Nhân sự xác minh</span></div>}
      <div role="tablist" className="mb-5 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">{["Tình trạng gắn kết", "Nguyên nhân & Tín hiệu", "Kế hoạch hành động"].map((label, index) => <button type="button" role="tab" aria-selected={tab === index} key={label} onClick={() => setTab(index)} className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === index ? "border border-slate-200 bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>{index + 1}. {label}</button>)}</div>
      {!result ? <EmptyResult employee={employee} ready={Boolean(profile?.ready)} /> : tab === 0 ? <EngagementStatus result={result} previous={previous} trend={trend} gradient={gradient} opening={openingDetails} onOpen={openDetails} onReview={() => setReviewing(previous)} /> : !detailsUnlocked ? <DeepDiveTeaser score={scoreOf(result)} loading={openingDetails} onOpen={openDetails} /> : tab === 1 ? <BusinessSignals result={result} /> : result.policyAnalysis ? <ActionDossier analysis={result.policyAnalysis} /> : <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-600">Phiên này chưa có kế hoạch hành động được lưu.</div>}
    </section><aside className="space-y-5 lg:col-span-4"><ProfileContext snapshot={result?.preview ?? profile} /><section className={`${card} p-5`}><h3 className="font-semibold">Lịch sử đánh giá</h3><p className="mt-1 text-xs text-slate-500">Chọn một phiên để xem lại đúng dữ liệu đã lưu.</p><div className="mt-3 max-h-72 space-y-2 overflow-auto">{history.map(item => <button type="button" disabled={busy} onClick={() => openHistory(item.predictionId)} key={item.predictionId} className={`block w-full rounded-xl border p-3 text-left text-sm transition hover:border-orange-200 hover:bg-orange-50/50 ${result?.predictionId === item.predictionId ? "border-orange-300 bg-orange-50" : "border-slate-200"}`}><strong>Phiên #{item.predictionId}</strong><span className="mt-0.5 block text-xs text-slate-500">{dateTime(item.createdAt)}</span></button>)}{!history.length && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Chưa có lịch sử đánh giá.</p>}</div></section></aside></div>
    {reviewing && <PreviousSessionModal result={reviewing} onClose={() => setReviewing(null)} />}
  </div>
}

function LoadingOverlay({ analyzing, deep }: { analyzing: boolean; deep: boolean }) {
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
      "Trích xuất lịch sử chấm công & phản hồi khảo sát",
      "Mô hình AI đang bóc tách nguyên nhân & dẫn chứng",
      "Đối chiếu danh mục chính sách giữ chân phù hợp",
      "Hoàn tất hồ sơ hành động cho Nhân sự",
    ]
    return <aside role="status" aria-live="polite" className="fixed bottom-5 right-5 z-50 w-[min(460px,calc(100vw-2rem))] rounded-2xl border border-orange-200/80 bg-white/95 p-5 shadow-[0_24px_64px_rgba(15,23,42,.18)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-orange-600">Phân tích chuyên sâu đang chạy</p><h3 className="mt-1 text-base font-semibold text-slate-950">Đang chuẩn bị đề xuất cho Nhân sự</h3></div><span className="shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold tabular-nums text-orange-700">~{remaining}s còn lại</span></div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100"><span className="eris-progress-shimmer block h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} /></div>
      <ol className="mt-4 space-y-3">{steps.map((label, index) => { const complete = index < activeStep, active = index === activeStep; return <li key={label} className={`flex items-start gap-3 text-sm ${complete ? "text-emerald-700" : active ? "font-medium text-slate-900" : "text-slate-400"}`}><span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${complete ? "border-emerald-200 bg-emerald-50" : active ? "border-orange-300 bg-orange-50 text-orange-600" : "border-slate-200 bg-white"}`}>{complete ? <Check className="size-3.5" /> : active ? <Clock3 className="size-3.5 animate-pulse" /> : <span className="size-1.5 rounded-full bg-slate-300" />}</span><span><span className="font-semibold">Bước {index + 1}:</span> {label}{active && index === 1 ? `... (~${remaining}s còn lại)` : complete ? " (Đã xong)" : ""}</span></li> })}</ol>
      <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">Hệ thống đang phân tích chuyên sâu hàng chục bản ghi dữ liệu. Bạn có thể đợi trong giây lát hoặc tiếp tục xem các thông tin khác.</p>
    </aside>
  }
  return <div role="status" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/25 p-4 backdrop-blur-[2px]"><div className="w-full max-w-md rounded-2xl border border-white/70 bg-white p-6 text-center shadow-2xl"><span className="mx-auto grid size-14 place-items-center rounded-full bg-orange-50"><Loader2 className="size-7 animate-spin text-orange-500" /></span><h3 className="mt-4 text-lg font-semibold">{analyzing ? "Đang dự báo phần trăm rủi ro" : "Đang tải hồ sơ nhân sự"}</h3><p className="mt-2 text-sm text-slate-500">{analyzing ? "Model dự báo đang xử lý hồ sơ hiện tại." : "Vui lòng chờ trong giây lát."}</p></div></div>
}
function EmptyResult({ employee, ready }: { employee: AiEmployee; ready: boolean }) { return <div className="grid min-h-[430px] place-items-center text-center"><div className="max-w-md"><span className="mx-auto grid size-14 place-items-center rounded-full bg-slate-100"><UserRound className="size-6 text-slate-500" /></span><h3 className="mt-4 font-semibold">Chưa có kết quả dự báo</h3><p className="mt-2 text-sm leading-6 text-slate-600">{ready ? `Hồ sơ của ${employee.fullName} đã được nạp. Bấm “Dự báo % rủi ro” để chạy model dự báo nhanh.` : "Hồ sơ cần được bổ sung trước khi có thể thực hiện dự báo."}</p></div></div> }
function DeepDiveTeaser({ score, loading, onOpen }: { score: number; loading: boolean; onOpen: () => void }) { return <div className="grid min-h-[430px] place-items-center overflow-hidden rounded-2xl border border-orange-100 bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,.16),transparent_42%),linear-gradient(to_bottom_right,#fff,#fff7ed)] p-8 text-center"><div className="max-w-xl"><span className="mx-auto grid size-16 place-items-center rounded-2xl border border-orange-200 bg-white text-orange-600 shadow-lg shadow-orange-500/10"><Sparkles className="size-7" /></span><p className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-orange-600">Sẵn sàng phân tích chuyên sâu</p><h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Đã xác định mức độ rủi ro {score.toFixed(2)}%</h3><p className="mt-3 text-sm leading-7 text-slate-600">Mở phần chuyên sâu để bóc tách nguyên nhân, phản hồi nhân viên và kế hoạch can thiệp phù hợp. Nội dung luôn cần Nhân sự xác minh trước khi áp dụng.</p><Button disabled={loading} onClick={onOpen} className="mt-6 h-11 bg-gradient-to-r from-orange-500 to-amber-500 px-5 font-medium text-white shadow-sm shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600">{loading ? <Clock3 className="animate-pulse" /> : <Sparkles />}Khởi chạy phân tích chuyên sâu (~12s)</Button><p className="mx-auto mt-3 max-w-lg text-xs leading-5 text-slate-500">Mô hình AI sẽ đối chiếu dữ liệu khảo sát và lịch sử chấm công để đề xuất chính sách. Quá trình mất khoảng 10 – 15 giây.</p></div></div> }

function EngagementStatus({ result, previous, trend, gradient, opening, onOpen, onReview }: { result: AnalysisResult; previous: AnalysisResult | null; trend: AnalysisResult[]; gradient: string; opening: boolean; onOpen: () => void; onReview: () => void }) {
  const score = scoreOf(result), risk = riskPresentation(result.model.riskLevel, result.model.assessment?.status), before = previous ? scoreOf(previous) : null, delta = before == null ? null : score - before
  const rawThreshold = result.model.assessment?.thresholdPoints ?? result.model.assessment?.threshold ?? 9.9
  const threshold = rawThreshold <= 1 ? rawThreshold * 100 : rawThreshold
  const thresholdDelta = score - threshold
  const series = useMemo(() => mergeTrend(trend, result), [trend, result])
  return <div className="space-y-4">
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-6 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,.11),transparent_44%)] p-6 md:grid-cols-[minmax(260px,340px)_1fr] md:items-center lg:gap-8">
        <div className="relative mx-auto w-full max-w-[330px] pb-3">
          <svg viewBox="0 0 240 150" className="w-full" aria-label={`Điểm nguy cơ gắn kết ${score.toFixed(2)} phần trăm`}>
            <defs><linearGradient id={gradient} x1="0" x2="1"><stop stopColor="#F59E0B" /><stop offset=".58" stopColor="#F97316" /><stop offset="1" stopColor="#EA580C" /></linearGradient><filter id={`${gradient}-shadow`}><feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#f97316" floodOpacity=".25" /></filter></defs>
            <path d="M24 124 A96 96 0 0 1 216 124" fill="none" stroke="#f1f5f9" strokeWidth="16" />
            <path d="M24 124 A96 96 0 0 1 216 124" fill="none" stroke={`url(#${gradient})`} strokeWidth="16" strokeLinecap="round" pathLength="100" strokeDasharray={`${Math.max(0, Math.min(100, score))} 100`} filter={`url(#${gradient}-shadow)`} />
          </svg>
          <div className="pointer-events-none absolute inset-x-0 bottom-5 text-center"><strong className="block text-5xl font-black tracking-tight tabular-nums text-slate-900 lg:text-6xl">{score.toFixed(2)}%</strong><span className="mt-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">Điểm nguy cơ gắn kết</span></div>
        </div>
        <div className="space-y-3 rounded-2xl border border-slate-200/60 bg-slate-50/70 p-5">
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-400">Nhận định & đối chiếu ngưỡng</p><span className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${risk.className}`}>{risk.icon}{risk.label}</span></div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200/50 bg-white/80 p-2.5 text-xs text-slate-600"><div><span className="text-slate-400">Ngưỡng cảnh báo:</span>{" "}<strong className="font-mono text-slate-800">{threshold.toFixed(2)}%</strong></div><div className="hidden h-3 w-px bg-slate-200 sm:block" /><div className={`font-medium ${thresholdDelta > 0 ? "text-amber-800" : "text-emerald-700"}`}>{thresholdDelta > 0 ? "Vượt ngưỡng" : "Dưới ngưỡng"}: <strong className={`font-mono ${thresholdDelta > 0 ? "text-amber-900" : "text-emerald-800"}`}>{thresholdDelta > 0 ? "+" : ""}{thresholdDelta.toFixed(2)}%</strong></div></div>
          <p className="text-sm leading-7 text-slate-700">{thresholdDelta > 0 ? "Điểm số đã vượt ngưỡng cảnh báo của mô hình. Khuyến nghị HR rà soát dữ liệu làm thêm giờ và các phản hồi khảo sát gần nhất." : "Điểm số hiện nằm dưới ngưỡng cảnh báo. HR nên tiếp tục theo dõi định kỳ và đối chiếu khi dữ liệu nhân sự thay đổi."}</p>
          <p className="text-xs text-slate-500">Kết quả hỗ trợ tham khảo · Quyết định cuối cùng thuộc về Nhân sự.</p>
        </div>
      </div>
    </section>
    <Trajectory result={result} previous={previous} delta={delta} series={series} onReview={onReview} />
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-950 to-slate-800 p-5 text-white sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-orange-300">Bước tiếp theo</p><h3 className="mt-1 font-semibold">Bóc tách nguyên nhân và xây dựng kế hoạch hành động</h3><p className="mt-1 text-sm text-slate-300">Mô hình AI sẽ đối chiếu dữ liệu khảo sát và lịch sử chấm công để đề xuất chính sách.</p><p className="mt-1 text-xs text-slate-400">Quá trình mất khoảng 10 – 15 giây.</p></div><Button disabled={opening} onClick={onOpen} className="h-11 bg-gradient-to-r from-orange-500 to-amber-500 px-5 font-medium text-white shadow-sm shadow-orange-500/20 hover:from-orange-600 hover:to-amber-600">{opening ? <Clock3 className="animate-pulse" /> : <Sparkles />}Khởi chạy phân tích chuyên sâu (~12s)</Button></section>
  </div>
}
function Trajectory({ result, previous, delta, series, onReview }: { result: AnalysisResult; previous: AnalysisResult | null; delta: number | null; series: AnalysisResult[]; onReview: () => void }) { return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><History className="size-4" /></span><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">So với lần đánh giá trước</p><h3 className="font-semibold">Xu hướng rủi ro gắn kết</h3></div></div><div className="mt-4 grid gap-5 lg:grid-cols-[minmax(180px,.8fr)_minmax(230px,1fr)_auto] lg:items-center"><div>{delta == null ? <><span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">Phiên đánh giá đầu tiên</span><p className="mt-2 text-sm text-slate-500">Cần thêm một phiên để hình thành xu hướng.</p></> : <><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${Math.abs(delta) < .005 ? "bg-slate-100 text-slate-700" : delta > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>{Math.abs(delta) < .005 ? "~ Giữ mức ổn định" : delta > 0 ? <><TrendingUp className="size-4" />+{Math.abs(delta).toFixed(2)}% Tăng nhẹ</> : <><TrendingDown className="size-4" />-{Math.abs(delta).toFixed(2)}% Giảm</>}</span><p className="mt-2 text-sm leading-6 text-slate-600">Mức nguy cơ {delta > .005 ? "tăng" : delta < -.005 ? "giảm" : "giữ ổn định"} so với phiên #{previous?.predictionId}.</p></>}</div><TrendSparkline points={series} current={result} />{previous ? <Button variant="outline" onClick={onReview} className="h-auto min-h-10 whitespace-normal px-3 py-2 text-xs shadow-sm hover:border-orange-300 hover:text-orange-600"><Eye />Xem chi tiết phiên #{previous.predictionId}<span className="block text-[11px] font-normal text-slate-500">{dateTime(previous.createdAt)}</span></Button> : <span className="text-xs text-slate-400">Chưa có phiên trước</span>}</div></section> }
function TrendSparkline({ points, current }: { points: AnalysisResult[]; current: AnalysisResult }) { const values = points.length ? points : [current], scores = values.map(scoreOf), width = 300, height = 92, pad = 12, min = Math.min(...scores), max = Math.max(...scores), range = Math.max(max - min, 1), coords = scores.map((score, index) => ({ x: scores.length === 1 ? width / 2 : pad + index * (width - pad * 2) / (scores.length - 1), y: height - pad - (score - min) / range * (height - pad * 2) })), line = coords.map(p => `${p.x},${p.y}`).join(" "), area = `${pad},${height-pad} ${line} ${width-pad},${height-pad}`, id = useId().replace(/:/g, ""); return <div><svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full overflow-visible" role="img" aria-label="Xu hướng các kỳ đánh giá gần nhất"><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f97316" stopOpacity=".28" /><stop offset="1" stopColor="#f97316" stopOpacity=".02" /></linearGradient></defs><polygon points={area} fill={`url(#${id})`} /><polyline points={line} fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{coords.map((p, i) => <circle key={`${p.x}-${p.y}`} cx={p.x} cy={p.y} r={i === coords.length - 1 ? 6 : 4} fill="white" stroke="#f97316" strokeWidth={i === coords.length - 1 ? 3 : 2}><title>{scores[i].toFixed(2)}% · {dateTime(values[i].createdAt)}</title></circle>)}</svg><div className="flex justify-between text-[11px] text-slate-400"><span>{values.length} kỳ gần nhất</span><span className="font-semibold text-orange-600">Hiện tại {scoreOf(current).toFixed(2)}%</span></div></div> }

function BusinessSignals({ result }: { result: AnalysisResult }) {
  const ordered = Object.entries(result.model.contributions)
    .filter(([key, value]) => !["Age", "Gender"].includes(key) && Number.isFinite(value))
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  const risks = ordered.filter(([, value]) => value > 0).slice(0, 3)
  const anchors = ordered.filter(([, value]) => value < 0).slice(0, 2)
  const analysis = result.policyAnalysis
  const selection = analysis?.selection

  return <div className="space-y-5">
    <p className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
      <ShieldCheck className="mt-0.5 size-5 shrink-0" />Dùng các dấu hiệu dưới đây để biết nên hỏi thêm chuyện gì.
    </p>
    <SignalGroup title="Điều cần hỏi thêm" tone="risk" items={risks} preview={result.preview} />
    {analysis && <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
      <h3 className="font-semibold">Khảo sát và chấm công nói gì?</h3>
      {selection && <p className="mt-1 text-sm text-slate-600">Từ {displayDay(selection.from)} đến {displayDay(selection.to)}</p>}
      {analysis.recommendations.length ? analysis.recommendations.map(item => (
        <div key={item.policy.id} className="mt-4 space-y-3">
          <p className="text-sm leading-6 text-slate-700">{item.reason}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {item.evidence.map((evidence, index) => <EvidenceCard key={evidence.id ?? index} evidence={evidence} />)}
          </div>
          <p className="rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-950"><strong>Việc HR có thể làm</strong><br />{item.hrVerification}</p>
        </div>
      )) : <p className="mt-3 text-sm leading-6 text-slate-600">{analysis.noRecommendationReason || "Phiên này chưa có đề xuất kèm bằng chứng."}</p>}
    </section>}
    <SignalGroup title="Điều giúp giảm điểm rủi ro" tone="anchor" items={anchors} preview={result.preview} />
  </div>
}

function SignalGroup({ title, tone, items, preview }: {
  title: string
  tone: "risk" | "anchor"
  items: Array<[string, number]>
  preview: AnalysisResult["preview"]
}) {
  const increasing = tone === "risk"
  return <section className={`rounded-2xl border p-5 ${increasing ? "border-amber-200 bg-amber-50/30" : "border-emerald-200 bg-emerald-50/30"}`}>
    <h3 className="font-semibold">{title}</h3>
    {items.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {items.map(([key, impact]) => <article key={key} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="flex items-center gap-2 font-semibold"><SignalIcon feature={key} />{featureLabel(key)}</h4>
        <dl className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
          <div><dt className="font-medium">Hồ sơ ghi nhận</dt><dd>{displayFeature(key, preview.features[key])} · {signalPeriod(key, preview)}</dd></div>
          <div><dt className="font-medium">Nên xem lại</dt><dd>{signalVerification[key] ?? "Xem lại hồ sơ nhân sự tại ngày ghi nhận."}</dd></div>
        </dl>
        <details className="mt-3 text-xs text-slate-600">
          <summary className="cursor-pointer">Xem điểm dự báo</summary>
          <p className="mt-1">Mô hình tính {increasing ? "tăng" : "giảm"} {formatImpact(impact)} điểm phần trăm cho mục này.</p>
        </details>
      </article>)}
    </div> : <p className="mt-3 text-sm text-slate-600">Chưa có yếu tố trong nhóm này.</p>}
  </section>
}

const signalVerification: Record<string, string> = {
  Overtime_Hours: "Xem bảng chấm công để biết ca nào kéo dài, rồi hỏi quản lý hôm đó có việc gì phát sinh.",
  Work_Hours_Per_Week: "So bảng chấm công với lịch ca để xem tuần nào làm khác lịch.",
  Employee_Satisfaction_Score: "Xem lại câu trả lời và hỏi nhân viên chuyện gì khiến họ chấm mức điểm đó.",
  Sick_Days: "So ngày nghỉ trên bảng chấm công với đơn nghỉ đã duyệt.",
  Monthly_Salary: "Xem bảng lương tháng đó và kiểm tra bậc lương đang áp dụng.",
  Promotions: "Xem lần bổ nhiệm gần nhất và hỏi quản lý hai bên đã hẹn mốc phát triển nào.",
  Years_At_Company: "Đối chiếu ngày vào làm trong hồ sơ hợp đồng với ngày chụp dữ liệu.",
  Hire_Date: "Xác nhận ngày bắt đầu làm việc trên hợp đồng và hồ sơ nhân sự.",
  Department: "Kiểm tra quyết định điều chuyển gần nhất để xác nhận phòng ban tại ngày chụp dữ liệu.",
  Education_Level: "Đối chiếu trình độ được ghi với văn bằng trong hồ sơ nhân sự."
}

function displayDay(value: string) {
  const day = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day.split("-").reverse().join("/") : value
}

function signalPeriod(key: string, preview: AnalysisResult["preview"]) {
  const period = preview.period
  if (period?.start && period.end && ["Work_Hours_Per_Week", "Employee_Satisfaction_Score"].includes(key)) {
    return `Kỳ ${displayDay(period.start)}–${displayDay(period.end)}`
  }
  const day = preview.snapshotDate ?? preview.capturedAt?.slice(0, 10)
  const provenance = preview.provenance?.[key] ?? ""
  if (day && /January 1 through snapshot|Year-to-date ACTIVE attendance/.test(provenance)) {
    return `Từ 01/01/${day.slice(0, 4)} đến ${displayDay(day)}`
  }
  return day ? `Hồ sơ ngày ${displayDay(day)}` : "Chưa có ngày chụp dữ liệu"
}

function formatImpact(impact: number) {
  const points = Math.abs(impact) * 100
  return points < 0.01 ? "dưới 0,01" : points.toLocaleString("vi-VN", { maximumFractionDigits: 2 })
}
function SignalIcon({ feature }: { feature: string }) { if (/Overtime|Work_Hours/.test(feature)) return <Clock3 className="size-5" />; if (/Hire_Date|Years/.test(feature)) return <CalendarDays className="size-5" />; if (/Department/.test(feature)) return <Building2 className="size-5" />; if (/Satisfaction/.test(feature)) return <HeartHandshake className="size-5" />; return <Sparkles className="size-5" /> }

function PreviousSessionModal({ result, onClose }: { result: AnalysisResult; onClose: () => void }) { const risk = riskPresentation(result.model.riskLevel, result.model.assessment?.status); return <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section className="max-h-[88vh] w-full max-w-3xl overflow-auto rounded-2xl border border-white/60 bg-white shadow-2xl"><header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Phiên đánh giá trước</p><h2 className="mt-1 text-xl font-semibold">Phiên #{result.predictionId} · {dateTime(result.createdAt)}</h2></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Đóng"><X /></Button></header><div className="space-y-5 p-6"><div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center"><div className="rounded-2xl bg-slate-950 p-5 text-center text-white"><strong className="block text-4xl font-black tabular-nums">{scoreOf(result).toFixed(2)}%</strong><span className="mt-1 block text-xs text-slate-300">Nguy cơ thôi việc</span></div><div><span className={`inline-flex rounded-full border px-3 py-1 text-sm font-bold ${risk.className}`}>{risk.label}</span><p className="mt-3 text-sm leading-7 text-slate-600">{result.model.assessment?.explanation || "Phiên đánh giá này cần được đối chiếu cùng bối cảnh nhân sự tại thời điểm thực hiện."}</p></div></div><div className="grid gap-3 sm:grid-cols-2">{Object.entries(result.preview.features).map(([key, value]) => <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><span className="text-xs text-slate-500">{featureLabel(key)}</span><strong className="mt-1 block text-sm">{displayFeature(key, value)}</strong></div>)}</div></div></section></div> }
function ProfileContext({ snapshot }: { snapshot: AiSnapshot | AnalysisResult["preview"] | null }) { const f = snapshot?.features ?? {}, satisfaction = Number(f.Employee_Satisfaction_Score), overtime = Number(f.Overtime_Hours), rows = ["Monthly_Salary", "Work_Hours_Per_Week", "Sick_Days", "Years_At_Company", "Hire_Date", "Promotions", "Department", "Education_Level", "Age", "Gender"], activeSegments = Number.isFinite(satisfaction) ? Math.max(0, Math.min(5, Math.round(satisfaction))) : 0, satisfactionLabel = !Number.isFinite(satisfaction) ? "Chưa cập nhật" : satisfaction >= 4.5 ? "Rất tích cực" : satisfaction >= 3 ? "Trung bình khá" : satisfaction >= 2 ? "Cần lưu ý" : "Cần quan tâm"; return <section className={`${card} p-5`}><h3 className="font-semibold">Dữ liệu hồ sơ đang dùng</h3>{snapshot ? <><div className="mt-4 space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Mức độ hài lòng công việc</span><span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${satisfaction >= 3 ? "border-amber-200/70 bg-amber-50 text-amber-800" : "border-rose-200/70 bg-rose-50 text-rose-700"}`}>{satisfactionLabel}</span></div><div className="flex items-baseline gap-1.5"><span className="text-3xl font-black tracking-tight tabular-nums text-slate-900">{Number.isFinite(satisfaction) ? satisfaction.toFixed(1) : "—"}</span><span className="text-sm font-medium text-slate-400">/ 5.0</span></div><div className="grid grid-cols-5 gap-1.5 pt-1">{[1,2,3,4,5].map(segment => <span key={segment} className={`h-2 rounded-full ${segment <= activeSegments ? segment === 1 ? "bg-gradient-to-r from-amber-400 to-amber-500 shadow-sm" : segment === 2 ? "bg-gradient-to-r from-amber-500 to-orange-400 shadow-sm" : "bg-gradient-to-r from-orange-400 to-orange-500 shadow-sm" : "bg-slate-100"}`} />)}</div></div><div className="mt-4 grid grid-cols-2 gap-x-4">{rows.map(key => <div key={key} className="border-b border-slate-100 py-3"><p className="text-xs text-slate-500">{featureLabel(key)}</p><p className="mt-1 text-sm font-semibold">{displayFeature(key, f[key])}</p></div>)}<div className="col-span-2 py-3"><div className="flex items-center justify-between"><div><p className="text-xs text-slate-500">Giờ tăng ca</p><p className="mt-1 text-sm font-semibold">{displayFeature("Overtime_Hours", f.Overtime_Hours)}</p></div>{Number.isFinite(overtime) && overtime > 30 && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Cần đối soát</span>}</div></div></div></> : <p className="mt-4 text-sm text-slate-500">Đang nạp hồ sơ nhân viên…</p>}</section> }

function mergeTrend(history: AnalysisResult[], current: AnalysisResult) { const values = [...history]; if (!values.some(item => item.predictionId && item.predictionId === current.predictionId)) values.push(current); return values.sort((a, b) => Date.parse(a.createdAt ?? a.preview.capturedAt) - Date.parse(b.createdAt ?? b.preview.capturedAt)).slice(-5) }
function riskPresentation(level?: string | null, status?: string) { const value = (level ?? "").toLowerCase(); if (/high|cao/.test(value)) return { label: "Nguy cơ cao · Cần can thiệp", className: "border-rose-200 bg-rose-50 text-rose-700", icon: <AlertTriangle className="size-4" /> }; if (/medium|trung/.test(value) || status === "REVIEW_REQUIRED") return { label: "Cần lưu ý", className: "border-amber-300 bg-amber-50 text-amber-900", icon: <AlertTriangle className="size-4" /> }; return { label: "Nguy cơ thấp", className: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: <Check className="size-4" /> } }
function displayFeature(key: string, value: unknown) { if (value === undefined || value === null || value === "") return "Chưa cập nhật"; if (key === "Gender") return ({ Male: "Nam", Female: "Nữ", Other: "Khác" } as Record<string,string>)[String(value)] ?? String(value); if (key === "Education_Level") return ({ Bachelor: "Đại học", Master: "Thạc sĩ", PhD: "Tiến sĩ", "High School": "Trung học phổ thông" } as Record<string,string>)[String(value)] ?? String(value); if (key === "Hire_Date") return String(value).split("-").reverse().join("/"); const units: Record<string,string> = { Monthly_Salary: " USD/tháng", Age: " tuổi", Years_At_Company: " năm", Overtime_Hours: " giờ", Work_Hours_Per_Week: " giờ/tuần", Sick_Days: " ngày", Promotions: " lần", Employee_Satisfaction_Score: " / 5" }, shown = typeof value === "number" ? value.toLocaleString("vi-VN", { maximumFractionDigits: 2 }) : String(value); return `${shown}${units[key] ?? ""}` }
