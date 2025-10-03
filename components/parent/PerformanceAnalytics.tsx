import React from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Task } from '../../types';

interface PerformanceAnalyticsProps {
  tasks: Task[];
}

// Haftalık, aylık, yıllık performans verilerini hesaplayan yardımcı fonksiyonlar
function getWeeklyPerformance(tasks: Task[]) {
  const weekData: { week: string, completed: number, duration: number }[] = [];
  const weekMap: Record<string, { completed: number, duration: number }> = {};
  tasks.forEach(task => {
    if (!task.completionDate) return;
    const date = new Date(task.completionDate);
    const year = date.getFullYear();
    const week = Math.ceil((date.getDate() + 6 - date.getDay()) / 7);
    const key = `${year}-W${week}`;
    if (!weekMap[key]) weekMap[key] = { completed: 0, duration: 0 };
    weekMap[key].completed += 1;
    weekMap[key].duration += task.actualDuration || 0;
  });
  Object.entries(weekMap).forEach(([week, data]) => {
    weekData.push({ week, completed: data.completed, duration: Math.round(data.duration / 60) });
  });
  weekData.sort((a, b) => a.week.localeCompare(b.week));
  return weekData;
}

function getMonthlyPerformance(tasks: Task[]) {
  const monthData: { month: string, completed: number, duration: number }[] = [];
  const monthMap: Record<string, { completed: number, duration: number }> = {};
  tasks.forEach(task => {
    if (!task.completionDate) return;
    const date = new Date(task.completionDate);
    const key = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}`;
    if (!monthMap[key]) monthMap[key] = { completed: 0, duration: 0 };
    monthMap[key].completed += 1;
    monthMap[key].duration += task.actualDuration || 0;
  });
  Object.entries(monthMap).forEach(([month, data]) => {
    monthData.push({ month, completed: data.completed, duration: Math.round(data.duration / 60) });
  });
  monthData.sort((a, b) => a.month.localeCompare(b.month));
  return monthData;
}

function getYearlyPerformance(tasks: Task[]) {
  const yearData: { year: string, completed: number, duration: number }[] = [];
  const yearMap: Record<string, { completed: number, duration: number }> = {};
  tasks.forEach(task => {
    if (!task.completionDate) return;
    const date = new Date(task.completionDate);
    const key = `${date.getFullYear()}`;
    if (!yearMap[key]) yearMap[key] = { completed: 0, duration: 0 };
    yearMap[key].completed += 1;
    yearMap[key].duration += task.actualDuration || 0;
  });
  Object.entries(yearMap).forEach(([year, data]) => {
    yearData.push({ year, completed: data.completed, duration: Math.round(data.duration / 60) });
  });
  yearData.sort((a, b) => a.year.localeCompare(b.year));
  return yearData;
}

// AI özet fonksiyonu (dummy)
function getPerformanceSummary(tasks: Task[]): string {
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'tamamlandı').length;
  const totalDuration = tasks.reduce((sum, t) => sum + (t.actualDuration || 0), 0);
  return `Toplam ${total} görevden ${completed} tanesi tamamlandı. Toplam çalışma süresi: ${Math.round(totalDuration/60)} dakika.`;
}

const PerformanceAnalytics: React.FC<PerformanceAnalyticsProps> = ({ tasks }) => {
  const weeklyData = getWeeklyPerformance(tasks);
  const monthlyData = getMonthlyPerformance(tasks);
  const yearlyData = getYearlyPerformance(tasks);
  const summary = getPerformanceSummary(tasks);

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Performans Özeti (AI)</h3>
        <p className="text-gray-700 text-base">{summary}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Haftalık Performans</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="completed" fill="#6366F1" name="Tamamlanan Görev" />
              <Bar dataKey="duration" fill="#10B981" name="Toplam Süre (dk)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Aylık Performans</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="completed" stroke="#6366F1" strokeWidth={3} name="Tamamlanan Görev" />
              <Line type="monotone" dataKey="duration" stroke="#10B981" strokeWidth={2} name="Toplam Süre (dk)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Yıllık Performans</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={yearlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="completed" stroke="#6366F1" strokeWidth={3} name="Tamamlanan Görev" />
            <Line type="monotone" dataKey="duration" stroke="#10B981" strokeWidth={2} name="Toplam Süre (dk)" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PerformanceAnalytics;
