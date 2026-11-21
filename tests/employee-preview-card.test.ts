import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

test('preview groups all education records within one employee card, renders full fields, and reflects institution decisions',async()=>{
 const server=await createServer({configFile:false,appType:'custom',server:{middlewareMode:true,hmr:false,ws:false},esbuild:{jsx:'automatic'}});
 try{
  const {LanguageProvider}=await server.ssrLoadModule('/src/context/LanguageContext.tsx');
  const {default:Card}=await server.ssrLoadModule('/src/components/EmployeeImportPreviewCard.tsx');
  const row={row:2,status:'NEEDS_REVIEW',employee:{fullName:'Nguyễn An',employee_code:'EMP001',email:'an@example.com',phone:'0901234567',departmentName:'Finance',positionName:'Analyst',dateOfBirth:'1995-04-12',hireDate:'2024-01-01',currentSalary:15000000,custom_field:'Extra imported value',educations:[{educationLevel:'Bachelor',institution:'School A',fieldOfStudy:'Finance',graduationYear:2017},{educationLevel:'Master',institution:'School B',graduationYear:2020}]},institutions:[{educationIndex:0,originalName:'School A',status:'NEEDS_SELECTION',selectedId:null,candidates:[{id:'school-a',institution:'School A',source:'ROR'}]},{educationIndex:1,originalName:'School B',status:'MATCHED',selectedId:'school-b',candidates:[{id:'school-b',institution:'School B',source:'ROR'}]}]};
  const render=(value:unknown,choices:unknown[]=[])=>renderToStaticMarkup(React.createElement(LanguageProvider,{initialLanguage:'vi'},React.createElement(Card,{row:value,choices,onChoose:()=>{},text:(vi:string)=>vi})));
  let html=render(row);assert.equal((html.match(/<article/g)||[]).length,1);
  for(const value of ['Nguyễn An','EMP001','0901234567','Finance','Analyst','12/04/1995','01/01/2024','15.000.000','Extra imported value','Bachelor','Master','School A','School B','Cần kiểm tra'])assert.ok(html.includes(value),value);
  assert.ok(html.includes('grid-cols-2'));assert.ok(html.includes('md:grid-cols-3'));assert.ok(html.includes('<select'));
  html=render(row,[{row:2,educationIndex:0,institutionRefId:'school-a'}]);assert.ok(html.includes('Hợp lệ'));assert.ok(!html.includes('Cần kiểm tra'));
  html=render({...row,status:'FAILED',issue:{sheet:'Employees',cell:'D2',field:'phone',message:'Invalid phone'}});
  for(const value of ['border-red-200','Lỗi định dạng','D2','Invalid phone','Nguyễn An','School B'])assert.ok(html.includes(value),value);
  html=render({...row,status:'VALID',institutions:[{...row.institutions[0],status:'NOT_FOUND',candidates:[],warning:'School not found'}]});assert.ok(html.includes('School not found'));assert.ok(html.includes('Cần kiểm tra'));
 }finally{await server.close();}
});
