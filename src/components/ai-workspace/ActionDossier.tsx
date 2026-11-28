import { ChevronRight, Compass, FileCheck2 } from "lucide-react"
import { useAiTr } from "./aiWorkspaceLanguage"
import { useLanguage } from "../../context/LanguageContext"
import { featureLabel } from "./analysis"
import type { AiPolicyEvidence, AiUnifiedPolicyAnalysis } from "../../services/api"

export function ActionDossier({ analysis }: { analysis: AiUnifiedPolicyAnalysis }) {
  const tr = useAiTr()
  const { language } = useLanguage()
  if (!analysis.recommendations.length) return <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6"><h3 className="font-semibold text-emerald-900">{tr("Chưa có kế hoạch hành động phù hợp")}</h3><p className="mt-1 text-sm leading-6 text-emerald-800">{analysis.noRecommendationReason || tr("Thông tin trong kỳ chưa đủ để hình thành khuyến nghị có căn cứ.")}</p></section>
  return <section className="space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
      <div>
        <h3 className="text-base font-semibold text-slate-900">{tr("Hồ sơ hành động & khuyến nghị")}</h3>
        <p className="mt-1 text-xs text-slate-600">{tr("Các định hướng giữ chân đề xuất dựa trên dữ liệu đối soát thực tế.")}</p>
      </div>
      <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-800">{analysis.recommendations.length} {tr("kế hoạch đề xuất")}</span>
    </header>
    {analysis.generatedAt && <p className="text-xs text-slate-600">{tr("Tạo lúc")} {dateTime(analysis.generatedAt, language)}</p>}
    {analysis.recommendations.map((item, index) => <RecommendationCard key={`${item.policy.id}-${index}`} item={item} number={index + 1} />)}
  </section>
}

function RecommendationCard({ item, number }: { item: AiUnifiedPolicyAnalysis["recommendations"][number]; number: number }) {
  const tr = useAiTr()
  return <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 pt-6 shadow-sm transition-shadow hover:shadow-md">
    <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500 to-amber-400" />
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
      <h4 className="flex min-w-0 items-start gap-2.5 text-sm font-semibold text-slate-950">
        <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-orange-600 text-xs text-white">{String(number).padStart(2, "0")}</span>
        <span className="min-w-0 [overflow-wrap:anywhere]">{item.policy.name}</span>
      </h4>
    </header>
    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
      <section className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
        <h5 className="flex items-center gap-1.5 text-xs font-semibold text-slate-800"><Compass aria-hidden="true" className="size-3.5 shrink-0 text-orange-700" />{tr("Hướng xử lý đề xuất")}</h5>
        {item.policy.description && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">{item.policy.description}</p>}
        {item.hrVerification && <><h5 className="mt-3 text-xs font-semibold text-slate-700">{tr("Nhân sự cần xác minh")}</h5><p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">{item.hrVerification}</p></>}
      </section>
      <section className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 [overflow-wrap:anywhere]">
        <h5 className="flex items-center gap-1.5 text-xs font-semibold text-slate-800"><FileCheck2 aria-hidden="true" className="size-3.5 shrink-0 text-emerald-700" />{tr("Căn cứ thực tế")}</h5>
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{item.reason}</p>
        {item.evidence.length > 0 && <details className="group mt-3 border-t border-slate-200 pt-2">
          <summary className="flex cursor-pointer items-center gap-1 rounded-md py-1 text-xs font-semibold text-orange-800 hover:underline focus-visible:outline-2 focus-visible:outline-orange-500">{tr("Xem chi tiết dẫn chứng")} ({item.evidence.length}) <ChevronRight aria-hidden="true" className="size-3 group-open:rotate-90" /></summary>
          <div className="mt-2 grid gap-2">{item.evidence.map((evidence, index) => <EvidenceCard key={evidence.id || index} evidence={evidence} />)}</div>
        </details>}
      </section>
    </div>
  </article>
}


export function EvidenceCard({ evidence }: { evidence: AiPolicyEvidence }) {
  const tr = useAiTr()
  const { language } = useLanguage()
  const source = String(evidence.source || "EVIDENCE").toUpperCase()
  const label = source === "SURVEY" ? `${tr("Khảo sát")}${evidence.survey_id ? ` #${evidence.survey_id}` : ""}` : source === "ATTENDANCE" ? tr("Chấm công") : source === "MODEL" ? tr("Thông tin hồ sơ") : tr("Bằng chứng")
  const answer = formatAnswer(evidence.answer_value ?? evidence.comment)
  return <article className="rounded-xl border border-white/70 bg-white p-3 shadow-sm"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">{label}</span>{(evidence.submitted_at || evidence.month) && <span className="ml-auto text-xs text-slate-600">{formatDate(String(evidence.submitted_at || evidence.month), language, tr)}</span>}</div>{source === "SURVEY" && <blockquote className="mt-3 rounded-r-lg border-l-2 border-orange-400 bg-orange-50/30 py-2 pl-3 text-sm italic leading-6 text-slate-700">{evidence.question_text && <span className="mb-1 block not-italic font-medium text-slate-700">{evidence.question_text}</span>}{answer || tr("Chưa có nội dung phản hồi dạng văn bản.")}</blockquote>}{source === "ATTENDANCE" && <div className="mt-3 grid grid-cols-2 gap-2"><Metric label={tr("Ngày ghi nhận")} value={evidence.recordedDays} /><Metric label={tr("Giờ làm")} value={hours(evidence.workingMinutes, tr)} /><Metric label={tr("Tăng ca")} value={hours(evidence.overtimeMinutes, tr)} /><Metric label={tr("Đi muộn / Về sớm")} value={`${minutes(evidence.lateMinutes, tr)} / ${minutes(evidence.earlyMinutes, tr)}`} /></div>}{source === "MODEL" && <p className="mt-3 text-sm text-slate-700"><strong>{tr(featureLabel(String(evidence.feature || "")))}:</strong> {formatAnswer(evidence.value) || "—"}</p>}</article>
}
function Metric({ label, value }: { label: string; value: unknown }) {
  return <div className="rounded-lg bg-slate-50 p-2.5"><span className="block text-xs text-slate-600">{label}</span><strong className="mt-1 block text-sm">{value === undefined || value === null ? "—" : String(value)}</strong></div> }
function formatAnswer(value: unknown): string { if (value === undefined || value === null || value === "") return ""; if (Array.isArray(value)) return value.map(formatAnswer).join(", "); if (typeof value === "object") return Object.values(value as Record<string, unknown>).map(formatAnswer).filter(Boolean).join(" · "); return String(value) }
type AiTr = ReturnType<typeof useAiTr>
function hours(value: number | undefined, tr: AiTr) { return typeof value === "number" ? `${(value / 60).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ${tr("giờ")}` : "—" }
function minutes(value: number | undefined, tr: AiTr) { return typeof value === "number" ? `${value.toLocaleString("vi-VN")} ${tr("phút")}` : "—" }
function formatDate(value: string, language: "vi" | "en", tr: AiTr) { if (/^\d{4}-\d{2}$/.test(value)) return `${tr("Tháng")} ${value.slice(5)}/${value.slice(0, 4)}`; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", { timeZone: "Asia/Ho_Chi_Minh" }).format(date) }
function dateTime(value: string, language: "vi" | "en") { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-US", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }).format(date) }
