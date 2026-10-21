import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('department requests follow the BE contract and preserve server errors', async t => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const originalFetch = globalThis.fetch;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let response = new Response();
  let preflight: Array<{ id: number; name: string; status?: string }> | null = null;
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => 'test-access-token' } });
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (preflight !== null && String(url).endsWith('/departments') && !init?.method) return Response.json({ data: preflight });
    return response;
  };
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts');
    await t.test('list uses the main backend departments resource', async () => {
      response = Response.json({ data: [{ id: 4, name: 'HR', description: null }], pagination: { page: 1, limit: 100, has_more: false } });
      const result = await api.listDepartments();
      const call = calls.at(-1)!;
      const url = new URL(call.url, 'http://localhost');
      assert.equal(url.pathname, '/api/departments');
      assert.equal(url.search, '');
      assert.equal(new Headers(call.init?.headers).get('Authorization'), 'Bearer test-access-token');
      assert.equal(call.init?.credentials, 'include');
      assert.equal(result.data[0].name, 'HR');
    });
    await t.test('create and update send only the department fields', async () => {
      preflight = [];
      response = Response.json({ data: { id: 4, name: 'HR', description: null } }, { status: 201 });
      assert.equal((await api.createDepartment({ name: 'HR', description: null })).name, 'HR');
      assert.equal(new URL(calls.at(-1)!.url, 'http://localhost').pathname, '/api/departments');
      assert.equal(calls.at(-1)?.init?.method, 'POST');
      assert.deepEqual(JSON.parse(String(calls.at(-1)?.init?.body)), { name: 'HR', description: null });
      response = Response.json({ data: { id: 4, name: 'People', description: 'Team' } });
      assert.equal((await api.updateDepartment(4, { name: 'People', description: 'Team' })).name, 'People');
      assert.equal(new URL(calls.at(-1)!.url, 'http://localhost').pathname, '/api/departments/4');
      assert.equal(calls.at(-1)?.init?.method, 'PATCH');
      assert.deepEqual(JSON.parse(String(calls.at(-1)?.init?.body)), { name: 'People', description: 'Team' });
      preflight = null;
    });
    await t.test('FE blocks duplicate names before POST or PATCH, including inactive records', async () => {
      preflight = [{ id: 4, name: 'Ecommerce', status: 'INACTIVE' }];
      for (const name of ['Ecommerce', 'ECOMMERCE', ' Ecommerce ']) {
        const before = calls.length;
        await assert.rejects(api.createDepartment({ name, description: null }), { status: 409 });
        assert.equal(calls.length, before + 1);
        assert.equal(calls.at(-1)?.init?.method, undefined);
        await assert.rejects(api.updateDepartment(5, { name, description: null }), { status: 409 });
      }
      response = Response.json({ data: { id: 4, name: 'ECOMMERCE', description: null } });
      await api.updateDepartment(4, { name: 'ECOMMERCE', description: null });
      assert.equal(calls.at(-1)?.init?.method, 'PATCH');
      preflight = null;
    });
    await t.test('search and later pages use the full directory returned by team BE', async () => {
      response = Response.json({ data: Array.from({ length: 105 }, (_, id) => ({ id: id + 1, name: 'R&D / Nhân sự', description: null })) });
      const result = await api.listDepartments(undefined, { page: 6, limit: 20, search: ' R&D / Nhân sự ' });
      const url = new URL(calls.at(-1)!.url, 'http://localhost');
      assert.equal(url.pathname, '/api/departments');
      assert.equal(result.data.length, 5);
      assert.equal(result.data[0].id, 101);
      assert.equal(result.pagination.has_more, false);
    });
    await t.test('DELETE deactivates using the team endpoint and surfaces active-employee conflicts', async () => {
      response = Response.json({ data: { id: 4, name: 'HR', status: 'INACTIVE', description: null } });
      assert.equal((await api.deactivateDepartment(4)).status, 'INACTIVE');
      assert.equal(new URL(calls.at(-1)!.url, 'http://localhost').pathname, '/api/departments/4');
      assert.equal(calls.at(-1)?.init?.method, 'DELETE');
      assert.equal(calls.at(-1)?.init?.body, undefined);
      response = Response.json({ error: { message: 'Cannot deactivate a department that still has active employees.' } }, { status: 409 });
      await assert.rejects(api.deactivateDepartment(4), (error: { status: number; message: string }) => error.status === 409 && error.message.includes('active employees'));
    });
    await t.test('soft-deleted departments stay hidden after reload and do not affect paging or search', async () => {
      const directory = [{ id: 1, name: 'Hidden', description: null, status: 'INACTIVE' },
        { id: 2, name: 'Visible', description: null, status: 'ACTIVE' }];
      response = Response.json({ data: directory });
      const result = await api.listDepartments(undefined, { limit: 1 });
      assert.deepEqual(result.data.map(item => item.id), [2]);
      assert.equal(result.pagination.has_more, false);
      response = Response.json({ data: directory });
      assert.equal((await api.listDepartments(undefined, { search: 'Hidden' })).data.length, 0);
      response = Response.json({ data: directory });
      assert.deepEqual((await api.listDepartments()).data.map(item => item.id), [2]);
    });
    await t.test('permission and conflict errors are surfaced', async () => {
      for (const status of [403, 409]) {
        const before = calls.length;
        response = Response.json({ error: { code: 'DEPARTMENT_EXISTS', message: 'Department name already exists' } }, { status });
        await assert.rejects(api.createDepartment({ name: 'HR', description: null }), (error: { status: number; message: string }) => error.status === status && error.message === 'Department name already exists');
        assert.equal(calls.length, before + 1);
      }
    });
    await t.test('DEPT-05 fetches detail by ID with a bearer token and no request body', async () => {
      const controller = new AbortController();
      response = Response.json({ data: { id: 4, code: 'DP004', name: 'Fresh detail', description: 'From API', status: 'ACTIVE' } });
      assert.equal((await api.getDepartmentById(4, controller.signal)).name, 'Fresh detail');
      const call = calls.at(-1)!;
      assert.equal(new URL(call.url, 'http://localhost').pathname, '/api/departments/4');
      assert.equal(call.init?.method ?? 'GET', 'GET');
      assert.equal(call.init?.body, undefined);
      assert.equal(call.init?.signal, controller.signal);
      assert.equal(new Headers(call.init?.headers).get('Authorization'), 'Bearer test-access-token');
      response = Response.json({ error: { code: 'DEPARTMENT_NOT_FOUND', message: 'Department not found.' } }, { status: 404 });
      await assert.rejects(api.getDepartmentById(99999), (error: { status: number }) => error.status === 404);
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
    await server.close();
  }
});
