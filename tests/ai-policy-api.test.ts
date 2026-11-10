import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('AI policy preview and save use the saved prediction and preserve draft policies', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const previousFetch = globalThis.fetch;
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => 'test-token' } });
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({ data: { predictionId: 42, recommendations: [{ policy: null, policyDraft: { name: 'Draft' }, status: 'AWAITING_POLICY_APPROVAL' }], saved: JSON.parse(String(init?.body)).save } });
  };
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts');
    for (const save of [false, true]) {
      const result = await api.generateAiPolicyRecommendations(42, save, 5);
      assert.equal(calls.at(-1)!.url, '/api/ai/results/42/policy-recommendations');
      assert.equal(calls.at(-1)!.init?.method, 'POST');
      assert.deepEqual(JSON.parse(String(calls.at(-1)!.init?.body)), { save, limit: 5 });
      assert.equal(new Headers(calls.at(-1)!.init?.headers).get('Authorization'), 'Bearer test-token');
      assert.equal(result.data.recommendations[0].status, 'AWAITING_POLICY_APPROVAL');
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (storage) Object.defineProperty(globalThis, 'sessionStorage', storage); else Reflect.deleteProperty(globalThis, 'sessionStorage');
    await server.close();
  }
});
