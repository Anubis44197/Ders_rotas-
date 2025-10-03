import { useMemo, useCallback, useState, useEffect } from 'react';
import { Task, Course } from '../types';

// 🚀 Performance Optimization Utilities
// Bu dosya veri işleme performansını artırmak için memoization ve optimizasyon araçları sağlar

/**
 * Görev verilerini performanslı bir şekilde filtreler ve önbelleğe alır
 */
export const useOptimizedTaskFilter = (
  tasks: Task[],
  filters: {
    status?: string;
    courseId?: string;
    timePeriod?: 'day' | 'week' | 'month' | 'year' | 'all';
    startDate?: Date;
    endDate?: Date;
  }
) => {
  return useMemo(() => {
    let filtered = [...tasks];

    // Status filtresi
    if (filters.status) {
      filtered = filtered.filter(task => task.status === filters.status);
    }

    // Course filtresi
    if (filters.courseId) {
      filtered = filtered.filter(task => task.courseId === filters.courseId);
    }

    // Zaman filtresi
    if (filters.timePeriod && filters.timePeriod !== 'all') {
      const now = new Date();
      let cutoffDate: Date;

      switch (filters.timePeriod) {
        case 'day':
          cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          cutoffDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          cutoffDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          cutoffDate = new Date(0);
      }

      filtered = filtered.filter(task => {
        const taskDate = task.completionTimestamp ? new Date(task.completionTimestamp) : new Date(task.createdAt || Date.now());
        return taskDate >= cutoffDate;
      });
    }

    // Özel tarih aralığı filtresi
    if (filters.startDate && filters.endDate) {
      filtered = filtered.filter(task => {
        const taskDate = task.completionTimestamp ? new Date(task.completionTimestamp) : new Date(task.createdAt || Date.now());
        return taskDate >= filters.startDate! && taskDate <= filters.endDate!;
      });
    }

    return filtered;
  }, [tasks, filters.status, filters.courseId, filters.timePeriod, filters.startDate, filters.endDate]);
};

/**
 * Ders bazında performans verilerini optimize eder
 */
export const useOptimizedCoursePerformance = (tasks: Task[], courses: Course[]) => {
  return useMemo(() => {
    const courseMap = new Map(courses.map(course => [course.id, course]));
    const completedTasks = tasks.filter(task => 
      task.status === 'tamamlandı' && 
      typeof task.successScore === 'number'
    );

    const performanceData = new Map<string, {
      totalScore: number;
      totalTasks: number;
      totalDuration: number;
      courseName: string;
    }>();

    completedTasks.forEach(task => {
      const course = courseMap.get(task.courseId);
      if (!course) return;

      const existing = performanceData.get(task.courseId) || {
        totalScore: 0,
        totalTasks: 0,
        totalDuration: 0,
        courseName: course.name
      };

      existing.totalScore += task.successScore!;
      existing.totalTasks += 1;
      existing.totalDuration += task.actualDuration || 0;

      performanceData.set(task.courseId, existing);
    });

    return Array.from(performanceData.entries()).map(([courseId, data]) => ({
      courseId,
      courseName: data.courseName,
      averageScore: Math.round(data.totalScore / data.totalTasks),
      totalTasks: data.totalTasks,
      totalDuration: Math.round(data.totalDuration / 60), // dakika
      averageDuration: Math.round(data.totalDuration / data.totalTasks / 60) // dakika
    }));
  }, [tasks, courses]);
};

/**
 * Büyük veri setleri için sayfalama desteği
 */
export const usePaginatedData = <T,>(data: T[], pageSize: number = 20) => {
  const [currentPage, setCurrentPage] = useState(1);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, pageSize]);

  const totalPages = Math.ceil(data.length / pageSize);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  return {
    data: paginatedData,
    currentPage,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
    goToPage,
    nextPage,
    prevPage
  };
};

/**
 * Veri toplama işlemlerini optimize eden hook
 */
export const useOptimizedDataAggregation = (tasks: Task[]) => {
  return useMemo(() => {
    const completedTasks = tasks.filter(task => task.status === 'tamamlandı');
    
    // Günlük başarı ortalamaları
    const dailySuccess = new Map<string, { totalScore: number; count: number }>();
    
    // Haftalık verimlilik
    const weeklyProductivity = new Map<number, { totalTasks: number; totalScore: number }>();
    
    // Görev türü analizi
    const taskTypeAnalysis = new Map<string, { count: number; avgScore: number; totalScore: number }>();

    completedTasks.forEach(task => {
      const completionDate = task.completionTimestamp ? new Date(task.completionTimestamp) : new Date();
      const dateKey = completionDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const weekDay = completionDate.getDay(); // 0-6
      
      // Günlük analiz
      if (typeof task.successScore === 'number') {
        const daily = dailySuccess.get(dateKey) || { totalScore: 0, count: 0 };
        daily.totalScore += task.successScore;
        daily.count += 1;
        dailySuccess.set(dateKey, daily);
      }

      // Haftalık analiz
      if (typeof task.successScore === 'number') {
        const weekly = weeklyProductivity.get(weekDay) || { totalTasks: 0, totalScore: 0 };
        weekly.totalTasks += 1;
        weekly.totalScore += task.successScore;
        weeklyProductivity.set(weekDay, weekly);
      }

      // Görev türü analizi
      if (typeof task.successScore === 'number' && task.taskType) {
        const typeAnalysis = taskTypeAnalysis.get(task.taskType) || { count: 0, avgScore: 0, totalScore: 0 };
        typeAnalysis.count += 1;
        typeAnalysis.totalScore += task.successScore;
        typeAnalysis.avgScore = typeAnalysis.totalScore / typeAnalysis.count;
        taskTypeAnalysis.set(task.taskType, typeAnalysis);
      }
    });

    return {
      dailySuccess: Array.from(dailySuccess.entries()).map(([date, data]) => ({
        date,
        averageScore: Math.round(data.totalScore / data.count),
        taskCount: data.count
      })),
      weeklyProductivity: Array.from(weeklyProductivity.entries()).map(([day, data]) => ({
        day,
        averageScore: Math.round(data.totalScore / data.totalTasks),
        taskCount: data.totalTasks
      })),
      taskTypeAnalysis: Array.from(taskTypeAnalysis.entries()).map(([type, data]) => ({
        type,
        count: data.count,
        averageScore: Math.round(data.avgScore)
      }))
    };
  }, [tasks]);
};

/**
 * Performans göstergeleri için debounced işlem
 */
export const useDebounced = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};