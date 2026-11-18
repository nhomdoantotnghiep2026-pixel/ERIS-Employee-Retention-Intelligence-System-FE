import type { ReactNode } from "react"
export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "error"
  title?: string
  children?: ReactNode
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-xl border p-3 text-sm ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children}
    </div>
  )
}
export function Loading({ label = "Đang tải…" }: { label?: string }) {
  return (
    <p role="status" className="py-4 text-sm text-slate-500">
      {label}
    </p>
  )
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed p-4 text-sm text-slate-500">
      {children}
    </p>
  )
}
