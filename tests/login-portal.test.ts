import test from 'node:test';
import assert from 'node:assert/strict';
import { loginPortalForRole, mapApiRole, portalAllowsRole, workspaceRoleForPortal } from '../src/utils/loginPortal.ts';
import type { UserRole } from '../src/context/RoleContext.tsx';

test('login portals allow HR to choose management or employee workspace without opening it to admin', () => {
  assert.equal(loginPortalForRole('HR'), 'management');
  assert.equal(portalAllowsRole('management', 'HR'), true);
  assert.equal(portalAllowsRole('employee', 'HR'), true);

  assert.equal(loginPortalForRole('System Administrator'), 'management');
  assert.equal(portalAllowsRole('management', 'System Administrator'), true);
  assert.equal(portalAllowsRole('employee', 'System Administrator'), false);

  assert.equal(loginPortalForRole('Employee / ESS'), 'employee');
  assert.equal(portalAllowsRole('employee', 'Employee / ESS'), true);
  assert.equal(portalAllowsRole('management', 'Employee / ESS'), false);

  assert.equal(loginPortalForRole('Data / AI Analyst'), null);
  assert.equal(portalAllowsRole('management', 'Data / AI Analyst'), false);
  assert.equal(portalAllowsRole('employee', 'Data / AI Analyst'), false);
});

test('an HR account uses the ESS route policy only while working in the employee portal', () => {
  assert.equal(workspaceRoleForPortal('management', 'HR'), 'HR');
  assert.equal(workspaceRoleForPortal('employee', 'HR'), 'Employee / ESS');
  assert.equal(workspaceRoleForPortal('employee', 'Employee / ESS'), 'Employee / ESS');
  assert.equal(workspaceRoleForPortal('management', 'System Administrator'), 'System Administrator');
});

test('API roles are mapped by their authoritative names and never guessed from a missing role', () => {
  assert.equal(mapApiRole({ role: 'HR' }), 'HR');
  assert.equal(mapApiRole({ roleName: 'ADMIN' }), 'System Administrator');
  assert.equal(mapApiRole({ role: { name: 'EMPLOYEE' } }), 'Employee / ESS');
  assert.equal(mapApiRole({ role: 'Employee / ESS' }), 'Employee / ESS');
  assert.equal(mapApiRole({}), null);
  assert.equal(mapApiRole({ roleName: 'DATA_ANALYST' }), null);
});
