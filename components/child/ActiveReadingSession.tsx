import React, { useState, useEffect, useRef } from 'react';
import { Task, TaskCompletionData } from '../../types';
import { Play, Pause, Coffee, StopCircle, BookOpen, Trash2 } from '../icons';

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

interface TimerState {
    mainTime: number;
    breakTime: number;
    pauseTime: number;
    status: 'running' | 'paused' | 'break';
}

interface ActiveReadingSessionProps {
    task: Task;
    tasks: Task[]; // Full task list to check for deletions
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
    const intervalRef = useRef<NodeJS.Timeout | null>(null);


    // Effect to detect if the parent deleted the task
    useEffect(() => {
        const taskStillExists = tasks.some(t => t.id === task.id);
        if (!taskStillExists) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            localStorage.removeItem(`timerState_${task.id}`);
            setWasTaskDeleted(true);
        }
    }, [tasks, task.id]);


    useEffect(() => {
        const timerState: TimerState = { mainTime, breakTime, pauseTime, status };
        localStorage.setItem(`timerState_${task.id}`, JSON.stringify(timerState));
    }, [mainTime, breakTime, pauseTime, status, task.id]);

    useEffect(() => {
        intervalRef.current = setInterval(() => {
            if (status === 'running') {
                setMainTime(prev => prev + 1);
            } else if (status === 'break') {
                setBreakTime(prev => prev + 1);
            } else if (status === 'paused') {
                setPauseTime(prev => prev + 1);
            }
        }, 1000);
        
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [status]);

    const handleFinish = () => {
        setStatus('paused');
        setShowCompleteModal(true);
    };

    const handleConfirmCompletion = () => {
        if (pagesRead !== '' && pagesRead > 0) {
            localStorage.removeItem(`timerState_${task.id}`);
            onComplete(task.id, {
                actualDuration: mainTime,
                breakTime: breakTime,
                pauseTime: pauseTime,
                pagesRead: Number(pagesRead),
            });
            onFinishSession();
        } else {
            alert('Lütfen okuduğunuz sayfa sayısını girin.');
        }
    };

    return (
        <>
            {wasTaskDeleted && (
                <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-center">
                         <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                            <Trash2 className="h-6 w-6 text-red-600" aria-hidden="true" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Görev Silindi</h3>
                        <p className="text-slate-600 mb-6">Bu görev ebeveynin tarafından silindiği için artık devam edilemez.</p>
                        <button onClick={onFinishSession} className="w-full px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700">
                            Anladım
                        </button>
                    </div>
                </div>
            )}

            {showCompleteModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-center">
                        <h3 className="text-xl font-bold mb-2">Harika İş!</h3>
                        <p className="text-slate-600 mb-4">Bu okuma seansında kaç sayfa okudun?</p>
                        <input
                            type="number"
                            value={pagesRead}
                            onChange={(e) => setPagesRead(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="Örn: 25"
                            min="1"
                            autoFocus
                            className="w-full text-center text-2xl font-bold border-2 border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <div className="mt-6 flex space-x-2">
                             <button onClick={() => {setShowCompleteModal(false); setStatus('running');}} className="w-full px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">
                                Geri Dön
                            </button>
                            <button onClick={handleConfirmCompletion} className="w-full px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700">
                                Onayla
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="fixed inset-0 bg-slate-100 z-40 flex flex-col justify-center items-center p-8">
                <div className="w-full max-w-2xl text-center">
                    <span className="text-lg font-semibold text-teal-600">{task.bookTitle}</span>
                    <h2 className="text-4xl font-bold my-2">Kitap Okuma Zamanı</h2>
                    <p className="text-slate-600">{task.description}</p>

                    <div className="my-12 p-8 rounded-full inline-block bg-teal-100">
                        <p className="text-8xl font-bold tabular-nums text-teal-600">
                            {formatTime(mainTime)}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-12 text-lg">
                        <div className="bg-amber-100 text-amber-700 p-4 rounded-lg">
                            <p className="font-bold">Mola Süresi</p>
                            <p className="font-mono text-2xl">{formatTime(breakTime)}</p>
                        </div>
                        <div className="bg-gray-200 text-gray-700 p-4 rounded-lg">
                            <p className="font-bold">Duraklatma Süresi</p>
                            <p className="font-mono text-2xl">{formatTime(pauseTime)}</p>
                        </div>
                    </div>

                    <div className="flex justify-center items-center space-x-4">
                        {status === 'running' ? (
                            <button onClick={() => setStatus('paused')} className="flex items-center justify-center w-32 h-16 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-100"><Pause className="w-6 h-6 mr-2" /> Durdur</button>
                        ) : (
                            <button onClick={() => setStatus('running')} className="flex items-center justify-center w-32 h-16 bg-white border-2 border-primary-500 text-primary-600 font-semibold rounded-lg hover:bg-primary-50"><Play className="w-6 h-6 mr-2" /> Devam Et</button>
                        )}

                        {status !== 'break' ? (
                            <button onClick={() => setStatus('break')} className="flex items-center justify-center w-32 h-16 bg-white border-2 border-amber-400 text-amber-700 font-semibold rounded-lg hover:bg-amber-50"><Coffee className="w-6 h-6 mr-2" /> Mola Ver</button>
                        ) : (
                            <button onClick={() => setStatus('running')} className="flex items-center justify-center w-32 h-16 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600"><Coffee className="w-6 h-6 mr-2" /> Molayı Bitir</button>
                        )}

                        <button onClick={handleFinish} className="flex items-center justify-center w-32 h-16 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600"><StopCircle className="w-6 h-6 mr-2" /> Bitir</button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ActiveReadingSession;