import type { ReactNode } from "react"

import { progressTone } from "./surveyUtils"

type SurveyKpiCardProps = {
  label: string
  value: string
  note: string
  icon: ReactNode
  tone: "emerald" | "blue" | "orange" | "violet"
  pulse?: boolean
  progress?: number
}

const toneClasses: Record<SurveyKpiCardProps["tone"], string> = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  blue: "bg-sky-50 text-sky-700 ring-sky-100",
  orange: "bg-orange-50 text-orange-700 ring-orange-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
}

export function SurveyKpiCard({
  label,
  value,
  note,
  icon,
  tone,
  pulse = false,
  progress,
}: SurveyKpiCardProps) {
  const progressStyle = progress == null ? null : progressTone(progress)

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
        </div>
        <span className={`relative grid size-10 shrink-0 place-items-center rounded-xl ring-4 ${toneClasses[tone]}`}>
          {icon}
          {pulse && <span className="absolute right-0 top-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white before:absolute before:inset-0 before:animate-ping before:rounded-full before:bg-emerald-400" />}
        </span>
      </div>
      {progress != null && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <span
            className={`block h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out ${progressStyle?.fill || ""}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
      <p className="mt-2 text-xs font-medium text-slate-500">{note}</p>
    </article>
  )
}

