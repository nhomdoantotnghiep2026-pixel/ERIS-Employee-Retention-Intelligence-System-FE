import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Button, Card, ConfirmationDialog, SectionHeader, StatusBadge } from '../components/ui';
import { useWorkflow } from '../context/WorkflowContext';

export default function ModelLifecycle() {
  const navigate = useNavigate();
  const { models, evaluate, activate } = useWorkflow();
  const [error, setError] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  return <AppShell breadcrumb={['AI Models', 'Evaluate & activate']}>
    <SectionHeader title="Đánh giá và kích hoạt phiên bản model" description="Đánh giá trên bộ kiểm thử có nhãn → xem kết quả → xác nhận kích hoạt. Chỉ một phiên bản Active."><Button variant="secondary" onClick={() => navigate('/predictions')}>Chạy dự đoán</Button></SectionHeader>
    <p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">Demo: tính chỉ số từ confusion matrix mẫu. Đánh giá lại không tự tăng độ chính xác, không huấn luyện hoặc kích hoạt model mới.</p>
    {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
    <div className="grid gap-5 xl:grid-cols-2">{models.map(model => <Card key={model.version} className="p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-slate-900">{model.version}</h2><StatusBadge status={model.status} /></div>
      <p className="mt-3 text-xs text-slate-500">{model.evaluated_at ? `Đã đánh giá: ${new Date(model.evaluated_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : 'Chưa đánh giá'}</p>
      {model.metrics ? <dl className="mt-5 grid grid-cols-2 gap-3">{Object.entries(model.metrics).map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs uppercase text-slate-500">{label}</dt><dd className="mt-1 text-xl font-bold text-slate-900">{(value * 100).toFixed(1)}%</dd></div>)}</dl> : <p className="my-5 text-sm text-slate-500">Chạy đánh giá để xem Accuracy, Precision, Recall và F1.</p>}
      {model.matrix && <div className="mt-4 grid grid-cols-4 gap-2 text-center">{Object.entries(model.matrix).map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 p-2"><p className="text-xs uppercase text-slate-500">{label}</p><b className="text-slate-800">{value}</b></div>)}</div>}
      <div className="mt-5 flex flex-wrap gap-3"><Button variant="secondary" onClick={() => { try { evaluate(model.version); setError(''); } catch (cause) { setError((cause as Error).message); } }}>Đánh giá {model.version}</Button><Button disabled={!model.metrics || model.status === 'Active'} onClick={() => setPending(model.version)}>{model.status === 'Active' ? 'Đang Active' : 'Kích hoạt phiên bản'}</Button></div>
    </Card>)}</div>
    <ConfirmationDialog open={pending !== null} title={`Kích hoạt ${pending || ''}?`} description="Phiên bản Active hiện tại chuyển sang Retired. Các lần chạy cũ giữ nguyên phiên bản và kết quả." confirmLabel="Kích hoạt" onCancel={() => setPending(null)} onConfirm={() => { try { activate(pending!); setError(''); } catch (cause) { setError((cause as Error).message); } setPending(null); }} />
  </AppShell>;
}
