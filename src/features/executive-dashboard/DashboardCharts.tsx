import type { ReactNode } from "react"
import { useReducedMotion } from "motion/react"
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, Rectangle,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { ChartNoAxesCombined } from "lucide-react"
import { overtimeAxisTicks, percent, riskLevels, type OvertimeUnit, type RiskLevel } from "./metrics"

export type Tr = (vi: string, en: string) => string
export const colors: Record<RiskLevel, string> = { LOW: "#10B981", MEDIUM: "#F59E0B", HIGH: "#EF4444", UNASSESSED: "#CBD5E1" }
const riskGradient = {
  LOW: ["#34D399", "#059669", 1, 1],
  MEDIUM: ["#FBBF24", "#EA580C", 1, 1],
  HIGH: ["#FF4B72", "#D91B42", 1, 1],
  UNASSESSED: ["#F1F5F9", "#E2E8F0", 0.95, 0.7],
} as const
const departmentLabels: Record<string, string> = {
  "customer support": "CS / Hỗ trợ", marketing: "Marketing", finance: "Tài chính",
  it: "CNTT / IT", engineering: "Kỹ thuật", hr: "Nhân sự",
  legal: "Pháp chế", operations: "Vận hành", sales: "Kinh doanh",
}

function tickLines(label: string) {
  const size = 16
  const lines: string[] = []
  let line = ""
  for (const word of label.split(/\s+/)) {
    for (let index = 0; index < word.length; index += size) {
      const part = word.slice(index, index + size)
      if (line && line.length + part.length + 1 > size) {
        lines.push(line)
        line = ""
      }
      line = line ? line + " " + part : part
    }
  }
  if (line) lines.push(line)
  return lines
}

function RiskAxisTick({ x, y, lines, title }: { x: number; y: number; lines: string[]; title: string }) {
  return <g transform={`translate(${x},${y})`}>
    <title>{title}</title>
    <text textAnchor="middle" fill="#475569" className="text-[11px] font-semibold tracking-tight transition-colors hover:fill-orange-600">
      {lines.map((line, index) => <tspan key={index} x={0} dy={14}>{line}</tspan>)}
    </text>
  </g>
}

const topFirst = [...riskLevels].reverse()
const palette = [
  ["#2563EB", "#60A5FA"], ["#059669", "#34D399"], ["#D97706", "#FBBF24"],
  ["#7C3AED", "#A78BFA"], ["#E11D48", "#FB7185"], ["#0F766E", "#2DD4BF"], ["#64748B", "#CBD5E1"],
]
const contractColor: Record<string, number> = { FULL_TIME: 0, PART_TIME: 1, CONTRACT: 2, INTERNSHIP: 3, SEASONAL: 4 }
const grid = "#E2E8F0"
const tick = { fill: "#64748B", fontSize: 11 }
const tooltipStyle = { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 10, color: "#0F172A" }

export function riskLabel(level: RiskLevel, tr: Tr) {
  const labels: Record<RiskLevel, [string, string]> = {
    LOW: ["Ổn định", "Stable"],
    MEDIUM: ["Cần theo dõi", "Watchlist"],
    HIGH: ["Nguy cơ cao", "High risk"],
    UNASSESSED: ["Chưa đánh giá", "Unassessed"],
  }
  return tr(...labels[level])
}

export const bentoSurface = "relative min-w-0 overflow-hidden rounded-2xl border bg-white/95 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-all duration-300 hover:border-slate-300 hover:shadow-[0_12px_32px_-6px_rgba(15,23,42,0.1)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent"

export function Panel({ title, subtitle, children, className = "", headingIcon, headingTone }: { title: string; subtitle?: string; children: ReactNode; className?: string; headingIcon?: ReactNode; headingTone?: string }) {
  return <section className={`${bentoSurface} border-slate-200/90 p-4 sm:p-6 ${className}`}>
    <div className="flex items-center gap-2.5">
      {headingIcon && <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-md ${headingTone ?? ""}`}>{headingIcon}</span>}
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{subtitle}</p>}
      </div>
    </div>
    {children}
  </section>
}

export function Segments<T extends string>({ name, options, value, onChange }: {
  name: string; options: ReadonlyArray<readonly [T, string]>; value: T; onChange: (value: T) => void
}) {
  return <div role="group" aria-label={name} className="inline-flex max-w-full flex-wrap gap-0.5 rounded-xl border border-slate-200 bg-slate-100/90 p-1">
    {options.map(([key, label]) => <button type="button" key={key} aria-pressed={key === value} onClick={() => onChange(key)}
      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 ${key === value ? "bg-white font-semibold text-slate-800 shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-900"}`}>{label}</button>)}
  </div>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="grid min-h-36 place-content-center place-items-center gap-2 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-600">
    <ChartNoAxesCombined size={19} className="text-slate-500" aria-hidden="true" />{children}
  </div>
}

type RiskRow = { key: string; name: string; fullName: string; total: number } & Record<RiskLevel, number>
export function RiskChart({ rows, axis, asPercent, selected, onLevel, onGroup, tr }: {
  rows: RiskRow[]; axis: "department" | "level" | "workShift"; asPercent: boolean; selected: RiskLevel | null; onLevel: (level: RiskLevel) => void; onGroup: (key: string) => void; tr: Tr
}) {
  const reduceMotion = useReducedMotion()
  const originals = new Map(rows.map(row => [row.key, row]))
  const labels = new Map(rows.map(row => {
    const short = axis === "department" && tr("vi", "en") === "vi" ? departmentLabels[row.name.toLowerCase()] : undefined
    return [row.key, tickLines(short ?? row.name)]
  }))
  const axisHeight = Math.max(48, ...[...labels.values()].map(lines => lines.length * 14 + 12))
  const formatter = new Intl.NumberFormat(tr("vi-VN", "en-GB"), { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const plotted = rows.map(row => ({
    ...row,
    ...Object.fromEntries(riskLevels.map(level => [level, asPercent ? (percent(row[level], row.total) ?? 0) : row[level]])),
  }))
  return <>
    <div className="mb-2 mt-4 flex flex-wrap gap-1.5">
      {riskLevels.map(level => <button key={level} type="button" aria-pressed={selected === level} onClick={() => onLevel(level)}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-slate-800 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-amber-400 ${selected === level ? "border-orange-200 bg-orange-50" : "border-slate-200 hover:bg-slate-50"}`}>
        <span className="size-2 rounded-full" style={{ background: colors[level] }} aria-hidden="true" />{riskLabel(level, tr)}
      </button>)}
    </div>
    <div className="overflow-x-auto overscroll-x-contain" tabIndex={0} role="region" aria-label={tr("Biểu đồ rủi ro có thể cuộn ngang", "Horizontally scrollable risk chart")}>
    <div style={{ height: 194 + axisHeight, minWidth: rows.length * (axis === "workShift" ? 76 : 104) + 48 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={plotted} margin={{ left: 0, right: 7, top: 8 }}>
          <defs><filter id="dashboardRiskShadow" x="-24%" y="-16%" width="148%" height="144%"><feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#0F172A" floodOpacity={0.12} /></filter>{riskLevels.map(level => {
            const [start, end, opacityStart, opacityEnd] = riskGradient[level]
            return <linearGradient key={level} id={`dashboardRiskLight-${level}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={start} stopOpacity={opacityStart} /><stop offset="100%" stopColor={end} stopOpacity={opacityEnd} /></linearGradient>
          })}</defs>
          <CartesianGrid stroke={grid} vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="key" interval={0} height={axisHeight} tickLine={false} axisLine={{ stroke: "#CBD5E1", strokeWidth: 1 }}
            tick={({ x, y, payload }) => <RiskAxisTick x={Number(x)} y={Number(y)} lines={labels.get(payload.value) ?? []} title={originals.get(payload.value)?.fullName ?? ""} />} />
          <YAxis tick={tick} tickLine={false} axisLine={false} allowDecimals={false} domain={asPercent ? [0, 100] : [0, "auto"]} tickFormatter={n => asPercent ? n + "%" : n} />
          <Tooltip cursor={{ fill: "#E2E8F0", opacity: 0.35 }} content={({ active, payload }) => {
            const row = originals.get(payload?.[0]?.payload?.key)
            if (!active || !row) return null
            return <div className="w-52 max-w-[65vw] rounded-xl border border-slate-700/80 bg-slate-900/90 p-3 text-xs text-white shadow-2xl backdrop-blur-md">
              <p className="break-words font-semibold">{row.fullName}</p>
              <ul className="mt-2 space-y-1.5">{riskLevels.map(level => <li key={level} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: colors[level] }} />
                <span className="flex-1">{riskLabel(level, tr)}</span>
                <span className="whitespace-nowrap tabular-nums">{row[level]} · {formatter.format(percent(row[level], row.total) ?? 0)}%</span>
              </li>)}</ul>
            </div>
          }} />
          {riskLevels.map(level => <Bar key={level} dataKey={level} stackId="risk" fill={`url(#dashboardRiskLight-${level})`} maxBarSize={52}
            shape={({ x, y, width, height, payload }) => {
              const top = topFirst.find(key => Number(payload?.[key]) > 0)
              return <Rectangle x={x} y={y} width={width} height={height} fill={`url(#dashboardRiskLight-${level})`} radius={top === level ? [6, 6, 0, 0] : 0}
                stroke={level === "UNASSESSED" ? "#CBD5E1" : undefined} strokeDasharray={level === "UNASSESSED" ? "2 2" : undefined}
                filter={level === "UNASSESSED" ? undefined : "url(#dashboardRiskShadow)"} />
            }}
            className="cursor-pointer" isAnimationActive={!reduceMotion} animationDuration={1000} animationEasing="ease-out" onClick={(item) => { if (typeof item.payload?.key === "string") onGroup(item.payload.key) }} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
    </div>
  </>
}

export type TimelineRow = {
  label: string; span: string; hours: number; overtime: number; denominator: number | null; valid: number; late: number; early: number; lateRate: number | null; earlyRate: number | null
}
export function Timeline({ rows, unit, fmt, formatHours, tr }: { rows: TimelineRow[]; unit: OvertimeUnit; fmt: (value: number) => string; formatHours: (value: number) => string; tr: Tr }) {
  const reduceMotion = useReducedMotion()
  const ticks = overtimeAxisTicks(Math.max(0, ...rows.map(row => row.hours)), unit)
  const axisNumber = new Intl.NumberFormat(tr("vi-VN", "en-GB"), { maximumFractionDigits: 4 })
  const animation = { isAnimationActive: !reduceMotion, animationDuration: 550, animationEasing: "ease-out" as const }
  return <>
  <div aria-hidden="true" className="mt-3 flex justify-between gap-2 px-2 text-xs font-medium"><span className="text-blue-800">{unit === "total" ? tr("Giờ", "Hours") : tr("Giờ/người", "Hours/person")}</span><span className="text-slate-600">{tr("Tỷ lệ lượt (%)", "Attendance rate (%)")}</span></div>
  <div className="mt-1 h-56 min-w-0 rounded-xl border border-blue-100/90 bg-gradient-to-b from-white via-sky-50/60 to-blue-100/45 p-1 shadow-inner shadow-blue-100/70">
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <ComposedChart data={rows} margin={{ left: 0, right: 4, top: 8 }}>
        <defs><linearGradient id="executiveWorkloadGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563EB" stopOpacity={0.98} /><stop offset="52%" stopColor="#3B82F6" stopOpacity={0.85} /><stop offset="100%" stopColor="#60A5FA" stopOpacity={0.35} /></linearGradient></defs>
        <CartesianGrid stroke={grid} vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={14} />
        <YAxis yAxisId="hours" width={50} tick={tick} tickLine={false} axisLine={false} ticks={ticks} domain={[0, ticks[ticks.length - 1]]} tickFormatter={v => axisNumber.format(v) + "h"} />
        <YAxis yAxisId="rate" orientation="right" width={44} domain={[0, 100]} tick={tick} tickLine={false} axisLine={false} tickFormatter={v => v + "%"} />
        <Tooltip cursor={{ fill: "#E2E8F0", opacity: 0.35 }} content={({ payload }) => {
          const row = payload?.[0]?.payload as TimelineRow | undefined
          if (!row) return null
          return <div className="space-y-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-xl">
            <p className="font-semibold">{row.span}</p>
            <p>{tr("Tổng giờ tăng ca", "Total overtime")} · {formatHours(row.overtime)} {tr("giờ", "h")}</p>
            {row.denominator !== null && <p>{tr("Bình quân", "Average")} · {row.denominator ? `${formatHours(row.overtime)} / ${row.denominator} = ${formatHours(row.hours)} ${tr("giờ/người", "h/person")}` : tr("Không có người tăng ca", "No overtime workers")}</p>}
            <p>{tr("Đi trễ", "Late")} · {row.late}/{row.valid} ({row.lateRate === null ? "—" : fmt(row.lateRate) + "%"})</p>
            <p>{tr("Về sớm", "Early departure")} · {row.early}/{row.valid} ({row.earlyRate === null ? "—" : fmt(row.earlyRate) + "%"})</p>
          </div>
        }} />
        <Bar yAxisId="hours" dataKey="hours" fill="url(#executiveWorkloadGradient)" radius={[6, 6, 0, 0]} maxBarSize={32} {...animation} />
        <Line yAxisId="rate" type="monotone" dataKey="lateRate" stroke="#E11D48" strokeWidth={2.5} dot={{ r: 3.5, fill: "#E11D48", stroke: "#FFF", strokeWidth: 1.5 }} activeDot={{ r: 5 }} {...animation} />
        <Line yAxisId="rate" type="monotone" dataKey="earlyRate" stroke="#D97706" strokeWidth={2.5} dot={{ r: 3.5, fill: "#D97706", stroke: "#FFF", strokeWidth: 1.5 }} activeDot={{ r: 5 }} {...animation} />
      </ComposedChart>
    </ResponsiveContainer>
  </div></>
}

export function TeamDonut({ groups, total, fmt, tr }: { groups: { key: string; name: string; value: number }[]; total: number; fmt: (value: number) => string; tr: Tr }) {
  const reduceMotion = useReducedMotion()
  const segments = groups.map((item, index) => ({ ...item, color: contractColor[item.key] ?? index % palette.length }))
  return <div className="mt-4 grid items-center gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
    <div className="relative mx-auto size-40 rounded-full bg-gradient-to-br from-white via-indigo-50 to-sky-100/85 ring-1 ring-indigo-200/55 shadow-[0_9px_28px_-16px_rgba(37,99,235,.8)]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart><defs>{palette.map(([start, end], index) => <linearGradient key={index} id={`dashboardDonutLight-${index}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={start} /><stop offset="100%" stopColor={end} /></linearGradient>)}</defs><Pie data={segments} dataKey="value" nameKey="name" innerRadius="65%" outerRadius="95%" paddingAngle={groups.length > 1 ? 2 : 0} stroke="none" isAnimationActive={!reduceMotion} animationDuration={1000} animationEasing="ease-out">
          {segments.map(group => <Cell key={group.key} fill={`url(#dashboardDonutLight-${group.color})`} />)}
        </Pie><Tooltip contentStyle={tooltipStyle} /></PieChart>
      </ResponsiveContainer>
      <span className="pointer-events-none absolute inset-[23%] grid place-content-center rounded-full border border-slate-200/80 bg-gradient-to-b from-white to-slate-50 text-center shadow-inner"><strong className="text-2xl font-bold text-slate-900">{total}</strong><span className="text-xs text-slate-600">{tr("nhân sự", "employees")}</span></span>
    </div>
    <ul className="grid gap-2 text-xs">
      {segments.map(group => <li key={group.key} className="rounded-lg border border-indigo-100 bg-white/90 px-2.5 py-2 shadow-sm">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="size-2 shrink-0 rounded-full" style={{ background: palette[group.color][0] }} aria-hidden="true" />
          <span className="min-w-0 flex-1 break-words font-medium text-slate-800">{group.name}</span>
          <span className="whitespace-nowrap font-medium tabular-nums text-slate-600">{group.value} · {fmt(percent(group.value, total) ?? 0)}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-indigo-50" aria-hidden="true">
          <div className="h-full rounded-full" style={{ width: (percent(group.value, total) ?? 0) + "%", backgroundImage: `linear-gradient(90deg, ${palette[group.color].join(", ")})` }} />
        </div>
      </li>)}
    </ul>
  </div>
}
