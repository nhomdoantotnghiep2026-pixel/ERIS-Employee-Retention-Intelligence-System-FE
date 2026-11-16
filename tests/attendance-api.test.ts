import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('attendance read endpoints retain bearer auth, abort signals and server errors', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const originalFetch = globalThis.fetch;
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let response = Response.json({ date: '2026-10-26', checkedIn: false, checkedOut: false, attendance: null });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => 'attendance-fixture' } });
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return response; };
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts'); const current = await server.ssrLoadModule('/src/services/attendance.ts');
    const controller = new AbortController();
    assert.equal((await api.getTodayAttendance(controller.signal)).attendance, null);
    assert.equal(calls.at(-1)!.url, '/api/v1/attendance/today');
    assert.equal(calls.at(-1)!.init?.body, undefined);
    assert.equal(calls.at(-1)!.init?.signal, controller.signal);
    response = Response.json({ data: [] });
    await current.fetchAttendance({},false,controller.signal);
    assert.equal(calls.at(-1)!.url, '/api/v1/attendance');
    await current.fetchAttendanceDetail(9);
    assert.equal(calls.at(-1)!.url, '/api/v1/attendance/9');
    for (const [status, code] of [[401, 'INVALID_SESSION'], [403, 'FORBIDDEN'], [503, 'UNAVAILABLE']] as const) {
      response = Response.json({ message: 'Attendance unavailable', code }, { status });
      await assert.rejects(api.getTodayAttendance(), (error: { status: number; code: string }) => error.status === status && error.code === code);
    }
    response = new Response('Cannot GET /api/v1/attendance/today', { status: 404 });
    await assert.rejects(api.getTodayAttendance(), (error: { status: number }) => error.status === 404);
    for (const call of calls) {
      assert.equal(new Headers(call.init?.headers).get('Authorization'), 'Bearer attendance-fixture');
      assert.equal(call.init?.credentials, 'include');
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (storage) Object.defineProperty(globalThis, 'sessionStorage', storage); else Reflect.deleteProperty(globalThis, 'sessionStorage');
    await server.close();
  }
});
