import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { createUser, getApiErrorMessage, getUserById, listUsers, updateUserRole, updateUserStatus, type ApiUser } from '../services/api';

const ROLE_OPTIONS = [{ id: 2, name: 'HR' }, { id: 3, name: 'EMPLOYEE' }];
const control = 'mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm';

export default function ErdAccounts() {
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
    if (!window.confirm(`Khóa tài khoản ${user.email}?`)) return; setError(''); setMessage('');
    try { await updateUserStatus(user.id, 'INACTIVE'); setMessage('Đã khóa tài khoản.'); await refreshUsers(); }
    catch (cause) { setError(getApiErrorMessage(cause, 'Không thể khóa tài khoản. Vui lòng thử lại.')); }
  }

  const filteredUsers = users.filter(user => user.email.toLowerCase().includes(query.toLowerCase()));
  return <AppShell breadcrumb={['Access Control', 'Users']}>
    <SectionHeader title="Tài khoản và liên kết nhân viên" description="Quản lý tài khoản thật từ Backend. Không lưu mật khẩu trong frontend." />
    <Card className="mb-5 p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">Tài khoản trong Backend</h2><p className="mt-1 text-xs text-slate-500">GET /api/users · dữ liệu PostgreSQL</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{users.length} tài khoản</span></div>
      <input className={control} value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm theo email..." />
      {loading && <p className="mt-4 text-sm text-slate-500">Đang tải...</p>}{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
      {!loading && <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Trạng thái</th><th className="p-3">Thao tác</th></tr></thead><tbody>{filteredUsers.map(user => <tr key={user.id} className="border-b border-slate-100"><td className="p-3">{user.email}</td><td className="p-3">{typeof user.role === 'string' ? user.role : user.role?.name || `Role #${user.roleId ?? '—'}`}</td><td className="p-3">{user.status}</td><td className="flex flex-wrap gap-2 p-3"><Button size="sm" variant="secondary" onClick={() => void viewDetails(user)}>Xem chi tiết</Button><Button size="sm" variant="secondary" onClick={() => openEdit(user)}>Chỉnh sửa</Button><Button size="sm" variant="secondary" onClick={() => void deactivate(user)}>Khóa</Button></td></tr>)}</tbody></table>{!filteredUsers.length && <p className="py-5 text-sm text-slate-500">Không tìm thấy tài khoản.</p>}</div>}
    </Card>
    {details && <Card className="mb-5 border border-orange-100 p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="font-bold text-slate-900">Chi tiết tài khoản</h2><p className="mt-1 text-sm text-slate-500">Dữ liệu lấy từ API UM-02</p></div><Button size="sm" variant="secondary" onClick={() => setDetails(null)}>Đóng</Button></div><dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-xs text-slate-500">ID</dt><dd className="mt-1 font-semibold text-slate-800">{details.id}</dd></div><div><dt className="text-xs text-slate-500">Email</dt><dd className="mt-1 break-all font-semibold text-slate-800">{details.email}</dd></div><div><dt className="text-xs text-slate-500">Role</dt><dd className="mt-1 font-semibold text-slate-800">{typeof details.role === 'string' ? details.role : details.role?.name || `Role #${details.roleId ?? '—'}`}</dd></div><div><dt className="text-xs text-slate-500">Trạng thái</dt><dd className="mt-1 font-semibold text-slate-800">{details.status}</dd></div></dl></Card>}
    <Card className="mb-5 p-6"><h2 className="font-bold text-slate-900">Thêm tài khoản</h2><form onSubmit={handleCreate} className="mt-4 grid gap-4 sm:grid-cols-4"><label className="text-sm text-slate-600">Họ tên<input required type="text" className={control} value={fullName} onChange={event => setFullName(event.target.value)} /></label><label className="text-sm text-slate-600">Email<input required type="email" className={control} value={email} onChange={event => setEmail(event.target.value)} /></label><label className="text-sm text-slate-600">Vai trò<select className={control} value={roleId} onChange={event => setRoleId(Number(event.target.value))}>{ROLE_OPTIONS.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label><div className="flex items-end"><Button type="submit">Thêm tài khoản</Button></div></form><p className="mt-3 text-xs text-slate-500">Tài khoản mới bắt đầu ở trạng thái IN_PROCESS và nhận mật khẩu tạm qua email.</p></Card>
    {editing && <Card className="p-6"><h2 className="font-bold text-slate-900">Chỉnh sửa: {editing.email}</h2><form onSubmit={handleEdit} className="mt-4 grid gap-4 sm:grid-cols-3"><label className="text-sm text-slate-600">Vai trò<select className={control} value={editRoleId} onChange={event => setEditRoleId(Number(event.target.value))}>{ROLE_OPTIONS.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label><label className="text-sm text-slate-600">Trạng thái<select className={control} value={editStatus} onChange={event => setEditStatus(event.target.value)}><option value={editing.status}>{editing.status}</option>{editing.status !== 'INACTIVE' && <option value="INACTIVE">INACTIVE — Khóa tài khoản</option>}</select><span className="mt-1 block text-xs text-slate-500">Theo API UM-04, chỉ hỗ trợ khóa tài khoản sang INACTIVE; không hỗ trợ unlock.</span></label><div className="flex items-end gap-2"><Button type="submit">Lưu</Button><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Hủy</Button></div></form></Card>}
  </AppShell>;
}
