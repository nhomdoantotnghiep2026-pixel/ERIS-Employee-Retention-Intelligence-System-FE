import { DropdownMenu } from "radix-ui"
import { Check, ChevronDown } from "lucide-react"
import { Button } from "./button"

export function FilterMenu({
  className = "",
  label,
  value,
  options,
  onChange,
}: {
  className?: string
  label: string
  value: string
  options: {
    value: string
    label: string
  }[]
  onChange: (value: string) => void
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="outline"
          className={"h-10 max-w-full justify-between gap-3 rounded-md border-slate-300 bg-white text-slate-800 " + className}
          aria-label={label}
        >
          <span className="truncate">
            {options.find((option) => option.value === value)?.label || label}
          </span>
          <ChevronDown />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-[80] max-h-72 min-w-52 overflow-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg"
        >
          <DropdownMenu.RadioGroup value={value} onValueChange={onChange}>
            {options.map((option) => (
              <DropdownMenu.RadioItem
                key={option.value}
                value={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 text-sm text-slate-800 outline-none focus:bg-slate-100"
              >
                <span className="w-4">
                  <DropdownMenu.ItemIndicator>
                    <Check size={14} />
                  </DropdownMenu.ItemIndicator>
                </span>
                {option.label}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
