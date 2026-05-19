import { deriveAnalysisSnapshot } from '../utils/analysisEngine';
import { INITIAL_REAL_COURSES, INITIAL_REAL_CURRICULUM } from '../initialRealCurriculum';
import type { CompositeExamResult, Course, ExamRecord, StoredStudyPlan, Task } from '../types';

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const today = new Date('2026-05-17T12:00:00');
const iso = (date: Date) => date.toISOString().slice(0, 10);
const daysAgo = (count: number) => {
  const copy = new Date(today);
  copy.setDate(copy.getDate() - count);
  return iso(copy);
};

const activeCourses: Course[] = INITIAL_REAL_COURSES.filter((course) => course.active !== false);

type TopicRef = { course: Course; unitName: string; topicName: string };
const topicRefs: TopicRef[] = activeCourses.flatMap((course) => {
  const units = INITIAL_REAL_CURRICULUM[course.name] || [];
  return units.flatMap((unit) => unit.topics.map((topic) => ({
    course,
    unitName: unit.name,
    topicName: topic.name,
  })));
});

const createTask = (index: number, overrides: Partial<Task> = {}): Task => {
  const course = activeCourses[index % activeCourses.length];
  const topic = topicRefs[index % topicRefs.length];
  const dueDate = daysAgo(index % 30);
  const completionDate = daysAgo((index % 14) + 1);
  const questionCount = 10 + (index % 15);
  const correctCount = Math.max(0, Math.min(questionCount, Math.round(questionCount * (0.52 + ((index % 25) / 100)))));
  const incorrectCount = Math.max(0, questionCount - correctCount - (index % 4 === 0 ? 1 : 0));
  const emptyCount = Math.max(0, questionCount - correctCount - incorrectCount);
  return {
    id: `qa_matrix_task_${index}`,
    courseId: course.id,
    title: `${course.name} ${topic.topicName}`,
    dueDate,
    status: 'tamamlandı',
    taskType: index % 3 === 0 ? 'ders çalışma' : 'soru çözme',
    taskGoalType: index % 5 === 0 ? 'konu-tekrari' : 'test-cozme',
    plannedDuration: 30,
    actualDuration: 1500 + (index % 6) * 120,
    breakTime: (index % 4) * 45,
    pauseTime: (index % 3) * 30,
    questionCount,
    correctCount,
    incorrectCount,
    emptyCount,
    completionDate,
    completionTimestamp: new Date(`${completionDate}T1${index % 10}:00:00`).getTime(),
    curriculumUnitName: topic.unitName,
    curriculumTopicName: topic.topicName,
    ...overrides,
  };
};

const buildTasks = (count: number): Task[] => Array.from({ length: count }, (_, index) => createTask(index));

const buildExams = (): { examRecords: ExamRecord[]; compositeExamResults: CompositeExamResult[] } => {
  const examRecords: ExamRecord[] = activeCourses.map((course, index) => ({
    id: `qa_matrix_exam_${course.id}`,
    courseId: course.id,
    courseName: course.name,
    examType: 'school-written',
    title: `${course.name} yazılı`,
    date: daysAgo(7 + index),
    termKey: '2026-2',
    scopeType: 'course',
    score: 55 + ((index * 8) % 35),
    maxScore: 100,
    source: 'manual',
  }));

  const compositeExamResults: CompositeExamResult[] = [
    {
      id: 'qa_matrix_lgs_1',
      title: 'LGS deneme 1',
      examType: 'mock-exam',
      date: daysAgo(10),
      totalScore: 380,
      courses: activeCourses.map((course, index) => ({
        courseId: course.id,
        courseName: course.name,
        score: 52 + ((index * 9) % 33),
        net: 9 + index,
      })),
    },
    {
      id: 'qa_matrix_lgs_2',
      title: 'LGS deneme 2',
      examType: 'mock-exam',
      date: daysAgo(3),
      totalScore: 402,
      courses: activeCourses.map((course, index) => ({
        courseId: course.id,
        courseName: course.name,
        score: 57 + ((index * 8) % 34),
        net: 10 + index * 1.2,
      })),
    },
  ];

  return { examRecords, compositeExamResults };
};

const scenario = (name: string, run: () => void) => {
  run();
  console.log(`SCENARIO_OK: ${name}`);
};

scenario('AZ_VERI_LT3', () => {
  const snapshot = deriveAnalysisSnapshot(buildTasks(2), activeCourses, []);
  assert(snapshot.sessions.length === 2, 'Az veri senaryosunda session sayisi 2 olmali.');
  assert(snapshot.overall.generalScore >= 0 && snapshot.overall.generalScore <= 100, 'Genel skor 0-100 araliginda olmali.');
});

scenario('HEDEFSIZ_DENEMESIZ', () => {
  const snapshot = deriveAnalysisSnapshot(buildTasks(40), activeCourses, []);
  assert(snapshot.school.examRecords.length === 0, 'Sinav kaydi yokken listede kayit olmamali.');
  assert(snapshot.school.compositeExamResults.length === 0, 'Deneme yokken composite bos olmali.');
  assert(snapshot.courses.length > 0, 'Ders metrikleri uretilmeli.');
});

scenario('UZUN_DERS_KONU_ADI', () => {
  const longName = 'Cok uzun ders adi testi - veli ekraninda tasma olusmamalidir';
  const longTopic = 'Cok uzun konu adi: analiz ve rapor kartlarinda okunabilirlik korunmalidir';
  const customCourses: Course[] = [
    { id: 'long_1', name: longName, active: true, order: 0, icon: 'BookOpen' },
  ];
  const tasks: Task[] = Array.from({ length: 8 }, (_, index) => createTask(index, {
    id: `long_task_${index}`,
    courseId: 'long_1',
    curriculumUnitName: 'Uzun unite',
    curriculumTopicName: longTopic,
    title: `${longName} / ${longTopic}`,
  }));
  const snapshot = deriveAnalysisSnapshot(tasks, customCourses, []);
  assert(snapshot.topics.length > 0, 'Uzun adli konuda topic metriği uretilmeli.');
  assert(snapshot.topics[0].topicName.length >= longTopic.length, 'Konu adi trunc edilmeyip veri katmaninda korunmali.');
});

scenario('IKI_DENEME_TRENDI', () => {
  const { examRecords, compositeExamResults } = buildExams();
  const snapshot = deriveAnalysisSnapshot(buildTasks(80), activeCourses, [], examRecords, compositeExamResults);
  assert(snapshot.school.compositeExamResults.length >= 2, 'Iki deneme verisi snapshota gecmeli.');
  assert(snapshot.school.latestStateExam !== null, 'Son deneme ozeti uretilmeli.');
  assert(snapshot.school.coursePerformance.length > 0, 'Ders bazli okul uyumu uretilmeli.');
});

scenario('BUYUK_VERI_6000', () => {
  const { examRecords, compositeExamResults } = buildExams();
  const tasks = buildTasks(6000);
  const snapshot = deriveAnalysisSnapshot(tasks, activeCourses, [] as StoredStudyPlan[], examRecords, compositeExamResults);
  assert(snapshot.sessions.length === 6000, '6000 task -> 6000 session olmali.');
  assert(snapshot.overall.completedTasks === 6000, 'Toplam tamamlanan gorev 6000 olmali.');
  assert(snapshot.topics.length > 20, 'Konu havuzu buyuk veride anlamli sayida olusmali.');
});

scenario('SUPHELI_VERI_UC_DURUM', () => {
  const tasks: Task[] = [
    createTask(1, {
      id: 'suspicious_long_open',
      actualDuration: 3 * 60 * 60, // 3 saat
      breakTime: 0,
      pauseTime: 0,
      questionCount: 5,
      correctCount: 1,
      incorrectCount: 4,
    }),
    createTask(2, {
      id: 'suspicious_fast_answers',
      actualDuration: 10, // asiri kisa
      questionCount: 100,
      correctCount: 5,
      incorrectCount: 95,
    }),
    createTask(3, {
      id: 'missing_question_payload',
      questionCount: undefined,
      correctCount: undefined,
      incorrectCount: undefined,
    }),
  ];
  const snapshot = deriveAnalysisSnapshot(tasks, activeCourses, []);
  assert(snapshot.sessions.length === 3, 'Supheli/eksik veri durumunda session kaybi olmamali.');
  assert(Number.isFinite(snapshot.overall.generalScore), 'Genel skor NaN/Infinity olmamali.');
  assert(snapshot.overall.generalScore >= 0 && snapshot.overall.generalScore <= 100, 'Genel skor 0-100 araliginda kalmali.');
});

scenario('TEKRAR_CALISTIRMA_IDEMPOTENT_SONUC', () => {
  const tasks = buildTasks(120);
  const first = deriveAnalysisSnapshot(tasks, activeCourses, []);
  const second = deriveAnalysisSnapshot(tasks, activeCourses, []);
  assert(JSON.stringify(first) === JSON.stringify(second), 'Ayni girdide tekrarlayan hesaplama sonucu degismemeli.');
});

console.log('ANALYSIS_TEST_MATRIX_OK');
