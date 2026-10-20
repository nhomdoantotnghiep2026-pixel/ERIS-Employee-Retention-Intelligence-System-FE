import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Button, Card } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { createEmployeeProfile, deactivateEmployeeProfile, getEmployeeProfile, listEmployeeProfiles, updateEmployeeProfile,
  listDepartments, listPositions, getApiErrorMessage, type EmployeeProfile, type EmployeeInput, type EmployeeChanges } from '../services/api';

const control = 'mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm focus:outline-orange-500 disabled:bg-slate-100';
type Form = { fullName: string; email: string; hireDate: string; departmentId: string; positionId: string;
  phone: string; dateOfBirth: string; gender: string; address: string; employmentType: string; currentSalary: string };
const empty: Form = { fullName: '', email: '', hireDate: '', departmentId: '', positionId: '', phone: '', dateOfBirth: '', gender: '', address: '', employmentType: '', currentSalary: '' };
const dateOnly = (value: string | null) => value?.slice(0, 10) || '';
const toForm = (value: EmployeeProfile): Form => ({
  fullName: value.fullName, email: value.email, hireDate: dateOnly(value.hireDate),
  departmentId: String(value.departmentId), positionId: String(value.positionId), phone: value.phone || '',
  dateOfBirth: dateOnly(value.dateOfBirth), gender: value.gender || '', address: value.address || '',
  employmentType: value.employmentType || '', currentSalary: value.currentSalary == null ? '' : String(value.currentSalary),
});

export default function HrEmployees() {
  const { language } = useLanguage();
  const text = (vi: string, en: string) => language === 'vi' ? vi : en;
  const navigate = useNavigate(), location = useLocation(), { id } = useParams();
  const creating = location.pathname === '/employees/new', editing = location.pathname.endsWith('/edit');
  const showingRecord = Boolean(id), employeeId = Number(id);
  const [rows, setRows] = useState<EmployeeProfile[]>([]);
  const [detail, setDetail] = useState<EmployeeProfile | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [positionQuery, setPositionQuery] = useState<string | null>(null);
  const [positionFilterQuery, setPositionFilterQuery] = useState('');
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([]);
  const [positions, setPositions] = useState<Array<{ id: number; name: string }>>([]);
  const [catalogError, setCatalogError] = useState('');
  const [query, setQuery] = useState(''), [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState(''), [positionId, setPositionId] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [page, setPage] = useState(1), [total, setTotal] = useState(0), [pages, setPages] = useState(0);
  const [revision, setRevision] = useState(0), [loading, setLoading] = useState(true), [pending, setPending] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setCatalogError('');
    void Promise.all([listDepartments(controller.signal, { limit: Number.MAX_SAFE_INTEGER }), listPositions(controller.signal, { limit: Number.MAX_SAFE_INTEGER })])
      .then(([d, p]) => { if (!controller.signal.aborted) { setDepartments(d.data); setPositions(p.data); } })
      .catch(cause => { if (!controller.signal.aborted) setCatalogError(getApiErrorMessage(cause, 'Could not load departments and positions.')); });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    const controller = new AbortController();
    setError(''); setLoading(true); setDetail(null);
    if (creating) { setForm(empty); setPositionQuery(null); setLoading(false); return () => controller.abort(); }
    if (showingRecord) {
      if (!Number.isSafeInteger(employeeId) || employeeId < 1) { setError('Invalid employee ID.'); setLoading(false); return; }
      void getEmployeeProfile(employeeId, controller.signal).then(value => {
        if (!controller.signal.aborted) { setDetail(value); setForm(toForm(value)); setPositionQuery(null); }
      }).catch(cause => { if (!controller.signal.aborted) setError(getApiErrorMessage(cause, 'Could not load employee.')); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    } else {
      void listEmployeeProfiles({ page, limit: 20, search, departmentId: departmentId ? Number(departmentId) : undefined,
        positionId: positionId ? Number(positionId) : undefined, employmentStatus: status || undefined }, controller.signal)
        .then(result => {
          if (controller.signal.aborted) return;
          if (!result.data.length && page > 1) { setPage(value => value - 1); return; }
          setRows(result.data); setTotal(result.pagination.total); setPages(result.pagination.totalPages);
        }).catch(cause => { if (!controller.signal.aborted) setError(getApiErrorMessage(cause, 'Could not load employees.')); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }
    return () => controller.abort();
  }, [creating, showingRecord, editing, employeeId, page, search, departmentId, positionId, status, revision]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending || (editing && !detail)) return;
    setError(''); setMessage(''); setPending(true);
    try {
      const input: EmployeeInput = {
        fullName: form.fullName.trim(), email: form.email.trim(), hireDate: form.hireDate,
        departmentId: Number(form.departmentId), positionId: Number(form.positionId),
        phone: form.phone.trim() || null, dateOfBirth: form.dateOfBirth || null, gender: form.gender || null,
        address: form.address.trim() || null, employmentType: form.employmentType.trim() || null,
        currentSalary: form.currentSalary === '' ? null : Number(form.currentSalary),
      };
      let saved: EmployeeProfile;
      if (editing && detail) {
        const changes: EmployeeChanges = {};
        const current = toForm(detail);
        const editable = ['fullName', 'phone', 'gender', 'address', 'departmentId', 'positionId', 'employmentType', 'currentSalary'] as const;
        for (const key of editable) if (form[key].trim() !== current[key].trim()) Object.assign(changes, { [key]: input[key] });
        if (!Object.keys(changes).length) { setMessage(text('Chưa có thay đổi để lưu.', 'No changes to save.')); return; }
        saved = await updateEmployeeProfile(detail.id, changes);
      } else saved = await createEmployeeProfile(input);
      setMessage(saved.emailDelivery === 'FAILED'
        ? text('Đã lưu hồ sơ và tài khoản nhưng gửi email thất bại. Không tạo lại; liên hệ quản trị viên để cấp mật khẩu tạm an toàn.', 'Profile and account saved, but email delivery failed. Do not create again; contact your administrator.')
        : text(editing ? 'Đã cập nhật nhân viên.' : 'Đã tạo nhân viên và tài khoản đăng nhập. Mật khẩu tạm được gửi qua email.', editing ? 'Employee updated.' : 'Employee and login account created. The temporary password is sent by email.'));
      navigate('/employees/' + saved.id); setRevision(value => value + 1);
    } catch (cause) { setError(getApiErrorMessage(cause, 'Could not save employee.')); }
    finally { setPending(false); }
  }

  async function deactivate(employee: EmployeeProfile) {
    if (pending || !window.confirm(text('Ngừng hoạt động nhân viên ' + employee.fullName + '? Tài khoản đăng nhập liên kết cũng sẽ bị khóa.', 'Deactivate ' + employee.fullName + '? The linked login account will also be disabled.'))) return;
    setPending(true); setError(''); setMessage('');
    try {
      await deactivateEmployeeProfile(employee.id);
      setMessage(text('Đã ngừng hoạt động nhân viên và khóa tài khoản liên kết.', 'Employee and linked account deactivated.'));
      navigate('/employees'); setRevision(value => value + 1);
    } catch (cause) { setError(getApiErrorMessage(cause, 'Could not deactivate employee.')); }
    finally { setPending(false); }
  }

  const field = (key: keyof Form, label: string, type = 'text', required = false) => <label className="text-sm font-medium text-slate-700">{label}
    <input className={control} type={type} required={required} value={form[key]} disabled={pending || (editing && ['email', 'hireDate', 'dateOfBirth'].includes(key))}
      maxLength={key === 'fullName' ? 150 : key === 'phone' ? 30 : key === 'email' ? 255 : key === 'employmentType' ? 40 : undefined}
      min={type === 'number' ? '0.01' : undefined} step={type === 'number' ? '0.01' : undefined}
      onChange={event => setForm(value => ({ ...value, [key]: event.target.value }))} /></label>;
  const select = (label: string, value: string, change: (value: string) => void, options: Array<{ id: number; name: string }>, required = false) =>
    <label className="text-sm font-medium text-slate-700">{label}<select aria-label={label} className={control} value={value} disabled={pending} required={required} onChange={event => change(event.target.value)}>
      <option value="">{text('Chọn', 'Select')}</option>
      {value && !options.some(item => String(item.id) === value) && <option value={value}>{text('Mục hiện tại (ngừng hoạt động)', 'Current inactive item')}</option>}
      {options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>;
  const active = (value: string) => value === 'ACTIVE' ? text('Đang hoạt động', 'Active') : value === 'INACTIVE' ? text('Ngừng hoạt động', 'Inactive') : value;
  const display = (label: string, value: unknown) => <div><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words font-medium">{value == null || value === '' ? '—' : String(value)}</dd></div>;
  return <AppShell breadcrumb={['Workforce', 'Employees']}>
    <Card className="mb-5 p-6"><div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{text(creating ? 'Thêm nhân viên' : editing ? 'Chỉnh sửa nhân viên' : showingRecord ? 'Chi tiết nhân viên' : 'Danh bạ nhân viên', creating ? 'Add employee' : editing ? 'Edit employee' : showingRecord ? 'Employee details' : 'Employee directory')}</h1>
      <div className="flex gap-3">{!creating && <Button onClick={() => navigate('/employees/new')}>{text('Thêm nhân viên', 'Add employee')}</Button>}
        {(creating || showingRecord) && <Button variant="secondary" onClick={() => navigate('/employees')}>{text('Về danh sách', 'Back to list')}</Button>}</div>
    </div></Card>
    {message && <p role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-emerald-800">{message}</p>}
    {catalogError && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4">{catalogError}<Button variant="secondary" onClick={() => setRevision(v => v + 1)}>{text('Thử lại', 'Retry')}</Button></p>}
    {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-red-800">{error}<Button variant="secondary" onClick={() => setRevision(v => v + 1)}>{text('Thử lại', 'Retry')}</Button></p>}
    {loading ? <Card className="p-6"><p role="status">{text('Đang tải nhân viên...', 'Loading employees...')}</p></Card>
      : (creating || editing) && !error ? <Card className="p-6"><p className="mb-5 text-sm text-slate-500">{text('Mã nhân viên được hệ thống tự sinh. Các trường có * là bắt buộc.', 'Employee code is generated automatically. Fields marked * are required.')}</p>
        <form onSubmit={save} className="grid gap-5 md:grid-cols-2">
          {field('fullName', text('Họ và tên *', 'Full name *'), 'text', true)}
          {field('email', 'Email *', 'email', true)}
          {field('hireDate', text('Ngày vào làm *', 'Hire date *'), 'date', true)}
          {field('dateOfBirth', text('Ngày sinh', 'Date of birth'), 'date')}
          {select(text('Phòng ban *', 'Department *'), form.departmentId, v => setForm(f => ({ ...f, departmentId: v })), departments, true)}
          <label className="text-sm font-medium text-slate-700">{text('Chức danh / Vị trí *', 'Position *')}<input className={control} list="employee-position-options" required disabled={pending}
            placeholder={text('Chọn hoặc nhập tên chức danh', 'Select or type a position')}
            value={positionQuery ?? positions.find(item => String(item.id) === form.positionId)?.name ?? ''}
            onChange={event => {
              const value = event.target.value;
              const matched = positions.find(item => item.name.toLocaleLowerCase() === value.trim().toLocaleLowerCase());
              setPositionQuery(value); setForm(current => ({ ...current, positionId: matched ? String(matched.id) : '' }));
              event.target.setCustomValidity(matched ? '' : text('Vui lòng chọn chức danh có trong danh sách.', 'Please select an existing position.'));
            }} />
            <datalist id="employee-position-options">{positions.map(item => <option key={item.id} value={item.name} />)}</datalist>
          </label>
          {field('phone', text('Số điện thoại', 'Phone'), 'tel')}
          <label className="text-sm font-medium text-slate-700">{text('Giới tính', 'Gender')}<select className={control} value={form.gender} disabled={pending} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}><option value="">{text('Chưa cung cấp', 'Not provided')}</option><option value="MALE">{text('Nam', 'Male')}</option><option value="FEMALE">{text('Nữ', 'Female')}</option><option value="OTHER">{text('Khác', 'Other')}</option></select></label>
          <label className="text-sm font-medium text-slate-700">{text('Loại hợp đồng', 'Employment type')}<select aria-label={text('Loại hợp đồng', 'Employment type')} className={control} value={form.employmentType} disabled={pending} onChange={event => setForm(value => ({ ...value, employmentType: event.target.value }))}>
            <option value="" disabled>{text('Chọn loại hợp đồng', 'Select employment type')}</option>
            <option value="FULL_TIME">FULL_TIME</option>
            <option value="PART_TIME">PART_TIME</option>
          </select></label>
          {field('currentSalary', text('Lương hiện tại', 'Current salary'), 'number')}
          <label className="flex min-w-0 flex-col items-start text-sm font-medium text-slate-700 md:col-span-2"><span>{text('Địa chỉ đầy đủ', 'Full address')}</span><textarea className={`${control} block min-h-20 max-w-full resize-none`} rows={3} value={form.address} disabled={pending} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            <span className="mt-1 block text-xs text-slate-500">{text('Nhập số nhà, đường, phường/xã, quận/huyện và tỉnh/thành để hệ thống tính khoảng cách.', 'Include house number, street, ward, district and city to calculate distance.')}</span></label>
          <div className="flex gap-3 md:col-span-2"><Button disabled={pending || !!catalogError}>{text(pending ? 'Đang lưu...' : 'Lưu nhân viên', pending ? 'Saving...' : 'Save employee')}</Button><Button type="button" variant="secondary" onClick={() => navigate(showingRecord ? '/employees/' + id : '/employees')}>{text('Hủy', 'Cancel')}</Button></div>
        </form></Card>
      : showingRecord && detail ? <Card className="p-6"><div className="mb-5 flex flex-wrap gap-3">
          {detail.employmentStatus !== 'INACTIVE' && <><Button onClick={() => navigate('/employees/' + id + '/edit')}>{text('Chỉnh sửa', 'Edit')}</Button><Button variant="secondary" disabled={pending} onClick={() => void deactivate(detail)}>{text('Ngừng hoạt động', 'Deactivate')}</Button></>}
        </div><dl className="grid gap-5 sm:grid-cols-2">
          {display(text('Mã nhân viên', 'Employee code'), detail.employeeCode)}{display(text('Họ và tên', 'Full name'), detail.fullName)}
          {display('Email', detail.email)}{display(text('Số điện thoại', 'Phone'), detail.phone)}
          {display(text('Phòng ban', 'Department'), departments.find(d => d.id === detail.departmentId)?.name || '—')}
          {display(text('Chức danh / Vị trí', 'Position'), positions.find(p => p.id === detail.positionId)?.name || '—')}
          {display(text('Trạng thái', 'Status'), active(detail.employmentStatus))}
          {display(text('Ngày vào làm', 'Hire date'), dateOnly(detail.hireDate))}
          {display(text('Ngày sinh', 'Date of birth'), dateOnly(detail.dateOfBirth))}
          {display(text('Giới tính', 'Gender'), detail.gender === 'MALE' ? text('Nam', 'Male') : detail.gender === 'FEMALE' ? text('Nữ', 'Female') : detail.gender === 'OTHER' ? text('Khác', 'Other') : null)}
          {display(text('Loại hợp đồng', 'Employment type'), detail.employmentType)}
          {display(text('Lương hiện tại', 'Current salary'), detail.currentSalary)}
          {display(text('Địa chỉ', 'Address'), detail.address)}
          {display(text('Khoảng cách đến công ty', 'Distance to office'), detail.distanceFromHomeKm == null ? null : detail.distanceFromHomeKm + ' km')}
          {display(text('Kết quả tính khoảng cách', 'Distance calculation'), detail.distanceCalculation.status === 'READY' ? text('Đã tính được', 'Ready') : detail.distanceCalculation.status === 'NOT_PROVIDED' ? text('Chưa cung cấp địa chỉ', 'Address not provided') : text('Chưa tính được; kiểm tra địa chỉ hoặc dịch vụ bản đồ.', 'Unavailable; check address or map service.'))}
        </dl></Card>
      : !showingRecord && !creating && <Card className="@container p-6">
        <form className="mb-5 grid items-end gap-x-3 gap-y-4 sm:grid-cols-2 @min-[760px]:grid-cols-4 @min-[1080px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,.9fr)_auto] [&>label]:min-w-0 [&_input]:h-10 [&_input]:py-2 [&_select]:h-10 [&_select]:py-2" onSubmit={e => { e.preventDefault(); setPage(1); setSearch(query.trim()); }}>
          <label className="text-sm font-medium">{text('Tìm tên, mã hoặc email', 'Search name, code or email')}<input type="search" className={control} value={query} maxLength={100} onChange={e => { setQuery(e.target.value); if (!e.target.value.trim()) { setSearch(''); setPage(1); } }} /></label>
          {select(text('Phòng ban', 'Department'), departmentId, v => { setDepartmentId(v); setPage(1); }, departments)}
          <label className="text-sm font-medium text-slate-700">{text('Chức danh / Vị trí', 'Position')}<input className={control} list="employee-position-filter-options"
            placeholder={text('Chọn hoặc nhập tên chức danh', 'Select or type a position')} value={positionFilterQuery}
            onChange={event => {
              const value = event.target.value;
              const matched = positions.find(item => item.name.toLocaleLowerCase() === value.trim().toLocaleLowerCase());
              setPositionFilterQuery(value); setPositionId(matched ? String(matched.id) : ''); setPage(1);
            }} />
            <datalist id="employee-position-filter-options">{positions.map(item => <option key={item.id} value={item.name} />)}</datalist>
          </label>
          <label className="text-sm font-medium">{text('Trạng thái', 'Status')}<select className={control} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="ACTIVE">{text('Đang hoạt động', 'Active')}</option><option value="INACTIVE">{text('Ngừng hoạt động', 'Inactive')}</option><option value="">{text('Tất cả', 'All')}</option></select></label>
          <div className="col-span-full flex flex-wrap justify-end gap-2 @min-[1080px]:col-span-1 @min-[1080px]:flex-nowrap"><Button>{text('Tìm kiếm', 'Search')}</Button><Button type="button" variant="secondary" onClick={() => { setQuery(''); setSearch(''); setDepartmentId(''); setPositionId(''); setPositionFilterQuery(''); setStatus('ACTIVE'); setPage(1); setRevision(v => v + 1); }}>{text('Xóa bộ lọc', 'Clear filters')}</Button><Button type="button" variant="secondary" onClick={() => setRevision(v => v + 1)}>{text('Tải lại', 'Reload')}</Button></div>
        </form>
        {!error && <><div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{[text('Mã nhân viên', 'Employee code'), text('Họ và tên', 'Full name'), 'Email', text('Phòng ban', 'Department'), text('Chức danh', 'Position'), text('Trạng thái', 'Status'), text('Thao tác', 'Actions')].map(h => <th key={h} scope="col" className="p-3">{h}</th>)}</tr></thead><tbody>
          {rows.map(row => <tr key={row.id} className="border-b border-slate-100"><td className="p-3">{row.employeeCode}</td><td className="p-3 font-medium">{row.fullName}</td><td className="p-3">{row.email}</td><td className="p-3">{departments.find(d => d.id === row.departmentId)?.name || '—'}</td><td className="p-3">{positions.find(p => p.id === row.positionId)?.name || '—'}</td><td className="p-3">{active(row.employmentStatus)}</td><td className="w-px p-3"><div className="flex flex-nowrap items-center gap-2"><Link className="inline-flex h-10 items-center rounded-full border px-3 font-medium text-orange-700" to={'/employees/' + row.id}>{text('Xem chi tiết', 'View details')}</Link>{row.employmentStatus !== 'INACTIVE' && <><Link className="inline-flex h-10 items-center rounded-full border px-3" to={'/employees/' + row.id + '/edit'}>{text('Chỉnh sửa', 'Edit')}</Link><Button variant="secondary" disabled={pending} onClick={() => void deactivate(row)}>{text('Ngừng hoạt động', 'Deactivate')}</Button></>}</div></td></tr>)}
        </tbody></table>{!rows.length && <p className="py-8 text-center text-slate-500">{text('Không tìm thấy nhân viên.', 'No employees found.')}</p>}</div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">{text('Trang', 'Page')} {page} / {Math.max(1, pages)} · {total} {text('nhân viên', 'employees')}</p><div className="flex gap-3"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{text('Trang trước', 'Previous')}</Button><Button variant="secondary" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>{text('Trang sau', 'Next')}</Button></div></div></>}
      </Card>}
  </AppShell>;
}
