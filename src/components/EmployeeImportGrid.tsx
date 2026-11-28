import { useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Eye, Search, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { Button } from './ui/button';
import EmployeeImportPreviewCard from './EmployeeImportPreviewCard';
import type { EmployeeImportPreview, EmployeeImportPreviewRow, ImportInstitutionChoice } from '../services/api';

type Text = (vi: string, en: string) => string;
type Filter = 'all' | 'valid' | 'failed' | 'education';

function rowEducation(row: EmployeeImportPreviewRow) {
  const values = row.employee?.educations;
  return Array.isArray(values) ? values : [];
}

function institutionSelected(row: EmployeeImportPreviewRow, index: number, choices: ImportInstitutionChoice[]) {
  return choices.some(choice => choice.row === row.row && choice.educationIndex === index)
    || Boolean(row.institutions?.find(item => item.educationIndex === index)?.selectedId);
}

function needsSelection(row: EmployeeImportPreviewRow, choices: ImportInstitutionChoice[]) {
  return row.status !== 'FAILED' && Boolean(row.institutions?.some(item =>
    item.status === 'NEEDS_SELECTION' && !institutionSelected(row, item.educationIndex, choices)));
}

function hasEducation(row: EmployeeImportPreviewRow) {
  return rowEducation(row).length > 0 || Boolean(row.institutions?.length);
}

export function summarizeImport(preview: EmployeeImportPreview | null, choices: ImportInstitutionChoice[]) {
  const rows = preview?.results ?? [];
  return {
    ready: rows.filter(row => row.status !== 'FAILED' && !needsSelection(row, choices)).length,
    unresolved: rows.filter(row => needsSelection(row, choices)).length,
    education: rows.filter(hasEducation).length,
  };
}

function value(row: EmployeeImportPreviewRow, ...keys: string[]) {
  for (const key of keys) {
    const field = row.employee?.[key];
    if ((typeof field === 'string' && field.trim()) || typeof field === 'number') return String(field);
  }
  return '';
}

function issueMessage(row: EmployeeImportPreviewRow, text: Text) {
  const issue = row.issue;
  return [issue?.sheet, issue?.cell || issue?.column || issue?.field,
    issue?.message || row.message || text('Kiểm tra lại dữ liệu dòng này.', 'Review the data in this row.')].filter(Boolean).join(' · ');
}

function CellValue({ row, fields, children, text }: { row: EmployeeImportPreviewRow; fields: string[]; children: ReactNode; text: Text }) {
  const normalize = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');
  const issueFields = (row.issue?.field ?? '').split(/[^a-z0-9_]+/i).map(normalize).filter(Boolean);
  const invalid = row.status === 'FAILED' && fields.some(key => issueFields.includes(normalize(key)));
  if (!invalid) return <>{children}</>;
  const message = issueMessage(row, text);
  return <span tabIndex={0} title={message} aria-label={message} className="inline-flex max-w-full items-start gap-1 rounded border border-rose-400 bg-rose-50 px-2 py-1 text-rose-800">
    <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true"/><span className="min-w-0">{children}</span>
  </span>;
}

export function EmployeeImportGrid({ preview, choices, summary, uploading, text, onChoose, onChangeFile, onUpload }: {
  preview: EmployeeImportPreview; choices: ImportInstitutionChoice[]; summary: ReturnType<typeof summarizeImport>;
  uploading: boolean; text: Text; onChoose: (choice: ImportInstitutionChoice) => void;
  onChangeFile: () => void; onUpload: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [detail, setDetail] = useState<EmployeeImportPreviewRow | null>(null);
  const detailTrigger = useRef<HTMLButtonElement>(null);
  const searchKey = (input: string) => input.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');
  const needle = searchKey(query);
  const filtered = preview.results.filter(row => {
    if (filter === 'valid' && (row.status === 'FAILED' || needsSelection(row, choices))) return false;
    if (filter === 'failed' && row.status !== 'FAILED') return false;
    if (filter === 'education' && !hasEducation(row)) return false;
    return searchKey(value(row, 'fullName', 'full_name') + ' ' + value(row, 'employeeCode', 'employee_code')).includes(needle);
  });
  const lastPage = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, lastPage);
  const offset = (currentPage - 1) * pageSize;
  const rows = filtered.slice(offset, offset + pageSize);
  const filters: [Filter, string, number, string][] = [
    ['all', text('Tất cả', 'All'), preview.total, 'bg-slate-900 text-white'],
    ['valid', text('✓ Hợp lệ', '✓ Valid'), summary.ready, 'border-emerald-300 bg-emerald-50 text-emerald-900'],
    ['failed', text('Lỗi dữ liệu', 'Data errors'), preview.failed, preview.failed ? 'border-rose-700 bg-rose-700 text-white motion-safe:animate-pulse' : 'bg-slate-100 text-slate-700'],
    ['education', text('Có bằng cấp', 'With education'), summary.education, 'border-blue-300 bg-blue-50 text-blue-900'],
  ];
  const headings = [text('Dòng', 'Row'), text('Mã NV', 'Code'), text('Họ và tên', 'Full name'), text('Phòng ban & Vị trí', 'Department & position'), text('Liên hệ', 'Contact'), text('Học vấn / Bằng cấp', 'Education'), text('Lương & Hình thức', 'Salary & employment'), text('Trạng thái', 'Status'), text('Thao tác', 'Actions')];

  return <section aria-label={text('Bảng đối soát nhân viên', 'Employee validation grid')} className="rounded-xl border border-slate-200 bg-white shadow-sm">
    {!!preview.fileIssues?.length && <div role="alert" className="m-4 space-y-1 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
      <h3 className="font-semibold">{text('Cần kiểm tra cấu trúc tệp', 'Review workbook structure')}</h3>
      {preview.fileIssues.map((issue, index) => <p key={index}>{[issue.sheet, issue.cell || issue.field, issue.message].filter(Boolean).join(' · ')}</p>)}
    </div>}
    {preview.failed > 0 && <p className="m-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      {text(`Phát hiện ${preview.failed} dòng có lỗi dữ liệu trên tổng số ${preview.total} nhân sự. Có thể tạo ${summary.ready} hồ sơ hợp lệ.`, `Found ${preview.failed} invalid rows out of ${preview.total}. ${summary.ready} valid profiles can be created.`)}
    </p>}
    {summary.unresolved > 0 && <p className="m-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      {text(`Có ${summary.unresolved} dòng cần chọn trường. Mở chi tiết dòng để đối chiếu trước khi tạo hồ sơ.`, `${summary.unresolved} rows require institution selection. Open the row details to choose a match before creating profiles.`)}
    </p>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
      <div role="group" aria-label={text('Lọc theo tình trạng', 'Filter by status')} className="flex flex-wrap gap-2">
        {filters.map(([key, label, count, tone]) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => { setFilter(key); setPage(1); }}
          className={`rounded-md border border-transparent px-2.5 py-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-orange-600 ${tone} ${filter === key ? 'ring-2 ring-slate-700 ring-offset-1' : ''}`}>{label} ({count})</button>)}
      </div>
      <label className="flex w-full items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-orange-500 sm:w-auto">
        <Search size={16} className="text-slate-600" aria-hidden="true"/>
        <input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} aria-label={text('Tìm theo tên hoặc mã nhân viên', 'Search by employee name or code')} placeholder={text('Tìm theo tên hoặc mã…', 'Search by name or code…')} className="min-w-0 flex-1 bg-transparent outline-none"/>
      </label>
    </div>
    <div tabIndex={0} role="region" aria-label={text('Dữ liệu nhân viên', 'Employee data')} className="max-h-[60vh] overflow-auto focus-visible:outline-2 focus-visible:outline-orange-600">
      <table className="w-full min-w-[1120px] text-left text-sm">
        <thead className="sticky top-0 z-10 bg-slate-100 text-xs font-semibold text-slate-700"><tr>{headings.map(label => <th scope="col" className="px-3 py-3" key={label}>{label}</th>)}</tr></thead>
        <tbody>{rows.map(row => <PreviewRow key={row.row} row={row} choices={choices} text={text} disabled={uploading} onDetails={trigger => { detailTrigger.current = trigger; setDetail(row); }}/>)}</tbody>
      </table>
      {rows.length === 0 && <p className="p-6 text-center text-sm text-slate-600">{text('Không có dòng phù hợp.', 'No matching rows.')}</p>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4 text-sm text-slate-700">
      <span>{text(`Hiển thị ${rows.length ? offset + 1 : 0}–${offset + rows.length} trên ${filtered.length} nhân sự`, `Showing ${rows.length ? offset + 1 : 0}–${offset + rows.length} of ${filtered.length} employees`)}</span>
      <div className="flex items-center gap-2">
        <select aria-label={text('Số dòng mỗi trang', 'Rows per page')} value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }} className="rounded-md border border-slate-300 bg-white p-2">
          {[25, 50, 100].map(size => <option key={size} value={size}>{size} {text('dòng / trang', 'rows / page')}</option>)}
        </select>
        <Button type="button" variant="outline" size="icon" disabled={currentPage === 1} aria-label={text('Trang trước', 'Previous page')} onClick={() => setPage(currentPage - 1)}><ChevronLeft/></Button>
        <span>{currentPage}/{lastPage}</span>
        <Button type="button" variant="outline" size="icon" disabled={currentPage === lastPage} aria-label={text('Trang sau', 'Next page')} onClick={() => setPage(currentPage + 1)}><ChevronRight/></Button>
      </div>
    </div>
    <footer className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-2 rounded-b-xl border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
      <p role="status" className="flex items-center gap-2 text-sm font-medium text-slate-700"><Check size={16} className="shrink-0 text-emerald-700" aria-hidden="true"/>
        {text(`Hợp lệ: ${summary.ready}/${preview.total} hồ sơ · ${preview.failed} dòng lỗi`, `Valid: ${summary.ready}/${preview.total} profiles · ${preview.failed} invalid rows`)}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={uploading} onClick={onChangeFile}>{text('Đổi tệp khác', 'Choose another file')}</Button>
        <Button type="button" disabled={uploading || !summary.ready || !!summary.unresolved || !!preview.fileIssues?.length} onClick={onUpload} className="h-auto min-h-9 whitespace-normal bg-linear-to-r from-orange-700 to-amber-700 px-5 text-white hover:from-orange-800 hover:to-amber-800">
          {uploading ? text('Đang tạo hồ sơ…', 'Creating profiles…') : text(`Tải lên và tạo ${summary.ready} nhân viên`, `Upload and create ${summary.ready} employees`)}
        </Button>
      </div>
    </footer>
    <Dialog.Root open={detail !== null} onOpenChange={open => { if (!open) setDetail(null); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-slate-950/50"/>
        <Dialog.Content onCloseAutoFocus={event => { event.preventDefault(); detailTrigger.current?.focus(); }} className="fixed inset-y-0 right-0 z-[91] flex w-full max-w-xl animate-in flex-col bg-white shadow-2xl motion-safe:slide-in-from-right duration-200">
          <header className="flex shrink-0 items-center justify-between border-b border-slate-200 p-4">
            <Dialog.Title className="font-semibold text-slate-900">{text('Chi tiết dòng Excel', 'Excel row details')} {detail?.row}</Dialog.Title>
            <Dialog.Close asChild><Button type="button" variant="ghost" size="icon" aria-label={text('Đóng chi tiết', 'Close details')}><X/></Button></Dialog.Close>
          </header>
          <Dialog.Description className="sr-only">{text('Thông tin hồ sơ và đối chiếu trường học.', 'Profile fields and institution matching.')}</Dialog.Description>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{detail && <EmployeeImportPreviewCard row={detail} choices={choices} onChoose={onChoose} text={text}/>}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </section>;
}

function PreviewRow({ row, choices, text, disabled, onDetails }: {
  row: EmployeeImportPreviewRow; choices: ImportInstitutionChoice[]; text: Text; disabled: boolean; onDetails: (trigger: HTMLButtonElement) => void;
}) {
  const failed = row.status === 'FAILED';
  const waiting = needsSelection(row, choices);
  const institutions = row.institutions ?? [];
  const degrees = rowEducation(row);
  const degree = degrees[0];
  const details = degree && typeof degree === 'object' ? degree as Record<string, unknown> : {};
  const educationName = [details.educationLevel, institutions[0]?.originalName || details.institution || (typeof degree === 'string' ? degree : '')].filter(Boolean).join(' · ');
  const matched = institutions.length > 0 && institutions.length >= degrees.length && institutions.every(item =>
    item.status === 'MATCHED' || institutionSelected(row, item.educationIndex, choices));
  const amount = value(row, 'currentSalary', 'current_salary');
  const salary = amount && Number.isFinite(Number(amount)) ? new Intl.NumberFormat('vi-VN').format(Number(amount)) + ' đ' : amount;
  const gender = value(row, 'gender');
  const sex = gender === 'MALE' ? text('Nam', 'Male') : gender === 'FEMALE' ? text('Nữ', 'Female') : gender === 'OTHER' ? text('Khác', 'Other') : gender;
  const type = value(row, 'employmentType', 'employment_type');
  const employment = type === 'FULL_TIME' ? text('Toàn thời gian', 'Full-time') : type === 'PART_TIME' ? text('Bán thời gian', 'Part-time') : type;
  const cell = 'px-3 py-3 align-top [overflow-wrap:anywhere]';
  const wrap = (fields: string[], content: ReactNode) => <CellValue row={row} fields={fields} text={text}>{content}</CellValue>;
  return <tr className="border-t border-slate-100 even:bg-slate-50/60">
    <td className={cell + ' font-mono text-slate-600'}>{row.row}</td>
    <td className={cell}>{wrap(['employeeCode'], <code className="rounded bg-slate-100 px-2 py-0.5 font-semibold">{value(row, 'employeeCode', 'employee_code') || '—'}</code>)}</td>
    <td className={cell}>{wrap(['fullName'], <strong>{value(row, 'fullName', 'full_name') || '—'}</strong>)}{sex && <div className="mt-1 text-xs text-slate-600">{wrap(['gender'], sex)}</div>}</td>
    <td className={cell}>{wrap(['department', 'departmentId', 'departmentName'], value(row, 'departmentName', 'department', 'department_name') || '—')}<div className="mt-1 text-xs text-slate-600">{wrap(['position', 'positionId', 'positionName', 'jobTitle'], value(row, 'positionName', 'position', 'position_name', 'jobTitle') || '—')}</div></td>
    <td className={cell + ' max-w-40 text-xs'}>{wrap(['email'], value(row, 'email') || row.email || '—')}<div className="mt-1 text-slate-600">{wrap(['phone', 'phoneNumber'], value(row, 'phone', 'phone_number', 'phoneNumber') || '—')}</div></td>
    <td className={cell + ' max-w-48'}>{wrap(['education', 'educations', 'institution', 'educationLevel', 'fieldOfStudy', 'graduationYear'], educationName || '—')}
      {hasEducation(row) && <span className={`mt-1 block w-fit rounded px-1.5 py-0.5 text-xs font-medium ${matched ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{matched ? text('✓ Đã khớp danh mục', '✓ Directory match') : text('Cần rà soát', 'Review needed')}{Math.max(degrees.length, institutions.length) > 1 && ` · ${Math.max(degrees.length, institutions.length)} ${text('bằng cấp', 'records')}`}</span>}
    </td>
    <td className={cell}>{wrap(['currentSalary', 'salary'], <strong>{salary || '—'}</strong>)}<div className="mt-1 text-xs text-slate-600">{wrap(['employmentType'], employment || '—')}</div></td>
    <td className={cell}><span tabIndex={failed ? 0 : undefined} title={failed ? issueMessage(row, text) : undefined} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${failed ? 'border border-rose-300 bg-rose-50 text-rose-800' : waiting ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-800'}`}>
      {failed || waiting ? <AlertTriangle size={13} aria-hidden="true"/> : <Check size={13} aria-hidden="true"/>}{failed ? text('Lỗi dữ liệu', 'Data error') : waiting ? text('Cần chọn trường', 'Select institution') : text('Hợp lệ', 'Valid')}
    </span></td>
    <td className={cell}><Button type="button" variant="ghost" size="icon" disabled={disabled} onClick={event => onDetails(event.currentTarget)} aria-label={text(`Xem chi tiết dòng ${row.row}`, `View row ${row.row} details`)}><Eye/></Button></td>
  </tr>;
}
