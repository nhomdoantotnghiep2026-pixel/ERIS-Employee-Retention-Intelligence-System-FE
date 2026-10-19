import { useLanguage } from '../context/LanguageContext';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { EmployeePrediction } from '../components/EmployeePrediction';
import { ErdEmployeeRelations } from '../components/ErdEmployeeRelations';
import { useErd } from '../erd/useErd';
import { useRole } from '../context/RoleContext';
export default function ErdEmployeeDetails() {
  const { t } = useLanguage();
  const { id }=useParams();
  const navigate=useNavigate();
  const db=useErd();
  const { user }=useRole();
  const employee=db.employees.find(row => row.id === id);
  if (!employee) return <AppShell breadcrumb={['Employees','Not found']}><Card className="p-8"><h1 className="text-xl font-bold text-slate-900">{t("Không tìm thấy hồ sơ nhân viên")}</h1><Button className="mt-4" onClick={() => navigate('/employees')}>{t("Danh sách nhân viên")}</Button></Card></AppShell>;
  const label:Record<string,string>={ employee_code:'Mã nhân viên',full_name:'Họ và tên',email:'Email',phone:'Số điện thoại',date_of_birth:'Ngày sinh',gender:'Giới tính',address:'Địa chỉ',distance_from_home_km:'Khoảng cách đến nơi làm việc (km)',department_id:'Phòng ban',position_id:'Vị trí',hire_date:'Ngày vào làm',employment_type:'Loại hợp đồng',employment_status:'Trạng thái làm việc',current_salary:'Lương hiện tại',created_at:'Ngày tạo',updated_at:'Cập nhật lần cuối',id:'ID hồ sơ' };
  return <AppShell breadcrumb={['Employees',String(employee.full_name)]}>
    <SectionHeader title={t(String(employee.full_name))} description={t("Thông tin nhân viên, phòng ban/vị trí và các hồ sơ liên quan lấy từ cùng mô hình dữ liệu.")}><Button variant="secondary" onClick={() => navigate('/employees')}>{t("Danh sách")}</Button><Button onClick={() => navigate(`/employees/${employee.id}/edit`)}>{t("Cập nhật hồ sơ")}</Button></SectionHeader>
    <Card className="p-6"><dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(employee).map(([field,value]) => <div key={field} className="min-w-0 border-b border-slate-100 pb-3"><dt className="text-xs text-slate-500">{t(label[field] || field)}</dt><dd className="mt-2 break-words text-sm font-semibold text-slate-800">{t(field === 'department_id' ? String(db.departments.find(row => row.id === value)?.name || '—'):field === 'position_id' ? String(db.positions.find(row => row.id === value)?.name || '—'):String(value ?? 'Chưa có dữ liệu'))}</dd></div>)}</dl></Card>
    <ErdEmployeeRelations employeeId={employee.id} />
    {user.role === 'HR' ? <div className="mt-5"><EmployeePrediction employeeId={employee.id} /><div className="flex flex-wrap gap-3"><Button onClick={() => navigate(`/employees/${employee.id}/risk`)}>{t("Xem phân tích rủi ro")}</Button><Button variant="secondary" onClick={() => navigate(`/interventions?employee=${employee.id}`)}>{t("Hành động giữ chân")}</Button><Button variant="secondary" onClick={() => navigate(`/outcomes?employee=${employee.id}`)}>{t("Kết quả thực tế")}</Button></div></div>:<Button className="mt-5" variant="secondary" onClick={() => navigate('/preparation')}>{t("Chuẩn bị snapshot")}</Button>}
  </AppShell>;
}
