import type { LeaveRequest } from '../services/api';

export type LeavePeriodFilter = 'ALL' | 'PAST' | 'CURRENT' | 'UPCOMING';

export interface LeaveRequestFilters {
  period: LeavePeriodFilter;
  requestStatus: string;
  search: string;
}

export function filterLeaveRequests(rows: LeaveRequest[], filters: LeaveRequestFilters, currentDate: string) {
  const search = filters.search.trim().toLocaleLowerCase('vi-VN');
  return rows.filter(row => {
    const matchesPeriod = filters.period === 'ALL'
      || (filters.period === 'PAST' && row.toDate < currentDate)
      || (filters.period === 'CURRENT' && row.fromDate <= currentDate && row.toDate >= currentDate)
      || (filters.period === 'UPCOMING' && row.fromDate > currentDate);
    const matchesRequestStatus = filters.requestStatus === 'ALL' || row.status === filters.requestStatus;
    const searchableText = `${row.fullName || ''} ${row.employeeCode || ''} ${row.reason || ''}`.toLocaleLowerCase('vi-VN');
    return matchesPeriod && matchesRequestStatus && (!search || searchableText.includes(search));
  });
}
