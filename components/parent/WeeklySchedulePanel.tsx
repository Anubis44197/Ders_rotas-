import React, { useEffect, useMemo, useState } from 'react';
import type { Course, CurriculumUnit, ScheduleDayWindow, SubjectCurriculum, Task, WeeklySchedule, WeeklyScheduleSlot } from '../../types';
import { Calendar, CheckCircle, ClipboardList, Clock, PlusCircle, Trash2, X } from '../icons';
import {
  ASSIGNMENT_METRIC_OPTIONS,
  ASSIGNMENT_METRICS_BY_TASK_TYPE,
  assignmentMetricLabelMap,
  normalizeForLookup,
  taskTypeKeyToTaskType,
  type AssignmentMetricKey,
  type TaskTypeKey,
} from './parentDashboardShared';

interface WeeklySchedulePanelProps {
  schedule: WeeklySchedule;
  courses: Course[];
  curriculum?: SubjectCurriculum;
  addTask?: (task: Omit<Task, 'id' | 'status'>) => Promise<Task>;
  onSave: (schedule: WeeklySchedule) => void;
}

type EditorMode = 'school' | 'study';

const DAYS = ['Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma', 'Cumartesi', 'Pazar'];
const QUALITY_META: Record<ScheduleDayWindow['quality'], { label: string; tone: string }> = {
  light: { label: 'Hafif tekrar', tone: 'border-sky-400 text-sky-700' },
  medium: { label: 'Normal çalışma', tone: 'border-indigo-400 text-indigo-700' },
  deep: { label: 'Derin odak', tone: 'border-emerald-400 text-emerald-700' },
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

const dayHasChanges = (left: WeeklySchedule[string] | string | undefined, right: WeeklySchedule[string] | string | undefined) => {
  const leftDay = resolveScheduleDay(left);
  const rightDay = resolveScheduleDay(right);
  return JSON.stringify(leftDay) !== JSON.stringify(rightDay);
};

const WeeklySchedulePanel: React.FC<WeeklySchedulePanelProps> = ({ schedule, courses, curriculum, addTask, onSave }) => {
  const safeSchedule = useMemo(() => schedule || ({} as WeeklySchedule), [schedule]);
  const safeCourses = useMemo(() => (Array.isArray(courses) ? courses : []), [courses]);
  const [draft, setDraft] = useState<WeeklySchedule>(safeSchedule);
  const [saved, setSaved] = useState(false);
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
  const [assignmentSelectedMetrics, setAssignmentSelectedMetrics] = useState<AssignmentMetricKey[]>([]);
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
  const assignmentMetricOptions = useMemo(
    () => ASSIGNMENT_METRIC_OPTIONS.filter((metric) => (ASSIGNMENT_METRICS_BY_TASK_TYPE[assignmentTaskTypeKey] || []).includes(metric.key)),
    [assignmentTaskTypeKey],
  );

  const hasDraftChanges = useMemo(
    () => DAYS.some((day) => dayHasChanges(draft[day], safeSchedule[day])),
    [draft, safeSchedule],
  );

  const activeDaySchedule = resolveScheduleDay(draft[activeDay]);
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
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setDraft(safeSchedule);
    setError('');
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
    setIsEditorOpen(false);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const resetAssignmentForm = () => {
    setAssignmentDueDate(getTodayDateInput());
    setAssignmentDuration('30');
    setAssignmentTaskTypeKey('study');
    setAssignmentQuestionCount('');
    setAssignmentSelectedMetrics([]);
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

  const toggleAssignmentMetric = (metricKey: AssignmentMetricKey) => {
    setAssignmentSelectedMetrics((prev) => (prev.includes(metricKey) ? [] : [metricKey]));
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
    const derivedTaskGoalType = assignmentTaskTypeKey === 'question' ? 'test-cozme' : assignmentTaskTypeKey === 'revision' ? 'konu-tekrari' : 'ders calisma';
    const payload: Omit<Task, 'id' | 'status'> = {
      title: generatedTitle,
      dueDate: assignmentDueDate,
      courseId: resolvedCourseId,
      taskType: taskTypeKeyToTaskType(assignmentTaskTypeKey),
      plannedDuration,
      ...(assignmentTaskTypeKey === 'question' && Number(assignmentQuestionCount) > 0 ? { questionCount: Number(assignmentQuestionCount) } : {}),
      ...(assignmentSelectedMetrics.length > 0 ? { selectedMetrics: assignmentSelectedMetrics, metricTargetScore: 100 as const } : {}),
      curriculumUnitName: assignmentUnitName,
      curriculumTopicName: assignmentTopicName,
      taskGoalType: derivedTaskGoalType,
      planSource: 'manual' as const,
    };

    setIsAssigningTask(true);
    try {
      await addTask(payload);
      resetAssignmentForm();
      setAssignmentMessage({ type: 'success', text: 'Görev çocuğun görev listesine eklendi.' });
    } catch (error) {
      setAssignmentMessage({ type: 'error', text: error instanceof Error ? error.message : 'Görev eklenirken beklenmeyen bir hata oluştu.' });
    } finally {
      setIsAssigningTask(false);
    }
  };

  return (
    <section className="ios-card rounded-[28px] p-5">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-primary-600">
            <Calendar className="h-4 w-4" />
            Haftalık Zaman Zemini
          </div>
          <h2 className="mt-2 text-2xl font-black text-slate-900">Okul programı ve ev çalışma zamanı</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-500">
            Ders/k konu girişi müfredatta kalır. Burada sadece okul saatleri ve plan motorunun kullanacağı ev çalışma pencereleri yönetilir.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 xl:items-end">
          <div className="flex flex-col gap-2 sm:flex-row xl:justify-end">
            <button
              type="button"
              onClick={() => openEditorForDay(activeDay, 'school')}
              className="ios-button inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700"
            >
              <PlusCircle className="h-4 w-4 text-primary-600" />
              Okul programını düzenle
            </button>
            <button
              type="button"
              onClick={openTaskAssignment}
              disabled={!addTask}
              className="ios-button-active inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-slate-900 disabled:opacity-50"
            >
              <ClipboardList className="h-4 w-4" />
              Görev ata
            </button>
          </div>
          {saved && (
            <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700">
              Program kaydedildi
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="text-xs font-bold uppercase text-slate-500">Okul bloğu</div>
          <div className="mt-1 text-2xl font-black text-slate-900">{totalSchoolBlocks}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="text-xs font-bold uppercase text-slate-500">Çalışma zamanı</div>
          <div className="mt-1 text-2xl font-black text-slate-900">{totalStudyWindows}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="text-xs font-bold uppercase text-slate-500">Onaylı gün</div>
          <div className="mt-1 text-2xl font-black text-slate-900">{confirmedDayCount}</div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {DAYS.map((day) => {
          const dayState = resolveScheduleDay(safeSchedule[day]);
          const isActiveDay = day === activeDay;
          return (
            <div
              key={`summary-${day}`}
              className={`min-h-[240px] rounded-[20px] border border-white/10 bg-white/5 p-4 transition ${isActiveDay ? 'ring-2 ring-primary-400/50' : ''}`}
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

              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openEditorForDay(day, 'school')}
                  className="ios-button rounded-full px-3 py-1.5 text-xs font-bold text-slate-700"
                >
                  Ders bloğu ekle
                </button>
                <button
                  type="button"
                  onClick={() => openEditorForDay(day, 'study')}
                  className="ios-button rounded-full px-3 py-1.5 text-xs font-bold text-slate-700"
                >
                  Çalışma zamanı ekle
                </button>
              </div>

              <div className="space-y-2">
                {dayState.slots.length === 0 && dayState.availableWindows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/20 px-3 py-4 text-center text-xs text-slate-400">
                    Bu gün için okul veya çalışma zamanı tanımlı değil.
                  </div>
                ) : (
                  <>
                    {sortSlots(dayState.slots).map((slot) => (
                      <div key={slot.id} className="rounded-2xl border-l-4 border-blue-500 bg-white/10 px-3 py-3">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-blue-700">{slot.startTime} - {slot.endTime}</div>
                        <div className="mt-1 text-sm font-bold text-slate-900">{slot.courseName}</div>
                        {slot.note && <div className="mt-1 text-xs text-slate-500">{slot.note}</div>}
                      </div>
                    ))}
                    {sortWindows(dayState.availableWindows).map((window, index) => (
                      <div key={createWindowKey(window, index)} className={`rounded-2xl border-l-4 bg-white/10 px-3 py-3 ${QUALITY_META[window.quality].tone}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wide">{window.startTime} - {window.endTime}</div>
                        <div className="mt-1 text-sm font-bold text-slate-900">{QUALITY_META[window.quality].label}</div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isEditorOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={handleCloseEditor}>
          <div className="ios-card flex max-h-[88dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px]" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Haftalık program düzenleme">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-primary-600">
                  <PlusCircle className="h-4 w-4" />
                  Haftalık zaman düzeni
                </div>
                <h3 className="mt-2 text-2xl font-black text-slate-900">{activeDay}</h3>
                <p className="mt-1 text-sm text-slate-500">Okuldaki ders bloklarını ve evde çalışılabilecek saatleri ayrı girin.</p>
              </div>
              <button
                type="button"
                onClick={handleCloseEditor}
                className="ios-button flex h-11 w-11 items-center justify-center rounded-full p-0 text-slate-600"
                aria-label="Program düzenlemeyi kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="dr-modal-scroll flex-1 overflow-y-auto px-6 py-5">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => {
                    const dayState = resolveScheduleDay(draft[day]);
                    const active = day === activeDay;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setActiveDay(day)}
                        className={`rounded-full px-3 py-2 text-left text-sm font-bold transition ${active ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}
                      >
                        {day}
                        <span className="ml-2 text-xs font-medium text-slate-500">{dayState.slots.length + dayState.availableWindows.length} blok</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEditorMode('school')}
                    className={`rounded-full px-4 py-2 text-sm font-bold ${editorMode === 'school' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}
                  >
                    Okul dersi
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode('study')}
                    className={`rounded-full px-4 py-2 text-sm font-bold ${editorMode === 'study' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}
                  >
                    Ev çalışma zamanı
                  </button>
                  <div className={`ml-auto inline-flex rounded-full px-3 py-1 text-xs font-bold ${activeDaySchedule.confirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {activeDaySchedule.confirmed ? 'Onaylandı' : 'Onay bekliyor'}
                  </div>
                </div>

                {editorMode === 'school' ? (
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_110px_110px_minmax(0,1fr)_170px]">
                    <select
                      value={selectedCourseName}
                      onChange={(event) => setSelectedCourseName(event.target.value)}
                      className="dr-form-field w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none"
                    >
                      <option value="">Müfredattan ders seç</option>
                      {activeCourses.map((course, index) => (
                        <option key={`${course.id}-${course.name}-${index}`} value={course.name}>{course.name}</option>
                      ))}
                    </select>
                    <input value={startTime} onChange={(event) => setStartTime(event.target.value)} type="time" className="dr-form-field w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none" />
                    <input value={endTime} onChange={(event) => setEndTime(event.target.value)} type="time" className="dr-form-field w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none" />
                    <input
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Sınıf, öğretmen veya not"
                      className="dr-form-field w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none"
                    />
                    <button onClick={handleAddSchoolBlock} className="ios-button-active flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900">
                      <PlusCircle className="h-4 w-4" />
                      Ders bloğu ekle
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-3 xl:grid-cols-[110px_110px_minmax(0,1fr)_190px]">
                    <input value={studyStartTime} onChange={(event) => setStudyStartTime(event.target.value)} type="time" className="dr-form-field w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none" />
                    <input value={studyEndTime} onChange={(event) => setStudyEndTime(event.target.value)} type="time" className="dr-form-field w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none" />
                    <select value={studyQuality} onChange={(event) => setStudyQuality(event.target.value as ScheduleDayWindow['quality'])} className="dr-form-field w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none">
                      <option value="light">Hafif tekrar</option>
                      <option value="medium">Normal çalışma</option>
                      <option value="deep">Derin odak</option>
                    </select>
                    <button onClick={handleAddStudyWindow} className="ios-button-active flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900">
                      <PlusCircle className="h-4 w-4" />
                      Çalışma zamanı ekle
                    </button>
                  </div>
                )}

                {error && <div className="rounded-2xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}

                <div className="grid gap-3 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{activeDay} okul blokları</div>
                    <div className="space-y-2">
                      {activeDaySchedule.slots.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/20 px-4 py-3 text-sm text-slate-500">Okul dersi eklenmedi.</div>
                      ) : (
                        sortSlots(activeDaySchedule.slots).map((slot) => (
                          <div key={`detail-${slot.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-slate-900">{slot.courseName}</div>
                              <div className="mt-1 text-xs text-slate-500">{slot.startTime} - {slot.endTime}{slot.note ? ` - ${slot.note}` : ''}</div>
                            </div>
                            <button onClick={() => handleRemoveSlot(activeDay, slot.id)} className="dr-destructive-button flex h-11 w-11 items-center justify-center rounded-full p-0" title="Ders bloğunu sil">
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
                        <div className="rounded-2xl border border-dashed border-white/20 px-4 py-3 text-sm text-slate-500">Plan motorunun kullanacağı çalışma zamanı eklenmedi.</div>
                      ) : (
                        sortWindows(activeDaySchedule.availableWindows).map((window, index) => (
                          <div key={`detail-${createWindowKey(window, index)}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-slate-900">{QUALITY_META[window.quality].label}</div>
                              <div className="mt-1 text-xs text-slate-500">{window.startTime} - {window.endTime}</div>
                            </div>
                            <button onClick={() => handleRemoveWindow(activeDay, window)} className="dr-destructive-button flex h-11 w-11 items-center justify-center rounded-full p-0" title="Çalışma penceresini sil">
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

            <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <Clock className="h-4 w-4" />
                {hasDraftChanges ? 'Kaydedilmemiş program değişikliği var.' : 'Program güncel.'}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => handleConfirmDay(activeDay)}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white"
                >
                  <CheckCircle className="h-4 w-4" />
                  Günü onayla
                </button>
                <button onClick={() => handleMarkDayEmpty(activeDay)} className="ios-button rounded-2xl px-4 py-3 text-sm font-bold text-slate-700">
                  Bu gün okul/çalışma yok
                </button>
                <button type="button" onClick={handleCloseEditor} className="ios-button rounded-2xl px-4 py-3 text-sm font-bold text-slate-700">
                  Vazgeç
                </button>
                <button type="button" onClick={handleSave} disabled={!hasDraftChanges} className="ios-button-active rounded-2xl px-5 py-3 text-sm font-bold text-slate-900 disabled:opacity-50">
                  Programı kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isTaskAssignmentOpen && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={closeTaskAssignment}>
          <form className="ios-card flex max-h-[88dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px]" onSubmit={handleAssignTask} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Çocuğa görev ata">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-primary-600">
                  <ClipboardList className="h-4 w-4" />
                  Çocuğa görev ata
                </div>
                <h3 className="mt-2 text-2xl font-black text-slate-900">Plan içinden hızlı görev</h3>
                <p className="mt-1 text-sm text-slate-500">Ders, ünite ve konu seçerek görevi doğrudan çocuğun görev listesine gönder.</p>
              </div>
              <button type="button" onClick={closeTaskAssignment} className="ios-button flex h-11 w-11 items-center justify-center rounded-full p-0 text-slate-600" aria-label="Görev atama penceresini kapat">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="dr-modal-scroll flex-1 overflow-y-auto px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold text-slate-700">Ders<select value={assignmentCourseName} onChange={(event) => { setAssignmentCourseName(event.target.value); setAssignmentUnitName(''); setAssignmentTopicName(''); setAssignmentMessage(null); }} className="dr-form-field mt-2 w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none"><option value="">Ders seç</option>{assignmentSubjectOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label className="text-sm font-bold text-slate-700">Görev tipi<select value={assignmentTaskTypeKey} onChange={(event) => setAssignmentTaskTypeKey(event.target.value as TaskTypeKey)} className="dr-form-field mt-2 w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none"><option value="study">Ders çalışma</option><option value="question">Soru çözme</option><option value="revision">Konu tekrarı</option></select></label>
                <label className="text-sm font-bold text-slate-700">Ünite<select value={assignmentUnitName} onChange={(event) => { setAssignmentUnitName(event.target.value); setAssignmentTopicName(''); setAssignmentMessage(null); }} disabled={!assignmentUnits.length} className="dr-form-field mt-2 w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none disabled:opacity-50"><option value="">Ünite seç</option>{assignmentUnits.map((unit) => <option key={unit.name} value={unit.name}>{unit.name}</option>)}</select></label>
                <label className="text-sm font-bold text-slate-700">Konu<select value={assignmentTopicName} onChange={(event) => { setAssignmentTopicName(event.target.value); setAssignmentMessage(null); }} disabled={!assignmentTopics.length} className="dr-form-field mt-2 w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none disabled:opacity-50"><option value="">Konu seç</option>{assignmentTopics.map((topic) => <option key={topic.name} value={topic.name}>{topic.name}</option>)}</select></label>
                <label className="text-sm font-bold text-slate-700">Teslim tarihi<input type="date" value={assignmentDueDate} onChange={(event) => setAssignmentDueDate(event.target.value)} className="dr-form-field mt-2 w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none" /></label>
                <label className="text-sm font-bold text-slate-700">Süre (dk)<input type="number" min="5" step="5" value={assignmentDuration} onChange={(event) => setAssignmentDuration(event.target.value)} className="dr-form-field mt-2 w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none" /></label>
                {assignmentTaskTypeKey === 'question' && <label className="text-sm font-bold text-slate-700 sm:col-span-2">Soru sayısı<input type="number" min="1" value={assignmentQuestionCount} onChange={(event) => setAssignmentQuestionCount(event.target.value)} className="dr-form-field mt-2 w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none" /></label>}
              </div>

              <div className="mt-5 rounded-[22px] border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Takip ölçütü</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {assignmentMetricOptions.map((metric) => {
                    const selected = assignmentSelectedMetrics.includes(metric.key);
                    return <button key={metric.key} type="button" onClick={() => toggleAssignmentMetric(metric.key)} className={['rounded-full px-3 py-2 text-xs font-black', selected ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'].join(' ')} title={metric.hint}>{assignmentMetricLabelMap[metric.key]}</button>;
                  })}
                </div>
              </div>

              {assignmentUnits.length === 0 && assignmentCourseName && <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Bu ders için müfredat ünitesi bulunamadı. Görev atamak için önce Müfredatı Düzenle ekranında ünite ve konu ekleyin.</div>}
              {assignmentMessage && <div className={['mt-4 rounded-2xl px-4 py-3 text-sm font-bold', assignmentMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'].join(' ')}>{assignmentMessage.text}</div>}
            </div>

            <div className="flex flex-col gap-2 border-t border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
              <button type="button" onClick={closeTaskAssignment} className="ios-button rounded-2xl px-4 py-3 text-sm font-bold text-slate-700">Vazgeç</button>
              <button type="submit" disabled={isAssigningTask || !assignmentCourseName || !assignmentUnitName || !assignmentTopicName} className="ios-button-active inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-slate-900 disabled:opacity-50"><ClipboardList className="h-4 w-4" />{isAssigningTask ? 'Ekleniyor...' : 'Görevi ata'}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};

export default WeeklySchedulePanel;
