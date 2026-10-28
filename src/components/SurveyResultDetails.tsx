import { useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import type { SurveyResults } from '../services/api';
import { Button } from './ui';

export const surveyScoreLabels: Record<1 | 2 | 3 | 4, string> = {
  1: 'Not satisfied', 2: 'Neutral', 3: 'Satisfied', 4: 'Very satisfied',
};

export function SurveyResultDetails({ result, onClose }: { result: SurveyResults; onClose: () => void }) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);

  return <dialog ref={dialog} onClose={onClose} aria-labelledby="survey-result-detail-title" className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/45">
    <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white p-5 sm:p-6">
      <div><h2 id="survey-result-detail-title" className="text-lg font-bold">{t('Survey result details')}</h2><p className="mt-1 break-words text-sm text-slate-500">{result.title} · {t('Submitted responses')}: {result.responseCount}</p></div>
      <Button variant="secondary" onClick={() => dialog.current?.close()}>{t('Close')}</Button>
    </div>
    <div className="space-y-4 p-5 sm:p-6">
      {result.questions.map((question, index) => {
        const comments = question.answers?.filter(answer => answer.comment?.trim()) ?? [];
        const commentsUnavailable = question.answers === undefined;
        return <section key={question.id} className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold">{index + 1}. {question.questionText}</h3>
          <p className="mt-2 text-sm text-slate-500">{t('Average score')}: <strong className="text-orange-600">{question.averageScore?.toFixed(1) ?? '—'}</strong> · {t('Answer count')}: {question.answerCount}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{([1, 2, 3, 4] as const).map(score => <div key={score} className="rounded-lg bg-orange-50/60 p-3 text-center"><dt className="text-xs leading-5 text-slate-600">{t(surveyScoreLabels[score])}</dt><dd className="mt-1 font-semibold text-orange-700">{question.scoreDistribution[score]}</dd></div>)}</dl>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <h4 className="text-sm font-semibold text-slate-800">{t('Employee comments')}</h4>
            {commentsUnavailable ? <p className="mt-2 text-sm text-slate-500">{t('Detailed employee comments are not provided by the current results service.')}</p> : comments.length > 0 ? <ul className="mt-2 space-y-2">{comments.map((answer, answerIndex) => <li key={`${question.id}-${answerIndex}`} className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm leading-6 text-slate-700">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 flex-1 whitespace-pre-wrap break-words">{answer.comment}</p>
                {answer.score && answer.score >= 1 && answer.score <= 4 && <span className="shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">{t(surveyScoreLabels[answer.score as 1 | 2 | 3 | 4])}</span>}
              </div>
            </li>)}</ul> : <p className="mt-2 text-sm text-slate-500">{t('No employee comments for this question.')}</p>}
          </div>
        </section>;
      })}
      {result.questions.length === 0 && <p className="text-sm text-slate-500">{t('No survey answers are available yet.')}</p>}
    </div>
  </dialog>;
}
