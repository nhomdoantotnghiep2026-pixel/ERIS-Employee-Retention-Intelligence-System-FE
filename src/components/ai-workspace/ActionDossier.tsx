import { useAiTr } from "./aiWorkspaceLanguage"
import { useLanguage } from "../../context/LanguageContext"
import { featureLabel } from "./analysis"
import type { AiPolicyEvidence, AiUnifiedPolicyAnalysis } from "../../services/api"

export function ActionDossier({ analysis }: { analysis: AiUnifiedPolicyAnalysis }) {
  const tr = useAiTr()
  const { language } = useLanguage()
  if (!analysis.recommendations.length) return <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6"><h3 className="font-semibold text-emerald-900">{tr("Chưa có kế hoạch hành động phù hợp")}</h3><p className="mt-1 text-sm leading-6 text-emerald-800">{analysis.noRecommendationReason || tr("Thông tin trong kỳ chưa đủ để hình thành khuyến nghị có căn cứ.")}</p></section>
  return <section className="space-y-5"><header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-slate-600">{tr("Hồ sơ hành động điều hành")}</p><h3 className="mt-1 text-lg font-semibold tracking-tight">{analysis.recommendations.length} {tr("kế hoạch cần Nhân sự xem xét")}</h3></div>{analysis.generatedAt && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{tr("Tạo lúc")} {dateTime(analysis.generatedAt, language)}</span>}</header>{analysis.recommendations.map((item, index) => <RecommendationCard key={`${item.policy.id}-${index}`} item={item} />)}</section>
}

function RecommendationCard({ item }: { item: AiUnifiedPolicyAnalysis["recommendations"][number] }) {
  const tr = useAiTr()
  return <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 pt-6 shadow-sm transition-shadow hover:shadow-md">
    <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500 to-amber-400" />
    <div className="grid gap-4 divide-y divide-slate-100 md:grid-cols-2 md:divide-y-0 xl:grid-cols-[2fr_2fr_1fr_1.4fr] xl:divide-x">
      <section className="min-w-0 xl:pr-4">
        <h4 className="break-words text-sm font-semibold text-slate-950">{item.policy.name}</h4>
        {item.policy.description && <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-slate-700">{item.policy.description}</p>}
      </section>
      <section className="min-w-0 pt-3 md:pt-0 xl:px-4">
        <h5 className="text-xs font-semibold text-slate-600">{tr("Căn cứ ghi nhận")}</h5>
        <p className="mt-2 whitespace-pre-line break-words rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm leading-6 text-slate-700">{item.reason}</p>
        {item.evidence.length > 0 && <details className="mt-2">
          <summary className="cursor-pointer rounded-md py-1 text-xs font-semibold text-orange-800 focus-visible:outline-2 focus-visible:outline-orange-500">{tr("Xem dẫn chứng")} ({item.evidence.length})</summary>
          <div className="mt-2 grid gap-2">{item.evidence.map((evidence, index) => <EvidenceCard key={evidence.id || index} evidence={evidence} />)}</div>
        </details>}
      </section>
      <section className="min-w-0 pt-3 md:pt-0 xl:px-4">
        <h5 className="text-xs font-semibold text-slate-600">{tr("Đầu mối phối hợp")}</h5>
        <p className="mt-2 text-sm text-slate-600">{tr("Chưa chỉ định")}</p>
      </section>
      <section className="min-w-0 pt-3 md:pt-0 xl:pl-4">
        <h5 className="text-xs font-semibold text-slate-600">{tr("Mốc đánh giá lại")}</h5>
        <p className="mt-2 text-sm text-slate-600">{tr("Chưa có mốc riêng")}</p>
        {item.hrVerification && <><h5 className="mt-3 text-xs font-semibold text-slate-700">{tr("Nhân sự cần xác minh")}</h5><p className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-slate-700">{item.hrVerification}</p></>}
      </section>
    </div>
  </article>
}


function EvidenceCard({ evidence }: { evidence: AiPolicyEvidence }) {
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
