import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

test('AI analysis and policy workflows render their initial controls in the selected language', async () => {
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const storage = new Map<string, string>([['eris-user', JSON.stringify({ name: 'Fixture Person', initials: 'FP', email: 'fixture@example.com', role: 'HR' })]]);
  const session = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) };
  for (const [name, value] of Object.entries({ sessionStorage: session, localStorage: session, window: { innerWidth: 1440, dispatchEvent() {}, addEventListener() {}, removeEventListener() {} } })) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, value });
  }
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  try {
    const { LanguageProvider } = await server.ssrLoadModule('/src/context/LanguageContext.tsx');
    const { RoleProvider } = await server.ssrLoadModule('/src/context/RoleContext.tsx');
    const cases = [
      ['/src/screens/AiAnalysis.tsx', {}, 'Phân tích AI nhân viên', 'Kiểm tra dữ liệu'],
      ['/src/screens/PolicyDemo.tsx', {}, 'Minh họa đề xuất chính sách', 'Tạo kết quả minh họa'],
      ['/src/components/AiPolicyRecommendations.tsx', { predictionId: 42 }, 'Đề xuất hỗ trợ', 'Xem đề xuất'],
      ['/src/components/AiBatchAnalysis.tsx', { employees: [] }, 'Phân tích nhiều nhân viên', 'Thêm vào nhóm'],
    ] as const;
    for (const [file, props, heading, action] of cases) {
      const Screen = (await server.ssrLoadModule(file)).default;
      const render = (language: 'vi' | 'en') => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(LanguageProvider, { initialLanguage: language }, React.createElement(RoleProvider, null, React.createElement(Screen, props)))));
      const vi = render('vi'), en = render('en');
      assert.ok(vi.includes(heading), file + ': missing Vietnamese heading');
      assert.ok(vi.includes(action), file + ': missing Vietnamese control');
      assert.ok(!en.includes(heading), file + ': Vietnamese heading leaks into English');
      assert.ok(!en.includes(action), file + ': Vietnamese action leaks into English');
      assert.deepEqual([...vi.matchAll(/<option[^>]*value="([^"]*)"/g)].map(match => match[1]), [...en.matchAll(/<option[^>]*value="([^"]*)"/g)].map(match => match[1]), file + ': changing language changes submitted values');
    }
  } finally {
    await server.close();
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
