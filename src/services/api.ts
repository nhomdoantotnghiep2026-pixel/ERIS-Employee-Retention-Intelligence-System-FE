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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

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

export function getCurrentUser() {
  return request<ApiUser>('/auth/me');
}

export function logout() {
  return request<{ message: string }>('/auth/logout', { method: 'POST' });
}

export function refreshSession() {
  return request<{ accessToken: string }>('/auth/refresh', { method: 'POST' });
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

export function listUsers(search = '') {
  const query = search ? `?page=1&limit=100&search=${encodeURIComponent(search)}` : '?page=1&limit=100';
  return request<ApiUserListResponse>(`/users${query}`);
}

export function listEmployees(search = '') {
  const query = search ? `?page=1&limit=100&q=${encodeURIComponent(search)}` : '?page=1&limit=100';
  return request<{ data: ApiEmployee[]; pagination: { page: number; limit: number; has_more: boolean } }>(`/v1/employees${query}`);
}

export function getUserById(id: number) {
  return request<ApiUser>(`/users/${id}`);
}

export function createUser(input: { email: string; employeeId: number | null; roleId: number }) {
  return request<ApiUser>('/auth/user_register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateUserStatus(id: number, status: string) {
  return request<ApiUser>(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export function updateUserRole(id: number, roleId: number) {
  return request<ApiUser>(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ roleId }) });
}
