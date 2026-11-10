import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { LeaveRequest } from '../src/services/api.ts';
import { filterLeaveRequests, type LeaveRequestFilters } from '../src/utils/leaveRequestFilters.ts';

const requests: LeaveRequest[] = [
  { id: 1, employeeId: 1, employeeCode: 'EMP001', fullName: 'An Nguyen', fromDate: '2026-11-01', toDate: '2026-11-03', reason: 'Family matter', status: 'APPROVED', effectiveStatus: 'APPROVED', histories: [] },
  { id: 2, employeeId: 2, employeeCode: 'EMP002', fullName: 'Binh Tran', fromDate: '2026-11-10', toDate: '2026-11-12', reason: 'Medical appointment', status: 'PENDING', effectiveStatus: 'PENDING', histories: [] },
  { id: 3, employeeId: 3, employeeCode: 'EMP003', fullName: 'Chi Le', fromDate: '2026-11-12', toDate: '2026-11-13', reason: 'Travel', status: 'CANCEL_REQUESTED', effectiveStatus: 'APPROVED', histories: [] },
  { id: 4, employeeId: 4, employeeCode: 'EMP004', fullName: 'Dung Pham', fromDate: '2026-11-10', toDate: '2026-11-10', reason: 'Other', status: 'REJECTED', effectiveStatus: null, histories: [] },
];

const filters: LeaveRequestFilters = {
  period: 'ALL',
  requestStatus: 'ALL',
  search: '',
};
const today = '2026-11-10';

test('leave period filters classify past, current and upcoming requests inclusively', () => {
  assert.deepEqual(filterLeaveRequests(requests, { ...filters, period: 'PAST' }, today).map(row => row.id), [1]);
  assert.deepEqual(filterLeaveRequests(requests, { ...filters, period: 'CURRENT' }, today).map(row => row.id), [2, 4]);
  assert.deepEqual(filterLeaveRequests(requests, { ...filters, period: 'UPCOMING' }, today).map(row => row.id), [3]);
});

test('leave request filters combine request status and employee/reason search', () => {
  assert.deepEqual(filterLeaveRequests(requests, {
    ...filters,
    requestStatus: 'CANCEL_REQUESTED',
    search: 'chi',
  }, today).map(row => row.id), [3]);
  assert.deepEqual(filterLeaveRequests(requests, { ...filters, search: 'emp004' }, today).map(row => row.id), [4]);
  assert.deepEqual(filterLeaveRequests(requests, { ...filters, search: 'medical' }, today).map(row => row.id), [2]);
});
