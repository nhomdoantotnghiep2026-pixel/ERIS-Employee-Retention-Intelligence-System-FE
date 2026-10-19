import test from 'node:test';
import assert from 'node:assert/strict';
import { createTranslator } from '../src/utils/translateText.ts';
import { featureEnglish, featureVietnamese } from '../src/data/featureTranslations.ts';

test('known formatted UI messages translate with their parameters and escaped punctuation', () => {
 const vi=createTranslator(featureVietnamese,'vi'), en=createTranslator(featureEnglish,'en');
 assert.equal(vi('This change will update 12 employee records.'),'Thay đổi này sẽ cập nhật 12 hồ sơ nhân viên.');
 assert.equal(en('Kích hoạt v2.3?'),'Activate v2.3?');
 assert.equal(en('Xem xét snapshot · 2026-10-01 → 2026-10-18'),'Review snapshot · 2026-10-01 → 2026-10-18');
 assert.equal(vi('Row 2: age is required.'),'Dòng 2: bắt buộc nhập Tuổi.');
 assert.equal(vi('age: required integer from 18 to 100.'),'Tuổi: cần nhập số nguyên từ 18 đến 100.');
 assert.equal(vi('{action} {permission} for {role}',{action:'Cấp',permission:'Xem hồ sơ',role:'Nhân sự'}),'Cấp Xem hồ sơ cho Nhân sự');
});

test('unknown user content, identifiers and replacement values are not rewritten', () => {
 const translate=createTranslator(featureVietnamese,'vi');
 for(const text of ['Nguyễn Văn A','person@example.com','EMP-013','Custom memo for Lan','constructor','toString','a+b[0]?.csv'])assert.equal(translate(text),text);
 assert.equal(translate('{action} {permission} for {role}',{action:'CUSTOM_ACTION',permission:'x.y({test})',role:'TENANT_ROLE'}),'CUSTOM_ACTION x.y({test}) cho TENANT_ROLE');
 assert.equal(translate(null),'');assert.equal(translate(7),'7');
});

test('known display dates change locale without changing stored dates or currency', () => {
 assert.equal(createTranslator(featureVietnamese,'vi')('Sep 23, 2026 02:01'),'23/09/2026 02:01');
 assert.equal(createTranslator(featureEnglish,'en')('Sep 23, 2026 02:01'),'Sep 23, 2026 02:01');
 assert.equal(createTranslator(featureVietnamese,'vi')('2026-09-23'),'2026-09-23');
});
