import { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { colors, Empty, riskLabel, type Tr } from "./DashboardCharts"
import type { EmployeeProfile, RiskAssessmentRecord } from "./metrics"

const button = "inline-flex min-h-8 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-40"

export type PriorityRow = {
  person: EmployeeProfile; assessment?: RiskAssessmentRecord; signals: string[]
}
export function PriorityTable({ rows, levelName, fmt, date, tr }: {
  rows: PriorityRow[]; levelName: (level: string) => string; fmt: (value: number) => string; date: (value: string) => string; tr: Tr
}) {
  const [page, setPage] = useState(1)
  const size = 6
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const current = Math.min(page, pages)
  if (!rows.length) return <div className="mt-4"><Empty>{tr("Chưa có nhân sự phù hợp trong phạm vi này.", "No employees match this selection.")}</Empty></div>
  return <>
    <div className="mt-4 overflow-x-auto rounded-xl border border-orange-200/80 bg-white shadow-sm">
      <table className="w-full min-w-[610px] text-left text-xs">
        <thead className="bg-gradient-to-r from-orange-100/80 to-amber-50 text-slate-700">
          <tr>{[
            tr("Nhân sự", "Employee"), tr("Phòng ban", "Department"), tr("Mức độ rủi ro", "Risk"),
            tr("Tín hiệu ghi nhận", "Observed signals"), tr("Thao tác", "Action"),
          ].map(label => <th key={label} className="px-3 py-2.5 font-semibold">{label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-orange-100/80">
          {rows.slice((current - 1) * size, current * size).map(({ person, assessment, signals }) => {
            const risk = assessment?.riskLevel ?? "UNASSESSED"
            return <tr key={person.id} className="transition-colors hover:bg-orange-50/70">
              <td className="max-w-48 px-3 py-3">
                <Link to={`/employees/${person.id}`} className="font-semibold leading-5 text-slate-900 hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-amber-400">{person.fullName}</Link>
                <p className="mt-0.5 text-slate-500">{person.code} · {levelName(person.level)}</p>
              </td>
              <td className="max-w-32 px-3 py-3 text-slate-600">{person.department || "—"}</td>
              <td className="px-3 py-3">
                <span className="inline-flex whitespace-nowrap rounded-full border px-2 py-1 font-medium text-slate-900 transition-colors duration-200 hover:text-slate-950" style={{ borderColor: colors[risk] + "77", background: colors[risk] + "22" }}>
                  {riskLabel(risk, tr)}{assessment && <span className="ml-1.5 tabular-nums">{fmt(assessment.riskScore * 100)}%</span>}
                </span>
                {assessment && <p className="mt-1 tabular-nums text-slate-500">{date(assessment.assessedAt)}</p>}
              </td>
              <td className="px-3 py-3">
                <div className="flex flex-wrap gap-1">
                  {signals.length ? signals.map(signal => <span key={signal} className="rounded-md bg-slate-100 px-1.5 py-1 text-slate-700">{signal}</span>) : <span className="text-slate-500">—</span>}
                </div>
              </td>
              <td className="px-3 py-3">
                <Link to={`/employees/${person.id}`} className={button}>{tr("Chi tiết", "Details")}<ArrowRight size={13} aria-hidden="true" /></Link>
              </td>
            </tr>
          })}
        </tbody>
      </table>
    </div>
    {pages > 1 && <nav aria-label={tr("Phân trang ưu tiên giữ chân", "Retention priorities pagination")} className="mt-3 flex items-center justify-end gap-2 text-xs text-slate-600">
      <button type="button" className={button} disabled={current === 1} onClick={() => setPage(current - 1)} aria-label={tr("Trang trước", "Previous page")}><ChevronLeft size={15} /></button>
      <span className="tabular-nums">{tr("Trang", "Page")} {current} / {pages}</span>
      <button type="button" className={button} disabled={current === pages} onClick={() => setPage(current + 1)} aria-label={tr("Trang sau", "Next page")}><ChevronRight size={15} /></button>
    </nav>}
  </>
}

export type PressureRow = { id: string; name: string; caption: string; hours: number; detail: string }
export function PressureList({ rows, unit, fmt, tr }: { rows: PressureRow[]; unit: string; fmt: (value: number) => string; tr: Tr }) {
  const max = Math.max(0, ...rows.map(row => row.hours))
  return <>
    <div className="mt-4">
      {rows.length ? <ol className="space-y-2">
        {rows.map((row, i) => <li key={row.id} className="flex items-start gap-2 rounded-xl border border-amber-100/90 bg-gradient-to-r from-white/95 to-amber-50/80 p-2.5 shadow-sm transition hover:border-amber-300">
          <span aria-hidden="true" className={`grid size-6 shrink-0 place-items-center rounded-md text-xs font-semibold ${i === 0 ? "bg-gradient-to-br from-orange-600 to-amber-500 text-white shadow-sm" : "bg-amber-100 text-amber-900"}`}>{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5 text-xs">
              <span className="font-semibold text-slate-900">{row.name}</span>
              <span className="whitespace-nowrap font-medium tabular-nums text-orange-700">{fmt(row.hours)} {unit}</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">{row.caption ? row.caption + " · " : ""}{row.detail}</p>
            <div className="mt-1.5 h-1.5 rounded-full bg-amber-100 shadow-inner" aria-hidden="true">
              <div className="h-full rounded-full bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-300" style={{ width: (max ? row.hours / max * 100 : 0) + "%" }} />
            </div>
          </div>
        </li>)}
      </ol> : <Empty>{tr("Chưa có dữ liệu chấm công trong phạm vi này.", "No attendance data in this selection.")}</Empty>}
    </div>
    <Link to="/attendance" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700 hover:text-orange-900 focus-visible:outline-2 focus-visible:outline-amber-400">
      {tr("Xem bảng chấm công đầy đủ", "View all attendance records")} <ArrowRight size={14} aria-hidden="true" />
    </Link>
  </>
}
