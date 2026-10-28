import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('self-service loads the authenticated employee profile through the self-service endpoint', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const fetchOriginal = globalThis.fetch;
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const calls: string[] = [];
  const account = { id: 90, email: 'new-employee@test.invalid', fullName: 'New employee', roleId: 3, status: 'ACTIVE' };
  let current: object = account;
  let profileStatus = 200;
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => 'own-fixture' } });
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer own-fixture');
    assert.equal(init?.credentials, 'include');
    if (String(url) === '/api/auth/me') return Response.json(current);
    assert.equal(String(url), '/api/employees/me');
    return profileStatus === 200
      ? Response.json({ data: { id: 42, fullName: 'New employee', employeeCode: 'EMP042' } })
      : Response.json({ message: 'Not allowed' }, { status: profileStatus });
  };
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts');
    const linked = await api.getOwnEmployeeData();
    assert.equal(linked.profileState, 'available');
    assert.equal(linked.account.email, account.email);
    assert.equal(linked.employee.id, 42);
    assert.deepEqual(calls, ['/api/auth/me', '/api/employees/me']);
    profileStatus = 404;
    assert.equal((await api.getOwnEmployeeData()).profileState, 'unlinked');
    profileStatus = 403;
    const denied = await api.getOwnEmployeeData();
    assert.equal(denied.profileState, 'unavailable');
    assert.equal(denied.account.fullName, account.fullName);
    profileStatus = 500;
    await assert.rejects(api.getOwnEmployeeData(), (error: { status: number }) => error.status === 500);
  } finally {
    globalThis.fetch = fetchOriginal;
    if (storage) Object.defineProperty(globalThis, 'sessionStorage', storage); else Reflect.deleteProperty(globalThis, 'sessionStorage');
    await server.close();
  }
});
