import { useEffect, useRef } from 'react'
import { AlertCircle, ArrowRight, ShieldCheck, Compass, Award, Clock, Banknote, Users, Briefcase, GraduationCap, Heart, Timer } from 'lucide-react'
import { Button } from '../ui/button'
import { featureLabel } from './analysis'
import type { buildInsights, Signal } from './insight-engine'

type Engine = ReturnType<typeof buildInsights>
type Features = Record<string, string | number>
const icons = {Hire_Date: Compass, Promotions: Award, Years_At_Company: Clock, Monthly_Salary: Banknote, Department: Users, Education_Level: GraduationCap, Employee_Satisfaction_Score: Heart, Overtime_Hours: Timer, Work_Hours_Per_Week: Clock, Sick_Days: Heart}
const playbook: Record<string, {title: string; phase: 1 | 2 | 3; time: string}> = {
  Hire_Date: {title: 'Hội nhập & Rà soát quyền truy cập', phase: 1, time: 'Trong 14 ngày'},
  Overtime_Hours: {title: 'Điều phối tải việc & Giờ tăng ca', phase: 1, time: 'Trong 14 ngày'},
  Work_Hours_Per_Week: {title: 'Cân đối lịch làm & Khối lượng công việc', phase: 1, time: 'Trong 14 ngày'},
  Sick_Days: {title: 'Hỗ trợ trở lại công việc', phase: 1, time: 'Trong 14 ngày'},
  Employee_Satisfaction_Score: {title: 'Trao đổi trải nghiệm nhân viên', phase: 1, time: 'Trong 14 ngày'},
  Promotions: {title: 'Lộ trình phát triển & Mục tiêu năng lực', phase: 2, time: '60–90 ngày'},
  Years_At_Company: {title: 'Khảo sát nguyện vọng & Đổi mới công việc', phase: 2, time: '60 ngày'},
  Education_Level: {title: 'Phát triển năng lực qua công việc', phase: 2, time: '30–60 ngày'},
  Monthly_Salary: {title: 'Rà soát cơ cấu đãi ngộ theo vai trò', phase: 3, time: 'Định kỳ'},
  Department: {title: 'Duy trì phối hợp & Chuẩn hóa phân công', phase: 3, time: 'Định kỳ'},
}
const phases = [
  {id: 1, eyebrow: 'Giai đoạn 1', title: 'Ưu tiên can thiệp sớm', time: 'Trong 14 ngày'},
  {id: 2, eyebrow: 'Giai đoạn 2', title: 'Kế hoạch trung hạn', time: '30–90 ngày'},
  {id: 3, eyebrow: 'Giai đoạn 3', title: 'Rà soát & Duy trì định kỳ', time: 'Theo chu kỳ'},
] as const

export function InsightPlaybook({engine, tab, focusFeature, onPolicy, features = {}}: {
  engine: Engine; tab: 'insights' | 'policies'; focusFeature: string | null; onPolicy: (feature: string) => void; features?: Features
}) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (tab !== 'policies' || !focusFeature) return
    const element = root.current?.querySelector<HTMLElement>(`[data-policy="${focusFeature}"]`)
    element?.scrollIntoView({behavior: 'smooth', block: 'center'})
    element?.focus({preventScroll: true})
  }, [tab, focusFeature])
  if (engine.missingContributions) return <p role="status" className="py-8 text-sm text-slate-600">Chưa có thông tin về các yếu tố tác động cho lần đánh giá này.</p>
  if (!engine.selected.length) return <p role="status" className="py-8 text-sm text-slate-600">Chưa ghi nhận yếu tố biến động vượt ngưỡng cảnh báo</p>
  const groups = [
    {items: engine.positive, risk: true, title: 'Tín hiệu rủi ro cần lưu ý', badge: `${engine.positive.length} yếu tố cần can thiệp`},
    {items: engine.negative, risk: false, title: 'Điểm tựa giữ chân tích cực', badge: `${engine.negative.length} thế mạnh duy trì`},
  ]
  return <div ref={root}>
    {tab === 'insights' ? <div className="space-y-7">{groups.filter(g => g.items.length).map(group => <section key={group.title}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2.5 font-semibold text-slate-900">{group.risk ? <AlertCircle className="size-5 text-rose-600" /> : <ShieldCheck className="size-5 text-emerald-600" />}{group.title}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${group.risk ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{group.badge}</span></div>
      <div className="grid gap-3">{group.items.map(signal => {
        const Icon = icons[signal.feature as keyof typeof icons] ?? Briefcase
        return <article key={signal.feature} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex flex-wrap items-center gap-2"><span className={`rounded-lg p-2 ${group.risk ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}><Icon className="size-4" /></span><h4 className="mr-auto text-sm font-semibold text-slate-900">{featureLabel(signal.feature)}</h4><span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">Thực tế: {actualValue(signal.feature, features)}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${group.risk ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{group.risk ? 'Cần can thiệp' : 'Cần duy trì'}</span></div>
          <p className="mt-3 text-sm font-medium leading-[1.6] text-slate-700">{signal.insight}</p>
          <Button variant="link" className="mt-2 h-auto whitespace-normal p-0 text-left text-indigo-700" onClick={() => onPolicy(signal.feature)}>Xem giải pháp tương ứng [Tab 3] <ArrowRight className="size-4" /></Button>
        </article>
      })}</div>
    </section>)}</div> : <div className="space-y-7">
      <header><p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Executive Action Roadmap</p><h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Lộ trình can thiệp & Kế hoạch giữ chân</h3><p className="mt-1 text-sm text-slate-600">Các bước hành động đề xuất dành cho HR và Quản lý trực tiếp</p></header>
      {phases.map(phase => {
        const items = engine.selected.filter(signal => (playbook[signal.feature]?.phase ?? (signal.direction === 'positive' ? 2 : 3)) === phase.id)
        if (!items.length) return null
        return <section key={phase.id}>
          <div className="mb-3 flex items-end justify-between gap-3 border-b border-slate-200 pb-2"><div><p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">{phase.eyebrow}</p><h4 className="mt-0.5 font-semibold text-slate-900">{phase.title}</h4></div><span className="text-xs font-medium text-slate-500">{phase.time}</span></div>
          <div className="grid gap-3">{items.map(signal => {
            const item = playbook[signal.feature] ?? {title: featureLabel(signal.feature), time: deadline(signal)}
            return <article key={signal.feature} data-policy={signal.feature} tabIndex={-1} className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md focus:outline-2 focus:outline-indigo-400">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h5 className="font-semibold text-slate-900">{item.title}</h5><span className="mt-1.5 inline-flex rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">{featureLabel(signal.feature)}</span></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">⏳ {item.time}</span></div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-y border-slate-100 py-2 text-xs text-slate-600"><span>⏳ Hạn: {item.time}</span><span>👤 Phụ trách: Quản lý trực tiếp & HR</span></div>
              <p className="mt-3 text-sm leading-[1.65] text-slate-700">{signal.policy}</p>
              <label className="mt-4 flex cursor-pointer items-center gap-2 border-t border-slate-100 pt-3 text-sm font-medium text-slate-700"><input type="checkbox" className="size-4 rounded border-slate-300 accent-indigo-600" />Đã đưa vào kế hoạch làm việc tuần này</label>
            </article>
          })}</div>
        </section>
      })}
    </div>}
  </div>
}

function actualValue(feature: string, features: Features) {
  const value = features[feature]
  if (value === undefined || value === null || value === '') return 'Chưa cập nhật'
  if (feature === 'Hire_Date') return String(value).split('-').reverse().join('/')
  if (feature === 'Gender') return ({Male: 'Nam', Female: 'Nữ', Other: 'Khác'} as Record<string,string>)[String(value)] ?? String(value)
  if (feature === 'Education_Level') return ({Bachelor: 'Đại học', Master: 'Thạc sĩ', PhD: 'Tiến sĩ', 'High School': 'Trung học phổ thông'} as Record<string,string>)[String(value)] ?? String(value)
  const number = Number(value)
  const shown = Number.isFinite(number) ? number.toLocaleString('vi-VN', {maximumFractionDigits: 2}) : String(value)
  const unit: Record<string,string> = {Age: ' tuổi', Years_At_Company: ' năm', Monthly_Salary: ' USD/tháng', Work_Hours_Per_Week: ' giờ/tuần', Overtime_Hours: ' giờ', Sick_Days: ' ngày', Promotions: ' lần', Employee_Satisfaction_Score: '/5'}
  return shown + (unit[feature] ?? '')
}
function deadline(signal: Signal) {
  const policy = signal.policy ?? ''
  if (/hai tuần|một đến hai tuần/.test(policy)) return 'Trong 14 ngày'
  if (policy.includes('2–4 tuần')) return 'Trong 2–4 tuần'
  if (policy.includes('60–90 ngày')) return '60–90 ngày'
  if (policy.includes('60 ngày')) return '60 ngày'
  if (policy.includes('30–60 ngày')) return '30–60 ngày'
  return 'Định kỳ'
}

