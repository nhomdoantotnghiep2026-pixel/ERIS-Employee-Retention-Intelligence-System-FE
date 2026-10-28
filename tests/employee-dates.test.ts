import test from 'node:test';
import assert from 'node:assert/strict';
import { employeeDate, jobChangeDateRestriction } from '../src/utils/employeeDates.ts';

test('employee calendar dates are preserved and ISO timestamps use Vietnam date', () => {
  assert.equal(employeeDate('2027-07-10'), '2027-07-10');
  assert.equal(employeeDate('2027-07-09T17:00:00.000Z'), '2027-07-10');
  assert.equal(employeeDate('2004-03-23T17:00:00.000Z'), '2004-03-24');
  assert.equal(employeeDate(null), '');
  assert.equal(employeeDate('invalid'), '');
});

test('job changes respect the Vietnam hiring date rather than the UTC day', () => {
  const now = new Date('2026-10-28T18:00:00Z'); // October 29 in Vietnam.
  assert.equal(jobChangeDateRestriction('2027-07-10', now), 'future');
  assert.equal(jobChangeDateRestriction('2026-10-28T17:00:00Z', now), 'today');
  assert.equal(jobChangeDateRestriction('2026-10-28', now), null);
});
