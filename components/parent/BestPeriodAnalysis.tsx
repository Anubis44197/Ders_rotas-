import React, { useMemo } from 'react';
import { Task } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Clock, Loader } from '../icons';
import EmptyState from '../shared/EmptyState';

interface BestPeriodAnalysisProps {
  tasks: Task[];
  loading?: boolean;
  error?: string | null;
}

const WEEKDAYS = ['Pazar', 'Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma', 'Cumartesi'];
const HOURS = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, '0')}:00`);

const LoadingSpinner: React.FC = () => (
  <div className="flex h-48 items-center justify-center">
    <Loader className="h-8 w-8 animate-spin text-primary-600" />
    <span className="ml-2 text-slate-600">Veriler yukleniyor...</span>
  </div>
);

const ErrorState: React.FC<{ error: string }> = ({ error }) => (
  <div className="flex h-48 flex-col items-center justify-center text-center">
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
      <span className="text-xl text-red-500">!</span>
    </div>
    <p className="mb-2 text-slate-600">Veriler yuklenirken bir sorun olustu.</p>
    <p className="text-sm text-slate-500">{error}</p>
  </div>
);

const BestPeriodAnalysis: React.FC<BestPeriodAnalysisProps> = ({ tasks, loading = false, error = null }) => {
  const completed = useMemo(
    () => tasks.filter((task) => task.status === 'tamamland\u0131' && typeof task.successScore === 'number' && (task.completionTimestamp || task.completionDate)),
    [tasks],
  );

  const weekdayData = useMemo(() => {
    const stats = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
    completed.forEach((task) => {
      const date = new Date(task.completionTimestamp || task.completionDate!);
      const day = date.getDay();
      stats[day].total += task.successScore || 0;
      stats[day].count += 1;
    });

    return WEEKDAYS.map((day, index) => ({
      day,
      score: stats[index].count ? Math.round(stats[index].total / stats[index].count) : 0,
      count: stats[index].count,
    }));
  }, [completed]);

  const hourData = useMemo(() => {
    const stats = Array.from({ length: 24 }, () => ({ total: 0, count: 0 }));
    completed.forEach((task) => {
      const date = new Date(task.completionTimestamp || task.completionDate!);
      const hour = date.getHours();
      stats[hour].total += task.successScore || 0;
      stats[hour].count += 1;
    });

    return HOURS.map((hour, index) => ({
      hour,
      score: stats[index].count ? Math.round(stats[index].total / stats[index].count) : 0,
      count: stats[index].count,
    }));
  }, [completed]);

  const bestDay = [...weekdayData].sort((a, b) => b.score - a.score)[0];
  const bestHour = [...hourData].sort((a, b) => b.score - a.score)[0];

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center text-xl font-bold"><Clock className="mr-2 h-6 w-6 text-primary-600" />En verimli zaman</h3>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center text-xl font-bold"><Clock className="mr-2 h-6 w-6 text-primary-600" />En verimli zaman</h3>
        <ErrorState error={error} />
      </div>
    );
  }

  if (!completed.length) {
    return <EmptyState icon={<Clock className="h-8 w-8 text-slate-400" />} title="Verimli zaman analizi icin veri yok" message="Tamamlanan gorevler geldikce hangi gun ve saatlerde daha verimli olundugu burada gorunecek." />;
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="flex items-center text-xl font-bold"><Clock className="mr-2 h-6 w-6 text-primary-600" />En verimli zaman</h3>
          <p className="text-sm text-slate-500">Tamamlanan gorevlerde skor ortalamasi hangi gun ve saatlerde yukseliyor.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">En guclu gun: <strong>{bestDay?.day || '-'}</strong></div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">En guclu saat: <strong>{bestHour?.hour || '-'}</strong></div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <h4 className="mb-2 font-semibold text-slate-800">Gun bazli skor</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekdayData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" fontSize={12} />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Bar dataKey="score" name="Skor" fill="#2563eb" radius={[8, 8, 0, 0]} />
              <Bar dataKey="count" name="Gorev" fill="#f59e0b" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h4 className="mb-2 font-semibold text-slate-800">Saat bazli skor</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" fontSize={12} interval={2} />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Bar dataKey="score" name="Skor" fill="#10b981" radius={[8, 8, 0, 0]} />
              <Bar dataKey="count" name="Gorev" fill="#f59e0b" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default BestPeriodAnalysis;
