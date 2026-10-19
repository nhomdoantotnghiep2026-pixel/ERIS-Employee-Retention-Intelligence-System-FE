import { LanguageSwitcher } from './LanguageSwitcher';
import { useLanguage } from '../context/LanguageContext';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react';
import { ErisLogo } from './PublicBrand';
import { PUBLIC_TOPICS, type PublicTopicId } from '../data/publicTopics';

const topics = Object.values(PUBLIC_TOPICS);

export function PublicHeader() {
  const { t } = useLanguage();
  const { pathname, hash } = useLocation();
  const [openTopic, setOpenTopic] = useState<PublicTopicId | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const mobileButton = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selected = openTopic ? PUBLIC_TOPICS[openTopic] : null;
  const active = topics.find(topic => topic.path === pathname)?.id;
  const cancelClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  const closeAll = () => { cancelClose(); setOpenTopic(null); setMobileOpen(false); };
  const open = (id: PublicTopicId) => { cancelClose(); setOpenTopic(id); };
  const focusPanel = (id: PublicTopicId) => { open(id); requestAnimationFrame(() => root.current?.querySelector<HTMLAnchorElement>('#public-mega-menu a')?.focus()); };

  useEffect(() => { closeAll(); }, [pathname, hash]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) closeAll(); };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const trigger = root.current?.querySelector<HTMLButtonElement>('button[data-topic][aria-expanded="true"]');
      closeAll();
      if (root.current?.contains(document.activeElement)) (trigger || mobileButton.current)?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { cancelClose(); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, []);

  return <header ref={root} className="fixed inset-x-0 top-0 z-50 px-3 pt-4 sm:px-7 sm:pt-6" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) closeAll(); }}>
    <div className="relative mx-auto max-w-[1180px]" onPointerEnter={cancelClose} onPointerLeave={event => { if (event.pointerType === 'mouse' && !root.current?.contains(document.activeElement)) { cancelClose(); closeTimer.current = setTimeout(closeAll, 160); } }}>
      <motion.nav initial={{ opacity: 0, y: -25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} aria-label={t("Điều hướng ERIS")} className="mx-auto flex h-[72px] max-w-[1180px] items-center justify-between gap-2 rounded-full border border-slate-200 bg-white/95 py-2 pl-4 pr-2 shadow-[0_16px_40px_rgba(71,85,105,0.12)] backdrop-blur-xl sm:pl-5">
        <Link to="/" onClick={() => { closeAll(); window.scrollTo({ top: 0, behavior: 'auto' }); }} aria-label={t("ERIS — Trang chủ")} className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500 [&>div>div:last-child]:hidden sm:[&>div>div:last-child]:block"><ErisLogo /></Link>
        <div className="hidden items-center gap-1 lg:flex">{topics.map(topic => <button key={topic.id} data-topic={topic.id} type="button" aria-expanded={openTopic === topic.id} aria-controls="public-mega-menu" onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); focusPanel(topic.id); } }} onPointerEnter={event => { if (event.pointerType === 'mouse') open(topic.id); }} onClick={() => { cancelClose(); setOpenTopic(current => current === topic.id ? null : topic.id); }} className={`inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 ${openTopic === topic.id || (!openTopic && active === topic.id) ? 'bg-orange-50 text-orange-600' : 'text-slate-600 hover:bg-orange-50 hover:text-orange-600'}`}>{t(topic.label)}<ChevronDown size={13} className={`transition-transform ${openTopic === topic.id ? 'rotate-180' : ''}`} /></button>)}</div>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <button ref={mobileButton} type="button" aria-label={mobileOpen ? t('Đóng điều hướng') : t('Mở điều hướng')} aria-expanded={mobileOpen} aria-controls="public-mega-menu" onClick={() => { cancelClose(); setMobileOpen(!mobileOpen); setOpenTopic(mobileOpen ? null : active || 'solutions'); }} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-600 hover:bg-orange-50 hover:text-orange-600 focus-visible:outline-2 focus-visible:outline-orange-500 lg:hidden">{mobileOpen ? <X size={20}/> : <Menu size={20}/>}</button>
          <Link to="/login" onClick={closeAll} className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-orange-600 px-3 text-xs sm:text-sm font-bold text-white transition-colors hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 sm:px-5">{t("Đăng nhập")} <ArrowRight size={17} className="hidden transition-transform group-hover:translate-x-0.5 sm:block" /></Link>
        </div>
      </motion.nav>
      {(selected || mobileOpen) && <motion.div id="public-mega-menu" role="region" aria-label={selected ? t(selected.label) + ' ' + t('— tìm hiểu ERIS') : t('Tìm hiểu ERIS')} initial={{ opacity: 0, y: -7 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16 }} className="absolute inset-x-0 top-full pt-3">
        <div className="max-h-[calc(100dvh-125px)] overflow-y-auto overscroll-contain rounded-[26px] border border-slate-200 bg-white shadow-[0_20px_55px_rgba(15,23,42,0.16)]">
          <div className="grid grid-cols-2 gap-2 border-b border-slate-100 p-4 lg:hidden">{topics.map(topic => <button key={topic.id} type="button" aria-pressed={openTopic === topic.id} onClick={() => open(topic.id)} className={`rounded-xl px-4 py-3 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-orange-500 ${openTopic === topic.id ? 'bg-orange-50 text-orange-700' : 'bg-slate-50 text-slate-600'}`}>{t(topic.label)}</button>)}</div>
          {selected && <div className="grid lg:grid-cols-[280px_1fr]">
            <div className="flex flex-col items-start bg-slate-50 p-5 sm:p-7"><p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-600">{t("ERIS ·")} {t(selected.label)}</p><h2 className="mt-3 text-xl font-bold tracking-tight text-slate-950">{t(selected.title)}</h2><p className="mt-3 text-sm leading-6 text-slate-500">{t(selected.menuIntro)}</p><Link to={selected.path} onClick={closeAll} className="mt-6 inline-flex items-center gap-2 rounded-lg text-sm font-bold text-orange-700 hover:underline focus-visible:outline-2 focus-visible:outline-orange-500">{t("Xem tổng quan")} <ArrowRight size={15}/></Link></div>
            <div className={`grid gap-1 p-3 sm:grid-cols-2 sm:p-5 ${selected.id === 'workflow' ? 'xl:grid-cols-3' : ''}`}>{selected.sections.map(section => <Link key={section.id} to={selected.path + '#' + section.id} onClick={closeAll} className="group rounded-xl border border-transparent p-4 transition-colors hover:border-orange-100 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-orange-500"><h3 className="flex items-center justify-between gap-3 text-sm font-bold text-slate-900 group-hover:text-orange-700">{t(section.title)}<ArrowRight size={14} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-orange-600"/></h3><p className="mt-2 text-xs leading-5 text-slate-500">{t(section.summary)}</p></Link>)}</div>
          </div>}
        </div>
      </motion.div>}
    </div>
  </header>;
}
