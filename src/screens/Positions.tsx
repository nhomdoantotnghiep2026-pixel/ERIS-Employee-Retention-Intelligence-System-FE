import { Dialog } from 'radix-ui';
import { BriefcaseBusiness, FileText, Pencil, X } from 'lucide-react';
import { Button as TableButton } from '../components/ui/button';
import { CreateRecordDialog } from '../components/CreateRecordDialog';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { useAutoDismissState, useAutoDismissFeedback } from '../hooks/useAutoDismissState';
import { createPosition, deactivatePosition, getApiErrorMessage, getPositionById, listDepartments, listPositions, updatePosition, POSITION_LEVELS, type ApiDepartment, type ApiPosition } from '../services/api';

const createControl = 'mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-orange-500 disabled:opacity-60';
const pageSize = 20;

export default function Positions() {
  const { t, language } = useLanguage();
  const tr = (vi: string, en: string) => language === 'vi' ? vi : en;
  const [selection, setSelection] = useState<{ id: number; mode: 'detail' | 'edit' } | null>(null);
  const [modalPending, setModalPending] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  function openPosition(id: number, mode: 'detail' | 'edit', button: HTMLButtonElement) {
    trigger.current = button;
    setSelection({ id, mode });
  }
  const [positions, setPositions] = useState<ApiPosition[]>([]);
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  const [departmentError, setDepartmentError] = useState(false);
  const [departmentId, setDepartmentId] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
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
  const [jobLevel, setJobLevel] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
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
    void listPositions(controller.signal, { page, limit: pageSize, search, departmentId: Number(filterDepartment) || undefined, jobLevel: Number(filterLevel) || undefined })
      .then(result => {
        if (controller.signal.aborted) return;
        setPositions(result.data);
        setTotal(result.pagination.total);
        setHasMore(result.pagination?.has_more ?? false);
      })
      .catch(cause => {
        if (!controller.signal.aborted) setListError(getApiErrorMessage(cause, 'Could not load positions. Please try again.'));
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision, page, search, filterDepartment, filterLevel]);

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
      setCreateOpen(false);
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
    <SectionHeader title="Positions" description="Manage position names and descriptions.">
<CreateRecordDialog title={t('Add position')} open={createOpen} onOpenChange={value => { setCreateOpen(value); setError(''); }} pending={pending}>
      {error && <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{t(error)}</p>}
      <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="min-w-0 text-sm font-medium text-slate-700">
          {t('Position name')} <span aria-hidden="true" className="text-red-600">*</span>
          <input ref={nameInput} required maxLength={150} value={name} disabled={pending} placeholder={language === 'vi' ? 'Ví dụ: Chuyên viên nhân sự' : 'e.g. HR Specialist'} onChange={event => setName(event.target.value)} className={`${createControl} h-10`} />
        </label>
        <label className="min-w-0 text-sm font-medium text-slate-700">{t('Department')} <span aria-hidden="true" className="text-red-600">*</span><select required value={departmentId} disabled={pending || departmentError} onChange={event => setDepartmentId(event.target.value)} className={`${createControl} h-10 ${departmentId ? 'text-slate-900' : 'text-slate-600'}`}>
          <option value="">{t('Select department')}</option>
          {departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
        </select>{departmentError && <span role="alert" className="mt-1 block text-red-700">{t('Could not load departments. Please try again.')} <button type="button" className="underline" onClick={() => setRevision(value => value + 1)}>{t('Retry')}</button></span>}</label>
        <label className="min-w-0 text-sm font-medium text-slate-700 sm:col-start-1">{t('Position level')}<select required value={jobLevel} disabled={pending} onChange={event => setJobLevel(event.target.value)} className={`${createControl} h-10 ${jobLevel ? 'text-slate-900' : 'text-slate-600'}`}>
          <option value="">{t('Select a position level.').replace(/\.$/, '')}</option>
          {POSITION_LEVELS.map(level => <option key={level.value} value={level.value}>{t(level.label)}</option>)}
        </select></label>
        <label className="min-w-0 text-sm font-medium text-slate-700">
          {t('Position description')}
          <textarea rows={1} value={description} disabled={pending} placeholder={language === 'vi' ? 'Mô tả ngắn về nhiệm vụ của chức danh' : 'Briefly describe the responsibilities of this position'} onChange={event => setDescription(event.target.value)} className={`${createControl} h-10 resize-none py-[9px] leading-5`} />
        </label>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 sm:col-span-2">
          <TableButton type="button" variant="outline" className="h-10 rounded-lg px-4" disabled={pending} onClick={() => { setCreateOpen(false); setError(''); }}>{t('Cancel')}</TableButton>
          <TableButton type="submit" className="h-10 rounded-lg bg-orange-500 px-4 font-semibold text-white hover:bg-orange-600" disabled={pending}>{pending ? t('Saving position...') : language === 'vi' ? 'Tạo mới' : 'Create'}</TableButton>
        </div>
      </form>
    </CreateRecordDialog>
    </SectionHeader>
    {message && <p role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{t(message)}</p>}
    {error && !createOpen && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{t(error)}</p>}

    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">{t('Position list')}</h2>
        <TableButton variant="outline" className="h-10 rounded-lg border-slate-200 bg-white px-4 font-semibold text-slate-700 hover:bg-slate-50" disabled={pending || loading} onClick={() => setRevision(value => value + 1)}>{t('Reload positions')}</TableButton>
      </div>
      <form onSubmit={find} className="my-4 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="min-w-0 w-full sm:w-auto sm:flex-1 text-sm font-medium text-slate-700">{t('Search positions')}<input type="search" maxLength={100} value={query} disabled={pending || loading} onChange={event => changeSearch(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-200" /></label>
        <label className="text-sm font-medium text-slate-700">{t('Department')}<select aria-label={tr('Lọc phòng ban', 'Filter department')} value={filterDepartment} disabled={pending || loading || departmentError} onChange={event => { setFilterDepartment(event.target.value); setPage(1); }} className="mt-2 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm sm:w-48"><option value="">{tr('Tất cả phòng ban', 'All departments')}</option>{departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">{t('Position level')}<select aria-label={tr('Lọc cấp bậc', 'Filter level')} value={filterLevel} disabled={pending || loading} onChange={event => { setFilterLevel(event.target.value); setPage(1); }} className="mt-2 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm sm:w-48"><option value="">{tr('Tất cả cấp bậc', 'All levels')}</option>{POSITION_LEVELS.map(level => <option key={level.value} value={level.value}>{t(level.label)}</option>)}</select></label>
        <TableButton type="submit" variant="outline" className="h-10 rounded-lg border-orange-500 bg-orange-500 px-5 font-bold text-white hover:border-orange-600 hover:bg-orange-600" disabled={pending || loading}>{t('Search')}</TableButton>
      </form>
      {loading ? <p role="status" className="py-6 text-sm text-slate-600">{t('Loading positions...')}</p> : listError ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800"><p>{t(listError)}</p><TableButton variant="outline" className="mt-3 h-10 rounded-lg border-slate-200 bg-white px-4 font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setRevision(value => value + 1)}>{t('Retry positions')}</TableButton></div> : <>
        {!positions.length ? <p role="status" className="py-6 text-sm text-slate-600">{t('No positions found.')}</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <caption className="sr-only">{t('Position list')}</caption>
          <thead><tr className="border-b text-slate-500"><th scope="col" className="p-3">{t('Position name')}</th><th scope="col" className="p-3">{t('Department')}</th><th scope="col" className="p-3">{t('Position level')}</th><th scope="col" className="p-3">{t('Position status')}</th><th scope="col" className="p-3">{t('Position actions')}</th></tr></thead>
          <tbody>{positions.map(position => <tr key={position.id} className="border-b border-slate-100">
            <th scope="row" className="max-w-64 break-words p-3 font-medium text-slate-800">{position.name}</th>
            <td className="p-3">{departmentName(position.departmentId)}</td>
            <td className="p-3"><span className="inline-flex rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">{t(POSITION_LEVELS.find(level => level.value === Number(position.jobLevel))?.label || 'Unknown level')}</span></td>
            <td className="p-3"><span className={'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ' + (position.status === 'INACTIVE' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-50 text-emerald-700')}><span aria-hidden="true" className={'size-1.5 rounded-full ' + (position.status === 'INACTIVE' ? 'bg-slate-500' : 'bg-emerald-500')} />{t(position.status === 'INACTIVE' ? 'Position inactive' : 'Position active')}</span></td>
            <td className="w-px p-3"><div className="flex flex-nowrap gap-2">
              <TableButton size="sm" variant="outline" className="h-auto rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors border-slate-200 bg-white text-slate-700 hover:bg-slate-50" disabled={pending || loading} onClick={event => openPosition(position.id, 'detail', event.currentTarget)} aria-label={t('View position {name}', { name: position.name })}>{t('View details')}</TableButton>
              <TableButton size="sm" variant="outline" className="h-auto rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:bg-white hover:text-orange-600" disabled={pending || loading} onClick={event => openPosition(position.id, 'edit', event.currentTarget)} aria-label={t('Edit position {name}', { name: position.name })}>{t('Edit')}</TableButton>
              <TableButton size="sm" variant="outline" className="h-auto rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors border-red-100 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-600" disabled={pending || loading || position.status === 'INACTIVE'} onClick={() => void deactivate(position)} aria-label={t('Deactivate position {name}', { name: position.name })}>{t('Deactivate position')}</TableButton>
            </div></td>
          </tr>)}</tbody>
        </table></div>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">{tr(`Trang ${page}${total === null ? '' : ` (Tổng ${total} chức danh)`}`, `Page ${page}${total === null ? '' : ` (${total} positions total)`}`)}</p>
          <div className="flex flex-wrap gap-2"><TableButton variant="outline" className="h-10 rounded-lg border-slate-200 bg-white px-4 font-semibold text-slate-700 hover:bg-slate-50" disabled={page === 1 || pending || loading} onClick={() => setPage(value => value - 1)}>{t('Previous page')}</TableButton><TableButton variant="outline" className="h-10 rounded-lg border-slate-200 bg-white px-4 font-semibold text-slate-700 hover:bg-slate-50" disabled={!hasMore || pending || loading} onClick={() => setPage(value => value + 1)}>{t('Next page')}</TableButton></div>
        </div>
      </>}
    </Card>
    <Dialog.Root open={Boolean(selection)} onOpenChange={open => { if (!open && !modalPending) setSelection(null); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-slate-950/40 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150" />
        <Dialog.Content
          aria-describedby={undefined}
          onPointerDownOutside={event => event.preventDefault()}
          onEscapeKeyDown={event => { if (modalPending) event.preventDefault(); }}
          onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}
          className="fixed left-1/2 top-1/2 z-[81] max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
        >
          <Dialog.Title className="sr-only">{t(selection?.mode === 'edit' ? 'Edit position' : 'Position details')}</Dialog.Title>
          <div className="flex justify-end px-3 pt-3">
            <Dialog.Close asChild><TableButton type="button" variant="ghost" size="icon" disabled={modalPending} aria-label={t('Close')}><X size={18} aria-hidden="true" /></TableButton></Dialog.Close>
          </div>
          {selection && <PositionPanel
            id={String(selection.id)}
            mode={selection.mode}
            onModeChange={mode => setSelection({ id: selection.id, mode })}
            onPendingChange={setModalPending}
            onUpdated={updated => setPositions(rows => rows.map(row => row.id === updated.id ? { ...row, ...updated } : row))}
          />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </AppShell>;
}

export function PositionEdit() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();
  return <AppShell breadcrumb={['Workforce', 'Positions']}>
    <div className="mx-auto w-full max-w-2xl">
      <SectionHeader title="Edit position">
        <Button variant="secondary" onClick={() => navigate('/positions')}>{t('Back to list')}</Button>
      </SectionHeader>
      <PositionPanel id={id} mode="edit" />
    </div>
  </AppShell>;
}

function PositionPanel({ id, mode, onModeChange, onPendingChange, onUpdated }: {
  id?: string;
  mode: 'detail' | 'edit';
  onModeChange?: (mode: 'detail' | 'edit') => void;
  onPendingChange?: (pending: boolean) => void;
  onUpdated?: (position: ApiPosition) => void;
}) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const editing = mode === 'edit';
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

    setPending(true); onPendingChange?.(true);
    try {
      const updated = await updatePosition(position.id, {
        name: name.trim(),
        jobLevel: Number(jobLevel),
        description: description.trim() || null,
      });
      if (onModeChange) {
        setPosition(updated);
        setName(updated.name);
        setDescription(updated.description || '');
        setJobLevel(String(updated.jobLevel));
        onUpdated?.(updated);
        onModeChange('detail');
      } else {
        navigate('/positions', { replace: true });
      }
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not save the position. Please try again.'));
    } finally {
      setPending(false); onPendingChange?.(false);
    }
  }

  const department = position
    ? departments.find(item => item.id === Number(position.departmentId))?.name || `#${position.departmentId || '—'}`
    : '';

  function switchMode(next: 'detail' | 'edit') {
    if (!position || pending || next === mode) return;
    setName(position.name);
    setDescription(position.description || '');
    setJobLevel(String(position.jobLevel));
    setError('');
    onModeChange?.(next);
  }

  const statusLabel = t(position?.status === 'INACTIVE' ? 'Position inactive' : 'Position active');
  const tab = (active: boolean) => 'inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-orange-600 disabled:opacity-50 ' + (active ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-600 hover:text-slate-900');

  return <Card className="overflow-hidden">
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600"><BriefcaseBusiness size={23} aria-hidden="true" /></span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{t(editing ? 'Edit position' : 'Position details')}</p>
              <h2 className="mt-1 break-words text-xl font-bold text-slate-900">{position?.name || t('Positions')}</h2>
            </div>
          </div>
          {position && <span className={'rounded-full px-3 py-1.5 text-xs font-semibold ' + (position.status === 'INACTIVE' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-50 text-emerald-700')}>{statusLabel}</span>}
        </div>
        {position && onModeChange && <div className="mt-5 inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          <button type="button" aria-pressed={!editing} disabled={pending} className={tab(!editing)} onClick={() => switchMode('detail')}><FileText size={16} aria-hidden="true" />{t('View details')}</button>
          <button type="button" aria-pressed={editing} disabled={pending} className={tab(editing)} onClick={() => switchMode('edit')}><Pencil size={16} aria-hidden="true" />{t('Edit')}</button>
        </div>}
      </div>
        <div className="p-5 sm:p-6">
          {loading ? <p role="status" className="py-8 text-center text-sm text-slate-600">{t('Loading position details...')}</p>
            : loadError ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
              <p>{t(loadError)}</p>
              <Button className="mt-3" variant="secondary" onClick={() => setRevision(value => value + 1)}>{t('Retry positions')}</Button>
            </div>
              : position && (editing ? <form onSubmit={save} className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800 sm:col-span-2">{t(error)}</p>}
                <label className="text-sm font-medium text-slate-700">{t('Department')}
                  <input value={department} disabled className={`${createControl} h-10 text-slate-600`} />
                  {departmentError && <span role="alert" className="mt-1 block text-xs font-normal text-amber-700">{t('Could not load departments. Please try again.')} <button type="button" className="font-semibold underline" onClick={() => setRevision(value => value + 1)}>{t('Retry')}</button></span>}
                </label>
                <label className="text-sm font-medium text-slate-700">{t('Position name')} <span aria-hidden="true" className="text-red-600">*</span>
                  <input ref={nameInput} required maxLength={150} value={name} disabled={pending} onChange={event => setName(event.target.value)} className={`${createControl} h-10`} />
                </label>
                <label className="text-sm font-medium text-slate-700 sm:col-span-1">{t('Position level')}
                  <select required value={jobLevel} disabled={pending} onChange={event => setJobLevel(event.target.value)} className={`${createControl} h-10`}>
                    <option value="">{t('Select a position level.')}</option>
                    {POSITION_LEVELS.map(level => <option key={level.value} value={level.value}>{t(level.label)}</option>)}
                  </select>
                </label>
                <label className="min-w-0 text-sm font-medium text-slate-700">
                  {t('Position code')}
                  <input disabled value={position.code || '—'} title={position.code || undefined} className={`${createControl} h-10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600 disabled:opacity-100`} />
                </label>
                <label className="text-sm font-medium text-slate-700 sm:col-span-2">{t('Position description')}
                  <textarea rows={2} value={description} disabled={pending} onChange={event => setDescription(event.target.value)} className={`${createControl} h-14 resize-none py-2 leading-5`} />
                </label>
                <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5 sm:col-span-2">
                  <TableButton type="button" variant="outline" className="h-10 rounded-lg px-4" disabled={pending} onClick={() => onModeChange ? switchMode('detail') : navigate('/positions')}>{t('Cancel')}</TableButton>
                  <TableButton type="submit" className="h-10 rounded-lg bg-orange-500 px-4 font-semibold text-white hover:bg-orange-600" disabled={pending}>{t(pending ? 'Saving position...' : 'Save position')}</TableButton>
                </div>
              </form> : <>
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div><dt className="text-slate-600">{t('Position code')}</dt><dd className="mt-1 break-words font-mono font-semibold">{position.code || '—'}</dd></div>
                  <div><dt className="text-slate-600">{t('Department')}</dt><dd className="mt-1 break-words font-semibold">{department}</dd></div>
                  <div><dt className="text-slate-600">{t('Position level')}</dt><dd className="mt-1 font-semibold">{t(POSITION_LEVELS.find(level => level.value === Number(position.jobLevel))?.label || 'Unknown level')}</dd></div>
                  <div><dt className="text-slate-600">{t('Position status')}</dt><dd className="mt-1 font-semibold">{statusLabel}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-slate-600">{t('Position description')}</dt><dd className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-slate-100 p-4 leading-6 text-slate-700">{position.description || '—'}</dd></div>
                </dl>
                <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
                  <Dialog.Close asChild><TableButton type="button" variant="outline" className="h-10 px-4">{t('Close')}</TableButton></Dialog.Close>
                </div>
              </>)}
        </div>
    </Card>;
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
