import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { createUser, getApiErrorMessage, getUserById, listUsers, updateUserRole, updateUserStatus, type ApiUser } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

const ROLE_OPTIONS = [{ id: 2, name: 'HR' }, { id: 3, name: 'EMPLOYEE' }];
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
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState(2);
  const [editing, setEditing] = useState<ApiUser | null>(null);
  const [details, setDetails] = useState<ApiUser | null>(null);
  const [editRoleId, setEditRoleId] = useState(2);
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function refreshUsers() {
    setLoading(true);
    try { const result = await listUsers(); setUsers(result.data); }
    catch (cause) { setError(getApiErrorMessage(cause, 'Không tải được danh sách tài khoản. Vui lòng thử tải lại.')); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refreshUsers(); }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    if (!fullName.trim()) { setError('Vui lòng nhập họ tên.'); return; }
    try { await createUser({ email: email.trim(), fullName: fullName.trim(), roleId }); setFullName(''); setEmail(''); setMessage('Đã tạo tài khoản.'); await refreshUsers(); }
    catch (cause) { setError(getApiErrorMessage(cause, 'Tạo tài khoản thất bại. Vui lòng kiểm tra thông tin và thử lại.')); }
  }

  function openEdit(user: ApiUser) { setEditing(user); setEditRoleId(user.roleId || 2); setEditStatus(user.status); setError(''); setMessage(''); }

  async function viewDetails(user: ApiUser) {
    setError(''); setMessage('');
    try { setDetails(await getUserById(user.id)); }
    catch (cause) { setError(getApiErrorMessage(cause, 'Không tải được chi tiết tài khoản. Vui lòng thử lại.')); }
  }

  async function handleEdit(event: React.FormEvent) {
    event.preventDefault(); if (!editing) return; setError(''); setMessage('');
    try { if (editRoleId !== editing.roleId) await updateUserRole(editing.id, editRoleId); if (editStatus !== editing.status) await updateUserStatus(editing.id, editStatus); setEditing(null); setMessage('Đã cập nhật tài khoản.'); await refreshUsers(); }
    catch (cause) { setError(getApiErrorMessage(cause, 'Cập nhật tài khoản thất bại. Vui lòng thử lại.')); }
  }

  async function deactivate(user: ApiUser) {
    if (!window.confirm(t('Khóa tài khoản {email}?', { email: user.email }))) return; setError(''); setMessage('');
    try { await updateUserStatus(user.id, 'INACTIVE'); setMessage('Đã khóa tài khoản.'); await refreshUsers(); }
    catch (cause) { setError(getApiErrorMessage(cause, 'Không thể khóa tài khoản. Vui lòng thử lại.')); }
  }

  const filteredUsers = users.filter(user => user.email.toLowerCase().includes(query.toLowerCase()));
  return <AppShell breadcrumb={['Access Control', 'Users']}>
    <SectionHeader title="Tài khoản và liên kết nhân viên" description="Quản lý tài khoản thật từ Backend. Không lưu mật khẩu trong frontend." />
    <Card className="mb-5 p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">{t("Tài khoản trong Backend")}</h2><p className="mt-1 text-xs text-slate-500">{t("GET /api/users · dữ liệu PostgreSQL")}</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{t("{count} accounts", { count: users.length })}</span></div>
      <input className={control} value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Tìm theo email...")} />
      {loading && <p className="mt-4 text-sm text-slate-500">{t("Đang tải...")}</p>}{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{t(error)}</p>}{message && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{t(message)}</p>}
      {!loading && <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Email</th><th className="p-3">{t("Role")}</th><th className="p-3">{t("Trạng thái")}</th><th className="p-3">{t("Thao tác")}</th></tr></thead><tbody>{filteredUsers.map(user => <tr key={user.id} className="border-b border-slate-100"><td className="p-3">{user.email}</td><td className="p-3">{roleLabel(user.role, user.roleId)}</td><td className="p-3">{statusLabel(user.status)}</td><td className="flex flex-wrap gap-2 p-3"><Button size="sm" variant="secondary" onClick={() => void viewDetails(user)}>{t("Xem chi tiết")}</Button><Button size="sm" variant="secondary" onClick={() => openEdit(user)}>{t("Chỉnh sửa")}</Button><Button size="sm" variant="secondary" onClick={() => void deactivate(user)}>{t("Khóa")}</Button></td></tr>)}</tbody></table>{!filteredUsers.length && <p className="py-5 text-sm text-slate-500">{t("Không tìm thấy tài khoản.")}</p>}</div>}
    </Card>
    {details && <Card className="mb-5 border border-orange-100 p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="font-bold text-slate-900">{t("Chi tiết tài khoản")}</h2><p className="mt-1 text-sm text-slate-500">{t("Dữ liệu lấy từ API UM-02")}</p></div><Button size="sm" variant="secondary" onClick={() => setDetails(null)}>{t("Đóng")}</Button></div><dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-xs text-slate-500">ID</dt><dd className="mt-1 font-semibold text-slate-800">{details.id}</dd></div><div><dt className="text-xs text-slate-500">Email</dt><dd className="mt-1 break-all font-semibold text-slate-800">{details.email}</dd></div><div><dt className="text-xs text-slate-500">{t("Role")}</dt><dd className="mt-1 font-semibold text-slate-800">{roleLabel(details.role, details.roleId)}</dd></div><div><dt className="text-xs text-slate-500">{t("Trạng thái")}</dt><dd className="mt-1 font-semibold text-slate-800">{statusLabel(details.status)}</dd></div></dl></Card>}
    <Card className="mb-5 p-6"><h2 className="font-bold text-slate-900">{t("Thêm tài khoản")}</h2><form onSubmit={handleCreate} className="mt-4 grid gap-4 sm:grid-cols-4"><label className="text-sm text-slate-600">{t("Họ tên")}<input required type="text" className={control} value={fullName} onChange={event => setFullName(event.target.value)} /></label><label className="text-sm text-slate-600">Email<input required type="email" className={control} value={email} onChange={event => setEmail(event.target.value)} /></label><label className="text-sm text-slate-600">{t("Vai trò")}<select className={control} value={roleId} onChange={event => setRoleId(Number(event.target.value))}>{ROLE_OPTIONS.map(role => <option key={role.id} value={role.id}>{roleLabel(role.name)}</option>)}</select></label><div className="flex items-end"><Button type="submit">{t("Thêm tài khoản")}</Button></div></form><p className="mt-3 text-xs text-slate-500">{t("Tài khoản mới bắt đầu ở trạng thái IN_PROCESS và nhận mật khẩu tạm qua email.")}</p></Card>
    {editing && <Card className="p-6"><h2 className="font-bold text-slate-900">{t("Chỉnh sửa:")} {editing.email}</h2><form onSubmit={handleEdit} className="mt-4 grid gap-4 sm:grid-cols-3"><label className="text-sm text-slate-600">{t("Vai trò")}<select className={control} value={editRoleId} onChange={event => setEditRoleId(Number(event.target.value))}>{ROLE_OPTIONS.map(role => <option key={role.id} value={role.id}>{roleLabel(role.name)}</option>)}</select></label><label className="text-sm text-slate-600">{t("Trạng thái")}<select className={control} value={editStatus} onChange={event => setEditStatus(event.target.value)}><option value={editing.status}>{statusLabel(editing.status)}</option>{editing.status !== 'INACTIVE' && <option value="INACTIVE">{t("INACTIVE — Khóa tài khoản")}</option>}</select><span className="mt-1 block text-xs text-slate-500">{t("Theo API UM-04, chỉ hỗ trợ khóa tài khoản sang INACTIVE; không hỗ trợ unlock.")}</span></label><div className="flex items-end gap-2"><Button type="submit">{t("Lưu")}</Button><Button type="button" variant="secondary" onClick={() => setEditing(null)}>{t("Hủy")}</Button></div></form></Card>}
  </AppShell>;
}
