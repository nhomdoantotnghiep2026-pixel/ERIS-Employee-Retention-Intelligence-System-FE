import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('HR, admin and employee feedback translates server success and validation messages without rewriting user content', async () => {
  const previousSession = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const session = new Map<string, string>();
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => session.get(key) ?? null, setItem: (key: string, value: string) => session.set(key, value), removeItem: (key: string) => session.delete(key) } });
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  try {
    const { LanguageProvider, useLanguage } = await server.ssrLoadModule('/src/context/LanguageContext.tsx');
    const { RoleProvider, useRole } = await server.ssrLoadModule('/src/context/RoleContext.tsx');
    const messages = [
      'Education updated successfully.',
      'Education created successfully.',
      'Education deactivated successfully.',
      'User status updated successfully.',
      'HR account created successfully.',
      'Survey response submitted successfully.',
      'Work schedule assigned successfully.',
      'educationLevel must be High School, Bachelor, Master or PhD.',
      'Institution directory is temporarily unavailable. Please try again later.',
      'Times must satisfy start_time < break_start < break_end < end_time.',
    ];
    let translated: Record<string, string> = {};
    const userContent = ['Nguyễn Văn An', 'user@example.com', 'EMP-013', 'Nội dung ghi chú do người dùng nhập', 'Custom school and job title'];
    function Feedback() {
      const { t } = useLanguage();
      const { user } = useRole();
      translated = Object.fromEntries([...messages, ...userContent].map(value => [value, t(value)]));
      return React.createElement('div', { 'data-role': user.role }, messages.map(message => React.createElement('p', { key: message, role: 'status' }, t(message))));
    }
    for (const role of ['HR', 'System Administrator', 'Employee / ESS']) {
      session.set('eris-user', JSON.stringify({ name: 'Fixture Person', initials: 'FP', email: 'fixture@example.com', role }));
      const render = (language: 'vi' | 'en') => renderToStaticMarkup(React.createElement(LanguageProvider, { initialLanguage: language }, React.createElement(RoleProvider, null, React.createElement(Feedback))));
      const vi = render('vi');
      assert.ok(vi.includes('data-role="' + role + '"'));
      for (const message of messages) assert.notEqual(translated[message], message, role + ': missing Vietnamese feedback for ' + message);
      assert.ok(!vi.includes('Education updated successfully.'));
      for (const value of userContent) assert.equal(translated[value], value);
      const en = render('en');
      for (const message of messages) assert.equal(translated[message], message, role + ': English server feedback changed unexpectedly');
      assert.ok(en.includes('Education updated successfully.'));
      for (const value of userContent) assert.equal(translated[value], value);
    }
    // Stored feedback can originate in either language before the user switches.
    const storedFeedback = [
      ['Đã cập nhật thông tin học vấn.', 'Education updated successfully.'],
      ['Đã gửi đơn nghỉ phép.', 'Leave request submitted.'],
      ['Đã gửi yêu cầu hủy.', 'Cancellation request submitted.'],
      ['Ghi chú duyệt hoặc từ chối (không bắt buộc):', 'Approval or rejection note (optional):'],
      ['Yêu cầu hủy đang chờ HR duyệt. Đơn nghỉ đã được duyệt vẫn có hiệu lực trong lúc chờ.', 'The cancellation request is awaiting HR approval. The approved leave remains valid while waiting.'],
    ];
    function StoredFeedback() {
      const { t, language } = useLanguage();
      for (const [vi, en] of storedFeedback) assert.equal(t(language === 'en' ? vi : en), language === 'en' ? en : vi);
      assert.equal(t('Đã lưu 3 đề xuất.'), language === 'en' ? 'Saved 3 recommendations.' : 'Đã lưu 3 đề xuất.');
      return null;
    }
    for (const language of ['en', 'vi']) renderToStaticMarkup(React.createElement(LanguageProvider, { initialLanguage: language }, React.createElement(StoredFeedback)));
  } finally {
    await server.close();
    if (previousSession) Object.defineProperty(globalThis, 'sessionStorage', previousSession);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
  }
});
