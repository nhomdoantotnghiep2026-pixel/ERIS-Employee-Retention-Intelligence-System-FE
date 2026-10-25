import { useLanguage } from '../context/LanguageContext';

export function SelfServicePreviewNotice() {
  const { t } = useLanguage();
  return <p role="note" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">{t('Browser preview: this feature is not connected to the server yet. Sample values and actions here are not your official employee records.')}</p>;
}
