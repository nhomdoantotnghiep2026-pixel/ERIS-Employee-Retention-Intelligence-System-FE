import { AppShell } from '../components/AppShell';
import { Card, SectionHeader } from '../components/ui';
import { ERD_SCHEMA, type TableName } from '../erd/schema';
import { useErd } from '../erd/useErd';
export default function ErdSchema() {
  const db = useErd();
  return <AppShell breadcrumb={['Data Management','Schema']}><SectionHeader title="Cấu trúc dữ liệu theo ERD" /><div className="grid gap-5 xl:grid-cols-2">{(Object.entries(ERD_SCHEMA) as [TableName,Record<string,{ type:string;required:boolean;references?:string }>][]).map(([table,columns]) => <Card key={table} className="overflow-x-auto p-5"><h2 className="font-mono font-bold text-slate-900">{table.toUpperCase()}</h2><p className="my-2 text-xs text-slate-500">{db[table].length} bản ghi local</p><table className="w-full text-left text-xs"><thead><tr className="border-b text-slate-500"><th className="p-2">Trường</th><th>Kiểu</th><th>Liên kết</th></tr></thead><tbody>{Object.entries(columns).map(([field,spec]) => <tr key={field} className="border-b border-slate-100"><td className="p-2 font-mono">{field}{spec.required ? ' *':''}</td><td>{spec.type}</td><td>{field === 'id' ? 'PK':spec.references ? `FK → ${spec.references}.id`:'—'}</td></tr>)}</tbody></table></Card>)}</div></AppShell>;
}
