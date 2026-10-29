import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BarChart3, CalendarDays, ChevronRight, ClipboardList, MessageSquareText, Search, UsersRound } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import type { SurveyParticipantResponse, SurveyResults } from '../services/api';
import { Button } from './ui';

export const surveyScoreLabels: Record<1 | 2 | 3 | 4, string> = {
  1: 'Not satisfied', 2: 'Neutral', 3: 'Satisfied', 4: 'Very satisfied',
};

const formatDateTime = (value: string, language: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toLocaleUpperCase() || 'NV';

export function SurveyResultDetails({ result, participants, onClose }: { result: SurveyResults; participants: SurveyParticipantResponse[]; onClose: () => void }) {
  const { t, language } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<'participants' | 'summary'>('participants');
  const [selected, setSelected] = useState<SurveyParticipantResponse | null>(null);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase();
    return value ? participants.filter(item => `${item.employee.fullName} ${item.employee.employeeCode}`.toLocaleLowerCase().includes(value)) : participants;
  }, [participants, query]);

  useEffect(() => { dialog.current?.showModal(); }, []);

  const modalWidth = participants.length <= 1 ? 'max-w-4xl' : participants.length <= 4 ? 'max-w-5xl' : 'max-w-6xl';

  return <dialog ref={dialog} onClose={onClose} aria-labelledby="survey-result-detail-title" className={`fixed inset-0 m-auto max-h-[min(88dvh,860px)] w-[calc(100%-2rem)] ${modalWidth} overflow-hidden rounded-[24px] border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/45`}>
    <div className="flex max-h-[min(88dvh,860px)] min-h-0 flex-col">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          {selected && <button type="button" aria-label={t('Back to participant list')} className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700" onClick={() => setSelected(null)}><ArrowLeft size={18} /></button>}
          <div className="min-w-0"><h2 id="survey-result-detail-title" className="truncate text-lg font-bold sm:text-xl">{selected ? selected.employee.fullName : t('Survey result details')}</h2><p className="mt-1 truncate text-sm text-slate-500">{selected ? `${selected.employee.employeeCode} · ${t('Submitted at')} ${formatDateTime(selected.submittedAt, language)}` : `${result.title} · ${t('Submitted responses')}: ${result.responseCount}`}</p></div>
        </div>
        <Button type="button" variant="secondary" onClick={() => dialog.current?.close()}>{t('Close')}</Button>
      </header>

      {!selected && <nav aria-label={t('Survey result views')} className="flex shrink-0 gap-1 border-b border-slate-100 bg-slate-50/70 px-5 pt-3 sm:px-6">
        <button type="button" className={`flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition ${tab === 'participants' ? 'border-orange-500 text-orange-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`} onClick={() => setTab('participants')}><UsersRound size={17} />{t('Participants')}<span className="rounded-full bg-white px-2 py-0.5 text-xs tabular-nums ring-1 ring-slate-200">{result.responseCount}</span></button>
        <button type="button" className={`flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition ${tab === 'summary' ? 'border-orange-500 text-orange-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`} onClick={() => setTab('summary')}><BarChart3 size={17} />{t('Question overview')}</button>
      </nav>}

      <div className="min-h-0 overflow-y-auto bg-slate-50/50 p-5 sm:p-6">
        {selected ? <ParticipantAnswers participant={selected} t={t} /> : tab === 'participants' ? <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="text-base font-semibold text-slate-950">{t('Participating employees')}</h3><p className="mt-1 text-sm text-slate-500">{t('Select an employee to review every answer and comment.')}</p></div>
            {participants.length >= 5 && <label className="relative block w-full sm:w-72"><span className="sr-only">{t('Search participants')}</span><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Search name or employee code')} className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100" /></label>}
          </div>
          {participants.length > 0 ? <div className="grid gap-3 lg:grid-cols-2">{filtered.map((participant, index) => <button type="button" key={participant.responseId} onClick={() => setSelected(participant)} className="group flex min-w-0 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 font-bold text-orange-700 ring-1 ring-orange-100">{initials(participant.employee.fullName)}</span><span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-950">{participant.employee.fullName}</span><span className="mt-1 block truncate text-sm text-slate-500">{participant.employee.employeeCode} · {t('Response')} #{index + 1}</span><span className="mt-2 flex items-center gap-1.5 text-xs text-slate-400"><CalendarDays size={14} />{formatDateTime(participant.submittedAt, language)}</span></span><span className="flex size-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition group-hover:bg-orange-50 group-hover:text-orange-600"><ChevronRight size={19} /></span>
          </button>)}</div> : <div className="rounded-[20px] border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><UsersRound size={26} /></span><h4 className="mt-4 font-semibold text-slate-900">{t('No employees have submitted this survey yet.')}</h4><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">{t('Submitted employee responses will appear here.')}</p></div>}
          {participants.length > 0 && filtered.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{t('No matching participants found.')}</p>}
        </section> : <QuestionSummary result={result} t={t} />}
      </div>
    </div>
  </dialog>;
}

function ParticipantAnswers({ participant, t }: { participant: SurveyParticipantResponse; t: (key: string) => string }) {
  const answers = [...participant.answers].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const comments = answers.map((answer, index) => ({ ...answer, questionNumber: index + 1 })).filter(answer => answer.comment?.trim());
  return <section className="mx-auto max-w-4xl"><div className="mb-5 flex items-center gap-3 rounded-2xl border border-orange-100 bg-orange-50/70 p-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-orange-600 shadow-sm"><ClipboardList size={21} /></span><div><h3 className="font-semibold text-slate-950">{t('Individual response details')}</h3><p className="mt-1 text-sm text-slate-600">{answers.length} {t('answered questions')}</p></div></div>
    <div className="space-y-4">{answers.map((answer, index) => <article key={answer.questionId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="p-5"><div className="flex items-start gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-orange-50 text-sm font-bold text-orange-700">{index + 1}</span><div className="min-w-0 flex-1"><h4 className="font-semibold leading-6 text-slate-950">{answer.questionText}</h4>{answer.dimensionCode && <p className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">{answer.dimensionCode}</p>}</div></div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{([1, 2, 3, 4] as const).map(score => <div key={score} className={`rounded-xl border px-2 py-3 text-center transition ${answer.score === score ? 'border-orange-400 bg-orange-50 text-orange-800 shadow-sm' : 'border-slate-100 bg-slate-50 text-slate-400'}`}><span className="block text-xs leading-5">{t(surveyScoreLabels[score])}</span><strong className="mt-1 block text-base">{score}</strong></div>)}</div></div>
      </article>)}{answers.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">{t('No survey answers are available yet.')}</p>}</div>
    {answers.length > 0 && <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4"><span className="flex size-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><MessageSquareText size={18} /></span><div><h4 className="font-semibold text-slate-950">{t('Employee comments')}</h4><p className="mt-0.5 text-sm text-slate-500">{t('Comments are grouped at the end for easier review.')}</p></div></header><div className="space-y-3 p-5">{comments.length > 0 ? comments.map(answer => <article key={answer.questionId} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wide text-orange-600">{t('Question')} {answer.questionNumber}</p><p className="mt-1 text-sm font-medium leading-6 text-slate-800">{answer.questionText}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{answer.comment}</p></article>) : <p className="py-3 text-center text-sm italic text-slate-500">{t('No comment was provided.')}</p>}</div></section>}
  </section>;
}

function QuestionSummary({ result, t }: { result: SurveyResults; t: (key: string) => string }) {
  return <section><div className="mb-4"><h3 className="text-base font-semibold text-slate-950">{t('Question overview')}</h3><p className="mt-1 text-sm text-slate-500">{t('Review average scores, distribution and available comments by question.')}</p></div><div className="space-y-4">{result.questions.map((question, index) => {
    const comments = question.answers?.filter(answer => answer.comment?.trim()) ?? [];
    const commentsUnavailable = question.answers === undefined;
    return <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h4 className="font-semibold leading-6">{index + 1}. {question.questionText}</h4><p className="mt-2 text-sm text-slate-500">{t('Average score')}: <strong className="text-orange-600">{question.averageScore?.toFixed(1) ?? '—'}</strong> · {t('Answer count')}: {question.answerCount}</p><dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{([1, 2, 3, 4] as const).map(score => <div key={score} className="rounded-xl bg-orange-50/60 p-3 text-center"><dt className="text-xs leading-5 text-slate-600">{t(surveyScoreLabels[score])}</dt><dd className="mt-1 font-semibold text-orange-700">{question.scoreDistribution[score]}</dd></div>)}</dl><div className="mt-4 border-t border-slate-100 pt-4"><h5 className="text-sm font-semibold text-slate-800">{t('Employee comments')}</h5>{commentsUnavailable ? <p className="mt-2 text-sm text-slate-500">{t('Detailed employee comments are not provided by the current results service.')}</p> : comments.length > 0 ? <ul className="mt-2 space-y-2">{comments.map((answer, answerIndex) => <li key={`${question.id}-${answerIndex}`} className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm leading-6 text-slate-700">{answer.comment}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">{t('No employee comments for this question.')}</p>}</div></article>;
  })}{result.questions.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">{t('No survey answers are available yet.')}</p>}</div></section>;
}
