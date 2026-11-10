import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { getAiModel, listAiEmployees, listAiSnapshots, getAiSnapshot, previewAiEmployee, predictAiEmployee, getAiResult, getApiErrorMessage, type AiEmployee, type AiSnapshot, type AiPrediction } from '../services/api';
import AiPolicyRecommendationsPanel from '../components/AiPolicyRecommendations';

const labels: Record<string, string> = { Department: 'Phòng ban', Gender: 'Giới tính', Age: 'Tuổi', Hire_Date: 'Ngày vào làm', Years_At_Company: 'Số năm làm việc', Education_Level: 'Trình độ học vấn', Monthly_Salary: 'Lương tháng (USD)', Work_Hours_Per_Week: 'Giờ làm việc mỗi tuần', Overtime_Hours: 'Giờ tăng ca trong năm', Sick_Days: 'Số ngày nghỉ/vắng trong năm', Promotions: 'Số lần thăng chức', Employee_Satisfaction_Score: 'Điểm hài lòng (1–5)' };
const choices: Record<string, string[]> = { Department: ['Customer Support','Engineering','Finance','HR','IT','Legal','Marketing','Operations','Sales'], Gender: ['Male','Female','Other'], Education_Level: ['High School','Bachelor','Master','PhD'] };
const selectClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm';

export default function AiAnalysis() {
  const [employees, setEmployees] = useState<AiEmployee[]>([]);
  const [employee, setEmployee] = useState('');
  const [snapshots, setSnapshots] = useState<AiSnapshot[]>([]);
  const [snapshot, setSnapshot] = useState<AiSnapshot | null>(null);
  const [prediction, setPrediction] = useState<AiPrediction | null>(null);
  const [supplement, setSupplement] = useState<Record<string, string>>({});
  const [rate, setRate] = useState('');
  const [savedId, setSavedId] = useState('');
  const [model, setModel] = useState('');
  const [modelError, setModelError] = useState('');
  const [modelLoading, setModelLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  async function loadModel(isActive: () => boolean = () => true) {
    if (!isActive()) return;
    setModelLoading(true);
    setModelError('');
    try {
      const response = await getAiModel();
      if (isActive()) setModel(response.data.model_id);
    } catch (e) {
      if (isActive()) {
        setModel('');
        setModelError(getApiErrorMessage(e, 'Không kết nối được dịch vụ AI.'));
      }
    } finally {
      if (isActive()) setModelLoading(false);
    }
  }
  useEffect(() => {
    let live = true;
    void listAiEmployees().then(r => { if (live) setEmployees(r.data); }).catch(e => { if (live) setError(getApiErrorMessage(e, 'Không tải được danh sách nhân viên.')); });
    void loadModel(() => live);
    return () => { live = false; };
  }, []);
  useEffect(() => {
    let live = true; setSnapshots([]); setSnapshot(null); setPrediction(null); setSupplement({});
    if (employee) void listAiSnapshots(Number(employee)).then(r => { if (live) setSnapshots(r.data); }).catch(e => { if (live) setError(getApiErrorMessage(e, 'Không tải được lịch sử dữ liệu.')); });
    return () => { live = false; };
  }, [employee]);
  async function prepare() {
    if (!employee || busy) return;
    const extras: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(supplement)) if (value.trim()) extras[key] = choices[key] || key === 'Hire_Date' ? value : Number(value);
    if (Object.values(extras).some(v => typeof v === 'number' && !Number.isFinite(v)) || (rate && (!Number.isFinite(Number(rate)) || Number(rate) < 1 || Number(rate) > 1000000))) { setError('Vui lòng kiểm tra các giá trị số và tỷ giá.'); return; }
    if (!window.confirm('Kiểm tra dữ liệu của nhân viên này?')) return;
    setBusy(true); setError(''); setPrediction(null);
    try {
      const r = await previewAiEmployee(Number(employee), { ...(rate ? { vndPerUsd: Number(rate) } : {}), ...(Object.keys(extras).length ? { supplementalFeatures: extras } : {}) });
      setSnapshot(r.data); setSupplement({});
      if (r.data.snapshotId) setSnapshots(await listAiSnapshots(Number(employee)).then(x => x.data));
    } catch (e) { setError(getApiErrorMessage(e, 'Không kiểm tra được dữ liệu.')); } finally { setBusy(false); }
  }
  async function selectSnapshot(id: string) {
    setSnapshot(null); setPrediction(null); setError('');
    if (!id) return;
    setSnapshotLoading(true);
    try { setSnapshot((await getAiSnapshot(Number(employee), Number(id))).data); }
    catch (e) { setError(getApiErrorMessage(e, 'Không tải được chi tiết bản dữ liệu.')); }
    finally { setSnapshotLoading(false); }
  }
  async function predict() {
    if (!snapshot?.snapshotId || !snapshot.ready || busy) return;
    setBusy(true); setError('');
    try { setPrediction((await predictAiEmployee(Number(employee), snapshot.snapshotId, true)).data); }
    catch (e) { setError(getApiErrorMessage(e, 'Không chạy được mô hình AI.')); } finally { setBusy(false); }
  }
  async function loadResult() {
    if (!/^[1-9]\d*$/.test(savedId)) { setError('Vui lòng nhập mã kết quả hợp lệ.'); return; }
    setBusy(true); setError('');
    try { setPrediction((await getAiResult(Number(savedId))).data); } catch(e) { setError(getApiErrorMessage(e, 'Không tải được kết quả.')); } finally { setBusy(false); }
  }
  return <AppShell breadcrumb={['Retention', 'AI analysis']}><SectionHeader title="Phân tích AI nhân viên" description="Kiểm tra dữ liệu và xem kết quả hỗ trợ cho từng nhân viên." />
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Kết quả AI chỉ để tham khảo. HR cần xem xét trước khi đưa ra quyết định.</div>
    {modelError && <div role="alert" className="mb-4 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 sm:flex-row sm:items-center sm:justify-between"><p>Chưa thể kết nối AI. Vui lòng thử lại.</p><Button variant="secondary" size="sm" disabled={modelLoading} onClick={() => void loadModel()}>{modelLoading ? 'Đang kiểm tra…' : 'Thử kết nối lại'}</Button></div>}
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    <Card className="mb-5 p-5"><h2 className="text-lg font-bold">1. Chọn nhân viên và kiểm tra dữ liệu</h2><p className="mt-2 text-sm text-slate-600">Chọn nhân viên cần phân tích. {model && 'Dịch vụ AI đã sẵn sàng.'}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Nhân viên<select className={`${selectClass} mt-2`} value={employee} disabled={snapshotLoading} onChange={e => setEmployee(e.target.value)}><option value="">Chọn nhân viên</option>{employees.map(e => <option key={e.id} value={e.id}>{e.employeeCode} · {e.fullName}</option>)}</select></label>
      <label className="text-sm font-medium">Tỷ giá VND cho 1 USD (nếu cần tính lương)<input className={`${selectClass} mt-2`} type="number" min="1" max="1000000" value={rate} onChange={e => setRate(e.target.value)} placeholder="Nhập tỷ giá để quy đổi lương" /></label></div>
      <Button className="mt-4" disabled={!employee || busy} onClick={() => void prepare()}>Kiểm tra dữ liệu</Button>
    </Card>
    {snapshot && <Card className="mb-5 p-5"><h2 className="text-lg font-bold">2. Dữ liệu đầu vào</h2><p className="mt-2 text-sm text-slate-600">{snapshot.ready ? `Đã sẵn sàng · Bản dữ liệu #${snapshot.snapshotId}` : 'Chưa đủ dữ liệu để chạy mô hình.'}</p>
      {snapshot.issues?.map(issue => <p key={issue} className="mt-2 text-sm text-amber-800">{issue}</p>)}
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(snapshot.features).map(([key,value]) => <div key={key} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{labels[key] || key}</p><p className="mt-1 font-medium">{String(value)}</p><p className="mt-1 text-xs text-slate-500">{snapshot.provenance?.[key]?.startsWith('MANUAL_DEMO') ? 'Bổ sung để thử nghiệm' : 'Dữ liệu từ hệ thống'}</p></div>)}</div>
      {!!snapshot.missingFeatures?.length && <><p className="mt-5 text-sm text-slate-700">Bổ sung thông tin còn thiếu để tiếp tục. Thông tin này không làm thay đổi hồ sơ nhân viên.</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{snapshot.missingFeatures.map(key => <label key={key} className="text-sm font-medium">{labels[key] || key}{choices[key] ? <select className={`${selectClass} mt-1`} value={supplement[key] || ''} onChange={e => setSupplement(v => ({...v,[key]: e.target.value}))}><option value="">Chọn giá trị</option>{choices[key].map(v => <option key={v}>{v}</option>)}</select> : <input className={`${selectClass} mt-1`} type={key === 'Hire_Date' ? 'date' : 'number'} value={supplement[key] || ''} onChange={e => setSupplement(v => ({...v,[key]: e.target.value}))} />}</label>)}</div><Button className="mt-4" disabled={busy} onClick={() => void prepare()}>Kiểm tra lại</Button></>}
      {snapshot.ready && <Button className="mt-5" disabled={busy} onClick={() => void predict()}>{busy ? 'Đang phân tích…' : 'Chạy phân tích'}</Button>}
    </Card>}
    {employee && snapshots.length > 0 && <Card className="mb-5 p-5"><h2 className="font-bold">Bản dữ liệu đã lưu</h2><label className="mt-3 block text-sm">Chọn bản dữ liệu<select className={`${selectClass} mt-2`} value={snapshot?.snapshotId || ''} disabled={snapshotLoading} onChange={e => void selectSnapshot(e.target.value)}><option value="">Chọn bản dữ liệu</option>{snapshots.map(s => <option key={s.snapshotId} value={s.snapshotId || ''}>#{s.snapshotId} · {new Date(s.capturedAt).toLocaleString('vi-VN')} {s.ready ? '' : '· Chưa đầy đủ'}</option>)}</select></label>{snapshotLoading && <p role="status">Đang tải chi tiết bản dữ liệu…</p>}</Card>}
    {prediction && <Card className="mb-5 p-5"><h2 className="text-lg font-bold">Kết quả phân tích</h2><p className="mt-2 text-sm">{prediction.preview?.employee?.fullName} · {prediction.saved ? `Đã lưu · Mã kết quả ${prediction.predictionId}` : 'Chưa lưu'}</p><p className="mt-4 text-3xl font-bold text-orange-600">{(prediction.model.score * 100).toFixed(1)}%</p><p className="mt-1 text-sm text-slate-600">Kết quả chỉ mang tính tham khảo.</p><h3 className="mt-5 font-semibold">Các yếu tố ảnh hưởng</h3><div className="mt-2 grid gap-2 sm:grid-cols-2">{Object.entries(prediction.model.contributions).map(([key,value]) => <div key={key} className="flex justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm"><span>{labels[key] || key}</span><span>{value >= 0 ? '+' : ''}{(value * 100).toFixed(2)} điểm %</span></div>)}</div></Card>}
    {prediction?.predictionId && <AiPolicyRecommendationsPanel key={prediction.predictionId} predictionId={prediction.predictionId} />}
    <Card className="p-5"><h2 className="font-bold">Xem kết quả đã lưu</h2><div className="mt-3 flex flex-wrap items-end gap-3"><label className="text-sm">Mã kết quả<input className={`${selectClass} mt-1 block`} type="number" min="1" value={savedId} onChange={e => setSavedId(e.target.value)} /></label><Button variant="secondary" disabled={busy} onClick={() => void loadResult()}>Xem kết quả</Button></div></Card>
  </AppShell>;
}
