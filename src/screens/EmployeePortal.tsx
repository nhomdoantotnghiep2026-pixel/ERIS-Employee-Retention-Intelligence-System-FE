import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BriefcaseBusiness, CalendarCheck2, CalendarClock, CalendarDays, CheckCircle2,
  ClipboardCheck, Clock3, DoorOpen, FileCheck2, FileText, GraduationCap,
  HeartPulse, IdCard, MessageSquareText, PiggyBank, Send,
  ShieldCheck, Target, UserRoundCheck, WalletCards,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Avatar, Button, Card, SectionHeader, StatusBadge, Td, Th } from '../components/ui';
import { useEmployees } from '../context/EmployeeContext';
import { useLanguage } from '../context/LanguageContext';
import { useRole } from '../context/RoleContext';
import { useErd } from '../erd/useErd';
import { ErdEmployeeRelations } from '../components/ErdEmployeeRelations';
import type { WorkflowRequest } from '../services/employeeWorkflow';
import { createEmployeeRequest, listEmployeeRequests, REQUESTS_EVENT } from '../workflows/employeeRequests';
import { recordAudit } from '../workflows/audit';
import MyAttendance from './MyAttendance';

export type EmployeePortalMode = 'dashboard' | 'profile' | 'attendance' | 'requests' | 'payroll' | 'performance' | 'offboarding' | 'surveys';
type RequestType = 'Annual leave' | 'Overtime' | 'Shift change' | 'Remote work';
type EmployeeRequest = { id: string; type: RequestType; date: string; detail: string; status: 'Pending' | 'Approved' | 'Rejected'; reviewerNote?: string | null; reviewedAt?: string | null };
type OffboardingState = { submitted: boolean; lastWorkingDay: string; reason: string; checklist: Record<string, boolean> };

const leaveBalance = { annual: 8.5, used: 3.5, pending: 1 };
const payrollLines = [
  { label: 'Base salary', amount: 5800 },
  { label: 'Position allowance', amount: 450 },
  { label: 'Overtime pay', amount: 320 },
  { label: 'Insurance deduction', amount: -420 },
  { label: 'Personal income tax', amount: -265 },
];
const learningItems = [
  { course: 'Information security basics', due: 'Oct 18, 2026', status: 'Completed', score: '92%' },
  { course: 'Company culture onboarding', due: 'Oct 22, 2026', status: 'In progress', score: '60%' },
];
const reviewGoals = [
  { goal: 'Deliver payroll dashboard module', weight: '40%', progress: 75, manager: 'On track' },
  { goal: 'Reduce production defects after release', weight: '30%', progress: 68, manager: 'Needs evidence' },
  { goal: 'Mentor 1 junior engineer', weight: '30%', progress: 55, manager: 'On track' },
];
const offboardingTasks = [
  { key: 'manager', owner: 'Line Manager', task: 'Confirm handover plan and project documents' },
  { key: 'it', owner: 'IT', task: 'Recover laptop and disable software accounts' },
  { key: 'admin', owner: 'Administration', task: 'Recover employee card and office assets' },
  { key: 'payroll', owner: 'Payroll', task: 'Prepare final payslip and unused leave payout' },
];

function todayLabel(locale = 'en-US') {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
}

function formatMoney(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function readSession<T>(key: string, fallback: T) {
  try {
    const stored = sessionStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch {
    return fallback;
  }
}

function mapWorkflowRequest(item: WorkflowRequest): EmployeeRequest {
  return { id: item.id, type: item.request_type, date: item.requested_date, detail: item.detail, status: item.status, reviewerNote: item.reviewer_note, reviewedAt: item.reviewed_at };
}

export default function EmployeePortal({ mode }: { mode: EmployeePortalMode }) {
  const { t, language } = useLanguage();
  const locale = language === 'vi' ? 'vi-VN' : 'en-US';
  const money = (value: number) => formatMoney(value, locale);
  const navigate = useNavigate();
  const { employees } = useEmployees();
  const { user } = useRole();
  const db = useErd();
  const linkedEmployeeId = db.users.find(account => account.email === user.email)?.employee_id;
  const employee = employees.find(item => item.id === linkedEmployeeId);
  const [requests, setRequests] = useState<EmployeeRequest[]>([]);
  const [requestMessage, setRequestMessage] = useState('');
  const [requestError, setRequestError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requestDraft, setRequestDraft] = useState({ type: 'Annual leave' as RequestType, date: new Date().toLocaleDateString('en-CA'), detail: '' });
  const [answers, setAnswers] = useState({ satisfaction: '', workload: '', comment: '' });
  const [surveyDone, setSurveyDone] = useState(() => sessionStorage.getItem('eris-survey-q4-2026') === 'submitted');
  const [selfAssessment, setSelfAssessment] = useState(() => sessionStorage.getItem('eris-self-assessment') || '');
  const [offboarding, setOffboarding] = useState<OffboardingState>(() => readSession<OffboardingState>('eris-offboarding', {
    submitted: false,
    lastWorkingDay: '2026-11-13',
    reason: '',
    checklist: { manager: true, it: false, admin: false, payroll: false },
  }));

  const netPay = useMemo(() => payrollLines.reduce((sum, line) => sum + line.amount, 0), []);
  const saveOffboarding = (next: OffboardingState) => { setOffboarding(next); sessionStorage.setItem('eris-offboarding', JSON.stringify(next)); };

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (!employee) { setRequests([]); return; }
      void listEmployeeRequests(employee.email || user.email)
        .then(rows => { if (!cancelled) setRequests(rows.map(mapWorkflowRequest)); })
        .catch(() => { if (!cancelled) setRequestError('Unable to read request history.'); });
    };
    refresh();
    window.addEventListener(REQUESTS_EVENT, refresh);
    return () => { cancelled = true; window.removeEventListener(REQUESTS_EVENT, refresh); };
  }, [employee?.email, user.email]);

  const submitRequest = async () => {
    if (!employee || submitting) return;
    setRequestError(''); setRequestMessage('');
    if (!requestDraft.date || !requestDraft.detail.trim()) { setRequestError('Choose a date and enter a reason.'); return; }
    if (!window.confirm(t('Submit {type} to HR?', { type: t(requestDraft.type) }) + ' · ' + requestDraft.date + '\n' + requestDraft.detail)) return;
    setSubmitting(true);
    try {
      const created = await createEmployeeRequest({ employeeEmail: employee.email || user.email, employeeName: employee.name, type: requestDraft.type, date: requestDraft.date, detail: requestDraft.detail });
      recordAudit('employee_request', created.id, 'Submit employee request', null, created);
      setRequestDraft(current => ({ ...current, detail: '' }));
      setRequestMessage('Request submitted to HR. Track the decision and feedback in your request history.');
    } catch (error) { setRequestError(error instanceof Error ? error.message : 'Unable to submit request. Please try again.'); }
    finally { setSubmitting(false); }
  };
  const today = new Date().toLocaleDateString('en-CA');
  const openSurveys = db.surveys.filter(survey => survey.status === 'Active' && String(survey.start_date) <= today && String(survey.end_date) >= today && !db.survey_responses.some(response => response.survey_id === survey.id && response.employee_id === linkedEmployeeId)).length;
  const pendingRequests = requests.filter(request => request.status === 'Pending').length;

  if (mode === 'attendance') return <MyAttendance />;

  if (!employee) return <AppShell breadcrumb={['Employee Workspace']}><Card className="p-8"><h1 className="text-xl font-bold text-slate-900">{t("Tài khoản chưa liên kết hồ sơ nhân viên")}</h1><p className="mt-3 text-sm text-slate-600">{t("Vui lòng nhờ quản trị viên liên kết tài khoản với hồ sơ nhân viên trong trang quản lý tài khoản.")}</p></Card></AppShell>;

  if (mode === 'profile') {
    const profileItems = [
      ['Email', employee.email || user.email],
      ['Department', t(employee.department)],
      ['Position', t(employee.role)],
      ['Employment status', t(employee.status)],
      ['Contract type', '1-year employment contract'],
      ['Direct manager', 'Le Thi Manager'],
      ['Work shift', 'Office shift, 08:30 - 17:30'],
      ['Leave policy', '12 annual leave days/year'],
      ['Tenure', `${employee.tenure} years`],
    ];
    const onboardingSteps = [
      { label: 'Personal information verified', done: true },
      { label: 'Identity document uploaded', done: true },
      { label: 'Bank account registered', done: true },
      { label: 'Tax code confirmed', done: false },
    ];
    return <AppShell breadcrumb={['Self Service', 'My Profile']}><SectionHeader title={t("My Profile")} description={t("Personal data, contract setup, and onboarding documents for the employee record.")}/><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><Card className="p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><Avatar initials={employee.initials} size="lg"/><div><h2 className="text-xl font-bold text-slate-900">{employee.name}</h2><p className="mt-1 text-sm text-slate-500">{employee.employeeId} · {t(employee.role)}</p></div></div><dl className="mt-6 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2 lg:grid-cols-3">{profileItems.map(([label,value]) => <InfoTile key={label} label={t(label)} value={value} />)}</dl></Card><Card className="p-5"><div className="flex items-center gap-3"><UserRoundCheck className="text-orange-500" size={24}/><div><h2 className="font-bold text-slate-900">{t('Onboarding checklist')}</h2><p className="text-sm text-slate-500">{t('Web demo scope, no external identity integration.')}</p></div></div><div className="mt-5 space-y-3">{onboardingSteps.map(step => <div key={step.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm"><span className="font-medium text-slate-700">{t(step.label)}</span>{step.done ? <CheckCircle2 size={18} className="text-emerald-500"/> : <StatusBadge status="Pending" />}</div>)}</div></Card></div></AppShell>;
  }


  if (mode === 'requests') return <AppShell breadcrumb={['Self Service', 'Requests']}><SectionHeader title={t("Requests & Approvals")} description={t("Create a request, confirm submission, then track the HR decision and feedback here.")}/><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]"><Card className="p-5"><h2 className="font-bold text-slate-900">{t('My request history')}</h2><div className="mt-4 overflow-x-auto rounded-2xl border border-slate-100"><table className="w-full min-w-[700px]"><thead><tr><Th>{t("ID")}</Th><Th>{t("Type")}</Th><Th>{t("Date")}</Th><Th>{t("Detail")}</Th><Th>{t("Status")}</Th><Th>{t("HR feedback")}</Th></tr></thead><tbody>{requests.length === 0 && <tr><td colSpan={6} className="p-5 text-sm text-slate-500">{t("No requests yet. Complete the form to get started.")}</td></tr>}{requests.map(item => <tr key={item.id} className="border-t border-slate-100"><Td className="font-semibold"><span title={t(item.id)}>{t(item.id.slice(0, 8))}</span></Td><Td>{t(item.type)}</Td><Td>{t(item.date)}</Td><Td>{item.detail}</Td><Td><StatusBadge status={item.status} /></Td><Td>{item.reviewerNote || t(item.status === 'Pending' ? 'Waiting for HR review' : 'Reviewed')}{item.reviewedAt && <p className="mt-1 text-xs text-slate-500">{t(new Date(item.reviewedAt).toLocaleString(locale))}</p>}</Td></tr>)}</tbody></table></div></Card><Card className="p-5"><div className="flex items-center gap-3"><CalendarClock size={24} className="text-orange-500"/><h2 className="font-bold text-slate-900">{t('Create request')}</h2></div><div className="mt-5 space-y-4"><label className="block text-sm font-semibold text-slate-700">{t('Request type')}<select value={requestDraft.type} onChange={event => setRequestDraft({ ...requestDraft, type: event.target.value as RequestType })} className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100">{['Annual leave','Overtime','Shift change','Remote work'].map(option => <option key={option} value={option}>{t(option)}</option>)}</select></label><label className="block text-sm font-semibold text-slate-700">{t('Date')}<input type="date" value={requestDraft.date} onChange={event => setRequestDraft({ ...requestDraft, date: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/></label><label className="block text-sm font-semibold text-slate-700">{t('Reason / detail')}<textarea value={requestDraft.detail} onChange={event => setRequestDraft({ ...requestDraft, detail: event.target.value })} className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/></label><p className="text-xs text-slate-500">{t("Submit as Employee, review as HR, then return here to see the result. Demo records stay in this tab when switching roles.")}</p>{requestError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{t(requestError)}</p>}{requestMessage && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{t(requestMessage)}</p>}<Button className="w-full" disabled={submitting || !requestDraft.date || !requestDraft.detail.trim()} onClick={submitRequest}><Send size={16}/>{t('Submit request')}</Button></div><div className="mt-5 grid grid-cols-3 gap-3 text-center"><InfoTile label={t("Annual left")} value={t('{count} days', { count: leaveBalance.annual.toLocaleString(locale) })} /><InfoTile label={t("Used")} value={t('{count} days', { count: leaveBalance.used.toLocaleString(locale) })} /><InfoTile label={t("Pending")} value={t('{count} days', { count: leaveBalance.pending.toLocaleString(locale) })} /></div></Card></div></AppShell>;

  if (mode === 'payroll') return <AppShell breadcrumb={['Self Service', 'Payroll']}><SectionHeader title={t("My Payslips")} description={t("Preview monthly salary calculation from attendance, OT, allowances, and deductions.")}/><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><Card className="p-6"><div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t('October 2026 payslip')}</p><h2 className="mt-1 text-3xl font-extrabold text-slate-900">{t(money(netPay))}</h2><p className="mt-1 text-sm text-slate-500">{t('Estimated net pay before HR final approval')}</p></div><StatusBadge status="Pending" /></div><div className="mt-5 space-y-3">{payrollLines.map(line => <div key={line.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm"><span className="font-medium text-slate-700">{t(line.label)}</span><span className={`font-bold ${line.amount < 0 ? 'text-red-600' : 'text-slate-900'}`}>{t(money(line.amount))}</span></div>)}</div><div className="mt-5 rounded-2xl bg-orange-50 p-4 text-sm text-orange-900"><strong>{t('Payslip dispute')}:</strong> {t('Employees can raise a question before payroll is marked paid. Bank transfer is represented as a status only in this web version.')}</div></Card><Card className="p-5"><WalletCards size={24} className="text-orange-500"/><h2 className="mt-3 font-bold text-slate-900">{t('Payroll inputs')}</h2><div className="mt-5 grid gap-3"><InfoTile label={t("Actual workdays")} value="20.5" /><InfoTile label={t("Paid leave")} value="1.0 day" /><InfoTile label={t("OT hours")} value="2.7" /><InfoTile label={t("Payment status")} value="Awaiting approval" /></div></Card></div></AppShell>;

  if (mode === 'performance') return <AppShell breadcrumb={['Self Service', 'Performance']}><SectionHeader title={t("Goals & Review")} description={t("Track KPI/OKR progress, required learning, and self-assessment for the review cycle.")}/><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]"><Card className="p-5"><div className="flex items-center gap-3"><Target size={24} className="text-orange-500"/><h2 className="font-bold text-slate-900">{t('Q4 performance goals')}</h2></div><div className="mt-5 space-y-4">{reviewGoals.map(goal => <div key={goal.goal} className="rounded-2xl border border-slate-100 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold text-slate-900">{t(goal.goal)}</h3><p className="text-sm text-slate-500">{t('Weight')}: {t(goal.weight)} · {t(goal.manager)}</p></div><span className="text-sm font-bold text-slate-700">{goal.progress}%</span></div><div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-orange-500" style={{ width: `${goal.progress}%` }} /></div></div>)}</div></Card><div className="space-y-5"><Card className="p-5"><div className="flex items-center gap-3"><GraduationCap size={24} className="text-orange-500"/><h2 className="font-bold text-slate-900">{t('Required learning')}</h2></div><div className="mt-4 space-y-3">{learningItems.map(item => <div key={item.course} className="rounded-xl bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-800">{t(item.course)}</p><StatusBadge status={item.status === 'Completed' ? 'Success' : 'Pending'} /></div><p className="mt-1 text-xs text-slate-500">{t('Due')} {t(item.due)} · {t(item.score)}</p></div>)}</div></Card><Card className="p-5"><h2 className="font-bold text-slate-900">{t('Self-assessment')}</h2><textarea value={selfAssessment} onChange={event => { setSelfAssessment(event.target.value); sessionStorage.setItem('eris-self-assessment', event.target.value); }} placeholder={t('Summarize your outcomes, blockers, and support needed.')} className="mt-3 min-h-32 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/><p className="mt-2 text-xs text-slate-500">{t('Saved automatically in this demo session.')}</p></Card></div></div></AppShell>;

  if (mode === 'offboarding') return <AppShell breadcrumb={['Self Service', 'Offboarding']}><SectionHeader title={t("Offboarding")} description={t("Submit resignation and track handover checklist. This is a web workflow, not an external account integration.")}/><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]"><Card className="p-5"><div className="flex items-center gap-3"><DoorOpen size={24} className="text-orange-500"/><div><h2 className="font-bold text-slate-900">{t('Resignation request')}</h2><p className="text-sm text-slate-500">{t(offboarding.submitted ? t('Submitted to HR and line manager') : t('Not submitted'))}</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold text-slate-700">{t('Expected last working day')}<input type="date" value={offboarding.lastWorkingDay} onChange={event => saveOffboarding({ ...offboarding, lastWorkingDay: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/></label><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-400">{t('Account status')}</p><p className="mt-2 text-sm font-semibold text-slate-800">{t(offboarding.submitted ? t('Active until final approval') : t('Active'))}</p></div></div><label className="mt-4 block text-sm font-semibold text-slate-700">{t('Reason')}<textarea value={offboarding.reason} onChange={event => saveOffboarding({ ...offboarding, reason: event.target.value })} className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/></label><Button className="mt-4" disabled={!offboarding.reason.trim() && !offboarding.submitted} onClick={() => saveOffboarding({ ...offboarding, submitted: true })}><FileCheck2 size={16}/>{t(offboarding.submitted ? t('Request submitted') : t('Submit resignation'))}</Button></Card><Card className="p-5"><h2 className="font-bold text-slate-900">{t('Handover checklist')}</h2><div className="mt-4 space-y-3">{offboardingTasks.map(task => <label key={task.key} className="flex cursor-pointer gap-3 rounded-xl bg-slate-50 p-4"><input type="checkbox" checked={Boolean(offboarding.checklist[task.key])} onChange={event => saveOffboarding({ ...offboarding, checklist: { ...offboarding.checklist, [task.key]: event.target.checked } })} className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"/><span><span className="block text-sm font-semibold text-slate-800">{t(task.owner)}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{t(task.task)}</span></span></label>)}</div></Card></div></AppShell>;

  if (mode === 'surveys') return <AppShell breadcrumb={['Self Service', 'My Surveys']}><SectionHeader title={t("My Surveys")} description={t("Share confidential feedback through active employee surveys.")}/><Card className="mx-auto max-w-3xl p-6">{surveyDone ? <div className="py-10 text-center"><CheckCircle2 size={48} className="mx-auto text-emerald-500"/><h2 className="mt-4 text-xl font-bold text-slate-900">{t('Response submitted')}</h2><p className="mt-2 text-sm text-slate-500">{t('Thank you. Your response has been recorded anonymously.')}</p></div> : <><div className="flex items-center gap-3"><HeartPulse size={25} className="text-orange-500"/><div><h2 className="font-bold text-slate-900">{t("Q4 Employee Pulse Survey")}</h2><p className="text-sm text-slate-500">{t('Due October 20, 2026')}</p></div></div><div className="mt-6 space-y-5"><SurveyQuestion label={t("How satisfied are you with your current role?")} value={answers.satisfaction} onChange={value => setAnswers({...answers,satisfaction:value})}/><SurveyQuestion label={t("How manageable is your current workload?")} value={answers.workload} onChange={value => setAnswers({...answers,workload:value})}/><label className="block text-sm font-semibold text-slate-700">{t('Additional comments')}<textarea value={answers.comment} onChange={event => setAnswers({...answers,comment:event.target.value})} className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"/></label></div><Button className="mt-6" disabled={!answers.satisfaction || !answers.workload} onClick={() => { sessionStorage.setItem('eris-survey-q4-2026', 'submitted'); setSurveyDone(true); }}><Send size={16}/>{t('Submit response')}</Button></>}</Card></AppShell>;

  const actions = [
    { label:'My Profile', description:'Onboarding documents, contract, shift, and HR record', icon:IdCard, to:'/my-profile', status: 'View profile' },
    { label:'My Attendance', description:'Record working time using your current GPS location.', icon:Clock3, to:'/my-attendance', status: 'Open' },
    { label:'Requests & Approvals', description:'Leave, OT, shift change, and remote-work requests', icon:CalendarCheck2, to:'/my-requests', status: t('{count} pending', { count: requests.filter(item => item.status === 'Pending').length }) },
    { label:'My Payslips', description:'Salary, OT, allowances, deductions, and payslip status', icon:WalletCards, to:'/my-payroll', status: money(netPay) },
    { label:'Goals & Review', description:'KPI/OKR progress, learning, and self-assessment', icon:ClipboardCheck, to:'/my-performance', status: '66% avg' },
    { label:'Offboarding', description:'Resignation request and handover checklist', icon:DoorOpen, to:'/my-offboarding', status: offboarding.submitted ? 'Submitted' : 'Available' },
    { label:'My Surveys', description:'Complete pulse surveys and share confidential feedback', icon:HeartPulse, to:'/my-surveys', status: t('{count} open', { count: openSurveys }) },
  ];
  return <AppShell breadcrumb={['Employee Self Service']}><section className="mb-5 overflow-hidden rounded-[24px] bg-slate-900 p-7 text-white shadow-xl"><div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-300">{t('Employee Self Service')}</p><h1 className="mt-2 text-2xl font-extrabold">{t('Welcome back')}, {employee.name}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{t('One web workspace for profile, attendance, requests, payroll, performance review, and offboarding workflows.')}</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><HeroStat icon={CalendarDays} label={t("Leave left")} value={t('{count} days', { count: leaveBalance.annual.toLocaleString(locale) })} /><HeroStat icon={Clock3} label={t("Workdays")} value="20.5" /><HeroStat icon={PiggyBank} label={t("Net pay")} value={money(netPay)} /><HeroStat icon={ShieldCheck} label={t("Status")} value={employee.status} /></div></div></section><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{actions.map(action => <button key={action.to} onClick={() => navigate(action.to)} className="rounded-[20px] border border-white/80 bg-white p-6 text-left shadow-[0_8px_28px_rgba(30,41,59,0.07)] transition hover:-translate-y-0.5 hover:shadow-lg"><div className="flex items-start justify-between gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600"><action.icon size={22}/></span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{t(action.status)}</span></div><h2 className="mt-5 font-bold text-slate-900">{t(action.label)}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{t(action.description)}</p></button>)}</div><div className="mt-5 grid gap-5 lg:grid-cols-3"><Card className="p-5"><MessageSquareText size={23} className="text-orange-500"/><h2 className="mt-3 font-bold text-slate-900">{t('Next approval')}</h2><p className="mt-2 text-sm text-slate-500">{t(pendingRequests ? t('Requests awaiting HR review: {count}.', { count: pendingRequests }) : t('No requests awaiting review.'))}</p></Card><Card className="p-5"><FileText size={23} className="text-orange-500"/><h2 className="mt-3 font-bold text-slate-900">{t('My Surveys')}</h2><p className="mt-2 text-sm text-slate-500">{t(openSurveys ? t('Surveys awaiting your response: {count}.', { count: openSurveys }) : t('No surveys are waiting for your response.'))}</p></Card><Card className="p-5"><BriefcaseBusiness size={23} className="text-orange-500"/><h2 className="mt-3 font-bold text-slate-900">{t('Current role')}</h2><p className="mt-2 text-sm text-slate-500">{t(employee.role)} · {t(employee.department)}</p></Card></div></AppShell>;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  const { t } = useLanguage();
  return <div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{t(label)}</dt><dd className="mt-2 text-sm font-semibold text-slate-800">{t(value)}</dd></div>;
}

function MetricTile({ label, value, tone }: { label: string; value: string; tone: 'emerald' | 'blue' }) {
  const { t } = useLanguage();
  const classes = tone === 'emerald' ? 'bg-emerald-50 text-emerald-800' : 'bg-blue-50 text-blue-800';
  return <div className={`rounded-2xl p-5 ${classes}`}><p className="text-xs font-bold uppercase">{t(label)}</p><p className="mt-2 text-2xl font-extrabold">{t(value)}</p></div>;
}

function HeroStat({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string }) {
  const { t } = useLanguage();
  return <div className="min-w-28 rounded-2xl bg-white/10 p-3"><Icon size={17} className="text-orange-200"/><p className="mt-2 text-[11px] font-semibold uppercase text-slate-300">{t(label)}</p><p className="mt-1 text-sm font-extrabold text-white">{t(value)}</p></div>;
}

function SurveyQuestion({ label, value, onChange }: { label: string; value: string; onChange: (value:string)=>void }) {
  const { t } = useLanguage();
  return <fieldset><legend className="text-sm font-semibold text-slate-700">{t(label)}</legend><div className="mt-2 flex flex-wrap gap-2">{['1','2','3','4','5'].map(score => <button type="button" key={score} onClick={() => onChange(score)} className={`flex h-11 w-11 items-center justify-center rounded-full border text-sm font-bold ${value===score?'border-orange-500 bg-orange-500 text-white':'border-slate-200 bg-white text-slate-600 hover:border-orange-300'}`}>{t(score)}</button>)}</div></fieldset>;
}
