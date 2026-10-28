import { useEffect, useState, type FormEvent } from 'react';
import { BriefcaseBusiness, Building2, CalendarDays, GraduationCap, Pencil, Power, Trash2 } from 'lucide-react';
import { Button, Card } from './ui';
import { useLanguage } from '../context/LanguageContext';
import {
  createEmployeeEducation, createEmployeeWorkExperience, deactivateEmployeeEducation, deactivateEmployeeWorkExperience, getApiErrorMessage, getCurrentUser,
  listEmployeeEducation, listEmployeeJobHistory, listOwnEducation, listOwnJobHistory,
  listEmployeeWorkExperiences, searchEducationInstitutions, updateEmployeeEducation, type EducationInstitution,
  type EmployeeEducation, type EmployeeJobHistory, type EmployeeWorkExperience,
} from '../services/api';

type EducationDraft = {
  educationLevel: string;
  fieldOfStudy: string;
  graduationYear: string;
};

type WorkExperienceDraft = {
  companyName: string;
  positionTitle: string;
  startDate: string;
  endDate: string;
};

const emptyDraft: EducationDraft = { educationLevel: '2', fieldOfStudy: '', graduationYear: '' };
const emptyWorkExperienceDraft: WorkExperienceDraft = { companyName: '', positionTitle: '', startDate: '', endDate: '' };
const inputClass = 'mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100';
const sectionTitleClass = 'text-[20px] font-semibold leading-7 text-[#111827]';
const subsectionTitleClass = 'text-[16px] font-semibold leading-6 text-[#111827]';
const cardTitleClass = 'break-words text-[16px] font-semibold leading-6 text-[#111827] [overflow-wrap:anywhere]';
const metadataClass = 'text-[14px] font-normal leading-5 text-[#6B7280]';
const badgeClass = 'inline-flex min-h-8 items-center rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-[14px] font-medium leading-5 text-orange-700';
const historyCardClass = 'relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 pl-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md';
const subsectionIconClass = 'flex size-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600 ring-1 ring-orange-100';
const educationLevels: Record<number, string> = {
  1: 'College',
  2: 'Bachelor',
  3: 'Master',
  4: 'Doctorate',
};

export function EmployeeApiHistory({ employeeId, employeeEmail, dateOfBirth, own = false, editable = false, initialEducations = [], initialWorkExperiences = [] }: {
  employeeId?: number;
  employeeEmail?: string | null;
  dateOfBirth?: string | null;
  own?: boolean;
  editable?: boolean;
  initialEducations?: EmployeeEducation[];
  initialWorkExperiences?: EmployeeWorkExperience[];
}) {
  const { t } = useLanguage();
  const [education, setEducation] = useState<EmployeeEducation[]>(initialEducations);
  const [history, setHistory] = useState<EmployeeJobHistory[]>([]);
  const [workExperiences, setWorkExperiences] = useState<EmployeeWorkExperience[]>(initialWorkExperiences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [educationError, setEducationError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [workExperienceError, setWorkExperienceError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<EmployeeEducation | null>(null);
  const [showEducationForm, setShowEducationForm] = useState(false);
  const [showWorkExperienceForm, setShowWorkExperienceForm] = useState(false);
  const [draft, setDraft] = useState<EducationDraft>(emptyDraft);
  const [workExperienceDraft, setWorkExperienceDraft] = useState<WorkExperienceDraft>(emptyWorkExperienceDraft);
  const [institutionQuery, setInstitutionQuery] = useState('');
  const [selectedInstitution, setSelectedInstitution] = useState<EducationInstitution | null>(null);
  const [suggestions, setSuggestions] = useState<EducationInstitution[]>([]);
  const [searching, setSearching] = useState(false);
  const [educationPermission, setCanManageEducation] = useState(false);
  const canManageEducation = editable && !own && educationPermission;
  const [editPermissionError, setEditPermissionError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    setEducationError(''); setHistoryError(''); setWorkExperienceError('');
    setCanManageEducation(false); setEditPermissionError('');
    if (!own && (!Number.isSafeInteger(employeeId) || !employeeId || employeeId < 1)) {
      setEducation([]); setHistory([]); setWorkExperiences([]);
      setError('This employee has no valid server ID.');
      setLoading(false);
      return () => controller.abort();
    }
    const educationRequest = own ? listOwnEducation(controller.signal) : listEmployeeEducation(employeeId!, controller.signal);
    const historyRequest = own ? listOwnJobHistory(controller.signal) : listEmployeeJobHistory(employeeId!, controller.signal);
    const workExperienceRequest = own ? Promise.resolve({ data: initialWorkExperiences }) : listEmployeeWorkExperiences(employeeId!, controller.signal);
    if (editable && !own) {
      void getCurrentUser(controller.signal).then(actor => {
        if (controller.signal.aborted) return;
        const actorEmail = actor.email?.trim().toLowerCase();
        const targetEmail = employeeEmail?.trim().toLowerCase();
        if (!actorEmail || !targetEmail) {
          setEditPermissionError('Could not verify education editing permissions.');
          return;
        }
        setCanManageEducation(actorEmail !== targetEmail);
      }).catch(cause => {
        if (controller.signal.aborted) return;
        setEditPermissionError(getApiErrorMessage(cause, 'Could not verify education editing permissions.'));
      });
    }
    void Promise.allSettled([educationRequest, historyRequest, workExperienceRequest])
      .then(([educationResult, historyResult, workExperienceResult]) => {
        if (controller.signal.aborted) return;
        if (educationResult.status === 'fulfilled') setEducation(educationResult.value.data);
        else setEducationError(getApiErrorMessage(educationResult.reason, 'Could not load employee education.'));
        if (historyResult.status === 'fulfilled') setHistory(historyResult.value.data);
        else setHistoryError(getApiErrorMessage(historyResult.reason, 'Could not load employee job history.'));
        if (workExperienceResult.status === 'fulfilled') setWorkExperiences(workExperienceResult.value.data);
        else setWorkExperienceError(getApiErrorMessage(workExperienceResult.reason, 'Could not load employee work experience.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [employeeId, employeeEmail, own, revision, editable]);

  useEffect(() => {
    setShowEducationForm(false);
    setShowWorkExperienceForm(false);
    setEditing(null);
    setDraft(emptyDraft);
    setWorkExperienceDraft(emptyWorkExperienceDraft);
    setInstitutionQuery('');
    setSelectedInstitution(null);
    setSuggestions([]);
  }, [editable, employeeId]);

  useEffect(() => {
    const query = institutionQuery.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchEducationInstitutions(query, draft.educationLevel ? Number(draft.educationLevel) : undefined, controller.signal)
        .then(result => { if (!controller.signal.aborted) setSuggestions(result.data); })
        .catch(cause => { if (!controller.signal.aborted) setError(getApiErrorMessage(cause, 'Could not search institutions.')); })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [institutionQuery, draft.educationLevel]);

  function beginEdit(row?: EmployeeEducation) {
    if (!canManageEducation || saving) return;
    setEditing(row || null);
    setShowEducationForm(true);
    setDraft(row ? {
      educationLevel: String(row.educationLevel ?? 2),
      fieldOfStudy: row.fieldOfStudy || '',
      graduationYear: row.graduationYear == null ? '' : String(row.graduationYear),
    } : emptyDraft);
    setInstitutionQuery('');
    setSelectedInstitution(null);
    setSuggestions([]);
    setError('');
    setNotice('');
  }

  function closeEducationForm() {
    setShowEducationForm(false);
    setEditing(null);
    setDraft(emptyDraft);
    setInstitutionQuery('');
    setSelectedInstitution(null);
    setSuggestions([]);
    setError('');
  }

  async function saveEducation(event: FormEvent) {
    event.preventDefault();
    if (!canManageEducation || !employeeId || saving) return;
    if (!editing && !selectedInstitution) {
      setError('Select an institution from the search suggestions before saving.');
      return;
    }
    if (selectedInstitution && !/^(https:\/\/ror\.org\/[a-z0-9]{9}|vietmap:(?:auto|geocode):[A-Za-z0-9_-]{1,512})$/.test(selectedInstitution.id)) {
      setError('The selected institution reference is invalid. Search and select the institution again.');
      return;
    }
    if (draft.graduationYear) {
      const graduationYear = Number(draft.graduationYear);
      const currentYear = new Date().getFullYear();
      if (!Number.isInteger(graduationYear) || graduationYear < 1900 || graduationYear > currentYear) {
        setError('Graduation year must be an integer from 1900 to the current year.');
        return;
      }
      const birthYear = dateOfBirth?.slice(0, 10).match(/^(\d{4})-\d{2}-\d{2}$/)?.[1];
      if (birthYear && graduationYear < Number(birthYear) + 21) {
        setError(`Graduation year must be at least ${Number(birthYear) + 21} (minimum graduation age: 21 by year).`);
        return;
      }
    }
    setSaving(true); setError(''); setNotice('');
    const values = {
      educationLevel: Number(draft.educationLevel),
      fieldOfStudy: draft.fieldOfStudy.trim() || null,
      graduationYear: draft.graduationYear ? Number(draft.graduationYear) : null,
    };
    try {
      if (editing) {
        const changes: Parameters<typeof updateEmployeeEducation>[2] = {
          educationLevel: values.educationLevel,
          fieldOfStudy: values.fieldOfStudy,
          graduationYear: values.graduationYear,
          ...(selectedInstitution ? {
            institution: selectedInstitution.institution,
            institutionRefId: selectedInstitution.id,
          } : {}),
        };
        const result = await updateEmployeeEducation(employeeId, editing.id, changes);
        setNotice(result.warning || result.message);
      } else {
        const result = await createEmployeeEducation(employeeId, {
          ...values,
          institution: selectedInstitution!.institution,
          institutionRefId: selectedInstitution!.id,
        });
        setNotice(result.warning || result.message);
      }
      closeEducationForm();
      setRevision(value => value + 1);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not save education.'));
    } finally {
      setSaving(false);
    }
  }

  async function removeEducation(row: EmployeeEducation) {
    if (!canManageEducation || !employeeId || saving || !window.confirm(t('Deactivate this education record?'))) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await deactivateEmployeeEducation(employeeId, row.id);
      setNotice(result.message);
      setRevision(value => value + 1);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not deactivate education.'));
    } finally {
      setSaving(false);
    }
  }

  async function removeWorkExperience(row: EmployeeWorkExperience) {
    if (!canManageEducation || !employeeId || saving || !window.confirm(t('Remove this work experience from the active profile? The database record will be retained.'))) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await deactivateEmployeeWorkExperience(employeeId, row.id);
      setNotice(result.message);
      setRevision(value => value + 1);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not remove work experience.'));
    } finally {
      setSaving(false);
    }
  }

  function closeWorkExperienceForm() {
    setShowWorkExperienceForm(false);
    setWorkExperienceDraft(emptyWorkExperienceDraft);
    setError('');
  }

  async function saveWorkExperience(event: FormEvent) {
    event.preventDefault();
    if (!canManageEducation || !employeeId || saving) return;
    if (workExperienceDraft.endDate && workExperienceDraft.endDate < workExperienceDraft.startDate) {
      setError('End date cannot be before start date.');
      return;
    }
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await createEmployeeWorkExperience(employeeId, {
        companyName: workExperienceDraft.companyName.trim(),
        positionTitle: workExperienceDraft.positionTitle.trim(),
        startDate: workExperienceDraft.startDate,
        endDate: workExperienceDraft.endDate || null,
      });
      setNotice(result.message);
      closeWorkExperienceForm();
      setRevision(value => value + 1);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not save work experience.'));
    } finally {
      setSaving(false);
    }
  }

  return <Card className="mt-5 p-5 text-[#111827] sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><div className="mb-2 h-1 w-12 rounded-full bg-gradient-to-r from-orange-500 to-amber-400" /><h2 className={sectionTitleClass}>{t('Education and job history')}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{t('Qualifications, previous experience and internal role changes in one place.')}</p></div>
      {!loading && <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600"><span className="rounded-full bg-slate-100 px-3 py-1.5">{education.length} {t('Education')}</span>{!own && <span className="rounded-full bg-slate-100 px-3 py-1.5">{workExperiences.length} {t('Work experience')}</span>}<span className="rounded-full bg-slate-100 px-3 py-1.5">{history.length} {t('Job history')}</span></div>}
    </div>
    {loading && <p role="status" className="mt-4 text-sm font-medium text-slate-600">{t('Loading employee history...')}</p>}
    {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{t(error)}</p>}
    {editPermissionError && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">{t(editPermissionError)}</p>}
    {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">{t(notice)}</p>}
    {!loading && <>
      <div className={`mt-5 grid items-start gap-5 ${own ? '' : 'xl:grid-cols-2'}`}>
      <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={subsectionIconClass}>
              <GraduationCap size={19} aria-hidden="true" />
            </span>
            <h3 className={subsectionTitleClass}>{t('Education')}</h3>
          </div>
          {canManageEducation && !showEducationForm && <Button size="sm" className="text-sm shadow-[0_6px_18px_rgba(249,115,22,0.18)]" onClick={() => beginEdit()}>{t('Add education')}</Button>}
        </div>
        {educationError && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{t(educationError)}</p>}
        {educationError ? null : education.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-7 text-center text-sm text-slate-500">{t('No active education records.')}</p>
          : <div className="mt-4 space-y-4">{education.map(row => <article key={row.id} className={historyCardClass}>
            <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-orange-400 to-orange-600" aria-hidden="true" />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h4 className={cardTitleClass}>{row.institution || '—'}</h4>
                <div className={`${metadataClass} mt-2 flex flex-wrap items-center gap-x-4 gap-y-2`}>
                  <span className="break-words [overflow-wrap:anywhere]">{row.fieldOfStudy || '—'}</span>
                  <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />{row.graduationYear ?? '—'}</span>
                </div>
                <p className={`${badgeClass} mt-4`}>
                  {t('Education level')}&nbsp;·&nbsp;{row.educationLevel && educationLevels[row.educationLevel] ? t(educationLevels[row.educationLevel]) : '—'}
                </p>
              </div>
              {canManageEducation && <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-100 pt-4 sm:border-0 sm:pt-0">
                <Button size="sm" variant="secondary" className="gap-1.5 text-sm" disabled={saving} onClick={() => beginEdit(row)}><Pencil size={15} aria-hidden="true" />{t('Edit')}</Button>
                <Button size="sm" variant="secondary" className="gap-1.5 border-red-200 text-sm text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800" disabled={saving} onClick={() => void removeEducation(row)}><Power size={15} aria-hidden="true" />{t('Deactivate')}</Button>
              </div>}
            </div>
          </article>)}</div>}
      {canManageEducation && showEducationForm && <form onSubmit={event => void saveEducation(event)} className="mt-5 rounded-2xl border border-orange-100 bg-orange-50/40 p-4 sm:p-5">
        <h3 className="text-base font-bold text-slate-950">{t(editing ? 'Edit education' : 'Add education')}</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">{t('Education level')}
            <select required className={inputClass} value={draft.educationLevel} disabled={saving}
              onChange={event => setDraft(value => ({ ...value, educationLevel: event.target.value }))}>
              <option value="1">{t('College')}</option><option value="2">{t('Bachelor')}</option>
              <option value="3">{t('Master')}</option><option value="4">{t('Doctorate')}</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">{t('Field of study')}
            <input maxLength={150} className={inputClass} value={draft.fieldOfStudy} disabled={saving}
              onChange={event => setDraft(value => ({ ...value, fieldOfStudy: event.target.value }))} />
          </label>
          <label className="text-sm font-semibold text-slate-700">{t('Graduation year')}
            <input type="number" min={1900} max={new Date().getFullYear()} className={inputClass} value={draft.graduationYear} disabled={saving}
              onChange={event => setDraft(value => ({ ...value, graduationYear: event.target.value }))} />
          </label>
          <label className="text-sm font-semibold text-slate-700">{t('Search institution')}
            <input minLength={2} className={inputClass} value={selectedInstitution?.institution || institutionQuery} disabled={saving}
              placeholder={t('Enter at least 2 characters')}
              onChange={event => { setSelectedInstitution(null); setInstitutionQuery(event.target.value); }} />
            {searching && <span role="status" className="mt-1 block text-xs text-slate-500">{t('Searching institutions...')}</span>}
            {suggestions.length > 0 && <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200">
              {suggestions.map(item => <button key={item.id} type="button" className="block w-full border-b border-slate-100 p-3 text-left text-sm last:border-0 hover:bg-orange-50"
                onClick={() => { setSelectedInstitution(item); setInstitutionQuery(''); setSuggestions([]); }}>
                <span className="block text-sm font-semibold text-slate-900">{item.institution}</span>
                <span className="mt-1 block text-xs font-medium text-slate-600">{item.country || item.source}</span>
              </button>)}
            </div>}
            {editing && <span className="mt-1 block text-xs font-medium text-slate-600">{t('Leave the search empty to keep the current institution.')}</span>}
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <Button disabled={saving}>{t(saving ? 'Saving...' : 'Save education')}</Button>
          <Button type="button" variant="secondary" disabled={saving} onClick={closeEducationForm}>{t('Cancel')}</Button>
        </div>
      </form>}
      </section>

      {!own && <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={subsectionIconClass}>
              <Building2 size={18} aria-hidden="true" />
            </span>
            <h3 className={subsectionTitleClass}>{t('Work experience')}</h3>
          </div>
          {canManageEducation && !showWorkExperienceForm && <Button size="sm" className="text-sm shadow-[0_6px_18px_rgba(249,115,22,0.18)]" onClick={() => { setShowWorkExperienceForm(true); setError(''); setNotice(''); }}>{t('Add work experience')}</Button>}
        </div>
        {workExperienceError && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{t(workExperienceError)}</p>}
        {workExperienceError ? null : workExperiences.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-7 text-center text-sm text-slate-500">{t('No active work experience records.')}</p>
          : <div className="mt-4 space-y-4">{workExperiences.map(row => <article key={row.id} className={historyCardClass}>
            <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-orange-400 to-orange-600" aria-hidden="true" />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h4 className={cardTitleClass}>{row.companyName || '—'}</h4>
                <p className={`${metadataClass} mt-2 break-words [overflow-wrap:anywhere]`}>{row.positionTitle || '—'}</p>
                <p className={`${metadataClass} mt-2 inline-flex items-center gap-1.5`}><CalendarDays className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />{row.startDate} – {row.endDate || t('Present')}</p>
              </div>
              {canManageEducation && <div className="flex shrink-0 border-t border-slate-100 pt-4 sm:border-0 sm:pt-0">
                <Button size="sm" variant="secondary" className="gap-1.5 border-red-200 text-sm text-red-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800" disabled={saving} onClick={() => void removeWorkExperience(row)}><Trash2 size={15} aria-hidden="true" />{t('Remove')}</Button>
              </div>}
            </div>
          </article>)}</div>}
        {canManageEducation && showWorkExperienceForm && <form onSubmit={event => void saveWorkExperience(event)} className="mt-5 rounded-2xl border border-orange-100 bg-orange-50/40 p-4 sm:p-5">
          <h4 className="text-base font-bold text-slate-950">{t('Add work experience')}</h4>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">{t('Company')}
              <input required maxLength={150} className={inputClass} value={workExperienceDraft.companyName} disabled={saving}
                onChange={event => setWorkExperienceDraft(value => ({ ...value, companyName: event.target.value }))} />
            </label>
            <label className="text-sm font-semibold text-slate-700">{t('Position title')}
              <input required maxLength={150} className={inputClass} value={workExperienceDraft.positionTitle} disabled={saving}
                onChange={event => setWorkExperienceDraft(value => ({ ...value, positionTitle: event.target.value }))} />
            </label>
            <label className="text-sm font-semibold text-slate-700">{t('Start date')}
              <input required type="date" max={new Date().toISOString().slice(0, 10)} className={inputClass} value={workExperienceDraft.startDate} disabled={saving}
                onChange={event => setWorkExperienceDraft(value => ({ ...value, startDate: event.target.value }))} />
            </label>
            <label className="text-sm font-semibold text-slate-700">{t('End date')}
              <input type="date" min={workExperienceDraft.startDate || undefined} max={new Date().toISOString().slice(0, 10)} className={inputClass} value={workExperienceDraft.endDate} disabled={saving}
                onChange={event => setWorkExperienceDraft(value => ({ ...value, endDate: event.target.value }))} />
              <span className="mt-1 block text-xs font-medium text-slate-600">{t('Leave blank if this is the current job.')}</span>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={saving}>{t(saving ? 'Saving...' : 'Save work experience')}</Button>
            <Button type="button" variant="secondary" disabled={saving} onClick={closeWorkExperienceForm}>{t('Cancel')}</Button>
          </div>
        </form>}
      </section>}
      </div>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
        <div className="flex items-center gap-2.5">
          <span className={subsectionIconClass}>
            <BriefcaseBusiness size={18} aria-hidden="true" />
          </span>
          <h3 className={subsectionTitleClass}>{t('Job history')}</h3>
        </div>
        {historyError && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{t(historyError)}</p>}
        {historyError ? null : history.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-7 text-center text-sm text-slate-500">{t('No job history records.')}</p>
          : <div className="mt-4 grid gap-4 lg:grid-cols-2">{history.map(row => <article key={row.id} className={historyCardClass}>
            <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-orange-400 to-orange-600" aria-hidden="true" />
            <h4 className={cardTitleClass}>{row.positionName || '—'}</h4>
            <p className={`${metadataClass} mt-2 break-words [overflow-wrap:anywhere]`}>{row.departmentName || '—'}</p>
            <p className={`${metadataClass} mt-2 inline-flex items-center gap-1.5`}><CalendarDays className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />{row.startDate} – {row.endDate || t('Present')}</p>
          </article>)}</div>}
      </section>
    </>}
  </Card>;
}
