import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { Button, Card } from './ui';
export function EmployeeRetentionSummary({ employeeId }: { employeeId: string }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  let actions: { id: string; empId: string; type: string; status: string; assignedTo: string; notes: string }[] = [];
  try { const value = JSON.parse(sessionStorage.getItem('eris-retention-actions-v1') || '[]'); if (Array.isArray(value)) actions = value.filter(item => item.empId === employeeId); } catch { /* No stored actions. */ }
  return <Card className="p-5"><h2 className="font-bold text-slate-900">{t("Hành động giữ chân đã ghi nhận")}</h2>{!actions.length ? <p className="my-4 text-sm text-slate-500">{t("Chưa có hành động được lưu cho nhân viên này. Điểm rủi ro không tự xác định trạng thái can thiệp hoặc kết quả thực tế.")}</p> : actions.map(action => <div className="my-4 rounded-xl border border-slate-200 p-4" key={action.id}><h3 className="font-semibold text-slate-800">{t(action.type)} · {t(action.status)}</h3><p className="my-2 text-xs text-slate-500">{t("Phụ trách:")} {t(action.assignedTo)}</p><p className="text-sm text-slate-600">{action.notes}</p></div>)}<div className="mt-4 flex flex-wrap gap-3"><Button onClick={() => navigate(`/interventions?employee=${employeeId}`)}>{t("Quản lý hành động giữ chân")}</Button><Button variant="secondary" onClick={() => navigate(`/outcomes?employee=${employeeId}`)}>{t("Ghi nhận kết quả thực tế")}</Button></div></Card>;
}
