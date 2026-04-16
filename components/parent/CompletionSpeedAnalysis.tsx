import React, { useMemo } from 'react';
import { Task } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Brush } from 'recharts';
import { Zap, Loader } from '../icons';
import EmptyState from '../shared/EmptyState';

interface CompletionSpeedAnalysisProps {
  tasks: Task[];
  loading?: boolean;
  error?: string | null;
}

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

const CompletionSpeedAnalysis: React.FC<CompletionSpeedAnalysisProps> = ({ tasks, loading = false, error = null }) => {
  const completed = useMemo(
    () => tasks.filter((task) => task.status === 'tamamland\u0131' && typeof task.plannedDuration === 'number' && typeof task.actualDuration === 'number'),
    [tasks],
  );

  const data = useMemo(() => {
    return [...completed]
      .sort((a, b) => new Date(a.completionTimestamp || a.completionDate || a.dueDate).getTime() - new Date(b.completionTimestamp || b.completionDate || b.dueDate).getTime())
      .slice(-20)
      .map((task) => {
        const actualMinutes = Math.round((task.actualDuration || 0) / 60);
        return {
          title: task.title.length > 20 ? `${task.title.slice(0, 17)}...` : task.title,
          planned: task.plannedDuration,
          actual: actualMinutes,
          efficiency: task.plannedDuration > 0 ? Math.round((task.plannedDuration / Math.max(actualMinutes, 1)) * 100) : 0,
        };
      });
  }, [completed]);

  const averagePlanned = data.length ? Math.round(data.reduce((sum, item) => sum + item.planned, 0) / data.length) : 0;
  const averageActual = data.length ? Math.round(data.reduce((sum, item) => sum + item.actual, 0) / data.length) : 0;
  const averageEfficiency = data.length ? Math.round(data.reduce((sum, item) => sum + item.efficiency, 0) / data.length) : 0;

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center text-xl font-bold"><Zap className="mr-2 h-6 w-6 text-primary-600" />Tamamlanma hizi</h3>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center text-xl font-bold"><Zap className="mr-2 h-6 w-6 text-primary-600" />Tamamlanma hizi</h3>
        <ErrorState error={error} />
      </div>
    );
  }

  if (!completed.length) {
    return <EmptyState icon={<Zap className="h-8 w-8 text-slate-400" />} title="Tamamlanma hizi analizi icin veri yok" message="Planlanan ve gercek sure karsilastirmasi tamamlanan gorevler geldikce burada gorunecek." />;
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="flex items-center text-xl font-bold"><Zap className="mr-2 h-6 w-6 text-primary-600" />Tamamlanma hizi</h3>
          <p className="text-sm text-slate-500">Son 20 tamamlanan gorevde planlanan sure ile gercek sure farki.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Ort. plan: <strong>{averagePlanned} dk</strong></div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Ort. gercek: <strong>{averageActual} dk</strong></div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Verim: <strong>{averageEfficiency}</strong></div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: data.length > 8 ? 75 : 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="title" fontSize={12} interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis label={{ value: 'dk', angle: -90, position: 'insideLeft', offset: 10 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="planned" name="Planlanan sure" fill="#2563eb" radius={[8, 8, 0, 0]} />
          <Bar dataKey="actual" name="Gercek sure" fill="#f59e0b" radius={[8, 8, 0, 0]} />
          {data.length > 8 && <Brush dataKey="title" height={28} stroke="#94a3b8" fill="#f8fafc" />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CompletionSpeedAnalysis;
