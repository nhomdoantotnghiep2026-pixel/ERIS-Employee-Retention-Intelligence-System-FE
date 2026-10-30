import { useEffect, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { BadgeCheck, BriefcaseBusiness, Building2, CalendarDays, CheckCircle2, IdCard, Mail, MapPin, Phone, Route, UserRound, WalletCards } from 'lucide-react';
import { MotionConfig, motion } from 'motion/react';
import { SearchableSelect } from '../components/SearchableSelect';
import { AppShell } from '../components/AppShell';
import { EmployeeCreateBackgroundFields, type CreateEducationDraft, type CreateExperienceDraft } from '../components/EmployeeCreateBackgroundFields';
import { EmployeeApiHistory } from '../components/EmployeeApiHistory';
import { employeeDate, jobChangeDateRestriction } from '../utils/employeeDates';
import { useAutoDismissFeedback } from '../hooks/useAutoDismissState';
import { Button, Card } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { createEmployeeProfile, deactivateEmployeeProfile, getEmployeeProfile, listEmployeeProfiles, updateEmployeeProfile,
  listDepartments, listPositions, searchPlaces, getApiErrorMessage, ApiError, type EmployeeProfile, type EmployeeInput, type EmployeeChanges, type PlaceSuggestion } from '../services/api';

const control = 'mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm focus:outline-orange-500 disabled:bg-slate-100';
const createControl = 'mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100';
const EMPLOYEE_DRAFT_KEY = 'eris.employee-create-draft.v2';
type Form = { fullName: string; email: string; hireDate: string; departmentId: string; positionId: string;
  phone: string; dateOfBirth: string; gender: string; address: string; addressRefId: string; employmentType: string; currentSalary: string };
const empty: Form = { fullName: '', email: '', hireDate: '', departmentId: '', positionId: '', phone: '', dateOfBirth: '', gender: '', address: '', addressRefId: '', employmentType: '', currentSalary: '' };
const initialEducation: CreateEducationDraft = { id: 1, educationLevel: '2', fieldOfStudy: '', graduationYear: '', institution: '', institutionRefId: '' };
const createContainerMotion = { hidden: {}, visible: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } } };
const createItemMotion = {
  hidden: { opacity: 0, y: 18, scale: 0.992 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 125, damping: 20, mass: 0.75 } },
};
const dateOnly = employeeDate;
const toForm = (value: EmployeeProfile): Form => ({
  fullName: value.fullName, email: value.email, hireDate: dateOnly(value.hireDate),
  departmentId: String(value.departmentId), positionId: String(value.positionId), phone: value.phone || '',
  dateOfBirth: dateOnly(value.dateOfBirth), gender: value.gender || '', address: value.address || '',
  employmentType: value.employmentType || '', currentSalary: value.currentSalary == null ? '' : String(value.currentSalary), addressRefId: '',
});

export default function HrEmployees() {
  const { language } = useLanguage();
  const text = (vi: string, en: string) => language === 'vi' ? vi : en;
  const navigate = useNavigate(), location = useLocation(), { id } = useParams();
  const creating = location.pathname === '/employees/new', routeEditing = location.pathname.endsWith('/edit');
  const showingRecord = Boolean(id), employeeId = Number(id);
  const [rows, setRows] = useState<EmployeeProfile[]>([]);
  const [detail, setDetail] = useState<EmployeeProfile | null>(null);
  const [inlineEditing, setInlineEditing] = useState(false);
  const editing = routeEditing || inlineEditing;
  const [form, setForm] = useState<Form>(empty);
  const [educations, setEducations] = useState<CreateEducationDraft[]>([initialEducation]);
  const [experiences, setExperiences] = useState<CreateExperienceDraft[]>([]);
  const [addressSuggestions, setAddressSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([]);
  const [positions, setPositions] = useState<Array<{ id: number; name: string; departmentId?: number | null }>>([]);
  const [catalogError, setCatalogError] = useState('');
  const [query, setQuery] = useState(''), [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState(''), [positionId, setPositionId] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [page, setPage] = useState(1), [total, setTotal] = useState(0), [pages, setPages] = useState(0);
  const [revision, setRevision] = useState(0), [loading, setLoading] = useState(true), [pending, setPending] = useState(false);
  const { error, message, setError, setMessage } = useAutoDismissFeedback();
  const [emailError, setEmailError] = useState('');

  const jobDateRestriction = detail ? jobChangeDateRestriction(detail.hireDate) : null;
  const jobDateMessage = jobDateRestriction === 'future'
    ? text(`Chưa thể đổi phòng ban/vị trí vì ngày vào làm (${dateOnly(detail?.hireDate)}) chưa đến. Bạn vẫn có thể cập nhật các thông tin khác.`, `Department/position changes are unavailable before the hire date (${dateOnly(detail?.hireDate)}). Other information can still be updated.`)
    : text('Chưa thể đổi phòng ban/vị trí trong ngày vào làm vì lịch sử chỉ lưu ngày. Bạn vẫn có thể cập nhật các thông tin khác.', 'Department/position changes are unavailable on the hire date because history records calendar days. Other information can still be updated.');

  useEffect(() => {
    const controller = new AbortController();
    setCatalogError('');
    void Promise.all([listDepartments(controller.signal, { limit: Number.MAX_SAFE_INTEGER }), listPositions(controller.signal, { limit: Number.MAX_SAFE_INTEGER })])
      .then(([d, p]) => { if (!controller.signal.aborted) { setDepartments(d.data); setPositions(p.data); } })
      .catch(cause => { if (!controller.signal.aborted) setCatalogError(getApiErrorMessage(cause, 'Could not load departments and positions.')); });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    const controller = new AbortController();
    setError(''); setLoading(true); setDetail(null);
    if (creating) {
      try {
        const savedDraft = window.localStorage.getItem(EMPLOYEE_DRAFT_KEY);
        const parsed = savedDraft ? JSON.parse(savedDraft) as { form?: Partial<Form>; educations?: CreateEducationDraft[]; experiences?: CreateExperienceDraft[] } : null;
        setForm(parsed?.form ? { ...empty, ...parsed.form } : empty);
        setEducations(parsed?.educations?.length ? parsed.educations : [initialEducation]);
        setExperiences(parsed?.experiences || []);
      } catch {
        setForm(empty);
        setEducations([initialEducation]);
        setExperiences([]);
      }
      setLoading(false); return () => controller.abort();
    }
    if (showingRecord) {
      if (!Number.isSafeInteger(employeeId) || employeeId < 1) { setError('Invalid employee ID.'); setLoading(false); return; }
      void getEmployeeProfile(employeeId, controller.signal).then(value => {
        if (!controller.signal.aborted) { setDetail(value); setForm(toForm(value)); }
      }).catch(cause => { if (!controller.signal.aborted) setError(getApiErrorMessage(cause, 'Could not load employee.')); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    } else {
      void listEmployeeProfiles({ page, limit: 20, search, departmentId: departmentId ? Number(departmentId) : undefined,
        positionId: positionId ? Number(positionId) : undefined, employmentStatus: status || undefined }, controller.signal)
        .then(result => {
          if (controller.signal.aborted) return;
          if (!result.data.length && page > 1) { setPage(value => value - 1); return; }
          setRows(result.data); setTotal(result.pagination.total); setPages(result.pagination.totalPages);
        }).catch(cause => { if (!controller.signal.aborted) setError(getApiErrorMessage(cause, 'Could not load employees.')); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }
    return () => controller.abort();
  }, [creating, showingRecord, employeeId, page, search, departmentId, positionId, status, revision]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending || (editing && !detail)) return;
    setError(''); setMessage(''); setEmailError('');
    if (creating && educations.some(row => !row.institutionRefId)) {
      setError(text('Hãy chọn trường/cơ sở đào tạo từ danh sách gợi ý trước khi lưu.', 'Select every institution from the verified suggestions before saving.'));
      return;
    }
    if (creating && experiences.some(row => row.endDate && row.endDate < row.startDate)) {
      setError(text('Tháng kết thúc kinh nghiệm không được trước tháng bắt đầu.', 'An experience end month cannot be before its start month.'));
      return;
    }
    setPending(true);
    try {
      const input: EmployeeInput = {
        fullName: form.fullName.trim(), email: form.email.trim(), hireDate: form.hireDate,
        departmentId: Number(form.departmentId), positionId: Number(form.positionId),
        phone: form.phone.trim() || null, dateOfBirth: form.dateOfBirth || null, gender: form.gender || null,
        address: form.address.trim() || null,
        ...(form.addressRefId ? { addressRefId: form.addressRefId } : {}),
        employmentType: form.employmentType.trim() || null,
        currentSalary: form.currentSalary === '' ? null : Number(form.currentSalary),
        ...(creating ? {
          educations: educations.map(row => ({
            educationLevel: Number(row.educationLevel),
            fieldOfStudy: row.fieldOfStudy.trim() || null,
            institution: row.institution.trim(),
            institutionRefId: row.institutionRefId,
            graduationYear: row.graduationYear ? Number(row.graduationYear) : null,
          })),
          workExperiences: experiences.map(row => ({
            companyName: row.companyName.trim(), positionTitle: row.positionTitle.trim(),
            startDate: row.startDate, endDate: row.endDate || null,
          })),
        } : {}),
      };
      let saved: EmployeeProfile;
      if (editing && detail) {
        const changes: EmployeeChanges = {};
        const current = toForm(detail);
        const editable = ['fullName', 'phone', 'gender', 'address', 'departmentId', 'positionId', 'employmentType', 'currentSalary'] as const;
        for (const key of editable) {
          const nextValue = String(form[key] ?? '').trim();
          const currentValue = String(current[key] ?? '').trim();
          const changed = key === 'currentSalary'
            ? nextValue === '' ? detail.currentSalary != null : currentValue === '' ? true : Number(nextValue) !== Number(currentValue)
            : nextValue !== currentValue;
          if (changed) Object.assign(changes, { [key]: input[key] });
        }
        if (changes.address !== undefined && form.addressRefId) changes.addressRefId = form.addressRefId;
        if (jobDateRestriction && (changes.departmentId !== undefined || changes.positionId !== undefined)) {
          setError(jobDateMessage);
          return;
        }
        if (!Object.keys(changes).length) {
          setMessage(text('Chưa có thay đổi để lưu.', 'No changes to save.'));
          return;
        }
        saved = await updateEmployeeProfile(detail.id, changes);
      } else saved = await createEmployeeProfile(input);
      if (creating) window.localStorage.removeItem(EMPLOYEE_DRAFT_KEY);
      setMessage(saved.emailDelivery === 'FAILED'
        ? text('Đã lưu hồ sơ và tài khoản nhưng gửi email thất bại. Không tạo lại; liên hệ quản trị viên để cấp mật khẩu tạm an toàn.', 'Profile and account saved, but email delivery failed. Do not create again; contact your administrator.')
        : text(editing ? 'Đã cập nhật nhân viên.' : 'Đã tạo nhân viên và tài khoản đăng nhập. Mật khẩu tạm được gửi qua email.', editing ? 'Employee updated.' : 'Employee and login account created. The temporary password is sent by email.'));
      setInlineEditing(false); navigate('/employees/' + saved.id, { replace: editing }); setRevision(value => value + 1);
    } catch (cause) {
      if (creating && cause instanceof ApiError && (cause.code === 'EMAIL_EXISTS' ||
        (cause.status === 409 && /email.*(?:already|exists|in use)/i.test(cause.message)))) {
        setEmailError(text('Email này đã tồn tại trong hệ thống. Vui lòng nhập email khác.', 'This email is already in use. Please enter another email.'));
        return;
      }
      setError(getApiErrorMessage(cause, 'Could not save employee.'));
    }
    finally { setPending(false); }
  }

  async function deactivate(employee: EmployeeProfile) {
    if (pending || !window.confirm(text('Ngừng hoạt động nhân viên ' + employee.fullName + '? Tài khoản đăng nhập liên kết cũng sẽ bị khóa.', 'Deactivate ' + employee.fullName + '? The linked login account will also be disabled.'))) return;
    setPending(true); setError(''); setMessage('');
    try {
      await deactivateEmployeeProfile(employee.id);
      setMessage(text('Đã ngừng hoạt động nhân viên và khóa tài khoản liên kết.', 'Employee and linked account deactivated.'));
      navigate('/employees'); setRevision(value => value + 1);
    } catch (cause) { setError(getApiErrorMessage(cause, 'Could not deactivate employee.')); }
    finally { setPending(false); }
  }

  function beginInlineEdit(event: MouseEvent<HTMLButtonElement>) {
    // This control lives inside the employee form, but entering edit mode must
    // never be interpreted as a save attempt.
    event.preventDefault();
    event.stopPropagation();
    if (!detail) return;
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);
    setForm(toForm(detail));
    setError(''); setMessage(''); setEmailError('');
    setInlineEditing(true);
  }

  function cancelInlineEdit() {
    if (detail) setForm(toForm(detail));
    setError(''); setEmailError(''); setAddressSuggestions([]); setShowAddressSuggestions(false);
    setInlineEditing(false);
    if (routeEditing && detail) navigate('/employees/' + detail.id, { replace: true });
  }

  const requiredLabel = (label: string, required: boolean) => <>{label.replace(/\s*\*\s*$/, '')}{required && <span aria-hidden="true" className="ml-1 font-semibold text-red-600">*</span>}</>;
  const createField = (key: keyof Form, label: string, type = 'text', required = false, placeholder = '') => <label className="block text-sm font-semibold leading-5 text-slate-700">{requiredLabel(label, required)}
    <input className={createControl} type={type} required={required} value={form[key]} disabled={pending} placeholder={placeholder}
      autoComplete={key === 'email' ? 'email' : key === 'phone' ? 'tel' : key === 'fullName' ? 'name' : undefined}
      maxLength={key === 'fullName' ? 150 : key === 'phone' ? 30 : key === 'email' ? 255 : undefined}
      min={type === 'number' ? '0.01' : undefined} step={type === 'number' ? '0.01' : undefined}
      aria-invalid={key === 'email' && Boolean(emailError)} aria-describedby={key === 'email' && emailError ? 'employee-email-error' : undefined}
      onChange={event => { if (key === 'email') setEmailError(''); setForm(value => ({ ...value, [key]: event.target.value })); }} />
    {key === 'email' && emailError && <span id="employee-email-error" role="alert" className="mt-1.5 block text-xs font-medium text-red-600">{emailError}</span>}
  </label>;
  const catalogSelect = (label: string, value: string, change: (id: string) => void, options: Array<{ id: number; name: string }>, required = false, disabled = false) =>
    <SearchableSelect key={label + revision + (id || '')} label={label} value={value} options={options} onChange={change} required={required} disabled={pending || disabled}
      placeholder={text('Chọn hoặc nhập để tìm', 'Select or type to search')}
      emptyText={text('Không tìm thấy kết quả.', 'No results found.')}
      invalidText={text('Vui lòng chọn một mục trong danh sách.', 'Please select an existing item.')} />;
  const active = (value: string) => value === 'ACTIVE' ? text('Đang hoạt động', 'Active') : value === 'INACTIVE' ? text('Ngừng hoạt động', 'Inactive') : value;
  const createPositions = form.departmentId
    ? positions.filter(position => position.departmentId === Number(form.departmentId))
    : [];
  const detailItem = (icon: ReactNode, label: string, value: unknown) => <div className="flex min-w-0 items-start gap-3 rounded-xl px-1 py-2.5">
    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 ring-1 ring-slate-100">{icon}</span>
    <div className="min-w-0"><dt className="text-[13px] font-medium leading-5 text-slate-500">{label}</dt><dd className="mt-0.5 whitespace-pre-wrap break-words text-[15px] font-semibold leading-6 text-slate-950">{value == null || value === '' ? '—' : String(value)}</dd></div>
  </div>;
  const detailDepartment = detail ? departments.find(item => item.id === detail.departmentId)?.name || '—' : '—';
  const detailPosition = detail ? positions.find(item => item.id === detail.positionId)?.name || '—' : '—';
  const detailInitials = detail?.fullName.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toLocaleUpperCase() || 'NV';
  const detailGender = detail?.gender === 'MALE' ? text('Nam', 'Male') : detail?.gender === 'FEMALE' ? text('Nữ', 'Female') : detail?.gender === 'OTHER' ? text('Khác', 'Other') : '—';
  const detailEmploymentType = detail?.employmentType === 'FULL_TIME' ? text('Toàn thời gian', 'Full time') : detail?.employmentType === 'PART_TIME' ? text('Bán thời gian', 'Part time') : detail?.employmentType === 'CONTRACT' ? text('Hợp đồng', 'Contract') : detail?.employmentType === 'INTERNSHIP' ? text('Thực tập', 'Internship') : detail?.employmentType || '—';
  const detailSalary = detail?.currentSalary == null ? '—' : new Intl.NumberFormat(language === 'vi' ? 'vi-VN' : 'en-US', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(detail.currentSalary));
  useEffect(() => {
    const query = form.address.trim();
    if (!showAddressSuggestions || form.addressRefId || query.length < 3 || (showingRecord && !editing)) {
      setAddressSuggestions([]); setAddressLoading(false); return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setAddressLoading(true);
      void searchPlaces(query, controller.signal)
        .then(result => { if (!controller.signal.aborted) setAddressSuggestions(result.places); })
        .catch(() => { if (!controller.signal.aborted) setAddressSuggestions([]); })
        .finally(() => { if (!controller.signal.aborted) setAddressLoading(false); });
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [form.address, form.addressRefId, showingRecord, editing, showAddressSuggestions]);
  useEffect(() => {
    if (!creating) return;
    const timer = window.setTimeout(() => {
      try {
        const hasDraft = Object.values(form).some(value => value.trim().length > 0)
          || educations.some(row => row.institution || row.fieldOfStudy || row.graduationYear)
          || experiences.length > 0;
        if (hasDraft) window.localStorage.setItem(EMPLOYEE_DRAFT_KEY, JSON.stringify({ form, educations, experiences }));
        else window.localStorage.removeItem(EMPLOYEE_DRAFT_KEY);
      } catch { /* Storage may be unavailable in private browsing. */ }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [creating, form, educations, experiences]);
  return <AppShell breadcrumb={['Workforce', 'Employees']}>
    <Card className="mb-5 p-6"><div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{text(creating ? 'Thêm nhân viên' : showingRecord ? 'Chi tiết nhân viên' : 'Danh bạ nhân viên', creating ? 'Add employee' : showingRecord ? 'Employee details' : 'Employee directory')}</h1>
      <div className="flex gap-3">{!creating && <Button onClick={() => navigate('/employees/new')}>{text('Thêm nhân viên', 'Add employee')}</Button>}
        {(creating || showingRecord) && <Button variant="secondary" onClick={() => navigate('/employees')}>{text('Về danh sách', 'Back to list')}</Button>}</div>
    </div></Card>
    {message && <p role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-emerald-800">{message}</p>}
    {catalogError && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4">{catalogError}<Button variant="secondary" onClick={() => setRevision(v => v + 1)}>{text('Thử lại', 'Retry')}</Button></p>}
    {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-red-800">{error}<Button variant="secondary" onClick={() => setRevision(v => v + 1)}>{text('Thử lại', 'Retry')}</Button></p>}
    {loading ? <Card className="p-6"><p role="status">{text('Đang tải nhân viên...', 'Loading employees...')}</p></Card>
      : creating ? <MotionConfig reducedMotion="user"><motion.form onSubmit={save} initial="hidden" animate="visible" variants={createContainerMotion} className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <fieldset disabled={pending} className="min-w-0 space-y-5 border-0 p-0">
          <motion.div variants={createItemMotion}><Card className="border-orange-100 bg-gradient-to-r from-orange-50/80 to-white p-5 transition-shadow duration-300 hover:shadow-[0_14px_36px_rgba(249,115,22,0.10)] sm:p-6">
            <div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-orange-600 shadow-sm ring-1 ring-orange-100"><CheckCircle2 size={20} aria-hidden="true" /></span>
              <div><h2 className="text-lg font-semibold text-slate-950">{text('Tạo hồ sơ nhân viên đầy đủ', 'Create a complete employee profile')}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">{text('Mã nhân viên được tự sinh. Dữ liệu đang nhập được lưu tạm trên trình duyệt.', 'The employee code is generated automatically. Your draft is saved in this browser.')}</p>
                <p className="mt-2 text-sm font-medium text-slate-700">{text('Trường có', 'Fields marked')} <span className="font-bold text-red-600">*</span>{text(' là bắt buộc.', ' are required.')}</p></div>
            </div>
          </Card></motion.div>

          <motion.section variants={createItemMotion} whileHover={{ y: -2 }} transition={{ duration: 0.22 }} className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-300 hover:shadow-[0_14px_38px_rgba(30,41,59,0.09)] sm:p-6">
            <div className="mb-5 flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600 ring-1 ring-orange-100"><UserRound size={20} aria-hidden="true" /></span>
              <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-600">01</p><h3 className="mt-1 text-lg font-semibold text-slate-950">{text('Thông tin cá nhân', 'Personal information')}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{text('Thông tin để tạo hồ sơ và tài khoản đăng nhập.', 'Profile and sign-in account information.')}</p></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {createField('fullName', text('Họ và tên', 'Full name'), 'text', true, text('Nguyễn Văn A', 'Nguyen Van A'))}
              {createField('email', 'Email', 'email', true, 'nhanvien@congty.com')}
              {createField('phone', text('Số điện thoại', 'Phone'), 'tel', true, '0901234567')}
              {createField('dateOfBirth', text('Ngày sinh', 'Date of birth'), 'date', true)}
              <label className="block text-sm font-semibold leading-5 text-slate-700">{requiredLabel(text('Giới tính', 'Gender'), true)}<select required className={createControl} value={form.gender} onChange={event => setForm(value => ({ ...value, gender: event.target.value }))}><option value="">{text('Chọn giới tính', 'Select gender')}</option><option value="MALE">{text('Nam', 'Male')}</option><option value="FEMALE">{text('Nữ', 'Female')}</option><option value="OTHER">{text('Khác', 'Other')}</option></select></label>
            </div>
          </motion.section>

          <motion.section variants={createItemMotion} whileHover={{ y: -2 }} transition={{ duration: 0.22 }} className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-300 hover:shadow-[0_14px_38px_rgba(30,41,59,0.09)] sm:p-6">
            <div className="mb-5 flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600 ring-1 ring-orange-100"><BriefcaseBusiness size={20} aria-hidden="true" /></span>
              <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-600">02</p><h3 className="mt-1 text-lg font-semibold text-slate-950">{text('Công việc hiện tại', 'Current employment')}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{text('Chọn phòng ban trước để hiển thị đúng vị trí liên kết.', 'Choose a department first to show its linked positions.')}</p></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {catalogSelect(text('Phòng ban *', 'Department *'), form.departmentId, value => setForm(current => ({ ...current, departmentId: value, positionId: '' })), departments, true)}
              {catalogSelect(text('Chức danh / Vị trí *', 'Position *'), form.positionId, value => setForm(current => ({ ...current, positionId: value })), createPositions, true, !form.departmentId || !createPositions.length)}
              {!form.departmentId && <p className="-mt-2 text-xs leading-5 text-slate-500 md:col-start-2">{text('Chọn phòng ban trước.', 'Select a department first.')}</p>}
              {form.departmentId && !createPositions.length && <p className="-mt-2 text-xs font-medium leading-5 text-amber-700 md:col-start-2">{text('Phòng ban này chưa có vị trí đang hoạt động.', 'This department has no active positions.')}</p>}
              {createField('hireDate', text('Ngày vào làm', 'Hire date'), 'date', true)}
              <label className="block text-sm font-semibold leading-5 text-slate-700">{requiredLabel(text('Loại hợp đồng', 'Employment type'), true)}<select required className={createControl} value={form.employmentType} onChange={event => setForm(value => ({ ...value, employmentType: event.target.value }))}><option value="">{text('Chọn loại hợp đồng', 'Select employment type')}</option><option value="FULL_TIME">{text('Toàn thời gian', 'Full time')}</option><option value="PART_TIME">{text('Bán thời gian', 'Part time')}</option><option value="CONTRACT">{text('Hợp đồng', 'Contract')}</option><option value="INTERNSHIP">{text('Thực tập', 'Internship')}</option></select></label>
              <div className="md:col-span-2">{createField('currentSalary', text('Lương hiện tại (VNĐ)', 'Current salary (VND)'), 'number', true, '18000000')}</div>
            </div>
          </motion.section>

          <motion.section variants={createItemMotion} whileHover={{ y: -2 }} transition={{ duration: 0.22 }} className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-300 hover:shadow-[0_14px_38px_rgba(30,41,59,0.09)] sm:p-6">
            <div className="mb-5 flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600 ring-1 ring-orange-100"><MapPin size={20} aria-hidden="true" /></span>
              <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-600">03</p><h3 className="mt-1 text-lg font-semibold text-slate-950">{text('Địa chỉ nhà', 'Home address')}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{text('Hệ thống dùng địa chỉ đã xác minh để tính quãng đường đến công ty.', 'A verified address is used to calculate the commute distance.')}</p></div>
            </div>
            <label className="relative block text-sm font-semibold leading-5 text-slate-700">{requiredLabel(text('Số nhà, đường, phường/xã, tỉnh/thành phố', 'Full address'), true)}
              <textarea required className="mt-1.5 min-h-24 w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-[15px] font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100" value={form.address}
                placeholder={text('Nhập ít nhất 3 ký tự để tìm địa chỉ', 'Type at least 3 characters to search')}
                onFocus={() => setShowAddressSuggestions(true)} onBlur={() => setShowAddressSuggestions(false)} onChange={event => { setShowAddressSuggestions(true); setForm(value => ({ ...value, address: event.target.value, addressRefId: '' })); }} />
              {showAddressSuggestions && (addressLoading || addressSuggestions.length > 0) && <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                {addressLoading && <p className="p-3 text-sm font-normal text-slate-500">{text('Đang tìm địa chỉ...', 'Searching addresses...')}</p>}
                {!addressLoading && addressSuggestions.map(place => <button type="button" key={place.refId} className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-orange-50" onMouseDown={event => event.preventDefault()} onClick={() => { setForm(value => ({ ...value, address: place.resolvedAddress || place.display, addressRefId: place.refId })); setAddressSuggestions([]); setShowAddressSuggestions(false); }}><span className="block text-sm font-semibold text-slate-900">{place.name || place.display}</span><span className="mt-1 block text-xs font-normal leading-5 text-slate-500">{place.resolvedAddress || place.address}</span></button>)}
              </div>}
              <span className={`mt-1.5 block text-xs font-normal leading-5 ${form.addressRefId ? 'text-emerald-700' : 'text-slate-500'}`}>{form.addressRefId ? text('Đã chọn địa chỉ từ danh sách xác minh.', 'Verified address selected.') : text('Chọn gợi ý có số nhà và tên đường.', 'Select a suggestion containing a street number and name.')}</span>
            </label>
          </motion.section>

          <EmployeeCreateBackgroundFields educations={educations} experiences={experiences} dateOfBirth={form.dateOfBirth} disabled={pending} text={text} onEducationsChange={setEducations} onExperiencesChange={setExperiences} />
        </fieldset>
        <motion.aside variants={createItemMotion} className="xl:sticky xl:top-5">
          <Card className="p-5 sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-600">{text('Trước khi lưu', 'Before saving')}</p><h2 className="mt-2 text-lg font-semibold text-slate-950">{text('Hồ sơ nhân viên mới', 'New employee profile')}</h2>
            <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-600"><li className="flex gap-2"><span className="font-bold text-orange-600">1.</span>{text('Hồ sơ và tài khoản chờ kích hoạt qua email.', 'Profile and account wait for email activation.')}</li><li className="flex gap-2"><span className="font-bold text-orange-600">2.</span>{text('Học vấn và kinh nghiệm được lưu cùng hồ sơ.', 'Education and experience are saved with the profile.')}</li><li className="flex gap-2"><span className="font-bold text-orange-600">3.</span>{text('Quãng đường được tính khi tạo.', 'Commute distance is calculated on creation.')}</li></ol>
            <div className="my-5 border-t border-slate-200" /><dl className="space-y-3 text-sm"><div><dt className="text-slate-500">{text('Phòng ban', 'Department')}</dt><dd className="mt-1 font-semibold text-slate-900">{departments.find(item => String(item.id) === form.departmentId)?.name || text('Chưa chọn', 'Not selected')}</dd></div><div><dt className="text-slate-500">{text('Học vấn / Kinh nghiệm', 'Education / Experience')}</dt><dd className="mt-1 font-semibold tabular-nums text-slate-900">{educations.length} / {experiences.length}</dd></div></dl>
            <div className="mt-6 grid gap-2"><Button disabled={pending || !!catalogError}>{text(pending ? 'Đang xác minh và lưu...' : 'Tạo hồ sơ nhân viên', pending ? 'Verifying and saving...' : 'Create employee profile')}</Button><Button type="button" variant="secondary" onClick={() => navigate('/employees')}>{text('Hủy', 'Cancel')}</Button></div>
          </Card>
        </motion.aside>
      </motion.form></MotionConfig>
      : showingRecord && detail ? <MotionConfig reducedMotion="user"><motion.form onSubmit={save} initial="hidden" animate="visible" variants={createContainerMotion} className="space-y-5">
        <motion.div variants={createItemMotion}><Card className="relative overflow-hidden p-5 sm:p-6">
          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-400 via-orange-500 to-amber-400" aria-hidden="true" />
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-amber-50 text-xl font-bold text-orange-700 ring-1 ring-orange-200">{detailInitials}</div>
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="break-words text-2xl font-bold tracking-[-0.02em] text-slate-950">{editing ? form.fullName || detail.fullName : detail.fullName}</h2><span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold ${detail.employmentStatus === 'ACTIVE' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}><span className={`size-1.5 rounded-full ${detail.employmentStatus === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'}`} />{active(detail.employmentStatus)}</span>{editing && <span className="inline-flex min-h-7 items-center rounded-full bg-orange-50 px-2.5 text-xs font-semibold text-orange-700 ring-1 ring-orange-200">{text('Đang chỉnh sửa', 'Editing')}</span>}</div>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600"><span className="font-semibold text-slate-800">{detail.employeeCode}</span><span aria-hidden="true">·</span><span>{editing ? departments.find(item => String(item.id) === form.departmentId)?.name || detailDepartment : detailDepartment}</span><span aria-hidden="true">·</span><span>{editing ? positions.find(item => String(item.id) === form.positionId)?.name || detailPosition : detailPosition}</span></p></div>
            </div>
            {detail.employmentStatus !== 'INACTIVE' && <div className="flex shrink-0 flex-wrap gap-2">{editing ? <><Button type="submit" className="text-sm" disabled={pending || !!catalogError}>{text(pending ? 'Đang lưu...' : 'Lưu thay đổi', pending ? 'Saving...' : 'Save changes')}</Button><Button type="button" className="text-sm" variant="secondary" disabled={pending} onClick={cancelInlineEdit}>{text('Hủy', 'Cancel')}</Button></> : <><Button type="button" className="text-sm" onClick={beginInlineEdit}>{text('Chỉnh sửa hồ sơ', 'Edit profile')}</Button><Button type="button" className="text-sm border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800" variant="secondary" disabled={pending} onClick={() => void deactivate(detail)}>{text('Ngừng hoạt động', 'Deactivate')}</Button></>}</div>}
          </div>
        </Card></motion.div>

        <div className="grid gap-5 lg:grid-cols-3">
          <motion.section variants={createItemMotion} whileHover={{ y: -2 }} className="rounded-[20px] border border-white/80 bg-white p-5 shadow-[0_8px_28px_rgba(30,41,59,0.06)] transition-shadow duration-300 hover:shadow-[0_14px_38px_rgba(30,41,59,0.09)]">
            <div className="mb-3 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 ring-1 ring-orange-100"><UserRound size={20} aria-hidden="true" /></span><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-600">01</p><h3 className="text-base font-semibold text-slate-950">{text('Thông tin cá nhân', 'Personal information')}</h3></div></div>
            {editing ? <div className="space-y-4 border-t border-slate-100 pt-4">
              {createField('fullName', text('Họ và tên', 'Full name'), 'text', true)}
              <dl className="divide-y divide-slate-100 rounded-2xl bg-slate-50/70 px-2">{detailItem(<Mail size={17} aria-hidden="true" />, 'Email', detail.email)}{detailItem(<CalendarDays size={17} aria-hidden="true" />, text('Ngày sinh', 'Date of birth'), dateOnly(detail.dateOfBirth))}</dl>
              {createField('phone', text('Số điện thoại', 'Phone'), 'tel')}
              <label className="block text-sm font-semibold leading-5 text-slate-700">{text('Giới tính', 'Gender')}<select aria-label={text('Giới tính', 'Gender')} className={createControl} value={form.gender} disabled={pending} onChange={event => setForm(value => ({ ...value, gender: event.target.value }))}><option value="">{text('Chọn giới tính', 'Select gender')}</option><option value="MALE">{text('Nam', 'Male')}</option><option value="FEMALE">{text('Nữ', 'Female')}</option><option value="OTHER">{text('Khác', 'Other')}</option></select></label>
            </div> : <dl className="divide-y divide-slate-100">{detailItem(<Mail size={17} aria-hidden="true" />, 'Email', detail.email)}{detailItem(<Phone size={17} aria-hidden="true" />, text('Số điện thoại', 'Phone'), detail.phone)}{detailItem(<CalendarDays size={17} aria-hidden="true" />, text('Ngày sinh', 'Date of birth'), dateOnly(detail.dateOfBirth))}{detailItem(<UserRound size={17} aria-hidden="true" />, text('Giới tính', 'Gender'), detailGender)}</dl>}
          </motion.section>

          <motion.section variants={createItemMotion} whileHover={{ y: -2 }} className="rounded-[20px] border border-white/80 bg-white p-5 shadow-[0_8px_28px_rgba(30,41,59,0.06)] transition-shadow duration-300 hover:shadow-[0_14px_38px_rgba(30,41,59,0.09)]">
            <div className="mb-3 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 ring-1 ring-orange-100"><BriefcaseBusiness size={20} aria-hidden="true" /></span><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-600">02</p><h3 className="text-base font-semibold text-slate-950">{text('Thông tin công việc', 'Employment information')}</h3></div></div>
            {editing ? <div className="space-y-4 border-t border-slate-100 pt-4">
              {jobDateRestriction && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-normal leading-6 text-amber-900">{jobDateMessage}</p>}
              {catalogSelect(text('Phòng ban', 'Department'), form.departmentId, value => setForm(current => ({ ...current, departmentId: value, positionId: '' })), departments, true, Boolean(jobDateRestriction))}
              {catalogSelect(text('Chức danh / Vị trí', 'Position'), form.positionId, value => setForm(current => ({ ...current, positionId: value })), createPositions, true, !form.departmentId || Boolean(jobDateRestriction))}
              <dl className="rounded-2xl bg-slate-50/70 px-2">{detailItem(<CalendarDays size={17} aria-hidden="true" />, text('Ngày vào làm', 'Hire date'), dateOnly(detail.hireDate))}</dl>
              <label className="block text-sm font-semibold leading-5 text-slate-700">{text('Loại hợp đồng', 'Employment type')}<select aria-label={text('Loại hợp đồng', 'Employment type')} className={createControl} value={form.employmentType} disabled={pending} onChange={event => setForm(value => ({ ...value, employmentType: event.target.value }))}><option value="FULL_TIME">{text('Toàn thời gian', 'Full time')}</option><option value="PART_TIME">{text('Bán thời gian', 'Part time')}</option><option value="CONTRACT">{text('Hợp đồng', 'Contract')}</option><option value="INTERNSHIP">{text('Thực tập', 'Internship')}</option></select></label>
              {createField('currentSalary', text('Lương hiện tại', 'Current salary'), 'number')}
            </div> : <dl className="divide-y divide-slate-100">{detailItem(<Building2 size={17} aria-hidden="true" />, text('Phòng ban', 'Department'), detailDepartment)}{detailItem(<IdCard size={17} aria-hidden="true" />, text('Chức danh / Vị trí', 'Position'), detailPosition)}{detailItem(<CalendarDays size={17} aria-hidden="true" />, text('Ngày vào làm', 'Hire date'), dateOnly(detail.hireDate))}{detailItem(<BadgeCheck size={17} aria-hidden="true" />, text('Loại hợp đồng', 'Employment type'), detailEmploymentType)}{detailItem(<WalletCards size={17} aria-hidden="true" />, text('Lương hiện tại', 'Current salary'), detailSalary)}</dl>}
          </motion.section>

          <motion.section variants={createItemMotion} whileHover={{ y: -2 }} className="rounded-[20px] border border-white/80 bg-white p-5 shadow-[0_8px_28px_rgba(30,41,59,0.06)] transition-shadow duration-300 hover:shadow-[0_14px_38px_rgba(30,41,59,0.09)]">
            <div className="mb-3 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 ring-1 ring-orange-100"><MapPin size={20} aria-hidden="true" /></span><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-600">03</p><h3 className="text-base font-semibold text-slate-950">{text('Địa chỉ và di chuyển', 'Address and commute')}</h3></div></div>
            {editing ? <div className="space-y-4 border-t border-slate-100 pt-4"><label className="relative block text-sm font-semibold leading-5 text-slate-700">{text('Địa chỉ đầy đủ', 'Full address')}<textarea aria-label={text('Địa chỉ đầy đủ', 'Full address')} className={`${createControl} min-h-28 resize-y`} value={form.address} disabled={pending} onFocus={() => setShowAddressSuggestions(true)} onBlur={() => setShowAddressSuggestions(false)} onChange={event => { setShowAddressSuggestions(true); setForm(value => ({ ...value, address: event.target.value, addressRefId: '' })); }} />
              {showAddressSuggestions && (addressLoading || addressSuggestions.length > 0) && <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">{addressLoading && <p className="p-3 text-xs text-slate-500">{text('Đang tìm địa chỉ...', 'Searching addresses...')}</p>}{!addressLoading && addressSuggestions.map(place => <button type="button" key={place.refId} className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-orange-50" onMouseDown={event => event.preventDefault()} onClick={() => { setForm(value => ({ ...value, address: place.resolvedAddress || place.display, addressRefId: place.refId })); setAddressSuggestions([]); setShowAddressSuggestions(false); }}><span className="block text-sm font-semibold text-slate-800">{place.name || place.display}</span><span className="mt-1 block text-xs text-slate-500">{place.resolvedAddress || place.address}</span></button>)}</div>}
            </label><dl className="divide-y divide-slate-100 rounded-2xl bg-slate-50/70 px-2">{detailItem(<Route size={17} aria-hidden="true" />, text('Khoảng cách sẽ được tính lại khi lưu', 'Distance will be recalculated on save'), detail.distanceFromHomeKm == null ? null : detail.distanceFromHomeKm + ' km')}{detailItem(<CheckCircle2 size={17} aria-hidden="true" />, text('Trạng thái hiện tại', 'Current status'), detail.distanceCalculation.status === 'READY' ? text('Đã tính được', 'Ready') : detail.distanceCalculation.status === 'NOT_PROVIDED' ? text('Chưa cung cấp địa chỉ', 'Address not provided') : text('Chưa tính được', 'Unavailable'))}</dl></div> : <dl className="divide-y divide-slate-100">{detailItem(<MapPin size={17} aria-hidden="true" />, text('Địa chỉ', 'Address'), detail.address)}{detailItem(<Route size={17} aria-hidden="true" />, text('Khoảng cách đến công ty', 'Distance to office'), detail.distanceFromHomeKm == null ? null : detail.distanceFromHomeKm + ' km')}{detailItem(<CheckCircle2 size={17} aria-hidden="true" />, text('Kết quả tính', 'Calculation status'), detail.distanceCalculation.status === 'READY' ? text('Đã tính được', 'Ready') : detail.distanceCalculation.status === 'NOT_PROVIDED' ? text('Chưa cung cấp địa chỉ', 'Address not provided') : text('Chưa tính được', 'Unavailable'))}</dl>}
          </motion.section>
        </div>
      </motion.form></MotionConfig>
      : !showingRecord && !creating && <Card className="@container p-6">
        <form className="mb-5 grid items-end gap-x-3 gap-y-4 sm:grid-cols-2 @min-[760px]:grid-cols-4 @min-[1080px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,.9fr)_auto] [&>label]:min-w-0 [&_input]:h-10 [&_input]:py-2 [&_select]:h-10 [&_select]:py-2" onSubmit={e => { e.preventDefault(); setPage(1); setSearch(query.trim()); }}>
          <label className="text-sm font-medium">{text('Tìm tên, mã hoặc email', 'Search name, code or email')}<input type="search" className={control} value={query} maxLength={100} onChange={e => { setQuery(e.target.value); if (!e.target.value.trim()) { setSearch(''); setPage(1); } }} /></label>
          {catalogSelect(text('Phòng ban', 'Department'), departmentId, v => { setDepartmentId(v); setPage(1); }, departments)}
          {catalogSelect(text('Chức danh / Vị trí', 'Position'), positionId, v => { setPositionId(v); setPage(1); }, positions)}
          <label className="text-sm font-medium">{text('Trạng thái', 'Status')}<select className={control} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="ACTIVE">{text('Đang hoạt động', 'Active')}</option><option value="INACTIVE">{text('Ngừng hoạt động', 'Inactive')}</option><option value="">{text('Tất cả', 'All')}</option></select></label>
          <div className="col-span-full flex flex-wrap justify-end gap-2 @min-[1080px]:col-span-1 @min-[1080px]:flex-nowrap"><Button>{text('Tìm kiếm', 'Search')}</Button><Button type="button" variant="secondary" onClick={() => { setQuery(''); setSearch(''); setDepartmentId(''); setPositionId(''); setStatus('ACTIVE'); setPage(1); setRevision(v => v + 1); }}>{text('Xóa bộ lọc', 'Clear filters')}</Button><Button type="button" variant="secondary" onClick={() => setRevision(v => v + 1)}>{text('Tải lại', 'Reload')}</Button></div>
        </form>
        {!error && <><div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{[text('Mã nhân viên', 'Employee code'), text('Họ và tên', 'Full name'), 'Email', text('Phòng ban', 'Department'), text('Chức danh', 'Position'), text('Trạng thái', 'Status'), text('Thao tác', 'Actions')].map(h => <th key={h} scope="col" className="p-3">{h}</th>)}</tr></thead><tbody>
          {rows.map(row => <tr key={row.id} className="border-b border-slate-100"><td className="p-3">{row.employeeCode}</td><td className="p-3 font-medium">{row.fullName}</td><td className="p-3">{row.email}</td><td className="p-3">{departments.find(d => d.id === row.departmentId)?.name || '—'}</td><td className="p-3">{positions.find(p => p.id === row.positionId)?.name || '—'}</td><td className="p-3">{active(row.employmentStatus)}</td><td className="w-px p-3"><div className="flex flex-nowrap items-center gap-2"><Link className="inline-flex h-10 items-center rounded-full border px-3 font-medium text-orange-700" to={'/employees/' + row.id}>{text('Xem chi tiết', 'View details')}</Link>{row.employmentStatus !== 'INACTIVE' && <><Button variant="secondary" disabled={pending} onClick={() => void deactivate(row)}>{text('Ngừng hoạt động', 'Deactivate')}</Button></>}</div></td></tr>)}
        </tbody></table>{!rows.length && <p className="py-8 text-center text-slate-500">{text('Không tìm thấy nhân viên.', 'No employees found.')}</p>}</div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">{text('Trang', 'Page')} {page} / {Math.max(1, pages)} · {total} {text('nhân viên', 'employees')}</p><div className="flex gap-3"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{text('Trang trước', 'Previous')}</Button><Button variant="secondary" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>{text('Trang sau', 'Next')}</Button></div></div></>}
      </Card>}
    {showingRecord && detail && <EmployeeApiHistory employeeId={detail.id} employeeEmail={detail.email} dateOfBirth={detail.dateOfBirth} editable={editing && detail.employmentStatus === 'ACTIVE'} />}
  </AppShell>;
}
