import type { Task } from '../types';
import type { RemoteAppData } from './firebaseLiveSync';

export const getTaskMutationTime = (task: Task): number => {
  const updatedAt = task.updatedAt ? Date.parse(task.updatedAt) : Number.NaN;
  if (Number.isFinite(updatedAt)) return updatedAt;
  if (typeof task.completionTimestamp === 'number' && Number.isFinite(task.completionTimestamp)) return task.completionTimestamp;
  const createdAt = task.createdAt ? Date.parse(task.createdAt) : Number.NaN;
  return Number.isFinite(createdAt) ? createdAt : 0;
};

export const mergeTaskTombstones = (local: Record<string, string>, remote: Record<string, string>) => {
  const merged = { ...remote };
  Object.entries(local).forEach(([taskId, deletedAt]) => {
    if (!merged[taskId] || deletedAt > merged[taskId]) merged[taskId] = deletedAt;
  });
  return merged;
};

export const mergeTasksByLatestMutation = (localTasks: Task[], remoteTasks: Task[], tombstones: Record<string, string> = {}): Task[] => {
  const merged = new Map<string, Task>();
  remoteTasks.forEach((task) => merged.set(task.id, task));
  localTasks.forEach((localTask) => {
    const remoteTask = merged.get(localTask.id);
    if (!remoteTask || getTaskMutationTime(localTask) > getTaskMutationTime(remoteTask)) merged.set(localTask.id, localTask);
  });
  return [...merged.values()]
    .filter((task) => {
      const deletedAt = tombstones[task.id];
      return !deletedAt || getTaskMutationTime(task) > Date.parse(deletedAt);
    })
    .sort((left, right) => getTaskMutationTime(right) - getTaskMutationTime(left));
};

const REMOTE_SECTION_KEYS: Array<Exclude<keyof RemoteAppData, 'tasks' | 'taskTombstones'>> = [
  'courses', 'performanceData', 'rewards', 'badges', 'successPoints', 'curriculum', 'weeklySchedule',
  'schoolTopicHistory', 'examRecords', 'compositeExamResults', 'examScheduleEntries', 'studyPlans', 'planningEngineSnapshot',
];

export const mergeRemoteSections = (base: RemoteAppData | null, local: RemoteAppData, remote: RemoteAppData): RemoteAppData => {
  if (!base) return { ...remote, ...local };
  const merged = { ...remote } as RemoteAppData;
  const mergedRecord = merged as unknown as Record<string, unknown>;
  const localRecord = local as unknown as Record<string, unknown>;
  const baseRecord = base as unknown as Record<string, unknown>;
  REMOTE_SECTION_KEYS.forEach((key) => {
    if (JSON.stringify(localRecord[key]) !== JSON.stringify(baseRecord[key])) mergedRecord[key] = localRecord[key];
  });
  return merged;
};