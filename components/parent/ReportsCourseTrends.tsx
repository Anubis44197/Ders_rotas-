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

function aggregateCoursePerformance(tasks: Task[], courses: Course[], timeFilter: TimeFilterValue) {
  const { startDate, endDate } = timeFilter;

  const completed = tasks.filter((task) => {
    if (task.status !== 'tamamland\u0131' || !(task.completionDate || task.dueDate)) return false;
    const analysisDate = new Date(task.completionDate || task.dueDate!);
    if (startDate && analysisDate < new Date(startDate)) return false;
    if (endDate && analysisDate > new Date(endDate)) return false;
    return typeof task.successScore === 'number' || typeof task.focusScore === 'number';
  });

  const result: Record<string, Record<string, { success: number; focus: number; count: number }>> = {};

  completed.forEach((task) => {
    const analysisDate = new Date(task.completionDate || task.dueDate!);
    const period = format(analysisDate, 'yyyy-MM');
    if (!task.courseId) return;

    result[task.courseId] ??= {};
    result[task.courseId][period] ??= { success: 0, focus: 0, count: 0 };
    result[task.courseId][period].success += task.successScore || 0;
    result[task.courseId][period].focus += task.focusScore || 0;
    result[task.courseId][period].count += 1;
  });

  const output: Record<string, { period: string; successScore: number; focusScore: number; courseName: string }[]> = {};

  Object.entries(result).forEach(([courseId, periods]) => {
    const courseName = courses.find((course) => course.id === courseId)?.name || courseId;
    output[courseId] = Object.entries(periods)
      .map(([period, value]) => ({
        period,
        successScore: Math.round(value.success / value.count),
        focusScore: Math.round(value.focus / value.count),
        courseName,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  });

  return output;
}

const ReportsCourseTrends: React.FC<Props> = ({ tasks, courses, timeFilter }) => {
  const dataByCourse = React.useMemo(() => aggregateCoursePerformance(tasks, courses, timeFilter), [tasks, courses, timeFilter]);

  return (
    <div className="space-y-8">
      {courses.map((course) => (
        <CoursePerformanceTrendChart key={course.id} data={dataByCourse[course.id] || []} courseName={course.name} />
      ))}
    </div>
  );
};

export default ReportsCourseTrends;
