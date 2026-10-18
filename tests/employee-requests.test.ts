import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRequest, decideRequest, createEmployeeRequest, listEmployeeRequests, reviewEmployeeRequest } from '../src/workflows/employeeRequests.ts';

const input = { employeeEmail: 'employee@eris.com', employeeName: 'Nguyen Van A', type: 'Annual leave' as const, date: '2026-10-20', detail: 'Family appointment' };
test('ESS request reaches HR and its decision returns to the correct employee after reload', async () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
  const request = await createEmployeeRequest(input);
  assert.equal((await listEmployeeRequests())[0].status, 'Pending');
  await reviewEmployeeRequest(request.id, 'Approved', 'hr@eris.com', 'Approved for the selected day');
  const result = (await listEmployeeRequests(input.employeeEmail))[0];
  assert.equal(result.status, 'Approved');
  assert.equal(result.reviewer_note, 'Approved for the selected day');
  assert.ok(result.reviewed_at);
  assert.deepEqual(await listEmployeeRequests('another@eris.com'), []);
  await assert.rejects(reviewEmployeeRequest(request.id, 'Rejected', 'hr@eris.com', 'Changed'), /đã được xử lý/);
});
test('invalid date and unexplained rejection do not change the pending request', () => {
  assert.throws(() => buildRequest({ ...input, date: '2026-02-30' }), /ngày hợp lệ/);
  const request = buildRequest(input);
  assert.throws(() => decideRequest([request], request.id, 'Rejected', 'hr@eris.com'), /lý do từ chối/);
  assert.equal(request.status, 'Pending');
  assert.equal(decideRequest([request], request.id, 'Rejected', 'hr@eris.com', 'Missing handover')[0].reviewer_note, 'Missing handover');
});
