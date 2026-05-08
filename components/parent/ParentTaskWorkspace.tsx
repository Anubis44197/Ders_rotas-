import { isCompletedTask } from '../../utils/taskStatus';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CompositeExamResult,
  Course,
  CurriculumUnit,
  ExamRecord,
  ExamType,
  SubjectCurriculum,
  Task,
} from '../../types';
import { deriveAnalysisSnapshot } from '../../utils/analysisEngine';
import { getTodayString } from '../../utils/dateUtils';
import { ClipboardList, Download, MoreHorizontal, PlusCircle, Settings, Trash2, Upload, X } from '../icons';
import ContextHelp from '../shared/ContextHelp';
import {
  alignmentLabelMap,
  alignmentToneMap,
  ASSIGNMENT_METRIC_OPTIONS,
  ASSIGNMENT_METRICS_BY_TASK_TYPE,
  assignmentMetricLabelMap,
  buildLocalId,
  examTypeLabelMap,
  formatPlanSource,
  formatTaskGoal,
  getParentTaskPriority,
  getTaskDateKey,
  legacyMetricMap,
  normalizeForLookup,
  resolveTaskTypeKey,
  taskTypeKeyToTaskType,
  taskWorkspaceTabs,
  AssignmentMetricKey,
  TaskTypeKey,
  TaskWorkspaceTab,
} from './parentDashboardShared';

type AnalysisSnapshot = ReturnType<typeof deriveAnalysisSnapshot>;

interface ParentTaskWorkspaceProps {
  courses: Course[];
  tasks: Task[];
  curriculum?: SubjectCurriculum;
  analysis: AnalysisSnapshot;
  examRecords: ExamRecord[];
  compositeExamResults: CompositeExamResult[];
  addTask: (task: Omit<Task, 'id' | 'status'>) => Promise<Task>;
  deleteTask: (taskId: string) => void;
  onExportData?: () => Promise<void>;
  onDeleteAllData: () => Promise<void>;
  onImportData: (file: File) => Promise<boolean>;
  onChangeExamRecords?: React.Dispatch<React.SetStateAction<ExamRecord[]>>;
  onChangeCompositeExamResults?: React.Dispatch<React.SetStateAction<CompositeExamResult[]>>;
  onActionMessage: (type: 'success' | 'error', text: string) => void;
  viewMode: 'all' | 'assignment' | 'tasks' | 'exams' | 'data' | 'analysis';
}

const card = 'ios-card rounded-[30px] p-6';
const PARENT_TASK_PREVIEW_LIMIT = 12;

const ParentTaskWorkspace: React.FC<ParentTaskWorkspaceProps> = ({
  courses,
  tasks,
  curriculum,
  analysis,
  examRecords,
  compositeExamResults,
  addTask,
  deleteTask,
  onExportData,
  onDeleteAllData,
  onImportData,
  onChangeExamRecords,
  onChangeCompositeExamResults,
  onActionMessage,
  viewMode,
}) => {
  const [taskWorkspaceTab, setTaskWorkspaceTab] = useState<TaskWorkspaceTab>('assignment');
  const [dueDate, setDueDate] = useState('');
  const initialActiveCourse = courses.find((course) => course.active !== false) || courses[0];
  const [courseId, setCourseId] = useState(initialActiveCourse?.name || '');
  const [taskTypeKey, setTaskTypeKey] = useState<TaskTypeKey>('study');
  const [plannedDuration, setPlannedDuration] = useState('30');
  const [questionCount, setQuestionCount] = useState('');
  const [selectedMetrics, setSelectedMetrics] = useState<AssignmentMetricKey[]>([]);
  const [selectedUnitName, setSelectedUnitName] = useState('');
  const [selectedTopicName, setSelectedTopicName] = useState('');
  const [taskListFilter, setTaskListFilter] = useState<'all' | 'waiting' | 'completed' | 'overdue'>('waiting');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeletingAllData, setIsDeletingAllData] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [showDeleteDataModal, setShowDeleteDataModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [openTaskMenuId, setOpenTaskMenuId] = useState<string | null>(null);
  const [examCourseId, setExamCourseId] = useState(initialActiveCourse?.id || '');
  const [examType, setExamType] = useState<ExamType>('school-written');
  const [examTitle, setExamTitle] = useState('');
  const [examDate, setExamDate] = useState(getTodayString());
  const [examScore, setExamScore] = useState('');
  const [examWeight, setExamWeight] = useState('1');
  const [examScopeType, setExamScopeType] = useState<'topic' | 'unit' | 'course' | 'multi-course'>('course');
  const [examTermKey, setExamTermKey] = useState('2025-2026-2');
  const [examNotes, setExamNotes] = useState('');
  const [compositeTitle, setCompositeTitle] = useState('');
  const [compositeDate, setCompositeDate] = useState(getTodayString());
  const [compositeType, setCompositeType] = useState<'state-exam' | 'mock-exam'>('state-exam');
  const [compositeTotalScore, setCompositeTotalScore] = useState('');
  const [compositeNotes, setCompositeNotes] = useState('');
  const [compositeCourseScores, setCompositeCourseScores] = useState('');
  const [examEntryMode, setExamEntryMode] = useState<'course' | 'composite'>('course');
  const [examFormOpen, setExamFormOpen] = useState(false);
  const [showAllVisibleTasks, setShowAllVisibleTasks] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const taskMenuRef = useRef<HTMLDivElement | null>(null);

  const today = getTodayString();
  const activeCourses = useMemo(() => courses.filter((course) => course.active !== false), [courses]);
  const activeCourseNameSet = useMemo(() => new Set(activeCourses.map((course) => normalizeForLookup(course.name))), [activeCourses]);
  const pendingCount = tasks.filter((task) => task.status === 'bekliyor').length;
  const completedCount = tasks.filter((task) => isCompletedTask(task)).length;
  const selectedCourseName = courseId || '';
  const assignmentSubjectOptions = useMemo(() => {
    return Object.keys(curriculum || {})
      .filter((subject) => activeCourseNameSet.has(normalizeForLookup(subject)))
      .map((subject) => ({ value: subject, label: subject }));
  }, [activeCourseNameSet, curriculum]);
  const activeUnits = useMemo<CurriculumUnit[]>(() => {
    if (!curriculum || !selectedCourseName) return [];

    const directUnits = curriculum[selectedCourseName] as CurriculumUnit[] | undefined;
    if (Array.isArray(directUnits) && directUnits.length > 0) {
      return directUnits;
    }

    const normalizedCourseName = normalizeForLookup(selectedCourseName);
    const matchedSubject = Object.keys(curriculum).find((subject) => normalizeForLookup(subject) === normalizedCourseName);
    if (!matchedSubject) return Array.isArray(directUnits) ? directUnits : [];
    return curriculum[matchedSubject] as CurriculumUnit[];
  }, [curriculum, selectedCourseName]);
  const activeTopics = useMemo(() => {
    if (!selectedUnitName) return [];
    return activeUnits.find((unit) => unit.name === selectedUnitName)?.topics || [];
  }, [activeUnits, selectedUnitName]);
  const availableMetricOptions = useMemo(
    () => ASSIGNMENT_METRIC_OPTIONS.filter((metric) => (ASSIGNMENT_METRICS_BY_TASK_TYPE[taskTypeKey] || []).includes(metric.key)),
    [taskTypeKey],
  );
  const courseNameMap = useMemo(() => new Map(courses.map((course) => [course.id, course.name])), [courses]);
  const recentExamRecords = analysis.school.examRecords.slice(0, 5);
  const activeExamCourseCards = useMemo(() => {
    return activeCourses.map((course) => {
      const performance = analysis.school.coursePerformance.find((item) => item.courseId === course.id);
      const courseExamRecords = analysis.school.examRecords.filter((item) => item.courseId === course.id);
      return {
        id: course.id,
        name: course.name,
        recordCount: courseExamRecords.length,
        latestScore: courseExamRecords[0]?.score ?? null,
        predictedScore: performance?.predictedSchoolScore ?? null,
        alignmentStatus: performance?.alignmentStatus ?? 'veri-yetersiz',
      };
    });
  }, [activeCourses, analysis.school.coursePerformance, analysis.school.examRecords]);
  const visibleTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      if (taskListFilter === 'waiting') return task.status === 'bekliyor';
      if (taskListFilter === 'completed') return isCompletedTask(task);
      if (taskListFilter === 'overdue') return task.status === 'bekliyor' && getTaskDateKey(task.dueDate) < today;
      return true;
    });

    return [...filtered].sort((a, b) => {
      const priorityDiff = getParentTaskPriority(a, today) - getParentTaskPriority(b, today);
      if (priorityDiff !== 0) return priorityDiff;
      const dateDiff = getTaskDateKey(a.dueDate).localeCompare(getTaskDateKey(b.dueDate));
      if (dateDiff !== 0) return dateDiff;
      return a.title.localeCompare(b.title);
    });
  }, [tasks, taskListFilter, today]);
  const visibleTaskPage = useMemo(
    () => (showAllVisibleTasks ? visibleTasks : visibleTasks.slice(0, PARENT_TASK_PREVIEW_LIMIT)),
    [visibleTasks, showAllVisibleTasks],
  );
  const showLegacyTaskTabs = viewMode === 'all';
  const showAssignmentSection = viewMode === 'assignment' || (viewMode === 'all' && taskWorkspaceTab === 'assignment');
  const showTaskListSection = viewMode === 'tasks' || (viewMode === 'all' && taskWorkspaceTab === 'list');
  const showExamSection = viewMode === 'exams' || (viewMode === 'all' && taskWorkspaceTab === 'exams');
  const showDataSection = viewMode === 'data' || (viewMode === 'all' && taskWorkspaceTab === 'data');

  useEffect(() => {
    if (!assignmentSubjectOptions.length) {
      setCourseId('');
      return;
    }

    const hasSelectedSubjectName = assignmentSubjectOptions.some((option) => option.value === courseId);
    if (!hasSelectedSubjectName) {
      setCourseId(assignmentSubjectOptions[0]?.value || '');
      setSelectedUnitName('');
      setSelectedTopicName('');
    }
  }, [assignmentSubjectOptions, courseId]);

  useEffect(() => {
    if (taskTypeKey !== 'question') {
      setQuestionCount('');
    }
  }, [taskTypeKey]);

  useEffect(() => {
    if (!activeCourses.length) {
      setExamCourseId('');
      return;
    }

    if (!activeCourses.some((course) => course.id === examCourseId)) {
      setExamCourseId(activeCourses[0]?.id || '');
    }
  }, [activeCourses, examCourseId]);

  useEffect(() => {
    const allowedMetrics = ASSIGNMENT_METRICS_BY_TASK_TYPE[taskTypeKey] || [];
    setSelectedMetrics((prev) => prev.filter((metric) => allowedMetrics.includes(metric)));
  }, [taskTypeKey]);

  useEffect(() => {
    if (!openTaskMenuId) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (taskMenuRef.current?.contains(target)) return;
      setOpenTaskMenuId(null);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [openTaskMenuId]);

  useEffect(() => {
    setShowAllVisibleTasks(false);
    setOpenTaskMenuId(null);
  }, [taskListFilter]);

  const resetTaskForm = () => {
    setDueDate('');
    setTaskTypeKey('study');
    setPlannedDuration('30');
    setQuestionCount('');
    setSelectedMetrics([]);
    setSelectedUnitName('');
    setSelectedTopicName('');
  };

  const toggleMetric = (metricKey: AssignmentMetricKey) => {
    setSelectedMetrics((prev) => (prev.includes(metricKey) ? [] : [metricKey]));
  };

  const handleAddTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isAddingTask) return;

    if (!dueDate || !plannedDuration || !courseId || !selectedUnitName || !selectedTopicName) {
      onActionMessage('error', 'Görev atamak için ders, ünite, konu, tarih ve süre seçimi zorunludur.');
      return;
    }
    const resolvedCourseId = courses.find((course) => normalizeForLookup(course.name) === normalizeForLookup(selectedCourseName))?.id;
    if (!resolvedCourseId) {
      onActionMessage('error', 'Seçili ders için kayıtlı ders kimliği bulunamadı. Önce Müfredat ekranından dersi kaydedin.');
      return;
    }

    const generatedTitle = `${selectedCourseName} / ${selectedUnitName} / ${selectedTopicName}`;
    const derivedTaskGoalType = taskTypeKey === 'question' ? 'test-cozme' : taskTypeKey === 'revision' ? 'konu-tekrari' : 'ders calisma';

    const payload: Omit<Task, 'id' | 'status'> = {
      title: generatedTitle,
      dueDate,
      courseId: resolvedCourseId,
      taskType: taskTypeKeyToTaskType(taskTypeKey),
      plannedDuration: Number(plannedDuration),
      ...(taskTypeKey === 'question' && Number(questionCount) > 0 ? { questionCount: Number(questionCount) } : {}),
      ...(selectedMetrics.length > 0 ? { selectedMetrics, metricTargetScore: 100 as const } : {}),
      ...((selectedUnitName || selectedTopicName)
        ? {
            curriculumUnitName: selectedUnitName || undefined,
            curriculumTopicName: selectedTopicName || undefined,
            taskGoalType: derivedTaskGoalType,
            planSource: 'manual' as const,
          }
        : {}),
    };

    setIsAddingTask(true);
    try {
      await addTask(payload);
      resetTaskForm();
      onActionMessage('success', 'Görev başarıyla eklendi.');
    } finally {
      setIsAddingTask(false);
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isImporting) return;
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json')) {
      onActionMessage('error', 'Lutfen Ders Rotasi yedegi olan bir JSON dosyasi secin.');
      return;
    }
    setSelectedImportFile(file);
  };

  const handleCancelImport = () => {
    if (isImporting) return;
    setSelectedImportFile(null);
  };

  const handleConfirmImport = async () => {
    if (isImporting || !selectedImportFile) return;
    setIsImporting(true);
    try {
      const ok = await onImportData(selectedImportFile);
      if (ok) setSelectedImportFile(null);
    } finally {
      setIsImporting(false);
    }
  };

  const importFileDetails = selectedImportFile
    ? {
        name: selectedImportFile.name,
        size: selectedImportFile.size < 1024 * 1024
          ? `${Math.max(1, Math.round(selectedImportFile.size / 1024))} KB`
          : `${(selectedImportFile.size / 1024 / 1024).toFixed(1)} MB`,
        modified: new Date(selectedImportFile.lastModified).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }),
      }
    : null;

  const handleExportData = async () => {
    if (isExporting || !onExportData) return;
    setIsExporting(true);
    try {
      await onExportData();
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (isDeletingAllData) return;
    setDeleteConfirmText('');
    setShowDeleteDataModal(true);
  };

  const handleConfirmDeleteAllData = async () => {
    if (isDeletingAllData) return;
    if (deleteConfirmText.trim().toUpperCase() !== 'SIL') {
      onActionMessage('error', 'Silmek için onay alanına SIL yazın.');
      return;
    }

    setIsDeletingAllData(true);
    try {
      await onDeleteAllData();
      setShowDeleteDataModal(false);
      setDeleteConfirmText('');
    } finally {
      setIsDeletingAllData(false);
    }
  };

  const handleAddExamRecord = (event: React.FormEvent) => {
    event.preventDefault();
    if (!onChangeExamRecords) {
      onActionMessage('error', 'Sınav kaydı bu ekranda güncellenemiyor.');
      return;
    }

    const selectedCourse = courses.find((course) => course.id === examCourseId);
    const parsedScore = Number(examScore);
    const parsedWeight = Number(examWeight);
    if (!selectedCourse || !examTitle.trim() || !examDate || !Number.isFinite(parsedScore)) {
      onActionMessage('error', 'Ders, sınav başlığı, tarih ve puan zorunludur.');
      return;
    }

    onChangeExamRecords((prev) => [
      {
        id: buildLocalId('exam'),
        courseId: selectedCourse.id,
        courseName: selectedCourse.name,
        examType,
        title: examTitle.trim(),
        date: examDate,
        termKey: examTermKey.trim() || 'genel',
        scopeType: examScopeType,
        score: Math.max(0, Math.min(100, Math.round(parsedScore))),
        weight: Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : 1,
        notes: examNotes.trim() || undefined,
        source: 'manual',
      },
      ...prev,
    ]);

    setExamTitle('');
    setExamScore('');
    setExamWeight('1');
    setExamNotes('');
    setExamFormOpen(false);
    onActionMessage('success', 'Okul sınavı kaydı eklendi.');
  };

  const handleAddCompositeExam = (event: React.FormEvent) => {
    event.preventDefault();
    if (!onChangeCompositeExamResults) {
      onActionMessage('error', 'Genel sınav kaydı bu ekranda güncellenemiyor.');
      return;
    }

    const courseRows = compositeCourseScores
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/[:=-]/).map((item) => item.trim()).filter(Boolean);
        if (parts.length < 2) return null;
        const courseName = parts.slice(0, -1).join(' ');
        const score = Number(parts[parts.length - 1]);
        const matchedCourse = activeCourses.find((course) => normalizeForLookup(course.name) === normalizeForLookup(courseName));
        if (!matchedCourse || !Number.isFinite(score)) return null;
        return {
          courseId: matchedCourse.id,
          courseName: matchedCourse.name,
          score: Math.max(0, Math.min(100, Math.round(score))),
        };
      });

    if (!compositeTitle.trim() || !compositeDate || !courseRows.length || courseRows.some((row) => row === null)) {
      onActionMessage('error', 'Genel sınav için başlık, tarih ve her satırda Ders: Puan formatı zorunludur.');
      return;
    }

    onChangeCompositeExamResults((prev) => [
      {
        id: buildLocalId('composite-exam'),
        title: compositeTitle.trim(),
        examType: compositeType,
        date: compositeDate,
        courses: courseRows.filter((row): row is NonNullable<typeof row> => row !== null),
        totalScore: Number.isFinite(Number(compositeTotalScore)) ? Number(compositeTotalScore) : undefined,
        notes: compositeNotes.trim() || undefined,
      },
      ...prev,
    ]);

    setCompositeTitle('');
    setCompositeTotalScore('');
    setCompositeNotes('');
    setCompositeCourseScores('');
    setExamFormOpen(false);
    onActionMessage('success', 'Genel sınav özeti eklendi.');
  };

  const handleDeleteExamRecord = (recordId: string) => {
    if (!onChangeExamRecords) return;
    onChangeExamRecords((prev) => prev.filter((item) => item.id !== recordId));
  };

  const handleDeleteCompositeExam = (examId: string) => {
    if (!onChangeCompositeExamResults) return;
    onChangeCompositeExamResults((prev) => prev.filter((item) => item.id !== examId));
  };

  return (
    <>
      {showLegacyTaskTabs && <section className="ios-panel rounded-[30px] p-2">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Görev ve veri alanları</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {taskWorkspaceTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTaskWorkspaceTab(tab.id)}
              className={`ios-button rounded-[22px] px-4 py-3 text-left transition ${taskWorkspaceTab === tab.id ? 'ios-button-active' : 'text-slate-700 hover:bg-white/75'}`}
            >
              <span className="block text-sm font-black">{tab.label}</span>
              <span className={`mt-1 block text-xs ${taskWorkspaceTab === tab.id ? 'text-slate-300' : 'text-slate-500'}`}>{tab.description}</span>
            </button>
          ))}
        </div>
      </section>}

      {showAssignmentSection && <div className="ios-card rounded-[32px] p-6">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">Görev atama</div>
            <h3 className="mt-1 text-2xl font-black text-slate-900">Çocuğa görev gönder</h3>
            <p className="mt-1 text-sm text-slate-500">Günlük ana işlem: ders, konu, tarih ve süre seç; görevi tek adımda ata.</p>
          </div>
          <div className="ios-widget rounded-[22px] px-4 py-3 text-sm text-slate-600">
            Bekleyen <strong>{pendingCount}</strong> / Tamamlanan <strong>{completedCount}</strong>
          </div>
        </div>

        <nav className="dr-path-control mb-5" aria-label="Görev konumu">
          <button
            type="button"
            className={`dr-path-segment truncate ${selectedCourseName ? '' : 'dr-path-segment-muted'}`}
            onClick={() => {
              setSelectedUnitName('');
              setSelectedTopicName('');
            }}
            title="Ders secimine don"
          >
            {selectedCourseName || 'Ders'}
          </button>
          <span className="dr-path-separator" aria-hidden="true">/</span>
          <button
            type="button"
            className={`dr-path-segment truncate ${selectedUnitName ? '' : 'dr-path-segment-muted'}`}
            onClick={() => setSelectedTopicName('')}
            disabled={!selectedUnitName}
            title="Unite secimini koru, konuyu temizle"
          >
            {selectedUnitName || 'Unite'}
          </button>
          <span className="dr-path-separator" aria-hidden="true">/</span>
          <span className={`dr-path-segment truncate ${selectedTopicName ? '' : 'dr-path-segment-muted'}`}>
            {selectedTopicName || 'Konu'}
          </span>
        </nav>

        <form onSubmit={handleAddTask} className="space-y-4">
          <div className="ios-widget rounded-[26px] p-4">
            <div className="grid gap-3 lg:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Ders</span>
                <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setSelectedUnitName(''); setSelectedTopicName(''); }} className="dr-form-field w-full rounded-[20px] px-3 py-3 text-sm font-semibold outline-none">
                  {assignmentSubjectOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Unite</span>
                <select value={selectedUnitName} onChange={(e) => { setSelectedUnitName(e.target.value); setSelectedTopicName(''); }} className="dr-form-field w-full rounded-[20px] px-3 py-3 text-sm font-semibold outline-none">
                  <option value="">Unite sec</option>
                  {activeUnits.map((unit) => <option key={unit.name} value={unit.name}>{unit.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Konu</span>
                <select value={selectedTopicName} onChange={(e) => setSelectedTopicName(e.target.value)} className="dr-form-field w-full rounded-[20px] px-3 py-3 text-sm font-semibold outline-none" disabled={!selectedUnitName}>
                  <option value="">Konu sec</option>
                  {activeTopics.map((topic) => <option key={topic.name} value={topic.name}>{topic.name}</option>)}
                </select>
              </label>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_9rem_9rem_12rem_10rem]">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Görev başlığı</span>
                <input value={`${selectedCourseName || 'Ders'}${selectedUnitName ? ` / ${selectedUnitName}` : ''}${selectedTopicName ? ` / ${selectedTopicName}` : ''}`} readOnly className="dr-form-field w-full rounded-[20px] px-3 py-3 text-sm font-semibold outline-none" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Tarih</span>
                <input value={dueDate} onChange={(e) => setDueDate(e.target.value)} type="date" className="dr-form-field w-full rounded-[20px] px-3 py-3 text-sm font-semibold outline-none" required />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Süre</span>
                <input value={plannedDuration} onChange={(e) => setPlannedDuration(e.target.value)} type="number" min="1" placeholder="dk" className="dr-form-field w-full rounded-[20px] px-3 py-3 text-sm font-semibold outline-none" required />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Görev türü</span>
                <select value={taskTypeKey} onChange={(e) => setTaskTypeKey(resolveTaskTypeKey(e.target.value))} className="dr-form-field w-full rounded-[20px] px-3 py-3 text-sm font-semibold outline-none">
                  <option value="study">Ders Çalışması</option>
                  <option value="revision">Ders Tekrari</option>
                  <option value="question">Soru Cozme</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Soru</span>
                <input
                  value={questionCount}
                  onChange={(e) => setQuestionCount(e.target.value)}
                  type="number"
                  min="1"
                  placeholder={taskTypeKey === 'question' ? '20' : '-'}
                  disabled={taskTypeKey !== 'question'}
                  className="dr-form-field w-full rounded-[20px] px-3 py-3 text-sm font-semibold outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
              </label>
            </div>
          </div>

          <details className="ios-widget rounded-[22px] p-4">
            <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-bold text-slate-900">
              Olcum ve hedef
              <span className="text-xs font-semibold text-slate-500">{selectedMetrics.length ? assignmentMetricLabelMap[selectedMetrics[0]] : 'Opsiyonel'}</span>
            </summary>
            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,18rem)_1fr]">
              <div className="dr-token-field" aria-label="Seçili ölçüm metrikleri">
                {selectedMetrics.length === 0 ? (
                  <span className="dr-token-placeholder">Metrik secilmedi</span>
                ) : selectedMetrics.map((metricKey) => (
                  <span key={metricKey} className="dr-token">
                    {assignmentMetricLabelMap[metricKey]}
                    <button type="button" className="dr-token-remove" onClick={() => setSelectedMetrics([])} aria-label={`${assignmentMetricLabelMap[metricKey]} metrigini kaldir`}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {availableMetricOptions.map((metric) => {
                  const checked = selectedMetrics.includes(metric.key);
                  return (
                    <label key={metric.key} className={`block rounded-[18px] px-3 py-2 transition ${checked ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}>
                      <span className="flex items-start gap-2">
                        <input
                          type="radio"
                          name="assignmentMetric"
                          checked={checked}
                          onChange={() => toggleMetric(metric.key)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-500"
                        />
                        <span>
                          <span className="block text-sm font-semibold leading-5">{metric.label}</span>
                          <span className="block text-[11px] leading-4 text-slate-500">{metric.hint}</span>
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </details>

          <div className="ios-widget flex flex-col gap-3 rounded-[26px] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-sm text-slate-600">
              <strong>Özet:</strong> {selectedCourseName || 'Ders'} {selectedUnitName ? `/ ${selectedUnitName}` : ''} {selectedTopicName ? `/ ${selectedTopicName}` : ''} için görev atanacak{taskTypeKey === 'question' && Number(questionCount) > 0 ? ` (${questionCount} soru)` : ''}.
            </div>
            <button type="submit" disabled={!selectedCourseName || !selectedUnitName || !selectedTopicName || isAddingTask} className="ios-button-active rounded-[20px] px-6 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50">{isAddingTask ? 'Kaydediliyor...' : 'Görevi Ata'}</button>
          </div>
        </form>
      </div>}

      {showTaskListSection && <div className={card}>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-xl font-bold">Görevler</h3>
            <div className="text-sm text-slate-500">Bekleyen {pendingCount} / Tamamlanan {completedCount}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setTaskListFilter('waiting')} className={`rounded-full px-3 py-2 text-xs font-bold ${taskListFilter === 'waiting' ? 'ios-button-active' : 'ios-button text-slate-600'}`}>Bekleyen</button>
            <button onClick={() => setTaskListFilter('overdue')} className={`rounded-full px-3 py-2 text-xs font-bold ${taskListFilter === 'overdue' ? 'ios-coral text-rose-950' : 'ios-button text-slate-600'}`}>Takipte</button>
            <button onClick={() => setTaskListFilter('completed')} className={`rounded-full px-3 py-2 text-xs font-bold ${taskListFilter === 'completed' ? 'ios-mint text-emerald-950' : 'ios-button text-slate-600'}`}>Tamamlanan</button>
            <button onClick={() => setTaskListFilter('all')} className={`rounded-full px-3 py-2 text-xs font-bold ${taskListFilter === 'all' ? 'ios-lilac text-violet-950' : 'ios-button text-slate-600'}`}>Tümü</button>
          </div>
        </div>
        <div className="space-y-3">
          {visibleTasks.length === 0 && <div className="ios-widget rounded-[22px] p-5 text-sm text-slate-500">Bu filtreye uygun görev yok.</div>}
          {visibleTaskPage.map((task) => {
            const isOverdue = task.status === 'bekliyor' && getTaskDateKey(task.dueDate) < today;
            const normalizedSelectedMetrics = Array.isArray(task.selectedMetrics)
              ? task.selectedMetrics.filter((metric): metric is AssignmentMetricKey => metric in assignmentMetricLabelMap)
              : [];
            const legacySelectedMetrics = legacyMetricMap
              .filter(({ field }) => typeof task[field] === 'number' && Number(task[field]) > 0)
              .map(({ key }) => key);
            const taskMetrics = Array.from(new Set([...normalizedSelectedMetrics, ...legacySelectedMetrics]));
            const taskMetricTargetScore = task.metricTargetScore || (taskMetrics.length > 0 ? 100 : undefined);
            return (
              <div key={task.id} className={`ios-widget rounded-[22px] p-4 ${isOverdue ? 'ios-coral' : ''}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                      <span>{courseNameMap.get(task.courseId) || task.courseId}</span>
                      <span>/</span>
                      <span>{task.plannedDuration} dk</span>
                      {typeof task.questionCount === 'number' && task.questionCount > 0 && <><span>/</span><span>{task.questionCount} soru</span></>}
                      <span>/</span>
                      <span>{task.dueDate}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{formatPlanSource(task.planSource, task.planLabel)}</span>
                      {task.isSelfAssigned && <span className="rounded-full bg-indigo-100 px-2 py-1 text-indigo-700">Serbest</span>}
                      {isOverdue && <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">Takipte</span>}
                    </div>
                    <div className="mt-2 font-semibold text-slate-900">{task.title}</div>
                    <div className="mt-2 text-xs leading-5 text-slate-500">
                      {[task.curriculumUnitName, task.curriculumTopicName, task.taskGoalType ? formatTaskGoal(task.taskGoalType) : '', typeof task.questionCount === 'number' && task.questionCount > 0 ? `${task.questionCount} soru` : '', taskMetrics[0] ? assignmentMetricLabelMap[taskMetrics[0]] : '']
                        .filter(Boolean)
                        .join(' / ') || 'Detay eklenmedi'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isCompletedTask(task) ? 'bg-green-100 text-green-700' : isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {isCompletedTask(task) ? 'Tamamlandı' : isOverdue ? 'Takipte' : 'Bekliyor'}
                    </span>
                    <div className="dr-context-menu-shell" ref={openTaskMenuId === task.id ? taskMenuRef : null}>
                      <button
                        type="button"
                        onClick={() => setOpenTaskMenuId((current) => (current === task.id ? null : task.id))}
                        className="dr-icon-button"
                        aria-label={`${task.title} görev işlemleri`}
                        aria-haspopup="menu"
                        aria-expanded={openTaskMenuId === task.id}
                        title="Görev işlemleri"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {openTaskMenuId === task.id && (
                        <div className="dr-context-menu" role="menu" aria-label={`${task.title} görev işlemleri`}>
                          <div className="dr-context-menu-preview truncate">{task.title}</div>
                          <button
                            type="button"
                            role="menuitem"
                            className="dr-context-menu-item dr-context-menu-item-destructive"
                            onClick={() => {
                              setOpenTaskMenuId(null);
                              deleteTask(task.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Görevi sil
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {visibleTasks.length > PARENT_TASK_PREVIEW_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAllVisibleTasks((value) => !value)}
              className="ios-button w-full rounded-[20px] px-4 py-3 text-sm font-bold text-slate-700"
            >
              {showAllVisibleTasks ? 'Daha az göster' : `${visibleTasks.length - PARENT_TASK_PREVIEW_LIMIT} görev daha göster`}
            </button>
          )}
        </div>
      </div>}

      {showDataSection && <div className={card}>
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
              <Settings className="h-4 w-4" />
              Veri dosyalari
            </div>
            <div className="mt-1 flex items-start gap-2">
              <h3 className="text-2xl font-black text-slate-900">Yedekleme ve geri yukleme</h3>
              <ContextHelp title="Veri guvenligi" tone="mint">
                Yedek dosyası öğrenci kayıtlarını taşır. Yükleme onaylanmadan mevcut veri değişmez; silme için ek onay istenir.
              </ContextHelp>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">Öğrenci, ders, görev, sınav, ödül ve plan verilerini tek Ders Rotası JSON dosyasında sakla.</p>
          </div>
          <div className="ios-widget rounded-[22px] px-4 py-3 text-sm text-slate-600">
            Kayıt özeti: <strong>{courses.length}</strong> ders / <strong>{tasks.length}</strong> görev / <strong>{examRecords.length + compositeExamResults.length}</strong> sınav
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImportFileChange} className="hidden" />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <section className="ios-widget ios-mint rounded-[26px] p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[18px] bg-white/70 text-emerald-700">
              <Download className="h-5 w-5" />
            </div>
            <h4 className="text-lg font-black text-slate-900">Yedek oluştur</h4>
            <p className="mt-2 min-h-[60px] text-sm text-slate-600">Bugünkü verileri indirilebilir bir dosyaya kaydeder. Dosya adı tarihli gelir.</p>
            <button onClick={handleExportData} disabled={isExporting || !onExportData} className={`ios-button-active mt-4 flex w-full items-center justify-center gap-2 rounded-[18px] px-4 py-3 font-bold ${isExporting || !onExportData ? 'cursor-not-allowed opacity-50' : ''}`}>
              <Download className="h-4 w-4" />
              {isExporting ? 'Yedek hazırlanıyor...' : 'Yedek indir'}
            </button>
          </section>

          <section className="ios-widget ios-blue rounded-[26px] p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[18px] bg-white/70 text-blue-700">
              <Upload className="h-5 w-5" />
            </div>
            <h4 className="text-lg font-black text-slate-900">Yedekten yükle</h4>
            <p className="mt-2 min-h-[60px] text-sm text-slate-600">Seçilen dosya önce incelenir. Onay vermeden mevcut veri değişmez.</p>
            <button onClick={handleImportClick} disabled={isImporting} className={`ios-button mt-4 flex w-full items-center justify-center gap-2 rounded-[18px] px-4 py-3 font-bold text-slate-700 ${isImporting ? 'cursor-not-allowed opacity-50' : ''}`}>
              <Upload className="h-4 w-4" />
              Dosya seç
            </button>
          </section>

          <section className="ios-widget ios-coral rounded-[26px] p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[18px] bg-white/70 text-rose-700">
              <Trash2 className="h-5 w-5" />
            </div>
            <h4 className="text-lg font-black text-slate-900">Veriyi temizle</h4>
            <p className="mt-2 min-h-[60px] text-sm text-slate-600">Tüm yerel kayıtları siler. Bu adımdan önce yedek almak en güvenli akıştır.</p>
            <button onClick={handleDeleteAllData} disabled={isDeletingAllData} className={`dr-destructive-button mt-4 flex w-full items-center justify-center gap-2 px-4 py-3 font-bold ${isDeletingAllData ? 'cursor-not-allowed opacity-50' : ''}`}>
              <Trash2 className="h-4 w-4" />
              {isDeletingAllData ? 'Siliniyor...' : 'Tüm veriyi sil'}
            </button>
          </section>
        </div>

        {importFileDetails && (
          <div className="ios-card mt-5 rounded-[28px] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">Seçilen yedek</div>
                <h4 className="mt-1 text-lg font-black text-slate-900">{importFileDetails.name}</h4>
                <p className="mt-1 text-sm text-slate-500">Boyut {importFileDetails.size} / Son değişiklik {importFileDetails.modified}</p>
              </div>
              <div className="dr-button-row">
                <button type="button" onClick={handleCancelImport} disabled={isImporting} className="ios-button rounded-[18px] px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-50">Vazgeç</button>
                <button type="button" onClick={handleConfirmImport} disabled={isImporting} className="ios-button-active rounded-[18px] px-4 py-3 text-sm font-black disabled:opacity-50">
                  {isImporting ? 'Yükleniyor...' : 'Bu yedeği yükle'}
                </button>
              </div>
            </div>
            <div className="ios-coral mt-4 rounded-[20px] px-4 py-3 text-sm text-rose-950">
              Yükleme mevcut ders, görev, sınav, ödül ve plan verilerinin yerine bu dosyadaki kayıtları koyar.
            </div>
          </div>
        )}

        <div className="ios-widget mt-5 rounded-[24px] p-4 text-sm text-slate-600">
          Yedek dosyaları şifrelenmez. Öğrenciye ait takip verileri içerdiği için dosyayı yalnızca güvendiğiniz konumlarda saklayın.
        </div>
      </div>}

      {showDeleteDataModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm" role="presentation">
          <div className="ios-card w-full max-w-md rounded-[28px] p-6" role="dialog" aria-modal="true" aria-labelledby="delete-data-title">
            <div className="mb-4 flex items-start gap-3">
              <div className="ios-coral flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] text-rose-800">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 id="delete-data-title" className="text-xl font-black text-slate-900">Tüm veriyi sil</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">Bu işlem ders, görev, sınav, ödül ve plan kayıtlarını bu cihazdan kalıcı olarak kaldırır.</p>
              </div>
            </div>
            <div className="ios-coral rounded-[20px] px-4 py-3 text-sm text-rose-950">Devam etmeden önce yedek indirmeniz önerilir. Silme işlemi geri alınmaz.</div>
            <label className="mt-4 block text-sm font-bold text-slate-700">
              Onay için SIL yazın
              <input
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
                className="ios-button mt-2 w-full rounded-[18px] px-3 py-3 text-slate-800"
                autoFocus
              />
            </label>
            <div className="dr-button-row mt-6">
              <button type="button" onClick={() => { setShowDeleteDataModal(false); setDeleteConfirmText(''); }} disabled={isDeletingAllData} className="ios-button rounded-[18px] px-5 py-3 text-sm font-bold text-slate-700 disabled:opacity-50">Vazgeç</button>
              <button type="button" onClick={handleConfirmDeleteAllData} disabled={isDeletingAllData || deleteConfirmText.trim().toUpperCase() !== 'SIL'} className="dr-destructive-button px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50">
                {isDeletingAllData ? 'Siliniyor...' : 'Kalıcı olarak sil'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showExamSection && <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
        <div className={card}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
                <PlusCircle className="h-4 w-4" />
                Sınav merkezi
              </div>
              <h3 className="mt-2 text-2xl font-black text-slate-900">Kayıt özeti</h3>
              <p className="mt-1 max-w-xl text-sm text-slate-500">Sonuçlar burada izlenir. Yeni okul sınavı veya deneme kaydı sadece gerektiğinde açılan pencereden girilir.</p>
            </div>
            <button type="button" onClick={() => setExamFormOpen(true)} className="ios-button-active inline-flex items-center justify-center gap-2 rounded-[20px] px-5 py-3 text-sm font-black text-slate-900">
              <PlusCircle className="h-4 w-4" />
              Sınav Sonucu Ekle
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="ios-widget ios-blue rounded-[22px] p-4">
              <div className="text-xs font-bold uppercase text-slate-500">Okul kaydi</div>
              <div className="mt-2 text-3xl font-black text-slate-900">{examRecords.length}</div>
            </div>
            <div className="ios-widget ios-lilac rounded-[22px] p-4">
              <div className="text-xs font-bold uppercase text-slate-500">Deneme</div>
              <div className="mt-2 text-3xl font-black text-slate-900">{compositeExamResults.length}</div>
            </div>
            <div className="ios-widget ios-peach rounded-[22px] p-4">
              <div className="text-xs font-bold uppercase text-slate-500">Aktif ders</div>
              <div className="mt-2 text-3xl font-black text-slate-900">{activeCourses.length}</div>
            </div>
          </div>

          <div className="ios-widget mt-5 rounded-[24px] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ders performans ozeti</div>
            <div className="mt-1 text-sm text-slate-600">Her dersin son okul kaydı ve beklenen notu burada okunur; ders seçimi kayıt penceresinde yapılır.</div>
            {activeExamCourseCards.length === 0 && <div className="ios-widget mt-3 rounded-[18px] px-3 py-4 text-sm text-slate-500">Henüz aktif ders yok. Önce müfredat alanından ders eklenmeli.</div>}
            {activeExamCourseCards.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {activeExamCourseCards.map((course) => (
                <div key={course.id} className="ios-widget rounded-[22px] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-slate-900">{course.name}</div>
                      <div className="mt-1 text-xs text-slate-500">Kayıtlı okul sınavı: {course.recordCount}</div>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${alignmentToneMap[course.alignmentStatus]}`}>
                      {alignmentLabelMap[course.alignmentStatus]}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="ios-button rounded-full px-2 py-1 text-slate-700">Son okul: {course.latestScore ?? '-'}</span>
                    <span className="ios-button rounded-full px-2 py-1 text-slate-700">Beklenen: {course.predictedScore ?? '-'}</span>
                  </div>
                </div>
              ))}
            </div>}
          </div>
        </div>

        {examFormOpen && (
          <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/65 px-4 py-4 backdrop-blur-xl">
            <div className="ios-card flex max-h-[min(46rem,calc(100dvh-2rem))] w-[min(48rem,100%)] flex-col overflow-hidden rounded-[30px]" role="dialog" aria-modal="true" aria-label="Sınav sonucu ekle">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">Sınav girişi</div>
                  <h3 className="mt-2 text-2xl font-black text-slate-900">Yeni sonuc kaydi</h3>
                  <p className="mt-1 text-sm text-slate-500">Kayıt tamamlanınca bu pencere kapanır ve sayfada sadece özet kalır.</p>
                </div>
                <button type="button" onClick={() => setExamFormOpen(false)} className="ios-button flex h-11 w-11 items-center justify-center rounded-full text-slate-600" aria-label="Sınav kaydını kapat">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="overflow-y-auto px-6 py-5">
                <div className="mb-4 grid grid-cols-2 gap-2 rounded-[22px] border border-white/10 p-1">
                  <button type="button" onClick={() => setExamEntryMode('course')} className={`rounded-[18px] px-4 py-3 text-sm font-bold ${examEntryMode === 'course' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}>Ders bazlı sınav</button>
                  <button type="button" onClick={() => setExamEntryMode('composite')} className={`rounded-[18px] px-4 py-3 text-sm font-bold ${examEntryMode === 'composite' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-700'}`}>Genel sınav / deneme</button>
                </div>

                {examEntryMode === 'course' ? (
                  <form onSubmit={handleAddExamRecord} className="grid gap-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Ders</span>
                      <select value={examCourseId} onChange={(event) => setExamCourseId(event.target.value)} className="dr-form-field w-full rounded-[20px] px-3 py-3 text-sm font-semibold outline-none">
                        {activeCourses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
                      </select>
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Sınav türü</span>
                        <select value={examType} onChange={(event) => setExamType(event.target.value as ExamType)} className="dr-form-field w-full rounded-[20px] px-3 py-3 text-sm font-semibold outline-none">
                          {Object.entries(examTypeLabelMap).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Tarih</span>
                        <input value={examDate} onChange={(event) => setExamDate(event.target.value)} type="date" className="dr-form-field w-full rounded-[20px] px-3 py-3 text-sm font-semibold outline-none" />
                      </label>
                    </div>
                    <input value={examTitle} onChange={(event) => setExamTitle(event.target.value)} placeholder="Orn. Matematik 2. yazili" className="dr-form-field w-full rounded-[20px] px-3 py-3 text-sm font-semibold outline-none" />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <input value={examScore} onChange={(event) => setExamScore(event.target.value)} type="number" min="0" max="100" placeholder="Puan" className="dr-form-field w-full rounded-[20px] px-3 py-3 text-sm font-semibold outline-none" />
                      <input value={examWeight} onChange={(event) => setExamWeight(event.target.value)} type="number" min="1" placeholder="Agirlik" className="dr-form-field w-full rounded-[20px] px-3 py-3 text-sm font-semibold outline-none" />
                      <select value={examScopeType} onChange={(event) => setExamScopeType(event.target.value as 'topic' | 'unit' | 'course' | 'multi-course')} className="dr-form-field w-full rounded-[20px] px-3 py-3 text-sm font-semibold outline-none">
                        <option value="topic">Konu</option>
                        <option value="unit">Unite</option>
                        <option value="course">Ders</option>
                        <option value="multi-course">Coklu ders</option>
                      </select>
                    </div>
                    <input value={examTermKey} onChange={(event) => setExamTermKey(event.target.value)} placeholder="Donem anahtari" className="dr-form-field w-full rounded-[20px] px-3 py-3 text-sm font-semibold outline-none" />
                    <textarea value={examNotes} onChange={(event) => setExamNotes(event.target.value)} rows={3} placeholder="Kisa not" className="dr-text-view min-h-[6rem]" maxLength={400} />
                    <div className="dr-button-row">
                      <button type="button" onClick={() => setExamFormOpen(false)} className="ios-button rounded-[18px] px-5 py-3 text-sm font-bold text-slate-700">Vazgeç</button>
                      <button type="submit" disabled={!examCourseId} className="ios-button-active rounded-[18px] px-5 py-3 text-sm font-bold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50">Kaydet</button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleAddCompositeExam} className="grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input value={compositeTitle} onChange={(event) => setCompositeTitle(event.target.value)} placeholder="Orn. Nisan Turkiye Geneli" className="dr-form-field w-full rounded-[20px] px-3 py-3 text-sm font-semibold outline-none" />
                      <input value={compositeDate} onChange={(event) => setCompositeDate(event.target.value)} type="date" className="dr-form-field w-full rounded-[20px] px-3 py-3 text-sm font-semibold outline-none" />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <select value={compositeType} onChange={(event) => setCompositeType(event.target.value as 'state-exam' | 'mock-exam')} className="dr-form-field w-full rounded-[20px] px-3 py-3 text-sm font-semibold outline-none">
                        <option value="state-exam">Genel sınav</option>
                        <option value="mock-exam">Deneme</option>
                      </select>
                      <input value={compositeTotalScore} onChange={(event) => setCompositeTotalScore(event.target.value)} type="number" min="0" placeholder="Toplam puan (opsiyonel)" className="dr-form-field w-full rounded-[20px] px-3 py-3 text-sm font-semibold outline-none" />
                    </div>
                    <textarea value={compositeCourseScores} onChange={(event) => setCompositeCourseScores(event.target.value)} rows={5} placeholder={"Her satir: Ders: Puan\nMatematik: 78\nFen Bilimleri: 72"} className="dr-text-view" />
                    <textarea value={compositeNotes} onChange={(event) => setCompositeNotes(event.target.value)} rows={3} placeholder="Kisa not" className="dr-text-view min-h-[6rem]" maxLength={400} />
                    <div className="dr-button-row">
                      <button type="button" onClick={() => setExamFormOpen(false)} className="ios-button rounded-[18px] px-5 py-3 text-sm font-bold text-slate-700">Vazgeç</button>
                      <button type="submit" className="ios-button-active rounded-[18px] px-5 py-3 text-sm font-bold text-slate-900">Kaydet</button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        <div className={card}>
          <div className="mb-4 flex items-center gap-2">
            <Download className="h-5 w-5 text-slate-700" />
            <h3 className="text-xl font-bold">Son Kayıtlar</h3>
          </div>
          <div className="space-y-3">
            {recentExamRecords.map((record) => (
              <div key={record.id} className="ios-widget rounded-[20px] p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-800">{record.courseName} / {record.title}</div>
                    <div className="mt-1 text-slate-500">{examTypeLabelMap[record.examType]} / {record.date} / Puan {record.score}</div>
                  </div>
                  <button type="button" onClick={() => handleDeleteExamRecord(record.id)} className="text-rose-600">Sil</button>
                </div>
              </div>
            ))}
            {recentExamRecords.length === 0 && <div className="ios-widget rounded-[18px] p-4 text-sm text-slate-500">Henüz ders bazlı sınav kaydı yok.</div>}
          </div>
          <div className="mt-4 space-y-3">
            {compositeExamResults.slice(0, 3).map((record) => (
              <div key={record.id} className="ios-widget rounded-[20px] p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-800">{record.title}</div>
                    <div className="mt-1 text-slate-500">{record.examType === 'state-exam' ? 'Genel sınav' : 'Deneme'} / {record.date} / {record.courses.length} ders</div>
                  </div>
                  <button type="button" onClick={() => handleDeleteCompositeExam(record.id)} className="text-rose-600">Sil</button>
                </div>
              </div>
            ))}
            {compositeExamResults.length === 0 && <div className="ios-widget rounded-[18px] p-4 text-sm text-slate-500">Henüz genel sınav veya deneme özeti yok.</div>}
          </div>
        </div>
      </div>}
    </>
  );
};

export default ParentTaskWorkspace;
