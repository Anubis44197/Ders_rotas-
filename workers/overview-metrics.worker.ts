type OverviewStudyPeriod = 'week1' | 'week3' | 'week6' | 'month' | 'quarter' | 'total';

type TaskLite = {
  completionDate?: string;
  status: 'bekliyor' | 'tamamlandı' | string;
  taskType?: string;
  actualDuration?: number;
  questionCount?: number;
  correctCount?: number;
  incorrectCount?: number;
  emptyCount?: number;
  dueDate?: string;
};

type CompositeExamLite = {
  date: string;
  courses: Array<{ score: number }>;
};

type WorkerInput = {
  period: OverviewStudyPeriod;
  today: string;
  tasks: TaskLite[];
  compositeExamResults: CompositeExamLite[];
};

type WorkerOutput = {
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

const toDate = (value?: string) => (value ? new Date(`${value}T00:00:00`) : null);
const isBetween = (value: Date | null, start: Date, end: Date) => Boolean(value && value >= start && value <= end);
const isCompletedTask = (task: TaskLite) => task.status === 'tamamlandı';

const lookbackDays = (period: OverviewStudyPeriod) => {
  if (period === 'week1') return 7;
  if (period === 'week3') return 21;
  if (period === 'week6') return 42;
  if (period === 'month') return 30;
  if (period === 'quarter') return 90;
  return 0;
};

const comparisonLabel = (period: OverviewStudyPeriod) => {
  if (period === 'month') return 'aya';
  if (period === 'quarter') return '3 aya';
  if (period === 'total') return 'onceki doneme';
  return 'haftaya';
};

const pointCount = (period: OverviewStudyPeriod) => {
  if (period === 'week1' || period === 'week3') return 7;
  if (period === 'week6') return 8;
  if (period === 'month') return 10;
  return 12;
};

self.onmessage = (event: MessageEvent<WorkerInput>) => {
  const { period, today, tasks, compositeExamResults } = event.data;
  const todayDate = new Date(`${today}T00:00:00`);
  const completedWithDate = tasks
    .filter((task) => isCompletedTask(task) && task.completionDate)
    .map((task) => ({ task, completedAt: toDate(task.completionDate) }))
    .filter((item): item is { task: TaskLite; completedAt: Date } => Boolean(item.completedAt))
    .filter((item) => item.completedAt <= todayDate)
    .sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());

  const fallbackStart = new Date(todayDate);
  fallbackStart.setDate(fallbackStart.getDate() - 6);
  let currentStart = fallbackStart;
  let currentEnd = todayDate;
  let previousStart = new Date(fallbackStart);
  let previousEnd = new Date(fallbackStart);

  if (period === 'total') {
    if (completedWithDate.length > 0) currentStart = new Date(completedWithDate[0].completedAt);
    const rangeDays = Math.max(1, Math.floor((currentEnd.getTime() - currentStart.getTime()) / 86400000) + 1);
    previousEnd = new Date(currentStart);
    previousEnd.setDate(previousEnd.getDate() - 1);
    previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - (rangeDays - 1));
  } else {
    const range = lookbackDays(period);
    currentStart = new Date(todayDate);
    currentStart.setDate(currentStart.getDate() - Math.max(0, range - 1));
    previousEnd = new Date(currentStart);
    previousEnd.setDate(previousEnd.getDate() - 1);
    previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - Math.max(0, range - 1));
  }

  const currentTasks = completedWithDate.filter((x) => isBetween(x.completedAt, currentStart, currentEnd)).map((x) => x.task);
  const previousTasks = completedWithDate.filter((x) => isBetween(x.completedAt, previousStart, previousEnd)).map((x) => x.task);

  const totalMinutes = Math.round(currentTasks.reduce((s, t) => s + ((t.actualDuration || 0) / 60), 0));
  const previousMinutes = Math.round(previousTasks.reduce((s, t) => s + ((t.actualDuration || 0) / 60), 0));
  const completionTarget = Math.max(
    currentTasks.length + tasks.filter((task) => task.status === 'bekliyor' && isBetween(toDate(task.dueDate), currentStart, currentEnd)).length,
    1,
  );
  const completionPercent = Math.max(0, Math.min(100, Math.round((currentTasks.length / completionTarget) * 100)));
  const minuteChange = previousMinutes > 0 ? Math.round(((totalMinutes - previousMinutes) / previousMinutes) * 100) : (totalMinutes > 0 ? 100 : 0);

  const solvedCurrent = currentTasks.reduce((sum, task) => {
    const answered = (task.correctCount || 0) + (task.incorrectCount || 0) + (task.emptyCount || 0);
    return sum + Math.max(task.questionCount || 0, answered);
  }, 0);
  const solvedPrevious = previousTasks.reduce((sum, task) => {
    const answered = (task.correctCount || 0) + (task.incorrectCount || 0) + (task.emptyCount || 0);
    return sum + Math.max(task.questionCount || 0, answered);
  }, 0);
  const solvedQuestionChange = solvedPrevious > 0 ? Math.round(((solvedCurrent - solvedPrevious) / solvedPrevious) * 100) : (solvedCurrent > 0 ? 100 : 0);

  const compositeWithDate = compositeExamResults
    .map((exam) => ({ exam, date: toDate(exam.date) }))
    .filter((item): item is { exam: CompositeExamLite; date: Date } => Boolean(item.date));
  const periodCompositeAverage = (start: Date, end: Date) => {
    const periodExams = compositeWithDate.filter((item) => isBetween(item.date, start, end));
    if (periodExams.length === 0) return null;
    const scores = periodExams.flatMap((item) => item.exam.courses.map((c) => c.score));
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((s, x) => s + x, 0) / scores.length);
  };
  const currentExam = periodCompositeAverage(currentStart, currentEnd);
  const previousExam = periodCompositeAverage(previousStart, previousEnd);
  const hasExamTrendData = currentExam !== null && previousExam !== null;
  const examDelta = hasExamTrendData ? (currentExam! - previousExam!) : 0;

  const dayMs = 86400000;
  const points = pointCount(period);
  const totalRangeDays = Math.max(1, Math.floor((currentEnd.getTime() - currentStart.getTime()) / dayMs) + 1);
  const bucketSize = Math.max(1, Math.ceil(totalRangeDays / points));
  const dailyAccuracyPoints = Array.from({ length: points }, (_, i) => {
    const bucketStart = new Date(currentStart);
    bucketStart.setDate(bucketStart.getDate() + (i * bucketSize));
    const bucketEnd = new Date(bucketStart);
    bucketEnd.setDate(bucketEnd.getDate() + bucketSize - 1);
    if (bucketEnd > currentEnd) bucketEnd.setTime(currentEnd.getTime());
    const bucketTasks = currentTasks.filter((task) => {
      const completedAt = toDate(task.completionDate);
      const answered = (task.correctCount || 0) + (task.incorrectCount || 0);
      const hasQuestionPayload = (task.questionCount || 0) > 0 || answered > 0;
      return hasQuestionPayload && isBetween(completedAt, bucketStart, bucketEnd);
    });
    const answered = bucketTasks.reduce((sum, task) => sum + ((task.correctCount || 0) + (task.incorrectCount || 0)), 0);
    const correct = bucketTasks.reduce((sum, task) => sum + (task.correctCount || 0), 0);
    return answered > 0 ? Math.round((correct / answered) * 100) : 0;
  });

  const output: WorkerOutput = {
    completedCount: currentTasks.length,
    completionTarget,
    completionPercent,
    totalMinutes,
    minuteChange,
    solvedQuestionCount: solvedCurrent,
    solvedQuestionChange,
    comparisonLabel: comparisonLabel(period),
    examDelta,
    hasExamTrendData,
    dailyAccuracyPoints,
  };
  self.postMessage(output);
};

