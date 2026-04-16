import { Task } from '../types';

export type TaskMetricProfile = 'question' | 'study' | 'revision' | 'reading';

export interface TaskScoreWeights {
  accuracy: number;
  efficiency: number;
  focus: number;
  completion: number;
  retention: number;
}

export interface GeneralScoreWeights {
  mastery: number;
  accuracy: number;
  efficiency: number;
  focus: number;
  retention: number;
  trend: number;
  discipline: number;
}

export interface MetricConfig {
  version: 'v1';
  taskScoreWeights: Record<TaskMetricProfile, TaskScoreWeights>;
  masteryWeights: Record<TaskMetricProfile, number>;
  generalScoreWeights: GeneralScoreWeights;
}

export const DEFAULT_METRIC_CONFIG: MetricConfig = {
  version: 'v1',
  taskScoreWeights: {
    question: {
      accuracy: 0.7,
      efficiency: 0.2,
      focus: 0.1,
      completion: 0,
      retention: 0,
    },
    study: {
      accuracy: 0,
      efficiency: 0.3,
      focus: 0.5,
      completion: 0.2,
      retention: 0,
    },
    revision: {
      accuracy: 0.6,
      efficiency: 0,
      focus: 0,
      completion: 0,
      retention: 0.4,
    },
    reading: {
      accuracy: 0,
      efficiency: 0.35,
      focus: 0.45,
      completion: 0.2,
      retention: 0,
    },
  },
  masteryWeights: {
    question: 1,
    study: 0.95,
    revision: 1.05,
    reading: 0.85,
  },
  generalScoreWeights: {
    mastery: 0.3,
    accuracy: 0.2,
    efficiency: 0.15,
    focus: 0.1,
    retention: 0.1,
    trend: 0.1,
    discipline: 0.05,
  },
};

export const getTaskMetricProfile = (task: Task): TaskMetricProfile => {
  if (task.taskType === 'soru çözme') return 'question';
  if (task.taskType === 'kitap okuma') return 'reading';
  if (task.taskGoalType === 'konu-tekrari') return 'revision';
  return 'study';
};
