export const ACTIVE_USER_ROLES = [
  'HR',
  'System Administrator',
  'Employee / ESS',
] as const;

export const LEGACY_USER_ROLES = ['Data / AI Analyst'] as const;

export type ActiveUserRole = (typeof ACTIVE_USER_ROLES)[number];
export type LegacyUserRole = (typeof LEGACY_USER_ROLES)[number];
export type UserRole = ActiveUserRole | LegacyUserRole;
export type RoleLifecycle = 'active' | 'legacy';

export const ROLE_LIFECYCLE: Record<UserRole, RoleLifecycle> = {
  HR: 'active',
  'System Administrator': 'active',
  'Employee / ESS': 'active',
  'Data / AI Analyst': 'legacy',
};

export const ROLE_RESPONSIBILITIES: Record<ActiveUserRole, readonly string[]> = {
  HR: [
    'workforce-management',
    'attendance-and-leave',
    'engagement-surveys',
    'ai-analysis',
    'retention-decisions',
  ],
  'System Administrator': [
    'account-management',
    'access-control',
    'system-configuration',
    'audit-review',
  ],
  'Employee / ESS': [
    'own-profile',
    'own-attendance',
    'own-requests',
    'assigned-surveys',
  ],
};

const activeRoleSet = new Set<string>(ACTIVE_USER_ROLES);
const legacyRoleSet = new Set<string>(LEGACY_USER_ROLES);

export function isActiveUserRole(role: unknown): role is ActiveUserRole {
  return typeof role === 'string' && activeRoleSet.has(role);
}

export function isLegacyUserRole(role: unknown): role is LegacyUserRole {
  return typeof role === 'string' && legacyRoleSet.has(role);
}

export function roleLifecycle(role: UserRole): RoleLifecycle {
  return ROLE_LIFECYCLE[role];
}
