import React, { useMemo } from 'react';
import { Task, Course } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Clock, Target, Zap, Calendar, BookOpen } from '../icons';

interface StudyStatsProps {
    tasks: Task[];
    courses: Course[];
}

const StudyStats: React.FC<StudyStatsProps> = ({ tasks, courses }) => {
    const completedTasks = useMemo(() => 
        tasks.filter(t => t.status === 'tamamlandı'), 
        [tasks]
    );

    // Genel istatistikler
    const stats = useMemo(() => {
        if (completedTasks.length === 0) return null;

        const totalStudyTime = completedTasks.reduce((sum, t) => sum + (t.actualDuration || 0), 0) / 60; // dakika
        const averageSessionLength = totalStudyTime / completedTasks.length;
        const averageSuccessScore = completedTasks.reduce((sum, t) => sum + (t.successScore || 0), 0) / completedTasks.length;
        
        // En çok çalışılan saat analizi
        const hourlyStats: { [hour: number]: number } = {};
        completedTasks.forEach(task => {
            if (task.completionTimestamp) {
                const hour = new Date(task.completionTimestamp).getHours();
                hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
            }
        });
        
        const bestPerformanceHour = Object.entries(hourlyStats)
            .sort(([,a], [,b]) => b - a)[0]?.[0] || '14';

        // Favori ders
        const courseStats: { [courseId: string]: number } = {};
        completedTasks.forEach(task => {
            courseStats[task.courseId] = (courseStats[task.courseId] || 0) + 1;
        });
        
        const favoriteSubject = Object.entries(courseStats)
            .sort(([,a], [,b]) => b - a)[0]?.[0];
        
        const favoriteCourseName = courses.find(c => c.id === favoriteSubject)?.name || 'Belirsiz';

        // Çalışma sırası (son 7 gün)
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - i);
            return date.toISOString().split('T')[0];
        }).reverse();

        const streakDays = last7Days.reduce((streak, date) => {
            const hasTaskOnDay = completedTasks.some(task => task.completionDate === date);
            return hasTaskOnDay ? streak + 1 : 0;
        }, 0);

        return {
            totalStudyTime: Math.round(totalStudyTime),
            averageSessionLength: Math.round(averageSessionLength),
            streakDays,
            totalTasksCompleted: completedTasks.length,
            averageSuccessScore: Math.round(averageSuccessScore),
            bestPerformanceHour: `${bestPerformanceHour}:00`,
            favoriteSubject: favoriteCourseName,
            weeklyGoalProgress: Math.min(100, (streakDays / 7) * 100)
        };
    }, [completedTasks, courses]);

    // Haftalık trend verisi
    const weeklyTrendData = useMemo(() => {
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            return {
                day: date.toLocaleDateString('tr-TR', { weekday: 'short' }),
                date: date.toISOString().split('T')[0],
                tasks: 0,
                studyTime: 0,
                avgScore: 0
            };
        });

        last7Days.forEach(dayData => {
            const dayTasks = completedTasks.filter(t => t.completionDate === dayData.date);
            dayData.tasks = dayTasks.length;
            dayData.studyTime = Math.round(dayTasks.reduce((sum, t) => sum + (t.actualDuration || 0), 0) / 60);
            dayData.avgScore = dayTasks.length > 0 
                ? Math.round(dayTasks.reduce((sum, t) => sum + (t.successScore || 0), 0) / dayTasks.length)
                : 0;
        });

        return last7Days;
    }, [completedTasks]);

    // Ders dağılımı
    const courseDistribution = useMemo(() => {
        const distribution = courses.map(course => {
            const courseTasks = completedTasks.filter(t => t.courseId === course.id);
            return {
                name: course.name,
                value: courseTasks.length,
                studyTime: Math.round(courseTasks.reduce((sum, t) => sum + (t.actualDuration || 0), 0) / 60)
            };
        }).filter(item => item.value > 0);

        return distribution;
    }, [completedTasks, courses]);

    const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

    if (!stats) {
        return (
            <div className="bg-white p-6 rounded-xl shadow-md text-center">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-bold text-slate-600 mb-2">Henüz İstatistik Yok</h3>
                <p className="text-slate-500">Görevler tamamlandıkça detaylı istatistikler burada görünecek.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Genel İstatistik Kartları */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-100 text-sm">Toplam Çalışma</p>
                            <p className="text-2xl font-bold">{stats.totalStudyTime}dk</p>
                        </div>
                        <Clock className="w-8 h-8 text-blue-200" />
                    </div>
                </div>

                <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-green-100 text-sm">Çalışma Sırası</p>
                            <p className="text-2xl font-bold">{stats.streakDays} gün</p>
                        </div>
                        <Zap className="w-8 h-8 text-green-200" />
                    </div>
                </div>

                <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 rounded-xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-purple-100 text-sm">Ortalama Puan</p>
                            <p className="text-2xl font-bold">{stats.averageSuccessScore}</p>
                        </div>
                        <Target className="w-8 h-8 text-purple-200" />
                    </div>
                </div>

                <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 rounded-xl">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-orange-100 text-sm">Tamamlanan</p>
                            <p className="text-2xl font-bold">{stats.totalTasksCompleted}</p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-orange-200" />
                    </div>
                </div>
            </div>

            {/* Haftalık Trend Grafiği */}
            <div className="bg-white p-6 rounded-xl shadow-md">
                <h3 className="text-xl font-bold mb-4 flex items-center">
                    <Calendar className="w-6 h-6 mr-2 text-primary-600" />
                    Son 7 Günlük Trend
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={weeklyTrendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <Tooltip 
                            labelFormatter={(label, payload) => {
                                const data = payload?.[0]?.payload;
                                return data ? `${label} - ${data.date}` : label;
                            }}
                            formatter={(value, name) => {
                                const formatMap = {
                                    'tasks': ['Görev', 'adet'],
                                    'studyTime': ['Çalışma', 'dk'],
                                    'avgScore': ['Puan', '']
                                };
                                const [label, unit] = formatMap[name as keyof typeof formatMap] || [name, ''];
                                return [`${value} ${unit}`, label];
                            }}
                        />
                        <Line type="monotone" dataKey="tasks" stroke="#3B82F6" strokeWidth={2} name="tasks" />
                        <Line type="monotone" dataKey="studyTime" stroke="#10B981" strokeWidth={2} name="studyTime" />
                        <Line type="monotone" dataKey="avgScore" stroke="#F59E0B" strokeWidth={2} name="avgScore" />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Ders Dağılımı */}
                <div className="bg-white p-6 rounded-xl shadow-md">
                    <h3 className="text-xl font-bold mb-4">Ders Dağılımı</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={courseDistribution}
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                dataKey="value"
                                label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                                {courseDistribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value, name) => [`${value} görev`, name]} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Kişisel Rekorlar */}
                <div className="bg-white p-6 rounded-xl shadow-md">
                    <h3 className="text-xl font-bold mb-4">Kişisel Bilgiler</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                            <span className="text-slate-600">En Verimli Saat:</span>
                            <span className="font-bold text-primary-600">{stats.bestPerformanceHour}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                            <span className="text-slate-600">Favori Ders:</span>
                            <span className="font-bold text-green-600">{stats.favoriteSubject}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                            <span className="text-slate-600">Ortalama Seans:</span>
                            <span className="font-bold text-blue-600">{stats.averageSessionLength} dk</span>
                        </div>
                        <div className="p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-slate-700 font-semibold">Haftalık Hedef</span>
                                <span className="text-sm font-bold text-green-600">{stats.weeklyGoalProgress.toFixed(0)}%</span>
                            </div>
                            <div className="progress-bar">
                                <div 
                                    className={`progress-bar-inner bg-gradient-to-r from-green-500 to-blue-500 ${stats.weeklyGoalProgress >= 100 ? 'w-full' : stats.weeklyGoalProgress >= 90 ? 'w-[90%]' : stats.weeklyGoalProgress >= 80 ? 'w-[80%]' : stats.weeklyGoalProgress >= 70 ? 'w-[70%]' : stats.weeklyGoalProgress >= 60 ? 'w-[60%]' : stats.weeklyGoalProgress >= 50 ? 'w-[50%]' : stats.weeklyGoalProgress >= 40 ? 'w-[40%]' : stats.weeklyGoalProgress >= 30 ? 'w-[30%]' : stats.weeklyGoalProgress >= 20 ? 'w-[20%]' : stats.weeklyGoalProgress >= 10 ? 'w-[10%]' : 'w-0'}`}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudyStats;