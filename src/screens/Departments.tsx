import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { createDepartment, deactivateDepartment, getApiErrorMessage, getDepartmentById, listDepartments, updateDepartment, type ApiDepartment } from '../services/api';

const control = 'mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm focus:outline-orange-500 disabled:opacity-60';
const pageSize = 20;

export default function Departments() {
  const { t } = useLanguage();
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [listError, setListError] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<ApiDepartment | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const nameInput = useRef<HTMLInputElement>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ApiDepartment | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailRevision, setDetailRevision] = useState(0);
  const detailHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (detailId === null) return;
    const controller = new AbortController();
    setDetail(null); setDetailError(''); setDetailLoading(true);
    detailHeading.current?.focus();
    void getDepartmentById(detailId, controller.signal)
      .then(result => { if (!controller.signal.aborted) setDetail(result); })
      .catch(cause => {
        if (!controller.signal.aborted) setDetailError(getApiErrorMessage(cause, 'Could not load department details. Please try again.'));
      })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [detailId, detailRevision]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setListError('');
    void listDepartments(controller.signal, { page, limit: pageSize, search })
      .then(result => {
        if (controller.signal.aborted) return;
        setDepartments(result.data);
        setHasMore(result.pagination?.has_more ?? false);
      })
      .catch(cause => {
        if (!controller.signal.aborted) setListError(getApiErrorMessage(cause, 'Could not load departments. Please try again.'));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision, page, search]);

  function resetForm() {
    setEditing(null); setName(''); setDescription('');
  }

  function edit(department: ApiDepartment) {
    setEditing(department); setName(department.name); setDescription(department.description || '');
    setError(''); setMessage(''); nameInput.current?.focus();
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(''); setMessage('');
    if (!name.trim()) { setError('Enter a department name.'); nameInput.current?.focus(); return; }
    setPending(true);
    try {
      const input = { name: name.trim(), description: description.trim() || null };
      if (editing) await updateDepartment(editing.id, input);
      else await createDepartment(input);
      setMessage(editing ? 'Department updated.' : 'Department created.');
      resetForm();
      if (!editing) setPage(1);
      setRevision(value => value + 1);
      setDetailRevision(value => value + 1);
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
      if (editing?.id === department.id) resetForm();
      if (detailId === department.id) { setDetailId(null); setDetail(null); }
      setMessage('Department deactivated.');
      setRevision(value => value + 1);
      setDetailRevision(value => value + 1);
    } catch (cause) { setError(getApiErrorMessage(cause, 'Could not deactivate the department. Please try again.')); }
    finally { setPending(false); }
  }

  return <AppShell breadcrumb={['Workforce', 'Departments']}>
    <SectionHeader title="Departments" description="Manage department names and descriptions." />
    {message && <p role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{t(message)}</p>}
    {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{t(error)}</p>}
    {detailId !== null && <Card className="mb-5 p-5 sm:p-6">
      <section aria-labelledby="department-detail-title" aria-busy={detailLoading}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="department-detail-title" ref={detailHeading} tabIndex={-1} className="text-lg font-bold text-slate-900 outline-none">{t('Department details')}</h2>
          <Button variant="secondary" onClick={() => { setDetailId(null); setDetail(null); }}>{t('Close department details')}</Button>
        </div>
        {detailLoading ? <p role="status" className="py-5 text-sm text-slate-600">{t('Loading department details...')}</p>
          : detailError ? <div role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800"><p>{t(detailError)}</p><Button className="mt-3" variant="secondary" onClick={() => setDetailRevision(value => value + 1)}>{t('Retry departments')}</Button></div>
          : detail && <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <div><dt className="text-sm text-slate-500">{t('Department code')}</dt><dd className="mt-1 break-words font-medium">{detail.code || '—'}</dd></div>
            <div><dt className="text-sm text-slate-500">{t('Department name')}</dt><dd className="mt-1 break-words font-medium">{detail.name}</dd></div>
            <div><dt className="text-sm text-slate-500">{t('Department status')}</dt><dd className="mt-1 font-medium">{t(detail.status === 'INACTIVE' ? 'Department inactive' : 'Department active')}</dd></div>
            <div className="min-w-0"><dt className="text-sm text-slate-500">{t('Department description')}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{detail.description || '—'}</dd></div>
          </dl>}
      </section>
    </Card>}
    <Card className="mb-5 p-5 sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">{t(editing ? 'Edit department' : 'Add department')}</h2>
      <form onSubmit={save} className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">{t('Department name')}<input ref={nameInput} required maxLength={150} value={name} disabled={pending} onChange={event => setName(event.target.value)} className={control} /></label>
        <label className="text-sm font-medium text-slate-700">{t('Department description')}<textarea rows={2} value={description} disabled={pending} onChange={event => setDescription(event.target.value)} className={control} /></label>
        <div className="flex flex-wrap gap-2 lg:col-span-2">
          <Button type="submit" disabled={pending}>{t(pending ? 'Saving department...' : editing ? 'Save department' : 'Add department')}</Button>
          {editing && <Button type="button" variant="secondary" disabled={pending} onClick={resetForm}>{t('Cancel')}</Button>}
        </div>
      </form>
    </Card>
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">{t('Department list')}</h2>
        <Button variant="secondary" disabled={pending || loading} onClick={() => setRevision(value => value + 1)}>{t('Reload departments')}</Button>
      </div>
      <form onSubmit={find} className="my-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm font-medium text-slate-700">{t('Search departments')}<input type="search" maxLength={100} value={query} disabled={pending || loading} onChange={event => changeSearch(event.target.value)} className={control} /></label>
        <Button type="submit" variant="secondary" disabled={pending || loading}>{t('Search')}</Button>
      </form>
      {loading ? <p role="status" className="py-6 text-sm text-slate-600">{t('Loading departments...')}</p> : listError ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800"><p>{t(listError)}</p><Button className="mt-3" variant="secondary" onClick={() => setRevision(value => value + 1)}>{t('Retry departments')}</Button></div> : <>
        {!departments.length ? <p role="status" className="py-6 text-sm text-slate-600">{t('No departments found.')}</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <caption className="sr-only">{t('Department list')}</caption>
          <thead><tr className="border-b text-slate-500"><th scope="col" className="p-3">{t('Department code')}</th><th scope="col" className="p-3">{t('Department name')}</th><th scope="col" className="p-3">{t('Department status')}</th><th scope="col" className="p-3">{t('Department actions')}</th></tr></thead>
          <tbody>{departments.map(department => <tr key={department.id} className="border-b border-slate-100">
            <td className="p-3">{department.code || '—'}</td>
            <th scope="row" className="max-w-64 break-words p-3 font-medium text-slate-800">{department.name}</th>
            <td className="p-3">{t(department.status === 'INACTIVE' ? 'Department inactive' : 'Department active')}</td>
            <td className="w-px p-3"><div className="flex flex-nowrap gap-2">
              <Button size="sm" variant="secondary" disabled={pending || loading} onClick={() => { setDetail(null); setDetailId(department.id); setDetailRevision(value => value + 1); }} aria-label={t('View department {name}', { name: department.name })}>{t('View details')}</Button>
              <Button size="sm" variant="secondary" disabled={pending || loading} onClick={() => edit(department)} aria-label={t('Edit department {name}', { name: department.name })}>{t('Edit')}</Button>
              <Button size="sm" variant="secondary" disabled={pending || loading || department.status === 'INACTIVE'} onClick={() => void deactivate(department)} aria-label={t('Deactivate department {name}', { name: department.name })}>{t('Deactivate department')}</Button>
            </div></td>
          </tr>)}</tbody>
        </table></div>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">{t('Department page {page}', { page })}</p>
          <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={page === 1 || pending || loading} onClick={() => setPage(value => value - 1)}>{t('Previous page')}</Button><Button variant="secondary" disabled={!hasMore || pending || loading} onClick={() => setPage(value => value + 1)}>{t('Next page')}</Button></div>
        </div>
      </>}
    </Card>
  </AppShell>;
}
