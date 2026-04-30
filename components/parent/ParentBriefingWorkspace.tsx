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
      label: 'Müdahale gerekli',
      tone: 'dr-status-pill dr-status-pill-critical',
      accent: 'bg-[#FF9AA2]',
      icon: AlertTriangle,
    };
  }

  if (score < 75 || risk >= 45) {
    return {
      label: 'Yakın takip',
      tone: 'dr-status-pill dr-status-pill-warning',
      accent: 'bg-[#FFE08A]',
      icon: Target,
    };
  }

  return {
    label: 'Dengeli ilerleme',
    tone: 'dr-status-pill dr-status-pill-success',
    accent: 'bg-[#7EE7C7]',
    icon: CheckCircle,
  };
};

const ParentBriefingWorkspace: React.FC<ParentBriefingWorkspaceProps> = ({ analysis, loading, error }) => {
  if (loading) {
    return <div className="ios-card rounded-[26px] px-4 py-8 text-center text-sm text-slate-500">Genel özet yükleniyor...</div>;
  }

  if (error) {
    return <div className="ios-card ios-coral rounded-[26px] px-4 py-8 text-center text-sm text-rose-800">{error}</div>;
  }

  const weakTopic = analysis.topics.find((topic) => topic.needsRevision);
  const bestCourse = [...analysis.courses].sort((left, right) => right.averageMastery - left.averageMastery)[0];
  const status = getStatus(analysis.overall.generalScore, analysis.overall.averageRisk);
  const StatusIcon = status.icon;

  return (
    <section className="ios-card overflow-hidden rounded-[32px]">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="p-6 lg:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Genel Bakış</div>
              <h3 className="mt-2 text-2xl font-black text-slate-950">Bugünkü akademik tablo</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                {weakTopic
                  ? `${weakTopic.courseName} / ${weakTopic.topicName} öncelikli takip alanı.`
                  : bestCourse
                    ? `${bestCourse.courseName} şu anda en güçlü ders.`
                    : 'Analiz verisi biriktikçe öncelikli ders ve konu burada netleşir.'}
              </p>
            </div>

            <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black ${status.tone}`}>
              <StatusIcon className="h-4 w-4" />
              {status.label}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: 'Genel Skor', value: analysis.overall.generalScore, hint: '0-100' },
              { label: 'Tamamlanan', value: analysis.overall.completedTasks, hint: 'oturum' },
              { label: 'Odak', value: analysis.overall.averageFocus, hint: 'ortalama' },
              { label: 'Hakimiyet', value: analysis.overall.averageMastery, hint: 'ortalama' },
            ].map((item) => (
              <div key={item.label} className="ios-widget dr-briefing-score-card rounded-[24px] px-4 py-4">
                <div className="dr-card-kicker text-xs font-bold uppercase tracking-[0.14em]">{item.label}</div>
                <div className="mt-2 text-3xl font-black tracking-tight text-slate-950">{item.value}</div>
                <div className="mt-1 text-xs font-semibold text-slate-400">{item.hint}</div>
              </div>
            ))}
          </div>
        </div>

        <aside className="ios-ink border-t border-white/20 p-6 text-white lg:border-l lg:border-t-0 lg:p-7">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            <TrendingUp className="h-4 w-4" />
            Öncelik
          </div>
          <div className="mt-4 text-xl font-black leading-7">
            {weakTopic ? 'Tekrar planı açılmalı' : analysis.overall.completedTasks > 0 ? 'Mevcut ritim korunmalı' : 'İlk çalışma verisi bekleniyor'}
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {weakTopic
              ? `${weakTopic.unitName} / ${weakTopic.topicName} için kısa, ölçülebilir bir tekrar görevi en doğru sonraki adım.`
              : analysis.overall.completedTasks > 0
                ? 'Odak, verim ve doğruluk dengesi takipte kalmalı.'
                : 'Görev tamamlandıkça analiz güveni artar.'}
          </p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/20">
            <div className={`h-full ${status.accent}`} style={{ width: `${Math.max(6, Math.min(100, analysis.overall.generalScore))}%` }} />
          </div>
        </aside>
      </div>
    </section>
  );
};

export default ParentBriefingWorkspace;
