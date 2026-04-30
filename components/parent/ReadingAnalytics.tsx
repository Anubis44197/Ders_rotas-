import React, { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter } from 'recharts';
import { BookOpen, Info } from '../icons';
import { Task } from '../../types';
import { ChartTooltip, chartAxisProps, chartGridProps, chartPalette, chartSeries } from '../shared/chartDesign';

interface ReadingAnalyticsProps {
  tasks: Task[];
}

const COLORS = chartSeries;

const ReadingAnalytics: React.FC<ReadingAnalyticsProps> = ({ tasks }) => {
  const readingTasks = useMemo(
    () => tasks.filter((task) => task.taskType === 'kitap okuma' && task.status === 'tamamland\u0131'),
    [tasks],
  );

  const genreData = useMemo(() => {
    const counts = new Map<string, number>();
    readingTasks.forEach((task) => {
      const key = task.bookGenre || 'Diger';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [...counts.entries()].map(([name, value], index) => ({ name, value, color: COLORS[index % COLORS.length] }));
  }, [readingTasks]);

  const weeklyScores = useMemo(() => {
    const names = ['Paz', 'Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt'];
    const buckets = names.map((day) => ({ day, score: 0, count: 0 }));
    readingTasks.forEach((task) => {
      const date = new Date(task.completionDate || task.dueDate);
      const dayIndex = date.getDay();
      buckets[dayIndex].score += task.successScore || 0;
      buckets[dayIndex].count += 1;
    });
    return buckets.map((item) => ({ day: item.day, score: item.count ? Math.round(item.score / item.count) : 0 }));
  }, [readingTasks]);

  const monthlyData = useMemo(() => {
    const buckets = new Map<string, { books: number; totalPages: number }>();
    readingTasks.forEach((task) => {
      const date = new Date(task.completionDate || task.dueDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const current = buckets.get(key) || { books: 0, totalPages: 0 };
      current.books += 1;
      current.totalPages += task.pagesRead || 0;
      buckets.set(key, current);
    });
    return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({ month, ...value }));
  }, [readingTasks]);

  const durationScoreData = useMemo(
    () => readingTasks.map((task) => ({ duration: Math.round((task.actualDuration || 0) / 60), score: task.successScore || 0 })).filter((item) => item.duration > 0 && item.score > 0),
    [readingTasks],
  );

  const totalPages = readingTasks.reduce((sum, task) => sum + (task.pagesRead || 0), 0);
  const topBook = readingTasks.reduce((acc, task) => {
    const title = task.bookTitle || task.title;
    acc[title] = (acc[title] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const favoriteBook = Object.entries(topBook).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
  const favoriteGenre = genreData.sort((a, b) => b.value - a.value)[0]?.name || '-';

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="ios-widget rounded-[24px] p-6">
          <p className="text-sm font-medium text-gray-600">En Cok Okunan Tur</p>
          <p className="mt-2 text-2xl font-bold text-indigo-600">{favoriteGenre}</p>
        </div>
        <div className="ios-widget rounded-[24px] p-6">
          <p className="text-sm font-medium text-gray-600">En Cok Okunan Kitap</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{favoriteBook}</p>
        </div>
        <div className="ios-widget rounded-[24px] p-6">
          <p className="text-sm font-medium text-gray-600">Toplam Okunan Sayfa</p>
          <p className="mt-2 text-2xl font-bold text-sky-600">{totalPages}</p>
        </div>
      </div>

      <div className="ios-card rounded-[28px] p-6">
        <div className="mb-6 flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900">Haftalik Okuma Skoru</h3>
          <Info className="h-4 w-4 text-slate-400" />
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={weeklyScores}>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="day" {...chartAxisProps} />
            <YAxis {...chartAxisProps} />
            <Tooltip content={<ChartTooltip valueFormatter={(value) => `${value} puan`} />} />
            <Line type="monotone" dataKey="score" name="Okuma skoru" stroke={chartPalette.lilac} strokeWidth={3} dot={{ r: 4, fill: chartPalette.lilac, strokeWidth: 0 }} activeDot={{ r: 7 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <div className="ios-card rounded-[28px] p-6">
          <h3 className="mb-6 text-lg font-semibold text-gray-900">Aylik Okuma Trendi</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyData}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="month" {...chartAxisProps} />
              <YAxis {...chartAxisProps} />
              <Tooltip content={<ChartTooltip valueFormatter={(value) => `${value} kitap`} />} />
              <Bar dataKey="books" name="Kitap" fill={chartPalette.blue} radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="ios-card rounded-[28px] p-6">
          <h3 className="mb-6 text-lg font-semibold text-gray-900">Tur Dagilimi</h3>
          {genreData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={genreData} cx="50%" cy="50%" innerRadius={52} outerRadius={90} dataKey="value">
                  {genreData.map((entry, index) => (
                    <Cell key={`genre-${entry.name}-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip valueFormatter={(value) => `${value} okuma`} />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[260px] flex-col items-center justify-center text-gray-500">
              <BookOpen className="mb-4 h-14 w-14" />
              <p>Heniz kitap verisi yok.</p>
            </div>
          )}
        </div>
      </div>

      <div className="ios-card rounded-[28px] p-6">
        <h3 className="mb-6 text-lg font-semibold text-gray-900">Sure ve Skor Iliskisi</h3>
        <ResponsiveContainer width="100%" height={260}>
          <ScatterChart>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="duration" name="Sure" unit=" dk" {...chartAxisProps} />
            <YAxis dataKey="score" name="Skor" {...chartAxisProps} />
            <Tooltip content={<ChartTooltip valueFormatter={(value, name) => name === 'Skor' ? `${value} puan` : `${value}`} />} cursor={{ stroke: chartPalette.blue, strokeDasharray: '2 8' }} />
            <Scatter name="Okuma" data={durationScoreData} fill={chartPalette.coral} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ReadingAnalytics;

