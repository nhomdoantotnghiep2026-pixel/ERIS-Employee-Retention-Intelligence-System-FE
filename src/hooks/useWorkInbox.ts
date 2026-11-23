import { useCallback, useEffect, useMemo, useState } from 'react';
import { isActiveUserRole, type UserRole } from '../domain/roleContract.ts';
import {
  archiveWorkNotification,
  listWorkNotifications,
  markAllWorkNotificationsRead,
  markWorkNotification,
  resetWorkInbox,
  subscribeWorkInbox,
  workInboxStats,
  type WorkInboxScope,
} from '../services/workInbox.ts';

export function useWorkInbox(role: UserRole, userKey: string) {
  const scope = useMemo<WorkInboxScope | null>(
    () => isActiveUserRole(role) ? { role, userKey } : null,
    [role, userKey],
  );
  const [revision, setRevision] = useState(0);

  useEffect(() => subscribeWorkInbox(() => setRevision(value => value + 1)), []);

  const items = useMemo(
    () => scope ? listWorkNotifications(scope) : [],
    [scope, revision],
  );
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  return {
    items,
    stats: workInboxStats(items),
    markRead: (id: string, read = true) => {
      if (scope) markWorkNotification(scope, id, read);
    },
    markAllRead: () => {
      if (scope) markAllWorkNotificationsRead(scope);
    },
    archive: (id: string, archived = true) => {
      if (scope) archiveWorkNotification(scope, id, archived);
    },
    reset: () => {
      if (scope) resetWorkInbox(scope);
    },
    refresh,
  };
}
