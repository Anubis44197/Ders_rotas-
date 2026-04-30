import { CompositeExamResult, Course, ExamRecord, PeriodCoursePerformance, StoredStudyPlan, Task } from '../types';
import { getTodayString } from './dateUtils';
import { DEFAULT_METRIC_CONFIG, getTaskMetricProfile } from './metricConfig';

export interface SessionMetrics {
  taskId: string;
  courseId: string;
  courseName: string;
  unitName?: string;
  topicName?: string;
  taskType: Task['taskType'];
  taskGoalType?: string;
  completionDate: string;
  firstAttemptScore?: number;
  selfAssessmentScore?: number;
  confidenceGap?: number;
  focusScore: number;
  accuracyScore?: number;
  efficiencyScore: number;
  taskScore: number;
  masteryContribution: number;
  conceptErrorRate?: number;
  processErrorRate?: number;
  attentionErrorRate?: number;
  focusNorm: number;
  accuracyNorm?: number;
  efficiencyNorm: number;
  taskScoreNorm: number;
  masteryContributionNorm: number;
}

export interface TopicMetrics {
  key: string;
  courseId: string;
  courseName: string;
  unitName: string;
  topicName: string;
  totalSessions: number;
  questionSessions: number;
  averageFocus: number;
  averageAccuracy?: number;
  averageEfficiency: number;
  trend: 'up' | 'down' | 'flat';
  retention1d: number;
  retention7d: number;
  retention30d: number;
  decayRate: number;
  firstAttemptScore?: number;
  conceptErrorRate?: number;
  processErrorRate?: number;
  attentionErrorRate?: number;
  riskV1: number;
  riskV2?: number;
  riskScore: number;
  riskModel: 'v1' | 'v2';
  masteryScore: number;
  needsRevision: boolean;
}

export interface CourseMetrics {
  courseId: string;
  courseName: string;
  totalSessions: number;
  averageFocus: number;
  averageAccuracy?: number;
  averageEfficiency: number;
  averageMastery: number;
  averageRisk: number;
  weakTopicCount: number;
}

export interface TaskTypeMetrics {
  taskType: string;
  label: string;
  totalSessions: number;
  averageFocus: number;
  averageAccuracy?: number;
  averageEfficiency: number;
  averageMastery: number;
}

export interface StudyWindowMetrics {
  key: 'morning' | 'afternoon' | 'evening' | 'late';
  label: string;
  totalSessions: number;
  averageFocus: number;
  averageAccuracy?: number;
  averageEfficiency: number;
  averageMastery: number;
}

export interface PlanMetrics {
  totalAssignedTasks: number;
  completedAssignedTasks: number;
  overdueAssignedTasks: number;
  selfAssignedTasks: number;
  totalPlannedTopicTasks: number;
  completedPlannedTopicTasks: number;
  adherenceScore: number;
}

export interface AnalysisSnapshot {
  sessions: SessionMetrics[];
  topics: TopicMetrics[];
  courses: CourseMetrics[];
  taskTypes: TaskTypeMetrics[];
  studyWindows: StudyWindowMetrics[];
  plan: PlanMetrics;
  school: {
    examRecords: ExamRecord[];
    compositeExamResults: CompositeExamResult[];
    coursePerformance: PeriodCoursePerformance[];
    latestStateExam:
      | {
          title: string;
          date: string;
          totalScore?: number;
          strongestCourses: Array<{ courseName: string; score: number }>;
          riskCourses: Array<{ courseName: string; score: number }>;
        }
      | null;
  };
  overall: {
    completedTasks: number;
    averageFocus: number;
    averageAccuracy?: number;
    averageEfficiency: number;
    averageMastery: number;
    averageRisk: number;
    riskModel: 'v1' | 'v2';
    generalScore: number;
    normalized: {
      mastery: number;
      accuracy: number;
      efficiency: number;
      focus: number;
      retention: number;
      trend: number;
      discipline: number;
    };
  };
}

const getRiskLevelLabel = (score: number): PeriodCoursePerformance['riskLevel'] => {
  if (score >= 70) return 'yuksek';
  if (score >= 45) return 'orta';
  return 'dusuk';
};

const getAlignmentStatus = (gap: number | null): PeriodCoursePerformance['alignmentStatus'] => {
  if (gap === null || !Number.isFinite(gap)) return 'veri-yetersiz';
  const absGap = Math.abs(gap);
  if (absGap <= 8) return 'uyumlu';
  if (absGap <= 18) return 'sapma-var';
  return 'kritik-sapma';
};

const TASK_TYPE_LABELS: Record<string, string> = {
  question: 'Soru cozme',
  study: 'Ders calismasi',
  revision: 'Ders tekrari',
  reading: 'Kitap okuma',
};

const STUDY_WINDOW_LABELS: Record<StudyWindowMetrics['key'], string> = {
  morning: 'Sabah',
  afternoon: 'Oglen',
  evening: 'Aksam',
  late: 'Gece',
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const parseDateOnly = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const dayDiff = (from: string, to: string) => {
  const fromDate = parseDateOnly(from);
  const toDate = parseDateOnly(to);
  if (!fromDate || !toDate) return null;
  const ms = toDate.getTime() - fromDate.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
};

const toPercent = (value: number) => Math.round(clamp01(value) * 100);

const average = (values: number[], fallback = 0): number => {
  if (values.length === 0) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const getAccuracyNorm = (task: Task): number | undefined => {
  if (task.taskType !== 'soru çözme') return undefined;
  if (!task.questionCount || task.questionCount <= 0) return undefined;
  return clamp01((task.correctCount || 0) / task.questionCount);
};

const getFocusNorm = (task: Task): number => {
  const actualDuration = task.actualDuration || 0;
  if (actualDuration > 0) {
    const pause = Math.max(0, task.pauseTime || 0);
    const breakTime = Math.max(0, task.breakTime || 0);
    const active = Math.max(actualDuration - pause - breakTime, 0);
    return clamp01(active / actualDuration);
  }

  if (typeof task.focusScore === 'number') return clamp01(task.focusScore / 100);
  return 0.5;
};

const getEfficiencyNorm = (task: Task): number => {
  const plannedSeconds = Math.max(0, (task.plannedDuration || 0) * 60);
  if (plannedSeconds <= 0) return 0.5;

  const actualSeconds = Math.max(1, task.actualDuration || plannedSeconds);
  const breakTime = Math.max(0, task.breakTime || 0);
  const timeFit = Math.min(plannedSeconds / actualSeconds, 1);
  const breakRate = clamp01(breakTime / actualSeconds);
  return clamp01(timeFit * (1 - breakRate));
};

const getDurationFactor = (task: Task): number => {
  const targetSeconds = Math.max(1, (task.plannedDuration || 0) * 60);
  const actualSeconds = Math.max(1, task.actualDuration || targetSeconds);
  return clamp(actualSeconds / targetSeconds, 0.4, 1.2);
};

const getRetentionProxyNorm = (task: Task, accuracyNorm?: number): number => {
  if (typeof accuracyNorm === 'number') return accuracyNorm;
  if (typeof task.successScore === 'number') return clamp01(task.successScore / 100);
  return 0.5;
};

const getTaskScoreNorm = (task: Task, focusNorm: number, efficiencyNorm: number, accuracyNorm?: number): number => {
  const profile = getTaskMetricProfile(task);
  const weights = DEFAULT_METRIC_CONFIG.taskScoreWeights[profile];

  const accuracy = typeof accuracyNorm === 'number' ? accuracyNorm : 0.5;
  const retention = profile === 'revision' ? getRetentionProxyNorm(task, accuracyNorm) : 0;
  const completion = 1;

  return clamp01(
    (weights.accuracy * accuracy) +
    (weights.efficiency * efficiencyNorm) +
    (weights.focus * focusNorm) +
    (weights.completion * completion) +
    (weights.retention * retention),
  );
};

const getMasteryContributionNorm = (task: Task, taskScoreNorm: number): number => {
  const profile = getTaskMetricProfile(task);
  const weight = DEFAULT_METRIC_CONFIG.masteryWeights[profile];
  const durationFactor = getDurationFactor(task);
  return clamp01(taskScoreNorm * weight * durationFactor);
};

const getDecayRate = (values: number[]): number => {
  if (values.length < 2) return 0;
  const first = values[0];
  const last = values[values.length - 1];
  return clamp01((first - last) / Math.max(first, 0.001));
};

const getRiskV1 = (masteryNorm: number, trendNorm: number): number => {
  let negativeTrendBonus = 0;
  if (trendNorm < 0.35) negativeTrendBonus = 0.25;
  else if (trendNorm < 0.5) negativeTrendBonus = 0.15;
  return clamp01((1 - masteryNorm) + negativeTrendBonus);
};

const getRiskV2 = (masteryNorm: number, trendNorm: number, retention7d: number, decayRate: number): number => {
  const negativeTrend = clamp01((0.5 - trendNorm) / 0.5);
  const lowRetention = clamp01((0.6 - retention7d) / 0.6);
  return clamp01((1 - masteryNorm) + negativeTrend + lowRetention + decayRate);
};

const getTrend = (values: number[]): 'up' | 'down' | 'flat' => {
  if (values.length < 2) return 'flat';
  const recent = values.slice(-3);
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (last - first >= 8) return 'up';
  if (first - last >= 8) return 'down';
  return 'flat';
};

const countPlannedTopicTasks = (studyPlans: StoredStudyPlan[]): { total: number; completed: number } => {
  let total = 0;
  let completed = 0;

  studyPlans.forEach((storedPlan) => {
    Object.values(storedPlan.plan).forEach((subjectPlan) => {
      subjectPlan.units.forEach((unit) => {
        unit.topics.forEach((topic) => {
          topic.tasks.forEach((task) => {
            total += 1;
            if (task.completed) completed += 1;
          });
        });
      });
    });
  });

  return { total, completed };
};

const getStudyWindowKey = (task: Task): StudyWindowMetrics['key'] | null => {
  if (!task.completionTimestamp) return null;
  const hour = new Date(task.completionTimestamp).getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'late';
};

export const deriveAnalysisSnapshot = (
  tasks: Task[],
  courses: Course[],
  studyPlans: StoredStudyPlan[] = [],
  examRecords: ExamRecord[] = [],
  compositeExamResults: CompositeExamResult[] = [],
): AnalysisSnapshot => {
  const courseMap = new Map(courses.map((course) => [course.id, course.name]));
  const completedTasks = tasks.filter((task) => task.status === 'tamamlandı' && task.completionDate);

  const sessions: SessionMetrics[] = completedTasks.map((task) => {
    const focusNorm = getFocusNorm(task);
    const accuracyNorm = getAccuracyNorm(task);
    const efficiencyNorm = getEfficiencyNorm(task);
    const taskScoreNorm = getTaskScoreNorm(task, focusNorm, efficiencyNorm, accuracyNorm);
    const masteryContributionNorm = getMasteryContributionNorm(task, taskScoreNorm);

    const focusScore = toPercent(focusNorm);
    const accuracyScore = typeof accuracyNorm === 'number' ? toPercent(accuracyNorm) : undefined;
    const efficiencyScore = toPercent(efficiencyNorm);
    const taskScore = toPercent(taskScoreNorm);
    const masteryContribution = toPercent(masteryContributionNorm);
    const totalErrors = (task.conceptErrorCount || 0) + (task.processErrorCount || 0) + (task.attentionErrorCount || 0);

    return {
      taskId: task.id,
      courseId: task.courseId,
      courseName: courseMap.get(task.courseId) || task.courseId,
      unitName: task.curriculumUnitName,
      topicName: task.curriculumTopicName,
      taskType: task.taskType,
      taskGoalType: task.taskGoalType,
      completionDate: task.completionDate!,
      firstAttemptScore: task.firstAttemptScore,
      selfAssessmentScore: task.selfAssessmentScore,
      confidenceGap: task.confidenceGap,
      focusScore,
      accuracyScore,
      efficiencyScore,
      taskScore,
      masteryContribution,
      conceptErrorRate: totalErrors > 0 ? (task.conceptErrorCount || 0) / totalErrors : undefined,
      processErrorRate: totalErrors > 0 ? (task.processErrorCount || 0) / totalErrors : undefined,
      attentionErrorRate: totalErrors > 0 ? (task.attentionErrorCount || 0) / totalErrors : undefined,
      focusNorm,
      accuracyNorm,
      efficiencyNorm,
      taskScoreNorm,
      masteryContributionNorm,
    };
  });

  const topicBuckets = new Map<string, SessionMetrics[]>();
  sessions.forEach((session) => {
    if (!session.unitName || !session.topicName) return;
    const key = `${session.courseId}::${session.unitName}::${session.topicName}`;
    const bucket = topicBuckets.get(key) || [];
    bucket.push(session);
    topicBuckets.set(key, bucket);
  });

  const topics: TopicMetrics[] = Array.from(topicBuckets.entries()).map(([key, bucket]) => {
    const sorted = [...bucket].sort((a, b) => a.completionDate.localeCompare(b.completionDate));
    const masteryValues = sorted.map((item) => item.masteryContribution);
    const masteryNormValues = sorted.map((item) => item.masteryContributionNorm);
    const questionSessions = sorted.filter((item) => item.taskType === 'soru çözme');
    const accuracyValues = questionSessions.map((item) => item.accuracyScore).filter((value): value is number => typeof value === 'number');
    const averageAccuracy = accuracyValues.length > 0 ? Math.round(accuracyValues.reduce((sum, value) => sum + value, 0) / accuracyValues.length) : undefined;
    const averageFocus = Math.round(sorted.reduce((sum, item) => sum + item.focusScore, 0) / sorted.length);
    const averageEfficiency = Math.round(sorted.reduce((sum, item) => sum + item.efficiencyScore, 0) / sorted.length);
    const trendSource = accuracyValues.length >= 2 ? accuracyValues : masteryValues;
    const trend = getTrend(trendSource);
    const lastTwo = masteryValues.slice(-2);
    const recentDrop = lastTwo.length === 2 && lastTwo[1] + 10 < lastTwo[0];

    let masteryScore: number;
    if (averageAccuracy !== undefined) {
      masteryScore = Math.round((averageAccuracy * 0.6) + (averageFocus * 0.15) + (averageEfficiency * 0.15) + Math.min(questionSessions.length, 3) * 3);
    } else {
      masteryScore = Math.round((averageFocus * 0.4) + (averageEfficiency * 0.35) + Math.min(sorted.length, 3) * 4);
    }

    if (trend === 'up') masteryScore += 5;
    if (trend === 'down') masteryScore -= 10;
    if (recentDrop) masteryScore -= 6;
    masteryScore = clamp(masteryScore);

    const topicWindow = Math.min(3, Math.floor(masteryNormValues.length / 2));
    let topicTrendNorm = 0.5;
    if (topicWindow > 0) {
      const prev = average(masteryNormValues.slice(-topicWindow * 2, -topicWindow), 0.5);
      const curr = average(masteryNormValues.slice(-topicWindow), prev);
      topicTrendNorm = clamp01((curr - prev + 1) / 2);
    }

    const revisionSessions = sorted.filter((item) => item.taskGoalType === 'konu-tekrari');
    const retentionCandidates = revisionSessions.map((item) => item.accuracyNorm ?? item.taskScoreNorm);

    const baselineDate = sorted[0]?.completionDate;
    const retentionByOffset = (targetDay: number) => {
      if (!baselineDate) return undefined;
      const candidates = sorted
        .map((item) => {
          const diff = dayDiff(baselineDate, item.completionDate);
          if (diff === null) return null;
          if (Math.abs(diff - targetDay) > 1) return null;
          return item.accuracyNorm ?? item.taskScoreNorm;
        })
        .filter((value): value is number => typeof value === 'number');

      if (candidates.length === 0) return undefined;
      return average(candidates, 0.5);
    };

    const retention1d = retentionByOffset(1) ?? average(retentionCandidates.slice(-1), 0.5);
    const retention7d = retentionByOffset(7) ?? average(retentionCandidates, 0.5);
    const retention30d = retentionByOffset(30) ?? average(retentionCandidates.slice(0, Math.min(3, retentionCandidates.length)), retention7d);
    const decayRate = getDecayRate(masteryNormValues);

    const firstAttemptValues = sorted
      .map((item) => item.firstAttemptScore)
      .filter((value): value is number => typeof value === 'number');
    const firstAttemptScore = firstAttemptValues.length > 0 ? Math.round(average(firstAttemptValues, 0)) : undefined;

    const conceptErrorValues = sorted
      .map((item) => item.conceptErrorRate)
      .filter((value): value is number => typeof value === 'number');
    const processErrorValues = sorted
      .map((item) => item.processErrorRate)
      .filter((value): value is number => typeof value === 'number');
    const attentionErrorValues = sorted
      .map((item) => item.attentionErrorRate)
      .filter((value): value is number => typeof value === 'number');

    const conceptErrorRate = conceptErrorValues.length > 0 ? average(conceptErrorValues, 0) : undefined;
    const processErrorRate = processErrorValues.length > 0 ? average(processErrorValues, 0) : undefined;
    const attentionErrorRate = attentionErrorValues.length > 0 ? average(attentionErrorValues, 0) : undefined;

    const masteryNorm = average(masteryNormValues, 0);
    const riskV1 = getRiskV1(masteryNorm, topicTrendNorm);
    const hasRiskV2Signals = retentionCandidates.length > 0 && masteryNormValues.length >= 2;
    const riskV2 = hasRiskV2Signals ? getRiskV2(masteryNorm, topicTrendNorm, retention7d, decayRate) : undefined;
    const riskModel: 'v1' | 'v2' = typeof riskV2 === 'number' ? 'v2' : 'v1';
    const riskScore = toPercent(typeof riskV2 === 'number' ? riskV2 : riskV1);

    const needsRevision =
      masteryScore < 68 ||
      riskScore >= 60 ||
      trend === 'down' ||
      recentDrop ||
      (averageAccuracy !== undefined && averageAccuracy < 60) ||
      (questionSessions.length >= 2 && averageEfficiency < 55);

    return {
      key,
      courseId: sorted[0].courseId,
      courseName: sorted[0].courseName,
      unitName: sorted[0].unitName!,
      topicName: sorted[0].topicName!,
      totalSessions: sorted.length,
      questionSessions: questionSessions.length,
      averageFocus,
      averageAccuracy,
      averageEfficiency,
      trend,
      retention1d,
      retention7d,
      retention30d,
      decayRate,
      firstAttemptScore,
      conceptErrorRate,
      processErrorRate,
      attentionErrorRate,
      riskV1,
      riskV2,
      riskScore,
      riskModel,
      masteryScore,
      needsRevision,
    };
  }).sort((a, b) => a.masteryScore - b.masteryScore);

  const courseMetricsMap = new Map<string, TopicMetrics[]>();
  topics.forEach((topic) => {
    const bucket = courseMetricsMap.get(topic.courseId) || [];
    bucket.push(topic);
    courseMetricsMap.set(topic.courseId, bucket);
  });

  const coursesMetrics: CourseMetrics[] = Array.from(courseMetricsMap.entries()).map(([courseId, bucket]) => {
    const accuracyValues = bucket.map((item) => item.averageAccuracy).filter((value): value is number => typeof value === 'number');
    const weakTopics = bucket.filter((item) => item.needsRevision);
    return {
      courseId,
      courseName: bucket[0].courseName,
      totalSessions: bucket.reduce((sum, item) => sum + item.totalSessions, 0),
      averageFocus: Math.round(bucket.reduce((sum, item) => sum + item.averageFocus, 0) / bucket.length),
      averageAccuracy: accuracyValues.length > 0 ? Math.round(accuracyValues.reduce((sum, value) => sum + value, 0) / accuracyValues.length) : undefined,
      averageEfficiency: Math.round(bucket.reduce((sum, item) => sum + item.averageEfficiency, 0) / bucket.length),
      averageMastery: clamp(Math.round((bucket.reduce((sum, item) => sum + item.masteryScore, 0) / bucket.length) - weakTopics.length * 2)),
      averageRisk: Math.round(bucket.reduce((sum, item) => sum + item.riskScore, 0) / bucket.length),
      weakTopicCount: weakTopics.length,
    };
  }).sort((a, b) => b.averageMastery - a.averageMastery);

  const taskTypeBuckets = new Map<string, SessionMetrics[]>();
  sessions.forEach((session) => {
    const taskTypeKey = session.taskType === 'soru çözme'
      ? 'question'
      : session.taskType === 'kitap okuma'
        ? 'reading'
        : session.taskGoalType === 'konu-tekrari'
          ? 'revision'
          : 'study';
    const bucket = taskTypeBuckets.get(taskTypeKey) || [];
    bucket.push(session);
    taskTypeBuckets.set(taskTypeKey, bucket);
  });

  const taskTypes: TaskTypeMetrics[] = Object.keys(TASK_TYPE_LABELS)
    .map((taskType) => {
      const bucket = taskTypeBuckets.get(taskType) || [];
      const accuracyValues = bucket.map((item) => item.accuracyScore).filter((value): value is number => typeof value === 'number');
      return {
        taskType,
        label: TASK_TYPE_LABELS[taskType],
        totalSessions: bucket.length,
        averageFocus: bucket.length > 0 ? Math.round(bucket.reduce((sum, item) => sum + item.focusScore, 0) / bucket.length) : 0,
        averageAccuracy: accuracyValues.length > 0 ? Math.round(accuracyValues.reduce((sum, value) => sum + value, 0) / accuracyValues.length) : undefined,
        averageEfficiency: bucket.length > 0 ? Math.round(bucket.reduce((sum, item) => sum + item.efficiencyScore, 0) / bucket.length) : 0,
        averageMastery: bucket.length > 0 ? Math.round(bucket.reduce((sum, item) => sum + item.masteryContribution, 0) / bucket.length) : 0,
      };
    })
    .filter((item) => item.totalSessions > 0)
    .sort((a, b) => b.averageMastery - a.averageMastery);

  const studyWindowBuckets = new Map<StudyWindowMetrics['key'], SessionMetrics[]>();
  completedTasks.forEach((task) => {
    const key = getStudyWindowKey(task);
    if (!key) return;
    const session = sessions.find((item) => item.taskId === task.id);
    if (!session) return;
    const bucket = studyWindowBuckets.get(key) || [];
    bucket.push(session);
    studyWindowBuckets.set(key, bucket);
  });

  const studyWindows: StudyWindowMetrics[] = (Object.keys(STUDY_WINDOW_LABELS) as StudyWindowMetrics['key'][])
    .map((key) => {
      const bucket = studyWindowBuckets.get(key) || [];
      const accuracyValues = bucket.map((item) => item.accuracyScore).filter((value): value is number => typeof value === 'number');
      return {
        key,
        label: STUDY_WINDOW_LABELS[key],
        totalSessions: bucket.length,
        averageFocus: bucket.length > 0 ? Math.round(bucket.reduce((sum, item) => sum + item.focusScore, 0) / bucket.length) : 0,
        averageAccuracy: accuracyValues.length > 0 ? Math.round(accuracyValues.reduce((sum, value) => sum + value, 0) / accuracyValues.length) : undefined,
        averageEfficiency: bucket.length > 0 ? Math.round(bucket.reduce((sum, item) => sum + item.efficiencyScore, 0) / bucket.length) : 0,
        averageMastery: bucket.length > 0 ? Math.round(bucket.reduce((sum, item) => sum + item.masteryContribution, 0) / bucket.length) : 0,
      };
    })
    .filter((item) => item.totalSessions > 0)
    .sort((a, b) => b.averageMastery - a.averageMastery);

  const today = getTodayString();
  const assignedTasks = tasks.filter((task) => !task.isSelfAssigned);
  const completedAssignedTasks = assignedTasks.filter((task) => task.status === 'tamamlandı').length;
  const overdueAssignedTasks = assignedTasks.filter((task) => task.status !== 'tamamlandı' && task.dueDate < today).length;
  const selfAssignedTasks = tasks.filter((task) => task.isSelfAssigned).length;
  const completedAllTasks = tasks.filter((task) => task.status === 'tamamlandı').length;
  const planTaskTotals = countPlannedTopicTasks(studyPlans);

  const rawAdherence = tasks.length > 0 ? (completedAllTasks / tasks.length) * 100 : 0;

  const plan: PlanMetrics = {
    totalAssignedTasks: assignedTasks.length,
    completedAssignedTasks,
    overdueAssignedTasks,
    selfAssignedTasks,
    totalPlannedTopicTasks: planTaskTotals.total,
    completedPlannedTopicTasks: planTaskTotals.completed,
    adherenceScore: Math.round(clamp(rawAdherence)),
  };

  const revisionBuckets = new Map<string, { total: number; completed: number }>();
  const disciplineBuckets = new Map<string, { total: number; onTimeCompleted: number }>();
  const examReadinessBuckets = new Map<string, number[]>();
  const recentAccuracyBuckets = new Map<string, number[]>();

  tasks.forEach((task) => {
    const revisionBucket = revisionBuckets.get(task.courseId) || { total: 0, completed: 0 };
    if (task.taskGoalType === 'konu-tekrari') {
      revisionBucket.total += 1;
      if (task.status === 'tamamlandı') revisionBucket.completed += 1;
      revisionBuckets.set(task.courseId, revisionBucket);
    }

    const disciplineBucket = disciplineBuckets.get(task.courseId) || { total: 0, onTimeCompleted: 0 };
    disciplineBucket.total += 1;
    if (task.status === 'tamamlandı' && task.completionDate && task.completionDate <= task.dueDate) {
      disciplineBucket.onTimeCompleted += 1;
    }
    disciplineBuckets.set(task.courseId, disciplineBucket);

    if (task.status === 'tamamlandı' && (task.taskGoalType === 'sinav-hazirlik' || task.taskGoalType === 'olcme-degerlendirme')) {
      const readinessBucket = examReadinessBuckets.get(task.courseId) || [];
      const readinessScore = typeof task.successScore === 'number'
        ? task.successScore
        : typeof task.correctCount === 'number' && (task.questionCount || 0) > 0
          ? Math.round((task.correctCount / Math.max(1, task.questionCount || 1)) * 100)
          : null;
      if (typeof readinessScore === 'number') {
        readinessBucket.push(readinessScore);
        examReadinessBuckets.set(task.courseId, readinessBucket.slice(-5));
      }
    }

    if (task.status === 'tamamlandı' && task.taskType === 'soru çözme') {
      const accuracyBucket = recentAccuracyBuckets.get(task.courseId) || [];
      const accuracyScore = typeof task.correctCount === 'number' && (task.questionCount || 0) > 0
        ? Math.round((task.correctCount / Math.max(1, task.questionCount || 1)) * 100)
        : typeof task.successScore === 'number'
          ? task.successScore
          : null;
      if (typeof accuracyScore === 'number') {
        accuracyBucket.push(accuracyScore);
        recentAccuracyBuckets.set(task.courseId, accuracyBucket.slice(-8));
      }
    }
  });

  const coursePerformance: PeriodCoursePerformance[] = courses.map((course) => {
    const courseMetrics = coursesMetrics.find((item) => item.courseId === course.id);
    const studyScore = courseMetrics
      ? clamp(Math.round(
          (courseMetrics.averageMastery * 0.35)
          + ((courseMetrics.averageAccuracy ?? courseMetrics.averageMastery) * 0.25)
          + (plan.adherenceScore * 0.15)
          + (courseMetrics.averageFocus * 0.10)
          + (((revisionBuckets.get(course.id)?.completed || 0) / Math.max(1, revisionBuckets.get(course.id)?.total || 1)) * 100 * 0.10)
          + (((disciplineBuckets.get(course.id)?.onTimeCompleted || 0) / Math.max(1, disciplineBuckets.get(course.id)?.total || 1)) * 100 * 0.05),
        ))
      : 0;

    const relevantExamRecords = examRecords.filter((item) => item.courseId === course.id);
    const totalWeight = relevantExamRecords.reduce((sum, item) => sum + (item.weight || 1), 0);
    const schoolScore = totalWeight > 0
      ? Math.round(relevantExamRecords.reduce((sum, item) => sum + (item.score * (item.weight || 1)), 0) / totalWeight)
      : null;

    const examReadiness = Math.round(average(examReadinessBuckets.get(course.id) || [], 0));
    const recentQuestionAccuracy = Math.round(average(recentAccuracyBuckets.get(course.id) || [], courseMetrics?.averageAccuracy || 0));
    const predictedSchoolScore = courseMetrics
      ? clamp(Math.round((studyScore * 0.55) + (examReadiness * 0.25) + (recentQuestionAccuracy * 0.20)))
      : null;
    const alignmentGap = schoolScore !== null && predictedSchoolScore !== null ? predictedSchoolScore - schoolScore : null;

    return {
      courseId: course.id,
      courseName: course.name,
      periodKey: 'tum-zamanlar',
      studyScore,
      schoolScore,
      predictedSchoolScore,
      alignmentGap,
      alignmentStatus: getAlignmentStatus(alignmentGap),
      trend: (courseMetrics?.weakTopicCount ? (courseMetrics.weakTopicCount >= 2 ? 'down' : 'flat') : 'flat') as PeriodCoursePerformance['trend'],
      riskLevel: getRiskLevelLabel(courseMetrics ? 100 - courseMetrics.averageMastery : 0),
    };
  }).sort((left, right) => {
    const leftGap = Math.abs(left.alignmentGap || 0);
    const rightGap = Math.abs(right.alignmentGap || 0);
    if (leftGap !== rightGap) return rightGap - leftGap;
    return right.studyScore - left.studyScore;
  });

  const latestStateExam = [...compositeExamResults]
    .filter((item) => item.examType === 'state-exam' || item.examType === 'mock-exam')
    .sort((left, right) => right.date.localeCompare(left.date))[0];

  const overallAccuracyValues = sessions.map((item) => item.accuracyScore).filter((value): value is number => typeof value === 'number');
  const overallMasteryNorm = average(sessions.map((item) => item.masteryContributionNorm), 0);
  const overallAccuracyNorm = average(
    sessions.map((item) => item.accuracyNorm).filter((value): value is number => typeof value === 'number'),
    0.5,
  );
  const overallEfficiencyNorm = average(sessions.map((item) => item.efficiencyNorm), 0);
  const overallFocusNorm = average(sessions.map((item) => item.focusNorm), 0);

  const revisionRetentionValues = sessions
    .filter((session) => session.taskGoalType === 'konu-tekrari')
    .map((session) => session.accuracyNorm ?? session.taskScoreNorm);
  const retentionNorm = average(revisionRetentionValues, 0.5);

  const sortedSessions = [...sessions].sort((a, b) => a.completionDate.localeCompare(b.completionDate));
  const masterySeries = sortedSessions.map((session) => session.masteryContributionNorm);
  const window = Math.min(3, Math.floor(masterySeries.length / 2));
  let trendNorm = 0.5;
  if (window > 0) {
    const prev = average(masterySeries.slice(-window * 2, -window), 0.5);
    const curr = average(masterySeries.slice(-window), prev);
    const delta = curr - prev;
    trendNorm = clamp01((delta + 1) / 2);
  }

  const disciplineNorm = clamp01(plan.adherenceScore / 100);
  const weights = DEFAULT_METRIC_CONFIG.generalScoreWeights;
  const generalScoreNorm = clamp01(
    (weights.mastery * overallMasteryNorm) +
    (weights.accuracy * overallAccuracyNorm) +
    (weights.efficiency * overallEfficiencyNorm) +
    (weights.focus * overallFocusNorm) +
    (weights.retention * retentionNorm) +
    (weights.trend * trendNorm) +
    (weights.discipline * disciplineNorm),
  );
  const averageRisk = topics.length > 0 ? Math.round(average(topics.map((topic) => topic.riskScore), 0)) : 0;
  const riskModel: 'v1' | 'v2' = topics.some((topic) => topic.riskModel === 'v2') ? 'v2' : 'v1';

  return {
    sessions,
    topics,
    courses: coursesMetrics,
    taskTypes,
    studyWindows,
    plan,
    school: {
      examRecords: [...examRecords].sort((left, right) => right.date.localeCompare(left.date)),
      compositeExamResults: [...compositeExamResults].sort((left, right) => right.date.localeCompare(left.date)),
      coursePerformance,
      latestStateExam: latestStateExam
        ? {
            title: latestStateExam.title,
            date: latestStateExam.date,
            totalScore: latestStateExam.totalScore,
            strongestCourses: [...latestStateExam.courses].sort((left, right) => right.score - left.score).slice(0, 3),
            riskCourses: [...latestStateExam.courses].sort((left, right) => left.score - right.score).slice(0, 3),
          }
        : null,
    },
    overall: {
      completedTasks: sessions.length,
      averageFocus: sessions.length > 0 ? Math.round(sessions.reduce((sum, item) => sum + item.focusScore, 0) / sessions.length) : 0,
      averageAccuracy: overallAccuracyValues.length > 0 ? Math.round(overallAccuracyValues.reduce((sum, value) => sum + value, 0) / overallAccuracyValues.length) : undefined,
      averageEfficiency: sessions.length > 0 ? Math.round(sessions.reduce((sum, item) => sum + item.efficiencyScore, 0) / sessions.length) : 0,
      averageMastery: sessions.length > 0 ? Math.round(sessions.reduce((sum, item) => sum + item.masteryContribution, 0) / sessions.length) : 0,
      averageRisk,
      riskModel,
      generalScore: toPercent(generalScoreNorm),
      normalized: {
        mastery: overallMasteryNorm,
        accuracy: overallAccuracyNorm,
        efficiency: overallEfficiencyNorm,
        focus: overallFocusNorm,
        retention: retentionNorm,
        trend: trendNorm,
        discipline: disciplineNorm,
      },
    },
  };
};
