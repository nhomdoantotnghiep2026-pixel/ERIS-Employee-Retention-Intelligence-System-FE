import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { useEmployees } from '../context/EmployeeContext';
import { useWorkflow } from '../context/WorkflowContext';
import { snapshotIsCurrent } from '../workflows/domain';
export default function DataWorkspace() {
  const navigate = useNavigate();
  const { employees } = useEmployees();
  const { snapshot, models, runs } = useWorkflow();
  const active = models.find(model => model.status === 'Active');
  const ready = snapshot && !snapshot.issues.length && snapshotIsCurrent(snapshot, employees);
  const actions = [
    { title: '1. Quản lý dữ liệu nhân viên', description: `${employees.length} hồ sơ · ${employees.filter(employee => employee.status === 'Active').length} active`, to: '/employees', button: 'Mở danh sách nhân viên' },
    { title: '2. Import và kiểm tra dataset', description: 'CSV / Excel → kiểm tra dòng, trùng lặp và tham chiếu → xem trước → xác nhận', to: '/employees/import', button: 'Import dữ liệu' },
    { title: '3. Chuẩn bị snapshot', description: ready ? `${snapshot.inputs.length} đầu vào hợp lệ · ${snapshot.start} → ${snapshot.end}` : snapshot ? `${snapshot.issues.length} lỗi hoặc dữ liệu đã thay đổi — cần kiểm tra lại` : 'Chưa tạo snapshot', to: '/preparation', button: 'Chọn kỳ / phạm vi và kiểm tra' },
    { title: '4. Đánh giá và kích hoạt model', description: active ? `${active.version} đang Active` : 'Chưa kích hoạt model. Đánh giá trước khi kích hoạt.', to: '/model-performance', button: 'Đánh giá model' },
    { title: '5. Chạy dự đoán và lưu giải thích', description: `${runs.length} lần chạy đã lưu · mô phỏng bằng kết quả mẫu, chưa có inference thật`, to: '/predictions', button: 'Mở luồng dự đoán' },
    { title: '6. Xem lịch sử thao tác', description: 'Theo dõi các thay đổi dữ liệu và hoạt động phân tích do bạn thực hiện.', to: '/audit-logs', button: 'Xem nhật ký' },
  ];
  return <AppShell breadcrumb={['Data & AI Workspace']}><SectionHeader title="Data & AI Workspace" description="Thực hiện theo thứ tự: dữ liệu nhân viên → kiểm tra → snapshot → đánh giá/kích hoạt model → dự đoán/giải thích → bàn giao kết quả cho HR." /><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{actions.map(action => <Card key={action.title} className="flex flex-col p-6"><h2 className="font-bold text-slate-900">{action.title}</h2><p className="mb-5 mt-3 flex-1 text-sm leading-6 text-slate-600">{action.description}</p><Button variant="secondary" onClick={() => navigate(action.to)}>{action.button}</Button></Card>)}</div></AppShell>;
}
