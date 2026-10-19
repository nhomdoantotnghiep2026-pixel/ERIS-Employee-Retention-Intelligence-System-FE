import { useLanguage } from '../context/LanguageContext';
import { AppShell } from '../components/AppShell';
import { Card, SectionHeader } from '../components/ui';
import { ErdEmployeeRelations } from '../components/ErdEmployeeRelations';
import { useErd } from '../erd/useErd';
import { useRole } from '../context/RoleContext';
export default function ErdOwnProfile() {
  const { t } = useLanguage();
  const db = useErd();
  const { user } = useRole();
  const account = db.users.find(row => row.email === user.email);
  const employee = db.employees.find(row => row.id === account?.employee_id);
  return <AppShell breadcrumb={['My Workspace','My Profile']}><SectionHeader title={t("Hồ sơ cá nhân")} description={t("Hồ sơ được xác định qua liên kết tài khoản với nhân viên; không chọn theo tên hoặc lấy nhân viên đầu tiên.")} />{!employee ? <Card className="p-6">{t("Tài khoản chưa liên kết hồ sơ nhân viên. Liên hệ quản trị viên.")}</Card> : <><Card className="p-6"><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(employee).map(([field,value]) => <div key={field}><dt className="text-xs text-slate-500">{t(field)}</dt><dd className="mt-2 break-words text-sm text-slate-800">{t(field === 'department_id' ? String(db.departments.find(row => row.id === value)?.name || '—') : field === 'position_id' ? String(db.positions.find(row => row.id === value)?.name || '—') : String(value ?? '—'))}</dd></div>)}</dl></Card><ErdEmployeeRelations employeeId={employee.id} editable={false} /></>}</AppShell>;
}
