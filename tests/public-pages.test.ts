import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import { PUBLIC_TOPICS } from '../src/data/publicTopics.ts';
import { ROLE_HOME, ROLE_ROUTES } from '../src/workflows/access.ts';

test('public navigation does not replace protected role routes and documents the four actors', () => {
  const paths = Object.values(PUBLIC_TOPICS).map(topic => topic.path);
  assert.equal(new Set(paths).size, 4);
  for (const path of paths) assert.ok(!Object.values(ROLE_ROUTES).flat().includes(path), path + ' collides with a workspace route');
  assert.deepEqual(PUBLIC_TOPICS.roles.sections.map(section => section.role).sort(), Object.keys(ROLE_HOME).sort());
});

test('every public menu destination resolves to a rendered section with detail content', async () => {
  const server = await createServer({ root: process.cwd(), configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false, ws: false }, esbuild: { jsx: 'automatic' } });
  try {
    const { LanguageProvider } = await server.ssrLoadModule('/src/context/LanguageContext.tsx');
    const { default: PublicDetail } = await server.ssrLoadModule('/src/screens/PublicDetail.tsx');
    for (const topic of Object.values(PUBLIC_TOPICS)) {
      assert.equal(new Set(topic.sections.map(section => section.id)).size, topic.sections.length);
      const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [topic.path] }, React.createElement(LanguageProvider, { initialLanguage: 'vi' }, React.createElement(PublicDetail, { topicId: topic.id }))));
      assert.ok(html.includes(topic.title));
      assert.ok(html.includes('href="/login"'));
      for (const section of topic.sections) {
        assert.ok(html.includes('id="' + section.id + '"'), 'Missing target: ' + topic.path + '#' + section.id);
        assert.ok(html.includes('href="' + topic.path + '#' + section.id + '"'), 'Missing navigation link');
        assert.ok(section.details.length >= 2, 'Section needs substantive detail');
        assert.ok(html.includes(section.result));
      }
      // The closed navigation remains keyboard reachable without hiding behind hover.
      assert.equal((html.match(/data-topic=/g) || []).length, 4);
      assert.ok(html.includes('Mở điều hướng'));
    }
  } finally { await server.close(); }
});
