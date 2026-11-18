import type { ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { Plus, X } from 'lucide-react';
import { Button } from './ui/button';
import { useLanguage } from '../context/LanguageContext';

export function CreateRecordDialog({ title, open, onOpenChange, pending, children }: {
  title: string; open: boolean; onOpenChange: (open: boolean) => void; pending: boolean; children: ReactNode;
}) {
  const { t } = useLanguage();
  return <Dialog.Root open={open} onOpenChange={value => { if (!pending) onOpenChange(value); }}>
    <Dialog.Trigger asChild><Button disabled={pending} className="h-12 gap-2 rounded-full bg-orange-500 px-6 text-base font-semibold text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600"><Plus size={20} aria-hidden="true" />{title}</Button></Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[80] bg-slate-950/40 backdrop-blur-sm" />
      <Dialog.Content aria-describedby={undefined} onEscapeKeyDown={event => { if (pending) event.preventDefault(); }} onPointerDownOutside={event => event.preventDefault()} className="fixed left-1/2 top-1/2 z-[81] max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
        <div className="flex items-center justify-between gap-4"><Dialog.Title className="text-lg font-semibold text-slate-900">{title}</Dialog.Title><Dialog.Close asChild><Button type="button" variant="ghost" size="icon" disabled={pending} aria-label={t('Close')}><X size={18} aria-hidden="true" /></Button></Dialog.Close></div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
