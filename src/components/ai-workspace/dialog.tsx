import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react"
const Context = createContext({
  open: false,
  onOpenChange: (_open: boolean) => {},
})
export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  return (
    <Context.Provider value={{ open, onOpenChange }}>
      {children}
    </Context.Provider>
  )
}
export function DialogContent({ children, className = "", wide = false }: { children: ReactNode; className?: string; wide?: boolean }) {
  const { open, onOpenChange } = useContext(Context)
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog?.open) dialog?.showModal()
    else if (!open && dialog?.open) dialog.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-labelledby="ai-confirm-title"
      aria-describedby="ai-confirm-description"
      onCancel={() => onOpenChange(false)}
      onClose={() => onOpenChange(false)}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-5xl" : "max-w-md"} rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-black/40 ${className}`}
    >
      {children}
    </dialog>
  )
}
export function DialogTitle({ children }: { children: ReactNode }) {
  return (
    <h2 id="ai-confirm-title" className="text-lg font-semibold">
      {children}
    </h2>
  )
}
export function DialogDescription({ children }: { children: ReactNode }) {
  return (
    <p id="ai-confirm-description" className="mt-3 text-sm text-slate-600">
      {children}
    </p>
  )
}
