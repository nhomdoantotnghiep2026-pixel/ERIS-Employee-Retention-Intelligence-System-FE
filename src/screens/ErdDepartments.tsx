import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { createDepartment, getApiErrorMessage, getDepartmentById, listDepartments, updateDepartment, type ApiDepartment } from '../services/api';

const control = 'mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm';

export default function ErdDepartments() {
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  const [selected, setSelected] = useState<ApiDepartment | null>(null);
  const [editing, setEditing] = useState<ApiDepartment | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ code: '', name: '', description: '' });

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const result = await listDepartments(undefined, { page, limit: 10, search: query });
      setDepartments(result.data);
      setHasMore(Boolean(result.pagination?.has_more));
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Không tải được danh sách phòng ban. Vui lòng thử lại.'));
    } finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, [page, query]);

  function resetForm() {
    setEditing(null);
    setForm({ code: '', name: '', description: '' });
  }

  function startEdit(department: ApiDepartment) {
    setSelected(null);
    setEditing(department);
    setForm({ code: department.code || '', name: department.name, description: department.description || '' });
    setError('');
    setMessage('');
  }

  async function viewDetails(department: ApiDepartment) {
    setError('');
    setMessage('');
    try {
      const result = await getDepartmentById(department.id);
      setSelected(result);
      setEditing(null);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Không tải được thông tin phòng ban. Vui lòng thử lại.'));
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!form.name.trim()) { setError('Vui lòng nhập tên phòng ban.'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateDepartment(editing.id, { name: form.name.trim(), description: form.description.trim() || null });
        setMessage('Đã cập nhật phòng ban.');
      } else {
        await createDepartment({ name: form.name.trim(), description: form.description.trim() || null });
        setMessage('Đã tạo phòng ban.');
      }
      resetForm();
      setPage(1);
      await refresh();
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Không thể lưu phòng ban. Vui lòng kiểm tra thông tin và thử lại.'));
    } finally { setSaving(false); }
  }

  return <AppShell breadcrumb={['Quản trị dữ liệu', 'Phòng ban']}>
    <SectionHeader title="Quản lý phòng ban" description="Quản lý danh mục phòng ban dùng chung trong hệ thống." />
    <Card className="mb-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-bold text-slate-900">Danh sách phòng ban</h2><p className="mt-1 text-xs text-slate-500">Tìm kiếm và xem thông tin phòng ban</p></div>
        <Button variant="secondary" onClick={() => { resetForm(); setSelected(null); }}>Thêm phòng ban</Button>
      </div>
      <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={event => { event.preventDefault(); setPage(1); setQuery(searchInput.trim()); }}>
        <input className={control.replace('mt-2 ', '')} value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Tìm theo mã hoặc tên phòng ban..." aria-label="Tìm phòng ban" />
        <Button type="submit">Tìm kiếm</Button>
      </form>
      {loading && <p className="mt-4 text-sm text-slate-500">Đang tải danh sách...</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
      {!loading && <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Mã phòng ban</th><th className="p-3">Tên phòng ban</th><th className="p-3">Mô tả</th><th className="p-3">Thao tác</th></tr></thead><tbody>{departments.map(department => <tr key={department.id} className="border-b border-slate-100"><td className="p-3 font-mono text-xs">{department.code || '—'}</td><td className="p-3 font-semibold text-slate-800">{department.name}</td><td className="max-w-sm p-3 text-slate-600">{department.description || '—'}</td><td className="flex flex-wrap gap-2 p-3"><Button size="sm" variant="secondary" onClick={() => void viewDetails(department)}>Xem chi tiết</Button><Button size="sm" variant="secondary" onClick={() => startEdit(department)}>Chỉnh sửa</Button></td></tr>)}</tbody></table>{!departments.length && <p className="py-6 text-center text-sm text-slate-500">Không tìm thấy phòng ban.</p>}<div className="mt-4 flex justify-end gap-2"><Button type="button" size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage(current => current - 1)}>Trước</Button><span className="flex items-center px-2 text-sm text-slate-500">Trang {page}</span><Button type="button" size="sm" variant="secondary" disabled={!hasMore || loading} onClick={() => setPage(current => current + 1)}>Sau</Button></div></div>}
    </Card>
    {selected && <Card className="mb-5 border border-orange-100 p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="font-bold text-slate-900">Chi tiết phòng ban</h2><p className="mt-1 text-sm text-slate-500">Thông tin phòng ban được chọn</p></div><Button size="sm" variant="secondary" onClick={() => setSelected(null)}>Đóng</Button></div><dl className="mt-5 grid gap-4 sm:grid-cols-3"><div><dt className="text-xs text-slate-500">Mã phòng ban</dt><dd className="mt-1 font-semibold text-slate-800">{selected.code || '—'}</dd></div><div><dt className="text-xs text-slate-500">Tên phòng ban</dt><dd className="mt-1 font-semibold text-slate-800">{selected.name}</dd></div><div><dt className="text-xs text-slate-500">Trạng thái</dt><dd className="mt-1 font-semibold text-slate-800">{selected.status || '—'}</dd></div><div className="sm:col-span-3"><dt className="text-xs text-slate-500">Mô tả</dt><dd className="mt-1 text-sm text-slate-700">{selected.description || 'Chưa có mô tả.'}</dd></div></dl></Card>}
    <Card className="p-6"><h2 className="font-bold text-slate-900">{editing ? `Chỉnh sửa: ${editing.name}` : 'Thêm phòng ban'}</h2><form className="mt-4 grid gap-4 sm:grid-cols-3" onSubmit={submit}><label className="text-sm text-slate-600">Mã phòng ban<input className={control} value={form.code} onChange={event => setForm(current => ({ ...current, code: event.target.value }))} placeholder="VD: DEPT-HR" maxLength={50} /></label><label className="text-sm text-slate-600">Tên phòng ban<input required className={control} value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="Nhập tên phòng ban" maxLength={150} /></label><label className="text-sm text-slate-600">Mô tả<input className={control} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="Mô tả ngắn (không bắt buộc)" maxLength={5000} /></label><div className="flex items-end gap-2 sm:col-span-3"><Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo phòng ban'}</Button>{editing && <Button type="button" variant="secondary" onClick={resetForm}>Hủy</Button>}</div></form></Card>
  </AppShell>;
}
