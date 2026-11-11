// Post-login UI policy. Server authorization must be enforced independently.
export const ROLE_HOME: Record<string, string> = {
  HR: '/dashboard', 'Data / AI Analyst': '/data-overview',
  'System Administrator': '/admin-overview', 'Employee / ESS': '/employee-dashboard',
};
const sharedData = ['/employees', '/employees/new', '/employees/:id', '/employees/:id/edit'];
export const ROLE_ROUTES: Record<string, string[]> = {
  HR: [...sharedData, '/employees/import', '/departments', '/departments/:id', '/departments/:id/edit', '/positions', '/positions/:id', '/positions/:id/edit', '/dashboard', '/portal', '/org-overview', '/workforce-risk', '/attendance', '/holidays', '/work-schedules', '/work-schedules/assign', '/work-schedules/list', '/employee-requests', '/company-location', '/employee-history', '/employee-education', '/employee-job-history', '/attrition-risk', '/ai-analysis', '/interventions', '/policy-demo', '/outcomes', '/engagement', '/employees/:id/risk'],
  'Data / AI Analyst': [...sharedData, '/data-overview', '/data', '/import', '/schema', '/data-pipelines', '/model', '/ai-config', '/model/eval', '/model-performance', '/feature-importance', '/model-history', '/audit-logs', '/predictions'],
  'System Administrator': ['/admin-overview', '/users', '/roles', '/rbac', '/system', '/activity', '/system-health'],
  'Employee / ESS': ['/employee-dashboard', '/my-profile', '/my-attendance', '/my-requests', '/my-surveys'],
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
