import { useEffect, useId, useRef, useState } from 'react';

type Option = { id: number; name: string };

export function SearchableSelect({ label, value, options, onChange, placeholder, emptyText, invalidText, required = false, disabled = false }: {
  label: string; value: string; options: Option[]; onChange: (id: string) => void;
  placeholder: string; emptyText: string; invalidText: string; required?: boolean; disabled?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const selected = options.find(option => String(option.id) === value);
  const text = query ?? selected?.name ?? '';
  const filtered = options.filter(option => option.name.toLocaleLowerCase().includes((query ?? '').trim().toLocaleLowerCase()));
  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, id]);
  function choose(option: Option) {
    setQuery(null); onChange(String(option.id)); setOpen(false); setActive(-1);
    input.current?.setCustomValidity('');
    input.current?.focus();
  }
  return <div className="min-w-0 text-sm font-medium text-slate-700">
    <label htmlFor={id}>{label}</label>
    <div className="relative mt-1">
      <input ref={input} id={id} role="combobox" autoComplete="off" aria-autocomplete="list"
        aria-expanded={open} aria-controls={`${id}-options`} aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
        className="block w-full rounded-xl border border-slate-300 bg-white p-3 pr-10 text-sm focus:outline-orange-500 disabled:bg-slate-100"
        placeholder={placeholder} required={required} disabled={disabled} value={text}
        onFocus={() => { setOpen(true); setActive(-1); }}
        onBlur={() => { setOpen(false); setActive(-1); }}
        onChange={event => {
          const next = event.target.value;
          const match = options.find(option => option.name.toLocaleLowerCase() === next.trim().toLocaleLowerCase());
          setQuery(next); setOpen(true); setActive(-1); onChange(match ? String(match.id) : '');
          event.target.setCustomValidity(required && next && !match ? invalidText : '');
        }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setOpen(true);
            setActive(index => filtered.length ? index < 0 ? (event.key === 'ArrowDown' ? 0 : filtered.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length : -1);
          } else if (event.key === 'Enter' && open && active >= 0 && filtered[active]) {
            event.preventDefault(); choose(filtered[active]);
          } else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
        }} />
      <button type="button" tabIndex={-1} disabled={disabled} aria-label={label} aria-expanded={open} aria-controls={`${id}-options`}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-600"
        onMouseDown={event => event.preventDefault()} onClick={() => { input.current?.focus(); setOpen(!open); setActive(-1); }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && <ul id={`${id}-options`} role="listbox" aria-label={label}
        className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
        {filtered.map((option, index) => <li key={option.id} id={`${id}-option-${index}`} role="option" aria-selected={String(option.id) === value}
          className={`cursor-pointer break-words px-3 py-3 text-sm hover:bg-orange-50 ${active === index ? 'bg-orange-50' : ''}`}
          onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(option)}>{option.name}</li>)}
        {!filtered.length && <li role="presentation" className="px-3 py-3 text-sm text-slate-500">{emptyText}</li>}
      </ul>}
    </div>
  </div>;
}
