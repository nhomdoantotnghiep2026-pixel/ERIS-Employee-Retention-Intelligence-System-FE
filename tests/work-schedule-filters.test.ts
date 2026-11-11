import test from 'node:test';
import assert from 'node:assert/strict';
import { filterWorkSchedules, scheduleKind } from '../src/utils/workScheduleFilters.ts';
import type { WorkSchedule } from '../src/services/api.ts';

const row = (id: number, extra: Partial<WorkSchedule> = {}): WorkSchedule => ({ id, name: 'Lịch hành chính', status: 'ACTIVE', is_default: false, working_days: [1, 2, 3, 4, 5], start_time: '08:00', end_time: '17:00', break_start: '12:00', break_end: '13:00', ...extra });
const all = { search: '', kind: 'all', status: 'all', day: null } as const;
test('schedule list separates current and pending defaults and prioritises the latest changed schedule without mutating data', () => {
  const rows = [row(1, { is_default: true }), row(2, { pending_default: { effective_from: '2026-11-12' } }), row(3)];
  assert.deepEqual(rows.map(scheduleKind), ['default', 'pending', 'individual']);
  assert.deepEqual(filterWorkSchedules(rows, all).map(s => s.id), [1, 2, 3]);
  assert.deepEqual(filterWorkSchedules(rows, all, 3).map(s => s.id), [3, 1, 2]);
  assert.deepEqual(filterWorkSchedules(rows, { ...all, kind: 'pending' }).map(s => s.id), [2]);
  assert.deepEqual(filterWorkSchedules(rows, { ...all, kind: 'individual' }).map(s => s.id), [3]);
  assert.deepEqual(rows.map(s => s.id), [1, 2, 3]);
});
test('schedule filters combine name, type, status and working day', () => {
  const rows = [row(1, { is_default: true }), row(2, { name: 'Ca cuối tuần', working_days: [6, 7] }), row(3, { status: 'INACTIVE' })];
  assert.deepEqual(filterWorkSchedules(rows, { search: 'cuoi tuan', kind: 'individual', status: 'ACTIVE', day: 7 }).map(s => s.id), [2]);
  assert.deepEqual(filterWorkSchedules(rows, { ...all, kind: 'default' }).map(s => s.id), [1]);
  assert.deepEqual(filterWorkSchedules(rows, { ...all, status: 'INACTIVE' }).map(s => s.id), [3]);
  assert.deepEqual(filterWorkSchedules(rows, { ...all, search: 'missing' }), []);
});
