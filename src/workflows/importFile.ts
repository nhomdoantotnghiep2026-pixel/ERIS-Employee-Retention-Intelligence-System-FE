import type { ImportRow } from './domain';

export function csvCells(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false, closedQuote = false;
  text = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (closedQuote && ![',', '\n', '\r', ' ', '\t'].includes(char)) throw new Error('Invalid character after closing CSV quote.');
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index++; }
      else if (!quoted && cell) throw new Error('Invalid quote in CSV cell.');
      else { closedQuote = quoted; quoted = !quoted; }
    } else if (!quoted && (char === ',' || char === '\n' || char === '\r')) {
      row.push(cell.trim()); cell = ''; closedQuote = false;
      if (char !== ',') { if (row.some(Boolean)) rows.push(row); row = []; if (char === '\r' && text[index + 1] === '\n') index++; }
    } else cell += char;
  }
  if (quoted) throw new Error('Unclosed quote in CSV file.');
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function rowsFromCells(cells: unknown[][]): ImportRow[] {
  if (cells.length < 2) throw new Error('The file must contain a header and at least one employee.');
  const headers = cells[0].map(value => String(value ?? '').trim().toLowerCase().replace(/[ _-]/g, ''));
  if (new Set(headers).size !== headers.length) throw new Error('Duplicate column headers.');
  const aliases = { employeeId: ['employeeid', 'employeecode'], firstName: ['firstname'], lastName: ['lastname'], department: ['department', 'departmentid'], jobTitle: ['jobtitle', 'position', 'positionid'], email: ['email'] };
  const indexes = Object.fromEntries(Object.entries(aliases).map(([field, names]) => [field, headers.findIndex(header => names.includes(header))]));
  for (const field of Object.keys(aliases).filter(field => field !== 'email')) if (indexes[field] < 0) throw new Error(`Missing required column: ${field}.`);
  if (cells.length > 5001) throw new Error('Maximum 5,000 employee rows per import.');
  return cells.slice(1).map((values, index) => {
    if (values.length > headers.length) throw new Error(`Row ${index + 2}: too many cells.`);
    return Object.fromEntries(Object.entries(indexes).map(([field, position]) => [field, position < 0 ? '' : String(values[position] ?? '').trim()])) as unknown as ImportRow;
  });
}
export async function readEmployeeFile(file: File): Promise<ImportRow[]> {
  if (file.size > 10 * 1024 * 1024) throw new Error('File exceeds the 10 MB limit.');
  if (/\.csv$/i.test(file.name)) return rowsFromCells(csvCells(await file.text()));
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import('read-excel-file/browser');
    return rowsFromCells(await readSheet(file));
  }
  throw new Error('Use a CSV or Excel .xlsx file. Save old .xls files as .xlsx first.');
}
