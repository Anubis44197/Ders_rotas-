import React, { useMemo, useState } from 'react';
import CoursePerformanceTrendChart from './CoursePerformanceTrendChart';
import TaskTypeAnalysis from './TaskTypeAnalysis';
import BestPeriodAnalysis from './BestPeriodAnalysis';
import CompletionSpeedAnalysis from './CompletionSpeedAnalysis';
import CourseTimeDistribution from './CourseTimeDistribution';
import { Task, Course, PerformanceData } from '../../types';

interface Props {
  tasks: Task[];
  courses: Course[];
  performanceData: PerformanceData[];
  summary: string;
}

const chartOptions = [
  { key: 'trend', label: 'Performans trendi' },
  { key: 'taskType', label: 'Gorev turu' },
  { key: 'bestPeriod', label: 'Verimli zaman' },
  { key: 'completionSpeed', label: 'Tamamlanma hizi' },
  { key: 'courseTime', label: 'Ders bazli sure' },
] as const;

type ChartKey = typeof chartOptions[number]['key'];

const CustomReportModal: React.FC<Props> = ({ tasks, courses, performanceData, summary }) => {
  const [selectedCharts, setSelectedCharts] = useState<ChartKey[]>(chartOptions.map((option) => option.key));

  const handleToggle = (key: ChartKey) => {
    setSelectedCharts((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const trendData = useMemo(() => {
    const byCourse = new Map<string, Array<{ period: string; successScore: number; focusScore: number; courseName: string }>>();
    performanceData.forEach((item, index) => {
      const key = item.courseName || item.courseId || `ders-${index}`;
      const current = byCourse.get(key) || [];
      current.push({
        period: `Kayit ${current.length + 1}`,
        successScore: item.correct || 0,
        focusScore: item.incorrect || 0,
        courseName: item.courseName,
      });
      byCourse.set(key, current);
    });
    return byCourse;
  }, [performanceData]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Durum raporu</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{summary}</p>
          </div>
          <button className="rounded-full bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200" onClick={() => window.dispatchEvent(new CustomEvent('closeCustomReport'))} aria-label="Kapat">
            Kapat
          </button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {chartOptions.map((option) => {
            const active = selectedCharts.includes(option.key);
            return (
              <button key={option.key} onClick={() => handleToggle(option.key)} className={`rounded-full px-4 py-2 text-sm font-bold ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-8">
          {selectedCharts.includes('trend') && courses.map((course) => (
            <CoursePerformanceTrendChart key={course.id} data={trendData.get(course.name) || []} courseName={course.name} />
          ))}
          {selectedCharts.includes('taskType') && <TaskTypeAnalysis tasks={tasks} />}
          {selectedCharts.includes('bestPeriod') && <BestPeriodAnalysis tasks={tasks} />}
          {selectedCharts.includes('completionSpeed') && <CompletionSpeedAnalysis tasks={tasks} />}
          {selectedCharts.includes('courseTime') && <CourseTimeDistribution tasks={tasks} courses={courses} />}
        </div>
      </div>
    </div>
  );
};

export default CustomReportModal;
