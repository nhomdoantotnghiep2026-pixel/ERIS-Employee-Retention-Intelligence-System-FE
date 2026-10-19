import { useLanguage } from '../context/LanguageContext';
import { Link } from 'react-router-dom';
import { ErisLogo } from './PublicBrand';
import { PUBLIC_TOPICS } from '../data/publicTopics';
export function PublicFooter() {
  const { t } = useLanguage();
  return <footer className="bg-slate-950 px-5 py-12 text-white sm:px-8"><div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1fr_auto]"><div><Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'auto' })} className="inline-block rounded-lg focus-visible:outline-2 focus-visible:outline-orange-400"><ErisLogo inverse /></Link><p className="mt-4 max-w-lg text-sm leading-6 text-slate-400">{t("AI hỗ trợ phân tích và ưu tiên. Quyết định nhân sự cuối cùng thuộc về người có thẩm quyền trong doanh nghiệp.")}</p></div><nav aria-label={t("Tìm hiểu ERIS")} className="grid grid-cols-2 content-start gap-x-8 gap-y-4">{Object.values(PUBLIC_TOPICS).map(topic => <Link key={topic.id} to={topic.path} className="text-sm text-slate-300 hover:text-orange-300 focus-visible:outline-2 focus-visible:outline-orange-400">{t(topic.label)}</Link>)}</nav><p className="border-t border-white/10 pt-5 text-xs text-slate-500 md:col-span-2">{t("© 2026 ERIS · Employee Retention Intelligence System")}</p></div></footer>;
}
