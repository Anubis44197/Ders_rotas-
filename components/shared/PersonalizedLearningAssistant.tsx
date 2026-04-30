import React, { useEffect, useMemo, useState } from 'react';
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
  duration: number;
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
  ai,
}) => {
  const [insights, setInsights] = useState<LearningInsight[]>([]);
  const [suggestedPlan, setSuggestedPlan] = useState<StudyPlan | null>(null);
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState(false);

  const completedTasks = useMemo(() => tasks.filter((task) => task.status === 'tamamland\u0131'), [tasks]);

  useEffect(() => {
    const nextInsights: LearningInsight[] = [];

    if (userPerformance.strongSubjects.length > 0) {
      nextInsights.push({
        type: 'strength',
        title: 'Guclu Alanlar',
        description: `${userPerformance.strongSubjects.join(', ')} alanlarinda istikrarli performans var.`,
        actionable: true,
        suggestion: 'Guclu oldugun dersleri odak isteyen konulari tekrar etmek icin kaldirac olarak kullan.',
      });
    }

    if (userPerformance.weakSubjects.length > 0) {
      nextInsights.push({
        type: 'weakness',
        title: 'Gelisim Gereken Alanlar',
        description: `${userPerformance.weakSubjects.join(', ')} icin daha sik tekrar ve soru cozum akisi gerekli.`,
        actionable: true,
        suggestion: 'Bu konulari kisa ama duzenli oturumlarla calis ve ilerlemeyi haftalik kontrol et.',
      });
    }

    if (completedTasks.length >= 5) {
      nextInsights.push({
        type: 'opportunity',
        title: 'Veri Birikiyor',
        description: 'Yeterli oturum verisi olustukca konu bazli analiz daha isabetli hale gelir.',
        actionable: true,
        suggestion: 'Her gorevde sure, odak ve dogruluk alanlarini duzenli doldur.',
      });
    }

    nextInsights.push({
      type: 'warning',
      title: ai ? 'AI Hazir' : 'AI Opsiyonel',
      description: ai ? 'Yapay zeka servisi etkin. Oneriler zamanla daha dinamik uretilebilir.' : 'AI bagli degil. Uygulama yine de yerel analiz ve plan uretimi ile calisir.',
      actionable: false,
    });

    setInsights(nextInsights);
  }, [ai, completedTasks.length, userPerformance]);

  const generatePersonalizedStudyPlan = () => {
    const focus = userPerformance.weakSubjects.slice(0, 2);
    const plan: StudyPlan = {
      id: `plan_${Date.now()}`,
      title: 'Kisisellestirilmis Calisma Plani',
      duration: 60,
      difficulty: userPerformance.averageScore >= 80 ? 'orta' : 'kolay',
      focus,
      activities: [
        {
          type: 'review',
          subject: focus[0] || userPerformance.strongSubjects[0] || 'Genel Tekrar',
          duration: 20,
          description: 'Temel kavramlari gozden gecir ve kisa notlar cikar.',
          resources: ['Defter', 'Konu ozeti'],
        },
        {
          type: 'break',
          subject: 'Mola',
          duration: 10,
          description: 'Kisa mola ver ve dikkatini tazele.',
        },
        {
          type: 'practice',
          subject: focus[1] || focus[0] || 'Soru Cozumu',
          duration: 25,
          description: 'Hedef konu uzerinden soru cozerek eksikleri bul.',
          resources: ['Soru bankasi', 'Deneme notlari'],
        },
        {
          type: 'new_concept',
          subject: userPerformance.strongSubjects[0] || 'Genel Baglanti',
          duration: 5,
          description: 'Guclu oldugun bilgi ile bugunku hedef konuyu bagla.',
        },
      ],
    };

    setSuggestedPlan(plan);
    onSuggestStudyPlan(plan);
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'strength':
        return <TrendingUp className="h-6 w-6 text-green-500" />;
      case 'weakness':
        return <TrendingDown className="h-6 w-6 text-red-500" />;
      case 'opportunity':
        return <Lightbulb className="h-6 w-6 text-yellow-500" />;
      case 'warning':
        return <Target className="h-6 w-6 text-orange-500" />;
      default:
        return <Brain className="h-6 w-6 text-slate-500" />;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'strength':
        return 'border-green-200 bg-green-50';
      case 'weakness':
        return 'border-red-200 bg-red-50';
      case 'opportunity':
        return 'border-yellow-200 bg-yellow-50';
      case 'warning':
        return 'border-orange-200 bg-orange-50';
      default:
        return 'border-slate-200 bg-slate-50';
    }
  };

  return (
    <div className="rounded-xl bg-white p-6 shadow-lg">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center">
          <h3 className="flex items-center text-2xl font-bold text-slate-800">
            <Brain className="mr-3 h-7 w-7 text-primary-600" />
            Ogrenme Asistani
          </h3>
          <div className="group relative ml-2">
            <Info className="h-4 w-4 cursor-help text-slate-400" />
            <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-3 py-2 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              Yerel analiz verilerine gore kisa oneriler sunar.
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowDetailedAnalysis((value) => !value)}
          className="rounded-lg bg-primary-100 px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-200"
        >
          {showDetailedAnalysis ? 'Ozet Gorunum' : 'Detayli Analiz'}
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100 p-4">
          <p className="text-sm font-semibold text-blue-600">Tamamlama Orani</p>
          <p className="text-2xl font-bold text-blue-800">%{userPerformance.completionRate}</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-gradient-to-r from-green-50 to-green-100 p-4">
          <p className="text-sm font-semibold text-green-600">Ortalama Puan</p>
          <p className="text-2xl font-bold text-green-800">{userPerformance.averageScore}</p>
        </div>
        <div className="rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-purple-100 p-4">
          <p className="text-sm font-semibold text-purple-600">Ogrenme Stili</p>
          <p className="text-sm font-bold capitalize text-purple-800">{userPerformance.learningStyle}</p>
        </div>
      </div>

      <div className="mb-6">
        <h4 className="mb-4 font-bold text-slate-700">Akilli Oneriler</h4>
        <div className="space-y-3">
          {insights.map((insight, index) => (
            <div key={index} className={`rounded-lg border p-4 ${getInsightColor(insight.type)}`}>
              <div className="flex items-start space-x-3">
                <div className="mt-1 flex-shrink-0">{getInsightIcon(insight.type)}</div>
                <div className="flex-1">
                  <h5 className="mb-1 font-semibold text-slate-800">{insight.title}</h5>
                  <p className="mb-2 text-sm text-slate-600">{insight.description}</p>
                  {insight.suggestion && (
                    <div className="rounded border border-current border-opacity-20 bg-white/50 p-2">
                      <p className="text-xs text-slate-700">
                        <strong>Oneri:</strong> {insight.suggestion}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="flex items-center font-bold text-slate-700">
            <Calendar className="mr-2 h-5 w-5 text-primary-600" />
            Onerilen Calisma Plani
          </h4>
          <button
            onClick={generatePersonalizedStudyPlan}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            Yeni Plan Olustur
          </button>
        </div>

        {suggestedPlan ? (
          <div className="rounded-lg border border-primary-200 bg-gradient-to-r from-primary-50 to-primary-100 p-5">
            <h5 className="mb-3 font-bold text-primary-800">{suggestedPlan.title}</h5>
            <div className="mb-4">
              <span className="mr-2 inline-block rounded-full bg-primary-200 px-3 py-1 text-xs font-semibold text-primary-800">
                {suggestedPlan.duration} dakika
              </span>
              <span className="inline-block rounded-full bg-primary-200 px-3 py-1 text-xs font-semibold text-primary-800">
                {suggestedPlan.difficulty}
              </span>
            </div>
            <div className="space-y-3">
              {suggestedPlan.activities.map((activity, index) => (
                <div key={index} className="rounded border border-primary-200 border-opacity-50 bg-white/70 p-3">
                  <div className="flex items-center space-x-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <h6 className="text-sm font-semibold text-slate-800">
                        {activity.subject} ({activity.duration} dk)
                      </h6>
                      <p className="text-xs text-slate-600">{activity.description}</p>
                      {activity.resources && (
                        <p className="mt-2 text-xs text-slate-500">
                          <strong>Kaynaklar:</strong> {activity.resources.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 py-8 text-center">
            <Brain className="mx-auto mb-3 h-12 w-12 text-slate-400" />
            <p className="text-sm text-slate-500">Yukaridaki buton ile kisa bir calisma plani uretebilirsin.</p>
          </div>
        )}
      </div>

      {showDetailedAnalysis && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
          <h4 className="mb-4 font-bold text-slate-700">Detayli Performans Analizi</h4>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <h5 className="mb-3 font-semibold text-slate-600">Guclu Alanlar</h5>
              {userPerformance.strongSubjects.length > 0 ? (
                <ul className="space-y-1">
                  {userPerformance.strongSubjects.map((subject, index) => (
                    <li key={index} className="flex items-center text-sm text-green-700">
                      <span className="mr-2 h-2 w-2 rounded-full bg-green-500"></span>
                      {subject}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Henuz belirgin guclu alan yok.</p>
              )}
            </div>
            <div>
              <h5 className="mb-3 font-semibold text-slate-600">Gelisim Alanlari</h5>
              {userPerformance.weakSubjects.length > 0 ? (
                <ul className="space-y-1">
                  {userPerformance.weakSubjects.map((subject, index) => (
                    <li key={index} className="flex items-center text-sm text-red-700">
                      <span className="mr-2 h-2 w-2 rounded-full bg-red-500"></span>
                      {subject}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Performans dengeli gorunuyor.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalizedLearningAssistant;


