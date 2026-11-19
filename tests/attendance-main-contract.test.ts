import test from "node:test"
import assert from "node:assert/strict"
import { createServer } from "vite"
import { validScheduleTimeline } from "../src/utils/scheduleTimeline.ts"
test("shift timeline accepts overnight and rejects breaks outside the actual shift", () => {
  assert.equal(validScheduleTimeline("22:00", "06:00", "02:00", "03:00"), true)
  assert.equal(validScheduleTimeline("22:00", "06:00", null, null), true)
  assert.equal(validScheduleTimeline("22:00", "06:00", "21:00", "23:00"), false)
  assert.equal(validScheduleTimeline("08:00", "17:00", "12:00", "13:00"), true)
  assert.equal(validScheduleTimeline("08:00", "08:00", null, null), false)
  assert.equal(validScheduleTimeline("08:00", "17:00", null, "13:00"), false)
})
test("main attendance contract: stateless preview, explicit row decisions, fingerprint cancellation, owner endpoints and authenticated export", async () => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, ws: false },
  })
  const original = globalThis.fetch,
    storage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage")
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: { getItem: () => "fixture-token" },
  })
  const calls: Array<{ url: string; init?: RequestInit }> = []
  let response = Response.json({ status: "READY", rows: [], preview_token: "token", expires_in_seconds: 1800 })
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return response
  }
  try {
    const api = await server.ssrLoadModule("/src/services/attendance.ts")
    assert.equal(api.toLocalApiTime("2026-11-16T22:15"), "2026-11-16 22:15:00")
    assert.equal(
      api.toLocalApiTime("2026-11-16T22:15:09"),
      "2026-11-16 22:15:09",
    )
    const file = new File(["original bytes"], "source.xlsx")
    await api.previewAttendance(file)
    assert.equal(calls.at(-1)!.url, "/api/v1/attendance/import/preview")
    assert.equal(
      new Headers(calls.at(-1)!.init?.headers).has("Content-Type"),
      false,
    )
    assert.equal(
      await (calls.at(-1)!.init!.body as FormData).get("file")!.text(),
      "original bytes",
    )
    const choices = [{ excel_row: 4, work_date: "2026-11-16" }, { excel_row: 5, exclude: true }]
    await api.previewAttendance(file, choices)
    assert.deepEqual(JSON.parse(String((calls.at(-1)!.init!.body as FormData).get("options"))), { choices })
    await api.confirmAttendance(file, "preview-token", choices, true)
    assert.equal(calls.at(-1)!.url, "/api/v1/attendance/import/confirm")
    const confirmOptions = JSON.parse(String((calls.at(-1)!.init!.body as FormData).get("options")))
    assert.equal(confirmOptions.preview_token, "preview-token")
    assert.deepEqual(confirmOptions.choices, choices)
    const row = { id: "9007199254740995", record_fingerprint: "a".repeat(64) }
    await api.cancelAttendance(row, " why ")
    assert.equal(
      calls.at(-1)!.url,
      "/api/v1/attendance/9007199254740995/cancel",
    )
    assert.equal(calls.at(-1)!.init?.method, "PATCH")
    assert.deepEqual(JSON.parse(String(calls.at(-1)!.init?.body)), {
      expected_fingerprint: "a".repeat(64),
      reason: "why",
    })
    await api.fetchAttendance(
      { record_status: "CANCEL", offset: 20, limit: 20 },
      true,
    )
    assert.equal(
      calls.at(-1)!.url,
      "/api/v1/attendance/me?record_status=CANCEL&offset=20&limit=20",
    )
    response = new Response("xlsx bytes", {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    })
    assert.equal(
      await (await api.attendanceErrors(file, choices)).text(),
      "xlsx bytes",
    )
    assert.equal(
      new Headers(calls.at(-1)!.init?.headers).get("Authorization"),
      "Bearer fixture-token",
    )
    const batch = {
      status: "READY",
      preview_token: "token",
      expires_in_seconds: 1800,
      rows: [
        {
          excluded: false,
          validation_status: "WARNING",
          issues: [{ requires_resolution: true }],
        },
      ],
    }
    assert.equal(api.batchBlocked(batch), true)
    assert.equal(
      api.batchBlocked({
        ...batch,
        rows: [{ ...batch.rows[0], excluded: true }],
      }),
      false,
    )
    const scope = { from: "2026-11-01", to: "2026-11-15", employee_ids: [7, 9] }
    await api.previewAttendanceReconcile(scope)
    assert.equal(calls.at(-1)!.url, "/api/v1/attendance/reconcile/preview")
    assert.deepEqual(JSON.parse(String(calls.at(-1)!.init?.body)), { scope })
    await api.confirmAttendanceReconcile(scope, "reconcile-token", true)
    assert.equal(calls.at(-1)!.url, "/api/v1/attendance/reconcile/confirm")
    assert.deepEqual(JSON.parse(String(calls.at(-1)!.init?.body)), {
      scope,
      preview_token: "reconcile-token",
      confirm_warnings: true,
    })
  } finally {
    globalThis.fetch = original
    if (storage) Object.defineProperty(globalThis, "sessionStorage", storage)
    else Reflect.deleteProperty(globalThis, "sessionStorage")
    await server.close()
  }
})
test("leave contract uses catalogue IDs, the previewed file and a reasoned cancellation", async () => {
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
  const calls: Array<{ url: string; init?: RequestInit }> = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return Response.json({ data: [] })
  }
  try {
    const api = await server.ssrLoadModule("/src/services/attendance.ts")
    await api.fetchLeaveTypes()
    assert.equal(calls.at(-1)!.url, "/api/leave-types")
    const file = new File(["same csv"], "leave.csv")
    await api.previewLeaveFile(file)
    assert.equal(calls.at(-1)!.url, "/api/leave-records/import/preview")
    await api.confirmLeaveFile(file, "fingerprint")
    const body = calls.at(-1)!.init!.body as FormData
    assert.equal(body.get("fingerprint"), "fingerprint")
    assert.equal(await (body.get("file") as File).text(), "same csv")
    await api.cancelLeaveRecord(7, "Sai khoảng ngày nghỉ")
    assert.equal(calls.at(-1)!.url, "/api/leave-records/7/cancel")
    assert.deepEqual(JSON.parse(String(calls.at(-1)!.init?.body)), {
      reason: "Sai khoảng ngày nghỉ",
    })
    await api.fetchLeaveRecords({}, true)
    assert.equal(calls.at(-1)!.url, "/api/leave-records/me")
  } finally {
    globalThis.fetch = original
    if (storage) Object.defineProperty(globalThis, "sessionStorage", storage)
    else Reflect.deleteProperty(globalThis, "sessionStorage")
    await server.close()
  }
})
