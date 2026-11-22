import { useEffect, useMemo, useState } from "react"

import { Search, SlidersHorizontal, Sparkles, X } from "lucide-react"

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
  const [page, setPage] = useState(1)

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
    "Chọn nhân sự",
    "Đánh giá tình trạng gắn kết",
    "Xem kế hoạch hành động",
  ]

  return (
    <section
      className="overflow-hidden rounded-2xl border border-orange-100/80 bg-white shadow-sm"
      aria-labelledby="workspace-hub-heading"
    >
      <div className="relative overflow-hidden border-b border-orange-100/80 bg-gradient-to-r from-orange-50/90 via-amber-50/40 to-white p-6">
        <span
          className="pointer-events-none absolute -right-14 -top-16 size-48 rounded-full bg-orange-200/30 blur-3xl"
          aria-hidden
        />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full border border-orange-100 bg-white/80 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-orange-700 backdrop-blur-sm">
              <Sparkles className="size-3.5" />
              Không gian đánh giá nhân sự
            </p>
            <h2
              id="workspace-hub-heading"
              className="mt-3 text-2xl font-semibold tracking-tight text-slate-950"
            >
              Bắt đầu đánh giá gắn kết nhân sự
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">
              Chọn đúng nhân sự, đọc tín hiệu có căn cứ và xây dựng kế hoạch giữ
              chân từ dữ liệu hiện có.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
            {[
              ["Tổng nhân sự", employees.length],
              ["Phòng ban", departments.length],
              ["Đang làm việc", activeCount],
            ].map(([label, value]) => (
              <span
                key={String(label)}
                className="rounded-xl border border-white/80 bg-white/80 px-3 py-2 shadow-sm backdrop-blur-sm"
              >
                <span className="block text-[11px] font-medium text-slate-500">
                  {label}
                </span>
                <strong className="mt-0.5 block tabular-nums text-lg text-slate-950">
                  {value}
                </strong>
              </span>
            ))}
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap gap-2">
          {steps.map((step, index) => (
            <span
              key={step}
              className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 backdrop-blur-sm"
            >
              <span className="grid size-5 place-items-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-[10px] font-bold text-white">
                {index + 1}
              </span>
              {step}
            </span>
          ))}
        </div>
      </div>
      <div className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="metadata-label">Live directory</p>
            <h3 className="mt-1 font-semibold tracking-tight text-slate-900">
              Danh mục nhân viên
            </h3>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {filtered.length} hồ sơ phù hợp
          </span>
        </div>
        <div className="mt-4 grid gap-2 lg:grid-cols-[minmax(280px,1fr)_220px_180px_180px]">
          <label className="relative">
            <span className="sr-only">Tìm kiếm nhân viên</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              className="field h-11 w-full pl-9 pr-9"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Tìm tên, mã, phòng ban hoặc chức danh…"
            />
            {query && (
              <button
                type="button"
                aria-label="Xóa tìm kiếm"
                onClick={() => onQueryChange("")}
                className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-4" />
              </button>
            )}
          </label>
          <select
            className="field h-11"
            aria-label="Lọc theo phòng ban"
            value={department}
            onChange={(event) => onDepartmentChange(event.target.value)}
          >
            <option value="ALL">Tất cả phòng ban</option>
            {departments.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            className="field h-11"
            aria-label="Lọc theo trạng thái"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang làm việc</option>
            <option value="IN_PROCESS">Đang hoàn thiện</option>
            <option value="INACTIVE">Đã ngừng làm việc</option>
          </select>
          <label className="relative">
            <span className="sr-only">Sắp xếp</span>
            <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <select
              className="field h-11 w-full pl-9"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="NAME">Tên A–Z</option>
              <option value="CODE">Mã nhân viên</option>
              <option value="TENURE">Thâm niên cao nhất</option>
              <option value="DEPARTMENT">Phòng ban</option>
            </select>
          </label>
        </div>
        <div
          className="mt-3 flex gap-2 overflow-x-auto pb-1"
          aria-label="Lọc nhanh theo phòng ban"
        >
          <button
            type="button"
            onClick={() => onDepartmentChange("ALL")}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              department === "ALL"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            Tất cả ({employees.length})
          </button>
          {departments.map((name) => {
            const theme = getDepartmentTheme(name)
            return (
              <button
                key={name}
                type="button"
                onClick={() => onDepartmentChange(name)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  department === name
                    ? theme.active
                    : `${theme.badge} hover:shadow-sm`
                }`}
              >
                <span className={`size-1.5 rounded-full ${theme.dot}`} />
                {name} ({departmentCounts.get(name)})
              </button>
            )
          })}
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[780px] text-left">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Nhân viên</th>
                <th className="px-4 py-3">Phòng ban & Chức danh</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((item) => {
                const theme = getDepartmentTheme(item.departmentName)
                return (
                  <tr
                    key={item.id}
                    className="cursor-pointer bg-white transition hover:bg-orange-50/40"
                    onClick={() => onChoose(item)}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <span
                          className={`grid size-10 shrink-0 place-items-center rounded-full text-xs font-bold ${theme.avatar}`}
                        >
                          {getInitials(item.fullName)}
                        </span>
                        <span>
                          <strong className="block text-sm font-semibold text-slate-900">
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
                        {item.departmentName || "Chưa cập nhật"}
                      </span>
                      <span className="mt-1.5 block text-xs text-slate-500">
                        {item.positionName || "Chưa cập nhật chức danh"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
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
                        {employmentStatusLabel(item.employmentStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 transition hover:bg-orange-500 hover:text-white"
                      >
                        Chọn phân tích
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!rows.length && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-sm text-slate-500"
                  >
                    Không có nhân viên phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            Hiển thị {start}–{end} / {filtered.length} hồ sơ
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Trước
            </button>
            <span className="grid min-w-12 place-items-center rounded-lg bg-slate-900 px-2 font-semibold text-white">
              {safePage}/{pages}
            </span>
            <button
              type="button"
              disabled={safePage >= pages}
              onClick={() => setPage((value) => Math.min(pages, value + 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Sau
            </button>
          </div>
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
    avatar: "bg-indigo-100 text-indigo-700",
    dot: "bg-indigo-500",
    active: "border-indigo-500 bg-indigo-600 text-white",
    accent: "border-l-indigo-500",
    wash: "bg-gradient-to-r from-indigo-50/70 via-white to-white",
  },

  {
    badge: "border-teal-200/70 bg-teal-50 text-teal-700",
    avatar: "bg-teal-100 text-teal-700",
    dot: "bg-teal-500",
    active: "border-teal-500 bg-teal-600 text-white",
    accent: "border-l-teal-500",
    wash: "bg-gradient-to-r from-teal-50/70 via-white to-white",
  },

  {
    badge: "border-rose-200/70 bg-rose-50 text-rose-700",
    avatar: "bg-rose-100 text-rose-700",
    dot: "bg-rose-500",
    active: "border-rose-500 bg-rose-600 text-white",
    accent: "border-l-rose-500",
    wash: "bg-gradient-to-r from-rose-50/70 via-white to-white",
  },

  {
    badge: "border-amber-200/70 bg-amber-50 text-amber-700",
    avatar: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
    active: "border-amber-500 bg-amber-500 text-white",
    accent: "border-l-amber-500",
    wash: "bg-gradient-to-r from-amber-50/70 via-white to-white",
  },

  {
    badge: "border-emerald-200/70 bg-emerald-50 text-emerald-700",
    avatar: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
    active: "border-emerald-500 bg-emerald-600 text-white",
    accent: "border-l-emerald-500",
    wash: "bg-gradient-to-r from-emerald-50/70 via-white to-white",
  },

  {
    badge: "border-violet-200/70 bg-violet-50 text-violet-700",
    avatar: "bg-violet-100 text-violet-700",
    dot: "bg-violet-500",
    active: "border-violet-500 bg-violet-600 text-white",
    accent: "border-l-violet-500",
    wash: "bg-gradient-to-r from-violet-50/70 via-white to-white",
  },

  {
    badge: "border-cyan-200/70 bg-cyan-50 text-cyan-700",
    avatar: "bg-cyan-100 text-cyan-700",
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
