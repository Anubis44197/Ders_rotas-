import React from 'react';
import type { Course, ExamScheduleEntry, PlanningEngineSnapshot, StoredStudyPlan, SubjectCurriculum, Task, WeeklySchedule } from '../../types';
import { BookOpen, PlusCircle } from '../icons';
import WeeklySchedulePanel from './WeeklySchedulePanel';
import PlanningPanel from './PlanningPanel';

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

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900">Akademik Planlama</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">Kayıtlı akademik yapıları özetle, gerektiğinde düzenleme ekranlarını aç.</p>
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
