import { useState, useEffect, useCallback } from 'react';
import { Task } from '../../types';
import { 
  assignTaskToChild, 
  getAssignedTasksForChild, 
  updateAssignedTaskStatus,
  getNotificationsForUser,
  markNotificationAsRead,
  listenToAssignedTasks,
  listenToNotifications,
  TaskNotification
} from '../firebase/remoteAssignment';
import { getCurrentUserProfile, UserProfile, UserRole } from '../firebase/auth';

// Remote task management hook
export const useRemoteTaskManagement = () => {
  const [assignedTasks, setAssignedTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userProfile] = useState<UserProfile | null>(getCurrentUserProfile());

  // Parent: Çocuğa görev ata
  const assignTask = useCallback(async (task: Omit<Task, 'id' | 'assignedTo'>, childId?: string) => {
    if (!userProfile || userProfile.role !== UserRole.Parent) {
      setError('Sadece ebeveynler görev atayabilir');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const taskId = await assignTaskToChild(task, userProfile, childId);
      return taskId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Görev atama başarısız');
      return null;
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  // Child: Görev durumunu güncelle
  const updateTaskStatus = useCallback(async (taskId: string, updates: Partial<Task>) => {
    if (!userProfile || userProfile.role !== UserRole.Child) {
      setError('Sadece çocuklar görev durumunu güncelleyebilir');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      await updateAssignedTaskStatus(taskId, updates, userProfile);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Görev güncelleme başarısız');
      return false;
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  // Bildirimi okundu olarak işaretle
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await markNotificationAsRead(notificationId);
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId ? { ...notif, read: true } : notif
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bildirim işaretleme başarısız');
    }
  }, []);

  // Gerçek zamanlı veri dinleyicilerini başlat
  useEffect(() => {
    if (!userProfile) return;

    let unsubscribeTasks: (() => void) | undefined;
    let unsubscribeNotifications: (() => void) | undefined;

    // Child için atanmış görevleri dinle
    if (userProfile.role === UserRole.Child) {
      unsubscribeTasks = listenToAssignedTasks(
        userProfile.uid,
        userProfile.familyId,
        (tasks) => {
          setAssignedTasks(tasks);
        }
      );
    }

    // Bildirimleri dinle
    unsubscribeNotifications = listenToNotifications(
      userProfile.uid,
      userProfile.familyId,
      (notifications) => {
        setNotifications(notifications);
      }
    );

    return () => {
      unsubscribeTasks?.();
      unsubscribeNotifications?.();
    };
  }, [userProfile]);

  // Okunmamış bildirim sayısı
  const unreadCount = notifications.filter(n => !n.read).length;

  // Bugünün atanmış görevleri
  const todaysAssignedTasks = assignedTasks.filter(task => {
    const today = new Date().toISOString().split('T')[0];
    const taskDate = new Date(task.dueDate).toISOString().split('T')[0];
    return taskDate === today && task.status === 'bekliyor';
  });

  return {
    // State
    assignedTasks,
    todaysAssignedTasks,
    notifications,
    unreadCount,
    loading,
    error,
    userProfile,

    // Actions
    assignTask,
    updateTaskStatus,
    markAsRead,

    // Helpers
    isParent: userProfile?.role === UserRole.Parent,
    isChild: userProfile?.role === UserRole.Child,
    familyId: userProfile?.familyId
  };
};