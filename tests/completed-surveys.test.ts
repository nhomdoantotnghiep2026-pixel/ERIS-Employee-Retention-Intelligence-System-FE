import test from 'node:test';
import assert from 'node:assert/strict';
import { completedSurveyIds, rememberCompletedSurvey } from '../src/utils/completedSurveys.ts';

test('survey history remembers only distinct submitted survey IDs and isolates employee accounts', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
  try {
    rememberCompletedSurvey('one@example.test', 7);
    rememberCompletedSurvey('one@example.test', 7);
    rememberCompletedSurvey('one@example.test', 9);
    rememberCompletedSurvey('one@example.test', -1);
    assert.deepEqual(completedSurveyIds('one@example.test'), [7, 9]);
    assert.deepEqual(completedSurveyIds('two@example.test'), []);
    assert.deepEqual(JSON.parse([...values.values()][0]), [7, 9], 'Do not store answers or completion claims locally');
    values.set('eris-completed-surveys:one@example.test', 'invalid json');
    assert.deepEqual(completedSurveyIds('one@example.test'), []);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
