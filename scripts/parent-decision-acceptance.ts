import { deriveAnalysisSnapshot } from '../utils/analysisEngine';
import { buildParentDecision, getTopicDecisionLevel } from '../utils/parentDecisionEngine';
import { INITIAL_REAL_COURSES, INITIAL_REAL_CURRICULUM } from '../initialRealCurriculum';
import type { CompositeExamResult, Course, ExamRecord, Task } from '../types';

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const now = new Date('2026-05-17T12:00:00');
const iso = (date: Date) => date.toISOString().slice(0, 10);
const daysAgo = (count: number) => {
  const copy = new Date(now);
  copy.setDate(copy.getDate() - count);
  return iso(copy);
};

const activeCourses: Course[] = INITIAL_REAL_COURSES.filter((course) => course.active !== false);
type TopicRef = { course: Course; unitName: string; topicName: string };
const topics: TopicRef[] = activeCourses.flatMap((course) =>
  (INITIAL_REAL_CURRICULUM[course.name] || []).flatMap((unit) =>
    unit.topics.map((topic) => ({ course, unitName: unit.name, topicName: topic.name })),
  ),
);
const topicsByCourse = new Map<string, TopicRef[]>();
topics.forEach((topic) => {
  const bucket = topicsByCourse.get(topic.course.id) || [];
  bucket.push(topic);
  topicsByCourse.set(topic.course.id, bucket);
});

const createTask = (index: number): Task => {
  const course = activeCourses[index % activeCourses.length];
  const topicPool = topicsByCourse.get(course.id) || topics;
  const topic = topicPool[index % topicPool.length];
  const questionCount = 10 + (index % 20);
  const correctCount = Math.round(questionCount * (0.55 + ((index % 25) / 100)));
  const incorrectCount = Math.max(0, questionCount - correctCount - (index % 3 === 0 ? 1 : 0));
  const emptyCount = Math.max(0, questionCount - correctCount - incorrectCount);

  return {
    id: `acceptance_task_${index}`,
    title: `${course.name} / ${topic.topicName}`,
    courseId: course.id,
    dueDate: daysAgo(index % 40),
    status: 'tamamlandı',
    taskType: index % 4 === 0 ? 'ders çalışma' : 'soru çözme',
    taskGoalType: index % 5 === 0 ? 'konu-tekrari' : 'test-cozme',
    plannedDuration: 30,
    actualDuration: 1200 + (index % 6) * 180,
    breakTime: (index % 3) * 45,
    pauseTime: (index % 4) * 30,
    questionCount,
    correctCount,
    incorrectCount,
    emptyCount,
    completionDate: daysAgo(index % 40),
    completionTimestamp: new Date(`${daysAgo(index % 40)}T1${index % 10}:00:00`).getTime(),
    curriculumUnitName: topic.unitName,
    curriculumTopicName: topic.topicName,
  };
};

const tasks: Task[] = Array.from({ length: 6000 }, (_, index) => createTask(index));
const examRecords: ExamRecord[] = activeCourses.map((course, index) => ({
  id: `accept_exam_${course.id}`,
  courseId: course.id,
  courseName: course.name,
  examType: 'school-written',
  title: `${course.name} yazili`,
  date: daysAgo(7 + index),
  termKey: '2026-2',
  scopeType: 'course',
  score: 60 + ((index * 7) % 30),
  maxScore: 100,
  source: 'manual',
}));

const compositeExamResults: CompositeExamResult[] = [
  {
    id: 'accept_mock_1',
    title: 'LGS deneme 1',
    examType: 'mock-exam',
    date: daysAgo(12),
    courses: activeCourses.map((course, index) => ({
      courseId: course.id,
      courseName: course.name,
      score: 54 + ((index * 7) % 28),
      net: 8 + index,
    })),
    totalScore: 380,
  },
  {
    id: 'accept_mock_2',
    title: 'LGS deneme 2',
    examType: 'mock-exam',
    date: daysAgo(3),
    courses: activeCourses.map((course, index) => ({
      courseId: course.id,
      courseName: course.name,
      score: 57 + ((index * 8) % 30),
      net: 9 + index,
    })),
    totalScore: 402,
  },
];

const snapshot = deriveAnalysisSnapshot(tasks, activeCourses, [], examRecords, compositeExamResults);

assert(snapshot.sessions.length === 6000, '6000 task -> 6000 session olmali');
assert(snapshot.courses.length === activeCourses.length, 'Tum dersler analizde olmali');
assert(snapshot.topics.length > 100, 'Konu seti anlamli buyuklukte olmali');
assert(snapshot.overall.generalScore >= 0 && snapshot.overall.generalScore <= 100, 'Genel skor 0-100 olmali');

const latestCompositeAverage =
  compositeExamResults[0]
    ? Math.round(compositeExamResults[0].courses.reduce((sum, course) => sum + course.score, 0) / compositeExamResults[0].courses.length)
    : null;
const previousCompositeAverage =
  compositeExamResults[1]
    ? Math.round(compositeExamResults[1].courses.reduce((sum, course) => sum + course.score, 0) / compositeExamResults[1].courses.length)
    : null;

const decision = buildParentDecision({
  sessionsCount: snapshot.sessions.length,
  weeklyCompletedCount: snapshot.sessions.filter((session) => {
    const sessionDate = new Date(`${session.completionDate}T00:00:00`).getTime();
    const startDate = new Date(`${daysAgo(7)}T00:00:00`).getTime();
    return sessionDate >= startDate;
  }).length,
  weakTopicCount: snapshot.topics.filter((topic) => topic.needsRevision).length,
  averageRisk: snapshot.overall.averageRisk,
  latestCompositeAverage,
  previousCompositeAverage,
  parentActionPendingCount: 2,
  parentActionCompletedCount: 5,
  parentActionCompletedTodayCount: 1,
});

assert(decision.topAlert.level === 'Stabil' || decision.topAlert.level === 'Takip et' || decision.topAlert.level === 'Dikkat' || decision.topAlert.level === 'Kritik', 'Top alert seviyesi gecersiz');
assert(decision.alerts.length > 0, 'En az bir karar sinyali beklenir');
assert(decision.diagnostics.rulesVersion.length > 0, 'Rules version bos olmamali');

const topicLevel = getTopicDecisionLevel(snapshot.topics[0]?.riskScore ?? 0);
assert(['Kritik', 'Dikkat', 'Takip et', 'Stabil'].includes(topicLevel), 'Konu karar seviyesi gecersiz');

console.log(JSON.stringify({
  status: 'PARENT_DECISION_ACCEPTANCE_OK',
  totalTasks: tasks.length,
  sessions: snapshot.sessions.length,
  courses: snapshot.courses.length,
  topics: snapshot.topics.length,
  overallScore: snapshot.overall.generalScore,
  risk: snapshot.overall.averageRisk,
  decisionTopLevel: decision.topAlert.level,
  decisionTrend: decision.trend,
  rulesVersion: decision.diagnostics.rulesVersion,
  thresholdVersion: decision.diagnostics.thresholdVersion,
}, null, 2));
