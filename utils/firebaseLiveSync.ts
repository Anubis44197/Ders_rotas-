import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { doc, getFirestore, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from 'firebase/firestore';

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

type SectionId = Exclude<keyof RemoteAppData, 'successPoints' | 'planningEngineSnapshot'> | 'meta';

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

const sectionIds = [
  'courses',
  'tasks',
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
  tasks: [],
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

const rememberKnownSection = (sectionId: SectionId, value: SectionValue) => {
  lastPublishedSections.set(sectionId, JSON.stringify(value));
};

const rememberKnownAppData = (appData: RemoteAppData) => {
  const sections = splitRemoteAppData(toPlainJson(appData));
  sectionIds.forEach((sectionId) => rememberKnownSection(sectionId, sections[sectionId]));
};

const toPlainJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value, (_key, entry) => {
  if (typeof entry === 'function') return undefined;
  return entry;
}));

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
  tasks: appData.tasks,
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

const assembleRemoteAppData = (sections: Map<SectionId, SectionValue>): RemoteAppData => {
  const meta = (sections.get('meta') || sectionDefaults.meta) as { successPoints?: number; planningEngineSnapshot?: unknown };
  return {
    courses: (sections.get('courses') || sectionDefaults.courses) as unknown[],
    tasks: (sections.get('tasks') || sectionDefaults.tasks) as unknown[],
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
  let latestUpdatedAt: string | null = null;
  let latestUpdatedBy: string | null = null;
  let hasSplitState = false;

  const emitSplitState = () => {
    if (loadedSections.size !== sectionIds.length || !hasSplitState) return;
    onRemoteData({
      appData: assembleRemoteAppData(sectionValues),
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

  const legacyUnsubscribe = onSnapshot(legacyStateRef, (snapshot) => {
    if (hasSplitState) return;
    if (!snapshot.exists()) {
      if (loadedSections.size === sectionIds.length) onRemoteMissing();
      return;
    }
    const data = snapshot.data() as { appData?: RemoteAppData; updatedAt?: { toDate?: () => Date } | string | null; updatedBy?: string | null };
    if (!data.appData) {
      if (loadedSections.size === sectionIds.length) onRemoteMissing();
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
    legacyUnsubscribe();
  };
};

export const publishRemoteAppData = async (appData: RemoteAppData) => {
  const user = await getCurrentUser();
  const sections = splitRemoteAppData(toPlainJson(appData));
  const writes = sectionIds.flatMap((sectionId) => {
    const serialized = JSON.stringify(sections[sectionId]);
    if (serialized === lastPublishedSections.get(sectionId)) return [];
    lastPublishedSections.set(sectionId, serialized);
    return setDoc(sectionRefs[sectionId], {
      schemaVersion: 2,
      syncVersion: 3,
      value: sections[sectionId],
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    }, { merge: true });
  });

  await Promise.all(writes);
};
