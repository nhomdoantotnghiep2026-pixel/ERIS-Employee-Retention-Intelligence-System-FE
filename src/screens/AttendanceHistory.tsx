import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { useAutoDismissState } from '../hooks/useAutoDismissState';
import {
  getApiErrorMessage, getAttendanceConfig, getAttendanceRecord, listAttendanceHistory, listAttendanceHolidays, createAttendanceHoliday, closeAttendanceDay, type AttendanceHoliday,
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
  const [error, setError] = useAutoDismissState();
  const [reload, setReload] = useState(0);
  const [holidays, setHolidays] = useState<AttendanceHoliday[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(true);
  const [holidaysFailed, setHolidaysFailed] = useState(false);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [notice, setNotice] = useAutoDismissState();
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    const controller = new AbortController();
    setHolidaysLoading(true);
    setHolidaysFailed(false);
    void listAttendanceHolidays(controller.signal)
      .then(result => { if (!controller.signal.aborted) setHolidays(result.data); })
      .catch(cause => { if (!controller.signal.aborted) { setHolidaysFailed(true); setError(getApiErrorMessage(cause, 'Không tải được ngày lễ.')); } })
      .finally(() => { if (!controller.signal.aborted) setHolidaysLoading(false); });
    return () => controller.abort();
  }, [reload]);
  async function saveHoliday(event: React.FormEvent) {
    event.preventDefault(); if (saving || !holidayName.trim()) return; setSaving(true); setError(''); setNotice('');
    try { await createAttendanceHoliday({date: holidayDate, name: holidayName.trim()}); setHolidayDate(''); setHolidayName(''); setNotice('Đã lưu ngày lễ.'); setReload(value => value + 1); } catch (cause) { setError(getApiErrorMessage(cause, 'Không lưu được ngày lễ.')); } finally { setSaving(false); }
  }
  async function closeDay(event: React.FormEvent) {
    event.preventDefault(); if (saving || !window.confirm('Chốt ngày công này? Hệ thống sẽ ghi vắng mặt theo dữ liệu hiện có.')) return; setSaving(true); setError(''); setNotice('');
    try { const result = await closeAttendanceDay(closeDate); setNotice(`Đã chốt ngày ${result.date}: tạo ${result.created} bản ghi.`); setReload(value => value + 1); } catch (cause) { setError(getApiErrorMessage(cause, 'Không chốt được ngày công.')); } finally { setSaving(false); }
  }

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
    {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</p>}
    <Card className="mb-4 p-5">
      <h2 className="font-bold">{t('Ngày nghỉ lễ và chốt ngày công')}</h2>
      <form onSubmit={saveHoliday} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm">{t('Ngày lễ')}<input required type="date" value={holidayDate} onChange={e => setHolidayDate(e.target.value)} className="mt-1 block rounded-xl border border-slate-300 p-2" /></label>
        <label className="text-sm">{t('Tên ngày lễ')}<input required maxLength={150} value={holidayName} onChange={e => setHolidayName(e.target.value)} className="mt-1 block rounded-xl border border-slate-300 p-2" /></label>
        <Button disabled={saving}>{t('Lưu ngày lễ')}</Button>
      </form>
      <form onSubmit={closeDay} className="mt-5 flex flex-wrap items-end gap-3">
        <label className="text-sm">{t('Ngày công đã qua')}<input required type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} className="mt-1 block rounded-xl border border-slate-300 p-2" /></label>
        <Button variant="secondary" disabled={saving}>{t('Chốt ngày công')}</Button>
      </form>
      <section aria-labelledby="holidays-heading" className="mt-6 border-t border-slate-100 pt-5">
        <h3 id="holidays-heading" className="font-semibold text-slate-900">{t('Danh sách ngày lễ đã lưu')}</h3>
        {holidaysLoading ? <p role="status" className="mt-3 text-sm text-slate-500">{t('Đang tải ngày lễ...')}</p>
          : holidaysFailed ? <div className="mt-3"><p className="text-sm text-slate-600">{t('Không tải được danh sách ngày lễ.')}</p><Button className="mt-2" variant="secondary" onClick={() => setReload(value => value + 1)}>{t('Tải lại')}</Button></div>
          : holidays.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{holidays.map(day => <li key={day.date} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-sm"><time dateTime={day.date} className="font-semibold text-orange-700">{day.date}</time><span className="break-words font-medium text-slate-800">{day.name}</span></li>)}</ul>
          : <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{t('Chưa có ngày lễ.')}</p>}
      </section>
    </Card>
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
