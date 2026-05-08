import { isCompletedTask } from '../../utils/taskStatus';
import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, ScatterChart, Scatter, ZAxis } from 'recharts';
import { AnalysisSnapshot, SessionMetrics } from '../../utils/analysisEngine';
import { Course, SubjectCurriculum, Task } from '../../types';
import { ChartAccessibilitySummary, ChartTooltip, chartPalette } from '../shared/chartDesign';

const card = 'ios-card rounded-[30px] p-5';
const navButton = 'ios-button w-full rounded-[18px] px-3 py-2 text-left text-sm font-semibold transition';
const chartGrid = chartPalette.grid;
const chartBlue = chartPalette.blue;
const chartMint = chartPalette.mint;
const chartLilac = chartPalette.lilac;
const chartCoral = chartPalette.coral;
const chartPeach = chartPalette.peach;

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

type GraphCategory = 'ust' | 'analiz' | 'davranis' | 'destek';

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

const GRAPH_OPTIONS: GraphOption[] = [
  { key: 'general-score-trend', category: 'ust', label: 'Genel skor trendi', description: 'Günlük özet skorun zaman içinde nasıl değiştiğini gösterir.' },
  { key: 'course-performance', category: 'ust', label: 'Ders bazlı performans', description: 'Ders hâkimiyeti ve verim puanını birlikte sunar.' },
  { key: 'risk-graph', category: 'ust', label: 'Odak grafiği', description: 'Konu bazlı destek ihtiyacını öncelik sırasıyla gösterir.' },
  { key: 'curriculum-coverage', category: 'ust', label: 'Müfredat kapsama', description: 'Hâkimiyet eşiğini geçen konu oranını ders bazlı verir.' },
  { key: 'retention-curve', category: 'analiz', label: 'Kalıcılık eğrisi', description: '1 gün, 7 gün ve 30 gün kalıcılık ortalamalarını gösterir.' },
  { key: 'accuracy-vs-time', category: 'analiz', label: 'Doğruluk / süre ilişkisi', description: 'Soru oturumlarında süre ile doğruluk ilişkisini gösterir.' },
  { key: 'best-time-window', category: 'analiz', label: 'En verimli zaman', description: 'Saat pencerelerine göre odak ve doğruluk dağılımı.' },
  { key: 'learning-efficiency', category: 'analiz', label: 'Öğrenme verimi', description: 'Süre başına öğrenme katkısını takip eder.' },
  { key: 'deep-work-ratio', category: 'davranis', label: 'Derin çalışma oranı', description: '25+ dakika kesintisiz blokların toplam çalışmaya oranı.' },
  { key: 'daily-ema-trend', category: 'davranis', label: 'Günlük trend (EMA)', description: 'Günlük skorun yumuşatılmış trendi.' },
  { key: 'task-type-analysis', category: 'destek', label: 'Görev türü analizi', description: 'Görev tiplerine göre ortalama başarı ve verim.' },
  { key: 'reading-analytics', category: 'destek', label: 'Okuma analitiği', description: 'Aylık sayfa ve anlama göstergesi takibi.' },
];

const CATEGORY_LABELS: Record<GraphCategory, string> = {
  ust: 'Üst Panel',
  analiz: 'Analiz',
  davranis: 'Davranış',
  destek: 'Destek',
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
  const [selectedCategory, setSelectedCategory] = useState<GraphCategory>('ust');
  const [selectedGraph, setSelectedGraph] = useState<GraphKey>('general-score-trend');

  const tasksById = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((task) => map.set(task.id, task));
    return map;
  }, [tasks]);

  const optionsInCategory = useMemo(
    () => GRAPH_OPTIONS.filter((option) => option.category === selectedCategory),
    [selectedCategory],
  );

  const categoryKeys = useMemo(() => Object.keys(CATEGORY_LABELS) as GraphCategory[], []);

  const selectedOption = useMemo(
    () => GRAPH_OPTIONS.find((option) => option.key === selectedGraph) || GRAPH_OPTIONS[0],
    [selectedGraph],
  );
  const selectedChartSummary = `${selectedOption.description} Grafik ${CATEGORY_LABELS[selectedOption.category]} kategorisinde yer alır. Kritik bilgi açıklama ve tooltip ile de sunulur; renk tek başına anlam taşımaz.`;

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
    if (selectedGraph !== 'risk-graph') return [] as Array<{ topic: string; risk: number; mastery: number }>;
    return [...analysis.topics]
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 8)
      .map((topic) => ({
        topic: `${topic.courseName} / ${topic.topicName}`,
        risk: topic.riskScore,
        mastery: topic.masteryScore,
      }));
  }, [analysis.topics, selectedGraph]);

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

  const confidenceInsight = useMemo(() => {
    if (selectedGraph !== 'general-score-trend') {
      return {
        averageGap: null as number | null,
        calibrationScore: null as number | null,
      };
    }
    const calibratedSessions = analysis.sessions.filter(
      (session) => typeof session.selfAssessmentScore === 'number' && typeof session.confidenceGap === 'number',
    );

    if (!calibratedSessions.length) {
      return {
        averageGap: null as number | null,
        calibrationScore: null as number | null,
      };
    }

    const avgGap = calibratedSessions.reduce((sum, item) => sum + (item.confidenceGap || 0), 0) / calibratedSessions.length;
    const avgAbsGap = calibratedSessions.reduce((sum, item) => sum + Math.abs(item.confidenceGap || 0), 0) / calibratedSessions.length;
    const calibrationScore = Math.max(0, Math.min(100, Math.round(100 - avgAbsGap)));

    return {
      averageGap: Math.round(avgGap),
      calibrationScore,
    };
  }, [analysis.sessions, selectedGraph]);

  const fatigueInsight = useMemo(() => {
    if (selectedGraph !== 'general-score-trend') {
      return {
        fatiguePerHour: null as number | null,
        level: '-',
      };
    }
    const points = analysis.sessions
      .map((session) => {
        const task = tasksById.get(session.taskId);
        const minutes = Math.max(1, Math.round((task?.actualDuration || 0) / 60));
        return { minutes, focus: session.focusScore };
      })
      .filter((item) => item.minutes > 0);

    if (points.length < 4) {
      return {
        fatiguePerHour: null as number | null,
        level: '-',
      };
    }

    let cumulativeMinutes = 0;
    const series = points.map((item) => {
      cumulativeMinutes += item.minutes;
      return {
        x: cumulativeMinutes / 60,
        y: item.focus,
      };
    });

    const meanX = series.reduce((sum, item) => sum + item.x, 0) / series.length;
    const meanY = series.reduce((sum, item) => sum + item.y, 0) / series.length;

    let numerator = 0;
    let denominator = 0;
    series.forEach((item) => {
      const dx = item.x - meanX;
      numerator += dx * (item.y - meanY);
      denominator += dx * dx;
    });

    const slope = denominator > 0 ? numerator / denominator : 0;
    const fatiguePerHour = Math.max(0, Math.round((-slope) * 10) / 10);
    const level = fatiguePerHour >= 6 ? 'Yüksek' : fatiguePerHour >= 3 ? 'Orta' : 'Düşük';

    return {
      fatiguePerHour,
      level,
    };
  }, [analysis.sessions, tasksById, selectedGraph]);

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
    if (loading) return renderEmpty('Grafik verisi yükleniyor...');
    if (error) return renderEmpty(error);

    switch (selectedGraph) {
      case 'general-score-trend':
        if (!generalScoreTrendData.length) return renderEmpty('Genel skor trendi için yeterli veri yok.');
        return (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={generalScoreTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line legendType="none" type="monotone" dataKey="score" stroke={chartBlue} strokeWidth={4} name="Genel skor" dot={{ fill: chartBlue, strokeWidth: 0, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'course-performance':
        if (!coursePerformanceData.length) return renderEmpty('Ders performansı için veri yok.');
        return (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={coursePerformanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="courseName" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar legendType="none" dataKey="mastery" fill={chartMint} name="Hakimiyet" radius={[12, 12, 0, 0]} />
              <Bar legendType="none" dataKey="efficiency" fill={chartBlue} name="Verim" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'risk-graph':
        if (!riskData.length) return renderEmpty('Odak verisi oluşmadı.');
        return (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={riskData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="topic" width={180} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar legendType="none" dataKey="risk" fill={chartCoral} name="Takip" radius={[0, 12, 12, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'curriculum-coverage':
        if (!coverageData.length) return renderEmpty('Müfredat kapsama verisi için ders/müfredat kaydı gerekli.');
        return (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={coverageData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="courseName" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar legendType="none" dataKey="coverage" fill={chartMint} name="Kapsama %" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'retention-curve':
        if (!retentionData.length) return renderEmpty('Kalıcılık eğrisi için en az 2 tekrar oturumu gerekli.');
        return (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={retentionData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line legendType="none" type="monotone" dataKey="retention" stroke={chartLilac} strokeWidth={4} name="Retention" dot={{ fill: chartLilac, strokeWidth: 0, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'accuracy-vs-time':
        if (!accuracyVsTimeData.length) return renderEmpty('Doğruluk / süre ilişkisi için soru oturumu gerekli.');
        return (
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis type="number" dataKey="duration" name="Süre" unit=" dk" tickLine={false} axisLine={false} />
              <YAxis type="number" dataKey="accuracy" name="Doğruluk" unit="%" domain={[0, 100]} tickLine={false} axisLine={false} />
              <ZAxis type="number" dataKey="z" range={[60, 120]} />
              <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              <Scatter legendType="none" name="Oturum" data={accuracyVsTimeData} fill={chartBlue} />
            </ScatterChart>
          </ResponsiveContainer>
        );

      case 'best-time-window':
        if (!bestTimeWindowData.length) return renderEmpty('Saat penceresi verisi oluşmadı.');
        return (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={bestTimeWindowData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="window" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar legendType="none" dataKey="focus" fill={chartMint} name="Odak" radius={[12, 12, 0, 0]} />
              <Bar legendType="none" dataKey="accuracy" fill={chartPeach} name="Doğruluk" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'learning-efficiency':
        if (!learningEfficiencyData.length) return renderEmpty('Öğrenme verimi için veri yok.');
        return (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={learningEfficiencyData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line legendType="none" type="monotone" dataKey="efficiency" stroke={chartBlue} strokeWidth={4} name="Mastery / dk" dot={{ fill: chartBlue, strokeWidth: 0, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'deep-work-ratio':
        if (!deepWorkData.length) return renderEmpty('Derin çalışma oranı için tamamlanan oturum verisi yok.');
        return (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={deepWorkData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar legendType="none" dataKey="value" fill={chartLilac} name="Oran %" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'daily-ema-trend':
        if (!emaTrendData.length) return renderEmpty('EMA trendi için günlük veri yok.');
        return (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={emaTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line legendType="none" type="monotone" dataKey="raw" stroke="#a9b7cd" strokeWidth={2} name="Ham" dot={false} />
              <Line legendType="none" type="monotone" dataKey="ema" stroke={chartBlue} strokeWidth={4} name="EMA" dot={{ fill: chartBlue, strokeWidth: 0, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'task-type-analysis':
        if (!taskTypeData.length) return renderEmpty('Görev tipi analizi için veri yok.');
        return (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={taskTypeData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="taskType" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar legendType="none" dataKey="mastery" fill={chartMint} name="Hakimiyet" radius={[12, 12, 0, 0]} />
              <Bar legendType="none" dataKey="efficiency" fill={chartBlue} name="Verim" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'reading-analytics':
        if (!readingData.length) return renderEmpty('Okuma analitiği için tamamlanan kitap okuma kaydı yok.');
        return (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={readingData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Line legendType="none" type="monotone" dataKey="pages" stroke={chartMint} strokeWidth={4} name="Sayfa" dot={{ fill: chartMint, strokeWidth: 0, r: 4 }} />
              <Line legendType="none" type="monotone" dataKey="comprehension" stroke={chartPeach} strokeWidth={4} name="Anlama" dot={{ fill: chartPeach, strokeWidth: 0, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        );

      default:
        return renderEmpty('Grafik seçimi geçersiz.');
    }
  };

  return (
    <section className="space-y-5">
      <div className={card}>
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-primary-600">Grafik merkezi</div>
        <h3 className="text-2xl font-black text-slate-900">Tekil analiz görünümü</h3>
        <p className="mt-2 text-sm text-slate-500">Aynı anda sadece bir grafik açık olur. Kategori ve grafik seçimini değiştirerek odaklı inceleme yapabilirsiniz.</p>

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
                    className={`${navButton} ${selectedGraph === option.key ? 'ios-button-active' : 'text-slate-700 hover:bg-white/75'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ios-widget space-y-3 rounded-[24px] p-3 lg:hidden">
              <label className="text-sm font-semibold text-slate-700 block">
                Kategori
                <select
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
                  value={selectedGraph}
                  onChange={(event) => setSelectedGraph(event.target.value as GraphKey)}
                  className="ios-button mt-1 w-full rounded-[18px] px-3 py-2 text-sm"
                >
                  {optionsInCategory.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </aside>

          <div className="ios-chart-surface rounded-[26px] p-5">
            <div className="mb-4">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{CATEGORY_LABELS[selectedOption.category]}</div>
              <h4 className="mt-1 text-xl font-black text-slate-900">{selectedOption.label}</h4>
              <p className="mt-1 text-sm text-slate-500">{selectedOption.description}</p>
            </div>
            <ChartAccessibilitySummary title={selectedOption.label} summary={selectedChartSummary} />
            <div role="img" aria-label={`${selectedOption.label}. ${selectedChartSummary}`}>
              {renderGraph()}
            </div>

            {selectedGraph === 'general-score-trend' && (
              <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="ios-widget rounded-[22px] border-l-4 border-l-[#8AB4FF] p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">İlk Deneme Doğruluğu</div>
                  <div className="mt-2 text-3xl font-black text-slate-900">{qualityInsights.firstAttemptAverage ?? '-'}</div>
                  <p className="mt-1 text-xs text-slate-500">Konu bazında ilk deneme doğruluk ortalaması</p>
                </div>

                <div className="ios-widget rounded-[22px] border-l-4 border-l-[#7EE7C7] p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Altın Saat</div>
                  <div className="mt-2 text-3xl font-black text-slate-900">{goldenHourInsight.label}</div>
                  <p className="mt-1 text-xs text-slate-500">
                    Odak {goldenHourInsight.focus ?? '-'} / Doğruluk {goldenHourInsight.accuracy ?? '-'}
                  </p>
                </div>

                <div className="ios-widget rounded-[22px] border-l-4 border-l-[#FFC68B] p-4">
                  <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Hata Tipi Dağılımı</div>
                  {qualityInsights.errorDistribution.length === 0 ? (
                    <div className="ios-widget rounded-[18px] px-4 py-6 text-center text-sm text-slate-500">
                      Hata tipi dağılımı için yeterli soru oturumu verisi yok.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={qualityInsights.errorDistribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar legendType="none" dataKey="value" fill={chartPeach} name="Oran %" radius={[12, 12, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="ios-widget rounded-[22px] border-l-4 border-l-[#C4B5FD] p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Verimlilik</div>
                  <div className="mt-2 text-3xl font-black text-slate-900">{throughputInsight.correlation ?? '-'}</div>
                  <p className="mt-1 text-xs text-slate-500">Süre-doğruluk ilişkisi: {throughputInsight.profile}</p>
                </div>

                <div className="ios-widget rounded-[22px] border-l-4 border-l-[#FF9AA2] p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Akademik Özgüven</div>
                  <div className="mt-2 text-3xl font-black text-slate-900">{confidenceInsight.calibrationScore ?? '-'}</div>
                  <p className="mt-1 text-xs text-slate-500">Kalibrasyon skoru / Ortalama fark: {confidenceInsight.averageGap ?? '-'}</p>
                </div>

                <div className="ios-widget rounded-[22px] border-l-4 border-l-[#FFE08A] p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Yorgunluk Endeksi</div>
                  <div className="mt-2 text-3xl font-black text-slate-900">{fatigueInsight.fatiguePerHour ?? '-'}</div>
                  <p className="mt-1 text-xs text-slate-500">Saat başına odak düşüşü / Seviye: {fatigueInsight.level}</p>
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
