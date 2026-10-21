import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('EMP FE uses camelCase queries, bare detail, partial PATCH and bodyless soft DELETE', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const originalFetch = globalThis.fetch, storage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let response = Response.json({});
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => 'hr-token' } });
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return response; };
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts');
    response = Response.json({ data: [], pagination: { page: 2, limit: 20, total: 21, totalPages: 2 } });
    const list = await api.listEmployeeProfiles({ page: 2, search: 'a+b', departmentId: 1, positionId: 2, employmentStatus: 'ACTIVE' });
    assert.equal(list.pagination.totalPages, 2);
    const url = new URL(calls.at(-1)!.url, 'http://localhost');
    assert.equal(url.pathname, '/api/employees'); assert.equal(url.searchParams.get('search'), 'a+b');
    assert.equal(url.searchParams.get('departmentId'), '1'); assert.equal(url.searchParams.get('page'), '2');
    const record = { id: 5, fullName: 'Test', distanceCalculation: { status: 'READY' }, distanceFromHomeKm: 10 };
    response = Response.json(record);
    assert.deepEqual(await api.getEmployeeProfile(5), record);
    response = Response.json({ data: record }, { status: 201 });
    const input = { fullName: 'Test', email: 'test@eris.invalid', hireDate: '2025-01-01', departmentId: 1, positionId: 2 };
    await api.createEmployeeProfile(input);
    assert.equal(calls.at(-1)!.init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(calls.at(-1)!.init?.body)), input);
    response = Response.json({ data: record });
    await api.updateEmployeeProfile(5, { phone: '0901234567' });
    assert.equal(calls.at(-1)!.init?.method, 'PATCH');
    assert.deepEqual(JSON.parse(String(calls.at(-1)!.init?.body)), { phone: '0901234567' });
    await api.deactivateEmployeeProfile(5);
    assert.equal(calls.at(-1)!.init?.method, 'DELETE'); assert.equal(calls.at(-1)!.init?.body, undefined);
    assert.ok(calls.at(-1)!.url.endsWith('/employees/5'));
    for (const call of calls) {
      assert.equal(new Headers(call.init?.headers).get('Authorization'), 'Bearer hr-token');
      assert.equal(call.init?.credentials, 'include');
    }
    for (const status of [400, 403, 404, 409, 503]) {
      response = Response.json({ error: { message: 'Validation or configuration error' } }, { status });
      await assert.rejects(api.createEmployeeProfile(input), (error: { status: number }) => error.status === status);
    }
    const fallbackCalls: URL[] = [];
    globalThis.fetch = async url => {
      const parsed = new URL(String(url), 'http://localhost');
      fallbackCalls.push(parsed);
      return parsed.searchParams.has('page')
        ? Response.json({ message: 'Internal server error.' }, { status: 500 })
        : Response.json({ data: Array.from({ length: 25 }, (_, id) => ({ id: id + 1 })) });
    };
    const fallback = await api.listEmployeeProfiles({ page: 2, limit: 20, search: 'a+b', departmentId: 1, employmentStatus: 'ACTIVE' });
    assert.equal(fallbackCalls.length, 2);
    assert.equal(fallbackCalls[1].searchParams.has('limit'), false);
    assert.equal(fallbackCalls[1].searchParams.get('search'), 'a+b');
    assert.equal(fallbackCalls[1].searchParams.get('departmentId'), '1');
    assert.equal(fallbackCalls[1].searchParams.get('employmentStatus'), 'ACTIVE');
    assert.deepEqual(fallback.data.map(item => item.id), [21, 22, 23, 24, 25]);
    assert.deepEqual(fallback.pagination, { page: 2, limit: 20, total: 25, totalPages: 2 });
    let deniedCalls = 0;
    globalThis.fetch = async () => { deniedCalls++; return Response.json({ message: 'Forbidden' }, { status: 403 }); };
    await assert.rejects(api.listEmployeeProfiles(), { status: 403 });
    assert.equal(deniedCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (storage) Object.defineProperty(globalThis, 'sessionStorage', storage); else Reflect.deleteProperty(globalThis, 'sessionStorage');
    await server.close();
  }
});
