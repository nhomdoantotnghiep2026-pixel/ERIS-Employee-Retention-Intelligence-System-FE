import { useEmployees } from '../context/EmployeeContext';
import { useWorkflow } from '../context/WorkflowContext';
// Keep immutable saved predictions separate from editable employee master data.
export function useRiskEmployees() {
  const { employees } = useEmployees();
  const { runs } = useWorkflow();
  return { employees: employees.map(employee => {
    const result = runs.flatMap(run => run.results).find(item => item.employee_id === employee.id);
    return result ? { ...employee, riskLevel: result.risk_level, riskScore: Math.round(result.attrition_probability * 100), lastAnalysis: result.created_at, predictionSource: 'Saved demo fixture' } : { ...employee, predictionSource: employee.lastAnalysis === 'Not analyzed' ? 'No prediction' : 'Seed demo fixture' };
  }) };
}
