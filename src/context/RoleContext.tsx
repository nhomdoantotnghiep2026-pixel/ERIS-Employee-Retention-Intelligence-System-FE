import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { refreshSession } from '../services/api';

export type UserRole = 'HR' | 'Data / AI Analyst' | 'System Administrator' | 'Employee / ESS';

interface RoleUser {
  name: string;
  initials: string;
  role: UserRole;
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
  useEffect(() => {
    if (!storedUser || !sessionStorage.getItem('eris-access-token')) return;
    void refreshSession()
      .then(result => sessionStorage.setItem('eris-access-token', result.accessToken))
      .catch(() => {
        sessionStorage.removeItem('eris-user');
        sessionStorage.removeItem('eris-access-token');
        setIsAuthenticated(false);
      });
  }, [storedUser]);
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
  return <RoleContext.Provider value={{ user, isAuthenticated, setUser, signOut }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used inside RoleProvider');
  return ctx;
}
