const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
const ADMIN_API_BASE_URL = (import.meta.env.VITE_ADMIN_API_BASE_URL || '').replace(/\/$/, '');
const isAdminAccount = (user?: ApiUser) => {
  const role = (typeof user?.role === 'string' ? user.role : user?.role?.name)?.trim().toUpperCase();
  return role ? role === 'ADMIN' || role === 'SYSTEM ADMINISTRATOR' : user?.roleId === 1;
};

export interface AttendanceLocation {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}

export interface AttendanceRecord {
  checkIn: string | null;
  checkOut: string | null;
  workDate: string;
  workingMinutes: number;
  overtimeMinutes: number;
  attendanceStatus: string;
}

export interface TodayAttendance {
  date: string;
  serverTime: string;
  timeZone: string;
  workday: boolean;
  checkedIn: boolean;
  checkedOut: boolean;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  attendance: AttendanceRecord | null;
}

export interface AttendanceResult {
  status: 'INSIDE' | 'OUTSIDE' | 'LOW_ACCURACY';
  persisted: boolean;
  distanceMeters: number;
  accuracyMeters: number;
  allowedRadiusMeters: number;
  attendance?: AttendanceRecord;
}

export interface AttendanceHistoryRecord extends AttendanceRecord {
  id: number;
  employeeId: number;
  employeeCode: string;
  fullName: string;
  createdAt: string;
  updatedAt: string;
}

export function getAttendanceConfig(signal?: AbortSignal) {
  return request<{
    companyLocation: { latitude: number; longitude: number };
    allowedRadiusMeters: number;
    maximumAccuracyMeters: number;
    timeZone: string;
    workStart: string;
    workEnd: string;
    lunchStart: string;
    lunchEnd: string;
    storage: string;
    mockMode: boolean;
  }>('/v1/attendance/config', { signal, cache: 'no-store' });
}

export interface CompanyLocation {
  address: string;
  latitude: number;
  longitude: number;
  source: 'env' | 'redis';
  updatedAt: string | null;
  updatedBy: number | null;
}

export interface CompanyLocationResponse {
  data: CompanyLocation;
  allowedRadiusMeters: number;
  message?: string;
}

export function getCompanyLocation(signal?: AbortSignal) {
  return request<CompanyLocationResponse>('/v1/attendance/company-location', {
    signal,
    cache: 'no-store',
  });
}

export function updateCompanyLocation(input: Pick<CompanyLocation, 'address' | 'latitude' | 'longitude'>) {
  return request<CompanyLocationResponse>('/v1/attendance/company-location', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function getTodayAttendance(signal?: AbortSignal) {
  return request<TodayAttendance>('/v1/attendance/today', { signal, cache: 'no-store' });
}

export function listAttendanceHistory(signal?: AbortSignal) {
  return request<{ data: AttendanceHistoryRecord[] }>('/v1/attendance', { signal, cache: 'no-store' });
}

export function getAttendanceRecord(id: number, signal?: AbortSignal) {
  return request<{ data: AttendanceHistoryRecord }>(`/v1/attendance/${id}`, { signal, cache: 'no-store' });
}

export function recordAttendance(action: 'check-in' | 'check-out', location: AttendanceLocation, signal?: AbortSignal) {
  const { latitude, longitude, accuracyMeters } = location;
  return request<AttendanceResult>(`/v1/attendance/${action}`, {
    method: 'POST', body: JSON.stringify({ latitude, longitude, accuracyMeters }), signal,
  });
}

export interface EmployeeEducation {
  id: number;
  employeeId: number;
  educationLevel: number | null;
  fieldOfStudy: string | null;
  institution: string | null;
  graduationYear: number | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface EducationInstitution {
  id: string;
  institution: string;
  country?: string | null;
  display?: string;
  address?: string | null;
  website?: string | null;
  source: 'ROR' | 'VIETMAP';
  levelFit?: string;
  levelWarning?: string | null;
}

export interface EmployeeJobHistory {
  id: number;
  employeeId: number;
  employeeCode?: string;
  employeeName?: string;
  departmentId: number | null;
  departmentName: string | null;
  positionId: number | null;
  positionName: string | null;
  jobLevel: number | null;
  managerId: number | null;
  changeType: 'HIRE' | 'PROMOTION' | 'ROLE_CHANGE';
  startDate: string;
  endDate: string | null;
  createdAt: string;
}

export interface EmployeeWorkExperience {
  id: number;
  employeeId: number;
  employeeCode?: string;
  fullName?: string;
  companyName: string;
  positionTitle: string;
  startDate: string;
  endDate: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'IN_PROCESS';
  createdAt: string;
  updatedAt: string;
}

export interface SurveySummary {
  id: number;
  title: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
  createdAt?: string;
  updatedAt?: string;
  createdBy?: number;
  createdByName?: string | null;
  questionCount?: number;
  responseCount?: number;
}

export interface SurveyQuestion {
  id: number;
  questionText: string;
  dimensionCode: string;
  required: boolean;
  displayOrder: number;
}

export interface AvailableSurvey extends SurveySummary {
  questionCount: number;
  responseStatus: 'NOT_STARTED' | 'IN_PROGRESS';
}

export interface SurveyResponse {
  responseId: number;
  surveyId: number;
  submittedAt: string;
}

export interface SurveyParticipantResponse {
  responseId: number;
  submittedAt: string;
  employee: {
    id: number;
    employeeCode: string;
    fullName: string;
  };
  answers: Array<{
    questionId: number;
    questionText: string;
    dimensionCode?: string | null;
    displayOrder?: number;
    score: number | null;
    comment: string | null;
  }>;
}

export interface SurveyParticipantResults {
  survey: SurveySummary;
  responseCount: number;
  participants: SurveyParticipantResponse[];
}

export interface SurveyResults {
  id: number;
  title: string;
  status: SurveySummary['status'];
  responseCount: number;
  questions: Array<SurveyQuestion & {
    answers?: Array<{
      score: number | null;
      comment: string | null;
    }>;
    answerCount: number;
    averageScore: number | null;
    scoreDistribution: Record<1 | 2 | 3 | 4, number>;
  }>;
}

export function listSurveys(signal?: AbortSignal) {
  return request<{ data: SurveySummary[] }>('/surveys', { signal, cache: 'no-store' });
}

export function listAvailableSurveys(signal?: AbortSignal) {
  return request<{ data: AvailableSurvey[] }>('/surveys/available', { signal, cache: 'no-store' });
}

export function getSurveyForEmployee(id: number, signal?: AbortSignal) {
  return request<{ data: SurveySummary & { questions: SurveyQuestion[] } }>(`/surveys/${id}`, { signal, cache: 'no-store' });
}

export function createSurvey(input: { title: string; description?: string | null; startDate: string; endDate: string }) {
  return request<{ message: string; data: SurveySummary & { questions: SurveyQuestion[] } }>('/surveys', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function publishSurvey(id: number) {
  return request<{ message: string; data: SurveySummary }>(`/surveys/${id}/publish`, { method: 'POST' });
}

export function getSurveyResults(id: number, signal?: AbortSignal) {
  return request<{ data: SurveyResults }>(`/surveys/${id}/results`, { signal, cache: 'no-store' });
}

export function getSurveyParticipants(id: number, signal?: AbortSignal) {
  return request<{ data: SurveyParticipantResults }>(`/surveys/${id}/responses`, { signal, cache: 'no-store' });
}

export function getMySurveyResponse(id: number, signal?: AbortSignal) {
  return request<{
    data: {
      survey: { id: number; title: string };
      response: { id: number; status: 'SUBMITTED' | 'DRAFT'; submittedAt: string | null };
      answers: Array<{
        questionId: number;
        questionText: string;
        dimensionCode: string;
        required: boolean;
        displayOrder: number;
        score: number | null;
        comment: string | null;
      }>;
    };
  }>(`/surveys/${id}/my-response`, { signal, cache: 'no-store' });
}

export function submitSurveyResponse(id: number, answers: Array<{ questionId: number; score: number; comment?: string | null }>) {
  return request<{ message: string; data: SurveyResponse }>(`/surveys/${id}/responses`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
}

export function listEmployeeEducation(employeeId: number, signal?: AbortSignal) {
  return request<{ data: EmployeeEducation[] }>(`/employees/${employeeId}/educations`, { signal, cache: 'no-store' });
}

export function listOwnEducation(signal?: AbortSignal) {
  return request<{ data: EmployeeEducation[] }>('/employees/me/educations', { signal, cache: 'no-store' });
}

export function listAllEmployeeEducation(signal?: AbortSignal) {
  return request<{ data: Array<EmployeeEducation & { employeeCode: string; fullName: string }> }>('/employee-educations', { signal, cache: 'no-store' });
}

export function listEducationEmployees(signal?: AbortSignal) {
  return request<{ data: Array<{ id: number; employeeCode: string; fullName: string; dateOfBirth: string | null; employmentStatus: string }> }>('/employee-educations/employees', { signal, cache: 'no-store' });
}

export function searchEducationInstitutions(name: string, educationLevel?: number, signal?: AbortSignal) {
  const query = new URLSearchParams({ name });
  if (educationLevel !== undefined) query.set('educationLevel', String(educationLevel));
  return request<{ data: EducationInstitution[]; source: string; manualEntryAllowed: boolean }>(`/employee-educations/institutions?${query}`, { signal });
}

export function createEmployeeEducation(employeeId: number, input: {
  educationLevel: number;
  fieldOfStudy?: string | null;
  institution: string;
  institutionRefId: string;
  graduationYear?: number | null;
}) {
  return request<{ message: string; data: EmployeeEducation; warning?: string | null }>(`/employees/${employeeId}/educations`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateEmployeeEducation(employeeId: number, educationId: number, input: Partial<{
  educationLevel: number;
  fieldOfStudy: string | null;
  institution: string;
  institutionRefId: string;
  graduationYear: number | null;
}>) {
  return request<{ message: string; data: EmployeeEducation; warning?: string | null }>(`/employees/${employeeId}/educations/${educationId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deactivateEmployeeEducation(employeeId: number, educationId: number) {
  return request<{ message: string; data: EmployeeEducation }>(`/employees/${employeeId}/educations/${educationId}`, { method: 'DELETE' });
}

export function listEmployeeJobHistory(employeeId: number, signal?: AbortSignal) {
  return request<{ data: EmployeeJobHistory[] }>(`/employees/${employeeId}/job-histories`, { signal, cache: 'no-store' });
}

export function listOwnJobHistory(signal?: AbortSignal) {
  return request<{ data: EmployeeJobHistory[] }>('/employees/me/job-histories', { signal, cache: 'no-store' });
}

export function listAllJobHistory(signal?: AbortSignal) {
  return request<{ data: EmployeeJobHistory[] }>('/job-histories', { signal, cache: 'no-store' });
}

export function listAllEmployeeWorkExperiences(signal?: AbortSignal) {
  return request<{ data: EmployeeWorkExperience[] }>('/employee-work-experiences', { signal, cache: 'no-store' });
}

export function listEmployeeWorkExperiences(employeeId: number, signal?: AbortSignal) {
  return request<{
    employee: { id: number; employeeCode: string; fullName: string; employmentStatus: string };
    data: EmployeeWorkExperience[];
  }>(`/employees/${employeeId}/work-experiences`, { signal, cache: 'no-store' });
}

export function createEmployeeWorkExperience(employeeId: number, input: {
  companyName: string;
  positionTitle: string;
  startDate: string;
  endDate?: string | null;
}) {
  return request<{ message: string; data: EmployeeWorkExperience }>(`/employees/${employeeId}/work-experiences`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deactivateEmployeeWorkExperience(employeeId: number, experienceId: number) {
  return request<{ message: string; data: EmployeeWorkExperience }>(`/employees/${employeeId}/work-experiences/${experienceId}`, { method: 'DELETE' });
}

export interface ApiUser {
  id: number;
  email: string;
  fullName?: string | null;
  employeeId?: number | null;
  role?: string | { id?: number; name: string };
  roleName?: string;
  roleId?: number;
  status: string;
}

export interface ApiEmployee {
  id: number;
  employee_code?: string | null;
  full_name?: string | null;
  email?: string | null;
  employment_status?: string | null;
}

export interface EmployeeProfile {
  id: number; employeeCode: string; fullName: string; email: string;
  phone: string | null; dateOfBirth: string | null; gender: string | null;
  address: string | null; departmentId: number; positionId: number; hireDate: string;
  employmentType: string | null; employmentStatus: string; currentSalary: string | number | null;
  educations?: EmployeeEducation[];
  workExperiences?: EmployeeWorkExperience[];
  distanceFromHomeKm: number | null;
  distanceCalculation: { status: string; reason?: string | null };
  account?: { email: string; status: string }; emailDelivery?: string; warning?: string;
}
export interface EmployeeInput {
  fullName: string; email: string; hireDate: string; departmentId: number; positionId: number;
  phone?: string | null; dateOfBirth?: string | null; gender?: string | null;
  address?: string | null; addressRefId?: string | null; employmentType?: string | null; currentSalary?: number | null;
  educations?: Array<{
    educationLevel: number; fieldOfStudy?: string | null; institution: string;
    institutionRefId: string; graduationYear?: number | null;
  }>;
  workExperiences?: Array<{
    companyName: string; positionTitle: string; startDate: string; endDate?: string | null;
  }>;
}
export type EmployeeChanges = Partial<Omit<EmployeeInput, 'email' | 'hireDate' | 'dateOfBirth'>>;
export async function listEmployeeProfiles(options: { page?: number; limit?: number; search?: string; departmentId?: number; positionId?: number; employmentStatus?: string } = {}, signal?: AbortSignal) {
  const { page = 1, limit = 20, ...filters } = options;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== '') query.set(key, String(value));
  const result = await request<{ data: EmployeeProfile[] }>(`/employees?${query}`, { signal });
  const total = result.data.length;
  return {
    data: result.data.slice((page - 1) * limit, page * limit),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
export function getEmployeeProfile(id: number, signal?: AbortSignal) {
  return request<EmployeeProfile>(`/employees/${id}`, { signal });
}
export async function createEmployeeProfile(input: EmployeeInput) {
  return (await request<{ data: EmployeeProfile }>('/employees', { method: 'POST', body: JSON.stringify(input) })).data;
}
export async function updateEmployeeProfile(id: number, changes: EmployeeChanges) {
  return (await request<{ data: EmployeeProfile }>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(changes) })).data;
}
export function deactivateEmployeeProfile(id: number) {
  return request<{ data: { id: number; employmentStatus: string } }>(`/employees/${id}`, { method: 'DELETE' });
}

interface LoginResponse {
  accessToken?: string;
  user?: ApiUser;
  message?: string;
  passwordChangeToken?: string;
}

export class ApiError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) {
    if (!(error instanceof Error)) return fallback;
    if (/failed to fetch|network(error| request failed)|timed?\s*out|timeout|unexpected token|internal server error/i.test(error.message)) return fallback;
    return error.message;
  }
  const messages: Record<string, string> = {
    LOGIN_FAILED: 'Email hoặc mật khẩu không đúng. Vui lòng kiểm tra lại.',
    INACTIVE_USER: 'Tài khoản đang bị khóa hoặc chưa sẵn sàng sử dụng. Vui lòng liên hệ quản trị viên.',
    INVALID_SESSION: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    INVALID_TOKEN: 'Phiên xác thực không hợp lệ hoặc đã hết hạn. Vui lòng thực hiện lại.',
    INVALID_OTP: 'Mã OTP không đúng hoặc đã hết hạn. Vui lòng kiểm tra email và nhập mã mới.',
    RATE_LIMITED: 'Bạn thao tác quá nhiều lần. Vui lòng chờ một lát rồi thử lại.',
    NETWORK_ERROR: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.',
    EMAIL_EXISTS: 'Email này đã tồn tại trong hệ thống.',
    USER_ALREADY_EXISTS: 'Tài khoản hoặc nhân viên này đã được liên kết.',
    DEPARTMENT_EXISTS: 'Mã hoặc tên phòng ban đã tồn tại. Vui lòng kiểm tra lại.',
    DEPARTMENT_NOT_FOUND: 'Không tìm thấy phòng ban. Danh sách có thể đã thay đổi.',
    POSITION_NOT_FOUND: 'Không tìm thấy chức danh. Danh sách có thể đã thay đổi.',
    FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
    EMAIL_NOT_CONFIGURED: 'Hệ thống email chưa được cấu hình. Vui lòng liên hệ quản trị viên.',
    EMAIL_DELIVERY_FAILED: 'Không gửi được email. Vui lòng kiểm tra địa chỉ email hoặc thử lại sau.',
    VALIDATION_ERROR: 'Thông tin gửi lên chưa hợp lệ. Vui lòng kiểm tra lại các trường nhập.',
    USER_DIRECTORY_UNAVAILABLE: 'Backend hiện tại chưa cung cấp API danh sách tài khoản (GET /api/users). Cần người phụ trách BE bổ sung API này để tải và lọc danh sách HR.',
  };
  const knownMessage = messages[error.code || ''];
  if (knownMessage) return knownMessage;

  const technicalMessage = error.message.toLowerCase();
  if (error.status === 409 && /số điện thoại|phone.*(?:already|duplicate|in use)/i.test(error.message)) {
    return 'Số điện thoại đã được sử dụng trong hồ sơ nhân viên khác. Vui lòng kiểm tra và nhập số khác.';
  }
  if (error.status === 409 && /inactive employees cannot be updated/.test(technicalMessage)) {
    return 'Không thể chỉnh sửa nhân viên đã ngừng hoạt động. Vui lòng tải lại hồ sơ.';
  }
  // These Vietnamese business conflicts explain why a change was rejected (for
  // example, same-day job changes). Do not replace them with an email error.
  if ((error.status === 409 || error.status === 422) && /[\u00c0-\u1ef9]/.test(error.message)) return error.message;
  if (error.status === 422 && /distance could not be calculated/.test(technicalMessage)) {
    return 'Chưa tính được khoảng cách từ địa chỉ mới. Vui lòng chọn địa chỉ từ danh sách gợi ý và thử lại. Hồ sơ chưa được cập nhật.';
  }
  if (error.status === 400 && /otp.*(invalid|expired)|one.time.password/.test(technicalMessage)) return messages.INVALID_OTP;
  if (error.status === 400 && error.message.trim() && !/^bad request$|^request failed with status \d+$/i.test(error.message.trim())) {
    return error.message;
  }
  if (error.status === 401 && /invalid email or password/.test(technicalMessage)) return messages.LOGIN_FAILED;
  if (error.status === 409 && /employee account must be active to view education|employee profile must be active/.test(technicalMessage)) {
    return 'Education is only available when the employee profile and account are active.';
  }
  if (error.status === 409 && /email.*already in use|email.*already exists/.test(technicalMessage)) return messages.EMAIL_EXISTS;
  if (error.status === 409 && /profile.*already exists|already has a profile|already linked/.test(technicalMessage)) return messages.USER_ALREADY_EXISTS;
  if (error.status === 409 && /department.*already exists/.test(technicalMessage)) return messages.DEPARTMENT_EXISTS;
  if (error.status === 404 && /department.*not found/.test(technicalMessage)) return messages.DEPARTMENT_NOT_FOUND;
  if (error.status === 404 && /position.*not found/.test(technicalMessage)) return messages.POSITION_NOT_FOUND;

  const statusMessages: Record<number, string> = {
    400: messages.VALIDATION_ERROR,
    401: messages.INVALID_SESSION,
    403: messages.FORBIDDEN,
    404: 'Không tìm thấy thông tin cần thiết. Dữ liệu có thể đã thay đổi; vui lòng tải lại và thử lại.',
    409: 'Thông tin đã thay đổi hoặc bị trùng. Vui lòng tải lại dữ liệu và kiểm tra lại.',
    413: 'Tệp tải lên vượt quá dung lượng cho phép. Vui lòng chọn tệp nhỏ hơn.',
    422: messages.VALIDATION_ERROR,
    429: messages.RATE_LIMITED,
  };
  if (statusMessages[error.status]) return statusMessages[error.status];

  if (error.status >= 500) {
    const serverMessages: Record<number, string> = {
      500: 'Hệ thống đang gặp sự cố khi xử lý yêu cầu. Vui lòng thử lại sau.',
      502: 'Máy chủ đang tạm thời không phản hồi. Vui lòng thử lại sau ít phút.',
      503: 'Dịch vụ hiện tạm thời không khả dụng. Vui lòng thử lại sau.',
      504: 'Yêu cầu mất quá nhiều thời gian để xử lý. Vui lòng thử lại.',
    };
    return serverMessages[error.status] || 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.';
  }

  if (/request failed with status \d+|bad request|unauthorized|forbidden|not found|conflict|unprocessable entity|payload too large/i.test(error.message)) {
    return fallback;
  }
  return error.message || fallback;
}

export interface ApiUserListResponse {
  data: ApiUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

function userWithRoleId(user: ApiUser): ApiUser {
  return { ...user, roleId: user.roleId ?? (typeof user.role === 'object' ? user.role?.id : undefined) };
}

async function request<T>(path: string, init?: RequestInit, baseOverride?: string): Promise<T> {
  const adminSession = sessionStorage.getItem('eris-api-backend') === 'admin';
  const adminResource = /^\/(users(?:\/|\?|$)|roles(?:\/|\?|$)|auth\/user_register$)/.test(path);
  if (!baseOverride && ADMIN_API_BASE_URL && adminResource && !adminSession) {
    throw new ApiError('Vui lòng đăng xuất và đăng nhập lại tài khoản admin để kết nối dịch vụ quản lý người dùng.', 401, 'ADMIN_SESSION_REQUIRED');
  }
  const base = baseOverride || (ADMIN_API_BASE_URL && adminSession ? ADMIN_API_BASE_URL : API_BASE_URL);
  const token = path === '/auth/login' ? null : sessionStorage.getItem('eris-access-token');
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    throw new ApiError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.', 0, 'NETWORK_ERROR');
  }

  const body = await response.json().catch(() => null) as { message?: string; code?: string; error?: { code?: string; message?: string } } | null;
  if (!response.ok) {
    throw new ApiError(body?.message || body?.error?.message || `Request failed with status ${response.status}.`, response.status, body?.code || body?.error?.code);
  }

  return body as T;
}

export async function login(email: string, password: string) {
  sessionStorage.setItem('eris-api-backend', 'primary');
  let result = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }, API_BASE_URL);
  if (ADMIN_API_BASE_URL && isAdminAccount(result.user)) {
    result = await request<LoginResponse>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }, ADMIN_API_BASE_URL);
    if (!isAdminAccount(result.user)) throw new ApiError('Admin account required.', 403, 'FORBIDDEN');
    sessionStorage.setItem('eris-api-backend', 'admin');
  }

  if (!result.accessToken && !result.passwordChangeToken) {
    throw new Error(result.message || 'Tài khoản cần hoàn tất đổi mật khẩu trước khi đăng nhập.');
  }

  if (result.accessToken) sessionStorage.setItem('eris-access-token', result.accessToken);
  return result;
}

export function changePassword(passwordChangeToken: string, currentPassword: string, otp: string, newPassword: string) {
  return request<{ message: string }>('/auth/change-password', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${passwordChangeToken}` },
    body: JSON.stringify({ currentPassword, otp, newPassword }),
  });
}

export function requestPasswordChangeOtp() {
  return request<{ message: string }>('/auth/change-password/otp', { method: 'POST' });
}

export async function getCurrentUser(signal?: AbortSignal) {
  const user = await request<ApiUser>('/auth/me', { signal, cache: 'no-store' });
  const adminSession = sessionStorage.getItem('eris-api-backend') === 'admin';
  if (ADMIN_API_BASE_URL && isAdminAccount(user) && !adminSession) {
    throw new ApiError('Vui lòng đăng nhập lại tài khoản admin.', 401, 'ADMIN_SESSION_REQUIRED');
  }
  return adminSession && isAdminAccount(user) && !user.role && !user.roleName
    ? { ...user, role: 'ADMIN' }
    : user;
}

export interface OwnEmployeeData {
  account: ApiUser;
  employee: EmployeeProfile | null;
  profileState: 'available' | 'unlinked' | 'unavailable';
}

export async function getOwnEmployeeData(signal?: AbortSignal): Promise<OwnEmployeeData> {
  const account = await getCurrentUser(signal);
  try {
    const result = await request<{ data: EmployeeProfile }>('/employees/me', { signal, cache: 'no-store' });
    const employee = result.data;
    return { account, employee, profileState: 'available' };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { account, employee: null, profileState: 'unlinked' };
    }
    if (error instanceof ApiError && (error.status === 403 || error.status === 400)) {
      return { account, employee: null, profileState: 'unavailable' };
    }
    throw error;
  }
}

export function logout() {
  return request<{ message: string }>('/auth/logout', { method: 'POST' });
}

export async function refreshSession() {
  const result = await request<{ accessToken: string }>('/auth/refresh', { method: 'POST' });
  sessionStorage.setItem('eris-access-token', result.accessToken);
  return result;
}

export async function restoreSession() {
  const accessToken = sessionStorage.getItem('eris-access-token');
  if (!accessToken) {
    await refreshSession();
    return getCurrentUser();
  }

  try {
    return await getCurrentUser();
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    await refreshSession();
    return getCurrentUser();
  }
}

export function requestPasswordReset(email: string) {
  return request<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(email: string, otp: string, newPassword: string) {
  return request<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, otp, newPassword }),
  });
}

export async function listUsers(params: { page?: number; limit?: number; search?: string; roleId?: number; status?: string } = {}, signal?: AbortSignal) {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 10),
  });
  if (params.search?.trim()) query.set('search', params.search.trim());
  if (params.roleId) query.set('roleId', String(params.roleId));
  if (params.status) query.set('status', params.status);
  try {
    const result = await request<ApiUserListResponse>(`/users?${query.toString()}`, { signal, cache: 'no-store' });
    return { ...result, data: result.data.map(userWithRoleId) };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new ApiError('User directory is unavailable on the current backend. HR account creation is still available. Contact the backend maintainer to enable the directory API.', 404, 'USER_DIRECTORY_UNAVAILABLE');
    }
    throw error;
  }
}

export function listEmployees(search = '') {
  const query = search ? `?page=1&limit=100&q=${encodeURIComponent(search)}` : '?page=1&limit=100';
  return request<{ data: ApiEmployee[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/employees${query}`);
}

export async function getUserById(id: number) {
  return userWithRoleId(await request<ApiUser>(`/users/${id}`));
}

export async function createUser(input: { email: string; roleId: number }) {
  const result = await request<ApiUser | { message: string; data: ApiUser & { emailDelivery?: string } }>('/auth/user_register', {
    method: 'POST',
    body: JSON.stringify({ email: input.email, roleId: input.roleId }),
  });
  return userWithRoleId('data' in result ? result.data : result);
}

export interface ApiRole { id: number; name: string; description?: string | null }

export function listRoles() {
  return request<{ data: ApiRole[] }>('/roles');
}

export async function updateUserStatus(id: number, status: string) {
  const result = await request<ApiUser | { data: ApiUser }>(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  return userWithRoleId('data' in result ? result.data : result);
}

export function updateUserRole(id: number, roleId: number) {
  return request<ApiUser>(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ roleId }) });
}

export interface ApiDepartment {
  id: number;
  code?: string;
  name: string;
  description: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
  created_at?: string;
  updated_at?: string;
}

export interface ApiDepartmentListResponse {
  data: ApiDepartment[];
  pagination?: { page: number; limit: number; has_more: boolean };
}

export async function listDepartments(signal?: AbortSignal, options: { page?: number; limit?: number; search?: string } = {}) {
  // The current BE returns the whole department directory; paging/search are applied client-side.
  const result = await request<{ data: ApiDepartment[] }>('/departments', { signal });
  const page = options.page ?? 1;
  const limit = options.limit ?? 100;
  const search = options.search?.trim().toLocaleLowerCase() || '';
  const filtered = result.data.filter(item => item.status !== 'INACTIVE'
    && (!search || `${item.code || ''} ${item.name}`.toLocaleLowerCase().includes(search)));
  const offset = (page - 1) * limit;
  return { data: filtered.slice(offset, offset + limit), pagination: { page, limit, has_more: offset + limit < filtered.length } };
}

export async function createDepartment(input: Pick<ApiDepartment, 'name' | 'description'>) {
  await assertDepartmentNameAvailable(input.name);
  const result = await request<{ data: ApiDepartment }>('/departments', { method: 'POST', body: JSON.stringify(input) });
  return result.data;
}

export async function updateDepartment(id: number, input: Pick<ApiDepartment, 'name' | 'description'>) {
  await assertDepartmentNameAvailable(input.name, id);
  const result = await request<{ data: ApiDepartment }>(`/departments/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
  return result.data;
}

async function assertDepartmentNameAvailable(name: string, excludedId?: number) {
  const result = await request<{ data: ApiDepartment[] }>('/departments');
  const normalized = name.trim().toLocaleLowerCase();
  if (result.data.some(item => item.id !== excludedId && item.name.trim().toLocaleLowerCase() === normalized)) {
    throw new ApiError('Department name already exists.', 409);
  }
}

export async function deactivateDepartment(id: number) {
  const result = await request<{ data: ApiDepartment }>(`/departments/${id}`, { method: 'DELETE' });
  return result.data;
}

export async function getDepartmentById(id: number, signal?: AbortSignal) {
  const result = await request<{ data: ApiDepartment[] }>('/departments', { signal, cache: 'no-store' });
  const department = result.data.find(item => item.id === id);
  if (!department) throw new ApiError('Department not found.', 404, 'DEPARTMENT_NOT_FOUND');
  return department;
}

export const POSITION_LEVELS = [
  { value: 1, label: 'Entry' }, { value: 2, label: 'Junior' },
  { value: 3, label: 'Intermediate' }, { value: 4, label: 'Senior' },
  { value: 5, label: 'Expert / Leadership' },
] as const;

export interface ApiPosition {
  id: number;
  code: string;
  name: string;
  jobLevel: number;
  departmentId?: number | null;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  updatedAt?: string;
}

export async function listPositions(signal?: AbortSignal, options: { page?: number; limit?: number; search?: string; departmentId?: number } = {}) {
  const query = options.departmentId ? `?departmentId=${encodeURIComponent(options.departmentId)}` : '';
  const result = await request<{ data: ApiPosition[] }>(`/positions${query}`, { signal });
  const search = options.search?.trim().toLocaleLowerCase() || '';
  const filtered = result.data.filter(item => item.status !== 'INACTIVE'
    && (!search || `${item.code} ${item.name}`.toLocaleLowerCase().includes(search)));
  const page = options.page ?? 1, limit = options.limit ?? 20, offset = (page - 1) * limit;
  return { data: filtered.slice(offset, offset + limit), pagination: { page, limit, has_more: offset + limit < filtered.length } };
}

export async function getPositionById(id: number, signal?: AbortSignal) {
  return (await request<{ data: ApiPosition }>(`/positions/${id}`, { signal })).data;
}

type PositionInput = Pick<ApiPosition, 'name' | 'jobLevel' | 'description'>;
export async function createPosition(input: PositionInput) {
  return (await request<{ data: ApiPosition }>('/positions', { method: 'POST', body: JSON.stringify(input) })).data;
}

export async function updatePosition(id: number, input: Partial<PositionInput>) {
  return (await request<{ data: ApiPosition }>(`/positions/${id}`, { method: 'PATCH', body: JSON.stringify(input) })).data;
}

export async function deactivatePosition(id: number) {
  // Team BE exposes DELETE /:id; the spreadsheet's /:id/status is not implemented upstream.
  return (await request<{ data: ApiPosition }>(`/positions/${id}`, { method: 'DELETE' })).data;
}

export interface PlaceSuggestion {
  refId: string;
  name: string;
  address: string;
  display: string;
  resolvedAddress: string;
  isCompleteAddress: boolean;
  latitude: number;
  longitude: number;
}

export function searchPlaces(query: string, signal?: AbortSignal) {
  return request<{ places: PlaceSuggestion[] }>(`/distance/places?query=${encodeURIComponent(query.trim())}`, { signal });
}

export interface EmployeeImportResult {
  row: number;
  status: 'CREATED' | 'FAILED';
  statusCode?: number;
  message?: string;
  data?: EmployeeProfile;
}

export interface EmployeeImportResponse {
  total: number;
  created: number;
  failed: number;
  results: EmployeeImportResult[];
}

export function importEmployees(file: File) {
  const body = new FormData();
  body.append('file', file);
  return request<EmployeeImportResponse>('/employees/import', {
    method: 'POST',
    body,
  });
}
