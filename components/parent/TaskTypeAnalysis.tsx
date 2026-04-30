import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Task } from '../../types';
import { Info, Loader } from '../icons';
import EmptyState from '../shared/EmptyState';
import { ChartTooltip, chartAxisProps, chartGridProps, chartLegendProps, chartPalette } from '../shared/chartDesign';

interface Props {
  tasks: Task[];
  loading?: boolean;
  error?: string | null;
}

type Period = 'Gunluk' | 'Haftalik' | 'Aylik';

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

const taskTypeLabels: Record<Task['taskType'], string> = {
  'soru \u00e7\u00f6zme': 'Soru cozme',
  'ders \u00e7al\u0131\u015fma': 'Ders calismasi',
  'kitap okuma': 'Kitap okuma',
};

function getPeriodKey(date: string, period: Period) {
  const current = new Date(date);
  if (period === 'Gunluk') return current.toISOString().slice(0, 10);
  if (period === 'Haftalik') {
    const firstDay = new Date(current.getFullYear(), 0, 1);
    const days = Math.floor((current.getTime() - firstDay.getTime()) / 86400000);
    return `${current.getFullYear()}-H${Math.ceil((days + firstDay.getDay() + 1) / 7)}`;
  }
  return `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
}

const TaskTypeAnalysis: React.FC<Props> = ({ tasks, loading = false, error = null }) => {
  const [period, setPeriod] = useState<Period>('Haftalik');

  const data = useMemo(() => {
    const completed = tasks.filter((task) => task.status === 'tamamland\u0131' && task.completionDate && typeof task.successScore === 'number' && typeof task.actualDuration === 'number');
    const grouped: Record<string, Record<Task['taskType'], { totalScore: number; totalDuration: number; count: number }>> = {} as Record<string, Record<Task['taskType'], { totalScore: number; totalDuration: number; count: number }>>;

    completed.forEach((task) => {
      const periodKey = getPeriodKey(task.completionDate!, period);
      grouped[periodKey] ??= {} as Record<Task['taskType'], { totalScore: number; totalDuration: number; count: number }>;
      grouped[periodKey][task.taskType] ??= { totalScore: 0, totalDuration: 0, count: 0 };
      grouped[periodKey][task.taskType].totalScore += task.successScore || 0;
      grouped[periodKey][task.taskType].totalDuration += task.actualDuration || 0;
      grouped[periodKey][task.taskType].count += 1;
    });

    const latestPeriod = Object.keys(grouped).sort().pop();
    if (!latestPeriod) return [];

    return (Object.keys(taskTypeLabels) as Task['taskType'][]).map((taskType) => {
      const entry = grouped[latestPeriod][taskType];
      return {
        taskType: taskTypeLabels[taskType],
        avgScore: entry ? Math.round(entry.totalScore / entry.count) : 0,
        avgDuration: entry ? Math.round(entry.totalDuration / entry.count / 60) : 0,
        count: entry?.count || 0,
      };
    });
  }, [tasks, period]);

  const bestType = [...data].sort((a, b) => b.avgScore - a.avgScore)[0];
  const totalCompleted = data.reduce((sum, item) => sum + item.count, 0);

  if (loading) {
    return (
      <div className="ios-card mb-6 rounded-[28px] p-6">
        <h4 className="mb-4 text-lg font-bold">Gorev turu analizi</h4>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="ios-card mb-6 rounded-[28px] p-6">
        <h4 className="mb-4 text-lg font-bold">Gorev turu analizi</h4>
        <ErrorState error={error} />
      </div>
    );
  }

  if (data.every((item) => item.count === 0)) {
    return <EmptyState icon={<Info className="h-6 w-6" />} title="Gorev turu analizi icin veri yok" message="Tamamlanan gorevler geldikce hangi gorev tipinde daha verimli calisildigi burada gorunecek." />;
  }

  return (
    <div className="ios-card mb-6 rounded-[28px] p-6">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h4 className="text-lg font-bold text-slate-900">Gorev turu analizi</h4>
          <p className="text-sm text-slate-500">Son secili periyotta gorev tiplerinin skor ve sure karsilastirmasi.</p>
        </div>
        <div className="flex gap-2">
          {(['Gunluk', 'Haftalik', 'Aylik'] as Period[]).map((value) => (
            <button key={value} onClick={() => setPeriod(value)} className={`ios-button rounded-full px-3 py-2 text-xs font-bold ${period === value ? 'ios-button-active' : 'text-slate-600'}`}>
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="ios-widget rounded-2xl p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">En guclu tip</div>
          <div className="mt-2 text-lg font-bold text-slate-900">{bestType?.taskType || '-'}</div>
        </div>
        <div className="ios-widget rounded-2xl p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Toplam tamamlanan</div>
          <div className="mt-2 text-lg font-bold text-slate-900">{totalCompleted}</div>
        </div>
        <div className="ios-widget rounded-2xl p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">En yuksek skor</div>
          <div className="mt-2 text-lg font-bold text-slate-900">{bestType?.avgScore || 0}</div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid {...chartGridProps} />
          <XAxis dataKey="taskType" {...chartAxisProps} />
          <YAxis yAxisId="left" label={{ value: 'Skor', angle: -90, position: 'insideLeft' }} {...chartAxisProps} />
          <YAxis yAxisId="right" orientation="right" label={{ value: 'Sure (dk)', angle: 90, position: 'insideRight' }} {...chartAxisProps} />
          <Tooltip content={<ChartTooltip valueFormatter={(value, name) => name.includes('sure') ? `${value} dk` : `${value} puan`} />} />
          <Legend {...chartLegendProps} />
          <Bar yAxisId="left" dataKey="avgScore" name="Ortalama skor" fill={chartPalette.blue} radius={[10, 10, 0, 0]} />
          <Bar yAxisId="right" dataKey="avgDuration" name="Ortalama sure" fill={chartPalette.mint} radius={[10, 10, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TaskTypeAnalysis;
