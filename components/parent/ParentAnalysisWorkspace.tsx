import React, { useMemo, useState } from 'react';
import { Course, ParentDashboardProps, ReportData, Task } from '../../types';
import { AnalysisSnapshot } from '../../utils/analysisEngine';
import { buildParentDecision, getTopicDecisionLevel } from '../../utils/parentDecisionEngine';
import { getTodayString } from '../../utils/dateUtils';
import AnalysisGraphCenter from './AnalysisGraphCenter';
import { alignmentLabelMap, alignmentToneMap, examTypeLabelMap } from './parentDashboardShared';
import { AlertTriangle, BarChart, BookOpen, CheckCircle, ClipboardList, FileText, PlusCircle, Target, TrendingUp } from '../icons';
import ContextHelp from '../shared/ContextHelp';
import { isCompletedTask } from '../../utils/taskStatus';

const surface = 'ios-card rounded-[30px] p-5';
const subtleSurface = 'ios-widget rounded-[24px] p-4';

type AnalysisWorkspaceTab = 'overview' | 'insights' | 'goals' | 'reports';
type ReportPeriod = ReportData['period'];

interface ParentAnalysisWorkspaceProps {
  tasks: Task[];
  courses: Course[];
  curriculum: ParentDashboardProps['curriculum'];
  analysis: AnalysisSnapshot;
  examRecords: NonNullable<ParentDashboardProps['examRecords']>;
  compositeExamResults: NonNullable<ParentDashboardProps['compositeExamResults']>;
  generateReport: ParentDashboardProps['generateReport'];
  addTask?: ParentDashboardProps['addTask'];
  onActionMessage?: (type: 'success' | 'error', text: string) => void;
  loading?: ParentDashboardProps['loading'];
  error?: ParentDashboardProps['error'];
  viewMode: NonNullable<ParentDashboardProps['viewMode']>;
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

const ProgressBar: React.FC<{ value: number; tone?: string }> = ({ value, tone = 'bg-[#8AB4FF]' }) => (
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
  examRecords,
  compositeExamResults,
  generateReport,
  addTask,
  onActionMessage,
  loading,
  error,
  viewMode,
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
  const [report, setReport] = useState<ReportData | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isCreatingAction, setIsCreatingAction] = useState(false);
  const [selectedCourseDetailId, setSelectedCourseDetailId] = useState<string | null>(null);
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
  const topCourses = useMemo(() => analysis.courses.slice(0, 5), [analysis.courses]);
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
  const schoolPerformance = useMemo(() => analysis.school.coursePerformance.slice(0, 6), [analysis.school.coursePerformance]);
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
  const weeklyQuestionsByCourse = useMemo(() => {
    const map = new Map<string, number>();
    weeklyTasks
      .filter((task) => task.taskType === 'soru çözme')
      .forEach((task) => {
        const hasRecordedCounts = typeof task.correctCount === 'number' || typeof task.incorrectCount === 'number';
        const answered = (task.correctCount || 0) + (task.incorrectCount || 0);
        const solved = hasRecordedCounts ? answered : (task.questionCount || 0);
        map.set(task.courseId, (map.get(task.courseId) || 0) + solved);
      });
    return map;
  }, [weeklyTasks]);
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
  const latestCompositeAverage = compositeExamResults[0] ? Math.round(compositeExamResults[0].courses.reduce((sum, course) => sum + course.score, 0) / compositeExamResults[0].courses.length) : null;
  const previousCompositeAverage = compositeExamResults[1] ? Math.round(compositeExamResults[1].courses.reduce((sum, course) => sum + course.score, 0) / compositeExamResults[1].courses.length) : null;
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
  const decision = useMemo(() => buildParentDecision({
    sessionsCount: analysis.sessions.length,
    weeklyCompletedCount: weeklyStats.completed,
    weakTopicCount: weakTopics.length,
    averageRisk: analysis.overall.averageRisk,
    latestCompositeAverage,
    previousCompositeAverage,
    parentActionPendingCount,
    parentActionCompletedCount,
    parentActionCompletedTodayCount,
  }), [
    analysis.sessions.length,
    weeklyStats.completed,
    weakTopics.length,
    analysis.overall.averageRisk,
    latestCompositeAverage,
    previousCompositeAverage,
    parentActionPendingCount,
    parentActionCompletedCount,
    parentActionCompletedTodayCount,
  ]);
  const trendLabel = decision.trend;
  const goalAlerts = decision.alerts;
  const topGoalAlert = decision.topAlert;
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
        className="ios-card rounded-[24px] p-4"
        data-testid={`analysis-state-card-${scope}`}
        data-analysis-state={analysisState}
      >
        <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400" data-testid={`analysis-state-title-${scope}`}>{content.title}</div>
        <p className="mt-2 text-sm leading-6 text-slate-600" data-testid={`analysis-state-text-${scope}`}>{content.text}</p>
        <div className="mt-3 rounded-[14px] bg-white/65 px-3 py-2 text-xs font-bold text-slate-500" data-testid={`analysis-state-action-${scope}`}>
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
        <div className="ios-panel rounded-[30px] p-2">
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
                  className={`flex min-h-16 items-center gap-3 rounded-[22px] px-4 py-3 text-left text-sm font-black transition ${active ? 'ios-button-active' : 'ios-button text-slate-600 hover:bg-white/75'}`}
                >
                  <Icon className="h-5 w-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showSection('overview') && (
        <>
          {renderStateCard('overview')}
          {weeklyStats.completed > 0 && (
            <div className="ios-card rounded-[32px] p-6">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-950">Bu hafta</h3>
              </div>
              <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
                <div className="ios-widget ios-blue rounded-[22px] p-4"><div className="text-xs font-bold uppercase text-slate-500">Çalışma</div><div className="mt-2 text-2xl font-black">{weeklyStats.completed}</div></div>
                <div className="ios-widget ios-lilac rounded-[22px] p-4"><div className="text-xs font-bold uppercase text-slate-500">Soru</div><div className="mt-2 text-2xl font-black">{weeklyStats.questions}</div></div>
                <div className="ios-widget ios-mint rounded-[22px] p-4"><div className="text-xs font-bold uppercase text-slate-500">Süre</div><div className="mt-2 text-2xl font-black">{weeklyStats.minutes} dk</div></div>
                <div className="ios-widget ios-peach rounded-[22px] p-4"><div className="text-xs font-bold uppercase text-slate-500">Ders</div><div className="mt-2 text-2xl font-black">{weeklyStats.courses}</div></div>
                <div className="ios-widget ios-coral rounded-[22px] p-4"><div className="text-xs font-bold uppercase text-slate-500">Açık</div><div className="mt-2 text-2xl font-black">{weeklyStats.openTopics}</div></div>
              </div>
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px]">
          <div className="ios-card rounded-[32px] p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Performans</div>
                <div className="mt-2 flex items-start gap-2">
                  <h3 className="text-2xl font-black text-slate-950">Karar paneli</h3>
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
              <div className={`rounded-full border px-4 py-2 text-sm font-black ${getRiskTone(analysis.overall.averageRisk)}`}>
                Takip {analysis.overall.averageRisk}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'Genel Skor', value: analysis.overall.generalScore, tone: getScoreTone(analysis.overall.generalScore) },
                { label: 'Odak', value: analysis.overall.averageFocus, tone: getScoreTone(analysis.overall.averageFocus) },
                { label: 'Verim', value: analysis.overall.averageEfficiency, tone: getScoreTone(analysis.overall.averageEfficiency) },
                { label: 'Doğruluk', value: analysis.overall.averageAccuracy ?? '-', tone: getScoreTone(analysis.overall.averageAccuracy ?? 0) },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`dr-analysis-score-card rounded-[24px] p-4 ${item.tone}`}
                  data-testid={`decision-signal-${item.label.toLocaleLowerCase('tr-TR').replace(/\s+/g, '-')}`}
                >
                  <div className="text-xs font-black uppercase tracking-[0.14em] opacity-70">{item.label}</div>
                  <div className="mt-2 text-3xl font-black tracking-tight">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className={subtleSurface}>
                <div className="mb-4 flex items-center gap-2">
                  <Target className="h-5 w-5 text-slate-700" />
                  <h4 className="font-black text-slate-950">Calisma ozeti</h4>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="ios-widget ios-blue rounded-[22px] p-4"><div className="text-xs font-bold uppercase text-slate-500">Tamamlanan</div><div className="mt-1 text-2xl font-black">{completedCount}</div></div>
                  <div className="ios-widget ios-peach rounded-[22px] p-4"><div className="text-xs font-bold uppercase text-slate-500">Bekleyen</div><div className="mt-1 text-2xl font-black">{pendingCount}</div></div>
                  <div className="ios-widget ios-lilac rounded-[22px] p-4"><div className="text-xs font-bold uppercase text-slate-500">Soru</div><div className="mt-1 text-2xl font-black">{solvedQuestionCount}</div></div>
                  <div className="ios-widget ios-mint rounded-[22px] p-4"><div className="text-xs font-bold uppercase text-slate-500">Süre</div><div className="mt-1 text-2xl font-black">{studiedMinutes} dk</div></div>
                  <div className="ios-widget ios-yellow rounded-[22px] p-4"><div className="text-xs font-bold uppercase text-slate-500">Sayfa</div><div className="mt-1 text-2xl font-black">{readPages}</div></div>
                  <div className="ios-widget ios-coral rounded-[22px] p-4"><div className="text-xs font-bold uppercase text-slate-500">Oturum</div><div className="mt-1 text-2xl font-black">{analysis.sessions.length}</div></div>
                </div>
              </div>

              <div className={subtleSurface}>
                <div className="mb-4 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-slate-700" />
                  <h4 className="font-black text-slate-950">Ders durumu</h4>
                </div>
                <div className="space-y-4">
                  {topCourses.length === 0 && <div className="ios-widget rounded-[22px] p-4 text-sm text-slate-500">Ders analizi icin yeterli veri yok.</div>}
                  {topCourses.map((course) => (
                    <div key={course.courseId} className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setSelectedCourseDetailId(course.courseId)}
                        data-testid={`course-summary-btn-${course.courseId}`}
                        data-selected={selectedCourseDetailId === course.courseId ? '1' : '0'}
                        className={`flex w-full items-center justify-between gap-3 rounded-[14px] px-2 py-1 text-left text-sm transition ${selectedCourseDetailId === course.courseId ? 'bg-white/70' : 'hover:bg-white/55'}`}
                      >
                        <span className="break-words font-bold text-slate-800">{course.courseName}</span>
                        <span className="font-black text-slate-950">{course.averageMastery}</span>
                      </button>
                      <ProgressBar value={course.averageMastery} tone={course.weakTopicCount > 0 ? 'bg-[#FFE08A]' : 'bg-[#7EE7C7]'} />
                    </div>
                  ))}
                  {selectedCourseDetail && (
                    <div
                      className="ios-widget rounded-[20px] p-3 text-xs text-slate-600"
                      data-testid="course-detail-panel"
                      data-course-id={selectedCourseDetail.courseId}
                    >
                      <div className="break-words font-bold text-slate-800">Ders detayi: {selectedCourseDetail.courseName}</div>
                      <div className="mt-1">Hakimiyet {selectedCourseDetail.averageMastery} / Verim {selectedCourseDetail.averageEfficiency} / Acik konu {selectedCourseDetail.weakTopicCount}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="ios-widget rounded-[20px] p-3">
                <div className="text-xs font-bold uppercase text-slate-400">Veli gorevi (bekleyen)</div>
                <div className="mt-1 text-2xl font-black text-slate-900">{parentActionPendingCount}</div>
              </div>
              <div className="ios-widget rounded-[20px] p-3">
                <div className="text-xs font-bold uppercase text-slate-400">Veli gorevi (tamamlanan)</div>
                <div className="mt-1 text-2xl font-black text-slate-900">{parentActionCompletedCount}</div>
              </div>
              <div className="ios-widget rounded-[20px] p-3">
                <div className="text-xs font-bold uppercase text-slate-400">Bugun tamamlanan</div>
                <div className="mt-1 text-2xl font-black text-slate-900">{parentActionCompletedTodayCount}</div>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="ios-ink rounded-[30px] p-6 text-white">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Siradaki net adim</div>
              <div className="mt-3 text-xl font-black leading-7">
                {riskiestTopic ? 'Odak konusuna kisa tekrar' : analysis.overall.completedTasks > 0 ? 'Ritmi koru' : 'Ilk olcumlu gorev'}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {riskiestTopic
                  ? `${riskiestTopic.courseName} / ${riskiestTopic.topicName} icin kisa tekrar ve 15 soru onerilir.`
                  : analysis.overall.completedTasks > 0
                    ? 'Ritim korunuyor. Bu hafta ayni duzende devam edin.'
                    : 'Ilk analiz icin en az 1 tamamlanan calisma gerekli.'}
              </p>
              {riskiestTopic && getPrerequisiteHint(riskiestTopic.courseName, riskiestTopic.topicName) && (
                <div className="mt-3 rounded-[14px] bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  {getPrerequisiteHint(riskiestTopic.courseName, riskiestTopic.topicName)}
                </div>
              )}
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleCreateRevisionTask}
                  disabled={!riskiestTopic || isCreatingAction}
                  data-testid="create-revision-task-btn"
                  className={`rounded-[16px] px-3 py-2 text-xs font-black ${(!riskiestTopic || isCreatingAction) ? 'bg-white/20 text-slate-200' : 'bg-white/90 text-slate-900'}`}
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
                  className={`rounded-[16px] px-3 py-2 text-xs font-black ${(isCreatingAction || (!riskiestTopic && topCourses.length === 0)) ? 'bg-white/20 text-slate-200' : 'bg-white/90 text-slate-900'}`}
                >
                  15 soru hedefi ver
                </button>
              </div>
            </div>

            <div className={surface}>
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <h4 className="font-black text-slate-950">Toparlanan konu</h4>
              </div>
              {improvingTopics[0] ? (
                <div>
                  <div className="text-sm font-bold text-slate-800">{improvingTopics[0].topicName}</div>
                  <div className="mt-1 text-sm text-slate-500">{improvingTopics[0].courseName} / {improvingTopics[0].unitName}</div>
                  <div className="mt-4"><ProgressBar value={improvingTopics[0].masteryScore} tone="bg-[#7EE7C7]" /></div>
                </div>
              ) : (
                <div className="text-sm leading-6 text-slate-500">Yukselis goruldugunde burada listelenir.</div>
              )}
            </div>
          </aside>
          </div>
        </>
      )}

      {showSection('insights') && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
          {renderStateCard('insights')}
          <div className={surface}>
            <div className="mb-5 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
                <h3 className="text-xl font-black text-slate-950">Oncelikli konular</h3>
            </div>
            <div className="space-y-3">
                {weakTopics.length === 0 && <div className="ios-widget rounded-[24px] p-5 text-sm text-slate-500">Acil tekrar gereken konu gorunmuyor.</div>}
              {weakTopics.map((topic, topicIndex) => (
                <div key={topic.key} className="ios-widget rounded-[24px] p-4" data-testid={`weak-topic-card-${topicIndex}`}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="break-words font-black text-slate-900">{topic.topicName}</div>
                      <div className="mt-1 break-words text-sm text-slate-500">{topic.courseName} / {topic.unitName}</div>
                      {getPrerequisiteHint(topic.courseName, topic.topicName) && (
                        <div className="mt-2 rounded-[12px] bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                          On kosul: {getPrerequisiteHint(topic.courseName, topic.topicName)}
                        </div>
                      )}
                    </div>
                    <div className={`rounded-full border px-3 py-1 text-xs font-black ${getDecisionTone(getTopicDecisionLevel(topic.riskScore))}`}>{getTopicDecisionLevel(topic.riskScore)} · {topic.riskScore}</div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Hakimiyet</div><ProgressBar value={topic.masteryScore} tone="bg-[#C4B5FD]" /></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Odak</div><ProgressBar value={topic.averageFocus} tone="bg-[#8AB4FF]" /></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Verim</div><ProgressBar value={topic.averageEfficiency} tone="bg-[#7EE7C7]" /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className={surface}>
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-xl font-black text-slate-950">Iyi giden konular</h3>
              </div>
              <div className="space-y-3">
                {improvingTopics.length === 0 && <div className="ios-widget rounded-[22px] p-4 text-sm text-slate-500">Bu hafta belirgin yukselis gorunmuyor.</div>}
                {improvingTopics.map((topic) => (
                  <div key={topic.key} className="ios-widget ios-mint rounded-[22px] p-4">
                    <div className="font-bold text-emerald-950">{topic.topicName}</div>
                    <div className="mt-1 text-sm text-emerald-700">{topic.courseName}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className={surface}>
              <h3 className="text-xl font-black text-slate-950">Kisa yorum</h3>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <div className="ios-widget rounded-[22px] p-4">Toplam tamamlanan gorev <strong>{completedCount}</strong>, cozulen soru <strong>{solvedQuestionCount}</strong>.</div>
                <div className="ios-widget rounded-[22px] p-4">
                  Ortalama verim <strong>{analysis.overall.averageEfficiency}</strong>. {analysis.overall.averageEfficiency < 60 ? 'Calisma suresi ve mola dengesi destek istiyor.' : 'Calisma kalitesi dengeli ilerliyor.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSection('goals') && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]" data-testid="analysis-goals-section">
          {renderStateCard('goals')}
          <div className={surface}>
            <div className="mb-5 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-slate-700" />
              <h3 className="text-xl font-black text-slate-950">Hedef ve deneme durumu</h3>
              <p className="mt-2 text-sm text-slate-600">Bu bolum hedefe yakinlik ve deneme gidisatini net gosterir.</p>
            </div>
            <div className="mb-4 rounded-[24px] border border-white/65 bg-white/55 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase text-slate-400">LGS hedef modu</div>
                  <div className="mt-1 text-sm font-bold text-slate-700">
                    {lgsTargetDate ? `Hedef tarih: ${lgsTargetDate.toISOString().slice(0, 10)}` : 'Hedef tarih girilmedi'}
                  </div>
                </div>
                <div className="rounded-full bg-white/70 px-3 py-1 text-xs font-black text-slate-700">
                  {lgsDaysLeft === null ? 'Kalan sure: -' : lgsDaysLeft >= 0 ? `${lgsDaysLeft} gun` : 'Sinav tarihi gecti'}
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
                <div className="rounded-[16px] bg-white/70 px-3 py-2">
                  <div className="font-bold text-slate-500">Unite tamamlama</div>
                  <div className="mt-1 text-lg font-black text-slate-900">{curriculumCompletionRate === null ? '-' : `%${curriculumCompletionRate}`}</div>
                </div>
                <div className="rounded-[16px] bg-white/70 px-3 py-2">
                  <div className="font-bold text-slate-500">Deneme trendi</div>
                  <div className="mt-1 text-lg font-black text-slate-900">
                    {latestCompositeAverage === null || previousCompositeAverage === null
                      ? '-'
                      : latestCompositeAverage > previousCompositeAverage
                        ? 'Yukseliyor'
                        : latestCompositeAverage < previousCompositeAverage
                          ? 'Dusuyor'
                          : 'Stabil'}
                  </div>
                </div>
                <div className="rounded-[16px] bg-white/70 px-3 py-2">
                  <div className="font-bold text-slate-500">Hedef net farki</div>
                  <div className="mt-1 text-lg font-black text-slate-900">
                    {lgsReadinessGap === null ? '-' : lgsReadinessGap <= 0 ? `+${Math.abs(lgsReadinessGap)}` : `-${lgsReadinessGap}`}
                  </div>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {lgsReadinessByCourse.map((course) => (
                  <div key={`lgs-${course.courseName}`} className="rounded-[16px] bg-white/70 px-3 py-2 text-xs">
                    <div className="font-bold text-slate-800">{course.courseName}</div>
                    <div className="mt-1 text-slate-600">Hazirlik: {course.readinessLabel}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mb-4 rounded-[24px] border border-white/65 bg-white/55 p-4">
              <div className="text-xs font-black uppercase text-slate-400">Hedef sistemi</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-600">
                  Haftalik soru hedefi
                  <input
                    type="number"
                    min={0}
                    max={2000}
                    value={goalConfig.weeklyQuestionTarget}
                    onChange={(event) => setGoalConfig((prev) => ({ ...prev, weeklyQuestionTarget: safeClampNumber(Number(event.target.value) || 0, 0, 2000) }))}
                    className="ios-button mt-1 w-full rounded-[14px] px-3 py-2 text-sm font-bold text-slate-800"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Haftalik ders suresi (dk)
                  <input
                    type="number"
                    min={0}
                    max={5000}
                    value={goalConfig.weeklyStudyMinuteTarget}
                    onChange={(event) => setGoalConfig((prev) => ({ ...prev, weeklyStudyMinuteTarget: safeClampNumber(Number(event.target.value) || 0, 0, 5000) }))}
                    className="ios-button mt-1 w-full rounded-[14px] px-3 py-2 text-sm font-bold text-slate-800"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Konu bitirme hedefi
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={goalConfig.topicCompletionTarget}
                    onChange={(event) => setGoalConfig((prev) => ({ ...prev, topicCompletionTarget: safeClampNumber(Number(event.target.value) || 0, 0, 100) }))}
                    className="ios-button mt-1 w-full rounded-[14px] px-3 py-2 text-sm font-bold text-slate-800"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  LGS hedef neti
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={goalConfig.lgsTargetNet}
                    onChange={(event) => setGoalConfig((prev) => ({ ...prev, lgsTargetNet: safeClampNumber(Number(event.target.value) || 0, 0, 500) }))}
                    className="ios-button mt-1 w-full rounded-[14px] px-3 py-2 text-sm font-bold text-slate-800"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                  LGS hedef tarihi
                  <input
                    type="date"
                    value={goalConfig.lgsTargetDate}
                    onChange={(event) => setGoalConfig((prev) => ({ ...prev, lgsTargetDate: event.target.value }))}
                    className="ios-button mt-1 w-full rounded-[14px] px-3 py-2 text-sm font-bold text-slate-800"
                  />
                </label>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs">
                <div className="rounded-[16px] bg-white/70 px-3 py-2">
                  <div className="font-bold text-slate-500">Soru hedefi</div>
                  <div className="mt-1 text-lg font-black text-slate-900" data-testid="goal-progress-question">%{safeClampNumber(weeklyQuestionProgress, 0, 999)}</div>
                </div>
                <div className="rounded-[16px] bg-white/70 px-3 py-2">
                  <div className="font-bold text-slate-500">Sure hedefi</div>
                  <div className="mt-1 text-lg font-black text-slate-900" data-testid="goal-progress-minute">%{safeClampNumber(weeklyMinuteProgress, 0, 999)}</div>
                </div>
                <div className="rounded-[16px] bg-white/70 px-3 py-2">
                  <div className="font-bold text-slate-500">Konu hedefi</div>
                  <div className="mt-1 text-lg font-black text-slate-900" data-testid="goal-progress-topic">%{safeClampNumber(topicProgress, 0, 999)}</div>
                </div>
              </div>
              <div className="mt-3 text-[11px] font-semibold text-slate-500">
                Veri guvenilirligi: {dataReliabilityLabel}. Supheli kayit: {suspiciousTaskCount} / {completedTasksForMetrics.length}
              </div>
            </div>
              <div className="grid gap-3 md:grid-cols-4">
              <div className={subtleSurface} data-testid="exam-card-school"><div className="text-xs font-bold uppercase text-slate-400">Okul sinavi</div><div className="mt-2 text-3xl font-black">{examRecords.length}</div></div>
              <div className={subtleSurface} data-testid="exam-card-mock"><div className="text-xs font-bold uppercase text-slate-400">Deneme</div><div className="mt-2 text-3xl font-black">{compositeExamResults.length}</div></div>
              <div className={subtleSurface} data-testid="exam-card-trend"><div className="text-xs font-bold uppercase text-slate-400">Gidisat</div><div className="mt-2 text-base font-black">{trendLabel}</div></div>
              </div>

            {latestStateExam && (
              <div className="mt-4 rounded-[24px] border border-white/65 bg-white/55 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase text-slate-400">Son deneme ozeti</div>
                    <div className="mt-1 text-sm font-bold text-slate-700">{latestStateExam.title} / {latestStateExam.date}</div>
                  </div>
                  {typeof latestStateExam.totalScore === 'number' && (
                    <div className="rounded-full bg-white/70 px-3 py-1 text-xs font-black text-slate-700">Toplam {latestStateExam.totalScore}</div>
                  )}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {latestStateExam.riskCourses.map((course) => (
                    <div key={`${latestStateExam.date}-${course.courseName}`} className="rounded-[18px] bg-white/70 px-3 py-2">
                      <div className="text-sm font-black text-slate-800">{course.courseName}</div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">Oncelik puani {course.score}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 space-y-3">
              {schoolPerformance.length === 0 && <div className="ios-widget rounded-[24px] p-5 text-sm text-slate-500">Okul notu geldikce uyum analizi gorunur.</div>}
              {schoolPerformance.map((item) => (
                <div key={item.courseId} className="ios-widget rounded-[24px] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="font-black text-slate-900">{item.courseName}</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-white/65 px-2 py-1">Ev {item.studyScore}</span>
                        <span className="rounded-full bg-white/65 px-2 py-1">Okul {item.schoolScore ?? '-'}</span>
                        <span className="rounded-full bg-white/65 px-2 py-1">Beklenen {item.predictedSchoolScore ?? '-'}</span>
                        {item.alignmentGap !== null && <span className="rounded-full bg-white/65 px-2 py-1">Fark {item.alignmentGap > 0 ? '+' : ''}{item.alignmentGap}</span>}
                      </div>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${alignmentToneMap[item.alignmentStatus]}`}>{alignmentLabelMap[item.alignmentStatus]}</span>
                  </div>
                  <div className="mt-3 rounded-[18px] bg-white/60 px-3 py-2 text-sm font-semibold text-slate-600">{item.alignmentComment}</div>
                  <div className="mt-4 grid gap-2">
                    <ProgressBar value={item.studyScore} tone="bg-[#8AB4FF]" />
                    {item.schoolScore !== null && <ProgressBar value={item.schoolScore} tone="bg-[#C4B5FD]" />}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_120px]">
                    <label className="text-[11px] font-semibold text-slate-500">
                      Ders bazli haftalik soru hedefi
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        value={goalConfig.courseQuestionTargets[item.courseId] ?? 0}
                        onChange={(event) => {
                          const next = safeClampNumber(Number(event.target.value) || 0, 0, 1000);
                          setGoalConfig((prev) => ({
                            ...prev,
                            courseQuestionTargets: { ...prev.courseQuestionTargets, [item.courseId]: next },
                          }));
                        }}
                        className="ios-button mt-1 w-full rounded-[12px] px-2 py-1 text-xs font-bold text-slate-800"
                      />
                    </label>
                    <div className="rounded-[12px] bg-white/60 px-2 py-2 text-[11px] font-semibold text-slate-600">
                      Gerceklesen: {weeklyQuestionsByCourse.get(item.courseId) || 0}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={surface}>
            <h3 className="text-xl font-black text-slate-950">Karar karti</h3>
            <div className="mt-4 ios-widget rounded-[22px] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Durum</span>
                <span className={`rounded-full border px-3 py-1 text-xs font-black ${getDecisionTone(topGoalAlert.level)}`} data-testid="top-goal-alert-level">{topGoalAlert.level}</span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{topGoalAlert.text}</p>
              <div className="mt-3 text-xs font-bold text-slate-500">Aksiyon: {topGoalAlert.action}</div>
              <div className="mt-2 text-[11px] font-semibold text-slate-400">
                Dayanak: Son 7 gün verisine göre · Güven: {topGoalAlert.confidence}
              </div>
              <div className="mt-1 text-[11px] font-semibold text-slate-400">
                Motor: {decision.diagnostics.rulesVersion} / {decision.diagnostics.thresholdVersion}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {goalAlerts.slice(0, 4).map((alert, index) => (
                <div key={`${alert.level}-${index}`} className="ios-widget rounded-[18px] px-3 py-2 text-xs font-semibold text-slate-600" data-testid={`goal-alert-${index}`} data-alert-level={alert.level}>
                  <strong className="text-slate-800">{alert.level}:</strong> {alert.text}
                </div>
              ))}
              {goalAlerts.length === 0 && <div className="ios-widget rounded-[18px] px-3 py-2 text-xs font-semibold text-slate-600">Uyari olusmadi, mevcut ritim dengeli.</div>}
            </div>
            <div className="mt-4 ios-widget rounded-[20px] p-3 text-xs text-slate-600">
              <div className="font-bold text-slate-800">Bugun icin net adim</div>
              <div className="mt-1">
                {topGoalAlert.action}
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleCreateRevisionTask}
                disabled={!riskiestTopic || isCreatingAction}
                data-testid="track-topic-btn"
                className={`rounded-[16px] px-3 py-2 text-xs font-black ${(!riskiestTopic || isCreatingAction) ? 'ios-button text-slate-400' : 'ios-button-active text-slate-900'}`}
              >
                Bu konuyu takip et
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetCourse = riskiestTopic || topCourses[0];
                  if (!targetCourse) return;
                  void handleCreateExamPracticeTask(targetCourse.courseId, targetCourse.courseName);
                }}
                disabled={isCreatingAction || (!riskiestTopic && topCourses.length === 0)}
                data-testid="add-to-plan-btn"
                className={`rounded-[16px] px-3 py-2 text-xs font-black ${(isCreatingAction || (!riskiestTopic && topCourses.length === 0)) ? 'ios-button text-slate-400' : 'ios-button-active text-slate-900'}`}
              >
                Bugunun planina ekle
              </button>
            </div>
            <div className="mt-3 ios-widget rounded-[18px] px-3 py-2 text-xs font-semibold text-slate-600" data-testid="parent-action-summary">
              Veli aksiyon ozeti: <span data-testid="parent-action-pending-count">{parentActionPendingCount}</span> bekleyen, <span data-testid="parent-action-completed-count">{parentActionCompletedCount}</span> tamamlanan gorev.
            </div>
            <div className="mt-2 rounded-[14px] bg-white/60 px-3 py-2 text-[11px] font-semibold text-slate-500">
              Aksiyon-audit: {parentActionAuditLine}
            </div>
          </div>

          <div className={surface}>
            <h3 className="text-xl font-black text-slate-950">Son kayitlar</h3>
            <div className="mt-4 space-y-3">
              {recentExamRecords.map((record) => (
                <div key={record.id} className="ios-widget rounded-[22px] p-3 text-sm">
                  <div className="font-bold text-slate-900">{record.courseName} / {record.title}</div>
                  <div className="mt-1 text-slate-500">{examTypeLabelMap[record.examType]} / {record.date} / Puan {record.score}</div>
                </div>
              ))}
              {recentExamRecords.length === 0 && <div className="ios-widget rounded-[22px] p-4 text-sm text-slate-500">Sınav kaydı yok.</div>}
            </div>
          </div>
        </div>
      )}



      {showSection('reports') && (
        <div className="space-y-6" data-testid="analysis-reports-section" data-report-period={reportPeriod}>
          {renderStateCard('reports')}
          <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className={surface}>
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-slate-700" />
                  <h3 className="text-xl font-black text-slate-950">Rapor</h3>
                </div>
                <ContextHelp title="Rapor seçimi" tone="peach">
                  Donemi secip rapor urettiginizde, sadece karar icin gerekli 3 sonuc gosterilir: guclu alan, destek isteyen alan, siradaki adim.
                </ContextHelp>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <select data-testid="report-period-select" value={reportPeriod} onChange={(event) => setReportPeriod(event.target.value as ReportPeriod)} className="ios-button min-h-11 flex-1 rounded-[18px] px-3 text-sm font-semibold text-slate-700">
                  {reportPeriods.map((period) => <option key={period} value={period}>{period}</option>)}
                </select>
                <button data-testid="report-generate-btn" onClick={handleGenerateReport} disabled={isGeneratingReport} className={`min-h-11 rounded-[18px] px-4 text-sm font-black text-white ${isGeneratingReport ? 'cursor-not-allowed bg-slate-400' : 'ios-ink'}`}>
                  {isGeneratingReport ? 'Üretiliyor...' : 'Rapor Üret'}
                </button>
              </div>
              {report ? (
                <div className="mt-5 space-y-3 text-sm leading-6">
                  <div className="ios-widget rounded-[22px] p-4"><strong>Ozet:</strong> {report.aiSummary}</div>
                  <div className="ios-widget ios-mint rounded-[22px] p-4 text-emerald-950"><strong>Guclu alan:</strong> {report.highlights.mostImproved}</div>
                  <div className="ios-widget ios-peach rounded-[22px] p-4 text-amber-950"><strong>Destek isteyen alan:</strong> {report.highlights.needsFocus}</div>
                  <div className="ios-widget ios-blue rounded-[22px] p-4 text-blue-950"><strong>Siradaki adim:</strong> {report.aiSuggestion}</div>
                </div>
              ) : (
                <div className="ios-widget mt-5 rounded-[22px] p-4 text-sm leading-6 text-slate-500">Secili donem icin rapor uretilebilir.</div>
              )}
            </div>

            <div className={surface}>
              <h3 className="text-xl font-black text-slate-950">Hizli karar ozeti</h3>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="ios-widget ios-blue rounded-[22px] p-4">
                  <div className="text-xs font-bold uppercase text-slate-500">Durum</div>
                  <div className="mt-2 text-lg font-black">{topGoalAlert.level}</div>
                </div>
                <div className="ios-widget ios-coral rounded-[22px] p-4">
                  <div className="text-xs font-bold uppercase text-slate-500">Uyari sayisi</div>
                  <div className="mt-2 text-2xl font-black">{goalAlerts.length}</div>
                </div>
                <div className="ios-widget ios-lilac rounded-[22px] p-4">
                  <div className="text-xs font-bold uppercase text-slate-500">Guven</div>
                  <div className="mt-2 text-lg font-black">{topGoalAlert.confidence}</div>
                </div>
              </div>

              <div className="mt-4 ios-widget rounded-[20px] p-4">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Aksiyon etkisi</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-[14px] bg-white/70 px-3 py-2">
                    <div className="text-[11px] font-bold uppercase text-slate-400">Bekleyen</div>
                    <div className="mt-1 text-xl font-black text-slate-900">{parentActionPendingCount}</div>
                  </div>
                  <div className="rounded-[14px] bg-white/70 px-3 py-2">
                    <div className="text-[11px] font-bold uppercase text-slate-400">Tamamlanan</div>
                    <div className="mt-1 text-xl font-black text-slate-900">{parentActionCompletedCount}</div>
                  </div>
                  <div className="rounded-[14px] bg-white/70 px-3 py-2">
                    <div className="text-[11px] font-bold uppercase text-slate-400">Bugun</div>
                    <div className="mt-1 text-xl font-black text-slate-900">{parentActionCompletedTodayCount}</div>
                  </div>
                </div>
                <div className="mt-3 text-xs font-semibold text-slate-600">
                  {parentActionAuditLine}
                </div>
              </div>

              <div className="mt-4 ios-widget rounded-[20px] p-4">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">V2 izleme</div>
                <div className="mt-2 text-xs font-semibold text-slate-600">
                  {decision.diagnostics.rulesVersion} / {decision.diagnostics.thresholdVersion}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
                  <div className="rounded-[14px] bg-white/70 px-3 py-2">
                    <div className="font-bold text-slate-500">Risk kritik</div>
                    <div className="mt-1 font-black text-slate-900">{decision.diagnostics.thresholds.riskCriticalMin}</div>
                  </div>
                  <div className="rounded-[14px] bg-white/70 px-3 py-2">
                    <div className="font-bold text-slate-500">Risk dikkat</div>
                    <div className="mt-1 font-black text-slate-900">{decision.diagnostics.thresholds.riskWarningMin}</div>
                  </div>
                  <div className="rounded-[14px] bg-white/70 px-3 py-2">
                    <div className="font-bold text-slate-500">Konu uyari</div>
                    <div className="mt-1 font-black text-slate-900">{decision.diagnostics.thresholds.weakTopicCountWarning}</div>
                  </div>
                </div>
                <div className="mt-3 text-[11px] font-semibold text-slate-500">
                  Adaptif agirliklar aktif: trend {decision.diagnostics.weights.trendDrop}, risk {decision.diagnostics.weights.risk}, calisma yok {decision.diagnostics.weights.noStudy}.
                </div>
              </div>
            </div>
          </div>

          <AnalysisGraphCenter tasks={tasks} courses={courses} curriculum={curriculum} analysis={analysis} loading={loading} error={error} />
        </div>
      )}
    </section>
  );
};

export default ParentAnalysisWorkspace;
