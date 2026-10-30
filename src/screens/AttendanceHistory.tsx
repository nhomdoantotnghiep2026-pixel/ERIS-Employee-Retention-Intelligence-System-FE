import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { useAutoDismissState } from '../hooks/useAutoDismissState';
import {
  getApiErrorMessage, getAttendanceConfig, getAttendanceRecord, listAttendanceHistory,
  type AttendanceHistoryRecord,
} from '../services/api';

type AttendanceConfig = Awaited<ReturnType<typeof getAttendanceConfig>>;

export default function AttendanceHistory() {
  const { t } = useLanguage();
  const [rows, setRows] = useState<AttendanceHistoryRecord[]>([]);
  const [config, setConfig] = useState<AttendanceConfig | null>(null);
  const [selected, setSelected] = useState<AttendanceHistoryRecord | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useAutoDismissState(7000);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    void Promise.all([listAttendanceHistory(controller.signal), getAttendanceConfig(controller.signal)])
      .then(([history, settings]) => {
        if (controller.signal.aborted) return;
        setRows(history.data); setConfig(settings);
      })
      .catch(cause => {
        if (!controller.signal.aborted) setError(getApiErrorMessage(cause, 'Could not load attendance history.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reload]);

  async function showDetails(id: number) {
    setError('');
    try {
      const { data } = await getAttendanceRecord(id);
      setSelected(data);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not load attendance details.'));
    }
  }

  const filtered = rows.filter(row => `${row.employeeCode} ${row.fullName} ${row.workDate} ${row.attendanceStatus}`
    .toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const time = (value: string | null) => value ? new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(value)) : '—';

  return <AppShell breadcrumb={['Workforce', 'Attendance history']}>
    <SectionHeader title={t('Attendance history')} description={t('Review employee attendance records from the server.')}>
      <Button variant="secondary" disabled={loading} onClick={() => setReload(value => value + 1)}>{t('Reload')}</Button>
    </SectionHeader>
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{t(error)}</p>}
    {config && <Card className="mb-4 p-4">
      <p className="text-sm text-slate-700">{t('Working hours')}: {config.workStart}–{config.workEnd} · {t('Lunch')}: {config.lunchStart}–{config.lunchEnd}</p>
      <p className="mt-1 text-xs text-slate-500">{t('Allowed attendance radius')}: {config.allowedRadiusMeters} m · {t('Maximum GPS accuracy')}: {config.maximumAccuracyMeters} m · {config.timeZone}</p>
    </Card>}
    {selected && <Card className="mb-4 p-5">
      <div className="flex items-start justify-between gap-3"><div>
        <h2 className="font-bold text-slate-900">{selected.fullName} · {selected.employeeCode}</h2>
        <p className="mt-1 text-sm text-slate-500">{selected.workDate} · {t(selected.attendanceStatus)}</p>
      </div><Button variant="secondary" onClick={() => setSelected(null)}>{t('Close')}</Button></div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[[t('Check-in'), time(selected.checkIn)], [t('Check-out'), time(selected.checkOut)],
          [t('Working minutes'), selected.workingMinutes], [t('Overtime minutes'), selected.overtimeMinutes]]
          .map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-800">{value}</dd></div>)}
      </dl>
    </Card>}
    <Card className="p-5">
      <label className="mb-4 block text-sm font-medium text-slate-700">{t('Search employee or date')}
        <input type="search" className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm sm:max-w-md" value={query} onChange={event => setQuery(event.target.value)} />
      </label>
      {loading ? <p role="status" className="py-6 text-sm text-slate-500">{t('Loading attendance records...')}</p>
        : <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="bg-slate-50 text-slate-500"><tr>{['Date', 'Employee', 'Employee code', 'Check-in', 'Check-out', 'Status', ''].map(label =>
            <th key={label} className="p-3 font-medium">{t(label)}</th>)}</tr></thead>
          <tbody>{filtered.map(row => <tr key={row.id} className="border-b border-slate-100">
            <td className="p-3">{row.workDate}</td><td className="p-3 font-medium">{row.fullName}</td>
            <td className="p-3">{row.employeeCode}</td><td className="p-3">{time(row.checkIn)}</td><td className="p-3">{time(row.checkOut)}</td>
            <td className="p-3">{t(row.attendanceStatus)}</td><td className="p-3"><Button size="sm" variant="secondary" onClick={() => void showDetails(row.id)}>{t('Details')}</Button></td>
          </tr>)}</tbody>
        </table>
        {!filtered.length && <p className="py-8 text-center text-sm text-slate-500">{t('No attendance records found.')}</p>}</div>}
    </Card>
  </AppShell>;
}
