import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Button, Card, SectionHeader } from '../components/ui';
import { importEmployees, getApiErrorMessage, type EmployeeImportResponse } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

const REQUIRED_HEADERS = 'fullName,email,phone,dateOfBirth,gender,address,departmentId,positionId,hireDate,employmentType,currentSalary';

export default function EmployeeImport() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<EmployeeImportResponse | null>(null);

  function selectFile(nextFile: File | null) {
    setMessage(''); setError(''); setResult(null);
    if (!nextFile) { setFile(null); return; }
    if (!/\.xlsx$/i.test(nextFile.name)) {
      setFile(null); setError('Chỉ hỗ trợ file Excel định dạng .xlsx.'); return;
    }
    if (nextFile.size > 5 * 1024 * 1024) {
      setFile(null); setError('File không được vượt quá 5 MB.'); return;
    }
    setFile(nextFile);
  }

  async function upload() {
    if (!file || pending) return;
    setPending(true); setMessage(''); setError(''); setResult(null);
    try {
      const response = await importEmployees(file);
      setResult(response);
      setMessage(`Đã xử lý ${response.total} dòng: tạo ${response.created}, lỗi ${response.failed}.`);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Import nhân viên thất bại. Vui lòng kiểm tra file và thử lại.'));
    } finally { setPending(false); }
  }

  return <AppShell breadcrumb={['Workforce', 'Import Employees']}>
    <SectionHeader title="Import nhân viên" description="Tải file Excel để tạo hồ sơ và tài khoản nhân viên qua Backend.">
      <Button variant="secondary" onClick={() => navigate('/employees')}>{t("Danh sách nhân viên")}</Button>
    </SectionHeader>
    <Card className="p-6">
      <h2 className="font-bold text-slate-900">{t("Chọn file Excel")}</h2>
      <p className="mt-2 text-sm text-slate-500">{t("Chọn file .xlsx, tối đa 5 MB và 200 dòng dữ liệu.")}</p>
      <p className="mt-2 break-all text-xs text-slate-500">{t("Tên cột bắt buộc:")}{REQUIRED_HEADERS}</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label htmlFor="employee-file-upload" className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-orange-500">{t("Chọn file Excel")}</label>
        <input id="employee-file-upload" type="file" accept=".xlsx" className="sr-only" onChange={event => selectFile(event.target.files?.[0] || null)} />
        <span className="max-w-full truncate text-sm text-slate-600">{file ? file.name : t('Chưa chọn file')}</span>
        <Button disabled={!file || pending} onClick={() => void upload()}>{t(pending ? 'Đang tạo nhân viên...' : 'Tải lên và tạo nhân viên')}</Button>
      </div>
      {message && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{t(message)}</p>}
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{t(error)}</p>}
      {result && <>
        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4">{t("Tổng dòng:")}<b>{result.total}</b></div><div className="rounded-xl bg-emerald-50 p-4">{t("Tạo thành công:")}<b>{result.created}</b></div><div className="rounded-xl bg-red-50 p-4">{t("Thất bại:")}<b>{result.failed}</b></div></div>
        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[520px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">{t("Dòng")}</th><th className="p-3">{t("Trạng thái")}</th><th className="p-3">{t("Chi tiết")}</th></tr></thead><tbody>{result.results.map(item => <tr key={item.row} className="border-t border-slate-100"><td className="p-3">{item.row}</td><td className={`p-3 font-semibold ${item.status === 'CREATED' ? 'text-emerald-700' : 'text-red-700'}`}>{t(item.status === 'CREATED' ? 'Đã tạo' : 'Thất bại')}</td><td className="p-3 text-slate-600">{item.message || (item.data?.email ? t('Account created for {email}.', { email: item.data.email }) : t('Đã xử lý thành công.'))}</td></tr>)}</tbody></table></div>
      </>}
    </Card>
  </AppShell>;
}
