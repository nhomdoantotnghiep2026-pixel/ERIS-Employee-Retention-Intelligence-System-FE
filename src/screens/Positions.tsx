import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { useAutoDismissState, useAutoDismissFeedback } from '../hooks/useAutoDismissState';
import { createPosition, deactivatePosition, getApiErrorMessage, getPositionById, listDepartments, listPositions, updatePosition, POSITION_LEVELS, type ApiDepartment, type ApiPosition } from '../services/api';

const control = 'mt-2 h-14 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm focus:outline-orange-500 disabled:opacity-60';
const pageSize = 20;

export default function Positions() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [positions, setPositions] = useState<ApiPosition[]>([]);
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  const [departmentError, setDepartmentError] = useState(false);
  const [departmentId, setDepartmentId] = useState('');
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
  const [jobLevel, setJobLevel] = useState('');
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setDepartmentError(false);
    void listDepartments(controller.signal, { limit: Number.MAX_SAFE_INTEGER })
      .then(result => { if (!controller.signal.aborted) setDepartments(result.data); })
      .catch(() => { if (!controller.signal.aborted) setDepartmentError(true); });
    return () => controller.abort();
  }, [revision]);

  function departmentName(id?: number | null) {
    if (!id) return '—';
    return departments.find(department => department.id === Number(id))?.name || `#${id}`;
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setListError('');
    void listPositions(controller.signal, { page, limit: pageSize, search })
      .then(result => {
        if (controller.signal.aborted) return;
        setPositions(result.data);
        setHasMore(result.pagination?.has_more ?? false);
      })
      .catch(cause => {
        if (!controller.signal.aborted) setListError(getApiErrorMessage(cause, 'Could not load positions. Please try again.'));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision, page, search]);

  function resetForm() {
    setName(''); setDescription(''); setJobLevel(''); setDepartmentId('');
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(''); setMessage('');
    if (!name.trim()) { setError('Enter a position name.'); nameInput.current?.focus(); return; }
    if (!POSITION_LEVELS.some(level => level.value === Number(jobLevel))) { setError('Select a position level.'); return; }
    if (!departments.some(department => department.id === Number(departmentId))) { setError('Select department'); return; }
    setPending(true);
    try {
      const input = { name: name.trim(), jobLevel: Number(jobLevel), description: description.trim() || null };
      await createPosition({ ...input, departmentId: Number(departmentId) });
      setMessage('Position created.');
      resetForm();
      setPage(1);
      setRevision(value => value + 1);
    } catch (cause) { setError(getApiErrorMessage(cause, 'Could not save the position. Please try again.')); }
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

  async function deactivate(position: ApiPosition) {
    if (pending || position.status === 'INACTIVE') return;
    if (!window.confirm(t('Deactivate position "{name}"? Its record will remain in the database.', { name: position.name }))) return;
    setPending(true); setError(''); setMessage('');
    try {
      await deactivatePosition(position.id);
      setPositions(current => current.filter(item => item.id !== position.id));
      if (positions.length === 1 && page > 1) setPage(value => value - 1);
      setMessage('Position deactivated.');
      setRevision(value => value + 1);
    } catch (cause) { setError(getApiErrorMessage(cause, 'Could not deactivate the position. Please try again.')); }
    finally { setPending(false); }
  }

  return <AppShell breadcrumb={['Workforce', 'Positions']}>
    <SectionHeader title="Positions" description="Manage position names and descriptions." />
    {message && <p role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{t(message)}</p>}
    {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{t(error)}</p>}
    <Card className="mb-5 p-5 sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">{t('Add position')}</h2>
      <form onSubmit={save} className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">{t('Department')} *<select required value={departmentId} disabled={pending || departmentError} onChange={event => setDepartmentId(event.target.value)} className={control}>
          <option value="">{t('Select department')}</option>
          {departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
        </select>{departmentError && <span role="alert" className="mt-1 block text-red-700">{t('Could not load departments. Please try again.')} <button type="button" className="underline" onClick={() => setRevision(value => value + 1)}>{t('Retry')}</button></span>}</label>
        <label className="text-sm font-medium text-slate-700">{t('Position name')}<input ref={nameInput} required maxLength={150} value={name} disabled={pending} onChange={event => setName(event.target.value)} className={control} /></label>
        <label className="text-sm font-medium text-slate-700">{t('Position level')}<select aria-label={t('Position level')} required value={jobLevel} disabled={pending} onChange={event => setJobLevel(event.target.value)} className={control}>
          <option value="">{t('Select a position level.')}</option>
          {POSITION_LEVELS.map(level => <option key={level.value} value={level.value}>{t(level.label)}</option>)}
        </select></label>
        <label className="text-sm font-medium text-slate-700">{t('Position description')}<textarea rows={2} value={description} disabled={pending} onChange={event => setDescription(event.target.value)} className={`${control} resize-none`} /></label>
        <div className="flex flex-wrap gap-2 lg:col-span-2">
          <Button type="submit" disabled={pending}>{t(pending ? 'Saving position...' : 'Add position')}</Button>
        </div>
      </form>
    </Card>
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">{t('Position list')}</h2>
        <Button variant="secondary" disabled={pending || loading} onClick={() => setRevision(value => value + 1)}>{t('Reload positions')}</Button>
      </div>
      <form onSubmit={find} className="my-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm font-medium text-slate-700">{t('Search positions')}<input type="search" maxLength={100} value={query} disabled={pending || loading} onChange={event => changeSearch(event.target.value)} className={control} /></label>
        <Button type="submit" variant="secondary" disabled={pending || loading}>{t('Search')}</Button>
      </form>
      {loading ? <p role="status" className="py-6 text-sm text-slate-600">{t('Loading positions...')}</p> : listError ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800"><p>{t(listError)}</p><Button className="mt-3" variant="secondary" onClick={() => setRevision(value => value + 1)}>{t('Retry positions')}</Button></div> : <>
        {!positions.length ? <p role="status" className="py-6 text-sm text-slate-600">{t('No positions found.')}</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <caption className="sr-only">{t('Position list')}</caption>
          <thead><tr className="border-b text-slate-500"><th scope="col" className="p-3">{t('Position name')}</th><th scope="col" className="p-3">{t('Department')}</th><th scope="col" className="p-3">{t('Position level')}</th><th scope="col" className="p-3">{t('Position status')}</th><th scope="col" className="p-3">{t('Position actions')}</th></tr></thead>
          <tbody>{positions.map(position => <tr key={position.id} className="border-b border-slate-100">
            <th scope="row" className="max-w-64 break-words p-3 font-medium text-slate-800">{position.name}</th>
            <td className="p-3">{departmentName(position.departmentId)}</td>
            <td className="p-3">{t(POSITION_LEVELS.find(level => level.value === Number(position.jobLevel))?.label || 'Unknown level')}</td>
            <td className="p-3">{t(position.status === 'INACTIVE' ? 'Position inactive' : 'Position active')}</td>
            <td className="w-px p-3"><div className="flex flex-nowrap gap-2">
              <Button size="sm" variant="secondary" disabled={pending || loading} onClick={() => navigate(`/positions/${position.id}`)} aria-label={t('View position {name}', { name: position.name })}>{t('View details')}</Button>
              <Button size="sm" variant="secondary" disabled={pending || loading} onClick={() => navigate(`/positions/${position.id}/edit`)} aria-label={t('Edit position {name}', { name: position.name })}>{t('Edit')}</Button>
              <Button size="sm" variant="secondary" disabled={pending || loading || position.status === 'INACTIVE'} onClick={() => void deactivate(position)} aria-label={t('Deactivate position {name}', { name: position.name })}>{t('Deactivate position')}</Button>
            </div></td>
          </tr>)}</tbody>
        </table></div>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">{t('Position page {page}', { page })}</p>
          <div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={page === 1 || pending || loading} onClick={() => setPage(value => value - 1)}>{t('Previous page')}</Button><Button variant="secondary" disabled={!hasMore || pending || loading} onClick={() => setPage(value => value + 1)}>{t('Next page')}</Button></div>
        </div>
      </>}
    </Card>
  </AppShell>;
}

export function PositionEdit() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();
  const [position, setPosition] = useState<ApiPosition | null>(null);
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [jobLevel, setJobLevel] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [departmentError, setDepartmentError] = useState(false);
  const [error, setError] = useAutoDismissState();
  const [revision, setRevision] = useState(0);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const positionId = Number(id);
    setPosition(null);
    setLoadError('');
    setDepartmentError(false);
    setLoading(true);
    if (!Number.isInteger(positionId) || positionId <= 0) {
      setLoadError('Could not load position details. Please try again.');
      setLoading(false);
      return () => controller.abort();
    }

    void getPositionById(positionId, controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        setPosition(result);
        setName(result.name);
        setDescription(result.description || '');
        setJobLevel(String(result.jobLevel));
      })
      .catch(cause => {
        if (!controller.signal.aborted) setLoadError(getApiErrorMessage(cause, 'Could not load position details. Please try again.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    void listDepartments(controller.signal, { limit: Number.MAX_SAFE_INTEGER })
      .then(result => {
        if (!controller.signal.aborted) setDepartments(result.data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setDepartmentError(true);
      });

    return () => controller.abort();
  }, [id, revision]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!position || pending) return;
    setError('');
    if (!name.trim()) {
      setError('Enter a position name.');
      nameInput.current?.focus();
      return;
    }
    if (!POSITION_LEVELS.some(level => level.value === Number(jobLevel))) {
      setError('Select a position level.');
      return;
    }

    setPending(true);
    try {
      await updatePosition(position.id, {
        name: name.trim(),
        jobLevel: Number(jobLevel),
        description: description.trim() || null,
      });
      navigate('/positions', { replace: true });
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not save the position. Please try again.'));
    } finally {
      setPending(false);
    }
  }

  const department = position
    ? departments.find(item => item.id === Number(position.departmentId))?.name || `#${position.departmentId || '—'}`
    : '';

  return <AppShell breadcrumb={['Workforce', 'Positions']}>
    <div className="mx-auto w-full max-w-[1360px]">
      <SectionHeader title="Edit position">
        <Button variant="secondary" onClick={() => navigate('/positions')}>{t('Back to list')}</Button>
      </SectionHeader>
      <Card className="overflow-hidden">
        <div className="border-b border-orange-100 bg-gradient-to-r from-orange-50 via-white to-amber-50 px-5 py-5 sm:px-8 sm:py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-orange-700">{t('Position details')}</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">{t('Update position details')}</h2>
            </div>
          </div>
        </div>
        <div className="p-5 sm:p-8">
          {loading ? <p role="status" className="py-8 text-center text-sm text-slate-600">{t('Loading position details...')}</p>
            : loadError ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
              <p>{t(loadError)}</p>
              <Button className="mt-3" variant="secondary" onClick={() => setRevision(value => value + 1)}>{t('Retry positions')}</Button>
            </div>
              : position && <form onSubmit={save} className="grid gap-x-6 gap-y-5 md:grid-cols-2">
                {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800 md:col-span-2">{t(error)}</p>}
                <label className="text-sm font-medium text-slate-700">{t('Department')}
                  <input value={department} disabled className={`${control} bg-slate-50 text-slate-600`} />
                  {departmentError && <span role="alert" className="mt-1 block text-xs font-normal text-amber-700">{t('Could not load departments. Please try again.')} <button type="button" className="font-semibold underline" onClick={() => setRevision(value => value + 1)}>{t('Retry')}</button></span>}
                </label>
                <label className="text-sm font-medium text-slate-700">{t('Position name')}
                  <input ref={nameInput} required maxLength={150} value={name} disabled={pending} onChange={event => setName(event.target.value)} className={control} />
                </label>
                <label className="text-sm font-medium text-slate-700 md:col-span-1">{t('Position level')}
                  <select required value={jobLevel} disabled={pending} onChange={event => setJobLevel(event.target.value)} className={control}>
                    <option value="">{t('Select a position level.')}</option>
                    {POSITION_LEVELS.map(level => <option key={level.value} value={level.value}>{t(level.label)}</option>)}
                  </select>
                </label>
                <div className="flex min-h-20 items-center justify-between gap-4 self-end rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('Position code')}</p>
                    <p className="mt-1 break-words font-semibold text-slate-800">{position.code || '—'}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${position.status === 'INACTIVE' ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                    {t(position.status === 'INACTIVE' ? 'Position inactive' : 'Position active')}
                  </span>
                </div>
                <label className="text-sm font-medium text-slate-700 md:col-span-2">{t('Position description')}
                  <textarea rows={4} value={description} disabled={pending} onChange={event => setDescription(event.target.value)} className={`${control} h-32 resize-none leading-relaxed`} />
                </label>
                <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5 md:col-span-2">
                  <Button type="button" variant="secondary" disabled={pending} onClick={() => navigate('/positions')}>{t('Cancel')}</Button>
                  <Button type="submit" disabled={pending}>{t(pending ? 'Saving position...' : 'Save position')}</Button>
                </div>
              </form>}
        </div>
      </Card>
    </div>
  </AppShell>;
}

export function PositionDetail() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();
  const [detail, setDetail] = useState<ApiPosition | null>(null);
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState('');
  const [detailRevision, setDetailRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const positionId = Number(id);
    setDetail(null); setDetailError(''); setDetailLoading(true);
    if (!Number.isInteger(positionId) || positionId <= 0) {
      setDetailError('Could not load position details. Please try again.');
      setDetailLoading(false);
      return () => controller.abort();
    }
    void getPositionById(positionId, controller.signal)
      .then(result => { if (!controller.signal.aborted) setDetail(result); })
      .catch(cause => { if (!controller.signal.aborted) setDetailError(getApiErrorMessage(cause, 'Could not load position details. Please try again.')); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    void listDepartments(controller.signal, { limit: Number.MAX_SAFE_INTEGER })
      .then(result => { if (!controller.signal.aborted) setDepartments(result.data); })
      .catch(() => {});
    return () => controller.abort();
  }, [id, detailRevision]);
  function departmentName(id?: number | null) {
    if (!id) return '—';
    return departments.find(department => department.id === Number(id))?.name || `#${id}`;
  }
  return <AppShell breadcrumb={['Workforce', 'Positions']}>
    <div className="mx-auto w-full max-w-[1360px]">
    <SectionHeader title="Position details"><Button variant="secondary" onClick={() => navigate('/positions')}>{t('Back to list')}</Button></SectionHeader>
    <Card className="mb-5 p-5 sm:p-6 lg:p-8">
      <section aria-label={t('Position details')} aria-busy={detailLoading}>
        {detailLoading ? <p role="status" className="py-5 text-sm text-slate-600">{t('Loading position details...')}</p>
          : detailError ? <div role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800"><p>{t(detailError)}</p><Button className="mt-3" variant="secondary" onClick={() => setDetailRevision(value => value + 1)}>{t('Retry positions')}</Button></div>
          : detail && <>
          <h2 className="text-lg font-bold text-slate-900">{t('Position information')}</h2>
          <dl className="mt-4 grid gap-4 md:grid-cols-2 [&>div]:p-5 [&_dd]:text-base [&_dt]:font-medium">
            <div className="min-w-0 rounded-xl bg-slate-50 p-4"><dt className="text-sm text-slate-500">{t('Position name')}</dt><dd className="mt-1 break-words font-medium text-slate-900">{detail.name}</dd></div>
            <div className="min-w-0 rounded-xl bg-slate-50 p-4"><dt className="text-sm text-slate-500">{t('Position code')}</dt><dd className="mt-1 break-words font-medium text-slate-900">{detail.code || '—'}</dd></div>
            <div className="min-w-0 rounded-xl bg-slate-50 p-4"><dt className="text-sm text-slate-500">{t('Department')}</dt><dd className="mt-1 break-words font-medium text-slate-900">{departmentName(detail.departmentId)}</dd></div>
            <div className="min-w-0 rounded-xl bg-slate-50 p-4"><dt className="text-sm text-slate-500">{t('Position level')}</dt><dd className="mt-1 font-medium text-slate-900">{t(POSITION_LEVELS.find(level => level.value === Number(detail.jobLevel))?.label || 'Unknown level')}</dd></div>
          </dl>
          <h2 className="mt-6 border-t border-slate-100 pt-6 text-lg font-bold text-slate-900">{t('Status and description')}</h2>
          <dl className="mt-4 grid gap-4 md:grid-cols-2 [&>div]:p-5 [&_dd]:text-base [&_dt]:font-medium">
            <div className="min-w-0 rounded-xl bg-slate-50 p-4"><dt className="text-sm text-slate-500">{t('Position status')}</dt><dd className="mt-1 font-medium text-slate-900">{t(detail.status === 'INACTIVE' ? 'Position inactive' : 'Position active')}</dd></div>
            <div className="min-w-0 rounded-xl bg-slate-50 p-4"><dt className="text-sm text-slate-500">{t('Position description')}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-slate-900">{detail.description || '—'}</dd></div>
          </dl></>}
      </section>
    </Card>
    </div>
  </AppShell>;
}
