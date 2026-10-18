export interface WorkforceEmployee {
  id: string; employeeId: string; name: string; department: string; role: string; email: string; status: string;
  age: number; tenure: number; monthlyIncome: number; jobLevel: number; jobSatisfaction: number; environmentSatisfaction: number;
  educationLevel?: number; distanceFromHomeKm?: number; totalWorkingYears?: number; yearsInCurrentRole?: number; hireDate?: string;
  yearsSinceLastPromotion?: number; yearsWithCurrentManager?: number; overtimeHours?: number;
}
export interface ImportRow { employeeId: string; firstName: string; lastName: string; department: string; jobTitle: string; email?: string }
export interface References { departments: string[]; positions: string[] }
export interface Period { start: string; end: string; scope: string }
const key = (value: string) => value.trim().toLowerCase();
export function validateImport(rows: ImportRow[], employees: Pick<WorkforceEmployee, 'employeeId' | 'email'>[], refs: References) {
  const errors: string[] = [];
  const codes = new Set(employees.map(employee => key(employee.employeeId)));
  const emails = new Set(employees.map(employee => key(employee.email)).filter(Boolean));
  if (!rows.length) errors.push('The file must contain at least one employee.');
  rows.forEach((row, index) => {
    const label = `Row ${index + 2}`;
    for (const field of ['employeeId', 'firstName', 'lastName', 'department', 'jobTitle'] as const) {
      if (!row[field]?.trim()) errors.push(`${label}: ${field} is required.`);
    }
    const code = key(row.employeeId || ''), email = key(row.email || '');
    if (codes.has(code)) errors.push(`${label}: duplicate employee code ${row.employeeId}.`);
    codes.add(code);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push(`${label}: invalid email.`);
    if (email && emails.has(email)) errors.push(`${label}: duplicate email ${row.email}.`);
    if (email) emails.add(email);
    if (!refs.departments.includes(row.department.trim())) errors.push(`${label}: unknown department ${row.department}.`);
    if (!refs.positions.includes(row.jobTitle.trim())) errors.push(`${label}: unknown position ${row.jobTitle}.`);
  });
  return errors;
}

export const INPUT_FIELDS = [
  ['age', 'age', 18, 100], ['jobLevel', 'job_level', 1, 10], ['educationLevel', 'education_level', 1, 5],
  ['monthlyIncome', 'monthly_income', 0.01, Infinity], ['distanceFromHomeKm', 'distance_from_home_km', 0, Infinity],
  ['totalWorkingYears', 'total_working_years', 0, 82], ['tenure', 'years_at_company', 0, 82],
  ['yearsInCurrentRole', 'years_in_current_role', 0, 82], ['yearsSinceLastPromotion', 'years_since_last_promotion', 0, 82],
  ['yearsWithCurrentManager', 'years_with_current_manager', 0, 82], ['jobSatisfaction', 'job_satisfaction', 1, 5],
  ['environmentSatisfaction', 'environment_satisfaction', 1, 5], ['overtimeHours', 'overtime_hours', 0, 744],
] as const;
export type InputField = typeof INPUT_FIELDS[number][0];
export interface SnapshotIssue { employeeId: string; code: string; field: InputField | 'department' | 'role'; message: string }
export interface AIInput { id: string; employee_id: string; snapshot_date: string; department_id: string; position_id: string; [field: string]: string | number }
export interface Snapshot extends Period { id: string; created_at: string; source: string; inputs: AIInput[]; issues: SnapshotIssue[] }
function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function selected(employees: WorkforceEmployee[], period: Period) {
  return employees.filter(employee => employee.status === 'Active' && (!employee.hireDate || employee.hireDate <= period.end) && (!period.scope || employee.department === period.scope));
}
export function fingerprint(employees: WorkforceEmployee[], period: Period) {
  return JSON.stringify(selected(employees, period).map(employee => [employee.id, employee.department, employee.role, ...INPUT_FIELDS.map(([field]) => employee[field])]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}
export function snapshotIsCurrent(snapshot: Snapshot, employees: WorkforceEmployee[]) {
  return snapshot.source === fingerprint(employees, snapshot);
}
export function prepareSnapshot(employees: WorkforceEmployee[], period: Period): Snapshot {
  if (!validDate(period.start) || !validDate(period.end) || period.start > period.end) throw new Error('Select a valid period: start must be on or before end.');
  const scope = selected(employees, period);
  if (!scope.length) throw new Error('No active employees in this scope.');
  const id = crypto.randomUUID(), issues: SnapshotIssue[] = [];
  const inputs = scope.map(employee => {
    const department = departmentRecords.find(item => item.name === employee.department);
    const position = positionRecords.find(item => item.name === employee.role);
    if (!department) issues.push({ employeeId: employee.id, code: employee.employeeId, field: 'department', message: 'Unknown department reference.' });
    if (!position) issues.push({ employeeId: employee.id, code: employee.employeeId, field: 'role', message: 'Unknown position reference.' });
    const input: AIInput = { id: crypto.randomUUID(), employee_id: employee.id, snapshot_date: period.end, department_id: department?.id || '', position_id: position?.id || '' };
    for (const [field, column, min, max] of INPUT_FIELDS) {
      const value = employee[field];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || ['age','jobLevel','educationLevel'].includes(field) && !Number.isInteger(value)) issues.push({ employeeId: employee.id, code: employee.employeeId, field, message: `${field}: required ${['age','jobLevel','educationLevel'].includes(field) ? 'integer':'number'} from ${min}${Number.isFinite(max) ? ` to ${max}` : ''}.` });
      else input[column] = value;
    }
    if ((employee.totalWorkingYears ?? Infinity) < employee.tenure) issues.push({ employeeId: employee.id, code: employee.employeeId, field: 'totalWorkingYears', message: 'Total working years cannot be less than years at company.' });
    for (const field of ['yearsInCurrentRole', 'yearsSinceLastPromotion', 'yearsWithCurrentManager'] as const) {
      if ((employee[field] ?? 0) > employee.tenure) issues.push({ employeeId: employee.id, code: employee.employeeId, field, message: `${field} cannot exceed years at company.` });
    }
    return input;
  });
  return { ...period, id, created_at: new Date().toISOString(), source: fingerprint(employees, period), inputs, issues };
}
export interface ModelVersion {
  version: string; status: 'Draft' | 'Evaluated' | 'Active' | 'Retired';
  matrix?: { tp: number; fp: number; fn: number; tn: number };
  metrics?: { accuracy: number; precision: number; recall: number; f1: number };
  evaluated_at?: string;
}
export function evaluateModel(model: ModelVersion): ModelVersion {
  const matrix = model.matrix;
  if (!matrix || Object.values(matrix).some(value => !Number.isInteger(value) || value < 0) || !Object.values(matrix).reduce((a, b) => a + b, 0)) throw new Error('Valid labeled evaluation data is required.');
  const { tp, fp, fn, tn } = matrix;
  const precision = tp / (tp + fp || 1), recall = tp / (tp + fn || 1);
  return { ...model, status: model.status === 'Active' ? 'Active' : 'Evaluated', evaluated_at: new Date().toISOString(), metrics: { accuracy: (tp + tn) / (tp + fp + fn + tn), precision, recall, f1: 2 * precision * recall / (precision + recall || 1) } };
}
export function activateModel(models: ModelVersion[], version: string): ModelVersion[] {
  const target = models.find(model => model.version === version);
  if (!target?.metrics || !target.evaluated_at) throw new Error('Evaluate this model version before activation.');
  return models.map(model => ({ ...model, status: model.version === version ? 'Active' : model.status === 'Active' ? 'Retired' : model.status }));
}
export interface Explanation { feature_name: string; feature_value: number | string | boolean | null; impact_value: number; impact_direction: string; rank_order: number }
export interface Fixture { employeeId: string; probability: number; explanations: Explanation[] }
export interface Prediction {
  id: string; employee_id: string; snapshot_id: string; prediction_run_id: string;
  attrition_probability: number; risk_level: 'High' | 'Medium' | 'Low'; prediction_label: string; created_at: string;
  explanations: (Explanation & { prediction_result_id: string })[];
}
export interface ModelRun { id: string; name: string; period_start: string; period_end: string; model_version: string; status: 'Completed'; mode: 'demo-fixture'; total_employees: number; created_at: string; results: Prediction[] }
export function createDemoRun(snapshot: Snapshot, model: ModelVersion | null, employees: WorkforceEmployee[], fixtures: Fixture[]): ModelRun {
  if (snapshot.issues.length) throw new Error('A valid snapshot is required.');
  if (!snapshotIsCurrent(snapshot, employees)) throw new Error('Source data changed. Regenerate and review the snapshot.');
  if (!model || model.status !== 'Active') throw new Error('An active model is required.');
  const id = crypto.randomUUID(), created_at = new Date().toISOString();
  const results = snapshot.inputs.map(input => {
    const fixture = fixtures.find(item => item.employeeId === input.employee_id);
    if (!fixture || !Number.isFinite(fixture.probability) || fixture.probability < 0 || fixture.probability > 1 || !fixture.explanations.length) throw new Error('No prediction fixture for one or more employees. A real inference service is required for new employee data.');
    const resultId = crypto.randomUUID();
    return { id: resultId, employee_id: input.employee_id, snapshot_id: input.id, prediction_run_id: id, attrition_probability: fixture.probability, risk_level: (fixture.probability >= 0.65 ? 'High' : fixture.probability >= 0.35 ? 'Medium' : 'Low') as Prediction['risk_level'], prediction_label: 'Demo fixture — not new inference', created_at, explanations: fixture.explanations.map(explanation => ({ ...explanation, prediction_result_id: resultId })) };
  });
  return { id, name: `Demo ${snapshot.start} – ${snapshot.end}`, period_start: snapshot.start, period_end: snapshot.end, model_version: model.version, status: 'Completed', mode: 'demo-fixture', total_employees: results.length, created_at, results };
}
import { departmentRecords, positionRecords } from './references.ts';
