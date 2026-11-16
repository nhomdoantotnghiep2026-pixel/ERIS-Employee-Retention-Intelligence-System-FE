import AttendanceWorkspace from './AttendanceWorkspace';
import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { useAutoDismissState } from '../hooks/useAutoDismissState';

import {
  getApiErrorMessage, listAttendanceHolidays, createAttendanceHoliday, updateAttendanceHoliday, deleteAttendanceHoliday, type AttendanceHoliday,

} from '../services/api';


function HolidayManagement({ holidaysPage = false }: { holidaysPage?: boolean }) {
  const { t, language } = useLanguage();
  const tr = (vi: string, en: string) => language === 'vi' ? vi : en;
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
  return <AppShell breadcrumb={['Workforce', holidaysPage ? 'Holidays' : 'Attendance history']}>
    <SectionHeader title={t(holidaysPage ? 'Holidays' : 'Attendance history')} description={t(holidaysPage ? 'Manage company holidays.' : 'Review employee attendance records from the server.')}>
      <Button variant="secondary" disabled={holidaysLoading} onClick={() => setReload(value => value + 1)}>{t('Reload')}</Button>
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

  </AppShell>;
}

export default function AttendanceHistory({holidaysPage=false}:{holidaysPage?:boolean}) { return holidaysPage ? <HolidayManagement holidaysPage /> : <AttendanceWorkspace />; }