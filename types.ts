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
  status: 'bekliyor' | 'tamamlandı';
  postponed?: boolean; // Görev daha sonra yapılmak üzere ertelendi mi?
  assignedTo?: string; // Görev uzaktan atandıysa, atanacak çocuk kullanıcı ID'si
  taskType: 'soru çözme' | 'ders çalışma' | 'kitap okuma';
  readingType?: 'ders' | 'serbest'; // For kitap okuma tasks only
  plannedDuration: number; // in minutes
  questionCount?: number;
  bookTitle?: string;
  bookGenre?: 'Hikaye' | 'Bilim' | 'Tarih' | 'Macera' | 'Şiir' | 'Diğer'; // For kitap okuma tasks only
  pagesRead?: number;
  actualDuration?: number; // in seconds
  breakTime?: number; // in seconds
  pauseTime?: number; // in seconds
  startTimestamp?: number; // Unix timestamp in ms
  completionDate?: string; // YYYY-MM-DD
  completionTimestamp?: number; // Unix timestamp in ms
  correctCount?: number;
  incorrectCount?: number;
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

export interface TimeSeriesData {
  date: string;
  performance: number; // e.g., average score
}

export interface ReportData {
  period: 'Haftalık' | 'Aylık' | 'Yıllık' | 'Tüm Zamanlar';
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
  rewards: Reward[];
  ai: GoogleGenAI;
  addCourse: (courseName: string) => void;
  deleteCourse: (courseId: string) => void;
  addTask: (task: Omit<Task, 'id' | 'status'>) => Promise<Task>;
  deleteTask: (taskId: string) => void;
  addReward: (reward: Omit<Reward, 'id'>) => void;
  deleteReward: (rewardId: string) => void;
  generateReport: (period: 'Haftalık' | 'Aylık' | 'Yıllık' | 'Tüm Zamanlar') => Promise<ReportData | null>;
  onExportData?: () => Promise<void>;
  onDeleteAllData: () => Promise<void>;
  onImportData: (file: File) => Promise<boolean>;
  timeFilter?: TimeFilterValue;
  loading?: boolean;
  error?: string | null;
}

export interface TaskCompletionData {
    actualDuration: number;
    breakTime: number;
    pauseTime: number;
    pagesRead?: number;
    correctCount?: number;
    incorrectCount?: number;
    emptyCount?: number;
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
  updateTaskStatus: (taskId: string, status: 'bekliyor' | 'tamamlandı') => void;
  completeTask: (taskId: string, data: TaskCompletionData) => void;
  claimReward: (rewardId: string) => void;
  addTask: (task: Omit<Task, 'id' | 'status'>) => Promise<Task>;
  ai: GoogleGenAI;
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