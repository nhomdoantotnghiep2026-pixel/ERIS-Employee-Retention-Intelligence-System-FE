import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, ChevronDown, HelpCircle, Languages, LogOut, PanelLeft, X } from 'lucide-react';
import { useRole, type UserRole } from '../context/RoleContext';
import { useLanguage } from '../context/LanguageContext';
import { logout } from '../services/api';
import { RoleJourney } from './RoleJourney';
import { useWorkInbox } from '../hooks/useWorkInbox';

type Link = { label: string; to: string };
type Props = { breadcrumb?: string[]; sidebarOpen: boolean; toggleSidebar: () => void; links: Record<UserRole, { items: Link[] }[]> };

export function EnterpriseHeader({ breadcrumb, sidebarOpen, toggleSidebar, links }: Props) {
  const { user, signOut } = useRole();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [panel, setPanel] = useState<'language' | 'notifications' | 'help' | 'account' | null>(null);
  const root = useRef<HTMLElement>(null);
  const helpButton = useRef<HTMLButtonElement>(null);
  const pages = links[user.role].flatMap(group => group.items);
  const { items, stats, markRead, markAllRead } = useWorkInbox(user.role, user.email);
  const notificationItems = items.filter(item => !item.archivedAt).slice(0, 4);
  const unread = stats.unread;
  const title = t((breadcrumb?.length ? breadcrumb[breadcrumb.length - 1] : pages.find(page => pathname.startsWith(page.to))?.label) || 'Workspace');
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

  const iconButton = 'relative flex h-11 w-11 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';
  const popover = 'absolute right-0 top-[calc(100%+12px)] w-[340px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl shadow-slate-900/15';
  const accountPopover = 'absolute right-0 top-[calc(100%+8px)] w-[148px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 text-slate-800 shadow-xl shadow-slate-900/10';

  return (
    <header ref={root} className="sticky top-0 z-30 flex min-h-[58px] shrink-0 items-center gap-4 bg-gradient-to-r from-[#f59b32] via-[#f47b2c] to-[#ef5b2a] px-3 py-1.5 text-white shadow-[0_4px_16px_rgba(234,88,12,0.16)] sm:px-6">
      <button className={iconButton + ' lg:hidden'} aria-label={sidebarOpen ? t('Collapse sidebar') : t('Expand sidebar')} aria-expanded={sidebarOpen} onClick={toggleSidebar}><PanelLeft size={21} /></button>
      <div className="min-w-0 flex-1 truncate text-lg font-bold tracking-[-0.01em] sm:text-xl">{title}</div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setPanel(panel === 'language' ? null : 'language')}
          className="flex h-11 items-center justify-center gap-2 rounded-full bg-white/15 px-3 text-xs font-bold text-white transition-all hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-4"
          aria-label={`${t('Language')}: ${language === 'vi' ? t('Vietnamese') : t('English')}`}
          aria-expanded={panel === 'language'}
          aria-haspopup="menu"
        >
          <Languages size={18} />
          <span>{language.toUpperCase()}</span>
          <ChevronDown size={13} className={`hidden transition-transform duration-200 sm:block ${panel === 'language' ? 'rotate-180' : ''}`} />
        </button>
        {panel === 'language' && (
          <section role="menu" aria-label={t('Language')} className="absolute right-0 top-[calc(100%+10px)] w-[230px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-slate-800 shadow-2xl shadow-slate-900/15">
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
          </section>
        )}
      </div>
      <div className="relative">
        <button className={iconButton} aria-label={`${t('Notifications')}, ${unread} ${t('unread')}`} onClick={() => setPanel(panel === 'notifications' ? null : 'notifications')}><Bell size={20} />{unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-orange-600">{unread}</span>}</button>
        {panel === 'notifications' && <section className={popover}><div className="flex items-center justify-between border-b border-slate-100 p-4"><div><h2 className="font-bold">{t('Notifications')}</h2><p className="text-xs text-slate-600">{language === 'vi' ? 'Cập nhật mới nhất theo vai trò' : 'Your latest role updates'}</p></div><button disabled={!unread} onClick={markAllRead} className="flex h-9 w-9 items-center justify-center rounded-md text-orange-600 transition-colors hover:bg-orange-50 disabled:cursor-not-allowed disabled:text-slate-300" aria-label={t('Mark all as read')}><CheckCheck size={18} /></button></div>{notificationItems.length ? notificationItems.map(notice => <button key={notice.id} onClick={() => { markRead(notice.id); go(notice.actionTo); }} className="flex w-full gap-3 border-b border-slate-100 p-4 text-left transition-colors hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-orange-500"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notice.readAt ? 'bg-slate-200' : 'bg-orange-500'}`} /><span><b className="block text-sm">{notice.title[language]}</b><span className="mt-1 block text-xs leading-5 text-slate-600">{notice.detail[language]}</span></span></button>) : <p className="px-4 py-8 text-center text-sm text-slate-600">{language === 'vi' ? 'Chưa có thông báo.' : 'No notifications yet.'}</p>}<button onClick={() => go('/notifications')} className="flex h-11 w-full items-center justify-center text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-orange-500">{language === 'vi' ? 'Mở Hộp công việc' : 'Open Work Inbox'}</button></section>}
      </div>
      <div className="relative">
        <button ref={helpButton} type="button" className={iconButton} aria-label={t('Help center')} aria-expanded={panel === 'help'} aria-controls="workspace-guide" onClick={() => setPanel(panel === 'help' ? null : 'help')}><HelpCircle size={20} /></button>
        {panel === 'help' && <div id="workspace-guide" role="region" aria-labelledby="workspace-guide-title" className="fixed right-3 top-[72px] max-h-[calc(100dvh-90px)] w-[calc(100vw-24px)] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl shadow-slate-900/15 sm:absolute sm:right-0 sm:top-[calc(100%+12px)] sm:max-h-[min(75dvh,680px)] sm:w-[440px] sm:max-w-[calc(100vw-24px)]">
          <button type="button" onClick={() => { setPanel(null); helpButton.current?.focus(); }} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-orange-500" aria-label={t('Close')}><X size={18}/></button>
          <RoleJourney onNavigate={() => setPanel(null)} />
        </div>}
      </div>
      <div className="relative">
        <button onClick={() => setPanel(panel === 'account' ? null : 'account')} className="flex min-h-12 items-center gap-2 rounded-full bg-white px-2 py-1 text-left text-slate-800 shadow-sm hover:bg-orange-50 sm:pr-4" aria-label={t('Account menu')}><span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">{user.initials}</span><span className="hidden lg:block"><b className="block max-w-32 truncate text-xs">{user.name}</b><span className="block text-[10px] text-slate-500">{t(user.role)}</span></span><ChevronDown size={14} className="hidden text-slate-400 sm:block" /></button>
        {panel === 'account' && <section className={accountPopover}><button onClick={handleSignOut} className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-500"><LogOut size={16} />{t('Sign out')}</button></section>}
      </div>
    </header>
  );
}
