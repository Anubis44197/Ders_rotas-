import { performance } from 'node:perf_hooks';
import { deriveAnalysisSnapshot } from '../utils/analysisEngine';
import { createWeeklyPlanDraft } from '../utils/planEngine';
import { INITIAL_REAL_COURSES, INITIAL_REAL_CURRICULUM, INITIAL_REAL_PERFORMANCE } from '../initialRealCurriculum';
import type {
  CompositeExamResult,
  Course,
  ExamRecord,
  ExamScheduleEntry,
  PerformanceData,
  PlanningEngineSnapshot,
  Reward,
  ScheduleDayWindow,
  StoredStudyPlan,
  SubjectCurriculum,
  Task,
  WeeklySchedule,
} from '../types';

const TOTAL_TASKS = 6000;
const QUESTION_TASKS = 4500;
const REVISION_TASKS = 750;
const STUDY_TASKS = 750;
const COMPLETED_TASKS = 5900;
const ANALYSIS_BUDGET_MS = 5000;
const BACKUP_BUDGET_MS = 2500;

const today = new Date('2026-05-15T12:00:00');
const iso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (count: number) => {
  const copy = new Date(today);
  copy.setDate(copy.getDate() + count);
  return iso(copy);
};
const daysAgo = (count: number) => addDays(-count);

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const activeCourses: Course[] = INITIAL_REAL_COURSES.filter((course) => course.active !== false);
const curriculum: SubjectCurriculum = INITIAL_REAL_CURRICULUM;

type TopicRef = {
  course: Course;
  unitName: string;
  topicName: string;
  sequence: number;
};

const topicRefs: TopicRef[] = activeCourses.flatMap((course) => {
  const units = curriculum[course.name] || [];
  return units.flatMap((unit, unitIndex) => unit.topics.map((topic, topicIndex) => ({
    course,
    unitName: unit.name,
    topicName: topic.name,
    sequence: (course.order * 1000) + (unitIndex * 100) + topicIndex,
  })));
});

assert(activeCourses.length === 6, 'Gercek ders sayisi 6 olmali.');
assert(topicRefs.length >= 100, 'Gercek mufredat en az 100 konu icermeli.');

const weightedCourses = activeCourses.flatMap((course) => {
  const weight = course.name === 'Matematik' ? 4
    : course.name === 'Fen Bilgisi' ? 3
      : course.name === 'T\u00fcrk\u00e7e' ? 3
        : course.name === 'Ingilizce' ? 2
          : 1;
  return Array.from({ length: weight }, () => course);
});

const refsByCourse = new Map<string, TopicRef[]>();
topicRefs.forEach((ref) => {
  const bucket = refsByCourse.get(ref.course.id) || [];
  bucket.push(ref);
  refsByCourse.set(ref.course.id, bucket);
});

const pickCourse = (index: number) => weightedCourses[index % weightedCourses.length];
const pickTopic = (index: number, course: Course) => {
  const bucket = refsByCourse.get(course.id) || topicRefs;
  return bucket[index % bucket.length];
};

const completionDateFor = (index: number) => daysAgo(index % 180);
const completionTimestampFor = (index: number) => {
  const day = completionDateFor(index);
  const hourBuckets = [7, 10, 13, 16, 18, 20, 22, 23];
  const hour = hourBuckets[index % hourBuckets.length];
  const minute = (index * 7) % 60;
  return new Date(`${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`).getTime();
};

const createTask = (index: number): Task => {
  const course = pickCourse(index);
  const topic = pickTopic(index * 7, course);
  const isQuestion = index < QUESTION_TASKS;
  const isRevision = index >= QUESTION_TASKS && index < QUESTION_TASKS + REVISION_TASKS;
  const completed = index < COMPLETED_TASKS;
  const weakTopic = topic.sequence % 11 === 0;
  const baseAccuracy = weakTopic ? 0.45 + ((index % 9) / 100) : 0.62 + ((index % 28) / 100);
  const questionCount = isQuestion ? 12 + (index % 29) : undefined;
  const correctCount = questionCount ? Math.max(0, Math.min(questionCount, Math.round(questionCount * baseAccuracy))) : undefined;
  const incorrectCount = questionCount && correctCount !== undefined ? Math.max(0, questionCount - correctCount - (index % 3 === 0 ? 1 : 0)) : undefined;
  const emptyCount = questionCount && correctCount !== undefined && incorrectCount !== undefined ? Math.max(0, questionCount - correctCount - incorrectCount) : undefined;
  const plannedDuration = isQuestion ? 25 + (index % 5) * 5 : isRevision ? 30 : 40;
  const actualDuration = (plannedDuration * 60) + ((index % 7) - 2) * 120;
  const normalizedAccuracy = questionCount ? (correctCount || 0) / questionCount : undefined;
  const successScore = typeof normalizedAccuracy === 'number'
    ? Math.round(normalizedAccuracy * 100)
    : isRevision
      ? 58 + (index % 35)
      : 55 + (index % 38);

  return {
    id: `qa_heavy_task_${index}`,
    courseId: course.id,
    title: `${course.name} - ${topic.topicName}`,
    description: index % 17 === 0 ? `Uzun konu dayan\u0131kl\u0131l\u0131k kontrolu: ${topic.unitName} / ${topic.topicName}` : undefined,
    dueDate: daysAgo((index % 180) + (completed ? 0 : -7)),
    status: completed ? 'tamamland\u0131' : 'bekliyor',
    taskType: isQuestion ? 'soru \u00e7\u00f6zme' : 'ders \u00e7al\u0131\u015fma',
    taskGoalType: isQuestion ? 'test-cozme' : isRevision ? 'konu-tekrari' : 'ders calisma',
    plannedDuration,
    actualDuration: completed ? Math.max(300, actualDuration) : undefined,
    breakTime: completed ? (index % 6) * 45 : undefined,
    pauseTime: completed ? (index % 5) * 30 : undefined,
    questionCount,
    correctCount,
    incorrectCount,
    emptyCount,
    firstAttemptScore: isQuestion ? Math.max(20, successScore - (index % 13)) : undefined,
    selfAssessmentScore: completed ? Math.max(20, Math.min(100, successScore + ((index % 15) - 7))) : undefined,
    confidenceGap: completed ? ((index % 15) - 7) : undefined,
    conceptErrorCount: isQuestion ? (weakTopic ? 3 + (index % 4) : index % 3) : undefined,
    processErrorCount: isQuestion ? index % 4 : undefined,
    attentionErrorCount: isQuestion ? index % 5 : undefined,
    successScore: completed ? successScore : undefined,
    focusScore: completed ? Math.max(35, Math.min(100, 78 - (index % 9) + (weakTopic ? -6 : 8))) : undefined,
    completionDate: completed ? completionDateFor(index) : undefined,
    completionTimestamp: completed ? completionTimestampFor(index) : undefined,
    isSelfAssigned: index % 10 === 0,
    curriculumUnitName: topic.unitName,
    curriculumTopicName: topic.topicName,
    planTaskId: index % 12 === 0 ? `qa_plan_block_${index}` : undefined,
    planWeek: index % 12 === 0 ? 20 - (index % 8) : undefined,
    planSource: index % 12 === 0 ? 'weekly-plan' : undefined,
  };
};

const tasks = Array.from({ length: TOTAL_TASKS }, (_, index) => createTask(index));

const weeklySchedule: WeeklySchedule = {
  Pazartesi: {
    confirmed: true,
    slots: [{ id: 'school_math_mon', courseName: 'Matematik', startTime: '09:00', endTime: '10:00' }],
    availableWindows: [
      { id: 'study_mon_deep', startTime: '16:00', endTime: '17:30', quality: 'deep' },
      { id: 'study_mon_medium', startTime: '19:00', endTime: '20:00', quality: 'medium' },
    ],
  },
  Sali: { confirmed: true, slots: [{ id: 'school_tr_tue', courseName: 'T\u00fcrk\u00e7e', startTime: '10:00', endTime: '11:00' }], availableWindows: [{ id: 'study_tue', startTime: '17:00', endTime: '18:30', quality: 'medium' }] },
  Carsamba: { confirmed: true, slots: [{ id: 'school_science_wed', courseName: 'Fen Bilgisi', startTime: '09:00', endTime: '10:00' }], availableWindows: [{ id: 'study_wed', startTime: '16:30', endTime: '18:00', quality: 'deep' }] },
  Persembe: { confirmed: true, slots: [], availableWindows: [{ id: 'study_thu', startTime: '17:00', endTime: '18:00', quality: 'light' }] },
  Cuma: { confirmed: true, slots: [], availableWindows: [{ id: 'study_fri', startTime: '16:00', endTime: '17:30', quality: 'medium' }] },
  Cumartesi: { confirmed: true, slots: [], availableWindows: [{ id: 'study_sat', startTime: '11:00', endTime: '12:30', quality: 'deep' }] },
  Pazar: { confirmed: true, slots: [], availableWindows: [{ id: 'study_sun', startTime: '11:00', endTime: '12:00', quality: 'light' }] },
};

const examRecords: ExamRecord[] = activeCourses.map((course, index) => ({
  id: `qa_exam_${course.id}`,
  courseId: course.id,
  courseName: course.name,
  examType: 'school-written',
  title: `${course.name} yaz\u0131l\u0131s\u0131`,
  date: daysAgo(6 + index),
  termKey: '2026-2',
  scopeType: 'course',
  score: 58 + ((index * 7) % 35),
  maxScore: 100,
  source: 'manual',
}));

const compositeExamResults: CompositeExamResult[] = [
  {
    id: 'qa_lgs_deneme_1',
    title: 'Genel deneme 1',
    examType: 'mock-exam',
    date: daysAgo(3),
    totalScore: 410,
    courses: activeCourses.map((course, index) => ({ courseId: course.id, courseName: course.name, score: 55 + ((index * 9) % 38), net: 8 + index * 1.5 })),
  },
];

const examScheduleEntries: ExamScheduleEntry[] = activeCourses.slice(0, 4).map((course, index) => ({
  id: `qa_upcoming_exam_${course.id}`,
  courseId: course.id,
  courseName: course.name,
  examName: `${course.name} yakla\u015fan yaz\u0131l\u0131`,
  date: addDays(3 + index * 2),
}));

const studyPlan: StoredStudyPlan = {
  id: 'qa_heavy_plan_week_20',
  week: 20,
  version: 1,
  status: 'active',
  reason: 'initial-plan',
  generatedAt: today.toISOString(),
  approvedAt: today.toISOString(),
  approvedBy: 'parent',
  type: 'normal',
  schedule: weeklySchedule,
  plan: {
    Matematik: {
      units: [{
        name: topicRefs[0].unitName,
        topics: [{
          name: topicRefs[0].topicName,
          tasks: tasks.filter((task) => task.planTaskId).slice(0, 30).map((task) => ({
            id: task.planTaskId!,
            day: 'Pazartesi',
            startTime: '16:00',
            endTime: '17:00',
            type: task.taskGoalType === 'test-cozme' ? 'question_practice' : task.taskGoalType === 'konu-tekrari' ? 'revision' : 'new_learning',
            duration: task.plannedDuration,
            questionCount: task.questionCount || null,
            source: 'Haftal\u0131k plan',
            completed: task.status === 'tamamland\u0131',
          }))
        }],
      }],
    },
  },
};

const performanceData: PerformanceData[] = INITIAL_REAL_PERFORMANCE.map((item, index) => ({
  ...item,
  correct: 900 - index * 45,
  incorrect: 120 + index * 17,
  timeSpent: 1100 + index * 90,
}));

const rewards: Reward[] = [
  { id: 'qa_reward_book', name: 'Kitap se\u00e7imi', cost: 120, icon: 'Gift' },
  { id: 'qa_reward_break', name: 'Ek mola', cost: 80, icon: 'Gift' },
];

const buildPlanningSnapshot = (): PlanningEngineSnapshot => ({
  scheduleDays: Object.entries(weeklySchedule).map(([dayName, day]) => ({
    dayName,
    schoolBlocks: day.slots.map((slot) => ({ id: slot.id, courseName: slot.courseName, startTime: slot.startTime, endTime: slot.endTime })),
    availableWindows: day.availableWindows || [],
    confirmed: day.confirmed,
  })),
  curriculumTopics: topicRefs.map((ref) => ({
    id: `topic_${ref.course.id}_${ref.sequence}`,
    courseId: ref.course.id,
    courseName: ref.course.name,
    unitName: ref.unitName,
    topicName: ref.topicName,
    sequenceOrder: ref.sequence,
    isRequired: true,
  })),
  examSchedules: examScheduleEntries,
  topicStatuses: topicRefs.slice(0, 40).map((ref, index) => ({
    topicId: `topic_${ref.course.id}_${ref.sequence}`,
    status: index % 3 === 0 ? 'needs_revision' : index % 3 === 1 ? 'new' : 'in_progress',
    nextRecommendedAction: index % 3 === 0 ? 'revise' : index % 3 === 1 ? 'learn' : 'practice',
  })),
  studyPlanRecords: [],
  planBlockRecords: [],
  studySessions: [],
  assessmentResults: [],
  replanTriggers: [],
});

const assertNoBadNumbers = (value: unknown, path = 'snapshot') => {
  if (typeof value === 'number') {
    assert(Number.isFinite(value), `${path} finite sayi olmali.`);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoBadNumbers(item, `${path}[${index}]`));
    return;
  }
  Object.entries(value as Record<string, unknown>).forEach(([key, item]) => assertNoBadNumbers(item, `${path}.${key}`));
};

const runDatasetShapeContract = () => {
  const questionCount = tasks.filter((task) => task.taskType === 'soru \u00e7\u00f6zme').length;
  const revisionCount = tasks.filter((task) => task.taskGoalType === 'konu-tekrari').length;
  const studyCount = tasks.filter((task) => task.taskGoalType === 'ders calisma').length;
  const completedCount = tasks.filter((task) => task.status === 'tamamland\u0131').length;
  const usedCourseIds = new Set(tasks.map((task) => task.courseId));
  const usedTopicKeys = new Set(tasks.map((task) => `${task.courseId}:${task.curriculumUnitName}:${task.curriculumTopicName}`));

  assert(tasks.length === TOTAL_TASKS, 'Toplam gorev sayisi 6000 olmali.');
  assert(questionCount === QUESTION_TASKS, 'Soru cozme sayisi 4500 olmali.');
  assert(revisionCount === REVISION_TASKS, 'Konu tekrari sayisi 750 olmali.');
  assert(studyCount === STUDY_TASKS, 'Ders calisma sayisi 750 olmali.');
  assert(completedCount === COMPLETED_TASKS, 'Tamamlanan gorev sayisi 5900 olmali.');
  assert(usedCourseIds.size === activeCourses.length, 'Tum aktif derslere veri dagilmali.');
  assert(usedTopicKeys.size >= 90, 'En az 90 farkli konuya veri dagilmali.');
};

const runAnalysisContract = () => {
  const start = performance.now();
  const analysis = deriveAnalysisSnapshot(tasks, activeCourses, [studyPlan], examRecords, compositeExamResults);
  const elapsedMs = Math.round(performance.now() - start);

  assert(elapsedMs <= ANALYSIS_BUDGET_MS, `Analiz ${ANALYSIS_BUDGET_MS}ms altinda tamamlanmali, gercek: ${elapsedMs}ms.`);
  assert(analysis.sessions.length === COMPLETED_TASKS, 'Tamamlanan her gorev analiz sessionina donusmeli.');
  assert(analysis.overall.completedTasks === COMPLETED_TASKS, 'Genel tamamlanan gorev sayaci dogru olmali.');
  assert(analysis.courses.length === activeCourses.length, 'Tum aktif dersler icin ders metrikleri olusmali.');
  assert(analysis.taskTypes.some((item) => item.taskType === 'question' && item.totalSessions > 3000), 'Soru cozme task type verisi dolu olmali.');
  assert(analysis.taskTypes.some((item) => item.taskType === 'revision' && item.totalSessions > 500), 'Konu tekrari task type verisi dolu olmali.');
  assert(analysis.taskTypes.some((item) => item.taskType === 'study' && item.totalSessions > 500), 'Ders calisma task type verisi dolu olmali.');
  assert(analysis.topics.length >= 90, 'Konu bazli analiz en az 90 konu uretmeli.');
  assert(analysis.studyWindows.length >= 4, `Saat penceresi analizi tum gun dilimlerini kapsamali. Gercek: ${JSON.stringify(analysis.studyWindows)}`);
  assert(analysis.school.coursePerformance.length === activeCourses.length, 'Okul/ev uyum metrikleri tum dersleri kapsamali.');
  assert(analysis.school.latestStateExam?.riskCourses.length === 3, 'Deneme risk dersleri uretilmeli.');
  assert(analysis.plan.totalPlannedTopicTasks === 30, 'Plan gorevleri analiz plan metrigine yansimali.');
  assert(analysis.plan.completedPlannedTopicTasks > 0, 'Tamamlanan plan gorevleri analiz plan metrigine yansimali.');
  assert(analysis.overall.generalScore >= 0 && analysis.overall.generalScore <= 100, 'Genel skor 0-100 araliginda olmali.');
  assertNoBadNumbers(analysis);

  return { analysis, elapsedMs };
};

const runGraphContracts = (analysis: ReturnType<typeof deriveAnalysisSnapshot>) => {
  const questionSessions = analysis.sessions.filter((session) => session.taskType === 'soru \u00e7\u00f6zme' && typeof session.accuracyScore === 'number');
  const revisionSessions = analysis.sessions.filter((session) => session.taskGoalType === 'konu-tekrari');
  const masteredTopics = analysis.topics.filter((topic) => topic.masteryScore >= 70);
  const riskyTopics = analysis.topics.filter((topic) => topic.riskScore >= 60);
  const dailyBuckets = new Set(analysis.sessions.map((session) => session.completionDate));

  assert(dailyBuckets.size >= 120, 'Genel skor/EMA trendi icin en az 120 gunluk veri olmali.');
  assert(analysis.courses.every((course) => course.totalSessions > 0), 'Ders performans grafiginde her ders dolu olmali.');
  assert(riskyTopics.length > 0, 'Risk grafigi icin riskli konu olmali.');
  assert(masteredTopics.length > 0, 'Mufredat kapsama icin hakim konu olmali.');
  assert(revisionSessions.length >= 500, 'Kalicilik egrisi icin tekrar oturumu yeterli olmali.');
  assert(questionSessions.length >= 3000, 'Dogruluk/sure grafigi icin soru oturumu yeterli olmali.');
  assert(analysis.studyWindows.length >= 4, 'En verimli zaman grafigi icin saat penceresi verisi olmali.');
  assert(analysis.sessions.some((session) => session.masteryContribution > 0), 'Ogrenme verimi grafigi icin katkı olmali.');
  assert(analysis.taskTypes.length >= 3, 'Gorev turu analizi icin 3 ana tur olmali.');
};

const runPlanningContract = () => {
  const snapshot = buildPlanningSnapshot();
  const drafts = createWeeklyPlanDraft({
    mode: 'ai_normal',
    tempo: 'Orta',
    candidateTopics: snapshot.curriculumTopics.slice(0, 40).map((topic) => ({
      subject: topic.courseName,
      unitName: topic.unitName,
      topicName: topic.topicName,
      completed: false,
    })),
    snapshot,
    weeklySchedule,
  });

  assert(drafts.length >= 6, 'Plan motoru gercek mufredattan en az 6 blok uretmeli.');
  assert(drafts.every((draft) => {
    const day = weeklySchedule[draft.day];
    return (day.availableWindows || []).some((window) => draft.startTime >= window.startTime && draft.endTime <= window.endTime);
  }), 'Plan bloklari ev calisma penceresi disina tasmamali.');
};

const runBackupRoundTripContract = () => {
  const start = performance.now();
  const backup = {
    backup: {
      app: 'Ders Rotasi',
      schemaVersion: 3,
      exportedAt: today.toISOString(),
      summary: {
        courses: activeCourses.length,
        tasks: tasks.length,
        rewards: rewards.length,
        examRecords: examRecords.length,
        studyPlans: 1,
      },
    },
    appData: {
      courses: activeCourses,
      tasks,
      rewards,
      performanceData,
      successPoints: 1200,
      curriculum,
      weeklySchedule,
      examRecords,
      compositeExamResults,
      examScheduleEntries,
      studyPlans: [studyPlan],
    },
  };
  const restored = JSON.parse(JSON.stringify(backup));
  const elapsedMs = Math.round(performance.now() - start);

  assert(elapsedMs <= BACKUP_BUDGET_MS, `Yedek round-trip ${BACKUP_BUDGET_MS}ms altinda olmali, gercek: ${elapsedMs}ms.`);
  assert(restored.appData.tasks.length === TOTAL_TASKS, 'Yedek round-trip gorev kaybi uretmemeli.');
  assert(restored.appData.courses.length === activeCourses.length, 'Yedek round-trip ders kaybi uretmemeli.');

  const before = deriveAnalysisSnapshot(tasks, activeCourses, [studyPlan], examRecords, compositeExamResults);
  const after = deriveAnalysisSnapshot(restored.appData.tasks, restored.appData.courses, restored.appData.studyPlans, restored.appData.examRecords, restored.appData.compositeExamResults);
  assert(after.overall.completedTasks === before.overall.completedTasks, 'Yedek round-trip analiz tamamlanan sayisini degistirmemeli.');
  assert(after.sessions.length === before.sessions.length, 'Yedek round-trip session sayisini degistirmemeli.');
  assert(after.overall.generalScore === before.overall.generalScore, 'Yedek round-trip genel skoru degistirmemeli.');

  return elapsedMs;
};

const main = () => {
  runDatasetShapeContract();
  const { analysis, elapsedMs } = runAnalysisContract();
  runGraphContracts(analysis);
  runPlanningContract();
  const backupElapsedMs = runBackupRoundTripContract();

  console.log(JSON.stringify({
    status: 'HEAVY_REAL_DATA_TESTS_OK',
    totalTasks: TOTAL_TASKS,
    completedTasks: COMPLETED_TASKS,
    questionTasks: QUESTION_TASKS,
    revisionTasks: REVISION_TASKS,
    studyTasks: STUDY_TASKS,
    activeCourses: activeCourses.length,
    curriculumTopics: topicRefs.length,
    analyzedSessions: analysis.sessions.length,
    analyzedTopics: analysis.topics.length,
    analysisElapsedMs: elapsedMs,
    backupRoundTripElapsedMs: backupElapsedMs,
    generalScore: analysis.overall.generalScore,
  }, null, 2));
};

main();
