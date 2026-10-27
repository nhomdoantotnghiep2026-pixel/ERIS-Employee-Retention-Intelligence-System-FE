import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('first-login password change uses the password-change token and backend contract', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const originalFetch = globalThis.fetch;
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let response = Response.json({ passwordChangeToken: 'password-change-token' });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: { getItem: () => null, setItem: () => undefined },
  });
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return response;
  };
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts');
    const login = await api.login('hr@example.test', 'temporary-password');
    assert.equal(login.passwordChangeToken, 'password-change-token');
    assert.equal(calls[0].url, '/api/auth/login');
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      email: 'hr@example.test',
      password: 'temporary-password',
    });

    response = Response.json({ message: 'Password changed successfully.' });
    await api.changePassword(login.passwordChangeToken, 'temporary-password', '123456', 'NewPassword!123');
    assert.equal(calls[1].url, '/api/auth/change-password');
    assert.equal(calls[1].init?.method, 'PATCH');
    assert.equal(new Headers(calls[1].init?.headers).get('Authorization'), 'Bearer password-change-token');
    assert.deepEqual(JSON.parse(String(calls[1].init?.body)), {
      currentPassword: 'temporary-password',
      otp: '123456',
      newPassword: 'NewPassword!123',
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (storage) Object.defineProperty(globalThis, 'sessionStorage', storage);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
    await server.close();
  }
});
