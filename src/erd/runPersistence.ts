import type { ErdDatabase } from './schema.ts';
import { makeRow } from './database.ts';
import type { ModelRun, Snapshot, Explanation } from '../workflows/domain.ts';
export function saveSnapshotRows(db: ErdDatabase, snapshot: Snapshot) {
  if (snapshot.issues.length) throw new Error('Cannot persist an incomplete AI_INPUT snapshot.');
  for (const input of snapshot.inputs) if (!db.ai_input.some(row => row.id === input.id)) db.ai_input.push(makeRow('ai_input',{ ...input,created_at:snapshot.created_at }));
}
export function saveRunRows(db: ErdDatabase, run: ModelRun, userId: string) {
  db.model_run.push(makeRow('model_run',{ id:run.id,name:run.name,period_start:run.period_start,period_end:run.period_end,status:run.status,total_employees:run.total_employees,model_version:run.model_version,created_by:userId,started_at:run.created_at,completed_at:run.created_at,created_at:run.created_at }));
  for (const result of run.results) {
    const { explanations,...values } = result;
    db.prediction_results.push(makeRow('prediction_results',values));
    for (const explanation of explanations) db.explainable.push(makeRow('explainable',{ ...explanation,created_at:run.created_at }));
  }
}
export function loadRunViews(db: ErdDatabase): ModelRun[] {
  return [...db.model_run].reverse().map(run => ({
    id:run.id,name:String(run.name),period_start:String(run.period_start),period_end:String(run.period_end),status:'Completed',mode:'demo-fixture',total_employees:Number(run.total_employees),model_version:String(run.model_version),created_at:String(run.created_at),
    results:db.prediction_results.filter(row => row.prediction_run_id === run.id).map(row => ({ id:row.id,employee_id:String(row.employee_id),snapshot_id:String(row.snapshot_id),prediction_run_id:run.id,attrition_probability:Number(row.attrition_probability),risk_level:String(row.risk_level) as 'High'|'Medium'|'Low',prediction_label:String(row.prediction_label),created_at:String(row.created_at),explanations:db.explainable.filter(explanation => explanation.prediction_result_id === row.id).map(explanation => ({ prediction_result_id:row.id,feature_name:String(explanation.feature_name),feature_value:explanation.feature_value as Explanation['feature_value'],impact_value:Number(explanation.impact_value),impact_direction:String(explanation.impact_direction),rank_order:Number(explanation.rank_order) })) })),
  }));
}
