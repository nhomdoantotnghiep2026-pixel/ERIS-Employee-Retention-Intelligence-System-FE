import { useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { createUser, getApiErrorMessage, getUserById, listEmployees, listUsers, updateUserRole, updateUserStatus, type ApiEmployee, type ApiUser } from '../services/api';

const ROLE_OPTIONS = [{ id: 2, name: 'HR' }, { id: 3, name: 'EMPLOYEE' }];
const control = 'mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm';

export default function ErdAccounts() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [employees, setEmployees] = useState<ApiEmployee[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [filterRoleId, setFilterRoleId] = useState<number | undefined>();
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, hasMore: false });
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState(2);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const employeePickerRef = useRef<HTMLLabelElement>(null);
  const [editing, setEditing] = useState<ApiUser | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmLock, setConfirmLock] = useState<{ user: ApiUser; fromEdit: boolean } | null>(null);
  const [details, setDetails] = useState<ApiUser | null>(null);
  const [editRoleId, setEditRoleId] = useState(2);
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function refreshUsers() {
    setLoading(true);
    try {
      const result = await listUsers({ page, limit: 10, search: query, roleId: filterRoleId, status: filterStatus || undefined });
      setUsers(result.data);
      setPagination(result.pagination);
    }
    catch (cause) { setError(getApiErrorMessage(cause, 'Không tải được danh sách tài khoản. Vui lòng thử tải lại.')); }
    finally { setLoading(false); }
  }

  async function refreshEmployees() {
    try { const result = await listEmployees(); setEmployees(result.data); }
    catch (cause) { setError(getApiErrorMessage(cause, 'Không tải được danh sách nhân viên để liên kết.')); }
  }

  useEffect(() => { void refreshUsers(); }, [page, query, filterRoleId, filterStatus]);
  useEffect(() => { void refreshEmployees(); }, []);
  useEffect(() => {
    function closeEmployeePicker(event: PointerEvent) {
      if (!employeePickerRef.current?.contains(event.target as Node)) setEmployeePickerOpen(false);
    }
    document.addEventListener('pointerdown', closeEmployeePicker);
    return () => document.removeEventListener('pointerdown', closeEmployeePicker);
  }, []);

  const selectedEmployee = useMemo(() => employees.find(employee => employee.id === employeeId) || null, [employees, employeeId]);
  const matchingEmployees = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase();
    if (!search) return employees.slice(0, 8);
    return employees.filter(employee => [employee.full_name, employee.employee_code, employee.email]
      .some(value => value?.toLowerCase().includes(search))).slice(0, 8);
  }, [employees, employeeSearch]);

  useEffect(() => {
    if (roleId !== 3) return;
    const normalizedEmail = email.trim().toLowerCase();
    const matched = normalizedEmail ? employees.find(employee => employee.email?.trim().toLowerCase() === normalizedEmail) : null;
    if (matched) {
      setEmployeeId(matched.id);
      setEmployeeSearch(`${matched.full_name || 'Chưa có tên'} · ${matched.employee_code || `#${matched.id}`}`);
    } else if (employeeId && employees.some(employee => employee.id === employeeId && employee.email?.trim().toLowerCase() !== normalizedEmail)) {
      setEmployeeId(null);
      setEmployeeSearch('');
    }
  }, [email, employees, roleId]);

  function selectEmployee(employee: ApiEmployee) {
    setEmployeeId(employee.id);
    setEmployeeSearch(`${employee.full_name || 'Chưa có tên'} · ${employee.employee_code || `#${employee.id}`}`);
    if (employee.email) setEmail(employee.email);
    setEmployeePickerOpen(false);
  }

  function openCreate() {
    setEmail('');
    setRoleId(2);
    setEmployeeId(null);
    setEmployeeSearch('');
    setError('');
    setMessage('');
    setShowCreate(true);
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    if (roleId === 3 && !employeeId) { setError('Vui lòng chọn nhân viên liên kết khi tạo tài khoản Employee.'); return; }
    try { await createUser({ email: email.trim(), employeeId: roleId === 3 ? employeeId : null, roleId }); setEmail(''); setEmployeeId(null); setEmployeeSearch(''); setShowCreate(false); setMessage('Đã tạo tài khoản.'); setPage(1); await refreshUsers(); }
    catch (cause) { setError(getApiErrorMessage(cause, 'Tạo tài khoản thất bại. Vui lòng kiểm tra thông tin và thử lại.')); }
  }

  function openEdit(user: ApiUser) { setEditing(user); setEditRoleId(user.roleId || 2); setEditStatus(user.status); setError(''); setMessage(''); }

  async function viewDetails(user: ApiUser) {
    setError(''); setMessage('');
    try { setDetails(await getUserById(user.id)); }
    catch (cause) { setError(getApiErrorMessage(cause, 'Không tải được chi tiết tài khoản. Vui lòng thử lại.')); }
  }

  async function saveEditing() {
    if (!editing) return;
    setError(''); setMessage('');
    if (editRoleId === 3 && editRoleId !== editing.roleId && !editing.employeeId) {
      setError('Không thể đổi sang EMPLOYEE vì tài khoản chưa có nhân viên liên kết. Hãy tạo tài khoản Employee mới và chọn nhân viên liên kết.');
      return;
    }
    try { if (editRoleId !== editing.roleId) await updateUserRole(editing.id, editRoleId); if (editStatus !== editing.status) await updateUserStatus(editing.id, editStatus); setEditing(null); setMessage('Đã cập nhật tài khoản.'); await refreshUsers(); }
    catch (cause) { setError(getApiErrorMessage(cause, 'Cập nhật tài khoản thất bại. Vui lòng thử lại.')); }
  }

  async function handleEdit(event: React.FormEvent) {
    event.preventDefault(); if (!editing) return;
    if (editStatus === 'INACTIVE' && editing.status !== 'INACTIVE') {
      setConfirmLock({ user: editing, fromEdit: true });
      return;
    }
    await saveEditing();
  }

  async function deactivate(user: ApiUser) {
    setError(''); setMessage('');
    setConfirmLock({ user, fromEdit: false });
  }

  async function confirmDeactivation() {
    if (!confirmLock) return;
    if (confirmLock.fromEdit) {
      setConfirmLock(null);
      await saveEditing();
      return;
    }
    setError(''); setMessage('');
    try { await updateUserStatus(confirmLock.user.id, 'INACTIVE'); setMessage('Đã khóa tài khoản.'); await refreshUsers(); }
    catch (cause) { setError(getApiErrorMessage(cause, 'Không thể khóa tài khoản. Vui lòng thử lại.')); }
    finally { setConfirmLock(null); }
  }

  return <AppShell breadcrumb={['Access Control', 'Users']}>
    <SectionHeader title="Tài khoản và liên kết nhân viên" description="Quản lý tài khoản thật từ Backend. Không lưu mật khẩu trong frontend." />
      <Card className="mb-5 p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">Tài khoản trong hệ thống</h2><p className="mt-1 text-xs text-slate-500">Quản lý danh sách tài khoản và quyền truy cập</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{users.length} tài khoản</span><Button type="button" onClick={openCreate}>Tạo tài khoản</Button></div></div>
      <form className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_auto]" onSubmit={event => { event.preventDefault(); setPage(1); setQuery(searchInput); }}><input className={control.replace('mt-2 ', '')} value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Tìm theo email hoặc họ tên..." /><select className={control.replace('mt-2 ', '')} value={filterRoleId ?? ''} onChange={event => { setFilterRoleId(event.target.value ? Number(event.target.value) : undefined); setPage(1); }}><option value="">Tất cả role</option><option value="1">ADMIN</option><option value="2">HR</option><option value="3">EMPLOYEE</option></select><select className={control.replace('mt-2 ', '')} value={filterStatus} onChange={event => { setFilterStatus(event.target.value); setPage(1); }}><option value="">Tất cả trạng thái</option><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select><Button type="submit">Tìm kiếm</Button></form>
      {loading && <p className="mt-4 text-sm text-slate-500">Đang tải...</p>}{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
      {!loading && <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Email</th><th className="p-3">Họ tên</th><th className="p-3">Role</th><th className="p-3">Trạng thái</th><th className="p-3">Thao tác</th></tr></thead><tbody>{users.map(user => <tr key={user.id} className="border-b border-slate-100"><td className="p-3">{user.email}</td><td className="p-3">{user.fullName || '—'}</td><td className="p-3">{typeof user.role === 'string' ? user.role : user.role?.name || `Role #${user.roleId ?? '—'}`}</td><td className="p-3">{user.status}</td><td className="flex flex-wrap gap-2 p-3"><Button size="sm" variant="secondary" onClick={() => void viewDetails(user)}>Xem chi tiết</Button><Button size="sm" variant="secondary" onClick={() => openEdit(user)}>Chỉnh sửa</Button><Button size="sm" variant="secondary" onClick={() => void deactivate(user)}>Khóa</Button></td></tr>)}</tbody></table>{!users.length && <p className="py-5 text-sm text-slate-500">Không tìm thấy tài khoản.</p>}<div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-500"><span>Trang {pagination.page} · {pagination.total} tài khoản</span><div className="flex gap-2"><Button type="button" size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage(current => current - 1)}>Trước</Button><Button type="button" size="sm" variant="secondary" disabled={!pagination.hasMore || loading} onClick={() => setPage(current => current + 1)}>Sau</Button></div></div></div>}
    </Card>
    {details && <Card className="mb-5 border border-orange-100 p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="font-bold text-slate-900">Chi tiết tài khoản</h2><p className="mt-1 text-sm text-slate-500">Dữ liệu lấy từ API UM-02</p></div><Button size="sm" variant="secondary" onClick={() => setDetails(null)}>Đóng</Button></div><dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-xs text-slate-500">ID</dt><dd className="mt-1 font-semibold text-slate-800">{details.id}</dd></div><div><dt className="text-xs text-slate-500">Email</dt><dd className="mt-1 break-all font-semibold text-slate-800">{details.email}</dd></div><div><dt className="text-xs text-slate-500">Role</dt><dd className="mt-1 font-semibold text-slate-800">{typeof details.role === 'string' ? details.role : details.role?.name || `Role #${details.roleId ?? '—'}`}</dd></div><div><dt className="text-xs text-slate-500">Trạng thái</dt><dd className="mt-1 font-semibold text-slate-800">{details.status}</dd></div></dl></Card>}
    {showCreate && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowCreate(false); }}><div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="create-account-title"><div className="flex items-start justify-between gap-4"><div><h2 id="create-account-title" className="font-bold text-slate-900">Tạo tài khoản</h2><p className="mt-1 text-sm text-slate-500">Tạo tài khoản truy cập cho HR hoặc Employee.</p></div><Button type="button" size="sm" variant="secondary" onClick={() => setShowCreate(false)}>Đóng</Button></div>{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<form onSubmit={handleCreate} className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm text-slate-600">Email<input required type="email" className={control} value={email} onChange={event => setEmail(event.target.value)} placeholder="Nhập email tài khoản" /></label><label className="text-sm text-slate-600">Vai trò<select className={control} value={roleId} onChange={event => { const nextRoleId = Number(event.target.value); setRoleId(nextRoleId); if (nextRoleId !== 3) { setEmployeeId(null); setEmployeeSearch(''); } }}>{ROLE_OPTIONS.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>{roleId === 3 && <label ref={employeePickerRef} className="relative text-sm text-slate-600 sm:col-span-2">Nhân viên liên kết
        <input required value={employeeSearch} className={control} placeholder="Tìm theo tên, mã hoặc email..." aria-label="Tìm nhân viên liên kết" onFocus={() => setEmployeePickerOpen(true)} onChange={event => { setEmployeeSearch(event.target.value); setEmployeeId(null); setEmployeePickerOpen(true); }} />
        {employeePickerOpen && <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg" role="listbox">
          {matchingEmployees.length ? matchingEmployees.map(employee => <button type="button" role="option" aria-selected={employee.id === employeeId} key={employee.id} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-orange-50 focus:bg-orange-50 focus:outline-none" onMouseDown={event => event.preventDefault()} onClick={() => selectEmployee(employee)}><span className="block font-semibold text-slate-800">{employee.full_name || 'Chưa có họ tên'}</span><span className="block text-xs text-slate-500">{employee.employee_code || `#${employee.id}`}{employee.email ? ` · ${employee.email}` : ''}</span></button>) : <p className="px-3 py-3 text-xs text-slate-500">Không tìm thấy nhân viên phù hợp.</p>}
        </div>}
        {selectedEmployee && <span className="mt-1 block text-xs text-emerald-700">Đã liên kết: {selectedEmployee.full_name || 'Chưa có họ tên'} · {selectedEmployee.employee_code || `#${selectedEmployee.id}`}</span>}
        {!selectedEmployee && email.trim() && <span className="mt-1 block text-xs text-slate-500">Nhập email trùng với hồ sơ nhân viên để tự động liên kết.</span>}
      </label>}<div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Hủy</Button><Button type="submit">Tạo tài khoản</Button></div></form><p className="mt-4 text-xs text-slate-500">Tài khoản mới bắt đầu ở trạng thái IN_PROCESS và nhận mật khẩu tạm qua email.</p></div></div>}
    {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setEditing(null); }}><div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="edit-account-title"><div className="flex items-start justify-between gap-4"><div><h2 id="edit-account-title" className="font-bold text-slate-900">Chỉnh sửa tài khoản</h2><p className="mt-1 break-all text-sm text-slate-500">{editing.email}</p></div><Button type="button" size="sm" variant="secondary" onClick={() => setEditing(null)}>Đóng</Button></div><form onSubmit={handleEdit} className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm text-slate-600">Vai trò<select className={control} value={editRoleId} onChange={event => setEditRoleId(Number(event.target.value))}>{ROLE_OPTIONS.map(role => <option key={role.id} value={role.id} disabled={role.id === 3 && editing.roleId !== 3 && !editing.employeeId}>{role.name}{role.id === 3 && editing.roleId !== 3 && !editing.employeeId ? ' — cần nhân viên liên kết' : ''}</option>)}</select><span className="mt-1 block text-xs text-slate-500">Tài khoản Employee phải có nhân viên liên kết.</span></label><label className="text-sm text-slate-600">Trạng thái<select className={control} value={editStatus} onChange={event => setEditStatus(event.target.value)}><option value={editing.status}>{editing.status}</option>{editing.status !== 'INACTIVE' && <option value="INACTIVE">INACTIVE — Khóa tài khoản</option>}</select><span className="mt-1 block text-xs text-slate-500">Chỉ có thể chuyển tài khoản sang INACTIVE theo quy định hiện tại.</span></label><div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Hủy</Button><Button type="submit">Lưu thay đổi</Button></div></form></div></div>}
    {confirmLock && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4" role="presentation"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="confirm-lock-title"><h2 id="confirm-lock-title" className="text-lg font-bold text-slate-900">Xác nhận khóa tài khoản</h2><p className="mt-3 text-sm leading-6 text-slate-600">Bạn có chắc chắn muốn chuyển tài khoản <strong className="break-all text-slate-800">{confirmLock.user.email}</strong> sang trạng thái INACTIVE không?</p><p className="mt-2 text-xs text-slate-500">Tài khoản sẽ không thể đăng nhập sau khi bị khóa.</p><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setConfirmLock(null)}>Hủy</Button><Button type="button" onClick={() => void confirmDeactivation()}>Xác nhận khóa</Button></div></div></div>}
  </AppShell>;
}
