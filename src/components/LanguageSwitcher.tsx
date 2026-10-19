import { Globe2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  return <div role="group" aria-label={language === 'vi' ? 'Chọn ngôn ngữ' : 'Choose language'} className="inline-flex h-11 shrink-0 items-center rounded-full border border-slate-200 bg-white p-1 text-xs font-bold text-slate-500">
    <Globe2 size={15} aria-hidden="true" className="ml-2 mr-1 hidden text-orange-600 sm:block" />
    {(['vi', 'en'] as const).map(value => <button key={value} type="button" lang={value} title={value === 'vi' ? 'Tiếng Việt' : 'English'} aria-label={value === 'vi' ? 'Tiếng Việt' : 'English'} aria-pressed={language === value} onClick={() => setLanguage(value)} className={`h-9 min-w-8 rounded-full px-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-orange-500 sm:min-w-9 ${language === value ? 'bg-orange-50 text-orange-700' : 'hover:bg-slate-50 hover:text-orange-600'}`}>{value.toUpperCase()}</button>)}
  </div>;
}
