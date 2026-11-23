import { useDeferredValue, useEffect, useMemo, useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  BellRing,
  BrainCircuit,
  CheckCheck,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Inbox,
  KeyRound,
  MailOpen,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { FilterMenu } from '../components/ui/filter-menu';
import { Input } from '../components/ui/input';
import { useLanguage } from '../context/LanguageContext';
import { useRole } from '../context/RoleContext';
import { useWorkInbox } from '../hooks/useWorkInbox';
import type {
  WorkNotification,
  WorkNotificationCategory,
  WorkNotificationPriority,
} from '../services/workInbox';

type StatusFilter = 'active' | 'unread' | 'read' | 'archived';

const categoryIcons: Record<WorkNotificationCategory, ComponentType<{ className?: string; size?: number }>> = {
  retention: BrainCircuit,
  survey: ClipboardCheck,
  attendance: Clock3,
  request: UserCheck,
  access: KeyRound,
  system: ShieldCheck,
};

const categoryTone: Record<WorkNotificationCategory, string> = {
  retention: 'border-violet-100 bg-violet-50 text-violet-700',
  survey: 'border-blue-100 bg-blue-50 text-blue-700',
  attendance: 'border-cyan-100 bg-cyan-50 text-cyan-700',
  request: 'border-amber-100 bg-amber-50 text-amber-800',
  access: 'border-orange-100 bg-orange-50 text-orange-700',
  system: 'border-slate-200 bg-slate-100 text-slate-700',
};

const priorityTone: Record<WorkNotificationPriority, string> = {
  high: 'border-red-200 bg-red-50 text-red-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-800',
  low: 'border-slate-200 bg-slate-50 text-slate-700',
};

function relativeTime(value: string, language: 'vi' | 'en') {
  const difference = new Date(value).getTime() - Date.now();
  const minutes = Math.round(difference / 60_000);
  const formatter = new Intl.RelativeTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { numeric: 'auto' });
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
  return formatter.format(Math.round(hours / 24), 'day');
}

export default function WorkInbox() {
  const { user } = useRole();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { items, stats, markRead, markAllRead, archive, reset } = useWorkInbox(user.role, user.email);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase(language === 'vi' ? 'vi-VN' : 'en-US'));
  const [status, setStatus] = useState<StatusFilter>('active');
  const [category, setCategory] = useState<WorkNotificationCategory | 'all'>('all');
  const [priority, setPriority] = useState<WorkNotificationPriority | 'all'>('all');
  const [feedback, setFeedback] = useState('');
  const [undoItem, setUndoItem] = useState<WorkNotification | null>(null);
  const tr = (vi: string, en: string) => language === 'vi' ? vi : en;
  const message = (item: WorkNotification['title']) => item[language];

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(''), 4_000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (!undoItem) return;
    const timer = window.setTimeout(() => setUndoItem(null), 6_000);
    return () => window.clearTimeout(timer);
  }, [undoItem]);

  const visible = useMemo(() => items.filter(item => {
    const matchesStatus = status === 'archived'
      ? Boolean(item.archivedAt)
      : !item.archivedAt && (status === 'active' || (status === 'unread' ? !item.readAt : Boolean(item.readAt)));
    const matchesCategory = category === 'all' || item.category === category;
    const matchesPriority = priority === 'all' || item.priority === priority;
    const searchable = `${message(item.title)} ${message(item.detail)}`.toLocaleLowerCase(language === 'vi' ? 'vi-VN' : 'en-US');
    return matchesStatus && matchesCategory && matchesPriority && (!deferredQuery || searchable.includes(deferredQuery));
  }), [items, status, category, priority, deferredQuery, language]);

  const categories = [...new Set(items.map(item => item.category))];
  const statusOptions: { id: StatusFilter; label: string; count: number }[] = [
    { id: 'active', label: tr('Tất cả', 'All'), count: stats.total },
    { id: 'unread', label: tr('Chưa đọc', 'Unread'), count: stats.unread },
    { id: 'read', label: tr('Đã đọc', 'Read'), count: Math.max(0, stats.total - stats.unread) },
    { id: 'archived', label: tr('Đã lưu trữ', 'Archived'), count: stats.archived },
  ];

  const categoryLabel = (value: WorkNotificationCategory) => ({
    retention: tr('Giữ chân', 'Retention'),
    survey: tr('Khảo sát', 'Survey'),
    attendance: tr('Chấm công', 'Attendance'),
    request: tr('Yêu cầu', 'Request'),
    access: tr('Truy cập', 'Access'),
    system: tr('Hệ thống', 'System'),
  })[value];
  const priorityLabel = (value: WorkNotificationPriority) => ({
    high: tr('Cao', 'High'),
    medium: tr('Trung bình', 'Medium'),
    low: tr('Thấp', 'Low'),
  })[value];

  const openItem = (item: WorkNotification) => {
    markRead(item.id);
    navigate(item.actionTo);
  };

  const archiveItem = (item: WorkNotification) => {
    archive(item.id, true);
    setUndoItem(item);
    setFeedback(tr('Đã lưu trữ thông báo.', 'Notification archived.'));
  };

  const restoreItem = (item: WorkNotification) => {
    archive(item.id, false);
    setUndoItem(null);
    setFeedback(tr('Đã khôi phục thông báo.', 'Notification restored.'));
  };

  return <AppShell breadcrumb={[tr('Hộp công việc', 'Work Inbox')]}>
    <div className="mx-auto w-full max-w-[1500px] space-y-5">
      <section aria-labelledby="work-inbox-title" className="flex flex-col gap-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-orange-700"><BellRing size={17} aria-hidden="true" />{tr('Trung tâm theo dõi', 'Follow-up center')}</div>
          <h1 id="work-inbox-title" className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{tr('Hộp công việc', 'Work Inbox')}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{tr('Tập trung thông báo và công việc cần xử lý theo đúng vai trò của bạn.', 'Keep role-specific notifications and follow-up work in one place.')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-11" onClick={() => { reset(); setFeedback(tr('Đã khôi phục hộp công việc mẫu.', 'Demo inbox restored.')); }}><RefreshCw aria-hidden="true" />{tr('Khôi phục dữ liệu mẫu', 'Restore demo data')}</Button>
          <Button type="button" className="h-11 bg-orange-600 text-white hover:bg-orange-700" disabled={!stats.unread} onClick={() => { markAllRead(); setFeedback(tr('Đã đánh dấu tất cả là đã đọc.', 'All notifications marked as read.')); }}><CheckCheck aria-hidden="true" />{tr('Đọc tất cả', 'Mark all read')}</Button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: Inbox, label: tr('Đang hoạt động', 'Active'), value: stats.total, tone: 'border-blue-100 bg-blue-50 text-blue-700' },
          { icon: MailOpen, label: tr('Chưa đọc', 'Unread'), value: stats.unread, tone: 'border-orange-100 bg-orange-50 text-orange-700' },
          { icon: ClipboardCheck, label: tr('Cần hành động', 'Action required'), value: stats.actionRequired, tone: 'border-violet-100 bg-violet-50 text-violet-700' },
          { icon: ShieldCheck, label: tr('Ưu tiên cao', 'High priority'), value: stats.highPriority, tone: 'border-red-100 bg-red-50 text-red-700' },
        ].map(metric => <Card key={metric.label} className="p-4">
          <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium text-slate-600">{metric.label}</p><p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{metric.value}</p></div><span className={`grid size-11 place-items-center rounded-md border ${metric.tone}`}><metric.icon size={20} aria-hidden="true" /></span></div>
        </Card>)}
      </div>

      {feedback && <div role="status" aria-live="polite" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{feedback}</div>}
      {undoItem && <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm"><span>{tr('Đã lưu trữ:', 'Archived:')} <strong>{message(undoItem.title)}</strong></span><Button type="button" variant="outline" className="h-10" onClick={() => restoreItem(undoItem)}><RotateCcw aria-hidden="true" />{tr('Hoàn tác', 'Undo')}</Button></div>}

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={tr('Trạng thái hộp công việc', 'Inbox status')}>
            {statusOptions.map(option => <button key={option.id} type="button" role="tab" aria-selected={status === option.id} onClick={() => setStatus(option.id)} className={`min-h-11 rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 ${status === option.id ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{option.label}<span className={`ml-2 rounded-full px-1.5 py-0.5 text-xs ${status === option.id ? 'bg-white/20 text-white' : 'bg-white text-slate-600'}`}>{option.count}</span></button>)}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(240px,1fr)_220px_180px]">
            <label className="relative block"><span className="sr-only">{tr('Tìm thông báo', 'Search notifications')}</span><Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder={tr('Tìm theo tiêu đề hoặc nội dung', 'Search title or details')} className="h-11 pl-10" /></label>
            <FilterMenu
              label={tr('Lọc danh mục', 'Filter category')}
              value={category}
              onChange={value => setCategory(value as WorkNotificationCategory | 'all')}
              className="h-11 w-full"
              options={[{ value: 'all', label: tr('Tất cả danh mục', 'All categories') }, ...categories.map(value => ({ value, label: categoryLabel(value) }))]}
            />
            <FilterMenu
              label={tr('Lọc ưu tiên', 'Filter priority')}
              value={priority}
              onChange={value => setPriority(value as WorkNotificationPriority | 'all')}
              className="h-11 w-full"
              options={[{ value: 'all', label: tr('Mọi ưu tiên', 'All priorities') }, ...(['high', 'medium', 'low'] as const).map(value => ({ value, label: priorityLabel(value) }))]}
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {visible.length ? <div className="divide-y divide-slate-100" role="list">{visible.map(item => {
            const Icon = categoryIcons[item.category];
            const archived = Boolean(item.archivedAt);
            return <article key={item.id} role="listitem" className={`relative grid gap-4 p-4 transition-colors sm:p-5 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center ${!item.readAt && !archived ? 'bg-orange-50/35' : 'bg-white hover:bg-slate-50/70'}`}>
              {!item.readAt && !archived && <span aria-label={tr('Chưa đọc', 'Unread')} className="absolute left-1 top-1/2 size-2 -translate-y-1/2 rounded-full bg-orange-500" />}
              <span className={`grid size-11 place-items-center rounded-md border ${categoryTone[item.category]}`}><Icon size={20} aria-hidden="true" /></span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-950">{message(item.title)}</h2><span className={`rounded-md border px-2 py-1 text-xs font-semibold ${priorityTone[item.priority]}`}>{priorityLabel(item.priority)}</span>{item.actionRequired && <span className="rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700">{tr('Cần hành động', 'Action required')}</span>}</div>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{message(item.detail)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-600"><span>{categoryLabel(item.category)}</span><span aria-hidden="true">•</span><time dateTime={item.createdAt}>{relativeTime(item.createdAt, language)}</time></div>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {!archived && <Button type="button" className="h-10 bg-orange-600 text-white hover:bg-orange-700" onClick={() => openItem(item)}>{message(item.actionLabel)}<ChevronRight aria-hidden="true" /></Button>}
                {archived ? <Button type="button" variant="outline" className="h-10" onClick={() => restoreItem(item)}><RotateCcw aria-hidden="true" />{tr('Khôi phục', 'Restore')}</Button> : <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild><Button type="button" variant="outline" size="icon" className="size-10" aria-label={tr('Thao tác khác', 'More actions')}><MoreHorizontal aria-hidden="true" /></Button></DropdownMenu.Trigger>
                  <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={6} className="z-[80] min-w-52 rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                    <DropdownMenu.Item onSelect={() => markRead(item.id, !item.readAt)} className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 text-sm text-slate-700 outline-none focus:bg-slate-100"><MailOpen size={16} aria-hidden="true" />{item.readAt ? tr('Đánh dấu chưa đọc', 'Mark unread') : tr('Đánh dấu đã đọc', 'Mark read')}</DropdownMenu.Item>
                    <DropdownMenu.Item onSelect={() => archiveItem(item)} className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 text-sm text-slate-700 outline-none focus:bg-slate-100"><Archive size={16} aria-hidden="true" />{tr('Lưu trữ', 'Archive')}</DropdownMenu.Item>
                  </DropdownMenu.Content></DropdownMenu.Portal>
                </DropdownMenu.Root>}
              </div>
            </article>;
          })}</div> : <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center"><span className="grid size-14 place-items-center rounded-xl bg-slate-100 text-slate-500"><Inbox size={25} aria-hidden="true" /></span><h2 className="mt-4 text-lg font-semibold text-slate-950">{tr('Không có thông báo phù hợp', 'No matching notifications')}</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{tr('Thử thay đổi từ khóa hoặc bộ lọc để xem các công việc khác.', 'Change the search or filters to view other work items.')}</p></div>}
        </CardContent>
      </Card>
    </div>
  </AppShell>;
}
