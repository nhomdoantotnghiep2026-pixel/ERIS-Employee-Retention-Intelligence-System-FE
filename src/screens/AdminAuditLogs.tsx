import { useEffect, useRef, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { listAuditLogs, getAuditLog, getApiErrorMessage, type AuditLogEntry, type AuditLogDetail } from '../services/api';
import { downloadTextFile, toCsv } from '../utils/demoActions';
import { auditDateMatches } from '../utils/auditDateFilter';

const actionLabels: Record<string, string> = { CREATE: 'Create', UPDATE: 'Update', SOFT_DELETE: 'Deactivate', DELETE: 'Delete' };
const entityLabels: Record<string, string> = { employees: 'Employees', departments: 'Departments', positions: 'Positions', employee_educations: 'Employee education', employee_work_experiences: 'Employee work experience', surveys: 'Surveys', work_schedules: 'Work schedules', employee_schedule_assignments: 'Employee schedule assignments' };

export default function AdminAuditLogs() {
  const { t, language } = useLanguage();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AuditLogDetail | null>(null);
  const [detailError, setDetailError] = useState('');
  const [detailRevision, setDetailRevision] = useState(0);
  const detailRegion = useRef<HTMLElement>(null);
  const detailTrigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (selectedId !== null) {
      detailRegion.current?.scrollIntoView({ block: 'start' });
      detailRegion.current?.focus({ preventScroll: true });
    }
  }, [selectedId]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setEntries([]); setSelectedId(null);
    void listAuditLogs(controller.signal)
      .then(result => { if (!controller.signal.aborted) setEntries(result.data); })
      .catch(cause => { if (!controller.signal.aborted) setError(getApiErrorMessage(cause, 'Could not load audit logs.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    const controller = new AbortController();
    setDetail(null); setDetailError('');
    if (selectedId !== null) void getAuditLog(selectedId, controller.signal)
      .then(result => { if (!controller.signal.aborted) setDetail(result.data); })
      .catch(cause => { if (!controller.signal.aborted) setDetailError(getApiErrorMessage(cause, 'Could not load audit log details.')); });
    return () => controller.abort();
  }, [selectedId, detailRevision]);

  const actionLabel = (value: string | null) => t(value ? actionLabels[value] || value : '—');
  const entityLabel = (value: string | null) => t(value ? entityLabels[value.toLowerCase()] || value : '—');
  const invalidDateRange = !!fromDate && !!toDate && fromDate > toDate;
  const visible = entries.filter(entry => auditDateMatches(entry.createdAt, fromDate, toDate) && [entry.id, entry.userId, entry.action, entry.entityType, entry.entityId, entry.actor?.fullName, entry.actor?.email, actionLabel(entry.action), entityLabel(entry.entityType)].join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const formatTime = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
  };
  const actorName = (entry: AuditLogEntry) => entry.actor?.fullName || entry.actor?.email || (entry.userId === null ? t('System') : `${t('User')} #${entry.userId}`);

  function exportLogs() {
    downloadTextFile('audit-log.csv', toCsv(visible.map(entry => ({ id: entry.id, createdAt: entry.createdAt, userId: entry.userId, fullName: entry.actor?.fullName ?? '', email: entry.actor?.email ?? '', action: entry.action, entityType: entry.entityType, entityId: entry.entityId }))), 'text/csv;charset=utf-8');
  }

  return <AppShell breadcrumb={['System', 'Activity']}>
    <SectionHeader title={t('System audit logs')} description={t('Review recorded system actions from the server. Open an entry to view its before and after values.')}>
      <Button variant="secondary" disabled={loading || !!error || invalidDateRange || !visible.length} onClick={exportLogs}>{t('Export displayed logs')}</Button>
    </SectionHeader>
    <Card className="p-5">
      <div className="mb-2 grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_11rem_11rem_auto]">
        <label className="block text-sm text-slate-600 sm:col-span-2 xl:col-span-1">{t('Search action, user or record')}
          <input className="mt-2 block w-full rounded-xl border border-slate-300 p-3" value={search} onChange={event => setSearch(event.target.value)} />
        </label>
        <label className="block text-sm text-slate-600">{t('From date')}
          <input type="date" max={toDate || undefined} aria-invalid={invalidDateRange} className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3" value={fromDate} onChange={event => { setFromDate(event.target.value); setSelectedId(null); }} />
        </label>
        <label className="block text-sm text-slate-600">{t('To date')}
          <input type="date" min={fromDate || undefined} aria-invalid={invalidDateRange} className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3" value={toDate} onChange={event => { setToDate(event.target.value); setSelectedId(null); }} />
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-1">
          {(fromDate || toDate) && <Button variant="secondary" onClick={() => { setFromDate(''); setToDate(''); setSelectedId(null); }}>{t('Clear date filter')}</Button>}
          <Button variant="secondary" disabled={loading} onClick={() => setRevision(value => value + 1)}>{t('Refresh')}</Button>
        </div>
      </div>
      <p className="mb-4 text-xs text-slate-500">{t('Dates use Vietnam time (UTC+7), including the entire end date.')}</p>
      {loading ? <p role="status" className="py-8 text-center text-sm text-slate-500">{t('Loading audit logs...')}</p>
        : error ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700"><p>{t(error)}</p><Button variant="secondary" className="mt-3" onClick={() => setRevision(value => value + 1)}>{t('Retry')}</Button></div>
        : invalidDateRange ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{t('The end date must be on or after the start date.')}</p>
        : !visible.length ? <p className="py-8 text-center text-sm text-slate-500">{t(entries.length ? 'No audit logs match these filters.' : 'No audit logs have been recorded.')}</p>
        : <><p className="mb-3 text-sm text-slate-500">{t('Showing {count} audit logs', { count: visible.length })}</p>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead><tr className="border-b text-slate-500">{['Time', 'User', 'Action', 'Entity', 'Details'].map(label => <th className="p-3" key={label}>{t(label)}</th>)}</tr></thead>
            <tbody>{visible.map(entry => <tr key={entry.id} className="border-b border-slate-100 align-top">
              <td className="whitespace-nowrap p-3">{formatTime(entry.createdAt)}</td>
              <td className="p-3"><p>{actorName(entry)}</p>{entry.actor?.email && entry.actor.fullName && <p className="mt-1 text-xs text-slate-500">{entry.actor.email}</p>}</td>
              <td className="p-3">{actionLabel(entry.action)}</td><td className="p-3">{entityLabel(entry.entityType)}{entry.entityId !== null && <span className="ml-1 text-slate-500">#{entry.entityId}</span>}</td>
              <td className="p-3"><Button size="sm" variant="secondary" aria-expanded={selectedId === entry.id} onClick={event => { detailTrigger.current = event.currentTarget; setDetail(null); setDetailError(''); setSelectedId(value => value === entry.id ? null : entry.id); }}>{t('View details')} #{entry.id}</Button></td>
            </tr>)}</tbody>
          </table></div></>}
    </Card>
    {selectedId !== null && <section ref={detailRegion} tabIndex={-1} role="region" aria-label={t('Audit log details')} className="scroll-mt-5 outline-none"><Card className="mt-5 p-5">
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-bold">{t('Audit log details')} #{selectedId}</h2><Button variant="secondary" onClick={() => { setSelectedId(null); detailTrigger.current?.focus(); }}>{t('Close')}</Button></div>
      {detailError ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700"><p>{t(detailError)}</p><Button variant="secondary" className="mt-3" onClick={() => setDetailRevision(value => value + 1)}>{t('Retry')}</Button></div>
        : !detail ? <p role="status" className="text-sm text-slate-500">{t('Loading audit log details...')}</p>
        : <><p className="mb-4 text-sm text-slate-600">{formatTime(detail.createdAt)} · {actorName(detail)} · {actionLabel(detail.action)} · {entityLabel(detail.entityType)} #{detail.entityId ?? '—'}</p>
          <div className="grid gap-4 lg:grid-cols-2">{[['Before change', detail.oldValue], ['After change', detail.newValue]].map(([label, value]) => <section key={String(label)} className="min-w-0"><h3 className="mb-2 text-sm font-semibold">{t(String(label))}</h3>{value == null ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{t('No recorded value')}</p> : <pre className="max-h-96 overflow-auto rounded-xl bg-slate-50 p-4 text-xs">{JSON.stringify(value, null, 2)}</pre>}</section>)}</div>
        </>}
    </Card></section>}
  </AppShell>;
}
