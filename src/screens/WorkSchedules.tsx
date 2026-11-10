import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { useLanguage } from '../context/LanguageContext';
import { Button, Card, SectionHeader } from '../components/ui';
import { assignWorkSchedule, createIndividualSchedule, createWorkSchedule, deleteScheduleAssignment, getApiErrorMessage, listEmployeeProfiles, listScheduleAssignments, listWorkSchedules, setDefaultSchedule, updateWorkSchedule, type EmployeeProfile, type ScheduleAssignment, type WorkSchedule, type WorkScheduleInput } from '../services/api';

const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const initial: WorkScheduleInput = { name: '', start_time: '08:00', end_time: '17:00', break_start: '12:00', break_end: '13:00', working_days: [1, 2, 3, 4, 5], status: 'ACTIVE' };
const inputClass = 'mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm';

export default function WorkSchedules() {
  const { language } = useLanguage();
  const { pathname } = useLocation();
  const page = pathname.endsWith('/assign') ? 'assign' : pathname.endsWith('/list') ? 'list' : 'create';
  const tr = (vi: string, en: string) => language === 'vi' ? vi : en;
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [scheduleId, setScheduleId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [form, setForm] = useState(initial);
  const [mode, setMode] = useState<'template' | 'default' | 'individual'>('default');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [s, first] = await Promise.all([listWorkSchedules(), listEmployeeProfiles({ limit: 100, employmentStatus: 'ACTIVE' })]);
      const remaining = await Promise.all(Array.from({ length: Math.max(0, first.pagination.totalPages - 1) }, (_, index) => listEmployeeProfiles({ page: index + 2, limit: 100, employmentStatus: 'ACTIVE' })));
      setSchedules(s.data); setEmployees([first, ...remaining].flatMap(page => page.data)); setError('');
    }
    catch (cause) { setError(getApiErrorMessage(cause, tr("Không tải được lịch làm việc hoặc danh sách nhân viên.","Could not load schedules or employees."))); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    let current = true;
    setAssignments([]);
    if (employeeId) void listScheduleAssignments(Number(employeeId)).then(result => { if (current) setAssignments(result.data); }).catch(cause => { if (current) setError(getApiErrorMessage(cause, tr("Không tải được lịch sử gán lịch.","Could not load assignment history."))); });
    return () => { current = false; };
  }, [employeeId]);
  async function refreshAssignments() { if (employeeId) setAssignments((await listScheduleAssignments(Number(employeeId))).data); }
  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); setNotice(message); await load(); await refreshAssignments(); }
    catch (cause) { setError(getApiErrorMessage(cause, tr("Không thể thực hiện thao tác.","Could not complete the action."))); }
    finally { setBusy(false); }
  }
  function create(event: React.FormEvent) {
    event.preventDefault();
    if (!form.working_days.length) { setError(tr("Vui lòng chọn ít nhất một ngày làm việc.","Select at least one working day.")); return; }
    if (!(form.start_time < form.break_start && form.break_start < form.break_end && form.break_end < form.end_time)) { setError(tr("Giờ làm và nghỉ cần theo thứ tự: bắt đầu, nghỉ trưa, kết thúc nghỉ, kết thúc làm.","Times must be in order: start, break start, break end, and end.")); return; }
    if (mode === 'individual' && (!employeeId || !from || !to || to < from)) { setError(tr("Chọn nhân viên và khoảng ngày hợp lệ cho lịch riêng.","Select an employee and valid dates.")); return; }
    const payload = { ...form, name: form.name.trim() };
    void run(() => mode === 'individual' ? createIndividualSchedule({ ...payload, employee_id: Number(employeeId), effective_from: from, effective_to: to }) : createWorkSchedule(payload, mode), mode === 'default' ? tr("Đã lên lịch mặc định áp dụng từ ngày mai.","Default schedule is scheduled for tomorrow.") : mode === 'individual' ? tr("Đã tạo và gán lịch riêng.","Individual schedule created and assigned.") : tr("Đã tạo mẫu lịch làm việc.","Schedule template created."));
  }

  return <AppShell breadcrumb={['Workforce', 'Work schedules']}>
    <SectionHeader title={page === 'create' ? tr('Tạo lịch làm việc', 'Create a work schedule') : page === 'assign' ? tr('Gán lịch và xem lịch sử nhân viên', 'Assign schedules and view employee history') : tr('Danh sách lịch', 'Schedules')} description={tr('Thiết lập lịch mặc định và lịch riêng cho nhân viên.', 'Set up default and individual schedules for employees.')} />
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</p>}
    {page === 'create' && <Card className="mb-4 p-6"><h2 className="mb-1 font-bold">{tr('Tạo lịch làm việc', 'Create a work schedule')}</h2><p className="mb-4 text-sm text-slate-500">{tr('Lịch mặc định mới áp dụng từ ngày mai theo giờ Việt Nam. Lịch riêng giữ khoảng hiệu lực đã chọn.', 'The new default schedule takes effect tomorrow in Vietnam time. Individual schedules use the selected dates.')}</p>
      <form onSubmit={create} className="space-y-4">
        <label className="block text-sm">{tr('Loại lịch', 'Schedule type')}<select className={inputClass} value={mode} onChange={e => setMode(e.target.value as typeof mode)}><option value="default">{tr('Lịch mặc định', 'Default schedule')}</option><option value="individual">{tr('Tạo lịch riêng cho nhân viên', 'Create an individual schedule')}</option><option value="template">{tr('Mẫu lịch', 'Schedule template')}</option></select></label>
        <label className="block text-sm">{tr('Tên lịch', 'Schedule name')}<input className={inputClass} maxLength={150} required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{([['start_time', 'Bắt đầu làm', 'Start work'], ['break_start', 'Bắt đầu nghỉ', 'Start break'], ['break_end', 'Kết thúc nghỉ', 'End break'], ['end_time', 'Kết thúc làm', 'End work']] as const).map(([key, vi, en]) => <label className="text-sm" key={key}>{tr(vi, en)}<input required type="time" className={inputClass} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}</div>
        <fieldset><legend className="mb-2 text-sm">{tr('Ngày làm việc', 'Working days')}</legend><div className="flex flex-wrap gap-4">{days.map((day, i) => <label key={day} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.working_days.includes(i + 1)} onChange={e => setForm({ ...form, working_days: e.target.checked ? [...form.working_days, i + 1].sort((a, b) => a - b) : form.working_days.filter(d => d !== i + 1) })} />{tr(day, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i])}</label>)}</div></fieldset>
        {mode === 'individual' && <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm">{tr('Nhân viên', 'Employee')}<select required className={inputClass} value={employeeId} onChange={e => setEmployeeId(e.target.value)}><option value="">{tr('Chọn nhân viên', 'Select employee')}</option>{employees.map(e => <option key={e.id} value={e.id}>{e.employeeCode} · {e.fullName}</option>)}</select></label>
          <label className="text-sm">{tr('Từ ngày', 'From')}<input required type="date" className={inputClass} value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label className="text-sm">{tr('Đến ngày', 'Until')}<input required type="date" className={inputClass} min={from} value={to} onChange={e => setTo(e.target.value)} /></label>
        </div>}
        <Button type="submit" disabled={busy || !form.name.trim()}>{mode === 'default' ? tr('Tạo lịch mặc định', 'Create default schedule') : mode === 'individual' ? tr('Tạo và gán lịch riêng', 'Create and assign schedule') : tr('Tạo mẫu lịch', 'Create template')}</Button>
      </form>
    </Card>}
    {page === 'assign' && <Card className="mb-4 p-6"><h2 className="mb-1 font-bold">{tr("Gán lịch và xem lịch sử nhân viên","Assign schedules and view employee history")}</h2><p className="mb-4 text-sm text-slate-500">{tr("Chọn lịch đang hoạt động và khoảng ngày áp dụng. Ngày kết thúc có thể để trống khi gán mẫu lịch có sẵn.","Choose an active schedule and dates. The end date is optional for an existing schedule.")}</p>
      <div className="grid gap-4 md:grid-cols-2"><label className="text-sm">{tr("Nhân viên","Employee")}<select className={inputClass} value={employeeId} onChange={e => setEmployeeId(e.target.value)}><option value="">{tr("Chọn nhân viên","Select employee")}</option>{employees.map(e => <option key={e.id} value={e.id}>{e.employeeCode} · {e.fullName}</option>)}</select></label><label className="text-sm">{tr("Lịch","Schedule")}<select className={inputClass} value={scheduleId} onChange={e => setScheduleId(e.target.value)}><option value="">{tr("Chọn lịch riêng","Select individual schedule")}</option>{schedules.filter(s => s.status === 'ACTIVE' && !s.is_default).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="text-sm">{tr("Từ ngày","From")}<input type="date" className={inputClass} value={from} onChange={e => setFrom(e.target.value)} /></label><label className="text-sm">{tr("Đến ngày","Until")}<input type="date" className={inputClass} value={to} min={from} onChange={e => setTo(e.target.value)} /></label></div>
      <div className="mt-4"><Button disabled={busy || !employeeId || !scheduleId || !from || Boolean(to && to < from)} onClick={() => void run(() => assignWorkSchedule(Number(employeeId), { schedule_id: Number(scheduleId), effective_from: from, effective_to: to || null }), tr("Đã gán lịch cho nhân viên.","Schedule assigned."))}>{tr("Gán lịch có sẵn","Assign existing schedule")}</Button></div>
      {employeeId && <div className="mt-6 space-y-3"><h3 className="font-semibold">{tr("Lịch sử gán lịch","Assignment history")}</h3>{assignments.length === 0 ? <p className="text-sm text-slate-500">{tr("Chưa có lịch sử gán lịch.","No schedule assignments yet.")}</p> : assignments.map(a => <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-4"><span className="text-sm"><strong>{a.name}</strong> · {a.effective_from} – {a.effective_to || tr("Không giới hạn","No end date")}</span><Button variant="secondary" disabled={busy} onClick={() => { if (window.confirm(tr("Xóa lần gán lịch này?","Delete this schedule assignment?"))) void run(() => deleteScheduleAssignment(Number(employeeId), a.id), tr("Đã xóa lần gán lịch.","Assignment deleted.")); }}>{tr("Xóa lần gán","Delete assignment")}</Button></div>)}</div>}
    </Card>}
    {page === 'list' && <Card className="mb-4 p-6"><h2 className="mb-4 font-bold">{tr("Danh sách lịch","Schedules")}</h2>{schedules.length === 0 ? <p className="text-sm text-slate-500">{tr("Chưa có lịch làm việc.","No work schedules yet.")}</p> : <div className="space-y-3">{schedules.map(s => <div key={s.id} className="rounded-xl border border-slate-200 p-4"><div className="font-semibold">{s.name} {s.is_default && <span className="text-emerald-700">{tr("· Mặc định","· Default")}</span>} · {s.status === 'ACTIVE' ? tr("Đang hoạt động","Active") : tr("Ngừng hoạt động","Inactive")}</div><p className="mt-1 text-sm text-slate-600">{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)} · {tr("Nghỉ", "Break")} {s.break_start.slice(0, 5)}–{s.break_end.slice(0, 5)} · {s.working_days.map(d => tr(days[d - 1], ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][d - 1])).join(', ')}</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" disabled={busy} onClick={() => { const name = window.prompt(tr("Tên lịch mới","New schedule name"), s.name); if (name?.trim() && name.trim() !== s.name) void run(() => updateWorkSchedule(s.id, { name: name.trim() }), tr("Đã cập nhật tên lịch.","Schedule name updated.")); }}>{tr("Đổi tên","Rename")}</Button>{s.status === 'ACTIVE' && !s.is_default && <Button variant="secondary" disabled={busy} onClick={() => { if (window.confirm(tr("Đặt lịch này làm mặc định từ ngày mai?","Set this as the default schedule starting tomorrow?"))) void run(() => setDefaultSchedule(s.id), tr("Đã lên lịch áp dụng mặc định từ ngày mai.","The default schedule will apply starting tomorrow.")); }}>{tr("Đặt làm mặc định","Set as default")}</Button>}</div></div>)}</div>}</Card>}
  </AppShell>;
}
