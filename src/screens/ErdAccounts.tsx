import { RefreshCw } from 'lucide-react';
import { Button as AccountButton } from '../components/ui/button';
import { useEffect, useRef, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Button, Card, ConfirmationDialog, SectionHeader } from '../components/ui';
import { ApiError, createUser, getApiErrorMessage, getUserById, listUsers, updateUserStatus, type ApiUser } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAutoDismissFeedback } from '../hooks/useAutoDismissState';

const CREATE_ROLE_OPTIONS = [{ id: 2, name: 'HR' }];
const control = 'mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm';

export default function ErdAccounts() {
  const { t } = useLanguage();
  const roleLabel = (role?: ApiUser['role'], id?: number) => {
    const name = typeof role === 'string' ? role : role?.name;
    const labels: Record<string, string> = { ADMIN: 'System Administrator', HR: 'HR', EMPLOYEE: 'Employee / ESS', ANALYST: 'Data / AI Analyst' };
    return t(labels[name || ''] || name || 'Role') + (!name && id ? ` #${id}` : '');
  };
  const statusLabel = (status: string) => t(({ ACTIVE: 'Active', INACTIVE: 'Inactive', IN_PROCESS: 'In process' } as Record<string, string>)[status] || status);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [query, setQuery] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [hireDate, setHireDate] = useState('');
  const [roleId, setRoleId] = useState(2);
  const [editing, setEditing] = useState<ApiUser | null>(null);
  const [confirmLock, setConfirmLock] = useState<{ user: ApiUser; fromEdit: boolean } | null>(null);
  const [details, setDetails] = useState<ApiUser | null>(null);
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [directoryUnavailable, setDirectoryUnavailable] = useState(false);
  const { error, message, setError, setMessage } = useAutoDismissFeedback();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [filterRoleId, setFilterRoleId] = useState<number | undefined>();
  const [filterStatus, setFilterStatus] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, hasMore: false });
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const listRevision = useRef(0);
  const listRequest = useRef<AbortController | null>(null);
  const editPanel = useRef<HTMLDivElement>(null);
  const detailsPanel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) editPanel.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [editing]);

  useEffect(() => {
    if (details) detailsPanel.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [details]);

  async function refreshUsers() {
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    const revision = ++listRevision.current;
    setLoading(true);
    setError('');
    try {
      const result = await listUsers({ page, limit: 10, search: query, roleId: filterRoleId, status: filterStatus || undefined }, controller.signal);
      if (revision !== listRevision.current) return;
      setDirectoryUnavailable(false);
      setUsers(result.data);
      setPagination(result.pagination);
    }
    catch (cause) { if (!controller.signal.aborted && revision === listRevision.current) { setUsers([]); setDirectoryUnavailable(cause instanceof ApiError && cause.code === 'USER_DIRECTORY_UNAVAILABLE'); setError(getApiErrorMessage(cause, 'Không tải được danh sách tài khoản. Vui lòng thử tải lại.')); } }
    finally { if (revision === listRevision.current) setLoading(false); }
  }

  useEffect(() => { void refreshUsers(); return () => { listRevision.current++; listRequest.current?.abort(); }; }, [page, query, filterRoleId, filterStatus]);

  function openCreate() {
    setShowCreate(true);
    setError('');
    setMessage('');
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    if (!fullName.trim()) { setError(t('Please enter a full name.')); return; }
    setBusy(true); setError(''); setMessage('');
    try { const created = await createUser({ email: email.trim(), fullName: fullName.trim(), hireDate, roleId }); setDetails(created); setEmail(''); setFullName(''); setHireDate(''); setShowCreate(false); if (!directoryUnavailable) await refreshUsers(); if (created.emailDelivery === 'FAILED') setError('Đã tạo tài khoản nhưng không gửi được email. Không tạo lại tài khoản; vui lòng liên hệ quản trị viên.'); else setMessage('Đã tạo tài khoản HR.'); }
    catch (cause) { setError(getApiErrorMessage(cause, 'Tạo tài khoản thất bại. Vui lòng kiểm tra thông tin và thử lại.')); }
    finally { setBusy(false); }
  }

  const isHr = (user: ApiUser) => (typeof user.role === 'string' ? user.role : user.role?.name) === 'HR';
  function openEdit(user: ApiUser) { if (!isHr(user)) return; setEditing(user); setEditStatus(user.status); setError(''); setMessage(''); }

  async function viewDetails(user: ApiUser) {
    setError(''); setMessage('');
    try { setDetails(await getUserById(user.id)); }
    catch (cause) { setError(getApiErrorMessage(cause, 'Không tải được chi tiết tài khoản. Vui lòng thử lại.')); }
  }

  async function handleEdit(event: React.FormEvent) {
    event.preventDefault(); if (!editing || busy) return;
    if (editStatus === 'INACTIVE' && editing.status !== 'INACTIVE') {
      setConfirmLock({ user: editing, fromEdit: true });
      return;
    }
    await saveEditing();
  }

  async function saveEditing() {
    if (!editing || busy || !isHr(editing)) return;
    setBusy(true);
    setError(''); setMessage('');
    try {
      if (editStatus === editing.status) { setEditing(null); return; }
      const updated = await updateUserStatus(editing.id, editStatus);
      if (details?.id === updated.id) setDetails(updated);
      setEditing(null);
      setMessage('Đã cập nhật tài khoản.');
      await refreshUsers();
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Cập nhật tài khoản thất bại. Vui lòng thử lại.'));
    } finally { setBusy(false); }
  }

  async function deactivate(user: ApiUser) {
    if (busy || !isHr(user) || user.status === 'INACTIVE') return;
    setError(''); setMessage('');
    setConfirmLock({ user, fromEdit: false });
  }

  async function confirmDeactivation() {
    if (!confirmLock || busy) return;
    if (confirmLock.fromEdit) {
      setConfirmLock(null);
      await saveEditing();
      return;
    }
    setBusy(true);
    setError(''); setMessage('');
    try { await updateUserStatus(confirmLock.user.id, 'INACTIVE'); setMessage('Đã khóa tài khoản.'); await refreshUsers(); }
    catch (cause) { setError(getApiErrorMessage(cause, 'Không thể khóa tài khoản. Vui lòng thử lại.')); }
    finally { setConfirmLock(null); setBusy(false); }
  }

  return <AppShell breadcrumb={['Access Control', 'Users']}>
    <SectionHeader title="Tài khoản và liên kết nhân viên" description="Quản lý thông tin tài khoản, phân quyền và trạng thái truy cập hệ thống." />
    {details && <div ref={detailsPanel} className="mb-5 scroll-mt-24"><Card className="border border-orange-100 p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="font-bold text-slate-900">{t("Chi tiết tài khoản")}</h2><p className="mt-1 text-sm text-slate-500">{t("Account information returned by the backend.")}</p></div><Button size="sm" variant="secondary" onClick={() => setDetails(null)}>{t("Đóng")}</Button></div><dl className="mt-5 grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]"><div><dt className="text-xs text-slate-500">Email</dt><dd className="mt-1 break-all font-semibold text-slate-800">{details.email}</dd></div><div><dt className="text-xs text-slate-500">{t("Role")}</dt><dd className="mt-1 font-semibold text-slate-800">{roleLabel(details.role, details.roleId)}</dd></div><div><dt className="text-xs text-slate-500">{t("Trạng thái")}</dt><dd className="mt-1 font-semibold text-slate-800">{statusLabel(details.status)}</dd></div></dl></Card></div>}
    {editing && <div ref={editPanel} className="mb-5 scroll-mt-24"><Card className="p-6"><h2 className="font-bold text-slate-900">{t("Chỉnh sửa:")}{editing.email}</h2><form onSubmit={handleEdit} className="mt-4 grid gap-4 sm:grid-cols-3"><label className="text-sm text-slate-600">{t("Vai trò")}<input className={control} value={roleLabel(editing.role, editing.roleId)} readOnly /></label><label className="text-sm text-slate-600">{t("Trạng thái")}<select className={control} value={editStatus} onChange={event => setEditStatus(event.target.value)}><option value={editing.status}>{statusLabel(editing.status)}</option>{editing.status !== 'INACTIVE' && <option value="INACTIVE">{t("INACTIVE — Khóa tài khoản")}</option>}</select><span className="mt-1 block text-xs text-slate-500">{t("Theo API UM-04, chỉ hỗ trợ khóa tài khoản sang INACTIVE; không hỗ trợ unlock.")}</span></label><div className="flex items-end gap-2"><Button type="submit" disabled={busy}>{t("Lưu")}</Button><Button type="button" variant="secondary" onClick={() => setEditing(null)}>{t("Hủy")}</Button></div></form></Card></div>}
    <Card className="mb-5 p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">{t("Tài khoản trong hệ thống")}</h2><p className="mt-1 text-sm text-slate-600">{t("Quản lý danh sách tài khoản và quyền truy cập")}</p></div><div className="flex items-center gap-3">{!directoryUnavailable && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{t("{count} accounts", { count: pagination.total })}</span>}<Button type="button" onClick={openCreate}>{t("Tạo tài khoản")}</Button></div></div>
      <form className="my-4" onSubmit={event => { event.preventDefault(); if (page === 1 && query === searchInput.trim()) void refreshUsers(); else { setPage(1); setQuery(searchInput.trim()); } }}><fieldset disabled={loading || busy} className="grid gap-3 items-center sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_180px_180px_auto] disabled:opacity-60"><input disabled={directoryUnavailable} className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-orange-200" value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder={t("Tìm theo email hoặc họ tên...")} /><select disabled={directoryUnavailable} className={control.replace('mt-2 ', '')} value={filterRoleId ?? ''} onChange={event => { setFilterRoleId(event.target.value ? Number(event.target.value) : undefined); setPage(1); }}><option value="">{t("Tất cả vai trò")}</option><option value="1">{roleLabel("ADMIN")}</option><option value="2">{roleLabel("HR")}</option><option value="3">{roleLabel("EMPLOYEE")}</option></select><select disabled={directoryUnavailable} className={control.replace('mt-2 ', '')} value={filterStatus} onChange={event => { setFilterStatus(event.target.value); setPage(1); }}><option value="">{t("Tất cả trạng thái")}</option><option value="ACTIVE">{statusLabel("ACTIVE")}</option><option value="INACTIVE">{statusLabel("INACTIVE")}</option></select><div className="flex items-center gap-2 sm:col-span-2 xl:col-span-1"><AccountButton type="submit" variant="outline" className="h-12 rounded-lg border-orange-500 bg-orange-500 px-5 text-sm font-bold text-white hover:border-orange-600 hover:bg-orange-600" disabled={busy || directoryUnavailable}>{t("Tìm kiếm")}</AccountButton><AccountButton type="button" variant="outline" title={t("Retry account directory")} className="h-12 gap-2 rounded-lg border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50" disabled={loading || busy} onClick={() => void refreshUsers()}><RefreshCw aria-hidden="true" className="size-4" />{t("Tải lại")}</AccountButton></div></fieldset></form>
      {loading && <p className="mt-4 text-sm text-slate-500">{t("Đang tải...")}</p>}{error && !showCreate && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{t(error)}</p>}{message && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{t(message)}</p>}
      {!loading && !error && !directoryUnavailable && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1200px] table-fixed text-left text-sm"><colgroup><col className="w-[28%]" /><col className="w-[18%]" /><col className="w-[17%]" /><col className="w-[12%]" /><col className="w-[25%]" /></colgroup><thead><tr className="border-b text-slate-500"><th className="px-6 py-3 break-words [overflow-wrap:anywhere]">Email</th><th className="px-6 py-3 break-words [overflow-wrap:anywhere]">{t("Họ tên")}</th><th className="px-6 py-3 break-words [overflow-wrap:anywhere]">{t("Role")}</th><th className="px-6 py-3 break-words [overflow-wrap:anywhere]">{t("Trạng thái")}</th><th className="px-6 py-3">{t("Thao tác")}</th></tr></thead><tbody>{users.map(user => <tr key={user.id} className="border-b border-slate-100"><td className="px-6 py-3 break-words [overflow-wrap:anywhere]">{user.email}</td><td className="px-6 py-3 break-words [overflow-wrap:anywhere]">{user.fullName || '—'}</td><td className="px-6 py-3 break-words [overflow-wrap:anywhere]">{roleLabel(user.role, user.roleId)}</td><td className="px-6 py-3 break-words [overflow-wrap:anywhere]"><span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${user.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : user.status === 'INACTIVE' ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-800'}`}><span aria-hidden="true" className={`size-1.5 rounded-full ${user.status === 'ACTIVE' ? 'bg-emerald-500' : user.status === 'INACTIVE' ? 'bg-slate-500' : 'bg-amber-500'}`} />{statusLabel(user.status)}</span></td><td className="px-6 py-3"><div className="flex items-center justify-start gap-2 whitespace-nowrap"><AccountButton size="sm" variant="outline" className="h-auto rounded-lg border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50" onClick={() => void viewDetails(user)}>{t("Xem chi tiết")}</AccountButton><AccountButton size="sm" variant="outline" className="h-auto rounded-lg border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-orange-300 hover:bg-white hover:text-orange-600 disabled:cursor-not-allowed disabled:pointer-events-auto disabled:opacity-45" disabled={!isHr(user) || busy} onClick={() => openEdit(user)}>{t("Chỉnh sửa")}</AccountButton><AccountButton size="sm" variant="outline" className="h-auto rounded-lg border-red-100 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 hover:text-red-700 disabled:cursor-not-allowed disabled:pointer-events-auto disabled:opacity-45" disabled={!isHr(user) || user.status === 'INACTIVE' || busy} onClick={() => void deactivate(user)}>{t("Khóa")}</AccountButton></div></td></tr>)}</tbody></table>{!users.length && <p className="py-5 text-sm text-slate-500">{t("Không tìm thấy tài khoản.")}</p>}<div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"><span>{t("Account page {page} · {total} accounts", { page: pagination.page, total: pagination.total })}</span><div className="flex gap-2"><AccountButton type="button" variant="outline" className="h-10 rounded-lg border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" disabled={page <= 1 || loading} onClick={() => setPage(current => current - 1)}>{t("Trước")}</AccountButton><AccountButton type="button" variant="outline" className="h-10 rounded-lg border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" disabled={!pagination.hasMore || loading} onClick={() => setPage(current => current + 1)}>{t("Next account page")}</AccountButton></div></div></div>}
    </Card>
    {showCreate && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-labelledby="create-hr-title" onMouseDown={event => { if (!busy && event.target === event.currentTarget) setShowCreate(false); }}><Card className="w-full max-w-2xl p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 id="create-hr-title" className="font-bold text-slate-900">{t("Thêm tài khoản HR")}</h2><Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => setShowCreate(false)}>{t("Đóng")}</Button></div>{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{t(error)}</p>}<form onSubmit={handleCreate} className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm text-slate-600">{t("Full name")}<input required maxLength={150} className={control} value={fullName} onChange={event => setFullName(event.target.value)} /></label><label className="text-sm text-slate-600">{t("Hire date")}<input required type="date" className={control} value={hireDate} onChange={event => setHireDate(event.target.value)} /></label><label className="text-sm text-slate-600">Email<input required type="email" className={control} value={email} onChange={event => setEmail(event.target.value)} /></label><label className="text-sm text-slate-600">{t("Vai trò")}<select className={control} value={roleId} onChange={event => setRoleId(Number(event.target.value))}>{CREATE_ROLE_OPTIONS.map(role => <option key={role.id} value={role.id}>{roleLabel(role.name)}</option>)}</select></label><div className="flex items-end"><Button type="submit" disabled={busy}>{t("Thêm tài khoản")}</Button></div></form><p className="mt-3 text-xs text-slate-500">{t("Mật khẩu tạm sẽ được gửi qua email.")}</p></Card></div>}<ConfirmationDialog open={Boolean(confirmLock)} title="Lock account" description={t('Lock account {email}? The user will no longer be able to sign in.', { email: confirmLock?.user.email || '' })} confirmLabel="Lock" tone="danger" onConfirm={() => void confirmDeactivation()} onCancel={() => setConfirmLock(null)} />
  </AppShell>;
}
