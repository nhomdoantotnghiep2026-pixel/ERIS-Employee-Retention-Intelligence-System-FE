import type { UserRole } from '../context/RoleContext.tsx';

const storageKey = (role: UserRole) => `eris-sidebar-groups-v1:${role}`;

export function readSidebarGroups(role: UserRole, available: string[], initialGroup?: string): string[] {
  const fallback = initialGroup && available.includes(initialGroup) ? [initialGroup] : [];
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(storageKey(role)) ?? 'null');
    if (!Array.isArray(stored) || stored.some(group => typeof group !== 'string')) return fallback;
    return [...new Set(stored.filter(group => available.includes(group)))];
  } catch {
    return fallback;
  }
}

export function saveSidebarGroups(role: UserRole, groups: string[]): void {
  try {
    sessionStorage.setItem(storageKey(role), JSON.stringify([...new Set(groups)]));
  } catch {
    // Keep the current in-memory state when browser storage is unavailable.
  }
}
