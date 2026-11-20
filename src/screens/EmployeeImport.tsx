import { useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, Download, FileCheck2, FileSpreadsheet, UploadCloud, X } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Card } from '../components/ui';
import { Button } from '../components/ui/button';
import { downloadEmployeeImportTemplate, importEmployees, getApiErrorMessage, type EmployeeImportResponse } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAutoDismissFeedback } from '../hooks/useAutoDismissState';

export default function EmployeeImport() {
  const { language } = useLanguage();
  const text = (vi: string, en: string) => language === 'vi' ? vi : en;
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(false);
  const { error, message, setError, setMessage } = useAutoDismissFeedback();
  const [result, setResult] = useState<EmployeeImportResponse | null>(null);

  async function downloadTemplate() {
    try {
      const blob = await downloadEmployeeImportTemplate()
      const url = URL.createObjectURL(blob), link = document.createElement('a')
      link.href = url; link.download = 'ERIS_Employee_Import_Template.xlsx'
      document.body.appendChild(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (cause) { setError(getApiErrorMessage(cause, text('Không tải được mẫu hồ sơ.', 'Could not download employee template.'))) }
  }
  function selectFile(nextFile: File | null) {
    setMessage('');
    setError('');
    setResult(null);
    if (!nextFile) {
      setFile(null);
      return;
    }
    if (!/\.xlsx$/i.test(nextFile.name)) {
      setFile(null);
      setError(text('Chỉ hỗ trợ tệp Excel định dạng .xlsx.', 'Only .xlsx Excel files are supported.'));
      return;
    }
    if (nextFile.size > 5 * 1024 * 1024) {
      setFile(null);
      setError(text('Tệp không được vượt quá 5 MB.', 'The file must not exceed 5 MB.'));
      return;
    }
    setFile(nextFile);
  }

  function dropFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    selectFile(event.dataTransfer.files?.[0] || null);
  }

  async function upload() {
    if (!file || pending) return;
    setPending(true);
    setMessage('');
    setError('');
    setResult(null);
    try {
      const response = await importEmployees(file);
      setResult(response);
      setMessage(text(
        `Đã xử lý ${response.total} dòng: tạo ${response.created}, lỗi ${response.failed}.`,
        `Processed ${response.total} rows: ${response.created} created, ${response.failed} failed.`,
      ));
    } catch (cause) {
      setError(getApiErrorMessage(cause, text(
        'Nhập nhân viên thất bại. Vui lòng kiểm tra tệp và thử lại.',
        'Employee import failed. Check the file and try again.',
      )));
    } finally {
      setPending(false);
    }
  }

  return <AppShell breadcrumb={['Workforce', 'Employee Directory', 'Import Employees']}>
    <section aria-labelledby="employee-import-title">
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">{text('Hồ sơ nhân viên', 'Employee profiles')}</p>
          <h1 id="employee-import-title" className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{text('Nhập nhân viên từ Excel', 'Import employees from Excel')}</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600">{text(
            'Kiểm tra tệp, xem kết quả theo từng dòng và theo dõi số hồ sơ được tạo.',
            'Validate the file, review row-level results, and track the profiles created.',
          )}</p>
        </div>
        <Button type="button" variant="outline" size="lg" className="h-11 rounded-md border-slate-300 bg-white px-4 text-slate-700 hover:bg-slate-50" onClick={() => navigate('/employees')}>
          <ArrowLeft />{text('Quay lại danh sách', 'Back to employee list')}
        </Button>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white p-4"><Button type="button" variant="outline" onClick={() => void downloadTemplate()}><Download size={16}/>{text('Tải tệp mẫu', 'Download template')}</Button><p className="text-sm text-slate-600">{text('Điền shift_type (ví dụ GENERAL) của ca ACTIVE đã có. Hệ thống tự tra ID ca. Không cần gán ca riêng sau import.', 'Include an existing ACTIVE shift_type (e.g. GENERAL). The server resolves its ID. No separate assignment is needed after import.')}</p></div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="p-5 sm:p-7">
          <div
            className={`flex min-h-[305px] flex-col items-center justify-center border border-dashed px-5 py-10 text-center transition-colors ${dragging ? 'border-orange-500 bg-orange-50' : 'border-slate-300 bg-slate-50/70'}`}
            onDragEnter={event => { event.preventDefault(); setDragging(true); }}
            onDragOver={event => event.preventDefault()}
            onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
            onDrop={dropFile}
          >
            <span className="flex size-14 items-center justify-center rounded-md bg-white text-orange-600 shadow-sm ring-1 ring-slate-200">
              <FileSpreadsheet size={28} strokeWidth={1.8}/>
            </span>
            <h2 className="mt-5 text-lg font-semibold text-slate-950">{text('Chọn tệp Excel .xlsx', 'Choose an .xlsx Excel file')}</h2>
            <p className="mt-2 text-sm font-medium text-slate-600">{text('Tối đa 5 MB và 200 dòng nhân viên.', 'Maximum 5 MB and 200 employee rows.')}</p>
            <p className="mt-1 text-sm text-slate-600">{text('Bạn cũng có thể kéo và thả tệp vào khu vực này.', 'You can also drag and drop a file into this area.')}</p>

            <input
              ref={fileInputRef}
              id="employee-file-upload"
              type="file"
              accept=".xlsx"
              className="sr-only"
              onChange={event => { selectFile(event.target.files?.[0] || null); event.currentTarget.value = ''; }}
            />
            <Button type="button" size="lg" className="mt-6 h-11 rounded-md !bg-orange-600 px-5 !text-white hover:!bg-orange-700" onClick={() => fileInputRef.current?.click()}>
              <UploadCloud />{text('Chọn tệp', 'Choose file')}
            </Button>
          </div>

          {file && <div className="mt-4 flex flex-col gap-4 rounded-md border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700"><FileCheck2 size={21}/></span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{file.name}</p>
                <p className="mt-0.5 text-sm font-medium text-slate-600">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="ghost" size="icon" className="rounded-md text-slate-600 hover:bg-slate-100" aria-label={text('Bỏ tệp đã chọn', 'Remove selected file')} onClick={() => selectFile(null)}><X/></Button>
              <Button type="button" size="lg" className="h-11 rounded-md !bg-orange-600 px-4 !text-white hover:!bg-orange-700" disabled={pending} onClick={() => void upload()}>
                <UploadCloud />{text(pending ? 'Đang tạo nhân viên...' : 'Tải lên và tạo nhân viên', pending ? 'Creating employees...' : 'Upload and create employees')}
              </Button>
            </div>
          </div>}

          {message && <p role="status" className="mt-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"><Check className="mt-0.5 shrink-0" size={17}/>{message}</p>}
          {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800"><AlertTriangle className="mt-0.5 shrink-0" size={17}/>{error}</p>}
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-950">{text('Định dạng tệp yêu cầu', 'Required file format')}</h2>
          <ul className="mt-5 space-y-4 text-sm font-medium leading-6 text-slate-600">
            {[
              text('Tệp Excel có đuôi .xlsx.', 'The Excel file must use the .xlsx format.'),
              text('Dung lượng tối đa 5 MB.', 'Maximum file size is 5 MB.'),
              text('Mỗi lần nhập tối đa 200 dòng nhân viên.', 'Each import supports up to 200 employee rows.'),
              text('Tên cột phải khớp chính xác với mẫu backend.', 'Column names must exactly match the backend template.'),
            ].map(item => <li key={item} className="flex gap-3"><Check className="mt-1 shrink-0 text-emerald-600" size={16}/><span>{item}</span></li>)}
          </ul>
        </Card>
      </div>

      {result && <Card className="mt-5 p-5 sm:p-6">
        <div><h2 className="text-lg font-semibold text-slate-950">{text('Kết quả nhập dữ liệu', 'Import results')}</h2><p className="mt-1 text-sm font-medium text-slate-600">{text('Kiểm tra trạng thái xử lý của từng dòng.', 'Review the processing status of every row.')}</p></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ResultMetric label={text('Tổng dòng', 'Total rows')} value={result.total} tone="text-slate-950"/>
          <ResultMetric label={text('Tạo thành công', 'Created')} value={result.created} tone="text-emerald-700"/>
          <ResultMetric label={text('Thất bại', 'Failed')} value={result.failed} tone="text-red-700"/>
        </div>
        <div className="mt-5 overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600"><tr><th className="p-3">{text('Dòng', 'Row')}</th><th className="p-3">{text('Trạng thái', 'Status')}</th><th className="p-3">{text('Chi tiết', 'Details')}</th></tr></thead>
            <tbody>{result.results.map(item => <tr key={item.row} className="border-t border-slate-100"><td className="p-3 font-medium text-slate-700">{item.row}</td><td className={`p-3 font-semibold ${item.status === 'CREATED' ? 'text-emerald-700' : 'text-red-700'}`}>{text(item.status === 'CREATED' ? 'Đã tạo' : 'Thất bại', item.status === 'CREATED' ? 'Created' : 'Failed')}</td><td className="p-3 text-slate-600">{item.message || (item.data?.email ? text(`Đã tạo tài khoản cho ${item.data.email}.`, `Account created for ${item.data.email}.`) : text('Đã xử lý thành công.', 'Processed successfully.'))}</td></tr>)}</tbody>
          </table>
        </div>
      </Card>}
    </section>
  </AppShell>;
}

function ResultMetric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="rounded-md border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-medium text-slate-600">{label}</p><p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p></div>;
}
