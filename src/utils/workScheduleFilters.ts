import type { WorkSchedule } from '../services/api.ts';

export type ScheduleKind = 'default' | 'pending' | 'individual';
export type ScheduleFilters = { search: string; kind: 'all' | ScheduleKind; status: 'all' | 'ACTIVE' | 'INACTIVE'; day: number | null };
export function scheduleKind(schedule: WorkSchedule): ScheduleKind {
  return schedule.is_default ? 'default' : schedule.pending_default ? 'pending' : 'individual';
}
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();

export function filterWorkSchedules(schedules: WorkSchedule[], filters: ScheduleFilters, recentId: number | null = null): WorkSchedule[] {
  const query = normalize(filters.search);
  const priority = (schedule: WorkSchedule) => schedule.id === recentId ? 0 : scheduleKind(schedule) === 'default' ? 1 : scheduleKind(schedule) === 'pending' ? 2 : 3;
  return schedules.filter(schedule => (!query || normalize(schedule.name).includes(query))
    && (filters.kind === 'all' || scheduleKind(schedule) === filters.kind)
    && (filters.status === 'all' || schedule.status === filters.status)
    && (filters.day === null || schedule.working_days.includes(filters.day)))
    .sort((a, b) => priority(a) - priority(b) || b.id - a.id);
}
