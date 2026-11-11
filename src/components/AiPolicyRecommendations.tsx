import { useAutoDismissState } from '../hooks/useAutoDismissState';
import { useLanguage } from '../context/LanguageContext';
import { useState } from 'react';
import { Button, Card } from './ui';
import { generateAiPolicyRecommendations, getApiErrorMessage, type AiPolicyRecommendations } from '../services/api';

export default function AiPolicyRecommendationsPanel({ predictionId }: { predictionId: number }) {
  const { t } = useLanguage();
  const [result, setResult] = useState<AiPolicyRecommendations | null>(null);
  const [error, setError] = useAutoDismissState();
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(3);
  async function generate(save: boolean) {
    if (busy) return;
    setBusy(true); setError('');
    try { setResult((await generateAiPolicyRecommendations(predictionId, save, limit)).data); }
    catch (e) { setError(getApiErrorMessage(e, 'Không tải được đề xuất chính sách.')); }
    finally { setBusy(false); }
  }
  return <Card className="mb-5 p-5">
    <h2 className="text-lg font-bold">{t("Đề xuất hỗ trợ")}</h2>
    <p className="mt-2 text-sm text-slate-600">{t("HR cần xem xét trước khi áp dụng.")}</p>
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <label className="text-sm font-medium">{t("Số đề xuất tối đa")}<select className="mt-1 block rounded-xl border border-slate-300 bg-white px-3 py-2" value={limit} disabled={busy} onChange={e => { setLimit(Number(e.target.value)); setResult(null); }}>
        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
      </select></label>
      <Button disabled={busy} onClick={() => void generate(false)}>{t(busy ? 'Đang xử lý…' : 'Xem đề xuất')}</Button>
      {result && result.recommendations.some(item => item.policy) && <Button variant="secondary" disabled={busy} onClick={() => void generate(true)}>{t("Lưu đề xuất có chính sách")}</Button>}
    </div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{t(error)}</p>}
    {result && <div className="mt-4 space-y-3" aria-live="polite">
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t("Đề xuất AI chỉ để tham khảo.")}</p>
      {result.saved && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{t('Đã lưu {p0} đề xuất.', { p0: result.savedRecommendations?.length ?? 0 })}</p>}
      {!result.recommendations.length && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{t("Không có đề xuất phù hợp với dữ liệu của kết quả này.")}</p>}
      {result.recommendations.map(item => <div key={item.rank} className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{item.rank}. {t(item.policy?.name ?? item.policyDraft?.name ?? 'Đề xuất chính sách')}</h3><span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">{t(item.policy ? 'Có chính sách phù hợp' : 'Chờ phê duyệt chính sách')}</span></div>
        <p className="mt-2 text-sm text-slate-600">{t(item.policy?.description ?? item.policyDraft?.description)}</p>
        <p className="mt-2 text-sm text-slate-700">{t(item.reason)}</p>
      </div>)}
      {result.omittedCount > 0 && <p className="text-sm text-slate-500">{t('Còn {p0} đề xuất khác; tăng số đề xuất tối đa để xem.', { p0: result.omittedCount })}</p>}
    </div>}
  </Card>;
}
