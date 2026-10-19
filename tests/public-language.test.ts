import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import { publicEnglish, publicVietnamese } from '../src/data/publicTranslations.ts';
import { PUBLIC_TOPICS } from '../src/data/publicTopics.ts';

const files = ['src/screens/Landing.tsx', 'src/screens/Login.tsx', 'src/components/LandingProductPreview.tsx', 'src/components/PublicHeader.tsx', 'src/components/PublicFooter.tsx', 'src/screens/PublicDetail.tsx', 'src/data/publicTopics.ts'];
const vietnamese = /[À-ỹ]/;

test('public Vietnamese copy has complete English translations, including login errors and image descriptions', () => {
  const missing = new Set<string>();
  for (const file of files) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if (ts.isStringLiteral(node) && vietnamese.test(node.text) && !node.text.startsWith('©') && !publicEnglish[node.text]) missing.add(node.text);
      if (ts.isJsxText(node)) assert.ok(!vietnamese.test(node.text), file + ': untranslated JSX text');
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.deepEqual([...missing], []);
  for (const [source, translation] of Object.entries(publicEnglish)) {
    assert.ok(translation.trim(), source);
    assert.ok(!vietnamese.test(translation), 'Vietnamese left in English copy: ' + source);
  }
  assert.equal(publicEnglish['Mật khẩu demo chưa đúng. Hãy dùng “password”.'], 'Incorrect demo password. Please use “password”.');
});

test('stored language is shared by home, all four detail pages and login without changing accounts or links', async () => {
  const server = await createServer({ root: process.cwd(), configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, esbuild: { jsx: 'automatic' } });
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let storedLanguage = 'vi';
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => key === 'eris-language' ? storedLanguage : null } });
  try {
    const { LanguageProvider } = await server.ssrLoadModule('/src/context/LanguageContext.tsx');
    const { RoleProvider, ROLE_USERS } = await server.ssrLoadModule('/src/context/RoleContext.tsx');
    const { default: Landing } = await server.ssrLoadModule('/src/screens/Landing.tsx');
    const { default: Login } = await server.ssrLoadModule('/src/screens/Login.tsx');
    const { default: PublicDetail } = await server.ssrLoadModule('/src/screens/PublicDetail.tsx');
    const render = (path: string, screen: React.ReactNode) => renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(LanguageProvider, null, React.createElement(RoleProvider, null, screen))));
    const escape = (text: string) => renderToStaticMarkup(React.createElement('span', null, text)).slice(6, -7);
    const visibleText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ');
    for (const language of ['vi', 'en'] as const) {
      storedLanguage = language;
      const home = render('/', React.createElement(Landing));
      assert.ok(home.includes(language === 'en' ? 'Understand people sooner.' : 'Hiểu nhân sự sớm hơn.'));
      assert.ok(home.includes('lang="' + language + '" title="' + (language === 'en' ? 'English' : 'Tiếng Việt') + '" aria-label="' + (language === 'en' ? 'English' : 'Tiếng Việt') + '" aria-pressed="true"'));
      if (language === 'en') assert.ok(!vietnamese.test(visibleText(home)), 'Untranslated home text');
      for (const topic of Object.values(PUBLIC_TOPICS)) {
        const html = render(topic.path, React.createElement(PublicDetail, { topicId: topic.id }));
        assert.ok(html.includes(escape(language === 'en' ? publicEnglish[topic.title] : topic.title)));
        for (const section of topic.sections) {
          assert.ok(html.includes('href="' + topic.path + '#' + section.id + '"'));
          assert.ok(html.includes(escape(language === 'en' ? publicEnglish[section.result] : section.result)));
        }
        if (language === 'en') assert.ok(!vietnamese.test(visibleText(html)), 'Untranslated detail text: ' + topic.path);
      }
      const login = render('/login', React.createElement(Login));
      assert.ok(login.includes(language === 'en' ? 'Demo accounts' : 'Tài khoản dùng thử'));
      assert.equal((login.match(/<option/g) || []).length, 4);
      for (const actor of ROLE_USERS) {
        assert.ok(login.includes(actor.name));
        assert.ok(login.includes(language === 'vi' ? publicVietnamese[actor.role] : actor.role));
      }
      assert.ok(login.includes('value="password"'));
      assert.ok(login.includes(language === 'en' ? 'Show password' : 'Hiện mật khẩu'));
      if (language === 'en') assert.ok(!vietnamese.test(visibleText(login)), 'Untranslated login text');
    }
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    await server.close();
  }
});
