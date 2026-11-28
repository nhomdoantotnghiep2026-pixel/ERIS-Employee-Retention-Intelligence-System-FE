import test from "node:test"
import assert from "node:assert/strict"
import { createServer } from "vite"
test("stale preview and attendance cancellation preserve conflict codes without automatic overwrite", async () => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, ws: false },
  })
  const original = globalThis.fetch,
    storage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage")
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: { getItem: () => null },
  })
  let count = 0,
    code = "STALE_PREVIEW"
  globalThis.fetch = async () => {
    count++
    return Response.json({ code, message: "Source changed" }, { status: 409 })
  }
  try {
    const a = await server.ssrLoadModule("/src/services/attendance.ts")
    await assert.rejects(
      a.confirmAttendance(new File(["file"], "attendance.xlsx"), "preview-token", [], false),
      (e: { code: string }) => e.code === "STALE_PREVIEW",
    )
    assert.equal(count, 1)
    code = "ATTENDANCE_CONFLICT"
    await assert.rejects(
      a.cancelAttendance({ id: 9 }, "Wrong source"),
      (e: { code: string }) => e.code === "ATTENDANCE_CONFLICT",
    )
    assert.equal(count, 2)
  } finally {
    globalThis.fetch = original
    if (storage) Object.defineProperty(globalThis, "sessionStorage", storage)
    else Reflect.deleteProperty(globalThis, "sessionStorage")
    await server.close()
  }
})
