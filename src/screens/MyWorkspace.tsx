import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock3, IdCard } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { useRole } from '../context/RoleContext';
import { getApiErrorMessage, getOwnEmployeeData, type OwnEmployeeData } from '../services/api';

export default function MyWorkspace({ mode }: { mode: 'dashboard' | 'profile' }) {
  const { t } = useLanguage();
  const { user } = useRole();
  const [data, setData] = useState<OwnEmployeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setData(null); setLoading(true); setError('');
    void getOwnEmployeeData(controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(cause => { if (!controller.signal.aborted) setError(getApiErrorMessage(cause, 'Could not load your account. Please try again.')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user.email, reload]);

  const account = data?.account;
  const employee = data?.employee;
  const statuses: Record<string, string> = { ACTIVE: 'Active', INACTIVE: 'Inactive', IN_PROCESS: 'In process' };
  const items = account ? [
    ['Full name', employee?.fullName || account.fullName || '—'],
    ['Email', account.email],
    ['Account status', t(statuses[account.status] || account.status)],
  ] : [];
  if (mode === 'profile' && employee) items.push(
    ['Employee code', employee.employeeCode], ['Phone', employee.phone || '—'],
    ['Date of birth', employee.dateOfBirth || '—'], ['Address', employee.address || '—'],
    ['Hire date', employee.hireDate], ['Employment type', employee.employmentType || '—'],
    ['Employment status', t(statuses[employee.employmentStatus] || employee.employmentStatus)],
  );

  return <AppShell breadcrumb={['My Workspace', mode === 'profile' ? 'My Profile' : 'Employee Dashboard']}>
    <SectionHeader title={t(mode === 'profile' ? 'My Profile' : 'Employee Dashboard')} description={t('Your account information and personal workspace.')} />
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold text-slate-900">{account?.fullName || user.name}</h2><Button variant="secondary" disabled={loading} onClick={() => setReload(value => value + 1)}>{t('Reload my information')}</Button></div>
      {loading && <p role="status" className="mt-4 text-sm text-slate-500">{t('Loading your account...')}</p>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{t(error)}</p>}
      {account && <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map(([label, value]) => <div key={label} className="min-w-0 rounded-xl bg-slate-50 p-4"><dt className="text-sm text-slate-500">{t(label)}</dt><dd className="mt-2 break-words font-semibold text-slate-900">{value}</dd></div>)}</dl>}
      {data?.profileState === 'unlinked' && <p className="mt-5 rounded-xl bg-orange-50 p-4 text-sm text-orange-800">{t('Your account has no linked employee profile. Please contact HR.')}</p>}
      {mode === 'profile' && data?.profileState === 'unavailable' && <p className="mt-5 text-sm leading-6 text-slate-500">{t('Your account information is shown above. Additional employee details are currently unavailable for this account.')}</p>}
    </Card>
    <div className="mt-5 grid gap-5 sm:grid-cols-2">
      {[{ to: '/my-profile', label: 'My Profile', description: 'View your account and available employee information.', icon: IdCard }, { to: '/my-attendance', label: 'My Attendance', description: 'Record working time using your current GPS location.', icon: Clock3 }].map(item => <Link key={item.to} to={item.to} className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm transition hover:border-orange-300 focus-visible:outline-2 focus-visible:outline-orange-500"><item.icon className="text-orange-500" size={24} /><h2 className="mt-3 font-bold">{t(item.label)}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{t(item.description)}</p></Link>)}
    </div>
  </AppShell>;
}
