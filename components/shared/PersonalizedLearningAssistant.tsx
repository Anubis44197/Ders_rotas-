import React, { useState, useEffect } from 'react';
import { Task } from '../../types';
import { Brain, Zap, Target, Lightbulb, TrendingUp, TrendingDown, BookOpen, Calendar, Info } from '../icons';

interface LearningAssistantProps {
    tasks: Task[];
    userPerformance: {
        completionRate: number;
        averageScore: number;
        strongSubjects: string[];
        weakSubjects: string[];
        learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'mixed';
    };
    onSuggestStudyPlan: (plan: StudyPlan) => void;
    ai: any;
}

interface StudyPlan {
    id: string;
    title: string;
    duration: number; // dakika
    activities: StudyActivity[];
    difficulty: 'kolay' | 'orta' | 'zor';
    focus: string[];
}

interface StudyActivity {
    type: 'review' | 'practice' | 'new_concept' | 'break';
    subject: string;
    duration: number;
    description: string;
    resources?: string[];
}

interface LearningInsight {
    type: 'strength' | 'weakness' | 'opportunity' | 'warning';
    title: string;
    description: string;
    actionable: boolean;
    suggestion?: string;
}

const PersonalizedLearningAssistant: React.FC<LearningAssistantProps> = ({
    tasks,
    userPerformance,
    onSuggestStudyPlan,
    ai
}) => {
    const [insights, setInsights] = useState<LearningInsight[]>([]);
    const [suggestedPlan, setSuggestedPlan] = useState<StudyPlan | null>(null);
    const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);

    // Yapay Zeka tabanlı öğrenme analizi
    useEffect(() => {
        const generateInsights = async () => {
            const newInsights: LearningInsight[] = [];
            const completedTasks = tasks.filter(t => t.status === 'tamamlandı');
            const recentTasks = completedTasks.filter(t => {
                if (!t.completionDate) return false;
                try {
                    const completionDate = new Date(t.completionDate);
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return completionDate >= weekAgo;
                } catch (error) {
                    console.error('Invalid completion date:', t.completionDate, error);
                    return false;
                }
            });

            // AI destekli analiz (eğer yeterli veri varsa)
            if (completedTasks.length >= 5 && ai) {
                try {
                    const taskAnalysisData = completedTasks.map(t => ({
                        subject: t.courseId,
                        successScore: t.successScore || 0,
                        focusScore: t.focusScore || 0,
                        completionTime: t.actualDuration || 0,
                        taskType: t.taskType
                    }));

                    const prompt = `Bir öğrencinin performans verilerini analiz et ve öğrenme önerileri sun.
                    
                    Veriler: ${JSON.stringify(taskAnalysisData)}
                    
                    Güçlü alanlar: ${userPerformance.strongSubjects.join(', ') || 'Henüz belirlenemedi'}
                    Gelişim alanları: ${userPerformance.weakSubjects.join(', ') || 'Henüz belirlenemedi'}
                    Ortalama puan: ${userPerformance.averageScore}
                    
                    Bu verilerden 2-3 tane kişiselleştirilmiş öğrenme önerisi oluştur. Her öneri için type, title, description ve suggestion alanları olsun.
                    type: 'strength', 'weakness', 'opportunity', 'warning' değerlerinden biri
                    Çocuğa hitap ederek, pozitif ve motive edici bir dil kullan.`;

                    const response = await ai.models.generateContent({
                        model: "gemini-2.5-flash",
                        contents: [{
                            role: "user",
                            parts: [{ text: prompt }]
                        }]
                    });

                    const aiText = response.text || '';
                    // AI'dan gelen metni parse etmeye çalış
                    if (aiText.includes('strength') || aiText.includes('weakness')) {
                        // Basit regex ile AI önerilerini çıkar
                        const lines = aiText.split('\n').filter((line: string) => line.trim());
                        let currentInsight: Partial<LearningInsight> = {};
                        
                        lines.forEach((line: string) => {
                            if (line.toLowerCase().includes('güçlü') || line.toLowerCase().includes('strength')) {
                                if (currentInsight.title) newInsights.push(currentInsight as LearningInsight);
                                currentInsight = {
                                    type: 'strength',
                                    title: line.replace(/^\d+\.?\s*/, '').trim(),
                                    description: '',
                                    actionable: true
                                };
                            } else if (line.toLowerCase().includes('gelişim') || line.toLowerCase().includes('weakness')) {
                                if (currentInsight.title) newInsights.push(currentInsight as LearningInsight);
                                currentInsight = {
                                    type: 'weakness',
                                    title: line.replace(/^\d+\.?\s*/, '').trim(),
                                    description: '',
                                    actionable: true
                                };
                            } else if (line.toLowerCase().includes('fırsat') || line.toLowerCase().includes('opportunity')) {
                                if (currentInsight.title) newInsights.push(currentInsight as LearningInsight);
                                currentInsight = {
                                    type: 'opportunity',
                                    title: line.replace(/^\d+\.?\s*/, '').trim(),
                                    description: '',
                                    actionable: true
                                };
                            } else if (currentInsight.title && line.trim()) {
                                if (!currentInsight.description) {
                                    currentInsight.description = line.trim();
                                } else {
                                    currentInsight.suggestion = line.trim();
                                }
                            }
                        });
                        
                        if (currentInsight.title) newInsights.push(currentInsight as LearningInsight);
                    }
                } catch (error) {
                    console.error('AI analiz hatası:', error);
                    // AI başarısız olursa statik analizi kullan
                }
            }

            // Eğer AI analizi başarısız oldu veya veri yetersizse, statik analizi kullan
            if (newInsights.length === 0) {
                // Güçlü yön analizi
                if (userPerformance.strongSubjects.length > 0) {
                    newInsights.push({
                        type: 'strength',
                        title: 'Güçlü Alanlarınız',
                        description: `${userPerformance.strongSubjects.join(', ')} konularında harika performans gösteriyorsunuz!`,
                        actionable: true,
                        suggestion: 'Bu güçlü yönlerinizi zayıf alanlarınıza bağlayarak çapraz öğrenme yapabilirsiniz.'
                    });
                }

                // Zayıf yön analizi
                if (userPerformance.weakSubjects.length > 0) {
                    newInsights.push({
                        type: 'weakness',
                        title: 'Gelişim Alanlarınız',
                        description: `${userPerformance.weakSubjects.join(', ')} konularında daha fazla pratik yapmanız faydalı olacaktır.`,
                        actionable: true,
                        suggestion: 'Bu konularda küçük hedefler belirleyerek günlük 15-20 dakika çalışma yapın.'
                    });
                }

                // Performans trendi analizi
                if (recentTasks.length >= 3) {
                    const avgRecentScore = recentTasks.reduce((sum, task) => sum + (task.successScore || 0), 0) / recentTasks.length;
                    const overallAvg = userPerformance.averageScore;
                    
                    if (avgRecentScore > overallAvg + 10) {
                        newInsights.push({
                            type: 'opportunity',
                            title: 'Yükselişte Performans',
                            description: 'Son hafta performansınız genel ortalamanızın üzerinde!',
                            actionable: true,
                            suggestion: 'Bu ivmeyi korumak için çalışma düzeninizi sürdürün ve biraz daha zorlu görevlere geçmeyi deneyin.'
                        });
                    } else if (avgRecentScore < overallAvg - 10) {
                        newInsights.push({
                            type: 'warning',
                            title: 'Dikkat: Performans Düşüşü',
                            description: 'Son hafta performansınızda düşüş gözlemlendi.',
                            actionable: true,
                            suggestion: 'Çalışma stratejinizi gözden geçirin. Belki mola vermenin veya farklı yöntemler denemenin zamanı gelmiştir.'
                        });
                    }
                }

                // Öğrenme stili önerisi
                const styleInsight = getLearningStylaInsight(userPerformance.learningStyle);
                if (styleInsight) {
                    newInsights.push(styleInsight);
                }
            }

            setInsights(newInsights);
        };

        generateInsights();
    }, [tasks, userPerformance, ai]);

    // Kişiselleştirilmiş çalışma planı oluşturma
    const generatePersonalizedStudyPlan = async () => {
        const completedTasks = tasks.filter(t => t.status === 'tamamlandı');
        
        // AI destekli plan oluşturma (eğer yeterli veri varsa)
        if (completedTasks.length >= 3 && ai) {
            try {
                const prompt = `Bir öğrenci için kişiselleştirilmiş 60 dakikalık çalışma planı oluştur.
                
                Öğrenci Profili:
                - Güçlü alanlar: ${userPerformance.strongSubjects.join(', ') || 'Henüz belirlenemedi'}
                - Gelişim alanları: ${userPerformance.weakSubjects.join(', ') || 'Henüz belirlenemedi'}  
                - Ortalama başarı: ${userPerformance.averageScore}%
                - Öğrenme stili: ${userPerformance.learningStyle}
                
                Lütfen şu formatda bir çalışma planı oluştur:
                1. Toplam süre 60 dakika olsun
                2. 4-5 aktivite içersin
                3. Her aktivite için konu, süre, açıklama belirt
                4. Mutlaka mola ekle
                5. Zayıf konulara odaklan ama güçlü alanları da dahil et
                
                JSON formatında döndür: {"title": "Plan Başlığı", "activities": [{"subject": "Konu", "duration": 20, "description": "Açıklama", "type": "review"}]}`;

                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: [{
                        role: "user",
                        parts: [{ text: prompt }]
                    }]
                });

                const aiText = response.text || '';
                let aiPlan = null;
                
                // JSON parse etmeye çalış
                try {
                    const jsonMatch = aiText.match(/\{.*\}/s);
                    if (jsonMatch) {
                        aiPlan = JSON.parse(jsonMatch[0]);
                    }
                } catch (e) {
                    console.error('AI plan parse hatası:', e);
                }

                if (aiPlan && aiPlan.activities) {
                    const plan: StudyPlan = {
                        id: `ai_plan_${Date.now()}`,
                        title: aiPlan.title || 'AI Destekli Çalışma Planınız',
                        duration: aiPlan.activities.reduce((sum: number, act: any) => sum + (act.duration || 0), 0),
                        difficulty: 'orta',
                        focus: userPerformance.weakSubjects.slice(0, 2),
                        activities: aiPlan.activities.map((act: any) => ({
                            type: act.type || 'review',
                            subject: act.subject || 'Genel',
                            duration: act.duration || 15,
                            description: act.description || 'AI önerisi',
                            resources: act.resources || ['Ders notlarınız', 'Kitaplarınız']
                        }))
                    };

                    setSuggestedPlan(plan);
                    onSuggestStudyPlan(plan);
                    return;
                }
            } catch (error) {
                console.error('AI plan oluşturma hatası:', error);
            }
        }

        // AI başarısız olursa veya veri yetersizse statik plan oluştur
        const plan: StudyPlan = {
            id: `plan_${Date.now()}`,
            title: 'Kişiselleştirilmiş Çalışma Planınız',
            duration: 60,
            difficulty: 'orta',
            focus: userPerformance.weakSubjects.slice(0, 2),
            activities: []
        };

        // Zayıf konularda tekrar
        if (userPerformance.weakSubjects.length > 0) {
            plan.activities.push({
                type: 'review',
                subject: userPerformance.weakSubjects[0],
                duration: 20,
                description: `${userPerformance.weakSubjects[0]} konusunda temel kavramları tekrar edin`,
                resources: ['Not defteriniz', 'Önceki ödevler', 'Online kaynaklar']
            });
        }

        // Mola
        plan.activities.push({
            type: 'break',
            subject: 'Dinlenme',
            duration: 10,
            description: 'Kısa bir mola verin, nefes egzersizi yapın veya hafif esnetme hareketleri yapın'
        });

        // Pratik yapma
        if (userPerformance.weakSubjects.length > 1) {
            plan.activities.push({
                type: 'practice',
                subject: userPerformance.weakSubjects[1],
                duration: 25,
                description: `${userPerformance.weakSubjects[1]} konusunda pratik sorular çözün`,
                resources: ['Alıştırma kitabı', 'Online quiz', 'Geçmiş sınav soruları']
            });
        }

        // Güçlü alanla bağlantı kurma
        if (userPerformance.strongSubjects.length > 0) {
            plan.activities.push({
                type: 'new_concept',
                subject: 'Çapraz Öğrenme',
                duration: 5,
                description: `${userPerformance.strongSubjects[0]} bilginizi ${userPerformance.weakSubjects[0]} ile nasıl bağlayabileceğinizi düşünün`
            });
        }

        setSuggestedPlan(plan);
        onSuggestStudyPlan(plan);
    };

    const getLearningStylaInsight = (style: string): LearningInsight | null => {
        const suggestions = {
            visual: {
                title: 'Görsel Öğrenme Stili',
                description: 'Görsel öğrenme stilinize uygun yöntemler kullanıyorsunuz.',
                suggestion: 'Zihin haritaları, şemalar ve renkli notlar kullanarak öğrenmenizi güçlendirebilirsiniz.'
            },
            auditory: {
                title: 'İşitsel Öğrenme Stili',
                description: 'Ses ve diyalogla öğrenmeniz daha etkili.',
                suggestion: 'Sesli okuma, tartışma grupları ve podcast dinleme yöntemlerini deneyin.'
            },
            kinesthetic: {
                title: 'Kinestetik Öğrenme Stili',
                description: 'Hareket ederek ve deneyimleyerek öğrenirsiniz.',
                suggestion: 'Pratik uygulamalar, deney yapma ve not alma sırasında hareket etmeyi deneyin.'
            },
            mixed: {
                title: 'Karma Öğrenme Stili',
                description: 'Farklı öğrenme yöntemlerini birleştirme beceriniz var.',
                suggestion: 'Bu avantajınızı kullanarak görsel, işitsel ve praktik yöntemleri bir arada deneyin.'
            }
        };

        const suggestion = suggestions[style as keyof typeof suggestions];
        if (suggestion) {
            return {
                type: 'opportunity',
                title: suggestion.title,
                description: suggestion.description,
                actionable: true,
                suggestion: suggestion.suggestion
            };
        }
        return null;
    };

    const getInsightIcon = (type: string) => {
        switch (type) {
            case 'strength': return <TrendingUp className="w-6 h-6 text-green-500" />;
            case 'weakness': return <TrendingDown className="w-6 h-6 text-red-500" />;
            case 'opportunity': return <Lightbulb className="w-6 h-6 text-yellow-500" />;
            case 'warning': return <Target className="w-6 h-6 text-orange-500" />;
            default: return <Brain className="w-6 h-6 text-slate-500" />;
        }
    };

    const getInsightColor = (type: string) => {
        switch (type) {
            case 'strength': return 'border-green-200 bg-green-50';
            case 'weakness': return 'border-red-200 bg-red-50';
            case 'opportunity': return 'border-yellow-200 bg-yellow-50';
            case 'warning': return 'border-orange-200 bg-orange-50';
            default: return 'border-slate-200 bg-slate-50';
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg">
            {/* Başlık */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                    <h3 className="text-2xl font-bold text-slate-800 flex items-center">
                        <Brain className="w-7 h-7 mr-3 text-primary-600" />
                        Yapay Zeka Öğrenme Asistanınız
                    </h3>
                    <div className="ml-2 group relative">
                        <Info className="w-4 h-4 text-slate-400 cursor-help" />
                        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs px-3 py-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            Çocuğunuzun öğrenme tarzını analiz eder ve kişisel öneriler sunar
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => setShowDetailedAnalysis(!showDetailedAnalysis)}
                    className="bg-primary-100 text-primary-700 px-4 py-2 rounded-lg hover:bg-primary-200 transition text-sm font-semibold"
                >
                    {showDetailedAnalysis ? 'Özet Görünüm' : 'Detaylı Analiz'}
                </button>
            </div>

            {/* Performans Özeti */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-600 text-sm font-semibold">Tamamlama Oranı</p>
                            <p className="text-2xl font-bold text-blue-800">%{userPerformance.completionRate}</p>
                        </div>
                        <Target className="w-8 h-8 text-blue-500" />
                    </div>
                </div>
                
                <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-green-600 text-sm font-semibold">Ortalama Puan</p>
                            <p className="text-2xl font-bold text-green-800">{userPerformance.averageScore}</p>
                        </div>
                        <Zap className="w-8 h-8 text-green-500" />
                    </div>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-purple-600 text-sm font-semibold">Öğrenme Stili</p>
                            <p className="text-sm font-bold text-purple-800 capitalize">{userPerformance.learningStyle}</p>
                        </div>
                        <BookOpen className="w-8 h-8 text-purple-500" />
                    </div>
                </div>
            </div>

            {/* Yapay Zeka İçgörüleri */}
            <div className="mb-6">
                <h4 className="font-bold text-slate-700 mb-4">🤖 AI İçgörüleri</h4>
                <div className="space-y-3">
                    {insights.map((insight, index) => (
                        <div key={index} className={`p-4 rounded-lg border ${getInsightColor(insight.type)}`}>
                            <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 mt-1">
                                    {getInsightIcon(insight.type)}
                                </div>
                                <div className="flex-1">
                                    <h5 className="font-semibold text-slate-800 mb-1">{insight.title}</h5>
                                    <p className="text-slate-600 text-sm mb-2">{insight.description}</p>
                                    {insight.suggestion && (
                                        <div className="bg-white bg-opacity-50 p-2 rounded border border-current border-opacity-20">
                                            <p className="text-xs text-slate-700">
                                                <strong>Öneri:</strong> {insight.suggestion}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Kişiselleştirilmiş Çalışma Planı */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-slate-700 flex items-center">
                        <Calendar className="w-5 h-5 mr-2 text-primary-600" />
                        Önerilen Çalışma Planı
                    </h4>
                    <button
                        onClick={generatePersonalizedStudyPlan}
                        className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition text-sm font-semibold"
                    >
                        Yeni Plan Oluştur
                    </button>
                </div>

                {suggestedPlan ? (
                    <div className="bg-gradient-to-r from-primary-50 to-primary-100 p-5 rounded-lg border border-primary-200">
                        <h5 className="font-bold text-primary-800 mb-3">{suggestedPlan.title}</h5>
                        <div className="mb-4">
                            <span className="inline-block bg-primary-200 text-primary-800 px-3 py-1 rounded-full text-xs font-semibold mr-2">
                                ⏱ {suggestedPlan.duration} dakika
                            </span>
                            <span className="inline-block bg-primary-200 text-primary-800 px-3 py-1 rounded-full text-xs font-semibold">
                                📊 {suggestedPlan.difficulty}
                            </span>
                        </div>
                        
                        <div className="space-y-3">
                            {suggestedPlan.activities.map((activity, index) => (
                                <div key={index} className="bg-white bg-opacity-70 p-3 rounded border border-primary-200 border-opacity-50">
                                    <div className="flex items-center space-x-3">
                                        <span className="bg-primary-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                                            {index + 1}
                                        </span>
                                        <div className="flex-1">
                                            <h6 className="font-semibold text-slate-800 text-sm">
                                                {activity.subject} ({activity.duration}dk)
                                            </h6>
                                            <p className="text-slate-600 text-xs">{activity.description}</p>
                                            {activity.resources && (
                                                <div className="mt-2">
                                                    <p className="text-xs text-slate-500">
                                                        <strong>Kaynaklar:</strong> {activity.resources.join(', ')}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-200">
                        <Brain className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                        <p className="text-slate-500 text-sm">
                            Kişiselleştirilmiş çalışma planı oluşturmak için yukarıdaki butona tıklayın
                        </p>
                    </div>
                )}
            </div>

            {/* Detaylı Analiz */}
            {showDetailedAnalysis && (
                <div className="bg-slate-50 p-5 rounded-lg border border-slate-200">
                    <h4 className="font-bold text-slate-700 mb-4">📊 Detaylı Performans Analizi</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h5 className="font-semibold text-slate-600 mb-3">Güçlü Alanlarınız</h5>
                            {userPerformance.strongSubjects.length > 0 ? (
                                <ul className="space-y-1">
                                    {userPerformance.strongSubjects.map((subject, index) => (
                                        <li key={index} className="text-green-700 text-sm flex items-center">
                                            <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                                            {subject}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-slate-500 text-sm">Henüz güçlü alan belirlenemedi</p>
                            )}
                        </div>

                        <div>
                            <h5 className="font-semibold text-slate-600 mb-3">Gelişim Alanlarınız</h5>
                            {userPerformance.weakSubjects.length > 0 ? (
                                <ul className="space-y-1">
                                    {userPerformance.weakSubjects.map((subject, index) => (
                                        <li key={index} className="text-red-700 text-sm flex items-center">
                                            <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                                            {subject}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-slate-500 text-sm">Tüm alanlarda dengeli performans</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PersonalizedLearningAssistant;