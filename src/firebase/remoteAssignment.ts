import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, onSnapshot, query, where, orderBy, writeBatch } from 'firebase/firestore';
import { db } from './config';
import { Task } from '../../types';
import { UserProfile, UserRole } from './auth';

// Uzaktan görev atama koleksiyonu
const remoteTasksRef = collection(db, 'remoteTasks');
const assignedTasksRef = collection(db, 'assignedTasks');
const taskNotificationsRef = collection(db, 'taskNotifications');

// Bildirim tipi
export interface TaskNotification {
  id: string;
  type: 'task_assigned' | 'task_completed' | 'task_updated';
  fromUser: string; // Gönderen kullanıcı ID
  toUser: string; // Alıcı kullanıcı ID
  familyId: string;
  taskId: string;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  data?: Record<string, any>;
}

// Parent'tan Child'a görev atama
export const assignTaskToChild = async (
  task: Omit<Task, 'id' | 'assignedTo'>, 
  parentProfile: UserProfile,
  childId?: string
): Promise<string> => {
  try {
    if (parentProfile.role !== UserRole.Parent) {
      throw new Error('Sadece ebeveynler görev atayabilir');
    }

    // Görev verisini hazırla
    const assignedTask: Omit<Task, 'id'> & { assignedBy: string; familyId: string; assignedAt: number } = {
      ...task,
      assignedTo: childId || 'child', // Default child ID
      assignedBy: parentProfile.uid,
      familyId: parentProfile.familyId,
      assignedAt: Date.now(),
      status: 'bekliyor'
    };

    // Firebase'e görev ekle
    const docRef = await addDoc(assignedTasksRef, assignedTask);

    // Child'a bildirim gönder
    const notification: Omit<TaskNotification, 'id'> = {
      type: 'task_assigned',
      fromUser: parentProfile.uid,
      toUser: childId || 'child',
      familyId: parentProfile.familyId,
      taskId: docRef.id,
      title: 'Yeni Görev Atandı',
      message: `"${task.title}" görevi sana atandı`,
      timestamp: Date.now(),
      read: false,
      data: {
        taskType: task.taskType,
        dueDate: task.dueDate,
        plannedDuration: task.plannedDuration
      }
    };

    await addDoc(taskNotificationsRef, notification);

    return docRef.id;
  } catch (error) {
    console.error('Görev atama hatası:', error);
    throw error;
  }
};

// Child için atanmış görevleri getir
export const getAssignedTasksForChild = async (childId: string, familyId: string): Promise<Task[]> => {
  try {
    const q = query(
      assignedTasksRef, 
      where('assignedTo', '==', childId),
      where('familyId', '==', familyId),
      orderBy('assignedAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ 
      ...doc.data(), 
      id: doc.id 
    } as Task));
  } catch (error) {
    console.error('Atanmış görevleri getirme hatası:', error);
    throw error;
  }
};

// Görev durumunu güncelle (Child tarafından)
export const updateAssignedTaskStatus = async (
  taskId: string, 
  updates: Partial<Task>,
  childProfile: UserProfile
): Promise<void> => {
  try {
    if (childProfile.role !== UserRole.Child) {
      throw new Error('Sadece çocuklar görev durumunu güncelleyebilir');
    }

    const taskDoc = doc(db, 'assignedTasks', taskId);
    await updateDoc(taskDoc, {
      ...updates,
      updatedAt: Date.now(),
      updatedBy: childProfile.uid
    });

    // Eğer görev tamamlandıysa parent'a bildirim gönder
    if (updates.status === 'tamamlandı') {
      // Parent ID'sini bul
      const taskSnapshot = await getDocs(query(assignedTasksRef, where('id', '==', taskId)));
      if (!taskSnapshot.empty) {
        const taskData = taskSnapshot.docs[0].data();
        
        const notification: Omit<TaskNotification, 'id'> = {
          type: 'task_completed',
          fromUser: childProfile.uid,
          toUser: taskData.assignedBy,
          familyId: childProfile.familyId,
          taskId: taskId,
          title: 'Görev Tamamlandı',
          message: `"${taskData.title}" görevi tamamlandı`,
          timestamp: Date.now(),
          read: false,
          data: {
            successScore: updates.successScore,
            focusScore: updates.focusScore,
            pointsAwarded: updates.pointsAwarded
          }
        };

        await addDoc(taskNotificationsRef, notification);
      }
    }
  } catch (error) {
    console.error('Görev durumu güncelleme hatası:', error);
    throw error;
  }
};

// Bildirimleri getir
export const getNotificationsForUser = async (userId: string, familyId: string): Promise<TaskNotification[]> => {
  try {
    const q = query(
      taskNotificationsRef,
      where('toUser', '==', userId),
      where('familyId', '==', familyId),
      orderBy('timestamp', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ 
      ...doc.data(), 
      id: doc.id 
    } as TaskNotification));
  } catch (error) {
    console.error('Bildirimleri getirme hatası:', error);
    throw error;
  }
};

// Bildirimi okundu olarak işaretle
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    const notificationDoc = doc(db, 'taskNotifications', notificationId);
    await updateDoc(notificationDoc, {
      read: true,
      readAt: Date.now()
    });
  } catch (error) {
    console.error('Bildirim okundu işaretleme hatası:', error);
    throw error;
  }
};

// Gerçek zamanlı atanmış görevleri dinle
export const listenToAssignedTasks = (
  childId: string, 
  familyId: string, 
  callback: (tasks: Task[]) => void
) => {
  const q = query(
    assignedTasksRef,
    where('assignedTo', '==', childId),
    where('familyId', '==', familyId),
    orderBy('assignedAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({ 
      ...doc.data(), 
      id: doc.id 
    } as Task));
    callback(tasks);
  });
};

// Gerçek zamanlı bildirimleri dinle
export const listenToNotifications = (
  userId: string, 
  familyId: string, 
  callback: (notifications: TaskNotification[]) => void
) => {
  const q = query(
    taskNotificationsRef,
    where('toUser', '==', userId),
    where('familyId', '==', familyId),
    orderBy('timestamp', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({ 
      ...doc.data(), 
      id: doc.id 
    } as TaskNotification));
    callback(notifications);
  });
};

// Batch işlemler için yardımcı fonksiyon
export const batchUpdateTasks = async (updates: { taskId: string; data: Partial<Task> }[]): Promise<void> => {
  try {
    const batch = writeBatch(db);
    
    updates.forEach(({ taskId, data }) => {
      const taskDoc = doc(db, 'assignedTasks', taskId);
      batch.update(taskDoc, { ...data, updatedAt: Date.now() });
    });
    
    await batch.commit();
  } catch (error) {
    console.error('Batch güncelleme hatası:', error);
    throw error;
  }
};