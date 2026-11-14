import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('AI connection errors retain actionable backend diagnostics', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  try {
    const { ApiError, getApiErrorMessage } = await server.ssrLoadModule('/src/services/api.ts');
    for (const [status, message] of [
      [503, 'Chưa cấu hình AI_SERVICE_KEY (ít nhất 24 ký tự).'],
      [503, 'AI service chưa nạp model hoặc chưa sẵn sàng.'],
      [502, 'Model đang chạy không khớp phiên bản được tích hợp.'],
      [502, 'AI service từ chối yêu cầu; kiểm tra key và hợp đồng dữ liệu.'],
      [504, 'Không kết nối được AI service hoặc đã quá thời gian chờ.'],
    ] as const) {
      assert.equal(getApiErrorMessage(new ApiError(message, status), 'Fallback'), message);
    }
    assert.notEqual(getApiErrorMessage(new ApiError('private server details', 503), 'Fallback'), 'private server details');
  } finally { await server.close(); }
});
