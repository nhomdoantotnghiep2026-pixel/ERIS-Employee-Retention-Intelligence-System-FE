import test from 'node:test';
import assert from 'node:assert/strict';
import { auditDateMatches } from '../src/utils/auditDateFilter.ts';

test('audit dates include both selected Vietnam calendar days, including midnight boundaries', () => {
  const from = '2026-11-11', to = '2026-11-11';
  assert.equal(auditDateMatches('2026-11-10T16:59:59.999Z', from, to), false);
  assert.equal(auditDateMatches('2026-11-10T17:00:00Z', from, to), true);
  assert.equal(auditDateMatches('2026-11-11T16:59:59.999Z', from, to), true);
  assert.equal(auditDateMatches('2026-11-11T17:00:00Z', from, to), false);
});

test('audit date ranges support either endpoint, no filter, invalid timestamps and reversed ranges', () => {
  assert.equal(auditDateMatches('2026-11-11T01:00:00Z', '2026-11-11', ''), true);
  assert.equal(auditDateMatches('2026-11-11T01:00:00Z', '', '2026-11-10'), false);
  assert.equal(auditDateMatches('2026-11-11T01:00:00Z', '', ''), true);
  assert.equal(auditDateMatches('invalid', '', ''), true);
  assert.equal(auditDateMatches('invalid', '2026-11-11', ''), false);
  assert.equal(auditDateMatches('2026-11-11T01:00:00Z', '2026-11-12', '2026-11-10'), false);
});
