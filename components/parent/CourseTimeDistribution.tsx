import React, { useMemo } from 'react';
import { Task, Course } from '../../types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BookOpen, Loader } from '../icons';
import EmptyState from '../shared/EmptyState';

interface CourseTimeDistributionProps {
  tasks: Task[];
  courses: Course[];
  loading?: boolean;
  error?: string | null;
}

const COLORS = ['#2563eb', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#f43f5e', '#84cc16'];

const LoadingSpinner: React.FC = () => (
  <div className="flex h-64 items-center justify-center">
    <Loader className="h-8 w-8 animate-spin text-primary-600" />
    <span className="ml-2 text-slate-600">Veriler yukleniyor...</span>
  </div>
);

const ErrorState: React.FC<{ error: string }> = ({ error }) => (
  <div className="flex h-64 flex-col items-center justify-center text-center">
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
      <span className="text-xl text-red-500">!</span>
    </div>
    <p className="mb-2 text-slate-600">Veriler yuklenirken bir sorun olustu.</p>
    <p className="text-sm text-slate-500">{error}</p>
  </div>
);

const CourseTimeDistribution: React.FC<CourseTimeDistributionProps> = ({ tasks, courses, loading = false, error = null }) => {
  const completed = useMemo(() => tasks.filter((task) => task.status === 'tamamland\u0131' && typeof task.actualDuration === 'number'), [tasks]);

  const data = useMemo(() => {
    const totals = new Map<string, number>();
    completed.forEach((task) => {
      totals.set(task.courseId, (totals.get(task.courseId) || 0) + Math.round((task.actualDuration || 0) / 60));
    });

    return courses
      .map((course, index) => ({
        name: course.name,
        value: totals.get(course.id) || 0,
        color: COLORS[index % COLORS.length],
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [completed, courses]);

  const totalMinutes = data.reduce((sum, item) => sum + item.value, 0);
  const topCourse = data[0];

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center text-xl font-bold"><BookOpen className="mr-2 h-6 w-6 text-primary-600" />Ders bazli sure dagilimi</h3>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center text-xl font-bold"><BookOpen className="mr-2 h-6 w-6 text-primary-600" />Ders bazli sure dagilimi</h3>
        <ErrorState error={error} />
      </div>
    );
  }

  if (!data.length) {
    return <EmptyState icon={<BookOpen className="h-8 w-8 text-slate-400" />} title="Ders bazli sure dagilimi icin veri yok" message="Tamamlanan gorevler arttikca hangi derse ne kadar zaman ayrildigi burada gorunecek." />;
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="flex items-center text-xl font-bold"><BookOpen className="mr-2 h-6 w-6 text-primary-600" />Ders bazli sure dagilimi</h3>
          <p className="text-sm text-slate-500">Tamamlanan gorevlerde gercek calisma suresi hangi derslere dagiliyor.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Toplam sure: <strong>{totalMinutes} dk</strong></div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">En yuksek ders: <strong>{topCourse?.name || '-'}</strong></div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={({ name, percent }: any) => `${name}: ${(((percent || 0) * 100)).toFixed(0)}%`}>
            {data.map((entry, index) => (
              <Cell key={`course-${entry.name}-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => `${value} dk`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CourseTimeDistribution;

