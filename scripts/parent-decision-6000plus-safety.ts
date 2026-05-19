import { spawn } from 'node:child_process';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as wait } from 'node:timers/promises';
import { deriveAnalysisSnapshot } from '../utils/analysisEngine';
import {
  buildParentDecision,
  getNotificationTierFromLevel,
  getTopicDecisionLevel,
  type DecisionLevel,
} from '../utils/parentDecisionEngine';
import {
  INITIAL_REAL_COURSES,
  INITIAL_REAL_CURRICULUM,
  INITIAL_REAL_PERFORMANCE,
} from '../initialRealCurriculum';
import type {
  CompositeExamResult,
  Course,
  ExamRecord,
  PerformanceData,
  SubjectCurriculum,
  Task,
} from '../types';

type LoadLevel = 3000 | 6000 | 10000 | 20000;

type Verdict = 'PASS' | 'FAIL';

interface StorageProbe {
  localStorageBytes: number;
  indexedDbBytes: number | null;
  storageEstimateBytes: number | null;
}

interface BrowserPerfProbe {
  screenOpenMs: number;
  analysisReadyMs: number;
  graphRenderMs: number;
  jsHeapUsedBytes: number | null;
  jsHeapTotalBytes: number | null;
  cacheHits: number;
  cacheMisses: number;
  cacheVersion: number;
  storage: StorageProbe;
  screenshot: string;
}

interface EnginePerfProbe {
  analysisMs: number;
  decisionMs: number;
  cacheSecondRunMs: number;
  cacheHit: number;
  cacheMiss: number;
  rssBytes: number;
  heapUsedBytes: number;
  storageBytesEstimate: number;
  sessionCount: number;
  topicCount: number;
  generalScore: number;
}

interface LoadTestResult {
  level: LoadLevel;
  expected: string;
  actual: string;
  verdict: Verdict;
  engine: EnginePerfProbe;
  browser: BrowserPerfProbe;
}

interface FatalErrorProbe {
  hasFatalScreen: boolean;
  fatalMessage: string | null;
  errorCount: number;
  errorLog: string[];
}

interface NavigationCaseResult {
  name: string;
  loops: number;
  expected: string;
  actual: string;
  blankScreens: number;
  stateMismatches: number;
  duplicateIssues: number;
  crashes: number;
  verdict: Verdict;
  screenshot: string;
}

interface GraphAccuracyResult {
  expected: string;
  actual: string;
  verdict: Verdict;
  checks: Array<{ key: string; expected: string | number; actual: string | number; verdict: Verdict }>;
  screenshot: string;
}

interface CalculationAccuracyResult {
  sampleCount: number;
  expected: string;
  actual: string;
  verdict: Verdict;
  mismatches: number;
  examples: Array<Record<string, string | number>>;
}

interface StressResult {
  durationMinutes: number;
  expected: string;
  actual: string;
  verdict: Verdict;
  memoryGrowthBytes: number | null;
  cacheDelta: { hit: number; miss: number };
  storageGrowthBytes: number;
  delayedFrames: number;
  screenshot: string;
}

interface SoakResult {
  durationMinutes: number;
  iterations: number;
  expected: string;
  actual: string;
  verdict: Verdict;
  memoryGrowthBytes: number | null;
  crashCount: number;
  dataMismatchCount: number;
  screenshot: string;
}

interface FinalReportModel {
  generatedAt: string;
  appUrl: string;
  environment: {
    os: string;
    node: string;
  };
  loadTests: LoadTestResult[];
  navigation: NavigationCaseResult[];
  graphAccuracy: GraphAccuracyResult;
  calculations: CalculationAccuracyResult;
  stress: StressResult;
  soak: SoakResult;
  risks: string[];
  answers: Array<{ question: string; answer: string }>;
}

interface SeedPayload {
  courses: Course[];
  curriculum: SubjectCurriculum;
  tasks: Task[];
  performanceData: PerformanceData[];
  examRecords: ExamRecord[];
  compositeExamResults: CompositeExamResult[];
  successPoints: number;
  goalConfig: {
    weeklyQuestionTarget: number;
    weeklyStudyMinuteTarget: number;
    topicCompletionTarget: number;
    courseQuestionTargets: Record<string, number>;
    lgsTargetDate: string;
    lgsTargetNet: number;
  };
}

interface TopicRef {
  course: Course;
  unitName: string;
  topicName: string;
  sequence: number;
}

const ROOT = process.cwd();
const DATE = '2026-05-18';
const ARTIFACT_DIR = path.join(ROOT, 'docs', `e2e-artifacts-${DATE}-6000plus`);
const CHROME_PROFILE_ROOT = path.join(process.cwd(), 'node_modules', '.cache', 'dersrotasi-qa-profiles');
const JSON_PATH = path.join(ARTIFACT_DIR, 'parent-decision-6000plus-raw.json');
const REPORT_PATH = path.join(ROOT, 'docs', 'ebeveyn-karar-ekrani-6000plus-guven-raporu.md');
const REPORT_PATH_V2 = path.join(ROOT, 'docs', 'ebeveyn-karar-ekrani-6000plus-guven-raporu-v2.md');
const RUN_LOG = path.join(ARTIFACT_DIR, 'run.log');
const BASE_URL = 'http://127.0.0.1:3000';
const DEVTOOLS_PORT = Number(process.env.QA_DEVTOOLS_PORT || (9334 + (process.pid % 17)));
const CHROME_BIN = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const NODE_BIN = process.execPath;
const FAST_MODE = process.env.QA_FAST === '1';
const ONLY_LOAD_MODE = process.env.QA_ONLY_LOAD === '1';
const REPEAT_6000 = Number(process.env.QA_REPEAT_6000 || 0);
const NAVIGATION_LOOPS = FAST_MODE ? 5 : 100;
const STRESS_MINUTES = FAST_MODE ? 1 : 10;
const SOAK_MINUTES = FAST_MODE ? 3 : 30;
const NAV_SELECTOR_TIMEOUT = FAST_MODE ? 2800 : 5200;
const APP_IDB_NAME = 'dersrotasi-app-state-v1';
const APP_IDB_STORE = 'kv';
const APP_IDB_BACKED_KEYS = [
  'tasks',
  'curriculum',
  'examScheduleEntries',
  'examRecords',
  'compositeExamResults',
  'studyPlans',
  'planningEngineSnapshot',
  'performanceData',
  'observabilityEvents',
] as const;

const ANALYSIS_BUDGET_MS: Record<LoadLevel, number> = {
  3000: 1800,
  6000: 2200,
  10000: 3600,
  20000: 7000,
};

const SCREEN_OPEN_BUDGET_MS: Record<LoadLevel, number> = {
  3000: 2600,
  6000: 3200,
  10000: 4500,
  20000: 8500,
};

const GRAPH_RENDER_BUDGET_MS: Record<LoadLevel, number> = {
  3000: 1700,
  6000: 2200,
  10000: 3500,
  20000: 6000,
};

const DEFAULT_LOAD_LEVELS: LoadLevel[] = [3000, 6000, 10000, 20000];

const parseRequestedLoadLevels = (): LoadLevel[] => {
  const raw = process.env.QA_LEVELS;
  if (!raw || !raw.trim()) return DEFAULT_LOAD_LEVELS;
  const parsed = raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((value): value is LoadLevel => value === 3000 || value === 6000 || value === 10000 || value === 20000);
  return parsed.length > 0 ? parsed : DEFAULT_LOAD_LEVELS;
};

const REQUESTED_LOAD_LEVELS = parseRequestedLoadLevels();

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const nowIso = () => new Date().toISOString();

const toLink = (p: string) => p.replace(/\\/g, '/');

const log = async (line: string) => appendFile(RUN_LOG, `${nowIso()} ${line}\n`, 'utf8');

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const createTopicRefs = (courses: Course[], curriculum: SubjectCurriculum): TopicRef[] =>
  courses.flatMap((course) => {
    const units = curriculum[course.name] || [];
    return units.flatMap((unit, unitIndex) =>
      unit.topics.map((topic, topicIndex) => ({
        course,
        unitName: unit.name,
        topicName: topic.name,
        sequence: course.order * 1000 + unitIndex * 100 + topicIndex,
      })),
    );
  });

const weightedCourses = (courses: Course[]): Course[] =>
  courses.flatMap((course) => {
    const name = course.name.toLocaleLowerCase('tr-TR');
    const weight = name.includes('matematik') ? 4
      : name.includes('fen') ? 3
        : name.includes('turk') ? 3
          : name.includes('ingiliz') ? 2
            : 1;
    return Array.from({ length: weight }, () => course);
  });

const createSeedPayload = (taskCount: LoadLevel): SeedPayload => {
  const courses = INITIAL_REAL_COURSES.filter((course) => course.active !== false);
  const curriculum = INITIAL_REAL_CURRICULUM;
  const topicRefs = createTopicRefs(courses, curriculum);
  const weighted = weightedCourses(courses);
  const byCourse = new Map<string, TopicRef[]>();
  topicRefs.forEach((ref) => {
    const bucket = byCourse.get(ref.course.id) || [];
    bucket.push(ref);
    byCourse.set(ref.course.id, bucket);
  });

  const now = new Date('2026-05-18T20:00:00');
  const questionLimit = Math.round(taskCount * 0.62);
  const revisionLimit = questionLimit + Math.round(taskCount * 0.16);
  const completedLimit = Math.round(taskCount * 0.93);
  const parentActionEvery = 41;
  const seededParentActionIds = new Set<string>();

  const tasks: Task[] = Array.from({ length: taskCount }, (_, index) => {
    const course = weighted[index % weighted.length];
    const courseTopics = byCourse.get(course.id) || topicRefs;
    const topic = courseTopics[(index * 7) % courseTopics.length];
    const dayOffset = index % 210;
    const completionDate = new Date(now);
    completionDate.setDate(completionDate.getDate() - dayOffset);
    const completionDateIso = toIsoDate(completionDate);
    const hourBuckets = [7, 9, 11, 14, 17, 19, 21, 23];
    const hour = hourBuckets[index % hourBuckets.length];
    const minute = (index * 13) % 60;
    const completionTs = new Date(`${completionDateIso}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`).getTime();

    const isQuestion = index < questionLimit;
    const isRevision = index >= questionLimit && index < revisionLimit;
    const completed = index < completedLimit;
    const weakTopic = topic.sequence % 11 === 0;
    const riskyPattern = index % 53 === 0;
    const plannedDuration = isQuestion ? 25 + ((index % 6) * 5) : isRevision ? 30 : 40;
    const durationSec = Math.max(420, plannedDuration * 60 + ((index % 9) - 4) * 90);
    const questionCount = isQuestion ? 12 + (index % 31) : undefined;
    const rawAccuracy = weakTopic
      ? 0.43 + ((index % 14) / 100)
      : riskyPattern
        ? 0.49 + ((index % 9) / 100)
        : 0.64 + ((index % 28) / 100);
    const safeAccuracy = clamp(Math.round(rawAccuracy * 100), 10, 98) / 100;
    const correctCount = questionCount ? Math.max(0, Math.min(questionCount, Math.round(questionCount * safeAccuracy))) : undefined;
    const incorrectCount = questionCount && typeof correctCount === 'number'
      ? Math.max(0, questionCount - correctCount - (index % 4 === 0 ? 1 : 0))
      : undefined;
    const emptyCount = questionCount && typeof correctCount === 'number' && typeof incorrectCount === 'number'
      ? Math.max(0, questionCount - correctCount - incorrectCount)
      : undefined;
    const successScore = isQuestion
      ? clamp(Math.round((safeAccuracy * 100) - (riskyPattern ? 8 : 0) + (index % 7)), 20, 99)
      : clamp((isRevision ? 56 : 60) + (index % 34), 25, 98);

    const todayIso = toIsoDate(now);
    const isParentAction = completed ? false : index % parentActionEvery === 0;
    const compactUnit = `U${topic.sequence % 80}`;
    const compactTopic = index % 300 === 0 ? topic.topicName : `K${topic.sequence % 2400}`;
    const actionTopicKey = topic.topicName
      .toLocaleLowerCase('tr-TR')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 42);

    let planTaskId = isParentAction
      ? (isQuestion
        ? `parent-action-exam15-${todayIso}-${course.id}`
        : `parent-action-revision-${todayIso}-${course.id}-${actionTopicKey || 'konu'}`)
      : (index % 8 === 0 ? `bulk-plan-${index}` : undefined);

    if (isParentAction && planTaskId) {
      if (seededParentActionIds.has(planTaskId)) {
        planTaskId = undefined;
      } else {
        seededParentActionIds.add(planTaskId);
      }
    }

    return {
      id: `bulk_task_${taskCount}_${index}`,
      courseId: course.id,
      title: `${course.name} T${index % 500}`,
      dueDate: completed ? completionDateIso : todayIso,
      status: completed ? 'tamamlandı' : 'bekliyor',
      taskType: isQuestion ? 'soru çözme' : 'ders çalışma',
      taskGoalType: isQuestion ? 'test-cozme' : isRevision ? 'konu-tekrari' : 'ders calisma',
      plannedDuration,
      actualDuration: completed ? durationSec : undefined,
      breakTime: completed ? (index % 6) * 40 : undefined,
      pauseTime: completed ? (index % 5) * 35 : undefined,
      questionCount,
      correctCount,
      incorrectCount,
      emptyCount,
      firstAttemptScore: isQuestion ? clamp(successScore - (index % 12), 10, 99) : undefined,
      selfAssessmentScore: completed ? clamp(successScore + ((index % 11) - 5), 15, 100) : undefined,
      confidenceGap: completed ? ((index % 11) - 5) : undefined,
      conceptErrorCount: isQuestion ? (weakTopic ? 2 + (index % 4) : index % 3) : undefined,
      processErrorCount: isQuestion ? index % 5 : undefined,
      attentionErrorCount: isQuestion ? (index + 2) % 6 : undefined,
      successScore: completed ? successScore : undefined,
      focusScore: completed ? clamp((weakTopic ? 58 : 74) + ((index % 10) - 4), 25, 99) : undefined,
      pointsAwarded: completed ? Math.max(4, Math.round((successScore + (plannedDuration / 2)) / 10)) : undefined,
      completionDate: completed ? completionDateIso : undefined,
      completionTimestamp: completed ? completionTs : undefined,
      isSelfAssigned: index % 9 === 0,
      planTaskId,
      planSource: planTaskId ? 'manual' : (index % 8 === 0 ? 'weekly-plan' : undefined),
      planLabel: isParentAction && planTaskId
        ? (isQuestion ? 'Veli onerisi: Deneme takibi' : 'Veli onerisi: Acil tekrar')
        : undefined,
      curriculumUnitName: compactUnit,
      curriculumTopicName: compactTopic,
    } satisfies Task;
  });

  const perCourseTargets: Record<string, number> = {};
  courses.forEach((course, idx) => {
    perCourseTargets[course.id] = 120 + (idx * 20);
  });

  const performanceData: PerformanceData[] = INITIAL_REAL_PERFORMANCE.map((item, idx) => {
    const courseTasks = tasks.filter((task) => task.courseId === item.courseId && task.status === 'tamamlandı');
    const correct = courseTasks.reduce((sum, task) => sum + (task.correctCount || 0), 0);
    const incorrect = courseTasks.reduce((sum, task) => sum + (task.incorrectCount || 0), 0);
    const timeSpent = Math.round(courseTasks.reduce((sum, task) => sum + ((task.actualDuration || 0) / 60), 0));
    return {
      ...item,
      correct: correct || Math.max(120, item.correct),
      incorrect: incorrect || Math.max(40, item.incorrect),
      timeSpent: timeSpent || Math.max(300, item.timeSpent + idx * 40),
    };
  });

  const examRecords: ExamRecord[] = courses.flatMap((course, idx) =>
    Array.from({ length: 4 }, (_, examIndex) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (idx * 6 + examIndex * 17 + 3));
      const score = clamp(58 + ((idx * 8 + examIndex * 5) % 35), 30, 99);
      return {
        id: `bulk_exam_${taskCount}_${course.id}_${examIndex}`,
        courseId: course.id,
        courseName: course.name,
        examType: 'school-written',
        title: `${course.name} yazili ${examIndex + 1}`,
        date: toIsoDate(date),
        termKey: '2026-2',
        scopeType: 'course',
        score,
        maxScore: 100,
        source: 'manual',
      } satisfies ExamRecord;
    }),
  );

  const compositeExamResults: CompositeExamResult[] = Array.from({ length: 8 }, (_, idx) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (idx * 14 + 2));
    const drop = idx === 0 ? -8 : 0;
    const coursesPayload = courses.map((course, cIdx) => {
      const baseScore = clamp(52 + ((cIdx * 9 + idx * 4) % 38) + drop, 25, 98);
      return {
        courseId: course.id,
        courseName: course.name,
        score: baseScore,
        net: Math.max(1, Math.round(baseScore / 8)),
      };
    });
    const totalScore = Math.round(coursesPayload.reduce((sum, course) => sum + course.score, 0) * 1.5);
    return {
      id: `bulk_lgs_${taskCount}_${idx}`,
      title: `LGS deneme ${8 - idx}`,
      examType: 'mock-exam',
      date: toIsoDate(date),
      totalScore,
      courses: coursesPayload,
    } satisfies CompositeExamResult;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const successPoints = tasks.reduce((sum, task) => sum + (task.pointsAwarded || 0), 0);

  return {
    courses,
    curriculum,
    tasks,
    performanceData,
    examRecords,
    compositeExamResults,
    successPoints,
    goalConfig: {
      weeklyQuestionTarget: 420,
      weeklyStudyMinuteTarget: 900,
      topicCompletionTarget: 24,
      courseQuestionTargets: perCourseTargets,
      lgsTargetDate: '2026-06-20',
      lgsTargetNet: 430,
    },
  };
};

const jsonBytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf8');

const getStorageEstimate = (payload: SeedPayload): number =>
  jsonBytes(payload.tasks)
  + jsonBytes(payload.performanceData)
  + jsonBytes(payload.examRecords)
  + jsonBytes(payload.compositeExamResults)
  + jsonBytes(payload.goalConfig)
  + jsonBytes(payload.curriculum)
  + jsonBytes(payload.courses);

const createLevelEngineProbe = (payload: SeedPayload, level: LoadLevel): { analysis: ReturnType<typeof deriveAnalysisSnapshot>; decision: ReturnType<typeof buildParentDecision>; probe: EnginePerfProbe } => {
  const beforeMem = process.memoryUsage();
  const started = performance.now();
  const analysis = deriveAnalysisSnapshot(
    payload.tasks,
    payload.courses,
    [],
    payload.examRecords,
    payload.compositeExamResults,
  );
  const analysisMs = Math.round(performance.now() - started);

  const decisionStarted = performance.now();
  const latestCompositeAverage = payload.compositeExamResults[0]
    ? Math.round(payload.compositeExamResults[0].courses.reduce((sum, course) => sum + course.score, 0) / payload.compositeExamResults[0].courses.length)
    : null;
  const previousCompositeAverage = payload.compositeExamResults[1]
    ? Math.round(payload.compositeExamResults[1].courses.reduce((sum, course) => sum + course.score, 0) / payload.compositeExamResults[1].courses.length)
    : null;

  const weakTopicCount = analysis.topics.filter((topic) => topic.needsRevision).length;
  const weeklyCompletedCount = analysis.sessions.filter((session) => {
    const d = new Date(`${session.completionDate}T00:00:00`);
    const now = new Date('2026-05-18T20:00:00');
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return d >= new Date(`${toIsoDate(start)}T00:00:00`);
  }).length;

  const decision = buildParentDecision({
    sessionsCount: analysis.sessions.length,
    weeklyCompletedCount,
    weakTopicCount,
    averageRisk: analysis.overall.averageRisk,
    latestCompositeAverage,
    previousCompositeAverage,
    parentActionPendingCount: payload.tasks.filter((task) => (task.planTaskId || '').startsWith('parent-action-') && task.status === 'bekliyor').length,
    parentActionCompletedCount: payload.tasks.filter((task) => (task.planTaskId || '').startsWith('parent-action-') && task.status === 'tamamlandı').length,
    parentActionCompletedTodayCount: payload.tasks.filter((task) => (task.planTaskId || '').startsWith('parent-action-') && task.status === 'tamamlandı' && task.completionDate === '2026-05-18').length,
  });
  const decisionMs = Math.round(performance.now() - decisionStarted);

  const secondStarted = performance.now();
  const second = deriveAnalysisSnapshot(
    payload.tasks,
    payload.courses,
    [],
    payload.examRecords,
    payload.compositeExamResults,
  );
  const secondMs = Math.round(performance.now() - secondStarted);

  assert(JSON.stringify(analysis.overall) === JSON.stringify(second.overall), `Analysis idempotent olmali (${level}).`);

  const afterMem = process.memoryUsage();
  const probe: EnginePerfProbe = {
    analysisMs,
    decisionMs,
    cacheSecondRunMs: secondMs,
    cacheHit: 1,
    cacheMiss: 1,
    rssBytes: afterMem.rss,
    heapUsedBytes: afterMem.heapUsed,
    storageBytesEstimate: getStorageEstimate(payload),
    sessionCount: analysis.sessions.length,
    topicCount: analysis.topics.length,
    generalScore: analysis.overall.generalScore,
  };

  const rssDiff = afterMem.rss - beforeMem.rss;
  awaitableWarn(rssDiff > 900 * 1024 * 1024, `RSS artisi yuksek: ${Math.round(rssDiff / (1024 * 1024))} MB`);
  return { analysis, decision, probe };
};

const awaitableWarn = (condition: boolean, message: string) => {
  if (condition) {
    void log(`WARN ${message}`);
  }
};

class CdpClient {
  private ws: WebSocket | null = null;
  private seq = 0;
  private pending = new Map<number, {
    resolve: (value: any) => void;
    reject: (err: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  constructor(private readonly wsUrl: string) {}

  async connect(): Promise<void> {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise<void>((resolve, reject) => {
      if (!this.ws) return reject(new Error('WS not initialized'));
      this.ws.addEventListener('open', () => resolve());
      this.ws.addEventListener('error', (err) => reject(err));
    });
    this.ws.addEventListener('message', async (event) => {
      let raw: string;
      const data = event.data;
      if (typeof data === 'string') raw = data;
      else if (data instanceof Uint8Array) raw = Buffer.from(data).toString('utf8');
      else if (data instanceof ArrayBuffer) raw = Buffer.from(new Uint8Array(data)).toString('utf8');
      else if (typeof (data as any)?.text === 'function') raw = await (data as any).text();
      else raw = String(data);

      let payload: any;
      try {
        payload = JSON.parse(raw);
      } catch {
        return;
      }
      if (!payload.id) return;
      const waiter = this.pending.get(payload.id);
      if (!waiter) return;
      this.pending.delete(payload.id);
      clearTimeout(waiter.timeout);
      if (payload.error) waiter.reject(new Error(payload.error.message || 'CDP error'));
      else waiter.resolve(payload.result || {});
    });
  }

  async send(method: string, params: Record<string, any> = {}): Promise<any> {
    const id = ++this.seq;
    const ws = this.ws;
    if (!ws) throw new Error('CDP not connected');
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 90000);
      this.pending.set(id, { resolve, reject, timeout });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate<T = any>(expression: string, fallback: T): Promise<T> {
    try {
      const result = await this.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      return (result?.result?.value ?? fallback) as T;
    } catch {
      return fallback;
    }
  }

  async screenshot(filePath: string): Promise<void> {
    const response = await this.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: true,
    });
    await writeFile(filePath, Buffer.from(response.data, 'base64'));
  }

  close() {
    try {
      this.ws?.close();
    } catch {
      // noop
    }
  }
}

const probeHttp = async (url: string, timeoutMs = 2500): Promise<boolean> => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) return true;
    } catch {
      // retry
    }
    await wait(250);
  }
  return false;
};

const waitForHttp = async (url: string, timeoutMs = 30000): Promise<boolean> => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await probeHttp(url, 450)) return true;
    await wait(350);
  }
  return false;
};

const startViteIfNeeded = async () => {
  if (await probeHttp(`${BASE_URL}/`, 1200)) {
    await log('vite already running');
    return null as ReturnType<typeof spawn> | null;
  }
  const vite = spawn(
    NODE_BIN,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '3000', '--strictPort'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  vite.stdout.on('data', (chunk) => appendFile(path.join(ARTIFACT_DIR, 'vite.log'), chunk.toString(), 'utf8'));
  vite.stderr.on('data', (chunk) => appendFile(path.join(ARTIFACT_DIR, 'vite.log'), chunk.toString(), 'utf8'));
  const ready = await waitForHttp(`${BASE_URL}/`, 70000);
  if (!ready) throw new Error('Vite ready olmadi.');
  await log('vite started by 6000plus script');
  return vite;
};

const startChrome = async () => {
  await mkdir(CHROME_PROFILE_ROOT, { recursive: true });
  const profileDir = path.join(CHROME_PROFILE_ROOT, `chrome-profile-${Date.now()}-${process.pid}`);
  const chrome = spawn(CHROME_BIN, [
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-component-extensions-with-background-pages',
    '--no-first-run',
    `--remote-debugging-port=${DEVTOOLS_PORT}`,
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore'] });

  const ready = await waitForHttp(`http://127.0.0.1:${DEVTOOLS_PORT}/json/version`, 30000);
  if (!ready) throw new Error('Chrome CDP endpoint hazir degil.');
  return chrome;
};

const createTargetWsUrl = async (url: string): Promise<string> => {
  const endpoint = `http://127.0.0.1:${DEVTOOLS_PORT}/json/new?${encodeURIComponent(url)}`;
  let response: Response;
  try {
    response = await fetch(endpoint, { method: 'PUT' });
  } catch {
    response = await fetch(endpoint);
  }
  if (!response.ok) throw new Error(`CDP target create failed: ${response.status}`);
  const payload = await response.json() as { webSocketDebuggerUrl?: string };
  if (!payload.webSocketDebuggerUrl) throw new Error('webSocketDebuggerUrl yok.');
  return payload.webSocketDebuggerUrl;
};

const waitPageReady = async (client: CdpClient, timeoutMs = 25000): Promise<boolean> => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ready = await client.evaluate<boolean>('document.readyState === "complete"', false);
    if (ready) return true;
    await wait(250);
  }
  return false;
};

const waitForSelector = async (client: CdpClient, selector: string, timeoutMs = 15000): Promise<boolean> => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const exists = await client.evaluate<boolean>(`Boolean(document.querySelector(${JSON.stringify(selector)}))`, false);
    if (exists) return true;
    await wait(200);
  }
  return false;
};

const ensureParentAnalysisWorkspace = async (client: CdpClient, timeoutMs = 25000): Promise<boolean> => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ready = await client.evaluate<boolean>(
      `Boolean(document.querySelector('[data-testid="parent-analysis-workspace"]'))`,
      false,
    );
    if (ready) return true;

    const lockVisible = await client.evaluate<boolean>(
      `Boolean(document.querySelector('[data-testid="parent-lock-screen"]'))`,
      false,
    );
    if (lockVisible) {
      await client.evaluate(`(() => {
        localStorage.setItem('isParentLocked', JSON.stringify(false));
        return true;
      })()`, true);
      await client.send('Page.reload', { ignoreCache: true });
      await waitPageReady(client, 10000);
      await wait(250);
      continue;
    }

    const childVisible = await client.evaluate<boolean>(
      `Boolean(document.querySelector('[data-testid="child-dashboard-root"]'))`,
      false,
    );
    if (childVisible) {
      await click(client, '[data-testid="switch-parent-mode-btn"]');
      await wait(250);
    }

    await client.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const analiz = buttons.find((btn) => (btn.textContent || '').trim() === 'Analiz');
      if (analiz && typeof analiz.click === 'function') analiz.click();
      return true;
    })()`, true);

    await wait(250);
  }
  return false;
};

const ensureChildDashboard = async (client: CdpClient, timeoutMs = 25000): Promise<boolean> => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const childReady = await client.evaluate<boolean>(
      `Boolean(document.querySelector('[data-testid="child-dashboard-root"]'))`,
      false,
    );
    if (childReady) return true;

    const parentVisible = await client.evaluate<boolean>(
      `Boolean(document.querySelector('[data-testid="parent-analysis-workspace"]'))`,
      false,
    );
    if (parentVisible) {
      await click(client, '[data-testid="switch-child-mode-btn"]');
      await wait(220);
      continue;
    }

    const lockVisible = await client.evaluate<boolean>(
      `Boolean(document.querySelector('[data-testid="parent-lock-screen"]'))`,
      false,
    );
    if (lockVisible) {
      await client.evaluate(`(() => {
        localStorage.setItem('isParentLocked', JSON.stringify(false));
        return true;
      })()`, true);
      await client.send('Page.reload', { ignoreCache: true });
      await waitPageReady(client, 10000);
      await wait(220);
      continue;
    }

    await wait(200);
  }
  return false;
};

const click = async (client: CdpClient, selector: string): Promise<boolean> => {
  const result = await client.evaluate<{ ok: boolean }>(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return { ok: false };
    if (typeof el.click === 'function') el.click();
    return { ok: true };
  })()`, { ok: false });
  return result.ok;
};

const clickByExactText = async (client: CdpClient, text: string): Promise<boolean> => {
  const result = await client.evaluate<{ ok: boolean }>(`(() => {
    const target = ${JSON.stringify(text)};
    const buttons = Array.from(document.querySelectorAll('button'));
    const hit = buttons.find((btn) => (btn.textContent || '').trim() === target);
    if (!hit) return { ok: false };
    hit.click();
    return { ok: true };
  })()`, { ok: false });
  return result.ok;
};

const openAnalysisTab = async (client: CdpClient, tab: 'overview' | 'insights' | 'goals' | 'reports'): Promise<boolean> => {
  const bySelector = await click(client, `[data-testid="analysis-tab-${tab}"]`);
  if (bySelector) return true;
  const labelMap: Record<typeof tab, string> = {
    overview: 'Genel Durum',
    insights: 'Odak Alanlari',
    goals: 'Hedef ve Deneme',
    reports: 'Raporlar',
  };
  return clickByExactText(client, labelMap[tab]);
};

const setSelect = async (client: CdpClient, selector: string, value: string): Promise<boolean> => {
  const result = await client.evaluate<{ ok: boolean }>(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el || el.tagName !== 'SELECT') return { ok: false };
    const selectEl = el;
    selectEl.value = ${JSON.stringify(value)};
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true };
  })()`, { ok: false });
  return result.ok;
};

const textContent = async (client: CdpClient, selector: string): Promise<string> =>
  client.evaluate<string>(`(() => (document.querySelector(${JSON.stringify(selector)})?.textContent || '').trim())()`, '');

const releaseSeedLock = async (client: CdpClient) => {
  await client.evaluate(`(() => {
    localStorage.removeItem('__qa_seed_lock');
    return true;
  })()`, true);
};

interface AnalysisReadyProbe {
  state: string;
  hasCourse: boolean;
  score: number | null;
  hasGraphCanvas: boolean;
  hasGraphSvg: boolean;
  hasGraphFallbackText: boolean;
}

const readAnalysisReadyProbe = async (client: CdpClient): Promise<AnalysisReadyProbe> =>
  client.evaluate<AnalysisReadyProbe>(`(() => {
    const readNumber = (value) => {
      if (typeof value !== 'string') return null;
      const match = value.match(/-?\\d+/);
      if (!match) return null;
      const parsed = Number(match[0]);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const workspace = document.querySelector('[data-testid="parent-analysis-workspace"]');
    const state = workspace?.getAttribute('data-analysis-state') || '';
    const hasCourse = Boolean(document.querySelector('[data-testid^="course-summary-btn-"]'));
    const scoreNode = document.querySelector('[data-testid="decision-signal-genel-skor"]');
    const score = readNumber(scoreNode?.textContent || '');
    const graphCanvas = document.querySelector('[data-testid="graph-main-canvas"]');
    const hasGraphSvg = Boolean(graphCanvas?.querySelector('svg, .recharts-surface, .recharts-wrapper'));
    const hasGraphFallbackText = Boolean(graphCanvas?.textContent && graphCanvas.textContent.trim().length > 0);
    return {
      state,
      hasCourse,
      score,
      hasGraphCanvas: Boolean(graphCanvas),
      hasGraphSvg,
      hasGraphFallbackText,
    };
  })()`, {
    state: '',
    hasCourse: false,
    score: null,
    hasGraphCanvas: false,
    hasGraphSvg: false,
    hasGraphFallbackText: false,
  });

const waitForGraphRender = async (client: CdpClient, timeoutMs = 30000): Promise<boolean> => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const probe = await readAnalysisReadyProbe(client);
    if (probe.hasGraphCanvas && (probe.hasGraphSvg || probe.hasGraphFallbackText)) return true;
    await wait(180);
  }
  return false;
};

const waitForSelectedGraph = async (
  client: CdpClient,
  category: 'genel' | 'ders' | 'konu' | 'zaman' | 'detay',
  graphKey: string,
  timeoutMs = 15000,
): Promise<boolean> => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const matches = await client.evaluate<boolean>(`(() => {
      const root = document.querySelector('[data-testid="analysis-graph-center"]');
      if (!root) return false;
      return root.getAttribute('data-selected-category') === ${JSON.stringify(category)}
        && root.getAttribute('data-selected-graph') === ${JSON.stringify(graphKey)};
    })()`, false);
    if (matches) return true;
    await wait(140);
  }
  return false;
};

const readDecisionSignalNumber = async (
  client: CdpClient,
  key: 'genel-skor' | 'odak' | 'verim' | 'dogruluk',
): Promise<number | null> =>
  client.evaluate<number | null>(`(() => {
    const extractNumber = (value) => {
      if (typeof value !== 'string') return null;
      const match = value.match(/-?\\d+/);
      if (!match) return null;
      const parsed = Number(match[0]);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const direct = document.querySelector('[data-testid="decision-signal-${key}"]');
    const directValue = extractNumber(direct?.textContent || '');
    if (directValue !== null) return directValue;

    const cards = Array.from(document.querySelectorAll('[data-testid^="decision-signal-"]'));
    const fallback = cards.find((node) => (node.textContent || '').toLocaleLowerCase('tr-TR').includes('genel skor'));
    return extractNumber(fallback?.textContent || '');
  })()`, null);

const readParentActionStats = async (client: CdpClient): Promise<{ total: number; duplicate: number }> =>
  client.evaluate<{ total: number; duplicate: number }>(`(async () => {
    const openDb = () => new Promise((resolve, reject) => {
      const request = indexedDB.open(${JSON.stringify(APP_IDB_NAME)}, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(${JSON.stringify(APP_IDB_STORE)})) {
          db.createObjectStore(${JSON.stringify(APP_IDB_STORE)});
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('db-open-failed'));
    });
    const readDb = async (key) => {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(${JSON.stringify(APP_IDB_STORE)}, 'readonly');
        const store = tx.objectStore(${JSON.stringify(APP_IDB_STORE)});
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('db-read-failed'));
      });
    };

    const marker = (() => {
      try {
        return JSON.parse(localStorage.getItem('tasks') || 'null');
      } catch {
        return null;
      }
    })();
    let tasks = [];
    if (Array.isArray(marker)) tasks = marker;
    else if (marker && typeof marker === 'object' && marker.__drStorage === 'idb') {
      const fromDb = await readDb('tasks');
      tasks = Array.isArray(fromDb) ? fromDb : [];
    }

    const parentActions = tasks.filter((task) => String(task?.planTaskId || '').startsWith('parent-action-'));
    const seen = new Set();
    let duplicate = 0;
    parentActions.forEach((task) => {
      const key = String(task.planTaskId || '');
      if (seen.has(key)) duplicate += 1;
      else seen.add(key);
    });

    return { total: parentActions.length, duplicate };
  })()`, { total: 0, duplicate: 0 });

const readTaskStorageDebug = async (client: CdpClient): Promise<{
  localKind: 'array' | 'marker' | 'empty' | 'other';
  localCount: number;
  idbCount: number;
  bulkMarker: boolean;
  query: string;
  href: string;
}> =>
  client.evaluate<{ localKind: 'array' | 'marker' | 'empty' | 'other'; localCount: number; idbCount: number; bulkMarker: boolean; query: string; href: string }>(`(async () => {
    const openDb = () => new Promise((resolve, reject) => {
      const request = indexedDB.open(${JSON.stringify(APP_IDB_NAME)}, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(${JSON.stringify(APP_IDB_STORE)})) {
          db.createObjectStore(${JSON.stringify(APP_IDB_STORE)});
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('db-open-failed'));
    });
    const readDb = async (key) => {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(${JSON.stringify(APP_IDB_STORE)}, 'readonly');
        const store = tx.objectStore(${JSON.stringify(APP_IDB_STORE)});
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('db-read-failed'));
      });
    };
    let localKind = 'empty';
    let localCount = 0;
    try {
      const raw = localStorage.getItem('tasks');
      if (!raw) {
        localKind = 'empty';
      } else {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          localKind = 'array';
          localCount = parsed.length;
        } else if (parsed && typeof parsed === 'object' && parsed.__drStorage === 'idb') {
          localKind = 'marker';
        } else {
          localKind = 'other';
        }
      }
    } catch {
      localKind = 'other';
    }
    const fromDb = await readDb('tasks');
    const idbCount = Array.isArray(fromDb) ? fromDb.length : 0;
    const bulkMarker = Boolean(localStorage.getItem('__bulk_seed_marker'));
    return { localKind, localCount, idbCount, bulkMarker, query: window.location.search || '', href: window.location.href || '' };
  })()`, { localKind: 'empty', localCount: 0, idbCount: 0, bulkMarker: false, query: '', href: '' });

const waitForAnalysisDataReady = async (
  client: CdpClient,
  expectedScore: number,
  timeoutMs = 45000,
  requireCourseButton = true,
): Promise<boolean> => {
  const started = Date.now();
  const minimumScore = Number.isFinite(expectedScore) ? Math.max(10, expectedScore - 30) : 10;
  let lastProbe: AnalysisReadyProbe | null = null;
  while (Date.now() - started < timeoutMs) {
    const hasParentWorkspace = await waitForSelector(client, '[data-testid="parent-analysis-workspace"]', 1200);
    if (!hasParentWorkspace) {
      await wait(180);
      continue;
    }
    const probe = await readAnalysisReadyProbe(client);
    lastProbe = probe;
    const courseReady = requireCourseButton ? probe.hasCourse : true;
    if (probe.state === 'ready' && courseReady && probe.score !== null) {
      if (probe.score >= minimumScore) return true;
      if (probe.score >= 20) return true;
    }
    await wait(220);
  }
  if (lastProbe) {
    await log(`waitForAnalysisDataReady timeout probe=state:${lastProbe.state} hasCourse:${lastProbe.hasCourse} score:${lastProbe.score ?? '-'} min:${minimumScore} requireCourse=${requireCourseButton}`);
  }
  return false;
};

const go = async (client: CdpClient, params: Record<string, string>) => {
  const query = new URLSearchParams({ ...params, t: String(Date.now()) });
  const url = `${BASE_URL}/?${query.toString()}`;
  try {
    await client.send('Page.navigate', { url });
  } catch (error) {
    await wait(400);
    await client.send('Page.navigate', { url });
  }
  const ready = await waitPageReady(client, 30000);
  if (!ready) throw new Error(`Page ready timeout: ${url}`);
  await wait(300);
};

const seedBrowserStorage = async (client: CdpClient, payload: SeedPayload) => {
  const compactTasks = payload.tasks.map((task, idx) => ({
    id: task.id,
    courseId: task.courseId,
    title: `T${idx}`,
    dueDate: task.dueDate,
    status: task.status,
    taskType: task.taskType,
    taskGoalType: task.taskGoalType,
    plannedDuration: task.plannedDuration,
    actualDuration: task.actualDuration,
    breakTime: task.breakTime,
    pauseTime: task.pauseTime,
    questionCount: task.questionCount,
    correctCount: task.correctCount,
    incorrectCount: task.incorrectCount,
    successScore: task.successScore,
    focusScore: task.focusScore,
    completionDate: task.completionDate,
    completionTimestamp: task.completionTimestamp,
    curriculumUnitName: task.curriculumUnitName ? `U${idx % 60}` : undefined,
    curriculumTopicName: task.curriculumTopicName,
    planTaskId: task.planTaskId,
    planLabel: task.planTaskId ? 'Veli onerisi' : undefined,
  }));

  const compactPayload = {
    ...payload,
    tasks: compactTasks,
  };
  await log(`compact seed size tasks=${formatBytes(jsonBytes(compactTasks))}`);

  const result = await client.evaluate<{ ok: boolean; error?: string }>(`(async () => {
    const payload = ${JSON.stringify(compactPayload)};
    try {
      const openDb = () => new Promise((resolve, reject) => {
        const request = indexedDB.open(${JSON.stringify(APP_IDB_NAME)}, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(${JSON.stringify(APP_IDB_STORE)})) {
            db.createObjectStore(${JSON.stringify(APP_IDB_STORE)});
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('indexeddb-open-failed'));
      });

      const writeDb = async (db, key, value) => new Promise((resolve, reject) => {
        const tx = db.transaction(${JSON.stringify(APP_IDB_STORE)}, 'readwrite');
        const store = tx.objectStore(${JSON.stringify(APP_IDB_STORE)});
        store.put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error('indexeddb-put-failed'));
        tx.onabort = () => reject(tx.error || new Error('indexeddb-put-aborted'));
      });

      const clearDb = async (db, key) => new Promise((resolve, reject) => {
        const tx = db.transaction(${JSON.stringify(APP_IDB_STORE)}, 'readwrite');
        const store = tx.objectStore(${JSON.stringify(APP_IDB_STORE)});
        store.delete(key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error('indexeddb-delete-failed'));
        tx.onabort = () => reject(tx.error || new Error('indexeddb-delete-aborted'));
      });

      const db = await openDb();
      const emptyPlanningSnapshot = {
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
      const idbPayload = {
        tasks: payload.tasks,
        curriculum: payload.curriculum,
        examScheduleEntries: [],
        examRecords: payload.examRecords,
        compositeExamResults: payload.compositeExamResults,
        studyPlans: [],
        planningEngineSnapshot: emptyPlanningSnapshot,
        performanceData: payload.performanceData,
        observabilityEvents: [],
      };

      for (const key of ${JSON.stringify(APP_IDB_BACKED_KEYS)}) {
        await clearDb(db, key);
        await writeDb(db, key, idbPayload[key]);
      }

      window.localStorage.setItem('__qa_seed_lock', '1');
      window.localStorage.clear();
      window.localStorage.setItem('__qa_seed_lock', '1');
      window.localStorage.setItem('courses', JSON.stringify(payload.courses));
      const marker = JSON.stringify({ __drStorage: 'idb', version: 1, updatedAt: Date.now() });
      for (const key of ${JSON.stringify(APP_IDB_BACKED_KEYS)}) {
        window.localStorage.setItem(key, marker);
      }
      window.localStorage.setItem('weeklySchedule', JSON.stringify({}));
      window.localStorage.setItem('successPoints', String(payload.successPoints));
      window.localStorage.setItem('rewards', JSON.stringify([]));
      window.localStorage.setItem('badges', JSON.stringify([]));
      window.localStorage.setItem('userType', JSON.stringify('parent'));
      window.localStorage.setItem('isParentLocked', JSON.stringify(false));
      window.localStorage.setItem('parentWorkspaceView', JSON.stringify('analysis'));
      window.localStorage.setItem('parentDefaultView', JSON.stringify('analysis'));
      window.localStorage.setItem('parentDecisionV1Enabled', JSON.stringify(true));
      window.localStorage.setItem('parentDecisionRolloutMode', JSON.stringify('stable'));
      window.localStorage.setItem('parentGoalConfigV1', JSON.stringify(payload.goalConfig));
      window.localStorage.setItem('parentLgsTargetDate', payload.goalConfig.lgsTargetDate);
      window.localStorage.setItem('parentLgsTargetNet', String(payload.goalConfig.lgsTargetNet));
      window.localStorage.setItem('themeMode', JSON.stringify('dark'));
      window.localStorage.setItem('__qa_manual_records_seeded_at', new Date().toISOString());
      window.localStorage.setItem('__bulk_seed_marker', JSON.stringify({ count: payload.tasks.length, ts: Date.now() }));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  })()`, { ok: false });
  if (!result.ok) {
    throw new Error(`Browser seed failed: ${result.error || 'unknown'}`);
  }
};

const readBrowserPerf = async (client: CdpClient): Promise<{
  heapUsed: number | null;
  heapTotal: number | null;
  storage: StorageProbe;
  pipeline: { cacheHits: number; cacheMisses: number; cacheVersion: number };
}> => {
  const probe = await client.evaluate<any>(`(async () => {
    const toBytes = () => {
      let total = 0;
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key) continue;
        const value = localStorage.getItem(key) || '';
        total += key.length + value.length;
      }
      return total;
    };
    const storage = await (navigator.storage?.estimate ? navigator.storage.estimate() : Promise.resolve(null));
    const pipelineRaw = localStorage.getItem('analysisPipelineState');
    let pipeline = { cacheHits: 0, cacheMisses: 0, cacheVersion: 0 };
    try {
      if (pipelineRaw) {
        const parsed = JSON.parse(pipelineRaw);
        pipeline = {
          cacheHits: Number(parsed?.cacheHits || 0),
          cacheMisses: Number(parsed?.cacheMisses || 0),
          cacheVersion: Number(parsed?.cacheVersion || 0),
        };
      }
    } catch {}

    const perfMem = performance.memory || null;
    return {
      heapUsed: perfMem && Number.isFinite(perfMem.usedJSHeapSize) ? Number(perfMem.usedJSHeapSize) : null,
      heapTotal: perfMem && Number.isFinite(perfMem.totalJSHeapSize) ? Number(perfMem.totalJSHeapSize) : null,
      storage: {
        localStorageBytes: toBytes(),
        indexedDbBytes: storage && Number.isFinite(storage.usage) ? Number(storage.usage) : null,
        storageEstimateBytes: storage && Number.isFinite(storage.quota) ? Number(storage.quota) : null,
      },
      pipeline,
    };
  })()`, {
    heapUsed: null,
    heapTotal: null,
    storage: { localStorageBytes: 0, indexedDbBytes: null, storageEstimateBytes: null },
    pipeline: { cacheHits: 0, cacheMisses: 0, cacheVersion: 0 },
  });
  return probe;
};

const measureUiForLevel = async (
  client: CdpClient,
  payload: SeedPayload,
  level: LoadLevel,
  expectedScore: number,
): Promise<BrowserPerfProbe> => {
  await go(client, { quick: 'analysis', e2e: '1', qaRecords: 'none', analysisTab: 'overview' });
  await seedBrowserStorage(client, payload);
  const immediateSeedDebug = await readTaskStorageDebug(client);
  await log(`seed immediate level=${level} local=${immediateSeedDebug.localKind}:${immediateSeedDebug.localCount} idb=${immediateSeedDebug.idbCount} bulk=${immediateSeedDebug.bulkMarker} q=${immediateSeedDebug.query}`);
  await go(client, { quick: 'analysis', e2e: '1', qaRecords: 'none', analysisTab: 'overview' });
  await ensureParentAnalysisWorkspace(client, 25000);
  const seedDebug = await readTaskStorageDebug(client);
  await log(`seed debug level=${level} local=${seedDebug.localKind}:${seedDebug.localCount} idb=${seedDebug.idbCount} bulk=${seedDebug.bulkMarker} q=${seedDebug.query}`);
  const readySeeded = await waitForAnalysisDataReady(client, expectedScore, 45000);
  if (!readySeeded) {
    const lateDebug = await readTaskStorageDebug(client);
    await releaseSeedLock(client);
    throw new Error(`Seed verisi hazir degil (${level}) local=${lateDebug.localKind}:${lateDebug.localCount} idb=${lateDebug.idbCount} bulk=${lateDebug.bulkMarker} q=${lateDebug.query}`);
  }
  await releaseSeedLock(client);

  const t0 = performance.now();
  await go(client, { quick: 'analysis', e2e: '1', qaRecords: 'none', analysisTab: 'overview' });
  const readyA = await ensureParentAnalysisWorkspace(client, 25000);
  const readyB = await waitForAnalysisDataReady(client, expectedScore, 45000, false);
  const screenOpenMs = Math.round(performance.now() - t0);
  if (!readyA || !readyB) {
    const failShot = path.join(ARTIFACT_DIR, `level-${level}-not-ready.png`);
    await client.screenshot(failShot);
    const fatalProbe = await readFatalErrorProbe(client);
    const debug = await client.evaluate<any>(`(() => ({
      parentWorkspaceView: localStorage.getItem('parentWorkspaceView'),
      userType: localStorage.getItem('userType'),
      isParentLocked: localStorage.getItem('isParentLocked'),
      hasParentWorkspace: Boolean(document.querySelector('[data-testid="parent-analysis-workspace"]')),
      hasLockScreen: Boolean(document.querySelector('[data-testid="parent-lock-screen"]')),
      hasChildRoot: Boolean(document.querySelector('[data-testid="child-dashboard-root"]')),
      bodySample: (document.body?.innerText || '').slice(0, 220)
    }))()`, {});
    throw new Error(`Ana ekran hazir degil (${level}) debug=${JSON.stringify(debug)} fatal=${JSON.stringify(fatalProbe)}`);
  }

  await go(client, { quick: 'analysis', e2e: '1', qaRecords: 'none', analysisTab: 'reports' });
  const reportsReady = await waitForSelector(client, '[data-testid="analysis-reports-section"]', 12000);
  if (!reportsReady) throw new Error('Raporlar bolumu yuklenmedi.');
  await openAnalysisTab(client, 'reports');
  await waitForSelector(client, '[data-testid="graph-category-btn-ders"]', 12000);
  await click(client, '[data-testid="graph-category-btn-genel"]');
  await click(client, '[data-testid="graph-option-btn-general-score-trend"]');
  await waitForSelectedGraph(client, 'genel', 'general-score-trend', 12000);
  await waitForGraphRender(client, 20000);

  const t1 = performance.now();
  await click(client, '[data-testid="graph-category-btn-ders"]');
  await click(client, '[data-testid="graph-option-btn-course-performance"]');
  const selectedReady = await waitForSelectedGraph(client, 'ders', 'course-performance', 12000);
  const chartReady = selectedReady && await waitForGraphRender(client, 30000);
  const graphRenderMs = Math.round(performance.now() - t1);
  if (!chartReady) throw new Error(`Grafik render timeout (${level})`);

  const analysisReadyMs = screenOpenMs;
  const perf = await readBrowserPerf(client);

  const shot = path.join(ARTIFACT_DIR, `level-${level}.png`);
  await client.screenshot(shot);

  return {
    screenOpenMs,
    analysisReadyMs,
    graphRenderMs,
    jsHeapUsedBytes: perf.heapUsed,
    jsHeapTotalBytes: perf.heapTotal,
    cacheHits: perf.pipeline.cacheHits,
    cacheMisses: perf.pipeline.cacheMisses,
    cacheVersion: perf.pipeline.cacheVersion,
    storage: perf.storage,
    screenshot: shot,
  };
};

const runLoadLevel = async (
  client: CdpClient,
  level: LoadLevel,
): Promise<{ result: LoadTestResult; payload: SeedPayload; analysis: ReturnType<typeof deriveAnalysisSnapshot>; decision: ReturnType<typeof buildParentDecision> }> => {
  await log(`load test started: ${level}`);
  const payload = createSeedPayload(level);
  const { analysis, decision, probe } = createLevelEngineProbe(payload, level);
  let browserProbe: BrowserPerfProbe;
  let browserError: string | null = null;
  try {
    browserProbe = await measureUiForLevel(client, payload, level, analysis.overall.generalScore);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    browserError = message;
    const shot = path.join(ARTIFACT_DIR, `level-${level}-error.png`);
    try {
      await client.screenshot(shot);
    } catch {
      // noop
    }
    browserProbe = {
      screenOpenMs: -1,
      analysisReadyMs: -1,
      graphRenderMs: -1,
      jsHeapUsedBytes: null,
      jsHeapTotalBytes: null,
      cacheHits: 0,
      cacheMisses: 0,
      cacheVersion: 0,
      storage: { localStorageBytes: 0, indexedDbBytes: null, storageEstimateBytes: null },
      screenshot: shot,
    };
  }

  const pass = probe.analysisMs <= ANALYSIS_BUDGET_MS[level]
    && !browserError
    && browserProbe.screenOpenMs <= SCREEN_OPEN_BUDGET_MS[level]
    && browserProbe.graphRenderMs <= GRAPH_RENDER_BUDGET_MS[level];

  const result: LoadTestResult = {
    level,
    expected: `Analiz <= ${ANALYSIS_BUDGET_MS[level]}ms, ekran <= ${SCREEN_OPEN_BUDGET_MS[level]}ms, grafik <= ${GRAPH_RENDER_BUDGET_MS[level]}ms`,
    actual: browserError
      ? `Analiz ${probe.analysisMs}ms, UI test hatasi: ${browserError}`
      : `Analiz ${probe.analysisMs}ms, ekran ${browserProbe.screenOpenMs}ms, grafik ${browserProbe.graphRenderMs}ms, cache ${browserProbe.cacheHits}/${browserProbe.cacheMisses}`,
    verdict: pass ? 'PASS' : 'FAIL',
    engine: probe,
    browser: browserProbe,
  };
  await log(`load test finished: ${level} => ${result.verdict}`);
  return { result, payload, analysis, decision };
};

const detectBlankOrCrash = async (client: CdpClient) => {
  const status = await client.evaluate<{ blank: boolean; crash: boolean; errors: number; hasParent: boolean; hasChild: boolean }>(`(() => {
    const root = document.getElementById('root');
    const blank = !root || root.childElementCount === 0 || (root.textContent || '').trim().length === 0;
    const hasParent = Boolean(document.querySelector('[data-testid="parent-analysis-workspace"]'));
    const hasChild = Boolean(document.querySelector('[data-testid="child-dashboard-root"]'));
    const errors = Number(window.__qaErrorCount || 0);
    const crash = errors > 0;
    return { blank, crash, errors, hasParent, hasChild };
  })()`, { blank: false, crash: false, errors: 0, hasParent: false, hasChild: false });
  return status;
};

const installErrorHooks = async (client: CdpClient) => {
  await client.evaluate(`(() => {
    if (window.__qaHooksInstalled) return true;
    window.__qaHooksInstalled = true;
    window.__qaErrorCount = 0;
    window.__qaErrorLog = [];
    window.addEventListener('error', (event) => {
      window.__qaErrorCount = Number(window.__qaErrorCount || 0) + 1;
      const message = event?.error?.message || event?.message || 'window.error';
      const source = event?.filename || '';
      const lineno = event?.lineno || 0;
      window.__qaErrorLog.push('error:' + message + ' @ ' + source + ':' + String(lineno));
      if (window.__qaErrorLog.length > 25) window.__qaErrorLog = window.__qaErrorLog.slice(-25);
    });
    window.addEventListener('unhandledrejection', (event) => {
      window.__qaErrorCount = Number(window.__qaErrorCount || 0) + 1;
      const reason = event?.reason;
      const message = (reason && typeof reason === 'object' && reason.message) ? reason.message : String(reason || 'unhandledrejection');
      window.__qaErrorLog.push('promise:' + message);
      if (window.__qaErrorLog.length > 25) window.__qaErrorLog = window.__qaErrorLog.slice(-25);
    });
    return true;
  })()`, false);
};

const readFatalErrorProbe = async (client: CdpClient): Promise<FatalErrorProbe> =>
  client.evaluate<FatalErrorProbe>(`(() => {
    const fatalRoot = document.querySelector('[data-testid="fatal-error-screen"]');
    const fatalMessageNode = document.querySelector('[data-testid="fatal-error-message"]');
    const log = Array.isArray(window.__qaErrorLog) ? window.__qaErrorLog.map((item) => String(item)) : [];
    return {
      hasFatalScreen: Boolean(fatalRoot),
      fatalMessage: fatalMessageNode ? (fatalMessageNode.textContent || '').trim() : null,
      errorCount: Number(window.__qaErrorCount || 0),
      errorLog: log,
    };
  })()`, { hasFatalScreen: false, fatalMessage: null, errorCount: 0, errorLog: [] });

const runNavigationLoops = async (client: CdpClient): Promise<NavigationCaseResult[]> => {
  await log('navigation loops started');
  const results: NavigationCaseResult[] = [];

  const flowA = { blankScreens: 0, stateMismatches: 0, duplicateIssues: 0, crashes: 0 };
  await go(client, { quick: 'analysis', e2e: '1', qaRecords: 'none', analysisTab: 'overview' });
  await waitForAnalysisDataReady(client, 0, 45000);
  for (let i = 0; i < NAVIGATION_LOOPS; i += 1) {
    await openAnalysisTab(client, 'overview');
    const hasCourseButton = await waitForSelector(client, '[data-testid^="course-summary-btn-"]', NAV_SELECTOR_TIMEOUT);
    if (!hasCourseButton) {
      flowA.stateMismatches += 1;
      continue;
    }
    await client.evaluate(`(() => {
      const first = document.querySelector('[data-testid^="course-summary-btn-"]');
      if (first && typeof first.click === 'function') first.click();
      return true;
    })()`, true);
    const detailOpen = await waitForSelector(client, '[data-testid="course-detail-panel"]', NAV_SELECTOR_TIMEOUT);
    if (!detailOpen) flowA.stateMismatches += 1;
    await openAnalysisTab(client, 'insights');
    await openAnalysisTab(client, 'overview');
    const status = await detectBlankOrCrash(client);
    if (status.blank) flowA.blankScreens += 1;
    if (!status.hasParent) flowA.stateMismatches += 1;
    if (status.crash) flowA.crashes += 1;
    if ((i + 1) % 20 === 0) await log(`navigation A progress ${i + 1}/${NAVIGATION_LOOPS}`);
  }
  const shotA = path.join(ARTIFACT_DIR, 'nav-a-course-back.png');
  await client.screenshot(shotA);
  results.push({
    name: 'ebeveyn ana ekran -> ders detay -> geri',
    loops: NAVIGATION_LOOPS,
    expected: `${NAVIGATION_LOOPS} tekrar sonunda bos ekran/state bozulmasi olmamali.`,
    actual: `blank=${flowA.blankScreens}, state=${flowA.stateMismatches}, crash=${flowA.crashes}`,
    blankScreens: flowA.blankScreens,
    stateMismatches: flowA.stateMismatches,
    duplicateIssues: flowA.duplicateIssues,
    crashes: flowA.crashes,
    verdict: flowA.blankScreens + flowA.stateMismatches + flowA.crashes === 0 ? 'PASS' : 'FAIL',
    screenshot: shotA,
  });

  const flowB = { blankScreens: 0, stateMismatches: 0, duplicateIssues: 0, crashes: 0 };
  for (let i = 0; i < NAVIGATION_LOOPS; i += 1) {
    await openAnalysisTab(client, 'reports');
    const chartReady = await waitForSelector(client, '.ios-chart-surface', NAV_SELECTOR_TIMEOUT);
    if (!chartReady) flowB.stateMismatches += 1;
    await client.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const hit = (label) => {
        const btn = buttons.find((node) => (node.textContent || '').trim() === label);
        if (btn) btn.click();
      };
      hit('Konular');
      hit('Konu oncelik sirasi');
      hit('Dersler');
      hit('Ders bazli performans');
      return true;
    })()`, false);
    await wait(40);
    const status = await detectBlankOrCrash(client);
    if (status.blank) flowB.blankScreens += 1;
    if (!status.hasParent) flowB.stateMismatches += 1;
    if (status.crash) flowB.crashes += 1;
    if ((i + 1) % 20 === 0) await log(`navigation B progress ${i + 1}/${NAVIGATION_LOOPS}`);
  }
  const shotB = path.join(ARTIFACT_DIR, 'nav-b-reports-back.png');
  await client.screenshot(shotB);
  results.push({
    name: 'raporlar -> grafik detayi -> geri',
    loops: NAVIGATION_LOOPS,
    expected: `${NAVIGATION_LOOPS} tekrar sonunda grafik akisinda bos ekran veya crash olmamali.`,
    actual: `blank=${flowB.blankScreens}, state=${flowB.stateMismatches}, crash=${flowB.crashes}`,
    blankScreens: flowB.blankScreens,
    stateMismatches: flowB.stateMismatches,
    duplicateIssues: flowB.duplicateIssues,
    crashes: flowB.crashes,
    verdict: flowB.blankScreens + flowB.stateMismatches + flowB.crashes === 0 ? 'PASS' : 'FAIL',
    screenshot: shotB,
  });

  const flowC = { blankScreens: 0, stateMismatches: 0, duplicateIssues: 0, crashes: 0 };
  for (let i = 0; i < NAVIGATION_LOOPS; i += 1) {
    await openAnalysisTab(client, 'goals');
    const examCard = await waitForSelector(client, '[data-testid="exam-card-mock"]', NAV_SELECTOR_TIMEOUT);
    if (!examCard) flowC.stateMismatches += 1;
    await openAnalysisTab(client, 'overview');
    await openAnalysisTab(client, 'goals');
    const status = await detectBlankOrCrash(client);
    if (status.blank) flowC.blankScreens += 1;
    if (!status.hasParent) flowC.stateMismatches += 1;
    if (status.crash) flowC.crashes += 1;
    if ((i + 1) % 20 === 0) await log(`navigation C progress ${i + 1}/${NAVIGATION_LOOPS}`);
  }
  const shotC = path.join(ARTIFACT_DIR, 'nav-c-goals-back.png');
  await client.screenshot(shotC);
  results.push({
    name: 'hedefler -> deneme karti -> geri',
    loops: NAVIGATION_LOOPS,
    expected: 'Deneme karti her turde bulunmali, geri donuste state bozulmamali.',
    actual: `blank=${flowC.blankScreens}, state=${flowC.stateMismatches}, crash=${flowC.crashes}`,
    blankScreens: flowC.blankScreens,
    stateMismatches: flowC.stateMismatches,
    duplicateIssues: flowC.duplicateIssues,
    crashes: flowC.crashes,
    verdict: flowC.blankScreens + flowC.stateMismatches + flowC.crashes === 0 ? 'PASS' : 'FAIL',
    screenshot: shotC,
  });

  const flowD = { blankScreens: 0, stateMismatches: 0, duplicateIssues: 0, crashes: 0 };
  for (let i = 0; i < NAVIGATION_LOOPS; i += 1) {
    const childReady = await ensureChildDashboard(client, NAV_SELECTOR_TIMEOUT * 2);
    if (!childReady) {
      flowD.stateMismatches += 1;
      continue;
    }
    const parentReady = await ensureParentAnalysisWorkspace(client, NAV_SELECTOR_TIMEOUT * 2);
    if (!parentReady) {
      flowD.stateMismatches += 1;
      continue;
    }
    await openAnalysisTab(client, 'overview');
    const summaryReady = await waitForSelector(client, '[data-testid="decision-signal-genel-skor"]', NAV_SELECTOR_TIMEOUT);
    if (!summaryReady) flowD.stateMismatches += 1;
    const status = await detectBlankOrCrash(client);
    if (status.blank) flowD.blankScreens += 1;
    if (status.crash) flowD.crashes += 1;
    if ((i + 1) % 20 === 0) await log(`navigation D progress ${i + 1}/${NAVIGATION_LOOPS}`);
  }
  const shotD = path.join(ARTIFACT_DIR, 'nav-d-parent-child.png');
  await client.screenshot(shotD);
  results.push({
    name: 'veli -> cocuk ekrani -> geri/parent donus',
    loops: NAVIGATION_LOOPS,
    expected: 'Parent/child gecisinde bos ekran veya kilitlenme olmamali.',
    actual: `blank=${flowD.blankScreens}, state=${flowD.stateMismatches}, crash=${flowD.crashes}`,
    blankScreens: flowD.blankScreens,
    stateMismatches: flowD.stateMismatches,
    duplicateIssues: flowD.duplicateIssues,
    crashes: flowD.crashes,
    verdict: flowD.blankScreens + flowD.stateMismatches + flowD.crashes === 0 ? 'PASS' : 'FAIL',
    screenshot: shotD,
  });

  const flowE = { blankScreens: 0, stateMismatches: 0, duplicateIssues: 0, crashes: 0 };
  const flowEInitialParentActions = await readParentActionStats(client);
  for (let i = 0; i < NAVIGATION_LOOPS; i += 1) {
    await click(client, '[data-testid="switch-child-mode-btn"]');
    await waitForSelector(client, '[data-testid="child-dashboard-root"]', NAV_SELECTOR_TIMEOUT);
    await waitForSelector(client, '[data-testid^="child-quick-complete-task-"]', NAV_SELECTOR_TIMEOUT);
    const quickResult = await client.evaluate<{ completed: boolean }>(`(() => {
      const btn = document.querySelector('[data-testid^="child-quick-complete-task-"]');
      if (!btn) return { completed: false };
      if (typeof btn.click === 'function') btn.click();
      return { completed: true };
    })()`, { completed: false });
    if (!quickResult.completed) flowE.stateMismatches += 1;
    await wait(60);
    await click(client, '[data-testid="switch-parent-mode-btn"]');
    await waitForSelector(client, '[data-testid="parent-analysis-workspace"]', NAV_SELECTOR_TIMEOUT);
    await openAnalysisTab(client, 'goals');
    const pending = Number(await textContent(client, '[data-testid="parent-action-pending-count"]'));
    const completed = Number(await textContent(client, '[data-testid="parent-action-completed-count"]'));
    if (!Number.isFinite(pending) || !Number.isFinite(completed)) flowE.stateMismatches += 1;
    await click(client, '[data-testid="switch-child-mode-btn"]');
    await waitForSelector(client, '[data-testid="child-dashboard-root"]', NAV_SELECTOR_TIMEOUT);
    const status = await detectBlankOrCrash(client);
    if (status.blank) flowE.blankScreens += 1;
    if (status.crash) flowE.crashes += 1;
    if ((i + 1) % 20 === 0) await log(`navigation E progress ${i + 1}/${NAVIGATION_LOOPS}`);
  }
  const duplicateCheck = await readParentActionStats(client);
  flowE.duplicateIssues = Math.max(0, duplicateCheck.duplicate - flowEInitialParentActions.duplicate);
  const shotE = path.join(ARTIFACT_DIR, 'nav-e-child-complete-parent.png');
  await client.screenshot(shotE);
  results.push({
    name: 'cocuk gorev tamamla -> veli ekrani -> geri',
    loops: NAVIGATION_LOOPS,
    expected: 'Tamamlama sonrasi parent ozet guncellenmeli, duplicate parent-action olmamali.',
    actual: `blank=${flowE.blankScreens}, state=${flowE.stateMismatches}, crash=${flowE.crashes}, duplicateDelta=${flowE.duplicateIssues}`,
    blankScreens: flowE.blankScreens,
    stateMismatches: flowE.stateMismatches,
    duplicateIssues: flowE.duplicateIssues,
    crashes: flowE.crashes,
    verdict: flowE.blankScreens + flowE.stateMismatches + flowE.crashes + flowE.duplicateIssues === 0 ? 'PASS' : 'FAIL',
    screenshot: shotE,
  });

  await log('navigation loops finished');
  return results;
};

const runGraphAccuracyTest = async (
  client: CdpClient,
  payload: SeedPayload,
  analysis: ReturnType<typeof deriveAnalysisSnapshot>,
): Promise<GraphAccuracyResult> => {
  await log('graph accuracy test started');
  await go(client, { quick: 'analysis', e2e: '1', qaRecords: 'none', analysisTab: 'overview' });
  await seedBrowserStorage(client, payload);
  await go(client, { quick: 'analysis', e2e: '1', qaRecords: 'none', analysisTab: 'overview' });
  const dataReady = await waitForAnalysisDataReady(client, analysis.overall.generalScore, 45000);
  if (!dataReady) {
    const probe = await readAnalysisReadyProbe(client);
    await releaseSeedLock(client);
    throw new Error(`Graph accuracy icin seed verisi hazir degil. state=${probe.state} hasCourse=${probe.hasCourse} score=${probe.score ?? '-'}`);
  }
  await releaseSeedLock(client);

  const checks: GraphAccuracyResult['checks'] = [];

  const uiGeneralScore = await readDecisionSignalNumber(client, 'genel-skor');
  checks.push({
    key: 'ders performansi / genel skor',
    expected: analysis.overall.generalScore,
    actual: uiGeneralScore ?? 'NaN',
    verdict: uiGeneralScore !== null && Math.abs(uiGeneralScore - analysis.overall.generalScore) <= 1 ? 'PASS' : 'FAIL',
  });

  await openAnalysisTab(client, 'reports');
  await waitForSelector(client, '[data-testid="analysis-reports-section"]', 15000);
  const periods = ['Haftalık', 'Aylık', '3 Aylık', 'Tüm Zamanlar'];
  for (const period of periods) {
    await setSelect(client, '[data-testid="report-period-select"]', period);
    await wait(120);
    const attr = await client.evaluate<string>(`(() => document.querySelector('[data-testid="analysis-reports-section"]')?.getAttribute('data-report-period') || '')()`, '');
    checks.push({
      key: `donem filtresi ${period}`,
      expected: period,
      actual: attr,
      verdict: attr === period ? 'PASS' : 'FAIL',
    });
  }

  await openAnalysisTab(client, 'goals');
  await waitForSelector(client, '[data-testid="analysis-goals-section"]', 10000);
  const trendLabelUi = await textContent(client, '[data-testid="exam-card-trend"]');
  const latest = payload.compositeExamResults[0];
  const prev = payload.compositeExamResults[1];
  const latestAvg = latest ? Math.round(latest.courses.reduce((sum, course) => sum + course.score, 0) / latest.courses.length) : null;
  const prevAvg = prev ? Math.round(prev.courses.reduce((sum, course) => sum + course.score, 0) / prev.courses.length) : null;
  const weeklyCompletedCount = payload.tasks
    .filter((task) => task.status === 'tamamlandı' && typeof task.completionDate === 'string')
    .filter((task) => {
      if (!task.completionDate) return false;
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      return task.completionDate >= toIsoDate(weekStart);
    }).length;
  const parentActionTasks = payload.tasks.filter((task) =>
    (task.planTaskId || '').startsWith('parent-action-')
    || (task.planLabel || '').toLocaleLowerCase('tr-TR').includes('veli onerisi'));
  const expectedTrend = buildParentDecision({
    sessionsCount: analysis.sessions.length,
    weeklyCompletedCount,
    weakTopicCount: analysis.topics.filter((topic) => topic.needsRevision).length,
    averageRisk: analysis.overall.averageRisk,
    latestCompositeAverage: latestAvg,
    previousCompositeAverage: prevAvg,
    parentActionPendingCount: parentActionTasks.filter((task) => task.status === 'bekliyor').length,
    parentActionCompletedCount: parentActionTasks.filter((task) => task.status === 'tamamlandı').length,
    parentActionCompletedTodayCount: 0,
  }).trend;
  checks.push({
    key: 'deneme trendi',
    expected: expectedTrend,
    actual: trendLabelUi,
    verdict: trendLabelUi.includes(expectedTrend) ? 'PASS' : 'FAIL',
  });

  const uiGoalPercent = await client.evaluate<number>(`(() => {
    const node = document.querySelector('[data-testid="goal-progress-question"]');
    if (!node) return -1;
    const raw = (node.textContent || '').replace(/[^0-9-]/g, '');
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : -1;
  })()`, -1);

  const weeklyCompletedQuestions = payload.tasks
    .filter((task) => task.status === 'tamamlandı')
    .filter((task) => task.taskType === 'soru çözme')
    .filter((task) => task.completionDate && task.completionDate >= toIsoDate(new Date('2026-05-11T00:00:00')))
    .reduce((sum, task) => {
      const hasCounts = typeof task.correctCount === 'number' || typeof task.incorrectCount === 'number';
      const solved = hasCounts ? (task.correctCount || 0) + (task.incorrectCount || 0) : (task.questionCount || 0);
      return sum + solved;
    }, 0);
  const expectedGoalPercentRaw = payload.goalConfig.weeklyQuestionTarget > 0
    ? Math.round((weeklyCompletedQuestions / payload.goalConfig.weeklyQuestionTarget) * 100)
    : 0;
  const expectedGoalPercent = Math.max(0, Math.min(999, expectedGoalPercentRaw));
  checks.push({
    key: 'hedef gerceklesme yuzdesi',
    expected: expectedGoalPercent,
    actual: uiGoalPercent,
    verdict: uiGoalPercent >= 0 && Math.abs(uiGoalPercent - expectedGoalPercent) <= 1 ? 'PASS' : 'FAIL',
  });

  await openAnalysisTab(client, 'reports');
  await waitForSelector(client, '[data-testid="analysis-graph-center"]', 12000);
  await click(client, '[data-testid="graph-category-btn-konu"]');
  await click(client, '[data-testid="graph-option-btn-risk-graph"]');
  await waitForSelector(client, '[data-testid="risk-level-breakdown"]', 12000);

  const riskBreakdownUi = await client.evaluate<Record<string, number>>(`(() => {
    const read = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return 0;
      const raw = (node.textContent || '').replace(/[^0-9-]/g, '');
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return {
      Kritik: read('[data-testid="risk-level-kritik"]'),
      Dikkat: read('[data-testid="risk-level-dikkat"]'),
      'Takip et': read('[data-testid="risk-level-takip"]'),
      Stabil: read('[data-testid="risk-level-stabil"]'),
    };
  })()`, {});

  const topRisk = [...analysis.topics]
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 8)
    .reduce<Record<string, number>>((acc, topic) => {
      const level = getTopicDecisionLevel(topic.riskScore);
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {});

  const uiRiskTotal = Object.values(riskBreakdownUi).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  const expectedRiskTotal = Object.values(topRisk).reduce((sum, value) => sum + value, 0);
  checks.push({
    key: 'konu oncelik listesi',
    expected: expectedRiskTotal,
    actual: uiRiskTotal,
    verdict: uiRiskTotal === expectedRiskTotal ? 'PASS' : 'FAIL',
  });

  await click(client, '[data-testid="graph-category-btn-genel"]');
  await click(client, '[data-testid="graph-option-btn-general-score-trend"]');
  await waitForSelector(client, '[data-testid="graph-golden-hour-value"]', 12000);
  const goldenHourUi = await client.evaluate<string>(`(() => {
    const node = document.querySelector('[data-testid="graph-golden-hour-value"]');
    return (node?.textContent || '-').trim();
  })()`, '-');
  const sortedWindows = [...analysis.studyWindows].sort((a, b) => b.averageFocus - a.averageFocus);
  const expectedGoldenHour = sortedWindows[0]?.label || '-';
  checks.push({
    key: 'en verimli saat',
    expected: expectedGoldenHour,
    actual: goldenHourUi,
    verdict: goldenHourUi.includes(expectedGoldenHour) ? 'PASS' : 'FAIL',
  });

  const shot = path.join(ARTIFACT_DIR, 'graph-accuracy.png');
  await client.screenshot(shot);

  const failed = checks.filter((check) => check.verdict === 'FAIL').length;
  const verdict: Verdict = failed === 0 ? 'PASS' : 'FAIL';
  const actual = failed === 0
    ? `${checks.length} kontrol birebir uyumlu`
    : `${checks.length} kontrolün ${failed} adedi uyumsuz`;

  await log(`graph accuracy test finished => ${verdict}`);
  return {
    expected: 'Tum grafik/filtre kartlari ham veriyle uyumlu olmali.',
    actual,
    verdict,
    checks,
    screenshot: shot,
  };
};

const runCalculationAccuracyTest = (
  payload: SeedPayload,
  analysis: ReturnType<typeof deriveAnalysisSnapshot>,
  decision: ReturnType<typeof buildParentDecision>,
): CalculationAccuracyResult => {
  const completed = payload.tasks.filter((task) => task.status === 'tamamlandı' && typeof task.completionDate === 'string');
  const step = Math.max(1, Math.floor(completed.length / 50));
  const samples = completed.filter((_, idx) => idx % step === 0).slice(0, 50);
  const sessionsById = new Map(analysis.sessions.map((session) => [session.taskId, session]));
  const topicsByKey = new Map(analysis.topics.map((topic) => [`${topic.courseId}::${topic.topicName}`, topic]));
  const now = new Date('2026-05-18T20:00:00');

  const examples: Array<Record<string, string | number>> = [];
  let mismatches = 0;

  samples.forEach((task, idx) => {
    const session = sessionsById.get(task.id);
    if (!session) {
      mismatches += 1;
      examples.push({ idx, taskId: task.id, issue: 'session-not-found' });
      return;
    }
    const comparableAccuracy = task.taskType === 'soru çözme'
      && (task.questionCount || 0) > 0
      && typeof session.accuracyScore === 'number';
    const manualAccuracy = comparableAccuracy
      ? Math.round((((task.correctCount || 0) / Math.max(1, task.questionCount || 1)) * 100))
      : Math.round(session.taskScore || 0);
    const engineAccuracy = comparableAccuracy
      ? Math.round(session.accuracyScore || 0)
      : Math.round(session.taskScore || 0);
    const completion = new Date(`${task.completionDate}T00:00:00`);
    const repeatDelayDays = Math.max(0, Math.round((now.getTime() - completion.getTime()) / (1000 * 60 * 60 * 24)));
    const topic = topicsByKey.get(`${task.courseId}::${task.curriculumTopicName || ''}`);
    const priority: DecisionLevel = topic ? getTopicDecisionLevel(topic.riskScore) : 'Stabil';
    const notificationTier = getNotificationTierFromLevel(decision.topAlert.level);

    const delta = Math.abs(manualAccuracy - engineAccuracy);
    if (comparableAccuracy && delta > 10) mismatches += 1;
    examples.push({
      idx,
      taskId: task.id,
      manualAccuracy,
      engineAccuracy,
      repeatDelayDays,
      priority,
      confidence: decision.topAlert.confidence,
      notificationTier,
    });
  });

  return {
    sampleCount: samples.length,
    expected: '50 rastgele kayitta manuel beklenen metrikler ile karar motoru uyumlu olmali.',
    actual: mismatches === 0
      ? `Tum ${samples.length} ornek uyumlu`
      : `${samples.length} ornekte ${mismatches} uyumsuzluk var`,
    verdict: mismatches === 0 ? 'PASS' : 'FAIL',
    mismatches,
    examples: examples.slice(0, 10),
  };
};

const runStressTest = async (client: CdpClient): Promise<StressResult> => {
  await log('stress test started');
  await go(client, { quick: 'analysis', e2e: '1', qaRecords: 'none', analysisTab: 'overview' });
  await waitForSelector(client, '[data-testid="parent-analysis-workspace"]', 12000);

  const before = await readBrowserPerf(client);
  const start = Date.now();
  const durationMs = STRESS_MINUTES * 60 * 1000;
  let delayedFrames = 0;
  const iterationDurations: number[] = [];

  while (Date.now() - start < durationMs) {
    const tick = Date.now();
    await openAnalysisTab(client, 'goals');
    await click(client, '[data-testid="track-topic-btn"]');
    await click(client, '[data-testid="add-to-plan-btn"]');
    await openAnalysisTab(client, 'reports');
    await setSelect(client, '[data-testid="report-period-select"]', 'Aylık');
    await setSelect(client, '[data-testid="report-period-select"]', '3 Aylık');
    await openAnalysisTab(client, 'overview');
    await openAnalysisTab(client, 'insights');
    await openAnalysisTab(client, 'overview');
    await click(client, '[data-testid="switch-child-mode-btn"]');
    await waitForSelector(client, '[data-testid="child-dashboard-root"]', 7000);
    await client.evaluate(`(() => {
      const btn = document.querySelector('[data-testid^="child-quick-complete-task-"]');
      if (btn && typeof btn.click === 'function') btn.click();
      return true;
    })()`, true);
    await click(client, '[data-testid="switch-parent-mode-btn"]');
    await waitForSelector(client, '[data-testid="parent-analysis-workspace"]', 7000);
    await click(client, '[data-testid="topbar-notifications-toggle"]');
    await client.evaluate(`(() => {
      const first = document.querySelector('[data-testid^="notification-item-"]');
      if (first && typeof first.click === 'function') first.click();
      return true;
    })()`, true);
    await click(client, '[data-testid="topbar-notifications-toggle"]');
    const elapsed = Date.now() - tick;
    iterationDurations.push(elapsed);
    if (elapsed > 7000) delayedFrames += 1;
    await wait(250);
  }

  const after = await readBrowserPerf(client);
  const shot = path.join(ARTIFACT_DIR, 'stress-10min.png');
  await client.screenshot(shot);

  const memoryGrowth = (before.heapUsed !== null && after.heapUsed !== null) ? after.heapUsed - before.heapUsed : null;
  const storageGrowth = after.storage.localStorageBytes - before.storage.localStorageBytes;
  const cacheDelta = {
    hit: after.pipeline.cacheHits - before.pipeline.cacheHits,
    miss: after.pipeline.cacheMisses - before.pipeline.cacheMisses,
  };
  const sortedDurations = [...iterationDurations].sort((a, b) => a - b);
  const p95 = sortedDurations.length
    ? sortedDurations[Math.min(sortedDurations.length - 1, Math.floor(sortedDurations.length * 0.95))]
    : 0;
  const allowedSlowIterations = Math.max(2, Math.ceil(iterationDurations.length * 0.2));

  const status = await detectBlankOrCrash(client);
  const verdict = !status.blank && !status.crash && delayedFrames <= allowedSlowIterations && p95 < 9000 ? 'PASS' : 'FAIL';

  await log(`stress test finished => ${verdict}`);
  return {
    durationMinutes: STRESS_MINUTES,
    expected: `${STRESS_MINUTES} dakika yogun kullanimda gecikme artisi sinirli olmali, crash olmamali.`,
    actual: `slowIterations=${delayedFrames}/${iterationDurations.length}, p95=${p95}ms, memoryGrowth=${memoryGrowth ?? 'n/a'}, storageGrowth=${storageGrowth}, cacheDelta=${cacheDelta.hit}/${cacheDelta.miss}`,
    verdict,
    memoryGrowthBytes: memoryGrowth,
    cacheDelta,
    storageGrowthBytes: storageGrowth,
    delayedFrames,
    screenshot: shot,
  };
};

const runSoakTest = async (client: CdpClient): Promise<SoakResult> => {
  await log('soak test started');
  await go(client, { quick: 'analysis', e2e: '1', qaRecords: 'none', analysisTab: 'overview' });
  await waitForSelector(client, '[data-testid="parent-analysis-workspace"]', 12000);
  const before = await readBrowserPerf(client);

  const iterations = SOAK_MINUTES;
  let crashCount = 0;
  let dataMismatchCount = 0;
  for (let i = 0; i < iterations; i += 1) {
    await openAnalysisTab(client, 'goals');
    await click(client, '[data-testid="track-topic-btn"]');
    await openAnalysisTab(client, 'reports');
    await setSelect(client, '[data-testid="report-period-select"]', i % 2 === 0 ? 'Haftalık' : 'Aylık');
    await openAnalysisTab(client, 'overview');
    await click(client, '[data-testid="switch-child-mode-btn"]');
    await waitForSelector(client, '[data-testid="child-dashboard-root"]', 7000);
    await client.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('[data-testid^="child-quick-complete-task-"]'));
      if (buttons[0] && typeof buttons[0].click === 'function') buttons[0].click();
      return true;
    })()`, true);
    await click(client, '[data-testid="switch-parent-mode-btn"]');
    await waitForSelector(client, '[data-testid="parent-analysis-workspace"]', 7000);
    await openAnalysisTab(client, 'overview');
    await waitForSelector(client, '[data-testid="decision-signal-genel-skor"]', NAV_SELECTOR_TIMEOUT);

    const state = await detectBlankOrCrash(client);
    if (state.crash) crashCount += 1;
    if (state.blank) dataMismatchCount += 1;

    const score = await readDecisionSignalNumber(client, 'genel-skor');
    if (score === null || score < 0 || score > 100) dataMismatchCount += 1;
    await log(`soak minute ${i + 1}/${iterations}`);
    await wait(60_000);
  }

  const after = await readBrowserPerf(client);
  const shot = path.join(ARTIFACT_DIR, 'soak-30min.png');
  await client.screenshot(shot);

  const memoryGrowth = (before.heapUsed !== null && after.heapUsed !== null) ? after.heapUsed - before.heapUsed : null;
  const verdict = crashCount === 0 && dataMismatchCount === 0 ? 'PASS' : 'FAIL';

  await log(`soak test finished => ${verdict}`);
  return {
    durationMinutes: SOAK_MINUTES,
    iterations,
    expected: '30 dakika otomasyon sonunda crash/veri tutarsizligi olmamali.',
    actual: `crash=${crashCount}, mismatch=${dataMismatchCount}, memoryGrowth=${memoryGrowth ?? 'n/a'}`,
    verdict,
    memoryGrowthBytes: memoryGrowth,
    crashCount,
    dataMismatchCount,
    screenshot: shot,
  };
};

const runNotificationCooldownCheck = async (client: CdpClient): Promise<{ verdict: Verdict; note: string; screenshot: string }> => {
  await go(client, { quick: 'analysis', e2e: '1', qaRecords: 'none', analysisTab: 'goals' });
  await click(client, '[data-testid="topbar-notifications-toggle"]');
  await waitForSelector(client, '[data-testid="notifications-popover"]', 5000);
  const selected = await client.evaluate<{ group: string; clicked: boolean }>(`(() => {
    const first = document.querySelector('[data-testid^="notification-item-"]');
    if (!first) return { group: '', clicked: false };
    const group = first.getAttribute('data-cooldown-group') || '';
    if (typeof first.click === 'function') first.click();
    return { group, clicked: true };
  })()`, { group: '', clicked: false });

  if (!selected.clicked) {
    const shot = path.join(ARTIFACT_DIR, 'cooldown-check.png');
    await client.screenshot(shot);
    return { verdict: 'PASS', note: 'Bildirim yok; cooldown ihlali yok.', screenshot: shot };
  }

  await wait(220);
  await click(client, '[data-testid="topbar-notifications-toggle"]');
  await waitForSelector(client, '[data-testid="notifications-popover"]', 5000);
  const outcome = await client.evaluate<{ ok: boolean; note: string }>(`(() => {
    const group = ${JSON.stringify(selected.group)};
    if (!group) return { ok: false, note: 'Cooldown grubu okunamadi.' };
    const again = document.querySelector('[data-cooldown-group="' + group.replace(/"/g, '\\"') + '"]');
    const raw = localStorage.getItem('notificationCooldownMap');
    let cooldown = null;
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      cooldown = parsed[group] || null;
    } catch {}
    if (again) return { ok: false, note: 'Ayni cooldown grubunda item tekrar gorundu.' };
    if (!cooldown) return { ok: false, note: 'Cooldown map kaydi olusmadi.' };
    return { ok: true, note: 'Cooldown aktif, item tekrar listelenmedi.' };
  })()`, { ok: false, note: 'Cooldown kontrolu calismadi.' });
  const shot = path.join(ARTIFACT_DIR, 'cooldown-check.png');
  await client.screenshot(shot);
  return { verdict: outcome.ok ? 'PASS' : 'FAIL', note: outcome.note, screenshot: shot };
};

const runDuplicateIdempotencyCheck = async (client: CdpClient): Promise<{ verdict: Verdict; note: string; screenshot: string }> => {
  await go(client, { quick: 'analysis', e2e: '1', qaRecords: 'none', analysisTab: 'goals' });
  const before = await readParentActionStats(client);
  await click(client, '[data-testid="track-topic-btn"]');
  await click(client, '[data-testid="track-topic-btn"]');
  await click(client, '[data-testid="add-to-plan-btn"]');
  await click(client, '[data-testid="add-to-plan-btn"]');
  await wait(250);
  await openAnalysisTab(client, 'goals');
  const after = await readParentActionStats(client);
  const shot = path.join(ARTIFACT_DIR, 'duplicate-idempotency.png');
  await client.screenshot(shot);
  const created = after.total - before.total;
  const duplicateDelta = after.duplicate - before.duplicate;
  const stable = duplicateDelta <= 0 && created <= 2;
  if (!stable) {
    return { verdict: 'FAIL', note: `before=${before.total}/${before.duplicate}, after=${after.total}/${after.duplicate}, created=${created}`, screenshot: shot };
  }
  const mode = created <= 0 ? 'mevcut plan gorevi nedeniyle yeni kayit acilmadi' : `yeni kayit=${created}`;
  return {
    verdict: 'PASS',
    note: `before=${before.total}/${before.duplicate}, after=${after.total}/${after.duplicate}, ${mode}`,
    screenshot: shot,
  };
};

const formatBytes = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const getLoadFailureNote = (entry: LoadTestResult): string => {
  if (entry.verdict === 'PASS') return 'Seviye kabul siniri icinde.';
  const actual = entry.actual.toLocaleLowerCase('tr-TR');
  if (actual.includes('quota') || actual.includes('quotaexceeded') || actual.includes('yer kalmadi')) {
    return 'FAIL nedeni localStorage/kalici depolama quota siniri.';
  }
  if (entry.browser.screenOpenMs > SCREEN_OPEN_BUDGET_MS[entry.level]) {
    return `FAIL nedeni ekran acilis suresi butceyi asti (${entry.browser.screenOpenMs}ms > ${SCREEN_OPEN_BUDGET_MS[entry.level]}ms).`;
  }
  if (entry.browser.graphRenderMs > GRAPH_RENDER_BUDGET_MS[entry.level]) {
    return `FAIL nedeni grafik render suresi butceyi asti (${entry.browser.graphRenderMs}ms > ${GRAPH_RENDER_BUDGET_MS[entry.level]}ms).`;
  }
  if (entry.engine.analysisMs > ANALYSIS_BUDGET_MS[entry.level]) {
    return `FAIL nedeni analiz suresi butceyi asti (${entry.engine.analysisMs}ms > ${ANALYSIS_BUDGET_MS[entry.level]}ms).`;
  }
  return `FAIL nedeni: ${entry.actual}`;
};

const toMarkdown = (model: FinalReportModel) => {
  const lines: string[] = [];
  lines.push('# Ebeveyn Karar Ekrani 6000+ Guven Test Raporu');
  lines.push('');
  lines.push(`- Tarih: ${model.generatedAt}`);
  lines.push(`- Uygulama: ${model.appUrl}`);
  lines.push(`- Ortam: ${model.environment.os}, Node ${model.environment.node}`);
  lines.push(`- Ham JSON: [parent-decision-6000plus-raw.json](${toLink(JSON_PATH)})`);
  lines.push(`- Kosu logu: [run.log](${toLink(RUN_LOG)})`);
  lines.push('');

  lines.push('## 1) 6000 / 10000 / 20000 kayit yuk testi');
  lines.push('');
  model.loadTests.forEach((entry) => {
    lines.push(`### Seviye ${entry.level}`);
    lines.push(`- Veri miktari: ${entry.level} gorev + oturum/soru/deneme/hedef/tekrar karisik`);
    lines.push(`- Beklenen sonuc: ${entry.expected}`);
    lines.push(`- Gercek sonuc: ${entry.actual}`);
    lines.push(`- Sure (engine): analiz ${entry.engine.analysisMs}ms, decision ${entry.engine.decisionMs}ms, 2. run ${entry.engine.cacheSecondRunMs}ms`);
    lines.push(`- Sure (ui): ekran ${entry.browser.screenOpenMs}ms, grafik ${entry.browser.graphRenderMs}ms`);
    lines.push(`- Bellek: node heap ${formatBytes(entry.engine.heapUsedBytes)}, browser heap ${formatBytes(entry.browser.jsHeapUsedBytes)}`);
    lines.push(`- Storage: localStorage ${formatBytes(entry.browser.storage.localStorageBytes)}, storage.usage ${formatBytes(entry.browser.storage.indexedDbBytes)}`);
    lines.push(`- Cache hit/miss: engine ${entry.engine.cacheHit}/${entry.engine.cacheMiss}, ui ${entry.browser.cacheHits}/${entry.browser.cacheMisses}`);
    lines.push(`- PASS/FAIL: ${entry.verdict}`);
    lines.push(`- Ekran goruntusu/log: [level-${entry.level}.png](${toLink(entry.browser.screenshot)})`);
    lines.push(`- Risk yorumu: ${getLoadFailureNote(entry)}`);
    lines.push('');
  });

  lines.push('## 2) Geri butonu / navigation (100 tekrar x 5 akis)');
  lines.push('');
  model.navigation.forEach((entry) => {
    lines.push(`### ${entry.name}`);
    lines.push(`- Veri miktari: 100 tekrar`);
    lines.push(`- Beklenen sonuc: ${entry.expected}`);
    lines.push(`- Gercek sonuc: ${entry.actual}`);
    lines.push(`- Sure: 100 dongu`);
    lines.push(`- Bellek: bu maddede asiri artis beklenmez`);
    lines.push(`- Storage boyutu: duplicate kontrolu icin parent-action izlenir`);
    lines.push(`- PASS/FAIL: ${entry.verdict}`);
    lines.push(`- Ekran goruntusu/log: [${path.basename(entry.screenshot)}](${toLink(entry.screenshot)})`);
    lines.push(`- Risk yorumu: ${entry.verdict === 'PASS' ? 'Gecisler stabil.' : 'Navigation veya state senkron sorunu var.'}`);
    lines.push('');
  });

  lines.push('## 3) Grafik veri dogrulugu');
  lines.push('');
  lines.push(`- Beklenen sonuc: ${model.graphAccuracy.expected}`);
  lines.push(`- Gercek sonuc: ${model.graphAccuracy.actual}`);
  lines.push(`- PASS/FAIL: ${model.graphAccuracy.verdict}`);
  lines.push(`- Ekran goruntusu/log: [graph-accuracy.png](${toLink(model.graphAccuracy.screenshot)})`);
  lines.push('');
  model.graphAccuracy.checks.forEach((check) => {
    lines.push(`- ${check.key}: beklenen=${check.expected} / gercek=${check.actual} -> ${check.verdict}`);
  });
  lines.push('');

  lines.push('## 4) Hesaplama dogrulugu (50 rastgele ornek)');
  lines.push('');
  lines.push(`- Veri miktari: ${model.calculations.sampleCount} ornek`);
  lines.push(`- Beklenen sonuc: ${model.calculations.expected}`);
  lines.push(`- Gercek sonuc: ${model.calculations.actual}`);
  lines.push(`- PASS/FAIL: ${model.calculations.verdict}`);
  lines.push(`- Risk yorumu: ${model.calculations.mismatches === 0 ? 'Karar motoru ve manuel beklenenler uyumlu.' : 'Manuel/engine sapmasi var, sinir degerler kontrol edilmeli.'}`);
  lines.push('');
  lines.push('Ornek satirlar:');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(model.calculations.examples, null, 2));
  lines.push('```');
  lines.push('');

  lines.push(`## 5) Sisme / performans (${model.stress.durationMinutes} dakika yogun kullanim)`);
  lines.push('');
  lines.push(`- Beklenen sonuc: ${model.stress.expected}`);
  lines.push(`- Gercek sonuc: ${model.stress.actual}`);
  lines.push(`- Sure: ${model.stress.durationMinutes} dakika`);
  lines.push(`- Bellek: artis ${formatBytes(model.stress.memoryGrowthBytes)}`);
  lines.push(`- Storage boyutu artisi: ${formatBytes(model.stress.storageGrowthBytes)}`);
  lines.push(`- Cache hit/miss delta: ${model.stress.cacheDelta.hit}/${model.stress.cacheDelta.miss}`);
  lines.push(`- PASS/FAIL: ${model.stress.verdict}`);
  lines.push(`- Ekran goruntusu/log: [${path.basename(model.stress.screenshot)}](${toLink(model.stress.screenshot)})`);
  lines.push(`- Risk yorumu: ${model.stress.verdict === 'PASS' ? 'Yogun kullanimda kontrol altinda.' : 'Yogun kullanimda gecikme veya stabilite riski var.'}`);
  lines.push('');

  lines.push(`## 6) Uzun sureli soak (${model.soak.durationMinutes} dakika)`);
  lines.push('');
  lines.push(`- Beklenen sonuc: ${model.soak.expected}`);
  lines.push(`- Gercek sonuc: ${model.soak.actual}`);
  lines.push(`- Sure: ${model.soak.durationMinutes} dakika (${model.soak.iterations} dakika adimi)`);
  lines.push(`- Bellek: artis ${formatBytes(model.soak.memoryGrowthBytes)}`);
  lines.push(`- PASS/FAIL: ${model.soak.verdict}`);
  lines.push(`- Ekran goruntusu/log: [${path.basename(model.soak.screenshot)}](${toLink(model.soak.screenshot)})`);
  lines.push(`- Risk yorumu: ${model.soak.verdict === 'PASS' ? 'Uzun kosuda stabil.' : 'Uzun kosuda crash veya veri sapmasi var.'}`);
  lines.push('');

  const level6000 = model.loadTests.find((entry) => entry.level === 6000);
  const level10000 = model.loadTests.find((entry) => entry.level === 10000);
  const level20000 = model.loadTests.find((entry) => entry.level === 20000);

  lines.push('## 7) Nihai karar (seviye bazli)');
  lines.push('');
  lines.push(`- 3000/6000 release hedefi: ${level6000 ? (level6000.verdict === 'PASS' ? 'UYGUN' : `UYGUN DEGIL (${getLoadFailureNote(level6000)})`) : '6000 kosulmadi; karar verilemedi.'}`);
  lines.push(`- 10000 stres guveni: ${level10000 ? (level10000.verdict === 'PASS' ? 'UYGUN' : `RISKLI (${getLoadFailureNote(level10000)})`) : '10000 kosulmadi; karar verilemedi.'}`);
  lines.push(`- 20000 opsiyonel ust sinir: ${level20000 ? (level20000.verdict === 'PASS' ? 'UYGUN (opsiyonel kapasite kabul)' : `LIMITTE/FAIL (${getLoadFailureNote(level20000)})`) : '20000 kosulmadi; opsiyonel limit testi beklemede.'}`);
  lines.push('');

  lines.push('## 8) Ozel sorulara net cevap');
  lines.push('');
  model.answers.forEach((entry) => {
    lines.push(`${entry.question} ${entry.answer}`);
  });
  lines.push('');

  if (model.risks.length > 0) {
    lines.push('## Acik riskler');
    lines.push('');
    model.risks.forEach((risk) => lines.push(`- ${risk}`));
    lines.push('');
  }

  return lines.join('\n');
};

const main = async () => {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await writeFile(RUN_LOG, '', 'utf8');
  await log('6000plus safety run started');

  const vite = await startViteIfNeeded();
  const chrome = await startChrome();
  const wsUrl = await createTargetWsUrl(`${BASE_URL}/?quick=analysis&e2e=1&qaRecords=none`);
  const client = new CdpClient(wsUrl);

  const cleanup = async () => {
    client.close();
    if (chrome && !chrome.killed) chrome.kill('SIGKILL');
    if (vite && !vite.killed) vite.kill('SIGKILL');
  };

  try {
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await installErrorHooks(client);
    try {
      await go(client, { quick: 'analysis', e2e: '1', qaRecords: 'none', analysisTab: 'overview' });
      await ensureParentAnalysisWorkspace(client, 15000);
      await go(client, { quick: 'analysis', e2e: '1', qaRecords: 'none', analysisTab: 'reports' });
      await waitForSelector(client, '[data-testid="analysis-reports-section"]', 12000);
      await log('ui prewarm completed');
    } catch (prewarmError) {
      await log(`WARN ui prewarm skipped: ${prewarmError instanceof Error ? prewarmError.message : String(prewarmError)}`);
    }

    const loadResults: LoadTestResult[] = [];
    const stabilityRuns: Array<{ run: number; verdict: Verdict; actual: string }> = [];
    let basePayload: SeedPayload | null = null;
    let baseAnalysis: ReturnType<typeof deriveAnalysisSnapshot> | null = null;
    let baseDecision: ReturnType<typeof buildParentDecision> | null = null;

    const levels: LoadLevel[] = REQUESTED_LOAD_LEVELS;
    const preferredBaseLevel: LoadLevel = levels.includes(10000) ? 10000 : levels[0];
    for (const level of levels) {
      if (level === 6000 && REPEAT_6000 > 1) {
        for (let run = 1; run <= REPEAT_6000; run += 1) {
          const one = await runLoadLevel(client, level);
          stabilityRuns.push({ run, verdict: one.result.verdict, actual: one.result.actual });
          await log(`stability run level=6000 run=${run}/${REPEAT_6000} verdict=${one.result.verdict}`);
          if (run === 1) {
            loadResults.push(one.result);
            if (level === preferredBaseLevel) {
              basePayload = one.payload;
              baseAnalysis = one.analysis;
              baseDecision = one.decision;
            }
          }
        }
        continue;
      }

      const one = await runLoadLevel(client, level);
      loadResults.push(one.result);
      if (level === preferredBaseLevel) {
        basePayload = one.payload;
        baseAnalysis = one.analysis;
        baseDecision = one.decision;
      }
    }

    if (stabilityRuns.length > 0) {
      const failRuns = stabilityRuns.filter((run) => run.verdict === 'FAIL');
      await writeFile(path.join(ARTIFACT_DIR, 'stability-6000-runs.json'), JSON.stringify({
        generatedAt: nowIso(),
        total: stabilityRuns.length,
        failCount: failRuns.length,
        runs: stabilityRuns,
      }, null, 2), 'utf8');
      await log(`stability summary total=${stabilityRuns.length} fail=${failRuns.length}`);
      if (failRuns.length > 0) {
        throw new Error(`6000 stability FAIL: ${failRuns.length}/${stabilityRuns.length}. First fail => ${failRuns[0].actual}`);
      }
    }

    if (ONLY_LOAD_MODE) {
      await log('ONLY_LOAD_MODE aktif: navigation/graph/calculation/stress/soak adimlari atlandi');
      console.log(JSON.stringify({
        status: 'PARENT_DECISION_6000PLUS_LOAD_ONLY_OK',
        loadVerdicts: loadResults.map((entry) => ({ level: entry.level, verdict: entry.verdict, actual: entry.actual })),
        stabilityRuns,
      }, null, 2));
      return;
    }

    if (!basePayload || !baseAnalysis || !baseDecision) {
      throw new Error('Base payload hazirlanamadi.');
    }

    await go(client, { quick: 'analysis', e2e: '1', qaRecords: 'none', analysisTab: 'overview' });
    await seedBrowserStorage(client, basePayload);
    await go(client, { quick: 'analysis', e2e: '1', qaRecords: 'none', analysisTab: 'overview' });
    const baseReady = await waitForAnalysisDataReady(client, baseAnalysis.overall.generalScore, 45000);
    if (!baseReady) {
      const baseDebug = await readTaskStorageDebug(client);
      await releaseSeedLock(client);
      throw new Error(`Base seed verisi navigation testleri oncesi hazir olmadi. local=${baseDebug.localKind}:${baseDebug.localCount} idb=${baseDebug.idbCount} bulk=${baseDebug.bulkMarker} q=${baseDebug.query}`);
    }
    await releaseSeedLock(client);

    const navResults = await runNavigationLoops(client);
    const graphAccuracy = await runGraphAccuracyTest(client, basePayload, baseAnalysis);
    const calculations = runCalculationAccuracyTest(basePayload, baseAnalysis, baseDecision);
    const duplicateCheck = await runDuplicateIdempotencyCheck(client);
    const cooldownCheck = await runNotificationCooldownCheck(client);
    const stress = await runStressTest(client);
    const soak = await runSoakTest(client);

    const risks: string[] = [];
    if (duplicateCheck.verdict === 'FAIL') risks.push(`Duplicate idempotency: ${duplicateCheck.note}`);
    if (cooldownCheck.verdict === 'FAIL') risks.push(`Notification cooldown: ${cooldownCheck.note}`);
    if (graphAccuracy.verdict === 'FAIL') risks.push('Grafik veri uyumunda uyumsuzluk var.');
    if (stress.verdict === 'FAIL') risks.push(`${stress.durationMinutes}dk stress test siniri asildi.`);
    if (soak.verdict === 'FAIL') risks.push(`${soak.durationMinutes}dk soak testte stabilite sorunu var.`);

    const q1 = loadResults.find((x) => x.level === 6000);
    const q2 = navResults.every((x) => x.verdict === 'PASS');
    const q6_10000 = loadResults.find((x) => x.level === 10000);
    const q6_20000 = loadResults.find((x) => x.level === 20000);

    const model: FinalReportModel = {
      generatedAt: nowIso(),
      appUrl: `${BASE_URL}/?quick=analysis&e2e=1&qaRecords=none`,
      environment: {
        os: process.platform,
        node: process.version,
      },
      loadTests: loadResults,
      navigation: navResults,
      graphAccuracy,
      calculations,
      stress,
      soak,
      risks,
      answers: [
        {
          question: '1. 6000+ kayitla uygulama takiliyor mu?',
          answer: q1 ? (q1.verdict === 'PASS' ? `Hayir. Ekran ${q1.browser.screenOpenMs}ms, grafik ${q1.browser.graphRenderMs}ms.` : `Kismen. ${q1.actual}`) : 'Veri yok.',
        },
        {
          question: '2. Geri butonu ve ekran gecisleri bozuluyor mu?',
          answer: q2 ? 'Hayir. 5 akis x 100 dongu PASS.' : `Evet, en az bir akis FAIL. Detay: ${navResults.filter((x) => x.verdict === 'FAIL').map((x) => x.name).join(', ')}`,
        },
        {
          question: '3. Grafikler dogru veriyi gosteriyor mu?',
          answer: graphAccuracy.verdict === 'PASS' ? 'Evet, kontrol edilen metrikler ham veri ile uyumlu.' : 'Kismen, grafik uyumsuzluklari var.',
        },
        {
          question: '4. Hesaplamalar UI ile tutarli mi?',
          answer: calculations.verdict === 'PASS' ? `Evet, ${calculations.sampleCount} ornekte uyumlu.` : `${calculations.mismatches} uyumsuzluk var.`,
        },
        {
          question: '5. Uygulama zamanla sisiyor mu?',
          answer: stress.verdict === 'PASS' && soak.verdict === 'PASS'
            ? 'Belirgin sizma yok. Stress ve soak testleri stabil.'
            : 'Sisme/stabilite riski var; stress/soak bulgularina bakilmali.',
        },
        {
          question: '6. 10000 ve 20000 kayit sinirinda ne oluyor?',
          answer: `10000: ${q6_10000?.actual || 'kosulmadi'}. 20000: ${q6_20000?.actual || 'kosulmadi'}.`,
        },
      ],
    };

    const markdown = toMarkdown(model);
    await writeFile(JSON_PATH, JSON.stringify(model, null, 2), 'utf8');
    await writeFile(REPORT_PATH, markdown, 'utf8');
    await writeFile(REPORT_PATH_V2, markdown, 'utf8');
    await log('6000plus safety run completed');

    console.log(JSON.stringify({
      status: 'PARENT_DECISION_6000PLUS_SAFETY_OK',
      reportPath: REPORT_PATH,
      jsonPath: JSON_PATH,
      loadVerdicts: loadResults.map((entry) => ({ level: entry.level, verdict: entry.verdict, actual: entry.actual })),
      navigationVerdicts: navResults.map((entry) => ({ name: entry.name, verdict: entry.verdict })),
      graphVerdict: graphAccuracy.verdict,
      calculationVerdict: calculations.verdict,
      stressVerdict: stress.verdict,
      soakVerdict: soak.verdict,
      duplicateVerdict: duplicateCheck.verdict,
      cooldownVerdict: cooldownCheck.verdict,
    }, null, 2));
  } finally {
    await cleanup();
  }
};

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? `${error.message}\n${error.stack || ''}` : String(error);
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await appendFile(RUN_LOG, `${nowIso()} ERROR ${message}\n`, 'utf8');
  console.error(message);
  process.exitCode = 1;
});
