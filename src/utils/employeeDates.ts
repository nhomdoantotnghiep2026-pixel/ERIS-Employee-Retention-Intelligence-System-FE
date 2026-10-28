// PostgreSQL DATE values may arrive either as YYYY-MM-DD or as an ISO instant
// produced from midnight in Vietnam. Preserve date-only values; convert instants.
export function employeeDate(value: string | null | undefined): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return '';
  return vietnamDate(instant);
}

function vietnamDate(instant: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function jobChangeDateRestriction(hireDate: string | null | undefined, now = new Date()): 'future' | 'today' | null {
  const date = employeeDate(hireDate);
  const today = vietnamDate(now);
  return !date || date < today ? null : date === today ? 'today' : 'future';
}
