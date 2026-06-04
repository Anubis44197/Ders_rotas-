import { getLocalDateString } from '../../utils/dateUtils';
import React, { useEffect, useMemo, useState } from 'react';
import type { Course, CurriculumUnit, ScheduleDayWindow, SubjectCurriculum, Task, WeeklySchedule, WeeklyScheduleSlot } from '../../types';
import { Calendar, CheckCircle, ClipboardList, Clock, PlusCircle, Trash2, X } from '../icons';
import ContextHelp from '../shared/ContextHelp';
import {
  formatTaskGoal,
  getTaskDateKey,
  normalizeForLookup,
  taskTypeKeyToTaskType,
  type TaskTypeKey,
} from './parentDashboardShared';

interface WeeklySchedulePanelProps {
  schedule: WeeklySchedule;
  courses: Course[];
  curriculum?: SubjectCurriculum;
  tasks?: Task[];
  addTask?: (task: Omit<Task, 'id' | 'status'>) => Promise<Task>;
  deleteTask?: (taskId: string) => void;
  onSave: (schedule: WeeklySchedule) => void;
  onAddExam?: () => void;
}

type EditorMode = 'school' | 'study';

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const QUALITY_META: Record<ScheduleDayWindow['quality'], { label: string; tone: string }> = {
  light: { label: 'Soru Çözümü & Pratik (Test)', tone: 'border-sky-400/40 text-slate-900 dark:text-white bg-sky-500/10' },
  medium: { label: 'Konu Çalışması & Tekrar', tone: 'border-indigo-400/40 text-slate-900 dark:text-white bg-indigo-500/10' },
  deep: { label: 'Deneme Sınavı (LGS / Branş) & Soru Analizi', tone: 'border-rose-400/40 text-slate-900 dark:text-white bg-rose-500/10' },
};

const getCourseStyle = (courseName: string): string => {
  const name = (courseName || '').trim().toLocaleLowerCase('tr-TR');
  if (name.includes('matematik')) {
    return 'border-indigo-400/40 text-slate-900 dark:text-white bg-indigo-500/10';
  }
  if (name.includes('turkce') || name.includes('türkçe')) {
    return 'border-emerald-400/40 text-slate-900 dark:text-white bg-emerald-500/10';
  }
  if (name.includes('fen')) {
    return 'border-purple-400/40 text-slate-900 dark:text-white bg-purple-500/10';
  }
  if (name.includes('inkilap') || name.includes('inkılap') || name.includes('tarih')) {
    return 'border-rose-400/40 text-slate-900 dark:text-white bg-rose-500/10';
  }
  if (name.includes('din') || name.includes('ahlak')) {
    return 'border-amber-400/40 text-slate-900 dark:text-white bg-amber-500/10';
  }
  if (name.includes('ingilizce') || name.includes('english')) {
    return 'border-sky-400/40 text-slate-900 dark:text-white bg-sky-500/10';
  }
  if (name.includes('paragraf')) {
    return 'border-teal-400/40 text-slate-900 dark:text-white bg-teal-500/10';
  }
  return 'border-blue-400/40 text-slate-900 dark:text-white bg-blue-500/10';
};

type CourseTaskVisual = {
  row: string;
  rail: string;
  pill: string;
  title: string;
  detail: string;
  meta: string;
};

const COURSE_TASK_VISUALS: Record<string, CourseTaskVisual> = {
  matematik: {
    row: 'border-indigo-400/28 bg-indigo-500/[0.14] shadow-[inset_0_1px_0_rgba(129,140,248,0.14)] hover:bg-indigo-500/[0.19]',
    rail: 'border-indigo-300/60 bg-indigo-400 shadow-[0_0_18px_rgba(129,140,248,0.32)]',
    pill: 'border-indigo-500/30 bg-indigo-100/80 text-indigo-800 dark:border-indigo-200/80 dark:bg-indigo-200/90 dark:text-slate-950',
    title: 'text-slate-950 dark:text-white',
    detail: 'text-slate-700 dark:text-slate-200',
    meta: 'text-slate-600 dark:text-slate-200',
  },
  turkce: {
    row: 'border-emerald-400/28 bg-emerald-500/[0.13] shadow-[inset_0_1px_0_rgba(52,211,153,0.14)] hover:bg-emerald-500/[0.18]',
    rail: 'border-emerald-300/60 bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.30)]',
    pill: 'border-emerald-500/30 bg-emerald-100/80 text-emerald-800 dark:border-emerald-200/80 dark:bg-emerald-200/90 dark:text-slate-950',
    title: 'text-slate-950 dark:text-white',
    detail: 'text-slate-700 dark:text-slate-200',
    meta: 'text-slate-600 dark:text-slate-200',
  },
  fen: {
    row: 'border-purple-400/28 bg-purple-500/[0.13] shadow-[inset_0_1px_0_rgba(192,132,252,0.14)] hover:bg-purple-500/[0.18]',
    rail: 'border-purple-300/60 bg-purple-400 shadow-[0_0_18px_rgba(192,132,252,0.30)]',
    pill: 'border-purple-500/30 bg-purple-100/80 text-purple-800 dark:border-purple-200/80 dark:bg-purple-200/90 dark:text-slate-950',
    title: 'text-slate-950 dark:text-white',
    detail: 'text-slate-700 dark:text-slate-200',
    meta: 'text-slate-600 dark:text-slate-200',
  },
  inkilap: {
    row: 'border-rose-400/28 bg-rose-500/[0.13] shadow-[inset_0_1px_0_rgba(251,113,133,0.14)] hover:bg-rose-500/[0.18]',
    rail: 'border-rose-300/60 bg-rose-400 shadow-[0_0_18px_rgba(251,113,133,0.30)]',
    pill: 'border-rose-500/30 bg-rose-100/80 text-rose-800 dark:border-rose-200/80 dark:bg-rose-200/90 dark:text-slate-950',
    title: 'text-slate-950 dark:text-white',
    detail: 'text-slate-700 dark:text-slate-200',
    meta: 'text-slate-600 dark:text-slate-200',
  },
  din: {
    row: 'border-amber-400/30 bg-amber-500/[0.13] shadow-[inset_0_1px_0_rgba(251,191,36,0.14)] hover:bg-amber-500/[0.18]',
    rail: 'border-amber-300/60 bg-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.30)]',
    pill: 'border-amber-500/35 bg-amber-100/85 text-amber-900 dark:border-amber-200/80 dark:bg-amber-200/90 dark:text-slate-950',
    title: 'text-slate-950 dark:text-white',
    detail: 'text-slate-700 dark:text-slate-200',
    meta: 'text-slate-600 dark:text-slate-200',
  },
  ingilizce: {
    row: 'border-sky-400/30 bg-sky-500/[0.13] shadow-[inset_0_1px_0_rgba(56,189,248,0.14)] hover:bg-sky-500/[0.18]',
    rail: 'border-sky-300/60 bg-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.30)]',
    pill: 'border-sky-500/30 bg-sky-100/85 text-sky-800 dark:border-sky-200/80 dark:bg-sky-200/90 dark:text-slate-950',
    title: 'text-slate-950 dark:text-white',
    detail: 'text-slate-700 dark:text-slate-200',
    meta: 'text-slate-600 dark:text-slate-200',
  },
  paragraf: {
    row: 'border-teal-400/30 bg-teal-500/[0.13] shadow-[inset_0_1px_0_rgba(45,212,191,0.14)] hover:bg-teal-500/[0.18]',
    rail: 'border-teal-300/60 bg-teal-400 shadow-[0_0_18px_rgba(45,212,191,0.30)]',
    pill: 'border-teal-500/30 bg-teal-100/85 text-teal-800 dark:border-teal-200/80 dark:bg-teal-200/90 dark:text-slate-950',
    title: 'text-slate-950 dark:text-white',
    detail: 'text-slate-700 dark:text-slate-200',
    meta: 'text-slate-600 dark:text-slate-200',
  },
  default: {
    row: 'border-blue-400/30 bg-blue-500/[0.13] shadow-[inset_0_1px_0_rgba(96,165,250,0.14)] hover:bg-blue-500/[0.18]',
    rail: 'border-blue-300/60 bg-blue-400 shadow-[0_0_18px_rgba(96,165,250,0.30)]',
    pill: 'border-blue-500/30 bg-blue-100/85 text-blue-800 dark:border-blue-200/80 dark:bg-blue-200/90 dark:text-slate-950',
    title: 'text-slate-950 dark:text-white',
    detail: 'text-slate-700 dark:text-slate-200',
    meta: 'text-slate-600 dark:text-slate-200',
  },
};

const getCourseTaskVisual = (courseName: string): CourseTaskVisual => {
  const name = (courseName || '').trim().toLocaleLowerCase('tr-TR');
  if (name.includes('matematik')) return COURSE_TASK_VISUALS.matematik;
  if (name.includes('turkce') || name.includes('türkçe')) return COURSE_TASK_VISUALS.turkce;
  if (name.includes('fen')) return COURSE_TASK_VISUALS.fen;
  if (name.includes('inkilap') || name.includes('inkılap') || name.includes('tarih')) return COURSE_TASK_VISUALS.inkilap;
  if (name.includes('din') || name.includes('ahlak')) return COURSE_TASK_VISUALS.din;
  if (name.includes('ingilizce') || name.includes('english')) return COURSE_TASK_VISUALS.ingilizce;
  if (name.includes('paragraf')) return COURSE_TASK_VISUALS.paragraf;
  return COURSE_TASK_VISUALS.default;
};

const createEmptyDay = () => ({
  slots: [],
  availableWindows: [],
  confirmed: false,
});

const resolveScheduleDay = (value: WeeklySchedule[string] | string | undefined) => {
  if (!value) return createEmptyDay();
  if (typeof value === 'string') return createEmptyDay();
  return {
    slots: Array.isArray(value.slots) ? value.slots : [],
    availableWindows: Array.isArray(value.availableWindows) ? value.availableWindows : [],
    confirmed: Boolean(value.confirmed),
  };
};

const createSlotId = () => `slot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const createStudyWindowId = () => `window_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const createWindowKey = (window: ScheduleDayWindow, index: number) => window.id || `${window.startTime}_${window.endTime}_${window.quality}_${index}`;
const getTodayDateInput = () => getLocalDateString();

const sortSlots = (slots: WeeklyScheduleSlot[]) => [...slots].sort((left, right) => left.startTime.localeCompare(right.startTime));
const sortWindows = (windows: ScheduleDayWindow[]) => [...windows].sort((left, right) => left.startTime.localeCompare(right.startTime));
const getRangeMinutes = (startTime: string, endTime: string) => {
  const [startHour = 0, startMinute = 0] = startTime.split(':').map(Number);
  const [endHour = 0, endMinute = 0] = endTime.split(':').map(Number);
  return Math.max(0, (endHour * 60 + endMinute) - (startHour * 60 + startMinute));
};
const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes} dk`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}s ${rest}dk` : `${hours}s`;
};
const timesOverlap = (leftStart: string, leftEnd: string, rightStart: string, rightEnd: string) => leftStart < rightEnd && rightStart < leftEnd;

const dayHasChanges = (left: WeeklySchedule[string] | string | undefined, right: WeeklySchedule[string] | string | undefined) => {
  const leftDay = resolveScheduleDay(left);
  const rightDay = resolveScheduleDay(right);
  return JSON.stringify(leftDay) !== JSON.stringify(rightDay);
};

const WeeklySchedulePanel: React.FC<WeeklySchedulePanelProps> = ({ schedule, courses, curriculum, tasks, addTask, deleteTask, onSave, onAddExam }) => {
  const safeSchedule = useMemo(() => schedule || ({} as WeeklySchedule), [schedule]);
  const safeCourses = useMemo(() => (Array.isArray(courses) ? courses : []), [courses]);
  const safeTasks = useMemo(() => (Array.isArray(tasks) ? tasks : []), [tasks]);
  const [draft, setDraft] = useState<WeeklySchedule>(safeSchedule);
  const [saved, setSaved] = useState(false);
  const [showEditorPreview, setShowEditorPreview] = useState(false);
  const [activeDay, setActiveDay] = useState<string>('Pazartesi');
  const [editorMode, setEditorMode] = useState<EditorMode>('school');
  const [selectedCourseName, setSelectedCourseName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [studyStartTime, setStudyStartTime] = useState('16:00');
  const [studyEndTime, setStudyEndTime] = useState('17:00');
  const [studyQuality, setStudyQuality] = useState<ScheduleDayWindow['quality']>('medium');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isTaskAssignmentOpen, setIsTaskAssignmentOpen] = useState(false);
  const [assignmentCourseName, setAssignmentCourseName] = useState('');
  const [assignmentUnitName, setAssignmentUnitName] = useState('');
  const [assignmentTopicName, setAssignmentTopicName] = useState('');
  const [assignmentDueDate, setAssignmentDueDate] = useState(getTodayDateInput());
  const [assignmentDuration, setAssignmentDuration] = useState('30');
  const [assignmentTaskTypeKey, setAssignmentTaskTypeKey] = useState<TaskTypeKey>('study');
  const [assignmentQuestionCount, setAssignmentQuestionCount] = useState('');
  const [assignmentMessage, setAssignmentMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [assignmentToast, setAssignmentToast] = useState<string | null>(null);
  const [isAssigningTask, setIsAssigningTask] = useState(false);
  const [schoolCurriculumSlot, setSchoolCurriculumSlot] = useState<{ day: string; slotId: string } | null>(null);
  const [schoolUnitName, setSchoolUnitName] = useState('');
  const [schoolTopicName, setSchoolTopicName] = useState('');
  const [schoolCurriculumMessage, setSchoolCurriculumMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(safeSchedule);
  }, [safeSchedule]);

  useEffect(() => {
    if (!assignmentToast) return;
    const timeoutId = window.setTimeout(() => setAssignmentToast(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [assignmentToast]);

  useEffect(() => {
    const activeCourses = safeCourses.filter((course) => course.active !== false);
    if (!selectedCourseName && activeCourses.length > 0) {
      setSelectedCourseName(activeCourses[0].name);
    }
    if (selectedCourseName && !activeCourses.some((course) => course.name === selectedCourseName)) {
      setSelectedCourseName(activeCourses[0]?.name || '');
    }
  }, [safeCourses, selectedCourseName]);

  const activeCourses = useMemo(() => safeCourses.filter((course) => course.active !== false), [safeCourses]);
  const courseNameById = useMemo(() => new Map(safeCourses.map((course) => [course.id, course.name])), [safeCourses]);
  const activeCourseNameSet = useMemo(() => new Set(activeCourses.map((course) => normalizeForLookup(course.name))), [activeCourses]);
  const assignedTasks = useMemo(
    () => safeTasks
      .filter((task) => task.status === 'bekliyor' && !task.isSelfAssigned)
      .sort((left, right) => {
        const leftCreated = left.createdAt || left.id || '';
        const rightCreated = right.createdAt || right.id || '';
        const createdDiff = rightCreated.localeCompare(leftCreated);
        if (createdDiff !== 0) return createdDiff;
        return getTaskDateKey(right.dueDate).localeCompare(getTaskDateKey(left.dueDate));
      }),
    [safeTasks],
  );
  const assignmentSubjectOptions = useMemo(() => {
    const curriculumSubjects = Object.keys(curriculum || {})
      .filter((subject) => activeCourseNameSet.has(normalizeForLookup(subject)))
      .map((subject) => ({ value: subject, label: subject }));

    if (curriculumSubjects.length > 0) return curriculumSubjects;
    return activeCourses.map((course) => ({ value: course.name, label: course.name }));
  }, [activeCourseNameSet, activeCourses, curriculum]);
  const assignmentUnits = useMemo<CurriculumUnit[]>(() => {
    if (!curriculum || !assignmentCourseName) return [];

    const directUnits = curriculum[assignmentCourseName] as CurriculumUnit[] | undefined;
    if (Array.isArray(directUnits) && directUnits.length > 0) return directUnits;

    const normalizedCourseName = normalizeForLookup(assignmentCourseName);
    const matchedSubject = Object.keys(curriculum).find((subject) => normalizeForLookup(subject) === normalizedCourseName);
    if (!matchedSubject) return Array.isArray(directUnits) ? directUnits : [];
    return curriculum[matchedSubject] as CurriculumUnit[];
  }, [assignmentCourseName, curriculum]);
  const assignmentTopics = useMemo(() => {
    if (!assignmentUnitName) return [];
    return assignmentUnits.find((unit) => unit.name === assignmentUnitName)?.topics || [];
  }, [assignmentUnitName, assignmentUnits]);

  const getCurriculumUnitsForCourse = (courseName: string): CurriculumUnit[] => {
    if (!curriculum || !courseName) return [];
    const directUnits = curriculum[courseName] as CurriculumUnit[] | undefined;
    if (Array.isArray(directUnits)) return directUnits;
    const normalizedCourseName = normalizeForLookup(courseName);
    const matchedSubject = Object.keys(curriculum).find((subject) => normalizeForLookup(subject) === normalizedCourseName);
    return matchedSubject && Array.isArray(curriculum[matchedSubject]) ? curriculum[matchedSubject] as CurriculumUnit[] : [];
  };

  const hasDraftChanges = useMemo(
    () => DAYS.some((day) => dayHasChanges(draft[day], safeSchedule[day])),
    [draft, safeSchedule],
  );

  const activeDaySchedule = resolveScheduleDay(draft[activeDay]);
  const activeDaySchoolMinutes = activeDaySchedule.slots.reduce((sum, slot) => sum + getRangeMinutes(slot.startTime, slot.endTime), 0);
  const activeDayStudyMinutes = activeDaySchedule.availableWindows.reduce((sum, window) => sum + getRangeMinutes(window.startTime, window.endTime), 0);
  const totalSchoolBlocks = DAYS.reduce((sum, day) => sum + resolveScheduleDay(safeSchedule[day]).slots.length, 0);
  const totalStudyWindows = DAYS.reduce((sum, day) => sum + resolveScheduleDay(safeSchedule[day]).availableWindows.length, 0);
  const confirmedDayCount = DAYS.filter((day) => resolveScheduleDay(safeSchedule[day]).confirmed).length;
  const activeSchoolCurriculumDay = schoolCurriculumSlot ? resolveScheduleDay(draft[schoolCurriculumSlot.day]) : null;
  const activeSchoolCurriculumSlot = schoolCurriculumSlot && activeSchoolCurriculumDay
    ? activeSchoolCurriculumDay.slots.find((slot) => slot.id === schoolCurriculumSlot.slotId) || null
    : null;
  const schoolCurriculumUnits = activeSchoolCurriculumSlot ? getCurriculumUnitsForCourse(activeSchoolCurriculumSlot.courseName) : [];
  const schoolCurriculumTopics = schoolCurriculumUnits.find((unit) => unit.name === schoolUnitName)?.topics || [];

  const updateDay = (day: string, updater: (current: ReturnType<typeof resolveScheduleDay>) => ReturnType<typeof resolveScheduleDay>) => {
    setDraft((prev) => {
      const currentDay = resolveScheduleDay(prev[day]);
      return {
        ...prev,
        [day]: updater(currentDay),
      };
    });
    if (saved) setSaved(false);
  };

  const resetSchoolEditor = () => {
    setStartTime('09:00');
    setEndTime('10:00');
    setNote('');
    setError('');
  };

  const resetStudyEditor = () => {
    setStudyStartTime('16:00');
    setStudyEndTime('17:00');
    setStudyQuality('medium');
    setError('');
  };

  const openEditorForDay = (day: string, mode: EditorMode = 'school') => {
    setActiveDay(day);
    setEditorMode(mode);
    setError('');
    setShowEditorPreview(false);
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setDraft(safeSchedule);
    setError('');
    setShowEditorPreview(false);
    setIsEditorOpen(false);
  };

  const handleAddSchoolBlock = () => {
    if (!selectedCourseName) {
      setError('Okul programına blok eklemek için müfredattaki derslerden birini seçin.');
      return;
    }

    if (startTime >= endTime) {
      setError('Bitiş saati başlangıç saatinden sonra olmalı.');
      return;
    }

    if (activeDaySchedule.slots.some((slot) => timesOverlap(startTime, endTime, slot.startTime, slot.endTime))) {
      setError('Bu saat aralığında başka bir okul bloğu var.');
      return;
    }

    updateDay(activeDay, (currentDay) => ({
      ...currentDay,
      slots: sortSlots([
        ...currentDay.slots,
        {
          id: createSlotId(),
          courseName: selectedCourseName,
          startTime,
          endTime,
          note: note.trim() || undefined,
        },
      ]),
      confirmed: false,
    }));

    resetSchoolEditor();
  };

  const handleAddStudyWindow = () => {
    if (studyStartTime >= studyEndTime) {
      setError('Çalışma penceresi bitiş saati başlangıç saatinden sonra olmalı.');
      return;
    }

    if (activeDaySchedule.availableWindows.some((window) => timesOverlap(studyStartTime, studyEndTime, window.startTime, window.endTime))) {
      setError('Bu saat aralığında başka bir çalışma penceresi var.');
      return;
    }

    const nextWindow: ScheduleDayWindow = {
      id: createStudyWindowId(),
      startTime: studyStartTime,
      endTime: studyEndTime,
      quality: studyQuality,
    };

    updateDay(activeDay, (currentDay) => ({
      ...currentDay,
      availableWindows: sortWindows([...currentDay.availableWindows, nextWindow]),
      confirmed: false,
    }));

    resetStudyEditor();
  };

  const handleRemoveSlot = (day: string, slotId: string) => {
    updateDay(day, (currentDay) => ({
      ...currentDay,
      slots: currentDay.slots.filter((slot) => slot.id !== slotId),
      confirmed: false,
    }));
  };

  const handleRemoveWindow = (day: string, windowToRemove: ScheduleDayWindow) => {
    updateDay(day, (currentDay) => ({
      ...currentDay,
      availableWindows: currentDay.availableWindows.filter(((removed) => (window) => {
        if (windowToRemove.id) return window.id !== windowToRemove.id;
        const isMatch = window.startTime === windowToRemove.startTime && window.endTime === windowToRemove.endTime && window.quality === windowToRemove.quality;
        if (isMatch && !removed.value) {
          removed.value = true;
          return false;
        }
        return true;
      })({ value: false })),
      confirmed: false,
    }));
  };

  const openSchoolCurriculumEditor = (day: string, slot: WeeklyScheduleSlot) => {
    setSchoolCurriculumSlot({ day, slotId: slot.id });
    setSchoolUnitName(slot.schoolUnitName || '');
    setSchoolTopicName(slot.schoolTopicName || '');
    setSchoolCurriculumMessage(null);
  };

  const closeSchoolCurriculumEditor = () => {
    setSchoolCurriculumSlot(null);
    setSchoolUnitName('');
    setSchoolTopicName('');
  };

  const updateSchoolSlot = (day: string, slotId: string, updater: (slot: WeeklyScheduleSlot) => WeeklyScheduleSlot) => {
    updateDay(day, (currentDay) => ({
      ...currentDay,
      slots: currentDay.slots.map((slot) => slot.id === slotId ? updater(slot) : slot),
      confirmed: false,
    }));
  };

  const handleToggleNotCovered = (day: string, slot: WeeklyScheduleSlot) => {
    const nextIsNotCovered = slot.schoolCurriculumStatus !== 'not-covered';
    updateSchoolSlot(day, slot.id, (currentSlot) => ({
      ...currentSlot,
      schoolCurriculumStatus: nextIsNotCovered ? 'not-covered' : undefined,
      schoolUnitName: nextIsNotCovered ? undefined : currentSlot.schoolUnitName,
      schoolTopicName: nextIsNotCovered ? undefined : currentSlot.schoolTopicName,
      schoolCurriculumUpdatedAt: new Date().toISOString(),
    }));
    setSchoolCurriculumMessage(nextIsNotCovered ? `${slot.courseName}: konu işlenmedi olarak işaretlendi.` : `${slot.courseName}: işlenmedi işareti kaldırıldı.`);
  };

  const handleSaveSchoolCurriculum = () => {
    if (!schoolCurriculumSlot || !activeSchoolCurriculumSlot) return;
    if (!schoolUnitName || !schoolTopicName) {
      setSchoolCurriculumMessage('Kaydetmek için ünite ve konu seçin.');
      return;
    }

    updateSchoolSlot(schoolCurriculumSlot.day, schoolCurriculumSlot.slotId, (slot) => ({
      ...slot,
      schoolCurriculumStatus: 'covered',
      schoolUnitName,
      schoolTopicName,
      schoolCurriculumUpdatedAt: new Date().toISOString(),
    }));
    setSchoolCurriculumMessage(`${activeSchoolCurriculumSlot.courseName}: okul konusu kaydedildi.`);
    window.setTimeout(() => closeSchoolCurriculumEditor(), 450);
  };

  const handleClearSchoolCurriculum = () => {
    if (!schoolCurriculumSlot || !activeSchoolCurriculumSlot) return;
    updateSchoolSlot(schoolCurriculumSlot.day, schoolCurriculumSlot.slotId, (slot) => ({
      ...slot,
      schoolCurriculumStatus: undefined,
      schoolUnitName: undefined,
      schoolTopicName: undefined,
      schoolCurriculumUpdatedAt: new Date().toISOString(),
    }));
    setSchoolUnitName('');
    setSchoolTopicName('');
    setSchoolCurriculumMessage(`${activeSchoolCurriculumSlot.courseName}: okul konu girişi temizlendi.`);
  };

  const handleConfirmDay = (day: string) => {
    const dayState = resolveScheduleDay(draft[day]);
    if (dayState.slots.length === 0 && dayState.availableWindows.length === 0) {
      setError('Boş gün olarak onaylamak için önce "Bu gün okul/çalışma yok" seçeneğini kullanın.');
      return;
    }

    updateDay(day, (currentDay) => ({
      ...currentDay,
      confirmed: true,
    }));
  };

  const handleMarkDayEmpty = (day: string) => {
    updateDay(day, () => ({
      slots: [],
      availableWindows: [],
      confirmed: true,
    }));
  };

  const handleSave = () => {
    onSave(draft);
    setSaved(true);
    setShowEditorPreview(false);
    setIsEditorOpen(false);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const resetAssignmentForm = () => {
    setAssignmentDueDate(getTodayDateInput());
    setAssignmentDuration('30');
    setAssignmentTaskTypeKey('study');
    setAssignmentQuestionCount('');
    setAssignmentCourseName('');
    setAssignmentUnitName('');
    setAssignmentTopicName('');
  };

  const openTaskAssignment = () => {
    setAssignmentMessage(null);
    if (!assignmentCourseName && assignmentSubjectOptions.length > 0) {
      setAssignmentCourseName(assignmentSubjectOptions[0].value);
    }
    setIsTaskAssignmentOpen(true);
  };

  const closeTaskAssignment = () => {
    if (isAssigningTask) return;
    setAssignmentMessage(null);
    setIsTaskAssignmentOpen(false);
  };

  const handleAssignTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isAssigningTask) return;

    if (!addTask) {
      setAssignmentMessage({ type: 'error', text: 'Bu ekranda görev atama bağlantısı hazır değil.' });
      return;
    }

    if (!assignmentDueDate || !assignmentDuration || !assignmentCourseName || !assignmentUnitName || !assignmentTopicName) {
      setAssignmentMessage({ type: 'error', text: 'Görev atamak için ders, ünite, konu, tarih ve süre seçimi zorunludur.' });
      return;
    }

    const resolvedCourseId = safeCourses.find((course) => normalizeForLookup(course.name) === normalizeForLookup(assignmentCourseName))?.id;
    if (!resolvedCourseId) {
      setAssignmentMessage({ type: 'error', text: 'Seçili ders için kayıtlı ders kimliği bulunamadı. Önce Müfredat ekranından dersi kaydedin.' });
      return;
    }

    const plannedDuration = Number(assignmentDuration);
    if (!Number.isFinite(plannedDuration) || plannedDuration <= 0) {
      setAssignmentMessage({ type: 'error', text: 'Süre 0 dakikadan büyük olmalı.' });
      return;
    }

    const questionCountValue = Number(assignmentQuestionCount);
    const requiresQuestionCount = assignmentTaskTypeKey === 'question' || assignmentTaskTypeKey === 'branch-exam';
    if (requiresQuestionCount && (!Number.isFinite(questionCountValue) || questionCountValue <= 0)) {
      setAssignmentMessage({ type: 'error', text: 'Soru/branş deneme görevinde soru sayısı 0’dan büyük olmalı.' });
      return;
    }

    const generatedTitle = [assignmentCourseName, assignmentUnitName, assignmentTopicName].join(' / ');
    const derivedTaskGoalType =
      assignmentTaskTypeKey === 'question' || assignmentTaskTypeKey === 'branch-exam'
        ? 'test-cozme'
        : assignmentTaskTypeKey === 'general-exam'
          ? 'olcme-degerlendirme'
          : assignmentTaskTypeKey === 'revision'
            ? 'konu-tekrari'
            : 'ders calisma';
    const basePayload: Omit<Task, 'id' | 'status'> = {
      title: generatedTitle,
      dueDate: assignmentDueDate,
      courseId: resolvedCourseId,
      taskType: taskTypeKeyToTaskType(assignmentTaskTypeKey),
      plannedDuration,
      ...(requiresQuestionCount ? { questionCount: Math.round(questionCountValue) } : {}),
      curriculumUnitName: assignmentUnitName,
      curriculumTopicName: assignmentTopicName,
      taskGoalType: derivedTaskGoalType,
      planSource: 'manual' as const,
    };

    setIsAssigningTask(true);
    try {
      const createdTask = await addTask(basePayload);
      resetAssignmentForm();
      setAssignmentMessage(null);
      setIsTaskAssignmentOpen(false);
      setAssignmentToast(createdTask.title === basePayload.title ? 'Görev atandı. Çocuk panelinde bekleyen görev olarak görünecek.' : 'Aynı bekleyen görev zaten vardı; yeni kopya oluşturulmadı.');
    } catch (error) {
      setAssignmentMessage({ type: 'error', text: error instanceof Error ? error.message : 'Görev eklenirken beklenmeyen bir hata oluştu.' });
    } finally {
      setIsAssigningTask(false);
    }
  };


  const handleRepeatAssignedTask = async (task: Task) => {
    if (!addTask || isAssigningTask) return;

    const today = getTodayDateInput();
    const duplicateExists = (tasks || []).some((candidate) => (
      candidate.id !== task.id &&
      candidate.status === 'bekliyor' &&
      candidate.dueDate === today &&
      candidate.title === task.title &&
      candidate.courseId === task.courseId &&
      candidate.taskType === task.taskType &&
      (candidate.curriculumUnitName || '') === (task.curriculumUnitName || '') &&
      (candidate.curriculumTopicName || '') === (task.curriculumTopicName || '')
    ));

    if (duplicateExists) {
      setAssignmentToast('Bu görev bugün için zaten bekleyenlerde var. Tekrar kopya oluşturulmadı.');
      return;
    }

    setIsAssigningTask(true);
    try {
      await addTask({
        title: task.title,
        dueDate: today,
        courseId: task.courseId,
        taskType: task.taskType,
        plannedDuration: task.plannedDuration,
        ...(typeof task.questionCount === 'number' && task.questionCount > 0 ? { questionCount: task.questionCount } : {}),
        ...(task.curriculumUnitName ? { curriculumUnitName: task.curriculumUnitName } : {}),
        ...(task.curriculumTopicName ? { curriculumTopicName: task.curriculumTopicName } : {}),
        ...(task.taskGoalType ? { taskGoalType: task.taskGoalType } : {}),
        ...(task.selectedMetrics?.length ? { selectedMetrics: task.selectedMetrics, metricTargetScore: task.metricTargetScore } : {}),
        ...(typeof task.targetAccuracy === 'number' ? { targetAccuracy: task.targetAccuracy } : {}),
        ...(typeof task.targetFocus === 'number' ? { targetFocus: task.targetFocus } : {}),
        ...(typeof task.minimumDuration === 'number' ? { minimumDuration: task.minimumDuration } : {}),
        planSource: 'manual' as const,
      });
      setAssignmentToast('Görev tekrarlandı. Yeni kopya listenin en üstünde.');
    } catch (error) {
      setAssignmentToast(error instanceof Error ? error.message : 'Görev tekrarlanamadı.');
    } finally {
      setIsAssigningTask(false);
    }
  };

  return (
    <>
      <section className="ios-card rounded-[24px] p-6 border border-[var(--dr-std-border-strong)]/20 shadow-md bg-[var(--dr-surface)]/40 backdrop-blur-lg">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[var(--dr-orange)]">
            <Calendar className="h-4 w-4" />
            Haftalık zaman
          </div>
          <div className="mt-2 flex items-center gap-2">
            <h2 className="dr-planning-section-title text-2xl font-black text-[var(--dr-text-primary)]">Haftalık Program</h2>
            <ContextHelp title="Haftalık Program" tone="blue">
              Ders/konu girişi müfredatta kalır. Burada sadece okul saatleri ve plan motorunun kullanacağı ev çalışma pencereleri yönetilir.
            </ContextHelp>
          </div>
        </div>
        {saved && (
          <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-bold text-emerald-600 shrink-0 self-start">
            Program kaydedildi
          </div>
        )}
      </div>

      {/* Planlama Aksiyonları Kartı */}
      <div className="ios-panel flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between rounded-[20px] border border-[var(--dr-std-border-strong)]/20 bg-[var(--dr-surface)]/50 shadow-sm">
        <div className="text-sm font-bold text-[var(--dr-text-primary)]">Akademik Planlama İşlemleri</div>
        <div className="flex flex-wrap gap-2">
          {onAddExam && (
            <button
              type="button"
              onClick={onAddExam}
              className="ios-button inline-flex items-center justify-center gap-2 rounded-[14px] px-3.5 py-2 text-xs font-bold text-[var(--dr-text-primary)] transition-all active:scale-[0.96] cursor-pointer"
            >
              <PlusCircle className="h-4 w-4 text-[var(--dr-orange)]" />
              Sınav ekle
            </button>
          )}
          <button
            type="button"
            onClick={() => openEditorForDay(activeDay, 'school')}
            className="ios-button inline-flex items-center justify-center gap-2 rounded-[14px] px-3.5 py-2 text-xs font-bold text-[var(--dr-text-primary)] transition-all active:scale-[0.96] cursor-pointer"
          >
            <PlusCircle className="h-4 w-4 text-[var(--dr-orange)]" />
            Okul programını düzenle
          </button>
          <button
            type="button"
            onClick={openTaskAssignment}
            disabled={!addTask}
            className="ios-button-active inline-flex items-center justify-center gap-2 rounded-[14px] px-3.5 py-2 text-xs font-black text-white transition-all active:scale-[0.96] disabled:opacity-50 cursor-pointer"
          >
            <ClipboardList className="h-4 w-4" />
            Görev ata
          </button>
        </div>
      </div>

      {assignmentToast && (
        <div className="mt-4 flex items-start gap-3 rounded-[22px] border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-emerald-700 shadow-[0_18px_42px_rgba(16,185,129,0.16)] dark:text-emerald-200" role="status" aria-live="polite">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
            <CheckCircle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="text-base font-black text-[var(--dr-text-primary)]">{'G\u00f6rev atand\u0131'}</div>
            <div className="mt-0.5 text-sm font-semibold text-[var(--dr-text-secondary)]">{assignmentToast}</div>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-[22px] border border-[var(--dr-std-border-strong)]/15 bg-[var(--dr-surface)]/35 p-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--dr-orange)]">
              <ClipboardList className="h-4 w-4" />
              {'Atanan g\u00f6revler'}
            </div>
            <h3 className="mt-1 text-base font-black text-[var(--dr-text-primary)]">{'Veli g\u00f6rev takibi'}</h3>
          </div>
          <span className="self-start rounded-full border border-[var(--dr-std-border-strong)]/15 bg-[var(--dr-surface)]/70 px-3 py-1.5 text-xs font-black text-[var(--dr-text-primary)]">
            {assignedTasks.length} bekleyen
          </span>
        </div>

        {assignedTasks.length === 0 ? (
          <div className="mt-3 rounded-[16px] border border-dashed border-[var(--dr-std-border-strong)]/20 bg-[var(--dr-surface)]/30 px-4 py-4 text-sm font-semibold text-[var(--dr-text-secondary)]">
            {'Hen\u00fcz veli taraf\u0131ndan atanm\u0131\u015f bekleyen g\u00f6rev yok.'}
          </div>
        ) : (
          <div className="dr-modal-scroll mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {assignedTasks.map((task) => {
              const courseName = courseNameById.get(task.courseId) || 'Ders bilgisi yok';
              const courseVisual = getCourseTaskVisual(courseName);
              const taskDetail = [
                task.curriculumUnitName,
                task.curriculumTopicName,
                task.taskGoalType ? formatTaskGoal(task.taskGoalType) : '',
                task.questionCount ? String(task.questionCount) + ' soru' : '',
              ].filter(Boolean).join(' / ');

              return (
                <article key={task.id} className={['group flex min-h-[4.75rem] items-center gap-3 rounded-[16px] border px-3 py-2.5 transition-colors', courseVisual.row].join(' ')}>
                  <div className={['h-11 w-1.5 shrink-0 rounded-full border', courseVisual.rail].join(' ')} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className={['flex flex-wrap items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.11em] drop-shadow-sm', courseVisual.meta].join(' ')}>
                      <span className={['dr-assigned-course-pill max-w-[13rem] truncate rounded-full border px-2 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]', courseVisual.pill].join(' ')}>{courseName}</span>
                      <span>{getTaskDateKey(task.dueDate)}</span>
                      <span>{task.plannedDuration} dk</span>
                    </div>
                    <h4 className={['mt-1 line-clamp-2 text-sm font-black leading-snug drop-shadow-sm', courseVisual.title].join(' ')}>{task.title}</h4>
                    <p className={['mt-0.5 line-clamp-1 text-xs font-semibold', courseVisual.detail].join(' ')}>{taskDetail || 'Detay eklenmedi'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleRepeatAssignedTask(task)}
                      disabled={!addTask || isAssigningTask}
                      className="ios-button inline-flex h-9 items-center justify-center gap-1.5 rounded-[12px] px-2.5 text-xs font-black text-[var(--dr-text-primary)] transition-all active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={task.title + ' g\u00f6revini tekrarla'}
                      title={'G\u00f6revi tekrarla'}
                    >
                      <PlusCircle className="h-3.5 w-3.5 text-[var(--dr-orange)]" />
                      {'Tekrarla'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTask?.(task.id)}
                      disabled={!deleteTask}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[12px] border border-rose-400/25 bg-rose-500/10 px-2.5 text-xs font-black text-rose-500 transition-all active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={task.title + ' g\u00f6revini sil'}
                      title={'G\u00f6revi sil'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {'Sil'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="hidden">
        {DAYS.map((day) => {
          const dayState = resolveScheduleDay(safeSchedule[day]);
          const isActiveDay = day === activeDay;
          return (
            <div
              key={`summary-${day}`}
              className={`dr-compact-card border border-white/10 bg-white/5 transition ${isActiveDay ? 'ring-2 ring-primary-400/50' : ''}`}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-black text-slate-900">{day}</div>
                  <div className="text-xs text-slate-500">
                    {dayState.slots.length} okul bloğu / {dayState.availableWindows.length} çalışma
                  </div>
                </div>
                <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${dayState.confirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {dayState.confirmed ? 'Onaylı' : 'Taslak'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </section>

      {isEditorOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-xl" onClick={handleCloseEditor}>
          <div className="ios-card dr-compact-modal flex max-h-[min(76dvh,36rem)] w-[min(38rem,calc(100vw-1.5rem))] flex-col overflow-hidden border border-[var(--dr-std-border-strong)]/20 shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Haftalık program düzenleme">
            <div className="dr-compact-modal-header flex items-start justify-between gap-4 border-b border-[var(--dr-std-border-strong)]/15 p-4 bg-[var(--dr-surface)]/20">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[var(--dr-orange)]">
                  <PlusCircle className="h-4 w-4" />
                  Haftalık zaman düzeni
                </div>
                <h3 className="mt-1 text-base font-black text-[var(--dr-text-primary)]">{activeDay}</h3>
                <p className="mt-0.5 max-w-md text-[11px] text-[var(--dr-text-secondary)]">Okul ve ev çalışma saatlerini ayrı girin.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditorPreview((current) => !current)}
                  className="ios-button inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-[var(--dr-text-primary)] transition-all active:scale-[0.96] cursor-pointer"
                  aria-expanded={showEditorPreview}
                  aria-label="Seçili günün ön izlemesini aç veya kapat"
                >
                  <Calendar className="h-4 w-4 text-[var(--dr-orange)]" />
                  Ön izleme
                </button>
                <button
                  type="button"
                  onClick={handleCloseEditor}
                  className="ios-button flex h-9 w-9 items-center justify-center rounded-full p-0 text-[var(--dr-text-secondary)] transition-all active:scale-[0.96] cursor-pointer"
                  aria-label="Program düzenlemeyi kapat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {showEditorPreview && (
              <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-xl" onClick={() => setShowEditorPreview(false)}>
                <section
                  className="ios-card dr-week-preview-modal w-[min(46rem,calc(100vw-1.5rem))] overflow-hidden p-5 border border-[var(--dr-std-border-strong)]/20 shadow-2xl bg-[var(--dr-surface)]"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Haftalık program ön izleme"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--dr-orange)]">Haftalık ön izleme</div>
                      <h3 className="mt-1 text-lg font-black text-[var(--dr-text-primary)]">Tüm hafta planı</h3>
                      <p className="mt-1 text-xs font-semibold text-[var(--dr-text-secondary)]">
                        Okul blokları ve ev çalışma pencereleri tek ekranda.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowEditorPreview(false)}
                      className="ios-button flex h-9 w-9 items-center justify-center rounded-full p-0 text-[var(--dr-text-secondary)] transition-all active:scale-[0.96] cursor-pointer"
                      aria-label="Haftalık ön izlemeyi kapat"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="dr-week-preview-grid">
                    {DAYS.map((day) => {
                      const dayState = resolveScheduleDay(draft[day]);
                      const schoolMinutes = dayState.slots.reduce((sum, slot) => sum + getRangeMinutes(slot.startTime, slot.endTime), 0);
                      const studyMinutes = dayState.availableWindows.reduce((sum, window) => sum + getRangeMinutes(window.startTime, window.endTime), 0);
                      const hasBlocks = dayState.slots.length > 0 || dayState.availableWindows.length > 0;
                      return (
                        <article key={`week-preview-${day}`} className="dr-week-preview-day">
                          <div className="mb-3">
                            <div>
                              <div className="text-sm font-black text-slate-900 dark:text-white">{day}</div>
                              <div className="mt-0.5 text-[11px] font-semibold text-slate-500">
                                {dayState.slots.length} okul / {dayState.availableWindows.length} çalışma
                              </div>
                            </div>
                          </div>

                          <div className="mb-3 grid grid-cols-2 gap-2">
                            <div className="dr-week-preview-metric">
                              <div className="text-[9px] font-bold uppercase text-slate-500">Okul</div>
                              <div className="text-xs font-black text-slate-900 dark:text-white">{formatDuration(schoolMinutes)}</div>
                            </div>
                            <div className="dr-week-preview-metric">
                              <div className="text-[9px] font-bold uppercase text-slate-500">Çalışma</div>
                              <div className="text-xs font-black text-slate-900 dark:text-white">{formatDuration(studyMinutes)}</div>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            {!hasBlocks && (
                              <div className="rounded-[12px] border border-dashed border-white/15 px-3 py-3 text-center text-xs font-semibold text-slate-500">
                                Blok yok
                              </div>
                            )}
                            {sortSlots(dayState.slots).map((slot) => (
                              <button
                                key={`week-slot-${day}-${slot.id}`}
                                type="button"
                                onDoubleClick={() => openSchoolCurriculumEditor(day, slot)}
                                className={`dr-school-slot-row dr-compact-row w-full border-l-3 text-left ${slot.schoolCurriculumStatus === 'not-covered' ? 'dr-school-slot-not-covered' : getCourseStyle(slot.courseName)}`}
                                title="Okulda işlenen konuyu seçmek için çift tıklayın"
                              >
                                <div className="text-[9px] font-bold uppercase opacity-80">{slot.startTime} - {slot.endTime}</div>
                                <div className="mt-0.5 truncate text-xs font-black text-slate-900 dark:text-white">{slot.courseName}</div>
                                {slot.schoolCurriculumStatus === 'not-covered' && <div className="mt-1 text-[9px] font-black uppercase">Konu işlenmedi</div>}
                                {slot.schoolCurriculumStatus === 'covered' && slot.schoolTopicName && <div className="mt-1 truncate text-[9px] font-bold opacity-80">{slot.schoolTopicName}</div>}
                              </button>
                            ))}
                            {sortWindows(dayState.availableWindows).map((window, index) => (
                              <div key={`week-window-${day}-${createWindowKey(window, index)}`} className={`dr-compact-row border-l-3 ${QUALITY_META[window.quality].tone}`}>
                                <div className="text-[9px] font-bold uppercase opacity-80">{window.startTime} - {window.endTime}</div>
                                <div className="mt-0.5 truncate text-xs font-black text-slate-900 dark:text-white">{QUALITY_META[window.quality].label}</div>
                              </div>
                            ))}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}

            <div className="dr-modal-scroll dr-compact-modal-body flex-1 overflow-y-auto">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => {
                    const active = day === activeDay;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setActiveDay(day)}
                        className={`rounded-full px-2.5 py-1 text-left text-xs font-bold transition ${active ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEditorMode('school')}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${editorMode === 'school' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}
                  >
                    Okul dersi
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode('study')}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${editorMode === 'study' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}
                  >
                    Ev çalışma zamanı
                  </button>
                  <div className={`ml-auto inline-flex rounded-full px-3 py-1 text-xs font-bold ${activeDaySchedule.confirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {activeDaySchedule.confirmed ? 'Onaylandı' : 'Onay bekliyor'}
                  </div>
                </div>

                {editorMode === 'school' ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      value={selectedCourseName}
                      onChange={(event) => setSelectedCourseName(event.target.value)}
                      className="dr-form-field w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none"
                    >
                      <option value="">Ders seç</option>
                      {activeCourses.map((course, index) => (
                        <option key={`${course.id}-${course.name}-${index}`} value={course.name}>{course.name}</option>
                      ))}
                    </select>
                    <input value={startTime} onChange={(event) => setStartTime(event.target.value)} type="time" className="dr-form-field w-full min-w-[112px] rounded-xl px-3 py-2 text-sm font-semibold outline-none" />
                    <input value={endTime} onChange={(event) => setEndTime(event.target.value)} type="time" className="dr-form-field w-full min-w-[112px] rounded-xl px-3 py-2 text-sm font-semibold outline-none" />
                    <input
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Sınıf veya not"
                      className="dr-form-field w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none"
                    />
                    <button onClick={handleAddSchoolBlock} className="ios-button-active flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 sm:col-span-2">
                      <PlusCircle className="h-4 w-4" />
                      Ekle
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input value={studyStartTime} onChange={(event) => setStudyStartTime(event.target.value)} type="time" className="dr-form-field w-full min-w-[112px] rounded-xl px-3 py-2 text-sm font-semibold outline-none" />
                    <input value={studyEndTime} onChange={(event) => setStudyEndTime(event.target.value)} type="time" className="dr-form-field w-full min-w-[112px] rounded-xl px-3 py-2 text-sm font-semibold outline-none" />
                    <select value={studyQuality} onChange={(event) => setStudyQuality(event.target.value as ScheduleDayWindow['quality'])} className="dr-form-field w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none">
                      <option value="light">Soru Çözümü & Pratik (Test)</option>
                      <option value="medium">Konu Çalışması & Tekrar</option>
                      <option value="deep">Deneme Sınavı (LGS / Branş) & Soru Analizi</option>
                    </select>
                    <button onClick={handleAddStudyWindow} className="ios-button-active flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 sm:col-span-2">
                      <PlusCircle className="h-4 w-4" />
                      Çalışma ekle
                    </button>
                  </div>
                )}

                {error && <div className="rounded-2xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}
                {schoolCurriculumMessage && <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">{schoolCurriculumMessage}</div>}

                <div className="grid gap-3 xl:grid-cols-2">
                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{activeDay} okul blokları</div>
                    <div className="space-y-2">
                      {activeDaySchedule.slots.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-white/20 px-3 py-2 text-xs text-slate-500">Okul dersi eklenmedi.</div>
                      ) : (
                        sortSlots(activeDaySchedule.slots).map((slot) => (
                          <div
                            key={`detail-${slot.id}`}
                            onDoubleClick={() => openSchoolCurriculumEditor(activeDay, slot)}
                            className={`dr-school-slot-row flex items-center justify-between gap-3 rounded-xl border px-2.5 py-1.5 ${slot.schoolCurriculumStatus === 'not-covered' ? 'dr-school-slot-not-covered' : slot.schoolCurriculumStatus === 'covered' ? 'dr-school-slot-covered' : 'border-[var(--dr-std-border-strong)]/15 bg-[var(--dr-surface)]/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:shadow-none'}`}
                            title="Okulda işlenen konuyu seçmek için çift tıklayın"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 dark:text-white">{slot.courseName}</div>
                              <div className="mt-0.5 text-[10px] text-slate-500">{slot.startTime} - {slot.endTime}{slot.note ? ` - ${slot.note}` : ''}</div>
                              {slot.schoolCurriculumStatus === 'not-covered' && <div className="mt-1 text-[10px] font-black uppercase text-amber-700 dark:text-amber-300">Konu işlenmedi</div>}
                              {slot.schoolCurriculumStatus === 'covered' && slot.schoolTopicName && (
                                <div className="mt-1 truncate text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{slot.schoolUnitName} / {slot.schoolTopicName}</div>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleToggleNotCovered(activeDay, slot);
                                }}
                                className="ios-button rounded-full px-2 py-1 text-[10px] font-black text-slate-700"
                                title="Konu işlenmedi durumunu değiştir"
                              >
                                {slot.schoolCurriculumStatus === 'not-covered' ? 'Normal' : 'İşlenmedi'}
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleRemoveSlot(activeDay, slot.id);
                                }}
                                className="dr-destructive-button flex h-8 w-8 items-center justify-center rounded-full p-0"
                                title="Ders bloğunu sil"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{activeDay} ev çalışma pencereleri</div>
                    <div className="space-y-2">
                      {activeDaySchedule.availableWindows.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-white/20 px-3 py-2 text-xs text-slate-500">Çalışma zamanı eklenmedi.</div>
                      ) : (
                        sortWindows(activeDaySchedule.availableWindows).map((window, index) => (
                          <div key={`detail-${createWindowKey(window, index)}`} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--dr-std-border-strong)]/15 bg-[var(--dr-surface)]/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:shadow-none px-2.5 py-1.5">
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 dark:text-white">{QUALITY_META[window.quality].label}</div>
                              <div className="mt-0.5 text-[10px] text-slate-500">{window.startTime} - {window.endTime}</div>
                            </div>
                            <button onClick={() => handleRemoveWindow(activeDay, window)} className="dr-destructive-button flex h-8 w-8 items-center justify-center rounded-full p-0" title="Çalışma penceresini sil">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="dr-compact-modal-footer flex flex-col gap-2 border-t border-white/10">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <Clock className="h-4 w-4" />
                {hasDraftChanges ? 'Kaydedilmemiş program değişikliği var.' : 'Program güncel.'}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleConfirmDay(activeDay)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
                >
                  <CheckCircle className="h-4 w-4" />
                  Günü onayla
                </button>
                <button onClick={() => handleMarkDayEmpty(activeDay)} className="ios-button rounded-xl px-3 py-2 text-xs font-bold text-slate-700">
                  Bu gün okul/çalışma yok
                </button>
                <button type="button" onClick={handleCloseEditor} className="ios-button rounded-xl px-3 py-2 text-xs font-bold text-slate-700">
                  Vazgeç
                </button>
                <button type="button" onClick={handleSave} disabled={!hasDraftChanges} className="ios-button-active rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 disabled:opacity-50">
                  Programı kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {schoolCurriculumSlot && activeSchoolCurriculumSlot && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-xl" onClick={closeSchoolCurriculumEditor}>
          <section
            className="ios-card dr-compact-modal flex max-h-[min(76dvh,34rem)] w-[min(34rem,calc(100vw-1.5rem))] flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Okul müfredatı işleme"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dr-compact-modal-header flex items-start justify-between gap-4 border-b border-white/10">
              <div>
                <div className="dr-planning-kicker text-xs font-black uppercase tracking-[0.18em]">Okulda işlenen konu</div>
                <h3 className="mt-1 text-base font-black text-slate-900 dark:text-white">{activeSchoolCurriculumSlot.courseName}</h3>
                <p className="mt-0.5 text-[11px] text-slate-500">{schoolCurriculumSlot.day} · {activeSchoolCurriculumSlot.startTime} - {activeSchoolCurriculumSlot.endTime}</p>
              </div>
              <button type="button" onClick={closeSchoolCurriculumEditor} className="ios-button flex h-9 w-9 items-center justify-center rounded-full p-0 text-slate-600" aria-label="Okul müfredatı penceresini kapat">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="dr-modal-scroll dr-compact-modal-body flex-1 space-y-3 overflow-y-auto">
              {schoolCurriculumUnits.length === 0 ? (
                <div className="dr-planning-empty">
                  Bu ders için müfredat ünitesi bulunamadı. Önce Müfredat Yönetimi alanından ünite ve konu ekleyin.
                </div>
              ) : (
                <>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Ünite
                    <select
                      value={schoolUnitName}
                      onChange={(event) => {
                        setSchoolUnitName(event.target.value);
                        setSchoolTopicName('');
                        setSchoolCurriculumMessage(null);
                      }}
                      className="dr-form-field mt-1.5 w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none"
                    >
                      <option value="">Ünite seç</option>
                      {schoolCurriculumUnits.map((unit) => <option key={unit.name} value={unit.name}>{unit.name}</option>)}
                    </select>
                  </label>
                  <div>
                    <div className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-300">Konu</div>
                    {schoolCurriculumTopics.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/15 px-3 py-3 text-xs font-semibold text-slate-500">Ünite seçince konular burada görünür.</div>
                    ) : (
                      <div className="grid gap-2">
                        {schoolCurriculumTopics.map((topic) => (
                          <button
                            key={topic.name}
                            type="button"
                            onClick={() => {
                              setSchoolTopicName(topic.name);
                              setSchoolCurriculumMessage(null);
                            }}
                            className={`dr-school-topic-option rounded-xl px-3 py-2 text-left text-xs font-bold ${schoolTopicName === topic.name ? 'dr-school-topic-option-active' : ''}`}
                          >
                            {topic.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
              {schoolCurriculumMessage && <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">{schoolCurriculumMessage}</div>}
            </div>

            <div className="dr-compact-modal-footer flex flex-wrap justify-end gap-2 border-t border-white/10">
              <button
                type="button"
                onClick={handleClearSchoolCurriculum}
                disabled={!activeSchoolCurriculumSlot.schoolCurriculumStatus && !activeSchoolCurriculumSlot.schoolUnitName && !activeSchoolCurriculumSlot.schoolTopicName}
                className="dr-destructive-button inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Girişi sil
              </button>
              <button
                type="button"
                onClick={() => handleToggleNotCovered(schoolCurriculumSlot.day, activeSchoolCurriculumSlot)}
                className="ios-button rounded-xl px-3 py-2 text-xs font-bold text-[var(--dr-text-primary)] transition-all active:scale-[0.96] cursor-pointer"
              >
                {activeSchoolCurriculumSlot.schoolCurriculumStatus === 'not-covered' ? 'İşlenmedi kaldır' : 'Konu işlenmedi'}
              </button>
              <button type="button" onClick={closeSchoolCurriculumEditor} className="ios-button rounded-xl px-3 py-2 text-xs font-bold text-[var(--dr-text-primary)] transition-all active:scale-[0.96] cursor-pointer">Vazgeç</button>
              <button type="button" onClick={handleSaveSchoolCurriculum} disabled={schoolCurriculumUnits.length === 0} className="ios-button-active rounded-xl px-3.5 py-2 text-xs font-black text-white transition-all active:scale-[0.96] disabled:opacity-50 cursor-pointer">Kaydet</button>
            </div>
          </section>
        </div>
      )}

      {isTaskAssignmentOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-xl" onClick={closeTaskAssignment}>
          <form className="ios-card dr-compact-modal flex max-h-[min(76dvh,34rem)] w-full max-w-[34rem] min-w-0 flex-col overflow-hidden border border-[var(--dr-std-border-strong)]/20 shadow-2xl" onSubmit={handleAssignTask} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Çocuğa görev ata">
            <div className="dr-compact-modal-header flex items-start justify-between gap-4 border-b border-[var(--dr-std-border-strong)]/15 p-4 bg-[var(--dr-surface)]/20">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[var(--dr-orange)]">
                  <ClipboardList className="h-4 w-4" />
                  Çocuğa görev ata
                </div>
                <h3 className="mt-1 text-base font-black text-[var(--dr-text-primary)]">Plan içinden hızlı görev</h3>
                <p className="mt-0.5 text-[11px] text-[var(--dr-text-secondary)]">Ders, ünite ve konu seçerek görevi gönder.</p>
              </div>
              <button type="button" onClick={closeTaskAssignment} className="ios-button flex h-9 w-9 items-center justify-center rounded-full p-0 text-[var(--dr-text-secondary)] transition-all active:scale-[0.96] cursor-pointer" aria-label="Görev atama penceresini kapat">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="dr-modal-scroll dr-compact-modal-body min-w-0 flex-1 overflow-y-auto p-4 bg-[var(--dr-surface)]/20">
              <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                <label className="min-w-0 text-xs font-bold text-[var(--dr-text-primary)] dark:text-slate-300">Ders<select value={assignmentCourseName} onChange={(event) => { setAssignmentCourseName(event.target.value); setAssignmentUnitName(''); setAssignmentTopicName(''); setAssignmentMessage(null); }} className="dr-form-field mt-1.5 w-full max-w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none"><option value="">Ders seç</option>{assignmentSubjectOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label className="min-w-0 text-xs font-bold text-[var(--dr-text-primary)] dark:text-slate-300">Görev tipi<select value={assignmentTaskTypeKey} onChange={(event) => setAssignmentTaskTypeKey(event.target.value as TaskTypeKey)} className="dr-form-field mt-1.5 w-full max-w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none"><option value="study">Ders çalışma</option><option value="revision">Konu tekrarı</option><option value="question">Soru çözme</option><option value="branch-exam">Branş deneme (ders bazlı)</option><option value="general-exam">Genel deneme sınavı</option></select></label>
                <label className="min-w-0 text-xs font-bold text-[var(--dr-text-primary)] dark:text-slate-300">Ünite<select value={assignmentUnitName} onChange={(event) => { setAssignmentUnitName(event.target.value); setAssignmentTopicName(''); setAssignmentMessage(null); }} disabled={!assignmentUnits.length} className="dr-form-field mt-1.5 w-full max-w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none disabled:opacity-50"><option value="">Ünite seç</option>{assignmentUnits.map((unit) => <option key={unit.name} value={unit.name}>{unit.name}</option>)}</select></label>
                <label className="min-w-0 text-xs font-bold text-[var(--dr-text-primary)] dark:text-slate-300">Konu<select value={assignmentTopicName} onChange={(event) => { setAssignmentTopicName(event.target.value); setAssignmentMessage(null); }} disabled={!assignmentTopics.length} className="dr-form-field mt-1.5 w-full max-w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none disabled:opacity-50"><option value="">Konu seç</option>{assignmentTopics.map((topic) => <option key={topic.name} value={topic.name}>{topic.name}</option>)}</select></label>
                <label className="min-w-0 text-xs font-bold text-[var(--dr-text-primary)] dark:text-slate-300">Teslim tarihi<input type="date" value={assignmentDueDate} onChange={(event) => setAssignmentDueDate(event.target.value)} className="dr-form-field mt-1.5 w-full max-w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none" /></label>
                <label className="min-w-0 text-xs font-bold text-[var(--dr-text-primary)] dark:text-slate-300">Süre (dk)<input type="number" min="5" step="5" value={assignmentDuration} onChange={(event) => setAssignmentDuration(event.target.value)} className="dr-form-field mt-1.5 w-full max-w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none" /></label>
                {(assignmentTaskTypeKey === 'question' || assignmentTaskTypeKey === 'branch-exam') && <label className="min-w-0 text-xs font-bold text-[var(--dr-text-primary)] dark:text-slate-300 sm:col-span-2">Soru sayısı<input type="number" min="1" value={assignmentQuestionCount} onChange={(event) => setAssignmentQuestionCount(event.target.value)} className="dr-form-field mt-1.5 w-full max-w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none" /></label>}
              </div>

              {assignmentUnits.length === 0 && assignmentCourseName && <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-600 dark:text-amber-300">Bu ders için müfredat ünitesi bulunamadı. Görev atamak için önce Müfredatı Düzenle ekranında ünite ve konu ekleyin.</div>}
              {assignmentMessage && <div className={['mt-3 rounded-xl border px-3 py-2 text-xs font-bold', assignmentMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-300'].join(' ')}>{assignmentMessage.text}</div>}
            </div>

            <div className="dr-compact-modal-footer flex flex-col gap-2 border-t border-[var(--dr-std-border-strong)]/15 p-4 bg-[var(--dr-surface)]/20 sm:flex-row sm:items-center sm:justify-end">
              <button type="button" onClick={closeTaskAssignment} className="ios-button rounded-xl px-3 py-2 text-xs font-bold text-[var(--dr-text-primary)] transition-all active:scale-[0.96] cursor-pointer">Vazgeç</button>
              <button type="submit" disabled={isAssigningTask || !assignmentCourseName || !assignmentUnitName || !assignmentTopicName} className="ios-button-active inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold text-white transition-all active:scale-[0.96] disabled:opacity-50 cursor-pointer"><ClipboardList className="h-4 w-4" />{isAssigningTask ? 'Ekleniyor...' : 'Görevi ata'}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default WeeklySchedulePanel;
