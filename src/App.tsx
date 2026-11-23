import { Suspense, type ReactNode, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { RoleProvider, useRole } from './context/RoleContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { EmployeeProvider } from './context/EmployeeContext';
import { WorkflowProvider } from './context/WorkflowContext';
import { canAccessRoute, ROLE_HOME } from './workflows/access';
import { AppShell } from './components/AppShell';
import { Card } from './components/ui';
import { Link } from 'react-router-dom';
import { RouteErrorBoundary } from './components/ApplicationErrorBoundary';
import { RouteLoadingFallback } from './components/RouteLoadingFallback';
import { PUBLIC_TOPICS } from './data/publicTopics';
import {
  AdminAuditLogs,
  AdminOverview,
  AiAnalysis,
  AttendanceDashboard,
  AttendanceHistory,
  CompanyLocationScreen,
  Dashboard,
  DataPipelines,
  DataWorkspace,
  DepartmentPage,
  Departments,
  EmployeeAccountProvisioning,
  EmployeeDataManagement,
  EmployeeDirectoryDashboard,
  EmployeeHistory,
  EmployeeImport,
  EmployeeOutcomes,
  EmployeePortal,
  EmployeeRecord,
  Employees,
  ErdAccounts,
  ErdEmployeeDetails,
  ErdOwnProfile,
  ErdSchema,
  ErdSurveys,
  FeatureImportance,
  ForgotPassword,
  HrEmployees,
  Landing,
  LeaveDataDashboard,
  LeaveRecords,
  Login,
  ModelLifecycle,
  PolicyDemo,
  PortalHub,
  PositionDetail,
  PositionEdit,
  Positions,
  Predictions,
  PublicDetail,
  ReportDetail,
  Reports,
  RetentionInterventions,
  RiskAnalysis,
  RiskWorkspace,
  Roles,
  SystemConfig,
  SystemHealth,
  WorkflowActivity,
  WorkInbox,
  WorkSchedules,
} from './routes/lazyScreens';
import { hasRoutePermission, RBAC_UPDATED_EVENT } from './utils/rbacAccess';

function RoleGuard({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const { user, isAuthenticated } = useRole();
  const { pathname } = useLocation();
  const [, setPermissionRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setPermissionRevision(value => value + 1);
    window.addEventListener(RBAC_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(RBAC_UPDATED_EVENT, refresh);
  }, []);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  const allowedByRole = canAccessRoute(user.role, pathname);
  const allowed = allowedByRole && hasRoutePermission(user.role, pathname);
  return allowed ? <>{children}</> : <AppShell breadcrumb={['Access denied']}><Card className="mx-auto max-w-xl p-8"><h1 className="text-xl font-bold text-slate-900">{t('Access denied')}</h1><p className="my-4 text-sm text-slate-600">{t('The {role} role is not authorized for this feature.', { role: t(user.role) })}</p><Link to={ROLE_HOME[user.role]} className="text-orange-700 underline">{t('Back to role home')}</Link></Card></AppShell>;
}

function RouteFallback() {
  const { user, isAuthenticated } = useRole();
  return <Navigate to={isAuthenticated ? ROLE_HOME[user.role] : '/login'} replace />;
}
function EmployeeDetailRoute() {
  const { user } = useRole();
  return user.role === 'HR' ? <HrEmployees /> : <ErdEmployeeDetails />;
}

function EmployeeWorkspace({ mode }: { mode: 'list' | 'add' | 'edit' }) {
  const { user } = useRole();
  if (user.role === 'HR') return <HrEmployees />;
  return mode === 'list' ? <Employees /> : mode === 'add' ? <EmployeeDataManagement mode="add" /> : <EmployeeRecord />;
}

export default function App() {
  return (
    <LanguageProvider>
      <RoleProvider>
        <EmployeeProvider>
        <WorkflowProvider>
        <BrowserRouter>
          <RouteErrorBoundary>
          <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
          <Route path="/" element={<Landing />} />
          {Object.values(PUBLIC_TOPICS).map(topic => <Route key={topic.id} path={topic.path} element={<PublicDetail topicId={topic.id} />} />)}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/notifications" element={<RoleGuard><WorkInbox /></RoleGuard>} />
          <Route path="/reports" element={<RoleGuard><Reports /></RoleGuard>} />
          <Route path="/reports/:reportId" element={<RoleGuard><ReportDetail /></RoleGuard>} />

          {/* HR */}
          <Route path="/dashboard" element={<RoleGuard><Dashboard /></RoleGuard>} />
          <Route path="/portal" element={<RoleGuard><PortalHub /></RoleGuard>} />
          <Route path="/org-overview" element={<RoleGuard><Navigate to="/dashboard" replace /></RoleGuard>} />
          <Route path="/departments" element={<RoleGuard><Departments /></RoleGuard>} />
          <Route path="/departments/:id" element={<RoleGuard><DepartmentPage mode="detail" /></RoleGuard>} />
          <Route path="/departments/:id/edit" element={<RoleGuard><DepartmentPage mode="edit" /></RoleGuard>} />
          <Route path="/positions" element={<RoleGuard><Positions /></RoleGuard>} />
          <Route path="/positions/:id/edit" element={<RoleGuard><PositionEdit /></RoleGuard>} />
          <Route path="/positions/:id" element={<RoleGuard><PositionDetail /></RoleGuard>} />
          <Route path="/workforce-risk" element={<RoleGuard><Navigate to="/org-overview" replace /></RoleGuard>} />
          <Route path="/attrition-risk" element={<RoleGuard><RiskWorkspace /></RoleGuard>} />
          <Route path="/interventions" element={<RoleGuard><RetentionInterventions /></RoleGuard>} />
          <Route path="/policy-demo" element={<RoleGuard><PolicyDemo /></RoleGuard>} />
          <Route path="/ai-analysis" element={<RoleGuard><AiAnalysis /></RoleGuard>} />
          <Route path="/outcomes" element={<RoleGuard><EmployeeOutcomes /></RoleGuard>} />
          <Route path="/engagement" element={<RoleGuard><ErdSurveys /></RoleGuard>} />

          {/* Shared HR */}
          <Route path="/employees" element={<RoleGuard><EmployeeWorkspace mode="list" /></RoleGuard>} />
          <Route path="/employees/dashboard" element={<RoleGuard><EmployeeDirectoryDashboard /></RoleGuard>} />
          <Route path="/employees/new" element={<RoleGuard><EmployeeWorkspace mode="add" /></RoleGuard>} />
          <Route path="/employees/import" element={<RoleGuard><EmployeeImport /></RoleGuard>} />
          <Route path="/employees/:id" element={<RoleGuard><EmployeeDetailRoute /></RoleGuard>} />
          <Route path="/employees/:id/edit" element={<RoleGuard><EmployeeWorkspace mode="edit" /></RoleGuard>} />
          <Route path="/employees/:id/risk" element={<RoleGuard><RiskAnalysis /></RoleGuard>} />
          <Route path="/attendance" element={<RoleGuard><AttendanceHistory /></RoleGuard>} />
          <Route path="/attendance/dashboard" element={<RoleGuard><AttendanceDashboard /></RoleGuard>} />
          <Route path="/holidays" element={<RoleGuard><AttendanceHistory holidaysPage /></RoleGuard>} />
          <Route path="/work-schedules" element={<RoleGuard><WorkSchedules /></RoleGuard>} />
          <Route path="/work-schedules/assign" element={<RoleGuard><Navigate to="/employees/import" replace /></RoleGuard>} />
          <Route path="/work-schedules/list" element={<RoleGuard><Navigate to="/work-schedules" replace /></RoleGuard>} />
          <Route path="/employee-requests" element={<RoleGuard><LeaveRecords /></RoleGuard>} />
          <Route path="/employee-requests/dashboard" element={<RoleGuard><LeaveDataDashboard /></RoleGuard>} />
          <Route path="/company-location" element={<RoleGuard><CompanyLocationScreen /></RoleGuard>} />
          <Route path="/employee-history" element={<RoleGuard><EmployeeHistory /></RoleGuard>} />
          <Route path="/employee-education" element={<RoleGuard><EmployeeHistory /></RoleGuard>} />
          <Route path="/employee-job-history" element={<RoleGuard><EmployeeHistory /></RoleGuard>} />

          {/* Employee self service */}
          <Route path="/employee-dashboard" element={<RoleGuard><EmployeePortal mode="dashboard" /></RoleGuard>} />
          <Route path="/my-profile" element={<RoleGuard><ErdOwnProfile /></RoleGuard>} />
          <Route path="/my-attendance" element={<RoleGuard><EmployeePortal mode="attendance" /></RoleGuard>} />
          <Route path="/my-requests" element={<RoleGuard><LeaveRecords own /></RoleGuard>} />
          <Route path="/my-surveys" element={<RoleGuard><ErdSurveys /></RoleGuard>} />

          {/* Legacy Data / AI workspace: retained for fixture/test compatibility; not an active login role. */}
          <Route path="/data-overview" element={<RoleGuard><DataWorkspace /></RoleGuard>} />
          <Route path="/data" element={<RoleGuard><Navigate to="/employees" replace /></RoleGuard>} />
          <Route path="/import" element={<RoleGuard><EmployeeImport /></RoleGuard>} />
          <Route path="/predictions" element={<RoleGuard><Predictions /></RoleGuard>} />
          <Route path="/data-pipelines" element={<RoleGuard><DataPipelines /></RoleGuard>} />
          <Route path="/schema" element={<RoleGuard><ErdSchema /></RoleGuard>} />
          <Route path="/model" element={<RoleGuard><Navigate to="/model-performance" replace /></RoleGuard>} />
          <Route path="/ai-config" element={<RoleGuard><ModelLifecycle /></RoleGuard>} />
          <Route path="/model/eval" element={<RoleGuard><Navigate to="/model-performance" replace /></RoleGuard>} />
          <Route path="/model-performance" element={<RoleGuard><ModelLifecycle /></RoleGuard>} />
          <Route path="/feature-importance" element={<RoleGuard><FeatureImportance /></RoleGuard>} />
          <Route path="/model-history" element={<RoleGuard><Predictions /></RoleGuard>} />
          <Route path="/audit-logs" element={<RoleGuard><WorkflowActivity /></RoleGuard>} />

          {/* System Administrator */}
          <Route path="/admin-overview" element={<RoleGuard><AdminOverview /></RoleGuard>} />
          <Route path="/users" element={<RoleGuard><ErdAccounts /></RoleGuard>} />
          <Route path="/users/provisioning" element={<RoleGuard><EmployeeAccountProvisioning /></RoleGuard>} />
          <Route path="/roles" element={<RoleGuard><Roles /></RoleGuard>} />
          <Route path="/rbac" element={<RoleGuard><Navigate to="/roles?tab=matrix" replace /></RoleGuard>} />
          <Route path="/system" element={<RoleGuard><SystemConfig /></RoleGuard>} />
          <Route path="/activity" element={<RoleGuard><AdminAuditLogs /></RoleGuard>} />
          <Route path="/system-health" element={<RoleGuard><SystemHealth /></RoleGuard>} />

          {/* Catch-all: redirect to role home */}
          <Route path="*" element={<RouteFallback />} />
          </Routes>
          </Suspense>
          </RouteErrorBoundary>
        </BrowserRouter>
        </WorkflowProvider>
        </EmployeeProvider>
      </RoleProvider>
    </LanguageProvider>
  );
}
