import { ExamType, Task } from '../../types';
import { isCompletedTask } from '../../utils/taskStatus';

export const taskGoalLabelMap: Record<string, string> = {
  'test-cozme': 'Test çözme',
  'olcme-degerlendirme': 'Olcme degerlendirme',
  'sinav-hazirlik': 'Sınav hazırlığı',
  'konu-tekrari': 'Konu tekrari',
  'eksik-konu-tamamlama': 'Eksik konu tamamlama',
  'ders calisma': 'Ders çalışması',
  'ders çalışma': 'Ders çalışması',
};

export const planSourceLabelMap: Record<string, string> = {
  manual: 'Elle atandi',
  'weekly-plan': 'Haftalık plan',
  'ai-plan': 'Akilli plan',
  'free-study': 'Serbest çalışma',
};

export const examTypeLabelMap: Record<ExamType, string> = {
  'school-written': 'Yazili',
  'school-quiz': 'Kısa sınav',
  'school-oral': 'Sozlu',
  'mock-exam': 'Deneme',
  'state-exam': 'Genel sınav',
  'report-card': 'Karne',
};

export const alignmentToneMap = {
  uyumlu: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'sapma-var': 'border-amber-200 bg-amber-50 text-amber-700',
  'kritik-sapma': 'border-rose-200 bg-rose-50 text-rose-700',
  'veri-yetersiz': 'border-slate-200 bg-slate-50 text-slate-600',
} as const;

export const alignmentLabelMap = {
  uyumlu: 'Uyumlu',
  'sapma-var': 'Sapma var',
  'kritik-sapma': 'Kritik sapma',
  'veri-yetersiz': 'Veri yetersiz',
} as const;

export const buildLocalId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

export const formatTaskGoal = (value?: string) => value ? (taskGoalLabelMap[value] || value) : '';
export const formatPlanSource = (value?: string, label?: string) => label || (value ? (planSourceLabelMap[value] || value) : 'Elle atandi');

export const getTaskDateKey = (value?: string) => {
  if (typeof value !== 'string' || !value) return '';
  return value.split('T')[0];
};

export const getParentTaskPriority = (task: Task, today: string) => {
  const dueDate = getTaskDateKey(task.dueDate);
  if (isCompletedTask(task)) return 5;
  if (dueDate < today) return 0;
  if (dueDate === today && !task.isSelfAssigned) return 1;
  if (dueDate === today) return 2;
  if (!task.isSelfAssigned) return 3;
  return 4;
};

export const normalizeForLookup = (value: string) =>
  value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, ' ')
    .trim();

export type TaskTypeKey = 'question' | 'study' | 'revision';
export type TaskWorkspaceTab = 'assignment' | 'list' | 'exams' | 'data';

export const resolveTaskTypeKey = (value: string): TaskTypeKey => {
  if (value === 'question') return 'question';
  if (value === 'revision') return 'revision';
  return 'study';
};

export const taskTypeKeyToTaskType = (value: TaskTypeKey): 'soru çözme' | 'ders çalışma' => (value === 'question' ? 'soru çözme' : 'ders çalışma');

export const ASSIGNMENT_METRIC_OPTIONS = [
  { key: 'accuracy', label: 'Doğruluk', hint: 'Doğru cevap oranını takip eder.' },
  { key: 'focus', label: 'Odak', hint: 'Dikkat dagilmasini ve molayi takip eder.' },
  { key: 'duration', label: 'Süreye uyum', hint: 'Planlanan süreye uyumu takip eder.' },
  { key: 'revision', label: 'Ders tekrarı', hint: 'Tekrar görevlerinin devamını takip eder.' },
  { key: 'completion', label: 'Tamamlama', hint: 'Görevleri zamanında bitirme durumunu takip eder.' },
] as const;

export type AssignmentMetricKey = (typeof ASSIGNMENT_METRIC_OPTIONS)[number]['key'];

export const ASSIGNMENT_METRICS_BY_TASK_TYPE: Record<TaskTypeKey, AssignmentMetricKey[]> = {
  question: ['accuracy', 'focus', 'duration', 'completion'],
  study: ['focus', 'duration', 'revision', 'completion'],
  revision: ['revision', 'focus', 'duration', 'completion'],
};

export const assignmentMetricLabelMap: Record<AssignmentMetricKey, string> = ASSIGNMENT_METRIC_OPTIONS.reduce((acc, option) => {
  acc[option.key] = option.label;
  return acc;
}, {} as Record<AssignmentMetricKey, string>);

export const legacyMetricMap: Array<{ field: 'targetAccuracy' | 'targetFocus' | 'minimumDuration'; key: AssignmentMetricKey }> = [
  { field: 'targetAccuracy', key: 'accuracy' },
  { field: 'targetFocus', key: 'focus' },
  { field: 'minimumDuration', key: 'duration' },
];

export const taskWorkspaceTabs: Array<{ id: TaskWorkspaceTab; label: string; description: string }> = [
  { id: 'assignment', label: 'Görev Ata', description: 'Yeni görev oluştur' },
  { id: 'list', label: 'Görevler', description: 'Bekleyen ve tamamlananlar' },
  { id: 'exams', label: 'Sınav Merkezi', description: 'Ders ve genel sınav girişi' },
  { id: 'data', label: 'Veri', description: 'Ice aktar / disa aktar' },
];
