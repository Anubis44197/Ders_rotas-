import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExamType, ParentDashboardProps, Task, CurriculumUnit, Reward, ReportData } from '../../types';
import { PlusCircle, Trash2, BookOpen, ClipboardList, Trophy, Download, Settings, FileText, Target, TrendingUp, AlertTriangle, CheckCircle, Upload } from '../icons';
import { deriveAnalysisSnapshot } from '../../utils/analysisEngine';
import { getTodayString } from '../../utils/dateUtils';
import AnalysisGraphCenter from './AnalysisGraphCenter';

const card = 'bg-white rounded-2xl shadow-sm border border-slate-200 p-6';
const statCard = 'rounded-2xl border p-5 shadow-sm';

const taskGoalLabelMap: Record<string, string> = {
  'test-cozme': 'Test cozme',
  'olcme-degerlendirme': 'Olcme degerlendirme',
  'sinav-hazirlik': 'Sinav hazirligi',
  'konu-tekrari': 'Konu tekrari',
  'eksik-konu-tamamlama': 'Eksik konu tamamlama',
  'ders calisma': 'Ders calismasi',
  'ders \u00e7al\u0131\u015fma': 'Ders calismasi',
};

const planSourceLabelMap: Record<string, string> = {
  manual: 'Elle atandi',
  'weekly-plan': 'Haftalik plan',
  'ai-plan': 'Akilli plan',
  'free-study': 'Serbest calisma',
};

const examTypeLabelMap: Record<ExamType, string> = {
  'school-written': 'Yazili',
  'school-quiz': 'Kisa sinav',
  'school-oral': 'Sozlu',
  'mock-exam': 'Deneme',
  'state-exam': 'Genel sinav',
  'report-card': 'Karne',
};

const alignmentToneMap = {
  uyumlu: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'sapma-var': 'border-amber-200 bg-amber-50 text-amber-700',
  'kritik-sapma': 'border-rose-200 bg-rose-50 text-rose-700',
  'veri-yetersiz': 'border-slate-200 bg-slate-50 text-slate-600',
} as const;

const alignmentLabelMap = {
  uyumlu: 'Uyumlu',
  'sapma-var': 'Sapma var',
  'kritik-sapma': 'Kritik sapma',
  'veri-yetersiz': 'Veri yetersiz',
} as const;

const buildLocalId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const formatTaskGoal = (value?: string) => value ? (taskGoalLabelMap[value] || value) : '';
const formatPlanSource = (value?: string, label?: string) => label || (value ? (planSourceLabelMap[value] || value) : 'Elle atandi');

const getTaskDateKey = (value?: string) => {
  if (typeof value !== 'string' || !value) return '';
  return value.split('T')[0];
};

const getParentTaskPriority = (task: Task, today: string) => {
  const dueDate = getTaskDateKey(task.dueDate);
  if (task.status === 'tamamland\u0131') return 5;
  if (dueDate < today) return 0;
  if (dueDate === today && !task.isSelfAssigned) return 1;
  if (dueDate === today) return 2;
  if (!task.isSelfAssigned) return 3;
  return 4;
};

const normalizeForLookup = (value: string) =>
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

type TaskTypeKey = 'question' | 'study' | 'revision';

const resolveTaskTypeKey = (value: string): TaskTypeKey => {
  if (value === 'question') return 'question';
  if (value === 'revision') return 'revision';
  return 'study';
};
const taskTypeKeyToTaskType = (value: TaskTypeKey): 'soru çözme' | 'ders çalışma' => (value === 'question' ? 'soru çözme' : 'ders çalışma');

const getScoreTone = (score: number) => {
  if (score >= 90) return 'bg-emerald-50 border-emerald-200 text-emerald-700';
  if (score >= 75) return 'bg-sky-50 border-sky-200 text-sky-700';
  if (score >= 60) return 'bg-amber-50 border-amber-200 text-amber-700';
  return 'bg-rose-50 border-rose-200 text-rose-700';
};

const ASSIGNMENT_METRIC_OPTIONS = [
  { key: 'accuracy', label: 'Dogruluk', hint: 'Dogru cevap oranini takip eder.' },
  { key: 'focus', label: 'Odak', hint: 'Dikkat dagilmasini ve molayi takip eder.' },
  { key: 'duration', label: 'Sureye uyum', hint: 'Planlanan sureye uyumu takip eder.' },
  { key: 'revision', label: 'Ders tekrari', hint: 'Tekrar gorevlerinin devamini takip eder.' },
  { key: 'completion', label: 'Tamamlama', hint: 'Gorevleri zamaninda bitirme durumunu takip eder.' },
] as const;

type AssignmentMetricKey = (typeof ASSIGNMENT_METRIC_OPTIONS)[number]['key'];

const ASSIGNMENT_METRICS_BY_TASK_TYPE: Record<TaskTypeKey, AssignmentMetricKey[]> = {
  question: ['accuracy', 'focus', 'duration', 'completion'],
  study: ['focus', 'duration', 'revision', 'completion'],
  revision: ['revision', 'focus', 'duration', 'completion'],
};

const assignmentMetricLabelMap: Record<AssignmentMetricKey, string> = ASSIGNMENT_METRIC_OPTIONS.reduce((acc, option) => {
  acc[option.key] = option.label;
  return acc;
}, {} as Record<AssignmentMetricKey, string>);

const legacyMetricMap: Array<{ field: 'targetAccuracy' | 'targetFocus' | 'minimumDuration'; key: AssignmentMetricKey }> = [
  { field: 'targetAccuracy', key: 'accuracy' },
  { field: 'targetFocus', key: 'focus' },
  { field: 'minimumDuration', key: 'duration' },
];

const ParentDashboard: React.FC<ParentDashboardProps> = ({
  courses,
  tasks,
  rewards,
  successPoints,
  studyPlans = [],
  curriculum,
  addCourse,
  deleteCourse,
  addTask,
  deleteTask,
  addReward,
  deleteReward,
  generateReport,
  onExportData,
  onDeleteAllData,
  onImportData,
  examRecords = [],
  compositeExamResults = [],
  onChangeExamRecords,
  onChangeCompositeExamResults,
  loading,
  error,
  viewMode = 'all',
}) => {
  const [dueDate, setDueDate] = useState('');
  const [courseId, setCourseId] = useState(courses[0]?.id || '');
  const [taskTypeKey, setTaskTypeKey] = useState<TaskTypeKey>('study');
  const [plannedDuration, setPlannedDuration] = useState('30');
  const [questionCount, setQuestionCount] = useState('');
  const [selectedMetrics, setSelectedMetrics] = useState<AssignmentMetricKey[]>([]);
  const [selectedUnitName, setSelectedUnitName] = useState('');
  const [selectedTopicName, setSelectedTopicName] = useState('');
  const [rewardName, setRewardName] = useState('');
  const [rewardCost, setRewardCost] = useState('100');
  const [reportPeriod, setReportPeriod] = useState<'Haftal\u0131k' | 'Ayl\u0131k' | 'Y\u0131ll\u0131k' | 'T\u00fcm Zamanlar'>('Haftal\u0131k');
  const [report, setReport] = useState<ReportData | null>(null);
  const [taskListFilter, setTaskListFilter] = useState<'all' | 'waiting' | 'completed' | 'overdue'>('waiting');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isAddingReward, setIsAddingReward] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeletingAllData, setIsDeletingAllData] = useState(false);
  const [showAllRewards, setShowAllRewards] = useState(false);
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

  const showActionMessage = (type: 'success' | 'error', text: string) => {
    setActionMessage({ type, text });
    window.setTimeout(() => {
      setActionMessage((prev) => (prev?.text === text ? null : prev));
    }, 2200);
  };

  const courseNameMap = useMemo(() => new Map(courses.map((course) => [course.id, course.name])), [courses]);
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

  const today = getTodayString();
  const pendingCount = tasks.filter((task) => task.status === 'bekliyor').length;
  const completedCount = tasks.filter((task) => task.status === 'tamamland\u0131').length;
  const availablePoints = successPoints;
  const numericRewardCost = Number(rewardCost);
  const rewardButtonTone = !Number.isFinite(numericRewardCost) || numericRewardCost <= 0
    ? 'bg-slate-500'
    : numericRewardCost < 150
      ? 'bg-emerald-600 hover:bg-emerald-700'
      : numericRewardCost < 350
        ? 'bg-amber-500 hover:bg-amber-600'
        : 'bg-rose-600 hover:bg-rose-700';
  const analysis = useMemo(
    () => deriveAnalysisSnapshot(tasks, courses, studyPlans, examRecords, compositeExamResults),
    [tasks, courses, studyPlans, examRecords, compositeExamResults],
  );
  const weakTopics = analysis.topics.filter((topic) => topic.needsRevision).slice(0, 5);
  const improvingTopics = [...analysis.topics].filter((topic) => topic.trend === 'up').sort((a, b) => b.masteryScore - a.masteryScore).slice(0, 5);
  const topCourses = analysis.courses.slice(0, 4);
  const schoolPerformance = analysis.school.coursePerformance.slice(0, 6);
  const latestStateExam = analysis.school.latestStateExam;
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
  const completedTasksForMetrics = useMemo(() => tasks.filter((task) => task.status === 'tamamlandı'), [tasks]);
  const solvedQuestionCount = useMemo(() => completedTasksForMetrics
    .filter((task) => task.taskType === 'soru çözme')
    .reduce((sum, task) => {
      const hasRecordedCounts = typeof task.correctCount === 'number' || typeof task.incorrectCount === 'number';
      const answered = (task.correctCount || 0) + (task.incorrectCount || 0);
      if (hasRecordedCounts) return sum + answered;
      return sum + (task.questionCount || 0);
    }, 0), [completedTasksForMetrics]);
  const studiedMinutes = useMemo(() => Math.round(completedTasksForMetrics
    .filter((task) => task.taskType !== 'kitap okuma')
    .reduce((sum, task) => sum + ((task.actualDuration || 0) / 60), 0)), [completedTasksForMetrics]);
  const readPages = useMemo(() => completedTasksForMetrics
    .filter((task) => task.taskType === 'kitap okuma')
    .reduce((sum, task) => sum + (task.pagesRead || 0), 0), [completedTasksForMetrics]);
  const showAnalysis = viewMode === 'all' || viewMode === 'analysis';
  const showTasks = viewMode === 'all' || viewMode === 'tasks';
  const showRewards = viewMode === 'all';
  const showDataOps = viewMode === 'all';
  const containerClassName = viewMode === 'all' ? 'space-y-6 px-4 pb-8' : 'space-y-6 pb-8';
  const analysisHeadline = weakTopics[0]
    ? `${weakTopics[0].courseName} / ${weakTopics[0].topicName} su an en riskli alan.`
    : 'Yeterli analiz verisi olustukca en riskli alan burada gosterilecek.';
  const analysisSupportNote = improvingTopics[0]
    ? `${improvingTopics[0].courseName} / ${improvingTopics[0].topicName} toparlaniyor.`
    : 'Yukari trend yakalandiginda toparlanan konu burada gosterilecek.';
  const visibleTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      if (taskListFilter === 'waiting') return task.status === 'bekliyor';
      if (taskListFilter === 'completed') return task.status === 'tamamland\u0131';
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


  useEffect(() => {
    if (!assignmentSubjectOptions.length) {
      setCourseId('');
      return;
    }

    const hasSelectedSubjectName = assignmentSubjectOptions.some((option) => option.value === courseId);
    if (!hasSelectedSubjectName) {
      const firstOption = assignmentSubjectOptions[0]?.value || '';
      setCourseId(firstOption);
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
    setSelectedMetrics((prev) => (
      prev.includes(metricKey)
        ? []
        : [metricKey]
    ));
  };

  const handleAddTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isAddingTask) return;

    if (!dueDate || !plannedDuration || !courseId || !selectedUnitName || !selectedTopicName) {
      showActionMessage('error', 'Gorev atamak icin ders, unite, konu, tarih ve sure secimi zorunludur.');
      return;
    }
    const resolvedCourseId = courses.find((course) => normalizeForLookup(course.name) === normalizeForLookup(selectedCourseName))?.id;
    if (!resolvedCourseId) {
      showActionMessage('error', 'Secili ders icin kayitli ders kimligi bulunamadi. Once Mufredat ekranindan dersi kaydedin.');
      return;
    }

    const generatedTitle = `${selectedCourseName} / ${selectedUnitName} / ${selectedTopicName}`;
    const resolvedTaskType = taskTypeKeyToTaskType(taskTypeKey);
    const derivedTaskGoalType = taskTypeKey === 'question' ? 'test-cozme' : taskTypeKey === 'revision' ? 'konu-tekrari' : 'ders calisma';

    const payload: Omit<Task, 'id' | 'status'> = {
      title: generatedTitle,
      dueDate,
      courseId: resolvedCourseId,
      taskType: resolvedTaskType,
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
      showActionMessage('success', 'Gorev basariyla eklendi.');
    } finally {
      setIsAddingTask(false);
    }
  };

  const handleAddReward = (event: React.FormEvent) => {
    event.preventDefault();
    if (isAddingReward) return;

    const nextRewardName = rewardName.trim();
    const nextRewardCost = Number(rewardCost);
    if (!nextRewardName || !rewardCost) {
      showActionMessage('error', 'Odul adi ve puan alani zorunludur.');
      return;
    }

    if (!Number.isFinite(nextRewardCost) || nextRewardCost <= 0) {
      showActionMessage('error', 'Odul puani sifirdan buyuk bir sayi olmali.');
      return;
    }

    const hasDuplicateReward = rewards.some(
      (reward) => normalizeForLookup(reward.name) === normalizeForLookup(nextRewardName) && reward.cost === nextRewardCost,
    );
    if (hasDuplicateReward) {
      showActionMessage('error', 'Ayni ad ve puandaki odul zaten tanimli.');
      return;
    }

    setIsAddingReward(true);
    try {
      addReward({ name: nextRewardName, cost: nextRewardCost, icon: 'Gift' });
      setRewardName('');
      setRewardCost('100');
      showActionMessage('success', `'${nextRewardName}' odulu eklendi.`);
    } finally {
      window.setTimeout(() => setIsAddingReward(false), 250);
    }
  };

  const handleGenerateReport = async () => {
    if (isGeneratingReport) return;
    setIsGeneratingReport(true);
    try {
      const next = await generateReport(reportPeriod);
      setReport(next);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isImporting) return;
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      await onImportData(file);
    } finally {
      event.target.value = '';
      setIsImporting(false);
    }
  };

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

    const approved = window.confirm('Tum veriler kalici olarak silinecek. Devam etmek istiyor musunuz?');
    if (!approved) return;

    const confirmationText = window.prompt('Son onay icin SIL yazin:');
    if ((confirmationText || '').trim().toUpperCase() !== 'SIL') {
      showActionMessage('error', 'Silme islemi iptal edildi.');
      return;
    }

    setIsDeletingAllData(true);
    try {
      await onDeleteAllData();
    } finally {
      setIsDeletingAllData(false);
    }
  };

  const handleAddExamRecord = (event: React.FormEvent) => {
    event.preventDefault();
    if (!onChangeExamRecords) {
      showActionMessage('error', 'Sinav kaydi bu ekranda guncellenemiyor.');
      return;
    }

    const selectedCourse = courses.find((course) => course.id === examCourseId);
    const parsedScore = Number(examScore);
    const parsedWeight = Number(examWeight);
    if (!selectedCourse || !examTitle.trim() || !examDate || !Number.isFinite(parsedScore)) {
      showActionMessage('error', 'Ders, sinav basligi, tarih ve puan zorunludur.');
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
    showActionMessage('success', 'Okul sinavi kaydi eklendi.');
  };

  const handleAddCompositeExam = (event: React.FormEvent) => {
    event.preventDefault();
    if (!onChangeCompositeExamResults) {
      showActionMessage('error', 'Genel sinav kaydi bu ekranda guncellenemiyor.');
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
      showActionMessage('error', 'Genel sinav icin baslik, tarih ve her satirda Ders: Puan formati zorunludur.');
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
    showActionMessage('success', 'Genel sinav ozeti eklendi.');
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
    <div className={containerClassName}>
      {actionMessage && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${actionMessage.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {actionMessage.text}
        </div>
      )}

      {showRewards && <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Ebeveyn kontrol merkezi</div>
            <h3 className="mt-1 text-base font-black text-slate-900">Odul Tanimla</h3>
          </div>
          <form onSubmit={handleAddReward} className="grid w-full grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_100px_auto] lg:max-w-2xl">
            <input value={rewardName} onChange={(e) => setRewardName(e.target.value)} placeholder="Odul adi" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={rewardCost} onChange={(e) => setRewardCost(e.target.value)} placeholder="Puan" type="number" min="1" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button type="submit" disabled={isAddingReward} className={`rounded-lg px-3 py-2 text-sm font-bold text-white transition ${isAddingReward ? 'cursor-not-allowed bg-slate-300' : rewardButtonTone}`}>
              <span className="block">{isAddingReward ? 'Ekleniyor...' : 'Odulu Ata'}</span>
              <span className="mt-0.5 block text-[11px] font-semibold text-white/90">Mevcut: {availablePoints} BP</span>
            </button>
          </form>
        </div>
        {rewards.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {(showAllRewards ? rewards : rewards.slice(0, 8)).map((reward) => (
              <div key={reward.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
                <span className="font-semibold">{reward.name}</span>
                <span>{reward.cost} BP</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${reward.cost <= availablePoints ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {reward.cost <= availablePoints ? 'Ulasilabilir' : 'Birikiyor'}
                </span>
                <button onClick={() => deleteReward(reward.id)} className="text-rose-600" type="button" aria-label={`${reward.name} odulunu sil`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {rewards.length > 8 && (
              <button type="button" onClick={() => setShowAllRewards((prev) => !prev)} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50">
                {showAllRewards ? 'Daha az goster' : `Tumunu goster (${rewards.length})`}
              </button>
            )}
          </div>
        )}
      </section>}

      {showAnalysis && <section className="rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.06),_transparent_36%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Analiz merkezi</div>
            <h3 className="mt-2 text-2xl font-black text-slate-900">Performans resmi</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">Ham grafik yerine karar cikaracak ozet: hangi konu riskte, hangi ders toparlaniyor, cocuk ne kadar is cikariyor.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:w-[440px]">
            <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-500">Risk sinyali</div>
              <div className="mt-2 text-sm font-bold leading-6 text-rose-900">{analysisHeadline}</div>
            </div>
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">Toparlanma</div>
              <div className="mt-2 text-sm font-bold leading-6 text-emerald-900">{analysisSupportNote}</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className={`${statCard} ${getScoreTone(analysis.overall.generalScore)}`}>
          <div className="text-xs font-semibold uppercase tracking-wide">Genel Skor</div>
          <div className="mt-2 text-3xl font-bold">{analysis.overall.generalScore}</div>
          <div className="mt-1 text-sm opacity-80">Normalize metriklerden uretilen tek karar puani</div>
        </div>
        <div className={`${statCard} ${getScoreTone(analysis.overall.averageEfficiency)}`}>
          <div className="text-xs font-semibold uppercase tracking-wide">Ortalama Verim</div>
          <div className="mt-2 text-3xl font-bold">{analysis.overall.averageEfficiency}</div>
          <div className="mt-1 text-sm opacity-80">Plan/kaynak fark etmeksizin oturum verimi</div>
        </div>
        <div className={`${statCard} ${getScoreTone(analysis.overall.averageFocus)}`}>
          <div className="text-xs font-semibold uppercase tracking-wide">Ortalama Odak</div>
          <div className="mt-2 text-3xl font-bold">{analysis.overall.averageFocus}</div>
          <div className="mt-1 text-sm opacity-80">Mola ve pause dengesine gore</div>
        </div>
        <div className={`${statCard} ${getScoreTone(analysis.overall.averageAccuracy || 0)}`}>
          <div className="text-xs font-semibold uppercase tracking-wide">Ortalama Dogruluk</div>
          <div className="mt-2 text-3xl font-bold">{analysis.overall.averageAccuracy ?? '-'}</div>
          <div className="mt-1 text-sm opacity-80">Soru cozme gorevlerinden hesaplanir</div>
        </div>
        <div className={`rounded-2xl border p-5 shadow-sm ${getScoreTone(100 - analysis.overall.averageRisk)}`}>
          <div className="text-xs font-semibold uppercase tracking-wide">Ortalama Risk</div>
          <div className="mt-2 text-3xl font-bold">{analysis.overall.averageRisk}</div>
          <div className="mt-1 text-sm opacity-80">Model: {analysis.overall.riskModel.toUpperCase()}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tekrar Gereken Konu</div>
          <div className="mt-2 text-3xl font-bold text-slate-800">{weakTopics.length}</div>
          <div className="mt-1 text-sm text-slate-500">Mastery skoru dusuk veya trend asagi</div>
        </div>
        </div>
      </section>}

      {showAnalysis && <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className={card}>
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-slate-700" />
            <h3 className="text-xl font-bold">Okul ve Ev Performansi</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Kayitli okul sinavi</div>
              <div className="mt-2 text-3xl font-black text-slate-900">{examRecords.length}</div>
              <div className="mt-1 text-sm text-slate-600">Yazili, quiz, sozlu ve ders bazli notlar</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Genel / deneme</div>
              <div className="mt-2 text-3xl font-black text-slate-900">{compositeExamResults.length}</div>
              <div className="mt-1 text-sm text-slate-600">Okul geneli veya deneme sinavi ozeti</div>
            </div>
            <div className={`rounded-2xl border p-4 ${latestStateExam ? 'border-sky-200 bg-sky-50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Son genel sinav</div>
              <div className="mt-2 text-lg font-black text-slate-900">{latestStateExam?.title || 'Henuz kayit yok'}</div>
              <div className="mt-1 text-sm text-slate-600">{latestStateExam ? `${latestStateExam.date}${typeof latestStateExam.totalScore === 'number' ? ` · Toplam ${latestStateExam.totalScore}` : ''}` : 'Deneme veya genel sinav girildiginde burada ozetlenir.'}</div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {schoolPerformance.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">Okul notu girdikce ev calismasi ile okul sonucu burada karsilastirilacak.</div>}
            {schoolPerformance.map((item) => (
              <div key={item.courseId} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-base font-bold text-slate-900">{item.courseName}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-2 py-1">Ev skoru: {item.studyScore}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1">Okul skoru: {item.schoolScore ?? '-'}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1">Beklenen: {item.predictedSchoolScore ?? '-'}</span>
                      <span className={`rounded-full border px-2 py-1 ${alignmentToneMap[item.alignmentStatus]}`}>{alignmentLabelMap[item.alignmentStatus]}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Sapma</div>
                    <div className={`mt-1 inline-flex rounded-full px-3 py-1 text-sm font-bold ${item.alignmentGap === null ? 'bg-slate-100 text-slate-600' : item.alignmentGap >= 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {item.alignmentGap === null ? 'Yok' : item.alignmentGap > 0 ? `+${item.alignmentGap}` : item.alignmentGap}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-sm text-slate-600">
                  {item.schoolScore === null
                    ? 'Bu ders icin okul notu girilmedi; tahmin sadece uygulama performansindan uretiliyor.'
                    : item.alignmentStatus === 'kritik-sapma'
                      ? 'Ev icindeki calisma ile okul sonucu arasinda belirgin bir fark var. Konu kapsami veya sinav stresi kontrol edilmeli.'
                      : item.alignmentStatus === 'sapma-var'
                        ? 'Kismi bir uyumsuzluk var. Tekrar duzeni ve soru tipi dengesi kontrol edilmeli.'
                        : 'Ev performansi ile okul sonucu benzer davranis gosteriyor.'}
                </div>
              </div>
            ))}
          </div>

          {latestStateExam && <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Guclu dersler</div>
              <div className="mt-3 space-y-2">
                {latestStateExam.strongestCourses.map((course) => (
                  <div key={`${latestStateExam.title}_${course.courseName}_strong`} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                    <span>{course.courseName}</span>
                    <span className="font-bold text-emerald-700">{course.score}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Riskli dersler</div>
              <div className="mt-3 space-y-2">
                {latestStateExam.riskCourses.map((course) => (
                  <div key={`${latestStateExam.title}_${course.courseName}_risk`} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                    <span>{course.courseName}</span>
                    <span className="font-bold text-rose-700">{course.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>}
        </div>

        <div className="space-y-6">
          <div className={card}>
            <div className="mb-4 flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-slate-700" />
              <h3 className="text-xl font-bold">Sinav Merkezi</h3>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setExamEntryMode('course')}
                className={`rounded-full px-4 py-2 text-sm font-bold ${examEntryMode === 'course' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                Ders bazli sinav
              </button>
              <button
                type="button"
                onClick={() => setExamEntryMode('composite')}
                className={`rounded-full px-4 py-2 text-sm font-bold ${examEntryMode === 'composite' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                Genel sinav / deneme
              </button>
            </div>
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Aktif ders merkezi</div>
              <div className="mt-1 text-sm text-slate-600">Tek merkezde kayitli aktif dersler burada otomatik cikar. Yeni ders eklendiginde bu alan elle guncelleme istemeden yenilenir.</div>
              {activeExamCourseCards.length === 0 && <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">Henuz aktif ders yok. Once merkezi ders listesinden ders eklenmeli.</div>}
              {activeExamCourseCards.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {activeExamCourseCards.map((course) => {
                  const isSelected = examCourseId === course.id;
                  return (
                    <button
                      key={course.id}
                      type="button"
                      onClick={() => setExamCourseId(course.id)}
                      className={`rounded-2xl border p-4 text-left transition ${isSelected ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'}`}
                    >
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
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Secili aktif ders</div>
                  <div className="mt-1 font-bold text-slate-900">{courses.find((course) => course.id === examCourseId)?.name || 'Ders secilmedi'}</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select value={examType} onChange={(event) => setExamType(event.target.value as ExamType)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    {Object.entries(examTypeLabelMap).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <input value={examDate} onChange={(event) => setExamDate(event.target.value)} type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <input value={examTitle} onChange={(event) => setExamTitle(event.target.value)} placeholder="Orn. Matematik 2. yazili" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <div className="grid gap-3 sm:grid-cols-3">
                  <input value={examScore} onChange={(event) => setExamScore(event.target.value)} type="number" min="0" max="100" placeholder="Puan" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <input value={examWeight} onChange={(event) => setExamWeight(event.target.value)} type="number" min="1" placeholder="Agirlik" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <select value={examScopeType} onChange={(event) => setExamScopeType(event.target.value as 'topic' | 'unit' | 'course' | 'multi-course')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="topic">Konu</option>
                    <option value="unit">Unite</option>
                    <option value="course">Ders</option>
                    <option value="multi-course">Coklu ders</option>
                  </select>
                </div>
                <input value={examTermKey} onChange={(event) => setExamTermKey(event.target.value)} placeholder="Donem anahtari" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <textarea value={examNotes} onChange={(event) => setExamNotes(event.target.value)} rows={2} placeholder="Kisa not" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <button type="submit" disabled={!examCourseId} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">Sinav Kaydi Ekle</button>
              </form>
            ) : (
              <form onSubmit={handleAddCompositeExam} className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={compositeTitle} onChange={(event) => setCompositeTitle(event.target.value)} placeholder="Orn. Nisan Turkiye Geneli" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <input value={compositeDate} onChange={(event) => setCompositeDate(event.target.value)} type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select value={compositeType} onChange={(event) => setCompositeType(event.target.value as 'state-exam' | 'mock-exam')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="state-exam">Genel sinav</option>
                    <option value="mock-exam">Deneme</option>
                  </select>
                  <input value={compositeTotalScore} onChange={(event) => setCompositeTotalScore(event.target.value)} type="number" min="0" placeholder="Toplam puan (opsiyonel)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <textarea
                  value={compositeCourseScores}
                  onChange={(event) => setCompositeCourseScores(event.target.value)}
                  rows={5}
                  placeholder={"Her satir: Ders: Puan\nMatematik: 78\nFen Bilimleri: 72"}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <textarea value={compositeNotes} onChange={(event) => setCompositeNotes(event.target.value)} rows={2} placeholder="Kisa not" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <button type="submit" className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-bold text-white hover:bg-sky-600">Genel Sinav Ozeti Ekle</button>
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
                <div key={record.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-800">{record.courseName} · {record.title}</div>
                      <div className="mt-1 text-slate-500">{examTypeLabelMap[record.examType]} · {record.date} · Puan {record.score}</div>
                    </div>
                    <button type="button" onClick={() => handleDeleteExamRecord(record.id)} className="text-rose-600">Sil</button>
                  </div>
                </div>
              ))}
              {recentExamRecords.length === 0 && <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Henuz ders bazli sinav kaydi yok.</div>}
            </div>
            <div className="mt-4 space-y-3">
              {compositeExamResults.slice(0, 3).map((record) => (
                <div key={record.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-800">{record.title}</div>
                      <div className="mt-1 text-slate-500">{record.examType === 'state-exam' ? 'Genel sinav' : 'Deneme'} · {record.date} · {record.courses.length} ders</div>
                    </div>
                    <button type="button" onClick={() => handleDeleteCompositeExam(record.id)} className="text-rose-600">Sil</button>
                  </div>
                </div>
              ))}
              {compositeExamResults.length === 0 && <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Henuz genel sinav veya deneme ozeti yok.</div>}
            </div>
          </div>
        </div>
      </section>}

      {showAnalysis && <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className={card}>
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
            <h3 className="text-xl font-bold">Zayif ve Riskli Konular</h3>
          </div>
          <div className="space-y-3">
            {weakTopics.length === 0 && <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Su anda tekrar bayragi olan konu yok.</div>}
            {weakTopics.map((topic) => (
              <div key={topic.key} className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-800">{topic.courseName} / {topic.unitName}</div>
                    <div className="text-sm text-slate-600">{topic.topicName}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-white px-2 py-1">Mastery: {topic.masteryScore}</span>
                      <span className="rounded-full bg-white px-2 py-1">Odak: {topic.averageFocus}</span>
                      <span className="rounded-full bg-white px-2 py-1">Verim: {topic.averageEfficiency}</span>
                      {typeof topic.averageAccuracy === 'number' && <span className="rounded-full bg-white px-2 py-1">Dogruluk: {topic.averageAccuracy}</span>}
                    </div>
                  </div>
                  <div className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">{topic.trend === 'down' ? 'Asagi Trend' : 'Tekrar Gerekli'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className={card}>
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              <h3 className="text-xl font-bold">Gelisen Konular</h3>
            </div>
            <div className="space-y-3">
              {improvingTopics.length === 0 && <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Yukari trend gosteren konu henuz yok.</div>}
              {improvingTopics.map((topic) => (
                <div key={topic.key} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="font-semibold text-slate-800">{topic.topicName}</div>
                  <div className="text-sm text-slate-600">{topic.courseName} / {topic.unitName}</div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-emerald-700 font-semibold">Hakimiyet {topic.masteryScore}</span>
                    <span className="rounded-full bg-white px-2 py-1 text-xs text-emerald-700">Yukari Trend</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={card}>
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-sky-600" />
              <h3 className="text-xl font-bold">Kisa yorum</h3>
            </div>
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              <div className="rounded-xl bg-slate-50 p-4">Toplam tamamlanan gorev <strong>{completedCount}</strong>, cozulen soru <strong>{solvedQuestionCount}</strong>. Analiz sadece yapilan ise gore hesaplanir.</div>
              <div className="rounded-xl bg-slate-50 p-4">Ortalama odak <strong>{analysis.overall.averageFocus}</strong>, verim <strong>{analysis.overall.averageEfficiency}</strong>. {analysis.overall.averageEfficiency < 60 ? 'Sure ve mola kullanimi toparlanmali.' : 'Oturum kalitesi su an kabul edilebilir seviyede.'}</div>
            </div>
          </div>
        </div>
      </section>}

      {showAnalysis && <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className={card}>
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-primary-600" />
            <h3 className="text-xl font-bold">Calisma Ozeti</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Tamamlanan Gorev</div><div className="mt-2 text-2xl font-bold">{completedCount}</div></div>
            <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Bekleyen Gorev</div><div className="mt-2 text-2xl font-bold">{pendingCount}</div></div>
            <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Cozulen Soru</div><div className="mt-2 text-2xl font-bold text-sky-600">{solvedQuestionCount}</div></div>
            <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Calisilan Sure</div><div className="mt-2 text-2xl font-bold text-emerald-600">{studiedMinutes} dk</div></div>
            <div className="rounded-xl bg-slate-50 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Okunan Sayfa</div><div className="mt-2 text-2xl font-bold">{readPages}</div></div>
            <div className={`rounded-xl p-4 ${getScoreTone(analysis.overall.generalScore)}`}><div className="text-xs uppercase tracking-wide">Genel Skor</div><div className="mt-2 text-2xl font-bold">{analysis.overall.generalScore}</div></div>
          </div>
        </div>

        <div className={card}>
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary-600" />
            <h3 className="text-xl font-bold">Ders Bazli Hakimiyet</h3>
          </div>
          <div className="space-y-3">
            {topCourses.length === 0 && <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Henuz ders bazli metric olusmadi.</div>}
            {topCourses.map((course) => (
              <div key={course.courseId} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-800">{course.courseName}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-2 py-1">Hakimiyet: {course.averageMastery}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1">Odak: {course.averageFocus}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1">Verim: {course.averageEfficiency}</span>
                      {typeof course.averageAccuracy === 'number' && <span className="rounded-full bg-slate-100 px-2 py-1">Dogruluk: {course.averageAccuracy}</span>}
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-rose-700">Zayif Konu: {course.weakTopicCount}</span>
                    </div>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ${getScoreTone(course.averageMastery)}`}>{course.averageMastery}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>}

      {(loading || error) && (
        <div className="rounded-xl bg-white p-4 text-sm text-slate-600 shadow-md">
          {loading ? 'Veriler yukleniyor...' : error}
        </div>
      )}

      {showTasks && <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">Gorev atama</div>
            <h3 className="mt-1 text-2xl font-black text-slate-900">Cocuga gorev gonder</h3>
            <p className="mt-1 text-sm text-slate-500">Ders, unite, konu, sure ve hedef belirleyip gorevi dogrudan ata.</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Secili ders: <strong>{selectedCourseName || 'Ders secilmedi'}</strong>
          </div>
        </div>

        <form onSubmit={handleAddTask} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-sm font-black text-white">1</span>
                <div>
                  <h4 className="font-bold text-slate-900">Ders ve mufredat</h4>
                  <p className="text-xs text-slate-500">Unite/konu baglantisi.</p>
                </div>
              </div>
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Ders</label>
                <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setSelectedUnitName(''); setSelectedTopicName(''); }} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm">
                  {assignmentSubjectOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Unite</label>
                <select value={selectedUnitName} onChange={(e) => { setSelectedUnitName(e.target.value); setSelectedTopicName(''); }} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm">
                  <option value="">Unite sec</option>
                  {activeUnits.map((unit) => <option key={unit.name} value={unit.name}>{unit.name}</option>)}
                </select>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Konu</label>
                <select value={selectedTopicName} onChange={(e) => setSelectedTopicName(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm" disabled={!selectedUnitName}>
                  <option value="">Konu sec</option>
                  {activeTopics.map((topic) => <option key={topic.name} value={topic.name}>{topic.name}</option>)}
                </select>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-sm font-black text-white">2</span>
                <div>
                  <h4 className="font-bold text-slate-900">Gorev detaylari</h4>
                  <p className="text-xs text-slate-500">Baslik, tarih, sure.</p>
                </div>
              </div>
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Gorev basligi</label>
                <input value={`${selectedCourseName || 'Ders'}${selectedUnitName ? ` / ${selectedUnitName}` : ''}${selectedTopicName ? ` / ${selectedTopicName}` : ''}`} readOnly className="w-full rounded-2xl border border-slate-300 bg-slate-100 px-3 py-3 text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Tarih</label>
                    <input value={dueDate} onChange={(e) => setDueDate(e.target.value)} type="date" className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-3 text-sm" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Sure</label>
                    <input value={plannedDuration} onChange={(e) => setPlannedDuration(e.target.value)} type="number" min="1" placeholder="dk" className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-3 text-sm" required />
                  </div>
                </div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Gorev turu</label>
                <select value={taskTypeKey} onChange={(e) => setTaskTypeKey(resolveTaskTypeKey(e.target.value))} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm">
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
                  className="w-full rounded-2xl border border-slate-300 px-3 py-3 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-slate-900 p-4 text-white">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-black text-slate-900">3</span>
                <div>
                  <h4 className="font-bold">Olcum ve hedef</h4>
                  <p className="text-xs text-slate-300">Analiz bu bilgilerden beslenir.</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="block text-xs font-bold uppercase tracking-wide text-slate-300">Metrik secimi (tek secim)</div>
                  <div className="space-y-2">
                    {availableMetricOptions.map((metric) => {
                      const checked = selectedMetrics.includes(metric.key);
                      return (
                        <label key={metric.key} className={`block rounded-xl border px-3 py-2 transition ${checked ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100' : 'border-slate-700 bg-slate-800/60 text-slate-200'}`}>
                          <span className="flex items-start gap-2">
                            <input
                              type="radio"
                              name="assignmentMetric"
                              checked={checked}
                              onChange={() => toggleMetric(metric.key)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-500 bg-slate-900 text-emerald-500"
                            />
                            <span>
                              <span className="block text-sm font-semibold leading-5">{metric.label}</span>
                              <span className="block text-[11px] leading-4 text-slate-300">{metric.hint}</span>
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/10 px-3 py-2 text-xs leading-5 text-slate-300">Ayni gorevde yalnizca bir metrik secilir. Hedef otomatik %100 kabul edilir.</div>
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-sm text-slate-600">
              <strong>Ozet:</strong> {selectedCourseName || 'Ders'} {selectedUnitName ? `/ ${selectedUnitName}` : ''} {selectedTopicName ? `/ ${selectedTopicName}` : ''} icin gorev atanacak{taskTypeKey === 'question' && Number(questionCount) > 0 ? ` (${questionCount} soru)` : ''}.
            </div>
            <button type="submit" disabled={!selectedCourseName || !selectedUnitName || !selectedTopicName || isAddingTask} className="rounded-2xl bg-primary-600 px-6 py-3 text-sm font-black text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300">{isAddingTask ? 'Kaydediliyor...' : 'Gorevi Ata'}</button>
          </div>
        </form>
      </div>}

      {showTasks && <div className={card}>        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-xl font-bold">Gorevler</h3>
            <div className="text-sm text-slate-500">Bekleyen {pendingCount} / Tamamlanan {completedCount}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setTaskListFilter('waiting')} className={`rounded-full px-3 py-2 text-xs font-bold ${taskListFilter === 'waiting' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>Bekleyen</button>
            <button onClick={() => setTaskListFilter('overdue')} className={`rounded-full px-3 py-2 text-xs font-bold ${taskListFilter === 'overdue' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700'}`}>Geciken</button>
            <button onClick={() => setTaskListFilter('completed')} className={`rounded-full px-3 py-2 text-xs font-bold ${taskListFilter === 'completed' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700'}`}>Tamamlanan</button>
            <button onClick={() => setTaskListFilter('all')} className={`rounded-full px-3 py-2 text-xs font-bold ${taskListFilter === 'all' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Tumu</button>
          </div>
        </div>
        <div className="space-y-3">
          {visibleTasks.length === 0 && <div className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">Bu filtreye uygun gorev yok.</div>}
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
              <div key={task.id} className={`rounded-xl border p-4 ${isOverdue ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-white'}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                      <span>{courseNameMap.get(task.courseId) || task.courseId}</span>
                      <span>/</span>
                      <span>{task.plannedDuration} dk</span>
                      {typeof task.questionCount === 'number' && task.questionCount > 0 && (
                        <>
                          <span>/</span>
                          <span>{task.questionCount} soru</span>
                        </>
                      )}
                      <span>/</span>
                      <span>{task.dueDate}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{formatPlanSource(task.planSource, task.planLabel)}</span>
                      {task.isSelfAssigned && <span className="rounded-full bg-indigo-100 px-2 py-1 text-indigo-700">Serbest</span>}
                      {isOverdue && <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">Gecikti</span>}
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
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${task.status === 'tamamland\u0131' ? 'bg-green-100 text-green-700' : isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {task.status === 'tamamland\u0131' ? 'Tamamlandi' : isOverdue ? 'Gecikti' : 'Bekliyor'}
                    </span>
                    <button onClick={() => deleteTask(task.id)} className="text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>}

      {showDataOps && (
        <div className={card}>
          <div className="mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary-600" />
            <h3 className="text-xl font-bold">Veri Islemleri</h3>
          </div>
          <p className="mb-4 text-sm text-slate-500">Ice/disa aktarma ve tum veri sifirlama islemleri tek noktada tutulur.</p>
          <div className="flex flex-wrap gap-2">
            <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportFileChange} className="hidden" />
            <button onClick={handleImportClick} disabled={isImporting} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-white ${isImporting ? 'cursor-not-allowed bg-slate-300' : 'bg-sky-600'}`}><Upload className="h-4 w-4" />{isImporting ? 'Iceri aliniyor...' : 'Ice Aktar'}</button>
            <button onClick={handleExportData} disabled={isExporting || !onExportData} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-white ${isExporting || !onExportData ? 'cursor-not-allowed bg-slate-300' : 'bg-emerald-600'}`}><Download className="h-4 w-4" />{isExporting ? 'Disa aktariliyor...' : 'Disa Aktar'}</button>
            <button onClick={handleDeleteAllData} disabled={isDeletingAllData} className={`rounded-lg px-4 py-2 text-white ${isDeletingAllData ? 'cursor-not-allowed bg-slate-300' : 'bg-red-600'}`}>{isDeletingAllData ? 'Siliniyor...' : 'Tum Veriyi Sil'}</button>
          </div>
        </div>
      )}

      {showAnalysis && <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className={card}>
          <div className="mb-4 flex items-center gap-2"><FileText className="h-5 w-5 text-primary-600" /><h3 className="text-xl font-bold">Rapor</h3></div>
          <div className="flex gap-2">
            <select value={reportPeriod} onChange={(e) => setReportPeriod(e.target.value as 'Haftal\u0131k' | 'Ayl\u0131k' | 'Y\u0131ll\u0131k' | 'T\u00fcm Zamanlar')} className="rounded-lg border border-slate-300 px-3 py-2">
              <option value="Haftal\u0131k">Haftalik</option>
              <option value="Ayl\u0131k">Aylik</option>
              <option value="Y\u0131ll\u0131k">Yillik</option>
              <option value="T\u00fcm Zamanlar">Tum Zamanlar</option>
            </select>
            <button onClick={handleGenerateReport} disabled={isGeneratingReport} className={`rounded-lg px-4 py-2 text-white ${isGeneratingReport ? 'cursor-not-allowed bg-slate-400' : 'bg-slate-800'}`}>{isGeneratingReport ? 'Uretiliyor...' : 'Rapor Uret'}</button>
          </div>
          {report && (
            <div className="mt-4 space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
              <div><strong>Ozet:</strong> {report.aiSummary}</div>
              <div><strong>Guclu Alan:</strong> {report.highlights.mostImproved}</div>
              <div><strong>Odak Alani:</strong> {report.highlights.needsFocus}</div>
              <div><strong>Oneri:</strong> {report.aiSuggestion}</div>
            </div>
          )}
        </div>

      </div>}

      {showAnalysis && (
        <AnalysisGraphCenter
          tasks={tasks}
          courses={courses}
          curriculum={curriculum}
          analysis={analysis}
          loading={loading}
          error={error}
        />
      )}
    </div>
  );
};

export default ParentDashboard;

















