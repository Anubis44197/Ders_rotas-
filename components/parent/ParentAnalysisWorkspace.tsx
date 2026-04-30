import React, { useMemo, useState } from 'react';
import { Course, ParentDashboardProps, ReportData, Task } from '../../types';
import { AnalysisSnapshot } from '../../utils/analysisEngine';
import AnalysisGraphCenter from './AnalysisGraphCenter';
import { alignmentLabelMap, alignmentToneMap, examTypeLabelMap } from './parentDashboardShared';
import { AlertTriangle, BarChart, BookOpen, CheckCircle, ClipboardList, FileText, Target, TrendingUp } from '../icons';
import ContextHelp from '../shared/ContextHelp';

const surface = 'ios-card rounded-[30px] p-5';
const subtleSurface = 'ios-widget rounded-[24px] p-4';

type AnalysisWorkspaceTab = 'overview' | 'insights' | 'alignment' | 'reports';
type ReportPeriod = ReportData['period'];

interface ParentAnalysisWorkspaceProps {
  tasks: Task[];
  courses: Course[];
  curriculum: ParentDashboardProps['curriculum'];
  analysis: AnalysisSnapshot;
  examRecords: NonNullable<ParentDashboardProps['examRecords']>;
  compositeExamResults: NonNullable<ParentDashboardProps['compositeExamResults']>;
  generateReport: ParentDashboardProps['generateReport'];
  loading?: ParentDashboardProps['loading'];
  error?: ParentDashboardProps['error'];
  viewMode: NonNullable<ParentDashboardProps['viewMode']>;
}

const analysisWorkspaceTabs: Array<{ id: AnalysisWorkspaceTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Performans', icon: Target },
  { id: 'insights', label: 'Odak Alanlari', icon: AlertTriangle },
  { id: 'alignment', label: 'Okul Uyumu', icon: ClipboardList },
  { id: 'reports', label: 'Raporlar', icon: BarChart },
];

const reportPeriods: ReportPeriod[] = ['Haftalık', 'Aylık', 'Yıllık', 'Tüm Zamanlar'];

const getScoreTone = (score: number) => {
  if (score >= 85) return 'ios-mint';
  if (score >= 70) return 'ios-blue';
  if (score >= 55) return 'ios-peach';
  return 'ios-coral';
};

const getRiskTone = (risk: number) => {
  if (risk >= 65) return 'dr-status-pill dr-status-pill-critical';
  if (risk >= 45) return 'dr-status-pill dr-status-pill-warning';
  return 'dr-status-pill dr-status-pill-success';
};

const ProgressBar: React.FC<{ value: number; tone?: string }> = ({ value, tone = 'bg-[#8AB4FF]' }) => (
  <div className="ios-progress-track h-2 overflow-hidden rounded-full">
    <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
  </div>
);

const ParentAnalysisWorkspace: React.FC<ParentAnalysisWorkspaceProps> = ({
  tasks,
  courses,
  curriculum,
  analysis,
  examRecords,
  compositeExamResults,
  generateReport,
  loading,
  error,
  viewMode,
}) => {
  const [analysisWorkspaceTab, setAnalysisWorkspaceTab] = useState<AnalysisWorkspaceTab>('overview');
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('Haftalık');
  const [report, setReport] = useState<ReportData | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const completedTasksForMetrics = useMemo(() => tasks.filter((task) => task.status === 'tamamlandı'), [tasks]);
  const weakTopics = useMemo(() => analysis.topics.filter((topic) => topic.needsRevision).slice(0, 6), [analysis.topics]);
  const improvingTopics = useMemo(
    () => [...analysis.topics].filter((topic) => topic.trend === 'up').sort((a, b) => b.masteryScore - a.masteryScore).slice(0, 5),
    [analysis.topics],
  );
  const topCourses = useMemo(() => analysis.courses.slice(0, 5), [analysis.courses]);
  const schoolPerformance = useMemo(() => analysis.school.coursePerformance.slice(0, 6), [analysis.school.coursePerformance]);
  const recentExamRecords = analysis.school.examRecords.slice(0, 5);
  const latestStateExam = analysis.school.latestStateExam;
  const pendingCount = tasks.filter((task) => task.status === 'bekliyor').length;
  const completedCount = completedTasksForMetrics.length;
  const solvedQuestionCount = useMemo(() => completedTasksForMetrics
    .filter((task) => task.taskType === 'soru çözme')
    .reduce((sum, task) => {
      const hasRecordedCounts = typeof task.correctCount === 'number' || typeof task.incorrectCount === 'number';
      const answered = (task.correctCount || 0) + (task.incorrectCount || 0);
      return sum + (hasRecordedCounts ? answered : (task.questionCount || 0));
    }, 0), [completedTasksForMetrics]);
  const studiedMinutes = useMemo(() => Math.round(completedTasksForMetrics
    .filter((task) => task.taskType !== 'kitap okuma')
    .reduce((sum, task) => sum + ((task.actualDuration || 0) / 60), 0)), [completedTasksForMetrics]);
  const readPages = useMemo(() => completedTasksForMetrics
    .filter((task) => task.taskType === 'kitap okuma')
    .reduce((sum, task) => sum + (task.pagesRead || 0), 0), [completedTasksForMetrics]);

  const showAnalysis = viewMode === 'all' || viewMode === 'analysis';
  const showSection = (tab: AnalysisWorkspaceTab) => viewMode === 'all' || analysisWorkspaceTab === tab;
  const strongestCourse = topCourses[0];
  const riskiestTopic = weakTopics[0];

  const handleGenerateReport = async () => {
    if (isGeneratingReport) return;
    setIsGeneratingReport(true);
    try {
      const next = await generateReport(reportPeriod);
      setReport(next);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  if (!showAnalysis) return null;

  return (
    <section className="space-y-6">
      {viewMode === 'analysis' && (
        <div className="ios-panel rounded-[30px] p-2">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {analysisWorkspaceTabs.map((tab) => {
              const Icon = tab.icon;
              const active = analysisWorkspaceTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAnalysisWorkspaceTab(tab.id)}
                  className={`flex min-h-16 items-center gap-3 rounded-[22px] px-4 py-3 text-left text-sm font-black transition ${active ? 'ios-button-active' : 'ios-button text-slate-600 hover:bg-white/75'}`}
                >
                  <Icon className="h-5 w-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showSection('overview') && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px]">
          <div className="ios-card rounded-[32px] p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Performans</div>
                <div className="mt-2 flex items-start gap-2">
                  <h3 className="text-2xl font-black text-slate-950">Karar paneli</h3>
                  <ContextHelp title="Skorlar nasil okunur" tone="blue">
                    Panel son tamamlanan oturumlari birlestirir. Risk yukseldikce tekrar, odak ve sure dengesi once incelenir.
                  </ContextHelp>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  {riskiestTopic
                    ? `${riskiestTopic.courseName} / ${riskiestTopic.topicName} öncelikli takipte.`
                    : strongestCourse
                      ? `${strongestCourse.courseName} güçlü görünüyor.`
                      : 'Tamamlanan oturumlar geldikçe ders ve konu resmi netleşir.'}
                </p>
              </div>
              <div className={`rounded-full border px-4 py-2 text-sm font-black ${getRiskTone(analysis.overall.averageRisk)}`}>
                Takip {analysis.overall.averageRisk}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'Genel Skor', value: analysis.overall.generalScore, tone: getScoreTone(analysis.overall.generalScore) },
                { label: 'Odak', value: analysis.overall.averageFocus, tone: getScoreTone(analysis.overall.averageFocus) },
                { label: 'Verim', value: analysis.overall.averageEfficiency, tone: getScoreTone(analysis.overall.averageEfficiency) },
                { label: 'Doğruluk', value: analysis.overall.averageAccuracy ?? '-', tone: getScoreTone(analysis.overall.averageAccuracy ?? 0) },
              ].map((item) => (
                <div key={item.label} className={`dr-analysis-score-card rounded-[24px] p-4 ${item.tone}`}>
                  <div className="text-xs font-black uppercase tracking-[0.14em] opacity-70">{item.label}</div>
                  <div className="mt-2 text-3xl font-black tracking-tight">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className={subtleSurface}>
                <div className="mb-4 flex items-center gap-2">
                  <Target className="h-5 w-5 text-slate-700" />
                  <h4 className="font-black text-slate-950">Çalışma özeti</h4>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="ios-widget ios-blue rounded-[22px] p-4"><div className="text-xs font-bold uppercase text-slate-500">Tamamlanan</div><div className="mt-1 text-2xl font-black">{completedCount}</div></div>
                  <div className="ios-widget ios-peach rounded-[22px] p-4"><div className="text-xs font-bold uppercase text-slate-500">Bekleyen</div><div className="mt-1 text-2xl font-black">{pendingCount}</div></div>
                  <div className="ios-widget ios-lilac rounded-[22px] p-4"><div className="text-xs font-bold uppercase text-slate-500">Soru</div><div className="mt-1 text-2xl font-black">{solvedQuestionCount}</div></div>
                  <div className="ios-widget ios-mint rounded-[22px] p-4"><div className="text-xs font-bold uppercase text-slate-500">Süre</div><div className="mt-1 text-2xl font-black">{studiedMinutes} dk</div></div>
                  <div className="ios-widget ios-yellow rounded-[22px] p-4"><div className="text-xs font-bold uppercase text-slate-500">Sayfa</div><div className="mt-1 text-2xl font-black">{readPages}</div></div>
                  <div className="ios-widget ios-coral rounded-[22px] p-4"><div className="text-xs font-bold uppercase text-slate-500">Oturum</div><div className="mt-1 text-2xl font-black">{analysis.sessions.length}</div></div>
                </div>
              </div>

              <div className={subtleSurface}>
                <div className="mb-4 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-slate-700" />
                  <h4 className="font-black text-slate-950">Ders hakimiyeti</h4>
                </div>
                <div className="space-y-4">
                  {topCourses.length === 0 && <div className="ios-widget rounded-[22px] p-4 text-sm text-slate-500">Ders metriği oluşmadı.</div>}
                  {topCourses.map((course) => (
                    <div key={course.courseId} className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-bold text-slate-800">{course.courseName}</span>
                        <span className="font-black text-slate-950">{course.averageMastery}</span>
                      </div>
                      <ProgressBar value={course.averageMastery} tone={course.weakTopicCount > 0 ? 'bg-[#FFE08A]' : 'bg-[#7EE7C7]'} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="ios-ink rounded-[30px] p-6 text-white">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Sonraki adım</div>
              <div className="mt-3 text-xl font-black leading-7">
                {riskiestTopic ? 'Odak konusuna kisa tekrar' : analysis.overall.completedTasks > 0 ? 'Ritmi koru' : 'Ilk olcumlu gorev'}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {riskiestTopic
                  ? `${riskiestTopic.courseName} / ${riskiestTopic.topicName} için doğruluk ölçümlü bir görev atanmalı.`
                  : analysis.overall.completedTasks > 0
                    ? 'Yeni veri geldikçe trend değişimi izlenmeli.'
                    : 'Soru çözme veya konu tekrarı ilk anlamlı analizi başlatır.'}
              </p>
            </div>

            <div className={surface}>
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <h4 className="font-black text-slate-950">Toparlanan konu</h4>
              </div>
              {improvingTopics[0] ? (
                <div>
                  <div className="text-sm font-bold text-slate-800">{improvingTopics[0].topicName}</div>
                  <div className="mt-1 text-sm text-slate-500">{improvingTopics[0].courseName} / {improvingTopics[0].unitName}</div>
                  <div className="mt-4"><ProgressBar value={improvingTopics[0].masteryScore} tone="bg-[#7EE7C7]" /></div>
                </div>
              ) : (
                <div className="text-sm leading-6 text-slate-500">Yukarı trend yakalandığında burada görünür.</div>
              )}
            </div>
          </aside>
        </div>
      )}

      {showSection('insights') && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
          <div className={surface}>
            <div className="mb-5 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              <h3 className="text-xl font-black text-slate-950">Odak isteyen konular</h3>
            </div>
            <div className="space-y-3">
              {weakTopics.length === 0 && <div className="ios-widget rounded-[24px] p-5 text-sm text-slate-500">Tekrar bayrağı olan konu yok.</div>}
              {weakTopics.map((topic) => (
                <div key={topic.key} className="ios-widget rounded-[24px] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="font-black text-slate-900">{topic.topicName}</div>
                      <div className="mt-1 text-sm text-slate-500">{topic.courseName} / {topic.unitName}</div>
                    </div>
                    <div className={`rounded-full border px-3 py-1 text-xs font-black ${getRiskTone(topic.riskScore)}`}>Takip {topic.riskScore}</div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Hakimiyet</div><ProgressBar value={topic.masteryScore} tone="bg-[#C4B5FD]" /></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Odak</div><ProgressBar value={topic.averageFocus} tone="bg-[#8AB4FF]" /></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Verim</div><ProgressBar value={topic.averageEfficiency} tone="bg-[#7EE7C7]" /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className={surface}>
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <h3 className="text-xl font-black text-slate-950">Gelişenler</h3>
              </div>
              <div className="space-y-3">
                {improvingTopics.length === 0 && <div className="ios-widget rounded-[22px] p-4 text-sm text-slate-500">Yukarı trend yok.</div>}
                {improvingTopics.map((topic) => (
                  <div key={topic.key} className="ios-widget ios-mint rounded-[22px] p-4">
                    <div className="font-bold text-emerald-950">{topic.topicName}</div>
                    <div className="mt-1 text-sm text-emerald-700">{topic.courseName}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className={surface}>
              <h3 className="text-xl font-black text-slate-950">Kısa yorum</h3>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <div className="ios-widget rounded-[22px] p-4">Toplam tamamlanan görev <strong>{completedCount}</strong>, çözülen soru <strong>{solvedQuestionCount}</strong>.</div>
                <div className="ios-widget rounded-[22px] p-4">
                  Ortalama verim <strong>{analysis.overall.averageEfficiency}</strong>. {analysis.overall.averageEfficiency < 60 ? 'Süre ve mola dengesi toparlanmalı.' : 'Oturum kalitesi kabul edilebilir seviyede.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSection('alignment') && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
          <div className={surface}>
            <div className="mb-5 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-slate-700" />
              <h3 className="text-xl font-black text-slate-950">Okul ve ev performansı</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className={subtleSurface}><div className="text-xs font-bold uppercase text-slate-400">Okul sınavı</div><div className="mt-2 text-3xl font-black">{examRecords.length}</div></div>
              <div className={subtleSurface}><div className="text-xs font-bold uppercase text-slate-400">Deneme</div><div className="mt-2 text-3xl font-black">{compositeExamResults.length}</div></div>
              <div className={subtleSurface}><div className="text-xs font-bold uppercase text-slate-400">Son genel</div><div className="mt-2 text-base font-black">{latestStateExam?.title || 'Kayıt yok'}</div></div>
            </div>

            <div className="mt-5 space-y-3">
              {schoolPerformance.length === 0 && <div className="ios-widget rounded-[24px] p-5 text-sm text-slate-500">Okul notu geldikçe uyum analizi oluşur.</div>}
              {schoolPerformance.map((item) => (
                <div key={item.courseId} className="ios-widget rounded-[24px] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="font-black text-slate-900">{item.courseName}</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-white/65 px-2 py-1">Ev {item.studyScore}</span>
                        <span className="rounded-full bg-white/65 px-2 py-1">Okul {item.schoolScore ?? '-'}</span>
                        <span className="rounded-full bg-white/65 px-2 py-1">Beklenen {item.predictedSchoolScore ?? '-'}</span>
                      </div>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${alignmentToneMap[item.alignmentStatus]}`}>{alignmentLabelMap[item.alignmentStatus]}</span>
                  </div>
                  <div className="mt-4 grid gap-2">
                    <ProgressBar value={item.studyScore} tone="bg-[#8AB4FF]" />
                    {item.schoolScore !== null && <ProgressBar value={item.schoolScore} tone="bg-[#C4B5FD]" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={surface}>
            <h3 className="text-xl font-black text-slate-950">Son kayıtlar</h3>
            <div className="mt-4 space-y-3">
              {recentExamRecords.map((record) => (
                <div key={record.id} className="ios-widget rounded-[22px] p-3 text-sm">
                  <div className="font-bold text-slate-900">{record.courseName} · {record.title}</div>
                  <div className="mt-1 text-slate-500">{examTypeLabelMap[record.examType]} · {record.date} · Puan {record.score}</div>
                </div>
              ))}
              {recentExamRecords.length === 0 && <div className="ios-widget rounded-[22px] p-4 text-sm text-slate-500">Sınav kaydı yok.</div>}
            </div>
          </div>
        </div>
      )}

      {(loading || error) && <div className="ios-card rounded-[24px] p-4 text-sm text-slate-600">{loading ? 'Veriler yükleniyor...' : error}</div>}

      {showSection('reports') && (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className={surface}>
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-slate-700" />
                  <h3 className="text-xl font-black text-slate-950">Rapor</h3>
                </div>
                <ContextHelp title="Rapor secimi" tone="peach">
                  Once donemi sec, sonra rapor uret. Rapor; guclu alan, odak alani ve sonraki calisma onerisine indirgenir.
                </ContextHelp>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <select value={reportPeriod} onChange={(event) => setReportPeriod(event.target.value as ReportPeriod)} className="ios-button min-h-11 flex-1 rounded-[18px] px-3 text-sm font-semibold text-slate-700">
                  {reportPeriods.map((period) => <option key={period} value={period}>{period}</option>)}
                </select>
                <button onClick={handleGenerateReport} disabled={isGeneratingReport} className={`min-h-11 rounded-[18px] px-4 text-sm font-black text-white ${isGeneratingReport ? 'cursor-not-allowed bg-slate-400' : 'ios-ink'}`}>
                  {isGeneratingReport ? 'Üretiliyor...' : 'Rapor Üret'}
                </button>
              </div>
              {report ? (
                <div className="mt-5 space-y-3 text-sm leading-6">
                  <div className="ios-widget rounded-[22px] p-4"><strong>Özet:</strong> {report.aiSummary}</div>
                  <div className="ios-widget ios-mint rounded-[22px] p-4 text-emerald-950"><strong>Güçlü alan:</strong> {report.highlights.mostImproved}</div>
                  <div className="ios-widget ios-peach rounded-[22px] p-4 text-amber-950"><strong>Odak alanı:</strong> {report.highlights.needsFocus}</div>
                  <div className="ios-widget ios-blue rounded-[22px] p-4 text-blue-950"><strong>Öneri:</strong> {report.aiSuggestion}</div>
                </div>
              ) : (
                <div className="ios-widget mt-5 rounded-[22px] p-4 text-sm leading-6 text-slate-500">Seçili dönem için rapor üretilebilir.</div>
              )}
            </div>

            <div className={surface}>
              <h3 className="text-xl font-black text-slate-950">Rapor özeti</h3>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="ios-widget ios-blue rounded-[22px] p-4"><div className="text-xs font-bold uppercase text-slate-500">Genel skor</div><div className="mt-2 text-2xl font-black">{analysis.overall.generalScore}</div></div>
                <div className="ios-widget ios-coral rounded-[22px] p-4"><div className="text-xs font-bold uppercase text-slate-500">Odak konusu</div><div className="mt-2 text-2xl font-black">{weakTopics.length}</div></div>
                <div className="ios-widget ios-lilac rounded-[22px] p-4"><div className="text-xs font-bold uppercase text-slate-500">Okul kaydı</div><div className="mt-2 text-2xl font-black">{examRecords.length}</div></div>
              </div>
            </div>
          </div>

          <AnalysisGraphCenter tasks={tasks} courses={courses} curriculum={curriculum} analysis={analysis} loading={loading} error={error} />
        </div>
      )}
    </section>
  );
};

export default ParentAnalysisWorkspace;
