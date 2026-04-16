import React, { useEffect, useRef, useState } from 'react';
import { Task, TaskCompletionData } from '../../types';
import { Play, Pause, Coffee, StopCircle, Trash2, Clock } from '../icons';
import NotesModal from '../shared/NotesModal';

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

  const handleFinishRequest = () => {
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
      window.alert(`Toplam ${task.questionCount} soru olmali.`);
      return;
    }
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
    onComplete(task.id, {
      actualDuration: mainTime,
      breakTime,
      pauseTime,
      selfAssessmentScore: selfAssessmentScore ? Number(selfAssessmentScore) : undefined,
      correctCount: requiresAssessmentResult(task) ? Number(correctCount) || 0 : undefined,
      incorrectCount: requiresAssessmentResult(task) ? Number(incorrectCount) || 0 : undefined,
      emptyCount: requiresAssessmentResult(task) ? Number(emptyCount) || 0 : undefined,
    });
    onFinishSession();
  };

  if (showCountdown) return <Countdown onFinish={() => setShowCountdown(false)} />;

  return (
    <>
      {wasTaskDeleted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-[28px] bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100"><Trash2 className="h-6 w-6 text-red-600" /></div>
            <h3 className="mb-2 text-xl font-black">Gorev silindi</h3>
            <p className="mb-6 text-sm leading-6 text-slate-600">Bu gorev ebeveyn tarafindan silindigi icin seans devam ettirilemez.</p>
            <button onClick={onFinishSession} className="w-full rounded-2xl bg-primary-600 px-4 py-3 text-sm font-bold text-white hover:bg-primary-700">Anladim</button>
          </div>
        </div>
      )}

      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
            <h3 className="text-2xl font-black text-slate-900">Seansi bitir</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">Tamamlamadan once sure ozetini kontrol et.</p>
            <div className="mt-5 space-y-2 rounded-3xl bg-slate-50 p-4 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Calisma</span><strong>{formatTime(mainTime)}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Mola</span><strong>{formatTime(breakTime)}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Duraklatma</span><strong>{formatTime(pauseTime)}</strong></div>
            </div>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Baslamadan once bu konuda kendine kac puan verirdin? (0-100)
              <input
                type="number"
                min="0"
                max="100"
                value={selfAssessmentScore}
                onChange={(e) => setSelfAssessmentScore(e.target.value)}
                placeholder="Opsiyonel"
                className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-3 text-slate-800"
              />
            </label>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button onClick={() => { setShowCompleteModal(false); setStatus('running'); }} className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200">Geri don</button>
              <button
                onClick={handleConfirmCompletion}
                disabled={isCompleting}
                className={`rounded-2xl px-5 py-3 text-sm font-bold text-white ${isCompleting ? 'cursor-not-allowed bg-slate-400' : 'bg-emerald-600 hover:bg-emerald-700'}`}
              >
                {isCompleting ? 'Tamamlaniyor...' : 'Tamamla'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAnalysisModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-2xl">
            <h3 className="text-2xl font-black text-slate-900">Soru analizi</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">Dogru, yanlis ve bos sayilarini gir. Analiz ekrani bu kayittan beslenecek.</p>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-sm font-bold text-emerald-700">Dogru<input type="number" min="0" max={task.questionCount} value={correctCount} onChange={(e) => setCorrectCount(e.target.value)} className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-3 text-slate-800" placeholder="0" /></label>
              <label className="text-sm font-bold text-rose-700">Yanlis<input type="number" min="0" max={task.questionCount} value={incorrectCount} onChange={(e) => setIncorrectCount(e.target.value)} className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-3 text-slate-800" placeholder="0" /></label>
              <label className="text-sm font-bold text-slate-700">Bos<input type="number" min="0" max={task.questionCount} value={emptyCount} onChange={(e) => setEmptyCount(e.target.value)} className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-3 text-slate-800" placeholder="0" /></label>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Toplam: <strong>{totalQuestions}</strong> / {task.questionCount}</div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button onClick={() => setShowAnalysisModal(false)} className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200">Geri don</button>
              <button onClick={handleAnalysisSubmit} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700">Devam et</button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-0 z-40 overflow-y-auto bg-[radial-gradient(circle_at_top,#dbeafe_0%,#eff6ff_30%,#f8fafc_100%)] px-4 py-6 pb-28 sm:px-6">
        <div className="mx-auto flex min-h-full w-full max-w-6xl items-center">
          <div className="grid w-full gap-6 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
            <aside className="rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-xl backdrop-blur">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">Aktif seans</div>
              <h1 className="mt-2 text-3xl font-black leading-tight text-slate-900">{task.title}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">{task.description || 'Bu gorev icin odakli calisma seansi acik.'}</p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Plan: {task.plannedDuration} dk</span>
                {task.questionCount ? <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">{task.questionCount} soru</span> : null}
                {task.curriculumUnitName ? <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">Unite: {task.curriculumUnitName}</span> : null}
                {task.curriculumTopicName ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Konu: {task.curriculumTopicName}</span> : null}
                {task.taskGoalType ? <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-700">Hedef: {task.taskGoalType}</span> : null}
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="rounded-3xl bg-slate-50 p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-400">Calisma</div><div className="mt-2 text-xl font-black text-slate-900">{formatTime(mainTime)}</div></div>
                <div className="rounded-3xl bg-amber-50 p-4"><div className="text-xs font-bold uppercase tracking-wide text-amber-500">Mola</div><div className="mt-2 text-xl font-black text-amber-700">{formatTime(breakTime)}</div></div>
                <div className="rounded-3xl bg-slate-100 p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-400">Duraklat</div><div className="mt-2 text-xl font-black text-slate-700">{formatTime(pauseTime)}</div></div>
              </div>
              <div className="mt-6 hidden grid-cols-2 gap-3 xl:grid">
                {status === 'running' ? <button onClick={() => setStatus('paused')} className="flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-4 text-sm font-bold text-slate-700 hover:bg-slate-50"><Pause className="mr-2 h-5 w-5" />Durdur</button> : <button onClick={() => setStatus('running')} className="flex items-center justify-center rounded-2xl border border-primary-200 bg-primary-50 px-4 py-4 text-sm font-bold text-primary-700 hover:bg-primary-100"><Play className="mr-2 h-5 w-5" />Devam et</button>}
                {status !== 'break' ? <button onClick={() => setStatus('break')} className="flex items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-bold text-amber-700 hover:bg-amber-100"><Coffee className="mr-2 h-5 w-5" />Mola ver</button> : <button onClick={() => setStatus('running')} className="flex items-center justify-center rounded-2xl bg-amber-500 px-4 py-4 text-sm font-bold text-white hover:bg-amber-600"><Coffee className="mr-2 h-5 w-5" />Molayi bitir</button>}
                <button onClick={() => setShowNotesModal(true)} className="flex items-center justify-center rounded-2xl bg-slate-700 px-4 py-4 text-sm font-bold text-white hover:bg-slate-800"><Clock className="mr-2 h-5 w-5" />Daha sonra</button>
                <button onClick={handleFinishRequest} className="flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-4 text-sm font-bold text-white hover:bg-emerald-700"><StopCircle className="mr-2 h-5 w-5" />Bitir</button>
              </div>
            </aside>

            <section className="rounded-[36px] border border-white/70 bg-white/90 p-6 shadow-xl backdrop-blur">
              <div className="mb-5 flex items-center justify-between">
                <div><div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Canli takip</div><h2 className="mt-1 text-2xl font-black text-slate-900">Seans gostergesi</h2></div>
                <div className={`rounded-full px-4 py-2 text-sm font-bold ${isOvertime ? 'bg-rose-100 text-rose-700' : status === 'break' ? 'bg-amber-100 text-amber-700' : status === 'paused' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-700'}`}>{isOvertime ? 'Ekstra sure' : status === 'break' ? 'Molada' : status === 'paused' ? 'Durakladi' : 'Calisiyor'}</div>
              </div>
              <div className="flex min-h-[420px] flex-col items-center justify-center">
                <div className="relative flex h-[320px] w-[320px] items-center justify-center">
                  <svg className="absolute h-full w-full -rotate-90 transform" viewBox="0 0 220 220">
                    <circle cx="110" cy="110" r={radius} strokeWidth="15" className="stroke-slate-200" fill="none" />
                    <circle cx="110" cy="110" r={radius} strokeWidth="15" className={`transition-all duration-500 ${isOvertime ? 'stroke-rose-500' : 'stroke-primary-500'}`} fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={isOvertime ? 0 : strokeDashoffset} />
                  </svg>
                  <div className="z-10 text-center">
                    <p className={`tabular-nums text-7xl font-black ${isOvertime ? 'text-rose-600' : 'text-primary-600'}`}>{formatTime(displayTime < 0 ? 0 : displayTime)}</p>
                    <p className={`mt-2 text-sm font-bold uppercase tracking-[0.18em] ${isOvertime ? 'text-rose-500' : 'text-slate-400'}`}>{isOvertime ? 'Ekstra sure' : 'Kalan sure'}</p>
                  </div>
                </div>
                <div className="mt-4 grid w-full max-w-2xl gap-3 md:grid-cols-3">
                  <div className="rounded-3xl bg-slate-50 p-4 text-center"><div className="text-xs font-bold uppercase tracking-wide text-slate-400">Plan doluluk</div><div className="mt-2 text-2xl font-black text-slate-900">{Math.round(progress * 100)}%</div></div>
                  <div className="rounded-3xl bg-slate-50 p-4 text-center"><div className="text-xs font-bold uppercase tracking-wide text-slate-400">Durum</div><div className="mt-2 text-2xl font-black text-slate-900">{status === 'running' ? 'Akis' : status === 'break' ? 'Mola' : 'Bekle'}</div></div>
                  <div className="rounded-3xl bg-slate-50 p-4 text-center"><div className="text-xs font-bold uppercase tracking-wide text-slate-400">Not</div><div className="mt-2 truncate text-sm font-bold text-slate-900">{taskNote || 'Yok'}</div></div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur xl:hidden">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-2">
          {status === 'running' ? <button onClick={() => setStatus('paused')} className="flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"><Pause className="mr-2 h-5 w-5" />Durdur</button> : <button onClick={() => setStatus('running')} className="flex items-center justify-center rounded-2xl border border-primary-200 bg-primary-50 px-3 py-3 text-sm font-bold text-primary-700 hover:bg-primary-100"><Play className="mr-2 h-5 w-5" />Devam et</button>}
          {status !== 'break' ? <button onClick={() => setStatus('break')} className="flex items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-bold text-amber-700 hover:bg-amber-100"><Coffee className="mr-2 h-5 w-5" />Mola ver</button> : <button onClick={() => setStatus('running')} className="flex items-center justify-center rounded-2xl bg-amber-500 px-3 py-3 text-sm font-bold text-white hover:bg-amber-600"><Coffee className="mr-2 h-5 w-5" />Molayi bitir</button>}
          <button onClick={() => setShowNotesModal(true)} className="flex items-center justify-center rounded-2xl bg-slate-700 px-3 py-3 text-sm font-bold text-white hover:bg-slate-800"><Clock className="mr-2 h-5 w-5" />Daha sonra</button>
          <button onClick={handleFinishRequest} className="flex items-center justify-center rounded-2xl bg-emerald-600 px-3 py-3 text-sm font-bold text-white hover:bg-emerald-700"><StopCircle className="mr-2 h-5 w-5" />Bitir</button>
        </div>
      </div>

      <NotesModal show={showNotesModal} onClose={() => setShowNotesModal(false)} onSave={handleSaveNote} taskName={task.title} initialNote={taskNote} />
    </>
  );
};

export default ActiveTaskTimer;
