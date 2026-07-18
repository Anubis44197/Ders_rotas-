import type { ReportPeriod } from '../types';

const PERIOD_DAYS: Partial<Record<ReportPeriod, number>> = {
  'Haftalık': 7,
  'Aylık': 30,
  '2 Aylık': 60,
  '3 Aylık': 90,
  'Yıllık': 365,
};

const atLocalDayStart = (value: Date) => {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const getReportPeriodDayCount = (period: ReportPeriod) => PERIOD_DAYS[period] ?? null;

export const getReportPeriodStart = (period: ReportPeriod, now = new Date()) => {
  const days = getReportPeriodDayCount(period);
  if (days === null) return null;
  const start = atLocalDayStart(now);
  start.setDate(start.getDate() - (days - 1));
  return start;
};

export const isDateInReportPeriod = (dateValue: string | undefined, period: ReportPeriod, now = new Date()) => {
  if (!dateValue) return false;
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  if (period === 'Tüm Zamanlar') return true;
  const start = getReportPeriodStart(period, now);
  if (!start) return false;
  return date >= start && date <= atLocalDayStart(now);
};