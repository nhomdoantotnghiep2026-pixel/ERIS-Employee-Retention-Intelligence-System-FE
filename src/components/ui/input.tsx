import * as React from 'react';
import { cn } from 'cn';
export function Input({className, type, ...props}: React.ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn('flex h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs outline-none transition-colors placeholder:text-slate-600 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50',className)} {...props}/>;
}
