import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ParentLockScreen from './components/parent/ParentLockScreen';
import ParentAnalysisShell from './components/parent/ParentAnalysisShell';
import {
  UserType,
  Course,
  Task,
  TaskLiveSession,
  PerformanceData,
  ExamRecord,
  CompositeExamResult,
  TaskCompletionData,
  Reward,
  Badge,
  ReportData,
  SubjectCurriculum,
  WeeklySchedule,
  WeeklyScheduleDay,
  WeeklyScheduleSlot,
  SchoolTopicHistoryEntry,
  ExamScheduleEntry,
  StoredStudyPlan,
  StudyPlan,
  SubjectPlan,
  PlanningEngineSnapshot,
  ScheduleDayRecord,
  ScheduleDayWindow,
  CurriculumTopicRecord,
  TopicStatusRecord,
  StudyPlanRecord,
  PlanBlockRecord,
  StudySessionRecord,
  AssessmentResultRecord,
  ReplanTriggerRecord,
  PlanBlockType,
  ParentDashboardProps,
} from './types';
import { GraduationCap, User, Users, BadgeCheck, Home, Sparkles, ClipboardList, BarChart, Menu, X, Bell, Settings, AlertTriangle, Lock, ChevronLeft, ChevronRight, ChevronDown, PlusCircle, BookOpen } from './components/icons';
import { ALL_ICONS } from './constants';
import { INITIAL_REAL_COURSES, INITIAL_REAL_CURRICULUM, INITIAL_REAL_PERFORMANCE } from './initialRealCurriculum';
import { calculateTaskPoints } from './utils/scoringAlgorithm';
import { getLocalDateString, getLocalWeekKey, parseDate } from './utils/dateUtils';
import { deriveAnalysisSnapshot } from './utils/analysisEngine';
import { getNotificationCooldownMs } from './utils/parentDecisionEngine';
import { isCompletedTask } from './utils/taskStatus';
import { getAccuracyPercent, getQuestionMetrics, getSolvedQuestionCount, getSuccessPercent, isQuestionTask } from './utils/questionMetrics';
import { playHaptic } from './utils/haptics';
import type { RemoteAppData } from './utils/firebaseLiveSync';
import { MAX_IMPORT_BYTES, validateImportDocument } from './utils/importValidation';
import { GoogleGenAI } from '@google/genai';

const lazyWithRetry = <T extends { default: React.ComponentType<any> }>(
  loader: () => Promise<T>,
  retries = 2,
  retryDelayMs = 400,
) => {
  const attempt = (remaining: number): Promise<T> => loader().catch((error) => {
    if (remaining <= 0) {
      throw error;
    }
    return new Promise<T>((resolve) => {
      setTimeout(() => resolve(attempt(remaining - 1)), retryDelayMs);
    });
  });
  return lazy(() => attempt(retries));
};

const ParentDashboard = lazyWithRetry(() => import('./components/parent/ParentDashboard'));
const ChildDashboard = lazyWithRetry(() => import('./components/child/ChildDashboard'));
const CurriculumManagerPanel = lazyWithRetry(() => import('./components/parent/CurriculumManagerPanel'));
const ParentOverviewWorkspace = lazyWithRetry(() => import('./components/parent/ParentOverviewWorkspace'));
const ParentCurriculumShowcaseWorkspace = lazyWithRetry(() => import('./components/parent/ParentCurriculumShowcaseWorkspace'));
const ParentPlanningWorkspace = lazyWithRetry(() => import('./components/parent/ParentPlanningWorkspace'));

const SCHEDULE_DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'] as const;
const legacyScheduleDayMap: Record<string, string> = {
  Sali: 'Salı',
  Carsamba: 'Çarşamba',
  Persembe: 'Perşembe',
};

const createScheduleSlot = (courseName: string, startTime: string, endTime: string, note?: string): WeeklyScheduleSlot => ({
  id: `slot_${courseName}_${startTime}_${endTime}`.replace(/\s+/g, '_').toLowerCase(),
  courseName,
  startTime,
  endTime,
  note,
});

const createEmptyScheduleDay = (): WeeklyScheduleDay => ({
  slots: [],
  availableWindows: [],
  confirmed: false,
});

const createPopulatedScheduleDay = (dayName: string): WeeklyScheduleDay => {
  const isWeekend = dayName === 'Cumartesi' || dayName === 'Pazar';
  if (isWeekend) {
    return {
      slots: [],
      availableWindows: [
        { id: `win_${dayName}_1`.toLowerCase(), startTime: '10:00', endTime: '12:30', quality: 'deep' },
        { id: `win_${dayName}_2`.toLowerCase(), startTime: '14:00', endTime: '16:30', quality: 'medium' },
        { id: `win_${dayName}_3`.toLowerCase(), startTime: '19:00', endTime: '21:00', quality: 'light' },
      ],
      confirmed: true,
    };
  }
  return {
    slots: [],
    availableWindows: [
      { id: `win_${dayName}_1`.toLowerCase(), startTime: '17:00', endTime: '19:00', quality: 'medium' },
      { id: `win_${dayName}_2`.toLowerCase(), startTime: '19:30', endTime: '21:30', quality: 'deep' },
    ],
    confirmed: true,
  };
};

const toMinutes = (value: string) => {
  const [hourText, minuteText] = value.split(':');
  return Number(hourText) * 60 + Number(minuteText);
};

const fromMinutes = (value: number) => {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${`${hour}`.padStart(2, '0')}:${`${minute}`.padStart(2, '0')}`;
};

const defaultWeeklySchedule: WeeklySchedule = Object.fromEntries(
  SCHEDULE_DAYS.map((day) => [day, createPopulatedScheduleDay(day)]),
) as WeeklySchedule;

const isLegacySampleSchedule = (schedule: WeeklySchedule) => {
  const dayEntries = SCHEDULE_DAYS.map((day) => schedule[day]);
  const schoolBlocks = dayEntries.flatMap((day) => Array.isArray(day?.slots) ? day.slots : []);
  const studyWindows = dayEntries.flatMap((day) => Array.isArray(day?.availableWindows) ? day.availableWindows : []);
  const confirmedDays = dayEntries.filter((day) => day?.confirmed).length;
  const normalizedTimes = schoolBlocks.map((slot) => slot.startTime + '-' + slot.endTime).sort();

  return schoolBlocks.length === 9
    && studyWindows.length === 0
    && confirmedDays === 5
    && normalizedTimes.filter((value) => value === '09:00-10:00').length === 5
    && normalizedTimes.filter((value) => value === '10:00-11:00').length === 4;
};

const defaultPlanningEngineSnapshot: PlanningEngineSnapshot = {
  scheduleDays: [],
  curriculumTopics: [],
  examSchedules: [],
  topicStatuses: [],
  studyPlanRecords: [],
  planBlockRecords: [],
  studySessions: [],
  assessmentResults: [],
  replanTriggers: [],
};

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error';
  actionLabel?: string;
  onAction?: () => void;
}

type ParentWorkspaceView = 'overview' | 'curriculum-panel' | 'planning' | 'analysis';
type OverviewStudyPeriod = 'week1' | 'week3' | 'month' | 'quarter' | 'total';

interface ObservabilityEvent {
  id: string;
  ts: string;
  type:
    | 'analysis_snapshot'
    | 'analysis_runtime_error'
    | 'notification_queue'
    | 'notification_action'
    | 'settings_change'
    | 'decision_tuning_change'
    | 'rollout_mode_change'
    | 'background_recompute'
    | 'event_pipeline';
  sourceEventId?: string | null;
  meta: Record<string, string | number | boolean | null>;
}

interface AnalysisPipelineState {
  processedSourceEventIds: string[];
  lastBackgroundRecomputeAt: string | null;
  lastDailySummaryAt: string | null;
  lastWeeklySummaryAt: string | null;
  cacheVersion: number;
  cacheHits: number;
  cacheMisses: number;
}


const WorkspaceLoadingFallback: React.FC<{ label?: string }> = ({ label = 'Yukleniyor...' }) => (
  <div className="ios-card rounded-[24px] p-4 text-sm font-semibold text-slate-600">
    {label}
  </div>
);

const normalizeParentWorkspaceView = (value: unknown): ParentWorkspaceView => {
  if (value === 'overview' || value === 'curriculum-panel' || value === 'planning' || value === 'analysis') return value;
  if (value === 'tasks' || value === 'exams') return 'planning';
  return 'overview';
};

const Modal: React.FC<{ show: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ show, onClose, title, children }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="ios-card dr-compact-modal w-[min(26rem,calc(100vw-1.5rem))] p-4" role="dialog" aria-modal="true" aria-labelledby="app-modal-title" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 id="app-modal-title" className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="ios-button flex h-9 w-9 items-center justify-center rounded-full text-2xl font-light text-slate-500 hover:text-slate-800" title="Kapat" aria-label="Kapat">
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

const APP_IDB_NAME = 'dersrotasi-app-state-v1';
const APP_IDB_STORE = 'kv';
const IDB_BACKED_STATE_KEYS = new Set<string>([
  'tasks',
  'curriculum',
  'examScheduleEntries',
  'examRecords',
  'compositeExamResults',
  'studyPlans',
  'planningEngineSnapshot',
  'performanceData',
  'observabilityEvents',
]);
const STORAGE_MARKER_FIELD = '__drStorage';
const STORAGE_MARKER_VALUE = 'idb';

type IdbStorageMarker = {
  __drStorage: 'idb';
  version: 1;
  updatedAt: number;
};

let stickyStateDbPromise: Promise<IDBDatabase> | null = null;

const shouldPersistInIndexedDb = (key: string) => IDB_BACKED_STATE_KEYS.has(key);

const isIdbStorageMarker = (value: unknown): value is IdbStorageMarker => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
  && (value as Record<string, unknown>)[STORAGE_MARKER_FIELD] === STORAGE_MARKER_VALUE
);

const createIdbStorageMarker = (): IdbStorageMarker => ({
  __drStorage: 'idb',
  version: 1,
  updatedAt: Date.now(),
});

const openStickyStateDb = (): Promise<IDBDatabase> => {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (stickyStateDbPromise) return stickyStateDbPromise;

  stickyStateDbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(APP_IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(APP_IDB_STORE)) {
        db.createObjectStore(APP_IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
  });

  return stickyStateDbPromise;
};

const readIndexedDbValue = async (key: string): Promise<unknown | undefined> => {
  const db = await openStickyStateDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(APP_IDB_STORE, 'readonly');
    const store = tx.objectStore(APP_IDB_STORE);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result === undefined ? undefined : request.result);
    request.onerror = () => reject(request.error || new Error(`IndexedDB read failed: ${key}`));
  });
};

const writeIndexedDbValue = async (key: string, value: unknown): Promise<void> => {
  const db = await openStickyStateDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(APP_IDB_STORE, 'readwrite');
    const store = tx.objectStore(APP_IDB_STORE);
    const request = store.put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error(`IndexedDB write failed: ${key}`));
  });
};

const deleteIndexedDbValue = async (key: string): Promise<void> => {
  if (!shouldPersistInIndexedDb(key)) return;
  const db = await openStickyStateDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(APP_IDB_STORE, 'readwrite');
    const store = tx.objectStore(APP_IDB_STORE);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error(`IndexedDB delete failed: ${key}`));
  });
};

const clearIndexedDbKeys = async (keys: string[]) => {
  const targets = keys.filter((key) => shouldPersistInIndexedDb(key));
  if (!targets.length) return;
  await Promise.all(targets.map((key) => deleteIndexedDbValue(key)));
};

function useStickyState<T>(defaultValue: T, key: string, normalize?: (value: unknown) => T): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const sanitize = useCallback((input: unknown): T => {
    if (normalize) return normalize(input);
    return input as T;
  }, [normalize]);

  const persistInIndexedDb = shouldPersistInIndexedDb(key);

  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === null) return sanitize(defaultValue);
      const parsed = JSON.parse(stored);
      if (isIdbStorageMarker(parsed)) {
        return sanitize(defaultValue);
      }
      return sanitize(parsed);
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return sanitize(defaultValue);
    }
  });
  const [idbHydrated, setIdbHydrated] = useState(() => !persistInIndexedDb);

  useEffect(() => {
    if (!persistInIndexedDb) return;
    if (isE2ESeedLockActive()) {
      setIdbHydrated(true);
      return;
    }
    let active = true;
    (async () => {
      try {
        const stored = await readIndexedDbValue(key);
        if (!active) return;
        if (stored !== undefined) {
          setValue((prevValue) => {
            const nextValue = sanitize(stored);
            return JSON.stringify(nextValue) === JSON.stringify(prevValue) ? prevValue : nextValue;
          });
        }
      } catch (error) {
        console.error(`Error reading IndexedDB key "${key}":`, error);
      } finally {
        if (active) setIdbHydrated(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [key, persistInIndexedDb, sanitize]);

  const setSafeValue = useCallback<React.Dispatch<React.SetStateAction<T>>>((nextValue) => {
    setValue((prevValue) => {
      const resolvedValue = typeof nextValue === 'function'
        ? (nextValue as (prevState: T) => T)(prevValue)
        : nextValue;
      const nextSafeValue = sanitize(resolvedValue);
      return JSON.stringify(nextSafeValue) === JSON.stringify(prevValue) ? prevValue : nextSafeValue;
    });
  }, [sanitize]);

  useEffect(() => {
    if (persistInIndexedDb && !idbHydrated) return;
    if (isE2ESeedLockActive()) return;
    try {
      if (persistInIndexedDb) {
        void writeIndexedDbValue(key, value)
          .then(() => {
            window.localStorage.setItem(key, JSON.stringify(createIdbStorageMarker()));
          })
          .catch((error) => {
            console.error(`Error setting IndexedDB key "${key}":`, error);
          });
        return;
      }
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [idbHydrated, key, persistInIndexedDb, value]);

  return [value, setSafeValue, idbHydrated];
}

const normalizeCourseRecord = (course: unknown, index: number): Course | null => {
  if (!course || typeof course !== 'object') return null;
  const candidate = course as Partial<Course>;
  if (typeof candidate.id !== 'string' || !candidate.id || typeof candidate.name !== 'string' || !candidate.name) return null;
  return {
    ...candidate,
    id: candidate.id,
    name: repairText(candidate.name) || candidate.name,
    active: typeof candidate.active === 'boolean' ? candidate.active : true,
    order: Number.isFinite(Number(candidate.order)) ? Number(candidate.order) : index,
    icon: candidate.icon || ALL_ICONS[index % ALL_ICONS.length],
  };
};

const sortCourses = (items: Course[]) =>
  [...items].sort((left, right) => left.order - right.order || left.name.localeCompare(right.name, 'tr'));

const getActiveCourses = (items: Course[]) => sortCourses(items.filter((course) => course.active !== false));

const normalizeSafeCourses = (value: unknown): Course[] => {
  if (!Array.isArray(value)) return [];
  return sortCourses(value.map(normalizeCourseRecord).filter((course): course is Course => Boolean(course)));
};

const normalizeSafeTasks = (value: unknown): Task[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((task): task is Task => {
      if (!task || typeof task !== 'object') return false;
      const candidate = task as Task;
      if (typeof candidate.id !== 'string' || typeof candidate.title !== 'string') return false;

      const idLower = candidate.id.toLowerCase();
      const titleLower = candidate.title.toLowerCase();

      // Hortlayan test görevlerini engelle ve temizle
      if (
        !isE2EQaSeedingActive() && (
        idLower.startsWith('live_mini_') ||
        idLower.startsWith('qa_manual_') ||
        idLower.includes('live_mini') ||
        titleLower.includes('canl? test') ||
        titleLower.includes('soru ??zme') ||
        titleLower.includes('canli test') ||
        titleLower.includes('soru cozme') ||
        titleLower.includes('canlı test') ||
        titleLower.includes('soru çözme')
        )
      ) {
        return false;
      }

      return typeof candidate.courseId === 'string'
        && typeof candidate.dueDate === 'string';
    })
    .map(normalizeTask);
};

const getTaskMutationTime = (task: Task): number => {
  const updatedAt = task.updatedAt ? Date.parse(task.updatedAt) : Number.NaN;
  if (Number.isFinite(updatedAt)) return updatedAt;
  if (typeof task.completionTimestamp === 'number' && Number.isFinite(task.completionTimestamp)) return task.completionTimestamp;
  const createdAt = task.createdAt ? Date.parse(task.createdAt) : Number.NaN;
  return Number.isFinite(createdAt) ? createdAt : 0;
};

const mergeTasksByLatestMutation = (localTasks: Task[], remoteTasks: Task[]): Task[] => {
  const merged = new Map<string, Task>();
  remoteTasks.forEach((task) => merged.set(task.id, task));
  localTasks.forEach((localTask) => {
    const remoteTask = merged.get(localTask.id);
    if (!remoteTask || getTaskMutationTime(localTask) > getTaskMutationTime(remoteTask)) merged.set(localTask.id, localTask);
  });
  return [...merged.values()].sort((left, right) => getTaskMutationTime(right) - getTaskMutationTime(left));
};

const normalizeSafeRewards = (value: unknown): Reward[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((reward): reward is Reward => {
    if (!reward || typeof reward !== 'object') return false;
    const candidate = reward as Reward;
    return typeof candidate.id === 'string'
      && typeof candidate.name === 'string'
      && Number.isFinite(candidate.cost);
  });
};

const normalizeSafeBadges = (value: unknown): Badge[] => {
  if (!Array.isArray(value)) return [{ id: 'b1', name: 'İlk Adım', description: 'İlk görevini tamamladın!', icon: BadgeCheck }];
  const normalized = value
    .filter((badge): badge is Badge => Boolean(badge) && typeof badge === 'object' && typeof (badge as Badge).id === 'string')
    .map((badge) => ({
      ...badge,
      name: typeof badge.name === 'string' ? badge.name : 'Rozet',
      description: typeof badge.description === 'string' ? badge.description : 'Rozet açıklaması yakında.',
      icon: badge.icon || BadgeCheck,
    }));
  return normalized.length > 0 ? normalized : [{ id: 'b1', name: 'İlk Adım', description: 'İlk görevini tamamladın!', icon: BadgeCheck }];
};

const normalizeSafeCurriculum = (value: unknown): SubjectCurriculum => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as SubjectCurriculum;
};

const normalizeSafeArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : []);
const normalizeSafeNumberRecord = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => Number.isFinite(Number(entryValue)))
    .map(([entryKey, entryValue]) => [entryKey, Number(entryValue)] as const);
  return Object.fromEntries(entries);
};



const normalizeSafeObservabilityEvents = (value: unknown): ObservabilityEvent[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry, index) => {
      const candidate = entry as Partial<ObservabilityEvent>;
      return {
        id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `evt-legacy-${index}`,
        ts: typeof candidate.ts === 'string' ? candidate.ts : new Date().toISOString(),
        type: (candidate.type as ObservabilityEvent['type']) || 'analysis_snapshot',
        sourceEventId: typeof candidate.sourceEventId === 'string' ? candidate.sourceEventId : null,
        meta: candidate.meta && typeof candidate.meta === 'object' ? candidate.meta as Record<string, string | number | boolean | null> : {},
      };
    })
    .slice(-120);
};

const normalizeSafePipelineState = (value: unknown): AnalysisPipelineState => {
  const fallback: AnalysisPipelineState = {
    processedSourceEventIds: [],
    lastBackgroundRecomputeAt: null,
    lastDailySummaryAt: null,
    lastWeeklySummaryAt: null,
    cacheVersion: 1,
    cacheHits: 0,
    cacheMisses: 0,
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const candidate = value as Partial<AnalysisPipelineState>;
  return {
    processedSourceEventIds: Array.isArray(candidate.processedSourceEventIds)
      ? candidate.processedSourceEventIds.filter((item): item is string => typeof item === 'string').slice(-300)
      : [],
    lastBackgroundRecomputeAt: typeof candidate.lastBackgroundRecomputeAt === 'string' ? candidate.lastBackgroundRecomputeAt : null,
    lastDailySummaryAt: typeof candidate.lastDailySummaryAt === 'string' ? candidate.lastDailySummaryAt : null,
    lastWeeklySummaryAt: typeof candidate.lastWeeklySummaryAt === 'string' ? candidate.lastWeeklySummaryAt : null,
    cacheVersion: Number.isFinite(Number(candidate.cacheVersion)) ? Number(candidate.cacheVersion) : 1,
    cacheHits: Number.isFinite(Number(candidate.cacheHits)) ? Number(candidate.cacheHits) : 0,
    cacheMisses: Number.isFinite(Number(candidate.cacheMisses)) ? Number(candidate.cacheMisses) : 0,
  };
};

const normalizeSafeNumber = (value: unknown): number => {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
};

const deriveAnalysisSnapshotSafe = (
  tasks: Task[],
  courses: Course[],
  studyPlans: StoredStudyPlan[],
  examRecords: ExamRecord[],
  compositeExamResults: CompositeExamResult[],
) => {
  try {
    return {
      snapshot: deriveAnalysisSnapshot(tasks, courses, studyPlans, examRecords, compositeExamResults),
      runtimeError: null as string | null,
    };
  } catch (analysisError) {
    const message = analysisError instanceof Error ? analysisError.message : 'Bilinmeyen analiz hatasi';
    console.error('Parent analysis fallback triggered:', analysisError);
    return {
      snapshot: deriveAnalysisSnapshot([], courses, studyPlans, examRecords, compositeExamResults),
      runtimeError: `Analiz gecici olarak yenileniyor: ${message}`,
    };
  }
};

const academicStorageKeys = [
  'courses',
  'tasks',
  'curriculum',
  'weeklySchedule',
  'examScheduleEntries',
  'examRecords',
  'compositeExamResults',
  'studyPlans',
  'planningEngineSnapshot',
  'performanceData',
  'rewards',
  'successPoints',
  'badges',
  'resumeTaskId',
];

const legacyDemoSubjectKeys = new Set(['matematik', 'turkce', 'fen', 'fen bilimleri', 'sosyal bilgiler', 'ingilizce']);

const normalizeLegacyDemoText = (value: unknown) => String(value || '')
  .toLocaleLowerCase('tr-TR')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\u0131/g, 'i')
  .replace(/\u011f/g, 'g')
  .replace(/\u00fc/g, 'u')
  .replace(/\u015f/g, 's')
  .replace(/\u00f6/g, 'o')
  .replace(/\u00e7/g, 'c')
  .replace(/\s+/g, ' ')
  .trim();

const parseStorageJson = (key: string) => {
  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
};

const isLegacyDemoCourseList = (value: unknown) => {
  if (!Array.isArray(value) || value.length === 0 || value.length > 8) return false;
  const subjectKeys = value.map((course) => normalizeLegacyDemoText(course?.name));
  return subjectKeys.some((key) => legacyDemoSubjectKeys.has(key) && !retainedRealSubjectKeys.has(key))
    && subjectKeys.every((key) => legacyDemoSubjectKeys.has(key));
};

const isLegacyDemoCurriculum = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const subjectNames = Object.keys(value);
  if (subjectNames.length === 0 || subjectNames.length > 8) return false;
  const subjectKeys = subjectNames.map(normalizeLegacyDemoText);
  return subjectKeys.some((key) => legacyDemoSubjectKeys.has(key) && !retainedRealSubjectKeys.has(key))
    && subjectKeys.every((key) => legacyDemoSubjectKeys.has(key));
};

const retainedRealSubjectKeys = new Set([
  'matematik',
  'turkce',
  'fen bilgisi',
  'fen bilimleri',
  't.c. inkilap tarihi ve ataturkculuk',
  'din kulturu ve ahlak bilgisi',
  'ingilizce'
]);
const shouldPruneLegacySubject = (value: unknown) => {
  const key = normalizeLegacyDemoText(value);
  return legacyDemoSubjectKeys.has(key) && !retainedRealSubjectKeys.has(key);
};
const isRetainedRealSubject = (value: unknown) => retainedRealSubjectKeys.has(normalizeLegacyDemoText(value));

const pruneLegacyDemoSubjects = () => {
  if (typeof window === 'undefined') return;
  if (isE2EBulkSeedMode() || isE2EQaSeedingActive()) return;
  const migrationKey = 'drLegacyDemoSubjectsPrunedV1';
  if (window.localStorage.getItem(migrationKey) === 'true') return;

  const coursesPayload = parseStorageJson('courses');
  const curriculumPayload = parseStorageJson('curriculum');
  const hasRetainedSubject = (Array.isArray(coursesPayload) && coursesPayload.some((course) => isRetainedRealSubject(course?.name)))
    || (curriculumPayload && typeof curriculumPayload === 'object' && !Array.isArray(curriculumPayload) && Object.keys(curriculumPayload).some(isRetainedRealSubject));

  if (!hasRetainedSubject) return;

  const keptCourseIds = new Set<string>();
  if (Array.isArray(coursesPayload)) {
    const byName = new Map<string, any>();
    coursesPayload.forEach((course) => {
      if (!course || typeof course !== 'object' || shouldPruneLegacySubject(course.name)) return;
      const key = normalizeLegacyDemoText(course.name);
      if (!byName.has(key)) byName.set(key, course);
    });
    const nextCourses = [...byName.values()];
    nextCourses.forEach((course) => {
      if (typeof course?.id === 'string') keptCourseIds.add(course.id);
    });
    window.localStorage.setItem('courses', JSON.stringify(nextCourses));
  }

  if (curriculumPayload && typeof curriculumPayload === 'object' && !Array.isArray(curriculumPayload)) {
    const nextCurriculum = Object.fromEntries(
      Object.entries(curriculumPayload).filter(([subject]) => !shouldPruneLegacySubject(subject)),
    );
    window.localStorage.setItem('curriculum', JSON.stringify(nextCurriculum));
  }

  const filterCourseItems = (key: string) => {
    const payload = parseStorageJson(key);
    if (!Array.isArray(payload)) return;
    window.localStorage.setItem(key, JSON.stringify(payload.filter((item) => (
      (!item?.courseName || !shouldPruneLegacySubject(item.courseName))
      && (!item?.courseId || keptCourseIds.size === 0 || keptCourseIds.has(item.courseId))
    ))));
  };

  ['tasks', 'performanceData', 'examRecords', 'examScheduleEntries'].forEach(filterCourseItems);

  const compositePayload = parseStorageJson('compositeExamResults');
  if (Array.isArray(compositePayload)) {
    const nextComposite = compositePayload
      .map((result) => ({
        ...result,
        courses: Array.isArray(result?.courses)
          ? result.courses.filter((course: any) => (
              !shouldPruneLegacySubject(course?.courseName)
              && (!course?.courseId || keptCourseIds.size === 0 || keptCourseIds.has(course.courseId))
            ))
          : [],
      }))
      .filter((result) => result.courses.length > 0);
    window.localStorage.setItem('compositeExamResults', JSON.stringify(nextComposite));
  }

  const schedulePayload = parseStorageJson('weeklySchedule');
  if (schedulePayload && typeof schedulePayload === 'object' && !Array.isArray(schedulePayload)) {
    const nextSchedule = Object.fromEntries(Object.entries(schedulePayload).map(([day, value]: [string, any]) => [
      day,
      {
        ...value,
        slots: Array.isArray(value?.slots) ? value.slots.filter((slot: any) => !shouldPruneLegacySubject(slot?.courseName)) : [],
      },
    ]));
    window.localStorage.setItem('weeklySchedule', JSON.stringify(nextSchedule));
  }

  const studyPlansPayload = parseStorageJson('studyPlans');
  if (Array.isArray(studyPlansPayload)) {
    const nextStudyPlans = studyPlansPayload
      .map((plan) => ({
        ...plan,
        plan: plan?.plan && typeof plan.plan === 'object' && !Array.isArray(plan.plan)
          ? Object.fromEntries(Object.entries(plan.plan).filter(([subject]) => !shouldPruneLegacySubject(subject)))
          : {},
      }))
      .filter((plan) => Object.keys(plan.plan).length > 0);
    window.localStorage.setItem('studyPlans', JSON.stringify(nextStudyPlans));
  }

  window.localStorage.removeItem('planningEngineSnapshot');
  window.localStorage.setItem(migrationKey, 'true');
};

const purgeLegacyDemoData = () => {
  if (typeof window === 'undefined') return;
  if (isE2EBulkSeedMode() || isE2EQaSeedingActive()) return;
  const coursesPayload = parseStorageJson('courses');
  const curriculumPayload = parseStorageJson('curriculum');
  const schedulePayload = parseStorageJson('weeklySchedule');
  const shouldPurge = isLegacyDemoCourseList(coursesPayload)
    || isLegacyDemoCurriculum(curriculumPayload)
    || Boolean(schedulePayload && isLegacySampleSchedule(normalizeWeeklySchedule(schedulePayload)));

  if (!shouldPurge) return;

  academicStorageKeys.forEach((key) => window.localStorage.removeItem(key));
  void clearIndexedDbKeys(academicStorageKeys);
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith('timerState_'))
    .forEach((key) => window.localStorage.removeItem(key));
};

const runCleanLiveTestDataMigration = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('drCleanLiveTestDataV3', 'disabled');
};

const normalizeSafeBoolean = (value: unknown): boolean => value === true;

const normalizePlanningEngineSnapshot = (value: unknown): PlanningEngineSnapshot => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaultPlanningEngineSnapshot;
  const candidate = value as Partial<PlanningEngineSnapshot>;
  return {
    scheduleDays: normalizeSafeArray<ScheduleDayRecord>(candidate.scheduleDays),
    curriculumTopics: normalizeSafeArray<CurriculumTopicRecord>(candidate.curriculumTopics),
    examSchedules: normalizeSafeArray<ExamScheduleEntry>(candidate.examSchedules),
    topicStatuses: normalizeSafeArray<TopicStatusRecord>(candidate.topicStatuses),
    studyPlanRecords: normalizeSafeArray<StudyPlanRecord>(candidate.studyPlanRecords),
    planBlockRecords: normalizeSafeArray<PlanBlockRecord>(candidate.planBlockRecords),
    studySessions: normalizeSafeArray<StudySessionRecord>(candidate.studySessions),
    assessmentResults: normalizeSafeArray<AssessmentResultRecord>(candidate.assessmentResults),
    replanTriggers: normalizeSafeArray<ReplanTriggerRecord>(candidate.replanTriggers),
  };
};

const isMojibakeCodePoint = (codePoint: number, nextCodePoint?: number) => {
  if (codePoint === 0xfffd) return true;
  const isLeadByte = codePoint === 0x00c2 || codePoint === 0x00c3 || codePoint === 0x00c4 || codePoint === 0x00c5;
  if (isLeadByte && nextCodePoint !== undefined) {
    return nextCodePoint >= 0x0080 && nextCodePoint <= 0x00bf;
  }
  return codePoint === 0x00e2 && (nextCodePoint === 0x20ac || nextCodePoint === 0x0080 || nextCodePoint === 0x0099);
};

const hasMojibake = (value: string) => {
  const codePoints = Array.from(value).map((char) => char.codePointAt(0) ?? 0);
  return codePoints.some((codePoint, index) => isMojibakeCodePoint(codePoint, codePoints[index + 1]));
};

const repairText = (value?: string) => {
  if (typeof value !== 'string' || !value) return value;

  let next = value;
  for (let i = 0; i < 3; i += 1) {
    if (!hasMojibake(next)) break;
    try {
      const bytes = Uint8Array.from(Array.from(next).map((char) => char.charCodeAt(0) & 0xff));
      const repaired = new TextDecoder('utf-8').decode(bytes);
      if (!repaired || repaired === next) break;
      next = repaired;
    } catch {
      break;
    }
  }

  return next;
};

const looksCorrupted = (value?: string) => typeof value === 'string' && hasMojibake(value);

const normalizeForLookup = (value: string) =>
  value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, ' ')
    .trim();

const repairedText = (value: unknown) => repairText(String(value ?? '')) || '';

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

type RiskLevel = 'dusuk' | 'orta' | 'yuksek';

const riskLevelMeta: Record<RiskLevel, { label: string; tone: string; badge: string }> = {
  dusuk: {
    label: 'Rahat takip',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  orta: {
    label: 'Dengeli destek',
    tone: 'border-amber-200 bg-amber-50 text-amber-800',
    badge: 'bg-amber-100 text-amber-700',
  },
  yuksek: {
    label: 'Yakin takip',
    tone: 'border-rose-200 bg-rose-50 text-rose-800',
    badge: 'bg-rose-100 text-rose-700',
  },
};

const toDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getTaskCompletionSortValue = (task: Pick<Task, 'completionTimestamp' | 'completionDate'>) => {
  if (typeof task.completionTimestamp === 'number' && Number.isFinite(task.completionTimestamp) && task.completionTimestamp > 0) {
    return task.completionTimestamp;
  }

  const completionDate = toDate(task.completionDate);
  if (!completionDate) return 0;
  completionDate.setHours(23, 59, 59, 999);
  return completionDate.getTime();
};

const getTaskCompletionLabel = (task: Pick<Task, 'completionTimestamp' | 'completionDate'>) => {
  if (task.completionDate) return task.completionDate;
  if (typeof task.completionTimestamp === 'number' && Number.isFinite(task.completionTimestamp) && task.completionTimestamp > 0) {
    const completionDate = new Date(task.completionTimestamp);
    if (!Number.isNaN(completionDate.getTime())) {
      return completionDate.toLocaleDateString('tr-TR');
    }
  }
  return 'Tarih yok';
};

const getOverviewPeriodStartDate = (period: OverviewStudyPeriod, today: string) => {
  if (period === 'total') return null;
  const endDate = toDate(today);
  if (!endDate) return null;
  const startDate = new Date(endDate);
  const lookbackDays = period === 'week1'
    ? 6
    : period === 'week3'
      ? 20
      : period === 'month'
        ? 29
        : 89;
  startDate.setDate(startDate.getDate() - lookbackDays);
  return startDate;
};

const getOverviewPeriodLookbackDays = (period: OverviewStudyPeriod) => {
  if (period === 'week1') return 7;
  if (period === 'week3') return 21;
  if (period === 'month') return 30;
  if (period === 'quarter') return 90;
  return 0;
};

const getOverviewComparisonLabel = (period: OverviewStudyPeriod) => {
  if (period === 'month') return 'aya';
  if (period === 'quarter') return '3 aya';
  if (period === 'total') return 'eş döneme';
  return 'haftaya';
};

const getOverviewSparklinePointCount = (period: OverviewStudyPeriod) => {
  if (period === 'week1' || period === 'week3') return 7;
  if (period === 'month') return 10;
  return 12;
};

const isTaskWithinRange = (task: Task, startDate: Date | null, endDate: Date | null) => {
  if (!task.completionDate) return false;
  const completionDate = toDate(task.completionDate);
  if (!completionDate) return false;
  if (startDate && completionDate < startDate) return false;
  if (endDate && completionDate > endDate) return false;
  return true;
};

const calculateFocusAverageForTasks = (tasks: Task[]) => {
  const focusTasks = tasks.filter((task) => typeof task.focusScore === 'number');
  if (focusTasks.length === 0) return null;
  return Math.round(focusTasks.reduce((sum, task) => sum + (task.focusScore || 0), 0) / focusTasks.length);
};

const calculateAccuracyTrendForTasks = (tasks: Task[]) => {
  const questionSessions = tasks
    .filter((task) => isQuestionTask(task) && getQuestionMetrics(task).answeredCount > 0 && task.completionDate)
    .map((task) => ({
      completionDate: task.completionDate!,
      accuracy: getAccuracyPercent(task),
    }))
    .sort((a, b) => a.completionDate.localeCompare(b.completionDate));

  if (questionSessions.length < 2) {
    return { direction: 'flat' as const, delta: 0, baseline: null as number | null, recent: null as number | null, sampleSize: questionSessions.length };
  }

  const midpoint = Math.ceil(questionSessions.length / 2);
  const baselineSessions = questionSessions.slice(0, midpoint);
  const recentSessions = questionSessions.slice(midpoint);
  const baseline = Math.round(baselineSessions.reduce((sum, item) => sum + item.accuracy, 0) / baselineSessions.length);
  const recent = recentSessions.length > 0
    ? Math.round(recentSessions.reduce((sum, item) => sum + item.accuracy, 0) / recentSessions.length)
    : baseline;
  const delta = recent - baseline;
  const direction = delta >= 6 ? 'up' : delta <= -6 ? 'down' : 'flat';
  return { direction, delta, baseline, recent, sampleSize: questionSessions.length };
};

const calculateOverdueRate = (tasks: Task[], today: string) => {
  const waitingTasks = tasks.filter((task) => task.status === 'bekliyor');
  if (waitingTasks.length === 0) return 0;
  const overdueCount = waitingTasks.filter((task) => task.dueDate < today).length;
  return Math.round((overdueCount / waitingTasks.length) * 100);
};

const calculateRecentFocusAverage = (tasks: Task[], days: number, today: string) => {
  const endDate = toDate(today);
  if (!endDate) return null;
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));

  const focusSessions = tasks.filter((task) => {
    if (!isCompletedTask(task) || typeof task.focusScore !== 'number' || !task.completionDate) return false;
    const completion = toDate(task.completionDate);
    return Boolean(completion && completion >= startDate && completion <= endDate);
  });

  if (focusSessions.length === 0) return null;
  return Math.round(focusSessions.reduce((sum, item) => sum + (item.focusScore || 0), 0) / focusSessions.length);
};

const calculateAccuracyTrend14Days = (tasks: Task[], today: string) => {
  const endDate = toDate(today);
  if (!endDate) {
    return { direction: 'flat' as const, delta: 0, baseline: null as number | null, recent: null as number | null, sampleSize: 0 };
  }

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 13);

  const questionSessions = tasks
    .filter((task) => {
      if (!isCompletedTask(task) || !isQuestionTask(task) || !task.completionDate) return false;
      if (getQuestionMetrics(task).answeredCount <= 0) return false;
      const completion = toDate(task.completionDate);
      return Boolean(completion && completion >= startDate && completion <= endDate);
    })
    .map((task) => {
      const accuracy = getAccuracyPercent(task);
      return { completionDate: task.completionDate!, accuracy };
    })
    .sort((a, b) => a.completionDate.localeCompare(b.completionDate));

  if (questionSessions.length < 2) {
    return { direction: 'flat' as const, delta: 0, baseline: null as number | null, recent: null as number | null, sampleSize: questionSessions.length };
  }

  const midpoint = Math.ceil(questionSessions.length / 2);
  const baselineSessions = questionSessions.slice(0, midpoint);
  const recentSessions = questionSessions.slice(midpoint);
  const baseline = Math.round(baselineSessions.reduce((sum, item) => sum + item.accuracy, 0) / baselineSessions.length);
  const recent = recentSessions.length > 0
    ? Math.round(recentSessions.reduce((sum, item) => sum + item.accuracy, 0) / recentSessions.length)
    : baseline;
  const delta = recent - baseline;

  const direction = delta >= 6 ? 'up' : delta <= -6 ? 'down' : 'flat';
  return { direction, delta, baseline, recent, sampleSize: questionSessions.length };
};

const getRiskLevel = ({ overdueRate, focus7d, accuracyDelta, weakTopicCount }: { overdueRate: number; focus7d: number | null; accuracyDelta: number; weakTopicCount: number }): RiskLevel => {
  let score = 0;
  if (overdueRate >= 35) score += 2;
  else if (overdueRate >= 20) score += 1;

  if (focus7d !== null && focus7d < 60) score += 2;
  else if (focus7d !== null && focus7d < 72) score += 1;

  if (accuracyDelta <= -10) score += 2;
  else if (accuracyDelta < 0) score += 1;

  if (weakTopicCount >= 4) score += 2;
  else if (weakTopicCount >= 2) score += 1;

  if (score >= 5) return 'yuksek';
  if (score >= 3) return 'orta';
  return 'dusuk';
};

const normalizeTaskType = (value: unknown): Task['taskType'] => {
  if (value === 'soru cozme' || value === 'soru çözme') return 'soru çözme';
  if (value === 'ders calisma' || value === 'ders çalışma') return 'ders çalışma';
  if (value === 'kitap okuma') return 'kitap okuma';
  return 'ders çalışma';
};

const normalizeOptionalNumber = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number | undefined => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.max(min, Math.min(max, numeric));
};

const normalizeOptionalInteger = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number | undefined => {
  const numeric = normalizeOptionalNumber(value, min, max);
  return typeof numeric === 'number' ? Math.round(numeric) : undefined;
};

const normalizeTaskLiveSession = (value: any): TaskLiveSession | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const status = value.status === 'paused' || value.status === 'break' ? value.status : 'running';
  const mainTime = normalizeOptionalInteger(value.mainTime, 0, 24 * 60 * 60) ?? 0;
  const breakTime = normalizeOptionalInteger(value.breakTime, 0, 24 * 60 * 60) ?? 0;
  const pauseTime = normalizeOptionalInteger(value.pauseTime, 0, 24 * 60 * 60) ?? 0;
  const updatedAt = normalizeOptionalInteger(value.updatedAt, 0, Number.MAX_SAFE_INTEGER) ?? Date.now();
  return {
    mainTime,
    breakTime,
    pauseTime,
    status,
    updatedAt,
    isPaused: Boolean(value.isPaused),
    pausedAt: normalizeOptionalInteger(value.pausedAt, 0, Number.MAX_SAFE_INTEGER),
    note: repairText(value.note) || undefined,
  };
};

const normalizeTask = (task: any): Task => {
  const rawStatus = task?.status as string | undefined;
  const normalizedStatus = rawStatus === 'tamamland\u0131' || rawStatus === 'tamamlandi' ? 'tamamland\u0131' : 'bekliyor';
  const normalizedType = normalizeTaskType(task?.taskType);
  const normalizedBookGenre = task?.bookGenre === 'Siir' ? '\u015eiir' : task?.bookGenre === 'Diger' ? 'Di\u011fer' : task?.bookGenre;
  const rawSelectedMetrics = Array.isArray(task?.selectedMetrics)
    ? task.selectedMetrics.filter((value: unknown): value is NonNullable<Task['selectedMetrics']>[number] => (
      value === 'accuracy' || value === 'focus' || value === 'duration' || value === 'revision' || value === 'completion'
    ))
    : [];
  const legacySelectedMetrics: Task['selectedMetrics'] = [
    Number.isFinite(Number(task?.targetAccuracy)) && Number(task?.targetAccuracy) > 0 ? 'accuracy' : null,
    Number.isFinite(Number(task?.targetFocus)) && Number(task?.targetFocus) > 0 ? 'focus' : null,
    Number.isFinite(Number(task?.minimumDuration)) && Number(task?.minimumDuration) > 0 ? 'duration' : null,
  ].filter((value): value is NonNullable<Task['selectedMetrics']>[number] => value !== null);
  const normalizedSelectedMetrics = Array.from(new Set([...(rawSelectedMetrics || []), ...(legacySelectedMetrics || [])]));
  const normalizedMetricTargetScore = normalizedSelectedMetrics.length > 0 ? 100 : undefined;
  const plannedDuration = normalizeOptionalInteger(task?.plannedDuration, 1, 600) ?? 30;
  const questionCount = normalizeOptionalInteger(task?.questionCount, 0, 1000);
  const correctCount = normalizeOptionalInteger(task?.correctCount, 0, questionCount || 1000);
  const incorrectCount = normalizeOptionalInteger(task?.incorrectCount, 0, questionCount || 1000);
  const emptyCount = normalizeOptionalInteger(task?.emptyCount, 0, questionCount || 1000);
  const actualDuration = normalizeOptionalInteger(task?.actualDuration, 0, 24 * 60 * 60);
  const breakTime = normalizeOptionalInteger(task?.breakTime, 0, 24 * 60 * 60);
  const pauseTime = normalizeOptionalInteger(task?.pauseTime, 0, 24 * 60 * 60);

  return {
    ...task,
    title: repairText(task?.title),
    description: repairText(task?.description),
    status: normalizedStatus,
    taskType: normalizedType,
    plannedDuration,
    questionCount: normalizedType === 'soru çözme' ? questionCount : undefined,
    correctCount,
    incorrectCount,
    emptyCount,
    actualDuration,
    breakTime,
    pauseTime,
    bookGenre: normalizedBookGenre,
    bookTitle: repairText(task?.bookTitle),
    planSource: task?.planSource ?? (task?.isSelfAssigned ? 'free-study' : undefined),
    planLabel: repairText(task?.planLabel) || undefined,
    completionDate: task?.completionDate ? String(task.completionDate) : undefined,
    curriculumUnitName: repairText(task?.curriculumUnitName) || undefined,
    curriculumTopicName: repairText(task?.curriculumTopicName) || undefined,
    taskGoalType: looksCorrupted(repairText(task?.taskGoalType)) ? 'ders calisma' : repairText(task?.taskGoalType) || undefined,
    selectedMetrics: normalizedSelectedMetrics.length > 0 ? normalizedSelectedMetrics : undefined,
    metricTargetScore: normalizedMetricTargetScore,
    targetAccuracy: Number.isFinite(Number(task?.targetAccuracy)) ? Number(task.targetAccuracy) : undefined,
    targetFocus: Number.isFinite(Number(task?.targetFocus)) ? Number(task.targetFocus) : undefined,
    minimumDuration: Number.isFinite(Number(task?.minimumDuration)) ? Number(task.minimumDuration) : undefined,
  } as Task;
};

const SCHOOL_TOPIC_HISTORY_LIMIT = 2500;

const normalizeSchoolTopicHistory = (value: unknown): SchoolTopicHistoryEntry[] => {
  const rows = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  return rows
    .map((item: any, index): SchoolTopicHistoryEntry | null => {
      const date = typeof item?.date === 'string' && item.date ? item.date : getLocalDateString();
      const dayName = repairedText(item?.dayName).trim();
      const slotId = String(item?.slotId || 'slot');
      const courseName = repairedText(item?.courseName).trim();
      const status = item?.status === 'not-covered' ? 'not-covered' : item?.status === 'covered' ? 'covered' : null;
      if (!dayName || !courseName || !status) return null;
      const createdAt = repairedText(item?.createdAt).trim() || new Date().toISOString();
      return {
        id: String(item?.id || `school_topic_${date}_${slotId}_${index}`),
        date,
        dayName,
        slotId,
        courseName,
        startTime: repairedText(item?.startTime).trim() || undefined,
        endTime: repairedText(item?.endTime).trim() || undefined,
        status,
        unitName: repairedText(item?.unitName).trim() || undefined,
        topicName: repairedText(item?.topicName).trim() || undefined,
        createdAt,
        source: item?.source === 'overview' ? 'overview' : 'planning',
      };
    })
    .filter((item): item is SchoolTopicHistoryEntry => Boolean(item))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .filter((item) => {
      const key = `${item.date}::${item.dayName}::${item.slotId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, SCHOOL_TOPIC_HISTORY_LIMIT);
};

const normalizeWeeklyScheduleSlot = (slot: any, fallbackIndex: number): WeeklyScheduleSlot => ({
  id: String(slot?.id || `slot_${fallbackIndex}_${slot?.courseName || slot?.label || 'ders'}`),
  courseName: repairedText(slot?.courseName ?? slot?.label).trim(),
  startTime: String(slot?.startTime ?? '09:00'),
  endTime: String(slot?.endTime ?? '10:00'),
  note: repairedText(slot?.note).trim() || undefined,
  schoolCurriculumStatus: slot?.schoolCurriculumStatus === 'covered' || slot?.schoolCurriculumStatus === 'not-covered' ? slot.schoolCurriculumStatus : undefined,
  schoolUnitName: repairedText(slot?.schoolUnitName).trim() || undefined,
  schoolTopicName: repairedText(slot?.schoolTopicName).trim() || undefined,
  schoolCurriculumUpdatedAt: repairedText(slot?.schoolCurriculumUpdatedAt).trim() || undefined,
});

const normalizeScheduleWindow = (window: any, fallbackIndex = 0): ScheduleDayWindow | null => {
  const startTime = String(window?.startTime ?? '').trim();
  const endTime = String(window?.endTime ?? '').trim();
  const quality = window?.quality === 'deep' || window?.quality === 'medium' || window?.quality === 'light'
    ? window.quality
    : 'medium';

  if (!startTime || !endTime || startTime >= endTime) return null;
  return {
    id: String(window?.id || `window_${fallbackIndex}_${startTime}_${endTime}_${quality}`),
    startTime,
    endTime,
    quality,
  };
};

const buildLegacyScheduleDay = (value: string): WeeklyScheduleDay => {
  const tokens = String(value || '')
    .split(',')
    .map((item) => repairedText(item).trim())
    .filter(Boolean);

  const slots = tokens.map((token, index) => {
    const startHour = 9 + index;
    const endHour = startHour + 1;
    return createScheduleSlot(token, `${`${startHour}`.padStart(2, '0')}:00`, `${`${endHour}`.padStart(2, '0')}:00`);
  });

  return {
    slots,
    availableWindows: [],
    confirmed: slots.length > 0,
  };
};

const seedInitialRealCurriculum = () => {
  if (typeof window === 'undefined') return;
  if (isE2EBulkSeedMode()) return;

  const coursesPayload = parseStorageJson('courses');
  const curriculumPayload = parseStorageJson('curriculum');
  const hasCourses = Array.isArray(coursesPayload) && coursesPayload.length > 0;
  const hasCurriculum = Boolean(
    isIdbStorageMarker(curriculumPayload)
    || (
      curriculumPayload
      && typeof curriculumPayload === 'object'
      && !Array.isArray(curriculumPayload)
      && Object.keys(curriculumPayload).length > 0
    ),
  );

  const hasAllRealCourses = Array.isArray(coursesPayload) &&
    INITIAL_REAL_COURSES.every(realCourse =>
      coursesPayload.some(c => normalizeLegacyDemoText(c?.name) === normalizeLegacyDemoText(realCourse.name))
    );
  const hasAllRealCurriculum = Boolean(
    isIdbStorageMarker(curriculumPayload)
    || (
      curriculumPayload
      && typeof curriculumPayload === 'object'
      && !Array.isArray(curriculumPayload)
      && INITIAL_REAL_COURSES.every(realCourse =>
        Object.keys(curriculumPayload).some(subj => normalizeLegacyDemoText(subj) === normalizeLegacyDemoText(realCourse.name))
      )
    )
  );

  const forceMathSeed = new URLSearchParams(window.location.search).get('reset') === 'math';
  const shouldReplaceWithRealMath = forceMathSeed
    || !hasCourses
    || !hasCurriculum
    || !hasAllRealCourses
    || !hasAllRealCurriculum
    || isLegacyDemoCourseList(coursesPayload)
    || isLegacyDemoCurriculum(curriculumPayload);

  if (!shouldReplaceWithRealMath) return;

  academicStorageKeys.forEach((key) => window.localStorage.removeItem(key));
  void clearIndexedDbKeys(academicStorageKeys);
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith('timerState_'))
    .forEach((key) => window.localStorage.removeItem(key));

  window.localStorage.setItem('courses', JSON.stringify(INITIAL_REAL_COURSES));
  window.localStorage.setItem('curriculum', JSON.stringify(INITIAL_REAL_CURRICULUM));
  window.localStorage.setItem('performanceData', JSON.stringify(INITIAL_REAL_PERFORMANCE));
  window.localStorage.setItem('successPoints', '0');
  window.localStorage.setItem('rewards', '[]');
};
const normalizeWeeklySchedule = (schedule: any): WeeklySchedule => {
  const nextEntries = SCHEDULE_DAYS.map((day) => {
    const legacyDay = Object.entries(legacyScheduleDayMap).find(([, currentDay]) => currentDay === day)?.[0];
    const rawDay = schedule?.[day] ?? (legacyDay ? schedule?.[legacyDay] : undefined);

    if (typeof rawDay === 'string') {
      return [day, buildLegacyScheduleDay(rawDay)] as const;
    }

    if (rawDay && typeof rawDay === 'object') {
      const slots = Array.isArray(rawDay.slots)
        ? rawDay.slots.map((slot: any, index: number) => normalizeWeeklyScheduleSlot(slot, index)).filter((slot: WeeklyScheduleSlot) => slot.courseName)
        : [];

      return [
        day,
        {
          slots,
          availableWindows: Array.isArray(rawDay.availableWindows)
            ? rawDay.availableWindows.map((window: any, index: number) => normalizeScheduleWindow(window, index)).filter((item: ScheduleDayWindow | null): item is ScheduleDayWindow => Boolean(item))
            : [],
          confirmed: Boolean(rawDay.confirmed) && (slots.length > 0 || (Array.isArray(rawDay.availableWindows) && rawDay.availableWindows.length > 0)),
        },
      ] as const;
    }

    return [day, createEmptyScheduleDay()] as const;
  });

  const normalized = Object.fromEntries(nextEntries) as WeeklySchedule;
  if (isLegacySampleSchedule(normalized)) {
    return defaultWeeklySchedule;
  }
  return normalized;
};

const getQueryParam = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(key);
};

const isE2EBulkSeedMode = () => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const isE2E = params.get('e2e') === '1';
  if (!isE2E) return false;
  const qaRecordsMode = params.get('qaRecords');
  const hasBulkSeedMarker = Boolean(window.localStorage.getItem('__bulk_seed_marker'));
  return hasBulkSeedMarker && (!qaRecordsMode || qaRecordsMode === 'none');
};

const isE2EQaSeedingActive = () => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const isE2E = params.get('e2e') === '1';
  if (!isE2E) return false;
  const qaRecordsMode = params.get('qaRecords');
  return qaRecordsMode && qaRecordsMode !== 'none';
};

const isE2ESeedLockActive = () => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('e2e') !== '1') return false;
  return window.localStorage.getItem('__qa_seed_lock') === '1';
};


const seedManualQaRecords = () => {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const isE2EMode = params.get('e2e') === '1';
  if (!isE2EMode) return;
  const qaRecordsMode = params.get('qaRecords');
  if (!qaRecordsMode || qaRecordsMode === 'none') return;

  window.localStorage.setItem('__qa_seed_lock', '1');
  window.localStorage.setItem('courses', JSON.stringify(INITIAL_REAL_COURSES));
  window.localStorage.setItem('curriculum', JSON.stringify(INITIAL_REAL_CURRICULUM));

  const syncQaSeedToIndexedDb = (next: {
    tasks: Task[];
    performanceData: PerformanceData[];
    examRecords: ExamRecord[];
    compositeExamResults: CompositeExamResult[];
  }) => {
    void Promise.all([
      writeIndexedDbValue('curriculum', INITIAL_REAL_CURRICULUM),
      writeIndexedDbValue('tasks', next.tasks),
      writeIndexedDbValue('performanceData', next.performanceData),
      writeIndexedDbValue('examRecords', next.examRecords),
      writeIndexedDbValue('compositeExamResults', next.compositeExamResults),
    ]).then(() => {
      window.localStorage.setItem('__qa_seed_lock', '0');
    }).catch((error) => {
      console.error('QA IndexedDB seed sync failed:', error);
      window.localStorage.setItem('__qa_seed_lock', '0');
    });
  };

  const today = new Date('2026-05-15T12:00:00');
  const iso = (date: Date) => getLocalDateString(date);
  const daysAgo = (count: number) => {
    const copy = new Date(today);
    copy.setDate(copy.getDate() - count);
    return iso(copy);
  };
  const atTime = (day: string, hour: number, minute = 0) => new Date(day + 'T' + String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + ':00').getTime();
  const courseByName = new Map(INITIAL_REAL_COURSES.map((course) => [course.name, course]));
  const pickTopic = (courseName: string, unitIndex: number, topicIndex: number) => {
    const units = INITIAL_REAL_CURRICULUM[courseName] || [];
    const unit = units[Math.min(unitIndex, Math.max(0, units.length - 1))];
    const topic = unit?.topics[Math.min(topicIndex, Math.max(0, (unit?.topics.length || 1) - 1))];
    return {
      course: courseByName.get(courseName) || INITIAL_REAL_COURSES[0],
      unitName: unit?.name || '1. Ünite',
      topicName: topic?.name || 'Konu',
    };
  };

  const specs = [
    ['Matematik', 0, 0, 'soru çözme', 'test-cozme', 30, 18, 8, 4, 42, 58, 70, 12, 9],
    ['Matematik', 1, 2, 'soru çözme', 'test-cozme', 24, 21, 2, 1, 88, 84, 40, 10, 16],
    ['Matematik', 3, 5, 'ders çalışma', 'ders calisma', 0, 0, 0, 0, 76, 81, 45, 13, 18],
    ['Matematik', 4, 4, 'ders çalışma', 'konu-tekrari', 0, 0, 0, 0, 52, 66, 35, 15, 20],
    ['Fen Bilgisi', 0, 1, 'soru çözme', 'test-cozme', 25, 15, 7, 3, 60, 70, 35, 16, 5],
    ['Fen Bilgisi', 1, 3, 'soru çözme', 'test-cozme', 32, 26, 4, 2, 81, 78, 40, 17, 25],
    ['Fen Bilgisi', 3, 0, 'ders çalışma', 'ders calisma', 0, 0, 0, 0, 73, 80, 45, 18, 35],
    ['Fen Bilgisi', 5, 7, 'ders çalışma', 'konu-tekrari', 0, 0, 0, 0, 49, 62, 30, 20, 45],
    ['Türkçe', 0, 0, 'soru çözme', 'test-cozme', 20, 13, 5, 2, 65, 71, 30, 19, 55],
    ['Türkçe', 1, 2, 'soru çözme', 'test-cozme', 28, 24, 3, 1, 86, 82, 35, 20, 65],
    ['Türkçe', 3, 0, 'ders çalışma', 'ders calisma', 0, 0, 0, 0, 72, 76, 40, 21, 75],
    ['Türkçe', 4, 2, 'ders çalışma', 'konu-tekrari', 0, 0, 0, 0, 55, 68, 35, 22, 85],
    ['T.C. İnkılap Tarihi ve Atatürkçülük', 1, 10, 'soru çözme', 'test-cozme', 18, 10, 6, 2, 56, 65, 30, 14, 15],
    ['T.C. İnkılap Tarihi ve Atatürkçülük', 2, 8, 'ders çalışma', 'ders calisma', 0, 0, 0, 0, 74, 78, 40, 17, 45],
    ['T.C. İnkılap Tarihi ve Atatürkçülük', 3, 12, 'ders çalışma', 'konu-tekrari', 0, 0, 0, 0, 61, 69, 35, 19, 50],
    ['Din Kültürü ve Ahlak Bilgisi', 0, 4, 'soru çözme', 'test-cozme', 16, 13, 2, 1, 82, 79, 25, 10, 25],
    ['Din Kültürü ve Ahlak Bilgisi', 1, 1, 'soru çözme', 'test-cozme', 16, 9, 5, 2, 56, 64, 25, 12, 35],
    ['Din Kültürü ve Ahlak Bilgisi', 3, 5, 'ders çalışma', 'ders calisma', 0, 0, 0, 0, 79, 83, 35, 15, 45],
    ['Ingilizce', 0, 0, 'soru çözme', 'test-cozme', 20, 17, 2, 1, 85, 80, 30, 16, 10],
    ['Ingilizce', 2, 0, 'soru çözme', 'test-cozme', 20, 11, 7, 2, 55, 66, 30, 18, 20],
    ['Ingilizce', 4, 0, 'ders çalışma', 'ders calisma', 0, 0, 0, 0, 76, 82, 40, 19, 30],
    ['Ingilizce', 6, 0, 'ders çalışma', 'konu-tekrari', 0, 0, 0, 0, 60, 72, 35, 21, 40],
    ['Matematik', 5, 4, 'soru çözme', 'test-cozme', 40, 23, 13, 4, 58, 63, 50, 22, 50],
    ['Fen Bilgisi', 6, 3, 'soru çözme', 'test-cozme', 36, 30, 4, 2, 83, 77, 45, 23, 55],
  ] as const;

  const tasks: Task[] = specs.map((spec, index) => {
    const [courseName, unitIndex, topicIndex, taskType, taskGoalType, questionCount, correctCount, incorrectCount, emptyCount, successScore, focusScore, plannedDuration, hour, minute] = spec;
    const picked = pickTopic(courseName, unitIndex, topicIndex);
    const day = daysAgo(index + 1);
    const isQuestion = taskType === 'soru çözme';
    const durationMinutes = plannedDuration || (isQuestion ? 30 : 40);
    const actualDuration = durationMinutes * 60 + ((index % 5) - 1) * 120;
    return {
      id: `qa_manual_${index + 1}`,
      courseId: picked.course.id,
      title: `${picked.course.name} - ${picked.topicName}`,
      description: `QA gerçek kayıt: uzun konu, grafik ve analiz kontrolü ${index + 1}`,
      dueDate: day,
      status: 'tamamlandı',
      taskType,
      taskGoalType,
      plannedDuration: durationMinutes,
      actualDuration: Math.max(600, actualDuration),
      breakTime: index % 4 === 0 ? 180 : 60,
      pauseTime: index % 3 === 0 ? 120 : 30,
      questionCount: isQuestion ? questionCount : undefined,
      correctCount: isQuestion ? correctCount : undefined,
      incorrectCount: isQuestion ? incorrectCount : undefined,
      emptyCount: isQuestion ? emptyCount : undefined,
      firstAttemptScore: isQuestion ? Math.max(20, successScore - (index % 10)) : undefined,
      selfAssessmentScore: Math.max(20, Math.min(100, successScore + ((index % 9) - 4))),
      confidenceGap: (index % 9) - 4,
      conceptErrorCount: isQuestion ? index % 5 : undefined,
      processErrorCount: isQuestion ? (index + 1) % 4 : undefined,
      attentionErrorCount: isQuestion ? (index + 2) % 6 : undefined,
      successScore,
      focusScore,
      pointsAwarded: Math.max(8, Math.round((successScore + focusScore) / 8)),
      completionDate: day,
      completionTimestamp: atTime(day, hour, minute),
      isSelfAssigned: index % 6 === 0,
      curriculumUnitName: picked.unitName,
      curriculumTopicName: picked.topicName,
    };
  });

  if (qaRecordsMode === 'low') {
    const lowTasks = tasks.slice(0, 2);
    const lowPerformance = INITIAL_REAL_PERFORMANCE.map((item) => {
      const courseTasks = lowTasks.filter((task) => task.courseId === item.courseId);
      return {
        ...item,
        correct: courseTasks.reduce((sum, task) => sum + (task.correctCount || 0), 0),
        incorrect: courseTasks.reduce((sum, task) => sum + (task.incorrectCount || 0), 0),
        timeSpent: Math.round(courseTasks.reduce((sum, task) => sum + (task.actualDuration || 0), 0) / 60),
      };
    });

    window.localStorage.setItem('tasks', JSON.stringify(lowTasks));
    window.localStorage.setItem('performanceData', JSON.stringify(lowPerformance));
    window.localStorage.setItem('examRecords', JSON.stringify([]));
    window.localStorage.setItem('compositeExamResults', JSON.stringify([]));
    window.localStorage.setItem('successPoints', String(lowTasks.reduce((sum, task) => sum + (task.pointsAwarded || 0), 0)));
    window.localStorage.setItem('userType', JSON.stringify(UserType.Parent));
    window.localStorage.setItem('isParentLocked', JSON.stringify(false));
    window.localStorage.setItem('parentWorkspaceView', JSON.stringify('analysis'));
    window.localStorage.setItem('parentDefaultView', JSON.stringify('analysis'));
    window.localStorage.setItem('__qa_manual_records_seeded_at', new Date().toISOString());
    syncQaSeedToIndexedDb({
      tasks: lowTasks,
      performanceData: lowPerformance,
      examRecords: [],
      compositeExamResults: [],
    });
    return;
  }

  if (qaRecordsMode === 'empty') {
    window.localStorage.setItem('tasks', JSON.stringify([]));
    window.localStorage.setItem('performanceData', JSON.stringify([]));
    window.localStorage.setItem('examRecords', JSON.stringify([]));
    window.localStorage.setItem('compositeExamResults', JSON.stringify([]));
    window.localStorage.setItem('successPoints', '0');
    window.localStorage.setItem('userType', JSON.stringify(UserType.Parent));
    window.localStorage.setItem('isParentLocked', JSON.stringify(false));
    window.localStorage.setItem('parentWorkspaceView', JSON.stringify('analysis'));
    window.localStorage.setItem('parentDefaultView', JSON.stringify('analysis'));
    window.localStorage.setItem('__qa_manual_records_seeded_at', new Date().toISOString());
    syncQaSeedToIndexedDb({
      tasks: [],
      performanceData: [],
      examRecords: [],
      compositeExamResults: [],
    });
    return;
  }

  const performance = INITIAL_REAL_PERFORMANCE.map((item) => {
    const courseTasks = tasks.filter((task) => task.courseId === item.courseId);
    return {
      ...item,
      correct: courseTasks.reduce((sum, task) => sum + (task.correctCount || 0), 0),
      incorrect: courseTasks.reduce((sum, task) => sum + (task.incorrectCount || 0), 0),
      timeSpent: Math.round(courseTasks.reduce((sum, task) => sum + (task.actualDuration || 0), 0) / 60),
    };
  });

  window.localStorage.setItem('tasks', JSON.stringify(tasks));
  window.localStorage.setItem('performanceData', JSON.stringify(performance));
  window.localStorage.setItem('successPoints', String(tasks.reduce((sum, task) => sum + (task.pointsAwarded || 0), 0)));
  window.localStorage.setItem('rewards', JSON.stringify([
    { id: 'qa_reward_1', name: 'Test sonrası mini mola', cost: 90, icon: 'Gift' },
    { id: 'qa_reward_2', name: 'Kitap seçimi', cost: 140, icon: 'Gift' },
  ]));
  window.localStorage.setItem('badges', JSON.stringify([
    { id: 'qa_badge_1', name: 'Gerçek Kayıt Testi', description: 'QA kayıtları başarıyla işlendi.', icon: 'Award' },
  ]));
  window.localStorage.setItem('userType', JSON.stringify(UserType.Parent));
  window.localStorage.setItem('isParentLocked', JSON.stringify(false));
  window.localStorage.setItem('parentWorkspaceView', JSON.stringify('analysis'));
  window.localStorage.setItem('parentDefaultView', JSON.stringify('analysis'));
  window.localStorage.setItem('examRecords', JSON.stringify([]));
  window.localStorage.setItem('compositeExamResults', JSON.stringify([]));
  window.localStorage.removeItem('drEnableRecharts');
  window.localStorage.removeItem('drDisableRecharts');
  window.localStorage.setItem('__qa_manual_records_seeded_at', new Date().toISOString());
  syncQaSeedToIndexedDb({
    tasks,
    performanceData: performance,
    examRecords: [],
    compositeExamResults: [],
  });
};
seedInitialRealCurriculum();
seedManualQaRecords();
pruneLegacyDemoSubjects();
purgeLegacyDemoData();
runCleanLiveTestDataMigration();

const normalizeCurriculum = (value: any): SubjectCurriculum => {
  if (!value || typeof value !== 'object') return {};
  const next: SubjectCurriculum = {};
  for (const [subject, units] of Object.entries(value)) {
    next[repairedText(subject) || subject] = Array.isArray(units)
      ? units.map((unit: any) => ({
          name: repairedText(unit?.name) || String(unit?.name ?? ''),
          topics: Array.isArray(unit?.topics)
            ? unit.topics.map((topic: any) => ({
                name: repairedText(topic?.name) || String(topic?.name ?? ''),
                completed: Boolean(topic?.completed),
              }))
            : [],
        }))
      : [];
  }
  return next;
};

const normalizePerformanceData = (items: any[]): PerformanceData[] =>
  Array.isArray(items)
    ? items.map((item) => ({
        courseId: String(item?.courseId ?? ''),
        courseName: repairedText(item?.courseName) || String(item?.courseName ?? ''),
        correct: Number(item?.correct ?? 0),
        incorrect: Number(item?.incorrect ?? 0),
        timeSpent: Number(item?.timeSpent ?? 0),
      }))
    : [];

const normalizeExamRecords = (items: any[], courses: Course[]): ExamRecord[] => {
  if (!Array.isArray(items)) return [];
  const knownCourseIds = new Set(courses.map((course) => course.id));

  return items
    .map((item, index) => {
      const courseName = repairedText(item?.courseName).trim();
      const rawCourseId = typeof item?.courseId === 'string' && item.courseId ? item.courseId : '';
      const matchedCourse = courses.find((course) => course.id === rawCourseId || normalizeForLookup(course.name) === normalizeForLookup(courseName));
      const courseId = rawCourseId && knownCourseIds.has(rawCourseId) ? rawCourseId : matchedCourse?.id || '';
      const resolvedCourseName = matchedCourse?.name || courseName;
      const title = repairedText(item?.title).trim();
      const date = typeof item?.date === 'string' ? item.date : '';
      const score = Number(item?.score);

      if (!courseId || !resolvedCourseName || !title || !date || !Number.isFinite(score)) return null;

      return {
        id: typeof item?.id === 'string' && item.id ? item.id : `exam_record_${courseId}_${date}_${index}`,
        courseId,
        courseName: resolvedCourseName,
        examType: item?.examType || 'school-written',
        title,
        date,
        termKey: typeof item?.termKey === 'string' && item.termKey ? item.termKey : `${new Date(date).getFullYear()}-genel`,
        scopeType: item?.scopeType || 'course',
        unitNames: Array.isArray(item?.unitNames) ? item.unitNames.map((entry: string) => repairedText(entry).trim()).filter(Boolean) : undefined,
        topicNames: Array.isArray(item?.topicNames) ? item.topicNames.map((entry: string) => repairedText(entry).trim()).filter(Boolean) : undefined,
        score: Math.max(0, Math.min(100, score)),
        weight: Number.isFinite(Number(item?.weight)) ? Number(item.weight) : undefined,
        maxScore: Number.isFinite(Number(item?.maxScore)) ? Number(item.maxScore) : undefined,
        notes: repairedText(item?.notes).trim() || undefined,
        source: item?.source === 'import' ? 'import' : 'manual',
      } as ExamRecord;
    })
    .filter((item): item is ExamRecord => Boolean(item))
    .sort((left, right) => right.date.localeCompare(left.date));
};

const normalizeCompositeExamResults = (items: any[], courses: Course[]): CompositeExamResult[] => {
  if (!Array.isArray(items)) return [];
  const knownCourseIds = new Set(courses.map((course) => course.id));

  return items
    .map((item, index) => {
      const title = repairedText(item?.title).trim();
      const date = typeof item?.date === 'string' ? item.date : '';
      const coursesPayload = Array.isArray(item?.courses)
        ? item.courses
            .map((entry: any) => {
              const courseName = repairedText(entry?.courseName).trim();
              const rawCourseId = typeof entry?.courseId === 'string' && entry.courseId ? entry.courseId : '';
              const matchedCourse = courses.find((course) => course.id === rawCourseId || normalizeForLookup(course.name) === normalizeForLookup(courseName));
              const courseId = rawCourseId && knownCourseIds.has(rawCourseId) ? rawCourseId : matchedCourse?.id || '';
              const resolvedCourseName = matchedCourse?.name || courseName;
              const score = Number(entry?.score);
              if (!courseId || !resolvedCourseName || !Number.isFinite(score)) return null;
              return {
                courseId,
                courseName: resolvedCourseName,
                score: Math.max(0, Math.min(100, score)),
                net: Number.isFinite(Number(entry?.net)) ? Number(entry.net) : undefined,
              };
            })
            .filter((entry: CompositeExamResult['courses'][number] | null): entry is CompositeExamResult['courses'][number] => Boolean(entry))
        : [];

      if (!title || !date || coursesPayload.length === 0) return null;

      return {
        id: typeof item?.id === 'string' && item.id ? item.id : `composite_exam_${date}_${index}`,
        title,
        examType: item?.examType === 'trial-exam' || item?.examType === 'mock-exam' ? 'mock-exam' : 'state-exam',
        date,
        courses: coursesPayload,
        totalScore: Number.isFinite(Number(item?.totalScore)) ? Number(item.totalScore) : undefined,
        notes: repairedText(item?.notes).trim() || undefined,
      } as CompositeExamResult;
    })
    .filter((item): item is CompositeExamResult => Boolean(item))
    .sort((left, right) => right.date.localeCompare(left.date));
};

const getCompositeExamAverage = (result?: CompositeExamResult): number | null => {
  if (!result || !Array.isArray(result.courses) || result.courses.length === 0) return null;
  const scores = result.courses
    .map((course) => Number(course.score))
    .filter((score) => Number.isFinite(score));
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
};

const normalizeRewards = (items: Reward[]): Reward[] => items.map((item) => ({ ...item, name: repairText(item.name) || item.name }));
const normalizeBadges = (items: Badge[]): Badge[] => items.map((item, index) => {
  const nextName = repairText(item.name) || item.name;
  const nextDescription = repairText(item.description) || item.description;
  if (!looksCorrupted(nextName) && !looksCorrupted(nextDescription)) return { ...item, name: nextName, description: nextDescription };
  if (item.id === 'b1' || index === 0) return { ...item, name: 'İlk Adım', description: 'İlk görevini tamamladın!' };
  return { ...item, name: 'Rozet', description: 'Rozet aciklamasi guncellenecek.' };
});
const normalizeCourses = (items: Course[]): Course[] =>
  sortCourses(items.map((item, index) => normalizeCourseRecord(item, index)).filter((course): course is Course => Boolean(course)));

const normalizeCoursesWithAliases = (items: Course[]) => {
  const normalized = items
    .map((item, index) => normalizeCourseRecord(item, index))
    .filter((course): course is Course => Boolean(course));
  const byName = new Map<string, Course>();
  const courseIdAliases = new Map<string, string>();

  normalized.forEach((course) => {
    const key = normalizeForLookup(course.name);
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, course);
      courseIdAliases.set(course.id, course.id);
      return;
    }

    courseIdAliases.set(course.id, existing.id);
    if (existing.active === false && course.active !== false) {
      existing.active = true;
    }
  });

  return {
    courses: sortCourses([...byName.values()]),
    courseIdAliases,
  };
};

const remapCourseId = (courseId: string, aliases: Map<string, string>) => aliases.get(courseId) || courseId;

const dedupePerformanceData = (items: PerformanceData[], courses: Course[]): PerformanceData[] => {
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const merged = new Map<string, PerformanceData>();

  items.forEach((item) => {
    if (!courseById.has(item.courseId)) return;
    const course = courseById.get(item.courseId)!;
    const existing = merged.get(item.courseId) || {
      courseId: item.courseId,
      courseName: course.name,
      correct: 0,
      incorrect: 0,
      timeSpent: 0,
    };
    merged.set(item.courseId, {
      courseId: item.courseId,
      courseName: course.name,
      correct: existing.correct + item.correct,
      incorrect: existing.incorrect + item.incorrect,
      timeSpent: existing.timeSpent + item.timeSpent,
    });
  });

  return [...merged.values()];
};

const normalizeStudyPlans = (value: unknown): StoredStudyPlan[] => {
  if (!Array.isArray(value)) return [];

  const plansByWeek = new Map<number, number>();

  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || !('plan' in item) || typeof item.plan !== 'object' || Array.isArray(item.plan)) return null;
    const week = Number(item.week) || 0;
    const nextVersion = Number(item.version) || ((plansByWeek.get(week) || 0) + 1);
    plansByWeek.set(week, nextVersion);
    const normalizedPlan = Object.fromEntries(
      Object.entries(item.plan)
        .filter(([, subjectPlan]) => subjectPlan && typeof subjectPlan === 'object')
        .map(([subject, subjectPlan]) => {
          const typedSubjectPlan = subjectPlan as Partial<SubjectPlan>;
          return [
            repairedText(subject) || subject,
            {
              units: Array.isArray(typedSubjectPlan.units)
                ? typedSubjectPlan.units.map((unit: any) => ({
                    name: repairedText(unit?.name) || String(unit?.name ?? ''),
                    topics: Array.isArray(unit?.topics)
                      ? unit.topics.map((topic: any) => ({
                          name: repairedText(topic?.name) || String(topic?.name ?? ''),
                          tasks: Array.isArray(topic?.tasks) ? topic.tasks : [],
                        }))
                      : [],
                  }))
                : [],
            },
          ] as const;
        })
        .filter(([, subjectPlan]) => subjectPlan.units.length > 0),
    ) as StudyPlan;

    if (Object.keys(normalizedPlan).length === 0) return null;

    return {
      ...item,
      id: typeof item.id === 'string' && item.id ? item.id : `stored_plan_week_${week}_v${nextVersion}_${index}`,
      week,
      version: nextVersion,
      status: item.status,
      reason: item.reason,
      generatedAt: typeof item.generatedAt === 'string' && item.generatedAt ? item.generatedAt : undefined,
      approvedAt: typeof item.approvedAt === 'string' && item.approvedAt ? item.approvedAt : undefined,
      approvedBy: item.approvedBy === 'parent' || item.approvedBy === 'system' ? item.approvedBy : undefined,
      parentPlanId: typeof item.parentPlanId === 'string' && item.parentPlanId ? item.parentPlanId : undefined,
      plan: normalizedPlan,
      schedule: normalizeWeeklySchedule(item.schedule),
      type: item.type === 'revision' ? 'revision' : 'normal',
    } as StoredStudyPlan;
  }).filter((item): item is StoredStudyPlan => Boolean(item));
};

const normalizeExamScheduleEntries = (items: any[], courses: Course[]): ExamScheduleEntry[] => {
  if (!Array.isArray(items)) return [];
  const knownCourseIds = new Set(courses.map((course) => course.id));

  return items
    .map((item, index) => {
      const courseName = repairedText(item?.courseName).trim();
      const rawCourseId = typeof item?.courseId === 'string' && item.courseId ? item.courseId : '';
      const matchedCourse = courses.find((course) => course.id === rawCourseId || normalizeForLookup(course.name) === normalizeForLookup(courseName));
      const courseId = rawCourseId && knownCourseIds.has(rawCourseId) ? rawCourseId : matchedCourse?.id || '';
      const resolvedCourseName = matchedCourse?.name || courseName;
      const examName = repairedText(item?.examName ?? item?.name).trim();
      const date = typeof item?.date === 'string' ? item.date : '';

      if (!courseId || !resolvedCourseName || !examName || !date) return null;

      return {
        id: typeof item?.id === 'string' && item.id ? item.id : `exam_schedule_${courseId}_${date}_${index}`,
        courseId,
        courseName: resolvedCourseName,
        examName,
        date,
        note: repairedText(item?.note).trim() || undefined,
      } as ExamScheduleEntry;
    })
    .filter((item): item is ExamScheduleEntry => Boolean(item))
    .sort((left, right) => left.date.localeCompare(right.date) || left.courseName.localeCompare(right.courseName));
};

const toIsoDate = (value?: string) => {
  if (!value) return new Date().toISOString();
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const buildTopicRecordId = (courseId: string, unitName: string, topicName: string) =>
  `topic_${courseId}_${normalizeForLookup(unitName)}_${normalizeForLookup(topicName)}`;

const deriveScheduleDays = (schedule: WeeklySchedule, courses: Course[]): ScheduleDayRecord[] =>
  SCHEDULE_DAYS.map((dayName) => {
    const dayState = schedule[dayName] || createEmptyScheduleDay();
    return {
      dayName,
      confirmed: Boolean(dayState.confirmed),
      schoolBlocks: (dayState.slots || []).map((slot) => ({
        id: slot.id,
        courseId: courses.find((course) => normalizeForLookup(course.name) === normalizeForLookup(slot.courseName))?.id,
        courseName: slot.courseName,
        startTime: slot.startTime,
        endTime: slot.endTime,
        note: slot.note,
      })),
      availableWindows: Array.isArray(dayState.availableWindows) ? dayState.availableWindows : [],
    };
  });

const deriveCurriculumTopics = (curriculum: SubjectCurriculum, courses: Course[]): CurriculumTopicRecord[] =>
  Object.entries(curriculum).flatMap(([courseName, units]) => {
    const courseId = courses.find((course) => normalizeForLookup(course.name) === normalizeForLookup(courseName))?.id || createId('course_ref');
    return units.flatMap((unit, unitIndex) =>
      unit.topics.map((topic, topicIndex) => ({
        id: buildTopicRecordId(courseId, unit.name, topic.name),
        courseId,
        courseName,
        unitName: unit.name,
        topicName: topic.name,
        sequenceOrder: unitIndex * 100 + topicIndex,
        isRequired: true,
      })),
    );
  });

const mapSubjectPlanTaskToBlockType = (task: { type: string; source?: string }): PlanBlockType => {
  const normalizedType = normalizeForLookup(task.type || '');
  const normalizedSource = normalizeForLookup(task.source || '');
  if (normalizedSource.includes('olcme')) return 'assessment';
  if (normalizedSource.includes('sinav')) return 'exam_prep';
  if (normalizedType.includes('tekrar') || normalizedSource.includes('tekrar')) return 'revision';
  if (normalizedSource.includes('mufredat')) return 'new_learning';
  if (normalizedType.includes('soru')) return 'question_practice';
  return 'new_learning';
};

const mapTaskToSessionBlockType = (task: Task): PlanBlockType => {
  if (task.taskGoalType === 'sinav-hazirlik') return 'exam_prep';
  if (task.taskGoalType === 'olcme-degerlendirme') return 'assessment';
  if (task.taskType === 'soru çözme' || task.taskGoalType === 'test-cozme') return 'question_practice';
  if (task.taskGoalType === 'konu-tekrari') return 'revision';
  if (task.taskGoalType === 'eksik-konu-tamamlama') return 'new_learning';
  return 'light_review';
};

const inferPlanBlockSourceReason = (task: { source?: string }, storedPlan: StoredStudyPlan): PlanBlockRecord['sourceReason'] => {
  const normalizedSource = normalizeForLookup(task.source || '');
  if (normalizedSource.includes('telafi') || normalizedSource.includes('compensation')) return 'compensation';
  if (normalizedSource.includes('sinav')) return 'exam-trigger';
  if (normalizedSource.includes('risk') || normalizedSource.includes('tekrar')) return 'revision-trigger';
  if (normalizedSource.includes('secili') || normalizedSource.includes('manuel')) return 'manual-parent';
  if (storedPlan.type === 'revision') return 'revision-trigger';
  return 'curriculum-flow';
};

const inferStudyPlanReason = (
  week: number,
  version: number,
  plan: StoredStudyPlan,
  replanTriggers: ReplanTriggerRecord[],
): StudyPlanRecord['reason'] => {
  if (plan.reason) return plan.reason;
  if (version === 1) return 'initial-plan';
  if (plan.type === 'revision') return 'revision-needed';

  const weekSpecificTriggers = replanTriggers.filter((trigger) => trigger.id.includes(`week_${week}`));
  if (weekSpecificTriggers.some((trigger) => trigger.type === 'schedule-change')) return 'schedule-change';
  if (weekSpecificTriggers.some((trigger) => trigger.type === 'plan-break')) return 'manual-parent-update';
  if (weekSpecificTriggers.some((trigger) => trigger.type === 'low-performance')) return 'performance-drop';
  if (weekSpecificTriggers.some((trigger) => trigger.type === 'revision-delay')) return 'revision-needed';
  if (weekSpecificTriggers.some((trigger) => trigger.type === 'exam-pressure')) return 'exam-pressure';
  return 'manual-parent-update';
};

const deriveStudyPlanRecords = (plans: StoredStudyPlan[], replanTriggers: ReplanTriggerRecord[]): StudyPlanRecord[] => {
  const plansByWeek = new Map<number, StoredStudyPlan[]>();
  plans.forEach((plan) => {
    const bucket = plansByWeek.get(plan.week) || [];
    bucket.push(plan);
    plansByWeek.set(plan.week, bucket);
  });

  const latestWeek = plans.length > 0 ? Math.max(...plans.map((plan) => plan.week)) : 0;

  return Array.from(plansByWeek.entries())
    .sort((left, right) => left[0] - right[0])
    .flatMap(([week, weekPlans]) => {
      const sortedWeekPlans = [...weekPlans].sort((left, right) => {
        const leftVersion = left.version || 0;
        const rightVersion = right.version || 0;
        if (leftVersion !== rightVersion) return leftVersion - rightVersion;
        return (left.generatedAt || '').localeCompare(right.generatedAt || '');
      });

      return sortedWeekPlans.map((plan, index) => ({
        id: plan.id || `study_plan_week_${week}_v${plan.version || index + 1}`,
        weekKey: `week-${week}`,
        version: plan.version || index + 1,
        status: plan.status || (week === latestWeek && index === sortedWeekPlans.length - 1 ? 'active' : 'archived'),
        reason: inferStudyPlanReason(week, plan.version || index + 1, plan, replanTriggers),
        generatedAt: plan.generatedAt || new Date().toISOString(),
        approvedAt: plan.approvedAt || ((plan.status === 'active' || plan.status === 'archived') ? plan.generatedAt || new Date().toISOString() : undefined),
        approvedBy: plan.approvedBy || ((plan.status === 'active' || plan.status === 'archived') ? 'parent' : undefined),
      }));
    });
};

const derivePlanBlockRecords = (plans: StoredStudyPlan[], curriculumTopics: CurriculumTopicRecord[], courses: Course[], studyPlanRecords: StudyPlanRecord[]): PlanBlockRecord[] => {
  const topicLookup = new Map(curriculumTopics.map((topic) => [`${topic.courseId}:${normalizeForLookup(topic.unitName)}:${normalizeForLookup(topic.topicName)}`, topic]));

  return plans.flatMap((storedPlan, planIndex) => {
    const planVersion = storedPlan.version || planIndex + 1;
    const matchingPlanRecord = studyPlanRecords.find((item) => item.weekKey === `week-${storedPlan.week}` && item.version === planVersion) || studyPlanRecords.find((item) => item.weekKey === `week-${storedPlan.week}`);

    return Object.entries(storedPlan.plan).flatMap(([subject, subjectPlan]) => {
      const course = courses.find((item) => normalizeForLookup(item.name) === normalizeForLookup(subject));
      const courseId = course?.id || `course_missing_${normalizeForLookup(subject)}`;

      return subjectPlan.units.flatMap((unit) =>
        unit.topics.flatMap((topic) => {
          const topicRecord = topicLookup.get(`${courseId}:${normalizeForLookup(unit.name)}:${normalizeForLookup(topic.name)}`);
          return topic.tasks.map((task) => ({
            id: task.id,
            studyPlanId: matchingPlanRecord?.id || `study_plan_week_${storedPlan.week}_v1`,
            dayName: task.day,
            startTime: task.startTime,
            endTime: task.endTime,
            courseId,
            courseName: subject,
            topicId: topicRecord?.id,
            topicName: topic.name,
            blockType: mapSubjectPlanTaskToBlockType(task),
            priorityScore: 0,
            required: true,
            assignmentMode: 'assigned',
            sourceReason: inferPlanBlockSourceReason(task, storedPlan),
          }));
        }),
      );
    });
  });
};

const findRecommendedCompensationSlot = (
  day: ScheduleDayRecord,
  occupiedBlocks: PlanBlockRecord[],
  durationMinutes: number,
) => {
  const occupiedRanges = occupiedBlocks
    .filter((block) => block.dayName === day.dayName)
    .map((block) => ({ start: toMinutes(block.startTime), end: toMinutes(block.endTime) }))
    .sort((left, right) => left.start - right.start);

  for (const window of day.availableWindows) {
    const windowStart = toMinutes(window.startTime);
    const windowEnd = toMinutes(window.endTime);
    let cursor = windowStart;

    for (const range of occupiedRanges) {
      if (range.end <= cursor || range.start >= windowEnd) continue;
      if (range.start - cursor >= durationMinutes) {
        return {
          startTime: fromMinutes(cursor),
          endTime: fromMinutes(cursor + durationMinutes),
        };
      }
      cursor = Math.max(cursor, range.end + 10);
    }

    if (windowEnd - cursor >= durationMinutes) {
      return {
        startTime: fromMinutes(cursor),
        endTime: fromMinutes(cursor + durationMinutes),
      };
    }
  }

  return null;
};

const deriveCompensationPlanBlockRecords = (
  replanTriggers: ReplanTriggerRecord[],
  studyPlanRecords: StudyPlanRecord[],
  scheduleDays: ScheduleDayRecord[],
  existingPlanBlocks: PlanBlockRecord[],
  tasks: Task[],
  curriculumTopics: CurriculumTopicRecord[],
): PlanBlockRecord[] => {
  const activePlan = studyPlanRecords.find((record) => record.status === 'active');
  if (!activePlan) return [];

  const latestWeek = Number(activePlan.weekKey.replace('week-', ''));
  const planBreakTrigger = replanTriggers.find((trigger) => trigger.type === 'plan-break' && trigger.id.includes(`week_${latestWeek}`));
  if (!planBreakTrigger) return [];

  const topicLookup = new Map(curriculumTopics.map((topic) => [`${topic.courseId}:${normalizeForLookup(topic.unitName)}:${normalizeForLookup(topic.topicName)}`, topic]));
  const incompleteTasks = tasks
    .filter((task) => task.planWeek === latestWeek && task.planTaskId && !isCompletedTask(task))
    .slice(0, 4);

  if (incompleteTasks.length === 0) return [];

  const preferredDays = ['Cumartesi', 'Pazar', ...SCHEDULE_DAYS.filter((day) => day !== 'Cumartesi' && day !== 'Pazar')];
  const occupiedBlocks = existingPlanBlocks.filter((block) => block.studyPlanId === activePlan.id);

  return incompleteTasks.flatMap((task, index) => {
    const durationMinutes = Math.max(30, Math.min(45, Math.round((task.plannedDuration || 30))));
    const targetDay = preferredDays
      .map((dayName) => scheduleDays.find((day) => day.dayName === dayName))
      .find((day): day is ScheduleDayRecord => {
        if (!day) return false;
        return Boolean(findRecommendedCompensationSlot(day, [...occupiedBlocks], durationMinutes));
      });

    if (!targetDay) return [];

    const slot = findRecommendedCompensationSlot(targetDay, occupiedBlocks, durationMinutes);
    if (!slot) return [];

    const relatedTopic = task.curriculumUnitName && task.curriculumTopicName
      ? topicLookup.get(`${task.courseId}:${normalizeForLookup(task.curriculumUnitName)}:${normalizeForLookup(task.curriculumTopicName)}`)
      : undefined;

    const compensationBlock: PlanBlockRecord = {
      id: `compensation_${activePlan.id}_${index}_${task.id}`,
      studyPlanId: activePlan.id,
      dayName: targetDay.dayName,
      startTime: slot.startTime,
      endTime: slot.endTime,
      courseId: task.courseId,
      courseName: (relatedTopic?.courseName || task.title.split(' - ')[0] || '').trim(),
      topicId: relatedTopic?.id,
      topicName: relatedTopic?.topicName || task.curriculumTopicName,
      blockType: 'compensation',
      priorityScore: planBreakTrigger.severity === 'high' ? 75 : 60,
      required: false,
      assignmentMode: 'recommended',
      sourceReason: 'compensation',
    };

    occupiedBlocks.push(compensationBlock);
    return [compensationBlock];
  });
};

const deriveStudySessions = (tasks: Task[], curriculumTopics: CurriculumTopicRecord[]): StudySessionRecord[] => {
  const topicLookup = new Map(curriculumTopics.map((topic) => [`${topic.courseId}:${normalizeForLookup(topic.unitName)}:${normalizeForLookup(topic.topicName)}`, topic.id]));
  return tasks
    .filter((task) => isCompletedTask(task))
    .map((task) => ({
      id: `session_${task.id}`,
      relatedPlanBlockId: task.planTaskId,
      startedAt: task.completionDate ? toIsoDate(task.completionDate) : new Date(task.startTimestamp || Date.now()).toISOString(),
      endedAt: task.completionDate ? toIsoDate(task.completionDate) : undefined,
      courseId: task.courseId,
      topicId: task.curriculumUnitName && task.curriculumTopicName ? topicLookup.get(`${task.courseId}:${normalizeForLookup(task.curriculumUnitName)}:${normalizeForLookup(task.curriculumTopicName)}`) : undefined,
      taskType: mapTaskToSessionBlockType(task),
      actualDuration: typeof task.actualDuration === 'number' ? task.actualDuration : task.plannedDuration * 60,
      completed: true,
      completionQuality: typeof task.successScore === 'number' ? (task.successScore >= 80 ? 'high' : task.successScore >= 60 ? 'medium' : 'low') : undefined,
    }));
};

const deriveAssessmentResults = (tasks: Task[], curriculumTopics: CurriculumTopicRecord[]): AssessmentResultRecord[] => {
  const topicLookup = new Map(curriculumTopics.map((topic) => [`${topic.courseId}:${normalizeForLookup(topic.unitName)}:${normalizeForLookup(topic.topicName)}`, topic.id]));
  return tasks
    .filter((task) => isCompletedTask(task) && (
      task.taskType === 'soru çözme'
      || task.taskGoalType === 'test-cozme'
      || task.taskGoalType === 'olcme-degerlendirme'
      || task.taskGoalType === 'sinav-hazirlik'
      || typeof task.correctCount === 'number'
      || typeof task.successScore === 'number'
    ))
    .map((task) => {
      const score = isQuestionTask(task)
        ? getSuccessPercent(task, Math.round(task.successScore || 0))
        : Math.round(task.successScore || 0);

      const source: AssessmentResultRecord['source'] = task.taskGoalType === 'sinav-hazirlik'
        ? 'mock-exam'
        : task.taskGoalType === 'olcme-degerlendirme'
          ? 'mini-quiz'
          : 'question-practice';

      return {
        id: `assessment_${task.id}`,
        courseId: task.courseId,
        topicId: task.curriculumUnitName && task.curriculumTopicName ? topicLookup.get(`${task.courseId}:${normalizeForLookup(task.curriculumUnitName)}:${normalizeForLookup(task.curriculumTopicName)}`) : undefined,
        date: task.completionDate || getLocalDateString(),
        score,
        source,
        questionCount: task.questionCount,
        correctCount: task.correctCount,
        incorrectCount: task.incorrectCount,
      };
    });
};

const deriveTopicStatuses = (curriculumTopics: CurriculumTopicRecord[], sessions: StudySessionRecord[], assessments: AssessmentResultRecord[]): TopicStatusRecord[] => {
  const now = new Date();
  const sessionsByTopic = new Map<string, StudySessionRecord[]>();
  const assessmentsByTopic = new Map<string, AssessmentResultRecord[]>();

  sessions.forEach((session) => {
    if (!session.topicId) return;
    const bucket = sessionsByTopic.get(session.topicId) || [];
    bucket.push(session);
    sessionsByTopic.set(session.topicId, bucket);
  });

  assessments.forEach((assessment) => {
    if (!assessment.topicId) return;
    const bucket = assessmentsByTopic.get(assessment.topicId) || [];
    bucket.push(assessment);
    assessmentsByTopic.set(assessment.topicId, bucket);
  });

  return curriculumTopics.map((topic) => {
    const topicAssessments = (assessmentsByTopic.get(topic.id) || []).sort((left, right) => left.date.localeCompare(right.date));
    const topicSessions = sessionsByTopic.get(topic.id) || [];

    if (topicAssessments.length > 0) {
      const rollingAverageScore = Math.round(topicAssessments.reduce((sum, item) => sum + item.score, 0) / topicAssessments.length);
      const lastAssessment = topicAssessments[topicAssessments.length - 1];
      const lastStudiedAt = topicSessions.length > 0 ? [...topicSessions].sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0].startedAt : toIsoDate(lastAssessment.date);
      const lastSuccessDate = topicAssessments.filter((item) => item.score >= 70).slice(-1)[0]?.date;
      const revisionSessions = topicSessions.filter((session) => session.taskType === 'revision');
      const lastTwoRevisionAssessments = topicAssessments.slice(-2);
      const revisionGain = lastTwoRevisionAssessments.length === 2 ? lastTwoRevisionAssessments[1].score - lastTwoRevisionAssessments[0].score : 100;
      const daysSinceLastSuccess = lastSuccessDate ? Math.floor((now.getTime() - new Date(`${lastSuccessDate}T00:00:00`).getTime()) / (1000 * 60 * 60 * 24)) : null;

      let status: TopicStatusRecord['status'] = 'stable';
      let nextRecommendedAction: TopicStatusRecord['nextRecommendedAction'] = 'practice';

      if (revisionGain < 10 && lastAssessment.score < 65) {
        status = 'risky';
        nextRecommendedAction = 'revise';
      } else if (rollingAverageScore < 60) {
        status = 'risky';
        nextRecommendedAction = 'revise';
      } else if (daysSinceLastSuccess !== null && daysSinceLastSuccess >= 7 && revisionSessions.length === 0) {
        status = 'needs_revision';
        nextRecommendedAction = 'revise';
      }

      return {
        topicId: topic.id,
        status,
        lastStudiedAt,
        lastAssessmentScore: lastAssessment.score,
        rollingAverageScore,
        consecutiveRevisionCount: revisionSessions.length,
        nextRecommendedAction,
      };
    }

    if (topicSessions.length > 0) {
      const latestSession = [...topicSessions].sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0];
      return {
        topicId: topic.id,
        status: 'in_progress',
        lastStudiedAt: latestSession?.startedAt,
        consecutiveRevisionCount: topicSessions.filter((session) => session.taskType === 'revision').length,
        nextRecommendedAction: 'assess',
      };
    }

    return {
      topicId: topic.id,
      status: 'new',
      nextRecommendedAction: 'learn',
    };
  });
};

const stripScheduleCurriculumMarkers = (schedule: WeeklySchedule) => Object.fromEntries(
  SCHEDULE_DAYS.map((dayName) => {
    const day = schedule[dayName] || createEmptyScheduleDay();
    return [dayName, {
      confirmed: Boolean(day.confirmed),
      slots: (day.slots || []).map((slot) => ({
        id: slot.id,
        courseName: slot.courseName,
        startTime: slot.startTime,
        endTime: slot.endTime,
        note: slot.note,
      })),
      availableWindows: Array.isArray(day.availableWindows) ? day.availableWindows : [],
    }];
  }),
) as WeeklySchedule;

const hasScheduleTimeStructureChanged = (left: WeeklySchedule, right: WeeklySchedule) => (
  JSON.stringify(stripScheduleCurriculumMarkers(left)) !== JSON.stringify(stripScheduleCurriculumMarkers(right))
);

const deriveReplanTriggers = (
  topicStatuses: TopicStatusRecord[],
  curriculumTopics: CurriculumTopicRecord[],
  tasks: Task[],
  studyPlans: StoredStudyPlan[],
  weeklySchedule: WeeklySchedule,
  examSchedules: ExamScheduleEntry[],
): ReplanTriggerRecord[] => {
  const topicsById = new Map(curriculumTopics.map((topic) => [topic.id, topic]));
  const triggers: ReplanTriggerRecord[] = topicStatuses.flatMap((status): ReplanTriggerRecord[] => {
    const topic = topicsById.get(status.topicId);
    if (!topic) return [];
    if (status.status === 'risky') {
      return [{
        id: `trigger_low_performance_${status.topicId}`,
        type: 'low-performance' as const,
        createdAt: new Date().toISOString(),
        severity: 'medium' as const,
        relatedCourseId: topic.courseId,
        relatedTopicId: topic.id,
        reasonText: `${topic.courseName} / ${topic.topicName} konusu yakin takip istiyor.`,
      }];
    }
    if (status.status === 'needs_revision') {
      return [{
        id: `trigger_revision_delay_${status.topicId}`,
        type: 'revision-delay' as const,
        createdAt: new Date().toISOString(),
        severity: 'low' as const,
        relatedCourseId: topic.courseId,
        relatedTopicId: topic.id,
        reasonText: `${topic.courseName} / ${topic.topicName} için tekrar gecikmesi var.`,
      }];
    }
    return [];
  });

  const sortedPlans = [...studyPlans].sort((left, right) => {
    if (left.week !== right.week) return left.week - right.week;
    return (left.version || 0) - (right.version || 0);
  });
  const activePlan = [...sortedPlans].reverse().find((plan) => plan.status === 'active');
  const activePlanWeek = activePlan?.week || 0;
  const planTasksForWeek = tasks.filter((task) => task.planWeek === activePlanWeek && Boolean(task.planTaskId));
  const currentDate = new Date();
  const currentDay = new Date().getDay();
  const isWeekEnd = currentDay === 0 || currentDay === 6;

  if (activePlan && currentDay >= 3 && currentDay < 6) {
    const midWeekTaskIds = Object.values(activePlan.plan)
      .flatMap((subjectPlan) => subjectPlan.units)
      .flatMap((unit) => unit.topics)
      .flatMap((topic) => topic.tasks)
      .filter((task) => task.day === 'Pazartesi' || task.day === 'Salı' || task.day === 'Çarşamba' || task.day === 'Sali' || task.day === 'Carsamba')
      .map((task) => task.id);

    if (midWeekTaskIds.length > 0) {
      const completedMidWeekTasks = planTasksForWeek.filter((task) => midWeekTaskIds.includes(task.planTaskId || '') && isCompletedTask(task)).length;
      const completionRateByWednesday = Math.round((completedMidWeekTasks / midWeekTaskIds.length) * 100);

      if (completionRateByWednesday < 50) {
        triggers.push({
          id: `trigger_mid_week_warning_week_${activePlanWeek}`,
          type: 'mid-week-warning',
          createdAt: new Date().toISOString(),
          severity: completionRateByWednesday < 30 ? 'high' : 'medium',
          reasonText: `Hafta ${activePlanWeek} Çarşamba tamamlama oranı %${completionRateByWednesday} seviyesinde kaldığı için erken uyarı oluştu.`,
        });
      }
    }
  }

  if (activePlan && isWeekEnd && planTasksForWeek.length > 0) {
    const completedCount = planTasksForWeek.filter((task) => isCompletedTask(task)).length;
    const completionRate = Math.round((completedCount / planTasksForWeek.length) * 100);
    if (completionRate < 60) {
      triggers.push({
        id: `trigger_plan_break_week_${activePlanWeek}`,
        type: 'plan-break',
        createdAt: new Date().toISOString(),
        severity: completionRate < 40 ? 'high' : 'medium',
        reasonText: `Hafta ${activePlanWeek} tamamlama oranı %${completionRate} seviyesinde kaldığı için plan kırılması oluştu.`,
      });
    }
  }

  if (activePlan && hasScheduleTimeStructureChanged(activePlan.schedule, weeklySchedule)) {
    triggers.push({
      id: `trigger_schedule_change_week_${activePlan.week}`,
      type: 'schedule-change',
      createdAt: new Date().toISOString(),
      severity: 'low',
      reasonText: `Hafta ${activePlan.week} sonrasinda zaman zemini degistigi icin plan guncelleme ihtiyaci olustu.`,
    });
  }

  if (activePlan) {
    const explicitExamSchedules = examSchedules.filter((exam) => {
      const dueDateValue = new Date(`${exam.date}T00:00:00`);
      if (Number.isNaN(dueDateValue.getTime())) return false;
      const daysToExam = Math.ceil((dueDateValue.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysToExam >= 0 && daysToExam <= 10;
    });

    const fallbackExamPrepTasks = explicitExamSchedules.length === 0
      ? tasks.filter((task) => {
          if (task.taskGoalType !== 'sinav-hazirlik' || !task.dueDate) return false;
          const dueDate = new Date(`${task.dueDate}T00:00:00`);
          if (Number.isNaN(dueDate.getTime())) return false;
          const daysToExam = Math.ceil((dueDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysToExam >= 0 && daysToExam <= 10;
        })
      : [];

    const examTriggerMap = new Map<string, { dueDate: string; relatedCourseId: string; examName: string }>();
    explicitExamSchedules.forEach((exam) => {
      if (!examTriggerMap.has(exam.courseId)) {
        examTriggerMap.set(exam.courseId, { dueDate: exam.date, relatedCourseId: exam.courseId, examName: exam.examName });
      }
    });
    fallbackExamPrepTasks.forEach((task) => {
      if (!examTriggerMap.has(task.courseId)) {
        examTriggerMap.set(task.courseId, { dueDate: task.dueDate, relatedCourseId: task.courseId, examName: 'Yaklaşan sınav' });
      }
    });

    examTriggerMap.forEach(({ dueDate, relatedCourseId, examName }) => {
      const relevantAssessments = tasks
        .filter((task) => task.courseId === relatedCourseId && isCompletedTask(task) && (
          task.taskType === 'soru çözme'
          || task.taskGoalType === 'test-cozme'
          || task.taskGoalType === 'olcme-degerlendirme'
          || task.taskGoalType === 'sinav-hazirlik'
        ))
        .map((task) => {
          if (isQuestionTask(task) && getQuestionMetrics(task).totalQuestionCount > 0) {
            return getSuccessPercent(task);
          }
          return typeof task.successScore === 'number' ? Math.round(task.successScore) : null;
        })
        .filter((score): score is number => typeof score === 'number')
        .slice(-3);

      if (relevantAssessments.length === 0) return;

      const averageScore = Math.round(relevantAssessments.reduce((sum, score) => sum + score, 0) / relevantAssessments.length);
      const dueDateValue = new Date(`${dueDate}T00:00:00`);
      const daysToExam = Math.ceil((dueDateValue.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      const severity = averageScore < 60 ? 'high' : averageScore <= 70 ? 'medium' : 'low';

      triggers.push({
        id: `trigger_exam_pressure_week_${activePlanWeek}_${relatedCourseId}`,
        type: 'exam-pressure',
        createdAt: new Date().toISOString(),
        severity,
        relatedCourseId,
        reasonText: `${examName} sınavına ${daysToExam} gün kaldı ve son ortalama başarı %${averageScore} seviyesinde olduğu için sınav baskısı oluştu.`,
      });
    });
  }

  return triggers;
};

const derivePlanningEngineSnapshot = (
  curriculum: SubjectCurriculum,
  weeklySchedule: WeeklySchedule,
  studyPlans: StoredStudyPlan[],
  tasks: Task[],
  courses: Course[],
  examSchedules: ExamScheduleEntry[],
): PlanningEngineSnapshot => {
  const scheduleDays = deriveScheduleDays(weeklySchedule, courses);
  const curriculumTopics = deriveCurriculumTopics(curriculum, courses);
  const normalizedExamSchedules = normalizeExamScheduleEntries(examSchedules, courses);
  const studySessions = deriveStudySessions(tasks, curriculumTopics);
  const assessmentResults = deriveAssessmentResults(tasks, curriculumTopics);
  const topicStatuses = deriveTopicStatuses(curriculumTopics, studySessions, assessmentResults);
  const replanTriggers = deriveReplanTriggers(topicStatuses, curriculumTopics, tasks, studyPlans, weeklySchedule, normalizedExamSchedules);
  const studyPlanRecords = deriveStudyPlanRecords(studyPlans, replanTriggers);
  const assignedPlanBlockRecords = derivePlanBlockRecords(studyPlans, curriculumTopics, courses, studyPlanRecords);
  const compensationPlanBlockRecords = deriveCompensationPlanBlockRecords(
    replanTriggers,
    studyPlanRecords,
    scheduleDays,
    assignedPlanBlockRecords,
    tasks,
    curriculumTopics,
  );
  const planBlockRecords = [...assignedPlanBlockRecords, ...compensationPlanBlockRecords];

  return {
    scheduleDays,
    curriculumTopics,
    examSchedules: normalizedExamSchedules,
    topicStatuses,
    studyPlanRecords,
    planBlockRecords,
    studySessions,
    assessmentResults,
    replanTriggers,
  };
};

const pruneStudyPlanTree = (plans: StoredStudyPlan[]): StoredStudyPlan[] =>
  plans
    .map((storedPlan) => ({
      ...storedPlan,
      plan: Object.fromEntries(
        Object.entries(storedPlan.plan)
          .map(([subject, subjectPlan]) => {
            const typedSubjectPlan = subjectPlan as StudyPlan[string];
            return [
            subject,
            {
              ...typedSubjectPlan,
              units: typedSubjectPlan.units
                .map((unit) => ({
                  ...unit,
                  topics: unit.topics.filter((topic) => topic.tasks.length > 0),
                }))
                .filter((unit) => unit.topics.length > 0),
            },
          ] as const;
          })
          .filter(([, subjectPlan]) => subjectPlan.units.length > 0),
      ) as StudyPlan,
    }))
    .filter((storedPlan) => Object.keys(storedPlan.plan).length > 0);

const parentWorkspaceItems: Array<{ id: ParentWorkspaceView; label: string; description: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }> = [
  { id: 'overview', label: 'Genel Bakış', description: 'Özet ve kontrol merkezi', icon: Home },
  { id: 'curriculum-panel', label: 'Müfredat Paneli', description: 'Okul ve çocuk konu hizası', icon: BookOpen },
  { id: 'planning', label: 'Planlama', description: 'Okul programı + ev çalışma + sınav takvimi', icon: Sparkles },
  { id: 'analysis', label: 'Karar', description: 'Performans ve kararlar', icon: BarChart },
];

const primaryParentWorkspaceIds: ParentWorkspaceView[] = ['overview', 'curriculum-panel', 'planning', 'analysis'];
const secondaryParentWorkspaceIds: ParentWorkspaceView[] = [];

const App: React.FC = () => {
  const isE2EMode = getQueryParam('e2e') === '1';
  const isRemoteSyncDisabled = isE2EMode || import.meta.env.VITE_DISABLE_FIREBASE_SYNC === 'true';
  const [userType, setUserType] = useStickyState<UserType>(UserType.Parent, 'userType');
  const [courses, setCourses] = useStickyState<Course[]>([], 'courses', normalizeSafeCourses);
  const [tasks, setTasks, tasksHydrated] = useStickyState<Task[]>([], 'tasks', normalizeSafeTasks);
  const [curriculum, setCurriculum, curriculumHydrated] = useStickyState<SubjectCurriculum>({}, 'curriculum', normalizeSafeCurriculum);
  const [weeklySchedule, setWeeklySchedule] = useStickyState<WeeklySchedule>(defaultWeeklySchedule, 'weeklySchedule', normalizeWeeklySchedule);
  const [schoolTopicHistory, setSchoolTopicHistory] = useStickyState<SchoolTopicHistoryEntry[]>([], 'schoolTopicHistory', normalizeSchoolTopicHistory);
  const [examScheduleEntries, setExamScheduleEntries, examScheduleEntriesHydrated] = useStickyState<ExamScheduleEntry[]>([], 'examScheduleEntries', normalizeSafeArray<ExamScheduleEntry>);
  const [examRecords, setExamRecords, examRecordsHydrated] = useStickyState<ExamRecord[]>([], 'examRecords', normalizeSafeArray<ExamRecord>);
  const [compositeExamResults, setCompositeExamResults, compositeExamResultsHydrated] = useStickyState<CompositeExamResult[]>([], 'compositeExamResults', normalizeSafeArray<CompositeExamResult>);
  const [studyPlans, setStudyPlans, studyPlansHydrated] = useStickyState<StoredStudyPlan[]>([], 'studyPlans', normalizeStudyPlans);
  const [planningEngineSnapshot, setPlanningEngineSnapshot, planningEngineSnapshotHydrated] = useStickyState<PlanningEngineSnapshot>(defaultPlanningEngineSnapshot, 'planningEngineSnapshot', normalizePlanningEngineSnapshot);
  const [performanceData, setPerformanceData, performanceDataHydrated] = useStickyState<PerformanceData[]>([], 'performanceData', normalizeSafeArray<PerformanceData>);
  const [rewards, setRewards] = useStickyState<Reward[]>([], 'rewards', normalizeSafeRewards);
  const [successPoints, setSuccessPoints] = useStickyState<number>(0, 'successPoints', normalizeSafeNumber);
  const [badges, setBadges] = useStickyState<Badge[]>([{ id: 'b1', name: 'İlk Adım', description: 'İlk görevini tamamladın!', icon: BadgeCheck }], 'badges', normalizeSafeBadges);
  const [isParentLocked, setIsParentLocked] = useStickyState<boolean>(true, 'isParentLocked', normalizeSafeBoolean);

  const allIdbStatesHydrated =
    tasksHydrated &&
    curriculumHydrated &&
    examScheduleEntriesHydrated &&
    examRecordsHydrated &&
    compositeExamResultsHydrated &&
    studyPlansHydrated &&
    planningEngineSnapshotHydrated &&
    performanceDataHydrated;
  const [loginError, setLoginError] = useState<string | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [showDeleteCourseModal, setShowDeleteCourseModal] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [parentWorkspaceView, setParentWorkspaceView] = useStickyState<ParentWorkspaceView>('overview', 'parentWorkspaceView', normalizeParentWorkspaceView);
  const [overviewStudyPeriod, setOverviewStudyPeriod] = useStickyState<OverviewStudyPeriod>('month', 'parentOverviewStudyPeriod');
  const [parentDefaultView, setParentDefaultView] = useStickyState<ParentWorkspaceView>('overview', 'parentDefaultView', normalizeParentWorkspaceView);
  const rewardClaimLockRef = useRef<Set<string>>(new Set());
  const completeTaskLockRef = useRef<Set<string>>(new Set());
  const tasksRef = useRef<Task[]>(tasks);
  const remoteSyncReadyRef = useRef(false);
  const remoteHydratedRef = useRef(false);
  const remoteApplyingRef = useRef(false);
  const remoteLastSerializedRef = useRef<string | null>(null);
  const remotePublishTimerRef = useRef<number | null>(null);
  const remoteLocalDirtySerializedRef = useRef<string | null>(null);
  const remoteLocalDirtyRef = useRef(false);
  const remotePublishInFlightRef = useRef(false);
  const remoteRevisionRef = useRef(0);
  const remoteAppDataRef = useRef<RemoteAppData | null>(null);
  const topbarNotificationsRef = useRef<HTMLDivElement | null>(null);
  const topbarSettingsRef = useRef<HTMLDivElement | null>(null);
  const topbarNotificationsPopoverRef = useRef<HTMLDivElement | null>(null);
  const topbarQuickActionsRef = useRef<HTMLDivElement | null>(null);
  const settingsPopoverRef = useRef<HTMLDivElement | null>(null);
  const topbarToolbarRef = useRef<HTMLDivElement | null>(null);
  const [parentMenuOpen, setParentMenuOpen] = useState(false);
  const [parentSidebarOpen, setParentSidebarOpen] = useStickyState<boolean>(true, 'parentSidebarOpen');
  const [notificationsMuted, setNotificationsMuted] = useStickyState<boolean>(false, 'notificationsMuted');
  const [hapticsEnabled, setHapticsEnabled] = useStickyState<boolean>(true, 'hapticsEnabled');
  const [themeMode, setThemeMode] = useStickyState<'light' | 'dark'>('dark', 'themeMode');
  const [showNotificationDot, setShowNotificationDot] = useStickyState<boolean>(true, 'showNotificationDot');
  const [rememberLastParentView, setRememberLastParentView] = useStickyState<boolean>(true, 'rememberLastParentView');
  const [parentDecisionV1Enabled, setParentDecisionV1Enabled] = useStickyState<boolean>(true, 'parentDecisionV1Enabled');

  const [dismissedNotificationKeys, setDismissedNotificationKeys] = useStickyState<string[]>([], 'dismissedNotificationKeys', normalizeSafeArray<string>);
  const [dismissedNotificationAtMap, setDismissedNotificationAtMap] = useStickyState<Record<string, number>>({}, 'dismissedNotificationAtMap', normalizeSafeNumberRecord);
  const [notificationCooldownMap, setNotificationCooldownMap] = useStickyState<Record<string, number>>({}, 'notificationCooldownMap', normalizeSafeNumberRecord);
  const [observabilityEvents, setObservabilityEvents] = useStickyState<ObservabilityEvent[]>([], 'observabilityEvents', normalizeSafeObservabilityEvents);
  const [analysisPipelineState, setAnalysisPipelineState] = useStickyState<AnalysisPipelineState>(
    {
      processedSourceEventIds: [],
      lastBackgroundRecomputeAt: null,
      lastDailySummaryAt: null,
      lastWeeklySummaryAt: null,
      cacheVersion: 1,
      cacheHits: 0,
      cacheMisses: 0,
    },
    'analysisPipelineState',
    normalizeSafePipelineState,
  );
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [curriculumEditorOpen, setCurriculumEditorOpen] = useState(false);
  const [dataAccessModalOpen, setDataAccessModalOpen] = useState(false);
  const [dataAccessPassword, setDataAccessPassword] = useState('');
  const [dataAccessGranted, setDataAccessGranted] = useState(false);
  const [dataAccessError, setDataAccessError] = useState<string | null>(null);
  const lastObservabilitySignatureRef = useRef<string | null>(null);
  const analysisCacheSignatureRef = useRef<string | null>(null);
  const prevDayKeyRef = useRef<string | null>(null);
  const prevWeekKeyRef = useRef<string | null>(null);
  const processedEventIdsRef = useRef<Set<string>>(new Set());
  const processedSourceTokensRef = useRef<Set<string>>(new Set());
  const settingsTelemetryInitRef = useRef(false);
  const rolloutTelemetryInitRef = useRef(false);
  const tuningTelemetryInitRef = useRef(false);

  useEffect(() => {
    const paletteFlag = 'drDarkPaletteApplied';
    if (window.localStorage.getItem(paletteFlag) === 'true') return;
    setThemeMode('dark');
    window.localStorage.setItem(paletteFlag, 'true');
  }, [setThemeMode]);

  useEffect(() => {
    processedSourceTokensRef.current = new Set(analysisPipelineState.processedSourceEventIds.slice(-300));
  }, [analysisPipelineState.processedSourceEventIds]);

  useEffect(() => {
    if ((parentWorkspaceView as string) === 'curriculum') {
      setParentWorkspaceView('planning');
      return;
    }
    if ((parentWorkspaceView as string) === 'schedule') {
      setParentWorkspaceView('planning');
    }
  }, [parentWorkspaceView, setParentWorkspaceView]);

  useEffect(() => {
    if (parentWorkspaceView === 'analysis' && !parentDecisionV1Enabled) {
      setParentWorkspaceView('overview');
      addToast('Karar ekrani kapali oldugu icin Genel Bakis acildi.', 'success');
    }
  }, [parentWorkspaceView, parentDecisionV1Enabled, setParentWorkspaceView]);

  useEffect(() => {
    if (!notificationsOpen && !settingsOpen && !quickActionsOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (topbarNotificationsRef.current?.contains(target)) return;
      if (topbarSettingsRef.current?.contains(target)) return;
      if (settingsPopoverRef.current?.contains(target)) return;
      if (topbarNotificationsPopoverRef.current?.contains(target)) return;
      if (topbarQuickActionsRef.current?.contains(target)) return;
      setNotificationsOpen(false);
      setSettingsOpen(false);
      setQuickActionsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [notificationsOpen, settingsOpen, quickActionsOpen]);

  useEffect(() => {
    if (!settingsOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [settingsOpen]);

  useEffect(() => {
    const quickView = new URLSearchParams(window.location.search).get('quick');
    if (quickView === 'overview' || quickView === 'tasks' || quickView === 'analysis' || quickView === 'planning' || quickView === 'exams') {
      setParentWorkspaceView(normalizeParentWorkspaceView(quickView));
      setUserType(UserType.Parent);
    }
  }, [setParentWorkspaceView, setUserType]);

  useEffect(() => {
    if (!isE2EMode) return;
    setIsParentLocked(false);
    setLoginError(null);
  }, [isE2EMode, setIsParentLocked]);

  useEffect(() => {
    const { courses: nextCourses, courseIdAliases } = normalizeCoursesWithAliases(courses);
    const nextTasks = tasks.map((task) => {
      const normalizedTask = normalizeTask(task);
      return {
        ...normalizedTask,
        courseId: remapCourseId(normalizedTask.courseId, courseIdAliases),
      };
    });
    const nextPerformance = dedupePerformanceData(
      normalizePerformanceData(performanceData).map((item) => ({
        ...item,
        courseId: remapCourseId(item.courseId, courseIdAliases),
      })),
      nextCourses,
    );
    const nextRewards = normalizeRewards(rewards);
    const nextBadges = normalizeBadges(badges);
    const nextCurriculum = normalizeCurriculum(curriculum);
    const nextSchedule = normalizeWeeklySchedule(weeklySchedule);
    const nextExamRecords = normalizeExamRecords(examRecords, nextCourses);
    const nextCompositeExamResults = normalizeCompositeExamResults(compositeExamResults, nextCourses);
    const nextExamSchedules = normalizeExamScheduleEntries(examScheduleEntries, nextCourses);

    if (JSON.stringify(nextCourses) !== JSON.stringify(courses)) setCourses(nextCourses);
    if (JSON.stringify(nextTasks) !== JSON.stringify(tasks)) setTasks(nextTasks);
    if (JSON.stringify(nextPerformance) !== JSON.stringify(performanceData)) setPerformanceData(nextPerformance);
    if (JSON.stringify(nextRewards) !== JSON.stringify(rewards)) setRewards(nextRewards);
    if (JSON.stringify(nextBadges) !== JSON.stringify(badges)) setBadges(nextBadges);
    if (JSON.stringify(nextCurriculum) !== JSON.stringify(curriculum)) setCurriculum(nextCurriculum);
    if (JSON.stringify(nextSchedule) !== JSON.stringify(weeklySchedule)) setWeeklySchedule(nextSchedule);
    if (JSON.stringify(nextExamRecords) !== JSON.stringify(examRecords)) setExamRecords(nextExamRecords);
    if (JSON.stringify(nextCompositeExamResults) !== JSON.stringify(compositeExamResults)) setCompositeExamResults(nextCompositeExamResults);
    if (JSON.stringify(nextExamSchedules) !== JSON.stringify(examScheduleEntries)) setExamScheduleEntries(nextExamSchedules);
    const nextPlanningSnapshot = derivePlanningEngineSnapshot(nextCurriculum, nextSchedule, normalizeStudyPlans(studyPlans), nextTasks, nextCourses, nextExamSchedules);
    if (JSON.stringify(nextPlanningSnapshot) !== JSON.stringify(planningEngineSnapshot)) setPlanningEngineSnapshot(nextPlanningSnapshot);
  }, []);

  useEffect(() => {
    if (!curriculumHydrated || !tasksHydrated) return;
    const subjectNames = Object.keys(curriculum || {});

    const nextCurriculumCourses = subjectNames.map((subjectName, index) => {
      const matched = courses.find((course) => normalizeForLookup(course.name) === normalizeForLookup(subjectName));
      if (matched) {
        return { ...matched, name: subjectName };
      }
      return {
        id: createId('course'),
        name: subjectName,
        active: true,
        order: courses.length + index,
        icon: 'BookOpen',
      };
    });
    const nextCurriculumCourseKeys = new Set(nextCurriculumCourses.map((course) => normalizeForLookup(course.name)));
    const retiredCourses = courses
      .filter((course) => !nextCurriculumCourseKeys.has(normalizeForLookup(course.name)))
      .map((course) => ({ ...course, active: false }));
    const nextCourses = sortCourses([...nextCurriculumCourses, ...retiredCourses]);

    if (JSON.stringify(nextCourses) !== JSON.stringify(courses)) {
      setCourses(nextCourses);
    }

    const validCourseIds = new Set(nextCourses.map((course) => course.id));
    const courseIdByName = new Map(nextCourses.map((course) => [normalizeForLookup(course.name), course.id]));
    setTasks((prevTasks) => {
      const nextTasks = prevTasks.map((task) => {
        if (validCourseIds.has(task.courseId)) return task;
        const titleCourseName = typeof task.title === 'string' ? task.title.split('/')[0]?.trim() : '';
        const remappedCourseId = courseIdByName.get(normalizeForLookup(titleCourseName || ''));
        return remappedCourseId ? { ...task, courseId: remappedCourseId } : task;
      });
      return JSON.stringify(nextTasks) === JSON.stringify(prevTasks) ? prevTasks : nextTasks;
    });
    setPerformanceData((prevPerformance) => {
      const nextPerformance = prevPerformance.map((item) => (
        validCourseIds.has(item.courseId) ? item : item
      ));
      return JSON.stringify(nextPerformance) === JSON.stringify(prevPerformance) ? prevPerformance : nextPerformance;
    });

    const validSubjectKeys = new Set(subjectNames.map((name) => normalizeForLookup(name)));
    setStudyPlans((prevPlans) => {
      const nextPlans = prevPlans
        .map((storedPlan) => ({
          ...storedPlan,
          plan: Object.fromEntries(
            Object.entries(storedPlan.plan).filter(([subjectName]) => validSubjectKeys.has(normalizeForLookup(subjectName))),
          ) as StudyPlan,
        }))
        .filter((storedPlan) => Object.keys(storedPlan.plan).length > 0);

      return JSON.stringify(nextPlans) === JSON.stringify(prevPlans) ? prevPlans : nextPlans;
    });
  }, [curriculum, courses, setCourses, setPerformanceData, setStudyPlans, setTasks, curriculumHydrated, tasksHydrated]);

  useEffect(() => {
    const nextPlanningSnapshot = derivePlanningEngineSnapshot(curriculum, weeklySchedule, studyPlans, tasks, courses, examScheduleEntries);
    if (JSON.stringify(nextPlanningSnapshot) !== JSON.stringify(planningEngineSnapshot)) {
      setPlanningEngineSnapshot(nextPlanningSnapshot);
    }
  }, [courses, curriculum, examScheduleEntries, planningEngineSnapshot, setPlanningEngineSnapshot, studyPlans, tasks, weeklySchedule]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const apiKey = import.meta.env.VITE_GOOGLE_AI_API_KEY;
  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  const addToast = (message: string, type: ToastMessage['type'], action?: Pick<ToastMessage, 'actionLabel' | 'onAction'>) => {
    if (type === 'error') playHaptic('warning');
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type, ...action }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  };

  const recordSchoolTopicHistory = useCallback((entry: Omit<SchoolTopicHistoryEntry, 'id' | 'createdAt'>) => {
    const createdAt = new Date().toISOString();
    const nextEntry: SchoolTopicHistoryEntry = {
      ...entry,
      id: `school_topic_${entry.date}_${entry.dayName}_${entry.slotId}`,
      createdAt,
    };
    setSchoolTopicHistory((prev) => normalizeSchoolTopicHistory([
      nextEntry,
      ...prev.filter((item) => !(item.date === entry.date && item.dayName === entry.dayName && item.slotId === entry.slotId)),
    ]));
  }, [setSchoolTopicHistory]);

  const remoteAppData = useMemo<RemoteAppData>(() => ({
    courses,
    tasks,
    performanceData,
    rewards,
    badges,
    successPoints,
    curriculum,
    weeklySchedule,
    schoolTopicHistory,
    examRecords,
    compositeExamResults,
    examScheduleEntries,
    studyPlans,
    planningEngineSnapshot,
  }), [badges, compositeExamResults, courses, curriculum, examRecords, examScheduleEntries, performanceData, planningEngineSnapshot, rewards, schoolTopicHistory, studyPlans, successPoints, tasks, weeklySchedule]);
  remoteAppDataRef.current = remoteAppData;

  const applyRemoteAppData = useCallback((payload: RemoteAppData) => {
    remoteApplyingRef.current = true;

    const incomingTasks = normalizeSafeTasks(payload.tasks);

    // 1. Yeni görev atama uyarısı (çocuk tarafında)
    if (userType === UserType.Child && remoteHydratedRef.current && tasksRef.current.length > 0) {
      const existingIds = new Set(tasksRef.current.map((t) => t.id));
      const newAssignedTasks = incomingTasks.filter((t) => !existingIds.has(t.id) && t.status === 'bekliyor');
      if (newAssignedTasks.length > 0) {
        newAssignedTasks.forEach((t) => {
          addToast(`Yeni görev atandı: ${t.title}`, 'success');
        });
      }
    }

    // 2. Aktif seansı ve tamamlanmış yerel görevleri veli güncellemelerinden koruma (Smart Merge)
    const finalTasks = mergeTasksByLatestMutation(tasksRef.current, incomingTasks);

    setCourses(normalizeSafeCourses(payload.courses));
    setTasks(finalTasks);
    setPerformanceData(normalizeSafeArray<PerformanceData>(payload.performanceData));
    setRewards(normalizeSafeRewards(payload.rewards));
    setBadges(normalizeSafeBadges(payload.badges));
    setSuccessPoints(normalizeSafeNumber(payload.successPoints));
    setCurriculum(normalizeSafeCurriculum(payload.curriculum));
    setWeeklySchedule(normalizeWeeklySchedule(payload.weeklySchedule || defaultWeeklySchedule));
    setSchoolTopicHistory(normalizeSchoolTopicHistory(payload.schoolTopicHistory));
    setExamRecords(normalizeSafeArray<ExamRecord>(payload.examRecords));
    setCompositeExamResults(normalizeSafeArray<CompositeExamResult>(payload.compositeExamResults));
    setExamScheduleEntries(normalizeSafeArray<ExamScheduleEntry>(payload.examScheduleEntries));
    setStudyPlans(normalizeStudyPlans(payload.studyPlans));
    setPlanningEngineSnapshot(normalizePlanningEngineSnapshot(payload.planningEngineSnapshot || defaultPlanningEngineSnapshot));
    window.setTimeout(() => {
      remoteApplyingRef.current = false;
    }, 0);
  }, [setBadges, setCompositeExamResults, setCourses, setCurriculum, setExamRecords, setExamScheduleEntries, setPerformanceData, setPlanningEngineSnapshot, setRewards, setSchoolTopicHistory, setStudyPlans, setSuccessPoints, setTasks, setWeeklySchedule, userType, addToast]);

  useEffect(() => {
    if (isRemoteSyncDisabled || !allIdbStatesHydrated) return;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    void import('./utils/firebaseLiveSync').then(({ startRemoteAppDataSync }) => startRemoteAppDataSync({
      onReady: () => {
        if (cancelled) return;
        remoteSyncReadyRef.current = true;
      },
      onRemoteMissing: () => {
        if (cancelled) return;
        remoteRevisionRef.current = 0;
        remoteHydratedRef.current = true;
      },
      onRemoteData: ({ appData, syncRevision }) => {
        if (cancelled) return;
        const migrationState = window.localStorage.getItem('drCleanLiveTestDataV3');
        if (migrationState === 'pending') {
          window.localStorage.setItem('drCleanLiveTestDataV3', 'disabled');
        }
        const serialized = JSON.stringify(appData);
        if (remoteLocalDirtyRef.current) {
          const localSnapshot = remoteAppDataRef.current;
          remoteRevisionRef.current = syncRevision;
          remoteHydratedRef.current = true;
          if (localSnapshot) {
            applyRemoteAppData({
              ...appData,
              ...localSnapshot,
              tasks: mergeTasksByLatestMutation(normalizeSafeTasks(localSnapshot.tasks), normalizeSafeTasks(appData.tasks)),
            });
          }
          return;
        }
        if (serialized === remoteLastSerializedRef.current) {
          remoteHydratedRef.current = true;
          return;
        }
        remoteLastSerializedRef.current = serialized;
        remoteRevisionRef.current = syncRevision;
        remoteHydratedRef.current = true;
        applyRemoteAppData(appData);
      },
      onError: (error) => {
        console.error('Firebase live sync error:', error);
        addToast('Canli senkron baglanamadi. Yerel kayit devam ediyor.', 'error');
      },
    })).then((nextUnsubscribe) => {
      if (cancelled) {
        nextUnsubscribe();
        return;
      }
      unsubscribe = nextUnsubscribe;
    }).catch((error) => {
      console.error('Firebase live sync startup error:', error);
      addToast('Canli senkron baslatilamadi. Firebase Auth kontrol edilmeli.', 'error');
    });

    return () => {
      cancelled = true;
      if (remotePublishTimerRef.current) window.clearTimeout(remotePublishTimerRef.current);
      unsubscribe?.();
    };
  }, [addToast, applyRemoteAppData, isRemoteSyncDisabled, allIdbStatesHydrated]);

  useEffect(() => {
    if (isRemoteSyncDisabled || !remoteSyncReadyRef.current || !remoteHydratedRef.current || remoteApplyingRef.current || !allIdbStatesHydrated) return;
    const serialized = JSON.stringify(remoteAppData);
    if (serialized === remoteLastSerializedRef.current) return;

    if (remotePublishTimerRef.current) window.clearTimeout(remotePublishTimerRef.current);
    remotePublishTimerRef.current = window.setTimeout(() => {
      remotePublishInFlightRef.current = true;
      void import('./utils/firebaseLiveSync')
        .then(({ publishRemoteAppData }) => publishRemoteAppData(remoteAppData, remoteRevisionRef.current))
        .then((nextRevision) => {
          remoteRevisionRef.current = nextRevision;
          remoteLastSerializedRef.current = serialized;
          remoteLocalDirtyRef.current = false;
        })
        .catch((error) => {
          console.error('Firebase live publish error:', error);
          if (error instanceof Error && error.name === 'RemoteWriteConflictError') {
            addToast('Başka cihazda yeni değişiklik var. Yerel veriniz korunuyor; yenileyip tekrar deneyin.', 'error');
            return;
          }
          addToast('Canli veri Firebasee yazilamadi.', 'error');
        })
        .finally(() => {
          remotePublishInFlightRef.current = false;
        });
    }, 1000);
  }, [addToast, isRemoteSyncDisabled, remoteAppData, allIdbStatesHydrated]);

  const handleContinueTask = (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
      addToast('Devam edilecek görev bulunamadı.', 'error');
      return;
    }

    const timerState = window.localStorage.getItem(`timerState_${taskId}`);
    if (!timerState) {
      addToast('Bu görev için kayıtlı bir devam oturumu yok.', 'error');
      return;
    }

    window.localStorage.setItem('resumeTaskId', taskId);
    setUserType(UserType.Child);
    addToast(`'${task.title}' görevine geri dönülüyor.`, 'success');
  };

  const handleUnlockParentDashboard = (password: string) => {
    if (password === '1234' || password === 'password123') {
      playHaptic('success');
      setIsParentLocked(false);
      setParentWorkspaceView(rememberLastParentView ? parentWorkspaceView : parentDefaultView);
      setLoginError(null);
      return;
    }
    playHaptic('warning');
    setLoginError('Sifre eslesmedi. Lutfen tekrar deneyin.');
  };

  const handleOpenDataManagement = () => {
    setDataAccessModalOpen(true);
    setDataAccessPassword('');
    setDataAccessGranted(false);
    setDataAccessError(null);
  };

  useEffect(() => {
    if (!dataAccessModalOpen || dataAccessGranted) return;
    const candidate = dataAccessPassword.trim();
    if (candidate.length === 0) {
      setDataAccessError(null);
      return;
    }
    if (candidate === '1234' || candidate === 'password123') {
      playHaptic('success');
      setDataAccessGranted(true);
      setDataAccessError(null);
      return;
    }
    if (candidate.length >= 4) {
      setDataAccessError('Sifre eslesmedi. Tekrar deneyin.');
    } else {
      setDataAccessError(null);
    }
  }, [dataAccessModalOpen, dataAccessGranted, dataAccessPassword]);

  const handleUserTypeChange = (nextUserType: UserType) => {
    if (nextUserType !== userType) playHaptic('selection');
    if (isE2EMode) {
      setIsParentLocked(false);
      setLoginError(null);
      setUserType(nextUserType);
      return;
    }
    if (nextUserType === UserType.Parent) {
      setIsParentLocked(true);
      setLoginError(null);
    }
    if (nextUserType === UserType.Child) {
      setIsParentLocked(true);
      setLoginError(null);
    }
    setUserType(nextUserType);
  };

  const applyImportedData = (payload: Record<string, unknown>): void => {
    const parsedSuccessPoints = Number(payload.successPoints);
    const { courses: normalizedCourses, courseIdAliases } = normalizeCoursesWithAliases(payload.courses as Course[]);
    const nextTasks = (payload.tasks as Task[]).map((task) => {
      const normalizedTask = normalizeTask(task);
      return { ...normalizedTask, courseId: remapCourseId(normalizedTask.courseId, courseIdAliases) };
    });
    const nextPerformanceData = dedupePerformanceData(
      normalizePerformanceData(Array.isArray(payload.performanceData) ? payload.performanceData : []).map((item) => ({
        ...item, courseId: remapCourseId(item.courseId, courseIdAliases),
      })),
      normalizedCourses,
    );
    const nextRewards = normalizeRewards(payload.rewards as Reward[]);
    const nextBadges = normalizeBadges(payload.badges as Badge[]);
    const nextCurriculum = normalizeCurriculum(payload.curriculum);
    const nextWeeklySchedule = normalizeWeeklySchedule(payload.weeklySchedule || defaultWeeklySchedule);
    const nextSchoolTopicHistory = normalizeSchoolTopicHistory(payload.schoolTopicHistory);
    const nextExamRecords = normalizeExamRecords(Array.isArray(payload.examRecords) ? payload.examRecords : [], normalizedCourses);
    const nextCompositeExamResults = normalizeCompositeExamResults(Array.isArray(payload.compositeExamResults) ? payload.compositeExamResults : [], normalizedCourses);
    const nextExamScheduleEntries = normalizeExamScheduleEntries(Array.isArray(payload.examScheduleEntries) ? payload.examScheduleEntries : [], normalizedCourses);
    const nextStudyPlans = normalizeStudyPlans(payload.studyPlans);

    setCourses(normalizedCourses);
    setTasks(nextTasks);
    setPerformanceData(nextPerformanceData);
    setRewards(nextRewards);
    setBadges(nextBadges);
    setSuccessPoints(parsedSuccessPoints);
    setCurriculum(nextCurriculum);
    setWeeklySchedule(nextWeeklySchedule);
    setSchoolTopicHistory(nextSchoolTopicHistory);
    setExamRecords(nextExamRecords);
    setCompositeExamResults(nextCompositeExamResults);
    setExamScheduleEntries(nextExamScheduleEntries);
    setStudyPlans(nextStudyPlans);
  };

  const handleExportData = async (): Promise<void> => {
    const appData = {
      courses,
      tasks,
      performanceData,
      rewards,
      badges,
      successPoints,
      curriculum,
      weeklySchedule,
      schoolTopicHistory,
      examRecords,
      compositeExamResults,
      examScheduleEntries,
      studyPlans,
    };
    const data = {
      backup: {
        app: 'Ders Rotasi',
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        summary: {
          courses: courses.length,
          tasks: tasks.length,
          rewards: rewards.length,
          badges: badges.length,
          examRecords: examRecords.length,
          studyPlans: studyPlans.length,
          schoolTopicHistory: schoolTopicHistory.length,
        },
      },
      appData,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ders-rotasi-yedek-${getLocalDateString()}.json`;
    document.body.appendChild(link);
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    addToast('Yedek indirildi. Dosya indirilenler klasörünü kontrol et.', 'success');
  };

  const handleDeleteAllData = async (): Promise<void> => {
    setCourses([]);
    setTasks([]);
    setPerformanceData([]);
    setRewards([]);
    setStudyPlans([]);
    setCurriculum({});
    setWeeklySchedule(defaultWeeklySchedule);
    setSchoolTopicHistory([]);
    setExamRecords([]);
    setCompositeExamResults([]);
    setExamScheduleEntries([]);
    setBadges([{ id: 'b1', name: 'İlk Adım', description: 'İlk görevini tamamladın!', icon: BadgeCheck }]);
    setSuccessPoints(0);
    setIsParentLocked(true);
    setLoginError(null);
    academicStorageKeys.forEach((key) => window.localStorage.removeItem(key));
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith('timerState_'))
      .forEach((key) => window.localStorage.removeItem(key));
    await clearIndexedDbKeys(academicStorageKeys).catch(() => undefined);
    addToast('Tüm veriler başarıyla silindi.', 'success');
  };

  const handleImportDataNew = async (file: File): Promise<boolean> => {
    try {
      if (file.size > MAX_IMPORT_BYTES) {
        addToast('Yedek dosyası 25 MB sınırını aşıyor.', 'error');
        return false;
      }
      const document = JSON.parse(await file.text());
      const validation = validateImportDocument(document);
      if (!validation.ok) {
        addToast(`Geçersiz yedek dosyası: ${validation.error}`, 'error');
        return false;
      }
      await handleExportData();
      applyImportedData(validation.payload);
      addToast('Mevcut verinin güvenlik yedeği indirildi ve yeni veriler içe aktarıldı.', 'success');
      return true;
    } catch (error) {
      console.error('Import error:', error);
      addToast('İçe aktarma uygulanmadı; mevcut veriler korundu.', 'error');
      return false;
    }
  };

  const generateReport = async (period: 'Haftal\u0131k' | 'Ayl\u0131k' | '3 Ayl\u0131k' | 'Y\u0131ll\u0131k' | 'T\u00fcm Zamanlar'): Promise<ReportData | null> => {
    const now = new Date();
    const startDate = new Date(now);

    if (period === 'Haftal\u0131k') startDate.setDate(now.getDate() - 7);
    if (period === 'Ayl\u0131k') startDate.setMonth(now.getMonth() - 1);
    if (period === '3 Ayl\u0131k') startDate.setMonth(now.getMonth() - 3);
    if (period === 'Y\u0131ll\u0131k') startDate.setFullYear(now.getFullYear() - 1);

    const completedTasks = tasks.filter((task) => {
      if (!isCompletedTask(task) || !task.completionDate) return false;
      if (period === 'T\u00fcm Zamanlar') return true;
      const taskDate = new Date(`${task.completionDate}T00:00:00`);
      return taskDate >= startDate;
    });

    if (completedTasks.length === 0) {
      return {
        period,
        aiSummary: 'Seçilen dönem için tamamlanmış görev yok.',
        highlights: {
          mostImproved: 'Veri oluştukça burada güçlü alanlar gösterilecek.',
          needsFocus: 'Yeni tamamlanan görevlerle odak alanı hesaplanacak.',
        },
        aiSuggestion: 'Önce düzenli görev tamamlama akışını oturtalım, sonra daha derin analizler çıkaracağız.',
      };
    }

    const courseStats = new Map<string, { count: number; success: number; focus: number; duration: number }>();
    completedTasks.forEach((task) => {
      const current = courseStats.get(task.courseId) || { count: 0, success: 0, focus: 0, duration: 0 };
      current.count += 1;
      current.success += task.successScore || 0;
      current.focus += task.focusScore || 0;
      current.duration += task.actualDuration || 0;
      courseStats.set(task.courseId, current);
    });

    const rankedCourses = [...courseStats.entries()].map(([courseId, stats]) => ({
      courseId,
      courseName: courses.find((course) => course.id === courseId)?.name || courseId,
      averageSuccess: stats.success / stats.count,
      averageFocus: stats.focus / stats.count,
      count: stats.count,
      durationMinutes: Math.round(stats.duration / 60),
    })).sort((a, b) => b.averageSuccess - a.averageSuccess);

    const strongest = rankedCourses[0];
    const weakest = [...rankedCourses].sort((a, b) => a.averageSuccess - b.averageSuccess)[0];
    const averageSuccess = Math.round(completedTasks.reduce((sum, task) => sum + (task.successScore || 0), 0) / completedTasks.length);
    const averageFocus = Math.round(completedTasks.reduce((sum, task) => sum + (task.focusScore || 0), 0) / completedTasks.length);
    const totalMinutes = Math.round(completedTasks.reduce((sum, task) => sum + (task.actualDuration || 0), 0) / 60);

    return {
      period,
      aiSummary: `${completedTasks.length} görev tamamlandı. Ortalama başarı ${averageSuccess}, ortalama odak ${averageFocus}, toplam çalışma ${totalMinutes} dakika.`,
      highlights: {
        mostImproved: strongest ? `${strongest.courseName} dersi şu an en güçlü alan. Ortalama başarı ${Math.round(strongest.averageSuccess)}.` : 'Yeterli veri yok.',
        needsFocus: weakest ? `${weakest.courseName} dersi daha fazla tekrar istiyor. Ortalama başarı ${Math.round(weakest.averageSuccess)}.` : 'Yeterli veri yok.',
      },
      aiSuggestion: weakest ? `${weakest.courseName} için daha kısa ama daha sık çalışma blokları ve konu bazlı tekrar görevleri planlanmalı.` : 'Düzenli plan ve görev tamamlama devam etmeli.',
    };
  };

  const addCourse = (courseName: string) => {
    const normalizedCourseName = repairedText(courseName).trim();
    if (!normalizedCourseName) return;
    const existingCourse = courses.find((course) => normalizeForLookup(course.name) === normalizeForLookup(normalizedCourseName));
    if (existingCourse) {
      if (existingCourse.active === false) {
        setCourses((prev) => sortCourses(prev.map((course) => (
          course.id === existingCourse.id ? { ...course, name: normalizedCourseName, active: true } : course
        ))));
      }
      setPerformanceData((prev) => (
        prev.some((item) => item.courseId === existingCourse.id)
          ? prev
          : [...prev, { courseId: existingCourse.id, courseName: existingCourse.name, correct: 0, incorrect: 0, timeSpent: 0 }]
      ));
      remoteLocalDirtyRef.current = true;
      return;
    }

    const randomIcon = ALL_ICONS[courses.length % ALL_ICONS.length];
    const nextOrder = courses.reduce((maxOrder, course) => Math.max(maxOrder, course.order), -1) + 1;
    const newCourse: Course = {
      id: createId('course'),
      name: normalizedCourseName,
      active: true,
      order: nextOrder,
      icon: randomIcon,
    };
    setCourses((prev) => sortCourses([newCourse, ...prev]));
    setPerformanceData((prev) => [...prev, { courseId: newCourse.id, courseName: normalizedCourseName, correct: 0, incorrect: 0, timeSpent: 0 }]);
    remoteLocalDirtyRef.current = true;
  };

  const handleDeleteCourseRequest = (courseId: string) => {
    const course = courses.find((item) => item.id === courseId);
    if (!course) return;
    setCourseToDelete(course);
    setShowDeleteCourseModal(true);
  };

  const confirmDeleteCourse = () => {
    if (!courseToDelete) return;
    const inactiveCourse = courseToDelete;
    setCourses((prev) => prev.map((course) => (
      course.id === inactiveCourse.id ? { ...course, active: false } : course
    )));
    setCourseToDelete(null);
    setShowDeleteCourseModal(false);
    remoteLocalDirtyRef.current = true;
    addToast("'" + inactiveCourse.name + "' dersi pasifleştirildi. Geçmiş görev, sınav ve analiz kayıtları korundu.", 'success');
  };

  const reactivateCourse = (courseId: string) => {
    const course = courses.find((item) => item.id === courseId);
    if (!course) return;
    setCourses((prev) => sortCourses(prev.map((item) => (
      item.id === courseId ? { ...item, active: true } : item
    ))));
    remoteLocalDirtyRef.current = true;
    addToast("'" + course.name + "' dersi tekrar aktif edildi.", 'success');
  };

  const getPendingTaskDuplicateKey = (task: Pick<Task, 'dueDate' | 'courseId' | 'title' | 'taskType' | 'curriculumUnitName' | 'curriculumTopicName' | 'isSelfAssigned'>) => [
    getLocalDateString(parseDate(task.dueDate || getLocalDateString())),
    normalizeForLookup(task.courseId),
    normalizeForLookup(task.title),
    normalizeForLookup(task.taskType),
    normalizeForLookup(task.curriculumUnitName || ''),
    normalizeForLookup(task.curriculumTopicName || ''),
    task.isSelfAssigned ? 'self' : 'assigned',
  ].join('::');

  const normalizeTaskDraft = (task: Omit<Task, 'id' | 'status'>): Omit<Task, 'id' | 'status'> => {
    const plannedDuration = Number(task.plannedDuration);
    if (!Number.isFinite(plannedDuration) || plannedDuration <= 0) {
      throw new Error('Görev süresi 0 dakikadan büyük olmalı.');
    }

    const matchedCourse = courses.find((course) => course.id === task.courseId);
    if (!matchedCourse || matchedCourse.active === false) {
      throw new Error('Bu ders pasif olduğu için yeni görev oluşturulamaz.');
    }

    const rawQuestionCount = typeof task.questionCount === 'number' ? task.questionCount : Number(task.questionCount);
    const questionCount = Number.isFinite(rawQuestionCount) && rawQuestionCount > 0
      ? Math.round(rawQuestionCount)
      : undefined;

    const normalizedTitle = task.title.trim();
    if (!normalizedTitle) throw new Error('Görev başlığı boş olamaz.');
    const normalizedDueDate = getLocalDateString(parseDate(task.dueDate || getLocalDateString()));
    if (normalizedDueDate < getLocalDateString()) throw new Error('Geçmiş bir tarihe yeni görev atanamaz.');

    return {
      ...task,
      dueDate: normalizedDueDate,
      title: normalizedTitle,
      plannedDuration: Math.round(plannedDuration),
      ...(questionCount ? { questionCount } : { questionCount: undefined }),
    };
  };
  const addTask = async (task: Omit<Task, 'id' | 'status'>): Promise<Task> => {
    const normalizedTask = normalizeTaskDraft(task);

    if (normalizedTask.planTaskId) {
      const existingTask = tasksRef.current.find((item) => item.planTaskId === normalizedTask.planTaskId);
      if (existingTask) {
        return existingTask;
      }
    }

    const duplicateKey = getPendingTaskDuplicateKey(normalizedTask);
    const duplicatePendingTask = tasksRef.current.find((item) => item.status === 'bekliyor' && getPendingTaskDuplicateKey(item) === duplicateKey);
    if (duplicatePendingTask) {
      return duplicatePendingTask;
    }

    const mutationTime = new Date().toISOString();
    const newTask: Task = {
      ...normalizedTask,
      id: createId('task'),
      status: 'bekliyor',
      createdAt: mutationTime,
      updatedAt: mutationTime,
    };
    const nextTasks = [newTask, ...tasksRef.current];
    remoteLocalDirtyRef.current = true;
    setTasks((prev) => {
      if (normalizedTask.planTaskId) {
        const duplicate = prev.find((item) => item.planTaskId === normalizedTask.planTaskId);
        if (duplicate) return prev;
      }
      const hasDuplicate = prev.some((item) => item.status === 'bekliyor' && getPendingTaskDuplicateKey(item) === duplicateKey);
      if (hasDuplicate) return prev;
      return [newTask, ...prev];
    });
    tasksRef.current = nextTasks;
    void writeIndexedDbValue('tasks', nextTasks).catch((error) => {
      console.error('Error immediately persisting assigned task:', error);
    });
    return newTask;
  };

  const syncStudyPlanTaskCompletion = (planTaskId: string, completed: boolean) => {
    setStudyPlans((prevPlans) => {
      const nextPlans = JSON.parse(JSON.stringify(prevPlans)) as StoredStudyPlan[];
      let changed = false;
      for (const storedPlan of nextPlans) {
        for (const subjectPlan of Object.values(storedPlan.plan)) {
          for (const unit of subjectPlan.units) {
            for (const topic of unit.topics) {
              const planTask = topic.tasks.find((item) => item.id === planTaskId);
              if (planTask) {
                planTask.completed = completed;
                changed = true;
              }
            }
          }
        }
      }
      return changed ? pruneStudyPlanTree(nextPlans) : prevPlans;
    });
  };

  const syncCurriculumTopicCompletion = (task: Task) => {
    if (!task.curriculumUnitName || !task.curriculumTopicName) return;

    const qualifiesForCompletion =
      (isQuestionTask(task) && (task.successScore || 0) >= 70) ||
      (task.taskType === 'ders \u00e7al\u0131\u015fma' && (task.focusScore || 0) >= 80 && (task.actualDuration || 0) >= task.plannedDuration * 60 * 0.8) ||
      (task.taskType === 'kitap okuma' && (task.pagesRead || 0) >= 10);

    if (!qualifiesForCompletion) return;

    const courseName = courses.find((course) => course.id === task.courseId)?.name;
    if (!courseName) return;

    setCurriculum((prevCurriculum) => {
      if (!task.curriculumUnitName || !task.curriculumTopicName) return prevCurriculum;
      const nextCurriculum = JSON.parse(JSON.stringify(prevCurriculum)) as SubjectCurriculum;
      const directUnits = nextCurriculum[courseName] || [];
      const normalizedCourseName = normalizeForLookup(courseName);
      const matchedSubject = nextCurriculum[courseName]
        ? courseName
        : Object.keys(nextCurriculum).find((subject) => normalizeForLookup(subject) === normalizedCourseName);
      if (!matchedSubject) return prevCurriculum;

      const subjectUnits = nextCurriculum[matchedSubject] || directUnits;
      const normalizedUnitName = normalizeForLookup(task.curriculumUnitName);
      const normalizedTopicName = normalizeForLookup(task.curriculumTopicName);
      const unit = subjectUnits.find((item) => normalizeForLookup(item.name) === normalizedUnitName);
      const topic = unit?.topics.find((item) => normalizeForLookup(item.name) === normalizedTopicName);
      if (!topic) return prevCurriculum;
      topic.completed = true;
      return nextCurriculum;
    });
  };

  const deleteTask = (taskId: string) => {
    const taskToDelete = tasks.find((task) => task.id === taskId);
    if (!taskToDelete) return;
    const previousIndex = tasks.findIndex((task) => task.id === taskId);
    const previousPlans = studyPlans;
    const nextTasks = tasksRef.current.filter((task) => task.id !== taskId);
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    tasksRef.current = nextTasks;
    remoteLocalDirtyRef.current = true;
    void writeIndexedDbValue('tasks', nextTasks).catch((error) => {
      console.error('Error immediately persisting deleted task:', error);
    });

    if (taskToDelete?.planTaskId) {
      setStudyPlans((prevPlans) => {
        const nextPlans = JSON.parse(JSON.stringify(prevPlans)) as StoredStudyPlan[];
        let changed = false;
        for (const storedPlan of nextPlans) {
          for (const subjectPlan of Object.values(storedPlan.plan)) {
            for (const unit of subjectPlan.units) {
              for (const topic of unit.topics) {
                const beforeCount = topic.tasks.length;
                topic.tasks = topic.tasks.filter((item) => item.id !== taskToDelete.planTaskId);
                if (topic.tasks.length !== beforeCount) changed = true;
              }
            }
          }
        }
        return changed ? pruneStudyPlanTree(nextPlans) : prevPlans;
      });
    }

    addToast(`"${taskToDelete.title}" silindi.`, 'success', {
      actionLabel: 'Geri al',
      onAction: () => {
        setTasks((prev) => {
          if (prev.some((task) => task.id === taskToDelete.id)) return prev;
          const next = [...prev];
          next.splice(Math.max(0, previousIndex), 0, taskToDelete);
          return next;
        });
        setStudyPlans(previousPlans);
        tasksRef.current = [taskToDelete, ...tasksRef.current.filter((task) => task.id !== taskToDelete.id)];
        remoteLocalDirtyRef.current = true;
        playHaptic('success');
      },
    });
  };

  const startTask = (taskId: string) => {
    playHaptic('start');
    setTasks((prevTasks) => prevTasks.map((task) => (task.id === taskId ? { ...task, startTimestamp: task.startTimestamp || Date.now(), updatedAt: new Date().toISOString() } : task)));
    remoteLocalDirtyRef.current = true;
  };

  const updateTaskLiveSession = (taskId: string, liveSession?: TaskLiveSession) => {
    setTasks((prevTasks) => prevTasks.map((task) => {
      if (task.id !== taskId || isCompletedTask(task)) return task;
      const nextLiveSession = liveSession ? normalizeTaskLiveSession(liveSession) : undefined;
      const currentSerialized = JSON.stringify(task.liveSession || null);
      const nextSerialized = JSON.stringify(nextLiveSession || null);
      return currentSerialized === nextSerialized ? task : { ...task, liveSession: nextLiveSession, updatedAt: new Date().toISOString() };
    }));
    remoteLocalDirtyRef.current = true;
  };

  const completeTask = (taskId: string, data: TaskCompletionData) => {
    if (completeTaskLockRef.current.has(taskId)) return;
    completeTaskLockRef.current.add(taskId);

    try {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
      console.error('Tamamlanacak görev bulunamadı:', taskId);
      return;
    }

    // Idempotency guard: ignore duplicate completion calls for already completed tasks.
    if (isCompletedTask(task)) {
      return;
    }

    const correctAnswers = isQuestionTask(task) ? data.correctCount || 0 : 0;
    const incorrectAnswers = isQuestionTask(task) ? data.incorrectCount || 0 : 0;
    const emptyAnswers = isQuestionTask(task) ? data.emptyCount || 0 : 0;
    const plannedSeconds = task.plannedDuration * 60;
    const totalSessionTime = data.actualDuration + data.breakTime + data.pauseTime;

    let focusScore = 100;
    if (totalSessionTime > 0) {
      let score = 100;
      const distractionRatio = (data.breakTime + data.pauseTime) / totalSessionTime;
      score -= distractionRatio * 50;
      if (data.actualDuration > plannedSeconds) {
        const overtimeRatio = (data.actualDuration - plannedSeconds) / plannedSeconds;
        score -= overtimeRatio * 50;
      }
      focusScore = Math.max(0, Math.min(100, score));
    }

    let successScore = focusScore;
    if (isQuestionTask(task) && task.questionCount && task.questionCount > 0) {
      const accuracy = getSuccessPercent({ ...task, correctCount: correctAnswers, incorrectCount: incorrectAnswers, emptyCount: emptyAnswers });
      successScore = Math.max(0, Math.min(100, accuracy));
    }

    const normalizedSelfAssessment = typeof data.selfAssessmentScore === 'number'
      ? Math.max(0, Math.min(100, Math.round(data.selfAssessmentScore)))
      : undefined;
    const confidenceGap = typeof normalizedSelfAssessment === 'number'
      ? Math.round(normalizedSelfAssessment - successScore)
      : undefined;

    const scoringResult = calculateTaskPoints(task, data, successScore, focusScore);
    const hasExplicitErrorBreakdown =
      typeof data.conceptErrorCount === 'number' ||
      typeof data.processErrorCount === 'number' ||
      typeof data.attentionErrorCount === 'number';
    const conceptErrorCount = isQuestionTask(task) ? Math.max(0, data.conceptErrorCount || 0) : 0;
    const processErrorCount = isQuestionTask(task)
      ? Math.max(0, data.processErrorCount ?? (hasExplicitErrorBreakdown ? 0 : incorrectAnswers))
      : 0;
    const attentionErrorCount = isQuestionTask(task)
      ? Math.max(0, data.attentionErrorCount ?? (hasExplicitErrorBreakdown ? 0 : emptyAnswers))
      : 0;
    const completionTimestamp = typeof data.completionTimestamp === 'number' && Number.isFinite(data.completionTimestamp) && data.completionTimestamp > 0
      ? data.completionTimestamp
      : Date.now();
    const completionDate = data.completionDate || getLocalDateString(new Date(completionTimestamp));
    const inferredStartTimestamp = typeof data.startTimestamp === 'number' && Number.isFinite(data.startTimestamp) && data.startTimestamp > 0
      ? data.startTimestamp
      : data.actualDuration > 0
        ? Math.max(0, completionTimestamp - data.actualDuration * 1000)
        : completionTimestamp;

    const completedTask: Task = {
      ...task,
      status: 'tamamland\u0131',
      ...data,
      pagesRead: data.pagesRead,
      startTimestamp: task.startTimestamp || inferredStartTimestamp,
      completionDate,
      completionTimestamp,
      correctCount: correctAnswers,
      incorrectCount: incorrectAnswers,
      emptyCount: emptyAnswers,
      firstAttemptScore: typeof task.firstAttemptScore === 'number' ? task.firstAttemptScore : Math.round(successScore),
      selfAssessmentScore: normalizedSelfAssessment,
      confidenceGap,
      conceptErrorCount,
      processErrorCount,
      attentionErrorCount,
      successScore: Math.round(successScore),
      focusScore: Math.round(focusScore),
      pointsAwarded: scoringResult.pointsAwarded,
      liveSession: undefined,
      updatedAt: new Date(completionTimestamp).toISOString(),
    };

    setTasks((prevTasks) => prevTasks.map((item) => (item.id === taskId ? completedTask : item)));
    setSuccessPoints((prev) => prev + scoringResult.pointsAwarded);
    remoteLocalDirtyRef.current = true;

    if (task.taskType !== 'kitap okuma') {
      setPerformanceData((prevData) => prevData.map((item) => {
        if (item.courseId !== task.courseId) return item;
        return {
          ...item,
          correct: item.correct + correctAnswers,
          incorrect: item.incorrect + incorrectAnswers,
          timeSpent: item.timeSpent + Math.round(data.actualDuration / 60),
        };
      }));
    }

    if (task.planTaskId) syncStudyPlanTaskCompletion(task.planTaskId, true);
    syncCurriculumTopicCompletion(task);
    playHaptic('success');
    } finally {
      window.setTimeout(() => completeTaskLockRef.current.delete(taskId), 350);
    }
  };

  const updateTaskStatus = (taskId: string, status: 'bekliyor' | 'tamamland\u0131') => {
    setTasks((prevTasks) => prevTasks.map((task) => (task.id === taskId ? { ...task, status, updatedAt: new Date().toISOString() } : task)));
    remoteLocalDirtyRef.current = true;
  };

  const updateTaskFromPlan = (planTaskId: string, updates: Partial<Pick<Task, 'plannedDuration' | 'questionCount' | 'planLabel'>>) => {
    setTasks((prevTasks) => prevTasks.map((task) => {
      if (task.planTaskId !== planTaskId) return task;
      return {
        ...task,
        ...(typeof updates.plannedDuration === 'number' ? { plannedDuration: updates.plannedDuration } : {}),
        ...(typeof updates.questionCount === 'number' ? { questionCount: updates.questionCount } : {}),
        ...(typeof updates.planLabel === 'string' ? { planLabel: updates.planLabel } : {}),
        updatedAt: new Date().toISOString(),
      };
    }));
    remoteLocalDirtyRef.current = true;
  };

  const addReward = (reward: Omit<Reward, 'id'>) => {
    const newReward: Reward = { ...reward, id: createId('reward') };
    setRewards((prev) => [newReward, ...prev]);
    remoteLocalDirtyRef.current = true;
  };

  const deleteReward = (rewardId: string) => {
    setRewards((prev) => prev.filter((reward) => reward.id !== rewardId));
    remoteLocalDirtyRef.current = true;
  };

  const claimReward = (rewardId: string) => {
    if (rewardClaimLockRef.current.has(rewardId)) return;

    const reward = rewards.find((item) => item.id === rewardId);
    if (!reward) return;

    rewardClaimLockRef.current.add(rewardId);

    if (successPoints < reward.cost) {
      addToast('Bu ödülü almak için yeterli puanınız yok.', 'error');
      window.setTimeout(() => rewardClaimLockRef.current.delete(rewardId), 250);
      return;
    }

    setSuccessPoints((prev) => prev - reward.cost);
    remoteLocalDirtyRef.current = true;
    addToast(`'${reward.name}' ödülü talep edildi.`, 'success');
    window.setTimeout(() => rewardClaimLockRef.current.delete(rewardId), 350);
  };

  const parentAnalysisResult = useMemo(
    () => deriveAnalysisSnapshotSafe(tasks, courses, studyPlans, examRecords, compositeExamResults),
    [tasks, courses, studyPlans, examRecords, compositeExamResults],
  );
  const parentAnalysis = parentAnalysisResult.snapshot;
  const parentAnalysisRuntimeError = parentAnalysisResult.runtimeError;
  useEffect(() => {
    const signature = JSON.stringify({
      tasks: tasks.length,
      courses: courses.length,
      sessions: parentAnalysis.sessions.length,
      completed: parentAnalysis.overall.completedTasks,
      weakTopics: parentAnalysis.topics.filter((topic) => topic.needsRevision).length,
    });
    const isHit = analysisCacheSignatureRef.current === signature;
    analysisCacheSignatureRef.current = signature;
    setAnalysisPipelineState((prev) => ({
      ...prev,
      cacheHits: prev.cacheHits + (isHit ? 1 : 0),
      cacheMisses: prev.cacheMisses + (isHit ? 0 : 1),
      cacheVersion: prev.cacheVersion + (isHit ? 0 : 1),
    }));
  }, [
    courses.length,
    parentAnalysis.overall.completedTasks,
    parentAnalysis.sessions.length,
    parentAnalysis.topics,
    setAnalysisPipelineState,
    tasks.length,
  ]);
  const pushObservabilityEvent = useCallback((event: Omit<ObservabilityEvent, 'id'> & { id?: string }) => {
    const id = event.id || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (processedEventIdsRef.current.has(id)) return;
    processedEventIdsRef.current.add(id);
    setObservabilityEvents((prev) => [...prev.slice(-119), { ...event, id }]);
  }, [setObservabilityEvents]);
  const emitPipelineEvent = useCallback(
    (
      sourceEventId: string,
      type: ObservabilityEvent['type'],
      meta: Record<string, string | number | boolean | null>,
    ) => {
      const token = `${sourceEventId}:${type}`;
      if (processedSourceTokensRef.current.has(token)) return;
      processedSourceTokensRef.current.add(token);
      setAnalysisPipelineState((prev) => {
        if (prev.processedSourceEventIds.includes(token)) return prev;
        return {
          ...prev,
          processedSourceEventIds: [...prev.processedSourceEventIds, token].slice(-300),
        };
      });
      pushObservabilityEvent({
        ts: new Date().toISOString(),
        type,
        sourceEventId,
        meta,
      });
    },
    [pushObservabilityEvent, setAnalysisPipelineState],
  );
  const observabilitySummary = useMemo(() => {
    const recent = observabilityEvents.slice(-30);
    const typeMap = recent.reduce<Record<string, number>>((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {});
    const topTypeEntry = Object.entries(typeMap).sort((a, b) => b[1] - a[1])[0];
    return {
      total: observabilityEvents.length,
      recentCount: recent.length,
      topType: topTypeEntry?.[0] || null,
      topTypeCount: topTypeEntry?.[1] || 0,
      lastEventTs: observabilityEvents[observabilityEvents.length - 1]?.ts || null,
    };
  }, [observabilityEvents]);
  const observabilityRecent = useMemo(() => (
    observabilityEvents
      .slice(-5)
      .reverse()
      .map((event) => ({
        ts: event.ts,
        type: event.type,
        note: Object.entries(event.meta)
          .slice(0, 2)
          .map(([key, value]) => `${key}:${String(value)}`)
          .join(' · '),
      }))
  ), [observabilityEvents]);
  const exportObservabilityAudit = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      versionMeta: { engine: 'none' },
      summary: observabilitySummary,
      pipeline: analysisPipelineState,
      recent: observabilityRecent,
      events: observabilityEvents,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `parent-observability-audit-${getLocalDateString()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    addToast('Audit kaydi indirildi.', 'success');
  }, [analysisPipelineState, observabilityEvents, observabilityRecent, observabilitySummary, addToast]);
  useEffect(() => {
    if (!settingsTelemetryInitRef.current) {
      settingsTelemetryInitRef.current = true;
      return;
    }
    pushObservabilityEvent({
      ts: new Date().toISOString(),
      type: 'settings_change',
      meta: {
        notifications_muted: notificationsMuted,
        haptics_enabled: hapticsEnabled,
        theme_mode: themeMode,
        remember_last_parent_view: rememberLastParentView,
        decision_v1_enabled: parentDecisionV1Enabled,
      },
    });
  }, [
    hapticsEnabled,
    notificationsMuted,
    parentDecisionV1Enabled,
    rememberLastParentView,
    themeMode,
    pushObservabilityEvent,
  ]);


  useEffect(() => {
    const sourceEventId = `evt-src-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    emitPipelineEvent(sourceEventId, 'event_pipeline', {
      trigger: 'input_change',
      task_count: tasks.length,
      course_count: courses.length,
      exam_count: examRecords.length,
      composite_exam_count: compositeExamResults.length,
    });
    emitPipelineEvent(sourceEventId, 'background_recompute', {
      mode: 'on_change',
      analysis_sessions: parentAnalysis.sessions.length,
      weak_topic_count: parentAnalysis.topics.filter((topic) => topic.needsRevision).length,
    });
  }, [
    tasks.length,
    courses.length,
    examRecords.length,
    compositeExamResults.length,
    parentAnalysis.sessions.length,
    parentAnalysis.topics,
    emitPipelineEvent,
  ]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const sourceEventId = `evt-src-bg-${Date.now()}`;
      emitPipelineEvent(sourceEventId, 'background_recompute', {
        mode: 'scheduled',
        interval_min: 5,
        task_count: tasks.length,
        analysis_sessions: parentAnalysis.sessions.length,
      });
      setAnalysisPipelineState((prev) => ({
        ...prev,
        lastBackgroundRecomputeAt: new Date().toISOString(),
      }));

      const now = new Date();
      const todayKey = getLocalDateString(now);
      const weekKey = getLocalWeekKey(now);
      if (prevDayKeyRef.current !== todayKey) {
        prevDayKeyRef.current = todayKey;
        const dailySource = `evt-src-daily-${todayKey}`;
        emitPipelineEvent(dailySource, 'background_recompute', { mode: 'daily_summary', day: todayKey });
        setAnalysisPipelineState((prev) => ({ ...prev, lastDailySummaryAt: new Date().toISOString() }));
      }
      if (prevWeekKeyRef.current !== weekKey) {
        prevWeekKeyRef.current = weekKey;
        const weeklySource = `evt-src-weekly-${weekKey}`;
        emitPipelineEvent(weeklySource, 'background_recompute', { mode: 'weekly_summary', week: weekKey });
        setAnalysisPipelineState((prev) => ({ ...prev, lastWeeklySummaryAt: new Date().toISOString() }));
      }
    }, 5 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [tasks.length, parentAnalysis.sessions.length, emitPipelineEvent, setAnalysisPipelineState]);
  const [today, setToday] = useState(() => getLocalDateString());
  useEffect(() => {
    let midnightTimer = 0;
    const refreshDay = () => setToday((current) => {
      const next = getLocalDateString();
      return current === next ? current : next;
    });
    const scheduleMidnightRefresh = () => {
      window.clearTimeout(midnightTimer);
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      midnightTimer = window.setTimeout(() => { refreshDay(); scheduleMidnightRefresh(); }, Math.max(1000, nextMidnight.getTime() - now.getTime() + 250));
    };
    const handleVisibility = () => { if (document.visibilityState === 'visible') refreshDay(); };
    window.addEventListener('focus', refreshDay);
    document.addEventListener('visibilitychange', handleVisibility);
    scheduleMidnightRefresh();
    return () => {
      window.clearTimeout(midnightTimer);
      window.removeEventListener('focus', refreshDay);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);
  const hasParentOperationalData = useMemo(
    () => courses.length > 0 || tasks.length > 0 || studyPlans.length > 0,
    [courses.length, tasks.length, studyPlans.length],
  );
  const analyzedSessionCount = parentAnalysis.sessions.length;
  const hasParentAnalysisData = useMemo(
    () => analyzedSessionCount > 0 && parentAnalysis.overall.completedTasks > 0,
    [analyzedSessionCount, parentAnalysis.overall.completedTasks],
  );
  const parentFocus7d = useMemo(() => calculateRecentFocusAverage(tasks, 7, today), [tasks, today]);
  const parentAccuracyTrend14d = useMemo(() => calculateAccuracyTrend14Days(tasks, today), [tasks, today]);
  const parentOverdueRate = useMemo(() => calculateOverdueRate(tasks, today), [tasks, today]);
  const parentDeterminismPassed = useMemo(() => {
    if (parentWorkspaceView !== 'analysis') return true;
    if (parentAnalysisRuntimeError) return false;
    const secondRun = deriveAnalysisSnapshotSafe(tasks, courses, studyPlans, examRecords, compositeExamResults);
    return !secondRun.runtimeError && JSON.stringify(parentAnalysis) === JSON.stringify(secondRun.snapshot);
  }, [tasks, courses, studyPlans, examRecords, compositeExamResults, parentAnalysis, parentWorkspaceView, parentAnalysisRuntimeError]);
  const parentSummary = useMemo(
    () => ({
      pendingCount: tasks.filter((task) => task.status === 'bekliyor').length,
      completedCount: tasks.filter((task) => isCompletedTask(task)).length,
      overdueCount: tasks.filter((task) => task.status === 'bekliyor' && task.dueDate < today).length,
      overdueRate: parentOverdueRate,
      focus7d: parentFocus7d,
      accuracyTrend14d: parentAccuracyTrend14d,
      weakTopics: parentAnalysis.topics.filter((topic) => topic.needsRevision).slice(0, 4),
      allCourses: [...parentAnalysis.courses].sort((a, b) => b.averageMastery - a.averageMastery),
      riskLevel: getRiskLevel({
        overdueRate: parentOverdueRate,
        focus7d: parentFocus7d,
        accuracyDelta: parentAccuracyTrend14d.delta,
        weakTopicCount: parentAnalysis.topics.filter((topic) => topic.needsRevision).length,
      }),
      deterministicCheckPassed: parentDeterminismPassed,
      lastCompletedTask: [...tasks]
        .filter((task) => isCompletedTask(task) && getTaskCompletionSortValue(task) > 0)
        .sort((a, b) => getTaskCompletionSortValue(b) - getTaskCompletionSortValue(a))[0],
    }),
    [tasks, parentAnalysis, today, parentOverdueRate, parentFocus7d, parentAccuracyTrend14d, parentDeterminismPassed],
  );
  const suspiciousDataSummary = useMemo(() => {
    const completed = tasks.filter((task) => isCompletedTask(task));
    const suspicious = completed.filter((task) => {
      const duration = Number(task.actualDuration || 0);
      const questions = Number(task.questionCount || 0);
      const hasAccuracy = Number.isFinite(task.correctCount) || Number.isFinite(task.incorrectCount);
      const hasPayload = duration > 0 || questions > 0 || hasAccuracy;

      const idleLongSession = duration >= 3 * 60 * 60 && questions <= 0 && !hasAccuracy;
      const impossibleSpeed = questions >= 80 && duration > 0 && duration <= 120;
      const emptyCompletion = !hasPayload;
      return idleLongSession || impossibleSpeed || emptyCompletion;
    });

    const ratio = completed.length > 0 ? Math.round((suspicious.length / completed.length) * 100) : 0;
    return {
      suspiciousCount: suspicious.length,
      completedCount: completed.length,
      suspiciousRatio: ratio,
      hasSuspiciousData: suspicious.length > 0,
    };
  }, [tasks]);
  const parentRecommendation = useMemo(() => {
    if (!hasParentAnalysisData) {
      if (hasParentOperationalData) {
        return 'Görev ve plan verisi mevcut; analiz önerisi için önce tamamlanan oturum birikmeli.';
      }
      return 'Analiz verisi oluştukça bugüne ait öneriler burada gösterilecek.';
    }
    if (parentSummary.overdueCount > 0) {
      return `Öncelik: takipteki ${parentSummary.overdueCount} görevi tamamlayıp ritmi toparla.`;
    }
    const firstWeak = parentSummary.weakTopics[0];
    if (firstWeak) {
      return `Öncelik: ${firstWeak.courseName} / ${firstWeak.topicName} için 20-30 dk tekrar görevi ata.`;
    }
    return 'Durum dengeli. Bugün mevcut planı koruyup düzenli devam et.';
  }, [hasParentAnalysisData, hasParentOperationalData, parentSummary.overdueCount, parentSummary.weakTopics]);
  const overviewPeriodStartDate = useMemo(() => getOverviewPeriodStartDate(overviewStudyPeriod, today), [overviewStudyPeriod, today]);
  const overviewCompletedTasks = useMemo(() => {
    if (parentWorkspaceView !== 'overview') return [];
    const endDate = toDate(today);
    return tasks.filter((task) => isCompletedTask(task) && isTaskWithinRange(task, overviewPeriodStartDate, endDate));
  }, [tasks, overviewPeriodStartDate, today, parentWorkspaceView]);
  const overviewAnalysis = useMemo(
    () => {
      if (parentWorkspaceView !== 'overview') return parentAnalysis;
      return deriveAnalysisSnapshotSafe(overviewCompletedTasks, courses, studyPlans, examRecords, compositeExamResults).snapshot;
    },
    [overviewCompletedTasks, courses, studyPlans, examRecords, compositeExamResults, parentAnalysis, parentWorkspaceView],
  );

  const edgeCaseFlags = useMemo(() => ({
    lowDataSessions: parentAnalysis.sessions.length < 3,
    noExamData: compositeExamResults.length === 0,
    noPlanData: studyPlans.length === 0,
    suspiciousData: suspiciousDataSummary.hasSuspiciousData,
  }), [
    parentAnalysis.sessions.length,
    compositeExamResults.length,
    studyPlans.length,
    suspiciousDataSummary.hasSuspiciousData,
  ]);

  useEffect(() => {
    const signature = `${parentAnalysis.sessions.length}|${parentAnalysis.overall.generalScore}|${parentAnalysisRuntimeError || 'ok'}`;
    if (lastObservabilitySignatureRef.current === signature) return;
    lastObservabilitySignatureRef.current = signature;

    if (parentAnalysisRuntimeError) {
      pushObservabilityEvent({
        ts: new Date().toISOString(),
        type: 'analysis_runtime_error',
        meta: {
          message: parentAnalysisRuntimeError,
          sessions: parentAnalysis.sessions.length,
          score: parentAnalysis.overall.generalScore,
        },
      });
      return;
    }

    pushObservabilityEvent({
      ts: new Date().toISOString(),
      type: 'analysis_snapshot',
      meta: {
        sessions: parentAnalysis.sessions.length,
        score: parentAnalysis.overall.generalScore,
        weak_topics: parentAnalysis.topics.filter((topic) => topic.needsRevision).length,
        edge_low_data_sessions: edgeCaseFlags.lowDataSessions,
        edge_no_exam_data: edgeCaseFlags.noExamData,
        edge_no_plan_data: edgeCaseFlags.noPlanData,
        edge_suspicious_data: edgeCaseFlags.suspiciousData,
        suspicious_ratio: suspiciousDataSummary.suspiciousRatio,
      },
    });
  }, [
    edgeCaseFlags.lowDataSessions,
    edgeCaseFlags.noExamData,
    edgeCaseFlags.noPlanData,
    edgeCaseFlags.suspiciousData,
    parentAnalysis,
    parentAnalysisRuntimeError,
    pushObservabilityEvent,
    suspiciousDataSummary.suspiciousRatio,
  ]);
  const overviewAnalyzedSessionCount = overviewAnalysis.sessions.length;
  const hasOverviewAnalysisData = useMemo(
    () => overviewAnalyzedSessionCount > 0 && overviewAnalysis.overall.completedTasks > 0,
    [overviewAnalyzedSessionCount, overviewAnalysis.overall.completedTasks],
  );
  const overviewFocusAverage = useMemo(() => calculateFocusAverageForTasks(overviewCompletedTasks), [overviewCompletedTasks]);
  const overviewAccuracyTrend = useMemo(() => calculateAccuracyTrendForTasks(overviewCompletedTasks), [overviewCompletedTasks]);
  const overviewRiskLevel = useMemo(() => getRiskLevel({
    overdueRate: parentOverdueRate,
    focus7d: overviewFocusAverage,
    accuracyDelta: overviewAccuracyTrend.delta,
    weakTopicCount: overviewAnalysis.topics.filter((topic) => topic.needsRevision).length,
  }), [parentOverdueRate, overviewFocusAverage, overviewAccuracyTrend.delta, overviewAnalysis.topics]);
  const overviewSummary = useMemo(() => ({
    completedCount: overviewCompletedTasks.length,
    studiedMinutes: Math.round(overviewCompletedTasks.reduce((sum, task) => sum + ((task.actualDuration || 0) / 60), 0)),
    solvedQuestionCount: overviewCompletedTasks
      .filter(isQuestionTask)
      .reduce((sum, task) => sum + getSolvedQuestionCount(task), 0),
    averageMastery: overviewAnalysis.overall.averageMastery,
    generalScore: overviewAnalysis.overall.generalScore,
    weakTopics: overviewAnalysis.topics.filter((topic) => topic.needsRevision).slice(0, 4),
    allCourses: [...overviewAnalysis.courses].sort((a, b) => b.averageMastery - a.averageMastery),
    lastCompletedTask: [...overviewCompletedTasks].sort((a, b) => getTaskCompletionSortValue(b) - getTaskCompletionSortValue(a))[0],
  }), [overviewCompletedTasks, overviewAnalysis]);
  const overviewRecommendation = useMemo(() => {
    if (!hasOverviewAnalysisData) {
      if (hasParentOperationalData) {
        return 'Seçili dönemde yeterli tamamlanan çalışma biriktikçe daha net yorum gösterilecek.';
      }
      return 'Çalışma verisi oluştukça seçili dönem özeti burada gösterilecek.';
    }
    if (parentSummary.overdueCount > 0) {
      return `Genel tabloda ${parentSummary.overdueCount} takipteki görev var. Dönemsel gelişim korunurken önce bunları tamamlamak gerekir.`;
    }
    const firstWeak = overviewSummary.weakTopics[0];
    if (firstWeak) {
      return `${firstWeak.courseName} / ${firstWeak.topicName} seçili dönemde destek istiyor. Kısa tekrar görevi ile güçlendirilmeli.`;
    }
    return 'Seçili dönemde çalışma ritmi dengeli görünüyor. Mevcut akışı koruyabilirsiniz.';
  }, [hasOverviewAnalysisData, hasParentOperationalData, parentSummary.overdueCount, overviewSummary.weakTopics]);
  const curriculumSummary = useMemo(() => {
    const subjects = Object.keys(curriculum || {});
    const unitCount = subjects.reduce((sum, subject) => sum + (curriculum[subject]?.length || 0), 0);
    const topicCount = subjects.reduce((sum, subject) => sum + (curriculum[subject] || []).reduce((unitSum, unit) => unitSum + unit.topics.length, 0), 0);
    const completedTopicCount = subjects.reduce((sum, subject) => sum + (curriculum[subject] || []).reduce((unitSum, unit) => unitSum + unit.topics.filter((topic) => topic.completed).length, 0), 0);
    return { subjects, unitCount, topicCount, completedTopicCount };
  }, [curriculum]);
  const courseReferenceHealth = useMemo(() => {
    const courseIds = new Set(courses.map((course) => course.id));
    const courseNames = new Set(courses.map((course) => normalizeForLookup(course.name)));

    return {
      taskCount: tasks.filter((task) => !courseIds.has(task.courseId)).length,
      examRecordCount: examRecords.filter((record) => !courseIds.has(record.courseId)).length,
      compositeExamCount: compositeExamResults.reduce(
        (sum, result) => sum + result.courses.filter((course) => !courseIds.has(course.courseId)).length,
        0,
      ),
      examScheduleCount: examScheduleEntries.filter((entry) => !courseIds.has(entry.courseId)).length,
      performanceCount: performanceData.filter((item) => !courseIds.has(item.courseId)).length,
      scheduleBlockCount: SCHEDULE_DAYS.reduce((sum, day) => {
        const dayState = weeklySchedule[day];
        const slots = Array.isArray(dayState?.slots) ? dayState.slots : [];
        return sum + slots.filter((slot) => !courseNames.has(normalizeForLookup(slot.courseName))).length;
      }, 0),
    };
  }, [courses, tasks, examRecords, compositeExamResults, examScheduleEntries, performanceData, weeklySchedule]);

  const overviewTodayName = useMemo(() => {
    const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    return dayNames[new Date().getDay()];
  }, []);
  const overviewTodaySlots = useMemo(() => {
    const day = weeklySchedule[overviewTodayName];
    const slots = Array.isArray(day?.slots) ? day.slots : [];
    return [...slots].sort((left, right) => left.startTime.localeCompare(right.startTime)).slice(0, 4);
  }, [overviewTodayName, weeklySchedule]);
  const overviewNextTask = useMemo(() => {
    return [...tasks]
      .filter((task) => task.status === 'bekliyor')
      .sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.title.localeCompare(right.title, 'tr'))[0];
  }, [tasks]);
  const overviewTodayOperational = useMemo(() => {
    const pendingToday = tasks.filter((task) => task.status === 'bekliyor' && task.dueDate <= today);
    const completedToday = tasks.filter((task) => isCompletedTask(task) && task.completionDate === today);
    return {
      plannedCount: pendingToday.length + completedToday.length,
      completedTodayCount: completedToday.length,
      pendingTodayCount: pendingToday.length,
      overdueCount: tasks.filter((task) => task.status === 'bekliyor' && task.dueDate < today).length,
    };
  }, [tasks, today]);
  const overviewTodayCompletedTasks = useMemo(() => {
    return tasks
      .filter((task) => isCompletedTask(task) && task.completionDate === today)
      .sort((left, right) => (right.completionTimestamp || 0) - (left.completionTimestamp || 0))
      .slice(0, 3)
      .map((task) => ({
        id: task.id,
        title: task.title,
        courseName: (courses.find((course) => course.id === task.courseId)?.name) || task.courseId,
      }));
  }, [courses, tasks, today]);
  const overviewWeakTopicActions = useMemo(() => {
    return overviewAnalysis.topics.filter((topic) => topic.needsRevision).slice(0, 3).map((topic) => {
      const linkedTask = tasks.find((task) =>
        task.status === 'bekliyor'
        && task.courseId === topic.courseId
        && normalizeForLookup(task.curriculumTopicName || '') === normalizeForLookup(topic.topicName)
      );
      const taskStatus = linkedTask
        ? 'Atandi · Bekliyor'
        : 'Henuz atanmadi';
      const reason = topic.riskScore >= 65
        ? `Risk puani ${topic.riskScore}. Bu konuda acil destek gerekiyor.`
        : topic.masteryScore < 70
          ? `Kavrama puani ${topic.masteryScore}. Konu tekrarina ihtiyac var.`
          : 'Son calismalarda istikrar dusuk, kisa tekrar gerekli.';
      const action = linkedTask
        ? `${Math.max(15, linkedTask.plannedDuration || 20)} dk tekrar`
        : '20 dk tekrar + 15 soru';
      return {
        key: topic.key,
        courseName: topic.courseName,
        topicName: topic.topicName,
        reason,
        action,
        taskStatus,
      };
    });
  }, [overviewSummary.weakTopics, tasks]);
  const overviewCourseNames = useMemo(
    () => courses.filter((course) => course.active !== false).map((course) => repairedText(course.name)),
    [courses],
  );
  const overviewWeeklyStats = useMemo(() => {
    const todayDate = new Date(`${today}T00:00:00`);
    const toDate = (value?: string) => (value ? new Date(`${value}T00:00:00`) : null);
    const isBetween = (value: Date | null, start: Date, end: Date) => Boolean(value && value >= start && value <= end);
    const completedWithDate = tasks
      .filter((task) => isCompletedTask(task) && task.completionDate)
      .map((task) => ({ task, completedAt: toDate(task.completionDate) }))
      .filter((item): item is { task: Task; completedAt: Date } => Boolean(item.completedAt))
      .filter((item) => item.completedAt <= todayDate)
      .sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());

    const fallbackStart = new Date(todayDate);
    fallbackStart.setDate(fallbackStart.getDate() - 6);
    let currentStart = fallbackStart;
    let currentEnd = todayDate;
    let previousStart = new Date(fallbackStart);
    let previousEnd = new Date(fallbackStart);

    if (overviewStudyPeriod === 'total') {
      if (completedWithDate.length > 0) {
        currentStart = new Date(completedWithDate[0].completedAt);
      }
      const rangeDays = Math.max(1, Math.floor((currentEnd.getTime() - currentStart.getTime()) / 86400000) + 1);
      previousEnd = new Date(currentStart);
      previousEnd.setDate(previousEnd.getDate() - 1);
      previousStart = new Date(previousEnd);
      previousStart.setDate(previousStart.getDate() - (rangeDays - 1));
    } else {
      const lookbackDays = getOverviewPeriodLookbackDays(overviewStudyPeriod);
      currentStart = new Date(todayDate);
      currentStart.setDate(currentStart.getDate() - Math.max(0, lookbackDays - 1));
      previousEnd = new Date(currentStart);
      previousEnd.setDate(previousEnd.getDate() - 1);
      previousStart = new Date(previousEnd);
      previousStart.setDate(previousStart.getDate() - Math.max(0, lookbackDays - 1));
    }

    const completedCurrentWeek = completedWithDate
      .filter((item) => isBetween(item.completedAt, currentStart, currentEnd))
      .map((item) => item.task);
    const completedPreviousWeek = completedWithDate
      .filter((item) => isBetween(item.completedAt, previousStart, previousEnd))
      .map((item) => item.task);
    const minutesCurrentWeek = Math.round(completedCurrentWeek.reduce((sum, task) => sum + ((task.actualDuration || 0) / 60), 0));
    const minutesPreviousWeek = Math.round(completedPreviousWeek.reduce((sum, task) => sum + ((task.actualDuration || 0) / 60), 0));
    const completionTarget = Math.max(
      completedCurrentWeek.length + tasks.filter((task) => task.status === 'bekliyor' && isBetween(toDate(task.dueDate), currentStart, currentEnd)).length,
      1,
    );
    const completionPercent = Math.max(0, Math.min(100, Math.round((completedCurrentWeek.length / completionTarget) * 100)));
    const minuteChange = minutesPreviousWeek > 0
      ? Math.round(((minutesCurrentWeek - minutesPreviousWeek) / minutesPreviousWeek) * 100)
      : (minutesCurrentWeek > 0 ? 100 : 0);
    const compositeWithDate = compositeExamResults
      .map((exam) => ({ exam, date: toDate(exam.date) }))
      .filter((item): item is { exam: CompositeExamResult; date: Date } => Boolean(item.date));
    const periodCompositeAverage = (start: Date, end: Date) => {
      const periodExams = compositeWithDate.filter((item) => isBetween(item.date, start, end));
      if (periodExams.length === 0) return null;
      const periodCourseScores = periodExams.flatMap((item) => item.exam.courses.map((course) => course.score));
      if (periodCourseScores.length === 0) return null;
      return Math.round(periodCourseScores.reduce((sum, score) => sum + score, 0) / periodCourseScores.length);
    };
    const latestCompositeAverage = periodCompositeAverage(currentStart, currentEnd);
    const previousCompositeAverage = periodCompositeAverage(previousStart, previousEnd);
    const examDelta = latestCompositeAverage !== null && previousCompositeAverage !== null
      ? latestCompositeAverage - previousCompositeAverage
      : 0;
    const hasExamTrendData = latestCompositeAverage !== null && previousCompositeAverage !== null;
    const solvedCurrent = completedCurrentWeek.reduce((sum, task) => {
      return sum + getSolvedQuestionCount(task);
    }, 0);
    const solvedPrevious = completedPreviousWeek.reduce((sum, task) => {
      return sum + getSolvedQuestionCount(task);
    }, 0);
    const solvedQuestionChange = solvedPrevious > 0
      ? Math.round(((solvedCurrent - solvedPrevious) / solvedPrevious) * 100)
      : (solvedCurrent > 0 ? 100 : 0);

    const dayMs = 86400000;
    const pointCount = getOverviewSparklinePointCount(overviewStudyPeriod);
    const totalRangeDays = Math.max(1, Math.floor((currentEnd.getTime() - currentStart.getTime()) / dayMs) + 1);
    const bucketSize = Math.max(1, Math.ceil(totalRangeDays / pointCount));
    const dailyAccuracyPointsRaw = Array.from({ length: pointCount }, (_, bucketIndex) => {
      const bucketStart = new Date(currentStart);
      bucketStart.setDate(bucketStart.getDate() + (bucketIndex * bucketSize));
      const bucketEnd = new Date(bucketStart);
      bucketEnd.setDate(bucketEnd.getDate() + bucketSize - 1);
      if (bucketEnd > currentEnd) bucketEnd.setTime(currentEnd.getTime());

      const bucketTasks = completedCurrentWeek.filter((task) => {
        const completionDate = toDate(task.completionDate);
        const answered = (task.correctCount || 0) + (task.incorrectCount || 0);
        const hasQuestionPayload = (task.questionCount || 0) > 0 || answered > 0;
        return hasQuestionPayload && isBetween(completionDate, bucketStart, bucketEnd);
      });
      const answered = bucketTasks.reduce((sum, task) => sum + getQuestionMetrics(task).answeredCount, 0);
      const correct = bucketTasks.reduce((sum, task) => sum + getQuestionMetrics(task).correctCount, 0);
      return answered > 0 ? Math.round((correct / answered) * 100) : null;
    });

    const dailyAccuracyPoints: number[] = [];
    let lastValAccuracy = 0;
    for (const val of dailyAccuracyPointsRaw) {
      if (val !== null) {
        lastValAccuracy = val;
      }
      dailyAccuracyPoints.push(lastValAccuracy);
    }

    return {
      completedCount: completedCurrentWeek.length,
      completionTarget,
      completionPercent,
      totalMinutes: minutesCurrentWeek,
      minuteChange,
      solvedQuestionCount: solvedCurrent,
      solvedQuestionChange,
      comparisonLabel: getOverviewComparisonLabel(overviewStudyPeriod),
      examDelta,
      hasExamTrendData,
      dailyAccuracyPoints,
    };
  }, [compositeExamResults, overviewStudyPeriod, tasks, today]);
  const [overviewWeeklyStatsFromWorker, setOverviewWeeklyStatsFromWorker] = useState<typeof overviewWeeklyStats | null>(null);

  useEffect(() => {
    const shouldUseWorker = parentWorkspaceView === 'overview' && tasks.length >= 1200;
    if (!shouldUseWorker) {
      setOverviewWeeklyStatsFromWorker(null);
      return;
    }

    const worker = new Worker(new URL('./workers/overview-metrics.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<typeof overviewWeeklyStats>) => {
      setOverviewWeeklyStatsFromWorker(event.data);
    };
    worker.postMessage({
      period: overviewStudyPeriod,
      today,
      tasks,
      compositeExamResults,
    });

    return () => {
      worker.terminate();
    };
  }, [compositeExamResults, overviewStudyPeriod, parentWorkspaceView, tasks, today]);
  const overviewWeeklyStatsForView = overviewWeeklyStatsFromWorker ?? overviewWeeklyStats;
  const overviewCourseInsights = useMemo(() => {
    const todayDate = new Date(`${today}T00:00:00`);
    const currentStart = new Date(todayDate);
    currentStart.setDate(currentStart.getDate() - 6);
    const previousEnd = new Date(currentStart);
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - 6);
    previousEnd.setHours(0, 0, 0, 0);
    previousStart.setHours(0, 0, 0, 0);
    const toDate = (value?: string) => (value ? new Date(`${value}T00:00:00`) : null);
    const isBetween = (value: Date | null, start: Date, end: Date) => Boolean(value && value >= start && value <= end);

    return courses
      .filter((course) => course.active !== false)
      .map((course) => {
        const courseAnalysis = overviewAnalysis.courses.find((item) => item.courseId === course.id);
        const weakCount = overviewSummary.weakTopics.filter((topic) => topic.courseName === courseAnalysis?.courseName || topic.courseName === course.name).length;
        const currentQuestionTasks = tasks.filter((task) => {
          if (!isCompletedTask(task) || task.courseId !== course.id || !isQuestionTask(task)) return false;
          return isBetween(toDate(task.completionDate), currentStart, todayDate);
        });
        const previousQuestionTasks = tasks.filter((task) => {
          if (!isCompletedTask(task) || task.courseId !== course.id || !isQuestionTask(task)) return false;
          return isBetween(toDate(task.completionDate), previousStart, previousEnd);
        });
        const calcAccuracy = (items: Task[]) => {
          const answered = items.reduce((sum, task) => sum + getQuestionMetrics(task).answeredCount, 0);
          const correct = items.reduce((sum, task) => sum + getQuestionMetrics(task).correctCount, 0);
          return answered > 0 ? Math.round((correct / answered) * 100) : 0;
        };
        const currentAccuracy = calcAccuracy(currentQuestionTasks);
        const previousAccuracy = calcAccuracy(previousQuestionTasks);
        const hasWeeklyData = currentQuestionTasks.length > 0 || previousQuestionTasks.length > 0;
        const change = hasWeeklyData ? (currentAccuracy - previousAccuracy) : null;
        return {
          courseName: repairedText(course.name),
          progress: Math.max(0, Math.min(100, Math.round(courseAnalysis?.averageMastery ?? 0))),
          weakCount,
          hasWeeklyData,
          change,
        };
      });
  }, [courses, overviewAnalysis.courses, overviewSummary.weakTopics, tasks, today]);
  const overviewTopicInsights = useMemo(() => {
    const todayDate = new Date(`${today}T00:00:00`);
    const currentStart = new Date(todayDate);
    currentStart.setDate(currentStart.getDate() - 6);
    const previousEnd = new Date(currentStart);
    previousEnd.setDate(previousEnd.getDate() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - 6);
    previousEnd.setHours(0, 0, 0, 0);
    previousStart.setHours(0, 0, 0, 0);
    const toDate = (value?: string) => (value ? new Date(`${value}T00:00:00`) : null);
    const isBetween = (value: Date | null, start: Date, end: Date) => Boolean(value && value >= start && value <= end);

    const courseNameById = new Map(
      courses.map((course) => [course.id, repairedText(course.name).trim()]),
    );
    const topicMap = new Map<string, {
      key: string;
      topicName: string;
      courseName: string;
      unitName: string;
      currentAnswered: number;
      currentCorrect: number;
      previousAnswered: number;
      previousCorrect: number;
    }>();

    Object.entries(curriculum).forEach(([rawCourseName, units]) => {
      const courseName = repairedText(rawCourseName).trim();
      if (!courseName || !Array.isArray(units)) return;
      units.forEach((unit) => {
        const unitName = repairedText(unit?.name || 'Unite belirtilmedi').trim() || 'Unite belirtilmedi';
        if (!unit || !Array.isArray(unit.topics)) return;
        unit.topics.forEach((topic) => {
          const topicName = repairedText(topic?.name || '').trim();
          if (!topicName) return;
          const key = `${normalizeForLookup(courseName)}::${normalizeForLookup(unitName)}::${normalizeForLookup(topicName)}`;
          if (!topicMap.has(key)) {
            topicMap.set(key, {
              key,
              topicName,
              courseName,
              unitName,
              currentAnswered: 0,
              currentCorrect: 0,
              previousAnswered: 0,
              previousCorrect: 0,
            });
          }
        });
      });
    });

    tasks.forEach((task) => {
      if (!isCompletedTask(task) || !isQuestionTask(task)) return;
      const topicName = repairedText(task.curriculumTopicName || '').trim();
      if (!topicName) return;
      const unitName = repairedText(task.curriculumUnitName || 'Unite belirtilmedi').trim() || 'Unite belirtilmedi';
      const courseName = repairedText(courseNameById.get(task.courseId) || task.courseId).trim();
      if (!courseName) return;
      const key = `${normalizeForLookup(courseName)}::${normalizeForLookup(unitName)}::${normalizeForLookup(topicName)}`;
      const metrics = getQuestionMetrics(task);
      const answered = metrics.answeredCount;
      if (answered <= 0) return;
      const correct = metrics.correctCount;
      const completedAt = toDate(task.completionDate);
      const item = topicMap.get(key) || {
        key,
        topicName,
        courseName,
        unitName,
        currentAnswered: 0,
        currentCorrect: 0,
        previousAnswered: 0,
        previousCorrect: 0,
      };
      if (isBetween(completedAt, currentStart, todayDate)) {
        item.currentAnswered += answered;
        item.currentCorrect += correct;
      } else if (isBetween(completedAt, previousStart, previousEnd)) {
        item.previousAnswered += answered;
        item.previousCorrect += correct;
      }
      topicMap.set(key, item);
    });

    const riskMap = new Map(
      overviewAnalysis.topics.map((topic) => [
        normalizeForLookup(`${topic.courseName}::${topic.unitName}::${topic.topicName}`),
        topic.riskScore
      ]),
    );

    return Array.from(topicMap.values()).map((item) => {
      const currentAccuracy = item.currentAnswered > 0 ? Math.round((item.currentCorrect / item.currentAnswered) * 100) : null;
      const previousAccuracy = item.previousAnswered > 0 ? Math.round((item.previousCorrect / item.previousAnswered) * 100) : null;
      const delta = currentAccuracy !== null && previousAccuracy !== null ? currentAccuracy - previousAccuracy : null;
      const riskScore = riskMap.get(normalizeForLookup(`${item.courseName}::${item.unitName}::${item.topicName}`)) ?? null;
      return {
        key: item.key,
        topicName: item.topicName,
        courseName: item.courseName,
        unitName: item.unitName,
        currentAccuracy,
        previousAccuracy,
        delta,
        riskScore,
      };
    });
  }, [courses, curriculum, overviewAnalysis.topics, tasks, today]);
  const overviewTopicMetricsMap = useMemo(() => {
    const completedTasks = tasks.filter((task) => isCompletedTask(task));
    const courseNameById = new Map(
      courses.map((course) => [course.id, repairedText(course.name)]),
    );
    const analysisTopicByKey = new Map(
      overviewAnalysis.topics.map((topic) => [
        normalizeForLookup(`${topic.courseName}::${topic.unitName}::${topic.topicName}`),
        topic,
      ]),
    );

    const entries = overviewTopicInsights.map((topic) => {
      const normalizedKey = normalizeForLookup(`${topic.courseName}::${topic.unitName}::${topic.topicName}`);
      const topicTasks = completedTasks.filter((task) => {
        const topicName = repairedText(task.curriculumTopicName || '');
        if (!topicName) return false;
        const unitName = repairedText(task.curriculumUnitName || 'Unite belirtilmedi');
        const courseName = repairedText(courseNameById.get(task.courseId) || task.courseId);
        return normalizeForLookup(`${courseName}::${unitName}::${topicName}`) === normalizedKey;
      });
      const solved = topicTasks.reduce((sum, task) => sum + getQuestionMetrics(task).answeredCount, 0);
      const correct = topicTasks.reduce((sum, task) => sum + getQuestionMetrics(task).correctCount, 0);
      const minutes = Math.round(topicTasks.reduce((sum, task) => sum + ((task.actualDuration || 0) / 60), 0));
      const analysisTopic = analysisTopicByKey.get(normalizedKey);
      const accuracyFallback = topic.currentAccuracy ?? analysisTopic?.masteryScore ?? 0;
      const accuracy = solved > 0 ? Math.round((correct / solved) * 100) : accuracyFallback;
      const conceptError = topicTasks.reduce((sum, task) => sum + (task.conceptErrorCount || 0), 0);
      const processError = topicTasks.reduce((sum, task) => sum + (task.processErrorCount || 0), 0);
      const attentionError = topicTasks.reduce((sum, task) => sum + (task.attentionErrorCount || 0), 0);
      const otherError = Math.max(
        0,
        topicTasks.reduce((sum, task) => sum + (task.incorrectCount || 0), 0) - (conceptError + processError + attentionError),
      );
      const riskScore = topic.riskScore ?? analysisTopic?.riskScore ?? 0;
      const avgEfficiency = analysisTopic?.averageEfficiency ?? accuracyFallback;
      const avgFocus = analysisTopic?.averageFocus ?? accuracyFallback;
      const masteryScore = analysisTopic?.masteryScore ?? accuracyFallback;

      const hasQuestionTask = topicTasks.some((task) => isQuestionTask(task) && task.status === 'tamamlandı');
      const hasExamTask = topicTasks.some((task) => (task.taskGoalType === 'sinav-hazirlik' || task.taskGoalType === 'olcme-degerlendirme') && task.status === 'tamamlandı');
      const hasRevisionTask = topicTasks.some((task) => task.taskGoalType === 'konu-tekrari' && task.status === 'tamamlandı');

      return [
        topic.key,
        {
          minutes,
          solved,
          accuracy,
          retryNeed: riskScore >= 65 ? 'Yuksek' : riskScore >= 45 ? 'Orta' : 'Dusuk',
          practicePerf: (solved > 0 || hasQuestionTask) ? Math.max(0, Math.min(100, Math.round((avgEfficiency * 0.45) + (accuracy * 0.55)))) : 0,
          testPerf: hasExamTask ? Math.max(0, Math.min(100, Math.round((masteryScore * 0.7) + (avgFocus * 0.3)))) : 0,
          dailyPerf: hasRevisionTask ? Math.max(0, Math.min(100, Math.round((avgFocus * 0.5) + (avgEfficiency * 0.5)))) : 0,
          errors: [
            { label: 'Islem Hatasi', value: conceptError },
            { label: 'Kavram Hatasi', value: processError },
            { label: 'Dikkat Hatasi', value: attentionError },
            { label: 'Diger', value: otherError },
          ],
        },
      ];
    });

    return Object.fromEntries(entries);
  }, [courses, overviewAnalysis.topics, overviewTopicInsights, tasks]);
  const overviewTopicPerformanceRows = useMemo(() => {
    const courseNameById = new Map(
      courses.map((course) => [course.id, repairedText(course.name)]),
    );
    const questionTasks = tasks.filter((task) => (
      isCompletedTask(task)
      && isQuestionTask(task)
      && (typeof task.correctCount === 'number'
        || typeof task.incorrectCount === 'number'
        || typeof task.emptyCount === 'number'
        || Number(task.questionCount || 0) > 0)
    ));

    const aggregate = new Map<string, {
      key: string;
      courseName: string;
      unitName: string;
      topicName: string;
      totalQuestions: number;
      correctCount: number;
      incorrectCount: number;
      emptyCount: number;
      minutes: number;
      taskCount: number;
      lastCompletedAt: string;
    }>();
    const analysisTopicByKey = new Map(
      overviewAnalysis.topics.map((topic) => [
        normalizeForLookup(`${topic.courseName}::${topic.unitName}::${topic.topicName}`),
        topic,
      ]),
    );
    const getLearningVelocityLabel = (taskCount: number, minutes: number, mastery: number) => {
      if (taskCount <= 0 && minutes <= 0) return 'Veri Yok';
      if (mastery >= 85 && taskCount <= 3 && minutes <= 240) return 'Hızlı Öğrenilen';
      if (taskCount >= 6 || minutes >= 600 || mastery < 70) return 'Zor Öğrenilen';
      return 'Normal';
    };
    const getTopicCostScore = (taskCount: number, minutes: number, questions: number) => {
      const sessionCost = Math.min(40, taskCount * 5);
      const timeCost = Math.min(35, minutes / 18);
      const questionCost = Math.min(25, questions / 20);
      return Math.max(0, Math.min(100, Math.round(sessionCost + timeCost + questionCost)));
    };
    const getTopicCostLabel = (score: number) => {
      if (score >= 75) return 'Çok Yüksek Çaba';
      if (score >= 55) return 'Yüksek Çaba';
      if (score >= 35) return 'Orta Çaba';
      return 'Düşük Çaba';
    };

    Object.entries(curriculum).forEach(([rawCourseName, units]) => {
      const courseName = repairedText(rawCourseName).trim();
      if (!courseName || !Array.isArray(units)) return;
      units.forEach((unit) => {
        const unitName = repairedText(unit?.name || 'Unite belirtilmedi').trim() || 'Unite belirtilmedi';
        if (!unit || !Array.isArray(unit.topics)) return;
        unit.topics.forEach((topic) => {
          const topicName = repairedText(topic?.name || 'Konu belirtilmedi').trim() || 'Konu belirtilmedi';
          const key = `${normalizeForLookup(courseName)}::${normalizeForLookup(unitName)}::${normalizeForLookup(topicName)}`;
          if (!aggregate.has(key)) {
            aggregate.set(key, {
              key,
              courseName,
              unitName,
              topicName,
              totalQuestions: 0,
              correctCount: 0,
              incorrectCount: 0,
              emptyCount: 0,
              minutes: 0,
              taskCount: 0,
              lastCompletedAt: '',
            });
          }
        });
      });
    });

    questionTasks.forEach((task) => {
      const courseName = repairedText(courseNameById.get(task.courseId) || task.courseId || 'Ders').trim();
      const unitName = repairedText(task.curriculumUnitName || 'Unite belirtilmedi').trim() || 'Unite belirtilmedi';
      const topicName = repairedText(task.curriculumTopicName || 'Konu belirtilmedi').trim() || 'Konu belirtilmedi';
      const key = `${normalizeForLookup(courseName)}::${normalizeForLookup(unitName)}::${normalizeForLookup(topicName)}`;
      const record = aggregate.get(key) || {
        key,
        courseName,
        unitName,
        topicName,
        totalQuestions: 0,
        correctCount: 0,
        incorrectCount: 0,
        emptyCount: 0,
        minutes: 0,
        taskCount: 0,
        lastCompletedAt: '',
      };

      const correct = Math.max(0, Number(task.correctCount || 0));
      const incorrect = Math.max(0, Number(task.incorrectCount || 0));
      const empty = Math.max(0, Number(task.emptyCount || 0));
      const answeredTotal = correct + incorrect + empty;
      const metrics = getQuestionMetrics(task);

      record.correctCount += metrics.correctCount;
      record.incorrectCount += metrics.incorrectCount;
      record.emptyCount += metrics.emptyCount;
      record.totalQuestions += metrics.totalQuestionCount;
      record.minutes += Math.round((task.actualDuration || 0) / 60);
      record.taskCount += 1;
      if (task.completionDate && task.completionDate > record.lastCompletedAt) {
        record.lastCompletedAt = task.completionDate;
      }
      aggregate.set(key, record);
    });

    return Array.from(aggregate.values())
      .map((item) => {
        const accuracyPercent = item.correctCount + item.incorrectCount > 0
          ? Math.round((item.correctCount / Math.max(1, item.correctCount + item.incorrectCount)) * 100)
          : 0;
        const analysisTopic = analysisTopicByKey.get(normalizeForLookup(`${item.courseName}::${item.unitName}::${item.topicName}`));
        const masteryScore = analysisTopic?.masteryScore ?? accuracyPercent;
        const costScore = getTopicCostScore(item.taskCount, item.minutes, item.totalQuestions);
        const velocityLabel = getLearningVelocityLabel(item.taskCount, item.minutes, masteryScore);
        const costLabel = getTopicCostLabel(costScore);
        const decisionText = item.taskCount <= 0
          ? 'Bu konu için henüz ölçümlü çalışma yok.'
          : costScore >= 75 && masteryScore < 82
            ? 'Bu konu için fazla süre/çaba harcanıyor; aynı yöntem yerine kısa tekrar ve karma test denenmeli.'
            : velocityLabel === 'Zor Öğrenilen'
              ? 'Bu konunun öğrenilme hızı yavaş görünüyor; daha küçük çalışma döngüleriyle takip edilmeli.'
              : 'Harcanan süre ve çaba dengeli seviyede.';
        return {
          ...item,
          accuracyPercent,
          masteryScore,
          learningVelocityLabel: velocityLabel,
          topicCostScore: costScore,
          topicCostLabel: costLabel,
          learningDecision: decisionText,
        };
      })
      .sort((a, b) => {
        const dateCompare = (b.lastCompletedAt || '').localeCompare(a.lastCompletedAt || '');
        if (dateCompare !== 0) return dateCompare;
        const courseCompare = a.courseName.localeCompare(b.courseName, 'tr');
        if (courseCompare !== 0) return courseCompare;
        const unitCompare = a.unitName.localeCompare(b.unitName, 'tr');
        if (unitCompare !== 0) return unitCompare;
        return a.topicName.localeCompare(b.topicName, 'tr');
      });
  }, [courses, curriculum, overviewAnalysis.topics, tasks]);
  const overviewReportSeries = useMemo(() => {
    const todayDate = new Date(`${today}T00:00:00`);
    const dayMs = 86400000;
    const toTaskDate = (value?: string) => (value ? new Date(`${value}T00:00:00`) : null);
    const startOfWeek = (date: Date) => {
      const copy = new Date(date);
      const day = copy.getDay();
      const diff = day === 0 ? 6 : day - 1;
      copy.setDate(copy.getDate() - diff);
      copy.setHours(0, 0, 0, 0);
      return copy;
    };
    const formatBucketLabel = (start: Date, end: Date, index: number) => {
      if (overviewStudyPeriod === 'week1') {
        const diff = Math.round((todayDate.getTime() - start.getTime()) / dayMs);
        return diff === 0 ? 'Bugun' : `G-${diff}`;
      }
      if (overviewStudyPeriod === 'week3') return `${index + 1}. Hafta`;
      if (overviewStudyPeriod === 'total') return `${index + 1}. Aralik`;
      return `${index + 1}. Bolum`;
    };
    const completedQuestionTasks = tasks
      .filter((task) => isCompletedTask(task) && task.completionDate && isQuestionTask(task))
      .map((task) => ({ task, date: toTaskDate(task.completionDate) }))
      .filter((item): item is { task: Task; date: Date } => Boolean(item.date && item.date <= todayDate));

    const makeBuckets = () => {
      if (overviewStudyPeriod === 'week1') {
        return Array.from({ length: 7 }, (_, index) => {
          const start = new Date(todayDate);
          start.setDate(start.getDate() - (6 - index));
          const end = new Date(start);
          return { start, end, label: formatBucketLabel(start, end, index) };
        });
      }

      const fixedRange = overviewStudyPeriod === 'week3'
        ? { days: 21, points: 3 }
        : overviewStudyPeriod === 'month'
          ? { days: 30, points: 10 }
          : overviewStudyPeriod === 'quarter'
            ? { days: 90, points: 12 }
            : null;

      if (fixedRange) {
        const rangeStart = new Date(todayDate);
        rangeStart.setDate(rangeStart.getDate() - (fixedRange.days - 1));
        const bucketSize = Math.max(1, Math.ceil(fixedRange.days / fixedRange.points));
        return Array.from({ length: fixedRange.points }, (_, index) => {
          const start = new Date(rangeStart);
          start.setDate(start.getDate() + index * bucketSize);
          const end = new Date(start);
          end.setDate(end.getDate() + bucketSize - 1);
          if (end > todayDate) end.setTime(todayDate.getTime());
          return { start, end, label: formatBucketLabel(start, end, index) };
        });
      }

      const firstDate = completedQuestionTasks.length > 0
        ? new Date(Math.min(...completedQuestionTasks.map((item) => item.date.getTime())))
        : new Date(todayDate);
      const totalDays = Math.max(1, Math.floor((todayDate.getTime() - firstDate.getTime()) / dayMs) + 1);
      const pointCount = Math.max(1, Math.min(12, Math.ceil(totalDays / 30)));
      const bucketSize = Math.max(1, Math.ceil(totalDays / pointCount));
      return Array.from({ length: pointCount }, (_, index) => {
        const start = new Date(firstDate);
        start.setDate(start.getDate() + index * bucketSize);
        const end = new Date(start);
        end.setDate(end.getDate() + bucketSize - 1);
        if (end > todayDate) end.setTime(todayDate.getTime());
        return { start, end, label: formatBucketLabel(start, end, index) };
      });
    };

    const buckets = makeBuckets();
    const coursePalette = ['#2563EB', '#16A34A', '#7C3AED', '#F59E0B', '#06B6D4', '#EC4899', '#64748B'];
    const activeCourses = courses.filter((course) => course.active !== false);
    return activeCourses.slice(0, 6).map((course, idx) => {
      const courseAnalysis = overviewAnalysis.courses.find((item) => item.courseId === course.id);
      const baseline = courseAnalysis ? Math.max(0, Math.min(100, Math.round(courseAnalysis.averageMastery ?? 0))) : 0;

      const rawPoints = buckets.map((bucket) => {
        const bucketTasks = completedQuestionTasks
          .filter(({ task, date }) => task.courseId === course.id && date >= bucket.start && date <= bucket.end)
          .map(({ task }) => task);
        const answered = bucketTasks.reduce((sum, task) => sum + getQuestionMetrics(task).answeredCount, 0);
        const correct = bucketTasks.reduce((sum, task) => sum + getQuestionMetrics(task).correctCount, 0);
        return answered > 0 ? Math.round((correct / answered) * 100) : null;
      });

      const points: number[] = [];
      let lastVal = baseline;

      for (const val of rawPoints) {
        if (val !== null) {
          lastVal = val;
        }
        points.push(lastVal);
      }

      return {
        courseName: repairedText(course.name),
        color: coursePalette[idx % coursePalette.length],
        labels: buckets.map((bucket) => bucket.label),
        points,
      };
    });
  }, [courses, overviewAnalysis.courses, overviewStudyPeriod, tasks, today]);
  const overviewTimeReportSeries = useMemo(() => {
    const todayDate = new Date(`${today}T00:00:00`);
    const dayMs = 86400000;
    const toTaskDate = (value?: string) => (value ? new Date(`${value}T00:00:00`) : null);
    const formatBucketLabel = (start: Date, end: Date, index: number) => {
      if (overviewStudyPeriod === 'week1') {
        const diff = Math.round((todayDate.getTime() - start.getTime()) / dayMs);
        return diff === 0 ? 'Bugun' : `G-${diff}`;
      }
      if (overviewStudyPeriod === 'week3') return `${index + 1}. Hafta`;
      if (overviewStudyPeriod === 'total') return `${index + 1}. Aralik`;
      return `${index + 1}. Bolum`;
    };
    const completedTasksWithDate = tasks
      .filter((task) => isCompletedTask(task) && task.completionDate)
      .map((task) => ({ task, date: toTaskDate(task.completionDate) }))
      .filter((item): item is { task: Task; date: Date } => Boolean(item.date && item.date <= todayDate));

    const makeBuckets = () => {
      if (overviewStudyPeriod === 'week1') {
        return Array.from({ length: 7 }, (_, index) => {
          const start = new Date(todayDate);
          start.setDate(start.getDate() - (6 - index));
          const end = new Date(start);
          return { start, end, label: formatBucketLabel(start, end, index) };
        });
      }

      const fixedRange = overviewStudyPeriod === 'week3'
        ? { days: 21, points: 3 }
        : overviewStudyPeriod === 'month'
          ? { days: 30, points: 10 }
          : overviewStudyPeriod === 'quarter'
            ? { days: 90, points: 12 }
            : null;

      if (fixedRange) {
        const rangeStart = new Date(todayDate);
        rangeStart.setDate(rangeStart.getDate() - (fixedRange.days - 1));
        const bucketSize = Math.max(1, Math.ceil(fixedRange.days / fixedRange.points));
        return Array.from({ length: fixedRange.points }, (_, index) => {
          const start = new Date(rangeStart);
          start.setDate(start.getDate() + index * bucketSize);
          const end = new Date(start);
          end.setDate(end.getDate() + bucketSize - 1);
          if (end > todayDate) end.setTime(todayDate.getTime());
          return { start, end, label: formatBucketLabel(start, end, index) };
        });
      }

      const firstDate = completedTasksWithDate.length > 0
        ? new Date(Math.min(...completedTasksWithDate.map((item) => item.date.getTime())))
        : new Date(todayDate);
      const totalDays = Math.max(1, Math.floor((todayDate.getTime() - firstDate.getTime()) / dayMs) + 1);
      const pointCount = Math.max(1, Math.min(12, Math.ceil(totalDays / 30)));
      const bucketSize = Math.max(1, Math.ceil(totalDays / pointCount));
      return Array.from({ length: pointCount }, (_, index) => {
        const start = new Date(firstDate);
        start.setDate(start.getDate() + index * bucketSize);
        const end = new Date(start);
        end.setDate(end.getDate() + bucketSize - 1);
        if (end > todayDate) end.setTime(todayDate.getTime());
        return { start, end, label: formatBucketLabel(start, end, index) };
      });
    };

    const buckets = makeBuckets();
    const coursePalette = ['#2563EB', '#16A34A', '#7C3AED', '#F59E0B', '#06B6D4', '#EC4899', '#64748B'];
    const activeCourses = courses.filter((course) => course.active !== false);

    return activeCourses.slice(0, 6).map((course, idx) => ({
      courseName: repairedText(course.name),
      color: coursePalette[idx % coursePalette.length],
      labels: buckets.map((bucket) => bucket.label),
      points: buckets.map((bucket) => {
        const minutes = completedTasksWithDate
          .filter(({ task, date }) => task.courseId === course.id && date >= bucket.start && date <= bucket.end)
          .reduce((sum, { task }) => sum + (task.actualDuration ? Math.round(task.actualDuration / 60) : Math.round(task.plannedDuration || 0)), 0);
        return minutes;
      }),
    }));
  }, [courses, overviewStudyPeriod, tasks, today]);

  const overviewUpcomingExam = useMemo(() => {
    return [...examScheduleEntries]
      .filter((exam) => exam.date >= today)
      .sort((left, right) => left.date.localeCompare(right.date))[0];
  }, [examScheduleEntries, today]);
  const overviewExamDecision = useMemo(() => {
    const latestExam = overviewAnalysis.school.latestStateExam;
    const firstRiskCourse = latestExam?.riskCourses[0];

    if (!overviewUpcomingExam) {
      return {
        title: 'Sınav takvimi boş',
        detail: latestExam
          ? `Son deneme: ${latestExam.title}${firstRiskCourse ? ` / riskli ders ${firstRiskCourse.courseName}` : ''}.`
          : 'Sınav takvimi Planlama sayfasında yönetilir.',
        action: latestExam && firstRiskCourse
          ? `${firstRiskCourse.courseName} için kısa tekrar bloğu planlanmalı.`
          : 'Sınav girilirse plan motoru çalışma önceliğini ona göre ayarlar.',
        tone: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
      };
    }

    const examDate = new Date(`${overviewUpcomingExam.date}T00:00:00`);
    const currentDate = new Date(`${today}T00:00:00`);
    const daysToExam = Math.ceil((examDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
    const dayText = daysToExam === 0 ? 'bugün' : `${daysToExam} gün kaldı`;
    const matchingRiskCourse = latestExam?.riskCourses.find((course) => normalizeForLookup(course.courseName) === normalizeForLookup(overviewUpcomingExam.courseName));
    const fallbackRiskCourse = firstRiskCourse;
    const riskCourse = matchingRiskCourse || fallbackRiskCourse;
    const urgent = daysToExam <= 3;

    return {
      title: overviewUpcomingExam.examName,
      detail: `${overviewUpcomingExam.courseName} / ${overviewUpcomingExam.date} / ${dayText}`,
      action: riskCourse
        ? `${riskCourse.courseName} son denemede düşük görünüyor; ${urgent ? 'bugünkü plana sınav tipi tekrar eklenmeli.' : 'haftalık planda tekrar penceresi ayrılmalı.'}`
        : urgent
          ? 'Sınav çok yakın; bugünkü plan hafif tekrar ve soru pratiğiyle kapanmalı.'
          : 'Plan üretimi bu sınavı çalışma önceliğine katmalı.',
      tone: urgent ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300' : 'bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300',
    };
  }, [overviewAnalysis.school.latestStateExam, overviewUpcomingExam, today]);
  const overviewSignal = useMemo(() => {
    if (!hasOverviewAnalysisData) {
      return {
        title: 'Veri bekleniyor',
        text: 'Tamamlanan çalışma ve sınav kaydı arttıkça analiz sinyali netleşir.',
        className: 'ios-blue text-blue-950',
      };
    }
    if (parentSummary.overdueCount > 0) {
      return {
        title: 'Dikkat gerekli',
        text: `Gecikmiş ${parentSummary.overdueCount} görev var. Lütfen görevleri tamamlamaya odaklanın.`,
        className: 'ios-peach text-amber-950',
      };
    }
    const firstWeak = overviewSummary.weakTopics[0];
    if (firstWeak) {
      return {
        title: 'Takip gerekli',
        text: `${firstWeak.courseName} / ${firstWeak.topicName} odaklanma istiyor. Tekrar ve pratik önerilir.`,
        className: 'ios-coral text-rose-950',
      };
    }
    return {
      title: 'İyi gidiyor',
      text: overviewRecommendation,
      className: 'ios-mint text-emerald-950',
    };
  }, [hasOverviewAnalysisData, overviewRecommendation, parentSummary.overdueCount, overviewSummary.weakTopics]);

  const handleLockParentNow = () => {
    setSettingsOpen(false);
    setIsParentLocked(true);
    addToast('Ebeveyn paneli kilitlendi.', 'success');
  };

  const handleExportFromSettings = async () => {
    setSettingsOpen(false);
    await handleExportData();
  };

  const handleResetUiSettings = () => {
    setNotificationsMuted(false);
    setShowNotificationDot(true);
    setRememberLastParentView(false);
    setDismissedNotificationKeys([]);
    setParentDefaultView('overview');
    addToast('Arayuz ayarlari varsayilana donduruldu.', 'success');
  };

  const handleOpenScheduleSettings = () => {
    setSettingsOpen(false);
    setParentWorkspaceView('planning');
    addToast('Ders programı düzenleme ekranına yönlendirildi.', 'success');
  };

  const handleQuickAction = (view: ParentWorkspaceView, message: string) => {
    playHaptic('selection');
    setQuickActionsOpen(false);
    setNotificationsOpen(false);
    setSettingsOpen(false);
    setParentWorkspaceView(view);
    addToast(message, 'success');
  };

  const handleToolbarKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

    const toolbar = topbarToolbarRef.current;
    if (!toolbar) return;

    const controls = Array.from(toolbar.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      .filter((button) => button.offsetParent !== null);
    if (!controls.length) return;

    const currentIndex = controls.findIndex((button) => button === document.activeElement);
    const fallbackIndex = event.key === 'End' ? controls.length - 1 : 0;
    const nextIndex = currentIndex === -1
      ? fallbackIndex
      : event.key === 'ArrowRight'
        ? Math.min(currentIndex + 1, controls.length - 1)
        : event.key === 'ArrowLeft'
          ? Math.max(currentIndex - 1, 0)
          : fallbackIndex;

    event.preventDefault();
    controls[nextIndex]?.focus();
  };

  const notificationItems = useMemo(() => {
    const completedTodayCount = tasks.filter((task) => isCompletedTask(task) && task.completionDate === today).length;
    const pendingTodayCount = tasks.filter((task) => task.status === 'bekliyor' && task.dueDate === today).length;
    const pendingAllCount = tasks.filter((task) => task.status === 'bekliyor').length;
    const upcomingExamDays = overviewUpcomingExam
      ? Math.ceil(
          (new Date(`${overviewUpcomingExam.date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime())
          / (1000 * 60 * 60 * 24),
        )
      : null;
    const upcomingExamDayText = upcomingExamDays === null
      ? ''
      : upcomingExamDays <= 0
        ? 'bugun'
        : `${upcomingExamDays} gun kaldi`;
    const hasPerformanceDrop = Number(parentSummary.accuracyTrend14d?.delta || 0) <= -5;
    const hasGoalDrift = parentSummary.overdueRate >= 40;

    const parentItems = [
      {
        key: `parent:completed:${completedTodayCount}:${today}`,
        title: 'Gorev tamamlandi',
        description: `${completedTodayCount} gorev bugun tamamlandi`,
        visible: completedTodayCount > 0,
        tier: 'normal',
        cooldownGroup: 'parent:completed',
        cooldownMs: getNotificationCooldownMs('normal'),
        priority: 2,
        action: () => setParentWorkspaceView('overview'),
      },
      {
        key: `parent:overdue:${parentSummary.overdueCount}`,
        title: 'Gorev gecikti',
        description: `${parentSummary.overdueCount} gorev gecikmede`,
        visible: parentSummary.overdueCount > 0,
        tier: 'critical',
        cooldownGroup: 'parent:overdue',
        cooldownMs: getNotificationCooldownMs('critical'),
        priority: 4,
        action: () => setParentWorkspaceView('planning'),
      },
      {
        key: `parent:notasktoday:${today}:${pendingTodayCount}`,
        title: 'Bugun gorev yok',
        description: 'Bugun icin atanmis gorev gorunmuyor',
        visible: pendingTodayCount === 0,
        tier: 'normal',
        cooldownGroup: 'parent:notasktoday',
        cooldownMs: getNotificationCooldownMs('normal'),
        priority: 2,
        action: () => setParentWorkspaceView('planning'),
      },
      {
        key: `parent:exam:${overviewUpcomingExam?.examName || 'none'}:${upcomingExamDays ?? -1}`,
        title: 'Sinav yaklasiyor',
        description: overviewUpcomingExam ? `${overviewUpcomingExam.examName} - ${upcomingExamDayText}` : '',
        visible: Boolean(overviewUpcomingExam && upcomingExamDays !== null && upcomingExamDays >= 0 && upcomingExamDays <= 7),
        tier: 'normal',
        cooldownGroup: 'parent:exam',
        cooldownMs: getNotificationCooldownMs('normal'),
        priority: 3,
        action: () => setParentWorkspaceView('planning'),
      },
      {
        key: `parent:drop:${parentSummary.accuracyTrend14d?.delta ?? 0}`,
        title: 'Performans dususu',
        description: `Son 14 gun dogruluk degisimi ${parentSummary.accuracyTrend14d?.delta ?? 0}%`,
        visible: hasPerformanceDrop,
        tier: 'normal',
        cooldownGroup: 'parent:drop',
        cooldownMs: getNotificationCooldownMs('normal'),
        priority: 3,
        action: () => setParentWorkspaceView('analysis'),
      },
      {
        key: `parent:goaldrift:${parentSummary.overdueRate}`,
        title: 'Hedef sapmasi',
        description: `Bekleyen/geciken gorev orani %${parentSummary.overdueRate}`,
        visible: hasGoalDrift,
        tier: 'normal',
        cooldownGroup: 'parent:goaldrift',
        cooldownMs: getNotificationCooldownMs('normal'),
        priority: 2,
        action: () => setParentWorkspaceView('planning'),
      },
    ];

    const childItems = [
      {
        key: `child:newtask:${pendingAllCount}`,
        title: 'Yeni gorevlerin var',
        description: `${pendingAllCount} bekleyen gorev seni bekliyor`,
        visible: pendingAllCount > 0,
        tier: 'normal',
        cooldownGroup: 'child:newtask',
        cooldownMs: getNotificationCooldownMs('normal'),
        priority: 2,
        action: () => addToast('Gorev listeni kontrol et.', 'success'),
      },
      {
        key: `child:today:${pendingTodayCount}:${today}`,
        title: 'Bugun kalan gorevler',
        description: `${pendingTodayCount} gorev bugun tamamlanmali`,
        visible: pendingTodayCount > 0,
        tier: 'normal',
        cooldownGroup: 'child:today',
        cooldownMs: getNotificationCooldownMs('normal'),
        priority: 3,
        action: () => addToast('Once bugunku gorevleri bitir.', 'success'),
      },
      {
        key: `child:completed:${completedTodayCount}:${today}`,
        title: 'Tebrikler',
        description: `${completedTodayCount} gorevi bugun tamamladin`,
        visible: completedTodayCount > 0,
        tier: 'normal',
        cooldownGroup: 'child:completed',
        cooldownMs: getNotificationCooldownMs('normal'),
        priority: 2,
        action: () => addToast('Harika gidiyorsun, devam et!', 'success'),
      },
      {
        key: `child:exam:${overviewUpcomingExam?.examName || 'none'}:${upcomingExamDays ?? -1}`,
        title: 'Sinav hatirlatmasi',
        description: overviewUpcomingExam ? `${overviewUpcomingExam.examName} - ${upcomingExamDayText}` : '',
        visible: Boolean(overviewUpcomingExam && upcomingExamDays !== null && upcomingExamDays >= 0 && upcomingExamDays <= 3),
        tier: 'normal',
        cooldownGroup: 'child:exam',
        cooldownMs: getNotificationCooldownMs('normal'),
        priority: 3,
        action: () => addToast('Sinav icin kisa tekrar yap.', 'success'),
      },
    ];

    const baseItems = userType === UserType.Child ? childItems : parentItems;
    const now = Date.now();
    return baseItems
      .filter((item) => item.visible)
      .filter((item) => {
        const lastShownAt = notificationCooldownMap[item.cooldownGroup] ?? 0;
        const cooldownMs = item.cooldownMs ?? 24 * 60 * 60 * 1000;
        const isInCooldown = now - lastShownAt < cooldownMs;
        return !isInCooldown || item.priority >= 4;
      })
      .sort((left, right) => right.priority - left.priority);
  }, [
    tasks,
    today,
    overviewUpcomingExam,
    parentSummary.overdueCount,
    parentSummary.overdueRate,
    parentSummary.accuracyTrend14d,
    notificationCooldownMap,
    userType,
  ]);

  const NOTIFICATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
  const unreadNotificationItems = useMemo(() => {
    const now = Date.now();
    return notificationItems.filter((item) => {
      if (!dismissedNotificationKeys.includes(item.key)) return true;
      const dismissedAt = dismissedNotificationAtMap[item.key] ?? 0;
      return now - dismissedAt > NOTIFICATION_RETENTION_MS;
    });
  }, [notificationItems, dismissedNotificationKeys, dismissedNotificationAtMap]);

  const getNotificationGroupKey = (key: string) => key.split(':').slice(0, 2).join(':');

  useEffect(() => {
    const tierCounts = notificationItems.reduce(
      (acc, item) => {
        const tier = item.tier || 'normal';
        acc[tier] = (acc[tier] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    pushObservabilityEvent({
      ts: new Date().toISOString(),
      type: 'notification_queue',
      meta: {
        total: notificationItems.length,
        unread: unreadNotificationItems.length,
        muted: notificationsMuted,
        critical_count: tierCounts.critical || 0,
        normal_count: tierCounts.normal || 0,
        silent_count: tierCounts.silent || 0,
      },
    });
  }, [notificationItems.length, unreadNotificationItems.length, notificationsMuted, pushObservabilityEvent]);

  const handleNotificationAction = (item: { key: string; action: () => void }) => {
    item.action();
    pushObservabilityEvent({
      ts: new Date().toISOString(),
      type: 'notification_action',
      meta: {
        key: item.key,
      },
    });
    const now = Date.now();
    const groupKey = getNotificationGroupKey(item.key);
    setNotificationCooldownMap((prev) => ({ ...prev, [groupKey]: now }));
    setDismissedNotificationKeys((prev) => (prev.includes(item.key) ? prev : [...prev, item.key]));
    setDismissedNotificationAtMap((prev) => ({ ...prev, [item.key]: now }));
    setNotificationsOpen(false);
  };

  const handleMarkAllNotificationsRead = () => {
    const now = Date.now();
    setNotificationCooldownMap((prev) => {
      const next = { ...prev };
      notificationItems.forEach((item) => {
        const groupKey = getNotificationGroupKey(item.key);
        next[groupKey] = now;
      });
      return next;
    });
    setDismissedNotificationKeys((prev) => {
      const keys = notificationItems.map((item) => item.key);
      return Array.from(new Set([...prev, ...keys]));
    });
    setDismissedNotificationAtMap((prev) => {
      const next = { ...prev };
      notificationItems.forEach((item) => {
        next[item.key] = now;
      });
      return next;
    });
    addToast('Tüm bildirimler okundu olarak işaretlendi.', 'success');
  };

  useEffect(() => {
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000;

    const validDismissed = dismissedNotificationKeys.filter((key) => {
      const ts = dismissedNotificationAtMap[key] ?? 0;
      return now - ts <= maxAge;
    });
    if (validDismissed.length !== dismissedNotificationKeys.length) {
      setDismissedNotificationKeys(validDismissed);
    }

    const validDismissedMap = Object.fromEntries(
      Object.entries(dismissedNotificationAtMap).filter(([, ts]) => now - Number(ts || 0) <= maxAge),
    ) as Record<string, number>;
    if (Object.keys(validDismissedMap).length !== Object.keys(dismissedNotificationAtMap).length) {
      setDismissedNotificationAtMap(validDismissedMap);
    }

    const validCooldownMap = Object.fromEntries(
      Object.entries(notificationCooldownMap).filter(([, ts]) => now - Number(ts || 0) <= maxAge),
    ) as Record<string, number>;
    if (Object.keys(validCooldownMap).length !== Object.keys(notificationCooldownMap).length) {
      setNotificationCooldownMap(validCooldownMap);
    }
  }, [
    dismissedNotificationKeys,
    dismissedNotificationAtMap,
    notificationCooldownMap,
    setDismissedNotificationKeys,
    setDismissedNotificationAtMap,
    setNotificationCooldownMap,
  ]);

  useEffect(() => {
    const handleKeyboardCommands = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!notificationsOpen && !settingsOpen && !quickActionsOpen && !parentMenuOpen) return;
        event.preventDefault();
        setNotificationsOpen(false);
        setSettingsOpen(false);
        setQuickActionsOpen(false);
        setParentMenuOpen(false);
        return;
      }

    };

    window.addEventListener('keydown', handleKeyboardCommands);
    return () => window.removeEventListener('keydown', handleKeyboardCommands);
  }, [notificationsOpen, settingsOpen, quickActionsOpen, parentMenuOpen]);

  const parentDashboardProps = useMemo<Omit<ParentDashboardProps, 'loading' | 'error' | 'viewMode'>>(() => ({
    courses,
    tasks,
    performanceData,
    rewards,
    successPoints,
    examRecords,
    compositeExamResults,
    studyPlans,
    curriculum,
    ai,
    addCourse,
    deleteCourse: handleDeleteCourseRequest,
    addTask,
    deleteTask,
    addReward,
    deleteReward,
    generateReport,
    onExportData: handleExportData,
    onDeleteAllData: handleDeleteAllData,
    onImportData: handleImportDataNew,
    onChangeExamRecords: setExamRecords,
    onChangeCompositeExamResults: setCompositeExamResults,
    overviewTodayOperational,
    overviewTodaySlots,
    overviewTodayName,
    overviewUpcomingExam,
    overviewExamDecision,
    onOpenPlanning: (message: string) => handleQuickAction('planning', message),
  }), [
    courses,
    tasks,
    performanceData,
    rewards,
    successPoints,
    examRecords,
    compositeExamResults,
    studyPlans,
    curriculum,
    ai,
    addCourse,
    handleDeleteCourseRequest,
    addTask,
    deleteTask,
    addReward,
    deleteReward,
    generateReport,
    handleExportData,
    handleDeleteAllData,
    handleImportDataNew,
    setExamRecords,
    setCompositeExamResults,
    overviewTodayOperational,
    overviewTodaySlots,
    overviewTodayName,
    overviewUpcomingExam,
    overviewExamDecision,
  ]);

  const renderParentDashboardMode = (viewMode: NonNullable<ParentDashboardProps['viewMode']>) => (
    <Suspense fallback={<WorkspaceLoadingFallback label="Analiz yukleniyor..." />}>
      <ParentDashboard
        {...parentDashboardProps}
        loading={false}
        error={parentAnalysisRuntimeError}
        viewMode={viewMode}
        analysisSnapshot={parentAnalysis}
      />
    </Suspense>
  );

  const renderParentWorkspace = () => {
    const isPlanning = parentWorkspaceView === 'planning';
    const isCurriculum = parentWorkspaceView === 'curriculum-panel';
    const isAnalysis = parentWorkspaceView === 'analysis';
    const isOverview = !parentWorkspaceView || parentWorkspaceView === 'overview';

    return (
      <>
        {/* Planning Workspace */}
        {isPlanning && (
        <div className="block" key="planning-container">
          <Suspense fallback={<WorkspaceLoadingFallback label="Planlama yukleniyor..." />}>
            <ParentPlanningWorkspace
              curriculum={curriculum}
              curriculumSummary={curriculumSummary}
              weeklySchedule={weeklySchedule}
              examScheduleEntries={examScheduleEntries}
              courses={courses}
              tasks={tasks}
              addTask={addTask}
              deleteTask={deleteTask}
              onChangeSchedule={setWeeklySchedule}
              onChangeExamSchedules={setExamScheduleEntries}
              onOpenCurriculumEditor={() => setCurriculumEditorOpen(true)}
              onReactivateCourse={reactivateCourse}
              courseReferenceHealth={courseReferenceHealth}
              onRecordSchoolTopicHistory={recordSchoolTopicHistory}
            />
          </Suspense>
        </div>
        )}

        {/* Curriculum Showcase Workspace */}
        {isCurriculum && (
        <div className="block" key="curriculum-container">
          <Suspense fallback={<WorkspaceLoadingFallback label="Mufredat paneli yukleniyor..." />}>
            <ParentCurriculumShowcaseWorkspace
              courses={courses}
              curriculum={curriculum}
              weeklySchedule={weeklySchedule}
              tasks={tasks}
              overviewCourseInsights={overviewCourseInsights}
              overviewTopicPerformanceRows={overviewTopicPerformanceRows}
              onOpenOverviewReport={() => setParentWorkspaceView('overview')}
              onOpenWeeklyAnalysis={() => setParentWorkspaceView('analysis')}
            />
          </Suspense>
        </div>
        )}

        {/* Analysis Workspace */}
        {isAnalysis && (
        <div className="block" key="analysis-container">
          {!parentDecisionV1Enabled ? (
            <div className="space-y-4">
              <div className="ios-card rounded-[24px] p-4 text-sm font-semibold text-slate-700">
                Yeni karar ekrani kapali. Fallback olarak Genel Bakis gosteriliyor.
              </div>
              <Suspense fallback={<WorkspaceLoadingFallback label="Genel bakis yukleniyor..." />}>
                <ParentOverviewWorkspace
                  parentSummary={parentSummary}
                  overviewSummary={overviewSummary}
                  overviewNextTask={overviewNextTask}
                  weeklySchedule={weeklySchedule}
                  curriculum={curriculum}
                  onWeeklyScheduleChange={setWeeklySchedule}
                  onRecordSchoolTopicHistory={recordSchoolTopicHistory}
                  overviewUpcomingExam={overviewUpcomingExam}
                  overviewTodayName={overviewTodayName}
                  overviewTodaySlots={overviewTodaySlots}
                  overviewTodayCompletedTasks={overviewTodayCompletedTasks}
                  overviewWeakTopicActions={overviewWeakTopicActions}
                  overviewCourseNames={overviewCourseNames}
                  overviewWeeklyStats={overviewWeeklyStatsForView}
                  overviewCourseInsights={overviewCourseInsights}
                  overviewTopicInsights={overviewTopicInsights}
                  overviewTopicMetricsMap={overviewTopicMetricsMap}
                  overviewTopicPerformanceRows={overviewTopicPerformanceRows}
                  overviewReportSeries={overviewReportSeries}
                  overviewTimeReportSeries={overviewTimeReportSeries}
                  overviewStudyPeriod={overviewStudyPeriod}
                  onOverviewStudyPeriodChange={setOverviewStudyPeriod}
                  overviewSignal={overviewSignal}
                  overviewExamDecision={overviewExamDecision}
                  lastCompletedTaskLabel={overviewSummary.lastCompletedTask ? `${overviewSummary.lastCompletedTask.title} - ${getTaskCompletionLabel(overviewSummary.lastCompletedTask)}` : null}
                  onOpenPlanning={(message: string) => handleQuickAction('planning', message)}
                  onOpenAnalysis={() => setParentWorkspaceView('analysis')}
                />
              </Suspense>
            </div>
          ) : (
            <Suspense fallback={<WorkspaceLoadingFallback label="Karar ekrani yukleniyor..." />}>
              <ParentAnalysisShell
                analyzedSessionCount={analyzedSessionCount}
                weakTopicCount={parentSummary.weakTopics.length}
              >
                {renderParentDashboardMode('analysis')}
              </ParentAnalysisShell>
            </Suspense>
          )}
        </div>
        )}

        {/* Overview Workspace */}
        {isOverview && (
        <div className="block" key="overview-container">
          <Suspense fallback={<WorkspaceLoadingFallback label="Genel bakis yukleniyor..." />}>
            <ParentOverviewWorkspace
              parentSummary={parentSummary}
              overviewSummary={overviewSummary}
              overviewNextTask={overviewNextTask}
              weeklySchedule={weeklySchedule}
              curriculum={curriculum}
              onWeeklyScheduleChange={setWeeklySchedule}
              onRecordSchoolTopicHistory={recordSchoolTopicHistory}
              overviewUpcomingExam={overviewUpcomingExam}
              overviewTodayName={overviewTodayName}
              overviewTodaySlots={overviewTodaySlots}
              overviewTodayCompletedTasks={overviewTodayCompletedTasks}
              overviewWeakTopicActions={overviewWeakTopicActions}
              overviewCourseNames={overviewCourseNames}
              overviewWeeklyStats={overviewWeeklyStatsForView}
              overviewCourseInsights={overviewCourseInsights}
              overviewTopicInsights={overviewTopicInsights}
              overviewTopicMetricsMap={overviewTopicMetricsMap}
              overviewTopicPerformanceRows={overviewTopicPerformanceRows}
              overviewReportSeries={overviewReportSeries}
              overviewTimeReportSeries={overviewTimeReportSeries}
              overviewStudyPeriod={overviewStudyPeriod}
              onOverviewStudyPeriodChange={setOverviewStudyPeriod}
              overviewSignal={overviewSignal}
              overviewExamDecision={overviewExamDecision}
              lastCompletedTaskLabel={overviewSummary.lastCompletedTask ? `${overviewSummary.lastCompletedTask.title} - ${getTaskCompletionLabel(overviewSummary.lastCompletedTask)}` : null}
              onOpenPlanning={(message: string) => handleQuickAction('planning', message)}
              onOpenAnalysis={() => setParentWorkspaceView('analysis')}
            />
          </Suspense>
        </div>
        )}
      </>
    );
  };

  return (
    <div className={`min-h-screen overflow-x-hidden ${themeMode === 'dark' ? 'dr-theme-dark' : 'dr-theme-light'}`}>
      <header className={`dr-topbar dr-toolbar fixed left-0 right-0 top-0 z-50 border-b ${userType === UserType.Parent && !isParentLocked && parentSidebarOpen ? 'xl:left-64' : ''}`}>
        <div className="flex h-20 items-center justify-between gap-2 px-3 md:gap-4 md:px-8">
          <div className="flex min-w-0 items-center gap-6">
            {userType === UserType.Parent && !isParentLocked ? (
              <div className="hidden xl:block">
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">DersRotası</div>
                <div className="text-lg font-bold text-slate-900">Ebeveyn Paneli</div>
              </div>
            ) : (
              <div className="hidden min-w-0 sm:block">
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">DersRotası</div>
                <div className="text-lg font-bold text-slate-900">{userType === UserType.Parent ? 'Ebeveyn Paneli' : 'Çocuk Paneli'}</div>
              </div>
            )}
          </div>
          <div ref={topbarToolbarRef} onKeyDown={handleToolbarKeyDown} className="flex items-center gap-2 sm:gap-4" role="toolbar" aria-label="Uygulama komutlari">
            <div className="dr-toolbar-group dr-velvet-segment relative inline-flex shrink-0 rounded-full p-1" aria-label="Kullanıcı modu">
              <span aria-hidden="true" className={`dr-velvet-segment-indicator ${userType === UserType.Parent ? 'translate-x-0' : 'translate-x-full'}`} />
              <button data-testid="switch-parent-mode-btn" onClick={() => handleUserTypeChange(UserType.Parent)} aria-pressed={userType === UserType.Parent} title="Ebeveyn modu" className={`relative z-10 flex h-8 w-[4.25rem] items-center justify-center rounded-full text-xs font-bold transition-colors duration-200 sm:w-24 sm:text-sm ${userType === UserType.Parent ? 'text-slate-950 dark:text-slate-950' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}`}>
                Ebeveyn
              </button>
              <button data-testid="switch-child-mode-btn" onClick={() => handleUserTypeChange(UserType.Child)} aria-pressed={userType === UserType.Child} title="Çocuk modu" className={`relative z-10 flex h-8 w-[4.25rem] items-center justify-center rounded-full text-xs font-bold transition-colors duration-200 sm:w-24 sm:text-sm ${userType === UserType.Child ? 'text-slate-950 dark:text-slate-950' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}`}>
                Çocuk
              </button>
            </div>
            <div className="dr-toolbar-group" aria-label="Yardımcı komutlar">
            {(userType === UserType.Child || (userType === UserType.Parent && !isParentLocked)) && <div ref={topbarNotificationsRef} className="relative">
              <button
                data-testid="topbar-notifications-toggle"
                data-unread-count={String(unreadNotificationItems.length)}
                onClick={() => { setNotificationsOpen((prev) => !prev); setSettingsOpen(false); setQuickActionsOpen(false); }}
                aria-label="Bildirimleri aç veya kapat"
                aria-expanded={notificationsOpen}
                title="Bildirimler"
                className="ios-button relative rounded-full p-2 text-[var(--dr-muted)] transition hover:text-[var(--dr-text)]"
              >
                <Bell className="h-5 w-5" />
                {showNotificationDot && !notificationsMuted && unreadNotificationItems.length > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />}
              </button>
            </div>}
            {userType === UserType.Parent && !isParentLocked && <div ref={topbarSettingsRef} className="relative">
              <button onClick={() => { setSettingsOpen((prev) => !prev); setNotificationsOpen(false); setQuickActionsOpen(false); }} aria-label="Uygulama ayarlarını aç veya kapat" aria-expanded={settingsOpen} title="Uygulama ayarları" className="ios-button rounded-full p-2 text-slate-500 transition hover:text-slate-800">
                <Settings className="h-5 w-5" />
              </button>
            </div>}
            </div>
          </div>
        </div>
      </header>

      {notificationsOpen && (
        <div
          ref={topbarNotificationsPopoverRef}
          className="ios-card fixed right-3 z-[90] w-[min(20rem,calc(100vw-1.5rem))] rounded-[26px] p-3 text-[var(--dr-text)]"
          style={{
            position: 'fixed',
            top: 'calc(5rem + env(safe-area-inset-top) + 0.75rem)',
            right: '0.75rem',
          }}
          data-testid="notifications-popover"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-sm font-bold text-[var(--dr-text)]">Bildirimler</div>
            <button data-testid="notifications-mark-all-read-btn" onClick={handleMarkAllNotificationsRead} className="ios-button rounded-full px-3 py-1 text-[11px] font-bold text-[var(--dr-text)]">Tümünü okundu yap</button>
          </div>
          {notificationsMuted ? (
            <div data-testid="notifications-muted-state" className="ios-widget rounded-[18px] px-3 py-2 text-xs text-[var(--dr-muted)]">Bildirimler sessizde.</div>
          ) : unreadNotificationItems.length === 0 ? (
            <div data-testid="notifications-empty-state" className="ios-widget rounded-[18px] px-3 py-2 text-xs text-[var(--dr-muted)]">Yeni bildirim yok.</div>
          ) : (
            <div className="dr-soft-scroll max-h-[22rem] space-y-2 overflow-y-auto pr-1">
              {unreadNotificationItems.map((item, index) => (
                <button
                  key={item.key}
                  data-testid={`notification-item-${index}`}
                  data-notification-key={item.key}
                  data-cooldown-group={getNotificationGroupKey(item.key)}
                  data-notification-tier={item.tier || 'normal'}
                  onClick={() => handleNotificationAction(item)}
                  className="ios-widget w-full rounded-[18px] px-3 py-2 text-left text-[var(--dr-text)] transition hover:bg-[var(--dr-surface-strong)]"
                >
                  <div className="text-xs font-bold text-[var(--dr-text)]">{item.title}</div>
                  <div className="mt-1 text-[11px] text-[var(--dr-muted)]">{item.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <main className={`dr-main transition-all ${userType === UserType.Parent && !isParentLocked && parentSidebarOpen ? 'xl:pl-64' : ''}`}>
        {userType === UserType.Parent ? (
          isParentLocked ? (
            <ParentLockScreen onUnlock={handleUnlockParentDashboard} error={loginError} />
          ) : (
            <>
              <aside className={`ios-panel fixed inset-y-0 left-0 top-0 z-40 hidden h-screen w-64 flex-col gap-2 rounded-r-[30px] border-r-0 p-4 pt-24 transition-transform duration-300 xl:flex ${parentSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                  <div className="ios-widget ios-blue mb-4 rounded-[26px] p-4" aria-label={`Öğrenci takibi. Tamamlanan ${parentSummary.completedCount} görev`}>
                    <div className="mb-3 flex justify-center">
                      <div className="ios-button flex h-16 w-16 items-center justify-center rounded-full text-slate-700">
                        <User className="h-8 w-8" />
                      </div>
                    </div>
                    <h3 className="text-center font-bold text-slate-900">Öğrenci Takibi</h3>
                    <p className="text-center text-xs text-slate-500">Tamamlanan {parentSummary.completedCount} görev</p>
                  </div>

                  <nav className="flex flex-1 flex-col gap-1">
                    {parentWorkspaceItems.filter((item) => primaryParentWorkspaceIds.includes(item.id)).map((item) => {
                      const Icon = item.icon;
                      const active = parentWorkspaceView === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            if (item.id === 'analysis' && !parentDecisionV1Enabled) {
                              addToast('Karar ekrani su an pasif. Genel Bakis acildi.', 'success');
                              setParentWorkspaceView('overview');
                              return;
                            }
                            setParentWorkspaceView(item.id);
                          }}
                          className={`flex w-full items-center gap-3 rounded-[20px] p-3 text-left transition-all ${active ? 'ios-button-active text-slate-900' : 'text-slate-500 hover:bg-white/55 hover:text-slate-800'}`}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-sm">{item.label}</span>
                        </button>
                      );
                    })}
                  </nav>

                  <div className="mt-auto border-t border-white/60 p-4">
                    <button onClick={handleLockParentNow} aria-label="Ebeveyn panelini kilitle" className="ios-coral flex w-full items-center gap-3 rounded-[20px] p-3 text-left text-rose-700 transition-colors">
                      <Lock className="h-5 w-5" />
                      <span className="text-sm font-medium">Paneli Kilitle</span>
                    </button>
                  </div>
                </aside>

              <button
                onClick={() => setParentSidebarOpen((prev) => !prev)}
                className={`dr-ornament fixed top-[calc(6rem+env(safe-area-inset-top))] z-[55] hidden h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-all xl:flex ${parentSidebarOpen ? 'left-[15rem]' : 'left-4'}`}
                aria-label={parentSidebarOpen ? 'Sol menüyü kapat' : 'Sol menüyü aç'}
              >
                {parentSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>

              <div className="dr-content-pad">
                <div className="mx-auto max-w-7xl">
                  <div className="min-w-0 space-y-4">
                    <nav className="dr-parent-workspace-strip xl:hidden" aria-label="Ebeveyn modulleri">
                      {parentWorkspaceItems.filter((item) => primaryParentWorkspaceIds.includes(item.id)).map((item) => {
                        const Icon = item.icon;
                        const active = parentWorkspaceView === item.id;
                        return (
                          <button
                            key={`workspace-strip-${item.id}`}
                            type="button"
                            onClick={() => {
                              if (item.id === 'analysis' && !parentDecisionV1Enabled) {
                                addToast('Karar ekrani su an pasif. Genel Bakis acildi.', 'success');
                                setParentWorkspaceView('overview');
                                return;
                              }
                              setParentWorkspaceView(item.id);
                            }}
                            className={`dr-parent-workspace-tab ${active ? 'is-active' : ''}`}
                            aria-current={active ? 'page' : undefined}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </nav>
                    <div className="hidden">
                      <button onClick={() => setParentMenuOpen((prev) => !prev)} className="ios-button inline-flex items-center gap-2 rounded-[20px] px-4 py-3 text-sm font-semibold text-slate-700 xl:hidden">
                        {parentMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />} Modüller
                      </button>
                    </div>

                    {parentMenuOpen && (
                      <div className="fixed inset-0 z-50 xl:hidden">
                        <button
                          type="button"
                          aria-label="Modül menüsünü kapat"
                          onClick={() => setParentMenuOpen(false)}
                          className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm"
                        />
                        <div className="ios-card dr-compact-modal dr-soft-scroll absolute left-3 right-3 top-[calc(5rem+env(safe-area-inset-top))] max-h-[min(76dvh,32rem)] overflow-y-auto p-3">
                          <div className="space-y-4">
                            <div>
                              <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Kritik modüller</div>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {parentWorkspaceItems.filter((item) => primaryParentWorkspaceIds.includes(item.id)).map((item, index) => {
                              const Icon = item.icon;
                              const active = parentWorkspaceView === item.id;
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => {
                                    if (item.id === 'analysis' && !parentDecisionV1Enabled) {
                                      addToast('Karar ekrani su an pasif. Genel Bakis acildi.', 'success');
                                      setParentWorkspaceView('overview');
                                      setParentMenuOpen(false);
                                      return;
                                    }
                                    setParentWorkspaceView(item.id);
                                    setParentMenuOpen(false);
                                  }}
                                  className={`rounded-[22px] px-4 py-4 text-left transition ${active ? 'ios-button-active text-slate-900' : 'ios-widget text-slate-700'}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <Icon className="h-5 w-5" />
                                    <div>
                                      <div className="font-bold">{`${index + 1}. ${item.label}`}</div>
                                      <div className="text-xs text-slate-500">{item.description}</div>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {renderParentWorkspace()}
                  </div>
                </div>
              </div>

              <Modal show={showDeleteCourseModal} onClose={() => setShowDeleteCourseModal(false)} title="Dersi Pasifleştir">
                <div className="space-y-4">
                  <p className="text-slate-700">
                    '{courseToDelete?.name}' dersi yeni görev, sınav ve planlama seçimlerinden kaldırılacak. Geçmiş görev, sınav ve analiz kayıtları korunacak.
                  </p>
                  <div className="dr-button-row">
                    <button className="ios-button rounded-[16px] px-4 py-2 font-semibold text-slate-700" onClick={() => setShowDeleteCourseModal(false)}>
                      Vazgeç
                    </button>
                    <button className="dr-destructive-button px-4 py-2 font-semibold" onClick={confirmDeleteCourse}>
                      Pasifleştir
                    </button>
                  </div>
                </div>
              </Modal>
            </>
          )
        ) : (
          <Suspense fallback={<WorkspaceLoadingFallback label="Cocuk paneli yukleniyor..." />}>
            <ChildDashboard
              tasks={tasks}
              courses={courses}
              performanceData={performanceData}
              rewards={rewards}
              badges={badges}
              successPoints={successPoints}
              analysisSnapshot={parentAnalysis}
              startTask={startTask}
              updateTaskLiveSession={updateTaskLiveSession}
              updateTaskStatus={updateTaskStatus}
              completeTask={completeTask}
              claimReward={claimReward}
              addTask={addTask}
              curriculum={curriculum}
              ai={ai}
            />
          </Suspense>
        )}
      </main>
      {curriculumEditorOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-slate-950/45 p-3 backdrop-blur-sm" role="presentation">
          <div className="ios-card dr-compact-modal flex max-h-[min(76dvh,38rem)] w-[min(46rem,calc(100vw-1.5rem))] flex-col overflow-hidden" role="dialog" aria-modal="true" aria-label="Müfredat düzenleme">
            <div className="dr-compact-modal-header flex shrink-0 items-start justify-between gap-4 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
                  <BookOpen className="h-4 w-4" />
                  Müfredat Düzenleme
                </div>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">Ders / ünite / konu yapısı</h3>
                <p className="mt-1 text-sm text-slate-500">Kaydedilen iskelet Planlama sayfasında özet olarak kalır.</p>
              </div>
              <button type="button" onClick={() => setCurriculumEditorOpen(false)} className="ios-button flex h-11 w-11 items-center justify-center rounded-full text-slate-600" aria-label="Müfredat düzenlemeyi kapat">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="dr-modal-scroll dr-compact-modal-body min-h-0 flex-1 overflow-y-auto">
              <Suspense fallback={<WorkspaceLoadingFallback label="Mufredat editoru yukleniyor..." />}>
                <CurriculumManagerPanel curriculum={curriculum} onSave={setCurriculum} />
              </Suspense>
            </div>
          </div>
        </div>
      )}
      {settingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-slate-950/45 p-3 backdrop-blur-sm" role="presentation">
          <div ref={settingsPopoverRef} className="ios-card dr-compact-modal flex max-h-[min(76dvh,34rem)] w-[min(26rem,calc(100vw-1.5rem))] flex-col overflow-hidden p-3" role="dialog" aria-modal="true" aria-label="Uygulama ayarları">
            <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
              <div>
                <div className="text-base font-bold text-slate-900">Uygulama Ayarları</div>
                <div className="mt-1 text-xs text-slate-500">Tercihler bu cihaza kaydedilir.</div>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)} className="ios-button flex h-10 w-10 items-center justify-center rounded-full text-slate-600" aria-label="Ayarları kapat">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="dr-modal-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1 text-xs">
              <div className="ios-widget rounded-[20px] p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Tema</div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setThemeMode('light')} className={`rounded-[16px] px-2 py-2 text-[11px] font-bold ${themeMode === 'light' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}>
                    Açık Mod
                  </button>
                  <button onClick={() => setThemeMode('dark')} className={`rounded-[16px] px-2 py-2 text-[11px] font-bold ${themeMode === 'dark' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}>
                    Karanlık Mod
                  </button>
                </div>
              </div>

              <div className="ios-widget rounded-[20px] p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Açılış</div>
                <button onClick={() => setRememberLastParentView((prev) => !prev)} className="ios-button flex w-full items-center justify-between rounded-[16px] px-3 py-2 text-left text-slate-700">
                  <span>Son modülü hatırla</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${rememberLastParentView ? 'ios-mint text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{rememberLastParentView ? 'Açık' : 'Kapalı'}</span>
                </button>
              </div>

              <div className="ios-widget rounded-[20px] p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Bildirim</div>
                <button onClick={() => setNotificationsMuted((prev) => !prev)} className="ios-button flex w-full items-center justify-between rounded-[16px] px-3 py-2 text-left text-slate-700">
                  <span>Bildirimler</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${!notificationsMuted ? 'ios-mint text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{notificationsMuted ? 'Kapalı' : 'Açık'}</span>
                </button>
              </div>

              <div className="ios-widget rounded-[20px] p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Dokunsal Geri Bildirim</div>
                <button
                  onClick={() => {
                    setHapticsEnabled((prev) => {
                      const next = !prev;
                      if (next) playHaptic('selection');
                      return next;
                    });
                  }}
                  className="ios-button flex w-full items-center justify-between rounded-[16px] px-3 py-2 text-left text-slate-700"
                >
                  <span>Hafif titreşim</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${hapticsEnabled ? 'ios-mint text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{hapticsEnabled ? 'Açık' : 'Kapalı'}</span>
                </button>
              </div>

              <div className="ios-widget rounded-[20px] p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Veri Yönetimi</div>
                <button
                  type="button"
                  onClick={handleOpenDataManagement}
                  className="ios-button flex w-full items-center justify-between rounded-[16px] px-3 py-2 text-left text-slate-700"
                >
                  <span>Veri Yönetimi (Şifreli Alan)</span>
                  <span className="ios-blue rounded-full px-2 py-0.5 text-[10px] font-bold text-slate-700">Aç</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {dataAccessModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-hidden bg-slate-950/55 p-3 backdrop-blur-sm" role="presentation">
          <div className="ios-card dr-compact-modal flex max-h-[min(76dvh,34rem)] w-[min(32rem,calc(100vw-1.5rem))] flex-col overflow-hidden p-3" role="dialog" aria-modal="true" aria-label="Veri yönetimi erişimi">
            <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
              <div>
                <div className="text-base font-bold text-slate-900">Veri Yönetimi</div>
                <div className="mt-1 text-xs text-slate-500">Bu alan şifre korumalıdır.</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDataAccessModalOpen(false);
                  setDataAccessPassword('');
                  setDataAccessGranted(false);
                  setDataAccessError(null);
                }}
                className="ios-button flex h-10 w-10 items-center justify-center rounded-full text-slate-600"
                aria-label="Veri yönetimini kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!dataAccessGranted ? (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-600">Şifre</label>
                <input
                  type="password"
                  value={dataAccessPassword}
                  onChange={(event) => setDataAccessPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.preventDefault();
                  }}
                  className="ios-button w-full rounded-[16px] px-3 py-2 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                  placeholder="Şifre girin"
                />
                {dataAccessError && <div className="text-xs font-semibold text-rose-600">{dataAccessError}</div>}
              </div>
            ) : (
              <div className="dr-modal-scroll min-h-0 flex-1 overflow-y-auto">
                <div className="-mx-2">{renderParentDashboardMode('data')}</div>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="pointer-events-none fixed bottom-6 left-0 right-0 z-[80] flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div key={toast.id} className={`pointer-events-auto flex max-w-[min(36rem,100%)] items-center gap-3 rounded-full px-5 py-3 text-sm font-bold shadow-2xl ${toast.type === 'success' ? 'ios-mint text-emerald-950' : 'ios-coral text-rose-950'}`}>
            <span className="min-w-0 truncate">{toast.message}</span>
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                onClick={() => {
                  toast.onAction?.();
                  setToasts((prev) => prev.filter((item) => item.id !== toast.id));
                }}
                className="ios-button shrink-0 rounded-full px-3 py-1 text-xs font-bold text-slate-800"
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;






























