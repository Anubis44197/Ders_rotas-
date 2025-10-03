import React, { useState, useEffect, useMemo } from 'react';
// Yüzdeye göre genişlik class'ı döndür
function getProgressWidthClass(percent: number | null | undefined) {
    if (!percent || percent <= 0) return 'w-0';
    if (percent >= 100) return 'w-full';
    if (percent >= 90) return 'w-[90%]';
    if (percent >= 80) return 'w-[80%]';
    if (percent >= 70) return 'w-[70%]';
    if (percent >= 60) return 'w-[60%]';
    if (percent >= 50) return 'w-[50%]';
    if (percent >= 40) return 'w-[40%]';
    if (percent >= 30) return 'w-[30%]';
    if (percent >= 20) return 'w-[20%]';
    if (percent >= 10) return 'w-[10%]';
    return 'w-0';
}
import { ChildDashboardProps, Task, Reward, Badge, ChildView, TaskFilter } from '../../types';
import { BarChart as RechartsBarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { CheckCircle, Clock, PlusCircle, Target, Play, Pause, Coffee, StopCircle, Trophy, Gift, BadgeCheck, BarChart, Calendar, BookOpen, BookMarked, Zap, Trash2, Bell, Brain, Info, Settings, Home } from '../icons';
import { getIconComponent } from '../../constants';
import ActiveReadingSession from './ActiveReadingSession';
import ActiveTaskTimer from './ActiveTaskTimer';
import ManualTaskCompletionModal from './ManualTaskCompletionModal';
import FloatingNotification from '../shared/FloatingNotification';

import PersonalizedLearningAssistant from '../shared/PersonalizedLearningAssistant';
import StudyStats from '../shared/StudyStats';
import ErrorBoundary from '../shared/ErrorBoundary';
import RemoteNotificationCenter from '../shared/RemoteNotificationCenter';
import { useRemoteTaskManagement } from '../../src/hooks/useRemoteTaskManagement';
import { getLocalDateString, getTodayString, parseDate } from '../../utils/dateUtils';
import './progress-bar.css';

const Modal: React.FC<{ show: boolean, onClose: () => void, title: string, children: React.ReactNode }> = ({ show, onClose, title, children }) => {
    if (!show) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">{title}</h3>
                    <button onClick={onClose} aria-label="Kapat" title="Kapat" className="text-slate-500 hover:text-slate-800 text-3xl font-light">&times;</button>
                </div>
                {children}
            </div>
        </div>
    );
};

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

const TaskCard: React.FC<{ task: Task, courses: ChildDashboardProps['courses'], onStart: (task: Task) => void }> = ({ task, courses, onStart }) => {
    // Check if task has saved timer state
    const savedState = localStorage.getItem(`timerState_${task.id}`);
    let isPaused = false;
    let pausedNote = '';
    
    if (savedState) {
        try {
            const parsedState = JSON.parse(savedState);
            isPaused = parsedState.isPaused || false;
            pausedNote = parsedState.note || '';
        } catch (e) {
            // Ignore parsing errors
        }
    }
    const course = courses.find(c => c.id === task.courseId);
    const isReadingTask = task.taskType === 'kitap okuma';
    const isSelfAssigned = task.isSelfAssigned;
    const borderColor = isSelfAssigned ? 'border-indigo-500' : isReadingTask ? 'border-teal-500' : 'border-primary-500';
    const iconColor = isSelfAssigned ? 'text-indigo-600' : isReadingTask ? 'text-teal-600' : 'text-primary-600';
    const textColor = isSelfAssigned ? 'text-indigo-700' : isReadingTask ? 'text-teal-700' : 'text-primary-700';
    const Icon = isSelfAssigned ? Zap : isReadingTask ? BookMarked : (course?.icon ? (typeof course.icon === 'string' ? getIconComponent(course.icon) : course.icon) : BookOpen);

    return (
        <div className={`bg-white p-5 rounded-xl shadow-md border-l-4 ${borderColor} ${task.status === 'tamamlandı' ? 'bg-slate-50' : 'hover:shadow-lg transition-shadow'} max-w-md w-full mx-auto`}>
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center space-x-2 mb-1">
                        <Icon className={`w-5 h-5 ${iconColor}`} />
                        <span className={`text-sm font-semibold ${textColor}`}>{isSelfAssigned ? 'Serbest Çalışma' : isReadingTask ? 'Kitap Okuma' : course?.name}</span>
                    </div>
                    <h4 className="text-lg font-bold text-slate-800">{isReadingTask ? task.bookTitle : task.title}</h4>
                    {/* Açıklama satırı kaldırıldı */}
                    {isPaused && pausedNote && (
                        <div className="mt-2 p-2 bg-orange-50 border-l-2 border-orange-300 rounded">
                            <div className="flex items-start space-x-2">
                                <Bell className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-xs font-semibold text-orange-700">Yarım Kalmış - Notun:</p>
                                    <p className="text-xs text-orange-600 mt-1">{pausedNote}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {task.status === 'tamamlandı' ? 
                    <div className="flex-shrink-0 ml-4">
                        <CheckCircle className="w-10 h-10 text-green-500" />
                    </div>
                    : null
                }
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200">
                 {task.status === 'tamamlandı' ? (
                    <div className="space-y-3">
                        <div>
                            <div className="flex items-center justify-between text-sm mb-1">
                                <span className="font-bold text-blue-700">{task.successScore ?? 0}%</span>
                            </div>
                            <div className="progress-bar" aria-label="Başarı yüzdesi">
                                <div className={`progress-bar-inner progress-bar-blue ${getProgressWidthClass(task.successScore ?? 0)}`} aria-hidden="true"></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between text-sm mb-1">
                                <span className="font-bold text-purple-700">{task.focusScore ?? 0}%</span>
                            </div>
                            <div className="progress-bar" aria-label="Odak yüzdesi">
                                <div className={`progress-bar-inner progress-bar-purple ${getProgressWidthClass(task.focusScore ?? 0)}`} aria-hidden="true"></div>
                            </div>
                        </div>
                        {task.startTimestamp && task.completionTimestamp && (
                            <div className="flex justify-between text-xs text-slate-500 mb-2">
                                <span>Başlangıç: {new Date(task.startTimestamp).toLocaleTimeString()}</span>
                                <span>Bitiş: {new Date(task.completionTimestamp).toLocaleTimeString()}</span>
                            </div>
                        )}
                         <div className="text-right pt-2">
                            <span className="text-lg font-bold text-amber-600">+{task.pointsAwarded || 0} BP</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-between items-center">
                        <div className="text-xs text-slate-500 font-medium flex space-x-4">
                            <span>{task.dueDate}</span>
                            <span>{task.plannedDuration} dk</span>
                            {task.taskType === 'soru çözme' && <span>{task.questionCount}</span>}
                        </div>
                        <button onClick={() => onStart(task)} className={`${isPaused ? 'bg-orange-600 hover:bg-orange-700' : 'bg-primary-600 hover:bg-primary-700'} text-white px-4 py-2 text-sm rounded-lg transition font-semibold flex items-center`}>
                            {isPaused ? (
                                <>
                                    <Clock className="w-4 h-4 mr-2"/> Devam Et
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4 mr-2"/> Görevi Başlat
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}



const RewardStore: React.FC<{rewards: Reward[], successPoints: number, claimReward: (id: string) => void}> = ({ rewards, successPoints, claimReward }) => {
    return (
        <div className="bg-white p-6 rounded-xl shadow-md">
            <h3 className="text-xl font-bold mb-4 flex items-center"><Gift className="w-6 h-6 mr-2 text-amber-500"/> Ödül Mağazası</h3>
            {rewards.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                    <Gift className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Henüz ödül eklenmemiş</p>
                    <p className="text-sm">Ebeveyn panelinden ödül ekleyebilirsiniz</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {rewards.map(reward => {
                const canAfford = successPoints >= reward.cost;
                
                // Savunmacı icon render mantığı
                let IconComponent;
                try {
                    if (!reward.icon) {
                        IconComponent = Gift; // Varsayılan icon
                    } else if (typeof reward.icon === 'string') {
                        IconComponent = getIconComponent(reward.icon);
                    } else {
                        IconComponent = reward.icon;
                    }
                } catch (error) {
                    console.warn('Reward icon render hatası:', error, reward);
                    IconComponent = Gift; // Fallback icon
                }
                
                return (
                    <div key={reward.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                            <IconComponent className="w-6 h-6 text-amber-500"/>
                            <div>
                                <p className="font-semibold">{reward.name}</p>
                                <p className="text-sm font-bold text-amber-600">{reward.cost} BP</p>
                            </div>
                        </div>
                        <button
                            onClick={() => claimReward(reward.id)}
                            disabled={!canAfford}
                            className={`px-3 py-1 text-sm font-semibold rounded-lg transition ${
                                canAfford 
                                ? 'bg-green-500 text-white hover:bg-green-600' 
                                : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            }`}
                        >
                            Talep Et
                        </button>
                    </div>
                );
            })}
                </div>
            )}
        </div>
    );
};

const MyAchievements: React.FC<{badges: Badge[]}> = ({ badges }) => (
     <div className="bg-white p-6 rounded-xl shadow-md">
        <h3 className="text-xl font-bold mb-4 flex items-center"><BadgeCheck className="w-6 h-6 mr-2 text-blue-500"/> Başarılarım</h3>
        <div className="flex flex-wrap gap-4">
            {badges.map(badge => {
                // Savunmacı icon render mantığı
                let IconComponent;
                try {
                    if (!badge.icon) {
                        IconComponent = BadgeCheck; // Varsayılan badge icon
                    } else if (typeof badge.icon === 'string') {
                        IconComponent = getIconComponent(badge.icon);
                    } else {
                        IconComponent = badge.icon;
                    }
                } catch (error) {
                    console.warn('Badge icon render hatası:', error, badge);
                    IconComponent = BadgeCheck; // Fallback icon
                }
                
                return (
                    <div key={badge.id} className="flex flex-col items-center text-center p-2" title={badge.description}>
                        <IconComponent className="w-12 h-12 text-blue-500" />
                        <p className="text-xs font-semibold mt-1">{badge.name}</p>
                    </div>
                );
            })}
        </div>
    </div>
)

const ReadingLog: React.FC<{ tasks: Task[], onClose: () => void }> = ({ tasks, onClose }) => {
    const readingTasks = useMemo(() => 
        tasks.filter(t => t.taskType === 'kitap okuma' && t.status === 'tamamlandı')
             .sort((a,b) => (b.completionTimestamp || 0) - (a.completionTimestamp || 0)),
        [tasks]
    );

    const dersReadingTasks = useMemo(() => 
        readingTasks.filter(t => t.readingType === 'ders' || !t.readingType), // Default to ders for existing tasks
        [readingTasks]
    );

    const serbestReadingTasks = useMemo(() => 
        readingTasks.filter(t => t.readingType === 'serbest'),
        [readingTasks]
    );

    const weeklyChartData = useMemo(() => {
        const data: { name: string, pages: number }[] = [];
        const today = new Date();
        const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']; // 0=Pazar, 1=Pazartesi, ..., 6=Cumartesi

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateString = date.toISOString().split('T')[0];
            const dayName = dayNames[date.getDay()]; // getDay() returns 0-6, matches our array

            const pagesForDay = readingTasks
                .filter(task => task.completionDate === dateString)
                .reduce((total, task) => total + (task.pagesRead || 0), 0);
            
            data.push({ name: dayName, pages: pagesForDay });
        }
        return data;
    }, [readingTasks]);

    const [selectedTab, setSelectedTab] = useState<'ders' | 'serbest'>('ders');

    return (
        <div className="space-y-6">
            <div>
                <h4 className="font-bold mb-2 flex items-center">Haftalık Okuma Aktivitesi (Sayfa Sayısı) <div className="ml-2" title="Son 7 günde okuduğunuz toplam sayfa sayısı"><Info className="w-4 h-4 text-slate-400 cursor-help" /></div></h4>
                 <ResponsiveContainer width="100%" height={200}>
                    <RechartsBarChart data={weeklyChartData}>
                        <XAxis dataKey="name" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Bar dataKey="pages" name="Okunan Sayfa" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                    </RechartsBarChart>
                </ResponsiveContainer>
            </div>
            
            {/* Reading Type Tabs */}
            <div className="border-b border-slate-200">
                <div className="flex space-x-4">
                    <button
                        onClick={() => setSelectedTab('ders')}
                        className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${
                            selectedTab === 'ders' 
                                ? 'border-teal-500 text-teal-600' 
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Ders Okuması ({dersReadingTasks.length})
                    </button>
                    <button
                        onClick={() => setSelectedTab('serbest')}
                        className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${
                            selectedTab === 'serbest' 
                                ? 'border-teal-500 text-teal-600' 
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Serbest Okuma ({serbestReadingTasks.length})
                    </button>
                </div>
            </div>
            
            <div>
                 <h4 className="font-bold mb-2">
                    {selectedTab === 'ders' ? 'Ders Okuma Seansları' : 'Serbest Okuma Seansları'}
                 </h4>
                 <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                    {(selectedTab === 'ders' ? dersReadingTasks : serbestReadingTasks).length > 0 ? 
                        (selectedTab === 'ders' ? dersReadingTasks : serbestReadingTasks).map(task => (
                        <div key={task.id} className="p-3 bg-slate-100 rounded-lg text-sm">
                            <div className="flex justify-between items-center">
                                <div>
                                    <span className="font-semibold">{task.bookTitle}</span>
                                    <span className="text-slate-500 ml-2">
                                        ({task.completionDate ? new Date(task.completionDate).toLocaleDateString('tr-TR', { 
                                            day: '2-digit', 
                                            month: '2-digit', 
                                            year: 'numeric' 
                                        }) : 'Tarih yok'})
                                    </span>
                                </div>
                                <div className="font-bold text-teal-600">
                                    {task.pagesRead} Sayfa
                                </div>
                            </div>
                        </div>
                    )) : <p className="text-slate-500">Okuma seansı bulunamadı.</p>}
                 </div>
            </div>
        </div>
    );
};

const MyLibrary: React.FC<{tasks: Task[]}> = ({ tasks }) => {
    const [isLogVisible, setLogVisible] = useState(false);
    const library = useMemo(() => {
        const books: { [key: string]: { totalPages: number, title: string } } = {};
        const readingTasks = tasks.filter(t => t.taskType === 'kitap okuma' && t.status === 'tamamlandı' && t.bookTitle);
        
        readingTasks.forEach(task => {
            if (!books[task.bookTitle!]) {
                books[task.bookTitle!] = { totalPages: 0, title: task.bookTitle! };
            }
            books[task.bookTitle!].totalPages += task.pagesRead || 0;
        });

        return Object.values(books).sort((a,b) => b.totalPages - a.totalPages);
    }, [tasks]);

    return (
        <>
            <Modal show={isLogVisible} onClose={() => setLogVisible(false)} title="Okuma Günlüğüm">
                <ReadingLog tasks={tasks} onClose={() => setLogVisible(false)} />
            </Modal>
            <div className="bg-white p-6 rounded-xl shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold flex items-center"><BookMarked className="w-6 h-6 mr-2 text-teal-500"/> Kütüphanem</h3>
                    <button onClick={() => setLogVisible(true)} className="text-sm font-semibold text-primary-600 hover:text-primary-800">Detayları Gör</button>
                </div>
                <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                    {library.length > 0 ? library.map(book => (
                        <div key={book.title} className="p-3 bg-slate-50 rounded-lg">
                            <p className="font-bold text-slate-800">{book.title}</p>
                            <div className="flex items-center mt-1">
                                <div className="progress-bar mr-2">
                                    <div className="progress-bar-inner progress-bar-teal w-full" aria-hidden="true"></div>
                                </div>
                                <span className="text-sm font-semibold text-teal-600">{book.totalPages} sayfa</span>
                            </div>
                        </div>
                    )) : (
                        <p className="text-sm text-slate-500 text-center py-4">Henüz hiç kitap okuma görevi tamamlamadın.</p>
                    )}
                </div>
            </div>
        </>
    );
}


const WeeklyPointsChart: React.FC<{tasks: Task[]}> = ({ tasks }) => {
    const weeklyData = useMemo(() => {
        const data: { name: string, points: number }[] = [];
        const today = new Date();
        const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']; // 0=Pazar, 1=Pazartesi, ..., 6=Cumartesi

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateString = date.toISOString().split('T')[0];
            const dayName = dayNames[date.getDay()]; // getDay() returns 0-6, matches our array

            const pointsForDay = tasks
                .filter(task => task.completionDate === dateString)
                .reduce((total, task) => total + (task.pointsAwarded || 0), 0);
            
            data.push({ name: dayName, points: pointsForDay });
        }
        return data;
    }, [tasks]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-md">
            <h3 className="text-xl font-bold mb-4 flex items-center"><BarChart className="w-6 h-6 mr-2 text-green-500"/> Haftalık Puanlarım <div className="ml-2" title="Son 7 günde tamamladığınız görevlerden kazandığınız puanlar"><Info className="w-4 h-4 text-slate-400 cursor-help" /></div></h3>
            <ResponsiveContainer width="100%" height={200}>
                <RechartsBarChart data={weeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                        cursor={{fill: 'rgba(59, 130, 246, 0.1)'}}
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white p-2 border rounded-lg shadow-sm">
                                <p className="text-sm font-bold">{`${label}: ${payload[0].value} BP`}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                    />
                    <Bar dataKey="points" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </RechartsBarChart>
            </ResponsiveContainer>
        </div>
    );
}

// Types moved to types.ts

const ChildDashboard: React.FC<ChildDashboardProps> = (props) => {
    const { tasks, courses, rewards, badges, successPoints, startTask, completeTask, claimReward, addTask, ai } = props;
    // Sadece tek çocuk için atanmış sınavları göster

    // Remote task management for child users
    const { 
        assignedTasks, 
        todaysAssignedTasks,
        notifications, 
        updateTaskStatus, 
        isChild 
    } = useRemoteTaskManagement();

    const [activeTask, setActiveTask] = useState<Task | null>(null);
    const [activeReadingTask, setActiveReadingTask] = useState<Task | null>(null);
    const [persistedTimerState, setPersistedTimerState] = useState<TimerState | undefined>(undefined);
    // Geçmiş görev için manuel modal state
    const [manualTaskModal, setManualTaskModal] = useState<{ show: boolean, task: Task | null }>({ show: false, task: null });

    const [taskFilter, setTaskFilter] = useState<TaskFilter>('today');
    const [isFreeStudyModalOpen, setIsFreeStudyModalOpen] = useState(false);
    const [activeView, setActiveView] = useState<ChildView>('tasks');
    
    // State for handling unfinished sessions
    const [unfinishedSessionTask, setUnfinishedSessionTask] = useState<Task | null>(null);
    const [showUnfinishedSessionModal, setShowUnfinishedSessionModal] = useState(false);

    // Yeni bileşenler için state'ler
    const [showLearningAssistant, setShowLearningAssistant] = useState(false);
    const [showAdvancedStats, setShowAdvancedStats] = useState(false);


    // Free Study Modal State
    const [freeStudyTitle, setFreeStudyTitle] = useState('');
    const [freeStudyCourseId, setFreeStudyCourseId] = useState(courses[0]?.id || '');
    const [freeStudyDueDate, setFreeStudyDueDate] = useState(() => {
        return getTodayString();
    });
    const [freeStudyDueTime, setFreeStudyDueTime] = useState(() => {
        // Otomatik olarak şu anki saati ayarla
        const now = new Date();
        return now.toTimeString().slice(0, 5); // HH:MM formatı
    });
    const [freeStudyDuration, setFreeStudyDuration] = useState('');
    const [freeStudyTaskType, setFreeStudyTaskType] = useState<'soru çözme' | 'ders çalışma' | 'kitap okuma'>('ders çalışma');
    const [freeStudyQuestionCount, setFreeStudyQuestionCount] = useState('');
    const [freeStudyBookTitle, setFreeStudyBookTitle] = useState('');
    const [freeStudyBookGenre, setFreeStudyBookGenre] = useState<'Hikaye' | 'Bilim' | 'Tarih' | 'Macera' | 'Şiir' | 'Diğer'>('Hikaye');

    const [selectedTab, setSelectedTab] = useState<'ders' | 'serbest'>('ders');
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Update freeStudyCourseId when courses prop changes
    useEffect(() => {
        if (courses.length > 0 && !freeStudyCourseId) {
            setFreeStudyCourseId(courses[0].id);
        }
    }, [courses, freeStudyCourseId]);

    const handleStartTask = (task: Task) => {
        // Check for saved timer state first
        const savedState = localStorage.getItem(`timerState_${task.id}`);
        let resumeState: TimerState | undefined;
        
        if (savedState) {
            try {
                const parsedState = JSON.parse(savedState);
                if (parsedState.isPaused) {
                    resumeState = parsedState;
                }
            } catch (e) {
                console.error("Failed to parse saved timer state", e);
                localStorage.removeItem(`timerState_${task.id}`);
            }
        }
        
        // Geçmiş tarihli görev mi?
        const todayStr = getTodayString();
        if (task.dueDate < todayStr && !resumeState) {
            // Zamanlayıcı başlatma, manuel modal aç (sadece resume state yoksa)
            setManualTaskModal({ show: true, task });
        } else {
            startTask(task.id);
            setPersistedTimerState(resumeState);
            
            // If this is a remote task, update its status
            if (task.id.startsWith('remote_')) {
                updateTaskStatus(task.id, { status: 'bekliyor' }); // Keep as pending while working
            }
            
            if (task.taskType === 'kitap okuma') {
                setActiveReadingTask(task);
            } else {
                setActiveTask(task);
            }
        }
    };



    const handleStartFreeStudy = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation for task type specific fields
        const isValid = courses.length > 0 && freeStudyTitle.trim() && freeStudyCourseId && freeStudyDueDate &&
            freeStudyDueTime.trim() && freeStudyDuration.trim() && Number(freeStudyDuration) > 0 &&
            (freeStudyTaskType !== 'soru çözme' || (freeStudyQuestionCount.trim() && Number(freeStudyQuestionCount) > 0)) &&
            (freeStudyTaskType !== 'kitap okuma' || freeStudyBookTitle.trim());
            
        if (isValid) {
            // Tarih ve saati birleştirerek doğru ISO string oluştur
            const dueDateTimeString = `${freeStudyDueDate}T${freeStudyDueTime}:00`;
            
            const newTask = addTask({
                title: freeStudyTitle,
                courseId: freeStudyCourseId,
                dueDate: dueDateTimeString,
                taskType: freeStudyTaskType,
                plannedDuration: Number(freeStudyDuration),
                isSelfAssigned: true,
                ...(freeStudyTaskType === 'soru çözme' && { questionCount: Number(freeStudyQuestionCount) }),
                ...(freeStudyTaskType === 'kitap okuma' && { bookTitle: freeStudyBookTitle, readingType: 'serbest', bookGenre: freeStudyBookGenre })
            });
            // UX Improvement: Immediately start the created task
            const taskResult = await newTask;
            handleStartTask(taskResult);
            setIsFreeStudyModalOpen(false);
            setFreeStudyTitle('');
            setFreeStudyDueDate(getTodayString());
            setFreeStudyDueTime(new Date().toTimeString().slice(0, 5));
            setFreeStudyDuration('');
            setFreeStudyCourseId(courses[0]?.id || '');
            setFreeStudyTaskType('ders çalışma');
            setFreeStudyQuestionCount('');
            setFreeStudyBookTitle('');
            setFreeStudyBookGenre('Hikaye');
        }
    };

    // Check for unfinished sessions on initial load
    useEffect(() => {
        for (const task of tasks) {
            if (task.status === 'bekliyor') {
                const savedState = localStorage.getItem(`timerState_${task.id}`);
                if (savedState) {
                    try {
                        const parsedState = JSON.parse(savedState);
                        setPersistedTimerState(parsedState);
                        setUnfinishedSessionTask(task);
                        setShowUnfinishedSessionModal(true);
                        // Stop checking after finding the first unfinished session
                        return;
                    } catch (e) {
                        console.error("Failed to parse saved timer state", e);
                        localStorage.removeItem(`timerState_${task.id}`);
                    }
                }
            }
        }
    }, []); // Run only once on component mount

    const handleContinueSession = () => {
        if (unfinishedSessionTask) {
            handleStartTask(unfinishedSessionTask);
            setShowUnfinishedSessionModal(false);
            setUnfinishedSessionTask(null);
        }
    };

    const handlePostponeTask = () => {
        if (unfinishedSessionTask) {
            localStorage.removeItem(`timerState_${unfinishedSessionTask.id}`);
            setShowUnfinishedSessionModal(false);
            setUnfinishedSessionTask(null);
            setPersistedTimerState(undefined);
        }
    };

    const allPendingTasks = useMemo(() => {
        // Combine local tasks with remote assigned tasks
        const localTasks = tasks.filter(t => t.status === 'bekliyor');
        const remoteTasks = assignedTasks.filter(t => t.status === 'bekliyor');
        
        return [...localTasks, ...remoteTasks]
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }, [tasks, assignedTasks]);

    const filteredPendingTasks = useMemo(() => {
        const todayStr = getTodayString();

        if (taskFilter === 'today') {
            return allPendingTasks.filter(t => t.dueDate === todayStr);
        }
        if (taskFilter === 'upcoming') {
            return allPendingTasks.filter(t => t.dueDate > todayStr);
        }
        return allPendingTasks;
    }, [allPendingTasks, taskFilter]);

    const todayStr = getTodayString();
    const completedTodayTasks = tasks.filter(t => t.status === 'tamamlandı' && t.completionDate === todayStr);

    // Kullanıcı performans verilerini hesapla
    const userPerformance = useMemo(() => {
        const completedTasks = tasks.filter(t => t.status === 'tamamlandı');
        const totalTasks = tasks.length;
        const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;
        
        const averageScore = completedTasks.length > 0 
            ? Math.round(completedTasks.reduce((sum, task) => sum + (task.successScore || 0), 0) / completedTasks.length)
            : 0;

        // Ders bazlı performans analizi
        const subjectPerformance: { [key: string]: number[] } = {};
        completedTasks.forEach(task => {
            const courseName = courses.find(c => c.id === task.courseId)?.name || 'Bilinmeyen';
            if (!subjectPerformance[courseName]) {
                subjectPerformance[courseName] = [];
            }
            subjectPerformance[courseName].push(task.successScore || 0);
        });

        const subjectAverages = Object.entries(subjectPerformance).map(([subject, scores]) => ({
            subject,
            average: scores.reduce((sum, score) => sum + score, 0) / scores.length
        }));

        const strongSubjects = subjectAverages
            .filter(s => s.average >= averageScore + 10)
            .map(s => s.subject);
        
        const weakSubjects = subjectAverages
            .filter(s => s.average < averageScore - 10)
            .map(s => s.subject);

        return {
            completionRate,
            averageScore,
            strongSubjects,
            weakSubjects,
            learningStyle: 'mixed' as const // Bu gerçek uygulamada kullanıcı tercihi veya AI analizi ile belirlenebilir
        };
    }, [tasks]);

    // FloatingNotification handler
    const handleDismissAllNotifications = () => {
        // Tüm bildirimler kapatıldı
    };

    const handleSuggestStudyPlan = (plan: any) => {
        // Çalışma planı önerildi
    };
    
    const handlePauseForLater = (taskId: string, timerState: TimerState) => {
        // Timer state already saved to localStorage by ActiveTaskTimer
    };

    if (activeTask) {
        const onCompleteHandler = (taskId: string, data: any) => {
            completeTask(taskId, data);
            
            // If this is a remote task, update its status to completed
            if (taskId.startsWith('remote_')) {
                updateTaskStatus(taskId, { 
                    status: 'tamamlandı',
                    completionDate: getTodayString(),
                    successScore: data.successScore || 0,
                    focusScore: data.focusScore || 0,
                    pointsAwarded: data.pointsAwarded || 0
                });
            }
        };
        return <ActiveTaskTimer task={activeTask} tasks={tasks} onComplete={onCompleteHandler} onFinishSession={() => setActiveTask(null)} onPauseForLater={handlePauseForLater} initialTimerState={persistedTimerState} />;
    }
    // Geçmiş görev için manuel modal göster
    const handleManualModalClose = () => setManualTaskModal({ show: false, task: null });

    const handleManualModalComplete = (taskId: string, data: any) => {
        completeTask(taskId, data);
        
        // If this is a remote task, update its status to completed
        if (taskId.startsWith('remote_')) {
            updateTaskStatus(taskId, { 
                status: 'tamamlandı',
                completionDate: getTodayString(),
                successScore: data.successScore || 0,
                focusScore: data.focusScore || 0,
                pointsAwarded: data.pointsAwarded || 0
            });
        }
        
        setManualTaskModal({ show: false, task: null });
    };
    // Modal her zaman render edilir, show ile kontrol edilir
    // ...diğer return'den önce eklenmeli
    // ...
    // ...
    // Ana return'in hemen başına ekle
    if (manualTaskModal.show && manualTaskModal.task) {
        return <ManualTaskCompletionModal show={manualTaskModal.show} onClose={handleManualModalClose} task={manualTaskModal.task} onComplete={handleManualModalComplete} />;
    }

    if (activeReadingTask) {
        return <ActiveReadingSession task={activeReadingTask} tasks={tasks} onComplete={completeTask} onFinishSession={() => setActiveReadingTask(null)} initialTimerState={persistedTimerState} />;
    }

    const FilterButton: React.FC<{label: string, filter: TaskFilter}> = ({label, filter}) => (
        <button
            onClick={() => setTaskFilter(filter)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-full transition ${taskFilter === filter ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
        >
            {label}
        </button>
    );

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Günaydın, Genç Kaşif!";
        if (hour < 18) return "İyi çalışmalar!";
        return "İyi akşamlar!";
    };

    // NavLink component for drawer navigation
    const NavLink: React.FC<{ view: ChildView; icon: React.ReactNode; label: string; onClick?: () => void }> = ({ view, icon, label, onClick }) => (
        <button
            onClick={() => { setActiveView(view); if (onClick) onClick(); }}
            className={`flex items-center w-full text-left px-4 py-3 rounded-lg transition-colors ${
                activeView === view ? 'bg-primary-100 text-primary-700 font-semibold' : 'text-slate-600 hover:bg-slate-100'
            }`}
        >
            <span className="mr-3">{icon}</span>
            {label}
        </button>
    );
  
  return (
        <div className="relative">
            {/* Header - notification center ve hamburger menü */}
            <div className="md:hidden fixed top-4 left-4 right-4 z-50 flex justify-between items-center">
                {/* Hamburger menü - sadece mobilde görünür */}
                <button
                    className="bg-primary-600 text-white p-2 rounded-lg shadow-lg"
                    onClick={() => setDrawerOpen(true)}
                    aria-label="Menüyü Aç"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
                
                {/* Remote notification center - mobilde */}
                {isChild && (
                    <RemoteNotificationCenter 
                        notifications={notifications}
                        unreadCount={notifications.filter(n => !n.read).length}
                        onMarkAsRead={(id) => {/* Handle mark as read */}}
                    />
                )}
            </div>

            {/* Desktop header - masaüstünde notification center */}
            <div className="hidden md:flex fixed top-4 right-4 z-50">
                {isChild && (
                    <RemoteNotificationCenter 
                        notifications={notifications}
                        unreadCount={notifications.filter(n => !n.read).length}
                        onMarkAsRead={(id) => {/* Handle mark as read */}}
                    />
                )}
            </div>

            {/* Drawer - mobilde açılır menü */}
            {drawerOpen && (
                <div className="fixed inset-0 z-40 bg-black bg-opacity-40 flex md:hidden">
                    <div className="w-64 bg-white p-4 space-y-2 h-full shadow-xl relative transform transition-transform duration-300 ease-in-out">
                        <button
                            className="absolute top-3 right-3 text-slate-500 hover:text-primary-600 text-3xl font-light"
                            onClick={() => setDrawerOpen(false)}
                            aria-label="Menüyü Kapat"
                        >
                            &times;
                        </button>
                        {/* Kullanıcı bilgisi */}
                        <div className="mb-4 flex items-center space-x-3">
                            <Target className="w-7 h-7 text-primary-600" />
                            <span className="font-bold text-lg text-primary-700">Çocuk Paneli</span>
                        </div>
                        <NavLink view="tasks" icon={<Target className="w-5 h-5"/>} label="Görev Panosu" onClick={() => setDrawerOpen(false)} />
                        <NavLink view="treasures" icon={<Trophy className="w-5 h-5"/>} label="Hazine Odası" onClick={() => setDrawerOpen(false)} />
                        <NavLink view="stats" icon={<BarChart className="w-5 h-5"/>} label="İstatistikler" onClick={() => setDrawerOpen(false)} />
                        <NavLink view="assistant" icon={<Brain className="w-5 h-5"/>} label="AI Asistan" onClick={() => setDrawerOpen(false)} />
                    </div>
                    {/* Drawer dışına tıklayınca kapansın */}
                    <div className="flex-1" onClick={() => setDrawerOpen(false)} />
                </div>
            )}

    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">


        {/* Unfinished Session Modal */}
        {unfinishedSessionTask && (
             <Modal show={showUnfinishedSessionModal} onClose={() => {}} title="Yarım Kalmış Seans">
                <div className="text-center">
                    <p className="text-lg text-slate-700">Görünüşe göre yarım kalmış bir <strong>'{unfinishedSessionTask.title}'</strong> seansın var.</p>
                    <p className="mt-2 text-sm text-slate-500">Ne yapmak istersin?</p>
                    <div className="mt-6 flex justify-center space-x-4">
                        <button onClick={handlePostponeTask} className="px-6 py-2 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 flex items-center">
                            <Clock className="w-4 h-4 mr-2" /> Daha Sonra Yap
                        </button>
                         <button onClick={handleContinueSession} className="px-6 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 flex items-center">
                           <Play className="w-4 h-4 mr-2" /> Devam Et
                        </button>
                    </div>
                </div>
            </Modal>
        )}

        <Modal show={isFreeStudyModalOpen} onClose={() => {
            setIsFreeStudyModalOpen(false);
            // Reset form when modal is closed
            setFreeStudyTitle('');
            setFreeStudyDueDate(getTodayString());
            setFreeStudyDueTime(new Date().toTimeString().slice(0, 5));
            setFreeStudyDuration('');
            setFreeStudyCourseId(courses[0]?.id || '');
            setFreeStudyTaskType('ders çalışma');
            setFreeStudyQuestionCount('');
            setFreeStudyBookTitle('');
            setFreeStudyBookGenre('Hikaye');
        }} title="Serbest Çalışma Başlat">
            <form onSubmit={handleStartFreeStudy} className="space-y-4">
                <div>
                    <label htmlFor="free-study-title" className="block text-sm font-medium text-slate-700 mb-1">Çalışma Konusu</label>
                    <input id="free-study-title" type="text" value={freeStudyTitle} onChange={e => setFreeStudyTitle(e.target.value)} placeholder="Örn: Geometri Sınavı Tekrarı" required className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"/>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="free-study-due-date" className="block text-sm font-medium text-slate-700 mb-1">Hedef Tarih</label>
                        <input id="free-study-due-date" type="date" value={freeStudyDueDate} onChange={e => setFreeStudyDueDate(e.target.value)} required className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"/>
                    </div>
                    <div>
                        <label htmlFor="free-study-due-time" className="block text-sm font-medium text-slate-700 mb-1">Hedef Saat</label>
                        <input id="free-study-due-time" type="time" value={freeStudyDueTime} onChange={e => setFreeStudyDueTime(e.target.value)} required className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"/>
                    </div>
                </div>
                <div>
                    <label htmlFor="free-study-course" className="block text-sm font-medium text-slate-700 mb-1">Ders</label>
                    <select id="free-study-course" value={freeStudyCourseId} onChange={e => setFreeStudyCourseId(e.target.value)} required className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" title="Ders seçimi" disabled={courses.length === 0}>
                        {courses.length === 0 ? (
                            <option value="">Henüz ders eklenmemiş</option>
                        ) : (
                            courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                        )}
                    </select>
                </div>
                <div>
                    <label htmlFor="free-study-type" className="block text-sm font-medium text-slate-700 mb-1">Çalışma Türü</label>
                    <select id="free-study-type" value={freeStudyTaskType} onChange={e => setFreeStudyTaskType(e.target.value as any)} required className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" title="Çalışma Türü">
                        <option value="ders çalışma">Ders Çalışması</option>
                        <option value="soru çözme">Soru Çözme</option>
                        <option value="kitap okuma">Kitap Okuma</option>
                    </select>
                </div>
                {freeStudyTaskType === 'soru çözme' && (
                    <div>
                        <label htmlFor="free-study-question-count" className="block text-sm font-medium text-slate-700 mb-1">Soru Sayısı</label>
                        <input id="free-study-question-count" type="number" value={freeStudyQuestionCount} onChange={e => setFreeStudyQuestionCount(e.target.value)} required min="1" placeholder="Çözeceğiniz soru sayısı" className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"/>
                    </div>
                )}
                {freeStudyTaskType === 'kitap okuma' && (
                    <div className="space-y-3">
                        <div>
                            <label htmlFor="free-study-book-genre" className="block text-sm font-medium text-slate-700 mb-1">Kitap Türü</label>
                            <select 
                                id="free-study-book-genre" 
                                value={freeStudyBookGenre} 
                                onChange={e => setFreeStudyBookGenre(e.target.value as any)}
                                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="Hikaye">Hikaye</option>
                                <option value="Bilim">Bilim</option>
                                <option value="Tarih">Tarih</option>
                                <option value="Macera">Macera</option>
                                <option value="Şiir">Şiir</option>
                                <option value="Diğer">Diğer</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="free-study-book-title" className="block text-sm font-medium text-slate-700 mb-1">Kitap Adı</label>
                            <input id="free-study-book-title" type="text" value={freeStudyBookTitle} onChange={e => setFreeStudyBookTitle(e.target.value)} required placeholder="Okuyacağınız kitabın adı" className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"/>
                        </div>
                    </div>
                )}
                <div>
                    <label htmlFor="free-study-duration" className="block text-sm font-medium text-slate-700 mb-1">Planlanan Süre (dk)</label>
                    <input id="free-study-duration" type="number" value={freeStudyDuration} onChange={e => setFreeStudyDuration(e.target.value === '' ? '' : e.target.value.replace(/^0+/, ''))} required min="1" placeholder="Süre (dk)" className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"/>
                </div>
                <button type="submit" disabled={courses.length === 0} className="w-full bg-primary-600 text-white px-4 py-3 rounded-lg hover:bg-primary-700 transition font-bold flex items-center justify-center disabled:bg-primary-300 disabled:cursor-not-allowed" title={courses.length === 0 ? "Çalışma oluşturmak için önce bir ders eklemelisiniz." : "Çalışmayı Oluştur ve Başlat"}>
                    <Zap className="w-5 h-5 mr-2" /> Çalışmayı Oluştur ve Başlat
                </button>
            </form>
        </Modal>

        <div className="mb-8 p-6 bg-white rounded-xl shadow-md flex justify-between items-center">
            <div>
                <h2 className="text-3xl font-bold text-slate-800">{getGreeting()}</h2>
                {(() => {
                    const todayTasks = allPendingTasks.filter(t => new Date(t.dueDate) <= new Date());
                    const overdueTasks = allPendingTasks.filter(t => new Date(t.dueDate) < new Date());
                    
                    if (overdueTasks.length > 0) {
                        return (
                            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-red-700 font-semibold flex items-center">
                                    <Bell className="w-4 h-4 mr-2" />
                                    {overdueTasks.length} görevin süresi geçmiş! Acilen tamamlaman gerekiyor.
                                </p>
                            </div>
                        );
                    }
                    
                    return <p className="text-slate-500 mt-1">Bugün seni bekleyen {todayTasks.length} görev var. Başarılar!</p>;
                })()}
            </div>
            <div className="text-center">
                <div className="flex items-center justify-center space-x-2">
                    <Trophy className="w-8 h-8 text-amber-500" />
                    <span className="text-4xl font-bold text-amber-600">{successPoints}</span>
                </div>
                 <p className="text-sm font-semibold text-slate-600">Başarı Puanı</p>
            </div>
        </div>

        {/* Yatay menü - masaüstünde görünür */}
        <div className="mb-6 border-b border-slate-200 hidden md:block">
            <div className="flex space-x-4 overflow-x-auto">
                <button onClick={() => setActiveView('tasks')} className={`flex items-center space-x-2 pb-3 font-semibold whitespace-nowrap ${activeView === 'tasks' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-slate-500'}`}>
                    <Target className="w-5 h-5" />
                    <span>Görev Panosu</span>
                </button>
                <button onClick={() => setActiveView('treasures')} className={`flex items-center space-x-2 pb-3 font-semibold whitespace-nowrap ${activeView === 'treasures' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-slate-500'}`}>
                    <Trophy className="w-5 h-5" />
                    <span>Hazine Odası</span>
                </button>
                <button onClick={() => setActiveView('stats')} className={`flex items-center space-x-2 pb-3 font-semibold whitespace-nowrap ${activeView === 'stats' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-slate-500'}`}>
                    <BarChart className="w-5 h-5" />
                    <span>İstatistikler</span>
                </button>
                <button onClick={() => setActiveView('assistant')} className={`flex items-center space-x-2 pb-3 font-semibold whitespace-nowrap ${activeView === 'assistant' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-slate-500'}`}>
                    <Brain className="w-5 h-5" />
                    <span>AI Asistan</span>
                </button>
            </div>
        </div>

        {/* Mobil için aktif view başlığı */}
        <div className="mb-6 md:hidden">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                {activeView === 'tasks' && (
                    <>
                        <Target className="w-6 h-6 mr-2 text-primary-600" />
                        Görev Panosu
                    </>
                )}
                {activeView === 'treasures' && (
                    <>
                        <Trophy className="w-6 h-6 mr-2 text-primary-600" />
                        Hazine Odası
                    </>
                )}
                {activeView === 'stats' && (
                    <>
                        <BarChart className="w-6 h-6 mr-2 text-primary-600" />
                        İstatistikler
                    </>
                )}
                {activeView === 'assistant' && (
                    <>
                        <Brain className="w-6 h-6 mr-2 text-primary-600" />
                        AI Asistan
                    </>
                )}
            </h2>
        </div>

        {activeView === 'tasks' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold">Aktif Görevlerim</h3>
                        <div className="flex items-center space-x-2">
                            <div className="group relative">
                                <button onClick={() => setIsFreeStudyModalOpen(true)} className="flex items-center bg-indigo-100 text-indigo-700 px-3 py-1.5 text-sm font-semibold rounded-full hover:bg-indigo-200 transition">
                                    <PlusCircle className="w-4 h-4 mr-2" />
                                    Serbest Çalışma Başlat
                                </button>
                                <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs px-3 py-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                    Kendi çalışma seansınızı oluşturun - istediğiniz dersi seçin ve çalışmaya başlayın! 🚀
                                </div>
                            </div>
                            <FilterButton label="Bugün" filter="today" />
                            <FilterButton label="Yaklaşanlar" filter="upcoming" />
                            <FilterButton label="Tümü" filter="all" />
                        </div>
                    </div>
                    <div className="space-y-4">

                        
                        {/* Normal Görevler */}
                        {filteredPendingTasks.length > 0 ? (
                            filteredPendingTasks.map(task => <TaskCard key={task.id} task={task} courses={courses} onStart={handleStartTask} />)
                        ) : (
                            <div className="text-center py-10 bg-white rounded-lg shadow-sm">
                                <p className="text-slate-500">Bu filtreye uygun bekleyen görevin yok.</p>
                                <p className="text-slate-400 text-sm mt-1">Harika iş!</p>
                           </div>
                        )}
                    </div>
                    {completedTodayTasks.length > 0 && (
                        <div className="mt-8">
                            <h3 className="text-xl font-bold flex items-center text-slate-600"><CheckCircle className="w-6 h-6 mr-2 text-green-500"/> Bugün Tamamlananlar</h3>
                            <div className="space-y-4 mt-4">
                                {completedTodayTasks.map(task => <TaskCard key={task.id} task={task} courses={courses} onStart={() => {}} />)}
                            </div>
                        </div>
                    )}
                </div>
                <div className="lg:col-span-1 space-y-6 sticky top-24">
                    <WeeklyPointsChart tasks={tasks} />
                    <MyLibrary tasks={tasks} />
                </div>
            </div>
        )}

        {activeView === 'treasures' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <RewardStore rewards={rewards} successPoints={successPoints} claimReward={claimReward} />
                 <MyAchievements badges={badges} />
            </div>
        )}

        {activeView === 'stats' && (
            <div className="space-y-8">
                <StudyStats tasks={tasks} />
            </div>
        )}

        {activeView === 'assistant' && (
            <div className="space-y-8">
                {tasks && tasks.length >= 0 ? (
                    <ErrorBoundary>
                        <PersonalizedLearningAssistant 
                            tasks={tasks}
                            userPerformance={userPerformance}
                            onSuggestStudyPlan={handleSuggestStudyPlan}
                            ai={ai}
                        />
                    </ErrorBoundary>
                ) : (
                    <div className="bg-white p-8 rounded-xl shadow-lg text-center">
                        <div className="text-slate-500">Veriler yükleniyor...</div>
                    </div>
                )}
            </div>
        )}

        {/* Floating Notification System */}
        <FloatingNotification
            tasks={tasks}
            onDismissAll={handleDismissAllNotifications}
        />
    </div>
        </div>
    );
};

export default ChildDashboard;