import React, { useEffect, useRef, useState } from 'react';
import { Task, TaskCompletionData } from '../../types';
import { Play, Pause, Coffee, StopCircle, Trash2 } from '../icons';

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

interface TimerState {
  mainTime: number;
  breakTime: number;
  pauseTime: number;
  status: 'running' | 'paused' | 'break';
}

interface ActiveReadingSessionProps {
  task: Task;
  tasks: Task[];
  onComplete: (taskId: string, data: TaskCompletionData) => void;
  onFinishSession: () => void;
  initialTimerState?: TimerState;
}

const ActiveReadingSession: React.FC<ActiveReadingSessionProps> = ({ task, tasks, onComplete, onFinishSession, initialTimerState }) => {
  const [mainTime, setMainTime] = useState(initialTimerState?.mainTime || 0);
  const [breakTime, setBreakTime] = useState(initialTimerState?.breakTime || 0);
  const [pauseTime, setPauseTime] = useState(initialTimerState?.pauseTime || 0);
  const [status, setStatus] = useState<'running' | 'paused' | 'break'>(initialTimerState?.status || 'running');
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [pagesRead, setPagesRead] = useState<number | ''>('');
  const [wasTaskDeleted, setWasTaskDeleted] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    const taskStillExists = tasks.some((item) => item.id === task.id);
    if (taskStillExists) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    window.localStorage.removeItem(`timerState_${task.id}`);
    setWasTaskDeleted(true);
  }, [tasks, task.id]);

  useEffect(() => {
    const timerState: TimerState = { mainTime, breakTime, pauseTime, status };
    window.localStorage.setItem(`timerState_${task.id}`, JSON.stringify(timerState));
  }, [mainTime, breakTime, pauseTime, status, task.id]);

  useEffect(() => {
    if (showCompleteModal) return;
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
  }, [status, showCompleteModal]);

  const handleConfirmCompletion = () => {
    if (isCompleting) return;
    if (pagesRead === '' || pagesRead <= 0) {
      window.alert('Okudugun sayfa sayisini gir.');
      return;
    }

    setIsCompleting(true);
    window.localStorage.removeItem(`timerState_${task.id}`);
    onComplete(task.id, {
      actualDuration: mainTime,
      breakTime,
      pauseTime,
      pagesRead: Number(pagesRead),
    });
    onFinishSession();
  };

  return (
    <>
      {wasTaskDeleted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-[28px] bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100"><Trash2 className="h-6 w-6 text-red-600" /></div>
            <h3 className="mb-2 text-xl font-black">Gorev silindi</h3>
            <p className="mb-6 text-sm leading-6 text-slate-600">Bu okuma gorevi ebeveyn tarafindan silindigi icin seans devam ettirilemez.</p>
            <button onClick={onFinishSession} className="w-full rounded-2xl bg-primary-600 px-4 py-3 text-sm font-bold text-white hover:bg-primary-700">Anladim</button>
          </div>
        </div>
      )}

      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
            <h3 className="text-2xl font-black text-slate-900">Okuma seansini tamamla</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">Bu seansta kac sayfa okudugunu gir.</p>
            <input type="number" value={pagesRead} onChange={(e) => setPagesRead(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Orn: 25" min="1" autoFocus className="mt-5 w-full rounded-3xl border border-slate-300 px-4 py-4 text-center text-3xl font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500" />
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

      <div className="fixed inset-0 z-40 overflow-y-auto bg-[radial-gradient(circle_at_top,#ccfbf1_0%,#ecfeff_30%,#f8fafc_100%)] px-4 py-6 pb-28 sm:px-6">
        <div className="mx-auto flex min-h-full w-full max-w-6xl items-center">
          <div className="grid w-full gap-6 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
            <aside className="rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-xl backdrop-blur">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-teal-600">Okuma seansi</div>
              <h1 className="mt-2 text-3xl font-black leading-tight text-slate-900">{task.bookTitle || task.title}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">{task.description || 'Odakli okuma seansi aktif.'}</p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Plan: {task.plannedDuration} dk</span>
                {task.curriculumUnitName ? <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">Unite: {task.curriculumUnitName}</span> : null}
                {task.curriculumTopicName ? <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Konu: {task.curriculumTopicName}</span> : null}
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="rounded-3xl bg-slate-50 p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-400">Okuma</div><div className="mt-2 text-xl font-black text-slate-900">{formatTime(mainTime)}</div></div>
                <div className="rounded-3xl bg-amber-50 p-4"><div className="text-xs font-bold uppercase tracking-wide text-amber-500">Mola</div><div className="mt-2 text-xl font-black text-amber-700">{formatTime(breakTime)}</div></div>
                <div className="rounded-3xl bg-slate-100 p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-400">Duraklat</div><div className="mt-2 text-xl font-black text-slate-700">{formatTime(pauseTime)}</div></div>
              </div>
              <div className="mt-6 hidden grid-cols-2 gap-3 xl:grid">
                {status === 'running' ? <button onClick={() => setStatus('paused')} className="flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-4 text-sm font-bold text-slate-700 hover:bg-slate-50"><Pause className="mr-2 h-5 w-5" />Durdur</button> : <button onClick={() => setStatus('running')} className="flex items-center justify-center rounded-2xl border border-teal-200 bg-teal-50 px-4 py-4 text-sm font-bold text-teal-700 hover:bg-teal-100"><Play className="mr-2 h-5 w-5" />Devam et</button>}
                {status !== 'break' ? <button onClick={() => setStatus('break')} className="flex items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-bold text-amber-700 hover:bg-amber-100"><Coffee className="mr-2 h-5 w-5" />Mola ver</button> : <button onClick={() => setStatus('running')} className="flex items-center justify-center rounded-2xl bg-amber-500 px-4 py-4 text-sm font-bold text-white hover:bg-amber-600"><Coffee className="mr-2 h-5 w-5" />Molayi bitir</button>}
                <button onClick={() => { setStatus('paused'); setShowCompleteModal(true); }} className="col-span-2 flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-4 text-sm font-bold text-white hover:bg-emerald-700"><StopCircle className="mr-2 h-5 w-5" />Okumayi bitir</button>
              </div>
            </aside>

            <section className="rounded-[36px] border border-white/70 bg-white/90 p-6 shadow-xl backdrop-blur">
              <div className="mb-5 flex items-center justify-between">
                <div><div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Canli akis</div><h2 className="mt-1 text-2xl font-black text-slate-900">Okuma gostergesi</h2></div>
                <div className={`rounded-full px-4 py-2 text-sm font-bold ${status === 'break' ? 'bg-amber-100 text-amber-700' : status === 'paused' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-700'}`}>{status === 'break' ? 'Molada' : status === 'paused' ? 'Durakladi' : 'Okuyor'}</div>
              </div>
              <div className="flex min-h-[420px] flex-col items-center justify-center">
                <div className="rounded-full bg-teal-100 px-10 py-10 shadow-inner"><p className="tabular-nums text-8xl font-black text-teal-600">{formatTime(mainTime)}</p></div>
                <p className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Toplam okuma suresi</p>
                <div className="mt-8 grid w-full max-w-2xl gap-3 md:grid-cols-3">
                  <div className="rounded-3xl bg-slate-50 p-4 text-center"><div className="text-xs font-bold uppercase tracking-wide text-slate-400">Plan</div><div className="mt-2 text-2xl font-black text-slate-900">{task.plannedDuration} dk</div></div>
                  <div className="rounded-3xl bg-slate-50 p-4 text-center"><div className="text-xs font-bold uppercase tracking-wide text-slate-400">Mola</div><div className="mt-2 text-2xl font-black text-slate-900">{formatTime(breakTime)}</div></div>
                  <div className="rounded-3xl bg-slate-50 p-4 text-center"><div className="text-xs font-bold uppercase tracking-wide text-slate-400">Durum</div><div className="mt-2 text-2xl font-black text-slate-900">{status === 'running' ? 'Akis' : status === 'break' ? 'Mola' : 'Bekle'}</div></div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur xl:hidden">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-2">
          {status === 'running' ? <button onClick={() => setStatus('paused')} className="flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"><Pause className="mr-2 h-5 w-5" />Durdur</button> : <button onClick={() => setStatus('running')} className="flex items-center justify-center rounded-2xl border border-teal-200 bg-teal-50 px-3 py-3 text-sm font-bold text-teal-700 hover:bg-teal-100"><Play className="mr-2 h-5 w-5" />Devam et</button>}
          {status !== 'break' ? <button onClick={() => setStatus('break')} className="flex items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-bold text-amber-700 hover:bg-amber-100"><Coffee className="mr-2 h-5 w-5" />Mola ver</button> : <button onClick={() => setStatus('running')} className="flex items-center justify-center rounded-2xl bg-amber-500 px-3 py-3 text-sm font-bold text-white hover:bg-amber-600"><Coffee className="mr-2 h-5 w-5" />Molayi bitir</button>}
          <button onClick={() => { setStatus('paused'); setShowCompleteModal(true); }} className="col-span-2 flex items-center justify-center rounded-2xl bg-emerald-600 px-3 py-3 text-sm font-bold text-white hover:bg-emerald-700"><StopCircle className="mr-2 h-5 w-5" />Okumayi bitir</button>
        </div>
      </div>
    </>
  );
};

export default ActiveReadingSession;
