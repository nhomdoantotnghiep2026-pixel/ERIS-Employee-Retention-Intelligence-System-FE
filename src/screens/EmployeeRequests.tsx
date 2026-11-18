import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Search, X, XCircle } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader, StatusBadge } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { useRole } from '../context/RoleContext';
import { useAutoDismissFeedback } from '../hooks/useAutoDismissState';
import type { WorkflowRequest } from '../services/employeeWorkflow';
import { recordAudit } from '../workflows/audit';
import { listEmployeeRequests, REQUESTS_EVENT, reviewEmployeeRequest } from '../workflows/employeeRequests';

type RequestFilter = 'All' | WorkflowRequest['status'];

export default function EmployeeRequests() {
  const { t } = useLanguage();
  const { user } = useRole();
  const [requests, setRequests] = useState<WorkflowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestFilter>('All');
  const [decision, setDecision] = useState<{
    request: WorkflowRequest;
    status: 'Approved' | 'Rejected';
  } | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const { error, message, setError, setMessage } = useAutoDismissFeedback();

  const loadRequests = async () => {
    setLoading(true);
    setError('');
    try {
      setRequests(await listEmployeeRequests());
    } catch {
      setError('Kh�ng th? d?c l?ch s? y�u c?u da luu trong phi�n demo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const refresh = () => void loadRequests();
    refresh();
    window.addEventListener(REQUESTS_EVENT, refresh);
    return () => window.removeEventListener(REQUESTS_EVENT, refresh);
  }, []);

  const closeDecision = () => {
    setDecision(null);
    setNote('');
  };

  useEffect(() => {
    if (!decision) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) closeDecision();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [decision, saving]);

  const counts = useMemo(() => ({
    All: requests.length,
    Pending: requests.filter(item => item.status === 'Pending').length,
    Approved: requests.filter(item => item.status === 'Approved').length,
    Rejected: requests.filter(item => item.status === 'Rejected').length,
  }), [requests]);

  const visibleRequests = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return requests.filter(request => {
      const matchesStatus = statusFilter === 'All' || request.status === statusFilter;
      const matchesSearch = !query || [
        request.employee_name,
        request.employee_email,
        request.request_type,
        request.detail,
      ].some(value => value.toLocaleLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [requests, searchQuery, statusFilter]);

  const openDecision = (request: WorkflowRequest, status: 'Approved' | 'Rejected') => {
    setDecision({ request, status });
    setNote('');
    setError('');
  };

  const review = async () => {
    if (!decision || saving) return;
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const updated = await reviewEmployeeRequest(decision.request.id, decision.status, user.email, note);
      recordAudit('employee_request', updated.id, 'Review request: ' + updated.status, decision.request, updated);
      setRequests(current => current.map(item => item.id === updated.id ? updated : item));
      setMessage('Decision saved for ' + updated.employee_name + '. The employee can view it in Requests & Approvals.');
      closeDecision();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update request.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell breadcrumb={['Workforce', 'Employee Requests']}>
      <SectionHeader
        title={t('Employee Requests')}
        description={t('Review employee requests, add feedback, then confirm your decision. Employees see the result in their request history. Shared demo records stay in this tab.')}
      />

      {message && <p role="status" className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{t(message)}</p>}
      {error && <p role="alert" className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">{t(error)}</p>}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-orange-50 text-orange-600"><ClipboardList size={20} /></span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-950">{t('Approval queue')}</h2>
              <p className="mt-0.5 text-sm font-medium text-slate-600">{t('HR review is recorded with reviewer and timestamp.')}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-sm">
              <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                aria-label={t('Search')}
                placeholder={t('Search')}
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
              />
            </div>

            <div className="flex max-w-full gap-1 overflow-x-auto rounded-md bg-slate-100 p-1" role="tablist" aria-label={t('Status')}>
              {(['All', 'Pending', 'Approved', 'Rejected'] as const).map(status => (
                <button
                  key={status}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === status}
                  onClick={() => setStatusFilter(status)}
                  className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 ${statusFilter === status ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  {t(status === 'All' ? 'All statuses' : status)}
                  <span className="text-xs tabular-nums text-slate-500">{counts[status]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-slate-100" aria-label={t('Loading requests...')}>
            {[0, 1, 2].map(item => (
              <div key={item} className="animate-pulse px-5 py-5 sm:px-6">
                <div className="h-4 w-44 rounded bg-slate-200" />
                <div className="mt-3 h-3 w-72 max-w-full rounded bg-slate-100" />
                <div className="mt-4 h-10 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : visibleRequests.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-md bg-slate-100 text-slate-500"><ClipboardList size={23} /></span>
            <p className="mt-4 text-sm font-semibold text-slate-800">{t('No requests yet. Complete the form to get started.')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {visibleRequests.map(request => (
              <article key={request.id} className="px-5 py-5 sm:px-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-semibold text-slate-950">{request.employee_name}</h3>
                      <StatusBadge status={request.status} />
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-600">{request.employee_email}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-semibold text-slate-700">
                      <span>{t(request.request_type)}</span>
                      <span className="text-slate-300" aria-hidden="true">•</span>
                      <span>{t(request.requested_date)}</span>
                    </div>

                    <p className="mt-3 max-w-4xl whitespace-pre-wrap text-sm font-medium leading-6 text-slate-700">{request.detail}</p>

                    {request.reviewer_note && (
                      <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('HR:')}</p>
                        <p className="mt-1 text-sm text-slate-700">{request.reviewer_note}</p>
                      </div>
                    )}

                    {request.status !== 'Pending' && (
                      <p className="mt-3 text-xs font-medium text-slate-500">{request.reviewer_email || '-'}</p>
                    )}
                  </div>

                  {request.status === 'Pending' && (
                    <div className="flex shrink-0 gap-2 lg:justify-end">
                      <Button size="sm" onClick={() => openDecision(request, 'Approved')}><CheckCircle2 size={15} />{t('Approve')}</Button>
                      <Button size="sm" variant="secondary" onClick={() => openDecision(request, 'Rejected')}><XCircle size={15} />{t('Reject')}</Button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

      {decision && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="request-decision-title"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !saving) closeDecision();
          }}
        >
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <h2 id="request-decision-title" className="text-lg font-semibold text-slate-950">
                  {t('Confirm')} {t(decision.status === 'Approved' ? 'approval' : 'rejection')}
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-600">{decision.request.employee_name} · {t(decision.request.request_type)}</p>
              </div>
              <button
                type="button"
                aria-label={t('Close')}
                disabled={saving}
                onClick={closeDecision}
                className="flex size-10 shrink-0 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-50"
              ><X size={20} /></button>
            </header>

            <div className="overflow-y-auto p-5 sm:p-6">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-slate-700">
                  <span>{t(decision.request.request_type)}</span>
                  <span>{t(decision.request.requested_date)}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{decision.request.detail}</p>
              </div>

              <label className="mt-5 block text-sm font-semibold text-slate-700">
                {t('Feedback for employee')}{' '}
                <span className="font-medium text-slate-600">{t(decision.status === 'Rejected' ? '(required)' : '(optional)')}</span>
                <textarea
                  autoFocus
                  rows={4}
                  value={note}
                  onChange={event => setNote(event.target.value)}
                  className="mt-2 w-full resize-y rounded-md border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                />
              </label>
            </div>

            <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
              <Button type="button" variant="secondary" disabled={saving} onClick={closeDecision}>{t('Cancel')}</Button>
              <Button disabled={saving || (decision.status === 'Rejected' && !note.trim())} onClick={() => void review()}>{t(saving ? 'Saving...' : 'Confirm decision')}</Button>
            </footer>
          </div>
        </div>
      )}
    </AppShell>
  );
}
