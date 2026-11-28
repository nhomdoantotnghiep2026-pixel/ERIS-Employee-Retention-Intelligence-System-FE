import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8")

test("work schedules uses a grid accordion, animated modal and weekly day pills", async () => {
  const source = await read("src/screens/WorkSchedules.tsx")

  assert.match(source, /AnimatePresence/)
  assert.match(source, /grid-rows-\[1fr\]/)
  assert.match(source, /grid-rows-\[0fr\]/)
  assert.match(source, /duration-\[250ms\]/)
  assert.match(source, /initial=\{\{ opacity: 0, scale: 0\.96/)
  assert.match(source, /aria-pressed=\{selected\}/)
  assert.match(source, /hover:-translate-y-0\.5/)
  assert.match(source, /listOpen \? 'overflow-visible' : 'overflow-hidden'/)
  assert.match(source, /focus-within:z-30/)
  assert.match(source, /role="menu"/)
})

test("employee directory humanizes the primary cell and transitions views", async () => {
  const source = await read("src/screens/HrEmployees.tsx")

  assert.match(source, /AnimatePresence mode="wait"/)
  assert.match(source, /x: '100%'/)
  assert.match(source, /damping: 28, stiffness: 320/)
  assert.match(source, /initials\(row\.fullName\)/)
  assert.match(source, /row\.email/)
  assert.match(source, /active:scale-\[0\.97\]/)
})

test("departments exposes headcount in a centered detail dialog", async () => {
  const [list, panel] = await Promise.all([
    read("src/screens/Departments.tsx"),
    read("src/screens/DepartmentPage.tsx"),
  ])

  assert.match(list, /headcountByDepartment/)
  assert.match(list, /left-1\/2 top-1\/2/)
  assert.match(list, /zoom-in-95/)
  assert.match(list, /zoom-out-95/)
  assert.match(panel, /providedHeadcount/)
  assert.match(panel, /Users size=\{14\}/)
})

test("positions unifies filters, tints levels and fades filter updates", async () => {
  const source = await read("src/screens/Positions.tsx")

  assert.match(source, /const levelTone/)
  assert.match(source, /rounded-md border border-slate-200 bg-slate-50\/70 p-3/)
  assert.match(source, /motion\.tbody/)
  assert.match(source, /transition-colors duration-150 hover:bg-slate-50\/80/)
  assert.match(source, /zoom-in-95/)
  assert.match(source, /zoom-out-95/)
})
