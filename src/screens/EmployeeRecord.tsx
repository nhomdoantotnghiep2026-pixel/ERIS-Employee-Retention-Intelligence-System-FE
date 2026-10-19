import { useLanguage } from '../context/LanguageContext';
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Button, Card, ConfirmationDialog, SectionHeader } from '../components/ui';
import { useEmployees } from '../context/EmployeeContext';
import { INPUT_FIELDS } from '../workflows/domain';
import { employeeReferences } from '../workflows/references';
import type { Employee } from '../data/mockData';
import { ErdEmployeeRelations } from '../components/ErdEmployeeRelations';
import { useErd } from '../erd/useErd';

const control = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100';
export default function EmployeeRecord() {
  const { t } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromSnapshot = location.state?.returnTo === '/preparation';
  const { employees, updateEmployee, archiveEmployee } = useEmployees();
  const employee = employees.find(item => item.id === id);
  const db = useErd();
  const master = db.employees.find(row => row.id === id);
  const [draft, setDraft] = useState<Partial<Employee>>(() => ({ ...employee,monthlyIncome:typeof master?.current_salary === 'number' ? master.current_salary:undefined }));
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<'save' | 'archive' | null>(null);
  const set = (field: string, value: string | number | undefined) => { setDraft(previous => ({ ...previous, [field]: value })); setError(''); };
  if (!employee) return <AppShell breadcrumb={['Employees']}><Card className="p-6">{t("Employee not found.")}<Button onClick={() => navigate('/employees')}>{t("Employee directory")}</Button></Card></AppShell>;
  const save = () => { const message = updateEmployee(employee.id, draft); setConfirm(null); if (message) setError(message); else navigate(fromSnapshot ? '/preparation' : `/employees/${employee.id}`, { state: { savedEmployee: employee.name } }); };
  return <AppShell breadcrumb={['Employees', employee.name, 'Edit']}>
    <SectionHeader title={t("Cập nhật hồ sơ nhân viên")} description={t("Sửa hồ sơ và giá trị đầu vào phân tích. Snapshot cần được tạo lại khi dữ liệu thay đổi.")}><Button variant="secondary" onClick={() => navigate(fromSnapshot ? '/preparation' : '/employees')}>{t(fromSnapshot ? 'Quay lại chuẩn bị dữ liệu' : 'Danh sách nhân viên')}</Button></SectionHeader>
    <form onSubmit={event => { event.preventDefault(); setConfirm('save'); }}><Card className="p-6"><h2 className="text-lg font-bold text-slate-900">{t("Thông tin nhân viên")}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{(['name', 'employeeId', 'email'] as const).map(field => <label key={field} className="text-sm text-slate-600">{t(field)}<input required={field !== 'email'} type={field === 'email' ? 'email' : 'text'} className={control} value={draft[field] || ''} onChange={event => set(field, event.target.value)} /></label>)}
        <label className="text-sm text-slate-600">{t("Phòng ban")}<select className={control} value={draft.department} onChange={event => set('department', event.target.value)}>{employeeReferences.departments.map(value => <option key={value} value={value}>{t(value)}</option>)}</select></label>
        <label className="text-sm text-slate-600">{t("Vị trí")}<select className={control} value={draft.role} onChange={event => set('role', event.target.value)}>{employeeReferences.positions.map(value => <option key={value} value={value}>{t(value)}</option>)}</select></label>
        <label className="text-sm text-slate-600">{t("Trạng thái")}<select className={control} value={draft.status} onChange={event => set('status', event.target.value)}><option value="Active">{t("Active")}</option><option value="Inactive">{t("Inactive")}</option></select></label></div>
      <h2 className="mt-8 text-lg font-bold text-slate-900">{t("Thông tin hồ sơ gốc")}</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{(['phone','dateOfBirth','gender','address','hireDate','employmentType'] as const).map(field => <label key={field} className="text-sm text-slate-600">{t(field)}<input className={control} type={['dateOfBirth','hireDate'].includes(field) ? 'date':'text'} value={draft[field] || ''} onChange={event => set(field,event.target.value)} /></label>)}{(['monthlyIncome','distanceFromHomeKm'] as const).map(field => <label key={field} className="text-sm text-slate-600">{t(field === 'monthlyIncome' ? 'current_salary':'distance_from_home_km')}<input type="number" min="0" step="any" className={control} value={draft[field] ?? ''} onChange={event => set(field,event.target.value === '' ? undefined:Number(event.target.value))} /></label>)}</div>
      <h2 className="mt-8 text-lg font-bold text-slate-900">{t("Bản nháp đầu vào snapshot")}</h2><p className="mt-1 text-sm text-slate-500">{t("Các giá trị phân tích không lưu vào EMPLOYEES. Chúng là bản nháp biểu mẫu, chỉ lưu thành AI_INPUT khi snapshot hợp lệ. Tuổi/thâm niên lấy theo ngày sinh/ngày vào làm nếu có; mức hài lòng ưu tiên câu trả lời khảo sát. Để trống giá trị chưa biết.")}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{INPUT_FIELDS.filter(([field]) => !['monthlyIncome','distanceFromHomeKm','jobLevel'].includes(field)).map(([field, column, min, max]) => <label key={field} className="text-sm text-slate-600">{t(column)}<input className={control} type="number" step="any" min={min} max={Number.isFinite(max) ? max : undefined} value={draft[field] === 0 && min > 0 ? '' : draft[field] ?? ''} onChange={event => set(field, event.target.value === '' ? undefined : Number(event.target.value))} /></label>)}</div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{t(error)}</p>}
      <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-5"><Button type="button" variant="danger" disabled={employee.status === 'Inactive'} onClick={() => setConfirm('archive')}>{t("Ngừng hoạt động / xóa khỏi danh sách active")}</Button><Button type="submit">{t("Kiểm tra và lưu")}</Button></div>
    </Card></form>
    <ErdEmployeeRelations employeeId={employee.id} />
    <ConfirmationDialog open={confirm !== null} title={t(confirm === 'archive' ? 'Ngừng hoạt động nhân viên?' : 'Lưu thay đổi hồ sơ?')} description={t(confirm === 'archive' ? 'Giữ lịch sử và liên kết dữ liệu; loại nhân viên khỏi snapshot mới.' : 'Kiểm tra trùng lặp và tham chiếu trước khi lưu trong môi trường demo.')} confirmLabel={t("Xác nhận")} onCancel={() => setConfirm(null)} onConfirm={() => { if (confirm === 'archive') { archiveEmployee(employee.id); navigate('/employees'); } else save(); }} />
  </AppShell>;
}
