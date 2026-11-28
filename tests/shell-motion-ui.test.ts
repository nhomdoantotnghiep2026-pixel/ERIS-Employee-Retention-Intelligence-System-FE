import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8")

test("enterprise header uses the polished brand gradient, breadcrumbs and animated glass panels", async () => {
  const source = await read("src/components/EnterpriseHeader.tsx")

  assert.match(source, /from-orange-600 via-orange-500 to-amber-500/)
  assert.match(source, /border-orange-700\/25/)
  assert.match(source, /bg-white\/15/)
  assert.match(source, /backdrop-blur-sm/)
  assert.match(source, /breadcrumbItems/)
  assert.match(source, /AnimatePresence/)
  assert.match(source, /scale: 0\.96/)
})

test("sidebar prioritizes retention intelligence and keeps collapse controls inside the header", async () => {
  const source = await read("src/components/AppShell.tsx")

  const overview = source.indexOf("group: 'OVERVIEW'")
  const retention = source.indexOf("group: 'Employee Retention Intelligence'")
  const workforce = source.indexOf("group: 'WORKFORCE MANAGEMENT'")
  assert.ok(overview >= 0 && overview < retention && retention < workforce)
  assert.doesNotMatch(source, /absolute top-\[11px\]/)
  assert.match(source, /transition-\[width,transform\] duration-300 ease-in-out/)
  assert.match(source, /rounded-xl border border-slate-200\/80 bg-slate-100\/80/)
  assert.match(source, /after:content-\['K'\]/)
  assert.match(source, /event\.key\.toLowerCase\(\) !== 'k'/)
  assert.match(source, /from-orange-500 to-orange-600/)
})
