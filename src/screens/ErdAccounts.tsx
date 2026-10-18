import { useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { useErd } from '../erd/useErd';
import { makeRow, transactDatabase } from '../erd/database';
import { recordAudit } from '../workflows/audit';
import { ROLE_USERS } from '../context/RoleContext';
export default function ErdAccounts() {
  const db = useErd();
  const [editing,setEditing] = useState<string | null>(null);
  const [draft,setDraft] = useState({ email:'',role_id:db.role[0].id,employee_id:'',status:'Active' });
  const [error,setError] = useState('');
  const [query,setQuery] = useState('');
  const fixed = editing && ROLE_USERS.some(user => user.email === db.users.find(row => row.id === editing)?.email);
  const control = 'mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm';
  const save = () => {
    try {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) throw new Error('Email is invalid.');
      const before = db.users.find(row => row.id === editing);
      if (fixed && (draft.email !== before?.email || draft.role_id !== before?.role_id)) throw new Error('The four login actors are fixed.');
      const row = makeRow('users',{ ...before,...draft,employee_id:draft.employee_id || null,...(editing ? { id:editing } : {}) });
      transactDatabase(next => { if (editing) next.users=next.users.map(item => item.id === editing ? row:item);else next.users.push(row); });
      recordAudit('USERS',row.id,editing ? 'Update account record':'Create account record',before,row);
      setEditing(null);setDraft({ email:'',role_id:db.role[0].id,employee_id:'',status:'Active' });setError('');
    } catch (cause) { setError((cause as Error).message); }
  };
  return <AppShell breadcrumb={['Access Control','Users']}><SectionHeader title="Tài khoản và liên kết nhân viên" description="Tài khoản tham chiếu ROLE và có thể liên kết EMPLOYEES. Giữ nguyên bốn actor login; không nhập hoặc lưu mật khẩu trong frontend." />
    <Card className="mb-5 p-6"><form onSubmit={event => { event.preventDefault();save(); }}><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm text-slate-600">Email<input required type="email" disabled={Boolean(fixed)} className={control} value={draft.email} onChange={event => setDraft({ ...draft,email:event.target.value })} /></label><label className="text-sm text-slate-600">Vai trò<select disabled={Boolean(fixed)} className={control} value={draft.role_id} onChange={event => setDraft({ ...draft,role_id:event.target.value })}>{db.role.map(row => <option key={row.id} value={row.id}>{String(row.name)}</option>)}</select></label><label className="text-sm text-slate-600">Nhân viên liên kết<select className={control} value={draft.employee_id} onChange={event => setDraft({ ...draft,employee_id:event.target.value })}><option value="">Không liên kết</option>{db.employees.map(row => <option key={row.id} value={row.id}>{String(row.employee_code)} · {String(row.full_name)}</option>)}</select></label><label className="text-sm text-slate-600">Trạng thái<select className={control} value={draft.status} onChange={event => setDraft({ ...draft,status:event.target.value })}>{['Active','Inactive','Deleted'].filter(value => !fixed || value !== 'Deleted').map(value => <option key={value}>{value}</option>)}</select></label></div>{error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}<div className="mt-4 flex gap-3"><Button type="submit">{editing ? 'Lưu thay đổi':'Thêm tài khoản'}</Button>{editing && <Button type="button" variant="secondary" onClick={() => { setEditing(null);setDraft({ email:'',role_id:db.role[0].id,employee_id:'',status:'Active' }); }}>Hủy</Button>}</div><p className="mt-4 text-xs text-slate-500">Đây là bản ghi quản trị trong môi trường local. Đăng nhập thật vẫn cần backend xác thực và phân quyền.</p></form></Card>
    <Card className="overflow-x-auto p-5"><label className="text-sm text-slate-600">Tìm tài khoản<input className={control} value={query} onChange={event => setQuery(event.target.value)} /></label><table className="mt-5 w-full text-left text-sm"><thead><tr className="border-b text-slate-500">{['Email','Role','Nhân viên','Trạng thái','Thao tác'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{db.users.filter(row => String(row.email).toLowerCase().includes(query.toLowerCase())).map(row => <tr key={row.id} className="border-b border-slate-100"><td className="p-3">{String(row.email)}</td><td className="p-3">{String(db.role.find(role => role.id === row.role_id)?.name)}</td><td className="p-3">{String(db.employees.find(employee => employee.id === row.employee_id)?.full_name || '—')}</td><td className="p-3">{String(row.status)}</td><td className="p-3"><Button size="sm" variant="secondary" onClick={() => { setEditing(row.id);setDraft({ email:String(row.email),role_id:String(row.role_id),employee_id:String(row.employee_id || ''),status:String(row.status) }); }}>Xem / sửa</Button></td></tr>)}</tbody></table></Card>
  </AppShell>;
}
