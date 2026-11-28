import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ClipboardList, Clock3, IdCard, ShieldCheck } from 'lucide-react';
import { EmployeeQuickStats } from '../components/EmployeeQuickStats';
import { AppShell } from '../components/AppShell';
import { EmployeeApiHistory } from '../components/EmployeeApiHistory';
import { Button, Card, SectionHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { useRole } from '../context/RoleContext';
import { getApiErrorMessage, getOwnEmployeeData, type OwnEmployeeData } from '../services/api';
import { useAutoDismissState } from '../hooks/useAutoDismissState';
import { employeeDate } from '../utils/employeeDates';

function profileDate(value: string | null | undefined, language: string) {
  const date = employeeDate(value);
  if (!date) return '—';
  const [year, month, day] = date.split('-');
  return language === 'vi' ? `${day}/${month}/${year}` : `${month}/${day}/${year}`;
}

export default function MyWorkspace({ mode }: { mode: 'dashboard' | 'profile' }) {
  const { t, language } = useLanguage();
  const { user } = useRole();
  const [data, setData] = useState<OwnEmployeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useAutoDismissState();
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
  const tr = (vi: string, en: string) => language === 'vi' ? vi : en;
  const items = account ? [
    ['Full name', employee?.fullName || account.fullName || '—'],
    ['Email', account.email],
    ...(mode === 'dashboard' ? [['Account status', t(statuses[account.status] || account.status)]] : []),
  ] : [];
  if (mode === 'profile' && employee) items.push(
    ['Employee code', employee.employeeCode], ['Phone', employee.phone || '—'],
    ['Date of birth', profileDate(employee.dateOfBirth, language)], ['Hire date', profileDate(employee.hireDate, language)],
    ['Employment type', ({ FULL_TIME: tr('Toàn thời gian', 'Full time'), PART_TIME: tr('Bán thời gian', 'Part time'), CONTRACT: tr('Hợp đồng', 'Contract'), INTERN: tr('Thực tập', 'Internship') } as Record<string, string>)[employee.employmentType || ''] || employee.employmentType || '—'],
    ['Address', employee.address || '—'],
  );

  return <AppShell breadcrumb={['My Workspace', mode === 'profile' ? 'My Profile' : 'Employee Dashboard']}>
    <SectionHeader title={mode === 'profile' ? t('My Profile') : `${tr('Xin chào', 'Hello')}, ${employee?.fullName || account?.fullName || user.name}!`} description={mode === 'profile' ? t('Your account information and personal workspace.') : `${new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())} • ${t(user.role)}`}>
      {mode === 'dashboard' && <Link to="/my-attendance" className="inline-flex items-center justify-center gap-2 rounded-md bg-orange-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"><Clock3 size={18} aria-hidden="true" />{tr('Xem chấm công', 'View attendance')}</Link>}
    </SectionHeader>
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 flex-wrap items-center gap-3"><h2 className="font-bold text-slate-900">{account?.fullName || user.name}</h2>{mode === 'profile' && account && [['Account status', account.status]].map(([label, value]) => <span key={label} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${value === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}><span aria-hidden="true" className={`size-1.5 rounded-full ${value === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-500'}`} />{t(label)}: {t(statuses[value] || value)}</span>)}</div><Button variant="secondary" disabled={loading} onClick={() => setReload(value => value + 1)}>{t('Reload my information')}</Button></div>
      {loading && <p role="status" className="mt-4 text-sm text-slate-500">{t('Loading your account...')}</p>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{t(error)}</p>}
      {account && <dl className={mode === 'dashboard' ? 'mt-5 grid gap-5 md:grid-cols-3' : 'mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'}>{items.map(([label, value]) => <div key={label} className={`min-w-0 rounded-xl bg-slate-50 p-4 ${label === 'Address' ? 'sm:col-span-2' : ''}`}><dt className="text-sm text-slate-600">{label === 'Address' ? tr('Địa chỉ', 'Address') : t(label)}</dt><dd className="mt-2 break-words font-semibold text-slate-900">{label === 'Account status' ? <span className={'inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ' + (account.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700')}><span aria-hidden="true" className={'size-1.5 rounded-full ' + (account.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-500')} />{value}</span> : value}</dd></div>)}</dl>}
      {data?.profileState === 'unlinked' && <p className="mt-5 rounded-xl bg-orange-50 p-4 text-sm text-orange-800">{t('Your account has no linked employee profile. Please contact HR.')}</p>}
      {mode === 'profile' && data?.profileState === 'unavailable' && <p className="mt-5 text-sm leading-6 text-slate-500">{t('Your account information is shown above. Additional employee details are currently unavailable for this account.')}</p>}
    </Card>
    {mode === 'profile' && data?.profileState === 'available' && <EmployeeApiHistory own initialEducations={employee?.educations} />}
    <div className={mode === 'dashboard' ? 'mt-5 grid auto-rows-fr grid-cols-1 gap-5 md:grid-cols-2' : 'mt-5 grid gap-4 sm:grid-cols-2'}>
      {(mode === 'profile' ? [{ to: '/forgot-password', label: tr('Đổi mật khẩu & Bảo mật', 'Password & security'), description: tr('Đặt lại mật khẩu qua mã xác thực email.', 'Reset your password using email verification.'), icon: ShieldCheck }, { to: '/my-attendance', label: t('My Attendance'), description: tr('Xem hồ sơ chấm công của bạn.', 'View your attendance records.'), icon: Clock3 }] : [{ to: '/my-profile', label: t('My Profile'), description: t('View your account and available employee information.'), icon: IdCard }, { to: '/my-attendance', label: t('My Attendance'), description: tr('Xem hồ sơ chấm công của bạn.', 'View your attendance records.'), icon: Clock3 }, { to: '/my-requests', label: tr('Đơn từ & Nghỉ phép', 'Requests & leave'), description: tr('Tạo và theo dõi trạng thái đơn xin nghỉ phép.', 'Create and track leave requests.'), icon: ClipboardList }]).map(item => <Link key={item.to} to={item.to} className="group flex h-full cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-slate-900 shadow-sm transition-all hover:border-orange-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-orange-500"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600"><item.icon aria-hidden="true" size={21} /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h2 className="font-semibold">{item.label}</h2>{mode === 'dashboard' && <ChevronRight size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />}</div><p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p></div></Link>)}
      {mode === 'dashboard' && <EmployeeQuickStats key={user.email} reload={reload} />}
    </div>
  </AppShell>;
}
