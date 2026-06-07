import React, { useMemo } from 'react';
import type { Course, SubjectCurriculum, Task, WeeklySchedule } from '../../types';
import {
  BarChart,
  BookOpen,
  Calculator,
  CheckCircle,
  Dna,
  FileText,
  Globe,
  GraduationCap,
  Home,
  Star,
  TrendingDown,
  TrendingUp,
  User,
} from '../icons';
import ParentWorkspaceFrame from './ParentWorkspaceFrame';
import ContextHelp from '../shared/ContextHelp';

const DAY_NAMES_ORDERED = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'] as const;

const SUBJECT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  matematik: Calculator,
  turkce: BookOpen,
  türkçe: BookOpen,
  'fen bilgisi': Dna,
  'fen bilimleri': Dna,
  ingilizce: Globe,
};

const THEMES = [
  { className: 'dr-curriculum-showcase-card-blue', accent: '#2297e6', accentSoft: '#dcefff' },
  { className: 'dr-curriculum-showcase-card-green', accent: '#2fc775', accentSoft: '#ddf7ea' },
  { className: 'dr-curriculum-showcase-card-orange', accent: '#ff8a24', accentSoft: '#ffe8d2' },
  { className: 'dr-curriculum-showcase-card-purple', accent: '#8b5cf6', accentSoft: '#ece5ff' },
] as const;

interface Props {
  courses: Course[];
  curriculum?: SubjectCurriculum;
  weeklySchedule?: WeeklySchedule;
  tasks: Task[];
  overviewCourseInsights: Array<{
    courseName: string;
    progress: number;
  }>;
  overviewTopicPerformanceRows: Array<{
    key?: string;
    courseName: string;
    unitName: string;
    topicName: string;
    lastCompletedAt: string;
    taskCount: number;
    totalQuestions: number;
    accuracyPercent?: number;
    minutes?: number;
    masteryScore?: number;
    learningVelocityLabel?: string;
    topicCostScore?: number;
    topicCostLabel?: string;
    learningDecision?: string;
  }>;
  onOpenOverviewReport: () => void;
  onOpenWeeklyAnalysis: () => void;
}

const normalize = (value: string) => value.trim().toLocaleLowerCase('tr-TR');

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getWeekStart = (date: Date) => {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? 6 : day - 1;
  copy.setDate(copy.getDate() - diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const isCompleted = (task: Task) => String(task.status) === 'tamamlandı' || String(task.status) === 'tamamland\u0131';

const getQuestionTotal = (task: Task) => Math.max(
  Number(task.questionCount || 0),
  Number(task.correctCount || 0) + Number(task.incorrectCount || 0) + Number(task.emptyCount || 0),
);

const isQuestionBearingTask = (task: Task) => (
  String(task.taskType) === 'soru çözme'
  || String(task.taskType) === 'soru \u00e7\u00f6zme'
  || String(task.taskType) === 'soru Ã§Ã¶zme'
  || String(task.taskType) === 'branş deneme'
  || String(task.taskType) === 'bran\u015f deneme'
  || String(task.taskType) === 'branÅŸ deneme'
  || String(task.taskType) === 'genel deneme'
);

const toTimeValue = (value?: string) => {
  if (!value) return 0;
  const parsed = Date.parse(value.includes('T') ? value : `${value}T12:00:00`);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getTaskSortValue = (task: Task) => Math.max(
  Number(task.completionTimestamp || 0),
  toTimeValue(task.completionDate),
  toTimeValue(task.dueDate),
  toTimeValue(task.createdAt),
);

const getUnitIndex = (curriculum: SubjectCurriculum | undefined, courseName: string, unitName?: string) => {
  if (!curriculum || !unitName) return -1;
  const matchingCourseKey = Object.keys(curriculum).find((key) => normalize(key) === normalize(courseName));
  const units = matchingCourseKey ? curriculum[matchingCourseKey] : [];
  if (!Array.isArray(units)) return -1;
  return units.findIndex((unit) => normalize(unit.name) === normalize(unitName));
};

const getUnitCount = (curriculum: SubjectCurriculum | undefined, courseName: string) => {
  if (!curriculum) return 0;
  const matchingCourseKey = Object.keys(curriculum).find((key) => normalize(key) === normalize(courseName));
  const units = matchingCourseKey ? curriculum[matchingCourseKey] : [];
  return Array.isArray(units) ? units.length : 0;
};

const getTopicIndex = (curriculum: SubjectCurriculum | undefined, courseName: string, unitName?: string, topicName?: string) => {
  if (!curriculum || !unitName || !topicName) return -1;
  const matchingCourseKey = Object.keys(curriculum).find((key) => normalize(key) === normalize(courseName));
  const units = matchingCourseKey ? curriculum[matchingCourseKey] : [];
  if (!Array.isArray(units)) return -1;
  let topicIndex = 0;
  for (const unit of units) {
    for (const topic of unit.topics || []) {
      if (normalize(unit.name) === normalize(unitName) && normalize(topic.name) === normalize(topicName)) {
        return topicIndex;
      }
      topicIndex += 1;
    }
  }
  return -1;
};

const getTopicCount = (curriculum: SubjectCurriculum | undefined, courseName: string) => {
  if (!curriculum) return 0;
  const matchingCourseKey = Object.keys(curriculum).find((key) => normalize(key) === normalize(courseName));
  const units = matchingCourseKey ? curriculum[matchingCourseKey] : [];
  if (!Array.isArray(units)) return 0;
  return units.reduce((sum, unit) => sum + (unit.topics || []).length, 0);
};

const toUnitPercent = (unitIndex: number, unitCount: number) => (
  unitIndex >= 0 && unitCount > 0 ? Math.max(0, Math.min(100, Math.round(((unitIndex + 1) / unitCount) * 100))) : null
);

const toProgressPercent = (index: number, count: number) => (
  index >= 0 && count > 0 ? Math.max(0, Math.min(100, Math.round(((index + 1) / count) * 100))) : null
);

const ParentCurriculumShowcaseWorkspace: React.FC<Props> = ({
  courses,
  curriculum,
  weeklySchedule,
  tasks,
  overviewCourseInsights,
  overviewTopicPerformanceRows,
  onOpenOverviewReport,
  onOpenWeeklyAnalysis,
}) => {
  const gridRef = React.useRef<HTMLDivElement>(null);
  const [isDown, setIsDown] = React.useState(false);
  const [startX, setStartX] = React.useState(0);
  const [scrollLeft, setScrollLeft] = React.useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!gridRef.current) return;
    setIsDown(true);
    setStartX(e.pageX - gridRef.current.offsetLeft);
    setScrollLeft(gridRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDown(false);
  };

  const handleMouseUp = () => {
    setIsDown(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDown || !gridRef.current) return;
    e.preventDefault();
    const x = e.pageX - gridRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    gridRef.current.scrollLeft = scrollLeft - walk;
  };

  const activeCourses = useMemo(() => {
    const seen = new Set<string>();
    return courses.filter((course) => {
      if (course.active === false) return false;
      const key = normalize(course.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [courses]);
  const cards = useMemo(() => {
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const allActiveCourses = courses.filter((course) => course.active !== false);
    const courseNameById = new Map(allActiveCourses.map((course) => [course.id, course.name]));
    const tasksByCourseName = new Map<string, Task[]>();
    safeTasks.forEach((task) => {
      const courseName = courseNameById.get(task.courseId);
      if (!courseName) return;
      const key = normalize(courseName);
      const current = tasksByCourseName.get(key) || [];
      current.push(task);
      tasksByCourseName.set(key, current);
    });
    const schoolByCourse = new Map<string, {
      unitName?: string;
      topicName?: string;
      status?: 'covered' | 'not-covered';
      sortKey: string;
    }>();

    DAY_NAMES_ORDERED.forEach((dayName, dayIndex) => {
      const day = weeklySchedule?.[dayName];
      (day?.slots || []).forEach((slot) => {
        if (slot.schoolCurriculumStatus !== 'covered' && slot.schoolCurriculumStatus !== 'not-covered') return;
        const key = normalize(slot.courseName || '');
        const sortKey = slot.schoolCurriculumUpdatedAt || `${String(dayIndex).padStart(2, '0')}-${slot.endTime || slot.startTime || '00:00'}`;
        const current = schoolByCourse.get(key);
        if (!current || sortKey >= current.sortKey) {
          schoolByCourse.set(key, {
            unitName: slot.schoolUnitName,
            topicName: slot.schoolTopicName,
            status: slot.schoolCurriculumStatus,
            sortKey,
          });
        }
      });
    });

    const childByCourse = new Map<string, {
      unitName?: string;
      topicName?: string;
      sortValue: number;
      statusWeight: number;
    }>();

    safeTasks.forEach((task) => {
      const unitName = task.curriculumUnitName?.trim();
      const topicName = task.curriculumTopicName?.trim();
      if (!unitName || !topicName) return;
      const courseName = courseNameById.get(task.courseId);
      if (!courseName) return;
      const key = normalize(courseName);
      const statusWeight = isCompleted(task) ? 2 : 1;
      const sortValue = getTaskSortValue(task);
      const current = childByCourse.get(key);
      if (!current || sortValue > current.sortValue || (sortValue === current.sortValue && statusWeight > current.statusWeight)) {
        childByCourse.set(key, {
          unitName,
          topicName,
          sortValue,
          statusWeight,
        });
      }
    });

    overviewTopicPerformanceRows.forEach((row) => {
      if (!row.courseName || !row.topicName) return;
      const hasStudentEvidence = Boolean(row.lastCompletedAt) || Number(row.taskCount || 0) > 0 || Number(row.totalQuestions || 0) > 0;
      if (!hasStudentEvidence) return;
      const key = normalize(row.courseName);
      const sortValue = Math.max(toTimeValue(row.lastCompletedAt), Number(row.taskCount || 0), Number(row.totalQuestions || 0));
      const current = childByCourse.get(key);
      if (!current || sortValue > current.sortValue || (sortValue === current.sortValue && current.statusWeight < 2)) {
        childByCourse.set(key, {
          unitName: row.unitName,
          topicName: row.topicName,
          sortValue,
          statusWeight: 2,
        });
      }
    });

    const now = new Date();
    const currentWeekStart = getWeekStart(now);
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const currentWeekStartKey = toDateKey(currentWeekStart);
    const previousWeekStartKey = toDateKey(previousWeekStart);
    const todayKey = toDateKey(now);
    const previousWeekEnd = new Date(currentWeekStart);
    previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);
    const previousWeekEndKey = toDateKey(previousWeekEnd);

    return activeCourses.map((course, index) => {
      const insight = overviewCourseInsights.find((item) => normalize(item.courseName) === normalize(course.name));
      const school = schoolByCourse.get(normalize(course.name));
      const child = childByCourse.get(normalize(course.name));
      const courseTasks = tasksByCourseName.get(normalize(course.name)) || [];
      const questionTasks = courseTasks.filter((task) => isQuestionBearingTask(task) && getQuestionTotal(task) > 0);
      const currentWeekQuestions = questionTasks
        .filter((task) => isCompleted(task) && (task.completionDate || '') >= currentWeekStartKey && (task.completionDate || '') <= todayKey)
        .reduce((sum, task) => sum + getQuestionTotal(task), 0);
      const previousWeekQuestions = questionTasks
        .filter((task) => isCompleted(task) && (task.completionDate || '') >= previousWeekStartKey && (task.completionDate || '') <= previousWeekEndKey)
        .reduce((sum, task) => sum + getQuestionTotal(task), 0);
      const weeklyQuestionDelta = currentWeekQuestions - previousWeekQuestions;
      const weeklyQuestionTarget = Math.max(100, currentWeekQuestions, previousWeekQuestions);
      const schoolUnitIndex = school?.status === 'covered' ? getUnitIndex(curriculum, course.name, school.unitName) : -1;
      const childUnitIndex = getUnitIndex(curriculum, course.name, child?.unitName);
      const schoolTopicIndex = school?.status === 'covered' ? getTopicIndex(curriculum, course.name, school.unitName, school.topicName) : -1;
      const childTopicIndex = getTopicIndex(curriculum, course.name, child?.unitName, child?.topicName);
      const unitCount = getUnitCount(curriculum, course.name);
      const topicCount = getTopicCount(curriculum, course.name);
      const hasSchoolData = Boolean(school && (school.status === 'not-covered' || school.topicName));
      const hasStudentData = Boolean(child?.topicName);
      const insightProgress = Math.round(insight?.progress || 0);
      const hasTopicComparison = schoolTopicIndex >= 0 && childTopicIndex >= 0;
      const hasUnitComparison = schoolUnitIndex >= 0 && childUnitIndex >= 0;
      const schoolCompareIndex = hasTopicComparison ? schoolTopicIndex : hasUnitComparison ? schoolUnitIndex : -1;
      const childCompareIndex = hasTopicComparison ? childTopicIndex : hasUnitComparison ? childUnitIndex : -1;
      const compareUnitLabel = hasTopicComparison ? 'KONU' : 'ÜNİTE';
      const compareUnitLabelLower = hasTopicComparison ? 'konu' : 'ünite';
      const schoolProgressPercent = schoolTopicIndex >= 0
        ? toProgressPercent(schoolTopicIndex, topicCount)
        : toUnitPercent(schoolUnitIndex, unitCount);
      const studentProgressPercent = childTopicIndex >= 0
        ? toProgressPercent(childTopicIndex, topicCount)
        : toUnitPercent(childUnitIndex, unitCount);
      const hasComparableData = schoolCompareIndex >= 0 && childCompareIndex >= 0;
      const hasComparisonData = hasSchoolData && hasStudentData && hasComparableData;
      const fallbackStudentProgress = studentProgressPercent ?? 0;
      const hasProgressData = hasStudentData && (insightProgress > 0 || fallbackStudentProgress > 0);
      const displayProgress = insightProgress > 0 ? insightProgress : fallbackStudentProgress;
      const progressLabel = hasSchoolData && hasStudentData ? 'Konu İlerlemesi:' : hasStudentData ? 'Ev İlerlemesi:' : 'Konu İlerlemesi:';
      const progressBadgeLabel = hasProgressData && !hasSchoolData ? 'EV' : 'KONU';
      const gap = schoolCompareIndex >= 0 && childCompareIndex >= 0 ? childCompareIndex - schoolCompareIndex : null;
      const statusKind = school?.status === 'not-covered'
        ? 'idle'
        : gap === null
          ? 'unknown'
          : gap > 0
            ? 'ahead'
            : gap < 0
              ? 'behind'
              : 'sync';
      const statusLabel = statusKind === 'ahead'
        ? `OKULUN ÖNÜNDE (+${Math.abs(gap || 0)} ${compareUnitLabel})`
        : statusKind === 'behind'
          ? `OKULUN GERİSİNDE (-${Math.abs(gap || 0)} ${compareUnitLabel})`
          : statusKind === 'sync'
            ? `SENKRONİZE (AYNI ${compareUnitLabel})`
            : school?.status === 'not-covered'
              ? 'OKULDA KONU İŞLENMEDİ'
              : !hasSchoolData && hasStudentData
                ? 'OKUL VERİSİ GEREKLİ'
                : hasSchoolData && !hasStudentData
                  ? 'EV ÇALIŞMASI BEKLİYOR'
                  : 'VERİ GİRİŞİ BEKLİYOR';
      return {
        courseName: course.name,
        Icon: SUBJECT_ICONS[normalize(course.name)] || BookOpen,
        theme: THEMES[index % THEMES.length],
        accent: THEMES[index % THEMES.length].accent,
        accentSoft: THEMES[index % THEMES.length].accentSoft,
        schoolTopic: school?.status === 'not-covered' ? 'Konu işlenmedi' : school?.topicName || 'Okul verisi girilmedi',
        childTopic: child?.topicName || 'Öğrenci çalışma verisi yok',
        gap,
        statusKind,
        statusLabel,
        hasProgressData,
        progressLabel,
        progressBadgeLabel,
        compareUnitLabel,
        compareUnitLabelLower,
        hasSchoolData,
        hasStudentData,
        hasComparisonData,
        schoolProgressPercent,
        studentProgressPercent,
        unitCount,
        lgsProgress: hasProgressData ? Math.max(0, Math.min(100, displayProgress)) : null,
        currentWeekQuestions,
        previousWeekQuestions,
        weeklyQuestionDelta,
        weeklyQuestionTarget,
      };
    });
  }, [activeCourses, courses, curriculum, overviewCourseInsights, overviewTopicPerformanceRows, tasks, weeklySchedule]);

  const aheadCount = cards.filter((card) => card.statusKind === 'ahead').length;
  const behindCount = cards.filter((card) => card.statusKind === 'behind').length;
  const syncCount = cards.filter((card) => card.statusKind === 'sync').length;
  const waitingCount = cards.filter((card) => !card.hasComparisonData).length;
  const learningRows = useMemo(() => (overviewTopicPerformanceRows || [])
    .filter((row) => Number(row.taskCount || 0) > 0)
    .sort((a, b) => Number(b.topicCostScore || 0) - Number(a.topicCostScore || 0) || Number(a.masteryScore || 0) - Number(b.masteryScore || 0))
    .slice(0, 8), [overviewTopicPerformanceRows]);
  const hardLearningCount = learningRows.filter((row) => row.learningVelocityLabel === 'Zor ogrenilen').length;
  const highCostCount = learningRows.filter((row) => Number(row.topicCostScore || 0) >= 55).length;

  return (
    <ParentWorkspaceFrame title="Müfredat Paneli" description="Okul ve çocuk konu hizası" spacing="wide">
      <section className="dr-curriculum-showcase-panel" data-testid="curriculum-showcase-panel">
        {/* Decorative macOS Window Controls (Traffic Lights) */}
        <div className="flex items-center gap-1.5 mb-5 pl-0.5" aria-hidden="true">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/85" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/85" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF4F18]/90" />
        </div>
        <div className="dr-curriculum-showcase-head">
          <div>
            <div className="flex items-center gap-2">
              <h3>Veli Paneli - Öğrenci</h3>
              <ContextHelp title="Mufredat Paneli" tone="blue">
                Bu alan okul programinda girilen konu ile cocugun evde calistigi son konuyu karsilastirir. Okul verisi eksikse kart bunu acikca soyler; ev calismasi varsa yine takipte kalir.
              </ContextHelp>
            </div>
            <p><strong>GENEL BAKIŞ:</strong> Çocuğunuz {aheadCount} derste okulun önünde, {behindCount} derste geride.</p>
          </div>
          <div className="dr-curriculum-avatar">
            <User className="h-7 w-7" />
          </div>
        </div>

        <div className="dr-curriculum-showcase-grid">
          <div 
            ref={gridRef}
            className="dr-curriculum-cards-slider"
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            style={{ cursor: isDown ? 'grabbing' : 'grab' }}
          >
            {cards.map((card) => {
              const Icon = card.Icon;
              const StatusIcon = card.statusKind === 'behind' ? TrendingDown : card.statusKind === 'ahead' ? TrendingUp : CheckCircle;
              const circumference = 2 * Math.PI * 38;
              const progressValue = typeof card.lgsProgress === 'number' ? card.lgsProgress : 0;
              const dashOffset = circumference - (circumference * progressValue) / 100;
              return (
                <article key={`curriculum-showcase-${card.courseName}`} className={`dr-curriculum-showcase-card ${card.theme.className} dr-curriculum-status-${card.statusKind}`}>
                  <div className="dr-curriculum-card-top">
                    <div className="dr-curriculum-watermark dr-curriculum-watermark-left">
                      <Icon className="h-12 w-12" />
                    </div>
                    <Star className="dr-curriculum-star dr-curriculum-star-a h-5 w-5" />
                    <Star className="dr-curriculum-star dr-curriculum-star-b h-3.5 w-3.5" />
                    <div className="relative z-10 min-w-0">
                      <h4>{card.courseName.toLocaleUpperCase('tr-TR')}</h4>
                      <div className="flex items-center gap-1.5">
                        <p>{card.progressLabel}</p>
                        <ContextHelp title={`${card.courseName} ilerlemesi`} tone="blue">
                          Yuvarlak rozet, bu ders icin kayitli mufredat verisine gore ogrencinin konu veya ev calismasi ilerlemesini gosterir. Veri yoksa hesap uydurulmaz; kart veri yok der.
                        </ContextHelp>
                      </div>
                    </div>
                    <div className={`dr-curriculum-progress ${card.hasProgressData ? '' : 'is-empty'}`} aria-label={card.hasProgressData ? `${card.progressBadgeLabel} yüzde ${card.lgsProgress}` : 'Konu ilerleme verisi yok'}>
                      <svg viewBox="0 0 92 92" aria-hidden="true">
                        <circle cx="46" cy="46" r="38" />
                        <circle cx="46" cy="46" r="38" style={{ strokeDasharray: circumference, strokeDashoffset: dashOffset }} />
                      </svg>
                      <span>{card.hasProgressData ? <>{card.progressBadgeLabel}<br />%{card.lgsProgress}</> : <>KONU<br />Veri yok</>}</span>
                    </div>
                  </div>

                  <div className="dr-curriculum-card-body">
                    <div className="dr-curriculum-detail-title flex items-center gap-2">
                      Durum Özeti
                      <ContextHelp title="Durum ozeti" tone="mint">
                        Okul gundemi son okul programi kaydindan, ev gundemi cocuga atanip tamamlanan veya bekleyen konu gorevlerinden gelir. Ikisi ayni ders icinde karsilastirilir.
                      </ContextHelp>
                    </div>
                    <div className="dr-curriculum-topic-card">
                      <div className="dr-curriculum-topic-icon">
                        <BookOpen className="h-6 w-6" />
                      </div>
                      <div>
                        <span className="inline-flex items-center gap-1.5">
                          Okul Gündemi:
                          <ContextHelp title="Okul gundemi" tone="blue">
                            Haftalik Calisma Programi icinde okulda islenen konu olarak isaretlenen son konu burada gorunur. Okul verisi girilmezse takip karti bunu eksik veri olarak gosterir.
                          </ContextHelp>
                        </span>
                        <strong>{card.schoolTopic}</strong>
                      </div>
                      {card.statusKind === 'sync' && <CheckCircle className="dr-curriculum-topic-check h-7 w-7" />}
                    </div>

                    <div className="dr-curriculum-topic-card">
                      <div className="dr-curriculum-topic-icon">
                        <Home className="h-6 w-6" />
                      </div>
                      <div>
                        <span className="inline-flex items-center gap-1.5">
                          Ev Gündemi:
                          <ContextHelp title="Ev gundemi" tone="mint">
                            Cocugun evde calistigi veya kendisine atanmis son ders-konu kaydi burada gorunur. Bu veri gorevler ve tamamlanan calismalardan beslenir.
                          </ContextHelp>
                        </span>
                        <strong>{card.childTopic}</strong>
                      </div>
                    </div>

                    <div className={`dr-curriculum-track dr-curriculum-track-${card.statusKind}`}>
                      <div className="dr-curriculum-track-line" />
                      <div className="dr-curriculum-track-arrow" aria-hidden="true" />
                      <div className="dr-curriculum-track-node">
                        <Home className="h-5 w-5" />
                        <span>OKUL</span>
                      </div>
                      <div className={`dr-curriculum-track-node dr-curriculum-track-student ${card.statusKind === 'behind' ? 'is-behind' : card.statusKind === 'ahead' ? 'is-ahead' : ''}`}>
                        <GraduationCap className="h-5 w-5" />
                        <span>ÖĞRENCİ</span>
                      </div>
                    </div>

                    {card.gap !== null && card.gap !== 0 && (
                      <div className="dr-curriculum-floating-badge" aria-label={card.statusLabel}>
                        <StatusIcon className="h-6 w-6" />
                        <span>{card.statusKind === 'ahead' ? 'Öğrenci okulun önünde' : 'Okulun gerisinde'}</span>
                        <strong>{card.gap > 0 ? `+${card.gap}` : card.gap} {card.compareUnitLabelLower}</strong>
                      </div>
                    )}

                    <div className="dr-curriculum-status-box">
                      <div className="dr-curriculum-status-copy">
                        <span>Durum:</span>
                        <strong>{card.statusLabel}</strong>
                      </div>
                      <div className="dr-curriculum-status-badge">
                        <StatusIcon className="h-7 w-7" />
                      </div>
                      <div className="dr-curriculum-gap-pill">
                        {card.gap === null ? '-' : card.gap > 0 ? `+${card.gap}` : `${card.gap}`}
                        <span>{card.compareUnitLabel}</span>
                      </div>
                    </div>

                    <div className="dr-curriculum-actions">
                      <button type="button" onClick={onOpenOverviewReport}><FileText className="h-4 w-4" />Durum Raporu</button>
                      <button type="button" onClick={onOpenWeeklyAnalysis}><BarChart className="h-4 w-4" />Haftalık Analiz</button>
                    </div>

                    <div className="dr-curriculum-question-card">
                      <div className="dr-curriculum-question-title">Haftalık Soru Çözümü</div>
                      <div className="dr-curriculum-question-bar" aria-label={`Bu hafta ${card.currentWeekQuestions} soru`}>
                        <span style={{ width: `${Math.min(100, Math.round((card.currentWeekQuestions / card.weeklyQuestionTarget) * 100))}%` }} />
                      </div>
                      <div className="dr-curriculum-question-meta">
                        Bu Hafta: <strong>{card.currentWeekQuestions} Soru</strong>
                        <em className={card.weeklyQuestionDelta >= 0 ? 'is-up' : 'is-down'}>
                          {card.weeklyQuestionDelta >= 0 ? `(+${card.weeklyQuestionDelta} artış)` : `(${card.weeklyQuestionDelta} düşüş)`}
                        </em>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <section className="dr-curriculum-progress-compare" aria-label="Konu ogrenme hizi ve maliyet analizi">
            <div className="dr-curriculum-progress-compare-head">
              <div>
                <span>Akademik Kaynak Analizi</span>
                <div className="flex items-center gap-2">
                  <h4>Konu Ogrenme Analizi</h4>
                  <ContextHelp title="Konu Ogrenme Analizi" tone="lilac">
                    Konulari oturum sayisi, calisma suresi, cozulen soru ve son hakimiyet ile okur. Zor ogrenilen veya yuksek maliyetli konular veli kararinda one cikar.
                  </ContextHelp>
                </div>
              </div>
              <div className="dr-curriculum-progress-compare-score">
                <strong>{highCostCount}</strong>
                <span>yuksek maliyet</span>
              </div>
            </div>
            <div className="dr-curriculum-progress-compare-stats" aria-label="Konu ogrenme ozeti">
              <span><strong>{learningRows.length}</strong> Izlenen konu</span>
              <span><strong>{hardLearningCount}</strong> Zor ogrenilen</span>
              <span><strong>{highCostCount}</strong> Yuksek maliyet</span>
              <span><strong>{learningRows.filter((row) => row.learningVelocityLabel === 'Hizli ogrenilen').length}</strong> Hizli</span>
            </div>
            <div className="mt-4 overflow-hidden rounded-[22px] border border-white/20 bg-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-md dark:bg-white/5">
              <div className="grid grid-cols-[minmax(160px,1.5fr)_80px_90px_80px_100px_120px] gap-3 border-b border-slate-900/5 px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 max-lg:hidden">
                <span>Konu</span><span>Oturum</span><span>Sure</span><span>Soru</span><span>Hakimiyet</span><span>Karar</span>
              </div>
              <div className="max-h-[360px] overflow-y-auto">
                {learningRows.map((row) => (
                  <div key={`learning-row-${row.key || row.courseName + row.unitName + row.topicName}`} className="grid gap-3 border-b border-slate-900/5 px-4 py-3 text-xs last:border-b-0 lg:grid-cols-[minmax(160px,1.5fr)_80px_90px_80px_100px_120px] lg:items-center">
                    <div className="min-w-0">
                      <div className="break-words font-black text-slate-900 dark:text-white">{row.topicName}</div>
                      <div className="mt-0.5 break-words text-[11px] font-semibold text-slate-500">{row.courseName} / {row.unitName}</div>
                    </div>
                    <div className="font-black text-slate-800 dark:text-slate-100">{row.taskCount || 0}</div>
                    <div className="font-black text-slate-800 dark:text-slate-100">{Math.floor(Number(row.minutes || 0) / 60)} sa {Number(row.minutes || 0) % 60} dk</div>
                    <div className="font-black text-slate-800 dark:text-slate-100">{row.totalQuestions || 0}</div>
                    <div className="font-black text-slate-800 dark:text-slate-100">%{row.masteryScore ?? row.accuracyPercent ?? 0}</div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black ${row.learningVelocityLabel === 'Zor ogrenilen' ? 'bg-rose-50 text-rose-700' : row.learningVelocityLabel === 'Hizli ogrenilen' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{row.learningVelocityLabel || 'Veri yok'}</span>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black ${Number(row.topicCostScore || 0) >= 75 ? 'bg-rose-50 text-rose-700' : Number(row.topicCostScore || 0) >= 55 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{row.topicCostLabel || 'Dusuk'}</span>
                    </div>
                    <div className="lg:col-span-6 rounded-[14px] bg-white/55 px-3 py-2 text-[11px] font-semibold leading-5 text-slate-600 dark:bg-white/5 dark:text-slate-300">
                      {row.learningDecision}
                    </div>
                  </div>
                ))}
                {learningRows.length === 0 && (
                  <div className="px-4 py-5 text-sm font-semibold text-slate-500">Konu ogrenme analizi icin tamamlanmis soru/cozum verisi yok.</div>
                )}
              </div>
            </div>
          </section>

          <section className="dr-curriculum-progress-compare" aria-label="Genel konu ilerleme durumu">
            <div className="dr-curriculum-progress-compare-head">
              <div>
                <span>Canlı Karşılaştırma</span>
                <div className="flex items-center gap-2">
                  <h4>Genel Konu İlerlemesi</h4>
                  <ContextHelp title="Genel konu ilerlemesi" tone="lilac">
                    Her satirda okul ve ogrenci noktasi ayni mufredat sirasi uzerinde gosterilir. Ogrenci ondeyse arti, gerideyse eksi fark yazilir; veri yoksa tahmini sonuc uretilmez.
                  </ContextHelp>
                </div>
              </div>
              <div className="dr-curriculum-progress-compare-score">
                <strong>{aheadCount}</strong>
                <span>önde</span>
              </div>
            </div>

            <div className="dr-curriculum-progress-compare-stats" aria-label="Ders durum özeti">
              <span><strong>{aheadCount}</strong> Önde</span>
              <span><strong>{syncCount}</strong> Aynı</span>
              <span><strong>{behindCount}</strong> Geride</span>
              <span><strong>{waitingCount}</strong> Tamamlanacak</span>
            </div>

            <div className="dr-curriculum-progress-legend" aria-hidden="true">
              <span><i className="is-school" />Okul</span>
              <span><i className="is-student" />Öğrenci</span>
            </div>

            <div className="dr-curriculum-progress-chart">
              {cards.map((card) => {
                const schoolPercent = card.schoolProgressPercent;
                const studentPercent = card.studentProgressPercent;
                const hasBoth = schoolPercent !== null && studentPercent !== null;
                const segmentStart = hasBoth ? Math.min(schoolPercent, studentPercent) : 0;
                const segmentWidth = hasBoth ? Math.max(2, Math.abs(studentPercent - schoolPercent)) : 0;
                const rowStyle = {
                  '--course-accent': card.accent,
                  '--course-accent-soft': card.accentSoft,
                } as React.CSSProperties;
                return (
                  <div key={`curriculum-progress-row-${card.courseName}`} className={`dr-curriculum-progress-row dr-curriculum-progress-row-${card.statusKind}`} style={rowStyle}>
                    <div className="dr-curriculum-progress-row-title">
                      <strong>{card.courseName}</strong>
                      <span>
                        {card.gap === null
                          ? 'veri yok'
                          : card.gap === 0
                            ? `aynı ${card.compareUnitLabelLower}`
                            : card.gap > 0
                              ? `+${card.gap} ${card.compareUnitLabelLower}`
                              : `${card.gap} ${card.compareUnitLabelLower}`}
                      </span>
                    </div>
                    <div className="dr-curriculum-progress-rail" aria-label={`${card.courseName} okul ${schoolPercent ?? 'veri yok'}, öğrenci ${studentPercent ?? 'veri yok'}`}>
                      {hasBoth && (
                        <span
                          className="dr-curriculum-progress-segment"
                          style={{ left: `${segmentStart}%`, width: `${segmentWidth}%` }}
                        />
                      )}
                      {schoolPercent !== null && (
                        <span className="dr-curriculum-progress-dot is-school" style={{ left: `${schoolPercent}%` }} />
                      )}
                      {studentPercent !== null && (
                        <span className="dr-curriculum-progress-dot is-student" style={{ left: `${studentPercent}%` }} />
                      )}
                    </div>
                    <div className="dr-curriculum-progress-values">
                      <span className="is-school">
                        <small>Okul</small>
                        <strong>{schoolPercent === null ? 'veri yok' : `%${schoolPercent}`}</strong>
                      </span>
                      <span className="is-student">
                        <small>Öğrenci</small>
                        <strong>{studentPercent === null ? 'veri yok' : `%${studentPercent}`}</strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </section>
    </ParentWorkspaceFrame>
  );
};

export default ParentCurriculumShowcaseWorkspace;
