import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { useEmployees } from '../context/EmployeeContext';
import { INPUT_FIELDS } from '../workflows/domain';
import { ErdEmployeeRelations } from '../components/ErdEmployeeRelations';
export default function EmployeeMasterDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { employees } = useEmployees();
  const employee = employees.find(item => item.id === id);
  return <AppShell breadcrumb={['Employee Data', employee?.name || 'Not found']}><SectionHeader title={employee?.name || 'Employee not found'} description="Hồ sơ gốc dùng chung với HR. Data Analyst chuẩn bị đầu vào; HR xem kết quả rủi ro cá nhân."><Button variant="secondary" onClick={() => navigate('/employees')}>Danh sách</Button>{employee && <Button onClick={() => navigate(`/employees/${employee.id}/edit`)}>Cập nhật hồ sơ</Button>}</SectionHeader>{employee && <Card className="p-6"><dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[['Mã nhân viên', employee.employeeId], ['Email', employee.email], ['Phòng ban', employee.department], ['Vị trí', employee.role], ['Trạng thái', employee.status], ...INPUT_FIELDS.map(([field, column]) => [column, employee[field] ?? 'Chưa có dữ liệu'])].map(([label, value]) => <div key={label} className="border-b border-slate-100 pb-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-2 text-sm font-semibold text-slate-800">{value}</dd></div>)}</dl><Button className="mt-5" variant="secondary" onClick={() => navigate('/preparation')}>Chuẩn bị snapshot</Button></Card>}{employee && <ErdEmployeeRelations employeeId={employee.id} />}</AppShell>;
}
