import { employeeDate } from './employeeDates.ts';

/** Match whole Vietnam calendar days, using the same timezone as the audit table. */
export function auditDateMatches(createdAt: string, fromDate: string, toDate: string): boolean {
  if (!fromDate && !toDate) return true;
  const day = employeeDate(createdAt);
  return !!day && (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
}
