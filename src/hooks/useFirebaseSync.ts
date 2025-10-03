// Firebase ile veri senkronizasyonu için custom hook'lar
import { useState, useEffect, useCallback } from 'react';
import { 
  getCoursesFromFirebase, 
  getTasksFromFirebase, 
  getPerformanceFromFirebase,
  getRewardsFromFirebase,
  getBadgesFromFirebase,
  addCourseToFirebase,
  addTaskToFirebase,
  addRewardToFirebase,
  updateTaskInFirebase,
  deleteCourseFromFirebase,
  deleteTaskFromFirebase,
  deleteRewardFromFirebase,
  listenToCourses,
  listenToTasks,
  listenToRewards,
  listenToPerformance
} from '../firebase/firestore';
import { checkFirebaseConnection } from '../firebase/config';
import { Course, Task, PerformanceData, Reward, Badge } from '../../types';

// Firebase ile senkronize edilmiş state yönetimi
export const useFirebaseSync = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // İlk veri yükleme
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        
        // Önce Firebase bağlantısını kontrol et
        const isConnected = await checkFirebaseConnection();
        
        if (!isConnected) {
          setIsOfflineMode(true);
          setError('Firebase bağlantısı kurulamadı. Offline modda çalışıyorsunuz.');
          console.warn('Firebase offline mode activated');
          setLoading(false);
          return;
        }

        const [coursesData, tasksData, performanceDataRes, rewardsData, badgesData] = await Promise.all([
          getCoursesFromFirebase(),
          getTasksFromFirebase(),
          getPerformanceFromFirebase(),
          getRewardsFromFirebase(),
          getBadgesFromFirebase()
        ]);

        setCourses(coursesData);
        setTasks(tasksData);
        setPerformanceData(performanceDataRes);
        setRewards(rewardsData);
        setBadges(badgesData);
        setIsOfflineMode(false);
        setError(null);
      } catch (err) {
        setIsOfflineMode(true);
        setError('Firebase bağlantısı kurulamadı. Offline modda çalışıyorsunuz.');
        console.error('Firebase veri yükleme hatası:', err);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Gerçek zamanlı dinleyiciler
  useEffect(() => {
    if (loading) return;

    const unsubscribeCourses = listenToCourses(setCourses);
    const unsubscribeTasks = listenToTasks(setTasks);
    const unsubscribeRewards = listenToRewards(setRewards);
    const unsubscribePerformance = listenToPerformance(setPerformanceData);

    return () => {
      unsubscribeCourses();
      unsubscribeTasks();
      unsubscribeRewards();
      unsubscribePerformance();
    };
  }, [loading]);

  // Kurs işlemleri
  const addCourse = useCallback(async (courseName: string) => {
    try {
      const newCourse: Course = {
        id: `course_${Date.now()}`,
        name: courseName,
        icon: 'GraduationCap' // Varsayılan ikon
      };
      
      await addCourseToFirebase(newCourse);
      // Gerçek zamanlı dinleyici otomatik olarak güncelleyecek
    } catch (err) {
      setError('Kurs eklenirken hata oluştu: ' + (err as Error).message);
      throw err;
    }
  }, []);

  const deleteCourse = useCallback(async (courseId: string) => {
    try {
      await deleteCourseFromFirebase(courseId);
      // İlgili görevleri ve performans verilerini de sil
      const courseTasks = tasks.filter(t => t.courseId === courseId);
      await Promise.all(courseTasks.map(task => deleteTaskFromFirebase(task.id)));
    } catch (err) {
      setError('Kurs silinirken hata oluştu: ' + (err as Error).message);
      throw err;
    }
  }, [tasks]);

  // Görev işlemleri
  const addTask = useCallback(async (task: Omit<Task, 'id' | 'status'>) => {
    try {
      const newTask: Task = {
        ...task,
        id: `task_${Date.now()}`,
        status: 'bekliyor',
        createdAt: new Date().toISOString()
      };
      
      await addTaskToFirebase(newTask);
      return newTask;
    } catch (err) {
      setError('Görev eklenirken hata oluştu: ' + (err as Error).message);
      throw err;
    }
  }, []);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    try {
      await updateTaskInFirebase(taskId, updates);
    } catch (err) {
      setError('Görev güncellenirken hata oluştu: ' + (err as Error).message);
      throw err;
    }
  }, []);

  const deleteTask = useCallback(async (taskId: string) => {
    try {
      await deleteTaskFromFirebase(taskId);
    } catch (err) {
      setError('Görev silinirken hata oluştu: ' + (err as Error).message);
      throw err;
    }
  }, []);

  // Ödül işlemleri
  const addReward = useCallback(async (reward: Omit<Reward, 'id'>) => {
    try {
      // Firebase için veri temizliği - undefined ve function değerleri temizle
      const cleanReward = {
        name: reward.name,
        cost: reward.cost,
        icon: typeof reward.icon === 'string' ? reward.icon : 'Gift'
      };
      
      const newReward: Reward = {
        ...cleanReward,
        id: `reward_${Date.now()}`
      };
      
      await addRewardToFirebase(newReward);
    } catch (err) {
      console.error('Ödül ekleme detaylı hatası:', err, 'Gönderilen veri:', reward);
      setError('Ödül eklenirken hata oluştu: ' + (err as Error).message);
      throw err;
    }
  }, []);

  const deleteReward = useCallback(async (rewardId: string) => {
    try {
      await deleteRewardFromFirebase(rewardId);
    } catch (err) {
      setError('Ödül silinirken hata oluştu: ' + (err as Error).message);
      throw err;
    }
  }, []);

  return {
    // State
    courses,
    tasks,
    performanceData,
    rewards,
    badges,
    loading,
    error,
    isOfflineMode,
    
    // Actions
    addCourse,
    deleteCourse,
    addTask,
    updateTask,
    deleteTask,
    addReward,
    deleteReward,
    
    // Utility
    clearError: () => setError(null)
  };
};