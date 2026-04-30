import React, { useEffect, useMemo, useState } from 'react';
import { BarChart as RechartsBarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChildDashboardProps, Task, TaskFilter, ChildView, CurriculumUnit } from '../../types';
import ActiveTaskTimer from './ActiveTaskTimer';
import ActiveReadingSession from './ActiveReadingSession';
import StudyStats from './StudyStats';
import { Trophy, PlusCircle, Play, Gift, BadgeCheck, Target, BarChart, Brain, BookMarked, Calendar, CheckCircle } from '../icons';
import { getTodayString, getDaysAgo, getLocalDateString } from '../../utils/dateUtils';
import { deriveAnalysisSnapshot } from '../../utils/analysisEngine';
import { ChartTooltip, chartAxisProps, chartPalette } from '../shared/chartDesign';
import ContextHelp from '../shared/ContextHelp';

const card = 'ios-card rounded-[28px] p-4';
const subtleCard = 'ios-widget rounded-[26px] p-4';
const looksCorrupted = (value?: string) => typeof value === 'string' && (value.includes('\u00C3') || value.includes('\u00C2') || value.includes('\u00E2'));

const repairText = (value?: string) => {
  if (typeof value !== 'string' || !value) return value;

  let next = value;
  for (let i = 0; i < 3; i += 1) {
    if (!looksCorrupted(next)) break;
    try {
      const bytes = Uint8Array.from(Array.from(next).map((char) => char.charCodeAt(0) & 0xff));
      const repaired = new TextDecoder('utf-8').decode(bytes);
      if (!repaired || repaired === next) break;
      next = repaired;
    } catch {
      break;
    }
  }

  return next;
};

const safeText = (value?: string, fallback = '') => {
  const repaired = repairText(value);
  if (!repaired || looksCorrupted(repaired)) return fallback;
  return repaired;
};

const safeBadgeName = (value?: string) => safeText(value, 'Ilk Adim');
const safeBadgeDescription = (value?: string) => safeText(value, 'Rozet aciklamasi yakinda guncellenecek.');
const goalLabelMap: Record<string, string> = {
  'test-cozme': 'Test cozme',
  'olcme-degerlendirme': 'Olcme degerlendirme',
  'sinav-hazirlik': 'Sinav hazirligi',
  'konu-tekrari': 'Konu tekrari',
  'eksik-konu-tamamlama': 'Eksik konu tamamlama',
  'ders calisma': 'Ders calismasi',
  'ders \u00e7al\u0131\u015fma': 'Ders calismasi',
};
const planSourceLabelMap: Record<string, string> = { manual: 'Elle atandi', 'weekly-plan': 'Haftalik plan', 'ai-plan': 'Akilli plan', 'free-study': 'Serbest calisma' };
const safeGoalText = (value?: string) => goalLabelMap[safeText(value, '')] || safeText(value, 'Calisma hedefi');
const safePlanSource = (value?: string) => planSourceLabelMap[safeText(value, '')] || 'Atanan gorev';
const getTaskDateKey = (value?: string) => {
  if (typeof value !== 'string' || !value) return '';
  return value.split('T')[0];
};

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

const parseSavedTimerState = (taskId: string): ResumeTimerState | undefined => {
  const saved = window.localStorage.getItem(`timerState_${taskId}`);
  if (!saved) return undefined;
  try {
    return JSON.parse(saved) as ResumeTimerState;
  } catch {
    return undefined;
  }
};

const formatTaskType = (value: Task['taskType']) => {
  if (value === 'soru \u00e7\u00f6zme') return 'Soru cozumu';
  if (value === 'kitap okuma') return 'Kitap okuma';
  return 'Ders calismasi';
};

const getChildTaskPriority = (task: Task, today: string) => {
  const dueDate = getTaskDateKey(task.dueDate);
  if (task.status === 'tamamland\u0131') return 6;
  if (dueDate < today && !task.isSelfAssigned) return 0;
  if (dueDate < today) return 1;
  if (dueDate === today && !task.isSelfAssigned) return 2;
  if (dueDate === today) return 3;
  if (!task.isSelfAssigned) return 4;
  return 5;
};

const sortChildTasks = (items: Task[], today: string) => {
  return [...items].sort((a, b) => {
    const priorityDiff = getChildTaskPriority(a, today) - getChildTaskPriority(b, today);
    if (priorityDiff !== 0) return priorityDiff;
    const dateDiff = getTaskDateKey(a.dueDate).localeCompare(getTaskDateKey(b.dueDate));
    if (dateDiff !== 0) return dateDiff;
    return a.title.localeCompare(b.title);
  });
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

interface ResumeTimerState {
  mainTime: number;
  breakTime: number;
  pauseTime: number;
  status: 'running' | 'paused' | 'break';
  isPaused?: boolean;
  pausedAt?: number;
  note?: string;
}

const WeeklyPointsPanel: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
  const weeklyData = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = getDaysAgo(6 - index);
      const dateString = getLocalDateString(date);
      return {
        day: date.toLocaleDateString('tr-TR', { weekday: 'short' }),
        points: tasks.filter((task) => task.completionDate === dateString).reduce((sum, task) => sum + (task.pointsAwarded || 0), 0),
      };
    });
  }, [tasks]);

  return (
    <div className={subtleCard}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Haftalik puan akisi</h3>
          <p className="text-sm text-slate-500">Son 7 gunde topladigin basari puanlari.</p>
        </div>
        <BarChart className="h-5 w-5 text-emerald-500" />
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <RechartsBarChart data={weeklyData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <XAxis dataKey="day" {...chartAxisProps} />
          <YAxis {...chartAxisProps} />
          <Tooltip content={<ChartTooltip valueFormatter={(value) => `${value} BP`} />} />
          <Bar dataKey="points" name="Puan" radius={[12, 12, 0, 0]} fill={chartPalette.blue} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
};

const ReadingLibraryPanel: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
  const books = useMemo(() => {
    const map = new Map<string, number>();
    tasks
      .filter((task) => task.taskType === 'kitap okuma' && task.status === 'tamamland\u0131' && task.bookTitle)
      .forEach((task) => {
        const title = safeText(task.bookTitle, 'Kitap');
        map.set(title, (map.get(title) || 0) + (task.pagesRead || 0));
      });

    return Array.from(map.entries())
      .map(([title, pages]) => ({ title, pages }))
      .sort((a, b) => b.pages - a.pages)
      .slice(0, 3);
  }, [tasks]);

  return (
    <div className={subtleCard}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Okuma kutuphanesi</h3>
          <p className="text-sm text-slate-500">Tamamlanan kitap okumalarindan biriken sayfalar.</p>
        </div>
        <BookMarked className="h-5 w-5 text-teal-500" />
      </div>
      <div className="space-y-3">
        {books.length === 0 && <div className="ios-widget rounded-[20px] px-4 py-5 text-sm text-slate-500">Henuz tamamlanmis kitap okuma oturumu yok.</div>}
        {books.map((book) => (
          <div key={book.title} className="ios-widget rounded-[20px] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-800">{book.title}</div>
                <div className="text-xs text-slate-500">Toplam okunan sayfa</div>
              </div>
              <div className="rounded-full bg-teal-100 px-3 py-1 text-sm font-bold text-teal-700">{book.pages}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TaskCard: React.FC<{ task: Task; courseName: string; onStart: (task: Task, timerState?: ResumeTimerState) => void; completed?: boolean; today: string; isStarting?: boolean }> = ({ task, courseName, onStart, completed = false, today, isStarting = false }) => {
  const savedState = parseSavedTimerState(task.id);
  let isPaused = false;
  let resumeState: ResumeTimerState | undefined;

  if (savedState) {
    isPaused = savedState.isPaused || false;
    if (isPaused) {
      resumeState = savedState;
    }
  }

  const isOverdue = !completed && getTaskDateKey(task.dueDate) < today;

  return (
    <div className={`ios-widget rounded-[24px] p-4 transition ${isOverdue ? 'ios-coral' : ''}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            <span>{safeText(courseName, 'Ders')}</span>
            <span className="text-slate-300">/</span>
            <span>{formatTaskType(task.taskType)}</span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] tracking-normal text-slate-600">{safeText(task.planLabel, '') || safePlanSource(task.planSource)}</span>
            {task.isSelfAssigned && <span className="rounded-full bg-indigo-100 px-2 py-1 text-[11px] tracking-normal text-indigo-700">Serbest</span>}
            {isOverdue && <span className="rounded-full bg-rose-100 px-2 py-1 text-[11px] tracking-normal text-rose-700">Takipte</span>}
          </div>
          <h4 className="mt-2 text-lg font-bold leading-7 text-slate-900">{safeText(task.bookTitle || task.title, 'Gorev')}</h4>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{task.plannedDuration} dk</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{task.dueDate}</span>
            {task.questionCount ? <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">{task.questionCount} soru</span> : null}
            {task.curriculumUnitName ? <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">Unite: {safeText(task.curriculumUnitName, 'Unite')}</span> : null}
            {task.curriculumTopicName ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Konu: {safeText(task.curriculumTopicName, 'Konu')}</span> : null}
            {task.taskGoalType ? <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-700">Hedef: {safeGoalText(task.taskGoalType)}</span> : null}
          </div>
          {completed ? (
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div className="ios-widget rounded-[18px] px-3 py-2"><div className="text-slate-400">Basari</div><div className="font-bold text-slate-800">{task.successScore || 0}</div></div>
              <div className="ios-widget rounded-[18px] px-3 py-2"><div className="text-slate-400">Odak</div><div className="font-bold text-slate-800">{task.focusScore || 0}</div></div>
              <div className="ios-widget ios-yellow rounded-[18px] px-3 py-2"><div className="text-slate-500">Puan</div><div className="font-bold text-amber-700">+{task.pointsAwarded || 0}</div></div>
            </div>
          ) : null}
        </div>
        {completed ? (
          <div className="flex items-center gap-2 self-start rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            <CheckCircle className="h-4 w-4" /> Tamamlandi
          </div>
        ) : (
          <button
            onClick={() => onStart(task, resumeState)}
            disabled={isStarting}
            className={`self-start rounded-[18px] px-5 py-3 text-sm font-bold ${isStarting ? 'ios-button cursor-not-allowed text-slate-500 opacity-60' : isPaused ? 'ios-yellow text-amber-950' : 'ios-button-active text-slate-900'}`}
          >
            <Play className="mr-2 inline h-4 w-4" />
            {isStarting ? 'Baslatiliyor...' : isPaused ? 'Devam et' : 'Baslat'}
          </button>
        )}
      </div>
    </div>
  );
};

const ChildDashboard: React.FC<ChildDashboardProps> = ({
  tasks,
  courses,
  rewards,
  badges,
  successPoints,
  startTask,
  completeTask,
  claimReward,
  addTask,
  curriculum,
  ai,
}) => {
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('today');
  const [activeView, setActiveView] = useState<ChildView>('tasks');
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeReadingTask, setActiveReadingTask] = useState<Task | null>(null);
  const [resumedTimerState, setResumedTimerState] = useState<ResumeTimerState | undefined>(undefined);
  const [showFreeStudy, setShowFreeStudy] = useState(false);
  const [freeTitle, setFreeTitle] = useState('');
  const [freeCourseId, setFreeCourseId] = useState(courses[0]?.id || '');
  const [freeType, setFreeType] = useState<'soru \u00e7\u00f6zme' | 'ders \u00e7al\u0131\u015fma' | 'kitap okuma'>('ders \u00e7al\u0131\u015fma');
  const [freeDuration, setFreeDuration] = useState('30');
  const [freeQuestionCount, setFreeQuestionCount] = useState('20');
  const [freeBookTitle, setFreeBookTitle] = useState('');
  const [freeUnitName, setFreeUnitName] = useState('');
  const [freeTopicName, setFreeTopicName] = useState('');
  const [freeGoalType, setFreeGoalType] = useState('ders calisma');
  const [claimingRewardId, setClaimingRewardId] = useState<string | null>(null);
  const [creatingFreeStudy, setCreatingFreeStudy] = useState(false);
  const [startingTaskId, setStartingTaskId] = useState<string | null>(null);

  const today = getTodayString();
  const courseNameMap = useMemo(() => new Map(courses.map((course) => [course.id, safeText(course.name, course.id)])), [courses]);
  const analysis = useMemo(() => deriveAnalysisSnapshot(tasks, courses), [tasks, courses]);
  const selectedCourseName = courseNameMap.get(freeCourseId) || '';
  const activeUnits = useMemo<CurriculumUnit[]>(() => {
    if (!selectedCourseName) return [];
    const directUnits = curriculum[selectedCourseName];
    if (Array.isArray(directUnits) && directUnits.length > 0) return directUnits;
    const normalizedCourseName = normalizeForLookup(selectedCourseName);
    const matchedSubject = Object.keys(curriculum).find((subject) => normalizeForLookup(subject) === normalizedCourseName);
    if (!matchedSubject) return Array.isArray(directUnits) ? directUnits : [];
    return curriculum[matchedSubject];
  }, [curriculum, selectedCourseName]);
  const activeTopics = useMemo(() => (freeUnitName ? activeUnits.find((unit) => unit.name === freeUnitName)?.topics || [] : []), [activeUnits, freeUnitName]);

  useEffect(() => {
    if (!freeCourseId && courses[0]?.id) setFreeCourseId(courses[0].id);
  }, [courses, freeCourseId]);

  useEffect(() => {
    setFreeUnitName('');
    setFreeTopicName('');
  }, [freeCourseId]);

  useEffect(() => {
    setFreeTopicName('');
  }, [freeUnitName]);

  useEffect(() => {
    const resumeTaskId = window.localStorage.getItem('resumeTaskId');
    if (!resumeTaskId) return;

    const task = tasks.find((item) => item.id === resumeTaskId);
    const savedState = parseSavedTimerState(resumeTaskId);

    if (!task || !savedState) return;

    try {
      const parsed = savedState;
      if (task.taskType === 'kitap okuma') {
        setResumedTimerState(parsed);
        setActiveReadingTask(task);
      } else {
        setResumedTimerState(parsed);
        setActiveTask(task);
      }
      window.localStorage.removeItem('resumeTaskId');
    } catch (error) {
      console.error('Resume state parse error:', error);
    }
  }, [tasks]);

  const pendingTasks = useMemo(() => {
    const base = tasks.filter((task) => task.status === 'bekliyor');
    if (taskFilter === 'today') return sortChildTasks(base.filter((task) => getTaskDateKey(task.dueDate) <= today), today);
    if (taskFilter === 'upcoming') return sortChildTasks(base.filter((task) => getTaskDateKey(task.dueDate) > today), today);
    return sortChildTasks(base, today);
  }, [tasks, taskFilter, today]);

  const assignedPendingTasks = useMemo(() => pendingTasks.filter((task) => !task.isSelfAssigned), [pendingTasks]);
  const freePendingTasks = useMemo(() => pendingTasks.filter((task) => task.isSelfAssigned), [pendingTasks]);
  const completedToday = useMemo(() => tasks.filter((task) => task.status === 'tamamland\u0131' && task.completionDate === today), [tasks, today]);
  const assignedTodayCount = useMemo(() => tasks.filter((task) => !task.isSelfAssigned && getTaskDateKey(task.dueDate) <= today).length, [tasks, today]);
  const waitingTodayCount = useMemo(() => tasks.filter((task) => task.status === 'bekliyor' && getTaskDateKey(task.dueDate) <= today).length, [tasks, today]);
  const completedTasksForSummary = useMemo(() => tasks.filter((task) => task.status === 'tamamlandı'), [tasks]);
  const solvedQuestionCount = useMemo(() => completedTasksForSummary
    .filter((task) => task.taskType === 'soru çözme')
    .reduce((sum, task) => {
      const hasRecordedCounts = typeof task.correctCount === 'number' || typeof task.incorrectCount === 'number';
      const answered = (task.correctCount || 0) + (task.incorrectCount || 0);
      if (hasRecordedCounts) return sum + answered;
      return sum + (task.questionCount || 0);
    }, 0), [completedTasksForSummary]);
  const studiedMinutes = useMemo(() => Math.round(completedTasksForSummary
    .filter((task) => task.taskType !== 'kitap okuma')
    .reduce((sum, task) => sum + ((task.actualDuration || 0) / 60), 0)), [completedTasksForSummary]);
  const readPages = useMemo(() => completedTasksForSummary
    .filter((task) => task.taskType === 'kitap okuma')
    .reduce((sum, task) => sum + (task.pagesRead || 0), 0), [completedTasksForSummary]);
  const resumableSessions = useMemo(() => tasks
    .filter((task) => task.status === 'bekliyor')
    .map((task) => ({ task, timerState: parseSavedTimerState(task.id) }))
    .filter((item): item is { task: Task; timerState: ResumeTimerState } => Boolean(item.timerState))
    .sort((left, right) => (right.timerState.pausedAt || 0) - (left.timerState.pausedAt || 0)), [tasks]);
  const currentLiveSession = resumableSessions[0];

  const topTopic = analysis.topics[0];
  const weakestTopic = analysis.topics.find((topic) => topic.needsRevision) || analysis.topics[0];

  const startSelectedTask = (task: Task, timerState?: ResumeTimerState) => {
    if (startingTaskId) return;
    const resolvedTimerState = timerState || parseSavedTimerState(task.id);
    setStartingTaskId(task.id);
    startTask(task.id);
    if (task.taskType === 'kitap okuma') {
      setResumedTimerState(resolvedTimerState);
      setActiveReadingTask(task);
      window.setTimeout(() => setStartingTaskId((current) => (current === task.id ? null : current)), 350);
      return;
    }
    setResumedTimerState(resolvedTimerState);
    setActiveTask(task);
    window.setTimeout(() => setStartingTaskId((current) => (current === task.id ? null : current)), 350);
  };

  const handleClaimReward = (rewardId: string) => {
    if (claimingRewardId) return;
    setClaimingRewardId(rewardId);
    claimReward(rewardId);
    window.setTimeout(() => {
      setClaimingRewardId((current) => (current === rewardId ? null : current));
    }, 350);
  };

  const handlePauseForLater = (_taskId: string, timerState: ResumeTimerState) => {
    setResumedTimerState(timerState);
    setActiveTask(null);
  };

  const handleCreateFreeStudy = async (event: React.FormEvent) => {
    event.preventDefault();
    if (creatingFreeStudy) return;
    if (!freeTitle.trim() || !freeCourseId || !freeDuration) return;

    setCreatingFreeStudy(true);
    try {
      const created = await addTask({
        title: freeTitle.trim(),
        courseId: freeCourseId,
        dueDate: today,
        taskType: freeType,
        plannedDuration: Number(freeDuration),
        isSelfAssigned: true,
        ...(freeType === 'soru \u00e7\u00f6zme' ? { questionCount: Number(freeQuestionCount) } : {}),
        ...(freeType === 'kitap okuma' ? { bookTitle: freeBookTitle, readingType: 'serbest', bookGenre: 'Hikaye' } : {}),
        ...(freeUnitName ? { curriculumUnitName: freeUnitName } : {}),
        ...(freeTopicName ? { curriculumTopicName: freeTopicName } : {}),
        ...(freeType !== 'kitap okuma' ? { taskGoalType: freeGoalType || undefined } : {}),
        planSource: 'free-study',
      });

      setShowFreeStudy(false);
      setFreeTitle('');
      setFreeType('ders \u00e7al\u0131\u015fma');
      setFreeDuration('30');
      setFreeQuestionCount('20');
      setFreeBookTitle('');
      setFreeUnitName('');
      setFreeTopicName('');
      setFreeGoalType('ders calisma');
      startSelectedTask(created);
    } finally {
      setCreatingFreeStudy(false);
    }
  };

  if (activeTask) {
    return (
      <ActiveTaskTimer
        task={activeTask}
        tasks={tasks}
        onComplete={completeTask}
        onFinishSession={() => {
          setActiveTask(null);
          setResumedTimerState(undefined);
        }}
        onPauseForLater={handlePauseForLater}
        initialTimerState={resumedTimerState}
      />
    );
  }

  if (activeReadingTask) {
    return <ActiveReadingSession task={activeReadingTask} tasks={tasks} onComplete={completeTask} onFinishSession={() => { setActiveReadingTask(null); setResumedTimerState(undefined); }} initialTimerState={resumedTimerState} />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 lg:px-6">
      <section className="ios-card overflow-hidden rounded-[32px] px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="ios-blue mb-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-900">Cocuk paneli</div>
            <h2 className="text-[28px] font-black tracking-tight text-slate-900">Bugunku calisma alani</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Atanan gorevler, serbest calisma ve ilerleme ozetleri tek yerde. Burada once ne calisacagini net gorursun.</p>
          </div>
          <div className="ios-ink flex items-center gap-3 self-start rounded-[24px] px-4 py-3 text-white">
            <Trophy className="h-6 w-6 text-amber-300" />
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Basari Puani</div>
              <div className="text-2xl font-black text-amber-300">{successPoints} BP</div>
            </div>
          </div>
        </div>
      </section>

      {currentLiveSession && (
        <section className="ios-card ios-mint rounded-[30px] p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Canli seans
              </div>
              <h3 className="truncate text-xl font-black text-slate-900">{safeText(currentLiveSession.task.bookTitle || currentLiveSession.task.title, 'Calisma')}</h3>
              <p className="mt-1 text-sm text-slate-600">
                Calisma {formatTime(currentLiveSession.timerState.mainTime)} / Mola {formatTime(currentLiveSession.timerState.breakTime)} / Durum {currentLiveSession.timerState.status === 'break' ? 'Molada' : currentLiveSession.timerState.status === 'paused' ? 'Durakladi' : 'Akista'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => startSelectedTask(currentLiveSession.task, currentLiveSession.timerState)}
              className="ios-button-active flex shrink-0 items-center justify-center gap-2 rounded-[20px] px-5 py-3 text-sm font-black"
            >
              <Play className="h-4 w-4" />
              Devam et
            </button>
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className={`${card} ios-blue`}><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Bugun atanan</div><div className="mt-2 text-2xl font-black text-slate-900">{assignedTodayCount}</div><div className="mt-1 text-sm text-slate-500">Planlanan gorev</div></div>
        <div className={`${card} ios-mint`}><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Bugun biten</div><div className="mt-2 text-2xl font-black text-emerald-700">{completedToday.length}</div><div className="mt-1 text-sm text-slate-500">Tamamlanan oturum</div></div>
        <div className={`${card} ios-lilac`}><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Odak</div><div className="mt-2 text-2xl font-black text-slate-900">{analysis.overall.averageFocus}</div><div className="mt-1 text-sm text-slate-500">Genel ortalama</div></div>
        <div className={`${card} ios-peach`}><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hakimiyet</div><div className="mt-2 text-2xl font-black text-slate-900">{analysis.overall.averageMastery}</div><div className="mt-1 text-sm text-slate-500">Konu tabanli skor</div></div>
      </section>

      <div className="ios-panel flex flex-wrap gap-2 rounded-[26px] p-2">
        <button onClick={() => setActiveView('tasks')} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeView === 'tasks' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-600'}`}><Target className="mr-2 inline h-4 w-4" />Gorevler</button>
        <button onClick={() => setActiveView('treasures')} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeView === 'treasures' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-600'}`}><Gift className="mr-2 inline h-4 w-4" />Oduller</button>
        <button onClick={() => setActiveView('stats')} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeView === 'stats' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-600'}`}><BarChart className="mr-2 inline h-4 w-4" />Istatistik</button>
        <button onClick={() => setActiveView('assistant')} className={`rounded-full px-4 py-2 text-sm font-semibold ${activeView === 'assistant' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-600'}`}><Brain className="mr-2 inline h-4 w-4" />Koc</button>
      </div>

      {activeView === 'tasks' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className={card}>
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-2">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Gorev panosu</h3>
                    <p className="text-sm text-slate-500">Atanan gorevler once, serbest calisma ikinci adim.</p>
                  </div>
                  <ContextHelp title="Gorev sirasi" tone="mint">
                    Bugun ve takipteki atanan gorevler once gelir. Serbest calisma, plansiz calismayi kayda almak icindir.
                  </ContextHelp>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setShowFreeStudy((value) => !value)} className="ios-lilac rounded-full px-4 py-2 text-sm font-semibold text-violet-900"><PlusCircle className="mr-2 inline h-4 w-4" />Serbest calisma</button>
                  <button onClick={() => setTaskFilter('today')} className={`rounded-full px-4 py-2 text-sm font-semibold ${taskFilter === 'today' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-600'}`}>Bugun + Takipte</button>
                  <button onClick={() => setTaskFilter('upcoming')} className={`rounded-full px-4 py-2 text-sm font-semibold ${taskFilter === 'upcoming' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-600'}`}>Yaklasan</button>
                  <button onClick={() => setTaskFilter('all')} className={`rounded-full px-4 py-2 text-sm font-semibold ${taskFilter === 'all' ? 'ios-button-active text-slate-900' : 'ios-button text-slate-600'}`}>Tumu</button>
                </div>
              </div>

              {showFreeStudy && (
                <form onSubmit={handleCreateFreeStudy} className="ios-card mb-5 rounded-[28px] p-5">
                  <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-2">
                      <div>
                        <h3 className="text-lg font-black text-slate-900">Serbest calisma baslat</h3>
                        <p className="text-sm text-slate-500">Atanan gorev yoksa kendi calismani ders, unite ve konuya bagla.</p>
                      </div>
                      <ContextHelp title="Analize etkisi" tone="lilac">
                        Bu kayit planli gorev sayilmaz; ama secilen ders, unite ve konu performansina destek veri ekler.
                      </ContextHelp>
                    </div>
                    <div className="ios-lilac rounded-[18px] px-3 py-2 text-xs font-bold text-violet-900">Kaynak: Serbest calisma</div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_260px]">
                    <section className="ios-widget ios-blue rounded-[24px] p-4">
                      <div className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">1 Calisma alani</div>
                      <div className="space-y-3">
                        <input value={freeTitle} onChange={(e) => setFreeTitle(e.target.value)} placeholder="Ne calisacaksin?" className="ios-button w-full rounded-[18px] px-3 py-3 text-sm" required />
                        <select value={freeCourseId} onChange={(e) => setFreeCourseId(e.target.value)} className="ios-button w-full rounded-[18px] px-3 py-3 text-sm">
                          {courses.map((course) => <option key={course.id} value={course.id}>{safeText(course.name, course.id)}</option>)}
                        </select>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <select value={freeUnitName} onChange={(e) => setFreeUnitName(e.target.value)} className="ios-button rounded-[18px] px-3 py-3 text-sm">
                            <option value="">Unite sec</option>
                            {activeUnits.map((unit) => <option key={unit.name} value={unit.name}>{unit.name}</option>)}
                          </select>
                          <select value={freeTopicName} onChange={(e) => setFreeTopicName(e.target.value)} className="ios-button rounded-[18px] px-3 py-3 text-sm" disabled={!freeUnitName}>
                            <option value="">Konu sec</option>
                            {activeTopics.map((topic) => <option key={topic.name} value={topic.name}>{topic.name}</option>)}
                          </select>
                        </div>
                      </div>
                    </section>

                    <section className="ios-widget ios-mint rounded-[24px] p-4">
                      <div className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-400">2 Calisma turu</div>
                      <div className="space-y-3">
                        <select value={freeType} onChange={(e) => setFreeType(e.target.value as 'soru \u00e7\u00f6zme' | 'ders \u00e7al\u0131\u015fma' | 'kitap okuma')} className="ios-button w-full rounded-[18px] px-3 py-3 text-sm">
                          <option value="ders \u00e7al\u0131\u015fma">Ders calismasi</option>
                          <option value="soru \u00e7\u00f6zme">Soru cozumu</option>
                          <option value="kitap okuma">Kitap okuma</option>
                        </select>
                        <input value={freeDuration} onChange={(e) => setFreeDuration(e.target.value)} type="number" min="1" className="ios-button w-full rounded-[18px] px-3 py-3 text-sm" placeholder="Sure (dk)" required />
                        {freeType === 'soru \u00e7\u00f6zme' && <input value={freeQuestionCount} onChange={(e) => setFreeQuestionCount(e.target.value)} type="number" min="1" className="ios-button w-full rounded-[18px] px-3 py-3 text-sm" placeholder="Soru sayisi" />}
                        {freeType === 'kitap okuma' && <input value={freeBookTitle} onChange={(e) => setFreeBookTitle(e.target.value)} className="ios-button w-full rounded-[18px] px-3 py-3 text-sm" placeholder="Kitap adi" />}
                        {freeType !== 'kitap okuma' && (
                          <select value={freeGoalType} onChange={(e) => setFreeGoalType(e.target.value)} className="ios-button w-full rounded-[18px] px-3 py-3 text-sm">
                            <option value="ders calisma">Ders calismasi</option>
                            <option value="konu-tekrari">Konu tekrari</option>
                            <option value="eksik-konu-tamamlama">Eksik konu tamamlama</option>
                            <option value="test-cozme">Test cozme</option>
                          </select>
                        )}
                      </div>
                    </section>

                    <section className="ios-lilac flex flex-col justify-between rounded-[24px] p-4 text-slate-900">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">3 Baslat</div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">Bu kayit analizde planli gorevden ayri tutulur ama konu performansina destek veri olarak eklenir.</p>
                        <div className="ios-widget mt-4 rounded-[18px] px-3 py-3 text-xs leading-5 text-slate-600">
                          {selectedCourseName || 'Ders'} {freeUnitName ? `/ ${freeUnitName}` : ''} {freeTopicName ? `/ ${freeTopicName}` : ''}
                        </div>
                      </div>
                      <button type="submit" disabled={creatingFreeStudy} className={`mt-4 rounded-[18px] px-5 py-3 text-sm font-black ${creatingFreeStudy ? 'ios-button cursor-not-allowed text-slate-500 opacity-60' : 'ios-button-active text-slate-900'}`}>
                        {creatingFreeStudy ? 'Olusturuluyor...' : 'Olustur ve baslat'}
                      </button>
                    </section>
                  </div>
                </form>
              )}

              <div className="space-y-4">
                {pendingTasks.length === 0 && <div className="ios-widget rounded-[24px] p-8 text-center text-slate-500">Bu filtreye uygun bekleyen gorev yok.</div>}
                {assignedPendingTasks.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Atanan gorevler</div>
                    {assignedPendingTasks.map((task) => (
                      <TaskCard key={task.id} task={task} courseName={courseNameMap.get(task.courseId) || task.courseId} onStart={startSelectedTask} today={today} isStarting={startingTaskId === task.id} />
                    ))}
                  </div>
                )}
                {freePendingTasks.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Serbest calisma kayitlari</div>
                    {freePendingTasks.map((task) => (
                      <TaskCard key={task.id} task={task} courseName={courseNameMap.get(task.courseId) || task.courseId} onStart={startSelectedTask} today={today} isStarting={startingTaskId === task.id} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {completedToday.length > 0 && (
              <div className={card}>
                <div className="mb-4 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                  <h3 className="text-xl font-black text-slate-900">Bugun tamamlananlar</h3>
                </div>
                <div className="space-y-3">
                  {completedToday.map((task) => (
                    <TaskCard key={task.id} task={task} courseName={courseNameMap.get(task.courseId) || task.courseId} onStart={startSelectedTask} completed today={today} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className={subtleCard}>
              <h3 className="mb-3 text-base font-bold text-slate-900">Bugun ozeti</h3>
              <div className="grid gap-2 text-sm text-slate-600">
                <div className="ios-widget flex items-center justify-between rounded-[18px] px-3 py-2.5"><span>Bekleyen bugun</span><strong>{waitingTodayCount}</strong></div>
                <div className="ios-widget flex items-center justify-between rounded-[18px] px-3 py-2.5"><span>Cozulen soru</span><strong>{solvedQuestionCount}</strong></div>
                <div className="ios-widget flex items-center justify-between rounded-[18px] px-3 py-2.5"><span>Calisma suresi</span><strong>{studiedMinutes} dk</strong></div>
                <div className="ios-widget flex items-center justify-between rounded-[18px] px-3 py-2.5"><span>Okunan sayfa</span><strong>{readPages}</strong></div>
                <div className="ios-widget flex items-center justify-between rounded-[18px] px-3 py-2.5"><span>Toplam tamamlanan</span><strong>{analysis.overall.completedTasks}</strong></div>
              </div>
            </div>

            <WeeklyPointsPanel tasks={tasks} />
            <ReadingLibraryPanel tasks={tasks} />

            <div className={subtleCard}>
              <h3 className="mb-3 text-base font-bold text-slate-900">Rozetler</h3>
              <div className="space-y-3">
                {badges.length === 0 && <div className="ios-widget rounded-[20px] px-4 py-5 text-sm text-slate-500">Henuz rozet yok.</div>}
                {badges.slice(0, 4).map((badge) => (
                  <div key={badge.id} className="ios-widget flex items-start gap-3 rounded-[20px] p-3">
                    <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800">{safeBadgeName(badge.name)}</div>
                      <div className="break-words text-xs leading-5 text-slate-500">{safeBadgeDescription(badge.description)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeView === 'treasures' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className={card}>
            <div className="mb-2 flex items-center gap-2"><Gift className="h-5 w-5 text-amber-500" /><h3 className="text-xl font-black text-slate-900">Odul magazasi</h3></div>
            <p className="mb-4 text-sm text-slate-500">Talep et butonu sadece puanin odul maliyetine esit veya fazlaysa aktif olur.</p>
            <div className="space-y-3">
              {rewards.length === 0 && <div className="ios-widget rounded-[24px] p-8 text-center text-slate-500">Henuz odul eklenmemis.</div>}
              {rewards.map((reward) => {
                const canAfford = successPoints >= reward.cost;
                const missingPoints = Math.max(0, reward.cost - successPoints);
                return (
                  <div key={reward.id} className="ios-widget flex items-center justify-between rounded-[24px] p-4">
                    <div>
                      <div className="font-bold text-slate-800">{safeText(reward.name, 'Odul')}</div>
                      <div className="text-sm text-amber-600">{reward.cost} BP</div>
                      <div className={`mt-1 text-xs font-semibold ${canAfford ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {canAfford ? 'Talep etmeye uygun' : `${missingPoints} BP daha gerekli`}
                      </div>
                    </div>
                    <button
                      onClick={() => handleClaimReward(reward.id)}
                      disabled={!canAfford || claimingRewardId === reward.id}
                      title={canAfford ? 'Yeterli puanin var' : `Bu odul icin ${missingPoints} BP daha gerekiyor`}
                      className={`rounded-[18px] px-4 py-2 text-sm font-bold ${canAfford && claimingRewardId !== reward.id ? 'ios-yellow text-amber-950' : 'ios-button cursor-not-allowed text-slate-500 opacity-60'}`}
                    >
                      {claimingRewardId === reward.id ? 'Talep ediliyor...' : 'Talep et'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={card}>
            <div className="mb-4 flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-blue-600" /><h3 className="text-xl font-black text-slate-900">Basarilarim</h3></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {badges.length === 0 && <div className="ios-widget rounded-[24px] p-8 text-center text-slate-500 sm:col-span-2">Rozet olustukca burada gosterilecek.</div>}
              {badges.map((badge) => (
                <div key={badge.id} className="ios-widget rounded-[24px] p-4">
                  <div className="mb-3 inline-flex rounded-2xl bg-blue-100 p-3 text-blue-700"><BadgeCheck className="h-5 w-5" /></div>
                  <div className="font-bold text-slate-800">{safeBadgeName(badge.name)}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-500">{safeBadgeDescription(badge.description)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeView === 'stats' && <StudyStats tasks={tasks} courses={courses} />}

      {activeView === 'assistant' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className={card}>
            <div className="mb-3 flex items-center gap-2 text-slate-900"><Target className="h-5 w-5 text-blue-600" /><h3 className="text-lg font-black">Guclu alan</h3></div>
            <div className="text-sm leading-6 text-slate-600">{topTopic ? `${topTopic.courseName} / ${topTopic.unitName} / ${topTopic.topicName} alaninda hakimiyet skoru ${topTopic.masteryScore}.` : 'Henuz yeterli calisma verisi yok.'}</div>
          </div>
          <div className={card}>
            <div className="mb-3 flex items-center gap-2 text-slate-900"><Calendar className="h-5 w-5 text-amber-500" /><h3 className="text-lg font-black">Odaklanilacak konu</h3></div>
            <div className="text-sm leading-6 text-slate-600">{weakestTopic ? `${weakestTopic.courseName} / ${weakestTopic.unitName} / ${weakestTopic.topicName} daha fazla tekrar istiyor. Mevcut skor ${weakestTopic.masteryScore}.` : 'Eksik konu analizi icin daha fazla tamamlanan gorev gerekiyor.'}</div>
          </div>
          <div className={card}>
            <div className="mb-3 flex items-center gap-2 text-slate-900"><Brain className="h-5 w-5 text-violet-600" /><h3 className="text-lg font-black">Calisma kocu</h3></div>
            <div className="text-sm leading-6 text-slate-600">{ai ? 'AI baglantisi mevcut. Sonraki adimda burada konu bazli calisma onerileri ve gunluk uyari sistemi acilacak.' : 'Bu alan simdilik kural tabanli. Once planli gorevleri bitir, sonra serbest calismaya gec.'}</div>
            <div className="ios-widget mt-4 rounded-[20px] px-4 py-3 text-sm text-slate-600">Ortalama verim: <strong>{analysis.overall.averageEfficiency}</strong> / Ortalama dogruluk: <strong>{analysis.overall.averageAccuracy ?? 0}</strong></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChildDashboard;








