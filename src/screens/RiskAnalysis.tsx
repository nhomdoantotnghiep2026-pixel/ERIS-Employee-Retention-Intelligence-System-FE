import { useLanguage } from '../context/LanguageContext';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Card, RiskBadge, AIAdvisoryBanner, Avatar, Button } from '../components/ui';
import { contributingFactors } from '../data/mockData';
import { useRiskEmployees as useEmployees } from '../workflows/useRiskEmployees';
import { EmployeePrediction } from '../components/EmployeePrediction';
import { useState } from 'react';
import { ArrowLeft, BrainCircuit, ClipboardList, MessageSquare, Sparkles } from 'lucide-react';

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const { t, language } = useLanguage();
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-[12px] text-gray-400">{t(label)}</span>
      <span className={`text-[13px] font-medium ${highlight ? 'text-amber-600' : 'text-gray-700'}`}>{t(value)}</span>
    </div>
  );
}

export default function RiskAnalysis() {
  const { t, language } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { employees } = useEmployees();
  const [copilotOpen, setCopilotOpen] = useState(false);
  const emp = employees.find(e => e.id === id);
  const navigationState = location.state as { returnTo?: string; parentReturnTo?: string } | null;
  const returnTo = navigationState?.returnTo || (id ? `/employees/${id}` : '/employees');
  const parentReturnTo = navigationState?.parentReturnTo;
  const returnLabel = returnTo.startsWith('/org-overview')
    ? 'Back to Organization Overview'
    : returnTo.startsWith('/attrition-risk')
      ? 'Back to Attrition Risk'
      : 'Back to Employee Profile';

  if (!emp) {
    return <AppShell breadcrumb={['Employees', 'Risk Analysis', 'Not found']}><Card className="mx-auto max-w-xl p-8 text-center"><h1 className="text-xl font-bold text-slate-900">{t("Employee not found")}</h1><p className="mt-2 text-sm text-slate-500">{t("Risk analysis cannot be opened because this employee record is unavailable.")}</p><Button className="mt-6" onClick={() => navigate('/employees')}>{t("Back to employee directory")}</Button></Card></AppShell>;
  }

  if (emp.lastAnalysis === 'Not analyzed') return <AppShell breadcrumb={['Employees', emp.name, 'Risk Analysis']}><Card className="p-8"><h1 className="text-xl font-bold text-slate-900">{t("Chưa có dự đoán cho nhân viên này")}</h1><p className="my-4 text-sm text-slate-600">{t("Hoàn thiện đầu vào và chuyển Data / AI Analyst chạy phân tích. Không có điểm hoặc giải thích AI để hiển thị.")}</p><Button onClick={() => navigate(`/employees/${emp.id}`)}>{t("Về hồ sơ nhân viên")}</Button></Card></AppShell>;

  const maxFactor = Math.max(...contributingFactors.map(f => f.value));
  const localExplanations = [
    { factor: 'Overtime', value: emp.overtime ? 0.24 : 0.04, impact: emp.overtime ? 'Increases risk' : 'Low impact', note: emp.overtime ? 'Employee is currently marked for overtime.' : 'No overtime signal detected.' },
    { factor: 'Job Satisfaction', value: emp.jobSatisfaction <= 2 ? 0.21 : 0.07, impact: emp.jobSatisfaction <= 2 ? 'Increases risk' : 'Protective', note: `Current score: ${emp.jobSatisfaction}/5.` },
    { factor: 'Work-Life Balance', value: emp.workLifeBalance <= 2 ? 0.16 : 0.05, impact: emp.workLifeBalance <= 2 ? 'Increases risk' : 'Protective', note: `Current score: ${emp.workLifeBalance}/4.` },
    { factor: 'Business Travel', value: emp.businessTravel === 'Frequently' ? 0.12 : 0.03, impact: emp.businessTravel === 'Frequently' ? 'Increases risk' : 'Low impact', note: `Travel pattern: ${emp.businessTravel}.` },
  ].sort((a, b) => b.value - a.value);
  const copilotSuggestions = [
    emp.overtime ? 'Schedule a workload review with the employee and direct manager.' : 'Confirm whether workload remains stable in the next check-in.',
    emp.jobSatisfaction <= 2 ? 'Prepare a 1-on-1 discussion focused on satisfaction drivers and career blockers.' : 'Maintain regular engagement check-ins.',
    emp.workLifeBalance <= 2 ? 'Offer flexible scheduling or redistribution of urgent tasks for two weeks.' : 'Monitor work-life balance trend in the next pulse survey.',
    emp.monthlyIncome < 4500 ? 'Flag compensation review as a possible retention lever.' : 'Compensation is not the strongest current signal.',
  ];

  return (
    <AppShell breadcrumb={['Employees', emp.name, 'Risk Analysis']}>
      <button type="button" onClick={() => navigate(returnTo, { state: parentReturnTo ? { returnTo: parentReturnTo } : undefined })} className="mb-3 inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-white hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-orange-500">
        <ArrowLeft size={17} /> {t(returnLabel)}
      </button>
      <EmployeePrediction employeeId={emp.id} />
      {/* Header */}
      <Card className="mb-4 px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar initials={emp.initials} size="md" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[18px] font-semibold text-gray-900">{emp.name}</span>
                <RiskBadge level={emp.riskLevel} score={emp.riskScore} />
              </div>
              <div className="text-[13px] text-gray-500">{t(emp.role)} · {t(emp.department)}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-gray-400 uppercase tracking-wide">{t("Last analyzed")}</div>
            <div className="text-[13px] font-medium text-gray-700">{t(emp.lastAnalysis)}</div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        {/* LEFT */}
        <div className="col-span-2 space-y-4">
          {/* Risk Score */}
          <Card className="p-4">
            <div className="text-[14px] font-semibold text-gray-800 mb-3">{t("Predicted Attrition Risk")}</div>
            <div className="flex items-start gap-5">
              <div className="flex-shrink-0">
                <div className={`text-[40px] font-bold leading-none ${emp.riskLevel === 'High' ? 'text-red-600' : emp.riskLevel === 'Medium' ? 'text-amber-600' : 'text-green-600'}`}>
                  {emp.riskScore}%
                </div>
                <div className="mt-1"><RiskBadge level={emp.riskLevel} /></div>
              </div>
              <div className="flex-1 pt-2">
                {/* Horizontal risk meter */}
                <div className="relative mb-1">
                  <div className="w-full h-2 rounded-full overflow-hidden flex">
                    <div className="flex-1 bg-green-100" />
                    <div className="flex-1 bg-amber-100" />
                    <div className="flex-1 bg-red-100" />
                  </div>
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow ${emp.riskLevel === 'High' ? 'bg-red-500' : emp.riskLevel === 'Medium' ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ left: `calc(${emp.riskScore}% - 6px)` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-gray-400 mb-3">
                  <span>{t("Low")}</span><span>{t("Medium")}</span><span>{t("High")}</span>
                </div>
                <p className="text-[13px] text-gray-600 leading-relaxed"> {t("The model indicates an elevated attrition risk. Overtime, job satisfaction, and years at the company are among the strongest factors associated with this prediction.")} </p>
                <div className="flex gap-5 mt-2">
                  <div>
                    <div className="text-[11px] text-gray-400">{t("Model Version")}</div>
                    <div className="text-[12px] font-medium text-gray-700">{t("Attrition Model v2.3")}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-400">{t("Data Status")}</div>
                    <div className="text-[12px] font-medium text-green-600">{t("Validated")}</div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Contributing Factors */}
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="text-[14px] font-semibold text-gray-800 mb-1">{t("Key Contributing Factors")}</div>
                <div className="text-[12px] text-gray-400">{t("Global factors influencing attrition predictions")}</div>
              </div>
              <span className="inline-flex items-center gap-1 rounded bg-orange-50 px-2 py-1 text-[11px] font-medium text-orange-700">
                <BrainCircuit size={12} /> {t("SHAP explainability")} </span>
            </div>
            <div className="flex items-center gap-3 mb-3 text-[12px] text-gray-500">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-red-300" /> {t("Increasing predicted risk")}</div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-green-300" /> {t("Reducing predicted risk")}</div>
            </div>
            <div className="space-y-2.5">
              {contributingFactors.map(f => (
                <div key={f.factor} className="flex items-center gap-2.5">
                  <span className="w-44 text-[13px] text-gray-700 flex-shrink-0">{t(f.factor)}</span>
                  <div className="flex-1 bg-gray-100 rounded h-2 overflow-hidden">
                    <div
                      className={`h-full rounded ${f.direction === 'increase' ? 'bg-red-400' : 'bg-green-400'}`}
                      style={{ width: `${(f.value / maxFactor) * 100}%` }}
                    />
                  </div>
                  <span className={`text-[12px] font-semibold w-10 text-right flex-shrink-0 ${f.direction === 'increase' ? 'text-red-600' : 'text-green-600'}`}>
                    {t(f.direction === 'increase' ? '+' : '-')}{f.value}%
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-gray-100 text-[11px] text-gray-400"> {t("Factor contributions represent relative associations derived from explainability analysis, not causal relationships.")} </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[14px] font-semibold text-gray-800">{t("Local SHAP Explanation")}</div>
                <div className="text-[12px] text-gray-400">{t("Employee-specific drivers behind this risk score")}</div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setCopilotOpen(open => !open)}>
                <Sparkles size={13} /> {t(copilotOpen ? 'Hide Copilot' : 'Suggest Intervention')}
              </Button>
            </div>
            <div className="space-y-2.5">
              {localExplanations.map(item => (
                <div key={item.factor} className="grid grid-cols-[150px_minmax(0,1fr)_120px] items-center gap-3">
                  <div className="text-[13px] font-medium text-slate-700">{t(item.factor)}</div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${item.impact === 'Protective' ? 'bg-emerald-500' : item.impact === 'Low impact' ? 'bg-slate-300' : 'bg-red-400'}`} style={{ width: `${Math.min(100, item.value * 420)}%` }} />
                  </div>
                  <div className={`text-right text-[12px] font-semibold ${item.impact === 'Protective' ? 'text-emerald-600' : item.impact === 'Low impact' ? 'text-slate-500' : 'text-red-600'}`}>{t(item.impact)}</div>
                  <div className="col-span-3 -mt-1 text-[11px] text-slate-400">{t(item.note)}</div>
                </div>
              ))}
            </div>
            {copilotOpen && (
              <div className="mt-4 rounded-lg border border-orange-100 bg-orange-50/70 p-3">
                <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-orange-800">
                  <MessageSquare size={14} /> {t("HR Copilot Intervention Draft")} </div>
                <div className="space-y-2">
                  {copilotSuggestions.map(suggestion => (
                    <div key={suggestion} className="flex gap-2 text-[13px] leading-5 text-slate-700">
                      <ClipboardList size={13} className="mt-1 flex-shrink-0 text-orange-500" />
                      <span>{t(suggestion)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-[11px] text-slate-500">{t("Copilot output is advisory. HR must review before creating an intervention.")}</div>
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="text-[14px] font-semibold text-gray-800 mb-3">{t("Employee Snapshot")}</div>
            <InfoRow label={t("Department")} value={emp.department} />
            <InfoRow label={t("Role")} value={emp.role} />
            <InfoRow label={t("Tenure")} value={`${emp.tenure} years`} />
            <InfoRow label={t("Overtime")} value={emp.overtime ? 'Yes' : 'No'} highlight={emp.overtime} />
            <InfoRow label={t("Job Satisfaction")} value={`${emp.jobSatisfaction} / 5`} highlight={emp.jobSatisfaction <= 2} />
            <InfoRow label={t("Work-Life Balance")} value={`${emp.workLifeBalance} / 4`} highlight={emp.workLifeBalance <= 2} />
            <InfoRow label={t("Monthly Income")} value={`$${emp.monthlyIncome.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')}`} />
            <InfoRow label={t("Business Travel")} value={emp.businessTravel} />
          </Card>
          <Card className="p-4">
            <div className="text-[14px] font-semibold text-gray-800 mb-3">{t("Analysis Information")}</div>
            <InfoRow label={t("Model Version")} value="Attrition Model v2.3" />
            <InfoRow label={t("Analysis Date")} value={emp.lastAnalysis} />
            <InfoRow label={t("Data Status")} value="Validated" />
            <InfoRow label={t("Dataset")} value="2026-Q3" />
            <InfoRow label={t("Human Review")} value="Required" highlight />
            <InfoRow label={t("Decision Mode")} value="Advisory only" />
          </Card>
        </div>
      </div>

      <div className="mt-4"><AIAdvisoryBanner /></div>
    </AppShell>
  );
}
