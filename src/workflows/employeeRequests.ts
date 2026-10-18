import type { WorkflowRequest, WorkflowRequestStatus, WorkflowRequestType } from '../services/employeeWorkflow.ts';

export const REQUESTS_KEY = 'eris-employee-requests-demo-v1';
export const REQUESTS_EVENT = 'eris-employee-requests-updated';

export function buildRequest(input: { employeeEmail: string; employeeName: string; type: WorkflowRequestType; date: string; detail: string }): WorkflowRequest {
  if (!input.employeeEmail.trim() || !input.employeeName.trim() || !input.detail.trim()) throw new Error('Vui lòng nhập đầy đủ người gửi và lý do.');
  if (!['Annual leave', 'Overtime', 'Shift change', 'Remote work'].includes(input.type)) throw new Error('Loại yêu cầu không hợp lệ.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0, 10) !== input.date) throw new Error('Vui lòng chọn ngày hợp lệ.');
  return { id: crypto.randomUUID(), employee_email: input.employeeEmail.trim(), employee_name: input.employeeName.trim(), request_type: input.type, requested_date: input.date, detail: input.detail.trim(), status: 'Pending', created_at: new Date().toISOString() };
}

export function decideRequest(rows: WorkflowRequest[], id: string, status: Exclude<WorkflowRequestStatus, 'Pending'>, reviewerEmail: string, note = ''): WorkflowRequest[] {
  const request = rows.find(row => row.id === id);
  if (!request || request.status !== 'Pending') throw new Error('Yêu cầu này đã được xử lý hoặc không còn tồn tại.');
  if (!reviewerEmail.trim() || !['Approved', 'Rejected'].includes(status)) throw new Error('Thông tin duyệt không hợp lệ.');
  if (status === 'Rejected' && !note.trim()) throw new Error('Vui lòng ghi lý do từ chối để nhân viên biết kết quả.');
  return rows.map(row => row.id === id ? { ...row, status, reviewer_email: reviewerEmail, reviewer_note: note.trim() || null, reviewed_at: new Date().toISOString() } : row);
}

function readRequests(): WorkflowRequest[] {
  const stored = sessionStorage.getItem(REQUESTS_KEY);
  if (!stored) return [];
  const rows = JSON.parse(stored);
  if (!Array.isArray(rows)) throw new Error('Không thể đọc lịch sử yêu cầu đã lưu.');
  return rows;
}

function saveRequests(rows: WorkflowRequest[]) {
  sessionStorage.setItem(REQUESTS_KEY, JSON.stringify(rows));
  window.dispatchEvent(new Event(REQUESTS_EVENT));
}

// Shared frontend demo for the ESS → HR → ESS review journey. No network writes.
export async function listEmployeeRequests(employeeEmail?: string) {
  return readRequests().filter(row => !employeeEmail || row.employee_email === employeeEmail);
}
export async function createEmployeeRequest(input: Parameters<typeof buildRequest>[0]) {
  const request = buildRequest(input);
  saveRequests([request, ...readRequests()]);
  return request;
}
export async function reviewEmployeeRequest(id: string, status: Exclude<WorkflowRequestStatus, 'Pending'>, reviewerEmail: string, note?: string) {
  const rows = decideRequest(readRequests(), id, status, reviewerEmail, note);
  saveRequests(rows);
  return rows.find(row => row.id === id)!;
}
