import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('network failures have an actionable message and cancelled requests stay cancelled', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const originalFetch = globalThis.fetch;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => null } });
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts');
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    await assert.rejects(api.getCurrentUser(), error => {
      assert.equal(error.code, 'NETWORK_ERROR');
      assert.match(api.getApiErrorMessage(error, ''), /backend/);
      return true;
    });
    const controller = new AbortController(); controller.abort();
    const cancelled = new DOMException('Cancelled', 'AbortError');
    globalThis.fetch = async () => { throw cancelled; };
    await assert.rejects(api.getEmployeeProfile(1, controller.signal), error => error === cancelled);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
    await server.close();
  }
});

test('refresh sends cookies and stores the replacement access token', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const originalFetch = globalThis.fetch;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const values = new Map<string, string>([['eris-access-token', 'expired-token']]);
  let call: { url: string; init?: RequestInit } | undefined;
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } });
  globalThis.fetch = async (url, init) => {
    call = { url: String(url), init };
    return Response.json({ accessToken: 'fresh-token' });
  };
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts');
    await api.refreshSession();
    assert.match(call?.url || '', /\/api\/auth\/refresh$/);
    assert.equal(call?.init?.method, 'POST');
    assert.equal(call?.init?.credentials, 'include');
    assert.equal(values.get('eris-access-token'), 'fresh-token');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
    await server.close();
  }
});

test('session restore uses the current access token before refreshing', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const originalFetch = globalThis.fetch;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const calls: string[] = [];
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: () => 'current-access-token',
    setItem: () => undefined,
  } });
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return Response.json({ id: 1, email: 'admin@eris.test', status: 'ACTIVE' });
  };
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts');
    await api.restoreSession();
    assert.equal(calls.length, 1);
    assert.match(calls[0], /\/api\/auth\/me$/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
    await server.close();
  }
});
