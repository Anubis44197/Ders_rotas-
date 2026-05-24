import React from 'react';
import type { Course, ExamScheduleEntry, PlanningEngineSnapshot, StoredStudyPlan, SubjectCurriculum, Task, WeeklySchedule } from '../../types';
import { BookOpen, PlusCircle } from '../icons';
import WeeklySchedulePanel from './WeeklySchedulePanel';
import PlanningPanel from './PlanningPanel';
import { getTodayString } from '../../utils/dateUtils';

interface CurriculumSummary {
  subjects: string[];
  unitCount: number;
  topicCount: number;
  completedTopicCount: number;
}

interface CourseReferenceHealth {
  taskCount: number;
  examRecordCount: number;
  compositeExamCount: number;
  examScheduleCount: number;
  performanceCount: number;
  scheduleBlockCount: number;
}

interface ParentPlanningWorkspaceProps {
  curriculum: SubjectCurriculum;
  curriculumSummary: CurriculumSummary;
  weeklySchedule: WeeklySchedule;
  planningEngineSnapshot: PlanningEngineSnapshot;
  examScheduleEntries: ExamScheduleEntry[];
  studyPlans: StoredStudyPlan[];
  courses: Course[];
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'status'>) => Promise<Task>;
  deleteTask: (taskId: string) => void;
  updateTaskStatus: (taskId: string, status: 'bekliyor' | 'tamamland\u0131') => void;
  updateTaskFromPlan: (planTaskId: string, updates: Partial<Pick<Task, 'plannedDuration' | 'questionCount' | 'planLabel'>>) => void;
  onChangeSchedule: (schedule: WeeklySchedule) => void;
  onChangePlans: React.Dispatch<React.SetStateAction<StoredStudyPlan[]>>;
  onChangeExamSchedules: React.Dispatch<React.SetStateAction<ExamScheduleEntry[]>>;
  onOpenCurriculumEditor: () => void;
  onReactivateCourse: (courseId: string) => void;
  courseReferenceHealth: CourseReferenceHealth;
  overviewWeakTopicActions?: Array<{
    key: string;
    courseName: string;
    topicName: string;
    reason: string;
    action: string;
    taskStatus: string;
  }>;
}

const ParentPlanningWorkspace: React.FC<ParentPlanningWorkspaceProps> = ({
  curriculum,
  curriculumSummary,
  weeklySchedule,
  planningEngineSnapshot,
  examScheduleEntries,
  studyPlans,
  courses,
  tasks,
  addTask,
  deleteTask,
  updateTaskStatus,
  updateTaskFromPlan,
  onChangeSchedule,
  onChangePlans,
  onChangeExamSchedules,
  onOpenCurriculumEditor,
  onReactivateCourse,
  courseReferenceHealth = {
    taskCount: 0,
    examRecordCount: 0,
    compositeExamCount: 0,
    examScheduleCount: 0,
    performanceCount: 0,
    scheduleBlockCount: 0,
  },
  overviewWeakTopicActions = [],
}) => {
  const safeCourses = Array.isArray(courses) ? courses : [];
  const safeCurriculumSummary = {
    subjects: Array.isArray(curriculumSummary?.subjects) ? curriculumSummary.subjects : [],
    unitCount: Number(curriculumSummary?.unitCount) || 0,
    topicCount: Number(curriculumSummary?.topicCount) || 0,
    completedTopicCount: Number(curriculumSummary?.completedTopicCount) || 0,
  };
  const safeCourseReferenceHealth = courseReferenceHealth || {
    taskCount: 0,
    examRecordCount: 0,
    compositeExamCount: 0,
    examScheduleCount: 0,
    performanceCount: 0,
    scheduleBlockCount: 0,
  };
  const activeCourses = safeCourses.filter((course) => course.active !== false);
  const inactiveCourses = safeCourses.filter((course) => course.active === false);
  const brokenReferenceTotal = Object.values(safeCourseReferenceHealth).reduce((sum, count) => sum + count, 0);
  const hasScheduleBlocks = Object.values(weeklySchedule || {}).some((day) => Array.isArray(day?.slots) && day.slots.length > 0);
  const hasStudyWindows = Object.values(weeklySchedule || {}).some((day) => Array.isArray(day?.availableWindows) && day.availableWindows.length > 0);
  const hasExamPlan = Array.isArray(examScheduleEntries) && examScheduleEntries.length > 0;
  const today = getTodayString();
  const todaySlots = Object.values(weeklySchedule || {})
    .flatMap((day) => (Array.isArray(day?.slots) ? day.slots : []))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .slice(0, 4);
  const todayPendingTasks = tasks
    .filter((task) => task.status === 'bekliyor' && task.dueDate <= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title))
    .slice(0, 4);

  const firstPlanningAction = !hasScheduleBlocks
    ? 'Okul programina en az bir ders blogu ekleyin.'
    : !hasStudyWindows
      ? 'Ev calisma zamani penceresi ekleyin.'
      : !hasExamPlan
        ? 'Sinav takvimi girerek plan motorunu netlestirin.'
        : 'Plan zemini hazir. Haftalik plan olusturma adimina gecebilirsiniz.';

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900">Planlama Modu</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">Burada sadece plan kurulur. Karar ve yorumlar analiz ekraninda kalir.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm text-slate-600">
          <div className="ios-widget rounded-2xl px-4 py-3"><span className="block text-xs font-bold uppercase text-slate-500">Aktif ders</span><span className="text-xl font-black text-slate-900">{activeCourses.length}</span></div>
          <div className="ios-widget rounded-2xl px-4 py-3"><span className="block text-xs font-bold uppercase text-slate-500">Ünite</span><span className="text-xl font-black text-slate-900">{safeCurriculumSummary.unitCount}</span></div>
          <div className="ios-widget rounded-2xl px-4 py-3"><span className="block text-xs font-bold uppercase text-slate-500">Konu</span><span className="text-xl font-black text-slate-900">{safeCurriculumSummary.topicCount}</span></div>
        </div>
      </section>

      {brokenReferenceTotal > 0 && (
        <section className="ios-coral rounded-[24px] p-5 text-rose-950">
          <div className="text-xs font-black uppercase tracking-[0.16em] opacity-75">Veri bağlantı kontrolü</div>
          <h3 className="mt-2 text-xl font-black">Ders kaydı bulunamayan {brokenReferenceTotal} bağlantı var</h3>
          <p className="mt-2 text-sm font-semibold opacity-80">Bu kayıtlar silinmedi; ancak hangi derse ait oldukları netleşmeden yeni plan üretiminde kullanılamayabilir.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
            {safeCourseReferenceHealth.taskCount > 0 && <span className="rounded-full bg-white/40 px-3 py-2">Görev {safeCourseReferenceHealth.taskCount}</span>}
            {safeCourseReferenceHealth.examRecordCount > 0 && <span className="rounded-full bg-white/40 px-3 py-2">Okul sınavı {safeCourseReferenceHealth.examRecordCount}</span>}
            {safeCourseReferenceHealth.compositeExamCount > 0 && <span className="rounded-full bg-white/40 px-3 py-2">Deneme satırı {safeCourseReferenceHealth.compositeExamCount}</span>}
            {safeCourseReferenceHealth.examScheduleCount > 0 && <span className="rounded-full bg-white/40 px-3 py-2">Sınav takvimi {safeCourseReferenceHealth.examScheduleCount}</span>}
            {safeCourseReferenceHealth.performanceCount > 0 && <span className="rounded-full bg-white/40 px-3 py-2">Performans {safeCourseReferenceHealth.performanceCount}</span>}
            {safeCourseReferenceHealth.scheduleBlockCount > 0 && <span className="rounded-full bg-white/40 px-3 py-2">Okul programı {safeCourseReferenceHealth.scheduleBlockCount}</span>}
          </div>
        </section>
      )}

      <section className="ios-widget rounded-[24px] p-5">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Bugun once bunu yapin</div>
        <h3 className="mt-2 text-lg font-black text-slate-900">{firstPlanningAction}</h3>
        <p className="mt-2 text-sm text-slate-500">Planlama sade tutuldu: once okul blogu, sonra calisma zamani, sonra sinav takvimi.</p>
        <div className="mt-4 grid gap-2 text-xs font-bold text-slate-600 sm:grid-cols-3">
          <div className={`rounded-[14px] px-3 py-2 ${hasScheduleBlocks ? 'ios-mint text-emerald-900' : 'ios-button'}`}>1. Okul blogu {hasScheduleBlocks ? 'hazir' : 'bekliyor'}</div>
          <div className={`rounded-[14px] px-3 py-2 ${hasStudyWindows ? 'ios-mint text-emerald-900' : 'ios-button'}`}>2. Calisma zamani {hasStudyWindows ? 'hazir' : 'bekliyor'}</div>
          <div className={`rounded-[14px] px-3 py-2 ${hasExamPlan ? 'ios-mint text-emerald-900' : 'ios-button'}`}>3. Sinav takvimi {hasExamPlan ? 'hazir' : 'opsiyonel'}</div>
        </div>
      </section>

      <section className="ios-card rounded-[24px] p-5">
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="h-4.5 w-4.5 text-amber-500" />
          <h3 className="text-base font-black text-slate-900">One cikan risk alanlari</h3>
        </div>
        <div className="space-y-2">
          {overviewWeakTopicActions.length === 0 && (
            <div className="ios-widget rounded-[14px] p-3 text-xs font-semibold text-slate-500">
              Risk listesi icin daha fazla calisma verisi bekleniyor.
            </div>
          )}
          {overviewWeakTopicActions.slice(0, 3).map((item, index) => (
            <div key={item.key} className="ios-widget rounded-[14px] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-xs font-black text-amber-700">{index + 1}</span>
                  <span className="text-sm font-black text-slate-900">{item.topicName}</span>
                </div>
                <span className="rounded-full bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700">Risk</span>
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-500">{item.courseName}</div>
              <div className="mt-2 text-[11px] font-semibold text-slate-600">Neden: {item.reason}</div>
              <div className="text-[11px] font-semibold text-slate-600">Bugun yapilacak: {item.action}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="ios-card rounded-[24px] p-5">
        <div className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">Bugun ne yapilmali</div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(todaySlots.length > 0
            ? todaySlots.map((slot) => ({
                id: slot.id,
                title: slot.courseName,
                detail: slot.note || `${slot.startTime} - ${slot.endTime}`,
                time: `${slot.startTime} - ${slot.endTime}`,
              }))
            : todayPendingTasks.map((task) => ({
                id: task.id,
                title: task.title,
                detail: task.planLabel || task.courseId,
                time: task.dueDate,
              }))
          ).map((item) => (
            <div key={item.id} className="ios-widget flex min-h-28 items-start gap-3 rounded-[18px] p-4 text-left">
              <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                <BookOpen className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-slate-900">{item.title}</div>
                <div className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">{item.detail}</div>
                <div className="mt-2 text-xs font-semibold text-slate-400">{item.time}</div>
              </div>
            </div>
          ))}
          {todaySlots.length === 0 && todayPendingTasks.length === 0 && (
            <div className="ios-widget rounded-[18px] p-4 text-xs font-semibold text-slate-500">
              Bugun icin planli veya bekleyen gorev yok.
            </div>
          )}
        </div>
      </section>

    <div className="space-y-6">
      <section className="ios-card rounded-[28px] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
              <BookOpen className="h-4 w-4" />
              Müfredat Özeti
            </div>
            <h3 className="mt-2 text-2xl font-black text-slate-900">Ders / ünite / konu yapısı</h3>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Müfredat kaydedildikten sonra burada yalnızca özet görünür. Ders ve konu değişiklikleri ayrı düzenleme ekranından yapılır.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCurriculumEditor}
            className="ios-button-active inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-slate-900"
          >
            <PlusCircle className="h-4 w-4" />
            Ders Ekle / Kaldır
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="ios-widget ios-blue rounded-[22px] p-4">
            <div className="text-xs font-bold uppercase text-slate-500">Aktif ders</div>
            <div className="mt-2 text-2xl font-black text-slate-900">{activeCourses.length}</div>
          </div>
          <div className="ios-widget ios-lilac rounded-[22px] p-4">
            <div className="text-xs font-bold uppercase text-slate-500">Ünite</div>
            <div className="mt-2 text-2xl font-black text-slate-900">{safeCurriculumSummary.unitCount}</div>
          </div>
          <div className="ios-widget ios-mint rounded-[22px] p-4">
            <div className="text-xs font-bold uppercase text-slate-500">Konu</div>
            <div className="mt-2 text-2xl font-black text-slate-900">{safeCurriculumSummary.topicCount}</div>
          </div>
          <div className="ios-widget ios-peach rounded-[22px] p-4">
            <div className="text-xs font-bold uppercase text-slate-500">Tamamlanan</div>
            <div className="mt-2 text-2xl font-black text-slate-900">{safeCurriculumSummary.completedTopicCount}</div>
          </div>
        </div>

        {safeCurriculumSummary.subjects.length === 0 ? (
          <div className="mt-4 rounded-[22px] border border-dashed border-white/20 px-4 py-5 text-sm text-slate-500">
            Henüz ders eklenmedi. Plan motoru ve görev atama için önce müfredat iskeleti tanımlanmalı.
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {safeCurriculumSummary.subjects.slice(0, 8).map((subject) => (
              <span key={subject} className="ios-button rounded-full px-3 py-2 text-xs font-bold text-slate-700">
                {subject}
              </span>
            ))}
            {safeCurriculumSummary.subjects.length > 8 && (
              <span className="ios-button rounded-full px-3 py-2 text-xs font-bold text-slate-500">+{safeCurriculumSummary.subjects.length - 8}</span>
            )}
          </div>
        )}

        {inactiveCourses.length > 0 && (
          <div className="mt-5 rounded-[22px] border border-white/10 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Pasif dersler</div>
                <p className="mt-1 text-sm text-slate-500">Yeni plan ve veri girişlerinde görünmez; geçmiş kayıtlar korunur.</p>
              </div>
              <span className="ios-button rounded-full px-3 py-2 text-xs font-black text-slate-700">{inactiveCourses.length} ders</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {inactiveCourses.map((course) => (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => onReactivateCourse(course.id)}
                  className="ios-button rounded-full px-3 py-2 text-xs font-bold text-slate-700"
                  title={`${course.name} dersini tekrar aktif et`}
                >
                  {course.name} - tekrar aktif et
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <WeeklySchedulePanel schedule={weeklySchedule} courses={safeCourses} curriculum={curriculum} addTask={addTask} onSave={onChangeSchedule} />

      <div className="space-y-6">
        <PlanningPanel
          curriculum={curriculum}
          weeklySchedule={weeklySchedule}
          planningEngineSnapshot={planningEngineSnapshot}
          examScheduleEntries={examScheduleEntries}
          studyPlans={studyPlans}
          courses={safeCourses}
          tasks={tasks}
          addTask={addTask}
          deleteTask={deleteTask}
          updateTaskStatus={updateTaskStatus}
          updateTaskFromPlan={updateTaskFromPlan}
          onChangePlans={onChangePlans}
          onChangeExamSchedules={onChangeExamSchedules}
        />
      </div>
    </div>
    </div>
  );
};

export default ParentPlanningWorkspace;
