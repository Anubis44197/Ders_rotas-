// Bildirim tipi
export interface Notification {
  id: string;
  type: string; // 'reward_request' | 'task_completed' | 'achievement' | 'reminder' | ...
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: Record<string, any>;
}
import React from 'react';
import { GoogleGenAI } from "@google/genai";

export enum UserType {
  Parent = 'parent',
  Child = 'child',
}

export interface Course {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }> | string; // String for Firebase compatibility
}

export interface Task {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  dueDate: string;
  status: 'bekliyor' | 'tamamland\u0131';
  planTaskId?: string;
  curriculumUnitName?: string;
  curriculumTopicName?: string;
  taskGoalType?: string;
  planWeek?: number;
  planSource?: 'manual' | 'weekly-plan' | 'ai-plan' | 'free-study';
  planLabel?: string;
  postponed?: boolean; // Gorev daha sonra tamamlanmak uzere ertelendi mi?
  assignedTo?: string; // Uzaktan atanmis gorevlerde hedef cocuk kullanici kimligi.
  taskType: 'soru \u00e7\u00f6zme' | 'ders \u00e7al\u0131\u015fma' | 'kitap okuma';
  readingType?: 'ders' | 'serbest'; // For kitap okuma tasks only
  plannedDuration: number; // in minutes
  questionCount?: number;
  selectedMetrics?: Array<'accuracy' | 'focus' | 'duration' | 'revision' | 'completion'>;
  metricTargetScore?: 100;
  targetAccuracy?: number; // Optional target correctness percentage
  targetFocus?: number; // Optional target focus percentage
  minimumDuration?: number; // Optional minimum expected duration in minutes
  bookTitle?: string;
  bookGenre?: 'Hikaye' | 'Bilim' | 'Tarih' | 'Macera' | '\u015eiir' | 'Di\u011fer'; // For kitap okuma tasks only
  pagesRead?: number;
  actualDuration?: number; // in seconds
  breakTime?: number; // in seconds
  pauseTime?: number; // in seconds
  startTimestamp?: number; // Unix timestamp in ms
  completionDate?: string; // YYYY-MM-DD
  completionTimestamp?: number; // Unix timestamp in ms
  correctCount?: number;
  incorrectCount?: number;
  emptyCount?: number;
  firstAttemptScore?: number;
  selfAssessmentScore?: number;
  confidenceGap?: number;
  conceptErrorCount?: number;
  processErrorCount?: number;
  attentionErrorCount?: number;
  successScore?: number; // 0-100 score based on correctness and time
  focusScore?: number; // 0-100 score based on breaks, pauses, and overtime
  pointsAwarded?: number;
  isSelfAssigned?: boolean;
  createdAt?: string; // ISO string for Firebase compatibility
}

export interface PerformanceData {
  courseId: string;
  courseName: string;
  correct: number;
  incorrect: number;
  timeSpent: number; // in minutes
}

export type ExamType =
  | 'school-written'
  | 'school-quiz'
  | 'school-oral'
  | 'mock-exam'
  | 'state-exam'
  | 'report-card';

export interface ExamRecord {
  id: string;
  courseId: string;
  courseName: string;
  examType: ExamType;
  title: string;
  date: string;
  termKey: string;
  scopeType: 'topic' | 'unit' | 'course' | 'multi-course';
  unitNames?: string[];
  topicNames?: string[];
  score: number;
  weight?: number;
  maxScore?: number;
  notes?: string;
  source: 'manual' | 'import';
}

export interface CompositeExamResult {
  id: string;
  title: string;
  examType: 'state-exam' | 'mock-exam';
  date: string;
  courses: Array<{
    courseId: string;
    courseName: string;
    score: number;
    net?: number;
  }>;
  totalScore?: number;
  notes?: string;
}

export interface PeriodCoursePerformance {
  courseId: string;
  courseName: string;
  periodKey: string;
  studyScore: number;
  schoolScore: number | null;
  predictedSchoolScore: number | null;
  alignmentGap: number | null;
  alignmentStatus: 'uyumlu' | 'sapma-var' | 'kritik-sapma' | 'veri-yetersiz';
  trend: 'up' | 'down' | 'flat';
  riskLevel: 'dusuk' | 'orta' | 'yuksek';
}

export interface TimeSeriesData {
  date: string;
  performance: number; // e.g., average score
}

export interface ReportData {
  period: 'Haftal\u0131k' | 'Ayl\u0131k' | 'Y\u0131ll\u0131k' | 'T\u00fcm Zamanlar';
  aiSummary: string;
  highlights: {
    mostImproved: string;
    needsFocus: string;
  };
  aiSuggestion: string;
}

export interface DailyBriefingData {
    summary: string;
    suggestion: string;
}

export interface Reward {
    id: string;
    name: string;
    cost: number;
    icon: React.ComponentType<{ className?: string }> | string;
}

export interface Badge {
    id: string;
    name: string;
    description: string;
    icon: React.ComponentType<{ className?: string }> | string;
}

// Props for ParentDashboard
export interface ParentDashboardProps {
  courses: Course[];
  tasks: Task[];
  performanceData: PerformanceData[];
  examRecords?: ExamRecord[];
  compositeExamResults?: CompositeExamResult[];
  rewards: Reward[];
  successPoints: number;
  studyPlans?: StoredStudyPlan[];
  curriculum?: SubjectCurriculum;
  ai: GoogleGenAI | null;
  addCourse: (courseName: string) => void;
  deleteCourse: (courseId: string) => void;
  addTask: (task: Omit<Task, 'id' | 'status'>) => Promise<Task>;
  deleteTask: (taskId: string) => void;
  updateTaskFromPlan?: (planTaskId: string, updates: Partial<Pick<Task, 'plannedDuration' | 'questionCount'>>) => void;
  addReward: (reward: Omit<Reward, 'id'>) => void;
  deleteReward: (rewardId: string) => void;
  generateReport: (period: 'Haftal\u0131k' | 'Ayl\u0131k' | 'Y\u0131ll\u0131k' | 'T\u00fcm Zamanlar') => Promise<ReportData | null>;
  onExportData?: () => Promise<void>;
  onDeleteAllData: () => Promise<void>;
  onImportData: (file: File) => Promise<boolean>;
  onChangeExamRecords?: React.Dispatch<React.SetStateAction<ExamRecord[]>>;
  onChangeCompositeExamResults?: React.Dispatch<React.SetStateAction<CompositeExamResult[]>>;
  timeFilter?: TimeFilterValue;
  loading?: boolean;
  error?: string | null;
  viewMode?: 'all' | 'tasks' | 'analysis';
}

export interface TaskCompletionData {
    actualDuration: number;
    breakTime: number;
    pauseTime: number;
  selfAssessmentScore?: number;
    pagesRead?: number;
    correctCount?: number;
    incorrectCount?: number;
    emptyCount?: number;
  conceptErrorCount?: number;
  processErrorCount?: number;
  attentionErrorCount?: number;
}

// Props for ChildDashboard
export interface ChildDashboardProps {
  courses: Course[];
  tasks: Task[];
  performanceData: PerformanceData[];
  rewards: Reward[];
  badges: Badge[];
  successPoints: number;
  startTask: (taskId: string) => void;
  updateTaskStatus: (taskId: string, status: 'bekliyor' | 'tamamland\u0131') => void;
  completeTask: (taskId: string, data: TaskCompletionData) => void;
  claimReward: (rewardId: string) => void;
  addTask: (task: Omit<Task, 'id' | 'status'>) => Promise<Task>;
  curriculum: SubjectCurriculum;
  ai: GoogleGenAI | null;
}

export interface ParentLockScreenProps {
  onUnlock: (password: string) => void;
  error: string | null;
}

export type ChildView = 'tasks' | 'treasures' | 'stats' | 'assistant';
export type TaskFilter = 'today' | 'upcoming' | 'all';

export interface TimeFilterValue {
  period: 'day' | 'week' | 'month' | 'year' | 'all';
  startDate?: string;
  endDate?: string;
}
export type PlanTempo = 'Hafif' | 'Orta' | 'Yogun';

export interface CurriculumTopic {
  name: string;
  completed: boolean;
}

export interface CurriculumUnit {
  name: string;
  topics: CurriculumTopic[];
}

export interface SubjectCurriculum {
  [subject: string]: CurriculumUnit[];
}

export interface WeeklyScheduleSlot {
  id: string;
  courseName: string;
  startTime: string;
  endTime: string;
  note?: string;
}

export interface WeeklyScheduleDay {
  slots: WeeklyScheduleSlot[];
  confirmed: boolean;
}

export interface WeeklySchedule {
  [day: string]: WeeklyScheduleDay;
}

export interface ExamScheduleEntry {
  id: string;
  courseId: string;
  courseName: string;
  examName: string;
  date: string;
  note?: string;
}

export interface SubjectPlanTask {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  type: string;
  duration: number | null;
  questionCount: number | null;
  source: string;
  completed: boolean;
}

export interface TopicPlan {
  name: string;
  tasks: SubjectPlanTask[];
}

export interface UnitPlan {
  name: string;
  topics: TopicPlan[];
}

export interface SubjectPlan {
  units: UnitPlan[];
}

export interface StudyPlan {
  [subject: string]: SubjectPlan;
}

export interface StoredStudyPlan {
  id?: string;
  week: number;
  version?: number;
  status?: 'draft' | 'pending-approval' | 'active' | 'archived';
  reason?: 'initial-plan' | 'performance-drop' | 'revision-needed' | 'exam-pressure' | 'schedule-change' | 'manual-parent-update';
  generatedAt?: string;
  approvedAt?: string;
  approvedBy?: 'parent' | 'system';
  parentPlanId?: string;
  plan: StudyPlan;
  schedule: WeeklySchedule;
  type: 'normal' | 'revision';
}

export type ScheduleWindowQuality = 'light' | 'medium' | 'deep';

export interface ScheduleDayWindow {
  startTime: string;
  endTime: string;
  quality: ScheduleWindowQuality;
}

export interface ScheduleLessonBlockRecord {
  id: string;
  courseId?: string;
  courseName: string;
  startTime: string;
  endTime: string;
  note?: string;
}

export interface ScheduleDayRecord {
  dayName: string;
  schoolBlocks: ScheduleLessonBlockRecord[];
  availableWindows: ScheduleDayWindow[];
  confirmed: boolean;
}

export interface CurriculumTopicRecord {
  id: string;
  courseId: string;
  courseName: string;
  unitName: string;
  topicName: string;
  sequenceOrder: number;
  isRequired: boolean;
}

export type TopicStatusValue = 'new' | 'in_progress' | 'needs_revision' | 'risky' | 'stable';

export interface TopicStatusRecord {
  topicId: string;
  status: TopicStatusValue;
  lastStudiedAt?: string;
  lastAssessmentScore?: number;
  rollingAverageScore?: number;
  consecutiveRevisionCount?: number;
  nextRecommendedAction?: 'learn' | 'revise' | 'practice' | 'assess';
}

export type StudyPlanRecordStatus = 'draft' | 'pending-approval' | 'active' | 'archived';

export type StudyPlanReason =
  | 'initial-plan'
  | 'performance-drop'
  | 'revision-needed'
  | 'exam-pressure'
  | 'schedule-change'
  | 'manual-parent-update';

export interface StudyPlanRecord {
  id: string;
  weekKey: string;
  version: number;
  status: StudyPlanRecordStatus;
  reason: StudyPlanReason;
  generatedAt: string;
  approvedAt?: string;
  approvedBy?: 'parent' | 'system';
}

export type PlanBlockType =
  | 'new_learning'
  | 'revision'
  | 'question_practice'
  | 'assessment'
  | 'light_review'
  | 'compensation'
  | 'exam_prep';

export interface PlanBlockRecord {
  id: string;
  studyPlanId: string;
  dayName: string;
  startTime: string;
  endTime: string;
  courseId: string;
  courseName: string;
  topicId?: string;
  topicName?: string;
  blockType: PlanBlockType;
  priorityScore: number;
  required: boolean;
  assignmentMode: 'assigned' | 'recommended';
  sourceReason: 'curriculum-flow' | 'revision-trigger' | 'exam-trigger' | 'manual-parent' | 'compensation';
}

export interface StudySessionRecord {
  id: string;
  relatedPlanBlockId?: string;
  startedAt: string;
  endedAt?: string;
  courseId: string;
  topicId?: string;
  taskType: PlanBlockType;
  actualDuration: number;
  completed: boolean;
  completionQuality?: 'low' | 'medium' | 'high';
}

export interface AssessmentResultRecord {
  id: string;
  courseId: string;
  topicId?: string;
  date: string;
  score: number;
  source: 'question-practice' | 'mini-quiz' | 'mock-exam' | 'school-exam';
  questionCount?: number;
  correctCount?: number;
  incorrectCount?: number;
}

export type ReplanTriggerType = 'low-performance' | 'revision-delay' | 'mid-week-warning' | 'exam-pressure' | 'plan-break' | 'schedule-change';

export interface ReplanTriggerRecord {
  id: string;
  type: ReplanTriggerType;
  createdAt: string;
  severity: 'low' | 'medium' | 'high';
  relatedCourseId?: string;
  relatedTopicId?: string;
  reasonText: string;
}

export interface PlanningEngineSnapshot {
  scheduleDays: ScheduleDayRecord[];
  curriculumTopics: CurriculumTopicRecord[];
  examSchedules: ExamScheduleEntry[];
  topicStatuses: TopicStatusRecord[];
  studyPlanRecords: StudyPlanRecord[];
  planBlockRecords: PlanBlockRecord[];
  studySessions: StudySessionRecord[];
  assessmentResults: AssessmentResultRecord[];
  replanTriggers: ReplanTriggerRecord[];
}


