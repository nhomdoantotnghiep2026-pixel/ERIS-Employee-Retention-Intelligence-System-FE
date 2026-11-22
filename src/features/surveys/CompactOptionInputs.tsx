import { X } from "lucide-react"

import { useLanguage } from "../../context/LanguageContext"

type CompactOptionInputsProps = {
  value: string
  onChange: (value: string) => void
}

export function CompactOptionInputs({
  value,
  onChange,
}: CompactOptionInputsProps) {
  const { language } = useLanguage()
  const tr = (vi: string, en: string) => (language === "vi" ? vi : en)
  const options = value.split("\n")
  const normalized = options.length >= 2
    ? options
    : [...options, ...Array(2 - options.length).fill("")]

  const update = (index: number, next: string) =>
    onChange(
      normalized
        .map((option, itemIndex) => itemIndex === index ? next : option)
        .join("\n"),
    )

  const remove = (index: number) => {
    if (normalized.length <= 2) return
    onChange(
      normalized
        .filter((_, itemIndex) => itemIndex !== index)
        .join("\n"),
    )
  }

  const add = () => onChange([...normalized, ""].join("\n"))

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        {normalized.map((option, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <input
              value={option}
              placeholder={tr(
                `Phương án ${String.fromCharCode(65 + index)}`,
                `Option ${String.fromCharCode(65 + index)}`,
              )}
              className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              onChange={(event) => update(index, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  add()
                }
              }}
            />
            <button
              type="button"
              aria-label={tr("Xóa phương án", "Remove option")}
              disabled={normalized.length <= 2}
              onClick={() => remove(index)}
              className="grid size-8 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 text-xs font-semibold text-orange-700 hover:underline"
      >
        + {tr("Thêm phương án", "Add option")}
      </button>
    </div>
  )
}

