import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('account provisioning supports enterprise filters, bulk actions and dense pagination', async () => {
  const source = await readFile(new URL('../src/screens/EmployeeAccountProvisioning.tsx', import.meta.url), 'utf8');

  assert.match(source, /Chờ cấp tài khoản/);
  assert.match(source, /Đã cấp hôm nay/);
  assert.match(source, /Tỷ lệ phủ tài khoản/);
  assert.match(source, /window\.setTimeout\(\(\) => \{ setQuery\(searchInput\.trim\(\)\); setPage\(1\); \}, 300\)/);
  assert.match(source, /Tất cả phòng ban/);
  assert.match(source, /Hồ sơ mới nhập hôm nay/);
  assert.match(source, /togglePage/);
  assert.match(source, /Chọn toàn bộ \$\{filtered\.length\} nhân sự chờ cấp/);
  assert.match(source, /Cấp tài khoản hàng loạt/);
  assert.match(source, /provisionBulk/);
  assert.match(source, /for \(const candidate of selectedRows\)/);
  assert.match(source, /\[25, 50, 100\]/);
  assert.match(source, /Không có hồ sơ nào chờ cấp tài khoản/);
  assert.match(source, /navigate\('\/users'\)/);
  assert.doesNotMatch(source, /type="submit"[^>]*>.*Tìm kiếm/);
});
