import React from 'react';
import { Task } from '../../types';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Clock, Target, Trophy, Calendar, BarChart as BarChartIcon, Info } from '../icons';
import '../child/progress-bar.css';
import { getDaysAgo, getLocalDateString } from '../../utils/dateUtils';

interface StudyStatsProps {
  tasks: Task[];
}

const StudyStats: React.FC<StudyStatsProps> = ({ tasks }) => {
  const completedTasks = tasks.filter((task) => task.status === 'tamamland\u0131');

  const weeklyData = React.useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = getDaysAgo(6 - index);
      const dayName = date.toLocaleDateString('tr-TR', { weekday: 'short' });
      const dateStr = getLocalDateString(date);
      const dayTasks = completedTasks.filter((task) => task.completionDate === dateStr);
      const totalTime = dayTasks.reduce((sum, task) => sum + (task.actualDuration || 0), 0);
      const avgScore = dayTasks.length > 0 ? dayTasks.reduce((sum, task) => sum + (task.successScore || 0), 0) / dayTasks.length : 0;
      return { day: dayName, tasks: dayTasks.length, time: Math.round(totalTime / 60), score: Math.round(avgScore) };
    });
  }, [completedTasks]);

  const subjectData = React.useMemo(() => {
    const subjects: Record<string, number> = {};
    completedTasks.forEach((task) => {
      const subjectName = task.taskType || 'Diger';
      subjects[subjectName] = (subjects[subjectName] || 0) + 1;
    });
    return Object.entries(subjects).map(([subject, count]) => ({ name: subject, value: count }));
  }, [completedTasks]);

  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316'];

  const stats = React.useMemo(() => {
    const totalTasks = completedTasks.length;
    const totalTime = completedTasks.reduce((sum, task) => sum + (task.actualDuration || 0), 0);
    const avgScore = totalTasks > 0 ? completedTasks.reduce((sum, task) => sum + (task.successScore || 0), 0) / totalTasks : 0;
    const last7DaysTasks = completedTasks.filter((task) => {
      if (!task.completionDate) return false;
      return new Date(`${task.completionDate}T00:00:00`) >= getDaysAgo(7);
    }).length;
    return { totalTasks, totalTime: Math.round(totalTime / 60), avgScore: Math.round(avgScore), weeklyTasks: last7DaysTasks, dailyAverage: Math.round((last7DaysTasks / 7) * 10) / 10 };
  }, [completedTasks]);

  return (
    <div className="rounded-xl bg-white p-6 shadow-lg">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="flex items-center text-xl font-bold text-slate-800"><BarChartIcon className="mr-3 h-6 w-6 text-primary-600" />Gelismis Istatistikler</h3>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100 p-4"><div className="flex items-center justify-between"><div><div className="flex items-center gap-2"><p className="text-xs font-semibold text-blue-600">Toplam Gorev</p><Info className="h-3 w-3 text-blue-400" /></div><p className="text-xl font-bold text-blue-800">{stats.totalTasks}</p></div><Target className="h-6 w-6 text-blue-500" /></div></div>
        <div className="rounded-lg border border-green-200 bg-gradient-to-r from-green-50 to-green-100 p-4"><div className="flex items-center justify-between"><div><div className="flex items-center gap-2"><p className="text-xs font-semibold text-green-600">Calisma Suresi</p><Info className="h-3 w-3 text-green-400" /></div><p className="text-xl font-bold text-green-800">{stats.totalTime}dk</p></div><Clock className="h-6 w-6 text-green-500" /></div></div>
        <div className="rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-purple-100 p-4"><div className="flex items-center justify-between"><div><div className="flex items-center gap-2"><p className="text-xs font-semibold text-purple-600">Ortalama Puan</p><Info className="h-3 w-3 text-purple-400" /></div><p className="text-xl font-bold text-purple-800">{stats.avgScore}</p></div><Trophy className="h-6 w-6 text-purple-500" /></div></div>
        <div className="rounded-lg border border-orange-200 bg-gradient-to-r from-orange-50 to-orange-100 p-4"><div className="flex items-center justify-between"><div><div className="flex items-center gap-2"><p className="text-xs font-semibold text-orange-600">Haftalik Ortalama</p><Info className="h-3 w-3 text-orange-400" /></div><p className="text-xl font-bold text-orange-800">{stats.dailyAverage}</p></div><Calendar className="h-6 w-6 text-orange-500" /></div></div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary-600" /><h4 className="font-bold text-slate-700">7 Gunluk Performans</h4></div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={weeklyData}>
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip formatter={(value, name) => name === 'tasks' ? [`${value} gorev`, 'Tamamlanan Gorev'] : [`${value} puan`, 'Ortalama Puan']} />
              <Legend formatter={(value) => value === 'tasks' ? 'Gorev Sayisi' : value === 'score' ? 'Ortalama Puan' : value} />
              <Line type="monotone" dataKey="tasks" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="score" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 flex items-center gap-2"><BarChartIcon className="h-5 w-5 text-primary-600" /><h4 className="font-bold text-slate-700">Ders Dagilimi</h4></div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={subjectData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }: any) => `${name} %${(percent * 100).toFixed(0)}`}>
                {subjectData.map((_, index) => <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />)}
              </Pie>
              <Tooltip formatter={(value) => [`${value} gorev`, 'Tamamlanan']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h4 className="mb-4 flex items-center font-bold text-slate-700"><Clock className="mr-2 h-5 w-5 text-primary-600" />Gunluk Calisma Sureleri (dk)</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weeklyData}>
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip formatter={(value) => [`${value} dakika`, 'Calisma Suresi']} />
            <Bar dataKey="time" fill="#3B82F6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StudyStats;


