import type { WorkSchedule } from '../services/api.ts';
export type ScheduleFilters = { search: string; shiftType: string; status: 'all' | 'ACTIVE' | 'INACTIVE'; day: number | null };
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
export function filterWorkSchedules(schedules: WorkSchedule[], filters: ScheduleFilters): WorkSchedule[] {
  return schedules.filter(s => normalize(s.name).includes(normalize(filters.search))
    && normalize(s.shift_type || '').includes(normalize(filters.shiftType))
    && (filters.status === 'all' || s.status === filters.status)
    && (filters.day === null || s.working_days.includes(filters.day))).sort((a, b) => b.id - a.id);
}
