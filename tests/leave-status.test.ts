import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leaveStatusDescription } from '../src/utils/leaveStatus.ts';

test('cancellation messages preserve whether the original leave was approved', () => {
  assert.match(leaveStatusDescription('CANCEL_REQUESTED', 'PENDING'), /chưa được duyệt/);
  assert.match(leaveStatusDescription('CANCEL_REQUESTED', 'APPROVED'), /vẫn có hiệu lực/);
  assert.match(leaveStatusDescription('CANCEL_REJECTED', 'PENDING'), /vẫn chờ duyệt/);
  assert.match(leaveStatusDescription('CANCEL_REJECTED', 'APPROVED'), /vẫn có hiệu lực/);
  assert.equal(leaveStatusDescription('CANCELLED', 'CANCELLED'), '');
});
