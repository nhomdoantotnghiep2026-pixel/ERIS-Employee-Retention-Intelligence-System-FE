import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('new backend APIs use the published routes and payload contracts', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false } });
  const originalFetch = globalThis.fetch;
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({ data: [] });
  };
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: { getItem: () => 'new-api-test-token' },
  });
  try {
    const api = await server.ssrLoadModule('/src/services/api.ts');
    await api.getAttendanceConfig();
    await api.listAttendanceHistory();
    await api.getAttendanceRecord(19);
    await api.listEmployeeEducation(7);
    await api.listOwnEducation();
    await api.listAllEmployeeEducation();
    await api.listEducationEmployees();
    await api.searchEducationInstitutions('University of Example', 2);
    await api.createEmployeeEducation(7, {
      educationLevel: 2, fieldOfStudy: 'Computer science', institution: 'Example University',
      institutionRefId: 'https://ror.org/012345678',
    });
    await api.updateEmployeeEducation(7, 3, { graduationYear: 2020 });
    await api.deactivateEmployeeEducation(7, 3);
    await api.listEmployeeJobHistory(7);
    await api.listOwnJobHistory();
    await api.listAllJobHistory();
    await api.listAllEmployeeWorkExperiences();
    await api.listEmployeeWorkExperiences(7);
    await api.createEmployeeWorkExperience(7, {
      companyName: 'Example Company', positionTitle: 'Frontend Developer', startDate: '2024-01-01', endDate: null,
    });
    await api.deactivateEmployeeWorkExperience(7, 4);
    await api.listSurveys();
    await api.listAvailableSurveys();
    await api.getSurveyForEmployee(9);
    await api.createSurvey({
      title: 'Engagement check-in', description: 'Quarterly survey',
      startDate: '2026-10-01T00:00:00+07:00', endDate: '2026-10-31T23:59:59+07:00',
    });
    await api.publishSurvey(9);
    await api.getSurveyResults(9);
    await api.getSurveyParticipants(9);
    await api.getMySurveyResponse(9);
    await api.submitSurveyResponse(9, [{ questionId: 2, score: 4, comment: 'Good' }]);

    assert.deepEqual(calls.map(call => call.url), [
      '/api/v1/attendance/config',
      '/api/v1/attendance',
      '/api/v1/attendance/19',
      '/api/employees/7/educations',
      '/api/employees/me/educations',
      '/api/employee-educations',
      '/api/employee-educations/employees',
      '/api/employee-educations/institutions?name=University+of+Example&educationLevel=2',
      '/api/employees/7/educations',
      '/api/employees/7/educations/3',
      '/api/employees/7/educations/3',
      '/api/employees/7/job-histories',
      '/api/employees/me/job-histories',
      '/api/job-histories',
      '/api/employee-work-experiences',
      '/api/employees/7/work-experiences',
      '/api/employees/7/work-experiences',
      '/api/employees/7/work-experiences/4',
      '/api/surveys',
      '/api/surveys/available',
      '/api/surveys/9',
      '/api/surveys',
      '/api/surveys/9/publish',
      '/api/surveys/9/results',
      '/api/surveys/9/responses',
      '/api/surveys/9/my-response',
      '/api/surveys/9/responses',
    ]);
    assert.equal(calls[8].init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(calls[8].init?.body)), {
      educationLevel: 2, fieldOfStudy: 'Computer science', institution: 'Example University',
      institutionRefId: 'https://ror.org/012345678',
    });
    assert.equal(calls[9].init?.method, 'PATCH');
    assert.equal(calls[10].init?.method, 'DELETE');
    assert.equal(calls[16].init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(calls[16].init?.body)), {
      companyName: 'Example Company', positionTitle: 'Frontend Developer', startDate: '2024-01-01', endDate: null,
    });
    assert.equal(calls[17].init?.method, 'DELETE');
    assert.deepEqual(JSON.parse(String(calls[21].init?.body)), {
      title: 'Engagement check-in', description: 'Quarterly survey',
      startDate: '2026-10-01T00:00:00+07:00', endDate: '2026-10-31T23:59:59+07:00',
    });
    assert.deepEqual(JSON.parse(String(calls[26].init?.body)), {
      answers: [{ questionId: 2, score: 4, comment: 'Good' }],
    });
    for (const call of calls) {
      assert.ok(new Headers(call.init?.headers).get('Authorization'));
      assert.equal(call.init?.credentials, 'include');
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (storage) Object.defineProperty(globalThis, 'sessionStorage', storage);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
    await server.close();
  }
});
