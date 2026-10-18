import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateImport, prepareSnapshot, evaluateModel, activateModel, createDemoRun } from '../src/workflows/domain.ts';
import { canAccessRoute } from '../src/workflows/access.ts';

const employee = { id: '1', employeeId: 'EMP-001', name: 'Nguyen Van A', department: 'Engineering', role: 'Software Engineer', email: 'a@example.com', status: 'Active', age: 28, tenure: 2, monthlyIncome: 5000, jobLevel: 2, jobSatisfaction: 3, environmentSatisfaction: 3, educationLevel: 3, distanceFromHomeKm: 0, totalWorkingYears: 5, yearsInCurrentRole: 1, yearsSinceLastPromotion: 0, yearsWithCurrentManager: 1, overtimeHours: 0 };
const row = { employeeId: 'EMP-002', firstName: 'An', lastName: 'Tran', department: 'Engineering', jobTitle: 'Software Engineer', email: 'b@example.com' };
const refs = { departments: ['Engineering'], positions: ['Software Engineer'] };
const period = { start: '2026-09-01', end: '2026-09-30', scope: '' };
test('Data manages employee data but cannot read individual risk or HR reports', () => {
  assert.equal(canAccessRoute('Data / AI Analyst', '/employees/1/edit'), true);
  assert.equal(canAccessRoute('Data / AI Analyst', '/employees/1/risk'), false);
  assert.equal(canAccessRoute('Data / AI Analyst', '/reports'), false);
});
test('HR prepares workforce snapshots but cannot activate models or generate predictions', () => {
  assert.equal(canAccessRoute('HR', '/preparation'), true);
  assert.equal(canAccessRoute('HR', '/predictions'), false);
  assert.equal(canAccessRoute('HR', '/model-history'), false);
});
test('ESS and Admin cannot open employee master records; unknown routes fail closed', () => {
  for (const role of ['Employee / ESS', 'System Administrator']) assert.equal(canAccessRoute(role, '/employees/1'), false);
  assert.equal(canAccessRoute('HR', '/undefined-module'), false);
});
test('import rejects duplicate code/email in file and existing employees', () => {
  assert.ok(validateImport([row, { ...row }], [employee], refs).length >= 2);
  assert.ok(validateImport([{ ...row, employeeId: ' emp-001 ' }], [employee], refs).length);
  assert.ok(validateImport([{ ...row, email: 'A@EXAMPLE.COM' }], [employee], refs).length);
});
test('import rejects unknown department/position references and invalid email', () => {
  assert.ok(validateImport([{ ...row, department: 'MKT2' }], [], refs).length);
  assert.ok(validateImport([{ ...row, jobTitle: 'Unknown' }], [], refs).length);
  assert.ok(validateImport([{ ...row, email: 'bad-email' }], [], refs).length);
  assert.deepEqual(validateImport([row], [], refs), []);
});
test('snapshot rejects invalid periods and empty active scope', () => {
  assert.throws(() => prepareSnapshot([employee], { ...period, start: '2026-10-01' }), /period/i);
  assert.throws(() => prepareSnapshot([employee], { ...period, start: '2026-02-30' }), /period/i);
  assert.throws(() => prepareSnapshot([{ ...employee, status: 'Inactive' }], period), /active/i);
});
test('snapshot reports missing fields and accepts legitimate zero-valued inputs', () => {
  const valid = prepareSnapshot([employee], period);
  assert.equal(valid.issues.length, 0);
  assert.equal(valid.inputs[0].distance_from_home_km, 0);
  const invalid = prepareSnapshot([{ ...employee, age: 0, educationLevel: undefined }], period);
  assert.ok(invalid.issues.some(issue => issue.field === 'age'));
  assert.ok(invalid.issues.some(issue => issue.field === 'educationLevel'));
});
test('snapshot freezes source values and excludes inactive or out-of-scope employees', () => {
  const source = { ...employee };
  const result = prepareSnapshot([source, { ...employee, id: '2', status: 'Inactive' }], period);
  source.monthlyIncome = 9000;
  assert.equal(result.inputs.length, 1);
  assert.equal(result.inputs[0].monthly_income, 5000);
});
test('model evaluation calculates metrics from a fixed confusion matrix', () => {
  const model = evaluateModel({ version: 'v1', status: 'Draft', matrix: { tp: 8, fp: 2, fn: 2, tn: 8 } });
  assert.equal(model.status, 'Evaluated');
  assert.equal(model.metrics?.accuracy, 0.8);
  assert.throws(() => evaluateModel({ version: 'v1', status: 'Draft', matrix: { tp: 0, fp: 0, fn: 0, tn: 0 } }), /evaluation/i);
});
test('activation requires evaluation and retires the previous active version', () => {
  assert.throws(() => activateModel([{ version: 'v1', status: 'Draft' }], 'v1'), /evaluat/i);
  const evaluated = evaluateModel({ version: 'v2', status: 'Draft', matrix: { tp: 8, fp: 2, fn: 2, tn: 8 } });
  const models = activateModel([{ version: 'v1', status: 'Active' }, evaluated], 'v2');
  assert.deepEqual(models.map(model => model.status), ['Retired', 'Active']);
});
test('demo prediction run requires a current valid snapshot and active model', () => {
  const snapshot = prepareSnapshot([employee], period);
  assert.throws(() => createDemoRun(snapshot, null, [employee], []), /active model/i);
  assert.throws(() => createDemoRun(snapshot, { version: 'v1', status: 'Active' }, [{ ...employee, monthlyIncome: 9999 }], []), /changed/i);
  assert.throws(() => createDemoRun(prepareSnapshot([{ ...employee, age: 0 }], period), { version: 'v1', status: 'Active' }, [employee], []), /valid/i);
});
test('fixture run preserves input/run/prediction/explanation references without inventing new scores', () => {
  const snapshot = prepareSnapshot([employee], period);
  const fixture = { employeeId: '1', probability: 0.78, explanations: [{ feature_name: 'overtime_hours', feature_value: 0, impact_value: 0.12, impact_direction: 'increase', rank_order: 1 }] };
  const run = createDemoRun(snapshot, { version: 'v1', status: 'Active' }, [employee], [fixture]);
  assert.equal(run.mode, 'demo-fixture');
  assert.equal(run.results[0].snapshot_id, snapshot.inputs[0].id);
  assert.equal(run.results[0].prediction_run_id, run.id);
  assert.equal(run.results[0].attrition_probability, 0.78);
  assert.equal(run.results[0].explanations[0].prediction_result_id, run.results[0].id);
  assert.throws(() => createDemoRun(snapshot, { version: 'v1', status: 'Active' }, [employee], []), /fixture/i);
});
