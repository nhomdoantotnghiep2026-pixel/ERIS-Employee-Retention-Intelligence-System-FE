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
    const schedule = { name: 'Ngày thường', start_time: '08:00', end_time: '17:00', break_start: '12:00', break_end: '13:00', working_days: [1, 2, 3, 4, 5], status: 'ACTIVE' };
    await api.createWorkSchedule(schedule, 'default');
    assert.equal(calls.at(-1)!.url, '/api/work-schedules/default');
    assert.deepEqual(JSON.parse(String(calls.at(-1)!.init?.body)), schedule);
    await api.createIndividualSchedule({ ...schedule, employee_id: 5, effective_from: '2026-12-01', effective_to: '2026-12-31' });
    assert.equal(calls.at(-1)!.url, '/api/work-schedules/individual');
    await api.assignWorkSchedule(5, { schedule_id: 7, effective_from: '2026-12-01', effective_to: null });
    assert.equal(calls.at(-1)!.url, '/api/employees/5/schedule-assignments');
    assert.equal(JSON.parse(String(calls.at(-1)!.init?.body)).effective_to, null);
    response = Response.json({ message: 'Conflict' }, { status: 409 });
    await assert.rejects(api.setDefaultSchedule(7), (error: { status: number }) => error.status === 409);
  } finally { globalThis.fetch = original; if (storage) Object.defineProperty(globalThis, 'sessionStorage', storage); else Reflect.deleteProperty(globalThis, 'sessionStorage'); await server.close(); }
});
