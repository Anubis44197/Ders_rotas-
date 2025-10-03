import React, { useState, useEffect } from 'react';
import { Bell, Check, X, Gift, Trophy, Clock, BookOpen } from '../icons';
import { Notification } from '../../types';

interface NotificationCenterProps {
    notifications: Notification[];
    onMarkAsRead: (notificationId: string) => void;
    onMarkAllAsRead: () => void;
    onApproveReward: (rewardId: string) => void;
    onRejectReward: (rewardId: string) => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
    notifications,
    onMarkAsRead,
    onMarkAllAsRead,
    onApproveReward,
    onRejectReward
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const unreadCount = notifications.filter(n => !n.read).length;

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'reward_request': return <Gift className="w-5 h-5 text-amber-500" />;
            case 'task_completed': return <Check className="w-5 h-5 text-green-500" />;
            case 'achievement': return <Trophy className="w-5 h-5 text-purple-500" />;
            case 'reminder': return <Clock className="w-5 h-5 text-blue-500" />;
            default: return <Bell className="w-5 h-5 text-slate-500" />;
        }
    };

    const formatTime = (timestamp: Date) => {
        const now = new Date();
        const diff = now.getTime() - timestamp.getTime();
        const minutes = Math.floor(diff / 60000);
        
        if (minutes < 1) return 'Şimdi';
        if (minutes < 60) return `${minutes}dk önce`;
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}sa önce`;
        
        const days = Math.floor(hours / 24);
        return `${days}g önce`;
    };

    return (
        <div className="relative">
            {/* Bildirim İkonu */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-slate-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                aria-label="Bildirimler"
            >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Bildirim Paneli */}
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 max-h-96 overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-slate-200">
                            <h3 className="font-bold text-slate-800">Bildirimler</h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={onMarkAllAsRead}
                                    className="text-xs text-primary-600 hover:text-primary-700 font-semibold"
                                >
                                    Tümünü Okundu İşaretle
                                </button>
                            )}
                        </div>

                        {/* Bildirim Listesi */}
                        <div className="max-h-80 overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">
                                    <Bell className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                                    <p className="text-sm">Henüz bildirim yok</p>
                                </div>
                            ) : (
                                notifications.map(notification => (
                                    <div
                                        key={notification.id}
                                        className={`p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${!notification.read ? 'bg-primary-50' : ''}`}
                                    >
                                        <div className="flex items-start space-x-3">
                                            <div className="flex-shrink-0 mt-1">
                                                {getNotificationIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between">
                                                    <p className="font-semibold text-sm text-slate-800 truncate">
                                                        {notification.title}
                                                    </p>
                                                    <span className="text-xs text-slate-500 ml-2 flex-shrink-0">
                                                        {formatTime(notification.timestamp)}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-600 mt-1">
                                                    {notification.message}
                                                </p>

                                                {/* Ödül Talebi İçin Özel Butonlar */}
                                                {notification.type === 'reward_request' && notification.data?.rewardId && (
                                                    <div className="flex space-x-2 mt-3">
                                                        <button
                                                            onClick={() => onApproveReward(notification.data!.rewardId!)}
                                                            className="flex-1 bg-green-500 text-white text-xs py-2 px-3 rounded-lg hover:bg-green-600 transition font-semibold"
                                                        >
                                                            Onayla
                                                        </button>
                                                        <button
                                                            onClick={() => onRejectReward(notification.data!.rewardId!)}
                                                            className="flex-1 bg-red-500 text-white text-xs py-2 px-3 rounded-lg hover:bg-red-600 transition font-semibold"
                                                        >
                                                            Reddet
                                                        </button>
                                                    </div>
                                                )}

                                                {!notification.read && (
                                                    <button
                                                        onClick={() => onMarkAsRead(notification.id)}
                                                        className="text-xs text-primary-600 hover:text-primary-700 font-semibold mt-2"
                                                    >
                                                        Okundu İşaretle
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default NotificationCenter;