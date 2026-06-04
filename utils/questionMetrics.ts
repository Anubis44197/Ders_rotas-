import { Task } from '../types';

export interface QuestionMetricInput {
  taskType?: string;
  questionCount?: number;
  correctCount?: number;
  incorrectCount?: number;
  emptyCount?: number;
}

export interface QuestionMetrics {
  correctCount: number;
  incorrectCount: number;
  emptyCount: number;
  answeredCount: number;
  attemptedCount: number;
  totalQuestionCount: number;
  accuracyPercent: number | null;
  successPercent: number | null;
  accuracyNorm: number | undefined;
  successNorm: number | undefined;
}

const clampCount = (value: unknown): number => {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
};

const normalizeTaskType = (value: unknown): string => String(value || '')
  .toLocaleLowerCase('tr-TR')
  .replace(/Ã§/g, 'ç')
  .replace(/Ã¶/g, 'ö')
  .replace(/Ä±/g, 'ı')
  .replace(/ÅŸ/g, 'ş')
  .replace(/ÄŸ/g, 'ğ')
  .replace(/Ã¼/g, 'ü');

export const isQuestionTask = (task: Pick<Task, 'taskType'> | QuestionMetricInput): boolean => {
  const normalized = normalizeTaskType(task.taskType);
  return normalized === 'soru çözme' || normalized.includes('soru') || normalized.includes('deneme');
};

export const getQuestionMetrics = (input: QuestionMetricInput): QuestionMetrics => {
  const correctCount = clampCount(input.correctCount);
  const incorrectCount = clampCount(input.incorrectCount);
  const emptyCount = clampCount(input.emptyCount);
  const answeredCount = correctCount + incorrectCount;
  const attemptedCount = answeredCount + emptyCount;
  const totalQuestionCount = Math.max(clampCount(input.questionCount), attemptedCount);
  const accuracyNorm = answeredCount > 0 ? correctCount / answeredCount : undefined;
  const successNorm = totalQuestionCount > 0 ? correctCount / totalQuestionCount : undefined;

  return {
    correctCount,
    incorrectCount,
    emptyCount,
    answeredCount,
    attemptedCount,
    totalQuestionCount,
    accuracyPercent: typeof accuracyNorm === 'number' ? Math.round(accuracyNorm * 100) : null,
    successPercent: typeof successNorm === 'number' ? Math.round(successNorm * 100) : null,
    accuracyNorm,
    successNorm,
  };
};

export const getSolvedQuestionCount = (task: QuestionMetricInput): number => getQuestionMetrics(task).totalQuestionCount;

export const getAccuracyPercent = (task: QuestionMetricInput, fallback = 0): number => getQuestionMetrics(task).accuracyPercent ?? fallback;

export const getSuccessPercent = (task: QuestionMetricInput, fallback = 0): number => getQuestionMetrics(task).successPercent ?? fallback;