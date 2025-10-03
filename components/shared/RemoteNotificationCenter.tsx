import React, { useState } from 'react';
import { Bell, Check, Clock, CheckCircle } from '../icons';
import { TaskNotification } from '../../src/firebase/remoteAssignment';

interface RemoteNotificationCenterProps {
  notifications: TaskNotification[];
  unreadCount: number;
  onMarkAsRead: (notificationId: string) => void;
  isVisible?: boolean;
}

const RemoteNotificationCenter: React.FC<RemoteNotificationCenterProps> = ({
  notifications,
  unreadCount,
  onMarkAsRead,
  isVisible = false
}) => {
  const [isOpen, setIsOpen] = useState(isVisible);

  const getNotificationIcon = (type: TaskNotification['type']) => {
    switch (type) {
      case 'task_assigned':
        return <Clock className="w-5 h-5 text-blue-500" />;
      case 'task_completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'task_updated':
        return <Check className="w-5 h-5 text-yellow-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Az önce';
    if (diffInMinutes < 60) return `${diffInMinutes} dk önce`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} saat önce`;
    return date.toLocaleDateString('tr-TR');
  };

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-600 hover:text-slate-800 transition-colors"
        aria-label="Bildirimler"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 max-h-96 overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Bildirimler</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Kapat"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Henüz bildirim yok</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${
                      !notification.read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                    onClick={() => !notification.read && onMarkAsRead(notification.id)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-semibold ${!notification.read ? 'text-slate-900' : 'text-slate-700'}`}>
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mt-1">
                          {notification.message}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-slate-400">
                            {formatTime(notification.timestamp)}
                          </p>
                          {notification.data && (
                            <div className="flex items-center space-x-2 text-xs text-slate-500">
                              {notification.data.taskType && (
                                <span className="bg-slate-100 px-2 py-1 rounded">
                                  {notification.data.taskType}
                                </span>
                              )}
                              {notification.data.plannedDuration && (
                                <span className="bg-slate-100 px-2 py-1 rounded">
                                  {notification.data.plannedDuration} dk
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-3 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => {
                  notifications.filter(n => !n.read).forEach(n => onMarkAsRead(n.id));
                }}
                className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium"
                disabled={unreadCount === 0}
              >
                Tümünü Okundu İşaretle
              </button>
            </div>
          )}
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default RemoteNotificationCenter;