import type { ActiveUserRole } from '../domain/roleContract.ts';

export type WorkNotificationCategory =
  | 'retention'
  | 'survey'
  | 'attendance'
  | 'request'
  | 'access'
  | 'system';

export type WorkNotificationPriority = 'high' | 'medium' | 'low';

export interface LocalizedMessage {
  vi: string;
  en: string;
}

export interface WorkNotification {
  id: string;
  category: WorkNotificationCategory;
  priority: WorkNotificationPriority;
  title: LocalizedMessage;
  detail: LocalizedMessage;
  actionLabel: LocalizedMessage;
  actionTo: string;
  actionRequired: boolean;
  createdAt: string;
  readAt: string | null;
  archivedAt: string | null;
}

export interface WorkInboxScope {
  role: ActiveUserRole;
  userKey: string;
}

export interface WorkInboxStats {
  total: number;
  unread: number;
  actionRequired: number;
  highPriority: number;
  archived: number;
}

type Seed = Omit<WorkNotification, 'createdAt' | 'readAt' | 'archivedAt'> & {
  ageMinutes: number;
};

const STORAGE_PREFIX = 'eris-work-inbox-v1';
export const WORK_INBOX_UPDATED_EVENT = 'eris-work-inbox-updated';

const seedByRole: Record<ActiveUserRole, Seed[]> = {
  HR: [
    {
      id: 'hr-retention-review',
      category: 'retention',
      priority: 'high',
      title: { vi: 'Hồ sơ gắn kết cần xem xét', en: 'Engagement case needs review' },
      detail: { vi: 'Có kết quả phân tích AI mới cần HR kiểm tra bối cảnh và quyết định bước tiếp theo.', en: 'A new AI analysis result needs HR context review and a next-step decision.' },
      actionLabel: { vi: 'Mở phân tích AI', en: 'Open AI analysis' },
      actionTo: '/ai-analysis',
      actionRequired: true,
      ageMinutes: 18,
    },
    {
      id: 'hr-leave-queue',
      category: 'request',
      priority: 'medium',
      title: { vi: 'Yêu cầu nghỉ phép đang chờ', en: 'Leave requests are waiting' },
      detail: { vi: 'Kiểm tra các yêu cầu mới và phản hồi nhân viên trong thời hạn xử lý.', en: 'Review new requests and respond to employees within the handling window.' },
      actionLabel: { vi: 'Mở yêu cầu', en: 'Open requests' },
      actionTo: '/employee-requests',
      actionRequired: true,
      ageMinutes: 95,
    },
    {
      id: 'hr-survey-results',
      category: 'survey',
      priority: 'low',
      title: { vi: 'Đã có tổng quan khảo sát', en: 'Survey overview is available' },
      detail: { vi: 'Kết quả mới nhất đã sẵn sàng để HR xem mức độ phản hồi và điểm hài lòng.', en: 'The latest response rate and satisfaction overview is ready for HR review.' },
      actionLabel: { vi: 'Xem khảo sát', en: 'View surveys' },
      actionTo: '/engagement',
      actionRequired: false,
      ageMinutes: 310,
    },
    {
      id: 'hr-attendance-review',
      category: 'attendance',
      priority: 'medium',
      title: { vi: 'Dữ liệu chấm công cần đối chiếu', en: 'Attendance data needs review' },
      detail: { vi: 'Một số bản ghi tháng hiện tại có tín hiệu đi muộn hoặc về sớm cần kiểm tra.', en: 'Some current-month records show late-arrival or early-leave signals that need review.' },
      actionLabel: { vi: 'Mở chấm công', en: 'Open attendance' },
      actionTo: '/attendance/dashboard',
      actionRequired: true,
      ageMinutes: 1_580,
    },
  ],
  'System Administrator': [
    {
      id: 'admin-access-review',
      category: 'access',
      priority: 'high',
      title: { vi: 'Đến hạn rà soát quyền truy cập', en: 'Access review is due' },
      detail: { vi: 'Kiểm tra trạng thái tài khoản và phạm vi quyền của người dùng đang hoạt động.', en: 'Review active account status and assigned access scopes.' },
      actionLabel: { vi: 'Mở tài khoản', en: 'Open accounts' },
      actionTo: '/users',
      actionRequired: true,
      ageMinutes: 35,
    },
    {
      id: 'admin-audit-review',
      category: 'system',
      priority: 'medium',
      title: { vi: 'Có hoạt động mới trong nhật ký', en: 'New activity is available' },
      detail: { vi: 'Nhật ký hệ thống có thao tác mới cần được kiểm tra trong đợt rà soát định kỳ.', en: 'The system log contains new activity for the scheduled review.' },
      actionLabel: { vi: 'Xem nhật ký', en: 'View audit log' },
      actionTo: '/activity',
      actionRequired: false,
      ageMinutes: 140,
    },
    {
      id: 'admin-health-check',
      category: 'system',
      priority: 'low',
      title: { vi: 'Kiểm tra trạng thái dịch vụ', en: 'Review service health' },
      detail: { vi: 'Chạy lại kiểm tra kết nối API và phiên đăng nhập trước buổi demo.', en: 'Recheck API connectivity and the active session before the demo.' },
      actionLabel: { vi: 'Mở trạng thái hệ thống', en: 'Open system health' },
      actionTo: '/system-health',
      actionRequired: true,
      ageMinutes: 1_450,
    },
  ],
  'Employee / ESS': [
    {
      id: 'employee-survey',
      category: 'survey',
      priority: 'high',
      title: { vi: 'Bạn có khảo sát đang mở', en: 'You have an open survey' },
      detail: { vi: 'Hoàn thành khảo sát được giao trước ngày kết thúc để phản hồi của bạn được ghi nhận.', en: 'Complete the assigned survey before it closes so your feedback is recorded.' },
      actionLabel: { vi: 'Trả lời khảo sát', en: 'Answer survey' },
      actionTo: '/my-surveys',
      actionRequired: true,
      ageMinutes: 22,
    },
    {
      id: 'employee-leave-status',
      category: 'request',
      priority: 'medium',
      title: { vi: 'Yêu cầu của bạn đã được cập nhật', en: 'Your request was updated' },
      detail: { vi: 'Mở danh sách yêu cầu để xem trạng thái và phản hồi mới nhất từ HR.', en: 'Open your requests to see the latest status and HR response.' },
      actionLabel: { vi: 'Xem yêu cầu', en: 'View requests' },
      actionTo: '/my-requests',
      actionRequired: false,
      ageMinutes: 125,
    },
    {
      id: 'employee-attendance',
      category: 'attendance',
      priority: 'low',
      title: { vi: 'Nhắc kiểm tra chấm công', en: 'Attendance reminder' },
      detail: { vi: 'Kiểm tra bản ghi chấm công hôm nay và báo HR nếu thông tin chưa chính xác.', en: 'Review today’s attendance record and contact HR if anything is incorrect.' },
      actionLabel: { vi: 'Mở chấm công', en: 'Open attendance' },
      actionTo: '/my-attendance',
      actionRequired: true,
      ageMinutes: 430,
    },
  ],
};

const safeUserKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9@._-]+/g, '-');
const storageKey = (scope: WorkInboxScope) => `${STORAGE_PREFIX}:${scope.role}:${safeUserKey(scope.userKey)}`;

function nowIso(now?: Date | string) {
  const date = now instanceof Date ? now : now ? new Date(now) : new Date();
  return date.toISOString();
}

function initialNotifications(role: ActiveUserRole, now?: Date | string): WorkNotification[] {
  const current = new Date(nowIso(now)).getTime();
  return seedByRole[role].map(seed => {
    const { ageMinutes, ...item } = seed;
    return {
      ...item,
      createdAt: new Date(current - ageMinutes * 60_000).toISOString(),
      readAt: null,
      archivedAt: null,
    };
  });
}

function read(scope: WorkInboxScope, now?: Date | string): WorkNotification[] {
  try {
    const saved = localStorage.getItem(storageKey(scope));
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed as WorkNotification[];
    }
  } catch {
    // A private browser mode may disable storage; the inbox remains usable in memory.
  }
  const initial = initialNotifications(scope.role, now);
  write(scope, initial, false);
  return initial;
}

function write(scope: WorkInboxScope, items: WorkNotification[], announce = true) {
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify(items));
  } catch {
    // Keep the current render usable if persistence is unavailable.
  }
  if (announce && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WORK_INBOX_UPDATED_EVENT, { detail: scope }));
  }
}

function update(scope: WorkInboxScope, id: string, change: (item: WorkNotification) => WorkNotification, now?: Date | string) {
  const items = read(scope, now).map(item => item.id === id ? change(item) : item);
  write(scope, items);
  return items;
}

export function listWorkNotifications(scope: WorkInboxScope, now?: Date | string) {
  return read(scope, now).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function markWorkNotification(scope: WorkInboxScope, id: string, readState: boolean, now?: Date | string) {
  const timestamp = nowIso(now);
  return update(scope, id, item => ({ ...item, readAt: readState ? timestamp : null }), now);
}

export function markAllWorkNotificationsRead(scope: WorkInboxScope, now?: Date | string) {
  const timestamp = nowIso(now);
  const items = read(scope, now).map(item => item.archivedAt ? item : { ...item, readAt: item.readAt || timestamp });
  write(scope, items);
  return items;
}

export function archiveWorkNotification(scope: WorkInboxScope, id: string, archived: boolean, now?: Date | string) {
  const timestamp = nowIso(now);
  return update(scope, id, item => ({ ...item, archivedAt: archived ? timestamp : null }), now);
}

export function workInboxStats(items: WorkNotification[]): WorkInboxStats {
  const active = items.filter(item => !item.archivedAt);
  return {
    total: active.length,
    unread: active.filter(item => !item.readAt).length,
    actionRequired: active.filter(item => item.actionRequired).length,
    highPriority: active.filter(item => item.priority === 'high').length,
    archived: items.filter(item => item.archivedAt).length,
  };
}

export function resetWorkInbox(scope: WorkInboxScope, now?: Date | string) {
  const items = initialNotifications(scope.role, now);
  write(scope, items);
  return items;
}

export function subscribeWorkInbox(listener: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  const localUpdate = () => listener();
  const storageUpdate = (event: StorageEvent) => {
    if (event.key?.startsWith(STORAGE_PREFIX)) listener();
  };
  window.addEventListener(WORK_INBOX_UPDATED_EVENT, localUpdate);
  window.addEventListener('storage', storageUpdate);
  return () => {
    window.removeEventListener(WORK_INBOX_UPDATED_EVENT, localUpdate);
    window.removeEventListener('storage', storageUpdate);
  };
}
