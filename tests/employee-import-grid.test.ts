import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import type { EmployeeImportPreviewRow } from '../src/services/api';

test('employee import grid paginates, highlights bad fields and counts pending institution choices', async () => {
  const server = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true, ws: false }, esbuild: { jsx: 'automatic' } });
  try {
    const { EmployeeImportGrid, summarizeImport } = await server.ssrLoadModule('/src/components/EmployeeImportGrid.tsx');
    const rows: EmployeeImportPreviewRow[] = Array.from({ length: 27 }, (_, index) => ({
      row: index + 2,
      status: 'VALID',
      employee: { employeeCode: 'EMP' + String(index).padStart(3, '0'), fullName: 'Fixture employee', email: 'fixture@example.com' },
    }));
    rows[0] = { ...rows[0], status: 'FAILED', issue: { field: 'email', cell: 'D2', message: 'Invalid email format' } };
    rows[1] = { ...rows[1], status: 'NEEDS_REVIEW', institutions: [{ educationIndex: 0, status: 'NEEDS_SELECTION', originalName: 'Fixture school', selectedId: null, candidates: [] }] };
    const preview = { total: 27, valid: 25, failed: 1, pending: 1, results: rows };
    const choices = [{ row: 3, educationIndex: 0, institutionRefId: 'school-1' }];
    assert.deepEqual(summarizeImport(preview, []), { ready: 25, unresolved: 1, education: 1 });
    assert.deepEqual(summarizeImport(preview, choices), { ready: 26, unresolved: 0, education: 1 });
    const html = renderToStaticMarkup(React.createElement(EmployeeImportGrid, {
      preview, choices, summary: summarizeImport(preview, choices), uploading: false,
      text: (_vi: string, en: string) => en, onChangeFile: () => {}, onUpload: () => {}, onChoose: () => {},
    }));
    assert.equal((html.match(/<tr[ >]/g) ?? []).length, 26);
    assert.match(html, /Showing 1–25 of 27 employees/);
    assert.match(html, /title="D2 · Invalid email format"/);
    assert.match(html, /Upload and create 26 employees/);
    assert.doesNotMatch(html, /EMP026/);
  } finally {
    await server.close();
  }
});
