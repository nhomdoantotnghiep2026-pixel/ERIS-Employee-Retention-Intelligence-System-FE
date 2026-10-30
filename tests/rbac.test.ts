import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasRoutePermission } from '../src/utils/rbacAccess.ts';
const storage = new Map<string, string>();
test('positions require HR, matching the team BE', () => {
  assert.equal(hasRoutePermission('HR', '/positions'), true);
  for (const role of ['System Administrator', 'Data / AI Analyst', 'Employee / ESS'] as const) {
    assert.equal(hasRoutePermission(role, '/positions'), false);
  }
});
test('department management follows the team BE HR permission', () => {
  assert.equal(hasRoutePermission('HR', '/departments'), true);
  assert.equal(hasRoutePermission('System Administrator', '/departments'), false);
  for (const role of ['Data / AI Analyst', 'Employee / ESS'] as const) {
    assert.equal(hasRoutePermission(role, '/departments'), false);
  }
});
test('attendance history is available to HR only', () => {
  assert.equal(hasRoutePermission('HR', '/attendance'), true);
  for (const role of ['System Administrator', 'Data / AI Analyst', 'Employee / ESS'] as const) {
    assert.equal(hasRoutePermission(role, '/attendance'), false);
  }
});
test('workforce education and job history is available to HR only', () => {
  assert.equal(hasRoutePermission('HR', '/employee-history'), true);
  for (const role of ['System Administrator', 'Data / AI Analyst', 'Employee / ESS'] as const) {
    assert.equal(hasRoutePermission(role, '/employee-history'), false);
  }
});
test('employee import API is available to HR only', () => {
  assert.equal(hasRoutePermission('HR', '/employees/import'), true);
  for (const role of ['System Administrator', 'Data / AI Analyst', 'Employee / ESS'] as const) {
    assert.equal(hasRoutePermission(role, '/employees/import'), false);
  }
});
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null } });
test('stored permission grants cannot expand an actor beyond diagram route boundaries', () => {
  storage.set('eris-rbac-matrix-v3', JSON.stringify([{ items: [{ label: 'View Individual Risk Score', access: { 'Employee / ESS': true, 'Data / AI Analyst': true } }] }]));
  assert.equal(hasRoutePermission('Employee / ESS', '/employees/1/risk'), false);
  assert.equal(hasRoutePermission('Data / AI Analyst', '/employees/1/risk'), false);
});
test('stored admin policy can restrict access inside the permitted role routes', () => {
  storage.set('eris-rbac-matrix-v3', JSON.stringify([{ items: [{ label: 'Edit Employee Records', access: { 'Data / AI Analyst': false } }] }]));
  assert.equal(hasRoutePermission('Data / AI Analyst', '/employees/1/edit'), false);
  assert.equal(hasRoutePermission('Data / AI Analyst', '/employees'), true);
  storage.clear();
});
test('unsupported snapshot routes stay closed while outcome permissions keep their role defaults', () => {
  assert.equal(hasRoutePermission('HR', '/preparation'), false);
  assert.equal(hasRoutePermission('Data / AI Analyst', '/preparation'), false);
  assert.equal(hasRoutePermission('HR', '/outcomes'), true);
  assert.equal(hasRoutePermission('Data / AI Analyst', '/outcomes'), false);
  assert.equal(hasRoutePermission('Data / AI Analyst', '/predictions'), true);
});
