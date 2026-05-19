import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ParentLockScreen from './components/parent/ParentLockScreen';
import ParentAnalysisShell from './components/parent/ParentAnalysisShell';
import {
  UserType,
  Course,
  Task,
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
import { GraduationCap, User, Users, BadgeCheck, Home, Sparkles, ClipboardList, BarChart, Menu, X, Bell, Settings, AlertTriangle, Lock, ChevronLeft, ChevronRight, ChevronDown, PlusCircle, Search, Lightbulb, BookOpen } from './components/icons';
import { ALL_ICONS } from './constants';
import { INITIAL_REAL_COURSES, INITIAL_REAL_CURRICULUM, INITIAL_REAL_PERFORMANCE } from './initialRealCurriculum';
import { calculateTaskPoints } from './utils/scoringAlgorithm';
import { getLocalDateString } from './utils/dateUtils';
import { deriveAnalysisSnapshot } from './utils/analysisEngine';
import {
  buildParentDecision,
  resolveDecisionRuleConfig,
  getNotificationCooldownMs,
  getNotificationTierFromLevel,
  getParentDecisionVersionMeta,
  type DecisionRuleOverrides,
} from './utils/parentDecisionEngine';
import { isCompletedTask } from './utils/taskStatus';
import { playHaptic } from './utils/haptics';
import { GoogleGenAI } from '@google/genai';

const ParentDashboard = lazy(() => import('./components/parent/ParentDashboard'));
const ChildDashboard = lazy(() => import('./components/child/ChildDashboard'));
const CurriculumManagerPanel = lazy(() => import('./components/parent/CurriculumManagerPanel'));
const ParentOverviewWorkspace = lazy(() => import('./components/parent/ParentOverviewWorkspace'));
const ParentPlanningWorkspace = lazy(() => import('./components/parent/ParentPlanningWorkspace'));

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
  SCHEDULE_DAYS.map((day) => [day, createEmptyScheduleDay()]),
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

type ParentWorkspaceView = 'overview' | 'planning' | 'analysis';
type OverviewStudyPeriod = 'month' | 'quarter' | 'total';
type SearchScope = 'all' | 'tasks' | 'courses' | 'topics' | 'exams' | 'rewards';

interface AppSearchResult {
  id: string;
  scope: SearchScope;
  title: string;
  subtitle: string;
  detail: string;
  view: ParentWorkspaceView;
}

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

const searchScopes: Array<{ id: SearchScope; label: string }> = [
  { id: 'all', label: 'Tümü' },
  { id: 'tasks', label: 'Görev' },
  { id: 'topics', label: 'Konu' },
  { id: 'exams', label: 'Sınav' },
  { id: 'courses', label: 'Ders' },
  { id: 'rewards', label: 'Ödül' },
];

const WorkspaceLoadingFallback: React.FC<{ label?: string }> = ({ label = 'Yukleniyor...' }) => (
  <div className="ios-card rounded-[24px] p-4 text-sm font-semibold text-slate-600">
    {label}
  </div>
);

const normalizeParentWorkspaceView = (value: unknown): ParentWorkspaceView => {
  if (value === 'overview' || value === 'planning' || value === 'analysis') return value;
  if (value === 'tasks' || value === 'exams') return 'planning';
  return 'overview';
};

const Modal: React.FC<{ show: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ show, onClose, title, children }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="ios-card w-full max-w-md rounded-[28px] p-6" role="dialog" aria-modal="true" aria-labelledby="app-modal-title" onClick={(event) => event.stopPropagation()}>
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

function useStickyState<T>(defaultValue: T, key: string, normalize?: (value: unknown) => T): [T, React.Dispatch<React.SetStateAction<T>>] {
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

  return [value, setSafeValue];
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
  return value.filter((task): task is Task => {
    if (!task || typeof task !== 'object') return false;
    const candidate = task as Task;
    return typeof candidate.id === 'string'
      && typeof candidate.title === 'string'
      && typeof candidate.courseId === 'string'
      && typeof candidate.dueDate === 'string';
  });
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

const normalizeDecisionRuleOverrides = (value: unknown): DecisionRuleOverrides => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const candidate = value as { thresholds?: Record<string, unknown>; weights?: Record<string, unknown> };
  const pickNumber = (record: Record<string, unknown> | undefined, key: string) =>
    Number.isFinite(Number(record?.[key])) ? Number(record?.[key]) : undefined;
  return {
    thresholds: candidate.thresholds
      ? {
          lowDataSessionCount: pickNumber(candidate.thresholds, 'lowDataSessionCount'),
          noStudyDaysCritical: pickNumber(candidate.thresholds, 'noStudyDaysCritical'),
          weakTopicCountWarning: pickNumber(candidate.thresholds, 'weakTopicCountWarning'),
          riskWarningMin: pickNumber(candidate.thresholds, 'riskWarningMin'),
          riskCriticalMin: pickNumber(candidate.thresholds, 'riskCriticalMin'),
        }
      : undefined,
    weights: candidate.weights
      ? {
          noStudy: pickNumber(candidate.weights, 'noStudy'),
          trendDrop: pickNumber(candidate.weights, 'trendDrop'),
          weakTopics: pickNumber(candidate.weights, 'weakTopics'),
          risk: pickNumber(candidate.weights, 'risk'),
          lowDataPenalty: pickNumber(candidate.weights, 'lowDataPenalty'),
        }
      : undefined,
  };
};

const normalizeDecisionRolloutMode = (value: unknown): 'stable' | 'beta' => (
  value === 'beta' ? 'beta' : 'stable'
);

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

const retainedRealSubjectKeys = new Set(['matematik']);
const shouldPruneLegacySubject = (value: unknown) => {
  const key = normalizeLegacyDemoText(value);
  return legacyDemoSubjectKeys.has(key) && !retainedRealSubjectKeys.has(key);
};
const isRetainedRealSubject = (value: unknown) => retainedRealSubjectKeys.has(normalizeLegacyDemoText(value));

const pruneLegacyDemoSubjects = () => {
  if (typeof window === 'undefined') return;
  if (isE2EBulkSeedMode()) return;
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
  if (isE2EBulkSeedMode()) return;
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

const isMojibakeCodePoint = (codePoint: number, nextCodePoint?: number) =>
  codePoint === 0x00c3 ||
  codePoint === 0x00c2 ||
  codePoint === 0x00c4 ||
  codePoint === 0x00c5 ||
  codePoint === 0xfffd ||
  (codePoint === 0x00e2 && (nextCodePoint === 0x20ac || nextCodePoint === 0x0080 || nextCodePoint === 0x0099));

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
  startDate.setDate(startDate.getDate() - (period === 'month' ? 29 : 89));
  return startDate;
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
    .filter((task) => task.taskType === 'soru çözme' && (task.questionCount || 0) > 0 && typeof task.correctCount === 'number' && task.completionDate)
    .map((task) => ({
      completionDate: task.completionDate!,
      accuracy: Math.max(0, Math.min(100, Math.round(((task.correctCount || 0) / Math.max(1, task.questionCount || 1)) * 100))),
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
      if (!isCompletedTask(task) || task.taskType !== 'soru çözme' || !task.completionDate) return false;
      if (!task.questionCount || task.questionCount <= 0 || typeof task.correctCount !== 'number') return false;
      const completion = toDate(task.completionDate);
      return Boolean(completion && completion >= startDate && completion <= endDate);
    })
    .map((task) => {
      const accuracy = Math.max(0, Math.min(100, Math.round(((task.correctCount || 0) / Math.max(1, task.questionCount || 1)) * 100)));
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

const normalizeTask = (task: any): Task => {
  const rawStatus = task?.status as string | undefined;
  const normalizedStatus = rawStatus === 'tamamland\u0131' || rawStatus === 'tamamlandi' ? 'tamamland\u0131' : 'bekliyor';
  const normalizedType = task?.taskType === 'soru cozme'
    ? 'soru \u00e7\u00f6zme'
    : task?.taskType === 'ders calisma' || task?.taskType === 'ders \u00e7al\u0131\u015fma'
      ? 'ders \u00e7al\u0131\u015fma'
      : task?.taskType === 'kitap okuma'
        ? 'kitap okuma'
        : task?.taskType;
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

  return {
    ...task,
    title: repairText(task?.title),
    description: repairText(task?.description),
    status: normalizedStatus,
    taskType: normalizedType,
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

const normalizeWeeklyScheduleSlot = (slot: any, fallbackIndex: number): WeeklyScheduleSlot => ({
  id: String(slot?.id || `slot_${fallbackIndex}_${slot?.courseName || slot?.label || 'ders'}`),
  courseName: repairedText(slot?.courseName ?? slot?.label).trim(),
  startTime: String(slot?.startTime ?? '09:00'),
  endTime: String(slot?.endTime ?? '10:00'),
  note: repairedText(slot?.note).trim() || undefined,
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
    curriculumPayload
    && typeof curriculumPayload === 'object'
    && !Array.isArray(curriculumPayload)
    && Object.keys(curriculumPayload).length > 0,
  );
  const forceMathSeed = new URLSearchParams(window.location.search).get('reset') === 'math';
  const shouldReplaceWithRealMath = forceMathSeed
    || !hasCourses
    || !hasCurriculum
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

const isE2ESeedLockActive = () => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('e2e') !== '1') return false;
  return window.localStorage.getItem('__qa_seed_lock') === '1';
};

const isIdbHydrationPending = (key: string, currentValue: unknown) => {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!isIdbStorageMarker(parsed)) return false;
    if (Array.isArray(currentValue)) return currentValue.length === 0;
    if (currentValue && typeof currentValue === 'object') return Object.keys(currentValue as Record<string, unknown>).length === 0;
    return currentValue === null || currentValue === undefined;
  } catch {
    return false;
  }
};

const seedManualQaRecords = () => {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const isE2EMode = params.get('e2e') === '1';
  if (!isE2EMode) return;
  const qaRecordsMode = params.get('qaRecords');
  if (!qaRecordsMode || qaRecordsMode === 'none') return;

  const syncQaSeedToIndexedDb = (next: {
    tasks: Task[];
    performanceData: PerformanceData[];
    examRecords: ExamRecord[];
    compositeExamResults: CompositeExamResult[];
  }) => {
    void Promise.all([
      writeIndexedDbValue('tasks', next.tasks),
      writeIndexedDbValue('performanceData', next.performanceData),
      writeIndexedDbValue('examRecords', next.examRecords),
      writeIndexedDbValue('compositeExamResults', next.compositeExamResults),
    ]).catch((error) => {
      console.error('QA IndexedDB seed sync failed:', error);
    });
  };

  const today = new Date('2026-05-15T12:00:00');
  const iso = (date: Date) => date.toISOString().slice(0, 10);
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
  window.localStorage.removeItem('drEnableRecharts');
  window.localStorage.removeItem('drDisableRecharts');
  window.localStorage.setItem('__qa_manual_records_seeded_at', new Date().toISOString());
};
seedInitialRealCurriculum();
seedManualQaRecords();
pruneLegacyDemoSubjects();
purgeLegacyDemoData();

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
        examType: item?.examType === 'mock-exam' ? 'mock-exam' : 'state-exam',
        date,
        courses: coursesPayload,
        totalScore: Number.isFinite(Number(item?.totalScore)) ? Number(item.totalScore) : undefined,
        notes: repairedText(item?.notes).trim() || undefined,
      } as CompositeExamResult;
    })
    .filter((item): item is CompositeExamResult => Boolean(item))
    .sort((left, right) => right.date.localeCompare(left.date));
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
      const score = typeof task.correctCount === 'number' && (task.questionCount || 0) > 0
        ? Math.round((task.correctCount / Math.max(1, task.questionCount || 1)) * 100)
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

  if (activePlan && JSON.stringify(activePlan.schedule) !== JSON.stringify(weeklySchedule)) {
    triggers.push({
      id: `trigger_schedule_change_week_${activePlan.week}`,
      type: 'schedule-change',
      createdAt: new Date().toISOString(),
      severity: 'medium',
      reasonText: `Hafta ${activePlan.week} aktif planindan sonra haftalik okul programi degisti.`,
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
          if (typeof task.correctCount === 'number' && (task.questionCount || 0) > 0) {
            return Math.round((task.correctCount / Math.max(1, task.questionCount || 1)) * 100);
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
  { id: 'planning', label: 'Planlama', description: 'Okul programı + ev çalışma + sınav takvimi', icon: Sparkles },
  { id: 'analysis', label: 'Karar', description: 'Performans ve kararlar', icon: BarChart },
];

const primaryParentWorkspaceIds: ParentWorkspaceView[] = ['overview', 'planning', 'analysis'];
const secondaryParentWorkspaceIds: ParentWorkspaceView[] = [];

const App: React.FC = () => {
  const isE2EMode = getQueryParam('e2e') === '1';
  const [userType, setUserType] = useStickyState<UserType>(UserType.Parent, 'userType');
  const [courses, setCourses] = useStickyState<Course[]>([], 'courses', normalizeSafeCourses);
  const [tasks, setTasks] = useStickyState<Task[]>([], 'tasks', normalizeSafeTasks);
  const [curriculum, setCurriculum] = useStickyState<SubjectCurriculum>({}, 'curriculum', normalizeSafeCurriculum);
  const [weeklySchedule, setWeeklySchedule] = useStickyState<WeeklySchedule>(defaultWeeklySchedule, 'weeklySchedule', normalizeWeeklySchedule);
  const [examScheduleEntries, setExamScheduleEntries] = useStickyState<ExamScheduleEntry[]>([], 'examScheduleEntries', normalizeSafeArray<ExamScheduleEntry>);
  const [examRecords, setExamRecords] = useStickyState<ExamRecord[]>([], 'examRecords', normalizeSafeArray<ExamRecord>);
  const [compositeExamResults, setCompositeExamResults] = useStickyState<CompositeExamResult[]>([], 'compositeExamResults', normalizeSafeArray<CompositeExamResult>);
  const [studyPlans, setStudyPlans] = useStickyState<StoredStudyPlan[]>([], 'studyPlans', normalizeStudyPlans);
  const [planningEngineSnapshot, setPlanningEngineSnapshot] = useStickyState<PlanningEngineSnapshot>(defaultPlanningEngineSnapshot, 'planningEngineSnapshot', normalizePlanningEngineSnapshot);
  const [performanceData, setPerformanceData] = useStickyState<PerformanceData[]>([], 'performanceData', normalizeSafeArray<PerformanceData>);
  const [rewards, setRewards] = useStickyState<Reward[]>([], 'rewards', normalizeSafeRewards);
  const [successPoints, setSuccessPoints] = useStickyState<number>(0, 'successPoints', normalizeSafeNumber);
  const [badges, setBadges] = useStickyState<Badge[]>([{ id: 'b1', name: 'İlk Adım', description: 'İlk görevini tamamladın!', icon: BadgeCheck }], 'badges', normalizeSafeBadges);
  const [isParentLocked, setIsParentLocked] = useStickyState<boolean>(true, 'isParentLocked', normalizeSafeBoolean);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [showDeleteCourseModal, setShowDeleteCourseModal] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [parentWorkspaceView, setParentWorkspaceView] = useStickyState<ParentWorkspaceView>('overview', 'parentWorkspaceView', normalizeParentWorkspaceView);
  const [overviewStudyPeriod] = useStickyState<OverviewStudyPeriod>('month', 'parentOverviewStudyPeriod');
  const [parentDefaultView, setParentDefaultView] = useStickyState<ParentWorkspaceView>('overview', 'parentDefaultView', normalizeParentWorkspaceView);
  const rewardClaimLockRef = useRef<Set<string>>(new Set());
  const completeTaskLockRef = useRef<Set<string>>(new Set());
  const tasksRef = useRef<Task[]>(tasks);
  const topbarNotificationsRef = useRef<HTMLDivElement | null>(null);
  const topbarSettingsRef = useRef<HTMLDivElement | null>(null);
  const topbarSearchRef = useRef<HTMLDivElement | null>(null);
  const topbarQuickActionsRef = useRef<HTMLDivElement | null>(null);
  const settingsPopoverRef = useRef<HTMLDivElement | null>(null);
  const parentControlButtonRef = useRef<HTMLDivElement | null>(null);
  const parentControlCenterRef = useRef<HTMLDivElement | null>(null);
  const topbarToolbarRef = useRef<HTMLDivElement | null>(null);
  const [parentMenuOpen, setParentMenuOpen] = useState(false);
  const [parentControlCenterOpen, setParentControlCenterOpen] = useState(false);
  const [parentSidebarOpen, setParentSidebarOpen] = useStickyState<boolean>(true, 'parentSidebarOpen');
  const [notificationsMuted, setNotificationsMuted] = useStickyState<boolean>(false, 'notificationsMuted');
  const [hapticsEnabled, setHapticsEnabled] = useStickyState<boolean>(true, 'hapticsEnabled');
  const [themeMode, setThemeMode] = useStickyState<'light' | 'dark'>('dark', 'themeMode');
  const [showNotificationDot, setShowNotificationDot] = useStickyState<boolean>(true, 'showNotificationDot');
  const [rememberLastParentView, setRememberLastParentView] = useStickyState<boolean>(true, 'rememberLastParentView');
  const [parentDecisionV1Enabled, setParentDecisionV1Enabled] = useStickyState<boolean>(true, 'parentDecisionV1Enabled');
  const [parentDecisionRolloutMode, setParentDecisionRolloutMode] = useStickyState<'stable' | 'beta'>(
    'stable',
    'parentDecisionRolloutMode',
    normalizeDecisionRolloutMode,
  );
  const [parentDecisionRuleOverrides, setParentDecisionRuleOverrides] = useStickyState<DecisionRuleOverrides>(
    {},
    'parentDecisionRuleOverrides',
    normalizeDecisionRuleOverrides,
  );
  const [parentDecisionTuningVersion, setParentDecisionTuningVersion] = useStickyState<string>(
    'thresholds-v1',
    'parentDecisionTuningVersion',
  );
  const [dismissedNotificationKeys, setDismissedNotificationKeys] = useStickyState<string[]>([], 'dismissedNotificationKeys', normalizeSafeArray<string>);
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchScope, setGlobalSearchScope] = useState<SearchScope>('all');
  const [curriculumEditorOpen, setCurriculumEditorOpen] = useState(false);
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
    if (!notificationsOpen && !settingsOpen && !searchOpen && !quickActionsOpen && !parentControlCenterOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (topbarNotificationsRef.current?.contains(target)) return;
      if (topbarSettingsRef.current?.contains(target)) return;
      if (settingsPopoverRef.current?.contains(target)) return;
      if (topbarSearchRef.current?.contains(target)) return;
      if (topbarQuickActionsRef.current?.contains(target)) return;
      if (parentControlButtonRef.current?.contains(target)) return;
      if (parentControlCenterRef.current?.contains(target)) return;
      setNotificationsOpen(false);
      setSettingsOpen(false);
      setSearchOpen(false);
      setQuickActionsOpen(false);
      setParentControlCenterOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [notificationsOpen, settingsOpen, searchOpen, quickActionsOpen, parentControlCenterOpen]);

  useEffect(() => {
    if (!settingsOpen && !parentControlCenterOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [settingsOpen, parentControlCenterOpen]);

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
    if (isIdbHydrationPending('curriculum', curriculum)) return;
    if (isIdbHydrationPending('tasks', tasks)) return;
    const subjectNames = Object.keys(curriculum || {});
    const nextCourses = subjectNames.map((subjectName, index) => {
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

    if (JSON.stringify(nextCourses) !== JSON.stringify(courses)) {
      setCourses(nextCourses);
    }

    const validCourseIds = new Set(nextCourses.map((course) => course.id));
    setTasks((prevTasks) => {
      const nextTasks = prevTasks.filter((task) => validCourseIds.has(task.courseId));
      return nextTasks.length === prevTasks.length ? prevTasks : nextTasks;
    });
    setPerformanceData((prevPerformance) => {
      const nextPerformance = prevPerformance.filter((item) => validCourseIds.has(item.courseId));
      return nextPerformance.length === prevPerformance.length ? prevPerformance : nextPerformance;
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
  }, [curriculum, courses, setCourses, setPerformanceData, setStudyPlans, setTasks]);

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
    if (password === '1234') {
      playHaptic('success');
      setIsParentLocked(false);
      setParentWorkspaceView(rememberLastParentView ? parentWorkspaceView : parentDefaultView);
      setLoginError(null);
      return;
    }
    playHaptic('warning');
    setLoginError('Sifre eslesmedi. Lutfen tekrar deneyin.');
  };

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

  const getImportPayload = (json: any) => json?.appData && typeof json.appData === 'object' ? json.appData : json;

  const applyImportedData = (json: any): boolean => {
    const payload = getImportPayload(json);
    const parsedSuccessPoints = Number(payload?.successPoints);
    if (!payload || !Array.isArray(payload.courses) || !Array.isArray(payload.tasks) || !Array.isArray(payload.rewards) || !Array.isArray(payload.badges) || !Number.isFinite(parsedSuccessPoints)) {
      return false;
    }

    const { courses: normalizedCourses, courseIdAliases } = normalizeCoursesWithAliases(payload.courses as Course[]);
    setCourses(normalizedCourses);
    setTasks(payload.tasks.map((task: Task) => {
      const normalizedTask = normalizeTask(task);
      return {
        ...normalizedTask,
        courseId: remapCourseId(normalizedTask.courseId, courseIdAliases),
      };
    }));
    setPerformanceData(dedupePerformanceData(
      normalizePerformanceData(Array.isArray(payload.performanceData) ? payload.performanceData : []).map((item) => ({
        ...item,
        courseId: remapCourseId(item.courseId, courseIdAliases),
      })),
      normalizedCourses,
    ));
    setRewards(normalizeRewards(payload.rewards as Reward[]));
    setBadges(normalizeBadges(payload.badges as Badge[]));
    setSuccessPoints(parsedSuccessPoints || 0);
    setCurriculum(normalizeCurriculum(payload.curriculum));
    setWeeklySchedule(normalizeWeeklySchedule(payload.weeklySchedule || defaultWeeklySchedule));
    setExamRecords(normalizeExamRecords(payload.examRecords, normalizedCourses));
    setCompositeExamResults(normalizeCompositeExamResults(payload.compositeExamResults, normalizedCourses));
    setExamScheduleEntries(normalizeExamScheduleEntries(payload.examScheduleEntries, normalizedCourses));
    setStudyPlans(normalizeStudyPlans(payload.studyPlans));
    return true;
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
        },
      },
      appData,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ders-rotasi-yedek-${getLocalDateString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast('Veriler başarıyla dışa aktarıldı.', 'success');
  };

  const handleDeleteAllData = async (): Promise<void> => {
    setCourses([]);
    setTasks([]);
    setPerformanceData([]);
    setRewards([]);
    setStudyPlans([]);
    setCurriculum({});
    setWeeklySchedule(defaultWeeklySchedule);
    setExamRecords([]);
    setCompositeExamResults([]);
    setExamScheduleEntries([]);
    setBadges([{ id: 'b1', name: 'İlk Adım', description: 'İlk görevini tamamladın!', icon: BadgeCheck }]);
    setSuccessPoints(0);
    setIsParentLocked(true);
    setLoginError(null);
    addToast('Tüm veriler başarıyla silindi.', 'success');
  };

  const handleImportDataNew = async (file: File): Promise<boolean> => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const ok = applyImportedData(json);
      if (ok) {
        addToast('Veriler başarıyla içe aktarıldı.', 'success');
      } else {
        addToast('Geçersiz yedek dosyası: gerekli alanlar eksik veya hatalı.', 'error');
      }
      return ok;
    } catch (error) {
      console.error('Import error:', error);
      addToast('Yedek dosyası okunamadı veya JSON formatı geçersiz.', 'error');
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
    addToast("'" + inactiveCourse.name + "' dersi pasifleştirildi. Geçmiş görev, sınav ve analiz kayıtları korundu.", 'success');
  };

  const reactivateCourse = (courseId: string) => {
    const course = courses.find((item) => item.id === courseId);
    if (!course) return;
    setCourses((prev) => sortCourses(prev.map((item) => (
      item.id === courseId ? { ...item, active: true } : item
    ))));
    addToast("'" + course.name + "' dersi tekrar aktif edildi.", 'success');
  };

  const addTask = async (task: Omit<Task, 'id' | 'status'>): Promise<Task> => {
    if (task.planTaskId) {
      const existingTask = tasksRef.current.find((item) => item.planTaskId === task.planTaskId);
      if (existingTask) {
        return existingTask;
      }
    }

    const newTask: Task = {
      ...task,
      id: createId('task'),
      status: 'bekliyor',
    };
    setTasks((prev) => {
      if (task.planTaskId) {
        const duplicate = prev.find((item) => item.planTaskId === task.planTaskId);
        if (duplicate) return prev;
      }
      return [newTask, ...prev];
    });
    tasksRef.current = [newTask, ...tasksRef.current];
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
      (task.taskType === 'soru \u00e7\u00f6zme' && (task.successScore || 0) >= 70) ||
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
    setTasks((prev) => prev.filter((task) => task.id !== taskId));

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
        playHaptic('success');
      },
    });
  };

  const startTask = (taskId: string) => {
    playHaptic('start');
    setTasks((prevTasks) => prevTasks.map((task) => (task.id === taskId ? { ...task, startTimestamp: Date.now() } : task)));
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

    const today = getLocalDateString();
    const correctAnswers = task.taskType === 'soru \u00e7\u00f6zme' ? data.correctCount || 0 : 0;
    const incorrectAnswers = task.taskType === 'soru \u00e7\u00f6zme' ? data.incorrectCount || 0 : 0;
    const emptyAnswers = task.taskType === 'soru \u00e7\u00f6zme' ? data.emptyCount || 0 : 0;
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
    if (task.taskType === 'soru \u00e7\u00f6zme' && task.questionCount && task.questionCount > 0) {
      const accuracy = (correctAnswers / task.questionCount) * 100;
      const timeRatio = data.actualDuration / plannedSeconds;
      const timeModifier = timeRatio < 1 ? 1 + (1 - timeRatio) * 0.1 : 1 - (timeRatio - 1) * 0.2;
      successScore = Math.max(0, Math.min(100, accuracy * timeModifier));
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
    const conceptErrorCount = task.taskType === 'soru \u00e7\u00f6zme' ? Math.max(0, data.conceptErrorCount || 0) : 0;
    const processErrorCount = task.taskType === 'soru \u00e7\u00f6zme'
      ? Math.max(0, data.processErrorCount ?? (hasExplicitErrorBreakdown ? 0 : incorrectAnswers))
      : 0;
    const attentionErrorCount = task.taskType === 'soru \u00e7\u00f6zme'
      ? Math.max(0, data.attentionErrorCount ?? (hasExplicitErrorBreakdown ? 0 : emptyAnswers))
      : 0;

    const completedTask: Task = {
      ...task,
      status: 'tamamland\u0131',
      ...data,
      pagesRead: data.pagesRead,
      completionDate: today,
      completionTimestamp: Date.now(),
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
    };

    setTasks((prevTasks) => prevTasks.map((item) => (item.id === taskId ? completedTask : item)));
    setSuccessPoints((prev) => prev + scoringResult.pointsAwarded);

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
    setTasks((prevTasks) => prevTasks.map((task) => (task.id === taskId ? { ...task, status } : task)));
  };

  const updateTaskFromPlan = (planTaskId: string, updates: Partial<Pick<Task, 'plannedDuration' | 'questionCount' | 'planLabel'>>) => {
    setTasks((prevTasks) => prevTasks.map((task) => {
      if (task.planTaskId !== planTaskId) return task;
      return {
        ...task,
        ...(typeof updates.plannedDuration === 'number' ? { plannedDuration: updates.plannedDuration } : {}),
        ...(typeof updates.questionCount === 'number' ? { questionCount: updates.questionCount } : {}),
        ...(typeof updates.planLabel === 'string' ? { planLabel: updates.planLabel } : {}),
      };
    }));
  };

  const addReward = (reward: Omit<Reward, 'id'>) => {
    const newReward: Reward = { ...reward, id: createId('reward') };
    setRewards((prev) => [newReward, ...prev]);
  };

  const deleteReward = (rewardId: string) => {
    setRewards((prev) => prev.filter((reward) => reward.id !== rewardId));
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
      versionMeta: getParentDecisionVersionMeta(),
      summary: observabilitySummary,
      pipeline: analysisPipelineState,
      recent: observabilityRecent,
      events: observabilityEvents,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `parent-observability-audit-${new Date().toISOString().slice(0, 10)}.json`;
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
    if (!rolloutTelemetryInitRef.current) {
      rolloutTelemetryInitRef.current = true;
      return;
    }
    pushObservabilityEvent({
      ts: new Date().toISOString(),
      type: 'rollout_mode_change',
      meta: {
        rollout_mode: parentDecisionRolloutMode,
        ...getParentDecisionVersionMeta(),
      },
    });
  }, [parentDecisionRolloutMode, pushObservabilityEvent]);

  useEffect(() => {
    if (!tuningTelemetryInitRef.current) {
      tuningTelemetryInitRef.current = true;
      return;
    }
    pushObservabilityEvent({
      ts: new Date().toISOString(),
      type: 'decision_tuning_change',
      meta: {
        tuned: Boolean(parentDecisionRuleOverrides.thresholds || parentDecisionRuleOverrides.weights),
        risk_critical_min: parentDecisionRuleOverrides.thresholds?.riskCriticalMin ?? null,
        risk_warning_min: parentDecisionRuleOverrides.thresholds?.riskWarningMin ?? null,
        weak_topic_warning: parentDecisionRuleOverrides.thresholds?.weakTopicCountWarning ?? null,
        ...getParentDecisionVersionMeta(),
      },
    });
  }, [parentDecisionRuleOverrides, pushObservabilityEvent]);
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
      const todayKey = now.toISOString().slice(0, 10);
      const weekKey = `${now.getUTCFullYear()}-W${Math.ceil((Math.floor((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / 86400000) + 1) / 7)}`;
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
  const today = getLocalDateString();
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
  const weeklyCompletedForDecision = useMemo(() => {
    const base = new Date(`${today}T00:00:00`);
    const start = new Date(base);
    start.setDate(start.getDate() - 7);
    const startYmd = start.toISOString().split('T')[0];
    return tasks.filter((task) => isCompletedTask(task) && !!task.completionDate && task.completionDate >= startYmd).length;
  }, [tasks, today]);
  const parentDecisionSummary = useMemo(() => {
    const latestCompositeAverage = compositeExamResults[0]
      ? Math.round(compositeExamResults[0].courses.reduce((sum, course) => sum + course.score, 0) / compositeExamResults[0].courses.length)
      : null;
    const previousCompositeAverage = compositeExamResults[1]
      ? Math.round(compositeExamResults[1].courses.reduce((sum, course) => sum + course.score, 0) / compositeExamResults[1].courses.length)
      : null;

    const effectiveOverrides = parentDecisionRolloutMode === 'beta' ? parentDecisionRuleOverrides : {};
    const ruleConfig = resolveDecisionRuleConfig(effectiveOverrides);
    return buildParentDecision({
      sessionsCount: parentAnalysis.sessions.length,
      weeklyCompletedCount: weeklyCompletedForDecision,
      weakTopicCount: parentAnalysis.topics.filter((topic) => topic.needsRevision).length,
      averageRisk: parentAnalysis.overall.averageRisk,
      latestCompositeAverage,
      previousCompositeAverage,
    }, ruleConfig);
  }, [compositeExamResults, parentAnalysis, weeklyCompletedForDecision, parentDecisionRolloutMode, parentDecisionRuleOverrides]);
  const parentDecisionVersionMeta = useMemo(() => getParentDecisionVersionMeta(), []);
  useEffect(() => {
    if (parentDecisionTuningVersion === parentDecisionVersionMeta.thresholdVersion) return;
    setParentDecisionRuleOverrides({});
    setParentDecisionTuningVersion(parentDecisionVersionMeta.thresholdVersion);
    addToast('Karar motoru esik surumu degisti. Tuning ayarlari sifirlandi.', 'success');
  }, [
    addToast,
    parentDecisionTuningVersion,
    parentDecisionVersionMeta.thresholdVersion,
    setParentDecisionRuleOverrides,
    setParentDecisionTuningVersion,
  ]);
  const parentDecisionTuningMeta = useMemo(() => ({
    rolloutMode: parentDecisionRolloutMode,
    tuned: parentDecisionRolloutMode === 'beta' && Boolean(parentDecisionRuleOverrides.thresholds || parentDecisionRuleOverrides.weights),
    riskCriticalMin: parentDecisionRolloutMode === 'beta' ? parentDecisionRuleOverrides.thresholds?.riskCriticalMin ?? null : null,
    riskWarningMin: parentDecisionRolloutMode === 'beta' ? parentDecisionRuleOverrides.thresholds?.riskWarningMin ?? null : null,
    weakTopicCountWarning: parentDecisionRolloutMode === 'beta' ? parentDecisionRuleOverrides.thresholds?.weakTopicCountWarning ?? null : null,
  }), [parentDecisionRolloutMode, parentDecisionRuleOverrides]);
  const goalAlertSignals = useMemo(() => {
    const normalized = parentDecisionSummary.alerts.slice(0, 4).map((alert, index) => {
      const idBase = `${alert.level.toLocaleLowerCase('tr-TR').replace(/\s+/g, '-')}-${index}`;
      const title = alert.level === 'Kritik'
        ? 'Kritik uyarı'
        : alert.level === 'Dikkat'
          ? 'Dikkat uyarısı'
          : alert.level === 'Takip et'
            ? 'Takip sinyali'
            : 'Durum bilgisi';
      return {
        id: idBase,
        level: alert.level,
        title,
        description: `${alert.text} Aksiyon: ${alert.action}`,
      };
    });

    if (parentSummary.overdueCount > 0) {
      normalized.unshift({
        id: 'overdue-critical',
        level: 'Kritik',
        title: 'Takipte gecikme var',
        description: `${parentSummary.overdueCount} görev bekliyor, önce bunları kapatmak gerekiyor.`,
      });
    }

    if (compositeExamResults.length === 0) {
      normalized.push({
        id: 'exam-low-data',
        level: 'Takip et',
        title: 'Deneme verisi az',
        description: 'Deneme trendi icin en az 2 deneme kaydi gerekiyor.',
      });
    }

    if (studyPlans.length === 0) {
      normalized.push({
        id: 'goal-low-data',
        level: 'Takip et',
        title: 'Hedef verisi eksik',
        description: 'Ders bazli hedef girildiginde karar onerileri daha net olur.',
      });
    }

    if (suspiciousDataSummary.hasSuspiciousData) {
      normalized.push({
        id: 'suspicious-data-warning',
        level: suspiciousDataSummary.suspiciousRatio >= 25 ? 'Dikkat' : 'Takip et',
        title: 'Veri guvenilirligi',
        description: `${suspiciousDataSummary.suspiciousCount} kayit supheli gorunuyor. Analiz etkisi dusuk guvenle hesaplandi.`,
      });
    }

    return normalized.slice(0, 5);
  }, [
    compositeExamResults.length,
    parentDecisionSummary.alerts,
    parentSummary.overdueCount,
    studyPlans.length,
    suspiciousDataSummary.hasSuspiciousData,
    suspiciousDataSummary.suspiciousCount,
    suspiciousDataSummary.suspiciousRatio,
  ]);
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
          ...parentDecisionVersionMeta,
          ...parentDecisionTuningMeta,
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
        top_decision_level: parentDecisionSummary.topAlert.level,
        top_decision_severity: parentDecisionSummary.topAlert.severityScore,
        edge_low_data_sessions: edgeCaseFlags.lowDataSessions,
        edge_no_exam_data: edgeCaseFlags.noExamData,
        edge_no_plan_data: edgeCaseFlags.noPlanData,
        edge_suspicious_data: edgeCaseFlags.suspiciousData,
        suspicious_ratio: suspiciousDataSummary.suspiciousRatio,
        ...parentDecisionVersionMeta,
        ...parentDecisionTuningMeta,
      },
    });
  }, [
    edgeCaseFlags.lowDataSessions,
    edgeCaseFlags.noExamData,
    edgeCaseFlags.noPlanData,
    edgeCaseFlags.suspiciousData,
    parentAnalysis,
    parentAnalysisRuntimeError,
    parentDecisionSummary.topAlert.level,
    parentDecisionSummary.topAlert.severityScore,
    parentDecisionVersionMeta,
    parentDecisionTuningMeta,
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
      .filter((task) => task.taskType === 'soru çözme')
      .reduce((sum, task) => {
        const hasRecordedCounts = typeof task.correctCount === 'number' || typeof task.incorrectCount === 'number';
        const answered = (task.correctCount || 0) + (task.incorrectCount || 0);
        if (hasRecordedCounts) return sum + answered;
        return sum + (task.questionCount || 0);
      }, 0),
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

  const globalSearchResults = useMemo<AppSearchResult[]>(() => {
    const courseNameById = new Map(courses.map((course) => [course.id, repairedText(course.name)]));
    const query = normalizeForLookup(globalSearchQuery);
    const results: AppSearchResult[] = [];

    const addResult = (result: AppSearchResult, searchableText: string) => {
      if (userType === UserType.Child && result.scope === 'exams') return;
      if (globalSearchScope !== 'all' && result.scope !== globalSearchScope) return;
      const normalizedText = normalizeForLookup(searchableText);
      if (query && !normalizedText.includes(query)) return;
      results.push(result);
    };

    courses.forEach((course) => {
      const name = repairedText(course.name);
      addResult({
        id: `course:${course.id}`,
        scope: 'courses',
        title: name,
        subtitle: 'Ders',
        detail: 'Müfredat, plan ve konu bağlantıları',
        view: 'planning',
      }, name);
    });

    tasks.forEach((task) => {
      const courseName = courseNameById.get(task.courseId) || task.courseId;
      const title = repairedText(task.bookTitle || task.title);
      const unit = repairedText(task.curriculumUnitName);
      const topic = repairedText(task.curriculumTopicName);
      addResult({
        id: `task:${task.id}`,
        scope: 'tasks',
        title,
        subtitle: isCompletedTask(task) ? 'Tamamlanan görev' : 'Bekleyen görev',
        detail: [courseName, unit, topic, `${task.plannedDuration} dk`].filter(Boolean).join(' / '),
        view: 'planning',
      }, [title, task.description, courseName, unit, topic, task.taskType, task.status].join(' '));
    });

    Object.entries(curriculum).forEach(([courseName, units]) => {
      units.forEach((unit) => {
        unit.topics.forEach((topic) => {
          addResult({
            id: `topic:${courseName}:${unit.name}:${topic.name}`,
            scope: 'topics',
            title: topic.name,
            subtitle: 'Konu',
            detail: `${courseName} / ${unit.name}`,
            view: 'planning',
          }, [courseName, unit.name, topic.name].join(' '));
        });
      });
    });

    examRecords.forEach((record) => {
      addResult({
        id: `exam:${record.id}`,
        scope: 'exams',
        title: record.title,
        subtitle: 'Okul sınavı',
        detail: `${record.courseName} / ${record.date} / ${record.score}`,
        view: 'planning',
      }, [record.title, record.courseName, record.date, record.notes, record.score].join(' '));
    });

    compositeExamResults.forEach((record) => {
      addResult({
        id: `composite:${record.id}`,
        scope: 'exams',
        title: record.title,
        subtitle: 'Genel sınav',
        detail: `${record.date}${record.totalScore ? ` / ${record.totalScore}` : ''}`,
        view: 'planning',
      }, [record.title, record.date, record.notes, record.totalScore, ...record.courses.map((course) => course.courseName)].join(' '));
    });

    rewards.forEach((reward) => {
      addResult({
        id: `reward:${reward.id}`,
        scope: 'rewards',
        title: repairedText(reward.name),
        subtitle: 'Ödül',
        detail: `${reward.cost} BP`,
        view: 'overview',
      }, [reward.name, reward.cost].join(' '));
    });

    const startsWithQuery = (item: AppSearchResult) => query && normalizeForLookup(item.title).startsWith(query);
    return results
      .sort((left, right) => Number(startsWithQuery(right)) - Number(startsWithQuery(left)) || left.title.localeCompare(right.title, 'tr'))
      .slice(0, 8);
  }, [compositeExamResults, courses, curriculum, examRecords, globalSearchQuery, globalSearchScope, rewards, tasks, userType]);

  const searchSuggestionTokens = useMemo(() => {
    const activeCourses = getActiveCourses(courses);
    const suggestions = [
      overviewSummary.weakTopics[0]?.topicName,
      overviewSummary.lastCompletedTask?.title,
      activeCourses[0]?.name,
      tasks.find((task) => task.status === 'bekliyor')?.title,
    ].map((item) => repairedText(item)).filter(Boolean);

    return [...new Set(suggestions)].slice(0, 4);
  }, [courses, overviewSummary.lastCompletedTask, overviewSummary.weakTopics, tasks]);
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
        tone: 'bg-slate-100 text-slate-600',
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
      tone: urgent ? 'bg-rose-100 text-rose-700' : 'bg-violet-100 text-violet-700',
    };
  }, [overviewAnalysis.school.latestStateExam, overviewUpcomingExam, today]);
  const overviewSignal = useMemo(() => {
    if (parentDecisionSummary.topAlert.level === 'Kritik') {
      return {
        title: 'Kritik uyarı',
        text: parentDecisionSummary.topAlert.text,
        className: 'ios-coral text-rose-950',
      };
    }
    if (!hasOverviewAnalysisData || parentDecisionSummary.topAlert.level === 'Takip et') {
      return {
        title: 'Veri bekleniyor',
        text: 'Tamamlanan çalışma ve sınav kaydı arttıkça analiz sinyali netleşir.',
        className: 'ios-blue text-blue-950',
      };
    }
    if (parentDecisionSummary.topAlert.level === 'Dikkat') {
      return {
        title: 'Dikkat gerekli',
        text: parentDecisionSummary.topAlert.text,
        className: 'ios-peach text-amber-950',
      };
    }
    return {
      title: 'İyi gidiyor',
      text: overviewRecommendation,
      className: 'ios-mint text-emerald-950',
    };
  }, [hasOverviewAnalysisData, overviewRecommendation, parentDecisionSummary.topAlert.level, parentDecisionSummary.topAlert.text]);

  const handleLockParentNow = () => {
    setParentControlCenterOpen(false);
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

  const handleThemeToggle = () => {
    setThemeMode((current) => current === 'dark' ? 'light' : 'dark');
    setNotificationsOpen(false);
    setSettingsOpen(false);
    setQuickActionsOpen(false);
    setSearchOpen(false);
    setParentControlCenterOpen(false);
  };

  const handleOpenScheduleSettings = () => {
    setParentControlCenterOpen(false);
    setSettingsOpen(false);
    setParentWorkspaceView('planning');
    addToast('Ders programı düzenleme ekranına yönlendirildi.', 'success');
  };

  const handleQuickAction = (view: ParentWorkspaceView, message: string) => {
    playHaptic('selection');
    setQuickActionsOpen(false);
    setNotificationsOpen(false);
    setSettingsOpen(false);
    setSearchOpen(false);
    setParentControlCenterOpen(false);
    setParentWorkspaceView(view);
    addToast(message, 'success');
  };

  const handleOpenGlobalSearch = () => {
    playHaptic('selection');
    setSearchOpen(true);
    setNotificationsOpen(false);
    setSettingsOpen(false);
    setQuickActionsOpen(false);
    setParentControlCenterOpen(false);
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

  const handleSearchResultSelect = (result: AppSearchResult) => {
    playHaptic('selection');
    setSearchOpen(false);
    setGlobalSearchQuery(result.title);
    if (!isParentLocked) {
      setParentWorkspaceView(result.view);
    }
  };

  const notificationItems = useMemo(() => {
    const items = [
      {
        key: `overdue:${parentSummary.overdueCount}`,
        title: 'Takipteki görevler',
        description: `${parentSummary.overdueCount} görev tamamlanmayı bekliyor`,
        visible: parentSummary.overdueCount > 0,
        tier: 'critical',
        cooldownGroup: 'overdue',
        cooldownMs: getNotificationCooldownMs('critical'),
        priority: 3,
        action: () => {
          setParentWorkspaceView('planning');
          addToast('Aktif plan takibi acildi.', 'success');
        },
      },
      {
        key: `weak:${parentSummary.weakTopics.length}`,
        title: 'Odak konusu bildirimi',
        description: `${parentSummary.weakTopics.length} konu tekrar istiyor`,
        visible: parentSummary.weakTopics.length > 0,
        tier: 'normal',
        cooldownGroup: 'weak',
        cooldownMs: getNotificationCooldownMs('normal'),
        priority: 2,
        action: () => {
          setParentWorkspaceView('analysis');
          addToast('Odak konulari analizi acildi.', 'success');
        },
      },
      {
        key: `focus:${parentSummary.focus7d ?? -1}`,
        title: 'Odak kontrolu',
        description: parentSummary.focus7d !== null ? `Son 7 gün ortalama odak: ${parentSummary.focus7d}` : 'Odak verisi oluştukça burada gösterilecek',
        visible: parentSummary.focus7d !== null,
        tier: 'silent',
        cooldownGroup: 'focus',
        cooldownMs: getNotificationCooldownMs('silent'),
        priority: 1,
        action: () => {
          setParentWorkspaceView('analysis');
          addToast('Odak analizi acildi.', 'success');
        },
      },
      ...goalAlertSignals.map((alert) => ({
        key: `goal:${alert.id}:${alert.level}`,
        title: alert.title,
        description: alert.description,
        tier: getNotificationTierFromLevel(alert.level),
        visible: getNotificationTierFromLevel(alert.level) !== 'silent',
        cooldownGroup: `goal:${alert.id}`,
        cooldownMs: getNotificationCooldownMs(getNotificationTierFromLevel(alert.level)),
        priority: alert.level === 'Kritik' ? 4 : alert.level === 'Dikkat' ? 3 : alert.level === 'Takip et' ? 2 : 1,
        action: () => {
          setParentWorkspaceView('analysis');
          addToast('Hedef ve deneme alani acildi.', 'success');
        },
      })),
    ];

    const now = Date.now();
    return items
      .filter((item) => item.visible)
      .filter((item) => {
        if (item.tier === 'silent') return false;
        const lastShownAt = notificationCooldownMap[item.cooldownGroup] ?? 0;
        const cooldownMs = item.cooldownMs ?? 24 * 60 * 60 * 1000;
        const isInCooldown = now - lastShownAt < cooldownMs;
        return !isInCooldown || item.priority >= 4;
      })
      .sort((left, right) => right.priority - left.priority);
  }, [parentSummary.overdueCount, parentSummary.weakTopics.length, parentSummary.focus7d, goalAlertSignals, notificationCooldownMap]);

  const unreadNotificationItems = useMemo(
    () => notificationItems.filter((item) => !dismissedNotificationKeys.includes(item.key)),
    [notificationItems, dismissedNotificationKeys],
  );

  const getNotificationGroupKey = (key: string) =>
    key.startsWith('goal:') ? key.split(':').slice(0, 2).join(':') : key.split(':')[0];

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
        top_decision_level: parentDecisionSummary.topAlert.level,
        ...parentDecisionVersionMeta,
        ...parentDecisionTuningMeta,
      },
    });
  }, [notificationItems.length, unreadNotificationItems.length, notificationsMuted, parentDecisionSummary.topAlert.level, parentDecisionVersionMeta, parentDecisionTuningMeta, pushObservabilityEvent]);

  const handleNotificationAction = (item: { key: string; action: () => void }) => {
    item.action();
    pushObservabilityEvent({
      ts: new Date().toISOString(),
      type: 'notification_action',
      meta: {
        key: item.key,
        ...parentDecisionVersionMeta,
        ...parentDecisionTuningMeta,
      },
    });
    const groupKey = getNotificationGroupKey(item.key);
    setNotificationCooldownMap((prev) => ({ ...prev, [groupKey]: Date.now() }));
    setDismissedNotificationKeys((prev) => (prev.includes(item.key) ? prev : [...prev, item.key]));
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
    addToast('Tüm bildirimler okundu olarak işaretlendi.', 'success');
  };

  useEffect(() => {
    const handleKeyboardCommands = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!notificationsOpen && !settingsOpen && !searchOpen && !quickActionsOpen && !parentMenuOpen) return;
        event.preventDefault();
        setNotificationsOpen(false);
        setSettingsOpen(false);
        setSearchOpen(false);
        setQuickActionsOpen(false);
        setParentMenuOpen(false);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase('tr-TR') === 'k') {
        const canSearch = userType === UserType.Child || (userType === UserType.Parent && !isParentLocked);
        if (!canSearch) return;
        event.preventDefault();
        handleOpenGlobalSearch();
      }
    };

    window.addEventListener('keydown', handleKeyboardCommands);
    return () => window.removeEventListener('keydown', handleKeyboardCommands);
  }, [notificationsOpen, settingsOpen, searchOpen, quickActionsOpen, parentMenuOpen, userType, isParentLocked]);

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
    if (parentWorkspaceView === 'planning') {
      return (
        <Suspense fallback={<WorkspaceLoadingFallback label="Planlama yukleniyor..." />}>
          <ParentPlanningWorkspace
            curriculum={curriculum}
            curriculumSummary={curriculumSummary}
            weeklySchedule={weeklySchedule}
            planningEngineSnapshot={planningEngineSnapshot}
            examScheduleEntries={examScheduleEntries}
            studyPlans={studyPlans}
            courses={courses}
            tasks={tasks}
            addTask={addTask}
            deleteTask={deleteTask}
            updateTaskStatus={updateTaskStatus}
            updateTaskFromPlan={updateTaskFromPlan}
            onChangeSchedule={setWeeklySchedule}
            onChangePlans={setStudyPlans}
            onChangeExamSchedules={setExamScheduleEntries}
            onOpenCurriculumEditor={() => setCurriculumEditorOpen(true)}
            onReactivateCourse={reactivateCourse}
            courseReferenceHealth={courseReferenceHealth}
          />
        </Suspense>
      );
    }

    if (parentWorkspaceView === 'analysis') {
      if (!parentDecisionV1Enabled) {
        return (
          <div className="space-y-4">
            <div className="ios-card rounded-[24px] p-4 text-sm font-semibold text-slate-700">
              Yeni karar ekrani kapali. Fallback olarak Genel Bakis gosteriliyor.
            </div>
            <Suspense fallback={<WorkspaceLoadingFallback label="Genel bakis yukleniyor..." />}>
              <ParentOverviewWorkspace
                parentSummary={parentSummary}
                overviewSummary={overviewSummary}
                overviewNextTask={overviewNextTask}
                overviewUpcomingExam={overviewUpcomingExam}
                overviewTodayName={overviewTodayName}
                overviewTodaySlots={overviewTodaySlots}
                overviewSignal={overviewSignal}
                overviewExamDecision={overviewExamDecision}
                lastCompletedTaskLabel={overviewSummary.lastCompletedTask ? `${overviewSummary.lastCompletedTask.title} - ${getTaskCompletionLabel(overviewSummary.lastCompletedTask)}` : null}
                onOpenPlanning={(message) => handleQuickAction('planning', message)}
              />
            </Suspense>
          </div>
        );
      }
      return (
        <Suspense fallback={<WorkspaceLoadingFallback label="Karar ekrani yukleniyor..." />}>
          <ParentAnalysisShell
            analyzedSessionCount={analyzedSessionCount}
            weakTopicCount={parentSummary.weakTopics.length}
            decisionLevel={parentDecisionSummary.topAlert.level}
          >
            {renderParentDashboardMode('analysis')}
          </ParentAnalysisShell>
        </Suspense>
      );
    }

    return (
      <Suspense fallback={<WorkspaceLoadingFallback label="Genel bakis yukleniyor..." />}>
        <ParentOverviewWorkspace
          parentSummary={parentSummary}
          overviewSummary={overviewSummary}
          overviewNextTask={overviewNextTask}
          overviewUpcomingExam={overviewUpcomingExam}
          overviewTodayName={overviewTodayName}
          overviewTodaySlots={overviewTodaySlots}
          overviewSignal={overviewSignal}
          overviewExamDecision={overviewExamDecision}
          lastCompletedTaskLabel={overviewSummary.lastCompletedTask ? `${overviewSummary.lastCompletedTask.title} - ${getTaskCompletionLabel(overviewSummary.lastCompletedTask)}` : null}
          onOpenPlanning={(message) => handleQuickAction('planning', message)}
        />
      </Suspense>
    );
  };

  return (
    <div className={`min-h-screen ${themeMode === 'dark' ? 'dr-theme-dark' : 'dr-theme-light'}`}>
      <header className={`dr-topbar dr-toolbar fixed left-0 right-0 top-0 z-50 border-b ${userType === UserType.Parent && !isParentLocked && parentSidebarOpen ? 'xl:left-64' : ''}`}>
        <div className="flex h-20 items-center justify-between gap-2 px-3 md:gap-4 md:px-8">
          <div className="flex min-w-0 items-center gap-6">
            {userType === UserType.Parent && !isParentLocked ? (
              <div className="hidden xl:block">
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">DersRotası</div>
                <div className="text-lg font-black text-slate-900">Ebeveyn Paneli</div>
              </div>
            ) : (
              <div className="hidden min-w-0 sm:block">
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">DersRotası</div>
                <div className="text-lg font-black text-slate-900">{userType === UserType.Parent ? 'Ebeveyn Paneli' : 'Çocuk Paneli'}</div>
              </div>
            )}
          </div>
          <div ref={topbarToolbarRef} onKeyDown={handleToolbarKeyDown} className="flex items-center gap-2 sm:gap-4" role="toolbar" aria-label="Uygulama komutlari">
            {userType === UserType.Parent && !isParentLocked && (
              <div ref={topbarQuickActionsRef} className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => {
                    setQuickActionsOpen((prev) => !prev);
                    setNotificationsOpen(false);
                    setSettingsOpen(false);
                    setSearchOpen(false);
                  }}
                  aria-label="Hızlı eylemleri aç"
                  aria-haspopup="menu"
                  aria-expanded={quickActionsOpen}
                  title="Hızlı eylemler"
                  className="dr-pulldown-button h-11 px-3 text-sm font-bold sm:px-4"
                >
                  <PlusCircle className="h-5 w-5" />
                  <span className="hidden whitespace-nowrap lg:inline">Hızlı Eylem</span>
                  <ChevronDown className="h-4 w-4 opacity-70" />
                </button>
                {quickActionsOpen && (
                  <div className="dr-context-menu" role="menu" aria-label="Hızlı eylemler">
                    <div className="dr-context-menu-preview">En sık kullanılan işlemler</div>
                    <button type="button" role="menuitem" className="dr-context-menu-item" onClick={() => handleQuickAction('planning', 'Planlama açıldı.')}>
                      <ClipboardList className="h-4 w-4" />
                      Aktif plan
                      <span className="dr-menu-meta">Ana</span>
                    </button>
                    <button type="button" role="menuitem" className="dr-context-menu-item" onClick={() => handleQuickAction('planning', 'Akademik planlama açıldı.')}>
                      <Sparkles className="h-4 w-4" />
                      Planlama aç
                    </button>
                    <button type="button" role="menuitem" className="dr-context-menu-item" onClick={() => handleQuickAction('planning', 'Sınav takvimi açıldı.')}>
                      <GraduationCap className="h-4 w-4" />
                      Sınav takvimi
                    </button>
                    <div className="dr-menu-divider" />
                    <button type="button" role="menuitem" className="dr-context-menu-item" onClick={() => handleQuickAction('analysis', 'Analiz ve raporlar açıldı.')}>
                      <BarChart className="h-4 w-4" />
                      Analizleri gör
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="dr-toolbar-group relative inline-flex shrink-0 rounded-full" aria-label="Kullanıcı modu">
              <button data-testid="switch-parent-mode-btn" onClick={() => handleUserTypeChange(UserType.Parent)} aria-pressed={userType === UserType.Parent} title="Ebeveyn modu" className={`relative z-10 flex h-8 w-[4.25rem] items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 sm:w-24 sm:text-sm ${userType === UserType.Parent ? 'ios-button-active text-slate-900' : 'text-slate-600 hover:bg-white/50'}`}>
                Ebeveyn
              </button>
              <button data-testid="switch-child-mode-btn" onClick={() => handleUserTypeChange(UserType.Child)} aria-pressed={userType === UserType.Child} title="Çocuk modu" className={`relative z-10 flex h-8 w-[4.25rem] items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 sm:w-24 sm:text-sm ${userType === UserType.Child ? 'ios-button-active text-slate-900' : 'text-slate-600 hover:bg-white/50'}`}>
                Çocuk
              </button>
            </div>
            <button
              type="button"
              onClick={handleThemeToggle}
              aria-label={themeMode === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
              aria-pressed={themeMode === 'dark'}
              title={themeMode === 'dark' ? 'Tema: Koyu' : 'Tema: Açık'}
              className="ios-button flex h-11 shrink-0 items-center gap-2 rounded-full px-3 text-slate-600 transition hover:text-slate-900"
            >
              <Lightbulb className="h-5 w-5" />
              <span className="hidden text-xs font-bold md:inline">{themeMode === 'dark' ? 'Koyu' : 'Açık'}</span>
            </button>
            <div className="dr-toolbar-group" aria-label="Yardımcı komutlar">
            {(userType === UserType.Child || (userType === UserType.Parent && !isParentLocked)) && <div ref={topbarSearchRef} className="relative">
              <div className={`ios-button flex h-11 items-center gap-2 rounded-full px-3 transition-all ${searchOpen ? 'w-[22rem]' : 'w-11 justify-center'}`}>
                <Search className="h-5 w-5 text-slate-500" />
                {searchOpen && (
                  <>
                    <input
                      value={globalSearchQuery}
                      onChange={(event) => setGlobalSearchQuery(event.target.value)}
                      placeholder="Görev, ders, konu, sınav veya ödül"
                      className="min-h-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                      autoFocus
                    />
                    {globalSearchQuery && (
                      <button type="button" onClick={() => setGlobalSearchQuery('')} className="flex h-8 min-h-8 w-8 items-center justify-center rounded-full text-slate-500" aria-label="Aramayı temizle">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </>
                )}
                {!searchOpen && (
                  <button type="button" onClick={handleOpenGlobalSearch} className="absolute inset-0 rounded-full" aria-label="Uygulama içinde ara" title="Ara - Ctrl veya Command K" />
                )}
              </div>
              {searchOpen && (
                <div className="ios-card absolute right-0 top-12 z-50 w-[min(34rem,calc(100vw-2rem))] rounded-[28px] p-3">
                  <div className="mb-3 flex gap-2 overflow-x-auto">
                    {searchScopes.map((scope) => (
                      <button
                        key={scope.id}
                        type="button"
                        onClick={() => setGlobalSearchScope(scope.id)}
                        className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold ${globalSearchScope === scope.id ? 'ios-button-active text-slate-900' : 'ios-button text-slate-600'}`}
                      >
                        {scope.label}
                      </button>
                    ))}
                  </div>
                  {!globalSearchQuery && searchSuggestionTokens.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {searchSuggestionTokens.map((suggestion) => (
                        <button key={suggestion} type="button" onClick={() => setGlobalSearchQuery(suggestion)} className="ios-widget rounded-full px-3 py-2 text-xs font-bold text-slate-600">
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    {globalSearchResults.length === 0 ? (
                      <div className="ios-widget rounded-[20px] px-4 py-5 text-sm text-slate-500">Sonuç bulunamadı. Daha genel bir kelime ya da farklı kapsam deneyin.</div>
                    ) : globalSearchResults.map((result) => (
                      <button key={result.id} type="button" onClick={() => handleSearchResultSelect(result)} className="ios-widget w-full rounded-[20px] p-3 text-left transition hover:bg-white/75">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-slate-900">{result.title}</div>
                            <div className="mt-1 truncate text-xs text-slate-500">{result.detail}</div>
                          </div>
                          <span className="shrink-0 rounded-full bg-white/65 px-2 py-1 text-[10px] font-bold text-slate-500">{result.subtitle}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 text-[11px] leading-5 text-slate-500">Arama geçmişi tutulmaz; öneriler mevcut görev, ders ve analiz bağlamından üretilir.</div>
                </div>
              )}
            </div>}
            {userType === UserType.Parent && !isParentLocked && <div ref={topbarNotificationsRef} className="relative">
              <button
                data-testid="topbar-notifications-toggle"
                data-unread-count={String(unreadNotificationItems.length)}
                onClick={() => { setNotificationsOpen((prev) => !prev); setSettingsOpen(false); setQuickActionsOpen(false); }}
                aria-label="Bildirimleri aç veya kapat"
                aria-expanded={notificationsOpen}
                title="Bildirimler"
                className="ios-button relative rounded-full p-2 text-slate-500 transition hover:text-slate-800"
              >
                <Bell className="h-5 w-5" />
                {showNotificationDot && !notificationsMuted && unreadNotificationItems.length > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />}
              </button>
              {notificationsOpen && (
                <div className="ios-card absolute right-0 top-12 z-50 w-[min(20rem,calc(100vw-1.5rem))] rounded-[26px] p-3" data-testid="notifications-popover">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-bold text-slate-800">Bildirimler</div>
                    <button data-testid="notifications-mark-all-read-btn" onClick={handleMarkAllNotificationsRead} className="ios-button rounded-full px-3 py-1 text-[11px] font-bold text-slate-700">Tümünü okundu yap</button>
                  </div>
                  {notificationsMuted ? (
                    <div data-testid="notifications-muted-state" className="ios-widget rounded-[18px] px-3 py-2 text-xs text-slate-500">Bildirimler sessizde.</div>
                  ) : unreadNotificationItems.length === 0 ? (
                    <div data-testid="notifications-empty-state" className="ios-widget rounded-[18px] px-3 py-2 text-xs text-slate-500">Yeni bildirim yok.</div>
                  ) : (
                    <div className="space-y-2">
                      {unreadNotificationItems.map((item, index) => (
                        <button
                          key={item.key}
                          data-testid={`notification-item-${index}`}
                          data-notification-key={item.key}
                          data-cooldown-group={getNotificationGroupKey(item.key)}
                          data-notification-tier={item.tier || 'normal'}
                          onClick={() => handleNotificationAction(item)}
                          className="ios-widget w-full rounded-[18px] px-3 py-2 text-left transition hover:bg-white/80"
                        >
                          <div className="text-xs font-bold text-slate-800">{item.title}</div>
                          <div className="mt-1 text-[11px] text-slate-500">{item.description}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>}
            {userType === UserType.Parent && !isParentLocked && <div ref={topbarSettingsRef} className="relative">
              <button onClick={() => { setSettingsOpen((prev) => !prev); setNotificationsOpen(false); setQuickActionsOpen(false); }} aria-label="Uygulama ayarlarını aç veya kapat" aria-expanded={settingsOpen} title="Uygulama ayarları" className="ios-button rounded-full p-2 text-slate-500 transition hover:text-slate-800">
                <Settings className="h-5 w-5" />
              </button>
            </div>}
            </div>
            <div className="ios-button hidden h-9 w-9 items-center justify-center overflow-hidden rounded-full text-slate-600 sm:flex">
              <User className="h-4 w-4" />
            </div>
          </div>
        </div>
      </header>

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
                    <div className="relative flex items-center justify-between xl:hidden">
                      <button onClick={() => setParentMenuOpen((prev) => !prev)} className="ios-button inline-flex items-center gap-2 rounded-[20px] px-4 py-3 text-sm font-semibold text-slate-700 xl:hidden">
                        {parentMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />} Modüller
                      </button>
                      <div ref={parentControlButtonRef} className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setParentControlCenterOpen((prev) => !prev);
                            setParentMenuOpen(false);
                            setNotificationsOpen(false);
                            setSettingsOpen(false);
                            setQuickActionsOpen(false);
                            setSearchOpen(false);
                          }}
                          aria-label="Kontrol merkezini aç veya kapat"
                          aria-expanded={parentControlCenterOpen}
                          className="ios-button-active flex h-12 w-12 items-center justify-center rounded-full text-slate-900 shadow-lg"
                        >
                          <Settings className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    {parentMenuOpen && (
                      <div className="fixed inset-0 z-50 xl:hidden">
                        <button
                          type="button"
                          aria-label="Modül menüsünü kapat"
                          onClick={() => setParentMenuOpen(false)}
                          className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm"
                        />
                        <div className="ios-card absolute left-3 right-3 top-[calc(5rem+env(safe-area-inset-top))] max-h-[calc(100vh-6rem-env(safe-area-inset-bottom))] overflow-y-auto rounded-[28px] p-3">
                          <div className="space-y-4">
                            <div>
                              <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Kritik modüller</div>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                                      <div className="font-bold">{item.label}</div>
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
              startTask={startTask}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-slate-950/45 p-4 backdrop-blur-sm" role="presentation">
          <div className="ios-card flex max-h-[min(48rem,calc(100dvh-2rem))] w-[min(72rem,100%)] flex-col overflow-hidden rounded-[28px]" role="dialog" aria-modal="true" aria-label="Müfredat düzenleme">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
                  <BookOpen className="h-4 w-4" />
                  Müfredat Düzenleme
                </div>
                <h3 className="mt-2 text-2xl font-black text-slate-900">Ders / ünite / konu yapısı</h3>
                <p className="mt-1 text-sm text-slate-500">Kaydedilen iskelet Planlama sayfasında özet olarak kalır.</p>
              </div>
              <button type="button" onClick={() => setCurriculumEditorOpen(false)} className="ios-button flex h-11 w-11 items-center justify-center rounded-full text-slate-600" aria-label="Müfredat düzenlemeyi kapat">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="dr-modal-scroll min-h-0 flex-1 overflow-y-auto p-4">
              <Suspense fallback={<WorkspaceLoadingFallback label="Mufredat editoru yukleniyor..." />}>
                <CurriculumManagerPanel curriculum={curriculum} onSave={setCurriculum} />
              </Suspense>
            </div>
          </div>
        </div>
      )}
      {settingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-slate-950/45 p-4 backdrop-blur-sm" role="presentation">
          <div ref={settingsPopoverRef} className="ios-card flex max-h-[min(42rem,calc(100dvh-2rem))] w-[min(30rem,100%)] flex-col overflow-hidden rounded-[28px] p-4" role="dialog" aria-modal="true" aria-label="Uygulama ayarları">
            <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
              <div>
                <div className="text-base font-black text-slate-900">Uygulama Ayarları</div>
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
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Karar Ekrani</div>
                <button onClick={() => setParentDecisionV1Enabled((prev) => !prev)} className="ios-button flex w-full items-center justify-between rounded-[16px] px-3 py-2 text-left text-slate-700">
                  <span>Yeni karar ekrani (V1)</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${parentDecisionV1Enabled ? 'ios-mint text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{parentDecisionV1Enabled ? 'Acik' : 'Kapali'}</span>
                </button>
                <div className="mt-2 text-[11px] leading-5 text-slate-500">Kapali oldugunda analiz secimi fallback olarak Genel Bakis'a yonlenir.</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setParentDecisionRolloutMode('stable')}
                    className={`rounded-[14px] px-2 py-2 text-[11px] font-bold ${parentDecisionRolloutMode === 'stable' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}
                  >
                    Stable
                  </button>
                  <button
                    type="button"
                    onClick={() => setParentDecisionRolloutMode('beta')}
                    className={`rounded-[14px] px-2 py-2 text-[11px] font-bold ${parentDecisionRolloutMode === 'beta' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}
                  >
                    Beta
                  </button>
                </div>
                <div className="mt-2 text-[11px] leading-5 text-slate-500">
                  Stable modda V1 varsayilan kurallar calisir. Beta modda tuning ayarlari aktif olur.
                </div>
              </div>

              <div className="ios-widget rounded-[20px] p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Karar Motoru Tuning</div>
                <div className={`space-y-3 ${parentDecisionRolloutMode === 'stable' ? 'opacity-60' : ''}`}>
                  <label className="block text-[11px] text-slate-600">
                    Risk kritik eşiği: {parentDecisionRuleOverrides.thresholds?.riskCriticalMin ?? 65}
                    <input
                      type="range"
                      min={50}
                      max={90}
                      step={1}
                      value={parentDecisionRuleOverrides.thresholds?.riskCriticalMin ?? 65}
                      disabled={parentDecisionRolloutMode === 'stable'}
                      onChange={(event) => setParentDecisionRuleOverrides((prev) => ({
                        ...prev,
                        thresholds: { ...(prev.thresholds || {}), riskCriticalMin: Number(event.target.value) },
                      }))}
                      className="mt-1 w-full"
                    />
                  </label>
                  <label className="block text-[11px] text-slate-600">
                    Risk dikkat eşiği: {parentDecisionRuleOverrides.thresholds?.riskWarningMin ?? 45}
                    <input
                      type="range"
                      min={30}
                      max={70}
                      step={1}
                      value={parentDecisionRuleOverrides.thresholds?.riskWarningMin ?? 45}
                      disabled={parentDecisionRolloutMode === 'stable'}
                      onChange={(event) => setParentDecisionRuleOverrides((prev) => ({
                        ...prev,
                        thresholds: { ...(prev.thresholds || {}), riskWarningMin: Number(event.target.value) },
                      }))}
                      className="mt-1 w-full"
                    />
                  </label>
                  <label className="block text-[11px] text-slate-600">
                    Konu uyarı eşiği: {parentDecisionRuleOverrides.thresholds?.weakTopicCountWarning ?? 4}
                    <input
                      type="range"
                      min={2}
                      max={10}
                      step={1}
                      value={parentDecisionRuleOverrides.thresholds?.weakTopicCountWarning ?? 4}
                      disabled={parentDecisionRolloutMode === 'stable'}
                      onChange={(event) => setParentDecisionRuleOverrides((prev) => ({
                        ...prev,
                        thresholds: { ...(prev.thresholds || {}), weakTopicCountWarning: Number(event.target.value) },
                      }))}
                      className="mt-1 w-full"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setParentDecisionRuleOverrides({})}
                    disabled={parentDecisionRolloutMode === 'stable'}
                    className="ios-button w-full rounded-[14px] px-3 py-2 text-[11px] font-bold text-slate-700"
                  >
                    Tuning'i sıfırla (V1 varsayılan)
                  </button>
                </div>
              </div>

              <div className="ios-widget rounded-[20px] p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Observability</div>
                <div className="space-y-2 text-[11px] text-slate-600">
                  <div className="flex items-center justify-between rounded-[12px] bg-white/60 px-2 py-1">
                    <span>Toplam event</span>
                    <strong>{observabilitySummary.total}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-[12px] bg-white/60 px-2 py-1">
                    <span>Son event tipi</span>
                    <strong>{observabilitySummary.topType || '-'}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-[12px] bg-white/60 px-2 py-1">
                    <span>Son 30 event</span>
                    <strong>{observabilitySummary.recentCount}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-[12px] bg-white/60 px-2 py-1">
                    <span>Cache hit/miss</span>
                    <strong>{analysisPipelineState.cacheHits}/{analysisPipelineState.cacheMisses}</strong>
                  </div>
                  <div className="flex items-center justify-between rounded-[12px] bg-white/60 px-2 py-1">
                    <span>Son batch</span>
                    <strong>{analysisPipelineState.lastBackgroundRecomputeAt ? new Date(analysisPipelineState.lastBackgroundRecomputeAt).toLocaleTimeString('tr-TR') : '-'}</strong>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Son olay: {observabilitySummary.lastEventTs ? new Date(observabilitySummary.lastEventTs).toLocaleString('tr-TR') : 'yok'}
                  </div>
                  <div className="rounded-[12px] bg-white/60 px-2 py-2 text-[10px] text-slate-600">
                    <div className="mb-1 font-bold uppercase tracking-wide text-slate-500">Son 5 olay</div>
                    {observabilityRecent.length === 0 && <div>Kayit yok.</div>}
                    {observabilityRecent.map((event, index) => (
                      <div key={`${event.ts}-${event.type}-${index}`} className="mb-1 last:mb-0">
                        <div className="font-semibold">{event.type}</div>
                        <div className="text-slate-500">
                          {new Date(event.ts).toLocaleTimeString('tr-TR')} {event.note ? `· ${event.note}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setObservabilityEvents([])}
                    className="ios-button w-full rounded-[14px] px-3 py-2 text-[11px] font-bold text-slate-700"
                  >
                    Event kaydini temizle
                  </button>
                  <button
                    type="button"
                    onClick={exportObservabilityAudit}
                    className="ios-button w-full rounded-[14px] px-3 py-2 text-[11px] font-bold text-slate-700"
                  >
                    Audit JSON indir
                  </button>
                </div>
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
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Program Ayarları</div>
                <button onClick={handleOpenScheduleSettings} className="ios-button flex w-full items-center justify-between rounded-[16px] px-3 py-2 text-left text-slate-700">
                  <span>Ders Programını Değiştir</span>
                  <span className="ios-blue rounded-full px-2 py-0.5 text-[10px] font-bold text-slate-700">Aç</span>
                </button>
              </div>

              <div className="ios-widget rounded-[20px] p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Veri Yönetimi</div>
                <div className="-mx-2">
                  {renderParentDashboardMode('data')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {parentControlCenterOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-slate-950/45 p-4 backdrop-blur-sm" role="presentation">
          <div ref={parentControlCenterRef} className="ios-card flex max-h-[min(43rem,calc(100dvh-2rem))] w-[min(32rem,100%)] flex-col overflow-hidden rounded-[28px] p-4" role="dialog" aria-modal="true" aria-label="Kontrol merkezi">
            <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
              <div>
                <div className="text-base font-black text-slate-900">Kontrol Merkezi</div>
                <div className="mt-1 text-xs text-slate-500">{parentWorkspaceItems.find((item) => item.id === parentWorkspaceView)?.label}</div>
              </div>
              <button type="button" onClick={() => setParentControlCenterOpen(false)} className="ios-button flex h-10 w-10 items-center justify-center rounded-full text-slate-600" aria-label="Kontrol merkezini kapat">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="dr-modal-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1 text-xs">
              <div className="ios-widget rounded-[20px] p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Kullanıcı</div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { handleUserTypeChange(UserType.Parent); setParentControlCenterOpen(false); }} className="ios-button-active rounded-[16px] px-2 py-2 font-bold text-slate-900">Ebeveyn</button>
                  <button type="button" onClick={() => { handleUserTypeChange(UserType.Child); setParentControlCenterOpen(false); }} className="ios-button rounded-[16px] px-2 py-2 font-bold text-slate-700">Çocuk</button>
                </div>
              </div>

              <div className="ios-widget rounded-[20px] p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Tema</div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setThemeMode('light')} className={`rounded-[16px] px-2 py-2 font-bold ${themeMode === 'light' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}>Açık</button>
                  <button type="button" onClick={() => setThemeMode('dark')} className={`rounded-[16px] px-2 py-2 font-bold ${themeMode === 'dark' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}>Koyu</button>
                </div>
              </div>

              <div className="ios-widget rounded-[20px] p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Hızlı Geçiş</div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => handleQuickAction('planning', 'Akademik planlama açıldı.')} className="ios-button rounded-[16px] px-2 py-2 font-bold text-slate-700">Planlama</button>
                  <button type="button" onClick={() => handleQuickAction('planning', 'Aktif plan takibi açıldı.')} className="ios-button rounded-[16px] px-2 py-2 font-bold text-slate-700">Aktif plan</button>
                  <button type="button" onClick={() => handleQuickAction('planning', 'Sınav takvimi açıldı.')} className="ios-button rounded-[16px] px-2 py-2 font-bold text-slate-700">Sınav takvimi</button>
                  <button type="button" onClick={() => handleQuickAction('analysis', 'Analiz ve raporlar açıldı.')} className="ios-button rounded-[16px] px-2 py-2 font-bold text-slate-700">Analiz</button>
                  <button type="button" onClick={() => handleQuickAction('overview', 'Genel bakış açıldı.')} className="ios-button rounded-[16px] px-2 py-2 font-bold text-slate-700">Özet</button>
                </div>
              </div>

              <div className="ios-widget rounded-[20px] p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Arama</div>
                <input
                  value={globalSearchQuery}
                  onChange={(event) => setGlobalSearchQuery(event.target.value)}
                  placeholder="Görev, ders, konu, sınav veya ödül"
                  className="ios-button w-full rounded-[16px] px-3 py-2 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                />
                {globalSearchQuery && (
                  <div className="dr-modal-scroll mt-2 max-h-44 space-y-2 overflow-y-auto">
                    {globalSearchResults.length === 0 ? (
                      <div className="text-[11px] text-slate-500">Sonuç bulunamadı.</div>
                    ) : globalSearchResults.slice(0, 4).map((result) => (
                      <button key={result.id} type="button" onClick={() => { handleSearchResultSelect(result); setParentControlCenterOpen(false); }} className="ios-button w-full rounded-[14px] px-3 py-2 text-left text-slate-700">
                        <span className="block truncate text-xs font-black">{result.title}</span>
                        <span className="block truncate text-[11px] text-slate-500">{result.subtitle}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setNotificationsMuted((prev) => !prev)} className="ios-button rounded-[18px] px-3 py-3 text-left text-slate-700">
                  <span className="block text-[11px] font-bold uppercase text-slate-500">Bildirim</span>
                  <span className="text-sm font-black">{notificationsMuted ? 'Sessiz' : 'Açık'}</span>
                </button>
                <button type="button" onClick={() => { setSettingsOpen(true); setParentControlCenterOpen(false); }} className="ios-button rounded-[18px] px-3 py-3 text-left text-slate-700">
                  <span className="block text-[11px] font-bold uppercase text-slate-500">Ayarlar</span>
                  <span className="text-sm font-black">Aç</span>
                </button>
              </div>

              <button type="button" onClick={handleLockParentNow} className="ios-coral flex w-full items-center justify-between rounded-[20px] px-4 py-3 text-left font-black text-rose-950">
                <span>Paneli Kilitle</span>
                <Lock className="h-4 w-4" />
              </button>
            </div>
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
                className="ios-button shrink-0 rounded-full px-3 py-1 text-xs font-black text-slate-800"
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





























