import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('EMP FE uses camelCase queries, bare detail, partial PATCH and bodyless soft DELETE', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const originalFetch = globalThis.fetch, storage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let response = Response.json({});
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => 'hr-token' } });
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return response; };
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts');
    assert.equal(api.getApiErrorMessage(new api.ApiError('Số điện thoại đã được sử dụng trong hồ sơ nhân viên khác.', 409), 'fallback'), 'Số điện thoại đã được sử dụng trong hồ sơ nhân viên khác. Vui lòng kiểm tra và nhập số khác.');
    assert.equal(api.getApiErrorMessage(new api.ApiError('Không thể đổi vị trí hai lần trong cùng ngày khi lịch sử chỉ lưu ngày.', 409), 'fallback'), 'Không thể đổi vị trí hai lần trong cùng ngày khi lịch sử chỉ lưu ngày.');
    assert.equal(api.getApiErrorMessage(new api.ApiError('Inactive employees cannot be updated.', 409), 'fallback'), 'Không thể chỉnh sửa nhân viên đã ngừng hoạt động. Vui lòng tải lại hồ sơ.');
    response = Response.json({ data: Array.from({ length: 25 }, (_, id) => ({ id: id + 1 })) });
    const list = await api.listEmployeeProfiles({ page: 2, search: 'a+b', departmentId: 1, positionId: 2, employmentStatus: 'ACTIVE' });
    assert.equal(list.pagination.totalPages, 2);
    assert.deepEqual(list.data.map(item => item.id), [21, 22, 23, 24, 25]);
    const url = new URL(calls.at(-1)!.url, 'http://localhost');
    assert.equal(url.pathname, '/api/employees'); assert.equal(url.searchParams.get('search'), 'a+b');
    assert.equal(url.searchParams.get('departmentId'), '1');
    assert.equal(url.searchParams.get('positionId'), '2');
    assert.equal(url.searchParams.get('employmentStatus'), 'ACTIVE');
    assert.equal(url.searchParams.has('page'), false);
    assert.equal(url.searchParams.has('limit'), false);
    const record = { id: 5, fullName: 'Test', distanceCalculation: { status: 'READY' }, distanceFromHomeKm: 10 };
    response = Response.json(record);
    assert.deepEqual(await api.getEmployeeProfile(5), record);
    response = Response.json({ id: 8, email: 'hr@example.test', status: 'ACTIVE' });
    assert.equal((await api.getCurrentUser()).email, 'hr@example.test');
    assert.equal(calls.at(-1)!.url, '/api/auth/me');
    assert.equal(
      api.getApiErrorMessage(new api.ApiError('Employee account must be ACTIVE to view education.', 409), 'fallback'),
      'Education is only available when the employee profile and account are active.',
    );
    assert.equal(
      api.getApiErrorMessage(new api.ApiError('graduationYear must be at least 2003 (minimum graduation age: 21 by year).', 400), 'fallback'),
      'graduationYear must be at least 2003 (minimum graduation age: 21 by year).',
    );
    response = Response.json({ data: record }, { status: 201 });
    const input = { fullName: 'Test', email: 'test@eris.invalid', hireDate: '2025-01-01', departmentId: 1, positionId: 2 };
    await api.createEmployeeProfile(input);
    assert.equal(calls.at(-1)!.init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(calls.at(-1)!.init?.body)), input);
    response = Response.json({ data: record });
    await api.updateEmployeeProfile(5, { phone: '0901234567' });
    assert.equal(calls.at(-1)!.init?.method, 'PATCH');
    assert.deepEqual(JSON.parse(String(calls.at(-1)!.init?.body)), { phone: '0901234567' });
    await api.deactivateEmployeeProfile(5);
    assert.equal(calls.at(-1)!.init?.method, 'DELETE'); assert.equal(calls.at(-1)!.init?.body, undefined);
    assert.ok(calls.at(-1)!.url.endsWith('/employees/5'));
    for (const call of calls) {
      assert.equal(new Headers(call.init?.headers).get('Authorization'), 'Bearer hr-token');
      assert.equal(call.init?.credentials, 'include');
    }
    for (const status of [400, 403, 404, 409, 503]) {
      response = Response.json({ error: { message: 'Validation or configuration error' } }, { status });
      await assert.rejects(api.createEmployeeProfile(input), (error: { status: number }) => error.status === status);
    }
    let deniedCalls = 0;
    globalThis.fetch = async () => { deniedCalls++; return Response.json({ message: 'Forbidden' }, { status: 403 }); };
    await assert.rejects(api.listEmployeeProfiles(), { status: 403 });
    assert.equal(deniedCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (storage) Object.defineProperty(globalThis, 'sessionStorage', storage); else Reflect.deleteProperty(globalThis, 'sessionStorage');
    await server.close();
  }
});
