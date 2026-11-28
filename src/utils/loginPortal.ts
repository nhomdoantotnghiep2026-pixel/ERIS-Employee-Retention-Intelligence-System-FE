import {
  ACTIVE_USER_ROLES,
  isActiveUserRole,
  type ActiveUserRole,
  type UserRole,
} from '../domain/roleContract.ts';

export type LoginPortal = 'management' | 'employee';

export interface ApiRoleIdentity {
  role?: string | { name?: string } | null;
  roleName?: string | null;
}

const MANAGEMENT_ROLES: ActiveUserRole[] = ['HR', 'System Administrator'];

export function loginPortalForRole(role: UserRole): LoginPortal | null {
  if (role === 'Employee / ESS') return 'employee';
  return MANAGEMENT_ROLES.some(item => item === role) ? 'management' : null;
}

export function portalAllowsRole(portal: LoginPortal, role: UserRole) {
  return portal === 'employee'
    ? role === 'Employee / ESS' || role === 'HR'
    : MANAGEMENT_ROLES.some(item => item === role);
}

export function workspaceRoleForPortal(portal: LoginPortal, accountRole: ActiveUserRole): ActiveUserRole {
  return portal === 'employee' && accountRole === 'HR' ? 'Employee / ESS' : accountRole;
}

export function mapApiRole(identity: ApiRoleIdentity): ActiveUserRole | null {
  const rawRole = typeof identity.role === 'string'
    ? identity.role
    : identity.role?.name || identity.roleName;
  const normalized = rawRole?.trim().toUpperCase().replace(/[\s/-]+/g, '_');

  const mapped = normalized === 'ADMIN' || normalized === 'SYSTEM_ADMINISTRATOR'
    ? 'System Administrator'
    : normalized === 'HR'
      ? 'HR'
      : normalized === 'EMPLOYEE' || normalized === 'EMPLOYEE_ESS' || normalized === 'ESS'
        ? 'Employee / ESS'
        : null;
  return mapped && isActiveUserRole(mapped) && ACTIVE_USER_ROLES.includes(mapped) ? mapped : null;
}
