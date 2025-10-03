import React from 'react';
import { BookOpen, Calendar, Clock, Target, Star, Award, Brain, Info } from '../icons';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter } from 'recharts';
                  import { Task } from '../../types';

                  interface ReadingAnalyticsProps {
                    tasks: Task[];
                  }

                  const ReadingAnalytics: React.FC<ReadingAnalyticsProps> = ({ tasks }) => {
                    // Okuma görevlerini filtrele
                    const readingTasks = tasks.filter(task => 
                      task.taskType === 'kitap okuma' || 
                      task.title.toLowerCase().includes('okuma') ||
                      task.title.toLowerCase().includes('kitap')
                    );

                    // En çok okunan tür ve kitap
                    const completedReadingTasks = readingTasks.filter(t => t.status === 'tamamlandı');
                    const genreCounts: Record<string, number> = {};
                    const bookCounts: Record<string, number> = {};
                    completedReadingTasks.forEach(task => {
                      const genre = task.bookGenre || 'Diğer';
                      genreCounts[genre] = (genreCounts[genre] || 0) + 1;
                      const book = task.bookTitle || task.title;
                      bookCounts[book] = (bookCounts[book] || 0) + 1;
                    });
                    const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
                    const topBook = Object.entries(bookCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
                    const totalPages = completedReadingTasks.reduce((sum, t) => sum + (t.pagesRead || 0), 0);

                    // Haftalık başarı puanı trendi
                    const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
                    const weeklyScores = dayNames.map(day => ({ day, score: 0, count: 0 }));
                    completedReadingTasks.forEach(task => {
                      const date = new Date(task.completionDate || task.dueDate);
                      const weekIdx = date.getDay();
                      if (task.successScore) {
                        weeklyScores[weekIdx].score += task.successScore;
                        weeklyScores[weekIdx].count += 1;
                      }
                    });
                    weeklyScores.forEach(d => { if (d.count > 0) d.score = Math.round(d.score / d.count); });

                    // Saat aralığına göre okuma yoğunluğu
                    const hourlyDistribution: { hour: string, count: number }[] = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, count: 0 }));
                    completedReadingTasks.forEach(task => {
                      const date = new Date(task.completionDate || task.dueDate);
                      const hour = date.getHours();
                      hourlyDistribution[hour].count += 1;
                    });
                    // Okuma süresi ile başarı puanı ilişkisi
                    const durationScoreData = completedReadingTasks.map(task => ({
                      duration: Math.round((task.actualDuration || 0) / 60),
                      score: task.successScore || 0
                    })).filter(d => d.duration > 0 && d.score > 0);

                    // Aylık okuma trendi
                    const monthlyData: { month: string, books: number, totalPages: number }[] = [];
                    const monthMap: Record<string, { books: number, totalPages: number }> = {};
                    completedReadingTasks.forEach(task => {
                      const date = new Date(task.completionDate || task.dueDate);
                      const month = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}`;
                      if (!monthMap[month]) monthMap[month] = { books: 0, totalPages: 0 };
                      monthMap[month].books += 1;
                      monthMap[month].totalPages += task.pagesRead || 0;
                    });
                    Object.entries(monthMap).forEach(([month, data]) => {
                      monthlyData.push({ month, books: data.books, totalPages: data.totalPages });
                    });
                    monthlyData.sort((a, b) => a.month.localeCompare(b.month));

                    // Kitap türü dağılımı
                    const typeData = Object.entries(genreCounts).map(([name, value], idx) => ({
                      name,
                      value,
                      color: ["#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#6366F1", "#F472B6"][idx % 7]
                    }));

                    return (
                      <div className="space-y-8">
                        {/* İstatistik Kartları */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          <div className="bg-white rounded-xl shadow-sm border p-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-600">En Çok Okunan Tür</p>
                                <p className="text-2xl font-bold text-purple-600">{topGenre}</p>
                              </div>
                              <BookOpen className="w-10 h-10 text-purple-600 opacity-80" />
                            </div>
                          </div>
                          <div className="bg-white rounded-xl shadow-sm border p-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-600">En Çok Okunan Kitap</p>
                                <p className="text-2xl font-bold text-green-600">{topBook}</p>
                              </div>
                              <BookOpen className="w-10 h-10 text-green-600 opacity-80" />
                            </div>
                          </div>
                          <div className="bg-white rounded-xl shadow-sm border p-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-600">Toplam Okunan Sayfa</p>
                                <p className="text-2xl font-bold text-blue-600">{totalPages}</p>
                              </div>
                              <BookOpen className="w-10 h-10 text-blue-600 opacity-80" />
                            </div>
                          </div>
                        </div>

                        {/* Haftalık Başarı Puanı Trendi */}
                        <div className="bg-white rounded-xl shadow-sm border p-6 mt-8">
                          <div className="flex items-center gap-2 mb-6">
                            <h3 className="text-lg font-semibold text-gray-900">Haftalık Başarı Puanı Trendi</h3>
                            <div className="group relative">
                              <Info className="w-4 h-4 text-slate-400 cursor-help" />
                              <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs px-3 py-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                Haftalık ortalama başarı puanlarını gösterir.
                              </div>
                            </div>
                          </div>
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={weeklyScores}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="day" />
                              <YAxis />
                              <Tooltip labelFormatter={value => `${value}`} formatter={(value: any) => [value, 'Başarı Puanı']} />
                              <Line type="monotone" dataKey="score" stroke="#F59E0B" strokeWidth={3} dot={{ fill: '#F59E0B' }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Saat Aralığına Göre Okuma Yoğunluğu */}
                        <div className="bg-white rounded-xl shadow-sm border p-6 mt-8">
                          <div className="flex items-center gap-2 mb-6">
                            <h3 className="text-lg font-semibold text-gray-900">Saat Aralığına Göre Okuma Yoğunluğu</h3>
                            <div className="group relative">
                              <Info className="w-4 h-4 text-slate-400 cursor-help" />
                              <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs px-3 py-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                Hangi saatlerde okuma aktivitesi yoğunlaşıyor, analiz eder.
                              </div>
                            </div>
                          </div>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={hourlyDistribution}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="hour" />
                              <YAxis />
                              <Tooltip labelFormatter={value => `${value}`} formatter={(value: any) => [value, 'Okuma Sayısı']} />
                              <Bar dataKey="count" fill="#3B82F6" radius={4} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Okuma Süresi ile Başarı İlişkisi */}
                        <div className="bg-white rounded-xl shadow-sm border p-6 mt-8">
                          <div className="flex items-center gap-2 mb-6">
                            <h3 className="text-lg font-semibold text-gray-900">Okuma Süresi ile Başarı İlişkisi</h3>
                            <div className="group relative">
                              <Info className="w-4 h-4 text-slate-400 cursor-help" />
                              <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs px-3 py-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                Okuma süresi ile başarı puanı arasındaki ilişkiyi gösterir.
                              </div>
                            </div>
                          </div>
                          <ResponsiveContainer width="100%" height={200}>
                            <ScatterChart>
                              <CartesianGrid />
                              <XAxis dataKey="duration" name="Süre (dk)" />
                              <YAxis dataKey="score" name="Başarı Puanı" />
                              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                              <Scatter name="Kitaplar" data={durationScoreData} fill="#EF4444" />
                            </ScatterChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Aylık Okuma Trendi */}
                        <div className="bg-white rounded-xl shadow-sm border p-6 mt-8">
                          <div className="flex items-center gap-2 mb-6">
                            <h3 className="text-lg font-semibold text-gray-900">Aylık Okuma Trendi</h3>
                            <div className="group relative">
                              <Info className="w-4 h-4 text-slate-400 cursor-help" />
                              <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs px-3 py-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                Aylık okuma kitap sayısı ve sayfa ilerlemesini takip eder. Uzun vadeli gelişimi analiz etmenizi sağlar.
                              </div>
                            </div>
                          </div>
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={monthlyData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="month" />
                              <YAxis />
                              <Tooltip 
                                labelFormatter={(value) => `${value}`}
                                formatter={(value: any, name: string) => {
                                  if (name === 'books') return [value, 'Kitap Sayısı'];
                                  if (name === 'totalPages') return [value, 'Toplam Sayfa'];
                                  return [value, name];
                                }}
                              />
                              <Line type="monotone" dataKey="books" stroke="#8B5CF6" strokeWidth={3} dot={{ fill: '#8B5CF6' }} />
                              <Line type="monotone" dataKey="totalPages" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981' }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Kitap Türü Dağılımı */}
                        <div className="bg-white rounded-xl shadow-sm border p-6 mt-8">
                          <div className="flex items-center gap-2 mb-6">
                            <h3 className="text-lg font-semibold text-gray-900">Kitap Türü Dağılımı</h3>
                            <div className="group relative">
                              <Info className="w-4 h-4 text-slate-400 cursor-help" />
                              <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs px-3 py-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                Çocuğunuzun okuduğu kitap türlerinin dağılımını gösterir. Farklı türler deneyerek çocuk gelişimini destekleyebilirsiniz.
                              </div>
                            </div>
                          </div>
                          {typeData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                              <PieChart>
                                <Pie
                                  data={typeData}
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={100}
                                  dataKey="value"
                                  label={({ name, value }: any) => `${name} (${value})`}
                                >
                                  {typeData.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip />
                              </PieChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
                              <BookOpen className="w-16 h-16 mb-4" />
                              <p className="text-lg font-medium">Henüz kitap okuma verisi yok</p>
                              <p className="text-sm text-center">Çocuğunuz kitap okumaya başladığında burada tür analizi görünecek</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  };

                  export default ReadingAnalytics;

