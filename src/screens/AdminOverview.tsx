import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, RefreshCw, Settings, Users } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Card, SectionHeader } from '../components/ui';
import { Button } from '../components/ui/button';
import { useLanguage } from '../context/LanguageContext';
import { listAuditLogs, listUsers, type ApiUserListResponse, type AuditLogEntry } from '../services/api';
import { auditDateMatches } from '../utils/auditDateFilter';
import { employeeDate } from '../utils/employeeDates';

type Source<T> = { data: T | null; failed: boolean };
type Directory = { page: ApiUserListResponse; active: number; inactive: number; pending: number };
const modules = [
  { label: 'Users Management', to: '/users', icon: Users, vi: 'Xem tài khoản, tạo tài khoản HR và quản lý trạng thái theo quyền được cấp.', en: 'View accounts, create HR accounts and manage permitted account statuses.' },
  { label: 'System Configuration', to: '/system', icon: Settings, vi: 'Thiết lập ứng dụng, bảo mật, báo cáo và thông báo. Lưu trên thiết bị này.', en: 'Application, security, reporting and notification preferences. Saved on this device.' },
  { label: 'Activity Logs', to: '/activity', icon: Activity, vi: 'Tra cứu thao tác đã ghi nhận, người thực hiện và chi tiết thay đổi.', en: 'Review recorded actions, their actors and change details.' },
];
export default function AdminOverview() {
  const { t, language } = useLanguage();
  const tr = (vi: string, en: string) => language === 'vi' ? vi : en;
  const [directory, setDirectory] = useState<Source<Directory>>({ data: null, failed: false });
  const [audit, setAudit] = useState<Source<AuditLogEntry[]>>({ data: null, failed: false });
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setLoading(true); setDirectory({ data: null, failed: false }); setAudit({ data: null, failed: false });
    const accounts = Promise.all([
      listUsers({ limit: 5 }, controller.signal), listUsers({ limit: 1, status: 'ACTIVE' }, controller.signal),
      listUsers({ limit: 1, status: 'INACTIVE' }, controller.signal), listUsers({ limit: 1, status: 'IN_PROCESS' }, controller.signal),
    ]).then(([page, active, inactive, pending]) => { if (!disposed) setDirectory({ data: { page, active: active.pagination.total, inactive: inactive.pagination.total, pending: pending.pagination.total }, failed: false }); })
      .catch(() => { if (!disposed) setDirectory({ data: null, failed: true }); });
    const logs = listAuditLogs(controller.signal).then(result => { if (!disposed) setAudit({ data: result.data, failed: false }); })
      .catch(() => { if (!disposed) setAudit({ data: null, failed: true }); });
    void Promise.all([accounts, logs]).finally(() => { window.clearTimeout(timeout); if (!disposed) setLoading(false); });
    return () => { disposed = true; window.clearTimeout(timeout); controller.abort(); };
  }, [revision]);
  const today = employeeDate(new Date().toISOString()) || '';
  const todayCount = audit.data?.filter(entry => auditDateMatches(entry.createdAt, today, today)).length;
  const recent = [...(audit.data || [])].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) || b.id - a.id).slice(0, 5);
  const roleName = (role: string) => ({ ADMIN: t('System Administrator'), HR: t('HR'), EMPLOYEE: t('Employee / ESS') })[role.toUpperCase()] || tr('Chưa xác định', 'Unknown');
  const statusName = (status: string) => ({ ACTIVE: t('Active'), INACTIVE: t('Inactive'), IN_PROCESS: t('In process') })[status] || tr('Chưa xác định', 'Unknown');
  const unavailable = <p role="status" className="py-5 text-sm leading-6 text-slate-600">{tr('Chưa tải được dữ liệu. Vui lòng làm mới hoặc mở trang quản lý để kiểm tra.', 'Data could not be loaded. Refresh or open the management page to check.')}</p>;
  return <AppShell breadcrumb={['Admin Overview']}>
    <SectionHeader title={t('Admin Overview')} description={tr('Tổng hợp tài khoản, cấu hình và hoạt động quản trị của ERIS.', 'An overview of ERIS accounts, settings and administrative activity.')}>
      <Button variant="outline" className="h-10 gap-2" disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw aria-hidden="true" className={loading ? 'size-4 animate-spin motion-reduce:animate-none' : 'size-4'} />{t('Refresh')}</Button>
    </SectionHeader>
    <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
      { label: t('Total Users'), value: directory.data?.page.pagination.total, detail: directory.data ? tr(`${directory.data.inactive} tài khoản không hoạt động`, `${directory.data.inactive} inactive accounts`) : tr('Danh sách tài khoản hệ thống', 'System account directory') },
      { label: tr('Tài khoản hoạt động', 'Active accounts'), value: directory.data?.active, detail: tr('Trạng thái đang hoạt động', 'Currently active status') },
      { label: tr('Chờ hoàn tất kích hoạt', 'Pending activation'), value: directory.data?.pending, detail: tr('Tài khoản đang trong quá trình kích hoạt', 'Accounts in the activation process') },
      { label: tr('Số thao tác hôm nay', 'Actions today'), value: todayCount, detail: tr('Theo ngày Việt Nam · nhật ký đã ghi nhận', 'Vietnam calendar day · recorded activity') },
    ].map(item => <Card key={item.label} className="p-5"><p className="text-sm text-slate-600">{item.label}</p><p className="mt-3 text-3xl font-semibold tabular-nums text-slate-900">{item.value ?? (loading ? '…' : '—')}</p><p className="mt-2 text-xs leading-5 text-slate-600">{item.detail}</p></Card>)}</div>
    <section aria-label={tr('Chức năng quản trị', 'Administrative functions')} className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{modules.map(module => <Link key={module.to} to={module.to} className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-orange-300 hover:bg-orange-50/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600"><module.icon aria-hidden="true" size={20} /></span><div className="min-w-0"><h2 className="text-base font-semibold text-slate-900">{t(module.label)}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{language === 'vi' ? module.vi : module.en}</p></div><ArrowRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-slate-600 group-hover:text-orange-600" /></Link>)}</section>
    <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <Card className="flex min-w-0 flex-col p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-slate-900">{t('Users')}</h2><Link className="text-sm font-medium text-orange-700 hover:underline" to="/users">{tr('Xem tất cả', 'View all')}</Link></div><p className="mt-1 text-xs leading-5 text-slate-600">{tr('Tối đa 5 tài khoản trong danh sách hiện tại.', 'Up to 5 accounts from the current directory.')}</p>{directory.failed ? unavailable : !directory.data ? <p role="status" className="py-5 text-sm text-slate-600">{tr('Đang tải…', 'Loading…')}</p> : directory.data.page.data.length === 0 ? <p className="py-5 text-sm text-slate-600">{tr('Chưa có tài khoản.', 'No accounts found.')}</p> : <ul className="mt-3 grid auto-rows-fr divide-y divide-slate-100 xl:flex-1">{directory.data.page.data.map(user => <li key={user.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">{user.fullName || user.email}</p><p className="mt-1 text-xs text-slate-600">{roleName(typeof user.role === 'string' ? user.role : user.role?.name || user.roleName || '')}</p></div><span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{statusName(user.status)}</span></li>)}</ul>}</Card>
      <Card className="flex min-w-0 flex-col overflow-hidden"><div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5"><h2 className="font-semibold text-slate-900">{t('Recent Activity')}</h2><Link className="text-sm font-medium text-orange-700 hover:underline" to="/activity">{tr('Xem nhật ký', 'View logs')}</Link></div>{audit.failed ? <div className="px-5">{unavailable}</div> : !audit.data ? <p role="status" className="p-5 text-sm text-slate-600">{tr('Đang tải…', 'Loading…')}</p> : recent.length === 0 ? <p className="p-5 text-sm text-slate-600">{tr('Chưa có hoạt động được ghi nhận.', 'No activity recorded yet.')}</p> : <div className="overflow-x-auto xl:flex-1"><table className="h-full w-full min-w-[550px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-600"><tr>{['Time', 'User', 'Activity', 'Module'].map(label => <th key={label} className="px-4 py-3 font-semibold">{t(label)}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{recent.map(entry => <tr key={entry.id}><td className="px-4 py-3 text-xs text-slate-600">{Number.isFinite(Date.parse(entry.createdAt)) ? new Date(entry.createdAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—'}</td><td className="max-w-48 break-words px-4 py-3 text-slate-900 [overflow-wrap:anywhere]">{entry.actor?.fullName || entry.actor?.email || tr('Không có thông tin', 'Unavailable')}</td><td className="px-4 py-3 text-slate-700">{({ CREATE: tr('Tạo mới', 'Create'), UPDATE: tr('Cập nhật', 'Update'), DELETE: tr('Xóa', 'Delete'), SOFT_DELETE: tr('Ngừng sử dụng', 'Deactivate') } as Record<string, string>)[entry.action || ''] || entry.action || '—'}</td><td className="px-4 py-3 text-xs text-slate-600">{t(({ employees: 'Employees', users: 'Users', departments: 'Departments', positions: 'Positions', surveys: 'Surveys', role: 'Roles & Permissions' } as Record<string, string>)[entry.entityType || ''] || entry.entityType || '—')}</td></tr>)}</tbody></table></div>}</Card>
    </div>
  </AppShell>;
}
