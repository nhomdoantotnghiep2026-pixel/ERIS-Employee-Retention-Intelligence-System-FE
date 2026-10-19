import { type ReactNode, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { RoleProvider, useRole } from './context/RoleContext';
import { LanguageProvider } from './context/LanguageContext';
import { EmployeeProvider } from './context/EmployeeContext';
import { WorkflowProvider } from './context/WorkflowContext';
import { canAccessRoute, ROLE_HOME } from './workflows/access';
import { AppShell } from './components/AppShell';
import { Card } from './components/ui';
import { Link } from 'react-router-dom';
import EmployeeRecord from './screens/EmployeeRecord';
import WorkforceSnapshot from './screens/WorkforceSnapshot';
import ModelLifecycle from './screens/ModelLifecycle';
import Predictions from './screens/Predictions';
import EmployeeImport from './screens/EmployeeImport';
import EmployeeOutcomes from './screens/EmployeeOutcomes';
import WorkflowActivity from './screens/WorkflowActivity';
import DataWorkspace from './screens/DataWorkspace';
import RiskWorkspace from './screens/RiskWorkspace';
import ErdSurveys from './screens/ErdSurveys';
import ErdAccounts from './screens/ErdAccounts';
import ErdOwnProfile from './screens/ErdOwnProfile';
import ErdSchema from './screens/ErdSchema';
import ErdEmployeeDetails from './screens/ErdEmployeeDetails';
import Landing from './screens/Landing';
import Login from './screens/Login';
import ForgotPassword from './screens/ForgotPassword';

// HR
import Dashboard from './screens/Dashboard';
import OrgChart from './screens/OrgChart';
import Onboarding from './screens/Onboarding';
import RetentionInterventions from './screens/RetentionInterventions';

// Shared HR screens
import Employees from './screens/Employees';
import RiskAnalysis from './screens/RiskAnalysis';
import ReportDetail from './screens/ReportDetail';
import EmployeeDataManagement from './screens/EmployeeDataManagement';
import EmployeePortal from './screens/EmployeePortal';
import EmployeeRequests from './screens/EmployeeRequests';

// Data / AI Analyst
import DataPipelines from './screens/DataPipelines';
import FeatureImportance from './screens/FeatureImportance';

// System Administrator
import AdminOverview from './screens/AdminOverview';
import Roles from './screens/Roles';
import SystemConfig from './screens/SystemConfig';
import SystemHealth from './screens/SystemHealth';
import { hasRoutePermission, RBAC_UPDATED_EVENT } from './utils/rbacAccess';

function RoleGuard({ children }: { children: ReactNode }) {
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
  return allowed ? <>{children}</> : <AppShell breadcrumb={['Access denied']}><Card className="mx-auto max-w-xl p-8"><h1 className="text-xl font-bold text-slate-900">Không có quyền truy cập</h1><p className="my-4 text-sm text-slate-600">Vai trò {user.role} không được cấp quyền cho chức năng này.</p><Link to={ROLE_HOME[user.role]} className="text-orange-700 underline">Về trang chính của vai trò</Link></Card></AppShell>;
}

function RouteFallback() {
  const { user, isAuthenticated } = useRole();
  return <Navigate to={isAuthenticated ? ROLE_HOME[user.role] : '/login'} replace />;
}
function EmployeeDetailRoute() {
  return <ErdEmployeeDetails />;
}

export default function App() {
  return (
    <LanguageProvider>
      <RoleProvider>
        <EmployeeProvider>
        <WorkflowProvider>
        <BrowserRouter>
          <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* HR */}
          <Route path="/dashboard" element={<RoleGuard><Dashboard /></RoleGuard>} />
          <Route path="/org-overview" element={<RoleGuard><RiskWorkspace /></RoleGuard>} />
          <Route path="/org-chart" element={<RoleGuard><OrgChart /></RoleGuard>} />
          <Route path="/onboarding" element={<RoleGuard><Onboarding /></RoleGuard>} />
          <Route path="/workforce-risk" element={<RoleGuard><Navigate to="/org-overview" replace /></RoleGuard>} />
          <Route path="/attrition-risk" element={<RoleGuard><RiskWorkspace /></RoleGuard>} />
          <Route path="/interventions" element={<RoleGuard><RetentionInterventions /></RoleGuard>} />
          <Route path="/outcomes" element={<RoleGuard><EmployeeOutcomes /></RoleGuard>} />
          <Route path="/engagement" element={<RoleGuard><ErdSurveys /></RoleGuard>} />
          <Route path="/executive-reports" element={<RoleGuard><RiskWorkspace reports /></RoleGuard>} />

          {/* Shared HR */}
          <Route path="/employees" element={<RoleGuard><Employees /></RoleGuard>} />
          <Route path="/employees/new" element={<RoleGuard><EmployeeDataManagement mode="add" /></RoleGuard>} />
          <Route path="/employees/import" element={<RoleGuard><EmployeeImport /></RoleGuard>} />
          <Route path="/employees/bulk-update" element={<RoleGuard><EmployeeDataManagement mode="bulk" /></RoleGuard>} />
          <Route path="/employees/:id" element={<RoleGuard><EmployeeDetailRoute /></RoleGuard>} />
          <Route path="/employees/:id/edit" element={<RoleGuard><EmployeeRecord /></RoleGuard>} />
          <Route path="/employees/:id/risk" element={<RoleGuard><RiskAnalysis /></RoleGuard>} />
          <Route path="/employee-requests" element={<RoleGuard><EmployeeRequests /></RoleGuard>} />
          <Route path="/reports" element={<RoleGuard><RiskWorkspace reports /></RoleGuard>} />
          <Route path="/reports/:reportId" element={<RoleGuard><ReportDetail /></RoleGuard>} />

          {/* Employee self service */}
          <Route path="/employee-dashboard" element={<RoleGuard><EmployeePortal mode="dashboard" /></RoleGuard>} />
          <Route path="/my-profile" element={<RoleGuard><ErdOwnProfile /></RoleGuard>} />
          <Route path="/my-attendance" element={<RoleGuard><EmployeePortal mode="attendance" /></RoleGuard>} />
          <Route path="/my-requests" element={<RoleGuard><EmployeePortal mode="requests" /></RoleGuard>} />
          <Route path="/my-payroll" element={<RoleGuard><EmployeePortal mode="payroll" /></RoleGuard>} />
          <Route path="/my-performance" element={<RoleGuard><EmployeePortal mode="performance" /></RoleGuard>} />
          <Route path="/my-offboarding" element={<RoleGuard><EmployeePortal mode="offboarding" /></RoleGuard>} />
          <Route path="/my-surveys" element={<RoleGuard><ErdSurveys /></RoleGuard>} />

          {/* Data / AI Analyst */}
          <Route path="/data-overview" element={<RoleGuard><DataWorkspace /></RoleGuard>} />
          <Route path="/data" element={<RoleGuard><Navigate to="/employees" replace /></RoleGuard>} />
          <Route path="/import" element={<RoleGuard><EmployeeImport /></RoleGuard>} />
          <Route path="/preparation" element={<RoleGuard><WorkforceSnapshot /></RoleGuard>} />
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
          <Route path="/roles" element={<RoleGuard><Roles /></RoleGuard>} />
          <Route path="/rbac" element={<RoleGuard><Navigate to="/roles?tab=matrix" replace /></RoleGuard>} />
          <Route path="/system" element={<RoleGuard><SystemConfig /></RoleGuard>} />
          <Route path="/activity" element={<RoleGuard><WorkflowActivity /></RoleGuard>} />
          <Route path="/system-health" element={<RoleGuard><SystemHealth /></RoleGuard>} />

          {/* Catch-all: redirect to role home */}
          <Route path="*" element={<RouteFallback />} />
          </Routes>
        </BrowserRouter>
        </WorkflowProvider>
        </EmployeeProvider>
      </RoleProvider>
    </LanguageProvider>
  );
}
