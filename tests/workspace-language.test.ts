import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

const chunks = (html: string) => new Set(html.split(/<[^>]*>/g).map(text => text.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').trim()).filter(Boolean));

test('four role dashboards, sidebars and guides render in one language while preserving identities and URLs', async () => {
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const session = new Map<string, string>();
  const local = new Map<string, string>();
  const storage = (values: Map<string, string>) => ({ getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
  for (const [key, value] of Object.entries({ sessionStorage: storage(session), localStorage: storage(local), window: { innerWidth: 1440, dispatchEvent() {}, addEventListener() {}, removeEventListener() {} } })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const server = await createServer({ root: process.cwd(), configFile: false, appType: 'custom', server: { middlewareMode: true, ws: false }, esbuild: { jsx: 'automatic' } });
  try {
    const { LanguageProvider, useLanguage } = await server.ssrLoadModule('/src/context/LanguageContext.tsx');
    const { RoleProvider, ROLE_USERS: actors } = await server.ssrLoadModule('/src/context/RoleContext.tsx');
    const ROLE_USERS = ['HR', 'Data / AI Analyst', 'System Administrator', 'Employee / ESS'].map(role => {
      const actor = actors.find((item: { role: string }) => item.role === role);
      assert.ok(actor, 'Missing actor: ' + role);
      return actor;
    });
    const { EmployeeProvider } = await server.ssrLoadModule('/src/context/EmployeeContext.tsx');
    const { WorkflowProvider } = await server.ssrLoadModule('/src/context/WorkflowContext.tsx');
    const { readDatabase, transactDatabase, makeRow } = await server.ssrLoadModule('/src/erd/database.ts');
    const { default: HR } = await server.ssrLoadModule('/src/screens/Dashboard.tsx');
    const { default: Data } = await server.ssrLoadModule('/src/screens/DataWorkspace.tsx');
    const { default: Admin } = await server.ssrLoadModule('/src/screens/AdminOverview.tsx');
    const { default: Employee } = await server.ssrLoadModule('/src/screens/EmployeePortal.tsx');
    const { RoleJourney } = await server.ssrLoadModule('/src/components/RoleJourney.tsx');
    let translate: (source: string, values?: Record<string, string | number>) => string = source => source;
    function Probe() { translate = useLanguage().t; return null; }
    const render = (actor: typeof ROLE_USERS[number], language: string, path: string, screen: React.ReactNode) => {
      session.set('eris-user', JSON.stringify(actor));
      local.set('eris-language', language);
      return renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(LanguageProvider, null, React.createElement(RoleProvider, null, React.createElement(EmployeeProvider, null, React.createElement(WorkflowProvider, null, React.createElement(Probe), screen))))));
    };
    const db = readDatabase();
    const payroll = render(ROLE_USERS[3], 'en', '/my-payroll', React.createElement(Employee, { mode: 'payroll' }));
    assert.ok(payroll.includes('Payslip data is not connected yet.'));
    assert.ok(!/5[,.]885|5[,.]800|20\.5|2\.7|October 2026 payslip|Awaiting approval|Payroll inputs/.test([...chunks(payroll)].join(' ')), 'Unavailable payroll must never display sample amounts or payment states');
    const identities = new Set(['ERIS', 'e', 'VI', 'EN', 'English', 'Tiếng Việt', ...ROLE_USERS.flatMap((user: { name: string; email: string; initials: string }) => [user.name, user.email, user.initials]), ...db.employees.map((row: { full_name: string }) => String(row.full_name))]);
    const screens = [HR, Data, Admin, Employee];
    const paths = ['/dashboard', '/data-overview', '/admin-overview', '/employee-dashboard'];
    const leftovers: Record<string, string[]> = {};
    for (let index = 0; index < ROLE_USERS.length; index++) {
      const actor = ROLE_USERS[index];
      const screen = React.createElement(screens[index], index === 3 ? { mode: 'dashboard' } : {});
      const english = render(actor, 'en', paths[index], screen);
      const vietnamese = render(actor, 'vi', paths[index], screen);
      const enText = chunks(english), viText = chunks(vietnamese);
      const leftInVietnamese = [...enText].filter(text => /[a-zA-Z]/.test(text) && !text.includes('@') && !identities.has(text) && !/^[vV]?[0-9.,%$\s:/→–-]+$/.test(text) && viText.has(text));
      if (leftInVietnamese.length) leftovers[actor.role] = leftInVietnamese;
      assert.ok(!/[À-ỹ]/.test([...enText].filter(text => !identities.has(text)).join(' ')), actor.role + ': Vietnamese remains in English');
      assert.ok(english.includes(actor.name) && vietnamese.includes(actor.name));
      assert.deepEqual([...english.matchAll(/href="([^"]+)"/g)].map(match => match[1]), [...vietnamese.matchAll(/href="([^"]+)"/g)].map(match => match[1]), 'Language must not alter route destinations');
      for (const language of ['en', 'vi']) {
        const guide = chunks(render(actor, language, paths[index], React.createElement(RoleJourney, { onNavigate() {} })));
        assert.equal([...guide].filter(text => text === (language === 'en' ? 'Open this step' : 'Mở bước này')).length, 1);
        if (language === 'en') assert.ok(!/[À-ỹ]/.test([...guide].filter(text => !identities.has(text)).join(' ')), actor.role + ': untranslated guide');
      }
    }
    assert.deepEqual(leftovers, {}, 'English remains in Vietnamese dashboards');
    // Templates must translate labels without corrupting counts, IDs or replacement values.
    render(ROLE_USERS[2], 'vi', paths[2], React.createElement(Admin));
    assert.equal(translate('{count} accounts', { count: 7 }), '7 tài khoản');
    assert.equal(translate('{version} is active', { version: 'v2.3' }), 'v2.3 đang hoạt động');
    assert.equal(translate('Unknown custom text'), 'Unknown custom text');
    // Exercise populated audit rows and the configured-service display label.
    transactDatabase((draft: typeof db) => { draft.audit_logs.push(makeRow('audit_logs', { user_id: draft.users[0].id, entity_type: 'EMPLOYEES', entity_id: draft.employees[0].id, action: 'Create employee', old_value: null, new_value: null })); });
    const admin = chunks(render(ROLE_USERS[2], 'vi', paths[2], React.createElement(Admin)));
    assert.ok(admin.has('Tạo nhân viên'));
    assert.ok(admin.has('Hồ sơ nhân viên'));
    assert.equal(translate('Configured, not verified'), 'Đã cấu hình, chưa xác minh');
    assert.equal(translate('{count} pending', { count: 3 }), '3 đang chờ');
    assert.equal(translate('Requests awaiting HR review: {count}.', { count: 3 }), '3 yêu cầu đang chờ nhân sự xem xét.');
    const { employeeView } = await server.ssrLoadModule('/src/erd/employeeView.ts');
    const { fingerprint } = await server.ssrLoadModule('/src/workflows/domain.ts');
    const period = { start: '2026-10-01', end: '2026-10-31', scope: '' };
    const snapshot = { ...period, id: 'preview', created_at: new Date().toISOString(), source: fingerprint(readDatabase().employees.map((row: object) => employeeView(readDatabase(), row)), period), inputs: [{}], issues: [] };
    session.set('eris-erd-workflow-ui-v1', JSON.stringify({ snapshot, models: [{ version: 'v2.3', status: 'Active' }] }));
    const readyVi = chunks(render(ROLE_USERS[1], 'vi', paths[1], React.createElement(Data)));
    const readyEn = chunks(render(ROLE_USERS[1], 'en', paths[1], React.createElement(Data)));
    assert.ok([...readyVi].some(text => text.startsWith('1 đầu vào hợp lệ')));
    assert.ok(readyVi.has('v2.3 đang hoạt động'));
    assert.ok(readyEn.has('v2.3 is active'));
    session.set('eris-erd-workflow-ui-v1', JSON.stringify({ snapshot: { ...snapshot, issues: [{}] }, models: [] }));
    assert.ok([...chunks(render(ROLE_USERS[1], 'en', paths[1], React.createElement(Data)))].some(text => text.startsWith('Validation issues: 1, or source data changed')));
    const { createSurvey } = await server.ssrLoadModule('/src/erd/surveys.ts');
    transactDatabase((draft: typeof db) => createSurvey(draft, draft.users[0].id, { title: 'User-provided survey title', description: '', start_date: '2000-01-01', end_date: '2099-12-31', questions: [{ question_text: 'User-provided question', dimension_code: 'general', required: true }] }));
    const employeeVi = chunks(render(ROLE_USERS[3], 'vi', paths[3], React.createElement(Employee, { mode: 'dashboard' })));
    const employeeEn = chunks(render(ROLE_USERS[3], 'en', paths[3], React.createElement(Employee, { mode: 'dashboard' })));
    // Personal workspace waits for the real account API rather than claiming a
    // missing link or showing counts from unrelated browser demo records.
    assert.ok(employeeVi.has('Đang tải thông tin tài khoản...'));
    assert.ok(employeeEn.has('Loading your account...'));
    assert.ok(!employeeEn.has('Surveys awaiting your response: 1.'));
    assert.ok(!employeeVi.has('Tài khoản chưa liên kết hồ sơ nhân viên'));
    // Requests also wait for the real account instead of failing a demo lookup.
    const requestForm = render(ROLE_USERS[3], 'vi', '/my-requests', React.createElement(Employee, { mode: 'requests' }));
    assert.ok(requestForm.includes('Đang tải thông tin tài khoản...'));
    assert.ok(!requestForm.includes('Tài khoản chưa liên kết hồ sơ nhân viên'));

  } finally {
    await server.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
