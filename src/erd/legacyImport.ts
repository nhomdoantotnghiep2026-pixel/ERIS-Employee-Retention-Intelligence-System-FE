import type { ErdDatabase } from './schema.ts';
import { INPUT_FIELDS } from '../workflows/domain.ts';
// Preserve the old storage keys. This migration only maps known legacy fields;
// unsupported source records stay available in those keys for manual recovery.
export function importLegacyEmployees(db: ErdDatabase, legacy: unknown, create: (values: Record<string,string | number | null>) => { id:string;[field:string]:unknown }) {
  const ids: Record<string,string> = {}, drafts: Record<string,Record<string,unknown>> = {};
  if (!Array.isArray(legacy)) return { ids,drafts,skipped:0 };
  let skipped=0;
  for (const item of legacy) {
    if (!item || typeof item !== 'object' || typeof item.employeeId !== 'string' || !item.employeeId.trim() || typeof item.name !== 'string') { skipped++;continue; }
    const department=db.departments.find(row => row.name === item.department), position=db.positions.find(row => row.name === item.role);
    if (!department || !position) { skipped++;continue; }
    const existing=db.employees.find(row => row.employee_code === item.employeeId.trim());
    const row=create({ ...(existing ? { id:existing.id }:{}),employee_code:item.employeeId.trim(),full_name:item.name,email:typeof item.email === 'string' ? item.email:null,department_id:department.id,position_id:position.id,employment_status:item.status === 'Inactive' ? 'Inactive':'Active',current_salary:typeof item.monthlyIncome === 'number' ? item.monthlyIncome:null,distance_from_home_km:typeof item.distanceFromHomeKm === 'number' ? item.distanceFromHomeKm:null });
    if (existing) db.employees=db.employees.map(employee => employee.id === row.id ? row as typeof existing:employee);else db.employees.push(row as ErdDatabase['employees'][number]);
    if (typeof item.id === 'string') ids[item.id]=row.id;
    drafts[row.id]=Object.fromEntries(INPUT_FIELDS.filter(([field]) => typeof item[field] === 'number').map(([field]) => [field,item[field]]));
  }
  return { ids,drafts,skipped };
}
