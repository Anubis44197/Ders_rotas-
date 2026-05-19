import { isCompletedTask } from '../../utils/taskStatus';
import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, ScatterChart, Scatter, ZAxis } from 'recharts';
import { AnalysisSnapshot, SessionMetrics } from '../../utils/analysisEngine';
import { getTopicDecisionLevel } from '../../utils/parentDecisionEngine';
import { Course, SubjectCurriculum, Task } from '../../types';
import { ChartAccessibilitySummary, ChartTooltip, chartPalette, SafeResponsiveContainer } from '../shared/chartDesign';

const card = 'ios-card rounded-[30px] p-5';
const navButton = 'ios-button w-full rounded-[18px] px-3 py-2 text-left text-sm font-semibold transition';
const chartGrid = chartPalette.grid;
const chartBlue = chartPalette.blue;
const chartMint = chartPalette.mint;
const chartLilac = chartPalette.lilac;
const chartCoral = chartPalette.coral;
const chartPeach = chartPalette.peach;

const shortenLabel = (value: string, limit = 34) => value.length > limit ? `${value.slice(0, limit - 3)}...` : value;

const normalizeForLookup = (value: string) =>
  value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, ' ')
    .trim();

type GraphCategory = 'genel' | 'ders' | 'konu' | 'zaman' | 'detay';

type GraphKey =
  | 'general-score-trend'
  | 'course-performance'
  | 'risk-graph'
  | 'curriculum-coverage'
  | 'retention-curve'
  | 'accuracy-vs-time'
  | 'best-time-window'
  | 'learning-efficiency'
  | 'deep-work-ratio'
  | 'daily-ema-trend'
  | 'task-type-analysis'
  | 'reading-analytics';

interface GraphOption {
  key: GraphKey;
  category: GraphCategory;
  label: string;
  description: string;
}

const GRAPH_COPY: Record<GraphKey, { label: string; description: string }> = {
  'general-score-trend': { label: 'Genel performans trendi', description: 'Genel skorun zaman icindeki degisimini gosterir.' },
  'course-performance': { label: 'Ders bazli performans', description: 'Derslerin hakimiyet ve verim durumunu karsilastirir.' },
  'risk-graph': { label: 'Konu oncelik sirasi', description: 'Once bakilmasi gereken konulari risk puanina gore siralar.' },
  'curriculum-coverage': { label: 'Mufredat kapsami', description: 'Derslerde ilerleyen konu oranini gosterir.' },
  'retention-curve': { label: 'Tekrar kaliciligi', description: 'Tekrar sonrasi kalicilik durumunu ozetler.' },
  'accuracy-vs-time': { label: 'Sure ve dogruluk', description: 'Sure arttikca dogruluk nasil degisiyor, onu gosterir.' },
  'best-time-window': { label: 'Verimli saatler', description: 'Hangi saat araligi daha verimli, onu gosterir.' },
  'learning-efficiency': { label: 'Ogrenme verimi', description: 'Calisma suresine gore verim degisimini gosterir.' },
  'deep-work-ratio': { label: 'Derin calisma orani', description: 'Kesintisiz odakli calisma oranini gosterir.' },
  'daily-ema-trend': { label: 'Gunluk trend', description: 'Gunluk skorun yumusatilmis trendini gosterir.' },
  'task-type-analysis': { label: 'Calisma turleri', description: 'Soru, tekrar ve ders calisma turlerini karsilastirir.' },
  'reading-analytics': { label: 'Okuma takibi', description: 'Kitap okuma sayfa ve anlama verilerini gosterir.' },
};

const GRAPH_OPTIONS: GraphOption[] = [
  { key: 'general-score-trend', category: 'genel', label: 'Genel performans trendi', description: 'Genel skorun zaman icinde nasil degistigini sade cizgiyle gosterir.' },
  { key: 'course-performance', category: 'ders', label: 'Ders bazli performans', description: 'Derslerin hakimiyet ve verim durumunu yan yana karsilastirir.' },
  { key: 'curriculum-coverage', category: 'ders', label: 'Mufredat kapsami', description: 'Derslerde oturan konu oranini sade sutunlarla gosterir.' },
  { key: 'risk-graph', category: 'konu', label: 'Konu oncelik sirasi', description: 'Once bakilmasi gereken konulari risk ve hakimiyet sinyaliyle siralar.' },
  { key: 'retention-curve', category: 'konu', label: 'Tekrar kaliciligi', description: 'Tekrar sonrasi bilginin 1, 7 ve 30 gunluk gorunumunu gosterir.' },
  { key: 'best-time-window', category: 'zaman', label: 'Verimli saatler', description: 'Calisma saatlerine gore odak ve dogruluk ortalamasini gosterir.' },
  { key: 'task-type-analysis', category: 'detay', label: 'Calisma turleri', description: 'Soru cozme, tekrar ve calisma turlerinin sonuclarini karsilastirir.' },
  { key: 'reading-analytics', category: 'detay', label: 'Okuma takibi', description: 'Kitap okuma kayitlarinda sayfa ve anlama gostergesini izler.' },
];

const PRIMARY_GRAPH_KEYS: GraphKey[] = [
  'general-score-trend',
  'course-performance',
  'curriculum-coverage',
  'risk-graph',
  'best-time-window',
  'task-type-analysis',
];

const CATEGORY_LABELS: Record<GraphCategory, string> = {
  genel: 'Genel',
  ders: 'Dersler',
  konu: 'Konular',
  zaman: 'Zaman',
  detay: 'Detay',
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

interface Props {
  tasks: Task[];
  courses: Course[];
  curriculum?: SubjectCurriculum;
  analysis: AnalysisSnapshot;
  loading?: boolean;
  error?: string | null;
}

const AnalysisGraphCenter: React.FC<Props> = ({ tasks, courses, curriculum, analysis, loading, error }) => {
  const [selectedCategory, setSelectedCategory] = useState<GraphCategory>('ders');
  const [selectedGraph, setSelectedGraph] = useState<GraphKey>('course-performance');

  const tasksById = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((task) => map.set(task.id, task));
    return map;
  }, [tasks]);

  const optionsInCategory = useMemo(
    () => GRAPH_OPTIONS.filter((option) => PRIMARY_GRAPH_KEYS.includes(option.key) && option.category === selectedCategory),
    [selectedCategory],
  );

  const categoryKeys = useMemo(() => Object.keys(CATEGORY_LABELS) as GraphCategory[], []);

  const selectedOption = useMemo(
    () => GRAPH_OPTIONS.find((option) => option.key === selectedGraph) || GRAPH_OPTIONS.find((option) => option.key === 'course-performance') || GRAPH_OPTIONS[0],
    [selectedGraph],
  );
  const selectedCopy = GRAPH_COPY[selectedOption.key] || { label: selectedOption.label, description: selectedOption.description };
  const selectedChartSummary = `${selectedCopy.description} Bu grafik ${CATEGORY_LABELS[selectedOption.category]} alaninda yer alir; renk tek basina anlam tasimaz.`;

  const generalScoreTrendData = useMemo(() => {
    if (selectedGraph !== 'general-score-trend' && selectedGraph !== 'daily-ema-trend') return [] as Array<{ date: string; score: number }>;
    const bucket = new Map<string, number[]>();
    analysis.sessions.forEach((session) => {
      const current = bucket.get(session.completionDate) || [];
      const score = clamp((session.taskScore * 0.35) + (session.masteryContribution * 0.35) + (session.focusScore * 0.15) + (session.efficiencyScore * 0.15));
      current.push(score);
      bucket.set(session.completionDate, current);
    });

    return Array.from(bucket.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({ date, score: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) }));
  }, [analysis.sessions, selectedGraph]);

  const coursePerformanceData = useMemo(() => {
    if (selectedGraph !== 'course-performance') return [] as Array<{ courseName: string; mastery: number; efficiency: number }>;
    return analysis.courses.map((course) => ({
      courseName: course.courseName,
      mastery: course.averageMastery,
      efficiency: course.averageEfficiency,
    }));
  }, [analysis.courses, selectedGraph]);

  const riskData = useMemo(() => {
    if (selectedGraph !== 'risk-graph') return [] as Array<{ topic: string; risk: number; mastery: number; level: string }>;
    return [...analysis.topics]
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 8)
      .map((topic) => ({
        topic: shortenLabel(`${topic.courseName} / ${topic.topicName}`, 44),
        risk: topic.riskScore,
        mastery: topic.masteryScore,
        level: getTopicDecisionLevel(topic.riskScore),
      }));
  }, [analysis.topics, selectedGraph]);

  const riskLevelBreakdown = useMemo(() => {
    if (selectedGraph !== 'risk-graph' || !riskData.length) return null;
    return riskData.reduce((acc, item) => {
      acc[item.level] = (acc[item.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [riskData, selectedGraph]);

  const coverageData = useMemo(() => {
    if (selectedGraph !== 'curriculum-coverage') return [] as Array<{ courseName: string; coverage: number; totalTopics: number }>;
    if (!curriculum) return [] as Array<{ courseName: string; coverage: number; totalTopics: number }>;

    const masteryThreshold = 70;
    return courses.map((course) => {
      const directUnits = curriculum[course.name] || [];
      const matchedSubject = Object.keys(curriculum).find((subject) => normalizeForLookup(subject) === normalizeForLookup(course.name));
      const resolvedUnits = directUnits.length > 0 ? directUnits : (matchedSubject ? curriculum[matchedSubject] || [] : []);
      const totalTopics = resolvedUnits.reduce((sum, unit) => sum + unit.topics.length, 0);
      const masteredTopics = analysis.topics.filter(
        (topic) => topic.courseId === course.id && topic.masteryScore >= masteryThreshold,
      ).length;
      const coverage = totalTopics > 0 ? Math.round((masteredTopics / totalTopics) * 100) : 0;
      return { courseName: course.name, coverage, totalTopics };
    });
  }, [analysis.topics, courses, curriculum, selectedGraph]);

  const retentionData = useMemo(() => {
    if (selectedGraph !== 'retention-curve') return [] as Array<{ day: string; retention: number }>;
    const revisionSessionCount = analysis.sessions.filter((session) => session.taskGoalType === 'konu-tekrari').length;
    if (!analysis.topics.length || revisionSessionCount < 2) {
      return [] as Array<{ day: string; retention: number }>;
    }
    const one = Math.round((analysis.topics.reduce((sum, topic) => sum + topic.retention1d, 0) / analysis.topics.length) * 100);
    const seven = Math.round((analysis.topics.reduce((sum, topic) => sum + topic.retention7d, 0) / analysis.topics.length) * 100);
    const thirty = Math.round((analysis.topics.reduce((sum, topic) => sum + topic.retention30d, 0) / analysis.topics.length) * 100);
    return [
      { day: '1g', retention: one },
      { day: '7g', retention: seven },
      { day: '30g', retention: thirty },
    ];
  }, [analysis.sessions, analysis.topics, selectedGraph]);

  const qualityInsights = useMemo(() => {
    if (selectedGraph !== 'general-score-trend') {
      return {
        firstAttemptAverage: null as number | null,
        errorDistribution: [] as Array<{ name: string; value: number }>,
      };
    }
    const firstAttemptValues = analysis.topics
      .map((topic) => topic.firstAttemptScore)
      .filter((value): value is number => typeof value === 'number');

    const conceptRates = analysis.topics
      .map((topic) => topic.conceptErrorRate)
      .filter((value): value is number => typeof value === 'number');
    const processRates = analysis.topics
      .map((topic) => topic.processErrorRate)
      .filter((value): value is number => typeof value === 'number');
    const attentionRates = analysis.topics
      .map((topic) => topic.attentionErrorRate)
      .filter((value): value is number => typeof value === 'number');

    const firstAttemptAverage = firstAttemptValues.length > 0
      ? Math.round(firstAttemptValues.reduce((sum, value) => sum + value, 0) / firstAttemptValues.length)
      : null;

    const conceptAverage = conceptRates.length > 0
      ? conceptRates.reduce((sum, value) => sum + value, 0) / conceptRates.length
      : null;
    const processAverage = processRates.length > 0
      ? processRates.reduce((sum, value) => sum + value, 0) / processRates.length
      : null;
    const attentionAverage = attentionRates.length > 0
      ? attentionRates.reduce((sum, value) => sum + value, 0) / attentionRates.length
      : null;

    const hasErrorBreakdown = conceptAverage !== null || processAverage !== null || attentionAverage !== null;
    if (!hasErrorBreakdown) {
      return {
        firstAttemptAverage,
        errorDistribution: [] as Array<{ name: string; value: number }>,
      };
    }

    const total = (conceptAverage || 0) + (processAverage || 0) + (attentionAverage || 0);
    const normalize = (value: number | null) => {
      if (total <= 0) return 0;
      return Math.round(((value || 0) / total) * 100);
    };

    return {
      firstAttemptAverage,
      errorDistribution: [
        { name: 'Kavram', value: normalize(conceptAverage) },
        { name: 'Süreç', value: normalize(processAverage) },
        { name: 'Dikkat', value: normalize(attentionAverage) },
      ],
    };
  }, [analysis.topics, selectedGraph]);

  const accuracyVsTimeData = useMemo(() => {
    if (selectedGraph !== 'accuracy-vs-time' && selectedGraph !== 'general-score-trend') return [] as Array<{ duration: number; accuracy: number; z: number }>;
    return analysis.sessions
      .filter((session) => session.taskType === 'soru çözme' && typeof session.accuracyScore === 'number')
      .map((session) => {
        const task = tasksById.get(session.taskId);
        const minutes = Math.max(1, Math.round((task?.actualDuration || 0) / 60));
        return {
          duration: minutes,
          accuracy: session.accuracyScore as number,
          z: 8,
        };
      });
  }, [analysis.sessions, tasksById, selectedGraph]);

  const bestTimeWindowData = useMemo(() => {
    if (selectedGraph !== 'best-time-window' && selectedGraph !== 'general-score-trend') return [] as Array<{ window: string; focus: number; accuracy: number }>;
    return analysis.studyWindows.map((window) => ({
      window: window.label,
      focus: window.averageFocus,
      accuracy: window.averageAccuracy ?? 0,
    }));
  }, [analysis.studyWindows, selectedGraph]);

  const learningEfficiencyData = useMemo(() => {
    if (selectedGraph !== 'learning-efficiency') return [] as Array<{ label: string; efficiency: number }>;
    const sortedSessions = [...analysis.sessions].sort((a, b) => a.completionDate.localeCompare(b.completionDate));
    const toEntry = (session: SessionMetrics) => {
      const task = tasksById.get(session.taskId);
      const minutes = Math.max(1, Math.round((task?.actualDuration || 0) / 60));
      return {
        label: session.completionDate,
        efficiency: Math.round((session.masteryContribution / minutes) * 10) / 10,
      };
    };
    return sortedSessions.slice(-20).map(toEntry);
  }, [analysis.sessions, tasksById, selectedGraph]);

  const deepWorkData = useMemo(() => {
    if (selectedGraph !== 'deep-work-ratio') return [] as Array<{ name: string; value: number }>;
    const completed = tasks.filter((task) => isCompletedTask(task));
    const totals = completed.reduce(
      (acc, task) => {
        const duration = Math.max(0, task.actualDuration || 0);
        acc.total += duration;
        const interruption = duration > 0 ? ((task.pauseTime || 0) + (task.breakTime || 0)) / duration : 1;
        if (duration >= 1500 && interruption <= 0.15) {
          acc.deep += duration;
        }
        return acc;
      },
      { total: 0, deep: 0 },
    );

    if (totals.total <= 0) {
      return [] as Array<{ name: string; value: number }>;
    }

    const deepRatio = totals.total > 0 ? Math.round((totals.deep / totals.total) * 100) : 0;
    return [
      { name: 'Deep Work', value: deepRatio },
      { name: 'Diger', value: 100 - deepRatio },
    ];
  }, [tasks, selectedGraph]);

  const goldenHourInsight = useMemo(() => {
    if (!bestTimeWindowData.length) {
      return { label: '-', focus: null as number | null, accuracy: null as number | null };
    }

    const best = [...bestTimeWindowData].sort((a, b) => b.focus - a.focus)[0];
    return {
      label: best.window,
      focus: best.focus,
      accuracy: best.accuracy,
    };
  }, [bestTimeWindowData]);

  const throughputInsight = useMemo(() => {
    const points = accuracyVsTimeData.filter((item) => Number.isFinite(item.duration) && Number.isFinite(item.accuracy));
    if (points.length < 3) {
      return {
        correlation: null as number | null,
        profile: '-' as string,
      };
    }

    const meanX = points.reduce((sum, item) => sum + item.duration, 0) / points.length;
    const meanY = points.reduce((sum, item) => sum + item.accuracy, 0) / points.length;

    let num = 0;
    let denX = 0;
    let denY = 0;
    points.forEach((item) => {
      const dx = item.duration - meanX;
      const dy = item.accuracy - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    });

    const correlation = denX > 0 && denY > 0 ? num / Math.sqrt(denX * denY) : 0;
    let profile = 'Dengeli';
    if (correlation <= -0.2) profile = 'Hızlandıkça hata artıyor';
    if (correlation >= 0.2) profile = 'Süre arttıkça doğruluk artıyor';

    return {
      correlation: Math.round(correlation * 100) / 100,
      profile,
    };
  }, [accuracyVsTimeData]);

  const emaTrendData = useMemo(() => {
    if (selectedGraph !== 'daily-ema-trend') return [] as Array<{ date: string; raw: number; ema: number }>;
    const alpha = 0.35;
    const source = generalScoreTrendData;
    let ema = source[0]?.score || 0;
    return source.map((item) => {
      ema = Math.round((alpha * item.score) + ((1 - alpha) * ema));
      return {
        date: item.date,
        raw: item.score,
        ema,
      };
    });
  }, [generalScoreTrendData, selectedGraph]);

  const taskTypeData = useMemo(() => {
    if (selectedGraph !== 'task-type-analysis') return [] as Array<{ taskType: string; mastery: number; efficiency: number }>;
    return analysis.taskTypes.map((item) => ({
      taskType: item.label,
      mastery: item.averageMastery,
      efficiency: item.averageEfficiency,
    }));
  }, [analysis.taskTypes, selectedGraph]);

  const readingData = useMemo(() => {
    if (selectedGraph !== 'reading-analytics') return [] as Array<{ month: string; pages: number; comprehension: number }>;
    const bucket = new Map<string, { pages: number; comp: number; count: number }>();
    tasks
      .filter((task) => isCompletedTask(task) && task.taskType === 'kitap okuma' && task.completionDate)
      .forEach((task) => {
        const month = task.completionDate!.slice(0, 7);
        const current = bucket.get(month) || { pages: 0, comp: 0, count: 0 };
        current.pages += task.pagesRead || 0;
        const comprehensionProxy = task.firstAttemptScore ?? task.successScore ?? task.focusScore ?? 0;
        current.comp += comprehensionProxy;
        current.count += 1;
        bucket.set(month, current);
      });

    return Array.from(bucket.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({
        month,
        pages: value.pages,
        comprehension: value.count > 0 ? Math.round(value.comp / value.count) : 0,
      }));
  }, [tasks, selectedGraph]);

  const ensureGraphInCategory = (nextCategory: GraphCategory) => {
    const first = GRAPH_OPTIONS.find((option) => option.category === nextCategory);
    if (first) setSelectedGraph(first.key);
  };

  const renderEmpty = (text: string) => (
    <div className="ios-widget rounded-[22px] px-4 py-8 text-center text-sm text-slate-500">{text}</div>
  );

  const renderGraph = () => {
    if (loading) return renderEmpty('Grafikler hazirlaniyor...');
    if (error) return renderEmpty(error);

    switch (selectedGraph) {
      case 'general-score-trend':
        if (!generalScoreTrendData.length) return renderEmpty('Genel performans grafigi icin veri henuz yeterli degil.');
        return (
          <SafeResponsiveContainer width="100%" height={320}>
            <LineChart data={generalScoreTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line legendType="none" type="monotone" dataKey="score" stroke={chartBlue} strokeWidth={4} name="Genel skor" dot={{ fill: chartBlue, strokeWidth: 0, r: 4 }} />
            </LineChart>
          </SafeResponsiveContainer>
        );

      case 'course-performance':
        if (!coursePerformanceData.length) return renderEmpty('Ders karsilastirma grafigi icin veri bulunmuyor.');
        return (
          <SafeResponsiveContainer width="100%" height={320}>
            <BarChart data={coursePerformanceData} layout="vertical" margin={{ left: 8, right: 18, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="courseName" width={132} tickLine={false} axisLine={false} tick={{ fontSize: 12, fontWeight: 700 }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar legendType="none" dataKey="mastery" fill={chartMint} name="Hakimiyet" radius={[0, 12, 12, 0]} />
              <Bar legendType="none" dataKey="efficiency" fill={chartBlue} name="Verim" radius={[0, 12, 12, 0]} />
            </BarChart>
          </SafeResponsiveContainer>
        );

      case 'risk-graph':
        if (!riskData.length) return renderEmpty('Oncelikli konu listesi icin veri henuz olusmadi.');
        return (
          <SafeResponsiveContainer width="100%" height={320}>
            <BarChart data={riskData} layout="vertical" margin={{ left: 8, right: 18, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="topic" width={190} tickLine={false} axisLine={false} tick={{ fontSize: 12, fontWeight: 700 }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar legendType="none" dataKey="risk" fill={chartCoral} name="Öncelik" radius={[0, 12, 12, 0]} />
            </BarChart>
          </SafeResponsiveContainer>
        );

      case 'curriculum-coverage':
        if (!coverageData.length) return renderEmpty('Mufredat kapsami icin ders ve konu kaydi gerekli.');
        return (
          <SafeResponsiveContainer width="100%" height={320}>
            <BarChart data={coverageData} layout="vertical" margin={{ left: 8, right: 18, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="courseName" width={132} tickLine={false} axisLine={false} tick={{ fontSize: 12, fontWeight: 700 }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar legendType="none" dataKey="coverage" fill={chartMint} name="Kapsama %" radius={[0, 12, 12, 0]} />
            </BarChart>
          </SafeResponsiveContainer>
        );

      case 'retention-curve':
        if (!retentionData.length) return renderEmpty('Tekrar kaliciligi icin en az 2 tekrar calismasi gerekli.');
        return (
          <SafeResponsiveContainer width="100%" height={320}>
            <LineChart data={retentionData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line legendType="none" type="monotone" dataKey="retention" stroke={chartLilac} strokeWidth={4} name="Kalicilik" dot={{ fill: chartLilac, strokeWidth: 0, r: 4 }} />
            </LineChart>
          </SafeResponsiveContainer>
        );

      case 'accuracy-vs-time':
        if (!accuracyVsTimeData.length) return renderEmpty('Sure ve dogruluk iliskisi icin soru oturumu gerekli.');
        return (
          <SafeResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis type="number" dataKey="duration" name="Süre" unit=" dk" tickLine={false} axisLine={false} />
              <YAxis type="number" dataKey="accuracy" name="Doğruluk" unit="%" domain={[0, 100]} tickLine={false} axisLine={false} />
              <ZAxis type="number" dataKey="z" range={[60, 120]} />
              <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              <Scatter legendType="none" name="Oturum" data={accuracyVsTimeData} fill={chartBlue} />
            </ScatterChart>
          </SafeResponsiveContainer>
        );

      case 'best-time-window':
        if (!bestTimeWindowData.length) return renderEmpty('Verimli saat analizi icin veri henuz olusmadi.');
        return (
          <SafeResponsiveContainer width="100%" height={320}>
            <BarChart data={bestTimeWindowData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="window" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar legendType="none" dataKey="focus" fill={chartMint} name="Odak" radius={[12, 12, 0, 0]} />
              <Bar legendType="none" dataKey="accuracy" fill={chartPeach} name="Doğruluk" radius={[12, 12, 0, 0]} />
            </BarChart>
          </SafeResponsiveContainer>
        );

      case 'learning-efficiency':
        if (!learningEfficiencyData.length) return renderEmpty('Ogrenme verimi grafigi icin veri bulunmuyor.');
        return (
          <SafeResponsiveContainer width="100%" height={320}>
            <LineChart data={learningEfficiencyData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line legendType="none" type="monotone" dataKey="efficiency" stroke={chartBlue} strokeWidth={4} name="Mastery / dk" dot={{ fill: chartBlue, strokeWidth: 0, r: 4 }} />
            </LineChart>
          </SafeResponsiveContainer>
        );

      case 'deep-work-ratio':
        if (!deepWorkData.length) return renderEmpty('Derin calisma orani icin tamamlanan oturum verisi gerekli.');
        return (
          <SafeResponsiveContainer width="100%" height={320}>
            <BarChart data={deepWorkData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar legendType="none" dataKey="value" fill={chartLilac} name="Oran" radius={[12, 12, 0, 0]} />
            </BarChart>
          </SafeResponsiveContainer>
        );

      case 'daily-ema-trend':
        if (!emaTrendData.length) return renderEmpty('Gunluk trend icin veri bulunmuyor.');
        return (
          <SafeResponsiveContainer width="100%" height={320}>
            <LineChart data={emaTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line legendType="none" type="monotone" dataKey="raw" stroke="#a9b7cd" strokeWidth={2} name="Ham" dot={false} />
              <Line legendType="none" type="monotone" dataKey="ema" stroke={chartBlue} strokeWidth={4} name="Yumusatilmis trend" dot={{ fill: chartBlue, strokeWidth: 0, r: 4 }} />
            </LineChart>
          </SafeResponsiveContainer>
        );

      case 'task-type-analysis':
        if (!taskTypeData.length) return renderEmpty('Calisma turu analizi icin veri bulunmuyor.');
        return (
          <SafeResponsiveContainer width="100%" height={320}>
            <BarChart data={taskTypeData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="taskType" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar legendType="none" dataKey="mastery" fill={chartMint} name="Hakimiyet" radius={[12, 12, 0, 0]} />
              <Bar legendType="none" dataKey="efficiency" fill={chartBlue} name="Verim" radius={[12, 12, 0, 0]} />
            </BarChart>
          </SafeResponsiveContainer>
        );

      case 'reading-analytics':
        if (!readingData.length) return renderEmpty('Okuma takibi icin tamamlanan kitap okuma kaydi yok.');
        return (
          <SafeResponsiveContainer width="100%" height={320}>
            <LineChart data={readingData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line legendType="none" type="monotone" dataKey="pages" stroke={chartMint} strokeWidth={4} name="Sayfa" dot={{ fill: chartMint, strokeWidth: 0, r: 4 }} />
              <Line legendType="none" type="monotone" dataKey="comprehension" stroke={chartPeach} strokeWidth={4} name="Anlama" dot={{ fill: chartPeach, strokeWidth: 0, r: 4 }} />
            </LineChart>
          </SafeResponsiveContainer>
        );

      default:
        return renderEmpty('Grafik secimi gecerli degil.');
    }
  };

  return (
    <section
      className="space-y-5"
      data-testid="analysis-graph-center"
      data-selected-category={selectedCategory}
      data-selected-graph={selectedGraph}
    >
      <div className={card}>
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-primary-600">Detay grafikleri</div>
        <h3 className="text-2xl font-black text-slate-900">Veli karar grafikleri</h3>
        <p className="mt-2 text-sm text-slate-500">Ana karar kartlarını destekleyen sade grafikler. Veli önce karar özetini görür, burada isterse detaya iner.</p>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="ios-widget hidden rounded-[24px] p-3 lg:block">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Kategori</div>
              <div className="grid grid-cols-1 gap-2">
                {categoryKeys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(key);
                      ensureGraphInCategory(key);
                    }}
                    data-testid={`graph-category-btn-${key}`}
                    className={`${navButton} ${selectedCategory === key ? 'ios-button-active' : 'text-slate-700 hover:bg-white/75'}`}
                  >
                    {CATEGORY_LABELS[key]}
                  </button>
                ))}
              </div>
            </div>

            <div className="ios-widget hidden rounded-[24px] p-3 lg:block">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Grafik</div>
              <div className="grid grid-cols-1 gap-2">
                {optionsInCategory.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSelectedGraph(option.key)}
                    data-testid={`graph-option-btn-${option.key}`}
                    className={`${navButton} ${selectedGraph === option.key ? 'ios-button-active' : 'text-slate-700 hover:bg-white/75'}`}
                  >
                    {GRAPH_COPY[option.key]?.label || option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ios-widget space-y-3 rounded-[24px] p-3 lg:hidden">
              <label className="text-sm font-semibold text-slate-700 block">
                Kategori
                <select
                  data-testid="graph-category-select-mobile"
                  value={selectedCategory}
                  onChange={(event) => {
                    const next = event.target.value as GraphCategory;
                    setSelectedCategory(next);
                    ensureGraphInCategory(next);
                  }}
                  className="ios-button mt-1 w-full rounded-[18px] px-3 py-2 text-sm"
                >
                  {categoryKeys.map((key) => (
                    <option key={key} value={key}>{CATEGORY_LABELS[key]}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-semibold text-slate-700 block">
                Grafik
                <select
                  data-testid="graph-option-select-mobile"
                  value={selectedGraph}
                  onChange={(event) => setSelectedGraph(event.target.value as GraphKey)}
                  className="ios-button mt-1 w-full rounded-[18px] px-3 py-2 text-sm"
                >
                  {optionsInCategory.map((option) => (
                    <option key={option.key} value={option.key}>{GRAPH_COPY[option.key]?.label || option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </aside>

          <div className="ios-chart-surface rounded-[26px] p-5">
            <div className="mb-4">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{CATEGORY_LABELS[selectedOption.category]}</div>
              <h4 className="mt-1 text-xl font-black text-slate-900">{selectedCopy.label}</h4>
              <p className="mt-1 text-sm text-slate-500">{selectedCopy.description}</p>
            </div>
            <ChartAccessibilitySummary title={selectedCopy.label} summary={selectedChartSummary} />
            <div role="img" aria-label={`${selectedCopy.label}. ${selectedChartSummary}`} data-testid="graph-main-canvas">
              {renderGraph()}
            </div>
            {selectedGraph === 'risk-graph' && riskLevelBreakdown && (
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-slate-600 sm:grid-cols-4" data-testid="risk-level-breakdown">
                <div className="ios-widget rounded-[14px] px-3 py-2" data-testid="risk-level-kritik">Kritik: {riskLevelBreakdown.Kritik || 0}</div>
                <div className="ios-widget rounded-[14px] px-3 py-2" data-testid="risk-level-dikkat">Dikkat: {riskLevelBreakdown.Dikkat || 0}</div>
                <div className="ios-widget rounded-[14px] px-3 py-2" data-testid="risk-level-takip">Takip et: {riskLevelBreakdown['Takip et'] || 0}</div>
                <div className="ios-widget rounded-[14px] px-3 py-2" data-testid="risk-level-stabil">Stabil: {riskLevelBreakdown.Stabil || 0}</div>
              </div>
            )}

            {selectedGraph === 'general-score-trend' && (
              <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="ios-widget rounded-[22px] border-l-4 border-l-[#8AB4FF] p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Ilk deneme basarisi</div>
                  <div className="mt-2 text-3xl font-black text-slate-900">{qualityInsights.firstAttemptAverage ?? '-'}</div>
                  <p className="mt-1 text-xs text-slate-500">Konu bazinda ilk denemedeki dogruluk ortalamasi.</p>
                </div>

                <div className="ios-widget rounded-[22px] border-l-4 border-l-[#7EE7C7] p-4" data-testid="graph-golden-hour-card">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">En verimli saat</div>
                  <div className="mt-2 text-3xl font-black text-slate-900" data-testid="graph-golden-hour-value">{goldenHourInsight.label}</div>
                  <p className="mt-1 text-xs text-slate-500">
                    Odak {goldenHourInsight.focus ?? '-'} / Dogruluk {goldenHourInsight.accuracy ?? '-'}
                  </p>
                </div>

                <div className="ios-widget rounded-[22px] border-l-4 border-l-[#FFC68B] p-4">
                  <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Yanlis dagilimi</div>
                  {qualityInsights.errorDistribution.length === 0 ? (
                    <div className="ios-widget rounded-[18px] px-4 py-6 text-center text-sm text-slate-500">
                      Yanlis dagilimi icin yeterli veri yok.
                    </div>
                  ) : (
                    <SafeResponsiveContainer width="100%" height={180}>
                      <BarChart data={qualityInsights.errorDistribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar legendType="none" dataKey="value" fill={chartPeach} name="Oran" radius={[12, 12, 0, 0]} />
                      </BarChart>
                    </SafeResponsiveContainer>
                  )}
                </div>

                <div className="ios-widget rounded-[22px] border-l-4 border-l-[#C4B5FD] p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Calisma dengesi</div>
                  <div className="mt-2 text-2xl font-black text-slate-900">{throughputInsight.profile}</div>
                  <p className="mt-1 text-xs text-slate-500">Sure ve dogruluk iliskisine gore ozet yorum.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AnalysisGraphCenter;
