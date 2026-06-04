import React, { useMemo, useState } from 'react';
import type { CurriculumUnit, ExamScheduleEntry, SubjectCurriculum, Task, WeeklySchedule, WeeklyScheduleSlot } from '../../types';
import { getQuestionMetrics } from '../../utils/questionMetrics';
import {
  AlertTriangle,
  BarChart,
  BookOpen,
  Calculator,
  CheckCircle,
  Clock,
  Dna,
  FileText,
  Globe,
  GraduationCap,
  Home,
  Play,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Trash2,
  User,
  X,
} from '../icons';
import ParentWorkspaceFrame from './ParentWorkspaceFrame';
import ContextHelp from '../shared/ContextHelp';

interface ParentOverviewSummary {
  completedCount: number;
  studiedMinutes: number;
  weakTopics: Array<{
    key: string;
    courseName: string;
    topicName: string;
  }>;
  lastCompletedTask: Task | null;
}

interface ParentOverviewWorkspaceProps {
  parentSummary: {
    pendingCount: number;
    overdueCount: number;
    completedCount: number;
  };
  overviewSummary: ParentOverviewSummary;
  overviewNextTask: Task | undefined;
  weeklySchedule?: WeeklySchedule;
  curriculum?: SubjectCurriculum;
  onWeeklyScheduleChange?: (schedule: WeeklySchedule) => void;
  overviewUpcomingExam: ExamScheduleEntry | undefined;
  overviewTodayName: string;
  overviewTodaySlots: WeeklyScheduleSlot[];
  overviewTodayOperational?: {
    plannedCount: number;
    completedTodayCount: number;
    pendingTodayCount: number;
    overdueCount: number;
  };
  overviewTodayCompletedTasks: Array<{
    id: string;
    title: string;
    courseName: string;
  }>;
  overviewWeakTopicActions: Array<{
    key: string;
    courseName: string;
    topicName: string;
    reason: string;
    action: string;
    taskStatus: string;
  }>;
  overviewCourseNames: string[];
  overviewWeeklyStats: {
    completedCount: number;
    completionTarget: number;
    completionPercent: number;
    totalMinutes: number;
    minuteChange: number;
    solvedQuestionCount: number;
    solvedQuestionChange: number;
    comparisonLabel: string;
    examDelta: number;
    hasExamTrendData: boolean;
    dailyAccuracyPoints: number[];
  };
  overviewCourseInsights: Array<{
    courseName: string;
    progress: number;
    weakCount: number;
    hasWeeklyData: boolean;
    change: number | null;
  }>;
  overviewTopicInsights: Array<{
    key: string;
    topicName: string;
    courseName: string;
    currentAccuracy: number | null;
    previousAccuracy: number | null;
    delta: number | null;
    riskScore: number | null;
  }>;
  overviewTopicMetricsMap: Record<string, {
    minutes: number;
    solved: number;
    accuracy: number;
    retryNeed: string;
    practicePerf: number;
    testPerf: number;
    dailyPerf: number;
    errors: Array<{
      label: string;
      value: number;
    }>;
  }>;
  overviewTopicPerformanceRows: Array<{
    key: string;
    courseName: string;
    unitName: string;
    topicName: string;
    totalQuestions: number;
    correctCount: number;
    incorrectCount: number;
    emptyCount: number;
    accuracyPercent: number;
    minutes: number;
    taskCount: number;
    lastCompletedAt: string;
  }>;
  overviewReportSeries: Array<{
    courseName: string;
    color: string;
    points: number[];
  }>;
  overviewStudyPeriod: 'week1' | 'week3' | 'month' | 'quarter' | 'total';
  onOverviewStudyPeriodChange: (period: 'week1' | 'week3' | 'month' | 'quarter' | 'total') => void;
  overviewSignal: {
    title: string;
    text: string;
    className: string;
  };
  overviewExamDecision: {
    title: string;
    detail: string;
    action: string;
    tone: string;
  };
  lastCompletedTaskLabel: string | null;
  onOpenPlanning: (message: string) => void;
  onOpenAnalysis: () => void;
}

const SUBJECT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  matematik: Calculator,
  turkce: BookOpen,
  'fen bilgisi': Dna,
  ingilizce: Globe,
};

const getCourseLabel = (weakCount: number) => {
  if (weakCount >= 3) return 'Tekrar gerekiyor';
  if (weakCount === 2) return 'Dikkat gerekli';
  if (weakCount === 1) return 'Stabil takip';
  return 'Iyi gidiyor';
};

const getCourseTone = (weakCount: number) => {
  if (weakCount >= 3) return 'text-rose-600';
  if (weakCount === 2) return 'text-amber-600';
  if (weakCount === 1) return 'text-blue-600';
  return 'text-emerald-600';
};

const getCourseProgress = (weakCount: number) => {
  if (weakCount >= 3) return 42;
  if (weakCount === 2) return 58;
  if (weakCount === 1) return 72;
  return 83;
};

const formatMinutes = (minutes: number) => {
  if (minutes <= 0) return '0 sa 0 dk';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} sa ${rest} dk`;
};

const getDeltaDisplay = (delta: number, comparisonLabel = 'haftaya') => {
  if (delta > 0) return { arrow: '↑', text: `Geçen ${comparisonLabel} göre +%${Math.abs(delta)}`, short: `+%${Math.abs(delta)}`, tone: 'text-emerald-600' };
  if (delta < 0) return { arrow: '↓', text: `Geçen ${comparisonLabel} göre -%${Math.abs(delta)}`, short: `-%${Math.abs(delta)}`, tone: 'text-rose-600' };
  return { arrow: '→', text: `Geçen ${comparisonLabel} göre %0`, short: '%0', tone: 'text-blue-600' };
};

const DAY_NAMES_ORDERED = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'] as const;

const CURRICULUM_PANEL_THEMES = [
  { key: 'blue', className: 'dr-curriculum-showcase-card-blue' },
  { key: 'green', className: 'dr-curriculum-showcase-card-green' },
  { key: 'orange', className: 'dr-curriculum-showcase-card-orange' },
  { key: 'purple', className: 'dr-curriculum-showcase-card-purple' },
] as const;

const getCurriculumTopicIndex = (curriculum: SubjectCurriculum | undefined, courseName: string, unitName?: string, topicName?: string) => {
  if (!curriculum || !unitName || !topicName) return -1;
  const normalizedCourseName = courseName.trim().toLocaleLowerCase('tr-TR');
  const matchingCourseKey = Object.keys(curriculum).find((key) => key.trim().toLocaleLowerCase('tr-TR') === normalizedCourseName);
  const units = matchingCourseKey ? curriculum[matchingCourseKey] : [];
  if (!Array.isArray(units)) return -1;
  let topicIndex = 0;
  for (const unit of units) {
    for (const topic of unit.topics || []) {
      const isMatch = unit.name.trim().toLocaleLowerCase('tr-TR') === unitName.trim().toLocaleLowerCase('tr-TR')
        && topic.name.trim().toLocaleLowerCase('tr-TR') === topicName.trim().toLocaleLowerCase('tr-TR');
      if (isMatch) return topicIndex;
      topicIndex += 1;
    }
  }
  return -1;
};

const ParentOverviewWorkspace: React.FC<ParentOverviewWorkspaceProps> = ({
  parentSummary,
  overviewSummary,
  overviewNextTask,
  weeklySchedule,
  curriculum,
  onWeeklyScheduleChange,
  overviewUpcomingExam,
  overviewTodayName,
  overviewTodaySlots,
  overviewTodayOperational,
  overviewTodayCompletedTasks,
  overviewWeakTopicActions,
  overviewCourseNames,
  overviewWeeklyStats,
  overviewCourseInsights,
  overviewTopicInsights,
  overviewTopicMetricsMap,
  overviewTopicPerformanceRows,
  overviewReportSeries,
  overviewStudyPeriod,
  onOverviewStudyPeriodChange,
  overviewSignal,
  overviewExamDecision,
  lastCompletedTaskLabel,
  onOpenPlanning,
  onOpenAnalysis,
}) => {
  const periodOptions: Array<{ value: 'week1' | 'week3' | 'month' | 'quarter' | 'total'; label: string }> = [
    { value: 'week1', label: '1H' },
    { value: 'week3', label: '3H' },
    { value: 'month', label: '1A' },
    { value: 'quarter', label: '3A' },
    { value: 'total', label: 'Genel' },
  ];
  const periodSummaryTitle = overviewStudyPeriod === 'month'
    ? 'Aylık özet'
    : overviewStudyPeriod === 'quarter'
      ? '3 Aylık özet'
      : overviewStudyPeriod === 'total'
        ? 'Genel özet'
        : 'Haftalık özet';
  const [reportCardTab, setReportCardTab] = useState<'general' | 'course' | 'topic' | 'time'>('general');
  const [selectedOverviewCourse, setSelectedOverviewCourse] = useState<string | null>(null);
  const [selectedOverviewTopic, setSelectedOverviewTopic] = useState<string | null>(null);
  const [performanceCourseFilter, setPerformanceCourseFilter] = useState<string>('AUTO');
  const [performanceUnitFilter, setPerformanceUnitFilter] = useState<string>('AUTO');
  const [performanceTopicFilter, setPerformanceTopicFilter] = useState<string>('AUTO');
  const [schoolCurriculumSlot, setSchoolCurriculumSlot] = useState<{ dayName: string; slotId: string } | null>(null);
  const [schoolUnitName, setSchoolUnitName] = useState('');
  const [schoolTopicName, setSchoolTopicName] = useState('');
  const [schoolCurriculumMessage, setSchoolCurriculumMessage] = useState<string | null>(null);
  const normalizeForLookup = (value: string) => value.trim().toLocaleLowerCase('tr-TR');
  const getCurriculumUnitsForCourse = (courseName: string): CurriculumUnit[] => {
    if (!curriculum || !courseName) return [];
    const directUnits = curriculum[courseName];
    if (Array.isArray(directUnits)) return directUnits;
    const normalizedCourseName = normalizeForLookup(courseName);
    const matchingKey = Object.keys(curriculum).find((key) => normalizeForLookup(key) === normalizedCourseName);
    const matchingUnits = matchingKey ? curriculum[matchingKey] : [];
    return Array.isArray(matchingUnits) ? matchingUnits : [];
  };
  const activeSchoolCurriculumDay = schoolCurriculumSlot && weeklySchedule ? weeklySchedule[schoolCurriculumSlot.dayName] : null;
  const activeSchoolCurriculumSlot = schoolCurriculumSlot && activeSchoolCurriculumDay
    ? activeSchoolCurriculumDay.slots.find((slot) => slot.id === schoolCurriculumSlot.slotId) || null
    : null;
  const schoolCurriculumUnits = activeSchoolCurriculumSlot ? getCurriculumUnitsForCourse(activeSchoolCurriculumSlot.courseName) : [];
  const schoolCurriculumTopics = schoolCurriculumUnits.find((unit) => unit.name === schoolUnitName)?.topics || [];
  const closeSchoolCurriculumEditor = () => {
    setSchoolCurriculumSlot(null);
    setSchoolUnitName('');
    setSchoolTopicName('');
  };
  const updateSchoolScheduleSlot = (
    dayName: string,
    slotId: string,
    updater: (slot: WeeklyScheduleSlot) => WeeklyScheduleSlot,
  ) => {
    if (!weeklySchedule || !onWeeklyScheduleChange) return;
    const currentDay = weeklySchedule[dayName];
    if (!currentDay) return;
    onWeeklyScheduleChange({
      ...weeklySchedule,
      [dayName]: {
        ...currentDay,
        slots: currentDay.slots.map((slot) => (slot.id === slotId ? updater(slot) : slot)),
      },
    });
  };
  const openSchoolCurriculumEditor = (dayName: string, slot: WeeklyScheduleSlot) => {
    if (!onWeeklyScheduleChange) return;
    setSchoolCurriculumSlot({ dayName, slotId: slot.id });
    setSchoolUnitName(slot.schoolUnitName || '');
    setSchoolTopicName(slot.schoolTopicName || '');
    setSchoolCurriculumMessage(null);
  };
  const toggleSchoolNotCovered = (dayName: string, slot: WeeklyScheduleSlot) => {
    const nextIsNotCovered = slot.schoolCurriculumStatus !== 'not-covered';
    updateSchoolScheduleSlot(dayName, slot.id, (current) => ({
      ...current,
      schoolCurriculumStatus: nextIsNotCovered ? 'not-covered' : undefined,
      schoolUnitName: nextIsNotCovered ? undefined : current.schoolUnitName,
      schoolTopicName: nextIsNotCovered ? undefined : current.schoolTopicName,
      schoolCurriculumUpdatedAt: new Date().toISOString(),
    }));
    if (nextIsNotCovered) {
      setSchoolUnitName('');
      setSchoolTopicName('');
    }
    setSchoolCurriculumMessage(nextIsNotCovered ? 'Konu islenmedi olarak kaydedildi.' : 'Islenmedi isareti kaldirildi.');
  };
  const saveSchoolCurriculum = () => {
    if (!schoolCurriculumSlot || !activeSchoolCurriculumSlot) return;
    if (!schoolUnitName || !schoolTopicName) {
      setSchoolCurriculumMessage('Unite ve konu secilmeden kayit yapilamaz.');
      return;
    }
    updateSchoolScheduleSlot(schoolCurriculumSlot.dayName, activeSchoolCurriculumSlot.id, (slot) => ({
      ...slot,
      schoolCurriculumStatus: 'covered',
      schoolUnitName,
      schoolTopicName,
      schoolCurriculumUpdatedAt: new Date().toISOString(),
    }));
    setSchoolCurriculumMessage('Okulda islenen konu kaydedildi.');
    window.setTimeout(closeSchoolCurriculumEditor, 350);
  };
  const clearSchoolCurriculum = () => {
    if (!schoolCurriculumSlot || !activeSchoolCurriculumSlot) return;
    updateSchoolScheduleSlot(schoolCurriculumSlot.dayName, activeSchoolCurriculumSlot.id, (slot) => ({
      ...slot,
      schoolCurriculumStatus: undefined,
      schoolUnitName: undefined,
      schoolTopicName: undefined,
      schoolCurriculumUpdatedAt: new Date().toISOString(),
    }));
    setSchoolUnitName('');
    setSchoolTopicName('');
    setSchoolCurriculumMessage('Okul konu girisi temizlendi.');
  };
  const riskItems = useMemo(
    () => overviewSummary.weakTopics.slice(0, 3).map((topic, index) => ({
      ...topic,
      rank: index + 1,
      risk: index === 0 ? 'Yuksek Risk' : index === 1 ? 'Orta Risk' : 'Dusuk Risk',
      riskTone: index === 0 ? 'bg-rose-50 text-rose-700' : index === 1 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700',
    })),
    [overviewSummary.weakTopics],
  );

  const courseCards = useMemo(() => {
    const dynamicCourses = overviewCourseNames.length > 0 ? overviewCourseNames : ['Matematik', 'Turkce', 'Fen Bilgisi', 'Ingilizce'];
    return dynamicCourses.map((courseName) => {
      const insight = overviewCourseInsights.find((item) => item.courseName === courseName);
      const weakCount = insight?.weakCount || 0;
      const key = courseName.toLocaleLowerCase('tr-TR');
      const Icon = SUBJECT_ICONS[key] || BookOpen;
      const hasWeeklyData = Boolean(insight?.hasWeeklyData);
      const change = insight?.change ?? 0;
      const delta = getDeltaDisplay(change);
      return {
        courseName,
        status: getCourseLabel(weakCount),
        statusTone: getCourseTone(weakCount),
        progress: insight?.progress ?? getCourseProgress(weakCount),
        hasWeeklyData,
        changeText: delta.short,
        changeTone: delta.tone,
        changeLabel: delta.text,
        changeArrow: delta.arrow,
        Icon,
      };
    });
  }, [overviewCourseInsights, overviewCourseNames]);

  const curriculumShowcaseCards = useMemo(() => {
    const schoolByCourse = new Map<string, {
      unitName?: string;
      topicName?: string;
      status?: 'covered' | 'not-covered';
      sortKey: string;
    }>();
    DAY_NAMES_ORDERED.forEach((dayName, dayIndex) => {
      const day = weeklySchedule?.[dayName];
      (day?.slots || []).forEach((slot) => {
        if (slot.schoolCurriculumStatus !== 'covered' && slot.schoolCurriculumStatus !== 'not-covered') return;
        const key = normalizeForLookup(slot.courseName || '');
        const sortKey = slot.schoolCurriculumUpdatedAt || `${String(dayIndex).padStart(2, '0')}-${slot.endTime || slot.startTime || '00:00'}`;
        const current = schoolByCourse.get(key);
        if (!current || sortKey >= current.sortKey) {
          schoolByCourse.set(key, {
            unitName: slot.schoolUnitName,
            topicName: slot.schoolTopicName,
            status: slot.schoolCurriculumStatus,
            sortKey,
          });
        }
      });
    });

    const childByCourse = new Map<string, {
      unitName?: string;
      topicName?: string;
      sortKey: string;
    }>();
    overviewTopicPerformanceRows.forEach((row) => {
      if (!row.courseName || !row.topicName) return;
      const hasStudentEvidence = Boolean(row.lastCompletedAt) || Number(row.taskCount || 0) > 0 || Number(row.totalQuestions || 0) > 0;
      if (!hasStudentEvidence) return;
      const key = normalizeForLookup(row.courseName);
      const sortKey = row.lastCompletedAt || `${row.taskCount}-${row.totalQuestions}`;
      const current = childByCourse.get(key);
      if (!current || sortKey >= current.sortKey) {
        childByCourse.set(key, {
          unitName: row.unitName,
          topicName: row.topicName,
          sortKey,
        });
      }
    });

    const sourceCards = courseCards.slice(0, 4);

    return sourceCards.map((course, index) => {
      const school = schoolByCourse.get(normalizeForLookup(course.courseName));
      const child = childByCourse.get(normalizeForLookup(course.courseName));
      const schoolIndex = school?.status === 'covered'
        ? getCurriculumTopicIndex(curriculum, course.courseName, school.unitName, school.topicName)
        : -1;
      const childIndex = getCurriculumTopicIndex(curriculum, course.courseName, child?.unitName, child?.topicName);
      const gap = schoolIndex >= 0 && childIndex >= 0 ? childIndex - schoolIndex : null;
      const statusKind = school?.status === 'not-covered'
        ? 'idle'
        : gap === null
          ? 'unknown'
          : gap > 0
            ? 'ahead'
            : gap < 0
              ? 'behind'
              : 'sync';
      const statusLabel = statusKind === 'ahead'
        ? `OKULUN ÖNÜNDE (+${Math.abs(gap || 0)} KONU)`
        : statusKind === 'behind'
          ? `OKULUN GERİSİNDE (-${Math.abs(gap || 0)} KONU)`
          : statusKind === 'sync'
            ? 'SENKRONİZE (AYNI KONU)'
            : school?.status === 'not-covered'
              ? 'OKULDA KONU İŞLENMEDİ'
              : 'TAKİP BEKLİYOR';
      return {
        ...course,
        theme: CURRICULUM_PANEL_THEMES[index % CURRICULUM_PANEL_THEMES.length],
        schoolTopic: school?.status === 'not-covered' ? 'Konu işlenmedi' : school?.topicName || 'Okul verisi girilmedi',
        childTopic: child?.topicName || 'Öğrenci çalışma verisi yok',
        gap,
        statusKind,
        statusLabel,
        lgsProgress: Math.max(0, Math.min(100, Math.round(course.progress || 0))),
      };
    });
  }, [courseCards, curriculum, overviewTopicPerformanceRows, weeklySchedule]);

  const weeklyCompletionTarget = Math.max(overviewWeeklyStats.completionTarget, 1);
  const weeklyCompletionPercent = Math.max(0, Math.min(100, overviewWeeklyStats.completionPercent));
  const minuteDelta = getDeltaDisplay(overviewWeeklyStats.minuteChange, overviewWeeklyStats.comparisonLabel);
  const solvedDelta = getDeltaDisplay(overviewWeeklyStats.solvedQuestionChange, overviewWeeklyStats.comparisonLabel);
  const examDelta = getDeltaDisplay(overviewWeeklyStats.examDelta);
  const accuracySparklinePath = useMemo(() => {
    const points = overviewWeeklyStats.dailyAccuracyPoints || [];
    if (points.length === 0) return '';
    const minX = 2;
    const maxX = 118;
    const step = points.length > 1 ? (maxX - minX) / (points.length - 1) : 0;
    return points
      .map((point, index) => {
        const x = minX + (step * index);
        const y = 28 - Math.min(24, Math.max(2, (point || 0) / 4));
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  }, [overviewWeeklyStats.dailyAccuracyPoints]);
  const normalizedReportSeries = useMemo(
    () => overviewReportSeries
      .filter((series) => series && typeof series.courseName === 'string')
      .map((series, index) => {
        const safePointsRaw = Array.isArray(series.points) ? series.points : [];
        const safePoints = [0, 1, 2, 3].map((pointIndex) => {
          const value = safePointsRaw[pointIndex];
          return Number.isFinite(value) ? Math.max(0, Math.min(100, Number(value))) : 0;
        });
        return {
          courseName: series.courseName || `Ders ${index + 1}`,
          color: series.color || '#64748B',
          points: safePoints,
        };
      }),
    [overviewReportSeries],
  );
  const headline = parentSummary.overdueCount > 0 ? 'Genel durumda dikkat gerekiyor' : 'Genel olarak iyi gidiyor';
  const headlineText = parentSummary.overdueCount > 0
    ? 'Bu hafta ritim var, ancak geciken gorevler nedeniyle plani sade tutup onceliklendirme yapmaliyiz.'
    : 'Bu hafta istikrarli performans var. Kritik konulari tek tek kapatarak ayni ritmi koruyabiliriz.';
  const todayOperational = overviewTodayOperational || {
    plannedCount: 0,
    completedTodayCount: 0,
    pendingTodayCount: 0,
    overdueCount: 0,
  };
  const completionRatio = todayOperational.plannedCount > 0
    ? Math.round((todayOperational.completedTodayCount / todayOperational.plannedCount) * 100)
    : 0;
  const reportMasteryAverage = useMemo(() => {
    if (!overviewCourseInsights.length) return 0;
    return Math.round(
      overviewCourseInsights.reduce((sum, item) => sum + item.progress, 0) / overviewCourseInsights.length,
    );
  }, [overviewCourseInsights]);
  const reportSeriesForChart = useMemo(() => {
    if (reportCardTab === 'topic') {
      return normalizedReportSeries.slice(0, 3);
    }
    if (reportCardTab === 'time') {
      if (normalizedReportSeries.length === 0) return [];
      const points = [0, 1, 2, 3].map((idx) => {
        const valid = normalizedReportSeries.map((series) => series.points[idx]).filter((value) => typeof value === 'number');
        if (!valid.length) return 0;
        return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
      });
      return [{ courseName: 'Toplam', color: '#0EA5E9', points }];
    }
    return normalizedReportSeries;
  }, [normalizedReportSeries, reportCardTab]);
  const safeReportSeriesForChart = useMemo(
    () => reportSeriesForChart
      .filter((series) => series && typeof series.courseName === 'string')
      .map((series, index) => {
        const rawPoints = Array.isArray(series.points) ? series.points : [];
        const points = [0, 1, 2, 3].map((pointIndex) => {
          const value = rawPoints[pointIndex];
          return Number.isFinite(value) ? Math.max(0, Math.min(100, Number(value))) : 0;
        });
        return {
          courseName: series.courseName || `Seri ${index + 1}`,
          color: series.color || '#64748B',
          points,
        };
      }),
    [reportSeriesForChart],
  );
  const courseReportSeriesForChart = useMemo(
    () => normalizedReportSeries.filter((series) => courseCards.some((course) => course.courseName === series.courseName)),
    [courseCards, normalizedReportSeries],
  );
  const topicImproving = useMemo(
    () => [...overviewTopicInsights]
      .filter((item) => item.delta !== null && (item.delta || 0) > 0)
      .sort((a, b) => (b.delta || 0) - (a.delta || 0))
      .slice(0, 3),
    [overviewTopicInsights],
  );
  const topicHard = useMemo(
    () => [...overviewTopicInsights]
      .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
      .slice(0, 3),
    [overviewTopicInsights],
  );
  const bestCourse = useMemo(
    () => [...overviewCourseInsights].filter((item) => item.hasWeeklyData).sort((a, b) => (b.change || 0) - (a.change || 0))[0] || null,
    [overviewCourseInsights],
  );
  const weakestCourse = useMemo(
    () => [...overviewCourseInsights].filter((item) => item.hasWeeklyData).sort((a, b) => (a.change || 0) - (b.change || 0))[0] || null,
    [overviewCourseInsights],
  );
  const overviewCoursesForDetail = useMemo(
    () => (overviewCourseInsights.length > 0 ? overviewCourseInsights : courseCards.map((item) => ({
      courseName: item.courseName,
      progress: item.progress,
      weakCount: 0,
      hasWeeklyData: item.hasWeeklyData,
      change: 0,
    }))),
    [courseCards, overviewCourseInsights],
  );
  const selectedCourseDetail = useMemo(
    () => overviewCoursesForDetail.find((course) => course.courseName === selectedOverviewCourse) || overviewCoursesForDetail[0] || null,
    [overviewCoursesForDetail, selectedOverviewCourse],
  );
  const selectedCourseTopics = useMemo(
    () => (selectedCourseDetail
      ? overviewTopicInsights.filter((topic) => topic.courseName === selectedCourseDetail.courseName)
      : []),
    [overviewTopicInsights, selectedCourseDetail],
  );
  const selectedTopicDetail = useMemo(
    () => selectedCourseTopics.find((topic) => topic.key === selectedOverviewTopic) || selectedCourseTopics[0] || null,
    [selectedCourseTopics, selectedOverviewTopic],
  );
  const selectedCourseTrend = useMemo(() => {
    const series = selectedCourseDetail
      ? normalizedReportSeries.find((item) => item.courseName === selectedCourseDetail.courseName)
      : null;
    const points = series?.points?.slice(0, 4) || [];
    if (points.length === 4) return points.map((value) => Math.max(0, Math.min(100, value)));
    return [];
  }, [normalizedReportSeries, selectedCourseDetail]);
  const selectedTopicAction = useMemo(
    () => (selectedTopicDetail
      ? overviewWeakTopicActions.find((item) => item.key === selectedTopicDetail.key) || null
      : null),
    [overviewWeakTopicActions, selectedTopicDetail],
  );
  const selectedCourseDelta = selectedCourseDetail && selectedCourseDetail.change !== null
    ? getDeltaDisplay(selectedCourseDetail?.change || 0)
    : null;
  const selectedTopicDelta = selectedTopicDetail && selectedTopicDetail.delta !== null
    ? getDeltaDisplay(selectedTopicDetail?.delta || 0)
    : null;
  const selectedTopicTaskMetrics = selectedTopicDetail
    ? overviewTopicMetricsMap[selectedTopicDetail.key] || null
    : null;
  const performanceStorageKey = 'overviewPerformanceNavigatorV1';
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(performanceStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      if (typeof parsed.course === 'string') setPerformanceCourseFilter(parsed.course);
      if (typeof parsed.unit === 'string') setPerformanceUnitFilter(parsed.unit);
      if (typeof parsed.topic === 'string') setPerformanceTopicFilter(parsed.topic);
    } catch {
      // Ignore malformed local state.
    }
  }, []);
  React.useEffect(() => {
    try {
      window.localStorage.setItem(
        performanceStorageKey,
        JSON.stringify({
          course: performanceCourseFilter,
          unit: performanceUnitFilter,
          topic: performanceTopicFilter,
        }),
      );
    } catch {
      // Ignore persistence errors.
    }
  }, [performanceCourseFilter, performanceTopicFilter, performanceUnitFilter]);
  const latestPerformanceRow = overviewTopicPerformanceRows[0] || null;
  const effectiveCourseFilter = useMemo(() => {
    if (!overviewTopicPerformanceRows.length) return 'ALL';
    if (performanceCourseFilter !== 'AUTO') return performanceCourseFilter;
    return latestPerformanceRow?.courseName || 'ALL';
  }, [latestPerformanceRow, overviewTopicPerformanceRows, performanceCourseFilter]);
  const courseOptionsForPerformance = useMemo(
    () => Array.from(new Set(overviewTopicPerformanceRows.map((row) => row.courseName))),
    [overviewTopicPerformanceRows],
  );
  const rowsByCourse = useMemo(
    () => overviewTopicPerformanceRows.filter((row) => effectiveCourseFilter === 'ALL' || row.courseName === effectiveCourseFilter),
    [effectiveCourseFilter, overviewTopicPerformanceRows],
  );
  const effectiveUnitFilter = useMemo(() => {
    if (!rowsByCourse.length) return 'ALL';
    const validUnits = new Set(rowsByCourse.map((row) => row.unitName));
    if (performanceUnitFilter === 'AUTO') {
      if (latestPerformanceRow && validUnits.has(latestPerformanceRow.unitName)) return latestPerformanceRow.unitName;
      return 'ALL';
    }
    if (performanceUnitFilter !== 'ALL' && !validUnits.has(performanceUnitFilter)) return 'ALL';
    return performanceUnitFilter;
  }, [latestPerformanceRow, performanceUnitFilter, rowsByCourse]);
  const unitOptionsForPerformance = useMemo(
    () => Array.from(new Set(rowsByCourse.map((row) => row.unitName))),
    [rowsByCourse],
  );
  const rowsByUnit = useMemo(
    () => rowsByCourse.filter((row) => effectiveUnitFilter === 'ALL' || row.unitName === effectiveUnitFilter),
    [effectiveUnitFilter, rowsByCourse],
  );
  const effectiveTopicFilter = useMemo(() => {
    if (!rowsByUnit.length) return 'ALL';
    const validTopics = new Set(rowsByUnit.map((row) => row.key));
    if (performanceTopicFilter === 'AUTO') {
      if (latestPerformanceRow && validTopics.has(latestPerformanceRow.key)) return latestPerformanceRow.key;
      return 'ALL';
    }
    if (performanceTopicFilter !== 'ALL' && !validTopics.has(performanceTopicFilter)) return 'ALL';
    return performanceTopicFilter;
  }, [latestPerformanceRow, performanceTopicFilter, rowsByUnit]);
  const topicOptionsForPerformance = useMemo(
    () => rowsByUnit.map((row) => ({ key: row.key, label: row.topicName })),
    [rowsByUnit],
  );
  const rowsForPerformanceMetrics = useMemo(
    () => rowsByUnit.filter((row) => effectiveTopicFilter === 'ALL' || row.key === effectiveTopicFilter),
    [effectiveTopicFilter, rowsByUnit],
  );
  const aggregatedPerformanceMetrics = useMemo(() => {
    const totals = rowsForPerformanceMetrics.reduce((acc, row) => ({
      totalQuestions: acc.totalQuestions + row.totalQuestions,
      correctCount: acc.correctCount + row.correctCount,
      incorrectCount: acc.incorrectCount + row.incorrectCount,
      emptyCount: acc.emptyCount + row.emptyCount,
      minutes: acc.minutes + row.minutes,
      taskCount: acc.taskCount + row.taskCount,
      lastCompletedAt: row.lastCompletedAt > acc.lastCompletedAt ? row.lastCompletedAt : acc.lastCompletedAt,
    }), {
      totalQuestions: 0,
      correctCount: 0,
      incorrectCount: 0,
      emptyCount: 0,
      minutes: 0,
      taskCount: 0,
      lastCompletedAt: '',
    });
    const answeredCount = totals.correctCount + totals.incorrectCount;
    const accuracyPercent = answeredCount > 0
      ? Math.round((totals.correctCount / answeredCount) * 100)
      : 0;
    return { ...totals, accuracyPercent };
  }, [rowsForPerformanceMetrics]);
  const courseGrowthRanking = useMemo(
    () => [...overviewCourseInsights]
      .filter((item) => item.change !== null)
      .sort((a, b) => (b.change || 0) - (a.change || 0))
      .slice(0, 3),
    [overviewCourseInsights],
  );
  const courseSupportRanking = useMemo(
    () => [...overviewCourseInsights]
      .map((item) => ({ ...item, riskWeight: (item.weakCount * 10) - (item.change || 0) }))
      .sort((a, b) => b.riskWeight - a.riskWeight)
      .slice(0, 3),
    [overviewCourseInsights],
  );
  const reportSummaryItems = useMemo(() => {
    if (reportCardTab === 'course') {
      return [
        {
          label: 'En guclu ders',
          value: bestCourse ? bestCourse.courseName : 'Veri yok',
          hint: bestCourse && bestCourse.change !== null ? `${bestCourse.change > 0 ? '+' : ''}%${bestCourse.change}` : 'Bu periyotta ders verisi yok',
        },
        {
          label: 'Destek onceligi',
          value: weakestCourse ? weakestCourse.courseName : 'Veri yok',
          hint: weakestCourse && weakestCourse.change !== null ? `${weakestCourse.change > 0 ? '+' : ''}%${weakestCourse.change}` : 'Bu periyotta ders verisi yok',
        },
        {
          label: 'Veri olan ders',
          value: `${overviewCourseInsights.filter((item) => item.hasWeeklyData).length}/${overviewCourseInsights.length}`,
          hint: 'haftalik degisim',
        },
      ];
    }
    if (reportCardTab === 'topic') {
      return [
        {
          label: 'Gelisen konu',
          value: `${topicImproving.length}`,
          hint: 'bu hafta pozitif delta',
        },
        {
          label: 'Riskte konu',
          value: `${topicHard.filter((item) => (item.riskScore || 0) >= 45).length}`,
          hint: 'ilk 3 icindeki sayi',
        },
        {
          label: 'Secili konu',
          value: selectedTopicDetail ? selectedTopicDetail.topicName : 'Secim yok',
          hint: selectedTopicDelta ? selectedTopicDelta.text : 'delta verisi yok',
        },
      ];
    }
    if (reportCardTab === 'time') {
      return [
        {
          label: 'Rapor penceresi',
          value: 'Son 4 hafta',
          hint: `${safeReportSeriesForChart[0]?.points?.length || 0} veri noktasi`,
        },
        {
          label: 'Haftalık çalışma',
          value: formatMinutes(overviewWeeklyStats.totalMinutes),
          hint: minuteDelta.text,
        },
        {
          label: 'Deneme degisimi',
          value: overviewWeeklyStats.hasExamTrendData ? `${examDelta.short}` : 'Veri yok',
          hint: overviewWeeklyStats.hasExamTrendData ? examDelta.text : 'Karşılaştırma için seçili periyotta en az 2 deneme gerekli',
        },
      ];
    }
    return [
      {
        label: 'Izlenen ders',
        value: `${overviewCourseInsights.length}`,
        hint: 'aktif ders',
      },
      {
        label: 'Izlenen konu',
        value: `${overviewTopicInsights.length}`,
        hint: 'aktif konu kaydi',
      },
      {
        label: 'Ortalama hakimiyet',
        value: `%${reportMasteryAverage}`,
        hint: 'tum dersler',
      },
    ];
  }, [
    bestCourse,
    examDelta.short,
    examDelta.text,
    minuteDelta.text,
    overviewCourseInsights,
    overviewTopicInsights.length,
    overviewWeeklyStats.hasExamTrendData,
    overviewWeeklyStats.totalMinutes,
    reportCardTab,
    reportMasteryAverage,
    safeReportSeriesForChart,
    selectedTopicDelta,
    selectedTopicDetail,
    topicHard,
    topicImproving,
    weakestCourse,
  ]);

  return (
    <ParentWorkspaceFrame
      title="Ebeveyn Paneli"
      description="Bugunku ogrenme durumu"
      spacing="wide"
      actions={(
        <div className="ios-panel flex items-center gap-1 rounded-[20px] p-1">
          {periodOptions.map((option) => (
            <button
              key={`top-period-${option.value}`}
              type="button"
              onClick={() => onOverviewStudyPeriodChange(option.value)}
              className={`rounded-[12px] px-3 py-2 text-xs font-black transition-all active:scale-[0.96] ${overviewStudyPeriod === option.value ? 'ios-button-active text-white' : 'ios-button text-[var(--dr-text-secondary)] hover:text-[var(--dr-text-primary)]'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    >
      <section className="grid grid-cols-12 gap-5">
        <div className="col-span-12 space-y-5">
          <div className="dr-hig-primary-box rounded-[28px] p-6">
            <div className="dr-hig-caption uppercase tracking-[0.14em] font-semibold text-[var(--dr-text-secondary)]">{periodSummaryTitle}</div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="dr-velvet-stat p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="dr-hig-caption font-semibold text-[var(--dr-text-secondary)]">Tamamlanan Görev</div>
                  <ContextHelp title="Tamamlanan Görev" tone="blue">
                    Çocuğunuzun teslim tarihi bugün veya geçmiş olan görevleri bitirme oranıdır. Haftalık plan hedefine ne kadar yaklaştığını gösterir.
                  </ContextHelp>
                </div>
                <div className="mt-2 dr-hig-large-title text-[var(--dr-text-primary)]">{overviewWeeklyStats.completedCount}</div>
                <div className="mt-1 dr-hig-caption text-[var(--dr-text-secondary)]">/ {weeklyCompletionTarget} gorev</div>
                <div className="mt-2.5 h-1.5 rounded-full bg-slate-200/50 dark:bg-slate-800/50">
                  <div className="h-full rounded-full bg-[var(--dr-orange)]" style={{ width: `${weeklyCompletionPercent}%` }} />
                </div>
                <div className="mt-1 dr-hig-caption text-[var(--dr-text-secondary)]">%{weeklyCompletionPercent}</div>
              </div>
              <div className="dr-velvet-stat p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="dr-hig-caption font-semibold text-[var(--dr-text-secondary)]">Çalışma Süresi</div>
                  <ContextHelp title="Çalışma Süresi" tone="blue">
                    Çocuğunuzun ders çalışırken kronometreyle kaydettiği net çalışma süresidir. Mola ve duraklatma süreleri bu hesaba dahil edilmez.
                  </ContextHelp>
                </div>
                <div className="mt-2 dr-hig-large-title text-[var(--dr-text-primary)]">{formatMinutes(overviewWeeklyStats.totalMinutes)}</div>
                <div className={`mt-2.5 flex items-center gap-1 dr-hig-caption font-semibold ${minuteDelta.tone}`}>
                  <span className="text-sm leading-none">{minuteDelta.arrow}</span>
                  {minuteDelta.text}
                </div>
              </div>
              <div className="dr-velvet-stat p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="dr-hig-caption font-semibold text-[var(--dr-text-secondary)]">Çözülen Soru</div>
                  <ContextHelp title="Çözülen Soru" tone="blue">
                    Çocuğunuzun bu periyotta çözdüğü toplam soru sayısıdır. Altındaki yeşil ok, önceki döneme göre soru çözme hacmindeki değişimi gösterir.
                  </ContextHelp>
                </div>
                <div className="mt-2 dr-hig-large-title text-[var(--dr-text-primary)]">{overviewWeeklyStats.solvedQuestionCount}</div>
                <div className={`mt-2.5 flex items-center gap-1 dr-hig-caption font-semibold ${solvedDelta.tone}`}>
                  <span className="text-sm leading-none">{solvedDelta.arrow}</span>
                  {solvedDelta.text}
                </div>
              </div>
              <div className="dr-velvet-stat p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="dr-hig-caption font-semibold text-[var(--dr-text-secondary)]">Deneme Performansı</div>
                  <ContextHelp title="Deneme Performansı" tone="blue">
                    Çocuğunuzun son LGS deneme sınavlarındaki başarı grafik eğrisidir. Dalgalanmalar çocuğunuzun sınav stresini veya konu eksikliklerini tespit etmenizi kolaylaştırır.
                  </ContextHelp>
                </div>
                <div className={`mt-2 flex items-center gap-2 dr-hig-large-title ${examDelta.tone}`}>
                  <span className="text-xl leading-none">{examDelta.arrow}</span>
                  <span>{examDelta.short}</span>
                </div>
                <div className={`mt-1 dr-hig-caption font-semibold ${overviewWeeklyStats.hasExamTrendData ? examDelta.tone : 'text-[var(--dr-text-secondary)]'}`}>
                  {overviewWeeklyStats.hasExamTrendData
                    ? examDelta.text
                    : 'Karşılaştırma için seçili periyotta en az 2 deneme gerekir'}
                </div>
                <div className="mt-2.5 h-8">
                  <svg viewBox="0 0 120 30" className="h-full w-full text-[var(--dr-orange)]" aria-hidden="true">
                    <path d={accuracySparklinePath} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* --- Haftalık Çalışma Programı (Weekly Study Schedule) --- */}
          {weeklySchedule && (() => {
            const scheduledDays = DAY_NAMES_ORDERED.filter((dayName) => {
              const day = weeklySchedule[dayName];
              if (!day) return false;
              const hasSlots = Array.isArray(day.slots) && day.slots.length > 0;
              const hasWindows = Array.isArray(day.availableWindows) && day.availableWindows.length > 0;
              return hasSlots || hasWindows;
            });
            const totalSlots = scheduledDays.reduce((sum, dayName) => sum + (weeklySchedule[dayName]?.slots?.length || 0), 0);
            const totalWindows = DAY_NAMES_ORDERED.reduce((sum, dayName) => {
              const aw = weeklySchedule[dayName]?.availableWindows;
              return sum + (Array.isArray(aw) ? aw.length : 0);
            }, 0);
            const totalMinutesScheduled = scheduledDays.reduce((sum, dayName) => {
              const day = weeklySchedule[dayName];
              if (!day || !Array.isArray(day.slots)) return sum;
              return sum + day.slots.reduce((slotSum, slot) => {
                const [sh, sm] = (slot.startTime || '00:00').split(':').map(Number);
                const [eh, em] = (slot.endTime || '00:00').split(':').map(Number);
                return slotSum + Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
              }, 0);
            }, 0);
            return (
              <div className="dr-hig-secondary-card rounded-[28px] p-6" data-testid="overview-weekly-schedule-panel">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="dr-hig-headline text-[var(--dr-text-primary)]">Haftalık Çalışma Programı</h4>
                    <ContextHelp title="Haftalık Çalışma Programı" tone="blue">
                      Çocuğunuzun okul saatleri, etütleri ve evdeki çalışma programının haftalık görünümüdür. Günlük planlanan ders saatlerini ve serbest çalışma pencerelerini buradan izleyebilirsiniz.
                    </ContextHelp>
                  </div>
                  <div className="dr-hig-caption font-semibold text-[var(--dr-text-secondary)]">
                    {scheduledDays.length} gün · {totalSlots} ders · {formatMinutes(totalMinutesScheduled)}
                  </div>
                </div>
                {scheduledDays.length === 0 ? (
                  <div className="rounded-[18px] border border-[var(--dr-std-border-strong)]/20 bg-[var(--dr-surface)]/60 px-4 py-4 text-xs font-semibold text-[var(--dr-text-secondary)]">
                    Henüz haftalık çalışma programı oluşturulmamış. Planlama sayfasından program ekleyebilirsiniz.
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {scheduledDays.map((dayName) => {
                      const day = weeklySchedule[dayName];
                      const slots = [...(day?.slots || [])].sort((a, b) => a.startTime.localeCompare(b.startTime));
                      const windows = Array.isArray(day?.availableWindows) ? day.availableWindows : [];
                      const isToday = dayName === overviewTodayName;
                      return (
                        <div
                          key={`schedule-day-${dayName}`}
                          className={`ios-widget rounded-[20px] p-4 border border-[var(--dr-std-border-strong)]/10 bg-[var(--dr-surface)]/50 ${isToday ? 'ring-2 ring-[var(--dr-orange)]/60' : ''}`}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span className={`text-sm font-black ${isToday ? 'text-[var(--dr-orange)]' : 'text-[var(--dr-text-primary)]'}`}>
                              {dayName}{isToday ? ' (Bugün)' : ''}
                            </span>
                            <span className="text-[11px] font-semibold text-[var(--dr-text-secondary)]">
                              {slots.length} ders
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {slots.map((slot) => (
                              <button
                                key={`sched-slot-${slot.id}`}
                                type="button"
                                onDoubleClick={() => openSchoolCurriculumEditor(dayName, slot)}
                                className={`dr-school-slot-row flex w-full items-center justify-between rounded-[12px] border px-2.5 py-1.5 text-left text-xs transition-all active:scale-[0.97] ${
                                  slot.schoolCurriculumStatus === 'not-covered'
                                    ? 'dr-school-slot-not-covered'
                                    : slot.schoolCurriculumStatus === 'covered'
                                      ? 'dr-school-slot-covered'
                                      : 'bg-[var(--dr-surface)]/80 border-[var(--dr-std-border-strong)]/20 dark:bg-white/5 dark:border-white/10 text-[var(--dr-text-primary)]'
                                }`}
                                title="Okulda islenen konuyu secmek icin cift tiklayin"
                              >
                                <span className="font-bold text-[var(--dr-text-primary)]">{slot.startTime} - {slot.endTime}</span>
                                <span className="min-w-0 truncate pl-2 text-right font-semibold text-[var(--dr-text-secondary)]">
                                  {slot.schoolCurriculumStatus === 'covered' && (
                                    <CheckCircle className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-[var(--dr-orange)]" aria-hidden="true" />
                                  )}
                                  {slot.schoolCurriculumStatus === 'not-covered' ? 'Konu islenmedi' : slot.courseName || 'Genel'}
                                </span>
                              </button>
                            ))}
                            {windows.map((win, wIdx) => (
                              <div key={`sched-win-${dayName}-${wIdx}`} className="flex items-center justify-between rounded-[12px] bg-[var(--dr-surface)]/90 border border-[var(--dr-std-border-strong)]/20 px-2.5 py-1.5 text-xs text-[var(--dr-text-primary)]">
                                <span className="font-bold text-[var(--dr-orange)]">{win.startTime} - {win.endTime}</span>
                                <span className="font-semibold text-[var(--dr-text-secondary)] truncate ml-2">Çalışma Zamanı</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {schoolCurriculumSlot && activeSchoolCurriculumSlot && (
            <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#070911]/75 p-3 backdrop-blur-xl" onClick={closeSchoolCurriculumEditor}>
              <section
                className="ios-card dr-compact-modal w-[min(30rem,calc(100vw-1.5rem))] overflow-hidden border border-[var(--dr-std-border-strong)]/20 shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-label="Okulda islenen konu"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="dr-compact-modal-header flex items-start justify-between gap-3 border-b border-[var(--dr-std-border-strong)]/15">
                  <div className="min-w-0">
                    <div className="dr-planning-kicker text-[10px] font-black uppercase tracking-[0.22em] text-[var(--dr-orange)]">Okulda islenen konu</div>
                    <h3 className="mt-1 truncate text-base font-black text-[var(--dr-text-primary)]">{activeSchoolCurriculumSlot.courseName}</h3>
                    <p className="mt-0.5 text-[11px] font-semibold text-[var(--dr-text-secondary)]">
                      {schoolCurriculumSlot.dayName} · {activeSchoolCurriculumSlot.startTime} - {activeSchoolCurriculumSlot.endTime}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeSchoolCurriculumEditor}
                    className="ios-button flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-0 text-[var(--dr-text-secondary)] hover:text-[var(--dr-text-primary)]"
                    aria-label="Kapat"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="dr-compact-modal-body space-y-3">
                  {schoolCurriculumUnits.length === 0 ? (
                    <div className="dr-planning-empty rounded-[14px] px-3 py-3 text-xs font-semibold text-[var(--dr-text-secondary)]">
                      Bu ders icin mufredat bulunamadi. Once mufredat yonetiminde unite ve konu ekleyin.
                    </div>
                  ) : (
                    <>
                      <select
                        value={schoolUnitName}
                        onChange={(event) => {
                          setSchoolUnitName(event.target.value);
                          setSchoolTopicName('');
                          setSchoolCurriculumMessage(null);
                        }}
                        className="dr-form-field w-full rounded-xl px-3 py-2.5 text-xs font-bold bg-[var(--dr-surface)] border border-[var(--dr-std-border-strong)]/20 text-[var(--dr-text-primary)] outline-none"
                      >
                        <option value="">Unite sec</option>
                        {schoolCurriculumUnits.map((unit) => (
                          <option key={`school-unit-${unit.name}`} value={unit.name}>{unit.name}</option>
                        ))}
                      </select>

                      <div className="dr-modal-scroll max-h-48 space-y-1.5 overflow-y-auto pr-1">
                        {schoolUnitName && schoolCurriculumTopics.length === 0 && (
                          <div className="dr-planning-empty rounded-[14px] px-3 py-3 text-xs font-semibold text-[var(--dr-text-secondary)]">Bu unitede konu yok.</div>
                        )}
                        {schoolCurriculumTopics.map((topic) => (
                          <button
                            key={`school-topic-${topic.name}`}
                            type="button"
                            onClick={() => {
                              setSchoolTopicName(topic.name);
                              setSchoolCurriculumMessage(null);
                            }}
                            className={`w-full rounded-xl px-3 py-2.5 text-left text-xs font-bold transition-all active:scale-[0.98] ${schoolTopicName === topic.name ? 'bg-[var(--dr-orange)] text-white font-black' : 'bg-[var(--dr-surface)] border border-[var(--dr-std-border-strong)]/10 text-[var(--dr-text-primary)] hover:bg-[var(--dr-surface)]/80'}`}
                          >
                            {topic.name}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {schoolCurriculumMessage && (
                    <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      {schoolCurriculumMessage}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={() => toggleSchoolNotCovered(schoolCurriculumSlot.dayName, activeSchoolCurriculumSlot)}
                      className="ios-button rounded-xl px-3 py-2 text-xs font-black text-[var(--dr-text-secondary)] hover:text-[var(--dr-text-primary)]"
                    >
                      {activeSchoolCurriculumSlot.schoolCurriculumStatus === 'not-covered' ? 'Islenmedi kaldir' : 'Konu islenmedi'}
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={clearSchoolCurriculum}
                        disabled={!activeSchoolCurriculumSlot.schoolCurriculumStatus && !activeSchoolCurriculumSlot.schoolUnitName && !activeSchoolCurriculumSlot.schoolTopicName}
                        className="dr-destructive-button inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Sil
                      </button>
                      <button type="button" onClick={closeSchoolCurriculumEditor} className="ios-button rounded-xl px-3 py-2 text-xs font-bold text-[var(--dr-text-secondary)] hover:text-[var(--dr-text-primary)]">
                        Vazgec
                      </button>
                      <button
                        type="button"
                        onClick={saveSchoolCurriculum}
                        disabled={schoolCurriculumUnits.length === 0}
                        className="ios-button-active rounded-xl px-4 py-2 text-xs font-black text-white bg-[var(--dr-orange)] active:scale-[0.96] transition-all disabled:opacity-50"
                      >
                        Kaydet
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {selectedCourseDetail && (
            <div className="dr-hig-secondary-card rounded-[28px] p-6" data-testid="overview-course-deep-dive-panel">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="dr-hig-headline text-[var(--dr-text-primary)]">Ders Detay Sayfasi ({selectedCourseDetail.courseName})</h4>
                  <ContextHelp title="Ders Detay Sayfası" tone="blue">
                    Seçtiğiniz dersin genel durumunu gösterir. Çocuğunuzun o dersteki konu hakimiyeti, ortalama odaklanma puanı ve tekrar edilmesi gereken zayıf konu sayısını özetler.
                  </ContextHelp>
                </div>
                <div className="dr-hig-caption font-semibold text-[var(--dr-text-secondary)]">Periyot: {periodOptions.find((option) => option.value === overviewStudyPeriod)?.label || '1A'}</div>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                {overviewCoursesForDetail.map((course) => (
                  <button
                    key={`overview-course-v2-${course.courseName}`}
                    type="button"
                    onClick={() => setSelectedOverviewCourse(course.courseName)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all active:scale-[0.96] ${selectedCourseDetail.courseName === course.courseName ? 'ios-button-active text-white' : 'ios-button text-[var(--dr-text-secondary)] hover:text-[var(--dr-text-primary)]'}`}
                  >
                    {course.courseName}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[170px_minmax(0,1fr)]">
                <div className="ios-widget rounded-[20px] border border-[var(--dr-std-border-strong)]/10 bg-[var(--dr-surface)]/60 backdrop-blur-md p-4 flex items-center justify-center">
                  <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-[8px] border-[var(--dr-orange)] bg-[var(--dr-surface)] text-center shadow-lg">
                    <div>
                      <div className="text-3xl font-black text-[var(--dr-text-primary)]">%{selectedCourseDetail.progress}</div>
                      <div className={`text-xs font-bold ${selectedCourseDetail.progress >= 75 ? 'text-emerald-600' : 'text-[var(--dr-orange)]'}`}>
                        {selectedCourseDetail.progress >= 75 ? 'Iyi gidiyor' : 'Takipte'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="ios-widget rounded-[20px] border border-[var(--dr-std-border-strong)]/10 bg-[var(--dr-surface)]/60 backdrop-blur-md p-4">
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div className="border-b border-[var(--dr-std-border-strong)]/10 pb-2">
                      <span className="text-[var(--dr-text-secondary)] text-xs">Hakimiyet</span>
                      <div className="font-black text-[var(--dr-text-primary)]">%{selectedCourseDetail.progress}</div>
                    </div>
                    <div className="border-b border-[var(--dr-std-border-strong)]/10 pb-2">
                      <span className="text-[var(--dr-text-secondary)] text-xs">Haftalık değişim</span>
                      <div className={`font-black ${selectedCourseDelta ? selectedCourseDelta.tone : 'text-[var(--dr-text-secondary)]'}`}>
                        {selectedCourseDelta ? `${selectedCourseDelta.arrow} ${selectedCourseDelta.short}` : 'veri yok'}
                      </div>
                    </div>
                    <div>
                      <span className="text-[var(--dr-text-secondary)] text-xs">Riskli konu sayisi</span>
                      <div className="font-black text-[var(--dr-text-primary)]">{selectedCourseDetail.weakCount}</div>
                    </div>
                    <div>
                      <span className="text-[var(--dr-text-secondary)] text-xs">Konu adedi</span>
                      <div className="font-black text-[var(--dr-text-primary)]">{selectedCourseTopics.length}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ios-widget mt-4 rounded-[20px] p-4 border border-[var(--dr-std-border-strong)]/10 bg-[var(--dr-surface)]/60 backdrop-blur-md">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--dr-text-secondary)]">Son 4 Haftalık Trend</div>
                {selectedCourseTrend.length === 4 ? (
                  <div className="rounded-[18px] bg-[var(--dr-surface)]/80 border border-[var(--dr-std-border-strong)]/10 p-3 shadow-inner">
                    <svg viewBox="0 0 520 180" className="h-44 w-full" role="img" aria-label="Son 4 haftalik ders trendi">
                      <line x1="24" y1="146" x2="500" y2="146" stroke="var(--dr-border, #CBD5E1)" strokeWidth="1" />
                      <line x1="24" y1="116" x2="500" y2="116" stroke="var(--dr-border-subtle, #E2E8F0)" strokeWidth="1" />
                      <line x1="24" y1="86" x2="500" y2="86" stroke="var(--dr-border-subtle, #E2E8F0)" strokeWidth="1" />
                      <line x1="24" y1="56" x2="500" y2="56" stroke="var(--dr-border-subtle, #E2E8F0)" strokeWidth="1" />
                      <line x1="24" y1="26" x2="500" y2="26" stroke="var(--dr-border-subtle, #E2E8F0)" strokeWidth="1" />
                      <text x="6" y="150" fill="currentColor" className="text-[var(--dr-text-secondary)] text-[10px]">%0</text>
                      <text x="2" y="120" fill="currentColor" className="text-[var(--dr-text-secondary)] text-[10px]">%25</text>
                      <text x="2" y="90" fill="currentColor" className="text-[var(--dr-text-secondary)] text-[10px]">%50</text>
                      <text x="2" y="60" fill="currentColor" className="text-[var(--dr-text-secondary)] text-[10px]">%75</text>
                      <text x="2" y="30" fill="currentColor" className="text-[var(--dr-text-secondary)] text-[10px]">%100</text>
                      {(() => {
                        const xPoints = [70, 200, 330, 460];
                        const yPoints = selectedCourseTrend.map((score) => 146 - Math.max(0, Math.min(100, score)) * 1.2);
                        const path = `M ${xPoints[0]} ${yPoints[0]} C ${xPoints[0] + 35} ${yPoints[0]} ${xPoints[1] - 35} ${yPoints[1]} ${xPoints[1]} ${yPoints[1]} C ${xPoints[1] + 35} ${yPoints[1]} ${xPoints[2] - 35} ${yPoints[2]} ${xPoints[2]} ${yPoints[2]} C ${xPoints[2] + 35} ${yPoints[2]} ${xPoints[3] - 35} ${yPoints[3]} ${xPoints[3]} ${yPoints[3]}`;
                        return (
                          <>
                            <path d={path} fill="none" stroke="var(--dr-orange)" strokeWidth="3.5" strokeLinecap="round" />
                            {selectedCourseTrend.map((score, index) => (
                              <g key={`overview-trend-dot-v2-${index}`}>
                                <circle cx={xPoints[index]} cy={yPoints[index]} r="4.5" fill="var(--dr-orange)" />
                                <text x={xPoints[index] - 14} y={yPoints[index] - 10} fill="currentColor" className="text-[var(--dr-text-primary)] text-[11px] font-bold">%{score}</text>
                                <text x={xPoints[index] - 24} y="168" fill="currentColor" className="text-[var(--dr-text-secondary)] text-[10px]">{index + 1}. Hafta</text>
                              </g>
                            ))}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                ) : (
                  <div className="rounded-[18px] bg-[var(--dr-surface)]/80 border border-[var(--dr-std-border-strong)]/10 p-4 text-sm text-[var(--dr-text-secondary)]">
                    Bu periyotta ders trend verisi yok. Planlama ekranından bu ders için soru çözümü veya tekrar görevi ekleyin.
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedTopicDetail && (
            <div className="dr-hig-secondary-card rounded-[28px] p-6" data-testid="overview-topic-deep-dive-panel">
              <div className="mb-4 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="dr-hig-headline text-[var(--dr-text-primary)]">Konu Performansi</h4>
                    <ContextHelp title="Konu Performansı" tone="blue">
                      Ders altındaki konuların tamamlanma ve başarı durumunu listeler. Güçlü olunan veya ekstra çalışma/tekrar gerektiren konuları renk kodlarıyla anında ayırt edebilirsiniz.
                    </ContextHelp>
                  </div>
                  <div className="mt-1 truncate dr-hig-caption font-semibold text-[var(--dr-text-secondary)]">
                    Secili konu: {selectedTopicDetail.topicName}
                  </div>
                </div>
                <div className="ios-button rounded-[12px] px-3 py-1 text-xs font-bold text-[var(--dr-text-secondary)]">Son 14 Gun</div>
              </div>
              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <label className="text-[11px] font-semibold text-[var(--dr-text-secondary)]">
                  Ders
                  <select
                    value={effectiveCourseFilter}
                    onChange={(event) => {
                      setPerformanceCourseFilter(event.target.value);
                      setPerformanceUnitFilter('ALL');
                      setPerformanceTopicFilter('ALL');
                    }}
                    className="ios-button mt-1 w-full rounded-[12px] px-2 py-2 text-xs font-bold bg-[var(--dr-surface)] border border-[var(--dr-std-border-strong)]/20 text-[var(--dr-text-primary)] outline-none"
                  >
                    <option value="ALL">Tum dersler</option>
                    {courseOptionsForPerformance.map((courseName) => (
                      <option key={`perf-course-head-${courseName}`} value={courseName}>{courseName}</option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] font-semibold text-[var(--dr-text-secondary)]">
                  Unite
                  <select
                    value={effectiveUnitFilter}
                    onChange={(event) => {
                      setPerformanceUnitFilter(event.target.value);
                      setPerformanceTopicFilter('ALL');
                    }}
                    className="ios-button mt-1 w-full rounded-[12px] px-2 py-2 text-xs font-bold bg-[var(--dr-surface)] border border-[var(--dr-std-border-strong)]/20 text-[var(--dr-text-primary)] outline-none"
                  >
                    <option value="ALL">Tum uniteler</option>
                    {unitOptionsForPerformance.map((unitName) => (
                      <option key={`perf-unit-head-${unitName}`} value={unitName}>{unitName}</option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] font-semibold text-[var(--dr-text-secondary)]">
                  Konu
                  <select
                    value={effectiveTopicFilter}
                    onChange={(event) => setPerformanceTopicFilter(event.target.value)}
                    className="ios-button mt-1 w-full rounded-[12px] px-2 py-2 text-xs font-bold bg-[var(--dr-surface)] border border-[var(--dr-std-border-strong)]/20 text-[var(--dr-text-primary)] outline-none"
                  >
                    <option value="ALL">Tum konular</option>
                    {topicOptionsForPerformance.map((topic) => (
                      <option key={`perf-topic-head-${topic.key}`} value={topic.key}>{topic.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mb-4 rounded-[12px] bg-[var(--dr-surface)]/80 border border-[var(--dr-std-border-strong)]/15 px-3 py-2 text-[11px] font-semibold text-[var(--dr-text-secondary)]">
                Filtreler "Tüm" seçimindeyken son aktif ders/konu verisi gösterilir. Daha net takip için ders ve ünite seçin.
              </div>
              <div className="grid gap-4 lg:grid-cols-[170px_minmax(0,1fr)]">
                <div className="ios-widget rounded-[20px] border border-[var(--dr-std-border-strong)]/10 bg-[var(--dr-surface)]/60 backdrop-blur-md p-4">
                  <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-[8px] border-[var(--dr-orange)] bg-[var(--dr-surface)] text-center shadow-lg">
                    <div>
                      <div className="text-3xl font-black text-[var(--dr-text-primary)]">%{selectedTopicTaskMetrics?.accuracy ?? selectedTopicDetail.currentAccuracy ?? 0}</div>
                      <div className={`text-xs font-bold ${((selectedTopicTaskMetrics?.accuracy ?? selectedTopicDetail.currentAccuracy ?? 0) < 65) ? 'text-[var(--dr-orange)]' : 'text-emerald-600'}`}>
                        {(selectedTopicTaskMetrics?.accuracy ?? selectedTopicDetail.currentAccuracy ?? 0) < 65 ? 'Tekrar gerekiyor' : 'Iyi gidiyor'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="ios-widget rounded-[20px] border border-[var(--dr-std-border-strong)]/10 bg-[var(--dr-surface)]/60 backdrop-blur-md p-4">
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div className="border-b border-[var(--dr-std-border-strong)]/10 pb-2">
                      <span className="text-[var(--dr-text-secondary)] text-xs">Çalışma</span>
                      <div className="font-black text-[var(--dr-text-primary)]">{Math.floor((selectedTopicTaskMetrics?.minutes ?? 0) / 60)} sa {(selectedTopicTaskMetrics?.minutes ?? 0) % 60} dk</div>
                    </div>
                    <div className="border-b border-[var(--dr-std-border-strong)]/10 pb-2">
                      <span className="text-[var(--dr-text-secondary)] text-xs">Soru Cozum</span>
                      <div className="font-black text-[var(--dr-text-primary)]">{selectedTopicTaskMetrics?.solved ?? 0} soru</div>
                    </div>
                    <div>
                      <span className="text-[var(--dr-text-secondary)] text-xs">Dogruluk Orani</span>
                      <div className="font-black text-[var(--dr-text-primary)]">%{selectedTopicTaskMetrics?.accuracy ?? selectedTopicDetail.currentAccuracy ?? 0}</div>
                    </div>
                    <div>
                      <span className="text-[var(--dr-text-secondary)] text-xs">Tekrar Ihtiyaci</span>
                      <div className={`font-black ${selectedTopicTaskMetrics?.retryNeed === 'Yuksek' ? 'text-[var(--dr-orange)]' : selectedTopicTaskMetrics?.retryNeed === 'Orta' ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {selectedTopicTaskMetrics?.retryNeed || 'Dusuk'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {selectedTopicAction && (
                <div className="mt-4 rounded-[18px] border border-[var(--dr-std-border-strong)]/15 bg-[var(--dr-surface)]/80 px-4 py-3 text-xs font-semibold text-[var(--dr-text-primary)] shadow-sm">
                  <span className="text-[var(--dr-orange)] font-bold">Neden:</span> {selectedTopicAction.reason} · <span className="text-[var(--dr-orange)] font-bold">Bugün Yapılacak:</span> {selectedTopicAction.action} · <span className="text-[var(--dr-text-secondary)] font-bold">Görev:</span> {selectedTopicAction.taskStatus}
                </div>
              )}
              {!selectedTopicAction && (
                <div className="mt-4 rounded-[18px] border border-[var(--dr-std-border-strong)]/10 bg-[var(--dr-surface)]/40 px-4 py-3 text-xs font-semibold text-[var(--dr-text-secondary)]">
                  Bu konu için ek karar notu bulunmuyor.
                </div>
              )}
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="ios-widget rounded-[20px] border border-[var(--dr-std-border-strong)]/10 bg-[var(--dr-surface)]/60 backdrop-blur-md p-4">
                  <div className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-[var(--dr-text-secondary)]">Konu Performansi</div>
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-[110px_minmax(0,1fr)_42px] items-center gap-2">
                      <span className="text-[var(--dr-text-secondary)]">Çalışma</span>
                      <div className="h-2 rounded-full bg-slate-200/50 dark:bg-slate-800/50">
                        <div className="h-full rounded-full bg-[var(--dr-orange)]" style={{ width: `${Math.max(10, Math.min(100, Math.round(((selectedTopicTaskMetrics?.minutes ?? 0) / 240) * 100)))}%` }} />
                      </div>
                      <span className="text-right font-black text-[var(--dr-text-primary)]">%{Math.max(10, Math.min(100, Math.round(((selectedTopicTaskMetrics?.minutes ?? 0) / 240) * 100)))}</span>
                    </div>
                    <div className="grid grid-cols-[110px_minmax(0,1fr)_42px] items-center gap-2">
                      <span className="text-[var(--dr-text-secondary)]">Soru Cozumu</span>
                      <div className="h-2 rounded-full bg-slate-200/50 dark:bg-slate-800/50">
                        <div className="h-full rounded-full bg-[var(--dr-orange)]" style={{ width: `${selectedTopicTaskMetrics?.practicePerf ?? 0}%` }} />
                      </div>
                      <span className="text-right font-black text-[var(--dr-text-primary)]">%{selectedTopicTaskMetrics?.practicePerf ?? 0}</span>
                    </div>
                    <div className="grid grid-cols-[110px_minmax(0,1fr)_42px] items-center gap-2">
                      <span className="text-[var(--dr-text-secondary)]">Deneme</span>
                      <div className="h-2 rounded-full bg-slate-200/50 dark:bg-slate-800/50">
                        <div className="h-full rounded-full bg-[var(--dr-orange)]" style={{ width: `${selectedTopicTaskMetrics?.testPerf ?? 0}%` }} />
                      </div>
                      <span className="text-right font-black text-[var(--dr-text-primary)]">%{selectedTopicTaskMetrics?.testPerf ?? 0}</span>
                    </div>
                    <div className="grid grid-cols-[110px_minmax(0,1fr)_42px] items-center gap-2">
                      <span className="text-[var(--dr-text-secondary)]">Gunluk Tekrar</span>
                      <div className="h-2 rounded-full bg-slate-200/50 dark:bg-slate-800/50">
                        <div className="h-full rounded-full bg-[var(--dr-orange)]" style={{ width: `${selectedTopicTaskMetrics?.dailyPerf ?? 0}%` }} />
                      </div>
                      <span className="text-right font-black text-slate-100">%{selectedTopicTaskMetrics?.dailyPerf ?? 0}</span>
                    </div>
                  </div>
                </div>
                <div className="ios-widget rounded-[20px] border border-[var(--dr-std-border-strong)]/10 bg-[var(--dr-surface)]/60 backdrop-blur-md p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--dr-text-secondary)]">Soru Sonuc Ozeti</div>
                    <div className="text-[11px] font-semibold text-[var(--dr-text-secondary)]">
                      {aggregatedPerformanceMetrics.lastCompletedAt
                        ? `Son aktivite ${aggregatedPerformanceMetrics.lastCompletedAt}`
                        : 'Son aktivite yok'}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-[14px] bg-[var(--dr-surface)] border border-[var(--dr-std-border-strong)]/20 shadow-inner px-3 py-2.5 text-xs">
                      <div className="text-[var(--dr-text-secondary)] font-semibold">Toplam Soru</div>
                      <div className="mt-1 text-lg font-black text-[var(--dr-text-primary)]">{aggregatedPerformanceMetrics.totalQuestions}</div>
                    </div>
                    <div className="rounded-[14px] bg-[var(--dr-surface)] border border-[var(--dr-std-border-strong)]/20 shadow-inner px-3 py-2.5 text-xs">
                      <div className="text-[var(--dr-text-secondary)] font-semibold">Dogru</div>
                      <div className="mt-1 text-lg font-black text-emerald-600">{aggregatedPerformanceMetrics.correctCount}</div>
                    </div>
                    <div className="rounded-[14px] bg-[var(--dr-surface)] border border-[var(--dr-std-border-strong)]/20 shadow-inner px-3 py-2.5 text-xs">
                      <div className="text-[var(--dr-text-secondary)] font-semibold">Yanlis</div>
                      <div className="mt-1 text-lg font-black text-[var(--dr-orange)]">{aggregatedPerformanceMetrics.incorrectCount}</div>
                    </div>
                    <div className="rounded-[14px] bg-[var(--dr-surface)] border border-[var(--dr-std-border-strong)]/20 shadow-inner px-3 py-2.5 text-xs">
                      <div className="text-[var(--dr-text-secondary)] font-semibold">Bos</div>
                      <div className="mt-1 text-lg font-black text-amber-500">{aggregatedPerformanceMetrics.emptyCount}</div>
                    </div>
                    <div className="rounded-[14px] bg-[var(--dr-surface)] border border-[var(--dr-std-border-strong)]/20 shadow-inner px-3 py-2.5 text-xs">
                      <div className="text-[var(--dr-text-secondary)] font-semibold">Dogruluk %</div>
                      <div className="mt-1 text-lg font-black text-[var(--dr-text-primary)]">%{aggregatedPerformanceMetrics.accuracyPercent}</div>
                    </div>
                    <div className="rounded-[14px] bg-[var(--dr-surface)] border border-[var(--dr-std-border-strong)]/20 shadow-inner px-3 py-2.5 text-xs">
                      <div className="text-[var(--dr-text-secondary)] font-semibold">Çalışma Süresi</div>
                      <div className="mt-1 text-lg font-black text-[var(--dr-text-primary)]">{formatMinutes(aggregatedPerformanceMetrics.minutes)}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-[11px] font-semibold text-[var(--dr-text-secondary)]">
                    {aggregatedPerformanceMetrics.taskCount > 0
                      ? `${aggregatedPerformanceMetrics.taskCount} gorev kaydindan hesaplandi.`
                      : 'Secilen filtrede soru verisi bulunmuyor.'}
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-[18px] border border-[var(--dr-std-border-strong)]/15 bg-[var(--dr-surface)]/80 px-4 py-3 text-xs font-semibold text-[var(--dr-text-primary)] shadow-sm">
                <span className="text-[var(--dr-orange)] font-bold">Öneri:</span> Bu konuda düzenli tekrar ve bol soru çözümü ile %70+ seviyeye ulaşılabilir.
              </div>
            </div>
          )}

          <div className="dr-hig-secondary-card rounded-[28px] p-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="dr-hig-headline text-[var(--dr-text-primary)]">Rapor Sayfasi</h4>
                <ContextHelp title="Rapor Sayfası" tone="blue">
                  Çocuğunuzun seçilen periyottaki akademik ilerlemesini, çözdüğü soruları, çalışma sürelerini ve sınav gelişimlerini özetleyen veli analiz raporudur.
                </ContextHelp>
              </div>
              <div className="dr-hig-caption font-semibold text-[var(--dr-text-secondary)]">Periyot: {periodOptions.find((option) => option.value === overviewStudyPeriod)?.label || '1A'}</div>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setReportCardTab('general')} className={`rounded-[12px] px-3 py-1.5 text-xs font-bold transition-all active:scale-[0.96] ${reportCardTab === 'general' ? 'ios-button-active text-white' : 'ios-button text-[var(--dr-text-secondary)] hover:text-[var(--dr-text-primary)]'}`}>Genel Rapor</button>
              <button type="button" onClick={() => setReportCardTab('course')} className={`rounded-[12px] px-3 py-1.5 text-xs font-bold transition-all active:scale-[0.96] ${reportCardTab === 'course' ? 'ios-button-active text-white' : 'ios-button text-[var(--dr-text-secondary)] hover:text-[var(--dr-text-primary)]'}`}>Ders Raporu</button>
              <button type="button" onClick={() => setReportCardTab('topic')} className={`rounded-[12px] px-3 py-1.5 text-xs font-bold transition-all active:scale-[0.96] ${reportCardTab === 'topic' ? 'ios-button-active text-white' : 'ios-button text-[var(--dr-text-secondary)] hover:text-[var(--dr-text-primary)]'}`}>Konu Raporu</button>
              <button type="button" onClick={() => setReportCardTab('time')} className={`rounded-[12px] px-3 py-1.5 text-xs font-bold transition-all active:scale-[0.96] ${reportCardTab === 'time' ? 'ios-button-active text-white' : 'ios-button text-[var(--dr-text-secondary)] hover:text-[var(--dr-text-primary)]'}`}>Zaman Raporu</button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {reportSummaryItems.map((item) => (
                <div key={`report-summary-${item.label}`} className="ios-widget rounded-[20px] border border-[var(--dr-std-border-strong)]/10 bg-[var(--dr-surface)]/60 px-3 py-3 shadow-inner">
                  <div className="text-[11px] text-[var(--dr-text-secondary)] font-semibold">{item.label}</div>
                  <div className="mt-1 truncate text-base font-black text-[var(--dr-text-primary)]">{item.value}</div>
                  <div className="mt-1 text-[11px] font-semibold text-[var(--dr-text-secondary)]">{item.hint}</div>
                </div>
              ))}
            </div>
            {reportCardTab === 'course' ? (
              <div className="mt-4">
                <div className="ios-widget rounded-[14px] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--dr-text-secondary)]">Ders Raporu Trendi</span>
                    <ContextHelp title="Ders Raporu Trendi" tone="blue">
                      Bu grafik, çocuğunuzun tüm ana derslerdeki konu hakimiyetinin son 4 hafta içindeki gelişim yönünü (yükseliş/düşüş eğilimini) yan yana gösterir.
                    </ContextHelp>
                  </div>
                  {courseReportSeriesForChart.length > 0 ? (
                    <>
                      <svg viewBox="0 0 620 220" className="h-52 w-full" aria-label="Ders raporu trendi">
                        <line x1="30" y1="182" x2="600" y2="182" stroke="#CBD5E1" strokeWidth="1" />
                        {[0, 25, 50, 75, 100].map((tick, i) => (
                          <g key={`ctick-${tick}`}>
                            <line x1="30" y1={182 - i * 38} x2="600" y2={182 - i * 38} stroke="#E2E8F0" strokeWidth="1" />
                            <text x="4" y={186 - i * 38} className="fill-[var(--dr-text-secondary)] text-[10px]">%{tick}</text>
                          </g>
                        ))}
                        {courseReportSeriesForChart.map((series, sIdx) => {
                          const xs = [90, 250, 410, 570];
                          const ys = series.points.map((p) => 182 - Math.max(0, Math.min(100, p)) * 1.52);
                          const path = `M ${xs[0]} ${ys[0]} C ${xs[0] + 45} ${ys[0]} ${xs[1] - 45} ${ys[1]} ${xs[1]} ${ys[1]} C ${xs[1] + 45} ${ys[1]} ${xs[2] - 45} ${ys[2]} ${xs[2]} ${ys[2]} C ${xs[2] + 45} ${ys[2]} ${xs[3] - 45} ${ys[3]} ${xs[3]} ${ys[3]}`;
                          return (
                            <g key={`cseries-${series.courseName}-${sIdx}`}>
                              <path d={path} fill="none" stroke={series.color} strokeWidth="2.5" strokeLinecap="round" />
                              {xs.map((x, idx) => <circle key={`cdot-${series.courseName}-${idx}`} cx={x} cy={ys[idx]} r="2.7" fill={series.color} />)}
                            </g>
                          );
                        })}
                        {['1. Hafta', '2. Hafta', '3. Hafta', '4. Hafta'].map((label, idx) => (
                          <text key={`cxlabel-${label}`} x={[70, 230, 390, 550][idx]} y="206" className="fill-[var(--dr-text-secondary)] text-[11px]">{label}</text>
                        ))}
                      </svg>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                        {courseReportSeriesForChart.map((series) => (
                          <span key={`clegend-${series.courseName}`} className="inline-flex items-center gap-1 text-[var(--dr-text-secondary)]">
                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: series.color }} />
                            {series.courseName}
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 text-xs font-semibold text-slate-500">
                        Bu grafik, derslerin son 4 haftadaki gidiş yönünü gösterir.
                      </div>
                    </>
                  ) : (
                    <div className="rounded-[12px] border border-slate-200 bg-white/70 px-3 py-3 text-xs font-semibold text-slate-500">
                      Ders trendini cizmek icin henüz haftalik soru verisi yok.
                    </div>
                  )}
                </div>
                <div className="ios-widget rounded-[14px] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--dr-text-secondary)]">Ders Durumu</span>
                    <ContextHelp title="Ders Durumu" tone="blue">
                      Bu grafik, çocuğunuzun şu anki aktif derslerdeki genel konu hakimiyeti ve ilerleme yüzdelerini karşılaştırmalı olarak gösterir.
                    </ContextHelp>
                  </div>
                  <svg viewBox="0 0 620 220" className="h-52 w-full" aria-label="Ders durumu cizgi grafigi">
                    <line x1="30" y1="182" x2="600" y2="182" stroke="#CBD5E1" strokeWidth="1" />
                    {[0, 25, 50, 75, 100].map((tick, i) => (
                      <g key={`status-tick-${tick}`}>
                        <line x1="30" y1={182 - i * 38} x2="600" y2={182 - i * 38} stroke="#E2E8F0" strokeWidth="1" />
                        <text x="4" y={186 - i * 38} className="fill-[var(--dr-text-secondary)] text-[10px]">%{tick}</text>
                      </g>
                    ))}
                    {(() => {
                      const items = courseCards.slice(0, 6);
                      const points = items.map((course, idx) => {
                        const x = 70 + (idx * (520 / Math.max(1, items.length - 1)));
                        const y = 182 - Math.max(0, Math.min(100, course.progress)) * 1.52;
                        return { x, y, course };
                      });
                      if (!points.length) return null;
                      const path = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                      return (
                        <>
                          <path d={path} fill="none" stroke="#0EA5E9" strokeWidth="2.8" strokeLinecap="round" />
                          {points.map((p, idx) => (
                            <g key={`status-point-${p.course.courseName}`}>
                              <circle cx={p.x} cy={p.y} r="3.5" fill="#0EA5E9" />
                              <text x={p.x - 13} y={p.y - 10} className="fill-[var(--dr-text-primary)] text-[11px] font-bold">%{p.course.progress}</text>
                              <text x={Math.max(34, p.x - 36)} y="206" className="fill-[var(--dr-text-secondary)] text-[10px]">
                                {(p.course.courseName.length > 12 ? `${p.course.courseName.slice(0, 12)}…` : p.course.courseName)}
                              </text>
                              <title>{`${p.course.courseName}: ${p.course.progress}% (${p.course.status})`}</title>
                            </g>
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_300px]">
                <div className="ios-widget rounded-[14px] p-3">
                  <div className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    {reportCardTab === 'general' && 'Derslere Gore Hakimiyet Trendi'}
                    {reportCardTab === 'topic' && 'Konu Raporu Trendi'}
                    {reportCardTab === 'time' && 'Zaman Raporu Trendi'}
                  </div>
                  <svg viewBox="0 0 620 220" className="h-52 w-full" aria-label="Derslere gore hakimiyet trendi">
                    <line x1="30" y1="182" x2="600" y2="182" stroke="#CBD5E1" strokeWidth="1" />
                    {[0, 25, 50, 75, 100].map((tick, i) => (
                      <g key={`gtick-${tick}`}>
                        <line x1="30" y1={182 - i * 38} x2="600" y2={182 - i * 38} stroke="#E2E8F0" strokeWidth="1" />
                        <text x="4" y={186 - i * 38} className="fill-[var(--dr-text-secondary)] text-[10px]">%{tick}</text>
                      </g>
                    ))}
                    {safeReportSeriesForChart.map((series, sIdx) => {
                      const xs = [90, 250, 410, 570];
                      const ys = series.points.map((p) => 182 - Math.max(0, Math.min(100, p)) * 1.52);
                      const path = `M ${xs[0]} ${ys[0]} C ${xs[0] + 45} ${ys[0]} ${xs[1] - 45} ${ys[1]} ${xs[1]} ${ys[1]} C ${xs[1] + 45} ${ys[1]} ${xs[2] - 45} ${ys[2]} ${xs[2]} ${ys[2]} C ${xs[2] + 45} ${ys[2]} ${xs[3] - 45} ${ys[3]} ${xs[3]} ${ys[3]}`;
                      return (
                        <g key={`gseries-${series.courseName}-${sIdx}`}>
                          <path d={path} fill="none" stroke={series.color} strokeWidth="2.5" strokeLinecap="round" />
                          {xs.map((x, idx) => <circle key={`gdot-${series.courseName}-${idx}`} cx={x} cy={ys[idx]} r="2.7" fill={series.color} />)}
                        </g>
                      );
                    })}
                    {['1. Hafta', '2. Hafta', '3. Hafta', '4. Hafta'].map((label, idx) => (
                      <text key={`xlabel-${label}`} x={[70, 230, 390, 550][idx]} y="206" className="fill-[var(--dr-text-secondary)] text-[11px]">{label}</text>
                    ))}
                  </svg>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                    {safeReportSeriesForChart.map((series) => (
                      <span key={`glegend-${series.courseName}`} className="inline-flex items-center gap-1 text-[var(--dr-text-secondary)]">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: series.color }} />
                        {series.courseName}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="ios-widget rounded-[14px] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--dr-text-secondary)]">Konu ozeti</div>
                        <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">Genel Bakis yalnizca ilk 3 sinyali gosterir; detayli siralama Karar sayfasinda.</p>
                      </div>
                      <button type="button" onClick={onOpenAnalysis} className="ios-button shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black text-[var(--dr-text-primary)] transition active:scale-[0.96]">
                        Karar'a git
                      </button>
                    </div>
                  </div>
                  <div className="ios-widget rounded-[14px] p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--dr-text-secondary)]">Ilk 3 gelisen konu</span>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-600">{topicImproving.length}</span>
                    </div>
                    <div className="space-y-1.5">
                      {topicImproving.map((item, idx) => (
                        <div key={`grow-topic-${item.key}`} className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 truncate text-[var(--dr-text-primary)]">{idx + 1}. {item.topicName}</span>
                          <span className="shrink-0 font-black text-emerald-600">+%{item.delta}</span>
                        </div>
                      ))}
                      {topicImproving.length === 0 && (
                        <div className="text-xs text-[var(--dr-text-secondary)]">Yeterli haftalik konu verisi yok.</div>
                      )}
                    </div>
                  </div>
                  <div className="ios-widget rounded-[14px] p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--dr-text-secondary)]">Ilk 3 destek konusu</span>
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-black text-rose-600">{topicHard.length}</span>
                    </div>
                    <div className="space-y-1.5">
                      {topicHard.map((item, idx) => (
                        <div key={`hard-${item.key}`} className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 truncate text-[var(--dr-text-primary)]">{idx + 1}. {item.topicName}</span>
                          <span className="shrink-0 font-black text-rose-600">{item.riskScore !== null ? `risk ${item.riskScore}` : 'risk'}</span>
                        </div>
                      ))}
                      {topicHard.length === 0 && (
                        <div className="text-xs text-[var(--dr-text-secondary)]">Risk analizi icin konu verisi yok.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-2 text-xs text-slate-500">Not: Raporlar haftalik olarak guncellenir.</div>
          </div>
        </div>
      </section>

    </ParentWorkspaceFrame>
  );
};

export default ParentOverviewWorkspace;


