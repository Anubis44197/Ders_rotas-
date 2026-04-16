import type { PlanningEngineSnapshot, PlanBlockType, WeeklySchedule, WeeklyScheduleSlot } from '../types';

export type PlanningMode = 'ai_normal' | 'manual_normal' | 'revision';
export type PlanningTempo = 'Hafif' | 'Orta' | 'Yogun';

export interface CandidateTopicInput {
  subject: string;
  unitName: string;
  topicName: string;
  completed: boolean;
}

export interface GeneratedPlanBlockDraft {
  id: string;
  subject: string;
  unitName: string;
  topicName: string;
  day: string;
  startTime: string;
  endTime: string;
  blockType: PlanBlockType;
  priorityScore: number;
  duration: number;
  questionCount: number | null;
  source: string;
}

interface PrioritizedTopic {
  subject: string;
  unitName: string;
  topicName: string;
  completed: boolean;
  status?: string;
  nextRecommendedAction?: 'learn' | 'revise' | 'practice' | 'assess';
  priorityScore: number;
}

const DAYS = ['Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma', 'Cumartesi', 'Pazar'];
const TEMPO_LIMITS: Record<PlanningTempo, number> = { Hafif: 5, Orta: 8, Yogun: 12 };

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

const toMinutes = (value: string) => {
  const [hourText, minuteText] = value.split(':');
  return Number(hourText) * 60 + Number(minuteText);
};

const fromMinutes = (value: number) => {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${`${hour}`.padStart(2, '0')}:${`${minute}`.padStart(2, '0')}`;
};

const getDailyBlockLimit = (dayName: string) => (dayName === 'Cumartesi' || dayName === 'Pazar' ? 4 : 3);

const getBlockTypeDuration = (blockType: PlanBlockType) => {
  switch (blockType) {
    case 'revision':
    case 'light_review':
    case 'compensation':
      return 30;
    case 'exam_prep':
      return 45;
    case 'assessment':
      return 35;
    default:
      return 40;
  }
};

const getTargetQuality = (blockType: PlanBlockType) => {
  switch (blockType) {
    case 'new_learning':
    case 'exam_prep':
      return 'deep';
    case 'revision':
    case 'question_practice':
    case 'assessment':
      return 'medium';
    default:
      return 'light';
  }
};

const resolveScheduleDay = (schedule: WeeklySchedule, dayName: string) => schedule[dayName] || { slots: [], confirmed: false };

const buildTopicLookupKey = (courseName: string, unitName: string, topicName: string) => `${normalize(courseName)}::${normalize(unitName)}::${normalize(topicName)}`;

const chooseBlockType = (
  mode: PlanningMode,
  topic: Pick<PrioritizedTopic, 'status' | 'nextRecommendedAction' | 'priorityScore'>,
  hasDeepWindow: boolean,
): PlanBlockType => {
  if (mode === 'revision') {
    if (topic.nextRecommendedAction === 'assess') return 'assessment';
    if (topic.priorityScore >= 50) return 'exam_prep';
    return 'revision';
  }

  if (topic.priorityScore >= 50) return 'exam_prep';
  if (topic.status === 'needs_revision' || topic.status === 'risky' || topic.nextRecommendedAction === 'revise') return 'revision';
  if (topic.nextRecommendedAction === 'assess') return 'assessment';
  if (topic.nextRecommendedAction === 'practice') return 'question_practice';
  if (topic.nextRecommendedAction === 'learn') return hasDeepWindow ? 'new_learning' : 'light_review';
  if (topic.status === 'in_progress') return 'question_practice';
  if (topic.status === 'new') return hasDeepWindow ? 'new_learning' : 'light_review';
  return topic.priorityScore >= 30 ? 'question_practice' : 'light_review';
};

const chooseQuestionCount = (blockType: PlanBlockType) => {
  switch (blockType) {
    case 'question_practice':
      return 20;
    case 'exam_prep':
      return 25;
    case 'assessment':
      return 12;
    default:
      return null;
  }
};

const chooseSourceLabel = (mode: PlanningMode, blockType: PlanBlockType) => {
  if (mode === 'revision') return 'Tekrar calismasi';
  if (blockType === 'exam_prep') return 'Sinav onceligi';
  if (blockType === 'assessment') return 'Olcme blogu';
  if (blockType === 'revision') return 'Risk / tekrar';
  if (blockType === 'new_learning') return 'Mufredat akisi';
  if (blockType === 'question_practice') return 'Akilli dagitim';
  return 'Haftalik plan';
};

const getStatusPriority = (status?: string) => {
  switch (status) {
    case 'risky':
      return { risk: 40, revision: 10 };
    case 'needs_revision':
      return { risk: 25, revision: 15 };
    case 'in_progress':
      return { risk: 15, revision: 5 };
    case 'stable':
      return { risk: 5, revision: 0 };
    default:
      return { risk: 10, revision: 0 };
  }
};

const getCurriculumScore = (sequenceOrder?: number) => {
  if (typeof sequenceOrder !== 'number') return 5;
  if (sequenceOrder <= 20) return 10;
  if (sequenceOrder <= 50) return 8;
  if (sequenceOrder <= 100) return 6;
  return 4;
};

const choosePreferredDays = (subject: string, weeklySchedule: WeeklySchedule) => {
  const normalizedSubject = normalize(subject);
  const matchingDays = DAYS.filter((dayName) => {
    const day = resolveScheduleDay(weeklySchedule, dayName);
    return day.confirmed && day.slots.some((slot: WeeklyScheduleSlot) => normalize(slot.courseName) === normalizedSubject);
  });

  if (matchingDays.length > 0) return matchingDays;
  return DAYS.filter((dayName) => resolveScheduleDay(weeklySchedule, dayName).confirmed);
};

const hasWindowForQuality = (snapshot: PlanningEngineSnapshot, dayName: string, quality: 'light' | 'medium' | 'deep') => {
  const scheduleDay = snapshot.scheduleDays.find((day) => day.dayName === dayName);
  return (scheduleDay?.availableWindows || []).some((window) => window.quality === quality);
};

const scoreWindowFit = (snapshot: PlanningEngineSnapshot, dayName: string, blockType: PlanBlockType) => {
  const targetQuality = getTargetQuality(blockType);
  const scheduleDay = snapshot.scheduleDays.find((day) => day.dayName === dayName);
  const windows = scheduleDay?.availableWindows || [];
  if (windows.some((window) => window.quality === targetQuality)) {
    return targetQuality === 'deep' ? 4 : targetQuality === 'medium' ? 3 : 2;
  }
  if (targetQuality === 'deep' && windows.some((window) => window.quality === 'medium')) return 1;
  return windows.length > 0 ? 1 : 0;
};

const chooseDayForTopic = (
  mode: PlanningMode,
  topic: PrioritizedTopic,
  snapshot: PlanningEngineSnapshot,
  weeklySchedule: WeeklySchedule,
  dayAssignments: Map<string, GeneratedPlanBlockDraft[]>,
) => {
  const preferredDays = choosePreferredDays(topic.subject, weeklySchedule);
  const hasDeepPreferredDay = preferredDays.some((dayName) => hasWindowForQuality(snapshot, dayName, 'deep'));
  const initialBlockType = chooseBlockType(mode, topic, hasDeepPreferredDay);
  const candidateDays = (preferredDays.length > 0 ? preferredDays : DAYS)
    .map((dayName) => {
      const draftsForDay = dayAssignments.get(dayName) || [];
      if (draftsForDay.length >= getDailyBlockLimit(dayName)) return null;
      if (getTargetQuality(initialBlockType) === 'deep') {
        const deepCount = draftsForDay.filter((draft) => getTargetQuality(draft.blockType) === 'deep').length;
        if (deepCount >= 1) return null;
      }

      const subjectMatch = resolveScheduleDay(weeklySchedule, dayName).slots.some((slot) => normalize(slot.courseName) === normalize(topic.subject));
      const loadPenalty = draftsForDay.length * 2;
      const windowFit = scoreWindowFit(snapshot, dayName, initialBlockType);
      return {
        dayName,
        score: (subjectMatch ? 4 : 0) + windowFit - loadPenalty,
      };
    })
    .filter((item): item is { dayName: string; score: number } => Boolean(item))
    .sort((left, right) => right.score - left.score);

  const fallbackDays = DAYS
    .map((dayName) => {
      const draftsForDay = dayAssignments.get(dayName) || [];
      if (draftsForDay.length >= getDailyBlockLimit(dayName)) return null;
      return {
        dayName,
        score: scoreWindowFit(snapshot, dayName, initialBlockType) - draftsForDay.length,
      };
    })
    .filter((item): item is { dayName: string; score: number } => Boolean(item))
    .sort((left, right) => right.score - left.score);

  const resolvedDay = candidateDays[0]?.dayName || fallbackDays[0]?.dayName || DAYS[0];

  return {
    chosenDay: resolvedDay,
    hasDeepWindow: hasWindowForQuality(snapshot, resolvedDay, 'deep'),
  };
};

const chooseTimeWindow = (
  snapshot: PlanningEngineSnapshot,
  weeklySchedule: WeeklySchedule,
  dayName: string,
  blockType: PlanBlockType,
  dailyDrafts: GeneratedPlanBlockDraft[],
) => {
  const scheduleDay = snapshot.scheduleDays.find((day) => day.dayName === dayName);
  const targetQuality = getTargetQuality(blockType);
  const duration = getBlockTypeDuration(blockType);
  const windows = scheduleDay?.availableWindows || [];
  const matchingWindows = windows.filter((window) => window.quality === targetQuality);
  const candidateWindows = matchingWindows.length > 0 ? matchingWindows : windows;

  for (const window of candidateWindows) {
    const windowStart = toMinutes(window.startTime);
    const windowEnd = toMinutes(window.endTime);
    const sameWindowDrafts = dailyDrafts.filter((draft) => {
      const start = toMinutes(draft.startTime);
      return start >= windowStart && start < windowEnd;
    });
    const slotStart = windowStart + sameWindowDrafts.length * (duration + 10);
    const slotEnd = slotStart + duration;
    if (slotEnd <= windowEnd) {
      return {
        startTime: fromMinutes(slotStart),
        endTime: fromMinutes(slotEnd),
        fatiguePenalty: window.quality === 'light' ? 15 : window.quality === 'medium' ? 8 : 0,
      };
    }
  }

  const schoolSlots = resolveScheduleDay(weeklySchedule, dayName).slots;
  const lastSchoolSlot = [...schoolSlots].sort((left, right) => left.endTime.localeCompare(right.endTime)).slice(-1)[0];
  const baseMinutes = Math.max(lastSchoolSlot ? toMinutes(lastSchoolSlot.endTime) + 30 : 16 * 60, 16 * 60);
  const startMinutes = baseMinutes + dailyDrafts.length * (duration + 10);
  return {
    startTime: fromMinutes(startMinutes),
    endTime: fromMinutes(startMinutes + duration),
    fatiguePenalty: 10,
  };
};

export const createWeeklyPlanDraft = ({
  mode,
  tempo,
  candidateTopics,
  snapshot,
  weeklySchedule,
}: {
  mode: PlanningMode;
  tempo: PlanningTempo;
  candidateTopics: CandidateTopicInput[];
  snapshot: PlanningEngineSnapshot;
  weeklySchedule: WeeklySchedule;
}): GeneratedPlanBlockDraft[] => {
  const curriculumTopicLookup = new Map(
    snapshot.curriculumTopics.map((topic) => [buildTopicLookupKey(topic.courseName, topic.unitName, topic.topicName), topic]),
  );
  const topicStatusLookup = new Map(snapshot.topicStatuses.map((status) => [status.topicId, status]));

  const prioritizedTopics: PrioritizedTopic[] = candidateTopics
    .map((topic) => {
      const curriculumTopic = curriculumTopicLookup.get(buildTopicLookupKey(topic.subject, topic.unitName, topic.topicName));
      const statusRecord = curriculumTopic ? topicStatusLookup.get(curriculumTopic.id) : undefined;
      const statusPriority = getStatusPriority(statusRecord?.status);
      const priorityScore = statusPriority.risk + statusPriority.revision + getCurriculumScore(curriculumTopic?.sequenceOrder);

      return {
        ...topic,
        status: statusRecord?.status,
        nextRecommendedAction: statusRecord?.nextRecommendedAction,
        priorityScore,
      };
    })
    .sort((left, right) => right.priorityScore - left.priorityScore)
    .slice(0, TEMPO_LIMITS[tempo]);

  const dayAssignments = new Map<string, GeneratedPlanBlockDraft[]>();
  DAYS.forEach((day) => dayAssignments.set(day, []));

  const drafts: GeneratedPlanBlockDraft[] = [];

  prioritizedTopics.forEach((topic, index) => {
    const { chosenDay, hasDeepWindow } = chooseDayForTopic(mode, topic, snapshot, weeklySchedule, dayAssignments);
    const draftsForDay = dayAssignments.get(chosenDay) || [];
    const blockType = chooseBlockType(mode, topic, hasDeepWindow);
    const timeWindow = chooseTimeWindow(snapshot, weeklySchedule, chosenDay, blockType, draftsForDay);
    const finalPriority = Math.max(0, topic.priorityScore - timeWindow.fatiguePenalty);
    const draft: GeneratedPlanBlockDraft = {
      id: `plan_block_${chosenDay}_${normalize(topic.subject)}_${normalize(topic.topicName)}_${index}`,
      subject: topic.subject,
      unitName: topic.unitName,
      topicName: topic.topicName,
      day: chosenDay,
      startTime: timeWindow.startTime,
      endTime: timeWindow.endTime,
      blockType,
      priorityScore: finalPriority,
      duration: getBlockTypeDuration(blockType),
      questionCount: chooseQuestionCount(blockType),
      source: chooseSourceLabel(mode, blockType),
    };

    draftsForDay.push(draft);
    dayAssignments.set(chosenDay, draftsForDay);
    drafts.push(draft);
  });

  return drafts;
};