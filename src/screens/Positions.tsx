import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { createPosition, deactivatePosition, getApiErrorMessage, getPositionById, listPositions, updatePosition, POSITION_LEVELS, type ApiPosition } from '../services/api';

const control = 'mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm focus:outline-orange-500 disabled:opacity-60';
const pageSize = 20;

export default function Positions() {
  const { t } = useLanguage();
  const [positions, setPositions] = useState<ApiPosition[]>([]);
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
  const [editing, setEditing] = useState<ApiPosition | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [jobLevel, setJobLevel] = useState('');
  const nameInput = useRef<HTMLInputElement>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ApiPosition | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailRevision, setDetailRevision] = useState(0);
  const detailHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (detailId === null) return;
    const controller = new AbortController();
    setDetail(null); setDetailError(''); setDetailLoading(true);
    detailHeading.current?.focus();
    void getPositionById(detailId, controller.signal)
      .then(result => { if (!controller.signal.aborted) setDetail(result); })
      .catch(cause => {
        if (!controller.signal.aborted) setDetailError(getApiErrorMessage(cause, 'Could not load position details. Please try again.'));
      })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [detailId, detailRevision]);

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
    setEditing(null); setName(''); setDescription(''); setJobLevel('');
  }

  function edit(position: ApiPosition) {
    setEditing(position); setName(position.name); setDescription(position.description || '');
    setJobLevel(String(position.jobLevel));
    setError(''); setMessage(''); nameInput.current?.focus();
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(''); setMessage('');
    if (!name.trim()) { setError('Enter a position name.'); nameInput.current?.focus(); return; }
    if (!POSITION_LEVELS.some(level => level.value === Number(jobLevel))) { setError('Select a position level.'); return; }
    setPending(true);
    try {
      const input = { name: name.trim(), jobLevel: Number(jobLevel), description: description.trim() || null };
      if (editing) await updatePosition(editing.id, input);
      else await createPosition(input);
      setMessage(editing ? 'Position updated.' : 'Position created.');
      resetForm();
      if (!editing) setPage(1);
      setRevision(value => value + 1);
      setDetailRevision(value => value + 1);
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
      if (editing?.id === position.id) resetForm();
      if (detailId === position.id) { setDetailId(null); setDetail(null); }
      setMessage('Position deactivated.');
      setRevision(value => value + 1);
      setDetailRevision(value => value + 1);
    } catch (cause) { setError(getApiErrorMessage(cause, 'Could not deactivate the position. Please try again.')); }
    finally { setPending(false); }
  }

  return <AppShell breadcrumb={['Workforce', 'Positions']}>
    <SectionHeader title="Positions" description="Manage position names and descriptions." />
    {message && <p role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{t(message)}</p>}
    {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{t(error)}</p>}
    {detailId !== null && <Card className="mb-5 p-5 sm:p-6">
      <section aria-labelledby="position-detail-title" aria-busy={detailLoading}>
        <div className="flex items-center justify-between gap-3">
          <h2 id="position-detail-title" ref={detailHeading} tabIndex={-1} className="text-lg font-bold text-slate-900 outline-none">{t('Position details')}</h2>
          <Button variant="secondary" onClick={() => { setDetailId(null); setDetail(null); }}>{t('Close position details')}</Button>
        </div>
        {detailLoading ? <p role="status" className="py-5 text-sm text-slate-600">{t('Loading position details...')}</p>
          : detailError ? <div role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800"><p>{t(detailError)}</p><Button className="mt-3" variant="secondary" onClick={() => setDetailRevision(value => value + 1)}>{t('Retry positions')}</Button></div>
          : detail && <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <div><dt className="text-sm text-slate-500">ID</dt><dd className="mt-1 font-medium">{detail.id}</dd></div>
            <div><dt className="text-sm text-slate-500">{t('Position code')}</dt><dd className="mt-1 break-words font-medium">{detail.code || '—'}</dd></div>
            <div><dt className="text-sm text-slate-500">{t('Position name')}</dt><dd className="mt-1 break-words font-medium">{detail.name}</dd></div>
            <div><dt className="text-sm text-slate-500">{t('Position level')}</dt><dd className="mt-1 font-medium">{t(POSITION_LEVELS.find(level => level.value === Number(detail.jobLevel))?.label || 'Unknown level')}</dd></div>
            <div><dt className="text-sm text-slate-500">{t('Position status')}</dt><dd className="mt-1 font-medium">{t(detail.status === 'INACTIVE' ? 'Position inactive' : 'Position active')}</dd></div>
            <div className="sm:col-span-2"><dt className="text-sm text-slate-500">{t('Position description')}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{detail.description || '—'}</dd></div>
          </dl>}
      </section>
    </Card>}
    <Card className="mb-5 p-5 sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">{t(editing ? 'Edit position' : 'Add position')}</h2>
      <form onSubmit={save} className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">{t('Position name')}<input ref={nameInput} required maxLength={150} value={name} disabled={pending} onChange={event => setName(event.target.value)} className={control} /></label>
        <label className="text-sm font-medium text-slate-700">{t('Position level')}<select aria-label={t('Position level')} required value={jobLevel} disabled={pending} onChange={event => setJobLevel(event.target.value)} className={control}>
          <option value="">{t('Select a position level.')}</option>
          {POSITION_LEVELS.map(level => <option key={level.value} value={level.value}>{t(level.label)}</option>)}
        </select></label>
        <label className="text-sm font-medium text-slate-700">{t('Position description')}<textarea rows={2} value={description} disabled={pending} onChange={event => setDescription(event.target.value)} className={control} /></label>
        <div className="flex flex-wrap gap-2 lg:col-span-2">
          <Button type="submit" disabled={pending}>{t(pending ? 'Saving position...' : editing ? 'Save position' : 'Add position')}</Button>
          {editing && <Button type="button" variant="secondary" disabled={pending} onClick={resetForm}>{t('Cancel')}</Button>}
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
          <thead><tr className="border-b text-slate-500"><th scope="col" className="p-3">{t('Position code')}</th><th scope="col" className="p-3">{t('Position name')}</th><th scope="col" className="p-3">{t('Position level')}</th><th scope="col" className="p-3">{t('Position description')}</th><th scope="col" className="p-3">{t('Position status')}</th><th scope="col" className="p-3">{t('Position actions')}</th></tr></thead>
          <tbody>{positions.map(position => <tr key={position.id} className="border-b border-slate-100">
            <td className="p-3">{position.code || '—'}</td>
            <th scope="row" className="max-w-64 break-words p-3 font-medium text-slate-800">{position.name}</th>
            <td className="p-3">{t(POSITION_LEVELS.find(level => level.value === Number(position.jobLevel))?.label || 'Unknown level')}</td>
            <td className="max-w-96 whitespace-pre-wrap break-words p-3 text-slate-600">{position.description || '—'}</td>
            <td className="p-3">{t(position.status === 'INACTIVE' ? 'Position inactive' : 'Position active')}</td>
            <td className="p-3"><div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={pending || loading} onClick={() => { setDetail(null); setDetailId(position.id); setDetailRevision(value => value + 1); }} aria-label={t('View position {name}', { name: position.name })}>{t('View details')}</Button>
              <Button size="sm" variant="secondary" disabled={pending || loading} onClick={() => edit(position)} aria-label={t('Edit position {name}', { name: position.name })}>{t('Edit')}</Button>
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

