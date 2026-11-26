import { SelectControl } from "./ui/select-control"
import { Building2, UserCheck, UserMinus, Users } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import { Area, AreaChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from './ui/button';
import { useLanguage } from '../context/LanguageContext';
import { listEmployeeProfiles, type ApiDepartment, type EmployeeProfile } from '../services/api';

export function EmployeeDirectoryOverview({ revision, departments, onDepartment }: {
  revision: number;
  departments: Pick<ApiDepartment, 'id' | 'name'>[];
  onDepartment: (id: number, status: string, query: string) => void;
}) {
  const { language } = useLanguage();
  const copy = (vi: string, en: string) => language === 'vi' ? vi : en;
  const [records, setRecords] = useState<EmployeeProfile[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setRecords(null);
    setFailed(false);
    // The directory API returns all matching rows. The FE adapter applies pagination.
    void listEmployeeProfiles({ limit: Number.MAX_SAFE_INTEGER }, controller.signal)
      .then(result => { if (!controller.signal.aborted) setRecords(result.data); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [revision, retry]);

  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const keyword = query.trim().toLowerCase();
  const filtered = (records ?? []).filter(employee =>
    (!department || String(employee.departmentId) === department)
    && (!status || employee.employmentStatus === status)
    && (!keyword || [employee.fullName, employee.employeeCode, employee.email].some(value => value?.toLowerCase().includes(keyword))),
  );
  const active = filtered.filter(employee => employee.employmentStatus === 'ACTIVE').length;
  const inactive = filtered.filter(employee => employee.employmentStatus === 'INACTIVE').length;
  const groups = new Map<number, { total: number; active: number; inactive: number }>();
  const hires = new Map<string, number>();
  for (const employee of filtered) {
    const id = employee.departmentId || 0;
    const group = groups.get(id) ?? { total: 0, active: 0, inactive: 0 };
    group.total++;
    if (employee.employmentStatus === 'ACTIVE') group.active++;
    if (employee.employmentStatus === 'INACTIVE') group.inactive++;
    groups.set(id, group);
    const month = employee.hireDate?.match(/^\d{4}-(?:0[1-9]|1[0-2])(?=-|$)/)?.[0];
    if (month) hires.set(month, (hires.get(month) ?? 0) + 1);
  }
  const distribution = [...groups].sort((a, b) => b[1].total - a[1].total);
  const months = [...hires].sort(([a], [b]) => a.localeCompare(b)).slice(-12);
  const largestDepartment = distribution[0]?.[1].total ?? 1;
  const gradientId = useId();
  const trend = months.map(([month, count]) => ({ month, count }));
  const locale = language === 'vi' ? 'vi-VN' : 'en-US';
  const number = new Intl.NumberFormat(locale);
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const metrics = [
    { label: copy('Tổng hồ sơ', 'Total profiles'), value: filtered.length, Icon: Users, color: 'bg-orange-50 text-orange-700' },
    { label: copy('Đang hoạt động', 'Active'), value: active, Icon: UserCheck, color: 'bg-emerald-50 text-emerald-700' },
    { label: copy('Ngừng hoạt động', 'Inactive'), value: inactive, Icon: UserMinus, color: 'bg-slate-100 text-slate-700' },
    { label: copy('Phòng ban có nhân viên', 'Staffed departments'), value: groups.size - Number(groups.has(0)), Icon: Building2, color: 'bg-blue-50 text-blue-700' },
  ];
  const control = 'mt-1.5 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-orange-600';

  return (

      <section aria-labelledby="employee-overview-title">
        <header className="mb-6">
          <div>
            <h1 id="employee-overview-title" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{copy('Tổng quan nhân sự', 'Workforce overview')}</h1>
            <p className="mt-1.5 text-sm text-slate-600">{copy('Cơ cấu phòng ban, trạng thái hồ sơ và thời điểm vào làm', 'Department composition, profile status and hire dates')}</p>
          </div>
        </header>
        <div className="space-y-5">
          <aside aria-label={copy('Bộ lọc tổng quan', 'Overview filters')} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
            <h3 className="font-semibold text-slate-900">{copy('Bộ lọc tổng quan', 'Overview filters')}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">{copy('Áp dụng cho các chỉ số và biểu đồ.', 'Applies to metrics and charts.')}</p>
            <div className="mt-4 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)_minmax(0,0.65fr)_auto]">
              <label className="text-sm font-medium text-slate-700">{copy('Tìm hồ sơ', 'Find profiles')}
                <input type="search" className={control} value={query} onChange={event => setQuery(event.target.value)} placeholder={copy('Tên, mã hoặc email', 'Name, code or email')} />
              </label>
              <label className="text-sm font-medium text-slate-700">{copy('Phòng ban', 'Department')}
                <SelectControl className={control} value={department} onChange={event => setDepartment(event.target.value)}>
                  <option value="">{copy('Tất cả phòng ban', 'All departments')}</option>
                  {departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </SelectControl>
              </label>
              <label className="text-sm font-medium text-slate-700">{copy('Trạng thái', 'Status')}
                <SelectControl className={control} value={status} onChange={event => setStatus(event.target.value)}>
                  <option value="">{copy('Tất cả trạng thái', 'All statuses')}</option>
                  <option value="ACTIVE">{copy('Đang hoạt động', 'Active')}</option>
                  <option value="INACTIVE">{copy('Ngừng hoạt động', 'Inactive')}</option>
                </SelectControl>
              </label>
              <Button className="h-10 justify-self-start rounded-md text-slate-700" variant="ghost" disabled={!department && !status && !query} onClick={() => { setDepartment(''); setStatus(''); setQuery(''); }}>{copy('Đặt lại bộ lọc', 'Reset filters')}</Button>
            </div>
          </aside>
          <div className="min-w-0 space-y-5">
            {failed ? (
              <div className="flex flex-wrap items-center gap-3">
                <p role="alert" className="text-sm text-red-700">{copy('Chưa tải được số liệu tổng quan.', 'Could not load the overview.')}</p>
                <Button variant="outline" onClick={() => setRetry(value => value + 1)}>{copy('Thử lại', 'Retry')}</Button>
              </div>
            ) : !records ? <p role="status" className="text-sm text-slate-600">{copy('Đang tải số liệu…', 'Loading totals…')}</p> : <>
              <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {metrics.map(({ label, value, Icon, color }) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
                    <span className={'mb-3 grid size-8 place-items-center rounded-md ' + color}><Icon size={17} aria-hidden="true" /></span>
                    <dt className="text-sm font-medium text-slate-500">{label}</dt>
                    <dd className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{number.format(value)}</dd>
                  </div>
                ))}
              </dl>
              {filtered.length === 0 ? <p role="status" className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">{copy('Không có hồ sơ trong phạm vi bộ lọc.', 'No profiles match these filters.')}</p> : (
                <div className="grid gap-5 lg:grid-cols-2 2xl:gap-6">
                  <section className="h-full min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
                    <h3 className="font-semibold text-slate-950">{copy('Cơ cấu theo phòng ban', 'Department composition')}</h3>
                    <p className="mt-1 text-xs text-slate-600">{copy('Chọn phòng ban để mở danh sách đã lọc. Nền xám nhạt là mốc so sánh với phòng ban có nhiều hồ sơ nhất.', 'Select a department to filter the employee list. The light gray track marks the largest department total.')}</p>
                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-700">
                      <span><span className="mr-1 inline-block size-2 rounded-full bg-emerald-600" />{copy('Đang hoạt động', 'Active')}</span>
                      <span><span className="mr-1 inline-block size-2 rounded-full bg-slate-700" />{copy('Ngừng hoạt động', 'Inactive')}</span>
                      {active + inactive < filtered.length && <span><span className="mr-1 inline-block size-2 rounded-full bg-[#3B82F6]" />{copy('Khác', 'Other')}</span>}
                    </div>
                    <ul className="mt-4 max-h-96 space-y-1 overflow-y-auto lg:max-h-[32rem]">
                      {distribution.map(([id, group]) => {
                        const segments = [
                          { label: copy('Đang hoạt động', 'Active'), count: group.active, color: 'bg-emerald-600' },
                          { label: copy('Ngừng hoạt động', 'Inactive'), count: group.inactive, color: 'bg-slate-700' },
                          { label: copy('Khác', 'Other'), count: group.total - group.active - group.inactive, color: 'bg-[#3B82F6]' },
                        ];
                        const breakdown = segments.map(({ label, count }) => label + ': ' + number.format(count)).join(' · ');
                        return (
                        <li key={id}>
                          <button type="button" aria-disabled={!id} title={breakdown} onClick={() => { if (id) onDepartment(id, status, query.trim()); }} className="w-full rounded-md px-2 py-2 text-left hover:bg-[#FFF7ED] aria-disabled:cursor-default cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-orange-600">
                            <span className="flex justify-between gap-3 text-sm text-slate-800"><span>{departments.find(item => item.id === id)?.name ?? (id ? '#' + id : copy('Chưa gán phòng ban', 'Unassigned'))}</span><span className="font-semibold tabular-nums">{number.format(group.total)}</span></span>
                            <span aria-hidden="true" className="mt-1.5 block rounded-full bg-slate-200"><span className="flex h-2 gap-0.5" style={{ width: group.total / largestDepartment * 100 + '%' }}>
                              {segments.filter(segment => segment.count > 0).map(segment => (
                                <span key={segment.label} className={'min-w-0 rounded-full ' + segment.color} style={{ flex: segment.count + ' 1 0' }} />
                              ))}
                            </span></span>
                            <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                              {segments.map(({ label, count, color }) => (
                                <span key={label} className="inline-flex items-center gap-1.5">
                                  <span aria-hidden="true" className={'size-2 rounded-full ' + color} />
                                  <span className="font-semibold tabular-nums text-slate-900">{number.format(count)}</span>
                                  {label}
                                </span>
                              ))}
                            </span>
                          </button>
                        </li>
                        );
                      })}
                    </ul>
                  </section>
                  <section className="h-full min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
                    <h3 className="font-semibold text-slate-950">{copy('Hồ sơ theo tháng vào làm', 'Profiles by hire month')}</h3>
                    <p className="mt-1 text-xs text-slate-600">{copy('Tối đa 12 tháng gần nhất có hồ sơ trong bộ lọc.', 'Up to the latest 12 months with matching profiles.')}</p>
                    {months.length === 0 ? <p className="mt-4 text-sm text-slate-600">{copy('Chưa có ngày vào làm.', 'No hire dates available.')}</p> : (
                      <div className="mt-4 h-72 w-full min-w-0 sm:h-80 lg:h-96 2xl:h-[26rem]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={trend} margin={{ top: 24, right: 10, bottom: 4, left: 0 }}>
                            <defs>
                              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#F97316" stopOpacity={0.2} />
                                <stop offset="100%" stopColor="#F97316" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="4 4" />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tickMargin={10} tick={{ fill: '#475569', fontSize: 11 }} padding={{ left: 24, right: 24 }} interval="preserveStartEnd" minTickGap={8} tickFormatter={(month: string) => month.slice(5) + '/' + month.slice(2, 4)} />
                            <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={32} tick={{ fill: '#475569', fontSize: 11 }} />
                            <Tooltip cursor={{ stroke: '#CBD5E1', strokeDasharray: '4 4' }} content={({ active, payload }) => {
                              const point = payload?.[0]?.payload as (typeof trend)[number] | undefined;
                              if (!active || !point) return null;
                              return (
                                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm">
                                  <p className="font-semibold text-slate-900">{monthLabel.format(new Date(point.month + '-01T00:00:00Z'))}</p>
                                  <p className="mt-1">{copy('Hồ sơ vào làm', 'Profiles starting work')}: {number.format(point.count)}</p>
                                </div>
                              );
                            }} />
                            <Area type="monotone" dataKey="count" stroke="#F97316" strokeWidth={2.5} fill={'url(#' + gradientId + ')'} dot={{ r: 4, fill: '#FFFFFF', stroke: '#F97316', strokeWidth: 2 }} activeDot={{ r: 5, fill: '#FFFFFF', stroke: '#F97316', strokeWidth: 2 }} isAnimationActive={false}>
                              <LabelList dataKey="count" position="top" offset={9} fill="#334155" fontSize={12} fontWeight={600} />
                            </Area>
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </section>
                </div>
              )}
            </>}
          </div>
        </div>
      </section>

  );
}