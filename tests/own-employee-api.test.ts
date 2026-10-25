import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('self-service uses the authenticated account and never confuses omitted links or denied profiles with an unlinked employee', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const fetchOriginal = globalThis.fetch;
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const calls: string[] = [];
  const account = { id: 90, email: 'new-employee@test.invalid', fullName: 'New employee', roleId: 3, status: 'ACTIVE' };
  let current: object = account;
  let detailStatus = 200;
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => 'own-fixture' } });
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer own-fixture');
    assert.equal(init?.credentials, 'include');
    if (String(url) === '/api/auth/me') return Response.json(current);
    assert.equal(String(url), '/api/employees/42');
    return detailStatus === 200 ? Response.json({ id: 42, fullName: 'New employee', employeeCode: 'EMP042' }) : Response.json({ message: 'Not allowed' }, { status: detailStatus });
  };
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts');
    const omitted = await api.getOwnEmployeeData();
    assert.equal(omitted.profileState, 'unavailable');
    assert.equal(omitted.account.email, account.email);
    assert.deepEqual(calls, ['/api/auth/me'], 'never fetch an employee directory to guess the profile');
    current = { ...account, employeeId: null };
    assert.equal((await api.getOwnEmployeeData()).profileState, 'unlinked');
    current = { ...account, employeeId: 42 };
    const linked = await api.getOwnEmployeeData();
    assert.equal(linked.profileState, 'available');
    assert.equal(linked.employee.id, 42);
    for (const status of [403, 404]) {
      detailStatus = status;
      const denied = await api.getOwnEmployeeData();
      assert.equal(denied.profileState, 'unavailable');
      assert.equal(denied.account.fullName, account.fullName);
    }
    detailStatus = 500;
    await assert.rejects(api.getOwnEmployeeData(), (error: { status: number }) => error.status === 500);
  } finally {
    globalThis.fetch = fetchOriginal;
    if (storage) Object.defineProperty(globalThis, 'sessionStorage', storage); else Reflect.deleteProperty(globalThis, 'sessionStorage');
    await server.close();
  }
});
