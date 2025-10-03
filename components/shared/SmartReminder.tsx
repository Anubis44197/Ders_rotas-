import React, { useState, useEffect } from 'react';
import { Task } from '../../types';
import { Calendar, Clock, Bell, AlertTriangle } from '../icons';

interface SmartReminderProps {
    tasks: Task[];
    onCreateReminder: (reminder: ReminderConfig) => void;
    onSnoozeReminder: (reminderId: string) => void;
    onDismiss?: () => void;
}

interface ReminderConfig {
    id: string;
    taskId: string;
    type: 'due_soon' | 'study_break' | 'daily_goal' | 'streak_danger';
    scheduledTime: Date;
    message: string;
    isActive: boolean;
}

const SmartReminder: React.FC<SmartReminderProps> = ({
    tasks,
    onCreateReminder,
    onSnoozeReminder,
    onDismiss
}) => {
    const [activeReminders, setActiveReminders] = useState<ReminderConfig[]>([]);
    const [showReminderModal, setShowReminderModal] = useState(false);
    const [currentReminder, setCurrentReminder] = useState<ReminderConfig | null>(null);

    // Akıllı hatırlatıcı analizi
    useEffect(() => {
        const analyzeAndCreateReminders = () => {
            const now = new Date();
            const pendingTasks = tasks.filter(t => t.status === 'bekliyor');
            const newReminders: ReminderConfig[] = [];

            // 1. Yaklaşan son tarihler
            pendingTasks.forEach(task => {
                const dueDate = new Date(task.dueDate);
                const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
                
                if (hoursUntilDue <= 24 && hoursUntilDue > 0) {
                    newReminders.push({
                        id: `due_${task.id}`,
                        taskId: task.id,
                        type: 'due_soon',
                        scheduledTime: new Date(now.getTime() + (hoursUntilDue - 2) * 60 * 60 * 1000),
                        message: `"${task.title}" görevi yarın sona eriyor! Çalışmaya başlamanın zamanı geldi.`,
                        isActive: true
                    });
                }
            });

            // 2. Günlük hedef hatırlatıcısı
            const today = now.toISOString().split('T')[0];
            const todayCompletedTasks = tasks.filter(t => 
                t.status === 'tamamlandı' && t.completionDate === today
            );
            
            if (todayCompletedTasks.length === 0 && now.getHours() >= 16) {
                newReminders.push({
                    id: 'daily_goal',
                    taskId: '',
                    type: 'daily_goal',
                    scheduledTime: now,
                    message: 'Bugün henüz hiç görev tamamlamadın. Küçük bir görevle başlamaya ne dersin?',
                    isActive: true
                });
            }

            // 3. Seri tehlike hatırlatıcısı
            const last7Days = Array.from({ length: 7 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - i);
                return date.toISOString().split('T')[0];
            });

            const streakDays = last7Days.reduce((streak, date) => {
                const hasTaskOnDay = tasks.some(task => 
                    task.status === 'tamamlandı' && task.completionDate === date
                );
                return hasTaskOnDay ? streak : 0;
            }, 0);

            if (streakDays === 0 && now.getHours() >= 18) {
                newReminders.push({
                    id: 'streak_danger',
                    taskId: '',
                    type: 'streak_danger',
                    scheduledTime: now,
                    message: 'Dikkat! Çalışma seriniz kırılmak üzere. Bugün küçük bir görev bile büyük fark yaratabilir!',
                    isActive: true
                });
            }

            setActiveReminders(prev => [...prev, ...newReminders]);
        };

        analyzeAndCreateReminders();
        const interval = setInterval(analyzeAndCreateReminders, 60000); // Her dakika kontrol et

        return () => clearInterval(interval);
    }, [tasks]);

    // Hatırlatıcı gösterimi
    useEffect(() => {
        const checkReminders = () => {
            const now = new Date();
            const dueReminder = activeReminders.find(r => 
                r.isActive && r.scheduledTime <= now && !currentReminder
            );

            if (dueReminder) {
                setCurrentReminder(dueReminder);
                setShowReminderModal(true);
            }
        };

        const interval = setInterval(checkReminders, 1000);
        return () => clearInterval(interval);
    }, [activeReminders, currentReminder]);

    const handleDismissReminder = () => {
        if (currentReminder) {
            setActiveReminders(prev => 
                prev.map(r => r.id === currentReminder.id ? { ...r, isActive: false } : r)
            );
        }
        setCurrentReminder(null);
        setShowReminderModal(false);
        
        // Parent component'e bildir (tamamen kapatmak için)
        if (onDismiss) {
            onDismiss();
        }
    };

    const handleSnoozeReminder = () => {
        if (currentReminder) {
            const snoozeTime = new Date();
            snoozeTime.setMinutes(snoozeTime.getMinutes() + 30);
            
            setActiveReminders(prev => 
                prev.map(r => r.id === currentReminder.id ? { ...r, scheduledTime: snoozeTime } : r)
            );
            onSnoozeReminder(currentReminder.id);
        }
        setCurrentReminder(null);
        setShowReminderModal(false);
    };

    const getReminderIcon = (type: string) => {
        switch (type) {
            case 'due_soon': return <AlertTriangle className="w-8 h-8 text-amber-500" />;
            case 'daily_goal': return <Calendar className="w-8 h-8 text-blue-500" />;
            case 'streak_danger': return <Clock className="w-8 h-8 text-red-500" />;
            default: return <Bell className="w-8 h-8 text-slate-500" />;
        }
    };

    const getReminderColor = (type: string) => {
        switch (type) {
            case 'due_soon': return 'border-amber-200 bg-amber-50';
            case 'daily_goal': return 'border-blue-200 bg-blue-50';
            case 'streak_danger': return 'border-red-200 bg-red-50';
            default: return 'border-slate-200 bg-slate-50';
        }
    };

    return (
        <>
            {/* Aktif Hatırlatıcı Sayısı Göstergesi */}
            {activeReminders.filter(r => r.isActive).length > 0 && (
                <div className="fixed bottom-4 right-4 z-50">
                    <div className="bg-primary-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center space-x-2">
                        <Bell className="w-4 h-4" />
                        <span className="text-sm font-semibold">
                            {activeReminders.filter(r => r.isActive).length} hatırlatıcı
                        </span>
                    </div>
                </div>
            )}

            {/* Hatırlatıcı Modalı */}
            {showReminderModal && currentReminder && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className={`bg-white rounded-xl shadow-2xl max-w-md w-full border-2 ${getReminderColor(currentReminder.type)}`}>
                        <div className="p-6 text-center">
                            <div className="mb-4">
                                {getReminderIcon(currentReminder.type)}
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-3">
                                Hatırlatıcı
                            </h3>
                            <p className="text-slate-600 mb-6 leading-relaxed">
                                {currentReminder.message}
                            </p>
                            <div className="flex space-x-3">
                                <button
                                    onClick={handleSnoozeReminder}
                                    className="flex-1 bg-slate-200 text-slate-700 py-2 px-4 rounded-lg hover:bg-slate-300 transition font-semibold"
                                >
                                    30dk Sonra Hatırlat
                                </button>
                                <button
                                    onClick={handleDismissReminder}
                                    className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition font-semibold"
                                >
                                    Anladım
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hatırlatıcı Geçmişi */}
            <div className="bg-white p-4 rounded-xl shadow-md">
                <h4 className="font-bold text-slate-700 mb-3 flex items-center">
                    <Bell className="w-5 h-5 mr-2 text-primary-600" />
                    Bugünün Hatırlatıcıları
                </h4>
                <div className="space-y-2">
                    {activeReminders.length === 0 ? (
                        <p className="text-slate-500 text-sm">Henüz hatırlatıcı yok</p>
                    ) : (
                        activeReminders.map(reminder => (
                            <div key={reminder.id} className={`p-3 rounded-lg border ${getReminderColor(reminder.type)} ${!reminder.isActive ? 'opacity-50' : ''}`}>
                                <div className="flex items-center space-x-3">
                                    <div className="flex-shrink-0">
                                        {getReminderIcon(reminder.type)}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-slate-700">
                                            {reminder.message}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {reminder.scheduledTime.toLocaleTimeString('tr-TR', { 
                                                hour: '2-digit', 
                                                minute: '2-digit' 
                                            })}
                                            {!reminder.isActive && ' - Tamamlandı'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
};

export default SmartReminder;