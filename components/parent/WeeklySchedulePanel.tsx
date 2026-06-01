import React, { useEffect, useMemo, useState } from 'react';
import type { Course, CurriculumUnit, ScheduleDayWindow, SubjectCurriculum, Task, WeeklySchedule, WeeklyScheduleSlot } from '../../types';
import { Calendar, CheckCircle, ClipboardList, Clock, PlusCircle, Trash2, X } from '../icons';
import ContextHelp from '../shared/ContextHelp';
import {
  normalizeForLookup,
  taskTypeKeyToTaskType,
  type TaskTypeKey,
} from './parentDashboardShared';

interface WeeklySchedulePanelProps {
  schedule: WeeklySchedule;
  courses: Course[];
  curriculum?: SubjectCurriculum;
  addTask?: (task: Omit<Task, 'id' | 'status'>) => Promise<Task>;
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
const getTodayDateInput = () => new Date().toISOString().slice(0, 10);

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

const WeeklySchedulePanel: React.FC<WeeklySchedulePanelProps> = ({ schedule, courses, curriculum, addTask, onSave, onAddExam }) => {
  const safeSchedule = useMemo(() => schedule || ({} as WeeklySchedule), [schedule]);
  const safeCourses = useMemo(() => (Array.isArray(courses) ? courses : []), [courses]);
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
  const [isAssigningTask, setIsAssigningTask] = useState(false);

  useEffect(() => {
    setDraft(safeSchedule);
  }, [safeSchedule]);

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
  const activeCourseNameSet = useMemo(() => new Set(activeCourses.map((course) => normalizeForLookup(course.name))), [activeCourses]);
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
      ...((assignmentTaskTypeKey === 'question' || assignmentTaskTypeKey === 'branch-exam') && Number(assignmentQuestionCount) > 0 ? { questionCount: Number(assignmentQuestionCount) } : {}),
      curriculumUnitName: assignmentUnitName,
      curriculumTopicName: assignmentTopicName,
      taskGoalType: derivedTaskGoalType,
      planSource: 'manual' as const,
    };

    setIsAssigningTask(true);
    try {
      await addTask(basePayload);
      resetAssignmentForm();
      setAssignmentMessage({ type: 'success', text: 'Görev çocuğun görev listesine eklendi.' });
    } catch (error) {
      setAssignmentMessage({ type: 'error', text: error instanceof Error ? error.message : 'Görev eklenirken beklenmeyen bir hata oluştu.' });
    } finally {
      setIsAssigningTask(false);
    }
  };

  return (
    <>
      <section className="ios-card dr-compact-section">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-primary-600">
            <Calendar className="h-4 w-4" />
            Haftalık zaman
          </div>
          <div className="mt-2 flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Haftalık Program</h2>
            <ContextHelp title="Haftalık Program" tone="blue">
              Ders/konu girişi müfredatta kalır. Burada sadece okul saatleri ve plan motorunun kullanacağı ev çalışma pencereleri yönetilir.
            </ContextHelp>
          </div>
        </div>
        {saved && (
          <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-bold text-emerald-700 shrink-0 self-start">
            Program kaydedildi
          </div>
        )}
      </div>

      {/* Planlama Aksiyonları Kartı */}
      <div className="dr-compact-action-bar flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-bold text-slate-700">Akademik Planlama İşlemleri</div>
        <div className="flex flex-wrap gap-2">
          {onAddExam && (
            <button
              type="button"
              onClick={onAddExam}
              className="ios-button inline-flex items-center justify-center gap-2 rounded-[14px] px-3 py-2 text-xs font-bold text-slate-700"
            >
              <PlusCircle className="h-4 w-4 text-primary-600" />
              Sınav ekle
            </button>
          )}
          <button
            type="button"
            onClick={() => openEditorForDay(activeDay, 'school')}
            className="ios-button inline-flex items-center justify-center gap-2 rounded-[14px] px-3 py-2 text-xs font-bold text-slate-700"
          >
            <PlusCircle className="h-4 w-4 text-primary-600" />
            Okul programını düzenle
          </button>
          <button
            type="button"
            onClick={openTaskAssignment}
            disabled={!addTask}
            className="ios-button-active inline-flex items-center justify-center gap-2 rounded-[14px] px-3 py-2 text-xs font-black text-slate-900 disabled:opacity-50"
          >
            <ClipboardList className="h-4 w-4" />
            Görev ata
          </button>
        </div>
      </div>

      <div className="hidden">
        <div className="dr-compact-card border border-white/10 bg-white/5">
          <div className="text-xs font-bold uppercase text-slate-500">Okul bloğu</div>
          <div className="mt-1 text-2xl font-black text-slate-900">{totalSchoolBlocks}</div>
        </div>
        <div className="dr-compact-card border border-white/10 bg-white/5">
          <div className="text-xs font-bold uppercase text-slate-500">Çalışma zamanı</div>
          <div className="mt-1 text-2xl font-black text-slate-900">{totalStudyWindows}</div>
        </div>
        <div className="dr-compact-card border border-white/10 bg-white/5">
          <div className="text-xs font-bold uppercase text-slate-500">Onaylı gün</div>
          <div className="mt-1 text-2xl font-black text-slate-900">{confirmedDayCount}</div>
        </div>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={handleCloseEditor}>
          <div className="ios-card dr-compact-modal flex max-h-[84dvh] w-full max-w-2xl flex-col overflow-hidden" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Haftalık program düzenleme">
            <div className="dr-compact-modal-header flex items-start justify-between gap-4 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-primary-600">
                  <PlusCircle className="h-4 w-4" />
                  Haftalık zaman düzeni
                </div>
                <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-white">{activeDay}</h3>
                <p className="mt-0.5 text-xs text-slate-500">Okuldaki ders bloklarını ve evde çalışılabilecek saatleri ayrı girin.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditorPreview((current) => !current)}
                  className="ios-button inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-slate-700"
                  aria-expanded={showEditorPreview}
                  aria-label="Seçili günün ön izlemesini aç veya kapat"
                >
                  <Calendar className="h-4 w-4 text-primary-600" />
                  Ön izleme
                </button>
                <button
                  type="button"
                  onClick={handleCloseEditor}
                  className="ios-button flex h-9 w-9 items-center justify-center rounded-full p-0 text-slate-600"
                  aria-label="Program düzenlemeyi kapat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {showEditorPreview && (
              <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={() => setShowEditorPreview(false)}>
                <section
                  className="dr-week-preview-modal w-full max-w-5xl overflow-hidden p-4"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Haftalık program ön izleme"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-500">Haftalık ön izleme</div>
                      <h3 className="mt-1 text-xl font-black text-slate-900 dark:text-white">Tüm hafta planı</h3>
                      <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Okul blokları ve ev çalışma pencereleri tek ekranda.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowEditorPreview(false)}
                      className="ios-button flex h-9 w-9 items-center justify-center rounded-full p-0 text-slate-600"
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
                              <div key={`week-slot-${day}-${slot.id}`} className={`dr-compact-row border-l-3 ${getCourseStyle(slot.courseName)}`}>
                                <div className="text-[9px] font-bold uppercase opacity-80">{slot.startTime} - {slot.endTime}</div>
                                <div className="mt-0.5 truncate text-xs font-black text-slate-900 dark:text-white">{slot.courseName}</div>
                              </div>
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
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1.1fr)_112px_112px_minmax(0,1fr)_130px]">
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
                    <button onClick={handleAddSchoolBlock} className="ios-button-active flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-900">
                      <PlusCircle className="h-4 w-4" />
                      Ekle
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-[112px_112px_minmax(0,1fr)_150px]">
                    <input value={studyStartTime} onChange={(event) => setStudyStartTime(event.target.value)} type="time" className="dr-form-field w-full min-w-[112px] rounded-xl px-3 py-2 text-sm font-semibold outline-none" />
                    <input value={studyEndTime} onChange={(event) => setStudyEndTime(event.target.value)} type="time" className="dr-form-field w-full min-w-[112px] rounded-xl px-3 py-2 text-sm font-semibold outline-none" />
                    <select value={studyQuality} onChange={(event) => setStudyQuality(event.target.value as ScheduleDayWindow['quality'])} className="dr-form-field w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none">
                      <option value="light">Soru Çözümü & Pratik (Test)</option>
                      <option value="medium">Konu Çalışması & Tekrar</option>
                      <option value="deep">Deneme Sınavı (LGS / Branş) & Soru Analizi</option>
                    </select>
                    <button onClick={handleAddStudyWindow} className="ios-button-active flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-900">
                      <PlusCircle className="h-4 w-4" />
                      Çalışma ekle
                    </button>
                  </div>
                )}

                {error && <div className="rounded-2xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}

                <div className="grid gap-3 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{activeDay} okul blokları</div>
                    <div className="space-y-2">
                      {activeDaySchedule.slots.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-white/20 px-3 py-2 text-xs text-slate-500">Okul dersi eklenmedi.</div>
                      ) : (
                        sortSlots(activeDaySchedule.slots).map((slot) => (
                          <div key={`detail-${slot.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5">
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 dark:text-white">{slot.courseName}</div>
                              <div className="mt-0.5 text-[10px] text-slate-500">{slot.startTime} - {slot.endTime}{slot.note ? ` - ${slot.note}` : ''}</div>
                            </div>
                            <button onClick={() => handleRemoveSlot(activeDay, slot.id)} className="dr-destructive-button flex h-8 w-8 items-center justify-center rounded-full p-0" title="Ders bloğunu sil">
                              <Trash2 className="h-4 w-4" />
                            </button>
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
                          <div key={`detail-${createWindowKey(window, index)}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5">
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

            <div className="dr-compact-modal-footer flex flex-col gap-3 border-t border-white/10 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <Clock className="h-4 w-4" />
                {hasDraftChanges ? 'Kaydedilmemiş program değişikliği var.' : 'Program güncel.'}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
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

      {isTaskAssignmentOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={closeTaskAssignment}>
          <form className="ios-card dr-compact-modal flex max-h-[84dvh] w-full max-w-2xl flex-col overflow-hidden" onSubmit={handleAssignTask} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Çocuğa görev ata">
            <div className="dr-compact-modal-header flex items-start justify-between gap-4 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-primary-600">
                  <ClipboardList className="h-4 w-4" />
                  Çocuğa görev ata
                </div>
                <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-white">Plan içinden hızlı görev</h3>
                <p className="mt-0.5 text-xs text-slate-500">Ders, ünite ve konu seçerek görevi doğrudan çocuğun görev listesine gönder.</p>
              </div>
              <button type="button" onClick={closeTaskAssignment} className="ios-button flex h-9 w-9 items-center justify-center rounded-full p-0 text-slate-600" aria-label="Görev atama penceresini kapat">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="dr-modal-scroll dr-compact-modal-body flex-1 overflow-y-auto">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Ders<select value={assignmentCourseName} onChange={(event) => { setAssignmentCourseName(event.target.value); setAssignmentUnitName(''); setAssignmentTopicName(''); setAssignmentMessage(null); }} className="dr-form-field mt-1.5 w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none"><option value="">Ders seç</option>{assignmentSubjectOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Görev tipi<select value={assignmentTaskTypeKey} onChange={(event) => setAssignmentTaskTypeKey(event.target.value as TaskTypeKey)} className="dr-form-field mt-1.5 w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none"><option value="study">Ders çalışma</option><option value="revision">Konu tekrarı</option><option value="question">Soru çözme</option><option value="branch-exam">Branş deneme (ders bazlı)</option><option value="general-exam">Genel deneme sınavı</option></select></label>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Ünite<select value={assignmentUnitName} onChange={(event) => { setAssignmentUnitName(event.target.value); setAssignmentTopicName(''); setAssignmentMessage(null); }} disabled={!assignmentUnits.length} className="dr-form-field mt-1.5 w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none disabled:opacity-50"><option value="">Ünite seç</option>{assignmentUnits.map((unit) => <option key={unit.name} value={unit.name}>{unit.name}</option>)}</select></label>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Konu<select value={assignmentTopicName} onChange={(event) => { setAssignmentTopicName(event.target.value); setAssignmentMessage(null); }} disabled={!assignmentTopics.length} className="dr-form-field mt-1.5 w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none disabled:opacity-50"><option value="">Konu seç</option>{assignmentTopics.map((topic) => <option key={topic.name} value={topic.name}>{topic.name}</option>)}</select></label>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Teslim tarihi<input type="date" value={assignmentDueDate} onChange={(event) => setAssignmentDueDate(event.target.value)} className="dr-form-field mt-1.5 w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none" /></label>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Süre (dk)<input type="number" min="5" step="5" value={assignmentDuration} onChange={(event) => setAssignmentDuration(event.target.value)} className="dr-form-field mt-1.5 w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none" /></label>
                {(assignmentTaskTypeKey === 'question' || assignmentTaskTypeKey === 'branch-exam') && <label className="text-xs font-bold text-slate-700 dark:text-slate-300 sm:col-span-2">Soru sayısı<input type="number" min="1" value={assignmentQuestionCount} onChange={(event) => setAssignmentQuestionCount(event.target.value)} className="dr-form-field mt-1.5 w-full rounded-xl px-2.5 py-2 text-xs font-semibold outline-none" /></label>}
              </div>

              {assignmentUnits.length === 0 && assignmentCourseName && <div className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300">Bu ders için müfredat ünitesi bulunamadı. Görev atamak için önce Müfredatı Düzenle ekranında ünite ve konu ekleyin.</div>}
              {assignmentMessage && <div className={['mt-3 rounded-xl px-3 py-2 text-xs font-bold', assignmentMessage.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300'].join(' ')}>{assignmentMessage.text}</div>}
            </div>

            <div className="dr-compact-modal-footer flex flex-col gap-2 border-t border-white/10 sm:flex-row sm:items-center sm:justify-end">
              <button type="button" onClick={closeTaskAssignment} className="ios-button rounded-xl px-3 py-2 text-xs font-bold text-slate-700">Vazgeç</button>
              <button type="submit" disabled={isAssigningTask || !assignmentCourseName || !assignmentUnitName || !assignmentTopicName} className="ios-button-active inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 disabled:opacity-50"><ClipboardList className="h-4 w-4" />{isAssigningTask ? 'Ekleniyor...' : 'Görevi ata'}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default WeeklySchedulePanel;
