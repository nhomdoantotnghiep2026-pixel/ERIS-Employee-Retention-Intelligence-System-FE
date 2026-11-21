import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, Download, Eye, FileCheck2, FileSpreadsheet, UploadCloud, X } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Card } from '../components/ui';
import { Button } from '../components/ui/button';
import { importEmployees, previewEmployeeImport, getApiErrorMessage, type ImportInstitutionChoice, type EmployeeImportPreview, type EmployeeImportResponse } from '../services/api';
import EmployeeImportPreviewCard from '../components/EmployeeImportPreviewCard';
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState<EmployeeImportPreview | null>(null);
  const [institutionChoices, setInstitutionChoices] = useState<ImportInstitutionChoice[]>([]);
  const unresolved = preview?.results.some(row => row.institutions?.some(school => school.status === 'NEEDS_SELECTION' && !institutionChoices.some(choice => choice.row === row.row && choice.educationIndex === school.educationIndex))) ?? false;
  const [result, setResult] = useState<EmployeeImportResponse | null>(null);

  function selectFile(nextFile: File | null) {
    if (pending) return;
    setMessage('');
    setError('');
    setResult(null);
    setPreview(null);
    setInstitutionChoices([]);
    setPreviewOpen(false);
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

  async function showPreview() {
    if (!file || pending || result) return;
    setPending('preview');
    setInstitutionChoices([]);
    setError('');
    setPreview(null);
    try {
      setPreview(await previewEmployeeImport(file));
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
      setPreviewOpen(true);
    }
  }

  async function upload() {
    if (!file || pending || !(preview && (preview.valid || preview.pending)) || unresolved || result) return;
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
              disabled={Boolean(pending)}
              className="sr-only"
              onChange={event => { selectFile(event.target.files?.[0] || null); event.currentTarget.value = ''; }}
            />
            <Button type="button" size="lg" className="mt-6 h-11 rounded-md !bg-orange-600 px-5 !text-white hover:!bg-orange-700" disabled={Boolean(pending)} onClick={() => fileInputRef.current?.click()}>
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
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" size="icon" className="rounded-md text-slate-600 hover:bg-slate-100" aria-label={text('Bỏ tệp đã chọn', 'Remove selected file')} disabled={Boolean(pending)} onClick={() => selectFile(null)}><X/></Button>
              {!result && <Button type="button" size="lg" variant="outline" className="h-11 rounded-md" disabled={Boolean(pending)} onClick={() => void showPreview()}>
                <Eye />{pending === 'preview' ? text('Đang kiểm tra...', 'Checking...') : text('Xem trước', 'Preview')}
              </Button>}
              {Boolean(preview && (preview.valid || preview.pending)) && <Button type="button" size="lg" className="h-11 rounded-md !bg-orange-600 px-4 !text-white hover:!bg-orange-700" disabled={Boolean(pending) || unresolved} onClick={() => void upload()}>
                <UploadCloud />{pending === 'upload' ? text('Đang tạo nhân viên...', 'Creating employees...') : text('Tải lên và tạo nhân viên', 'Upload and create employees')}
              </Button>}
            </div>
          </div>}

          {message && <p role="status" className="mt-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"><Check className="mt-0.5 shrink-0" size={17}/>{message}</p>}
          {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800"><AlertTriangle className="mt-0.5 shrink-0" size={17}/>{error}</p>}
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

      {preview && <Card className="mt-5 flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <p role="status" className="text-sm font-medium text-slate-700">{preview.fileIssues?.length
          ? text('Chưa thể hoàn tất kiểm tra tệp.', 'Workbook validation could not finish.')
          : text(`${preview.total - preview.failed} dòng qua kiểm tra cấu trúc, ${preview.failed} dòng có lỗi.${unresolved ? " Cần chọn trường trước khi nhập." : ""}`, `${preview.valid} valid rows, ${preview.failed} failed rows.`)}</p>
        <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
          <Eye />{text('Xem chi tiết kiểm tra', 'View validation details')}
        </Button>
      </Card>}
      <ImportPreviewDialog preview={preview} open={previewOpen} choices={institutionChoices} onChoose={(choice) => setInstitutionChoices(current => [...current.filter(item => item.row !== choice.row || item.educationIndex !== choice.educationIndex), choice])} onClose={() => setPreviewOpen(false)} text={text} />

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
            <tbody>{result.results.map(item => <tr key={item.row} className="border-t border-slate-100"><td className="p-3 font-medium text-slate-700">{item.row}</td><td className={`p-3 font-semibold ${item.status === 'CREATED' ? 'text-emerald-700' : 'text-red-700'}`}>{text(item.status === 'CREATED' ? 'Đã tạo' : 'Thất bại', item.status === 'CREATED' ? 'Created' : 'Failed')}</td><td className="p-3 text-slate-600">{item.message || (item.data?.email ? text(`Đã tạo tài khoản cho ${item.data.email}.`, `Account created for ${item.data.email}.`) : text('Đã xử lý thành công.', 'Processed successfully.'))}{item.warnings?.map((warning,index) => <p key={index} className="mt-1 text-amber-800">{warning}</p>)}</td></tr>)}</tbody>
          </table>
        </div>
      </Card>}
    </section>
  </AppShell>;
}

function ImportPreviewDialog({ preview, open, onClose, text, choices, onChoose }: {
  preview: EmployeeImportPreview | null;
  choices: ImportInstitutionChoice[];
  onChoose: (choice: ImportInstitutionChoice) => void;
  open: boolean;
  onClose: () => void;
  text: (vi: string, en: string) => string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return <dialog ref={dialog} onClose={onClose} aria-labelledby="employee-import-preview-title"
    className="m-auto max-h-[80vh] w-[calc(100%-2rem)] max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/55">
    <div className="flex max-h-[80vh] flex-col">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 p-4 sm:p-6">
        <div>
          <h2 id="employee-import-preview-title" className="text-lg font-semibold">{text('Chi tiết kiểm tra Excel','Excel validation details')}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{text(
            `Đã đọc ${preview?.total ?? 0} dòng nhân sự. Xem hồ sơ, lỗi dữ liệu và đối chiếu bằng cấp bên dưới.`,
            `Read ${preview?.total ?? 0} employee rows. Review profiles, data errors and education matches below.`)}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" autoFocus onClick={() => dialog.current?.close()}
          aria-label={text('Đóng chi tiết kiểm tra','Close validation details')}><X/></Button>
      </header>
      <div tabIndex={0} role="region" aria-label={text('Danh sách hồ sơ xem trước','Employee preview list')}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 motion-safe:scroll-smooth focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-orange-500 sm:p-6">
        {!!preview?.fileIssues?.length && <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <h3 className="font-semibold">{text('Cần kiểm tra cấu trúc tệp','Review workbook structure')}</h3>
          {preview.fileIssues.map((issue,index) => <p key={index} className="break-words">{[issue.sheet,issue.cell || issue.field].filter(Boolean).join(' · ')}{issue.sheet || issue.cell || issue.field ? ': ' : ''}{issue.message}</p>)}
        </div>}
        {preview?.results.map(row => <EmployeeImportPreviewCard key={row.row} row={row} choices={choices} onChoose={onChoose} text={text}/>)}
        {!preview?.results.length && !preview?.fileIssues?.length && <p className="text-sm text-slate-600">{text('Chưa có dòng nhân sự để hiển thị.','No employee rows to display.')}</p>}
      </div>
      <footer className="flex shrink-0 justify-end border-t border-slate-100 px-4 py-3 sm:px-6">
        <Button type="button" variant="outline" onClick={() => dialog.current?.close()}>{text('Đóng','Close')}</Button>
      </footer>
    </div>
  </dialog>;
}

function ResultMetric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="rounded-md border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-medium text-slate-600">{label}</p><p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p></div>;
}
