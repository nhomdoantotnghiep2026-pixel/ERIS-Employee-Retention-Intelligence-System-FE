import { lazy } from "react"

// Public entry points
export const Landing = lazy(() => import("../screens/Landing"))
export const PublicDetail = lazy(() => import("../screens/PublicDetail"))
export const Login = lazy(() => import("../screens/Login"))
export const ForgotPassword = lazy(() => import("../screens/ForgotPassword"))
export const WorkInbox = lazy(() => import("../screens/WorkInbox"))

// HR and retention workspaces
export const Dashboard = lazy(() => import("../screens/Dashboard"))
export const PortalHub = lazy(() => import("../screens/PortalHub"))
export const Departments = lazy(() => import("../screens/Departments"))
export const DepartmentPage = lazy(() => import("../screens/DepartmentPage"))
export const Positions = lazy(() => import("../screens/Positions"))
export const PositionDetail = lazy(() =>
  import("../screens/Positions").then((module) => ({
    default: module.PositionDetail,
  })),
)
export const PositionEdit = lazy(() =>
  import("../screens/Positions").then((module) => ({
    default: module.PositionEdit,
  })),
)
export const RiskWorkspace = lazy(() => import("../screens/RiskWorkspace"))
export const RetentionInterventions = lazy(() =>
  import("../screens/RetentionInterventions"),
)
export const PolicyDemo = lazy(() => import("../screens/PolicyDemo"))
export const AiAnalysis = lazy(() => import("../screens/AiAnalysis"))
export const EmployeeOutcomes = lazy(() =>
  import("../screens/EmployeeOutcomes"),
)
export const ErdSurveys = lazy(() => import("../screens/ErdSurveys"))

// Employee master data and operational records
export const Employees = lazy(() => import("../screens/Employees"))
export const HrEmployees = lazy(() => import("../screens/HrEmployees"))
export const EmployeeDirectoryDashboard = lazy(() =>
  import("../screens/EmployeeDirectoryDashboard"),
)
export const EmployeeDataManagement = lazy(() =>
  import("../screens/EmployeeDataManagement"),
)
export const EmployeeRecord = lazy(() => import("../screens/EmployeeRecord"))
export const EmployeeImport = lazy(() => import("../screens/EmployeeImport"))
export const ErdEmployeeDetails = lazy(() =>
  import("../screens/ErdEmployeeDetails"),
)
export const RiskAnalysis = lazy(() => import("../screens/RiskAnalysis"))
export const AttendanceHistory = lazy(() =>
  import("../screens/AttendanceHistory"),
)
export const AttendanceDashboard = lazy(() =>
  import("../screens/AttendanceDashboard"),
)
export const WorkSchedules = lazy(() => import("../screens/WorkSchedules"))
export const EmployeeHistory = lazy(() =>
  import("../screens/EmployeeHistory"),
)
export const CompanyLocationScreen = lazy(() =>
  import("../screens/CompanyLocation"),
)
export const LeaveRecords = lazy(() => import("../screens/LeaveRecords"))
export const LeaveDataDashboard = lazy(() =>
  import("../screens/LeaveDataDashboard"),
)

// Employee self-service
export const EmployeePortal = lazy(() => import("../screens/EmployeePortal"))
export const ErdOwnProfile = lazy(() => import("../screens/ErdOwnProfile"))

// Data and AI workspaces
export const DataWorkspace = lazy(() => import("../screens/DataWorkspace"))
export const DataPipelines = lazy(() => import("../screens/DataPipelines"))
export const FeatureImportance = lazy(() =>
  import("../screens/FeatureImportance"),
)
export const ErdSchema = lazy(() => import("../screens/ErdSchema"))
export const ModelLifecycle = lazy(() => import("../screens/ModelLifecycle"))
export const Predictions = lazy(() => import("../screens/Predictions"))
export const WorkflowActivity = lazy(() =>
  import("../screens/WorkflowActivity"),
)

// System administration
export const AdminOverview = lazy(() => import("../screens/AdminOverview"))
export const ErdAccounts = lazy(() => import("../screens/ErdAccounts"))
export const EmployeeAccountProvisioning = lazy(() =>
  import("../screens/EmployeeAccountProvisioning"),
)
export const Roles = lazy(() => import("../screens/Roles"))
export const SystemConfig = lazy(() => import("../screens/SystemConfig"))
export const AdminAuditLogs = lazy(() =>
  import("../screens/AdminAuditLogs"),
)
export const SystemHealth = lazy(() => import("../screens/SystemHealth"))
