import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('network failures have an actionable message and cancelled requests stay cancelled', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const originalFetch = globalThis.fetch;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => null } });
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts');
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    await assert.rejects(api.getCurrentUser(), error => {
      assert.equal(error.code, 'NETWORK_ERROR');
      assert.match(api.getApiErrorMessage(error, ''), /kết nối mạng/);
      return true;
    });
    const controller = new AbortController(); controller.abort();
    const cancelled = new DOMException('Cancelled', 'AbortError');
    globalThis.fetch = async () => { throw cancelled; };
    await assert.rejects(api.getEmployeeProfile(1, controller.signal), error => error === cancelled);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
    await server.close();
  }
});

test('common client errors show actionable messages instead of HTTP jargon', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const originalFetch = globalThis.fetch;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => null } });
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts');
    const cases = [
      [400, 'Bad Request', 'Thông tin gửi lên chưa hợp lệ. Vui lòng kiểm tra lại các trường nhập.'],
      [401, 'A valid access token is required.', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'],
      [403, 'Forbidden', 'Bạn không có quyền thực hiện thao tác này.'],
      [404, 'Not Found', 'Không tìm thấy thông tin cần thiết. Dữ liệu có thể đã thay đổi; vui lòng tải lại và thử lại.'],
      [409, 'Conflict', 'Thông tin đã thay đổi hoặc bị trùng. Vui lòng tải lại dữ liệu và kiểm tra lại.'],
      [413, 'Payload Too Large', 'Tệp tải lên vượt quá dung lượng cho phép. Vui lòng chọn tệp nhỏ hơn.'],
      [422, 'Unprocessable Entity', 'Thông tin gửi lên chưa hợp lệ. Vui lòng kiểm tra lại các trường nhập.'],
      [429, 'Too Many Requests', 'Bạn thao tác quá nhiều lần. Vui lòng chờ một lát rồi thử lại.'],
    ] as const;
    for (const [status, technicalMessage, expectedMessage] of cases) {
      globalThis.fetch = async () => Response.json({ message: technicalMessage }, { status });
      await assert.rejects(api.getCurrentUser(), error => {
        assert.equal(api.getApiErrorMessage(error, 'Fallback message'), expectedMessage);
        assert.ok(!api.getApiErrorMessage(error, 'Fallback message').includes(technicalMessage));
        return true;
      });
    }
    assert.equal(api.getApiErrorMessage(new TypeError('Failed to fetch'), 'Không tải được dữ liệu. Vui lòng thử lại.'), 'Không tải được dữ liệu. Vui lòng thử lại.');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
    await server.close();
  }
});

test('server failures display helpful messages instead of technical response text', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const originalFetch = globalThis.fetch;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => null } });
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts');
    const cases = [
      [500, 'Internal server error.', 'Hệ thống đang gặp sự cố khi xử lý yêu cầu. Vui lòng thử lại sau.'],
      [502, 'Bad Gateway', 'Máy chủ đang tạm thời không phản hồi. Vui lòng thử lại sau ít phút.'],
      [503, 'Service Unavailable', 'Dịch vụ hiện tạm thời không khả dụng. Vui lòng thử lại sau.'],
      [504, 'Gateway Timeout', 'Yêu cầu mất quá nhiều thời gian để xử lý. Vui lòng thử lại.'],
      [520, 'Unknown server error', 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.'],
    ] as const;
    for (const [status, technicalMessage, expectedMessage] of cases) {
      globalThis.fetch = async () => Response.json({ message: technicalMessage }, { status });
      await assert.rejects(api.getCurrentUser(), error => {
        assert.equal(api.getApiErrorMessage(error, 'Fallback message'), expectedMessage);
        assert.ok(!api.getApiErrorMessage(error, 'Fallback message').includes(technicalMessage));
        return true;
      });
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
    await server.close();
  }
});

test('refresh sends cookies and stores the replacement access token', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const originalFetch = globalThis.fetch;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const values = new Map<string, string>([['eris-access-token', 'expired-token']]);
  let call: { url: string; init?: RequestInit } | undefined;
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } });
  globalThis.fetch = async (url, init) => {
    call = { url: String(url), init };
    return Response.json({ accessToken: 'fresh-token' });
  };
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts');
    await api.refreshSession();
    assert.match(call?.url || '', /\/api\/auth\/refresh$/);
    assert.equal(call?.init?.method, 'POST');
    assert.equal(call?.init?.credentials, 'include');
    assert.equal(values.get('eris-access-token'), 'fresh-token');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
    await server.close();
  }
});

test('session restore uses the current access token before refreshing', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const originalFetch = globalThis.fetch;
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const calls: string[] = [];
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: () => 'current-access-token',
    setItem: () => undefined,
  } });
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return Response.json({ id: 1, email: 'admin@eris.test', status: 'ACTIVE' });
  };
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts');
    await api.restoreSession();
    assert.equal(calls.length, 1);
    assert.match(calls[0], /\/api\/auth\/me$/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
    await server.close();
  }
});
