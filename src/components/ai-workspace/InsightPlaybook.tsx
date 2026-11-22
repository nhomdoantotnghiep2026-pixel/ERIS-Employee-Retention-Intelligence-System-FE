import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Database,
  FileJson,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { Button } from "../ui/button"
import { featureLabel } from "./analysis"
import type { AiPolicyEvidence, AiSnapshot, AiUnifiedPolicyAnalysis } from "../../services/api"
import type { buildInsights, Signal } from "./insight-engine"

type Engine = ReturnType<typeof buildInsights>
type Features = Record<string, string | number>
type RunOptions = { from: string; to: string; save: boolean }

export function InsightPlaybook({
  engine,
  tab,
  focusFeature,
  onPolicy,
  features = {},
  snapshot,
  policyAnalysis,
  policyBusy = false,
  policyError = "",
  onAnalyzePolicy,
}: {
  engine: Engine
  tab: "insights" | "policies"
  focusFeature: string | null
  onPolicy: (feature: string) => void
  features?: Features
  snapshot?: AiSnapshot | null
  policyAnalysis?: AiUnifiedPolicyAnalysis
  policyBusy?: boolean
  policyError?: string
  onAnalyzePolicy?: (options: RunOptions) => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const topThree = useMemo(() => [...engine.selected].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3), [engine.selected])
  const maxImpact = Math.max(...engine.selected.map(signal => Math.abs(signal.value)), 0.000001)

  useEffect(() => {
    if (tab !== "policies" || !focusFeature) return
    root.current?.querySelector<HTMLElement>(`[data-policy="${focusFeature}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [focusFeature, tab])

  if (tab === "policies") {
    return <div ref={root} className="space-y-5"><PolicyAgentWorkspace snapshot={snapshot} analysis={policyAnalysis} busy={policyBusy} error={policyError} onRun={onAnalyzePolicy} /><LocalPolicyFallback signals={engine.selected} focusFeature={focusFeature} /></div>
  }
  if (engine.missingContributions) return <EmptySignals text="Chưa có thông tin về các yếu tố tác động cho lần đánh giá này." />
  if (!engine.selected.length) return <EmptySignals text="Chưa ghi nhận yếu tố biến động vượt ngưỡng cảnh báo." />

  const groups = [
    { items: engine.positive, risk: true, title: "Yếu tố làm tăng nguy cơ", subtitle: "Tín hiệu cần HR làm rõ và can thiệp phù hợp" },
    { items: engine.negative, risk: false, title: "Yếu tố giúp giữ chân", subtitle: "Điểm tựa tích cực nên tiếp tục duy trì" },
  ]
  return <div ref={root} className="space-y-6">
    <section className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-orange-50/30 p-4 shadow-sm">
      <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-900 text-white"><BarChart3 className="size-4" /></span><div><p className="metadata-label">Câu chuyện chính trong 3 giây</p><h3 className="mt-1 font-semibold tracking-tight text-slate-900">Top 3 tín hiệu theo mức tác động</h3><p className="mt-1 text-sm leading-6 text-slate-600">Cam biểu thị yếu tố làm tăng nguy cơ; xanh ngọc biểu thị điểm tựa giúp giữ chân. Độ dài thanh thể hiện mức tác động tương đối.</p></div></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">{topThree.map((signal, index) => <div key={signal.feature} className="rounded-lg border border-slate-200 bg-white p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-500">#{index + 1}</span><ImpactBadge signal={signal} /></div><p className="mt-2 text-sm font-semibold text-slate-900">{featureLabel(signal.feature)}</p><ImpactBar signal={signal} max={maxImpact} compact /></div>)}</div>
    </section>
    {groups.filter(group => group.items.length).map(group => <section key={group.title} className={`rounded-xl border p-4 ${group.risk ? "border-amber-200/80 bg-amber-50/20" : "border-emerald-200/80 bg-emerald-50/20"}`}>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2.5">{group.risk ? <AlertCircle className="size-5 text-orange-600" /> : <ShieldCheck className="size-5 text-emerald-600" />}<div><h3 className="font-semibold tracking-tight text-slate-900">{group.title}</h3><p className="mt-0.5 text-xs text-slate-500">{group.subtitle}</p></div></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${group.risk ? "bg-orange-100 text-orange-800" : "bg-emerald-100 text-emerald-800"}`}>{group.items.length} tín hiệu</span></header>
      <div className="grid gap-3">{group.items.map(signal => <article key={signal.feature} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-sm font-semibold text-slate-900">{featureLabel(signal.feature)}</h4><p className="mt-1 text-xs font-medium text-slate-500">Thực tế: {actualValue(signal.feature, features)}</p></div><ImpactBadge signal={signal} /></div>
        <ImpactBar signal={signal} max={maxImpact} />
        <p className="mt-3 text-sm leading-relaxed text-slate-700">{signal.insight}</p>
        <Button variant="link" className="mt-2 h-auto whitespace-normal p-0 text-left text-orange-700" onClick={() => onPolicy(signal.feature)}>Xem giải pháp tương ứng [Tab 3] <ArrowRight className="size-4" /></Button>
      </article>)}</div>
    </section>)}
  </div>
}

function ImpactBar({ signal, max, compact = false }: { signal: Signal; max: number; compact?: boolean }) {
  const width = Math.max(8, Math.min(100, Math.abs(signal.value) / max * 100))
  const risk = signal.direction === "positive"
  return <div className={compact ? "mt-3" : "mt-4"}><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full transition-all duration-500 ${risk ? "bg-gradient-to-r from-amber-400 to-orange-500" : "bg-gradient-to-r from-teal-400 to-emerald-500"}`} style={{ width: `${width}%` }} /></div></div>
}

function ImpactBadge({ signal }: { signal: Signal }) {
  const risk = signal.direction === "positive"
  return <span className={`rounded-full px-2.5 py-1 font-mono text-xs font-bold tabular-nums ${risk ? "bg-orange-50 text-orange-700" : "bg-emerald-50 text-emerald-700"}`}>{signal.value > 0 ? "+" : ""}{signal.value.toFixed(6)}</span>
}

function PolicyAgentWorkspace({ snapshot, analysis, busy, error, onRun }: { snapshot?: AiSnapshot | null; analysis?: AiUnifiedPolicyAnalysis; busy: boolean; error: string; onRun?: (options: RunOptions) => void }) {
  const defaultTo = dateInputValue(snapshot?.period?.end ?? snapshot?.snapshotDate ?? snapshot?.capturedAt)
  const defaultFrom = dateInputValue(snapshot?.period?.start) || (defaultTo ? `${defaultTo.slice(0, 4)}-01-01` : "")
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [consent, setConsent] = useState(false)
  const [save, setSave] = useState(false)
  const invalidPeriod = Boolean(from && to && from > to)
  return <>
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="metadata-label">Policy Agent có kiểm soát</p><h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Phân tích bằng chứng & gợi ý chính sách</h3><p className="mt-1 text-sm leading-6 text-slate-600">Chọn kỳ bằng chứng để đối chiếu khảo sát, chấm công và tín hiệu hiện tại trước khi HR xem xét.</p></div><span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500"><span className={`size-1.5 rounded-full ${busy ? "animate-pulse bg-amber-500" : analysis ? "bg-emerald-500" : "bg-slate-400"}`} />E5 + Ollama</span></div>
      <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end"><label className="grid gap-1.5 text-xs font-semibold text-slate-600">Bằng chứng từ ngày<input type="date" className="field h-10 bg-white" value={from} onChange={event => setFrom(event.target.value)} /></label><label className="grid gap-1.5 text-xs font-semibold text-slate-600">Đến ngày<input type="date" className="field h-10 bg-white" value={to} onChange={event => setTo(event.target.value)} /></label><Button disabled={!onRun || !consent || !from || !to || invalidPeriod || busy} onClick={() => onRun?.({ from, to, save })} className="h-10 bg-gradient-to-r from-orange-500 to-amber-500 px-4 text-white shadow-sm hover:from-orange-600 hover:to-amber-600">{busy ? <Loader2 className="animate-spin" /> : <Sparkles />}Phân tích & gợi ý Policy</Button></div>
      {invalidPeriod && <p role="alert" className="mt-2 text-xs font-medium text-rose-700">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2"><label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="size-4 rounded border-slate-300 accent-orange-500" />Đồng ý gửi dữ liệu phân tích tới AI Policy Agent</label><label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700"><input type="checkbox" checked={save} onChange={event => setSave(event.target.checked)} className="size-4 rounded border-slate-300 accent-orange-500" />Lưu kết quả phân tích vào hồ sơ</label></div>
      {busy && <div role="status" className="mt-4 grid gap-2 sm:grid-cols-3">{["Đối chiếu bằng chứng", "E5 xếp hạng Policy", "Ollama diễn giải"].map((label, index) => <div key={label} className="flex items-center gap-2 rounded-lg border border-orange-100 bg-orange-50/60 px-3 py-2 text-xs font-semibold text-orange-800"><span className="grid size-5 place-items-center rounded-full bg-orange-500 text-[10px] text-white">{index + 1}</span>{label}<Loader2 className="ml-auto size-3.5 animate-spin" /></div>)}</div>}
      {error && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
    </section>
    {analysis ? <PolicyRecommendations analysis={analysis} /> : <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-5 py-8 text-center"><Database className="mx-auto size-7 text-slate-400" /><h3 className="mt-3 font-semibold text-slate-900">Chưa có phân tích Policy cho phiên đang xem</h3><p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-slate-600">Chọn khoảng thời gian bằng chứng, xác nhận đồng ý và chạy phân tích để nhận đề xuất có nguồn tham chiếu.</p></section>}
  </>
}

export function PolicyRecommendations({ analysis }: { analysis: AiUnifiedPolicyAnalysis }) {
  if (!analysis.recommendations.length) return <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5"><h3 className="font-semibold text-emerald-900">Chưa có kế hoạch hành động phù hợp</h3><p className="mt-1 text-sm leading-6 text-emerald-800">{analysis.noRecommendationReason || "Thông tin trong kỳ chưa đủ để hình thành khuyến nghị có căn cứ."}</p></section>
  return <section className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="metadata-label">Hồ sơ hành động</p><h3 className="mt-1 font-semibold tracking-tight text-slate-900">{analysis.recommendations.length} kế hoạch cần Nhân sự xem xét</h3></div>{analysis.generatedAt && <span className="text-xs text-slate-500">Tạo lúc {formatDateTimeVi(analysis.generatedAt)}</span>}</div>{analysis.recommendations.map((recommendation, index) => <article key={`${recommendation.policy.id}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <header className="flex flex-wrap items-start gap-3 border-b border-slate-100 px-5 py-4"><span className="rounded-md bg-slate-900 px-2.5 py-1 font-mono text-xs font-bold text-white">{recommendation.policy.code || recommendation.policy.id}</span><div className="min-w-0 flex-1"><h4 className="font-semibold tracking-tight text-slate-950">{recommendation.policy.name}</h4><span className="mt-1 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Cần Nhân sự xác minh</span></div></header>
    <div className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Hành động đề xuất</p><p className="mt-2 text-sm font-medium leading-7 text-slate-800">{recommendation.policy.description || recommendation.policy.name}</p><div className="mt-5 grid gap-4 md:grid-cols-2"><section className="rounded-xl bg-slate-50/80 p-4"><h5 className="text-sm font-semibold text-slate-900">Lý do đề xuất</h5><p className="mt-2 text-sm leading-6 text-slate-700">{recommendation.reason}</p></section><section className="rounded-xl border border-amber-200/60 bg-amber-50/60 p-4"><h5 className="flex items-center gap-2 text-sm font-semibold text-amber-900"><CheckCircle2 className="size-4" />Nhân sự cần xác minh</h5><p className="mt-2 text-sm leading-6 text-amber-900">{recommendation.hrVerification}</p>{recommendation.evidence.length > 0 && <details className="group mt-4 border-t border-amber-200/70 pt-3"><summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-amber-900"><Database className="size-4" />Bằng chứng thực tế ({recommendation.evidence.length})<ChevronDown className="ml-auto size-4 transition-transform group-open:rotate-180" /></summary><div className="mt-3 grid gap-3">{recommendation.evidence.map((evidence, evidenceIndex) => <EvidenceCard key={evidence.id || evidenceIndex} evidence={evidence} />)}</div></details>}</section></div></div>
  </article>)}</section>
}

function EvidenceCard({ evidence }: { evidence: AiPolicyEvidence }) {
  const source = String(evidence.source || "EVIDENCE").toUpperCase()
  const sourceLabel = source === "SURVEY" ? `Khảo sát${evidence.survey_id ? ` #${evidence.survey_id}` : ""}` : source === "ATTENDANCE" ? "Chấm công" : source === "MODEL" ? "Thông tin hồ sơ" : "Bằng chứng"
  const date = evidence.submitted_at || evidence.month
  const answer = formatEvidenceAnswer(evidence.answer_value ?? evidence.comment)
  return <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">{sourceLabel}</span>{evidence.category && <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">{friendlyCategory(evidence.category)}</span>}{date && <span className="ml-auto text-xs font-medium text-slate-500">{formatEvidenceDate(String(date))}</span>}</div>
    {source === "SURVEY" && <>{evidence.question_text && <p className="mt-3 text-sm font-medium leading-relaxed text-slate-700">Câu hỏi: “{evidence.question_text}”</p>}<blockquote className="mt-3 rounded-r-md border-l-2 border-orange-400 bg-orange-50/30 py-2 pl-3 text-sm italic leading-relaxed text-slate-800">{answer || "Không có câu trả lời dạng văn bản."}</blockquote></>}
    {source === "ATTENDANCE" && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5"><EvidenceMetric label="Ngày ghi nhận" value={evidence.recordedDays} /><EvidenceMetric label="Giờ làm" value={minutesToHours(evidence.workingMinutes)} /><EvidenceMetric label="Tăng ca" value={minutesToHours(evidence.overtimeMinutes)} /><EvidenceMetric label="Đi muộn" value={formatMinutes(evidence.lateMinutes)} /><EvidenceMetric label="Về sớm" value={formatMinutes(evidence.earlyMinutes)} /></div>}
    {source === "MODEL" && <div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><strong className="text-slate-900">{featureLabel(String(evidence.feature || ""))}</strong><span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">Giá trị: {formatEvidenceAnswer(evidence.value)}</span></div>}
  </article>
}

function EvidenceMetric({ label, value }: { label: string; value: unknown }) { return <div className="rounded-lg bg-slate-50 p-2.5"><span className="block text-[11px] font-medium text-slate-500">{label}</span><strong className="mt-1 block text-sm text-slate-900">{value === undefined || value === null ? "—" : String(value)}</strong></div> }

function LocalPolicyFallback({ signals, focusFeature }: { signals: Signal[]; focusFeature: string | null }) {
  if (!signals.length) return null
  return <details className="group rounded-xl border border-slate-200 bg-white"><summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-semibold text-slate-800"><Briefcase className="size-4 text-slate-500" />Kế hoạch từ tín hiệu SHAP hiện tại<ChevronDown className="ml-auto size-4 transition-transform group-open:rotate-180" /></summary><div className="grid gap-3 border-t border-slate-200 p-4">{signals.map(signal => <article key={signal.feature} data-policy={signal.feature} className={`rounded-lg border p-4 ${focusFeature === signal.feature ? "border-orange-300 bg-orange-50/40" : "border-slate-200 bg-slate-50/40"}`}><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold text-slate-900">{featureLabel(signal.feature)}</h4><ImpactBadge signal={signal} /></div><p className="mt-2 text-sm leading-relaxed text-slate-700">{signal.policy}</p></article>)}</div></details>
}

function EmptySignals({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-5 py-10 text-center"><ShieldCheck className="mx-auto size-7 text-slate-400" /><p role="status" className="mt-3 text-sm text-slate-600">{text}</p></div> }

function actualValue(feature: string, features: Features) {
  const value = features[feature]
  if (value === undefined || value === null || value === "") return "Chưa cập nhật"
  if (feature === "Hire_Date") return String(value).split("-").reverse().join("/")
  if (feature === "Gender") return ({ Male: "Nam", Female: "Nữ", Other: "Khác" } as Record<string, string>)[String(value)] ?? String(value)
  if (feature === "Education_Level") return ({ Bachelor: "Đại học", Master: "Thạc sĩ", PhD: "Tiến sĩ", "High School": "Trung học phổ thông" } as Record<string, string>)[String(value)] ?? String(value)
  const number = Number(value)
  const shown = Number.isFinite(number) ? number.toLocaleString("vi-VN", { maximumFractionDigits: 2 }) : String(value)
  const unit: Record<string, string> = { Age: " tuổi", Years_At_Company: " năm", Monthly_Salary: " USD/tháng", Work_Hours_Per_Week: " giờ/tuần", Overtime_Hours: " giờ", Sick_Days: " ngày", Promotions: " lần", Employee_Satisfaction_Score: "/5" }
  return shown + (unit[feature] ?? "")
}

function dateInputValue(value?: string | null) { if (!value) return ""; const match = value.match(/^\d{4}-\d{2}-\d{2}/); return match?.[0] ?? "" }
function formatDateTimeVi(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" }).format(date) }
function formatEvidenceDate(value: string) { if (/^\d{4}-\d{2}$/.test(value)) { const [year, month] = value.split("-"); return `Tháng ${month}/${year}` } const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Bangkok" }).format(date) }
function formatEvidenceAnswer(value: unknown): string { if (value === undefined || value === null || value === "") return ""; if (Array.isArray(value)) return value.map(formatEvidenceAnswer).join(", "); if (typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([key, entry]) => `${key}: ${formatEvidenceAnswer(entry)}`).join(" · "); return String(value) }
function minutesToHours(value?: number) { return typeof value === "number" ? `${(value / 60).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} giờ` : "—" }
function formatMinutes(value?: number) { return typeof value === "number" ? `${value.toLocaleString("vi-VN")} phút` : "—" }
function friendlyCategory(value: string) { const labels: Record<string, string> = { WORKING_TIME: "Thời gian làm việc", COMPENSATION_BENEFITS: "Thu nhập & Phúc lợi", WORK_ENVIRONMENT: "Môi trường làm việc", CAREER_DEVELOPMENT: "Phát triển sự nghiệp", MANAGEMENT: "Năng lực quản lý", EMPLOYEE_ENGAGEMENT: "Mức độ gắn kết", WORK_LIFE_BALANCE: "Cân bằng công việc", COMMUNICATION_CULTURE: "Văn hóa giao tiếp", JOB_FIT: "Mức độ phù hợp công việc" }; return labels[value] ?? value.replace(/_/g, " ").toLocaleLowerCase("vi-VN") }
