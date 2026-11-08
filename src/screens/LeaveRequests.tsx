import { useAutoDismissState } from '../hooks/useAutoDismissState';
import { useEffect, useState, type FormEvent } from 'react';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { cancelLeaveRequest, createLeaveRequest, getApiErrorMessage, getLeaveHistory, listLeaveRequests, reviewLeaveRequest, type LeaveRequest } from '../services/api';
import { leaveStatusDescription } from '../utils/leaveStatus';

const field = 'mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const labels: Record<string,string> = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', CANCEL_REQUESTED: 'Chờ duyệt hủy', CANCELLED: 'Đã hủy', CANCEL_REJECTED: 'Từ chối hủy' };

export default function LeaveRequests({ own }: {own: boolean}) {
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [ownIds, setOwnIds] = useState<number[]>([]);
  const [form, setForm] = useState({ fromDate: '', toDate: '', reason: '' });
  const [history, setHistory] = useState<LeaveRequest | null>(null);
  const [error, setError] = useAutoDismissState();
  const [notice, setNotice] = useAutoDismissState();
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
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
    {history && <Card className="mb-5 p-5"><div className="flex justify-between"><h2 className="font-bold">Lịch sử đơn nghỉ phép</h2><Button variant="secondary" onClick={() => setHistory(null)}>Đóng</Button></div>{history.histories.length ? history.histories.map(item => <p key={item.id} className="mt-3 text-sm">{item.createdAt} · {labels[item.fromStatus || ''] || item.fromStatus || '—'} → {labels[item.toStatus] || item.toStatus} · {item.actorName || '—'} {item.note && `· ${item.note}`}</p>) : <p className="mt-3 text-sm">Chưa có lịch sử.</p>}</Card>}
    <Card className="p-5"><div className="flex justify-between"><h2 className="font-bold">Danh sách đơn</h2><Button variant="secondary" disabled={busy} onClick={() => setReload(value => value + 1)}>Tải lại</Button></div><div className="mt-4 space-y-3">{rows.map(row => <article key={row.id} className="rounded-xl border border-slate-200 p-4"><p className="font-semibold">{row.fullName || row.employeeCode || 'Đơn nghỉ phép'} · {row.fromDate} – {row.toDate}</p><p className="mt-1 text-sm">{row.reason}</p><p className="mt-1 text-sm text-slate-600">Trạng thái yêu cầu: {labels[row.status] || row.status} · Trạng thái đơn nghỉ gốc: {labels[row.effectiveStatus || ''] || row.effectiveStatus || '—'}</p>{leaveStatusDescription(row.status, row.effectiveStatus) && <p className="mt-2 text-sm text-slate-600">{leaveStatusDescription(row.status, row.effectiveStatus)}</p>}<div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => void getLeaveHistory(row.id).then(r => setHistory(r.data)).catch(e => setError(getApiErrorMessage(e, 'Không tải được lịch sử.')))}>Lịch sử</Button>{own && row.fromDate > today() && ['PENDING','APPROVED','CANCEL_REJECTED'].includes(row.status) && ['PENDING','APPROVED'].includes(row.effectiveStatus || '') && <Button size="sm" variant="secondary" disabled={busy} onClick={() => cancel(row)}>Yêu cầu hủy</Button>}{!own && !ownIds.includes(row.id) && (row.status === 'PENDING' || row.status === 'CANCEL_REQUESTED' || (row.status === 'CANCEL_REJECTED' && row.effectiveStatus === 'PENDING')) && <><Button size="sm" disabled={busy} onClick={() => review(row,'APPROVED')}>{row.status === 'CANCEL_REQUESTED' ? 'Duyệt hủy' : 'Duyệt đơn'}</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => review(row,'REJECTED')}>{row.status === 'CANCEL_REQUESTED' ? 'Từ chối hủy' : 'Từ chối đơn'}</Button></>}</div></article>)}{!rows.length && !error && <p className="text-sm text-slate-500">Chưa có đơn nghỉ phép.</p>}</div></Card>
  </AppShell>;
}
