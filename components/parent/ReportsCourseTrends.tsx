import React from 'react';
import { format } from 'date-fns';
import CoursePerformanceTrendChart from './CoursePerformanceTrendChart';
import { Task, Course } from '../../types';
import { type TimeFilterValue } from '../shared/TimeRangeFilter';

interface Props {
  tasks: Task[];
  courses: Course[];
  timeFilter: TimeFilterValue;
}

// Yardımcı: Görevleri seçilen tarih aralığına göre böler ve başarı/odak puanlarını toplar
function aggregateCoursePerformance(tasks: Task[], courses: Course[], timeFilter: TimeFilterValue) {
  const { startDate, endDate } = timeFilter;

  // Sadece tamamlanmış ve tarih aralığındaki görevler
  const completed = tasks.filter(t => {
    if (t.status !== 'tamamlandı' || !(t.completionDate || t.dueDate)) return false;
    const analysisDate = new Date(t.completionDate || t.dueDate!);
    return startDate && endDate && analysisDate >= new Date(startDate) && analysisDate <= new Date(endDate);
  });

  const getGroupKey = (date: Date) => {
    // Varsayılan olarak aylık gruplama kullanıyoruz
    return format(date, 'yyyy-MM'); // Yıl-Ay
  };

  // courseId -> period -> { successScore, focusScore, count }
  const result: Record<string, Record<string, { successScore: number, focusScore: number, count: number }>> = {};
  
  completed.forEach(t => {
    const analysisDate = new Date(t.completionDate || t.dueDate!);
    if (!t.courseId || t.successScore == null || t.focusScore == null) return;
    
    const p = getGroupKey(analysisDate);
    
    if (!result[t.courseId]) result[t.courseId] = {};
    if (!result[t.courseId][p]) result[t.courseId][p] = { successScore: 0, focusScore: 0, count: 0 };
    
    result[t.courseId][p].successScore += t.successScore;
    result[t.courseId][p].focusScore += t.focusScore;
    result[t.courseId][p].count++;
  });

  // courseId -> [{ period, successScore, focusScore }]
  const out: Record<string, { period: string, successScore: number, focusScore: number, courseName: string }[]> = {};
  
  Object.entries(result).forEach(([courseId, periods]) => {
    const course = courses.find(c => c.id === courseId);
    const courseName = course ? course.name : courseId;
    
    out[courseId] = Object.entries(periods).map(([period, vals]) => ({
      period,
      successScore: Math.round(vals.successScore / vals.count),
      focusScore: Math.round(vals.focusScore / vals.count),
      courseName
    })).sort((a,b) => a.period.localeCompare(b.period));
  });
  
  return out;
}

const ReportsCourseTrends: React.FC<Props> = ({ tasks, courses, timeFilter }) => {
  const dataByCourse = React.useMemo(() => aggregateCoursePerformance(tasks, courses, timeFilter), [tasks, courses, timeFilter]);
  
  return (
    <div className="space-y-8">
      {courses.map(course => (
        <CoursePerformanceTrendChart
          key={course.id}
          data={dataByCourse[course.id] || []}
          courseName={course.name}
        />
      ))}
    </div>
  );
};

export default ReportsCourseTrends;
