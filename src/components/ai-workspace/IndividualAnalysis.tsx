import { useAiTr } from "./aiWorkspaceLanguage"
import { useEffect, useMemo, useState } from "react"

import { ArrowRight, Search, SlidersHorizontal, Sparkles, X } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { Button } from "../ui/button"
import { SelectControl } from "../ui/select-control"

import { type AiEmployee } from "../../services/api"

import { UnifiedWorkspace } from "./UnifiedWorkspace"

type Sel = {
  employeeId?: number
  resultId?: number
}

export function IndividualAnalysis({
  employees,
  initial,
  onSelectionChange,
  onResultAvailabilityChange,
}: {
  employees: AiEmployee[]
  initial: Sel
  onSelectionChange: (s: Sel) => void
  onResultAvailabilityChange?: (available: boolean) => void
}) {
  const [id, setId] = useState(initial.employeeId)

  const [query, setQuery] = useState(""),
    [department, setDepartment] = useState("ALL")

  const employee = employees.find((item) => item.id === id)

  function choose(id?: number) {
    setId(id)
    onSelectionChange({ employeeId: id })
    onResultAvailabilityChange?.(false)
  }

  return employee ? (
    <UnifiedWorkspace
      key={employee.id}
      employee={employee}
      employees={employees}
      onChoose={choose}
      onBack={() => choose()}
      onResult={onResultAvailabilityChange}
    />
  ) : (
    <WorkspaceHub
      employees={employees}
      query={query}
      onQueryChange={setQuery}
      department={department}
      onDepartmentChange={setDepartment}
      onChoose={(item) => choose(item.id)}
    />
  )
}

function employmentStatusLabel(value?: string | null) {
  return value === "ACTIVE"
    ? "Đang làm việc"
    : value === "INACTIVE"
      ? "Đã ngừng làm việc"
      : value === "IN_PROCESS"
        ? "Đang hoàn thiện hồ sơ"
        : "Chưa xác định"
}

function WorkspaceHub({
  employees,
  query,
  onQueryChange,
  department,
  onDepartmentChange,
  onChoose,
}: {
  employees: AiEmployee[]
  query: string
  onQueryChange: (value: string) => void
  department: string
  onDepartmentChange: (value: string) => void
  onChoose: (employee: AiEmployee) => void
}) {
  const tr = useAiTr()
  const [page, setPage] = useState(1)
  const reduceMotion = useReducedMotion()

  const [status, setStatus] = useState("ALL")

  const [sort, setSort] = useState("NAME")

  const pageSize = 7

  const departments = useMemo(
    () =>
      [
        ...new Set(
          employees
            .map((item) => item.departmentName)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort((a, b) => a.localeCompare(b, "vi")),
    [employees],
  )

  const departmentCounts = useMemo(
    () =>
      new Map(
        departments.map((name) => [
          name,
          employees.filter((item) => item.departmentName === name).length,
        ]),
      ),
    [departments, employees],
  )

  useEffect(() => setPage(1), [department, query, sort, status])

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("vi-VN")

    return employees

      .filter(
        (item) =>
          (department === "ALL" || item.departmentName === department) &&
          (status === "ALL" ||
            (status === "ACTIVE"
              ? item.employmentStatus === "ACTIVE"
              : item.employmentStatus === status)) &&
          (!needle ||
            `${item.employeeCode} ${item.fullName} ${item.departmentName ?? ""} ${item.positionName ?? ""}`
              .toLocaleLowerCase("vi-VN")
              .includes(needle)),
      )

      .sort((a, b) =>
        sort === "CODE"
          ? a.employeeCode.localeCompare(b.employeeCode, "vi", {
              numeric: true,
            })
          : sort === "DEPARTMENT"
            ? `${a.departmentName ?? ""} ${a.fullName}`.localeCompare(
                `${b.departmentName ?? ""} ${b.fullName}`,
                "vi",
              )
            : sort === "TENURE"
              ? Date.parse(a.hireDate ?? "9999-12-31") -
                Date.parse(b.hireDate ?? "9999-12-31")
            : a.fullName.localeCompare(b.fullName, "vi"),
      )
  }, [department, employees, query, sort, status])

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))

  const safePage = Math.min(page, pages)

  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const start = filtered.length ? (safePage - 1) * pageSize + 1 : 0

  const end = Math.min(safePage * pageSize, filtered.length)

  const activeCount = employees.filter(
    (item) => item.employmentStatus === "ACTIVE",
  ).length

  const steps = [
    tr("Chọn nhân sự"),
    tr("Đánh giá tình trạng gắn kết"),
    tr("Xem kế hoạch hành động"),
  ]

  return (
    <section
      className="overflow-hidden rounded-2xl border border-orange-100/80 bg-white shadow-sm"
      aria-labelledby="workspace-hub-heading"
    >
      <div className="relative overflow-hidden border-b border-orange-100/80 bg-gradient-to-r from-orange-50/90 via-amber-50/40 to-white px-5 py-4 sm:px-6">
        <span
          className="pointer-events-none absolute -right-14 -top-16 size-48 rounded-full bg-orange-200/30 blur-3xl"
          aria-hidden
        />
        <div className="relative grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-orange-100 bg-white/80 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-orange-700 backdrop-blur-sm">
              <Sparkles className="size-3.5" />
              {tr("Không gian đánh giá nhân sự")}
            </p>
            <h2
              id="workspace-hub-heading"
              className="mt-2 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl"
            >
              {tr("Bắt đầu đánh giá gắn kết nhân sự")}
            </h2>
            <p className="mt-1 text-sm leading-5 text-slate-600">
              {tr("Chọn đúng nhân sự, đọc tín hiệu có căn cứ và xây dựng kế hoạch giữ chân từ dữ liệu hiện có.")}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {steps.map((step, index) => (
                <span key={step} className="inline-flex items-center gap-1.5 rounded-full border border-orange-100 bg-white/75 px-2.5 py-1 text-xs font-medium text-slate-700 backdrop-blur-sm">
                  <span className="grid size-5 place-items-center rounded-full bg-orange-500 text-[11px] font-bold text-white">{index + 1}</span>
                  {tr(step)}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 xl:min-w-[300px]">
            {[
              [tr("Tổng nhân sự"), employees.length],
              [tr("Phòng ban"), departments.length],
              [tr("Đang làm việc"), activeCount],
            ].map(([label, value]) => (
              <span
                key={String(label)}
                className="rounded-xl border border-white/90 bg-white/70 px-2.5 py-2 shadow-sm ring-1 ring-orange-100/50 backdrop-blur-sm"
              >
                <span className="block text-xs font-medium text-slate-600">
                  {tr(String(label))}
                </span>
                <strong className="mt-0.5 block tabular-nums text-lg text-slate-950">
                  {value}
                </strong>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="metadata-label">{tr("Danh mục nhân sự")}</p>
            <h3 className="mt-1 font-semibold tracking-tight text-slate-900">
              {tr("Danh mục nhân viên")}
            </h3>
          </div>
          <span role="status" className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold tabular-nums text-slate-700">
            {filtered.length} {tr("hồ sơ phù hợp")}
          </span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(280px,1fr)_190px_200px]">
          <label className="block sm:col-span-2 lg:col-span-1">
            <span className="sr-only">{tr("Tìm kiếm nhân viên")}</span>
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-11 w-full rounded-md border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder={tr("Tìm tên, mã, phòng ban hoặc chức danh…")}
              />
              {query && (
                <button type="button" aria-label={tr("Xóa tìm kiếm")} onClick={() => onQueryChange("")} className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-orange-500">
                  <X className="size-4" />
                </button>
              )}
            </div>
          </label>
          <SelectControl
            aria-label={tr("Lọc theo trạng thái")}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="ALL">{tr("Tất cả trạng thái")}</option>
            <option value="ACTIVE">{tr("Đang làm việc")}</option>
            <option value="IN_PROCESS">{tr("Đang hoàn thiện")}</option>
            <option value="INACTIVE">{tr("Đã ngừng làm việc")}</option>
          </SelectControl>
          <label className="block">
            <span className="sr-only">{tr("Sắp xếp")}</span>
            <SelectControl
              prefixIcon={<SlidersHorizontal className="size-4" />}
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="NAME">{tr("Tên A–Z")}</option>
              <option value="CODE">{tr("Mã nhân viên")}</option>
              <option value="TENURE">{tr("Thâm niên cao nhất")}</option>
              <option value="DEPARTMENT">{tr("Phòng ban")}</option>
            </SelectControl>
          </label>
        </div>
        <div
          className="mt-3 flex gap-2 overflow-x-auto pb-1"
          aria-label={tr("Lọc nhanh theo phòng ban")}
        >
          <motion.button
            type="button"
            onClick={() => onDepartmentChange("ALL")}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            aria-pressed={department === "ALL"}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 ${
              department === "ALL"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {tr("Tất cả (")}{employees.length})
          </motion.button>
          {departments.map((name) => {
            const theme = getDepartmentTheme(name)
            return (
              <motion.button
                key={name}
                type="button"
                onClick={() => onDepartmentChange(name)}
                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                aria-pressed={department === name}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 ${
                  department === name
                    ? theme.active
                    : `${theme.badge} hover:shadow-sm`
                }`}
              >
                <span className={`size-1.5 rounded-full ${theme.dot}`} />
                {name} ({departmentCounts.get(name)})
              </motion.button>
            )
          })}
        </div>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <table className="w-full min-w-[780px] text-left">
            <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3">{tr("Nhân viên")}</th>
                <th className="px-4 py-3">{tr("Phòng ban & Chức danh")}</th>
                <th className="px-4 py-3">{tr("Thâm niên & Trạng thái")}</th>
                <th className="px-4 py-3 text-right">{tr("Thao tác")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((item, index) => {
                const theme = getDepartmentTheme(item.departmentName)
                return (
                  <motion.tr
                    key={item.id}
                    initial={reduceMotion ? false : "hidden"}
                    animate="visible"
                    variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }}
                    transition={{ duration: reduceMotion ? 0 : 0.2, delay: reduceMotion ? 0 : index * 0.025 }}
                    className="group cursor-pointer bg-white transition-colors duration-200 hover:bg-orange-50/40 focus-visible:bg-orange-50/60 focus-visible:outline-2 focus-visible:outline-orange-500"
                    onClick={() => onChoose(item)}
                    tabIndex={0}
                    onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onChoose(item) } }}
                    aria-label={`${tr("Chọn")} ${item.fullName} ${tr("để phân tích")}`}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <span
                          className={`grid size-10 shrink-0 place-items-center rounded-full text-xs font-bold ${theme.avatar}`}
                        >
                          {getInitials(item.fullName)}
                        </span>
                        <span>
                          <strong className="block text-sm font-semibold text-slate-950">
                            {item.fullName}
                          </strong>
                          <span className="font-mono text-xs text-slate-500">
                            {item.employeeCode}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${theme.badge}`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${theme.dot}`}
                        />
                        {item.departmentName || tr("Chưa cập nhật")}
                      </span>
                      <span className="mt-1.5 block text-xs text-slate-500">
                        {item.positionName || tr("Chưa cập nhật chức danh")}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="mb-2 text-xs font-medium text-slate-700">{formatTenure(item.hireDate, tr)}</p>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          item.employmentStatus === "INACTIVE"
                            ? "bg-slate-100 text-slate-600"
                            : item.employmentStatus === "IN_PROCESS"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            item.employmentStatus === "INACTIVE"
                              ? "bg-slate-400"
                              : item.employmentStatus === "IN_PROCESS"
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                          }`}
                        />
                        {tr(employmentStatusLabel(item.employmentStatus))}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Button type="button" variant="outline" onClick={(event) => { event.stopPropagation(); onChoose(item) }} className="min-h-9 rounded-md border-orange-200 bg-white px-3 text-xs font-semibold text-orange-700 transition-all duration-200 hover:border-orange-500 hover:bg-orange-500 hover:text-white group-hover:border-orange-500 group-hover:bg-orange-500 group-hover:text-white focus-visible:ring-2 focus-visible:ring-orange-500/30">{tr("Chọn phân tích")} <ArrowRight className="size-3.5" /></Button>
                    </td>
                  </motion.tr>
                )
              })}
              {!rows.length && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-sm text-slate-600"
                  >
                    {tr("Không có nhân viên phù hợp với bộ lọc hiện tại.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <span className="tabular-nums">
            {tr("Hiển thị")} {start}–{end} / {filtered.length} {tr("hồ sơ")}
          </span>
          <nav aria-label={tr("Phân trang danh mục nhân viên")} className="flex items-center gap-2">
            <Button
              type="button" variant="outline"
              disabled={safePage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="min-h-9 rounded-md border-slate-200 px-3 font-semibold text-slate-700 hover:border-orange-300 hover:bg-orange-50 disabled:opacity-40"
            >
              {tr("Trước")}
            </Button>
            <span aria-current="page" className="grid min-h-9 min-w-12 place-items-center rounded-md bg-slate-900 px-2 text-xs font-semibold tabular-nums text-white">
              {safePage}/{pages}
            </span>
            <Button
              type="button" variant="outline"
              disabled={safePage >= pages}
              onClick={() => setPage((value) => Math.min(pages, value + 1))}
              className="min-h-9 rounded-md border-slate-200 px-3 font-semibold text-slate-700 hover:border-orange-300 hover:bg-orange-50 disabled:opacity-40"
            >
              Sau
            </Button>
          </nav>
        </div>
      </div>
    </section>
  )
}

function getInitials(name?: string) {
  if (!name) return "—"

  const parts = name.trim().split(/\s+/)

  return `${parts.at(-2)?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase()
}

function formatTenure(hireDate: string | null | undefined, tr: (copy: string) => string) {
  if (!hireDate) return tr("Thâm niên: —")
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(hireDate)
  if (!match) return tr("Thâm niên: —")
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  const now = new Date()
  const months = (now.getFullYear() - year) * 12 + now.getMonth() + 1 - month - (now.getDate() < day ? 1 : 0)
  if (months < 0) return `${tr("Vào làm:")} ${match[3]}/${match[2]}/${match[1]}`
  return months >= 12 ? `${tr("Thâm niên:")} ${Math.floor(months / 12)} ${tr("năm")}` : `${tr("Thâm niên:")} ${months} ${tr("tháng")}`
}

type DepartmentTheme = {
  badge: string
  avatar: string
  dot: string
  active: string
  accent: string
  wash: string
}

const departmentThemes: DepartmentTheme[] = [
  {
    badge: "border-indigo-200/70 bg-indigo-50 text-indigo-700",
    avatar: "bg-gradient-to-br from-indigo-50 to-indigo-200 text-indigo-800",
    dot: "bg-indigo-500",
    active: "border-indigo-500 bg-indigo-600 text-white",
    accent: "border-l-indigo-500",
    wash: "bg-gradient-to-r from-indigo-50/70 via-white to-white",
  },

  {
    badge: "border-teal-200/70 bg-teal-50 text-teal-700",
    avatar: "bg-gradient-to-br from-teal-50 to-teal-200 text-teal-800",
    dot: "bg-teal-500",
    active: "border-teal-500 bg-teal-600 text-white",
    accent: "border-l-teal-500",
    wash: "bg-gradient-to-r from-teal-50/70 via-white to-white",
  },

  {
    badge: "border-rose-200/70 bg-rose-50 text-rose-700",
    avatar: "bg-gradient-to-br from-rose-50 to-rose-200 text-rose-800",
    dot: "bg-rose-500",
    active: "border-rose-500 bg-rose-600 text-white",
    accent: "border-l-rose-500",
    wash: "bg-gradient-to-r from-rose-50/70 via-white to-white",
  },

  {
    badge: "border-amber-200/70 bg-amber-50 text-amber-700",
    avatar: "bg-gradient-to-br from-amber-50 to-amber-200 text-amber-900",
    dot: "bg-amber-500",
    active: "border-amber-500 bg-amber-500 text-white",
    accent: "border-l-amber-500",
    wash: "bg-gradient-to-r from-amber-50/70 via-white to-white",
  },

  {
    badge: "border-emerald-200/70 bg-emerald-50 text-emerald-700",
    avatar: "bg-gradient-to-br from-emerald-50 to-emerald-200 text-emerald-800",
    dot: "bg-emerald-500",
    active: "border-emerald-500 bg-emerald-600 text-white",
    accent: "border-l-emerald-500",
    wash: "bg-gradient-to-r from-emerald-50/70 via-white to-white",
  },

  {
    badge: "border-violet-200/70 bg-violet-50 text-violet-700",
    avatar: "bg-gradient-to-br from-violet-50 to-violet-200 text-violet-800",
    dot: "bg-violet-500",
    active: "border-violet-500 bg-violet-600 text-white",
    accent: "border-l-violet-500",
    wash: "bg-gradient-to-r from-violet-50/70 via-white to-white",
  },

  {
    badge: "border-cyan-200/70 bg-cyan-50 text-cyan-700",
    avatar: "bg-gradient-to-br from-cyan-50 to-cyan-200 text-cyan-800",
    dot: "bg-cyan-500",
    active: "border-cyan-500 bg-cyan-600 text-white",
    accent: "border-l-cyan-500",
    wash: "bg-gradient-to-r from-cyan-50/70 via-white to-white",
  },
]

function getDepartmentTheme(departmentName?: string | null): DepartmentTheme {
  const normalized = (departmentName ?? "").trim().toLocaleLowerCase("vi-VN")

  if (/\bit\b|engineer|kỹ thuật|công nghệ|software/.test(normalized))
    return departmentThemes[0]

  if (/support|operation|vận hành|chăm sóc|hỗ trợ/.test(normalized))
    return departmentThemes[1]

  if (/marketing|tiếp thị/.test(normalized)) return departmentThemes[2]

  if (/sales|kinh doanh/.test(normalized)) return departmentThemes[3]

  if (/finance|account|tài chính|kế toán/.test(normalized))
    return departmentThemes[4]

  if (/\bhr\b|human|nhân sự|admin|hành chính/.test(normalized))
    return departmentThemes[5]

  const hash = [...normalized].reduce(
    (total, character) => (total * 31 + character.charCodeAt(0)) >>> 0,
    0,
  )

  return departmentThemes[hash % departmentThemes.length]
}
