import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAccountCandidates } from '../src/utils/employeeAccountCandidates.ts';

test('pending employee search supports code, accent-insensitive name and email without changing source', () => {
  const items = [
    { id: 1, employeeCode: 'EMP001', fullName: 'Nguyễn Minh Khang', email: 'khang@example.test' },
    { id: 2, employeeCode: 'EMP002', fullName: 'Đặng Thảo Vy', email: 'vy@example.test' },
  ];
  assert.deepEqual(filterAccountCandidates(items, 'emp001').map(x => x.id), [1]);
  assert.deepEqual(filterAccountCandidates(items, ' DANG  thao ').map(x => x.id), [2]);
  assert.deepEqual(filterAccountCandidates(items, 'NGUYEN khang@').map(x => x.id), [1]);
  assert.deepEqual(filterAccountCandidates(items, 'missing'), []);
  assert.deepEqual(filterAccountCandidates(items, ''), items);
  assert.equal(items.length, 2);
});
