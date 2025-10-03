import React, { useState } from 'react';
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
  { key: 'trend', label: 'Performans Trendi', component: CoursePerformanceTrendChart },
  { key: 'taskType', label: 'Görev Türü Analizi', component: TaskTypeAnalysis },
  { key: 'bestPeriod', label: 'En İyi Gün/Saat', component: BestPeriodAnalysis },
  { key: 'completionSpeed', label: 'Tamamlanma Hızı', component: CompletionSpeedAnalysis },
  { key: 'courseTime', label: 'Ders Bazlı Zaman Dağılımı', component: CourseTimeDistribution },
];

const CustomReportModal: React.FC<Props> = ({ tasks, courses, performanceData, summary }) => {
  const [selectedCharts, setSelectedCharts] = useState<string[]>(chartOptions.map(opt => opt.key));

  const handleToggle = (key: string) => {
    setSelectedCharts(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl p-6 relative overflow-y-auto max-h-[90vh]">
        <h2 className="text-2xl font-bold mb-2">Durum Raporu</h2>
        <p className="mb-4 text-gray-700 whitespace-pre-line">{summary}</p>
        <div className="mb-4">
          <span className="font-semibold">Rapor Grafikleri:</span>
          <div className="flex flex-wrap gap-3 mt-2">
            {chartOptions.map(opt => (
              <label key={opt.key} className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCharts.includes(opt.key)}
                  onChange={() => handleToggle(opt.key)}
                  className="accent-primary-500"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-8">
          {selectedCharts.includes('trend') && (
            <CoursePerformanceTrendChart
              data={performanceData.map(p => ({ 
                period: 'Haftalık', 
                successScore: p.correct || 0, 
                focusScore: p.incorrect || 0, 
                courseName: p.courseName 
              }))}
              courseName={courses[0]?.name || ''}
            />
          )}
          {selectedCharts.includes('taskType') && (
            <TaskTypeAnalysis tasks={tasks} />
          )}
          {selectedCharts.includes('bestPeriod') && (
            <BestPeriodAnalysis tasks={tasks} />
          )}
          {selectedCharts.includes('completionSpeed') && (
            <CompletionSpeedAnalysis tasks={tasks} />
          )}
          {selectedCharts.includes('courseTime') && (
            <CourseTimeDistribution tasks={tasks} courses={courses} />
          )}
        </div>
        <button
          className="absolute top-3 right-3 text-gray-500 hover:text-red-600 text-xl"
          onClick={() => window.dispatchEvent(new CustomEvent('closeCustomReport'))}
          aria-label="Kapat"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default CustomReportModal;
