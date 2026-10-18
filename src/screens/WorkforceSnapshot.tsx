import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { useEmployees } from '../context/EmployeeContext';
import { useRole } from '../context/RoleContext';
import { useWorkflow } from '../context/WorkflowContext';
import { snapshotIsCurrent } from '../workflows/domain';

export default function WorkforceSnapshot() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useRole();
  const { employees } = useEmployees();
  const { snapshot, generateSnapshot } = useWorkflow();
  const [period, setPeriod] = useState({ start: snapshot?.start || '', end: snapshot?.end || '', scope: snapshot?.scope || '' });
  const [error, setError] = useState('');
  const current = snapshot && snapshotIsCurrent(snapshot, employees);
  const sameSelection = snapshot && snapshot.start === period.start && snapshot.end === period.end && snapshot.scope === period.scope;
  const ready = snapshot && current && sameSelection && !snapshot.issues.length;
  const control = 'mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm';
  return <AppShell breadcrumb={['Workforce Data', 'Snapshot']}>
    <SectionHeader title="Chuẩn bị dữ liệu / Workforce snapshot" description="Chọn kỳ và phạm vi active → kiểm tra dữ liệu → bổ sung hồ sơ thiếu → tạo lại và xem xét snapshot." />
    {location.state?.savedEmployee && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Đã lưu hồ sơ {String(location.state.savedEmployee)}. Chọn “Tạo lại và kiểm tra” để cập nhật dữ liệu và xem các lỗi còn lại.</p>}
    <Card className="mb-5 p-6"><form className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={event => { event.preventDefault(); try { generateSnapshot(period); setError(''); } catch (cause) { setError((cause as Error).message); } }}>
      <label className="text-sm text-slate-600">Từ ngày<input required type="date" className={control} value={period.start} onChange={event => setPeriod({ ...period, start: event.target.value })} /></label>
      <label className="text-sm text-slate-600">Đến ngày<input required type="date" className={control} value={period.end} min={period.start} onChange={event => setPeriod({ ...period, end: event.target.value })} /></label>
      <label className="text-sm text-slate-600">Phạm vi<select className={control} value={period.scope} onChange={event => setPeriod({ ...period, scope: event.target.value })}><option value="">Tất cả phòng ban</option>{[...new Set(employees.map(employee => employee.department))].map(department => <option key={department}>{department}</option>)}</select></label>
      <Button type="submit">{snapshot ? 'Tạo lại và kiểm tra' : 'Tạo snapshot'}</Button>
    </form><p className="mt-4 text-xs leading-5 text-slate-500">Nguồn đầu vào: hồ sơ, vị trí, học vấn, lịch sử công tác và câu trả lời khảo sát theo thời điểm kết thúc kỳ. Các đặc trưng chưa có nguồn đầy đủ cần nhập bản nháp; chỉ lưu AI_INPUT khi kiểm tra hợp lệ, không tự điền số giả.</p>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}</Card>
    {!snapshot ? <Card className="p-10 text-center text-slate-500">Chưa tạo snapshot. Chọn kỳ và phạm vi phía trên.</Card> : <>
      <div className="mb-5 grid gap-4 sm:grid-cols-3">{[['Nhân viên trong snapshot', snapshot.inputs.length], ['Lỗi cần sửa', snapshot.issues.length], ['Trạng thái', ready ? 'Sẵn sàng xem xét' : !current || !sameSelection ? 'Cần tạo lại snapshot' : 'Thiếu / sai dữ liệu']].map(([label, value]) => <Card key={label} className="p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-xl font-bold text-slate-900">{value}</p></Card>)}</div>
      {(!current || !sameSelection) && <p role="status" className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Dữ liệu hoặc kỳ/phạm vi đã thay đổi. Tạo lại snapshot để kiểm tra các giá trị mới.</p>}
      <Card className="overflow-x-auto p-5"><h2 className="mb-4 font-bold text-slate-900">{snapshot.issues.length ? 'Danh sách dữ liệu cần bổ sung' : `Xem xét snapshot · ${snapshot.start} → ${snapshot.end}`}</h2>
        {snapshot.issues.length ? <table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Nhân viên</th><th>Trường</th><th>Lỗi</th><th>Thao tác</th></tr></thead><tbody>{snapshot.issues.map((issue, index) => <tr key={index} className="border-b border-slate-100"><td className="p-3 font-mono">{issue.code}</td><td>{issue.field}</td><td className="px-3 text-red-700">{issue.message}</td><td><Button size="sm" variant="secondary" onClick={() => navigate(`/employees/${issue.employeeId}/edit`, { state: { returnTo: '/preparation' } })}>Sửa dữ liệu</Button></td></tr>)}</tbody></table> : <div className="space-y-3">{snapshot.inputs.map(input => <details key={input.id} className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-semibold text-slate-800">{employees.find(employee => employee.id === input.employee_id)?.name || input.employee_id} · {input.department_id} · {input.snapshot_date}</summary><dl className="mt-4 grid gap-2 sm:grid-cols-3">{Object.entries(input).map(([field, value]) => <div key={field} className="min-w-0 text-xs"><dt className="text-slate-400">{field}</dt><dd className="truncate text-slate-700">{value}</dd></div>)}</dl></details>)}</div>}
      </Card>
      {ready && user.role === 'Data / AI Analyst' && <div className="mt-5 flex justify-end"><Button onClick={() => navigate('/predictions')}>Tiếp tục: model và dự đoán</Button></div>}
      {ready && user.role === 'HR' && <Card className="mt-4 p-5 text-sm text-slate-600">Snapshot hợp lệ. Data / AI Analyst thực hiện đánh giá/kích hoạt model và chạy dự đoán; HR xem kết quả tại hồ sơ nhân viên.</Card>}
    </>}
  </AppShell>;
}
