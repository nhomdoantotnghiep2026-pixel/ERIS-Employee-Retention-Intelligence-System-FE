import { SelectControl } from "../components/ui/select-control"
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, FileText, Pencil, Users } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { AppShell } from '../components/AppShell';
import { Button, Card } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { useAutoDismissFeedback } from '../hooks/useAutoDismissState';
import { deactivateDepartment, getDepartmentById, listEmployeeProfiles, updateDepartment, getApiErrorMessage, type ApiDepartment } from '../services/api';
import { Button as FormButton } from '../components/ui/button';

const control = 'mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-orange-500 disabled:bg-slate-50';

export default function DepartmentPage({ mode }: { mode: 'detail' | 'edit' }) {
  const { t } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  return <AppShell breadcrumb={['Workforce', 'Departments', mode === 'edit' ? 'Edit department' : 'Department details']}>
    <div className="mx-auto w-full max-w-4xl">
      <button type="button" className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-600 hover:text-orange-600 disabled:opacity-50" disabled={pending} onClick={() => navigate('/departments')}><ArrowLeft size={17} />{t('Back to departments')}</button>
      <DepartmentPanel id={id} mode={mode} onPendingChange={setPending} />
    </div>
  </AppShell>;
}

export function DepartmentPanel({ id, mode, headcount: providedHeadcount, onModeChange, onUpdated, onPendingChange }: {
  id: string | undefined;
  mode: 'detail' | 'edit';
  headcount?: number;
  onModeChange?: (mode: 'detail' | 'edit') => void;
  onUpdated?: (department: ApiDepartment) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [department, setDepartment] = useState<ApiDepartment | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pending, setPending] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loadedHeadcount, setLoadedHeadcount] = useState<number | null>(null);
  const { error, message, setError, setMessage } = useAutoDismissFeedback();
  const nameInput = useRef<HTMLInputElement>(null);
  const editing = mode === 'edit';
  const routeMode = onModeChange ? undefined : mode;
  const headcount = providedHeadcount ?? loadedHeadcount;

  useEffect(() => {
    if (providedHeadcount !== undefined || !id || !/^[1-9]\d*$/.test(id)) return;
    const controller = new AbortController();
    void listEmployeeProfiles({ page: 1, limit: 1, departmentId: Number(id), employmentStatus: 'ACTIVE' }, controller.signal)
      .then(result => { if (!controller.signal.aborted) setLoadedHeadcount(result.pagination.total); })
      .catch(() => { if (!controller.signal.aborted) setLoadedHeadcount(null); });
    return () => controller.abort();
  }, [id, providedHeadcount, revision]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError(''); setDepartment(null); setError(''); setMessage('');
    if (!id || !/^[1-9]\d*$/.test(id) || Number(id) > 2147483647) {
      setLoadError('Department not found.'); setLoading(false);
      return () => controller.abort();
    }
    void getDepartmentById(Number(id), controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        setDepartment(result); setName(result.name); setDescription(result.description || '');
        setStatus(result.status ?? 'ACTIVE');
      })
      .catch(cause => { if (!controller.signal.aborted) setLoadError(getApiErrorMessage(cause, 'Could not load department details. Please try again.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, routeMode, revision, setError, setMessage]);

  function switchModalMode(next: 'detail' | 'edit') {
    if (!department || pending || next === mode) return;
    setName(department.name);
    setDescription(department.description || '');
    setStatus(department.status ?? 'ACTIVE');
    setError('');
    onModeChange?.(next);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!department || pending) return;
    setError(''); setMessage('');
    if (!name.trim()) { setError('Enter a department name.'); nameInput.current?.focus(); return; }
    const deactivating = status === 'INACTIVE' && department.status !== 'INACTIVE';
    if (deactivating && !window.confirm(t('Deactivate department "{name}"? Its record will remain in the database.', { name: department.name }))) return;
    setPending(true); onPendingChange?.(true);
    let fieldsSaved = false;
    const applyUpdate = (updated: ApiDepartment) => {
      setDepartment(updated); setName(updated.name); setDescription(updated.description || '');
      onUpdated?.(updated);
    };
    try {
      const input = { name: name.trim(), description: description.trim() || null };
      if (input.name !== department.name || input.description !== (department.description || null)) {
        applyUpdate(await updateDepartment(department.id, input));
        fieldsSaved = true;
      }
      if (deactivating) applyUpdate(await deactivateDepartment(department.id));
      setMessage('Department updated.');
    } catch (cause) {
      const reason = t(getApiErrorMessage(cause, 'Could not save the department. Please try again.'));
      setError(fieldsSaved ? (language === 'vi' ? 'Đã lưu thông tin, nhưng chưa đổi được trạng thái. ' : 'Details were saved, but the status could not be changed. ') + reason : reason);
    }
    finally { setPending(false); onPendingChange?.(false); }
  }

  const tabClass = (active: boolean) => `inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${active ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`;
  return <Card className="overflow-hidden">
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3"><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><Building2 size={24} /></span><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t(editing ? 'Edit department' : 'Department details')}</p><h1 className="mt-1 break-words text-xl font-bold text-slate-900">{department?.name || t('Departments')}</h1></div></div>
            {department && <div className="flex flex-wrap items-center justify-end gap-2"><span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold tabular-nums text-slate-700"><Users size={14} aria-hidden="true" />{headcount ?? '—'} {language === 'vi' ? 'nhân sự' : 'employees'}</span><span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${department.status === 'INACTIVE' ? 'border-slate-200 bg-slate-100 text-slate-600' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{t(department.status === 'INACTIVE' ? 'Department inactive' : 'Department active')}</span></div>}
          </div>
          {department && <nav aria-label={t('Department views')} className="mt-5 inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
            {onModeChange ? <>
              <button type="button" aria-pressed={!editing} disabled={pending} className={tabClass(!editing)} onClick={() => switchModalMode('detail')}><FileText size={16} />{t('View details')}</button>
              <button type="button" aria-pressed={editing} disabled={pending} className={tabClass(editing)} onClick={() => switchModalMode('edit')}><Pencil size={16} />{t('Edit')}</button>
            </> : <>{pending ? <span className={tabClass(false)}><FileText size={16} />{t('View details')}</span> : <Link to={`/departments/${department.id}`} aria-current={!editing ? 'page' : undefined} className={tabClass(!editing)}><FileText size={16} />{t('View details')}</Link>}
            <Link to={`/departments/${department.id}/edit`} aria-current={editing ? 'page' : undefined} className={tabClass(editing)}><Pencil size={16} />{t('Edit')}</Link></>}
          </nav>}
        </div>
        <div className="p-5 sm:p-6">
          {loading ? <p role="status" className="py-5 text-sm text-slate-500">{t('Loading department details...')}</p>
            : loadError ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700"><p>{t(loadError)}</p><Button variant="secondary" className="mt-3" onClick={() => setRevision(value => value + 1)}>{t('Retry departments')}</Button></div>
            : department && <>
              {message && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{t(message)}</p>}
              {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{t(error)}</p>}
              <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"><span className="text-slate-500">{t('Department code')}</span><span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">{department.code || '—'}</span></div>
              <div className="grid grid-cols-1">
              {(editing || onModeChange) && <form onSubmit={save} inert={!editing} className={`col-start-1 row-start-1 flex min-w-0 flex-col ${editing ? '' : 'invisible'}`}>
                <div className="grid gap-5 pb-5 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">{t('Department name')} <span aria-hidden="true" className="text-red-600">*</span><input ref={nameInput} required maxLength={150} className={`${control} h-10`} disabled={pending} value={name} onChange={event => setName(event.target.value)} /></label>
                  <label className="text-sm font-medium text-slate-700">{t('Department status')}
                    <SelectControl className={`${control} h-10`} disabled={pending || department.status === 'INACTIVE'} value={status} onChange={event => setStatus(event.target.value === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE')}>
                      <option value="ACTIVE">{t('Department active')}</option>
                      <option value="INACTIVE">{t('Department inactive')}</option>
                    </SelectControl>
                    {department.status === 'INACTIVE' && <span className="mt-1 block text-xs text-slate-600">{language === 'vi' ? 'Hiện chưa hỗ trợ kích hoạt lại.' : 'Reactivation is currently unavailable.'}</span>}
                  </label>
                  <label className="text-sm font-medium text-slate-700 sm:col-span-2">{t('Department description')}<textarea rows={2} className={`${control} min-h-[80px] resize-none py-2 leading-5`} disabled={pending} value={description} onChange={event => setDescription(event.target.value)} /></label>
                </div>
                <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="secondary" disabled={pending} onClick={() => onModeChange ? switchModalMode('detail') : navigate(`/departments/${department.id}`)}>{t('Cancel')}</Button><Button type="submit" disabled={pending}>{t(pending ? 'Saving department...' : 'Save department')}</Button></div>
              </form>}
              {(!editing || onModeChange) && (
                <div inert={editing} className={`col-start-1 row-start-1 flex min-w-0 flex-col ${editing ? 'invisible' : ''}`}>
                  <dl className="grid gap-5 pb-5 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm text-slate-600">{t('Department name')}</dt>
                      <dd className="mt-1 break-words font-semibold text-slate-900">{department.name}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-slate-600">{t('Department status')}</dt>
                      <dd className={`mt-1 flex items-center gap-2 font-medium ${department.status === 'INACTIVE' ? 'text-slate-600' : 'text-emerald-700'}`}>
                        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
                        {t(department.status === 'INACTIVE' ? 'Department inactive' : 'Department active')}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-sm text-slate-600">{t('Department description')}</dt>
                      <dd className={`mt-3 -mx-3 min-h-[80px] whitespace-pre-wrap break-words rounded-xl bg-slate-100 px-3 py-4 text-sm leading-6 ${department.description?.trim() ? 'text-slate-700' : 'italic text-gray-400'}`}>
                        {department.description?.trim() ? department.description : t('No department description.')}
                      </dd>
                    </div>
                  </dl>
                  {onModeChange && (
                    <div className="mt-auto flex justify-end border-t border-slate-100 pt-4">
                      <Dialog.Close asChild><FormButton type="button" variant="outline" className="h-10 px-4">{t('Close')}</FormButton></Dialog.Close>
                    </div>
                  )}
                </div>
              )}
              </div>
            </>}
        </div>
      </Card>;
}
