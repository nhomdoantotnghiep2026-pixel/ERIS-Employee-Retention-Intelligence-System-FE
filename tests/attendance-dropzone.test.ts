import test from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

test("dropzone exposes separate native buttons: file picker and template download are never nested in a label", async () => {
  const server = await createServer({ configFile: false, appType: "custom", server: { middlewareMode: true, hmr: false, ws: false }, esbuild: { jsx: "automatic" } })
  try {
    const { LanguageProvider } = await server.ssrLoadModule("/src/context/LanguageContext.tsx")
    const { default: Dropzone } = await server.ssrLoadModule("/src/components/AttendanceFileDropzone.tsx")
    for (const busy of [false, true]) {
      const html = renderToStaticMarkup(React.createElement(LanguageProvider, { initialLanguage: "vi" }, React.createElement(Dropzone, { file: null, busy, onSelect: () => {} })))
      assert.equal((html.match(/<button\b/g) || []).length, 2)
      assert(!html.includes("<label"), "download must not become the label's implicit associated control")
      assert.match(html, /aria-label="Chọn tệp chấm công XLSX"/)
      assert.match(html, /<input[^>]*hidden=""[^>]*type="file"[^>]*accept="\.xlsx"/)
      assert.match(html, /Tải tệp mẫu/)
      const buttons = html.match(/<button\b[^>]*>/g)!
      assert.equal(buttons[0].includes('disabled=""'), busy)
      assert(!buttons[1].includes('disabled=""'), "template remains available while preview is busy")
    }
    const html = renderToStaticMarkup(React.createElement(LanguageProvider, { initialLanguage: "vi" }, React.createElement(Dropzone, { file: new File(["data"], "attendance.xlsx"), busy: false, onSelect: () => {} })))
    assert(html.includes("attendance.xlsx"))
  } finally { await server.close() }
})

test("shared template action downloads exactly the XLSX without submitting a form or invoking a file input", async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false } })
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document")
  const calls: string[] = []
  const anchor = { href: "", download: "", click() { calls.push("download") }, remove() { calls.push("remove") } }
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement(tag: string) { assert.equal(tag, "a"); return anchor }, body: { appendChild(element: unknown) { assert.equal(element, anchor); calls.push("append") } } } })
  try {
    const { downloadAttendanceTemplate } = await server.ssrLoadModule("/src/utils/attendanceTemplate.ts")
    downloadAttendanceTemplate()
    assert.equal(anchor.href, "/templates/ERIS_Attendance_Import_Template.xlsx")
    assert.equal(anchor.download, "ERIS_Attendance_Import_Template.xlsx")
    assert.deepEqual(calls, ["append", "download", "remove"])
  } finally {
    if (previous) Object.defineProperty(globalThis, "document", previous)
    else Reflect.deleteProperty(globalThis, "document")
    await server.close()
  }
})
