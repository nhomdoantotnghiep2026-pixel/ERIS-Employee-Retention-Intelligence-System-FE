import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { useEmployees } from '../context/EmployeeContext';
import { useWorkflow } from '../context/WorkflowContext';
import { useLanguage } from '../context/LanguageContext';
import { snapshotIsCurrent } from '../workflows/domain';
export default function DataWorkspace() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { employees } = useEmployees();
  const { snapshot, models, runs } = useWorkflow();
  const active = models.find(model => model.status === 'Active');
  const ready = snapshot && !snapshot.issues.length && snapshotIsCurrent(snapshot, employees);
  const actions = [
    { title: '1. Manage employee data', description: t('{total} profiles · {active} active', { total: employees.length, active: employees.filter(employee => employee.status === 'Active').length }), to: '/employees', button: 'Open employee list' },
    { title: '2. Import and validate data', description: t('CSV / Excel → row, duplicate and reference checks → preview → confirm'), to: '/employees/import', button: 'Import data' },
    { title: '3. Prepare a snapshot', description: ready ? t('Valid inputs: {count} · {start} → {end}', { count: snapshot.inputs.length, start: snapshot.start, end: snapshot.end }) : snapshot ? t('Validation issues: {count}, or source data changed — recheck required', { count: snapshot.issues.length }) : t('No snapshot created'), to: '/preparation', button: 'Choose period / scope and validate' },
    { title: '4. Evaluate and activate a model', description: active ? t('{version} is active', { version: active.version }) : t('No model activated. Evaluate a model before activation.'), to: '/model-performance', button: 'Evaluate model' },
    { title: '5. Generate predictions and save explanations', description: t('Saved runs: {count} · sample results only, no live inference', { count: runs.length }), to: '/predictions', button: 'Open prediction workflow' },
    { title: '6. Review activity history', description: t('Track your data changes and analysis activity.'), to: '/audit-logs', button: 'View logs' },
  ];
  return <AppShell breadcrumb={['Data & AI Workspace']}><SectionHeader title="Data & AI Workspace" description="Follow the sequence: employee data → validation → snapshot → model evaluation/activation → predictions/explanations → HR handoff." /><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{actions.map(action => <Card key={action.to} className="flex flex-col p-6"><h2 className="font-bold text-slate-900">{t(action.title)}</h2><p className="mb-5 mt-3 flex-1 text-sm leading-6 text-slate-600">{action.description}</p><Button variant="secondary" onClick={() => navigate(action.to)}>{t(action.button)}</Button></Card>)}</div></AppShell>;
}
