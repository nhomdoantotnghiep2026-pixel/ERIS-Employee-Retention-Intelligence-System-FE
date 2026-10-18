import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createErdSeed, makeRow, validateDatabase } from '../src/erd/database.ts';
import { importLegacyEmployees } from '../src/erd/legacyImport.ts';
test('seed uses exactly ERD tables, UUID foreign keys and four unchanged actor roles', () => {
  const db = createErdSeed();
  assert.equal(Object.keys(db).length,17);
  assert.deepEqual(db.role.map(row => row.name),['HR','Data / AI Analyst','System Administrator','Employee / ESS']);
  assert.ok(db.users.find(row => row.email === 'employee@eris.com')?.employee_id);
  assert.equal('riskScore' in db.employees[0],false);
  assert.equal('job_satisfaction' in db.employees[0],false);
});
test('foreign key failures and unsupported employee fields are rejected', () => {
  const db = createErdSeed();
  db.employees[0].department_id = crypto.randomUUID();
  assert.throws(() => validateDatabase(db), /foreign key/i);
  const extra = createErdSeed(); extra.employees[0].riskScore = 42;
  assert.throws(() => validateDatabase(extra), /not in ERD/i);
  assert.throws(() => makeRow('employees',{ riskScore:42 }), /not in ERD/i);
  const badDate=createErdSeed();badDate.employees[0].date_of_birth='';
  assert.throws(() => validateDatabase(badDate), /valid date/i);
});
test('legacy employees are mapped without putting risk or analytic features in EMPLOYEES', () => {
  const db=createErdSeed();
  const previous=db.employees[0].id;
  const result=importLegacyEmployees(db,[{ id:'1',employeeId:'EMP-001',name:'Nguyen Van A',department:'Engineering',role:'Software Engineer',email:'nguyen.vana@company.com',monthlyIncome:5800,age:28,riskScore:78,status:'Active' },{ id:'old-new',employeeId:'EMP-099',name:'New person',department:'Engineering',role:'Software Engineer',email:'new@example.com',monthlyIncome:6000,status:'Active' }],values => makeRow('employees',values));
  validateDatabase(db);
  assert.equal(result.ids['1'],previous);
  assert.equal(db.employees.length,13);
  assert.equal(result.drafts[previous].age,28);
  assert.equal('riskScore' in db.employees[0],false);
  assert.equal('age' in db.employees[0],false);
  assert.equal(result.skipped,0);
});
test('survey answers cannot reference a question in a different survey', () => {
  const db = createErdSeed();
  db.surveys = ['One','Two'].map(title => makeRow('surveys',{ title,start_date:'2026-10-01',end_date:'2026-10-31',status:'Active',created_by:db.users[0].id }));
  db.survey_questions.push(makeRow('survey_questions',{ survey_id:db.surveys[1].id,question_text:'Question',dimension_code:'job_satisfaction',required:true,display_order:1 }));
  db.survey_responses.push(makeRow('survey_responses',{ survey_id:db.surveys[0].id,employee_id:db.employees[0].id,submitted_at:new Date().toISOString() }));
  db.survey_answers.push(makeRow('survey_answers',{ response_id:db.survey_responses[0].id,question_id:db.survey_questions[0].id,score:3 }));
  assert.throws(() => validateDatabase(db), /same survey/i);
});
