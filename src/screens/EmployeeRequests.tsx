import { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, Clock3, XCircle } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader, StatusBadge, Td, Th } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { useRole } from '../context/RoleContext';
import type { WorkflowRequest } from '../services/employeeWorkflow';
import { listEmployeeRequests, reviewEmployeeRequest, REQUESTS_EVENT } from '../workflows/employeeRequests';
import { recordAudit } from '../workflows/audit';
import { useAutoDismissFeedback } from '../hooks/useAutoDismissState';

export default function EmployeeRequests() {
  const { t } = useLanguage();
  const { user } = useRole();
  const [requests, setRequests] = useState<WorkflowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { error, message, setError, setMessage } = useAutoDismissFeedback();
  const [decision, setDecision] = useState<{ request: WorkflowRequest; status: 'Approved' | 'Rejected' } | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const loadRequests = async () => {
    setLoading(true);
    setError('');
    try {
      setRequests(await listEmployeeRequests());
    } catch {
      setError('Không thể đọc lịch sử yêu cầu đã lưu trong phiên demo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { const refresh = () => { void loadRequests(); }; refresh(); window.addEventListener(REQUESTS_EVENT, refresh); return () => window.removeEventListener(REQUESTS_EVENT, refresh); }, []);

  const review = async () => {
    if (!decision || saving) return;
    setError(''); setMessage(''); setSaving(true);
    try {
      const updated = await reviewEmployeeRequest(decision.request.id, decision.status, user.email, note);
      recordAudit('employee_request', updated.id, 'Review request: ' + updated.status, decision.request, updated);
      setRequests(current => current.map(item => item.id === updated.id ? updated : item));
      setMessage('Decision saved for ' + updated.employee_name + '. The employee can view it in Requests & Approvals.');
      setDecision(null); setNote('');
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to update request.'); }
    finally { setSaving(false); }
  };

  const pending = requests.filter(item => item.status === 'Pending').length;
  return <AppShell breadcrumb={['Workforce', 'Employee Requests']}><SectionHeader title={t("Employee Requests")} description={t("Review employee requests, add feedback, then confirm your decision. Employees see the result in their request history. Shared demo records stay in this tab.")}/><div className="mb-5 grid gap-4 sm:grid-cols-3"><Metric icon={Clock3} label={t("Pending review")} value={pending} tone="amber"/><Metric icon={CheckCircle2} label={t("Approved")} value={requests.filter(item => item.status === 'Approved').length} tone="emerald"/><Metric icon={XCircle} label={t("Rejected")} value={requests.filter(item => item.status === 'Rejected').length} tone="red"/></div>{message && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{t(message)}</p>}{decision && <Card className="mb-5 p-5"><h2 className="font-bold text-slate-900">{t("Confirm")} {t(decision.status === 'Approved' ? 'approval' : 'rejection')} {t("request")}</h2><p className="mt-2 text-sm text-slate-600">{decision.request.employee_name} / {t(decision.request.request_type)} / {t(decision.request.requested_date)}</p><p className="mt-2 whitespace-pre-wrap text-sm">{decision.request.detail}</p><label className="mt-4 block text-sm font-semibold">{t("Feedback for employee")} {t(decision.status === 'Rejected' ? '(required)' : '(optional)')}<textarea value={note} onChange={event => setNote(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 p-3" /></label><div className="mt-3 flex gap-3"><Button disabled={saving || (decision.status === 'Rejected' && !note.trim())} onClick={() => void review()}>{t("Confirm decision")}</Button><Button variant="secondary" disabled={saving} onClick={() => setDecision(null)}>{t("Cancel")}</Button></div></Card>}<Card className="overflow-hidden p-0"><div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4"><ClipboardList size={22} className="text-orange-500"/><div><h2 className="font-bold text-slate-900">{t('Approval queue')}</h2><p className="text-sm text-slate-500">{t('HR review is recorded with reviewer and timestamp.')}</p></div></div>{error && <p role="alert" className="m-5 rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-900">{t(error)}</p>}{loading ? <p className="p-8 text-sm text-slate-500">{t('Loading requests...')}</p> : requests.length === 0 ? <p className="p-8 text-sm text-slate-500">{t("Chưa có yêu cầu. Đăng nhập Employee / ESS và gửi yêu cầu trong Requests & Approvals để thử luồng duyệt.")}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px]"><thead><tr><Th>{t("Employee")}</Th><Th>{t("Type")}</Th><Th>{t("Date")}</Th><Th>{t("Detail")}</Th><Th>{t("Status")}</Th><Th>{t("Action")}</Th></tr></thead><tbody>{requests.map(request => <tr key={request.id} className="border-t border-slate-100"><Td><div className="font-semibold text-slate-800">{request.employee_name}</div><div className="text-xs text-slate-500">{request.employee_email}</div></Td><Td>{t(request.request_type)}</Td><Td>{t(request.requested_date)}</Td><Td>{request.detail}{request.reviewer_note && <p className="mt-2 text-xs text-slate-500">{t("HR:")} {request.reviewer_note}</p>}</Td><Td><StatusBadge status={request.status} /></Td><Td>{request.status === 'Pending' ? <div className="flex gap-2"><Button size="sm" onClick={() => { setDecision({ request, status: 'Approved' }); setNote(''); setError(''); }}><CheckCircle2 size={15}/>{t('Approve')}</Button><Button size="sm" variant="secondary" onClick={() => { setDecision({ request, status: 'Rejected' }); setNote(''); setError(''); }}><XCircle size={15}/>{t('Reject')}</Button></div> : <span className="text-xs text-slate-500">{request.reviewer_email || '-'}</span>}</Td></tr>)}</tbody></table></div>}</Card></AppShell>;
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Clock3; label: string; value: number; tone: 'amber' | 'emerald' | 'red' }) {
  const { t } = useLanguage();
  const styles = { amber: 'bg-amber-50 text-amber-700', emerald: 'bg-emerald-50 text-emerald-700', red: 'bg-red-50 text-red-700' };
  return <div className={`rounded-2xl p-4 ${styles[tone]}`}><Icon size={20}/><p className="mt-3 text-xs font-bold uppercase">{t(label)}</p><p className="mt-1 text-2xl font-extrabold">{value}</p></div>;
}
