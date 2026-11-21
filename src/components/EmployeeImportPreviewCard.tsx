import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Select } from './ui';
import type { EmployeeImportPreviewRow, ImportInstitutionChoice } from '../services/api';

type Text = (vi: string, en: string) => string;
const names: Record<string, [string, string]> = {
  email: ['Email', 'Email'], phone: ['Số điện thoại', 'Phone'], departmentName: ['Phòng ban', 'Department'],
  positionName: ['Chức danh / Vị trí', 'Position'], dateOfBirth: ['Ngày sinh', 'Date of birth'], hireDate: ['Ngày vào làm', 'Hire date'],
  gender: ['Giới tính', 'Gender'], address: ['Địa chỉ', 'Address'], employmentType: ['Hình thức làm việc', 'Employment type'],
  currentSalary: ['Lương tháng (VND)', 'Monthly salary (VND)'], job_level: ['Cấp bậc', 'Job level'], jobLevel: ['Cấp bậc', 'Job level'],
  positionLevel: ['Cấp bậc', 'Job level'], shift_type: ['Ca làm việc', 'Shift'], shiftType: ['Ca làm việc', 'Shift'],
  departmentId: ['Mã phòng ban', 'Department ID'], positionId: ['Mã vị trí', 'Position ID'], educations: ['Học vấn', 'Education'],
};
function display(value: unknown, key: string, text: Text): string {
  if(value == null || value === '') return '—';
  if(typeof value === 'string' && ['dateOfBirth','hireDate'].includes(key) && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split('-').reverse().join('/');
  if(key === 'currentSalary' && Number.isFinite(Number(value))) return new Intl.NumberFormat('vi-VN').format(Number(value));
  if(key === 'gender') {
    if(value === 'MALE') return text('Nam','Male');
    if(value === 'FEMALE') return text('Nữ','Female');
    if(value === 'OTHER') return text('Khác','Other');
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
export default function EmployeeImportPreviewCard({row, choices, onChoose, text}: {
  row: EmployeeImportPreviewRow; choices: ImportInstitutionChoice[]; onChoose: (choice: ImportInstitutionChoice) => void; text: Text;
}) {
  const employee = row.employee ?? {email:row.email};
  const reviews = row.institutions ?? [];
  const selected = (index: number) => choices.find(c => c.row === row.row && c.educationIndex === index)?.institutionRefId ?? reviews.find(r => r.educationIndex === index)?.selectedId;
  const failed = row.status === 'FAILED';
  const needsReview = reviews.some(r => r.status === 'NOT_FOUND' || r.status === 'UNAVAILABLE' || (r.status === 'NEEDS_SELECTION' && !selected(r.educationIndex)));
  const tone = failed ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-white';
  const status = failed ? text('Lỗi định dạng','Data error') : needsReview ? text('Cần kiểm tra','Needs review') : text('Hợp lệ','Valid');
  const badge = failed ? 'bg-red-100 text-red-800' : needsReview ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800';
  const degrees: Record<string, unknown>[] = Array.isArray(employee.educations) ? employee.educations.map(value => value && typeof value === 'object' ? value as Record<string, unknown> : {institution:value}) : [];
  const count = Math.max(degrees.length, ...reviews.map(r => r.educationIndex + 1), 0);
  const field = row.issue?.field;
  const fields = Object.entries(employee).filter(([key,value]) => !['fullName','employeeCode','employee_code'].includes(key) && !(key === 'educations' && Array.isArray(value)));
  return <article aria-labelledby={`import-row-${row.row}`} className={`min-w-0 rounded-lg border p-4 ${tone}`}>
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{text('Dòng','Row')} {row.row}</span>
        <h3 id={`import-row-${row.row}`} className="break-words text-base font-semibold text-slate-950">{display(employee.fullName,'fullName',text) === '—' ? text('Chưa có họ tên','Name unavailable') : display(employee.fullName,'fullName',text)}</h3>
        {Boolean(employee.employee_code || employee.employeeCode) && <span className="break-all text-sm font-medium text-slate-600">{String(employee.employee_code || employee.employeeCode)}</span>}
      </div>
      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${badge}`}>
        {failed || needsReview ? <AlertTriangle size={14} aria-hidden="true"/> : <CheckCircle2 size={14} aria-hidden="true"/>}{status}
      </span>
    </header>
    <dl className="my-3 grid grid-cols-2 gap-x-4 gap-y-2 border-y border-slate-100 py-3 md:grid-cols-3">
      {fields.map(([key,value]) => <div key={key} className={`min-w-0 ${field === key ? 'rounded-md bg-red-100/70 p-1.5' : ''}`}>
        <dt className="text-xs text-slate-600">{names[key] ? text(...names[key]) : key}</dt>
        <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-800 [overflow-wrap:anywhere]">{display(value,key,text)}</dd>
      </div>)}
    </dl>
    {failed && <div role="note" className="mb-3 rounded-md border border-red-200 bg-red-50 p-2.5 text-sm leading-6 text-red-800">
      <p className="font-semibold">{text('Lỗi tại','Issue at')} {row.issue?.sheet && `${row.issue.sheet} · `}{row.issue?.cell || field || text(`dòng ${row.row}`,`row ${row.row}`)}{field && row.issue?.cell ? ` (${names[field] ? text(...names[field]) : field})` : ''}</p>
      <p className="break-words">{row.issue?.message || row.message || text('Kiểm tra lại dữ liệu dòng này.','Review this row.')}</p>
    </div>}
    <section aria-label={text('Thông tin bằng cấp & Đối chiếu danh mục','Education and directory matching')} className="space-y-2 rounded-md bg-slate-50 p-2.5">
      <h4 className="text-xs font-semibold text-slate-700">{text('Thông tin bằng cấp & Đối chiếu danh mục','Education and directory matching')}</h4>
      {Array.from({length:count},(_,index) => {
        const degree=degrees[index] ?? {}, review=reviews.find(r => r.educationIndex === index), id=selected(index);
        const labels=review?.candidates.map((candidate,i) => `${candidate.institution} · ${candidate.address || candidate.country || candidate.source} (${i+1})`) ?? [];
        const chosenIndex=review?.candidates.findIndex(candidate => candidate.id === id) ?? -1;
        return <div key={index} className="space-y-1.5 border-t border-slate-200 pt-2 first-of-type:border-t-0">
          <p className="break-words text-sm font-medium text-slate-800">{index+1}. {display(degree.educationLevel,'educationLevel',text)} · {String(review?.originalName ?? degree.institution ?? '—')}</p>
          <p className="break-words text-xs text-slate-600">{text('Chuyên ngành','Field of study')}: {display(degree.fieldOfStudy,'fieldOfStudy',text)} · {text('Năm tốt nghiệp','Graduation year')}: {display(degree.graduationYear,'graduationYear',text)}</p>
          {review?.status === 'NEEDS_SELECTION' && <Select value={chosenIndex < 0 ? '' : labels[chosenIndex]} options={labels} placeholder={text('Chọn trường phù hợp','Choose an institution')}
            ariaLabel={`${text('Trường cho dòng','Institution for row')} ${row.row}, ${text('bằng cấp','qualification')} ${index+1}`} className="w-full"
            onChange={label => {const candidate=review.candidates[labels.indexOf(label)];if(candidate)onChoose({row:row.row,educationIndex:index,institutionRefId:candidate.id});}}/>}
          {id ? <p className="flex items-start gap-1.5 text-sm text-emerald-800"><CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true"/><span>{text('Đã đối chiếu','Matched')}: {review?.candidates.find(c => c.id === id)?.institution}</span></p>
            : review ? <p className="flex items-start gap-1.5 text-sm text-amber-800"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true"/><span>{review.warning || text('Chọn trường phù hợp trước khi nhập hồ sơ.','Choose an institution before importing.')}</span></p>
            : <p className="text-xs text-slate-600">{text('Chưa đối chiếu danh mục.','Directory matching has not run.')}</p>}
        </div>;
      })}
      {count === 0 && <p className="text-sm text-slate-600">{text('Chưa đọc được thông tin bằng cấp hợp lệ từ dòng này.','No education records could be read from this row.')}</p>}
    </section>
  </article>;
}
