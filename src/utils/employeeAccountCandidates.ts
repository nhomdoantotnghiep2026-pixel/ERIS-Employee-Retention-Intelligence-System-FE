import type { EmployeeAccountCandidate } from '../services/api';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();

export function filterAccountCandidates(items: EmployeeAccountCandidate[], query: string) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return items.filter(item => {
    const text = normalize([item.employeeCode, item.fullName, item.email].join(' '));
    return terms.every(term => text.includes(term));
  });
}
