import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, Check, CheckCheck, ChevronDown, HelpCircle, Languages, LogOut, PanelLeft, X } from 'lucide-react';
import { useRole, type UserRole } from '../context/RoleContext';
import { useLanguage } from '../context/LanguageContext';
import { logout } from '../services/api';
import { RoleJourney } from './RoleJourney';
import { hasRoutePermission } from '../utils/rbacAccess';

type Link = { label: string; to: string };
type Props = { breadcrumb?: string[]; sidebarOpen: boolean; toggleSidebar: () => void; links: Record<UserRole, { items: Link[] }[]> };

const notices: Record<UserRole, { title: string; detail: string; to: string }[]> = {
  'HR': [{ title: 'Retention plan needs review', detail: 'Review current interventions and next steps.', to: '/interventions' }, { title: 'Engagement overview available', detail: 'Explore the latest survey results.', to: '/engagement' }],
  'Data / AI Analyst': [{ title: 'Review data preparation', detail: 'Check data quality before the next model run.', to: '/preparation' }, { title: 'Model monitoring summary', detail: 'Review model versions and drift indicators.', to: '/model-history' }],
  'System Administrator': [{ title: 'Access review', detail: 'Review user access and role assignments.', to: '/users' }, { title: 'System health overview', detail: 'Inspect service status and recent incidents.', to: '/system-health' }],
  'Employee / ESS': [{ title: 'Pulse survey available', detail: 'Complete your active employee survey.', to: '/my-surveys' }, { title: 'Attendance reminder', detail: 'Remember to record today’s attendance.', to: '/my-attendance' }],
};

export function EnterpriseHeader({ breadcrumb, sidebarOpen, toggleSidebar, links }: Props) {
  const { user, signOut } = useRole();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [panel, setPanel] = useState<'language' | 'notifications' | 'help' | 'account' | null>(null);
  const [read, setRead] = useState<string[]>(() => { try { return JSON.parse(sessionStorage.getItem('eris-notifications-read') || '[]'); } catch { return []; } });
  const root = useRef<HTMLElement>(null);
  const helpButton = useRef<HTMLButtonElement>(null);
  const pages = links[user.role].flatMap(group => group.items);
  const notificationItems = notices[user.role].filter(item => hasRoutePermission(user.role, item.to));
  const key = (i: number) => `${user.role}:${i}`;
  const unread = notificationItems.filter((_, i) => !read.includes(key(i))).length;
  const title = t((breadcrumb?.length ? breadcrumb[breadcrumb.length - 1] : pages.find(page => pathname.startsWith(page.to))?.label) || 'Workspace');
  const breadcrumbItems = breadcrumb?.length ? breadcrumb.map(item => t(item)) : [title];
  const markRead = (ids: string[]) => setRead(old => { const next = [...new Set([...old, ...ids])]; sessionStorage.setItem('eris-notifications-read', JSON.stringify(next)); return next; });
  const go = (to: string) => { setPanel(null); navigate(to); };
  const handleSignOut = async () => {
    try {
      await logout();
    } finally {
      signOut();
      setPanel(null);
      navigate('/login', { replace: true });
    }
  };

  useEffect(() => { setPanel(null); }, [pathname, user.role]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setPanel(null); };
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape') { if (root.current?.querySelector('#workspace-guide')) helpButton.current?.focus(); setPanel(null); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', keyboard); };
  }, []);

  const iconButton = 'group relative flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/15 text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/25 active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none';
  const popover = 'absolute right-0 top-[calc(100%+12px)] w-[340px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl shadow-slate-900/15';
  const accountPopover = 'absolute right-0 top-[calc(100%+8px)] w-[168px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 text-slate-800 shadow-xl shadow-slate-900/10';
  const panelTransition = { duration: 0.2, ease: [0.16, 1, 0.3, 1] } as const;

  return (
    <header ref={root} className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-orange-700/25 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 px-3 text-white shadow-[0_4px_20px_-4px_rgba(234,88,12,0.22)] backdrop-blur-md sm:gap-3 sm:px-6">
      <button className={iconButton + ' lg:hidden'} aria-label={sidebarOpen ? t('Collapse sidebar') : t('Expand sidebar')} aria-expanded={sidebarOpen} onClick={toggleSidebar}><PanelLeft size={21} /></button>
      <div className="min-w-0 flex-1" aria-label={breadcrumbItems.join(' / ')}>
        {breadcrumbItems.length > 1 ? <div className="flex min-w-0 items-center text-sm sm:text-base">{breadcrumbItems.map((item, index) => <span key={`${item}-${index}`} className="flex min-w-0 items-center"><span className={`truncate ${index === breadcrumbItems.length - 1 ? 'font-bold tracking-tight text-white' : 'hidden font-medium text-white/75 sm:inline'}`}>{item}</span>{index < breadcrumbItems.length - 1 && <span aria-hidden="true" className="mx-2 hidden text-white/40 sm:inline">/</span>}</span>)}</div> : <div className="truncate text-base font-bold tracking-tight text-white sm:text-lg">{title}</div>}
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setPanel(panel === 'language' ? null : 'language')}
          className="flex h-10 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 text-xs font-bold text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/25 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none sm:px-4"
          aria-label={`${t('Language')}: ${language === 'vi' ? t('Vietnamese') : t('English')}`}
          aria-expanded={panel === 'language'}
          aria-haspopup="menu"
        >
          <Languages size={18} />
          <span>{language.toUpperCase()}</span>
          <ChevronDown size={13} className={`hidden transition-transform duration-200 sm:block ${panel === 'language' ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
        {panel === 'language' && (
          <motion.section initial={{ opacity: 0, scale: 0.96, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: -4 }} transition={panelTransition} role="menu" aria-label={t('Language')} className="absolute right-0 top-[calc(100%+10px)] w-[230px] origin-top-right overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-slate-800 shadow-2xl shadow-slate-900/15">
            <div className="px-3 pb-2 pt-1">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{t('Language')}</p>
              <p className="mt-1 text-[11px] text-slate-500">{t('Current language')}: {language === 'vi' ? 'Tiếng Việt' : 'English'}</p>
            </div>
            {([
              { code: 'vi', short: 'VI', label: 'Tiếng Việt', detail: 'Vietnamese' },
              { code: 'en', short: 'EN', label: 'English', detail: 'English' },
            ] as const).map(option => {
              const selected = language === option.code;
              return (
                <button
                  key={option.code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => { setLanguage(option.code); setPanel(null); }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${selected ? 'bg-orange-50 text-orange-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  <span className={`grid h-9 w-9 place-items-center rounded-full text-[11px] font-bold ${selected ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{option.short}</span>
                  <span className="min-w-0 flex-1"><b className="block text-sm">{option.label}</b><span className="block text-[11px] text-slate-400">{t(option.detail)}</span></span>
                  <span className={`grid h-6 w-6 place-items-center rounded-full ${selected ? 'bg-orange-100 text-orange-600' : 'text-transparent'}`}><Check size={14} strokeWidth={3} /></span>
                </button>
              );
            })}
          </motion.section>
        )}
        </AnimatePresence>
      </div>
      <div className="relative">
        <button className={iconButton} aria-label={`${t('Notifications')}, ${unread} ${t('unread')}`} aria-expanded={panel === 'notifications'} onClick={() => setPanel(panel === 'notifications' ? null : 'notifications')}><Bell size={20} className="transition-transform duration-200 group-hover:rotate-6" />{unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[11px] font-extrabold text-orange-600 shadow-sm">{unread}</span>}</button>
        <AnimatePresence>{panel === 'notifications' && <motion.section initial={{ opacity: 0, scale: 0.96, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: -4 }} transition={panelTransition} className={`${popover} origin-top-right`}><div className="flex items-center justify-between border-b border-slate-100 p-4"><div><h2 className="font-bold">{t('Notifications')}</h2><p className="text-xs text-slate-500">{t('Your latest updates')}</p></div><button onClick={() => markRead(notificationItems.map((_, i) => key(i)))} className="flex h-9 w-9 items-center justify-center rounded-full text-orange-600 hover:bg-orange-50" aria-label={t('Mark all as read')}><CheckCheck size={18} /></button></div>{notificationItems.map((notice, i) => <button key={notice.to} onClick={() => { markRead([key(i)]); go(notice.to); }} className="flex w-full gap-3 border-b border-slate-100 p-4 text-left hover:bg-orange-50"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${read.includes(key(i)) ? 'bg-slate-200' : 'bg-orange-500'}`} /><span><b className="block text-sm">{t(notice.title)}</b><span className="mt-1 block text-xs leading-5 text-slate-500">{t(notice.detail)}</span></span></button>)}</motion.section>}</AnimatePresence>
      </div>
      <div className="relative">
        <button ref={helpButton} type="button" className={iconButton} aria-label={t('Help center')} aria-expanded={panel === 'help'} aria-controls="workspace-guide" onClick={() => setPanel(panel === 'help' ? null : 'help')}><HelpCircle size={20} /></button>
        <AnimatePresence>{panel === 'help' && <motion.div initial={{ opacity: 0, scale: 0.96, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: -4 }} transition={panelTransition} id="workspace-guide" role="region" aria-labelledby="workspace-guide-title" className="fixed right-3 top-[68px] max-h-[calc(100dvh-82px)] w-[calc(100vw-24px)] origin-top-right overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl shadow-slate-900/15 sm:absolute sm:right-0 sm:top-[calc(100%+12px)] sm:max-h-[min(75dvh,680px)] sm:w-[440px] sm:max-w-[calc(100vw-24px)]">
          <button type="button" onClick={() => { setPanel(null); helpButton.current?.focus(); }} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-orange-500" aria-label={t('Close')}><X size={18}/></button>
          <RoleJourney onNavigate={() => setPanel(null)} />
        </motion.div>}</AnimatePresence>
      </div>
      <div className="relative">
        <button onClick={() => setPanel(panel === 'account' ? null : 'account')} aria-expanded={panel === 'account'} className="flex h-10 items-center gap-2.5 rounded-full border border-white/20 bg-white/15 px-1.5 py-1 text-left text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/25 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none sm:pr-3" aria-label={t('Account menu')}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-bold text-orange-600 shadow-sm">{user.initials}</span><span className="hidden lg:block"><b className="block max-w-32 truncate text-xs font-semibold leading-tight text-white">{user.name}</b><span className="block text-[11px] text-white/75">{t(user.role)}</span></span><ChevronDown size={14} className={`hidden text-white/75 transition-transform duration-200 sm:block ${panel === 'account' ? 'rotate-180' : ''}`} /></button>
        <AnimatePresence>{panel === 'account' && <motion.section initial={{ opacity: 0, scale: 0.96, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: -4 }} transition={panelTransition} className={`${accountPopover} origin-top-right`}><button onClick={handleSignOut} className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-500"><LogOut size={16} />{t('Sign out')}</button></motion.section>}</AnimatePresence>
      </div>
    </header>
  );
}
