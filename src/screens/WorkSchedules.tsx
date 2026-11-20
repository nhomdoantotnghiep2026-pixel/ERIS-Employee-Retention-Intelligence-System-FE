import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ChevronDown, ChevronUp, MoreHorizontal, Plus, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import ScheduleImportSettings from '../components/ScheduleImportSettings';
import { Button, Card, SectionHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import {
  createWorkSchedule,
  getApiErrorMessage,
  listWorkSchedules,
  updateWorkSchedule,
  type WorkSchedule,
  type WorkScheduleInput,
} from '../services/api';
import { validScheduleTimeline } from '../utils/scheduleTimeline';

const days = [
  [1, 'Thứ hai', 'Monday'], [2, 'Thứ ba', 'Tuesday'], [3, 'Thứ tư', 'Wednesday'],
  [4, 'Thứ năm', 'Thursday'], [5, 'Thứ sáu', 'Friday'], [6, 'Thứ bảy', 'Saturday'], [7, 'Chủ nhật', 'Sunday'],
] as const;

const initialSchedule: WorkScheduleInput = {
  name: '', shift_type: '', start_time: '08:00', end_time: '17:00',
  break_start: '12:00', break_end: '13:00', working_days: [1, 2, 3, 4, 5], status: 'ACTIVE',
};

const fieldClass = 'mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100';
const time24Pattern = '(?:[01][0-9]|2[0-3]):[0-5][0-9]';

function Time24Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-sm font-semibold text-slate-700">{label}
    <input
      required
      type="text"
      inputMode="numeric"
      maxLength={5}
      pattern={time24Pattern}
      title="HH:mm (00:00–23:59)"
      placeholder="HH:mm"
      className={`${fieldClass} font-mono tabular-nums`}
      value={value}
      onChange={event => onChange(event.target.value.replace(/[^0-9:]/g, ''))}
    />
  </label>;
}

function ScheduleActions({ tr, onSettings, onRename }: {
  tr: (vi: string, en: string) => string;
  onSettings: () => void;
  onRename: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return <div ref={menuRef} className="relative self-end sm:self-auto">
    <button type="button" aria-label={tr('Tùy chọn lịch', 'Schedule options')} aria-expanded={open} onClick={() => setOpen(value => !value)} className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 ${open ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-slate-300 text-slate-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700'}`}><MoreHorizontal size={19} /></button>
    <div aria-hidden={!open} className={`absolute right-0 z-10 mt-2 w-64 origin-top-right rounded-xl border border-slate-200 bg-white p-2 shadow-xl transition-all duration-200 ease-out ${open ? 'visible translate-y-0 scale-100 opacity-100' : 'pointer-events-none invisible -translate-y-1 scale-[0.98] opacity-0'}`}>
      <button className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:bg-orange-50 focus-visible:text-orange-700 focus-visible:outline-none" onClick={() => { setOpen(false); onSettings(); }}>{tr('Cấu hình chấm công nâng cao', 'Advanced attendance settings')}</button>
      <button className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:bg-orange-50 focus-visible:text-orange-700 focus-visible:outline-none" onClick={() => { setOpen(false); onRename(); }}>{tr('Đổi tên', 'Rename')}</button>
    </div>
  </div>;
}

export default function WorkSchedules() {
  const { language } = useLanguage();
  const tr = (vi: string, en: string) => language === 'vi' ? vi : en;
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [form, setForm] = useState<WorkScheduleInput>(initialSchedule);
  const [createOpen, setCreateOpen] = useState(false);
  const [metadata, setMetadata] = useState<WorkSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [shiftType, setShiftType] = useState('ALL');
  const [workingDay, setWorkingDay] = useState<number | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filterOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) setFilterOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFilterOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [filterOpen]);

  useEffect(() => {
    if (!createOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setCreateOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [createOpen, busy]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listWorkSchedules()
      .then((scheduleResult) => {
        if (!active) return;
        setSchedules(scheduleResult.data);
      })
      .catch(reason => active && setError(getApiErrorMessage(reason, tr('Không thể tải dữ liệu lịch làm việc.', 'Unable to load work schedule data.'))))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [revision, language]);

  const visibleSchedules = useMemo(() => schedules.filter(item => {
    const query = search.trim().toLowerCase();
    return (!query || item.name.toLowerCase().includes(query) || (item.shift_type || '').toLowerCase().includes(query))
      && (status === 'ALL' || item.status === status)
      && (shiftType === 'ALL' || item.shift_type === shiftType)
      && (workingDay === null || item.working_days.includes(workingDay));
  }), [schedules, search, status, shiftType, workingDay]);
  const shiftTypes = [...new Set(schedules.map(item => item.shift_type).filter(Boolean))] as string[];
  const activeFilterCount = Number(status !== 'ALL') + Number(shiftType !== 'ALL') + Number(workingDay !== null);

  async function run(action: () => Promise<unknown>, message: string) {
    if (busy) return false;
    setBusy(true); setError(''); setNotice('');
    try {
      await action(); setNotice(message); setRevision(value => value + 1); return true;
    } catch (reason) {
      setError(getApiErrorMessage(reason, tr('Không thể hoàn tất thao tác. Vui lòng thử lại.', 'Unable to complete the action. Please try again.'))); return false;
    } finally { setBusy(false); }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!form.working_days.length) { setError(tr('Vui lòng chọn ít nhất một ngày làm việc.', 'Select at least one working day.')); return; }
    if (!validScheduleTimeline(form.start_time, form.end_time, form.break_start, form.break_end)) {
      setError(tr('Giờ làm việc hoặc giờ nghỉ chưa hợp lệ.', 'Work or break times are invalid.')); return;
    }
    const saved = await run(() => createWorkSchedule({ ...form, name: form.name.trim(), shift_type: form.shift_type?.trim() || null }), tr('Đã tạo lịch làm việc.', 'Work schedule created.'));
    if (saved) { setForm(initialSchedule); setCreateOpen(false); }
  }

  async function rename(schedule: WorkSchedule) {
    const name = window.prompt(tr('Nhập tên lịch mới', 'Enter a new schedule name'), schedule.name)?.trim();
    if (name && name !== schedule.name) await run(() => updateWorkSchedule(schedule.id, { name }), tr('Đã đổi tên lịch.', 'Schedule renamed.'));
  }

  const dayNames = (values: number[]) => values.map(value => {
    const day = days.find(item => item[0] === value);
    return day ? tr(day[1], day[2]) : value;
  }).join(', ');

  return <AppShell breadcrumb={['Work schedules']}>
    <SectionHeader title={tr('Danh mục ca làm việc', 'Work schedule catalogue')} description={tr('Định nghĩa ca để đối chiếu hồ sơ nhập. Mã ca của nhân viên được thu thập trong file hồ sơ nhân sự.', 'Define shifts for import validation. Employee shift codes are collected in employee profile imports.')}>
      <Button onClick={() => { setError(''); setCreateOpen(true); }}><Plus size={16} />{tr('Tạo lịch mới', 'Create schedule')}</Button>
    </SectionHeader>

    {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
    {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{notice}</div>}

    {metadata && <div className="mb-5"><ScheduleImportSettings schedule={metadata} onClose={() => setMetadata(null)} onSaved={() => { setMetadata(null); setRevision(value => value + 1); }} /></div>}

    <div className="space-y-5">
    <Card className="min-w-0 p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-slate-900">{tr('Danh sách lịch làm việc', 'Work schedule list')}</h2><p className="mt-1 text-sm text-slate-600">{tr(`${visibleSchedules.length} lịch`, `${visibleSchedules.length} schedules`)}</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} />{tr('Tải lại', 'Refresh')}</Button><Button variant="secondary" size="sm" onClick={() => setListOpen(value => !value)}>{listOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}{listOpen ? tr('Ẩn danh sách', 'Hide list') : tr('Hiện danh sách', 'Show list')}</Button></div></div>

      {listOpen && <>
      <div className="schedule-search-control relative mt-5 flex min-h-11 items-center rounded-xl border border-slate-300 bg-white transition-[border-color,box-shadow] focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-100">
        <input className="h-11 min-w-0 flex-1 bg-transparent px-4 text-sm text-slate-800 outline-none focus-visible:outline-none" value={search} onChange={event => setSearch(event.target.value)} placeholder={tr('Tìm theo tên hoặc mã ca', 'Search name or shift code')} />
        <div ref={filterRef} className="relative h-full border-l border-slate-200">
          <button type="button" aria-expanded={filterOpen} aria-controls="schedule-filters" onClick={() => setFilterOpen(value => !value)} className={`flex h-11 items-center gap-2 rounded-r-xl px-4 text-sm font-semibold transition-colors duration-150 hover:bg-slate-50 hover:text-orange-700 focus-visible:bg-orange-50 focus-visible:text-orange-700 focus-visible:outline-none ${filterOpen ? 'bg-orange-50 text-orange-700' : 'text-slate-700'}`}><SlidersHorizontal size={16} />{tr('Bộ lọc', 'Filters')}{activeFilterCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-100 px-1 text-xs font-bold text-orange-700">{activeFilterCount}</span>}<ChevronDown size={15} className={`transition-transform duration-200 ${filterOpen ? 'rotate-180' : ''}`} /></button>
          <div id="schedule-filters" aria-hidden={!filterOpen} style={{ width: 'min(560px, calc(100vw - 2rem))' }} className={`absolute right-0 z-20 mt-2 origin-top-right rounded-2xl border border-slate-200 bg-white p-4 shadow-xl transition-all duration-200 ease-out ${filterOpen ? 'visible translate-y-0 scale-100 opacity-100' : 'pointer-events-none invisible -translate-y-1 scale-[0.98] opacity-0'}`}>
            <div className="flex items-center justify-between gap-3"><p className="font-bold text-slate-900">{tr('Lọc danh sách', 'Filter schedules')}</p>{activeFilterCount > 0 && <button className="text-sm font-semibold text-orange-700 hover:underline" onClick={() => { setStatus('ALL'); setShiftType('ALL'); setWorkingDay(null); }}>{tr('Xóa bộ lọc', 'Clear filters')}</button>}</div>
            <fieldset className="mt-4"><legend className="text-sm font-semibold text-slate-700">{tr('Trạng thái', 'Status')}</legend><div className="mt-2 grid grid-cols-3 gap-2">{[['ALL', tr('Tất cả', 'All')], ['ACTIVE', tr('Đang dùng', 'Active')], ['INACTIVE', tr('Ngừng dùng', 'Inactive')]].map(option => <button type="button" key={option[0]} onClick={() => setStatus(option[0])} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${status === option[0] ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{option[1]}</button>)}</div></fieldset>
            <label className="mt-4 block text-sm font-semibold text-slate-700">{tr('Mã ca', 'Shift code')}<select className={fieldClass} value={shiftType} onChange={event => setShiftType(event.target.value)}><option value="ALL">{tr('Tất cả mã ca', 'All shift codes')}</option>{shiftTypes.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
            <fieldset className="mt-4"><legend className="text-sm font-semibold text-slate-700">{tr('Ngày làm việc', 'Working day')}</legend><div className="mt-2 flex flex-wrap gap-2">{days.map(day => <label key={day[0]} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${workingDay === day[0] ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-700'}`}><input type="checkbox" value={day[0]} checked={workingDay === day[0]} onChange={() => setWorkingDay(workingDay === day[0] ? null : day[0])} />{tr(day[1], day[2])}</label>)}</div></fieldset>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {loading ? <p className="py-8 text-center text-sm text-slate-600">{tr('Đang tải danh sách...', 'Loading schedules...')}</p> : visibleSchedules.length === 0 ? <p className="py-8 text-center text-sm text-slate-600">{tr('Không tìm thấy lịch phù hợp.', 'No matching schedules found.')}</p> : visibleSchedules.map(schedule => <article key={schedule.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-900">{schedule.name}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${schedule.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{schedule.status === 'ACTIVE' ? tr('Đang dùng', 'Active') : tr('Ngừng dùng', 'Inactive')}</span></div><p className="mt-2 text-sm text-slate-600">{schedule.shift_type || tr('Chưa có mã ca', 'No shift code')} · {schedule.start_time}–{schedule.end_time}</p><p className="mt-1 text-sm text-slate-600">{dayNames(schedule.working_days)}</p></div>
          <ScheduleActions tr={tr} onSettings={() => setMetadata(schedule)} onRename={() => rename(schedule)} />
        </article>)}
      </div></>}
    </Card>
    </div>

    {createOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-labelledby="create-schedule-title"><Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5 animate-in slide-in-from-bottom-2 zoom-in-95 duration-200 sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 id="create-schedule-title" className="text-xl font-bold text-slate-900">{tr('Tạo lịch làm việc', 'Create work schedule')}</h2><p className="mt-1 text-sm text-slate-600">{tr('Tạo lịch dùng chung, sau đó gán cho nhân viên ở màn hình chính.', 'Create a shared schedule, then assign it from the main screen.')}</p></div><button aria-label={tr('Đóng', 'Close')} className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-orange-500" onClick={() => setCreateOpen(false)}><X size={20} /></button></div>
      <form className="mt-5 space-y-4" onSubmit={create}><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">{tr('Tên lịch', 'Schedule name')}<input autoFocus required className={fieldClass} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label className="text-sm font-semibold text-slate-700">{tr('Mã ca', 'Shift code')}<input required className={fieldClass} value={form.shift_type || ''} onChange={event => setForm({ ...form, shift_type: event.target.value })} placeholder={tr('Ví dụ: DAY', 'Example: DAY')} /></label><Time24Field label={tr('Giờ bắt đầu (24 giờ)', 'Start time (24-hour)')} value={form.start_time} onChange={value => setForm({ ...form, start_time: value })} /><Time24Field label={tr('Giờ kết thúc (24 giờ)', 'End time (24-hour)')} value={form.end_time} onChange={value => setForm({ ...form, end_time: value })} /></div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.break_start !== null} onChange={event => setForm({ ...form, break_start: event.target.checked ? '12:00' : null, break_end: event.target.checked ? '13:00' : null })} />{tr('Có giờ nghỉ giữa ca', 'Include a break')}</label>
        {form.break_start !== null && <div className="grid gap-4 sm:grid-cols-2"><Time24Field label={tr('Bắt đầu nghỉ (24 giờ)', 'Break starts (24-hour)')} value={form.break_start} onChange={value => setForm({ ...form, break_start: value })} /><Time24Field label={tr('Kết thúc nghỉ (24 giờ)', 'Break ends (24-hour)')} value={form.break_end || ''} onChange={value => setForm({ ...form, break_end: value })} /></div>}
        <fieldset><legend className="text-sm font-semibold text-slate-700">{tr('Ngày làm việc', 'Working days')}</legend><div className="mt-2 flex flex-wrap gap-2">{days.map(day => <label key={day[0]} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"><input type="checkbox" value={day[0]} checked={form.working_days.includes(day[0])} onChange={() => setForm({ ...form, working_days: form.working_days.includes(day[0]) ? form.working_days.filter(value => value !== day[0]) : [...form.working_days, day[0]] })} />{tr(day[1], day[2])}</label>)}</div></fieldset>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>{tr('Hủy', 'Cancel')}</Button><Button type="submit" disabled={busy}>{tr('Tạo lịch', 'Create schedule')}</Button></div>
      </form></Card></div>}
  </AppShell>;
}
