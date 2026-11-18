import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, CircleHelp, RefreshCw } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { AppShell } from '../components/AppShell';
import { Card, SectionHeader } from '../components/ui';
import { Button } from '../components/ui/button';
import { ApiError, getBackendHealth, getCurrentUser } from '../services/api';

type State = 'reachable' | 'error' | 'unauthorized' | 'unreachable' | 'timeout';
type Result = { state: State; checkedAt: Date; duration: number; httpStatus?: number };
const probes = [
  { id: 'api', vi: 'Kết nối ERIS', en: 'ERIS connection', run: getBackendHealth },
  { id: 'auth', vi: 'Xác thực phiên đăng nhập', en: 'Session authentication', run: getCurrentUser },
] as const;
export default function SystemHealth() {
  const { language } = useLanguage();
  const tr = (vi: string, en: string) => language === 'vi' ? vi : en;
  const [results, setResults] = useState<Record<string, Result>>({});
  const [checking, setChecking] = useState(false);
  const active = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller; setChecking(true);
    const next: Record<string, Result> = {};
    try {
      await Promise.all(probes.map(async probe => {
        const started = performance.now(), child = new AbortController();
        let timedOut = false;
        const cancel = () => child.abort();
        controller.signal.addEventListener('abort', cancel, { once: true });
        const timer = window.setTimeout(() => { timedOut = true; child.abort(); }, 10000);
        try {
          const response = await probe.run(child.signal);
          next[probe.id] = { state: probe.id === 'api' && response?.status !== 'ok' ? 'error' : 'reachable', checkedAt: new Date(), duration: Math.round(performance.now() - started) };
        } catch (error) {
          const status = error instanceof ApiError ? error.status : undefined;
          next[probe.id] = { state: timedOut ? 'timeout' : status === 401 || status === 403 ? 'unauthorized' : status && status > 0 ? 'error' : 'unreachable', httpStatus: status, checkedAt: new Date(), duration: Math.round(performance.now() - started) };
        } finally { window.clearTimeout(timer); controller.signal.removeEventListener('abort', cancel); }
      }));
      if (!controller.signal.aborted) setResults(next);
    } finally { if (!controller.signal.aborted) setChecking(false); if (active.current === controller) active.current = null; }
  }, []);
  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => { if (!document.hidden) void refresh(); }, 30000);
    return () => { window.clearInterval(interval); active.current?.abort(); active.current = null; };
  }, [refresh]);
  const labels: Record<State, string> = {
    reachable: tr('Kết nối thành công', 'Connection successful'), error: tr('Yêu cầu trả về lỗi', 'Request returned an error'),
    unauthorized: tr('Chưa xác nhận quyền truy cập', 'Access not confirmed'), unreachable: tr('Không kết nối được từ trình duyệt', 'Unreachable from this browser'), timeout: tr('Hết thời gian chờ', 'Request timed out'),
  };
  const successful = Object.values(results).filter(result => result.state === 'reachable').length;
  return <AppShell breadcrumb={['System Operations', 'System Health Monitor']}>
    <SectionHeader title={tr('Kiểm tra kết nối hệ thống', 'System connection checks')} description={tr('Kết quả kiểm tra từ trình duyệt; tự làm mới mỗi 30 giây khi trang đang hiển thị.', 'Browser connection checks; refreshes every 30 seconds while the page is visible.')}>
      <Button variant="outline" className="h-10 gap-2" disabled={checking} onClick={() => void refresh()}><RefreshCw aria-hidden="true" size={16} className={checking ? 'animate-spin motion-reduce:animate-none' : ''} />{tr('Làm mới', 'Refresh')}</Button>
    </SectionHeader>
    <div role="status" className="mb-5 flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700"><CircleHelp aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-orange-600" /><div><p className="font-semibold">{checking ? tr('Đang kiểm tra kết nối…', 'Checking connections…') : tr(`${successful}/2 kiểm tra kết nối thành công`, `${successful}/2 connection checks successful`)}</p><p className="mt-1 leading-6 text-slate-600">{tr('Đây không phải trạng thái của toàn bộ hệ thống. Lỗi kết nối có thể do mạng hoặc quyền truy cập.', 'This is not a whole-system health assessment. Failures may come from the network or access permissions.')}</p></div></div>
    <div className="grid items-stretch gap-4 lg:grid-cols-2">{probes.map(probe => {
      const result = results[probe.id], ok = result?.state === 'reachable';
      const Icon = !result ? CircleHelp : ok ? CheckCircle : AlertCircle;
      return <Card key={probe.id} className="p-5 sm:p-6"><h2 className="text-lg font-semibold text-slate-900">{language === 'vi' ? probe.vi : probe.en}</h2><p className="mt-1 text-sm text-slate-600">{probe.id === 'api' ? tr('Kiểm tra khả năng phản hồi của hệ thống ERIS.', 'Checks whether ERIS responds.') : tr('Kiểm tra phiên đăng nhập đang sử dụng.', 'Checks the current signed-in session.')}</p><div className={`mt-5 flex items-center gap-2 text-sm font-semibold ${!result ? 'text-slate-600' : ok ? 'text-emerald-700' : 'text-amber-800'}`}><Icon aria-hidden="true" className="size-5 shrink-0" />{result ? labels[result.state] : tr('Chưa có kết quả', 'No result yet')}{result?.httpStatus ? ` (HTTP ${result.httpStatus})` : ''}</div><dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm"><div><dt className="text-slate-600">{tr('Thời gian yêu cầu', 'Request duration')}</dt><dd className="mt-1 font-semibold tabular-nums text-slate-900">{result ? `${result.duration} ms` : '—'}</dd></div><div><dt className="text-slate-600">{tr('Kiểm tra lần cuối', 'Last checked')}</dt><dd className="mt-1 font-semibold tabular-nums text-slate-900">{result ? result.checkedAt.toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US') : '—'}</dd></div></dl><p className="mt-4 text-xs leading-5 text-slate-600">{tr('Thời gian yêu cầu bao gồm đường truyền; không phải thời gian xử lý riêng của dịch vụ.', 'Request duration includes network time, not just service processing.')}</p></Card>;
    })}</div>
  </AppShell>;
}
