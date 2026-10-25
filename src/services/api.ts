const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

export interface ApiUser {
  id: number;
  email: string;
  fullName?: string | null;
  employeeId?: number | null;
  role?: string | { name: string };
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
  distanceFromHomeKm: number | null;
  distanceCalculation: { status: string; reason?: string | null };
  account?: { email: string; status: string }; emailDelivery?: string; warning?: string;
}
export interface EmployeeInput {
  fullName: string; email: string; hireDate: string; departmentId: number; positionId: number;
  phone?: string | null; dateOfBirth?: string | null; gender?: string | null;
  address?: string | null; employmentType?: string | null; currentSalary?: number | null;
}
export type EmployeeChanges = Partial<Omit<EmployeeInput, 'email' | 'hireDate' | 'dateOfBirth'>>;
export async function listEmployeeProfiles(options: { page?: number; limit?: number; search?: string; departmentId?: number; positionId?: number; employmentStatus?: string } = {}, signal?: AbortSignal) {
  const query = new URLSearchParams({ page: String(options.page ?? 1), limit: String(options.limit ?? 20) });
  for (const [key, value] of Object.entries(options)) if (value !== undefined && value !== '') query.set(key, String(value));
  type Result = { data: EmployeeProfile[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
  try { return await request<Result>(`/employees?${query}`, { signal }); }
  catch (error) {
    if (!(error instanceof ApiError) || error.status !== 500 || signal?.aborted) throw error;
    // Current team BE has broken SQL pagination; use its unpaginated read as a fallback.
    query.delete('page'); query.delete('limit');
    const result = await request<Result>(`/employees?${query}`, { signal });
    const page = options.page ?? 1, limit = options.limit ?? 20, total = result.data.length;
    return { data: result.data.slice((page - 1) * limit, page * limit), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
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
  if (!(error instanceof ApiError)) return error instanceof Error ? error.message : fallback;
  const messages: Record<string, string> = {
    LOGIN_FAILED: 'Email hoặc mật khẩu không đúng. Vui lòng kiểm tra lại.',
    INACTIVE_USER: 'Tài khoản đang bị khóa hoặc chưa sẵn sàng sử dụng. Vui lòng liên hệ quản trị viên.',
    INVALID_SESSION: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    INVALID_TOKEN: 'Phiên xác thực không hợp lệ hoặc đã hết hạn. Vui lòng thực hiện lại.',
    INVALID_OTP: 'Mã OTP không đúng hoặc đã hết hạn. Vui lòng kiểm tra email và nhập mã mới.',
    RATE_LIMITED: 'Bạn thao tác quá nhiều lần. Vui lòng chờ một lát rồi thử lại.',
    NETWORK_ERROR: 'Không kết nối được máy chủ. Vui lòng kiểm tra backend và thử lại.',
    EMAIL_EXISTS: 'Email này đã tồn tại trong hệ thống.',
    USER_ALREADY_EXISTS: 'Tài khoản hoặc nhân viên này đã được liên kết.',
    FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
    EMAIL_NOT_CONFIGURED: 'Hệ thống email chưa được cấu hình. Vui lòng liên hệ quản trị viên.',
    EMAIL_DELIVERY_FAILED: 'Không gửi được email. Vui lòng kiểm tra địa chỉ email hoặc thử lại sau.',
    VALIDATION_ERROR: 'Thông tin gửi lên chưa hợp lệ. Vui lòng kiểm tra lại các trường nhập.',
  };
  return messages[error.code || ''] || error.message || fallback;
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = sessionStorage.getItem('eris-access-token');
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    throw new ApiError('Không kết nối được máy chủ. Vui lòng kiểm tra backend và thử lại.', 0, 'NETWORK_ERROR');
  }

  const body = await response.json().catch(() => null) as { message?: string; code?: string; error?: { code?: string; message?: string } } | null;
  if (!response.ok) {
    throw new ApiError(body?.message || body?.error?.message || `Request failed with status ${response.status}.`, response.status, body?.code || body?.error?.code);
  }

  return body as T;
}

export async function login(email: string, password: string) {
  const result = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

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

export function getCurrentUser(signal?: AbortSignal) {
  return request<ApiUser>('/auth/me', { signal, cache: 'no-store' });
}

export interface OwnEmployeeData {
  account: ApiUser;
  employee: EmployeeProfile | null;
  profileState: 'available' | 'unlinked' | 'unavailable';
}

export async function getOwnEmployeeData(signal?: AbortSignal): Promise<OwnEmployeeData> {
  const account = await getCurrentUser(signal);
  // Omitted employeeId is not evidence that the account has no linked employee.
  if (account.employeeId === undefined) return { account, employee: null, profileState: 'unavailable' };
  if (account.employeeId === null) return { account, employee: null, profileState: 'unlinked' };
  const employeeId = Number(account.employeeId);
  if (!Number.isSafeInteger(employeeId) || employeeId <= 0) throw new ApiError('Invalid employee profile link.', 502, 'INVALID_PROFILE_LINK');
  try {
    const employee = await getEmployeeProfile(employeeId, signal);
    if (Number(employee.id) !== employeeId) throw new ApiError('Invalid employee profile response.', 502, 'INVALID_PROFILE_LINK');
    return { account, employee, profileState: 'available' };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
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

export function listUsers(options: string | { page?: number; limit?: number; search?: string; roleId?: number; status?: string } = {}) {
  const filters = typeof options === 'string' ? { search: options } : options;
  const query = new URLSearchParams({
    page: String(filters.page ?? 1),
    limit: String(filters.limit ?? 100),
  });
  if (filters.search?.trim()) query.set('search', filters.search.trim());
  if (filters.roleId !== undefined) query.set('roleId', String(filters.roleId));
  if (filters.status) query.set('status', filters.status);
  return request<ApiUserListResponse>(`/users?${query}`);
}

export function listEmployees(search = '') {
  const query = search ? `?page=1&limit=100&q=${encodeURIComponent(search)}` : '?page=1&limit=100';
  return request<{ data: ApiEmployee[]; pagination: { page: number; limit: number; has_more: boolean } }>(`/v1/employees${query}`);
}

export function getUserById(id: number) {
  return request<ApiUser>(`/users/${id}`);
}

export async function createUser(input: { email: string; roleId: number }) {
  const result = await request<{ message: string; data: ApiUser }>('/auth/user_register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return result.data;
}

export interface ApiRole { id: number; name: string; description?: string | null }

export function listRoles() {
  return request<{ data: ApiRole[] }>('/roles');
}

export function updateUserStatus(id: number, status: string) {
  return request<ApiUser>(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
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
  // The team BE returns the whole directory; it does not implement query paging.
  const result = await request<{ data: ApiDepartment[] }>('/departments/listDepartments', { signal });
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
  const result = await request<{ data: ApiDepartment }>(`/departments/${id}`, { signal });
  return result.data;
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
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  updatedAt?: string;
}

export async function listPositions(signal?: AbortSignal, options: { page?: number; limit?: number; search?: string } = {}) {
  const result = await request<{ data: ApiPosition[] }>('/positions', { signal });
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
