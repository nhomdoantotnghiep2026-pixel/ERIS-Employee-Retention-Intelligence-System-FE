import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('ATT uses the versioned endpoints, bearer auth, real GPS fields and preserves rejected attendance', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const originalFetch = globalThis.fetch;
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let response = Response.json({ date: '2026-10-26', checkedIn: false, checkedOut: false, attendance: null });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => 'attendance-fixture' } });
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return response; };
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts');
    const controller = new AbortController();
    assert.equal((await api.getTodayAttendance(controller.signal)).attendance, null);
    assert.equal(calls.at(-1)!.url, '/api/v1/attendance/today');
    assert.equal(calls.at(-1)!.init?.body, undefined);
    assert.equal(calls.at(-1)!.init?.signal, controller.signal);
    const gps = { latitude: 10.8, longitude: 106.7, accuracyMeters: 12 };
    for (const action of ['check-in', 'check-out']) {
      response = Response.json({ status: 'OUTSIDE', persisted: false, distanceMeters: 150, allowedRadiusMeters: 100 });
      const result = await api.recordAttendance(action, gps, controller.signal);
      assert.equal(result.persisted, false, 'HTTP 200 must not become a saved attendance');
      assert.equal(result.status, 'OUTSIDE');
      const call = calls.at(-1)!;
      assert.equal(call.url, `/api/v1/attendance/${action}`);
      assert.equal(call.init?.method, 'POST');
      assert.deepEqual(JSON.parse(String(call.init?.body)), gps);
    }
    response = Response.json({ status: 'INSIDE', persisted: true, attendance: { checkIn: '2026-10-26T08:00:00+07:00' } });
    assert.equal((await api.recordAttendance('check-in', gps)).persisted, true);
    for (const [status, code] of [[400, 'STALE_LOCATION'], [401, 'INVALID_SESSION'], [403, 'FORBIDDEN'], [409, 'CHECK_IN_REQUIRED'], [503, 'UNAVAILABLE']] as const) {
      response = Response.json({ message: 'Attendance rejected', code }, { status });
      await assert.rejects(api.recordAttendance('check-out', gps), (error: { status: number; code: string }) => error.status === status && error.code === code);
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
