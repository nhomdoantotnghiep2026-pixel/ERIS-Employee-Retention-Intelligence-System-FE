import { useLanguage } from '../context/LanguageContext';
import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Card, SectionHeader, Tabs } from '../components/ui';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Database, Cpu, FileText, Settings, CheckCircle, ShieldCheck, BrainCircuit, ScrollText, BarChart3, BellRing, Mail, Clock3, HardDrive, LockKeyhole } from 'lucide-react';

const DEFAULT_SETTINGS: Record<string, string> = {
  'Application Name': 'ERIS — Employee Retention Intelligence System',
  'Default Language': 'English (US)',
  Timezone: 'Asia/Ho_Chi_Minh (UTC+7)',
  'Date Format': 'MMM DD, YYYY',
  'Session Timeout': '30 minutes',
  'Password Minimum Length': '12 characters',
  'Multi-Factor Authentication': 'Enabled',
  'Login Attempt Limit': '5 attempts',
  'Risk Refresh Schedule': 'Daily at 02:00',
  'Monitoring Window': '90 days',
  'Minimum Data Completeness': '95%',
  'Risk Publication Approval': 'Data/AI review required',
  'Analysis Result Retention': '24 months',
  'Default Report Format': 'PDF',
  'Report Retention': '24 months',
  'Report Schedule Timezone': 'Asia/Ho_Chi_Minh',
  'Executive Approval': 'Required before distribution',
  'Email Notifications': 'Enabled',
  'In-app Notifications': 'Enabled',
  'Daily Digest Time': '08:00',
  'Escalation Recipients': 'HR Manager, HR Director',
};

const SETTINGS_STORAGE_KEY = 'eris-system-settings-v1';

function SettingRow({ label, value, editable = true, onSave }: { label: string; value: string; editable?: boolean; onSave?: (value: string) => void }) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  return <div className="flex min-w-0 items-start justify-between gap-4 border-b border-slate-100 py-4 last:border-0 xl:flex-1">
    <div className="min-w-0 flex-1"><span className="block text-sm text-slate-600">{t(label)}</span><div className="mt-1.5 max-w-2xl">{editing ? <Input aria-label={t(label)} value={draft} onChange={event => setDraft(event.target.value)} className="w-full rounded-md" /> : <span className="block break-words text-sm font-medium leading-6 text-slate-900 [overflow-wrap:anywhere]">{t(value)}</span>}</div></div>
    {editable && <div className="flex shrink-0 flex-wrap items-center gap-1">{editing ? <><Button variant="ghost" size="sm" className="text-orange-700" onClick={() => { onSave?.(draft); setEditing(false); }}>{t('Save')}</Button><Button variant="ghost" size="sm" className="text-slate-600" onClick={() => { setDraft(value); setEditing(false); }}>{t('Cancel')}</Button></> : <Button variant="ghost" size="sm" className="text-orange-700 hover:bg-orange-50 hover:text-orange-800" onClick={() => setEditing(true)}>{t('Edit')}</Button>}</div>}
  </div>;
}

export default function SystemConfig() {
  const { t } = useLanguage();
  const [tab, setTab] = useState('General');
  const [settings, setSettings] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const saveSetting = (label: string, value: string) => setSettings(current => ({ ...current, [label]: value }));

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  return (
    <AppShell breadcrumb={['System Configuration']}>
      <SectionHeader title={t("System Configuration")} description={t("Define platform-wide policies. User access, activity logs, and live service health are managed in their dedicated modules.")} />
      <Tabs tabs={['General', 'Security', 'AI Governance', 'Analysis', 'Reporting', 'Notifications']} active={tab} onChange={setTab} />

      {tab === 'General' && (
        <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="flex flex-col [&>div]:flex-1">
            <Card className="flex flex-col p-5 sm:p-6">
              <div className="text-base font-semibold text-slate-900 mb-3">{t("Application Settings")}</div>
              {['Application Name', 'Default Language', 'Timezone', 'Date Format', 'Session Timeout'].map(label => (
                <SettingRow key={label} label={t(label)} value={settings[label]} onSave={value => saveSetting(label, value)} />
              ))}
            </Card>
          </div>
          <div className="flex flex-col [&>div]:flex-1">
            <Card className="flex flex-col p-5 sm:p-6">
              <div className="text-base font-semibold text-slate-900 mb-3">{t("Service Status")}</div>
              <p className="mb-3 text-sm leading-6 text-slate-600">{t("Read-only service summary. Use System Health Monitor for latency, incidents, and diagnostics.")}</p>
              <div className="grid auto-rows-fr gap-2 xl:flex-1">
                {[
                  { label: 'Application', status: 'Operational', icon: <Settings size={14} className="text-green-500" /> },
                  { label: 'Database', status: 'Connected', icon: <Database size={14} className="text-green-500" /> },
                  { label: 'AI Analysis Service', status: 'Operational', icon: <Cpu size={14} className="text-green-500" /> },
                  { label: 'Reporting Service', status: 'Operational', icon: <FileText size={14} className="text-green-500" /> },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-2">
                      {s.icon}
                      <span className="text-[13px] text-gray-700">{t(s.label)}</span>
                    </div>
                    <span className="text-[12px] font-medium text-green-600 flex items-center gap-1">
                      <CheckCircle size={11} /> {t(s.status)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'Security' && (
        <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card className="flex flex-col p-5 sm:p-6">
            <div className="text-base font-semibold text-slate-900 mb-3">{t("Security Settings")}</div>
            <div className="flex min-w-0 flex-col xl:flex-1">
              {['Session Timeout', 'Password Minimum Length', 'Multi-Factor Authentication', 'Login Attempt Limit'].map(label => (
                <SettingRow key={label} label={t(label)} value={settings[label]} onSave={value => saveSetting(label, value)} />
              ))}
              <SettingRow label={t("Audit Logging")} value="Enabled" editable={false} />
            </div>
          </Card>
          <Card className="flex flex-col p-5 sm:p-6">
            <div className="text-base font-semibold text-slate-900 mb-3">{t("Security Coverage")}</div>
            <div className="grid auto-rows-fr gap-2 xl:flex-1">
              {[
                ['Admin MFA', settings['Multi-Factor Authentication']],
                ['Password Policy', settings['Password Minimum Length']],
                ['Session Policy', settings['Session Timeout']],
                ['Login Protection', settings['Login Attempt Limit']],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                  <span className="text-sm text-slate-600">{t(label)}</span>
                  <span className="text-sm font-semibold text-slate-800">{t(value)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'AI Governance' && (
        <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card className="flex flex-col p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
              <ShieldCheck size={16} className="text-orange-600" /> {t("Responsible AI Policy")} </div>
            <div className="flex flex-col divide-y divide-slate-100 xl:flex-1">
              <SettingRow label={t("Human Review Required")} value="Enabled for all high-risk predictions" editable={false} />
              <SettingRow label={t("Automatic Employment Decisions")} value="Blocked" editable={false} />
              <SettingRow label={t("Prediction Explanation")} value="Required before intervention" editable={false} />
              <SettingRow label={t("Fairness Monitoring")} value="Enabled — monthly review" editable={false} />
              <SettingRow label={t("Copilot Output Mode")} value="Advisory draft only" editable={false} />
              <SettingRow label={t("Audit Retention")} value="24 months" editable={false} />
            </div>
          </Card>

          <div className="flex flex-col gap-5 xl:[&>div:first-child]:flex-1">
            <Card className="flex flex-col p-5 sm:p-6">
              <div className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                <BrainCircuit size={16} className="text-orange-600" /> {t("AI Controls")} </div>
              <div className="grid auto-rows-fr gap-2 xl:flex-1">
                {[
                  ['SHAP Explanations', 'Active'],
                  ['HR Copilot', 'Human-approved'],
                  ['Bias Alerts', 'Watch mode'],
                  ['Model Version', 'v2.3'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                    <span className="text-sm text-slate-600">{t(label)}</span>
                    <span className="text-sm font-semibold text-slate-800">{t(value)}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="flex flex-col p-5 sm:p-6">
              <div className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                <ScrollText size={16} className="text-slate-600" /> {t("Governance Checklist")} </div>
              <div className="grid auto-rows-fr gap-2 text-sm leading-6 text-slate-600 xl:flex-1 [&>div]:flex [&>div]:items-center">
                <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2">{t("Audit trail records AI explanations, copilot suggestions, escalations, and fairness alerts.")}</div>
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">{t("Segments flagged by fairness monitoring require HR/Data review before policy changes.")}</div>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">{t("System Admin controls access, but does not act on employee-level risk without HR authorization.")}</div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'Analysis' && (
        <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card className="flex flex-col p-5 sm:p-6">
            <div className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-900"><BarChart3 size={16} className="text-orange-600" /> {t("Attrition Analysis Policy")}</div>
            <p className="mb-3 text-sm leading-6 text-slate-600">{t("Operational controls used when the Data/AI workspace publishes a risk analysis run. Model thresholds remain in Model Configuration.")}</p>
            {['Risk Refresh Schedule', 'Monitoring Window', 'Minimum Data Completeness', 'Risk Publication Approval', 'Analysis Result Retention'].map(label => (
              <SettingRow key={label} label={t(label)} value={settings[label]} onSave={value => saveSetting(label, value)} />
            ))}
          </Card>
          <div className="flex flex-col gap-5 xl:[&>div:first-child]:flex-1">
            <Card className="flex flex-col p-5 sm:p-6">
              <div className="text-base font-semibold text-slate-900">{t("Control Boundary")}</div>
              <div className="mt-3 grid auto-rows-fr gap-2 text-sm leading-6 text-slate-600 xl:flex-1 [&>div]:flex [&>div]:items-center">
                <div className="rounded-md bg-slate-50 px-3 py-2">{t("System Admin defines platform defaults.")}</div>
                <div className="rounded-md bg-slate-50 px-3 py-2">{t("Data/AI Analyst validates data and evaluates the model.")}</div>
                <div className="rounded-md bg-slate-50 px-3 py-2">{t("HR reviews employee-level results and decides interventions.")}</div>
              </div>
            </Card>
            <Card className="border border-amber-200 bg-amber-50 p-4">
              <div className="flex gap-3"><ShieldCheck size={19} className="mt-0.5 shrink-0 text-amber-700" /><p className="text-[12px] leading-5 text-amber-900">{t("Changing a threshold affects future analysis runs. Existing employee risk records remain unchanged for audit consistency.")}</p></div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'Reporting' && (
        <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card className="flex flex-col p-5 sm:p-6">
            <div className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-900"><FileText size={16} className="text-orange-600" /> {t("Report Delivery Policy")}</div>
            <p className="mb-3 text-sm leading-6 text-slate-600">{t("Defaults for generated files, scheduled delivery, approval, and storage.")}</p>
            {['Default Report Format', 'Report Retention', 'Report Schedule Timezone', 'Executive Approval'].map(label => (
              <SettingRow key={label} label={t(label)} value={settings[label]} onSave={value => saveSetting(label, value)} />
            ))}
          </Card>
          <div className="flex flex-col gap-5 xl:[&>div:first-child]:flex-1">
            <Card className="flex flex-col p-5 sm:p-6">
              <div className="mb-3 text-base font-semibold text-slate-900">{t("Report Lifecycle")}</div>
              {[
                { icon: FileText, label: 'Generate', detail: 'HR creates an on-demand or scheduled report' },
                { icon: ShieldCheck, label: 'Approve', detail: 'Executive reports require designated approval' },
                { icon: Mail, label: 'Distribute', detail: 'Only verified company recipients are allowed' },
                { icon: HardDrive, label: 'Retain', detail: settings['Report Retention'] },
              ].map((item, index) => <div key={item.label} className="flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-0 xl:flex-1"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange-50 text-orange-600"><item.icon size={15} /></span><div><p className="text-sm font-semibold text-slate-800">{index + 1}. {t(item.label)}</p><p className="mt-0.5 text-[11px] leading-4 text-slate-500">{t(item.detail)}</p></div></div>)}
            </Card>
          </div>
        </div>
      )}

      {tab === 'Notifications' && (
        <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card className="flex flex-col p-5 sm:p-6">
            <div className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-900"><BellRing size={16} className="text-orange-600" /> {t("Delivery Channels")}</div>
            <p className="mb-3 text-sm leading-6 text-slate-600">{t("Configure how operational alerts are delivered. Employee risk details remain visible only to authorized HR users.")}</p>
            {['Email Notifications', 'In-app Notifications', 'Daily Digest Time', 'Escalation Recipients'].map(label => (
              <SettingRow key={label} label={t(label)} value={settings[label]} onSave={value => saveSetting(label, value)} />
            ))}
          </Card>
          <Card className="flex flex-col p-5 sm:p-6">
            <div className="mb-3 text-base font-semibold text-slate-900">{t("Event Routing")}</div>
            <div className="grid auto-rows-fr gap-2 xl:flex-1">
              {[
                { icon: BrainCircuit, event: 'Model drift detected', target: 'Data/AI Analyst', cadence: 'Immediate' },
                { icon: ShieldCheck, event: 'Permission changed', target: 'System Administrator', cadence: 'Immediate' },
                { icon: BarChart3, event: 'New high-risk cohort', target: 'HR', cadence: 'Daily digest' },
                { icon: LockKeyhole, event: 'Repeated login failure', target: 'System Administrator', cadence: 'Immediate' },
              ].map(item => <div key={item.event} className="rounded-lg border border-slate-200 px-3 py-2.5"><div className="flex items-center gap-2"><item.icon size={14} className="text-orange-600" /><span className="text-sm font-semibold text-slate-800">{t(item.event)}</span></div><div className="mt-1.5 flex items-center justify-between pl-5 text-[11px] text-slate-500"><span>{t(item.target)}</span><span className="flex items-center gap-1 font-medium text-slate-700"><Clock3 size={11} />{t(item.cadence)}</span></div></div>)}
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
