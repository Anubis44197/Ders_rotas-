import React, { useState, useEffect, useRef } from 'react';
import { Task, TaskCompletionData } from '../../types';
import { Play, Pause, Coffee, StopCircle, Trash2, Clock } from '../icons';
import NotesModal from '../shared/NotesModal';

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
    isPaused?: boolean;
    pausedAt?: number;
    note?: string;
}

interface ActiveTaskTimerProps {
    task: Task;
    tasks: Task[]; // Full task list to check for deletions
    onComplete: (taskId: string, data: TaskCompletionData) => void | (() => void);
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
        const timer = setTimeout(() => setCount(count - 1), 1000);
        return () => clearTimeout(timer);
    }, [count, onFinish]);

    return (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-80 z-50 flex flex-col justify-center items-center text-white">
            <p className="text-2xl font-semibold mb-4">Hazır mısın?</p>
            <div className="text-9xl font-bold animate-ping-pong">{count > 0 ? count : 'Başla!'}</div>
            <style>{`
                @keyframes ping-pong {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.2); opacity: 0.7; }
                }
                .animate-ping-pong {
                    animation: ping-pong 1s ease-in-out;
                }
            `}</style>
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
    const [correctCount, setCorrectCount] = useState<string>('');
    const [incorrectCount, setIncorrectCount] = useState<string>('');
    const [emptyCount, setEmptyCount] = useState<string>('');
    const [showNotesModal, setShowNotesModal] = useState(false);
    const [taskNote, setTaskNote] = useState(initialTimerState?.note || '');
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const plannedSeconds = task.plannedDuration * 60;
    const isOvertime = mainTime > plannedSeconds;

    const remainingTime = plannedSeconds - mainTime;
    const displayTime = isOvertime ? mainTime : remainingTime;
    
    const progress = Math.min(mainTime / plannedSeconds, 1);
    const radius = 100;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - progress * circumference;


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
        if (showCountdown) return;

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
    }, [status, showCountdown]);

    const handleFinishRequest = () => {
        // Timer'ı durdur
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setStatus('paused');
        if (task.taskType === 'soru çözme' && task.questionCount && task.questionCount > 0) {
            setShowAnalysisModal(true);
        } else if (task.courseId === 'deneme-sinavi') {
            // Bu bir sınav, onComplete'i argümansız çağır
            if (typeof onComplete === 'function' && onComplete.length === 0) {
                (onComplete as () => void)();
            }
        } else {
            setShowCompleteModal(true);
        }
    };

    const handleAnalysisSubmit = () => {
        const correct = Number(correctCount) || 0;
        const incorrect = Number(incorrectCount) || 0;
        const empty = Number(emptyCount) || 0;
        const totalAnswered = correct + incorrect + empty;
        if (totalAnswered === task.questionCount) {
            setShowAnalysisModal(false);
            setShowCompleteModal(true);
        } else {
            alert(`Toplam ${task.questionCount} soru var. Lütfen doğru sayıları girin.`);
        }
    };

    const handleContinueLater = () => {
        setShowNotesModal(true);
    };

    const handleSaveNote = (note: string) => {
        const currentTimerState: TimerState = {
            mainTime,
            breakTime,
            pauseTime,
            status: 'paused', // Ensure status is paused when saving for later
            isPaused: true,
            pausedAt: Date.now(),
            note
        };
        
        // Save to localStorage
        localStorage.setItem(`timerState_${task.id}`, JSON.stringify(currentTimerState));
        
        // Notify parent component
        onPauseForLater(task.id, currentTimerState);
        
        // Finish session
        onFinishSession();
    };

    const handleConfirmCompletion = () => {
        localStorage.removeItem(`timerState_${task.id}`);
        
        // Firebase için veri hazırlığı - undefined değerleri eklemiyoruz
        const completionData: any = {
            actualDuration: mainTime,
            breakTime: breakTime,
            pauseTime: pauseTime,
        };
        
        // Sadece soru çözme görevleri için sayı alanlarını ekle
        if (task.taskType === 'soru çözme') {
            completionData.correctCount = Number(correctCount) || 0;
            completionData.incorrectCount = Number(incorrectCount) || 0;
            completionData.emptyCount = Number(emptyCount) || 0;
        }
        
        if (typeof onComplete === 'function' && onComplete.length > 0) {
            (onComplete as (taskId: string, data: TaskCompletionData) => void)(task.id, completionData);
        }
        onFinishSession();
    };

    if (showCountdown) {
        return <Countdown onFinish={() => setShowCountdown(false)} />;
    }

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
                        <h3 className="text-xl font-bold mb-2">Görevi Tamamla</h3>
                        <p className="text-slate-600 mb-4">Harika bir iş çıkardın! Seansı bitirmek istediğinden emin misin?</p>
                        
                        <div className="text-left bg-slate-50 p-3 rounded-lg mb-6 space-y-1 text-sm">
                            <div className="flex justify-between"><span>Çalışma Süresi:</span><span className="font-bold">{formatTime(mainTime)}</span></div>
                            <div className="flex justify-between"><span>Mola Süresi:</span><span className="font-bold">{formatTime(breakTime)}</span></div>
                            <div className="flex justify-between"><span>Duraklatma:</span><span className="font-bold">{formatTime(pauseTime)}</span></div>
                        </div>

                        <div className="mt-6 flex space-x-2">
                             <button onClick={() => {setShowCompleteModal(false); setStatus('running');}} className="w-full px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">
                                Geri Dön
                            </button>
                            <button onClick={handleConfirmCompletion} className="w-full px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700">
                                Evet, Bitir
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showAnalysisModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md text-center">
                        <h3 className="text-xl font-bold mb-2">Soru Analizi</h3>
                        <p className="text-slate-600 mb-4">Çözdüğün soruların analizini yap</p>
                        
                        <div className="space-y-4 mb-6">
                            <div className="text-left">
                                <label className="block text-sm font-semibold text-green-700 mb-1">Doğru Sayısı</label>
                                <input 
                                    type="number" 
                                    min="0" 
                                    max={task.questionCount} 
                                    placeholder="0"
                                    value={correctCount}
                                    onChange={(e) => setCorrectCount(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                                />
                            </div>
                            <div className="text-left">
                                <label className="block text-sm font-semibold text-red-700 mb-1">Yanlış Sayısı</label>
                                <input 
                                    type="number" 
                                    min="0" 
                                    max={task.questionCount} 
                                    placeholder="0"
                                    value={incorrectCount}
                                    onChange={(e) => setIncorrectCount(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                />
                            </div>
                            <div className="text-left">
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Boş Sayısı</label>
                                <input 
                                    type="number" 
                                    min="0" 
                                    max={task.questionCount} 
                                    placeholder="0"
                                    value={emptyCount}
                                    onChange={(e) => setEmptyCount(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                                />
                            </div>
                            <div className="text-sm text-slate-500">
                                Toplam: {(Number(correctCount) || 0) + (Number(incorrectCount) || 0) + (Number(emptyCount) || 0)} / {task.questionCount}
                            </div>
                        </div>

                        <div className="flex space-x-2">
                             <button onClick={() => setShowAnalysisModal(false)} className="w-full px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">
                                Geri Dön
                            </button>
                            <button onClick={handleAnalysisSubmit} className="w-full px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                                Devam Et
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="fixed inset-0 bg-slate-100 z-40 flex flex-col justify-center items-center p-8">
                <div className="w-full max-w-2xl text-center">
                    <span className="text-lg font-semibold text-primary-600">{task.title}</span>
                    {task.taskType === 'soru çözme' && <h2 className="text-4xl font-bold my-2">{task.questionCount} Soru</h2>}
                    <p className="text-slate-600">{task.description}</p>
                    
                    <div className="my-12 w-64 h-64 mx-auto relative flex items-center justify-center">
                        <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 220 220">
                            <circle cx="110" cy="110" r={radius} strokeWidth="15" className="stroke-slate-200" fill="none" />
                            <circle
                                cx="110"
                                cy="110"
                                r={radius}
                                strokeWidth="15"
                                className={`transition-all duration-500 ${isOvertime ? 'stroke-red-500' : 'stroke-primary-500'}`}
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={isOvertime ? 0 : strokeDashoffset}
                            />
                        </svg>
                        <div className="z-10">
                            <p className={`text-6xl font-bold tabular-nums ${isOvertime ? 'text-red-600' : 'text-primary-600'}`}>
                                {formatTime(displayTime < 0 ? 0 : displayTime)}
                            </p>
                            <p className={`font-semibold mt-1 ${isOvertime ? 'text-red-500' : 'text-slate-500'}`}>
                                 {isOvertime ? 'Ekstra Süre' : 'Kalan Süre'}
                            </p>
                        </div>
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

                        <button onClick={handleContinueLater} className="flex items-center justify-center w-32 h-16 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600"><Clock className="w-6 h-6 mr-2" /> Daha Sonra</button>
                        
                        <button onClick={handleFinishRequest} className="flex items-center justify-center w-32 h-16 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600"><StopCircle className="w-6 h-6 mr-2" /> Bitir</button>
                    </div>
                </div>
            </div>
            
            <NotesModal
                show={showNotesModal}
                onClose={() => setShowNotesModal(false)}
                onSave={handleSaveNote}
                taskName={task.title}
                initialNote={taskNote}
            />
        </>
    )
};

export default ActiveTaskTimer;