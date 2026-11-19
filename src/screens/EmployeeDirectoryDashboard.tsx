import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { EmployeeDirectoryOverview } from '../components/EmployeeDirectoryOverview';
import { useLanguage } from '../context/LanguageContext';
import { listDepartments, type ApiDepartment } from '../services/api';

export default function EmployeeDirectoryDashboard() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  const [catalogUnavailable, setCatalogUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void listDepartments(controller.signal, { limit: Number.MAX_SAFE_INTEGER })
      .then(result => { if (!controller.signal.aborted) setDepartments(result.data); })
      .catch(() => { if (!controller.signal.aborted) setCatalogUnavailable(true); });
    return () => controller.abort();
  }, []);

  return (
    <AppShell quiet breadcrumb={['Workforce', 'Employees']}>
      <nav aria-label={language === 'vi' ? 'Điều hướng trang' : 'Breadcrumb'} className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <Link to="/employees" className="rounded-md hover:text-slate-900 hover:underline">{language === 'vi' ? 'Nhân viên' : 'Employees'}</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span aria-current="page" className="font-medium text-slate-900">{language === 'vi' ? 'Tổng quan nhân sự' : 'Workforce overview'}</span>
      </nav>
      {catalogUnavailable && <p role="status" className="mb-4 text-sm text-slate-600">
        {language === 'vi' ? 'Chưa tải được tên phòng ban. Biểu đồ hiển thị mã phòng ban.' : 'Department names are unavailable. The chart displays department IDs.'}
      </p>}
      <EmployeeDirectoryOverview revision={0} departments={departments} onDepartment={(department, status, query) => {
        const filters = new URLSearchParams({ department: String(department), status });
        if (query) filters.set('q', query);
        navigate('/employees?' + filters);
      }} />
    </AppShell>
  );
}
