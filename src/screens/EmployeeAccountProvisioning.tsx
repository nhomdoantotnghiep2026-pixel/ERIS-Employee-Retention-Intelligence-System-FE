import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Clipboard, Ellipsis, KeyRound, Mail, RefreshCw, Search, ShieldCheck, UserRoundCheck, X, Zap } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/ui/button';
import { Card, SectionHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { useAutoDismissFeedback } from '../hooks/useAutoDismissState';
import { ApiError, getApiErrorMessage, listEmployeeAccountCandidates, listUsers, provisionEmployeeAccount, type ApiUser, type EmployeeAccountCandidate } from '../services/api';

type TimeFilter = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH';
const initials = (name: string) => name.trim().split(/\s+/).slice(-2).map(part => part[0]?.toLocaleUpperCase() || '').join('') || 'NV';
const normalized = (value: string) => value.trim().toLocaleLowerCase();
const localDay = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

function isWithin(value: string | null | undefined, filter: TimeFilter) {
  if (filter === 'ALL') return true;
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  if (filter === 'TODAY') return localDay(date) === localDay(now);
  if (filter === 'MONTH') return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return date >= start && date <= now;
}

export default function EmployeeAccountProvisioning() {
  const { language } = useLanguage();
  const text = (vi: string, en: string) => language === 'vi' ? vi : en;
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<EmployeeAccountCandidate[]>([]);
  const [accounts, setAccounts] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('ALL');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [menuId, setMenuId] = useState<number | null>(null);
  const { error, message, setError, setMessage } = useAutoDismissFeedback();
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(false);

  async function reload() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setLoadError('');
    try {
      const [items, userResult] = await Promise.all([
        listEmployeeAccountCandidates(controller.signal),
        listUsers({ page: 1, limit: 1000 }, controller.signal),
      ]);
      if (!mounted.current || controller.signal.aborted) return;
      setCandidates(items); setAccounts(userResult.data);
      setSelected(current => new Set([...current].filter(id => items.some(item => item.id === id))));
    } catch (cause) {
      if (!mounted.current || controller.signal.aborted) return;
      setLoadError(getApiErrorMessage(cause, text('Không thể tải danh sách cấp tài khoản.', 'Could not load account provisioning data.')));
    } finally {
      if (mounted.current && !controller.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    mounted.current = true; void reload();
    return () => { mounted.current = false; request.current?.abort(); };
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(searchInput.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const departments = useMemo(() => [...new Set(candidates.map(item => item.departmentName?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, language === 'vi' ? 'vi' : 'en')), [candidates, language]);
  const hasDepartmentMetadata = departments.length > 0;
  const hasImportMetadata = candidates.some(item => Boolean(item.createdAt));
  const filtered = useMemo(() => {
    const needle = normalized(query);
    return candidates.filter(item => (!needle || normalized(`${item.fullName} ${item.employeeCode} ${item.email}`).includes(needle)) && (department === 'ALL' || item.departmentName === department) && isWithin(item.createdAt, timeFilter));
  }, [candidates, department, query, timeFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);
  const selectedRows = candidates.filter(item => selected.has(item.id));
  const pageSelected = rows.length > 0 && rows.every(item => selected.has(item.id));
  const employeeAccounts = accounts.filter(account => account.employeeId != null);
  const totalEmployees = employeeAccounts.length + candidates.length;
  const coverage = totalEmployees > 0 ? employeeAccounts.length / totalEmployees * 100 : 100;
  const today = localDay(new Date());
  const provisionedToday = employeeAccounts.filter(account => account.createdAt && localDay(new Date(account.createdAt)) === today).length;
  const firstPageNumber = Math.min(Math.max(1, currentPage - 2), Math.max(1, totalPages - 4));
  const pageNumbers = Array.from({ length: Math.min(5, totalPages) }, (_, index) => firstPageNumber + index);
  useEffect(() => { setPage(value => Math.min(value, totalPages)); }, [totalPages]);

  function toggleOne(id: number) {
    setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function togglePage() {
    setSelected(current => { const next = new Set(current); if (pageSelected) rows.forEach(item => next.delete(item.id)); else rows.forEach(item => next.add(item.id)); return next; });
  }

  async function provisionOne(candidate: EmployeeAccountCandidate) {
    if (busyId !== null || bulkBusy || loading) return;
    setBusyId(candidate.id); setError(''); setMessage('');
    try {
      const result = await provisionEmployeeAccount(candidate.id);
      if (!mounted.current) return;
      setCandidates(items => items.filter(item => item.id !== candidate.id));
      setSelected(current => { const next = new Set(current); next.delete(candidate.id); return next; });
      if (result.emailDelivery === 'FAILED') setError(text('Tài khoản đã được tạo nhưng gửi email kích hoạt thất bại. Không cấp lại tài khoản này.', 'The account was created, but activation email delivery failed. Do not provision it again.'));
      else setMessage(text(`Đã cấp tài khoản cho ${candidate.fullName} và gửi email kích hoạt.`, `Account provisioned for ${candidate.fullName}; activation email sent.`));
      const users = await listUsers({ page: 1, limit: 1000 });
      if (mounted.current) setAccounts(users.data);
    } catch (cause) {
      if (!mounted.current) return;
      if (cause instanceof ApiError && cause.status === 409) await reload();
      setError(getApiErrorMessage(cause, text('Không thể cấp tài khoản nhân viên.', 'Could not provision the employee account.')));
    } finally { if (mounted.current) setBusyId(null); }
  }

  async function provisionBulk() {
    if (bulkBusy || !selectedRows.length) return;
    setBulkBusy(true); setError(''); setMessage('');
    let success = 0; let emailFailed = 0; const failed: string[] = [];
    for (const candidate of selectedRows) {
      try { const result = await provisionEmployeeAccount(candidate.id); success += 1; if (result.emailDelivery === 'FAILED') emailFailed += 1; }
      catch { failed.push(candidate.employeeCode); }
    }
    if (!mounted.current) return;
    setBulkBusy(false); setBulkOpen(false); setSelected(new Set());
    await reload();
    if (failed.length) setError(text(`Đã cấp ${success} tài khoản; ${failed.length} hồ sơ lỗi (${failed.join(', ')}).`, `Provisioned ${success}; ${failed.length} failed (${failed.join(', ')}).`));
    else if (emailFailed) setError(text(`Đã tạo ${success} tài khoản; ${emailFailed} email gửi thất bại. Không cấp lại các tài khoản này.`, `Created ${success} accounts; ${emailFailed} emails failed. Do not provision them again.`));
    else setMessage(text(`Đã cấp và gửi email kích hoạt cho ${success} nhân viên.`, `Provisioned and emailed ${success} employees.`));
  }

  const hasFilters = Boolean(query) || department !== 'ALL' || timeFilter !== 'ALL';
  return <AppShell breadcrumb={[text('Quản lý người dùng', 'Users Management'), text('Cấp tài khoản nhân viên', 'Employee account provisioning')]}>
    <SectionHeader title={text('Cấp tài khoản nhân viên', 'Employee account provisioning')} description={text('Quản lý hồ sơ chưa có tài khoản và gửi lời mời kích hoạt an toàn.', 'Manage profiles without accounts and send secure activation invitations.')} />
    <section className="grid gap-4 md:grid-cols-3" aria-label={text('Thống kê cấp tài khoản', 'Provisioning statistics')}>
      <KpiCard icon={<AlertCircle className="size-5" />} tone="amber" label={text('Chờ cấp tài khoản', 'Awaiting accounts')} value={candidates.length.toLocaleString()} note={text('Chưa có tài khoản truy cập', 'No login account')} />
      <KpiCard icon={<UserRoundCheck className="size-5" />} tone="emerald" label={text('Đã cấp hôm nay', 'Provisioned today')} value={provisionedToday.toLocaleString()} note={text('Đã tạo tài khoản nhân viên', 'Employee accounts created')} />
      <KpiCard icon={<ShieldCheck className="size-5" />} tone="blue" label={text('Tỷ lệ phủ tài khoản', 'Account coverage')} value={`${coverage.toFixed(1)}%`} note={text(`${employeeAccounts.length}/${totalEmployees} nhân sự có tài khoản`, `${employeeAccounts.length}/${totalEmployees} employees covered`)} progress={coverage} />
    </section>

    <Card className="mt-5 overflow-visible p-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
        <label className="relative min-w-[260px] flex-1"><span className="sr-only">{text('Tìm kiếm nhân viên', 'Search employees')}</span><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input type="search" value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder={text('Tìm kiếm theo Họ tên, Mã nhân viên, Email...', 'Search by name, employee code, email...')} className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100" /></label>
        <select value={department} disabled={!hasDepartmentMetadata} title={!hasDepartmentMetadata ? text('API ứng viên chưa cung cấp phòng ban', 'Candidate API does not provide departments') : undefined} onChange={event => { setDepartment(event.target.value); setPage(1); }} className="h-10 min-w-44 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"><option value="ALL">{text('Tất cả phòng ban', 'All departments')}</option>{departments.map(name => <option key={name} value={name}>{name}</option>)}</select>
        <select value={timeFilter} disabled={!hasImportMetadata} title={!hasImportMetadata ? text('API ứng viên chưa cung cấp ngày nhập hồ sơ', 'Candidate API does not provide import dates') : undefined} onChange={event => { setTimeFilter(event.target.value as TimeFilter); setPage(1); }} className="h-10 min-w-48 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"><option value="ALL">{text('Tất cả thời gian', 'All time')}</option><option value="TODAY">{text('Hồ sơ mới nhập hôm nay', 'Imported today')}</option><option value="WEEK">{text('Tuần này', 'This week')}</option><option value="MONTH">{text('Tháng này', 'This month')}</option></select>
        <button type="button" title={text('Tải lại dữ liệu', 'Reload data')} aria-label={text('Tải lại dữ liệu', 'Reload data')} disabled={loading || bulkBusy || busyId !== null} onClick={() => void reload()} className="group grid size-10 place-items-center rounded-full border border-slate-300 bg-white text-slate-600 hover:border-orange-300 hover:text-orange-600 disabled:opacity-50"><RefreshCw className={`size-4 transition-transform duration-500 group-hover:rotate-180 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>
      {selected.size > 0 && <div className="flex flex-wrap items-center gap-2 border-b border-blue-100 bg-blue-50/70 px-4 py-2.5 text-sm text-blue-900"><CheckCircle2 className="size-4" /><span>{text(`Đã chọn ${selected.size} nhân sự.`, `${selected.size} employees selected.`)}</span>{selected.size < filtered.length && <button type="button" onClick={() => setSelected(new Set(filtered.map(item => item.id)))} className="font-semibold text-blue-700 hover:underline">{text(`Chọn toàn bộ ${filtered.length} nhân sự chờ cấp`, `Select all ${filtered.length} awaiting employees`)}</button>}</div>}
      {error && <p role="alert" className="m-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {message && <p role="status" className="m-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      <div aria-busy={loading}>{loading ? <p role="status" className="py-20 text-center text-sm text-slate-500">{text('Đang tải hồ sơ...', 'Loading profiles...')}</p> : loadError ? <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{loadError}</div> : !rows.length ? <EmptyState filtered={hasFilters} text={text} onAccounts={() => navigate('/users')} /> : <CandidateTable rows={rows} selected={selected} pageSelected={pageSelected} busyId={busyId} bulkBusy={bulkBusy} menuId={menuId} text={text} onTogglePage={togglePage} onToggle={toggleOne} onProvision={provisionOne} onMenu={setMenuId} />}</div>
      {!loading && !loadError && filtered.length > 0 && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3"><div className="flex flex-wrap items-center gap-2 text-sm text-slate-600"><span>{text('Hiển thị', 'Show')}</span><select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }} className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm">{[25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}</select><span>{text(`hồ sơ mỗi trang · Tổng cộng ${filtered.length} hồ sơ`, `per page · ${filtered.length} profiles total`)}</span></div><nav className="flex items-center gap-1" aria-label={text('Phân trang', 'Pagination')}><PageButton label={text('Đầu', 'First')} disabled={currentPage === 1} onClick={() => setPage(1)}><ChevronsLeft className="size-4" /></PageButton><PageButton label={text('Trước', 'Previous')} disabled={currentPage === 1} onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronLeft className="size-4" /></PageButton>{pageNumbers.map(number => <button key={number} type="button" onClick={() => setPage(number)} className={`grid size-8 place-items-center rounded-md text-sm font-medium ${number === currentPage ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{number}</button>)}<PageButton label={text('Tiếp', 'Next')} disabled={currentPage === totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))}><ChevronRight className="size-4" /></PageButton><PageButton label={text('Cuối', 'Last')} disabled={currentPage === totalPages} onClick={() => setPage(totalPages)}><ChevronsRight className="size-4" /></PageButton></nav></footer>}
    </Card>
    {selected.size > 0 && !bulkOpen && <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white shadow-2xl"><CheckCircle2 className="size-5 text-emerald-400" /><span className="whitespace-nowrap">{text(`Đã chọn ${selected.size} nhân sự`, `${selected.size} selected`)}</span><span className="h-5 w-px bg-slate-700" /><Button type="button" size="sm" disabled={bulkBusy} onClick={() => setBulkOpen(true)} className="bg-orange-500 text-white hover:bg-orange-600"><Zap className="size-4" />{text(`Cấp tài khoản hàng loạt (${selected.size})`, `Bulk provision (${selected.size})`)}</Button><button type="button" onClick={() => setSelected(new Set())} className="whitespace-nowrap text-xs text-slate-300 hover:text-white">{text('Bỏ chọn', 'Clear')}</button></div>}
    {bulkOpen && <BulkDialog rows={selectedRows} busy={bulkBusy} text={text} onClose={() => setBulkOpen(false)} onSubmit={() => void provisionBulk()} />}
  </AppShell>;
}

function CandidateTable({ rows, selected, pageSelected, busyId, bulkBusy, menuId, text, onTogglePage, onToggle, onProvision, onMenu }: { rows: EmployeeAccountCandidate[]; selected: Set<number>; pageSelected: boolean; busyId: number | null; bulkBusy: boolean; menuId: number | null; text: (vi: string, en: string) => string; onTogglePage: () => void; onToggle: (id: number) => void; onProvision: (candidate: EmployeeAccountCandidate) => void; onMenu: (id: number | null) => void }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><caption className="sr-only">{text('Hồ sơ chờ cấp tài khoản', 'Profiles awaiting accounts')}</caption><thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500"><tr><th className="w-12 px-4 py-3"><input type="checkbox" checked={pageSelected} onChange={onTogglePage} aria-label={text('Chọn tất cả trên trang', 'Select page')} className="size-4 accent-orange-500" /></th><th className="px-3 py-3">{text('Mã nhân viên', 'Employee code')}</th><th className="px-3 py-3">{text('Họ và tên & Phòng ban', 'Employee & department')}</th><th className="px-3 py-3">Email</th><th className="px-3 py-3">{text('Trạng thái hồ sơ', 'Profile status')}</th><th className="px-4 py-3 text-right">{text('Thao tác', 'Actions')}</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(candidate => <tr key={candidate.id} className={`hover:bg-slate-50/70 ${selected.has(candidate.id) ? 'bg-orange-50/30' : ''}`}><td className="px-4 py-3"><input type="checkbox" checked={selected.has(candidate.id)} onChange={() => onToggle(candidate.id)} aria-label={text(`Chọn ${candidate.fullName}`, `Select ${candidate.fullName}`)} className="size-4 accent-orange-500" /></td><td className="px-3 py-3"><span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">{candidate.employeeCode}</span></td><td className="px-3 py-3"><div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{initials(candidate.fullName)}</span><span><strong className="block text-sm font-semibold text-slate-900">{candidate.fullName}</strong><span className="block text-xs text-slate-500">{candidate.departmentName || text('Chưa cập nhật phòng ban', 'Department unavailable')}{candidate.positionName ? ` · ${candidate.positionName}` : ''}</span></span></div></td><td className="px-3 py-3"><div className="flex items-center gap-2"><span className="max-w-60 truncate font-mono text-xs text-slate-600">{candidate.email}</span><button type="button" title={text('Sao chép email', 'Copy email')} onClick={() => void navigator.clipboard?.writeText(candidate.email)} className="grid size-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100"><Clipboard className="size-3.5" /></button></div></td><td className="px-3 py-3"><span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"><span className="size-1.5 rounded-full bg-amber-400" />{text('Chưa có tài khoản', 'No account')}</span></td><td className="relative px-4 py-3 text-right"><div className="inline-flex gap-1"><Button type="button" size="sm" variant="outline" className="h-8 border-orange-200 bg-orange-50 px-3 text-xs text-orange-700 hover:bg-orange-500 hover:text-white" disabled={busyId !== null || bulkBusy} onClick={() => onProvision(candidate)}><KeyRound className="size-3.5" />{busyId === candidate.id ? text('Đang cấp...', 'Provisioning...') : text('Cấp tài khoản', 'Provision')}</Button><button type="button" aria-label={text('Thao tác khác', 'More actions')} onClick={() => onMenu(menuId === candidate.id ? null : candidate.id)} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><Ellipsis className="size-4" /></button></div>{menuId === candidate.id && <div className="absolute right-4 top-11 z-20 w-52 rounded-lg border border-slate-200 bg-white p-1.5 text-left text-xs shadow-xl"><button disabled className="block w-full rounded-md px-3 py-2 text-slate-400">{text('Xem hồ sơ chi tiết', 'View profile details')}</button><button disabled className="block w-full rounded-md px-3 py-2 text-slate-400">{text('Chỉnh sửa email nếu sai', 'Correct email')}</button></div>}</td></tr>)}</tbody></table></div>;
}

function EmptyState({ filtered, text, onAccounts }: { filtered: boolean; text: (vi: string, en: string) => string; onAccounts: () => void }) {
  return <div className="flex flex-col items-center px-6 py-20 text-center"><span className="grid size-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><UserRoundCheck className="size-8" /></span><h3 className="mt-4 text-lg font-semibold text-slate-900">{filtered ? text('Không tìm thấy hồ sơ phù hợp', 'No matching profiles') : text('Không có hồ sơ nào chờ cấp tài khoản', 'No profiles awaiting an account')}</h3><p className="mt-1 max-w-lg text-sm text-slate-500">{filtered ? text('Hãy điều chỉnh từ khóa hoặc bộ lọc.', 'Adjust the search or filters.') : text('Tất cả nhân viên trong hệ thống đều đã được cấp tài khoản truy cập.', 'All employees have a login account.')}</p>{!filtered && <Button type="button" variant="outline" className="mt-5" onClick={onAccounts}>{text('Xem danh sách Tài khoản hệ thống →', 'View system accounts →')}</Button>}</div>;
}

function BulkDialog({ rows, busy, text, onClose, onSubmit }: { rows: EmployeeAccountCandidate[]; busy: boolean; text: (vi: string, en: string) => string; onClose: () => void; onSubmit: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="bulk-title"><section className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><header className="flex items-start justify-between border-b p-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-orange-600">{text('Xác nhận hàng loạt', 'Bulk confirmation')}</p><h2 id="bulk-title" className="mt-1 text-xl font-semibold text-slate-950">{text(`Cấp tài khoản cho ${rows.length} nhân viên`, `Provision ${rows.length} accounts`)}</h2></div><button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X className="size-5" /></button></header><div className="overflow-y-auto p-5"><label className="text-sm font-semibold text-slate-700">{text('Thời hạn link kích hoạt', 'Activation link validity')}<select disabled className="mt-1 h-10 w-full rounded-lg border bg-slate-50 px-3 text-sm text-slate-600"><option>{text('7 ngày · Theo cấu hình hệ thống', '7 days · System policy')}</option></select></label><p className="mt-2 text-xs text-slate-500">{text('Backend hiện áp dụng thời hạn cố định.', 'The backend currently applies a fixed validity period.')}</p><div className="mt-5 rounded-xl border"><div className="border-b bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">{text('Email sẽ nhận lời mời kích hoạt', 'Invitation recipients')}</div><ul className="max-h-64 divide-y overflow-y-auto">{rows.map(item => <li key={item.id} className="flex items-center gap-2 px-3 py-2.5 text-sm"><Mail className="size-4 text-slate-400" /><span className="min-w-0 flex-1 truncate">{item.email}</span><span className="font-mono text-xs text-slate-400">{item.employeeCode}</span></li>)}</ul></div></div><footer className="flex justify-end gap-2 border-t bg-slate-50 px-5 py-4"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{text('Hủy', 'Cancel')}</Button><Button type="button" disabled={busy} onClick={onSubmit}><Zap className="size-4" />{busy ? text('Đang xử lý...', 'Processing...') : text(`Gửi email kích hoạt cho ${rows.length} nhân viên`, `Send invitations to ${rows.length} employees`)}</Button></footer></section></div>;
}

function KpiCard({ icon, tone, label, value, note, progress }: { icon: ReactNode; tone: 'amber' | 'emerald' | 'blue'; label: string; value: string; note: string; progress?: number }) {
  const styles = { amber: 'bg-amber-50 text-amber-700', emerald: 'bg-emerald-50 text-emerald-700', blue: 'bg-blue-50 text-blue-700' };
  const bars = { amber: 'from-amber-400 to-orange-500', emerald: 'from-emerald-400 to-teal-500', blue: 'from-blue-500 to-cyan-400' };
  return <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{value}</p></div><span className={`grid size-10 place-items-center rounded-xl ${styles[tone]}`}>{icon}</span></div>{progress != null && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full bg-gradient-to-r ${bars[tone]}`} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div>}<p className="mt-2 text-xs text-slate-500">{note}</p></article>;
}

function PageButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className="grid size-8 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-35">{children}</button>;
}
