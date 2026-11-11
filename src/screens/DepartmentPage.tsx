import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, FileText, Pencil } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Button, Card } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { useAutoDismissFeedback } from '../hooks/useAutoDismissState';
import { getDepartmentById, updateDepartment, getApiErrorMessage, type ApiDepartment } from '../services/api';

const control = 'mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-50 disabled:bg-slate-50';

export default function DepartmentPage({ mode }: { mode: 'detail' | 'edit' }) {
  const { t } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const [department, setDepartment] = useState<ApiDepartment | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pending, setPending] = useState(false);
  const [revision, setRevision] = useState(0);
  const { error, message, setError, setMessage } = useAutoDismissFeedback();
  const nameInput = useRef<HTMLInputElement>(null);
  const editing = mode === 'edit';

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
      })
      .catch(cause => { if (!controller.signal.aborted) setLoadError(getApiErrorMessage(cause, 'Could not load department details. Please try again.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, mode, revision, setError, setMessage]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!department || pending) return;
    setError(''); setMessage('');
    if (!name.trim()) { setError('Enter a department name.'); nameInput.current?.focus(); return; }
    setPending(true);
    try {
      const updated = await updateDepartment(department.id, { name: name.trim(), description: description.trim() || null });
      setDepartment(updated); setName(updated.name); setDescription(updated.description || '');
      setMessage('Department updated.');
    } catch (cause) { setError(getApiErrorMessage(cause, 'Could not save the department. Please try again.')); }
    finally { setPending(false); }
  }

  const tabClass = (active: boolean) => `inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${active ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`;
  return <AppShell breadcrumb={['Workforce', 'Departments', editing ? 'Edit department' : 'Department details']}>
    <div className="mx-auto w-full max-w-4xl">
      <button type="button" className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-600 hover:text-orange-600 disabled:opacity-50" disabled={pending} onClick={() => navigate('/departments')}><ArrowLeft size={17} />{t('Back to departments')}</button>
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3"><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><Building2 size={24} /></span><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t(editing ? 'Edit department' : 'Department details')}</p><h1 className="mt-1 break-words text-xl font-bold text-slate-900">{department?.name || t('Departments')}</h1></div></div>
            {department && <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${department.status === 'INACTIVE' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>{t(department.status === 'INACTIVE' ? 'Department inactive' : 'Department active')}</span>}
          </div>
          {department && <nav aria-label={t('Department views')} className="mt-5 inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
            {pending ? <span className={tabClass(false)}><FileText size={16} />{t('View details')}</span> : <Link to={`/departments/${department.id}`} aria-current={!editing ? 'page' : undefined} className={tabClass(!editing)}><FileText size={16} />{t('View details')}</Link>}
            <Link to={`/departments/${department.id}/edit`} aria-current={editing ? 'page' : undefined} className={tabClass(editing)}><Pencil size={16} />{t('Edit')}</Link>
          </nav>}
        </div>
        <div className="p-5 sm:p-6">
          {loading ? <p role="status" className="py-5 text-sm text-slate-500">{t('Loading department details...')}</p>
            : loadError ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700"><p>{t(loadError)}</p><Button variant="secondary" className="mt-3" onClick={() => setRevision(value => value + 1)}>{t('Retry departments')}</Button></div>
            : department && <>
              {message && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{t(message)}</p>}
              {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{t(error)}</p>}
              <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"><span className="text-slate-500">{t('Department code')}</span><span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">{department.code || '—'}</span></div>
              {editing ? <form onSubmit={save}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">{t('Department name')}<input ref={nameInput} required maxLength={150} className={control} disabled={pending} value={name} onChange={event => setName(event.target.value)} /></label>
                  <label className="text-sm font-medium text-slate-700">{t('Department description')}<textarea rows={1} className={`${control} resize-none overflow-y-auto`} disabled={pending} value={description} onChange={event => setDescription(event.target.value)} /></label>
                </div>
                <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="secondary" disabled={pending} onClick={() => navigate(`/departments/${department.id}`)}>{t('Cancel')}</Button><Button type="submit" disabled={pending}>{t(pending ? 'Saving department...' : 'Save department')}</Button></div>
              </form> : <dl className="grid gap-5 sm:grid-cols-2">
                <div><dt className="text-sm text-slate-500">{t('Department name')}</dt><dd className="mt-1 break-words font-semibold text-slate-900">{department.name}</dd></div>
                <div><dt className="text-sm text-slate-500">{t('Department status')}</dt><dd className="mt-1 font-medium">{t(department.status === 'INACTIVE' ? 'Department inactive' : 'Department active')}</dd></div>
                <div className="sm:col-span-2"><dt className="text-sm text-slate-500">{t('Department description')}</dt><dd className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{department.description || t('No department description.')}</dd></div>
              </dl>}
            </>}
        </div>
      </Card>
    </div>
  </AppShell>;
}
