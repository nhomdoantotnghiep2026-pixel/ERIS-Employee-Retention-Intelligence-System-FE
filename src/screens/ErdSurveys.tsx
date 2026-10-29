import { useEffect, useState, type FormEvent } from 'react';
import {
  BarChart3, CalendarDays, CheckCircle2, ClipboardList, Clock3, Eye,
  FilePlus2, MessageSquareText, PlayCircle, Send, Sparkles, UsersRound,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Button, Card, ConfirmationDialog, EmptyState, SectionHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { useRole } from '../context/RoleContext';
import { SurveyResultDetails, surveyScoreLabels } from '../components/SurveyResultDetails';
import {
  ApiError, createSurvey, getApiErrorMessage, getMySurveyResponse, getSurveyForEmployee,
  getSurveyParticipants, getSurveyResults, listAvailableSurveys, listSurveys, publishSurvey, submitSurveyResponse,
  type AvailableSurvey, type SurveyParticipantResponse, type SurveyQuestion, type SurveyResults, type SurveySummary,
} from '../services/api';

const control = 'mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100';
const dateWithZone = (date: string, endOfDay = false) => `${date}T${endOfDay ? '23:59:59' : '00:00:00'}+07:00`;
const scoreLabels: Record<number, string> = surveyScoreLabels;

export default function ErdSurveys() {
  const { t, language } = useLanguage();
  const { user } = useRole();
  const isHr = user.role === 'HR';
  const [surveys, setSurveys] = useState<SurveySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [eligibilityBlocked, setEligibilityBlocked] = useState(false);
  const [message, setMessage] = useState('');
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState({ title: '', description: '', startDate: '', endDate: '' });
  const [activeSurvey, setActiveSurvey] = useState<number | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, { score: number; comment: string }>>({});
  const [results, setResults] = useState<Record<number, SurveyResults>>({});
  const [openResults, setOpenResults] = useState<number | null>(null);
  const [detailResult, setDetailResult] = useState<{ result: SurveyResults; participants: SurveyParticipantResponse[] } | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [publishTarget, setPublishTarget] = useState<SurveySummary | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setEligibilityBlocked(false);
    const load = isHr ? listSurveys(controller.signal) : listAvailableSurveys(controller.signal);
    void load.then(result => {
      if (!controller.signal.aborted) setSurveys(result.data);
    }).catch(cause => {
      if (controller.signal.aborted) return;
      if (!isHr && cause instanceof ApiError && cause.status === 403) {
        setSurveys([]);
        setEligibilityBlocked(true);
      } else {
        setError(getApiErrorMessage(cause, 'Could not load surveys.'));
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [isHr, reload]);

  useEffect(() => {
    document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeSurvey]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError(''); setMessage(''); setPending(true);
    try {
      await createSurvey({
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        startDate: dateWithZone(draft.startDate),
        endDate: dateWithZone(draft.endDate, true),
      });
      setDraft({ title: '', description: '', startDate: '', endDate: '' });
      setMessage('Survey created as a draft. Publish it when it is ready.');
      setReload(value => value + 1);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not create the survey.'));
    } finally {
      setPending(false);
    }
  }

  async function publish(id: number) {
    if (pending) return;
    setError(''); setMessage(''); setPending(true);
    try {
      await publishSurvey(id);
      setMessage('Survey published successfully.');
      setReload(value => value + 1);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not publish the survey.'));
    } finally {
      setPending(false);
    }
  }

  async function showResults(id: number, details = false) {
    if (loadingResults) return;
    setError('');
    if (!details && openResults === id) { setOpenResults(null); return; }
    setLoadingResults(true);
    try {
      const { data } = await getSurveyResults(id);
      setResults(current => ({ ...current, [id]: data }));
      if (details) {
        const participantResult = await getSurveyParticipants(id);
        setDetailResult({ result: data, participants: participantResult.data.participants });
      }
      else setOpenResults(id);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not load survey results.'));
    } finally {
      setLoadingResults(false);
    }
  }

  async function openSurvey(id: number) {
    setError(''); setMessage(''); setAnswers({});
    try {
      const { data } = await getSurveyForEmployee(id);
      let savedAnswers: Record<number, { score: number; comment: string }> = {};
      try {
        const previous = await getMySurveyResponse(id);
        savedAnswers = Object.fromEntries(previous.data.answers.flatMap(answer =>
          answer.score == null ? [] : [[answer.questionId, { score: answer.score, comment: answer.comment || '' }]],
        ));
      } catch (cause) {
        if (!(cause instanceof ApiError) || cause.status !== 404) throw cause;
      }
      setQuestions(data.questions);
      setAnswers(savedAnswers);
      setActiveSurvey(id);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not load this survey.'));
    }
  }

  async function submit(id: number) {
    if (pending) return;
    setError(''); setMessage(''); setPending(true);
    try {
      await submitSurveyResponse(id, questions.flatMap(question => {
        const answer = answers[question.id];
        return answer?.score ? [{
          questionId: question.id,
          score: answer.score,
          comment: answer.comment.trim() || null,
        }] : [];
      }));
      setActiveSurvey(null);
      setMessage('Your survey response was submitted successfully.');
      setReload(value => value + 1);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not submit your response.'));
    } finally {
      setPending(false);
    }
  }

  const requiredAnswered = questions.every(question => !question.required || Boolean(answers[question.id]?.score));
  const currentSurvey = surveys.find(survey => survey.id === activeSurvey) as AvailableSurvey | undefined;
  const totalResponses = surveys.reduce((sum, survey) => sum + (survey.responseCount || 0), 0);
  const dateLabel = (value: string | null | undefined) => value
    ? new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
    : '—';
  const statusStyle = (status: SurveySummary['status']) => status === 'ACTIVE'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : status === 'DRAFT'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-slate-200 bg-slate-100 text-slate-600';

  return <AppShell breadcrumb={['Engagement', isHr ? 'Survey management' : 'My surveys']}>
    <SectionHeader
      title={t(isHr ? 'Khảo sát và kết quả theo nhân viên' : 'Khảo sát của tôi')}
      description={t(isHr ? 'Create, publish and track employee survey participation.' : 'Hoàn thành các khảo sát đang mở và chia sẻ phản hồi của bạn.')}
    />

    {error && <p role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{t(error)}</p>}
    {message && <p role="status" className="mb-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"><CheckCircle2 size={18} />{t(message)}</p>}

    {!isHr && eligibilityBlocked && <Card className="p-6">
      <EmptyState icon={<ClipboardList size={42} />} title="No surveys are currently available." />
    </Card>}

    {isHr && <>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: t('Total surveys'), value: surveys.length, icon: ClipboardList, tone: 'bg-orange-50 text-orange-600' },
          { label: t('Active'), value: surveys.filter(item => item.status === 'ACTIVE').length, icon: PlayCircle, tone: 'bg-emerald-50 text-emerald-600' },
          { label: t('Drafts'), value: surveys.filter(item => item.status === 'DRAFT').length, icon: FilePlus2, tone: 'bg-amber-50 text-amber-600' },
          { label: t('Submitted responses'), value: totalResponses, icon: UsersRound, tone: 'bg-blue-50 text-blue-600' },
        ].map(({ label, value, icon: Icon, tone }) => <Card key={label} className="flex items-center gap-4 p-4 sm:p-5">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${tone}`}><Icon size={21} /></span>
          <div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-950">{error && surveys.length === 0 ? '—' : value}</p></div>
        </Card>)}
      </div>

      <Card className="mb-6 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <span className="flex size-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><FilePlus2 size={20} /></span>
          <div><h2 className="text-base font-semibold text-slate-950">{t('Create survey')}</h2><p className="mt-0.5 text-sm text-slate-500">{t('Create a draft first, then publish it when the schedule is ready.')}</p></div>
        </div>
        <form onSubmit={event => void create(event)} className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <label className="text-sm font-semibold text-slate-700">{t('Title')}<input required maxLength={255} className={control} placeholder={t('Enter survey title')} value={draft.title} onChange={event => setDraft(value => ({ ...value, title: event.target.value }))} /></label>
          <label className="text-sm font-semibold text-slate-700">{t('Description')}<input className={control} placeholder={t('Briefly describe the survey purpose')} value={draft.description} onChange={event => setDraft(value => ({ ...value, description: event.target.value }))} /></label>
          <label className="text-sm font-semibold text-slate-700">{t('Start date')}<input required type="date" className={control} value={draft.startDate} onChange={event => setDraft(value => ({ ...value, startDate: event.target.value }))} /></label>
          <label className="text-sm font-semibold text-slate-700">{t('End date')}<input required type="date" min={draft.startDate || undefined} className={control} value={draft.endDate} onChange={event => setDraft(value => ({ ...value, endDate: event.target.value }))} /></label>
          <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-sm text-slate-600"><Sparkles size={17} className="shrink-0 text-orange-500" />{t('The server attaches its standard required questions to each survey.')}</p>
            <Button disabled={pending}><FilePlus2 size={16} />{t(pending ? 'Saving...' : 'Create draft')}</Button>
          </div>
        </form>
      </Card>
    </>}

    {activeSurvey !== null && !isHr && <Card className="mb-6 overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-orange-50 to-white px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="min-w-0"><span className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-orange-600"><MessageSquareText size={14} />{t('Employee survey')}</span><h2 className="break-words text-xl font-semibold text-slate-950">{currentSurvey?.title || t('Survey')}</h2>{currentSurvey?.description && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{currentSurvey.description}</p>}</div>
        <Button type="button" variant="secondary" onClick={() => setActiveSurvey(null)}>{t('Cancel')}</Button>
      </div>
      <form className="p-5 sm:p-6" onSubmit={event => { event.preventDefault(); void submit(activeSurvey); }}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600"><span>{questions.filter(question => answers[question.id]?.score).length}/{questions.length} {t('questions answered')}</span><span>{t('Scale')}: 1–4</span></div>
        <div className="space-y-4">{questions.map((question, index) => <fieldset key={question.id} className="rounded-2xl border border-slate-200 p-4 sm:p-5">
          <legend className="sr-only">{question.questionText}</legend>
          <div className="flex items-start gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-bold text-orange-700">{index + 1}</span><div className="min-w-0"><p className="text-sm font-semibold leading-6 text-slate-900">{question.questionText}{question.required && <span className="ml-1 text-red-500">*</span>}</p><p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">{question.dimensionCode}</p></div></div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={t('Satisfaction rating')}>{[1, 2, 3, 4].map(score => <button key={score} type="button" aria-pressed={answers[question.id]?.score === score} onClick={() => setAnswers(current => ({ ...current, [question.id]: { score, comment: current[question.id]?.comment || '' } }))} className={`min-h-14 rounded-xl border px-3 py-2 text-sm font-semibold leading-5 transition focus-visible:outline-2 focus-visible:outline-orange-500 ${answers[question.id]?.score === score ? 'border-orange-500 bg-orange-500 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:bg-orange-50'}`}>{t(scoreLabels[score])}</button>)}</div>
          <label className="mt-4 block text-sm font-medium text-slate-600">{t('Comment')} <span className="font-normal text-slate-400">({t('optional')})</span><textarea maxLength={1000} rows={2} className="mt-2 min-h-20 w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100" placeholder={t('Add context for your score')} value={answers[question.id]?.comment || ''} onChange={event => setAnswers(current => ({ ...current, [question.id]: { score: current[question.id]?.score || 0, comment: event.target.value } }))} /></label>
        </fieldset>)}</div>
        <div className="mt-6 flex justify-end"><Button disabled={pending || !requiredAnswered}><Send size={16} />{t(pending ? 'Submitting...' : 'Submit response')}</Button></div>
      </form>
    </Card>}

    {!eligibilityBlocked && (isHr || activeSurvey === null) && <><div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-950">{t(isHr ? 'Survey list' : 'Available surveys')}</h2><p className="mt-1 text-sm text-slate-500">{t(isHr ? 'Review status, participation and results for every survey.' : 'Select a survey to begin your response.')}</p></div></div>
    {loading ? <Card className="p-8"><p role="status" className="text-center text-sm font-medium text-slate-500">{t('Loading surveys...')}</p></Card>
      : error && surveys.length === 0 ? <Card className="p-6"><p className="mb-3 text-sm text-slate-500">{t('Could not load surveys. Please retry.')}</p><Button variant="secondary" onClick={() => setReload(value => value + 1)}>{t('Retry loading surveys')}</Button></Card>
      : surveys.length === 0 ? <Card className="p-6"><EmptyState icon={<ClipboardList size={42} />} title={isHr ? 'No surveys have been created.' : 'No surveys are currently available.'} description={isHr ? 'Create the first survey draft using the form above.' : 'New surveys will appear here when HR publishes them.'} /></Card>
        : <div className="space-y-4">{surveys.map(survey => {
          const available = survey as AvailableSurvey;
          const result = results[survey.id];
          return <Card key={survey.id} className="overflow-hidden">
            <div className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle(survey.status)}`}>{t(survey.status)}</span>{!isHr && <span className="inline-flex min-h-7 items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{t(available.responseStatus === 'IN_PROGRESS' ? 'In progress' : 'Not started')}</span>}</div><h3 className="mt-3 break-words text-lg font-semibold leading-7 text-slate-950 [overflow-wrap:anywhere]">{survey.title}</h3>{survey.description && <p className="mt-1 max-w-3xl break-words text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">{survey.description}</p>}
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500"><span className="inline-flex items-center gap-1.5"><CalendarDays size={16} />{dateLabel(survey.startDate)} – {dateLabel(survey.endDate)}</span><span className="inline-flex items-center gap-1.5"><ClipboardList size={16} />{survey.questionCount ?? available.questionCount ?? 0} {t('questions')}</span>{isHr && <span className="inline-flex items-center gap-1.5"><UsersRound size={16} />{survey.responseCount ?? 0} {t('responses')}</span>}{isHr && survey.createdByName && <span className="inline-flex items-center gap-1.5"><Clock3 size={16} />{t('Created by')} {survey.createdByName}</span>}</div>
                </div>
                {isHr ? <div className="flex shrink-0 flex-wrap gap-2">{survey.status === 'DRAFT' && <Button disabled={pending} onClick={() => setPublishTarget(survey)}><PlayCircle size={16} />{t('Publish')}</Button>}<Button variant="secondary" disabled={loadingResults} onClick={() => void showResults(survey.id)}><Eye size={16} />{t(openResults === survey.id ? 'Hide results' : 'View results')}</Button><Button variant="secondary" disabled={loadingResults} onClick={() => void showResults(survey.id, true)}><Eye size={16} />{t('View result details')}</Button></div> : <Button disabled={activeSurvey === survey.id} onClick={() => void openSurvey(survey.id)}><PlayCircle size={16} />{t(available.responseStatus === 'IN_PROGRESS' ? 'Continue survey' : 'Start survey')}</Button>}
              </div>
            </div>
            {isHr && openResults === survey.id && result && <div className="border-t border-slate-100 bg-slate-50/70 p-5 sm:p-6"><div className="mb-4 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><BarChart3 size={20} /></span><div><h4 className="text-base font-semibold text-slate-950">{t('Survey results')}</h4><p className="text-sm text-slate-500">{t('Submitted responses')}: {result.responseCount}</p></div></div><div className="grid gap-3 xl:grid-cols-2">{result.questions.map(question => <div key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-semibold leading-5 text-slate-900">{question.questionText}</p><p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">{question.dimensionCode} · {question.answerCount} {t('answers')}</p></div><span className="shrink-0 text-lg font-bold text-orange-600">{question.averageScore?.toFixed(1) ?? '—'}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600" style={{ width: `${question.averageScore == null ? 0 : (question.averageScore / 4) * 100}%` }} /></div><div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">{[1, 2, 3, 4].map(score => <div key={score} className="rounded-lg bg-slate-50 px-1 py-2"><span className="block text-xs leading-5 text-slate-600">{t(scoreLabels[score])}</span><strong className="text-sm text-slate-700">{question.scoreDistribution[score as 1 | 2 | 3 | 4]}</strong></div>)}</div></div>)}</div></div>}
          </Card>;
        })}</div>}</>}

    {isHr && detailResult && <SurveyResultDetails result={detailResult.result} participants={detailResult.participants} onClose={() => setDetailResult(null)} />}
    <ConfirmationDialog open={Boolean(publishTarget)} title="Publish survey?" description="Employees will be able to see and answer this survey during its scheduled period." confirmLabel="Publish" onCancel={() => setPublishTarget(null)} onConfirm={() => { const target = publishTarget; setPublishTarget(null); if (target) void publish(target.id); }} />
  </AppShell>;
}
