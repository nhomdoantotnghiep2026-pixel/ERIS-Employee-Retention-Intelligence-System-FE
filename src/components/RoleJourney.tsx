import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useRole, type UserRole } from '../context/RoleContext';
import { hasRoutePermission } from '../utils/rbacAccess';

const journeys: Record<UserRole, { home: string; title: string; steps: { title: string; detail: string; to: string }[] }> = {
  HR: { home: '/dashboard', title: 'Luồng công việc của HR', steps: [
    { title: 'Kiểm tra hồ sơ', detail: 'Thêm, nhập và bổ sung dữ liệu nhân viên trước khi phân tích.', to: '/employees' },
    { title: 'Thu thập và chuẩn bị', detail: 'Mở khảo sát, thu phản hồi; kiểm tra dữ liệu theo kỳ tại Workforce Snapshot.', to: '/engagement' },
    { title: 'Xem xét rủi ro', detail: 'Sau khi Analyst chạy dự đoán, xem nhân viên và nguyên nhân cần chú ý.', to: '/attrition-risk' },
    { title: 'Theo dõi giữ chân', detail: 'Lập hành động, theo dõi tiến độ rồi ghi nhận kết quả nhân viên.', to: '/interventions' },
  ] },
  'Data / AI Analyst': { home: '/data-overview', title: 'Luồng dữ liệu và phân tích', steps: [
    { title: 'Nhập dữ liệu', detail: 'Tải mẫu, kiểm tra lỗi, xem trước và xác nhận nhập nhân viên.', to: '/import' },
    { title: 'Chuẩn bị theo kỳ', detail: 'Chọn phạm vi, bổ sung dữ liệu thiếu rồi tạo lại bản dữ liệu hợp lệ.', to: '/preparation' },
    { title: 'Đánh giá mô hình', detail: 'Xem chỉ số đánh giá và xác nhận mô hình sẽ sử dụng.', to: '/model-performance' },
    { title: 'Tạo và xem dự đoán', detail: 'Chạy thử với dữ liệu mẫu; xem kết quả, giải thích và chuyển HR xem xét.', to: '/predictions' },
  ] },
  'System Administrator': { home: '/admin-overview', title: 'Luồng quản trị hệ thống', steps: [
    { title: 'Quản lý tài khoản', detail: 'Kiểm tra trạng thái và liên kết tài khoản với hồ sơ nhân viên.', to: '/users' },
    { title: 'Kiểm tra quyền', detail: 'Xem phạm vi truy cập của bốn role đã xác định.', to: '/roles' },
    { title: 'Thiết lập hệ thống', detail: 'Xem và điều chỉnh cấu hình trong giao diện demo.', to: '/system' },
    { title: 'Theo dõi thao tác', detail: 'Xem ai đã thực hiện thao tác gì và thời điểm thực hiện.', to: '/activity' },
  ] },
  'Employee / ESS': { home: '/employee-dashboard', title: 'Luồng tự phục vụ của nhân viên', steps: [
    { title: 'Xem hồ sơ của tôi', detail: 'Kiểm tra thông tin cá nhân, vị trí và lịch sử công việc.', to: '/my-profile' },
    { title: 'Gửi yêu cầu', detail: 'Chọn loại, ngày và lý do; xác nhận gửi cho HR.', to: '/my-requests' },
    { title: 'Theo dõi kết quả', detail: 'Quay lại lịch sử yêu cầu để xem quyết định và phản hồi của HR.', to: '/my-requests' },
    { title: 'Trả lời khảo sát', detail: 'Mở khảo sát đang nhận phản hồi và gửi câu trả lời của bạn.', to: '/my-surveys' },
  ] },
};

export function RoleJourney() {
  const { user } = useRole();
  const { pathname } = useLocation();
  const journey = journeys[user.role];
  if (pathname !== journey.home) return null;
  return <section aria-label={journey.title} className="mb-5 rounded-2xl border border-orange-100 bg-white p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-slate-900">{journey.title}</h2><span className="text-xs text-slate-500">Bản thử nghiệm frontend · dữ liệu demo trong tab này</span></div>
    <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{journey.steps.filter(step => hasRoutePermission(user.role, step.to)).map((step, index) => <li key={step.title}><Link to={step.to} className="group flex h-full gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 transition hover:border-orange-300 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-orange-500"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">{index + 1}</span><div><h3 className="text-sm font-bold text-slate-800">{step.title}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{step.detail}</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-orange-700">Mở bước này <ArrowRight size={13}/></span></div></Link></li>)}</ol>
  </section>;
}
