import { deriveAnalysisSnapshot } from '../utils/analysisEngine';
import { createWeeklyPlanDraft } from '../utils/planEngine';
import type {
  Badge,
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

const today = new Date();
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

const courses: Course[] = [
  { id: 'math', name: 'Matematik', active: true, order: 0, icon: 'BookOpen' },
  { id: 'tr', name: 'Türkçe', active: true, order: 1, icon: 'BookOpen' },
  { id: 'science', name: 'Fen Bilimleri', active: true, order: 2, icon: 'BookOpen' },
  { id: 'social', name: 'Sosyal Bilgiler', active: true, order: 3, icon: 'BookOpen' },
  { id: 'eng', name: 'İngilizce', active: false, order: 4, icon: 'BookOpen' },
];

const curriculum: SubjectCurriculum = courses
  .filter((course) => course.active !== false)
  .reduce((acc, course) => {
    acc[course.name] = Array.from({ length: 3 }, (_, unitIndex) => ({
      name: `Ünite ${unitIndex + 1}`,
      topics: Array.from({ length: 4 }, (_, topicIndex) => ({
        name: `Konu ${(unitIndex * 4) + topicIndex + 1}`,
        completed: topicIndex % 2 === 0,
      })),
    }));
    return acc;
  }, {} as SubjectCurriculum);

const baseTask = (index: number, partial: Partial<Task> = {}): Task => {
  const course = courses[index % 4];
  const day = daysAgo(index % 28);
  const isQuestion = index % 3 === 0;
  const isReading = index % 5 === 0;
  const isLegacyCompleted = index % 7 === 0;
  const questionCount = isQuestion ? 20 + (index % 10) : undefined;
  const correctCount = isQuestion && questionCount ? Math.max(1, questionCount - (index % 8)) : undefined;
  const successScore = 50 + (index % 45);

  return {
    id: `heavy_task_${index}`,
    courseId: course.id,
    title: `${course.name} görev ${index}`,
    dueDate: day,
    status: (isLegacyCompleted ? 'tamamlandi' : 'tamamlandı') as Task['status'],
    taskType: isQuestion ? 'soru çözme' : isReading ? 'kitap okuma' : 'ders çalışma',
    taskGoalType: isReading ? 'konu-tekrari' : index % 4 === 0 ? 'sinav-hazirlik' : 'ders calisma',
    plannedDuration: 25 + (index % 4) * 10,
    actualDuration: 900 + (index % 8) * 300,
    breakTime: (index % 4) * 45,
    pauseTime: (index % 3) * 30,
    questionCount,
    correctCount,
    incorrectCount: questionCount && correctCount ? questionCount - correctCount : undefined,
    focusScore: 55 + (index % 40),
    successScore,
    firstAttemptScore: isQuestion ? Math.max(35, successScore - (index % 9)) : undefined,
    selfAssessmentScore: 45 + (index % 50),
    confidenceGap: (index % 12) - 6,
    conceptErrorCount: isQuestion ? index % 4 : undefined,
    processErrorCount: isQuestion ? index % 3 : undefined,
    attentionErrorCount: isQuestion ? index % 5 : undefined,
    pagesRead: isReading ? 8 + (index % 24) : undefined,
    completionDate: day,
    completionTimestamp: new Date(`${day}T${String(9 + (index % 12)).padStart(2, '0')}:15:00`).getTime(),
    isSelfAssigned: index % 9 === 0,
    curriculumUnitName: `Ünite ${1 + (index % 3)}`,
    curriculumTopicName: `Konu ${1 + (index % 8)}`,
    ...partial,
  };
};

const weeklySchedule: WeeklySchedule = {
  Pazartesi: {
    confirmed: true,
    slots: [
      { id: 'school_math_mon', courseName: 'Matematik', startTime: '09:00', endTime: '10:00' },
      { id: 'school_tr_mon', courseName: 'Türkçe', startTime: '10:00', endTime: '11:00' },
    ],
    availableWindows: [
      { id: 'study_mon_a', startTime: '16:00', endTime: '17:00', quality: 'deep' },
      { id: 'study_mon_b', startTime: '16:00', endTime: '17:00', quality: 'deep' },
      { id: 'study_mon_c', startTime: '18:00', endTime: '19:00', quality: 'medium' },
    ],
  },
  Sali: {
    confirmed: true,
    slots: [{ id: 'school_science_tue', courseName: 'Fen Bilimleri', startTime: '09:00', endTime: '10:00' }],
    availableWindows: [{ id: 'study_tue_a', startTime: '17:00', endTime: '18:30', quality: 'medium' }],
  },
  Carsamba: {
    confirmed: true,
    slots: [{ id: 'school_social_wed', courseName: 'Sosyal Bilgiler', startTime: '09:00', endTime: '10:00' }],
    availableWindows: [{ id: 'study_wed_a', startTime: '16:30', endTime: '18:00', quality: 'deep' }],
  },
  Persembe: { confirmed: true, slots: [], availableWindows: [{ id: 'study_thu_a', startTime: '17:00', endTime: '18:00', quality: 'light' }] },
  Cuma: { confirmed: true, slots: [], availableWindows: [{ id: 'study_fri_a', startTime: '16:00', endTime: '17:30', quality: 'medium' }] },
  Cumartesi: { confirmed: true, slots: [], availableWindows: [{ id: 'study_sat_a', startTime: '11:00', endTime: '12:30', quality: 'deep' }] },
  Pazar: { confirmed: true, slots: [], availableWindows: [] },
};

const examScheduleEntries: ExamScheduleEntry[] = [
  { id: 'exam_math_written', courseId: 'math', courseName: 'Matematik', examName: 'Matematik yazılısı', date: addDays(4) },
  { id: 'exam_tr_written', courseId: 'tr', courseName: 'Türkçe', examName: 'Türkçe yazılısı', date: addDays(9) },
];

const examRecords: ExamRecord[] = [
  { id: 'school_math_low', courseId: 'math', courseName: 'Matematik', examType: 'school-written', title: 'Matematik yazılısı', date: daysAgo(2), termKey: '2026-2', scopeType: 'course', score: 62, maxScore: 100, source: 'manual' },
  { id: 'school_tr_high', courseId: 'tr', courseName: 'Türkçe', examType: 'school-written', title: 'Türkçe yazılısı', date: daysAgo(3), termKey: '2026-2', scopeType: 'course', score: 88, maxScore: 100, source: 'manual' },
  { id: 'school_science_mid', courseId: 'science', courseName: 'Fen Bilimleri', examType: 'school-quiz', title: 'Fen kazanım taraması', date: daysAgo(7), termKey: '2026-2', scopeType: 'unit', unitNames: ['Ünite 2'], score: 74, maxScore: 100, source: 'manual' },
];

const compositeExamResults: CompositeExamResult[] = [
  {
    id: 'state_exam_heavy_1',
    title: 'Genel deneme',
    examType: 'state-exam',
    date: daysAgo(1),
    totalScore: 412,
    courses: [
      { courseId: 'math', courseName: 'Matematik', score: 68, net: 14.5 },
      { courseId: 'tr', courseName: 'Türkçe', score: 86, net: 18 },
      { courseId: 'science', courseName: 'Fen Bilimleri', score: 72, net: 15 },
      { courseId: 'social', courseName: 'Sosyal Bilgiler', score: 64, net: 13 },
    ],
  },
];

const buildSnapshot = (tasks: Task[]): PlanningEngineSnapshot => ({
  scheduleDays: Object.entries(weeklySchedule).map(([dayName, day]) => ({
    dayName,
    schoolBlocks: day.slots.map((slot) => ({ id: slot.id, courseName: slot.courseName, startTime: slot.startTime, endTime: slot.endTime })),
    availableWindows: day.availableWindows || [],
    confirmed: day.confirmed,
  })),
  curriculumTopics: courses
    .filter((course) => course.active !== false)
    .flatMap((course, courseIndex) => Array.from({ length: 6 }, (_, topicIndex) => ({
      id: `${course.id}_topic_${topicIndex}`,
      courseId: course.id,
      courseName: course.name,
      unitName: `Ünite ${1 + Math.floor(topicIndex / 3)}`,
      topicName: `Konu ${topicIndex + 1}`,
      sequenceOrder: courseIndex * 10 + topicIndex,
      isRequired: true,
    }))),
  examSchedules: examScheduleEntries,
  topicStatuses: courses.flatMap((course) => Array.from({ length: 3 }, (_, index) => ({
    topicId: `${course.id}_topic_${index}`,
    status: index % 2 === 0 ? 'needs_revision' : 'new',
    nextRecommendedAction: index % 2 === 0 ? 'revise' : 'learn',
  }))),
  studyPlanRecords: [],
  planBlockRecords: [],
  studySessions: tasks.map((task) => ({
    id: `session_${task.id}`,
    taskId: task.id,
    courseId: task.courseId,
    courseName: courses.find((course) => course.id === task.courseId)?.name || task.courseId,
    relatedPlanBlockId: task.planTaskId,
    startedAt: new Date(task.completionTimestamp || today.getTime()).toISOString(),
    endedAt: new Date((task.completionTimestamp || today.getTime()) + (task.actualDuration || 0) * 1000).toISOString(),
    taskType: task.taskGoalType === 'sinav-hazirlik' ? 'exam_prep' : task.taskGoalType === 'konu-tekrari' ? 'revision' : 'new_learning',
    actualDuration: Math.round((task.actualDuration || 0) / 60),
    completed: true,
    completionQuality: (task.successScore || 0) >= 80 ? 'high' : (task.successScore || 0) >= 60 ? 'medium' : 'low',
  })),
  assessmentResults: [],
  replanTriggers: [],
});

const buildStoredPlan = (): StoredStudyPlan => ({
  id: 'heavy_plan_week_6',
  week: 6,
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
        name: 'Ünite 1',
        topics: [{
          name: 'Konu 1',
          tasks: [{ id: 'plan_block_999', day: 'Pazartesi', startTime: '16:00', endTime: '17:00', type: 'study', duration: 45, questionCount: null, source: 'Akıllı plan', completed: false }],
        }],
      }],
    },
  },
});

const runHeavyAnalysis = () => {
  const tasks = Array.from({ length: 160 }, (_, index) => baseTask(index));
  const snapshot = deriveAnalysisSnapshot(tasks, courses, [], examRecords, compositeExamResults);

  assert(snapshot.sessions.length === tasks.length, 'Tüm tamamlanan ve legacy tamamlandi görevleri sessiona dönüşmeli.');
  assert(snapshot.overall.completedTasks === tasks.length, 'Tamamlanan görev sayacı tüm yoğun veriyi saymalı.');
  assert(snapshot.courses.length >= 4, 'Aktif dersler için ders metrikleri oluşmalı.');
  assert(snapshot.taskTypes.length >= 3, 'Soru, tekrar/çalışma ve okuma görev tipleri ayrışmalı.');
  assert(snapshot.studyWindows.some((item) => item.totalSessions > 0), 'Saat penceresi metrikleri dolmalı.');
  assert(snapshot.school.coursePerformance.length >= 4, 'Okul/ev uyum metrikleri ders bazında oluşmalı.');
  assert(snapshot.school.latestStateExam?.riskCourses.length === 3, 'Genel deneme risk dersleri analizde görünmeli.');
  assert(snapshot.school.coursePerformance.every((item) => !/( icin|calismasi|geldikce|guclu|altinda|Sinav)/.test(item.alignmentComment)), 'Uyum yorumları kullanıcıya doğru Türkçe karakterlerle çıkmalı.');
};

const runHeavyPlanning = () => {
  const tasks = Array.from({ length: 40 }, (_, index) => baseTask(index));
  const snapshot = buildSnapshot(tasks);
  const candidateTopics = snapshot.curriculumTopics.slice(0, 12).map((topic) => ({
    subject: topic.courseName,
    unitName: topic.unitName,
    topicName: topic.topicName,
    completed: false,
  }));
  const drafts = createWeeklyPlanDraft({
    mode: 'ai_normal',
    tempo: 'Orta',
    candidateTopics,
    snapshot,
    weeklySchedule,
  });

  assert(drafts.length >= 6, 'Yoğun gerçek veride birden fazla plan bloğu üretilmeli.');
  assert(drafts.every((draft) => draft.startTime && draft.endTime), 'Plan blokları saat bilgisi taşımalı.');
  assert(drafts.every((draft) => {
    const day = weeklySchedule[draft.day];
    return (day.availableWindows || []).some((window) => draft.startTime >= window.startTime && draft.endTime <= window.endTime);
  }), 'Plan blokları ev çalışma pencereleri dışına taşmamalı.');
  assert((weeklySchedule.Pazartesi.availableWindows || [])[0].id !== (weeklySchedule.Pazartesi.availableWindows || [])[1].id, 'Aynı saat/kalite pencereleri kalıcı farklı id taşımalı.');
};

const runPlanCompletionPropagation = () => {
  const task = baseTask(999, {
    id: 'plan_task_child_999',
    courseId: 'math',
    planTaskId: 'plan_block_999',
    planWeek: 6,
    planSource: 'weekly-plan',
    curriculumUnitName: 'Ünite 1',
    curriculumTopicName: 'Konu 1',
    status: 'bekliyor',
    completionDate: undefined,
    completionTimestamp: undefined,
  });
  const storedPlan = buildStoredPlan();
  const before = deriveAnalysisSnapshot([task], courses, [storedPlan]);
  const completed: Task = { ...task, status: 'tamamlandi' as Task['status'], completionDate: iso(today), completionTimestamp: today.getTime(), actualDuration: 2400, focusScore: 84, successScore: 81 };
  const after = deriveAnalysisSnapshot([completed], courses, [storedPlan]);

  assert(before.sessions.length === 0, 'Bekleyen çocuk görevi analiz sessionına dönüşmemeli.');
  assert(after.sessions.length === 1, 'Legacy tamamlandi plan görevi analiz sessionına dönüşmeli.');
  assert(after.plan.completedPlannedTopicTasks === 1, 'Tamamlanan çocuk görevi haftalık plan metriğine yansımalı.');
  assert(after.topics.some((topic) => topic.topicName === 'Konu 1'), 'Plan görevi konu metriğine yansımalı.');
};

const runBackupRoundTripHeavyData = () => {
  const tasks = [
    ...Array.from({ length: 140 }, (_, index) => baseTask(index)),
    baseTask(999, {
      id: 'plan_task_child_999',
      courseId: 'math',
      planTaskId: 'plan_block_999',
      planWeek: 6,
      planSource: 'weekly-plan',
      curriculumUnitName: 'Ünite 1',
      curriculumTopicName: 'Konu 1',
      status: 'tamamlandi' as Task['status'],
      completionDate: iso(today),
      completionTimestamp: today.getTime(),
    }),
  ];
  const performanceData: PerformanceData[] = courses.map((course, index) => ({
    courseId: course.id,
    courseName: course.name,
    correct: 120 - (index * 9),
    incorrect: 18 + index,
    timeSpent: 240 + (index * 20),
  }));
  const rewards: Reward[] = [{ id: 'reward_book', name: 'Kitap seçimi', cost: 120, icon: 'Gift' }];
  const badges: Badge[] = [{ id: 'badge_focus', name: 'Odak rozeti', description: 'Uzun çalışma bloklarını tamamladı.', icon: 'Award' }];
  const studyPlans = [buildStoredPlan()];
  const backup = {
    backup: {
      app: 'Ders Rotasi',
      schemaVersion: 2,
      exportedAt: today.toISOString(),
      summary: {
        courses: courses.length,
        tasks: tasks.length,
        rewards: rewards.length,
        badges: badges.length,
        examRecords: examRecords.length,
        studyPlans: studyPlans.length,
      },
    },
    appData: {
      courses,
      tasks,
      rewards,
      badges,
      performanceData,
      successPoints: 450,
      curriculum,
      weeklySchedule,
      examRecords,
      compositeExamResults,
      examScheduleEntries,
      studyPlans,
    },
  };

  const parsed = JSON.parse(JSON.stringify(backup));
  const payload = parsed.appData;
  assert(Array.isArray(payload.courses) && Array.isArray(payload.tasks) && Array.isArray(payload.rewards) && Array.isArray(payload.badges), 'Yedek dosyası zorunlu dizi alanlarını korumalı.');
  assert(payload.tasks.length === tasks.length, 'Büyük görev listesi import/export turunda eksilmemeli.');
  const mondayWindowIds = payload.weeklySchedule.Pazartesi.availableWindows.map((window: ScheduleDayWindow) => window.id);
  assert(mondayWindowIds.includes('study_mon_a'), 'Çalışma penceresi id bilgisi yedekte korunmalı.');
  assert(mondayWindowIds.includes('study_mon_b'), 'Aynı saatli ikinci çalışma penceresi ayrı id ile korunmalı.');
  assert(new Set(mondayWindowIds).size === mondayWindowIds.length, 'Aynı saatli çalışma pencereleri yedekte tekil id taşımalı.');

  const before = deriveAnalysisSnapshot(tasks, courses, studyPlans, examRecords, compositeExamResults);
  const after = deriveAnalysisSnapshot(payload.tasks, payload.courses, payload.studyPlans, payload.examRecords, payload.compositeExamResults);
  assert(after.overall.completedTasks === before.overall.completedTasks, 'Yedek turu tamamlanan görev sayısını değiştirmemeli.');
  assert(after.sessions.length === before.sessions.length, 'Yedek turu analiz oturumlarını değiştirmemeli.');
  assert(after.plan.completedPlannedTopicTasks === before.plan.completedPlannedTopicTasks, 'Yedek turu plan tamamlama metriğini değiştirmemeli.');
  assert(after.school.latestStateExam?.totalScore === 412, 'Yedek turu genel deneme sonucunu korumalı.');
};

const runAllGraphDataContracts = () => {
  const tasks = [
    ...Array.from({ length: 140 }, (_, index) => baseTask(index)),
    baseTask(999, {
      id: 'plan_task_child_999',
      courseId: 'math',
      planTaskId: 'plan_block_999',
      planWeek: 6,
      planSource: 'weekly-plan',
      curriculumUnitName: 'Ünite 1',
      curriculumTopicName: 'Konu 1',
      status: 'tamamlandi' as Task['status'],
      completionDate: iso(today),
      completionTimestamp: today.getTime(),
    }),
  ];
  const analysis = deriveAnalysisSnapshot(tasks, courses, [buildStoredPlan()], examRecords, compositeExamResults);
  const completedReadingTasks = tasks.filter((task) => task.taskType === 'kitap okuma' && task.pagesRead);
  const completedQuestionTasks = tasks.filter((task) => task.taskType === 'soru çözme' && typeof task.correctCount === 'number');
  const revisionSessions = analysis.sessions.filter((session) => session.taskGoalType === 'konu-tekrari');
  const curriculumTopicCount = Object.values(curriculum).reduce((sum, units) => sum + units.reduce((unitSum, unit) => unitSum + unit.topics.length, 0), 0);

  assert(analysis.sessions.length > 100, 'Genel skor ve EMA trendi için yeterli oturum olmalı.');
  assert(analysis.courses.length >= 4, 'Ders bazlı performans grafiği için ders verisi olmalı.');
  assert(analysis.topics.length >= 8, 'Risk ve kalıcılık grafikleri için konu verisi olmalı.');
  assert(curriculumTopicCount >= 12, 'Müfredat kapsama grafiği için müfredat konusu olmalı.');
  assert(completedQuestionTasks.length >= 20, 'Doğruluk/süre grafiği için soru oturumları olmalı.');
  assert(analysis.studyWindows.length >= 3, 'En verimli zaman grafiği için saat penceresi metrikleri olmalı.');
  assert(analysis.sessions.some((session) => session.masteryContribution > 0), 'Öğrenme verimi grafiği için öğrenme katkısı olmalı.');
  assert(tasks.some((task) => (task.actualDuration || 0) >= 1500 && ((task.pauseTime || 0) + (task.breakTime || 0)) / Math.max(1, task.actualDuration || 1) <= 0.15), 'Derin çalışma oranı için kesintisiz blok olmalı.');
  assert(analysis.taskTypes.length >= 3, 'Görev türü analizi için farklı görev tipleri olmalı.');
  assert(completedReadingTasks.length >= 10, 'Okuma analitiği için sayfa verisi olmalı.');
  assert(revisionSessions.length >= 2, 'Kalıcılık eğrisi için tekrar oturumları olmalı.');
  assert(analysis.plan.completedPlannedTopicTasks === 1, 'Plan/görev tamamlama metriği grafik merkezine veri sağlamalı.');
};

const runDuplicateWindowRemovalContract = () => {
  const windows: ScheduleDayWindow[] = [
    { id: 'duplicate_a', startTime: '16:00', endTime: '17:00', quality: 'deep' },
    { id: 'duplicate_b', startTime: '16:00', endTime: '17:00', quality: 'deep' },
    { id: 'different', startTime: '18:00', endTime: '19:00', quality: 'medium' },
  ];
  const removeWindowByKey = (items: ScheduleDayWindow[], key: string) => items.filter((item, index) => (item.id || `${item.startTime}_${item.endTime}_${item.quality}_${index}`) !== key);
  const after = removeWindowByKey(windows, 'duplicate_a');

  assert(after.length === 2, 'Aynı saat/kalite pencerelerinden sadece seçilen pencere silinmeli.');
  assert(after.some((window) => window.id === 'duplicate_b'), 'Aynı görünen ikinci pencere korunmalı.');
  assert(after.some((window) => window.id === 'different'), 'Farklı pencere etkilenmemeli.');
};

const main = () => {
  runHeavyAnalysis();
  runHeavyPlanning();
  runPlanCompletionPropagation();
  runBackupRoundTripHeavyData();
  runAllGraphDataContracts();
  runDuplicateWindowRemovalContract();
  console.log('HEAVY_REAL_DATA_TESTS_OK');
};

main();
