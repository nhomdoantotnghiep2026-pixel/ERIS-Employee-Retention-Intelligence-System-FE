import ScheduleImportSettings from '../components/ScheduleImportSettings';
import { validScheduleTimeline } from '../utils/scheduleTimeline';
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { useLanguage } from '../context/LanguageContext';
import { Button, Card, SectionHeader } from '../components/ui';
import { assignWorkSchedule, createIndividualSchedule, createWorkSchedule, deleteScheduleAssignment, getApiErrorMessage, listEmployeeProfiles, listScheduleAssignments, listWorkSchedules, updateWorkSchedule, type EmployeeProfile, type ScheduleAssignment, type WorkSchedule, type WorkScheduleInput } from '../services/api';
import { filterWorkSchedules, type ScheduleFilters } from '../utils/workScheduleFilters';

const initial: WorkScheduleInput = { name: '', shift_type: '', start_time: '08:00', end_time: '17:00', break_start: '12:00', break_end: '13:00', working_days: [1, 2, 3, 4, 5], status: 'ACTIVE' };
const control = 'mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm';
export default function WorkSchedules() {
  const { language } = useLanguage();
  const tr = (vi: string, en: string) => language === 'vi' ? vi : en;
  const { pathname } = useLocation();
  const page = pathname.endsWith('/assign') ? 'assign' : pathname.endsWith('/list') ? 'list' : 'create';
  const days = language === 'vi' ? ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'] : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [scheduleId, setScheduleId] = useState('');
  const [form, setForm] = useState(initial); const [metadata, setMetadata] = useState<WorkSchedule | null>(null);
  const [individual, setIndividual] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [filters, setFilters] = useState<ScheduleFilters>({ search: '', shiftType: '', status: 'all', day: null });
  useEffect(() => {
    let live = true; setLoading(true); setError('');
    void (async () => {
      const [result, first] = await Promise.all([listWorkSchedules(), listEmployeeProfiles({ limit: 100 })]);
      const rest = await Promise.all(Array.from({ length: Math.max(0, first.pagination.totalPages - 1) }, (_, i) => listEmployeeProfiles({ page: i + 2, limit: 100 })));
      if (live) { setSchedules(result.data); setEmployees([first, ...rest].flatMap(p => p.data)); }
    })().catch(e => { if (live) setError(getApiErrorMessage(e, tr('Không tải được lịch hoặc nhân viên.', 'Could not load schedules or employees.'))); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [revision]);
  useEffect(() => {
    let live = true; setAssignments([]); setAssignmentLoading(Boolean(employeeId));
    if (employeeId) void listScheduleAssignments(Number(employeeId)).then(r => { if (live) setAssignments(r.data); }).catch(e => { if (live) setError(getApiErrorMessage(e, tr('Không tải được lịch hiện tại.', 'Could not load current schedule.'))); }).finally(() => { if (live) setAssignmentLoading(false); });
    return () => { live = false; };
  }, [employeeId, revision]);
  async function run(action: () => Promise<unknown>, message: string) {
    if (busy) return; setBusy(true); setError(''); setNotice('');
    try { await action(); setNotice(message); setRevision(v => v + 1); }
    catch (e) { setError(getApiErrorMessage(e, tr('Không thể thực hiện thao tác.', 'Could not complete the action.'))); }
    finally { setBusy(false); }
  }
  function create(event: FormEvent) {
    event.preventDefault();

    if (!form.working_days.length || !validScheduleTimeline(form.start_time, form.end_time, form.break_start, form.break_end)) { setError(tr('Chọn ngày làm việc và kiểm tra thứ tự giờ làm, giờ nghỉ.', 'Choose working days and check work and break time order.')); return; }
    const payload = { ...form, name: form.name.trim(), shift_type: (form.shift_type || '').trim() };
    void run(async () => { if (individual) await createIndividualSchedule({ ...payload, employee_id: Number(employeeId) }); else await createWorkSchedule(payload); setForm(initial); }, tr('Đã tạo ca làm việc.', 'Work schedule created.'));
  }
  const employeeSelect = <label className="block text-sm">{tr('Nhân viên', 'Employee')}<select required className={control} value={employeeId} onChange={e => setEmployeeId(e.target.value)}><option value="">{tr('Chọn nhân viên', 'Select employee')}</option>{employees.map(e => <option key={e.id} value={e.id}>{e.employeeCode} · {e.fullName}</option>)}</select></label>;
  const visible = filterWorkSchedules(schedules, filters);
  return <AppShell breadcrumb={['Workforce', 'Work schedules']}>
    <SectionHeader title={page === 'create' ? tr('Tạo lịch làm việc', 'Create a work schedule') : page === 'assign' ? tr('Gán lịch hiện tại', 'Assign current schedule') : tr('Danh sách lịch', 'Schedules')} description={tr('Mỗi nhân viên có một ca hiện tại. Gán lịch có hiệu lực ngay.', 'Each employee has one current schedule. Assignments take effect immediately.')} />
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-emerald-800">{notice}</p>}
    <p className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{tr('Nhập chấm công chọn ca theo mã shift_type trong tệp, không phụ thuộc ca gán cho nhân viên. Bản chụp ca được giữ để bảo toàn dữ liệu lịch sử.', 'Attendance import selects the shift by file shift_type, independently of employee assignment. Saved shift snapshots preserve historical calculations.')}</p>
    {metadata && <ScheduleImportSettings key={metadata.id} schedule={metadata} onClose={() => setMetadata(null)} onSaved={() => setRevision(v => v + 1)} />}{loading && <p role="status" className="mb-4">{tr('Đang tải…', 'Loading…')}</p>}
    {page === 'create' && <Card className="p-6"><form onSubmit={create}><fieldset disabled={busy || loading} className="space-y-4">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={individual} onChange={e => setIndividual(e.target.checked)} />{tr('Tạo và gán ngay cho nhân viên', 'Create and assign to an employee immediately')}</label>
      {individual && employeeSelect}
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">{tr('Tên lịch', 'Schedule name')}<input required maxLength={150} className={control} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label className="text-sm">{tr('Loại ca (khớp shift_type trong tệp)', 'Shift type (must match the imported file)')}<input required maxLength={100} className={control} value={form.shift_type || ''} onChange={e => setForm({ ...form, shift_type: e.target.value })} /></label></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.break_start !== null} onChange={e => setForm({ ...form, break_start: e.target.checked ? '12:00' : null, break_end: e.target.checked ? '13:00' : null })} />{tr('Có giờ nghỉ không tính công', 'Has an unpaid break')}</label>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{(['start_time', 'break_start', 'break_end', 'end_time'] as const).filter(k => !k.startsWith('break') || form.break_start !== null).map(key => <label key={key} className="text-sm">{{ start_time: tr('Bắt đầu làm', 'Start work'), end_time: tr('Kết thúc làm', 'End work'), break_start: tr('Bắt đầu nghỉ', 'Start break'), break_end: tr('Kết thúc nghỉ', 'End break') }[key]}<input required type="time" className={control} value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}</div>
      <fieldset><legend className="mb-2 text-sm">{tr('Ngày làm việc', 'Working days')}</legend><div className="flex flex-wrap gap-4">{days.map((day, i) => <label key={day} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.working_days.includes(i + 1)} onChange={e => setForm({ ...form, working_days: e.target.checked ? [...form.working_days, i + 1].sort() : form.working_days.filter(d => d !== i + 1) })} />{day}</label>)}</div></fieldset>
      <Button type="submit">{tr(busy ? 'Đang lưu…' : 'Tạo lịch', busy ? 'Saving…' : 'Create schedule')}</Button>
    </fieldset></form></Card>}
    {page === 'assign' && <Card className="p-6"><fieldset disabled={busy || loading} className="space-y-4">{employeeSelect}
      <label className="block text-sm">{tr('Ca làm việc', 'Work schedule')}<select className={control} value={scheduleId} onChange={e => setScheduleId(e.target.value)}><option value="">{tr('Chọn ca đang hoạt động', 'Select an active schedule')}</option>{schedules.filter(s => s.status === 'ACTIVE').map(s => <option key={s.id} value={s.id}>{s.name} · {s.shift_type}</option>)}</select></label>
      <Button disabled={!employeeId || !scheduleId || assignmentLoading} onClick={() => { if (window.confirm(tr('Gán ca này ngay cho nhân viên?', 'Assign this schedule immediately?'))) void run(() => assignWorkSchedule(Number(employeeId), { work_schedule_id: Number(scheduleId) }), tr('Đã gán lịch.', 'Schedule assigned.')); }}>{tr('Gán lịch', 'Assign schedule')}</Button>
      {assignmentLoading ? <p role="status">{tr('Đang tải lịch hiện tại…', 'Loading current schedule…')}</p> : employeeId && <div><h2 className="font-bold">{tr('Lịch hiện tại', 'Current schedule')}</h2>{!assignments.length ? <p className="mt-2 text-sm text-slate-500">{tr('Chưa có ca được gán.', 'No schedule assigned.')}</p> : assignments.map(a => <div key={a.work_schedule_id} className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><span>{a.name} · {a.shift_type} · {a.start_time}–{a.end_time}</span><Button variant="danger" onClick={() => { if (window.confirm(tr('Gỡ ca hiện tại của nhân viên? Việc nhập chấm công vẫn chọn ca từ mã trong tệp.', 'Clear the employee schedule? Attendance import still uses the code in the file.'))) void run(() => deleteScheduleAssignment(Number(employeeId), a.work_schedule_id), tr('Đã gỡ lịch.', 'Schedule cleared.')); }}>{tr('Gỡ lịch', 'Clear schedule')}</Button></div>)}</div>}
    </fieldset></Card>}
    {page === 'list' && <Card className="p-6"><div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-bold">{tr('Danh sách lịch', 'Schedules')}</h2><Button variant="secondary" disabled={loading || busy} onClick={() => setRevision(v => v + 1)}>{tr('Tải lại', 'Refresh')}</Button></div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm">{tr('Tìm tên lịch', 'Search schedule name')}<input type="search" className={control} value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} /></label><label className="text-sm">{tr('Loại ca', 'Shift type')}<input className={control} value={filters.shiftType} onChange={e => setFilters({ ...filters, shiftType: e.target.value })} /></label><label className="text-sm">{tr('Trạng thái', 'Status')}<select className={control} value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value as ScheduleFilters['status'] })}><option value="all">{tr('Tất cả', 'All')}</option><option value="ACTIVE">{tr('Đang hoạt động', 'Active')}</option><option value="INACTIVE">{tr('Ngưng hoạt động', 'Inactive')}</option></select></label><label className="text-sm">{tr('Ngày làm việc', 'Working day')}<select className={control} value={filters.day ?? ''} onChange={e => setFilters({ ...filters, day: e.target.value ? Number(e.target.value) : null })}><option value="">{tr('Tất cả', 'All')}</option>{days.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></label></div>
      {!loading && !visible.length && <p className="py-5 text-slate-500">{tr('Không tìm thấy lịch.', 'No schedules found.')}</p>}
      <div className="space-y-3">{visible.map(s => <article key={s.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">{s.name} · {s.shift_type || tr('Chưa có mã ca', 'No shift code')}</h3><p className="mt-1 text-sm text-slate-600">{s.start_time}–{s.end_time} · {s.break_start && s.break_end ? tr('Nghỉ: ', 'Break: ') + s.break_start + '–' + s.break_end : tr('Không nghỉ giữa giờ', 'No unpaid break')}</p><p className="mt-1 text-sm text-slate-600">{s.working_days.map(d => days[d - 1]).join(', ')} · {s.status === 'ACTIVE' ? tr('Đang hoạt động', 'Active') : tr('Ngưng hoạt động', 'Inactive')}</p></div><Button variant="info" disabled={busy} onClick={() => setMetadata(s)}>{tr('Mã ca & ngưỡng nhập','Shift code & import windows')}</Button><Button variant="warning" disabled={busy} onClick={() => { const name = window.prompt(tr('Tên lịch mới', 'New schedule name'), s.name); if (name?.trim() && name.trim() !== s.name) void run(() => updateWorkSchedule(s.id, { name: name.trim() }), tr('Đã đổi tên lịch.', 'Schedule renamed.')); }}>{tr('Đổi tên', 'Rename')}</Button></div></article>)}</div>
    </Card>}
  </AppShell>;
}
