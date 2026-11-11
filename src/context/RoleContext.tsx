import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { restoreSession, SESSION_EXPIRED_EVENT } from '../services/api';
import { useAutoDismissState } from '../hooks/useAutoDismissState';
import { useLanguage } from './LanguageContext';

export type UserRole = 'HR' | 'Data / AI Analyst' | 'System Administrator' | 'Employee / ESS';

interface RoleUser {
  name: string;
  initials: string;
  role: UserRole;
  accountRole?: UserRole;
  workspace?: 'management' | 'employee';
  email: string;
  available?: boolean;
}

export const ROLE_USERS: RoleUser[] = [
  { name: 'ERIS Administrator', initials: 'EA', role: 'System Administrator', email: 'nhomdoantotnghiep2026@gmail.com' },
  { name: 'HR Account 1', initials: 'H1', role: 'HR', email: 'kn1234444@gmail.com' },
  { name: 'Data Analyst (chưa có tài khoản)', initials: 'DA', role: 'Data / AI Analyst', email: 'analyst@eris.com', available: false },
  { name: 'Employee (chưa có tài khoản)', initials: 'EE', role: 'Employee / ESS', email: 'employee@eris.com', available: false },
];

interface RoleContextValue {
  user: RoleUser;
  isAuthenticated: boolean;
  setUser: (u: RoleUser) => void;
  signOut: () => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const storedUser = (() => {
    try {
      const stored = sessionStorage.getItem('eris-user');
      const parsed = stored ? JSON.parse(stored) as RoleUser : null;
      if (!parsed?.email || !parsed.role || !parsed.name) return null;
      return parsed;
    } catch {
      return null;
    }
  })();
  const [user, setUserState] = useState<RoleUser>(storedUser || ROLE_USERS[0]);
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(storedUser));
  const [sessionNotice, setSessionNotice] = useAutoDismissState();
  useEffect(() => {
    const handleSessionExpired = () => {
      setIsAuthenticated(false);
      setSessionNotice('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [setSessionNotice]);
  useEffect(() => {
    if (!storedUser) return;
    let active = true;
    void restoreSession().catch(() => {
      if (!active) return;
      sessionStorage.removeItem('eris-user');
      sessionStorage.removeItem('eris-access-token');
      setIsAuthenticated(false);
    });
    return () => { active = false; };
  }, []);
  const setUser = (next: RoleUser) => {
    sessionStorage.setItem('eris-user', JSON.stringify(next));
    setUserState(next);
    setIsAuthenticated(true);
  };
  const signOut = () => {
    sessionStorage.removeItem('eris-user');
    sessionStorage.removeItem('eris-access-token');
    setIsAuthenticated(false);
  };
  return <RoleContext.Provider value={{ user, isAuthenticated, setUser, signOut }}>
    {children}
    {sessionNotice && <div role="alert" aria-live="assertive" className="fixed right-4 top-4 z-[100] flex max-w-[calc(100vw-2rem)] items-start gap-3 rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-2xl sm:max-w-sm">
      <span className="flex-1">{t(sessionNotice)}</span>
      <button type="button" onClick={() => setSessionNotice('')} className="rounded-md px-2 py-1 font-semibold text-orange-700 hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600" aria-label={t('Đóng thông báo')}>{t('Đóng')}</button>
    </div>}
  </RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used inside RoleProvider');
  return ctx;
}
