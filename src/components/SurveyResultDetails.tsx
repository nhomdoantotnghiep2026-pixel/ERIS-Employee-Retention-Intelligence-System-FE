import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Bell,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Search,
  UsersRound,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  getApiErrorMessage,
  getSurveyParticipant,
  type SurveyAnswerConfig,
  type SurveyAnswerValue,
  type SurveyParticipant,
  type SurveyParticipantResponse,
  type SurveyQuestion,
  type SurveyResults,
} from '../services/api';
import { Button } from './ui';

const formatDateTime = (value: string | null, language: string) =>
  value
    ? new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(new Date(value))
    : language === 'vi'
      ? 'Chưa gửi'
      : 'Not submitted';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase() || 'NV';

const isChoice = (
  config: SurveyAnswerConfig | undefined,
): config is { options: Array<{ code: string; label: string }> } =>
  Boolean(config && 'options' in config);

const valueText = (value: SurveyAnswerValue, question?: SurveyQuestion) => {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  const config = question?.answerConfig;
  if (!question || !isChoice(config))
    return value.selectedCodes.join(', ');
  return value.selectedCodes
    .map(
      (code) =>
        config.options.find((option) => option.code === code)?.label || code,
    )
    .join(', ');
};

export function SurveyResultDetails({
  result,
  totalEmployees,
  participants,
  onClose,
}: {
  result: SurveyResults;
  totalEmployees: number;
  participants: SurveyParticipant[];
  onClose: () => void;
}) {
  const { language } = useLanguage();
  const tr = (vi: string, en: string) => (language === 'vi' ? vi : en);
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<'participants' | 'summary'>('participants');
  const [selected, setSelected] = useState<SurveyParticipantResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function openParticipant(participant: SurveyParticipant) {
    if (participant.status !== 'SUBMITTED') return;
    setError('');
    try {
      const response = await getSurveyParticipant(
        result.survey.id,
        participant.employeeId,
      );
      setSelected(response.data);
    } catch (cause) {
      setError(
        getApiErrorMessage(
          cause,
          tr('Không thể tải câu trả lời.', 'Could not load the response.'),
        ),
      );
    }
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="survey-result-detail-title"
      className="fixed inset-0 m-auto max-h-[min(90dvh,900px)] w-[calc(100%-2rem)] max-w-6xl overflow-hidden rounded-[24px] border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/45"
    >
      <div className="flex max-h-[min(90dvh,900px)] min-h-0 flex-col">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            {selected && (
              <button
                type="button"
                aria-label={tr('Quay lại', 'Back')}
                className="flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200"
                onClick={() => setSelected(null)}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="min-w-0">
              <h2 id="survey-result-detail-title" className="truncate text-xl font-bold">
                {selected
                  ? selected.fullName
                  : tr('Chi tiết kết quả khảo sát', 'Survey result details')}
              </h2>
              <p className="mt-1 truncate text-sm text-slate-500">
                {selected
                  ? `${selected.employeeCode} · ${formatDateTime(selected.submittedAt, language)}`
                  : `${result.survey.title} · ${result.responseCount}/${totalEmployees} ${tr('đã gửi', 'submitted')}`}
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => dialog.current?.close()}>
            {tr('Đóng', 'Close')}
          </Button>
        </header>

        {!selected && (
          <nav className="flex shrink-0 gap-1 border-b border-slate-100 bg-slate-50/70 px-5 pt-3 sm:px-6">
            <button
              type="button"
              className={`flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold ${tab === 'participants' ? 'border-orange-500 text-orange-700' : 'border-transparent text-slate-500'}`}
              onClick={() => setTab('participants')}
            >
              <UsersRound size={17} />
              {tr('Người tham gia', 'Participants')}
              <span className="rounded-full bg-white px-2 py-0.5 text-xs ring-1 ring-slate-200">
                {participants.length}
              </span>
            </button>
            <button
              type="button"
              className={`flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold ${tab === 'summary' ? 'border-orange-500 text-orange-700' : 'border-transparent text-slate-500'}`}
              onClick={() => setTab('summary')}
            >
              <BarChart3 size={17} />
              {tr('Tổng hợp câu hỏi', 'Question summary')}
            </button>
          </nav>
        )}

        <div className="min-h-0 overflow-y-auto bg-slate-50/50 p-5 sm:p-6">
          {error && (
            <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {selected ? (
            <ParticipantAnswers participant={selected} result={result} />
          ) : tab === 'participants' ? (
            <ParticipantDirectory
              participants={participants}
              language={language}
              onOpen={(participant) => void openParticipant(participant)}
            />
          ) : (
            <QuestionSummary result={result} />
          )}
        </div>
      </div>
    </dialog>
  );
}

function ParticipantDirectory({
  participants,
  language,
  onOpen,
}: {
  participants: SurveyParticipant[];
  language: string;
  onOpen: (participant: SurveyParticipant) => void;
}) {
  const tr = (vi: string, en: string) => (language === 'vi' ? vi : en);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'SUBMITTED' | 'NOT_SUBMITTED'>('ALL');
  const [page, setPage] = useState(1);
  const perPage = 10;
  const submittedCount = participants.filter(
    (participant) => participant.status === 'SUBMITTED',
  ).length;
  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase();
    return participants.filter((participant) => {
      const matchesStatus = filter === 'ALL' || participant.status === filter;
      const matchesQuery =
        !value ||
        `${participant.fullName} ${participant.employeeCode} ${participant.departmentName || ''}`
          .toLocaleLowerCase()
          .includes(value);
      return matchesStatus && matchesQuery;
    });
  }, [filter, participants, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  useEffect(() => {
    setPage(1);
  }, [filter, query]);

  return (
    <section>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="font-semibold text-slate-950">
            {tr('Danh sách nhân sự được mời', 'Invited employees')}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {submittedCount}/{participants.length} {tr('đã gửi phản hồi', 'submitted')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled
            title={tr(
              'Backend chưa có endpoint gửi nhắc nhở.',
              'The backend does not provide a reminder endpoint yet.',
            )}
          >
            <Bell size={15} />
            {tr('Gửi nhắc nhở người chưa nộp', 'Remind pending employees')}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
          {([
            ['ALL', tr('Tất cả', 'All'), participants.length],
            ['SUBMITTED', tr('Đã gửi phản hồi', 'Submitted'), submittedCount],
            [
              'NOT_SUBMITTED',
              tr('Chưa gửi phản hồi', 'Pending'),
              participants.length - submittedCount,
            ],
          ] as const).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-md px-3 py-2 text-xs font-semibold transition ${filter === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
        <label className="relative block w-full lg:w-80">
          <Search
            size={17}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tr(
              'Tìm theo tên, mã hoặc phòng ban',
              'Search name, code or department',
            )}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
          />
        </label>
      </div>

      <div className="mt-4 max-h-[430px] space-y-2 overflow-y-auto pr-1">
        {paged.map((participant) => {
          const submitted = participant.status === 'SUBMITTED';
          return (
            <button
              type="button"
              key={participant.responseId}
              disabled={!submitted}
              onClick={() => onOpen(participant)}
              className="flex w-full min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition enabled:hover:border-orange-200 enabled:hover:shadow-md disabled:cursor-default"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-sm font-bold text-orange-700">
                {initials(participant.fullName)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-slate-950">
                  {participant.fullName}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">
                  {participant.employeeCode}
                  {participant.departmentName ? ` · ${participant.departmentName}` : ''}
                </span>
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${submitted ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
              >
                {submitted
                  ? tr('Đã gửi', 'Submitted')
                  : tr('Chưa gửi', 'Pending')}
              </span>
              {submitted && <ChevronRight size={18} className="text-slate-400" />}
            </button>
          );
        })}
        {paged.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            {tr('Không tìm thấy nhân sự phù hợp.', 'No matching employees found.')}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-500">
        <span>
          {tr('Trang', 'Page')} {page}/{pageCount} · {filtered.length}{' '}
          {tr('nhân sự', 'employees')}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            {tr('Trước', 'Previous')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={page >= pageCount}
            onClick={() => setPage((current) => current + 1)}
          >
            {tr('Sau', 'Next')}
          </Button>
        </div>
      </div>
    </section>
  );
}

function ParticipantAnswers({
  participant,
  result,
}: {
  participant: SurveyParticipantResponse;
  result: SurveyResults;
}) {
  const questionMap = new Map(
    result.questions.map((question) => [question.id, question]),
  );
  return (
    <section className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
        <span className="flex size-11 items-center justify-center rounded-xl bg-white text-orange-600">
          <ClipboardList size={21} />
        </span>
        <div>
          <h3 className="font-semibold text-slate-950">Câu trả lời cá nhân</h3>
          <p className="mt-1 text-sm text-slate-600">
            Điểm hài lòng tổng hợp: {participant.satisfactionScore?.toFixed(2) ?? '—'}/5
          </p>
        </div>
      </div>
      <div className="space-y-4">
        {participant.answers.map((answer, index) => {
          const question = questionMap.get(answer.questionId);
          return (
            <article
              key={answer.questionId}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-orange-50 text-sm font-bold text-orange-700">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold leading-6 text-slate-950">
                    {question?.questionText || `Câu hỏi #${answer.questionId}`}
                  </h4>
                  <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800">
                    {valueText(answer.answerValue, question)}
                  </p>
                  {answer.comment && (
                    <p className="mt-3 whitespace-pre-wrap rounded-xl border border-slate-100 px-4 py-3 text-sm leading-6 text-slate-600">
                      <strong>Ghi chú:</strong> {answer.comment}
                    </p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function QuestionSummary({ result }: { result: SurveyResults }) {
  return (
    <section>
      <div className="mb-4">
        <h3 className="font-semibold text-slate-950">Tổng hợp theo câu hỏi</h3>
        <p className="mt-1 text-sm text-slate-500">
          Thang điểm hiển thị điểm trung bình; lựa chọn hiển thị số lượt chọn;
          câu văn bản hiển thị nội dung phản hồi.
        </p>
      </div>
      <div className="space-y-4">
        {result.questions.map((question, index) => (
          <article
            key={question.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="font-semibold leading-6">
                  {index + 1}. {question.questionText}
                </h4>
                <p className="mt-1 text-xs font-semibold uppercase text-slate-400">
                  {question.questionType} · {question.answerCount} câu trả lời
                </p>
              </div>
              {question.questionType === 'RATING' && (
                <strong className="text-xl text-orange-600">
                  {question.averageScore?.toFixed(2) ?? '—'}
                </strong>
              )}
            </div>
            {question.options.length > 0 && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {question.options.map((option) => (
                  <div
                    key={option.code}
                    className="rounded-xl bg-orange-50/70 p-3 text-center"
                  >
                    <p className="text-xs leading-5 text-slate-600">{option.label}</p>
                    <strong className="mt-1 block text-orange-700">{option.count}</strong>
                  </div>
                ))}
              </div>
            )}
            {question.questionType === 'TEXT' && (
              <div className="mt-4 space-y-2">
                {question.answers?.map((answer, answerIndex) => (
                  <p
                    key={answerIndex}
                    className="whitespace-pre-wrap rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
                  >
                    {valueText(answer.answerValue)}
                    {answer.comment && (
                      <span className="mt-1 block text-slate-500">
                        Ghi chú: {answer.comment}
                      </span>
                    )}
                  </p>
                ))}
                {!question.answers?.length && (
                  <p className="text-sm text-slate-500">
                    Chưa có câu trả lời văn bản.
                  </p>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
