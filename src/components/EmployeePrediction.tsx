import { useLanguage } from '../context/LanguageContext';
import { useState } from 'react';
import { Card, RiskBadge } from './ui';
import { useWorkflow } from '../context/WorkflowContext';

export function EmployeePrediction({ employeeId }: { employeeId: string }) {
  const { t } = useLanguage();
  const { runs } = useWorkflow();
  const history = runs.filter(run => run.results.some(result => result.employee_id === employeeId));
  const [runId, setRunId] = useState('');
  const run = history.find(item => item.id === runId) || history[0];
  const prediction = run?.results.find(item => item.employee_id === employeeId);
  return <Card className="mb-5 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold text-slate-900">{t("Kết quả dự đoán đã lưu")}</h2>{history.length > 0 && <select aria-label={t("Lịch sử dự đoán nhân viên")} className="max-w-full rounded-xl border border-slate-300 p-2 text-xs" value={run?.id} onChange={event => setRunId(event.target.value)}>{history.map(item => <option key={item.id} value={item.id}>{t(item.period_start)} → {t(item.period_end)} · {t(item.model_version)} · {t(item.created_at)}</option>)}</select>}</div>
    {!prediction || !run ? <p className="mt-3 text-sm text-slate-500">{t("Chưa có kết quả từ luồng snapshot/model mới. Các biểu đồ cũ bên dưới là dữ liệu minh họa có sẵn.")}</p> : <><p className="my-3 text-xs text-amber-800">{t("Kết quả mẫu mô phỏng, không phải inference AI mới. HR xem xét trước khi quyết định hành động.")}</p><RiskBadge level={prediction.risk_level} score={Math.round(prediction.attrition_probability * 100)} /><p className="mt-3 break-all font-mono text-xs text-slate-500">{t("Model")} {t(run.model_version)} {t("· run")} {t(run.id)} {t("· snapshot")} {t(prediction.snapshot_id)}</p><div className="mt-3">{prediction.explanations.map(item => <p key={item.rank_order} className="border-t border-slate-100 py-2 text-sm text-slate-600">{item.rank_order}. {t(item.feature_name)} = {item.feature_value} · {t(item.impact_direction)} ({item.impact_value})</p>)}</div></>}
  </Card>;
}
