import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('handoff attendance, survey and policy APIs send the documented methods and bodies', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const originalFetch = globalThis.fetch;
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const calls: Array<{path:string; init?:RequestInit}> = [];
  Object.defineProperty(globalThis, 'sessionStorage', {configurable:true, value:{getItem:()=> 'test-token'}});
  globalThis.fetch = async (url, init) => {calls.push({path:new URL(String(url), 'http://localhost').pathname, init}); return Response.json({data:{}});};
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts');
    await api.createLeaveRequest({fromDate:'2027-01-11',toDate:'2027-01-12',reason:'test'});
    await api.listLeaveRequests(true); await api.listLeaveRequests(false); await api.getLeaveHistory(7);
    await api.reviewLeaveRequest(7,'APPROVED','ok'); await api.cancelLeaveRequest(7,'reason');
    await api.reviewLeaveRequest(7,'REJECTED','note',true);
    await api.listAttendanceHolidays(); await api.createAttendanceHoliday({start_date:'2027-01-01',end_date:'2027-01-02',name:'Holiday'}); await api.updateAttendanceHoliday(8,{start_date:'2027-01-03',end_date:'2027-01-04',name:'Holiday'}); await api.deleteAttendanceHoliday(8); await api.closeAttendanceDay('2026-12-31');
    await api.updateSurvey(4,{description:'new'}); await api.closeSurvey(4); await api.getSurveyResponse(4,9);
    await api.createPolicyDemo([1,2]); await api.getPolicyPrediction(2); await api.listRetentionPolicies(); await api.getRetentionPolicy(3); await api.listPolicyRecommendations(); await api.getPolicyRecommendation(4);
    assert.deepEqual(calls.map(c=>[c.init?.method || 'GET',c.path]), [
      ['POST','/api/v1/attendance/leave-requests'],['GET','/api/v1/attendance/leave-requests/me'],['GET','/api/v1/attendance/leave-requests'],['GET','/api/v1/attendance/leave-requests/7/history'],
      ['PATCH','/api/v1/attendance/leave-requests/7'],['POST','/api/v1/attendance/leave-requests/7/cancellation'],['PATCH','/api/v1/attendance/leave-requests/7/cancellation'],
      ['GET','/api/v1/attendance/holidays'],['POST','/api/v1/attendance/holidays'],['PUT','/api/v1/attendance/holidays/8'],['DELETE','/api/v1/attendance/holidays/8'],['POST','/api/v1/attendance/close-day'],
      ['PATCH','/api/surveys/4'],['POST','/api/surveys/4/close'],['GET','/api/surveys/4/responses/9'],
      ['POST','/api/prediction-results/demo'],['GET','/api/prediction-results/2'],['GET','/api/retention-policies'],['GET','/api/retention-policies/3'],['GET','/api/policy-recommendations'],['GET','/api/policy-recommendations/4'],
    ]);
    assert.deepEqual(JSON.parse(String(calls[6].init?.body)), {decision:'REJECTED',reviewNote:'note'});
    assert.deepEqual(JSON.parse(String(calls[8].init?.body)), {start_date:'2027-01-01',end_date:'2027-01-02',name:'Holiday'});
    assert.deepEqual(JSON.parse(String(calls[9].init?.body)), {start_date:'2027-01-03',end_date:'2027-01-04',name:'Holiday'});
    assert.deepEqual(JSON.parse(String(calls[15].init?.body)), {employeeIds:[1,2]});
    assert.ok(calls.every(c => new Headers(c.init?.headers).get('Authorization') === 'Bearer test-token'));
  } finally {globalThis.fetch=originalFetch; if(storage) Object.defineProperty(globalThis,'sessionStorage',storage); else Reflect.deleteProperty(globalThis,'sessionStorage'); await server.close();}
});
