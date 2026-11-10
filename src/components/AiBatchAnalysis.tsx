import { useState } from 'react';
import { Button, Card } from './ui';
import { getApiErrorMessage, listAiSnapshots, predictAiBatch, type AiBatchResult, type AiEmployee, type AiSnapshot } from '../services/api';

type Selection = { employee: AiEmployee; snapshots: AiSnapshot[]; snapshotId: number | null };

export default function AiBatchAnalysis({ employees }: { employees: AiEmployee[] }) {
  const [selected, setSelected] = useState<Selection[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [save, setSave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AiBatchResult | null>(null);

  async function addEmployee() {
    const employee = employees.find(item => item.id === Number(employeeId));
    if (!employee || selected.some(item => item.employee.id === employee.id) || selected.length >= 25) return;
    setBusy(true); setError('');
    try {
      const snapshots = (await listAiSnapshots(employee.id)).data.filter(item => item.ready && item.snapshotId);
      setSelected(items => [...items, { employee, snapshots, snapshotId: null }]);
      setEmployeeId(''); setResult(null);
    } catch (e) { setError(getApiErrorMessage(e, 'Không tải được bản dữ liệu của nhân viên.')); }
    finally { setBusy(false); }
  }

  async function runBatch() {
    if (busy || !selected.length || selected.length > 25 || selected.some(item => !item.snapshotId)) return;
    if (save && !window.confirm('Lưu các kết quả thành công?')) return;
    setBusy(true); setError(''); setResult(null);
    try {
      setResult((await predictAiBatch(selected.map(item => ({ employeeId: item.employee.id, snapshotId: item.snapshotId!, save })))).data);
    } catch (e) { setError(getApiErrorMessage(e, 'Không chạy được phân tích theo nhóm.')); }
    finally { setBusy(false); }
  }

  return <Card className="mb-5 p-5">
    <h2 className="text-lg font-bold">Phân tích nhiều nhân viên</h2>
    <p className="mt-2 text-sm text-slate-600">Chọn nhân viên và dữ liệu cần phân tích.</p>
    {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <label className="min-w-64 flex-1 text-sm font-medium">Nhân viên
        <select className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3" value={employeeId} disabled={busy || selected.length >= 25} onChange={e => setEmployeeId(e.target.value)}>
          <option value="">Chọn nhân viên</option>{employees.filter(employee => !selected.some(item => item.employee.id === employee.id)).map(employee => <option key={employee.id} value={employee.id}>{employee.employeeCode} · {employee.fullName}</option>)}
        </select>
      </label>
      <Button variant="secondary" disabled={!employeeId || busy || selected.length >= 25} onClick={() => void addEmployee()}>Thêm vào nhóm</Button>
    </div>
    <p className="mt-3 text-sm text-slate-500">Đã chọn {selected.length}/25 nhân viên</p>
    <div className="mt-3 space-y-3">{selected.map(item => <div key={item.employee.id} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 p-4">
      <label className="min-w-56 flex-1 text-sm font-medium">{item.employee.employeeCode} · {item.employee.fullName}
        <select className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3" value={item.snapshotId ?? ''} disabled={busy} onChange={e => { const value = e.target.value ? Number(e.target.value) : null; setSelected(items => items.map(row => row.employee.id === item.employee.id ? { ...row, snapshotId: value } : row)); setResult(null); }}>
          <option value="">Chọn bản dữ liệu</option>{item.snapshots.map(snapshot => <option key={snapshot.snapshotId} value={snapshot.snapshotId ?? ''}>#{snapshot.snapshotId} · {new Date(snapshot.capturedAt).toLocaleString('vi-VN')}</option>)}
        </select>
        {!item.snapshots.length && <span className="mt-1 block font-normal text-amber-700">Chưa có dữ liệu sẵn sàng.</span>}
      </label>
      <Button variant="secondary" disabled={busy} onClick={() => { setSelected(items => items.filter(row => row.employee.id !== item.employee.id)); setResult(null); }}>Bỏ khỏi nhóm</Button>
    </div>)}</div>
    <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={save} disabled={busy} onChange={e => setSave(e.target.checked)} /> Lưu kết quả thành công vào hệ thống</label>
    <Button className="mt-4" disabled={busy || !selected.length || selected.some(item => !item.snapshotId)} onClick={() => void runBatch()}>{busy ? 'Đang xử lý…' : 'Chạy phân tích nhóm'}</Button>
    {result && <div className="mt-5" aria-live="polite"><h3 className="font-semibold">Kết quả: {result.succeeded} thành công · {result.failed} thất bại</h3><p className="mt-2 text-sm text-amber-800">Kết quả AI chỉ để tham khảo.</p><div className="mt-3 space-y-2">{result.results.map(item => <div className="rounded-xl bg-slate-50 p-3 text-sm" key={item.employeeId}><strong>{selected.find(row => row.employee.id === item.employeeId)?.employee.fullName || `Nhân viên #${item.employeeId}`}</strong>{item.success && item.data ? <p className="mt-1">Kết quả: {(item.data.model.score * 100).toFixed(1)}% · {item.data.saved ? `Đã lưu · Mã ${item.data.predictionId}` : 'Chưa lưu'}</p> : <p className="mt-1 text-red-700">Không thành công. Vui lòng kiểm tra dữ liệu và thử lại.</p>}</div>)}</div></div>}
  </Card>;
}
