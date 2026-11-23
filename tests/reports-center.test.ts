import test from 'node:test';
import assert from 'node:assert/strict';
import { createReportRecord, filterReportRecords, reportCategoryCount } from '../src/services/reportsCenter.ts';
import type { ReportRecord } from '../src/utils/reportStore.ts';

const reports: ReportRecord[] = [
  { id: '1', name: 'Workforce Risk Summary', description: 'Organization overview', category: 'Overview', lastGenerated: 'Nov 20, 2026', owner: 'HR Team' },
  { id: '2', name: 'Engineering Review', description: 'Department follow-up', category: 'Department', lastGenerated: 'Nov 21, 2026', owner: 'Le Thi HR' },
  { id: '3', name: 'Employee Watchlist', description: 'Priority employee review', category: 'Employee', lastGenerated: 'Nov 22, 2026', owner: 'HR Team' },
];

test('report records are created with trimmed user input and stable metadata', () => {
  const report = createReportRecord({ name: '  November summary  ', description: '  Current workforce scope  ', category: 'Overview', owner: '  HR Account  ' }, '2026-11-23T10:00:00+07:00');
  assert.equal(report.id, 'report-1795402800000');
  assert.equal(report.name, 'November summary');
  assert.equal(report.description, 'Current workforce scope');
  assert.equal(report.category, 'Overview');
  assert.equal(report.owner, 'HR Account');
  assert.match(report.lastGenerated, /2026/);
});

test('report library search combines text and category without mutating source', () => {
  assert.deepEqual(filterReportRecords(reports, 'engineering', 'All').map(report => report.id), ['2']);
  assert.deepEqual(filterReportRecords(reports, 'hr team', 'Employee').map(report => report.id), ['3']);
  assert.deepEqual(filterReportRecords(reports, '', 'Overview').map(report => report.id), ['1']);
  assert.equal(reports.length, 3);
});

test('report category count reflects distinct categories', () => {
  assert.equal(reportCategoryCount(reports), 3);
  assert.equal(reportCategoryCount([]), 0);
});
