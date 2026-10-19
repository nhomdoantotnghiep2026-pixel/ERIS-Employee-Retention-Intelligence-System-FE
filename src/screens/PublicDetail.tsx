import { useLanguage } from '../context/LanguageContext';
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MotionConfig, motion } from 'motion/react';
import { ArrowRight, ChevronRight, Database, GitBranch, ShieldCheck, UsersRound } from 'lucide-react';
import { PublicHeader } from '../components/PublicHeader';
import { PublicFooter } from '../components/PublicFooter';
import { PUBLIC_TOPICS, type PublicTopicId } from '../data/publicTopics';

const icons = { solutions: Database, roles: UsersRound, workflow: GitBranch, security: ShieldCheck };

export default function PublicDetail({ topicId }: { topicId: PublicTopicId }) {
  const { t } = useLanguage();
  const topic = PUBLIC_TOPICS[topicId];
  const Icon = icons[topicId];
  const { hash, key } = useLocation();
  useEffect(() => {
    const previous = document.title;
    document.title = t(topic.label) + ' | ERIS';
    return () => { document.title = previous; };
  }, [t, topic.label]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const section = hash ? document.getElementById(hash.slice(1)) : null;
      if (section) section.scrollIntoView({ block: 'start', behavior: 'auto' });
      else window.scrollTo({ top: 0, behavior: 'auto' });
    });
    return () => cancelAnimationFrame(frame);
  }, [topicId, hash, key]);

  return <MotionConfig reducedMotion="user"><div className="min-h-dvh bg-[#f8f9fb] text-slate-800">
    <a href="#public-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-orange-700">{t("Bỏ qua điều hướng")}</a>
    <PublicHeader />
    <main id="public-content" tabIndex={-1} className="mx-auto max-w-7xl px-5 pb-20 pt-[140px] outline-none sm:px-8 sm:pt-[160px]">
      <nav aria-label={t("Đường dẫn trang")} className="mb-8 flex items-center gap-2 text-xs text-slate-500"><Link to="/" className="hover:text-orange-700">{t("Trang chủ")}</Link><ChevronRight size={13}/><span aria-current="page">{t(topic.label)}</span></nav>
      <motion.div key={topicId} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="grid gap-8 pb-12 lg:grid-cols-[1.5fr_0.85fr] lg:items-end lg:gap-16">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">{t(topic.eyebrow)}</p><h1 className="mt-5 max-w-4xl text-4xl font-bold leading-[1.12] tracking-[-0.04em] text-slate-950 sm:text-5xl lg:text-[58px]">{t(topic.title)}</h1><p className="mt-6 max-w-3xl text-base leading-8 text-slate-600">{t(topic.summary)}</p></div>
        <aside className="rounded-[26px] border border-orange-100 bg-white p-7 shadow-[0_12px_40px_rgba(71,85,105,0.04)]"><span className="inline-flex rounded-2xl bg-orange-50 p-3 text-orange-600"><Icon size={25}/></span><p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{t("Điểm cốt lõi")}</p><p className="mt-3 text-xl font-bold leading-8 tracking-tight text-slate-900">{t(topic.takeaway)}</p></aside>
      </motion.div>
      <nav aria-label={t('Nội dung')+' '+t(topic.label)} className="mb-10 flex flex-wrap gap-2 border-y border-slate-200 py-5">{topic.sections.map((section,index) => <Link key={section.id} to={topic.path+'#'+section.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 focus-visible:outline-2 focus-visible:outline-orange-500"><span className="text-orange-600">{String(index+1).padStart(2,'0')}</span>{t(section.title).replace(/^[0-9]+ · /,'')}</Link>)}</nav>

      <div className="space-y-5">{topic.sections.map((section,index) => <section key={section.id} id={section.id} aria-labelledby={section.id+'-title'} className="grid scroll-mt-32 gap-6 rounded-[26px] border border-slate-200/80 bg-white p-6 sm:p-8 lg:grid-cols-[0.85fr_1.4fr] lg:gap-14 lg:p-10">
        <div><span className="text-sm font-bold tracking-[0.1em] text-orange-500">{String(index+1).padStart(2,'0')} / {String(topic.sections.length).padStart(2,'0')}</span><h2 id={section.id+'-title'} className="mt-4 text-2xl font-bold tracking-tight text-slate-950">{t(section.title).replace(/^[0-9]+ · /,'')}</h2><p className="mt-4 text-sm leading-7 text-slate-500">{t(section.summary)}</p></div>
        <div><ul className="space-y-4">{section.details.map(detail => <li key={detail} className="flex gap-3 text-sm leading-7 text-slate-600"><span aria-hidden="true" className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400"/><span>{t(detail)}</span></li>)}</ul><p className="mt-6 border-l-2 border-orange-300 bg-orange-50/70 px-4 py-3 text-sm font-medium leading-7 text-slate-700">{t(section.result)}</p></div>
      </section>)}</div>

      <section aria-labelledby="implementation-title" className="mt-12 rounded-[28px] bg-slate-950 p-7 text-white sm:p-10"><p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-300">{t("Phạm vi đồ án")}</p><h2 id="implementation-title" className="mt-3 text-2xl font-bold tracking-tight">{t("Bạn đang trải nghiệm bản frontend demo.")}</h2><div className="mt-7 grid gap-7 md:grid-cols-2"><div><h3 className="text-sm font-bold text-white">{t("Bản hiện tại")}</h3><p className="mt-3 text-sm leading-7 text-slate-300">{t(topic.current)}</p></div><div className="border-t border-white/10 pt-6 md:border-l md:border-t-0 md:pl-7 md:pt-0"><h3 className="text-sm font-bold text-orange-200">{t("Giai đoạn tích hợp tiếp theo")}</h3><p className="mt-3 text-sm leading-7 text-slate-300">{t(topic.next)}</p></div></div></section>
      <section aria-labelledby="related-topics-title" className="mt-14"><h2 id="related-topics-title" className="text-xl font-bold text-slate-900">{t("Tiếp tục tìm hiểu ERIS")}</h2><div className="mt-5 grid gap-4 md:grid-cols-3">{Object.values(PUBLIC_TOPICS).filter(item=>item.id!==topicId).map(item=><Link key={item.id} to={item.path} className="group rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-orange-200 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-orange-500"><span className="flex items-center justify-between text-sm font-bold text-orange-700">{t(item.label)}<ArrowRight size={16} className="transition-transform group-hover:translate-x-1"/></span><p className="mt-3 text-sm leading-6 text-slate-500">{t(item.title)}</p></Link>)}</div></section>
      <div className="mt-12 flex flex-col gap-4 rounded-2xl border border-orange-100 bg-orange-50 p-6 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-slate-900">{t("Khám phá các luồng trên giao diện ERIS")}</h2><p className="mt-2 text-sm text-slate-500">{t("Dùng tài khoản demo để xem không gian của từng vai trò.")}</p></div><Link to="/login" className="inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-full bg-orange-600 px-5 text-sm font-bold text-white hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 sm:shrink-0">{t("Trải nghiệm bản demo")} <ArrowRight size={16}/></Link></div>
    </main>
    <PublicFooter />
  </div></MotionConfig>;
}
