import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
test('partial import explicitly requests skip_invalid and excludes unsafe rows from the save count',async()=>{
 const server=await createServer({configFile:false,server:{middlewareMode:true,ws:false}});
 const original=globalThis.fetch,storage=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
 let request:RequestInit|undefined;
 Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:()=> 'hr-token'}});
 globalThis.fetch=async(_url,init)=>{request=init;return Response.json({status:'CONFIRMED',inserted:2,skipped:0,excluded:1,skipped_invalid:1,rows:[]});};
 try{
  const api=await server.ssrLoadModule('/src/services/attendance.ts');
  const base={action:'INSERT',validation_status:'VALID',issues:[]};
  const rows=[{...base,excel_row:2},{...base,excel_row:3,validation_status:'WARNING',issues:[{severity:'WARNING'}]},{...base,excel_row:4,validation_status:'ERROR'},{...base,excel_row:5,excluded:true},{...base,excel_row:6,issues:[{severity:'INFO',requires_resolution:true}]},{...base,excel_row:7,validation_status:'INCOMPLETE'},{...base,excel_row:8,action:'SKIP',validation_status:'DUPLICATE'}];
  assert.deepEqual(api.saveableAttendanceRows(rows).map((r:{excel_row:number})=>r.excel_row),[2,3]);
  await api.confirmAttendance(new File(['xlsx'],'attendance.xlsx'),'preview-token',[],true,true);
  let options=JSON.parse(String((request?.body as FormData).get('options')));assert.equal(options.skip_invalid,true);assert.equal(options.confirm_warnings,true);assert.equal(options.preview_token,'preview-token');
  await api.confirmAttendance(new File(['xlsx'],'attendance.xlsx'),'preview-token',[],false);
  options=JSON.parse(String((request?.body as FormData).get('options')));assert.equal(options.skip_invalid,undefined);
 }finally{globalThis.fetch=original;if(storage)Object.defineProperty(globalThis,'sessionStorage',storage);else Reflect.deleteProperty(globalThis,'sessionStorage');await server.close();}
});
