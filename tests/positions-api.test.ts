import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('five POS requests follow team BE contracts and hide inactive records', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const originalFetch = globalThis.fetch;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const position = { id: 4, code: 'POS004', name: 'Developer', jobLevel: 2, description: 'Team', status: 'ACTIVE' };
  let response = Response.json({ data: position });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => 'hr-token' } });
  globalThis.fetch = async (url, init) => { calls.push({ path: new URL(String(url), 'http://localhost').pathname, init }); return response; };
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts');
    response = Response.json({ data: [{ ...position, id: 1, status: 'INACTIVE' }, position] });
    const listed = await api.listPositions(undefined, { search: 'developer', limit: 1 });
    assert.deepEqual(listed.data.map(item => item.id), [4]);
    assert.equal(listed.pagination.has_more, false);
    assert.equal(calls.at(-1)?.path, '/api/positions');
    response = Response.json({ data: position });
    assert.equal((await api.getPositionById(4)).jobLevel, 2);
    assert.equal(calls.at(-1)?.path, '/api/positions/4');
    assert.equal(calls.at(-1)?.init?.body, undefined);
    const input = { name: 'Developer', jobLevel: 2, description: 'Team' };
    response = Response.json({ data: position }, { status: 201 });
    await api.createPosition(input);
    assert.equal(calls.at(-1)?.init?.method, 'POST');
    assert.equal(calls.at(-1)?.path, '/api/positions');
    assert.deepEqual(JSON.parse(String(calls.at(-1)?.init?.body)), input);
    response = Response.json({ data: { ...position, jobLevel: 4 } });
    await api.updatePosition(4, { jobLevel: 4 });
    assert.equal(calls.at(-1)?.init?.method, 'PATCH');
    assert.deepEqual(JSON.parse(String(calls.at(-1)?.init?.body)), { jobLevel: 4 });
    response = Response.json({ data: { ...position, status: 'INACTIVE' } });
    assert.equal((await api.deactivatePosition(4)).status, 'INACTIVE');
    assert.equal(calls.at(-1)?.path, '/api/positions/4');
    assert.equal(calls.at(-1)?.init?.method, 'DELETE');
    assert.equal(calls.at(-1)?.init?.body, undefined);
    for (const call of calls) {
      assert.equal(new Headers(call.init?.headers).get('Authorization'), 'Bearer hr-token');
      assert.equal(call.init?.credentials, 'include');
    }
    for (const status of [403, 404, 409]) {
      response = Response.json({ error: { message: 'Cannot deactivate a position that still has active employees.' } }, { status });
      await assert.rejects(api.deactivatePosition(4), (error: { status: number }) => error.status === status);
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
    await server.close();
  }
});
