import React, { useEffect, useMemo, useRef, useState } from 'react';
import ParentDashboard from './components/parent/ParentDashboard';
import ChildDashboard from './components/child/ChildDashboard';
import ParentLockScreen from './components/parent/ParentLockScreen';
import CurriculumManagerPanel from './components/parent/CurriculumManagerPanel';
import WeeklySchedulePanel from './components/parent/WeeklySchedulePanel';
import PlanningPanel from './components/parent/PlanningPanel';
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
} from './types';
import { GraduationCap, User, Users, BadgeCheck, Home, Sparkles, ClipboardList, BarChart, Menu, X, Bell, Settings, Clock, AlertTriangle, Lock, ChevronLeft, ChevronRight, ChevronDown, PlusCircle, Search, Lightbulb } from './components/icons';
import { ALL_ICONS } from './constants';
import { calculateTaskPoints } from './utils/scoringAlgorithm';
import { getLocalDateString } from './utils/dateUtils';
import { deriveAnalysisSnapshot } from './utils/analysisEngine';
import { playHaptic } from './utils/haptics';
import { GoogleGenAI } from '@google/genai';

const SCHEDULE_DAYS = ['Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma', 'Cumartesi', 'Pazar'] as const;

const createScheduleSlot = (courseName: string, startTime: string, endTime: string, note?: string): WeeklyScheduleSlot => ({
  id: `slot_${courseName}_${startTime}_${endTime}`.replace(/\s+/g, '_').toLowerCase(),
  courseName,
  startTime,
  endTime,
  note,
});

const createEmptyScheduleDay = (): WeeklyScheduleDay => ({
  slots: [],
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

const defaultWeeklySchedule: WeeklySchedule = {
  Pazartesi: { confirmed: true, slots: [createScheduleSlot('Matematik', '09:00', '10:00'), createScheduleSlot('Turkce', '10:00', '11:00')] },
  Sali: { confirmed: true, slots: [createScheduleSlot('Fen Bilimleri', '09:00', '10:00'), createScheduleSlot('Turkce', '10:00', '11:00')] },
  Carsamba: { confirmed: true, slots: [createScheduleSlot('Matematik', '09:00', '10:00'), createScheduleSlot('Sosyal Bilgiler', '10:00', '11:00')] },
  Persembe: { confirmed: true, slots: [createScheduleSlot('Ingilizce', '09:00', '10:00'), createScheduleSlot('Fen Bilimleri', '10:00', '11:00')] },
  Cuma: { confirmed: true, slots: [createScheduleSlot('Matematik', '09:00', '10:00'), createScheduleSlot('Turkce', '10:00', '11:00')] },
  Cumartesi: { confirmed: false, slots: [] },
  Pazar: { confirmed: false, slots: [] },
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

type ParentWorkspaceView = 'overview' | 'planning' | 'tasks' | 'analysis';
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

const searchScopes: Array<{ id: SearchScope; label: string }> = [
  { id: 'all', label: 'Tumu' },
  { id: 'tasks', label: 'Gorev' },
  { id: 'topics', label: 'Konu' },
  { id: 'exams', label: 'Sinav' },
  { id: 'courses', label: 'Ders' },
  { id: 'rewards', label: 'Odul' },
];

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

function useStickyState<T>(defaultValue: T, key: string): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, value]);

  return [value, setValue];
}

const repairText = (value?: string) => {
  if (typeof value !== 'string' || !value) return value;

  let next = value;
  for (let i = 0; i < 3; i += 1) {
    if (!/[ÃÂâ�]/.test(next)) break;
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

const looksCorrupted = (value?: string) => typeof value === 'string' && /[ÃÂâ�]/.test(value);

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

const EMPTY_STATE_TEXT = 'Analiz icin yeterli veri yok.';

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
    if (task.status !== 'tamamlandı' || typeof task.focusScore !== 'number' || !task.completionDate) return false;
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
      if (task.status !== 'tamamlandı' || task.taskType !== 'soru çözme' || !task.completionDate) return false;
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

const getNetPerformanceSummary = ({
  hasData,
  averageMastery,
  riskLevel,
  overdueCount,
  weakTopicCount,
}: {
  hasData: boolean;
  averageMastery: number;
  riskLevel: RiskLevel;
  overdueCount: number;
  weakTopicCount: number;
}) => {
  if (!hasData) {
    return {
      title: 'Veri bekleniyor',
      tone: 'border-slate-200 bg-slate-50 text-slate-700',
      text: 'Analiz verisi olustukca ogrencinin performans ozeti burada gosterilecek.',
    };
  }

  if (averageMastery >= 85 && riskLevel === 'dusuk') {
    return {
      title: 'Cok iyi gidiyor',
      tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      text: 'Genel performans guclu. Mevcut tempoyu koruyun.',
    };
  }

  if (averageMastery >= 70 && riskLevel !== 'yuksek') {
    return {
      title: 'Iyi, kontrollu ilerleme',
      tone: 'border-sky-200 bg-sky-50 text-sky-800',
      text: 'Performans iyi seviyede. Odak isteyen konulara kisa tekrar eklemek yeterli olur.',
    };
  }

  if (averageMastery >= 55) {
    return {
      title: 'Orta seviye, destek gerekli',
      tone: 'border-amber-200 bg-amber-50 text-amber-800',
      text: `Gelisim var. ${weakTopicCount} odak konusu ve ${overdueCount} takipteki gorev icin destek plani gerekli.`,
    };
  }

  return {
    title: 'Yakin destek gerekiyor',
    tone: 'border-rose-200 bg-rose-50 text-rose-800',
    text: `Performans destek istiyor. Once takipteki ${overdueCount} gorevi tamamlayip temel konulara donulmeli.`,
  };
};

const normalizeTask = (task: any): Task => {
  const normalizedStatus = task?.status === 'tamamland\u0131' || task?.status === 'tamamlandi' || task?.status === 'tamamland\u0131' ? 'tamamland\u0131' : 'bekliyor';
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
    confirmed: slots.length > 0,
  };
};

const normalizeWeeklySchedule = (schedule: any): WeeklySchedule => {
  const nextEntries = SCHEDULE_DAYS.map((day) => {
    const rawDay = schedule?.[day];

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
          confirmed: Boolean(rawDay.confirmed) && slots.length > 0,
        },
      ] as const;
    }

    return [day, createEmptyScheduleDay()] as const;
  });

  return Object.fromEntries(nextEntries) as WeeklySchedule;
};

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

  return items
    .map((item, index) => {
      const courseName = repairedText(item?.courseName).trim();
      const matchedCourse = courses.find((course) => normalizeForLookup(course.name) === normalizeForLookup(courseName));
      const courseId = typeof item?.courseId === 'string' && item.courseId ? item.courseId : matchedCourse?.id || '';
      const title = repairedText(item?.title).trim();
      const date = typeof item?.date === 'string' ? item.date : '';
      const score = Number(item?.score);

      if (!courseId || !courseName || !title || !date || !Number.isFinite(score)) return null;

      return {
        id: typeof item?.id === 'string' && item.id ? item.id : `exam_record_${courseId}_${date}_${index}`,
        courseId,
        courseName,
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

  return items
    .map((item, index) => {
      const title = repairedText(item?.title).trim();
      const date = typeof item?.date === 'string' ? item.date : '';
      const coursesPayload = Array.isArray(item?.courses)
        ? item.courses
            .map((entry: any) => {
              const courseName = repairedText(entry?.courseName).trim();
              const matchedCourse = courses.find((course) => normalizeForLookup(course.name) === normalizeForLookup(courseName));
              const courseId = typeof entry?.courseId === 'string' && entry.courseId ? entry.courseId : matchedCourse?.id || '';
              const score = Number(entry?.score);
              if (!courseId || !courseName || !Number.isFinite(score)) return null;
              return {
                courseId,
                courseName,
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
  if (item.id === 'b1' || index === 0) return { ...item, name: 'Ilk Adim', description: 'Ilk gorevini tamamladin!' };
  return { ...item, name: 'Rozet', description: 'Rozet aciklamasi guncellenecek.' };
});
const normalizeCourses = (items: Course[]): Course[] => items.map((item) => ({ ...item, name: repairText(item.name) || item.name }));
const normalizeStudyPlans = (items: any[]): StoredStudyPlan[] => {
  if (!Array.isArray(items)) return [];

  const plansByWeek = new Map<number, number>();

  return items.map((item, index) => {
    const week = Number(item?.week) || 0;
    const nextVersion = Number(item?.version) || ((plansByWeek.get(week) || 0) + 1);
    plansByWeek.set(week, nextVersion);

    return {
      ...item,
      id: typeof item?.id === 'string' && item.id ? item.id : `stored_plan_week_${week}_v${nextVersion}_${index}`,
      week,
      version: nextVersion,
      status: item?.status,
      reason: item?.reason,
      generatedAt: typeof item?.generatedAt === 'string' && item.generatedAt ? item.generatedAt : undefined,
      approvedAt: typeof item?.approvedAt === 'string' && item.approvedAt ? item.approvedAt : undefined,
      approvedBy: item?.approvedBy === 'parent' || item?.approvedBy === 'system' ? item.approvedBy : undefined,
      parentPlanId: typeof item?.parentPlanId === 'string' && item.parentPlanId ? item.parentPlanId : undefined,
    } as StoredStudyPlan;
  });
};

const normalizeExamScheduleEntries = (items: any[], courses: Course[]): ExamScheduleEntry[] => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => {
      const courseName = repairedText(item?.courseName).trim();
      const matchedCourse = courses.find((course) => normalizeForLookup(course.name) === normalizeForLookup(courseName));
      const courseId = typeof item?.courseId === 'string' && item.courseId ? item.courseId : matchedCourse?.id || '';
      const examName = repairedText(item?.examName ?? item?.name).trim();
      const date = typeof item?.date === 'string' ? item.date : '';

      if (!courseId || !courseName || !examName || !date) return null;

      return {
        id: typeof item?.id === 'string' && item.id ? item.id : `exam_schedule_${courseId}_${date}_${index}`,
        courseId,
        courseName,
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

const getScheduleWindowsForDay = (dayName: string): ScheduleDayWindow[] => {
  if (dayName === 'Cumartesi' || dayName === 'Pazar') {
    return [
      { startTime: '10:00', endTime: '13:00', quality: 'deep' },
      { startTime: '14:00', endTime: '17:00', quality: 'deep' },
    ];
  }

  return [
    { startTime: '05:00', endTime: '08:00', quality: 'light' },
    { startTime: '16:00', endTime: '18:00', quality: 'medium' },
    { startTime: '18:00', endTime: '20:00', quality: 'medium' },
    { startTime: '20:00', endTime: '21:30', quality: 'light' },
  ];
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
      availableWindows: getScheduleWindowsForDay(dayName),
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
    const matchingPlanRecord = studyPlanRecords.find((item) => item.weekKey === `week-${storedPlan.week}` && item.version === planIndex + 1) || studyPlanRecords.find((item) => item.weekKey === `week-${storedPlan.week}`);

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
    .filter((task) => task.planWeek === latestWeek && task.planTaskId && task.status !== 'tamamlandı')
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
    .filter((task) => task.status === 'tamamlandı')
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
    .filter((task) => task.status === 'tamamlandı' && (
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
        reasonText: `${topic.courseName} / ${topic.topicName} icin tekrar gecikmesi var.`,
      }];
    }
    return [];
  });

  const sortedPlans = [...studyPlans].sort((left, right) => {
    if (left.week !== right.week) return left.week - right.week;
    return (left.version || 0) - (right.version || 0);
  });
  const activePlan = sortedPlans.find((plan) => plan.status === 'active') || sortedPlans.slice(-1)[0];
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
      .filter((task) => task.day === 'Pazartesi' || task.day === 'Sali' || task.day === 'Carsamba')
      .map((task) => task.id);

    if (midWeekTaskIds.length > 0) {
      const completedMidWeekTasks = planTasksForWeek.filter((task) => midWeekTaskIds.includes(task.planTaskId || '') && task.status === 'tamamlandı').length;
      const completionRateByWednesday = Math.round((completedMidWeekTasks / midWeekTaskIds.length) * 100);

      if (completionRateByWednesday < 50) {
        triggers.push({
          id: `trigger_mid_week_warning_week_${activePlanWeek}`,
          type: 'mid-week-warning',
          createdAt: new Date().toISOString(),
          severity: completionRateByWednesday < 30 ? 'high' : 'medium',
          reasonText: `Hafta ${activePlanWeek} Carsamba tamamlama orani %${completionRateByWednesday} seviyesinde kaldigi icin erken uyari olustu.`,
        });
      }
    }
  }

  if (activePlan && isWeekEnd && planTasksForWeek.length > 0) {
    const completedCount = planTasksForWeek.filter((task) => task.status === 'tamamlandı').length;
    const completionRate = Math.round((completedCount / planTasksForWeek.length) * 100);
    if (completionRate < 60) {
      triggers.push({
        id: `trigger_plan_break_week_${activePlanWeek}`,
        type: 'plan-break',
        createdAt: new Date().toISOString(),
        severity: completionRate < 40 ? 'high' : 'medium',
        reasonText: `Hafta ${activePlanWeek} tamamlama orani %${completionRate} seviyesinde kaldigi icin plan kirilmasi olustu.`,
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
        examTriggerMap.set(task.courseId, { dueDate: task.dueDate, relatedCourseId: task.courseId, examName: 'Yaklasan sinav' });
      }
    });

    examTriggerMap.forEach(({ dueDate, relatedCourseId, examName }) => {
      const relevantAssessments = tasks
        .filter((task) => task.courseId === relatedCourseId && task.status === 'tamamlandı' && (
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
        reasonText: `${examName} sinavina ${daysToExam} gun kaldi ve son ortalama basari %${averageScore} seviyesinde oldugu icin sinav baskisi olustu.`,
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
  { id: 'overview', label: 'Genel Bakis', description: 'Ozet ve kontrol merkezi', icon: Home },
  { id: 'planning', label: 'Planlama', description: 'Ders programi + mufredat + haftalik plan olusturma', icon: Sparkles },
  { id: 'tasks', label: 'Dersler ve Gorevler', description: 'Cocuga gorev atama ve gorev yonetimi', icon: ClipboardList },
  { id: 'analysis', label: 'Analiz', description: 'Performans ve raporlar', icon: BarChart },
];

const primaryParentWorkspaceIds: ParentWorkspaceView[] = ['overview', 'tasks', 'analysis', 'planning'];
const secondaryParentWorkspaceIds: ParentWorkspaceView[] = [];
const parentTopNavItems: Array<{ id: ParentWorkspaceView; label: string }> = [
  { id: 'overview', label: 'Genel Bakis' },
  { id: 'planning', label: 'Planlama' },
  { id: 'tasks', label: 'Dersler ve Gorevler' },
  { id: 'analysis', label: 'Analiz' },
];

const App: React.FC = () => {
  const [userType, setUserType] = useStickyState<UserType>(UserType.Parent, 'userType');
  const [courses, setCourses] = useStickyState<Course[]>([], 'courses');
  const [tasks, setTasks] = useStickyState<Task[]>([], 'tasks');
  const [curriculum, setCurriculum] = useStickyState<SubjectCurriculum>({}, 'curriculum');
  const [weeklySchedule, setWeeklySchedule] = useStickyState<WeeklySchedule>(defaultWeeklySchedule, 'weeklySchedule');
  const [examScheduleEntries, setExamScheduleEntries] = useStickyState<ExamScheduleEntry[]>([], 'examScheduleEntries');
  const [examRecords, setExamRecords] = useStickyState<ExamRecord[]>([], 'examRecords');
  const [compositeExamResults, setCompositeExamResults] = useStickyState<CompositeExamResult[]>([], 'compositeExamResults');
  const [studyPlans, setStudyPlans] = useStickyState<StoredStudyPlan[]>([], 'studyPlans');
  const [planningEngineSnapshot, setPlanningEngineSnapshot] = useStickyState<PlanningEngineSnapshot>(defaultPlanningEngineSnapshot, 'planningEngineSnapshot');
  const [performanceData, setPerformanceData] = useStickyState<PerformanceData[]>([], 'performanceData');
  const [rewards, setRewards] = useStickyState<Reward[]>([], 'rewards');
  const [successPoints, setSuccessPoints] = useStickyState<number>(0, 'successPoints');
  const [badges, setBadges] = useStickyState<Badge[]>([{ id: 'b1', name: 'Ilk Adim', description: 'Ilk gorevini tamamladin!', icon: BadgeCheck }], 'badges');
  const [isParentLocked, setIsParentLocked] = useStickyState<boolean>(true, 'isParentLocked');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [showDeleteCourseModal, setShowDeleteCourseModal] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [parentWorkspaceView, setParentWorkspaceView] = useStickyState<ParentWorkspaceView>('overview', 'parentWorkspaceView');
  const [overviewStudyPeriod, setOverviewStudyPeriod] = useStickyState<OverviewStudyPeriod>('month', 'parentOverviewStudyPeriod');
  const [parentDefaultView, setParentDefaultView] = useStickyState<ParentWorkspaceView>('overview', 'parentDefaultView');
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
  const [dismissedNotificationKeys, setDismissedNotificationKeys] = useStickyState<string[]>([], 'dismissedNotificationKeys');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchScope, setGlobalSearchScope] = useState<SearchScope>('all');

  useEffect(() => {
    const paletteFlag = 'drDarkPaletteApplied';
    if (window.localStorage.getItem(paletteFlag) === 'true') return;
    setThemeMode('dark');
    window.localStorage.setItem(paletteFlag, 'true');
  }, [setThemeMode]);

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
    if (quickView === 'tasks' || quickView === 'analysis' || quickView === 'planning') {
      setParentWorkspaceView(quickView);
      setUserType(UserType.Parent);
    }
  }, [setParentWorkspaceView, setUserType]);

  useEffect(() => {
    const nextCourses = normalizeCourses(courses);
    const nextTasks = tasks.map(normalizeTask);
    const nextPerformance = normalizePerformanceData(performanceData);
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
    const subjectNames = Object.keys(curriculum || {});
    const nextCourses = subjectNames.map((subjectName) => {
      const matched = courses.find((course) => normalizeForLookup(course.name) === normalizeForLookup(subjectName));
      if (matched) {
        return { ...matched, name: subjectName };
      }
      return {
        id: createId('course'),
        name: subjectName,
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
      addToast('Devam edilecek gorev bulunamadi.', 'error');
      return;
    }

    const timerState = window.localStorage.getItem(`timerState_${taskId}`);
    if (!timerState) {
      addToast('Bu gorev icin kayitli bir devam oturumu yok.', 'error');
      return;
    }

    window.localStorage.setItem('resumeTaskId', taskId);
    setUserType(UserType.Child);
    addToast(`'${task.title}' gorevine geri donuluyor.`, 'success');
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

    const normalizedCourses = normalizeCourses(payload.courses as Course[]);
    setCourses(normalizedCourses);
    setTasks(payload.tasks.map(normalizeTask));
    setPerformanceData(normalizePerformanceData(Array.isArray(payload.performanceData) ? payload.performanceData : []));
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
    addToast('Veriler basariyla disa aktarildi.', 'success');
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
    setBadges([{ id: 'b1', name: 'Ilk Adim', description: 'Ilk gorevini tamamladin!', icon: BadgeCheck }]);
    setSuccessPoints(0);
    setIsParentLocked(true);
    setLoginError(null);
    addToast('Tum veriler basariyla silindi.', 'success');
  };

  const handleImportDataNew = async (file: File): Promise<boolean> => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const ok = applyImportedData(json);
      if (ok) {
        addToast('Veriler basariyla ice aktarildi.', 'success');
      } else {
        addToast('Gecersiz yedek dosyasi: gerekli alanlar eksik veya hatali.', 'error');
      }
      return ok;
    } catch (error) {
      console.error('Import error:', error);
      addToast('Yedek dosyasi okunamadi veya JSON formati gecersiz.', 'error');
      return false;
    }
  };

  const generateReport = async (period: 'Haftal\u0131k' | 'Ayl\u0131k' | 'Y\u0131ll\u0131k' | 'T\u00fcm Zamanlar'): Promise<ReportData | null> => {
    const now = new Date();
    const startDate = new Date(now);

    if (period === 'Haftal\u0131k') startDate.setDate(now.getDate() - 7);
    if (period === 'Ayl\u0131k') startDate.setMonth(now.getMonth() - 1);
    if (period === 'Y\u0131ll\u0131k') startDate.setFullYear(now.getFullYear() - 1);

    const completedTasks = tasks.filter((task) => {
      if (task.status !== 'tamamland\u0131' || !task.completionDate) return false;
      if (period === 'T\u00fcm Zamanlar') return true;
      const taskDate = new Date(`${task.completionDate}T00:00:00`);
      return taskDate >= startDate;
    });

    if (completedTasks.length === 0) {
      return {
        period,
        aiSummary: 'Secilen donem icin tamamlanmis gorev yok.',
        highlights: {
          mostImproved: 'Veri olustukca burada guclu alanlar gosterilecek.',
          needsFocus: 'Yeni tamamlanan gorevlerle odak alani hesaplanacak.',
        },
        aiSuggestion: 'Once duzenli gorev tamamlama akisini oturtalim, sonra daha derin analizler cikaracagiz.',
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
      aiSummary: `${completedTasks.length} gorev tamamlandi. Ortalama basari ${averageSuccess}, ortalama odak ${averageFocus}, toplam calisma ${totalMinutes} dakika.`,
      highlights: {
        mostImproved: strongest ? `${strongest.courseName} dersi su an en guclu alan. Ortalama basari ${Math.round(strongest.averageSuccess)}.` : 'Yeterli veri yok.',
        needsFocus: weakest ? `${weakest.courseName} dersi daha fazla tekrar istiyor. Ortalama basari ${Math.round(weakest.averageSuccess)}.` : 'Yeterli veri yok.',
      },
      aiSuggestion: weakest ? `${weakest.courseName} icin daha kisa ama daha sik calisma bloklari ve konu bazli tekrar gorevleri planlanmali.` : 'Duzenli plan ve gorev tamamlama devam etmeli.',
    };
  };

  const addCourse = (courseName: string) => {
    const randomIcon = ALL_ICONS[courses.length % ALL_ICONS.length];
    const newCourse: Course = {
      id: createId('course'),
      name: courseName,
      icon: randomIcon,
    };
    setCourses((prev) => [newCourse, ...prev]);
    setPerformanceData((prev) => [...prev, { courseId: newCourse.id, courseName, correct: 0, incorrect: 0, timeSpent: 0 }]);
  };

  const handleDeleteCourseRequest = (courseId: string) => {
    const course = courses.find((item) => item.id === courseId);
    if (!course) return;
    setCourseToDelete(course);
    setShowDeleteCourseModal(true);
  };

  const confirmDeleteCourse = () => {
    if (!courseToDelete) return;
    const deletedCourse = courseToDelete;
    setCourses((prev) => prev.filter((course) => course.id !== deletedCourse.id));
    setTasks((prev) => prev.filter((task) => task.courseId !== deletedCourse.id));
    setPerformanceData((prev) => prev.filter((item) => item.courseId !== deletedCourse.id));
    setCurriculum((prev) => {
      const next = { ...prev };
      delete next[deletedCourse.name];
      return next;
    });
    setStudyPlans((prev) => prev
      .map((storedPlan) => {
        if (!storedPlan.plan[deletedCourse.name]) return storedPlan;
        const nextPlan = { ...storedPlan.plan };
        delete nextPlan[deletedCourse.name];
        return { ...storedPlan, plan: nextPlan };
      })
      .filter((storedPlan) => Object.keys(storedPlan.plan).length > 0));
    setCourseToDelete(null);
    setShowDeleteCourseModal(false);
    addToast("'" + deletedCourse.name + "' dersi ve iliskili veriler silindi.", 'success');
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
      console.error('Tamamlanacak gorev bulunamadi:', taskId);
      return;
    }

    // Idempotency guard: ignore duplicate completion calls for already completed tasks.
    if (task.status === 'tamamlandı') {
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
      addToast('Bu odulu almak icin yeterli puaniniz yok.', 'error');
      window.setTimeout(() => rewardClaimLockRef.current.delete(rewardId), 250);
      return;
    }

    setSuccessPoints((prev) => prev - reward.cost);
    addToast(`'${reward.name}' odulu talep edildi.`, 'success');
    window.setTimeout(() => rewardClaimLockRef.current.delete(rewardId), 350);
  };

  const parentAnalysis = useMemo(
    () => deriveAnalysisSnapshot(tasks, courses, studyPlans, examRecords, compositeExamResults),
    [tasks, courses, studyPlans, examRecords, compositeExamResults],
  );
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
    const secondRun = deriveAnalysisSnapshot(tasks, courses, studyPlans, examRecords, compositeExamResults);
    return JSON.stringify(parentAnalysis) === JSON.stringify(secondRun);
  }, [tasks, courses, studyPlans, examRecords, compositeExamResults, parentAnalysis]);
  const parentSummary = useMemo(
    () => ({
      pendingCount: tasks.filter((task) => task.status === 'bekliyor').length,
      completedCount: tasks.filter((task) => task.status === 'tamamland\u0131').length,
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
        .filter((task) => task.status === 'tamamlandı' && getTaskCompletionSortValue(task) > 0)
        .sort((a, b) => getTaskCompletionSortValue(b) - getTaskCompletionSortValue(a))[0],
    }),
    [tasks, parentAnalysis, today, parentOverdueRate, parentFocus7d, parentAccuracyTrend14d, parentDeterminismPassed],
  );
  const parentRecommendation = useMemo(() => {
    if (!hasParentAnalysisData) {
      if (hasParentOperationalData) {
        return 'Gorev ve plan verisi mevcut; analiz onerisi icin once tamamlanan oturum birikmeli.';
      }
      return 'Analiz verisi olustukca bugune ait oneriler burada gosterilecek.';
    }
    if (parentSummary.overdueCount > 0) {
      return `Oncelik: takipteki ${parentSummary.overdueCount} gorevi tamamlayip ritmi toparla.`;
    }
    const firstWeak = parentSummary.weakTopics[0];
    if (firstWeak) {
      return `Oncelik: ${firstWeak.courseName} / ${firstWeak.topicName} icin 20-30 dk tekrar gorevi ata.`;
    }
    return 'Durum dengeli. Bugun mevcut plani koruyup duzenli devam et.';
  }, [hasParentAnalysisData, hasParentOperationalData, parentSummary.overdueCount, parentSummary.weakTopics]);
  const parentNetPerformance = useMemo(() => getNetPerformanceSummary({
    hasData: hasParentAnalysisData,
    averageMastery: parentAnalysis.overall.averageMastery,
    riskLevel: parentSummary.riskLevel,
    overdueCount: parentSummary.overdueCount,
    weakTopicCount: parentSummary.weakTopics.length,
  }), [hasParentAnalysisData, parentAnalysis.overall.averageMastery, parentSummary.riskLevel, parentSummary.overdueCount, parentSummary.weakTopics.length]);
  const accuracyTrendLabel = parentSummary.accuracyTrend14d.sampleSize === 0
    ? 'Henuz veri yok'
    : parentSummary.accuracyTrend14d.delta >= 5
      ? 'Yukseliyor'
      : parentSummary.accuracyTrend14d.delta <= -5
        ? 'Dusuyor'
        : 'Dengede';
  const analysisEmptyText = hasParentOperationalData
    ? 'Tamamlanan oturum olmadan analiz sinyali uretilmez.'
    : EMPTY_STATE_TEXT;
  const overviewPeriodMeta: Record<OverviewStudyPeriod, { label: string; hint: string }> = {
    month: { label: '1 Ay', hint: 'Son 30 gun' },
    quarter: { label: '3 Ay', hint: 'Son 90 gun' },
    total: { label: 'Total', hint: 'Tum tamamlanan calismalar' },
  };
  const overviewPeriodStartDate = useMemo(() => getOverviewPeriodStartDate(overviewStudyPeriod, today), [overviewStudyPeriod, today]);
  const overviewCompletedTasks = useMemo(() => {
    const endDate = toDate(today);
    return tasks.filter((task) => task.status === 'tamamlandı' && isTaskWithinRange(task, overviewPeriodStartDate, endDate));
  }, [tasks, overviewPeriodStartDate, today]);
  const overviewAnalysis = useMemo(
    () => deriveAnalysisSnapshot(overviewCompletedTasks, courses, studyPlans, examRecords, compositeExamResults),
    [overviewCompletedTasks, courses, studyPlans, examRecords, compositeExamResults],
  );
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
        return 'Secili donemde yeterli tamamlanan calisma biriktikce daha net yorum gosterilecek.';
      }
      return 'Calisma verisi olustukca secili donem ozeti burada gosterilecek.';
    }
    if (parentSummary.overdueCount > 0) {
      return `Genel tabloda ${parentSummary.overdueCount} takipteki gorev var. Donemsel gelisim korunurken once bunlari tamamlamak gerekir.`;
    }
    const firstWeak = overviewSummary.weakTopics[0];
    if (firstWeak) {
      return `${firstWeak.courseName} / ${firstWeak.topicName} secili donemde destek istiyor. Kisa tekrar gorevi ile guclendirilmeli.`;
    }
    return 'Secili donemde calisma ritmi dengeli gorunuyor. Mevcut akisi koruyabilirsiniz.';
  }, [hasOverviewAnalysisData, hasParentOperationalData, parentSummary.overdueCount, overviewSummary.weakTopics]);
  const overviewNetPerformance = useMemo(() => getNetPerformanceSummary({
    hasData: hasOverviewAnalysisData,
    averageMastery: overviewSummary.averageMastery,
    riskLevel: overviewRiskLevel,
    overdueCount: parentSummary.overdueCount,
    weakTopicCount: overviewSummary.weakTopics.length,
  }), [hasOverviewAnalysisData, overviewSummary.averageMastery, overviewRiskLevel, parentSummary.overdueCount, overviewSummary.weakTopics.length]);
  const overviewAccuracyTrendLabel = overviewAccuracyTrend.sampleSize === 0
    ? 'Henuz veri yok'
    : overviewAccuracyTrend.delta >= 5
      ? 'Yukseliyor'
      : overviewAccuracyTrend.delta <= -5
        ? 'Dusuyor'
        : 'Dengede';
  const overviewEmptyText = hasParentOperationalData
    ? 'Secili donemde analiz cikaracak kadar tamamlanan calisma yok.'
    : EMPTY_STATE_TEXT;

  const dynamicTargetByCourseId = useMemo(() => {
    const map = new Map<string, number>();

    for (const course of parentAnalysis.courses) {
      const base = course.averageMastery;
      const riskFactor = Math.max(0, Math.min(15, Math.round(course.averageRisk / 6)));
      const adaptiveTarget = base >= 85
        ? Math.min(95, base + 3)
        : base >= 70
          ? Math.min(90, base + 7)
          : Math.min(85, base + 10 - Math.floor(riskFactor / 2));
      map.set(course.courseId, Math.max(55, Math.min(95, adaptiveTarget)));
    }

    return map;
  }, [parentAnalysis.courses]);
  const overviewTargetByCourseId = useMemo(() => {
    const map = new Map<string, number>();

    for (const course of overviewAnalysis.courses) {
      const base = course.averageMastery;
      const riskFactor = Math.max(0, Math.min(15, Math.round(course.averageRisk / 6)));
      const adaptiveTarget = base >= 85
        ? Math.min(95, base + 3)
        : base >= 70
          ? Math.min(90, base + 7)
          : Math.min(85, base + 10 - Math.floor(riskFactor / 2));
      map.set(course.courseId, Math.max(55, Math.min(95, adaptiveTarget)));
    }

    return map;
  }, [overviewAnalysis.courses]);
  const overviewQuestionDistribution = useMemo(() => {
    const totals = new Map<string, number>();

    overviewCompletedTasks
      .filter((task) => task.taskType === 'soru çözme')
      .forEach((task) => {
        const answered = typeof task.correctCount === 'number' || typeof task.incorrectCount === 'number'
          ? (task.correctCount || 0) + (task.incorrectCount || 0)
          : (task.questionCount || 0);
        if (answered <= 0) return;
        totals.set(task.courseId, (totals.get(task.courseId) || 0) + answered);
      });

    const totalQuestions = [...totals.values()].reduce((sum, value) => sum + value, 0);
    const palette = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];

    return [...totals.entries()]
      .map(([courseId, questionCount], index) => ({
        courseId,
        courseName: courses.find((course) => course.id === courseId)?.name || courseId,
        questionCount,
        percentage: totalQuestions > 0 ? Math.round((questionCount / totalQuestions) * 100) : 0,
        barClassName: palette[index % palette.length],
      }))
      .sort((a, b) => b.questionCount - a.questionCount)
      .slice(0, 4);
  }, [overviewCompletedTasks, courses]);

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
        detail: 'Mufredat, plan ve konu baglantilari',
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
        subtitle: task.status === 'tamamlandı' ? 'Tamamlanan gorev' : 'Bekleyen gorev',
        detail: [courseName, unit, topic, `${task.plannedDuration} dk`].filter(Boolean).join(' / '),
        view: 'tasks',
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
        subtitle: 'Okul sinavi',
        detail: `${record.courseName} / ${record.date} / ${record.score}`,
        view: 'tasks',
      }, [record.title, record.courseName, record.date, record.notes, record.score].join(' '));
    });

    compositeExamResults.forEach((record) => {
      addResult({
        id: `composite:${record.id}`,
        scope: 'exams',
        title: record.title,
        subtitle: 'Genel sinav',
        detail: `${record.date}${record.totalScore ? ` / ${record.totalScore}` : ''}`,
        view: 'tasks',
      }, [record.title, record.date, record.notes, record.totalScore, ...record.courses.map((course) => course.courseName)].join(' '));
    });

    rewards.forEach((reward) => {
      addResult({
        id: `reward:${reward.id}`,
        scope: 'rewards',
        title: repairedText(reward.name),
        subtitle: 'Odul',
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
    const suggestions = [
      overviewSummary.weakTopics[0]?.topicName,
      overviewSummary.lastCompletedTask?.title,
      courses[0]?.name,
      tasks.find((task) => task.status === 'bekliyor')?.title,
    ].map((item) => repairedText(item)).filter(Boolean);

    return [...new Set(suggestions)].slice(0, 4);
  }, [courses, overviewSummary.lastCompletedTask, overviewSummary.weakTopics, tasks]);

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
    addToast('Ders programi duzenleme ekranina yonlendirildi.', 'success');
  };

  const handleOverviewAssignTask = () => {
    setParentWorkspaceView('tasks');
    addToast('Gorev yonetimi ekranina yonlendirildi.', 'success');
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
        title: 'Takipteki gorevler',
        description: `${parentSummary.overdueCount} gorev tamamlanmayi bekliyor`,
        visible: parentSummary.overdueCount > 0,
        action: () => {
          setParentWorkspaceView('tasks');
          addToast('Takipteki gorevler acildi.', 'success');
        },
      },
      {
        key: `weak:${parentSummary.weakTopics.length}`,
        title: 'Odak konusu bildirimi',
        description: `${parentSummary.weakTopics.length} konu tekrar istiyor`,
        visible: parentSummary.weakTopics.length > 0,
        action: () => {
          setParentWorkspaceView('analysis');
          addToast('Odak konulari analizi acildi.', 'success');
        },
      },
      {
        key: `focus:${parentSummary.focus7d ?? -1}`,
        title: 'Odak kontrolu',
        description: parentSummary.focus7d !== null ? `Son 7 gun ortalama odak: ${parentSummary.focus7d}` : 'Odak verisi olustukca burada gosterilecek',
        visible: parentSummary.focus7d !== null,
        action: () => {
          setParentWorkspaceView('analysis');
          addToast('Odak analizi acildi.', 'success');
        },
      },
    ];

    return items.filter((item) => item.visible);
  }, [parentSummary.overdueCount, parentSummary.weakTopics.length, parentSummary.focus7d]);

  const unreadNotificationItems = useMemo(
    () => notificationItems.filter((item) => !dismissedNotificationKeys.includes(item.key)),
    [notificationItems, dismissedNotificationKeys],
  );

  const handleNotificationAction = (item: { key: string; action: () => void }) => {
    item.action();
    setDismissedNotificationKeys((prev) => (prev.includes(item.key) ? prev : [...prev, item.key]));
    setNotificationsOpen(false);
  };

  const handleMarkAllNotificationsRead = () => {
    setDismissedNotificationKeys((prev) => {
      const keys = notificationItems.map((item) => item.key);
      return Array.from(new Set([...prev, ...keys]));
    });
    addToast('Tum bildirimler okundu olarak isaretlendi.', 'success');
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

  const renderParentWorkspace = () => {
    if (parentWorkspaceView === 'planning') {
      return (
        <div className="space-y-6">
          <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">Akademik Planlama</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">Mufredati tanimla, haftalik ders akisini onayla, sonra plan motoruyla gorev uret.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-3">
              <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">1. Mufredat Editoru dersleri tanimlar</div>
              <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">2. Haftalik ders akisi gun ve saatleri sabitler</div>
              <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">3. Planlama motoru gorevleri uretir</div>
            </div>
          </section>

          <div className="space-y-6">
            <WeeklySchedulePanel schedule={weeklySchedule} courses={courses} onSave={setWeeklySchedule} />

            <div className="space-y-6">
              <PlanningPanel
                curriculum={curriculum}
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
                onChangePlans={setStudyPlans}
                onChangeExamSchedules={setExamScheduleEntries}
              />
              <CurriculumManagerPanel curriculum={curriculum} onSave={setCurriculum} />
            </div>
          </div>
        </div>
      );
    }

    if (parentWorkspaceView === 'tasks') {
      return (
        <div className="space-y-6">
          <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">Gorev Atama ve Takip</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">Yeni gorev olustur, bekleyenleri yonet ve takipteki gorevleri tamamlat.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-700">Bekleyen {parentSummary.pendingCount}</span>
              <span className="rounded-full bg-rose-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-rose-700">Takipte {parentSummary.overdueCount}</span>
            </div>
          </section>
          <ParentDashboard
            courses={courses}
            tasks={tasks}
            performanceData={performanceData}
            rewards={rewards}
            successPoints={successPoints}
            examRecords={examRecords}
            compositeExamResults={compositeExamResults}
            studyPlans={studyPlans}
            curriculum={curriculum}
            ai={ai}
            addCourse={addCourse}
            deleteCourse={handleDeleteCourseRequest}
            addTask={addTask}
            deleteTask={deleteTask}
            addReward={addReward}
            deleteReward={deleteReward}
            generateReport={generateReport}
            onExportData={handleExportData}
            onDeleteAllData={handleDeleteAllData}
            onImportData={handleImportDataNew}
            onChangeExamRecords={setExamRecords}
            onChangeCompositeExamResults={setCompositeExamResults}
            loading={false}
            error={null}
            viewMode="tasks"
          />
        </div>
      );
    }

    if (parentWorkspaceView === 'analysis') {
      return (
        <div className="space-y-6">
          <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">Analiz ve Destek Takibi</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">Tamamlanan oturumlardan uretilen performans ve odak konusu sinyallerini incele.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-700">Analiz oturumu {analyzedSessionCount}</span>
              <span className="rounded-full bg-amber-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-amber-700">Odak konusu {parentSummary.weakTopics.length}</span>
            </div>
          </section>
          <ParentDashboard
            courses={courses}
            tasks={tasks}
            performanceData={performanceData}
            rewards={rewards}
            successPoints={successPoints}
            examRecords={examRecords}
            compositeExamResults={compositeExamResults}
            studyPlans={studyPlans}
            curriculum={curriculum}
            ai={ai}
            addCourse={addCourse}
            deleteCourse={handleDeleteCourseRequest}
            addTask={addTask}
            deleteTask={deleteTask}
            addReward={addReward}
            deleteReward={deleteReward}
            generateReport={generateReport}
            onExportData={handleExportData}
            onDeleteAllData={handleDeleteAllData}
            onImportData={handleImportDataNew}
            onChangeExamRecords={setExamRecords}
            onChangeCompositeExamResults={setCompositeExamResults}
            loading={false}
            error={null}
            viewMode="analysis"
          />
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-slate-900">Anlik Ogrenci Pozisyonu</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">Ebeveyn paneli durum ozeti</p>
          </div>
          <div className="ios-panel flex items-center gap-2 rounded-[20px] p-1">
            {(['month', 'quarter', 'total'] as OverviewStudyPeriod[]).map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setOverviewStudyPeriod(period)}
                className={`rounded-[16px] px-4 py-1.5 text-xs font-semibold transition-all ${overviewStudyPeriod === period ? 'ios-button-active' : 'text-slate-500 hover:bg-white/50'}`}
              >
                {overviewPeriodMeta[period].label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Operasyon Ozeti</h3>
            <p className="mt-1 text-sm text-slate-500">Anlik gorev ve panel yogunlugu.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="ios-widget ios-blue rounded-[24px] p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ders</p>
            <div className="mt-2 text-3xl font-black text-slate-900">{courses.length}</div>
          </div>
          <div className="ios-widget ios-peach rounded-[24px] p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Bekleyen</p>
            <div className="mt-2 text-3xl font-black text-slate-900">{parentSummary.pendingCount}</div>
          </div>
          <div className="ios-widget ios-mint rounded-[24px] p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tamamlanan</p>
            <div className="mt-2 text-3xl font-black text-emerald-600">{parentSummary.completedCount}</div>
          </div>
          <div className="ios-widget ios-lilac rounded-[24px] p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Mevcut Puan</p>
            <div className="mt-2 text-3xl font-black text-blue-700">{successPoints}</div>
          </div>
          </div>
        </section>

        <section className="grid grid-cols-12 gap-6">
          <div className="col-span-12 flex flex-col gap-6 lg:col-span-8">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="ios-widget ios-blue flex min-h-[140px] flex-col justify-between rounded-[24px] p-4">
                <p className="text-xs font-semibold text-slate-500">Degerlendirilen Calisma</p>
                <span className="text-2xl font-bold text-slate-900">{overviewAnalyzedSessionCount}</span>
              </div>
              <div className="ios-widget ios-mint flex min-h-[140px] flex-col justify-between rounded-[24px] p-4">
                <p className="text-xs font-semibold text-slate-500">Derslerde Genel Durum</p>
                <span className="text-sm font-medium text-slate-400">{hasOverviewAnalysisData ? overviewSummary.averageMastery : 'Bekleniyor'}</span>
              </div>
              <div className="ios-widget ios-lilac flex min-h-[140px] flex-col justify-between rounded-[24px] p-4">
                <p className="text-xs font-semibold text-slate-500">Secili Donemde Dikkat</p>
                <span className="text-sm font-medium text-slate-400">{overviewFocusAverage ?? 'Bekleniyor'}</span>
              </div>
              <div className="ios-widget ios-peach flex min-h-[140px] flex-col justify-between rounded-[24px] p-4">
                <p className="text-xs font-semibold text-slate-500">Soru Basarisi</p>
                <span className="text-sm font-medium text-slate-400">{overviewAccuracyTrendLabel}</span>
              </div>
              <div className="ios-widget flex min-h-[140px] flex-col justify-between rounded-[24px] p-4">
                <p className="text-xs font-semibold text-slate-500">Tamamlanan Calisma</p>
                <span className="text-2xl font-bold text-slate-900">{overviewSummary.completedCount}</span>
              </div>
              <div className="ios-widget flex min-h-[140px] flex-col justify-between rounded-[24px] p-4">
                <p className="text-xs font-semibold text-slate-500">Toplam Calisma Suresi</p>
                <span className="text-2xl font-bold text-slate-900">{overviewSummary.studiedMinutes} <span className="text-xs font-normal">dk</span></span>
              </div>
              <div className="ios-widget flex min-h-[140px] flex-col justify-between rounded-[24px] p-4">
                <p className="text-xs font-semibold text-slate-500">Cozulen Soru</p>
                <span className="text-2xl font-bold text-slate-900">{overviewSummary.solvedQuestionCount}</span>
              </div>
              <div className="ios-widget flex min-h-[140px] flex-col justify-between rounded-[24px] p-4">
                <p className="text-xs font-semibold text-slate-500">Genel Total Performans</p>
                <span className="text-sm font-medium text-slate-400">{hasOverviewAnalysisData ? overviewSummary.generalScore : 'Bekleniyor'}</span>
              </div>
            </div>

            <div className="ios-card relative flex min-h-[300px] flex-col items-center justify-center overflow-hidden rounded-[32px] p-8 text-center">
              <div className="absolute inset-0 opacity-70">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(90,167,255,0.24),transparent_34%),radial-gradient(circle_at_80%_30%,rgba(167,139,250,0.20),transparent_30%)]" />
              </div>
              {overviewSummary.allCourses.length === 0 ? (
                <>
                  <BarChart className="mb-4 h-12 w-12 text-slate-400" />
                  <h3 className="mb-3 text-xl font-bold text-slate-900">Veri bekleniyor...</h3>
                  <p className="max-w-md text-sm text-slate-500">{overviewEmptyText}</p>
                </>
              ) : (
                <div className="relative z-10 w-full space-y-6 text-left">
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-slate-900">{overviewNetPerformance.title}</h3>
                    <p className="mt-2 text-sm text-slate-500">{overviewRecommendation}</p>
                  </div>
                  <div className="flex h-44 items-end justify-between gap-3 px-2">
                    {overviewSummary.allCourses.slice(0, 6).map((course) => (
                      <div key={`hero-${course.courseId}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                          <div className="relative h-36 w-full overflow-hidden rounded-t-[18px] bg-white/70">
                          <div className="absolute bottom-0 left-0 w-full rounded-t-[18px] bg-[#8AB4FF]/85" style={{ height: `${Math.max(10, Math.min(100, course.averageMastery))}%` }} />
                        </div>
                        <div className="max-w-full truncate text-[10px] font-bold text-slate-500">{course.courseName}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="col-span-12 flex flex-col gap-6 lg:col-span-4">
            <div className="ios-ink group relative overflow-hidden rounded-[30px] p-6 text-white">
              <div className="relative z-10">
                <h3 className="mb-2 text-lg font-bold">Bugun ne yapalim?</h3>
                <p className="mb-4 text-sm text-white/80">Ogrenci icin yeni bir hedef belirleyin veya son calismalari gozden gecirin.</p>
                <button onClick={handleOverviewAssignTask} className="ios-button-active flex items-center gap-2 rounded-[18px] px-4 py-2 text-sm font-bold transition-all group-hover:gap-3">
                  Gorev Listesi <span aria-hidden="true">&gt;</span>
                </button>
              </div>
              <div className="absolute -bottom-4 -right-4 text-[110px] font-black leading-none text-white/10">+</div>
            </div>

            <div className="ios-widget ios-coral flex items-center justify-between rounded-[26px] p-6">
              <div className="flex items-center gap-4">
                <div className="rounded-[18px] bg-white/65 p-3 text-rose-500">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">Takipteki Gorev</h4>
                  <p className="text-xs text-slate-500">{parentSummary.overdueCount === 0 ? 'Destek bekleyen calisma yok' : 'Destek bekleyen calisma var'}</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-slate-900">{parentSummary.overdueCount}</span>
            </div>

            <div className="ios-card rounded-[30px] p-6">
              <h4 className="mb-6 text-sm font-bold">Tum Dersler Performans Durumu</h4>
              <div className="flex h-48 items-end justify-between gap-2 px-2">
                {overviewSummary.allCourses.length === 0
                  ? Array.from({ length: 6 }).map((_, index) => (
                      <div key={`placeholder-${index}`} className="w-full rounded-t-[16px] bg-white/60 transition-all" style={{ height: `${[20, 15, 25, 10, 30, 5][index]}%` }} />
                    ))
                  : overviewSummary.allCourses.slice(0, 6).map((course) => (
                      <div key={`side-${course.courseId}`} className="w-full rounded-t-[16px] bg-[#C4B5FD]/55 transition-all hover:bg-[#8AB4FF]/70" style={{ height: `${Math.max(8, Math.min(100, course.averageMastery))}%` }} />
                    ))}
              </div>
              <div className="mt-4 flex justify-center">
                <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400">{overviewSummary.allCourses.length === 0 ? 'Henuz yeterli veri yok' : 'Secili donem ozeti'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="ios-widget rounded-[26px] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-sm font-bold">Son Aktivite</h4>
                  <Clock className="h-4 w-4 text-slate-400" />
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-slate-300" />
                    <p className="text-xs text-slate-400 italic">{overviewSummary.lastCompletedTask ? `${overviewSummary.lastCompletedTask.title} - ${getTaskCompletionLabel(overviewSummary.lastCompletedTask)}` : 'Kayitli aktivite bulunamadi.'}</p>
                  </div>
                </div>
              </div>
              <div className="ios-widget rounded-[26px] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-sm font-bold">Odak Konulari</h4>
                  <Sparkles className="h-4 w-4 text-slate-400" />
                </div>
                <div className="flex flex-col gap-3">
                  {overviewSummary.weakTopics.length === 0 ? (
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-slate-300" />
                      <p className="text-xs text-slate-400 italic">Analiz asamasinda...</p>
                    </div>
                  ) : (
                    overviewSummary.weakTopics.slice(0, 3).map((topic) => (
                      <div key={`weak-${topic.key}`} className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-rose-300" />
                        <p className="truncate text-xs text-slate-500">{topic.courseName} / {topic.topicName}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    );
  };

  return (
    <div className={`min-h-screen ${themeMode === 'dark' ? 'dr-theme-dark' : 'dr-theme-light'}`}>
      <header className={`dr-topbar dr-toolbar fixed left-0 right-0 top-0 z-50 border-b ${userType === UserType.Parent && !isParentLocked && parentSidebarOpen ? 'xl:left-64' : ''}`}>
        <div className="flex h-20 items-center justify-between gap-2 px-3 md:gap-4 md:px-8">
          <div className="flex min-w-0 items-center gap-6">
            {userType === UserType.Parent && !isParentLocked ? (
              <>
                <div className="hidden xl:block">
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">DersRotasi</div>
                  <div className="text-lg font-black text-slate-900">Ebeveyn Paneli</div>
                </div>
                <nav className="dr-toolbar-group hidden xl:flex" aria-label="Ebeveyn modulleri">
                  {parentTopNavItems.map((item) => {
                    const active = parentWorkspaceView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setParentWorkspaceView(item.id)}
                        aria-current={active ? 'page' : undefined}
                        className={`h-10 rounded-[18px] px-4 text-sm font-semibold transition-all ${active ? 'ios-button-active text-slate-900' : 'text-slate-600 hover:bg-white/55 hover:text-slate-900'}`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
              </>
            ) : (
              <div className="hidden min-w-0 sm:block">
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">DersRotasi</div>
                <div className="text-lg font-black text-slate-900">{userType === UserType.Parent ? 'Ebeveyn Paneli' : 'Cocuk Paneli'}</div>
              </div>
            )}
          </div>
          <div ref={topbarToolbarRef} onKeyDown={handleToolbarKeyDown} className="flex items-center gap-2 sm:gap-4" role="toolbar" aria-label="Uygulama komutlari">
            {!(userType === UserType.Parent && !isParentLocked) && (
              <>
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
                  aria-label="Hizli eylemleri ac"
                  aria-haspopup="menu"
                  aria-expanded={quickActionsOpen}
                  title="Hizli eylemler"
                  className="dr-pulldown-button h-11 px-3 text-sm font-bold sm:px-4"
                >
                  <PlusCircle className="h-5 w-5" />
                  <span className="hidden whitespace-nowrap lg:inline">Hizli Eylem</span>
                  <ChevronDown className="h-4 w-4 opacity-70" />
                </button>
                {quickActionsOpen && (
                  <div className="dr-context-menu" role="menu" aria-label="Hizli eylemler">
                    <div className="dr-context-menu-preview">En sik kullanilan islemler</div>
                    <button type="button" role="menuitem" className="dr-context-menu-item" onClick={() => handleQuickAction('tasks', 'Gorev yonetimi acildi.')}>
                      <ClipboardList className="h-4 w-4" />
                      Gorev ata
                      <span className="dr-menu-meta">Ana</span>
                    </button>
                    <button type="button" role="menuitem" className="dr-context-menu-item" onClick={() => handleQuickAction('planning', 'Akademik planlama acildi.')}>
                      <Sparkles className="h-4 w-4" />
                      Planlama ac
                    </button>
                    <div className="dr-menu-divider" />
                    <button type="button" role="menuitem" className="dr-context-menu-item" onClick={() => handleQuickAction('analysis', 'Analiz ve raporlar acildi.')}>
                      <BarChart className="h-4 w-4" />
                      Analizleri gor
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="dr-toolbar-group relative inline-flex shrink-0 rounded-full" aria-label="Kullanici modu">
              <button onClick={() => handleUserTypeChange(UserType.Parent)} aria-pressed={userType === UserType.Parent} title="Ebeveyn modu" className={`relative z-10 flex h-8 w-[4.25rem] items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 sm:w-24 sm:text-sm ${userType === UserType.Parent ? 'ios-button-active text-slate-900' : 'text-slate-600 hover:bg-white/50'}`}>
                Ebeveyn
              </button>
              <button onClick={() => handleUserTypeChange(UserType.Child)} aria-pressed={userType === UserType.Child} title="Cocuk modu" className={`relative z-10 flex h-8 w-[4.25rem] items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 sm:w-24 sm:text-sm ${userType === UserType.Child ? 'ios-button-active text-slate-900' : 'text-slate-600 hover:bg-white/50'}`}>
                Cocuk
              </button>
            </div>
            <button
              type="button"
              onClick={handleThemeToggle}
              aria-label={themeMode === 'dark' ? 'Acik temaya gec' : 'Koyu temaya gec'}
              aria-pressed={themeMode === 'dark'}
              title={themeMode === 'dark' ? 'Tema: Koyu' : 'Tema: Acik'}
              className="ios-button flex h-11 shrink-0 items-center gap-2 rounded-full px-3 text-slate-600 transition hover:text-slate-900"
            >
              <Lightbulb className="h-5 w-5" />
              <span className="hidden text-xs font-bold md:inline">{themeMode === 'dark' ? 'Koyu' : 'Acik'}</span>
            </button>
            <div className="dr-toolbar-group" aria-label="Yardimci komutlar">
            {(userType === UserType.Child || (userType === UserType.Parent && !isParentLocked)) && <div ref={topbarSearchRef} className="relative">
              <div className={`ios-button flex h-11 items-center gap-2 rounded-full px-3 transition-all ${searchOpen ? 'w-[22rem]' : 'w-11 justify-center'}`}>
                <Search className="h-5 w-5 text-slate-500" />
                {searchOpen && (
                  <>
                    <input
                      value={globalSearchQuery}
                      onChange={(event) => setGlobalSearchQuery(event.target.value)}
                      placeholder="Gorev, ders, konu, sinav veya odul"
                      className="min-h-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                      autoFocus
                    />
                    {globalSearchQuery && (
                      <button type="button" onClick={() => setGlobalSearchQuery('')} className="flex h-8 min-h-8 w-8 items-center justify-center rounded-full text-slate-500" aria-label="Aramayi temizle">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </>
                )}
                {!searchOpen && (
                  <button type="button" onClick={handleOpenGlobalSearch} className="absolute inset-0 rounded-full" aria-label="Uygulama icinde ara" title="Ara - Ctrl veya Command K" />
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
                      <div className="ios-widget rounded-[20px] px-4 py-5 text-sm text-slate-500">Sonuc bulunamadi. Daha genel bir kelime ya da farkli kapsam deneyin.</div>
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
                  <div className="mt-3 text-[11px] leading-5 text-slate-500">Arama gecmisi tutulmaz; oneriler mevcut gorev, ders ve analiz baglamindan uretilir.</div>
                </div>
              )}
            </div>}
            {userType === UserType.Parent && !isParentLocked && <div ref={topbarNotificationsRef} className="relative">
              <button onClick={() => { setNotificationsOpen((prev) => !prev); setSettingsOpen(false); setQuickActionsOpen(false); }} aria-label="Bildirimleri ac veya kapat" aria-expanded={notificationsOpen} title="Bildirimler" className="ios-button relative rounded-full p-2 text-slate-500 transition hover:text-slate-800">
                <Bell className="h-5 w-5" />
                {showNotificationDot && !notificationsMuted && unreadNotificationItems.length > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />}
              </button>
              {notificationsOpen && (
                <div className="ios-card absolute right-0 top-12 z-50 w-[min(20rem,calc(100vw-1.5rem))] rounded-[26px] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-bold text-slate-800">Bildirimler</div>
                    <button onClick={handleMarkAllNotificationsRead} className="ios-button rounded-full px-3 py-1 text-[11px] font-bold text-slate-700">Tumunu okundu yap</button>
                  </div>
                  {notificationsMuted ? (
                    <div className="ios-widget rounded-[18px] px-3 py-2 text-xs text-slate-500">Bildirimler sessizde.</div>
                  ) : unreadNotificationItems.length === 0 ? (
                    <div className="ios-widget rounded-[18px] px-3 py-2 text-xs text-slate-500">Yeni bildirim yok.</div>
                  ) : (
                    <div className="space-y-2">
                      {unreadNotificationItems.map((item) => (
                        <button key={item.key} onClick={() => handleNotificationAction(item)} className="ios-widget w-full rounded-[18px] px-3 py-2 text-left transition hover:bg-white/80">
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
              <button onClick={() => { setSettingsOpen((prev) => !prev); setNotificationsOpen(false); setQuickActionsOpen(false); }} aria-label="Uygulama ayarlarini ac veya kapat" aria-expanded={settingsOpen} title="Uygulama ayarlari" className="ios-button rounded-full p-2 text-slate-500 transition hover:text-slate-800">
                <Settings className="h-5 w-5" />
              </button>
            </div>}
            </div>
            <div className="ios-button hidden h-9 w-9 items-center justify-center overflow-hidden rounded-full text-slate-600 sm:flex">
              <User className="h-4 w-4" />
            </div>
              </>
            )}
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
                  <div className="ios-widget ios-blue mb-4 rounded-[26px] p-4" aria-label={`Ogrenci takibi. Tamamlanan ${parentSummary.completedCount} gorev`}>
                    <div className="mb-3 flex justify-center">
                      <div className="ios-button flex h-16 w-16 items-center justify-center rounded-full text-slate-700">
                        <User className="h-8 w-8" />
                      </div>
                    </div>
                    <h3 className="text-center font-bold text-slate-900">Ogrenci Takibi</h3>
                    <p className="text-center text-xs text-slate-500">Tamamlanan {parentSummary.completedCount} gorev</p>
                  </div>

                  <nav className="flex flex-1 flex-col gap-1">
                    {parentWorkspaceItems.filter((item) => primaryParentWorkspaceIds.includes(item.id)).map((item) => {
                      const Icon = item.icon;
                      const active = parentWorkspaceView === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
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
                aria-label={parentSidebarOpen ? 'Sol menuyu kapat' : 'Sol menuyu ac'}
              >
                {parentSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>

              <div className="dr-content-pad">
                <div className="mx-auto max-w-7xl">
                  <div className="min-w-0 space-y-4">
                    <div className="relative flex items-center justify-between xl:hidden">
                      <button onClick={() => setParentMenuOpen((prev) => !prev)} className="ios-button inline-flex items-center gap-2 rounded-[20px] px-4 py-3 text-sm font-semibold text-slate-700 xl:hidden">
                        {parentMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />} Moduller
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
                          aria-label="Kontrol merkezini ac veya kapat"
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
                          aria-label="Modul menusunu kapat"
                          onClick={() => setParentMenuOpen(false)}
                          className="absolute inset-0 bg-slate-950/30 backdrop-blur-sm"
                        />
                        <div className="ios-card absolute left-3 right-3 top-[calc(5rem+env(safe-area-inset-top))] max-h-[calc(100vh-6rem-env(safe-area-inset-bottom))] overflow-y-auto rounded-[28px] p-3">
                          <div className="space-y-4">
                            <div>
                              <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Kritik moduller</div>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {parentWorkspaceItems.filter((item) => primaryParentWorkspaceIds.includes(item.id)).map((item) => {
                              const Icon = item.icon;
                              const active = parentWorkspaceView === item.id;
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => {
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

              <Modal show={showDeleteCourseModal} onClose={() => setShowDeleteCourseModal(false)} title="Dersi Sil">
                <div className="space-y-4">
                  <p className="text-slate-700">
                    '{courseToDelete?.name}' dersini ve ilgili gorevleri ile analizleri silmek istediginize emin misiniz?
                  </p>
                  <div className="dr-button-row">
                    <button className="ios-button rounded-[16px] px-4 py-2 font-semibold text-slate-700" onClick={() => setShowDeleteCourseModal(false)}>
                      Vazgec
                    </button>
                    <button className="dr-destructive-button px-4 py-2 font-semibold" onClick={confirmDeleteCourse}>
                      Evet, Sil
                    </button>
                  </div>
                </div>
              </Modal>
            </>
          )
        ) : (
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
        )}
      </main>
      {settingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-slate-950/45 p-4 backdrop-blur-sm" role="presentation">
          <div ref={settingsPopoverRef} className="ios-card flex max-h-[min(42rem,calc(100dvh-2rem))] w-[min(30rem,100%)] flex-col overflow-hidden rounded-[28px] p-4" role="dialog" aria-modal="true" aria-label="Uygulama ayarlari">
            <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
              <div>
                <div className="text-base font-black text-slate-900">Uygulama Ayarlari</div>
                <div className="mt-1 text-xs text-slate-500">Tercihler bu cihaza kaydedilir.</div>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)} className="ios-button flex h-10 w-10 items-center justify-center rounded-full text-slate-600" aria-label="Ayarlari kapat">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="dr-modal-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1 text-xs">
              <div className="ios-widget rounded-[20px] p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Tema</div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setThemeMode('light')} className={`rounded-[16px] px-2 py-2 text-[11px] font-bold ${themeMode === 'light' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}>
                    Acik Mod
                  </button>
                  <button onClick={() => setThemeMode('dark')} className={`rounded-[16px] px-2 py-2 text-[11px] font-bold ${themeMode === 'dark' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}>
                    Karanlik Mod
                  </button>
                </div>
              </div>

              <div className="ios-widget rounded-[20px] p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Acilis</div>
                <button onClick={() => setRememberLastParentView((prev) => !prev)} className="ios-button flex w-full items-center justify-between rounded-[16px] px-3 py-2 text-left text-slate-700">
                  <span>Son modulu hatirla</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${rememberLastParentView ? 'ios-mint text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{rememberLastParentView ? 'Acik' : 'Kapali'}</span>
                </button>
              </div>

              <div className="ios-widget rounded-[20px] p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Bildirim</div>
                <button onClick={() => setNotificationsMuted((prev) => !prev)} className="ios-button flex w-full items-center justify-between rounded-[16px] px-3 py-2 text-left text-slate-700">
                  <span>Bildirimler</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${!notificationsMuted ? 'ios-mint text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{notificationsMuted ? 'Kapali' : 'Acik'}</span>
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
                  <span>Hafif titresim</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${hapticsEnabled ? 'ios-mint text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{hapticsEnabled ? 'Acik' : 'Kapali'}</span>
                </button>
              </div>

              <div className="ios-widget rounded-[20px] p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Program Ayarlari</div>
                <button onClick={handleOpenScheduleSettings} className="ios-button flex w-full items-center justify-between rounded-[16px] px-3 py-2 text-left text-slate-700">
                  <span>Ders Programini Degistir</span>
                  <span className="ios-blue rounded-full px-2 py-0.5 text-[10px] font-bold text-slate-700">Ac</span>
                </button>
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
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Kullanici</div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { handleUserTypeChange(UserType.Parent); setParentControlCenterOpen(false); }} className="ios-button-active rounded-[16px] px-2 py-2 font-bold text-slate-900">Ebeveyn</button>
                  <button type="button" onClick={() => { handleUserTypeChange(UserType.Child); setParentControlCenterOpen(false); }} className="ios-button rounded-[16px] px-2 py-2 font-bold text-slate-700">Cocuk</button>
                </div>
              </div>

              <div className="ios-widget rounded-[20px] p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Tema</div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setThemeMode('light')} className={`rounded-[16px] px-2 py-2 font-bold ${themeMode === 'light' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}>Acik</button>
                  <button type="button" onClick={() => setThemeMode('dark')} className={`rounded-[16px] px-2 py-2 font-bold ${themeMode === 'dark' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}>Koyu</button>
                </div>
              </div>

              <div className="ios-widget rounded-[20px] p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Hizli Gecis</div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => handleQuickAction('tasks', 'Gorev yonetimi acildi.')} className="ios-button rounded-[16px] px-2 py-2 font-bold text-slate-700">Gorevler</button>
                  <button type="button" onClick={() => handleQuickAction('planning', 'Akademik planlama acildi.')} className="ios-button rounded-[16px] px-2 py-2 font-bold text-slate-700">Planlama</button>
                  <button type="button" onClick={() => handleQuickAction('analysis', 'Analiz ve raporlar acildi.')} className="ios-button rounded-[16px] px-2 py-2 font-bold text-slate-700">Analiz</button>
                  <button type="button" onClick={() => handleQuickAction('overview', 'Genel bakis acildi.')} className="ios-button rounded-[16px] px-2 py-2 font-bold text-slate-700">Ozet</button>
                </div>
              </div>

              <div className="ios-widget rounded-[20px] p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Arama</div>
                <input
                  value={globalSearchQuery}
                  onChange={(event) => setGlobalSearchQuery(event.target.value)}
                  placeholder="Gorev, ders, konu veya odul"
                  className="ios-button w-full rounded-[16px] px-3 py-2 text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                />
                {globalSearchQuery && (
                  <div className="dr-modal-scroll mt-2 max-h-44 space-y-2 overflow-y-auto">
                    {globalSearchResults.length === 0 ? (
                      <div className="text-[11px] text-slate-500">Sonuc bulunamadi.</div>
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
                  <span className="text-sm font-black">{notificationsMuted ? 'Sessiz' : 'Acik'}</span>
                </button>
                <button type="button" onClick={() => { setSettingsOpen(true); setParentControlCenterOpen(false); }} className="ios-button rounded-[18px] px-3 py-3 text-left text-slate-700">
                  <span className="block text-[11px] font-bold uppercase text-slate-500">Ayarlar</span>
                  <span className="text-sm font-black">Ac</span>
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





























