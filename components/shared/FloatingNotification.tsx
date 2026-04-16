import React, { useMemo, useState, useEffect } from 'react';
import { Task } from '../../types';
import { Bell, X, Clock, Calendar, AlertTriangle, CheckCircle } from '../icons';
import { getLocalDateString, parseDate } from '../../utils/dateUtils';

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

    useEffect(() => {
        if (hasInitialized && tasks.length === 0) return;

        const analyzeAndCreateNotifications = () => {
            const now = new Date();
            const nowDateStr = getLocalDateString(now);
            const newNotifications: NotificationItem[] = [];

            const missingTasks = tasks.filter(t =>
                t.status !== 'tamamland\u0131' &&
                parseDate(t.dueDate) < now &&
                !t.postponed
            );

            if (missingTasks.length > 0) {
                const existingMissingNotification = notifications.find(
                    n => n.type === 'missing_task' && n.timestamp.toDateString() === now.toDateString(),
                );
                if (!existingMissingNotification) {
                    newNotifications.push({
                        id: `missing_${nowDateStr}`,
                        type: 'missing_task',
                        title: 'Eksik Gorev Uyarisi',
                        message: `Tamamlanmamis ${missingTasks.length} gorev var. Hemen aksiyon al.`,
                        timestamp: now,
                        isRead: false,
                        priority: 'high'
                    });
                }
            }

            tasks.filter(t => t.status === 'bekliyor').forEach(task => {
                const dueDate = parseDate(task.dueDate);
                if (!dueDate || Number.isNaN(dueDate.getTime())) return;

                const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
                if (hoursUntilDue <= 24 && hoursUntilDue > 0) {
                    const existingNotification = notifications.find(n => n.taskId === task.id && n.type === 'due_soon');
                    if (!existingNotification) {
                        newNotifications.push({
                            id: `due_${task.id}`,
                            type: 'due_soon',
                            title: 'Gorev Hatirlatma',
                            message: `"${task.title}" gorevi yaklasiyor.`,
                            timestamp: now,
                            isRead: false,
                            priority: hoursUntilDue <= 6 ? 'high' : 'medium',
                            taskId: task.id
                        });
                    }
                }
            });

            const today = getLocalDateString(now);
            const todayCompletedTasks = tasks.filter(t => t.status === 'tamamland\u0131' && t.completionDate === today);

            if (todayCompletedTasks.length > 0) {
                const existingTodayNotification = notifications.find(n => n.id === `completed_${today}` && n.type === 'completed_task');
                if (!existingTodayNotification) {
                    newNotifications.push({
                        id: `completed_${today}`,
                        type: 'completed_task',
                        title: 'Tebrikler',
                        message: `Bugun ${todayCompletedTasks.length} gorev tamamladin.`,
                        timestamp: now,
                        isRead: false,
                        priority: 'medium'
                    });
                }
            }

            const noTasksToday = todayCompletedTasks.length === 0;
            if (noTasksToday && now.getHours() >= 18 && !notifications.some(n => n.type === 'daily_goal' && n.timestamp.toDateString() === now.toDateString())) {
                newNotifications.push({
                    id: `daily_goal_${today}`,
                    type: 'daily_goal',
                    title: 'Gunluk Hedef',
                    message: 'Bugun henuz gorev tamamlamadin. Kucuk bir adim at.',
                    timestamp: now,
                    isRead: false,
                    priority: 'low'
                });
            }

            if (newNotifications.length > 0) {
                setNotifications(prev => [...newNotifications, ...prev].slice(0, 10));
                setLastCheck(now);
            }

            setHasInitialized(true);
        };

        analyzeAndCreateNotifications();
    }, [tasks, hasInitialized, notifications, lastCheck]);

    useEffect(() => {
        const completedTaskIds = tasks.filter(t => t.status === 'tamamland\u0131').map(t => t.id);
        setNotifications(prev => prev.filter(notification => !(notification.taskId && completedTaskIds.includes(notification.taskId))));
    }, [tasks]);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const markAsRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    };

    const deleteNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
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
            <div className="fixed bottom-6 right-6 z-50">
                <button
                    onClick={() => setShowPanel(!showPanel)}
                    className="relative bg-primary-600 hover:bg-primary-700 text-white rounded-full p-4 shadow-lg transition-all duration-200 hover:scale-105"
                >
                    <Bell className="w-6 h-6" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>
            </div>

            {showPanel && (
                <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] bg-white rounded-xl shadow-2xl border border-slate-200 max-h-[70vh] overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
                        <div>
                            <h3 className="font-bold text-lg text-slate-800">Bildirimler</h3>
                            <p className="text-sm text-slate-500">{unreadCount} okunmamis bildirim</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button onClick={markAllAsRead} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                                    Tumunu oku
                                </button>
                            )}
                            <button onClick={() => setShowPanel(false)} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                    </div>

                    <div className="overflow-y-auto max-h-[50vh]">
                        {notifications.map((notification) => (
                            <div key={notification.id} className={`p-4 border-b border-slate-100 last:border-b-0 ${getPriorityColor(notification.priority, notification.isRead)}`}>
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 mt-0.5">{getNotificationIcon(notification.type)}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <h4 className={`font-semibold text-sm ${notification.isRead ? 'text-slate-600' : 'text-slate-800'}`}>
                                                    {notification.title}
                                                </h4>
                                                <p className={`text-sm mt-1 ${notification.isRead ? 'text-slate-500' : 'text-slate-600'}`}>
                                                    {notification.message}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-2">{notification.timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                            <button onClick={() => deleteNotification(notification.id)} className="flex-shrink-0 p-1 hover:bg-white hover:bg-opacity-60 rounded transition-colors">
                                                <X className="w-4 h-4 text-slate-400" />
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-2 mt-3">
                                            {!notification.isRead && (
                                                <button onClick={() => markAsRead(notification.id)} className="text-xs bg-white bg-opacity-80 hover:bg-opacity-100 text-slate-600 px-3 py-1 rounded-full transition-colors">
                                                    Okundu isaretle
                                                </button>
                                            )}
                                            {notification.taskId && onContinueTask && (
                                                <button onClick={() => { onContinueTask(notification.taskId!); markAsRead(notification.id); }} className="text-xs bg-primary-600 hover:bg-primary-700 text-white px-3 py-1 rounded-full transition-colors">
                                                    Goreve Git
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {notifications.length > 0 && (
                        <div className="p-3 border-t border-slate-200 bg-slate-50">
                            <button onClick={clearAll} className="w-full text-sm text-slate-600 hover:text-slate-800 py-2 transition-colors">
                                Tum bildirimleri temizle
                            </button>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default FloatingNotification;


