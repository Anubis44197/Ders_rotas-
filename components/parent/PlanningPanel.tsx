import React, { useEffect, useMemo, useState } from 'react';
import type { Course, ExamScheduleEntry, PlanBlockRecord, PlanningEngineSnapshot, StoredStudyPlan, StudyPlan, SubjectCurriculum, SubjectPlanTask, Task, WeeklySchedule } from '../../types';
import { AlertTriangle, Calendar, CheckCircle, PlusCircle, Sparkles, Trash2 } from '../icons';
import { createWeeklyPlanDraft } from '../../utils/planEngine';

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

const DAYS = ['Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma', 'Cumartesi', 'Pazar'];
const TEMPO_LIMITS: Record<PlanTempo, number> = { Hafif: 5, Orta: 8, Yogun: 12 };
const TEMPO_LABELS: Record<PlanTempo, string> = {
  Hafif: 'Daha az konu, daha sakin tempo',
  Orta: 'Dengeli ilerleme ve tekrar',
  Yogun: 'Daha fazla konu ve daha siki program',
};
const MODE_META: Record<Exclude<PlanMode, 'select_type'>, { title: string; description: string; badge: string }> = {
  ai_normal: {
    title: 'Normal Hafta - Akilli Dagitim',
    description: 'Acik konulari haftalik programa gore otomatik dagitir.',
    badge: 'Otomatik',
  },
  manual_normal: {
    title: 'Normal Hafta - Konu Secimli',
    description: 'Bu hafta islenecek konulari sen secersin, sistem plana donusturur.',
    badge: 'Secimli',
  },
  revision: {
    title: 'Sinav / Tekrar Haftasi',
    description: 'Secili konulardan tekrar ve kapatma plani olusturur.',
    badge: 'Tekrar',
  },
};

const PLAN_REASON_LABELS: Record<NonNullable<StoredStudyPlan['reason']>, string> = {
  'initial-plan': 'Ilk plan',
  'performance-drop': 'Performans dususu',
  'revision-needed': 'Tekrar ihtiyaci',
  'exam-pressure': 'Sinav baskisi',
  'schedule-change': 'Program degisikligi',
  'manual-parent-update': 'Ebeveyn onayi bekliyor',
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
  confirmed: false,
});

const resolveScheduleDay = (value: WeeklySchedule[string] | string | undefined) => {
  if (!value) return createEmptyScheduleDay();
  if (typeof value === 'string') return createEmptyScheduleDay();
  return {
    slots: Array.isArray(value.slots) ? value.slots : [],
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
    ? 'Telafi blogu'
    : block.sourceReason === 'exam-trigger'
      ? 'Sinav onceligi'
      : block.sourceReason === 'revision-trigger'
        ? 'Risk / tekrar'
        : block.sourceReason === 'manual-parent'
          ? 'Manuel guncelleme'
          : 'Haftalik plan',
  completed: false,
});

const getReasonLabel = (reason?: StoredStudyPlan['reason']) => (reason ? PLAN_REASON_LABELS[reason] : 'Plan guncellemesi');

const REPLAN_SEVERITY_META: Record<PlanningEngineSnapshot['replanTriggers'][number]['severity'], { label: string; tone: string }> = {
  low: {
    label: 'Dusuk',
    tone: 'bg-emerald-100 text-emerald-700',
  },
  medium: {
    label: 'Orta',
    tone: 'bg-amber-100 text-amber-700',
  },
  high: {
    label: 'Yuksek',
    tone: 'bg-rose-100 text-rose-700',
  },
};

const formatDateTime = (value?: string) => {
  if (!value) return 'Zaman bilgisi yok';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Zaman bilgisi yok';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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
  Object.entries(plan.plan).flatMap(([subject, subjectPlan]) =>
    subjectPlan.units.flatMap((unit) =>
      unit.topics.flatMap((topic) =>
        topic.tasks.map((task) => ({ subject, unitName: unit.name, topicName: topic.name, task })),
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
  const [mode, setMode] = useState<PlanMode>('select_type');
  const [planTempo, setPlanTempo] = useState<PlanTempo>('Orta');
  const [selectedTopicMap, setSelectedTopicMap] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');
  const [activeWeek, setActiveWeek] = useState<number>(studyPlans.length > 0 ? Math.max(...studyPlans.map((item) => item.week)) : 0);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editSource, setEditSource] = useState('');
  const [editDuration, setEditDuration] = useState('40');
  const [editQuestionCount, setEditQuestionCount] = useState('20');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isApplyingPendingPlan, setIsApplyingPendingPlan] = useState(false);
  const [selectedExamCourseId, setSelectedExamCourseId] = useState('');
  const [examNameInput, setExamNameInput] = useState('');
  const [examDateInput, setExamDateInput] = useState('');
  const [examNoteInput, setExamNoteInput] = useState('');

  const subjects = useMemo(() => Object.keys(curriculum || {}), [curriculum]);
  const sortedPlans = useMemo(() => [...studyPlans].sort(sortStoredPlans), [studyPlans]);
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

  const activePlanVersion = activePlan ? getPlanVersion(activePlan) : 1;
  const activePlanRecord = useMemo(() => {
    if (!activePlan) return null;
    return planningEngineSnapshot.studyPlanRecords.find((record) => record.weekKey === `week-${activePlan.week}` && record.version === activePlanVersion)
      || planningEngineSnapshot.studyPlanRecords.find((record) => record.status === 'active' && record.weekKey === `week-${activePlan.week}`)
      || null;
  }, [planningEngineSnapshot.studyPlanRecords, activePlan, activePlanVersion]);
  const weekTriggers = useMemo(() => (
    activePlan
      ? planningEngineSnapshot.replanTriggers.filter((trigger) => trigger.id.includes(`week_${activePlan.week}`))
      : []
  ), [planningEngineSnapshot.replanTriggers, activePlan]);
  const recommendedBlocks = useMemo(() => {
    if (!activePlanRecord) return [];
    return planningEngineSnapshot.planBlockRecords
      .filter((block) => block.assignmentMode === 'recommended' && block.studyPlanId === activePlanRecord.id)
      .sort((left, right) => left.dayName.localeCompare(right.dayName) || left.startTime.localeCompare(right.startTime));
  }, [planningEngineSnapshot.planBlockRecords, activePlanRecord]);
  const activeWeekPlanHistory = useMemo(() => {
    if (!activePlan) return [];
    return sortedPlans
      .filter((item) => item.week === activePlan.week)
      .sort((left, right) => sortStoredPlans(right, left));
  }, [sortedPlans, activePlan]);
  const recentReplanTriggers = useMemo(() => (
    [...planningEngineSnapshot.replanTriggers]
      .sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''))
      .slice(0, 6)
  ), [planningEngineSnapshot.replanTriggers]);
  const sortedExamSchedules = useMemo(
    () => [...examScheduleEntries].sort((left, right) => left.date.localeCompare(right.date) || left.courseName.localeCompare(right.courseName)),
    [examScheduleEntries],
  );

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
      Object.entries(curriculum).flatMap(([subject, units]) =>
        units.flatMap((unit) =>
          unit.topics.map((topic) => ({
            subject,
            unitName: unit.name,
            topicName: topic.name,
            completed: topic.completed,
          })),
        ),
      ),
    [curriculum],
  );

  const selectedTopicCount = Object.values(selectedTopicMap).filter(Boolean).length;
  const confirmedScheduleDays = useMemo(() => DAYS.filter((day) => resolveScheduleDay(weeklySchedule[day]).confirmed), [weeklySchedule]);
  const daysWithSlots = useMemo(() => DAYS.filter((day) => resolveScheduleDay(weeklySchedule[day]).slots.length > 0), [weeklySchedule]);
  const hasPendingScheduleApproval = useMemo(() => DAYS.some((day) => {
    const dayState = resolveScheduleDay(weeklySchedule[day]);
    return dayState.slots.length > 0 && !dayState.confirmed;
  }), [weeklySchedule]);
  const scheduleReady = confirmedScheduleDays.length > 0 && !hasPendingScheduleApproval;
  const activeModeMeta = mode === 'select_type' ? null : MODE_META[mode];

  const plannedTasksByDay = useMemo(() => {
    const emptyDays = Object.fromEntries(DAYS.map((day) => [day, [] as Array<SubjectPlanTask & { subject: string; unitName: string; topicName: string }>])) as Record<string, Array<SubjectPlanTask & { subject: string; unitName: string; topicName: string }>>;
    if (!activePlan) return emptyDays;

    const allTasks = Object.entries(activePlan.plan)
      .flatMap(([subject, subjectPlan]) =>
        subjectPlan.units.flatMap((unit) =>
          unit.topics.flatMap((topic) =>
            topic.tasks.map((task) => {
              const linkedTask = tasks.find((entry) => entry.planTaskId === task.id);
              return { ...task, subject, unitName: unit.name, topicName: topic.name, completed: linkedTask ? linkedTask.status === 'tamamlandı' : task.completed };
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
  }, [activePlan, tasks]);

  const resetSelection = () => {
    setSelectedTopicMap({});
    setMessage('');
  };

  const chooseMode = (nextMode: Exclude<PlanMode, 'select_type'>) => {
    setMode(nextMode);
    setMessage('');
  };

  const addExamSchedule = () => {
    const course = courses.find((item) => item.id === selectedExamCourseId);
    if (!course || !examNameInput.trim() || !examDateInput) {
      setMessage('Sinav takvimi eklemek icin ders, sinav adi ve tarih secmelisiniz.');
      return;
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
    setMessage('Sinav takvimi guncellendi.');
  };

  const removeExamSchedule = (examId: string) => {
    onChangeExamSchedules((prev) => prev.filter((item) => item.id !== examId));
    setMessage('Sinav kaydi kaldirildi.');
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
      setMessage('Plan olusturmadan once haftalik ders akisindaki girilen gunleri onaylamalisiniz.');
      return;
    }

    const candidateTopics = collectCandidateTopics(targetMode);
    if (candidateTopics.length === 0) {
      setMessage(targetMode === 'ai_normal' ? 'Acik konu bulunamadi.' : 'Plan uretmek icin konu secmelisiniz.');
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
        snapshot: planningEngineSnapshot,
        weeklySchedule,
      });

      for (const draft of draftBlocks) {
        const type = mapBlockTypeToDisplayType(draft.blockType);
        const course = courses.find((entry) => normalize(entry.name) === normalize(draft.subject));
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

        const taskExistsBefore = tasks.some((entry) => entry.planTaskId === draft.id);
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
          setMessage(`Plan uretilemedi. Ders listesinde eslesmeyen mufredat alanlari: ${Array.from(unmatchedSubjects).join(', ')}.`);
          return;
        }
        setMessage('Plan uretilemedi. Ders eslesmeleri kontrol edilmeli.');
        return;
      }

      const storedPlan: StoredStudyPlan = {
        id: `study_plan_week_${week}_v1_${Date.now()}`,
        week,
        version: 1,
        plan,
        schedule: weeklySchedule,
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
      const unmatchedMessage = unmatchedSubjects.size > 0 ? ` Eslesmeyen dersler atlandi: ${Array.from(unmatchedSubjects).join(', ')}.` : '';
      setMessage(`Hafta ${week} plani olusturuldu.${unmatchedMessage}`);
    } catch (error) {
      // Roll back only tasks created in this generation attempt.
      createdTaskIds.forEach((taskId) => deleteTask(taskId));
      console.error('Plan olusturma hatasi, olusturulan gorevler geri alindi:', error);
      setMessage('Plan olusturulamadi. Islem geri alindi, tekrar deneyin.');
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
    const topicLookup = new Map(planningEngineSnapshot.curriculumTopics.map((topic) => [topic.id, topic]));

    recommendedBlocks.forEach((block) => {
      const topicRecord = block.topicId ? topicLookup.get(block.topicId) : undefined;
      const unitName = topicRecord?.unitName || 'Ek bloklar';
      const topicName = block.topicName || 'Ek calisma';

      if (!nextPlan.plan[block.courseName]) {
        nextPlan.plan[block.courseName] = { units: [] };
      }

      let unit = nextPlan.plan[block.courseName].units.find((entry) => entry.name === unitName);
      if (!unit) {
        unit = { name: unitName, topics: [] };
        nextPlan.plan[block.courseName].units.push(unit);
      }

      let topic = unit.topics.find((entry) => entry.name === topicName);
      if (!topic) {
        topic = { name: topicName, tasks: [] };
        unit.topics.push(topic);
      }

      if (!topic.tasks.some((task) => task.id === block.id)) {
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
      schedule: weeklySchedule,
    };

    onChangePlans((prev) => {
      const next = clonePlans(prev).filter((item) => !(getPlanStatus(item) === 'pending-approval' && item.week === activePlan.week));
      next.push(pendingPlanDraft);
      return next;
    });
    setMessage(`Hafta ${activePlan.week} icin onay bekleyen plan surumu hazirlandi.`);
  };

  const rejectPendingPlan = () => {
    if (!pendingPlan) return;
    onChangePlans((prev) => clonePlans(prev).filter((item) => item.id !== pendingPlan.id));
    setMessage(`Bekleyen plan surumu kaldirildi.`);
  };

  const approvePendingPlan = async () => {
    if (!pendingPlan || isApplyingPendingPlan) return;

    setIsApplyingPendingPlan(true);
    const createdTaskIds: string[] = [];

    try {
      const planTasksToCreate = collectPlanTasks(pendingPlan)
        .filter(({ task }) => !tasks.some((entry) => entry.planTaskId === task.id));

      for (const item of planTasksToCreate) {
        const course = courses.find((entry) => normalize(entry.name) === normalize(item.subject));
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
      setMessage(`Hafta ${pendingPlan.week} bekleyen plani onaylandi ve aktiflesti.`);
    } catch (error) {
      createdTaskIds.forEach((taskId) => deleteTask(taskId));
      console.error('Bekleyen plan onaylanirken hata olustu:', error);
      setMessage('Bekleyen plan onaylanamadi. Olusturulan gorevler geri alindi.');
    } finally {
      setIsApplyingPendingPlan(false);
    }
  };

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-primary-600">
            <Sparkles className="h-4 w-4" />
            Planlama Motoru
          </div>
          <h2 className="mt-2 text-3xl font-black text-slate-900">Haftalik calisma plani</h2>
        </div>
        <div className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${scheduleReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {scheduleReady ? `${confirmedScheduleDays.length} gun hazir` : 'Program onayi bekliyor'}
        </div>
      </div>

      {!scheduleReady && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Planlama motoru simdilik beklemede. {daysWithSlots.length === 0 ? 'Once haftalik ders akisina en az bir ders blogu girin.' : 'Girdiginiz gunleri onaylamadan plan olusturulamaz.'}
        </div>
      )}

      <div className="space-y-6">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Calendar className="h-4 w-4 text-primary-600" />
                  Haftalik planlar
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-slate-100 p-1">
                <button
                  onClick={() => {
                    if (activeWeekIndex <= 0) return;
                    setActiveWeek(existingWeeks[activeWeekIndex - 1]);
                  }}
                  disabled={activeWeekIndex <= 0}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
                >
                  Geri
                </button>
                <span className="min-w-[96px] text-center text-sm font-bold text-slate-800">{activeWeek > 0 ? `Hafta ${activeWeek}` : 'Plan yok'}</span>
                <button
                  onClick={() => {
                    if (activeWeekIndex < 0 || activeWeekIndex >= existingWeeks.length - 1) return;
                    setActiveWeek(existingWeeks[activeWeekIndex + 1]);
                  }}
                  disabled={activeWeekIndex < 0 || activeWeekIndex >= existingWeeks.length - 1}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
                >
                  Ileri
                </button>
              </div>
            </div>

            <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(MODE_META) as Array<Exclude<PlanMode, 'select_type'>>).map((key) => {
                      const active = mode === key;
                      return (
                        <button
                          key={key}
                          onClick={() => chooseMode(key)}
                          className={`rounded-full border px-4 py-2 text-sm font-bold transition ${active ? 'border-primary-500 bg-primary-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
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
                        className={`rounded-full border px-4 py-2 text-sm font-bold transition ${planTempo === tempo ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                      >
                        {tempo}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                    {activeModeMeta && <span className="rounded-full bg-white px-3 py-1 font-bold text-slate-700">{activeModeMeta.title}</span>}
                    <span className="rounded-full bg-white px-3 py-1 font-bold text-slate-700">{TEMPO_LIMITS[planTempo]} konu</span>
                    <button onClick={() => setMode('select_type')} className="font-semibold text-primary-600">Sifirla</button>
                  </div>
                </div>

                {mode !== 'select_type' && (
                  <button onClick={() => generatePlan(mode)} disabled={isGeneratingPlan || !scheduleReady} className={`rounded-2xl px-4 py-3 text-sm font-bold text-white transition ${(isGeneratingPlan || !scheduleReady) ? 'cursor-not-allowed bg-slate-400' : 'bg-primary-600 hover:bg-primary-700'}`}>
                    {isGeneratingPlan ? 'Plan olusturuluyor...' : `Hafta ${nextWeek} planini olustur`}
                  </button>
                )}
              </div>
            </div>

            {(mode === 'manual_normal' || mode === 'revision') && (
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 text-sm font-bold text-slate-800">Konu secimi</div>
                <div className="max-h-[320px] space-y-4 overflow-y-auto pr-1">
                  {subjects.map((subject) => (
                    <div key={subject} className="rounded-2xl bg-white p-3">
                      <div className="mb-2 text-sm font-bold text-primary-700">{subject}</div>
                      {(curriculum[subject] || []).map((unit) => (
                        <div key={`${subject}-${unit.name}`} className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{unit.name}</div>
                          <div className="space-y-2">
                            {unit.topics.map((topic) => {
                              const selected = !!selectedTopicMap[getTopicSelectionKey(subject, unit.name, topic.name)];
                              return (
                                <button
                                  key={`${subject}-${topic.name}`}
                                  type="button"
                                  onClick={() => toggleSelectedTopic(subject, unit.name, topic.name)}
                                  className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm transition ${selected ? 'bg-primary-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
                                >
                                  <span>{topic.name}</span>
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${selected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{selected ? 'Secildi' : 'Sec'}</span>
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

            {message && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>}
          </div>

          <div className="mb-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <Calendar className="h-4 w-4 text-primary-600" />
                  Sinav takvimi
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Exam pressure artik once bu takvimden hesaplanir. Yaklasan sinavlari burada yonetebilirsiniz.
                </div>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">
                {sortedExamSchedules.length} kayit
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_180px]">
              <select value={selectedExamCourseId} onChange={(event) => setSelectedExamCourseId(event.target.value)} className="rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100">
                <option value="">Ders sec</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.name}</option>
                ))}
              </select>
              <input value={examNameInput} onChange={(event) => setExamNameInput(event.target.value)} placeholder="Sinav adi" className="rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
              <input value={examDateInput} onChange={(event) => setExamDateInput(event.target.value)} type="date" className="rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
            </div>
            <div className="mt-3 flex flex-col gap-3 lg:flex-row">
              <input value={examNoteInput} onChange={(event) => setExamNoteInput(event.target.value)} placeholder="Not (istege bagli)" className="flex-1 rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
              <button onClick={addExamSchedule} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800">
                <PlusCircle className="h-4 w-4" />
                Sinav ekle
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {sortedExamSchedules.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                  Henuz tanimli bir sinav kaydi yok.
                </div>
              ) : (
                sortedExamSchedules.map((exam) => (
                  <div key={exam.id} className="flex flex-col gap-3 rounded-2xl bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-sm font-black text-slate-900">
                        <span>{exam.courseName}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">{formatDateLabel(exam.date)}</span>
                      </div>
                      <div className="mt-1 text-sm text-slate-700">{exam.examName}</div>
                      {exam.note && <div className="mt-1 text-xs text-slate-500">{exam.note}</div>}
                    </div>
                    <button onClick={() => removeExamSchedule(exam.id)} className="inline-flex items-center gap-2 self-start rounded-2xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 lg:self-auto">
                      <Trash2 className="h-4 w-4" />
                      Kaldir
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {!activePlan ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
              Henuz kayitli bir haftalik plan yok.
            </div>
          ) : (
            <>
              {(weekTriggers.length > 0 || recommendedBlocks.length > 0 || pendingPlan) && (
                <div className="mb-4 grid gap-3 xl:grid-cols-[1.4fr_1fr]">
                  <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl bg-white p-2 text-amber-700">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-black text-amber-900">Plan guncelleme merkezi</div>
                        <div className="mt-1 text-sm text-amber-800">
                          {recommendedBlocks.length > 0
                            ? `${recommendedBlocks.length} onerili blok hazir. Once bekleyen surum olusturulur, sonra ebeveyn onayi ile aktiflesir.`
                            : 'Bu hafta icin risk veya program degisikligi bildirimi var.'}
                        </div>
                        {weekTriggers.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {weekTriggers.map((trigger) => (
                              <span key={trigger.id} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-800">
                                {trigger.reasonText}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    {!pendingPlan ? (
                      <>
                        <div className="text-sm font-black text-slate-900">Bekleyen surum yok</div>
                        <div className="mt-1 text-sm text-slate-600">Oneri hazirsa tek tikla inceleme surumu olusturabilirsiniz.</div>
                        <button
                          onClick={createPendingPlanFromRecommendations}
                          disabled={recommendedBlocks.length === 0}
                          className={`mt-3 w-full rounded-2xl px-4 py-3 text-sm font-bold text-white transition ${recommendedBlocks.length === 0 ? 'cursor-not-allowed bg-slate-400' : 'bg-slate-900 hover:bg-slate-800'}`}
                        >
                          Oneriyi onay kuyruğuna al
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-black text-slate-900">Bekleyen surum hazir</div>
                            <div className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                              v{getPlanVersion(pendingPlan)} • {getReasonLabel(pendingPlan.reason)}
                            </div>
                          </div>
                          <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-bold text-primary-700">Onay bekliyor</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {collectPlanTasks(pendingPlan)
                            .filter(({ task }) => recommendedBlocks.some((block) => block.id === task.id))
                            .slice(0, 3)
                            .map(({ task, subject, topicName }) => (
                              <div key={task.id} className="rounded-2xl bg-white px-3 py-2 text-xs text-slate-700">
                                <span className="font-bold text-slate-900">{task.day} {task.startTime}</span> • {subject} • {topicName}
                              </div>
                            ))}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={rejectPendingPlan}
                            disabled={isApplyingPendingPlan}
                            className="flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-700"
                          >
                            Reddet
                          </button>
                          <button
                            onClick={approvePendingPlan}
                            disabled={isApplyingPendingPlan}
                            className={`flex-1 rounded-2xl px-4 py-3 text-sm font-bold text-white ${isApplyingPendingPlan ? 'bg-slate-400' : 'bg-primary-600 hover:bg-primary-700'}`}
                          >
                            {isApplyingPendingPlan ? 'Onaylaniyor...' : 'Onayla ve aktiflestir'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="mb-4 grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <CheckCircle className="h-4 w-4 text-primary-600" />
                    Plan gecmisi
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Bu hafta icin olusan surumler ve neden degistigi burada gorunur.
                  </div>
                  <div className="mt-4 space-y-3">
                    {activeWeekPlanHistory.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                        Bu hafta icin kayitli surum bulunmuyor.
                      </div>
                    ) : (
                      activeWeekPlanHistory.map((planItem) => {
                        const status = getPlanStatus(planItem);
                        const statusTone = status === 'active'
                          ? 'bg-emerald-100 text-emerald-700'
                          : status === 'pending-approval'
                            ? 'bg-primary-100 text-primary-700'
                            : 'bg-slate-200 text-slate-700';

                        return (
                          <div key={planItem.id || `${planItem.week}-${getPlanVersion(planItem)}`} className="rounded-2xl bg-white px-4 py-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2 text-sm font-black text-slate-900">
                                  <span>Hafta {planItem.week}</span>
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">v{getPlanVersion(planItem)}</span>
                                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone}`}>
                                    {status === 'active' ? 'Aktif' : status === 'pending-approval' ? 'Onay bekliyor' : 'Arsiv'}
                                  </span>
                                </div>
                                <div className="mt-2 text-sm text-slate-700">{getReasonLabel(planItem.reason)}</div>
                              </div>
                              <div className="text-right text-xs text-slate-500">
                                <div>Uretildi: {formatDateTime(planItem.generatedAt)}</div>
                                {planItem.approvedAt && <div className="mt-1">Onay: {formatDateTime(planItem.approvedAt)}</div>}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Risk uyari merkezi
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Son tetiklenen riskler ve plani neden etkiledigi burada toplanir.
                  </div>
                  <div className="mt-4 space-y-3">
                    {recentReplanTriggers.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                        Henuz aktif risk tetigi yok.
                      </div>
                    ) : (
                      recentReplanTriggers.map((trigger) => {
                        const severityMeta = REPLAN_SEVERITY_META[trigger.severity];
                        return (
                          <div key={trigger.id} className="rounded-2xl bg-white px-4 py-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
                                  <span>{trigger.reasonText}</span>
                                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${severityMeta.tone}`}>{severityMeta.label}</span>
                                </div>
                                <div className="mt-2 text-xs text-slate-500">
                                  {trigger.relatedCourseId ? `Ders: ${trigger.relatedCourseId}` : 'Genel plan etkisi'}
                                </div>
                              </div>
                              <div className="text-xs text-slate-500">{formatDateTime(trigger.createdAt)}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-4 rounded-[24px] bg-slate-50 px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="mt-1 text-lg font-black text-slate-900">{activePlan.type === 'revision' ? 'Tekrar Haftasi' : 'Normal Hafta'}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-white px-3 py-1 font-bold text-slate-700">v{getPlanVersion(activePlan)}</span>
                      <span className="rounded-full bg-white px-3 py-1 font-bold text-slate-700">{getReasonLabel(activePlan.reason)}</span>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">
                    Bu haftadaki gorevler gun gun ve saat saat listelenir.
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {DAYS.map((dayName) => {
                  const tasksForDay = plannedTasksByDay[dayName] || [];
                  const scheduleForDay = resolveScheduleDay(activePlan.schedule[dayName]);

                  return (
                    <div key={dayName} className="min-h-[220px] rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-black text-slate-900">{dayName}</div>
                          <div className="text-xs text-slate-500">{tasksForDay.length === 0 ? 'Planlanmis gorev yok' : `${tasksForDay.length} calisma blogu`}</div>
                        </div>
                        <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${scheduleForDay.confirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {scheduleForDay.confirmed ? 'Hazir' : 'Taslak'}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {tasksForDay.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">Bu gun icin planlanmis gorev yok.</div>
                        ) : (
                          tasksForDay.map((task) => (
                            <div key={task.id} className="rounded-2xl border-l-4 border-primary-500 bg-white px-3 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-primary-700">{task.startTime} - {task.endTime}</div>
                                  <div className="mt-1 text-sm font-bold text-slate-900">{task.subject}</div>
                                  <div className="mt-1 text-xs text-slate-500">{task.type}{task.duration ? ` • ${task.duration} dk` : ''}</div>
                                </div>
                                {task.completed ? (
                                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">Tamamlandi</span>
                                ) : (
                                  <button onClick={() => startEditTask(task)} className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-700">
                                    Duzenle
                                  </button>
                                )}
                              </div>

                              {editingTaskId === task.id && (
                                <div className="mt-3 grid gap-2 rounded-[18px] border border-slate-200 bg-slate-50 p-3">
                                  <input value={editSource} onChange={(event) => setEditSource(event.target.value)} placeholder="Kaynak" className="rounded-2xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <input value={editDuration} onChange={(event) => setEditDuration(event.target.value)} type="number" min="1" placeholder="Sure" className="rounded-2xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
                                    <input value={editQuestionCount} onChange={(event) => setEditQuestionCount(event.target.value)} type="number" min="0" placeholder="Soru sayisi" className="rounded-2xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <button onClick={() => setEditingTaskId(null)} className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">Vazgec</button>
                                    <button onClick={saveEditedTask} className="rounded-2xl bg-primary-600 px-4 py-2 text-sm font-bold text-white">Kaydet</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default PlanningPanel;








