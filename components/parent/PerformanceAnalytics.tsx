import React, { useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Task } from '../../types';
import EmptyState from '../shared/EmptyState';
import { isCompletedTask } from '../../utils/taskStatus';
import { deriveAnalysisSnapshot } from '../../utils/analysisEngine';
import { Info } from '../icons';
import { ChartTooltip, chartAxisProps, chartGridProps, chartPalette } from '../shared/chartDesign';

interface PerformanceAnalyticsProps {
  tasks: Task[];
}

function getWeeklyPerformance(tasks: Task[]) {
  const bucket = new Map<string, { completed: number; duration: number; score: number }>();
  tasks.forEach((task) => {
    if (!isCompletedTask(task) || !task.completionDate) return;
    const date = new Date(task.completionDate);
    const year = date.getFullYear();
    const firstDay = new Date(year, 0, 1);
    const days = Math.floor((date.getTime() - firstDay.getTime()) / 86400000);
    const week = Math.ceil((days + firstDay.getDay() + 1) / 7);
    const key = `${year}-H${week}`;
    const current = bucket.get(key) || { completed: 0, duration: 0, score: 0 };
    current.completed += 1;
    current.duration += Math.round((task.actualDuration || 0) / 60);
    current.score += task.successScore || 0;
    bucket.set(key, current);
  });

  return [...bucket.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, value]) => ({
    week,
    completed: value.completed,
    duration: value.duration,
    score: value.completed ? Math.round(value.score / value.completed) : 0,
  }));
}

function getMonthlyPerformance(tasks: Task[]) {
  const bucket = new Map<string, { completed: number; duration: number; score: number }>();
  tasks.forEach((task) => {
    if (!isCompletedTask(task) || !task.completionDate) return;
    const date = new Date(task.completionDate);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const current = bucket.get(key) || { completed: 0, duration: 0, score: 0 };
    current.completed += 1;
    current.duration += Math.round((task.actualDuration || 0) / 60);
    current.score += task.successScore || 0;
    bucket.set(key, current);
  });

  return [...bucket.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({
    month,
    completed: value.completed,
    duration: value.duration,
    score: value.completed ? Math.round(value.score / value.completed) : 0,
  }));
}

function getYearlyPerformance(tasks: Task[]) {
  const bucket = new Map<string, { completed: number; duration: number }>();
  tasks.forEach((task) => {
    if (!isCompletedTask(task) || !task.completionDate) return;
    const date = new Date(task.completionDate);
    const key = String(date.getFullYear());
    const current = bucket.get(key) || { completed: 0, duration: 0 };
    current.completed += 1;
    current.duration += Math.round((task.actualDuration || 0) / 60);
    bucket.set(key, current);
  });

  return [...bucket.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([year, value]) => ({ year, ...value }));
}

const card = 'ios-card rounded-[28px] p-5';

const PerformanceAnalytics: React.FC<PerformanceAnalyticsProps> = ({ tasks }) => {
  const completedTasks = useMemo(() => tasks.filter((task) => isCompletedTask(task)), [tasks]);
  const weeklyData = useMemo(() => getWeeklyPerformance(tasks), [tasks]);
  const monthlyData = useMemo(() => getMonthlyPerformance(tasks), [tasks]);
  const yearlyData = useMemo(() => getYearlyPerformance(tasks), [tasks]);
  const analysis = useMemo(() => deriveAnalysisSnapshot(tasks, []), [tasks]);

  const totalDuration = completedTasks.reduce((sum, task) => sum + Math.round((task.actualDuration || 0) / 60), 0);
  const averageScore = completedTasks.length ? Math.round(completedTasks.reduce((sum, task) => sum + (task.successScore || 0), 0) / completedTasks.length) : 0;
  const averageFocus = completedTasks.length ? Math.round(completedTasks.reduce((sum, task) => sum + (task.focusScore || 0), 0) / completedTasks.length) : 0;
  const strongestCourse = analysis.courses[0];
  const strongestTaskType = analysis.taskTypes[0];
  const strongestStudyWindow = analysis.studyWindows[0];
  const weakestTopics = analysis.topics.filter((topic) => topic.needsRevision).slice(0, 3);

  if (!completedTasks.length) {
    return <EmptyState icon={<Info className="h-6 w-6" />} title="Performans özeti için veri yok" message="Tamamlanan görevler geldikçe haftalık, aylık ve yıllık özet burada görünecek." />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className={card}><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Tamamlanan</div><div className="mt-2 text-2xl font-black text-slate-900">{completedTasks.length}</div><div className="mt-1 text-sm text-slate-500">Kayıtlı oturum</div></div>
        <div className={card}><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Toplam süre</div><div className="mt-2 text-2xl font-black text-slate-900">{totalDuration}</div><div className="mt-1 text-sm text-slate-500">Dakika</div></div>
        <div className={card}><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Ortalama skor</div><div className="mt-2 text-2xl font-black text-amber-600">{averageScore}</div><div className="mt-1 text-sm text-slate-500">Başarı ortalaması</div></div>
        <div className={card}><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Ortalama odak</div><div className="mt-2 text-2xl font-black text-slate-900">{averageFocus}</div><div className="mt-1 text-sm text-slate-500">Odak ortalaması</div></div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_340px]">
        <div className={card}>
          <div className="mb-4">
            <h3 className="text-lg font-black text-slate-900">Aylık ilerleme</h3>
            <p className="mt-1 text-sm text-slate-500">Tamamlanan görev ve ortalama skor aynı tabloda izlenir.</p>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthlyData}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="month" {...chartAxisProps} />
              <YAxis {...chartAxisProps} />
              <Tooltip content={<ChartTooltip valueFormatter={(value, name) => name.includes('skor') ? `${value} puan` : `${value} görev`} />} />
              <Line legendType="none" type="monotone" dataKey="completed" stroke={chartPalette.blue} strokeWidth={3} name="Tamamlanan görev" dot={{ r: 4, fill: chartPalette.blue, strokeWidth: 0 }} activeDot={{ r: 7 }} />
              <Line legendType="none" type="monotone" dataKey="score" stroke={chartPalette.mint} strokeWidth={3} name="Ortalama skor" dot={{ r: 4, fill: chartPalette.mint, strokeWidth: 0 }} activeDot={{ r: 7 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-5">
          <div className={card}>
            <h3 className="text-base font-black text-slate-900">Karar karti</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Güçlü ders</div>
                <div className="mt-1 font-semibold text-slate-900">{strongestCourse ? strongestCourse.courseName : 'Veri yok'}</div>
                <div className="mt-1 text-xs text-slate-500">{strongestCourse ? `Hakimiyet ${strongestCourse.averageMastery} / Odak konusu ${strongestCourse.weakTopicCount}` : 'Tamamlanan görev geldikçe hesaplanır.'}</div>
              </div>
              <div className="rounded-2xl bg-sky-50 px-4 py-3">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">En verimli görev tipi</div>
                <div className="mt-1 font-semibold text-slate-900">{strongestTaskType ? strongestTaskType.label : 'Veri yok'}</div>
                <div className="mt-1 text-xs text-slate-500">{strongestTaskType ? `Hakimiyet ${strongestTaskType.averageMastery} / Verim ${strongestTaskType.averageEfficiency}` : 'Görev tipi verisi yetersiz.'}</div>
              </div>
              <div className="rounded-2xl bg-amber-50 px-4 py-3">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">En verimli pencere</div>
                <div className="mt-1 font-semibold text-slate-900">{strongestStudyWindow ? strongestStudyWindow.label : 'Veri yok'}</div>
                <div className="mt-1 text-xs text-slate-500">{strongestStudyWindow ? `Hakimiyet ${strongestStudyWindow.averageMastery} / Odak ${strongestStudyWindow.averageFocus}` : 'Saat verisi yetersiz.'}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Plan uyumu</div>
                <div className="mt-1 text-2xl font-black text-slate-900">{analysis.plan.adherenceScore}</div>
                <div className="mt-1 text-xs text-slate-500">Atanan görev tamamlama seviyesi</div>
              </div>
            </div>
          </div>

          <div className={card}>
            <h3 className="text-base font-black text-slate-900">Müdahale gereken konular</h3>
            <div className="mt-4 space-y-3">
              {weakestTopics.length === 0 && <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">Tekrar bayrağı olan konu yok.</div>}
              {weakestTopics.map((topic) => (
                <div key={topic.key} className="rounded-2xl bg-rose-50 px-4 py-3">
                  <div className="font-semibold text-slate-900">{topic.courseName}</div>
                  <div className="mt-1 text-sm text-slate-600">{topic.unitName} / {topic.topicName}</div>
                  <div className="mt-2 text-xs font-semibold text-rose-700">Hakimiyet {topic.masteryScore} / Trend {topic.trend}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className={card}>
          <h3 className="mb-4 text-lg font-black text-slate-900">Haftalık performans</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={weeklyData}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="week" {...chartAxisProps} />
              <YAxis {...chartAxisProps} />
              <Tooltip content={<ChartTooltip valueFormatter={(value, name) => name.includes('süre') ? `${value} dk` : `${value} görev`} />} />
              <Bar legendType="none" dataKey="completed" fill={chartPalette.blue} name="Tamamlanan görev" radius={[10, 10, 0, 0]} />
              <Bar legendType="none" dataKey="duration" fill={chartPalette.mint} name="Toplam süre (dk)" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={card}>
          <h3 className="mb-4 text-lg font-black text-slate-900">Yıllık genel görünüm</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={yearlyData}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="year" {...chartAxisProps} />
              <YAxis {...chartAxisProps} />
              <Tooltip content={<ChartTooltip valueFormatter={(value, name) => name.includes('süre') ? `${value} dk` : `${value} görev`} />} />
              <Line legendType="none" type="monotone" dataKey="completed" stroke={chartPalette.blue} strokeWidth={3} name="Tamamlanan görev" dot={{ r: 4, fill: chartPalette.blue, strokeWidth: 0 }} activeDot={{ r: 7 }} />
              <Line legendType="none" type="monotone" dataKey="duration" stroke={chartPalette.mint} strokeWidth={3} name="Toplam süre (dk)" dot={{ r: 4, fill: chartPalette.mint, strokeWidth: 0 }} activeDot={{ r: 7 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default PerformanceAnalytics;

