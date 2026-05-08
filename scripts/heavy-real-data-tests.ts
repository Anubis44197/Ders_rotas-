import { deriveAnalysisSnapshot } from '../utils/analysisEngine';
import { createWeeklyPlanDraft } from '../utils/planEngine';
import type { Course, ExamRecord, ExamScheduleEntry, PlanningEngineSnapshot, StoredStudyPlan, StudyPlan, Task, WeeklySchedule } from '../types';

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

const baseTask = (index: number, partial: Partial<Task> = {}): Task => {
  const course = courses[index % 4];
  const day = daysAgo(index % 21);
  const isQuestion = index % 3 === 0;
  const isLegacyCompleted = index % 7 === 0;
  const questionCount = isQuestion ? 20 + (index % 10) : undefined;
  const correctCount = isQuestion && questionCount ? Math.max(1, questionCount - (index % 8)) : undefined;

  return {
    id: `heavy_task_${index}`,
    courseId: course.id,
    title: `${course.name} görev ${index}`,
    dueDate: day,
    status: (isLegacyCompleted ? 'tamamlandi' : 'tamamlandı') as Task['status'],
    taskType: isQuestion ? 'soru çözme' : index % 5 === 0 ? 'kitap okuma' : 'ders çalışma',
    taskGoalType: index % 5 === 0 ? 'konu-tekrari' : index % 4 === 0 ? 'sinav-hazirlik' : 'ders calisma',
    plannedDuration: 25 + (index % 4) * 10,
    actualDuration: 900 + (index % 8) * 300,
    breakTime: (index % 4) * 60,
    pauseTime: (index % 3) * 45,
    questionCount,
    correctCount,
    incorrectCount: questionCount && correctCount ? questionCount - correctCount : undefined,
    focusScore: 55 + (index % 40),
    successScore: 50 + (index % 45),
    completionDate: day,
    completionTimestamp: new Date(`${day}T${String(9 + (index % 10)).padStart(2, '0')}:15:00`).getTime(),
    isSelfAssigned: index % 9 === 0,
    curriculumUnitName: `Ünite ${1 + (index % 3)}`,
    curriculumTopicName: `Konu ${1 + (index % 6)}`,
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

const runHeavyAnalysis = () => {
  const tasks = Array.from({ length: 160 }, (_, index) => baseTask(index));
  const exams: ExamRecord[] = [
    { id: 'school_math_low', courseId: 'math', courseName: 'Matematik', examType: 'school-written', title: 'Matematik yazılısı', date: daysAgo(2), termKey: '2026-2', scopeType: 'course', score: 62, maxScore: 100, source: 'manual' },
    { id: 'school_tr_high', courseId: 'tr', courseName: 'Türkçe', examType: 'school-written', title: 'Türkçe yazılısı', date: daysAgo(3), termKey: '2026-2', scopeType: 'course', score: 88, maxScore: 100, source: 'manual' },
  ];
  const snapshot = deriveAnalysisSnapshot(tasks, courses, [], exams, []);

  assert(snapshot.sessions.length === tasks.length, 'Tüm tamamlanan ve legacy tamamlandi görevleri sessiona dönüşmeli.');
  assert(snapshot.overall.completedTasks === tasks.length, 'Tamamlanan görev sayacı tüm yoğun veriyi saymalı.');
  assert(snapshot.courses.length >= 4, 'Aktif dersler için ders metrikleri oluşmalı.');
  assert(snapshot.taskTypes.length >= 3, 'Soru, tekrar/çalışma ve okuma görev tipleri ayrışmalı.');
  assert(snapshot.studyWindows.some((item) => item.totalSessions > 0), 'Saat penceresi metrikleri dolmalı.');
  assert(snapshot.school.coursePerformance.length >= 4, 'Okul/ev uyum metrikleri ders bazında oluşmalı.');
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
  const studyPlan: StudyPlan = {
    Matematik: {
      units: [{
        name: 'Ünite 1',
        topics: [{
          name: 'Konu 1',
          tasks: [{ id: 'plan_block_999', day: 'Pazartesi', startTime: '16:00', endTime: '17:00', type: 'study', duration: 45, questionCount: null, source: 'Akıllı plan', completed: false }],
        }],
      }],
    },
  };
  const storedPlan: StoredStudyPlan = {
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
    plan: studyPlan,
  };
  const before = deriveAnalysisSnapshot([task], courses, [storedPlan]);
  const completed: Task = { ...task, status: 'tamamlandi' as Task['status'], completionDate: iso(today), completionTimestamp: today.getTime(), actualDuration: 2400, focusScore: 84, successScore: 81 };
  const after = deriveAnalysisSnapshot([completed], courses, [storedPlan]);

  assert(before.sessions.length === 0, 'Bekleyen çocuk görevi analiz sessionına dönüşmemeli.');
  assert(after.sessions.length === 1, 'Legacy tamamlandi plan görevi analiz sessionına dönüşmeli.');
  assert(after.plan.completedPlannedTopicTasks === 1, 'Tamamlanan çocuk görevi haftalık plan metriğine yansımalı.');
  assert(after.topics.some((topic) => topic.topicName === 'Konu 1'), 'Plan görevi konu metriğine yansımalı.');
};

const main = () => {
  runHeavyAnalysis();
  runHeavyPlanning();
  runPlanCompletionPropagation();
  console.log('HEAVY_REAL_DATA_TESTS_OK');
};

main();
