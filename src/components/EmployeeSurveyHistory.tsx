import { useEffect, useState } from 'react';
import { Button, Card } from './ui';
import { useLanguage } from '../context/LanguageContext';
import { getMySurveyResponse, listMySurveyHistory, type SurveyParticipantResponse } from '../services/api';
import { surveyRatingText } from '../utils/surveyRating';

type CompletedSurvey = { id: number; title: string; submittedAt: string | null };

function OwnAnswers({ id }: { id: number }) {
  const { language } = useLanguage();
  const tr = (vi: string, en: string) => language === 'vi' ? vi : en;
  const [response, setResponse] = useState<SurveyParticipantResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResponse(null); setFailed(false);
    getMySurveyResponse(id, controller.signal).then(result => {
      if (!controller.signal.aborted) setResponse(result.data);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [id, retry]);
  if (failed) return <div role="alert" className="mt-4 text-sm text-red-700">{tr('Không tải được câu trả lời.', 'Could not load your answers.')} <Button variant="secondary" onClick={() => setRetry(value => value + 1)}>{tr('Thử lại', 'Retry')}</Button></div>;
  if (!response) return <p role="status" className="mt-4 text-sm text-slate-600">{tr('Đang tải câu trả lời…', 'Loading your answers…')}</p>;
  return <div className="mt-4 border-t border-slate-200 pt-4">
    <p className="mb-3 text-sm text-slate-600">{tr('Câu trả lời đã nộp — chỉ xem, không thể chỉnh sửa.', 'Submitted answers — read only.')}</p>
    <ol className="space-y-3">{response.answers.map((answer, index) => <li key={answer.questionId} className="rounded-lg bg-slate-50 p-4">
      <p className="font-medium text-slate-900">{index + 1}. {answer.questionText || tr('Câu hỏi', 'Question')}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{answer.questionType === 'RATING' && typeof answer.answerValue === 'number'
        ? surveyRatingText(answer.answerValue, answer.answerConfig && 'labels' in answer.answerConfig ? answer.answerConfig.labels : undefined)
        : answer.displayAnswer ?? (typeof answer.answerValue === 'object' ? answer.answerValue.selectedCodes.join('; ') : String(answer.answerValue))}</p>
      {answer.comment && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{tr('Ghi chú: ', 'Comment: ')}{answer.comment}</p>}
    </li>)}</ol>
  </div>;
}

export default function EmployeeSurveyHistory({ account, revision }: { account: string; revision: number }) {
  const { language } = useLanguage();
  const tr = (vi: string, en: string) => language === 'vi' ? vi : en;
  const [rows, setRows] = useState<CompletedSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setFailed(false); setRows([]); setExpanded(null);
    listMySurveyHistory(controller.signal).then(result => {
      if (!controller.signal.aborted) { setRows(result.data); setLoading(false); }
    }).catch(() => {
      if (!controller.signal.aborted) { setFailed(true); setLoading(false); }
    });
    return () => controller.abort();
  }, [account, revision, retry]);

  return <section className="mt-6" aria-labelledby="completed-surveys-heading">
    <div className="mb-3"><h2 id="completed-surveys-heading" className="text-lg font-semibold text-slate-950">{tr('Lịch sử khảo sát đã hoàn thành', 'Completed survey history')}</h2><p className="mt-1 text-sm text-slate-600">{tr('Xem lại các khảo sát và câu trả lời bạn đã nộp trên hệ thống.', 'Review surveys and answers you have submitted to the system.')}</p></div>
    {loading ? <Card className="p-5"><p role="status" className="text-sm text-slate-600">{tr('Đang tải lịch sử khảo sát…', 'Loading survey history…')}</p></Card>
      : failed ? <div role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><p>{tr('Không tải được lịch sử khảo sát.', 'Could not load survey history.')}</p><Button variant="secondary" className="mt-2" onClick={() => setRetry(value => value + 1)}>{tr('Thử lại', 'Retry')}</Button></div>
      : !rows.length ? <Card className="p-5"><p className="text-sm text-slate-600">{tr('Bạn chưa nộp khảo sát nào.', 'You have not submitted any surveys yet.')}</p></Card>
      : <div className="space-y-3">{rows.map(row => <Card key={row.id} className="border border-emerald-100 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><span className="text-xs font-semibold text-emerald-700">{tr('Đã hoàn thành', 'Completed')}</span><h3 className="mt-1 break-words font-semibold text-slate-900">{row.title}</h3>{row.submittedAt && <p className="mt-2 text-sm text-slate-600">{tr('Đã nộp: ', 'Submitted on ')}{new Date(row.submittedAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>}</div>
          <Button variant="secondary" aria-expanded={expanded === row.id} aria-controls={`own-survey-${row.id}`} onClick={() => setExpanded(value => value === row.id ? null : row.id)}>{expanded === row.id ? tr('Thu gọn', 'Collapse') : tr('Xem câu trả lời', 'View my answers')}</Button>
        </div>
        <div id={`own-survey-${row.id}`}>{expanded === row.id && <OwnAnswers key={`${account}-${row.id}`} id={row.id} />}</div>
      </Card>)}</div>}
  </section>;
}
