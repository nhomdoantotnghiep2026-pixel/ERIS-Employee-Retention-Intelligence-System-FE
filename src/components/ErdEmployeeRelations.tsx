import { useState } from 'react';
import { Button, Card } from './ui';
import { ERD_SCHEMA, type FieldValue, type TableName } from '../erd/schema';
import { makeRow, transactDatabase } from '../erd/database';
import { useErd } from '../erd/useErd';
import { recordAudit } from '../workflows/audit';
const groups = { employee_educations:'Học vấn',employee_work_experiences:'Kinh nghiệm làm việc',employee_job_histories:'Lịch sử công tác' } as const;
type RelatedTable = keyof typeof groups;
export function ErdEmployeeRelations({ employeeId, editable = true }: { employeeId: string; editable?: boolean }) {
  const db = useErd();
  const [table,setTable] = useState<RelatedTable>('employee_educations');
  const [editing,setEditing] = useState<string | null>(null);
  const [values,setValues] = useState<Record<string,FieldValue>>({});
  const [error,setError] = useState('');
  const fields = Object.entries(ERD_SCHEMA[table]).filter(([field]) => !['id','employee_id','created_at','updated_at'].includes(field));
  const save = () => {
    try {
      const before = editing ? db[table].find(row => row.id === editing) : null;
      const row = makeRow(table,{ ...before,...values,employee_id:employeeId,...(editing ? { id:editing } : {}),...('updated_at' in ERD_SCHEMA[table] ? { updated_at:new Date().toISOString() }:{}) });
      transactDatabase(draft => { if (editing) draft[table] = draft[table].map(item => item.id === editing ? row : item); else draft[table].push(row); });
      recordAudit(table.toUpperCase(),row.id,editing ? 'Update employee history' : 'Add employee history',before,row);
      setValues({}); setEditing(null); setError('');
    } catch (cause) { setError((cause as Error).message); }
  };
  return <Card className="mt-5 p-5"><h2 className="font-bold text-slate-900">Hồ sơ liên quan</h2><div className="my-4 flex flex-wrap gap-2">{Object.entries(groups).map(([key,label]) => <Button key={key} size="sm" variant={key === table ? 'primary':'secondary'} onClick={() => { setTable(key as RelatedTable);setValues({});setEditing(null);setError(''); }}>{label}</Button>)}</div>
    <div className="space-y-3">{db[table].filter(row => row.employee_id === employeeId).map(row => <div key={row.id} className="rounded-xl border border-slate-200 p-4"><dl className="grid gap-3 sm:grid-cols-3">{fields.map(([field]) => <div key={field}><dt className="text-xs text-slate-500">{field}</dt><dd className="mt-1 text-sm text-slate-800">{String(row[field] ?? '—')}</dd></div>)}</dl>{editable && <Button variant="secondary" size="sm" className="mt-3" onClick={() => { setEditing(row.id);setValues(row); }}>Sửa bản ghi</Button>}</div>)}</div>
    {editable && <form className="mt-5 border-t border-slate-100 pt-5" onSubmit={event => { event.preventDefault(); save(); }}><h3 className="mb-4 text-sm font-semibold text-slate-800">{editing ? 'Cập nhật':'Thêm'} · {groups[table]}</h3><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{fields.map(([field,spec]) => {
      const column = spec as { type:string;required:boolean;references?:TableName };
      const control = 'mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm';
      return <label key={field} className="text-xs text-slate-600">{field}{column.required ? ' *':''}{column.references ? <select required={column.required} className={control} value={String(values[field] || '')} onChange={event => setValues({ ...values,[field]:event.target.value || null })}><option value="">Chọn tham chiếu</option>{db[column.references].filter(row => field !== 'manager_id' || row.id !== employeeId).map(row => <option key={row.id} value={row.id}>{String(row.name || row.full_name || row.id)}</option>)}</select> : <input required={column.required} className={control} type={column.type === 'date' ? 'date':['integer','numeric'].includes(column.type) ? 'number':'text'} step={column.type === 'integer' ? 1:'any'} value={String(values[field] ?? '')} onChange={event => setValues({ ...values,[field]:event.target.value === '' ? null : ['integer','numeric'].includes(column.type) ? Number(event.target.value):event.target.value })} />}</label>;
    })}</div>{error && <p role="alert" className="my-3 text-sm text-red-700">{error}</p>}<div className="mt-4 flex gap-3"><Button type="submit">Lưu bản ghi</Button>{editing && <Button type="button" variant="secondary" onClick={() => { setEditing(null);setValues({}); }}>Hủy sửa</Button>}</div></form>}
  </Card>;
}
