import type { ReportRecord } from '../utils/reportStore.ts';

export type ReportCategory = 'Overview' | 'Department' | 'Employee' | 'Factors' | 'AI Model';

export interface CreateReportInput {
  name: string;
  description: string;
  category: ReportCategory;
  owner: string;
}

export function createReportRecord(input: CreateReportInput, now: Date | string = new Date()): ReportRecord {
  const createdAt = now instanceof Date ? now : new Date(now);
  const suffix = createdAt.getTime();
  return {
    id: `report-${suffix}`,
    name: input.name.trim(),
    description: input.description.trim(),
    category: input.category,
    lastGenerated: createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    owner: input.owner.trim() || 'ERIS HR',
  };
}

export function filterReportRecords(
  reports: ReportRecord[],
  query: string,
  category: ReportCategory | 'All',
) {
  const normalized = query.trim().toLocaleLowerCase('vi-VN');
  return reports.filter(report => {
    const matchesCategory = category === 'All' || report.category === category;
    const searchable = `${report.name} ${report.description} ${report.owner}`.toLocaleLowerCase('vi-VN');
    return matchesCategory && (!normalized || searchable.includes(normalized));
  });
}

export function reportCategoryCount(reports: ReportRecord[]) {
  return new Set(reports.map(report => report.category)).size;
}
