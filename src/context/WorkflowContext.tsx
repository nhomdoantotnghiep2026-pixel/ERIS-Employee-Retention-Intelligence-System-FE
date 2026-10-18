import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { activateModel, createDemoRun, evaluateModel, prepareSnapshot, fingerprint, type ModelRun, type ModelVersion, type Period, type Snapshot } from '../workflows/domain';
import { employees as fixtures } from '../data/mockData';
import { useEmployees } from './EmployeeContext';
import { useRole } from './RoleContext';
import { recordAudit } from '../workflows/audit';
import { useErd } from '../erd/useErd';
import { actorRow, transactDatabase } from '../erd/database';
import { saveSnapshotRows, saveRunRows, loadRunViews } from '../erd/runPersistence';
import { employeeView, readInputDrafts } from '../erd/employeeView';

interface WorkflowState { snapshot: Snapshot | null; models: ModelVersion[]; runs: ModelRun[] }
const initial: WorkflowState = { snapshot: null, runs: [], models: [
  { version: 'v2.3', status: 'Draft', matrix: { tp: 312, fp: 41, fn: 67, tn: 580 } },
  { version: 'v2.2', status: 'Draft', matrix: { tp: 290, fp: 48, fn: 89, tn: 573 } },
] };
function load(): WorkflowState {
  try { const saved = JSON.parse(sessionStorage.getItem('eris-erd-workflow-ui-v1') || 'null'); return saved && Array.isArray(saved.models) ? { ...saved,runs:[] } : initial; } catch { return initial; }
}
const WorkflowContext = createContext<(WorkflowState & {
  generateSnapshot: (period: Period) => void; evaluate: (version: string) => void; activate: (version: string) => void; generate: () => ModelRun;
}) | null>(null);
export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(load);
  const db = useErd();
  const runs = loadRunViews(db);
  const { employees } = useEmployees();
  const { user } = useRole();
  useEffect(() => { sessionStorage.setItem('eris-erd-workflow-ui-v1', JSON.stringify({ snapshot:state.snapshot,models:state.models })); }, [state]);
  const analystOnly = () => { if (user.role !== 'Data / AI Analyst') throw new Error('Only the Data / AI Analyst can perform this action.'); };
  const generateSnapshot = (period: Period) => {
    if (!['HR', 'Data / AI Analyst'].includes(user.role)) throw new Error('Access denied.');
    const snapshot = prepareSnapshot(db.employees.map(row => employeeView(db,row,readInputDrafts(),period.end)), period);
    snapshot.source = fingerprint(employees,period);
    if (!snapshot.issues.length) transactDatabase(draft => saveSnapshotRows(draft,snapshot));
    setState(previous => ({ ...previous, snapshot }));
    recordAudit('AI_INPUT', snapshot.id, snapshot.issues.length ? 'Snapshot validation failed' : 'Generate validated snapshot', null, { period, inputs: snapshot.inputs.length, issues: snapshot.issues.length });
  };
  const evaluate = (version: string) => {
    analystOnly();
    const model = state.models.find(item => item.version === version);
    if (!model) throw new Error('Model not found.');
    const evaluated = evaluateModel(model);
    setState(previous => ({ ...previous, models: previous.models.map(item => item.version === version ? evaluated : item) }));
    recordAudit('MODEL_RUN', version, 'Evaluate model on labeled demo fixture', null, evaluated.metrics);
  };
  const activate = (version: string) => {
    analystOnly();
    const models = activateModel(state.models, version);
    setState(previous => ({ ...previous, models }));
    recordAudit('MODEL_RUN', version, 'Activate evaluated model version', state.models.find(model => model.status === 'Active')?.version || null, version);
  };
  const generate = () => {
    analystOnly();
    if (!state.snapshot) throw new Error('Generate and review a snapshot first.');
    const run = createDemoRun(state.snapshot, state.models.find(model => model.status === 'Active') || null, employees, fixtures.map(employee => ({ employeeId: employees.find(row => row.employeeId === employee.employeeId)?.id || '', probability: employee.riskScore / 100, explanations: [
      { feature_name: 'overtime_hours', feature_value: Number(employee.overtime), impact_value: 0.18, impact_direction: 'increase', rank_order: 1 },
      { feature_name: 'job_satisfaction', feature_value: employee.jobSatisfaction, impact_value: -0.14, impact_direction: 'decrease', rank_order: 2 },
    ] })));
    const actor = actorRow(user.email);
    if (!actor) throw new Error('User record not found.');
    transactDatabase(draft => saveRunRows(draft,run,actor.id));
    recordAudit('MODEL_RUN', run.id, 'Generate demo fixture predictions and explanations', null, { model_version: run.model_version, total_employees: run.total_employees, mode: run.mode });
    return run;
  };
  return <WorkflowContext.Provider value={{ ...state,runs, generateSnapshot, evaluate, activate, generate }}>{children}</WorkflowContext.Provider>;
}
export function useWorkflow() { const value = useContext(WorkflowContext); if (!value) throw new Error('WorkflowProvider is required.'); return value; }
