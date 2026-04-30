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
  viewMode: 'all' | 'tasks' | 'analysis';
}

const card = 'ios-card rounded-[30px] p-6';

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
  const [courseId, setCourseId] = useState(courses[0]?.name || '');
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
  const [examCourseId, setExamCourseId] = useState(courses[0]?.id || '');
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const taskMenuRef = useRef<HTMLDivElement | null>(null);

  const today = getTodayString();
  const pendingCount = tasks.filter((task) => task.status === 'bekliyor').length;
  const completedCount = tasks.filter((task) => task.status === 'tamamlandı').length;
  const selectedCourseName = courseId || '';
  const assignmentSubjectOptions = useMemo(() => {
    return Object.keys(curriculum || {}).map((subject) => ({ value: subject, label: subject }));
  }, [curriculum]);
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
    return courses.map((course) => {
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
  }, [courses, analysis.school.coursePerformance, analysis.school.examRecords]);
  const visibleTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      if (taskListFilter === 'waiting') return task.status === 'bekliyor';
      if (taskListFilter === 'completed') return task.status === 'tamamlandı';
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
  const showAssignmentSection = viewMode === 'all' || taskWorkspaceTab === 'assignment';
  const showTaskListSection = viewMode === 'all' || taskWorkspaceTab === 'list';
  const showExamSection = viewMode === 'all' || taskWorkspaceTab === 'exams';
  const showDataSection = viewMode === 'all' || taskWorkspaceTab === 'data';

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
    if (!courses.length) {
      setExamCourseId('');
      return;
    }

    if (!courses.some((course) => course.id === examCourseId)) {
      setExamCourseId(courses[0]?.id || '');
    }
  }, [courses, examCourseId]);

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
      onActionMessage('error', 'Gorev atamak icin ders, unite, konu, tarih ve sure secimi zorunludur.');
      return;
    }
    const resolvedCourseId = courses.find((course) => normalizeForLookup(course.name) === normalizeForLookup(selectedCourseName))?.id;
    if (!resolvedCourseId) {
      onActionMessage('error', 'Secili ders icin kayitli ders kimligi bulunamadi. Once Mufredat ekranindan dersi kaydedin.');
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
      onActionMessage('success', 'Gorev basariyla eklendi.');
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
      onActionMessage('error', 'Silmek icin onay alanina SIL yazin.');
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
      onActionMessage('error', 'Sinav kaydi bu ekranda guncellenemiyor.');
      return;
    }

    const selectedCourse = courses.find((course) => course.id === examCourseId);
    const parsedScore = Number(examScore);
    const parsedWeight = Number(examWeight);
    if (!selectedCourse || !examTitle.trim() || !examDate || !Number.isFinite(parsedScore)) {
      onActionMessage('error', 'Ders, sinav basligi, tarih ve puan zorunludur.');
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
    onActionMessage('success', 'Okul sinavi kaydi eklendi.');
  };

  const handleAddCompositeExam = (event: React.FormEvent) => {
    event.preventDefault();
    if (!onChangeCompositeExamResults) {
      onActionMessage('error', 'Genel sinav kaydi bu ekranda guncellenemiyor.');
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
        const matchedCourse = courses.find((course) => normalizeForLookup(course.name) === normalizeForLookup(courseName));
        if (!matchedCourse || !Number.isFinite(score)) return null;
        return {
          courseId: matchedCourse.id,
          courseName: matchedCourse.name,
          score: Math.max(0, Math.min(100, Math.round(score))),
        };
      });

    if (!compositeTitle.trim() || !compositeDate || !courseRows.length || courseRows.some((row) => row === null)) {
      onActionMessage('error', 'Genel sinav icin baslik, tarih ve her satirda Ders: Puan formati zorunludur.');
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
    onActionMessage('success', 'Genel sinav ozeti eklendi.');
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
      {viewMode === 'tasks' && <section className="ios-panel rounded-[30px] p-2">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Dersler ve Gorevler</div>
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
        <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">Gorev atama</div>
            <h3 className="mt-1 text-2xl font-black text-slate-900">Cocuga gorev gonder</h3>
            <p className="mt-1 text-sm text-slate-500">Ders, unite, konu, sure ve hedef belirleyip gorevi dogrudan ata.</p>
          </div>
          <div className="ios-widget rounded-[22px] px-4 py-3 text-sm text-slate-600">
            Secili ders: <strong>{selectedCourseName || 'Ders secilmedi'}</strong>
          </div>
        </div>

        <nav className="dr-path-control mb-5" aria-label="Gorev konumu">
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

        <form onSubmit={handleAddTask} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <section className="ios-widget ios-blue rounded-[26px] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-sm font-black text-blue-700">1</span>
                <div>
                  <h4 className="font-bold text-slate-900">Ders ve mufredat</h4>
                  <p className="text-xs text-slate-500">Unite/konu baglantisi.</p>
                </div>
              </div>
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Ders</label>
                <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setSelectedUnitName(''); setSelectedTopicName(''); }} className="ios-button w-full rounded-[20px] px-3 py-3 text-sm">
                  {assignmentSubjectOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Unite</label>
                <select value={selectedUnitName} onChange={(e) => { setSelectedUnitName(e.target.value); setSelectedTopicName(''); }} className="ios-button w-full rounded-[20px] px-3 py-3 text-sm">
                  <option value="">Unite sec</option>
                  {activeUnits.map((unit) => <option key={unit.name} value={unit.name}>{unit.name}</option>)}
                </select>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Konu</label>
                <select value={selectedTopicName} onChange={(e) => setSelectedTopicName(e.target.value)} className="ios-button w-full rounded-[20px] px-3 py-3 text-sm" disabled={!selectedUnitName}>
                  <option value="">Konu sec</option>
                  {activeTopics.map((topic) => <option key={topic.name} value={topic.name}>{topic.name}</option>)}
                </select>
              </div>
            </section>

            <section className="ios-widget ios-mint rounded-[26px] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-sm font-black text-emerald-700">2</span>
                <div>
                  <h4 className="font-bold text-slate-900">Gorev detaylari</h4>
                  <p className="text-xs text-slate-500">Baslik, tarih, sure.</p>
                </div>
              </div>
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Gorev basligi</label>
                <input value={`${selectedCourseName || 'Ders'}${selectedUnitName ? ` / ${selectedUnitName}` : ''}${selectedTopicName ? ` / ${selectedTopicName}` : ''}`} readOnly className="ios-button w-full rounded-[20px] px-3 py-3 text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Tarih</label>
                    <input value={dueDate} onChange={(e) => setDueDate(e.target.value)} type="date" className="ios-button mt-1 w-full rounded-[20px] px-3 py-3 text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Sure</label>
                    <input value={plannedDuration} onChange={(e) => setPlannedDuration(e.target.value)} type="number" min="1" placeholder="dk" className="ios-button mt-1 w-full rounded-[20px] px-3 py-3 text-sm" required />
                  </div>
                </div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Gorev turu</label>
                <select value={taskTypeKey} onChange={(e) => setTaskTypeKey(resolveTaskTypeKey(e.target.value))} className="ios-button w-full rounded-[20px] px-3 py-3 text-sm">
                  <option value="study">Ders Calismasi</option>
                  <option value="revision">Ders Tekrari</option>
                  <option value="question">Soru Cozme</option>
                </select>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Soru sayisi (istege bagli)</label>
                <input
                  value={questionCount}
                  onChange={(e) => setQuestionCount(e.target.value)}
                  type="number"
                  min="1"
                  placeholder={taskTypeKey === 'question' ? 'Orn: 20' : 'Sadece Soru Cozme icin aktif'}
                  disabled={taskTypeKey !== 'question'}
                  className="ios-button w-full rounded-[20px] px-3 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </section>

            <section className="ios-widget ios-lilac rounded-[26px] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-sm font-black text-violet-700">3</span>
                <div>
                  <h4 className="font-bold text-slate-900">Olcum ve hedef</h4>
                  <p className="text-xs text-slate-500">Analiz bu bilgilerden beslenir.</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="block text-xs font-bold uppercase tracking-wide text-slate-500">Metrik secimi (tek secim)</div>
                  <div className="dr-token-field" aria-label="Secili olcum metrikleri">
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
                  <div className="space-y-2">
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
                <div className="ios-widget rounded-[18px] px-3 py-2 text-xs leading-5 text-slate-500">Ayni gorevde yalnizca bir metrik secilir. Hedef otomatik %100 kabul edilir.</div>
              </div>
            </section>
          </div>

          <div className="ios-widget flex flex-col gap-3 rounded-[26px] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-sm text-slate-600">
              <strong>Ozet:</strong> {selectedCourseName || 'Ders'} {selectedUnitName ? `/ ${selectedUnitName}` : ''} {selectedTopicName ? `/ ${selectedTopicName}` : ''} icin gorev atanacak{taskTypeKey === 'question' && Number(questionCount) > 0 ? ` (${questionCount} soru)` : ''}.
            </div>
            <button type="submit" disabled={!selectedCourseName || !selectedUnitName || !selectedTopicName || isAddingTask} className="ios-button-active rounded-[20px] px-6 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50">{isAddingTask ? 'Kaydediliyor...' : 'Gorevi Ata'}</button>
          </div>
        </form>
      </div>}

      {showTaskListSection && <div className={card}>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-xl font-bold">Gorevler</h3>
            <div className="text-sm text-slate-500">Bekleyen {pendingCount} / Tamamlanan {completedCount}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setTaskListFilter('waiting')} className={`rounded-full px-3 py-2 text-xs font-bold ${taskListFilter === 'waiting' ? 'ios-button-active' : 'ios-button text-slate-600'}`}>Bekleyen</button>
            <button onClick={() => setTaskListFilter('overdue')} className={`rounded-full px-3 py-2 text-xs font-bold ${taskListFilter === 'overdue' ? 'ios-coral text-rose-950' : 'ios-button text-slate-600'}`}>Takipte</button>
            <button onClick={() => setTaskListFilter('completed')} className={`rounded-full px-3 py-2 text-xs font-bold ${taskListFilter === 'completed' ? 'ios-mint text-emerald-950' : 'ios-button text-slate-600'}`}>Tamamlanan</button>
            <button onClick={() => setTaskListFilter('all')} className={`rounded-full px-3 py-2 text-xs font-bold ${taskListFilter === 'all' ? 'ios-lilac text-violet-950' : 'ios-button text-slate-600'}`}>Tumu</button>
          </div>
        </div>
        <div className="space-y-3">
          {visibleTasks.length === 0 && <div className="ios-widget rounded-[22px] p-5 text-sm text-slate-500">Bu filtreye uygun gorev yok.</div>}
          {visibleTasks.map((task) => {
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
                    {(task.curriculumUnitName || task.curriculumTopicName || task.taskGoalType || (typeof task.questionCount === 'number' && task.questionCount > 0) || taskMetrics.length > 0 || typeof taskMetricTargetScore === 'number') && (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {task.curriculumUnitName && <span className="rounded-full bg-slate-100 px-2 py-1">Unite: {task.curriculumUnitName}</span>}
                        {task.curriculumTopicName && <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">Konu: {task.curriculumTopicName}</span>}
                        {task.taskGoalType && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">Hedef: {formatTaskGoal(task.taskGoalType)}</span>}
                        {typeof task.questionCount === 'number' && task.questionCount > 0 && <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-700">Soru: {task.questionCount}</span>}
                        {taskMetrics.map((metricKey) => <span key={`${task.id}-metric-${metricKey}`} className="rounded-full bg-indigo-100 px-2 py-1 text-indigo-700">Metrik: {assignmentMetricLabelMap[metricKey]}</span>)}
                        {typeof taskMetricTargetScore === 'number' && <span className="rounded-full bg-violet-100 px-2 py-1 text-violet-700">Hedef: %{taskMetricTargetScore}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${task.status === 'tamamlandı' ? 'bg-green-100 text-green-700' : isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {task.status === 'tamamlandı' ? 'Tamamlandi' : isOverdue ? 'Takipte' : 'Bekliyor'}
                    </span>
                    <div className="dr-context-menu-shell" ref={openTaskMenuId === task.id ? taskMenuRef : null}>
                      <button
                        type="button"
                        onClick={() => setOpenTaskMenuId((current) => (current === task.id ? null : task.id))}
                        className="dr-icon-button"
                        aria-label={`${task.title} gorev islemleri`}
                        aria-haspopup="menu"
                        aria-expanded={openTaskMenuId === task.id}
                        title="Gorev islemleri"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {openTaskMenuId === task.id && (
                        <div className="dr-context-menu" role="menu" aria-label={`${task.title} gorev islemleri`}>
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
                            Gorevi sil
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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
                Yedek dosyasi ogrenci kayitlarini tasir. Yukleme onaylanmadan mevcut veri degismez; silme icin ek onay istenir.
              </ContextHelp>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">Ogrenci, ders, gorev, sinav, odul ve plan verilerini tek Ders Rotasi JSON dosyasinda sakla.</p>
          </div>
          <div className="ios-widget rounded-[22px] px-4 py-3 text-sm text-slate-600">
            Kayit ozeti: <strong>{courses.length}</strong> ders / <strong>{tasks.length}</strong> gorev / <strong>{examRecords.length + compositeExamResults.length}</strong> sinav
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImportFileChange} className="hidden" />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <section className="ios-widget ios-mint rounded-[26px] p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[18px] bg-white/70 text-emerald-700">
              <Download className="h-5 w-5" />
            </div>
            <h4 className="text-lg font-black text-slate-900">Yedek olustur</h4>
            <p className="mt-2 min-h-[60px] text-sm text-slate-600">Bugunku verileri indirilebilir bir dosyaya kaydeder. Dosya adi tarihli gelir.</p>
            <button onClick={handleExportData} disabled={isExporting || !onExportData} className={`ios-button-active mt-4 flex w-full items-center justify-center gap-2 rounded-[18px] px-4 py-3 font-bold ${isExporting || !onExportData ? 'cursor-not-allowed opacity-50' : ''}`}>
              <Download className="h-4 w-4" />
              {isExporting ? 'Yedek hazirlaniyor...' : 'Yedek indir'}
            </button>
          </section>

          <section className="ios-widget ios-blue rounded-[26px] p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[18px] bg-white/70 text-blue-700">
              <Upload className="h-5 w-5" />
            </div>
            <h4 className="text-lg font-black text-slate-900">Yedekten yukle</h4>
            <p className="mt-2 min-h-[60px] text-sm text-slate-600">Secilen dosya once incelenir. Onay vermeden mevcut veri degismez.</p>
            <button onClick={handleImportClick} disabled={isImporting} className={`ios-button mt-4 flex w-full items-center justify-center gap-2 rounded-[18px] px-4 py-3 font-bold text-slate-700 ${isImporting ? 'cursor-not-allowed opacity-50' : ''}`}>
              <Upload className="h-4 w-4" />
              Dosya sec
            </button>
          </section>

          <section className="ios-widget ios-coral rounded-[26px] p-5">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[18px] bg-white/70 text-rose-700">
              <Trash2 className="h-5 w-5" />
            </div>
            <h4 className="text-lg font-black text-slate-900">Veriyi temizle</h4>
            <p className="mt-2 min-h-[60px] text-sm text-slate-600">Tum yerel kayitlari siler. Bu adimdan once yedek almak en guvenli akistir.</p>
            <button onClick={handleDeleteAllData} disabled={isDeletingAllData} className={`dr-destructive-button mt-4 flex w-full items-center justify-center gap-2 px-4 py-3 font-bold ${isDeletingAllData ? 'cursor-not-allowed opacity-50' : ''}`}>
              <Trash2 className="h-4 w-4" />
              {isDeletingAllData ? 'Siliniyor...' : 'Tum veriyi sil'}
            </button>
          </section>
        </div>

        {importFileDetails && (
          <div className="ios-card mt-5 rounded-[28px] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">Secilen yedek</div>
                <h4 className="mt-1 text-lg font-black text-slate-900">{importFileDetails.name}</h4>
                <p className="mt-1 text-sm text-slate-500">Boyut {importFileDetails.size} / Son degisiklik {importFileDetails.modified}</p>
              </div>
              <div className="dr-button-row">
                <button type="button" onClick={handleCancelImport} disabled={isImporting} className="ios-button rounded-[18px] px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-50">Vazgec</button>
                <button type="button" onClick={handleConfirmImport} disabled={isImporting} className="ios-button-active rounded-[18px] px-4 py-3 text-sm font-black disabled:opacity-50">
                  {isImporting ? 'Yukleniyor...' : 'Bu yedegi yukle'}
                </button>
              </div>
            </div>
            <div className="ios-coral mt-4 rounded-[20px] px-4 py-3 text-sm text-rose-950">
              Yukleme mevcut ders, gorev, sinav, odul ve plan verilerinin yerine bu dosyadaki kayitlari koyar.
            </div>
          </div>
        )}

        <div className="ios-widget mt-5 rounded-[24px] p-4 text-sm text-slate-600">
          Yedek dosyalari sifrelenmez. Ogrenciye ait takip verileri icerdigi icin dosyayi yalnizca guvendiginiz konumlarda saklayin.
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
                <h3 id="delete-data-title" className="text-xl font-black text-slate-900">Tum veriyi sil</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">Bu islem ders, gorev, sinav, odul ve plan kayitlarini bu cihazdan kalici olarak kaldirir.</p>
              </div>
            </div>
            <div className="ios-coral rounded-[20px] px-4 py-3 text-sm text-rose-950">Devam etmeden once yedek indirmeniz onerilir. Silme islemi geri alinmaz.</div>
            <label className="mt-4 block text-sm font-bold text-slate-700">
              Onay icin SIL yazin
              <input
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
                className="ios-button mt-2 w-full rounded-[18px] px-3 py-3 text-slate-800"
                autoFocus
              />
            </label>
            <div className="dr-button-row mt-6">
              <button type="button" onClick={() => { setShowDeleteDataModal(false); setDeleteConfirmText(''); }} disabled={isDeletingAllData} className="ios-button rounded-[18px] px-5 py-3 text-sm font-bold text-slate-700 disabled:opacity-50">Vazgec</button>
              <button type="button" onClick={handleConfirmDeleteAllData} disabled={isDeletingAllData || deleteConfirmText.trim().toUpperCase() !== 'SIL'} className="dr-destructive-button px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50">
                {isDeletingAllData ? 'Siliniyor...' : 'Kalici olarak sil'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showExamSection && <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className={card}>
          <div className="mb-4 flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-slate-700" />
            <h3 className="text-xl font-bold">Sinav Merkezi</h3>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => setExamEntryMode('course')} className={`rounded-full px-4 py-2 text-sm font-bold ${examEntryMode === 'course' ? 'ios-button-active' : 'ios-button text-slate-700'}`}>Ders bazli sinav</button>
            <button type="button" onClick={() => setExamEntryMode('composite')} className={`rounded-full px-4 py-2 text-sm font-bold ${examEntryMode === 'composite' ? 'ios-button-active' : 'ios-button text-slate-700'}`}>Genel sinav / deneme</button>
          </div>
          <div className="ios-widget mb-4 rounded-[24px] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Aktif ders merkezi</div>
            <div className="mt-1 text-sm text-slate-600">Tek merkezde kayitli aktif dersler burada otomatik cikar. Yeni ders eklendiginde bu alan elle guncelleme istemeden yenilenir.</div>
            {activeExamCourseCards.length === 0 && <div className="ios-widget mt-3 rounded-[18px] px-3 py-4 text-sm text-slate-500">Henuz aktif ders yok. Once merkezi ders listesinden ders eklenmeli.</div>}
            {activeExamCourseCards.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {activeExamCourseCards.map((course) => {
                const isSelected = examCourseId === course.id;
                return (
                  <button key={course.id} type="button" onClick={() => setExamCourseId(course.id)} className={`rounded-[22px] p-4 text-left transition ${isSelected ? 'ios-ink text-white' : 'ios-widget text-slate-800 hover:bg-white/75'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-black">{course.name}</div>
                        <div className={`mt-1 text-xs ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>Kayitli okul sinavi: {course.recordCount}</div>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${isSelected ? 'border-white/20 bg-white/10 text-white' : alignmentToneMap[course.alignmentStatus]}`}>
                        {alignmentLabelMap[course.alignmentStatus]}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className={`rounded-full px-2 py-1 ${isSelected ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-700'}`}>Son okul: {course.latestScore ?? '-'}</span>
                      <span className={`rounded-full px-2 py-1 ${isSelected ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-700'}`}>Beklenen: {course.predictedScore ?? '-'}</span>
                    </div>
                  </button>
                );
              })}
            </div>}
          </div>
          {examEntryMode === 'course' ? (
            <form onSubmit={handleAddExamRecord} className="grid gap-3">
              <div className="ios-widget rounded-[18px] px-3 py-3 text-sm text-slate-700">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Secili aktif ders</div>
                <div className="mt-1 font-bold text-slate-900">{courses.find((course) => course.id === examCourseId)?.name || 'Ders secilmedi'}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={examType} onChange={(event) => setExamType(event.target.value as ExamType)} className="ios-button rounded-[18px] px-3 py-2 text-sm">
                  {Object.entries(examTypeLabelMap).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <input value={examDate} onChange={(event) => setExamDate(event.target.value)} type="date" className="ios-button rounded-[18px] px-3 py-2 text-sm" />
              </div>
              <input value={examTitle} onChange={(event) => setExamTitle(event.target.value)} placeholder="Orn. Matematik 2. yazili" className="ios-button rounded-[18px] px-3 py-2 text-sm" />
              <div className="grid gap-3 sm:grid-cols-3">
                <input value={examScore} onChange={(event) => setExamScore(event.target.value)} type="number" min="0" max="100" placeholder="Puan" className="ios-button rounded-[18px] px-3 py-2 text-sm" />
                <input value={examWeight} onChange={(event) => setExamWeight(event.target.value)} type="number" min="1" placeholder="Agirlik" className="ios-button rounded-[18px] px-3 py-2 text-sm" />
                <select value={examScopeType} onChange={(event) => setExamScopeType(event.target.value as 'topic' | 'unit' | 'course' | 'multi-course')} className="ios-button rounded-[18px] px-3 py-2 text-sm">
                  <option value="topic">Konu</option>
                  <option value="unit">Unite</option>
                  <option value="course">Ders</option>
                  <option value="multi-course">Coklu ders</option>
                </select>
              </div>
              <input value={examTermKey} onChange={(event) => setExamTermKey(event.target.value)} placeholder="Donem anahtari" className="ios-button rounded-[18px] px-3 py-2 text-sm" />
              <textarea value={examNotes} onChange={(event) => setExamNotes(event.target.value)} rows={3} placeholder="Kisa not" className="dr-text-view min-h-[6rem]" maxLength={400} />
              <button type="submit" disabled={!examCourseId} className="ios-button-active rounded-[18px] px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">Sinav Kaydi Ekle</button>
            </form>
          ) : (
            <form onSubmit={handleAddCompositeExam} className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={compositeTitle} onChange={(event) => setCompositeTitle(event.target.value)} placeholder="Orn. Nisan Turkiye Geneli" className="ios-button rounded-[18px] px-3 py-2 text-sm" />
                <input value={compositeDate} onChange={(event) => setCompositeDate(event.target.value)} type="date" className="ios-button rounded-[18px] px-3 py-2 text-sm" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={compositeType} onChange={(event) => setCompositeType(event.target.value as 'state-exam' | 'mock-exam')} className="ios-button rounded-[18px] px-3 py-2 text-sm">
                  <option value="state-exam">Genel sinav</option>
                  <option value="mock-exam">Deneme</option>
                </select>
                <input value={compositeTotalScore} onChange={(event) => setCompositeTotalScore(event.target.value)} type="number" min="0" placeholder="Toplam puan (opsiyonel)" className="ios-button rounded-[18px] px-3 py-2 text-sm" />
              </div>
              <textarea value={compositeCourseScores} onChange={(event) => setCompositeCourseScores(event.target.value)} rows={5} placeholder={"Her satir: Ders: Puan\nMatematik: 78\nFen Bilimleri: 72"} className="dr-text-view" />
              <textarea value={compositeNotes} onChange={(event) => setCompositeNotes(event.target.value)} rows={3} placeholder="Kisa not" className="dr-text-view min-h-[6rem]" maxLength={400} />
              <button type="submit" className="ios-button-active rounded-[18px] px-4 py-2 text-sm font-bold">Genel Sinav Ozeti Ekle</button>
            </form>
          )}
        </div>

        <div className={card}>
          <div className="mb-4 flex items-center gap-2">
            <Download className="h-5 w-5 text-slate-700" />
            <h3 className="text-xl font-bold">Son Kayitlar</h3>
          </div>
          <div className="space-y-3">
            {recentExamRecords.map((record) => (
              <div key={record.id} className="ios-widget rounded-[20px] p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-800">{record.courseName} · {record.title}</div>
                    <div className="mt-1 text-slate-500">{examTypeLabelMap[record.examType]} · {record.date} · Puan {record.score}</div>
                  </div>
                  <button type="button" onClick={() => handleDeleteExamRecord(record.id)} className="text-rose-600">Sil</button>
                </div>
              </div>
            ))}
            {recentExamRecords.length === 0 && <div className="ios-widget rounded-[18px] p-4 text-sm text-slate-500">Henuz ders bazli sinav kaydi yok.</div>}
          </div>
          <div className="mt-4 space-y-3">
            {compositeExamResults.slice(0, 3).map((record) => (
              <div key={record.id} className="ios-widget rounded-[20px] p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-800">{record.title}</div>
                    <div className="mt-1 text-slate-500">{record.examType === 'state-exam' ? 'Genel sinav' : 'Deneme'} · {record.date} · {record.courses.length} ders</div>
                  </div>
                  <button type="button" onClick={() => handleDeleteCompositeExam(record.id)} className="text-rose-600">Sil</button>
                </div>
              </div>
            ))}
            {compositeExamResults.length === 0 && <div className="ios-widget rounded-[18px] p-4 text-sm text-slate-500">Henuz genel sinav veya deneme ozeti yok.</div>}
          </div>
        </div>
      </div>}
    </>
  );
};

export default ParentTaskWorkspace;
