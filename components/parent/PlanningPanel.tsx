import React, { useEffect, useMemo, useState } from 'react';
import type { Course, ExamScheduleEntry, PlanBlockRecord, PlanningEngineSnapshot, StoredStudyPlan, StudyPlan, SubjectCurriculum, SubjectPlanTask, Task, WeeklySchedule } from '../../types';
import { AlertTriangle, Calendar, PlusCircle, Sparkles, X } from '../icons';
import { createWeeklyPlanDraft } from '../../utils/planEngine';
import { isCompletedTask } from '../../utils/taskStatus';

interface PlanningPanelProps {
  curriculum: SubjectCurriculum;
  weeklySchedule: WeeklySchedule;
  planningEngineSnapshot: PlanningEngineSnapshot;
  examScheduleEntries: ExamScheduleEntry[];
  studyPlans: StoredStudyPlan[];
  courses: Course[];
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'status'>) => Promise<Task>;
  deleteTask: (taskId: string) => void;
  updateTaskStatus: (taskId: string, status: 'bekliyor' | 'tamamland\u0131') => void;
  updateTaskFromPlan: (planTaskId: string, updates: Partial<Pick<Task, 'plannedDuration' | 'questionCount' | 'planLabel'>>) => void;
  onChangePlans: React.Dispatch<React.SetStateAction<StoredStudyPlan[]>>;
  onChangeExamSchedules: React.Dispatch<React.SetStateAction<ExamScheduleEntry[]>>;
}

type PlanMode = 'select_type' | 'ai_normal' | 'manual_normal' | 'revision';
type PlanTempo = 'Hafif' | 'Orta' | 'Yogun';
type StoredPlanStatus = 'draft' | 'pending-approval' | 'active' | 'archived';

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const TEMPO_LIMITS: Record<PlanTempo, number> = { Hafif: 5, Orta: 8, Yogun: 12 };
const PLAN_DAY_TASK_PREVIEW_LIMIT = 4;
const TEMPO_LABELS: Record<PlanTempo, string> = {
  Hafif: 'Daha az konu, daha sakin tempo',
  Orta: 'Dengeli ilerleme ve tekrar',
  Yogun: 'Daha fazla konu ve daha siki program',
};
const MODE_META: Record<Exclude<PlanMode, 'select_type'>, { title: string; description: string; badge: string }> = {
  ai_normal: {
    title: 'Normal Hafta - Akıllı Dağıtım',
    description: 'Açık konuları haftalık programa göre otomatik dağıtır.',
    badge: 'Otomatik',
  },
  manual_normal: {
    title: 'Normal Hafta - Konu Seçimli',
    description: 'Bu hafta işlenecek konuları sen seçersin, sistem plana dönüştürür.',
    badge: 'Seçimli',
  },
  revision: {
    title: 'Sınav / Tekrar Haftası',
    description: 'Seçili konulardan tekrar ve kapatma planı oluşturur.',
    badge: 'Tekrar',
  },
};

const PLAN_REASON_LABELS: Record<NonNullable<StoredStudyPlan['reason']>, string> = {
  'initial-plan': 'İlk plan',
  'performance-drop': 'Performans düşüşü',
  'revision-needed': 'Tekrar ihtiyacı',
  'exam-pressure': 'Sınav baskısı',
  'schedule-change': 'Program değişikliği',
  'manual-parent-update': 'Ebeveyn onayı bekliyor',
};

const PLAN_REASON_DESCRIPTIONS: Record<NonNullable<StoredStudyPlan['reason']>, string> = {
  'initial-plan': 'Haftanın ilk çalışma düzeni oluşturuldu.',
  'performance-drop': 'Düşük başarı sinyali nedeniyle ek destek blokları önerildi.',
  'revision-needed': 'Tekrar gecikmesi veya riskli konu nedeniyle plan güncellendi.',
  'exam-pressure': 'Yaklaşan sınav planın önceliğini değiştirdi.',
  'schedule-change': 'Okul programı veya ev çalışma penceresi değiştiği için yeni sürüm hazırlandı.',
  'manual-parent-update': 'Ebeveynin incelemesi ve onayı için manuel güncelleme hazırlandı.',
};

const PLAN_STATUS_LABELS: Record<StoredPlanStatus, string> = {
  draft: 'Taslak',
  'pending-approval': 'Onay bekliyor',
  active: 'Aktif',
  archived: 'Geçmiş',
};

const SOURCE_REASON_LABELS: Record<PlanBlockRecord['sourceReason'], string> = {
  'curriculum-flow': 'Müfredat',
  'revision-trigger': 'Risk / tekrar',
  'exam-trigger': 'Sınav',
  'manual-parent': 'Manuel',
  compensation: 'Telafi',
};

const normalize = (value: string) =>
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

const createEmptyScheduleDay = () => ({
  slots: [],
  availableWindows: [],
  confirmed: false,
});

const resolveScheduleDay = (value: WeeklySchedule[string] | string | undefined) => {
  if (!value) return createEmptyScheduleDay();
  if (typeof value === 'string') return createEmptyScheduleDay();
  return {
    slots: Array.isArray(value.slots) ? value.slots : [],
    availableWindows: Array.isArray(value.availableWindows) ? value.availableWindows : [],
    confirmed: Boolean(value.confirmed),
  };
};

const clonePlans = (plans: StoredStudyPlan[]) => JSON.parse(JSON.stringify(plans)) as StoredStudyPlan[];

const toMinutes = (value: string) => {
  const [hourText, minuteText] = value.split(':');
  return Number(hourText) * 60 + Number(minuteText);
};

const getPlanVersion = (plan: StoredStudyPlan) => plan.version || 1;

const getPlanStatus = (plan: StoredStudyPlan): StoredPlanStatus => plan.status || 'active';

const sortStoredPlans = (left: StoredStudyPlan, right: StoredStudyPlan) => {
  if (left.week !== right.week) return left.week - right.week;
  const versionDelta = getPlanVersion(left) - getPlanVersion(right);
  if (versionDelta !== 0) return versionDelta;
  return (left.generatedAt || '').localeCompare(right.generatedAt || '');
};

const mapPlanTaskToTaskType = (task: SubjectPlanTask): Task['taskType'] => {
  const normalizedType = normalize(task.type || '');
  const normalizedSource = normalize(task.source || '');
  if (normalizedType.includes('soru') || normalizedSource.includes('olcme') || normalizedSource.includes('sinav')) return 'soru çözme';
  return 'ders çalışma';
};

const mapPlanTaskToGoalType = (task: SubjectPlanTask) => {
  const normalizedType = normalize(task.type || '');
  const normalizedSource = normalize(task.source || '');
  if (normalizedSource.includes('olcme')) return 'olcme-degerlendirme';
  if (normalizedSource.includes('sinav')) return 'sinav-hazirlik';
  if (normalizedType.includes('soru')) return 'test-cozme';
  if (normalizedType.includes('tekrar') || normalizedSource.includes('telafi')) return 'konu-tekrari';
  return 'eksik-konu-tamamlama';
};

const mapRecommendedBlockToPlanTask = (block: PlanBlockRecord): SubjectPlanTask => ({
  id: block.id,
  day: block.dayName,
  startTime: block.startTime,
  endTime: block.endTime,
  type: mapBlockTypeToDisplayType(block.blockType),
  duration: Math.max(toMinutes(block.endTime) - toMinutes(block.startTime), 20),
  questionCount: block.blockType === 'question_practice' ? 20 : block.blockType === 'assessment' ? 12 : block.blockType === 'exam_prep' ? 25 : null,
  source: block.sourceReason === 'compensation'
    ? 'Telafi bloğu'
    : block.sourceReason === 'exam-trigger'
      ? 'Sınav önceliği'
      : block.sourceReason === 'revision-trigger'
        ? 'Risk / tekrar'
      : block.sourceReason === 'manual-parent'
          ? 'Manuel güncelleme'
          : 'Haftalık plan',
  completed: false,
});

const getReasonLabel = (reason?: StoredStudyPlan['reason']) => (reason ? PLAN_REASON_LABELS[reason] : 'Plan guncellemesi');

const getReasonDescription = (reason?: StoredStudyPlan['reason']) => (reason ? PLAN_REASON_DESCRIPTIONS[reason] : 'Plan güncellemesi kayıt altında.');

const getTaskSourceDescription = (source?: string) => {
  const normalizedSource = normalize(source || '');
  if (normalizedSource.includes('telafi')) return 'Plan kırılması veya tamamlanmayan çalışma için telafi bloğu.';
  if (normalizedSource.includes('sinav')) return 'Yaklaşan sınav nedeniyle öncelik verilen hazırlık bloğu.';
  if (normalizedSource.includes('risk') || normalizedSource.includes('tekrar')) return 'Riskli veya geciken konu için tekrar bloğu.';
  if (normalizedSource.includes('manuel')) return 'Ebeveyn tarafından elle eklenen plan güncellemesi.';
  if (normalizedSource.includes('olcme')) return 'Konu durumunu ölçmek için değerlendirme bloğu.';
  return 'Müfredat akışını ve ev çalışma pencerelerini izleyen haftalık plan bloğu.';
};

const formatDateLabel = (value?: string) => {
  if (!value) return 'Tarih yok';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Tarih yok';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const collectPlanTasks = (plan: StoredStudyPlan) =>
  Object.entries(plan.plan || {}).flatMap(([subject, subjectPlan]) =>
    (Array.isArray(subjectPlan?.units) ? subjectPlan.units : []).flatMap((unit) =>
      (Array.isArray(unit?.topics) ? unit.topics : []).flatMap((topic) =>
        (Array.isArray(topic?.tasks) ? topic.tasks : []).map((task) => ({ subject, unitName: unit.name, topicName: topic.name, task })),
      ),
    ),
  );

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildDueDate = (dayName: string) => {
  const today = new Date();
  const targetIndex = DAYS.indexOf(dayName);
  const currentIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const offset = targetIndex >= currentIndex ? targetIndex - currentIndex : 7 - currentIndex + targetIndex;
  const dueDate = new Date(today);
  dueDate.setDate(today.getDate() + offset);
  return formatDate(dueDate);
};

const mapBlockTypeToDisplayType = (value: string) => {
  if (value === 'revision' || value === 'light_review' || value === 'compensation') return 'Konu Tekrari';
  if (value === 'question_practice' || value === 'assessment' || value === 'exam_prep') return 'Soru Cozumu';
  return 'Eksik Konu Tamamlama';
};

const mapBlockTypeToTaskType = (value: string): Task['taskType'] => {
  if (value === 'question_practice' || value === 'assessment' || value === 'exam_prep') return 'soru çözme';
  return 'ders çalışma';
};

const mapBlockTypeToGoal = (value: string) => {
  if (value === 'assessment') return 'olcme-degerlendirme';
  if (value === 'exam_prep') return 'sinav-hazirlik';
  if (value === 'question_practice') return 'test-cozme';
  if (value === 'revision' || value === 'light_review' || value === 'compensation') return 'konu-tekrari';
  return 'eksik-konu-tamamlama';
};

const getTopicSelectionKey = (subject: string, unitName: string, topicName: string) => `${subject}__${unitName}__${topicName}`;

const PlanningPanel: React.FC<PlanningPanelProps> = ({
  curriculum,
  weeklySchedule,
  planningEngineSnapshot,
  examScheduleEntries,
  studyPlans,
  courses,
  tasks,
  addTask,
  deleteTask,
  updateTaskStatus: _updateTaskStatus,
  updateTaskFromPlan,
  onChangePlans,
  onChangeExamSchedules,
}) => {
  const safeCurriculum = useMemo(() => curriculum || {}, [curriculum]);
  const safeWeeklySchedule = useMemo(() => weeklySchedule || ({} as WeeklySchedule), [weeklySchedule]);
  const safeStudyPlans = useMemo(() => (Array.isArray(studyPlans) ? studyPlans : []), [studyPlans]);
  const safeExamScheduleEntries = useMemo(() => (Array.isArray(examScheduleEntries) ? examScheduleEntries : []), [examScheduleEntries]);
  const safeCourses = useMemo(() => (Array.isArray(courses) ? courses : []), [courses]);
  const safeTasks = useMemo(() => (Array.isArray(tasks) ? tasks : []), [tasks]);
  const safePlanningEngineSnapshot: PlanningEngineSnapshot = useMemo(() => ({
    scheduleDays: Array.isArray(planningEngineSnapshot?.scheduleDays) ? planningEngineSnapshot.scheduleDays : [],
    curriculumTopics: Array.isArray(planningEngineSnapshot?.curriculumTopics) ? planningEngineSnapshot.curriculumTopics : [],
    examSchedules: Array.isArray(planningEngineSnapshot?.examSchedules) ? planningEngineSnapshot.examSchedules : [],
    topicStatuses: Array.isArray(planningEngineSnapshot?.topicStatuses) ? planningEngineSnapshot.topicStatuses : [],
    studyPlanRecords: Array.isArray(planningEngineSnapshot?.studyPlanRecords) ? planningEngineSnapshot.studyPlanRecords : [],
    planBlockRecords: Array.isArray(planningEngineSnapshot?.planBlockRecords) ? planningEngineSnapshot.planBlockRecords : [],
    studySessions: Array.isArray(planningEngineSnapshot?.studySessions) ? planningEngineSnapshot.studySessions : [],
    assessmentResults: Array.isArray(planningEngineSnapshot?.assessmentResults) ? planningEngineSnapshot.assessmentResults : [],
    replanTriggers: Array.isArray(planningEngineSnapshot?.replanTriggers) ? planningEngineSnapshot.replanTriggers : [],
  }), [planningEngineSnapshot]);
  const [mode, setMode] = useState<PlanMode>('select_type');
  const [planTempo, setPlanTempo] = useState<PlanTempo>('Orta');
  const [selectedTopicMap, setSelectedTopicMap] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');
  const [activeWeek, setActiveWeek] = useState<number>(safeStudyPlans.length > 0 ? Math.max(...safeStudyPlans.map((item) => item.week)) : 0);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editSource, setEditSource] = useState('');
  const [editDuration, setEditDuration] = useState('40');
  const [editQuestionCount, setEditQuestionCount] = useState('20');
  const [expandedPlanDays, setExpandedPlanDays] = useState<Record<string, boolean>>({});
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isApplyingPendingPlan, setIsApplyingPendingPlan] = useState(false);
  const [selectedExamCourseId, setSelectedExamCourseId] = useState('');
  const [examNameInput, setExamNameInput] = useState('');
  const [examDateInput, setExamDateInput] = useState('');
  const [examNoteInput, setExamNoteInput] = useState('');
  const [planBuilderOpen, setPlanBuilderOpen] = useState(false);
  const [examEditorOpen, setExamEditorOpen] = useState(false);

  const subjects = useMemo(() => Object.keys(safeCurriculum), [safeCurriculum]);
  const sortedPlans = useMemo(() => [...safeStudyPlans].sort(sortStoredPlans), [safeStudyPlans]);
  const nonPendingPlans = useMemo(() => sortedPlans.filter((item) => getPlanStatus(item) !== 'pending-approval'), [sortedPlans]);
  const pendingPlans = useMemo(() => sortedPlans.filter((item) => getPlanStatus(item) === 'pending-approval'), [sortedPlans]);
  const activeStoredPlan = useMemo(
    () => nonPendingPlans.find((item) => getPlanStatus(item) === 'active') || nonPendingPlans[nonPendingPlans.length - 1] || null,
    [nonPendingPlans],
  );
  const existingWeeks = useMemo(() => [...new Set(nonPendingPlans.map((item) => item.week))].sort((a, b) => a - b), [nonPendingPlans]);
  const latestWeek = existingWeeks.length > 0 ? existingWeeks[existingWeeks.length - 1] : 0;
  const nextWeek = latestWeek + 1;
  const activeWeekIndex = existingWeeks.indexOf(activeWeek);
  const activePlan = useMemo(() => {
    const weekPlans = nonPendingPlans.filter((item) => item.week === activeWeek).sort(sortStoredPlans);
    return weekPlans.find((item) => getPlanStatus(item) === 'active') || weekPlans[weekPlans.length - 1] || null;
  }, [nonPendingPlans, activeWeek]);
  const pendingPlan = useMemo(() => {
    if (!activePlan) return pendingPlans[0] || null;
    return pendingPlans.filter((item) => item.week === activePlan.week).sort(sortStoredPlans).slice(-1)[0] || null;
  }, [pendingPlans, activePlan]);
  const activeWeekPlanHistory = useMemo(
    () => sortedPlans.filter((item) => item.week === activeWeek).sort((left, right) => getPlanVersion(right) - getPlanVersion(left)),
    [sortedPlans, activeWeek],
  );

  const activePlanVersion = activePlan ? getPlanVersion(activePlan) : 1;
  const activePlanRecord = useMemo(() => {
    if (!activePlan) return null;
    return safePlanningEngineSnapshot.studyPlanRecords.find((record) => record.weekKey === `week-${activePlan.week}` && record.version === activePlanVersion)
      || safePlanningEngineSnapshot.studyPlanRecords.find((record) => record.status === 'active' && record.weekKey === `week-${activePlan.week}`)
      || null;
  }, [safePlanningEngineSnapshot.studyPlanRecords, activePlan, activePlanVersion]);
  const weekTriggers = useMemo(() => (
    activePlan
      ? safePlanningEngineSnapshot.replanTriggers.filter((trigger) => trigger.id.includes(`week_${activePlan.week}`))
      : []
  ), [safePlanningEngineSnapshot.replanTriggers, activePlan]);
  const recommendedBlocks = useMemo(() => {
    if (!activePlanRecord) return [];
    return safePlanningEngineSnapshot.planBlockRecords
      .filter((block) => block.assignmentMode === 'recommended' && block.studyPlanId === activePlanRecord.id)
      .sort((left, right) => left.dayName.localeCompare(right.dayName) || left.startTime.localeCompare(right.startTime));
  }, [safePlanningEngineSnapshot.planBlockRecords, activePlanRecord]);
  const recommendedBlockSummary = useMemo(() => {
    const counts = new Map<PlanBlockRecord['sourceReason'], number>();
    recommendedBlocks.forEach((block) => {
      counts.set(block.sourceReason, (counts.get(block.sourceReason) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([reason, count]) => ({ reason, count }));
  }, [recommendedBlocks]);
  const sortedExamSchedules = useMemo(
    () => [...safeExamScheduleEntries].sort((left, right) => left.date.localeCompare(right.date) || left.courseName.localeCompare(right.courseName)),
    [safeExamScheduleEntries],
  );
  const activeCourses = useMemo(() => safeCourses.filter((course) => course.active !== false), [safeCourses]);
  const upcomingExam = sortedExamSchedules.find((exam) => exam.date >= formatDate(new Date())) || sortedExamSchedules[0] || null;

  useEffect(() => {
    if (existingWeeks.length === 0) {
      if (activeWeek !== 0) setActiveWeek(0);
      return;
    }

    if (!existingWeeks.includes(activeWeek)) {
      setActiveWeek(latestWeek);
    }
  }, [existingWeeks, latestWeek, activeWeek]);

  useEffect(() => {
    if (activeStoredPlan && activeWeek === 0) {
      setActiveWeek(activeStoredPlan.week);
    }
  }, [activeStoredPlan, activeWeek]);

  const flatTopics = useMemo(
    () =>
      Object.entries(safeCurriculum).flatMap(([subject, units]) =>
        (Array.isArray(units) ? units : []).flatMap((unit) =>
          (Array.isArray(unit?.topics) ? unit.topics : []).map((topic) => ({
            subject,
            unitName: unit.name,
            topicName: topic.name,
            completed: topic.completed,
          })),
        ),
      ),
    [safeCurriculum],
  );

  const selectedTopicCount = Object.values(selectedTopicMap).filter(Boolean).length;
  const confirmedScheduleDays = useMemo(() => DAYS.filter((day) => resolveScheduleDay(safeWeeklySchedule[day]).confirmed), [safeWeeklySchedule]);
  const daysWithSlots = useMemo(() => DAYS.filter((day) => resolveScheduleDay(safeWeeklySchedule[day]).slots.length > 0), [safeWeeklySchedule]);
  const daysWithStudyWindows = useMemo(() => DAYS.filter((day) => resolveScheduleDay(safeWeeklySchedule[day]).availableWindows.length > 0), [safeWeeklySchedule]);
  const hasPendingScheduleApproval = useMemo(() => DAYS.some((day) => {
    const dayState = resolveScheduleDay(safeWeeklySchedule[day]);
    return (dayState.slots.length > 0 || dayState.availableWindows.length > 0) && !dayState.confirmed;
  }), [safeWeeklySchedule]);
  const scheduleReady = confirmedScheduleDays.length > 0 && daysWithSlots.length > 0 && daysWithStudyWindows.length > 0 && !hasPendingScheduleApproval;
  const activeModeMeta = mode === 'select_type' ? null : MODE_META[mode];

  const plannedTasksByDay = useMemo(() => {
    const emptyDays = Object.fromEntries(DAYS.map((day) => [day, [] as Array<SubjectPlanTask & { subject: string; unitName: string; topicName: string }>])) as Record<string, Array<SubjectPlanTask & { subject: string; unitName: string; topicName: string }>>;
    if (!activePlan) return emptyDays;

    const allTasks = Object.entries(activePlan.plan || {})
      .flatMap(([subject, subjectPlan]) =>
        (Array.isArray(subjectPlan?.units) ? subjectPlan.units : []).flatMap((unit) =>
          (Array.isArray(unit?.topics) ? unit.topics : []).flatMap((topic) =>
            (Array.isArray(topic?.tasks) ? topic.tasks : []).map((task) => {
              const linkedTask = safeTasks.find((entry) => entry.planTaskId === task.id);
              return { ...task, subject, unitName: unit.name, topicName: topic.name, completed: linkedTask ? isCompletedTask(linkedTask) : task.completed };
            }),
          ),
        ),
      )
      .sort((left, right) => left.startTime.localeCompare(right.startTime));

    allTasks.forEach((task) => {
      if (!emptyDays[task.day]) emptyDays[task.day] = [];
      emptyDays[task.day].push(task);
    });

    DAYS.forEach((day) => {
      emptyDays[day] = emptyDays[day].sort((left, right) => left.startTime.localeCompare(right.startTime));
    });

    return emptyDays;
  }, [activePlan, safeTasks]);
  const activePlanTaskCount = useMemo(
    () => Object.values(plannedTasksByDay).reduce((sum, dayTasks) => sum + dayTasks.length, 0),
    [plannedTasksByDay],
  );
  const pendingPlanTaskCount = useMemo(() => (pendingPlan ? collectPlanTasks(pendingPlan).length : 0), [pendingPlan]);
  const pendingPlanAddedTaskCount = Math.max(0, pendingPlanTaskCount - activePlanTaskCount);
  const planGroundItems = [
    {
      label: 'Okul programı',
      value: daysWithSlots.length > 0 ? `${daysWithSlots.length} gün` : 'Eksik',
      ready: daysWithSlots.length > 0,
    },
    {
      label: 'Ev çalışma zamanı',
      value: daysWithStudyWindows.length > 0 ? `${daysWithStudyWindows.length} gün` : 'Eksik',
      ready: daysWithStudyWindows.length > 0,
    },
    {
      label: 'Gün onayı',
      value: hasPendingScheduleApproval ? 'Onay bekliyor' : confirmedScheduleDays.length > 0 ? `${confirmedScheduleDays.length} gün` : 'Eksik',
      ready: confirmedScheduleDays.length > 0 && !hasPendingScheduleApproval,
    },
  ];

  const resetSelection = () => {
    setSelectedTopicMap({});
    setMessage('');
  };

  const chooseMode = (nextMode: Exclude<PlanMode, 'select_type'>) => {
    setMode(nextMode);
    setMessage('');
  };

  const addExamSchedule = () => {
    const course = safeCourses.find((item) => item.id === selectedExamCourseId);
    if (!course || !examNameInput.trim() || !examDateInput) {
      setMessage('Sınav takvimi eklemek için ders, sınav adı ve tarih seçmelisiniz.');
      return false;
    }

    const nextEntry: ExamScheduleEntry = {
      id: `exam_schedule_${course.id}_${examDateInput}_${Date.now()}`,
      courseId: course.id,
      courseName: course.name,
      examName: examNameInput.trim(),
      date: examDateInput,
      note: examNoteInput.trim() || undefined,
    };

    onChangeExamSchedules((prev) => [...prev, nextEntry]);
    setSelectedExamCourseId('');
    setExamNameInput('');
    setExamDateInput('');
    setExamNoteInput('');
    setMessage('Sınav takvimi güncellendi.');
    return true;
  };

  const toggleSelectedTopic = (subject: string, unitName: string, topicName: string) => {
    const key = getTopicSelectionKey(subject, unitName, topicName);
    setSelectedTopicMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const collectCandidateTopics = (targetMode: Exclude<PlanMode, 'select_type'>) => {
    if (targetMode === 'ai_normal') {
      return flatTopics.filter((item) => !item.completed);
    }

    const selected = flatTopics.filter((item) => selectedTopicMap[getTopicSelectionKey(item.subject, item.unitName, item.topicName)]);
    return targetMode === 'manual_normal' ? selected.filter((item) => !item.completed) : selected;
  };

  const generatePlan = async (targetMode: Exclude<PlanMode, 'select_type'>) => {
    if (isGeneratingPlan) return;

    if (!scheduleReady) {
      setMessage('Plan oluşturmadan önce okul programını, ev çalışma zamanlarını ve gün onaylarını tamamlamalısınız.');
      return;
    }

    const candidateTopics = collectCandidateTopics(targetMode);
    if (candidateTopics.length === 0) {
      setMessage(targetMode === 'ai_normal' ? 'Açık konu bulunamadı.' : 'Plan üretmek için konu seçmelisiniz.');
      return;
    }

    setIsGeneratingPlan(true);

    const createdTaskIds: string[] = [];

    try {
      const week = nextWeek;
      const plan: StudyPlan = {};
      const unmatchedSubjects = new Set<string>();
      const draftBlocks = createWeeklyPlanDraft({
        mode: targetMode,
        tempo: planTempo,
        candidateTopics,
        snapshot: safePlanningEngineSnapshot,
        weeklySchedule: safeWeeklySchedule,
      });

      for (const draft of draftBlocks) {
        const type = mapBlockTypeToDisplayType(draft.blockType);
        const course = safeCourses.find((entry) => normalize(entry.name) === normalize(draft.subject));
        if (!course) {
          unmatchedSubjects.add(draft.subject);
          continue;
        }

        const planTask: SubjectPlanTask = {
          id: draft.id,
          day: draft.day,
          startTime: draft.startTime,
          endTime: draft.endTime,
          type,
          duration: draft.duration,
          questionCount: draft.questionCount,
          source: draft.source,
          completed: false,
        };

        if (!plan[draft.subject]) {
          plan[draft.subject] = { units: [] };
        }

        let unit = plan[draft.subject].units.find((entry) => entry.name === draft.unitName);
        if (!unit) {
          unit = { name: draft.unitName, topics: [] };
          plan[draft.subject].units.push(unit);
        }

        let topic = unit.topics.find((entry) => entry.name === draft.topicName);
        if (!topic) {
          topic = { name: draft.topicName, tasks: [] };
          unit.topics.push(topic);
        }
        topic.tasks.push(planTask);

        const taskExistsBefore = safeTasks.some((entry) => entry.planTaskId === draft.id);
        const createdTask = await addTask({
          title: `${draft.subject} - ${draft.topicName}`,
          courseId: course.id,
          dueDate: buildDueDate(draft.day),
          taskType: mapBlockTypeToTaskType(draft.blockType),
          plannedDuration: draft.duration,
          questionCount: draft.questionCount || undefined,
          curriculumUnitName: draft.unitName,
          curriculumTopicName: draft.topicName,
          taskGoalType: mapBlockTypeToGoal(draft.blockType),
          planWeek: week,
          planSource: targetMode === 'ai_normal' ? 'ai-plan' : 'weekly-plan',
          planLabel: draft.source,
          planTaskId: draft.id,
        });

        if (!taskExistsBefore) {
          createdTaskIds.push(createdTask.id);
        }
      }

      if (Object.keys(plan).length === 0) {
        if (unmatchedSubjects.size > 0) {
          setMessage(`Plan üretilemedi. Ders listesinde eşleşmeyen müfredat alanları: ${Array.from(unmatchedSubjects).join(', ')}.`);
          return;
        }
        setMessage('Plan üretilemedi. Ders eşleşmeleri kontrol edilmeli.');
        return;
      }

      const storedPlan: StoredStudyPlan = {
        id: `study_plan_week_${week}_v1_${Date.now()}`,
        week,
        version: 1,
        plan,
        schedule: safeWeeklySchedule,
        type: targetMode === 'revision' ? 'revision' : 'normal',
        status: 'active',
        reason: targetMode === 'revision' ? 'revision-needed' : 'initial-plan',
        generatedAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        approvedBy: 'parent',
      };

      onChangePlans((prev) => {
        const next = clonePlans(prev).map((planItem) =>
          getPlanStatus(planItem) === 'active'
            ? { ...planItem, status: 'archived' as const, approvedAt: planItem.approvedAt || new Date().toISOString(), approvedBy: planItem.approvedBy || 'parent' }
            : planItem,
        );
        next.push(storedPlan);
        return next;
      });
      setActiveWeek(week);
      resetSelection();
      const unmatchedMessage = unmatchedSubjects.size > 0 ? ` Eşleşmeyen dersler atlandı: ${Array.from(unmatchedSubjects).join(', ')}.` : '';
      setMessage(`Hafta ${week} planı oluşturuldu.${unmatchedMessage}`);
    } catch (error) {
      // Roll back only tasks created in this generation attempt.
      createdTaskIds.forEach((taskId) => deleteTask(taskId));
      console.error('Plan oluşturma hatası, oluşturulan görevler geri alındı:', error);
      setMessage('Plan oluşturulamadı. İşlem geri alındı, tekrar deneyin.');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const startEditTask = (planTask: SubjectPlanTask) => {
    setEditingTaskId(planTask.id);
    setEditSource(planTask.source);
    setEditDuration(`${planTask.duration || 0}`);
    setEditQuestionCount(`${planTask.questionCount || 0}`);
  };

  const saveEditedTask = () => {
    if (!editingTaskId) return;

    const nextDuration = Number(editDuration) || 0;
    const nextQuestionCount = Number(editQuestionCount) || 0;

    onChangePlans((prev) => {
      const next = clonePlans(prev);
      const plan = next.find((item) => item.week === activeWeek);
      if (!plan) return prev;

      for (const subjectPlan of Object.values(plan.plan)) {
        for (const unit of subjectPlan.units) {
          for (const topic of unit.topics) {
            const task = topic.tasks.find((entry) => entry.id === editingTaskId);
            if (task) {
              task.source = editSource.trim() || task.source;
              task.duration = nextDuration || task.duration;
              task.questionCount = nextQuestionCount || null;
              return next;
            }
          }
        }
      }
      return prev;
    });

    updateTaskFromPlan(editingTaskId, {
      plannedDuration: nextDuration || undefined,
      questionCount: nextQuestionCount || undefined,
    });
    setEditingTaskId(null);
  };

  const createPendingPlanFromRecommendations = () => {
    if (!activePlan || recommendedBlocks.length === 0) return;

    const now = new Date().toISOString();
    const nextVersion = Math.max(...sortedPlans.filter((item) => item.week === activePlan.week).map((item) => getPlanVersion(item)), 0) + 1;
    const nextPlan = clonePlans([activePlan])[0];
    const topicLookup = new Map(safePlanningEngineSnapshot.curriculumTopics.map((topic) => [topic.id, topic]));

    recommendedBlocks.forEach((block) => {
      const topicRecord = block.topicId ? topicLookup.get(block.topicId) : undefined;
      const unitName = topicRecord?.unitName || 'Ek bloklar';
      const topicName = block.topicName || 'Ek çalışma';

      if (!nextPlan.plan) nextPlan.plan = {};
      if (!nextPlan.plan[block.courseName]) {
        nextPlan.plan[block.courseName] = { units: [] };
      }

      const units = Array.isArray(nextPlan.plan[block.courseName].units) ? nextPlan.plan[block.courseName].units : [];
      nextPlan.plan[block.courseName].units = units;
      let unit = units.find((entry) => entry.name === unitName);
      if (!unit) {
        unit = { name: unitName, topics: [] };
        units.push(unit);
      }

      const topics = Array.isArray(unit.topics) ? unit.topics : [];
      unit.topics = topics;
      let topic = topics.find((entry) => entry.name === topicName);
      if (!topic) {
        topic = { name: topicName, tasks: [] };
        topics.push(topic);
      }

      const topicTasks = Array.isArray(topic.tasks) ? topic.tasks : [];
      topic.tasks = topicTasks;
      if (!topicTasks.some((task) => task.id === block.id)) {
        topic.tasks.push(mapRecommendedBlockToPlanTask(block));
      }
    });

    const derivedReason: StoredStudyPlan['reason'] = weekTriggers.some((trigger) => trigger.type === 'schedule-change')
      ? 'schedule-change'
      : weekTriggers.some((trigger) => trigger.type === 'low-performance')
        ? 'performance-drop'
        : weekTriggers.some((trigger) => trigger.type === 'revision-delay')
          ? 'revision-needed'
          : weekTriggers.some((trigger) => trigger.type === 'exam-pressure')
            ? 'exam-pressure'
            : 'manual-parent-update';

    const pendingPlanDraft: StoredStudyPlan = {
      ...nextPlan,
      id: `study_plan_week_${activePlan.week}_v${nextVersion}_${Date.now()}`,
      version: nextVersion,
      status: 'pending-approval',
      reason: derivedReason,
      generatedAt: now,
      approvedAt: undefined,
      approvedBy: undefined,
      parentPlanId: activePlan.id,
      schedule: safeWeeklySchedule,
    };

    onChangePlans((prev) => {
      const next = clonePlans(prev).filter((item) => !(getPlanStatus(item) === 'pending-approval' && item.week === activePlan.week));
      next.push(pendingPlanDraft);
      return next;
    });
    setMessage(`Hafta ${activePlan.week} için onay bekleyen plan sürümü hazırlandı.`);
  };

  const rejectPendingPlan = () => {
    if (!pendingPlan) return;
    onChangePlans((prev) => clonePlans(prev).filter((item) => item.id !== pendingPlan.id));
    setMessage('Bekleyen plan sürümü kaldırıldı.');
  };

  const approvePendingPlan = async () => {
    if (!pendingPlan || isApplyingPendingPlan) return;

    setIsApplyingPendingPlan(true);
    const createdTaskIds: string[] = [];

    try {
      const planTasksToCreate = collectPlanTasks(pendingPlan)
        .filter(({ task }) => !safeTasks.some((entry) => entry.planTaskId === task.id));

      for (const item of planTasksToCreate) {
        const course = safeCourses.find((entry) => normalize(entry.name) === normalize(item.subject));
        if (!course) continue;
        const createdTask = await addTask({
          title: `${item.subject} - ${item.topicName}`,
          courseId: course.id,
          dueDate: buildDueDate(item.task.day),
          taskType: mapPlanTaskToTaskType(item.task),
          plannedDuration: item.task.duration || 30,
          questionCount: item.task.questionCount || undefined,
          curriculumUnitName: item.unitName,
          curriculumTopicName: item.topicName,
          taskGoalType: mapPlanTaskToGoalType(item.task),
          planWeek: pendingPlan.week,
          planSource: 'weekly-plan',
          planLabel: item.task.source,
          planTaskId: item.task.id,
        });
        createdTaskIds.push(createdTask.id);
      }

      const now = new Date().toISOString();
      onChangePlans((prev) => clonePlans(prev).map((item) => {
        if (item.id === pendingPlan.id) {
          return {
            ...item,
            status: 'active' as const,
            approvedAt: now,
            approvedBy: 'parent' as const,
          };
        }

        if (item.week === pendingPlan.week && item.id !== pendingPlan.id && getPlanStatus(item) !== 'pending-approval') {
          return {
            ...item,
            status: 'archived' as const,
            approvedAt: item.approvedAt || now,
            approvedBy: item.approvedBy || 'parent',
          };
        }

        return item;
      }));

      setActiveWeek(pendingPlan.week);
      setMessage(`Hafta ${pendingPlan.week} bekleyen planı onaylandı ve aktifleşti.`);
    } catch (error) {
      createdTaskIds.forEach((taskId) => deleteTask(taskId));
      console.error('Bekleyen plan onaylanırken hata oluştu:', error);
      setMessage('Bekleyen plan onaylanamadı. Oluşturulan görevler geri alındı.');
    } finally {
      setIsApplyingPendingPlan(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-primary-600">
            <Sparkles className="h-4 w-4" />
            Haftalık Planlar
          </div>
          <h2 className="mt-2 text-3xl font-black text-slate-900">Haftalık çalışma planı</h2>
          <p className="mt-1 text-sm text-slate-500">Okul programı, ev çalışma zamanı ve sınav takvimi aynı plan merkezinde kontrol edilir.</p>
        </div>
        <div className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${scheduleReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {scheduleReady ? `${confirmedScheduleDays.length} gün hazır` : 'Eksik plan zemini var'}
        </div>
      </div>

      {!scheduleReady && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          Planlama motoru beklemede. {daysWithSlots.length === 0
            ? 'Önce okul programına en az bir ders bloğu ekleyin.'
            : daysWithStudyWindows.length === 0
              ? 'Evde çalışılabilecek saat penceresi eklenmeden doğru plan üretilemez.'
              : 'Girdiğiniz okul/çalışma günlerini onaylamadan plan oluşturulamaz.'}
        </div>
      )}

      <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Plan zemini</span>
            {planGroundItems.map((item) => (
              <span key={item.label} className={`rounded-full px-3 py-1 text-xs font-bold ${item.ready ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {item.label}: {item.value}
              </span>
            ))}
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              Sınav: {upcomingExam ? `${upcomingExam.courseName} ${formatDateLabel(upcomingExam.date)}` : 'opsiyonel'}
            </span>
          </div>

          <button onClick={() => setExamEditorOpen(true)} className="ios-button inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold text-slate-700">
            <PlusCircle className="h-4 w-4" />
            Sınav ekle
          </button>
        </div>
      </div>

      <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="h-4 w-4 text-primary-600" />
              <span className="text-sm font-black text-slate-900">{activeWeek > 0 ? `Hafta ${activeWeek}` : 'Henüz aktif haftalık plan yok'}</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-slate-600">{activePlanTaskCount} çalışma bloğu</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                {mode === 'select_type' ? 'Plan tipi seçilmedi' : `${activeModeMeta?.title} / ${planTempo}`}
              </span>
            </div>
            <div className="text-xs font-semibold text-slate-500">
              Plan oluşturulunca ev çalışma pencerelerine göre saatlenir, aktif haftalık plana ve çocuk görevlerine eklenir.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                if (activeWeekIndex <= 0) return;
                setActiveWeek(existingWeeks[activeWeekIndex - 1]);
              }}
              disabled={activeWeekIndex <= 0}
              className="ios-button rounded-2xl px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"
            >
              Geri
            </button>
            <button
              onClick={() => {
                if (activeWeekIndex < 0 || activeWeekIndex >= existingWeeks.length - 1) return;
                setActiveWeek(existingWeeks[activeWeekIndex + 1]);
              }}
              disabled={activeWeekIndex < 0 || activeWeekIndex >= existingWeeks.length - 1}
              className="ios-button rounded-2xl px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40"
            >
              İleri
            </button>
            <button
              type="button"
              onClick={() => setPlanBuilderOpen(true)}
              className="ios-button-active inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-xs font-black text-slate-900"
            >
              <Sparkles className="h-4 w-4" />
              Plan oluştur
            </button>
          </div>
        </div>
      </div>

      {message && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>}

      <div className="space-y-4">

          {planBuilderOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation">
              <div className="ios-card flex max-h-[min(44rem,calc(100dvh-2rem))] w-[min(64rem,100%)] flex-col overflow-hidden rounded-[28px]" role="dialog" aria-modal="true" aria-label="Plan uretim ayarlari">
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
                      <Sparkles className="h-4 w-4" />
                      Planlama Motoru
                    </div>
                    <h3 className="mt-2 text-2xl font-black text-slate-900">Hafta {nextWeek} planini hazirla</h3>
                    <p className="mt-1 text-sm text-slate-500">Plan tipi, tempo ve gerekiyorsa konu secimini burada yap.</p>
                  </div>
                  <button type="button" onClick={() => setPlanBuilderOpen(false)} className="ios-button flex h-11 w-11 items-center justify-center rounded-full text-slate-600" aria-label="Plan uretimini kapat">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="dr-modal-scroll min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
                  <div className="ios-widget rounded-[20px] p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-2">
                          {(Object.keys(MODE_META) as Array<Exclude<PlanMode, 'select_type'>>).map((key) => {
                            const active = mode === key;
                            return (
                              <button
                                key={key}
                                onClick={() => chooseMode(key)}
                                className={`rounded-full px-4 py-2 text-sm font-bold transition ${active ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}
                              >
                                {MODE_META[key].badge}
                              </button>
                            );
                          })}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {(['Hafif', 'Orta', 'Yogun'] as PlanTempo[]).map((tempo) => (
                            <button
                              key={tempo}
                              onClick={() => setPlanTempo(tempo)}
                              className={`rounded-full px-4 py-2 text-sm font-bold transition ${planTempo === tempo ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}
                            >
                              {tempo}
                            </button>
                          ))}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                          {activeModeMeta && <span className="ios-button rounded-full px-3 py-1 font-bold text-slate-700">{activeModeMeta.title}</span>}
                          <span className="ios-button rounded-full px-3 py-1 font-bold text-slate-700">{TEMPO_LIMITS[planTempo]} konu</span>
                          <button onClick={() => setMode('select_type')} className="font-semibold text-primary-600">Sifirla</button>
                        </div>
                      </div>

                      {mode !== 'select_type' && (
                        <button onClick={async () => { await generatePlan(mode); setPlanBuilderOpen(false); }} disabled={isGeneratingPlan || !scheduleReady} className={`rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 transition ${(isGeneratingPlan || !scheduleReady) ? 'cursor-not-allowed bg-slate-400' : 'ios-button-active'}`}>
                          {isGeneratingPlan ? 'Plan oluşturuluyor...' : `Hafta ${nextWeek} planını oluştur`}
                        </button>
                      )}
                    </div>
                  </div>

                  {(mode === 'manual_normal' || mode === 'revision') && (
                    <div className="ios-widget rounded-[20px] p-4">
                <div className="mb-3 text-sm font-bold text-slate-800">Konu secimi</div>
                <div className="max-h-[320px] space-y-4 overflow-y-auto pr-1">
                  {subjects.map((subject) => (
                    <div key={subject} className="ios-widget rounded-2xl p-3">
                      <div className="mb-2 text-sm font-bold text-primary-700">{subject}</div>
                      {(safeCurriculum[subject] || []).map((unit) => (
                        <div key={`${subject}-${unit.name}`} className="ios-widget mb-3 rounded-2xl p-3">
                          <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{unit.name}</div>
                          <div className="space-y-2">
                            {(Array.isArray(unit.topics) ? unit.topics : []).map((topic) => {
                              const selected = !!selectedTopicMap[getTopicSelectionKey(subject, unit.name, topic.name)];
                              return (
                                <button
                                  key={`${subject}-${topic.name}`}
                                  type="button"
                                  onClick={() => toggleSelectedTopic(subject, unit.name, topic.name)}
                                  className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm transition ${selected ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}
                                >
                                  <span>{topic.name}</span>
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${selected ? 'bg-white/25 text-slate-900' : 'ios-button text-slate-500'}`}>{selected ? 'Seçildi' : 'Seç'}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {examEditorOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation">
                <div className="ios-card flex max-h-[min(34rem,calc(100dvh-2rem))] w-[min(42rem,100%)] flex-col overflow-hidden rounded-[28px]" role="dialog" aria-modal="true" aria-label="Sınav takvimi ekle">
                  <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
                        <Calendar className="h-4 w-4" />
                        Sınav Takvimi
                      </div>
                      <h3 className="mt-2 text-2xl font-black text-slate-900">Yaklaşan sınav ekle</h3>
                      <p className="mt-1 text-sm text-slate-500">Bu kayıt plan motorunda sınav baskısı olarak kullanılır.</p>
                    </div>
                    <button type="button" onClick={() => setExamEditorOpen(false)} className="ios-button flex h-11 w-11 items-center justify-center rounded-full text-slate-600" aria-label="Sınav formunu kapat">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="space-y-3 p-6">
                    <select value={selectedExamCourseId} onChange={(event) => setSelectedExamCourseId(event.target.value)} className="dr-form-field w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none">
                      <option value="">Ders seç</option>
                      {activeCourses.map((course) => (
                        <option key={course.id} value={course.id}>{course.name}</option>
                      ))}
                    </select>
                    <input value={examNameInput} onChange={(event) => setExamNameInput(event.target.value)} placeholder="Sınav adı" className="dr-form-field w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none" />
                    <input value={examDateInput} onChange={(event) => setExamDateInput(event.target.value)} type="date" className="dr-form-field w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none" />
                    <input value={examNoteInput} onChange={(event) => setExamNoteInput(event.target.value)} placeholder="Not (isteğe bağlı)" className="dr-form-field w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none" />
                    <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setExamEditorOpen(false)} className="ios-button rounded-2xl px-4 py-3 text-sm font-bold text-slate-700">Vazgeç</button>
                      <button type="button" onClick={() => { if (addExamSchedule()) setExamEditorOpen(false); }} className="ios-button-active inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-slate-900">
                        <PlusCircle className="h-4 w-4" />
                        Kaydet
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          {!activePlan ? (
            <div className="rounded-[22px] border border-dashed border-slate-300 bg-white/5 px-5 py-4 text-sm text-slate-500">
              Henüz kayıtlı haftalık plan yok. Plan zemini hazır olduğunda “Plan oluştur” ile çalışma blokları bu alana eklenecek.
            </div>
          ) : (
            <>
              {(weekTriggers.length > 0 || recommendedBlocks.length > 0 || pendingPlan) && (
                <div className="mb-4 grid gap-3 xl:grid-cols-[1.4fr_1fr]">
                  <div className="ios-widget ios-yellow rounded-[24px] p-4">
                    <div className="flex items-start gap-3">
                      <div className="ios-button rounded-2xl p-2 text-amber-700">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-black text-amber-900">Plan guncelleme merkezi</div>
                        <div className="mt-1 text-sm text-amber-800">
                          {recommendedBlocks.length > 0
                            ? `${recommendedBlocks.length} önerili blok hazır. Önce bekleyen sürüm oluşturulur, sonra ebeveyn onayı ile aktifleşir.`
                            : 'Bu hafta için risk veya program değişikliği bildirimi var.'}
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <div className="rounded-[18px] bg-white/55 px-3 py-2">
                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">1 Öneri</div>
                            <div className="mt-1 text-xs font-semibold text-amber-900">Risk, sınav veya program değişikliği yakalanır.</div>
                          </div>
                          <div className="rounded-[18px] bg-white/55 px-3 py-2">
                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">2 Bekleyen</div>
                            <div className="mt-1 text-xs font-semibold text-amber-900">Yeni sürüm çocuğa gitmeden ebeveyn onayına düşer.</div>
                          </div>
                          <div className="rounded-[18px] bg-white/55 px-3 py-2">
                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">3 Aktif</div>
                            <div className="mt-1 text-xs font-semibold text-amber-900">Onaylanınca eski sürüm geçmişe taşınır, yeni plan aktif olur.</div>
                          </div>
                        </div>
                        {recommendedBlockSummary.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {recommendedBlockSummary.map((item) => (
                              <span key={item.reason} className="rounded-full bg-white/65 px-3 py-1 text-xs font-bold text-amber-900">
                                {SOURCE_REASON_LABELS[item.reason]}: {item.count}
                              </span>
                            ))}
                          </div>
                        )}
                        {weekTriggers.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {weekTriggers.map((trigger) => (
                              <span key={trigger.id} className="ios-button rounded-full px-3 py-1 text-xs font-bold text-amber-800">
                                {trigger.reasonText}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="ios-widget rounded-[24px] p-4">
                    {!pendingPlan ? (
                      <>
                        <div className="text-sm font-black text-slate-900">Bekleyen sürüm yok</div>
                        <div className="mt-1 text-sm text-slate-600">Öneri hazırsa tek tıkla inceleme sürümü oluşturabilirsiniz.</div>
                        <button
                          onClick={createPendingPlanFromRecommendations}
                          disabled={recommendedBlocks.length === 0}
                          className={`mt-3 w-full rounded-2xl px-4 py-3 text-sm font-bold transition ${recommendedBlocks.length === 0 ? 'cursor-not-allowed bg-slate-400 text-white' : 'ios-button-active text-slate-900'}`}
                        >
                          Oneriyi onay kuyruğuna al
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-black text-slate-900">Bekleyen sürüm hazır</div>
                            <div className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                              v{getPlanVersion(pendingPlan)} / {getReasonLabel(pendingPlan.reason)}
                            </div>
                          </div>
                          <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-bold text-primary-700">Onay bekliyor</span>
                        </div>
                        <div className="mt-3 rounded-[18px] bg-white/60 px-3 py-2 text-xs font-semibold text-slate-600">
                          {getReasonDescription(pendingPlan.reason)} Onaylanana kadar çocuk tarafında mevcut aktif plan görünmeye devam eder.
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-[18px] bg-white/60 px-2 py-2">
                            <div className="text-[10px] font-black uppercase text-slate-400">Mevcut</div>
                            <div className="mt-1 text-sm font-black text-slate-900">{activePlanTaskCount}</div>
                          </div>
                          <div className="rounded-[18px] bg-white/60 px-2 py-2">
                            <div className="text-[10px] font-black uppercase text-slate-400">Yeni</div>
                            <div className="mt-1 text-sm font-black text-slate-900">{pendingPlanTaskCount}</div>
                          </div>
                          <div className="rounded-[18px] bg-white/60 px-2 py-2">
                            <div className="text-[10px] font-black uppercase text-slate-400">Ek blok</div>
                            <div className="mt-1 text-sm font-black text-slate-900">+{pendingPlanAddedTaskCount}</div>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          {collectPlanTasks(pendingPlan)
                            .filter(({ task }) => recommendedBlocks.some((block) => block.id === task.id))
                            .slice(0, 3)
                            .map(({ task, subject, topicName }) => (
                              <div key={task.id} className="ios-widget rounded-2xl px-3 py-2 text-xs text-slate-700">
                                <div><span className="font-bold text-slate-900">{task.day} {task.startTime}</span> / {subject} / {topicName}</div>
                                <div className="mt-1 font-semibold text-slate-500">{getTaskSourceDescription(task.source)}</div>
                              </div>
                            ))}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={rejectPendingPlan}
                            disabled={isApplyingPendingPlan}
                            className="ios-button flex-1 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700"
                          >
                            Reddet
                          </button>
                          <button
                            onClick={approvePendingPlan}
                            disabled={isApplyingPendingPlan}
                            className={`flex-1 rounded-2xl px-4 py-3 text-sm font-bold ${isApplyingPendingPlan ? 'bg-slate-400 text-white' : 'ios-button-active text-slate-900'}`}
                          >
                            {isApplyingPendingPlan ? 'Onaylaniyor...' : 'Onayla ve aktiflestir'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="ios-widget mb-4 rounded-[24px] px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="mt-1 text-lg font-black text-slate-900">{activePlan.type === 'revision' ? 'Tekrar Haftasi' : 'Normal Hafta'}</div>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">Aktif plan</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      <span className="ios-button rounded-full px-3 py-1 font-bold text-slate-700">v{getPlanVersion(activePlan)}</span>
                      <span className="ios-button rounded-full px-3 py-1 font-bold text-slate-700">{getReasonLabel(activePlan.reason)}</span>
                      <span className="ios-button rounded-full px-3 py-1 font-bold text-slate-700">Olusturma {formatDateLabel(activePlan.generatedAt?.slice(0, 10))}</span>
                      {activePlan.approvedAt && <span className="ios-button rounded-full px-3 py-1 font-bold text-slate-700">Onay {formatDateLabel(activePlan.approvedAt.slice(0, 10))}</span>}
                    </div>
                    <div className="mt-2 max-w-2xl text-sm font-semibold text-slate-600">{getReasonDescription(activePlan.reason)}</div>
                  </div>
                  <div className="ios-widget rounded-2xl px-4 py-3 text-sm text-slate-600">
                    Bu haftadaki görevler gün gün ve saat saat listelenir.
                  </div>
                </div>
                {activeWeekPlanHistory.length > 1 && (
                  <div className="mt-4 rounded-[20px] bg-white/45 p-3">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Plan gecmisi</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {activeWeekPlanHistory.slice(0, 4).map((plan) => {
                        const status = getPlanStatus(plan);
                        return (
                          <span key={plan.id || `${plan.week}-${getPlanVersion(plan)}-${status}`} className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-slate-700">
                            v{getPlanVersion(plan)} / {PLAN_STATUS_LABELS[status]} / {getReasonLabel(plan.reason)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {DAYS.map((dayName) => {
                  const tasksForDay = plannedTasksByDay[dayName] || [];
                  const dayExpanded = Boolean(expandedPlanDays[dayName]);
                  const visibleTasksForDay = dayExpanded ? tasksForDay : tasksForDay.slice(0, PLAN_DAY_TASK_PREVIEW_LIMIT);
                  const scheduleForDay = resolveScheduleDay(activePlan.schedule[dayName]);

                  return (
                    <div key={dayName} className="ios-widget min-h-[220px] rounded-[24px] p-4">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-black text-slate-900">{dayName}</div>
                          <div className="text-xs text-slate-500">{tasksForDay.length === 0 ? 'Planlanmış görev yok' : `${tasksForDay.length} çalışma bloğu`}</div>
                        </div>
                        <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${scheduleForDay.confirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {scheduleForDay.confirmed ? 'Hazır' : 'Taslak'}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {tasksForDay.length === 0 ? (
                          <div className="ios-widget rounded-2xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">Bu gün için planlanmış görev yok.</div>
                        ) : (
                          <>
                            {visibleTasksForDay.map((task) => (
                              <div key={task.id} className="ios-widget rounded-2xl border-l-4 border-primary-500 px-3 py-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-primary-700">{task.startTime} - {task.endTime}</div>
                                    <div className="mt-1 text-sm font-bold text-slate-900">{task.subject}</div>
                                    <div className="mt-1 text-xs text-slate-500">{task.type}{task.duration ? ` / ${task.duration} dk` : ''}</div>
                                    <div className="mt-2 rounded-[14px] bg-white/60 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600">
                                      {task.source || 'Haftalık plan'}: {getTaskSourceDescription(task.source)}
                                    </div>
                                  </div>
                                  {task.completed ? (
                                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">Tamamlandı</span>
                                  ) : (
                                    <button onClick={() => startEditTask(task)} className="ios-button rounded-full px-3 py-1 text-[10px] font-bold text-slate-700">
                                      Düzenle
                                    </button>
                                  )}
                                </div>

                                {editingTaskId === task.id && (
                                  <div className="ios-widget mt-3 grid gap-2 rounded-[18px] p-3">
                                    <input value={editSource} onChange={(event) => setEditSource(event.target.value)} placeholder="Kaynak" className="dr-form-field rounded-2xl px-3 py-2 text-sm outline-none" />
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      <input value={editDuration} onChange={(event) => setEditDuration(event.target.value)} type="number" min="1" placeholder="Süre" className="dr-form-field rounded-2xl px-3 py-2 text-sm outline-none" />
                                      <input value={editQuestionCount} onChange={(event) => setEditQuestionCount(event.target.value)} type="number" min="0" placeholder="Soru sayisi" className="dr-form-field rounded-2xl px-3 py-2 text-sm outline-none" />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                      <button onClick={() => setEditingTaskId(null)} className="ios-button rounded-2xl px-4 py-2 text-sm font-bold text-slate-700">Vazgeç</button>
                                      <button onClick={saveEditedTask} className="ios-button-active rounded-2xl px-4 py-2 text-sm font-bold">Kaydet</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                            {tasksForDay.length > PLAN_DAY_TASK_PREVIEW_LIMIT && (
                              <button
                                type="button"
                                onClick={() => setExpandedPlanDays((current) => ({ ...current, [dayName]: !current[dayName] }))}
                                className="ios-button w-full rounded-2xl px-3 py-2 text-xs font-bold text-slate-700"
                              >
                                {dayExpanded ? 'Daha az göster' : `${tasksForDay.length - PLAN_DAY_TASK_PREVIEW_LIMIT} blok daha`}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
      </div>
    </section>
  );
};

export default PlanningPanel;
