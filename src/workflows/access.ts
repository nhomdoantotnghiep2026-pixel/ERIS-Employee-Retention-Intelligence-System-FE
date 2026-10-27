// Post-login UI policy. Server authorization must be enforced independently.
export const ROLE_HOME: Record<string, string> = {
  HR: '/dashboard', 'Data / AI Analyst': '/data-overview',
  'System Administrator': '/admin-overview', 'Employee / ESS': '/employee-dashboard',
};
const sharedData = ['/employees', '/employees/new', '/employees/bulk-update', '/employees/:id', '/employees/:id/edit', '/preparation'];
export const ROLE_ROUTES: Record<string, string[]> = {
  HR: [...sharedData, '/employees/import', '/departments', '/positions', '/dashboard', '/org-overview', '/org-chart', '/onboarding', '/workforce-risk', '/employee-requests', '/attendance', '/employee-history', '/attrition-risk', '/interventions', '/outcomes', '/engagement', '/executive-reports', '/reports', '/reports/:id', '/employees/:id/risk'],
  'Data / AI Analyst': [...sharedData, '/data-overview', '/data', '/import', '/schema', '/data-pipelines', '/model', '/ai-config', '/model/eval', '/model-performance', '/feature-importance', '/model-history', '/audit-logs', '/predictions'],
  'System Administrator': ['/admin-overview', '/users', '/roles', '/rbac', '/system', '/activity', '/system-health'],
  'Employee / ESS': ['/employee-dashboard', '/my-profile', '/my-attendance', '/my-requests', '/my-payroll', '/my-performance', '/my-offboarding', '/my-surveys'],
};
export function canAccessRoute(role: string, pathname: string) {
  const normalizedPath = pathname.replace(/\/$/, '') || '/';
  const routes = ROLE_ROUTES[role] || [];
  if (Object.values(ROLE_ROUTES).some(roleRoutes => roleRoutes.includes(normalizedPath))) {
    return routes.includes(normalizedPath);
  }
  const segments = normalizedPath.split('/');
  return routes.some(pattern => {
    const parts = pattern.split('/');
    return parts.length === segments.length && parts.every((part, index) => part.startsWith(':') || part === segments[index]);
  });
}
