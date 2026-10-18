import type { Employee } from '../data/mockData.ts';
import type { ErdDatabase, ErdRow } from './schema.ts';
export const DRAFT_KEY = 'eris-ai-input-form-drafts-v1';
export type InputDrafts = Record<string, Partial<Employee>>;
export function readInputDrafts(): InputDrafts { try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}'); } catch { return {}; } }
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
export function yearsBetween(start: unknown, end: string) {
  if (typeof start !== 'string' || !Number.isFinite(Date.parse(start)) || Date.parse(start) > Date.parse(end)) return undefined;
  return Math.round((Date.parse(end)-Date.parse(start))/86400000/365.2425*100)/100;
}
export function yearsCovered(intervals: { start:unknown;end:unknown }[], asOf:string) {
  const limit=Date.parse(asOf);
  const ranges=intervals.map(interval => [Date.parse(String(interval.start)),Math.min(Date.parse(String(interval.end || asOf)),limit)]).filter(([start,end]) => Number.isFinite(start) && Number.isFinite(end) && start <= end).sort((a,b) => a[0]-b[0]);
  const merged:number[][]=[];
  for (const range of ranges) { const previous=merged[merged.length-1]; if (previous && range[0] <= previous[1]) previous[1]=Math.max(previous[1],range[1]);else merged.push([...range]); }
  return Math.round(merged.reduce((sum,[start,end]) => sum+end-start,0)/86400000/365.2425*100)/100;
}
function ageOn(birth:unknown,asOf:string) {
  if (typeof birth !== 'string' || !Number.isFinite(Date.parse(birth)) || birth > asOf) return undefined;
  const [year,month,day]=birth.split('-').map(Number),[currentYear,currentMonth,currentDay]=asOf.split('-').map(Number);
  return currentYear-year-Number(currentMonth < month || currentMonth === month && currentDay < day);
}
export function employeeView(db: ErdDatabase, row: ErdRow, drafts: InputDrafts = {}, asOf = new Date().toISOString().slice(0,10)): Employee {
  const latestInput = db.ai_input.filter(input => input.employee_id === row.id && String(input.snapshot_date) <= asOf).sort((a,b) => String(b.snapshot_date).localeCompare(String(a.snapshot_date)))[0];
  const education = db.employee_educations.filter(item => item.employee_id === row.id).sort((a,b) => Number(b.education_level)-Number(a.education_level))[0];
  const jobs = db.employee_job_histories.filter(item => item.employee_id === row.id && String(item.start_date) <= asOf).sort((a,b) => String(b.start_date).localeCompare(String(a.start_date)));
  const responses = db.survey_responses.filter(item => item.employee_id === row.id && String(item.submitted_at).slice(0,10) <= asOf).sort((a,b) => String(b.submitted_at).localeCompare(String(a.submitted_at)));
  const score = (dimension: string) => {
    for (const response of responses) {
      const values = db.survey_answers.filter(answer => answer.response_id === response.id && db.survey_questions.some(question => question.id === answer.question_id && question.dimension_code === dimension)).map(answer => Number(answer.score));
      if (values.length) return values.reduce((a,b) => a+b,0)/values.length;
    }
    return undefined;
  };
  const experience = db.employee_work_experiences.filter(item => item.employee_id === row.id);
  const tenure = yearsBetween(row.hire_date,asOf);
  const workingYears=yearsCovered([...experience.map(item => ({ start:item.start_date,end:item.end_date })),...(row.hire_date ? [{ start:row.hire_date,end:asOf }]:[])],asOf);
  const draft = drafts[row.id] || {};
  const input = (column: string) => number(latestInput?.[column]);
  const predictions = db.prediction_results.filter(item => item.employee_id === row.id).sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)));
  const result = predictions[0];
  const position = db.positions.find(item => item.id === row.position_id);
  const ageYears = ageOn(row.date_of_birth,asOf);
  return {
    id:row.id, employeeId:String(row.employee_code), name:String(row.full_name), initials:String(row.full_name).split(/\s+/).filter(Boolean).map(part => part[0]).slice(0,2).join('').toUpperCase(),
    department:String(db.departments.find(item => item.id === row.department_id)?.name || ''), role:String(position?.name || ''), email:String(row.email || ''), status:row.employment_status === 'Active' ? 'Active' : 'Inactive',
    phone:String(row.phone || ''),dateOfBirth:String(row.date_of_birth || ''),gender:String(row.gender || ''),address:String(row.address || ''),hireDate:String(row.hire_date || ''),employmentType:String(row.employment_type || ''),
    age:ageYears === undefined ? (draft.age ?? input('age') ?? 0) : Math.floor(ageYears), tenure:tenure ?? draft.tenure ?? input('years_at_company') ?? 0,
    monthlyIncome:number(row.current_salary) ?? 0, jobLevel:number(position?.job_level) ?? 0,
    distanceFromHomeKm:number(row.distance_from_home_km) ?? draft.distanceFromHomeKm ?? input('distance_from_home_km'), educationLevel:number(education?.education_level) ?? draft.educationLevel ?? input('education_level'),
    totalWorkingYears:experience.length && tenure !== undefined ? workingYears : draft.totalWorkingYears ?? input('total_working_years'),
    yearsInCurrentRole:jobs[0] ? yearsBetween(jobs[0].start_date,asOf) : draft.yearsInCurrentRole ?? input('years_in_current_role'),
    yearsSinceLastPromotion:jobs.some(item => String(item.change_type).toLowerCase() === 'promotion') ? yearsBetween(jobs.find(item => String(item.change_type).toLowerCase() === 'promotion')!.start_date,asOf) : draft.yearsSinceLastPromotion ?? input('years_since_last_promotion'),
    yearsWithCurrentManager:jobs[0]?.manager_id ? yearsBetween(jobs[0].start_date,asOf) : draft.yearsWithCurrentManager ?? input('years_with_current_manager'),
    jobSatisfaction:score('job_satisfaction') ?? draft.jobSatisfaction ?? input('job_satisfaction') ?? 0,
    environmentSatisfaction:score('environment_satisfaction') ?? draft.environmentSatisfaction ?? input('environment_satisfaction') ?? 0,
    overtimeHours:draft.overtimeHours ?? input('overtime_hours'), overtime:(draft.overtimeHours ?? input('overtime_hours') ?? 0)>0,
    riskScore:result ? Math.round(Number(result.attrition_probability)*100) : 0, riskLevel:(result?.risk_level || 'Low') as Employee['riskLevel'], lastAnalysis:String(result?.created_at || 'Not analyzed'),
    businessTravel:'Not available in ERD',workLifeBalance:0,
  };
}
