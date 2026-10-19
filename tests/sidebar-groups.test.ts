import test from 'node:test';
import assert from 'node:assert/strict';
import { readSidebarGroups, saveSidebarGroups } from '../src/utils/sidebarGroups.ts';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
} });

test('opened menu groups survive page remounts and explicit closing stays respected', () => {
  storage.clear();
  const available = ['Overview', 'Workforce', 'Retention'];
  assert.deepEqual(readSidebarGroups('HR', available, 'Overview'), ['Overview']);
  saveSidebarGroups('HR', ['Overview', 'Workforce', 'Retention']);
  assert.deepEqual(readSidebarGroups('HR', available, 'Workforce'), available);
  saveSidebarGroups('HR', ['Overview', 'Retention']);
  assert.deepEqual(readSidebarGroups('HR', available, 'Workforce'), ['Overview', 'Retention']);
  saveSidebarGroups('HR', []);
  assert.deepEqual(readSidebarGroups('HR', available, 'Overview'), []);
});

test('the four actors retain independent expanded group choices', () => {
  storage.clear();
  const choices = {
    HR: ['Overview', 'Workforce'],
    'Data / AI Analyst': ['Data Management', 'AI Models'],
    'System Administrator': ['Access Control', 'System Operations'],
    'Employee / ESS': ['My Workspace', 'Self Service'],
  } as const;
  for (const role of Object.keys(choices) as (keyof typeof choices)[]) saveSidebarGroups(role, [...choices[role]]);
  for (const role of Object.keys(choices) as (keyof typeof choices)[]) assert.deepEqual(readSidebarGroups(role, [...choices[role]]), choices[role]);
  saveSidebarGroups('HR', []);
  assert.deepEqual(readSidebarGroups('Data / AI Analyst', [...choices['Data / AI Analyst']]), choices['Data / AI Analyst']);
});

test('malformed stored state is recoverable and unavailable groups are excluded', () => {
  storage.clear();
  storage.set('eris-sidebar-groups-v1:HR', '{invalid');
  assert.deepEqual(readSidebarGroups('HR', ['Overview'], 'Overview'), ['Overview']);
  storage.set('eris-sidebar-groups-v1:HR', JSON.stringify(['Overview', 'Access Control', 'Overview']));
  assert.deepEqual(readSidebarGroups('HR', ['Overview'], 'Overview'), ['Overview']);
});
