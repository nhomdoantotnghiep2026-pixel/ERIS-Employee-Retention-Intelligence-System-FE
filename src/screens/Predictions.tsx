import { useLanguage } from '../context/LanguageContext';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Button, Card, ConfirmationDialog, SectionHeader, RiskBadge } from '../components/ui';
import { useWorkflow } from '../context/WorkflowContext';
import { useEmployees } from '../context/EmployeeContext';
import { snapshotIsCurrent } from '../workflows/domain';
import { useAutoDismissState } from '../hooks/useAutoDismissState';

export default function Predictions() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { snapshot, models, runs, generate } = useWorkflow();
  const { employees } = useEmployees();
  const [runId, setRunId] = useState('');
  const [error, setError] = useAutoDismissState(7000);
  const [confirm, setConfirm] = useState(false);
  const [detail, setDetail] = useState('');
  const active = models.find(model => model.status === 'Active');
  const ready = snapshot && !snapshot.issues.length && snapshotIsCurrent(snapshot, employees) && active;
  const run = runs.find(item => item.id === runId) || runs[0];
  const prediction = run?.results.find(item => item.id === detail);
  return <AppShell breadcrumb={['AI Models', 'Employee predictions']}>
    <SectionHeader title={t("Chạy và xem kết quả dự đoán")} description={t("Snapshot hợp lệ → model Active → xác nhận chạy → lưu kết quả và giải thích theo nhân viên.")}><Button disabled={!ready} onClick={() => setConfirm(true)}>{t("Chạy thử bằng kết quả mẫu")}</Button></SectionHeader>
    <p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">{t("Mô phỏng bằng fixture có sẵn, không phải suy luận AI mới từ dữ liệu đã sửa. Nhân viên mới cần dịch vụ inference thật; hệ thống không tự tạo điểm rủi ro cho họ.")}</p>
    <div className="mb-5 grid gap-4 sm:grid-cols-2"><Card className="p-5"><h2 className="font-bold text-slate-900">{t("1. Snapshot đầu vào")}</h2><p className="my-3 text-sm text-slate-600">{t(snapshot ? `${snapshot.start} → ${snapshot.end} · ${snapshot.inputs.length} nhân viên · ${snapshot.issues.length} lỗi${snapshotIsCurrent(snapshot, employees) ? '' : ' · Dữ liệu đã thay đổi'}` : 'Chưa tạo snapshot')}</p><Button variant="secondary" onClick={() => navigate('/preparation')}>{t("Xem / tạo lại snapshot")}</Button></Card><Card className="p-5"><h2 className="font-bold text-slate-900">{t("2. Phiên bản model")}</h2><p className="my-3 text-sm text-slate-600">{t(active ? `${active.version} · Active` : 'Chưa có model Active')}</p><Button variant="secondary" onClick={() => navigate('/model-performance')}>{t("Đánh giá / kích hoạt model")}</Button></Card></div>
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{t(error)}</p>}
    <Card className="overflow-x-auto p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold text-slate-900">{t("Lịch sử lần chạy và kết quả")}</h2><select aria-label={t("Chọn lần chạy")} className="max-w-full rounded-xl border border-slate-300 p-2 text-sm" value={run?.id || ''} onChange={event => { setRunId(event.target.value); setDetail(''); }}>{!runs.length && <option value="">{t("Chưa có lần chạy")}</option>}{runs.map(item => <option key={item.id} value={item.id}>{t(item.name)} · {t(item.model_version)} · {t(item.created_at)}</option>)}</select></div>
      {!run ? <p className="py-8 text-center text-sm text-slate-500">{t("Hoàn tất snapshot và kích hoạt model để chạy mô phỏng.")}</p> : <><p className="mb-3 text-xs text-slate-500">{t("Run:")} {t(run.id)} · {t(run.status)} · {t(run.mode)}</p><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500">{['Nhân viên', 'Xác suất mẫu', 'Rủi ro', 'Giải thích'].map(label => <th className="p-3" key={label}>{t(label)}</th>)}</tr></thead><tbody>{run.results.map(result => <tr key={result.id} className="border-b border-slate-100"><td className="p-3">{t(employees.find(employee => employee.id === result.employee_id)?.name || result.employee_id)}</td><td className="p-3">{Math.round(result.attrition_probability * 100)}%</td><td className="p-3"><RiskBadge level={result.risk_level} /></td><td className="p-3"><Button variant="secondary" size="sm" onClick={() => setDetail(result.id)}>{t("Xem yếu tố mẫu")}</Button></td></tr>)}</tbody></table></>}
    </Card>
    {prediction && <Card className="mt-5 p-5"><h2 className="font-bold text-slate-900">{t("Giải thích đã lưu theo prediction")}</h2><p className="my-3 break-all text-xs text-slate-500">{t(prediction.id)} {t("· snapshot")} {t(prediction.snapshot_id)} · {t(prediction.prediction_label)}</p>{prediction.explanations.map(item => <div key={item.rank_order} className="flex flex-wrap justify-between gap-3 border-b border-slate-100 py-3 text-sm"><span>{item.rank_order}. {t(item.feature_name)} = {item.feature_value}</span><b>{t(item.impact_direction)} · {item.impact_value}</b></div>)}</Card>}
    <ConfirmationDialog open={confirm} title={t("Chạy mô phỏng dự đoán?")} description={t("Lưu một lần chạy mới với snapshot/model đã chọn và kết quả mẫu có sẵn. Không chạy inference thật hoặc ghi đè kết quả cũ.")} confirmLabel={t("Chạy mô phỏng")} onCancel={() => setConfirm(false)} onConfirm={() => { try { const result = generate(); setRunId(result.id); setError(''); } catch (cause) { setError((cause as Error).message); } setConfirm(false); }} />
  </AppShell>;
}
