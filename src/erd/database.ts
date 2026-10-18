import { ERD_SCHEMA, type ErdDatabase, type ErdRow, type TableName, type FieldValue } from './schema.ts';
import { departmentRecords, positionRecords, fixedId } from '../workflows/references.ts';
import { employees as seedEmployees } from '../data/mockData.ts';
import { importLegacyEmployees } from './legacyImport.ts';

export const ERD_STORAGE_KEY = 'eris-erd-database-v1';
export const ERD_EVENT = 'eris-erd-updated';
export const ROLE_NAMES = ['HR', 'Data / AI Analyst', 'System Administrator', 'Employee / ESS'];
type Column = { type: string; required: boolean; references?: TableName };
export function makeRow(table: TableName, values: Record<string, FieldValue>): ErdRow {
  for (const field of Object.keys(values)) if (!(field in ERD_SCHEMA[table])) throw new Error(`${table}.${field}: column is not in ERD.`);
  const now = new Date().toISOString();
  return Object.fromEntries(Object.keys(ERD_SCHEMA[table]).map(field => [field, values[field] ?? (field === 'id' ? crypto.randomUUID() : ['created_at','updated_at'].includes(field) ? now : null)])) as ErdRow;
}
export function createErdSeed(): ErdDatabase {
  const db = {} as ErdDatabase;
  for (const table of Object.keys(ERD_SCHEMA) as TableName[]) db[table] = [];
  db.role = ROLE_NAMES.map((name,index) => makeRow('role', { id: fixedId(3,index+1), name, description: name }));
  db.departments = departmentRecords.map(record => makeRow('departments', { ...record, status:'Active' }));
  db.positions = positionRecords.map(record => makeRow('positions', { ...record, job_level: seedEmployees.find(employee => employee.role === record.name)?.jobLevel || 1, status:'Active' }));
  db.employees = seedEmployees.map((employee,index) => makeRow('employees', {
    id: fixedId(4,index+1), employee_code: employee.employeeId, full_name: employee.name, email: employee.email,
    department_id: db.departments.find(row => row.name === employee.department)!.id,
    position_id: db.positions.find(row => row.name === employee.role)!.id,
    employment_status:employee.status, current_salary:employee.monthlyIncome,
  }));
  const emails = ['hr@eris.com','analyst@eris.com','admin@eris.com','employee@eris.com'];
  db.users = ROLE_NAMES.map((name,index) => makeRow('users', { id: fixedId(5,index+1), email:emails[index], role_id:db.role[index].id, status:'Active', employee_id:name === 'Employee / ESS' ? db.employees[0].id : null }));
  validateDatabase(db);
  return db;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateDatabase(db: ErdDatabase) {
  const expected = Object.keys(ERD_SCHEMA).sort();
  if (JSON.stringify(Object.keys(db).sort()) !== JSON.stringify(expected)) throw new Error('Database must contain exactly the 17 ERD entities.');
  for (const table of expected as TableName[]) {
    if (!Array.isArray(db[table])) throw new Error(`Invalid table ${table}.`);
    const columns = ERD_SCHEMA[table] as Record<string,Column>;
    const ids = new Set<string>();
    for (const row of db[table]) {
      if (ids.has(row.id)) throw new Error(`${table}: duplicate primary key.`); ids.add(row.id);
      for (const field of Object.keys(row)) if (!columns[field]) throw new Error(`${table}.${field}: column is not in ERD.`);
      for (const [field,column] of Object.entries(columns)) {
        const value = row[field];
        if (value === null || value === undefined) { if (column.required) throw new Error(`${table}.${field}: required.`); continue; }
        if (value === '' && column.required) throw new Error(`${table}.${field}: required.`);
        if (column.type === 'uuid' && (typeof value !== 'string' || !uuid.test(value))) throw new Error(`${table}.${field}: UUID required.`);
        if (['numeric','integer'].includes(column.type) && (typeof value !== 'number' || !Number.isFinite(value) || column.type === 'integer' && !Number.isInteger(value))) throw new Error(`${table}.${field}: valid number required.`);
        if (column.type === 'boolean' && typeof value !== 'boolean') throw new Error(`${table}.${field}: boolean required.`);
        if (['date','timestamptz'].includes(column.type) && (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || column.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(value).toISOString().slice(0,10) !== value))) throw new Error(`${table}.${field}: valid date required.`);
        if (column.type === 'text' && typeof value !== 'string') throw new Error(`${table}.${field}: text required.`);
        if (column.references && !db[column.references].some(parent => parent.id === value)) throw new Error(`${table}.${field}: foreign key ${column.references} not found.`);
      }
    }
  }
  for (const [table,field] of [['employees','employee_code'],['employees','email'],['users','email'],['role','name'],['departments','code'],['positions','code']] as const) {
    const values = db[table].map(row => String(row[field] || '').trim().toLowerCase()).filter(Boolean);
    if (new Set(values).size !== values.length) throw new Error(`${table}.${field}: duplicate value.`);
  }
  for (const table of ['employee_work_experiences','employee_job_histories','surveys'] as const) for (const row of db[table]) if (row.end_date && String(row.end_date) < String(row.start_date)) throw new Error(`${table}: end date precedes start date.`);
  for (const row of db.employee_job_histories) if (row.manager_id === row.employee_id) throw new Error('An employee cannot be their own manager.');
  for (const row of db.employees) for (const field of ['current_salary','distance_from_home_km']) if (typeof row[field] === 'number' && row[field] < 0) throw new Error(`employees.${field}: negative value.`);
  for (const row of db.ai_input) for (const field of ['monthly_income','overtime_hours','years_at_company']) if (Number(row[field]) < 0) throw new Error(`ai_input.${field}: negative value.`);
  for (const row of db.model_run) if (String(row.period_end) < String(row.period_start) || Number(row.total_employees) < 0) throw new Error('Invalid model run period or employee count.');
  for (const answer of db.survey_answers) {
    const response = db.survey_responses.find(row => row.id === answer.response_id)!;
    const question = db.survey_questions.find(row => row.id === answer.question_id)!;
    if (response.survey_id !== question.survey_id) throw new Error('Answer question and response must belong to the same survey.');
  }
  for (const [table,a,b] of [['survey_responses','survey_id','employee_id'],['survey_answers','response_id','question_id']] as const) {
    const pairs = db[table].map(row => `${row[a]}:${row[b]}`);
    if (new Set(pairs).size !== pairs.length) throw new Error(`${table}: duplicate pair.`);
  }
  for (const result of db.prediction_results) {
    if ((result.attrition_probability as number) < 0 || (result.attrition_probability as number) > 1) throw new Error('Invalid prediction probability.');
    if (db.ai_input.find(row => row.id === result.snapshot_id)?.employee_id !== result.employee_id) throw new Error('Prediction and input snapshot must belong to the same employee.');
  }
}
let cache: ErdDatabase | null = null;
export function readDatabase(): ErdDatabase {
  if (cache) return cache;
  const saved = sessionStorage.getItem(ERD_STORAGE_KEY);
  if (saved) { const parsed = JSON.parse(saved); validateDatabase(parsed); cache = parsed; }
  else {
    const seed=createErdSeed();
    const legacy=sessionStorage.getItem('eris-employees');
    if (legacy) {
      try {
        const migrated=structuredClone(seed);
        const result=importLegacyEmployees(migrated,JSON.parse(legacy),values => makeRow('employees',values));
        validateDatabase(migrated);
        for (const [key,field] of [['eris-retention-actions-v1','empId'],['eris-outcomes-v1','employee_id']] as const) {
          const records=JSON.parse(sessionStorage.getItem(key) || '[]');
          if (Array.isArray(records)) { sessionStorage.setItem(`${key}-before-erd`,JSON.stringify(records));sessionStorage.setItem(key,JSON.stringify(records.map(row => ({ ...row,[field]:result.ids[row[field]] || row[field] })))); }
        }
        sessionStorage.setItem('eris-ai-input-form-drafts-v1',JSON.stringify({ ...result.drafts,...JSON.parse(sessionStorage.getItem('eris-ai-input-form-drafts-v1') || '{}') }));
        sessionStorage.setItem('eris-erd-legacy-id-map-v1',JSON.stringify(result.ids));
        sessionStorage.setItem('eris-erd-migration-note',result.skipped ? `${result.skipped} legacy records could not be mapped; original storage is retained.`:'Legacy employee records mapped to ERD tables; original storage is retained.');
        cache=migrated;
      } catch { sessionStorage.setItem('eris-erd-migration-note','Legacy data was retained unchanged; automatic mapping was not possible.'); }
    }
    cache ||= seed;
    sessionStorage.setItem(ERD_STORAGE_KEY,JSON.stringify(cache));
  }
  return cache!;
}
export function transactDatabase(change: (draft: ErdDatabase) => void) {
  const draft = structuredClone(readDatabase());
  change(draft); validateDatabase(draft);
  sessionStorage.setItem(ERD_STORAGE_KEY,JSON.stringify(draft)); cache = draft;
  window.dispatchEvent(new Event(ERD_EVENT));
  return draft;
}
export function actorRow(email: string) { return readDatabase().users.find(row => row.email === email); }
