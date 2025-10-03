import React from 'react';
import { Task } from '../../types';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Clock, Target, Trophy, Calendar, BarChart as BarChartIcon, Info } from '../icons';
import '../child/progress-bar.css';

interface StudyStatsProps {
    tasks: Task[];
}

const StudyStats: React.FC<StudyStatsProps> = ({ tasks }) => {
    const completedTasks = tasks.filter(task => task.status === 'tamamlandı');
    
    // Haftalık trend analizi
    const weeklyData = React.useMemo(() => {
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - 6 + i);
            const dayName = date.toLocaleDateString('tr-TR', { weekday: 'short' });
            const dateStr = date.toISOString().split('T')[0];
            
            const dayTasks = completedTasks.filter(task => task.completionDate === dateStr);
            const totalTime = dayTasks.reduce((sum, task) => sum + (task.actualDuration || 0), 0);
            const avgScore = dayTasks.length > 0 
                ? dayTasks.reduce((sum, task) => sum + (task.successScore || 0), 0) / dayTasks.length 
                : 0;
            
            return {
                day: dayName,
                tasks: dayTasks.length,
                time: Math.round(totalTime / 60), // dakika
                score: Math.round(avgScore)
            };
        });
        return last7Days;
    }, [completedTasks]);

    // Ders dağılımı
    const subjectData = React.useMemo(() => {
        const subjects: { [key: string]: number } = {};
        completedTasks.forEach(task => {
            // courseId'den course name'e dönüştür, yoksa taskType kullan
            const subjectName = task.taskType || 'Diğer';
            subjects[subjectName] = (subjects[subjectName] || 0) + 1;
        });
        
        return Object.entries(subjects).map(([subject, count]) => ({
            name: subject,
            value: count
        }));
    }, [completedTasks]);

    // Renk paleti
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316'];

    // İstatistikler
    const stats = React.useMemo(() => {
        const totalTasks = completedTasks.length;
        const totalTime = completedTasks.reduce((sum, task) => sum + (task.actualDuration || 0), 0);
        const avgScore = totalTasks > 0 
            ? completedTasks.reduce((sum, task) => sum + (task.successScore || 0), 0) / totalTasks 
            : 0;
        
        const last7DaysTasks = completedTasks.filter(task => {
            const taskDate = new Date(task.completionDate!);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return taskDate >= weekAgo;
        }).length;

        return {
            totalTasks,
            totalTime: Math.round(totalTime / 60), // dakika
            avgScore: Math.round(avgScore),
            weeklyTasks: last7DaysTasks,
            dailyAverage: Math.round(last7DaysTasks / 7 * 10) / 10
        };
    }, [completedTasks]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg">
            {/* Başlık */}
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-800 flex items-center">
                    <BarChartIcon className="w-6 h-6 mr-3 text-primary-600" />
                    Gelişmiş İstatistikler
                </h3>
            </div>

            {/* Özet İstatistikler */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="text-blue-600 text-xs font-semibold">Toplam Görev</p>
                                <div className="group relative">
                                    <Info className="w-3 h-3 text-blue-400 cursor-help" />
                                    <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                        Şimdiye kadar tamamladığınız toplam görev sayısı
                                    </div>
                                </div>
                            </div>
                            <p className="text-xl font-bold text-blue-800">{stats.totalTasks}</p>
                        </div>
                        <Target className="w-6 h-6 text-blue-500" />
                    </div>
                </div>
                
                <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="text-green-600 text-xs font-semibold">Çalışma Süresi</p>
                                <div className="group relative">
                                    <Info className="w-3 h-3 text-green-400 cursor-help" />
                                    <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                        Tüm görevlerde harcadığınız toplam çalışma süresi
                                    </div>
                                </div>
                            </div>
                            <p className="text-xl font-bold text-green-800">{stats.totalTime}dk</p>
                        </div>
                        <Clock className="w-6 h-6 text-green-500" />
                    </div>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="text-purple-600 text-xs font-semibold">Ortalama Puan</p>
                                <div className="group relative">
                                    <Info className="w-3 h-3 text-purple-400 cursor-help" />
                                    <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                        Tüm görevlerinizin ortalama başarı puanı
                                    </div>
                                </div>
                            </div>
                            <p className="text-xl font-bold text-purple-800">{stats.avgScore}</p>
                        </div>
                        <Trophy className="w-6 h-6 text-purple-500" />
                    </div>
                </div>

                <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="text-orange-600 text-xs font-semibold">Haftalık Ortalama</p>
                                <div className="group relative">
                                    <Info className="w-3 h-3 text-orange-400 cursor-help" />
                                    <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                        Son 7 günün günlük görev tamamlama ortalaması
                                    </div>
                                </div>
                            </div>
                            <p className="text-xl font-bold text-orange-800">{stats.dailyAverage}</p>
                        </div>
                        <Calendar className="w-6 h-6 text-orange-500" />
                    </div>
                </div>
            </div>

            {/* Grafikler */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Haftalık Trend */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="w-5 h-5 text-primary-600" />
                        <h4 className="font-bold text-slate-700">7 Günlük Performans</h4>
                        <div className="group relative">
                            <Info className="w-4 h-4 text-slate-400 cursor-help" />
                            <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs px-3 py-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                Son 7 günün günlük görev sayısı ve ortalama puan trendi
                            </div>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={weeklyData}>
                            <XAxis dataKey="day" />
                            <YAxis />
                            <Tooltip 
                                formatter={(value, name) => {
                                    if (name === 'tasks') return [`${value} görev`, 'Tamamlanan Görev'];
                                    if (name === 'score') return [`${value} puan`, 'Ortalama Puan'];
                                    return [value, name];
                                }}
                            />
                            <Legend 
                                formatter={(value) => {
                                    if (value === 'tasks') return 'Görev Sayısı';
                                    if (value === 'score') return 'Ortalama Puan';
                                    return value;
                                }}
                            />
                            <Line type="monotone" dataKey="tasks" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4 }} />
                            <Line type="monotone" dataKey="score" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Ders Dağılımı */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2 mb-4">
                        <BarChartIcon className="w-5 h-5 text-primary-600" />
                        <h4 className="font-bold text-slate-700">Ders Dağılımı</h4>
                        <div className="group relative">
                            <Info className="w-4 h-4 text-slate-400 cursor-help" />
                            <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs px-3 py-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                Hangi derste ne kadar görev tamamladığınızı gösterir
                            </div>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={subjectData}
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                label={({ name, percent }: any) => `${name} %${(percent * 100).toFixed(0)}`}
                            >
                                {subjectData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value) => [`${value} görev`, 'Tamamlanan']} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Günlük Çalışma Süreleri */}
            <div className="mt-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="font-bold text-slate-700 mb-4 flex items-center">
                    <Clock className="w-5 h-5 mr-2 text-primary-600" />
                    Günlük Çalışma Süreleri (dk)
                </h4>
                <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={weeklyData}>
                        <XAxis dataKey="day" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`${value} dakika`, 'Çalışma Süresi']} />
                        <Bar dataKey="time" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Kişisel Rekorlar */}
            <div className="mt-6 bg-gradient-to-r from-yellow-50 to-yellow-100 p-4 rounded-lg border border-yellow-200">
                <h4 className="font-bold text-yellow-800 mb-3 flex items-center">
                    <Trophy className="w-5 h-5 mr-2" />
                    Kişisel Rekorlarım
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                        <p className="text-yellow-600 text-sm font-semibold">En Uzun Çalışma</p>
                        <p className="text-2xl font-bold text-yellow-800">
                            {Math.max(...completedTasks.map(t => t.actualDuration || 0)) > 0 
                                ? Math.round(Math.max(...completedTasks.map(t => t.actualDuration || 0)) / 60) 
                                : 0}dk
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-yellow-600 text-sm font-semibold">En Yüksek Puan</p>
                        <p className="text-2xl font-bold text-yellow-800">
                            {Math.max(...completedTasks.map(t => t.successScore || 0))}
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-yellow-600 text-sm font-semibold">En Aktif Gün</p>
                        <p className="text-2xl font-bold text-yellow-800">
                            {weeklyData.reduce((max, day) => day.tasks > max.tasks ? day : max, weeklyData[0])?.day || 'Yok'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudyStats;