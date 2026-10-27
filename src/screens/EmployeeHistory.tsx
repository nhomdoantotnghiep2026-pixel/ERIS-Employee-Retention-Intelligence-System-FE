import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import {
  getApiErrorMessage, listAllEmployeeEducation, listAllJobHistory,
  listAllEmployeeWorkExperiences, listEducationEmployees, type EmployeeEducation,
  type EmployeeJobHistory, type EmployeeWorkExperience,
} from '../services/api';

type EducationRecord = EmployeeEducation & { employeeCode: string; fullName: string };

export default function EmployeeHistory() {
  const { t } = useLanguage();
  const [education, setEducation] = useState<EducationRecord[]>([]);
  const [jobHistory, setJobHistory] = useState<EmployeeJobHistory[]>([]);
  const [workExperiences, setWorkExperiences] = useState<EmployeeWorkExperience[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: number; employeeCode: string; fullName: string }>>([]);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'education' | 'experience' | 'jobs'>('education');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    void Promise.all([
      listAllEmployeeEducation(controller.signal),
      listAllEmployeeWorkExperiences(controller.signal),
      listAllJobHistory(controller.signal),
      listEducationEmployees(controller.signal),
    ]).then(([educationResult, experienceResult, jobResult, employeeResult]) => {
      if (controller.signal.aborted) return;
      setEducation(educationResult.data);
      setWorkExperiences(experienceResult.data);
      setJobHistory(jobResult.data);
      setEmployees(employeeResult.data);
    }).catch(cause => {
      if (!controller.signal.aborted) setError(getApiErrorMessage(cause, 'Could not load employee history.'));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [reload]);

  const search = query.trim().toLocaleLowerCase();
  const visibleEducation = useMemo(() => education.filter(row =>
    (!filterEmployee || row.employeeId === Number(filterEmployee))
      && (!search || `${row.employeeCode} ${row.fullName} ${row.institution || ''} ${row.fieldOfStudy || ''}`
        .toLocaleLowerCase().includes(search))), [education, filterEmployee, search]);
  const visibleJobHistory = useMemo(() => jobHistory.filter(row =>
    (!filterEmployee || row.employeeId === Number(filterEmployee))
      && (!search || `${row.employeeCode || ''} ${row.employeeName || ''} ${row.departmentName || ''} ${row.positionName || ''} ${row.changeType}`
        .toLocaleLowerCase().includes(search))), [jobHistory, filterEmployee, search]);
  const visibleWorkExperiences = useMemo(() => workExperiences.filter(row =>
    (!filterEmployee || row.employeeId === Number(filterEmployee))
      && (!search || `${row.employeeCode || ''} ${row.fullName || ''} ${row.companyName} ${row.positionTitle}`
        .toLocaleLowerCase().includes(search))), [workExperiences, filterEmployee, search]);

  return <AppShell breadcrumb={['Workforce', 'Employee history']}>
    <SectionHeader title={t('Education and job history')} description={t('Review employee education and job history across the workforce.')}>
      <Button variant="secondary" disabled={loading} onClick={() => setReload(value => value + 1)}>{t('Reload')}</Button>
    </SectionHeader>
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{t(error)}</p>}
    <Card className="p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">{t('Employee')}
          <select className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" value={filterEmployee} onChange={event => setFilterEmployee(event.target.value)}>
            <option value="">{t('All employees')}</option>
            {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.employeeCode} · {employee.fullName}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">{t('Search')}
          <input type="search" className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" value={query} onChange={event => setQuery(event.target.value)} />
        </label>
      </div>
      <div className="my-4 flex flex-wrap gap-2" role="tablist" aria-label={t('Employee records')}>
        <Button type="button" size="sm" variant={tab === 'education' ? 'primary' : 'secondary'} role="tab" aria-selected={tab === 'education'} onClick={() => setTab('education')}>{t('Education')} ({visibleEducation.length})</Button>
        <Button type="button" size="sm" variant={tab === 'experience' ? 'primary' : 'secondary'} role="tab" aria-selected={tab === 'experience'} onClick={() => setTab('experience')}>{t('Work experience')} ({visibleWorkExperiences.length})</Button>
        <Button type="button" size="sm" variant={tab === 'jobs' ? 'primary' : 'secondary'} role="tab" aria-selected={tab === 'jobs'} onClick={() => setTab('jobs')}>{t('Job history')} ({visibleJobHistory.length})</Button>
      </div>
      {loading ? <p role="status" className="py-6 text-sm text-slate-500">{t('Loading employee history...')}</p>
        : tab === 'education' ? <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="bg-slate-50 text-slate-500"><tr>{['Employee', 'Employee code', 'Education level', 'Field of study', 'Institution', 'Graduation year'].map(label => <th key={label} className="p-3 font-medium">{t(label)}</th>)}</tr></thead>
          <tbody>{visibleEducation.map(row => <tr key={row.id} className="border-b border-slate-100">
            <td className="p-3"><Link className="font-medium text-orange-700 hover:underline" to={`/employees/${row.employeeId}`}>{row.fullName}</Link></td>
            <td className="p-3">{row.employeeCode}</td><td className="p-3">{row.educationLevel ?? '—'}</td>
            <td className="p-3">{row.fieldOfStudy || '—'}</td><td className="p-3">{row.institution || '—'}</td><td className="p-3">{row.graduationYear ?? '—'}</td>
          </tr>)}</tbody>
        </table>{!visibleEducation.length && <p className="py-8 text-center text-sm text-slate-500">{t('No education records found.')}</p>}</div>
          : tab === 'experience' ? <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr>{['Employee', 'Employee code', 'Company', 'Position title', 'Start date', 'End date'].map(label => <th key={label} className="p-3 font-medium">{t(label)}</th>)}</tr></thead>
            <tbody>{visibleWorkExperiences.map(row => <tr key={row.id} className="border-b border-slate-100">
              <td className="p-3"><Link className="font-medium text-orange-700 hover:underline" to={`/employees/${row.employeeId}`}>{row.fullName || '—'}</Link></td>
              <td className="p-3">{row.employeeCode || '—'}</td><td className="p-3">{row.companyName || '—'}</td>
              <td className="p-3">{row.positionTitle || '—'}</td><td className="p-3">{row.startDate}</td><td className="p-3">{row.endDate || t('Present')}</td>
            </tr>)}</tbody>
          </table>{!visibleWorkExperiences.length && <p className="py-8 text-center text-sm text-slate-500">{t('No active work experience records.')}</p>}</div>
          : <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr>{['Employee', 'Employee code', 'Department', 'Position', 'Change type', 'Start date', 'End date'].map(label => <th key={label} className="p-3 font-medium">{t(label)}</th>)}</tr></thead>
            <tbody>{visibleJobHistory.map(row => <tr key={row.id} className="border-b border-slate-100">
              <td className="p-3"><Link className="font-medium text-orange-700 hover:underline" to={`/employees/${row.employeeId}`}>{row.employeeName || '—'}</Link></td>
              <td className="p-3">{row.employeeCode || '—'}</td><td className="p-3">{row.departmentName || '—'}</td>
              <td className="p-3">{row.positionName || '—'}</td><td className="p-3">{t(row.changeType)}</td>
              <td className="p-3">{row.startDate}</td><td className="p-3">{row.endDate || t('Present')}</td>
            </tr>)}</tbody>
          </table>{!visibleJobHistory.length && <p className="py-8 text-center text-sm text-slate-500">{t('No job history records.')}</p>}</div>}
    </Card>
  </AppShell>;
}
