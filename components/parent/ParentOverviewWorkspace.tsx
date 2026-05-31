import React, { useMemo, useState } from 'react';
import type { ExamScheduleEntry, Task, WeeklySchedule, WeeklyScheduleSlot } from '../../types';
import {
  AlertTriangle,
  BookOpen,
  Calculator,
  CheckCircle,
  Clock,
  Dna,
  Globe,
  GraduationCap,
  Play,
  Sparkles,
  Target,
} from '../icons';
import ParentWorkspaceFrame from './ParentWorkspaceFrame';

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

const ParentOverviewWorkspace: React.FC<ParentOverviewWorkspaceProps> = ({
  parentSummary,
  overviewSummary,
  overviewNextTask,
  weeklySchedule,
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
    const accuracyPercent = totals.totalQuestions > 0
      ? Math.round((totals.correctCount / totals.totalQuestions) * 100)
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
              className={`rounded-[12px] px-3 py-2 text-xs font-black ${overviewStudyPeriod === option.value ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    >
      <section className="grid grid-cols-12 gap-5">
        <div className="col-span-12 space-y-5">
          <div className="dr-hig-primary-box rounded-[26px] p-6">
            <div className="dr-hig-caption uppercase tracking-[0.14em] font-semibold text-slate-500 dark:text-slate-400">{periodSummaryTitle}</div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="dr-hig-secondary-card rounded-[18px] p-5">
                <div className="dr-hig-caption font-semibold text-slate-500 dark:text-slate-400">Tamamlanan Gorev</div>
                <div className="mt-2 dr-hig-large-title text-slate-900 dark:text-white">{overviewWeeklyStats.completedCount}</div>
                <div className="mt-1 dr-hig-caption text-slate-500 dark:text-slate-400">/ {weeklyCompletionTarget} gorev</div>
                <div className="mt-2.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${weeklyCompletionPercent}%` }} />
                </div>
                <div className="mt-1 dr-hig-caption text-slate-500 dark:text-slate-400">%{weeklyCompletionPercent}</div>
              </div>
              <div className="dr-hig-secondary-card rounded-[18px] p-5">
                <div className="dr-hig-caption font-semibold text-slate-500 dark:text-slate-400">Çalışma Süresi</div>
                <div className="mt-2 dr-hig-large-title text-slate-900 dark:text-white">{formatMinutes(overviewWeeklyStats.totalMinutes)}</div>
                <div className={`mt-2.5 flex items-center gap-1 dr-hig-caption font-semibold ${minuteDelta.tone}`}>
                  <span className="text-sm leading-none">{minuteDelta.arrow}</span>
                  {minuteDelta.text}
                </div>
              </div>
              <div className="dr-hig-secondary-card rounded-[18px] p-5">
                <div className="dr-hig-caption font-semibold text-slate-500 dark:text-slate-400">Çözülen Soru</div>
                <div className="mt-2 dr-hig-large-title text-slate-900 dark:text-white">{overviewWeeklyStats.solvedQuestionCount}</div>
                <div className={`mt-2.5 flex items-center gap-1 dr-hig-caption font-semibold ${solvedDelta.tone}`}>
                  <span className="text-sm leading-none">{solvedDelta.arrow}</span>
                  {solvedDelta.text}
                </div>
              </div>
              <div className="dr-hig-secondary-card rounded-[18px] p-5">
                <div className="dr-hig-caption font-semibold text-slate-500 dark:text-slate-400">Deneme Performansi</div>
                <div className={`mt-2 flex items-center gap-2 dr-hig-large-title ${examDelta.tone}`}>
                  <span className="text-xl leading-none">{examDelta.arrow}</span>
                  <span>{examDelta.short}</span>
                </div>
                <div className={`mt-1 dr-hig-caption font-semibold ${overviewWeeklyStats.hasExamTrendData ? examDelta.tone : 'text-slate-500'}`}>
                  {overviewWeeklyStats.hasExamTrendData
                    ? examDelta.text
                    : 'Karşılaştırma için seçili periyotta en az 2 deneme gerekir'}
                </div>
                <div className="mt-2.5 h-8">
                  <svg viewBox="0 0 120 30" className="h-full w-full text-violet-500" aria-hidden="true">
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
              <div className="dr-hig-secondary-card rounded-[26px] p-6" data-testid="overview-weekly-schedule-panel">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="dr-hig-headline text-slate-900 dark:text-white">Haftalık Çalışma Programı</h4>
                  <div className="dr-hig-caption font-semibold text-slate-500 dark:text-slate-400">
                    {scheduledDays.length} gün · {totalSlots} ders · {formatMinutes(totalMinutesScheduled)}
                  </div>
                </div>
                {scheduledDays.length === 0 ? (
                  <div className="rounded-[14px] bg-slate-100 px-3 py-3 text-xs font-semibold text-slate-500">
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
                          className={`ios-widget rounded-[18px] p-4 ${isToday ? 'ring-2 ring-emerald-400/60' : ''}`}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span className={`text-sm font-black ${isToday ? 'text-emerald-600' : 'text-slate-900 dark:text-white'}`}>
                              {dayName}{isToday ? ' (Bugün)' : ''}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-400">
                              {slots.length} ders
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {slots.map((slot) => (
                              <div key={`sched-slot-${slot.id}`} className="flex items-center justify-between rounded-[10px] bg-slate-50 border border-slate-200/60 px-2.5 py-1.5 text-xs">
                                <span className="font-bold text-slate-700">{slot.startTime} - {slot.endTime}</span>
                                <span className="font-semibold text-slate-500 truncate ml-2">{slot.courseName || 'Genel'}</span>
                              </div>
                            ))}
                            {windows.map((win, wIdx) => (
                              <div key={`sched-win-${dayName}-${wIdx}`} className="flex items-center justify-between rounded-[10px] bg-blue-50 border border-blue-200/60 px-2.5 py-1.5 text-xs">
                                <span className="font-bold text-blue-700">{win.startTime} - {win.endTime}</span>
                                <span className="font-semibold text-blue-500 truncate ml-2">Çalışma Zamanı</span>
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

          {selectedCourseDetail && (
            <div className="dr-hig-secondary-card rounded-[26px] p-6" data-testid="overview-course-deep-dive-panel">
              <div className="mb-4 flex items-center justify-between">
                <h4 className="dr-hig-headline text-slate-900 dark:text-white">Ders Detay Sayfasi ({selectedCourseDetail.courseName})</h4>
                <div className="dr-hig-caption font-semibold text-slate-500 dark:text-slate-400">Periyot: {periodOptions.find((option) => option.value === overviewStudyPeriod)?.label || '1A'}</div>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                {overviewCoursesForDetail.map((course) => (
                  <button
                    key={`overview-course-v2-${course.courseName}`}
                    type="button"
                    onClick={() => setSelectedOverviewCourse(course.courseName)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${selectedCourseDetail.courseName === course.courseName ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}
                  >
                    {course.courseName}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[170px_minmax(0,1fr)]">
                <div className="ios-widget rounded-[18px] p-4">
                  <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-[8px] border-emerald-400/85 bg-white text-center">
                    <div>
                      <div className="text-3xl font-black text-slate-900">%{selectedCourseDetail.progress}</div>
                      <div className={`text-xs font-bold ${selectedCourseDetail.progress >= 75 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {selectedCourseDetail.progress >= 75 ? 'Iyi gidiyor' : 'Takipte'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="ios-widget rounded-[18px] p-4">
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div className="border-b border-white/50 pb-2">
                      <span className="text-slate-500">Hakimiyet</span>
                      <div className="font-black text-slate-900">%{selectedCourseDetail.progress}</div>
                    </div>
                    <div className="border-b border-white/50 pb-2">
                      <span className="text-slate-500">Haftalık değişim</span>
                      <div className={`font-black ${selectedCourseDelta ? selectedCourseDelta.tone : 'text-slate-500'}`}>
                        {selectedCourseDelta ? `${selectedCourseDelta.arrow} ${selectedCourseDelta.short}` : 'veri yok'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Riskli konu sayisi</span>
                      <div className="font-black text-slate-900">{selectedCourseDetail.weakCount}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Konu adedi</span>
                      <div className="font-black text-slate-900">{selectedCourseTopics.length}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ios-widget mt-4 rounded-[18px] p-4">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-300">Son 4 Haftalık Trend</div>
                {selectedCourseTrend.length === 4 ? (
                  <div className="rounded-[14px] bg-slate-50 border border-slate-200/50 shadow-sm p-3">
                    <svg viewBox="0 0 520 180" className="h-44 w-full" role="img" aria-label="Son 4 haftalik ders trendi">
                      <line x1="24" y1="146" x2="500" y2="146" stroke="var(--dr-border, #CBD5E1)" strokeWidth="1" />
                      <line x1="24" y1="116" x2="500" y2="116" stroke="var(--dr-border-subtle, #E2E8F0)" strokeWidth="1" />
                      <line x1="24" y1="86" x2="500" y2="86" stroke="var(--dr-border-subtle, #E2E8F0)" strokeWidth="1" />
                      <line x1="24" y1="56" x2="500" y2="56" stroke="var(--dr-border-subtle, #E2E8F0)" strokeWidth="1" />
                      <line x1="24" y1="26" x2="500" y2="26" stroke="var(--dr-border-subtle, #E2E8F0)" strokeWidth="1" />
                      <text x="6" y="150" fill="currentColor" className="text-slate-500 text-[10px]">%0</text>
                      <text x="2" y="120" fill="currentColor" className="text-slate-500 text-[10px]">%25</text>
                      <text x="2" y="90" fill="currentColor" className="text-slate-500 text-[10px]">%50</text>
                      <text x="2" y="60" fill="currentColor" className="text-slate-500 text-[10px]">%75</text>
                      <text x="2" y="30" fill="currentColor" className="text-slate-500 text-[10px]">%100</text>
                      {(() => {
                        const xPoints = [70, 200, 330, 460];
                        const yPoints = selectedCourseTrend.map((score) => 146 - Math.max(0, Math.min(100, score)) * 1.2);
                        const path = `M ${xPoints[0]} ${yPoints[0]} C ${xPoints[0] + 35} ${yPoints[0]} ${xPoints[1] - 35} ${yPoints[1]} ${xPoints[1]} ${yPoints[1]} C ${xPoints[1] + 35} ${yPoints[1]} ${xPoints[2] - 35} ${yPoints[2]} ${xPoints[2]} ${yPoints[2]} C ${xPoints[2] + 35} ${yPoints[2]} ${xPoints[3] - 35} ${yPoints[3]} ${xPoints[3]} ${yPoints[3]}`;
                        return (
                          <>
                            <path d={path} fill="none" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" />
                            {selectedCourseTrend.map((score, index) => (
                              <g key={`overview-trend-dot-v2-${index}`}>
                                <circle cx={xPoints[index]} cy={yPoints[index]} r="4" fill="#16A34A" />
                                <text x={xPoints[index] - 14} y={yPoints[index] - 10} fill="currentColor" className="text-slate-800 text-[11px] font-bold">%{score}</text>
                                <text x={xPoints[index] - 24} y="168" fill="currentColor" className="text-slate-500 text-[10px]">{index + 1}. Hafta</text>
                              </g>
                            ))}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                ) : (
                  <div className="rounded-[14px] bg-slate-50 border border-slate-200/50 shadow-sm p-3 text-sm text-slate-500">
                    Bu periyotta ders trend verisi yok. Planlama ekranından bu ders için soru çözümü veya tekrar görevi ekleyin.
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedTopicDetail && (
            <div className="dr-hig-secondary-card rounded-[26px] p-6" data-testid="overview-topic-deep-dive-panel">
              <div className="mb-4 flex items-center justify-between">
                <div className="min-w-0">
                  <h4 className="dr-hig-headline text-slate-900 dark:text-white">Konu Performansi</h4>
                  <div className="mt-1 truncate dr-hig-caption font-semibold text-slate-500 dark:text-slate-400">
                    Secili konu: {selectedTopicDetail.topicName}
                  </div>
                </div>
                <div className="ios-button rounded-[12px] px-3 py-1 text-xs font-bold text-slate-700">Son 14 Gun</div>
              </div>
              <div className="mb-4 grid gap-2 md:grid-cols-3">
                <label className="text-[11px] font-semibold text-slate-500">
                  Ders
                  <select
                    value={effectiveCourseFilter}
                    onChange={(event) => {
                      setPerformanceCourseFilter(event.target.value);
                      setPerformanceUnitFilter('ALL');
                      setPerformanceTopicFilter('ALL');
                    }}
                    className="ios-button mt-1 w-full rounded-[12px] px-2 py-2 text-xs font-bold text-slate-700"
                  >
                    <option value="ALL">Tum dersler</option>
                    {courseOptionsForPerformance.map((courseName) => (
                      <option key={`perf-course-head-${courseName}`} value={courseName}>{courseName}</option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] font-semibold text-slate-500">
                  Unite
                  <select
                    value={effectiveUnitFilter}
                    onChange={(event) => {
                      setPerformanceUnitFilter(event.target.value);
                      setPerformanceTopicFilter('ALL');
                    }}
                    className="ios-button mt-1 w-full rounded-[12px] px-2 py-2 text-xs font-bold text-slate-700"
                  >
                    <option value="ALL">Tum uniteler</option>
                    {unitOptionsForPerformance.map((unitName) => (
                      <option key={`perf-unit-head-${unitName}`} value={unitName}>{unitName}</option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] font-semibold text-slate-500">
                  Konu
                  <select
                    value={effectiveTopicFilter}
                    onChange={(event) => setPerformanceTopicFilter(event.target.value)}
                    className="ios-button mt-1 w-full rounded-[12px] px-2 py-2 text-xs font-bold text-slate-700"
                  >
                    <option value="ALL">Tum konular</option>
                    {topicOptionsForPerformance.map((topic) => (
                      <option key={`perf-topic-head-${topic.key}`} value={topic.key}>{topic.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mb-4 rounded-[12px] bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-600">
                Filtreler "Tüm" seçimindeyken son aktif ders/konu verisi gösterilir. Daha net takip için ders ve ünite seçin.
              </div>
              <div className="grid gap-4 lg:grid-cols-[170px_minmax(0,1fr)]">
                <div className="ios-widget rounded-[18px] p-4">
                  <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-[8px] border-rose-300/80 bg-white text-center">
                    <div>
                      <div className="text-3xl font-black text-slate-900">%{selectedTopicTaskMetrics?.accuracy ?? selectedTopicDetail.currentAccuracy ?? 0}</div>
                      <div className={`text-xs font-bold ${((selectedTopicTaskMetrics?.accuracy ?? selectedTopicDetail.currentAccuracy ?? 0) < 65) ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {(selectedTopicTaskMetrics?.accuracy ?? selectedTopicDetail.currentAccuracy ?? 0) < 65 ? 'Tekrar gerekiyor' : 'Iyi gidiyor'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="ios-widget rounded-[18px] p-4">
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div className="border-b border-white/50 pb-2">
                      <span className="text-slate-500">Çalışma</span>
                      <div className="font-black text-slate-900">{Math.floor((selectedTopicTaskMetrics?.minutes ?? 0) / 60)} sa {(selectedTopicTaskMetrics?.minutes ?? 0) % 60} dk</div>
                    </div>
                    <div className="border-b border-white/50 pb-2">
                      <span className="text-slate-500">Soru Cozum</span>
                      <div className="font-black text-slate-900">{selectedTopicTaskMetrics?.solved ?? 0} soru</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Dogruluk Orani</span>
                      <div className="font-black text-slate-900">%{selectedTopicTaskMetrics?.accuracy ?? selectedTopicDetail.currentAccuracy ?? 0}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Tekrar Ihtiyaci</span>
                      <div className={`font-black ${selectedTopicTaskMetrics?.retryNeed === 'Yuksek' ? 'text-rose-600' : selectedTopicTaskMetrics?.retryNeed === 'Orta' ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {selectedTopicTaskMetrics?.retryNeed || 'Dusuk'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {selectedTopicAction && (
                <div className="mt-4 rounded-[14px] bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  Neden: {selectedTopicAction.reason} · Bugun yapilacak: {selectedTopicAction.action} · Gorev: {selectedTopicAction.taskStatus}
                </div>
              )}
              {!selectedTopicAction && (
                <div className="mt-4 rounded-[14px] bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                  Bu konu icin ek karar notu bulunmuyor.
                </div>
              )}
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="ios-widget rounded-[18px] p-4">
                  <div className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-slate-300">Konu Performansi</div>
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-[110px_minmax(0,1fr)_42px] items-center gap-2">
                      <span className="text-slate-200">Çalışma</span>
                      <div className="h-2 rounded-full bg-white/15">
                        <div className="h-full rounded-full bg-rose-400" style={{ width: `${Math.max(10, Math.min(100, Math.round(((selectedTopicTaskMetrics?.minutes ?? 0) / 240) * 100)))}%` }} />
                      </div>
                      <span className="text-right font-black text-slate-100">%{Math.max(10, Math.min(100, Math.round(((selectedTopicTaskMetrics?.minutes ?? 0) / 240) * 100)))}</span>
                    </div>
                    <div className="grid grid-cols-[110px_minmax(0,1fr)_42px] items-center gap-2">
                      <span className="text-slate-200">Soru Cozumu</span>
                      <div className="h-2 rounded-full bg-white/15">
                        <div className="h-full rounded-full bg-rose-400" style={{ width: `${selectedTopicTaskMetrics?.practicePerf ?? 0}%` }} />
                      </div>
                      <span className="text-right font-black text-slate-100">%{selectedTopicTaskMetrics?.practicePerf ?? 0}</span>
                    </div>
                    <div className="grid grid-cols-[110px_minmax(0,1fr)_42px] items-center gap-2">
                      <span className="text-slate-200">Deneme</span>
                      <div className="h-2 rounded-full bg-white/15">
                        <div className="h-full rounded-full bg-rose-400" style={{ width: `${selectedTopicTaskMetrics?.testPerf ?? 0}%` }} />
                      </div>
                      <span className="text-right font-black text-slate-100">%{selectedTopicTaskMetrics?.testPerf ?? 0}</span>
                    </div>
                    <div className="grid grid-cols-[110px_minmax(0,1fr)_42px] items-center gap-2">
                      <span className="text-slate-200">Gunluk Tekrar</span>
                      <div className="h-2 rounded-full bg-white/15">
                        <div className="h-full rounded-full bg-rose-400" style={{ width: `${selectedTopicTaskMetrics?.dailyPerf ?? 0}%` }} />
                      </div>
                      <span className="text-right font-black text-slate-100">%{selectedTopicTaskMetrics?.dailyPerf ?? 0}</span>
                    </div>
                  </div>
                </div>
                <div className="ios-widget rounded-[18px] p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-300">Soru Sonuc Ozeti</div>
                    <div className="text-[11px] font-semibold text-slate-400">
                      {aggregatedPerformanceMetrics.lastCompletedAt
                        ? `Son aktivite ${aggregatedPerformanceMetrics.lastCompletedAt}`
                        : 'Son aktivite yok'}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-[12px] bg-slate-50 border border-slate-200/60 shadow-sm px-3 py-2 text-xs">
                      <div className="text-slate-500 font-semibold">Toplam Soru</div>
                      <div className="mt-1 text-lg font-black text-slate-800">{aggregatedPerformanceMetrics.totalQuestions}</div>
                    </div>
                    <div className="rounded-[12px] bg-slate-50 border border-slate-200/60 shadow-sm px-3 py-2 text-xs">
                      <div className="text-slate-500 font-semibold">Dogru</div>
                      <div className="mt-1 text-lg font-black text-emerald-600">{aggregatedPerformanceMetrics.correctCount}</div>
                    </div>
                    <div className="rounded-[12px] bg-slate-50 border border-slate-200/60 shadow-sm px-3 py-2 text-xs">
                      <div className="text-slate-500 font-semibold">Yanlis</div>
                      <div className="mt-1 text-lg font-black text-rose-600">{aggregatedPerformanceMetrics.incorrectCount}</div>
                    </div>
                    <div className="rounded-[12px] bg-slate-50 border border-slate-200/60 shadow-sm px-3 py-2 text-xs">
                      <div className="text-slate-500 font-semibold">Bos</div>
                      <div className="mt-1 text-lg font-black text-amber-600">{aggregatedPerformanceMetrics.emptyCount}</div>
                    </div>
                    <div className="rounded-[12px] bg-slate-50 border border-slate-200/60 shadow-sm px-3 py-2 text-xs">
                      <div className="text-slate-500 font-semibold">Dogruluk %</div>
                      <div className="mt-1 text-lg font-black text-slate-800">%{aggregatedPerformanceMetrics.accuracyPercent}</div>
                    </div>
                    <div className="rounded-[12px] bg-slate-50 border border-slate-200/60 shadow-sm px-3 py-2 text-xs">
                      <div className="text-slate-500 font-semibold">Çalışma Süresi</div>
                      <div className="mt-1 text-lg font-black text-slate-800">{formatMinutes(aggregatedPerformanceMetrics.minutes)}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-[11px] font-semibold text-slate-400">
                    {aggregatedPerformanceMetrics.taskCount > 0
                      ? `${aggregatedPerformanceMetrics.taskCount} gorev kaydindan hesaplandi.`
                      : 'Secilen filtrede soru verisi bulunmuyor.'}
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-[14px] bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                Oneri: Bu konuda duzenli tekrar ve bol soru cozum ile %70+ seviyeye ulasilabilir.
              </div>
            </div>
          )}

          <div className="dr-hig-secondary-card rounded-[26px] p-6">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="dr-hig-headline text-slate-900 dark:text-white">Rapor Sayfasi</h4>
              <div className="dr-hig-caption font-semibold text-slate-500 dark:text-slate-400">Periyot: {periodOptions.find((option) => option.value === overviewStudyPeriod)?.label || '1A'}</div>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setReportCardTab('general')} className={`rounded-[12px] px-3 py-1.5 text-xs font-bold ${reportCardTab === 'general' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}>Genel Rapor</button>
              <button type="button" onClick={() => setReportCardTab('course')} className={`rounded-[12px] px-3 py-1.5 text-xs font-bold ${reportCardTab === 'course' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}>Ders Raporu</button>
              <button type="button" onClick={() => setReportCardTab('topic')} className={`rounded-[12px] px-3 py-1.5 text-xs font-bold ${reportCardTab === 'topic' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}>Konu Raporu</button>
              <button type="button" onClick={() => setReportCardTab('time')} className={`rounded-[12px] px-3 py-1.5 text-xs font-bold ${reportCardTab === 'time' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}>Zaman Raporu</button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {reportSummaryItems.map((item) => (
                <div key={`report-summary-${item.label}`} className="ios-widget rounded-[14px] px-3 py-2.5">
                  <div className="text-[11px] text-slate-500">{item.label}</div>
                  <div className="mt-1 truncate text-base font-black text-slate-900">{item.value}</div>
                  <div className="mt-1 text-[11px] font-semibold text-slate-500">{item.hint}</div>
                </div>
              ))}
            </div>
            {reportCardTab === 'course' ? (
              <div className="mt-4">
                <div className="ios-widget rounded-[14px] p-3">
                  <div className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">Ders Raporu Trendi</div>
                  {courseReportSeriesForChart.length > 0 ? (
                    <>
                      <svg viewBox="0 0 620 220" className="h-52 w-full" aria-label="Ders raporu trendi">
                        <line x1="30" y1="182" x2="600" y2="182" stroke="#CBD5E1" strokeWidth="1" />
                        {[0, 25, 50, 75, 100].map((tick, i) => (
                          <g key={`ctick-${tick}`}>
                            <line x1="30" y1={182 - i * 38} x2="600" y2={182 - i * 38} stroke="#E2E8F0" strokeWidth="1" />
                            <text x="4" y={186 - i * 38} className="fill-slate-400 text-[10px]">%{tick}</text>
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
                          <text key={`cxlabel-${label}`} x={[70, 230, 390, 550][idx]} y="206" className="fill-slate-500 text-[11px]">{label}</text>
                        ))}
                      </svg>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                        {courseReportSeriesForChart.map((series) => (
                          <span key={`clegend-${series.courseName}`} className="inline-flex items-center gap-1 text-slate-600">
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
                  <div className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">Ders Durumu</div>
                  <svg viewBox="0 0 620 220" className="h-52 w-full" aria-label="Ders durumu cizgi grafigi">
                    <line x1="30" y1="182" x2="600" y2="182" stroke="#CBD5E1" strokeWidth="1" />
                    {[0, 25, 50, 75, 100].map((tick, i) => (
                      <g key={`status-tick-${tick}`}>
                        <line x1="30" y1={182 - i * 38} x2="600" y2={182 - i * 38} stroke="#E2E8F0" strokeWidth="1" />
                        <text x="4" y={186 - i * 38} className="fill-slate-400 text-[10px]">%{tick}</text>
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
                              <text x={p.x - 13} y={p.y - 10} className="fill-slate-200 text-[11px] font-bold">%{p.course.progress}</text>
                              <text x={Math.max(34, p.x - 36)} y="206" className="fill-slate-500 text-[10px]">
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
                        <text x="4" y={186 - i * 38} className="fill-slate-400 text-[10px]">%{tick}</text>
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
                      <text key={`xlabel-${label}`} x={[70, 230, 390, 550][idx]} y="206" className="fill-slate-500 text-[11px]">{label}</text>
                    ))}
                  </svg>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                    {safeReportSeriesForChart.map((series) => (
                      <span key={`glegend-${series.courseName}`} className="inline-flex items-center gap-1 text-slate-600">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: series.color }} />
                        {series.courseName}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="ios-widget rounded-[14px] p-3">
                    <div className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">En Cok Gelisen Konular</div>
                    <div className="space-y-1.5">
                      {topicImproving
                        .map((item, idx) => (
                          <div key={`grow-topic-${item.key}`} className="flex items-center justify-between text-xs">
                            <span className="text-slate-700">{idx + 1}. {item.topicName}</span>
                            <span className="font-black text-emerald-600">+%{item.delta}</span>
                          </div>
                        ))}
                      {topicImproving.length === 0 && (
                        <div className="text-xs text-slate-500">Yeterli haftalik konu verisi yok.</div>
                      )}
                    </div>
                  </div>
                  <div className="ios-widget rounded-[14px] p-3">
                    <div className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">Zorlanilan Konular</div>
                    <div className="space-y-1.5">
                      {topicHard.map((item, idx) => (
                        <div key={`hard-${item.key}`} className="flex items-center justify-between text-xs">
                          <span className="text-slate-700">{idx + 1}. {item.topicName}</span>
                          <span className="font-black text-rose-600">{item.riskScore !== null ? `risk ${item.riskScore}` : 'risk'}</span>
                        </div>
                      ))}
                      {topicHard.length === 0 && (
                        <div className="text-xs text-slate-500">Risk analizi icin konu verisi yok.</div>
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


