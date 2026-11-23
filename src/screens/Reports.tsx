import { useDeferredValue, useEffect, useMemo, useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { DropdownMenu } from 'radix-ui';
import { BarChart3, Building2, ChevronRight, Download, FileBarChart2, FilePlus2, FileText, MoreHorizontal, RefreshCw, Search, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { CreateReportDialog } from '../components/reports/CreateReportDialog';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { FilterMenu } from '../components/ui/filter-menu';
import { Input } from '../components/ui/input';
import { EmptyStatePanel } from '../components/ui/page-state';
import { useEmployees } from '../context/EmployeeContext';
import { useLanguage } from '../context/LanguageContext';
import { useRole } from '../context/RoleContext';
import { useAutoDismissState } from '../hooks/useAutoDismissState';
import { createReportRecord, filterReportRecords, reportCategoryCount, type CreateReportInput, type ReportCategory } from '../services/reportsCenter';
import { downloadTextFile, slugify, toCsv } from '../utils/demoActions';
import { loadReports, saveReports, type ReportRecord } from '../utils/reportStore';
import { recordAudit } from '../workflows/audit';
import { hasPermission } from '../utils/rbacAccess';

type Template = {
  id: string;
  icon: ComponentType<{ className?: string; size?: number }>;
  category: ReportCategory;
  name: { vi: string; en: string };
  description: { vi: string; en: string };
  tone: string;
};

const categories: Array<ReportCategory | 'All'> = ['All', 'Overview', 'Department', 'Employee', 'Factors', 'AI Model'];
const templates: Template[] = [
  { id: 'workforce-overview', icon: BarChart3, category: 'Overview', tone: 'border-blue-100 bg-blue-50 text-blue-700', name: { vi: 'Tổng hợp rủi ro nhân sự', en: 'Workforce risk summary' }, description: { vi: 'Tổng quan nhân sự đã được đánh giá và phân bố mức rủi ro hiện tại.', en: 'Current workforce evaluation coverage and risk distribution.' } },
  { id: 'department-comparison', icon: Building2, category: 'Department', tone: 'border-violet-100 bg-violet-50 text-violet-700', name: { vi: 'So sánh theo phòng ban', en: 'Department comparison' }, description: { vi: 'Đối chiếu quy mô, mức rủi ro và các phòng ban cần HR ưu tiên.', en: 'Compare headcount, risk levels, and departments needing HR attention.' } },
  { id: 'employee-review', icon: Users, category: 'Employee', tone: 'border-orange-100 bg-orange-50 text-orange-700', name: { vi: 'Danh sách nhân viên cần xem xét', en: 'Employee review list' }, description: { vi: 'Tạo danh sách nhân viên có kết quả cần HR kiểm tra thêm bối cảnh.', en: 'Create a list of employees whose results need additional HR context.' } },
];

const seededReportVietnamese: Record<string, string> = {
  'Workforce Risk Summary': 'Tổng hợp rủi ro nhân sự',
  'Organization-wide attrition risk overview with department breakdown and trend analysis.': 'Tổng quan rủi ro nghỉ việc toàn tổ chức, phân chia theo phòng ban và phân tích xu hướng.',
  'Department Risk Analysis': 'Phân tích rủi ro theo phòng ban',
  'Detailed risk analysis by department including contributing factors and employee distribution.': 'Phân tích chi tiết theo phòng ban, gồm các yếu tố liên quan và phân bố nhân viên.',
  'High-Risk Employee Review': 'Danh sách nhân viên cần HR xem xét',
  'List of employees with high predicted attrition risk and supporting analysis details.': 'Danh sách nhân viên có dự báo rủi ro cao cùng thông tin phân tích hỗ trợ.',
  'Attrition Factor Analysis': 'Phân tích yếu tố rủi ro nghỉ việc',
  'Analysis of the most significant factors contributing to predicted attrition across the workforce.': 'Phân tích các yếu tố nổi bật liên quan đến dự báo nghỉ việc trong toàn bộ nhân sự.',
  'Model Analysis Summary': 'Tổng hợp phân tích AI',
  'Technical summary of the AI model performance, evaluation metrics, and analysis quality.': 'Tổng hợp hiệu quả phân tích AI, chỉ số đánh giá và chất lượng kết quả.',
};

export default function Reports() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user } = useRole();
  const { employees } = useEmployees();
  const [rows, setRows] = useState<ReportRecord[]>(loadReports);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState<ReportCategory | 'All'>('All');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitial, setDialogInitial] = useState<Partial<CreateReportInput> | null>(null);
  const [feedback, setFeedback] = useAutoDismissState(4_500);
  const tr = (vi: string, en: string) => language === 'vi' ? vi : en;
  const reportText = (value: string) => language === 'vi' ? seededReportVietnamese[value] || value : value;
  const canGenerate = hasPermission(user.role, 'Generate & Export Reports');

  useEffect(() => saveReports(rows), [rows]);

  const visible = useMemo(() => filterReportRecords(rows, deferredQuery, category), [rows, deferredQuery, category]);
  const activeEmployees = employees.filter(employee => employee.status === 'Active');
  const evaluatedEmployees = activeEmployees.filter(employee => employee.lastAnalysis !== 'Not analyzed');
  const highRiskEmployees = evaluatedEmployees.filter(employee => employee.riskLevel === 'High');
  const coverage = activeEmployees.length ? Math.round(evaluatedEmployees.length / activeEmployees.length * 100) : 0;

  const categoryLabel = (value: ReportCategory | 'All') => ({
    All: tr('Tất cả loại', 'All categories'), Overview: tr('Tổng quan', 'Overview'), Department: tr('Phòng ban', 'Department'), Employee: tr('Nhân viên', 'Employee'), Factors: tr('Yếu tố', 'Factors'), 'AI Model': tr('Phân tích AI', 'AI analysis'),
  })[value];

  const createReport = (input: CreateReportInput) => {
    const report = createReportRecord(input);
    setRows(current => [report, ...current]);
    setCategory('All');
    setQuery('');
    setFeedback(tr(`Đã tạo báo cáo “${report.name}”.`, `Created “${report.name}”.`));
    recordAudit('REPORTS', report.id, 'Create report', null, report);
  };

  const openTemplate = (template: Template) => {
    setDialogInitial({ name: template.name[language], description: template.description[language], category: template.category });
    setDialogOpen(true);
  };
  const openBlankReport = () => { setDialogInitial(null); setDialogOpen(true); };

  const regenerate = (report: ReportRecord) => {
    const lastGenerated = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    setRows(current => current.map(item => item.id === report.id ? { ...item, lastGenerated } : item));
    setFeedback(tr(`Đã cập nhật “${report.name}”.`, `Refreshed “${report.name}”.`));
    recordAudit('REPORTS', report.id, 'Regenerate report', report, { ...report, lastGenerated });
  };

  const exportReport = (report: ReportRecord) => {
    downloadTextFile(`${slugify(report.name) || 'eris-report'}.csv`, toCsv([{ report: report.name, category: report.category, generated: report.lastGenerated, active_employees: activeEmployees.length, evaluated_employees: evaluatedEmployees.length, high_risk_employees: highRiskEmployees.length, evaluation_coverage_percent: coverage }]), 'text/csv;charset=utf-8');
    setFeedback(tr('Đã chuẩn bị file CSV.', 'CSV export is ready.'));
    recordAudit('REPORTS', report.id, 'Export report', null, { format: 'csv' });
  };

  const exportLibrary = () => {
    downloadTextFile('eris-report-library.csv', toCsv(rows.map(report => ({ report_name: report.name, category: report.category, last_generated: report.lastGenerated, owner: report.owner }))), 'text/csv;charset=utf-8');
    setFeedback(tr('Đã xuất danh mục báo cáo.', 'Report library exported.'));
  };

  return <AppShell breadcrumb={[tr('Báo cáo', 'Reports'), tr('Trung tâm báo cáo', 'Reports Center')]}>
    <div className="mx-auto w-full max-w-[1500px] space-y-5">
      <section aria-labelledby="reports-center-title" className="flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0"><div className="flex items-center gap-2 text-sm font-semibold text-orange-700"><FileBarChart2 size={17} aria-hidden="true" />{tr('Không gian dành cho HR', 'HR workspace')}</div><h1 id="reports-center-title" className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{tr('Trung tâm báo cáo', 'Reports Center')}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{tr('Tạo, tìm kiếm và xuất các ảnh chụp báo cáo phục vụ việc xem xét rủi ro và gắn kết nhân viên.', 'Create, find, and export report snapshots for workforce risk and engagement review.')}</p></div>
        {canGenerate && <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" className="h-11" onClick={exportLibrary} disabled={!rows.length}><Download aria-hidden="true" />{tr('Xuất danh mục CSV', 'Export library CSV')}</Button><Button type="button" className="h-11 bg-orange-600 text-white hover:bg-orange-700" onClick={openBlankReport}><FilePlus2 aria-hidden="true" />{tr('Tạo báo cáo', 'Create report')}</Button></div>}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
        { icon: FileText, label: tr('Báo cáo đã lưu', 'Saved reports'), value: rows.length, note: tr(`${reportCategoryCount(rows)} loại báo cáo`, `${reportCategoryCount(rows)} categories`), tone: 'border-blue-100 bg-blue-50 text-blue-700' },
        { icon: Users, label: tr('Nhân sự đang hoạt động', 'Active workforce'), value: activeEmployees.length, note: tr('Theo dữ liệu hiện tại', 'Current dataset'), tone: 'border-slate-200 bg-slate-100 text-slate-700' },
        { icon: ShieldCheck, label: tr('Độ phủ đánh giá', 'Evaluation coverage'), value: `${coverage}%`, note: tr(`${evaluatedEmployees.length}/${activeEmployees.length} nhân viên`, `${evaluatedEmployees.length}/${activeEmployees.length} employees`), tone: 'border-emerald-100 bg-emerald-50 text-emerald-700' },
        { icon: Sparkles, label: tr('Cần HR xem xét', 'Needs HR review'), value: highRiskEmployees.length, note: tr('Kết quả rủi ro cao', 'High-risk results'), tone: 'border-orange-100 bg-orange-50 text-orange-700' },
      ].map(metric => <Card key={metric.label} className="p-4"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium text-slate-600">{metric.label}</p><p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{metric.value}</p><p className="mt-1 text-xs font-medium text-slate-600">{metric.note}</p></div><span className={`grid size-11 place-items-center rounded-md border ${metric.tone}`}><metric.icon size={20} aria-hidden="true" /></span></div></Card>)}</div>

      {feedback && <div role="status" aria-live="polite" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{feedback}</div>}
      {!canGenerate && <div role="note" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">{tr('Bạn có quyền xem báo cáo nhưng chưa được cấp quyền tạo hoặc xuất dữ liệu.', 'You can view reports but do not have permission to create or export them.')}</div>}

      {canGenerate && <section aria-labelledby="report-templates-title"><div className="mb-3"><h2 id="report-templates-title" className="text-lg font-semibold text-slate-950">{tr('Mẫu báo cáo nhanh', 'Quick report templates')}</h2><p className="mt-1 text-sm text-slate-600">{tr('Chọn mẫu rồi điều chỉnh tên và phạm vi trước khi tạo.', 'Choose a template, then adjust its name and scope before creating it.')}</p></div><div className="grid gap-3 lg:grid-cols-3">{templates.map(template => { const Icon = template.icon; return <Card key={template.id} className="transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"><CardHeader><span className={`grid size-10 place-items-center rounded-md border ${template.tone}`}><Icon size={19} aria-hidden="true" /></span><CardTitle className="mt-3">{template.name[language]}</CardTitle><CardDescription>{template.description[language]}</CardDescription></CardHeader><CardContent className="mt-auto pt-4"><Button type="button" variant="outline" className="h-10" onClick={() => openTemplate(template)}>{tr('Dùng mẫu này', 'Use template')}<ChevronRight aria-hidden="true" /></Button></CardContent></Card>; })}</div></section>}

      <Card className="overflow-hidden"><CardHeader className="border-b border-slate-100 pb-4"><div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><CardTitle>{tr('Thư viện báo cáo', 'Report library')}</CardTitle><CardDescription>{tr('Mở báo cáo để xem chi tiết hoặc dùng menu phụ để cập nhật và xuất CSV.', 'Open a report for details, or use its secondary menu to refresh and export CSV.')}</CardDescription></div><span className="text-sm font-semibold text-slate-600">{tr(`${visible.length}/${rows.length} báo cáo`, `${visible.length}/${rows.length} reports`)}</span></div><div className="mt-4 grid gap-3 md:grid-cols-[minmax(260px,1fr)_230px]"><label className="relative block"><span className="sr-only">{tr('Tìm báo cáo', 'Search reports')}</span><Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder={tr('Tìm theo tên, mô tả hoặc người tạo', 'Search name, description, or owner')} className="h-11 pl-10" /></label><FilterMenu label={tr('Lọc loại báo cáo', 'Filter report category')} value={category} onChange={value => setCategory(value as ReportCategory | 'All')} className="h-11 w-full" options={categories.map(value => ({ value, label: categoryLabel(value) }))} /></div></CardHeader>
        <CardContent className="p-0">{visible.length ? <div className="divide-y divide-slate-100" role="list">{visible.map(report => <article key={report.id} role="listitem" className="grid gap-4 p-4 transition-colors hover:bg-slate-50/70 sm:p-5 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center"><span className="grid size-11 place-items-center rounded-md border border-orange-100 bg-orange-50 text-orange-700"><FileText size={20} aria-hidden="true" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-950">{reportText(report.name)}</h3><span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">{categoryLabel(report.category as ReportCategory)}</span></div><p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{reportText(report.description)}</p><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-600"><span>{tr('Tạo bởi', 'Owner')}: {report.owner}</span><span aria-hidden="true">•</span><span>{tr('Cập nhật', 'Updated')}: {report.lastGenerated}</span></div></div><div className="flex gap-2 lg:justify-end"><Button type="button" className="h-10 bg-orange-600 text-white hover:bg-orange-700" onClick={() => navigate(`/reports/${report.id}`, { state: { returnTo: '/reports' } })}>{tr('Xem báo cáo', 'View report')}<ChevronRight aria-hidden="true" /></Button>{canGenerate && <DropdownMenu.Root><DropdownMenu.Trigger asChild><Button type="button" variant="outline" size="icon" className="size-10" aria-label={tr(`Thao tác với ${report.name}`, `Actions for ${report.name}`)}><MoreHorizontal aria-hidden="true" /></Button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={6} className="z-[80] min-w-52 rounded-md border border-slate-200 bg-white p-1 shadow-lg"><DropdownMenu.Item onSelect={() => regenerate(report)} className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 text-sm text-slate-700 outline-none focus:bg-slate-100"><RefreshCw size={16} aria-hidden="true" />{tr('Tạo lại ảnh chụp', 'Refresh snapshot')}</DropdownMenu.Item><DropdownMenu.Item onSelect={() => exportReport(report)} className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 text-sm text-slate-700 outline-none focus:bg-slate-100"><Download size={16} aria-hidden="true" />{tr('Tải CSV', 'Download CSV')}</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>}</div></article>)}</div> : <div className="p-6"><EmptyStatePanel title={tr('Không có báo cáo phù hợp', 'No matching reports')} description={tr('Thử đổi từ khóa hoặc loại báo cáo. Bạn cũng có thể tạo một báo cáo mới.', 'Change the search or category, or create a new report.')} action={canGenerate ? <Button type="button" className="h-10 bg-orange-600 text-white hover:bg-orange-700" onClick={openBlankReport}><FilePlus2 aria-hidden="true" />{tr('Tạo báo cáo', 'Create report')}</Button> : undefined} /></div>}</CardContent>
      </Card>
    </div>
    {canGenerate && <CreateReportDialog open={dialogOpen} language={language} owner={user.name} initial={dialogInitial} onOpenChange={setDialogOpen} onCreate={createReport} />}
  </AppShell>;
}
