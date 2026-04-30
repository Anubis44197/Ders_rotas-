import React, { useMemo } from 'react';
import { Task, Course } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Clock, Target, Zap, Calendar, BookOpen } from '../icons';
import { getDaysAgo, getLocalDateString } from '../../utils/dateUtils';
import { ChartTooltip, chartAxisProps, chartGridProps, chartPalette, chartSeries } from '../shared/chartDesign';

interface StudyStatsProps {
  tasks: Task[];
  courses: Course[];
}

const card = 'ios-card rounded-[28px] p-5';

const StudyStats: React.FC<StudyStatsProps> = ({ tasks, courses }) => {
  const completedTasks = useMemo(() => tasks.filter((task) => task.status === 'tamamlandı'), [tasks]);

  const stats = useMemo(() => {
    if (completedTasks.length === 0) return null;

    const totalStudyTime = completedTasks.reduce((sum, task) => sum + (task.actualDuration || 0), 0) / 60;
    const averageSessionLength = totalStudyTime / completedTasks.length;
    const averageSuccessScore = completedTasks.reduce((sum, task) => sum + (task.successScore || 0), 0) / completedTasks.length;

    const hourlyStats: Record<number, number> = {};
    completedTasks.forEach((task) => {
      if (!task.completionTimestamp) return;
      const hour = new Date(task.completionTimestamp).getHours();
      hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
    });

    const bestPerformanceHour = Object.entries(hourlyStats).sort(([, a], [, b]) => b - a)[0]?.[0] || '14';

    const courseStats: Record<string, number> = {};
    completedTasks.forEach((task) => {
      courseStats[task.courseId] = (courseStats[task.courseId] || 0) + 1;
    });

    const favoriteSubject = Object.entries(courseStats).sort(([, a], [, b]) => b - a)[0]?.[0];
    const favoriteCourseName = courses.find((course) => course.id === favoriteSubject)?.name || 'Belirsiz';

    const last7Days = Array.from({ length: 7 }, (_, index) => getLocalDateString(getDaysAgo(6 - index)));
    let streakDays = 0;
    for (let index = last7Days.length - 1; index >= 0; index -= 1) {
      const hasTask = completedTasks.some((task) => task.completionDate === last7Days[index]);
      if (!hasTask) break;
      streakDays += 1;
    }

    return {
      totalStudyTime: Math.round(totalStudyTime),
      averageSessionLength: Math.round(averageSessionLength),
      streakDays,
      totalTasksCompleted: completedTasks.length,
      averageSuccessScore: Math.round(averageSuccessScore),
      bestPerformanceHour: `${bestPerformanceHour}:00`,
      favoriteSubject: favoriteCourseName,
      weeklyGoalProgress: Math.min(100, (streakDays / 7) * 100),
    };
  }, [completedTasks, courses]);

  const weeklyTrendData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = getDaysAgo(6 - index);
      return {
        day: date.toLocaleDateString('tr-TR', { weekday: 'short' }),
        date: getLocalDateString(date),
        tasks: 0,
        studyTime: 0,
        avgScore: 0,
      };
    });

    days.forEach((dayData) => {
      const dayTasks = completedTasks.filter((task) => task.completionDate === dayData.date);
      dayData.tasks = dayTasks.length;
      dayData.studyTime = Math.round(dayTasks.reduce((sum, task) => sum + (task.actualDuration || 0), 0) / 60);
      dayData.avgScore = dayTasks.length > 0 ? Math.round(dayTasks.reduce((sum, task) => sum + (task.successScore || 0), 0) / dayTasks.length) : 0;
    });

    return days;
  }, [completedTasks]);

  const courseDistribution = useMemo(() => {
    return courses
      .map((course) => {
        const courseTasks = completedTasks.filter((task) => task.courseId === course.id);
        return {
          name: course.name,
          value: courseTasks.length,
          studyTime: Math.round(courseTasks.reduce((sum, task) => sum + (task.actualDuration || 0), 0) / 60),
        };
      })
      .filter((item) => item.value > 0);
  }, [completedTasks, courses]);

  const colors = chartSeries;

  if (!stats) {
    return (
      <div className="ios-card rounded-[28px] p-8 text-center">
        <BookOpen className="mx-auto mb-4 h-12 w-12 text-slate-300" />
        <h3 className="mb-2 text-lg font-bold text-slate-700">Henuz istatistik yok</h3>
        <p className="text-sm text-slate-500">Tamamlanan gorevler geldikce burada net grafikler olusacak.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="ios-widget ios-blue rounded-[24px] p-4 text-slate-900"><div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Toplam calisma</p><p className="mt-2 text-2xl font-black">{stats.totalStudyTime} dk</p></div><Clock className="h-7 w-7 text-blue-600" /></div></div>
        <div className="ios-widget ios-mint rounded-[24px] p-4 text-slate-900"><div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Calisma serisi</p><p className="mt-2 text-2xl font-black">{stats.streakDays} gun</p></div><Zap className="h-7 w-7 text-emerald-600" /></div></div>
        <div className="ios-widget ios-lilac rounded-[24px] p-4 text-slate-900"><div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Ortalama puan</p><p className="mt-2 text-2xl font-black">{stats.averageSuccessScore}</p></div><Target className="h-7 w-7 text-violet-600" /></div></div>
        <div className="ios-widget ios-peach rounded-[24px] p-4 text-slate-900"><div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Tamamlanan</p><p className="mt-2 text-2xl font-black">{stats.totalTasksCompleted}</p></div><TrendingUp className="h-7 w-7 text-orange-600" /></div></div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.25fr)_320px]">
        <div className={card}>
          <div className="mb-4 flex items-center gap-2 text-slate-900"><Calendar className="h-5 w-5 text-primary-600" /><h3 className="text-lg font-black">Son 7 gun</h3></div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={weeklyTrendData}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="day" {...chartAxisProps} />
              <YAxis {...chartAxisProps} />
              <Tooltip
                content={<ChartTooltip valueFormatter={(value, name) => {
                  if (name === 'Gorev') return `${value} adet`;
                  if (name === 'Calisma') return `${value} dk`;
                  return `${value} puan`;
                }} />}
                labelFormatter={(label, payload) => {
                  const data = payload?.[0]?.payload;
                  return data ? `${label} - ${data.date}` : label;
                }}
                formatter={(value, name) => {
                  const formatMap = {
                    tasks: ['Gorev', 'adet'],
                    studyTime: ['Calisma', 'dk'],
                    avgScore: ['Puan', ''],
                  } as const;
                  const [label, unit] = formatMap[name as keyof typeof formatMap] || [String(name), ''];
                  return [`${value} ${unit}`.trim(), label];
                }}
              />
              <Line type="monotone" dataKey="tasks" stroke={chartPalette.blue} strokeWidth={4} dot={{ r: 4, fill: chartPalette.blue, strokeWidth: 0 }} name="Gorev" activeDot={{ r: 7 }} />
              <Line type="monotone" dataKey="studyTime" stroke={chartPalette.mint} strokeWidth={4} dot={{ r: 4, fill: chartPalette.mint, strokeWidth: 0 }} name="Calisma" activeDot={{ r: 7 }} />
              <Line type="monotone" dataKey="avgScore" stroke={chartPalette.lilac} strokeWidth={4} dot={{ r: 4, fill: chartPalette.lilac, strokeWidth: 0 }} name="Puan" activeDot={{ r: 7 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-5">
          <div className={card}>
            <h3 className="mb-4 text-base font-black text-slate-900">Calisma ritmi</h3>
            <div className="space-y-3">
              <div className="ios-widget flex items-center justify-between rounded-[18px] px-4 py-3"><span className="text-sm text-slate-600">En verimli saat</span><span className="font-bold text-blue-600">{stats.bestPerformanceHour}</span></div>
              <div className="ios-widget flex items-center justify-between rounded-[18px] px-4 py-3"><span className="text-sm text-slate-600">Favori ders</span><span className="font-bold text-emerald-600">{stats.favoriteSubject}</span></div>
              <div className="ios-widget flex items-center justify-between rounded-[18px] px-4 py-3"><span className="text-sm text-slate-600">Ortalama seans</span><span className="font-bold text-slate-900">{stats.averageSessionLength} dk</span></div>
              <div className="ios-widget rounded-[18px] px-4 py-3">
                <div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold text-slate-700">Haftalik hedef</span><span className="text-sm font-bold text-emerald-600">{stats.weeklyGoalProgress.toFixed(0)}%</span></div>
                <div className="progress-bar"><div className="progress-bar-inner bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${stats.weeklyGoalProgress}%` }} /></div>
              </div>
            </div>
          </div>

          <div className={card}>
            <h3 className="mb-4 text-base font-black text-slate-900">Ders dagilimi</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={courseDistribution} cx="50%" cy="50%" outerRadius={70} dataKey="value" innerRadius={38}>
                  {courseDistribution.map((_, index) => <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />)}
                </Pie>
            <Tooltip content={<ChartTooltip valueFormatter={(value) => `${value} gorev`} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-2">
              {courseDistribution.map((item, index) => (
                <div key={item.name} className="ios-widget flex items-center justify-between rounded-[18px] px-3 py-2 text-sm">
                  <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} /><span className="text-slate-700">{item.name}</span></div>
                  <span className="font-semibold text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={card}>
        <div className="mb-4 flex items-center gap-2 text-slate-900"><BookOpen className="h-5 w-5 text-blue-600" /><h3 className="text-lg font-black">Gunluk gorev dagilimi</h3></div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={weeklyTrendData}>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="day" {...chartAxisProps} />
            <YAxis {...chartAxisProps} />
            <Tooltip content={<ChartTooltip valueFormatter={(value) => `${value} gorev`} />} />
            <Bar dataKey="tasks" name="Gorev" radius={[12, 12, 0, 0]} fill={chartPalette.blue} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StudyStats;
