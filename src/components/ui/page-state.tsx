import type { ReactNode } from "react"
import {
  AlertTriangle,
  Inbox,
  LoaderCircle,
  RefreshCw,
  type LucideIcon,
} from "lucide-react"

import { cn } from "../../lib/utils"
import { Button } from "./button"

type StatePanelProps = {
  icon: LucideIcon
  eyebrow?: string
  title: string
  description: string
  action?: ReactNode
  tone?: "neutral" | "danger"
  className?: string
}

const toneStyles = {
  neutral: {
    frame: "border-slate-200 bg-white",
    icon: "bg-slate-100 text-slate-600",
    eyebrow: "text-slate-500",
  },
  danger: {
    frame: "border-rose-200 bg-rose-50/60",
    icon: "bg-rose-100 text-rose-700",
    eyebrow: "text-rose-700",
  },
} as const

export function StatePanel({
  icon: Icon,
  eyebrow,
  title,
  description,
  action,
  tone = "neutral",
  className,
}: StatePanelProps) {
  const styles = toneStyles[tone]

  return (
    <section
      className={cn(
        "mx-auto flex w-full max-w-xl flex-col items-center rounded-xl border px-6 py-10 text-center shadow-sm",
        styles.frame,
        className,
      )}
    >
      <span
        className={cn(
          "grid size-12 place-items-center rounded-xl",
          styles.icon,
        )}
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>
      {eyebrow && (
        <p
          className={cn(
            "mt-4 text-xs font-semibold uppercase tracking-[0.16em]",
            styles.eyebrow,
          )}
        >
          {eyebrow}
        </p>
      )}
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
        {description}
      </p>
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </section>
  )
}

export function LoadingState({
  title,
  description,
  className,
}: {
  title: string
  description: string
  className?: string
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "mx-auto w-full max-w-5xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-orange-50 text-orange-700">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold text-slate-950">{title}</p>
          <p className="mt-0.5 text-sm text-slate-600">{description}</p>
        </div>
      </div>

      <div className="mt-6 grid animate-pulse gap-4 sm:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="rounded-xl border border-slate-100 bg-slate-50 p-4"
          >
            <div className="h-3 w-24 rounded bg-slate-200" />
            <div className="mt-4 h-7 w-16 rounded bg-slate-200" />
            <div className="mt-3 h-2 w-full rounded bg-slate-100" />
          </div>
        ))}
      </div>

      <span className="sr-only">{title}</span>
    </div>
  )
}

export function EmptyStatePanel({
  title,
  description,
  action,
  className,
}: {
  title: string
  description: string
  action?: ReactNode
  className?: string
}) {
  return (
    <StatePanel
      icon={Inbox}
      title={title}
      description={description}
      action={action}
      className={className}
    />
  )
}

export function ErrorStatePanel({
  title,
  description,
  retryLabel,
  onRetry,
  secondaryAction,
  className,
}: {
  title: string
  description: string
  retryLabel: string
  onRetry: () => void
  secondaryAction?: ReactNode
  className?: string
}) {
  return (
    <div role="alert" aria-live="assertive">
      <StatePanel
        icon={AlertTriangle}
        eyebrow="ERIS"
        title={title}
        description={description}
        tone="danger"
        className={className}
        action={
          <>
            <Button
              type="button"
              size="lg"
              className="bg-orange-600 text-white hover:bg-orange-700"
              onClick={onRetry}
            >
              <RefreshCw className="size-4" />
              {retryLabel}
            </Button>
            {secondaryAction}
          </>
        }
      />
    </div>
  )
}
