import React from 'react';
import CoursePerformanceTrendChart from './CoursePerformanceTrendChart';
import { Task, Course } from '../../types';
import { type TimeFilterValue } from '../shared/TimeRangeFilter';
import { isCompletedTask } from '../../utils/taskStatus';
import { getLocalMonthKey, isDateKeyInRange, parseDate } from '../../utils/dateUtils';

interface Props {
  tasks: Task[];
  courses: Course[];
  timeFilter: TimeFilterValue;
}

function aggregateCoursePerformance(tasks: Task[], courses: Course[], timeFilter: TimeFilterValue) {
  const { startDate, endDate } = timeFilter;

  const completed = tasks.filter((task) => {
    if (!isCompletedTask(task) || !(task.completionDate || task.dueDate)) return false;
    const analysisDateKey = task.completionDate || task.dueDate!;
    if (!isDateKeyInRange(analysisDateKey, startDate, endDate)) return false;
    return typeof task.successScore === 'number' || typeof task.focusScore === 'number';
  });

  const result: Record<string, Record<string, { success: number; focus: number; count: number }>> = {};

  completed.forEach((task) => {
    const analysisDate = parseDate(task.completionDate || task.dueDate!);
    const period = getLocalMonthKey(analysisDate);
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
