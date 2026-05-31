import React from 'react';
import { AnalysisSnapshot } from '../../utils/analysisEngine';
import { AlertTriangle, CheckCircle, Target, TrendingUp } from '../icons';

interface ParentBriefingWorkspaceProps {
  analysis: AnalysisSnapshot;
  loading?: boolean;
  error?: string | null;
}

const getStatus = (score: number, risk: number) => {
  if (score < 60 || risk >= 65) {
    return {
      label: 'Mudahale gerekli',
      tone: 'dr-status-pill dr-status-pill-critical',
      icon: AlertTriangle,
    };
  }

  if (score < 75 || risk >= 45) {
    return {
      label: 'Yakin takip',
      tone: 'dr-status-pill dr-status-pill-warning',
      icon: Target,
    };
  }

  return {
    label: 'Dengeli ilerleme',
    tone: 'dr-status-pill dr-status-pill-success',
    icon: CheckCircle,
  };
};

const ParentBriefingWorkspace: React.FC<ParentBriefingWorkspaceProps> = ({ analysis, loading, error }) => {
  if (loading) {
    return <div className="ios-card rounded-[26px] px-4 py-8 text-center text-sm text-slate-500">Genel ozet yukleniyor...</div>;
  }

  if (error) {
    return <div className="ios-card ios-coral rounded-[26px] px-4 py-8 text-center text-sm text-rose-800">{error}</div>;
  }

  if (analysis.sessions.length < 3) {
    return null;
  }

  const weakTopic = analysis.topics.find((topic) => topic.needsRevision);
  const bestCourse = [...analysis.courses].sort((left, right) => right.averageMastery - left.averageMastery)[0];
  const hasAnalysisData = analysis.sessions.length > 0 && analysis.overall.completedTasks > 0;
  const status = hasAnalysisData
    ? getStatus(analysis.overall.generalScore, analysis.overall.averageRisk)
    : {
        label: 'Veri bekleniyor',
        tone: 'dr-status-pill',
        icon: TrendingUp,
      };
  const StatusIcon = status.icon;
  const metricItems = hasAnalysisData
    ? [
        { label: 'Genel Skor', value: analysis.overall.generalScore, hint: '0-100' },
        { label: 'Tamamlanan', value: analysis.overall.completedTasks, hint: 'oturum' },
        { label: 'Odak', value: analysis.overall.averageFocus, hint: 'ortalama' },
        { label: 'Hakimiyet', value: analysis.overall.averageMastery, hint: 'ortalama' },
      ]
    : [
        { label: 'Genel Skor', value: '-', hint: 'veri yok' },
        { label: 'Tamamlanan', value: '-', hint: 'oturum yok' },
        { label: 'Odak', value: '-', hint: 'veri yok' },
        { label: 'Hakimiyet', value: '-', hint: 'veri yok' },
      ];

  return (
    <section className="ios-card overflow-hidden rounded-[32px]">
      <div className="p-6 lg:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Genel Bakis</div>
            <h3 className="mt-2 text-2xl font-black text-slate-950">Bugunku karar ozeti</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {weakTopic
                ? `${weakTopic.courseName} / ${weakTopic.topicName} bu hafta takip edilmesi gereken konu.`
                : bestCourse
                  ? `${bestCourse.courseName} su anda en guclu ders.`
                  : 'Veri biriktikce veli icin sonraki adim burada netlesir.'}
            </p>
          </div>

          <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black ${status.tone}`}>
            <StatusIcon className="h-4 w-4" />
            {status.label}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {metricItems.map((item) => (
            <div key={item.label} className="ios-widget dr-briefing-score-card rounded-[24px] px-4 py-4">
              <div className="dr-card-kicker text-xs font-bold uppercase tracking-[0.14em]">{item.label}</div>
              <div className="mt-2 text-3xl font-black tracking-tight text-slate-950">{item.value}</div>
              <div className="mt-1 text-xs font-semibold text-slate-400">{item.hint}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ParentBriefingWorkspace;
