import test from 'node:test';
import assert from 'node:assert/strict';
import { overviewPriorities } from '../src/utils/retentionOverview.ts';
const people = [{id:1,employmentStatus:'ACTIVE'}, {id:2,employmentStatus:'ACTIVE'}, {id:3,employmentStatus:'INACTIVE'}] as any;
const row = (employeeId: number, predictionResultId: number, score: number, dataSource='STORED') => ({id:predictionResultId,employee:{id:employeeId},predictionResultId,attritionProbability:score,dataSource,modelVersion:'mexwell-rf12-demo-v1'}) as any;
test('overview excludes fixed demo, inactive people and invalid scores, and uses latest result per employee', () => {
 const records=[row(1,1,.9),row(1,5,.2),row(1,5,.2),row(2,6,.5),row(3,7,.99),row(2,8,.99,'DEMO_FIXED'),row(2,9,NaN),row(2,10,1.1)];
 const before=JSON.stringify(records);
 const result=overviewPriorities(people,records);
 assert.deepEqual(result.map(r=>r.predictionResultId),[6,5]);
 assert.equal(result[1].count,2); assert.equal(JSON.stringify(records),before);
 assert.equal(overviewPriorities([people[0]],records).length,1);
 assert.deepEqual(overviewPriorities(people,[{...row(1,11,.5),modelVersion:'unknown'}]),[]);
 assert.equal(overviewPriorities(people,[row(1,12,0)])[0].attritionProbability,0);
});

test('score histogram assigns boundary scores to exactly one numeric band', async () => {
 const { overviewScoreBins } = await import('../src/utils/retentionOverview.ts');
 assert.deepEqual(overviewScoreBins([0,.2,.4,.6,.8,1]),[1,1,1,1,2]);
 assert.deepEqual(overviewScoreBins([NaN,-.1,1.1]),[0,0,0,0,0]);
});

test('gender filter merges BE casing and Vietnamese aliases into the same option', async () => {
 const { normalizeOverviewGender } = await import('../src/utils/retentionOverview.ts');
 assert.deepEqual(['MALE','Male','male','Nam',' nam '].map(normalizeOverviewGender), Array(5).fill('male'));
 assert.deepEqual(['FEMALE','Female','Nữ','Nu'].map(normalizeOverviewGender), Array(4).fill('female'));
 assert.deepEqual(['OTHER','Other','Khác'].map(normalizeOverviewGender), Array(3).fill('other'));
 assert.equal(normalizeOverviewGender(null),'unknown'); assert.equal(normalizeOverviewGender('unexpected'),'unknown');
});
