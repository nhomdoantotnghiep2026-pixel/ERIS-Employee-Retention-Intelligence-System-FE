import test from 'node:test';
import assert from 'node:assert/strict';
import {
  archiveWorkNotification,
  listWorkNotifications,
  markAllWorkNotificationsRead,
  markWorkNotification,
  resetWorkInbox,
  workInboxStats,
  type WorkInboxScope,
} from '../src/services/workInbox.ts';
import { canAccessRoute } from '../src/workflows/access.ts';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  },
});

const now = '2026-11-23T10:00:00.000Z';

test('active roles receive only actionable notifications for routes they can access', () => {
  values.clear();
  const scopes: WorkInboxScope[] = [
    { role: 'HR', userKey: 'hr@eris.test' },
    { role: 'System Administrator', userKey: 'admin@eris.test' },
    { role: 'Employee / ESS', userKey: 'employee@eris.test' },
  ];

  for (const scope of scopes) {
    const items = listWorkNotifications(scope, now);
    assert.ok(items.length >= 3, `${scope.role} should have demo work items`);
    assert.equal(new Set(items.map(item => item.id)).size, items.length);
    for (const item of items) assert.equal(canAccessRoute(scope.role, item.actionTo), true, `${scope.role} cannot access ${item.actionTo}`);
  }

  assert.equal(canAccessRoute('Data / AI Analyst', '/notifications'), false);
});

test('read state, mark-all, archive and restore persist per user', () => {
  values.clear();
  const scope: WorkInboxScope = { role: 'HR', userKey: 'state@eris.test' };
  const initial = listWorkNotifications(scope, now);
  assert.equal(workInboxStats(initial).unread, initial.length);

  markWorkNotification(scope, initial[0].id, true, now);
  assert.equal(workInboxStats(listWorkNotifications(scope, now)).unread, initial.length - 1);

  markAllWorkNotificationsRead(scope, now);
  assert.equal(workInboxStats(listWorkNotifications(scope, now)).unread, 0);

  archiveWorkNotification(scope, initial[0].id, true, now);
  let stats = workInboxStats(listWorkNotifications(scope, now));
  assert.equal(stats.total, initial.length - 1);
  assert.equal(stats.archived, 1);

  archiveWorkNotification(scope, initial[0].id, false, now);
  stats = workInboxStats(listWorkNotifications(scope, now));
  assert.equal(stats.total, initial.length);
  assert.equal(stats.archived, 0);
});

test('reset restores the role demo inbox without affecting another user', () => {
  values.clear();
  const first: WorkInboxScope = { role: 'Employee / ESS', userKey: 'first@eris.test' };
  const second: WorkInboxScope = { role: 'Employee / ESS', userKey: 'second@eris.test' };
  const firstItem = listWorkNotifications(first, now)[0];
  const secondItem = listWorkNotifications(second, now)[0];

  markWorkNotification(first, firstItem.id, true, now);
  assert.equal(listWorkNotifications(first, now)[0].readAt, now);
  assert.equal(listWorkNotifications(second, now)[0].readAt, null);

  resetWorkInbox(first, now);
  assert.equal(listWorkNotifications(first, now)[0].readAt, null);
  assert.equal(secondItem.readAt, null);
});
