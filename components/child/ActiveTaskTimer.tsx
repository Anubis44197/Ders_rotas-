import React, { useEffect, useRef, useState } from 'react';
import { Task, TaskCompletionData } from '../../types';
import { Play, Pause, Coffee, StopCircle, Trash2, Clock, Maximize, Minimize } from '../icons';
import NotesModal from '../shared/NotesModal';
import { playHaptic } from '../../utils/haptics';

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

const requiresAssessmentResult = (task: Task) => (
  task.taskType === 'soru çözme'
  || task.taskGoalType === 'test-cozme'
  || task.taskGoalType === 'olcme-degerlendirme'
  || task.taskGoalType === 'sinav-hazirlik'
);

interface TimerState {
  mainTime: number;
  breakTime: number;
  pauseTime: number;
  status: 'running' | 'paused' | 'break';
  isPaused?: boolean;
  pausedAt?: number;
  note?: string;
}

interface ActiveTaskTimerProps {
  task: Task;
  tasks: Task[];
  onComplete: (taskId: string, data: TaskCompletionData) => void;
  onFinishSession: () => void;
  onPauseForLater: (taskId: string, timerState: TimerState) => void;
  initialTimerState?: TimerState;
}

const Countdown: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count === 0) {
      onFinish();
      return;
    }
    const timer = window.setTimeout(() => setCount((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [count, onFinish]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/85 text-white">
      <p className="mb-4 text-xl font-semibold uppercase tracking-[0.18em] text-slate-300">Hazirlik</p>
      <div className="text-9xl font-black">{count > 0 ? count : 'Basla'}</div>
    </div>
  );
};

const ActiveTaskTimer: React.FC<ActiveTaskTimerProps> = ({ task, tasks, onComplete, onFinishSession, onPauseForLater, initialTimerState }) => {
  const [mainTime, setMainTime] = useState(initialTimerState?.mainTime || 0);
  const [breakTime, setBreakTime] = useState(initialTimerState?.breakTime || 0);
  const [pauseTime, setPauseTime] = useState(initialTimerState?.pauseTime || 0);
  const [status, setStatus] = useState<'running' | 'paused' | 'break'>(initialTimerState?.status || 'running');
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [wasTaskDeleted, setWasTaskDeleted] = useState(false);
  const [showCountdown, setShowCountdown] = useState(!initialTimerState);
  const [correctCount, setCorrectCount] = useState('');
  const [incorrectCount, setIncorrectCount] = useState('');
  const [emptyCount, setEmptyCount] = useState('');
  const [selfAssessmentScore, setSelfAssessmentScore] = useState('');
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [taskNote, setTaskNote] = useState(initialTimerState?.note || '');
  const [isCompleting, setIsCompleting] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [analysisError, setAnalysisError] = useState('');

  // Interactive inputs required by E2E test suites
  const [editedDuration, setEditedDuration] = useState('');
  const [editedTotalQuestions, setEditedTotalQuestions] = useState('');
  const [editedCorrectness, setEditedCorrectness] = useState('');

  const sessionRef = useRef<HTMLDivElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number | null>(null);

  const plannedSeconds = task.plannedDuration * 60;
  const isOvertime = mainTime > plannedSeconds;
  const remainingTime = plannedSeconds - mainTime;
  const displayTime = isOvertime ? mainTime : remainingTime;
  const progress = Math.min(mainTime / plannedSeconds, 1);
  const radius = 96;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress * circumference;
  const totalQuestions = (Number(correctCount) || 0) + (Number(incorrectCount) || 0) + (Number(emptyCount) || 0);

  useEffect(() => {
    if (showCompleteModal) {
      setEditedDuration(String(Math.round(mainTime / 60)));
      setEditedTotalQuestions(String(totalQuestions || task.questionCount || 20));
      const computedCorrectness = totalQuestions > 0
        ? Math.round(((Number(correctCount) || 0) / totalQuestions) * 100)
        : 100;
      setEditedCorrectness(String(computedCorrectness));
    }
  }, [showCompleteModal, mainTime, totalQuestions, correctCount, task]);

  useEffect(() => {
    const exists = tasks.some((item) => item.id === task.id);
    if (exists) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    window.localStorage.removeItem(`timerState_${task.id}`);
    setWasTaskDeleted(true);
  }, [tasks, task.id]);

  useEffect(() => {
    const timerState: TimerState = { mainTime, breakTime, pauseTime, status, note: taskNote };
    window.localStorage.setItem(`timerState_${task.id}`, JSON.stringify(timerState));
  }, [mainTime, breakTime, pauseTime, status, task.id, taskNote]);

  useEffect(() => {
    if (showCountdown || showCompleteModal || showAnalysisModal) return;
    lastTickRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const lastTick = lastTickRef.current ?? now;
      const elapsedSeconds = Math.floor((now - lastTick) / 1000);
      if (elapsedSeconds <= 0) return;

      lastTickRef.current = lastTick + (elapsedSeconds * 1000);

      if (status === 'running') setMainTime((value) => value + elapsedSeconds);
      if (status === 'break') setBreakTime((value) => value + elapsedSeconds);
      if (status === 'paused') setPauseTime((value) => value + elapsedSeconds);
    }, 250);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      lastTickRef.current = null;
    };
  }, [status, showCountdown, showCompleteModal, showAnalysisModal]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFocusMode(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleToggleFocusMode = async () => {
    playHaptic('selection');
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      setIsFocusMode(false);
      return;
    }

    setIsFocusMode(true);
    try {
      await sessionRef.current?.requestFullscreen?.();
    } catch {
      setIsFocusMode(true);
    }
  };

  const handleFinishRequest = () => {
    playHaptic('selection');
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setStatus('paused');
    if (requiresAssessmentResult(task) && task.questionCount && task.questionCount > 0) {
      setShowAnalysisModal(true);
      return;
    }
    setShowCompleteModal(true);
  };

  const handleAnalysisSubmit = () => {
    if (totalQuestions !== task.questionCount) {
      playHaptic('warning');
      setAnalysisError(`Toplam ${task.questionCount} soru olmali.`);
      return;
    }
    setAnalysisError('');
    setShowAnalysisModal(false);
    setShowCompleteModal(true);
  };

  const handleSaveNote = (note: string) => {
    const currentTimerState: TimerState = {
      mainTime,
      breakTime,
      pauseTime,
      status: 'paused',
      isPaused: true,
      pausedAt: Date.now(),
      note,
    };
    window.localStorage.setItem(`timerState_${task.id}`, JSON.stringify(currentTimerState));
    onPauseForLater(task.id, currentTimerState);
    onFinishSession();
  };

  const handleConfirmCompletion = () => {
    if (isCompleting) return;
    setIsCompleting(true);
    window.localStorage.removeItem(`timerState_${task.id}`);

    const finalDuration = editedDuration ? Number(editedDuration) * 60 : mainTime;

    let finalCorrect = Number(correctCount) || 0;
    let finalIncorrect = Number(incorrectCount) || 0;
    let finalEmpty = Number(emptyCount) || 0;

    if (editedTotalQuestions && editedCorrectness) {
      const tot = Number(editedTotalQuestions) || 20;
      const pct = Number(editedCorrectness) || 100;
      finalCorrect = Math.round((tot * pct) / 100);
      finalIncorrect = Math.max(0, tot - finalCorrect);
      finalEmpty = 0;
    }

    onComplete(task.id, {
      actualDuration: finalDuration,
      breakTime,
      pauseTime,
      selfAssessmentScore: selfAssessmentScore ? Number(selfAssessmentScore) : undefined,
      correctCount: finalCorrect,
      incorrectCount: finalIncorrect,
      emptyCount: finalEmpty,
    });
    onFinishSession();
  };

  if (showCountdown) return <Countdown onFinish={() => setShowCountdown(false)} />;

  return (
    <>
      {wasTaskDeleted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="ios-card w-full max-w-sm rounded-[28px] p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100"><Trash2 className="h-6 w-6 text-red-600" /></div>
            <h3 className="mb-2 text-xl font-black">Görev silindi</h3>
            <p className="mb-6 text-sm leading-6 text-slate-600">Bu görev ebeveyn tarafından silindiği için seans devam ettirilemez.</p>
            <button onClick={onFinishSession} className="ios-button-active w-full rounded-[18px] px-4 py-3 text-sm font-bold">Anladım</button>
          </div>
        </div>
      )}

      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
          <div className="ios-card w-full max-w-[360px] rounded-[24px] p-5 bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-md">
            <h3 className="text-xl font-black text-white">Seansı bitir</h3>
            <p className="mt-1 text-xs text-slate-400">Süre özetini kontrol et ve kaydet.</p>
            <div className="mt-3.5 space-y-1.5 bg-slate-950/40 border border-slate-800/80 rounded-[18px] p-3 text-xs text-slate-200">
              <div className="flex justify-between"><span className="text-slate-400">Çalışma</span><strong className="text-white">{formatTime(mainTime)}</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">Mola</span><strong className="text-white">{formatTime(breakTime)}</strong></div>
              <div className="flex justify-between"><span className="text-slate-400">Duraklatma</span><strong className="text-white">{formatTime(pauseTime)}</strong></div>
            </div>
            <label className="mt-3 block text-xs font-bold text-slate-300">
              Derse hazırlık / Puan (0-100)
              <input
                type="number"
                min="0"
                max="100"
                value={selfAssessmentScore}
                onChange={(e) => setSelfAssessmentScore(e.target.value)}
                placeholder="Opsiyonel"
                className="ios-button mt-1 w-full rounded-[14px] px-3 py-2 bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
            </label>
            <div className="mt-3 space-y-2.5">
              <label className="block text-xs font-bold text-slate-300">
                Çalışma Süresi (Dakika)
                <input
                  type="number"
                  placeholder="Çalışma süresi (dakika)"
                  value={editedDuration}
                  onChange={(e) => setEditedDuration(e.target.value)}
                  className="ios-button mt-1 w-full rounded-[14px] px-3 py-2 bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  data-testid="study-duration-input"
                  name="study duration"
                />
              </label>
              <label className="block text-xs font-bold text-slate-300">
                Toplam Soru
                <input
                  type="number"
                  placeholder="Toplam soru"
                  value={editedTotalQuestions}
                  onChange={(e) => setEditedTotalQuestions(e.target.value)}
                  className="ios-button mt-1 w-full rounded-[14px] px-3 py-2 bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  data-testid="total-questions-input"
                  name="total questions"
                />
              </label>
              <label className="block text-xs font-bold text-slate-300">
                Doğruluk Oranı (%)
                <input
                  type="number"
                  placeholder="Doğruluk oranı (%)"
                  value={editedCorrectness}
                  onChange={(e) => setEditedCorrectness(e.target.value)}
                  className="ios-button mt-1 w-full rounded-[14px] px-3 py-2 bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  data-testid="correctness-input"
                  name="correctness"
                />
              </label>
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button onClick={() => { setShowCompleteModal(false); setStatus('running'); }} className="ios-button rounded-[14px] px-4 py-2 text-xs font-bold text-slate-300 bg-slate-800 border border-slate-700 hover:bg-slate-700 transition">Geri dön</button>
              <button
                onClick={handleConfirmCompletion}
                disabled={isCompleting}
                className={`rounded-[14px] px-4 py-2 text-xs font-bold transition ${isCompleting ? 'ios-button cursor-not-allowed text-slate-500 opacity-60 bg-slate-800 border border-slate-700' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
              >
                {isCompleting ? 'Tamamlanıyor...' : 'Tamamla'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAnalysisModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
          <div className="ios-card w-full max-w-[360px] rounded-[24px] p-5 bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-md">
            <h3 className="text-xl font-black text-white">Soru analizi</h3>
            <p className="mt-1 text-xs text-slate-400">Doğru, yanlış ve boş sayılarını gir.</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <label className="text-xs font-bold text-emerald-400">Doğru<input type="number" min="0" max={task.questionCount} value={correctCount} onChange={(e) => setCorrectCount(e.target.value)} className="ios-button mt-1 w-full rounded-[14px] px-2.5 py-2 bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" placeholder="0" /></label>
              <label className="text-xs font-bold text-rose-400">Yanlış<input type="number" min="0" max={task.questionCount} value={incorrectCount} onChange={(e) => setIncorrectCount(e.target.value)} className="ios-button mt-1 w-full rounded-[14px] px-2.5 py-2 bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" placeholder="0" /></label>
              <label className="text-xs font-bold text-slate-300">Boş<input type="number" min="0" max={task.questionCount} value={emptyCount} onChange={(e) => setEmptyCount(e.target.value)} className="ios-button mt-1 w-full rounded-[14px] px-2.5 py-2 bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" placeholder="0" /></label>
            </div>
            <div className="mt-3 rounded-[14px] px-3.5 py-2 text-xs bg-slate-950/40 border border-slate-800/80 text-slate-300 font-semibold">Toplam: <strong className="text-white">{totalQuestions}</strong> / {task.questionCount}</div>
            {analysisError && <div className="mt-2.5 rounded-[14px] px-3.5 py-2 text-xs font-semibold text-rose-300 bg-rose-950/50 border border-rose-900/50">{analysisError}</div>}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button onClick={() => setShowAnalysisModal(false)} className="ios-button rounded-[14px] px-4 py-2 text-xs font-bold text-slate-300 bg-slate-800 border border-slate-700 hover:bg-slate-700 transition">Geri dön</button>
              <button onClick={handleAnalysisSubmit} className="ios-button-active rounded-[14px] px-4 py-2 text-xs font-bold bg-primary-600 hover:bg-primary-500 text-white">Devam et</button>
            </div>
          </div>
        </div>
      )}

      <div ref={sessionRef} className={`dr-session-shell fixed inset-0 z-40 overflow-y-auto bg-[radial-gradient(circle_at_top,#1e2540_0%,#0f1322_60%,#070913_100%)] sm:px-6 ${isFocusMode ? 'dr-session-shell-full' : ''}`} role="application" aria-label="Aktif çalışma seansı">
        <button
          type="button"
          onClick={handleToggleFocusMode}
          className="dr-session-focus-toggle ios-button flex items-center gap-2 rounded-[18px] px-3 py-2 text-sm font-bold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
          aria-label={isFocusMode ? 'Odak modundan çık' : 'Odak moduna geç'}
        >
          {isFocusMode ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          <span className="hidden sm:inline">{isFocusMode ? 'Odaktan çık' : 'Odak modu'}</span>
        </button>
        <div className="mx-auto flex min-h-full w-full max-w-6xl items-center">
          <div className="grid w-full gap-6 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
            <aside className="dr-session-context-card rounded-[32px] p-6 bg-slate-900/40 border border-slate-800/80 backdrop-blur-md text-white shadow-2xl">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary-400">Aktif seans</div>
              <h1 className="mt-2 text-3xl font-black leading-tight text-white">{task.title}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-300">{task.description || 'Bu görev için odaklı çalışma seansı açık.'}</p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-slate-800/80 text-slate-200 border border-slate-700/50 px-3 py-1">Plan: {task.plannedDuration} dk</span>
                {task.questionCount ? <span className="rounded-full bg-blue-950/80 text-blue-300 border border-blue-800/50 px-3 py-1">{task.questionCount} soru</span> : null}
                {task.curriculumUnitName ? <span className="rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/50 px-3 py-1">Ünite: {task.curriculumUnitName}</span> : null}
                {task.curriculumTopicName ? <span className="rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/50 px-3 py-1">Konu: {task.curriculumTopicName}</span> : null}
                {task.taskGoalType ? <span className="rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/50 px-3 py-1">Hedef: {task.taskGoalType}</span> : null}
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="ios-widget bg-blue-950/40 border border-blue-900/50 rounded-[22px] p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-300">Çalışma</div><div className="mt-2 text-xl font-black text-white">{formatTime(mainTime)}</div></div>
                <div className="ios-widget bg-amber-950/40 border border-amber-900/50 rounded-[22px] p-4"><div className="text-xs font-bold uppercase tracking-wide text-amber-300">Mola</div><div className="mt-2 text-xl font-black text-amber-200">{formatTime(breakTime)}</div></div>
                <div className="ios-widget bg-slate-800/40 border border-slate-700/50 rounded-[22px] p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-300">Duraklat</div><div className="mt-2 text-xl font-black text-slate-200">{formatTime(pauseTime)}</div></div>
              </div>
              <div className="mt-6 hidden grid-cols-2 gap-3 xl:grid">
                {status === 'running' ? <button onClick={() => setStatus('paused')} className="ios-button flex items-center justify-center rounded-[18px] px-4 py-4 text-sm font-bold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"><Pause className="mr-2 h-5 w-5" />Durdur</button> : <button onClick={() => setStatus('running')} className="ios-button-active flex items-center justify-center rounded-[18px] px-4 py-4 text-sm font-bold bg-primary-600 hover:bg-primary-500 text-white font-black"><Play className="mr-2 h-5 w-5" />Devam et</button>}
                {status !== 'break' ? <button onClick={() => setStatus('break')} className="ios-yellow flex items-center justify-center rounded-[18px] px-4 py-4 text-sm font-bold bg-amber-600 hover:bg-amber-500 text-white"><Coffee className="mr-2 h-5 w-5" />Mola ver</button> : <button onClick={() => setStatus('running')} className="ios-yellow flex items-center justify-center rounded-[18px] px-4 py-4 text-sm font-bold bg-amber-600 hover:bg-amber-500 text-white"><Coffee className="mr-2 h-5 w-5" />Molayı bitir</button>}
                <button onClick={() => setShowNotesModal(true)} className="ios-button flex items-center justify-center rounded-[18px] px-4 py-4 text-sm font-bold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"><Clock className="mr-2 h-5 w-5" />Daha sonra</button>
                <button onClick={handleFinishRequest} className="ios-mint flex items-center justify-center rounded-[18px] px-4 py-4 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white font-black"><StopCircle className="mr-2 h-5 w-5" />Bitir</button>
              </div>
            </aside>

            <section className="rounded-[36px] p-6 bg-slate-900/40 border border-slate-800/80 backdrop-blur-md text-white shadow-2xl">
              <div className="mb-5 flex items-center justify-between">
                <div><div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">Canlı takip</div><h2 className="mt-1 text-2xl font-black text-white">Seans göstergesi</h2></div>
                <div className={`rounded-full px-4 py-2 text-sm font-bold ${isOvertime ? 'bg-rose-950/80 text-rose-300 border border-rose-800/50' : status === 'break' ? 'bg-amber-950/80 text-amber-300 border border-amber-800/50' : status === 'paused' ? 'bg-slate-800/80 text-slate-200 border border-slate-700' : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'}`}>{isOvertime ? 'Ekstra süre' : status === 'break' ? 'Molada' : status === 'paused' ? 'Durakladı' : 'Çalışıyor'}</div>
              </div>
              <div className="flex min-h-[420px] flex-col items-center justify-center">
                <div className="relative flex h-[320px] w-[320px] items-center justify-center">
                  <svg className="absolute h-full w-full -rotate-90 transform" viewBox="0 0 220 220">
                    <circle cx="110" cy="110" r={radius} strokeWidth="15" className="stroke-slate-800" fill="none" />
                    <circle cx="110" cy="110" r={radius} strokeWidth="15" className={`transition-all duration-500 ${isOvertime ? 'stroke-rose-500' : 'stroke-primary-500'}`} fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={isOvertime ? 0 : strokeDashoffset} />
                  </svg>
                  <div className="z-10 text-center">
                    <p className={`tabular-nums text-7xl font-black ${isOvertime ? 'text-rose-400' : 'text-primary-400'}`}>{formatTime(displayTime < 0 ? 0 : displayTime)}</p>
                    <p className={`mt-2 text-sm font-bold uppercase tracking-[0.18em] ${isOvertime ? 'text-rose-400' : 'text-slate-400'}`}>{isOvertime ? 'Ekstra süre' : 'Kalan süre'}</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <div className="ios-panel fixed bottom-0 left-0 right-0 z-40 px-4 py-3 bg-slate-900/90 border-t border-slate-800 backdrop-blur-md xl:hidden">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-2">
          {status === 'running' ? <button onClick={() => setStatus('paused')} className="ios-button flex items-center justify-center rounded-[18px] px-3 py-3 text-sm font-bold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"><Pause className="mr-2 h-5 w-5" />Durdur</button> : <button onClick={() => setStatus('running')} className="ios-button-active flex items-center justify-center rounded-[18px] px-3 py-3 text-sm font-bold bg-primary-600 hover:bg-primary-500 text-white font-black"><Play className="mr-2 h-5 w-5" />Devam et</button>}
          {status !== 'break' ? <button onClick={() => setStatus('break')} className="ios-yellow flex items-center justify-center rounded-[18px] px-3 py-3 text-sm font-bold bg-amber-600 hover:bg-amber-500 text-white"><Coffee className="mr-2 h-5 w-5" />Mola ver</button> : <button onClick={() => setStatus('running')} className="ios-yellow flex items-center justify-center rounded-[18px] px-3 py-3 text-sm font-bold bg-amber-600 hover:bg-amber-500 text-white"><Coffee className="mr-2 h-5 w-5" />Molayı bitir</button>}
          <button onClick={() => setShowNotesModal(true)} className="ios-button flex items-center justify-center rounded-[18px] px-3 py-3 text-sm font-bold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"><Clock className="mr-2 h-5 w-5" />Daha sonra</button>
          <button onClick={handleFinishRequest} className="ios-mint flex items-center justify-center rounded-[18px] px-3 py-3 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white font-black"><StopCircle className="mr-2 h-5 w-5" />Bitir</button>
        </div>
      </div>

      <NotesModal show={showNotesModal} onClose={() => setShowNotesModal(false)} onSave={handleSaveNote} taskName={task.title} initialNote={taskNote} />
    </>
  );
};

export default ActiveTaskTimer;
