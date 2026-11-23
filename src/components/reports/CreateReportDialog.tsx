import { useEffect, useState, type FormEvent } from 'react';
import { Dialog } from 'radix-ui';
import { FilePlus2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { FilterMenu } from '../ui/filter-menu';
import { Input } from '../ui/input';
import type { CreateReportInput, ReportCategory } from '../../services/reportsCenter.ts';

const categories: ReportCategory[] = ['Overview', 'Department', 'Employee', 'Factors', 'AI Model'];

export function CreateReportDialog({
  open,
  language,
  owner,
  initial,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  language: 'vi' | 'en';
  owner: string;
  initial?: Partial<CreateReportInput> | null;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: CreateReportInput) => void;
}) {
  const tr = (vi: string, en: string) => language === 'vi' ? vi : en;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ReportCategory>('Overview');

  useEffect(() => {
    if (!open) return;
    setName(initial?.name || '');
    setDescription(initial?.description || '');
    setCategory(initial?.category || 'Overview');
  }, [open, initial]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !description.trim()) return;
    onCreate({ name, description, category, owner });
    onOpenChange(false);
  };

  const categoryLabel = (value: ReportCategory) => ({
    Overview: tr('Tổng quan', 'Overview'),
    Department: tr('Phòng ban', 'Department'),
    Employee: tr('Nhân viên', 'Employee'),
    Factors: tr('Yếu tố', 'Factors'),
    'AI Model': tr('Phân tích AI', 'AI analysis'),
  })[value];

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[90] bg-slate-950/45 backdrop-blur-[1px] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in" />
      <Dialog.Content onPointerDownOutside={event => { if (name.trim() || description.trim()) event.preventDefault(); }} className="fixed left-1/2 top-1/2 z-[91] w-[calc(100vw-32px)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white shadow-2xl outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out data-[state=open]:fade-in data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div><Dialog.Title className="text-lg font-semibold text-slate-950">{tr('Tạo báo cáo mới', 'Create a new report')}</Dialog.Title><Dialog.Description className="mt-1 text-sm leading-6 text-slate-600">{tr('Lưu một ảnh chụp báo cáo để HR xem lại và xuất dữ liệu khi cần.', 'Save a report snapshot for HR review and later export.')}</Dialog.Description></div>
          <Dialog.Close asChild><Button type="button" variant="ghost" size="icon" className="size-10" aria-label={tr('Đóng', 'Close')}><X aria-hidden="true" /></Button></Dialog.Close>
        </div>
        <form onSubmit={submit} className="space-y-4 px-5 py-5">
          <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-800">{tr('Tên báo cáo', 'Report name')}</span><Input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder={tr('Ví dụ: Tổng hợp rủi ro tháng 11', 'Example: November risk summary')} className="h-11" /></label>
          <div><span className="mb-2 block text-sm font-semibold text-slate-800">{tr('Loại báo cáo', 'Report category')}</span><FilterMenu label={tr('Chọn loại báo cáo', 'Choose report category')} value={category} onChange={value => setCategory(value as ReportCategory)} className="h-11 w-full" options={categories.map(value => ({ value, label: categoryLabel(value) }))} /></div>
          <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-800">{tr('Mô tả phạm vi', 'Scope description')}</span><Input value={description} onChange={event => setDescription(event.target.value)} placeholder={tr('Nêu dữ liệu và mục đích của báo cáo', 'Describe the report data and purpose')} className="h-11" /></label>
          <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">{tr('Báo cáo dùng dữ liệu demo trong phiên hiện tại. HR vẫn là người xem xét và quyết định cuối cùng.', 'This report uses current-session demo data. HR remains responsible for final review and decisions.')}</div>
          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end"><Dialog.Close asChild><Button type="button" variant="outline" className="h-11">{tr('Hủy', 'Cancel')}</Button></Dialog.Close><Button type="submit" disabled={!name.trim() || !description.trim()} className="h-11 bg-orange-600 text-white hover:bg-orange-700"><FilePlus2 aria-hidden="true" />{tr('Tạo báo cáo', 'Create report')}</Button></div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
