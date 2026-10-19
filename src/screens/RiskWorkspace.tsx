import { useLanguage } from '../context/LanguageContext';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Button, Card, RiskBadge, SectionHeader } from '../components/ui';
import { useRiskEmployees } from '../workflows/useRiskEmployees';
import { useWorkflow } from '../context/WorkflowContext';
import { recordAudit } from '../workflows/audit';
import { downloadTextFile, toCsv } from '../utils/demoActions';
export default function RiskWorkspace({ reports = false }: { reports?: boolean }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { employees } = useRiskEmployees();
  const { runs } = useWorkflow();
  const [department, setDepartment] = useState('');
  const [risk, setRisk] = useState('');
  const [search, setSearch] = useState('');
  const filtered = employees.filter(employee => employee.status === 'Active' && (!department || employee.department === department) && (!risk || (employee.lastAnalysis !== 'Not analyzed' && employee.riskLevel === risk)) && `${employee.name} ${employee.employeeId}`.toLowerCase().includes(search.toLowerCase()));
  const groups = [...new Set(employees.map(employee => employee.department))];
  const exportReport = () => {
    downloadTextFile('eris-risk-report.csv', toCsv(filtered.map(employee => ({ employee_id: employee.employeeId, full_name: employee.name, department: employee.department, position: employee.role, attrition_probability: employee.lastAnalysis === 'Not analyzed' ? '' : employee.riskScore / 100, risk_level: employee.lastAnalysis === 'Not analyzed' ? 'Not predicted' : employee.riskLevel, source: employee.predictionSource, prediction_run_id: runs.find(run => run.results.some(result => result.employee_id === employee.id))?.id || '', last_analysis: employee.lastAnalysis }))), 'text/csv;charset=utf-8');
    recordAudit('RISK_REPORT', 'export', 'Export filtered risk report', null, { count: filtered.length, department, risk });
  };
  const control = 'w-full rounded-xl border border-slate-300 bg-white p-3 text-sm sm:w-auto';
  return <AppShell breadcrumb={['Retention', reports ? 'Risk reports' : 'Organization analytics']}>
    <SectionHeader title={t(reports ? 'Báo cáo rủi ro nhân viên' : 'Tổng quan rủi ro tổ chức')} description={t("Tìm và lọc theo nhân viên, phòng ban, mức rủi ro. Dữ liệu dùng chung với danh sách nhân viên và các lần chạy Analyst đã lưu.")}><Button onClick={exportReport}>{t("Xuất CSV theo bộ lọc")}</Button></SectionHeader>
    <p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{t("Dữ liệu demo: phân biệt kết quả mẫu có sẵn và kết quả mẫu từ lần chạy đã lưu. Hồ sơ chưa được dự đoán không được xếp mặc định vào Low risk.")}</p>
    <div className="mb-5 flex flex-wrap gap-3"><input aria-label={t("Tìm nhân viên")} className={control} placeholder={t("Tìm tên / mã nhân viên")} value={search} onChange={event => setSearch(event.target.value)} /><select aria-label={t("Lọc phòng ban")} className={control} value={department} onChange={event => setDepartment(event.target.value)}><option value="">{t("Tất cả phòng ban")}</option>{groups.map(value => <option key={value} value={value}>{t(value)}</option>)}</select><select aria-label={t("Lọc rủi ro")} className={control} value={risk} onChange={event => setRisk(event.target.value)}><option value="">{t("Tất cả mức rủi ro")}</option>{['High', 'Medium', 'Low'].map(value => <option key={value} value={value}>{t(value)}</option>)}</select></div>
    <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[['Nhân viên trong phạm vi', filtered.length], ['High risk', filtered.filter(employee => employee.lastAnalysis !== 'Not analyzed' && employee.riskLevel === 'High').length], ['Medium / Low risk', filtered.filter(employee => employee.lastAnalysis !== 'Not analyzed' && employee.riskLevel !== 'High').length], ['Chưa có dự đoán', filtered.filter(employee => employee.lastAnalysis === 'Not analyzed').length]].map(([label, value]) => <Card className="p-5" key={label}><p className="text-sm text-slate-500">{t(label)}</p><p className="mt-2 text-2xl font-bold text-slate-900">{t(value)}</p></Card>)}</div>
    <Card className="overflow-x-auto p-5"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500">{['Nhân viên', 'Phòng ban', 'Rủi ro', 'Nguồn kết quả', 'Thao tác'].map(label => <th className="p-3" key={label}>{t(label)}</th>)}</tr></thead><tbody>{filtered.map(employee => <tr key={employee.id} className="border-b border-slate-100"><td className="p-3"><b>{employee.name}</b><p className="mt-1 font-mono text-xs text-slate-400">{employee.employeeId}</p></td><td className="p-3">{t(employee.department)}</td><td className="p-3">{employee.lastAnalysis === 'Not analyzed' ? t('Chưa có dự đoán') : <RiskBadge level={employee.riskLevel} score={employee.riskScore} />}</td><td className="p-3 text-xs text-slate-500">{t(employee.predictionSource)}</td><td className="p-3"><Button variant="secondary" size="sm" onClick={() => navigate(`/employees/${employee.id}/risk`)}>{t("Xem kết quả")}</Button></td></tr>)}</tbody></table>{!filtered.length && <p className="p-8 text-center text-sm text-slate-500">{t("Không có nhân viên khớp bộ lọc.")}</p>}</Card>
  </AppShell>;
}
