import { useLanguage } from '../context/LanguageContext';
import { useAutoDismissState } from '../hooks/useAutoDismissState';
import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { createPolicyDemo, getApiErrorMessage, getPolicyPrediction, getPolicyRecommendation, getRetentionPolicy, listEducationEmployees, listPolicyRecommendations, listRetentionPolicies, type PolicyPrediction, type PolicyRecommendation, type RetentionPolicy } from '../services/api';

export default function PolicyDemo() {
  const { t } = useLanguage();
  const [employees, setEmployees] = useState<Array<{id:number; employeeCode:string; fullName:string; employmentStatus:string}>>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [recommendations, setRecommendations] = useState<PolicyRecommendation[]>([]);
  const [detail, setDetail] = useState<PolicyPrediction | null>(null);
  const [policy, setPolicy] = useState<RetentionPolicy | null>(null);
  const [error, setError] = useAutoDismissState();
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => { let active=true; setError(''); void Promise.all([listEducationEmployees(), listRetentionPolicies(), listPolicyRecommendations()]).then(([e,p,r]) => { if (active) {setEmployees(e.data.filter(x => x.employmentStatus === 'ACTIVE'));setPolicies(p.data);setRecommendations(r.data);} }).catch(e => { if (active) setError(getApiErrorMessage(e, 'Không tải được dữ liệu chính sách.')); }); return () => {active=false;}; }, [reload]);
  async function create() {
    if (!selected.length || busy || !window.confirm(t('Tạo kết quả minh họa cố định cho các nhân viên đã chọn? Thao tác này ghi một đợt mới vào hệ thống.'))) return;
    setBusy(true); setError('');
    try { const result=await createPolicyDemo(selected); setDetail(result.results[0] || null); setReload(x=>x+1); }
    catch(e) {setError(getApiErrorMessage(e, 'Không tạo được kết quả minh họa.'));} finally {setBusy(false);}
  }
  return <AppShell breadcrumb={['Retention', 'Policy demo']}><SectionHeader title={t("Minh họa đề xuất chính sách")} description={t("Kết quả cố định để kiểm thử giao diện, không phải dự đoán thực tế hoặc kết quả mô hình.")} />
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">{t(error)}</p>}
    <Card className="mb-5 p-5"><h2 className="font-bold">{t("Chọn nhân viên để tạo kết quả minh họa")}</h2><p className="mt-2 text-sm text-slate-600">{t("Chỉ chọn nhân viên có hồ sơ và tài khoản đang hoạt động. Mỗi lần tạo sẽ ghi một đợt mới.")}</p><div className="mt-4 grid max-h-56 gap-2 overflow-auto sm:grid-cols-2">{employees.map(e=><label key={e.id} className="flex gap-2 text-sm"><input type="checkbox" checked={selected.includes(e.id)} onChange={event=>setSelected(v=>event.target.checked ? [...v,e.id] : v.filter(id=>id!==e.id))}/>{e.employeeCode} · {e.fullName}</label>)}</div><Button className="mt-4" disabled={busy || !selected.length || selected.length>100} onClick={()=>void create()}>{t("Tạo kết quả minh họa")}</Button></Card>
    {detail && <Card className="mb-5 p-5"><div className="flex justify-between"><h2 className="font-bold">{t("Kết quả:")}{detail.employee.fullName}</h2><Button variant="secondary" onClick={()=>setDetail(null)}>{t("Đóng")}</Button></div><p className="mt-2 text-sm">{t("Nguồn:")}{t(detail.dataSource)} {t("· Mức rủi ro:")}{t(detail.riskLevel)} · {(detail.attritionProbability*100).toFixed(1)}%</p>{detail.explanationScale && <p className="mt-2 text-sm text-amber-700">{t("Giải thích minh họa, không phải SHAP thực tế.")}</p>}{detail.explanations.map(e=><p key={e.id} className="mt-2 text-sm">{t(e.featureName)}: {e.impactValue ?? '—'} · {t(e.impactDirection)}</p>)}</Card>}
    {policy && <Card className="mb-5 p-5"><div className="flex justify-between"><h2 className="font-bold">{t(policy.name)}</h2><Button variant="secondary" onClick={()=>setPolicy(null)}>{t("Đóng")}</Button></div><p className="mt-2 text-sm">{t(policy.description)}</p></Card>}
    <Card className="mb-5 p-5"><h2 className="font-bold">{t("Đề xuất đã lưu")}</h2>{recommendations.map(r=><div key={r.id} className="mt-3 rounded-xl border border-slate-200 p-4"><p className="font-medium">{r.employee.fullName} · {t(r.policy.name)}</p><p className="mt-1 text-sm">{t(r.reason)} · {t(r.dataSource)}</p><div className="mt-3 flex gap-2"><Button size="sm" variant="info" onClick={()=>void getPolicyRecommendation(r.id).then(x=>setPolicy(x.data.policy)).catch(e=>setError(getApiErrorMessage(e, 'Could not load details.')))}>{t("Chi tiết đề xuất")}</Button><Button size="sm" variant="warning" onClick={()=>void getPolicyPrediction(r.predictionResultId).then(x=>setDetail(x.data)).catch(e=>setError(getApiErrorMessage(e, 'Could not load details.')))}>{t("Xem kết quả")}</Button></div></div>)}{!recommendations.length && <p className="mt-3 text-sm text-slate-500">{t("Chưa có đề xuất.")}</p>}</Card>
    <Card className="p-5"><h2 className="font-bold">{t("Danh mục chính sách")}</h2>{policies.map(p=><div key={p.id} className="mt-3 flex items-center justify-between gap-3"><span>{t(p.name)}</span><Button size="sm" variant="secondary" onClick={()=>void getRetentionPolicy(p.id).then(x=>setPolicy(x.data)).catch(e=>setError(getApiErrorMessage(e, 'Could not load details.')))}>{t("Chi tiết")}</Button></div>)}{!policies.length && <p className="mt-3 text-sm text-slate-500">{t("Chưa có chính sách.")}</p>}</Card>
  </AppShell>;
}
