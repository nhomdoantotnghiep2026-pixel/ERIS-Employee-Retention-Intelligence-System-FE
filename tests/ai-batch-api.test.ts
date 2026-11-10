import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('AI snapshot detail and batch prediction use the backend contract', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const originalFetch = globalThis.fetch;
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let response = Response.json({ data: { id: 9, employeeId: 4, ready: true } });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => 'ai-fixture' } });
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return response; };
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts');
    assert.equal((await api.getAiSnapshot(4, 9)).data.id, 9);
    assert.equal(calls.at(-1)!.url, '/api/ai/employees/4/snapshots/9');
    const employees = [{ employeeId: 4, snapshotId: 9, save: false }, { employeeId: 5, snapshotId: 10, save: true }];
    response = Response.json({ data: { total: 2, succeeded: 1, failed: 1, results: [{ employeeId: 4, success: true, data: {} }, { employeeId: 5, success: false, message: 'Not ready' }] } });
    const result = await api.predictAiBatch(employees);
    assert.equal(calls.at(-1)!.url, '/api/ai/predict-batch');
    assert.equal(calls.at(-1)!.init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(calls.at(-1)!.init?.body)), { employees });
    assert.equal(result.data.results[1].success, false);
    for (const call of calls) assert.equal(new Headers(call.init?.headers).get('Authorization'), 'Bearer ai-fixture');
  } finally {
    globalThis.fetch = originalFetch;
    if (storage) Object.defineProperty(globalThis, 'sessionStorage', storage); else Reflect.deleteProperty(globalThis, 'sessionStorage');
    await server.close();
  }
});
