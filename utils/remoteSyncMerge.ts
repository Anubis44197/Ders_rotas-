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

const REMOTE_SECTION_KEYS: Array<Exclude<keyof RemoteAppData, 'tasks' | 'taskTombstones' | 'courses' | 'curriculum' | 'weeklySchedule'>> = [
  'performanceData', 'rewards', 'badges', 'successPoints', 'schoolTopicHistory', 'examRecords',
  'compositeExamResults', 'examScheduleEntries', 'studyPlans', 'planningEngineSnapshot',
];

const sameValue = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const mergeRecordByKey = (
  base: Record<string, unknown>,
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
  mergeConflict?: (baseValue: unknown, localValue: unknown, remoteValue: unknown) => unknown,
) => {
  const result: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
  keys.forEach((key) => {
    const baseHas = Object.prototype.hasOwnProperty.call(base, key);
    const localHas = Object.prototype.hasOwnProperty.call(local, key);
    const remoteHas = Object.prototype.hasOwnProperty.call(remote, key);
    const localChanged = baseHas !== localHas || (baseHas && localHas && !sameValue(base[key], local[key]));
    const remoteChanged = baseHas !== remoteHas || (baseHas && remoteHas && !sameValue(base[key], remote[key]));

    if (localChanged) {
      if (!localHas) return;
      result[key] = remoteChanged && remoteHas && mergeConflict
        ? mergeConflict(base[key], local[key], remote[key])
        : local[key];
      return;
    }
    if (remoteHas) result[key] = remote[key];
  });
  return result;
};

const toKeyedRecord = (items: unknown[], getKey: (item: any, index: number) => string) =>
  Object.fromEntries(items.map((item, index) => [getKey(item, index), item]));

const mergeKeyedArray = (
  base: unknown[],
  local: unknown[],
  remote: unknown[],
  getKey: (item: any, index: number) => string,
  mergeConflict?: (baseValue: unknown, localValue: unknown, remoteValue: unknown) => unknown,
) => Object.values(mergeRecordByKey(
  toKeyedRecord(base, getKey),
  toKeyedRecord(local, getKey),
  toKeyedRecord(remote, getKey),
  mergeConflict,
));

const mergeObjectFields = (baseValue: unknown, localValue: unknown, remoteValue: unknown) =>
  mergeRecordByKey(
    baseValue && typeof baseValue === 'object' ? baseValue as Record<string, unknown> : {},
    localValue && typeof localValue === 'object' ? localValue as Record<string, unknown> : {},
    remoteValue && typeof remoteValue === 'object' ? remoteValue as Record<string, unknown> : {},
  );

const courseKey = (course: any, index: number) => String(course?.id || course?.name || ('course-' + index));
const namedKey = (item: any, index: number) => String(item?.name || ('item-' + index));

const mergeCurriculumUnit = (baseValue: unknown, localValue: unknown, remoteValue: unknown) => {
  const baseUnit = (baseValue && typeof baseValue === 'object' ? baseValue : {}) as Record<string, unknown>;
  const localUnit = (localValue && typeof localValue === 'object' ? localValue : {}) as Record<string, unknown>;
  const remoteUnit = (remoteValue && typeof remoteValue === 'object' ? remoteValue : {}) as Record<string, unknown>;
  return {
    ...remoteUnit,
    ...localUnit,
    topics: mergeKeyedArray(
      Array.isArray(baseUnit.topics) ? baseUnit.topics : [],
      Array.isArray(localUnit.topics) ? localUnit.topics : [],
      Array.isArray(remoteUnit.topics) ? remoteUnit.topics : [],
      namedKey,
    ),
  };
};

const mergeCurriculumSubject = (baseValue: unknown, localValue: unknown, remoteValue: unknown) =>
  mergeKeyedArray(
    Array.isArray(baseValue) ? baseValue : [],
    Array.isArray(localValue) ? localValue : [],
    Array.isArray(remoteValue) ? remoteValue : [],
    namedKey,
    mergeCurriculumUnit,
  );

const scheduleItemKey = (item: any, index: number) =>
  String(item?.id || ((item?.courseName || 'window') + '-' + (item?.startTime || '') + '-' + (item?.endTime || '')) || ('item-' + index));

const mergeScheduleDay = (baseValue: unknown, localValue: unknown, remoteValue: unknown) => {
  const baseDay = (baseValue && typeof baseValue === 'object' ? baseValue : {}) as Record<string, unknown>;
  const localDay = (localValue && typeof localValue === 'object' ? localValue : {}) as Record<string, unknown>;
  const remoteDay = (remoteValue && typeof remoteValue === 'object' ? remoteValue : {}) as Record<string, unknown>;
  return {
    ...mergeRecordByKey(baseDay, localDay, remoteDay),
    slots: mergeKeyedArray(
      Array.isArray(baseDay.slots) ? baseDay.slots : [],
      Array.isArray(localDay.slots) ? localDay.slots : [],
      Array.isArray(remoteDay.slots) ? remoteDay.slots : [],
      scheduleItemKey,
      mergeObjectFields,
    ),
    availableWindows: mergeKeyedArray(
      Array.isArray(baseDay.availableWindows) ? baseDay.availableWindows : [],
      Array.isArray(localDay.availableWindows) ? localDay.availableWindows : [],
      Array.isArray(remoteDay.availableWindows) ? remoteDay.availableWindows : [],
      scheduleItemKey,
      mergeObjectFields,
    ),
  };
};

export const mergeRemoteSections = (base: RemoteAppData | null, local: RemoteAppData, remote: RemoteAppData): RemoteAppData => {
  const merged = { ...remote } as RemoteAppData;
  const mergedRecord = merged as unknown as Record<string, unknown>;
  const localRecord = local as unknown as Record<string, unknown>;
  const baseRecord = (base || {}) as unknown as Record<string, unknown>;

  REMOTE_SECTION_KEYS.forEach((key) => {
    if (!base || !sameValue(localRecord[key], baseRecord[key])) mergedRecord[key] = localRecord[key];
  });

  merged.courses = mergeKeyedArray(base?.courses || [], local.courses, remote.courses, courseKey, mergeObjectFields);
  merged.curriculum = mergeRecordByKey(base?.curriculum || {}, local.curriculum, remote.curriculum, mergeCurriculumSubject);
  merged.weeklySchedule = mergeRecordByKey(base?.weeklySchedule || {}, local.weeklySchedule, remote.weeklySchedule, mergeScheduleDay);
  return merged;
};