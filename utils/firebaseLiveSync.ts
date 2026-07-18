import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { collection, doc, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, onSnapshot, runTransaction, serverTimestamp, type Unsubscribe } from 'firebase/firestore';

export interface RemoteAppData {
  courses: unknown[];
  tasks: unknown[];
  taskTombstones: Record<string, string>;
  performanceData: unknown[];
  rewards: unknown[];
  badges: unknown[];
  successPoints: number;
  curriculum: Record<string, unknown>;
  weeklySchedule: Record<string, unknown>;
  schoolTopicHistory: unknown[];
  examRecords: unknown[];
  compositeExamResults: unknown[];
  examScheduleEntries: unknown[];
  studyPlans: unknown[];
  planningEngineSnapshot: unknown;
}

export interface RemoteSnapshotPayload {
  appData: RemoteAppData;
  updatedAt: string | null;
  updatedBy: string | null;
  syncRevision: number;
}

type SectionId = Exclude<keyof RemoteAppData, 'successPoints' | 'planningEngineSnapshot' | 'tasks' | 'taskTombstones'> | 'meta';

type SectionValue = unknown[] | Record<string, unknown> | { successPoints: number; planningEngineSnapshot: unknown; taskTombstones?: Record<string, string>; syncRevision?: number };

export class RemoteWriteConflictError extends Error {
  constructor() {
    super('Remote data changed on another device before this update could be published.');
    this.name = 'RemoteWriteConflictError';
  }
}

const firebaseConfig = {
  apiKey: 'AIzaSyDnolB5eGB4YtZBEklbVpQsJ7qhsQsSQeI',
  authDomain: 'ders-tak.firebaseapp.com',
  projectId: 'ders-tak',
  storageBucket: 'ders-tak.firebasestorage.app',
  messagingSenderId: '1017687251305',
  appId: '1:1017687251305:web:8bdbe9daebe6b1366685f8',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
const familyId = 'ders-tak-main';
const legacyStateRef = doc(db, 'families', familyId, 'state', 'current');
const legacyTasksRef = doc(db, 'families', familyId, 'state', 'tasks');
const taskChunksRef = collection(db, 'families', familyId, 'taskChunks');
const taskChunkDocRef = (chunkId: string) => doc(db, 'families', familyId, 'taskChunks', chunkId);

const TASK_CHUNK_SIZE = 100;
const TASK_BUCKET_COUNT = 64;
const TASK_ORDER_CHUNK_ID = 'task_order';

const sectionIds = [
  'courses',
  'performanceData',
  'rewards',
  'badges',
  'curriculum',
  'weeklySchedule',
  'schoolTopicHistory',
  'examRecords',
  'compositeExamResults',
  'examScheduleEntries',
  'studyPlans',
  'meta',
] as const satisfies readonly SectionId[];

const sectionDefaults: Record<SectionId, SectionValue> = {
  courses: [],
  performanceData: [],
  rewards: [],
  badges: [],
  curriculum: {},
  weeklySchedule: {},
  schoolTopicHistory: [],
  examRecords: [],
  compositeExamResults: [],
  examScheduleEntries: [],
  studyPlans: [],
  meta: { successPoints: 0, planningEngineSnapshot: null },
};

const sectionRefs = Object.fromEntries(
  sectionIds.map((sectionId) => [sectionId, doc(db, 'families', familyId, 'state', sectionId)]),
) as Record<SectionId, ReturnType<typeof doc>>;

const lastPublishedSections = new Map<SectionId, string>();
const lastPublishedTaskChunks = new Map<string, string>();
let knownTaskChunkIds = new Set<string>();

const rememberKnownSection = (sectionId: SectionId, value: SectionValue) => {
  lastPublishedSections.set(sectionId, JSON.stringify(value));
};

const toPlainJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value, (_key, entry) => {
  if (typeof entry === 'function') return undefined;
  return entry;
}));

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const getTaskChunkId = (index: number) => `bucket_${String(index).padStart(2, '0')}`;

const getRecordValue = (value: unknown, key: string): unknown => {
  if (!value || typeof value !== 'object') return undefined;
  return (value as Record<string, unknown>)[key];
};

const getTaskStableKey = (task: unknown, fallbackIndex: number): string => {
  const id = getRecordValue(task, 'id');
  if (typeof id === 'string' && id.trim()) return id.trim();

  const createdAt = getRecordValue(task, 'createdAt');
  const title = getRecordValue(task, 'title');
  const dueDate = getRecordValue(task, 'dueDate');
  return [
    typeof createdAt === 'string' ? createdAt : '',
    typeof dueDate === 'string' ? dueDate : '',
    typeof title === 'string' ? title : '',
    fallbackIndex,
  ].join('|');
};

const getStableHash = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const getTaskBucketIndex = (task: unknown, fallbackIndex: number) => getStableHash(getTaskStableKey(task, fallbackIndex)) % TASK_BUCKET_COUNT;

const restoreTaskOrder = (tasks: unknown[], taskOrder: string[]) => {
  if (taskOrder.length === 0 || tasks.length === 0) return tasks;

  const buckets = new Map<string, unknown[]>();
  tasks.forEach((task, index) => {
    const key = getTaskStableKey(task, index);
    const bucket = buckets.get(key) || [];
    bucket.push(task);
    buckets.set(key, bucket);
  });

  const ordered: unknown[] = [];
  const used = new Set<unknown>();
  taskOrder.forEach((key) => {
    const bucket = buckets.get(key);
    const task = bucket?.shift();
    if (!task) return;
    ordered.push(task);
    used.add(task);
  });

  tasks.forEach((task) => {
    if (!used.has(task)) ordered.push(task);
  });

  return ordered;
};

const splitTaskChunks = (tasks: unknown[]) => {
  const chunks: Array<{ id: string; index: number; tasks: unknown[]; serialized: string }> = [];
  const bucketedTasks = Array.from({ length: TASK_BUCKET_COUNT }, () => [] as unknown[]);
  const taskOrder = tasks.map((task, index) => {
    bucketedTasks[getTaskBucketIndex(task, index)].push(task);
    return getTaskStableKey(task, index);
  });

  chunks.push({
    id: TASK_ORDER_CHUNK_ID,
    index: -1,
    tasks: taskOrder,
    serialized: JSON.stringify(taskOrder),
  });

  bucketedTasks.forEach((chunkTasks, index) => {
    if (chunkTasks.length === 0) return;
    chunks.push({
      id: getTaskChunkId(index),
      index,
      tasks: chunkTasks,
      serialized: JSON.stringify(chunkTasks),
    });
  });
  return chunks;
};

const rememberKnownTaskChunks = (tasks: unknown[]) => {
  lastPublishedTaskChunks.clear();
  const chunks = splitTaskChunks(tasks);
  chunks.forEach((chunk) => lastPublishedTaskChunks.set(chunk.id, chunk.serialized));
  knownTaskChunkIds = new Set(chunks.map((chunk) => chunk.id));
};

const rememberKnownAppData = (appData: RemoteAppData) => {
  const plainAppData = toPlainJson(appData);
  const sections = splitRemoteAppData(plainAppData);
  sectionIds.forEach((sectionId) => rememberKnownSection(sectionId, sections[sectionId]));
  rememberKnownTaskChunks(asArray(plainAppData.tasks));
};

const getCurrentUser = () => new Promise<User>((resolve, reject) => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (!user) return;
    unsubscribe();
    resolve(user);
  }, (error) => {
    unsubscribe();
    reject(error);
  });

  if (!auth.currentUser) {
    void signInAnonymously(auth).catch((error) => {
      unsubscribe();
      reject(error);
    });
  }
});

const parseUpdatedAt = (value: { toDate?: () => Date } | string | null | undefined) => {
  if (typeof value === 'string') return value;
  return value?.toDate?.()?.toISOString?.() || null;
};

const splitRemoteAppData = (appData: RemoteAppData): Record<SectionId, SectionValue> => ({
  courses: appData.courses,
  performanceData: appData.performanceData,
  rewards: appData.rewards,
  badges: appData.badges,
  curriculum: appData.curriculum,
  weeklySchedule: appData.weeklySchedule,
  schoolTopicHistory: appData.schoolTopicHistory,
  examRecords: appData.examRecords,
  compositeExamResults: appData.compositeExamResults,
  examScheduleEntries: appData.examScheduleEntries,
  studyPlans: appData.studyPlans,
  meta: {
    successPoints: appData.successPoints,
    planningEngineSnapshot: appData.planningEngineSnapshot,
    taskTombstones: appData.taskTombstones,
  },
});

const assembleRemoteAppData = (sections: Map<SectionId, SectionValue>, tasks: unknown[]): RemoteAppData => {
  const meta = (sections.get('meta') || sectionDefaults.meta) as { successPoints?: number; planningEngineSnapshot?: unknown; taskTombstones?: Record<string, string>; syncRevision?: number };
  return {
    courses: (sections.get('courses') || sectionDefaults.courses) as unknown[],
    tasks,
    taskTombstones: meta.taskTombstones && typeof meta.taskTombstones === 'object' ? meta.taskTombstones : {},
    performanceData: (sections.get('performanceData') || sectionDefaults.performanceData) as unknown[],
    rewards: (sections.get('rewards') || sectionDefaults.rewards) as unknown[],
    badges: (sections.get('badges') || sectionDefaults.badges) as unknown[],
    successPoints: typeof meta.successPoints === 'number' ? meta.successPoints : 0,
    curriculum: (sections.get('curriculum') || sectionDefaults.curriculum) as Record<string, unknown>,
    weeklySchedule: (sections.get('weeklySchedule') || sectionDefaults.weeklySchedule) as Record<string, unknown>,
    schoolTopicHistory: (sections.get('schoolTopicHistory') || sectionDefaults.schoolTopicHistory) as unknown[],
    examRecords: (sections.get('examRecords') || sectionDefaults.examRecords) as unknown[],
    compositeExamResults: (sections.get('compositeExamResults') || sectionDefaults.compositeExamResults) as unknown[],
    examScheduleEntries: (sections.get('examScheduleEntries') || sectionDefaults.examScheduleEntries) as unknown[],
    studyPlans: (sections.get('studyPlans') || sectionDefaults.studyPlans) as unknown[],
    planningEngineSnapshot: meta.planningEngineSnapshot ?? null,
  };
};

export const startRemoteAppDataSync = async ({
  onRemoteData,
  onRemoteMissing,
  onError,
  onReady,
}: {
  onRemoteData: (payload: RemoteSnapshotPayload) => void;
  onRemoteMissing: () => void;
  onError: (error: Error) => void;
  onReady: (uid: string) => void;
}): Promise<Unsubscribe> => {
  const user = await getCurrentUser();
  onReady(user.uid);

  const loadedSections = new Set<SectionId>();
  const sectionValues = new Map<SectionId, SectionValue>();
  let loadedTaskChunks = false;
  let loadedLegacyTasks = false;
  let chunkTasks: unknown[] = [];
  let legacyTasks: unknown[] = [];
  let latestUpdatedAt: string | null = null;
  let latestUpdatedBy: string | null = null;
  let hasSplitState = false;
  let hasTaskChunks = false;
  let hasEmittedMissing = false;
  let syncRevision = 0;

  const getActiveTasks = () => (hasTaskChunks ? chunkTasks : legacyTasks);

  const maybeRemoteMissing = () => {
    if (hasEmittedMissing || hasSplitState || hasTaskChunks) return;
    if (loadedSections.size === sectionIds.length && loadedTaskChunks && loadedLegacyTasks) {
      hasEmittedMissing = true;
      onRemoteMissing();
    }
  };

  const emitSplitState = () => {
    if (loadedSections.size !== sectionIds.length || !loadedTaskChunks || !loadedLegacyTasks || !hasSplitState) {
      maybeRemoteMissing();
      return;
    }
    onRemoteData({
      appData: assembleRemoteAppData(sectionValues, getActiveTasks()),
      updatedAt: latestUpdatedAt,
      updatedBy: latestUpdatedBy,
      syncRevision,
    });
  };

  const unsubscribes = sectionIds.map((sectionId) => onSnapshot(sectionRefs[sectionId], (snapshot) => {
    loadedSections.add(sectionId);
    if (snapshot.exists()) {
      const data = snapshot.data() as { value?: SectionValue; updatedAt?: { toDate?: () => Date } | string | null; updatedBy?: string | null };
      const value = data.value ?? sectionDefaults[sectionId];
      sectionValues.set(sectionId, value);
      rememberKnownSection(sectionId, value);
      if (sectionId === 'meta') {
        const candidate = Number((value as { syncRevision?: unknown }).syncRevision);
        syncRevision = Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : 0;
      }
      hasSplitState = true;
      latestUpdatedAt = parseUpdatedAt(data.updatedAt) || latestUpdatedAt;
      latestUpdatedBy = data.updatedBy || latestUpdatedBy;
    }
    emitSplitState();
  }, (error) => onError(error)));

  const taskChunksUnsubscribe = onSnapshot(taskChunksRef, (snapshot) => {
    loadedTaskChunks = true;
    hasTaskChunks = !snapshot.empty;
    if (hasTaskChunks) {
      let taskOrder: string[] = [];
      const docs = snapshot.docs
        .map((chunkDoc) => {
          const data = chunkDoc.data() as { value?: unknown[]; chunkIndex?: number; updatedAt?: { toDate?: () => Date } | string | null; updatedBy?: string | null };
          latestUpdatedAt = parseUpdatedAt(data.updatedAt) || latestUpdatedAt;
          latestUpdatedBy = data.updatedBy || latestUpdatedBy;
          return {
            id: chunkDoc.id,
            index: typeof data.chunkIndex === 'number' ? data.chunkIndex : Number(chunkDoc.id.replace(/\D/g, '')) || 0,
            value: asArray(data.value),
          };
        })
        .sort((left, right) => left.index - right.index || left.id.localeCompare(right.id));
      const taskDocs = docs.filter((entry) => {
        if (entry.id !== TASK_ORDER_CHUNK_ID) return true;
        taskOrder = entry.value.filter((item): item is string => typeof item === 'string');
        return false;
      });
      chunkTasks = restoreTaskOrder(taskDocs.flatMap((entry) => entry.value), taskOrder);
      lastPublishedTaskChunks.clear();
      docs.forEach((entry) => lastPublishedTaskChunks.set(entry.id, JSON.stringify(entry.value)));
      knownTaskChunkIds = new Set(docs.map((entry) => entry.id));
    } else {
      chunkTasks = [];
      knownTaskChunkIds = new Set();
      lastPublishedTaskChunks.clear();
    }
    emitSplitState();
  }, (error) => onError(error));

  const legacyTasksUnsubscribe = onSnapshot(legacyTasksRef, (snapshot) => {
    loadedLegacyTasks = true;
    if (snapshot.exists()) {
      const data = snapshot.data() as { value?: unknown[]; updatedAt?: { toDate?: () => Date } | string | null; updatedBy?: string | null };
      legacyTasks = asArray(data.value);
      if (!hasTaskChunks) {
        latestUpdatedAt = parseUpdatedAt(data.updatedAt) || latestUpdatedAt;
        latestUpdatedBy = data.updatedBy || latestUpdatedBy;
      }
    }
    emitSplitState();
  }, (error) => onError(error));

  const legacyUnsubscribe = onSnapshot(legacyStateRef, (snapshot) => {
    if (hasSplitState || hasTaskChunks) return;
    if (!snapshot.exists()) {
      maybeRemoteMissing();
      return;
    }
    const data = snapshot.data() as { appData?: RemoteAppData; updatedAt?: { toDate?: () => Date } | string | null; updatedBy?: string | null };
    if (!data.appData) {
      maybeRemoteMissing();
      return;
    }
    rememberKnownAppData(data.appData);
    onRemoteData({
      appData: data.appData,
      updatedAt: parseUpdatedAt(data.updatedAt),
      updatedBy: data.updatedBy || null,
      syncRevision: 0,
    });
  }, (error) => onError(error));

  return () => {
    unsubscribes.forEach((unsubscribe) => unsubscribe());
    taskChunksUnsubscribe();
    legacyTasksUnsubscribe();
    legacyUnsubscribe();
  };
};

export const publishRemoteAppData = async (appData: RemoteAppData, expectedRevision: number): Promise<number> => {
  const user = await getCurrentUser();
  const plainAppData = toPlainJson(appData);
  const sections = splitRemoteAppData(plainAppData);
  const nextTaskChunks = splitTaskChunks(asArray(plainAppData.tasks));
  const nextTaskChunkIds = new Set(nextTaskChunks.map((chunk) => chunk.id));
  const taskOrderChunk = nextTaskChunks.find((chunk) => chunk.id === TASK_ORDER_CHUNK_ID);
  const dataTaskChunks = nextTaskChunks.filter((chunk) => chunk.id !== TASK_ORDER_CHUNK_ID);
  const dataTaskChunkIds = new Set(dataTaskChunks.map((chunk) => chunk.id));
  const changedTaskChunks = dataTaskChunks.filter((chunk) => chunk.serialized !== lastPublishedTaskChunks.get(chunk.id));
  const changedTaskOrder = taskOrderChunk && taskOrderChunk.serialized !== lastPublishedTaskChunks.get(taskOrderChunk.id)
    ? taskOrderChunk
    : null;
  const staleTaskChunkIds = [...knownTaskChunkIds]
    .filter((chunkId) => chunkId !== TASK_ORDER_CHUNK_ID && !dataTaskChunkIds.has(chunkId));

  let nextRevision = expectedRevision;
  let changedSections: Array<{ sectionId: SectionId; serialized: string; value: SectionValue }> = [];
  await runTransaction(db, async (transaction) => {
    const remoteMetaSnapshot = await transaction.get(sectionRefs.meta);
    const remoteMetaValue = remoteMetaSnapshot.exists()
      ? (remoteMetaSnapshot.data().value as { syncRevision?: unknown } | undefined)
      : undefined;
    const candidateRevision = Number(remoteMetaValue?.syncRevision);
    const remoteRevision = Number.isSafeInteger(candidateRevision) && candidateRevision >= 0 ? candidateRevision : 0;
    if (remoteRevision !== expectedRevision) throw new RemoteWriteConflictError();

    nextRevision = remoteRevision + 1;
    sections.meta = { ...(sections.meta as Record<string, unknown>), syncRevision: nextRevision };
    changedSections = sectionIds.flatMap((sectionId) => {
      const serialized = JSON.stringify(sections[sectionId]);
      if (serialized === lastPublishedSections.get(sectionId)) return [];
      return [{ sectionId, serialized, value: sections[sectionId] }];
    });

    changedSections.forEach(({ sectionId, value }) => transaction.set(sectionRefs[sectionId], {
      schemaVersion: 2, syncVersion: 3, value, updatedAt: serverTimestamp(), updatedBy: user.uid,
    }, { merge: true }));
    changedTaskChunks.forEach((chunk) => transaction.set(taskChunkDocRef(chunk.id), {
      schemaVersion: 2, syncVersion: 3, chunkIndex: chunk.index, chunkSize: TASK_CHUNK_SIZE,
      totalChunks: nextTaskChunks.length, value: chunk.tasks, updatedAt: serverTimestamp(), updatedBy: user.uid,
    }, { merge: true }));
    staleTaskChunkIds.forEach((chunkId) => transaction.delete(taskChunkDocRef(chunkId)));
    if (changedTaskOrder) transaction.set(taskChunkDocRef(changedTaskOrder.id), {
      schemaVersion: 2, syncVersion: 3, chunkIndex: changedTaskOrder.index, chunkSize: TASK_CHUNK_SIZE,
      totalChunks: nextTaskChunks.length, value: changedTaskOrder.tasks, updatedAt: serverTimestamp(), updatedBy: user.uid,
    }, { merge: true });
  });

  changedSections.forEach(({ sectionId, serialized }) => lastPublishedSections.set(sectionId, serialized));
  changedTaskChunks.forEach((chunk) => lastPublishedTaskChunks.set(chunk.id, chunk.serialized));
  staleTaskChunkIds.forEach((chunkId) => lastPublishedTaskChunks.delete(chunkId));
  if (changedTaskOrder) lastPublishedTaskChunks.set(changedTaskOrder.id, changedTaskOrder.serialized);
  knownTaskChunkIds = nextTaskChunkIds;
  return nextRevision;
};
