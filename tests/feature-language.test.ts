import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import ts from 'typescript';
import { tmpdir } from 'node:os';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { createServer } from 'vite';
const chunks = (html: string) => new Set(html.split(/<[^>]*>/g).map(text => text.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').trim()).filter(Boolean));

test('all routed feature pages use VI/EN consistently and preserve navigation and form values', async () => {
 const saved = new Map<string, PropertyDescriptor | undefined>(), session = new Map<string, string>(), local = new Map<string, string>();
 const storage = (map: Map<string, string>) => ({ getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => map.set(key, value), removeItem: (key: string) => map.delete(key) });
 for (const [key, value] of Object.entries({ sessionStorage: storage(session), localStorage: storage(local), window: { innerWidth: 1440, dispatchEvent() {}, addEventListener() {}, removeEventListener() {} } })) {
  saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));Object.defineProperty(globalThis, key, { configurable: true, value });
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
  const { readDatabase } = await server.ssrLoadModule('/src/erd/database.ts');
  const { loadReports } = await server.ssrLoadModule('/src/utils/reportStore.ts');
  const employeeId = readDatabase().employees[0].id;
  const reportId = loadReports()[0].id;
  type Page = [number, string, string, Record<string, unknown>?];
  const pages: Page[] = [
   [0,'/departments','Departments'],[0,'/positions','Positions'],[0,'/employees','HrEmployees'],[0,'/employees/new','HrEmployees'],
   [0,'/org-overview','RiskWorkspace'],[0,'/attrition-risk','RiskWorkspace'],[0,'/executive-reports','RiskWorkspace',{reports:true}],
   [0,'/employees','Employees'],[0,'/employees/new','EmployeeDataManagement',{mode:'add'}],[0,'/employees/bulk-update','EmployeeDataManagement',{mode:'bulk'}],[0,'/employees/import','EmployeeImport'],
   [0,'/employees/'+employeeId,'ErdEmployeeDetails'],[0,'/employees/'+employeeId+'/edit','EmployeeRecord'],[0,'/employees/'+employeeId+'/risk','RiskAnalysis'],
   [0,'/employee-requests','EmployeeRequests'],[0,'/org-chart','OrgChart'],[0,'/onboarding','Onboarding'],[0,'/interventions','RetentionInterventions'],[0,'/outcomes','EmployeeOutcomes'],[0,'/engagement','ErdSurveys'],[0,'/reports/'+reportId,'ReportDetail'],
   [1,'/employees','Employees'],[1,'/employees/new','EmployeeDataManagement',{mode:'add'}],[1,'/employees/import','EmployeeImport'],[1,'/preparation','WorkforceSnapshot'],[1,'/schema','ErdSchema'],[1,'/model-performance','ModelLifecycle'],[1,'/ai-config','ModelLifecycle'],[1,'/predictions','Predictions'],[1,'/feature-importance','FeatureImportance'],[1,'/model-history','Predictions'],[1,'/data-pipelines','DataPipelines'],[1,'/audit-logs','WorkflowActivity'],
   [2,'/users','ErdAccounts'],[2,'/roles','Roles'],[2,'/roles?tab=matrix','Roles'],[2,'/system','SystemConfig'],[2,'/activity','WorkflowActivity'],[2,'/system-health','SystemHealth'],
   [3,'/my-profile','ErdOwnProfile'],[3,'/my-attendance','EmployeePortal',{mode:'attendance'}],[3,'/my-requests','EmployeePortal',{mode:'requests'}],[3,'/my-payroll','EmployeePortal',{mode:'payroll'}],[3,'/my-performance','EmployeePortal',{mode:'performance'}],[3,'/my-offboarding','EmployeePortal',{mode:'offboarding'}],[3,'/my-surveys','ErdSurveys'],
  ];
  const modules = Object.fromEntries(await Promise.all([...new Set(pages.map(page=>page[2]))].map(async name=>[name,(await server.ssrLoadModule('/src/screens/'+name+'.tsx')).default])));
  const translators: Record<string, (text: string) => string> = {};
  function CaptureLanguage() { const { t, language } = useLanguage(); translators[language] = t; return null; }
  const missing: Record<string, {vi:string[];en:string[]}> = {};
  const identity = (text:string) => /^(Nguyen |Tran |Pham |Le |Hoang |Dang |Bui |Vo |Do |Ly |Mai |Doan )/.test(text) || text.includes('@') || text.startsWith('{\n') || /^[0-9]{4}-Q[1-4]$/.test(text) || /^[0-9]{4}-[0-9]{2}-[0-9]{2} → [0-9]{4}-[0-9]{2}-[0-9]{2} · v[0-9.]+ · /.test(text) || /^Admin System$/.test(text) || /^EMP-[0-9]+ · /.test(text) || /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(text) || /^[a-z_]+ \*$/.test(text) || /^FK → [a-z_]+\.id$/.test(text) || ['Asia/Ho_Chi_Minh (UTC+7)', 'MMM DD, YYYY'].includes(text) || /^(ERIS|e|VI|EN|Email|ID|CSV|Excel|PDF|AI|ML|AI \/ ML|SHAP|API|KPI|OKR|F1|ROC-AUC|USD|UUID|PK|FK|HRIS|Workday HRIS|ADP Payroll|Lattice API|SurveyMonkey API|Google Forms|Redis Cache|PostgreSQL \(Primary\)|File Storage \(S3\))$/.test(text) || /^([a-z_]+|[A-Z_]+|[a-f0-9-]{36}|EMP-[0-9]+|v[0-9.]+|[0-9.,%$\s:/–-]+|[0-9]+(ms|m|s))$/.test(text);
  const checkPage = ([role,path,name,props]: Page, scenario = '') => {
   const render = (language:string) => {
    session.set('eris-user',JSON.stringify(ROLE_USERS[role]));local.set('eris-language',language);
    const pattern = path.startsWith('/employees/'+employeeId) ? '/employees/:id'+(path.endsWith('/edit')?'/edit':path.endsWith('/risk')?'/risk':'') : path.startsWith('/reports/')?'/reports/:reportId':path.split('?')[0];
    const screen = React.createElement(Routes,null,React.createElement(Route,{path:pattern,element:React.createElement(modules[name],props)}));
    return renderToStaticMarkup(React.createElement(MemoryRouter,{initialEntries:[path]},React.createElement(LanguageProvider,null,React.createElement(RoleProvider,null,React.createElement(EmployeeProvider,null,React.createElement(WorkflowProvider,null,React.createElement(CaptureLanguage),screen))))));
   };
   const english=render('en'),vietnamese=render('vi'),en=chunks(english),vi=chunks(vietnamese);
   if(name === 'RiskWorkspace') { assert.ok(en.has('Employee')); assert.ok(en.has('Department')); assert.ok(!en.has('employee_id')); }
   const leftVi=[...vi].filter(text=>!ROLE_USERS.some(actor=>actor.name===text||actor.initials===text)&&/[a-zA-Z]/.test(text)&&!identity(text)&&(en.has(text)||(!/[\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u024f\u1ea0-\u1ef9]/.test(text)&&/[a-zA-Z]{3}/.test(text)&&translators.en(text)===text)));
   const leftEn=[...en].filter(text=>!ROLE_USERS.some(actor=>actor.name===text)&&/[\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u024f\u1ea0-\u1ef9]/.test(text));
   if(leftVi.length||leftEn.length)missing[scenario+ROLE_USERS[role].role+' '+path]={vi:leftVi,en:leftEn};
   assert.deepEqual([...english.matchAll(/href="([^"]+)"/g)].map(match=>match[1]),[...vietnamese.matchAll(/href="([^"]+)"/g)].map(match=>match[1]),path+': destination changed');
   assert.deepEqual([...english.matchAll(/<option[^>]*value="([^"]*)"/g)].map(match=>match[1]),[...vietnamese.matchAll(/<option[^>]*value="([^"]*)"/g)].map(match=>match[1]),path+': submitted option changed');
  };
  for(const page of pages)checkPage(page);
  // Real saved input/run/result records exercise content hidden in the initial empty state.
  const { employeeView } = await server.ssrLoadModule('/src/erd/employeeView.ts');
  const { prepareSnapshot, createDemoRun, fingerprint } = await server.ssrLoadModule('/src/workflows/domain.ts');
  const { transactDatabase, makeRow } = await server.ssrLoadModule('/src/erd/database.ts');
  const { saveSnapshotRows, saveRunRows } = await server.ssrLoadModule('/src/erd/runPersistence.ts');
  const { createSurvey } = await server.ssrLoadModule('/src/erd/surveys.ts');
  const db = readDatabase();
  const view = { ...employeeView(db,db.employees[0]),age:28,tenure:2,monthlyIncome:5800,jobSatisfaction:3,environmentSatisfaction:3,educationLevel:3,distanceFromHomeKm:0,totalWorkingYears:5,yearsInCurrentRole:1,yearsSinceLastPromotion:0,yearsWithCurrentManager:1,overtimeHours:0 };
  const snapshot = prepareSnapshot([view],{start:'2026-10-01',end:'2026-10-18',scope:''});
  const model = { version:'v2.3',status:'Active' };
  const run = createDemoRun(snapshot,model,[view],[{employeeId:view.id,probability:0.7,explanations:[{feature_name:'job_satisfaction',feature_value:3,impact_value:-0.1,impact_direction:'decrease',rank_order:1}]}]);
  transactDatabase((draft: typeof db)=>{
    saveSnapshotRows(draft,snapshot);saveRunRows(draft,run,draft.users[1].id);
    createSurvey(draft,draft.users[0].id,{title:'CUSTOM_SURVEY_TITLE',description:'CUSTOM_SURVEY_DESCRIPTION',start_date:'2000-01-01',end_date:'2099-12-31',questions:[{question_text:'CUSTOM_QUESTION_TEXT',dimension_code:'general',required:true}]});
    draft.audit_logs.push(makeRow('audit_logs',{user_id:draft.users[0].id,entity_type:'EMPLOYEES',entity_id:draft.employees[0].id,action:'Update employee',old_value:null,new_value:null}));
  });
  snapshot.source = fingerprint(readDatabase().employees.map((row:object)=>employeeView(readDatabase(),row)),snapshot);
  session.set('eris-erd-workflow-ui-v1',JSON.stringify({snapshot,models:[model]}));
  for(const page of pages.filter(page=>['RiskWorkspace','RiskAnalysis','Predictions','WorkforceSnapshot','ModelLifecycle','EmployeeOutcomes','ErdEmployeeDetails','EmployeeRecord','WorkflowActivity','ErdSurveys'].includes(page[2])))checkPage(page,'populated ');
  // Inspect copy in later form steps and closed dialogs as well as initially rendered screens.
  const app = readFileSync('src/App.tsx', 'utf8');
  const sources = [...new Set([...app.matchAll(/from '\.\/screens\/([^']+)'/g)].map(match=>'src/screens/'+match[1]+'.tsx'))].filter(file=>!['Landing','Login','PublicDetail'].some(name=>file.endsWith('/'+name+'.tsx')));
  sources.push('src/screens/RBACMatrix.tsx','src/components/EmployeePrediction.tsx','src/components/EmployeeRetentionSummary.tsx','src/components/ErdEmployeeRelations.tsx','src/components/ui.tsx');
  const copy = new Set<string>();
  for(const file of sources){
    const source = ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    function visit(node:ts.Node){
      if(ts.isCallExpression(node)&&node.expression.getText(source)==='t'&&node.arguments.length){
        const input = node.arguments[0];
        if(ts.isStringLiteral(input)||ts.isNoSubstitutionTemplateLiteral(input))copy.add(input.text);
        if(ts.isTemplateExpression(input)){
          let key=input.head.text;input.templateSpans.forEach((span,index)=>key+='{p'+index+'}'+span.literal.text);
          if(/[A-Za-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u024f\u1ea0-\u1ef9]{3}/.test(key.replace(/\{p[0-9]+\}/g,'')))copy.add(key.replace(/\{p([0-9]+)\}/g,(_,index)=>'TOKEN'+index));
        }
      }
      ts.forEachChild(node,visit);
    }visit(source);
  }
  const missingCopy = [...copy].filter(text=>/[A-Za-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u024f\u1ea0-\u1ef9]/.test(text)&&!identity(text)&&!text.startsWith('FK → ')).filter(text=>{
    const language = /[\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u024f\u1ea0-\u1ef9]/.test(text) ? 'en':'vi';
    return translators[language](text)===text;
  });
  if(missingCopy.length)missing['conditional UI copy']={en:missingCopy.filter(text=>/[\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u024f\u1ea0-\u1ef9]/.test(text)),vi:missingCopy.filter(text=>!/[\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u024f\u1ea0-\u1ef9]/.test(text))};
  writeFileSync(tmpdir()+'/eris-feature-language-missing.json',JSON.stringify(missing,null,2));
  assert.deepEqual(missing,{},'Mixed-language feature text; diagnostics are in the temp report');
 } finally {
  await server.close();for(const [key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
 }
});
