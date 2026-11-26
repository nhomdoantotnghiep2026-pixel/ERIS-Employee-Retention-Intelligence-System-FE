export const SHIFT_DISPLAY = {
  OFFICE: { short: "Hành chính", full: "Hành chính (08:00 – 17:00)", en: "Office" },
  EARLY: { short: "Ca sáng", full: "Ca sáng sớm (07:00 – 16:00)", en: "Morning" },
  MID: { short: "Ca giữa", full: "Ca giữa (10:00 – 19:00)", en: "Midday" },
  NIGHT: { short: "Ca tối", full: "Ca tối (12:00 – 21:00)", en: "Evening" },
  PART_MORNING: { short: "BT sáng", full: "Bán thời gian sáng (08:00 – 12:00)", en: "PT AM" },
  PART_AFTERNOON: { short: "BT chiều", full: "Bán thời gian chiều (13:00 – 17:00)", en: "PT PM" },
} as const

const aliases = new Map<string, keyof typeof SHIFT_DISPLAY>([
  ["GENERAL", "OFFICE"], ["OFFICE", "OFFICE"], ["HANH_CHINH", "OFFICE"],
  ["SHIFT_1", "EARLY"], ["EARLY", "EARLY"], ["CA_SANG", "EARLY"],
  ["SHIFT_2", "MID"], ["MID", "MID"], ["CA_GIUA", "MID"], ["CA_CHIEU", "MID"],
  ["SHIFT_3", "NIGHT"], ["NIGHT", "NIGHT"], ["CA_TOI", "NIGHT"],
  ["PART_MORNING", "PART_MORNING"], ["BAN_THOI_GIAN_BUOI_SANG", "PART_MORNING"], ["BAN_THOI_GIAN_SANG", "PART_MORNING"],
  ["PART_AFTERNOON", "PART_AFTERNOON"], ["BAN_THOI_GIAN_BUOI_CHIEU", "PART_AFTERNOON"], ["BAN_THOI_GIAN_CHIEU", "PART_AFTERNOON"],
])

const token = (value = "") => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase().trim().replace(/[\s-]+/g, "_")
export function normalizeShift(code?: string | null, name?: string) {
  return aliases.get(token(code ?? "")) ?? aliases.get(token(name)) ?? (code || name ? "OTHER" : "")
}

export function shiftLabel(key: string, vi: boolean, full = false) {
  const item = SHIFT_DISPLAY[key as keyof typeof SHIFT_DISPLAY]
  if (item) return vi ? (full ? item.full : item.short) : item.en
  return key ? (vi ? "Ca khác" : "Other shift") : (vi ? "Chưa rõ" : "Unspecified")
}
