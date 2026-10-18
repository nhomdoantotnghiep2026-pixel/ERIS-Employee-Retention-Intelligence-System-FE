import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Employee } from '../data/mockData';
import { validateImport, INPUT_FIELDS } from '../workflows/domain';
import { employeeReferences } from '../workflows/references';
import { recordAudit } from '../workflows/audit';
import { makeRow, readDatabase, transactDatabase } from '../erd/database';
import { employeeView, readInputDrafts, DRAFT_KEY, type InputDrafts } from '../erd/employeeView';
import { useErd } from '../erd/useErd';

export interface EmployeeInput { firstName: string; lastName: string; employeeId: string; department: string; jobTitle: string; email?: string }
type BulkChanges = Partial<Pick<Employee, 'department' | 'role' | 'status'>>;
interface Value {
  employees: Employee[];
  addEmployee: (input: EmployeeInput) => Employee | null;
  importEmployees: (rows: EmployeeInput[]) => { created:number; skipped:number };
  bulkUpdate: (ids: string[], changes: BulkChanges) => number;
  updateEmployee: (id: string, changes: Partial<Employee>) => string | null;
  archiveEmployee: (id: string) => void;
}
const Context = createContext<Value | null>(null);
export function EmployeeProvider({ children }: { children: ReactNode }) {
  const db = useErd();
  const [drafts,setDrafts] = useState<InputDrafts>(readInputDrafts);
  const employees = useMemo(() => db.employees.map(row => employeeView(db,row,drafts)),[db,drafts]);
  const saveDraft = (id: string, changes: Partial<Employee>) => {
    const values = Object.fromEntries(INPUT_FIELDS.filter(([field]) => field in changes).map(([field]) => [field,changes[field]]));
    const next = { ...drafts,[id]:{ ...drafts[id],...values } }; sessionStorage.setItem(DRAFT_KEY,JSON.stringify(next)); setDrafts(next);
  };
  const importEmployees = (rows: EmployeeInput[]) => {
    if (validateImport(rows,employees,employeeReferences).length) return { created:0,skipped:rows.length };
    const created = rows.map(input => makeRow('employees',{ employee_code:input.employeeId.trim(), full_name:`${input.firstName.trim()} ${input.lastName.trim()}`, email:input.email?.trim() || null, department_id:db.departments.find(row => row.name === input.department)!.id, position_id:db.positions.find(row => row.name === input.jobTitle)!.id,employment_status:'Active' }));
    transactDatabase(draft => { draft.employees.push(...created); });
    for (const row of created) recordAudit('EMPLOYEES',row.id,'Create employee',null,row);
    return { created:created.length, skipped:0 };
  };
  const addEmployee = (input: EmployeeInput) => {
    const result = importEmployees([input]);
    if (!result.created) return null;
    // Return a view of the transaction committed synchronously to the canonical store.
    const row = readDatabase().employees.find(row => row.employee_code === input.employeeId.trim())!;
    return employeeView({ ...db,employees:[...db.employees,row] },row,drafts);
  };
  const updateEmployee = (id: string, changes: Partial<Employee>) => {
    const before = db.employees.find(row => row.id === id), view = employees.find(employee => employee.id === id);
    if (!before || !view) return 'Employee not found.';
    const merged = { ...view,...changes };
    const errors = validateImport([{ employeeId:merged.employeeId,firstName:merged.name,lastName:merged.name,department:merged.department,jobTitle:merged.role,email:merged.email }],employees.filter(employee => employee.id !== id),employeeReferences);
    if (errors.length) return errors.join(' ');
    try {
      let after = before;
      transactDatabase(draft => {
        after = { ...before,employee_code:merged.employeeId,full_name:merged.name,email:merged.email || null,department_id:db.departments.find(row => row.name === merged.department)!.id,position_id:db.positions.find(row => row.name === merged.role)!.id,employment_status:merged.status,updated_at:new Date().toISOString() };
        for (const [viewField,column] of [['phone','phone'],['dateOfBirth','date_of_birth'],['gender','gender'],['address','address'],['hireDate','hire_date'],['employmentType','employment_type'],['monthlyIncome','current_salary'],['distanceFromHomeKm','distance_from_home_km']] as const) if (viewField in changes) after[column] = changes[viewField] === '' ? null:changes[viewField] ?? null;
        draft.employees = draft.employees.map(row => row.id === id ? after : row);
      });
      saveDraft(id,changes);
      recordAudit('EMPLOYEES',id,'Update employee',before,after);
      return null;
    } catch (cause) { return (cause as Error).message; }
  };
  const bulkUpdate = (ids: string[], changes: BulkChanges) => {
    if (changes.department && !employeeReferences.departments.includes(changes.department) || changes.role && !employeeReferences.positions.includes(changes.role)) return 0;
    const selected = db.employees.filter(row => ids.includes(row.id));
    transactDatabase(draft => {
      for (const row of draft.employees.filter(row => ids.includes(row.id))) {
        if (changes.department) row.department_id = db.departments.find(item => item.name === changes.department)!.id;
        if (changes.role) row.position_id = db.positions.find(item => item.name === changes.role)!.id;
        if (changes.status) row.employment_status = changes.status;
        row.updated_at = new Date().toISOString();
      }
    });
    for (const row of selected) recordAudit('EMPLOYEES',row.id,'Bulk update employee',row,changes);
    return selected.length;
  };
  const archiveEmployee = (id: string) => { updateEmployee(id,{ status:'Inactive' }); };
  return <Context.Provider value={{ employees,addEmployee,importEmployees,bulkUpdate,updateEmployee,archiveEmployee }}>{children}</Context.Provider>;
}
export function useEmployees() { const value = useContext(Context); if (!value) throw new Error('EmployeeProvider is required.'); return value; }
