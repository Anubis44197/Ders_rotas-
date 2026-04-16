import { deriveAnalysisSnapshot } from '../utils/analysisEngine';
import { calculateTaskPoints } from '../utils/scoringAlgorithm';
import type { Course, Reward, Task, TaskCompletionData } from '../types';

const today = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const copy = new Date(today);
  copy.setDate(copy.getDate() - n);
  return iso(copy);
};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const courses: Course[] = [
  { id: 'c1', name: 'Matematik', icon: 'BookOpen' },
  { id: 'c2', name: 'Fen', icon: 'BookOpen' },
];

const baseTask = (partial: Partial<Task>): Task => ({
  id: `t_${Math.random().toString(36).slice(2, 8)}`,
  courseId: 'c1',
  title: 'Gorev',
  dueDate: iso(today),
  status: 'tamamlandı',
  taskType: 'ders çalışma',
  plannedDuration: 30,
  completionDate: iso(today),
  completionTimestamp: today.getTime(),
  isSelfAssigned: false,
  ...partial,
});

const completion: TaskCompletionData = {
  actualDuration: 1800,
  breakTime: 120,
  pauseTime: 60,
  correctCount: 16,
  incorrectCount: 4,
};

const runAssignmentCompletionRewardFlow = () => {
  const assignmentTask = baseTask({ taskType: 'soru çözme', questionCount: 20, title: 'Soru cozme gorevi' });
  const scoring = calculateTaskPoints(assignmentTask, completion, 82, 78);

  let successPoints = 0;
  successPoints += scoring.pointsAwarded;

  const reward: Reward = { id: 'r1', name: 'Mini Odul', cost: Math.max(1, scoring.pointsAwarded - 1), icon: 'Gift' };
  const canClaim = successPoints >= reward.cost;
  if (canClaim) {
    successPoints -= reward.cost;
  }

  assert(scoring.pointsAwarded > 0, 'Puan hesaplamasi sifirdan buyuk olmali.');
  assert(canClaim, 'Odul talep edilebilir olmali.');
  assert(successPoints >= 0, 'Puan dusumu sonrasi negatif olmamali.');
};

const runTaskTypeCoverage = () => {
  const tasks: Task[] = [
    baseTask({ taskType: 'soru çözme', questionCount: 20, correctCount: 16, completionDate: daysAgo(1), completionTimestamp: new Date(`${daysAgo(1)}T10:00:00`).getTime() }),
    baseTask({ taskType: 'ders çalışma', taskGoalType: 'konu-tekrari', completionDate: daysAgo(2), completionTimestamp: new Date(`${daysAgo(2)}T14:00:00`).getTime() }),
    baseTask({ taskType: 'ders çalışma', taskGoalType: 'ders calisma', completionDate: daysAgo(3), completionTimestamp: new Date(`${daysAgo(3)}T18:00:00`).getTime() }),
  ];

  const snapshot = deriveAnalysisSnapshot(tasks, courses, []);
  const keys = snapshot.taskTypes.map((item) => item.taskType);

  assert(keys.includes('question'), 'question kovasi uretilmeli.');
  assert(keys.includes('revision'), 'revision kovasi uretilmeli.');
  assert(keys.includes('study'), 'study kovasi uretilmeli.');
};

const runExportImportConsistency = () => {
  const tasks: Task[] = [
    baseTask({ taskType: 'soru çözme', questionCount: 10, correctCount: 8, completionDate: daysAgo(1), completionTimestamp: new Date(`${daysAgo(1)}T09:00:00`).getTime() }),
    baseTask({ taskType: 'ders çalışma', taskGoalType: 'konu-tekrari', completionDate: daysAgo(4), completionTimestamp: new Date(`${daysAgo(4)}T20:00:00`).getTime() }),
  ];

  const before = deriveAnalysisSnapshot(tasks, courses, []);
  const restoredTasks = JSON.parse(JSON.stringify(tasks)) as Task[];
  const restoredCourses = JSON.parse(JSON.stringify(courses)) as Course[];
  const after = deriveAnalysisSnapshot(restoredTasks, restoredCourses, []);

  assert(JSON.stringify(before) === JSON.stringify(after), 'Import/export sonrasi analiz snapshot ayni olmali.');
};

const runDeterminismCheck = () => {
  const tasks: Task[] = [
    baseTask({ taskType: 'soru çözme', questionCount: 25, correctCount: 20, completionDate: daysAgo(1), completionTimestamp: new Date(`${daysAgo(1)}T09:00:00`).getTime() }),
    baseTask({ taskType: 'soru çözme', questionCount: 25, correctCount: 15, completionDate: daysAgo(5), completionTimestamp: new Date(`${daysAgo(5)}T11:00:00`).getTime() }),
    baseTask({ taskType: 'ders çalışma', taskGoalType: 'konu-tekrari', completionDate: daysAgo(6), completionTimestamp: new Date(`${daysAgo(6)}T18:30:00`).getTime() }),
  ];

  const first = deriveAnalysisSnapshot(tasks, courses, []);
  const second = deriveAnalysisSnapshot(tasks, courses, []);

  assert(JSON.stringify(first) === JSON.stringify(second), 'Ayni girdide ayni sonuc uretilmeli.');
};

const runDataVolumeScenarios = () => {
  const noData = deriveAnalysisSnapshot([], courses, []);
  assert(noData.sessions.length === 0, 'Veri yok senaryosunda session listesi bos olmali.');
  assert(noData.overall.generalScore >= 0 && noData.overall.generalScore <= 100, 'Veri yok senaryosunda genel skor 0-100 araliginda olmali.');

  const lowDataTasks: Task[] = [
    baseTask({
      taskType: 'soru çözme',
      questionCount: 5,
      correctCount: 4,
      completionDate: daysAgo(1),
      completionTimestamp: new Date(`${daysAgo(1)}T12:00:00`).getTime(),
    }),
  ];
  const lowData = deriveAnalysisSnapshot(lowDataTasks, courses, []);
  assert(lowData.sessions.length === 1, 'Az veri senaryosunda tek session beklenir.');
  assert(lowData.taskTypes.some((item) => item.taskType === 'question'), 'Az veri senaryosunda question gorev tipi uretilmeli.');

  const highDataTasks: Task[] = Array.from({ length: 120 }, (_, index) => {
    const day = daysAgo(index % 14);
    const isQuestion = index % 3 === 0;
    const isRevision = index % 5 === 0;
    const actualDuration = 1200 + ((index % 6) * 300);
    const breakTime = (index % 4) * 60;
    const pauseTime = (index % 3) * 45;
    const questionCount = isQuestion ? 20 : undefined;
    const correctCount = isQuestion ? 12 + (index % 9) : undefined;

    return baseTask({
      id: `bulk_${index}`,
      courseId: index % 2 === 0 ? 'c1' : 'c2',
      taskType: isQuestion ? 'soru çözme' : 'ders çalışma',
      taskGoalType: isRevision ? 'konu-tekrari' : 'ders calisma',
      plannedDuration: 30,
      actualDuration,
      breakTime,
      pauseTime,
      questionCount,
      correctCount,
      incorrectCount: isQuestion ? Math.max((questionCount || 0) - (correctCount || 0), 0) : undefined,
      completionDate: day,
      completionTimestamp: new Date(`${day}T1${index % 10}:00:00`).getTime(),
    });
  });

  const highData = deriveAnalysisSnapshot(highDataTasks, courses, []);
  assert(highData.sessions.length === highDataTasks.length, 'Cok veri senaryosunda tum tamamlanan gorevler sessiona donusmeli.');
  assert(highData.overall.generalScore >= 0 && highData.overall.generalScore <= 100, 'Cok veri senaryosunda genel skor 0-100 araliginda olmali.');
  assert(highData.taskTypes.length >= 2, 'Cok veri senaryosunda en az iki gorev tipi olusmali.');
};

const main = () => {
  runAssignmentCompletionRewardFlow();
  runTaskTypeCoverage();
  runExportImportConsistency();
  runDeterminismCheck();
  runDataVolumeScenarios();
  console.log('SMOKE_TESTS_OK');
};

main();
