import { test } from 'node:test';
import assert from 'node:assert/strict';
import { positionSelection } from '../src/utils/positionSelection.ts';

test('titles and levels follow the selected department and position', () => {
  const positions = [
    { id: 1, name: 'Support', code: 'A', jobLevel: 1, departmentId: 3 },
    { id: 2, name: 'Support', code: 'B', jobLevel: 2, departmentId: 3 },
    { id: 3, name: 'Manager', code: 'C', jobLevel: 4, departmentId: 3 },
    { id: 4, name: 'Support', code: 'D', jobLevel: 3, departmentId: 4 },
  ];
  assert.deepEqual(positionSelection(positions, '', '').titles, []);
  assert.deepEqual(positionSelection(positions, '3', '').titles, ['Support', 'Manager']);
  assert.deepEqual(positionSelection(positions, '3', 'Support').levels.map(p => p.id), [1, 2]);
  assert.deepEqual(positionSelection(positions, '4', 'Support').levels.map(p => p.id), [4]);
});
