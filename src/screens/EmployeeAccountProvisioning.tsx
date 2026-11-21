import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyRound, RefreshCw, Search, Users } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/ui/button';
import { Card, SectionHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { useAutoDismissFeedback } from '../hooks/useAutoDismissState';
import { ApiError, getApiErrorMessage, listEmployeeAccountCandidates, provisionEmployeeAccount, type EmployeeAccountCandidate } from '../services/api';
import { filterAccountCandidates } from '../utils/employeeAccountCandidates';

const PAGE_SIZE = 10;

export default function EmployeeAccountProvisioning() {
  const { t } = useLanguage();
  const [candidates, setCandidates] = useState<EmployeeAccountCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const { error, message, setError, setMessage } = useAutoDismissFeedback();
  const request = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  const mounted = useRef(false);
  const filtered = useMemo(() => filterAccountCandidates(candidates, query), [candidates, query]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const rows = filtered.slice(start, start + PAGE_SIZE);

  async function reload() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setLoadError('');
    try {
      const items = await listEmployeeAccountCandidates(controller.signal);
      if (!mounted.current || controller.signal.aborted) return;
      setCandidates(items);
    } catch (cause) {
      if (!mounted.current || controller.signal.aborted) return;
      setCandidates([]);
      setLoadError(getApiErrorMessage(cause, t('Could not load profiles without an account.')));
    } finally {
      if (mounted.current && !controller.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => { mounted.current = false; request.current?.abort(); };
  }, []);

  useEffect(() => { setPage(value => Math.min(value, totalPages)); }, [totalPages]);

  async function provision(candidate: EmployeeAccountCandidate) {
    if (submitting.current || loading) return;
    submitting.current = true;
    setBusyId(candidate.id);
    setError(''); setMessage('');
    try {
      const result = await provisionEmployeeAccount(candidate.id);
      if (!mounted.current) return;
      setCandidates(items => items.filter(item => item.id !== candidate.id));
      if (result.emailDelivery === 'FAILED') {
        setError(t('The IN_PROCESS account was created, but email delivery failed. Do not provision it again; check the email service.'));
      } else {
        setMessage(t('Account provisioned for {name}. The activation invitation was sent.', { name: candidate.fullName }));
      }
    } catch (cause) {
      if (!mounted.current) return;
      if (cause instanceof ApiError && cause.status === 409) await reload();
      setError(getApiErrorMessage(cause, t('Could not provision the employee account.')));
    } finally {
      submitting.current = false;
      if (mounted.current) setBusyId(null);
    }
  }

  return <AppShell breadcrumb={['Users Management', 'Employee account provisioning']}>
    <SectionHeader title="Employee account provisioning" description="Review employee profiles without a login account and send an activation invitation." />
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><Users aria-hidden="true" className="size-5 text-orange-600" />{t('Profiles awaiting an account')}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{t('Profiles with an existing account, including accounts awaiting activation, do not appear here.')}</p>
        </div>
        <div className="flex items-center gap-3">
          {!loading && !loadError && <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">{t('{count} awaiting accounts', { count: candidates.length })}</span>}
          <Button type="button" variant="outline" className="h-10 gap-2 rounded-full" disabled={loading || busyId !== null} onClick={() => void reload()}>
            <RefreshCw aria-hidden="true" className={`size-4 ${loading ? 'motion-safe:animate-spin' : ''}`} />{t('Reload')}
          </Button>
        </div>
      </div>

      <form role="search" className="my-5 flex flex-col gap-3 sm:flex-row" onSubmit={event => { event.preventDefault(); setQuery(searchInput.trim()); setPage(1); }}>
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">{t('Search by employee code, name or email')}</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-600" />
          <input type="search" value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder={t('Search by employee code, name or email')} className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />
        </label>
        <Button type="submit" variant="outline" className="h-11 rounded-full border-orange-700 bg-orange-700 px-5 text-white hover:border-orange-800 hover:bg-orange-800 hover:text-white" disabled={loading || busyId !== null || Boolean(loadError)}>{t('Search')}</Button>
      </form>

      {error && <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{t(error)}</p>}
      {message && <p role="status" className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{t(message)}</p>}
      <div aria-busy={loading}>
        {loading ? <p role="status" className="py-12 text-center text-sm text-slate-600">{t('Loading profiles...')}</p>
          : loadError ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{t(loadError)}</p>
          : !rows.length ? <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-200 px-5 py-12 text-center">
            <KeyRound aria-hidden="true" className="size-8 text-slate-600" />
            <h3 className="font-semibold text-slate-900">{t(query ? 'No profiles match your search.' : 'No profiles are awaiting an account.')}</h3>
            <p className="max-w-lg text-sm leading-6 text-slate-600">{t(query ? 'Try another employee code, name or email.' : 'Employee profiles created by HR will appear here if they do not already have an account.')}</p>
            {query && <Button type="button" variant="outline" className="rounded-full" onClick={() => { setQuery(''); setSearchInput(''); setPage(1); }}>{t('Clear search')}</Button>}
          </div>
          : <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[740px] text-left text-sm">
              <caption className="sr-only">{t('Profiles awaiting an account')}</caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600"><tr>
                <th scope="col" className="px-4 py-3 font-medium">{t('Employee code')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('Full name')}</th>
                <th scope="col" className="px-4 py-3 font-medium">Email</th>
                <th scope="col" className="px-4 py-3 font-medium">{t('Status')}</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">{t('Actions')}</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">{rows.map(candidate => <tr key={candidate.id} className="transition-colors hover:bg-slate-50/70">
                <td className="px-4 py-4 font-medium text-slate-900">{candidate.employeeCode}</td>
                <td className="px-4 py-4 font-semibold text-slate-900">{candidate.fullName}</td>
                <td className="max-w-xs px-4 py-4 text-slate-600 [overflow-wrap:anywhere]">{candidate.email}</td>
                <td className="px-4 py-4"><span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"><span aria-hidden="true" className="size-1.5 rounded-full bg-amber-500" />{t('Awaiting account')}</span></td>
                <td className="px-4 py-4 text-right"><Button type="button" size="sm" variant="outline" className="h-11 gap-2 rounded-full border-orange-700 bg-orange-700 px-4 text-white hover:border-orange-800 hover:bg-orange-800 hover:text-white" disabled={busyId !== null} aria-label={t('Provision an account for {name}', { name: candidate.fullName })} onClick={() => void provision(candidate)}>
                  <KeyRound aria-hidden="true" className="size-4" />{t(busyId === candidate.id ? 'Provisioning...' : 'Provision account')}
                </Button></td>
              </tr>)}</tbody>
            </table>
          </div>}
      </div>
      {!loading && !loadError && filtered.length > 0 && <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="text-sm text-slate-600">{t('Showing {from}–{to} of {total} profiles', { from: start + 1, to: start + rows.length, total: filtered.length })}</p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" className="rounded-full" disabled={currentPage <= 1 || busyId !== null} onClick={() => setPage(value => Math.max(1, value - 1))}>{t('Previous')}</Button>
          <span className="px-1 text-sm tabular-nums text-slate-600">{currentPage} / {totalPages}</span>
          <Button type="button" variant="outline" className="rounded-full" disabled={currentPage >= totalPages || busyId !== null} onClick={() => setPage(value => value + 1)}>{t('Next')}</Button>
        </div>
      </div>}
    </Card>
  </AppShell>;
}
