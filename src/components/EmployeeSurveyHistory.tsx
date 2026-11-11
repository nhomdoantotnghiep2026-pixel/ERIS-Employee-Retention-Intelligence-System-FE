import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button, Card } from './ui';
import { useLanguage } from '../context/LanguageContext';
import { getMySurveyResponse } from '../services/api';
import { completedSurveyIds } from '../utils/completedSurveys';

type CompletedSurvey = { id: number; title: string; submittedAt: string | null };

export default function EmployeeSurveyHistory({ account, revision }: { account: string; revision: number }) {
  const { t, language } = useLanguage();
  const [rows, setRows] = useState<CompletedSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setFailed(false); setRows([]);
    void (async () => {
      const confirmed: CompletedSurvey[] = [];
      const ids = completedSurveyIds(account);
      let hasFailure = false;
      for (let offset = 0; offset < ids.length && !controller.signal.aborted; offset += 5) {
        const responses = await Promise.allSettled(ids.slice(offset, offset + 5).map(id => getMySurveyResponse(id, controller.signal)));
        for (const result of responses) {
          if (result.status === 'rejected') { hasFailure = true; continue; }
          const { survey, response } = result.value.data;
          if (response.status === 'SUBMITTED') confirmed.push({ id: survey.id, title: survey.title, submittedAt: response.submittedAt });
        }
      }
      if (!controller.signal.aborted) {
        setRows(confirmed.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || '')));
        setFailed(hasFailure); setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [account, revision, retry]);

  return <section className="mt-6" aria-labelledby="completed-surveys-heading">
    <div className="mb-3"><h2 id="completed-surveys-heading" className="text-lg font-semibold text-slate-950">{t('Completed survey history')}</h2><p className="mt-1 text-sm text-slate-500">{t('This history includes surveys submitted from this browser and confirmed by the server. It may not include earlier submissions or those from other devices.')}</p></div>
    {loading ? <Card className="p-5"><p role="status" className="text-sm text-slate-500">{t('Loading completed surveys...')}</p></Card>
      : <>
        {failed && <div role="alert" className="mb-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><p>{t('Some completed surveys could not be verified. Please retry.')}</p><Button variant="secondary" className="mt-2" onClick={() => setRetry(value => value + 1)}>{t('Retry')}</Button></div>}
        {!rows.length && !failed && <Card className="p-5"><p className="text-sm text-slate-500">{t('No completed surveys have been recorded in this browser yet.')}</p></Card>}
        <div className="space-y-3">{rows.map(row => <Card key={row.id} className="border border-emerald-100 p-5"><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={22} /></span><div className="min-w-0"><span className="text-xs font-semibold text-emerald-700">{t('Completed')}</span><h3 className="mt-1 break-words font-semibold text-slate-900">{row.title}</h3>{row.submittedAt && <p className="mt-2 text-sm text-slate-500">{t('Submitted on')} {new Date(row.submittedAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>}</div></div></Card>)}</div>
      </>}
  </section>;
}
