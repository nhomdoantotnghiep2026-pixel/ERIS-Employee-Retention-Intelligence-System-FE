import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { AUDIT_EVENT, readAudit } from '../workflows/audit';
import { useRole } from '../context/RoleContext';
import { downloadTextFile, toCsv } from '../utils/demoActions';
export default function WorkflowActivity() {
  const { user } = useRole();
  const [entries, setEntries] = useState(readAudit);
  const [search, setSearch] = useState('');
  useEffect(() => { const refresh = () => setEntries(readAudit()); window.addEventListener(AUDIT_EVENT, refresh); return () => window.removeEventListener(AUDIT_EVENT, refresh); }, []);
  const visible = entries.filter(entry => (user.role === 'System Administrator' || entry.user_id === user.email) && `${entry.action} ${entry.entity_type} ${entry.user_name}`.toLowerCase().includes(search.toLowerCase()));
  return <AppShell breadcrumb={['System', 'Activity']}><SectionHeader title="Nhật ký thao tác hệ thống" description="Ghi nhận thao tác thực hiện trong phiên demo: nhân viên, import, snapshot, model, dự đoán, tài khoản và kết quả giữ chân."><Button variant="secondary" onClick={() => downloadTextFile('audit-log.csv', toCsv(visible.map(({ old_value, new_value, ...entry }) => ({ ...entry, old_value: JSON.stringify(old_value), new_value: JSON.stringify(new_value) }))), 'text/csv;charset=utf-8')}>Xuất nhật ký</Button></SectionHeader>
    <Card className="overflow-x-auto p-5"><label className="block text-sm text-slate-600">Tìm thao tác / người dùng<input className="mb-5 mt-2 block w-full max-w-lg rounded-xl border border-slate-300 p-3" value={search} onChange={event => setSearch(event.target.value)} /></label>{!visible.length ? <p className="py-8 text-center text-sm text-slate-500">Chưa có thao tác phù hợp trong phiên này.</p> : <table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500">{['Thời gian', 'Người dùng', 'Thao tác', 'Đối tượng', 'Chi tiết'].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{visible.map(entry => <tr key={entry.id} className="border-b border-slate-100"><td className="p-3">{new Date(entry.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</td><td className="p-3">{entry.user_name}</td><td className="p-3">{entry.action}</td><td className="p-3">{entry.entity_type}</td><td className="p-3"><details><summary className="cursor-pointer text-orange-700">Xem thay đổi</summary><pre className="mt-2 max-w-sm overflow-auto rounded-xl bg-slate-50 p-3 text-xs">{JSON.stringify({ entity_id: entry.entity_id, old_value: entry.old_value, new_value: entry.new_value }, null, 2)}</pre></details></td></tr>)}</tbody></table>}</Card>
  </AppShell>;
}
