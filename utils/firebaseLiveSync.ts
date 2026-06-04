import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { collection, deleteDoc, doc, getFirestore, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from 'firebase/firestore';

export interface RemoteAppData {
  courses: unknown[];
  tasks: unknown[];
  performanceData: unknown[];
  rewards: unknown[];
  badges: unknown[];
  successPoints: number;
  curriculum: Record<string, unknown>;
  weeklySchedule: Record<string, unknown>;
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
}

type SectionId = Exclude<keyof RemoteAppData, 'successPoints' | 'planningEngineSnapshot' | 'tasks'> | 'meta';

type SectionValue = unknown[] | Record<string, unknown> | { successPoints: number; planningEngineSnapshot: unknown };

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
const db = getFirestore(app);
const familyId = 'ders-tak-main';
const legacyStateRef = doc(db, 'families', familyId, 'state', 'current');
const legacyTasksRef = doc(db, 'families', familyId, 'state', 'tasks');
const taskChunksRef = collection(db, 'families', familyId, 'taskChunks');
const taskChunkDocRef = (chunkId: string) => doc(db, 'families', familyId, 'taskChunks', chunkId);

const TASK_CHUNK_SIZE = 100;

const sectionIds = [
  'courses',
  'performanceData',
  'rewards',
  'badges',
  'curriculum',
  'weeklySchedule',
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

const getTaskChunkId = (index: number) => `chunk_${String(index).padStart(5, '0')}`;

const splitTaskChunks = (tasks: unknown[]) => {
  const chunks: Array<{ id: string; index: number; tasks: unknown[]; serialized: string }> = [];
  for (let index = 0; index * TASK_CHUNK_SIZE < tasks.length; index += 1) {
    const chunkTasks = tasks.slice(index * TASK_CHUNK_SIZE, (index + 1) * TASK_CHUNK_SIZE);
    chunks.push({
      id: getTaskChunkId(index),
      index,
      tasks: chunkTasks,
      serialized: JSON.stringify(chunkTasks),
    });
  }
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
  examRecords: appData.examRecords,
  compositeExamResults: appData.compositeExamResults,
  examScheduleEntries: appData.examScheduleEntries,
  studyPlans: appData.studyPlans,
  meta: {
    successPoints: appData.successPoints,
    planningEngineSnapshot: appData.planningEngineSnapshot,
  },
});

const assembleRemoteAppData = (sections: Map<SectionId, SectionValue>, tasks: unknown[]): RemoteAppData => {
  const meta = (sections.get('meta') || sectionDefaults.meta) as { successPoints?: number; planningEngineSnapshot?: unknown };
  return {
    courses: (sections.get('courses') || sectionDefaults.courses) as unknown[],
    tasks,
    performanceData: (sections.get('performanceData') || sectionDefaults.performanceData) as unknown[],
    rewards: (sections.get('rewards') || sectionDefaults.rewards) as unknown[],
    badges: (sections.get('badges') || sectionDefaults.badges) as unknown[],
    successPoints: typeof meta.successPoints === 'number' ? meta.successPoints : 0,
    curriculum: (sections.get('curriculum') || sectionDefaults.curriculum) as Record<string, unknown>,
    weeklySchedule: (sections.get('weeklySchedule') || sectionDefaults.weeklySchedule) as Record<string, unknown>,
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
    });
  };

  const unsubscribes = sectionIds.map((sectionId) => onSnapshot(sectionRefs[sectionId], (snapshot) => {
    loadedSections.add(sectionId);
    if (snapshot.exists()) {
      const data = snapshot.data() as { value?: SectionValue; updatedAt?: { toDate?: () => Date } | string | null; updatedBy?: string | null };
      const value = data.value ?? sectionDefaults[sectionId];
      sectionValues.set(sectionId, value);
      rememberKnownSection(sectionId, value);
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
      chunkTasks = docs.flatMap((entry) => entry.value);
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
    });
  }, (error) => onError(error));

  return () => {
    unsubscribes.forEach((unsubscribe) => unsubscribe());
    taskChunksUnsubscribe();
    legacyTasksUnsubscribe();
    legacyUnsubscribe();
  };
};

export const publishRemoteAppData = async (appData: RemoteAppData) => {
  const user = await getCurrentUser();
  const plainAppData = toPlainJson(appData);
  const sections = splitRemoteAppData(plainAppData);
  const sectionWrites = sectionIds.flatMap((sectionId) => {
    const serialized = JSON.stringify(sections[sectionId]);
    if (serialized === lastPublishedSections.get(sectionId)) return [];
    return {
      sectionId,
      serialized,
      write: setDoc(sectionRefs[sectionId], {
        schemaVersion: 2,
        syncVersion: 3,
        value: sections[sectionId],
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      }, { merge: true }),
    };
  });

  const nextTaskChunks = splitTaskChunks(asArray(plainAppData.tasks));
  const nextTaskChunkIds = new Set(nextTaskChunks.map((chunk) => chunk.id));
  const taskChunkWrites = nextTaskChunks.flatMap((chunk) => {
    if (chunk.serialized === lastPublishedTaskChunks.get(chunk.id)) return [];
    return {
      chunkId: chunk.id,
      serialized: chunk.serialized,
      write: setDoc(taskChunkDocRef(chunk.id), {
        schemaVersion: 2,
        syncVersion: 3,
        chunkIndex: chunk.index,
        chunkSize: TASK_CHUNK_SIZE,
        totalChunks: nextTaskChunks.length,
        value: chunk.tasks,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      }, { merge: true }),
    };
  });
  const staleTaskChunkDeletes = [...knownTaskChunkIds]
    .filter((chunkId) => !nextTaskChunkIds.has(chunkId))
    .map((chunkId) => ({ chunkId, write: deleteDoc(taskChunkDocRef(chunkId)) }));

  await Promise.all(sectionWrites.map(async ({ sectionId, serialized, write }) => {
    await write;
    lastPublishedSections.set(sectionId, serialized);
  }));

  await Promise.all(taskChunkWrites.map(async ({ chunkId, serialized, write }) => {
    await write;
    lastPublishedTaskChunks.set(chunkId, serialized);
  }));

  await Promise.all(staleTaskChunkDeletes.map(async ({ chunkId, write }) => {
    await write;
    lastPublishedTaskChunks.delete(chunkId);
  }));

  knownTaskChunkIds = nextTaskChunkIds;
};
