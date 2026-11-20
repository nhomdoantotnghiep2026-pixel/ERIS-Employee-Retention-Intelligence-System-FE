import { useAutoDismissState } from '../hooks/useAutoDismissState';
import { useEffect, useState, type FormEvent } from 'react';
import { Card } from './ui';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { MoreHorizontal, Target } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useLanguage } from '../context/LanguageContext';
import { cancelCareerGoal, completeCareerGoal, createCareerGoal, editCareerGoal, getApiErrorMessage, getEmployeeCareerGoals, getOwnCareerGoals, replaceCareerGoal, type CareerGoals as CareerGoalsData } from '../services/api';

const control = 'resize-none mt-1 w-full rounded-md border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100';
export function CareerGoals({ employeeId, own = false }: { employeeId?: number; own?: boolean }) {
  const { language } = useLanguage(), tr = (vi: string, en: string) => language === 'vi' ? vi : en;
  const [data, setData] = useState<CareerGoalsData | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [loadError, setLoadError] = useState('');
  const [error, setError] = useAutoDismissState();
  const [notice, setNotice] = useAutoDismissState();
  const [loadFailed, setLoadFailed] = useState(false);
  const [aspiration, setAspiration] = useState(''), [description, setDescription] = useState(''), [reason, setReason] = useState(''), [mode, setMode] = useState<'edit' | 'replace' | 'cancel' | null>(null), [revision, setRevision] = useState(0);
  useEffect(() => { let live = true; setLoading(true); setLoadFailed(false); setLoadError(''); const task = own ? getOwnCareerGoals() : getEmployeeCareerGoals(employeeId!); void task.then(result => { if (live) setData(result) }).catch(cause => { if (live) { setLoadFailed(true); setLoadError(getApiErrorMessage(cause, tr('Không tải được mục tiêu nghề nghiệp.', 'Could not load career goals.'))); } }).finally(() => { if (live) setLoading(false) }); return () => { live = false } }, [employeeId, own, revision]);
  async function run(task: () => Promise<unknown>, message: string) { if (busy) return; setBusy(true); setError(''); setNotice(''); try { await task(); setMode(null); setAspiration(''); setDescription(''); setReason(''); setNotice(message); setRevision(value => value + 1) } catch (cause) { setError(getApiErrorMessage(cause, tr('Không lưu được mục tiêu nghề nghiệp.', 'Could not save the career goal.'))) } finally { setBusy(false) } }
  function submit(event: FormEvent) { event.preventDefault(); const goal = data?.currentGoal; if (!goal) void run(() => createCareerGoal(aspiration.trim(), description.trim()), tr('Đã tạo mục tiêu nghề nghiệp.', 'Career goal created.')); else if (mode === 'edit') void run(() => editCareerGoal(goal.id, description.trim()), tr('Đã cập nhật mục tiêu.', 'Goal updated.')); else if (mode === 'replace') void run(() => replaceCareerGoal(goal.id, { newCareerAspiration: aspiration.trim(), newGoalDescription: description.trim(), goalChangeReason: reason.trim() }), tr('Đã thay mục tiêu mới.', 'Goal replaced.')); else if (mode === 'cancel') void run(() => cancelCareerGoal(goal.id, reason.trim() || null), tr('Đã hủy mục tiêu.', 'Goal cancelled.')) }
  const status: Record<string, string> = { ACTIVE: tr('Đang thực hiện', 'Active'), ACHIEVED: tr('Đã hoàn thành', 'Achieved'), REPLACED: tr('Đã thay thế', 'Replaced'), CANCELLED: tr('Đã hủy', 'Cancelled') };
  const current = data?.currentGoal;
  const history = data?.history.filter(goal => goal.id !== current?.id) || [];
  const canShowForm = own && !!data && !loading && !loadFailed && (!current || mode !== null);
  return <Card className="mt-5 p-5 sm:p-6">
    <h2 className="text-lg font-semibold text-slate-950">{tr('Mục tiêu nghề nghiệp', 'Career goals')}</h2>
    <p className="mt-1 text-sm leading-6 text-slate-600">{tr('Theo dõi định hướng do nhân viên tự khai báo.', 'Track employee-declared career direction.')}</p>
    {loading && <p role="status" className="mt-4 text-sm text-slate-600">{tr('Đang tải...', 'Loading...')}</p>}
    {(loadError || error) && <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-red-50 p-3 text-red-800"><p className="text-sm leading-6">{loadError || error}{!loadFailed && <span className="mt-1 block">{tr('Chưa lưu được thay đổi. Nội dung bạn nhập được giữ lại.', 'Changes were not saved. Your input has been preserved.')}</span>}</p>{loadFailed && <Button variant="outline" disabled={loading} onClick={() => setRevision(value => value + 1)}>{tr('Tải lại', 'Retry')}</Button>}</div>}
    {notice && <p role="status" className="mt-4 rounded-md bg-emerald-50 p-3 text-emerald-800">{notice}</p>}
    <div className={own && !loadFailed ? 'mt-5 grid items-start gap-8 lg:grid-cols-12' : 'mt-5'}>
      {own && !loadFailed && <section className="min-w-0 lg:col-span-5 lg:border-r lg:border-slate-100 lg:pr-8">
        {canShowForm ? <form onSubmit={submit} className="max-w-2xl space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/70 p-5">
          <h3 className="font-semibold text-slate-900">{!current ? tr('Tạo mục tiêu mới', 'Create a new goal') : mode === 'edit' ? tr('Cập nhật mô tả', 'Update description') : mode === 'replace' ? tr('Thay mục tiêu', 'Replace goal') : tr('Hủy mục tiêu', 'Cancel goal')}</h3>
          <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
            {mode !== 'edit' && mode !== 'cancel' && <label className="block text-sm font-medium text-slate-700">{tr('Định hướng nghề nghiệp', 'Career aspiration')}<Input required maxLength={150} placeholder={tr('VD: Trở thành Tech Lead trong 2 năm tới...', 'e.g. Become a Tech Lead within two years...')} className="mt-1 w-full rounded-md" value={aspiration} onChange={event => setAspiration(event.target.value)} /></label>}
            {mode !== 'cancel' && <label className="block text-sm font-medium text-slate-700">{tr('Mô tả mục tiêu', 'Goal description')}<textarea aria-label={tr('Mô tả mục tiêu', 'Goal description')} required maxLength={4000} placeholder={tr('Mô tả ngắn gọn kế hoạch, kỹ năng cần đạt...', 'Briefly describe your plan and skills to develop...')} rows={3} className={control} value={description} onChange={event => setDescription(event.target.value)} /></label>}
            {(mode === 'replace' || mode === 'cancel') && <label className="block text-sm font-medium text-slate-700">{tr('Lý do thay đổi', 'Change reason')}<textarea aria-label={tr('Lý do thay đổi', 'Change reason')} required={mode === 'replace'} maxLength={2000} rows={3} className={control} value={reason} onChange={event => setReason(event.target.value)} /></label>}
            <div className="flex gap-2"><Button type="submit" className="h-auto flex-1 rounded-lg bg-orange-500 px-6 py-2.5 font-medium text-white transition-colors hover:bg-orange-600">{tr('Lưu mục tiêu', 'Save goal')}</Button>{mode && <Button type="button" variant="outline" className="h-10" onClick={() => setMode(null)}>{tr('Đóng', 'Close')}</Button>}</div>
          </fieldset>
        </form> : current && !loading && !loadFailed ? <><h3 className="font-semibold text-slate-900">{tr('Quản lý mục tiêu hiện tại', 'Manage current goal')}</h3><div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/70 p-5"><p className=" text-sm leading-6 text-slate-600">{tr('Bạn đang có một mục tiêu đang thực hiện. Có thể cập nhật mô tả hoặc thay mục tiêu mới.', 'You have an active goal. Update its description or replace it with a new goal.')}</p><div className="mt-auto flex items-center gap-2 pt-4"><Button variant="outline" disabled={busy} onClick={() => { setMode('edit'); setDescription(current.goalDescription); }}>{tr('Chỉnh sửa', 'Edit')}</Button><DropdownMenu.Root><DropdownMenu.Trigger asChild><Button variant="outline" size="icon" disabled={busy} aria-label={tr('Thao tác khác', 'More actions')}><MoreHorizontal aria-hidden="true" size={16} /></Button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="start" sideOffset={5} className="z-[80] min-w-40 rounded-md border border-slate-200 bg-white p-1 text-sm text-slate-700 shadow-lg"><DropdownMenu.Item className="cursor-pointer rounded px-3 py-2 outline-none focus:bg-orange-50" onSelect={() => { setMode('replace'); setAspiration(''); setDescription(''); }}>{tr('Thay mục tiêu', 'Replace')}</DropdownMenu.Item><DropdownMenu.Item className="cursor-pointer rounded px-3 py-2 text-red-700 outline-none focus:bg-red-50" onSelect={() => setMode('cancel')}>{tr('Hủy mục tiêu', 'Cancel')}</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></div></div></> : null}
      </section>}
      <section className={own && !loadFailed ? 'min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/30 p-5 lg:col-span-7' : 'min-w-0'}>
        <div className="flex min-h-6 items-start justify-between gap-3"><h3 className="font-semibold leading-6 text-slate-900">{tr('Danh sách mục tiêu đã lưu', 'Saved career goals')}</h3>{data && !loading && <span className="shrink-0 pt-0.5 text-xs text-slate-500">{history.length + (current ? 1 : 0)} {tr('mục tiêu', 'goals')}</span>}</div>
        <ul className="mt-4 space-y-4">
          {[...(current ? [current] : []), ...history].map(goal => <li key={goal.id} className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{tr('Định hướng nghề nghiệp', 'Career aspiration')}</p><h4 className="mt-1 break-words text-base font-bold text-slate-900 [overflow-wrap:anywhere]">{goal.careerAspiration}</h4></div>
              <span className={'shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ' + (goal.status === 'CANCELLED' ? 'border-red-200 bg-red-50 text-red-600' : goal.status === 'ACTIVE' || goal.status === 'ACHIEVED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600')}>{status[goal.status] || goal.status}</span>
            </div>
            <div className="mt-3"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{tr('Mô tả mục tiêu', 'Goal description')}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere]">{goal.goalDescription}</p></div>
            {goal.goalChangeReason && <div className={goal.status === 'CANCELLED' ? 'mt-3.5 rounded-lg border border-red-100 bg-red-50/50 p-3' : 'mt-3.5 rounded-lg border border-slate-100 bg-slate-50/70 p-3'}>
              <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700 [overflow-wrap:anywhere]"><span className={goal.status === 'CANCELLED' ? 'font-semibold uppercase text-red-700' : 'font-semibold uppercase text-slate-600'}>{goal.status === 'CANCELLED' ? tr('Lý do hủy:', 'Cancellation reason:') : tr('Lý do thay đổi:', 'Change reason:')}</span>{' '}{goal.goalChangeReason}</p>
            </div>}
            {own && goal.id === current?.id && <Button className="mt-4 rounded-md" variant="outline" disabled={busy} onClick={() => { if (window.confirm(tr('Xác nhận mục tiêu đã hoàn thành?', 'Mark this goal as achieved?'))) void run(() => completeCareerGoal(goal.id), tr('Đã ghi nhận hoàn thành.', 'Goal marked achieved.')); }}>{tr('Đánh dấu hoàn thành', 'Mark achieved')}</Button>}
          </li>)}
        </ul>
        {!loading && !loadFailed && data && !current && !history.length && <div className="mt-4 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center"><Target aria-hidden="true" className="size-9 text-slate-400" strokeWidth={1.5} /><p className="max-w-sm text-sm leading-6 text-slate-600">{own ? tr('Chưa có mục tiêu nghề nghiệp nào được lưu. Hãy thêm mục tiêu đầu tiên của bạn ở cột bên trái.', 'No career goals saved yet. Add your first goal using the form.') : tr('Nhân viên chưa có mục tiêu nghề nghiệp được lưu.', 'This employee has no saved career goals.')}</p></div>}
      </section>
    </div>
  </Card>;
}
