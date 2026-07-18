import { Task } from '../types';

export const averageDefined = (values: Array<number | null | undefined>): number | null => {
  const measured = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!measured.length) return null;
  return Math.round(measured.reduce((sum, value) => sum + value, 0) / measured.length);
};

export const sumDurationMinutes = (tasks: Array<Pick<Task, 'actualDuration'>>): number =>
  Math.round(tasks.reduce((sum, task) => sum + Math.max(0, task.actualDuration || 0), 0) / 60);

export const getScheduleAdherencePercent = (plannedMinutes: number, actualSeconds: number): number => {
  if (!Number.isFinite(plannedMinutes) || !Number.isFinite(actualSeconds) || plannedMinutes <= 0 || actualSeconds < 0) return 0;
  const plannedSeconds = plannedMinutes * 60;
  const relativeError = Math.abs(actualSeconds - plannedSeconds) / plannedSeconds;
  return Math.round(Math.max(0, Math.min(1, 1 - relativeError)) * 100);
};

export const getCompletionDay = (task: Pick<Task, 'completionTimestamp' | 'completionDate'>): Date | null => {
  if (typeof task.completionTimestamp === 'number' && Number.isFinite(task.completionTimestamp)) {
    const date = new Date(task.completionTimestamp);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (!task.completionDate) return null;
  const date = new Date(`${task.completionDate}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getCompletionHour = (task: Pick<Task, 'completionTimestamp'>): number | null => {
  if (typeof task.completionTimestamp !== 'number' || !Number.isFinite(task.completionTimestamp)) return null;
  const date = new Date(task.completionTimestamp);
  return Number.isNaN(date.getTime()) ? null : date.getHours();
};
