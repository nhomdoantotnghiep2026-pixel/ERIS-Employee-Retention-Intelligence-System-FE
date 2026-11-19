import { overviewScoreBins } from '../utils/retentionOverview';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useLanguage } from '../context/LanguageContext';

export function OverviewChartPanel({title, description, children}: {title: string; description: string; children: React.ReactNode}) {
 return <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4"><h2 className="text-base font-bold text-slate-900">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-600">{description}</p><div className="mt-4">{children}</div></section>;
}
export function EligibilityDonut({total, eligible}: {total: number | null; eligible: number | null}) {
 const {language}=useLanguage();const tr=(vi:string,en:string)=>language==='vi'?vi:en;
 const available=total!==null&&eligible!==null;
 const percent=available&&total>0?eligible/total*100:null;
 return <div className="flex min-h-64 flex-col justify-center"><div className="relative mx-auto h-48 w-full max-w-60" role="img" aria-label={available?`${tr('Đủ điều kiện phân tích','Eligible for analysis')}: ${eligible}/${total}`:tr('Chưa có dữ liệu','Data unavailable')}><div className="absolute inset-0" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={available&&total>0?[{value:eligible},{value:Math.max(0,total-eligible)}]:[{value:1}]} dataKey="value" innerRadius="68%" outerRadius="92%" startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}><Cell fill={available&&total>0?'#2563eb':'#e2e8f0'}/><Cell fill="#cbd5e1"/></Pie></PieChart></ResponsiveContainer></div><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><strong className="text-3xl font-bold tabular-nums text-slate-900">{percent===null?'—':`${percent.toFixed(0)}%`}</strong><span className="mt-1 text-xs text-slate-600">{tr('Đủ điều kiện AI','AI eligible')}</span></div></div><div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-slate-700"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-blue-600"/>{tr('Đủ điều kiện','Eligible')}: {available?eligible:'—'}</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-slate-300"/>{tr('Chưa đủ điều kiện','Not eligible')}: {available?Math.max(0,total-eligible):'—'}</span></div></div>;
}
export function ScoreHistogram({scores, available}: {scores: number[]; available: boolean}) {
 const {language}=useLanguage();const tr=(vi:string,en:string)=>language==='vi'?vi:en;
 const counts=overviewScoreBins(scores); const bins=counts.map((count,index)=>({label:index===4?'80–100%':`${index*20}–<${(index+1)*20}%`, count}));const max=Math.max(...bins.map(bin=>bin.count),1);
 return <div className="min-h-64"><div className="flex h-52 items-end gap-3 border-b border-slate-300 px-2 pb-0">{bins.map(bin=><div key={bin.label} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center"><span className="mb-1 text-sm font-semibold tabular-nums text-slate-800">{available?bin.count:'—'}</span><div className="mx-auto w-full max-w-20 rounded-t-sm bg-blue-500" style={{height:available?`${bin.count/max*85}%`:'0%'}}/></div>)}</div><div className="mt-2 flex gap-3 px-2">{bins.map(bin=><span key={bin.label} className="min-w-0 flex-1 text-center text-[11px] text-slate-600">{bin.label}</span>)}</div>{(!available||!scores.length)&&<p className="mt-3 text-center text-xs text-slate-600">{tr('Chưa có kết quả trong phạm vi đã lưu.','No results in the saved scope.')}</p>}</div>;
}
