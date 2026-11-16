// Validate wall-clock shift times, including shifts crossing midnight.
export function validScheduleTimeline(
  start: string,
  end: string,
  breakStart: string | null,
  breakEnd: string | null,
) {
  const seconds = (v: string) => {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(v)) return NaN
    const [h, m, s = "0"] = v.split(":")
    return Number(h) * 3600 + Number(m) * 60 + Number(s)
  }
  const a = seconds(start)
  let b = seconds(end)
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return false
  if (b < a) b += 86400
  if (breakStart === null && breakEnd === null) return true
  if (!breakStart || !breakEnd) return false
  let c = seconds(breakStart),
    d = seconds(breakEnd)
  if (!Number.isFinite(c) || !Number.isFinite(d) || c === d) return false
  if (c < a) c += 86400
  d += Math.floor(c / 86400) * 86400
  if (d < c) d += 86400
  return c >= a && d <= b && d > c
}
