import { EnterpriseHeader } from './EnterpriseHeader';
import { readSidebarGroups, saveSidebarGroups } from '../utils/sidebarGroups';
import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, BarChart3,
  Settings, ChevronDown, Bell, Search, HelpCircle, LogOut,
  User, Shield, Activity, GitBranch,
  BarChart2, ServerCog, Network, MessageSquare,
  Workflow, Sliders, Table2, BrainCircuit,
  TrendingUp, History, ScrollText, ClipboardList,
  HeartPulse, Download, MonitorCheck, KeyRound, X, Leaf, ChevronLeft,
  CalendarDays
} from 'lucide-react';
import { useRole, type UserRole } from '../context/RoleContext';
import { useLanguage } from '../context/LanguageContext';
import { hasRoutePermission, RBAC_UPDATED_EVENT } from '../utils/rbacAccess';

type NavItem = { label: string; icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>; to: string };
type NavGroup = { group?: string; items: NavItem[] };

const NAV_BY_ROLE: Record<UserRole, NavGroup[]> = {
  'HR': [
    {
      group: 'OVERVIEW',
      items: [
        { label: 'Overview', icon: LayoutDashboard, to: '/dashboard' },
      ],
    },
    {
      group: 'Employee Retention Intelligence',
      items: [
        { label: 'Engagement assessment', icon: BrainCircuit, to: '/ai-analysis' },
        { label: 'Engagement Surveys', icon: MessageSquare, to: '/engagement' },
      ],
    },
    {
      group: 'WORKFORCE MANAGEMENT',
      items: [
        { label: 'Employee Directory', icon: Users, to: '/employees' },
        { label: 'Departments', icon: Network, to: '/departments' },
        { label: 'Positions', icon: ClipboardList, to: '/positions' },
        { label: 'Work schedules', icon: CalendarDays, to: '/work-schedules' },
        { label: 'Attendance data', icon: Activity, to: '/attendance' },
        { label: 'Leave data', icon: ClipboardList, to: '/employee-requests' },
      ],
    },
  ],
  'Employee / ESS': [
    {
      group: 'My Workspace',
      items: [
        { label: 'Employee Dashboard', icon: LayoutDashboard, to: '/employee-dashboard' },
        { label: 'My Profile', icon: User, to: '/my-profile' },
      ],
    },
    {
      group: 'Self Service',
      items: [
        { label: 'My Attendance', icon: Activity, to: '/my-attendance' },
        { label: 'My Leave Records', icon: ClipboardList, to: '/my-requests' },
        { label: 'My Surveys', icon: HeartPulse, to: '/my-surveys' },
      ],
    },
  ],
  // Legacy navigation retained for fixture/test compatibility. Active authentication never maps to this role.
  'Data / AI Analyst': [
    {
      group: 'Overview',
      items: [
        { label: 'Data Overview', icon: LayoutDashboard, to: '/data-overview' },
      ],
    },
    {
      group: 'Data Management',
      items: [
        { label: 'Employee Directory', icon: Users, to: '/employees' },
        { label: 'Schema & Mapping', icon: Table2, to: '/schema' },
      ],
    },
    {
      group: 'AI Models',
      items: [
        { label: 'Evaluate & Activate Model', icon: TrendingUp, to: '/model-performance' },
        { label: 'Generate Employee Predictions', icon: BrainCircuit, to: '/predictions' },
        { label: 'Feature Importance (SHAP)', icon: BrainCircuit, to: '/feature-importance' },
        { label: 'Prediction Run History', icon: History, to: '/model-history' },
      ],
    },
    {
      group: 'System & Logs',
      items: [
        { label: 'Data Pipelines', icon: Workflow, to: '/data-pipelines' },
        { label: 'Processing Audit Logs', icon: ScrollText, to: '/audit-logs' },
      ],
    },
  ],
  'System Administrator': [
    {
      group: 'Overview',
      items: [
        { label: 'Admin Overview', icon: ServerCog, to: '/admin-overview' },
      ],
    },
    {
      group: 'Users Management',
      items: [
        { label: 'System accounts', icon: User, to: '/users' },
        { label: 'Employee account provisioning', icon: KeyRound, to: '/users/provisioning' },
      ],
    },
    {
      group: 'System Operations',
      items: [
        { label: 'System Configuration', icon: Settings, to: '/system' },
        { label: 'Audit & Activity Logs', icon: ScrollText, to: '/activity' },
      ],
    },
  ],
};

function SidebarLink({ to, icon: Icon, label, onNavigate, collapsed = false, nested = false }: NavItem & { onNavigate?: () => void; collapsed?: boolean; nested?: boolean }) {
  const { pathname } = useLocation();
  const { t } = useLanguage();
  const isActive = pathname === to || ((to === '/users' || to === '/positions' || to === '/departments' || to.startsWith('/departments/')) ? false : pathname.startsWith(to + '/'));
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      title={collapsed ? t(label) : undefined}
      aria-label={collapsed ? t(label) : undefined}
      className={`group flex items-center active:scale-[0.99] transition-all duration-150 motion-reduce:transform-none motion-reduce:transition-none ${collapsed ? 'mx-auto h-11 w-11 justify-center gap-0 rounded-xl' : 'min-h-11 gap-3 rounded-xl px-3.5 text-[15px] leading-5'} ${
        isActive
          ? `${collapsed ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/20' : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/20'} font-semibold`
          : `${collapsed ? 'text-slate-500 hover:bg-orange-50 hover:text-orange-600' : 'font-medium text-slate-600 hover:bg-orange-50/70 hover:text-orange-600'}`
      }`}
    >
      <Icon aria-hidden="true" size={collapsed ? 20 : nested ? 17 : 19} strokeWidth={1.8} className={`flex-shrink-0 transition-colors duration-150 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-orange-500'}`} />
      <span className={`truncate transition-opacity duration-200 ${collapsed ? 'w-0 overflow-hidden opacity-0' : 'w-auto opacity-100'}`}>{t(label)}</span>
    </NavLink>
  );
}
function Sidebar({ onNavigate, collapsed, onToggle, quiet }: { quiet?: boolean; onNavigate?: () => void; collapsed: boolean; onToggle: () => void }) {
  const { user } = useRole();
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const [navQuery, setNavQuery] = useState('');
  const [historyOpen, setHistoryOpen] = useState(() => ['/employee-history', '/employee-education', '/employee-job-history'].includes(pathname));
  const navigationRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollStorageKey = `eris-sidebar-scroll:${user.role}`;
  const [, setPermissionRevision] = useState(0);
  const navGroups = NAV_BY_ROLE[user.role].map(group => ({
    ...group,
    items: group.items.filter(item => hasRoutePermission(user.role, item.to)),
  })).filter(group => group.items.length);
  const visibleGroups = navGroups.map(group => ({ ...group, items: group.items.filter(item => t(item.label).toLowerCase().includes(navQuery.trim().toLowerCase())) })).filter(group => group.items.length);
  const visibleItems = visibleGroups.flatMap(group => group.items);
  const activeGroup = navGroups.find(group => group.items.some(item => pathname === item.to || pathname.startsWith(item.to + '/') || (item.to === '/employee-history' && ['/employee-education', '/employee-job-history'].includes(pathname))))?.group;

  const [openGroups, setOpenGroups] = useState<string[]>(() => readSidebarGroups(user.role, navGroups.flatMap(group => group.group ? [group.group] : []), activeGroup));
  const updateOpenGroups = (groups: string[]) => {
    saveSidebarGroups(user.role, groups);
    setOpenGroups(groups);
  };

  useEffect(() => {
    const refresh = () => setPermissionRevision(value => value + 1);
    window.addEventListener(RBAC_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(RBAC_UPDATED_EVENT, refresh);
  }, []);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || (!event.metaKey && !event.ctrlKey)) return;
      event.preventDefault();
      if (collapsed) onToggle();
      requestAnimationFrame(() => searchInputRef.current?.focus());
    };
    document.addEventListener('keydown', focusSearch);
    return () => document.removeEventListener('keydown', focusSearch);
  }, [collapsed, onToggle]);

  useLayoutEffect(() => {
    const navigation = navigationRef.current;
    if (!navigation) return;
    const savedPosition = Number(sessionStorage.getItem(scrollStorageKey));
    if (Number.isFinite(savedPosition) && savedPosition > 0) navigation.scrollTop = savedPosition;
    return () => {
      sessionStorage.setItem(scrollStorageKey, String(navigation.scrollTop));
    };
  }, [scrollStorageKey]);

  return (
    <aside aria-label={t('Main navigation')} className={`fixed inset-y-0 left-0 z-50 flex h-dvh max-w-[88vw] flex-shrink-0 flex-col overflow-visible bg-white transition-[width,transform] duration-300 ease-in-out motion-reduce:transition-none lg:sticky lg:top-0 lg:z-40 lg:translate-x-0 ${quiet ? 'border-r border-slate-200' : 'rounded-br-[32px] shadow-2xl lg:shadow-[5px_0_26px_rgba(30,41,59,0.10)]'} ${collapsed ? '-translate-x-full w-[292px] lg:w-[88px]' : 'w-[320px] translate-x-0 lg:w-[292px]'}`}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-br-[32px] bg-white">
      {/* Logo */}
      <div className={`flex items-center justify-between gap-2 py-4 transition-[min-height,padding] duration-300 ${collapsed ? 'min-h-[88px] px-2' : 'min-h-[96px] px-5'}`}>
        <div className={`flex min-w-0 items-center ${collapsed ? 'gap-0' : 'gap-2.5'}`}>
          <div className={`relative flex flex-shrink-0 items-center justify-center rounded-full border-[3px] border-orange-500 text-orange-500 transition-all duration-300 ${collapsed ? 'h-10 w-10' : 'h-11 w-11'}`}>
            <Leaf size={20} className={`absolute -right-1 -top-3 rotate-[25deg] text-emerald-500 transition-opacity ${collapsed ? 'opacity-0' : 'opacity-100'}`} fill="currentColor" />
            <span className="text-xl font-black">e</span>
          </div>
          <div className={`overflow-hidden whitespace-nowrap transition-[width,opacity] duration-200 ${collapsed ? 'w-0 opacity-0' : 'w-[156px] opacity-100'}`}>
            <div className="text-2xl font-extrabold leading-none tracking-tight text-slate-800">ERIS</div>
            <div className="mt-1 text-[10px] font-medium leading-none text-emerald-600">{t('Retention Intelligence')}</div>
          </div>
        </div>
        <button type="button" onClick={onToggle} aria-label={collapsed ? t('Expand sidebar') : t('Collapse sidebar')} aria-expanded={!collapsed} className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-700 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 motion-reduce:transition-none lg:flex">
          <ChevronLeft size={18} className={`transition-transform duration-300 motion-reduce:transition-none ${collapsed ? 'rotate-180' : ''}`} />
        </button>
        <button type="button" onClick={onNavigate} aria-label={t('Close navigation')} className="flex h-11 w-11 items-center justify-center rounded-full text-[#71809d] hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 lg:hidden">
          <X size={20} />
        </button>
      </div>

      <div className={`border-b border-slate-100 transition-[padding] duration-300 ${collapsed ? 'px-5 pb-3' : 'px-4 pb-4'}`}>
        {collapsed ? <button type="button" onClick={onToggle} aria-label={t('Search menu')} className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-transparent text-slate-400 transition-all duration-150 hover:border-orange-100 hover:bg-orange-50 hover:text-orange-600 active:scale-95 focus-visible:outline-2 focus-visible:outline-orange-500"><Search size={20} strokeWidth={1.8} /></button> : <div className="flex min-h-11 items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-100/80 px-3 transition-all duration-200 hover:bg-slate-100 focus-within:border-orange-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-orange-500/20">
          <Search aria-hidden="true" size={18} strokeWidth={1.8} className="shrink-0 text-slate-400" />
          <input ref={searchInputRef} value={navQuery} onChange={event => setNavQuery(event.target.value)} aria-label={t('Search menu')} placeholder={t('Search')} className="h-10 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-slate-700 outline-none placeholder:text-slate-500 focus:ring-0" />
          <kbd aria-label={t('Search menu')} className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-400 shadow-sm">⌘<span aria-hidden="true" className="after:content-['K']" /></kbd>
        </div>}
      </div>

      {/* Role-specific nav */}
      <nav ref={navigationRef} onScroll={event => sessionStorage.setItem(scrollStorageKey, String(event.currentTarget.scrollTop))} className={`flex-1 overflow-y-auto py-2 ${collapsed ? 'space-y-2 px-0' : 'space-y-1 px-3'}`}>
        {collapsed ? visibleGroups.map((group, index) => {
          const groupKey = group.group || `group-${index}`;
          if (!group.group || group.items.length === 1) return group.items.map(item => <SidebarLink key={item.to} {...item} collapsed onNavigate={onNavigate} />);
          const GroupIcon = group.items[0].icon;
          const groupActive = activeGroup === group.group;
          return <button key={groupKey} type="button" title={t(group.group)} aria-label={t(group.group)} onClick={() => { updateOpenGroups(openGroups.includes(groupKey) ? openGroups : [...openGroups, groupKey]); onToggle(); }} className={`mx-auto flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-150 active:scale-95 ${groupActive ? (quiet ? 'bg-orange-50 text-orange-600' : 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-md shadow-orange-500/20') : 'text-slate-400 hover:bg-orange-50 hover:text-orange-600'}`}><GroupIcon size={20} strokeWidth={1.8} /></button>;
        }) : visibleGroups.map((group, index) => {
          const groupKey = group.group || `group-${index}`;
          const expanded = Boolean(navQuery) || openGroups.includes(groupKey);
          if (!group.group) return group.items.map(item => <SidebarLink key={item.to} {...item} onNavigate={onNavigate} />);
          const groupActive = activeGroup === group.group;
          return <div key={groupKey} className="py-0.5">
            <button type="button" onClick={() => updateOpenGroups(openGroups.includes(groupKey) ? openGroups.filter(key => key !== groupKey) : [...openGroups, groupKey])} aria-expanded={expanded} className={`flex w-full items-center gap-2 px-4 pb-1.5 pt-5 text-left text-[11px] font-bold uppercase tracking-wider transition-colors ${groupActive ? 'text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}>
              <span className="min-w-0 flex-1 truncate">{t(group.group)}{group.group === 'Employee Retention Intelligence' ? ' (AI)' : ''}</span>
              <ChevronDown size={14} className={`shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            </button>
            <div aria-hidden={!expanded} inert={!expanded} className={`grid transition-[grid-template-rows,opacity] duration-200 ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}><div className="min-h-0 overflow-hidden space-y-0.5 pb-1">{group.items.map(item => item.to === '/employee-history' ? <div key={item.to}>
              <button type="button" aria-expanded={historyOpen} onClick={() => setHistoryOpen(open => !open)} className="ml-5 flex min-h-10 w-[calc(100%-1.25rem)] items-center gap-3 rounded-full px-4 text-left text-[15px] font-semibold text-slate-700 hover:bg-orange-50 hover:text-orange-700"><History size={17} className="shrink-0"/><span className="min-w-0 flex-1 truncate">{t(item.label)}</span><ChevronDown size={16} className={historyOpen ? 'rotate-180' : ''}/></button>
              {historyOpen && <div className="ml-5"><SidebarLink to="/employee-education" icon={ClipboardList} label="Education" nested onNavigate={onNavigate}/><SidebarLink to="/employee-job-history" icon={History} label="Job history" nested onNavigate={onNavigate}/></div>}
            </div> : <SidebarLink key={item.to} {...item} nested onNavigate={onNavigate} />)}</div></div>
          </div>;
        })}
        {!visibleItems.length && <p className="px-5 py-8 text-center text-sm text-slate-400">{t('No menu items found')}</p>}
      </nav>

      <div className={`overflow-hidden border-t border-slate-100 text-xs text-slate-400 transition-all duration-300 ${collapsed ? 'h-0 border-transparent p-0 opacity-0' : 'px-7 py-4 opacity-100'}`}>{t(user.role)} · {t('Demo environment')}</div>
      </div>
    </aside>
  );
}

export function AppShell({ children, breadcrumb, quiet = false, mainStyle }: { children: ReactNode; breadcrumb?: string[]; quiet?: boolean; mainStyle?: CSSProperties }) {
  const { t } = useLanguage();
  const pageTitle = t(breadcrumb?.[breadcrumb.length - 1] || 'Workspace');
  useEffect(() => { document.title = pageTitle + ' | ERIS'; }, [pageTitle]);
  const { user } = useRole();
  const [sidebarOpen, setSidebarOpen] = useState(() => !quiet && window.innerWidth >= 1024 && sessionStorage.getItem('eris-sidebar') !== 'closed');
  const toggleSidebar = () => setSidebarOpen(open => { if (!quiet) sessionStorage.setItem('eris-sidebar', open ? 'closed' : 'open'); return !open; });
  const closeMobileSidebar = () => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && window.innerWidth < 1024) setSidebarOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  useEffect(() => {
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
    };
  }, []);

  return (
    <div className={'flex h-dvh min-h-0 overflow-hidden ' + (quiet ? 'bg-slate-50' : 'bg-[#F4F3F9]')}>
      <a href="#main-content" className="fixed left-4 top-4 z-[70] -translate-y-24 rounded-lg bg-orange-600 px-4 py-3 font-semibold text-white shadow-lg transition focus:translate-y-0">{t('Skip to main content')}</a>
      {sidebarOpen && <button type="button" aria-label={t('Close navigation')} onClick={closeMobileSidebar} className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[1px] lg:hidden" />}
      <Sidebar quiet={quiet} key={user.role} onNavigate={closeMobileSidebar} collapsed={!sidebarOpen} onToggle={toggleSidebar} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <EnterpriseHeader breadcrumb={breadcrumb} sidebarOpen={sidebarOpen} toggleSidebar={toggleSidebar} links={NAV_BY_ROLE} />
        <main id="main-content" tabIndex={-1} style={mainStyle} className={'min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none ' + (quiet ? '' : 'bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.07),transparent_28rem)]')}>
          <div className={'eris-content mx-auto w-full p-4 sm:p-5 lg:p-6 ' + (quiet ? '2xl:px-8' : 'max-w-[1480px]')}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
