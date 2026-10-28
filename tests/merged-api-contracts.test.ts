import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('merged account filtering, nested roles, HR creation, upload and address suggestions preserve BE contracts', async () => {
  const server = await createServer({ configFile: false, define: { 'import.meta.env.VITE_ADMIN_API_BASE_URL': JSON.stringify('') }, server: { middlewareMode: true, ws: false } });
  const originalFetch = globalThis.fetch, storage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const calls: Array<{ url: URL; init?: RequestInit }> = [];
  let response = Response.json({});
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => 'fixture-token' } });
  globalThis.fetch = async (url, init) => { calls.push({ url: new URL(String(url), 'http://localhost'), init }); return response; };
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts');
    const user = { id: 9, email: 'hr@test.invalid', role: { id: 2, name: 'HR' }, status: 'ACTIVE' };
    response = Response.json({ data: [user], pagination: { page: 2, limit: 10, total: 11, hasMore: false } });
    const listed = await api.listUsers({ page: 2, limit: 10, search: ' HR + name ', roleId: 2, status: 'ACTIVE' });
    assert.equal(listed.data[0].roleId, 2, 'editing an unchanged role must not silently select another role');
    assert.equal(calls.at(-1)!.url.searchParams.get('search'), 'HR + name');
    assert.equal(calls.at(-1)!.url.searchParams.get('page'), '2');
    assert.equal(calls.at(-1)!.url.searchParams.get('roleId'), '2');
    assert.equal(calls.at(-1)!.url.searchParams.get('status'), 'ACTIVE');
    assert.equal(calls.at(-1)!.init?.cache, 'no-store');
    const controller = new AbortController();
    response = Response.json({ data: [user], pagination: { page: 1, limit: 10, total: 1, hasMore: false } });
    await api.listUsers({}, controller.signal);
    assert.equal(calls.at(-1)!.init?.signal, controller.signal);
    response = new Response('Cannot GET /api/users', { status: 404 });
    await assert.rejects(api.listUsers(), (error: { status: number; code: string; message: string }) =>
      error.status === 404 && error.code === 'USER_DIRECTORY_UNAVAILABLE' && error.message.includes('backend'));
    response = Response.json({ message: 'Forbidden' }, { status: 403 });
    await assert.rejects(api.listUsers(), (error: { status: number; code?: string }) => error.status === 403 && error.code !== 'USER_DIRECTORY_UNAVAILABLE');
    response = Response.json({ data: [], pagination: { page: 1, limit: 10, total: 0, hasMore: false } });
    assert.deepEqual((await api.listUsers()).data, [], 'a genuinely empty directory remains distinct from a missing endpoint');
    response = Response.json(user);
    assert.equal((await api.getUserById(9)).roleId, 2);
    response = Response.json({ ...user, status: 'INACTIVE' });
    await api.updateUserStatus(9, 'INACTIVE');
    assert.equal(calls.at(-1)!.url.pathname, '/api/users/9/status');
    assert.equal(calls.at(-1)!.init?.method, 'PATCH');
    assert.deepEqual(JSON.parse(String(calls.at(-1)!.init?.body)), { status: 'INACTIVE' });
    response = Response.json({ message: 'User status updated successfully.', data: { ...user, status: 'INACTIVE' } });
    assert.equal((await api.updateUserStatus(9, 'INACTIVE')).status, 'INACTIVE');
    response = Response.json({ data: user }, { status: 201 });
    assert.equal((await api.createUser({ email: user.email, roleId: 2 })).id, 9);
    assert.deepEqual(JSON.parse(String(calls.at(-1)!.init?.body)), { email: user.email, roleId: 2 });
    response = Response.json(user, { status: 201 });
    assert.equal((await api.createUser({ email: user.email, roleId: 2 })).id, 9, 'also accepts a bare user response');
    response = Response.json({ places: [{ refId: 'home', display: 'Matched address' }] });
    assert.equal((await api.searchPlaces('  21/2 + Street  ')).places[0].refId, 'home');
    assert.equal(calls.at(-1)!.url.pathname, '/api/distance/places');
    assert.equal(calls.at(-1)!.url.searchParams.get('query'), '21/2 + Street');
    const file = new File(['workbook fixture'], 'employees.xlsx');
    response = Response.json({ total: 2, created: 1, failed: 1, results: [{ row: 2, status: 'CREATED' }, { row: 3, status: 'FAILED', statusCode: 409 }] });
    const imported = await api.importEmployees(file);
    assert.equal(imported.failed, 1);
    const upload = calls.at(-1)!;
    assert.equal(upload.url.pathname, '/api/employees/import');
    assert.equal(upload.init?.method, 'POST');
    assert.equal(new Headers(upload.init?.headers).has('Content-Type'), false, 'browser must supply multipart boundary');
    assert.ok(upload.init?.body instanceof FormData);
    assert.equal((upload.init!.body as FormData).get('file'), file);
    for (const call of calls) {
      assert.equal(new Headers(call.init?.headers).get('Authorization'), 'Bearer fixture-token');
      assert.equal(call.init?.credentials, 'include');
    }
    for (const status of [400, 403, 413, 422, 503]) {
      response = Response.json({ error: { message: 'Import rejected' } }, { status });
      await assert.rejects(api.importEmployees(file), (error: { status: number }) => error.status === status);
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (storage) Object.defineProperty(globalThis, 'sessionStorage', storage); else Reflect.deleteProperty(globalThis, 'sessionStorage');
    await server.close();
  }
});
