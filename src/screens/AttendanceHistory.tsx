import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { useAutoDismissState } from '../hooks/useAutoDismissState';
import {
  getApiErrorMessage, getAttendanceConfig, getAttendanceRecord, listAttendanceHistory, listAttendanceHolidays, createAttendanceHoliday, updateAttendanceHoliday, deleteAttendanceHoliday, type AttendanceHoliday,
  type AttendanceHistoryRecord,
} from '../services/api';

type AttendanceConfig = Awaited<ReturnType<typeof getAttendanceConfig>>;

export default function AttendanceHistory({ holidaysPage = false }: { holidaysPage?: boolean }) {
  const { t, language } = useLanguage();
  const [rows, setRows] = useState<AttendanceHistoryRecord[]>([]);
  const [config, setConfig] = useState<AttendanceConfig | null>(null);
  const [selected, setSelected] = useState<AttendanceHistoryRecord | null>(null);
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useAutoDismissState();
  const [reload, setReload] = useState(0);
  const [holidays, setHolidays] = useState<AttendanceHoliday[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(true);
  const [holidaysFailed, setHolidaysFailed] = useState(false);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayEndDate, setHolidayEndDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [editingHoliday, setEditingHoliday] = useState<AttendanceHoliday | null>(null);
  const [notice, setNotice] = useAutoDismissState();
  const [saving, setSaving] = useState(false);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());


  useEffect(() => {
    if (holidaysPage) return;
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
  }, [reload, holidaysPage]);

  useEffect(() => {
    if (!holidaysPage) return;
    const controller = new AbortController();
    setHolidaysLoading(true);
    setHolidaysFailed(false);
    void listAttendanceHolidays(controller.signal)
      .then(result => { if (!controller.signal.aborted) setHolidays(result.data); })
      .catch(cause => { if (!controller.signal.aborted) { setHolidaysFailed(true); setError(getApiErrorMessage(cause, 'Không tải được ngày lễ.')); } })
      .finally(() => { if (!controller.signal.aborted) setHolidaysLoading(false); });
    return () => controller.abort();
  }, [reload, holidaysPage]);
  async function saveHoliday(event: React.FormEvent) {
    event.preventDefault(); if (saving || !holidayName.trim()) return; setSaving(true); setError(''); setNotice('');
    try {
      const input = { start_date: holidayDate, end_date: holidayEndDate, name: holidayName.trim() };
      if (editingHoliday) await updateAttendanceHoliday(editingHoliday.id, input); else await createAttendanceHoliday(input);
      setHolidayDate(''); setHolidayEndDate(''); setHolidayName(''); setEditingHoliday(null); setNotice('Đã lưu ngày lễ.'); setReload(value => value + 1);
    } catch (cause) { setError(getApiErrorMessage(cause, 'Không lưu được ngày lễ.')); } finally { setSaving(false); }
  }
  async function removeHoliday(day: AttendanceHoliday) {
    if (saving || !window.confirm(t('Xóa ngày lễ này? Ngày lễ sẽ không còn được áp dụng.'))) return;
    setSaving(true); setError(''); setNotice('');
    try { await deleteAttendanceHoliday(day.id); if (editingHoliday?.id === day.id) { setEditingHoliday(null); setHolidayDate(''); setHolidayEndDate(''); setHolidayName(''); } setNotice('Đã xóa ngày lễ.'); setReload(value => value + 1); }
    catch (cause) { setError(getApiErrorMessage(cause, 'Không xóa được ngày lễ.')); } finally { setSaving(false); }
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

  const lastWeek = new Date(`${today}T00:00:00Z`);
  lastWeek.setUTCDate(lastWeek.getUTCDate() - 6);
  const start = period === 'today' ? today : period === 'week' ? lastWeek.toISOString().slice(0, 10)
    : period === 'month' ? `${today.slice(0, 7)}-01` : period === 'custom' ? fromDate : '';
  const end = period === 'custom' ? toDate : period === 'all' ? '' : today;
  const invalidRange = Boolean(start && end && start > end);
  const filtered = rows.filter(row => !invalidRange && (!start || row.workDate >= start) && (!end || row.workDate <= end)
    && `${row.employeeCode} ${row.fullName} ${row.workDate} ${row.attendanceStatus}`
      .toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const time = (value: string | null) => value ? new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
    timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(value)) : '—';

  return <AppShell breadcrumb={['Workforce', holidaysPage ? 'Holidays' : 'Attendance history']}>
    <SectionHeader title={t(holidaysPage ? 'Holidays' : 'Attendance history')} description={t(holidaysPage ? 'Manage company holidays.' : 'Review employee attendance records from the server.')}>
      <Button variant="secondary" disabled={holidaysPage ? holidaysLoading : loading} onClick={() => setReload(value => value + 1)}>{t('Reload')}</Button>
    </SectionHeader>
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{t(error)}</p>}
    {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{t(notice)}</p>}
    {holidaysPage && <Card className="mb-4 p-5 sm:p-6">
      <h2 className="text-base font-bold text-slate-900">{t('Holidays')}</h2>
      <div className="mt-5">
        {holidaysPage && <section aria-labelledby="holiday-form-heading" className="min-w-0 rounded-2xl border border-orange-100 bg-orange-50/30 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600"><CalendarDays size={20} /></span>
            <div><h3 id="holiday-form-heading" className="font-semibold text-slate-900">{t(editingHoliday ? 'Chỉnh sửa ngày lễ' : 'Thêm ngày lễ')}</h3><p className="mt-1 text-sm leading-5 text-slate-500">{t('Ngày lễ có thể kéo dài nhiều ngày. Chỉ sửa hoặc xóa khi ngày lễ chưa bắt đầu theo giờ Việt Nam.')}</p></div>
          </div>
          <form onSubmit={saveHoliday} className="mt-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="min-w-0 text-sm font-medium text-slate-700">{t('Ngày bắt đầu')}<input required type="date" min={today} value={holidayDate} onChange={e => setHolidayDate(e.target.value)} className="mt-1.5 block w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3 font-normal focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></label>
              <label className="min-w-0 text-sm font-medium text-slate-700">{t('Ngày kết thúc')}<input required type="date" min={holidayDate || today} value={holidayEndDate} onChange={e => setHolidayEndDate(e.target.value)} className="mt-1.5 block w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3 font-normal focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></label>
              <label className="min-w-0 text-sm font-medium text-slate-700 sm:col-span-2">{t('Tên ngày lễ')}<input required maxLength={150} value={holidayName} onChange={e => setHolidayName(e.target.value)} className="mt-1.5 block w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3 font-normal focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100" /></label>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{t('Nếu nghỉ một ngày, hãy chọn ngày bắt đầu và kết thúc giống nhau.')}</p>
            <div className="mt-4 flex flex-wrap gap-2"><Button disabled={saving}>{t(editingHoliday ? 'Lưu thay đổi' : 'Lưu ngày lễ')}</Button>{editingHoliday && <Button type="button" variant="secondary" onClick={() => { setEditingHoliday(null); setHolidayDate(''); setHolidayEndDate(''); setHolidayName(''); }}>{t('Hủy')}</Button>}</div>
          </form>
        </section>}

      </div>
      {holidaysPage && <section aria-labelledby="holidays-heading" className="mt-6 border-t border-slate-100 pt-5">
        <h3 id="holidays-heading" className="font-semibold text-slate-900">{t('Danh sách ngày lễ đã lưu')}</h3>
        {holidaysLoading ? <p role="status" className="mt-3 text-sm text-slate-500">{t('Đang tải ngày lễ...')}</p>
          : holidaysFailed ? <div className="mt-3"><p className="text-sm text-slate-600">{t('Không tải được danh sách ngày lễ.')}</p><Button className="mt-2" variant="secondary" onClick={() => setReload(value => value + 1)}>{t('Tải lại')}</Button></div>
          : holidays.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{holidays.map(day => <li key={day.id} className="rounded-xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-sm"><div className="font-semibold text-orange-700"><time dateTime={day.start_date}>{day.start_date}</time>{day.end_date !== day.start_date && <> – <time dateTime={day.end_date}>{day.end_date}</time></>}</div><p className="mt-1 break-words font-medium text-slate-800">{day.name}</p>{day.start_date > today ? <div className="mt-3 flex gap-2"><Button type="button" size="sm" variant="secondary" disabled={saving} onClick={() => { setEditingHoliday(day); setHolidayDate(day.start_date); setHolidayEndDate(day.end_date); setHolidayName(day.name); }}>{t('Chỉnh sửa')}</Button><Button type="button" size="sm" variant="secondary" disabled={saving} onClick={() => void removeHoliday(day)}>{t('Xóa')}</Button></div> : <p className="mt-2 text-xs text-slate-500">{t('Ngày lễ đã bắt đầu, không thể sửa hoặc xóa.')}</p>}</li>)}</ul>
          : <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{t('Chưa có ngày lễ.')}</p>}
      </section>}
    </Card>}
    {!holidaysPage && <>
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
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="block text-sm font-medium text-slate-700">{t('Search employee or date')}
          <input type="search" className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" value={query} onChange={event => setQuery(event.target.value)} />
        </label>
        <label className="block text-sm font-medium text-slate-700">{t('Time period')}
          <select className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" value={period} onChange={event => setPeriod(event.target.value)}>
            <option value="all">{t('All time')}</option><option value="today">{t('Today')}</option>
            <option value="week">{t('Last 7 days')}</option><option value="month">{t('This month')}</option>
            <option value="custom">{t('Custom date range')}</option>
          </select>
        </label>
        {period === 'custom' && <>
          <label className="block text-sm font-medium text-slate-700">{t('From date')}<input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" /></label>
          <label className="block text-sm font-medium text-slate-700">{t('To date')}<input type="date" value={toDate} onChange={event => setToDate(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" /></label>
        </>}
      </div>
      {invalidRange && <p role="alert" className="mb-4 text-sm text-red-700">{t('End date must not be earlier than start date.')}</p>}
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
        {!invalidRange && !filtered.length && <p className="py-8 text-center text-sm text-slate-500">{t('No attendance records found.')}</p>}</div>}
    </Card>
    </>}
  </AppShell>;
}
