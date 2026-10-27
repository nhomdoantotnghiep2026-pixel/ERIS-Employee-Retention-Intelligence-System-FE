import { useEffect, useState } from 'react';
import { BriefcaseBusiness, GraduationCap, Plus, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from './ui';
import { getApiErrorMessage, searchEducationInstitutions, type EducationInstitution } from '../services/api';

export type CreateEducationDraft = {
  id: number;
  educationLevel: string;
  fieldOfStudy: string;
  graduationYear: string;
  institution: string;
  institutionRefId: string;
};

export type CreateExperienceDraft = {
  id: number;
  companyName: string;
  positionTitle: string;
  startDate: string;
  endDate: string;
};

const inputClass = 'mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100';
const labelClass = 'block text-sm font-semibold leading-5 text-slate-700';
const itemClass = 'rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5';
const sectionMotion = {
  hidden: { opacity: 0, y: 18, scale: 0.992 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 125, damping: 20, mass: 0.75 } },
};

function RequiredMark() {
  return <span aria-hidden="true" className="ml-1 font-semibold text-red-600">*</span>;
}

function EducationCard({ value, index, dateOfBirth, disabled, removable, text, onChange, onRemove }: {
  value: CreateEducationDraft;
  index: number;
  dateOfBirth: string;
  disabled: boolean;
  removable: boolean;
  text: (vi: string, en: string) => string;
  onChange: (value: CreateEducationDraft) => void;
  onRemove: () => void;
}) {
  const [suggestions, setSuggestions] = useState<EducationInstitution[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchError, setSearchError] = useState('');
  const query = value.institution.trim();
  const minimumGraduationYear = dateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)
    ? Number(dateOfBirth.slice(0, 4)) + 21
    : 1900;

  useEffect(() => {
    if (value.institutionRefId || query.length < 2) {
      setSuggestions([]); setSearching(false); setSearchError('');
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true); setSearchError('');
      void searchEducationInstitutions(query, Number(value.educationLevel), controller.signal)
        .then(result => { if (!controller.signal.aborted) { setSuggestions(result.data); setOpen(true); } })
        .catch(cause => { if (!controller.signal.aborted) setSearchError(getApiErrorMessage(cause, 'Could not search institutions.')); })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, value.educationLevel, value.institutionRefId]);

  return <motion.article layout="position" initial={{ opacity: 0, y: 12, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }}
    transition={{ type: 'spring', stiffness: 190, damping: 22 }} className={`${itemClass} transition-shadow duration-300 hover:shadow-md`}>
    <div className="mb-4 flex items-center justify-between gap-3">
      <h4 className="text-base font-semibold text-slate-900">{text(`Bằng cấp ${index + 1}`, `Education ${index + 1}`)}</h4>
      {removable && <button type="button" disabled={disabled} onClick={onRemove}
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-50">
        <Trash2 size={16} aria-hidden="true" />{text('Bỏ bằng cấp', 'Remove')}
      </button>}
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <label className={labelClass}>{text('Trình độ', 'Education level')}<RequiredMark />
        <select required className={inputClass} value={value.educationLevel} disabled={disabled}
          onChange={event => onChange({ ...value, educationLevel: event.target.value, institutionRefId: '' })}>
          <option value="1">{text('Cao đẳng', 'College')}</option>
          <option value="2">{text('Cử nhân', 'Bachelor')}</option>
          <option value="3">{text('Thạc sĩ', 'Master')}</option>
          <option value="4">{text('Tiến sĩ', 'Doctorate')}</option>
        </select>
      </label>
      <label className={labelClass}>{text('Năm tốt nghiệp', 'Graduation year')}
        <input type="number" min={minimumGraduationYear} max={new Date().getFullYear()} className={inputClass}
          value={value.graduationYear} disabled={disabled} placeholder={String(new Date().getFullYear())}
          onChange={event => onChange({ ...value, graduationYear: event.target.value })} />
        <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">
          {text(`Từ ${minimumGraduationYear} đến năm hiện tại.`, `From ${minimumGraduationYear} to the current year.`)}
        </span>
      </label>
      <label className={labelClass}>{text('Chuyên ngành', 'Field of study')}
        <input maxLength={150} className={inputClass} value={value.fieldOfStudy} disabled={disabled}
          placeholder={text('Ví dụ: Công nghệ thông tin', 'Example: Information technology')}
          onChange={event => onChange({ ...value, fieldOfStudy: event.target.value })} />
      </label>
      <label className={`${labelClass} relative`}>{text('Trường / cơ sở đào tạo', 'Institution')}<RequiredMark />
        <input required maxLength={150} autoComplete="off" className={inputClass} value={value.institution} disabled={disabled}
          aria-expanded={open} aria-controls={`institution-options-${value.id}`}
          placeholder={text('Gõ tên trường và chọn gợi ý', 'Type and select an institution')}
          onFocus={() => { if (suggestions.length) setOpen(true); }}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onChange={event => onChange({ ...value, institution: event.target.value, institutionRefId: '' })} />
        {open && (searching || suggestions.length > 0) && <div id={`institution-options-${value.id}`} role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          {searching && <p className="px-4 py-3 text-sm font-normal text-slate-500">{text('Đang tìm trường...', 'Searching institutions...')}</p>}
          {!searching && suggestions.map(item => <button type="button" role="option" key={item.id}
            className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-orange-50"
            onMouseDown={event => event.preventDefault()}
            onClick={() => { onChange({ ...value, institution: item.institution, institutionRefId: item.id }); setOpen(false); setSuggestions([]); }}>
            <span className="block text-sm font-semibold text-slate-900">{item.institution}</span>
            <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">{[item.address || item.display, item.country].filter(Boolean).join(' · ')}</span>
          </button>)}
        </div>}
        <span className={`mt-1.5 block text-xs font-normal leading-5 ${searchError ? 'text-red-700' : value.institutionRefId ? 'text-emerald-700' : 'text-slate-500'}`}>
          {searchError || (value.institutionRefId
            ? text('Đã chọn trường từ danh sách xác minh.', 'Verified institution selected.')
            : text('Bắt buộc chọn một trường trong danh sách gợi ý.', 'Select an institution from the suggestions.'))}
        </span>
      </label>
    </div>
  </motion.article>;
}

export function EmployeeCreateBackgroundFields({ educations, experiences, dateOfBirth, disabled, text, onEducationsChange, onExperiencesChange }: {
  educations: CreateEducationDraft[];
  experiences: CreateExperienceDraft[];
  dateOfBirth: string;
  disabled: boolean;
  text: (vi: string, en: string) => string;
  onEducationsChange: (value: CreateEducationDraft[]) => void;
  onExperiencesChange: (value: CreateExperienceDraft[]) => void;
}) {
  const nextId = (rows: Array<{ id: number }>) => Math.max(0, ...rows.map(row => row.id)) + 1;
  const maxMonth = new Date().toISOString().slice(0, 7);
  return <>
    <motion.section variants={sectionMotion} whileHover={{ y: -2 }} transition={{ duration: 0.22 }} className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-300 hover:shadow-[0_14px_38px_rgba(30,41,59,0.09)] sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600 ring-1 ring-orange-100"><GraduationCap size={20} aria-hidden="true" /></span>
          <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-600">04</p><h3 className="mt-1 text-lg font-semibold text-slate-950">{text('Học vấn', 'Education')}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{text('Thêm ít nhất một bằng cấp và chọn trường từ danh sách xác minh.', 'Add at least one qualification and select a verified institution.')}</p></div>
        </div>
        <Button type="button" size="sm" variant="secondary" disabled={disabled || educations.length >= 20}
          onClick={() => onEducationsChange([...educations, { id: nextId(educations), educationLevel: '2', fieldOfStudy: '', graduationYear: '', institution: '', institutionRefId: '' }])}>
          <Plus size={16} aria-hidden="true" />{text('Thêm bằng cấp', 'Add education')}
        </Button>
      </div>
      <div className="space-y-4"><AnimatePresence initial={false} mode="popLayout">{educations.map((value, index) => <EducationCard key={value.id} value={value} index={index} dateOfBirth={dateOfBirth}
        disabled={disabled} removable={educations.length > 1} text={text}
        onChange={next => onEducationsChange(educations.map(row => row.id === value.id ? next : row))}
        onRemove={() => onEducationsChange(educations.filter(row => row.id !== value.id))} />)}</AnimatePresence></div>
    </motion.section>

    <motion.section variants={sectionMotion} whileHover={{ y: -2 }} transition={{ duration: 0.22 }} className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-300 hover:shadow-[0_14px_38px_rgba(30,41,59,0.09)] sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600 ring-1 ring-orange-100"><BriefcaseBusiness size={20} aria-hidden="true" /></span>
          <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-600">05</p><h3 className="mt-1 text-lg font-semibold text-slate-950">{text('Kinh nghiệm làm việc', 'Work experience')}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{text('Khai báo công việc trước đây; có thể bỏ qua nếu chưa có kinh nghiệm.', 'Add previous roles, or leave this section empty.')}</p></div>
        </div>
        <Button type="button" size="sm" variant="secondary" disabled={disabled || experiences.length >= 50}
          onClick={() => onExperiencesChange([...experiences, { id: nextId(experiences), companyName: '', positionTitle: '', startDate: '', endDate: '' }])}>
          <Plus size={16} aria-hidden="true" />{text('Thêm kinh nghiệm', 'Add experience')}
        </Button>
      </div>
      {!experiences.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center text-sm text-slate-500">{text('Chưa có kinh nghiệm làm việc được khai báo.', 'No work experience has been added.')}</div>}
      <div className="space-y-4"><AnimatePresence initial={false} mode="popLayout">{experiences.map((value, index) => <motion.article layout="position" initial={{ opacity: 0, y: 12, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }} transition={{ type: 'spring', stiffness: 190, damping: 22 }} key={value.id} className={`${itemClass} transition-shadow duration-300 hover:shadow-md`}>
        <div className="mb-4 flex items-center justify-between gap-3"><h4 className="text-base font-semibold text-slate-900">{text(`Kinh nghiệm ${index + 1}`, `Experience ${index + 1}`)}</h4>
          <button type="button" disabled={disabled} onClick={() => onExperiencesChange(experiences.filter(row => row.id !== value.id))}
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-50"><Trash2 size={16} aria-hidden="true" />{text('Bỏ kinh nghiệm', 'Remove')}</button></div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className={labelClass}>{text('Tên công ty', 'Company name')}<RequiredMark /><input required maxLength={150} className={inputClass} value={value.companyName} disabled={disabled} onChange={event => onExperiencesChange(experiences.map(row => row.id === value.id ? { ...row, companyName: event.target.value } : row))} /></label>
          <label className={labelClass}>{text('Chức danh', 'Position title')}<RequiredMark /><input required maxLength={150} className={inputClass} value={value.positionTitle} disabled={disabled} onChange={event => onExperiencesChange(experiences.map(row => row.id === value.id ? { ...row, positionTitle: event.target.value } : row))} /></label>
          <label className={labelClass}>{text('Bắt đầu', 'Start month')}<RequiredMark /><input required type="month" max={maxMonth} className={inputClass} value={value.startDate} disabled={disabled} onChange={event => onExperiencesChange(experiences.map(row => row.id === value.id ? { ...row, startDate: event.target.value } : row))} /></label>
          <label className={labelClass}>{text('Kết thúc', 'End month')}<input type="month" min={value.startDate || undefined} max={maxMonth} className={inputClass} value={value.endDate} disabled={disabled} onChange={event => onExperiencesChange(experiences.map(row => row.id === value.id ? { ...row, endDate: event.target.value } : row))} /><span className="mt-1.5 block text-xs font-normal text-slate-500">{text('Để trống nếu vẫn đang làm việc.', 'Leave blank if this role is ongoing.')}</span></label>
        </div>
      </motion.article>)}</AnimatePresence></div>
    </motion.section>
  </>;
}
