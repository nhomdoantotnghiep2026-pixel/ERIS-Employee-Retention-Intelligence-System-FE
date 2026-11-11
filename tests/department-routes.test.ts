import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessRoute } from '../src/workflows/access.ts';

test('department detail and edit routes retain the HR-only access policy', () => {
  for (const path of ['/departments/7', '/departments/7/edit']) {
    assert.equal(canAccessRoute('HR', path), true);
    for (const role of ['System Administrator', 'Employee / ESS', 'Data / AI Analyst']) assert.equal(canAccessRoute(role, path), false);
  }
});
