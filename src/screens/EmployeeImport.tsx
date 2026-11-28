import { useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, Download, FileSpreadsheet, UploadCloud } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Card } from '../components/ui';
import { Button } from '../components/ui/button';
import { importEmployees, previewEmployeeImport, getApiErrorMessage, type ImportInstitutionChoice, type EmployeeImportPreview, type EmployeeImportResponse } from '../services/api';
import { EmployeeImportGrid, summarizeImport } from '../components/EmployeeImportGrid';
import { useLanguage } from '../context/LanguageContext';

export default function EmployeeImport() {
  const { language } = useLanguage();
  const text = (vi: string, en: string) => language === 'vi' ? vi : en;
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<'preview' | 'upload' | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<EmployeeImportPreview | null>(null);
  const [institutionChoices, setInstitutionChoices] = useState<ImportInstitutionChoice[]>([]);
  const [result, setResult] = useState<EmployeeImportResponse | null>(null);
  const summary = summarizeImport(preview, institutionChoices);
  const step = result ? 3 : pending === 'upload' ? 2 : file ? 1 : 0;

  function selectFile(nextFile: File | null) {
    if (pending) return;
    setMessage('');
    setError('');
    setResult(null);
    setPreview(null);
    setInstitutionChoices([]);
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
    void showPreview(nextFile);
  }

  function dropFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    selectFile(event.dataTransfer.files?.[0] || null);
  }

  async function showPreview(nextFile: File) {
    setPending('preview');
    setInstitutionChoices([]);
    setError('');
    setPreview(null);
    try {
      setPreview(await previewEmployeeImport(nextFile));
    } catch (cause) {
      const message = getApiErrorMessage(cause, text('Không thể xem trước tệp Excel.', 'Could not preview the Excel file.'));
      setPreview({ total: 0, valid: 0, failed: 0, results: [], fileIssues: [{
        message: message === 'Invalid or unreadable Excel workbook.' ? text(
          'Không thể mở cấu trúc tệp. Mở tệp trong Excel, chọn Lưu dưới dạng → Excel Workbook (.xlsx), rồi chọn lại bản mới.',
          'The workbook structure could not be opened. In Excel, use Save As → Excel Workbook (.xlsx), then select the new copy.',
        ) : message,
      }] });
    } finally {
      setPending(null);
    }
  }

  async function upload() {
    if (!file || pending || !summary.ready || summary.unresolved || preview?.fileIssues?.length || result) return;
    setPending('upload');
    setMessage('');
    setError('');
    setResult(null);
    try {
      const response = await importEmployees(file, institutionChoices);
      setResult(response);
      setPreview(null);
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
      setPending(null);
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

      <input
        ref={fileInputRef}
        id="employee-file-upload"
        type="file"
        accept=".xlsx"
        disabled={Boolean(pending)}
        className="sr-only"
        onChange={event => { selectFile(event.target.files?.[0] || null); event.currentTarget.value = ''; }}
      />

      <ol aria-label={text('Tiến trình nhập nhân viên', 'Employee import progress')} className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[text('Chọn tệp Excel', 'Choose Excel file'), text('Xem trước & đối soát', 'Preview and validate'), text('Xác nhận tạo hồ sơ', 'Confirm creation'), text('Hoàn tất & xem danh sách', 'Finish and view employees')].map((label, index) =>
          <li key={label} aria-current={step === index ? 'step' : undefined} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold sm:text-sm ${step === index ? 'border-orange-200 bg-orange-50 text-orange-800' : 'border-slate-200 bg-white text-slate-700'}`}>
            <span className={`grid size-6 shrink-0 place-items-center rounded-full ${index < step ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100'}`}>{index < step ? <Check size={14} aria-hidden="true"/> : index + 1}</span>{label}
          </li>)}
      </ol>
      {error && <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertTriangle size={17} className="mt-0.5 shrink-0"/>{error}</p>}
      {!file && (
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

            <Button type="button" size="lg" className="mt-6 h-11 rounded-md !bg-orange-600 px-5 !text-white hover:!bg-orange-700" disabled={Boolean(pending)} onClick={() => fileInputRef.current?.click()}>
              <UploadCloud />{text('Chọn tệp', 'Choose file')}
            </Button>
          </div>

        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-950">{text('Mẫu nhập nhân viên', 'Employee import template')}</h2>
          <div className="mt-4 grid gap-2">
            <Button asChild variant="outline" className="h-auto min-h-9 justify-start whitespace-normal rounded-md py-2 text-left">
              <a href={import.meta.env.BASE_URL + 'employee-import-template-one-sheet.xlsx'} download><Download />{text('Tải mẫu 1 sheet có cột educations', 'Download single-sheet template with educations')}</a>
            </Button>
            <Button asChild variant="outline" className="h-auto min-h-9 justify-start whitespace-normal rounded-md py-2 text-left">
              <a href={import.meta.env.BASE_URL + 'employee-import-template.xlsx'} download><Download />{text('Tải mẫu 2 sheet có tab Educations', 'Download two-sheet template with Educations tab')}</a>
            </Button>
          </div>
          <ul className="mt-5 space-y-4 text-sm font-medium leading-6 text-slate-600">
            {[
              text('Tệp Excel có đuôi .xlsx.', 'The Excel file must use the .xlsx format.'),
              text('Dung lượng tối đa 5 MB.', 'Maximum file size is 5 MB.'),
              text('Mỗi lần nhập tối đa 200 dòng nhân viên.', 'Each import supports up to 200 employee rows.'),
              text('Employees: nhập mã nhân viên bắt buộc ở cột đầu tiên (employee_code), rồi điền tên phòng ban và chức danh theo danh mục.', 'Employees: enter the required employee code in the first column (employee_code), then enter the department and position names as listed in ERIS.'),
            ].map(item => <li key={item} className="flex gap-3"><Check className="mt-1 shrink-0 text-emerald-600" size={16}/><span>{item}</span></li>)}
          </ul>
        </Card>
      </div>
      )}
      {file && <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          <FileSpreadsheet size={20} className="shrink-0 text-emerald-700" aria-hidden="true"/>
          <strong className="min-w-0 [overflow-wrap:anywhere]">{file.name}</strong>
          <span className="text-xs text-slate-600">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
          {(preview || result) && <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-700">{text(`Đã đọc ${(preview ?? result)?.total} dòng`, `Read ${(preview ?? result)?.total} rows`)}</span>}
        </div>
        <Button type="button" variant="outline" disabled={Boolean(pending)} onClick={() => fileInputRef.current?.click()}>{text('Đổi tệp khác', 'Choose another file')}</Button>
      </div>}
      {pending === 'preview' && <p role="status" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">{text('Đang đọc và kiểm tra tệp Excel…', 'Reading and validating the Excel file…')}</p>}
      {preview && <EmployeeImportGrid preview={preview} choices={institutionChoices} summary={summary} uploading={pending === 'upload'} text={text}
        onChangeFile={() => fileInputRef.current?.click()} onUpload={() => void upload()}
        onChoose={choice => setInstitutionChoices(current => [...current.filter(item => item.row !== choice.row || item.educationIndex !== choice.educationIndex), choice])} />}

      {result && <Card className="mt-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-950">{text('Kết quả nhập dữ liệu', 'Import results')}</h2><Button type="button" variant="outline" onClick={() => navigate('/employees')}>{text('Xem danh sách nhân viên', 'View employee list')}</Button></div>
        {message && <p role="status" className="mt-3 text-sm text-slate-700">{message}</p>}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ResultMetric label={text('Tổng dòng', 'Total rows')} value={result.total} tone="text-slate-950"/>
          <ResultMetric label={text('Tạo thành công', 'Created')} value={result.created} tone="text-emerald-700"/>
          <ResultMetric label={text('Thất bại', 'Failed')} value={result.failed} tone="text-red-700"/>
        </div>
        <div className="mt-5 overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600"><tr><th className="p-3">{text('Dòng', 'Row')}</th><th className="p-3">{text('Trạng thái', 'Status')}</th><th className="p-3">{text('Chi tiết', 'Details')}</th></tr></thead>
            <tbody>{result.results.map(item => <tr key={item.row} className="border-t border-slate-100"><td className="p-3 font-medium text-slate-700">{item.row}</td><td className={`p-3 font-semibold ${item.status === 'CREATED' ? 'text-emerald-700' : 'text-red-700'}`}>{text(item.status === 'CREATED' ? 'Đã tạo' : 'Thất bại', item.status === 'CREATED' ? 'Created' : 'Failed')}</td><td className="p-3 text-slate-600">{item.message || (item.data?.email ? text(`Đã lưu hồ sơ cho ${item.data.email}.`, `Profile saved for ${item.data.email}.`) : text('Đã xử lý thành công.', 'Processed successfully.'))}{item.warnings?.map((warning,index) => <p key={index} className="mt-1 text-amber-800">{warning}</p>)}</td></tr>)}</tbody>
          </table>
        </div>
      </Card>}
    </section>
  </AppShell>;
}

function ResultMetric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="rounded-md border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-medium text-slate-600">{label}</p><p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p></div>;
}
