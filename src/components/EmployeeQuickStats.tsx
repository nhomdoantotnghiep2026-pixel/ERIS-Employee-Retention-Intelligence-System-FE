import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from './ui';
import { Button } from './ui/button';
import { useLanguage } from '../context/LanguageContext';
import { fetchAttendance } from '../services/attendance';

const vietnamDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

export function EmployeeQuickStats({ reload }: { reload: number }) {
  const { language } = useLanguage();
  const tr = (vi: string, en: string) => language === 'vi' ? vi : en;
  const [today, setToday] = useState(vietnamDate);
  const [days, setDays] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setInterval(() => setToday(vietnamDate()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setDays(null); setLoading(true);
    void (async () => {
      const dates = new Set<string>();
      let offset = 0;
      while (!controller.signal.aborted) {
        const result = await fetchAttendance({ from: today.slice(0, 7) + '-01', to: today, record_status: 'ACTIVE', limit: 100, offset }, true, controller.signal);
        for (const row of result.data) {
          if (row.record_status === 'ACTIVE' && row.working_minutes > 0) dates.add(row.work_date.slice(0, 10));
        }
        if (!result.data.length || result.data.length < result.limit) break;
        offset += result.data.length;
      }
      if (!controller.signal.aborted) setDays(dates.size);
    })().catch(() => { if (!controller.signal.aborted) setDays(null); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload, today]);

  const stats = [
    { label: tr('Ngày có ghi nhận chấm công tháng này', 'Recorded attendance days this month'), value: loading ? tr('Đang tải…', 'Loading…') : days === null ? tr('Chưa tải được', 'Could not load') : days + tr(' ngày', ' days'), detail: tr('Số ngày có bản ghi hoạt động và thời gian làm việc lớn hơn 0.', 'Days with active records and positive working time.'), icon: CalendarDays },
  ];
  return <section aria-label={tr('Tóm tắt nhanh', 'Quick stats')} className="h-full min-w-0">
    {stats.map(stat => <Card key={stat.label} className="h-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-full flex-col gap-4 xl:flex-row xl:items-center xl:justify-between xl:gap-5">
      <div className="flex min-w-0 items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><stat.icon size={24} aria-hidden="true" /></span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-sm font-semibold text-slate-900">{stat.label}</h2>
            <p className="text-base font-semibold tabular-nums text-slate-900">{stat.value}</p>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">{stat.detail}</p>
        </div>
      </div>
      <Button asChild variant="outline" className="h-auto shrink-0 self-start rounded-lg border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 xl:self-auto">
        <Link to="/my-attendance">{tr('Chi tiết chấm công →', 'Attendance details →')}</Link>
      </Button>
      </div>
    </Card>)}
  </section>;
}
