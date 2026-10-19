import { useLanguage } from '../context/LanguageContext';

export function ErisLogo({ inverse = false }: { inverse?: boolean }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-3" aria-label={t("ERIS - Retention Intelligence")}>
      <div className={`relative grid h-11 w-11 place-items-center rounded-full border-2 text-lg font-bold ${inverse ? 'border-orange-400 bg-white/10 text-orange-300' : 'border-orange-500 bg-white text-orange-600'}`}>
        e
        <span className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ${inverse ? 'ring-slate-950' : 'ring-white'}`} aria-hidden="true" />
      </div>
      <div>
        <div className={`text-lg font-bold tracking-[0.14em] ${inverse ? 'text-white' : 'text-slate-950'}`}>ERIS</div>
        <div className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${inverse ? 'text-slate-400' : 'text-slate-500'}`}>{t("Retention Intelligence")}</div>
      </div>
    </div>
  );
}
