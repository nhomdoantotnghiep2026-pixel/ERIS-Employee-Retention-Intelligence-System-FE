import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, Download, Eye, FileCheck2, FileSpreadsheet, UploadCloud, X } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Card } from '../components/ui';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { downloadEmployeeImportTemplate, importEmployees, previewEmployeeImport, searchEducationInstitutions, getApiErrorMessage, type EducationInstitution, type EmployeeImportIssue, type EmployeeImportPreview, type EmployeeImportResponse } from '../services/api';
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
    if (pending) return;
    setMessage('');
    setError('');
    setResult(null);
    setPreview(null);
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
    if (!file || pending || !preview?.valid || result) return;
    setPending('upload');
    setMessage('');
    setError('');
    setResult(null);
    try {
      const response = await importEmployees(file);
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
              {Boolean(preview?.valid) && <Button type="button" size="lg" className="h-11 rounded-md !bg-orange-600 px-4 !text-white hover:!bg-orange-700" disabled={Boolean(pending)} onClick={() => void upload()}>
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
              text('Nếu chức danh có nhiều cấp, chọn tên cấp trong cột job_level, ví dụ Junior hoặc Senior.', 'If the position has multiple levels, select a name in the job_level column, such as Junior or Senior.'),
              text('Học vấn bắt buộc. Mẫu 1 sheet điền một mảng JSON trong cột educations. Mẫu 2 sheet điền từng bằng cấp trong tab Educations, dùng email trùng với tab Employees.', 'Education is required. In the single-sheet template, enter a JSON array in educations. In the two-sheet template, enter each qualification in Educations using the same email as in Employees.'),
              text('Thay dữ liệu minh họa và giữ nguyên tên sheet, tên cột. Xem ghi chú trên tiêu đề để biết định dạng.', 'Replace the sample data and keep the sheet names and headers. See the header notes for accepted formats.'),
            ].map(item => <li key={item} className="flex gap-3"><Check className="mt-1 shrink-0 text-emerald-600" size={16}/><span>{item}</span></li>)}
          </ul>
          <InstitutionLookup text={text} />
        </Card>
      </div>

      {preview && <Card className="mt-5 flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <p role="status" className="text-sm font-medium text-slate-700">{preview.fileIssues?.length
          ? text('Chưa thể hoàn tất kiểm tra tệp.', 'Workbook validation could not finish.')
          : text(`${preview.valid} dòng hợp lệ, ${preview.failed} dòng có lỗi.`, `${preview.valid} valid rows, ${preview.failed} failed rows.`)}</p>
        <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
          <Eye />{text('Xem chi tiết kiểm tra', 'View validation details')}
        </Button>
      </Card>}
      <ImportPreviewDialog preview={preview} open={previewOpen} onClose={() => setPreviewOpen(false)} text={text} />

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

function ImportPreviewDialog({ preview, open, onClose, text }: {
  preview: EmployeeImportPreview | null;
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

  const issues: EmployeeImportIssue[] = [
    ...(preview?.fileIssues ?? []),
    ...(preview?.results.filter(row => row.status === 'FAILED').map(row =>
      row.issue ?? { row: row.row, message: row.message ?? text('Kiểm tra dữ liệu dòng này.', 'Review this row.') }) ?? []),
  ];

  return <dialog ref={dialog} onClose={onClose} aria-labelledby="employee-import-preview-title"
    className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/55">
    <div className="space-y-4 p-4 sm:p-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 id="employee-import-preview-title" className="text-lg font-semibold">{text('Chi tiết kiểm tra Excel', 'Excel validation details')}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{preview?.fileIssues?.length
            ? text('Xem chi tiết bên dưới trước khi kiểm tra lại.', 'Review the details below before checking again.')
            : text(`Đã kiểm tra ${preview?.total ?? 0} dòng. ${preview?.valid ?? 0} hợp lệ, ${preview?.failed ?? 0} có lỗi.`,
              `Checked ${preview?.total ?? 0} rows. ${preview?.valid ?? 0} valid and ${preview?.failed ?? 0} failed.`)}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" autoFocus onClick={() => dialog.current?.close()}
          aria-label={text('Đóng chi tiết kiểm tra', 'Close validation details')}><X /></Button>
      </header>
      {issues.length > 0 ? <div tabIndex={0} role="region" aria-label={text('Bảng chi tiết lỗi', 'Issue details table')}
        className="overflow-x-auto rounded-md border border-slate-200 focus-visible:outline-2 focus-visible:outline-orange-500">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-700"><tr>
            <th scope="col" className="p-3">{text('Sheet', 'Sheet')}</th>
            <th scope="col" className="p-3">{text('Dòng', 'Row')}</th>
            <th scope="col" className="p-3">{text('Cột / Ô', 'Column / Cell')}</th>
            <th scope="col" className="p-3">{text('Trường', 'Field')}</th>
            <th scope="col" className="p-3">{text('Lỗi và cách xử lý', 'Issue and how to fix it')}</th>
          </tr></thead>
          <tbody>{issues.map((issue, index) => <tr key={index} className="border-t border-slate-100 align-top">
            <td className="whitespace-nowrap p-3">{issue.sheet || (issue.row ? '—' : text('Cả tệp', 'Workbook'))}</td>
            <td className="p-3">{issue.row ?? '—'}</td>
            <td className="whitespace-nowrap p-3 font-semibold">{issue.cell || issue.column || '—'}</td>
            <td className="p-3 font-mono text-xs">{issue.field || '—'}</td>
            <td className="min-w-56 break-words p-3 leading-6 text-red-800">{issue.message}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{text('Tất cả dòng đã qua bước kiểm tra. Trường học và khoảng cách được xác minh khi nhập.', 'All rows passed this check. School verification and commute calculation run during import.')}</p>}
    </div>
  </dialog>;
}

function InstitutionLookup({ text }: { text: (vi: string, en: string) => string }) {
  const [name, setName] = useState('');
  const [schools, setSchools] = useState<EducationInstitution[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (searching || name.trim().length < 2) return;
    setSearching(true);
    setError('');
    setSchools(null);
    try {
      const response = await searchEducationInstitutions(name.trim());
      setSchools(response.data);
    } catch (cause) {
      setError(getApiErrorMessage(cause, text('Không tìm được trường. Vui lòng thử lại.', 'Could not search institutions. Try again.')));
    } finally {
      setSearching(false);
    }
  }

  return <div className="mt-5 border-t border-slate-200 pt-4">
    <form onSubmit={search}>
      <label htmlFor="employee-import-institution" className="text-sm font-semibold text-slate-900">
        {text('Tra cứu mã trường', 'Find institution IDs')}
      </label>
      <div className="mt-2 flex gap-2">
        <Input id="employee-import-institution" value={name} required minLength={2} maxLength={100}
          disabled={searching} placeholder={text('Nhập tên trường', 'Enter institution name')}
          onChange={event => { setName(event.target.value); setSchools(null); setError(''); }} />
        <Button type="submit" variant="outline" disabled={searching || name.trim().length < 2}>
          {searching ? text('Đang tìm...', 'Searching...') : text('Tìm', 'Search')}
        </Button>
      </div>
    </form>
    {error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
    {schools && (schools.length ? <>
      <p role="status" className="mt-2 text-sm text-slate-600">{text('Chép tên và mã của cùng một kết quả vào institution và institutionRefId.', 'Copy the name and ID from the same result into institution and institutionRefId.')}</p>
      <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto" aria-label={text('Kết quả tìm trường', 'Institution search results')}>
        {schools.map(school => <li key={school.id} className="rounded-md bg-slate-50 p-2 text-sm">
          <p className="font-semibold text-slate-900">{school.institution}</p>
          <p className="break-all text-slate-600">{school.id}</p>
        </li>)}
      </ul>
    </> : <p role="status" className="mt-2 text-sm text-slate-600">{text('Không tìm thấy trường.', 'No institutions found.')}</p>)}
  </div>;
}

function ResultMetric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="rounded-md border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-medium text-slate-600">{label}</p><p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p></div>;
}
