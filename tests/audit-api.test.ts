import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('audit list and detail use the active admin backend and preserve server fields', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false }, define: { 'import.meta.env.VITE_ADMIN_API_BASE_URL': JSON.stringify('/admin-api') } });
  const previousFetch = globalThis.fetch;
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const session = new Map([['eris-access-token', 'admin-token'], ['eris-api-backend', 'admin']]);
  const entry = { id: 19, userId: 1, entityType: 'EMPLOYEES', entityId: 7, action: 'UPDATE', createdAt: '2026-11-11T02:00:00Z', actor: { id: 1, email: 'admin@example.test', fullName: 'Admin fixture' } };
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => session.get(key) ?? null } });
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({ data: String(url).endsWith('/19') ? { ...entry, oldValue: { status: 'ACTIVE' }, newValue: { status: 'INACTIVE' } } : [entry] });
  };
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts');
    assert.deepEqual((await api.listAuditLogs()).data, [entry]);
    assert.deepEqual((await api.getAuditLog(19)).data.newValue, { status: 'INACTIVE' });
    assert.deepEqual(calls.map(call => call.url), ['/admin-api/audit-logs', '/admin-api/audit-logs/19']);
    for (const call of calls) {
      assert.equal(new Headers(call.init?.headers).get('Authorization'), 'Bearer admin-token');
      assert.equal(call.init?.cache, 'no-store');
    }
    session.delete('eris-api-backend');
    await assert.rejects(api.listAuditLogs(), (error: { code: string }) => error.code === 'ADMIN_SESSION_REQUIRED');
    assert.equal(calls.length, 2, 'Do not send an admin audit request with the primary backend session');
    session.set('eris-api-backend', 'admin');
    globalThis.fetch = async () => Response.json({ message: 'Không tìm thấy audit log.' }, { status: 404 });
    await assert.rejects(api.getAuditLog(19), (error: { status: number }) => error.status === 404);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousStorage) Object.defineProperty(globalThis, 'sessionStorage', previousStorage);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
    await server.close();
  }
});
