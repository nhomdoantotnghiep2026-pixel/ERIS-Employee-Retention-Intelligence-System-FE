import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvCells, rowsFromCells } from '../src/workflows/importFile.ts';
import { toCsv } from '../src/utils/demoActions.ts';
import { readFileSync } from 'node:fs';
import { readSheet } from 'read-excel-file/node';
test('a real XLSX workbook is read and mapped into employee import rows', async () => {
  const cells = await readSheet(readFileSync(new URL('./fixtures/employees.xlsx', import.meta.url)));
  const rows = rowsFromCells(cells);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].employeeId, 'EMP-013');
  assert.equal(rows[0].department, 'Engineering');
  assert.equal(rows[0].email, 'an@example.com');
});
test('CSV reads BOM, quoted comma, escaped quotes and multiline cells', () => {
  assert.deepEqual(csvCells('\uFEFFa,b\r\n"hello, world","line 1\nline 2"\r\n"say ""hi""",ok'), [['a', 'b'], ['hello, world', 'line 1\nline 2'], ['say "hi"', 'ok']]);
});
test('malformed quotes are rejected instead of silently importing altered values', () => {
  assert.throws(() => csvCells('a,b\n"unclosed,b'), /quote/i);
  assert.throws(() => csvCells('a,b\n"closed"junk,b'), /quote/i);
});
test('CSV/Excel header mapping accepts employee_code and rejects missing or duplicate headers', () => {
  const header = ['employee_code', 'first_name', 'last_name', 'department', 'position', 'email'];
  assert.deepEqual(rowsFromCells([header, ['EMP-013', 'An', 'Nguyen', 'Engineering', 'Software Engineer', 'an@example.com']])[0], { employeeId: 'EMP-013', firstName: 'An', lastName: 'Nguyen', department: 'Engineering', jobTitle: 'Software Engineer', email: 'an@example.com' });
  assert.throws(() => rowsFromCells([['employeeId', 'employeeId'], ['1', '2']]), /duplicate/i);
  assert.throws(() => rowsFromCells([['employeeId'], ['1']]), /required column/i);
});
test('CSV export neutralizes spreadsheet formulas and preserves quoted content', () => {
  assert.match(toCsv([{ name: '=HYPERLINK("bad")', notes: 'hello, world' }]), /'=HYPERLINK/);
  assert.match(toCsv([{ name: '  +SUM(1)', notes: 'line 1\nline 2' }]), /'  \+SUM/);
});
