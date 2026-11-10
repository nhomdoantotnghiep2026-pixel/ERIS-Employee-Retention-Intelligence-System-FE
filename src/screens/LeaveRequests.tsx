import { useAutoDismissState } from '../hooks/useAutoDismissState';
import { useEffect, useState, type FormEvent } from 'react';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { CalendarDays, History as HistoryIcon, RefreshCw, Search, SlidersHorizontal, UserRound, X } from 'lucide-react';
import { cancelLeaveRequest, createLeaveRequest, getApiErrorMessage, getLeaveHistory, listLeaveRequests, reviewLeaveRequest, type LeaveRequest } from '../services/api';
import { leaveStatusDescription } from '../utils/leaveStatus';
import { filterLeaveRequests, type LeavePeriodFilter } from '../utils/leaveRequestFilters';

const field = 'mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const labels: Record<string,string> = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', CANCEL_REQUESTED: 'Chờ duyệt hủy', CANCELLED: 'Đã hủy', CANCEL_REJECTED: 'Từ chối hủy' };

function isLeavePeriodFilter(value: string): value is LeavePeriodFilter {
  return value === 'ALL' || value === 'PAST' || value === 'CURRENT' || value === 'UPCOMING';
}

function formatLeaveDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value || '—';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date);
}

function statusTone(status: string | null | undefined) {
  switch (status) {
    case 'APPROVED': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'PENDING':
    case 'CANCEL_REQUESTED': return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'REJECTED':
    case 'CANCEL_REJECTED': return 'border-red-200 bg-red-50 text-red-700';
    case 'CANCELLED': return 'border-slate-200 bg-slate-100 text-slate-600';
    default: return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

function StatusPill({ status }: { status: string | null | undefined }) {
  const value = status ? labels[status] || status : '—';
  return <span className={`inline-flex max-w-full items-center rounded-full border px-3 py-1 text-xs font-semibold leading-5 ${statusTone(status)}`}>{value}</span>;
}

function formatHistoryTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '—';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
}

export default function LeaveRequests({ own }: {own: boolean}) {
  const { t } = useLanguage();
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [ownIds, setOwnIds] = useState<number[]>([]);
  const [form, setForm] = useState({ fromDate: '', toDate: '', reason: '' });
  const [history, setHistory] = useState<LeaveRequest | null>(null);
  const [error, setError] = useAutoDismissState();
  const [notice, setNotice] = useAutoDismissState();
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [periodFilter, setPeriodFilter] = useState<LeavePeriodFilter>('ALL');
  const [requestStatusFilter, setRequestStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const currentDate = today();
  const requestStatuses = [...new Set(rows.map(row => row.status))].sort((a, b) => (labels[a] || a).localeCompare(labels[b] || b, 'vi'));
  const filteredRows = filterLeaveRequests(rows, {
    period: periodFilter,
    requestStatus: requestStatusFilter,
    search,
  }, currentDate);
  const hasActiveFilters = periodFilter !== 'ALL' || requestStatusFilter !== 'ALL' || !!search.trim();
  useEffect(() => {
    const controller = new AbortController(); setError('');
    void Promise.all([listLeaveRequests(own, controller.signal), own ? Promise.resolve(null) : listLeaveRequests(true, controller.signal)])
      .then(([all, mine]) => { setRows(all.data); setOwnIds(mine?.data.map(row => row.id) || []); })
      .catch(cause => { if (!controller.signal.aborted) setError(getApiErrorMessage(cause, 'Không tải được đơn nghỉ phép.')); });
    return () => controller.abort();
  }, [own, reload]);
  async function run(action: () => Promise<unknown>, success: string) {
    if (busy) return; setBusy(true); setError(''); setNotice('');
    try { await action(); setNotice(success); setReload(value => value + 1); }
    catch (cause) { setError(getApiErrorMessage(cause, 'Không thực hiện được thao tác.')); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent) {
    event.preventDefault(); if (!form.reason.trim() || form.fromDate <= today() || form.toDate < form.fromDate) { setError('Vui lòng chọn ngày bắt đầu sau hôm nay, ngày kết thúc hợp lệ và nhập lý do.'); return; }
    const first = new Date(`${form.fromDate}T00:00:00Z`); const last = new Date(`${form.toDate}T00:00:00Z`);
    const days = Math.floor((last.getTime() - first.getTime()) / 86400000) + 1;
    if (days > 30 || !Array.from({length: Math.min(days, 30)}, (_, index) => (first.getUTCDay() + index) % 7).some(day => day > 0 && day < 6)) { setError('Khoảng nghỉ tối đa 30 ngày và phải có ít nhất một ngày làm việc.'); return; }
    void run(async () => { await createLeaveRequest({ ...form, reason: form.reason.trim() }); setForm({ fromDate: '', toDate: '', reason: '' }); }, 'Đã gửi đơn nghỉ phép.');
  }
  function review(row: LeaveRequest, decision: 'APPROVED' | 'REJECTED') {
    const note = window.prompt('Ghi chú duyệt hoặc từ chối (không bắt buộc):', ''); if (note === null) return;
    if (note.trim().length > 500) { setError('Ghi chú tối đa 500 ký tự.'); return; }
    void run(() => reviewLeaveRequest(row.id, decision, note.trim(), row.status === 'CANCEL_REQUESTED'), 'Đã xử lý yêu cầu.');
  }
  function cancel(row: LeaveRequest) {
    const reason = window.prompt('Nhập lý do yêu cầu hủy đơn:'); if (reason === null) return;
    if (!reason.trim() || reason.trim().length > 500) { setError('Lý do hủy bắt buộc và tối đa 500 ký tự.'); return; }
    void run(() => cancelLeaveRequest(row.id, reason.trim()), 'Đã gửi yêu cầu hủy.');
  }
  return <AppShell breadcrumb={['Workforce', own ? 'My requests' : 'Employee requests']}>
    <SectionHeader title={own ? 'Đơn nghỉ phép của tôi' : 'Đơn nghỉ phép nhân viên'} description="Xem và xử lý đơn nghỉ phép từ hệ thống." />
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</p>}
    {own && <Card className="mb-5 p-5"><h2 className="font-bold">Gửi đơn nghỉ phép</h2><form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2"><label>Từ ngày<input required type="date" className={field} value={form.fromDate} onChange={e => setForm({...form, fromDate:e.target.value})}/></label><label>Đến ngày<input required type="date" min={form.fromDate} className={field} value={form.toDate} onChange={e => setForm({...form, toDate:e.target.value})}/></label><label className="sm:col-span-2">Lý do<textarea required maxLength={500} className={field} value={form.reason} onChange={e => setForm({...form, reason:e.target.value})}/></label><div><Button disabled={busy}>Gửi đơn</Button></div></form></Card>}
    {history && <Card className="mb-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="font-bold text-slate-900">Lịch sử đơn nghỉ phép</h2>
          <p className="mt-1 text-sm text-slate-500">{history.fullName || history.employeeCode || 'Đơn nghỉ phép'} · {history.fromDate} – {history.toDate}</p>
        </div>
        <Button variant="secondary" onClick={() => setHistory(null)}>Đóng</Button>
      </div>
      {history.histories.length ? <ol className="mt-5 space-y-3">
        {history.histories.map(item => <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
              {item.fromStatus && <><span className="rounded-full bg-white px-3 py-1 text-slate-600 ring-1 ring-slate-200">{labels[item.fromStatus] || item.fromStatus}</span><span aria-hidden="true" className="text-slate-400">→</span></>}
              <span className="rounded-full bg-orange-50 px-3 py-1 text-orange-700 ring-1 ring-orange-100">{labels[item.toStatus] || item.toStatus}</span>
            </div>
            <time className="text-sm text-slate-500" dateTime={item.createdAt}>{formatHistoryTime(item.createdAt)}</time>
          </div>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Người thực hiện</dt><dd className="mt-1 font-medium text-slate-800">{item.actorName || '—'}{item.actorRole && <span className="ml-2 font-normal text-slate-500">({item.actorRole})</span>}</dd></div>
            <div><dt className="text-slate-500">Ghi chú</dt><dd className="mt-1 whitespace-pre-wrap break-words text-slate-800">{item.note || 'Không có ghi chú'}</dd></div>
          </dl>
        </li>)}
      </ol> : <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Chưa có lịch sử.</p>}
    </Card>}
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <h2 className="font-bold text-slate-900">Danh sách đơn</h2>
        <Button variant="secondary" disabled={busy} onClick={() => setReload(value => value + 1)}><RefreshCw size={15}/><span>Tải lại</span></Button>
      </div>
      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><SlidersHorizontal size={16} className="text-orange-600"/>{t('Filter leave requests')}</div>
          {hasActiveFilters && <button type="button" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-orange-700 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-orange-500" onClick={() => { setPeriodFilter('ALL'); setRequestStatusFilter('ALL'); setSearch(''); }}><X size={14}/>{t('Clear filters')}</button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,0.9fr)_minmax(12rem,0.9fr)_minmax(18rem,1.5fr)]">
          <label className="block min-w-0 text-xs font-semibold text-slate-600">{t('Leave period')}
            <select value={periodFilter} onChange={event => { if (isLeavePeriodFilter(event.target.value)) setPeriodFilter(event.target.value); }} className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100">
              <option value="ALL">{t('All periods')}</option>
              <option value="PAST">{t('Past')}</option>
              <option value="CURRENT">{t('Currently on leave')}</option>
              <option value="UPCOMING">{t('Upcoming')}</option>
            </select>
          </label>
          <label className="block min-w-0 text-xs font-semibold text-slate-600">{t('Request status')}
            <select value={requestStatusFilter} onChange={event => setRequestStatusFilter(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100">
              <option value="ALL">{t('All statuses')}</option>
              {requestStatuses.map(status => <option key={status} value={status}>{labels[status] || status}</option>)}
            </select>
          </label>
          <label className="block min-w-0 text-xs font-semibold text-slate-600 sm:col-span-2 xl:col-span-1">{t('Search requests')}
            <span className="relative mt-1.5 block">
              <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('Search by employee or reason')} className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm font-normal text-slate-700 outline-none placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"/>
            </span>
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">{t('Showing {visible} of {total} requests', { visible: filteredRows.length, total: rows.length })}</p>
      </div>
      <div className="mt-4 space-y-3">
        {filteredRows.map(row => {
          const description = leaveStatusDescription(row.status, row.effectiveStatus);
          const canCancel = own && row.fromDate > today() && ['PENDING','APPROVED','CANCEL_REJECTED'].includes(row.status) && ['PENDING','APPROVED'].includes(row.effectiveStatus || '');
          const canReview = !own && !ownIds.includes(row.id) && (row.status === 'PENDING' || row.status === 'CANCEL_REQUESTED' || (row.status === 'CANCEL_REJECTED' && row.effectiveStatus === 'PENDING'));
          return <article key={row.id} className="grid min-w-0 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/[0.03] transition-colors hover:border-slate-300 sm:p-5 md:grid-cols-2 lg:grid-cols-[minmax(0,1.45fr)_minmax(10rem,0.9fr)_minmax(12rem,1.1fr)_minmax(8rem,auto)] lg:items-center lg:gap-x-5">
            <section className="flex min-w-0 gap-3" aria-label="Thông tin nhân viên và lý do">
              <span aria-hidden="true" className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-600"><UserRound size={19}/></span>
              <div className="min-w-0">
                <p className="break-words text-base font-semibold leading-6 text-slate-900">{row.fullName || row.employeeCode || 'Đơn nghỉ phép'}</p>
                {row.employeeCode && row.fullName && <p className="mt-0.5 break-words text-xs text-slate-500">{row.employeeCode}</p>}
                <div className="mt-2">
                  <p className="text-xs font-medium text-slate-500">Lý do nghỉ phép</p>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-5 text-slate-700">{row.reason}</p>
                </div>
              </div>
            </section>

            <section className="min-w-0 border-t border-slate-100 pt-3 md:border-t-0 md:pt-0 lg:border-l lg:border-t-0 lg:pl-5" aria-label="Thời gian nghỉ">
              <p className="text-xs font-medium text-slate-500">Thời gian nghỉ</p>
              <div className="mt-1.5 flex min-w-0 items-start gap-2 text-sm font-semibold leading-5 text-slate-800">
                <CalendarDays size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-slate-400"/>
                <p className="min-w-0 break-words">{formatLeaveDate(row.fromDate)} <span className="text-slate-400">–</span> {formatLeaveDate(row.toDate)}</p>
              </div>
            </section>

            <section className="min-w-0 border-t border-slate-100 pt-3 md:col-span-1 md:border-t-0 md:pt-0 lg:border-l lg:pl-5" aria-label="Trạng thái đơn">
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="min-w-0">
                  <p className="mb-1.5 text-xs font-medium text-slate-500">Trạng thái yêu cầu</p>
                  <StatusPill status={row.status}/>
                </div>
                <div className="min-w-0">
                  <p className="mb-1.5 text-xs font-medium text-slate-500">Trạng thái đơn nghỉ gốc</p>
                  <StatusPill status={row.effectiveStatus}/>
                </div>
              </div>
              {description && <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">{description}</p>}
            </section>

            <div className="flex min-w-0 flex-wrap gap-2 border-t border-slate-100 pt-3 md:col-span-1 md:justify-end lg:col-span-1 lg:flex-col lg:items-stretch lg:justify-center lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
              <Button size="sm" variant="secondary" className="min-w-28" onClick={() => void getLeaveHistory(row.id).then(r => setHistory(r.data)).catch(e => setError(getApiErrorMessage(e, 'Không tải được lịch sử.')))}><HistoryIcon size={15}/><span>Lịch sử</span></Button>
              {canCancel && <Button size="sm" variant="secondary" disabled={busy} onClick={() => cancel(row)}>Yêu cầu hủy</Button>}
              {canReview && <>
                <Button size="sm" disabled={busy} onClick={() => review(row,'APPROVED')}>{row.status === 'CANCEL_REQUESTED' ? 'Duyệt hủy' : 'Duyệt đơn'}</Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => review(row,'REJECTED')}>{row.status === 'CANCEL_REQUESTED' ? 'Từ chối hủy' : 'Từ chối đơn'}</Button>
              </>}
            </div>
          </article>;
        })}
        {!rows.length && !error && <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">Chưa có đơn nghỉ phép.</p>}
        {rows.length > 0 && !filteredRows.length && <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
          <p className="text-sm text-slate-600">{t('No requests match these filters.')}</p>
          <button type="button" className="mt-2 text-sm font-semibold text-orange-700 hover:underline" onClick={() => { setPeriodFilter('ALL'); setRequestStatusFilter('ALL'); setSearch(''); }}>{t('Clear filters')}</button>
        </div>}
      </div>
    </Card>
  </AppShell>;
}
