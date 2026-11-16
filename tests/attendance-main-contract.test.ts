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
test("main attendance contract: preview only, explicit row decisions, versioned mutations, owner endpoints and authenticated export", async () => {
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
  let response = Response.json({ batch_id: "batch", rows: [] })
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
    await api.resolveAttendanceRow("batch", 4, { work_date: "2026-11-16" })
    assert.equal(calls.at(-1)!.url, "/api/v1/attendance/import/batch/rows/4")
    assert.deepEqual(JSON.parse(String(calls.at(-1)!.init?.body)), {
      work_date: "2026-11-16",
    })
    await api.resolveAttendanceRow("batch", 5, { exclude: true })
    const decision = {
      duplicate_strategy: "SKIP",
      confirm_warnings: true,
      updates: [{ excel_row: 4, action: "UPDATE", reason: "Correct source" }],
    }
    await api.confirmAttendance("batch", decision)
    assert.equal(calls.at(-1)!.url, "/api/v1/attendance/import/batch/confirm")
    assert.deepEqual(JSON.parse(String(calls.at(-1)!.init?.body)), decision)
    const row = { id: "9007199254740995", version: "12" }
    await api.mutateAttendance(row, "CANCEL", " why ")
    assert.equal(
      calls.at(-1)!.url,
      "/api/v1/attendance/9007199254740995/cancel",
    )
    assert.equal(calls.at(-1)!.init?.method, "PATCH")
    assert.deepEqual(JSON.parse(String(calls.at(-1)!.init?.body)), {
      expected_version: "12",
      reason: "why",
    })
    await api.mutateAttendance(row, "UPDATE", "Correction", {
      check_in: "2026-11-16 22:15:00",
      check_out: "2026-11-17 06:10:00",
    })
    const edit = JSON.parse(String(calls.at(-1)!.init?.body))
    assert.equal(edit.check_out, "2026-11-17 06:10:00")
    assert.equal("working_minutes" in edit, false)
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
      await (await api.attendanceErrors("batch")).text(),
      "xlsx bytes",
    )
    assert.equal(
      new Headers(calls.at(-1)!.init?.headers).get("Authorization"),
      "Bearer fixture-token",
    )
    const batch = {
      expired: false,
      status: "READY",
      expires_at: "2099-01-01",
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
    assert.equal(
      api.batchBlocked({ ...batch, status: "CONFIRMED", rows: [] }),
      true,
    )
  } finally {
    globalThis.fetch = original
    if (storage) Object.defineProperty(globalThis, "sessionStorage", storage)
    else Reflect.deleteProperty(globalThis, "sessionStorage")
    await server.close()
  }
})
test("leave contract uses catalogue IDs, same previewed file and fingerprint; edit never moves employee", async () => {
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
    await api.updateLeaveRecord(7, {
      employee_id: 9,
      leave_type_id: 3,
      start_date: "2026-11-16",
      end_date: "2026-11-17",
      reason: null,
    })
    assert.equal(calls.at(-1)!.url, "/api/leave-records/7")
    assert.equal(
      "employee_id" in JSON.parse(String(calls.at(-1)!.init?.body)),
      false,
    )
    await api.transitionLeaveRecord(7, "restore")
    assert.equal(calls.at(-1)!.url, "/api/leave-records/7/restore")
    await api.fetchLeaveRecords({}, true)
    assert.equal(calls.at(-1)!.url, "/api/leave-records/me")
  } finally {
    globalThis.fetch = original
    if (storage) Object.defineProperty(globalThis, "sessionStorage", storage)
    else Reflect.deleteProperty(globalThis, "sessionStorage")
    await server.close()
  }
})
