import { Button as TableButton } from '../components/ui/button';
import { CreateRecordDialog } from '../components/CreateRecordDialog';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { useAutoDismissFeedback } from '../hooks/useAutoDismissState';
import { createDepartment, deactivateDepartment, getApiErrorMessage, listDepartments, type ApiDepartment } from '../services/api';

const control = 'mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm focus:outline-orange-500 disabled:opacity-60';
const pageSize = 20;

export default function Departments() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [listError, setListError] = useState('');
  const { error, message, setError, setMessage } = useAutoDismissFeedback();
  const [revision, setRevision] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setListError('');
    void listDepartments(controller.signal, { page, limit: pageSize, search })
      .then(result => {
        if (controller.signal.aborted) return;
        setDepartments(result.data);
        setTotal(result.pagination?.total ?? null);
        setHasMore(result.pagination?.has_more ?? false);
      })
      .catch(cause => {
        if (!controller.signal.aborted) setListError(getApiErrorMessage(cause, 'Could not load departments. Please try again.'));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision, page, search]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(''); setMessage('');
    if (!name.trim()) { setError('Enter a department name.'); nameInput.current?.focus(); return; }
    setPending(true);
    try {
      const input = { name: name.trim(), description: description.trim() || null };
      await createDepartment(input);
      setMessage('Department created.');
      setCreateOpen(false);
      setName(''); setDescription('');
      setPage(1);
      setRevision(value => value + 1);
    } catch (cause) { setError(getApiErrorMessage(cause, 'Could not save the department. Please try again.')); }
    finally { setPending(false); }
  }

  function find(event: FormEvent) {
    event.preventDefault(); setPage(1); setSearch(query.trim());
  }

  function changeSearch(value: string) {
    setQuery(value);
    // Clearing the native search field must also clear the submitted filter.
    if (!value.trim()) {
      setSearch('');
      setPage(1);
    }
  }

  async function deactivate(department: ApiDepartment) {
    if (pending || department.status === 'INACTIVE') return;
    if (!window.confirm(t('Deactivate department "{name}"? Its record will remain in the database.', { name: department.name }))) return;
    setPending(true); setError(''); setMessage('');
    try {
      await deactivateDepartment(department.id);
      setDepartments(current => current.filter(item => item.id !== department.id));
      if (departments.length === 1 && page > 1) setPage(value => value - 1);
      setMessage('Department deactivated.');
      setRevision(value => value + 1);
    } catch (cause) { setError(getApiErrorMessage(cause, 'Could not deactivate the department. Please try again.')); }
    finally { setPending(false); }
  }

  return <AppShell breadcrumb={['Workforce', 'Departments']}>
    <SectionHeader title="Departments" description="Manage department names and descriptions.">
<CreateRecordDialog title={t('Add department')} open={createOpen} onOpenChange={value => { setCreateOpen(value); setError(''); }} pending={pending}>
      {error && <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{t(error)}</p>}
      <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">{t('Department name')}<input ref={nameInput} required maxLength={150} value={name} disabled={pending} onChange={event => setName(event.target.value)} className={`${control} h-12`} /></label>
        <label className="text-sm font-medium text-slate-700">{t('Department description')}<textarea rows={1} value={description} disabled={pending} onChange={event => setDescription(event.target.value)} className={`${control} h-12 resize-none overflow-y-auto`} /></label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" disabled={pending}>{t(pending ? 'Saving department...' : 'Add department')}</Button>
        </div>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => setCreateOpen(false)}>{t('Cancel')}</Button>
      </form>
    </CreateRecordDialog>
    </SectionHeader>
    {message && <p role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{t(message)}</p>}
    {error && !createOpen && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{t(error)}</p>}

    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">{t('Department list')}</h2>
        <TableButton variant="outline" className="h-9 rounded-lg border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" disabled={pending || loading} onClick={() => setRevision(value => value + 1)}>{t('Reload departments')}</TableButton>
      </div>
      <form onSubmit={find} className="my-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm font-medium text-slate-700">{t('Search departments')}<input type="search" maxLength={100} value={query} disabled={pending || loading} onChange={event => changeSearch(event.target.value)} className={`${control} h-12`} /></label>
        <TableButton type="submit" variant="outline" className="h-12 rounded-lg border-orange-500 bg-orange-500 px-5 text-sm font-bold text-white hover:border-orange-600 hover:bg-orange-600" disabled={pending || loading}>{t('Search')}</TableButton>
      </form>
      {loading ? <p role="status" className="py-6 text-sm text-slate-600">{t('Loading departments...')}</p> : listError ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800"><p>{t(listError)}</p><TableButton variant="outline" className="mt-3 h-9 rounded-lg border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" onClick={() => setRevision(value => value + 1)}>{t('Retry departments')}</TableButton></div> : <>
        {!departments.length ? <p role="status" className="py-6 text-sm text-slate-600">{t('No departments found.')}</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <caption className="sr-only">{t('Department list')}</caption>
          <thead><tr className="border-b text-slate-500"><th scope="col" className="p-3">{t('Department code')}</th><th scope="col" className="p-3">{t('Department name')}</th><th scope="col" className="p-3">{t('Department status')}</th><th scope="col" className="p-3">{t('Department actions')}</th></tr></thead>
          <tbody>{departments.map(department => <tr key={department.id} className="border-b border-slate-100">
            <td className="p-3">{department.code || '—'}</td>
            <th scope="row" className="max-w-64 break-words p-3 font-medium text-slate-800">{department.name}</th>
            <td className="p-3"><span className={'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ' + (department.status === 'INACTIVE' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-50 text-emerald-700')}><span aria-hidden="true" className={'size-1.5 rounded-full ' + (department.status === 'INACTIVE' ? 'bg-slate-500' : 'bg-emerald-500')} />{t(department.status === 'INACTIVE' ? 'Department inactive' : 'Department active')}</span></td>
            <td className="w-px p-3"><div className="flex flex-nowrap gap-2">
              <TableButton size="sm" variant="outline" className="h-auto rounded-lg border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50" disabled={pending || loading} onClick={() => navigate(`/departments/${department.id}`)} aria-label={t('View department {name}', { name: department.name })}>{t('View details')}</TableButton>
              <TableButton size="sm" variant="outline" className="h-auto rounded-lg border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-orange-300 hover:bg-white hover:text-orange-600" disabled={pending || loading} onClick={() => navigate(`/departments/${department.id}/edit`)} aria-label={t('Edit department {name}', { name: department.name })}>{t('Edit')}</TableButton>
              <TableButton size="sm" variant="outline" className="h-auto rounded-lg border-red-100 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 hover:text-red-600" disabled={pending || loading || department.status === 'INACTIVE'} onClick={() => void deactivate(department)} aria-label={t('Deactivate department {name}', { name: department.name })}>{t('Deactivate department')}</TableButton>
            </div></td>
          </tr>)}</tbody>
        </table></div>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">{language === 'vi' ? `Trang ${page}${total === null ? '' : ` (Tổng ${total} phòng ban)`}` : `Page ${page}${total === null ? '' : ` (${total} departments total)`}`}</p>
          <div className="flex flex-wrap gap-2"><TableButton variant="outline" className="h-9 rounded-lg border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" disabled={page === 1 || pending || loading} onClick={() => setPage(value => value - 1)}>{t('Previous page')}</TableButton><TableButton variant="outline" className="h-9 rounded-lg border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" disabled={!hasMore || pending || loading} onClick={() => setPage(value => value + 1)}>{t('Next page')}</TableButton></div>
        </div>
      </>}
    </Card>
  </AppShell>;
}
