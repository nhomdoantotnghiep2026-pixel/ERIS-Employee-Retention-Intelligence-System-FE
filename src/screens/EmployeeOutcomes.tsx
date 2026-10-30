import { useLanguage } from '../context/LanguageContext';
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Button, Card, ConfirmationDialog, SectionHeader } from '../components/ui';
import { useEmployees } from '../context/EmployeeContext';
import { useWorkflow } from '../context/WorkflowContext';
import { recordAudit } from '../workflows/audit';
import { downloadTextFile, toCsv } from '../utils/demoActions';
import { useAutoDismissState } from '../hooks/useAutoDismissState';
interface Outcome { id: string; employee_id: string; prediction_result_id: string | null; observed_date: string; outcome: string; notes: string; created_at: string }
function load(): Outcome[] { try { const value = JSON.parse(sessionStorage.getItem('eris-outcomes-v1') || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
export default function EmployeeOutcomes() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { employees } = useEmployees();
  const { runs } = useWorkflow();
  const [records, setRecords] = useState(load);
  const [draft, setDraft] = useState({ employee_id: params.get('employee') || '', observed_date: '', outcome: 'Retained', notes: '' });
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useAutoDismissState();
  const latest = runs.flatMap(run => run.results).find(result => result.employee_id === draft.employee_id);
  const submit = (event: FormEvent) => { event.preventDefault(); if (!employees.some(employee => employee.id === draft.employee_id)) { setMessage('Chọn nhân viên hợp lệ.'); return; } setConfirm(true); };
  const save = () => {
    const record: Outcome = { ...draft, id: crypto.randomUUID(), prediction_result_id: latest?.id || null, notes: draft.notes.trim(), created_at: new Date().toISOString() };
    const next = [record, ...records]; sessionStorage.setItem('eris-outcomes-v1', JSON.stringify(next)); setRecords(next); setConfirm(false); setMessage('Đã lưu kết quả thực tế. Điểm dự đoán được giữ nguyên.');
    recordAudit('EMPLOYEE_OUTCOMES', record.id, 'Record observed employee outcome', null, record);
  };
  const control = 'mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm';
  return <AppShell breadcrumb={['Retention', 'Employee outcomes']}>
    <SectionHeader title={t("Ghi nhận kết quả thực tế của nhân viên")} description={t("Kết quả quan sát do HR xác nhận, tách biệt với xác suất AI. Không tự kết luận nhân viên nghỉ việc từ điểm rủi ro.")}><Button variant="secondary" onClick={() => downloadTextFile('employee-outcomes.csv', toCsv(records), 'text/csv;charset=utf-8')}>{t("Xuất kết quả")}</Button></SectionHeader>
    <Card className="mb-5 p-6"><form onSubmit={submit}><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm text-slate-600">{t("Nhân viên")}<select required className={control} value={draft.employee_id} onChange={event => setDraft({ ...draft, employee_id: event.target.value })}><option value="">{t("Chọn nhân viên")}</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.employeeId} · {employee.name}</option>)}</select></label><label className="text-sm text-slate-600">{t("Ngày quan sát")}<input required type="date" className={control} value={draft.observed_date} onChange={event => setDraft({ ...draft, observed_date: event.target.value })} /></label><label className="text-sm text-slate-600">{t("Kết quả")}<select className={control} value={draft.outcome} onChange={event => setDraft({ ...draft, outcome: event.target.value })}><option value="Retained">{t("Retained")}</option><option value="Resigned">{t("Resigned")}</option><option value="Transferred">{t("Transferred")}</option><option value="Follow-up required">{t("Follow-up required")}</option></select></label><label className="text-sm text-slate-600">{t("Ghi chú / bằng chứng")}<textarea required maxLength={2000} className={control} value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} /></label></div><p className="my-4 text-xs text-slate-500">{t(latest ? `Liên kết dự đoán mẫu gần nhất: ${latest.id}` : 'Chưa có prediction mới để liên kết; vẫn lưu được kết quả quan sát độc lập.')}</p><Button type="submit">{t("Xem lại và lưu kết quả")}</Button>{message && <p role="status" className="mt-3 text-sm text-slate-600">{t(message)}</p>}</form></Card>
    <Card className="overflow-x-auto p-5"><h2 className="mb-3 font-bold text-slate-900">{t("Lịch sử kết quả thực tế")}</h2>{!records.length ? <p className="text-sm text-slate-500">{t("Chưa có kết quả được ghi nhận.")}</p> : <table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500">{['Nhân viên', 'Ngày', 'Kết quả', 'Ghi chú'].map(label => <th className="p-3" key={label}>{t(label)}</th>)}</tr></thead><tbody>{records.map(record => <tr key={record.id} className="border-b border-slate-100"><td className="p-3"><button className="font-semibold text-orange-700 underline" onClick={() => navigate(`/employees/${record.employee_id}`)}>{t(employees.find(employee => employee.id === record.employee_id)?.name || record.employee_id)}</button></td><td className="p-3">{t(record.observed_date)}</td><td className="p-3">{t(record.outcome)}</td><td className="p-3">{record.notes}</td></tr>)}</tbody></table>}</Card>
    <ConfirmationDialog open={confirm} title={t("Xác nhận kết quả thực tế?")} description={t(`${draft.outcome} · ${draft.observed_date}. ${draft.notes}`)} confirmLabel={t("Lưu kết quả")} onCancel={() => setConfirm(false)} onConfirm={save} />
  </AppShell>;
}
