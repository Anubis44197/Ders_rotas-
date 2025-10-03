import React, { useState, useEffect } from 'react';
import { Task } from '../../types';
import { Bell, X, Clock, Calendar, AlertTriangle, CheckCircle } from '../icons';

interface FloatingNotificationProps {
    tasks: Task[];
    onDismissAll?: () => void;
    onContinueTask?: (taskId: string) => void;
}

interface NotificationItem {
    id: string;
    type: 'due_soon' | 'daily_goal' | 'streak_danger' | 'completed_task' | 'missing_task';
    title: string;
    message: string;
    timestamp: Date;
    isRead: boolean;
    priority: 'low' | 'medium' | 'high';
    taskId?: string;
}

const FloatingNotification: React.FC<FloatingNotificationProps> = ({
    tasks,
    onDismissAll,
    onContinueTask
}) => {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [showPanel, setShowPanel] = useState(false);
    const [lastCheck, setLastCheck] = useState<Date>(new Date());
    const [hasInitialized, setHasInitialized] = useState<boolean>(false);

    // Notification'ları analiz et ve oluştur (sadece ilk yüklemede)
    useEffect(() => {
        // Sadece ilk yüklemede veya tasks değiştiğinde
        if (hasInitialized && tasks.length === 0) return;
        
        const analyzeAndCreateNotifications = () => {
            const now = new Date();
            const newNotifications: NotificationItem[] = [];
            // Eksik görevler için otomatik uyarı ve aksiyon önerisi
            const nowDateStr = now.toISOString().split('T')[0];
            const missingTasks = tasks.filter(t =>
                t.status !== 'tamamlandı' &&
                new Date(t.dueDate) < now &&
                !t.postponed
            );
            if (missingTasks.length > 0) {
                const existingMissingNotification = notifications.find(n => n.type === 'missing_task' && n.timestamp.toDateString() === now.toDateString());
                if (!existingMissingNotification) {
                    newNotifications.push({
                        id: `missing_${nowDateStr}`,
                        type: 'missing_task',
                        title: 'Eksik Görev Uyarısı',
                        message: `Tamamlanmamış ${missingTasks.length} görev var. Hemen aksiyon al!`,
                        timestamp: now,
                        isRead: false,
                        priority: 'high'
                    });
                }
            }
            
            // Sadece yeni görevler için bildirim oluştur (son kontrolden sonra)
            const pendingTasks = tasks.filter(t => 
                t.status === 'bekliyor' && 
                new Date(t.dueDate) > lastCheck
            );

            // 1. Yaklaşan görevler (24 saat içinde) - Duplicate kontrolü ile (tamamlananlar hariç)
            tasks.filter(t => t.status === 'bekliyor' || (t.status !== 'tamamlandı' && t.status === 'devam ediyor')).forEach(task => {
                // Tarih formatını düzgün parse et
                let dueDate;
                if (typeof task.dueDate === 'string') {
                    dueDate = new Date(task.dueDate);
                } else {
                    dueDate = task.dueDate;
                }
                
                // Geçerli tarih kontrolü
                if (!dueDate || isNaN(dueDate.getTime())) return;
                
                const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
                
                // Sadece yaklaşan görevler ve daha önce oluşturulmamış olanlar (sadece pozitif saatler)
                if (hoursUntilDue <= 24 && hoursUntilDue > 0) {
                    const existingNotification = notifications.find(n => n.taskId === task.id && n.type === 'due_soon');
                    if (!existingNotification) {
                        newNotifications.push({
                            id: `due_${task.id}`,
                            type: 'due_soon',
                            title: 'Görev Hatırlatma',
                            message: `"${task.title}" görevi yaklaşıyor!`,
                            timestamp: now,
                            isRead: false,
                            priority: hoursUntilDue <= 6 ? 'high' : 'medium',
                            taskId: task.id
                        });
                    }
                }
            });

            // 2. Günlük başarı bildirimi (sadece ilk kez)
            const today = now.toISOString().split('T')[0];
            const todayCompletedTasks = tasks.filter(t => 
                t.status === 'tamamlandı' && 
                t.completionDate === today
            );

            if (todayCompletedTasks.length > 0) {
                const existingTodayNotification = notifications.find(n => n.id === `completed_${today}` && n.type === 'completed_task');
                if (!existingTodayNotification) {
                    newNotifications.push({
                        id: `completed_${today}`,
                        type: 'completed_task',
                        title: 'Tebrikler!',
                        message: `Bugün ${todayCompletedTasks.length} görev tamamladın!`,
                        timestamp: now,
                        isRead: false,
                        priority: 'medium'
                    });
                }
            }

            // 3. Günlük hedef uyarısı (sadece akşam saatlerinde ve daha önce gösterilmediyse)
            const noTasksToday = tasks.filter(t => 
                t.status === 'tamamlandı' && t.completionDate === today
            ).length === 0;

            if (noTasksToday && 
                now.getHours() >= 18 && 
                !notifications.some(n => n.type === 'daily_goal' && 
                    n.timestamp.toDateString() === now.toDateString())
            ) {
                newNotifications.push({
                    id: `daily_goal_${today}`,
                    type: 'daily_goal',
                    title: 'Günlük Hedef',
                    message: 'Bugün henüz görev tamamlamadın. Küçük bir adım at!',
                    timestamp: now,
                    isRead: false,
                    priority: 'low'
                });
            }

            if (newNotifications.length > 0) {
                setNotifications(prev => [...newNotifications, ...prev].slice(0, 10)); // Max 10 notification
                setLastCheck(now);
            }
            
            setHasInitialized(true);
        };

        analyzeAndCreateNotifications();
    }, [tasks, hasInitialized]); // Controlled dependencies

    // Tamamlanan görevlerin bildirimlerini temizle
    useEffect(() => {
        const completedTaskIds = tasks.filter(t => t.status === 'tamamlandı').map(t => t.id);
        
        setNotifications(prev => 
            prev.filter(notification => 
                // Eğer bu bildirim bir göreve ait ise ve görev tamamlandıysa, bildirimi kaldır
                !(notification.taskId && completedTaskIds.includes(notification.taskId))
            )
        );
    }, [tasks]);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const markAsRead = (id: string) => {
        setNotifications(prev => 
            prev.map(n => n.id === id ? { ...n, isRead: true } : n)
        );
    };

    const markAllAsRead = () => {
        setNotifications(prev => 
            prev.map(n => ({ ...n, isRead: true }))
        );
    };

    const deleteNotification = (id: string) => {
        setNotifications(prev => 
            prev.filter(n => n.id !== id)
        );
    };

    const clearAll = () => {
        setNotifications([]);
        setShowPanel(false);
        if (onDismissAll) onDismissAll();
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'due_soon': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
            case 'daily_goal': return <Calendar className="w-5 h-5 text-blue-500" />;
            case 'streak_danger': return <Clock className="w-5 h-5 text-red-500" />;
            case 'completed_task': return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'missing_task': return <AlertTriangle className="w-5 h-5 text-red-600 animate-bounce" />;
            default: return <Bell className="w-5 h-5 text-slate-500" />;
        }
    };

    const getPriorityColor = (priority: string, isRead: boolean) => {
        if (isRead) return 'bg-slate-50 border-slate-200';
        
        switch (priority) {
            case 'high': return 'bg-red-50 border-red-200';
            case 'medium': return 'bg-amber-50 border-amber-200';
            case 'low': return 'bg-blue-50 border-blue-200';
            default: return 'bg-slate-50 border-slate-200';
        }
    };

    if (notifications.length === 0) return null;

    return (
        <>
            {/* Floating Notification Button */}
            <div className="fixed bottom-6 right-6 z-50">
                <button
                    onClick={() => setShowPanel(!showPanel)}
                    className="relative bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-105"
                >
                    <Bell className="w-6 h-6" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Notification Panel */}
            {showPanel && (
                <div className="fixed bottom-20 right-6 z-50 w-96 max-h-96 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
                    {/* Header */}
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <Bell className="w-5 h-5 text-slate-600" />
                            <h3 className="font-semibold text-slate-800">Bildirimler</h3>
                            {unreadCount > 0 && (
                                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                                    {unreadCount} yeni
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => setShowPanel(false)}
                            className="text-slate-400 hover:text-slate-600 p-1"
                            title="Bildirimleri Kapat"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Actions */}
                    {notifications.length > 0 && (
                        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex space-x-2">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    Tümünü Okundu İşaretle
                                </button>
                            )}
                            <button
                                onClick={clearAll}
                                className="text-xs text-red-600 hover:text-red-800 font-medium"
                            >
                                Tümünü Temizle
                            </button>
                        </div>
                    )}

                    {/* Notifications List */}
                    <div className="max-h-80 overflow-y-auto">
                        {notifications.map(notification => (
                            <div
                                key={notification.id}
                                className={`p-4 border-b border-slate-100 last:border-b-0 ${getPriorityColor(notification.priority, notification.isRead)} hover:bg-slate-50 cursor-pointer transition-colors`}
                                onClick={() => markAsRead(notification.id)}
                            onDoubleClick={() => {
                                if (notification.taskId && onContinueTask) {
                                    onContinueTask(notification.taskId);
                                }
                            }}
                        >
                                <div className="flex items-start space-x-3">
                                    <div className="flex-shrink-0 mt-1">
                                        {getNotificationIcon(notification.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className={`text-sm font-medium ${notification.isRead ? 'text-slate-600' : 'text-slate-900'}`}>
                                                {notification.title}
                                            </p>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteNotification(notification.id);
                                                }}
                                                className="text-slate-400 hover:text-slate-600 p-1"
                                                title="Bildirimi Sil"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <p className={`text-sm ${notification.isRead ? 'text-slate-500' : 'text-slate-700'}`}>
                                            {notification.message}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            {notification.timestamp.toLocaleTimeString('tr-TR', {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Empty State */}
                    {notifications.length === 0 && (
                        <div className="p-8 text-center text-slate-500">
                            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Henüz bildirim yok</p>
                        </div>
                    )}
                </div>
            )}

            {/* Click Outside to Close */}
            {showPanel && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowPanel(false)}
                />
            )}
        </>
    );
};

export default FloatingNotification;