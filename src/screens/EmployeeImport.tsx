import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Button, Card, ConfirmationDialog, SectionHeader } from '../components/ui';
import { useEmployees } from '../context/EmployeeContext';
import { validateImport, type ImportRow } from '../workflows/domain';
import { employeeReferences } from '../workflows/references';
import { readEmployeeFile } from '../workflows/importFile';
import { recordAudit } from '../workflows/audit';
import { downloadTextFile, toCsv } from '../utils/demoActions';

interface ImportHistory { id: string; file: string; count: number; created_at: string }
function loadHistory(): ImportHistory[] { try { const value = JSON.parse(sessionStorage.getItem('eris-import-history-v1') || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
export default function EmployeeImport() {
  const navigate = useNavigate();
  const { employees, importEmployees } = useEmployees();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [history, setHistory] = useState(loadHistory);
  const request = useRef(0);
  const validationErrors = rows.length ? validateImport(rows, employees, employeeReferences) : [];
  const allErrors = [...errors, ...validationErrors];
  const upload = async (file?: File) => {
    const revision = ++request.current;
    setRows([]); setErrors([]); setDone(null); setConfirm(false); setFileName(file?.name || '');
    if (!file) return;
    setLoading(true);
    try { const parsed = await readEmployeeFile(file); if (revision === request.current) setRows(parsed); }
    catch (cause) { if (revision === request.current) setErrors([(cause as Error).message]); }
    finally { if (revision === request.current) setLoading(false); }
  };
  const commit = () => {
    setConfirm(false);
    const issues = validateImport(rows, employees, employeeReferences);
    if (issues.length) { setErrors(['Dữ liệu đã thay đổi. Kiểm tra lại lỗi bên dưới.']); return; }
    const result = importEmployees(rows);
    if (result.created !== rows.length) { setErrors(['Import bị chặn; không có dòng nào được lưu.']); return; }
    const item = { id: crypto.randomUUID(), file: fileName, count: result.created, created_at: new Date().toISOString() };
    const next = [item, ...history]; sessionStorage.setItem('eris-import-history-v1', JSON.stringify(next)); setHistory(next);
    recordAudit('IMPORT_HISTORY', item.id, 'Confirm employee import', null, item);
    setDone(result.created); setRows([]);
  };
  return <AppShell breadcrumb={['Workforce', 'Import Employees']}>
    <SectionHeader title="Import và kiểm tra dữ liệu nhân viên" description="Tải mẫu → nhập file → kiểm tra định dạng, dữ liệu, trùng lặp và tham chiếu → xem trước → xác nhận import."><Button variant="secondary" onClick={() => navigate('/employees')}>Danh sách nhân viên</Button></SectionHeader>
    <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"><Card className="p-6"><h2 className="font-bold text-slate-900">1. Chọn file CSV / Excel</h2><p className="my-3 text-sm text-slate-500">Tối đa 10 MB, 5.000 nhân viên. File Excel .xlsx: đọc sheet đầu tiên. Có lỗi ở bất kỳ dòng nào thì toàn bộ import sẽ bị chặn.</p><input aria-label="Chọn file nhân viên" className="max-w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-orange-50 file:px-4 file:py-3 file:font-semibold file:text-orange-700" type="file" accept=".csv,.xlsx" onChange={event => void upload(event.target.files?.[0])} />
      {loading && <p role="status" className="mt-4 text-sm text-slate-500">Đang đọc và kiểm tra file…</p>}
      {allErrors.length > 0 && <div role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800"><b>{allErrors.length} lỗi — sửa file và tải lại</b><ul className="mt-2 list-disc space-y-1 pl-5">{allErrors.map((error, index) => <li key={index}>{error}</li>)}</ul><Button className="mt-4" size="sm" variant="secondary" onClick={() => downloadTextFile('import-errors.csv', toCsv(allErrors.map(message => ({ message }))), 'text/csv;charset=utf-8')}>Tải báo cáo lỗi</Button></div>}
      {done !== null && <div role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Đã import {done} hồ sơ vào môi trường demo. <button className="font-bold underline" onClick={() => navigate('/preparation')}>Tiếp tục tạo snapshot</button></div>}
    </Card><Card className="p-6"><h2 className="font-bold text-slate-900">Mẫu và danh mục tham chiếu</h2><Button className="my-4" variant="secondary" onClick={() => downloadTextFile('eris-employee-template.csv', 'employeeId,firstName,lastName,department,jobTitle,email\nEMP-013,An,Nguyen,Engineering,Software Engineer,an.nguyen@company.com\n', 'text/csv;charset=utf-8')}>Tải mẫu CSV</Button><p className="text-xs leading-6 text-slate-600">Phòng ban hợp lệ: {employeeReferences.departments.join(', ')}.</p><details className="mt-3 text-xs leading-6 text-slate-600"><summary className="cursor-pointer font-semibold">Vị trí hợp lệ</summary>{employeeReferences.positions.join(', ')}</details></Card></div>
    {rows.length > 0 && <Card className="mb-5 overflow-x-auto p-5"><h2 className="mb-3 font-bold text-slate-900">2. Xem trước · {fileName} · {rows.length} dòng</h2><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500">{['Mã', 'Họ tên', 'Phòng ban', 'Vị trí', 'Email'].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{rows.slice(0, 20).map((row, index) => <tr key={index} className="border-b border-slate-100"><td className="p-3">{row.employeeId}</td><td className="p-3">{row.firstName} {row.lastName}</td><td className="p-3">{row.department}</td><td className="p-3">{row.jobTitle}</td><td className="p-3">{row.email}</td></tr>)}</tbody></table>{rows.length > 20 && <p className="my-3 text-xs text-slate-500">Hiển thị 20 dòng đầu; toàn bộ {rows.length} dòng đã được kiểm tra.</p>}<Button className="mt-4" disabled={loading || allErrors.length > 0} onClick={() => setConfirm(true)}>Xác nhận import {rows.length} nhân viên</Button></Card>}
    <Card className="p-5"><h2 className="mb-3 font-bold text-slate-900">Lịch sử import</h2>{!history.length ? <p className="text-sm text-slate-500">Chưa có lần import thành công.</p> : history.map(item => <div key={item.id} className="flex flex-wrap justify-between gap-3 border-b border-slate-100 py-3 text-sm"><b>{item.file}</b><span>{item.count} nhân viên · {new Date(item.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span></div>)}</Card>
    <ConfirmationDialog open={confirm} title="Xác nhận import?" description={`${rows.length} hồ sơ đã được kiểm tra. Lưu toàn bộ vào danh sách nhân viên và ghi lịch sử import trong môi trường demo.`} confirmLabel="Import nhân viên" onCancel={() => setConfirm(false)} onConfirm={commit} />
  </AppShell>;
}
