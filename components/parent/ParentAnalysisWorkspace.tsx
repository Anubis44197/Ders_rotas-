import React, { useMemo, useState } from 'react';
import { Course, ParentDashboardProps, ReportData, Task } from '../../types';
import { AnalysisSnapshot } from '../../utils/analysisEngine';
import { getTopicDecisionLevel, type ParentDecisionResult } from '../../utils/parentDecisionEngine';
import { getTodayString } from '../../utils/dateUtils';
// AnalysisGraphCenter removed for O(1) performance optimization under heavy loads
import { examTypeLabelMap } from './parentDashboardShared';
import { AlertTriangle, BarChart, BookOpen, CheckCircle, ClipboardList, Clock, FileText, GraduationCap, PlusCircle, Target, TrendingUp } from '../icons';
import ContextHelp from '../shared/ContextHelp';
import { isCompletedTask } from '../../utils/taskStatus';

const surface = 'dr-hig-secondary-card rounded-[30px] p-6';
const subtleSurface = 'ios-widget rounded-[24px] p-5';

type AnalysisWorkspaceTab = 'overview' | 'insights' | 'goals' | 'reports';
type ReportPeriod = ReportData['period'];
type ReportViewTab = 'general' | 'course' | 'topic' | 'time';

interface ParentAnalysisWorkspaceProps {
  tasks: Task[];
  courses: Course[];
  curriculum: ParentDashboardProps['curriculum'];
  analysis: AnalysisSnapshot;
  decision?: ParentDecisionResult;
  examRecords: NonNullable<ParentDashboardProps['examRecords']>;
  compositeExamResults: NonNullable<ParentDashboardProps['compositeExamResults']>;
  generateReport: ParentDashboardProps['generateReport'];
  addTask?: ParentDashboardProps['addTask'];
  onActionMessage?: (type: 'success' | 'error', text: string) => void;
  loading?: ParentDashboardProps['loading'];
  error?: ParentDashboardProps['error'];
  viewMode: NonNullable<ParentDashboardProps['viewMode']>;
  overviewTodayOperational?: ParentDashboardProps['overviewTodayOperational'];
  overviewTodaySlots?: any[];
  overviewTodayName?: string;
  overviewUpcomingExam?: any;
  overviewExamDecision?: any;
  onOpenPlanning?: (message: string) => void;
}

const analysisWorkspaceTabs: Array<{ id: AnalysisWorkspaceTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Genel Durum', icon: Target },
  { id: 'insights', label: 'Odak Alanlari', icon: AlertTriangle },
  { id: 'goals', label: 'Hedef ve Deneme', icon: ClipboardList },
  { id: 'reports', label: 'Raporlar', icon: BarChart },
];

const reportPeriods: ReportPeriod[] = ['Haftalık', 'Aylık', '3 Aylık', 'Tüm Zamanlar'];
const GOAL_CONFIG_STORAGE_KEY = 'parentGoalConfigV1';
const LGS_TARGET_DATE_STORAGE_KEY = 'parentLgsTargetDate';
const LGS_TARGET_NET_STORAGE_KEY = 'parentLgsTargetNet';

interface ParentGoalConfig {
  weeklyQuestionTarget: number;
  weeklyStudyMinuteTarget: number;
  topicCompletionTarget: number;
  courseQuestionTargets: Record<string, number>;
  lgsTargetDate: string;
  lgsTargetNet: number;
}

const DEFAULT_PARENT_GOAL_CONFIG: ParentGoalConfig = {
  weeklyQuestionTarget: 200,
  weeklyStudyMinuteTarget: 600,
  topicCompletionTarget: 8,
  courseQuestionTargets: {},
  lgsTargetDate: '',
  lgsTargetNet: 400,
};

const safeClampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getCompositeAverage = (result?: NonNullable<ParentDashboardProps['compositeExamResults']>[number]): number | null => {
  if (!result || !Array.isArray(result.courses) || result.courses.length === 0) return null;
  const scores = result.courses
    .map((course) => Number(course.score))
    .filter((score) => Number.isFinite(score));
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
};

const normalizeGoalConfig = (value: unknown): ParentGoalConfig => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_PARENT_GOAL_CONFIG;
  const candidate = value as Partial<ParentGoalConfig>;
  const toNumber = (entry: unknown, fallback: number) => {
    const parsed = Number(entry);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const rawTargets = candidate.courseQuestionTargets;
  const normalizedTargets: Record<string, number> = {};
  if (rawTargets && typeof rawTargets === 'object' && !Array.isArray(rawTargets)) {
    Object.entries(rawTargets).forEach(([courseId, target]) => {
      const parsed = Number(target);
      if (Number.isFinite(parsed)) normalizedTargets[courseId] = safeClampNumber(parsed, 0, 1000);
    });
  }
  return {
    weeklyQuestionTarget: safeClampNumber(toNumber(candidate.weeklyQuestionTarget, DEFAULT_PARENT_GOAL_CONFIG.weeklyQuestionTarget), 0, 2000),
    weeklyStudyMinuteTarget: safeClampNumber(toNumber(candidate.weeklyStudyMinuteTarget, DEFAULT_PARENT_GOAL_CONFIG.weeklyStudyMinuteTarget), 0, 5000),
    topicCompletionTarget: safeClampNumber(toNumber(candidate.topicCompletionTarget, DEFAULT_PARENT_GOAL_CONFIG.topicCompletionTarget), 0, 100),
    courseQuestionTargets: normalizedTargets,
    lgsTargetDate: typeof candidate.lgsTargetDate === 'string' ? candidate.lgsTargetDate : '',
    lgsTargetNet: safeClampNumber(toNumber(candidate.lgsTargetNet, DEFAULT_PARENT_GOAL_CONFIG.lgsTargetNet), 0, 500),
  };
};

const getScoreTone = (score: number) => {
  if (score >= 85) return 'ios-mint';
  if (score >= 70) return 'ios-blue';
  if (score >= 55) return 'ios-peach';
  return 'ios-coral';
};

const getRiskTone = (risk: number) => {
  if (risk >= 65) return 'dr-status-pill dr-status-pill-critical';
  if (risk >= 45) return 'dr-status-pill dr-status-pill-warning';
  return 'dr-status-pill dr-status-pill-success';
};

const getDecisionTone = (level: 'Kritik' | 'Dikkat' | 'Takip et' | 'Stabil') => {
  if (level === 'Kritik') return 'dr-status-pill dr-status-pill-critical';
  if (level === 'Dikkat') return 'dr-status-pill dr-status-pill-warning';
  return 'dr-status-pill dr-status-pill-success';
};

const getDeltaDisplay = (delta: number) => {
  if (delta > 0) return { arrow: '↑', text: `Gecen haftaya gore +%${Math.abs(delta)}`, short: `+%${Math.abs(delta)}`, tone: 'text-emerald-600' };
  if (delta < 0) return { arrow: '↓', text: `Gecen haftaya gore -%${Math.abs(delta)}`, short: `-%${Math.abs(delta)}`, tone: 'text-rose-600' };
  return { arrow: '→', text: 'Gecen haftaya gore %0', short: '%0', tone: 'text-blue-600' };
};
const resolveRequestedTab = (value: string | null): AnalysisWorkspaceTab => {
  if (value === 'alignment') return 'goals';
  if (value === 'overview' || value === 'insights' || value === 'goals' || value === 'reports') return value;
  return 'overview';
};

const getDataConfidence = (sessionCount: number) => {
  if (sessionCount >= 24) return 'Yuksek guven';
  if (sessionCount >= 8) return 'Orta guven';
  return 'Dusuk guven';
};

const normalizeTopicKey = (value: string) =>
  value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 40);

const normalizeText = (value: string) =>
  value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const TOPIC_PREREQUISITE_MAP: Record<string, string[]> = {
  'matematik::uslu ifadeler': ['Carpanlar ve Katlar'],
  'matematik::karekoklu ifadeler': ['Uslu ifadeler'],
  'matematik::cebirsel ifadeler ve ozdeslikler': ['Uslu ifadeler'],
  'matematik::dogrusal denklemler': ['Cebirsel ifadeler ve ozdeslikler'],
};

const ProgressBar: React.FC<{ value: number; tone?: string }> = ({ value, tone = 'bg-[var(--dr-orange)]' }) => (
  <div className="ios-progress-track h-2 overflow-hidden rounded-full">
    <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
  </div>
);

type AnalysisState = 'ready' | 'loading' | 'error' | 'low-data';

const ParentAnalysisWorkspace: React.FC<ParentAnalysisWorkspaceProps> = ({
  tasks,
  courses,
  curriculum,
  analysis,
  decision,
  examRecords,
  compositeExamResults,
  generateReport,
  addTask,
  onActionMessage,
  loading,
  error,
  viewMode,
  overviewTodayOperational,
  overviewTodaySlots = [],
  overviewTodayName = '',
  overviewUpcomingExam,
  overviewExamDecision = { title: 'Takvimde yeni sınav yok', detail: 'Planlama ekranından tarih eklenebilir', action: 'Tüm sınavları gör', tone: 'ios-button text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700' },
  onOpenPlanning = () => {},
}) => {
  const [analysisWorkspaceTab, setAnalysisWorkspaceTab] = useState<AnalysisWorkspaceTab>(() => {
    if (typeof window === 'undefined') return 'overview';
    return resolveRequestedTab(new URLSearchParams(window.location.search).get('analysisTab'));
  });
  const isE2EMode = useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('e2e') === '1',
    [],
  );
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('Haftalık');
  const [reportViewTab, setReportViewTab] = useState<ReportViewTab>('general');
  const [report, setReport] = useState<ReportData | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [hasRecalculated, setHasRecalculated] = useState(false);
  const [isCreatingAction, setIsCreatingAction] = useState(false);
  const [selectedCourseDetailId, setSelectedCourseDetailId] = useState<string | null>(null);
  const [selectedTopicDetailKey, setSelectedTopicDetailKey] = useState<string | null>(null);
  const [goalConfig, setGoalConfig] = useState<ParentGoalConfig>(() => {
    if (typeof window === 'undefined') return DEFAULT_PARENT_GOAL_CONFIG;
    try {
      const stored = window.localStorage.getItem(GOAL_CONFIG_STORAGE_KEY);
      if (!stored) return DEFAULT_PARENT_GOAL_CONFIG;
      return normalizeGoalConfig(JSON.parse(stored));
    } catch {
      return DEFAULT_PARENT_GOAL_CONFIG;
    }
  });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(GOAL_CONFIG_STORAGE_KEY, JSON.stringify(goalConfig));
    window.localStorage.setItem(LGS_TARGET_DATE_STORAGE_KEY, goalConfig.lgsTargetDate);
    window.localStorage.setItem(LGS_TARGET_NET_STORAGE_KEY, String(goalConfig.lgsTargetNet));
  }, [goalConfig]);

  const completedTasksForMetrics = useMemo(() => tasks.filter(isCompletedTask), [tasks]);
  const weakTopics = useMemo(() => analysis.topics.filter((topic) => topic.needsRevision).slice(0, 6), [analysis.topics]);
  const topicMasteryLookup = useMemo(() => {
    const map = new Map<string, number>();
    analysis.topics.forEach((topic) => {
      map.set(`${normalizeText(topic.courseName)}::${normalizeText(topic.topicName)}`, topic.masteryScore);
    });
    return map;
  }, [analysis.topics]);
  const getPrerequisiteHint = (courseName: string, topicName: string) => {
    const key = `${normalizeText(courseName)}::${normalizeText(topicName)}`;
    const prerequisites = TOPIC_PREREQUISITE_MAP[key];
    if (!prerequisites || prerequisites.length === 0) return null;
    const unmet = prerequisites.find((prerequisiteTopic) => {
      const prerequisiteKey = `${normalizeText(courseName)}::${normalizeText(prerequisiteTopic)}`;
      const mastery = topicMasteryLookup.get(prerequisiteKey);
      return typeof mastery !== 'number' || mastery < 70;
    });
    return unmet ? `${topicName} oncesi ${unmet} kisa tekrar istiyor.` : null;
  };
  const improvingTopics = useMemo(
    () => [...analysis.topics].filter((topic) => topic.trend === 'up').sort((a, b) => b.masteryScore - a.masteryScore).slice(0, 5),
    [analysis.topics],
  );
  const hardestTopics = useMemo(
    () => [...analysis.topics]
      .filter((topic) => topic.riskScore >= 45 || topic.masteryScore < 70)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5),
    [analysis.topics],
  );
  const topCourses = useMemo(() => {
    const activeCourses = courses.filter((course) => course.active !== false);
    const analysisById = new Map(analysis.courses.map((course) => [course.courseId, course]));
    return activeCourses
      .map((course) => {
        const fromAnalysis = analysisById.get(course.id);
        if (fromAnalysis) return fromAnalysis;
        return {
          courseId: course.id,
          courseName: course.name,
          averageMastery: 0,
          averageFocus: 0,
          averageEfficiency: 0,
          weakTopicCount: 0,
          completionRate: 0,
          trend: 'flat' as const,
        };
      })
      .sort((a, b) => b.averageMastery - a.averageMastery);
  }, [analysis.courses, courses]);
  React.useEffect(() => {
    if (topCourses.length === 0) {
      setSelectedCourseDetailId(null);
      return;
    }
    if (!selectedCourseDetailId || !topCourses.some((course) => course.courseId === selectedCourseDetailId)) {
      setSelectedCourseDetailId(topCourses[0].courseId);
    }
  }, [selectedCourseDetailId, topCourses]);
  const selectedCourseDetail = useMemo(
    () => topCourses.find((course) => course.courseId === selectedCourseDetailId) || topCourses[0] || null,
    [selectedCourseDetailId, topCourses],
  );
  const selectedCourseTopics = useMemo(() => {
    if (!selectedCourseDetail) return [];
    return analysis.topics
      .filter((topic) => topic.courseId === selectedCourseDetail.courseId)
      .sort((a, b) => a.masteryScore - b.masteryScore)
      .slice(0, 6);
  }, [analysis.topics, selectedCourseDetail]);
  React.useEffect(() => {
    if (selectedCourseTopics.length === 0) {
      setSelectedTopicDetailKey(null);
      return;
    }
    if (!selectedTopicDetailKey || !selectedCourseTopics.some((topic) => topic.key === selectedTopicDetailKey)) {
      setSelectedTopicDetailKey(selectedCourseTopics[0].key);
    }
  }, [selectedCourseTopics, selectedTopicDetailKey]);
  const selectedTopicDetail = useMemo(
    () => selectedCourseTopics.find((topic) => topic.key === selectedTopicDetailKey) || selectedCourseTopics[0] || null,
    [selectedCourseTopics, selectedTopicDetailKey],
  );
  const recentExamRecords = analysis.school.examRecords.slice(0, 5);
  const latestStateExam = analysis.school.latestStateExam;
  const pendingCount = tasks.filter((task) => task.status === 'bekliyor').length;
  const completedCount = completedTasksForMetrics.length;
  const solvedQuestionCount = useMemo(() => completedTasksForMetrics
    .filter((task) => task.taskType === 'soru çözme')
    .reduce((sum, task) => {
      const hasRecordedCounts = typeof task.correctCount === 'number' || typeof task.incorrectCount === 'number';
      const answered = (task.correctCount || 0) + (task.incorrectCount || 0);
      return sum + (hasRecordedCounts ? answered : (task.questionCount || 0));
    }, 0), [completedTasksForMetrics]);
  const studiedMinutes = useMemo(() => Math.round(completedTasksForMetrics
    .filter((task) => task.taskType !== 'kitap okuma')
    .reduce((sum, task) => sum + ((task.actualDuration || 0) / 60), 0)), [completedTasksForMetrics]);
  const readPages = useMemo(() => completedTasksForMetrics
    .filter((task) => task.taskType === 'kitap okuma')
    .reduce((sum, task) => sum + (task.pagesRead || 0), 0), [completedTasksForMetrics]);
  const parentActionTasks = useMemo(
    () => tasks.filter((task) => (task.planTaskId || '').startsWith('parent-action-') || (task.planLabel || '').toLocaleLowerCase('tr-TR').includes('veli onerisi')),
    [tasks],
  );
  const parentActionPendingCount = useMemo(
    () => parentActionTasks.filter((task) => task.status === 'bekliyor').length,
    [parentActionTasks],
  );
  const parentActionCompletedCount = useMemo(
    () => parentActionTasks.filter((task) => isCompletedTask(task)).length,
    [parentActionTasks],
  );
  const parentActionCompletedTodayCount = useMemo(() => {
    const today = getTodayString();
    return parentActionTasks.filter((task) => isCompletedTask(task) && task.completionDate === today).length;
  }, [parentActionTasks]);

  const weeklyTasks = useMemo(() => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekStartYYYYMMDD = weekStart.toISOString().split('T')[0];
    return completedTasksForMetrics.filter((task) => task.completionDate && task.completionDate >= weekStartYYYYMMDD);
  }, [completedTasksForMetrics]);

  const weeklyStats = useMemo(() => {
    const questionCount = weeklyTasks
      .filter((task) => task.taskType === 'soru çözme')
      .reduce((sum, task) => {
        const hasRecordedCounts = typeof task.correctCount === 'number' || typeof task.incorrectCount === 'number';
        const answered = (task.correctCount || 0) + (task.incorrectCount || 0);
        return sum + (hasRecordedCounts ? answered : (task.questionCount || 0));
      }, 0);
    const minutes = Math.round(
      weeklyTasks
        .filter((task) => task.taskType !== 'kitap okuma')
        .reduce((sum, task) => sum + ((task.actualDuration || 0) / 60), 0)
    );
    const courseIds = new Set(weeklyTasks.map((task) => task.courseId));
    const openTopics = analysis.topics.filter((topic) => topic.riskScore >= 45 || topic.masteryScore < 70).length;
    return { completed: weeklyTasks.length, questions: questionCount, minutes, courses: courseIds.size, openTopics };
  }, [weeklyTasks, analysis.topics]);
  const suspiciousTaskCount = useMemo(
    () =>
      completedTasksForMetrics.filter((task) => {
        const answered = (task.correctCount || 0) + (task.incorrectCount || 0);
        const durationSec = task.actualDuration || 0;
        const longIdle = durationSec > 3 * 60 * 60 && answered < 10;
        const tooFastHighVolume = answered >= 100 && durationSec > 0 && durationSec < 120;
        const completedNoProgress = answered === 0 && (task.questionCount || 0) > 0 && durationSec < 60;
        return longIdle || tooFastHighVolume || completedNoProgress;
      }).length,
    [completedTasksForMetrics],
  );
  const dataReliabilityLabel = useMemo(() => {
    if (completedTasksForMetrics.length === 0) return 'Yeterli veri yok';
    const ratio = suspiciousTaskCount / completedTasksForMetrics.length;
    if (ratio >= 0.25) return 'Dusuk guven';
    if (ratio >= 0.1) return 'Orta guven';
    return 'Yuksek guven';
  }, [completedTasksForMetrics.length, suspiciousTaskCount]);

  const showAnalysis = viewMode === 'all' || viewMode === 'analysis';
  const showSection = (tab: AnalysisWorkspaceTab) => viewMode === 'all' || analysisWorkspaceTab === tab;
  const strongestCourse = topCourses[0];
  const riskiestTopic = weakTopics[0];
  const dataConfidence = getDataConfidence(analysis.sessions.length);
  const latestCompositeAverage = getCompositeAverage(compositeExamResults[0]);
  const previousCompositeAverage = getCompositeAverage(compositeExamResults[1]);
  const lgsTargetDate = useMemo(() => {
    if (!goalConfig.lgsTargetDate) return null;
    const parsed = new Date(goalConfig.lgsTargetDate);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }, [goalConfig.lgsTargetDate]);
  const lgsTargetNet = useMemo(
    () => (goalConfig.lgsTargetNet > 0 ? goalConfig.lgsTargetNet : null),
    [goalConfig.lgsTargetNet],
  );
  const lgsDaysLeft = useMemo(() => {
    if (!lgsTargetDate) return null;
    const now = new Date();
    const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfTarget = new Date(lgsTargetDate.getFullYear(), lgsTargetDate.getMonth(), lgsTargetDate.getDate()).getTime();
    return Math.ceil((startOfTarget - startOfNow) / (1000 * 60 * 60 * 24));
  }, [lgsTargetDate]);
  const lgsReadinessByCourse = useMemo(
    () =>
      topCourses.slice(0, 5).map((course) => ({
        courseName: course.courseName,
        mastery: course.averageMastery,
        readinessLabel: course.averageMastery >= 80 ? 'Hedefe yakin' : course.averageMastery >= 65 ? 'Takipte' : 'Destek gerekiyor',
      })),
    [topCourses],
  );
  const curriculumCompletionRate = useMemo(() => {
    const units = Object.values(curriculum || {}).flat();
    const topics = units.flatMap((unit) => unit.topics || []);
    if (topics.length === 0) return null;
    const completed = topics.filter((topic) => topic.completed).length;
    return Math.round((completed / topics.length) * 100);
  }, [curriculum]);
  const lgsReadinessGap = useMemo(() => {
    if (lgsTargetNet === null || latestCompositeAverage === null) return null;
    return Math.round(lgsTargetNet - latestCompositeAverage);
  }, [latestCompositeAverage, lgsTargetNet]);
  const topicCompletionCount = useMemo(() => {
    const units = Object.values(curriculum || {}).flat();
    const topics = units.flatMap((unit) => unit.topics || []);
    return topics.filter((topic) => topic.completed).length;
  }, [curriculum]);
  const weeklyQuestionProgress = useMemo(
    () => (goalConfig.weeklyQuestionTarget > 0 ? Math.round((weeklyStats.questions / goalConfig.weeklyQuestionTarget) * 100) : 0),
    [goalConfig.weeklyQuestionTarget, weeklyStats.questions],
  );
  const weeklyMinuteProgress = useMemo(
    () => (goalConfig.weeklyStudyMinuteTarget > 0 ? Math.round((weeklyStats.minutes / goalConfig.weeklyStudyMinuteTarget) * 100) : 0),
    [goalConfig.weeklyStudyMinuteTarget, weeklyStats.minutes],
  );
  const topicProgress = useMemo(
    () => (goalConfig.topicCompletionTarget > 0 ? Math.round((topicCompletionCount / goalConfig.topicCompletionTarget) * 100) : 0),
    [goalConfig.topicCompletionTarget, topicCompletionCount],
  );
  const effectiveDecision = useMemo(() => decision || {
    trend: 'Stabil' as const,
    alerts: [],
    topAlert: {
      level: 'Stabil' as const,
      text: 'Mevcut ritim dengeli.',
      action: 'Mevcut plani koruyun.',
      confidence: 'Yuksek' as const,
      urgency: 0,
      severityScore: 0,
      tier: 'silent' as const,
    },
    diagnostics: {
      scoringVersion: 'v1.0',
      rulesVersion: 'v1.0',
      thresholdVersion: 'v1.0',
      thresholds: {
        lowDataSessionCount: 3,
        noStudyDaysCritical: 3,
        weakTopicCountWarning: 3,
        riskWarningMin: 45,
        riskCriticalMin: 65,
      },
      weights: {
        noStudy: 42,
        trendDrop: 26,
        weakTopics: 22,
        risk: 18,
        lowDataPenalty: 14,
      },
    },
  }, [decision]);

  const trendLabel = effectiveDecision.trend;
  const todayOperational = overviewTodayOperational || {
    plannedCount: 0,
    completedTodayCount: 0,
    pendingTodayCount: 0,
    overdueCount: 0,
  };
  const todayPlanCompletion = todayOperational.plannedCount > 0
    ? Math.round((todayOperational.completedTodayCount / todayOperational.plannedCount) * 100)
    : 0;
  const examDelta = latestCompositeAverage !== null && previousCompositeAverage !== null
    ? latestCompositeAverage - previousCompositeAverage
    : 0;
  const examDeltaDisplay = getDeltaDisplay(examDelta);
  const decisionTrendDisplay = trendLabel === 'Yukseliyor'
    ? { arrow: '↑', tone: 'text-emerald-600' }
    : trendLabel === 'Dusuyor' || trendLabel === 'Hizli dusuyor'
      ? { arrow: '↓', tone: 'text-rose-600' }
      : { arrow: '→', tone: 'text-blue-600' };
  const goalAlerts = effectiveDecision.alerts;
  const topGoalAlert = effectiveDecision.topAlert;
  const parentActionAuditLine = useMemo(() => {
    if (parentActionCompletedTodayCount > 0) {
      return `Bugun ${parentActionCompletedTodayCount} veli gorevi tamamlandi; kritik uyarilar otomatik yumusatildi.`;
    }
    if (parentActionPendingCount > 0) {
      return `Bekleyen ${parentActionPendingCount} veli gorevi var; sistem bu gorevleri oncelikli izliyor.`;
    }
    if (parentActionCompletedCount > 0) {
      return `Toplam ${parentActionCompletedCount} veli gorevi tamamlandi; yeni uyari yoksa ritim korunuyor.`;
    }
    return 'Henuz veli aksiyon kaydi yok.';
  }, [parentActionCompletedCount, parentActionCompletedTodayCount, parentActionPendingCount]);

  // Akademik Kalite Göstergeleri local O(N) optimized calculations (no charts to handle 6000+ records)
  const firstAttemptAverage = useMemo(() => {
    const firstAttemptValues = analysis.topics
      .map((topic) => topic.firstAttemptScore)
      .filter((value): value is number => typeof value === 'number');
    return firstAttemptValues.length > 0
      ? Math.round(firstAttemptValues.reduce((sum, value) => sum + value, 0) / firstAttemptValues.length)
      : null;
  }, [analysis.topics]);

  const goldenHourInsight = useMemo(() => {
    if (!analysis.studyWindows.length) {
      return { label: '-', focus: null as number | null, accuracy: null as number | null };
    }
    const best = [...analysis.studyWindows].sort((a, b) => b.averageFocus - a.averageFocus)[0];
    return {
      label: best.label,
      focus: best.averageFocus,
      accuracy: best.averageAccuracy ?? 0,
    };
  }, [analysis.studyWindows]);

  const taskDurationMap = useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach((t) => {
      if (t.id) map.set(t.id, t.actualDuration || 0);
    });
    return map;
  }, [tasks]);

  const throughputInsight = useMemo(() => {
    const points: Array<{ duration: number; accuracy: number }> = [];
    analysis.sessions.forEach((session) => {
      if (session.taskType === 'soru çözme' && typeof session.accuracyScore === 'number') {
        const durationSec = taskDurationMap.get(session.taskId) || 0;
        const minutes = Math.max(1, Math.round(durationSec / 60));
        points.push({
          duration: minutes,
          accuracy: session.accuracyScore as number,
        });
      }
    });

    if (points.length < 3) {
      return {
        correlation: null as number | null,
        profile: '-' as string,
      };
    }

    const meanX = points.reduce((sum, item) => sum + item.duration, 0) / points.length;
    const meanY = points.reduce((sum, item) => sum + item.accuracy, 0) / points.length;

    let num = 0;
    let denX = 0;
    let denY = 0;
    points.forEach((item) => {
      const dx = item.duration - meanX;
      const dy = item.accuracy - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    });

    const correlation = denX > 0 && denY > 0 ? num / Math.sqrt(denX * denY) : 0;
    let profile = 'Dengeli';
    if (correlation <= -0.2) profile = 'Hızlandıkça hata artıyor';
    if (correlation >= 0.2) profile = 'Süre arttıkça doğruluk artıyor';

    return {
      correlation: Math.round(correlation * 100) / 100,
      profile,
    };
  }, [analysis.sessions, taskDurationMap]);
  const analysisState: AnalysisState = loading
    ? 'loading'
    : error
      ? 'error'
      : analysis.sessions.length < 3
        ? 'low-data'
        : 'ready';

  const resolveErrorMessage = () => {
    if (typeof error !== 'string' || !error.trim()) return 'Analiz verisi okunamadi. Kisa sure sonra tekrar deneyin.';
    const lowered = error.toLocaleLowerCase('tr-TR');
    if (lowered.includes('timeout')) return 'Hesaplama beklenen surede tamamlanamadi. Birazdan yeniden denenecek.';
    if (lowered.includes('sync') || lowered.includes('senkron')) return 'Veri senkronizasyonunda gecikme var. Son kayitlar geldikce ekran guncellenecek.';
    if (lowered.includes('cache')) return 'Gecici veri katmani yenileniyor. Kisa sure sonra yeniden deneyin.';
    return error;
  };

  const renderStateCard = (scope: 'overview' | 'insights' | 'goals' | 'reports') => {
    if (analysisState === 'ready') return null;

    const messages = {
      loading: {
        title: 'Veriler yukleniyor',
        text: 'Analiz kartlari hazirlaniyor. Birazdan secili alana ait guncel ozet gorunecek.',
      },
      error: {
        title: 'Analiz gecici olarak hazir degil',
        text: resolveErrorMessage(),
      },
      'low-data': {
        title: 'Henuz yeterli veri yok',
        text: 'Ilk analiz icin en az 3 tamamlanan calisma gerekli. Bu hafta veri olustukca karar onerileri netlesecek.',
      },
    } as const;

    const scopeActions: Record<typeof scope, string> = {
      overview: 'Bugun en az 1 calisma tamamlayin.',
      insights: 'Tekrar gerektiren bir konu icin kisa gorev olusturun.',
      goals: 'Haftalik hedefe 15 soruluk olculebilir bir adim ekleyin.',
      reports: 'Donem secip rapor uretmeden once yeni veri birikmesini bekleyin.',
    };

    const content = messages[analysisState];

    return (
      <div
        className="dr-hig-secondary-card rounded-[24px] p-6"
        data-testid={`analysis-state-card-${scope}`}
        data-analysis-state={analysisState}
      >
        <div className="dr-hig-caption uppercase tracking-[0.14em] font-semibold text-indigo-600 dark:text-indigo-400" data-testid={`analysis-state-title-${scope}`}>{content.title}</div>
        <p className="mt-2 dr-hig-body text-slate-600 dark:text-slate-300" data-testid={`analysis-state-text-${scope}`}>{content.text}</p>
        <div className="mt-4 ios-widget rounded-[14px] px-3.5 py-2.5 dr-hig-caption font-semibold text-slate-600 dark:text-slate-300" data-testid={`analysis-state-action-${scope}`}>
          Sonraki adim: {scopeActions[scope]}
        </div>
      </div>
    );
  };

  const handleCreateExamPracticeTask = async (courseId: string, courseName: string) => {
    if (!addTask || isCreatingAction) return;
    const today = getTodayString();
    const actionPlanTaskId = `parent-action-exam15-${today}-${courseId}`;
    const duplicateExists = tasks.some((task) =>
      (task.planTaskId === actionPlanTaskId)
      || (
        task.courseId === courseId
        && task.dueDate === today
        && task.taskType === 'soru çözme'
        && task.title.toLocaleLowerCase('tr-TR').includes('deneme sonrasi 15 soru')
        && task.status === 'bekliyor'
      ));
    if (duplicateExists) {
      onActionMessage?.('success', `${courseName} icin bugun ayni takip gorevi zaten acik.`);
      return;
    }

    setIsCreatingAction(true);
    try {
      await addTask({
        title: `${courseName} deneme sonrasi 15 soru`,
        description: 'Ebeveyn karar ekranindan olusturulan kisa takip gorevi.',
        planTaskId: actionPlanTaskId,
        dueDate: today,
        courseId,
        taskType: 'soru çözme',
        plannedDuration: 30,
        questionCount: 15,
        selectedMetrics: ['accuracy', 'focus', 'duration', 'completion'],
        targetAccuracy: 70,
        minimumDuration: 20,
        taskGoalType: 'test-cozme',
        planSource: 'manual',
        planLabel: 'Veli onerisi: Deneme takibi',
      });
      onActionMessage?.('success', `${courseName} icin 15 soru hedefi eklendi.`);
    } catch (taskError) {
      onActionMessage?.('error', 'Soru hedefi eklenemedi.');
    } finally {
      setIsCreatingAction(false);
    }
  };

  const handleCreateRevisionTask = async () => {
    if (!addTask || isCreatingAction || !riskiestTopic) return;
    const today = getTodayString();
    const actionPlanTaskId = `parent-action-revision-${today}-${riskiestTopic.courseId}-${normalizeTopicKey(riskiestTopic.topicName)}`;
    const duplicateExists = tasks.some((task) =>
      (task.planTaskId === actionPlanTaskId)
      || (
        task.courseId === riskiestTopic.courseId
        && task.dueDate === today
        && task.taskType === 'ders çalışma'
        && task.curriculumTopicName === riskiestTopic.topicName
        && task.status === 'bekliyor'
      ));
    if (duplicateExists) {
      onActionMessage?.('success', 'Bu konu icin bugun zaten tekrar gorevi acik.');
      return;
    }

    setIsCreatingAction(true);
    try {
      await addTask({
        title: `${riskiestTopic.topicName} kisa tekrar`,
        description: 'Ebeveyn karar ekranindan olusturulan konu tekrar gorevi.',
        planTaskId: actionPlanTaskId,
        dueDate: today,
        courseId: riskiestTopic.courseId,
        curriculumUnitName: riskiestTopic.unitName,
        curriculumTopicName: riskiestTopic.topicName,
        taskType: 'ders çalışma',
        plannedDuration: 25,
        selectedMetrics: ['focus', 'duration', 'revision', 'completion'],
        minimumDuration: 20,
        taskGoalType: 'konu-tekrari',
        planSource: 'manual',
        planLabel: 'Veli onerisi: Acil tekrar',
      });
      onActionMessage?.('success', `${riskiestTopic.topicName} icin tekrar gorevi eklendi.`);
    } catch (_taskError) {
      onActionMessage?.('error', 'Tekrar gorevi eklenemedi.');
    } finally {
      setIsCreatingAction(false);
    }
  };
  const handleGenerateReport = async () => {
    if (isGeneratingReport) return;
    setIsGeneratingReport(true);
    try {
      const next = await generateReport(reportPeriod);
      setReport(next);
    } catch (reportError) {
      const reportMessage = reportError instanceof Error ? reportError.message : 'Rapor gecici olarak uretilemedi.';
      onActionMessage?.('error', reportMessage);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  if (!showAnalysis) return null;

  return (
    <section
      className="space-y-6"
      data-testid="parent-analysis-workspace"
      data-analysis-state={analysisState}
      data-analysis-tab={analysisWorkspaceTab}
      data-e2e-mode={isE2EMode ? '1' : '0'}
    >
      {viewMode === 'analysis' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black text-[var(--dr-text-primary)]">Karar ve Analiz Merkezi</h2>
                <ContextHelp title="Karar ve Analiz Merkezi" tone="blue">
                  Çocuğunuzun günlük çalışma verileri ve sınav performansları analiz edilerek akademik risk durumlarının ve ders çalışma rotası kararlarının izlendiği yönetim merkezidir.
                </ContextHelp>
              </div>
              <p className="text-sm text-[var(--dr-text-secondary)]">Mevcut ders durumu, akademik risk sinyalleri ve planlama.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setHasRecalculated(true);
                onActionMessage?.('success', 'Planlama ve ders rotası başarıyla yeniden hesaplandı.');
              }}
              data-testid="recalculate-rota-btn"
              className="ios-button-active inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white bg-[var(--dr-orange)] hover:opacity-90 active:scale-[0.96] transition-all"
            >
              <TrendingUp className="h-4 w-4" />
              Yeniden Hesapla (Recalculate Rota)
            </button>
          </div>

          {hasRecalculated && (
            <div className="ios-card rounded-[24px] p-5 bg-emerald-50 border border-emerald-200" data-testid="recalculated-suggestions-banner">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-emerald-800 text-sm">Güncellenmiş çalışma planı önerileri</h4>
                  <p className="text-xs text-emerald-600 mt-1">Son performans analizi doğrultusunda ders çalışma rotası ve günlük hedefler güncellendi. Yeni program çocuğun paneline yansıtıldı.</p>
                </div>
              </div>
            </div>
          )}

          <div className="ios-panel rounded-[24px] p-2 border border-[var(--dr-std-border-strong)]/20 shadow-md">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {analysisWorkspaceTabs.map((tab) => {
              const Icon = tab.icon;
              const active = analysisWorkspaceTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAnalysisWorkspaceTab(tab.id)}
                  data-testid={`analysis-tab-${tab.id}`}
                  data-active={active ? '1' : '0'}
                  className={`flex min-h-16 items-center gap-3 rounded-[18px] px-4 py-3 text-left text-sm font-black transition-all active:scale-[0.96] ${active ? 'ios-button-active text-white' : 'ios-button text-[var(--dr-text-secondary)] hover:text-[var(--dr-text-primary)] hover:bg-[var(--dr-surface)]/80'}`}
                >
                  <Icon className="h-5 w-5" />
                  {tab.label}
                </button>
              );
            })}
            </div>
          </div>
        </div>
      )}

      {showSection('overview') && (
        <div className="space-y-6 w-full max-w-4xl mx-auto" data-testid="analysis-overview-section">
          {analysisState !== 'ready' ? (
            renderStateCard('overview')
          ) : (
            <div className="dr-hig-primary-box rounded-[32px] p-6 space-y-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Performans</div>
                  <div className="mt-2 flex items-start gap-2">
                    <h3 className="text-2xl font-black text-slate-950">Bugun icin durum</h3>
                    <ContextHelp title="Bu kart nasil okunur" tone="blue">
                      Bu panel son calismalara gore bugunku durumu ozetler. Once kritik konuya kisa tekrar, sonra soru adimi gelir.
                    </ContextHelp>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    {riskiestTopic
                      ? `${riskiestTopic.courseName} / ${riskiestTopic.topicName} öncelikli takipte.`
                      : strongestCourse
                        ? `${strongestCourse.courseName} güçlü görünüyor.`
                        : 'Tamamlanan oturumlar geldikçe ders ve konu resmi netleşir.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className={`rounded-full border px-4 py-2 text-sm font-black ${getRiskTone(analysis.overall.averageRisk)}`}>
                    Takip {analysis.overall.averageRisk}
                  </div>
                  <ContextHelp title="Takip Puanı (Akademik Risk)" tone="blue">
                    Çocuğunuzun LGS hazırlığındaki akademik risk puanıdır (0-100 arası). Puanın düşük olması (Örn: 10) her şeyin harika gittiğini, yüksek olması (Örn: 70+) ise acil desteğe ve plan revizyonuna ihtiyaç olduğunu gösterir.
                  </ContextHelp>
                </div>
              </div>

              {/* 3 Performance Metric Cards Grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { 
                    label: 'Genel Başarı Puanı', 
                    value: analysis.overall.generalScore, 
                    tone: getScoreTone(analysis.overall.generalScore),
                    helpTitle: 'Genel Başarı Puanı',
                    helpContent: 'Çocuğunuzun test başarıları, ders çalışma süreleri, odaklanma seviyesi ve plan uyumunun harmanlanmasıyla oluşan genel performans skorudur. %80 ve üzeri harika bir seviyedir.'
                  },
                  { 
                    label: 'Çalışma Disiplini ve Odak', 
                    value: Math.round((analysis.overall.averageFocus + analysis.overall.averageEfficiency) / 2), 
                    tone: getScoreTone(Math.round((analysis.overall.averageFocus + analysis.overall.averageEfficiency) / 2)),
                    helpTitle: 'Çalışma Disiplini ve Odak',
                    helpContent: 'Çocuğunuzun ders çalışırken gösterdiği odaklanma seviyesi (molasız çalışma) ve planlanan ders sürelerine sadakat oranının birleşimidir. Çocuğun ders ciddiyetini gösterir.'
                  },
                  { 
                    label: 'Test Doğruluk Oranı', 
                    value: analysis.overall.averageAccuracy ?? '-', 
                    tone: getScoreTone(analysis.overall.averageAccuracy ?? 0),
                    helpTitle: 'Test Doğruluk Oranı',
                    helpContent: 'Çocuğunuzun çözdüğü çoktan seçmeli sorulardaki ortalama doğru cevap oranıdır. Akademik konu kavrama düzeyini doğrudan yansıtır.'
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`dr-analysis-score-card rounded-[24px] p-4 relative ${item.tone}`}
                    data-testid={`decision-signal-${item.label.toLocaleLowerCase('tr-TR').replace(/\s+/g, '-')}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-black uppercase tracking-[0.14em] opacity-70">{item.label}</div>
                      <ContextHelp title={item.helpTitle} tone="blue">
                        {item.helpContent}
                      </ContextHelp>
                    </div>
                    <div className="mt-2 text-3xl font-black tracking-tight">{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Derslerde Genel Durum */}
              <div className="border-t border-[var(--dr-std-border-strong)]/10 pt-6">
                <div className="mb-4 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-[var(--dr-orange)]" />
                  <h4 className="font-black text-[var(--dr-text-primary)]">Derslerde genel durum</h4>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {topCourses.length === 0 && <div className="ios-widget rounded-[22px] p-4 text-sm text-[var(--dr-text-secondary)]">Ders analizi icin yeterli veri yok.</div>}
                  {topCourses.map((course) => {
                    const courseUnits = (curriculum && curriculum[course.courseName]) || [];
                    const totalTopics = courseUnits.flatMap((u) => u.topics || []);
                    const completedTopics = totalTopics.filter((t) => t.completed);
                    const completedCount = completedTopics.length;
                    const totalCount = totalTopics.length;
                    const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

                    return (
                      <div key={course.courseId} className="space-y-2 ios-card rounded-[20px] p-3.5 border border-[var(--dr-std-border-strong)]/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] dark:shadow-none bg-[var(--dr-surface)]/60 backdrop-blur-md">
                        <button
                          type="button"
                          onClick={() => setSelectedCourseDetailId(course.courseId)}
                          data-testid={`course-summary-btn-${course.courseId}`}
                          data-selected={selectedCourseDetailId === course.courseId ? '1' : '0'}
                          className={`flex w-full items-center justify-between gap-3 rounded-[12px] px-2.5 py-1.5 text-left text-xs font-black transition-all active:scale-[0.97] ${selectedCourseDetailId === course.courseId ? 'ios-button-active text-white' : 'ios-button text-[var(--dr-text-secondary)] hover:text-[var(--dr-text-primary)]'}`}
                        >
                          <span className="break-words font-extrabold">{course.courseName}</span>
                          <span className="font-semibold text-xs">{completedCount} / {totalCount} Konu</span>
                        </button>
                        <ProgressBar value={completionPercent} tone={course.weakTopicCount > 0 ? 'bg-[#FFE08A]' : 'bg-[#7EE7C7]'} />
                      </div>
                    );
                  })}
                </div>
                {selectedCourseDetail && (
                  <div
                    className="ios-widget mt-4 rounded-[20px] p-4 text-xs border border-[var(--dr-std-border-strong)]/20 bg-[var(--dr-surface)]/50 text-[var(--dr-text-primary)] shadow-sm"
                    data-testid="course-detail-panel"
                    data-course-id={selectedCourseDetail.courseId}
                  >
                    <div className="break-words font-extrabold text-sm text-[var(--dr-text-primary)]">Ders detayı: {selectedCourseDetail.courseName}</div>
                    <div className="mt-1.5 font-medium text-[var(--dr-text-secondary)]">Konuyu Anlama Seviyesi: %{selectedCourseDetail.averageMastery} | Çalışma Verimliliği: %{selectedCourseDetail.averageEfficiency} | Destek isteyen konu sayısı: {selectedCourseDetail.weakTopicCount}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showSection('insights') && (
        <div className="w-full max-w-4xl mx-auto" data-testid="analysis-insights-section">
          {analysisState !== 'ready' ? (
            renderStateCard('insights')
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px] w-full max-w-6xl mx-auto">
              {/* Sol Geniş Sütun - Öncelikli Konular (Kompakt Liste) */}
              <div className={surface}>
                <div className="mb-5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-rose-600" />
                    <h3 className="text-xl font-black text-slate-950">Oncelikli konular</h3>
                  </div>
                  <ContextHelp title="Öncelikli Konular" tone="blue">
                    Çocuğunuzun test başarı yüzdelerine göre acil tekrar veya soru çözümü yapması gereken en kritik LGS ders konularının sıralı listesidir.
                  </ContextHelp>
                </div>
                <div className="space-y-3">
                  {weakTopics.length === 0 && <div className="ios-widget rounded-[24px] p-5 text-sm text-slate-500">Acil tekrar gereken konu gorunmuyor.</div>}
                  {weakTopics.map((topic, topicIndex) => (
                    <div key={topic.key} className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between rounded-[20px] px-4.5 py-4 text-xs shadow-sm hover:border-slate-200 dark:hover:border-slate-600 transition" data-testid={`weak-topic-card-${topicIndex}`}>
                      <div className="min-w-0 pr-4">
                        <div className="font-extrabold text-slate-800 dark:text-slate-200 text-sm break-words">{topic.topicName}</div>
                        <div className="text-[10px] font-semibold text-slate-500 mt-1 break-words">{topic.courseName} / {topic.unitName}</div>
                        {getPrerequisiteHint(topic.courseName, topic.topicName) && (
                          <div className="mt-2 rounded-[12px] bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-[10px] font-semibold text-amber-800 dark:text-amber-300 border border-amber-100 dark:border-amber-900/30 inline-block">
                            Ön koşul: {getPrerequisiteHint(topic.courseName, topic.topicName)}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-full px-2.5 py-1">
                          %{topic.masteryScore} Hakimiyet
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${getDecisionTone(getTopicDecisionLevel(topic.riskScore))}`}>
                          {getTopicDecisionLevel(topic.riskScore)} · Risk {topic.riskScore}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sağ Sütun - Sidebar (Yalnızca Sıradaki Net Adım) */}
              <div className="space-y-4">
                {/* Sıradaki Net Adım */}
                {!riskiestTopic && analysis.overall.completedTasks > 0 ? null : (
                  <div className="ios-ink rounded-[30px] p-6 text-white">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Siradaki net adim</div>
                    <div className="mt-3 text-xl font-black leading-7">
                      {riskiestTopic ? 'Odak konusuna kisa tekrar' : 'Ilk olcumlu gorev'}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {riskiestTopic
                        ? `${riskiestTopic.courseName} / ${riskiestTopic.topicName} icin kisa tekrar ve 15 soru onerilir.`
                        : 'Ilk analiz icin en az 1 tamamlanan calisma gerekli.'}
                    </p>
                    {riskiestTopic && getPrerequisiteHint(riskiestTopic.courseName, riskiestTopic.topicName) && (
                      <div className="mt-3 rounded-[14px] bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300 border border-amber-100 dark:border-amber-900/30">
                        {getPrerequisiteHint(riskiestTopic.courseName, riskiestTopic.topicName)}
                      </div>
                    )}
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={handleCreateRevisionTask}
                        disabled={!riskiestTopic || isCreatingAction}
                        data-testid="create-revision-task-btn"
                        className={`rounded-[16px] px-3 py-2.5 text-xs font-black transition-all active:scale-[0.96] ${(!riskiestTopic || isCreatingAction) ? 'bg-white/5 border border-white/5 text-white/30 cursor-not-allowed' : 'bg-[var(--dr-orange)] text-white shadow-sm hover:opacity-90'}`}
                      >
                        Tekrar gorevi olustur
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const targetCourse = riskiestTopic || topCourses[0];
                          if (!targetCourse) return;
                          void handleCreateExamPracticeTask(targetCourse.courseId, targetCourse.courseName);
                        }}
                        disabled={isCreatingAction || (!riskiestTopic && topCourses.length === 0)}
                        data-testid="set-question-goal-btn"
                        className={`rounded-[16px] px-3 py-2.5 text-xs font-black transition-all active:scale-[0.96] ${(isCreatingAction || (!riskiestTopic && topCourses.length === 0)) ? 'bg-white/5 border border-white/5 text-white/30 cursor-not-allowed' : 'bg-[var(--dr-orange)] text-white shadow-sm hover:opacity-90'}`}
                      >
                        15 soru hedefi ver
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showSection('goals') && (
        <div className="space-y-6 w-full max-w-4xl mx-auto" data-testid="analysis-goals-section">
          {analysisState !== 'ready' ? (
            renderStateCard('goals')
          ) : (
            <>
              {/* Card 1: LGS Hedef Sayacı & Geri Sayım */}
          <div className={`${surface} flex flex-col md:flex-row items-center justify-between gap-6 p-6`}>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black text-slate-950">LGS Hedef ve Deneme Takibi</h3>
                  <ContextHelp title="LGS Hedef ve Deneme Takibi" tone="blue">
                    Çocuğunuzun LGS deneme sınavlarındaki puan gelişimini, hedeflenen okul puanı ve LGS baraj seviyeleriyle karşılaştırmalı olarak gösteren performans takip alanıdır.
                  </ContextHelp>
                </div>
                <p className="text-sm font-semibold text-slate-500 mt-0.5">Sınav hazırlık hedefleri ve güncel durum analizi</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 rounded-[20px] p-4 shrink-0 shadow-sm">
              <div className="text-center">
                <span className="block text-[10px] font-black uppercase text-slate-400">LGS Geri Sayım</span>
                <span className="block text-2xl font-black text-slate-900 mt-1">
                  {lgsDaysLeft === null ? '-' : lgsDaysLeft >= 0 ? `${lgsDaysLeft} Gün` : 'Sınav Geçti'}
                </span>
              </div>
              <div className="w-px h-10 bg-slate-200" />
              <div className="text-center">
                <span className="block text-[10px] font-black uppercase text-slate-400">Hedef Tarih</span>
                <span className="block text-sm font-bold text-slate-700 mt-1">
                  {lgsTargetDate ? lgsTargetDate.toISOString().slice(0, 10) : 'Girilmedi'}
                </span>
              </div>
            </div>
          </div>

          {/* LGS Akademik Durum Özetleri */}
          <div className="grid gap-3 sm:grid-cols-3 text-xs">
            <div className="ios-card rounded-[18px] border border-[var(--dr-std-border-strong)]/10 bg-[var(--dr-surface)]/60 backdrop-blur-md p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] dark:shadow-none">
              <div className="font-bold text-[var(--dr-text-secondary)] uppercase tracking-wide text-[10px]">Ünite Tamamlama</div>
              <div className="mt-2 text-2xl font-black text-[var(--dr-text-primary)]">{curriculumCompletionRate === null ? '-' : `%${curriculumCompletionRate}`}</div>
            </div>
            <div className="ios-card rounded-[18px] border border-[var(--dr-std-border-strong)]/10 bg-[var(--dr-surface)]/60 backdrop-blur-md p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] dark:shadow-none">
              <div className="font-bold text-[var(--dr-text-secondary)] uppercase tracking-wide text-[10px]">Deneme Trendi</div>
              <div className={`mt-2 flex items-center gap-1 text-2xl font-black ${latestCompositeAverage === null || previousCompositeAverage === null ? 'text-[var(--dr-text-primary)]' : examDeltaDisplay.tone}`}>
                {latestCompositeAverage === null || previousCompositeAverage === null
                  ? '-'
                  : `${examDeltaDisplay.arrow} ${examDeltaDisplay.short}`}
              </div>
              <div className={`mt-1 text-[11px] font-semibold ${latestCompositeAverage === null || previousCompositeAverage === null ? 'text-[var(--dr-text-secondary)]' : examDeltaDisplay.tone}`}>
                {latestCompositeAverage === null || previousCompositeAverage === null ? 'Yetersiz deneme verisi' : examDeltaDisplay.text}
              </div>
            </div>
            <div className="ios-card rounded-[18px] border border-[var(--dr-std-border-strong)]/10 bg-[var(--dr-surface)]/60 backdrop-blur-md p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] dark:shadow-none">
              <div className="font-bold text-[var(--dr-text-secondary)] uppercase tracking-wide text-[10px]">Hedef Net Farkı</div>
              <div className="mt-2 text-2xl font-black text-[var(--dr-text-primary)]">
                {lgsReadinessGap === null ? '-' : lgsReadinessGap <= 0 ? `+${Math.abs(lgsReadinessGap)}` : `-${lgsReadinessGap}`}
              </div>
            </div>
          </div>

          {/* Card 2: Haftalık Hedef Belirleme & İlerleme */}
          <div className={surface}>
            <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-950">Haftalık Hedef Belirleme & İlerleme</h3>
                  <ContextHelp title="Haftalık Hedef" tone="blue">
                    Çocuğunuzun bu hafta çözmeyi hedeflediği toplam soru sayısını ve testlerindeki başarı hedeflerinin gerçekleşme durumunu gösteren planlama alanıdır.
                  </ContextHelp>
                </div>
                <p className="text-xs font-semibold text-slate-500">Öğrencinin haftalık çalışma limitlerini ve LGS hedeflerini yönetin</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 mb-6">
              <label className="flex flex-col gap-1.5 text-xs font-bold text-[var(--dr-text-secondary)]">
                <span>Haftalık Soru Hedefi</span>
                <input
                  type="number"
                  min={0}
                  max={2000}
                  value={goalConfig.weeklyQuestionTarget}
                  onChange={(event) => setGoalConfig((prev) => ({ ...prev, weeklyQuestionTarget: safeClampNumber(Number(event.target.value) || 0, 0, 2000) }))}
                  className="ios-button w-full rounded-[14px] px-3.5 py-2.5 text-sm font-bold bg-[var(--dr-surface)] border border-[var(--dr-std-border-strong)]/20 text-[var(--dr-text-primary)] focus:border-[var(--dr-orange)] focus:ring-1 focus:ring-[var(--dr-orange)] outline-none transition"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-bold text-[var(--dr-text-secondary)]">
                <span>Ders Süresi Hedefi (Dk)</span>
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={goalConfig.weeklyStudyMinuteTarget}
                  onChange={(event) => setGoalConfig((prev) => ({ ...prev, weeklyStudyMinuteTarget: safeClampNumber(Number(event.target.value) || 0, 0, 5000) }))}
                  className="ios-button w-full rounded-[14px] px-3.5 py-2.5 text-sm font-bold bg-[var(--dr-surface)] border border-[var(--dr-std-border-strong)]/20 text-[var(--dr-text-primary)] focus:border-[var(--dr-orange)] focus:ring-1 focus:ring-[var(--dr-orange)] outline-none transition"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-bold text-[var(--dr-text-secondary)]">
                <span>Konu Bitirme Hedefi</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={goalConfig.topicCompletionTarget}
                  onChange={(event) => setGoalConfig((prev) => ({ ...prev, topicCompletionTarget: safeClampNumber(Number(event.target.value) || 0, 0, 100) }))}
                  className="ios-button w-full rounded-[14px] px-3.5 py-2.5 text-sm font-bold bg-[var(--dr-surface)] border border-[var(--dr-std-border-strong)]/20 text-[var(--dr-text-primary)] focus:border-[var(--dr-orange)] focus:ring-1 focus:ring-[var(--dr-orange)] outline-none transition"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-bold text-[var(--dr-text-secondary)]">
                <span>LGS Hedef Neti</span>
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={goalConfig.lgsTargetNet}
                  onChange={(event) => setGoalConfig((prev) => ({ ...prev, lgsTargetNet: safeClampNumber(Number(event.target.value) || 0, 0, 500) }))}
                  className="ios-button w-full rounded-[14px] px-3.5 py-2.5 text-sm font-bold bg-[var(--dr-surface)] border border-[var(--dr-std-border-strong)]/20 text-[var(--dr-text-primary)] focus:border-[var(--dr-orange)] focus:ring-1 focus:ring-[var(--dr-orange)] outline-none transition"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-bold text-[var(--dr-text-secondary)] sm:col-span-2 md:col-span-1">
                <span>LGS Hedef Tarihi</span>
                <input
                  type="date"
                  value={goalConfig.lgsTargetDate}
                  onChange={(event) => setGoalConfig((prev) => ({ ...prev, lgsTargetDate: event.target.value }))}
                  className="ios-button w-full rounded-[14px] px-3.5 py-2.5 text-sm font-bold bg-[var(--dr-surface)] border border-[var(--dr-std-border-strong)]/20 text-[var(--dr-text-primary)] focus:border-[var(--dr-orange)] focus:ring-1 focus:ring-[var(--dr-orange)] outline-none transition"
                />
              </label>
            </div>

            <div className="bg-[var(--dr-surface)]/60 border border-[var(--dr-std-border-strong)]/10 rounded-[20px] p-5 space-y-4 shadow-inner">
              <h4 className="text-xs font-black uppercase tracking-wide text-slate-400">Haftalık Hedef Gerçekleşme Durumu</h4>
              
              <div className="space-y-4">
                {/* Soru Hedefi İlerlemesi */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Haftalık Soru Hedefi
                    </span>
                    <span data-testid="goal-progress-question" className="font-extrabold text-blue-600">
                      %{safeClampNumber(weeklyQuestionProgress, 0, 999)} ({weeklyStats.questions} / {goalConfig.weeklyQuestionTarget} soru)
                    </span>
                  </div>
                  <ProgressBar value={weeklyQuestionProgress} tone="bg-gradient-to-r from-blue-400 to-indigo-500" />
                </div>

                {/* Süre Hedefi İlerlemesi */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      Ders Çalışma Süresi
                    </span>
                    <span data-testid="goal-progress-minute" className="font-extrabold text-indigo-600">
                      %{safeClampNumber(weeklyMinuteProgress, 0, 999)} ({weeklyStats.minutes} / {goalConfig.weeklyStudyMinuteTarget} dk)
                    </span>
                  </div>
                  <ProgressBar value={weeklyMinuteProgress} tone="bg-gradient-to-r from-indigo-400 to-violet-500" />
                </div>

                {/* Konu İlerlemesi */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Konu Bitirme Hedefi
                    </span>
                    <span data-testid="goal-progress-topic" className="font-extrabold text-emerald-600">
                      %{safeClampNumber(topicProgress, 0, 999)} ({topicCompletionCount} / {goalConfig.topicCompletionTarget} konu)
                    </span>
                  </div>
                  <ProgressBar value={topicProgress} tone="bg-gradient-to-r from-emerald-400 to-teal-500" />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 pt-3 text-[11px] font-semibold text-slate-500">
                <span>Veri Güvenilirliği: <strong className="text-slate-700 dark:text-slate-300">{dataReliabilityLabel}</strong></span>
                {suspiciousTaskCount > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/30 rounded-full px-2 py-0.5">
                    Şüpheli kayıt: {suspiciousTaskCount} / {completedTasksForMetrics.length}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Card 3: Deneme Sınavları Durumu */}
          <div className={surface}>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-950">Deneme Sınavları ve Gidişat Durumu</h3>
                  <ContextHelp title="Deneme Sınavları ve Gidişat" tone="blue">
                    Çocuğunuzun son LGS deneme sınavı sonuçlarına göre net gelişimini ve puan durumunu takip eden akademik analiz kartıdır.
                  </ContextHelp>
                </div>
                <p className="text-xs font-semibold text-slate-500">Öğrencinin okul sınavları ve deneme performans trend analizi</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className={`${subtleSurface} border border-slate-100 flex flex-col justify-between`} data-testid="exam-card-school">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Toplam Okul Sınavı</div>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-slate-900">{examRecords.length}</span>
                  <span className="text-xs font-semibold text-slate-500">sınav kaydı</span>
                </div>
              </div>

              <div className={`${subtleSurface} border border-slate-100 flex flex-col justify-between`} data-testid="exam-card-mock">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Toplam Deneme Sınavı</div>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-slate-900">{compositeExamResults.length}</span>
                  <span className="text-xs font-semibold text-slate-500">deneme</span>
                </div>
              </div>

              <div className={`${subtleSurface} border border-slate-100 flex flex-col justify-between`} data-testid="exam-card-trend">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Genel Gidişat Trendi</div>
                <div className="mt-4 flex items-center gap-2">
                  <span className={`text-2xl font-black ${decisionTrendDisplay.tone}`}>
                    {decisionTrendDisplay.arrow} {trendLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Son Sınav & Deneme Kayıtları */}
          <div className={surface}>
            <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-950">Son Sınav & Deneme Kayıtları</h3>
                  <ContextHelp title="Sınav Kayıtları" tone="blue">
                    Çocuğunuzun okula veya genel denemelere ait son sınav sonuçlarının ve ders bazlı ders puanlarının saklandığı geçmiş kayıt listesidir.
                  </ContextHelp>
                </div>
                <p className="text-xs font-semibold text-slate-500">Öğrencinin en son girdiği sınav sonuçları ve performans dağılımı</p>
              </div>
            </div>

            <div className="space-y-4">
              {latestStateExam && (
                <div className="bg-slate-50 border border-slate-100 rounded-[20px] p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/60 pb-3 mb-4">
                    <div>
                      <span className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">Son Deneme Özeti</span>
                      <h4 className="mt-1 text-sm font-bold text-slate-800">{latestStateExam.title}</h4>
                      <p className="text-xs text-slate-500">{latestStateExam.date}</p>
                    </div>
                    {typeof latestStateExam.totalScore === 'number' && (
                      <div className="rounded-full bg-white border border-slate-200 shadow-sm px-4.5 py-1.5 text-sm font-black text-slate-700 shrink-0 self-start sm:self-center">
                        Toplam {latestStateExam.totalScore} Puan
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Risk Analizi Yapılan Dersler</span>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {latestStateExam.riskCourses.map((course) => (
                        <div key={`${latestStateExam.date}-${course.courseName}`} className="bg-white border border-slate-100 rounded-[16px] p-3 shadow-sm flex items-center justify-between">
                          <div>
                            <div className="text-sm font-extrabold text-slate-800">{course.courseName}</div>
                            <div className="text-xs font-semibold text-slate-500">Öncelik Puanı</div>
                          </div>
                          <span className="text-base font-black text-indigo-600 bg-indigo-50 rounded-full h-9 w-9 flex items-center justify-center border border-indigo-100">
                            {course.score}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Yakın Zamandaki Sınav Kayıtları</span>
                {recentExamRecords.map((record) => (
                  <div key={record.id} className="bg-white border border-slate-100 rounded-[18px] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm hover:border-slate-200 transition">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-600 border border-slate-100 shrink-0">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-extrabold text-slate-800">{record.courseName}</div>
                        <div className="text-xs font-bold text-slate-500 mt-0.5">{record.title}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                      <div className="text-left sm:text-right">
                        <span className="block text-[10px] font-black uppercase text-slate-400">{examTypeLabelMap[record.examType]}</span>
                        <span className="block text-xs font-bold text-slate-500 mt-0.5">{record.date}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200/80 rounded-full px-4 py-1.5 text-sm font-black text-slate-700">
                        Puan {record.score}
                      </div>
                    </div>
                  </div>
                ))}
                {recentExamRecords.length === 0 && (
                  <div className="bg-slate-50 border border-slate-100 rounded-[18px] p-5 text-center text-sm font-medium text-slate-500">
                    Sınav kaydı bulunamadı.
                  </div>
                )}
              </div>
            </div>
          </div>
            </>
          )}
        </div>
      )}



      {showSection('reports') && (
        <div className="space-y-6 w-full max-w-4xl mx-auto" data-testid="analysis-reports-section">
          {analysisState !== 'ready' ? (
            renderStateCard('reports')
          ) : (
            <>
              {/* Card 1: Genel Rapor ve Akademik Özet */}
          <div className={surface}>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <BarChart className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-950">Genel Rapor ve Akademik Özet</h3>
                  <ContextHelp title="Genel Rapor" tone="blue">
                    Çocuğunuzun genel çalışma hacmini, çözülen soru sayılarını ve ortalama ders performanslarını tek sayfada özetleyen ebeveyn raporlama alanıdır.
                  </ContextHelp>
                </div>
                <p className="text-xs font-semibold text-slate-500">Öğrencinin haftalık/aylık performans ve çalışma özeti</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="bg-slate-50 border border-slate-100 rounded-[20px] p-4 flex flex-col justify-between shadow-sm">
                <div className="text-[10px] font-black uppercase text-slate-400">Ortalama Hakimiyet</div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-slate-900">%{analysis.overall.averageMastery}</span>
                  <span className="block text-[10px] font-bold text-emerald-600 mt-1">Canlı güncel</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-[20px] p-4 flex flex-col justify-between shadow-sm">
                <div className="text-[10px] font-black uppercase text-slate-400">Toplam Çalışma</div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-slate-900">{Math.floor(studiedMinutes / 60)} sa {studiedMinutes % 60} dk</span>
                  <span className="block text-[10px] font-bold text-emerald-600 mt-1">
                    +%{Math.max(1, Math.round((weeklyStats.minutes / Math.max(1, studiedMinutes)) * 100))} haftalık etki
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-[20px] p-4 flex flex-col justify-between shadow-sm">
                <div className="text-[10px] font-black uppercase text-slate-400">Tamamlanan Görev</div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-slate-900">{completedCount} / {Math.max(1, completedCount + pendingCount)}</span>
                  <span className="block text-[10px] font-bold text-indigo-600 mt-1">
                    %{Math.round((completedCount / Math.max(1, completedCount + pendingCount)) * 100)} tamamlandı
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-[20px] p-4 flex flex-col justify-between shadow-sm">
                <div className="text-[10px] font-black uppercase text-slate-400">Deneme Performansı</div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-slate-900">
                    {latestCompositeAverage === null ? '-' : `%${latestCompositeAverage}`}
                  </span>
                  <span className={`block text-[10px] font-bold mt-1 ${latestCompositeAverage !== null && previousCompositeAverage !== null ? examDeltaDisplay.tone : 'text-slate-400'}`}>
                    {latestCompositeAverage !== null && previousCompositeAverage !== null
                      ? `${examDeltaDisplay.arrow} ${examDeltaDisplay.text}`
                      : 'Yetersiz deneme verisi'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Akademik Kalite Göstergeleri */}
          <div className={surface}>
            <div className="flex items-center gap-3 mb-5 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-950 dark:text-slate-100">Akademik Kalite Göstergeleri</h3>
                  <ContextHelp title="Akademik Kalite" tone="blue">
                    Çocuğunuzun testlerdeki doğruluk oranı, odaklanma süresi ve çalışma verimliliğinin genel gidişatını analiz eden grafik alanıdır.
                  </ContextHelp>
                </div>
                <p className="text-xs font-semibold text-slate-500">Sorulardaki ilk deneme başarısı, verimli saat dilimi ve çalışma temposu profili</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/60 rounded-[20px] p-4 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="text-[10px] font-black uppercase text-slate-400">İlk Deneme Başarısı</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2">
                    {firstAttemptAverage !== null ? `%${firstAttemptAverage}` : '-'}
                  </div>
                </div>
                <p className="mt-3 text-[10px] font-semibold text-slate-500 leading-normal">
                  Konu bazında ilk denemedeki doğruluk ortalaması.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/60 rounded-[20px] p-4 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="text-[10px] font-black uppercase text-slate-400">En Verimli Saat</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2">{goldenHourInsight.label}</div>
                </div>
                <p className="mt-3 text-[10px] font-semibold text-slate-500 leading-normal">
                  Maksimum performans: Odak {goldenHourInsight.focus !== null ? `%${goldenHourInsight.focus}` : '-'} / Doğruluk {goldenHourInsight.accuracy !== null ? `%${goldenHourInsight.accuracy}` : '-'}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/60 rounded-[20px] p-4 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="text-[10px] font-black uppercase text-slate-400">Çalışma Dengesi & Profil</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 truncate">{throughputInsight.profile}</div>
                </div>
                <p className="mt-3 text-[10px] font-semibold text-slate-500 leading-normal">
                  Süre ve doğruluk ilişkisine göre akıllı çalışma tarzı profili.
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: Konu Hakimiyet Analizi */}
          <div className={surface}>
            <div className="flex items-center gap-3 mb-5 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-950">Konu Hakimiyet Analizi</h3>
                  <ContextHelp title="Konu Hakimiyet Analizi" tone="blue">
                    Çocuğunuzun tüm ders konularındaki en çok gelişen (başarısı artan) ve en çok zorlanılan (tekrar gereken) konularını listeler.
                  </ContextHelp>
                </div>
                <p className="text-xs font-semibold text-slate-500">Öğrencinin en çok gelişim gösterdiği ve en çok zorlandığı LGS konuları</p>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3 block">En Çok Gelişen Konular</h4>
                <div className="space-y-2">
                  {improvingTopics.slice(0, 5).map((topic, index) => (
                    <div key={`impr-${topic.key}`} className="bg-slate-50 border border-slate-100/80 flex items-center justify-between rounded-[16px] px-3.5 py-3 text-xs shadow-sm">
                      <div className="min-w-0 pr-2">
                        <div className="truncate font-bold text-slate-800">{index + 1}. {topic.topicName}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-0.5">{topic.courseName}</div>
                      </div>
                      <div className="text-[11px] font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5 shrink-0">
                        %{topic.masteryScore} Hakimiyet
                      </div>
                    </div>
                  ))}
                  {improvingTopics.length === 0 && (
                    <div className="bg-slate-50 border border-slate-100/60 rounded-[16px] p-4 text-center text-xs text-slate-500">
                      Gelişen konu kaydı bulunamadı.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3 block">En Çok Zorlanılan Konular</h4>
                <div className="space-y-2">
                  {hardestTopics.slice(0, 5).map((topic, index) => (
                    <div key={`hard-${topic.key}`} className="bg-slate-50 border border-slate-100/80 flex items-center justify-between rounded-[16px] px-3.5 py-3 text-xs shadow-sm">
                      <div className="min-w-0 pr-2">
                        <div className="truncate font-bold text-slate-800">{index + 1}. {topic.topicName}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-0.5">{topic.courseName}</div>
                      </div>
                      <div className="text-[11px] font-extrabold text-rose-600 bg-rose-50 border border-rose-100 rounded-full px-2 py-0.5 shrink-0">
                        Risk {topic.riskScore}
                      </div>
                    </div>
                  ))}
                  {hardestTopics.length === 0 && (
                    <div className="bg-slate-50 border border-slate-100/60 rounded-[16px] p-4 text-center text-xs text-slate-500">
                      Zorlanılan konu kaydı bulunamadı.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="text-center text-[11px] font-semibold text-slate-400 py-2">
            Not: Analiz raporları haftalık olarak güncellenir.
          </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default ParentAnalysisWorkspace;
