import { makeRow } from './database.ts';
import type { ErdDatabase } from './schema.ts';
export function createSurvey(db: ErdDatabase, actorId: string, input: { title:string;description:string;start_date:string;end_date:string; questions:{ question_text:string;dimension_code:string;required:boolean }[] }) {
  const actor = db.users.find(row => row.id === actorId);
  if (db.role.find(role => role.id === actor?.role_id)?.name !== 'HR') throw new Error('Only HR can manage surveys.');
  if (!input.title.trim() || !input.questions.length || input.questions.some(question => !question.question_text.trim() || !question.dimension_code.trim())) throw new Error('A title and valid questions are required.');
  if (!input.start_date || !input.end_date || input.end_date < input.start_date) throw new Error('Invalid survey period.');
  const survey = makeRow('surveys',{ title:input.title.trim(),description:input.description.trim(),start_date:input.start_date,end_date:input.end_date,status:'Active',created_by:actorId });
  db.surveys.push(survey);
  input.questions.forEach((question,index) => db.survey_questions.push(makeRow('survey_questions',{ ...question,survey_id:survey.id,display_order:index+1 })));
  return survey;
}
export function submitSurvey(db: ErdDatabase, actorId:string, surveyId:string, answers:{ question_id:string;score:number;comment:string }[], today:string) {
  const actor = db.users.find(row => row.id === actorId);
  if (db.role.find(role => role.id === actor?.role_id)?.name !== 'Employee / ESS' || !actor?.employee_id) throw new Error('A linked Employee / ESS account is required.');
  const survey = db.surveys.find(row => row.id === surveyId);
  if (!survey || survey.status !== 'Active' || String(survey.start_date) > today || String(survey.end_date) < today) throw new Error('Survey is not open.');
  if (db.survey_responses.some(row => row.survey_id === surveyId && row.employee_id === actor.employee_id)) throw new Error('You already submitted this survey.');
  const questions = db.survey_questions.filter(row => row.survey_id === surveyId);
  if (new Set(answers.map(answer => answer.question_id)).size !== answers.length || answers.some(answer => !questions.some(question => question.id === answer.question_id) || !Number.isInteger(answer.score) || answer.score < 1 || answer.score > 5)) throw new Error('Answers must reference this survey and contain integer scores 1–5.');
  if (questions.some(question => question.required && !answers.some(answer => answer.question_id === question.id))) throw new Error('Complete every required question.');
  const response = makeRow('survey_responses',{ survey_id:surveyId,employee_id:actor.employee_id,submitted_at:new Date().toISOString() });
  db.survey_responses.push(response);
  answers.forEach(answer => db.survey_answers.push(makeRow('survey_answers',{ ...answer,response_id:response.id })));
  return response;
}
