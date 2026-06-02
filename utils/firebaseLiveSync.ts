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
const stateRef = doc(db, 'families', 'ders-tak-main', 'state', 'current');

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

  return onSnapshot(stateRef, (snapshot) => {
    if (!snapshot.exists()) {
      onRemoteMissing();
      return;
    }
    const data = snapshot.data() as { appData?: RemoteAppData; updatedAt?: { toDate?: () => Date } | string | null; updatedBy?: string | null };
    if (!data.appData) {
      onRemoteMissing();
      return;
    }
    const updatedAt = typeof data.updatedAt === 'string'
      ? data.updatedAt
      : data.updatedAt?.toDate?.()?.toISOString?.() || null;
    onRemoteData({ appData: data.appData, updatedAt, updatedBy: data.updatedBy || null });
  }, (error) => onError(error));
};

export const publishRemoteAppData = async (appData: RemoteAppData) => {
  const user = await getCurrentUser();
  await setDoc(stateRef, {
    schemaVersion: 1,
    appData: toPlainJson(appData),
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  }, { merge: true });
};
