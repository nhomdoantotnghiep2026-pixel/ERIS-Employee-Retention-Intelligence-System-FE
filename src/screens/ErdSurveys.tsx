import { useEffect, useState, type FormEvent } from 'react';
import {
  BarChart3, CalendarDays, CheckCircle2, ClipboardList, Eye, FilePlus2, ListChecks,
  Pencil, PlayCircle, Plus, Send, Sparkles, Trash2, UsersRound,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Button, Card, ConfirmationDialog, EmptyState, SectionHeader } from '../components/ui';
import { SurveyResultDetails } from '../components/SurveyResultDetails';
import EmployeeSurveyHistory from '../components/EmployeeSurveyHistory';
import { useLanguage } from '../context/LanguageContext';
import { useRole } from '../context/RoleContext';
import { useAutoDismissFeedback } from '../hooks/useAutoDismissState';
import { rememberCompletedSurvey } from '../utils/completedSurveys';
import { employeeDate } from '../utils/employeeDates';
import {
  ApiError, addSurveyQuestion, closeSurvey, createSurvey, deleteSurveyQuestion, getApiErrorMessage,
  getSurveyForEmployee, getSurveyParticipants, getSurveyResults, listAvailableSurveys,
  listSurveyCategories, listSurveys, publishSurvey, submitSurveyResponse, updateSurvey,
  updateSurveyQuestion, type SurveyAnswerConfig, type SurveyAnswerValue, type SurveyCategory,
  type SurveyParticipantResponse, type SurveyQuestion, type SurveyQuestionInput,
  type SurveyQuestionType, type SurveyResults, type SurveySummary,
} from '../services/api';

const control = 'mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100';
const area = 'mt-2 min-h-24 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100';
const dateWithZone = (date: string, endOfDay = false) => `${date}T${endOfDay ? '23:59:59' : '00:00:00'}+07:00`;
const ratingLabels = ['Rất không hài lòng', 'Không hài lòng', 'Không hài lòng cũng không bất mãn', 'Hài lòng', 'Rất hài lòng'];
const cycleLabels = { 1: 'Cycle 1 · Compensation and working time', 2: 'Cycle 2 · Environment and development', 3: 'Cycle 3 · Engagement and job fit' } as const;
const questionTypeLabels: Record<SurveyQuestionType, string> = { RATING: 'Thang điểm 1–5', TEXT: 'Câu trả lời văn bản', SINGLE_CHOICE: 'Chọn một', MULTIPLE_CHOICE: 'Chọn nhiều' };
const topicLabel = (name: string) => name.split('_').map(word => word.charAt(0) + word.slice(1).toLocaleLowerCase()).join(' ');
const isChoiceConfig = (config: SurveyAnswerConfig): config is { options: Array<{ code: string; label: string }> } => Boolean(config && 'options' in config);
const isRatingConfig = (config: SurveyAnswerConfig): config is { min: 1; max: 5; labels: string[]; templateCode?: string } => Boolean(config && 'labels' in config);

type Draft = { title: string; description: string; startDate: string; endDate: string; cycleNumber: 1 | 2 | 3; categoryIds: number[] };
type AnswerDraft = { value?: SurveyAnswerValue; comment: string };
type QuestionDraft = { questionId?: number; questionText: string; categoryId: number; questionType: SurveyQuestionType; options: string; displayOrder: number };
const emptyDraft = (): Draft => ({ title: '', description: '', startDate: '', endDate: '', cycleNumber: 1, categoryIds: [] });
const emptyQuestion = (): QuestionDraft => ({ questionText: '', categoryId: 0, questionType: 'RATING', options: '', displayOrder: 100 });

export default function ErdSurveys() {
  const { t, language } = useLanguage();
  const { user } = useRole();
  const isHr = user.role === 'HR';
  const [surveys, setSurveys] = useState<SurveySummary[]>([]);
  const [categories, setCategories] = useState<SurveyCategory[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editSurvey, setEditSurvey] = useState<SurveySummary | null>(null);
  const [managedSurvey, setManagedSurvey] = useState<(SurveySummary & { questions: SurveyQuestion[] }) | null>(null);
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>(emptyQuestion);
  const [activeSurvey, setActiveSurvey] = useState<(SurveySummary & { questions: SurveyQuestion[] }) | null>(null);
  const [answers, setAnswers] = useState<Record<number, AnswerDraft>>({});
  const [results, setResults] = useState<Record<number, SurveyResults>>({});
  const [openResults, setOpenResults] = useState<number | null>(null);
  const [detailResult, setDetailResult] = useState<{ result: SurveyResults; participants: SurveyParticipantResponse[] } | null>(null);
  const [publishTarget, setPublishTarget] = useState<SurveySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [eligibilityBlocked, setEligibilityBlocked] = useState(false);
  const [pending, setPending] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [reload, setReload] = useState(0);
  const { error, message, setError, setMessage } = useAutoDismissFeedback();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadFailed(false); setEligibilityBlocked(false); setError('');
    const load = isHr ? listSurveys(controller.signal) : listAvailableSurveys(controller.signal);
    void load.then(result => { if (!controller.signal.aborted) setSurveys(result.data); }).catch(cause => {
      if (controller.signal.aborted) return;
      if (!isHr && cause instanceof ApiError && cause.status === 403) { setSurveys([]); setEligibilityBlocked(true); }
      else { setLoadFailed(true); setError(getApiErrorMessage(cause, 'Không thể tải danh sách khảo sát.')); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [isHr, reload, setError, user.email]);

  useEffect(() => {
    if (!isHr || editSurvey) return;
    const controller = new AbortController();
    void listSurveyCategories(draft.cycleNumber, controller.signal).then(result => {
      if (!controller.signal.aborted) { setCategories(result.data); setDraft(current => ({ ...current, categoryIds: [] })); }
    }).catch(cause => { if (!controller.signal.aborted) setError(getApiErrorMessage(cause, 'Không thể tải chủ đề khảo sát.')); });
    return () => controller.abort();
  }, [draft.cycleNumber, editSurvey, isHr, setError]);

  const dateLabel = (value: string | null | undefined) => {
    const date = employeeDate(value);
    return date ? new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)) : '—';
  };
  const selectedCategories = categories.filter(category => draft.categoryIds.includes(category.id));
  const hasMainTopic = selectedCategories.some(category => category.name !== 'OTHER');
  const defaultCount = selectedCategories.reduce((sum, category) => sum + category.defaultQuestions.length, 0);
  const totalResponses = surveys.reduce((sum, survey) => sum + (survey.responseCount || 0), 0);

  async function create(event: FormEvent) {
    event.preventDefault(); if (pending || !hasMainTopic) return;
    setPending(true); setError(''); setMessage('');
    try {
      await createSurvey({ title: draft.title.trim(), description: draft.description.trim() || null, cycleNumber: draft.cycleNumber,
        categoryIds: draft.categoryIds, questions: [], startDate: dateWithZone(draft.startDate), endDate: dateWithZone(draft.endDate, true) });
      setDraft(emptyDraft()); setMessage('Đã tạo bản nháp khảo sát cùng bộ câu hỏi hài lòng mặc định.'); setReload(value => value + 1);
    } catch (cause) { setError(getApiErrorMessage(cause, 'Không thể tạo khảo sát.')); }
    finally { setPending(false); }
  }

  async function saveSurvey(event: FormEvent) {
    event.preventDefault(); if (!editSurvey || pending) return;
    setPending(true); setError('');
    try {
      await updateSurvey(editSurvey.id, { title: draft.title.trim(), description: draft.description.trim() || null,
        startDate: dateWithZone(draft.startDate), endDate: dateWithZone(draft.endDate, true) });
      setEditSurvey(null); setDraft(emptyDraft()); setMessage('Đã cập nhật thông tin khảo sát.'); setReload(value => value + 1);
    } catch (cause) { setError(getApiErrorMessage(cause, 'Không thể cập nhật khảo sát.')); }
    finally { setPending(false); }
  }

  async function loadSurveyContent(survey: SurveySummary) {
    setError('');
    try {
      const detail = await getSurveyForEmployee(survey.id);
      setManagedSurvey(detail.data);
      const cycle = detail.data.cycleNumber;
      if (cycle) {
        const topicResult = await listSurveyCategories(cycle);
        const selectedIds = new Set(detail.data.questions.filter(question => question.isSatisfactionCore).map(question => question.categoryId));
        const allowedTopics = topicResult.data.filter(category => category.name === 'OTHER' || selectedIds.has(category.id));
        setCategories(allowedTopics);
        setQuestionDraft(current => ({ ...current, categoryId: allowedTopics[0]?.id || 0 }));
      }
    } catch (cause) { setError(getApiErrorMessage(cause, 'Không thể tải nội dung khảo sát.')); }
  }

  function questionInput(value: QuestionDraft): SurveyQuestionInput {
    let answerConfig: SurveyAnswerConfig = null;
    if (value.questionType === 'RATING') answerConfig = { min: 1, max: 5, labels: ratingLabels };
    if (value.questionType === 'SINGLE_CHOICE' || value.questionType === 'MULTIPLE_CHOICE') {
      const labels = value.options.split('\n').map(option => option.trim()).filter(Boolean);
      answerConfig = { options: labels.map((label, index) => ({ code: `OPTION_${index + 1}`, label })) };
    }
    return { questionText: value.questionText.trim(), categoryId: value.categoryId, questionType: value.questionType, answerConfig, displayOrder: value.displayOrder };
  }

  async function saveQuestion(event: FormEvent) {
    event.preventDefault(); if (!managedSurvey || pending) return;
    setPending(true); setError('');
    try {
      const input = questionInput(questionDraft);
      if (questionDraft.questionId) await updateSurveyQuestion(managedSurvey.id, questionDraft.questionId, input);
      else await addSurveyQuestion(managedSurvey.id, input);
      const detail = await getSurveyForEmployee(managedSurvey.id);
      setManagedSurvey(detail.data); setQuestionDraft({ ...emptyQuestion(), categoryId: categories[0]?.id || 0 });
      setMessage(questionDraft.questionId ? 'Đã cập nhật câu hỏi.' : 'Đã thêm câu hỏi tùy chỉnh.'); setReload(value => value + 1);
    } catch (cause) { setError(getApiErrorMessage(cause, 'Không thể lưu câu hỏi.')); }
    finally { setPending(false); }
  }

  async function removeQuestion(question: SurveyQuestion) {
    if (!managedSurvey || question.isSatisfactionCore || pending || !window.confirm('Xóa câu hỏi tùy chỉnh này?')) return;
    setPending(true); setError('');
    try {
      await deleteSurveyQuestion(managedSurvey.id, question.id);
      setManagedSurvey(current => current ? { ...current, questions: current.questions.filter(item => item.id !== question.id) } : current);
      setMessage('Đã xóa câu hỏi.'); setReload(value => value + 1);
    } catch (cause) { setError(getApiErrorMessage(cause, 'Không thể xóa câu hỏi.')); }
    finally { setPending(false); }
  }

  async function publish(id: number) {
    if (pending) return; setPending(true); setError('');
    try { await publishSurvey(id); setManagedSurvey(null); setMessage('Đã xuất bản khảo sát.'); setReload(value => value + 1); }
    catch (cause) { setError(getApiErrorMessage(cause, 'Không thể xuất bản khảo sát.')); }
    finally { setPending(false); }
  }

  async function finishSurvey(id: number) {
    if (pending || !window.confirm('Đóng khảo sát? Nhân viên sẽ không thể gửi câu trả lời mới.')) return;
    setPending(true); setError('');
    try { await closeSurvey(id); setMessage('Đã đóng khảo sát.'); setReload(value => value + 1); }
    catch (cause) { setError(getApiErrorMessage(cause, 'Không thể đóng khảo sát.')); }
    finally { setPending(false); }
  }

  async function showResults(id: number, details = false) {
    if (loadingResults) return;
    if (!details && openResults === id) { setOpenResults(null); return; }
    setLoadingResults(true); setError('');
    try {
      const result = await getSurveyResults(id); setResults(current => ({ ...current, [id]: result.data }));
      if (details) { const participants = await getSurveyParticipants(id); setDetailResult({ result: result.data, participants: participants.data }); }
      else setOpenResults(id);
    } catch (cause) { setError(getApiErrorMessage(cause, 'Không thể tải kết quả khảo sát.')); }
    finally { setLoadingResults(false); }
  }

  async function openEmployeeSurvey(id: number) {
    setError(''); setAnswers({});
    try { const detail = await getSurveyForEmployee(id); setActiveSurvey(detail.data); }
    catch (cause) { setError(getApiErrorMessage(cause, 'Không thể mở khảo sát.')); }
  }

  const answered = (question: SurveyQuestion) => {
    const value = answers[question.id]?.value;
    if (question.questionType === 'TEXT') return typeof value === 'string' && Boolean(value.trim());
    if (question.questionType === 'RATING') return Number.isInteger(value);
    return typeof value === 'object' && value !== null && 'selectedCodes' in value && value.selectedCodes.length > 0;
  };
  const allAnswered = Boolean(activeSurvey?.questions.length) && activeSurvey!.questions.every(answered);

  async function submit(id: number) {
    if (!activeSurvey || pending || !allAnswered) return;
    setPending(true); setError('');
    try {
      const response = await submitSurveyResponse(id, activeSurvey.questions.map(question => ({ questionId: question.id,
        answerValue: answers[question.id].value!, comment: answers[question.id].comment.trim() || null })));
      rememberCompletedSurvey(user.email, id); setActiveSurvey(null);
      setMessage(response.data.satisfactionScore == null ? 'Đã gửi câu trả lời khảo sát.' : `Đã gửi khảo sát. Điểm hài lòng tổng hợp: ${response.data.satisfactionScore.toFixed(2)}/5.`);
      setReload(value => value + 1);
    } catch (cause) { setError(getApiErrorMessage(cause, 'Không thể gửi khảo sát.')); }
    finally { setPending(false); }
  }

  const statusStyle = (status: SurveySummary['status']) => status === 'ACTIVE' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : status === 'DRAFT' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-100 text-slate-600';

  return <AppShell breadcrumb={['Engagement', isHr ? 'Quản lý khảo sát' : 'Khảo sát của tôi']}>
    <SectionHeader title={t(isHr ? 'Employee engagement surveys' : 'My surveys')} description={t(isHr ? 'Design surveys by cycle, manage questions, publish and review results.' : 'Complete open surveys and send confidential feedback to HR.')} />
    {error && <p role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{t(error)}</p>}
    {message && <p role="status" className="mb-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"><CheckCircle2 size={18} />{t(message)}</p>}

    {!isHr && eligibilityBlocked && <Card className="mb-5 p-6"><h2 className="font-semibold text-slate-900">Không thể tải khảo sát</h2><p className="mt-2 text-sm text-slate-600">Tài khoản cần liên kết với hồ sơ nhân viên đang hoạt động và nằm trong danh sách được mời khi khảo sát được xuất bản.</p><Button className="mt-4" variant="secondary" onClick={() => setReload(value => value + 1)}>Thử lại</Button></Card>}

    {isHr && <>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
        { label: 'Total surveys', value: surveys.length, icon: ClipboardList, tone: 'bg-orange-50 text-orange-600' },
        { label: 'Open surveys', value: surveys.filter(item => item.status === 'ACTIVE').length, icon: PlayCircle, tone: 'bg-emerald-50 text-emerald-600' },
        { label: 'Draft surveys', value: surveys.filter(item => item.status === 'DRAFT').length, icon: FilePlus2, tone: 'bg-amber-50 text-amber-600' },
        { label: 'Submitted survey responses', value: totalResponses, icon: UsersRound, tone: 'bg-blue-50 text-blue-600' },
      ].map(({ label, value, icon: Icon, tone }) => <Card key={label} className="flex items-center gap-4 p-5"><span className={`flex size-11 items-center justify-center rounded-2xl ${tone}`}><Icon size={21} /></span><div><p className="text-sm text-slate-500">{t(label)}</p><p className="text-2xl font-bold text-slate-950">{value}</p></div></Card>)}</div>

      <Card className="mb-6 overflow-hidden"><header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4"><span className="flex size-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><FilePlus2 size={20} /></span><div><h2 className="font-semibold text-slate-950">{editSurvey ? `${t('Edit')}: ${editSurvey.title}` : t('Create a new survey')}</h2><p className="mt-0.5 text-sm text-slate-500">{t('Choose a cycle and topics so the system can add the correct standard satisfaction questions.')}</p></div></header>
        <form onSubmit={event => void (editSurvey ? saveSurvey(event) : create(event))} className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <label className="text-sm font-semibold text-slate-700">{t('Title')}<input required maxLength={255} className={control} value={draft.title} onChange={event => setDraft(value => ({ ...value, title: event.target.value }))} /></label>
          <label className="text-sm font-semibold text-slate-700">{t('Survey purpose')}<input maxLength={4000} className={control} value={draft.description} onChange={event => setDraft(value => ({ ...value, description: event.target.value }))} /></label>
          <label className="text-sm font-semibold text-slate-700">{t('Start date')}<input required type="date" className={control} value={draft.startDate} onChange={event => setDraft(value => ({ ...value, startDate: event.target.value }))} /></label>
          <label className="text-sm font-semibold text-slate-700">{t('End date')}<input required type="date" min={draft.startDate || undefined} className={control} value={draft.endDate} onChange={event => setDraft(value => ({ ...value, endDate: event.target.value }))} /></label>
          {!editSurvey && <><label className="text-sm font-semibold text-slate-700 sm:col-span-2">{t('Survey cycle')}<select className={control} value={draft.cycleNumber} onChange={event => setDraft(value => ({ ...value, cycleNumber: Number(event.target.value) as 1 | 2 | 3 }))}>{([1, 2, 3] as const).map(cycle => <option key={cycle} value={cycle}>{t(cycleLabels[cycle])}</option>)}</select></label>
            <fieldset className="sm:col-span-2"><legend className="text-sm font-semibold text-slate-700">{t('Survey topics')}</legend><p className="mt-1 text-sm text-slate-500">{t('Choose at least one main topic. Standard questions are locked to keep scoring consistent.')}</p><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{categories.map(category => <label key={category.id} className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${draft.categoryIds.includes(category.id) ? 'border-orange-300 bg-orange-50' : 'border-slate-200 hover:border-orange-200'}`}><input type="checkbox" checked={draft.categoryIds.includes(category.id)} onChange={() => setDraft(value => ({ ...value, categoryIds: value.categoryIds.includes(category.id) ? value.categoryIds.filter(id => id !== category.id) : [...value.categoryIds, category.id] }))} className="mt-1 size-4 accent-orange-500" /><span><strong className="block text-sm text-slate-900">{topicLabel(category.name)}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{category.description || `${category.defaultQuestions.length} ${t('standard questions')}`}</span></span></label>)}</div></fieldset>
            {draft.categoryIds.length > 0 && <details className="rounded-2xl border border-orange-100 bg-orange-50/50 p-4 sm:col-span-2"><summary className="cursor-pointer text-sm font-semibold text-orange-800">Xem trước {defaultCount} câu hỏi mặc định</summary><ol className="mt-3 space-y-2 text-sm text-slate-700">{selectedCategories.flatMap(category => category.defaultQuestions.map(question => <li key={question.templateCode} className="rounded-xl bg-white px-3 py-2"><span className="font-semibold text-orange-700">{topicLabel(category.name)}:</span> {question.questionText}</li>))}</ol></details>}</>}
          <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 sm:col-span-2"><p className="flex items-center gap-2 text-sm text-slate-600"><Sparkles size={17} className="text-orange-500" />{t('After creation, you can add custom questions before publishing.')}</p><div className="flex gap-2">{editSurvey && <Button type="button" variant="secondary" onClick={() => { setEditSurvey(null); setDraft(emptyDraft()); }}>{t('Cancel')}</Button>}<Button disabled={pending || (!editSurvey && !hasMainTopic)}>{t(pending ? 'Saving...' : editSurvey ? 'Save changes' : 'Create draft')}</Button></div></div>
        </form>
      </Card>
    </>}

    {managedSurvey && <SurveyContentEditor survey={managedSurvey} categories={categories} draft={questionDraft} pending={pending} onDraft={setQuestionDraft} onSave={saveQuestion} onDelete={removeQuestion} onClose={() => { setManagedSurvey(null); setQuestionDraft(emptyQuestion()); }} />}
    {activeSurvey && !isHr && <EmployeeSurveyForm survey={activeSurvey} answers={answers} pending={pending} allAnswered={allAnswered} error={error} onAnswers={setAnswers} onClose={() => setActiveSurvey(null)} onSubmit={() => void submit(activeSurvey.id)} />}

    {!eligibilityBlocked && !activeSurvey && <section><div className="mb-3"><h2 className="text-lg font-semibold text-slate-950">{t(isHr ? 'Survey list' : 'Surveys awaiting your response')}</h2><p className="mt-1 text-sm text-slate-500">{t(isHr ? 'Manage status, question content, completion and results.' : 'Select a survey to start your response.')}</p></div>
      {loading ? <Card className="p-8 text-center text-sm text-slate-500">{t('Loading surveys...')}</Card> : loadFailed ? <Card className="p-6"><p className="text-sm text-slate-500">{t('Could not load surveys.')}</p><Button className="mt-3" variant="secondary" onClick={() => setReload(value => value + 1)}>{t('Retry')}</Button></Card> : surveys.length === 0 ? <Card className="p-6"><EmptyState icon={<ClipboardList size={42} />} title={isHr ? 'No surveys have been created.' : 'No surveys are currently available.'} description={isHr ? 'Create the first survey draft using the form above.' : 'New surveys will appear when HR publishes them and invites you.'} /></Card> : <div className="space-y-4">{surveys.map(survey => {
        const result = results[survey.id];
        return <Card key={survey.id} className="overflow-hidden"><div className="p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2">{isHr && <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle(survey.status)}`}>{survey.status}</span>}{survey.cycleNumber && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">Chu kỳ {survey.cycleNumber}</span>}</div><h3 className="mt-3 text-lg font-semibold text-slate-950">{survey.title}</h3>{survey.description && <p className="mt-1 text-sm leading-6 text-slate-600">{survey.description}</p>}<div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500"><span className="flex items-center gap-1.5"><CalendarDays size={16} />{dateLabel(survey.startDate)} – {dateLabel(survey.endDate)}</span><span className="flex items-center gap-1.5"><ListChecks size={16} />{survey.questionCount || 0} câu hỏi</span>{isHr && <span className="flex items-center gap-1.5"><UsersRound size={16} />{survey.responseCount || 0} phản hồi</span>}</div></div>
          {isHr ? <div className="flex shrink-0 flex-wrap gap-2">{survey.status === 'DRAFT' && <><Button variant="secondary" onClick={() => { setEditSurvey(survey); setDraft({ title: survey.title, description: survey.description || '', startDate: employeeDate(survey.startDate), endDate: employeeDate(survey.endDate), cycleNumber: survey.cycleNumber || 1, categoryIds: [] }); document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' }); }}><Pencil size={16} />Sửa thông tin</Button><Button variant="info" onClick={() => void loadSurveyContent(survey)}><ListChecks size={16} />Câu hỏi</Button><Button disabled={pending} onClick={() => setPublishTarget(survey)}><PlayCircle size={16} />Xuất bản</Button></>}{survey.status === 'ACTIVE' && <Button variant="danger" onClick={() => void finishSurvey(survey.id)}>Đóng khảo sát</Button>}<Button variant="secondary" disabled={loadingResults} onClick={() => void showResults(survey.id)}><BarChart3 size={16} />{openResults === survey.id ? 'Ẩn tổng quan' : 'Xem tổng quan'}</Button><Button variant="success" disabled={loadingResults} onClick={() => void showResults(survey.id, true)}><Eye size={16} />Chi tiết phản hồi</Button></div> : <Button onClick={() => void openEmployeeSurvey(survey.id)}><PlayCircle size={16} />Bắt đầu khảo sát</Button>}
        </div></div>{isHr && openResults === survey.id && result && <ResultOverview result={result} />}</Card>;
      })}</div>}
    </section>}

    {!isHr && !activeSurvey && <EmployeeSurveyHistory account={user.email} revision={reload} />}
    {detailResult && <SurveyResultDetails result={detailResult.result} participants={detailResult.participants} onClose={() => setDetailResult(null)} />}
    <ConfirmationDialog open={Boolean(publishTarget)} title="Xuất bản khảo sát?" description="Nội dung và câu hỏi sẽ bị khóa. Các nhân viên đang hoạt động sẽ được ghi nhận vào danh sách mời." confirmLabel="Xuất bản" onCancel={() => setPublishTarget(null)} onConfirm={() => { const target = publishTarget; setPublishTarget(null); if (target) void publish(target.id); }} />
  </AppShell>;
}

function SurveyContentEditor({ survey, categories, draft, pending, onDraft, onSave, onDelete, onClose }: { survey: SurveySummary & { questions: SurveyQuestion[] }; categories: SurveyCategory[]; draft: QuestionDraft; pending: boolean; onDraft: (value: QuestionDraft) => void; onSave: (event: FormEvent) => void; onDelete: (question: SurveyQuestion) => void; onClose: () => void }) {
  const needsOptions = draft.questionType === 'SINGLE_CHOICE' || draft.questionType === 'MULTIPLE_CHOICE';
  const custom = survey.questions.filter(question => !question.isSatisfactionCore);
  const startEdit = (question: SurveyQuestion) => onDraft({ questionId: question.id, questionText: question.questionText, categoryId: question.categoryId, questionType: question.questionType, options: isChoiceConfig(question.answerConfig) ? question.answerConfig.options.map(option => option.label).join('\n') : '', displayOrder: question.displayOrder });
  return <Card className="mb-6 overflow-hidden border-orange-200"><header className="flex flex-col gap-3 border-b border-slate-100 bg-orange-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-slate-950">Nội dung khảo sát: {survey.title}</h2><p className="mt-1 text-sm text-slate-600">Câu hỏi mặc định được khóa; câu hỏi bổ sung có thể sửa hoặc xóa khi còn là bản nháp.</p></div><Button variant="secondary" onClick={onClose}>Đóng</Button></header>
    <div className="grid gap-6 p-5 xl:grid-cols-[1.25fr_.75fr]"><section><h3 className="mb-3 font-semibold text-slate-900">Danh sách câu hỏi ({survey.questions.length})</h3><div className="space-y-3">{survey.questions.map((question, index) => <article key={question.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-bold text-orange-700">{index + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-blue-700">{questionTypeLabels[question.questionType]}</span>{question.isSatisfactionCore && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Câu hỏi chuẩn</span>}</div><p className="mt-2 text-sm font-medium leading-6 text-slate-900">{question.questionText}</p>{isChoiceConfig(question.answerConfig) && <p className="mt-2 text-xs text-slate-500">{question.answerConfig.options.map(option => option.label).join(' · ')}</p>}</div>{!question.isSatisfactionCore && <div className="flex shrink-0 gap-1"><button type="button" aria-label="Sửa câu hỏi" className="rounded-lg p-2 text-blue-600 hover:bg-blue-50" onClick={() => startEdit(question)}><Pencil size={17} /></button><button type="button" aria-label="Xóa câu hỏi" className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => onDelete(question)}><Trash2 size={17} /></button></div>}</div></article>)}</div>{custom.length === 0 && <p className="mt-3 text-sm italic text-slate-500">Chưa có câu hỏi tùy chỉnh.</p>}</section>
      <form onSubmit={onSave} className="h-fit rounded-2xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-semibold text-slate-900">{draft.questionId ? 'Sửa câu hỏi tùy chỉnh' : 'Thêm câu hỏi tùy chỉnh'}</h3><label className="mt-4 block text-sm font-semibold text-slate-700">Chủ đề<select required className={control} value={draft.categoryId} onChange={event => onDraft({ ...draft, categoryId: Number(event.target.value) })}><option value="">Chọn chủ đề</option>{categories.map(category => <option key={category.id} value={category.id}>{topicLabel(category.name)}</option>)}</select></label><label className="mt-4 block text-sm font-semibold text-slate-700">Loại câu hỏi<select className={control} value={draft.questionType} onChange={event => onDraft({ ...draft, questionType: event.target.value as SurveyQuestionType })}>{Object.entries(questionTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="mt-4 block text-sm font-semibold text-slate-700">Nội dung<textarea required maxLength={4000} className={area} value={draft.questionText} onChange={event => onDraft({ ...draft, questionText: event.target.value })} /></label>{needsOptions && <label className="mt-4 block text-sm font-semibold text-slate-700">Các lựa chọn <span className="font-normal text-slate-500">(mỗi dòng một lựa chọn)</span><textarea required className={area} value={draft.options} onChange={event => onDraft({ ...draft, options: event.target.value })} /></label>}<label className="mt-4 block text-sm font-semibold text-slate-700">Thứ tự hiển thị<input required type="number" min={0} max={10000} className={control} value={draft.displayOrder} onChange={event => onDraft({ ...draft, displayOrder: Number(event.target.value) })} /></label><div className="mt-5 flex gap-2">{draft.questionId && <Button type="button" variant="secondary" onClick={() => onDraft({ ...emptyQuestion(), categoryId: categories[0]?.id || 0 })}>Hủy sửa</Button>}<Button disabled={pending || !draft.categoryId || !draft.questionText.trim() || (needsOptions && draft.options.split('\n').filter(Boolean).length < 2)}><Plus size={16} />{draft.questionId ? 'Lưu câu hỏi' : 'Thêm câu hỏi'}</Button></div></form>
    </div>
  </Card>;
}

function EmployeeSurveyForm({ survey, answers, pending, allAnswered, error, onAnswers, onClose, onSubmit }: { survey: SurveySummary & { questions: SurveyQuestion[] }; answers: Record<number, AnswerDraft>; pending: boolean; allAnswered: boolean; error: string; onAnswers: React.Dispatch<React.SetStateAction<Record<number, AnswerDraft>>>; onClose: () => void; onSubmit: () => void }) {
  const setValue = (id: number, value: SurveyAnswerValue) => onAnswers(current => ({ ...current, [id]: { value, comment: current[id]?.comment || '' } }));
  const selectedCodes = (id: number) => { const value = answers[id]?.value; return typeof value === 'object' && value && 'selectedCodes' in value ? value.selectedCodes : []; };
  return <Card className="mb-6 overflow-hidden"><header className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-orange-50 to-white px-5 py-5 sm:flex-row sm:justify-between"><div><span className="text-xs font-bold uppercase tracking-wider text-orange-600">Khảo sát nhân viên</span><h2 className="mt-2 text-xl font-semibold text-slate-950">{survey.title}</h2>{survey.description && <p className="mt-2 text-sm leading-6 text-slate-600">{survey.description}</p>}</div><Button variant="secondary" onClick={onClose}>Hủy</Button></header><form onSubmit={event => { event.preventDefault(); onSubmit(); }} className="p-5 sm:p-6"><div className="mb-5 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600"><span>{survey.questions.filter(question => {
    const value = answers[question.id]?.value; return question.questionType === 'TEXT' ? typeof value === 'string' && Boolean(value.trim()) : question.questionType === 'RATING' ? Number.isInteger(value) : typeof value === 'object' && value !== null && 'selectedCodes' in value && value.selectedCodes.length > 0;
  }).length}/{survey.questions.length} câu đã trả lời</span><span>Mọi câu hỏi đều bắt buộc</span></div><div className="space-y-4">{survey.questions.map((question, index) => <fieldset key={question.id} className="rounded-2xl border border-slate-200 p-4 sm:p-5"><legend className="sr-only">{question.questionText}</legend><div className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-bold text-orange-700">{index + 1}</span><div><p className="text-sm font-semibold leading-6 text-slate-900">{question.questionText}<span className="ml-1 text-red-500">*</span></p><p className="mt-1 text-xs font-semibold uppercase text-slate-400">{questionTypeLabels[question.questionType]}</p></div></div>
    {question.questionType === 'RATING' && <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-5">{(isRatingConfig(question.answerConfig) ? question.answerConfig.labels : ratingLabels).map((label, scoreIndex) => { const score = scoreIndex + 1; return <button key={score} type="button" aria-pressed={answers[question.id]?.value === score} onClick={() => setValue(question.id, score)} className={`min-h-14 rounded-xl border px-2 py-2 text-sm font-semibold transition ${answers[question.id]?.value === score ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-orange-50'}`}><span className="block text-base">{score}</span><span className="mt-1 block text-xs font-medium">{label}</span></button>; })}</div>}
    {question.questionType === 'TEXT' && <textarea required maxLength={4000} rows={4} className={area} placeholder="Nhập câu trả lời của bạn" value={typeof answers[question.id]?.value === 'string' ? answers[question.id].value as string : ''} onChange={event => setValue(question.id, event.target.value)} />}
    {(question.questionType === 'SINGLE_CHOICE' || question.questionType === 'MULTIPLE_CHOICE') && isChoiceConfig(question.answerConfig) && <div className="mt-4 grid gap-2 sm:grid-cols-2">{question.answerConfig.options.map(option => { const checked = selectedCodes(question.id).includes(option.code); return <label key={option.code} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${checked ? 'border-orange-300 bg-orange-50 text-orange-900' : 'border-slate-200 text-slate-700'}`}><input type={question.questionType === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'} name={`question-${question.id}`} checked={checked} onChange={() => { const current = selectedCodes(question.id); const next = question.questionType === 'SINGLE_CHOICE' ? [option.code] : checked ? current.filter(code => code !== option.code) : [...current, option.code]; setValue(question.id, { selectedCodes: next }); }} className="size-4 accent-orange-500" />{option.label}</label>; })}</div>}
    {question.questionType !== 'TEXT' && <label className="mt-4 block text-sm font-medium text-slate-600">Ghi chú <span className="font-normal text-slate-400">(không bắt buộc)</span><textarea maxLength={1000} rows={2} className={area} value={answers[question.id]?.comment || ''} onChange={event => onAnswers(current => ({ ...current, [question.id]: { value: current[question.id]?.value, comment: event.target.value } }))} /></label>}
  </fieldset>)}</div>{error && <p className="mt-5 text-sm text-red-700">{error}</p>}<div className="mt-6 flex justify-end"><Button disabled={pending || !allAnswered}><Send size={16} />{pending ? 'Đang gửi...' : 'Gửi câu trả lời'}</Button></div></form></Card>;
}

function ResultOverview({ result }: { result: SurveyResults }) {
  return <div className="border-t border-slate-100 bg-slate-50/70 p-5 sm:p-6"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">Được mời</p><strong className="mt-1 block text-2xl text-slate-900">{result.invitedCount}</strong></div><div className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">Đã gửi</p><strong className="mt-1 block text-2xl text-emerald-600">{result.responseCount}</strong></div><div className="rounded-2xl bg-white p-4"><p className="text-sm text-slate-500">Tỷ lệ hoàn thành</p><strong className="mt-1 block text-2xl text-orange-600">{result.completionRate == null ? '—' : `${result.completionRate}%`}</strong></div></div><h4 className="mt-5 font-semibold text-slate-950">Điểm hài lòng theo chủ đề</h4><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{result.categoryScores.map(category => <div key={category.categoryId} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{topicLabel(category.name)}</p><p className="mt-1 text-xs text-slate-500">{category.responseCount} phản hồi hợp lệ</p></div><strong className="text-xl text-orange-600">{category.satisfactionScore?.toFixed(2) ?? '—'}</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-orange-500" style={{ width: `${category.satisfactionScore == null ? 0 : category.satisfactionScore / 5 * 100}%` }} /></div></div>)}</div></div>;
}
