import type { UserRole } from '../context/RoleContext';

export type LoginPortal = 'management' | 'employee';

export interface ApiRoleIdentity {
  role?: string | { name?: string } | null;
  roleName?: string | null;
}

const MANAGEMENT_ROLES: UserRole[] = ['HR', 'System Administrator'];

export function loginPortalForRole(role: UserRole): LoginPortal | null {
  if (role === 'Employee / ESS') return 'employee';
  return MANAGEMENT_ROLES.includes(role) ? 'management' : null;
}

export function portalAllowsRole(portal: LoginPortal, role: UserRole) {
  return portal === 'employee'
    ? role === 'Employee / ESS' || role === 'HR'
    : MANAGEMENT_ROLES.includes(role);
}

export function workspaceRoleForPortal(portal: LoginPortal, accountRole: UserRole): UserRole {
  return portal === 'employee' && accountRole === 'HR' ? 'Employee / ESS' : accountRole;
}

export function mapApiRole(identity: ApiRoleIdentity): UserRole | null {
  const rawRole = typeof identity.role === 'string'
    ? identity.role
    : identity.role?.name || identity.roleName;
  const normalized = rawRole?.trim().toUpperCase().replace(/[\s/-]+/g, '_');

  if (normalized === 'ADMIN' || normalized === 'SYSTEM_ADMINISTRATOR') return 'System Administrator';
  if (normalized === 'HR') return 'HR';
  if (normalized === 'EMPLOYEE' || normalized === 'EMPLOYEE_ESS' || normalized === 'ESS') return 'Employee / ESS';
  return null;
}
