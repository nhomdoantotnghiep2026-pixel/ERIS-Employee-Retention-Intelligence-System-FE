import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_USER_ROLES,
  LEGACY_USER_ROLES,
  ROLE_LIFECYCLE,
  ROLE_RESPONSIBILITIES,
  isActiveUserRole,
  isLegacyUserRole,
} from '../src/domain/roleContract.ts';
import { loginPortalForRole, mapApiRole } from '../src/utils/loginPortal.ts';

test('the product contract exposes exactly HR, Admin and Employee as active roles', () => {
  assert.deepEqual(ACTIVE_USER_ROLES, ['HR', 'System Administrator', 'Employee / ESS']);
  assert.deepEqual(Object.keys(ROLE_RESPONSIBILITIES), [...ACTIVE_USER_ROLES]);
  assert.ok(ACTIVE_USER_ROLES.every(role => ROLE_LIFECYCLE[role] === 'active'));
});

test('Data / AI Analyst is retained only as a disabled legacy compatibility actor', () => {
  assert.deepEqual(LEGACY_USER_ROLES, ['Data / AI Analyst']);
  assert.equal(ROLE_LIFECYCLE['Data / AI Analyst'], 'legacy');
  assert.equal(loginPortalForRole('Data / AI Analyst'), null);
  assert.equal(mapApiRole({ roleName: 'DATA_ANALYST' }), null);
});

test('role lifecycle helpers never classify legacy roles as active', () => {
  for (const role of ACTIVE_USER_ROLES) {
    assert.equal(isActiveUserRole(role), true);
    assert.equal(isLegacyUserRole(role), false);
  }
  assert.equal(isActiveUserRole('Data / AI Analyst'), false);
  assert.equal(isLegacyUserRole('Data / AI Analyst'), true);
  assert.equal(isActiveUserRole('Unknown'), false);
  assert.equal(isLegacyUserRole(null), false);
});
