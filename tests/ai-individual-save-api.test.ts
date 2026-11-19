import test from "node:test"
import assert from "node:assert/strict"
import { createServer } from "vite"

test("individual prediction sends an explicit save choice in one request; history reads do not predict", async () => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, ws: false },
  })
  const originalFetch = globalThis.fetch
  const storage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage")
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: { getItem: () => null } })
  const calls: Array<{ url: string; init?: RequestInit }> = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return Response.json({ data: { saved: false } })
  }
  try {
    const api = await server.ssrLoadModule("/src/services/api.ts")
    for (const save of [false, true]) {
      calls.length = 0
      await api.predictAiEmployee(4, 9, save)
      assert.equal(calls.length, 1)
      assert.equal(calls[0].url, "/api/ai/employees/4/predict")
      assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
        snapshotId: 9,
        save,
      })
    }
    calls.length = 0
    await api.getAiResult(12)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, "/api/ai/results/12")
    assert.notEqual(calls[0].init?.method, "POST")
    calls.length = 0
    await api.listAiEmployeeResults(4)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, "/api/ai/employees/4/results")
    assert.notEqual(calls[0].init?.method, "POST")
    assert.equal(calls[0].init?.cache, "no-store")
  } finally {
    globalThis.fetch = originalFetch
    if (storage) Object.defineProperty(globalThis, "sessionStorage", storage)
    else Reflect.deleteProperty(globalThis, "sessionStorage")
    await server.close()
  }
})
