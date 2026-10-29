import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('admin authenticates with its users backend; HR stays on the primary backend and tokens are not sent to login', async () => {
  const server = await createServer({ configFile: false, define: { 'import.meta.env.VITE_ADMIN_API_BASE_URL': JSON.stringify('/admin-api') }, server: { middlewareMode: true, ws: false } });
  const originalFetch = globalThis.fetch;
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const values = new Map<string,string>();
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key,value) } });
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let role = 'ADMIN';
  globalThis.fetch = async (input, init) => {
    const url = String(input); calls.push({ url, init });
    // Both real login implementations return roleId without a role name.
    const user = { id: 1, email: 'fixture@example.invalid', roleId: role === 'ADMIN' ? 1 : 2, status: 'ACTIVE' };
    if (url.endsWith('/auth/login')) return Response.json({ user, accessToken: url.startsWith('/admin-api') ? 'admin-token' : 'primary-token' });
    if (url.endsWith('/auth/me')) return Response.json(user);
    if (url.endsWith('/auth/refresh')) return Response.json({ accessToken: 'admin-refreshed' });
    if (url.includes('/users?')) return Response.json({ data: [user], pagination: { page: 1, limit: 10, total: 1, hasMore: false } });
    return Response.json({});
  };
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts');
    await assert.rejects(api.listUsers(), { code: 'ADMIN_SESSION_REQUIRED' });
    assert.equal(calls.length,0);
    await api.login('fixture@example.invalid','test-password');
    assert.deepEqual(calls.map(call=>call.url), ['/api/auth/login','/admin-api/auth/login']);
    assert.equal(values.get('eris-access-token'),'admin-token');
    assert.equal(values.get('eris-api-backend'),'admin');
    assert.equal((await api.getCurrentUser()).role, 'ADMIN');
    await api.listUsers();
    assert.equal(calls.at(-2)!.url,'/admin-api/auth/me');
    assert.ok(calls.at(-1)!.url.startsWith('/admin-api/users?'));
    assert.equal(new Headers(calls.at(-1)!.init?.headers).get('Authorization'),'Bearer admin-token');
    await api.refreshSession();
    assert.equal(calls.at(-1)!.url,'/admin-api/auth/refresh');
    assert.equal(calls.at(-1)!.init?.credentials,'include');
    await api.logout();
    assert.equal(calls.at(-1)!.url,'/admin-api/auth/logout');
    role='HR'; calls.length=0;
    await api.login('fixture@example.invalid','test-password');
    assert.equal(calls.length,1);
    assert.equal(values.get('eris-api-backend'),'primary');
    await api.getCurrentUser();
    assert.equal(calls.at(-1)!.url,'/api/auth/me');
    for (const call of calls.filter(call=>call.url.endsWith('/login'))) assert.equal(new Headers(call.init?.headers).has('Authorization'),false);
  } finally {
    globalThis.fetch=originalFetch;
    if(storage) Object.defineProperty(globalThis,'sessionStorage',storage); else Reflect.deleteProperty(globalThis,'sessionStorage');
    await server.close();
  }
});
