import type { LeaveRecord } from "../services/attendance.ts"

type Translate = (vi: string, en: string) => string

const leaveTypes = {
  ANNUAL: ["Nghỉ phép năm", "Annual leave", "border-sky-200 bg-sky-50 text-sky-800"],
  PATERNITY: ["Nghỉ thai sản (Nam)", "Paternity leave", "border-indigo-200 bg-indigo-50 text-indigo-800"],
  MATERNITY: ["Nghỉ thai sản (Nữ)", "Maternity leave", "border-purple-200 bg-purple-50 text-purple-800"],
  MARRIAGE: ["Nghỉ kết hôn", "Marriage leave", "border-pink-200 bg-pink-50 text-pink-800"],
  SICK: ["Nghỉ ốm đau", "Sick leave", "border-rose-200 bg-rose-50 text-rose-800"],
  OTHER: ["Việc riêng / Khác", "Personal or other leave", "border-amber-200 bg-amber-50 text-amber-800"],
  UNPAID: ["Nghỉ không hưởng lương", "Unpaid leave", "border-slate-200 bg-slate-100 text-slate-700"],
  BEREAVEMENT: ["Nghỉ tang", "Bereavement leave", "border-slate-200 bg-slate-100 text-slate-700"],
  COMPENSATORY: ["Nghỉ bù", "Compensatory leave", "border-teal-200 bg-teal-50 text-teal-800"],
} as const

type LeaveKind = keyof typeof leaveTypes

const normalize = (value: string) => value.trim().toUpperCase().replace(/[\s-]+/g, "_")
const patterns: [RegExp, LeaveKind][] = [
  [/^(UNPAID(_LEAVE)?|LEAVE_WITHOUT_PAY|LWOP)$|không\s+(hưởng\s+)?lương/i, "UNPAID"],
  [/^PATERNITY(_LEAVE)?$|thai sản.*(?:\bnam\b|cha|vợ sinh)/i, "PATERNITY"],
  [/^MATERNITY(_LEAVE)?$|thai sản/i, "MATERNITY"],
  [/^ANNUAL(_LEAVE)?$|phép năm|thường niên/i, "ANNUAL"],
  [/^SICK(_LEAVE)?$|ốm|bệnh/i, "SICK"],
  [/^MARRIAGE(_LEAVE)?$|kết hôn/i, "MARRIAGE"],
  [/^BEREAVEMENT(_LEAVE)?$|nghỉ tang/i, "BEREAVEMENT"],
  [/^COMPENSATORY(_LEAVE)?$|nghỉ bù/i, "COMPENSATORY"],
  [/^(OTHER|PERSONAL)(_LEAVE)?$|việc riêng/i, "OTHER"],
]
const catalogueAliases: Record<string, LeaveKind> = {
  LT001: "ANNUAL", LT003: "SICK", LT005: "MARRIAGE", LT007: "MATERNITY", LT008: "PATERNITY", LT012: "OTHER",
}

export function leaveTypeDisplay(code: string | undefined, name: string | undefined, tr: Translate) {
  // A descriptive catalogue name takes precedence over example IDs, which can vary between databases.
  const parts = [code, name].flatMap(value => value?.split(/[·|]/).map(part => part.trim()).filter(Boolean) ?? [])
  const kind = patterns.find(([pattern]) => parts.some(part => pattern.test(part) || pattern.test(normalize(part))))?.[1]
  const description = name?.trim()
  const displayName = description && !(/^LT\d+$/i.test(description) || /^[A-Z0-9_ -]+$/.test(description))
    ? description.replace(/^LT\d+\s*(?:[·|:–-]\s*)/i, "")
    : undefined
  const resolved = kind ?? (!displayName ? parts.map(part => catalogueAliases[normalize(part)]).find(Boolean) : undefined)
  const known = resolved && leaveTypes[resolved]
  return known
    ? { kind: resolved, label: tr(known[0], known[1]), tone: known[2] }
    : { kind: undefined, label: displayName || tr("Loại nghỉ khác", "Other leave"), tone: "border-slate-200 bg-slate-100 text-slate-700" }
}

export function displayLeaveReason(reason: string | null, annual: boolean, tr: Translate) {
  const value = reason?.trim()
  if (!value) return tr("Chưa ghi lý do", "No reason recorded")
  if (!/\b(?:SYNTHETIC[_-]|(?:MOCK|TEST|FIXTURE)[_-]|\bTEST\s+DATA\b)/i.test(value)) return value
  return annual
    ? tr("Nghỉ phép thường niên theo kế hoạch cá nhân", "Planned annual leave")
    : tr("Chưa có lý do đã xác minh", "No verified reason recorded")
}

export function leaveCalendarDays(record: Pick<LeaveRecord, "start_date" | "end_date">, from?: string, to?: string) {
  const start = from && from > record.start_date ? from : record.start_date
  const end = to && to < record.end_date ? to : record.end_date
  const days = (Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / 86_400_000 + 1
  return Number.isFinite(days) ? Math.max(0, days) : 0
}
