import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('work schedule calls use the BE contract and preserve errors', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const original = globalThis.fetch;
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => 'schedule-fixture' } });
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let response = Response.json({ data: [] });
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return response; };
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts');
    const schedule = { name: 'Ngày thường', shift_type: 'DAY', start_time: '08:00', end_time: '17:00', break_start: '12:00', break_end: '13:00', working_days: [1, 2, 3, 4, 5], status: 'ACTIVE' };
    await api.createWorkSchedule(schedule);
    assert.equal(calls.at(-1)!.url, '/api/work-schedules');
    assert.deepEqual(JSON.parse(String(calls.at(-1)!.init?.body)), schedule);
    await api.createIndividualSchedule({ ...schedule, employee_id: 5 });
    assert.equal(calls.at(-1)!.url, '/api/work-schedules/individual');
    assert.deepEqual(JSON.parse(String(calls.at(-1)!.init?.body)), { ...schedule, employee_id: 5 });
    await api.createWorkSchedule({ ...schedule, break_start: null, break_end: null });
    assert.equal(JSON.parse(String(calls.at(-1)!.init?.body)).break_start, null);
    assert.equal(JSON.parse(String(calls.at(-1)!.init?.body)).break_end, null);
    await api.assignWorkSchedule(5, { work_schedule_id: 7 });
    assert.equal(calls.at(-1)!.url, '/api/employees/5/work-schedule');
    assert.equal(calls.at(-1)!.init?.method, 'PUT'); assert.deepEqual(JSON.parse(String(calls.at(-1)!.init?.body)), { work_schedule_id: 7 });
    response = Response.json({ data: [{ employee_id: 5, work_schedule_id: 7, ...schedule }] });
    assert.equal((await api.listScheduleAssignments(5)).data[0].work_schedule_id, 7);
    await api.deleteScheduleAssignment(5, 7);
    assert.equal(calls.at(-1)!.url, '/api/employees/5/schedule-assignments/7');
    assert.equal(calls.at(-1)!.init?.method, 'DELETE');
    response = Response.json({ message: 'Conflict' }, { status: 409 });
    await assert.rejects(api.updateWorkSchedule(7, { status: 'INACTIVE' }), (error: { status: number }) => error.status === 409);
  } finally { globalThis.fetch = original; if (storage) Object.defineProperty(globalThis, 'sessionStorage', storage); else Reflect.deleteProperty(globalThis, 'sessionStorage'); await server.close(); }
});
