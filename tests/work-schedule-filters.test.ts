import test from 'node:test';
import assert from 'node:assert/strict';
import { filterWorkSchedules } from '../src/utils/workScheduleFilters.ts';
import type { WorkSchedule } from '../src/services/api.ts';
const row = (id: number, extra: Partial<WorkSchedule> = {}): WorkSchedule => ({ id, name: 'Lịch hành chính', shift_type: 'DAY', status: 'ACTIVE', working_days: [1,2,3,4,5], start_time: '08:00', end_time: '17:00', break_start: null, break_end: null, ...extra });
const all = { search: '', shiftType: '', status: 'all', day: null } as const;
test('current schedules filter by name, shift type, status and working day without mutating source', () => {
  const rows = [row(1), row(2, { name: 'Ca cuối tuần', shift_type: 'WEEKEND', working_days: [6,7] }), row(3, { status: 'INACTIVE' })];
  assert.deepEqual(filterWorkSchedules(rows, all).map(s => s.id), [3,2,1]);
  assert.deepEqual(filterWorkSchedules(rows, { search: 'cuoi tuan', shiftType: 'weekend', status: 'ACTIVE', day: 7 }).map(s => s.id), [2]);
  assert.deepEqual(filterWorkSchedules(rows, { ...all, status: 'INACTIVE' }).map(s => s.id), [3]);
  assert.deepEqual(filterWorkSchedules(rows, { ...all, search: 'missing' }), []);
  assert.deepEqual(rows.map(s => s.id), [1,2,3]);
});
