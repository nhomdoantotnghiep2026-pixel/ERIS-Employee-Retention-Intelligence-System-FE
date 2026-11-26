import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "cn"

export interface SelectControlProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  prefixIcon?: React.ReactNode
  containerClassName?: string
}

const layoutClass = /^(?:(?:sm|md|lg|xl|2xl):)?(?:w-|min-w-|max-w-|basis-|flex-|grow|shrink|self-|mt-|mb-|ml-|mr-|mx-|my-)/

export const SelectControl = React.forwardRef<HTMLSelectElement, SelectControlProps>(
  ({ prefixIcon, className = "", containerClassName, children, disabled, ...props }, ref) => {
    const classes = className.split(/\s+/)
    const layout = classes.filter(token => layoutClass.test(token)).join(" ")
    const control = classes.filter(token => !layoutClass.test(token)).join(" ")
    return (
      <div className={cn("group relative min-w-0", layout, containerClassName)}>
        {prefixIcon && (
          <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400 transition-colors group-hover:text-slate-600">
            {prefixIcon}
          </span>
        )}
        <select
          ref={ref}
          disabled={disabled}
          className={cn(
            "h-11 w-full appearance-none rounded-md border border-slate-200 bg-white text-sm text-slate-800 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500",
            control,
            prefixIcon ? "pl-10" : "pl-3.5",
            "pr-10",
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400 transition-transform duration-200 ease-out group-focus-within:rotate-180 group-hover:text-slate-600 motion-reduce:transition-none" />
      </div>
    )
  },
)

SelectControl.displayName = "SelectControl"
