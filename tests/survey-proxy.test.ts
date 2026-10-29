import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer, type Server } from 'node:http';
import { createServer } from 'vite';

test('survey and employee requests use the consolidated primary backend', async () => {
  const received: Array<{ backend: string; path?: string; authorization?: string }> = [];
  const backend = async (name: string) => {
    const server = createHttpServer((request, response) => {
      received.push({ backend: name, path: request.url, authorization: request.headers.authorization });
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ backend: name }));
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    return { server, url: `http://127.0.0.1:${address.port}` };
  };
  const close = (server: Server) => new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); });
  const primary = await backend('primary');
  const savedPrimary = process.env.VITE_BACKEND_URL;
  process.env.VITE_BACKEND_URL = primary.url;
  let vite: Awaited<ReturnType<typeof createServer>> | undefined;
  try {
    vite = await createServer({ server: { port: 0, open: false, watch: null, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } });
    await vite.listen();
    const address = vite.httpServer!.address();
    assert.ok(address && typeof address === 'object');
    for (const path of ['/api/surveys', '/api/surveys/7/results', '/api/surveys/available', '/api/employees/106']) {
      const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { headers: { Authorization: 'Bearer test-only-token' } });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { backend: 'primary' });
      assert.deepEqual(received.at(-1), { backend: 'primary', path, authorization: 'Bearer test-only-token' });
    }
  } finally {
    await vite?.close();
    await close(primary.server);
    if (savedPrimary === undefined) delete process.env.VITE_BACKEND_URL; else process.env.VITE_BACKEND_URL = savedPrimary;
  }
});
