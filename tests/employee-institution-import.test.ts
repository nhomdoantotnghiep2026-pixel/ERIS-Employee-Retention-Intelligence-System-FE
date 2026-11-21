import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';

test('employee import preview keeps institution choices and upload sends them with the original file', async()=>{
 const server=await createServer({configFile:false,server:{middlewareMode:true,ws:false}});
 const originalFetch=globalThis.fetch,storage=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
 let last:RequestInit|undefined,url='';
 Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:()=> 'hr-token'}});
 const review={total:1,valid:0,failed:0,pending:1,results:[{row:2,status:'NEEDS_REVIEW',institutions:[{educationIndex:0,originalName:'School',status:'NEEDS_SELECTION',selectedId:null,candidates:[{id:'https://ror.org/012345678',institution:'School',source:'ROR'}]}]}]};
 globalThis.fetch=async(input,init)=>{url=String(input);last=init;return Response.json(review);};
 try{
  const api=await server.ssrLoadModule('/src/services/api.ts');
  const file=new File(['workbook'],'employees.xlsx');
  assert.deepEqual(await api.previewEmployeeImport(file),review);
  assert.ok(url.endsWith('/employees/import/preview'));
  assert.equal((last?.body as FormData).get('file'),file);
  const choices=[{row:2,educationIndex:0,institutionRefId:'https://ror.org/012345678'}];
  await api.importEmployees(file,choices);
  assert.ok(url.endsWith('/employees/import'));
  assert.deepEqual(JSON.parse(String((last?.body as FormData).get('institutionChoices'))),choices);
  assert.equal((last?.body as FormData).get('file'),file);
  assert.equal(new Headers(last?.headers).get('Authorization'),'Bearer hr-token');
 }finally{
  globalThis.fetch=originalFetch;
  if(storage)Object.defineProperty(globalThis,'sessionStorage',storage);else Reflect.deleteProperty(globalThis,'sessionStorage');
  await server.close();
 }
});
